import React from "react";
import { useNavigate } from "react-router-dom";

const LatestAnnouncements = ({ announcements }) => {
  const navigate = useNavigate();

  return (
    <div style={{ background: "#fff", borderRadius: "1rem", padding: "2rem", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginBottom: "0.5rem" }}>
        <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <i className="fas fa-bullhorn" style={{ fontSize: "1.5rem", color: "#1f2937" }}></i>
        </div>
        <div>
          <h3 style={{ margin: 0, fontSize: "1.5rem", fontWeight: 700, color: "#1f2937" }}>Latest Announcements</h3>
          <p style={{ margin: 0, fontSize: "0.9rem", color: "#6b7280" }}>Stay informed with important updates and news.</p>
        </div>
      </div>
      <div style={{ marginTop: "1.5rem", display: "flex", flexDirection: "column", gap: "1rem", maxHeight: "500px", overflowY: "auto" }}>
        {announcements.length > 0 ? (
          announcements.map((ann) => {
            const borderColor = ann.priority === "HIGH" ? "#ef4444" : ann.priority === "MEDIUM" ? "#f59e0b" : "#3b82f6";
            const iconBg = ann.priority === "HIGH" ? "#ef4444" : ann.priority === "MEDIUM" ? "#f59e0b" : "#3b82f6";
            const badgeBg = ann.priority === "HIGH" ? "#fee2e2" : ann.priority === "MEDIUM" ? "#fef3c7" : "#dbeafe";
            const badgeColor = ann.priority === "HIGH" ? "#991b1b" : ann.priority === "MEDIUM" ? "#92400e" : "#1e40af";
            return (
              <div 
                key={ann._id} 
                style={{ 
                  position: "relative", 
                  background: "#fff", 
                  border: "1px solid #e5e7eb", 
                  borderRadius: "12px", 
                  padding: "1.25rem", 
                  borderLeft: `4px solid ${borderColor}`, 
                  transition: "all 0.2s", 
                  cursor: "pointer" 
                }} 
                onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"} 
                onMouseLeave={(e) => e.currentTarget.style.boxShadow = "none"}
              >
                <div style={{ display: "flex", gap: "1rem" }}>
                  <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <i className="fas fa-bullhorn" style={{ fontSize: "1.25rem", color: "#fff" }}></i>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "0.5rem" }}>
                      <h4 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#1f2937" }}>{ann.title}</h4>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, padding: "0.25rem 0.75rem", borderRadius: "6px", background: badgeBg, color: badgeColor, textTransform: "uppercase", letterSpacing: "0.5px" }}>{ann.priority}</span>
                    </div>
                    <p style={{ margin: "0 0 0.75rem 0", fontSize: "0.9rem", color: "#6b7280", lineHeight: "1.5" }}>{ann.content}</p>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "#9ca3af" }}>
                        <i className="fas fa-calendar" style={{ fontSize: "0.85rem" }}></i>
                        {new Date(ann.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                      <i className="fas fa-arrow-right" style={{ fontSize: "1rem", color: "#9ca3af" }}></i>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ textAlign: "center", padding: "3rem 0", color: "#9ca3af" }}>
            <i className="fas fa-bullhorn" style={{ fontSize: "3rem", marginBottom: "1rem", opacity: 0.3 }}></i>
            <p style={{ margin: 0, fontSize: "1rem" }}>No announcements</p>
          </div>
        )}
      </div>
      {announcements.length > 0 && (
        <div style={{ marginTop: "1.5rem", textAlign: "center" }}>
          <button 
            onClick={() => navigate("/announcements")} 
            style={{ 
              background: "none", 
              border: "none", 
              color: "#3b82f6", 
              fontSize: "0.95rem", 
              fontWeight: 600, 
              cursor: "pointer", 
              display: "inline-flex", 
              alignItems: "center", 
              gap: "0.5rem" 
            }}
          >
            <i className="fas fa-list"></i> View all announcements <i className="fas fa-arrow-right" style={{ fontSize: "0.85rem" }}></i>
          </button>
        </div>
      )}
    </div>
  );
};

export default LatestAnnouncements;
