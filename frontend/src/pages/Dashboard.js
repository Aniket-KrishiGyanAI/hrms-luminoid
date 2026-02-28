import React, { useState, useEffect } from "react";
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

const Dashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [files, setFiles] = useState([]);
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

  useEffect(() => {
    fetchDashboardData();
    fetchAnnouncements();
    fetchHolidays();
    fetchFavorites();
    fetchFiles();
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
      
      // Show notification for new announcements
      if (announcements.length > 0 && newAnnouncements.length > announcements.length) {
        const latestAnnouncement = newAnnouncements[0];
        showAnnouncementNotification(latestAnnouncement);
      }
      
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
    <div className="fade-in-up">
      {/* Motivational Quote for All Users */}
      {dashboardData?.motivationalQuote && (
        <Row className="mb-4">
          <Col>
            <Card
              className="border-0 shadow-sm"
              style={{
                background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)",
                borderRadius: '16px'
              }}
            >
              <Card.Body className="p-4">
                <div className="d-flex align-items-center gap-4">
                  <div
                    className="d-flex align-items-center justify-content-center flex-shrink-0"
                    style={{
                      width: '70px',
                      height: '70px',
                      background: 'rgba(255, 255, 255, 0.15)',
                      borderRadius: '14px',
                      backdropFilter: 'blur(10px)',
                      border: '1px solid rgba(255, 255, 255, 0.2)'
                    }}
                  >
                    {dashboardData.motivationalQuote.icon ? (
                      <i className={`${dashboardData.motivationalQuote.icon} text-white`} style={{ fontSize: '1.8rem', opacity: 0.9 }}></i>
                    ) : (
                      <i className="fas fa-quote-right text-white" style={{ fontSize: '1.8rem', opacity: 0.9 }}></i>
                    )}
                  </div>
                  <div className="flex-grow-1">
                    <p
                      className="mb-2 text-white"
                      style={{
                        fontSize: '1.1rem',
                        fontWeight: 500,
                        lineHeight: 1.6,
                        letterSpacing: '0.3px'
                      }}
                    >
                      {dashboardData.motivationalQuote.quote}
                    </p>
                    <div className="d-flex align-items-center gap-2">
                      <div style={{ width: '35px', height: '2px', background: 'rgba(255, 255, 255, 0.5)' }}></div>
                      <span style={{ fontSize: '0.9rem', fontWeight: 600, color: 'rgba(255, 255, 255, 0.95)' }}>
                        {dashboardData.motivationalQuote.author}
                      </span>
                    </div>
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      )}

      <div className="page-header d-flex align-items-center justify-content-between">
        <div>
          <h1 className="page-title mb-1">
            <i className="fas fa-tachometer-alt me-3"></i>
            Dashboard
          </h1>
          <p className="text-muted mb-0">
            Welcome back, {user?.firstName}! Here's your overview.
          </p>
        </div>
        <div className="text-end">
          <small className="text-muted d-block">Last updated</small>
          <small className="text-primary">{new Date().toLocaleString()}</small>
        </div>
      </div>

      {user?.role === "EMPLOYEE" && dashboardData && (
        <>
          {/* Quick Actions */}
          <Row className="mb-4">
            <Col>
              <Card className="modern-card">
                <Card.Body className="p-3">
                  <div className="d-flex gap-2 flex-wrap justify-content-center">
                    <Button variant="primary" href="/apply-leave" className="btn-modern">
                      <i className="fas fa-calendar-plus me-2"></i>Apply Leave
                    </Button>
                    <Button variant="success" href="/attendance" className="btn-modern">
                      <i className="fas fa-clock me-2"></i>Mark Attendance
                    </Button>
                    <Button variant="info" href="/my-leaves" className="btn-modern">
                      <i className="fas fa-history me-2"></i>Leave History
                    </Button>
                    <Button variant="warning" href="/files" className="btn-modern">
                      <i className="fas fa-file-alt me-2"></i>Documents
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Stats Row */}
          <Row className="mb-4">
            <Col md={3}>
              <Card className="modern-card hover-lift h-100">
                <Card.Body className="text-center">
                  <div className="stats-icon mx-auto mb-3" style={{ backgroundColor: '#10b981' }}>
                    <i className="fas fa-calendar-check"></i>
                  </div>
                  <div className="stats-number">
                    {dashboardData.balances?.reduce((sum, b) => sum + (b.available || 0), 0) || 0}
                  </div>
                  <p className="stats-label mb-0">Total Leave Balance</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="modern-card hover-lift h-100">
                <Card.Body className="text-center">
                  <div className="stats-icon mx-auto mb-3" style={{ backgroundColor: '#f59e0b' }}>
                    <i className="fas fa-clock"></i>
                  </div>
                  <div className="stats-number">
                    {dashboardData.balances?.reduce((sum, b) => sum + (b.pending || 0), 0) || 0}
                  </div>
                  <p className="stats-label mb-0">Pending Approvals</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="modern-card hover-lift h-100">
                <Card.Body className="text-center">
                  <div className="stats-icon mx-auto mb-3" style={{ backgroundColor: '#ef4444' }}>
                    <i className="fas fa-umbrella-beach"></i>
                  </div>
                  <div className="stats-number">
                    {holidays.filter(h => new Date(h.date) >= new Date()).length || 0}
                  </div>
                  <p className="stats-label mb-0">Upcoming Holidays</p>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="modern-card hover-lift h-100">
                <Card.Body className="text-center">
                  <div className="stats-icon mx-auto mb-3" style={{ backgroundColor: '#06b6d4' }}>
                    <i className="fas fa-bullhorn"></i>
                  </div>
                  <div className="stats-number">{announcements.length || 0}</div>
                  <p className="stats-label mb-0">Active Announcements</p>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          <Row className="mb-4">
            <Col md={6}>
              <Card className="widget-card modern-card hover-lift">
                <Card.Header className="border-0 pb-0">
                  <div className="d-flex align-items-center">
                    <div
                      className="rounded-circle d-flex align-items-center justify-content-center me-3"
                      style={{
                        width: "48px",
                        height: "48px",
                        background:
                          "linear-gradient(135deg, var(--primary-500), var(--primary-400))",
                      }}
                    >
                      <i className="fas fa-chart-pie text-white"></i>
                    </div>
                    <div>
                      <h6 className="card-title mb-0">Leave Balances</h6>
                      <small className="text-muted-modern">
                        Your available leaves
                      </small>
                    </div>
                  </div>
                </Card.Header>
                <Card.Body>
                  <Row>
                    {dashboardData.balances
                      ?.filter((balance) => balance.leaveTypeId !== null)
                      .map((balance) => (
                        <Col md={6} key={balance._id} className="mb-3">
                          <div className="stats-card">
                            <div className="d-flex align-items-center justify-content-between mb-2">
                              <h6 className="stats-label mb-0">
                                {balance.leaveTypeId?.name}
                              </h6>
                              <div
                                className="rounded-circle"
                                style={{
                                  width: "12px",
                                  height: "12px",
                                  backgroundColor: balance.leaveTypeId?.color,
                                }}
                              ></div>
                            </div>
                            <div className="stats-number mb-2">
                              {balance.available}
                            </div>
                            <div className="d-flex justify-content-between text-sm">
                              <span className="text-muted">
                                Used: <strong>{balance.used}</strong>
                              </span>
                              <span className="text-warning">
                                Pending: <strong>{balance.pending}</strong>
                              </span>
                            </div>
                          </div>
                        </Col>
                      ))}
                  </Row>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="modern-card h-100">
                <Card.Header>
                  <i className="fas fa-bullhorn me-2 text-info"></i>
                  Latest Announcements
                </Card.Header>
                <Card.Body className="p-0">
                  <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '1rem' }}>
                    {announcements.length > 0 ? (
                      announcements.slice(0, 5).map((ann) => (
                        <div
                          key={ann._id}
                          className="d-flex align-items-start mb-3 pb-3 border-bottom"
                        >
                          <div
                            className="rounded d-flex align-items-center justify-content-center text-white me-2"
                            style={{
                              backgroundColor:
                                ann.priority === "HIGH"
                                  ? "#ef4444"
                                  : ann.priority === "MEDIUM"
                                    ? "#f59e0b"
                                    : "#3b82f6",
                              width: "35px",
                              height: "35px",
                              minWidth: "35px",
                              fontSize: '0.875rem'
                            }}
                          >
                            <i className="fas fa-bullhorn"></i>
                          </div>
                          <div className="flex-grow-1" style={{ minWidth: 0 }}>
                            <div className="d-flex justify-content-between align-items-start mb-1">
                              <h6 className="mb-0 text-truncate" style={{ fontSize: '0.9rem' }}>{ann.title}</h6>
                              <Badge
                                bg={
                                  ann.priority === "HIGH"
                                    ? "danger"
                                    : ann.priority === "MEDIUM"
                                      ? "warning"
                                      : "info"
                                }
                                className="ms-2"
                                style={{ fontSize: '0.7rem' }}
                              >
                                {ann.priority}
                              </Badge>
                            </div>
                            <p className="text-muted mb-1" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                              {ann.content}
                            </p>
                            <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                              <i className="fas fa-clock me-1"></i>
                              {new Date(ann.createdAt).toLocaleDateString()}
                            </small>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4">
                        <i className="fas fa-bullhorn text-muted fs-1 mb-3" style={{ color: '#94a3b8' }}></i>
                        <p className="text-muted mb-0">No announcements</p>
                      </div>
                    )}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Upcoming Holidays, Files & Quick Links */}
          <Row className="mb-4">
            {dashboardData.birthdaysToday?.length > 0 && (
              <Col md={12} className="mb-3">
                <Card className="modern-card" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)', border: 'none' }}>
                  <Card.Body className="p-3">
                    <div className="d-flex align-items-center">
                      <div className="me-3" style={{ fontSize: '2rem' }}>🎉</div>
                      <div className="flex-grow-1">
                        <h6 className="mb-1" style={{ color: '#92400e' }}>
                          <i className="fas fa-birthday-cake me-2"></i>
                          Birthday Today!
                        </h6>
                        <p className="mb-0" style={{ color: '#78350f' }}>
                          {dashboardData.birthdaysToday.map((emp, idx) => (
                            <span key={emp._id}>
                              <strong>{emp.firstName} {emp.lastName}</strong>
                              {idx < dashboardData.birthdaysToday.length - 1 && ', '}
                            </span>
                          ))}
                        </p>
                      </div>
                      <Button size="sm" variant="warning" style={{ fontWeight: '600' }}>
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
                        style={{ backgroundColor: '#f0fdf4', border: '1px solid #86efac' }}
                      >
                        <div className="flex-grow-1">
                          <div className="fw-bold" style={{ fontSize: '0.9rem' }}>{holiday.name}</div>
                          <small className="text-muted">
                            {new Date(holiday.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </small>
                        </div>
                        <Badge bg={holiday.type === "FESTIVAL" ? "warning" : "info"}>
                          {holiday.type}
                        </Badge>
                      </div>
                    ))}
                  {holidays.filter((h) => new Date(h.date) >= new Date()).length === 0 && (
                    <p className="text-muted mb-0 text-center py-3">No upcoming holidays</p>
                  )}
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="modern-card h-100">
                <Card.Header>
                  <i className="fas fa-file me-2 text-primary"></i>Recent Documents
                </Card.Header>
                <Card.Body style={{ maxHeight: "300px", overflowY: "auto" }}>
                  {files.length > 0 ? (
                    files.slice(0, 5).map((file) => (
                      <div
                        key={file._id}
                        className="d-flex justify-content-between align-items-center mb-3 p-2 rounded"
                        style={{ backgroundColor: '#eff6ff', border: '1px solid #93c5fd' }}
                      >
                        <div className="flex-grow-1" style={{ minWidth: 0 }}>
                          <div className="fw-bold text-truncate" style={{ fontSize: '0.9rem' }}>{file.name}</div>
                          <small className="text-muted">{file.category}</small>
                        </div>
                        <Button
                          size="sm"
                          variant="outline-primary"
                          href={`/api/files/download/${file._id}`}
                          style={{ minWidth: '36px' }}
                        >
                          <i className="fas fa-download"></i>
                        </Button>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted mb-0 text-center py-3">No documents available</p>
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
                          style={{ backgroundColor: '#fef3c7', border: '1px solid #fbbf24', color: '#92400e' }}
                        >
                          {fav.icon && (
                            <i className={`fas fa-${fav.icon} me-2`}></i>
                          )}
                          <span className="fw-semibold">{fav.title}</span>
                          <i className="fas fa-external-link-alt ms-auto" style={{ fontSize: '0.75rem' }}></i>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted mb-0 text-center py-3">No quick links added</p>
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
          <Row className="mb-4">
            <Col>
              <Card className="modern-card">
                <Card.Header>Admin Controls</Card.Header>
                <Card.Body>
                  <div className="d-flex gap-2 flex-wrap">
                    <Button
                      variant="primary"
                      onClick={() => setShowAnnouncementModal(true)}
                      className="btn-modern"
                    >
                      <i className="fas fa-bullhorn me-1"></i>Add Announcement
                    </Button>
                    <Button
                      variant="success"
                      onClick={() => setShowHolidayModal(true)}
                      className="btn-modern"
                    >
                      <i className="fas fa-calendar-plus me-1"></i>Add Holiday
                    </Button>
                    <Button
                      variant="info"
                      onClick={() => setShowFileModal(true)}
                      className="btn-modern"
                    >
                      <i className="fas fa-upload me-1"></i>Upload File
                    </Button>
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Overview Stats */}
          <Row className="mb-4">
            <Col md={3}>
              <Card className="modern-card hover-lift h-100">
                <Card.Body className="text-center">
                  <div className="stats-icon mx-auto mb-3" style={{ backgroundColor: '#6366f1' }}>
                    <i className="fas fa-users"></i>
                  </div>
                  <div className="stats-number">{dashboardData.totalEmployees}</div>
                  <p className="stats-label mb-1">Total Employees</p>
                  <div className="d-flex justify-content-center align-items-center gap-2">
                    <small className="text-success">
                      <i className="fas fa-check-circle me-1"></i>
                      {dashboardData.activeEmployees} Active
                    </small>
                    <small className="text-success">
                      <i className="fas fa-arrow-up me-1"></i>
                      +5%
                    </small>
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="modern-card hover-lift h-100">
                <Card.Body className="text-center">
                  <div className="stats-icon mx-auto mb-3" style={{ backgroundColor: '#f59e0b' }}>
                    <i className="fas fa-user-clock"></i>
                  </div>
                  <div className="stats-number">{dashboardData.employeesOnLeaveToday}</div>
                  <p className="stats-label mb-1">On Leave Today</p>
                  <small className="text-muted d-flex justify-content-center align-items-center gap-1">
                    Currently absent
                    {dashboardData.employeesOnLeaveToday > 0 && (
                      <span className="text-info">
                        <i className="fas fa-arrow-down ms-1"></i>
                        -2 vs yesterday
                      </span>
                    )}
                  </small>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="modern-card hover-lift h-100">
                <Card.Body className="text-center">
                  <div className="stats-icon mx-auto mb-3" style={{ backgroundColor: '#06b6d4' }}>
                    <i className="fas fa-clock"></i>
                  </div>
                  <div className="stats-number">{dashboardData.pendingApprovals}</div>
                  <p className="stats-label mb-1">Pending Approvals</p>
                  <div className="d-flex justify-content-center align-items-center gap-2">
                    <small className="text-warning">
                      <i className="fas fa-exclamation-circle me-1"></i>
                      Needs attention
                    </small>
                    {dashboardData.pendingApprovals > 0 && (
                      <small className="text-danger">
                        <i className="fas fa-arrow-up"></i>
                        +3
                      </small>
                    )}
                  </div>
                </Card.Body>
              </Card>
            </Col>
            <Col md={3}>
              <Card className="modern-card hover-lift h-100">
                <Card.Body className="text-center">
                  <div className="stats-icon mx-auto mb-3" style={{ backgroundColor: '#ef4444' }}>
                    <i className="fas fa-file-alt"></i>
                  </div>
                  <div className="stats-number">{dashboardData.pendingDocVerifications || 0}</div>
                  <p className="stats-label mb-1">Pending Verifications</p>
                  <small className="text-muted">Documents to verify</small>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Department Distribution */}
          <Row className="mb-4">
            <Col md={6}>
              <Card className="modern-card h-100">
                <Card.Header className="d-flex justify-content-between align-items-center">
                  <span>
                    <i className="fas fa-sitemap me-2 text-primary"></i>
                    Department Distribution
                  </span>
                  <Badge bg="primary" className="badge-modern">
                    {dashboardData.departmentStats?.length || 0} Total
                  </Badge>
                </Card.Header>
                <Card.Body>
                  {dashboardData.departmentStats?.length > 0 ? (
                    <Row className="g-2">
                      {dashboardData.departmentStats.map((dept, index) => {
                        const colors = [
                          { bg: '#667eea', light: '#e0e7ff' },
                          { bg: '#f093fb', light: '#fce7f3' },
                          { bg: '#4facfe', light: '#dbeafe' },
                          { bg: '#43e97b', light: '#d1fae5' },
                          { bg: '#fa709a', light: '#ffe4e6' },
                          { bg: '#30cfd0', light: '#cffafe' },
                          { bg: '#a8edea', light: '#ccfbf1' },
                          { bg: '#ff9a9e', light: '#fecaca' },
                          { bg: '#ffecd2', light: '#fed7aa' },
                          { bg: '#ff6e7f', light: '#fecdd3' }
                        ];
                        const color = colors[index % colors.length];
                        
                        return (
                          <Col xs={6} key={index}>
                            <div
                              className="text-center p-2 rounded"
                              style={{
                                backgroundColor: color.light,
                                border: `2px solid ${color.bg}20`,
                                transition: 'all 0.3s ease',
                                cursor: 'pointer'
                              }}
                              onClick={() => dept.departmentId && navigate(`/departments/${dept.departmentId}`)}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-3px)';
                                e.currentTarget.style.boxShadow = `0 4px 8px ${color.bg}30`;
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                              }}
                              title={`Click to view ${dept._id} details`}
                            >
                              <div
                                className="rounded-circle mx-auto mb-1 d-flex align-items-center justify-content-center"
                                style={{
                                  width: '35px',
                                  height: '35px',
                                  backgroundColor: color.bg
                                }}
                              >
                                <i className="fas fa-users text-white" style={{ fontSize: '0.875rem' }}></i>
                              </div>
                              <div className="fw-bold mb-0" style={{ fontSize: '1.25rem', color: color.bg }}>
                                {dept.count}
                              </div>
                              <div className="text-muted" style={{ fontSize: '0.75rem', fontWeight: '600' }}>
                                <div className="text-truncate" title={dept._id || 'Unassigned'}>
                                  {dept._id || 'Unassigned'}
                                </div>
                              </div>
                            </div>
                          </Col>
                        );
                      })}
                    </Row>
                  ) : (
                    <div className="text-center py-4">
                      <i className="fas fa-sitemap text-muted fs-1 mb-3" style={{ color: '#94a3b8' }}></i>
                      <p className="text-muted mb-0">No department data</p>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="modern-card h-100">
                <Card.Header>
                  <i className="fas fa-bullhorn me-2 text-info"></i>
                  Latest Announcements
                </Card.Header>
                <Card.Body className="p-0">
                  <div style={{ maxHeight: '400px', overflowY: 'auto', padding: '1rem' }}>
                    {announcements.length > 0 ? (
                      announcements.slice(0, 5).map((ann) => (
                        <div
                          key={ann._id}
                          className="d-flex align-items-start mb-3 pb-3 border-bottom"
                        >
                          <div
                            className="rounded d-flex align-items-center justify-content-center text-white me-2"
                            style={{
                              backgroundColor:
                                ann.priority === "HIGH"
                                  ? "#ef4444"
                                  : ann.priority === "MEDIUM"
                                    ? "#f59e0b"
                                    : "#3b82f6",
                              width: "35px",
                              height: "35px",
                              minWidth: "35px",
                              fontSize: '0.875rem'
                            }}
                          >
                            <i className="fas fa-bullhorn"></i>
                          </div>
                          <div className="flex-grow-1" style={{ minWidth: 0 }}>
                            <div className="d-flex justify-content-between align-items-start mb-1">
                              <h6 className="mb-0 text-truncate" style={{ fontSize: '0.9rem' }}>{ann.title}</h6>
                              <Badge
                                bg={
                                  ann.priority === "HIGH"
                                    ? "danger"
                                    : ann.priority === "MEDIUM"
                                      ? "warning"
                                      : "info"
                                }
                                className="ms-2"
                                style={{ fontSize: '0.7rem' }}
                              >
                                {ann.priority}
                              </Badge>
                            </div>
                            <p className="text-muted mb-1" style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                              {ann.content}
                            </p>
                            <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                              <i className="fas fa-clock me-1"></i>
                              {new Date(ann.createdAt).toLocaleDateString()}
                            </small>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-4">
                        <i className="fas fa-bullhorn text-muted fs-1 mb-3" style={{ color: '#94a3b8' }}></i>
                        <p className="text-muted mb-0">No announcements</p>
                      </div>
                    )}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Recent Activities */}
          <Row className="mb-4">
            <Col md={6}>
              <Card className="modern-card h-100">
                <Card.Header>
                  <i className="fas fa-history me-2 text-success"></i>
                  Recent Activities
                </Card.Header>
                <Card.Body style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {dashboardData.recentActivities?.length > 0 ? (
                    dashboardData.recentActivities.map((activity) => (
                      <div key={activity._id} className="d-flex align-items-center mb-3 pb-3 border-bottom">
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center me-3"
                          style={{
                            width: '40px',
                            height: '40px',
                            backgroundColor: '#f3f4f6'
                          }}
                        >
                          <i className="fas fa-calendar-alt text-primary"></i>
                        </div>
                        <div className="flex-grow-1">
                          <div className="fw-semibold">
                            {activity.userId?.firstName} {activity.userId?.lastName}
                          </div>
                          <small className="text-muted">
                            Applied for {activity.leaveTypeId?.name} - {activity.days} days
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
                <Card.Header className="d-flex align-items-center">
                  <i className="fas fa-chart-bar me-2 text-info"></i>
                  Leave Statistics
                </Card.Header>
                <Card.Body>
                  {dashboardData.leaveStats?.map((stat) => {
                    const total = dashboardData.leaveStats.reduce((sum, s) => sum + s.count, 0);
                    const percentage = total > 0 ? Math.round((stat.count / total) * 100) : 0;
                    return (
                      <div key={stat._id} className="mb-3">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <span className="fw-semibold">
                            <i
                              className={`fas fa-${getStatusIcon(stat._id)} me-2`}
                              style={{ color: '#6366f1' }}
                            ></i>
                            {stat._id.replace("_", " ")}
                          </span>
                          <span>
                            <Badge
                              bg="light"
                              text="dark"
                              className="me-1 badge-modern"
                            >
                              {stat.count} requests
                            </Badge>
                            <Badge bg="primary" className="badge-modern">
                              {stat.totalDays} days
                            </Badge>
                          </span>
                        </div>
                        <div className="progress" style={{ height: '8px', backgroundColor: '#e2e8f0' }}>
                          <div
                            className="progress-bar"
                            style={{
                              width: `${percentage}%`,
                              backgroundColor: '#6366f1',
                              transition: 'width 0.6s ease'
                            }}
                            title={`${percentage}% of total requests`}
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
              <Card className="card-scrollable h-100">
                <Card.Header>
                  <i className="fas fa-birthday-cake me-2 text-warning"></i>
                  Upcoming Birthdays
                </Card.Header>
                <Card.Body>
                  {dashboardData.upcomingBirthdays?.length > 0 ? (
                    dashboardData.upcomingBirthdays.map((emp) => (
                      <div
                        key={emp._id}
                        className="d-flex align-items-center mb-3 p-2 rounded"
                        style={{ backgroundColor: '#fef3c7', border: '1px solid #fbbf24' }}
                      >
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center me-3"
                          style={{
                            width: '45px',
                            height: '45px',
                            backgroundColor: '#f59e0b',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '1.1rem'
                          }}
                        >
                          {emp.firstName?.charAt(0)}{emp.lastName?.charAt(0)}
                        </div>
                        <div className="flex-grow-1">
                          <div className="fw-bold">
                            {emp.firstName} {emp.lastName}
                          </div>
                          <small className="text-muted">{emp.department}</small>
                        </div>
                        <div className="text-end">
                          <Badge bg="warning" className="mb-1">
                            {new Date(emp.dateOfBirth).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Badge>
                          <div>
                            <Button size="sm" variant="outline-warning" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                              <i className="fas fa-gift me-1"></i>Wish
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted mb-0 text-center py-3">No upcoming birthdays</p>
                  )}
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="card-scrollable h-100">
                <Card.Header>
                  <i className="fas fa-user-plus me-2 text-success"></i>New Hires (Last 30 days)
                </Card.Header>
                <Card.Body>
                  {dashboardData.newHires?.length > 0 ? (
                    dashboardData.newHires.map((emp) => (
                      <div
                        key={emp._id}
                        className="d-flex align-items-center mb-3 p-2 rounded"
                        style={{ backgroundColor: '#d1fae5', border: '1px solid #10b981' }}
                      >
                        <div
                          className="rounded-circle d-flex align-items-center justify-content-center me-3"
                          style={{
                            width: '45px',
                            height: '45px',
                            backgroundColor: '#10b981',
                            color: 'white',
                            fontWeight: 'bold',
                            fontSize: '1.1rem'
                          }}
                        >
                          {emp.firstName?.charAt(0)}{emp.lastName?.charAt(0)}
                        </div>
                        <div className="flex-grow-1">
                          <div className="fw-bold">
                            {emp.firstName} {emp.lastName}
                          </div>
                          <small className="text-muted">{emp.department}</small>
                        </div>
                        <div className="text-end">
                          <Badge bg="success" className="mb-1">
                            {new Date(emp.joinDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </Badge>
                          <div>
                            <Button size="sm" variant="outline-success" style={{ fontSize: '0.7rem', padding: '2px 8px' }}>
                              <i className="fas fa-hand-wave me-1"></i>Welcome
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted mb-0 text-center py-3">No new hires</p>
                  )}
                </Card.Body>
              </Card>
            </Col>
            <Col md={4}>
              <Card className="card-scrollable h-100">
                <Card.Header>
                  <i className="fas fa-calendar-alt me-2 text-info"></i>
                  Upcoming Holidays
                </Card.Header>
                <Card.Body>
                  {holidays
                    .filter((h) => new Date(h.date) >= new Date())
                    .slice(0, 5)
                    .map((holiday) => (
                      <div
                        key={holiday._id}
                        className="d-flex justify-content-between align-items-center mb-2 p-2 rounded"
                        style={{ backgroundColor: '#dbeafe', border: '1px solid #3b82f6' }}
                      >
                        <div className="flex-grow-1">
                          <div className="fw-bold">{holiday.name}</div>
                          <small className="text-muted">
                            {new Date(holiday.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </small>
                        </div>
                        <Badge
                          bg={holiday.type === "FESTIVAL" ? "warning" : holiday.type === "NATIONAL" ? "danger" : "info"}
                        >
                          {holiday.type}
                        </Badge>
                      </div>
                    ))}
                  {holidays.filter((h) => new Date(h.date) >= new Date()).length === 0 && (
                    <p className="text-muted mb-0 text-center py-3">No upcoming holidays</p>
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
