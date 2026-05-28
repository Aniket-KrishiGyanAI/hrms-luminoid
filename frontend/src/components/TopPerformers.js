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
      <div style={{ background: "#fff", borderRadius: "1rem", padding: "3rem", textAlign: "center" }}>
        <div style={{ 
          width: "3rem", 
          height: "3rem", 
          border: "4px solid #f3f4f6",
          borderTop: "4px solid #16a34a",
          borderRadius: "50%",
          margin: "0 auto",
          animation: "spin 0.8s linear infinite"
        }} />
        <p style={{ marginTop: "1rem", color: "#64748b", fontWeight: 600 }}>Loading...</p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (performers.length === 0) {
    return (
      <div style={{ padding: "3rem 1.5rem", textAlign: "center" }}>
        <div
          style={{
            width: "80px",
            height: "80px",
            margin: "0 auto 1.5rem",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "2.5rem",
            boxShadow: "0 8px 24px rgba(22, 163, 74, 0.3)",
          }}
        >
          <i className="fas fa-trophy" style={{ color: "#fff" }}></i>
        </div>
        <h5 style={{ color: "#0f172a", marginBottom: "0.5rem" }}>
          No Data Yet
        </h5>
        <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
          Top performers will appear here once attendance is tracked this week
        </p>
      </div>
    );
  }

  const medalConfig = [
    { bg: "linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)", icon: "🏆" },
    { bg: "linear-gradient(135deg, #cbd5e1 0%, #94a3b8 100%)", icon: "🥈" },
    { bg: "linear-gradient(135deg, #fdba74 0%, #fb923c 100%)", icon: "🥉" },
    { bg: "#d1fae5", icon: "4" },
    { bg: "#d1fae5", icon: "5" },
  ];

  const maxHours = Math.max(...performers.map((p) => p.totalHours));

  return (
    <div
      style={{ background: "#fff", borderRadius: "1rem", overflow: "hidden" }}
    >
      {/* Header */}
      <div
        style={{
          background:
            "linear-gradient(135deg, #15803d 0%, #16a34a 50%, #22c55e 100%)",
          padding: "2rem 1.5rem",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <svg
          style={{
            position: "absolute",
            bottom: -2,
            left: 0,
            width: "100%",
            height: "60px",
          }}
          viewBox="0 0 1200 120"
          preserveAspectRatio="none"
        >
          <path
            d="M0,0 C300,80 600,80 900,40 L1200,60 L1200,120 L0,120 Z"
            fill="#fff"
            opacity="0.3"
          />
          <path
            d="M0,20 C400,100 800,60 1200,80 L1200,120 L0,120 Z"
            fill="#fff"
          />
        </svg>
        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          <div
            style={{
              width: "70px",
              height: "70px",
              borderRadius: "50%",
              background: "rgba(255,255,255,0.2)",
              border: "3px solid rgba(255,255,255,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "2rem",
            }}
          >
            <i className="fas fa-trophy" style={{ color: "#fff" }}></i>
          </div>
          <div>
            <h3
              style={{
                color: "#fff",
                fontWeight: 800,
                fontSize: "1.75rem",
                margin: 0,
                textShadow: "0 2px 4px rgba(0,0,0,0.1)",
              }}
            >
              Top Performers
            </h3>
            <p
              style={{
                color: "rgba(255,255,255,0.9)",
                margin: 0,
                fontSize: "1rem",
                fontWeight: 500,
              }}
            >
              This Week
            </p>
          </div>
          <button
            style={{
              marginLeft: "auto",
              background: "#fff",
              border: "none",
              borderRadius: "2rem",
              padding: "0.5rem 1.25rem",
              color: "#16a34a",
              fontWeight: 700,
              fontSize: "0.9rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            }}
          >
            View All{" "}
            <i
              className="fas fa-chevron-right"
              style={{ fontSize: "0.75rem" }}
            ></i>
          </button>
        </div>
      </div>

      {/* Performers List */}
      <div style={{ padding: "1.5rem" }}>
        {performers.slice(0, 5).map((performer, idx) => {
          const percentage = (performer.totalHours / maxHours) * 100;
          const points = Math.round(performer.totalHours * 100);
          const config = medalConfig[idx];

          return (
            <div
              key={performer._id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                padding: "1rem 0",
                borderBottom:
                  idx < performers.length - 1 ? "1px solid #f1f5f9" : "none",
              }}
            >
              {/* Rank Badge */}
              <div
                style={{
                  width: "50px",
                  height: "50px",
                  borderRadius: "50%",
                  background: config.bg,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: idx < 3 ? "1.5rem" : "1.25rem",
                  fontWeight: 800,
                  color: idx < 3 ? "#fff" : "#16a34a",
                  flexShrink: 0,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                }}
              >
                {config.icon}
              </div>

              {/* Profile */}
              <div style={{ position: "relative" }}>
                {performer.profileImage ? (
                  <img
                    src={performer.profileImage}
                    alt={`${performer.firstName} ${performer.lastName}`}
                    style={{
                      width: "70px",
                      height: "70px",
                      borderRadius: "50%",
                      objectFit: "cover",
                      border: "3px solid #e5e7eb",
                      imageRendering: "-webkit-optimize-contrast",
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: "70px",
                      height: "70px",
                      borderRadius: "50%",
                      background:
                        "linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)",
                      color: "#fff",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      fontSize: "1.4rem",
                      border: "3px solid #e5e7eb",
                    }}
                  >
                    {performer.firstName?.charAt(0)}
                    {performer.lastName?.charAt(0)}
                  </div>
                )}
                <div
                  style={{
                    position: "absolute",
                    bottom: 0,
                    right: 0,
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    background: "#22c55e",
                    border: "3px solid #fff",
                  }}
                ></div>
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: "1.1rem",
                    color: "#1e293b",
                    marginBottom: "0.25rem",
                  }}
                >
                  {performer.firstName} {performer.lastName}
                </div>
                <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                  {performer.department || "Employee"}
                </div>
              </div>

              {/* Working Hours */}
              <div style={{ textAlign: "center", marginRight: "0rem" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    marginBottom: "0.25rem",
                  }}
                >
                  <i
                    className="fas fa-clock"
                    style={{ color: "#16a34a", fontSize: "1rem" }}
                  ></i>
                  <span
                    style={{
                      fontWeight: 800,
                      fontSize: "1.25rem",
                      color: "#1e293b",
                    }}
                  >
                    {performer.totalHours.toFixed(1)} hrs
                  </span>
                </div>
                <div style={{ fontSize: "0.75rem", color: "#64748b" }}>
                  Working Hours
                </div>
              </div>

              {/* Progress */}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div
        style={{
          padding: "1rem 1.5rem",
          background: "linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)",
          borderTop: "1px solid #bbf7d0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
        }}
      >
        <i
          className="fas fa-trophy"
          style={{ color: "#16a34a", fontSize: "1.25rem" }}
        ></i>
        <span
          style={{
            color: "#15803d",
            fontWeight: 600,
            fontSize: "0.95rem",
            fontStyle: "italic",
          }}
        >
          Great work! Keep it up and inspire others.
        </span>
      </div>
    </div>
  );
};

export default TopPerformers;
