const express = require("express");
const { createPatientAssignment, deletePatientAssignment } = require("../controllers/assignmentController");
const { requireRoles } = require("../middleware/auth");

const router = express.Router();
router.use(requireRoles("admin"));
router.post("/", createPatientAssignment);
router.delete("/:id", deletePatientAssignment);

module.exports = router;
