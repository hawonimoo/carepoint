const express = require("express");
const { requireRoles } = require("../middleware/auth");
const auditResponse = require("../middleware/auditResponse");
const {
  accept,
  create,
  dispense,
  list,
} = require("../controllers/prescriptionOrder.controller");

const router = express.Router();

router.get("/", requireRoles("admin", "doctor", "pharmacist"), auditResponse("prescription_order.list_accessed", "prescription_order"), list);
router.post("/", requireRoles("doctor"), auditResponse("prescription_order.created", "prescription_order"), create);
router.post("/:id/accept", requireRoles("admin", "pharmacist"), auditResponse("prescription_order.accepted", "prescription_order"), accept);
router.post("/:id/dispense", requireRoles("admin", "pharmacist"), auditResponse("prescription_order.dispensed", "prescription_order"), dispense);

module.exports = router;
