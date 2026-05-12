import React, { useState, useEffect } from "react";
import api from "../utils/api";

const TopPerformers = () => {
  const [performers, setPerformers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTopPerformers();
  }, []);

  const fetchTopPerformers = async () => {
    try {
      const response = await api.get("/api/dashboard/top-performers");
      setPerformers(response.data);
    } catch (error) {
      console.error("Error fetching top performers:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-4">
        <div className="spinner-border spinner-border-sm text-primary" />
      </div>
    );
  }

  if (performers.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-icon">
          <i className="fas fa-trophy"></i>
        </div>
        <div className="empty-text">No attendance data this week</div>
      </div>
    );
  }

  const medals = ["🥇", "🥈", "🥉"];
  const gradients = [
    "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)",
    "linear-gradient(135deg, #94a3b8 0%, #64748b 100%)",
    "linear-gradient(135deg, #fb923c 0%, #ea580c 100%)"
  ];
  const bgColors = ["#fffbeb", "#f8fafc", "#fff7ed"];

  return (
    <div style={{ padding: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem" }}>
      {performers.map((performer, idx) => (
        <div
          key={performer._id}
          style={{
            background: bgColors[idx],
            borderRadius: "1rem",
            padding: "1.25rem",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            border: "1px solid rgba(0,0,0,0.06)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              fontSize: "4rem",
              opacity: 0.1,
              lineHeight: 1,
              padding: "0.5rem",
            }}
          >
            {medals[idx]}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem", position: "relative" }}>
            <div
              style={{
                fontSize: "2.5rem",
                flexShrink: 0,
              }}
            >
              {medals[idx]}
            </div>
            {performer.profileImage ? (
              <img
                src={performer.profileImage}
                alt={`${performer.firstName} ${performer.lastName}`}
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  objectFit: "cover",
                  flexShrink: 0,
                  border: "3px solid #fff",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }}
              />
            ) : (
              <div
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: "50%",
                  background: gradients[idx],
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "1.25rem",
                  flexShrink: 0,
                  letterSpacing: "0.5px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                }}
              >
                {performer.firstName?.charAt(0)}{performer.lastName?.charAt(0)}
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "1.1rem",
                  color: "#0f172a",
                  marginBottom: "0.25rem",
                }}
              >
                {performer.firstName} {performer.lastName}
              </div>
              <div
                style={{
                  fontSize: "0.9rem",
                  color: "#64748b",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                }}
              >
                <i className="fas fa-clock" style={{ fontSize: "0.8rem" }}></i>
                <strong style={{ color: "#0f172a" }}>{performer.totalHours.toFixed(1)}</strong> hours this week
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default TopPerformers;
