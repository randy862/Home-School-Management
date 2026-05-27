const express = require("express");
const { app: appConfig, commercial: commercialConfig, internal: internalConfig, mail: mailConfig, public: publicConfig, session: sessionConfig } = require("./config");
const { getPool } = require("./db");
const { getPostgresPool } = require("./postgres-db");
const { applyCors, createAuthContextMiddleware } = require("./middleware/auth-context");
const { errorHandler } = require("./middleware/error-handler");
const { applySecurityHeaders, createRateLimiter } = require("./middleware/security");
const { createTenantRuntimeContextMiddleware } = require("./middleware/tenant-runtime-context");
const { readLegacyBridgeState, writeLegacyBridgeState } = require("./legacy/local-state-bridge");
const {
  countAdmins,
  consumePasswordResetToken,
  createPasswordResetToken,
  createSession,
  createUser,
  deleteUser,
  getUserById,
  getUserByLoginIdentifier,
  getSessionByTokenHash,
  getUserByUsername,
  getSetupStatus,
  listUsers,
  initializeSetup,
  revokeSessionByTokenHash,
  updateLastLogin,
  updateUser
} = require("./postgres-auth-store");
const {
  createStudent,
  deleteStudent,
  getStudentById,
  listStudents,
  restoreStudent,
  updateStudent
} = require("./postgres-student-store");
const {
  createInstructor,
  deleteInstructor,
  getInstructorById,
  listInstructors,
  listInstructorsForUser,
  updateInstructor
} = require("./postgres-instructor-store");
const {
  getWorkspaceConfig,
  saveWorkspaceConfig
} = require("./postgres-workspace-config-store");
const { registerCalendarRoutes } = require("./routes/calendar-routes");
const { registerAccountRoutes } = require("./routes/account-routes");
const { registerAdminRoutes } = require("./routes/admin-routes");
const { registerAuthRoutes } = require("./routes/auth-routes");
const { registerCurriculumRoutes } = require("./routes/curriculum-routes");
const { registerGradingRoutes } = require("./routes/grading-routes");
const { registerInfraRoutes } = require("./routes/infra-routes");
const { registerRecordsRoutes } = require("./routes/records-routes");
const { registerSetupRoutes } = require("./routes/setup-routes");
const { registerStateRoutes } = require("./routes/state-routes");
const { createCalendarRepository } = require("./repositories/postgres/calendar-repository");
const { createCurriculumRepository } = require("./repositories/postgres/curriculum-repository");
const { createGradingRepository } = require("./repositories/postgres/grading-repository");
const { createRecordsRepository } = require("./repositories/postgres/records-repository");
const { createCalendarService } = require("./services/calendar-service");
const { createCurriculumService } = require("./services/curriculum-service");
const { createGradingService } = require("./services/grading-service");
const { createCommercialPolicyService } = require("./services/commercial-policy-service");
const { createControlPlaneClient } = require("./services/control-plane-client");
const { createRecordsService } = require("./services/records-service");
const { createWorkspaceConfigService } = require("./services/workspace-config-service");
const { createMailService } = require("./services/mail-service");

const app = express();
app.disable("etag");
const isPostgresMode = appConfig.dbClient === "postgres";
const controlPlaneClient = createControlPlaneClient({
  internalConfig
});
const commercialPolicyService = isPostgresMode
  ? createCommercialPolicyService({
    commercialConfig,
    controlPlaneClient,
    getPostgresPool
  })
  : null;
const mailService = createMailService(mailConfig);
const authRouteDeps = {
  consumePasswordResetToken,
  createSession,
  createPasswordResetToken,
  getUserByLoginIdentifier,
  getUserByUsername,
  isPostgresMode,
  mailService,
  passwordResetConfig: {
    environmentLabel: mailConfig.environmentLabel,
    publicBaseUrl: publicConfig.appBaseUrl,
    supportEmail: mailConfig.supportEmail,
    tokenTtlMinutes: Number(process.env.PASSWORD_RESET_TTL_MINUTES || 60)
  },
  revokeSessionByTokenHash,
  sessionConfig,
  updateLastLogin
};
const accountRouteDeps = {
  commercialPolicyService,
  controlPlaneClient,
  getUserById,
  internalConfig,
  isPostgresMode,
  updateUser
};
const adminRouteDeps = {
  countAdmins,
  createUser,
  createInstructor,
  deleteUser,
  deleteStudent,
  deleteInstructor,
  getPool,
  getInstructorById,
  getStudentById,
  getUserById,
  isPostgresMode,
  listInstructors,
  listInstructorsForUser,
  listStudents,
  listUsers,
  restoreStudent,
  revokeSessionByTokenHash,
  sessionConfig,
  updateInstructor,
  updateStudent,
  updateUser,
  createStudent,
  commercialPolicyService,
  ...createWorkspaceConfigService({
    workspaceConfigStore: {
      getWorkspaceConfig,
      saveWorkspaceConfig
    }
  })
};
const curriculumRouteDeps = {
  curriculumService: createCurriculumService({
    curriculumRepository: createCurriculumRepository({
      getPostgresPool
    })
  }),
  commercialPolicyService,
  isPostgresMode,
};
const calendarRouteDeps = {
  calendarService: createCalendarService({
    calendarRepository: createCalendarRepository({
      getPostgresPool
    })
  }),
  commercialPolicyService,
  isPostgresMode,
};
const gradingRouteDeps = {
  gradingService: createGradingService({
    gradingRepository: createGradingRepository({
      getPostgresPool
    })
  }),
  isPostgresMode,
};
const recordsRouteDeps = {
  commercialPolicyService,
  isPostgresMode,
  recordsService: createRecordsService({
    recordsRepository: createRecordsRepository({
      getPostgresPool
    })
  })
};
const stateRouteDeps = {
  allowLegacyStateSync: appConfig.allowLegacyStateSync,
  isPostgresMode,
  readLegacyBridgeState,
  writeLegacyBridgeState
};
const infraRouteDeps = {
  getPool,
  getPostgresPool,
  isPostgresMode
};
const setupRouteDeps = {
  internalConfig,
  getSetupStatus,
  initializeSetup,
  isPostgresMode,
  sessionConfig
};

app.set("trust proxy", 1);
applySecurityHeaders(app);
applyCors(app, appConfig);
app.use("/api/auth/login", createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 }));
app.use("/api/auth/password-reset/request", createRateLimiter({ windowMs: 15 * 60 * 1000, max: 5 }));
app.use("/api/auth/password-reset/complete", createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10 }));
app.use("/api/setup/initialize", createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5 }));
app.use(express.json({ limit: "5mb" }));
app.use("/api", (req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});
app.use(createTenantRuntimeContextMiddleware({
  commercialConfig,
  isPostgresMode
}));
app.use(createAuthContextMiddleware({
  getSessionByTokenHash,
  isPostgresMode,
  sessionConfig
}));
app.use("/api", async (req, _res, next) => {
  if (!commercialPolicyService || !isTenantMutationMethod(req.method) || isDormantWriteAllowedPath(req.path)) {
    next();
    return;
  }

  try {
    await commercialPolicyService.assertTenantWriteAllowed("Workspace changes cannot be saved");
    next();
  } catch (error) {
    next(error);
  }
});

registerInfraRoutes(app, {
  ...infraRouteDeps
});
registerSetupRoutes(app, setupRouteDeps);

registerAuthRoutes(app, authRouteDeps);

registerAccountRoutes(app, accountRouteDeps);

registerAdminRoutes(app, adminRouteDeps);

registerCurriculumRoutes(app, curriculumRouteDeps);

registerCalendarRoutes(app, calendarRouteDeps);

registerGradingRoutes(app, gradingRouteDeps);

registerRecordsRoutes(app, recordsRouteDeps);

registerStateRoutes(app, stateRouteDeps);

app.use(errorHandler);

app.listen(appConfig.port, () => {
  // Minimal bootstrap log for local operations.
  console.log(`API listening on port ${appConfig.port} using ${appConfig.dbClient}`);
});

function isTenantMutationMethod(method) {
  return ["POST", "PUT", "PATCH", "DELETE"].includes(String(method || "").toUpperCase());
}

function isDormantWriteAllowedPath(path) {
  const normalized = String(path || "").trim().toLowerCase();
  return normalized.startsWith("/account")
    || normalized.startsWith("/auth")
    || normalized.startsWith("/setup");
}
