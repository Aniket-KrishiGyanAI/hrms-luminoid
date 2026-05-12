import React, { useState, useEffect } from "react";
import {
  Card,
  Button,
  Badge,
  Row,
  Col,
  Table,
  Form,
  InputGroup,
  Modal,
} from "react-bootstrap";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { toast } from "react-toastify";
import Swal from "sweetalert2";
import api from "../utils/api";
import { useAuth } from "../context/AuthContext";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require("leaflet/dist/images/marker-icon-2x.png"),
  iconUrl: require("leaflet/dist/images/marker-icon.png"),
  shadowUrl: require("leaflet/dist/images/marker-shadow.png"),
});

const TeamFieldActivity = () => {
  const { user } = useAuth();
  const [todayVisits, setTodayVisits] = useState([]);
  const [stats, setStats] = useState({
    activeEmployees: 0,
    completedVisits: 0,
    inProgressVisits: 0,
    totalDistance: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showMapModal, setShowMapModal] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [showVisitDetailModal, setShowVisitDetailModal] = useState(false);
  const [clients, setClients] = useState([]);
  const [showClientModal, setShowClientModal] = useState(false);
  const [clientForm, setClientForm] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    industry: '',
    priority: 'MEDIUM',
    status: 'PROSPECT',
    notes: ''
  });
  const [editingClient, setEditingClient] = useState(null);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [clientStatusFilter, setClientStatusFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState('activity'); // 'activity' or 'clients'
  const [imageLoadingStates, setImageLoadingStates] = useState({});
  
  const canDelete = user?.role === 'ADMIN' || user?.role === 'HR' || user?.role === 'MANAGER';

  useEffect(() => {
    fetchTodayActivity();
    fetchClients();
    const interval = setInterval(fetchTodayActivity, 60000); // Refresh every minute
    return () => clearInterval(interval);
  }, [selectedMonth]);

  const fetchTodayActivity = async () => {
    try {
      const res = await api.get(`/api/field-visits/today-all?month=${selectedMonth}`);
      setTodayVisits(res.data);
      calculateStats(res.data);
    } catch (error) {
      await Swal.fire({
        title: 'Error!',
        text: 'Failed to load field activity',
        icon: 'error',
        confirmButtonColor: '#10b981',
        customClass: {
          popup: 'rounded-3',
          confirmButton: 'fw-bold px-4'
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchClients = async () => {
    try {
      const res = await api.get('/api/field-clients');
      setClients(res.data);
    } catch (error) {
      await Swal.fire({
        title: 'Error!',
        text: 'Failed to load clients',
        icon: 'error',
        confirmButtonColor: '#10b981',
        customClass: {
          popup: 'rounded-3',
          confirmButton: 'fw-bold px-4'
        }
      });
    }
  };

  const calculateStats = (visits) => {
    const activeEmployees = new Set(
      visits.map((v) => v.employeeId?._id)
    ).size;
    const completedVisits = visits.filter(
      (v) => v.status === "COMPLETED"
    ).length;
    const inProgressVisits = visits.filter(
      (v) => v.status === "CHECKED_IN"
    ).length;
    const totalDistance = visits.reduce(
      (sum, v) => sum + (v.totalDistanceKm || 0),
      0
    );

    setStats({
      activeEmployees,
      completedVisits,
      inProgressVisits,
      totalDistance,
    });
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

  const getStatusBadge = (status) => {
    switch (status) {
      case "COMPLETED":
        return "success";
      case "CHECKED_IN":
        return "warning";
      case "PLANNED":
        return "info";
      default:
        return "secondary";
    }
  };

  const filteredVisits = todayVisits.filter((visit) => {
    const matchesSearch =
      searchTerm === "" ||
      `${visit.employeeId?.firstName} ${visit.employeeId?.lastName}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      visit.clientId?.name?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "ALL" || visit.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const groupedByEmployee = filteredVisits.reduce((acc, visit) => {
    const empId = visit.employeeId?._id;
    if (!empId) return acc;

    if (!acc[empId]) {
      acc[empId] = {
        employee: visit.employeeId,
        visits: [],
        totalDistance: 0,
        completed: 0,
        inProgress: 0,
        lastLocation: null,
      };
    }

    acc[empId].visits.push(visit);
    acc[empId].totalDistance += visit.totalDistanceKm || 0;
    if (visit.status === "COMPLETED") acc[empId].completed++;
    if (visit.status === "CHECKED_IN") acc[empId].inProgress++;

    // Get most recent location
    if (visit.checkIn?.location?.lat) {
      acc[empId].lastLocation = visit.checkIn.location;
    }

    return acc;
  }, {});

  const employeeData = Object.values(groupedByEmployee);

  const filteredClients = clients.filter((client) => {
    const matchesSearch =
      clientSearchTerm === "" ||
      client.name?.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
      client.contactPerson?.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
      client.phone?.toLowerCase().includes(clientSearchTerm.toLowerCase());

    const matchesStatus =
      clientStatusFilter === "ALL" || client.status === clientStatusFilter;

    return matchesSearch && matchesStatus;
  });

  // Detect duplicate clients
  const getDuplicateInfo = (client) => {
    const duplicates = clients.filter(c => {
      if (c._id === client._id) return false;
      
      const nameSimilar = c.name?.toLowerCase().trim() === client.name?.toLowerCase().trim();
      const phoneSimilar = client.phone && c.phone && 
        c.phone.replace(/\D/g, '') === client.phone.replace(/\D/g, '');
      
      return nameSimilar || phoneSimilar;
    });
    
    return {
      hasDuplicates: duplicates.length > 0,
      duplicateCount: duplicates.length,
      duplicates: duplicates
    };
  };

  const fmt = (d) =>
    d
      ? new Date(d).toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  const handleVisitClick = (visit) => {
    setSelectedVisit(visit);
    setShowVisitDetailModal(true);
    // Initialize all images as loading
    if (visit.photos && visit.photos.length > 0) {
      const initialStates = {};
      visit.photos.forEach((_, idx) => {
        initialStates[`${visit._id}-${idx}`] = true;
      });
      setImageLoadingStates(initialStates);
    }
  };

  const handleDeleteVisit = async (visitId, clientName) => {
    const result = await Swal.fire({
      title: 'Delete Visit?',
      html: `Are you sure you want to delete this visit to <strong>${clientName || 'this client'}</strong>?<br><br>This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: '<i class="fas fa-trash-alt me-2"></i>Yes, Delete',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      customClass: {
        popup: 'rounded-3',
        confirmButton: 'fw-bold px-4',
        cancelButton: 'fw-bold px-4'
      }
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/api/field-visits/${visitId}`);
        await Swal.fire({
          title: 'Deleted!',
          text: 'Visit has been deleted successfully.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
          customClass: {
            popup: 'rounded-3'
          }
        });
        fetchTodayActivity();
        setShowVisitDetailModal(false);
        setSelectedEmployee(null);
      } catch (error) {
        await Swal.fire({
          title: 'Error!',
          text: error.response?.data?.message || 'Failed to delete visit',
          icon: 'error',
          confirmButtonColor: '#10b981',
          customClass: {
            popup: 'rounded-3',
            confirmButton: 'fw-bold px-4'
          }
        });
      }
    }
  };

  const handleClientSubmit = async (e) => {
    e.preventDefault();
    
    // Check for potential duplicates before submitting
    const potentialDuplicates = clients.filter(client => {
      if (editingClient && client._id === editingClient._id) return false;
      
      const nameSimilar = client.name?.toLowerCase().trim() === clientForm.name?.toLowerCase().trim();
      const phoneSimilar = clientForm.phone && client.phone && 
        client.phone.replace(/\D/g, '') === clientForm.phone.replace(/\D/g, '');
      const addressSimilar = client.address?.toLowerCase().trim() === clientForm.address?.toLowerCase().trim();
      
      return nameSimilar || phoneSimilar || (nameSimilar && addressSimilar);
    });

    if (potentialDuplicates.length > 0 && !editingClient) {
      const duplicateList = potentialDuplicates.map(dup => 
        `<div style="text-align: left; padding: 0.5rem; background: #fef3c7; border-radius: 6px; margin: 0.5rem 0;">
          <strong>${dup.name}</strong><br>
          <small>Contact: ${dup.contactPerson} | Phone: ${dup.phone || 'N/A'} | Status: ${dup.status}</small>
        </div>`
      ).join('');
      
      const result = await Swal.fire({
        title: '<i class="fas fa-exclamation-triangle" style="color: #f59e0b;"></i> Potential Duplicate!',
        html: `<div style="text-align: left;">
          <p style="margin-bottom: 1rem;">A similar client already exists:</p>
          ${duplicateList}
          <p style="margin-top: 1rem; font-weight: 600;">Do you want to add this client anyway?</p>
        </div>`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#10b981',
        cancelButtonColor: '#6b7280',
        confirmButtonText: '<i class="fas fa-check me-2"></i>Yes, Add Anyway',
        cancelButtonText: 'Cancel',
        reverseButtons: true,
        customClass: {
          popup: 'rounded-3',
          confirmButton: 'fw-bold px-4',
          cancelButton: 'fw-bold px-4'
        }
      });
      
      if (!result.isConfirmed) return;
    }

    try {
      if (editingClient) {
        await api.put(`/api/field-clients/${editingClient._id}`, clientForm);
        await Swal.fire({
          title: 'Updated!',
          text: 'Client has been updated successfully.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
          customClass: {
            popup: 'rounded-3'
          }
        });
      } else {
        await api.post('/api/field-clients', clientForm);
        await Swal.fire({
          title: 'Added!',
          text: 'Client has been added successfully.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
          customClass: {
            popup: 'rounded-3'
          }
        });
      }
      setShowClientModal(false);
      setClientForm({
        name: '',
        contactPerson: '',
        phone: '',
        email: '',
        address: '',
        industry: '',
        priority: 'MEDIUM',
        status: 'PROSPECT',
        notes: ''
      });
      setEditingClient(null);
      fetchClients();
    } catch (error) {
      await Swal.fire({
        title: 'Error!',
        text: error.response?.data?.message || 'Failed to save client',
        icon: 'error',
        confirmButtonColor: '#10b981',
        customClass: {
          popup: 'rounded-3',
          confirmButton: 'fw-bold px-4'
        }
      });
    }
  };

  const handleEditClient = (client) => {
    setEditingClient(client);
    setClientForm({
      name: client.name,
      contactPerson: client.contactPerson,
      phone: client.phone || '',
      email: client.email || '',
      address: client.address,
      industry: client.industry || '',
      priority: client.priority,
      status: client.status,
      notes: client.notes || ''
    });
    setShowClientModal(true);
  };

  const handleDeleteClient = async (clientId, clientName) => {
    const result = await Swal.fire({
      title: 'Delete Client?',
      html: `Are you sure you want to delete <strong>${clientName}</strong>?<br><br>This action cannot be undone.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: '<i class="fas fa-trash-alt me-2"></i>Yes, Delete',
      cancelButtonText: 'Cancel',
      reverseButtons: true,
      customClass: {
        popup: 'rounded-3',
        confirmButton: 'fw-bold px-4',
        cancelButton: 'fw-bold px-4'
      }
    });

    if (result.isConfirmed) {
      try {
        await api.delete(`/api/field-clients/${clientId}`);
        await Swal.fire({
          title: 'Deleted!',
          text: 'Client has been deleted successfully.',
          icon: 'success',
          timer: 2000,
          showConfirmButton: false,
          customClass: {
            popup: 'rounded-3'
          }
        });
        fetchClients();
      } catch (error) {
        await Swal.fire({
          title: 'Error!',
          text: error.response?.data?.message || 'Failed to delete client',
          icon: 'error',
          confirmButtonColor: '#10b981',
          customClass: {
            popup: 'rounded-3',
            confirmButton: 'fw-bold px-4'
          }
        });
      }
    }
  };

  if (loading) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ height: "60vh" }}
      >
        <div className="spinner-border" style={{ color: "#10b981" }} />
      </div>
    );
  }

  return (
    <div
      className="fade-in-up pb-5"
      style={{
        background: "linear-gradient(to bottom, #f9fafb 0%, #ffffff 100%)",
        minHeight: "100vh",
      }}
    >
      {/* Header */}
      <div
        style={{
          background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
          padding: "2rem 1.5rem",
          marginBottom: "1.5rem",
          borderRadius: "0 0 24px 24px",
          boxShadow: "0 4px 20px rgba(16,185,129,0.2)",
        }}
      >
        <div style={{ maxWidth: "1400px", margin: "0 auto" }}>
          <div
            className="d-flex justify-content-between align-items-center"
            style={{ marginBottom: "1rem", flexWrap: "wrap", gap: "1rem" }}
          >
            <div>
              <h1
                style={{
                  color: "#fff",
                  fontSize: "2rem",
                  fontWeight: 700,
                  marginBottom: "0.25rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.75rem",
                }}
              >
                <div
                  style={{
                    width: 48,
                    height: 48,
                    background: "rgba(255,255,255,0.2)",
                    borderRadius: 12,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    backdropFilter: "blur(10px)",
                  }}
                >
                  <i className="fas fa-users" style={{ fontSize: "1.5rem" }} />
                </div>
                Team Field Activity
              </h1>
              <p
                style={{
                  color: "rgba(255,255,255,0.9)",
                  fontSize: "0.95rem",
                  marginBottom: 0,
                }}
              >
                Monitor your team's field visits
              </p>
            </div>
            <Button
              onClick={fetchTodayActivity}
              style={{
                background: "rgba(255,255,255,0.2)",
                backdropFilter: "blur(10px)",
                border: "1px solid rgba(255,255,255,0.3)",
                color: "#fff",
                borderRadius: 10,
                padding: "0.75rem 1.5rem",
                fontWeight: 600,
              }}
            >
              <i className="fas fa-sync-alt me-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "0 1rem" }}>
        {/* Tabs */}
        <div style={{ marginBottom: "1.5rem", display: "flex", gap: "0.5rem", borderBottom: "2px solid #e5e7eb" }}>
          <button
            onClick={() => setActiveTab('activity')}
            style={{
              padding: "0.75rem 1.5rem",
              background: activeTab === 'activity' ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" : "transparent",
              color: activeTab === 'activity' ? "#fff" : "#64748b",
              border: "none",
              borderRadius: "8px 8px 0 0",
              fontWeight: 600,
              fontSize: "0.95rem",
              cursor: "pointer",
              transition: "all 0.2s ease",
              borderBottom: activeTab === 'activity' ? "none" : "2px solid transparent",
            }}
          >
            <i className="fas fa-route me-2" />
            Field Activity
          </button>
          <button
            onClick={() => setActiveTab('clients')}
            style={{
              padding: "0.75rem 1.5rem",
              background: activeTab === 'clients' ? "linear-gradient(135deg, #10b981 0%, #059669 100%)" : "transparent",
              color: activeTab === 'clients' ? "#fff" : "#64748b",
              border: "none",
              borderRadius: "8px 8px 0 0",
              fontWeight: 600,
              fontSize: "0.95rem",
              cursor: "pointer",
              transition: "all 0.2s ease",
              borderBottom: activeTab === 'clients' ? "none" : "2px solid transparent",
            }}
          >
            <i className="fas fa-address-book me-2" />
            Client Directory
          </button>
        </div>

        {/* Stats Cards - Same Design */}
        {activeTab === 'activity' && (
        <Row className="g-3 mb-4">
          {[
            {
              label: "Active Employees",
              value: stats.activeEmployees,
              icon: "users",
              color: "#10b981",
              bg: "linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)",
            },
            {
              label: "Completed Visits",
              value: stats.completedVisits,
              icon: "check-circle",
              color: "#3b82f6",
              bg: "linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)",
            },
            {
              label: "In Progress",
              value: stats.inProgressVisits,
              icon: "clock",
              color: "#f59e0b",
              bg: "linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)",
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
                <Card.Body
                  className="text-center"
                  style={{ padding: "1.25rem" }}
                >
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
        )}

        {/* Search and Filter */}
        {activeTab === 'activity' && (
        <Card
          className="mb-4"
          style={{
            borderRadius: 14,
            border: "none",
            boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
          }}
        >
          <Card.Body style={{ padding: "1.25rem" }}>
            <Row className="g-3 align-items-center">
              <Col md={6}>
                <InputGroup>
                  <InputGroup.Text
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px 0 0 10px",
                    }}
                  >
                    <i className="fas fa-search" style={{ color: "#64748b" }} />
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Search by employee or client name..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderLeft: "none",
                      borderRadius: "0 10px 10px 0",
                    }}
                  />
                </InputGroup>
              </Col>
              <Col md={2}>
                <Form.Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{ borderRadius: 10, border: "1px solid #e2e8f0" }}
                >
                  <option value="ALL">All Status</option>
                  <option value="COMPLETED">Completed</option>
                  <option value="CHECKED_IN">In Progress</option>
                  <option value="PLANNED">Pending</option>
                </Form.Select>
              </Col>
              <Col md={2}>
                <Form.Control
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  style={{ borderRadius: 10, border: "1px solid #e2e8f0" }}
                />
              </Col>
              <Col md={2}>
                <Button
                  onClick={() => setShowMapModal(true)}
                  disabled={employeeData.length === 0}
                  style={{
                    width: "100%",
                    background:
                      "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                    border: "none",
                    borderRadius: 10,
                    fontWeight: 600,
                    boxShadow: "0 4px 12px rgba(16,185,129,0.3)",
                  }}
                >
                  <i className="fas fa-map-marked-alt me-2" />
                  View Map
                </Button>
              </Col>
            </Row>
          </Card.Body>
        </Card>
        )}

        {/* Employee Activity Table */}
        {activeTab === 'activity' && (
        <Card
          style={{
            borderRadius: 16,
            border: "none",
            boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
          }}
        >
          <Card.Body style={{ padding: "1.25rem" }}>
            <div
              style={{
                fontWeight: 700,
                fontSize: "1.1rem",
                color: "#1e293b",
                marginBottom: "1rem",
              }}
            >
              <i className="fas fa-list me-2" style={{ color: "#10b981" }} />
              Employee Activity
              <Badge
                bg="primary"
                className="ms-2"
                style={{ fontSize: "0.75rem" }}
              >
                {employeeData.length} employees
              </Badge>
            </div>

            {employeeData.length === 0 ? (
              <div className="text-center py-5" style={{ color: "#94a3b8" }}>
                <i
                  className="fas fa-users-slash"
                  style={{ fontSize: "3rem", marginBottom: 16, display: "block" }}
                />
                <h5 style={{ fontWeight: 600 }}>No field activity today</h5>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <Table hover responsive style={{ marginBottom: 0 }}>
                  <thead
                    style={{
                      background: "#f8fafc",
                      borderBottom: "2px solid #e5e7eb",
                    }}
                  >
                    <tr>
                      <th
                        style={{
                          fontWeight: 600,
                          fontSize: "0.8rem",
                          color: "#64748b",
                          padding: "0.75rem",
                        }}
                      >
                        Employee
                      </th>
                      <th
                        style={{
                          fontWeight: 600,
                          fontSize: "0.8rem",
                          color: "#64748b",
                          padding: "0.75rem",
                        }}
                      >
                        Contact
                      </th>
                      <th
                        style={{
                          fontWeight: 600,
                          fontSize: "0.8rem",
                          color: "#64748b",
                          padding: "0.75rem",
                        }}
                      >
                        Total Visits
                      </th>
                      <th
                        style={{
                          fontWeight: 600,
                          fontSize: "0.8rem",
                          color: "#64748b",
                          padding: "0.75rem",
                        }}
                      >
                        Completed
                      </th>
                      <th
                        style={{
                          fontWeight: 600,
                          fontSize: "0.8rem",
                          color: "#64748b",
                          padding: "0.75rem",
                        }}
                      >
                        In Progress
                      </th>
                      <th
                        style={{
                          fontWeight: 600,
                          fontSize: "0.8rem",
                          color: "#64748b",
                          padding: "0.75rem",
                        }}
                      >
                        Distance
                      </th>
                      <th
                        style={{
                          fontWeight: 600,
                          fontSize: "0.8rem",
                          color: "#64748b",
                          padding: "0.75rem",
                        }}
                      >
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {employeeData.map((emp) => (
                      <tr
                        key={emp.employee._id}
                        style={{
                          cursor: "pointer",
                          transition: "all 0.2s ease",
                        }}
                        onClick={() => setSelectedEmployee(emp)}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "#f8fafc")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                      >
                        <td
                          style={{
                            padding: "0.875rem",
                            verticalAlign: "middle",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                            <img
                              src={emp.employee.profileImage || `https://ui-avatars.com/api/?name=${emp.employee.firstName}+${emp.employee.lastName}&background=10b981&color=fff&size=128`}
                              alt={`${emp.employee.firstName} ${emp.employee.lastName}`}
                              style={{
                                width: 48,
                                height: 48,
                                borderRadius: "50%",
                                objectFit: "cover",
                                border: "2px solid #e5e7eb",
                              }}
                              onError={(e) => {
                                e.target.src = `https://ui-avatars.com/api/?name=${emp.employee.firstName}+${emp.employee.lastName}&background=10b981&color=fff&size=128`;
                              }}
                            />
                            <div>
                              <div
                                style={{
                                  fontWeight: 600,
                                  fontSize: "0.875rem",
                                  color: "#1e293b",
                                }}
                              >
                                {emp.employee.firstName} {emp.employee.lastName}
                              </div>
                              <div style={{ fontSize: "0.7rem", color: "#6b7280" }}>
                                {emp.employee.designation || "—"}
                              </div>
                              <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
                                {emp.employee.department || "—"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td
                          style={{
                            padding: "0.875rem",
                            verticalAlign: "middle",
                          }}
                        >
                          <div style={{ fontSize: "0.75rem" }}>
                            <div style={{ color: "#1e293b", marginBottom: "0.25rem" }}>
                              <i className="fas fa-envelope" style={{ color: "#64748b", marginRight: "0.25rem" }} />
                              {emp.employee.email || "—"}
                            </div>
                          </div>
                        </td>
                        <td
                          style={{
                            padding: "0.875rem",
                            verticalAlign: "middle",
                          }}
                        >
                          <Badge
                            bg="secondary"
                            style={{ fontSize: "0.8rem", fontWeight: 600 }}
                          >
                            {emp.visits.length}
                          </Badge>
                        </td>
                        <td
                          style={{
                            padding: "0.875rem",
                            verticalAlign: "middle",
                          }}
                        >
                          <Badge
                            bg="success"
                            style={{ fontSize: "0.8rem", fontWeight: 600 }}
                          >
                            {emp.completed}
                          </Badge>
                        </td>
                        <td
                          style={{
                            padding: "0.875rem",
                            verticalAlign: "middle",
                          }}
                        >
                          <Badge
                            bg="warning"
                            style={{ fontSize: "0.8rem", fontWeight: 600 }}
                          >
                            {emp.inProgress}
                          </Badge>
                        </td>
                        <td
                          style={{
                            padding: "0.875rem",
                            verticalAlign: "middle",
                          }}
                        >
                          <span style={{ fontWeight: 700, color: "#10b981" }}>
                            {emp.totalDistance.toFixed(1)} km
                          </span>
                        </td>
                        <td
                          style={{
                            padding: "0.875rem",
                            verticalAlign: "middle",
                          }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <Button
                              size="sm"
                              onClick={() => setSelectedEmployee(emp)}
                              style={{
                                background: "#dbeafe",
                                border: "none",
                                color: "#2563eb",
                                borderRadius: 7,
                                fontWeight: 600,
                                fontSize: "0.8rem",
                              }}
                            >
                              <i className="fas fa-eye me-1" />
                              View
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>
        )}
      </div>

      {/* Employee Details Modal */}
      <Modal
        show={selectedEmployee !== null}
        onHide={() => setSelectedEmployee(null)}
        size="lg"
        centered
        scrollable
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
            <i className="fas fa-user-circle me-2" />
            {selectedEmployee?.employee.firstName}{" "}
            {selectedEmployee?.employee.lastName}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: "1.5rem", maxHeight: "70vh", overflowY: "auto" }}>
          {selectedEmployee && (
            <>
              {/* Summary */}
              <Row className="g-3 mb-4">
                <Col xs={4}>
                  <div
                    style={{
                      background: "#f0fdf4",
                      borderRadius: 10,
                      padding: "1rem",
                      textAlign: "center",
                      border: "1px solid #bbf7d0",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "1.5rem",
                        fontWeight: 700,
                        color: "#059669",
                      }}
                    >
                      {selectedEmployee.visits.length}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      Total Visits
                    </div>
                  </div>
                </Col>
                <Col xs={4}>
                  <div
                    style={{
                      background: "#dbeafe",
                      borderRadius: 10,
                      padding: "1rem",
                      textAlign: "center",
                      border: "1px solid #93c5fd",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "1.5rem",
                        fontWeight: 700,
                        color: "#2563eb",
                      }}
                    >
                      {selectedEmployee.completed}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      Completed
                    </div>
                  </div>
                </Col>
                <Col xs={4}>
                  <div
                    style={{
                      background: "#fef3c7",
                      borderRadius: 10,
                      padding: "1rem",
                      textAlign: "center",
                      border: "1px solid #fcd34d",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "1.5rem",
                        fontWeight: 700,
                        color: "#d97706",
                      }}
                    >
                      {selectedEmployee.totalDistance.toFixed(1)}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                      Total KM
                    </div>
                  </div>
                </Col>
              </Row>

              {/* Visit List */}
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  color: "#1e293b",
                  marginBottom: "0.75rem",
                }}
              >
                Visit History
              </div>
              <div style={{ overflowX: "auto" }}>
                <Table hover responsive style={{ marginBottom: 0 }}>
                  <thead style={{ background: "#f8fafc", borderBottom: "2px solid #e5e7eb" }}>
                    <tr>
                      <th style={{ fontWeight: 600, fontSize: "0.75rem", color: "#64748b", padding: "0.75rem" }}>
                        Client
                      </th>
                      <th style={{ fontWeight: 600, fontSize: "0.75rem", color: "#64748b", padding: "0.75rem" }}>
                        Time
                      </th>
                      <th style={{ fontWeight: 600, fontSize: "0.75rem", color: "#64748b", padding: "0.75rem" }}>
                        Status
                      </th>
                      <th style={{ fontWeight: 600, fontSize: "0.75rem", color: "#64748b", padding: "0.75rem" }}>
                        Distance
                      </th>
                      <th style={{ fontWeight: 600, fontSize: "0.75rem", color: "#64748b", padding: "0.75rem" }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEmployee.visits.map((visit) => (
                      <tr
                        key={visit._id}
                        style={{ cursor: "pointer", transition: "all 0.2s ease" }}
                        onClick={() => handleVisitClick(visit)}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "#f8fafc")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                      >
                        <td style={{ padding: "0.75rem", verticalAlign: "middle" }}>
                          <div style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1e293b" }}>
                            {visit.clientId?.name || "Unknown Client"}
                          </div>
                          {visit.clientId?.address && (
                            <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                              <i className="fas fa-map-marker-alt me-1" />
                              {visit.clientId.address.substring(0, 40)}{visit.clientId.address.length > 40 ? '...' : ''}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "0.75rem", verticalAlign: "middle" }}>
                          <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                            {visit.checkIn && (
                              <div>
                                <i className="fas fa-sign-in-alt me-1" style={{ color: "#10b981" }} />
                                {fmt(visit.checkIn.time)}
                              </div>
                            )}
                            {visit.checkOut && (
                              <div style={{ marginTop: "0.25rem" }}>
                                <i className="fas fa-sign-out-alt me-1" style={{ color: "#ef4444" }} />
                                {fmt(visit.checkOut.time)}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "0.75rem", verticalAlign: "middle" }}>
                          <Badge bg={getStatusBadge(visit.status)} style={{ fontSize: "0.7rem" }}>
                            {visit.status === "CHECKED_IN" ? "In Progress" : visit.status === "COMPLETED" ? "Completed" : "Pending"}
                          </Badge>
                        </td>
                        <td style={{ padding: "0.75rem", verticalAlign: "middle" }}>
                          <span style={{ fontWeight: 600, color: "#10b981", fontSize: "0.85rem" }}>
                            {visit.totalDistanceKm > 0 ? `${visit.totalDistanceKm.toFixed(1)} km` : "—"}
                          </span>
                        </td>
                        <td style={{ padding: "0.75rem", verticalAlign: "middle" }} onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <Button
                              size="sm"
                              onClick={() => handleVisitClick(visit)}
                              style={{
                                background: "#dbeafe",
                                border: "none",
                                color: "#2563eb",
                                borderRadius: 6,
                                fontWeight: 600,
                                fontSize: "0.75rem",
                                padding: "0.4rem 0.75rem",
                              }}
                            >
                              <i className="fas fa-eye me-1" />
                              View
                            </Button>
                            {canDelete && (
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteVisit(visit._id, visit.clientId?.name);
                                }}
                                style={{
                                  borderRadius: 6,
                                  fontWeight: 600,
                                  fontSize: "0.75rem",
                                  padding: "0.4rem 0.75rem",
                                }}
                              >
                                <i className="fas fa-trash-alt" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </>
          )}
        </Modal.Body>
      </Modal>

      {/* Map Modal */}
      <Modal
        show={showMapModal}
        onHide={() => setShowMapModal(false)}
        size="xl"
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
            <i className="fas fa-map-marked-alt me-2" />
            Team Locations (Last Check-in)
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: 0 }}>
          {employeeData.length > 0 &&
          employeeData.some((e) => e.lastLocation) ? (
            <MapContainer
              center={[
                employeeData.find((e) => e.lastLocation)?.lastLocation?.lat ||
                  28.6139,
                employeeData.find((e) => e.lastLocation)?.lastLocation?.lng ||
                  77.209,
              ]}
              zoom={12}
              style={{ height: 500, width: "100%" }}
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="© OpenStreetMap"
              />
              {employeeData.map(
                (emp) =>
                  emp.lastLocation && (
                    <React.Fragment key={emp.employee._id}>
                      <Marker
                        position={[emp.lastLocation.lat, emp.lastLocation.lng]}
                      >
                        <Popup>
                          <div style={{ padding: "0.5rem" }}>
                            <strong style={{ fontSize: "0.9rem" }}>
                              {emp.employee.firstName} {emp.employee.lastName}
                            </strong>
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "#64748b",
                                marginTop: "0.25rem",
                              }}
                            >
                              {emp.employee.department}
                            </div>
                            <div
                              style={{
                                marginTop: "0.5rem",
                                paddingTop: "0.5rem",
                                borderTop: "1px solid #e5e7eb",
                                fontSize: "0.75rem",
                              }}
                            >
                              <div>
                                <strong>Visits:</strong> {emp.visits.length}
                              </div>
                              <div>
                                <strong>Completed:</strong> {emp.completed}
                              </div>
                              <div>
                                <strong>Distance:</strong>{" "}
                                {emp.totalDistance.toFixed(1)} km
                              </div>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                    </React.Fragment>
                  )
              )}
            </MapContainer>
          ) : (
            <div
              className="d-flex align-items-center justify-content-center"
              style={{ height: 400, background: "#f8fafc" }}
            >
              <div className="text-center" style={{ color: "#94a3b8" }}>
                <i
                  className="fas fa-map-marked-alt"
                  style={{ fontSize: "2rem", marginBottom: 8, display: "block" }}
                />
                No location data available
              </div>
            </div>
          )}
        </Modal.Body>
      </Modal>

      {/* Visit Detail Modal */}
      <Modal
        show={showVisitDetailModal}
        onHide={() => setShowVisitDetailModal(false)}
        size="lg"
        centered
        scrollable
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
            Visit Details
          </Modal.Title>
        </Modal.Header>
        <Modal.Body style={{ padding: "1.5rem", maxHeight: "75vh", overflowY: "auto" }}>
          {selectedVisit && (
            <>

              {/* Visit Photos */}
              {selectedVisit.photos && Array.isArray(selectedVisit.photos) && selectedVisit.photos.length > 0 ? (
                <div style={{ marginBottom: "1.5rem" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1e293b", marginBottom: "0.75rem" }}>
                    <i className="fas fa-images me-2" style={{ color: "#10b981" }} />
                    Visit Photos ({selectedVisit.photos.length})
                  </div>
                  <Row className="g-3">
                    {selectedVisit.photos.map((photo, idx) => {
                      const imageKey = `${selectedVisit._id}-${idx}`;
                      const isLoading = imageLoadingStates[imageKey] === true;
                      
                      return (
                      <Col xs={12} md={6} key={idx}>
                        <div
                          style={{
                            borderRadius: 12,
                            overflow: "hidden",
                            border: "2px solid #e5e7eb",
                            background: "#f8fafc",
                            boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                            position: "relative",
                            minHeight: 200,
                          }}
                        >
                          {isLoading && (
                            <div
                              style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                right: 0,
                                height: 200,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                justifyContent: "center",
                                background: "#f8fafc",
                                zIndex: 2,
                              }}
                            >
                              <div className="spinner-border" style={{ color: "#10b981", width: "3rem", height: "3rem" }} />
                              <div style={{ marginTop: "1rem", fontSize: "0.85rem", color: "#64748b" }}>Loading image...</div>
                            </div>
                          )}
                          <img
                            src={photo.url || photo}
                            alt={`Visit Photo ${idx + 1}`}
                            loading="eager"
                            onLoad={() => {
                              setImageLoadingStates(prev => ({ ...prev, [imageKey]: false }));
                            }}
                            onError={(e) => {
                              e.target.onerror = null;
                              e.target.src = 'https://via.placeholder.com/400x300?text=Image+Not+Available';
                              setImageLoadingStates(prev => ({ ...prev, [imageKey]: false }));
                            }}
                            style={{
                              width: "100%",
                              height: 200,
                              objectFit: "cover",
                              cursor: "pointer",
                              opacity: isLoading ? 0 : 1,
                              transition: "opacity 0.3s ease",
                            }}
                            onClick={() => window.open(photo.url || photo, '_blank')}
                          />
                          {(photo.address || photo.capturedAt) && (
                            <div style={{ padding: "0.75rem", background: "#fff" }}>
                              {photo.address && (
                                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                                  <i className="fas fa-map-marker-alt me-1" style={{ color: "#10b981" }} />
                                  {photo.address}
                                </div>
                              )}
                              {photo.capturedAt && (
                                <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                                  <i className="fas fa-clock me-1" />
                                  {new Date(photo.capturedAt).toLocaleString()}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </Col>
                      );
                    })}
                  </Row>
                </div>
              ) : (
                <div style={{ 
                  marginBottom: "1.5rem", 
                  padding: "1rem", 
                  background: "#f8fafc", 
                  borderRadius: 10,
                  textAlign: "center",
                  color: "#94a3b8"
                }}>
                  <i className="fas fa-camera" style={{ fontSize: "2rem", marginBottom: "0.5rem", display: "block" }} />
                  <div style={{ fontSize: "0.85rem" }}>No photos available for this visit</div>
                </div>
              )}

              {/* Client Information */}
              <Card style={{ borderRadius: 12, border: "1px solid #e5e7eb", marginBottom: "1rem" }}>
                <Card.Body style={{ padding: "1.25rem" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1e293b", marginBottom: "1rem" }}>
                    <i className="fas fa-building me-2" style={{ color: "#10b981" }} />
                    Client Information
                  </div>
                  <Row className="g-3">
                    <Col xs={12}>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>Client Name</div>
                      <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "#1e293b" }}>
                        {selectedVisit.clientId?.name || "Unknown Client"}
                      </div>
                    </Col>
                    {(selectedVisit.clientId?.contactPerson || selectedVisit.personMet) && (
                      <Col xs={12} md={6}>
                        <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>Contact Person</div>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1e293b" }}>
                          <i className="fas fa-user me-2" style={{ color: "#64748b" }} />
                          {selectedVisit.clientId?.contactPerson || selectedVisit.personMet}
                        </div>
                      </Col>
                    )}
                    {(selectedVisit.clientId?.phone || selectedVisit.phone) && (
                      <Col xs={12} md={6}>
                        <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>Phone</div>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1e293b" }}>
                          <i className="fas fa-phone me-2" style={{ color: "#64748b" }} />
                          {selectedVisit.clientId?.phone || selectedVisit.phone}
                        </div>
                      </Col>
                    )}
                    {(selectedVisit.clientId?.email || selectedVisit.email) && (
                      <Col xs={12}>
                        <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>Email</div>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1e293b" }}>
                          <i className="fas fa-envelope me-2" style={{ color: "#64748b" }} />
                          {selectedVisit.clientId?.email || selectedVisit.email}
                        </div>
                      </Col>
                    )}
                    {(selectedVisit.clientId?.address || selectedVisit.checkIn?.location?.address) && (
                      <Col xs={12}>
                        <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>Address</div>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1e293b" }}>
                          <i className="fas fa-map-marker-alt me-2" style={{ color: "#64748b" }} />
                          {selectedVisit.clientId?.address || selectedVisit.checkIn?.location?.address}
                        </div>
                      </Col>
                    )}
                  </Row>
                </Card.Body>
              </Card>

              {/* Visit Information */}
              <Card style={{ borderRadius: 12, border: "1px solid #e5e7eb", marginBottom: "1rem" }}>
                <Card.Body style={{ padding: "1.25rem" }}>
                  <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1e293b", marginBottom: "1rem" }}>
                    <i className="fas fa-info-circle me-2" style={{ color: "#10b981" }} />
                    Visit Information
                  </div>
                  <Row className="g-3">
                    <Col xs={12} md={6}>
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>Status</div>
                      <Badge bg={getStatusBadge(selectedVisit.status)} style={{ fontSize: "0.8rem" }}>
                        {selectedVisit.status === "CHECKED_IN" ? "In Progress" : selectedVisit.status === "COMPLETED" ? "Completed" : "Pending"}
                      </Badge>
                    </Col>
                    {selectedVisit.checkIn && (
                      <Col xs={12} md={6}>
                        <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>Check-in Time</div>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#10b981" }}>
                          <i className="fas fa-sign-in-alt me-2" />
                          {new Date(selectedVisit.checkIn.time).toLocaleString()}
                        </div>
                      </Col>
                    )}
                    {selectedVisit.checkOut && (
                      <Col xs={12} md={6}>
                        <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>Check-out Time</div>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#ef4444" }}>
                          <i className="fas fa-sign-out-alt me-2" />
                          {new Date(selectedVisit.checkOut.time).toLocaleString()}
                        </div>
                      </Col>
                    )}
                    {selectedVisit.durationMinutes > 0 && (
                      <Col xs={12} md={6}>
                        <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>Duration</div>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1e293b" }}>
                          <i className="fas fa-clock me-2" style={{ color: "#64748b" }} />
                          {Math.floor(selectedVisit.durationMinutes / 60)}h {selectedVisit.durationMinutes % 60}m
                        </div>
                      </Col>
                    )}
                    {selectedVisit.totalDistanceKm > 0 && (
                      <Col xs={12} md={6}>
                        <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>Distance Traveled</div>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#10b981" }}>
                          <i className="fas fa-road me-2" />
                          {selectedVisit.totalDistanceKm.toFixed(2)} km
                        </div>
                      </Col>
                    )}
                    {selectedVisit.purposeOfVisit && (
                      <Col xs={12}>
                        <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>Purpose of Visit</div>
                        <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1e293b" }}>
                          <i className="fas fa-clipboard-list me-2" style={{ color: "#64748b" }} />
                          {selectedVisit.purposeOfVisit}
                        </div>
                      </Col>
                    )}
                  </Row>
                </Card.Body>
              </Card>

              {/* Outcome Information */}
              {selectedVisit.outcome && (
                <Card style={{ borderRadius: 12, border: "1px solid #e5e7eb", marginBottom: "1rem" }}>
                  <Card.Body style={{ padding: "1.25rem" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#1e293b", marginBottom: "1rem" }}>
                      <i className="fas fa-chart-line me-2" style={{ color: "#10b981" }} />
                      Visit Outcome
                    </div>
                    <Row className="g-3">
                      {selectedVisit.outcome.status && (
                        <Col xs={12}>
                          <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>Outcome Status</div>
                          <Badge
                            bg={
                              selectedVisit.outcome.status === "POSITIVE" || selectedVisit.outcome.status === "ORDER_RECEIVED"
                                ? "success"
                                : selectedVisit.outcome.status === "NEGATIVE" || selectedVisit.outcome.status === "NO_RESPONSE"
                                ? "danger"
                                : "warning"
                            }
                            style={{ fontSize: "0.8rem" }}
                          >
                            {selectedVisit.outcome.status.replace(/_/g, " ")}
                          </Badge>
                        </Col>
                      )}
                      {selectedVisit.outcome.notes && (
                        <Col xs={12}>
                          <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.25rem" }}>Notes</div>
                          <div
                            style={{
                              background: "#f8fafc",
                              padding: "0.75rem",
                              borderRadius: 8,
                              borderLeft: "3px solid #10b981",
                              fontSize: "0.85rem",
                              color: "#1e293b",
                            }}
                          >
                            {selectedVisit.outcome.notes}
                          </div>
                        </Col>
                      )}
                    </Row>
                  </Card.Body>
                </Card>
              )}

              {/* Delete Button */}
              {canDelete && (
                <Button
                  variant="danger"
                  onClick={() => handleDeleteVisit(selectedVisit._id, selectedVisit.clientId?.name)}
                  style={{
                    width: "100%",
                    borderRadius: 10,
                    fontWeight: 600,
                    padding: "0.75rem",
                  }}
                >
                  <i className="fas fa-trash-alt me-2" />
                  Delete Visit
                </Button>
              )}
            </>
          )}
        </Modal.Body>
      </Modal>

      {/* Client Directory Section */}
      {activeTab === 'clients' && (
      <div style={{ maxWidth: "1400px", margin: "0 auto", padding: "0 1rem" }}>
        <Card
          style={{
            borderRadius: 16,
            border: "none",
            boxShadow: "0 4px 20px rgba(0,0,0,0.1)",
            marginBottom: "2rem",
          }}
        >
          <Card.Body style={{ padding: "1.5rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.5rem",
                flexWrap: "wrap",
                gap: "1rem",
              }}
            >
              <div>
                <h4
                  style={{
                    fontWeight: 700,
                    fontSize: "1.3rem",
                    color: "#1e293b",
                    marginBottom: "0.25rem",
                  }}
                >
                  <i className="fas fa-address-book me-2" style={{ color: "#10b981" }} />
                  Client Directory
                </h4>
                <p style={{ fontSize: "0.85rem", color: "#64748b", marginBottom: 0 }}>
                  Manage your field clients and contacts
                </p>
              </div>
              <Button
                onClick={() => {
                  setEditingClient(null);
                  setClientForm({
                    name: '',
                    contactPerson: '',
                    phone: '',
                    email: '',
                    address: '',
                    industry: '',
                    priority: 'MEDIUM',
                    status: 'PROSPECT',
                    notes: ''
                  });
                  setShowClientModal(true);
                }}
                style={{
                  background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                  border: "none",
                  borderRadius: 10,
                  fontWeight: 600,
                  padding: "0.75rem 1.5rem",
                  boxShadow: "0 4px 12px rgba(16,185,129,0.3)",
                }}
              >
                <i className="fas fa-plus me-2" />
                Add Client
              </Button>
            </div>

            {/* Client Filters */}
            <Row className="g-3 mb-4">
              <Col md={6}>
                <InputGroup>
                  <InputGroup.Text
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: "10px 0 0 10px",
                    }}
                  >
                    <i className="fas fa-search" style={{ color: "#64748b" }} />
                  </InputGroup.Text>
                  <Form.Control
                    type="text"
                    placeholder="Search clients..."
                    value={clientSearchTerm}
                    onChange={(e) => setClientSearchTerm(e.target.value)}
                    style={{
                      border: "1px solid #e2e8f0",
                      borderLeft: "none",
                      borderRadius: "0 10px 10px 0",
                    }}
                  />
                </InputGroup>
              </Col>
              <Col md={3}>
                <Form.Select
                  value={clientStatusFilter}
                  onChange={(e) => setClientStatusFilter(e.target.value)}
                  style={{ borderRadius: 10, border: "1px solid #e2e8f0" }}
                >
                  <option value="ALL">All Status</option>
                  <option value="PROSPECT">Prospect</option>
                  <option value="ACTIVE">Active</option>
                  <option value="CONVERTED">Converted</option>
                  <option value="INACTIVE">Inactive</option>
                </Form.Select>
              </Col>
              <Col md={3}>
                <div
                  style={{
                    background: "#f0fdf4",
                    borderRadius: 10,
                    padding: "0.75rem 1rem",
                    textAlign: "center",
                    border: "1px solid #bbf7d0",
                  }}
                >
                  <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "#059669" }}>
                    {filteredClients.length}
                  </span>
                  <span style={{ fontSize: "0.75rem", color: "#6b7280", marginLeft: "0.5rem" }}>
                    Clients
                  </span>
                </div>
              </Col>
            </Row>

            {/* Client Table */}
            {filteredClients.length === 0 ? (
              <div className="text-center py-5" style={{ color: "#94a3b8" }}>
                <i
                  className="fas fa-address-book"
                  style={{ fontSize: "3rem", marginBottom: 16, display: "block" }}
                />
                <h5 style={{ fontWeight: 600 }}>No clients found</h5>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <Table hover responsive style={{ marginBottom: 0 }}>
                  <thead
                    style={{
                      background: "#f8fafc",
                      borderBottom: "2px solid #e5e7eb",
                    }}
                  >
                    <tr>
                      <th style={{ fontWeight: 600, fontSize: "0.8rem", color: "#64748b", padding: "0.75rem" }}>
                        Client Name
                      </th>
                      <th style={{ fontWeight: 600, fontSize: "0.8rem", color: "#64748b", padding: "0.75rem" }}>
                        Contact Person
                      </th>
                      <th style={{ fontWeight: 600, fontSize: "0.8rem", color: "#64748b", padding: "0.75rem" }}>
                        Phone
                      </th>
                      <th style={{ fontWeight: 600, fontSize: "0.8rem", color: "#64748b", padding: "0.75rem" }}>
                        Industry
                      </th>
                      <th style={{ fontWeight: 600, fontSize: "0.8rem", color: "#64748b", padding: "0.75rem" }}>
                        Status
                      </th>
                      <th style={{ fontWeight: 600, fontSize: "0.8rem", color: "#64748b", padding: "0.75rem" }}>
                        Priority
                      </th>
                      <th style={{ fontWeight: 600, fontSize: "0.8rem", color: "#64748b", padding: "0.75rem" }}>
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredClients.map((client) => {
                      const dupInfo = getDuplicateInfo(client);
                      return (
                      <tr
                        key={client._id}
                        style={{ 
                          transition: "all 0.2s ease",
                          background: dupInfo.hasDuplicates ? "#fef3c7" : "transparent"
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = dupInfo.hasDuplicates ? "#fde68a" : "#f8fafc")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = dupInfo.hasDuplicates ? "#fef3c7" : "transparent")}
                      >
                        <td style={{ padding: "0.875rem", verticalAlign: "middle" }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "#1e293b", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              {client.name}
                              {dupInfo.hasDuplicates && (
                                <span
                                  style={{
                                    background: "#f59e0b",
                                    color: "#fff",
                                    fontSize: "0.65rem",
                                    padding: "0.15rem 0.5rem",
                                    borderRadius: "4px",
                                    fontWeight: 700,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "0.25rem"
                                  }}
                                  title={`${dupInfo.duplicateCount} potential duplicate(s) found`}
                                >
                                  <i className="fas fa-exclamation-triangle" style={{ fontSize: "0.6rem" }} />
                                  DUPLICATE?
                                </span>
                              )}
                            </div>
                            {client.address && (
                              <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                                <i className="fas fa-map-marker-alt me-1" />
                                {client.address.substring(0, 40)}{client.address.length > 40 ? '...' : ''}
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: "0.875rem", verticalAlign: "middle" }}>
                          <div style={{ fontSize: "0.85rem", color: "#1e293b" }}>
                            {client.contactPerson}
                          </div>
                          {client.email && (
                            <div style={{ fontSize: "0.7rem", color: "#64748b", marginTop: "0.25rem" }}>
                              <i className="fas fa-envelope me-1" />
                              {client.email}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: "0.875rem", verticalAlign: "middle" }}>
                          <span style={{ fontSize: "0.85rem", color: "#1e293b" }}>
                            {client.phone || "—"}
                          </span>
                        </td>
                        <td style={{ padding: "0.875rem", verticalAlign: "middle" }}>
                          <span style={{ fontSize: "0.85rem", color: "#64748b" }}>
                            {client.industry || "—"}
                          </span>
                        </td>
                        <td style={{ padding: "0.875rem", verticalAlign: "middle" }}>
                          <Badge
                            bg={
                              client.status === "ACTIVE"
                                ? "success"
                                : client.status === "CONVERTED"
                                ? "primary"
                                : client.status === "PROSPECT"
                                ? "info"
                                : "secondary"
                            }
                            style={{ fontSize: "0.7rem" }}
                          >
                            {client.status}
                          </Badge>
                        </td>
                        <td style={{ padding: "0.875rem", verticalAlign: "middle" }}>
                          <Badge
                            bg={
                              client.priority === "HIGH"
                                ? "danger"
                                : client.priority === "MEDIUM"
                                ? "warning"
                                : "secondary"
                            }
                            style={{ fontSize: "0.7rem" }}
                          >
                            {client.priority}
                          </Badge>
                        </td>
                        <td style={{ padding: "0.875rem", verticalAlign: "middle" }}>
                          <div style={{ display: "flex", gap: "0.5rem" }}>
                            <Button
                              size="sm"
                              onClick={() => handleEditClient(client)}
                              style={{
                                background: "#dbeafe",
                                border: "none",
                                color: "#2563eb",
                                borderRadius: 6,
                                fontWeight: 600,
                                fontSize: "0.75rem",
                                padding: "0.4rem 0.75rem",
                              }}
                            >
                              <i className="fas fa-edit" />
                            </Button>
                            {canDelete && (
                              <Button
                                size="sm"
                                variant="danger"
                                onClick={() => handleDeleteClient(client._id, client.name)}
                                style={{
                                  borderRadius: 6,
                                  fontWeight: 600,
                                  fontSize: "0.75rem",
                                  padding: "0.4rem 0.75rem",
                                }}
                              >
                                <i className="fas fa-trash-alt" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            )}
          </Card.Body>
        </Card>
      </div>
      )}

      {/* Client Modal */}
      <Modal
        show={showClientModal}
        onHide={() => {
          setShowClientModal(false);
          setEditingClient(null);
        }}
        size="lg"
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
            <i className={`fas fa-${editingClient ? 'edit' : 'plus'} me-2`} />
            {editingClient ? 'Edit Client' : 'Add New Client'}
          </Modal.Title>
        </Modal.Header>
        <Form onSubmit={handleClientSubmit}>
          <Modal.Body style={{ padding: "1.5rem" }}>
            <Row className="g-3">
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1e293b" }}>
                    Client Name <span style={{ color: "#ef4444" }}>*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={clientForm.name}
                    onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                    required
                    style={{ borderRadius: 8 }}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1e293b" }}>
                    Contact Person <span style={{ color: "#ef4444" }}>*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={clientForm.contactPerson}
                    onChange={(e) => setClientForm({ ...clientForm, contactPerson: e.target.value })}
                    required
                    style={{ borderRadius: 8 }}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1e293b" }}>
                    Phone
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={clientForm.phone}
                    onChange={(e) => setClientForm({ ...clientForm, phone: e.target.value })}
                    style={{ borderRadius: 8 }}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1e293b" }}>
                    Email
                  </Form.Label>
                  <Form.Control
                    type="email"
                    value={clientForm.email}
                    onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                    style={{ borderRadius: 8 }}
                  />
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1e293b" }}>
                    Address <span style={{ color: "#ef4444" }}>*</span>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={clientForm.address}
                    onChange={(e) => setClientForm({ ...clientForm, address: e.target.value })}
                    required
                    style={{ borderRadius: 8 }}
                  />
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1e293b" }}>
                    Industry
                  </Form.Label>
                  <Form.Control
                    type="text"
                    value={clientForm.industry}
                    onChange={(e) => setClientForm({ ...clientForm, industry: e.target.value })}
                    style={{ borderRadius: 8 }}
                  />
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1e293b" }}>
                    Status
                  </Form.Label>
                  <Form.Select
                    value={clientForm.status}
                    onChange={(e) => setClientForm({ ...clientForm, status: e.target.value })}
                    style={{ borderRadius: 8 }}
                  >
                    <option value="PROSPECT">Prospect</option>
                    <option value="ACTIVE">Active</option>
                    <option value="CONVERTED">Converted</option>
                    <option value="INACTIVE">Inactive</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={3}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1e293b" }}>
                    Priority
                  </Form.Label>
                  <Form.Select
                    value={clientForm.priority}
                    onChange={(e) => setClientForm({ ...clientForm, priority: e.target.value })}
                    style={{ borderRadius: 8 }}
                  >
                    <option value="LOW">Low</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HIGH">High</option>
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col md={12}>
                <Form.Group>
                  <Form.Label style={{ fontWeight: 600, fontSize: "0.85rem", color: "#1e293b" }}>
                    Notes
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    value={clientForm.notes}
                    onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
                    style={{ borderRadius: 8 }}
                  />
                </Form.Group>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer style={{ borderTop: "1px solid #e5e7eb", padding: "1rem 1.5rem" }}>
            <Button
              variant="secondary"
              onClick={() => {
                setShowClientModal(false);
                setEditingClient(null);
              }}
              style={{ borderRadius: 8, fontWeight: 600 }}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              style={{
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                border: "none",
                borderRadius: 8,
                fontWeight: 600,
              }}
            >
              <i className={`fas fa-${editingClient ? 'save' : 'plus'} me-2`} />
              {editingClient ? 'Update Client' : 'Add Client'}
            </Button>
          </Modal.Footer>
        </Form>
      </Modal>
    </div>
  );
};

export default TeamFieldActivity;
