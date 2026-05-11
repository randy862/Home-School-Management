const DEFAULT_WORKSPACE_CONFIG = {
  schoolDay: {
    showReferenceDateFilter: true,
    showStudentFilter: true,
    showSubjectFilter: true,
    showCourseFilter: true,
    showStudentSummaries: true,
    showSideBySideOverview: true,
    showResetStudentDayButton: true,
    showResetFilteredDayButton: true,
    showNeedsAttendanceFilter: true,
    showNeedsGradeFilter: true,
    showNeedsCompletionFilter: true,
    showOverriddenFilter: true,
    defaultTab: "daily-schedule",
    studentSummariesDefault: "adaptive",
    overviewDefault: "collapsed"
  },
  dashboard: {
    showOverviewInstructionDays: true,
    showOverviewInstructionHours: true,
    showOverviewAttendance: true,
    showOverviewRunningGradeAverage: true,
    showOverviewSchoolYearProgress: true,
    showOverviewQuarterProgress: true,
    showOverviewCompletedToday: true,
    showOverviewOpenItemsToday: true,
    showOverviewGradesAtRisk: true,
    showOverviewMissingRequiredSubjects: true,
    showExecutionOpenItemsToday: true,
    showExecutionCompletedToday: true,
    showCourseWatchlist: true,
    showStudentPerformance: true,
    showStudentGradeTrending: false,
    showInstructorGradeTrending: false,
    showGpaTrending: false,
    showGradeTypeVolume: false,
    showWorkDistribution: false,
    showRequiredInstructionalHours: true,
    showInstructionHoursPerMonth: true,
    showRequiredInstructionalDays: true,
    showInstructionDaysPerMonth: true,
    showStudentAttendance: true,
    showStudentInstructionalHours: true,
    showInstructionHoursTrending: false,
    showInstructionDaysTrending: false,
    showRequiredSubjectCompliance: true
  },
  alerts: {
    showOpenAttendance: true,
    showOpenCompletion: true,
    showMissingGrades: true,
    showInstructionPace: true,
    showGradeRisk: true,
    showSingleGradeRisk: true,
    showAttendanceRisk: true,
    gradeRiskThresholdPercent: 70,
    singleGradeRiskThresholdPercent: 70,
    attendanceRiskThresholdPercent: 90,
    riskAlertCadenceDays: 7
  }
};

function createWorkspaceConfigService(deps) {
  const { workspaceConfigStore } = deps;

  return {
    getWorkspaceConfig: async () => {
      const saved = await workspaceConfigStore.getWorkspaceConfig();
      return normalizeWorkspaceConfigPayload(saved?.config || {});
    },
    saveWorkspaceConfig: async (payload) => {
      const normalized = normalizeWorkspaceConfigPayload(payload);
      await workspaceConfigStore.saveWorkspaceConfig(normalized);
      return normalized;
    }
  };
}

function normalizeWorkspaceConfigPayload(input) {
  const schoolDay = input?.schoolDay || {};
  const dashboard = input?.dashboard || {};
  const alerts = input?.alerts || {};

  return {
    schoolDay: {
      showReferenceDateFilter: normalizeBoolean(schoolDay.showReferenceDateFilter, DEFAULT_WORKSPACE_CONFIG.schoolDay.showReferenceDateFilter),
      showStudentFilter: normalizeBoolean(schoolDay.showStudentFilter, DEFAULT_WORKSPACE_CONFIG.schoolDay.showStudentFilter),
      showSubjectFilter: normalizeBoolean(schoolDay.showSubjectFilter, DEFAULT_WORKSPACE_CONFIG.schoolDay.showSubjectFilter),
      showCourseFilter: normalizeBoolean(schoolDay.showCourseFilter, DEFAULT_WORKSPACE_CONFIG.schoolDay.showCourseFilter),
      showStudentSummaries: normalizeBoolean(schoolDay.showStudentSummaries, DEFAULT_WORKSPACE_CONFIG.schoolDay.showStudentSummaries),
      showSideBySideOverview: normalizeBoolean(schoolDay.showSideBySideOverview, DEFAULT_WORKSPACE_CONFIG.schoolDay.showSideBySideOverview),
      showResetStudentDayButton: normalizeBoolean(schoolDay.showResetStudentDayButton, DEFAULT_WORKSPACE_CONFIG.schoolDay.showResetStudentDayButton),
      showResetFilteredDayButton: normalizeBoolean(schoolDay.showResetFilteredDayButton, DEFAULT_WORKSPACE_CONFIG.schoolDay.showResetFilteredDayButton),
      showNeedsAttendanceFilter: normalizeBoolean(schoolDay.showNeedsAttendanceFilter, DEFAULT_WORKSPACE_CONFIG.schoolDay.showNeedsAttendanceFilter),
      showNeedsGradeFilter: normalizeBoolean(schoolDay.showNeedsGradeFilter, DEFAULT_WORKSPACE_CONFIG.schoolDay.showNeedsGradeFilter),
      showNeedsCompletionFilter: normalizeBoolean(schoolDay.showNeedsCompletionFilter, DEFAULT_WORKSPACE_CONFIG.schoolDay.showNeedsCompletionFilter),
      showOverriddenFilter: normalizeBoolean(schoolDay.showOverriddenFilter, DEFAULT_WORKSPACE_CONFIG.schoolDay.showOverriddenFilter),
      defaultTab: normalizeEnum(
        schoolDay.defaultTab,
        ["daily-schedule", "attendance", "grades"],
        DEFAULT_WORKSPACE_CONFIG.schoolDay.defaultTab
      ),
      studentSummariesDefault: normalizeEnum(
        schoolDay.studentSummariesDefault,
        ["expanded", "collapsed", "adaptive"],
        DEFAULT_WORKSPACE_CONFIG.schoolDay.studentSummariesDefault
      ),
      overviewDefault: normalizeEnum(
        schoolDay.overviewDefault,
        ["expanded", "collapsed", "adaptive"],
        DEFAULT_WORKSPACE_CONFIG.schoolDay.overviewDefault
      )
    },
    dashboard: {
      showOverviewInstructionDays: normalizeBoolean(dashboard.showOverviewInstructionDays, DEFAULT_WORKSPACE_CONFIG.dashboard.showOverviewInstructionDays),
      showOverviewInstructionHours: normalizeBoolean(dashboard.showOverviewInstructionHours, DEFAULT_WORKSPACE_CONFIG.dashboard.showOverviewInstructionHours),
      showOverviewAttendance: normalizeBoolean(dashboard.showOverviewAttendance, DEFAULT_WORKSPACE_CONFIG.dashboard.showOverviewAttendance),
      showOverviewRunningGradeAverage: normalizeBoolean(dashboard.showOverviewRunningGradeAverage, DEFAULT_WORKSPACE_CONFIG.dashboard.showOverviewRunningGradeAverage),
      showOverviewSchoolYearProgress: normalizeBoolean(dashboard.showOverviewSchoolYearProgress, DEFAULT_WORKSPACE_CONFIG.dashboard.showOverviewSchoolYearProgress),
      showOverviewQuarterProgress: normalizeBoolean(dashboard.showOverviewQuarterProgress, DEFAULT_WORKSPACE_CONFIG.dashboard.showOverviewQuarterProgress),
      showOverviewCompletedToday: normalizeBoolean(dashboard.showOverviewCompletedToday, legacyBoolean(dashboard.showCompletionToday, DEFAULT_WORKSPACE_CONFIG.dashboard.showOverviewCompletedToday)),
      showOverviewOpenItemsToday: normalizeBoolean(dashboard.showOverviewOpenItemsToday, legacyBoolean(dashboard.showNeedsAttentionToday, DEFAULT_WORKSPACE_CONFIG.dashboard.showOverviewOpenItemsToday)),
      showOverviewGradesAtRisk: normalizeBoolean(dashboard.showOverviewGradesAtRisk, DEFAULT_WORKSPACE_CONFIG.dashboard.showOverviewGradesAtRisk),
      showOverviewMissingRequiredSubjects: normalizeBoolean(dashboard.showOverviewMissingRequiredSubjects, DEFAULT_WORKSPACE_CONFIG.dashboard.showOverviewMissingRequiredSubjects),
      showExecutionOpenItemsToday: normalizeBoolean(dashboard.showExecutionOpenItemsToday, legacyBoolean(dashboard.showNeedsAttentionToday, DEFAULT_WORKSPACE_CONFIG.dashboard.showExecutionOpenItemsToday)),
      showExecutionCompletedToday: normalizeBoolean(dashboard.showExecutionCompletedToday, legacyBoolean(dashboard.showCompletionToday, DEFAULT_WORKSPACE_CONFIG.dashboard.showExecutionCompletedToday)),
      showCourseWatchlist: normalizeBoolean(dashboard.showCourseWatchlist, legacyBoolean(dashboard.showGradeRiskWatchlist, DEFAULT_WORKSPACE_CONFIG.dashboard.showCourseWatchlist)),
      showStudentPerformance: normalizeBoolean(dashboard.showStudentPerformance, DEFAULT_WORKSPACE_CONFIG.dashboard.showStudentPerformance),
      showStudentGradeTrending: normalizeBoolean(dashboard.showStudentGradeTrending, legacyBoolean(dashboard.showGradeTrending, DEFAULT_WORKSPACE_CONFIG.dashboard.showStudentGradeTrending)),
      showInstructorGradeTrending: normalizeBoolean(dashboard.showInstructorGradeTrending, legacyBoolean(dashboard.showGradeTrending, DEFAULT_WORKSPACE_CONFIG.dashboard.showInstructorGradeTrending)),
      showGpaTrending: normalizeBoolean(dashboard.showGpaTrending, DEFAULT_WORKSPACE_CONFIG.dashboard.showGpaTrending),
      showGradeTypeVolume: normalizeBoolean(dashboard.showGradeTypeVolume, DEFAULT_WORKSPACE_CONFIG.dashboard.showGradeTypeVolume),
      showWorkDistribution: normalizeBoolean(dashboard.showWorkDistribution, DEFAULT_WORKSPACE_CONFIG.dashboard.showWorkDistribution),
      showRequiredInstructionalHours: normalizeBoolean(dashboard.showRequiredInstructionalHours, legacyBoolean(dashboard.showInstructionHourPace, DEFAULT_WORKSPACE_CONFIG.dashboard.showRequiredInstructionalHours)),
      showInstructionHoursPerMonth: normalizeBoolean(dashboard.showInstructionHoursPerMonth, legacyBoolean(dashboard.showComplianceHoursMonthly, DEFAULT_WORKSPACE_CONFIG.dashboard.showInstructionHoursPerMonth)),
      showRequiredInstructionalDays: normalizeBoolean(dashboard.showRequiredInstructionalDays, legacyBoolean(dashboard.showInstructionHourPace, DEFAULT_WORKSPACE_CONFIG.dashboard.showRequiredInstructionalDays)),
      showInstructionDaysPerMonth: normalizeBoolean(dashboard.showInstructionDaysPerMonth, legacyBoolean(dashboard.showComplianceDaysMonthly, DEFAULT_WORKSPACE_CONFIG.dashboard.showInstructionDaysPerMonth)),
      showStudentAttendance: normalizeBoolean(dashboard.showStudentAttendance, DEFAULT_WORKSPACE_CONFIG.dashboard.showStudentAttendance),
      showStudentInstructionalHours: normalizeBoolean(dashboard.showStudentInstructionalHours, DEFAULT_WORKSPACE_CONFIG.dashboard.showStudentInstructionalHours),
      showInstructionHoursTrending: normalizeBoolean(dashboard.showInstructionHoursTrending, legacyBoolean(dashboard.showInstructionalHoursTrending, DEFAULT_WORKSPACE_CONFIG.dashboard.showInstructionHoursTrending)),
      showInstructionDaysTrending: normalizeBoolean(dashboard.showInstructionDaysTrending, legacyBoolean(dashboard.showInstructionalHoursTrending, DEFAULT_WORKSPACE_CONFIG.dashboard.showInstructionDaysTrending)),
      showRequiredSubjectCompliance: normalizeBoolean(dashboard.showRequiredSubjectCompliance, DEFAULT_WORKSPACE_CONFIG.dashboard.showRequiredSubjectCompliance)
    },
    alerts: {
      showOpenAttendance: normalizeBoolean(alerts.showOpenAttendance, DEFAULT_WORKSPACE_CONFIG.alerts.showOpenAttendance),
      showOpenCompletion: normalizeBoolean(alerts.showOpenCompletion, DEFAULT_WORKSPACE_CONFIG.alerts.showOpenCompletion),
      showMissingGrades: normalizeBoolean(alerts.showMissingGrades, DEFAULT_WORKSPACE_CONFIG.alerts.showMissingGrades),
      showInstructionPace: normalizeBoolean(alerts.showInstructionPace, DEFAULT_WORKSPACE_CONFIG.alerts.showInstructionPace),
      showGradeRisk: normalizeBoolean(alerts.showGradeRisk, DEFAULT_WORKSPACE_CONFIG.alerts.showGradeRisk),
      showSingleGradeRisk: normalizeBoolean(alerts.showSingleGradeRisk, DEFAULT_WORKSPACE_CONFIG.alerts.showSingleGradeRisk),
      showAttendanceRisk: normalizeBoolean(alerts.showAttendanceRisk, DEFAULT_WORKSPACE_CONFIG.alerts.showAttendanceRisk),
      gradeRiskThresholdPercent: normalizePercent(alerts.gradeRiskThresholdPercent, DEFAULT_WORKSPACE_CONFIG.alerts.gradeRiskThresholdPercent),
      singleGradeRiskThresholdPercent: normalizePercent(alerts.singleGradeRiskThresholdPercent, DEFAULT_WORKSPACE_CONFIG.alerts.singleGradeRiskThresholdPercent),
      attendanceRiskThresholdPercent: normalizePercent(alerts.attendanceRiskThresholdPercent, DEFAULT_WORKSPACE_CONFIG.alerts.attendanceRiskThresholdPercent),
      riskAlertCadenceDays: normalizePositiveInteger(alerts.riskAlertCadenceDays, DEFAULT_WORKSPACE_CONFIG.alerts.riskAlertCadenceDays, 365)
    }
  };
}

function normalizeBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function legacyBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function normalizePercent(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(100, number));
}

function normalizePositiveInteger(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(1, Math.min(max, Math.round(number)));
}

module.exports = {
  DEFAULT_WORKSPACE_CONFIG,
  createWorkspaceConfigService,
  normalizeWorkspaceConfigPayload
};
