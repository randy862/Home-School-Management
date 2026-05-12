const { normalizeOperatorPermissions } = require("../auth-service");

function ensureAuthenticated(req, res) {
  if (req.auth?.user) return true;
  res.status(401).json({ error: "Authentication required." });
  return false;
}

function hasPermission(user, permission) {
  if (!user) return false;
  if (user.role === "platform_admin") return true;
  const permissions = normalizeOperatorPermissions(user.permissions, user.role);
  return !!permissions[permission];
}

function ensurePermission(req, res, permission, label = "Required permission") {
  if (!ensureAuthenticated(req, res)) return false;
  if (hasPermission(req.auth.user, permission)) return true;
  res.status(403).json({ error: `${label}.` });
  return false;
}

function ensurePlatformAdmin(req, res) {
  return ensurePermission(req, res, "manageUsers", "Platform-admin access required");
}

function sendRouteError(res, error) {
  const statusCode = Number(error.statusCode || error.status || 500);
  const safeStatusCode = statusCode >= 400 && statusCode < 600 ? statusCode : 500;
  const isProduction = String(process.env.CONTROL_APP_ENV || process.env.APP_ENV || "").toLowerCase() === "production";
  const message = safeStatusCode >= 500 && isProduction
    ? "Unexpected error."
    : (error.message || "Unexpected error.");
  if (safeStatusCode >= 500) {
    console.error(error);
  }
  res.status(safeStatusCode).json({ error: message });
}

module.exports = {
  ensureAuthenticated,
  ensurePermission,
  ensurePlatformAdmin,
  hasPermission,
  sendRouteError
};
