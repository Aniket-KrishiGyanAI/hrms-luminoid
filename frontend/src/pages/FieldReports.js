import React, { useState, useEffect } from "react";
import {
  Row,
  Col,
  Card,
  Button,
  Badge,
  Form,
  Table,
  Modal,
} from "react-bootstrap";
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import api from "../utils/api";
import { toast } from "react-toastify";

// Fix leaflet default icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";
const photoUrl = (url) => (url?.startsWith("http") ? url : `${API_BASE}${url}`);

const OUTCOME_LABELS = {
  ORDER_RECEIVED: "🎉 Order",
  POSITIVE: "👍 Positive",
  NEUTRAL: "🤝 Neutral",
  NEGATIVE: "👎 Negative",
  DEMO_SCHEDULED: "📅 Demo",
  PROPOSAL_SENT: "📄 Proposal",
  NO_RESPONSE: "📵 No Response",
};

const OUTCOME_COLORS = {
  ORDER_RECEIVED: { bg: "#dcfce7", color: "#16a34a", border: "#86efac" },
  POSITIVE: { bg: "#dbeafe", color: "#2563eb", border: "#93c5fd" },
  NEUTRAL: { bg: "#fef9c3", color: "#ca8a04", border: "#fde047" },
  NEGATIVE: { bg: "#fee2e2", color: "#dc2626", border: "#fca5a5" },
  DEMO_SCHEDULED: { bg: "#ede9fe", color: "#7c3aed", border: "#c4b5fd" },
  PROPOSAL_SENT: { bg: "#e0f2fe", color: "#0284c7", border: "#7dd3fc" },
  NO_RESPONSE: { bg: "#f3f4f6", color: "#6b7280", border: "#d1d5db" },
};

const fmt = (d, opts) =>
  d
    ? new Date(d).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
        ...opts,
      })
    : "—";
const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const FieldReports = () => {
  const [reports, setReports] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterDate, setFilterDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [filterEmployee, setFilterEmployee] = useState("");
  const [selectedReport, setSelectedReport] = useState(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapVisit, setMapVisit] = useState(null);
  const [lightbox, setLightbox] = useState(null);
  const [activeView, setActiveView] = useState("visits"); // 'visits' | 'journey' | 'monthly'
  const [journeys, setJourneys] = useState([]);
  const [journeyLoading, setJourneyLoading] = useState(false);
  const [monthlyStats, setMonthlyStats] = useState(null);
  const [filterMonth, setFilterMonth] = useState(new Date().getMonth() + 1);
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchEmployees();
  }, []);
  useEffect(() => {
    fetchReports();
  }, [filterDate, filterEmployee]);
  useEffect(() => {
    if (activeView === "journey") fetchJourneys();
    if (activeView === "monthly") fetchMonthlyStats();
  }, [activeView, filterDate, filterEmployee, filterMonth, filterYear]);

  const fetchEmployees = async () => {
    try {
      const res = await api.get("/api/employees");
      setEmployees(res.data.filter((e) => e.role === "EMPLOYEE"));
    } catch {}
  };

  const fetchReports = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        startDate: filterDate,
        endDate: filterDate,
      });
      if (filterEmployee) params.append("employeeId", filterEmployee);
      const res = await api.get(`/api/field-reports/all?${params}`);
      setReports(res.data);
    } catch {
      toast.error("Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  const viewDailyReport = async (empId) => {
    try {
      const res = await api.get(`/api/field-reports/${filterDate}/${empId}`);
      setSelectedReport(res.data);
    } catch {
      toast.error("Failed to load report");
    }
  };

  const openRouteMap = (visit) => {
    setMapVisit(visit);
    setShowMapModal(true);
  };

  const fetchJourneys = async () => {
    setJourneyLoading(true);
    try {
      const params = new URLSearchParams({ date: filterDate });
      if (filterEmployee) params.append("employeeId", filterEmployee);
      const res = await api.get(`/api/journey/summary?${params}`);
      setJourneys(res.data);
    } catch {
      toast.error("Failed to load journey data");
    } finally {
      setJourneyLoading(false);
    }
  };

  const fetchMonthlyStats = async () => {
    setJourneyLoading(true);
    try {
      const params = new URLSearchParams({ month: filterMonth, year: filterYear });
      if (filterEmployee) params.append("employeeId", filterEmployee);
      const res = await api.get(`/api/field-reports/monthly-stats?${params}`);
      setMonthlyStats(res.data);
    } catch {
      toast.error("Failed to load monthly stats");
    } finally {
      setJourneyLoading(false);
    }
  };

  const exportCSV = () => {
    let rows, filename;
    
    if (activeView === "monthly" && monthlyStats) {
      // Export monthly stats
      rows = [
        ["Employee", "Department", "Visits", "Completed", "Orders", "Deal Value (₹)"],
        ...Object.entries(monthlyStats.employeeStats).map(([id, stat]) => [
          stat.name,
          stat.department,
          stat.visits,
          stat.completed,
          stat.orders,
          stat.dealValue,
        ]),
        [],
        ["MONTHLY TOTALS"],
        ["Total Visits", monthlyStats.totalVisits],
        ["Total Completed", monthlyStats.totalCompleted],
        ["Total Orders", monthlyStats.totalOrders],
        ["Total Deal Value", monthlyStats.totalDealValue],
        ["Total Distance (km)", monthlyStats.totalDistance.toFixed(1)],
        ["Total Duration (hrs)", Math.round(monthlyStats.totalDuration / 60)],
      ];
      filename = `monthly-report-${filterYear}-${String(filterMonth).padStart(2, '0')}.csv`;
    } else if (activeView === "journey") {
      // Export journey data
      rows = [
        ["Employee", "Department", "Start Time", "End Time", "Distance (km)", "GPS Points", "Status"],
        ...journeys.map((j) => [
          `${j.employeeId?.firstName} ${j.employeeId?.lastName}`,
          j.employeeId?.department,
          j.startTime ? new Date(j.startTime).toLocaleString("en-GB") : "—",
          j.endTime ? new Date(j.endTime).toLocaleString("en-GB") : "Still Active",
          j.totalDistanceKm,
          j.locationPoints?.length || 0,
          j.status,
        ]),
      ];
      filename = `journey-report-${filterDate}.csv`;
    } else {
      // Export daily visit reports
      rows = [
        [
          "Employee",
          "Date",
          "Planned",
          "Visited",
          "Completed",
          "Distance (km)",
          "Duration (min)",
          "Deal Value (₹)",
          "Orders",
        ],
        ...reports.map((r) => [
          `${r.employeeId?.firstName} ${r.employeeId?.lastName}`,
          new Date(r.date).toLocaleDateString("en-GB"),
          r.totalPlanned,
          r.totalVisited,
          r.totalCompleted,
          r.totalDistanceKm,
          r.totalDurationMinutes,
          r.totalDealValue,
          r.outcomeSummary?.ORDER_RECEIVED || 0,
        ]),
      ];
      filename = `field-report-${filterDate}.csv`;
    }
    
    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    toast.success("Report exported");
  };

  // Summary stats
  const totalVisited = reports.reduce((s, r) => s + r.totalVisited, 0);
  const totalOrders = reports.reduce(
    (s, r) => s + (r.outcomeSummary?.ORDER_RECEIVED || 0),
    0,
  );
  const totalDeal = reports.reduce((s, r) => s + r.totalDealValue, 0);
  const totalKm = reports.reduce((s, r) => s + r.totalDistanceKm, 0);
  const totalJourneyKm = journeys.reduce(
    (s, j) => s + (j.totalDistanceKm || 0),
    0,
  );

  return (
    <div className="fade-in-up">
      <div className="page-header">
        <div className="d-flex justify-content-between align-items-center">
          <div>
            <h1 className="page-title">
              <i className="fas fa-chart-bar me-2 text-primary" />
              Field Reports
            </h1>
            <p className="text-muted">Daily visit performance & analytics</p>
          </div>
          <Button
            variant="success"
            onClick={exportCSV}
            style={{ borderRadius: 8 }}
          >
            <i className="fas fa-file-export me-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card
        className="mb-3"
        style={{
          borderRadius: 12,
          border: "none",
          boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        }}
      >
        <Card.Body>
          <Row className="g-2 align-items-end">
            {activeView !== "monthly" ? (
              <>
                <Col md={3}>
                  <Form.Label style={{ fontWeight: 600 }}>Date</Form.Label>
                  <Form.Control
                    type="date"
                    value={filterDate}
                    onChange={(e) => setFilterDate(e.target.value)}
                    style={{ borderRadius: 8 }}
                  />
                </Col>
                <Col md={3}>
                  <Form.Label style={{ fontWeight: 600 }}>Employee</Form.Label>
                  <Form.Select
                    value={filterEmployee}
                    onChange={(e) => setFilterEmployee(e.target.value)}
                    style={{ borderRadius: 8 }}
                  >
                    <option value="">All Employees</option>
                    {employees.map((e) => (
                      <option key={e._id} value={e._id}>
                        {e.firstName} {e.lastName}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={2}>
                  <Button
                    variant="outline-secondary"
                    onClick={() =>
                      setFilterDate(new Date().toISOString().split("T")[0])
                    }
                    style={{ borderRadius: 8 }}
                  >
                    Today
                  </Button>
                </Col>
              </>
            ) : (
              <>
                <Col md={2}>
                  <Form.Label style={{ fontWeight: 600 }}>Month</Form.Label>
                  <Form.Select
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(parseInt(e.target.value))}
                    style={{ borderRadius: 8 }}
                  >
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        {new Date(2000, i).toLocaleString('en', { month: 'long' })}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={2}>
                  <Form.Label style={{ fontWeight: 600 }}>Year</Form.Label>
                  <Form.Select
                    value={filterYear}
                    onChange={(e) => setFilterYear(parseInt(e.target.value))}
                    style={{ borderRadius: 8 }}
                  >
                    {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i).map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </Form.Select>
                </Col>
                <Col md={3}>
                  <Form.Label style={{ fontWeight: 600 }}>Employee</Form.Label>
                  <Form.Select
                    value={filterEmployee}
                    onChange={(e) => setFilterEmployee(e.target.value)}
                    style={{ borderRadius: 8 }}
                  >
                    <option value="">All Employees</option>
                    {employees.map((e) => (
                      <option key={e._id} value={e._id}>
                        {e.firstName} {e.lastName}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
              </>
            )}
          </Row>
        </Card.Body>
      </Card>

      {/* Summary Cards */}
      <Row className="g-3 mb-3">
        {[
          {
            label: "Total Visits",
            value: totalVisited,
            icon: "map-marker-alt",
            color: "#3b82f6",
          },
          {
            label: "Orders Received",
            value: totalOrders,
            icon: "shopping-cart",
            color: "#10b981",
          },
          {
            label: "Total Deal Value",
            value: `₹${totalDeal.toLocaleString()}`,
            icon: "rupee-sign",
            color: "#f59e0b",
          },
          {
            label: "Visit Distance",
            value: `${totalKm.toFixed(1)} km`,
            icon: "road",
            color: "#8b5cf6",
          },
          {
            label: "Journey Distance",
            value: `${totalJourneyKm.toFixed(1)} km`,
            icon: "route",
            color: "#10b981",
          },
        ].map((s, i) => (
          <Col md={2} key={i}>
            <Card
              style={{
                borderRadius: 12,
                border: "none",
                boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
              }}
            >
              <Card.Body className="d-flex align-items-center gap-3">
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: `${s.color}20`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <i
                    className={`fas fa-${s.icon}`}
                    style={{ color: s.color, fontSize: "1.1rem" }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>
                    {s.value}
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                    {s.label}
                  </div>
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {/* View Toggle */}
      <div className="d-flex gap-2 mb-3">
        {[
          { key: "visits", label: "Visit Reports", icon: "map-marker-alt" },
          { key: "journey", label: "Journey Distance", icon: "route" },
          { key: "monthly", label: "Monthly Stats", icon: "calendar-alt" },
        ].map((v) => (
          <button
            key={v.key}
            onClick={() => setActiveView(v.key)}
            style={{
              padding: "0.42rem 1rem",
              borderRadius: 20,
              border: "none",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.82rem",
              background: activeView === v.key ? "#3b82f6" : "#f1f5f9",
              color: activeView === v.key ? "#fff" : "#64748b",
              boxShadow:
                activeView === v.key
                  ? "0 2px 8px rgba(59,130,246,0.3)"
                  : "none",
              transition: "all 0.18s",
            }}
          >
            <i className={`fas fa-${v.icon} me-1`} />
            {v.label}
          </button>
        ))}
      </div>

      {/* Visit Reports Table */}
      {activeView === "visits" && (
        <Card
          style={{
            borderRadius: 12,
            border: "none",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <Card.Header
            style={{
              background: "white",
              borderBottom: "1px solid #f3f4f6",
              borderRadius: "12px 12px 0 0",
            }}
          >
            <h6 className="mb-0" style={{ fontWeight: 600 }}>
              Employee Reports —{" "}
              {new Date(filterDate).toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "long",
                year: "numeric",
              })}
            </h6>
          </Card.Header>
          <Card.Body className="p-0">
            {loading ? (
              <div className="text-center py-4">
                <div className="spinner-border text-primary" />
              </div>
            ) : (
              <div className="table-responsive">
                <Table hover className="mb-0">
                  <thead style={{ background: "#f8fafc" }}>
                    <tr>
                      <th>Employee</th>
                      <th>Planned</th>
                      <th>Visited</th>
                      <th>Completed</th>
                      <th>Distance</th>
                      <th>Duration</th>
                      <th>Orders</th>
                      <th>Deal Value</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reports.map((r) => (
                      <tr key={r._id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>
                            {r.employeeId?.firstName} {r.employeeId?.lastName}
                          </div>
                          <small className="text-muted">
                            {r.employeeId?.department}
                          </small>
                        </td>
                        <td>{r.totalPlanned}</td>
                        <td>
                          <Badge bg="info">{r.totalVisited}</Badge>
                        </td>
                        <td>
                          <Badge bg="success">{r.totalCompleted}</Badge>
                        </td>
                        <td>{r.totalDistanceKm} km</td>
                        <td>{r.totalDurationMinutes} min</td>
                        <td>
                          <Badge bg="warning" text="dark">
                            {r.outcomeSummary?.ORDER_RECEIVED || 0}
                          </Badge>
                        </td>
                        <td style={{ fontWeight: 600, color: "#10b981" }}>
                          ₹{r.totalDealValue?.toLocaleString()}
                        </td>
                        <td>
                          <Button
                            size="sm"
                            variant="outline-primary"
                            onClick={() => viewDailyReport(r.employeeId?._id)}
                            style={{ borderRadius: 6 }}
                          >
                            <i className="fas fa-eye me-1" />
                            Details
                          </Button>
                        </td>
                      </tr>
                    ))}
                    {reports.length === 0 && (
                      <tr>
                        <td colSpan={9} className="text-center py-4 text-muted">
                          No reports for this date
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>
      )}

      {/* Journey Distance Table */}
      {activeView === "journey" && (
        <Card
          style={{
            borderRadius: 12,
            border: "none",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <Card.Header
            style={{
              background: "white",
              borderBottom: "1px solid #f3f4f6",
              borderRadius: "12px 12px 0 0",
            }}
          >
            <div className="d-flex justify-content-between align-items-center">
              <h6 className="mb-0" style={{ fontWeight: 600 }}>
                <i className="fas fa-route me-2 text-success" />
                Journey Distance —{" "}
                {new Date(filterDate).toLocaleDateString("en-GB", {
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </h6>
              <div style={{ fontSize: "0.82rem", color: "#6b7280" }}>
                Total:{" "}
                <strong style={{ color: "#10b981" }}>
                  {totalJourneyKm.toFixed(1)} km
                </strong>{" "}
                across {journeys.length} employees
              </div>
            </div>
          </Card.Header>
          <Card.Body className="p-0">
            {journeyLoading ? (
              <div className="text-center py-4">
                <div className="spinner-border text-primary" />
              </div>
            ) : (
              <div className="table-responsive">
                <Table hover className="mb-0">
                  <thead style={{ background: "#f8fafc" }}>
                    <tr>
                      <th>#</th>
                      <th>Employee</th>
                      <th>Start Time</th>
                      <th>End Time</th>
                      <th>Total Distance</th>
                      <th>GPS Points</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {journeys.map((j, i) => (
                      <tr key={j._id}>
                        <td style={{ color: "#9ca3af", fontSize: "0.85rem" }}>
                          {i + 1}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>
                            {j.employeeId?.firstName} {j.employeeId?.lastName}
                          </div>
                          <small className="text-muted">
                            {j.employeeId?.department}
                          </small>
                        </td>
                        <td style={{ fontSize: "0.85rem" }}>
                          {j.startTime
                            ? new Date(j.startTime).toLocaleTimeString(
                                "en-GB",
                                { hour: "2-digit", minute: "2-digit" },
                              )
                            : "—"}
                        </td>
                        <td style={{ fontSize: "0.85rem" }}>
                          {j.endTime ? (
                            new Date(j.endTime).toLocaleTimeString("en-GB", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          ) : (
                            <span className="text-warning">Still Active</span>
                          )}
                        </td>
                        <td>
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: "1rem",
                              color: "#10b981",
                            }}
                          >
                            {j.totalDistanceKm} km
                          </span>
                        </td>
                        <td style={{ fontSize: "0.85rem", color: "#6b7280" }}>
                          {j.locationPoints?.length || 0} points
                        </td>
                        <td>
                          <Badge
                            bg={
                              j.status === "ACTIVE"
                                ? "warning"
                                : j.status === "COMPLETED"
                                  ? "success"
                                  : "secondary"
                            }
                            style={{ fontSize: "0.75rem" }}
                          >
                            {j.status === "AUTO_ENDED"
                              ? "Auto Ended"
                              : j.status}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                    {journeys.length === 0 && (
                      <tr>
                        <td colSpan={7} className="text-center py-4 text-muted">
                          No journey data for this date
                        </td>
                      </tr>
                    )}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>
      )}

      {/* Monthly Stats View */}
      {activeView === "monthly" && (
        <Card
          style={{
            borderRadius: 12,
            border: "none",
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}
        >
          <Card.Header
            style={{
              background: "white",
              borderBottom: "1px solid #f3f4f6",
              borderRadius: "12px 12px 0 0",
            }}
          >
            <h6 className="mb-0" style={{ fontWeight: 600 }}>
              <i className="fas fa-calendar-alt me-2 text-primary" />
              Monthly Statistics — {new Date(filterYear, filterMonth - 1).toLocaleString('en', { month: 'long', year: 'numeric' })}
            </h6>
          </Card.Header>
          <Card.Body>
            {journeyLoading ? (
              <div className="text-center py-4">
                <div className="spinner-border text-primary" />
              </div>
            ) : monthlyStats ? (
              <>
                {/* Monthly Summary Cards */}
                <Row className="g-3 mb-4">
                  {[
                    { label: "Total Visits", value: monthlyStats.totalVisits, icon: "map-marker-alt", color: "#3b82f6" },
                    { label: "Completed", value: monthlyStats.totalCompleted, icon: "check-circle", color: "#10b981" },
                    { label: "Orders", value: monthlyStats.totalOrders, icon: "shopping-cart", color: "#f59e0b" },
                    { label: "Deal Value", value: `₹${monthlyStats.totalDealValue.toLocaleString()}`, icon: "rupee-sign", color: "#8b5cf6" },
                    { label: "Distance", value: `${monthlyStats.totalDistance.toFixed(1)} km`, icon: "route", color: "#ec4899" },
                    { label: "Duration", value: `${Math.round(monthlyStats.totalDuration / 60)} hrs`, icon: "clock", color: "#06b6d4" },
                  ].map((s, i) => (
                    <Col md={2} key={i}>
                      <Card style={{ borderRadius: 12, border: "none", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
                        <Card.Body className="d-flex align-items-center gap-3">
                          <div style={{ width: 44, height: 44, borderRadius: 12, background: `${s.color}20`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <i className={`fas fa-${s.icon}`} style={{ color: s.color, fontSize: "1.1rem" }} />
                          </div>
                          <div>
                            <div style={{ fontSize: "1.3rem", fontWeight: 700 }}>{s.value}</div>
                            <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>{s.label}</div>
                          </div>
                        </Card.Body>
                      </Card>
                    </Col>
                  ))}
                </Row>

                {/* Employee Breakdown */}
                <div className="table-responsive">
                  <Table hover>
                    <thead style={{ background: "#f8fafc" }}>
                      <tr>
                        <th>Employee</th>
                        <th>Department</th>
                        <th>Visits</th>
                        <th>Completed</th>
                        <th>Orders</th>
                        <th>Deal Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.entries(monthlyStats.employeeStats).map(([id, stat]) => (
                        <tr key={id}>
                          <td style={{ fontWeight: 600 }}>{stat.name}</td>
                          <td><small className="text-muted">{stat.department}</small></td>
                          <td><Badge bg="info">{stat.visits}</Badge></td>
                          <td><Badge bg="success">{stat.completed}</Badge></td>
                          <td><Badge bg="warning" text="dark">{stat.orders}</Badge></td>
                          <td style={{ fontWeight: 600, color: "#10b981" }}>₹{stat.dealValue.toLocaleString()}</td>
                        </tr>
                      ))}
                      {Object.keys(monthlyStats.employeeStats).length === 0 && (
                        <tr>
                          <td colSpan={6} className="text-center py-4 text-muted">
                            No data for this month
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </Table>
                </div>
              </>
            ) : (
              <div className="text-center py-4 text-muted">No data available</div>
            )}
          </Card.Body>
        </Card>
      )}

      {/* Daily Report Detail Modal */}
      <Modal
        show={!!selectedReport}
        onHide={() => setSelectedReport(null)}
        size="xl"
        centered
        scrollable
        style={{ background: "rgba(0,0,0,0.5)" }}
      >
        {/* Clean Professional Header - Green Theme */}
        <Modal.Header
          style={{
            border: "none",
            padding: 0,
            background: "white",
            position: "relative",
          }}
        >
          <div
            style={{
              width: "100%",
              background:
                "linear-gradient(to right, #10b981 0%, #059669 50%, #10b981 100%)",
              backgroundSize: "200% 100%",
              padding: "1.75rem",
              borderRadius: "8px 8px 0 0",
            }}
          >
            <div
              className="d-flex align-items-center justify-content-between"
              style={{ gap: "1.5rem", flexWrap: "wrap" }}
            >
              {/* Left: Employee Info */}
              <div
                className="d-flex align-items-center gap-3"
                style={{ flex: 1, minWidth: "auto" }}
              >
                <div
                  style={{
                    width: 60,
                    height: 60,
                    borderRadius: 12,
                    background: "rgba(255,255,255,0.2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    border: "2px solid rgba(255,255,255,0.4)",
                    flexShrink: 0,
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <i
                    className="fas fa-user-briefcase"
                    style={{ color: "white", fontSize: "1.6rem" }}
                  />
                </div>
                <div>
                  <h4
                    style={{
                      color: "white",
                      fontWeight: 800,
                      margin: "0 0 0.4rem 0",
                      fontSize: "1.2rem",
                      textShadow: "0 2px 4px rgba(0,0,0,0.15)",
                    }}
                  >
                    {selectedReport?.employeeId?.firstName}{" "}
                    {selectedReport?.employeeId?.lastName}
                  </h4>
                  <div
                    style={{
                      color: "rgba(255,255,255,0.9)",
                      fontSize: "0.8rem",
                      display: "flex",
                      gap: "1rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <span>
                      <i className="fas fa-calendar-alt me-1" />
                      {selectedReport && fmtDate(selectedReport.date)}
                    </span>
                    {selectedReport?.employeeId?.department && (
                      <span>
                        <i className="fas fa-briefcase me-1" />
                        {selectedReport.employeeId.department}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Key Stats - Compact */}
              {selectedReport && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
                    gap: "0.6rem",
                    minWidth: "320px",
                  }}
                >
                  {[
                    {
                      icon: "map-marker-alt",
                      label: "Visits",
                      value: selectedReport.totalVisited,
                      color: "#06b6d4",
                    },
                    {
                      icon: "check-circle",
                      label: "Completed",
                      value: selectedReport.totalCompleted,
                      color: "#8b5cf6",
                    },
                    {
                      icon: "shopping-cart",
                      label: "Orders",
                      value: selectedReport.outcomeSummary?.ORDER_RECEIVED || 0,
                      color: "#f59e0b",
                    },
                    {
                      icon: "route",
                      label: "Distance",
                      value: `${selectedReport.totalDistanceKm}km`,
                      color: "#ec4899",
                    },
                    {
                      icon: "clock",
                      label: "Duration",
                      value: `${selectedReport.totalDurationMinutes}m`,
                      color: "#3b82f6",
                    },
                    {
                      icon: "rupee-sign",
                      label: "Deal Value",
                      value: `₹${Math.round((selectedReport.totalDealValue || 0) / 1000)}K`,
                      color: "#06b6d4",
                    },
                  ].map((k, i) => (
                    <div
                      key={i}
                      style={{
                        background: "rgba(255,255,255,0.15)",
                        backdropFilter: "blur(10px)",
                        borderRadius: 10,
                        padding: "0.65rem 0.8rem",
                        textAlign: "center",
                        border: "1px solid rgba(255,255,255,0.2)",
                        transition: "all 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background =
                          "rgba(255,255,255,0.22)";
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background =
                          "rgba(255,255,255,0.15)";
                        e.currentTarget.style.transform = "translateY(0)";
                      }}
                    >
                      <i
                        className={`fas fa-${k.icon}`}
                        style={{
                          color: "white",
                          fontSize: "0.9rem",
                          display: "block",
                          marginBottom: "0.3rem",
                        }}
                      />
                      <div
                        style={{
                          color: "white",
                          fontWeight: 800,
                          fontSize: "1rem",
                          lineHeight: 1,
                        }}
                      >
                        {k.value}
                      </div>
                      <div
                        style={{
                          color: "rgba(255,255,255,0.75)",
                          fontSize: "0.6rem",
                          marginTop: "0.25rem",
                          fontWeight: 600,
                        }}
                      >
                        {k.label}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </Modal.Header>

        <Modal.Body style={{ background: "#f9fafb", padding: "1.5rem" }}>
          {selectedReport && (
            <>
              {/* Outcome Summary Section */}
              {Object.values(selectedReport.outcomeSummary || {}).some(
                (v) => v > 0,
              ) && (
                <div
                  style={{
                    background: "white",
                    border: "1px solid #e5e7eb",
                    borderRadius: 14,
                    padding: "1.25rem",
                    marginBottom: "1.5rem",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                  }}
                >
                  <h6
                    style={{
                      fontWeight: 700,
                      fontSize: "0.85rem",
                      color: "#374151",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      marginBottom: "0.85rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.5rem",
                    }}
                  >
                    <i
                      className="fas fa-chart-pie"
                      style={{ color: "#667eea" }}
                    />
                    Outcome Breakdown
                  </h6>
                  <div className="d-flex flex-wrap gap-2">
                    {Object.entries(selectedReport.outcomeSummary)
                      .filter(([, v]) => v > 0)
                      .map(([k, v]) => {
                        const c = OUTCOME_COLORS[k] || OUTCOME_COLORS.NEUTRAL;
                        return (
                          <div
                            key={k}
                            style={{
                              background: c.bg,
                              border: `2px solid ${c.border}`,
                              borderRadius: 12,
                              padding: "0.6rem 1rem",
                              display: "flex",
                              alignItems: "center",
                              gap: "0.6rem",
                              transition: "all 0.2s",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.transform = "scale(1.05)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.transform = "scale(1)")
                            }
                          >
                            <span
                              style={{
                                fontWeight: 800,
                                fontSize: "1.2rem",
                                color: c.color,
                              }}
                            >
                              {v}
                            </span>
                            <span
                              style={{
                                fontSize: "0.82rem",
                                color: c.color,
                                fontWeight: 600,
                              }}
                            >
                              {OUTCOME_LABELS[k]}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              {/* Visit Details Section */}
              <div style={{ marginBottom: "1rem" }}>
                <h6
                  style={{
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    color: "#374151",
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    marginBottom: "0.75rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                  }}
                >
                  <i
                    className="fas fa-list-check"
                    style={{ color: "#667eea" }}
                  />
                  Visit Details • {selectedReport.visits?.length || 0} Visits
                </h6>

                {!selectedReport.visits ||
                selectedReport.visits.length === 0 ? (
                  <div
                    style={{
                      background: "white",
                      border: "2px dashed #e5e7eb",
                      borderRadius: 14,
                      padding: "3rem 1.5rem",
                      textAlign: "center",
                    }}
                  >
                    <i
                      className="fas fa-inbox"
                      style={{
                        fontSize: "2.5rem",
                        color: "#d1d5db",
                        marginBottom: "0.75rem",
                        display: "block",
                      }}
                    />
                    <p
                      style={{
                        color: "#9ca3af",
                        fontSize: "0.9rem",
                        margin: 0,
                      }}
                    >
                      No visits recorded for this day
                    </p>
                  </div>
                ) : (
                  <div className="d-flex flex-column gap-3">
                    {selectedReport.visits?.map((visit, i) => {
                      const oc =
                        OUTCOME_COLORS[visit.outcome?.status] ||
                        OUTCOME_COLORS.NEUTRAL;
                      const duration =
                        visit.durationMinutes ||
                        (visit.checkIn?.time && visit.checkOut?.time
                          ? Math.round(
                              (new Date(visit.checkOut.time) -
                                new Date(visit.checkIn.time)) /
                                60000,
                            )
                          : null);
                      return (
                        <div
                          key={i}
                          style={{
                            background: "white",
                            borderRadius: 12,
                            border: "1px solid #e5e7eb",
                            overflow: "hidden",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                            transition: "all 0.2s",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.boxShadow =
                              "0 4px 12px rgba(102, 126, 234, 0.1)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.boxShadow =
                              "0 1px 3px rgba(0,0,0,0.04)")
                          }
                        >
                          {/* Visit Header - Professional Design */}
                          <div
                            style={{
                              padding: "1rem 1.25rem",
                              borderBottom: "1px solid #f3f4f6",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              background:
                                "linear-gradient(to right, rgba(102, 126, 234, 0.02), transparent)",
                            }}
                          >
                            <div
                              className="d-flex gap-2.5"
                              style={{ flex: 1, minWidth: 0 }}
                            >
                              {/* Company Info */}
                              <div style={{ minWidth: 0, flex: 1 }}>
                                {/* Company Name */}
                                <div
                                  style={{
                                    fontWeight: 700,
                                    fontSize: "0.95rem",
                                    color: "#111827",
                                    marginBottom: "0.25rem",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.5rem",
                                  }}
                                >
                                  <i
                                    className="fas fa-building"
                                    style={{
                                      color: "#667eea",
                                      fontSize: "0.85rem",
                                    }}
                                  />
                                  {visit.clientId?.name || "Unknown Client"}
                                </div>

                                {/* Contact Person */}
                                {visit.clientId?.contactPerson && (
                                  <div
                                    style={{
                                      fontSize: "0.8rem",
                                      color: "#6b7280",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "0.4rem",
                                    }}
                                  >
                                    <i
                                      className="fas fa-user-circle"
                                      style={{
                                        color: "#9ca3af",
                                        fontSize: "0.75rem",
                                      }}
                                    />
                                    <span>{visit.clientId.contactPerson}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Status Badges - Right Side */}
                            <div
                              style={{
                                display: "flex",
                                gap: "0.5rem",
                                flexWrap: "wrap",
                                justifyContent: "flex-end",
                                alignItems: "center",
                              }}
                            >
                              {visit.selfReported && (
                                <span
                                  style={{
                                    background: "#fef3c7",
                                    color: "#92400e",
                                    border: "1px solid #fde68a",
                                    borderRadius: 6,
                                    padding: "0.3rem 0.65rem",
                                    fontSize: "0.7rem",
                                    fontWeight: 600,
                                  }}
                                >
                                  Self-Reported
                                </span>
                              )}
                              {visit.outcome?.status && (
                                <span
                                  style={{
                                    background: oc.bg,
                                    color: oc.color,
                                    border: `1px solid ${oc.border}`,
                                    borderRadius: 6,
                                    padding: "0.3rem 0.65rem",
                                    fontSize: "0.7rem",
                                    fontWeight: 600,
                                  }}
                                >
                                  {OUTCOME_LABELS[visit.outcome.status]}
                                </span>
                              )}
                              {visit.outcome?.dealValue > 0 && (
                                <span
                                  style={{
                                    background: "#dcfce7",
                                    color: "#15803d",
                                    border: "1px solid #86efac",
                                    borderRadius: 6,
                                    padding: "0.3rem 0.65rem",
                                    fontSize: "0.7rem",
                                    fontWeight: 700,
                                  }}
                                >
                                  ₹{visit.outcome.dealValue.toLocaleString()}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Visit Body */}
                          <div style={{ padding: "1.25rem" }}>
                            {/* Timeline - Horizontal Clean Layout */}
                            <div
                              style={{
                                display: "flex",
                                gap: "0.75rem",
                                marginBottom: "1.25rem",
                                overflow: "auto",
                                paddingBottom: "0.25rem",
                              }}
                            >
                              {[
                                {
                                  icon: "sign-in-alt",
                                  label: "In",
                                  value: fmt(visit.checkIn?.time),
                                  color: "#10b981",
                                },
                                {
                                  icon: "sign-out-alt",
                                  label: "Out",
                                  value: fmt(visit.checkOut?.time),
                                  color: "#ef4444",
                                },
                                {
                                  icon: "hourglass-end",
                                  label: "Duration",
                                  value: duration ? `${duration}m` : "—",
                                  color: "#f59e0b",
                                },
                                {
                                  icon: "route",
                                  label: "Distance",
                                  value:
                                    visit.totalDistanceKm > 0
                                      ? `${visit.totalDistanceKm}km`
                                      : "—",
                                  color: "#8b5cf6",
                                },
                              ].map((m, j) => (
                                <div
                                  key={j}
                                  style={{
                                    background: "#f9fafb",
                                    border: "1px solid #e5e7eb",
                                    borderRadius: 8,
                                    padding: "0.6rem 0.8rem",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.45rem",
                                    whiteSpace: "nowrap",
                                    minWidth: "fit-content",
                                  }}
                                >
                                  <i
                                    className={`fas fa-${m.icon}`}
                                    style={{
                                      color: m.color,
                                      fontSize: "0.8rem",
                                    }}
                                  />
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                      lineHeight: 1,
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: "0.6rem",
                                        color: "#6b7280",
                                        fontWeight: 500,
                                      }}
                                    >
                                      {m.label}
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "0.8rem",
                                        fontWeight: 700,
                                        color: m.color,
                                      }}
                                    >
                                      {m.value}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>

                            {/* Location Info - Compact */}
                            {(visit.checkIn?.location?.address ||
                              visit.checkOut?.location?.address) && (
                              <div
                                style={{
                                  marginBottom: "1rem",
                                  display: "grid",
                                  gridTemplateColumns:
                                    "repeat(auto-fit, minmax(200px, 1fr))",
                                  gap: "0.75rem",
                                }}
                              >
                                {visit.checkIn?.location?.address && (
                                  <div
                                    style={{
                                      background: "#ecfdf5",
                                      border: "1px solid #a7f3d0",
                                      borderRadius: 8,
                                      padding: "0.5rem 0.75rem",
                                      fontSize: "0.75rem",
                                    }}
                                  >
                                    <span
                                      style={{
                                        color: "#10b981",
                                        fontWeight: 700,
                                      }}
                                    >
                                      <i className="fas fa-map-pin me-1" />
                                      In:{" "}
                                    </span>
                                    <span style={{ color: "#374151" }}>
                                      {visit.checkIn.location.address
                                        .split(",")
                                        .slice(0, 2)
                                        .join(",")}
                                    </span>
                                  </div>
                                )}
                                {visit.checkOut?.location?.address && (
                                  <div
                                    style={{
                                      background: "#fef2f2",
                                      border: "1px solid #fecdd3",
                                      borderRadius: 8,
                                      padding: "0.5rem 0.75rem",
                                      fontSize: "0.75rem",
                                    }}
                                  >
                                    <span
                                      style={{
                                        color: "#dc2626",
                                        fontWeight: 700,
                                      }}
                                    >
                                      <i className="fas fa-map-pin me-1" />
                                      Out:{" "}
                                    </span>
                                    <span style={{ color: "#374151" }}>
                                      {visit.checkOut.location.address
                                        .split(",")
                                        .slice(0, 2)
                                        .join(",")}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Person Met & Purpose - Inline */}
                            {(visit.personMet || visit.purposeOfVisit) && (
                              <div
                                style={{
                                  marginBottom: "1rem",
                                  display: "grid",
                                  gridTemplateColumns:
                                    "repeat(auto-fit, minmax(150px, 1fr))",
                                  gap: "0.75rem",
                                }}
                              >
                                {visit.personMet && (
                                  <div style={{ fontSize: "0.8rem" }}>
                                    <span
                                      style={{
                                        color: "#6b7280",
                                        fontWeight: 600,
                                      }}
                                    >
                                      👤 Met:{" "}
                                    </span>
                                    <span
                                      style={{
                                        color: "#111827",
                                        fontWeight: 600,
                                      }}
                                    >
                                      {visit.personMet}
                                    </span>
                                  </div>
                                )}
                                {visit.purposeOfVisit && (
                                  <div style={{ fontSize: "0.8rem" }}>
                                    <span
                                      style={{
                                        color: "#6b7280",
                                        fontWeight: 600,
                                      }}
                                    >
                                      🎯 Purpose:{" "}
                                    </span>
                                    <span
                                      style={{
                                        color: "#111827",
                                        fontWeight: 600,
                                      }}
                                    >
                                      {visit.purposeOfVisit}
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Notes & Next Action - Minimalist */}
                            {(visit.outcome?.notes ||
                              visit.selfReportNote ||
                              visit.outcome?.nextAction ||
                              visit.outcome?.nextFollowUpDate) && (
                              <div
                                style={{
                                  display: "grid",
                                  gridTemplateColumns:
                                    "repeat(auto-fit, minmax(200px, 1fr))",
                                  gap: "0.75rem",
                                  marginBottom: "1rem",
                                }}
                              >
                                {(visit.outcome?.notes ||
                                  visit.selfReportNote) && (
                                  <div
                                    style={{
                                      background: "#fffbeb",
                                      border: "1px solid #fde68a",
                                      borderRadius: 8,
                                      padding: "0.6rem 0.75rem",
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: "0.7rem",
                                        fontWeight: 700,
                                        color: "#92400e",
                                        marginBottom: "0.3rem",
                                      }}
                                    >
                                      📝 Notes
                                    </div>
                                    <div
                                      style={{
                                        fontSize: "0.75rem",
                                        color: "#374151",
                                        lineHeight: 1.4,
                                      }}
                                    >
                                      {visit.outcome?.notes ||
                                        visit.selfReportNote}
                                    </div>
                                  </div>
                                )}
                                {(visit.outcome?.nextAction ||
                                  visit.outcome?.nextFollowUpDate) && (
                                  <div
                                    style={{
                                      background: "#f0f9ff",
                                      border: "1px solid #bae6fd",
                                      borderRadius: 8,
                                      padding: "0.6rem 0.75rem",
                                    }}
                                  >
                                    <div
                                      style={{
                                        fontSize: "0.7rem",
                                        fontWeight: 700,
                                        color: "#0369a1",
                                        marginBottom: "0.3rem",
                                      }}
                                    >
                                      📌 Next Action
                                    </div>
                                    {visit.outcome?.nextAction && (
                                      <div
                                        style={{
                                          fontSize: "0.75rem",
                                          color: "#374151",
                                          marginBottom: "0.3rem",
                                        }}
                                      >
                                        {visit.outcome.nextAction}
                                      </div>
                                    )}
                                    {visit.outcome?.nextFollowUpDate && (
                                      <div
                                        style={{
                                          fontSize: "0.7rem",
                                          color: "#0284c7",
                                        }}
                                      >
                                        {fmtDate(
                                          visit.outcome.nextFollowUpDate,
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Photos & Route - Bottom */}
                            <div
                              style={{
                                display: "flex",
                                gap: "1rem",
                                alignItems: "flex-start",
                                flexWrap: "wrap",
                              }}
                            >
                              {visit.photos?.length > 0 && (
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "0.5rem",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  {visit.photos.map((ph, pi) => (
                                    <div
                                      key={pi}
                                      onClick={() =>
                                        setLightbox({
                                          url: photoUrl(ph.url),
                                          caption:
                                            ph.address || visit.clientId?.name,
                                        })
                                      }
                                      style={{
                                        cursor: "pointer",
                                        borderRadius: 8,
                                        overflow: "hidden",
                                        border: "2px solid #e5e7eb",
                                        transition: "all 0.2s",
                                        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                                        position: "relative",
                                      }}
                                      onMouseEnter={(e) =>
                                        (e.currentTarget.style.boxShadow =
                                          "0 4px 8px rgba(102, 126, 234, 0.15)")
                                      }
                                      onMouseLeave={(e) =>
                                        (e.currentTarget.style.boxShadow =
                                          "0 1px 3px rgba(0,0,0,0.08)")
                                      }
                                    >
                                      <img
                                        src={photoUrl(ph.url)}
                                        alt="visit"
                                        style={{
                                          width: 70,
                                          height: 70,
                                          objectFit: "cover",
                                          display: "block",
                                        }}
                                      />
                                      <div
                                        style={{
                                          position: "absolute",
                                          inset: 0,
                                          background: "rgba(0,0,0,0)",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          transition: "background 0.2s",
                                        }}
                                        onMouseEnter={(e) =>
                                          (e.currentTarget.style.background =
                                            "rgba(102, 126, 234, 0.4)")
                                        }
                                        onMouseLeave={(e) =>
                                          (e.currentTarget.style.background =
                                            "rgba(0,0,0,0)")
                                        }
                                      >
                                        <i
                                          className="fas fa-expand-alt"
                                          style={{
                                            color: "white",
                                            fontSize: "0.85rem",
                                          }}
                                        />
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {visit.routePoints?.length > 1 && (
                                <Button
                                  size="sm"
                                  onClick={() => openRouteMap(visit)}
                                  style={{
                                    borderRadius: 8,
                                    fontSize: "0.75rem",
                                    background:
                                      "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                                    border: "none",
                                    padding: "0.5rem 1rem",
                                    color: "white",
                                    fontWeight: 600,
                                  }}
                                >
                                  <i className="fas fa-map me-1" />
                                  Route
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </Modal.Body>

        {/* Footer */}
        <Modal.Footer
          style={{
            background: "white",
            borderTop: "1px solid #e5e7eb",
            padding: "1rem 1.5rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div
            style={{
              fontSize: "0.75rem",
              color: "#9ca3af",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <i className="fas fa-info-circle" style={{ color: "#667eea" }} />
            Generated:{" "}
            {selectedReport &&
              fmtDate(selectedReport.generatedAt || selectedReport.updatedAt)}
          </div>
          <Button
            variant="outline-secondary"
            size="sm"
            onClick={() => setSelectedReport(null)}
            style={{
              borderRadius: 10,
              fontWeight: 600,
              border: "1.5px solid #e5e7eb",
            }}
          >
            <i className="fas fa-times me-1" />
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Route Map Modal */}
      <Modal
        show={showMapModal}
        onHide={() => setShowMapModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="fas fa-route me-2" />
            Route Map — {mapVisit?.clientId?.name}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: 0 }}>
          {mapVisit?.routePoints?.length > 0 && (
            <MapContainer
              center={[
                mapVisit.routePoints[0].lat,
                mapVisit.routePoints[0].lng,
              ]}
              zoom={14}
              style={{ height: 450, width: "100%" }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="© OpenStreetMap"
              />
              <Polyline
                positions={mapVisit.routePoints.map((p) => [p.lat, p.lng])}
                color="#3b82f6"
                weight={4}
              />
              <Marker
                position={[
                  mapVisit.routePoints[0].lat,
                  mapVisit.routePoints[0].lng,
                ]}
              >
                <Popup>Check-in point</Popup>
              </Marker>
              <Marker
                position={[
                  mapVisit.routePoints[mapVisit.routePoints.length - 1].lat,
                  mapVisit.routePoints[mapVisit.routePoints.length - 1].lng,
                ]}
              >
                <Popup>Check-out point</Popup>
              </Marker>
            </MapContainer>
          )}
        </Modal.Body>
      </Modal>

      {/* Lightbox */}
      {lightbox && (
        <div
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.9)",
            zIndex: 9999,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            cursor: "zoom-out",
          }}
        >
          <button
            onClick={() => setLightbox(null)}
            style={{
              position: "absolute",
              top: 20,
              right: 24,
              background: "rgba(255,255,255,0.15)",
              border: "none",
              borderRadius: 8,
              width: 38,
              height: 38,
              color: "white",
              fontSize: "1rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <i className="fas fa-times" />
          </button>
          <img
            src={lightbox.url}
            alt="visit"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: "90vw",
              maxHeight: "80vh",
              borderRadius: 12,
              boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
              objectFit: "contain",
              cursor: "default",
            }}
          />
          {lightbox.caption && (
            <div
              style={{
                marginTop: 14,
                color: "rgba(255,255,255,0.7)",
                fontSize: "0.85rem",
                maxWidth: "80vw",
                textAlign: "center",
              }}
            >
              <i className="fas fa-map-marker-alt me-1" />
              {lightbox.caption}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FieldReports;
