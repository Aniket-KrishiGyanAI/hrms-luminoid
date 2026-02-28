const Department = require('../models/Department');
const User = require('../models/User');
const multer = require('multer');
const xlsx = require('xlsx');

exports.createDepartment = async (req, res) => {
  try {
    const { name, code, description, departmentHead, parentDepartment, location } = req.body;
    
    const department = await Department.create({
      name, code, description, 
      departmentHead: departmentHead || undefined,
      parentDepartment: parentDepartment || undefined,
      location
    });
    
    await department.populate('departmentHead', 'firstName lastName email');
    res.status(201).json({ success: true, data: department });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getAllDepartments = async (req, res) => {
  try {
    const { page = 1, limit = 10, sort = 'name', order = 'asc', search, status, location, departmentHead } = req.query;
    
    const query = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) query.status = status;
    if (location) query.location = location;
    if (departmentHead) query.departmentHead = departmentHead;
    
    const sortOrder = order === 'desc' ? -1 : 1;
    const sortObj = { [sort]: sortOrder };
    
    const departments = await Department.find(query)
      .populate('departmentHead', 'firstName lastName email')
      .populate('parentDepartment', 'name code')
      .sort(sortObj)
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Department.countDocuments(query);
    
    res.json({ 
      success: true, 
      data: departments,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getDepartmentById = async (req, res) => {
  try {
    const department = await Department.findById(req.params.id)
      .populate('departmentHead', 'firstName lastName email role')
      .populate('parentDepartment', 'name code')
      .populate('documents.uploadedBy', 'firstName lastName');
    
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }
    
    const employees = await User.find({ department: req.params.id })
      .select('firstName lastName email designation role joinDate profileImage department');
    
    // Get sub-departments
    const subDepartments = await Department.find({ parentDepartment: req.params.id })
      .select('name code employeeCount status');
    
    // Calculate stats
    const stats = {
      totalEmployees: employees.length,
      totalDocuments: department.documents.length,
      subDepartments: subDepartments.length
    };
    
    res.json({ success: true, data: { ...department.toObject(), employees, subDepartments, stats } });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateDepartment = async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.departmentHead === '') updateData.departmentHead = undefined;
    if (updateData.parentDepartment === '') updateData.parentDepartment = undefined;
    
    const department = await Department.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('departmentHead', 'firstName lastName email');
    
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }
    
    res.json({ success: true, data: department });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.deleteDepartment = async (req, res) => {
  try {
    const employeeCount = await User.countDocuments({ department: req.params.id });
    
    if (employeeCount > 0) {
      return res.status(400).json({ 
        success: false, 
        message: `Cannot delete department with ${employeeCount} employees. Please reassign them first.` 
      });
    }
    
    const department = await Department.findByIdAndDelete(req.params.id);
    
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }
    
    res.json({ success: true, message: 'Department deleted successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.assignEmployee = async (req, res) => {
  try {
    const { employeeId, departmentId } = req.body;
    
    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }
    
    const user = await User.findByIdAndUpdate(
      employeeId,
      { department: departmentId },
      { new: true }
    );
    
    if (!user) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }
    
    await updateEmployeeCount(departmentId);
    
    res.json({ success: true, data: user });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.bulkAssignEmployees = async (req, res) => {
  try {
    const { employeeIds, departmentId } = req.body;
    
    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }
    
    // Get old departments for count update
    const oldDepts = await User.find({ _id: { $in: employeeIds } }).distinct('department');
    
    await User.updateMany(
      { _id: { $in: employeeIds } },
      { department: departmentId }
    );
    
    // Update counts for all affected departments
    await updateEmployeeCount(departmentId);
    for (const deptId of oldDepts) {
      if (deptId) await updateEmployeeCount(deptId);
    }
    
    res.json({ success: true, message: `${employeeIds.length} employees assigned successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.bulkStatusChange = async (req, res) => {
  try {
    const { departmentIds, status } = req.body;
    
    await Department.updateMany(
      { _id: { $in: departmentIds } },
      { status }
    );
    
    res.json({ success: true, message: `${departmentIds.length} departments updated successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.bulkDelete = async (req, res) => {
  try {
    const { departmentIds } = req.body;
    
    // Check if any department has employees
    const deptsWithEmployees = [];
    for (const id of departmentIds) {
      const count = await User.countDocuments({ department: id });
      if (count > 0) {
        const dept = await Department.findById(id);
        deptsWithEmployees.push({ name: dept.name, count });
      }
    }
    
    if (deptsWithEmployees.length > 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Some departments have employees',
        departments: deptsWithEmployees
      });
    }
    
    await Department.deleteMany({ _id: { $in: departmentIds } });
    
    res.json({ success: true, message: `${departmentIds.length} departments deleted successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.transferEmployees = async (req, res) => {
  try {
    const { employeeIds, fromDepartmentId, toDepartmentId } = req.body;
    
    if (!employeeIds || employeeIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No employees selected' });
    }
    
    const toDept = await Department.findById(toDepartmentId);
    if (!toDept) {
      return res.status(404).json({ success: false, message: 'Target department not found' });
    }
    
    const result = await User.updateMany(
      { _id: { $in: employeeIds } },
      { department: toDepartmentId }
    );
    
    if (fromDepartmentId) await updateEmployeeCount(fromDepartmentId);
    await updateEmployeeCount(toDepartmentId);
    
    res.json({ success: true, message: `${result.modifiedCount} employees transferred successfully` });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addGoal = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, targetDate, owner, milestones } = req.body;
    
    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }
    
    const newGoal = {
      title,
      description,
      targetDate,
      owner: owner || undefined,
      milestones: milestones || [],
      activityLog: [{
        action: 'CREATED',
        user: req.user.id,
        timestamp: new Date(),
        details: `Goal "${title}" created`
      }]
    };
    
    department.goals.push(newGoal);
    await department.save();
    await department.populate('goals.owner', 'firstName lastName email');
    
    res.json({ success: true, data: department });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateGoal = async (req, res) => {
  try {
    const { id, goalId } = req.params;
    const { progress, status, owner } = req.body;
    
    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }
    
    const goal = department.goals.id(goalId);
    if (!goal) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
    }
    
    const changes = [];
    if (progress !== undefined && progress !== goal.progress) {
      goal.progress = progress;
      changes.push(`Progress updated to ${progress}%`);
    }
    if (status && status !== goal.status) {
      goal.status = status;
      changes.push(`Status changed to ${status}`);
    }
    if (owner && owner !== goal.owner?.toString()) {
      goal.owner = owner;
      changes.push('Owner updated');
    }
    
    if (changes.length > 0) {
      goal.updatedAt = new Date();
      goal.activityLog.push({
        action: 'UPDATED',
        user: req.user.id,
        timestamp: new Date(),
        details: changes.join(', ')
      });
    }
    
    await department.save();
    await department.populate('goals.owner', 'firstName lastName email');
    
    res.json({ success: true, data: department });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.addGoalComment = async (req, res) => {
  try {
    const { id, goalId } = req.params;
    const { text } = req.body;
    
    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }
    
    const goal = department.goals.id(goalId);
    if (!goal) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
    }
    
    goal.comments.push({ text, author: req.user.id });
    goal.activityLog.push({
      action: 'COMMENT_ADDED',
      user: req.user.id,
      timestamp: new Date(),
      details: 'Comment added'
    });
    
    await department.save();
    await department.populate('goals.comments.author', 'firstName lastName');
    
    res.json({ success: true, data: department });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.updateMilestone = async (req, res) => {
  try {
    const { id, goalId, milestoneId } = req.params;
    const { completed } = req.body;
    
    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }
    
    const goal = department.goals.id(goalId);
    if (!goal) {
      return res.status(404).json({ success: false, message: 'Goal not found' });
    }
    
    const milestone = goal.milestones.id(milestoneId);
    if (!milestone) {
      return res.status(404).json({ success: false, message: 'Milestone not found' });
    }
    
    milestone.completed = completed;
    if (completed) {
      milestone.completedAt = new Date();
    } else {
      milestone.completedAt = undefined;
    }
    
    // Auto-calculate progress based on milestones
    const totalMilestones = goal.milestones.length;
    const completedMilestones = goal.milestones.filter(m => m.completed).length;
    goal.progress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;
    
    goal.activityLog.push({
      action: 'MILESTONE_UPDATED',
      user: req.user.id,
      timestamp: new Date(),
      details: `Milestone "${milestone.title}" ${completed ? 'completed' : 'reopened'}`
    });
    
    await department.save();
    
    res.json({ success: true, data: department });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.uploadDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, url } = req.body;
    
    const department = await Department.findById(id);
    if (!department) {
      return res.status(404).json({ success: false, message: 'Department not found' });
    }
    
    department.documents.push({ name, url, uploadedBy: req.user.id });
    await department.save();
    
    res.json({ success: true, data: department });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.importDepartments = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const data = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    
    const results = { success: [], errors: [] };
    
    for (const row of data) {
      try {
        const existing = await Department.findOne({ code: row.code });
        if (existing) {
          results.errors.push({ code: row.code, error: 'Department already exists' });
          continue;
        }
        
        await Department.create({
          name: row.name,
          code: row.code,
          description: row.description,
          location: row.location,
          status: row.status || 'ACTIVE'
        });
        
        results.success.push(row.code);
      } catch (error) {
        results.errors.push({ code: row.code, error: error.message });
      }
    }
    
    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.getHierarchy = async (req, res) => {
  try {
    const departments = await Department.find()
      .populate('departmentHead', 'firstName lastName')
      .populate('parentDepartment', 'name')
      .select('name code parentDepartment employeeCount status');
    
    // Build tree structure
    const buildTree = (parentId = null) => {
      return departments
        .filter(d => {
          if (parentId === null) return !d.parentDepartment;
          return d.parentDepartment && d.parentDepartment._id.toString() === parentId.toString();
        })
        .map(d => ({
          ...d.toObject(),
          children: buildTree(d._id)
        }));
    };
    
    const tree = buildTree();
    
    res.json({ success: true, data: tree });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

async function updateEmployeeCount(departmentId) {
  const count = await User.countDocuments({ department: departmentId });
  await Department.findByIdAndUpdate(departmentId, { employeeCount: count });
}
