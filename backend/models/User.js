const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true },
  firstName: { type: String, required: true, index: true },
  lastName: { type: String, required: true, index: true },
  role: { 
    type: String, 
    enum: ['ADMIN', 'HR', 'MANAGER', 'EMPLOYEE'], 
    default: 'EMPLOYEE',
    index: true
  },
  roleId: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
  customPermissions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Permission' }],
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
  department: { type: mongoose.Schema.Types.Mixed, index: true },
  designation: String,
  joinDate: { type: Date, default: null, index: true },
  dateOfBirth: { type: Date, default: null },
  profileImage: String,
  isActive: { type: Boolean, default: true, index: true },
  refreshToken: String,
  roleChangeNotification: {
    hasNotification: { type: Boolean, default: false },
    oldRole: String,
    newRole: String
  },
  exitDetails: {
    reason: String,
    exitDate: Date,
    exitInterview: String,
    handoverStatus: String,
    notes: String,
    deactivatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    deactivatedAt: Date
  }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    // Validate dates before saving
    if (this.joinDate) {
      const year = this.joinDate.getFullYear();
      if (isNaN(year) || year < 1900 || year > 2100) {
        this.joinDate = null;
      }
    }
    if (this.dateOfBirth) {
      const year = this.dateOfBirth.getFullYear();
      if (isNaN(year) || year < 1900 || year > 2100) {
        this.dateOfBirth = null;
      }
    }
    return next();
  }
  this.password = await bcrypt.hash(this.password, 12);
  // Validate dates before saving
  if (this.joinDate) {
    const year = this.joinDate.getFullYear();
    if (isNaN(year) || year < 1900 || year > 2100) {
      this.joinDate = null;
    }
  }
  if (this.dateOfBirth) {
    const year = this.dateOfBirth.getFullYear();
    if (isNaN(year) || year < 1900 || year > 2100) {
      this.dateOfBirth = null;
    }
  }
  next();
});

userSchema.methods.comparePassword = async function(password) {
  return bcrypt.compare(password, this.password);
};

module.exports = mongoose.model('User', userSchema);