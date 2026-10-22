const express = require("express");
const { requireRoles } = require("../middleware/auth");
const auditResponse = require("../middleware/auditResponse");
const {
  accept,
  reject,
  updateSample,
  saveResult,
  verifyAndRelease,
  create,
  list,
  listCatalogue,
  updateItem,
} = require("../controllers/laboratoryOrder.controller");

const router = express.Router();

router.get("/catalogue", requireRoles("admin", "doctor", "laboratory_staff"), listCatalogue);
router.get("/", requireRoles("admin", "doctor", "laboratory_staff"), auditResponse("laboratory_order.list_accessed", "laboratory_order"), list);
router.post("/", requireRoles("doctor"), auditResponse("laboratory_order.created", "laboratory_order"), create);
router.post("/:id/accept", requireRoles("admin", "laboratory_staff"), auditResponse("laboratory_order.accepted", "laboratory_order"), accept);
router.post("/:id/reject", requireRoles("admin", "laboratory_staff"), auditResponse("laboratory_order.rejected", "laboratory_order"), reject);
router.patch("/:id/items/:itemId/sample", requireRoles("admin", "laboratory_staff"), auditResponse("laboratory_sample.updated", "laboratory_order_item"), updateSample);
router.patch("/:id/items/:itemId/result", requireRoles("admin", "laboratory_staff"), auditResponse("laboratory_result.saved", "laboratory_order_item"), saveResult);
router.post("/:id/items/:itemId/verify", requireRoles("admin", "laboratory_staff"), auditResponse("laboratory_result.verified", "laboratory_order_item"), verifyAndRelease);
router.patch("/:id/items/:itemId", requireRoles("admin", "laboratory_staff"), auditResponse("laboratory_test.updated", "laboratory_order_item"), updateItem);

module.exports = router;
