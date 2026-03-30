const { randomUUID } = require("crypto");

function createCurriculumService(deps) {
  const {
    createCourse,
    createEnrollment,
    createSubject,
    deleteCourse,
    deleteEnrollment,
    deleteSubject,
    listCoursesForUser,
    listEnrollmentsForUser,
    listSubjectsForUser,
    updateCourse,
    updateEnrollment,
    updateSubject
  } = deps;

  return {
    createCourse: async (payload) => createCourse(normalizeCoursePayload(payload)),
    createEnrollment: async (payload) => createEnrollment(normalizeEnrollmentPayload(payload)),
    createSubject: async (payload) => createSubject(normalizeSubjectPayload(payload)),
    deleteCourse,
    deleteEnrollment,
    deleteSubject,
    listCoursesForUser,
    listEnrollmentsForUser,
    listSubjectsForUser,
    updateCourse: async (id, payload) => updateCourse(id, normalizeCoursePayload({ ...payload, id })),
    updateEnrollment: async (id, payload) => updateEnrollment(id, normalizeEnrollmentPayload({ ...payload, id })),
    updateSubject: async (id, payload) => updateSubject(id, normalizeSubjectPayload({ ...payload, id }))
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
  const hoursPerDay = Number(input?.hoursPerDay);
  const exclusiveResource = !!input?.exclusiveResource;
  if (!name || !subjectId || Number.isNaN(hoursPerDay) || hoursPerDay <= 0) {
    const error = new Error("Provide course name, subject, and hours/day.");
    error.statusCode = 400;
    throw error;
  }
  return { ...(id ? { id } : {}), name, subjectId, hoursPerDay, exclusiveResource };
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

module.exports = {
  createCurriculumService
};
