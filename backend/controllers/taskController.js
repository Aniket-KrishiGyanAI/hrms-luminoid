const Task = require("../models/Task");
const { createNotification } = require("./notificationController");
const logger = require("../utils/logger");

const addActivity = async (task, type, user, message, metadata = {}) => {
  task.activityLog.push({ type, user, message, metadata });
};

exports.createTask = async (req, res) => {
  try {
    logger.info("createTask", { userId: req.user?.id });

    if (!req.body.assignedTo || req.body.assignedTo.length === 0) {
      return res
        .status(400)
        .json({ message: "Please assign at least one employee to the task" });
    }

    const task = await Task.create({
      ...req.body,
      assignedBy: req.user.id,
    });

    await addActivity(
      task,
      "TASK_CREATED",
      req.user.id,
      `Task created by ${req.user.firstName} ${req.user.lastName}`,
    );
    await task.save();

    // Notify assigned users
    for (const userId of req.body.assignedTo) {
      await createNotification(
        userId,
        "TASK_ASSIGNED",
        task._id,
        `New task assigned: ${task.title}`,
        req.user.id,
      );
    }

    res.status(201).json(task);
  } catch (error) {
    logger.error("createTask error", {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    });

    res.status(400).json({ message: error.message });
  }
};

exports.getTasks = async (req, res) => {
  try {
    logger.info("getTasks", { userId: req.user?.id });
    const { status, taskType, department, startDate, endDate } = req.query;
    let filter = {};

    if (req.user.role === "EMPLOYEE") {
      filter.assignedTo = req.user.id;
    } else if (req.user.role === "MANAGER") {
      const teamMembers = await require("../models/User").find({
        managerId: req.user.id,
      });
      filter.assignedTo = {
        $in: [...teamMembers.map((m) => m._id), req.user.id],
      };
    }
    // HR and ADMIN see all tasks (no filter)

    if (status) filter.status = status;
    if (taskType) filter.taskType = taskType;
    if (department) filter.department = department;
    if (startDate || endDate) {
      filter.scheduledDate = {};
      if (startDate) filter.scheduledDate.$gte = new Date(startDate);
      if (endDate) filter.scheduledDate.$lte = new Date(endDate);
    }

    const tasks = await Task.find(filter)
      .populate("assignedTo", "firstName lastName email")
      .populate("assignedBy", "firstName lastName")
      .populate("comments.user", "firstName lastName")
      .populate("dailyUpdates.updatedBy", "firstName lastName")
      .sort("-scheduledDate");

    res.json(tasks);
  } catch (error) {
    logger.error("getTasks error", {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    });

    res.status(500).json({ message: error.message });
  }
};

exports.getTask = async (req, res) => {
  try {
    logger.info("getTask", { userId: req.user?.id });
    const task = await Task.findById(req.params.id)
      .populate("assignedTo", "firstName lastName email phone")
      .populate("assignedBy", "firstName lastName")
      .populate("comments.user", "firstName lastName")
      .populate("dailyUpdates.updatedBy", "firstName lastName")
      .populate("activityLog.user", "firstName lastName");

    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json(task);
  } catch (error) {
    logger.error("getTask error", {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    });

    res.status(500).json({ message: error.message });
  }
};

exports.updateTask = async (req, res) => {
  try {
    logger.info("updateTask", { userId: req.user?.id });
    const oldTask = await Task.findById(req.params.id);
    if (!oldTask) return res.status(404).json({ message: "Task not found" });

    // Check permissions: only task creator (if ASSIGNED status) or ADMIN/HR can update
    const isCreator = oldTask.assignedBy.toString() === req.user.id;
    const isPrivileged = ["ADMIN", "HR"].includes(req.user.role);
    const isAssignedStatus = oldTask.status === "ASSIGNED";

    if (!isPrivileged && !(isCreator && isAssignedStatus)) {
      return res
        .status(403)
        .json({ message: "Access denied. Insufficient permissions." });
    }

    const task = await Task.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    await addActivity(
      task,
      "TASK_UPDATED",
      req.user.id,
      `Task updated by ${req.user.firstName} ${req.user.lastName}`,
    );
    await task.save();

    // Notify assigned users
    for (const userId of task.assignedTo) {
      await createNotification(
        userId,
        "TASK_UPDATED",
        task._id,
        `Task updated: ${task.title}`,
        req.user.id,
      );
    }

    res.json(task);
  } catch (error) {
    logger.error("updateTask error", {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    });

    res.status(400).json({ message: error.message });
  }
};

exports.deleteTask = async (req, res) => {
  try {
    logger.info("deleteTask", { userId: req.user?.id });
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });
    res.json({ message: "Task deleted" });
  } catch (error) {
    logger.error("deleteTask error", {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    });

    res.status(500).json({ message: error.message });
  }
};

exports.checkIn = async (req, res) => {
  try {
    logger.info("checkIn", { userId: req.user?.id });
    const { lat, lng } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) return res.status(404).json({ message: "Task not found" });
    if (!task.assignedTo.includes(req.user.id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    task.checkIn = {
      time: new Date(),
      location: { lat, lng },
    };
    task.status = "IN_PROGRESS";
    await task.save();

    res.json(task);
  } catch (error) {
    logger.error("checkIn error", {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    });

    res.status(400).json({ message: error.message });
  }
};

exports.checkOut = async (req, res) => {
  try {
    logger.info("checkOut", { userId: req.user?.id });
    const {
      lat,
      lng,
      outcome,
      notes,
      orderValue,
      orderDetails,
      nextFollowUpDate,
      actualHours,
    } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) return res.status(404).json({ message: "Task not found" });
    if (!task.assignedTo.includes(req.user.id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    task.checkOut = {
      time: new Date(),
      location: { lat, lng },
    };
    task.status = "COMPLETED";
    task.outcome = outcome;
    task.notes = notes;
    task.orderValue = orderValue;
    task.orderDetails = orderDetails;
    task.nextFollowUpDate = nextFollowUpDate;
    task.actualHours = actualHours;

    await task.save();

    res.json(task);
  } catch (error) {
    logger.error("checkOut error", {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    });

    res.status(400).json({ message: error.message });
  }
};

exports.updateStatus = async (req, res) => {
  try {
    logger.info("updateStatus", { userId: req.user?.id });
    const { status } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) return res.status(404).json({ message: "Task not found" });
    if (!task.assignedTo.includes(req.user.id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    task.status = status;
    await task.save();

    res.json(task);
  } catch (error) {
    logger.error("updateStatus error", {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    });

    res.status(400).json({ message: error.message });
  }
};

exports.addComment = async (req, res) => {
  try {
    logger.info("addComment", { userId: req.user?.id });
    const { text } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) return res.status(404).json({ message: "Task not found" });

    // Extract mentions (@username)
    const mentionRegex = /@(\w+)/g;
    const mentions = [];
    let match;
    while ((match = mentionRegex.exec(text)) !== null) {
      mentions.push(match[1]);
    }

    // Find mentioned users
    const User = require("../models/User");
    const mentionedUsers = await User.find({
      $or: [{ firstName: { $in: mentions } }, { lastName: { $in: mentions } }],
    });

    task.comments.push({
      user: req.user.id,
      text,
      mentions: mentionedUsers.map((u) => u._id),
    });

    await addActivity(
      task,
      "COMMENT_ADDED",
      req.user.id,
      `${req.user.firstName} ${req.user.lastName} added a comment`,
    );
    await task.save();

    // Notify mentioned users
    for (const mentionedUser of mentionedUsers) {
      await createNotification(
        mentionedUser._id,
        "MENTION",
        task._id,
        `${req.user.firstName} ${req.user.lastName} mentioned you in a comment`,
        req.user.id,
      );
    }

    // Notify task creator and assigned users (except commenter)
    const notifyUsers = [...task.assignedTo, task.assignedBy].filter(
      (id) => id.toString() !== req.user.id,
    );
    for (const userId of notifyUsers) {
      await createNotification(
        userId,
        "COMMENT_ADDED",
        task._id,
        `${req.user.firstName} ${req.user.lastName} commented on: ${task.title}`,
        req.user.id,
      );
    }

    const populatedTask = await Task.findById(req.params.id)
      .populate("assignedTo", "firstName lastName email")
      .populate("assignedBy", "firstName lastName")
      .populate("comments.user", "firstName lastName")
      .populate("dailyUpdates.updatedBy", "firstName lastName")
      .populate("activityLog.user", "firstName lastName");

    res.json(populatedTask);
  } catch (error) {
    logger.error("addComment error", {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    });

    res.status(400).json({ message: error.message });
  }
};

exports.addAttachment = async (req, res) => {
  try {
    logger.info("addAttachment", { userId: req.user?.id });
    const { name, url } = req.body;
    const task = await Task.findById(req.params.id);

    if (!task) return res.status(404).json({ message: "Task not found" });

    task.attachments.push({ name, url });
    await task.save();

    res.json(task);
  } catch (error) {
    logger.error("addAttachment error", {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    });

    res.status(400).json({ message: error.message });
  }
};

exports.addExpense = async (req, res) => {
  try {
    logger.info("addExpense", { userId: req.user?.id });
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ message: "Task not found" });

    task.expenses.push(req.body);
    await task.save();

    res.json(task);
  } catch (error) {
    logger.error("addExpense error", {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    });

    res.status(400).json({ message: error.message });
  }
};

exports.addDailyUpdate = async (req, res) => {
  try {
    logger.info("addDailyUpdate", { userId: req.user?.id });
    const task = await Task.findById(req.params.id);

    if (!task) return res.status(404).json({ message: "Task not found" });
    if (!task.assignedTo.includes(req.user.id)) {
      return res.status(403).json({ message: "Not authorized" });
    }

    task.dailyUpdates.push({
      ...req.body,
      updatedBy: req.user.id,
    });
    task.progressPercent = req.body.progressPercent;

    if (req.body.progressPercent === 100) {
      task.status = "COMPLETED";
    } else if (req.body.progressPercent > 0) {
      task.status = "IN_PROGRESS";
    }

    await addActivity(
      task,
      "PROGRESS_UPDATED",
      req.user.id,
      `Progress updated to ${req.body.progressPercent}% by ${req.user.firstName} ${req.user.lastName}`,
    );
    await task.save();

    await createNotification(
      task.assignedBy,
      "PROGRESS_UPDATED",
      task._id,
      `${req.user.firstName} ${req.user.lastName} updated progress to ${req.body.progressPercent}%`,
      req.user.id,
    );

    if (req.body.issues) {
      await createNotification(
        task.assignedBy,
        "TASK_BLOCKED",
        task._id,
        `⚠️ ${req.user.firstName} ${req.user.lastName} reported an issue: ${req.body.issues.substring(0, 50)}...`,
        req.user.id,
      );
    }

    if (req.body.orderReceived && req.body.orderValue) {
      await createNotification(
        task.assignedBy,
        "ORDER_RECEIVED",
        task._id,
        `🎉 ${req.user.firstName} ${req.user.lastName} received an order worth ₹${req.body.orderValue}!`,
        req.user.id,
      );
    }

    res.json(task);
  } catch (error) {
    logger.error("addDailyUpdate error", {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    });

    res.status(400).json({ message: error.message });
  }
};

exports.duplicateTask = async (req, res) => {
  try {
    logger.info("duplicateTask", { userId: req.user?.id });
    const originalTask = await Task.findById(req.params.id);
    if (!originalTask)
      return res.status(404).json({ message: "Task not found" });

    const newTask = await Task.create({
      title: `${originalTask.title} (Copy)`,
      description: originalTask.description,
      department: originalTask.department,
      taskType: originalTask.taskType,
      category: originalTask.category,
      assignedTo: originalTask.assignedTo,
      assignedBy: req.user.id,
      workLocation: originalTask.workLocation,
      requireCheckIn: originalTask.requireCheckIn,
      client: originalTask.client,
      scheduledDate: new Date(),
      dueDate: originalTask.dueDate,
      estimatedHours: originalTask.estimatedHours,
      priority: originalTask.priority,
      tags: originalTask.tags,
      status: "ASSIGNED",
      progressPercent: 0,
    });

    await addActivity(
      newTask,
      "TASK_CREATED",
      req.user.id,
      `Task duplicated from "${originalTask.title}" by ${req.user.firstName} ${req.user.lastName}`,
    );
    await newTask.save();

    res.status(201).json(newTask);
  } catch (error) {
    logger.error("duplicateTask error", {
      error: error.message,
      stack: error.stack,
      userId: req.user?.id,
    });

    res.status(400).json({ message: error.message });
  }
};
