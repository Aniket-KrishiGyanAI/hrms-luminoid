const Journey = require("../models/Journey");
const Attendance = require("../models/Attendance");
const User = require("../models/User");
const moment = require("moment-timezone");

// Haversine distance in km
const haversine = (p1, p2) => {
  const R = 6371;
  const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
  const dLng = ((p2.lng - p1.lng) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((p1.lat * Math.PI) / 180) *
      Math.cos((p2.lat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

// Start Journey
exports.startJourney = async (req, res) => {
  try {
    const userId = req.user.id;
    const { lat, lng, accuracy } = req.body; // Get start location from request

    // Only field employees can start journey
    const user = await User.findById(userId);
    if (!user.isFieldEmployee) {
      return res
        .status(403)
        .json({ message: "Only field employees can start a journey" });
    }

    const todayStart = moment.tz("Asia/Kolkata").startOf("day").toDate();
    const todayEnd = moment.tz("Asia/Kolkata").endOf("day").toDate();

    // Check attendance check-in exists
    const attendance = await Attendance.findOne({
      userId,
      date: { $gte: todayStart, $lte: todayEnd },
    });
    if (!attendance?.checkIn) {
      return res
        .status(400)
        .json({
          message: "Please check in attendance first before starting journey",
        });
    }

    // Check no active journey today
    const existing = await Journey.findOne({
      employeeId: userId,
      date: { $gte: todayStart, $lte: todayEnd },
    });
    if (existing) {
      return res
        .status(400)
        .json({
          message:
            existing.status === "ACTIVE"
              ? "Journey already active"
              : "Journey already completed today",
        });
    }

    // Create journey with start location
    const journey = await Journey.create({
      employeeId: userId,
      date: todayStart,
      startTime: new Date(),
      status: "ACTIVE",
      startLocation:
        lat && lng ? { lat, lng, accuracy, timestamp: new Date() } : null,
      locationPoints:
        lat && lng
          ? [
              {
                lat,
                lng,
                accuracy,
                distanceFromLast: 0,
                speedKmh: 0,
                timestamp: new Date(),
              },
            ]
          : [],
    });

    res
      .status(201)
      .json({ message: "Journey started with location captured", journey });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GPS Ping — called every 60 seconds from frontend
exports.pingLocation = async (req, res) => {
  try {
    const { lat, lng, accuracy, batteryLevel } = req.body;
    const userId = req.user.id;
    const todayStart = moment.tz("Asia/Kolkata").startOf("day").toDate();
    const todayEnd = moment.tz("Asia/Kolkata").endOf("day").toDate();

    const journey = await Journey.findOne({
      employeeId: userId,
      date: { $gte: todayStart, $lte: todayEnd },
      status: "ACTIVE",
    });
    if (!journey)
      return res.status(404).json({ message: "No active journey found" });

    // Filter: bad GPS accuracy (> 100m)
    if (accuracy && accuracy > 100) {
      return res.json({
        message: "Point skipped: low GPS accuracy",
        totalDistanceKm: journey.totalDistanceKm,
      });
    }

    let distanceFromLast = 0;
    let speedKmh = 0;

    if (journey.locationPoints.length > 0) {
      const lastPoint =
        journey.locationPoints[journey.locationPoints.length - 1];
      distanceFromLast = haversine(lastPoint, { lat, lng });

      // Calculate speed (km/h)
      const timeDiffSeconds =
        (new Date() - new Date(lastPoint.timestamp)) / 1000;
      if (timeDiffSeconds > 0) {
        speedKmh = Math.round((distanceFromLast / timeDiffSeconds) * 3600);
      }

      // Filter: employee hasn't moved 50m (only after first point)
      if (distanceFromLast < 0.05) {
        // Track idle time
        journey.totalIdleMinutes = (journey.totalIdleMinutes || 0) + 1;
        // Still save the point to update lastLocation, but don't add to distance
        journey.locationPoints.push({
          lat,
          lng,
          accuracy,
          distanceFromLast: 0,
          speedKmh: 0,
          batteryLevel,
          timestamp: new Date(),
        });
        await journey.save();
        return res.json({
          message: "Point saved: no significant movement",
          totalDistanceKm: journey.totalDistanceKm,
        });
      }

      // Filter: GPS jump > 5km in one ping (spoof/error)
      if (distanceFromLast > 5) {
        return res.json({
          message: "Point skipped: GPS anomaly detected",
          totalDistanceKm: journey.totalDistanceKm,
        });
      }

      // Update max speed
      if (speedKmh > journey.maxSpeedKmh) {
        journey.maxSpeedKmh = speedKmh;
      }

      // Update moving time
      journey.movingTimeMinutes = (journey.movingTimeMinutes || 0) + 1;
    } else {
      // First GPS point - always accept it
      console.log("First GPS point received for journey:", journey._id);
    }

    // Track battery level
    if (batteryLevel !== undefined) {
      journey.batteryLevels.push({
        level: batteryLevel,
        timestamp: new Date(),
      });

      // Low battery alert (below 20% and not already sent)
      if (batteryLevel < 20 && !journey.lowBatteryAlertSent) {
        journey.lowBatteryAlertSent = true;
        // TODO: Send notification to employee
      }
    }

    journey.locationPoints.push({
      lat,
      lng,
      accuracy,
      distanceFromLast,
      speedKmh,
      batteryLevel,
      timestamp: new Date(),
    });
    journey.totalDistanceKm =
      Math.round((journey.totalDistanceKm + distanceFromLast) * 100) / 100;

    // Calculate average speed
    const totalPoints = journey.locationPoints.length;
    if (totalPoints > 1) {
      const totalSpeed = journey.locationPoints.reduce(
        (sum, p) => sum + (p.speedKmh || 0),
        0,
      );
      journey.avgSpeedKmh = Math.round(totalSpeed / totalPoints);
    }

    await journey.save();

    res.json({
      message: "Location saved",
      totalDistanceKm: journey.totalDistanceKm,
      currentSpeed: speedKmh,
      batteryLevel: batteryLevel,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Pause Journey
exports.pauseJourney = async (req, res) => {
  try {
    const userId = req.user.id;
    const { reason } = req.body;
    const todayStart = moment.tz("Asia/Kolkata").startOf("day").toDate();
    const todayEnd = moment.tz("Asia/Kolkata").endOf("day").toDate();

    const journey = await Journey.findOne({
      employeeId: userId,
      date: { $gte: todayStart, $lte: todayEnd },
      status: "ACTIVE",
    });
    if (!journey)
      return res.status(404).json({ message: "No active journey to pause" });

    journey.status = "PAUSED";
    journey.pausedAt = new Date();
    journey.pauseHistory.push({
      pausedAt: new Date(),
      reason: reason || "Manual pause",
    });
    await journey.save();

    res.json({ message: "Journey paused", journey });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Resume Journey
exports.resumeJourney = async (req, res) => {
  try {
    const userId = req.user.id;
    const todayStart = moment.tz("Asia/Kolkata").startOf("day").toDate();
    const todayEnd = moment.tz("Asia/Kolkata").endOf("day").toDate();

    const journey = await Journey.findOne({
      employeeId: userId,
      date: { $gte: todayStart, $lte: todayEnd },
      status: "PAUSED",
    });
    if (!journey)
      return res.status(404).json({ message: "No paused journey to resume" });

    const pauseDuration = Math.round(
      (new Date() - new Date(journey.pausedAt)) / 60000,
    ); // minutes
    journey.totalPausedMinutes =
      (journey.totalPausedMinutes || 0) + pauseDuration;

    // Update last pause history entry
    if (journey.pauseHistory.length > 0) {
      journey.pauseHistory[journey.pauseHistory.length - 1].resumedAt =
        new Date();
    }

    journey.status = "ACTIVE";
    journey.resumedAt = new Date();
    await journey.save();

    res.json({ message: "Journey resumed", journey });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// End Journey
exports.endJourney = async (req, res) => {
  try {
    const userId = req.user.id;
    const { lat, lng, accuracy } = req.body; // Get end location from request
    const todayStart = moment.tz("Asia/Kolkata").startOf("day").toDate();
    const todayEnd = moment.tz("Asia/Kolkata").endOf("day").toDate();

    const journey = await Journey.findOne({
      employeeId: userId,
      date: { $gte: todayStart, $lte: todayEnd },
      status: { $in: ["ACTIVE", "PAUSED"] },
    });
    if (!journey)
      return res.status(404).json({ message: "No active journey to end" });

    // If paused, add final pause duration
    if (journey.status === "PAUSED" && journey.pausedAt) {
      const pauseDuration = Math.round(
        (new Date() - new Date(journey.pausedAt)) / 60000,
      );
      journey.totalPausedMinutes =
        (journey.totalPausedMinutes || 0) + pauseDuration;
    }

    // Save end location and calculate distance
    if (lat && lng) {
      journey.endLocation = { lat, lng, accuracy, timestamp: new Date() };

      // Add end point to location points
      journey.locationPoints.push({
        lat,
        lng,
        accuracy,
        distanceFromLast: 0,
        speedKmh: 0,
        timestamp: new Date(),
      });

      // Calculate total distance from start to end
      if (
        journey.startLocation &&
        journey.startLocation.lat &&
        journey.startLocation.lng
      ) {
        const distance = haversine(journey.startLocation, { lat, lng });
        journey.totalDistanceKm = Math.round(distance * 100) / 100;
      }
    }

    journey.endTime = new Date();
    journey.status = "COMPLETED";
    await journey.save();

    res.json({
      message: "Journey ended",
      journey,
      totalDistanceKm: journey.totalDistanceKm,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get today's journey status (for employee)
exports.getTodayJourney = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("isFieldEmployee");
    if (!user?.isFieldEmployee) return res.json(null);

    const todayStart = moment.tz("Asia/Kolkata").startOf("day").toDate();
    const todayEnd = moment.tz("Asia/Kolkata").endOf("day").toDate();

    const journey = await Journey.findOne({
      employeeId: req.user.id,
      date: { $gte: todayStart, $lte: todayEnd },
    });

    // Use date range for attendance too — avoids timezone mismatch
    const attendance = await Attendance.findOne({
      userId: req.user.id,
      date: { $gte: todayStart, $lte: todayEnd },
    });

    const hasCheckedIn = !!attendance?.checkIn;
    const canStartJourney = hasCheckedIn && !journey;

    res.json({
      journey: journey || null,
      hasCheckedIn,
      canStartJourney,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Manager/HR: summary of all field employees for a date
exports.getJourneySummary = async (req, res) => {
  try {
    const { date, employeeId } = req.query;
    const targetDate = date
      ? moment.tz(date, "Asia/Kolkata").startOf("day").toDate()
      : moment.tz("Asia/Kolkata").startOf("day").toDate();

    const filter = { date: targetDate };
    if (employeeId) filter.employeeId = employeeId;

    const journeys = await Journey.find(filter)
      .populate("employeeId", "firstName lastName department isFieldEmployee")
      .sort("-totalDistanceKm");

    res.json(journeys);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Manager Dashboard: Real-time active journeys
exports.getActiveJourneys = async (req, res) => {
  try {
    const todayStart = moment.tz("Asia/Kolkata").startOf("day").toDate();
    const todayEnd = moment.tz("Asia/Kolkata").endOf("day").toDate();

    const activeJourneys = await Journey.find({
      date: { $gte: todayStart, $lte: todayEnd },
      status: { $in: ["ACTIVE", "PAUSED"] },
    })
      .populate("employeeId", "firstName lastName department phone email")
      .sort("-totalDistanceKm");

    // Get last location for each journey, with fallback to attendance check-in location
    const journeysWithLocation = await Promise.all(
      activeJourneys.map(async (j) => {
        let lastLocation = null;
        let lastUpdateMinutesAgo = null;

        // Try to get last location from journey points
        if (j.locationPoints && j.locationPoints.length > 0) {
          const lastPoint = j.locationPoints[j.locationPoints.length - 1];
          lastLocation = lastPoint;
          lastUpdateMinutesAgo = Math.round(
            (new Date() - new Date(lastPoint.timestamp)) / 60000,
          );
        } else {
          // Fallback: Use attendance check-in location if no journey points yet
          const attendance = await Attendance.findOne({
            userId: j.employeeId._id,
            date: { $gte: todayStart, $lte: todayEnd },
          }).select("checkInLocation checkIn");

          if (
            attendance &&
            attendance.checkInLocation &&
            attendance.checkInLocation.lat
          ) {
            lastLocation = {
              lat: attendance.checkInLocation.lat,
              lng: attendance.checkInLocation.lng,
              accuracy: 50,
              timestamp: attendance.checkIn,
              _isAttendanceLocation: true,
            };
            lastUpdateMinutesAgo = Math.round(
              (new Date() - new Date(attendance.checkIn)) / 60000,
            );
          }
        }

        return {
          ...j.toObject(),
          lastLocation,
          lastUpdateMinutesAgo,
        };
      }),
    );

    res.json(journeysWithLocation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Manager Dashboard: Journey Analytics
exports.getJourneyAnalytics = async (req, res) => {
  try {
    const { startDate, endDate, department } = req.query;
    const start = startDate
      ? moment.tz(startDate, "Asia/Kolkata").startOf("day").toDate()
      : moment.tz("Asia/Kolkata").subtract(30, "days").startOf("day").toDate();
    const end = endDate
      ? moment.tz(endDate, "Asia/Kolkata").endOf("day").toDate()
      : moment.tz("Asia/Kolkata").endOf("day").toDate();

    const filter = {
      date: { $gte: start, $lte: end },
      status: { $in: ["COMPLETED", "AUTO_ENDED"] },
    };

    const journeys = await Journey.find(filter).populate(
      "employeeId",
      "firstName lastName department",
    );

    // Filter by department if provided
    const filteredJourneys = department
      ? journeys.filter((j) => j.employeeId?.department === department)
      : journeys;

    // Calculate analytics
    const totalJourneys = filteredJourneys.length;
    const totalDistance = filteredJourneys.reduce(
      (sum, j) => sum + (j.totalDistanceKm || 0),
      0,
    );
    const avgDistance = totalJourneys > 0 ? totalDistance / totalJourneys : 0;
    const maxDistance = filteredJourneys.reduce(
      (max, j) => Math.max(max, j.totalDistanceKm || 0),
      0,
    );
    const totalEmployees = new Set(
      filteredJourneys.map((j) => j.employeeId?._id?.toString()),
    ).size;

    // Top performers
    const employeeStats = {};
    filteredJourneys.forEach((j) => {
      const empId = j.employeeId?._id?.toString();
      if (!empId) return;
      if (!employeeStats[empId]) {
        employeeStats[empId] = {
          employee: j.employeeId,
          totalDistance: 0,
          journeyCount: 0,
          avgSpeed: 0,
        };
      }
      employeeStats[empId].totalDistance += j.totalDistanceKm || 0;
      employeeStats[empId].journeyCount += 1;
      employeeStats[empId].avgSpeed += j.avgSpeedKmh || 0;
    });

    const topPerformers = Object.values(employeeStats)
      .map((s) => ({ ...s, avgSpeed: s.avgSpeed / s.journeyCount }))
      .sort((a, b) => b.totalDistance - a.totalDistance)
      .slice(0, 10);

    res.json({
      summary: {
        totalJourneys,
        totalDistance: Math.round(totalDistance * 100) / 100,
        avgDistance: Math.round(avgDistance * 100) / 100,
        maxDistance: Math.round(maxDistance * 100) / 100,
        totalEmployees,
      },
      topPerformers,
      journeys: filteredJourneys,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get journey history for an employee
exports.getJourneyHistory = async (req, res) => {
  try {
    const { startDate, endDate, employeeId } = req.query;
    const userId = employeeId || req.user.id;

    const filter = { employeeId: userId };
    if (startDate || endDate) {
      filter.date = {};
      if (startDate)
        filter.date.$gte = moment
          .tz(startDate, "Asia/Kolkata")
          .startOf("day")
          .toDate();
      if (endDate)
        filter.date.$lte = moment
          .tz(endDate, "Asia/Kolkata")
          .endOf("day")
          .toDate();
    }

    const journeys = await Journey.find(filter).sort("-date");
    res.json(journeys);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Auto-end active journeys at midnight (called by cron)
exports.autoEndJourneys = async () => {
  try {
    const result = await Journey.updateMany(
      { status: "ACTIVE" },
      { $set: { status: "AUTO_ENDED", endTime: new Date() } },
    );
    console.log(`Auto-ended ${result.modifiedCount} journeys`);
  } catch (error) {
    console.error("Auto-end journeys error:", error);
  }
};
