const jwt = require("jsonwebtoken");
const db = require("../config/db");

const COOKIE_NAME = "carepoint_session";
const ROLE_ALIASES = { lab_technician: "laboratory_staff" };

function isSecuritySchemaUnavailable(error) {
  return error.code === "ER_BAD_FIELD_ERROR" || error.code === "ER_NO_SUCH_TABLE";
}

function normalizeRole(role) {
  return ROLE_ALIASES[role] || role;
}

function tokenFromRequest(req) {
  const authorization = req.get("authorization");
  if (authorization && authorization.startsWith("Bearer ")) {
    return authorization.slice(7);
  }

  const cookie = req.headers?.cookie
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${COOKIE_NAME}=`));

  if (!cookie) return null;
  try {
    return decodeURIComponent(cookie.slice(COOKIE_NAME.length + 1));
  } catch {
    return null;
  }
}

async function requireAuth(req, res, next) {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    return res.status(503).json({ message: "Authentication is not configured" });
  }

  const token = tokenFromRequest(req);
  if (!token) {
    return res.status(401).json({ message: "Authentication required" });
  }

  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: "carepoint",
      audience: "carepoint-staff",
    });
    const [rows] = await db.promise().query(
      `SELECT u.id, u.full_name, u.email, u.role, u.is_active,
              u.doctor_id, u.department_id, s.expires_at, s.revoked_at
       FROM user_sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND u.id = ?
       LIMIT 1`,
      [payload.jti, payload.sub]
    );
    const session = rows[0];

    if (
      !session ||
      session.revoked_at ||
      !session.is_active ||
      new Date(session.expires_at).getTime() <= Date.now()
    ) {
      return res.status(401).json({ message: "Session is invalid or expired" });
    }

    req.authToken = token;
    req.sessionId = payload.jti;
    req.user = {
      id: session.id,
      fullName: session.full_name,
      email: session.email,
      role: normalizeRole(session.role),
      doctorId: session.doctor_id,
      departmentId: session.department_id,
    };
    return next();
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return res.status(401).json({ message: "Invalid or expired session" });
    }
    if (isSecuritySchemaUnavailable(error)) {
      return res.status(503).json({
        message: "CarePoint security database migration is required. Back up the database and apply backend/migrations/001_auth_and_notifications.sql.",
      });
    }

    return next(error);
  }
}

function requireRoles(...roles) {
  const allowed = new Set(roles);
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (!allowed.has(req.user.role)) {
      return res.status(403).json({ message: "You are not permitted to perform this action" });
    }
    return next();
  };
}

module.exports = {
  COOKIE_NAME,
  isSecuritySchemaUnavailable,
  normalizeRole,
  requireAuth,
  requireRoles,
};
