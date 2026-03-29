function ensureAuthenticated(req, res) {
  if (req.auth?.user) return true;
  res.status(401).json({ error: "Authentication required." });
  return false;
}

function ensurePlatformAdmin(req, res) {
  if (!ensureAuthenticated(req, res)) return false;
  if (req.auth.user.role === "platform_admin") return true;
  res.status(403).json({ error: "Platform-admin access required." });
  return false;
}

module.exports = {
  ensureAuthenticated,
  ensurePlatformAdmin
};
