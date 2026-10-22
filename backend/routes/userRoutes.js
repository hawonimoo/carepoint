const express = require("express");
const { listUsers, createUser, updateUser } = require("../controllers/userController");
const { requireRoles } = require("../middleware/auth");

const router = express.Router();
router.use(requireRoles("admin"));
router.get("/", listUsers);
router.post("/", createUser);
router.patch("/:id", updateUser);

module.exports = router;
