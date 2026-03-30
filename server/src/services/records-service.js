const { randomUUID } = require("crypto");

function createRecordsService(deps) {
  const { recordsRepository } = deps;

  return {
    createAttendance: async (payload) => recordsRepository.createAttendance(normalizeAttendancePayload(payload)),
    createTest: async (payload) => recordsRepository.createTest(normalizeTestPayload(payload)),
    deleteAttendance: (id) => recordsRepository.deleteAttendance(id),
    deleteTest: (id) => recordsRepository.deleteTest(id),
    listAttendanceForUser: (user) => recordsRepository.listAttendanceForUser(user),
    listTestsForUser: (user) => recordsRepository.listTestsForUser(user),
    updateAttendance: async (id, payload) => recordsRepository.updateAttendance(id, normalizeAttendancePayload({ ...payload, id })),
    updateTest: async (id, payload) => recordsRepository.updateTest(id, normalizeTestPayload({ ...payload, id }))
  };
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
