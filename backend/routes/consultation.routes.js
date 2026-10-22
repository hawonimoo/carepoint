const express = require("express");
const { requireRoles } = require("../middleware/auth");
const auditResponse = require("../middleware/auditResponse");
const {
  createConsultation,
  getConsultationById,
  listConsultations,
} = require("../controllers/consultation.controller");

const router = express.Router();

router.post(
  "/",
  requireRoles("doctor"),
  auditResponse("consultation.created", "consultation"),
  createConsultation
);
router.get(
  "/",
  requireRoles("admin", "doctor"),
  auditResponse("consultation.list_accessed", "consultation"),
  listConsultations
);
router.get(
  "/:id",
  requireRoles("admin", "doctor"),
  auditResponse("consultation.accessed", "consultation"),
  getConsultationById
);

module.exports = router;
