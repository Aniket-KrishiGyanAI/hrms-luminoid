const User = require('../models/User');
const { deleteProfileImage } = require('../utils/s3Utils');

const updateRole = async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    if (!['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'].includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const oldRole = user.role;
    user.role = role;
    user.roleChangeNotification = {
      hasNotification: true,
      oldRole: oldRole,
      newRole: role
    };
    await user.save();

    res.json({ message: 'Role updated successfully', user: { id: user._id, email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { firstName, lastName, email, department, designation, joinDate, dateOfBirth } = req.body;
    
    console.log('updateUser received:', { userId, firstName, lastName, email, department, designation, joinDate, dateOfBirth });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (email) user.email = email;
    if (department !== undefined) user.department = department;
    if (designation !== undefined) user.designation = designation;
    if (joinDate !== undefined) user.joinDate = joinDate ? new Date(joinDate) : null;
    if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : null;

    await user.save();
    
    console.log('User saved:', { joinDate: user.joinDate, dateOfBirth: user.dateOfBirth });

    res.json({ message: 'User updated', user: { id: user._id, firstName: user.firstName, lastName: user.lastName, email: user.email, department: user.department, designation: user.designation, role: user.role, joinDate: user.joinDate, dateOfBirth: user.dateOfBirth } });
  } catch (error) {
    console.error('updateUser error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Delete profile image from S3 if exists
    if (user.profileImage) {
      await deleteProfileImage(user.profileImage);
    }

    // remove associated EmployeeProfile if exists
    const EmployeeProfile = require('../models/EmployeeProfile');
    await EmployeeProfile.deleteOne({ userId });

    await User.findByIdAndDelete(userId);

    res.json({ message: 'User and profile deleted' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const changePassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const isPasswordValid = await user.comparePassword(currentPassword);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword) {
      return res.status(400).json({ message: 'New password is required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getUserById = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select('-password -refreshToken');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const clearRoleNotification = async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    user.roleChangeNotification = { hasNotification: false, oldRole: '', newRole: '' };
    await user.save();
    
    res.json({ message: 'Notification cleared' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = { updateRole, updateUser, deleteUser, changePassword, resetPassword, getUserById, clearRoleNotification };