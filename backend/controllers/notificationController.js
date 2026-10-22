const db = require("../config/db");

async function listNotifications(req, res, next) {
  try {
    const isAdmin = req.user.role === "admin";
    const [rows] = await db.promise().query(
      `SELECT id, recipient_user_id, patient_id, event_type, channel, status,
              message, error, sent_at, read_at, created_at
       FROM notifications
       ${isAdmin ? "" : "WHERE recipient_user_id = ?"}
       ORDER BY created_at DESC
       LIMIT 100`,
      isAdmin ? [] : [req.user.id]
    );
    return res.json(rows);
  } catch (error) {
    return next(error);
  }
}

async function markRead(req, res, next) {
  if (!/^[1-9]\d*$/.test(req.params.id)) {
    return res.status(400).json({ message: "Invalid notification ID" });
  }
  try {
    const [result] = await db.promise().query(
      `UPDATE notifications SET read_at = CURRENT_TIMESTAMP
       WHERE id = ? AND recipient_user_id = ? AND read_at IS NULL`,
      [req.params.id, req.user.id]
    );
    if (!result.affectedRows) {
      const [rows] = await db.promise().query(
        "SELECT id FROM notifications WHERE id = ? AND recipient_user_id = ?",
        [req.params.id, req.user.id]
      );
      if (!rows.length) return res.status(404).json({ message: "Notification not found" });
    }
    return res.json({ message: "Notification marked as read" });
  } catch (error) {
    return next(error);
  }
}

module.exports = { listNotifications, markRead };
