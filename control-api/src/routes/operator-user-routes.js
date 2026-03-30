const { randomUUID } = require("crypto");
const { hashPassword } = require("../auth-service");
const { ensureAuthenticated, ensurePermission } = require("./route-auth");

function registerOperatorUserRoutes(app, deps) {
  const {
    createOperatorUser,
    getOperatorById,
    listOperators,
    updateOperatorUser
  } = deps;

  app.get("/api/control/operators", async (req, res) => {
    if (!ensureAuthenticated(req, res)) return;

    try {
      res.json(await listOperators());
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/control/operators/:id", async (req, res) => {
    if (!ensureAuthenticated(req, res)) return;

    try {
      const operator = await getOperatorById(req.params.id);
      if (!operator) {
        res.status(404).json({ error: "Operator not found." });
        return;
      }
      res.json(operator);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/control/operators", async (req, res) => {
    if (!ensurePermission(req, res, "manageUsers", "Manage Users permission required")) return;

    try {
      const operator = await normalizeCreateOperatorPayload(req.body);
      const created = await createOperatorUser(operator, {
        operatorUserId: req.auth.user.id
      });
      res.status(201).json(created);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });

  app.patch("/api/control/operators/:id", async (req, res) => {
    if (!ensurePermission(req, res, "manageUsers", "Manage Users permission required")) return;

    try {
      const updates = await normalizeUpdateOperatorPayload(req.body);
      const updated = await updateOperatorUser(req.params.id, updates, {
        operatorUserId: req.auth.user.id
      });
      if (!updated) {
        res.status(404).json({ error: "Operator not found." });
        return;
      }
      res.json(updated);
    } catch (error) {
      res.status(error.statusCode || 500).json({ error: error.message });
    }
  });
}

async function normalizeCreateOperatorPayload(input) {
  const username = normalizeUsername(input?.username);
  const password = String(input?.password || "");
  if (!password || password.length < 10) {
    const error = new Error("Password must be at least 10 characters.");
    error.statusCode = 400;
    throw error;
  }

  return {
    id: `operator-${randomUUID()}`,
    username,
    firstName: normalizeName(input?.firstName),
    lastName: normalizeName(input?.lastName),
    role: "support_operator",
    permissions: normalizePermissionsPayload(input?.permissions),
    isActive: input?.isActive !== false,
    ...(await hashPassword(password))
  };
}

async function normalizeUpdateOperatorPayload(input) {
  const updates = {
    username: normalizeUsername(input?.username),
    firstName: normalizeName(input?.firstName),
    lastName: normalizeName(input?.lastName),
    role: "support_operator",
    permissions: normalizePermissionsPayload(input?.permissions),
    isActive: input?.isActive !== false
  };

  const password = String(input?.password || "");
  if (password) {
    if (password.length < 10) {
      const error = new Error("Password must be at least 10 characters.");
      error.statusCode = 400;
      throw error;
    }
    Object.assign(updates, await hashPassword(password));
  }

  return updates;
}

function normalizeUsername(value) {
  const username = String(value || "").trim();
  if (!/^[A-Za-z0-9_.-]{3,60}$/.test(username)) {
    const error = new Error("Username must be 3-60 characters using letters, numbers, dots, underscores, or hyphens.");
    error.statusCode = 400;
    throw error;
  }
  return username;
}

function normalizeName(value) {
  return String(value || "").trim().slice(0, 80);
}

function normalizePermissionsPayload(input) {
  const source = input && typeof input === "object" ? input : {};
  return {
    manageCustomers: !!source.manageCustomers,
    manageEnvironments: !!source.manageEnvironments,
    manageOperations: !!source.manageOperations,
    manageUsers: !!source.manageUsers
  };
}

module.exports = {
  registerOperatorUserRoutes
};
