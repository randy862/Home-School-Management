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
  if (!name || !subjectId || Number.isNaN(hoursPerDay) || hoursPerDay <= 0) {
    const error = new Error("Provide course name, subject, and hours/day.");
    error.statusCode = 400;
    throw error;
  }
  return { ...(id ? { id } : {}), name, subjectId, instructorId, hoursPerDay, exclusiveResource };
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
