const { randomUUID } = require("crypto");

function createCurriculumService(deps) {
  const { curriculumRepository } = deps;

  return {
    createCourse: async (payload) => curriculumRepository.createCourse(normalizeCoursePayload(payload)),
    createEnrollment: async (payload) => curriculumRepository.createEnrollment(normalizeEnrollmentPayload(payload)),
    createStudentScheduleBlock: async (payload) => curriculumRepository.createStudentScheduleBlock(normalizeStudentScheduleBlockPayload(payload)),
    createSubject: async (payload) => curriculumRepository.createSubject(normalizeSubjectPayload(payload)),
    deleteCourse: (id) => curriculumRepository.deleteCourse(id),
    deleteEnrollment: (id) => curriculumRepository.deleteEnrollment(id),
    deleteStudentScheduleBlock: (id) => curriculumRepository.deleteStudentScheduleBlock(id),
    deleteSubject: (id) => curriculumRepository.deleteSubject(id),
    listCoursesForUser: (user) => curriculumRepository.listCoursesForUser(user),
    listEnrollmentsForUser: (user) => curriculumRepository.listEnrollmentsForUser(user),
    listStudentScheduleBlocksForUser: (user) => curriculumRepository.listStudentScheduleBlocksForUser(user),
    listSubjectsForUser: (user) => curriculumRepository.listSubjectsForUser(user),
    updateCourse: async (id, payload) => curriculumRepository.updateCourse(id, normalizeCoursePayload({ ...payload, id })),
    updateEnrollment: async (id, payload) => curriculumRepository.updateEnrollment(id, normalizeEnrollmentPayload({ ...payload, id })),
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
  const exclusiveResource = !!input?.exclusiveResource;
  const materials = normalizeCourseMaterials(input?.materials || input?.material);
  if (!name || !subjectId || Number.isNaN(hoursPerDay) || hoursPerDay <= 0) {
    const error = new Error("Provide course name, subject, and hours/day.");
    error.statusCode = 400;
    throw error;
  }
  if (materials.some((material) => material.type === "other" && !material.other)) {
    const error = new Error("Provide material details when Material Type is Other.");
    error.statusCode = 400;
    throw error;
  }
  return { ...(id ? { id } : {}), name, subjectId, instructorId, hoursPerDay, exclusiveResource, materials };
}

function hasCourseMaterialDetails(material) {
  return !!(material.type || material.other || material.title || material.publisher);
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
