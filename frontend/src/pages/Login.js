import React, { useState } from "react";
import {
  Container,
  Row,
  Col,
  Card,
  Form,
  Button,
  Alert,
} from "react-bootstrap";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import "../styles/Login.css";

const Login = () => {
  const [formData, setFormData] = useState({ email: "", password: "" });
  const [regData, setRegData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showRegPassword, setShowRegPassword] = useState(false);
  const { login, register, isAuthenticated } = useAuth();
  const [mode, setMode] = useState("login"); // 'login' or 'register'

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await login(formData.email, formData.password);

    if (!result.success) {
      setError(result.message);
    }

    setLoading(false);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleRegChange = (e) => {
    setRegData({ ...regData, [e.target.name]: e.target.value });
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const payload = { ...regData, role: "EMPLOYEE" };
    const result = await register(payload);

    if (!result.success) {
      setError(result.message);
    }

    setLoading(false);
  };

  return (
    <div className="modern-login-container">
      {/* Animated Background */}
      <div className="animated-bg">
        <div className="gradient-orb orb-1"></div>
        <div className="gradient-orb orb-2"></div>
        <div className="gradient-orb orb-3"></div>
      </div>

      <Container fluid className="position-relative" style={{ zIndex: 1 }}>
        <Row className="justify-content-center align-items-center min-vh-100 g-0">
          {/* Left: Brand Section */}
          <Col
            lg={6}
            className="d-none d-lg-flex flex-column justify-content-center align-items-center text-white px-5"
          >
            <div className="brand-section fade-in-left">
              <div className="brand-icon-large mb-4">
                <i className="fas fa-building"></i>
              </div>
              <h1 className="display-4 fw-bold mb-3">Luminoid HRMS</h1>
              <p className="lead mb-4">Modern Human Resource Management System</p>
              <div className="feature-list">
                <div className="feature-item">
                  <i className="fas fa-check-circle me-2"></i>
                  <span>Leave Management</span>
                </div>
                <div className="feature-item">
                  <i className="fas fa-check-circle me-2"></i>
                  <span>Attendance Tracking</span>
                </div>
                <div className="feature-item">
                  <i className="fas fa-check-circle me-2"></i>
                  <span>Employee Dashboard</span>
                </div>
                <div className="feature-item">
                  <i className="fas fa-check-circle me-2"></i>
                  <span>Real-time Analytics</span>
                </div>
              </div>
            </div>
          </Col>

          {/* Right: Login Form */}
          <Col
            xs={12}
            sm={10}
            md={8}
            lg={6}
            xl={5}
            className="d-flex justify-content-center px-3 px-md-5"
          >
            <div className="w-100" style={{ maxWidth: "480px" }}>
              <Card className="glass-card border-0 shadow-2xl fade-in-up">
                <Card.Body className="p-4 p-md-5">
                  <div className="text-center mb-4">
                    <div className="login-icon-wrapper mb-3">
                      <i className="fas fa-user-circle"></i>
                    </div>
                    <h2 className="fw-bold mb-2">
                      {mode === "login" ? "Welcome Back" : "Create Account"}
                    </h2>
                    <p className="text-muted mb-0">
                      {mode === "login"
                        ? "Sign in to continue to your account"
                        : "Register to get started"}
                    </p>
                  </div>

                  {error && (
                    <Alert
                      variant="danger"
                      className="d-flex align-items-center alert-modern"
                    >
                      <i className="fas fa-exclamation-triangle me-2"></i>
                      {error}
                    </Alert>
                  )}

                  {mode === "login" ? (
                    <Form onSubmit={handleSubmit}>
                      <Form.Group className="mb-3">
                        <Form.Label className="form-label-modern">
                          <i className="fas fa-envelope me-2"></i>
                          Email Address
                        </Form.Label>
                        <Form.Control
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          placeholder="Enter your email"
                          required
                          className="form-control-modern"
                        />
                      </Form.Group>

                      <Form.Group className="mb-4">
                        <Form.Label className="form-label-modern">
                          <i className="fas fa-lock me-2"></i>
                          Password
                        </Form.Label>
                        <div className="position-relative">
                          <Form.Control
                            type={showPassword ? "text" : "password"}
                            name="password"
                            value={formData.password}
                            onChange={handleChange}
                            placeholder="Enter your password"
                            required
                            className="form-control-modern pe-5"
                          />
                          <button
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            <i
                              className={`fas ${
                                showPassword ? "fa-eye" : "fa-eye-slash"
                              }`}
                            ></i>
                          </button>
                        </div>
                      </Form.Group>

                      <Button
                        type="submit"
                        className="btn-modern w-100"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            Signing In...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-sign-in-alt me-2"></i>
                            Sign In
                          </>
                        )}
                      </Button>
                    </Form>
                  ) : (
                    <Form onSubmit={handleRegister}>
                      <Row>
                        <Col xs={12} md={6} className="mb-3">
                          <Form.Label className="form-label-modern">
                            First Name
                          </Form.Label>
                          <Form.Control
                            name="firstName"
                            value={regData.firstName}
                            onChange={handleRegChange}
                            required
                            className="form-control-modern"
                          />
                        </Col>
                        <Col xs={12} md={6} className="mb-3">
                          <Form.Label className="form-label-modern">
                            Last Name
                          </Form.Label>
                          <Form.Control
                            name="lastName"
                            value={regData.lastName}
                            onChange={handleRegChange}
                            required
                            className="form-control-modern"
                          />
                        </Col>
                      </Row>

                      <Form.Group className="mb-3">
                        <Form.Label className="form-label-modern">
                          Email Address
                        </Form.Label>
                        <Form.Control
                          type="email"
                          name="email"
                          value={regData.email}
                          onChange={handleRegChange}
                          required
                          className="form-control-modern"
                        />
                      </Form.Group>

                      <Form.Group className="mb-4">
                        <Form.Label className="form-label-modern">
                          Password
                        </Form.Label>
                        <div className="position-relative">
                          <Form.Control
                            type={showRegPassword ? "text" : "password"}
                            name="password"
                            value={regData.password}
                            onChange={handleRegChange}
                            required
                            className="form-control-modern pe-5"
                          />
                          <button
                            type="button"
                            className="password-toggle-btn"
                            onClick={() => setShowRegPassword(!showRegPassword)}
                          >
                            <i
                              className={`fas ${
                                showRegPassword ? "fa-eye" : "fa-eye-slash"
                              }`}
                            ></i>
                          </button>
                        </div>
                      </Form.Group>

                      <Button
                        type="submit"
                        className="btn-modern w-100"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2"></span>
                            Creating...
                          </>
                        ) : (
                          <>
                            <i className="fas fa-user-plus me-2"></i>
                            Register
                          </>
                        )}
                      </Button>
                    </Form>
                  )}

                  <div className="text-center mt-4">
                    {mode === "login" ? (
                      <p className="mb-0 text-muted">
                        Don't have an account?{" "}
                        <Button
                          variant="link"
                          className="p-0 text-decoration-none fw-semibold link-modern"
                          onClick={() => {
                            setMode("register");
                            setError("");
                          }}
                        >
                          Register Now
                        </Button>
                      </p>
                    ) : (
                      <p className="mb-0 text-muted">
                        Already have an account?{" "}
                        <Button
                          variant="link"
                          className="p-0 text-decoration-none fw-semibold link-modern"
                          onClick={() => {
                            setMode("login");
                            setError("");
                          }}
                        >
                          Sign In
                        </Button>
                      </p>
                    )}
                  </div>
                </Card.Body>
              </Card>
            </div>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default Login;
