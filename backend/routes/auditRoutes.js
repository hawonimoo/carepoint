const express = require("express");
const { listAuditLogs } = require("../controllers/auditController");
const { requireRoles } = require("../middleware/auth");

const router = express.Router();
router.use(requireRoles("admin"));
router.get("/", listAuditLogs);

module.exports = router;
