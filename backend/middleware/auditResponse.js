const { writeAuditLog } = require("../services/auditLog");

function auditResponse(action, entityType) {
  return (req, res, next) => {
    res.once("finish", () => {
      if (res.statusCode >= 400) return;
      writeAuditLog({
        userId: req.user.id,
        action,
        entityType,
        entityId: req.params.id || null,
        metadata: { status_code: res.statusCode, method: req.method },
        ipAddress: req.ip,
      }).catch((error) => {
        console.error("Audit log write failed:", error.code || "database error");
      });
    });
    next();
  };
}

module.exports = auditResponse;
