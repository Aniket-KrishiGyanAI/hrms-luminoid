const express = require("express");
const path = require("path");
const multer = require("multer");
const {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  approveRejectExpense,
  uploadBills,
  deleteBill,
  serveBill,
} = require("../controllers/expenseController");
const { auth, authorize } = require("../middleware/auth");

const router = express.Router();

const ALLOWED_MIMETYPES = ['image/jpeg', 'image/png', 'application/pdf'];
const ALLOWED_EXTENSIONS = /\.(jpeg|jpg|png|pdf)$/i;

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/receipts/"),
  filename: (req, file, cb) => {
    // Sanitize: strip any path separators from original filename
    const safeName = path.basename(file.originalname).replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "receipt-" + uniqueSuffix + "-" + safeName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (
      ALLOWED_MIMETYPES.includes(file.mimetype) &&
      ALLOWED_EXTENSIONS.test(file.originalname)
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only JPEG, PNG, and PDF files are allowed!"));
    }
  },
});

router.get("/", auth, getExpenses);
router.post("/", auth, upload.array("bills", 10), createExpense);
router.put("/:id", auth, upload.array("bills", 10), updateExpense);
router.post("/:id/upload-bills", auth, upload.array("bills", 10), uploadBills);
router.delete("/:id", auth, deleteExpense);
router.get("/:id/bills/:billIndex/view", auth, serveBill);
router.delete("/:id/bills/:billIndex", auth, deleteBill);
router.put(
  "/:id/approve-reject",
  auth,
  authorize("MANAGER", "HR", "ADMIN"),
  approveRejectExpense,
);

module.exports = router;
