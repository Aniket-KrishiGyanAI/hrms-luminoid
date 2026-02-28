import { memo } from 'react';

// Memoize expensive list items
export const EmployeeCard = memo(({ employee, onClick }) => (
  <div className="employee-card-modern" onClick={() => onClick(employee)}>
    <div className="card-header-modern">
      <div className="employee-avatar-modern">
        {employee?.profileImage ? (
          <img src={employee.profileImage} alt="Profile" />
        ) : (
          <div className="avatar-initials-modern">
            {employee?.firstName?.charAt(0)}{employee?.lastName?.charAt(0)}
          </div>
        )}
      </div>
    </div>
    <div className="card-body-modern">
      <h4 className="employee-name-modern">
        {employee?.firstName} {employee?.lastName}
      </h4>
      <p className="employee-designation-modern">{employee?.designation || 'No Position'}</p>
      <div className="employee-details-modern">
        <div className="detail-item-modern">
          <i className="fas fa-briefcase"></i>
          <span>{employee?.role}</span>
        </div>
        <div className="detail-item-modern">
          <i className="fas fa-building"></i>
          <span>{employee?.department || 'Not Set'}</span>
        </div>
      </div>
    </div>
  </div>
), (prevProps, nextProps) => {
  return prevProps.employee?._id === nextProps.employee?._id &&
         prevProps.employee?.firstName === nextProps.employee?.firstName &&
         prevProps.employee?.department === nextProps.employee?.department;
});

EmployeeCard.displayName = 'EmployeeCard';
