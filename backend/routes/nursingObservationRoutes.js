const express = require("express");
const { listObservations, createObservation } = require("../controllers/nursingObservationController");
const { requireRoles } = require("../middleware/auth");

const router = express.Router();
router.get("/", requireRoles("admin", "nurse"), listObservations);
router.post("/", requireRoles("nurse"), createObservation);

module.exports = router;
