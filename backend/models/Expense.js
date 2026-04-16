const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema(
  {
    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true },
    category: {
      type: String,
      enum: [
        "TRAVEL",
        "MEALS",
        "ACCOMMODATION",
        "TRANSPORT",
        "OFFICE_SUPPLIES",
        "TRAINING",
        "OTHER",
      ],
      required: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },
    expenseDate: { type: Date, required: true },
    description: String,

    // ✨ Multiple bills support
    bills: [
      {
        fileName: String,
        filePath: String,
        fileSize: Number,
        uploadedAt: { type: Date, default: Date.now },
      },
    ],

    // Backward compatibility
    receipt: {
      fileName: String,
      filePath: String,
    },

    status: {
      type: String,
      enum: ["SUBMITTED", "APPROVED", "REJECTED", "REIMBURSED"],
      default: "SUBMITTED",
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedDate: Date,
    rejectionReason: String,
    reimbursementDate: Date,
    reimbursementNote: { type: String },
    billingMonth: { type: String, required: true },

    // Timeline history of all status changes
    timeline: [
      {
        status: { type: String },
        actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        actorName: { type: String },
        note: { type: String },
        timestamp: { type: Date, default: Date.now },
      },
    ],

    // ✨ Soft delete support
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
    deletedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deletedByName: { type: String },
    deletionReason: { type: String },
  },
  { timestamps: true },
);

// Index for faster queries
expenseSchema.index({ billingMonth: 1, employeeId: 1 });
expenseSchema.index({ status: 1, billingMonth: 1 });
expenseSchema.index({ isDeleted: 1, billingMonth: 1 });

module.exports = mongoose.model("Expense", expenseSchema);
