const crypto = require("crypto");

const PBKDF2_ITERATIONS = 120000;
const PBKDF2_KEYLEN = 32;
const PBKDF2_DIGEST = "sha256";

function pbkdf2Hex(password, salt, iterations = PBKDF2_ITERATIONS) {
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(String(password || ""), String(salt || ""), iterations, PBKDF2_KEYLEN, PBKDF2_DIGEST, (error, derivedKey) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(derivedKey.toString("hex"));
    });
  });
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const iterations = PBKDF2_ITERATIONS;
  const hash = await pbkdf2Hex(password, salt, iterations);
  return {
    passwordSalt: salt,
    passwordHash: hash,
    passwordAlgorithm: "pbkdf2_sha256",
    passwordIterations: iterations
  };
}

async function verifyPassword(user, password) {
  if (!user || !user.passwordSalt || !user.passwordHash) return false;
  const actual = await pbkdf2Hex(password, user.passwordSalt, Number(user.passwordIterations || PBKDF2_ITERATIONS));
  const actualBuffer = Buffer.from(actual, "hex");
  const expectedBuffer = Buffer.from(String(user.passwordHash), "hex");
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function createSessionToken() {
  return crypto.randomBytes(32).toString("base64url");
}

function hashSessionToken(token) {
  return crypto.createHash("sha256").update(String(token || "")).digest("hex");
}

function parseCookies(cookieHeader) {
  return String(cookieHeader || "")
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((accumulator, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) return accumulator;
      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      accumulator[key] = decodeURIComponent(value);
      return accumulator;
    }, {});
}

function serializeSessionCookie(name, token, options = {}) {
  const segments = [
    `${name}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    `SameSite=${options.sameSite || "Lax"}`
  ];
  if (options.maxAge != null) segments.push(`Max-Age=${Math.max(0, Number(options.maxAge || 0))}`);
  if (options.secure) segments.push("Secure");
  return segments.join("; ");
}

function clearSessionCookie(name, options = {}) {
  return serializeSessionCookie(name, "", { ...options, maxAge: 0 });
}

function normalizeOperatorPermissions(input, role = "support_operator") {
  const source = input && typeof input === "object" ? input : {};
  const normalized = {
    manageCustomers: !!source.manageCustomers,
    manageEnvironments: !!source.manageEnvironments,
    manageOperations: !!source.manageOperations,
    manageUsers: !!source.manageUsers
  };

  if (role === "platform_admin" && !Object.values(normalized).some(Boolean)) {
    return {
      manageCustomers: true,
      manageEnvironments: true,
      manageOperations: true,
      manageUsers: true
    };
  }
  return normalized;
}

function deriveOperatorAccountType(permissions = {}) {
  const normalized = normalizeOperatorPermissions(permissions);
  const enabled = Object.entries(normalized)
    .filter(([, value]) => value)
    .map(([key]) => key);
  if (enabled.length === 4) return "Super Admin";
  if (!enabled.length) return "Read Only";
  if (normalized.manageUsers && enabled.length === 1) return "User Admin";
  if (normalized.manageCustomers && normalized.manageEnvironments && !normalized.manageOperations && !normalized.manageUsers) {
    return "Customer and Environment Admin";
  }
  if (normalized.manageCustomers && !normalized.manageEnvironments && !normalized.manageOperations && !normalized.manageUsers) return "Customer Admin";
  if (normalized.manageEnvironments && !normalized.manageCustomers && !normalized.manageOperations && !normalized.manageUsers) return "Environment Admin";
  if (normalized.manageOperations && !normalized.manageCustomers && !normalized.manageEnvironments && !normalized.manageUsers) return "Operations Admin";
  return enabled
    .map((key) => key.replace(/^manage/, ""))
    .map((value) => value.replace(/([A-Z])/g, " $1").trim())
    .join(" + ");
}

function isFullAccessPermissionSet(permissions = {}) {
  const normalized = normalizeOperatorPermissions(permissions);
  return normalized.manageCustomers
    && normalized.manageEnvironments
    && normalized.manageOperations
    && normalized.manageUsers;
}

function mapOperatorSummary(user) {
  if (!user) return null;
  const permissions = normalizeOperatorPermissions(user.permissions, user.role);
  return {
    id: user.id,
    username: user.username,
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    role: user.role,
    permissions,
    accountType: deriveOperatorAccountType(permissions),
    isActive: !!user.isActive
  };
}

module.exports = {
  clearSessionCookie,
  createSessionToken,
  hashPassword,
  hashSessionToken,
  deriveOperatorAccountType,
  isFullAccessPermissionSet,
  mapOperatorSummary,
  normalizeOperatorPermissions,
  parseCookies,
  serializeSessionCookie,
  verifyPassword
};
