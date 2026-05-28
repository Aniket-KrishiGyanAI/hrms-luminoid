/**
 * AUTO-REFRESH IMPLEMENTATION EXAMPLES
 * 
 * This file shows how to use the new reactive state management
 * in your components to auto-refresh data without page reload.
 */

import React from 'react';
import { useAutoRefresh } from '../hooks/useAutoRefresh';
import { useMutation } from '../hooks/useMutation';
import SmoothLoader from '../components/SmoothLoader';

// ============================================
// EXAMPLE 1: Simple Auto-Refresh List
// ============================================
export const EmployeeListExample = () => {
  const { data: employees, loading, refresh } = useAutoRefresh(
    '/api/employees',
    'employees',
    {
      interval: 30000, // Refresh every 30 seconds
      enabled: true
    }
  );

  // Only show loader on initial load, not on auto-refresh
  if (loading && !employees) return <SmoothLoader type="gradient" />;

  return (
    <div>
      <button onClick={refresh}>Manual Refresh</button>
      {employees?.map(emp => (
        <div key={emp._id}>{emp.name}</div>
      ))}
    </div>
  );
};

// ============================================
// EXAMPLE 2: Auto-Refresh with Create/Update/Delete
// ============================================
export const TaskManagementExample = () => {
  const { data: tasks, loading, refresh } = useAutoRefresh(
    '/api/tasks',
    'tasks',
    { interval: 15000 } // Refresh every 15 seconds
  );

  const { create, update, remove } = useMutation('tasks');

  const handleCreateTask = async (taskData) => {
    const result = await create('/api/tasks', taskData);
    if (result.success) {
      // UI updates automatically, no need to refresh!
      console.log('Task created:', result.data);
    }
  };

  const handleUpdateTask = async (taskId, updates) => {
    const result = await update(`/api/tasks/${taskId}`, taskId, updates);
    if (result.success) {
      // UI updates automatically!
      console.log('Task updated');
    }
  };

  const handleDeleteTask = async (taskId) => {
    const result = await remove(`/api/tasks/${taskId}`, taskId);
    if (result.success) {
      // UI updates automatically!
      console.log('Task deleted');
    }
  };

  return (
    <div>
      {tasks?.map(task => (
        <div key={task._id}>
          <span>{task.title}</span>
          <button onClick={() => handleUpdateTask(task._id, { status: 'completed' })}>
            Complete
          </button>
          <button onClick={() => handleDeleteTask(task._id)}>Delete</button>
        </div>
      ))}
    </div>
  );
};

// ============================================
// EXAMPLE 3: Conditional Auto-Refresh
// ============================================
export const AttendanceExample = () => {
  const [autoRefreshEnabled, setAutoRefreshEnabled] = React.useState(true);

  const { data: attendance, loading } = useAutoRefresh(
    '/api/attendance/today',
    'todayAttendance',
    {
      interval: 10000, // 10 seconds
      enabled: autoRefreshEnabled, // Can be toggled
      onSuccess: (data) => {
        console.log('Attendance refreshed:', data);
      }
    }
  );

  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={autoRefreshEnabled}
          onChange={(e) => setAutoRefreshEnabled(e.target.checked)}
        />
        Auto-refresh enabled
      </label>
      {/* Your attendance UI */}
    </div>
  );
};

// ============================================
// EXAMPLE 4: Multiple Data Sources
// ============================================
export const DashboardExample = () => {
  // Fetch multiple data sources with different refresh intervals
  const { data: stats } = useAutoRefresh('/api/dashboard/stats', 'dashboardStats', {
    interval: 60000 // 1 minute
  });

  const { data: notifications } = useAutoRefresh('/api/notifications', 'notifications', {
    interval: 10000 // 10 seconds
  });

  const { data: tasks } = useAutoRefresh('/api/tasks/my-tasks', 'myTasks', {
    interval: 30000 // 30 seconds
  });

  return (
    <div>
      <div>Stats: {JSON.stringify(stats)}</div>
      <div>Notifications: {notifications?.length}</div>
      <div>Tasks: {tasks?.length}</div>
    </div>
  );
};

// ============================================
// HOW TO USE IN YOUR EXISTING COMPONENTS:
// ============================================

/*
1. Replace your existing useEffect + fetch with useAutoRefresh:

   BEFORE:
   useEffect(() => {
     const fetchData = async () => {
       const response = await api.get('/api/employees');
       setEmployees(response.data);
     };
     fetchData();
   }, []);

   AFTER:
   const { data: employees, loading } = useAutoRefresh(
     '/api/employees',
     'employees',
     { interval: 30000 }
   );

2. For create/update/delete operations, use useMutation:

   const { create, update, remove } = useMutation('employees');
   
   // Create
   await create('/api/employees', newEmployeeData);
   
   // Update
   await update(`/api/employees/${id}`, id, updatedData);
   
   // Delete
   await remove(`/api/employees/${id}`, id);

3. The UI will automatically update without page refresh!
*/
