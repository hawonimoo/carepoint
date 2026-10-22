const express = require("express");
const { listStaff, listDepartments, createStaff, updateStaff } = require("../controllers/staffController");
const { requireRoles } = require("../middleware/auth");

const router = express.Router();
router.use(requireRoles("admin"));
router.get("/departments", listDepartments);
router.get("/", listStaff);
router.post("/", createStaff);
router.patch("/:staffKey", updateStaff);

module.exports = router;
