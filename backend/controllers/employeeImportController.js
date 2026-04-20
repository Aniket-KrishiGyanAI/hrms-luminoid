const User = require('../models/User');
const EmployeeProfile = require('../models/EmployeeProfile');
const xlsx = require('xlsx');
const csv = require('csv-parser');
const fs = require('fs');
const bcrypt = require('bcryptjs');
const logger = require('../utils/logger');

const importEmployees = async (req, res) => {
  try {
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    let employees = [];
    const fileExtension = file.originalname.split('.').pop().toLowerCase();

    // Parse Excel file
    if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const workbook = xlsx.readFile(file.path);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      employees = xlsx.utils.sheet_to_json(worksheet);
    } 
    // Parse CSV file
    else if (fileExtension === 'csv') {
      const results = [];
      await new Promise((resolve, reject) => {
        fs.createReadStream(file.path)
          .pipe(csv())
          .on('data', (data) => results.push(data))
          .on('end', resolve)
          .on('error', reject);
      });
      employees = results;
    } else {
      return res.status(400).json({ message: 'Unsupported file format. Please upload Excel (.xlsx, .xls) or CSV file.' });
    }

    const results = {
      success: [],
      errors: [],
      total: employees.length
    };

    // Process each employee
    for (let i = 0; i < employees.length; i++) {
      const empData = employees[i];
      const rowNumber = i + 2; // Excel row number (accounting for header)

      try {
        // Validate required fields
        if (!empData.email || !empData.firstName || !empData.lastName) {
          results.errors.push({
            row: rowNumber,
            email: empData.email || 'N/A',
            error: 'Missing required fields: email, firstName, or lastName'
          });
          continue;
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email: empData.email.toLowerCase() });
        if (existingUser) {
          results.errors.push({
            row: rowNumber,
            email: empData.email,
            error: 'User with this email already exists'
          });
          continue;
        }

        // Generate default password if not provided
        const password = empData.password || 'temp123';
        const hashedPassword = await bcrypt.hash(password, 10);

        // Parse dates only if provided in the sheet
        const dateOfBirth = empData.dateOfBirth ? new Date(empData.dateOfBirth) : null;
        const joinDate = empData.joinDate ? new Date(empData.joinDate) : null;

        // Find manager by email if provided
        let managerId = null;
        if (empData.managerEmail) {
          const manager = await User.findOne({ email: empData.managerEmail.toLowerCase() });
          if (manager) {
            managerId = manager._id;
          }
        }

        // Create user with exact data from sheet
        const newUser = await User.create({
          email: empData.email.toLowerCase(),
          password: hashedPassword,
          firstName: empData.firstName,
          lastName: empData.lastName,
          role: empData.role || 'EMPLOYEE',
          department: empData.department || null,
          designation: empData.designation || null,
          managerId: managerId,
          dateOfBirth: dateOfBirth,
          joinDate: joinDate,
          phone: empData.phone || '',
          address: empData.address || ''
        });

        // Create employee profile if additional data is provided
        const shouldCreateProfile = empData.employeeId || empData.designation || empData.workLocation || empData.address || empData.phone || empData.emergencyContactName;
        
        if (shouldCreateProfile) {
          // Parse address string into object if it's a string
          let addressObj = {};
          if (empData.address && typeof empData.address === 'string') {
            // Simple parsing - you can make this more sophisticated
            const addressParts = empData.address.split(',').map(part => part.trim());
            addressObj = {
              street: addressParts[0] || '',
              city: addressParts[1] || '',
              state: addressParts[2] || '',
              zipCode: '',
              country: 'India' // Default country
            };
          } else if (empData.address && typeof empData.address === 'object') {
            addressObj = empData.address;
          }

          await EmployeeProfile.create({
            userId: newUser._id,
            professionalInfo: {
              employeeId: empData.employeeId || null,
              designation: empData.designation || null,
              workLocation: empData.workLocation || null,
              employmentType: empData.employmentType || null
            },
            workInfo: {
              designation: empData.designation || null,
              department: empData.department || null,
              workLocation: empData.workLocation || null,
              employmentType: empData.employmentType || null
            },
            personalInfo: {
              phone: empData.phone || '',
              address: addressObj,
              emergencyContact: {
                name: empData.emergencyContactName || '',
                phone: empData.emergencyContactPhone || '',
                relationship: empData.emergencyContactRelation || ''
              }
            }
          });
        }

        results.success.push({
          row: rowNumber,
          email: empData.email,
          name: `${empData.firstName} ${empData.lastName}`,
          employeeId: empData.employeeId || `EMP${Date.now()}`
        });

      } catch (error) {
        results.errors.push({
          row: rowNumber,
          email: empData.email || 'N/A',
          error: error.message
        });
      }
    }

    // Clean up uploaded file
    fs.unlinkSync(file.path);

    res.json({
      message: `Import completed. ${results.success.length} employees imported successfully, ${results.errors.length} errors.`,
      results
    });

  } catch (error) {
    // Clean up file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ message: error.message });
  }
};

const downloadTemplate = async (req, res) => {
  try {
    // Create sample data for template
    const templateData = [
      {
        email: 'john.doe@company.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'EMPLOYEE',
        department: 'IT',
        designation: 'Software Developer',
        employeeId: 'EMP001',
        workLocation: 'Head Office',
        employmentType: 'FULL_TIME',
        dateOfBirth: '1990-01-15',
        joinDate: '2024-01-01',
        phone: '+1234567890',
        address: '123 Main St, City, State',
        managerEmail: 'manager@company.com',
        emergencyContactName: 'Jane Doe',
        emergencyContactPhone: '+1234567891',
        emergencyContactRelation: 'Spouse'
      }
    ];

    // Create workbook and worksheet
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(templateData);

    // Add worksheet to workbook
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Employees');

    // Generate buffer
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set headers for file download
    res.setHeader('Content-Disposition', 'attachment; filename=employee_import_template.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const exportEmployees = async (req, res) => {
  try {
    // Fetch all users with their profiles
    const users = await User.find({}).select('-password').lean();
    const profiles = await EmployeeProfile.find({}).populate('userId', 'firstName lastName email role department dateOfBirth joinDate phone address managerId').lean();
    
    // Create a map of profiles by userId
    const profileMap = {};
    profiles.forEach(profile => {
      if (profile.userId) {
        profileMap[profile.userId._id] = profile;
      }
    });

    // Get manager emails
    const managerIds = users.filter(u => u.managerId).map(u => u.managerId);
    const managers = await User.find({ _id: { $in: managerIds } }).select('_id email').lean();
    const managerEmailMap = {};
    managers.forEach(m => {
      managerEmailMap[m._id] = m.email;
    });

    // Format data for export
    const exportData = users.map(user => {
      const profile = profileMap[user._id] || {};
      
      // Format address - convert object to string if needed
      let addressString = '';
      if (profile.personalInfo?.address) {
        const addr = profile.personalInfo.address;
        if (typeof addr === 'object') {
          const parts = [addr.street, addr.city, addr.state].filter(Boolean);
          addressString = parts.join(', ');
        } else {
          addressString = addr;
        }
      } else {
        addressString = user.address || '';
      }
      
      return {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        department: user.department,
        designation: profile.professionalInfo?.designation || profile.workInfo?.designation || '',
        employeeId: profile.professionalInfo?.employeeId || profile.employeeId || '',
        workLocation: profile.professionalInfo?.workLocation || profile.workInfo?.workLocation || '',
        employmentType: profile.professionalInfo?.employmentType || profile.workInfo?.employmentType || '',
        dateOfBirth: user.dateOfBirth ? new Date(user.dateOfBirth).toISOString().split('T')[0] : '',
        joinDate: user.joinDate ? new Date(user.joinDate).toISOString().split('T')[0] : '',
        phone: user.phone || profile.personalInfo?.phone || '',
        address: addressString,
        managerEmail: user.managerId ? managerEmailMap[user.managerId] || '' : '',
        emergencyContactName: profile.personalInfo?.emergencyContact?.name || '',
        emergencyContactPhone: profile.personalInfo?.emergencyContact?.phone || '',
        emergencyContactRelation: profile.personalInfo?.emergencyContact?.relationship || ''
      };
    });

    // Create workbook and worksheet
    const workbook = xlsx.utils.book_new();
    const worksheet = xlsx.utils.json_to_sheet(exportData);

    // Add worksheet to workbook
    xlsx.utils.book_append_sheet(workbook, worksheet, 'Employees');

    // Generate buffer
    const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

    // Set headers for file download
    const timestamp = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Disposition', `attachment; filename=employees_export_${timestamp}.xlsx`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

    res.send(buffer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  importEmployees,
  downloadTemplate,
  exportEmployees
};