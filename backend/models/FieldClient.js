const mongoose = require('mongoose');

const fieldClientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  contactPerson: { type: String, required: true },
  phone: String,
  email: String,
  address: { type: String, required: true },
  location: {
    lat: Number,
    lng: Number
  },
  industry: String,
  notes: String,
  priority: { type: String, enum: ['HIGH', 'MEDIUM', 'LOW'], default: 'MEDIUM' },
  status: { type: String, enum: ['ACTIVE', 'INACTIVE', 'PROSPECT', 'CONVERTED'], default: 'PROSPECT' },
  assignedTo: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });

fieldClientSchema.index({ assignedTo: 1 });
fieldClientSchema.index({ status: 1 });

module.exports = mongoose.model('FieldClient', fieldClientSchema);
