const Holiday = require("../models/Holiday");
const User = require("../models/User");
const { sendHolidayNotification } = require("../utils/emailService");

const getHolidays = async (req, res) => {
  try {
    const {
      year,
      startDate: queryStartDate,
      endDate: queryEndDate,
    } = req.query;

    let startDate, endDate;

    // If date range is provided, use it; otherwise use year-based range
    if (queryStartDate && queryEndDate) {
      startDate = new Date(queryStartDate);
      endDate = new Date(queryEndDate);
      endDate.setHours(23, 59, 59, 999); // Include entire end day
      console.log("🏖️ Holidays query by date range:", {
        queryStartDate,
        queryEndDate,
        mongoQuery: { $gte: startDate, $lte: endDate },
      });
    } else {
      const yearValue = year || new Date().getFullYear();
      startDate = new Date(yearValue, 0, 1);
      endDate = new Date(yearValue, 11, 31);
      console.log("🏖️ Holidays query by year:", yearValue);
    }

    const holidays = await Holiday.find({
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 });

    console.log("🏖️ Holidays found:", holidays.length, holidays);
    res.json(holidays);
  } catch (error) {
    console.error("❌ Holiday error:", error.message);
    res.status(500).json({ message: error.message });
  }
};

const createHoliday = async (req, res) => {
  try {
    const holiday = new Holiday({
      ...req.body,
      createdBy: req.user.id,
    });
    await holiday.save();
    res.status(201).json(holiday);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const updateHoliday = async (req, res) => {
  try {
    const holiday = await Holiday.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    res.json(holiday);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const deleteHoliday = async (req, res) => {
  try {
    await Holiday.findByIdAndDelete(req.params.id);
    res.json({ message: "Holiday deleted" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

const testHolidayNotification = async (req, res) => {
  try {
    const { holidayId } = req.params;
    const holiday = await Holiday.findById(holidayId);

    if (!holiday) {
      return res.status(404).json({ message: "Holiday not found" });
    }

    const employees = await User.find({
      role: { $in: ["EMPLOYEE", "MANAGER", "HR"] },
    });
    await sendHolidayNotification(employees, holiday);

    res.json({
      message: `Test notification sent to ${employees.length} employees`,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  testHolidayNotification,
};
