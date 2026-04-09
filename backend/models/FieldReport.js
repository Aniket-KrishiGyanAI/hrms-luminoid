const mongoose = require('mongoose');

const fieldReportSchema = new mongoose.Schema({
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: Date, required: true },
  totalPlanned: { type: Number, default: 0 },
  totalVisited: { type: Number, default: 0 },
  totalCompleted: { type: Number, default: 0 },
  totalDistanceKm: { type: Number, default: 0 },
  totalDurationMinutes: { type: Number, default: 0 },
  outcomeSummary: {
    ORDER_RECEIVED: { type: Number, default: 0 },
    POSITIVE: { type: Number, default: 0 },
    NEUTRAL: { type: Number, default: 0 },
    NEGATIVE: { type: Number, default: 0 },
    DEMO_SCHEDULED: { type: Number, default: 0 },
    PROPOSAL_SENT: { type: Number, default: 0 },
    NO_RESPONSE: { type: Number, default: 0 }
  },
  totalDealValue: { type: Number, default: 0 },
  visits: [{ type: mongoose.Schema.Types.ObjectId, ref: 'FieldVisit' }],
  generatedAt: { type: Date, default: Date.now }
}, { timestamps: true });

fieldReportSchema.index({ employeeId: 1, date: -1 });
fieldReportSchema.index({ date: -1 });

module.exports = mongoose.model('FieldReport', fieldReportSchema);
