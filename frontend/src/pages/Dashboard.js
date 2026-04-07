import React, { useState, useEffect, useRef } from "react";
import {
  Row,
  Col,
  Card,
  Badge,
  Table,
  Button,
  Modal,
  Form,
} from "react-bootstrap";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import api from "../utils/api";
import { toast } from "react-toastify";
import { showAnnouncementNotification } from "../utils/notificationService";
import DailyUpdates from "../components/DailyUpdates";
import "../styles/Dashboard.css";

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [files, setFiles] = useState([]);
  const [journeyData, setJourneyData] = useState(null);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [showFavoriteModal, setShowFavoriteModal] = useState(false);
  const [showAnnouncementModal, setShowAnnouncementModal] = useState(false);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [favoriteForm, setFavoriteForm] = useState({
    title: "",
    url: "",
    icon: "",
  });
  const [announcementForm, setAnnouncementForm] = useState({
    title: "",
    content: "",
    priority: "MEDIUM",
    targetRoles: [],
    expiryDate: "",
  });
  const [holidayForm, setHolidayForm] = useState({
    name: "",
    date: "",
    type: "FESTIVAL",
    description: "",
  });
  const [fileForm, setFileForm] = useState({
    type: "ORGANIZATION",
    category: "",
    description: "",
    isPublic: true,
  });
  const [selectedFile, setSelectedFile] = useState(null);

  const announcementsRef = useRef([]);

  useEffect(() => {
    fetchDashboardData();
    fetchAnnouncements();
    fetchHolidays();
    fetchFavorites();
    fetchFiles();
    if (user?.isFieldEmployee) {
      api.get('/api/journey/today').then(r => setJourneyData(r.data)).catch(() => {});
    }
  }, [user?.role]);

  const fetchDashboardData = async () => {
    try {
      let endpoint = "/api/dashboard/employee";
      if (user?.role === "MANAGER") endpoint = "/api/dashboard/manager";
      if (["HR", "ADMIN"].includes(user?.role)) endpoint = "/api/dashboard/hr";

      const response = await api.get(endpoint);
      setDashboardData(response.data);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnnouncements = async () => {
    try {
      const response = await api.get("/api/announcements");
      const newAnnouncements = response.data;

      if (
        announcementsRef.current.length > 0 &&
        newAnnouncements.length > announcementsRef.current.length
      ) {
        const latestAnnouncement = newAnnouncements[0];
        showAnnouncementNotification(latestAnnouncement);
      }

      announcementsRef.current = newAnnouncements;
      setAnnouncements(newAnnouncements);
    } catch (error) {
      console.error("Error fetching announcements:", error);
    }
  };

  const fetchHolidays = async () => {
    try {
      const response = await api.get("/api/holidays");
      setHolidays(response.data);
    } catch (error) {
      console.error("Error fetching holidays:", error);
    }
  };

  const fetchFavorites = async () => {
    try {
      const response = await api.get("/api/favorites");
      setFavorites(response.data);
    } catch (error) {
      console.error("Error fetching favorites:", error);
    }
  };

  const fetchFiles = async () => {
    try {
      const response = await api.get("/api/files");
      setFiles(response.data);
    } catch (error) {
      console.error("Error fetching files:", error);
    }
  };

  const handleAddFavorite = async (e) => {
    e.preventDefault();
    try {
      await api.post("/api/favorites", favoriteForm);
      setShowFavoriteModal(false);
      setFavoriteForm({ title: "", url: "", icon: "" });
      fetchFavorites();
      toast.success("Favorite added successfully");
    } catch (error) {
      toast.error("Error adding favorite");
    }
  };

  const handleAddAnnouncement = async (e) => {
    e.preventDefault();
    try {
      await api.post("/api/announcements", announcementForm);
      setShowAnnouncementModal(false);
      setAnnouncementForm({
        title: "",
        content: "",
        priority: "MEDIUM",
        targetRoles: [],
        expiryDate: "",
      });
      fetchAnnouncements();
      toast.success("Announcement added successfully");
    } catch (error) {
      toast.error("Error adding announcement");
    }
  };

  const handleAddHoliday = async (e) => {
    e.preventDefault();
    try {
      await api.post("/api/holidays", holidayForm);
      setShowHolidayModal(false);
      setHolidayForm({ name: "", date: "", type: "FESTIVAL", description: "" });
      fetchHolidays();
      toast.success("Holiday added successfully");
    } catch (error) {
      toast.error("Error adding holiday");
    }
  };

  const handleMarkHolidayAttendance = async (date) => {
    try {
      const response = await api.post("/api/attendance/mark-holiday", { date });
      toast.success(response.data.message);
    } catch (error) {
      toast.error(
        error.response?.data?.message || "Error marking holiday attendance",
      );
    }
  };

  const handleFileUpload = async (e) => {
    e.preventDefault();
    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      Object.keys(fileForm).forEach((key) => {
        formData.append(key, fileForm[key]);
      });

      await api.post("/api/files/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setShowFileModal(false);
      setFileForm({
        type: "ORGANIZATION",
        category: "",
        description: "",
        isPublic: true,
      });
      setSelectedFile(null);
      fetchFiles();
      toast.success("File uploaded successfully");
    } catch (error) {
      toast.error("Error uploading file");
    }
  };

  const handleRoleChange = (role, checked) => {
    if (checked) {
      setAnnouncementForm({
        ...announcementForm,
        targetRoles: [...announcementForm.targetRoles, role],
      });
    } else {
      setAnnouncementForm({
        ...announcementForm,
        targetRoles: announcementForm.targetRoles.filter((r) => r !== role),
      });
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      PENDING: "warning",
      MANAGER_APPROVED: "info",
      HR_APPROVED: "success",
      REJECTED: "danger",
      CANCELLED: "secondary",
    };
    return (
      <Badge
        bg={variants[status] || "secondary"}
        className={`status-${status.toLowerCase()}`}
      >
        <i className={`fas fa-${getStatusIcon(status)} me-1`}></i>
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const getStatusIcon = (status) => {
    const icons = {
      PENDING: "clock",
      MANAGER_APPROVED: "check-circle",
      HR_APPROVED: "check-double",
      REJECTED: "times-circle",
      CANCELLED: "ban",
    };
    return icons[status] || "question-circle";
  };

  if (loading) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ height: "400px" }}
      >
        <div className="text-center">
          <div className="spinner-border text-primary mb-3" role="status"></div>
          <p className="text-muted">Loading dashboard...</p>
        </div>
      </div>
    );
  }
  return (
    <div className="dashboard-page">
      {/* Most recent announcement — mobile only */}
      {announcements.length > 0 && (
        <div className="d-block d-md-none mb-3">
          <div
            className="announcement-item"
            style={{
              background: "#fff",
              borderRadius: "0.875rem",
              border: "1px solid #e2e8f0",
              boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
            }}
          >
            <div
              className="announcement-icon"
              style={{
                background:
                  announcements[0].priority === "HIGH"
                    ? "#ef4444"
                    : announcements[0].priority === "MEDIUM"
                      ? "#f59e0b"
                      : "#3b82f6",
                flexShrink: 0,
              }}
            >
              <i className="fas fa-bullhorn"></i>
            </div>
            <div className="announcement-content">
              <div className="d-flex justify-content-between align-items-start mb-1">
                <div className="announcement-title">
                  {announcements[0].title}
                </div>
                <span
                  style={{
                    fontSize: "0.62rem",
                    fontWeight: 700,
                    padding: "0.15rem 0.45rem",
                    borderRadius: "1rem",
                    flexShrink: 0,
                    marginLeft: "0.5rem",
                    background:
                      announcements[0].priority === "HIGH"
                        ? "rgba(239,68,68,0.12)"
                        : announcements[0].priority === "MEDIUM"
                          ? "rgba(245,158,11,0.12)"
                          : "rgba(59,130,246,0.12)",
                    color:
                      announcements[0].priority === "HIGH"
                        ? "#ef4444"
                        : announcements[0].priority === "MEDIUM"
                          ? "#d97706"
                          : "#3b82f6",
                  }}
                >
                  {announcements[0].priority}
                </span>
              </div>
              <div className="announcement-text">
                {announcements[0].content}
              </div>
              <div className="announcement-meta">
                <i className="fas fa-clock me-1"></i>
                {new Date(announcements[0].createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        </div>
      )}

      {user?.role === "EMPLOYEE" && dashboardData && (
        <>
          {/* Quick Actions */}
          <Card className="modern-card mb-4">
            <Card.Body className="p-3">
              <div className="dash-quick-actions">
                <button
                  onClick={() => navigate("/apply-leave")}
                  style={{
                    padding: "0.9rem 1rem",
                    borderRadius: "0.75rem",
                    border: "none",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.55rem",
                    cursor: "pointer",
                    background:
                      "linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)",
                    color: "#fff",
                  }}
                >
                  <i className="fas fa-calendar-plus"></i>Apply Leave
                </button>
                <button
                  onClick={() => navigate("/attendance")}
                  style={{
                    padding: "0.9rem 1rem",
                    borderRadius: "0.75rem",
                    border: "none",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.55rem",
                    cursor: "pointer",
                    background:
                      "linear-gradient(135deg,#10b981 0%,#059669 100%)",
                    color: "#fff",
                  }}
                >
                  <i className="fas fa-clock"></i>Mark Attendance
                </button>
                <button
                  onClick={() => navigate("/my-leaves")}
                  style={{
                    padding: "0.9rem 1rem",
                    borderRadius: "0.75rem",
                    border: "none",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.55rem",
                    cursor: "pointer",
                    background:
                      "linear-gradient(135deg,#3b82f6 0%,#2563eb 100%)",
                    color: "#fff",
                  }}
                >
                  <i className="fas fa-history"></i>Leave History
                </button>
                <button
                  onClick={() => navigate("/files")}
                  style={{
                    padding: "0.9rem 1rem",
                    borderRadius: "0.75rem",
                    border: "none",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.55rem",
                    cursor: "pointer",
                    background:
                      "linear-gradient(135deg,#f59e0b 0%,#d97706 100%)",
                    color: "#fff",
                  }}
                >
                  <i className="fas fa-file-alt"></i>Documents
                </button>

                {/* Journey Quick Action — field employees only */}
                {journeyData !== null && (
                  <button
                    onClick={async () => {
                      if (journeyData?.canStartJourney) {
                        setJourneyLoading(true);
                        try {
                          await api.post('/api/journey/start');
                          const r = await api.get('/api/journey/today');
                          setJourneyData(r.data);
                          toast.success('🚀 Journey started!');
                        } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
                        finally { setJourneyLoading(false); }
                      } else if (journeyData?.journey?.status === 'ACTIVE') {
                        setJourneyLoading(true);
                        try {
                          await api.post('/api/journey/end');
                          const r = await api.get('/api/journey/today');
                          setJourneyData(r.data);
                          toast.success('🏁 Journey ended!');
                        } catch (e) { toast.error(e.response?.data?.message || 'Failed'); }
                        finally { setJourneyLoading(false); }
                      } else {
                        navigate('/field-visits');
                      }
                    }}
                    disabled={journeyLoading}
                    style={{
                      padding: "0.9rem 1rem",
                      borderRadius: "0.75rem",
                      border: "none",
                      fontWeight: 600,
                      fontSize: "0.85rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.55rem",
                      cursor: "pointer",
                      background: journeyData?.journey?.status === 'ACTIVE'
                        ? "linear-gradient(135deg,#ef4444 0%,#dc2626 100%)"
                        : "linear-gradient(135deg,#10b981 0%,#059669 100%)",
                      color: "#fff",
                      position: 'relative'
                    }}
                  >
                    {journeyLoading
                      ? <span className="spinner-border spinner-border-sm" />
                      : <i className={`fas fa-${journeyData?.journey?.status === 'ACTIVE' ? 'stop-circle' : 'route'}`}></i>}
                    {journeyData?.journey?.status === 'ACTIVE'
                      ? `End Journey · ${journeyData.journey.totalDistanceKm}km`
                      : journeyData?.canStartJourney
                        ? 'Start Journey'
                        : journeyData?.journey?.status === 'COMPLETED'
                          ? `Journey Done · ${journeyData.journey.totalDistanceKm}km`
                          : 'My Journey'}
                    {journeyData?.journey?.status === 'ACTIVE' && (
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff', position: 'absolute', top: 8, right: 8, animation: 'pulse 1.5s infinite' }} />
                    )}
                  </button>
                )}
              </div>
            </Card.Body>
          </Card>

          {/* Stats Grid */}
          <div className="stats-grid">
            <div className="stat-card">
              <div
                className="stat-icon"
                style={{
                  background:
                    "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                }}
              >
                <i className="fas fa-calendar-check"></i>
              </div>
              <div className="stat-value">
                {dashboardData.balances?.reduce(
                  (sum, b) => sum + (b.available || 0),
                  0,
                ) || 0}
              </div>
              <div className="stat-label">Total Leave Balance</div>
            </div>
            <div className="stat-card">
              <div
                className="stat-icon"
                style={{
                  background:
                    "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                }}
              >
                <i className="fas fa-clock"></i>
              </div>
              <div className="stat-value">
                {dashboardData.balances?.reduce(
                  (sum, b) => sum + (b.pending || 0),
                  0,
                ) || 0}
              </div>
              <div className="stat-label">Pending Approvals</div>
            </div>
            <div className="stat-card">
              <div
                className="stat-icon"
                style={{
                  background:
                    "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                }}
              >
                <i className="fas fa-umbrella-beach"></i>
              </div>
              <div className="stat-value">
                {holidays.filter((h) => new Date(h.date) >= new Date())
                  .length || 0}
              </div>
              <div className="stat-label">Upcoming Holidays</div>
            </div>
            <div className="stat-card">
              <div
                className="stat-icon"
                style={{
                  background:
                    "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
                }}
              >
                <i className="fas fa-bullhorn"></i>
              </div>
              <div className="stat-value">{announcements.length || 0}</div>
              <div className="stat-label">Active Announcements</div>
            </div>
          </div>

          <Row className="mb-4">
            <Col md={6}>
              <Card className="modern-card h-100">
                <Card.Header>
                  <i className="fas fa-comments me-2"></i>Daily Updates
                </Card.Header>
                <Card.Body className="p-0">
                  <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                    <DailyUpdates />
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} className="d-none d-md-block">
              <Card className="modern-card h-100">
                <Card.Header>
                  <i className="fas fa-bullhorn me-2"></i>Latest Announcements
                </Card.Header>
                <Card.Body className="p-0">
                  <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                    {announcements.length > 0 ? (
                      announcements.slice(0, 5).map((ann) => (
                        <div key={ann._id} className="announcement-item">
                          <div
                            className="announcement-icon"
                            style={{
                              background:
                                ann.priority === "HIGH"
                                  ? "#ef4444"
                                  : ann.priority === "MEDIUM"
                                    ? "#f59e0b"
                                    : "#3b82f6",
                            }}
                          >
                            <i className="fas fa-bullhorn"></i>
                          </div>
                          <div className="announcement-content">
                            <div className="d-flex justify-content-between align-items-start mb-1">
                              <div className="announcement-title">
                                {ann.title}
                              </div>
                              <Badge
                                bg={
                                  ann.priority === "HIGH"
                                    ? "danger"
                                    : ann.priority === "MEDIUM"
                                      ? "warning"
                                      : "info"
                                }
                                style={{ fontSize: "0.7rem" }}
                              >
                                {ann.priority}
                              </Badge>
                            </div>
                            <div className="announcement-text">
                              {ann.content}
                            </div>
                            <div className="announcement-meta">
                              <i className="fas fa-clock me-1"></i>
                              {new Date(ann.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">
                        <div className="empty-icon">
                          <i className="fas fa-bullhorn"></i>
                        </div>
                        <div className="empty-text">No announcements</div>
                      </div>
                    )}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Row className="mb-4">
            <Col md={6}>
              <Card className="modern-card h-100">
                <Card.Header>
                  <i className="fas fa-chart-pie me-2"></i>Leave Balances
                </Card.Header>
                <Card.Body>
                  <div className="balance-grid">
                    {dashboardData.balances
                      ?.filter((balance) => balance.leaveTypeId !== null)
                      .map((balance) => (
                        <div key={balance._id} className="balance-card">
                          <div className="d-flex align-items-center justify-content-between mb-2">
                            <div className="balance-type">
                              {balance.leaveTypeId?.name}
                            </div>
                            <div
                              className="rounded-circle"
                              style={{
                                width: "12px",
                                height: "12px",
                                backgroundColor: balance.leaveTypeId?.color,
                              }}
                            ></div>
                          </div>
                          <div className="balance-value">
                            {balance.available}
                          </div>
                          <div className="balance-details">
                            <span style={{ color: "#64748b" }}>
                              Used: <strong>{balance.used}</strong>
                            </span>
                            <span style={{ color: "#f59e0b" }}>
                              Pending: <strong>{balance.pending}</strong>
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Upcoming Holidays, Files & Quick Links */}
          <Row className="mb-4">
            {dashboardData.birthdaysToday?.length > 0 && (
              <Col md={12} className="mb-3">
                <Card
                  className="modern-card"
                  style={{
                    background:
                      "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
                    border: "none",
                  }}
                >
                  <Card.Body className="p-3">
                    <div className="d-flex align-items-center">
                      <div className="me-3" style={{ fontSize: "2rem" }}>
                        🎉
                      </div>
                      <div className="flex-grow-1">
                        <h6 className="mb-1" style={{ color: "#92400e" }}>
                          <i className="fas fa-birthday-cake me-2"></i>
                          Birthday Today!
                        </h6>
                        <p className="mb-0" style={{ color: "#78350f" }}>
                          {dashboardData.birthdaysToday.map((emp, idx) => (
                            <span key={emp._id}>
                              <strong>
                                {emp.firstName} {emp.lastName}
                              </strong>
                              {idx < dashboardData.birthdaysToday.length - 1 &&
                                ", "}
                            </span>
                          ))}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="warning"
                        style={{ fontWeight: "600" }}
                      >
                        <i className="fas fa-gift me-1"></i>Send Wishes
                      </Button>
                    </div>
                  </Card.Body>
                </Card>
              </Col>
            )}
            <Col md={4}>
              <Card className="modern-card h-100">
                <Card.Header>
                  <i className="fas fa-calendar-alt me-2 text-success"></i>
                  Upcoming Holidays
                </Card.Header>
                <Card.Body style={{ maxHeight: "300px", overflowY: "auto" }}>
                  {holidays
                    .filter((h) => new Date(h.date) >= new Date())
                    .slice(0, 5)
                    .map((holiday) => (
                      <div
                        key={holiday._id}
                        className="d-flex justify-content-between align-items-center mb-3 p-2 rounded"
                        style={{
                          backgroundColor: "#f0fdf4",
                          border: "1px solid #86efac",
                        }}
                      >
                        <div className="flex-grow-1">
                          <div
                            className="fw-bold"
                            style={{ fontSize: "0.9rem" }}
                          >
                            {holiday.name}
                          </div>
                          <small className="text-muted">
                            {new Date(holiday.date).toLocaleDateString(
                              "en-US",
                              {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </small>
                        </div>
                        <Badge
                          bg={holiday.type === "FESTIVAL" ? "warning" : "info"}
                        >
                          {holiday.type}
                        </Badge>
                      </div>
                    ))}
                  {holidays.filter((h) => new Date(h.date) >= new Date())
                    .length === 0 && (
                    <p className="text-muted mb-0 text-center py-3">
                      No upcoming holidays
                    </p>
                  )}
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="modern-card h-100">
                <Card.Header>
                  <i className="fas fa-file me-2 text-primary"></i>Recent
                  Documents
                </Card.Header>
                <Card.Body style={{ maxHeight: "300px", overflowY: "auto" }}>
                  {files.length > 0 ? (
                    files.slice(0, 5).map((file) => (
                      <div
                        key={file._id}
                        className="d-flex justify-content-between align-items-center mb-3 p-2 rounded"
                        style={{
                          backgroundColor: "#eff6ff",
                          border: "1px solid #93c5fd",
                        }}
                      >
                        <div className="flex-grow-1" style={{ minWidth: 0 }}>
                          <div
                            className="fw-bold text-truncate"
                            style={{ fontSize: "0.9rem" }}
                          >
                            {file.name}
                          </div>
                          <small className="text-muted">{file.category}</small>
                        </div>
                        <Button
                          size="sm"
                          variant="outline-primary"
                          href={`/api/files/download/${file._id}`}
                          style={{ minWidth: "36px" }}
                        >
                          <i className="fas fa-download"></i>
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted mb-0 text-center py-3">
                      No documents available
                    </p>
                  )}
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="modern-card h-100">
                <Card.Header className="d-flex justify-content-between align-items-center">
                  <span>
                    <i className="fas fa-star me-2 text-warning"></i>Quick Links
                  </span>
                  <Button
                    size="sm"
                    variant="outline-primary"
                    onClick={() => setShowFavoriteModal(true)}
                  >
                    <i className="fas fa-plus"></i>
                  </Button>
                </Card.Header>
                <Card.Body style={{ maxHeight: "300px", overflowY: "auto" }}>
                  {favorites.length > 0 ? (
                    <div className="d-flex flex-column gap-2">
                      {favorites.map((fav) => (
                        <a
                          key={fav._id}
                          href={fav.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="d-flex align-items-center p-2 rounded text-decoration-none"
                          style={{
                            backgroundColor: "#fef3c7",
                            border: "1px solid #fbbf24",
                            color: "#92400e",
                          }}
                        >
                          {fav.icon && (
                            <i className={`fas fa-${fav.icon} me-2`}></i>
                          )}
                          <span className="fw-semibold">{fav.title}</span>
                          <i
                            className="fas fa-external-link-alt ms-auto"
                            style={{ fontSize: "0.75rem" }}
                          ></i>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted mb-0 text-center py-3">
                      No quick links added
                    </p>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Row>
            <Col md={6}>
              <Card className="modern-card h-100">
                <Card.Header className="d-flex align-items-center">
                  <i className="fas fa-calendar-plus me-2 text-success"></i>
                  Upcoming Leaves
                </Card.Header>
                <Card.Body>
                  {dashboardData.upcomingLeaves?.length > 0 ? (
                    <div className="table-responsive">
                      <Table hover className="mb-0">
                        <tbody>
                          {dashboardData.upcomingLeaves.map((leave) => (
                            <tr key={leave._id}>
                              <td>
                                <div className="d-flex align-items-center">
                                  <div
                                    className="rounded me-2"
                                    style={{
                                      width: "4px",
                                      height: "30px",
                                      backgroundColor:
                                        leave.leaveTypeId?.color || "#6366f1",
                                    }}
                                  ></div>
                                  <div>
                                    <div className="fw-semibold">
                                      {leave.leaveTypeId?.name}
                                    </div>
                                    <small className="text-muted">
                                      {new Date(
                                        leave.startDate,
                                      ).toLocaleDateString()}
                                    </small>
                                  </div>
                                </div>
                              </td>
                              <td className="text-end">
                                <Badge
                                  bg="light"
                                  text="dark"
                                  className="badge-modern"
                                >
                                  {leave.days} days
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <i
                        className="fas fa-calendar-times text-muted fs-1 mb-3"
                        style={{ color: "#94a3b8" }}
                      ></i>
                      <p className="text-muted mb-0">No upcoming leaves</p>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>

            <Col md={6}>
              <Card className="modern-card h-100">
                <Card.Header className="d-flex align-items-center">
                  <i className="fas fa-history me-2 text-info"></i>
                  Recent Leave History
                </Card.Header>
                <Card.Body>
                  {dashboardData.recentLeaves?.length > 0 ? (
                    <div className="table-responsive">
                      <Table hover className="mb-0">
                        <tbody>
                          {dashboardData.recentLeaves
                            .slice(0, 5)
                            .map((leave) => (
                              <tr key={leave._id}>
                                <td>
                                  <div className="d-flex align-items-center">
                                    <div
                                      className="rounded me-2"
                                      style={{
                                        width: "4px",
                                        height: "30px",
                                        backgroundColor:
                                          leave.leaveTypeId?.color || "#6366f1",
                                      }}
                                    ></div>
                                    <div>
                                      <div className="fw-semibold">
                                        {leave.leaveTypeId?.name}
                                      </div>
                                      <small className="text-muted">
                                        {new Date(
                                          leave.startDate,
                                        ).toLocaleDateString()}
                                      </small>
                                    </div>
                                  </div>
                                </td>
                                <td className="text-end">
                                  {getStatusBadge(leave.status)}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <i
                        className="fas fa-file-alt text-muted fs-1 mb-3"
                        style={{ color: "#94a3b8" }}
                      ></i>
                      <p className="text-muted mb-0">No leave history</p>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </>
      )}

      {user?.role === "MANAGER" && dashboardData && (
        <>
          {/* Daily Updates & Discussion */}
          <Row className="mb-4">
            <Col md={6}>
              <Card className="modern-card h-100">
                <Card.Header>
                  <i className="fas fa-comments me-2"></i>Daily Updates
                </Card.Header>
                <Card.Body className="p-0">
                  <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                    <DailyUpdates />
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Row className="mb-4">
            <Col md={6}>
              <Card className="dashboard-card h-100">
                <Card.Header className="d-flex align-items-center">
                  <i className="fas fa-tasks me-2 text-warning"></i>
                  Pending Approvals (
                  {dashboardData.pendingApprovals?.length || 0})
                </Card.Header>
                <Card.Body>
                  {dashboardData.pendingApprovals?.length > 0 ? (
                    <div className="table-responsive">
                      <Table hover className="mb-0">
                        <tbody>
                          {dashboardData.pendingApprovals
                            .slice(0, 5)
                            .map((request) => (
                              <tr key={request._id}>
                                <td>
                                  <div className="fw-semibold">
                                    {request.userId?.firstName}{" "}
                                    {request.userId?.lastName}
                                  </div>
                                  <small className="text-muted">
                                    {request.leaveTypeId?.name}
                                  </small>
                                </td>
                                <td className="text-end">
                                  <div className="fw-semibold">
                                    {request.days} days
                                  </div>
                                  <small className="text-muted">
                                    {new Date(
                                      request.startDate,
                                    ).toLocaleDateString()}
                                  </small>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <i className="fas fa-check-circle text-success fs-1 mb-3"></i>
                      <p className="text-muted mb-0">No pending approvals</p>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>

            <Col md={6}>
              <Card className="dashboard-card h-100">
                <Card.Header className="d-flex align-items-center">
                  <i className="fas fa-users me-2 text-primary"></i>
                  Team Summary
                </Card.Header>
                <Card.Body>
                  <div className="row text-center">
                    <div className="col-6">
                      <div className="dashboard-stat">
                        {dashboardData.teamMembers?.length || 0}
                      </div>
                      <p className="text-muted mb-0">Team Members</p>
                    </div>
                    <div className="col-6">
                      <div className="dashboard-stat">
                        {dashboardData.teamCalendar?.length || 0}
                      </div>
                      <p className="text-muted mb-0">Upcoming Leaves</p>
                    </div>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </>
      )}

      {["HR", "ADMIN"].includes(user?.role) && dashboardData && (
        <>
          {/* Admin Controls */}
          <Card className="modern-card mb-4">
            <Card.Header>Admin Controls</Card.Header>
            <Card.Body>
              <div className="dash-admin-actions">
                <button
                  onClick={() => setShowAnnouncementModal(true)}
                  style={{
                    padding: "0.9rem 1rem",
                    borderRadius: "0.75rem",
                    border: "none",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.55rem",
                    cursor: "pointer",
                    background:
                      "linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)",
                    color: "#fff",
                  }}
                >
                  <i className="fas fa-bullhorn"></i>Add Announcement
                </button>
                <button
                  onClick={() => setShowHolidayModal(true)}
                  style={{
                    padding: "0.9rem 1rem",
                    borderRadius: "0.75rem",
                    border: "none",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.55rem",
                    cursor: "pointer",
                    background:
                      "linear-gradient(135deg,#10b981 0%,#059669 100%)",
                    color: "#fff",
                  }}
                >
                  <i className="fas fa-calendar-plus"></i>Add Holiday
                </button>
                <button
                  onClick={() => setShowFileModal(true)}
                  style={{
                    padding: "0.9rem 1rem",
                    borderRadius: "0.75rem",
                    border: "none",
                    fontWeight: 600,
                    fontSize: "0.85rem",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.55rem",
                    cursor: "pointer",
                    background:
                      "linear-gradient(135deg,#3b82f6 0%,#2563eb 100%)",
                    color: "#fff",
                  }}
                >
                  <i className="fas fa-upload"></i>Upload File
                </button>
              </div>
            </Card.Body>
          </Card>

          {/* Overview Stats */}
          <div className="stats-grid">
            <div className="stat-card">
              <div
                className="stat-icon"
                style={{
                  background:
                    "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                }}
              >
                <i className="fas fa-users"></i>
              </div>
              <div className="stat-value">{dashboardData.totalEmployees}</div>
              <div className="stat-label">Total Employees</div>
              <small style={{ color: "#10b981", fontSize: "0.8rem" }}>
                <i className="fas fa-check-circle me-1"></i>
                {dashboardData.activeEmployees} Active
              </small>
            </div>
            <div className="stat-card">
              <div
                className="stat-icon"
                style={{
                  background:
                    "linear-gradient(135deg, #f59e0b 0%, #d97706 100%)",
                }}
              >
                <i className="fas fa-user-clock"></i>
              </div>
              <div className="stat-value">
                {dashboardData.employeesOnLeaveToday}
              </div>
              <div className="stat-label">On Leave Today</div>
            </div>
            <div className="stat-card">
              <div
                className="stat-icon"
                style={{
                  background:
                    "linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)",
                }}
              >
                <i className="fas fa-clock"></i>
              </div>
              <div className="stat-value">{dashboardData.pendingApprovals}</div>
              <div className="stat-label">Pending Approvals</div>
            </div>
            <div className="stat-card">
              <div
                className="stat-icon"
                style={{
                  background:
                    "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                }}
              >
                <i className="fas fa-file-alt"></i>
              </div>
              <div className="stat-value">
                {dashboardData.pendingDocVerifications || 0}
              </div>
              <div className="stat-label">Pending Verifications</div>
            </div>
          </div>

          {/* Department Distribution & Announcements */}
          <Row className="mb-4">
            <Col md={6}>
              <Card className="modern-card h-100">
                <Card.Header>
                  <i className="fas fa-comments me-2"></i>Daily Updates
                </Card.Header>
                <Card.Body className="p-0">
                  <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                    <DailyUpdates />
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6} className="d-none d-md-block">
              <Card className="modern-card h-100">
                <Card.Header>
                  <i className="fas fa-bullhorn me-2"></i>Latest Announcements
                </Card.Header>
                <Card.Body className="p-0">
                  <div style={{ maxHeight: "400px", overflowY: "auto" }}>
                    {announcements.length > 0 ? (
                      announcements.slice(0, 5).map((ann) => (
                        <div key={ann._id} className="announcement-item">
                          <div
                            className="announcement-icon"
                            style={{
                              background:
                                ann.priority === "HIGH"
                                  ? "#ef4444"
                                  : ann.priority === "MEDIUM"
                                    ? "#f59e0b"
                                    : "#3b82f6",
                            }}
                          >
                            <i className="fas fa-bullhorn"></i>
                          </div>
                          <div className="announcement-content">
                            <div className="d-flex justify-content-between align-items-start mb-1">
                              <div className="announcement-title">
                                {ann.title}
                              </div>
                              <Badge
                                bg={
                                  ann.priority === "HIGH"
                                    ? "danger"
                                    : ann.priority === "MEDIUM"
                                      ? "warning"
                                      : "info"
                                }
                                style={{ fontSize: "0.7rem" }}
                              >
                                {ann.priority}
                              </Badge>
                            </div>
                            <div className="announcement-text">
                              {ann.content}
                            </div>
                            <div className="announcement-meta">
                              <i className="fas fa-clock me-1"></i>
                              {new Date(ann.createdAt).toLocaleDateString()}
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="empty-state">
                        <div className="empty-icon">
                          <i className="fas fa-bullhorn"></i>
                        </div>
                        <div className="empty-text">No announcements</div>
                      </div>
                    )}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Row className="mb-4">
            <Col md={6}>
              <Card className="modern-card h-100">
                <Card.Header className="d-flex justify-content-between align-items-center">
                  <span>
                    <i className="fas fa-sitemap me-2"></i>Department
                    Distribution
                  </span>
                  <Badge style={{ background: "#6366f1", fontSize: "0.75rem" }}>
                    {dashboardData.departmentStats?.length || 0} Total
                  </Badge>
                </Card.Header>
                <Card.Body>
                  {dashboardData.departmentStats?.length > 0 ? (
                    <div className="dept-grid">
                      {dashboardData.departmentStats.map((dept, index) => {
                        const colors = [
                          { bg: "#667eea", light: "#e0e7ff" },
                          { bg: "#f093fb", light: "#fce7f3" },
                          { bg: "#4facfe", light: "#dbeafe" },
                          { bg: "#43e97b", light: "#d1fae5" },
                          { bg: "#fa709a", light: "#ffe4e6" },
                          { bg: "#30cfd0", light: "#cffafe" },
                        ];
                        const color = colors[index % colors.length];
                        return (
                          <div
                            key={index}
                            className="dept-card"
                            style={{
                              borderColor: color.bg,
                              background: color.light,
                            }}
                            onClick={() =>
                              dept.departmentId &&
                              navigate(`/departments/${dept.departmentId}`)
                            }
                          >
                            <div
                              className="dept-icon"
                              style={{ background: color.bg }}
                            >
                              <i className="fas fa-users"></i>
                            </div>
                            <div
                              className="dept-count"
                              style={{ color: color.bg }}
                            >
                              {dept.count}
                            </div>
                            <div className="dept-name">
                              {dept._id || "Unassigned"}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <div className="empty-icon">
                        <i className="fas fa-sitemap"></i>
                      </div>
                      <div className="empty-text">No department data</div>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Recent Activities & Leave Statistics */}
          <Row className="mb-4">
            <Col md={6}>
              <Card className="modern-card h-100">
                <Card.Header>
                  <i className="fas fa-history me-2"></i>Recent Activities
                </Card.Header>
                <Card.Body style={{ maxHeight: "300px", overflowY: "auto" }}>
                  {dashboardData.recentActivities?.length > 0 ? (
                    dashboardData.recentActivities.map((activity) => (
                      <div
                        key={activity._id}
                        className="d-flex align-items-center mb-3 pb-3 border-bottom"
                      >
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center me-3"
                          style={{
                            width: "40px",
                            height: "40px",
                            backgroundColor: "#f3f4f6",
                          }}
                        >
                          <i className="fas fa-calendar-alt text-primary"></i>
                        </div>
                        <div className="flex-grow-1">
                          <div className="fw-semibold">
                            {activity.userId?.firstName}{" "}
                            {activity.userId?.lastName}
                          </div>
                          <small className="text-muted">
                            Applied for {activity.leaveTypeId?.name} -{" "}
                            {activity.days} days
                          </small>
                        </div>
                        {getStatusBadge(activity.status)}
                      </div>
                    ))
                  ) : (
                    <p className="text-muted mb-0">No recent activities</p>
                  )}
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="modern-card h-100">
                <Card.Header>
                  <i className="fas fa-chart-bar me-2"></i>Leave Statistics
                </Card.Header>
                <Card.Body>
                  {dashboardData.leaveStats?.map((stat) => {
                    const total = dashboardData.leaveStats.reduce(
                      (sum, s) => sum + s.count,
                      0,
                    );
                    const percentage =
                      total > 0 ? Math.round((stat.count / total) * 100) : 0;
                    return (
                      <div key={stat._id} className="mb-3">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="fw-semibold">
                            <i
                              className={`fas fa-${getStatusIcon(stat._id)} me-2`}
                              style={{ color: "#6366f1" }}
                            ></i>
                            {stat._id.replace("_", " ")}
                          </span>
                          <span>
                            <Badge bg="light" text="dark" className="me-1">
                              {stat.count} requests
                            </Badge>
                            <Badge bg="primary">{stat.totalDays} days</Badge>
                          </span>
                        </div>
                        <div
                          className="progress"
                          style={{ height: "8px", backgroundColor: "#e2e8f0" }}
                        >
                          <div
                            className="progress-bar"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: "#6366f1",
                              transition: "width 0.6s ease",
                            }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Birthdays, New Hires & Holidays */}
          <Row className="mb-4">
            <Col md={4}>
              <Card className="modern-card h-100">
                <Card.Header>
                  <i className="fas fa-birthday-cake me-2"></i>Upcoming
                  Birthdays
                </Card.Header>
                <Card.Body style={{ maxHeight: "300px", overflowY: "auto" }}>
                  {dashboardData.upcomingBirthdays?.length > 0 ? (
                    dashboardData.upcomingBirthdays.map((emp) => (
                      <div
                        key={emp._id}
                        className="d-flex align-items-center mb-3 p-2 rounded"
                        style={{
                          backgroundColor: "#fef3c7",
                          border: "1px solid #fbbf24",
                        }}
                      >
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center me-3"
                          style={{
                            width: "45px",
                            height: "45px",
                            backgroundColor: "#f59e0b",
                            color: "white",
                            fontWeight: "bold",
                            fontSize: "1.1rem",
                          }}
                        >
                          {emp.firstName?.charAt(0)}
                          {emp.lastName?.charAt(0)}
                        </div>
                        <div className="flex-grow-1">
                          <div className="fw-bold">
                            {emp.firstName} {emp.lastName}
                          </div>
                          <small className="text-muted">{emp.department}</small>
                        </div>
                        <Badge bg="warning">
                          {new Date(emp.dateOfBirth).toLocaleDateString(
                            "en-US",
                            { month: "short", day: "numeric" },
                          )}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted mb-0 text-center py-3">
                      No upcoming birthdays
                    </p>
                  )}
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="modern-card h-100">
                <Card.Header>
                  <i className="fas fa-user-plus me-2"></i>New Hires (Last 30
                  days)
                </Card.Header>
                <Card.Body style={{ maxHeight: "300px", overflowY: "auto" }}>
                  {dashboardData.newHires?.length > 0 ? (
                    dashboardData.newHires.map((emp) => (
                      <div
                        key={emp._id}
                        className="d-flex align-items-center mb-3 p-2 rounded"
                        style={{
                          backgroundColor: "#d1fae5",
                          border: "1px solid #10b981",
                        }}
                      >
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center me-3"
                          style={{
                            width: "45px",
                            height: "45px",
                            backgroundColor: "#10b981",
                            color: "white",
                            fontWeight: "bold",
                            fontSize: "1.1rem",
                          }}
                        >
                          {emp.firstName?.charAt(0)}
                          {emp.lastName?.charAt(0)}
                        </div>
                        <div className="flex-grow-1">
                          <div className="fw-bold">
                            {emp.firstName} {emp.lastName}
                          </div>
                          <small className="text-muted">{emp.department}</small>
                        </div>
                        <Badge bg="success">
                          {new Date(emp.joinDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </Badge>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted mb-0 text-center py-3">
                      No new hires
                    </p>
                  )}
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="modern-card h-100">
                <Card.Header>
                  <i className="fas fa-calendar-alt me-2"></i>Upcoming Holidays
                </Card.Header>
                <Card.Body style={{ maxHeight: "300px", overflowY: "auto" }}>
                  {holidays
                    .filter((h) => new Date(h.date) >= new Date())
                    .slice(0, 5)
                    .map((holiday) => (
                      <div key={holiday._id} className="holiday-item">
                        <div className="holiday-info">
                          <div className="holiday-name">{holiday.name}</div>
                          <div className="holiday-date">
                            {new Date(holiday.date).toLocaleDateString(
                              "en-US",
                              {
                                weekday: "short",
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </div>
                        </div>
                        <Badge
                          bg={
                            holiday.type === "FESTIVAL"
                              ? "warning"
                              : holiday.type === "NATIONAL"
                                ? "danger"
                                : "info"
                          }
                        >
                          {holiday.type}
                        </Badge>
                      </div>
                    ))}
                  {holidays.filter((h) => new Date(h.date) >= new Date())
                    .length === 0 && (
                    <p className="text-muted mb-0 text-center py-3">
                      No upcoming holidays
                    </p>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </>
      )}
      {/* Modals */}
      <Modal
        show={showFavoriteModal}
        onHide={() => setShowFavoriteModal(false)}
      >
        <Modal.Header closeButton>
          <Modal.Title>Add Quick Link</Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleAddFavorite}>
          <Modal.Body>
            <Form.Group className="mb-3">
              <Form.Label>Title</Form.Label>
              <Form.Control
                type="text"
                value={favoriteForm.title}
                onChange={(e) =>
                  setFavoriteForm({ ...favoriteForm, title: e.target.value })
                }
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>URL</Form.Label>
              <Form.Control
                type="url"
                value={favoriteForm.url}
                onChange={(e) =>
                  setFavoriteForm({ ...favoriteForm, url: e.target.value })
                }
                required
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Icon (FontAwesome class)</Form.Label>
              <Form.Control
                type="text"
                value={favoriteForm.icon}
                onChange={(e) =>
                  setFavoriteForm({ ...favoriteForm, icon: e.target.value })
                }
                placeholder="e.g., link, external-link-alt"
              />
            </Form.Group>
          </Modal.Body>
          <Modal.Footer>
            <Button
              variant="secondary"
              onClick={() => setShowFavoriteModal(false)}
            >
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Add Link
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>

      {["HR", "ADMIN"].includes(user?.role) && (
        <>
          <Modal
            show={showAnnouncementModal}
            onHide={() => setShowAnnouncementModal(false)}
            size="lg"
          >
            <Modal.Header closeButton>
              <Modal.Title>Add Announcement</Modal.Title>
            </Modal.Header>
            <Form onSubmit={handleAddAnnouncement}>
              <Modal.Body>
                <Row>
                  <Col md={8}>
                    <Form.Group className="mb-3">
                      <Form.Label>Title</Form.Label>
                      <Form.Control
                        type="text"
                        value={announcementForm.title}
                        onChange={(e) =>
                          setAnnouncementForm({
                            ...announcementForm,
                            title: e.target.value,
                          })
                        }
                        required
                      />
                    </Form.Group>
                  </Col>
                  <Col md={4}>
                    <Form.Group className="mb-3">
                      <Form.Label>Priority</Form.Label>
                      <Form.Select
                        value={announcementForm.priority}
                        onChange={(e) =>
                          setAnnouncementForm({
                            ...announcementForm,
                            priority: e.target.value,
                          })
                        }
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                      </Form.Select>
                    </Form.Group>
                  </Col>
                </Row>
                <Form.Group className="mb-3">
                  <Form.Label>Content</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    value={announcementForm.content}
                    onChange={(e) =>
                      setAnnouncementForm({
                        ...announcementForm,
                        content: e.target.value,
                      })
                    }
                    required
                  />
                </Form.Group>
                <Row>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Target Roles</Form.Label>
                      <div>
                        {["EMPLOYEE", "MANAGER", "HR", "ADMIN"].map((role) => (
                          <Form.Check
                            key={role}
                            type="checkbox"
                            label={role}
                            checked={announcementForm.targetRoles.includes(
                              role,
                            )}
                            onChange={(e) =>
                              handleRoleChange(role, e.target.checked)
                            }
                          />
                        ))}
                      </div>
                      <Form.Text className="text-muted">
                        Leave empty to target all roles
                      </Form.Text>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Expiry Date (Optional)</Form.Label>
                      <Form.Control
                        type="date"
                        value={announcementForm.expiryDate}
                        onChange={(e) =>
                          setAnnouncementForm({
                            ...announcementForm,
                            expiryDate: e.target.value,
                          })
                        }
                      />
                      <Form.Text className="text-muted">
                        Leave empty for no expiry
                      </Form.Text>
                    </Form.Group>
                  </Col>
                </Row>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="secondary"
                  onClick={() => setShowAnnouncementModal(false)}
                >
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Add Announcement
                </Button>
              </Modal.Footer>
            </Form>
          </Modal>

          <Modal
            show={showHolidayModal}
            onHide={() => setShowHolidayModal(false)}
          >
            <Modal.Header closeButton>
              <Modal.Title>Add Holiday</Modal.Title>
            </Modal.Header>
            <Form onSubmit={handleAddHoliday}>
              <Modal.Body>
                <Form.Group className="mb-3">
                  <Form.Label>Holiday Name</Form.Label>
                  <Form.Control
                    type="text"
                    value={holidayForm.name}
                    onChange={(e) =>
                      setHolidayForm({ ...holidayForm, name: e.target.value })
                    }
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={holidayForm.date}
                    onChange={(e) =>
                      setHolidayForm({ ...holidayForm, date: e.target.value })
                    }
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Type</Form.Label>
                  <Form.Select
                    value={holidayForm.type}
                    onChange={(e) =>
                      setHolidayForm({ ...holidayForm, type: e.target.value })
                    }
                  >
                    <option value="FESTIVAL">Festival</option>
                    <option value="NATIONAL">National</option>
                    <option value="COMPANY">Company</option>
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={holidayForm.description}
                    onChange={(e) =>
                      setHolidayForm({
                        ...holidayForm,
                        description: e.target.value,
                      })
                    }
                  />
                </Form.Group>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="secondary"
                  onClick={() => setShowHolidayModal(false)}
                >
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Add Holiday
                </Button>
              </Modal.Footer>
            </Form>
          </Modal>

          <Modal show={showFileModal} onHide={() => setShowFileModal(false)}>
            <Modal.Header closeButton>
              <Modal.Title>Upload File</Modal.Title>
            </Modal.Header>
            <Form onSubmit={handleFileUpload}>
              <Modal.Body>
                <Form.Group className="mb-3">
                  <Form.Label>File</Form.Label>
                  <Form.Control
                    type="file"
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Type</Form.Label>
                  <Form.Select
                    value={fileForm.type}
                    onChange={(e) =>
                      setFileForm({ ...fileForm, type: e.target.value })
                    }
                  >
                    <option value="ORGANIZATION">Organization File</option>
                    <option value="EMPLOYEE">Employee File</option>
                  </Form.Select>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Category</Form.Label>
                  <Form.Control
                    type="text"
                    value={fileForm.category}
                    onChange={(e) =>
                      setFileForm({ ...fileForm, category: e.target.value })
                    }
                    placeholder="e.g., Policy, Handbook, Form"
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={2}
                    value={fileForm.description}
                    onChange={(e) =>
                      setFileForm({ ...fileForm, description: e.target.value })
                    }
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Check
                    type="checkbox"
                    label="Make public to all employees"
                    checked={fileForm.isPublic}
                    onChange={(e) =>
                      setFileForm({ ...fileForm, isPublic: e.target.checked })
                    }
                  />
                </Form.Group>
              </Modal.Body>
              <Modal.Footer>
                <Button
                  variant="secondary"
                  onClick={() => setShowFileModal(false)}
                >
                  Cancel
                </Button>
                <Button variant="primary" type="submit">
                  Upload File
                </Button>
              </Modal.Footer>
            </Form>
          </Modal>
        </>
      )}
    </div>
  );
};

export default Dashboard;
