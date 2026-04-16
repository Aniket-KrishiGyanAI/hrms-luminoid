const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { addSoftDelete, validationHelpers } = require('../utils/schemaHelpers');

const userSchema = new mongoose.Schema({
  email: { 
    type: String, 
    required: [true, 'Email is required'],
    unique: true, 
    index: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },
  firstName: { 
    type: String, 
    required: [true, 'First name is required'],
    trim: true,
    minlength: [2, 'First name must be at least 2 characters'],
    maxlength: [50, 'First name cannot exceed 50 characters'],
    index: true 
  },
  lastName: { 
    type: String, 
    required: [true, 'Last name is required'],
    trim: true,
    minlength: [2, 'Last name must be at least 2 characters'],
    maxlength: [50, 'Last name cannot exceed 50 characters'],
    index: true 
  },
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
  designation: { 
    type: String,
    trim: true,
    maxlength: [100, 'Designation cannot exceed 100 characters']
  },
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
  },
  isFieldEmployee: { type: Boolean, default: false },
  locationConsent: {
    granted: { type: Boolean, default: false },
    grantedAt: { type: Date },
    revokedAt: { type: Date },
    ipAddress: String,
    userAgent: String
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add soft delete functionality
addSoftDelete(userSchema);

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