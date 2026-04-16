const express = require("express");
const {
  getExpenses,
  getDeletedExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  restoreExpense,
  approveRejectExpense,
  uploadBills,
  deleteBill,
  serveBill,
} = require("../controllers/expenseController");
const { getExpenseAnalytics } = require("../controllers/expenseAnalyticsController");
const { auth, authorize } = require("../middleware/auth");
const { uploadReceipt } = require("../utils/s3Utils");

const router = express.Router();

// Analytics route MUST come before /:id routes to avoid conflicts
router.get("/analytics", auth, getExpenseAnalytics);
router.get("/deleted", auth, getDeletedExpenses);

// Main CRUD routes
router.get("/", auth, getExpenses);
router.post("/", auth, uploadReceipt.array("bills", 10), createExpense);

// ID-specific routes
router.get("/:id/bills/:billIndex/view", auth, serveBill);
router.delete("/:id/bills/:billIndex", auth, deleteBill);
router.post("/:id/upload-bills", auth, uploadReceipt.array("bills", 10), uploadBills);
router.post("/:id/restore", auth, authorize("HR", "ADMIN"), restoreExpense);
router.put("/:id", auth, uploadReceipt.array("bills", 10), updateExpense);
router.delete("/:id", auth, deleteExpense);
router.put(
  "/:id/approve-reject",
  auth,
  authorize("MANAGER", "HR", "ADMIN"),
  approveRejectExpense,
);

module.exports = router;
