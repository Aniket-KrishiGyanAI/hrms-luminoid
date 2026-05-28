const express = require("express");
const {
  getPermissions,
  getRoles,
  createRole,
  updateRole,
  deleteRole,
  assignUserRole,
  checkPermission,
} = require("../controllers/permissionController");
const { auth, authorize } = require("../middleware/auth");

const router = express.Router();

router.get("/permissions", auth, authorize("ADMIN", "HR"), getPermissions);
router.get("/roles", auth, authorize("ADMIN", "HR"), getRoles);
router.post("/roles", auth, authorize("ADMIN", "HR"), createRole);
router.put("/roles/:id", auth, authorize("ADMIN", "HR"), updateRole);
router.delete("/roles/:id", auth, authorize("ADMIN", "HR"), deleteRole);
router.post("/assign-role", auth, authorize("ADMIN", "HR"), assignUserRole);
router.get("/check", auth, checkPermission);

module.exports = router;
