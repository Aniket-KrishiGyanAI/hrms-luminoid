const Expense = require("../models/Expense");
const {
  uploadExpenseReceipt,
  deleteExpenseReceipt,
} = require("../utils/s3Utils");
const logger = require("../utils/logger");

// Returns lock status and warning info for current date
const getMonthLockInfo = () => {
  const now = new Date();
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const today = now.getDate();
  const daysLeft = lastDay - today;
  const locked = today > lastDay;

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
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (billingMonth < currentMonth) return true;
  if (billingMonth === currentMonth) {
    const lastDay = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
    ).getDate();
    return now.getDate() > lastDay;
  }
  return false;
};

// ✨ NEW: Check for duplicate expenses
// Detects similar expenses based on title, amount, and date
const checkDuplicateExpense = async (
  employeeId,
  title,
  amount,
  expenseDate,
  excludeId = null,
) => {
  try {
    // Normalize title for comparison (lowercase, trim, remove extra spaces)
    const normalizedTitle = title.toLowerCase().trim().replace(/\s+/g, " ");

    // Parse the expense date
    const targetDate = new Date(expenseDate);
    targetDate.setHours(0, 0, 0, 0);

    // Create date range: ±3 days from the expense date
    const dateRangeStart = new Date(targetDate);
    dateRangeStart.setDate(dateRangeStart.getDate() - 3);
    const dateRangeEnd = new Date(targetDate);
    dateRangeEnd.setDate(dateRangeEnd.getDate() + 3);

    // Amount tolerance: ±5% or ±₹50 (whichever is larger)
    const amountTolerance = Math.max(amount * 0.05, 50);
    const minAmount = amount - amountTolerance;
    const maxAmount = amount + amountTolerance;

    // Build query
    const query = {
      employeeId,
      amount: { $gte: minAmount, $lte: maxAmount },
      expenseDate: { $gte: dateRangeStart, $lte: dateRangeEnd },
      status: { $in: ["SUBMITTED", "APPROVED", "REIMBURSED"] }, // Exclude rejected expenses
      isDeleted: { $ne: true }, // Exclude deleted expenses
    };

    // Exclude current expense if updating
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    // Find potential duplicates
    const potentialDuplicates = await Expense.find(query).select(
      "title amount expenseDate status billingMonth",
    );

    // Check for title similarity
    const duplicates = potentialDuplicates.filter((exp) => {
      const expTitle = exp.title.toLowerCase().trim().replace(/\s+/g, " ");

      // Exact match
      if (expTitle === normalizedTitle) return true;

      // Calculate similarity score (simple word overlap)
      const words1 = normalizedTitle.split(" ");
      const words2 = expTitle.split(" ");
      const commonWords = words1.filter((word) => words2.includes(word));
      const similarity =
        commonWords.length / Math.max(words1.length, words2.length);

      // Consider duplicate if 70% or more words match
      return similarity >= 0.7;
    });

    return duplicates;
  } catch (error) {
    console.error("Error checking duplicates:", error);
    return [];
  }
};

const getExpenses = async (req, res) => {
  try {
    const {
      billingMonth,
      page = 1,
      limit = 20,
      includeDeleted = "false",
    } = req.query;
    const query =
      req.user.role === "EMPLOYEE" ? { employeeId: req.user.id } : {};
    if (billingMonth) query.billingMonth = billingMonth;

    // By default, exclude deleted expenses
    if (includeDeleted !== "true") {
      query.isDeleted = { $ne: true };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Expense.countDocuments(query);

    const expenses = await Expense.find(query)
      .populate("employeeId", "firstName lastName department")
      .populate("approvedBy", "firstName lastName")
      .populate("deletedBy", "firstName lastName")
      .populate("timeline.actor", "firstName lastName")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // ✨ For managers/HR/admin, check each expense for potential duplicates
    if (["MANAGER", "HR", "ADMIN"].includes(req.user.role)) {
      for (let expense of expenses) {
        // Skip duplicate check if employeeId is not populated
        if (!expense.employeeId) continue;

        const duplicates = await checkDuplicateExpense(
          expense.employeeId._id,
          expense.title,
          expense.amount,
          expense.expenseDate,
          expense._id,
        );

        // Add duplicate flag and count to expense object
        expense._doc.hasPotentialDuplicates = duplicates.length > 0;
        expense._doc.duplicateCount = duplicates.length;
        if (duplicates.length > 0) {
          expense._doc.potentialDuplicates = duplicates.map((dup) => ({
            id: dup._id,
            title: dup.title,
            amount: dup.amount,
            date: dup.expenseDate,
            status: dup.status,
            billingMonth: dup.billingMonth,
          }));
        }
      }
    }

    const currentBillingMonth =
      billingMonth ||
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    const lockInfo = {
      ...getMonthLockInfo(),
      isLocked: isMonthLocked(currentBillingMonth),
    };

    res.json({
      expenses,
      lockInfo,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createExpense = async (req, res) => {
  try {
    const billingMonth =
      req.body.billingMonth ||
      `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(billingMonth)) {
      return res
        .status(400)
        .json({ message: "Invalid billingMonth format. Use YYYY-MM." });
    }
    if (isMonthLocked(billingMonth)) {
      return res
        .status(403)
        .json({
          message: "That month is closed. No new expenses can be submitted.",
        });
    }

    const amount = parseFloat(req.body.amount);
    if (!amount || amount <= 0) {
      return res
        .status(400)
        .json({ message: "Amount must be greater than 0." });
    }

    const {
      title,
      category,
      expenseDate,
      description,
      currency,
      ignoreDuplicate,
    } = req.body;

    // ✨ Check for duplicate expenses (unless user explicitly ignored the warning)
    if (ignoreDuplicate !== "true") {
      const duplicates = await checkDuplicateExpense(
        req.user.id,
        title,
        amount,
        expenseDate,
      );
      if (duplicates.length > 0) {
        // Format duplicate information
        const duplicateInfo = duplicates.map((dup) => ({
          id: dup._id,
          title: dup.title,
          amount: dup.amount,
          date: new Date(dup.expenseDate).toLocaleDateString("en-IN"),
          status: dup.status,
          billingMonth: dup.billingMonth,
        }));

        return res.status(409).json({
          message:
            "Possible duplicate expense detected. A similar expense already exists.",
          isDuplicate: true,
          duplicates: duplicateInfo,
        });
      }
    }

    const expenseData = {
      title,
      category,
      amount,
      expenseDate,
      description,
      currency,
      employeeId: req.user.id,
      billingMonth,
      status: "SUBMITTED",
      bills: [],
    };

    // ✨ Handle multiple bill uploads to S3
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map((file) =>
        uploadExpenseReceipt(file, req.user.id),
      );
      const uploadResults = await Promise.all(uploadPromises);

      expenseData.bills = uploadResults.map((result, index) => ({
        fileName: req.files[index].originalname,
        filePath: result.url,
        fileKey: result.key,
        fileSize: req.files[index].size,
        uploadedAt: new Date(),
      }));

      // Keep first file as receipt for backward compatibility
      expenseData.receipt = {
        fileName: req.files[0].originalname,
        filePath: uploadResults[0].url,
        fileKey: uploadResults[0].key,
      };
    }

    const expense = new Expense(expenseData);
    // Timeline: submitted by employee
    expense.timeline = [
      {
        status: "SUBMITTED",
        actor: req.user.id,
        actorName: req.user.firstName
          ? `${req.user.firstName} ${req.user.lastName}`
          : req.user.email,
        note: "Expense submitted",
        timestamp: new Date(),
      },
    ];
    await expense.save();
    res.status(201).json({
      message: "Expense created successfully",
      expense,
    });
  } catch (error) {
    // Clean up uploaded files on error (delete from S3)
    if (req.files && req.files.length > 0) {
      const deletePromises = req.files.map((file) => {
        // Files are already uploaded to S3, we need to delete them
        // But we don't have the S3 keys here, so we'll skip cleanup
        // In production, consider implementing a cleanup mechanism
      });
    }
    res.status(400).json({ message: error.message });
  }
};

const updateExpense = async (req, res) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.id,
      employeeId: req.user.id,
    });
    if (!expense)
      return res.status(404).json({ message: "Expense not found." });
    if (isMonthLocked(expense.billingMonth)) {
      return res
        .status(403)
        .json({ message: "That month is closed. Expenses cannot be edited." });
    }
    if (expense.status !== "REJECTED") {
      return res
        .status(403)
        .json({
          message: "Only REJECTED expenses can be edited and resubmitted.",
        });
    }

    const amount = parseFloat(req.body.amount);
    if (!amount || amount <= 0) {
      return res
        .status(400)
        .json({ message: "Amount must be greater than 0." });
    }

    const {
      title,
      category,
      expenseDate,
      description,
      currency,
      ignoreDuplicate,
    } = req.body;

    // ✨ Check for duplicate expenses (excluding current expense, unless user explicitly ignored the warning)
    if (ignoreDuplicate !== "true") {
      const duplicates = await checkDuplicateExpense(
        req.user.id,
        title,
        amount,
        expenseDate,
        req.params.id,
      );
      if (duplicates.length > 0) {
        // Format duplicate information
        const duplicateInfo = duplicates.map((dup) => ({
          id: dup._id,
          title: dup.title,
          amount: dup.amount,
          date: new Date(dup.expenseDate).toLocaleDateString("en-IN"),
          status: dup.status,
          billingMonth: dup.billingMonth,
        }));

        return res.status(409).json({
          message:
            "Possible duplicate expense detected. A similar expense already exists.",
          isDuplicate: true,
          duplicates: duplicateInfo,
        });
      }
    }

    const updateData = {
      title,
      category,
      amount,
      expenseDate,
      description,
      currency,
    };

    // ✨ Handle new bill uploads to S3 (append to existing bills)
    if (req.files && req.files.length > 0) {
      const uploadPromises = req.files.map((file) =>
        uploadExpenseReceipt(file, req.user.id),
      );
      const uploadResults = await Promise.all(uploadPromises);

      const newBills = uploadResults.map((result, index) => ({
        fileName: req.files[index].originalname,
        filePath: result.url,
        fileKey: result.key,
        fileSize: req.files[index].size,
        uploadedAt: new Date(),
      }));

      updateData.bills = [...(expense.bills || []), ...newBills];

      // Update receipt field with latest file for backward compatibility
      updateData.receipt = {
        fileName: req.files[0].originalname,
        filePath: uploadResults[0].url,
        fileKey: uploadResults[0].key,
      };
    }

    const updated = await Expense.findByIdAndUpdate(
      req.params.id,
      {
        ...updateData,
        status: "SUBMITTED",
        $push: {
          timeline: {
            status: "SUBMITTED",
            actor: req.user.id,
            actorName: req.user.firstName
              ? `${req.user.firstName} ${req.user.lastName}`
              : req.user.email,
            note: "Expense edited and resubmitted",
            timestamp: new Date(),
          },
        },
      },
      { new: true },
    );
    res.json({
      message: "Expense updated and resubmitted successfully",
      expense: updated,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ✨ NEW: Upload additional bills to existing expense
const uploadBills = async (req, res) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.id,
      employeeId: req.user.id,
    });
    if (!expense)
      return res.status(404).json({ message: "Expense not found." });
    if (isMonthLocked(expense.billingMonth)) {
      return res
        .status(403)
        .json({ message: "That month is closed. Cannot upload bills." });
    }

    if (!["REJECTED"].includes(expense.status)) {
      return res
        .status(403)
        .json({ message: "Bills can only be added to REJECTED expenses." });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "No files uploaded." });
    }

    const uploadPromises = req.files.map((file) =>
      uploadExpenseReceipt(file, req.user.id),
    );
    const uploadResults = await Promise.all(uploadPromises);

    const newBills = uploadResults.map((result, index) => ({
      fileName: req.files[index].originalname,
      filePath: result.url,
      fileKey: result.key,
      fileSize: req.files[index].size,
      uploadedAt: new Date(),
    }));

    expense.bills = [...(expense.bills || []), ...newBills];
    await expense.save();

    res.json({
      message: `${req.files.length} bill(s) uploaded successfully`,
      bills: expense.bills,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// ✨ NEW: Delete a specific bill from expense
const deleteBill = async (req, res) => {
  try {
    const expense = await Expense.findOne({
      _id: req.params.id,
      employeeId: req.user.id,
    });
    if (!expense)
      return res.status(404).json({ message: "Expense not found." });
    if (isMonthLocked(expense.billingMonth)) {
      return res
        .status(403)
        .json({ message: "That month is closed. Cannot delete bills." });
    }

    if (!["REJECTED"].includes(expense.status)) {
      return res
        .status(403)
        .json({ message: "Bills can only be deleted from REJECTED expenses." });
    }

    const billIndex = parseInt(req.params.billIndex);
    if (
      isNaN(billIndex) ||
      billIndex < 0 ||
      billIndex >= expense.bills.length
    ) {
      return res.status(400).json({ message: "Invalid bill index." });
    }

    const bill = expense.bills[billIndex];

    // Delete file from S3
    await deleteExpenseReceipt(bill.filePath);

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
    const expense = await Expense.findById(req.params.id);
    if (!expense)
      return res.status(404).json({ message: "Expense not found." });

    // Check if already deleted
    if (expense.isDeleted) {
      return res.status(400).json({ message: "Expense is already deleted." });
    }

    // Employees can only delete their own expenses
    if (req.user.role === "EMPLOYEE") {
      if (expense.employeeId.toString() !== req.user.id) {
        return res
          .status(403)
          .json({ message: "You can only delete your own expenses." });
      }
      if (isMonthLocked(expense.billingMonth)) {
        return res
          .status(403)
          .json({
            message: "That month is closed. Expenses cannot be deleted.",
          });
      }
      if (!["SUBMITTED", "REJECTED"].includes(expense.status)) {
        return res
          .status(403)
          .json({
            message: "Only SUBMITTED or REJECTED expenses can be deleted.",
          });
      }
    }

    // Admin/HR can delete any expense with a reason
    if (["ADMIN", "HR"].includes(req.user.role)) {
      const { deletionReason } = req.body;

      // Soft delete for Admin/HR
      expense.isDeleted = true;
      expense.deletedAt = new Date();
      expense.deletedBy = req.user.id;
      expense.deletedByName = req.user.firstName
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user.email;
      expense.deletionReason = deletionReason || "Deleted by admin";

      // Add to timeline
      expense.timeline.push({
        status: "DELETED",
        actor: req.user.id,
        actorName: expense.deletedByName,
        note: expense.deletionReason,
        timestamp: new Date(),
      });

      await expense.save();

      return res.json({
        message: "Expense deleted successfully (soft delete)",
        expense,
      });
    }

    // Employee hard delete (only for their own SUBMITTED/REJECTED expenses)
    // ✨ Delete all bill files from S3
    if (expense.bills && expense.bills.length > 0) {
      const deletePromises = expense.bills.map((bill) =>
        deleteExpenseReceipt(bill.filePath),
      );
      await Promise.all(deletePromises);
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
    if (!expense)
      return res.status(404).json({ message: "Expense not found." });

    const validTransitions = {
      SUBMITTED: ["APPROVED", "REJECTED"],
      APPROVED: ["REIMBURSED"],
    };
    if (!validTransitions[expense.status]?.includes(status)) {
      return res
        .status(400)
        .json({
          message: `Cannot transition from ${expense.status} to ${status}.`,
        });
    }

    // Only HR and ADMIN can mark as REIMBURSED — MANAGER cannot
    if (status === "REIMBURSED" && !["HR", "ADMIN"].includes(req.user.role)) {
      return res
        .status(403)
        .json({
          message: "Only HR or Admin can mark an expense as reimbursed.",
        });
    }

    const updateData = {
      status,
      approvedBy: req.user.id,
      approvedDate: new Date(),
    };

    if (status === "REJECTED") {
      if (!rejectionReason || !rejectionReason.trim()) {
        return res
          .status(400)
          .json({ message: "Rejection reason is required." });
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
      actorName: req.user.firstName
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user.email,
      timestamp: new Date(),
    };
    if (status === "REJECTED") timelineEntry.note = rejectionReason.trim();
    if (status === "REIMBURSED" && reimbursementNote?.trim())
      timelineEntry.note = reimbursementNote.trim();

    const updated = await Expense.findByIdAndUpdate(
      req.params.id,
      { ...updateData, $push: { timeline: timelineEntry } },
      { new: true },
    ).populate("approvedBy", "firstName lastName");

    res.json(updated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Serve a bill file securely from S3
const serveBill = async (req, res) => {
  try {
    console.log("=== serveBill START ===");
    console.log("Expense ID:", req.params.id);
    console.log("Bill Index:", req.params.billIndex);
    console.log("User:", req.user?.email);

    const expense = await Expense.findById(req.params.id);
    if (!expense) {
      console.error("serveBill: Expense not found", req.params.id);
      return res.status(404).send("<h1>Expense not found</h1>");
    }

    const isOwner = expense.employeeId.toString() === req.user.id;
    const isManagerOrHR = ["MANAGER", "HR", "ADMIN"].includes(req.user.role);
    if (!isOwner && !isManagerOrHR) {
      console.error("serveBill: Access denied for user", req.user.id);
      return res.status(403).send("<h1>Access Denied</h1>");
    }

    const billIndex = parseInt(req.params.billIndex);
    if (
      isNaN(billIndex) ||
      billIndex < 0 ||
      billIndex >= expense.bills.length
    ) {
      console.error(
        "serveBill: Invalid bill index",
        billIndex,
        "Total bills:",
        expense.bills.length,
      );
      return res
        .status(400)
        .send(
          `<h1>Invalid bill index. Total bills: ${expense.bills.length}</h1>`,
        );
    }

    const bill = expense.bills[billIndex];
    console.log("Bill details:", {
      fileName: bill.fileName,
      hasFileKey: !!bill.fileKey,
      hasFilePath: !!bill.filePath,
      fileKey: bill.fileKey,
      filePath: bill.filePath?.substring(0, 100),
    });

    // Try to stream file from S3
    if (bill.fileKey) {
      const s3 = require("../config/s3");
      try {
        const params = {
          Bucket: process.env.AWS_S3_BUCKET,
          Key: bill.fileKey,
        };

        console.log("Fetching from S3:", params);

        // Get file from S3
        const s3Object = await s3.getObject(params).promise();

        console.log("S3 Object retrieved:", {
          ContentType: s3Object.ContentType,
          ContentLength: s3Object.ContentLength,
        });

        // Determine content type
        const contentType =
          s3Object.ContentType ||
          (bill.fileName.match(/\.pdf$/i)
            ? "application/pdf"
            : bill.fileName.match(/\.(jpg|jpeg)$/i)
              ? "image/jpeg"
              : bill.fileName.match(/\.png$/i)
                ? "image/png"
                : "application/octet-stream");

        // Set headers
        res.setHeader("Content-Type", contentType);
        res.setHeader(
          "Content-Disposition",
          `inline; filename="${bill.fileName}"`,
        );
        res.setHeader("Content-Length", s3Object.ContentLength);
        res.setHeader("Cache-Control", "public, max-age=31536000");

        console.log("Streaming file with Content-Type:", contentType);
        console.log("=== serveBill SUCCESS ===");
        return res.send(s3Object.Body);
      } catch (s3Error) {
        console.error("S3 error:", s3Error);
        // Fallback to redirect if streaming fails
        if (bill.filePath) {
          console.log("Falling back to redirect:", bill.filePath);
          return res.redirect(bill.filePath);
        }
        return res
          .status(500)
          .send(`<h1>S3 Error</h1><pre>${s3Error.message}</pre>`);
      }
    } else if (bill.filePath) {
      console.log("Redirecting to filePath:", bill.filePath);
      return res.redirect(bill.filePath);
    } else {
      console.error("No fileKey or filePath found");
      return res
        .status(404)
        .send("<h1>Bill file not found - no fileKey or filePath</h1>");
    }
  } catch (error) {
    console.error("serveBill error:", error);
    res.status(500).send(`<h1>Server Error</h1><pre>${error.message}</pre>`);
  }
};

// ✨ NEW: Get deleted expenses (Admin/HR only, or employee's own)
const getDeletedExpenses = async (req, res) => {
  try {
    const { billingMonth, page = 1, limit = 20 } = req.query;
    const query = { isDeleted: true };

    // Employees can only see their own deleted expenses
    if (req.user.role === "EMPLOYEE") {
      query.employeeId = req.user.id;
    }

    if (billingMonth) query.billingMonth = billingMonth;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Expense.countDocuments(query);

    const expenses = await Expense.find(query)
      .populate("employeeId", "firstName lastName department")
      .populate("approvedBy", "firstName lastName")
      .populate("deletedBy", "firstName lastName")
      .populate("timeline.actor", "firstName lastName")
      .sort({ deletedAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json({
      expenses,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ✨ NEW: Restore deleted expense (Admin/HR only)
const restoreExpense = async (req, res) => {
  try {
    // Only Admin and HR can restore expenses
    if (!["ADMIN", "HR"].includes(req.user.role)) {
      return res
        .status(403)
        .json({
          message: "Access denied. Only Admin and HR can restore expenses.",
        });
    }

    const expense = await Expense.findById(req.params.id);
    if (!expense)
      return res.status(404).json({ message: "Expense not found." });

    if (!expense.isDeleted) {
      return res.status(400).json({ message: "Expense is not deleted." });
    }

    // Restore the expense
    expense.isDeleted = false;
    expense.deletedAt = null;
    expense.deletedBy = null;
    expense.deletedByName = null;
    expense.deletionReason = null;

    // Add to timeline
    expense.timeline.push({
      status: "RESTORED",
      actor: req.user.id,
      actorName: req.user.firstName
        ? `${req.user.firstName} ${req.user.lastName}`
        : req.user.email,
      note: "Expense restored from deleted",
      timestamp: new Date(),
    });

    await expense.save();

    res.json({
      message: "Expense restored successfully",
      expense,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
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
};
