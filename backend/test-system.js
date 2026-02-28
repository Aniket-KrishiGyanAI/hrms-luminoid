const axios = require('axios');

const BASE_URL = 'http://localhost:5000';
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m'
};

let tokens = {};
let testData = {};

const log = (message, color = 'reset') => console.log(`${colors[color]}${message}${colors.reset}`);

// Test Authentication
async function testAuth() {
  log('\n=== Testing Authentication ===', 'blue');
  
  const users = [
    { email: 'admin@company.com', password: 'admin123', role: 'ADMIN' },
    { email: 'hr@company.com', password: 'hr123', role: 'HR' },
    { email: 'manager@company.com', password: 'manager123', role: 'MANAGER' },
    { email: 'employee@company.com', password: 'employee123', role: 'EMPLOYEE' }
  ];

  for (const user of users) {
    try {
      const res = await axios.post(`${BASE_URL}/api/auth/login`, user);
      tokens[user.role] = res.data.accessToken;
      testData[user.role] = res.data.user;
      log(`✓ ${user.role} login successful`, 'green');
    } catch (err) {
      log(`✗ ${user.role} login failed: ${err.response?.data?.message || err.message}`, 'red');
    }
  }
}

// Test Leave Types
async function testLeaveTypes() {
  log('\n=== Testing Leave Types ===', 'blue');
  
  try {
    const res = await axios.get(`${BASE_URL}/api/leave-types`, {
      headers: { Authorization: `Bearer ${tokens.ADMIN}` }
    });
    log(`✓ Fetched ${res.data.length} leave types`, 'green');
    testData.leaveTypes = res.data;
  } catch (err) {
    log(`✗ Failed to fetch leave types: ${err.response?.data?.message || err.message}`, 'red');
  }
}

// Test Leave Balances
async function testLeaveBalances() {
  log('\n=== Testing Leave Balances ===', 'blue');
  
  try {
    const res = await axios.get(`${BASE_URL}/api/leave-balances`, {
      headers: { Authorization: `Bearer ${tokens.EMPLOYEE}` }
    });
    log(`✓ Fetched leave balances: ${res.data.length} records`, 'green');
    testData.leaveBalances = res.data;
  } catch (err) {
    log(`✗ Failed to fetch leave balances: ${err.response?.data?.message || err.message}`, 'red');
  }
}

// Test Leave Request Creation
async function testLeaveRequest() {
  log('\n=== Testing Leave Request ===', 'blue');
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 2);
  const dayAfter = new Date();
  dayAfter.setDate(dayAfter.getDate() + 3);

  try {
    const leaveType = testData.leaveTypes?.[0]?._id;
    if (!leaveType) {
      log('✗ No leave type available for testing', 'red');
      return;
    }

    const res = await axios.post(`${BASE_URL}/api/leave-requests`, {
      leaveTypeId: leaveType,
      startDate: tomorrow.toISOString().split('T')[0],
      endDate: dayAfter.toISOString().split('T')[0],
      reason: 'Test leave request',
      isHalfDay: false
    }, {
      headers: { Authorization: `Bearer ${tokens.EMPLOYEE}` }
    });
    
    testData.leaveRequestId = res.data._id;
    log(`✓ Leave request created: ${res.data._id}`, 'green');
  } catch (err) {
    log(`✗ Failed to create leave request: ${err.response?.data?.message || err.message}`, 'red');
  }
}

// Test Leave Approval
async function testLeaveApproval() {
  log('\n=== Testing Leave Approval ===', 'blue');
  
  if (!testData.leaveRequestId) {
    log('✗ No leave request to approve', 'yellow');
    return;
  }

  try {
    const res = await axios.put(
      `${BASE_URL}/api/leave-requests/${testData.leaveRequestId}/approve-reject`,
      { action: 'approve', comments: 'Approved for testing' },
      { headers: { Authorization: `Bearer ${tokens.MANAGER}` }}
    );
    log(`✓ Leave approved by manager: ${res.data.status}`, 'green');
  } catch (err) {
    log(`✗ Failed to approve leave: ${err.response?.data?.message || err.message}`, 'red');
  }
}

// Test Holidays
async function testHolidays() {
  log('\n=== Testing Holidays ===', 'blue');
  
  try {
    const res = await axios.get(`${BASE_URL}/api/holidays`, {
      headers: { Authorization: `Bearer ${tokens.EMPLOYEE}` }
    });
    log(`✓ Fetched ${res.data.length} holidays`, 'green');
  } catch (err) {
    log(`✗ Failed to fetch holidays: ${err.response?.data?.message || err.message}`, 'red');
  }
}

// Test Announcements
async function testAnnouncements() {
  log('\n=== Testing Announcements ===', 'blue');
  
  try {
    const res = await axios.get(`${BASE_URL}/api/announcements`, {
      headers: { Authorization: `Bearer ${tokens.EMPLOYEE}` }
    });
    log(`✓ Fetched ${res.data.length} announcements`, 'green');
  } catch (err) {
    log(`✗ Failed to fetch announcements: ${err.response?.data?.message || err.message}`, 'red');
  }
}

// Test Favorites
async function testFavorites() {
  log('\n=== Testing Favorites ===', 'blue');
  
  try {
    const res = await axios.get(`${BASE_URL}/api/favorites`, {
      headers: { Authorization: `Bearer ${tokens.EMPLOYEE}` }
    });
    log(`✓ Fetched ${res.data.length} favorites`, 'green');
  } catch (err) {
    log(`✗ Failed to fetch favorites: ${err.response?.data?.message || err.message}`, 'red');
  }
}

// Test Files
async function testFiles() {
  log('\n=== Testing Files ===', 'blue');
  
  try {
    const res = await axios.get(`${BASE_URL}/api/files`, {
      headers: { Authorization: `Bearer ${tokens.EMPLOYEE}` }
    });
    log(`✓ Fetched ${res.data.length} files`, 'green');
  } catch (err) {
    log(`✗ Failed to fetch files: ${err.response?.data?.message || err.message}`, 'red');
  }
}

// Test Dashboard - Employee
async function testEmployeeDashboard() {
  log('\n=== Testing Employee Dashboard ===', 'blue');
  
  try {
    const res = await axios.get(`${BASE_URL}/api/dashboard/employee`, {
      headers: { Authorization: `Bearer ${tokens.EMPLOYEE}` }
    });
    log(`✓ Employee dashboard loaded`, 'green');
    log(`  - Leave balances: ${res.data.leaveBalances?.length || 0}`, 'green');
    log(`  - Upcoming leaves: ${res.data.upcomingLeaves?.length || 0}`, 'green');
    log(`  - Birthdays: ${res.data.upcomingBirthdays?.length || 0}`, 'green');
  } catch (err) {
    log(`✗ Failed to load employee dashboard: ${err.response?.data?.message || err.message}`, 'red');
  }
}

// Test Dashboard - Manager
async function testManagerDashboard() {
  log('\n=== Testing Manager Dashboard ===', 'blue');
  
  try {
    const res = await axios.get(`${BASE_URL}/api/dashboard/manager`, {
      headers: { Authorization: `Bearer ${tokens.MANAGER}` }
    });
    log(`✓ Manager dashboard loaded`, 'green');
    log(`  - Pending approvals: ${res.data.pendingApprovals?.length || 0}`, 'green');
    log(`  - Team members: ${res.data.teamMembers?.length || 0}`, 'green');
  } catch (err) {
    log(`✗ Failed to load manager dashboard: ${err.response?.data?.message || err.message}`, 'red');
  }
}

// Test Dashboard - HR
async function testHRDashboard() {
  log('\n=== Testing HR Dashboard ===', 'blue');
  
  try {
    const res = await axios.get(`${BASE_URL}/api/dashboard/hr`, {
      headers: { Authorization: `Bearer ${tokens.HR}` }
    });
    log(`✓ HR dashboard loaded`, 'green');
    log(`  - Total employees: ${res.data.totalEmployees || 0}`, 'green');
    log(`  - Pending requests: ${res.data.pendingRequests || 0}`, 'green');
  } catch (err) {
    log(`✗ Failed to load HR dashboard: ${err.response?.data?.message || err.message}`, 'red');
  }
}

// Test Departments
async function testDepartments() {
  log('\n=== Testing Departments ===', 'blue');
  
  try {
    const res = await axios.get(`${BASE_URL}/api/departments`, {
      headers: { Authorization: `Bearer ${tokens.ADMIN}` }
    });
    log(`✓ Fetched ${res.data.length} departments`, 'green');
  } catch (err) {
    log(`✗ Failed to fetch departments: ${err.response?.data?.message || err.message}`, 'red');
  }
}

// Test Employees
async function testEmployees() {
  log('\n=== Testing Employees ===', 'blue');
  
  try {
    const res = await axios.get(`${BASE_URL}/api/employees`, {
      headers: { Authorization: `Bearer ${tokens.HR}` }
    });
    log(`✓ Fetched ${res.data.length} employees`, 'green');
  } catch (err) {
    log(`✗ Failed to fetch employees: ${err.response?.data?.message || err.message}`, 'red');
  }
}

// Test Attendance
async function testAttendance() {
  log('\n=== Testing Attendance ===', 'blue');
  
  try {
    const res = await axios.get(`${BASE_URL}/api/attendance/my-attendance`, {
      headers: { Authorization: `Bearer ${tokens.EMPLOYEE}` }
    });
    log(`✓ Fetched attendance records: ${res.data.length || 0}`, 'green');
  } catch (err) {
    log(`✗ Failed to fetch attendance: ${err.response?.data?.message || err.message}`, 'red');
  }
}

// Test Expenses
async function testExpenses() {
  log('\n=== Testing Expenses ===', 'blue');
  
  try {
    const res = await axios.get(`${BASE_URL}/api/expenses`, {
      headers: { Authorization: `Bearer ${tokens.EMPLOYEE}` }
    });
    log(`✓ Fetched ${res.data.length || 0} expenses`, 'green');
  } catch (err) {
    log(`✗ Failed to fetch expenses: ${err.response?.data?.message || err.message}`, 'red');
  }
}

// Test Assets
async function testAssets() {
  log('\n=== Testing Assets ===', 'blue');
  
  try {
    const res = await axios.get(`${BASE_URL}/api/assets`, {
      headers: { Authorization: `Bearer ${tokens.ADMIN}` }
    });
    log(`✓ Fetched ${res.data.length || 0} assets`, 'green');
  } catch (err) {
    log(`✗ Failed to fetch assets: ${err.response?.data?.message || err.message}`, 'red');
  }
}

// Test Permissions
async function testPermissions() {
  log('\n=== Testing Permissions ===', 'blue');
  
  try {
    const res = await axios.get(`${BASE_URL}/api/permissions/my-permissions`, {
      headers: { Authorization: `Bearer ${tokens.EMPLOYEE}` }
    });
    log(`✓ Fetched ${res.data.length || 0} permissions`, 'green');
  } catch (err) {
    log(`✗ Failed to fetch permissions: ${err.response?.data?.message || err.message}`, 'red');
  }
}

// Main test runner
async function runTests() {
  log('\n╔════════════════════════════════════════╗', 'blue');
  log('║   HRMS System Comprehensive Test      ║', 'blue');
  log('╚════════════════════════════════════════╝', 'blue');
  
  try {
    await testAuth();
    await testLeaveTypes();
    await testLeaveBalances();
    await testLeaveRequest();
    await testLeaveApproval();
    await testHolidays();
    await testAnnouncements();
    await testFavorites();
    await testFiles();
    await testEmployeeDashboard();
    await testManagerDashboard();
    await testHRDashboard();
    await testDepartments();
    await testEmployees();
    await testAttendance();
    await testExpenses();
    await testAssets();
    await testPermissions();
    
    log('\n╔════════════════════════════════════════╗', 'green');
    log('║   All Tests Completed!                 ║', 'green');
    log('╚════════════════════════════════════════╝', 'green');
  } catch (err) {
    log(`\n✗ Test suite failed: ${err.message}`, 'red');
  }
}

// Check if server is running
async function checkServer() {
  try {
    await axios.get(`${BASE_URL}/api/health`);
    log('✓ Server is running', 'green');
    return true;
  } catch (err) {
    log('✗ Server is not running. Please start the backend server first.', 'red');
    log('  Run: cd backend && npm run dev', 'yellow');
    return false;
  }
}

// Start tests
(async () => {
  const serverRunning = await checkServer();
  if (serverRunning) {
    await runTests();
  }
})();
