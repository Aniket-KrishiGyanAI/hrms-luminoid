import React, { useState, useEffect } from "react";
import { Card, Button, Badge, Row, Col, Modal, Form } from "react-bootstrap";
import { toast } from "react-toastify";
import api from "../utils/api";

const MyFieldWork = () => {
  const [todayVisits, setTodayVisits] = useState([]);
  const [stats, setStats] = useState({
    completed: 0,
    inProgress: 0,
    pending: 0,
    totalDistance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [showCheckOutModal, setShowCheckOutModal] = useState(false);
  const [showQuickLogModal, setShowQuickLogModal] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [outcome, setOutcome] = useState({
    status: "NEUTRAL",
    notes: "",
    nextAction: "",
    nextFollowUpDate: "",
  });
  const [quickLog, setQuickLog] = useState({
    clientName: "",
    personMet: "",
    phone: "",
    purposeOfVisit: "",
    notes: "",
    outcome: "NEUTRAL",
  });
  const [quickLogPhoto, setQuickLogPhoto] = useState(null);
  const [quickLogGps, setQuickLogGps] = useState(null);
  const [gpsLoading, setGpsLoading] = useState(false);
  const [quickLogSubmitting, setQuickLogSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const photoInputRef = React.useRef(null);

  useEffect(() => {
    fetchTodayVisits();
  }, []);

  const fetchTodayVisits = async () => {
    try {
      const res = await api.get("/api/field-visits/today");
      console.log('Today visits data:', res.data);
      console.log('First visit photos:', res.data[0]?.photos);
      setTodayVisits(res.data);
      calculateStats(res.data);
    } catch (error) {
      toast.error("Failed to load visits");
    } finally {
      setLoading(false);
    }
  };

  const calculateStats = (visits) => {
    const completed = visits.filter((v) => v.status === "COMPLETED").length;
    const inProgress = visits.filter((v) => v.status === "CHECKED_IN").length;
    const pending = visits.filter((v) => v.status === "PLANNED").length;
    const totalDistance = visits.reduce(
      (sum, v) => sum + (v.totalDistanceKm || 0),
      0
    );

    setStats({ completed, inProgress, pending, totalDistance });
  };

  const handleCheckIn = async (visitId) => {
    if (!navigator.geolocation) {
      toast.error("GPS not supported on this device");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng, accuracy } = position.coords;

        try {
          await api.post(`/api/field-visits/${visitId}/check-in`, {
            lat,
            lng,
            accuracy,
          });
          toast.success("✅ Checked in successfully!");
          fetchTodayVisits();
        } catch (error) {
          toast.error(error.response?.data?.message || "Check-in failed");
        }
      },
      (error) => {
        let msg = "Unable to get location. ";
        if (error.code === error.PERMISSION_DENIED) {
          msg += "Please allow location access.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          msg += "GPS unavailable. Try going outside.";
        } else {
          msg += "Please try again.";
        }
        toast.error(msg);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const openCheckOutModal = (visit) => {
    setSelectedVisit(visit);
    setShowCheckOutModal(true);
  };

  const handleCheckOut = async () => {
    if (!navigator.geolocation) {
      toast.error("GPS not supported on this device");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude: lat, longitude: lng, accuracy } = position.coords;

        try {
          await api.post(`/api/field-visits/${selectedVisit._id}/check-out`, {
            lat,
            lng,
            accuracy,
          });

          await api.post(
            `/api/field-visits/${selectedVisit._id}/outcome`,
            outcome
          );

          toast.success("✅ Visit completed!");
          setShowCheckOutModal(false);
          setOutcome({
            status: "NEUTRAL",
            notes: "",
            nextAction: "",
            nextFollowUpDate: "",
          });
          fetchTodayVisits();
        } catch (error) {
          toast.error(error.response?.data?.message || "Check-out failed");
        }
      },
      (error) => {
        toast.error("Unable to get location for check-out");
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const handleQuickLog = async () => {
    if (!quickLog.clientName.trim()) {
      toast.error("Client name is required");
      return;
    }

    setQuickLogSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("clientName", quickLog.clientName);
      formData.append("personMet", quickLog.personMet);
      formData.append("phone", quickLog.phone);
      formData.append("address", quickLogGps?.address || "");
      formData.append("purposeOfVisit", quickLog.purposeOfVisit);
      formData.append("notes", quickLog.notes);
      formData.append("outcome", quickLog.outcome);
      formData.append("dealValue", "");
      
      if (quickLogGps) {
        formData.append("lat", quickLogGps.lat);
        formData.append("lng", quickLogGps.lng);
      }

      if (quickLogPhoto?.file) {
        formData.append("photo", quickLogPhoto.file);
      }

      await api.post("/api/field-visits/self-report", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      toast.success("✅ Visit logged successfully!");
      setShowQuickLogModal(false);
      setQuickLog({
        clientName: "",
        personMet: "",
        phone: "",
        purposeOfVisit: "",
        notes: "",
        outcome: "NEUTRAL",
      });
      setQuickLogPhoto(null);
      setQuickLogGps(null);
      fetchTodayVisits();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to log visit");
    } finally {
      setQuickLogSubmitting(false);
    }
  };

  const captureGPS = async () => {
    setGpsLoading(true);
    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
        });
      });

      const { latitude: lat, longitude: lng } = position.coords;
      
      // Get address from coordinates
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await res.json();
      const address = data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

      setQuickLogGps({ lat, lng, address });
      toast.success("✅ Location captured!");
    } catch (error) {
      toast.error("Unable to get location. Please try again.");
    } finally {
      setGpsLoading(false);
    }
  };

  const handlePhotoCapture = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setQuickLogPhoto({
      file,
      preview: URL.createObjectURL(file),
    });

    // Auto-capture GPS if not already captured
    if (!quickLogGps) {
      toast.info("📍 Capturing location...");
      captureGPS();
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "COMPLETED":
        return "#10b981";
      case "CHECKED_IN":
        return "#f59e0b";
      case "PLANNED":
        return "#3b82f6";
      default:
        return "#6b7280";
    }
  };

  const handleDeleteVisit = async (visitId) => {
    if (!window.confirm('Delete this visit log? This cannot be undone.')) return;
    setDeletingId(visitId);
    try {
      await api.delete(`/api/field-visits/${visitId}`);
      toast.success('Visit deleted');
      fetchTodayVisits();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to delete visit');
    } finally {
      setDeletingId(null);
    }
  };

  const fmt = (d) =>
    d
      ? new Date(d).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  if (loading) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ height: "60vh" }}
      >
        <div className="spinner-border text-success" />
      </div>
    );
  }

  return (
    <div className="fade-in-up pb-5">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">
          <i className="fas fa-briefcase me-2" style={{ color: "#10b981" }} />
          My Field Work
        </h1>
        <p className="text-muted">Manage your client visits for today</p>
      </div>

      {/* Stats Cards - Same Design as Journey Dashboard */}
      <Row className="g-3 mb-4">
        {[
          {
            label: "Completed",
            value: stats.completed,
            icon: "check-circle",
            color: "#10b981",
            bg: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
          },
          {
            label: "In Progress",
            value: stats.inProgress,
            icon: "clock",
            color: "#f59e0b",
            bg: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
          },
          {
            label: "Pending",
            value: stats.pending,
            icon: "calendar-check",
            color: "#3b82f6",
            bg: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)",
          },
          {
            label: "Total Distance",
            value: `${stats.totalDistance.toFixed(1)} km`,
            icon: "road",
            color: "#8b5cf6",
            bg: "linear-gradient(135deg, #ede9fe 0%, #ddd6fe 100%)",
          },
        ].map((s, i) => (
          <Col xs={6} md={3} key={i}>
            <Card
              style={{
                borderRadius: 14,
                border: "none",
                background: s.bg,
                boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <Card.Body className="text-center" style={{ padding: "1.25rem" }}>
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    background: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    margin: "0 auto 0.75rem",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                  }}
                >
                  <i
                    className={`fas fa-${s.icon}`}
                    style={{ color: s.color, fontSize: "1.75rem" }}
                  />
                </div>
                <div
                  style={{
                    fontSize: "1.75rem",
                    fontWeight: 700,
                    color: "#1e293b",
                    marginBottom: "0.25rem",
                  }}
                >
                  {s.value}
                </div>
                <div
                  style={{
                    fontSize: "0.8rem",
                    color: "#64748b",
                    fontWeight: 600,
                  }}
                >
                  {s.label}
                </div>
              </Card.Body>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Quick Actions */}
      <Row className="g-2 mb-4">
        <Col md={6}>
          <Button
            onClick={() => setShowQuickLogModal(true)}
            style={{
              width: "100%",
              background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
              border: "none",
              borderRadius: 12,
              padding: "1rem",
              fontWeight: 600,
              boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
            }}
          >
            <i className="fas fa-plus-circle" style={{ fontSize: "1.2rem" }} />
            <span>Quick Visit Log</span>
          </Button>
        </Col>
        <Col md={6}>
          <Button
            onClick={() => window.open('https://docs.google.com/forms/d/e/1FAIpQLSfWH86nivabf5ReP3M1Sm7ysMBElA-ZuDrhEVvfuajKrE3rsw/viewform?pli=1', '_blank')}
            style={{
              width: "100%",
              background: "linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)",
              border: "none",
              borderRadius: 12,
              padding: "1rem",
              fontWeight: 600,
              boxShadow: "0 4px 12px rgba(139,92,246,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem",
            }}
          >
            <i className="fas fa-file-alt" style={{ fontSize: "1.2rem" }} />
            <span>FPO Form</span>
          </Button>
        </Col>
      </Row>

      {/* Today's Visits */}
      <Card
        style={{
          borderRadius: 16,
          border: "none",
          boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
        }}
      >
        <Card.Body style={{ padding: "1.5rem" }}>
          <div
            style={{
              fontWeight: 700,
              fontSize: "1.1rem",
              color: "#1e293b",
              marginBottom: "1.5rem",
            }}
          >
            <i className="fas fa-calendar-day me-2" style={{ color: "#10b981" }} />
            Today's Visits
            <Badge bg="primary" className="ms-2" style={{ fontSize: "0.75rem" }}>
              {todayVisits.length}
            </Badge>
          </div>

          {todayVisits.length === 0 ? (
            <div className="text-center py-5" style={{ color: "#94a3b8" }}>
              <i className="fas fa-calendar-times" style={{ fontSize: "3rem", marginBottom: 16, display: "block" }} />
              <h5 style={{ fontWeight: 600 }}>No visits scheduled today</h5>
              <p style={{ fontSize: "0.9rem" }}>Check back tomorrow or contact your manager</p>
            </div>
          ) : (
            <Row className="g-3">
              {todayVisits.map((visit) => (
                <Col xs={12} sm={6} md={4} key={visit._id}>
                  <Card
                    style={{
                      borderRadius: 12,
                      border: `2px solid ${getStatusColor(visit.status)}40`,
                      background: visit.status === "CHECKED_IN" ? "#fef3c7" : visit.status === "COMPLETED" ? "#f0fdf4" : "#f8fafc",
                      boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                      height: "100%",
                    }}
                  >
                    <Card.Body style={{ padding: "1rem" }}>
                      {/* Status + Client */}
                      <div className="d-flex justify-content-between align-items-start mb-2">
                        <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1e293b", flex: 1, marginRight: 8 }}>
                          {visit.clientId?.name || "Unknown Client"}
                        </div>
                        <Badge style={{ background: getStatusColor(visit.status), fontSize: "0.68rem", borderRadius: 6, whiteSpace: "nowrap" }}>
                          {visit.status === "CHECKED_IN" ? "In Progress" : visit.status === "COMPLETED" ? "Done" : "Pending"}
                        </Badge>
                      </div>

                      {/* Contact */}
                      <div style={{ fontSize: "0.78rem", color: "#64748b", marginBottom: "0.4rem" }}>
                        <i className="fas fa-user me-1" />
                        {visit.clientId?.contactPerson || visit.personMet || "N/A"}
                        {(visit.clientId?.phone || visit.phone) && (
                          <span className="ms-2"><i className="fas fa-phone me-1" />{visit.clientId?.phone || visit.phone}</span>
                        )}
                      </div>

                      {/* Purpose */}
                      {visit.purposeOfVisit && (
                        <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.4rem" }}>
                          <i className="fas fa-clipboard-list me-1" />{visit.purposeOfVisit}
                        </div>
                      )}

                      {/* Timing row */}
                      {(visit.checkIn || visit.checkOut || visit.totalDistanceKm > 0) && (
                        <div className="d-flex gap-2 flex-wrap mb-2" style={{ fontSize: "0.72rem", color: "#64748b" }}>
                          {visit.checkIn?.time && <span><i className="fas fa-sign-in-alt me-1 text-success" />{fmt(visit.checkIn.time)}</span>}
                          {visit.checkOut?.time && <span><i className="fas fa-sign-out-alt me-1 text-danger" />{fmt(visit.checkOut.time)}</span>}
                          {visit.totalDistanceKm > 0 && <span><i className="fas fa-road me-1 text-primary" />{visit.totalDistanceKm.toFixed(1)} km</span>}
                          {visit.durationMinutes > 0 && <span><i className="fas fa-clock me-1 text-warning" />{Math.floor(visit.durationMinutes / 60)}h {visit.durationMinutes % 60}m</span>}
                        </div>
                      )}

                      {/* Outcome badge */}
                      {visit.outcome?.status && (
                        <div className="mb-2">
                          <Badge
                            bg={visit.outcome.status === "POSITIVE" || visit.outcome.status === "ORDER_RECEIVED" ? "success" : visit.outcome.status === "NEGATIVE" || visit.outcome.status === "NO_RESPONSE" ? "danger" : "warning"}
                            style={{ fontSize: "0.68rem" }}
                          >
                            {visit.outcome.status.replace(/_/g, " ")}
                          </Badge>
                        </div>
                      )}

                      {/* Action Button */}
                      <div className="d-flex gap-2">
                        {visit.status === "PLANNED" && (
                          <Button size="sm" onClick={() => handleCheckIn(visit._id)} style={{ flex: 1, background: "linear-gradient(135deg,#10b981,#059669)", border: "none", borderRadius: 8, fontWeight: 600, fontSize: "0.8rem" }}>
                            <i className="fas fa-sign-in-alt me-1" />Check In
                          </Button>
                        )}
                        {visit.status === "CHECKED_IN" && (
                          <Button size="sm" onClick={() => openCheckOutModal(visit)} style={{ flex: 1, background: "linear-gradient(135deg,#f59e0b,#d97706)", border: "none", borderRadius: 8, fontWeight: 600, fontSize: "0.8rem" }}>
                            <i className="fas fa-sign-out-alt me-1" />Check Out
                          </Button>
                        )}
                        {visit.status === "COMPLETED" && (
                          <div style={{ flex: 1, textAlign: "center", padding: "0.4rem", background: "rgba(16,185,129,0.1)", borderRadius: 8, color: "#059669", fontWeight: 600, fontSize: "0.8rem" }}>
                            <i className="fas fa-check-circle me-1" />Completed
                          </div>
                        )}
                        {visit.selfReported && (
                          <Button
                            size="sm"
                            disabled={deletingId === visit._id}
                            onClick={() => handleDeleteVisit(visit._id)}
                            style={{ background: "#fee2e2", border: "1px solid #fca5a5", color: "#dc2626", borderRadius: 8, fontWeight: 600, fontSize: "0.8rem", padding: "0.3rem 0.6rem" }}
                          >
                            {deletingId === visit._id
                              ? <span className="spinner-border spinner-border-sm" />
                              : <i className="fas fa-trash" />}
                          </Button>
                        )}
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              ))}
            </Row>
          )}
        </Card.Body>
      </Card>

      {/* Check-out Modal */}
      <Modal
        show={showCheckOutModal}
        onHide={() => setShowCheckOutModal(false)}
        centered
      >
        <Modal.Header
          closeButton
          style={{
            background: "linear-gradient(135deg, #10b981, #059669)",
            color: "#fff",
            border: "none",
          }}
        >
          <Modal.Title style={{ fontWeight: 700 }}>
            <i className="fas fa-clipboard-check me-2" />
            Complete Visit
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: "1.5rem" }}>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                Visit Outcome
              </Form.Label>
              <Form.Select
                value={outcome.status}
                onChange={(e) =>
                  setOutcome({ ...outcome, status: e.target.value })
                }
                style={{ borderRadius: 8 }}
              >
                <option value="POSITIVE">Positive</option>
                <option value="NEUTRAL">Neutral</option>
                <option value="NEGATIVE">Negative</option>
                <option value="ORDER_RECEIVED">Order Received</option>
                <option value="DEMO_SCHEDULED">Demo Scheduled</option>
                <option value="PROPOSAL_SENT">Proposal Sent</option>
                <option value="NO_RESPONSE">No Response</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                Visit Notes
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={outcome.notes}
                onChange={(e) =>
                  setOutcome({ ...outcome, notes: e.target.value })
                }
                placeholder="What happened during the visit?"
                style={{ borderRadius: 8 }}
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                Next Action (Optional)
              </Form.Label>
              <Form.Control
                type="text"
                value={outcome.nextAction}
                onChange={(e) =>
                  setOutcome({ ...outcome, nextAction: e.target.value })
                }
                placeholder="e.g., Send quotation, Schedule demo"
                style={{ borderRadius: 8 }}
              />
            </Form.Group>

            <Form.Group>
              <Form.Label style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                Follow-up Date (Optional)
              </Form.Label>
              <Form.Control
                type="date"
                value={outcome.nextFollowUpDate}
                onChange={(e) =>
                  setOutcome({ ...outcome, nextFollowUpDate: e.target.value })
                }
                style={{ borderRadius: 8 }}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer style={{ border: "none", padding: "1rem 1.5rem" }}>
          <Button
            variant="outline-secondary"
            onClick={() => setShowCheckOutModal(false)}
            style={{ borderRadius: 8, fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCheckOut}
            style={{
              background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              padding: "0.5rem 1.5rem",
              boxShadow: "0 4px 12px rgba(16,185,129,0.3)",
            }}
          >
            <i className="fas fa-check me-2" />
            Complete Visit
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Quick Visit Log Modal */}
      <Modal
        show={showQuickLogModal}
        onHide={() => setShowQuickLogModal(false)}
        size="lg"
        centered
      >
        <Modal.Header
          closeButton
          style={{
            background: "linear-gradient(135deg, #3b82f6, #2563eb)",
            color: "#fff",
            border: "none",
          }}
        >
          <Modal.Title style={{ fontWeight: 700 }}>
            <i className="fas fa-plus-circle me-2" />
            Quick Visit Log
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: "1.5rem" }}>
          <div
            style={{
              background: "#dbeafe",
              borderRadius: 10,
              padding: "1rem",
              marginBottom: "1.5rem",
              border: "1px solid #93c5fd",
            }}
          >
            <div style={{ fontSize: "0.85rem", color: "#1e40af" }}>
              <i className="fas fa-info-circle me-2" />
              <strong>Quick Log:</strong> Capture a photo and your GPS location will be tagged automatically.
            </div>
          </div>

          {/* Photo Capture Section */}
          <div className="mb-4">
            <div className="d-flex align-items-center gap-2 mb-2">
              <i className="fas fa-camera" style={{ fontSize: "1rem", color: "#10b981" }} />
              <span style={{ fontWeight: 600, fontSize: "0.9rem" }}>Visit Photo</span>
              <Badge bg="secondary" style={{ fontSize: "0.7rem" }}>with GPS</Badge>
            </div>

            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: "none" }}
              onChange={handlePhotoCapture}
            />

            {quickLogPhoto ? (
              <div className="position-relative d-inline-block" style={{ width: "100%" }}>
                <img
                  src={quickLogPhoto.preview}
                  alt="visit"
                  style={{
                    width: "100%",
                    maxHeight: 220,
                    objectFit: "cover",
                    borderRadius: 10,
                    border: "2px solid #10b981",
                  }}
                />
                <Button
                  size="sm"
                  variant="danger"
                  style={{
                    position: "absolute",
                    top: 6,
                    right: 6,
                    borderRadius: 20,
                    padding: "2px 8px",
                  }}
                  onClick={() => setQuickLogPhoto(null)}
                >
                  <i className="fas fa-times" />
                </Button>
                {quickLogGps && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: 8,
                      left: 8,
                      background: "rgba(0,0,0,0.6)",
                      color: "white",
                      borderRadius: 6,
                      padding: "3px 8px",
                      fontSize: "0.72rem",
                    }}
                  >
                    <i className="fas fa-map-marker-alt me-1" />
                    {quickLogGps.address.split(",")[0]}
                  </div>
                )}
              </div>
            ) : (
              <div
                onClick={() => photoInputRef.current.click()}
                style={{
                  border: "2px dashed #d1d5db",
                  borderRadius: 10,
                  padding: "2rem",
                  textAlign: "center",
                  cursor: "pointer",
                  background: "#f9fafb",
                }}
              >
                <i className="fas fa-camera text-muted" style={{ fontSize: "2rem" }} />
                <p className="text-muted mb-0 mt-2" style={{ fontSize: "0.88rem" }}>
                  Tap to capture photo
                </p>
                <small className="text-muted">GPS location will be attached automatically</small>
              </div>
            )}

            {/* GPS Status */}
            <div className="mt-3">
              {!quickLogGps ? (
                <button
                  type="button"
                  onClick={captureGPS}
                  disabled={gpsLoading}
                  style={{
                    width: "100%",
                    border: "none",
                    borderRadius: 14,
                    padding: "0",
                    cursor: gpsLoading ? "not-allowed" : "pointer",
                    background: "none",
                    outline: "none",
                  }}
                >
                  <div
                    style={{
                      background: "linear-gradient(135deg, #10b981, #059669)",
                      borderRadius: 14,
                      padding: "1rem 1.25rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "1rem",
                      boxShadow: "0 4px 20px rgba(16,185,129,0.35)",
                    }}
                  >
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 12,
                        background: "rgba(255,255,255,0.2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <i
                        className={
                          gpsLoading ? "fas fa-circle-notch fa-spin" : "fas fa-satellite-dish"
                        }
                        style={{ color: "white", fontSize: "1.4rem" }}
                      />
                    </div>
                    <div style={{ textAlign: "left", flex: 1 }}>
                      <div
                        style={{
                          color: "white",
                          fontWeight: 700,
                          fontSize: "0.95rem",
                          lineHeight: 1.2,
                        }}
                      >
                        {gpsLoading ? "Locating you..." : "Capture GPS Location"}
                      </div>
                      <div
                        style={{
                          color: "rgba(255,255,255,0.8)",
                          fontSize: "0.75rem",
                          marginTop: 3,
                        }}
                      >
                        {gpsLoading
                          ? "Getting your coordinates"
                          : "Tap to tag this visit with your location"}
                      </div>
                    </div>
                    {!gpsLoading && (
                      <i
                        className="fas fa-chevron-right"
                        style={{ color: "rgba(255,255,255,0.7)", fontSize: "0.85rem" }}
                      />
                    )}
                  </div>
                </button>
              ) : (
                <div
                  style={{
                    background: "linear-gradient(135deg, #ecfdf5, #d1fae5)",
                    border: "1.5px solid #6ee7b7",
                    borderRadius: 14,
                    padding: "0.85rem 1.1rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.75rem",
                  }}
                >
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: "linear-gradient(135deg, #10b981, #059669)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      boxShadow: "0 2px 8px rgba(16,185,129,0.4)",
                    }}
                  >
                    <i
                      className="fas fa-map-marker-alt"
                      style={{ color: "white", fontSize: "1rem" }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.8rem", color: "#065f46" }}>
                      Location Captured ✓
                    </div>
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "#047857",
                        marginTop: 2,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {quickLogGps.address.split(",").slice(0, 2).join(",")}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setQuickLogGps(null)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "#6b7280",
                      cursor: "pointer",
                      padding: 4,
                      flexShrink: 0,
                    }}
                  >
                    <i className="fas fa-redo" style={{ fontSize: "0.8rem" }} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <Form>
            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                    Client Name *
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={quickLog.clientName}
                    onChange={(e) => setQuickLog({ ...quickLog, clientName: e.target.value })}
                    placeholder="Enter client/company name"
                    style={{ borderRadius: 8 }}
                    autoFocus
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                    Person Met
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={quickLog.personMet}
                    onChange={(e) => setQuickLog({ ...quickLog, personMet: e.target.value })}
                    placeholder="Contact person name"
                    style={{ borderRadius: 8 }}
                  />
                </Form.Group>
              </Col>
            </Row>

            <Row>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                    Phone Number
                  </Form.Label>
                  <Form.Control
                    type="tel"
                    value={quickLog.phone}
                    onChange={(e) => setQuickLog({ ...quickLog, phone: e.target.value })}
                    placeholder="Contact number"
                    style={{ borderRadius: 8 }}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group className="mb-3">
                  <Form.Label style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                    Visit Outcome *
                  </Form.Label>
                  <Form.Select
                    value={quickLog.outcome}
                    onChange={(e) => setQuickLog({ ...quickLog, outcome: e.target.value })}
                    style={{ borderRadius: 8 }}
                  >
                    <option value="POSITIVE">Positive</option>
                    <option value="NEUTRAL">Neutral</option>
                    <option value="NEGATIVE">Negative</option>
                    <option value="ORDER_RECEIVED">Order Received</option>
                    <option value="DEMO_SCHEDULED">Demo Scheduled</option>
                    <option value="PROPOSAL_SENT">Proposal Sent</option>
                    <option value="NO_RESPONSE">No Response</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            </Row>

            <Form.Group className="mb-3">
              <Form.Label style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                Purpose of Visit
              </Form.Label>
              <Form.Select
                value={quickLog.purposeOfVisit}
                onChange={(e) => setQuickLog({ ...quickLog, purposeOfVisit: e.target.value })}
                style={{ borderRadius: 8 }}
              >
                <option value="">Select purpose...</option>
                <option value="Product Demo">Product Demo</option>
                <option value="Follow-up Meeting">Follow-up Meeting</option>
                <option value="New Client Meeting">New Client Meeting</option>
                <option value="Quotation Discussion">Quotation Discussion</option>
                <option value="Order Collection">Order Collection</option>
                <option value="Payment Collection">Payment Collection</option>
                <option value="Complaint Resolution">Complaint Resolution</option>
                <option value="Relationship Building">Relationship Building</option>
                <option value="Market Survey">Market Survey</option>
                <option value="Other">Other</option>
              </Form.Select>
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label style={{ fontWeight: 600, fontSize: "0.9rem" }}>
                Quick Notes (Optional)
              </Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={quickLog.notes}
                onChange={(e) => setQuickLog({ ...quickLog, notes: e.target.value })}
                placeholder="What happened during the visit? Any follow-up needed?"
                style={{ borderRadius: 8 }}
              />
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer style={{ border: "none", padding: "1rem 1.5rem" }}>
          <Button
            variant="outline-secondary"
            onClick={() => setShowQuickLogModal(false)}
            style={{ borderRadius: 8, fontWeight: 600 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleQuickLog}
            disabled={!quickLog.clientName.trim() || quickLogSubmitting}
            style={{
              background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
              border: "none",
              borderRadius: 8,
              fontWeight: 600,
              padding: "0.5rem 1.5rem",
              boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
              opacity: quickLogSubmitting ? 0.7 : 1,
              cursor: quickLogSubmitting ? "not-allowed" : "pointer",
            }}
          >
            {quickLogSubmitting ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" />
                Submitting...
              </>
            ) : (
              <>
                <i className="fas fa-check me-2" />
                Log Visit
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default MyFieldWork;
