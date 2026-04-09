const Expense = require("../models/Expense");
const fs = require("fs");
const path = require("path");

const RECEIPTS_DIR = path.resolve(__dirname, "../uploads/receipts");

// Safely delete a file only if it's within the allowed receipts directory
const safeUnlink = (filePath) => {
  try {
    const resolved = path.resolve(filePath);
    if (!resolved.startsWith(RECEIPTS_DIR + path.sep) && resolved !== RECEIPTS_DIR) {
      console.error("Blocked path traversal attempt:", filePath);
      return;
    }
    fs.unlink(resolved, (err) => {
      if (err) console.error("Error deleting file:", err);
    });
  } catch (err) {
    console.error("safeUnlink error:", err);
  }
};

// Returns lock status and warning info for current date
const getMonthLockInfo = () => {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const today = now.getDate();
  const daysLeft = lastDay - today;
  const locked = today >= lastDay;

  return {
    isLocked: locked,
    isWarning: !locked && daysLeft <= 5,
    daysLeft,
    lastDay,
  };
};

// Check if a given billingMonth (YYYY-MM) is locked
const isMonthLocked = (billingMonth) => {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (billingMonth < currentMonth) return true;
  if (billingMonth === currentMonth) {
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return now.getDate() >= lastDay;
  }
  return false;
};

const getExpenses = async (req, res) => {
  try {
    const { billingMonth, page = 1, limit = 20 } = req.query;
    const query =
      req.user.role === "EMPLOYEE" ? { employeeId: req.user.id } : {};
    if (billingMonth) query.billingMonth = billingMonth;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Expense.countDocuments(query);

    const expenses = await Expense.find(query)
      .populate('employeeId', 'firstName lastName department')
      .populate('approvedBy', 'firstName lastName')
      .populate('timeline.actor', 'firstName lastName')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const currentBillingMonth = billingMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const lockInfo = {
      ...getMonthLockInfo(),
      isLocked: isMonthLocked(currentBillingMonth)
    };

    res.json({
      expenses,
      lockInfo,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createExpense = async (req, res) => {
  try {
    const billingMonth = req.body.billingMonth || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(billingMonth)) {
      return res.status(400).json({ message: "Invalid billingMonth format. Use YYYY-MM." });
    }
    if (isMonthLocked(billingMonth)) {
      return res.status(403).json({ message: "That month is closed. No new expenses can be submitted." });
    }

    const amount = parseFloat(req.body.amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0." });
    }

    const { title, category, expenseDate, description, currency } = req.body;
    const expenseData = {
      title,
      category,
      amount,
      expenseDate,
      description,
      currency,
      employeeId: req.user.id,
      billingMonth,
      status: 'SUBMITTED',
      bills: [],
    };

    // ✨ Handle multiple bill uploads
    if (req.files && req.files.length > 0) {
      expenseData.bills = req.files.map((file) => ({
        fileName: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        uploadedAt: new Date(),
      }));

      // Keep first file as receipt for backward compatibility
      expenseData.receipt = {
        fileName: req.files[0].originalname,
        filePath: req.files[0].path,
      };
    }

    const expense = new Expense(expenseData);
    // Timeline: submitted by employee
    expense.timeline = [{ status: 'SUBMITTED', actor: req.user.id, actorName: req.user.firstName ? `${req.user.firstName} ${req.user.lastName}` : req.user.email, note: 'Expense submitted', timestamp: new Date() }];
    await expense.save();
    res.status(201).json({
      message: "Expense created successfully",
      expense,
    });
  } catch (error) {
    // Clean up uploaded files on error
    if (req.files) req.files.forEach((file) => safeUnlink(file.path));
    res.status(400).json({ message: error.message });
  }
};

const updateExpense = async (req, res) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, employeeId: req.user.id });
    if (!expense) return res.status(404).json({ message: "Expense not found." });
    if (isMonthLocked(expense.billingMonth)) {
      return res.status(403).json({ message: "That month is closed. Expenses cannot be edited." });
    }
    if (expense.status !== 'REJECTED') {
      return res.status(403).json({ message: "Only REJECTED expenses can be edited and resubmitted." });
    }

    const amount = parseFloat(req.body.amount);
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Amount must be greater than 0." });
    }

    const { title, category, expenseDate, description, currency } = req.body;
    const updateData = { title, category, amount, expenseDate, description, currency };

    // ✨ Handle new bill uploads (append to existing bills)
    if (req.files && req.files.length > 0) {
      const newBills = req.files.map((file) => ({
        fileName: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        uploadedAt: new Date(),
      }));

      updateData.bills = [...(expense.bills || []), ...newBills];

      // Update receipt field with latest file for backward compatibility
      updateData.receipt = {
        fileName: req.files[0].originalname,
        filePath: req.files[0].path,
      };
    }

    const updated = await Expense.findByIdAndUpdate(
      req.params.id,
      {
        ...updateData,
        status: 'SUBMITTED',
        $push: { timeline: { status: 'SUBMITTED', actor: req.user.id, actorName: req.user.firstName ? `${req.user.firstName} ${req.user.lastName}` : req.user.email, note: 'Expense edited and resubmitted', timestamp: new Date() } },
      },
      { new: true }
    );
    res.json({
      message: "Expense updated and resubmitted successfully",
      expense: updated,
    });
  } catch (error) {
    // Clean up uploaded files on error
    if (req.files) req.files.forEach((file) => safeUnlink(file.path));
    res.status(400).json({ message: error.message });
  }
};

// ✨ NEW: Upload additional bills to existing expense
const uploadBills = async (req, res) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, employeeId: req.user.id });
    if (!expense) return res.status(404).json({ message: "Expense not found." });
    if (isMonthLocked(expense.billingMonth)) {
      return res.status(403).json({ message: "That month is closed. Cannot upload bills." });
    }

    if (!['REJECTED'].includes(expense.status)) {
      return res.status(403).json({ message: "Bills can only be added to REJECTED expenses." });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded." });
    }

    const newBills = req.files.map((file) => ({
      fileName: file.originalname,
      filePath: file.path,
      fileSize: file.size,
      uploadedAt: new Date(),
    }));

    expense.bills = [...(expense.bills || []), ...newBills];
    await expense.save();

    res.json({
      message: `${req.files.length} bill(s) uploaded successfully`,
      bills: expense.bills,
    });
  } catch (error) {
    // Clean up uploaded files on error
    if (req.files) req.files.forEach((file) => safeUnlink(file.path));
    res.status(400).json({ message: error.message });
  }
};

// ✨ NEW: Delete a specific bill from expense
const deleteBill = async (req, res) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, employeeId: req.user.id });
    if (!expense) return res.status(404).json({ message: "Expense not found." });
    if (isMonthLocked(expense.billingMonth)) {
      return res.status(403).json({ message: "That month is closed. Cannot delete bills." });
    }

    if (!['REJECTED'].includes(expense.status)) {
      return res.status(403).json({ message: "Bills can only be deleted from REJECTED expenses." });
    }

    const billIndex = parseInt(req.params.billIndex);
    if (isNaN(billIndex) || billIndex < 0 || billIndex >= expense.bills.length) {
      return res.status(400).json({ message: "Invalid bill index." });
    }

    const bill = expense.bills[billIndex];

    // Delete file from disk (safe)
    safeUnlink(bill.filePath);

    // Remove from array
    expense.bills.splice(billIndex, 1);
    await expense.save();

    res.json({
      message: "Bill deleted successfully",
      bills: expense.bills,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findOne({ _id: req.params.id, employeeId: req.user.id });
    if (!expense) return res.status(404).json({ message: "Expense not found." });
    if (isMonthLocked(expense.billingMonth)) {
      return res.status(403).json({ message: "That month is closed. Expenses cannot be deleted." });
    }
    if (!['SUBMITTED', 'REJECTED'].includes(expense.status)) {
      return res.status(403).json({ message: "Only SUBMITTED or REJECTED expenses can be deleted." });
    }

    // ✨ Delete all bill files from disk (safe)
    if (expense.bills && expense.bills.length > 0) {
      expense.bills.forEach((bill) => safeUnlink(bill.filePath));
    }

    await Expense.findByIdAndDelete(req.params.id);
    res.json({ message: "Expense deleted successfully." });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const approveRejectExpense = async (req, res) => {
  try {
    const { status, rejectionReason, reimbursementNote } = req.body;

    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found." });

    const validTransitions = { SUBMITTED: ['APPROVED', 'REJECTED'], APPROVED: ['REIMBURSED'] };
    if (!validTransitions[expense.status]?.includes(status)) {
      return res.status(400).json({ message: `Cannot transition from ${expense.status} to ${status}.` });
    }

    // Only HR and ADMIN can mark as REIMBURSED — MANAGER cannot
    if (status === 'REIMBURSED' && !['HR', 'ADMIN'].includes(req.user.role)) {
      return res.status(403).json({ message: "Only HR or Admin can mark an expense as reimbursed." });
    }

    const updateData = {
      status,
      approvedBy: req.user.id,
      approvedDate: new Date(),
    };

    if (status === "REJECTED") {
      if (!rejectionReason || !rejectionReason.trim()) {
        return res.status(400).json({ message: "Rejection reason is required." });
      }
      updateData.rejectionReason = rejectionReason.trim();
    }
    if (status === "REIMBURSED") {
      updateData.reimbursementDate = new Date();
      if (reimbursementNote && reimbursementNote.trim()) {
        updateData.reimbursementNote = reimbursementNote.trim();
      }
    }

    const timelineEntry = {
      status,
      actor: req.user.id,
      actorName: req.user.firstName ? `${req.user.firstName} ${req.user.lastName}` : req.user.email,
      timestamp: new Date(),
    };
    if (status === 'REJECTED') timelineEntry.note = rejectionReason.trim();
    if (status === 'REIMBURSED' && reimbursementNote?.trim()) timelineEntry.note = reimbursementNote.trim();

    const updated = await Expense.findByIdAndUpdate(
      req.params.id,
      { ...updateData, $push: { timeline: timelineEntry } },
      { new: true }
    ).populate('approvedBy', 'firstName lastName');

    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Serve a bill file securely — prevents SSRF by never exposing raw file paths to the client
const serveBill = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);
    if (!expense) return res.status(404).json({ message: "Expense not found." });

    // Employees can only view their own bills; managers/HR/admin can view all
    const isOwner = expense.employeeId.toString() === req.user.id;
    const isManagerOrHR = ["MANAGER", "HR", "ADMIN"].includes(req.user.role);
    if (!isOwner && !isManagerOrHR) {
      return res.status(403).json({ message: "Access denied." });
    }

    const billIndex = parseInt(req.params.billIndex);
    if (isNaN(billIndex) || billIndex < 0 || billIndex >= expense.bills.length) {
      return res.status(400).json({ message: "Invalid bill index." });
    }

    const bill = expense.bills[billIndex];
    const resolved = path.resolve(bill.filePath);

    if (!resolved.startsWith(RECEIPTS_DIR + path.sep)) {
      return res.status(403).json({ message: "Access denied." });
    }

    if (!fs.existsSync(resolved)) {
      return res.status(404).json({ message: "File not found." });
    }

    res.sendFile(resolved);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  approveRejectExpense,
  uploadBills,
  deleteBill,
  serveBill,
};
