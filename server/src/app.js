const express = require("express");
const { app: appConfig, session: sessionConfig } = require("./config");
const { getPool } = require("./db");
const { getPostgresPool } = require("./postgres-db");
const { applyCors, createAuthContextMiddleware } = require("./middleware/auth-context");
const { errorHandler } = require("./middleware/error-handler");
const { readState, writeState } = require("./state-store");
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
const { registerCalendarRoutes } = require("./routes/calendar-routes");
const { registerAdminRoutes } = require("./routes/admin-routes");
const { registerAuthRoutes } = require("./routes/auth-routes");
const { registerCurriculumRoutes } = require("./routes/curriculum-routes");
const { registerGradingRoutes } = require("./routes/grading-routes");
const { registerInfraRoutes } = require("./routes/infra-routes");
const { registerRecordsRoutes } = require("./routes/records-routes");
const { registerSetupRoutes } = require("./routes/setup-routes");
const { registerStateRoutes } = require("./routes/state-routes");
const {
  createDailyBreak,
  createHoliday,
  createPlans,
  createSchoolYear,
  createAttendance,
  createCourse,
  createEnrollment,
  createSubject,
  createTest,
  deleteAttendance,
  deleteTest,
  deleteSchoolYear,
  deleteCourse,
  deleteDailyBreak,
  deleteEnrollment,
  deleteHoliday,
  deletePlan,
  deleteSubject,
  getGradingCriteria,
  listAttendanceForUser,
  listCoursesForUser,
  listDailyBreaksForUser,
  listEnrollmentsForUser,
  listGradeTypes,
  listHolidays,
  listPlansForUser,
  listQuarters,
  replaceQuartersForSchoolYear,
  replaceGradeTypes,
  saveGradingCriteria,
  setCurrentSchoolYear,
  listSchoolYears,
  listSubjectsForUser,
  listTestsForUser,
  updateDailyBreak,
  updateAttendance,
  updateCourse,
  updateEnrollment,
  updateHoliday,
  updatePlan,
  updateSchoolYear,
  updateSubject,
  updateTest
} = require("./postgres-academics-store");

const app = express();
const isPostgresMode = appConfig.dbClient === "postgres";
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
  deleteUser,
  deleteStudent,
  getPool,
  getStudentById,
  getUserById,
  isPostgresMode,
  listStudents,
  listUsers,
  revokeSessionByTokenHash,
  sessionConfig,
  updateStudent,
  updateUser,
  createStudent
};
const curriculumRouteDeps = {
  createCourse,
  createEnrollment,
  createSubject,
  deleteCourse,
  deleteEnrollment,
  deleteSubject,
  isPostgresMode,
  listCoursesForUser,
  listEnrollmentsForUser,
  listSubjectsForUser,
  updateCourse,
  updateEnrollment,
  updateSubject
};
const calendarRouteDeps = {
  createSchoolYear,
  isPostgresMode,
  deleteSchoolYear,
  createDailyBreak,
  createHoliday,
  createPlans,
  deleteDailyBreak,
  deleteHoliday,
  deletePlan,
  listDailyBreaksForUser,
  listHolidays,
  listPlansForUser,
  listQuarters,
  listSchoolYears,
  replaceQuartersForSchoolYear,
  setCurrentSchoolYear,
  updateDailyBreak,
  updateHoliday,
  updatePlan,
  updateSchoolYear
};
const gradingRouteDeps = {
  getGradingCriteria,
  isPostgresMode,
  listGradeTypes,
  replaceGradeTypes,
  saveGradingCriteria
};
const recordsRouteDeps = {
  createAttendance,
  createTest,
  deleteAttendance,
  deleteTest,
  isPostgresMode,
  listAttendanceForUser,
  listTestsForUser,
  updateAttendance,
  updateTest
};
const stateRouteDeps = {
  isPostgresMode,
  readState,
  writeState
};
const infraRouteDeps = {
  getPool,
  getPostgresPool,
  isPostgresMode
};
const setupRouteDeps = {
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
