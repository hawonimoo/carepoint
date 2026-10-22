const db = require("../config/db");

async function listAuditLogs(req, res, next) {
  const requestedLimit = Number(req.query.limit || 50);
  const limit = Number.isInteger(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50;
  const beforeId = req.query.before;

  if (beforeId !== undefined && !/^[1-9]\d*$/.test(String(beforeId))) {
    return res.status(400).json({ message: "Invalid audit cursor" });
  }

  try {
    const [rows] = await db.promise().query(
      `SELECT id, user_id, action, entity_type, entity_id, metadata, ip_address, created_at
       FROM audit_logs
       WHERE (? IS NULL OR id < ?)
       ORDER BY id DESC
       LIMIT ?`,
      [beforeId || null, beforeId || null, limit]
    );
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
}

module.exports = { listAuditLogs };
