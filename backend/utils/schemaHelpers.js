const mongoose = require('mongoose');

/**
 * Base schema options with timestamps and soft delete
 */
const baseSchemaOptions = {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
};

/**
 * Soft delete fields to add to schemas
 */
const softDeleteFields = {
  isDeleted: { 
    type: Boolean, 
    default: false, 
    index: true 
  },
  deletedAt: { 
    type: Date, 
    default: null 
  },
  deletedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User',
    default: null
  },
  deletionReason: { 
    type: String,
    default: null
  }
};

/**
 * Add soft delete functionality to a schema
 * @param {mongoose.Schema} schema - Mongoose schema
 */
function addSoftDelete(schema) {
  // Add soft delete fields
  schema.add(softDeleteFields);

  // Add query helpers
  schema.query.notDeleted = function() {
    return this.where({ isDeleted: { $ne: true } });
  };

  schema.query.onlyDeleted = function() {
    return this.where({ isDeleted: true });
  };

  schema.query.withDeleted = function() {
    return this;
  };

  // Override default find to exclude soft deleted
  schema.pre(/^find/, function() {
    if (!this.getOptions().includeDeleted) {
      this.where({ isDeleted: { $ne: true } });
    }
  });

  // Soft delete method
  schema.methods.softDelete = async function(userId, reason = '') {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = userId;
    this.deletionReason = reason;
    return this.save();
  };

  // Restore method
  schema.methods.restore = async function() {
    this.isDeleted = false;
    this.deletedAt = null;
    this.deletedBy = null;
    this.deletionReason = null;
    return this.save();
  };

  // Static soft delete
  schema.statics.softDelete = async function(id, userId, reason = '') {
    return this.findByIdAndUpdate(id, {
      isDeleted: true,
      deletedAt: new Date(),
      deletedBy: userId,
      deletionReason: reason
    }, { new: true });
  };

  // Static restore
  schema.statics.restore = async function(id) {
    return this.findByIdAndUpdate(id, {
      isDeleted: false,
      deletedAt: null,
      deletedBy: null,
      deletionReason: null
    }, { new: true });
  };
}

/**
 * Add audit trail fields
 */
const auditFields = {
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  updatedBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User' 
  },
  history: [{
    action: { type: String, enum: ['CREATE', 'UPDATE', 'DELETE', 'RESTORE'] },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    timestamp: { type: Date, default: Date.now },
    changes: mongoose.Schema.Types.Mixed,
    reason: String
  }]
};

/**
 * Add audit trail to schema
 * @param {mongoose.Schema} schema - Mongoose schema
 */
function addAuditTrail(schema) {
  schema.add(auditFields);

  schema.methods.addToHistory = function(action, userId, changes = {}, reason = '') {
    if (!this.history) this.history = [];
    this.history.push({
      action,
      userId,
      timestamp: new Date(),
      changes,
      reason
    });
  };
}

/**
 * Enhanced schema validation
 */
const validationHelpers = {
  email: {
    type: String,
    required: true,
    lowercase: true,
    trim: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  phone: {
    type: String,
    trim: true,
    match: [/^[0-9]{10}$/, 'Please enter a valid 10-digit phone number']
  },
  url: {
    type: String,
    trim: true,
    match: [/^https?:\/\/.+/, 'Please enter a valid URL']
  },
  positiveNumber: {
    type: Number,
    min: [0, 'Value must be positive']
  },
  percentage: {
    type: Number,
    min: [0, 'Percentage must be between 0 and 100'],
    max: [100, 'Percentage must be between 0 and 100']
  }
};

module.exports = {
  baseSchemaOptions,
  softDeleteFields,
  addSoftDelete,
  auditFields,
  addAuditTrail,
  validationHelpers
};
