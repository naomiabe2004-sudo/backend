const AuditLog = require("../models/AuditLog");
const User = require("../models/User");

// Saves one audit record. It never crashes the main request.
async function logAction(req, action, details) {
  try {
    const me = await User.findById(req.user.id).select("name");
    await AuditLog.create({
      actor: req.user.id,
      actorName: me ? me.name : "Unknown",
      actorRole: req.user.role,
      action,
      details: details || "",
    });
  } catch (err) {
    console.error("Audit log failed:", err.message);
  }
}

module.exports = logAction;