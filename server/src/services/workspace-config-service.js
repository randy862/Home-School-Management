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
    showCompletionToday: true,
    showNeedsAttentionToday: true,
    showMissingGrades: true,
    showGradeRiskWatchlist: true,
    showInstructionHourPace: true,
    showStudentPerformance: true,
    showStudentAttendance: true,
    showStudentInstructionalHours: true,
    showGradeTrending: false,
    showGpaTrending: false,
    showInstructionalHoursTrending: false,
    showGradeTypeVolume: false,
    showWorkDistribution: false
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
      showCompletionToday: normalizeBoolean(dashboard.showCompletionToday, DEFAULT_WORKSPACE_CONFIG.dashboard.showCompletionToday),
      showNeedsAttentionToday: normalizeBoolean(dashboard.showNeedsAttentionToday, DEFAULT_WORKSPACE_CONFIG.dashboard.showNeedsAttentionToday),
      showMissingGrades: normalizeBoolean(dashboard.showMissingGrades, DEFAULT_WORKSPACE_CONFIG.dashboard.showMissingGrades),
      showGradeRiskWatchlist: normalizeBoolean(dashboard.showGradeRiskWatchlist, DEFAULT_WORKSPACE_CONFIG.dashboard.showGradeRiskWatchlist),
      showInstructionHourPace: normalizeBoolean(dashboard.showInstructionHourPace, DEFAULT_WORKSPACE_CONFIG.dashboard.showInstructionHourPace),
      showStudentPerformance: normalizeBoolean(dashboard.showStudentPerformance, DEFAULT_WORKSPACE_CONFIG.dashboard.showStudentPerformance),
      showStudentAttendance: normalizeBoolean(dashboard.showStudentAttendance, DEFAULT_WORKSPACE_CONFIG.dashboard.showStudentAttendance),
      showStudentInstructionalHours: normalizeBoolean(dashboard.showStudentInstructionalHours, DEFAULT_WORKSPACE_CONFIG.dashboard.showStudentInstructionalHours),
      showGradeTrending: normalizeBoolean(dashboard.showGradeTrending, DEFAULT_WORKSPACE_CONFIG.dashboard.showGradeTrending),
      showGpaTrending: normalizeBoolean(dashboard.showGpaTrending, DEFAULT_WORKSPACE_CONFIG.dashboard.showGpaTrending),
      showInstructionalHoursTrending: normalizeBoolean(dashboard.showInstructionalHoursTrending, DEFAULT_WORKSPACE_CONFIG.dashboard.showInstructionalHoursTrending),
      showGradeTypeVolume: normalizeBoolean(dashboard.showGradeTypeVolume, DEFAULT_WORKSPACE_CONFIG.dashboard.showGradeTypeVolume),
      showWorkDistribution: normalizeBoolean(dashboard.showWorkDistribution, DEFAULT_WORKSPACE_CONFIG.dashboard.showWorkDistribution)
    }
  };
}

function normalizeBoolean(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function normalizeEnum(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

module.exports = {
  DEFAULT_WORKSPACE_CONFIG,
  createWorkspaceConfigService,
  normalizeWorkspaceConfigPayload
};
