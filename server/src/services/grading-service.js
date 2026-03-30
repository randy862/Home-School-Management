const { randomUUID } = require("crypto");

function createGradingService(deps) {
  const { gradingRepository } = deps;

  return {
    getGradingCriteria: () => gradingRepository.getGradingCriteria(),
    listGradeTypes: () => gradingRepository.listGradeTypes(),
    replaceGradeTypes: async (payload) => gradingRepository.replaceGradeTypes(normalizeGradeTypesPayload(payload)),
    saveGradingCriteria: async (payload) => gradingRepository.saveGradingCriteria(normalizeGradingCriteriaPayload(payload))
  };
}

function normalizeGradeTypesPayload(payload) {
  const gradeTypes = Array.isArray(payload?.gradeTypes) ? payload.gradeTypes : [];
  return gradeTypes.map(normalizeGradeTypePayload);
}

function normalizeGradeTypePayload(input) {
  const id = String(input?.id || "").trim() || randomUUID();
  const name = String(input?.name || "").trim();
  const weightRaw = input?.weight;
  const weight = weightRaw === "" || weightRaw == null ? null : Number(weightRaw);
  if (!name || (weight != null && (!Number.isFinite(weight) || weight < 0 || weight > 100))) {
    const error = new Error("Provide valid grade type values.");
    error.statusCode = 400;
    throw error;
  }
  return { id, name, weight };
}

function normalizeGradingCriteriaPayload(input) {
  const letterScaleRaw = Array.isArray(input?.letterScale) ? input.letterScale : [];
  const letterScale = letterScaleRaw.map((entry) => {
    const label = String(entry?.label || "").trim().toUpperCase();
    const startRaw = entry?.start;
    const endRaw = entry?.end;
    const start = startRaw === "" || startRaw == null ? null : Number(startRaw);
    const end = endRaw === "" || endRaw == null ? null : Number(endRaw);
    if (!label
      || (start != null && (!Number.isInteger(start) || start < 0 || start > 100))
      || (end != null && (!Number.isInteger(end) || end < 0 || end > 100))) {
      const error = new Error("Provide valid grading criteria values.");
      error.statusCode = 400;
      throw error;
    }
    return { label, start, end };
  });
  const gpaScaleOption = String(input?.gpaScaleOption || "").trim() || "4";
  const gpaMax = Number(input?.gpaMax);
  if (!Number.isInteger(gpaMax) || gpaMax <= 0) {
    const error = new Error("GPA Max must be a whole number greater than 0.");
    error.statusCode = 400;
    throw error;
  }
  return { letterScale, gpaScaleOption, gpaMax };
}

module.exports = {
  createGradingService,
  normalizeGradeTypesPayload,
  normalizeGradingCriteriaPayload
};
