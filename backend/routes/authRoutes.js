const express = require("express");
const { login, logout, currentUser } = require("../controllers/authController");
const loginRateLimit = require("../middleware/loginRateLimit");
const { requireAuth } = require("../middleware/auth");
const csrfProtection = require("../middleware/csrfProtection");

const router = express.Router();

router.post("/login", csrfProtection, loginRateLimit, login);
router.post("/logout", requireAuth, csrfProtection, logout);
router.get("/me", requireAuth, currentUser);

module.exports = router;
