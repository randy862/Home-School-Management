const { randomUUID } = require("crypto");

function createRecordsService(deps) {
  const { recordsRepository } = deps;

  return {
    createActualInstructionMinutes: async (payload) => recordsRepository.createActualInstructionMinutes(normalizeActualInstructionPayload(payload)),
    createAttendance: async (payload) => recordsRepository.createAttendance(normalizeAttendancePayload(payload)),
    createTest: async (payload) => recordsRepository.createTest(normalizeTestPayload(payload)),
    deleteActualInstructionMinutes: (id) => recordsRepository.deleteActualInstructionMinutes(id),
    deleteAttendance: (id) => recordsRepository.deleteAttendance(id),
    deleteTest: (id) => recordsRepository.deleteTest(id),
    listActualInstructionMinutesForUser: (user) => recordsRepository.listActualInstructionMinutesForUser(user),
    listAttendanceForUser: (user) => recordsRepository.listAttendanceForUser(user),
    listTestsForUser: (user) => recordsRepository.listTestsForUser(user),
    updateActualInstructionMinutes: async (id, payload) => recordsRepository.updateActualInstructionMinutes(id, normalizeActualInstructionPayload({ ...payload, id })),
    updateAttendance: async (id, payload) => recordsRepository.updateAttendance(id, normalizeAttendancePayload({ ...payload, id })),
    updateTest: async (id, payload) => recordsRepository.updateTest(id, normalizeTestPayload({ ...payload, id }))
  };
}

function normalizeActualInstructionPayload(input) {
  const id = String(input?.id || "").trim() || randomUUID();
  const studentId = String(input?.studentId || "").trim();
  const courseId = String(input?.courseId || "").trim();
  const instructorId = String(input?.instructorId || "").trim();
  const date = String(input?.date || "").trim();
  const actualMinutes = Number(input?.actualMinutes);
  const startMinutes = input?.startMinutes == null || input?.startMinutes === ""
    ? null
    : Number(input.startMinutes);
  const orderIndex = input?.orderIndex == null || input?.orderIndex === ""
    ? null
    : Number(input.orderIndex);
  if (!studentId
    || !courseId
    || !/^\d{4}-\d{2}-\d{2}$/.test(date)
    || !Number.isInteger(actualMinutes)
    || actualMinutes <= 0
    || (startMinutes != null && (!Number.isInteger(startMinutes) || startMinutes < 0 || startMinutes >= 1440))
    || (orderIndex != null && (!Number.isInteger(orderIndex) || orderIndex <= 0))) {
    const error = new Error("Provide valid actual instructional minute values.");
    error.statusCode = 400;
    throw error;
  }
  return { id, studentId, courseId, instructorId, date, actualMinutes, startMinutes, orderIndex };
}

function normalizeAttendancePayload(input) {
  const id = String(input?.id || "").trim() || randomUUID();
  const studentId = String(input?.studentId || "").trim();
  const date = String(input?.date || "").trim();
  const present = Boolean(input?.present);
  if (!studentId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    const error = new Error("Provide valid attendance values.");
    error.statusCode = 400;
    throw error;
  }
  return { id, studentId, date, present };
}

function normalizeTestPayload(input) {
  const id = String(input?.id || "").trim() || randomUUID();
  const date = String(input?.date || "").trim();
  const studentId = String(input?.studentId || "").trim();
  const subjectId = String(input?.subjectId || "").trim();
  const courseId = String(input?.courseId || "").trim();
  const gradeType = String(input?.gradeType || "").trim();
  const testName = String(input?.testName || gradeType).trim();
  const score = Number(input?.score);
  const maxScore = input?.maxScore == null ? 100 : Number(input.maxScore);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
    || !studentId
    || !subjectId
    || !courseId
    || !gradeType
    || !testName
    || !Number.isFinite(score)
    || !Number.isFinite(maxScore)
    || maxScore <= 0) {
    const error = new Error("Provide valid grade values.");
    error.statusCode = 400;
    throw error;
  }
  return { id, date, studentId, subjectId, courseId, gradeType, testName, score, maxScore };
}

module.exports = {
  createRecordsService
};
