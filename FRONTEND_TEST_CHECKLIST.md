# HRMS Frontend Testing Checklist

## Prerequisites
- Backend server running on http://localhost:5000
- Frontend running on http://localhost:3000
- Database seeded with test data

## 1. Authentication Tests

### Login
- [ ] Login with Admin (admin@company.com / admin123)
- [ ] Login with HR (hr@company.com / hr123)
- [ ] Login with Manager (manager@company.com / manager123)
- [ ] Login with Employee (employee@company.com / employee123)
- [ ] Test invalid credentials
- [ ] Test empty fields validation
- [ ] Verify redirect to dashboard after login

### Logout
- [ ] Logout functionality works
- [ ] Redirects to login page
- [ ] Token cleared from storage

## 2. Dashboard Tests

### Employee Dashboard
- [ ] Leave balances displayed correctly
- [ ] Upcoming leaves shown
- [ ] Recent leave history visible
- [ ] Birthdays widget shows upcoming birthdays
- [ ] New hires widget displays recent joiners
- [ ] Announcements displayed
- [ ] Holiday calendar visible
- [ ] Quick links/favorites accessible

### Manager Dashboard
- [ ] Pending approvals count shown
- [ ] Team members list displayed
- [ ] Team calendar visible
- [ ] Team leave summary accessible
- [ ] Can approve/reject team requests

### HR Dashboard
- [ ] Total employees count
- [ ] Pending requests count
- [ ] Monthly leave statistics
- [ ] Organization-wide reports
- [ ] Export functionality works

## 3. Leave Management Tests

### Leave Types (Admin/HR)
- [ ] View all leave types
- [ ] Create new leave type
- [ ] Edit existing leave type
- [ ] Delete leave type
- [ ] Validate accrual settings
- [ ] Test carry forward rules

### Leave Application (Employee)
- [ ] Apply for full-day leave
- [ ] Apply for half-day leave
- [ ] Date picker works correctly
- [ ] Balance validation works
- [ ] Overlapping leave detection
- [ ] Reason field required
- [ ] Success notification shown
- [ ] Email sent to manager/HR

### Leave Approval (Manager/HR)
- [ ] View pending approvals
- [ ] Approve leave request
- [ ] Reject leave request with reason
- [ ] View approved leaves
- [ ] View rejected leaves
- [ ] Email notifications sent

### Leave History
- [ ] View personal leave history
- [ ] Filter by status
- [ ] Filter by date range
- [ ] Cancel pending request
- [ ] Pagination works

## 4. Attendance Tests

### Check-in/Check-out
- [ ] Check-in with location
- [ ] Check-out with location
- [ ] GPS validation works
- [ ] IP validation (if enabled)
- [ ] Work mode selection
- [ ] Break time tracking

### Attendance Records
- [ ] View personal attendance
- [ ] View team attendance (Manager)
- [ ] View all attendance (HR/Admin)
- [ ] Filter by date range
- [ ] Export attendance report
- [ ] Status indicators correct

## 5. Employee Management Tests

### Employee List (HR/Admin)
- [ ] View all employees
- [ ] Search employees
- [ ] Filter by department
- [ ] Filter by status
- [ ] Pagination works

### Employee Profile
- [ ] View employee details
- [ ] Edit employee information
- [ ] Upload profile picture
- [ ] Update contact details
- [ ] Update emergency contacts
- [ ] Update bank details
- [ ] Document verification status

### Employee Import
- [ ] Download sample CSV
- [ ] Upload employee CSV
- [ ] Validation errors shown
- [ ] Success message displayed
- [ ] Employees created correctly

## 6. Department Management Tests

### Departments (Admin/HR)
- [ ] View all departments
- [ ] Create new department
- [ ] Edit department
- [ ] Delete department
- [ ] Assign department head

## 7. Expense Management Tests

### Expense Submission
- [ ] Create expense request
- [ ] Upload receipt
- [ ] Select expense category
- [ ] Add description
- [ ] Submit for approval

### Expense Approval (Manager/HR)
- [ ] View pending expenses
- [ ] Approve expense
- [ ] Reject expense
- [ ] View expense history
- [ ] Download receipts

## 8. Asset Management Tests

### Assets (Admin/HR)
- [ ] View all assets
- [ ] Add new asset
- [ ] Assign asset to employee
- [ ] Update asset status
- [ ] Return asset
- [ ] Delete asset

## 9. Announcement Tests

### Announcements (HR/Admin)
- [ ] Create announcement
- [ ] Set priority level
- [ ] Set target roles
- [ ] Set expiry date
- [ ] Edit announcement
- [ ] Delete announcement
- [ ] View on dashboard

## 10. Holiday Management Tests

### Holidays (HR/Admin)
- [ ] View holiday list
- [ ] Add new holiday
- [ ] Edit holiday
- [ ] Delete holiday
- [ ] Set holiday type
- [ ] Test holiday notification

## 11. File Management Tests

### Organization Files (HR/Admin)
- [ ] Upload organization file
- [ ] Categorize file
- [ ] Download file
- [ ] Delete file
- [ ] View file list

### Employee Files
- [ ] View accessible files
- [ ] Download files
- [ ] Upload personal documents

## 12. Favorites/Quick Links Tests

### Personal Favorites
- [ ] Add new favorite
- [ ] Edit favorite
- [ ] Delete favorite
- [ ] View on dashboard
- [ ] Icon selection works

## 13. Permission Management Tests

### Permissions (Employee)
- [ ] Apply for permission
- [ ] Select permission type
- [ ] Set time duration
- [ ] Add reason
- [ ] View permission history

### Permission Approval (Manager/HR)
- [ ] View pending permissions
- [ ] Approve permission
- [ ] Reject permission
- [ ] View permission history

## 14. Reports & Export Tests

### Leave Reports
- [ ] Generate leave report
- [ ] Filter by date range
- [ ] Filter by employee
- [ ] Export to CSV
- [ ] Export to Excel

### Attendance Reports
- [ ] Generate attendance report
- [ ] Filter by date range
- [ ] Filter by employee
- [ ] Export report

## 15. UI/UX Tests

### Responsive Design
- [ ] Desktop view (1920x1080)
- [ ] Laptop view (1366x768)
- [ ] Tablet view (768x1024)
- [ ] Mobile view (375x667)

### Navigation
- [ ] Sidebar navigation works
- [ ] Breadcrumbs displayed
- [ ] Back button works
- [ ] Role-based menu items

### Notifications
- [ ] Success toasts shown
- [ ] Error toasts shown
- [ ] Warning toasts shown
- [ ] Toast auto-dismiss works

### Forms
- [ ] Field validations work
- [ ] Required field indicators
- [ ] Error messages clear
- [ ] Submit button states
- [ ] Cancel button works

## 16. Security Tests

### Authorization
- [ ] Employee cannot access HR routes
- [ ] Manager cannot access Admin routes
- [ ] Unauthorized redirects to login
- [ ] Token expiry handled

### Data Protection
- [ ] Sensitive data masked
- [ ] No credentials in console
- [ ] HTTPS in production
- [ ] XSS prevention

## 17. Performance Tests

### Load Times
- [ ] Dashboard loads < 2 seconds
- [ ] List pages load < 3 seconds
- [ ] Forms submit < 1 second
- [ ] File uploads work smoothly

### Optimization
- [ ] Images optimized
- [ ] Lazy loading works
- [ ] Pagination reduces load
- [ ] No memory leaks

## 18. Email Notification Tests

### Leave Notifications
- [ ] Leave application email sent
- [ ] Leave approval email sent
- [ ] Leave rejection email sent
- [ ] Leave reminder email sent

### Holiday Notifications
- [ ] Holiday reminder sent 2 days prior
- [ ] Email template correct
- [ ] All employees receive email

## 19. Cron Job Tests

### Automated Jobs
- [ ] Monthly accrual runs correctly
- [ ] Year-end carry forward works
- [ ] Holiday notifications scheduled
- [ ] Leave reminders scheduled

## 20. Error Handling Tests

### Network Errors
- [ ] Server down message shown
- [ ] Retry mechanism works
- [ ] Offline detection

### Validation Errors
- [ ] Backend errors displayed
- [ ] Form validation errors clear
- [ ] User-friendly messages

---

## Test Results Summary

**Date:** _______________
**Tester:** _______________
**Environment:** _______________

**Total Tests:** _______________
**Passed:** _______________
**Failed:** _______________
**Skipped:** _______________

**Critical Issues:** _______________

**Notes:**
_______________________________________________
_______________________________________________
_______________________________________________
