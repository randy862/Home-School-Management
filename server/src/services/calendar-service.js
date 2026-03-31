const { randomUUID } = require("crypto");

function createCalendarService(deps) {
  const { calendarRepository } = deps;

  return {
    createDailyBreak: async (payload) => calendarRepository.createDailyBreak(normalizeDailyBreakPayload(payload)),
    createHoliday: async (payload) => calendarRepository.createHoliday(normalizeHolidayPayload(payload)),
    createPlans: async (payload) => {
      const plansPayload = Array.isArray(payload?.plans) ? payload.plans : [payload];
      const plans = plansPayload.map(normalizePlanPayload);
      if (!plans.length) {
        const error = new Error("At least one plan is required.");
        error.statusCode = 400;
        throw error;
      }
      return calendarRepository.createPlans(plans);
    },
    createSchoolYear: async (payload) => calendarRepository.createSchoolYear(normalizeSchoolYearPayload(payload)),
    deleteDailyBreak: (id) => calendarRepository.deleteDailyBreak(id),
    deleteHoliday: (id) => calendarRepository.deleteHoliday(id),
    deletePlan: (id) => calendarRepository.deletePlan(id),
    deleteSchoolYear: (id) => calendarRepository.deleteSchoolYear(id),
    listDailyBreaksForUser: (user) => calendarRepository.listDailyBreaksForUser(user),
    listHolidays: () => calendarRepository.listHolidays(),
    listPlansForUser: (user) => calendarRepository.listPlansForUser(user),
    listQuarters: () => calendarRepository.listQuarters(),
    listSchoolYears: () => calendarRepository.listSchoolYears(),
    replaceQuartersForSchoolYear: async (schoolYearId, payload) => {
      const quarters = Array.isArray(payload?.quarters)
        ? payload.quarters.map((quarter) => normalizeQuarterPayload(quarter, schoolYearId))
        : [];
      return calendarRepository.replaceQuartersForSchoolYear(schoolYearId, quarters);
    },
    setCurrentSchoolYear: (id) => calendarRepository.setCurrentSchoolYear(id),
    updateDailyBreak: async (id, payload) => calendarRepository.updateDailyBreak(id, normalizeDailyBreakPayload({ ...payload, id })),
    updateHoliday: async (id, payload) => calendarRepository.updateHoliday(id, normalizeHolidayPayload({ ...payload, id })),
    updatePlan: async (id, payload) => calendarRepository.updatePlan(id, normalizePlanPayload({ ...payload, id })),
    updateSchoolYear: async (id, payload) => calendarRepository.updateSchoolYear(id, normalizeSchoolYearPayload({ ...payload, id }))
  };
}

function normalizeHolidayPayload(input) {
  const id = String(input?.id || "").trim() || randomUUID();
  const name = String(input?.name || "").trim();
  const type = String(input?.type || "").trim();
  const startDate = String(input?.startDate || "").trim();
  const endDate = String(input?.endDate || "").trim();
  if (!name || !type || !isIsoDate(startDate) || !isIsoDate(endDate) || startDate > endDate) {
    const error = new Error("Provide valid holiday/break values.");
    error.statusCode = 400;
    throw error;
  }
  return { id, name, type, startDate, endDate };
}

function normalizeSchoolYearPayload(input) {
  const id = String(input?.id || "").trim() || randomUUID();
  const label = String(input?.label || "").trim();
  const startDate = String(input?.startDate || "").trim();
  const endDate = String(input?.endDate || "").trim();
  const requiredInstructionalDays = input?.requiredInstructionalDays === "" || input?.requiredInstructionalDays == null
    ? null
    : Number(input.requiredInstructionalDays);
  const requiredInstructionalHours = input?.requiredInstructionalHours === "" || input?.requiredInstructionalHours == null
    ? null
    : Number(input.requiredInstructionalHours);
  const isCurrent = !!input?.isCurrent;
  if (!label
    || !isIsoDate(startDate)
    || !isIsoDate(endDate)
    || startDate > endDate
    || (requiredInstructionalDays != null && (!Number.isInteger(requiredInstructionalDays) || requiredInstructionalDays < 0))
    || (requiredInstructionalHours != null && (!Number.isFinite(requiredInstructionalHours) || requiredInstructionalHours < 0))) {
    const error = new Error("Provide valid school year values.");
    error.statusCode = 400;
    throw error;
  }
  return { id, label, startDate, endDate, requiredInstructionalDays, requiredInstructionalHours, isCurrent };
}

function normalizeQuarterPayload(input, schoolYearId) {
  const id = String(input?.id || "").trim() || randomUUID();
  const name = String(input?.name || "").trim();
  const startDate = String(input?.startDate || "").trim();
  const endDate = String(input?.endDate || "").trim();
  if (!name || !isIsoDate(startDate) || !isIsoDate(endDate) || startDate > endDate) {
    const error = new Error("Each quarter needs a valid date range.");
    error.statusCode = 400;
    throw error;
  }
  return { id, schoolYearId, name, startDate, endDate };
}

function normalizeDailyBreakPayload(input) {
  const id = String(input?.id || "").trim() || randomUUID();
  const schoolYearId = String(input?.schoolYearId || "").trim();
  const type = String(input?.type || "").trim();
  const description = String(input?.description || "").trim();
  const startTime = String(input?.startTime || "").trim();
  const durationMinutes = Number(input?.durationMinutes);
  const studentIds = Array.isArray(input?.studentIds)
    ? Array.from(new Set(input.studentIds.map((studentId) => String(studentId || "").trim()).filter(Boolean)))
    : [];
  const weekdays = Array.isArray(input?.weekdays)
    ? Array.from(new Set(input.weekdays.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 1 && day <= 5))).sort((a, b) => a - b)
    : [];

  if (!schoolYearId
    || !["lunch", "recess", "other"].includes(type)
    || !/^\d{2}:\d{2}$/.test(startTime)
    || !Number.isFinite(durationMinutes)
    || durationMinutes < 5
    || !studentIds.length
    || !weekdays.length
    || (type === "other" && !description)) {
    const error = new Error("Provide students, a valid start time, a duration of at least 5 minutes, and at least one weekday.");
    error.statusCode = 400;
    throw error;
  }

  return {
    id,
    schoolYearId,
    studentIds,
    type,
    description: type === "other" ? description : "",
    startTime,
    durationMinutes,
    weekdays
  };
}

function normalizePlanPayload(input) {
  const id = String(input?.id || "").trim() || randomUUID();
  const planType = String(input?.planType || "").trim();
  const studentId = String(input?.studentId || "").trim();
  const courseId = String(input?.courseId || "").trim();
  const startDate = String(input?.startDate || "").trim();
  const endDate = String(input?.endDate || "").trim();
  const weekdays = Array.isArray(input?.weekdays)
    ? Array.from(new Set(input.weekdays.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 1 && day <= 5))).sort((a, b) => a - b)
    : [];
  const quarterName = input?.quarterName == null ? null : String(input.quarterName).trim();

  if (!["annual", "quarterly", "weekly"].includes(planType)
    || !studentId
    || !courseId
    || !isIsoDate(startDate)
    || !isIsoDate(endDate)
    || startDate > endDate
    || !weekdays.length) {
    const error = new Error("Provide valid plan values.");
    error.statusCode = 400;
    throw error;
  }

  return {
    id,
    planType,
    studentId,
    courseId,
    startDate,
    endDate,
    weekdays,
    quarterName
  };
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

module.exports = {
  createCalendarService
};
