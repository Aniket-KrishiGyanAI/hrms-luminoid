const mongoose = require('mongoose');

const visitPlanSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  clients: [{
    clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'FieldClient', required: true },
    visitOrder: { type: Number, default: 0 },
    notes: String
  }],
  instructions: String,
  status: {
    type: String,
    enum: ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'PARTIAL'],
    default: 'PENDING'
  }
}, { timestamps: true });

visitPlanSchema.index({ employeeId: 1, date: -1 });
visitPlanSchema.index({ assignedBy: 1 });

module.exports = mongoose.model('VisitPlan', visitPlanSchema);
