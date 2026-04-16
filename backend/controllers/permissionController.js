const Permission = require('../models/Permission');
const Role = require('../models/Role');
const User = require('../models/User');
const logger = require('../utils/logger');

const getPermissions = async (req, res) => {
  try {
    const permissions = await Permission.find({ isActive: true })
      .sort({ category: 1, resource: 1, action: 1 });
    
    // Group by category
    const grouped = permissions.reduce((acc, perm) => {
      if (!acc[perm.category]) acc[perm.category] = [];
      acc[perm.category].push(perm);
      return acc;
    }, {});
    
    res.json(grouped);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getRoles = async (req, res) => {
  try {
    const roles = await Role.find({ isActive: true })
      .populate('permissions')
      .sort({ name: 1 });
    res.json(roles);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const createRole = async (req, res) => {
  try {
    const { name, displayName, description, permissions, color } = req.body;
    
    const role = new Role({
      name: name.toUpperCase().replace(/\s+/g, '_'),
      displayName,
      description,
      permissions,
      color
    });
    
    await role.save();
    await role.populate('permissions');
    
    res.status(201).json({ message: 'Role created successfully', role });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { displayName, description, permissions, color } = req.body;
    
    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }
    
    if (role.isSystem) {
      return res.status(400).json({ message: 'Cannot modify system role' });
    }
    
    role.displayName = displayName;
    role.description = description;
    role.permissions = permissions;
    role.color = color;
    
    await role.save();
    await role.populate('permissions');
    
    res.json({ message: 'Role updated successfully', role });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const deleteRole = async (req, res) => {
  try {
    const { id } = req.params;
    
    const role = await Role.findById(id);
    if (!role) {
      return res.status(404).json({ message: 'Role not found' });
    }
    
    if (role.isSystem) {
      return res.status(400).json({ message: 'Cannot delete system role' });
    }
    
    // Check if role is assigned to users
    const usersWithRole = await User.countDocuments({ roleId: id });
    if (usersWithRole > 0) {
      return res.status(400).json({ 
        message: `Cannot delete role. ${usersWithRole} users are assigned to this role.` 
      });
    }
    
    role.isActive = false;
    await role.save();
    
    res.json({ message: 'Role deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const assignUserRole = async (req, res) => {
  try {
    const { userId, roleId, customPermissions } = req.body;
    
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    user.roleId = roleId;
    user.customPermissions = customPermissions || [];
    
    await user.save();
    await user.populate(['roleId', 'customPermissions']);
    
    res.json({ message: 'User role updated successfully', user });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const checkPermission = async (req, res) => {
  try {
    const { resource, action } = req.query;
    const userId = req.user.id;
    
    const hasPermission = await checkUserPermission(userId, resource, action);
    res.json({ hasPermission });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const checkUserPermission = async (userId, resource, action) => {
  try {
    const user = await User.findById(userId)
      .populate('roleId')
      .populate('customPermissions');
    
    if (!user) return false;
    
    // Check custom permissions first
    const hasCustomPermission = user.customPermissions?.some(perm => 
      perm.resource === resource && perm.action === action
    );
    
    if (hasCustomPermission) return true;
    
    // Check role permissions
    if (user.roleId) {
      const role = await Role.findById(user.roleId).populate('permissions');
      const hasRolePermission = role.permissions?.some(perm => 
        perm.resource === resource && perm.action === action
      );
      
      if (hasRolePermission) return true;
    }
    
    return false;
  } catch (error) {
    console.error('Permission check error:', error);
    return false;
  }
};

module.exports = {
  getPermissions,
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  assignUserRole,
  checkPermission,
  checkUserPermission
};