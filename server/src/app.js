const express = require("express");
const { app: appConfig, commercial: commercialConfig, internal: internalConfig, session: sessionConfig } = require("./config");
const { getPool } = require("./db");
const { getPostgresPool } = require("./postgres-db");
const { applyCors, createAuthContextMiddleware } = require("./middleware/auth-context");
const { errorHandler } = require("./middleware/error-handler");
const { readLegacyBridgeState, writeLegacyBridgeState } = require("./legacy/local-state-bridge");
const {
  countAdmins,
  createSession,
  createUser,
  deleteUser,
  getUserById,
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
  updateStudent
} = require("./postgres-student-store");
const {
  createInstructor,
  deleteInstructor,
  getInstructorById,
  listInstructors,
  updateInstructor
} = require("./postgres-instructor-store");
const {
  getWorkspaceConfig,
  saveWorkspaceConfig
} = require("./postgres-workspace-config-store");
const { registerCalendarRoutes } = require("./routes/calendar-routes");
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
const { createRecordsService } = require("./services/records-service");
const { createWorkspaceConfigService } = require("./services/workspace-config-service");

const app = express();
const isPostgresMode = appConfig.dbClient === "postgres";
const commercialPolicyService = isPostgresMode
  ? createCommercialPolicyService({
    commercialConfig,
    getPostgresPool
  })
  : null;
const authRouteDeps = {
  createSession,
  getUserByUsername,
  isPostgresMode,
  revokeSessionByTokenHash,
  sessionConfig,
  updateLastLogin
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
  listStudents,
  listUsers,
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

applyCors(app, appConfig);
app.use(express.json({ limit: "5mb" }));
app.use(createAuthContextMiddleware({
  getSessionByTokenHash,
  isPostgresMode,
  sessionConfig
}));

registerInfraRoutes(app, {
  ...infraRouteDeps
});
registerSetupRoutes(app, setupRouteDeps);

registerAuthRoutes(app, authRouteDeps);

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
