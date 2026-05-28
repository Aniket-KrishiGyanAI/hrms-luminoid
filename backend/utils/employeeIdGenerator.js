const EmployeeProfile = require('../models/EmployeeProfile');

/**
 * Generate unique employee ID starting with LUM
 * Format: LUM0001, LUM0002, etc.
 */
const generateEmployeeId = async () => {
  try {
    // Find the last employee profile with an employeeId starting with LUM
    const lastEmployee = await EmployeeProfile.findOne({
      'professionalInfo.employeeId': { $regex: /^LUM\d+$/ }
    })
      .sort({ 'professionalInfo.employeeId': -1 })
      .select('professionalInfo.employeeId')
      .lean();

    let nextNumber = 1;

    if (lastEmployee?.professionalInfo?.employeeId) {
      // Extract the numeric part and increment
      const lastNumber = parseInt(lastEmployee.professionalInfo.employeeId.replace('LUM', ''), 10);
      nextNumber = lastNumber + 1;
    }

    // Format with leading zeros (4 digits)
    const employeeId = `LUM${String(nextNumber).padStart(4, '0')}`;
    
    return employeeId;
  } catch (error) {
    throw new Error(`Error generating employee ID: ${error.message}`);
  }
};

module.exports = { generateEmployeeId };
