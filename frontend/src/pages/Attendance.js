import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Row, Col, Card, Button, Table, Badge, Form, Modal } from "react-bootstrap";
import { toast } from "react-toastify";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";
import './AttendanceEnhancements.css';

const Attendance = () => {
  const { user } = useAuth();
  const [todayStatus, setTodayStatus] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [selectedUser, setSelectedUser] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [workMode, setWorkMode] = useState('OFFICE');
  const [weekSummary, setWeekSummary] = useState({
    presentDays: 0,
    totalHours: 0,
    lateDays: 0,
    absentDays: 0,
  });

  // Edit/Delete states
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [editingRecord, setEditingRecord] = useState(null);
  const [checkInAddress, setCheckInAddress] = useState('');
  const [checkOutAddress, setCheckOutAddress] = useState('');
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [addressCache, setAddressCache] = useState({});
  const [liveHours, setLiveHours] = useState(0);

  // Calculate live hours for checked-in employees
  useEffect(() => {
    const calculateLiveHours = () => {
      if (todayStatus?.hasCheckedIn && !todayStatus?.hasCheckedOut && todayStatus?.checkInTime) {
        const checkInTime = new Date(todayStatus.checkInTime);
        const now = new Date();
        const diffMs = now - checkInTime;
        const hours = diffMs / (1000 * 60 * 60);
        setLiveHours(Math.max(0, hours));
      } else if (todayStatus?.totalHours) {
        setLiveHours(todayStatus.totalHours);
      } else {
        setLiveHours(0);
      }
    };

    calculateLiveHours();
    const interval = setInterval(calculateLiveHours, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, [todayStatus]);
  const [editForm, setEditForm] = useState({
    checkIn: "",
    checkOut: "",
    status: "",
    totalHours: "",
    editReason: "",
  });
  const [deleteReason, setDeleteReason] = useState("");
  const [showDeleted, setShowDeleted] = useState(false);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    const initData = async () => {
      await Promise.all([
        fetchTodayStatus(selectedUser),
        fetchWeekSummary(selectedUser)
      ]);
      fetchAttendanceHistory(selectedUser);
    };
    initData();

    if (user?.role && ["MANAGER", "HR", "ADMIN"].includes(user.role) && employees.length === 0) {
      fetchEmployees();
    }

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, [selectedUser, showDeleted]);

  const fetchTodayStatus = async (userId = "") => {
    try {
      setLoading(true);
      let url = "/api/attendance/today";
      if (userId && userId.trim() !== "") {
        url += `?userId=${userId}`;
      } else if (["MANAGER", "HR", "ADMIN"].includes(user?.role)) {
        url += "?userId=all";
      }

      const response = await api.get(url);
      const data = response.data;

      if (!data) {
        setTodayStatus(null);
        return;
      }

      if (data.isAggregated) {
        setTodayStatus({
          ...data,
          hasCheckedIn: false,
          hasCheckedOut: false,
          checkInTime: null,
          checkOutTime: null,
          isAggregated: true
        });
      } else {
        setTodayStatus({
          ...data,
          hasCheckedIn: Boolean(data.checkInTime || data.checkIn),
          hasCheckedOut: Boolean(data.checkOutTime || data.checkOut),
          checkInTime: data.checkInTime || data.checkIn,
          checkOutTime: data.checkOutTime || data.checkOut,
        });
      }
    } catch (error) {
      console.error("Error fetching today status:", error);
      setTodayStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceHistory = async (userId = "") => {
    try {
      let url = "/api/attendance?limit=50";
      if (userId) url += `&userId=${userId}`;
      if (showDeleted) url += `&includeDeleted=true`;
      const response = await api.get(url);
      setAttendanceHistory(response.data.attendance || response.data);
    } catch (error) {
      console.error("Error fetching attendance history:", error);
    }
  };

  const fetchWeekSummary = async (userId = "") => {
    try {
      const startOfWeek = new Date();
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      let url = `/api/attendance?startDate=${startOfWeek.toISOString().split("T")[0]}&endDate=${endOfWeek.toISOString().split("T")[0]}&limit=1000`;
      
      // Only add userId filter if it's not empty (for specific user selection)
      if (userId && userId.trim() !== "") {
        url += `&userId=${userId}`;
      }
      // If userId is empty, it will fetch all employees' data for admin/hr/manager

      const response = await api.get(url);
      const records = response.data.attendance || [];

      const summary = records.reduce(
        (acc, record) => {
          if (record.status === "Present") acc.presentDays++;
          if (record.status === "Late") acc.lateDays++;
          if (record.status === "Absent") acc.absentDays++;
          acc.totalHours += record.totalHours || 0;
          return acc;
        },
        { presentDays: 0, totalHours: 0, lateDays: 0, absentDays: 0 },
      );

      setWeekSummary(summary);
    } catch (error) {
      console.error("Error fetching week summary:", error);
      setWeekSummary({ presentDays: 0, totalHours: 0, lateDays: 0, absentDays: 0 });
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await api.get("/api/employees/directory");
      const profiles = response.data.profiles || [];
      const users = profiles.map((p) => p.userId).filter(Boolean);
      setEmployees(users);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const handleCheckIn = async () => {
    if (selectedUser && selectedUser !== user?.id) {
      return toast.error("Cannot check in for another user");
    }

    setLoading(true);

    try {
      if (!navigator.geolocation) {
        toast.error("Geolocation not supported by your browser");
        return;
      }

      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });

      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };

      await api.post("/api/attendance/checkin", { location, workMode });

      toast.success(`Checked in successfully (${workMode === 'OFFICE' ? '🏢 Office' : workMode === 'REMOTE' ? '🏠 Remote' : '🔄 Hybrid/Field'})`);
      
      // Refresh data immediately
      await fetchTodayStatus(selectedUser);
      await fetchAttendanceHistory(selectedUser);
      await fetchWeekSummary(selectedUser);
    } catch (error) {
      toast.error(
        error.response?.data?.message ||
          "Unable to check in. Please enable location.",
      );
    } finally {
      setLoading(false);
    }
  };

  /*fixed bug: checkout button*/
  const handleCheckOut = async () => {
    if (loading) return;

    if (selectedUser && selectedUser !== user?.id) {
      return toast.error("Cannot check out for another user");
    }

    if (!todayStatus?.hasCheckedIn) {
      return toast.error("Please check in first");
    }

    if (todayStatus?.hasCheckedOut) {
      return toast.error("Already checked out");
    }

    setLoading(true);

    try {
      if (!navigator.geolocation) {
        toast.error("Geolocation not supported by your browser");
        setLoading(false);
        return;
      }

      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });

      const location = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
      };

      const { data } = await api.post("/api/attendance/checkout", { location });

      toast.success(data.message || "Checked out successfully");

      // Refresh UI data
      await Promise.all([
        fetchTodayStatus(selectedUser),
        fetchAttendanceHistory(selectedUser),
      ]);
    } catch (error) {
      console.error(error);

      toast.error(
        error.response?.data?.message ||
          "Unable to check out. Please enable location.",
      );
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = useCallback((status) => {
    const config = {
      Present: { bg: "success", icon: "check-circle" },
      Absent: { bg: "danger", icon: "times-circle" },
      "Half Day": { bg: "warning", icon: "clock" },
      Late: { bg: "warning", icon: "exclamation-triangle" },
      "On Leave": { bg: "info", icon: "calendar-alt" },
      LOP: { bg: "danger", icon: "ban" },
    };
    const { bg, icon } = config[status] || { bg: "secondary", icon: "question" };
    return (
      <Badge bg={bg} className="status-badge-enhanced">
        <i className={`fas fa-${icon}`}></i>
        {status}
      </Badge>
    );
  }, []);

  const formatDate = (date) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-GB", {
      timeZone: "Asia/Kolkata",
    });
  };
 
  const formatTime = (dateString) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
    });
  };

  const formatDuration = (hours = 0) => {
    if (!hours || isNaN(hours)) return "0h 0m";
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const showLocationDetails = useCallback((record) => {
    setSelectedLocation(record.location);
    setShowLocationModal(true);
  }, []);

  const getAddressFromCoordinates = async (lat, lng) => {
    const cacheKey = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (addressCache[cacheKey]) {
      return addressCache[cacheKey];
    }

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
        { headers: { 'User-Agent': 'HRMS-Attendance-App' } }
      );
      const data = await response.json();
      const address = data.display_name || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      setAddressCache(prev => ({ ...prev, [cacheKey]: address }));
      return address;
    } catch (error) {
      return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    }
  };

  useEffect(() => {
    const loadAddresses = async () => {
      if (showLocationModal && selectedLocation) {
        setLoadingAddress(true);
        const promises = [];
        
        if (selectedLocation.checkInLocation) {
          promises.push(
            getAddressFromCoordinates(
              selectedLocation.checkInLocation.latitude,
              selectedLocation.checkInLocation.longitude
            ).then(addr => setCheckInAddress(addr))
          );
        }
        
        if (selectedLocation.checkOutLocation) {
          promises.push(
            getAddressFromCoordinates(
              selectedLocation.checkOutLocation.latitude,
              selectedLocation.checkOutLocation.longitude
            ).then(addr => setCheckOutAddress(addr))
          );
        }
        
        await Promise.all(promises);
        setLoadingAddress(false);
      }
    };
    loadAddresses();
  }, [showLocationModal, selectedLocation]);

  const getWorkModeBadge = useCallback((mode) => {
    const config = {
      OFFICE: { bg: 'primary', icon: 'building', text: 'Office' },
      REMOTE: { bg: 'success', icon: 'home', text: 'Remote' },
      HYBRID: { bg: 'info', icon: 'sync-alt', text: 'Hybrid' }
    };
    const { bg, icon, text } = config[mode] || config.OFFICE;
    return (
      <Badge bg={bg} className="status-badge-enhanced">
        <i className={`fas fa-${icon} me-1`}></i>
        {text}
      </Badge>
    );
  }, []);

  const downloadCSV = async () => {
    try {
      const params = new URLSearchParams();
      params.append("startDate", dateRange.startDate);
      params.append("endDate", dateRange.endDate);
      if (selectedUser) params.append("userId", selectedUser);

      const resp = await api.get(`/api/attendance/report?${params.toString()}`);
      const rows = resp.data.attendance || [];
      const headers = [
        "Employee",
        "Date",
        "Check In",
        "Check Out",
        "Total Hours",
        "Status",
      ];
      const csv = [headers.join(",")]
        .concat(
          rows.map((r) => {
            const emp = r.userId
              ? `${r.userId.firstName || ""} ${r.userId.lastName || ""}`.trim()
              : "";
            const date = new Date(r.date).toLocaleDateString("en-GB");
            const checkIn = r.checkIn
              ? new Date(r.checkIn).toLocaleTimeString()
              : "";
            const checkOut = r.checkOut
              ? new Date(r.checkOut).toLocaleTimeString()
              : "";
            const total = r.totalHours
              ? `${Math.floor(r.totalHours)}h ${Math.floor(
                  (r.totalHours - Math.floor(r.totalHours)) * 60,
                )}m`
              : "";
            const status = r.status || "";
            return `"${emp}","${date}","${checkIn}","${checkOut}","${total}","${status}"`;
          }),
        )
        .join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `attendance-report-${dateRange.startDate}-to-${dateRange.endDate}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setShowDownloadModal(false);
      toast.success("Report downloaded successfully");
    } catch (error) {
      toast.error("Error generating report");
      console.error(error);
    }
  };

  // Handler: Open edit modal
  const handleEditClick = (record) => {
    setEditingRecord(record);
    
    // Format dates properly for datetime-local input
    const formatForInput = (dateString) => {
      if (!dateString) return "";
      const date = new Date(dateString);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };
    
    setEditForm({
      checkIn: formatForInput(record.checkIn),
      checkOut: formatForInput(record.checkOut),
      status: record.status || "",
      totalHours: record.totalHours || "",
      editReason: "",
    });
    setShowEditModal(true);
  };

  // Calculate total hours when check-in or check-out changes
  const calculateTotalHours = (checkIn, checkOut) => {
    if (!checkIn || !checkOut) return "";
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffMs = end - start;
    if (diffMs < 0) return "";
    const hours = diffMs / (1000 * 60 * 60);
    return Math.round(hours * 100) / 100;
  };

  // Handle check-in/out time change
  const handleTimeChange = (field, value) => {
    const newForm = { ...editForm, [field]: value };
    if (field === 'checkIn' || field === 'checkOut') {
      const totalHours = calculateTotalHours(newForm.checkIn, newForm.checkOut);
      newForm.totalHours = totalHours;
    }
    setEditForm(newForm);
  };

  // Handler: Save edited attendance
  const handleSaveEdit = async () => {
    if (!editForm.editReason || editForm.editReason.trim().length < 10) {
      return toast.error("Please provide a reason (minimum 10 characters)");
    }

    setSaveLoading(true);
    try {
      await api.put(`/api/attendance/${editingRecord._id}`, editForm);
      toast.success("Attendance updated successfully");
      setShowEditModal(false);
      fetchAttendanceHistory(selectedUser);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update attendance");
    } finally {
      setSaveLoading(false);
    }
  };

  // Handler: Open delete modal
  const handleDeleteClick = (record) => {
    setEditingRecord(record);
    setDeleteReason("");
    setShowDeleteModal(true);
  };

  // Handler: Confirm delete
  const handleConfirmDelete = async () => {
    if (!deleteReason || deleteReason.trim().length < 10) {
      return toast.error("Please provide a reason (minimum 10 characters)");
    }

    try {
      await api.delete(`/api/attendance/${editingRecord._id}`, {
        data: { deletionReason: deleteReason },
      });
      toast.success("Attendance deleted successfully");
      setShowDeleteModal(false);
      fetchAttendanceHistory(selectedUser);
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to delete attendance");
    }
  };

  // Handler: View edit details (for employees)
  const handleViewDetails = (record) => {
    setEditingRecord(record);
    setShowDetailsModal(true);
  };

  return (
    <div className="fade-in-up">
      <div className="page-header">
        <h1 className="page-title">
          <i className="fas fa-clock me-3 text-primary"></i>
          Attendance Tracking
        </h1>
        <p className="text-muted mb-0">
          Track your daily attendance and working hours
        </p>
      </div>

      <Row className="mb-4">
        {/* Today's Status */}
        <Col lg={8} className="mb-3 mb-lg-0">
          <Card className="h-100 shadow-sm attendance-card">
            <Card.Header className="d-flex align-items-center justify-content-between bg-light flex-wrap">
              <div className="d-flex align-items-center gap-3 mb-2 mb-md-0">
                <i className="fas fa-calendar-day me-2 text-primary d-none d-sm-inline"></i>
                <div>
                  <div>Today's Attendance</div>
                  <small className="text-muted">
                    {todayStatus?.user
                      ? `${todayStatus.user.firstName || ""} ${
                          todayStatus.user.lastName || ""
                        }`
                      : ""}
                  </small>
                </div>
              </div>
              <div className="d-flex align-items-center gap-2 flex-wrap">
                {user?.role &&
                  ["MANAGER", "HR", "ADMIN"].includes(user.role) && (
                    <Form.Select
                      size="sm"
                      value={selectedUser}
                      onChange={(e) => setSelectedUser(e.target.value)}
                      style={{ width: "220px", minWidth: "150px" }}
                      className="mb-2 mb-md-0"
                    >
                      <option value="">View Self / All</option>
                      {employees.map((emp) => (
                        <option key={emp._id} value={emp._id}>
                          {emp.firstName} {emp.lastName}
                        </option>
                      ))}
                    </Form.Select>
                  )}
                <div className="d-flex align-items-center px-2 px-md-3 py-2" style={{ 
                  background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)', 
                  borderRadius: '10px',
                  boxShadow: '0 2px 8px rgba(30, 58, 138, 0.3)'
                }}>
                  <i className="fas fa-clock me-2" style={{ color: 'white', fontSize: '1.1rem' }}></i>
                  <div style={{ color: 'white' }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: '600', letterSpacing: '0.5px' }}>
                      {currentTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </div>
                    <div style={{ fontSize: '0.7rem', opacity: 0.9, marginTop: '-2px' }}>
                      {currentTime.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                </div>
              </div>
            </Card.Header>
            <Card.Body>
              {loading ? (
                <div className="text-center py-4">
                  <div className="spinner-border text-primary mb-3" role="status"></div>
                  <p className="text-muted">Loading attendance data...</p>
                </div>
              ) : todayStatus ? (
                todayStatus.isAggregated ? (
                  // Aggregated view for "All" employees
                  <>
                    <Row className="g-3 mb-4">
                      <Col md={6}>
                        <div className="text-center p-3" style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)', borderRadius: '12px', color: 'white', boxShadow: '0 4px 12px rgba(30, 58, 138, 0.3)' }}>
                          <i className="fas fa-users fa-2x mb-2"></i>
                          <h3 className="fw-bold mb-1">{todayStatus.summary?.totalEmployees || 0}</h3>
                          <small>Total Employees</small>
                        </div>
                      </Col>
                      <Col md={3}>
                        <div className="text-center p-2" style={{ background: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)', borderRadius: '10px', color: 'white', boxShadow: '0 3px 10px rgba(6, 95, 70, 0.25)' }}>
                          <i className="fas fa-sign-in-alt fa-lg mb-1"></i>
                          <h4 className="fw-bold mb-0">{todayStatus.summary?.checkedIn || 0}</h4>
                          <small style={{ fontSize: '0.75rem' }}>Checked In</small>
                          <div className="mt-1" style={{ fontSize: '0.7rem', opacity: 0.9 }}>
                            {todayStatus.summary?.totalEmployees > 0 && (
                              `${Math.round((todayStatus.summary?.checkedIn / todayStatus.summary?.totalEmployees) * 100)}%`
                            )}
                          </div>
                        </div>
                      </Col>
                      <Col md={3}>
                        <div className="text-center p-2" style={{ background: 'linear-gradient(135deg, #be123c 0%, #f43f5e 100%)', borderRadius: '10px', color: 'white', boxShadow: '0 3px 10px rgba(190, 18, 60, 0.25)' }}>
                          <i className="fas fa-sign-out-alt fa-lg mb-1"></i>
                          <h4 className="fw-bold mb-0">{todayStatus.summary?.checkedOut || 0}</h4>
                          <small style={{ fontSize: '0.75rem' }}>Checked Out</small>
                          <div className="mt-1" style={{ fontSize: '0.7rem', opacity: 0.9 }}>
                            {todayStatus.summary?.checkedIn > 0 && (
                              `${Math.round((todayStatus.summary?.checkedOut / todayStatus.summary?.checkedIn) * 100)}%`
                            )}
                          </div>
                        </div>
                      </Col>
                    </Row>

                    {/* Work Mode Distribution */}
                    <Row className="g-3 mb-4">
                      <Col md={4}>
                        <div className="p-3" style={{ background: '#eff6ff', borderRadius: '12px', border: '2px solid #3b82f6' }}>
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <div className="d-flex align-items-center">
                              <div className="rounded-circle d-flex align-items-center justify-content-center me-2" style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)' }}>
                                <i className="fas fa-building text-white"></i>
                              </div>
                              <span className="fw-semibold">Office</span>
                            </div>
                            <h4 className="mb-0 fw-bold" style={{ color: '#1e3a8a' }}>
                              {todayStatus.summary?.workModeStats?.OFFICE || 0}
                            </h4>
                          </div>
                          <div className="progress" style={{ height: '6px' }}>
                            <div className="progress-bar" style={{ width: `${todayStatus.summary?.checkedIn > 0 ? ((todayStatus.summary?.workModeStats?.OFFICE || 0) / todayStatus.summary?.checkedIn) * 100 : 0}%`, background: 'linear-gradient(90deg, #1e3a8a 0%, #3b82f6 100%)' }}></div>
                          </div>
                        </div>
                      </Col>
                      <Col md={4}>
                        <div className="p-3" style={{ background: '#f0fdf4', borderRadius: '12px', border: '2px solid #10b981' }}>
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <div className="d-flex align-items-center">
                              <div className="rounded-circle d-flex align-items-center justify-content-center me-2" style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #065f46 0%, #10b981 100%)' }}>
                                <i className="fas fa-home text-white"></i>
                              </div>
                              <span className="fw-semibold">Remote</span>
                            </div>
                            <h4 className="mb-0 fw-bold" style={{ color: '#065f46' }}>
                              {todayStatus.summary?.workModeStats?.REMOTE || 0}
                            </h4>
                          </div>
                          <div className="progress" style={{ height: '6px' }}>
                            <div className="progress-bar" style={{ width: `${todayStatus.summary?.checkedIn > 0 ? ((todayStatus.summary?.workModeStats?.REMOTE || 0) / todayStatus.summary?.checkedIn) * 100 : 0}%`, background: 'linear-gradient(90deg, #065f46 0%, #10b981 100%)' }}></div>
                          </div>
                        </div>
                      </Col>
                      <Col md={4}>
                        <div className="p-3" style={{ background: '#fef2f2', borderRadius: '12px', border: '2px solid #f43f5e' }}>
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <div className="d-flex align-items-center">
                              <div className="rounded-circle d-flex align-items-center justify-content-center me-2" style={{ width: '36px', height: '36px', background: 'linear-gradient(135deg, #be123c 0%, #f43f5e 100%)' }}>
                                <i className="fas fa-sync-alt text-white"></i>
                              </div>
                              <span className="fw-semibold">Hybrid</span>
                            </div>
                            <h4 className="mb-0 fw-bold" style={{ color: '#be123c' }}>
                              {todayStatus.summary?.workModeStats?.HYBRID || 0}
                            </h4>
                          </div>
                          <div className="progress" style={{ height: '6px' }}>
                            <div className="progress-bar" style={{ width: `${todayStatus.summary?.checkedIn > 0 ? ((todayStatus.summary?.workModeStats?.HYBRID || 0) / todayStatus.summary?.checkedIn) * 100 : 0}%`, background: 'linear-gradient(90deg, #be123c 0%, #f43f5e 100%)' }}></div>
                          </div>
                        </div>
                      </Col>
                    </Row>

                    {/* Status Distribution */}
                    <Row className="g-3">
                      <Col md={12}>
                        <div className="p-3" style={{ background: 'white', borderRadius: '12px', border: '1px solid #e5e7eb' }}>
                          <h6 className="mb-3 fw-semibold">Today's Status Breakdown</h6>
                          <Row className="g-2">
                            {todayStatus.summary?.statusCounts && Object.entries(todayStatus.summary.statusCounts).map(([status, count]) => (
                              <Col md={2} key={status}>
                                <div className="text-center p-2" style={{ background: '#f9fafb', borderRadius: '8px' }}>
                                  {getStatusBadge(status)}
                                  <div className="mt-2 fw-bold" style={{ fontSize: '1.25rem' }}>{count}</div>
                                </div>
                              </Col>
                            ))}
                            <Col md={2}>
                              <div className="text-center p-2" style={{ background: '#fef2f2', borderRadius: '8px' }}>
                                <Badge bg="secondary" className="status-badge-enhanced">
                                  <i className="fas fa-user-slash"></i>
                                  Absent
                                </Badge>
                                <div className="mt-2 fw-bold" style={{ fontSize: '1.25rem' }}>
                                  {(todayStatus.summary?.totalEmployees || 0) - (todayStatus.summary?.checkedIn || 0)}
                                </div>
                              </div>
                            </Col>
                          </Row>
                        </div>
                      </Col>
                    </Row>
                  </>
                ) : (
                  // Individual employee view
                  <>
                    {/* Work Mode Selector - Only show if not checked in */}
                    {(!selectedUser || selectedUser === user?.id) && !todayStatus.hasCheckedIn && (
                      <div className="mb-4 p-3" style={{ background: 'linear-gradient(135deg, #f8f9ff 0%, #e8f0fe 100%)', borderRadius: '12px', border: '2px solid #e0e7ff' }}>
                        <label className="form-label fw-semibold mb-3 d-flex align-items-center">
                          <i className="fas fa-map-marker-alt me-2" style={{ color: '#667eea' }}></i>
                          Select Work Location
                        </label>
                        <div className="btn-group w-100" role="group">
                          <input type="radio" className="btn-check" name="workMode" id="office" checked={workMode === 'OFFICE'} onChange={() => setWorkMode('OFFICE')} />
                          <label className="btn btn-outline-primary" htmlFor="office" style={{ padding: '12px', fontWeight: '600', borderRadius: '10px 0 0 10px' }}>
                            <i className="fas fa-building fa-lg mb-2 d-block"></i>
                            Office
                            <small className="d-block text-muted" style={{ fontSize: '0.75rem' }}>GPS Required</small>
                          </label>

                          <input type="radio" className="btn-check" name="workMode" id="remote" checked={workMode === 'REMOTE'} onChange={() => setWorkMode('REMOTE')} />
                          <label className="btn btn-outline-success" htmlFor="remote" style={{ padding: '12px', fontWeight: '600' }}>
                            <i className="fas fa-home fa-lg mb-2 d-block"></i>
                            Remote
                            <small className="d-block text-muted" style={{ fontSize: '0.75rem' }}>Work from Home</small>
                          </label>

                          <input type="radio" className="btn-check" name="workMode" id="hybrid" checked={workMode === 'HYBRID'} onChange={() => setWorkMode('HYBRID')} />
                          <label className="btn btn-outline-info" htmlFor="hybrid" style={{ padding: '12px', fontWeight: '600', borderRadius: '0 10px 10px 0' }}>
                            <i className="fas fa-sync-alt fa-lg mb-2 d-block"></i>
                            Hybrid / Field
                            <small className="d-block text-muted" style={{ fontSize: '0.75rem' }}>Flexible / On-site</small>
                          </label>
                        </div>
                      </div>
                    )}

                    <Row>
                    <Col xs={12} md={6} className="mb-3 mb-md-0">
                      <div className="checkin-section">
                        <div className="d-flex align-items-center justify-content-between">
                          <div>
                            <h6 className="mb-1">Check In</h6>
                            <div className="time-display">
                              {formatTime(todayStatus.checkInTime)}
                            </div>
                          </div>
                          <div className="text-end">
                            {!selectedUser || selectedUser === user?.id ? (
                              !todayStatus.hasCheckedIn ? (
                                <Button
                                  variant="success"
                                  onClick={handleCheckIn}
                                  disabled={loading}
                                  className="attendance-btn btn-ripple"
                                >
                                  {loading ? (
                                    <div className="loading-spinner me-2"></div>
                                  ) : (
                                    <i className="fas fa-sign-in-alt me-2"></i>
                                  )}
                                  Check In
                                </Button>
                              ) : (
                                <Badge bg="success" className="status-badge-enhanced fs-6">
                                  <i className="fas fa-check"></i>
                                  Checked In
                                </Badge>
                              )
                            ) : todayStatus.hasCheckedIn ? (
                              <Badge bg="success" className="status-badge-enhanced fs-6">
                                Checked In
                              </Badge>
                            ) : (
                              <Badge bg="secondary" className="status-badge-enhanced fs-6">
                                No Record
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </Col>
                    <Col xs={12} md={6} className="mb-3 mb-md-0">
                      <div className="checkout-section">
                        <div className="d-flex align-items-center justify-content-between">
                          <div>
                            <h6 className="mb-1">Check Out</h6>
                            <div className="time-display">
                              {formatTime(todayStatus.checkOutTime)}
                            </div>
                          </div>
                          <div className="text-end">
                            {!selectedUser || selectedUser === user?.id ? (
                              !todayStatus.hasCheckedOut &&
                              todayStatus.hasCheckedIn ? (
                                <Button
                                  variant="danger"
                                  onClick={handleCheckOut}
                                  disabled={loading}
                                  className="attendance-btn btn-ripple"
                                >
                                  {loading ? (
                                    <div className="loading-spinner me-2"></div>
                                  ) : (
                                    <i className="fas fa-sign-out-alt me-2"></i>
                                  )}
                                  Check Out
                                </Button>
                              ) : todayStatus.hasCheckedOut ? (
                                <Badge bg="danger" className="status-badge-enhanced fs-6">
                                  <i className="fas fa-check"></i>
                                  Checked Out
                                </Badge>
                              ) : (
                                <Badge bg="secondary" className="status-badge-enhanced fs-6">
                                  Pending
                                </Badge>
                              )
                            ) : todayStatus.hasCheckedOut ? (
                              <Badge bg="danger" className="status-badge-enhanced fs-6">
                                Checked Out
                              </Badge>
                            ) : (
                              <Badge bg="secondary" className="status-badge-enhanced fs-6">
                                No Record
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </Col>
                    <Col xs={12} md={6} className="mb-3 mb-md-0">
                      <div className="text-center p-3 bg-light rounded">
                        <h4 className="text-primary mb-1">
                          {formatDuration(liveHours)}
                        </h4>
                        <small className="text-muted">Total Hours{todayStatus.hasCheckedIn && !todayStatus.hasCheckedOut ? ' (Live)' : ''}</small>
                        {todayStatus.hasCheckedIn && !todayStatus.hasCheckedOut && (
                          <div className="mt-1">
                            <span className="badge bg-success" style={{ fontSize: '0.65rem' }}>
                              <i className="fas fa-circle" style={{ fontSize: '0.4rem', animation: 'pulse 2s infinite' }}></i> Live
                            </span>
                          </div>
                        )}
                      </div>
                    </Col>
                    <Col xs={12} md={6}>
                      <div className="text-center p-3 bg-light rounded">
                        <h4 className="mb-1">
                          {getStatusBadge(todayStatus.status)}
                        </h4>
                        <small className="text-muted">Status</small>
                      </div>
                    </Col>
                  </Row>
                  </>
                )
              ) : (
                <div className="text-center py-4">
                  <i className="fas fa-calendar-times text-muted fa-3x mb-3"></i>
                  <p className="text-muted">No attendance record for today</p>
                </div>
              )}
            </Card.Body>
          </Card>
        </Col>

        {/* Quick Stats */}
        <Col lg={4}>
          <Card className="h-100 shadow-sm attendance-card">
            <Card.Header className="d-flex align-items-center bg-light">
              <i className="fas fa-chart-bar me-2 text-success"></i>
              {(selectedUser && selectedUser !== '') || user?.role === 'EMPLOYEE' ? 'This Week Summary' : 'Team Week Summary'}
            </Card.Header>
            <Card.Body>
              {(selectedUser && selectedUser !== '') || user?.role === 'EMPLOYEE' ? (
                // Individual employee view
                <>
                  {/* Weekly Performance Score */}
                  <div className="mb-3 p-3 text-center" style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', borderRadius: '12px', border: '2px solid #3b82f6' }}>
                    <div className="mb-2">
                      <i className="fas fa-trophy fa-2x" style={{ color: '#1e3a8a' }}></i>
                    </div>
                    <h2 className="fw-bold mb-1" style={{ color: '#1e3a8a' }}>
                      {Math.round((weekSummary.presentDays / 7) * 100)}%
                    </h2>
                    <small className="text-muted fw-semibold">Weekly Attendance Score</small>
                    <div className="mt-2">
                      <small style={{ color: '#1e3a8a' }}>
                        {weekSummary.presentDays === 7 ? '🌟 Perfect Week!' : 
                         weekSummary.presentDays >= 5 ? '✅ Great Job!' : 
                         weekSummary.presentDays >= 3 ? '👍 Keep Going!' : '⚠️ Needs Improvement'}
                      </small>
                    </div>
                  </div>

                  {/* Present Days */}
                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <small className="text-muted fw-semibold">Present Days</small>
                      <span className="fw-bold" style={{ color: '#065f46' }}>
                        {weekSummary.presentDays}/7
                      </span>
                    </div>
                    <div className="progress" style={{ height: '10px', borderRadius: '10px' }}>
                      <div
                        className="progress-bar"
                        style={{ 
                          width: `${(weekSummary.presentDays / 7) * 100}%`,
                          background: weekSummary.presentDays === 7 ? 'linear-gradient(90deg, #065f46 0%, #10b981 100%)' :
                                     weekSummary.presentDays >= 5 ? 'linear-gradient(90deg, #0891b2 0%, #06b6d4 100%)' :
                                     'linear-gradient(90deg, #d97706 0%, #f59e0b 100%)'
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Total Hours */}
                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <small className="text-muted fw-semibold">Total Hours</small>
                      <span className="fw-bold" style={{ color: '#1e3a8a' }}>
                        {formatDuration(weekSummary.totalHours)}
                        <span className="text-muted" style={{ fontSize: '0.8rem' }}> / 45h</span>
                      </span>
                    </div>
                    <div className="progress" style={{ height: '10px', borderRadius: '10px' }}>
                      <div
                        className="progress-bar"
                        style={{ 
                          width: `${Math.min((weekSummary.totalHours / 45) * 100, 100)}%`,
                          background: 'linear-gradient(90deg, #1e3a8a 0%, #3b82f6 100%)'
                        }}
                      ></div>
                    </div>
                    <small className="text-muted">
                      {weekSummary.presentDays > 0 ? `Avg: ${formatDuration(weekSummary.totalHours / weekSummary.presentDays)} per day` : 'No data'}
                    </small>
                  </div>

                  {/* Issues */}
                  <div className="row g-2">
                    <div className="col-6">
                      <div className="text-center p-2" style={{ 
                        background: weekSummary.lateDays > 0 ? '#fef3c7' : '#f3f4f6', 
                        borderRadius: '8px', 
                        border: weekSummary.lateDays > 0 ? '1px solid #fbbf24' : '1px solid #e5e7eb'
                      }}>
                        <div className="fw-bold" style={{ color: weekSummary.lateDays > 0 ? '#92400e' : '#6b7280', fontSize: '1.25rem' }}>
                          {weekSummary.lateDays}
                        </div>
                        <small style={{ color: weekSummary.lateDays > 0 ? '#92400e' : '#6b7280', fontSize: '0.7rem' }}>Late Days</small>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="text-center p-2" style={{ 
                        background: weekSummary.absentDays > 0 ? '#fee2e2' : '#f3f4f6', 
                        borderRadius: '8px', 
                        border: weekSummary.absentDays > 0 ? '1px solid #f87171' : '1px solid #e5e7eb'
                      }}>
                        <div className="fw-bold" style={{ color: weekSummary.absentDays > 0 ? '#991b1b' : '#6b7280', fontSize: '1.25rem' }}>
                          {weekSummary.absentDays}
                        </div>
                        <small style={{ color: weekSummary.absentDays > 0 ? '#991b1b' : '#6b7280', fontSize: '0.7rem' }}>Absent Days</small>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                // Admin/HR aggregated view
                <>
                  {/* Total Attendance */}
                  <div className="mb-3 p-3" style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', borderRadius: '10px', border: '1px solid #3b82f6' }}>
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <div>
                        <i className="fas fa-calendar-check me-2" style={{ color: '#1e3a8a' }}></i>
                        <span className="fw-semibold" style={{ color: '#1e3a8a' }}>Total Attendance</span>
                      </div>
                      <h4 className="mb-0 fw-bold" style={{ color: '#1e3a8a' }}>
                        {weekSummary.presentDays}
                      </h4>
                    </div>
                    <small className="text-muted">Total check-ins this week</small>
                  </div>

                  {/* Average Daily Attendance */}
                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <small className="text-muted fw-semibold">Avg Daily Attendance</small>
                      <span className="fw-bold" style={{ color: '#065f46' }}>
                        {employees.length > 0 ? Math.round((weekSummary.presentDays / 7) / employees.length * 100) : 0}%
                      </span>
                    </div>
                    <div className="progress" style={{ height: '8px' }}>
                      <div
                        className="progress-bar"
                        style={{ 
                          width: `${employees.length > 0 ? Math.min((weekSummary.presentDays / 7) / employees.length * 100, 100) : 0}%`,
                          background: 'linear-gradient(90deg, #065f46 0%, #10b981 100%)'
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Total Hours */}
                  <div className="mb-3">
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <small className="text-muted fw-semibold">Total Hours Worked</small>
                      <span className="fw-bold" style={{ color: '#1e3a8a' }}>
                        {formatDuration(weekSummary.totalHours)}
                      </span>
                    </div>
                    <div className="progress" style={{ height: '8px' }}>
                      <div
                        className="progress-bar"
                        style={{ 
                          width: `${employees.length > 0 ? Math.min((weekSummary.totalHours / (employees.length * 45)) * 100, 100) : 0}%`,
                          background: 'linear-gradient(90deg, #1e3a8a 0%, #3b82f6 100%)'
                        }}
                      ></div>
                    </div>
                    <small className="text-muted">
                      Avg: {employees.length > 0 && weekSummary.presentDays > 0 ? formatDuration(weekSummary.totalHours / weekSummary.presentDays) : '0h 0m'} per attendance
                    </small>
                  </div>

                  {/* Issues Summary */}
                  <div className="row mt-3 g-2">
                    <div className="col-6">
                      <div className="text-center p-2" style={{ background: '#fef3c7', borderRadius: '8px', border: '1px solid #fbbf24' }}>
                        <div className="fw-bold" style={{ color: '#92400e', fontSize: '1.1rem' }}>{weekSummary.lateDays}</div>
                        <small style={{ color: '#92400e', fontSize: '0.7rem' }}>Late Arrivals</small>
                      </div>
                    </div>
                    <div className="col-6">
                      <div className="text-center p-2" style={{ background: '#fee2e2', borderRadius: '8px', border: '1px solid #f87171' }}>
                        <div className="fw-bold" style={{ color: '#991b1b', fontSize: '1.1rem' }}>{weekSummary.absentDays}</div>
                        <small style={{ color: '#991b1b', fontSize: '0.7rem' }}>Absences</small>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>

      {/* Attendance History */}
      <Card className="shadow-sm">
        <Card.Header className="d-flex align-items-center justify-content-between bg-light flex-wrap">
          <i className="fas fa-history me-2 text-info d-none d-sm-inline"></i>
          <div className="mb-2 mb-md-0">Recent Attendance History</div>
          <div className="d-flex align-items-center gap-2 flex-wrap">
            {user?.role && ["MANAGER", "HR", "ADMIN"].includes(user.role) && (
              <>
                {/* Toggle for deleted records */}
                {["ADMIN", "HR"].includes(user?.role) && (
                  <Form.Check
                    type="switch"
                    id="show-deleted-switch"
                    label="Show Deleted"
                    checked={showDeleted}
                    onChange={(e) => setShowDeleted(e.target.checked)}
                    className="me-2"
                  />
                )}
                <Form.Select
                  size="sm"
                  value={selectedUser}
                  onChange={(e) => {
                    setSelectedUser(e.target.value);
                    fetchAttendanceHistory(e.target.value);
                  }}
                  style={{ width: "220px", minWidth: "150px" }}
                  className="mb-2 mb-md-0"
                >
                  <option value="">All Employees</option>
                  {employees.map((emp) => (
                    <option key={emp._id} value={emp._id}>
                      {emp.firstName} {emp.lastName}
                    </option>
                  ))}
                </Form.Select>
                <Button
                  size="sm"
                  variant="outline-primary"
                  onClick={() => setShowDownloadModal(true)}
                  className="mb-2 mb-md-0"
                >
                  <i className="fas fa-download me-1"></i>Download
                </Button>
              </>
            )}
          </div>
        </Card.Header>
        <Card.Body style={{ padding: 0 }}>
          {attendanceHistory.length > 0 ? (
            <div
              className="table-responsive"
              style={{ maxHeight: "400px", overflowY: "auto" }}
            >
              <Table hover className="mb-0 attendance-table">
                <thead
                  style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 10,
                    background:
                      "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
                    borderBottom: "2px solid #e2e8f0",
                  }}
                >
                  <tr>
                    <th
                      style={{
                        color: "#475569",
                        fontWeight: "600",
                        fontSize: "0.875rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.025em",
                        padding: "1rem",
                      }}
                    >
                      Date
                    </th>
                    {user?.role &&
                      ["MANAGER", "HR", "ADMIN"].includes(user.role) && (
                        <th
                          style={{
                            color: "#475569",
                            fontWeight: "600",
                            fontSize: "0.875rem",
                            textTransform: "uppercase",
                            letterSpacing: "0.025em",
                            padding: "1rem",
                          }}
                        >
                          Employee
                        </th>
                      )}
                    <th
                      style={{
                        color: "#475569",
                        fontWeight: "600",
                        fontSize: "0.875rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.025em",
                        padding: "1rem",
                      }}
                    >
                      Check In
                    </th>
                    <th
                      style={{
                        color: "#475569",
                        fontWeight: "600",
                        fontSize: "0.875rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.025em",
                        padding: "1rem",
                      }}
                    >
                      Check Out
                    </th>
                    <th
                      style={{
                        color: "#475569",
                        fontWeight: "600",
                        fontSize: "0.875rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.025em",
                        padding: "1rem",
                      }}
                    >
                      Total Hours
                    </th>
                    <th
                      style={{
                        color: "#475569",
                        fontWeight: "600",
                        fontSize: "0.875rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.025em",
                        padding: "1rem",
                      }}
                    >
                      Status
                    </th>
                    <th
                      style={{
                        color: "#475569",
                        fontWeight: "600",
                        fontSize: "0.875rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.025em",
                        padding: "1rem",
                      }}
                    >
                      Work Mode
                    </th>
                    <th
                      style={{
                        color: "#475569",
                        fontWeight: "600",
                        fontSize: "0.875rem",
                        textTransform: "uppercase",
                        letterSpacing: "0.025em",
                        padding: "1rem",
                      }}
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceHistory.map((record) => {
                    const statusClass = record.status === 'Present' ? 'status-present' : 
                                       record.status === 'Absent' ? 'status-absent' : 
                                       record.status === 'Late' ? 'status-late' : 
                                       record.status === 'Half Day' ? 'status-halfday' : '';
                    return (
                    <tr key={record._id} className={`smooth-transition ${statusClass}`} style={record.isDeleted ? { backgroundColor: '#ffe6e6' } : {}}>
                      <td>{formatDate(record.date)}</td>
                      {user?.role &&
                        ["MANAGER", "HR", "ADMIN"].includes(user.role) && (
                          <td>
                            {record.userId
                              ? `${record.userId.firstName} ${record.userId.lastName}`
                              : ""}
                          </td>
                        )}
                      <td>{formatTime(record.checkIn)}</td>
                      <td>
                        {formatTime(record.checkOut)}
                        {record.isAutoCheckout && (
                          <Badge 
                            className="ms-2" 
                            title="Automatically checked out at 6:00 PM"
                            style={{
                              backgroundColor: '#6366f1',
                              color: '#ffffff',
                              fontSize: '0.7rem',
                              fontWeight: '600',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              border: '1px solid #4f46e5'
                            }}
                          >
                            <i className="fas fa-robot me-1"></i>
                            AUTO
                          </Badge>
                        )}
                      </td>
                      <td>{formatDuration(record.totalHours)}</td>
                      <td>
                        {getStatusBadge(record.status)}
                        {record.isDeleted && (
                          <Badge bg="danger" className="ms-2">
                            <i className="fas fa-trash me-1"></i>
                            Deleted
                          </Badge>
                        )}
                      </td>
                      <td>
                        {getWorkModeBadge(record.workMode || 'OFFICE')}
                        <Button
                          variant="link"
                          size="sm"
                          className="p-0 ms-2"
                          onClick={() => showLocationDetails(record)}
                          title="View location details"
                        >
                          <i className="fas fa-map-marker-alt text-primary"></i>
                        </Button>
                      </td>
                      <td>
                        {/* Show deleted info for Admin/HR */}
                        {record.isDeleted && ["ADMIN", "HR"].includes(user?.role) ? (
                          <div className="text-muted small">
                            <div>Deleted by: {record.deletedBy?.firstName} {record.deletedBy?.lastName}</div>
                            <div>Reason: {record.deletionReason}</div>
                          </div>
                        ) : (
                          <>
                            {/* Admin/HR: Show Edit/Delete buttons */}
                            {["ADMIN", "HR"].includes(user?.role) && !record.isDeleted && (
                              <div className="d-flex gap-2">
                                <Button
                                  variant="outline-primary"
                                  size="sm"
                                  onClick={() => handleEditClick(record)}
                                  title="Edit attendance"
                                  style={{ padding: '4px 12px' }}
                                >
                                  <i className="fas fa-edit"></i>
                                </Button>
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  onClick={() => handleDeleteClick(record)}
                                  title="Delete attendance"
                                  style={{ padding: '4px 12px' }}
                                >
                                  <i className="fas fa-trash"></i>
                                </Button>
                              </div>
                            )}

                            {/* Employee: Show edited badge and view icon */}
                            {user?.role === "EMPLOYEE" && record.lastEditedBy && (
                              <div className="d-flex align-items-center gap-2">
                                <Badge bg="info" className="me-1">
                                  <i className="fas fa-pencil-alt me-1"></i>
                                  Edited
                                </Badge>
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="p-0"
                                  onClick={() => handleViewDetails(record)}
                                  title="View edit details"
                                >
                                  <i className="fas fa-eye text-info"></i>
                                </Button>
                              </div>
                            )}

                            {/* Employee: No edit - show nothing */}
                            {user?.role === "EMPLOYEE" && !record.lastEditedBy && (
                              <span className="text-muted">-</span>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-4">
              <i className="fas fa-calendar-times text-muted fs-1 mb-3"></i>
              <p className="text-muted mb-0">No attendance records found</p>
            </div>
          )}
        </Card.Body>
      </Card>

      {/* Edit Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)} size="lg">
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="fas fa-edit me-2 text-primary"></i>
            Edit Attendance
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editingRecord && (
            <div>
              <div className="mb-3 p-3 bg-light rounded">
                <strong>Employee:</strong> {editingRecord.userId?.firstName} {editingRecord.userId?.lastName}
                <br />
                <strong>Date:</strong> {formatDate(editingRecord.date)}
              </div>

              <Form>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Check-In Time</Form.Label>
                      <Form.Control
                        type="datetime-local"
                        value={editForm.checkIn}
                        onChange={(e) => handleTimeChange('checkIn', e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Check-Out Time</Form.Label>
                      <Form.Control
                        type="datetime-local"
                        value={editForm.checkOut}
                        onChange={(e) => handleTimeChange('checkOut', e.target.value)}
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Status</Form.Label>
                      <Form.Select
                        value={editForm.status}
                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                      >
                        <option value="Present">Present</option>
                        <option value="Absent">Absent</option>
                        <option value="Half Day">Half Day</option>
                        <option value="Late">Late</option>
                        <option value="On Leave">On Leave</option>
                        <option value="LOP">LOP</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Total Hours</Form.Label>
                      <Form.Control
                        type="number"
                        step="0.1"
                        value={editForm.totalHours}
                        onChange={(e) => setEditForm({ ...editForm, totalHours: e.target.value })}
                      />
                    </Form.Group>
                  </Col>
                </Row>

                <Form.Group className="mb-3">
                  <Form.Label>
                    Reason for Edit <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    placeholder="Minimum 10 characters required"
                    value={editForm.editReason}
                    onChange={(e) => setEditForm({ ...editForm, editReason: e.target.value })}
                  />
                  <Form.Text className="text-muted">
                    {editForm.editReason.length}/10 characters
                  </Form.Text>
                </Form.Group>
              </Form>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowEditModal(false)} disabled={saveLoading}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSaveEdit} disabled={saveLoading}>
            {saveLoading ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                Saving...
              </>
            ) : (
              <>
                <i className="fas fa-save me-2"></i>
                Save Changes
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="fas fa-trash me-2 text-danger"></i>
            Delete Attendance Record
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editingRecord && (
            <div>
              <div className="alert alert-warning">
                <i className="fas fa-exclamation-triangle me-2"></i>
                <strong>Warning:</strong> This action cannot be undone!
              </div>

              <div className="mb-3 p-3 bg-light rounded">
                <strong>Employee:</strong> {editingRecord.userId?.firstName} {editingRecord.userId?.lastName}
                <br />
                <strong>Date:</strong> {formatDate(editingRecord.date)}
                <br />
                <strong>Status:</strong> {editingRecord.status}
              </div>

              <Form>
                <Form.Group className="mb-3">
                  <Form.Label>
                    Reason for Deletion <span className="text-danger">*</span>
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    placeholder="Minimum 10 characters required"
                    value={deleteReason}
                    onChange={(e) => setDeleteReason(e.target.value)}
                  />
                  <Form.Text className="text-muted">
                    {deleteReason.length}/10 characters
                  </Form.Text>
                </Form.Group>
              </Form>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleConfirmDelete}>
            <i className="fas fa-trash me-2"></i>
            Confirm Delete
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Download Date Range Modal */}
      <Modal show={showDownloadModal} onHide={() => setShowDownloadModal(false)} centered>
        <Modal.Header closeButton className="border-0 pb-0">
          <Modal.Title className="d-flex align-items-center">
            <div
              className="rounded-circle d-flex align-items-center justify-content-center me-3"
              style={{
                width: '48px',
                height: '48px',
                background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)'
              }}
            >
              <i className="fas fa-download text-white"></i>
            </div>
            <div>
              <h5 className="mb-0">Export Attendance Report</h5>
              <small className="text-muted">Generate custom date range report in CSV format</small>
            </div>
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="px-4 py-4">
          <Form>
            <div className="mb-4">
              <label className="form-label fw-semibold mb-3">
                <i className="fas fa-calendar-alt me-2" style={{ color: '#0ea5e9' }}></i>
                Select Date Range
              </label>
              <Row className="g-3">
                <Col md={6}>
                  <div className="position-relative">
                    <Form.Label className="small text-muted mb-2">From Date</Form.Label>
                    <Form.Control
                      type="date"
                      value={dateRange.startDate}
                      onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                      className="form-control-lg"
                      style={{
                        borderRadius: '12px',
                        border: '2px solid #e0f2fe',
                        padding: '12px 16px'
                      }}
                    />
                  </div>
                </Col>
                <Col md={6}>
                  <div className="position-relative">
                    <Form.Label className="small text-muted mb-2">To Date</Form.Label>
                    <Form.Control
                      type="date"
                      value={dateRange.endDate}
                      onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                      className="form-control-lg"
                      style={{
                        borderRadius: '12px',
                        border: '2px solid #e0f2fe',
                        padding: '12px 16px'
                      }}
                    />
                  </div>
                </Col>
              </Row>
            </div>

            <div
              className="p-3 rounded-3"
              style={{
                background: 'linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%)',
                border: '1px solid #bae6fd'
              }}
            >
              <div className="d-flex align-items-start">
                <div
                  className="rounded-circle d-flex align-items-center justify-content-center me-3 flex-shrink-0"
                  style={{
                    width: '40px',
                    height: '40px',
                    background: '#0ea5e9'
                  }}
                >
                  <i className="fas fa-info-circle text-white"></i>
                </div>
                <div className="flex-grow-1">
                  <h6 className="mb-2" style={{ color: '#0369a1' }}>Report Details</h6>
                  <div className="small" style={{ color: '#0c4a6e' }}>
                    {selectedUser ? (
                      <>
                        <div className="mb-1">
                          <i className="fas fa-user me-2" style={{ color: '#0ea5e9' }}></i>
                          <strong>Employee:</strong> {employees.find(e => e._id === selectedUser)?.firstName} {employees.find(e => e._id === selectedUser)?.lastName}
                        </div>
                      </>
                    ) : (
                      <div className="mb-1">
                        <i className="fas fa-users me-2" style={{ color: '#0ea5e9' }}></i>
                        <strong>Scope:</strong> All Employees
                      </div>
                    )}
                    <div>
                      <i className="fas fa-file-csv me-2" style={{ color: '#0ea5e9' }}></i>
                      <strong>Format:</strong> CSV (Excel Compatible)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Form>
        </Modal.Body>
        <Modal.Footer className="border-0 pt-0 px-4 pb-4">
          <Button
            variant="light"
            onClick={() => setShowDownloadModal(false)}
            className="px-4 py-2"
            style={{ borderRadius: '10px', fontWeight: '500', border: '2px solid #e5e7eb' }}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={downloadCSV}
            className="px-4 py-2"
            style={{
              borderRadius: '10px',
              fontWeight: '500',
              background: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 100%)',
              border: 'none',
              boxShadow: '0 4px 12px rgba(14, 165, 233, 0.3)'
            }}
          >
            <i className="fas fa-download me-2"></i>
            Download Report
          </Button>
        </Modal.Footer>
      </Modal>

      {/* View Edit Details Modal (For Employees) */}
      <Modal show={showDetailsModal} onHide={() => setShowDetailsModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="fas fa-info-circle me-2 text-info"></i>
            Attendance Edit Details
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {editingRecord && (
            <div>
              <div className="mb-3 p-3 bg-light rounded">
                <strong>Date:</strong> {formatDate(editingRecord.date)}
                <br />
                <strong>Current Status:</strong> {editingRecord.status}
              </div>

              <div className="alert alert-info">
                <h6 className="alert-heading">
                  <i className="fas fa-user-edit me-2"></i>
                  Edit Information
                </h6>
                <hr />
                <p className="mb-2">
                  <strong>Edited By:</strong>{" "}
                  {editingRecord.lastEditedBy?.firstName} {editingRecord.lastEditedBy?.lastName}
                </p>
                <p className="mb-2">
                  <strong>Edited On:</strong>{" "}
                  {editingRecord.lastEditedAt
                    ? new Date(editingRecord.lastEditedAt).toLocaleString("en-IN", {
                        timeZone: "Asia/Kolkata",
                      })
                    : "N/A"}
                </p>
                <p className="mb-0">
                  <strong>Reason:</strong>
                  <br />
                  {editingRecord.editReason || "No reason provided"}
                </p>
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowDetailsModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Location Details Modal */}
      <Modal show={showLocationModal} onHide={() => setShowLocationModal(false)} size="lg">
        <Modal.Header closeButton style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white', border: 'none' }}>
          <Modal.Title>
            <i className="fas fa-map-marked-alt me-2"></i>
            Location Details
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          {selectedLocation && (
            <>
              {/* Check-in Location */}
              <div className="mb-4 p-3" style={{ background: 'linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%)', borderRadius: '12px', border: '2px solid #81c784' }}>
                <h5 className="mb-3 d-flex align-items-center" style={{ color: '#2e7d32' }}>
                  <div className="rounded-circle d-flex align-items-center justify-content-center me-3" style={{ width: '40px', height: '40px', background: '#4caf50' }}>
                    <i className="fas fa-sign-in-alt text-white"></i>
                  </div>
                  Check-in Location
                </h5>
                {selectedLocation.checkInLocation ? (
                  <div className="ms-5">
                    {loadingAddress ? (
                      <div className="mb-3">
                        <div className="spinner-border spinner-border-sm text-success me-2" role="status"></div>
                        <span className="text-muted">Loading address...</span>
                      </div>
                    ) : (
                      <div className="mb-3 p-3" style={{ background: 'white', borderRadius: '8px', border: '1px solid #a5d6a7' }}>
                        <i className="fas fa-map-marker-alt me-2" style={{ color: '#4caf50' }}></i>
                        <strong>{checkInAddress}</strong>
                      </div>
                    )}
                    <p className="mb-2 text-muted small">
                      <i className="fas fa-map-pin me-2"></i>
                      <strong>Coordinates:</strong> {selectedLocation.checkInLocation.latitude?.toFixed(6)}, {selectedLocation.checkInLocation.longitude?.toFixed(6)}
                    </p>
                    <p className="mb-2">
                      <i className="fas fa-crosshairs me-2" style={{ color: '#4caf50' }}></i>
                      <strong>Accuracy:</strong> {selectedLocation.checkInLocation.accuracy ? `${Math.round(selectedLocation.checkInLocation.accuracy)}m` : 'N/A'}
                    </p>
                    <a
                      href={`https://www.google.com/maps?q=${selectedLocation.checkInLocation.latitude},${selectedLocation.checkInLocation.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-success mt-2"
                    >
                      <i className="fas fa-external-link-alt me-2"></i>
                      View on Google Maps
                    </a>
                  </div>
                ) : (
                  <p className="text-muted ms-5">No check-in location recorded</p>
                )}
              </div>

              {/* Check-out Location */}
              {selectedLocation.checkOutLocation && (
                <div className="p-3" style={{ background: 'linear-gradient(135deg, #ffebee 0%, #ffcdd2 100%)', borderRadius: '12px', border: '2px solid #e57373' }}>
                  <h5 className="mb-3 d-flex align-items-center" style={{ color: '#c62828' }}>
                    <div className="rounded-circle d-flex align-items-center justify-content-center me-3" style={{ width: '40px', height: '40px', background: '#f44336' }}>
                      <i className="fas fa-sign-out-alt text-white"></i>
                    </div>
                    Check-out Location
                  </h5>
                  <div className="ms-5">
                    {checkOutAddress && (
                      <div className="mb-3 p-3" style={{ background: 'white', borderRadius: '8px', border: '1px solid #ef9a9a' }}>
                        <i className="fas fa-map-marker-alt me-2" style={{ color: '#f44336' }}></i>
                        <strong>{checkOutAddress}</strong>
                      </div>
                    )}
                    <p className="mb-2 text-muted small">
                      <i className="fas fa-map-pin me-2"></i>
                      <strong>Coordinates:</strong> {selectedLocation.checkOutLocation.latitude?.toFixed(6)}, {selectedLocation.checkOutLocation.longitude?.toFixed(6)}
                    </p>
                    <p className="mb-2">
                      <i className="fas fa-crosshairs me-2" style={{ color: '#f44336' }}></i>
                      <strong>Accuracy:</strong> {selectedLocation.checkOutLocation.accuracy ? `${Math.round(selectedLocation.checkOutLocation.accuracy)}m` : 'N/A'}
                    </p>
                    <a
                      href={`https://www.google.com/maps?q=${selectedLocation.checkOutLocation.latitude},${selectedLocation.checkOutLocation.longitude}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-danger mt-2"
                    >
                      <i className="fas fa-external-link-alt me-2"></i>
                      View on Google Maps
                    </a>
                  </div>
                </div>
              )}

              {!selectedLocation.checkOutLocation && (
                <div className="text-center p-4 bg-light rounded">
                  <i className="fas fa-clock fa-2x text-muted mb-2"></i>
                  <p className="text-muted mb-0">Check-out location not yet recorded</p>
                </div>
              )}
            </>
          )}
        </Modal.Body>
        <Modal.Footer style={{ border: 'none' }}>
          <Button variant="secondary" onClick={() => setShowLocationModal(false)} style={{ borderRadius: '8px', padding: '8px 24px' }}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default Attendance;
