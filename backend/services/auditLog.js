const db = require("../config/db");

async function writeAuditLog({ userId = null, action, entityType = null, entityId = null, metadata = null, ipAddress = null }) {
  await db.promise().query(
    `INSERT INTO audit_logs
      (user_id, action, entity_type, entity_id, metadata, ip_address)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      userId,
      action,
      entityType,
      entityId === null ? null : String(entityId),
      metadata === null ? null : JSON.stringify(metadata),
      ipAddress,
    ]
  );
}

module.exports = { writeAuditLog };
