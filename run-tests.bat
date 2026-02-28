@echo off
echo ========================================
echo HRMS System Testing
echo ========================================
echo.

echo Checking if backend server is running...
timeout /t 2 /nobreak >nul

echo.
echo Running comprehensive system tests...
echo.

cd backend
node test-system.js

echo.
echo ========================================
echo Test execution completed!
echo ========================================
echo.
echo Next Steps:
echo 1. Review the test results above
echo 2. Check FRONTEND_TEST_CHECKLIST.md for manual UI tests
echo 3. Fix any failed tests
echo 4. Verify email notifications in your inbox
echo.
pause
