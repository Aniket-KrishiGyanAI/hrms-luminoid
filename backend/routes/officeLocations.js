const express = require("express");
const {
  getOfficeLocations,
  createOfficeLocation,
  updateOfficeLocation,
  deleteOfficeLocation,
} = require("../controllers/officeLocationController");
const { auth, authorize } = require("../middleware/auth");

const router = express.Router();

router.get("/", auth, getOfficeLocations);
router.post("/", auth, authorize("ADMIN", "HR"), createOfficeLocation);
router.put("/:id", auth, authorize("ADMIN", "HR"), updateOfficeLocation);
router.delete("/:id", auth, authorize("ADMIN", "HR"), deleteOfficeLocation);

module.exports = router;
