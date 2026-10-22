const bcrypt = require("bcryptjs");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const db = require("../config/db");
const {
  COOKIE_NAME,
  isSecuritySchemaUnavailable,
  normalizeRole,
} = require("../middleware/auth");
const { writeAuditLog } = require("../services/auditLog");

const SESSION_TTL_SECONDS = 8 * 60 * 60;
const DUMMY_PASSWORD_HASH = bcrypt.hashSync("carepoint-invalid-login", 10);
const BCRYPT_HASH_PATTERN = /^\$2[aby]\$(?:0[4-9]|[12]\d|3[01])\$[./A-Za-z0-9]{53}$/;

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api",
    maxAge: SESSION_TTL_SECONDS * 1000,
  };
}

function clearCookieOptions() {
  const { httpOnly, secure, sameSite, path } = cookieOptions();
  return { httpOnly, secure, sameSite, path };
}

async function login(req, res, next) {
  const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const password = req.body?.password;

  if (!email || typeof password !== "string" || !password || email.length > 254 || password.length > 128) {
    return res.status(400).json({ message: "Provide a valid email and password" });
  }

  try {
    const [rows] = await db.promise().query(
      `SELECT id, full_name, email, password, role, is_active, doctor_id, department_id
       FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1`,
      [email]
    );
    const user = rows[0];
    const hashToCheck = BCRYPT_HASH_PATTERN.test(user?.password || "")
      ? user.password
      : DUMMY_PASSWORD_HASH;
    const passwordMatches = await bcrypt.compare(password, hashToCheck);
    const valid = user && user.is_active && passwordMatches;

    if (!valid) {
      await writeAuditLog({
        userId: user?.id ?? null,
        action: "auth.login_failed",
        entityType: "user",
        entityId: user?.id ?? null,
        metadata: { reason: "invalid_credentials" },
        ipAddress: req.ip,
      });
      return res.status(401).json({ message: "Invalid email or password" });
    }

    req.clearLoginRateLimit?.();
    if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
      return res.status(503).json({ message: "Authentication is not configured" });
    }

    const sessionId = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
    const token = jwt.sign(
      { role: normalizeRole(user.role) },
      process.env.JWT_SECRET,
      {
        algorithm: "HS256",
        subject: String(user.id),
        jwtid: sessionId,
        issuer: "carepoint",
        audience: "carepoint-staff",
        expiresIn: SESSION_TTL_SECONDS,
      }
    );
    const connection = await db.promise().getConnection();

    try {
      await connection.beginTransaction();
      await connection.query(
        "INSERT INTO user_sessions (id, user_id, expires_at) VALUES (?, ?, ?)",
        [sessionId, user.id, expiresAt]
      );
      await connection.query(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, ip_address)
         VALUES (?, 'auth.login_succeeded', 'user', ?, ?)`,
        [user.id, String(user.id), req.ip]
      );
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    res.cookie(COOKIE_NAME, token, cookieOptions());
    return res.status(200).json({
      user: {
        id: user.id,
        fullName: user.full_name,
        email: user.email,
        role: normalizeRole(user.role),
      },
    });
  } catch (error) {
    if (isSecuritySchemaUnavailable(error)) {
      return res.status(503).json({
        message: "CarePoint security database migration is required. Back up the database and apply backend/migrations/001_auth_and_notifications.sql.",
      });
    }
    return next(error);
  }
}

async function logout(req, res, next) {
  try {
    await db.promise().query(
      "UPDATE user_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND revoked_at IS NULL",
      [req.sessionId, req.user.id]
    );
    await writeAuditLog({
      userId: req.user.id,
      action: "auth.logout",
      entityType: "user",
      entityId: req.user.id,
      ipAddress: req.ip,
    });
    res.clearCookie(COOKIE_NAME, clearCookieOptions());
    return res.status(200).json({ message: "Logged out" });
  } catch (error) {
    return next(error);
  }
}

function currentUser(req, res) {
  return res.status(200).json({ user: req.user });
}

module.exports = { login, logout, currentUser };
