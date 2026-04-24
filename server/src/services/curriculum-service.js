const { randomUUID } = require("crypto");

function createCurriculumService(deps) {
  const { curriculumRepository } = deps;

  return {
    createCourse: async (payload) => curriculumRepository.createCourse(normalizeCoursePayload(payload)),
    createCourseSection: async (payload) => curriculumRepository.createCourseSection(normalizeCourseSectionPayload(payload)),
    createEnrollment: async (payload) => curriculumRepository.createEnrollment(normalizeEnrollmentPayload(payload)),
    createSectionEnrollment: async (payload) => curriculumRepository.createSectionEnrollment(normalizeSectionEnrollmentPayload(payload)),
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
    updateCourseSection: async (id, payload) => curriculumRepository.updateCourseSection(id, normalizeCourseSectionPayload({ ...payload, id })),
    updateEnrollment: async (id, payload) => curriculumRepository.updateEnrollment(id, normalizeEnrollmentPayload({ ...payload, id })),
    updateSectionEnrollment: async (id, payload) => curriculumRepository.updateSectionEnrollment(id, normalizeSectionEnrollmentPayload({ ...payload, id })),
    updateStudentScheduleBlock: async (id, payload) => curriculumRepository.updateStudentScheduleBlock(id, normalizeStudentScheduleBlockPayload({ ...payload, id })),
    updateSubject: async (id, payload) => curriculumRepository.updateSubject(id, normalizeSubjectPayload({ ...payload, id }))
  };
}

function normalizeSubjectPayload(input) {
  const id = String(input?.id || "").trim() || randomUUID();
  const name = String(input?.name || "").trim();
  if (!name) {
    const error = new Error("Subject name is required.");
    error.statusCode = 400;
    throw error;
  }
  return { ...(id ? { id } : {}), name };
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
  const materials = normalizeCourseMaterials(input?.materials || input?.material);
  if (!name || !subjectId || Number.isNaN(hoursPerDay) || hoursPerDay <= 0) {
    const error = new Error("Provide course name, subject, and hours/day.");
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
  const scheduleOrder = input?.scheduleOrder === "" || input?.scheduleOrder == null ? null : Number(input.scheduleOrder);
  if (!studentId || !courseId || (scheduleOrder != null && (!Number.isInteger(scheduleOrder) || scheduleOrder <= 0))) {
    const error = new Error("Provide valid enrollment values.");
    error.statusCode = 400;
    throw error;
  }
  return { ...(id ? { id } : {}), studentId, courseId, scheduleOrder };
}

function normalizeCourseSectionPayload(input) {
  const id = String(input?.id || "").trim() || randomUUID();
  const courseId = String(input?.courseId || "").trim();
  const label = String(input?.label || "").trim();
  const resourceGroup = String(input?.resourceGroup || "").trim();
  const concurrentCapacity = input?.concurrentCapacity === "" || input?.concurrentCapacity == null
    ? null
    : Number(input.concurrentCapacity);
  const startTime = normalizeClockTime(input?.startTime);
  const weekdays = Array.isArray(input?.weekdays)
    ? Array.from(new Set(input.weekdays.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 1 && day <= 5))).sort((a, b) => a - b)
    : [];
  const scheduleOrder = input?.scheduleOrder === "" || input?.scheduleOrder == null ? null : Number(input.scheduleOrder);
  if (!courseId || !label || !startTime || !weekdays.length
    || (concurrentCapacity != null && (!Number.isInteger(concurrentCapacity) || concurrentCapacity <= 0))
    || (scheduleOrder != null && (!Number.isInteger(scheduleOrder) || scheduleOrder <= 0))) {
    const error = new Error("Provide valid course section values.");
    error.statusCode = 400;
    throw error;
  }
  return { ...(id ? { id } : {}), courseId, label, resourceGroup, concurrentCapacity, startTime, weekdays, scheduleOrder };
}

function normalizeSectionEnrollmentPayload(input) {
  const id = String(input?.id || "").trim() || randomUUID();
  const studentId = String(input?.studentId || "").trim();
  const courseSectionId = String(input?.courseSectionId || "").trim();
  const scheduleOrder = input?.scheduleOrder === "" || input?.scheduleOrder == null ? null : Number(input.scheduleOrder);
  if (!studentId || !courseSectionId || (scheduleOrder != null && (!Number.isInteger(scheduleOrder) || scheduleOrder <= 0))) {
    const error = new Error("Provide valid section enrollment values.");
    error.statusCode = 400;
    throw error;
  }
  return { ...(id ? { id } : {}), studentId, courseSectionId, scheduleOrder };
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
  const scheduleOrder = input?.scheduleOrder === "" || input?.scheduleOrder == null ? null : Number(input.scheduleOrder);
  if (!studentId || !scheduleBlockId || (scheduleOrder != null && (!Number.isInteger(scheduleOrder) || scheduleOrder <= 0))) {
    const error = new Error("Provide valid scheduled block values.");
    error.statusCode = 400;
    throw error;
  }
  return { ...(id ? { id } : {}), studentId, scheduleBlockId, scheduleOrder };
}

module.exports = {
  createCurriculumService
};
