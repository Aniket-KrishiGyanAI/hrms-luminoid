const mongoose = require('mongoose');

const fieldVisitSchema = new mongoose.Schema({
  clientId: { type: mongoose.Schema.Types.ObjectId, ref: 'FieldClient', required: true },
  employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  visitPlanId: { type: mongoose.Schema.Types.ObjectId, ref: 'VisitPlan' },
  visitDate: { type: Date, required: true },

  checkIn: {
    time: Date,
    location: { lat: Number, lng: Number, address: String }
  },
  checkOut: {
    time: Date,
    location: { lat: Number, lng: Number, address: String }
  },

  photos: [{
    url: { type: String, required: true },
    lat: Number,
    lng: Number,
    address: String,
    capturedAt: { type: Date, default: Date.now }
  }],

  routePoints: [{
    lat: { type: Number, required: true },
    lng: { type: Number, required: true },
    timestamp: { type: Date, default: Date.now }
  }],

  outcome: {
    status: {
      type: String,
      enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE', 'ORDER_RECEIVED', 'DEMO_SCHEDULED', 'PROPOSAL_SENT', 'NO_RESPONSE'],
      default: 'NEUTRAL'
    },
    notes: String,
    nextAction: String,
    nextFollowUpDate: Date,
    dealValue: Number
  },

  selfReported: { type: Boolean, default: false },
  selfReportNote: { type: String },
  personMet: { type: String },
  purposeOfVisit: { type: String },

  totalDistanceKm: { type: Number, default: 0 },
  durationMinutes: { type: Number, default: 0 },

  status: {
    type: String,
    enum: ['PLANNED', 'CHECKED_IN', 'COMPLETED', 'CANCELLED'],
    default: 'PLANNED'
  }
}, { timestamps: true });

fieldVisitSchema.index({ employeeId: 1, visitDate: -1 });
fieldVisitSchema.index({ clientId: 1 });
fieldVisitSchema.index({ visitDate: 1, status: 1 });

module.exports = mongoose.model('FieldVisit', fieldVisitSchema);
