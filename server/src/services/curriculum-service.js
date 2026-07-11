const { randomUUID } = require("crypto");

const GRADE_LEVEL_ALL = "all";
const GRADE_LEVEL_OPTIONS = ["K", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];
const GRADE_LEVEL_ORDER = new Map(GRADE_LEVEL_OPTIONS.map((grade, index) => [grade, index]));

function createCurriculumService(deps) {
  const { curriculumRepository } = deps;

  return {
    createCourse: async (payload) => curriculumRepository.createCourse(normalizeCoursePayload(payload)),
    createCourseSection: async (payload) => curriculumRepository.createCourseSection(normalizeCourseSectionPayload(payload)),
    createEnrollment: async (payload) => curriculumRepository.createEnrollment(normalizeEnrollmentPayload(payload)),
    createSectionEnrollment: async (payload) => {
      const normalized = normalizeSectionEnrollmentPayload(payload);
      await assertSectionEnrollmentHasNoClassConflict(curriculumRepository, normalized);
      return curriculumRepository.createSectionEnrollment(normalized);
    },
    createStudentScheduleBlock: async (payload) => curriculumRepository.createStudentScheduleBlock(normalizeStudentScheduleBlockPayload(payload)),
    createSubject: async (payload) => curriculumRepository.createSubject(normalizeSubjectPayload(payload)),
    deleteCourse: (id) => curriculumRepository.deleteCourse(id),
    deleteCourseSection: (id) => curriculumRepository.deleteCourseSection(id),
    deleteEnrollment: (id) => curriculumRepository.deleteEnrollment(id),
    deleteSectionEnrollment: (id) => curriculumRepository.deleteSectionEnrollment(id),
    deleteStudentScheduleBlock: (id) => curriculumRepository.deleteStudentScheduleBlock(id),
    deleteSubject: (id) => curriculumRepository.deleteSubject(id),
    listCoursesForUser: (user) => curriculumRepository.listCoursesForUser(user),
    listCourseSectionsForUser: (user) => curriculumRepository.listCourseSectionsForUser(user),
    listEnrollmentsForUser: (user) => curriculumRepository.listEnrollmentsForUser(user),
    listSectionEnrollmentsForUser: (user) => curriculumRepository.listSectionEnrollmentsForUser(user),
    listStudentScheduleBlocksForUser: (user) => curriculumRepository.listStudentScheduleBlocksForUser(user),
    listSubjectsForUser: (user) => curriculumRepository.listSubjectsForUser(user),
    updateCourse: async (id, payload) => curriculumRepository.updateCourse(id, normalizeCoursePayload({ ...payload, id })),
    updateCourseSection: async (id, payload) => {
      const normalized = normalizeCourseSectionPayload({ ...payload, id });
      await assertCourseSectionUpdateHasNoClassConflict(curriculumRepository, normalized);
      return curriculumRepository.updateCourseSection(id, normalized);
    },
    updateEnrollment: async (id, payload) => curriculumRepository.updateEnrollment(id, normalizeEnrollmentPayload({ ...payload, id })),
    updateSectionEnrollment: async (id, payload) => {
      const normalized = normalizeSectionEnrollmentPayload({ ...payload, id });
      await assertSectionEnrollmentHasNoClassConflict(curriculumRepository, normalized, id);
      return curriculumRepository.updateSectionEnrollment(id, normalized);
    },
    updateStudentScheduleBlock: async (id, payload) => curriculumRepository.updateStudentScheduleBlock(id, normalizeStudentScheduleBlockPayload({ ...payload, id })),
    updateSubject: async (id, payload) => curriculumRepository.updateSubject(id, normalizeSubjectPayload({ ...payload, id }))
  };
}

async function assertSectionEnrollmentHasNoClassConflict(curriculumRepository, sectionEnrollment, excludedSectionEnrollmentId = "") {
  const targetSection = await curriculumRepository.getCourseSectionSchedule(sectionEnrollment.courseSectionId);
  if (!targetSection) {
    const error = new Error("Class not found.");
    error.statusCode = 400;
    throw error;
  }
  const existingSections = await curriculumRepository.listSectionEnrollmentSchedulesForStudent(
    sectionEnrollment.studentId,
    excludedSectionEnrollmentId,
    sectionEnrollment.schoolYearId
  );
  const conflict = existingSections.find((section) => courseSectionsHaveClassTimeConflict(targetSection, section));
  if (conflict) throw buildClassTimeConflictError(conflict);
}

async function assertCourseSectionUpdateHasNoClassConflict(curriculumRepository, section) {
  const courseContext = await curriculumRepository.getCourseScheduleContext(section.courseId);
  if (!courseContext) {
    const error = new Error("Course not found.");
    error.statusCode = 400;
    throw error;
  }
  const targetSection = {
    ...section,
    courseName: courseContext.name,
    hoursPerDay: courseContext.hoursPerDay,
    courseQuarterNames: courseContext.quarterNames
  };
  const currentEnrollments = await curriculumRepository.listSectionEnrollmentSchedulesForCourseSection(section.id);
  for (const enrollment of currentEnrollments) {
    const existingSections = await curriculumRepository.listSectionEnrollmentSchedulesForStudent(
      enrollment.studentId,
      enrollment.sectionEnrollmentId,
      enrollment.schoolYearId
    );
    const conflict = existingSections.find((existingSection) => courseSectionsHaveClassTimeConflict(targetSection, existingSection));
    if (conflict) throw buildClassTimeConflictError(conflict);
  }
}

function buildClassTimeConflictError(conflictSection) {
  const error = new Error(`Class time conflict with ${formatConflictSection(conflictSection)}.`);
  error.statusCode = 409;
  return error;
}

function normalizeScheduleWeekdays(input, fallback = [1, 2, 3, 4, 5]) {
  const weekdays = Array.isArray(input)
    ? Array.from(new Set(input.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 1 && day <= 5))).sort((a, b) => a - b)
    : [];
  return weekdays.length ? weekdays : [...fallback];
}

function effectiveScheduleQuarterNames(section) {
  const sectionNames = Array.isArray(section?.quarterNames) ? section.quarterNames.filter(Boolean) : [];
  if (sectionNames.length) return sectionNames;
  return Array.isArray(section?.courseQuarterNames) ? section.courseQuarterNames.filter(Boolean) : [];
}

function quarterNamesOverlap(firstSection, secondSection) {
  const first = new Set(effectiveScheduleQuarterNames(firstSection));
  const second = new Set(effectiveScheduleQuarterNames(secondSection));
  if (!first.size || !second.size) return true;
  return [...first].some((name) => second.has(name));
}

function parseScheduleMinutes(value) {
  const match = String(value || "").trim().match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function courseSectionScheduleWindow(section) {
  const start = parseScheduleMinutes(section?.startTime || "08:00");
  const hoursPerDay = Number(section?.hoursPerDay || 1);
  if (!Number.isFinite(start)) return null;
  const durationMinutes = Math.max(15, Math.round((Number.isFinite(hoursPerDay) && hoursPerDay > 0 ? hoursPerDay : 1) * 60));
  return { start, end: Math.min(24 * 60, start + durationMinutes) };
}

function courseSectionsHaveClassTimeConflict(firstSection, secondSection) {
  if (!firstSection || !secondSection || firstSection.id === secondSection.id) return false;
  if (firstSection.courseId && firstSection.courseId === secondSection.courseId) return false;
  const firstWeekdays = normalizeScheduleWeekdays(firstSection.weekdays);
  const secondWeekdays = normalizeScheduleWeekdays(secondSection.weekdays);
  if (!firstWeekdays.some((day) => secondWeekdays.includes(day))) return false;
  if (!quarterNamesOverlap(firstSection, secondSection)) return false;
  const firstWindow = courseSectionScheduleWindow(firstSection);
  const secondWindow = courseSectionScheduleWindow(secondSection);
  if (!firstWindow || !secondWindow) return false;
  return firstWindow.start < secondWindow.end && firstWindow.end > secondWindow.start;
}

function formatConflictSection(section) {
  const courseName = String(section?.courseName || "Class").trim();
  const label = String(section?.label || "").trim();
  const startTime = String(section?.startTime || "08:00").trim();
  return `${courseName}${label ? ` - ${label}` : ""} at ${startTime}`;
}

function normalizeSubjectPayload(input) {
  const id = String(input?.id || "").trim() || randomUUID();
  const name = String(input?.name || "").trim();
  const required = !!input?.required;
  if (!name) {
    const error = new Error("Subject name is required.");
    error.statusCode = 400;
    throw error;
  }
  return { ...(id ? { id } : {}), name, required };
}

function normalizeCoursePayload(input) {
  const id = String(input?.id || "").trim() || randomUUID();
  const name = String(input?.name || "").trim();
  const subjectId = String(input?.subjectId || "").trim();
  const instructorId = String(input?.instructorId || "").trim();
  const hoursPerDay = Number(input?.hoursPerDay);
  const resourceGroup = String(input?.resourceGroup || "").trim();
  const resourceCapacity = normalizeCourseResourceCapacity(input?.resourceCapacity, !!input?.exclusiveResource);
  const exclusiveResource = resourceCapacity === 1 || (!!input?.exclusiveResource && resourceCapacity == null);
  const quarterNames = normalizeQuarterNames(input?.quarterNames);
  const weekdays = normalizeWeekdays(input?.weekdays, [1, 2, 3, 4, 5]);
  const gradeLevels = normalizeGradeLevels(input?.gradeLevels);
  const materials = normalizeCourseMaterials(input?.materials || input?.material);
  if (!name || !subjectId || Number.isNaN(hoursPerDay) || hoursPerDay <= 0) {
    const error = new Error("Provide course name, subject, and daily instructional time.");
    error.statusCode = 400;
    throw error;
  }
  if (!weekdays.length) {
    const error = new Error("Select at least one weekday for the course.");
    error.statusCode = 400;
    throw error;
  }
  if (resourceCapacity != null && (!Number.isInteger(resourceCapacity) || resourceCapacity <= 0)) {
    const error = new Error("Concurrent capacity must be a whole number greater than 0.");
    error.statusCode = 400;
    throw error;
  }
  if (materials.some((material) => material.type === "other" && !material.other)) {
    const error = new Error("Provide material details when Material Type is Other.");
    error.statusCode = 400;
    throw error;
  }
  return {
    ...(id ? { id } : {}),
    name,
    subjectId,
    instructorId,
    hoursPerDay,
    exclusiveResource,
    resourceGroup,
    resourceCapacity,
    gradeLevels,
    quarterNames,
    weekdays,
    materials
  };
}

function normalizeCourseResourceCapacity(value, legacyExclusive = false) {
  if (value === "" || value == null) return legacyExclusive ? 1 : null;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : (legacyExclusive ? 1 : null);
}

function hasCourseMaterialDetails(material) {
  return !!(material.type || material.other || material.isbn || material.title || material.publisher);
}

function normalizeCourseMaterials(materialsInput) {
  const rawMaterials = Array.isArray(materialsInput)
    ? materialsInput
    : (materialsInput ? [materialsInput] : []);
  return rawMaterials
    .map(normalizeCourseMaterial)
    .filter(hasCourseMaterialDetails);
}

function normalizeCourseMaterial(material) {
  const allowedTypes = new Set(["text_book", "workbook", "worksheets", "online_content", "other"]);
  const rawType = String(material?.type || "").trim().toLowerCase();
  const type = allowedTypes.has(rawType) ? rawType : "";
  return {
    type,
    other: type === "other" ? String(material?.other || "").trim() : "",
    isbn: String(material?.isbn || "").trim(),
    title: String(material?.title || "").trim(),
    publisher: String(material?.publisher || "").trim()
  };
}

function normalizeEnrollmentPayload(input) {
  const id = String(input?.id || "").trim() || randomUUID();
  const studentId = String(input?.studentId || "").trim();
  const courseId = String(input?.courseId || "").trim();
  const schoolYearId = String(input?.schoolYearId || input?.school_year_id || "").trim();
  const studentGrade = normalizeStudentGrade(input?.studentGrade || input?.student_grade);
  const scheduleOrder = input?.scheduleOrder === "" || input?.scheduleOrder == null ? null : Number(input.scheduleOrder);
  if (!studentId || !courseId || !schoolYearId || (scheduleOrder != null && (!Number.isInteger(scheduleOrder) || scheduleOrder <= 0))) {
    const error = new Error("Provide valid enrollment values.");
    error.statusCode = 400;
    throw error;
  }
  return { ...(id ? { id } : {}), studentId, courseId, schoolYearId, studentGrade, scheduleOrder };
}

function normalizeCourseSectionPayload(input) {
  const id = String(input?.id || "").trim() || randomUUID();
  const courseId = String(input?.courseId || "").trim();
  const label = String(input?.label || "").trim();
  const instructorId = String(input?.instructorId || "").trim();
  const resourceGroup = String(input?.resourceGroup || "").trim();
  const concurrentCapacity = input?.concurrentCapacity === "" || input?.concurrentCapacity == null
    ? null
    : Number(input.concurrentCapacity);
  const startTime = normalizeClockTime(input?.startTime);
  const weekdays = Array.isArray(input?.weekdays)
    ? Array.from(new Set(input.weekdays.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 1 && day <= 5))).sort((a, b) => a - b)
    : [];
  const gradeLevels = normalizeGradeLevels(input?.gradeLevels);
  const quarterNames = normalizeQuarterNames(input?.quarterNames);
  const scheduleOrder = input?.scheduleOrder === "" || input?.scheduleOrder == null ? null : Number(input.scheduleOrder);
  if (!courseId || !label || !startTime || !weekdays.length
    || (concurrentCapacity != null && (!Number.isInteger(concurrentCapacity) || concurrentCapacity <= 0))
    || (scheduleOrder != null && (!Number.isInteger(scheduleOrder) || scheduleOrder <= 0))) {
    const error = new Error("Provide valid course section values.");
    error.statusCode = 400;
    throw error;
  }
  return { ...(id ? { id } : {}), courseId, label, instructorId, resourceGroup, concurrentCapacity, startTime, gradeLevels, quarterNames, weekdays, scheduleOrder };
}

function normalizeGradeLevel(value, { allowAll = false } = {}) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const normalized = raw.toLowerCase().replace(/^grade\s+/, "").trim();
  if (allowAll && normalized === GRADE_LEVEL_ALL) return GRADE_LEVEL_ALL;
  if (["k", "kindergarten"].includes(normalized)) return "K";
  const numeric = Number(normalized);
  if (Number.isInteger(numeric) && numeric >= 1 && numeric <= 12) return String(numeric);
  return "";
}

function normalizeStudentGrade(value) {
  return normalizeGradeLevel(value);
}

function normalizeGradeLevels(input, fallback = [GRADE_LEVEL_ALL]) {
  const rawItems = Array.isArray(input)
    ? input
    : String(input ?? "")
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  const normalized = rawItems
    .map((item) => normalizeGradeLevel(item, { allowAll: true }))
    .filter(Boolean);
  if (!normalized.length) return [...fallback];
  if (normalized.includes(GRADE_LEVEL_ALL)) return [GRADE_LEVEL_ALL];
  const seen = new Set();
  return normalized
    .filter((grade) => {
      if (seen.has(grade)) return false;
      seen.add(grade);
      return true;
    })
    .sort((a, b) => (GRADE_LEVEL_ORDER.get(a) ?? 999) - (GRADE_LEVEL_ORDER.get(b) ?? 999));
}

function normalizeWeekdays(input, fallback = []) {
  const weekdays = Array.isArray(input)
    ? Array.from(new Set(input.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 1 && day <= 5))).sort((a, b) => a - b)
    : [];
  return weekdays.length ? weekdays : [...fallback];
}

function normalizeQuarterNames(input) {
  if (!Array.isArray(input)) return [];
  const seen = new Set();
  return input
    .map((name) => String(name || "").trim())
    .filter((name) => {
      if (!name || seen.has(name)) return false;
      seen.add(name);
      return true;
    });
}

function normalizeSectionEnrollmentPayload(input) {
  const id = String(input?.id || "").trim() || randomUUID();
  const studentId = String(input?.studentId || "").trim();
  const courseSectionId = String(input?.courseSectionId || "").trim();
  const schoolYearId = String(input?.schoolYearId || input?.school_year_id || "").trim();
  const studentGrade = normalizeStudentGrade(input?.studentGrade || input?.student_grade);
  const scheduleOrder = input?.scheduleOrder === "" || input?.scheduleOrder == null ? null : Number(input.scheduleOrder);
  if (!studentId || !courseSectionId || !schoolYearId || (scheduleOrder != null && (!Number.isInteger(scheduleOrder) || scheduleOrder <= 0))) {
    const error = new Error("Provide valid section enrollment values.");
    error.statusCode = 400;
    throw error;
  }
  return { ...(id ? { id } : {}), studentId, courseSectionId, schoolYearId, studentGrade, scheduleOrder };
}

function normalizeClockTime(value) {
  const match = String(value || "").trim().match(/^(\d{2}):(\d{2})$/);
  if (!match) return "";
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return "";
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function normalizeStudentScheduleBlockPayload(input) {
  const id = String(input?.id || "").trim() || randomUUID();
  const studentId = String(input?.studentId || "").trim();
  const scheduleBlockId = String(input?.scheduleBlockId || "").trim();
  const schoolYearId = String(input?.schoolYearId || input?.school_year_id || "").trim();
  const studentGrade = normalizeStudentGrade(input?.studentGrade || input?.student_grade);
  const scheduleOrder = input?.scheduleOrder === "" || input?.scheduleOrder == null ? null : Number(input.scheduleOrder);
  if (!studentId || !scheduleBlockId || !schoolYearId || (scheduleOrder != null && (!Number.isInteger(scheduleOrder) || scheduleOrder <= 0))) {
    const error = new Error("Provide valid scheduled block values.");
    error.statusCode = 400;
    throw error;
  }
  return { ...(id ? { id } : {}), studentId, scheduleBlockId, schoolYearId, studentGrade, scheduleOrder };
}

module.exports = {
  createCurriculumService
};
