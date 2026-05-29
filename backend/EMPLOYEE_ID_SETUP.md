# Employee ID Auto-Generation

## Overview
Employee IDs are now automatically generated with the format: **LUM0001**, **LUM0002**, **LUM0003**, etc.

## Features
- ✅ Auto-generates unique employee IDs starting with "LUM"
- ✅ Sequential numbering with 4-digit padding (LUM0001, LUM0002, etc.)
- ✅ Automatically assigned during employee creation
- ✅ Automatically assigned during user registration

## For Existing Employees

If you have existing employees without employee IDs, run the migration script:

### Steps to Assign Employee IDs to Existing Employees:

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **Run the migration script:**
   ```bash
   npm run assign:employee-ids
   ```

   OR directly:
   ```bash
   node scripts/assignEmployeeIds.js
   ```

### What the Migration Does:

1. ✅ Finds all employees without employee IDs
2. ✅ Assigns sequential LUM IDs starting from the next available number
3. ✅ Creates employee profiles for users who don't have one yet
4. ✅ Maintains chronological order based on creation date
5. ✅ Shows progress and summary of assigned IDs

### Example Output:
```
Connected to MongoDB
Found 25 employees without employee IDs
Starting from employee ID: LUM0001
Assigned LUM0001 to employee: 507f1f77bcf86cd799439011
Assigned LUM0002 to employee: 507f1f77bcf86cd799439012
...
✅ Successfully assigned employee IDs to 25 employees
Last assigned ID: LUM0025

✅ Migration completed successfully!
```

## How It Works

### For New Employees:
- When creating a new employee (via admin panel or registration)
- System automatically generates the next available employee ID
- Format: LUM + 4-digit number (e.g., LUM0001)

### Employee ID Storage:
- Stored in: `EmployeeProfile.professionalInfo.employeeId`
- Accessible via employee profile API endpoints

## Technical Details

### Files Modified:
1. `backend/utils/employeeIdGenerator.js` - ID generation utility
2. `backend/controllers/employeeManagementController.js` - Admin employee creation
3. `backend/controllers/authController.js` - User registration
4. `backend/scripts/assignEmployeeIds.js` - Migration script

### ID Format:
- Prefix: `LUM`
- Number: 4 digits with leading zeros
- Examples: LUM0001, LUM0099, LUM1234

## Important Notes

⚠️ **Run the migration script only once** to avoid duplicate processing

✅ The migration is **safe to run multiple times** - it only updates employees without IDs

✅ After migration, all new employees will automatically get sequential IDs

## Troubleshooting

If you encounter issues:

1. **Check MongoDB connection:**
   - Ensure `.env` file has correct `MONGODB_URI`

2. **Check existing IDs:**
   - Script automatically detects the last assigned ID
   - Continues from the next number

3. **Manual verification:**
   ```javascript
   // In MongoDB shell or Compass
   db.employeeprofiles.find({ "professionalInfo.employeeId": { $regex: /^LUM/ } })
   ```

## Support

For issues or questions, check the logs or contact the development team.
