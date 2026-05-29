const express = require("express");
const multer = require("multer");
const {
  createDepartment,
  getAllDepartments,
  getDepartmentById,
  updateDepartment,
  deleteDepartment,
  assignEmployee,
  bulkAssignEmployees,
  bulkStatusChange,
  bulkDelete,
  transferEmployees,
  addGoal,
  updateGoal,
  addGoalComment,
  updateMilestone,
  uploadDocument,
  importDepartments,
  getHierarchy,
  getEmployeesForTransfer,
  removeEmployeeFromDepartment,
} = require("../controllers/departmentController");
const { auth, authorize } = require("../middleware/auth");

const router = express.Router();

const upload = multer({ dest: "uploads/" });

router.post("/", auth, authorize("ADMIN", "HR"), createDepartment);
router.get("/", auth, getAllDepartments);
router.get("/hierarchy", auth, getHierarchy);
router.get("/employees-for-transfer", auth, getEmployeesForTransfer);
router.get("/:id", auth, getDepartmentById);
router.get("/:id/employees", auth, getDepartmentById);
router.put("/:id", auth, authorize("ADMIN", "HR"), updateDepartment);
router.delete("/:id", auth, authorize("ADMIN", "HR"), deleteDepartment);
router.post("/assign", auth, authorize("ADMIN", "HR"), assignEmployee);
router.post(
  "/bulk-assign",
  auth,
  authorize("ADMIN", "HR"),
  bulkAssignEmployees,
);
router.post("/bulk-status", auth, authorize("ADMIN", "HR"), bulkStatusChange);
router.post("/bulk-delete", auth, authorize("ADMIN", "HR"), bulkDelete);
router.post("/transfer", auth, authorize("ADMIN", "HR"), transferEmployees);
router.post("/:id/goals", auth, authorize("ADMIN", "HR"), addGoal);
router.put("/:id/goals/:goalId", auth, authorize("ADMIN", "HR"), updateGoal);
router.post(
  "/:id/goals/:goalId/comments",
  auth,
  authorize("ADMIN", "HR", "MANAGER"),
  addGoalComment,
);
router.put(
  "/:id/goals/:goalId/milestones/:milestoneId",
  auth,
  authorize("ADMIN", "HR", "MANAGER"),
  updateMilestone,
);
router.post("/:id/documents", auth, authorize("ADMIN", "HR"), uploadDocument);
router.post(
  "/import",
  auth,
  authorize("ADMIN", "HR"),
  upload.single("file"),
  importDepartments,
);
router.delete(
  "/:id/employees/:empId",
  auth,
  authorize("ADMIN", "HR", "MANAGER"),
  removeEmployeeFromDepartment,
);

module.exports = router;
