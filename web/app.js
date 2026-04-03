const STORAGE_KEY = "hsm_state_v2";
const IS_LOCAL_DEV_HOST = ["localhost", "127.0.0.1"].includes(window.location.hostname) && (window.location.port === "5500" || window.location.port === "");
const API_BASE_URL = window.HSM_API_BASE_URL || (IS_LOCAL_DEV_HOST ? "http://localhost:3000" : window.location.origin);
const LEGACY_STATE_BRIDGE_ENDPOINT = `${API_BASE_URL}/api/state`;
const API_AUTH_LOGIN_ENDPOINT = `${API_BASE_URL}/api/auth/login`;
const API_AUTH_LOGOUT_ENDPOINT = `${API_BASE_URL}/api/auth/logout`;
const API_ME_ENDPOINT = `${API_BASE_URL}/api/me`;
const API_SETUP_STATUS_ENDPOINT = `${API_BASE_URL}/api/setup/status`;
const API_SETUP_INITIALIZE_ENDPOINT = `${API_BASE_URL}/api/setup/initialize`;
const API_USERS_ENDPOINT = `${API_BASE_URL}/api/users`;
const API_STUDENTS_ENDPOINT = `${API_BASE_URL}/api/students`;
const API_INSTRUCTORS_ENDPOINT = `${API_BASE_URL}/api/instructors`;
const API_SUBJECTS_ENDPOINT = `${API_BASE_URL}/api/subjects`;
const API_COURSES_ENDPOINT = `${API_BASE_URL}/api/courses`;
const API_ENROLLMENTS_ENDPOINT = `${API_BASE_URL}/api/enrollments`;
const API_SCHOOL_YEARS_ENDPOINT = `${API_BASE_URL}/api/school-years`;
const API_QUARTERS_ENDPOINT = `${API_BASE_URL}/api/quarters`;
const API_ATTENDANCE_ENDPOINT = `${API_BASE_URL}/api/attendance`;
const API_INSTRUCTION_ACTUALS_ENDPOINT = `${API_BASE_URL}/api/instruction-actuals`;
const API_DAILY_BREAKS_ENDPOINT = `${API_BASE_URL}/api/daily-breaks`;
const API_HOLIDAYS_ENDPOINT = `${API_BASE_URL}/api/holidays`;
const API_PLANS_ENDPOINT = `${API_BASE_URL}/api/plans`;
const API_GRADE_TYPES_ENDPOINT = `${API_BASE_URL}/api/grade-types`;
const API_GRADING_CRITERIA_ENDPOINT = `${API_BASE_URL}/api/grading-criteria`;
const API_TESTS_ENDPOINT = `${API_BASE_URL}/api/tests`;
const SESSION_KEY = "hsm_session_v1";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_GRADE_TYPES = ["Assignment", "Quiz", "Test", "Quarterly Final", "Final"];
const EXCLUDED_GRADE_TYPE_FILTER_OPTIONS = new Set(["homework"]);
const STUDENT_PERFORMANCE_GRADE_METHODS = ["Percentage", "Letter", "GPA"];
const LETTER_GRADE_ORDER = ["A", "B", "C", "D", "F"];
const DEFAULT_LETTER_GRADE_SCALE = [
  { label: "A", start: 90, end: 100 },
  { label: "B", start: 80, end: 89 },
  { label: "C", start: 70, end: 79 },
  { label: "D", start: 60, end: 69 },
  { label: "F", start: 0, end: 59 }
];
const LEGACY_BOOTSTRAP_ADMIN_USERNAME = "admin";
const LEGACY_BOOTSTRAP_ADMIN_PASSWORD = "ChangeMe123!";
const STUDENT_ALLOWED_TABS = new Set(["dashboard", "calendar", "attendance", "grades"]);
const HOSTED_MODE_STORAGE_KEY = "hsm_hosted_mode_v1";
const INSTRUCTOR_CATEGORY_OPTIONS = ["parent", "volunteer", "compensated", "other"];
const INSTRUCTOR_CATEGORY_LABELS = {
  parent: "Parent",
  volunteer: "Volunteer",
  compensated: "Compensated",
  other: "Other"
};

function isLegacyBridgeMode() {
  return !hostedModeEnabled;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function randomToken() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function sha256Hex(input) {
  const source = String(input ?? "");
  if (window.crypto?.subtle && typeof TextEncoder !== "undefined") {
    return window.crypto.subtle.digest("SHA-256", new TextEncoder().encode(source))
      .then((buffer) => Array.from(new Uint8Array(buffer)).map((item) => item.toString(16).padStart(2, "0")).join(""));
  }
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(i);
    hash |= 0;
  }
  return Promise.resolve(`fallback-${Math.abs(hash)}`);
}

async function buildPasswordCredentials(password, salt = randomToken()) {
  return {
    passwordSalt: salt,
    passwordHash: await sha256Hex(`${salt}::${password}`)
  };
}

function createLegacyPasswordHash(password) {
  let hash = 0;
  const source = String(password || "");
  for (let i = 0; i < source.length; i += 1) {
    hash = ((hash << 5) - hash) + source.charCodeAt(i);
    hash |= 0;
  }
  return `legacy-${Math.abs(hash)}`;
}

async function verifyPasswordForUser(user, password) {
  if (!user) return false;
  const legacyMatch = user.passwordHash === createLegacyPasswordHash(password);
  if (legacyMatch) return true;
  if (!user.passwordSalt) {
    return false;
  }
  return user.passwordHash === await sha256Hex(`${user.passwordSalt}::${password}`);
}

async function createUserRecord({ username, role, password, studentId = "", mustChangePassword = false, id = uid(), createdAt = todayISO() }) {
  const credentials = await buildPasswordCredentials(password);
  return {
    id,
    username: String(username || "").trim(),
    role: role === "student" ? "student" : "admin",
    studentId: studentId || "",
    mustChangePassword: !!mustChangePassword,
    createdAt,
    updatedAt: todayISO(),
    ...credentials
  };
}

function createLegacyBootstrapAdmin() {
  return {
    id: "default-admin-user",
    username: LEGACY_BOOTSTRAP_ADMIN_USERNAME,
    role: "admin",
    studentId: "",
    mustChangePassword: true,
    createdAt: todayISO(),
    updatedAt: todayISO(),
    passwordSalt: "",
    passwordHash: createLegacyPasswordHash(LEGACY_BOOTSTRAP_ADMIN_PASSWORD)
  };
}

function normalizeUsersShape(inputState) {
  const s = inputState;
  const studentIds = new Set((s.students || []).map((student) => student.id));
  let repairedDefaultAdmin = false;
  if (!Array.isArray(s.users) || !s.users.length) {
    s.users = [createLegacyBootstrapAdmin()];
  } else {
    const seen = new Set();
    s.users = s.users
      .filter((user) => user && String(user.username || "").trim())
      .map((user) => {
        const normalized = {
          id: user.id || uid(),
          username: String(user.username).trim(),
          role: user.role === "student" ? "student" : "admin",
          studentId: user.role === "student" && studentIds.has(user.studentId) ? user.studentId : "",
          mustChangePassword: !!user.mustChangePassword,
          createdAt: user.createdAt || todayISO(),
          updatedAt: user.updatedAt || user.createdAt || todayISO(),
          passwordSalt: user.passwordSalt || "",
          passwordHash: user.passwordHash || createLegacyPasswordHash("")
        };
        if (isLegacyBootstrapAdminUser(normalized)
          && normalized.username.toLowerCase() === LEGACY_BOOTSTRAP_ADMIN_USERNAME
          && normalized.passwordHash === createLegacyPasswordHash(LEGACY_BOOTSTRAP_ADMIN_PASSWORD)
          && normalized.passwordSalt) {
          normalized.passwordSalt = "";
          repairedDefaultAdmin = true;
        }
        const key = normalized.username.toLowerCase();
        if (seen.has(key)) return null;
        seen.add(key);
        return normalized;
      })
      .filter(Boolean);
    if (!s.users.length) s.users = [createLegacyBootstrapAdmin()];
  }
  if (!s.users.some((user) => user.role === "admin")) {
    s.users.unshift(createLegacyBootstrapAdmin());
  }
  return repairedDefaultAdmin;
}

function uid() { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function toDate(s) {
  if (s instanceof Date) {
    return new Date(s.getFullYear(), s.getMonth(), s.getDate(), 12, 0, 0, 0);
  }
  if (typeof s !== "string") return new Date(NaN);
  const value = s.trim();
  if (!value) return new Date(NaN);

  let match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (match) {
    const y = Number(match[1]);
    const m = Number(match[2]) - 1;
    const d = Number(match[3]);
    return new Date(y, m, d, 12, 0, 0, 0);
  }

  match = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const m = Number(match[1]) - 1;
    const d = Number(match[2]);
    const y = Number(match[3]);
    return new Date(y, m, d, 12, 0, 0, 0);
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date(NaN);
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0, 0);
}
function toISO(d) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`; }
function todayISO() { return toISO(new Date()); }
function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

function normalizeApiDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toISO(value);
  }
  const source = String(value ?? "").trim();
  if (!source) return "";
  const isoDateMatch = source.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoDateMatch) return isoDateMatch[1];
  const parsed = toDate(source);
  if (!Number.isNaN(parsed.getTime())) {
    return toISO(parsed);
  }
  return source;
}

function formatDisplayDate(value) {
  const normalized = normalizeApiDate(value);
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return normalized;
  return `${match[2]}/${match[3]}/${match[1]}`;
}

function calculateAge(birthdate, ref = new Date()) {
  const b = toDate(birthdate);
  if (Number.isNaN(b.getTime())) return 0;
  let age = ref.getFullYear() - b.getFullYear();
  const md = ref.getMonth() - b.getMonth();
  const dd = ref.getDate() - b.getDate();
  if (md < 0 || (md === 0 && dd < 0)) age -= 1;
  return Math.max(0, age);
}

function defaultState() {
  const y = new Date().getFullYear();
  const schoolYearId = uid();
  const schoolYear = { id: schoolYearId, label: `${y}-${y+1}`, startDate: `${y}-01-01`, endDate: `${y}-12-31`, requiredInstructionalDays: null, requiredInstructionalHours: null };
  const quarters = [
    { id: uid(), schoolYearId, name: "Q1", startDate: `${y}-01-01`, endDate: `${y}-03-31` },
    { id: uid(), schoolYearId, name: "Q2", startDate: `${y}-04-01`, endDate: `${y}-06-30` },
    { id: uid(), schoolYearId, name: "Q3", startDate: `${y}-07-01`, endDate: `${y}-09-30` },
    { id: uid(), schoolYearId, name: "Q4", startDate: `${y}-10-01`, endDate: `${y}-12-31` }
  ];
  return {
    students: [], instructors: [], subjects: [], courses: [], enrollments: [], plans: [], attendance: [], instructionActuals: [], tests: [], users: [createLegacyBootstrapAdmin()],
    settings: {
      schoolYear: { ...schoolYear },
      schoolYears: [schoolYear],
      currentSchoolYearId: schoolYearId,
      quarters: quarters.map((q) => ({ ...q })),
      allQuarters: quarters,
      dailyBreaks: [],
      holidays: [],
      gradeTypes: DEFAULT_GRADE_TYPES.map((name) => ({ id: uid(), name, weight: null })),
      gradingCriteria: {
        letterScale: DEFAULT_LETTER_GRADE_SCALE.map(({ label }) => ({ label, start: null, end: null })),
        gpaScaleOption: "4",
        gpaMax: 4
      }
    }
  };
}

function validState(s) {
  return s && Array.isArray(s.students) && Array.isArray(s.subjects) && Array.isArray(s.courses)
    && Array.isArray(s.enrollments) && Array.isArray(s.plans) && Array.isArray(s.attendance)
    && Array.isArray(s.tests) && Array.isArray(s.users) && s.settings && s.settings.schoolYear
    && Array.isArray(s.settings.quarters) && Array.isArray(s.settings.holidays);
}

function normalizeInstructorsShape(inputState) {
  const s = inputState;
  if (!Array.isArray(s.instructors)) {
    s.instructors = [];
    return;
  }
  s.instructors = s.instructors
    .filter((instructor) => instructor && String(instructor.firstName || "").trim() && String(instructor.lastName || "").trim())
    .map((instructor) => {
      const rawCategory = String(instructor.category || "").trim().toLowerCase();
      const category = INSTRUCTOR_CATEGORY_OPTIONS.includes(rawCategory) ? rawCategory : "other";
      const rawAge = instructor.ageRecorded === "" || instructor.ageRecorded == null ? null : Number(instructor.ageRecorded);
      return {
        id: instructor.id || uid(),
        firstName: String(instructor.firstName || "").trim(),
        lastName: String(instructor.lastName || "").trim(),
        birthdate: normalizeApiDate(instructor.birthdate),
        category,
        ageRecorded: Number.isInteger(rawAge) && rawAge >= 0 ? rawAge : null,
        createdAt: instructor.createdAt || normalizeApiDate(instructor.birthdate) || todayISO()
      };
    })
    .filter((instructor) => /^\d{4}-\d{2}-\d{2}$/.test(instructor.birthdate));
}

function normalizeInstructionActualsShape(inputState) {
  const s = inputState;
  const validStudentIds = new Set((s.students || []).map((student) => student.id));
  const validCourseIds = new Set((s.courses || []).map((course) => course.id));
  if (!Array.isArray(s.instructionActuals)) {
    s.instructionActuals = [];
    return;
  }
  const seen = new Set();
  s.instructionActuals = s.instructionActuals
    .filter((entry) => entry)
    .map((entry) => ({
      id: entry.id || uid(),
      studentId: String(entry.studentId || "").trim(),
      courseId: String(entry.courseId || "").trim(),
      instructorId: String(entry.instructorId || "").trim(),
      date: String(entry.date || "").trim(),
      actualMinutes: Number(entry.actualMinutes)
    }))
    .filter((entry) =>
      validStudentIds.has(entry.studentId)
      && validCourseIds.has(entry.courseId)
      && /^\d{4}-\d{2}-\d{2}$/.test(entry.date)
      && Number.isInteger(entry.actualMinutes)
      && entry.actualMinutes > 0)
    .filter((entry) => {
      const key = `${entry.studentId}||${entry.courseId}||${entry.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function normalizeCoursesShape(inputState) {
  const s = inputState;
  if (!Array.isArray(s.courses)) {
    s.courses = [];
    return;
  }
  s.courses = s.courses.map((course) => ({
    ...course,
    instructorId: String(course.instructorId || "").trim(),
    exclusiveResource: !!course.exclusiveResource
  }));
}

function normalizeEnrollmentsShape(inputState) {
  const s = inputState;
  if (!Array.isArray(s.enrollments)) {
    s.enrollments = [];
    return;
  }
  s.enrollments = s.enrollments
    .filter((enrollment) => enrollment && enrollment.studentId && enrollment.courseId)
    .map((enrollment) => {
      const parsedOrder = enrollment.scheduleOrder === "" || enrollment.scheduleOrder == null
        ? null
        : Number(enrollment.scheduleOrder);
      return {
        ...enrollment,
        id: enrollment.id || uid(),
        scheduleOrder: Number.isInteger(parsedOrder) && parsedOrder > 0 ? parsedOrder : null
      };
    });
}

function mergeLegacyBridgeCoursesWithLocalState(remoteState, localState) {
  if (!remoteState || !Array.isArray(remoteState.courses) || !localState || !Array.isArray(localState.courses)) return false;
  let changed = false;
  const localCoursesById = new Map(
    localState.courses
      .filter((course) => course && course.id)
      .map((course) => [course.id, course])
  );
  remoteState.courses = remoteState.courses.map((course) => {
    const localCourse = localCoursesById.get(course.id);
    if (!localCourse) return course;
    const mergedCourse = { ...course, ...localCourse, exclusiveResource: !!localCourse.exclusiveResource };
    if (JSON.stringify(mergedCourse) !== JSON.stringify(course)) changed = true;
    return mergedCourse;
  });
  localState.courses.forEach((course) => {
    if (!course || !course.id || remoteState.courses.some((existing) => existing.id === course.id)) return;
    changed = true;
    remoteState.courses.push({ ...course, exclusiveResource: !!course.exclusiveResource });
  });
  return changed;
}

function mergeLegacyBridgeEnrollmentsWithLocalState(remoteState, localState) {
  if (!remoteState || !Array.isArray(remoteState.enrollments) || !localState || !Array.isArray(localState.enrollments)) return false;
  let changed = false;
  const localEnrollmentsById = new Map(
    localState.enrollments
      .filter((enrollment) => enrollment && enrollment.id)
      .map((enrollment) => [enrollment.id, enrollment])
  );
  remoteState.enrollments = remoteState.enrollments.map((enrollment) => {
    const localEnrollment = localEnrollmentsById.get(enrollment.id);
    if (!localEnrollment) return enrollment;
    const remoteScheduleOrder = enrollment.scheduleOrder == null ? null : Number(enrollment.scheduleOrder);
    const localScheduleOrder = localEnrollment.scheduleOrder == null ? null : Number(localEnrollment.scheduleOrder);
    if (remoteScheduleOrder != null || localScheduleOrder == null) return enrollment;
    changed = true;
    return { ...enrollment, scheduleOrder: localScheduleOrder };
  });
  return changed;
}

function mergeLegacyBridgeDailyBreaksWithLocalState(remoteState, localState) {
  if (!remoteState?.settings || !localState?.settings) return false;
  const remoteDailyBreaks = Array.isArray(remoteState.settings.dailyBreaks) ? remoteState.settings.dailyBreaks : [];
  const localDailyBreaks = Array.isArray(localState.settings.dailyBreaks) ? localState.settings.dailyBreaks : [];
  let changed = false;
  const localById = new Map(
    localDailyBreaks
      .filter((entry) => entry && entry.id)
      .map((entry) => [entry.id, entry])
  );

  remoteState.settings.dailyBreaks = remoteDailyBreaks.map((entry) => {
    const localEntry = localById.get(entry.id);
    if (!localEntry) return entry;
    const merged = {
      ...entry,
      ...localEntry,
      studentIds: Array.isArray(localEntry.studentIds) ? [...localEntry.studentIds] : (Array.isArray(entry.studentIds) ? [...entry.studentIds] : []),
      weekdays: Array.isArray(localEntry.weekdays) ? [...localEntry.weekdays] : (Array.isArray(entry.weekdays) ? [...entry.weekdays] : [])
    };
    if (JSON.stringify(merged) !== JSON.stringify(entry)) changed = true;
    return merged;
  });

  localDailyBreaks.forEach((entry) => {
    if (!entry || !entry.id || remoteState.settings.dailyBreaks.some((existing) => existing.id === entry.id)) return;
    remoteState.settings.dailyBreaks.push({
      ...entry,
      studentIds: Array.isArray(entry.studentIds) ? [...entry.studentIds] : [],
      weekdays: Array.isArray(entry.weekdays) ? [...entry.weekdays] : []
    });
    changed = true;
  });

  return changed;
}

function mergeLegacyBridgeSchoolYearsWithLocalState(remoteState, localState) {
  if (!remoteState?.settings || !localState?.settings) return false;
  const remoteSchoolYears = Array.isArray(remoteState.settings.schoolYears) ? remoteState.settings.schoolYears : [];
  const localSchoolYears = Array.isArray(localState.settings.schoolYears) ? localState.settings.schoolYears : [];
  let changed = false;
  const localById = new Map(
    localSchoolYears
      .filter((entry) => entry && entry.id)
      .map((entry) => [entry.id, entry])
  );

  remoteState.settings.schoolYears = remoteSchoolYears.map((entry) => {
    const localEntry = localById.get(entry.id);
    if (!localEntry) return entry;
    const merged = { ...entry, ...localEntry };
    if (JSON.stringify(merged) !== JSON.stringify(entry)) changed = true;
    return merged;
  });

  localSchoolYears.forEach((entry) => {
    if (!entry || !entry.id || remoteState.settings.schoolYears.some((existing) => existing.id === entry.id)) return;
    remoteState.settings.schoolYears.push({ ...entry });
    changed = true;
  });

  if (localState.settings.currentSchoolYearId
    && remoteState.settings.currentSchoolYearId !== localState.settings.currentSchoolYearId
    && remoteState.settings.schoolYears.some((entry) => entry.id === localState.settings.currentSchoolYearId)) {
    remoteState.settings.currentSchoolYearId = localState.settings.currentSchoolYearId;
    changed = true;
  }

  return changed;
}

function mergeLegacyBridgeQuartersWithLocalState(remoteState, localState) {
  if (!remoteState?.settings || !localState?.settings) return false;
  const remoteQuarters = Array.isArray(remoteState.settings.allQuarters)
    ? remoteState.settings.allQuarters
    : (Array.isArray(remoteState.settings.quarters) ? remoteState.settings.quarters : []);
  const localQuarters = Array.isArray(localState.settings.allQuarters)
    ? localState.settings.allQuarters
    : (Array.isArray(localState.settings.quarters) ? localState.settings.quarters : []);
  let changed = false;
  const localById = new Map(
    localQuarters
      .filter((entry) => entry && entry.id)
      .map((entry) => [entry.id, entry])
  );

  remoteState.settings.allQuarters = remoteQuarters.map((entry) => {
    const localEntry = localById.get(entry.id);
    if (!localEntry) return entry;
    const merged = { ...entry, ...localEntry };
    if (JSON.stringify(merged) !== JSON.stringify(entry)) changed = true;
    return merged;
  });

  localQuarters.forEach((entry) => {
    if (!entry || !entry.id || remoteState.settings.allQuarters.some((existing) => existing.id === entry.id)) return;
    remoteState.settings.allQuarters.push({ ...entry });
    changed = true;
  });

  return changed;
}

function mergeLegacyBridgeGradingCriteriaWithLocalState(remoteState, localState) {
  if (!remoteState?.settings || !localState?.settings?.gradingCriteria) return false;
  const remoteCriteria = remoteState.settings.gradingCriteria || {};
  const localCriteria = localState.settings.gradingCriteria;
  const merged = {
    ...remoteCriteria,
    ...localCriteria,
    letterScale: Array.isArray(localCriteria.letterScale)
      ? localCriteria.letterScale.map((entry) => ({ ...entry }))
      : (Array.isArray(remoteCriteria.letterScale) ? remoteCriteria.letterScale.map((entry) => ({ ...entry })) : [])
  };
  if (JSON.stringify(merged) === JSON.stringify(remoteCriteria)) return false;
  remoteState.settings.gradingCriteria = merged;
  return true;
}

function normalizeSettingsShape(inputState) {
  const s = inputState;
  if (!s.settings) s.settings = {};
  const normalizeRequiredValue = (value, allowDecimal = false) => {
    if (value === "" || value == null) return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return allowDecimal ? parsed : Math.round(parsed);
  };

  const legacySchoolYear = s.settings.schoolYear && s.settings.schoolYear.startDate && s.settings.schoolYear.endDate
    ? s.settings.schoolYear
    : null;
  if (!Array.isArray(s.settings.schoolYears) || !s.settings.schoolYears.length) {
    if (legacySchoolYear) {
      s.settings.schoolYears = [{
        id: uid(),
        label: legacySchoolYear.label || "School Year",
        startDate: legacySchoolYear.startDate,
        endDate: legacySchoolYear.endDate,
        requiredInstructionalDays: normalizeRequiredValue(legacySchoolYear.requiredInstructionalDays),
        requiredInstructionalHours: normalizeRequiredValue(legacySchoolYear.requiredInstructionalHours, true)
      }];
    } else {
      const fallback = defaultState().settings.schoolYears[0];
      s.settings.schoolYears = [{ ...fallback }];
    }
  } else {
    s.settings.schoolYears = s.settings.schoolYears
      .filter((year) => year && year.startDate && year.endDate)
      .map((year) => ({
        ...year,
        id: year.id || uid(),
        label: year.label || `${year.startDate} to ${year.endDate}`,
        requiredInstructionalDays: normalizeRequiredValue(year.requiredInstructionalDays),
        requiredInstructionalHours: normalizeRequiredValue(year.requiredInstructionalHours, true)
      }));
    if (!s.settings.schoolYears.length) s.settings.schoolYears = defaultState().settings.schoolYears;
  }

  if (!s.settings.currentSchoolYearId || !s.settings.schoolYears.some((year) => year.id === s.settings.currentSchoolYearId)) {
    s.settings.currentSchoolYearId = s.settings.schoolYears[0].id;
  }

  const currentSchoolYear = s.settings.schoolYears.find((year) => year.id === s.settings.currentSchoolYearId) || s.settings.schoolYears[0];
  s.settings.schoolYear = {
    id: currentSchoolYear.id,
    label: currentSchoolYear.label,
    startDate: currentSchoolYear.startDate,
    endDate: currentSchoolYear.endDate,
    requiredInstructionalDays: currentSchoolYear.requiredInstructionalDays,
    requiredInstructionalHours: currentSchoolYear.requiredInstructionalHours
  };

  const legacyQuarters = Array.isArray(s.settings.quarters) ? s.settings.quarters : [];
  if (!Array.isArray(s.settings.allQuarters) || !s.settings.allQuarters.length) {
    s.settings.allQuarters = legacyQuarters.map((q) => ({
      id: q.id || uid(),
      schoolYearId: q.schoolYearId || s.settings.currentSchoolYearId,
      name: q.name,
      startDate: q.startDate,
      endDate: q.endDate
    }));
  } else {
    s.settings.allQuarters = s.settings.allQuarters
      .filter((q) => q && q.name && q.startDate && q.endDate)
      .map((q) => ({ ...q, id: q.id || uid(), schoolYearId: q.schoolYearId || s.settings.currentSchoolYearId }));
  }

  s.settings.quarters = s.settings.allQuarters
    .filter((q) => q.schoolYearId === s.settings.currentSchoolYearId)
    .sort((a, b) => toDate(a.startDate) - toDate(b.startDate))
    .map((q) => ({ id: q.id, schoolYearId: q.schoolYearId, name: q.name, startDate: q.startDate, endDate: q.endDate }));

  const validStudentIds = new Set((s.students || []).map((student) => student.id));
  const validSchoolYearIds = new Set((s.settings.schoolYears || []).map((year) => year.id));
  if (!Array.isArray(s.settings.dailyBreaks)) {
    s.settings.dailyBreaks = [];
  } else {
    s.settings.dailyBreaks = s.settings.dailyBreaks
      .filter((entry) => entry)
      .map((entry) => {
        const studentIds = Array.isArray(entry.studentIds)
          ? entry.studentIds
          : (entry.studentId ? [entry.studentId] : []);
        const weekdays = Array.isArray(entry.weekdays)
          ? entry.weekdays.map((day) => Number(day)).filter((day) => Number.isInteger(day) && day >= 1 && day <= 5)
          : [];
        return {
          id: entry.id || uid(),
          schoolYearId: validSchoolYearIds.has(entry.schoolYearId) ? entry.schoolYearId : s.settings.currentSchoolYearId,
          studentIds: Array.from(new Set(studentIds.filter((studentId) => validStudentIds.has(studentId)))),
          type: ["lunch", "recess", "other"].includes(entry.type) ? entry.type : "lunch",
          description: String(entry.description || "").trim(),
          startTime: /^\d{2}:\d{2}$/.test(String(entry.startTime || "")) ? String(entry.startTime) : "12:00",
          durationMinutes: Math.max(5, Number(entry.durationMinutes) || 60),
          weekdays: Array.from(new Set(weekdays)).sort((a, b) => a - b)
        };
      })
      .filter((entry) => entry.studentIds.length && entry.weekdays.length);
  }

  if (!Array.isArray(s.settings.holidays)) s.settings.holidays = [];

  if (!Array.isArray(s.settings.gradeTypes)) {
    s.settings.gradeTypes = DEFAULT_GRADE_TYPES.map((name) => ({ id: uid(), name, weight: null }));
  } else {
    const byName = new Map();
    s.settings.gradeTypes
      .filter((gt) => gt && String(gt.name || "").trim())
      .forEach((gt) => {
        const parsedWeight = gt.weight === "" || gt.weight == null ? null : Number(gt.weight);
        const normalized = {
          id: gt.id || uid(),
          name: String(gt.name).trim(),
          weight: Number.isFinite(parsedWeight) && parsedWeight >= 0 ? parsedWeight : null
        };
        const key = normalized.name.toLowerCase();
        if (!byName.has(key)) byName.set(key, normalized);
    });
    s.settings.gradeTypes = Array.from(byName.values());
  }

  const incomingCriteria = s.settings.gradingCriteria || {};
  const incomingLetterScale = Array.isArray(incomingCriteria.letterScale) ? incomingCriteria.letterScale : [];
  const incomingByLabel = new Map(
    incomingLetterScale
      .filter((entry) => entry && LETTER_GRADE_ORDER.includes(String(entry.label || "").toUpperCase()))
      .map((entry) => {
        const start = entry.start === "" || entry.start == null ? null : Number(entry.start);
        const end = entry.end === "" || entry.end == null ? null : Number(entry.end);
        return [String(entry.label).toUpperCase(), {
          label: String(entry.label).toUpperCase(),
          start: Number.isInteger(start) && start >= 0 && start <= 100 ? start : null,
          end: Number.isInteger(end) && end >= 0 && end <= 100 ? end : null
        }];
      })
  );
  const rawGpaScaleOption = String(incomingCriteria.gpaScaleOption || "").trim();
  const rawGpaMax = incomingCriteria.gpaMax === "" || incomingCriteria.gpaMax == null ? null : Number(incomingCriteria.gpaMax);
  const normalizedGpaMax = Number.isInteger(rawGpaMax) && rawGpaMax > 0 ? rawGpaMax : 4;
  const normalizedGpaScaleOption = ["4", "5", "10"].includes(rawGpaScaleOption)
    ? rawGpaScaleOption
    : (rawGpaScaleOption === "other" ? "other" : (["4", "5", "10"].includes(String(normalizedGpaMax)) ? String(normalizedGpaMax) : "4"));
  s.settings.gradingCriteria = {
    letterScale: DEFAULT_LETTER_GRADE_SCALE.map((entry) => incomingByLabel.get(entry.label) || { label: entry.label, start: null, end: null }),
    gpaScaleOption: normalizedGpaScaleOption,
    gpaMax: normalizedGpaScaleOption === "other" ? normalizedGpaMax : Number(normalizedGpaScaleOption)
  };

  normalizeUsersShape(s);
  normalizeInstructorsShape(s);
  normalizeCoursesShape(s);
  normalizeEnrollmentsShape(s);
  normalizeInstructionActualsShape(s);
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!validState(parsed)) return defaultState();
    const before = JSON.stringify(parsed.users || []);
    normalizeSettingsShape(parsed);
    const after = JSON.stringify(parsed.users || []);
    if (before !== after) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
    }
    return parsed;
  } catch {
    return defaultState();
  }
}

async function fetchLegacyBridgeState() {
  const response = await fetch(LEGACY_STATE_BRIDGE_ENDPOINT, { method: "GET", headers: { "Accept": "application/json" } });
  if (!response.ok) throw new Error(`Legacy bridge state fetch failed (${response.status})`);
  return response.json();
}

async function pushLegacyBridgeState(snapshot) {
  const response = await fetch(LEGACY_STATE_BRIDGE_ENDPOINT, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(snapshot)
  });
  if (!response.ok) {
    let message = `Legacy bridge state save failed (${response.status})`;
    try {
      const payload = await response.json();
      if (payload && payload.error) message = payload.error;
    } catch {
      // Keep generic message if payload is not JSON.
    }
    throw new Error(message);
  }
}

function mergeLegacyBridgeRemoteState(remoteState, localState) {
  const beforeUsers = JSON.stringify(remoteState.users || []);
  normalizeSettingsShape(remoteState);
  const schoolYearsChanged = mergeLegacyBridgeSchoolYearsWithLocalState(remoteState, localState);
  const quartersChanged = mergeLegacyBridgeQuartersWithLocalState(remoteState, localState);
  const coursesChanged = mergeLegacyBridgeCoursesWithLocalState(remoteState, localState);
  const enrollmentsChanged = mergeLegacyBridgeEnrollmentsWithLocalState(remoteState, localState);
  const dailyBreaksChanged = mergeLegacyBridgeDailyBreaksWithLocalState(remoteState, localState);
  const gradingCriteriaChanged = mergeLegacyBridgeGradingCriteriaWithLocalState(remoteState, localState);
  normalizeSettingsShape(remoteState);

  return {
    usersChanged: beforeUsers !== JSON.stringify(remoteState.users || []),
    needsResave: schoolYearsChanged
      || quartersChanged
      || coursesChanged
      || enrollmentsChanged
      || dailyBreaksChanged
      || gradingCriteriaChanged
  };
}

function isLegacyBootstrapAdminUser(user) {
  return !!user && user.id === "default-admin-user";
}

async function bootstrapFromLegacyBridge() {
  const localState = state;
  const remoteState = await fetchLegacyBridgeState();
  if (!validState(remoteState)) return;

  const mergeResult = mergeLegacyBridgeRemoteState(remoteState, localState);
  state = remoteState;
  if (!state.users.some((user) => user.id === currentUserId)) {
    currentUserId = "";
    saveSession();
  }
  setCurrentSchoolYear(state.settings.currentSchoolYearId);
  if (backfillAttendanceToToday() || mergeResult.usersChanged || mergeResult.needsResave) saveState();
  gradeTypesDraft = cloneGradeTypes(state.settings.gradeTypes);
  renderAll();
}

function runLegacyLocalStartupMaintenance() {
  if (!isLegacyBridgeMode()) return false;
  return backfillAttendanceToToday();
}

function shouldShowLegacyBootstrapAdminMessaging() {
  return isLegacyBridgeMode() && state.users.some((entry) => isLegacyBootstrapAdminUser(entry));
}

let currentUserId = "";
let currentTab = "dashboard";
let state = loadState();
let hostedModeEnabled = loadHostedModePreference();
if (!IS_LOCAL_DEV_HOST) {
  hostedModeEnabled = true;
}
loadSession();
if (!state.users.some((user) => user.id === currentUserId)) currentUserId = "";
setCurrentSchoolYear(state.settings.currentSchoolYearId);
const startupBackfillChanged = runLegacyLocalStartupMaintenance();
let legacyBridgeSaveInFlight = false;
let legacyBridgeSavePending = false;
let legacyBridgeSyncReady = false;
let selectedStudentId = "";
let editingInstructorId = "";
let editingAttendanceId = "";
let editingInstructionActualKey = "";
let editingUserId = "";
let userViewMode = "list";
let studentViewMode = "list";
let instructorViewMode = "list";
let studentEnrollmentDraftStudentId = "";
let studentEnrollmentDraft = [];
let studentEnrollmentDraftDirty = false;
const expandedStudentAverageRows = new Set();
const expandedSubjectAverageRows = new Set();
const expandedStudentAttendanceRows = new Set();
const expandedStudentInstructionalHourRows = new Set();
const studentPerformanceSelectedGradeMethods = new Set(STUDENT_PERFORMANCE_GRADE_METHODS);
const trendSelectedStudentIds = new Set();
const gpaTrendSelectedStudentIds = new Set();
const instructionHoursTrendSelectedStudentIds = new Set();
const volumeSelectedStudentIds = new Set();
const workSelectedStudentIds = new Set();
const workDistributionSelectedGradeTypes = new Set();
const studentPerformanceSelectedInstructorIds = new Set();
const studentInstructionalHoursSelectedInstructorIds = new Set();
let workDistributionGradeTypesInitialized = false;
let editingCourseId = "";
let editingHolidayId = "";
let editingPlanId = "";
let editingSchoolYearId = "";
let editingQuarterSchoolYearId = "";
let editingGradeTypeId = "";
let editingDailyBreakId = "";
let gradeTypeDraftDirty = false;
let gradingCriteriaEditMode = false;
let showManagementSubjects = false;
let showManagementCourses = false;
let showManagementGradeTypes = false;
let showManagementGradingCriteria = false;
let currentManagementTab = "subjects";
let showScheduleSchoolYears = false;
let showScheduleQuarters = false;
let showScheduleDailyBreaks = false;
let showScheduleHolidays = false;
let showSchedulePlans = false;
let currentScheduleTab = "school-years";
let calendarBackToWeekContext = null;
let calendarBackToMonthContext = null;
let calendarSelectedStudentIds = new Set();
let calendarSelectedSubjectIds = new Set();
let calendarSelectedCourseIds = new Set();
let reportSelectedStudentIds = new Set();
const REPORT_CONTENT_OPTIONS = [
  { id: "studentSummary", label: "Student Summary" },
  { id: "courseSummary", label: "Course Summary" },
  { id: "detailedGrades", label: "Detailed Grades" },
  { id: "detailedAttendance", label: "Detailed Attendance" },
  { id: "instructionalHours", label: "Instructional Hours" }
];
let reportSelectedContentIds = new Set(REPORT_CONTENT_OPTIONS.map((option) => option.id));
let loginMessageKind = "";
let setupMessageKind = "";
let userFormMessageKind = "";
let hostedSetupChecked = false;
let hostedSetupInitialized = true;
function cloneGradeTypes(items) {
  return (items || []).map((gt) => ({ id: gt.id || uid(), name: String(gt.name || "").trim(), weight: gt.weight == null ? null : Number(gt.weight) }));
}
let gradeTypesDraft = cloneGradeTypes(state.settings.gradeTypes);
function draftGradeTypes() {
  return Array.isArray(gradeTypesDraft) ? gradeTypesDraft : [];
}

function saveSession() {
  if (!currentUserId) {
    sessionStorage.removeItem(SESSION_KEY);
    return;
  }
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ currentUserId }));
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.currentUserId) currentUserId = parsed.currentUserId;
  } catch {
    currentUserId = "";
  }
}

function loadHostedModePreference() {
  try {
    return localStorage.getItem(HOSTED_MODE_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

function saveHostedModePreference(value) {
  try {
    localStorage.setItem(HOSTED_MODE_STORAGE_KEY, value ? "true" : "false");
  } catch {
    // Ignore storage write failures and keep runtime behavior in memory only.
  }
}

function setHostedModeEnabled(value) {
  hostedModeEnabled = !!value;
  saveHostedModePreference(hostedModeEnabled);
}

function authFetch(url, options = {}) {
  return fetch(url, {
    credentials: "include",
    ...options,
    headers: {
      "Accept": "application/json",
      ...(options.headers || {})
    }
  });
}

async function parseApiResponse(response, fallbackMessage) {
  if (response.ok) {
    if (response.status === 204) return null;
    const text = await response.text();
    return text ? JSON.parse(text) : null;
  }

  let message = fallbackMessage;
  try {
    const payload = await response.json();
    if (payload?.error) message = payload.error;
  } catch {
    // Keep fallback message if the response is not JSON.
  }
  throw new Error(message);
}

function updateCurrentUserFromSummary(userSummary) {
  if (!userSummary || !userSummary.id) {
    currentUserId = "";
    return;
  }

  const existing = state.users.find((entry) => entry.id === userSummary.id) || {};
  const merged = {
    ...existing,
    id: userSummary.id,
    username: userSummary.username || existing.username || "",
    role: userSummary.role === "student" ? "student" : "admin",
    studentId: userSummary.studentId || "",
    mustChangePassword: !!userSummary.mustChangePassword
  };

  state.users = state.users.filter((entry) => entry.id !== merged.id);
  state.users.push(merged);
  currentUserId = merged.id;
}

async function refreshHostedUsers() {
  const response = await authFetch(API_USERS_ENDPOINT);
  if (!response.ok) throw new Error(`Users fetch failed (${response.status})`);
  const users = await response.json();
  if (!Array.isArray(users)) return;

  state.users = users.map((user) => ({
    ...user,
    studentId: user.studentId || "",
    mustChangePassword: !!user.mustChangePassword,
    passwordHash: "",
    passwordSalt: ""
  }));
}

async function refreshHostedStudents() {
  const response = await authFetch(API_STUDENTS_ENDPOINT);
  if (!response.ok) throw new Error(`Students fetch failed (${response.status})`);
  const students = await response.json();
  if (Array.isArray(students)) {
    state.students = students;
  }
}

async function refreshHostedInstructors() {
  const response = await authFetch(API_INSTRUCTORS_ENDPOINT);
  if (!response.ok) throw new Error(`Instructors fetch failed (${response.status})`);
  const instructors = await response.json();
  if (Array.isArray(instructors)) {
    state.instructors = instructors.map((instructor) => ({
      ...instructor,
      category: INSTRUCTOR_CATEGORY_OPTIONS.includes(String(instructor.category || "").trim().toLowerCase())
        ? String(instructor.category || "").trim().toLowerCase()
        : "other",
      ageRecorded: instructor.ageRecorded == null ? null : Number(instructor.ageRecorded || 0)
    }));
  }
}

async function refreshHostedSubjects() {
  const response = await authFetch(API_SUBJECTS_ENDPOINT);
  if (!response.ok) throw new Error(`Subjects fetch failed (${response.status})`);
  const subjects = await response.json();
  if (Array.isArray(subjects)) {
    state.subjects = subjects;
  }
}

async function refreshHostedCourses() {
  const response = await authFetch(API_COURSES_ENDPOINT);
  if (!response.ok) throw new Error(`Courses fetch failed (${response.status})`);
  const courses = await response.json();
  if (Array.isArray(courses)) {
    state.courses = courses.map((course) => ({
      ...course,
      instructorId: course.instructorId || "",
      hoursPerDay: Number(course.hoursPerDay || 0),
      exclusiveResource: !!course.exclusiveResource
    }));
  }
}

async function refreshHostedEnrollments() {
  const response = await authFetch(API_ENROLLMENTS_ENDPOINT);
  if (!response.ok) throw new Error(`Enrollments fetch failed (${response.status})`);
  const enrollments = await response.json();
  if (Array.isArray(enrollments)) {
    state.enrollments = enrollments.map((enrollment) => ({
      ...enrollment,
      scheduleOrder: enrollment.scheduleOrder == null ? null : Number(enrollment.scheduleOrder)
    }));
  }
}

async function refreshHostedSchoolYears() {
  const response = await authFetch(API_SCHOOL_YEARS_ENDPOINT);
  if (!response.ok) throw new Error(`School years fetch failed (${response.status})`);
  const schoolYears = await response.json();
  if (!Array.isArray(schoolYears) || !schoolYears.length) return;

  const normalized = schoolYears.map((schoolYear) => ({
    ...schoolYear,
    startDate: normalizeApiDate(schoolYear.startDate),
    endDate: normalizeApiDate(schoolYear.endDate),
    requiredInstructionalDays: schoolYear.requiredInstructionalDays == null ? null : Number(schoolYear.requiredInstructionalDays),
    requiredInstructionalHours: schoolYear.requiredInstructionalHours == null ? null : Number(schoolYear.requiredInstructionalHours)
  }));
  const current = normalized.find((schoolYear) => schoolYear.isCurrent) || normalized[0];

  state.settings.schoolYears = normalized.map(({ isCurrent, ...schoolYear }) => ({ ...schoolYear }));
  state.settings.currentSchoolYearId = current.id;
  state.settings.schoolYear = {
    id: current.id,
    label: current.label,
    startDate: current.startDate,
    endDate: current.endDate,
    requiredInstructionalDays: current.requiredInstructionalDays,
    requiredInstructionalHours: current.requiredInstructionalHours
  };
}

async function refreshHostedQuarters() {
  const response = await authFetch(API_QUARTERS_ENDPOINT);
  if (!response.ok) throw new Error(`Quarters fetch failed (${response.status})`);
  const quarters = await response.json();
  if (!Array.isArray(quarters)) return;

  state.settings.allQuarters = quarters.map((quarter) => ({
    ...quarter,
    startDate: normalizeApiDate(quarter.startDate),
    endDate: normalizeApiDate(quarter.endDate)
  }));
  state.settings.quarters = state.settings.allQuarters.filter((quarter) => quarter.schoolYearId === state.settings.currentSchoolYearId);
}

async function refreshHostedAttendance() {
  const response = await authFetch(API_ATTENDANCE_ENDPOINT);
  if (!response.ok) throw new Error(`Attendance fetch failed (${response.status})`);
  const attendance = await response.json();
  if (Array.isArray(attendance)) {
    state.attendance = attendance.map((row) => ({
      ...row,
      date: normalizeApiDate(row.date),
      present: !!row.present
    }));
  }
}

async function refreshHostedInstructionActuals() {
  const response = await authFetch(API_INSTRUCTION_ACTUALS_ENDPOINT);
  if (!response.ok) throw new Error(`Actual instructional minutes fetch failed (${response.status})`);
  const instructionActuals = await response.json();
  if (Array.isArray(instructionActuals)) {
    state.instructionActuals = instructionActuals.map((row) => ({
      ...row,
      instructorId: row.instructorId || "",
      date: normalizeApiDate(row.date),
      actualMinutes: Number(row.actualMinutes || 0)
    }));
  }
}

async function refreshHostedDailyBreaks() {
  const response = await authFetch(API_DAILY_BREAKS_ENDPOINT);
  if (!response.ok) throw new Error(`Daily breaks fetch failed (${response.status})`);
  const dailyBreaks = await response.json();
  if (Array.isArray(dailyBreaks)) {
    state.settings.dailyBreaks = dailyBreaks.map((entry) => ({
      ...entry,
      studentIds: Array.isArray(entry.studentIds) ? entry.studentIds : [],
      weekdays: Array.isArray(entry.weekdays) ? entry.weekdays.map((day) => Number(day)).filter(Number.isInteger) : [],
      durationMinutes: entry.durationMinutes == null ? 60 : Number(entry.durationMinutes)
    }));
  }
}

async function refreshHostedHolidays() {
  const response = await authFetch(API_HOLIDAYS_ENDPOINT);
  if (!response.ok) throw new Error(`Holidays fetch failed (${response.status})`);
  const holidays = await response.json();
  if (Array.isArray(holidays)) {
    state.settings.holidays = holidays.map((holiday) => ({
      ...holiday,
      startDate: normalizeApiDate(holiday.startDate),
      endDate: normalizeApiDate(holiday.endDate)
    }));
  }
}

async function refreshHostedPlans() {
  const response = await authFetch(API_PLANS_ENDPOINT);
  if (!response.ok) throw new Error(`Plans fetch failed (${response.status})`);
  const plans = await response.json();
  if (Array.isArray(plans)) {
    state.plans = plans.map((plan) => ({
      ...plan,
      startDate: normalizeApiDate(plan.startDate),
      endDate: normalizeApiDate(plan.endDate),
      weekdays: Array.isArray(plan.weekdays) ? plan.weekdays.map((day) => Number(day)).filter(Number.isInteger) : []
    }));
  }
}

async function refreshHostedGradeTypes() {
  const response = await authFetch(API_GRADE_TYPES_ENDPOINT);
  if (!response.ok) throw new Error(`Grade types fetch failed (${response.status})`);
  const gradeTypes = await response.json();
  if (Array.isArray(gradeTypes)) {
    state.settings.gradeTypes = gradeTypes.map((entry) => ({
      ...entry,
      weight: entry.weight == null ? null : Number(entry.weight)
    }));
  }
}

async function refreshHostedGradingCriteria() {
  const response = await authFetch(API_GRADING_CRITERIA_ENDPOINT);
  if (!response.ok) throw new Error(`Grading criteria fetch failed (${response.status})`);
  const criteria = await response.json();
  if (criteria && typeof criteria === "object") {
    state.settings.gradingCriteria = {
      letterScale: Array.isArray(criteria.letterScale) ? criteria.letterScale : [],
      gpaScaleOption: criteria.gpaScaleOption || "4",
      gpaMax: criteria.gpaMax == null ? 4 : Number(criteria.gpaMax)
    };
  }
}

async function createHostedHoliday(payload) {
  const response = await authFetch(API_HOLIDAYS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseApiResponse(response, `Holiday save failed (${response.status})`);
}

async function createHostedDailyBreak(payload) {
  const response = await authFetch(API_DAILY_BREAKS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseApiResponse(response, `Daily break save failed (${response.status})`);
}

async function updateHostedDailyBreak(id, payload) {
  const response = await authFetch(`${API_DAILY_BREAKS_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseApiResponse(response, `Daily break update failed (${response.status})`);
}

async function deleteHostedDailyBreak(id) {
  const response = await authFetch(`${API_DAILY_BREAKS_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  return parseApiResponse(response, `Daily break delete failed (${response.status})`);
}

async function createHostedSubject(payload) {
  const response = await authFetch(API_SUBJECTS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseApiResponse(response, `Subject save failed (${response.status})`);
}

async function createHostedStudent(payload) {
  const response = await authFetch(API_STUDENTS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseApiResponse(response, `Student save failed (${response.status})`);
}

async function createHostedInstructor(payload) {
  const response = await authFetch(API_INSTRUCTORS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseApiResponse(response, `Instructor save failed (${response.status})`);
}

async function createHostedUser(payload) {
  const response = await authFetch(API_USERS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseApiResponse(response, `User save failed (${response.status})`);
}

async function createHostedSchoolYear(payload) {
  const response = await authFetch(API_SCHOOL_YEARS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseApiResponse(response, `School year save failed (${response.status})`);
}

async function createHostedAttendance(payload) {
  const response = await authFetch(API_ATTENDANCE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseApiResponse(response, `Attendance save failed (${response.status})`);
}

async function createHostedInstructionActual(payload) {
  const response = await authFetch(API_INSTRUCTION_ACTUALS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseApiResponse(response, `Actual instructional minutes save failed (${response.status})`);
}

async function updateHostedInstructionActual(id, payload) {
  const response = await authFetch(`${API_INSTRUCTION_ACTUALS_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseApiResponse(response, `Actual instructional minutes update failed (${response.status})`);
}

async function deleteHostedInstructionActual(id) {
  const response = await authFetch(`${API_INSTRUCTION_ACTUALS_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  return parseApiResponse(response, `Actual instructional minutes delete failed (${response.status})`);
}

async function updateHostedAttendance(id, payload) {
  const response = await authFetch(`${API_ATTENDANCE_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseApiResponse(response, `Attendance update failed (${response.status})`);
}

async function deleteHostedAttendance(id) {
  const response = await authFetch(`${API_ATTENDANCE_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  return parseApiResponse(response, `Attendance delete failed (${response.status})`);
}

async function createHostedTest(payload) {
  const response = await authFetch(API_TESTS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseApiResponse(response, `Grade save failed (${response.status})`);
}

async function updateHostedTest(id, payload) {
  const response = await authFetch(`${API_TESTS_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseApiResponse(response, `Grade update failed (${response.status})`);
}

async function deleteHostedTest(id) {
  const response = await authFetch(`${API_TESTS_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  return parseApiResponse(response, `Grade delete failed (${response.status})`);
}

async function updateHostedSchoolYear(id, payload) {
  const response = await authFetch(`${API_SCHOOL_YEARS_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseApiResponse(response, `School year update failed (${response.status})`);
}

async function setHostedCurrentSchoolYear(id) {
  const response = await authFetch(`${API_SCHOOL_YEARS_ENDPOINT}/${encodeURIComponent(id)}/current`, {
    method: "PATCH"
  });
  return parseApiResponse(response, `School year current update failed (${response.status})`);
}

async function ensureHostedSchoolYearRecord(schoolYear, options = {}) {
  const target = schoolYear || currentSchoolYear();
  if (!target) {
    throw new Error("A valid school year is required.");
  }

  const id = String(options.id || target.id || state.settings.currentSchoolYearId || "").trim() || uid();
  const payload = {
    label: target.label,
    startDate: target.startDate,
    endDate: target.endDate,
    requiredInstructionalDays: target.requiredInstructionalDays ?? null,
    requiredInstructionalHours: target.requiredInstructionalHours ?? null,
    isCurrent: options.isCurrent !== false
  };

  try {
    return await updateHostedSchoolYear(id, payload);
  } catch (error) {
    if (!/School year not found\./i.test(error.message || "")) throw error;
  }

  return createHostedSchoolYear({ id, ...payload });
}

async function deleteHostedSchoolYear(id) {
  const response = await authFetch(`${API_SCHOOL_YEARS_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  return parseApiResponse(response, `School year delete failed (${response.status})`);
}

async function saveHostedQuarters(schoolYearId, quarters) {
  const response = await authFetch(`${API_SCHOOL_YEARS_ENDPOINT}/${encodeURIComponent(schoolYearId)}/quarters`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ quarters })
  });
  return parseApiResponse(response, `Quarters save failed (${response.status})`);
}

async function updateHostedUser(id, payload) {
  const response = await authFetch(`${API_USERS_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseApiResponse(response, `User update failed (${response.status})`);
}

async function deleteHostedUser(id) {
  const response = await authFetch(`${API_USERS_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  return parseApiResponse(response, `User delete failed (${response.status})`);
}

async function deleteHostedStudent(id) {
  const response = await authFetch(`${API_STUDENTS_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  return parseApiResponse(response, `Student delete failed (${response.status})`);
}

async function updateHostedInstructor(id, payload) {
  const response = await authFetch(`${API_INSTRUCTORS_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseApiResponse(response, `Instructor update failed (${response.status})`);
}

async function deleteHostedInstructor(id) {
  const response = await authFetch(`${API_INSTRUCTORS_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  return parseApiResponse(response, `Instructor delete failed (${response.status})`);
}

async function deleteHostedSubject(id) {
  const response = await authFetch(`${API_SUBJECTS_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  return parseApiResponse(response, `Subject delete failed (${response.status})`);
}

async function createHostedCourse(payload) {
  const response = await authFetch(API_COURSES_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseApiResponse(response, `Course save failed (${response.status})`);
}

async function updateHostedCourse(id, payload) {
  const response = await authFetch(`${API_COURSES_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseApiResponse(response, `Course update failed (${response.status})`);
}

async function deleteHostedCourse(id) {
  const response = await authFetch(`${API_COURSES_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  return parseApiResponse(response, `Course delete failed (${response.status})`);
}

async function createHostedEnrollment(payload) {
  const response = await authFetch(API_ENROLLMENTS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseApiResponse(response, `Enrollment save failed (${response.status})`);
}

async function updateHostedEnrollment(id, payload) {
  const response = await authFetch(`${API_ENROLLMENTS_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseApiResponse(response, `Enrollment update failed (${response.status})`);
}

async function deleteHostedEnrollment(id) {
  const response = await authFetch(`${API_ENROLLMENTS_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  return parseApiResponse(response, `Enrollment delete failed (${response.status})`);
}

async function updateHostedHoliday(id, payload) {
  const response = await authFetch(`${API_HOLIDAYS_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseApiResponse(response, `Holiday update failed (${response.status})`);
}

async function deleteHostedHoliday(id) {
  const response = await authFetch(`${API_HOLIDAYS_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  return parseApiResponse(response, `Holiday delete failed (${response.status})`);
}

async function createHostedPlans(plans) {
  const response = await authFetch(API_PLANS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ plans })
  });
  return parseApiResponse(response, `Plan save failed (${response.status})`);
}

async function saveHostedGradeTypes(gradeTypes) {
  const response = await authFetch(API_GRADE_TYPES_ENDPOINT, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ gradeTypes })
  });
  return parseApiResponse(response, `Grade types save failed (${response.status})`);
}

async function saveHostedGradingCriteria(criteria) {
  const response = await authFetch(API_GRADING_CRITERIA_ENDPOINT, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(criteria)
  });
  return parseApiResponse(response, `Grading criteria save failed (${response.status})`);
}

async function updateHostedPlan(id, payload) {
  const response = await authFetch(`${API_PLANS_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return parseApiResponse(response, `Plan update failed (${response.status})`);
}

async function deleteHostedPlan(id) {
  const response = await authFetch(`${API_PLANS_ENDPOINT}/${encodeURIComponent(id)}`, {
    method: "DELETE"
  });
  return parseApiResponse(response, `Plan delete failed (${response.status})`);
}

async function refreshHostedTests() {
  const response = await authFetch(API_TESTS_ENDPOINT);
  if (!response.ok) throw new Error(`Tests fetch failed (${response.status})`);
  const tests = await response.json();
  if (Array.isArray(tests)) {
    state.tests = tests.map((row) => ({
      ...row,
      date: normalizeApiDate(row.date),
      score: Number(row.score || 0),
      maxScore: Number(row.maxScore || 0)
    }));
  }
}

async function hydrateHostedDomainState() {
  if (!currentUser()) return;
  await refreshHostedStudents();
  await refreshHostedInstructors();
  await refreshHostedSubjects();
  await refreshHostedCourses();
  await refreshHostedEnrollments();
  await refreshHostedSchoolYears();
  await refreshHostedQuarters();
  await refreshHostedAttendance();
  await refreshHostedInstructionActuals();
  await refreshHostedDailyBreaks();
  await refreshHostedHolidays();
  await refreshHostedPlans();
  await refreshHostedGradeTypes();
  await refreshHostedGradingCriteria();
  await refreshHostedTests();
  if (isAdminUser()) {
    await refreshHostedUsers();
  }
  normalizeSettingsShape(state);
  gradeTypesDraft = cloneGradeTypes(state.settings.gradeTypes);
}

async function refreshHostedCurriculumState() {
  await refreshHostedSubjects();
  await refreshHostedCourses();
  await refreshHostedEnrollments();
}

async function refreshHostedCurriculumCascadeState() {
  await refreshHostedCurriculumState();
  await refreshHostedPlans();
  await refreshHostedInstructionActuals();
  await refreshHostedTests();
}

async function refreshHostedStudentCascadeState() {
  await refreshHostedStudents();
  await refreshHostedInstructors();
  await refreshHostedCurriculumState();
  await refreshHostedPlans();
  await refreshHostedAttendance();
  await refreshHostedInstructionActuals();
  await refreshHostedTests();
  await refreshHostedDailyBreaks();
  if (isAdminUser()) {
    await refreshHostedUsers();
  }
}

async function refreshHostedSchoolConfigState() {
  await refreshHostedSchoolYears();
  await refreshHostedQuarters();
  await refreshHostedPlans();
}

async function loginWithBackend(username, password) {
  const response = await authFetch(API_AUTH_LOGIN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password })
  });

  if (!response.ok) {
    let message = `Login failed (${response.status})`;
    try {
      const payload = await response.json();
      if (payload && payload.error) message = payload.error;
    } catch {
      // Keep generic message if payload is not JSON.
    }
    throw new Error(message);
  }

  const payload = await response.json();
  updateCurrentUserFromSummary(payload.user);
  saveSession();
  setHostedModeEnabled(true);
  await hydrateHostedDomainState();
}

async function fetchHostedSetupStatus() {
  const response = await authFetch(API_SETUP_STATUS_ENDPOINT);
  if (!response.ok) throw new Error(`Setup status failed (${response.status})`);
  const payload = await response.json();
  hostedSetupChecked = true;
  hostedSetupInitialized = !!payload?.initialized;
  return hostedSetupInitialized;
}

async function initializeHostedSetup(setupToken, username, password) {
  const response = await authFetch(API_SETUP_INITIALIZE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ setupToken, username, password })
  });
  const payload = await parseApiResponse(response, `Setup initialization failed (${response.status})`);
  hostedSetupChecked = true;
  hostedSetupInitialized = true;
  updateCurrentUserFromSummary(payload?.user);
  saveSession();
  setHostedModeEnabled(true);
  await hydrateHostedDomainState();
}

async function bootstrapHostedSession() {
  const response = await authFetch(API_ME_ENDPOINT);
  if (response.status === 401) {
    currentUserId = "";
    saveSession();
    return false;
  }
  if (!response.ok) throw new Error(`Session bootstrap failed (${response.status})`);

  const payload = await response.json();
  updateCurrentUserFromSummary(payload.user);
  saveSession();
  await hydrateHostedDomainState();
  return true;
}

async function logoutWithBackend() {
  try {
    await authFetch(API_AUTH_LOGOUT_ENDPOINT, { method: "POST" });
  } catch {
    // Keep local logout behavior even if the API call fails.
  }
}

function currentUser() {
  return state.users.find((user) => user.id === currentUserId) || null;
}

function isAdminUser(user = currentUser()) {
  return !!user && user.role === "admin";
}

function isStudentUser(user = currentUser()) {
  return !!user && user.role === "student";
}

function currentStudentId() {
  const user = currentUser();
  return isStudentUser(user) ? (user.studentId || "") : "";
}

function visibleStudents() {
  const studentId = currentStudentId();
  if (!studentId) return state.students.slice();
  return state.students.filter((student) => student.id === studentId);
}

function visibleStudentIds() {
  return new Set(visibleStudents().map((student) => student.id));
}

function studentCanAccessTab(tabName) {
  return STUDENT_ALLOWED_TABS.has(tabName);
}

function canAccessTab(tabName) {
  const user = currentUser();
  if (!user) return false;
  if (isAdminUser(user)) return true;
  return studentCanAccessTab(tabName);
}

function ensureAdminAction() {
  if (isAdminUser()) return true;
  alert("Administrator access is required for that action.");
  return false;
}

function ensureStudentSelection() {
  const roleSelect = document.getElementById("user-role");
  const studentSelect = document.getElementById("user-student-id");
  const wrap = document.getElementById("user-student-wrap");
  if (!roleSelect || !studentSelect || !wrap) return;
  const needsStudent = roleSelect.value === "student";
  wrap.classList.toggle("student-link-disabled", !needsStudent);
  studentSelect.disabled = !needsStudent;
  if (!needsStudent) studentSelect.value = "";
}

function setStatusMessage(elementId, kind, message) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.textContent = message || "";
  el.classList.toggle("hidden", !message);
  el.classList.remove("error", "success");
  if (message && kind) el.classList.add(kind);
}

function resetLoginMessage() {
  loginMessageKind = "";
  setStatusMessage("login-message", "", "");
}

function setLoginMessage(kind, message) {
  loginMessageKind = kind;
  setStatusMessage("login-message", kind, message);
}

function resetSetupMessage() {
  setupMessageKind = "";
  setStatusMessage("setup-message", "", "");
}

function setSetupMessage(kind, message) {
  setupMessageKind = kind;
  setStatusMessage("setup-message", kind, message);
}

function resetUserFormMessage() {
  userFormMessageKind = "";
  setStatusMessage("user-form-message", "", "");
}

function setUserFormMessage(kind, message) {
  userFormMessageKind = kind;
  setStatusMessage("user-form-message", kind, message);
}

function resetUserListMessage() {
  setStatusMessage("user-list-message", "", "");
}

function setUserListMessage(kind, message) {
  setStatusMessage("user-list-message", kind, message);
}

function setStudentViewMode(mode) {
  studentViewMode = mode;
}

function renderStudentViewMode() {
  const listView = document.getElementById("students-list-view");
  const editorView = document.getElementById("students-editor-view");
  const detailView = document.getElementById("students-detail-view");
  if (listView) listView.classList.toggle("hidden", studentViewMode !== "list");
  if (editorView) editorView.classList.toggle("hidden", studentViewMode !== "create");
  if (detailView) detailView.classList.toggle("hidden", studentViewMode !== "detail");
}

function renderInstructorViewMode() {
  const listView = document.getElementById("instructors-list-view");
  const editorView = document.getElementById("instructors-editor-view");
  if (listView) listView.classList.toggle("hidden", instructorViewMode !== "list");
  if (editorView) editorView.classList.toggle("hidden", instructorViewMode !== "edit");
}

function resetStudentEnrollmentDraft() {
  studentEnrollmentDraftStudentId = "";
  studentEnrollmentDraft = [];
  studentEnrollmentDraftDirty = false;
}

function primeStudentEnrollmentDraft(studentId) {
  studentEnrollmentDraftStudentId = studentId || "";
  studentEnrollmentDraft = state.enrollments
    .filter((entry) => entry.studentId === studentId)
    .map((entry) => ({ ...entry }));
  studentEnrollmentDraftDirty = false;
}

function workingStudentEnrollments(studentId) {
  if (studentEnrollmentDraftStudentId === studentId) {
    return studentEnrollmentDraft.map((entry) => ({ ...entry }));
  }
  return state.enrollments
    .filter((entry) => entry.studentId === studentId)
    .map((entry) => ({ ...entry }));
}

function beginStudentCreate() {
  selectedStudentId = "";
  resetStudentEnrollmentDraft();
  setStudentViewMode("create");
  const editorTitle = document.getElementById("student-editor-title");
  const submitBtn = document.getElementById("student-submit-btn");
  const form = document.getElementById("student-form");
  if (editorTitle) editorTitle.textContent = "New Student";
  if (submitBtn) submitBtn.textContent = "Create Student";
  if (form) form.reset();
  renderStudentViewMode();
}

function beginInstructorCreate() {
  editingInstructorId = "";
  instructorViewMode = "edit";
  const editorTitle = document.getElementById("instructor-editor-title");
  const submitBtn = document.getElementById("instructor-submit-btn");
  const form = document.getElementById("instructor-form");
  if (editorTitle) editorTitle.textContent = "New Instructor";
  if (submitBtn) submitBtn.textContent = "Create Instructor";
  if (form) form.reset();
  const ageInput = document.getElementById("instructor-age");
  if (ageInput) ageInput.value = "";
  renderInstructorViewMode();
}

function beginInstructorEdit(instructorId) {
  const instructor = state.instructors.find((entry) => entry.id === instructorId);
  if (!instructor) return;
  editingInstructorId = instructorId;
  instructorViewMode = "edit";
  const editorTitle = document.getElementById("instructor-editor-title");
  const submitBtn = document.getElementById("instructor-submit-btn");
  if (editorTitle) editorTitle.textContent = "Edit Instructor";
  if (submitBtn) submitBtn.textContent = "Update Instructor";
  const firstInput = document.getElementById("instructor-first");
  const lastInput = document.getElementById("instructor-last");
  const categoryInput = document.getElementById("instructor-category");
  const birthdateInput = document.getElementById("instructor-birthdate");
  const ageInput = document.getElementById("instructor-age");
  if (firstInput) firstInput.value = instructor.firstName || "";
  if (lastInput) lastInput.value = instructor.lastName || "";
  if (categoryInput) categoryInput.value = instructor.category || "parent";
  if (birthdateInput) birthdateInput.value = normalizeApiDate(instructor.birthdate);
  if (ageInput) ageInput.value = String(calculateAge(instructor.birthdate));
  renderInstructorViewMode();
}

function beginStudentDetail(studentId) {
  const student = state.students.find((entry) => entry.id === studentId);
  if (!student) return;
  selectedStudentId = studentId;
  primeStudentEnrollmentDraft(studentId);
  setStudentViewMode("detail");
  renderStudentViewMode();
}

function setActiveTab(tabName) {
  const fallback = isAdminUser() ? "dashboard" : "dashboard";
  currentTab = canAccessTab(tabName) ? tabName : fallback;
  document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === currentTab);
  });
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === `tab-${currentTab}`);
  });
}

function renderSessionChrome() {
  const loginShell = document.getElementById("login-shell");
  const appShell = document.getElementById("app-shell");
  const loginCard = document.getElementById("login-card");
  const setupCard = document.getElementById("setup-card");
  const sessionSummary = document.getElementById("session-summary");
  const defaultAdminNote = document.getElementById("login-default-admin-note");
  const userBanner = document.getElementById("users-default-admin-banner");
  const user = currentUser();
  const signedIn = !!user;
  const showHostedSetup = hostedModeEnabled && hostedSetupChecked && !hostedSetupInitialized && !signedIn;

  if (loginShell) loginShell.classList.toggle("hidden", signedIn);
  if (appShell) appShell.classList.toggle("hidden", !signedIn);
  if (loginCard) loginCard.classList.toggle("hidden", showHostedSetup);
  if (setupCard) setupCard.classList.toggle("hidden", !showHostedSetup);
  const showBootstrapAdminMessaging = shouldShowLegacyBootstrapAdminMessaging();
  if (defaultAdminNote) defaultAdminNote.classList.toggle("hidden", signedIn || !showBootstrapAdminMessaging);
  if (userBanner) userBanner.classList.toggle("hidden", !signedIn || !isAdminUser(user) || !showBootstrapAdminMessaging);

  if (sessionSummary) {
    if (!user) sessionSummary.textContent = "Not signed in";
    else if (isAdminUser(user)) sessionSummary.textContent = `Signed in as ${user.username} | Administrator`;
    else sessionSummary.textContent = `Signed in as ${user.username} | Student`;
  }

  document.querySelectorAll(".tab-btn").forEach((btn) => {
    const tabName = btn.dataset.tab || "";
    btn.classList.toggle("hidden", !signedIn || !canAccessTab(tabName));
  });

  const studentView = isStudentUser(user);
  const studentInfo = studentView ? state.students.find((student) => student.id === currentStudentId()) : null;
  if (studentView && studentInfo) selectedStudentId = studentInfo.id;
  if (!canAccessTab(currentTab)) setActiveTab("dashboard");
  else setActiveTab(currentTab);
}

async function logout() {
  if (hostedModeEnabled) {
    await logoutWithBackend();
  }
  currentUserId = "";
  saveSession();
  resetLoginMessage();
  renderSessionChrome();
}
function scheduleLegacyBridgeSave() {
  if (hostedModeEnabled) return;
  if (!legacyBridgeSyncReady) return;
  if (legacyBridgeSaveInFlight) {
    legacyBridgeSavePending = true;
    return;
  }

  legacyBridgeSaveInFlight = true;
  const snapshot = JSON.parse(JSON.stringify(state));
  pushLegacyBridgeState(snapshot)
    .catch((error) => {
      console.warn("Legacy bridge save skipped:", error.message);
    })
    .finally(() => {
      legacyBridgeSaveInFlight = false;
      if (legacyBridgeSavePending) {
        legacyBridgeSavePending = false;
        scheduleLegacyBridgeSave();
      }
    });
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  scheduleLegacyBridgeSave();
}

async function bootstrapApplicationState() {
  if (hostedModeEnabled) {
    legacyBridgeSyncReady = false;
    try {
      const initialized = await fetchHostedSetupStatus();
      if (!initialized) {
        currentUserId = "";
        saveSession();
        resetLoginMessage();
        resetSetupMessage();
        renderAll();
        return;
      }
      const signedIn = await bootstrapHostedSession();
      if (!signedIn) resetLoginMessage();
      renderAll();
    } catch (error) {
      console.warn("Hosted session bootstrap skipped:", error.message);
      if (IS_LOCAL_DEV_HOST) {
        setHostedModeEnabled(false);
        legacyBridgeSyncReady = true;
        await bootstrapApplicationState();
        return;
      }
      setLoginMessage("error", "Unable to reach the hosted session service.");
      currentUserId = "";
      renderAll();
    } finally {
      legacyBridgeSyncReady = true;
    }
    return;
  }

  try {
    await bootstrapFromLegacyBridge();
  } catch (error) {
    console.warn("Legacy bridge bootstrap skipped:", error.message);
  } finally {
    legacyBridgeSyncReady = true;
  }
}

function getStudentName(id) { const s = state.students.find((x) => x.id === id); return s ? `${s.firstName} ${s.lastName}` : "Unknown Student"; }
function getInstructorName(id) { const instructor = state.instructors.find((entry) => entry.id === id); return instructor ? `${instructor.firstName} ${instructor.lastName}` : "Unknown Instructor"; }
function normalizeInstructorFilterIds(filterSelection) {
  if (!filterSelection || filterSelection === "all") return null;
  if (filterSelection instanceof Set) {
    const values = Array.from(filterSelection).map((value) => String(value || "").trim()).filter(Boolean);
    return values.length ? new Set(values) : null;
  }
  if (Array.isArray(filterSelection)) {
    const values = filterSelection.map((value) => String(value || "").trim()).filter(Boolean);
    return values.length ? new Set(values) : null;
  }
  const normalized = String(filterSelection || "").trim();
  if (!normalized || normalized === "all") return null;
  return new Set([normalized]);
}
function matchesInstructorFilter(actualInstructorId, filterInstructorId) {
  const allowedInstructorIds = normalizeInstructorFilterIds(filterInstructorId);
  if (!allowedInstructorIds) return true;
  return allowedInstructorIds.has(String(actualInstructorId || "").trim());
}
function assignedInstructorIdForCourse(courseId) {
  const course = getCourse(courseId);
  return String(course?.instructorId || "").trim();
}
function testInstructorId(test) {
  return assignedInstructorIdForCourse(test?.courseId || "");
}
function testMatchesInstructorFilter(test, filterInstructorId) {
  return matchesInstructorFilter(testInstructorId(test), filterInstructorId);
}
function instructionMatchesInstructorFilter(studentId, courseId, date, filterInstructorId) {
  return matchesInstructorFilter(effectiveInstructionInstructorId(studentId, courseId, date), filterInstructorId);
}
function getInstructorCategoryLabel(category) { return INSTRUCTOR_CATEGORY_LABELS[String(category || "").trim().toLowerCase()] || "Other"; }
function getSubjectName(id) { const s = state.subjects.find((x) => x.id === id); return s ? s.name : "Unknown Subject"; }
function getCourse(id) { return state.courses.find((x) => x.id === id) || null; }
function getCourseName(id) { const c = getCourse(id); return c ? c.name : "Unknown Course"; }
function getSchoolYear(id) { return state.settings.schoolYears.find((x) => x.id === id) || null; }
function currentSchoolYear() {
  return getSchoolYear(state.settings.currentSchoolYearId) || state.settings.schoolYears[0] || state.settings.schoolYear;
}
function resolvedPlanRange(plan) {
  if (!plan) return { startDate: "", endDate: "" };
  if (plan.planType === "annual") {
    const schoolYear = currentSchoolYear();
    return {
      startDate: schoolYear?.startDate || plan.startDate,
      endDate: schoolYear?.endDate || plan.endDate
    };
  }
  if (plan.planType === "quarterly" && plan.quarterName) {
    const quarter = state.settings.quarters.find((entry) => entry.name === plan.quarterName);
    if (quarter) {
      return {
        startDate: quarter.startDate,
        endDate: quarter.endDate
      };
    }
  }
  return {
    startDate: plan.startDate,
    endDate: plan.endDate
  };
}
function syncAnnualPlansForSchoolYear(previousStartDate, previousEndDate, nextStartDate, nextEndDate) {
  state.plans.forEach((plan) => {
    if (plan.planType !== "annual") return;
    if (plan.startDate !== previousStartDate || plan.endDate !== previousEndDate) return;
    plan.startDate = nextStartDate;
    plan.endDate = nextEndDate;
  });
}
function syncQuarterlyPlansForSchoolYear(schoolYearId, previousQuarterByName, nextQuarters) {
  if (schoolYearId !== state.settings.currentSchoolYearId) return;
  const nextQuarterByName = new Map(nextQuarters.map((quarter) => [quarter.name, quarter]));
  state.plans.forEach((plan) => {
    if (plan.planType !== "quarterly" || !plan.quarterName) return;
    const previousQuarter = previousQuarterByName.get(plan.quarterName);
    const nextQuarter = nextQuarterByName.get(plan.quarterName);
    if (!previousQuarter || !nextQuarter) return;
    if (plan.startDate !== previousQuarter.startDate || plan.endDate !== previousQuarter.endDate) return;
    plan.startDate = nextQuarter.startDate;
    plan.endDate = nextQuarter.endDate;
  });
}
function setCurrentSchoolYear(schoolYearId) {
  const schoolYear = getSchoolYear(schoolYearId);
  if (!schoolYear) return;
  state.settings.currentSchoolYearId = schoolYear.id;
  state.settings.schoolYear = {
    id: schoolYear.id,
    label: schoolYear.label,
    startDate: schoolYear.startDate,
    endDate: schoolYear.endDate,
    requiredInstructionalDays: schoolYear.requiredInstructionalDays ?? null,
    requiredInstructionalHours: schoolYear.requiredInstructionalHours ?? null
  };
  state.settings.quarters = state.settings.allQuarters
    .filter((q) => q.schoolYearId === schoolYear.id)
    .sort((a, b) => toDate(a.startDate) - toDate(b.startDate))
    .map((q) => ({ id: q.id, schoolYearId: q.schoolYearId, name: q.name, startDate: q.startDate, endDate: q.endDate }));
}

function backfillAttendanceToToday() {
  const start = toDate(state.settings.schoolYear.startDate);
  const today = toDate(todayISO());
  if (Number.isNaN(start.getTime()) || Number.isNaN(today.getTime()) || today <= start) return false;

  const excluded = holidaySet();
  const existingByStudentDate = new Map();
  state.attendance.forEach((record) => {
    const key = `${record.studentId}||${record.date}`;
    if (!existingByStudentDate.has(key)) {
      existingByStudentDate.set(key, record);
      return;
    }
    // If duplicates exist, keep "Absent" precedence over "Present".
    const existing = existingByStudentDate.get(key);
    if (existing && existing.present && !record.present) {
      existingByStudentDate.set(key, record);
    }
  });

  let changed = false;
  const lastCompletedDay = new Date(today);
  lastCompletedDay.setDate(lastCompletedDay.getDate() - 1);
  if (lastCompletedDay < start) return false;

  const cursor = new Date(start);
  while (cursor <= lastCompletedDay) {
    const weekday = cursor.getDay();
    const date = toISO(cursor);
    const isInstructionalDay = weekday >= 1 && weekday <= 5 && !excluded.has(date);
    if (isInstructionalDay) {
      state.students.forEach((student) => {
        const key = `${student.id}||${date}`;
        if (!existingByStudentDate.has(key)) {
          const record = { id: uid(), studentId: student.id, date, present: true };
          state.attendance.push(record);
          existingByStudentDate.set(key, record);
          changed = true;
        }
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return changed;
}

function inRange(date, startDate, endDate) { return date >= startDate && date <= endDate; }
function avg(vals){ return vals.length ? vals.reduce((a,b)=>a+b,0) / vals.length : 0; }
function pct(score, max) { const s = Number(score), m = Number(max); return m > 0 ? (s / m) * 100 : 0; }
function configuredGradeTypes() {
  return Array.isArray(state.settings.gradeTypes) ? state.settings.gradeTypes : [];
}
function gradingCriteriaSettings() {
  return state.settings?.gradingCriteria || defaultState().settings.gradingCriteria;
}
function effectiveLetterGradeScale() {
  const configured = Array.isArray(gradingCriteriaSettings().letterScale) ? gradingCriteriaSettings().letterScale : [];
  const byLabel = new Map(configured.map((entry) => [String(entry.label || "").toUpperCase(), entry]));
  return DEFAULT_LETTER_GRADE_SCALE.map((entry) => {
    const configuredEntry = byLabel.get(entry.label);
    if (configuredEntry && Number.isInteger(configuredEntry.start) && Number.isInteger(configuredEntry.end)) {
      return { label: entry.label, start: Number(configuredEntry.start), end: Number(configuredEntry.end) };
    }
    return { ...entry };
  });
}
function currentGpaMax() {
  const criteria = gradingCriteriaSettings();
  if (criteria.gpaScaleOption === "other") {
    const custom = Number(criteria.gpaMax);
    return Number.isInteger(custom) && custom > 0 ? custom : 4;
  }
  if (["4", "5", "10"].includes(String(criteria.gpaScaleOption))) return Number(criteria.gpaScaleOption);
  const fallback = Number(criteria.gpaMax);
  return Number.isInteger(fallback) && fallback > 0 ? fallback : 4;
}
function scoreToLetterGrade(scorePct) {
  const numeric = Number(scorePct);
  if (!Number.isFinite(numeric)) return "";
  const clampedScore = clamp(numeric, 0, 100);
  const match = effectiveLetterGradeScale().find((entry) => clampedScore >= entry.start && clampedScore <= entry.end);
  return match ? match.label : "";
}
function canonicalGradeTypes() {
  const seen = new Set();
  const out = [];
  configuredGradeTypes().forEach((gt) => {
    const name = String(gt.name || "").trim();
    if (!name) return;
    const key = name.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(name);
  });
  return out;
}
function gradeTypeName(test) {
  const direct = String(test.gradeType || "").trim();
  if (direct) return direct;
  const resolved = resolveGradeType(test);
  if (resolved) return resolved;
  const legacy = String(test.testName || "").trim();
  return legacy || "Test";
}
function weightedAverageForTests(tests, options = {}) {
  const quarterScoped = !!options.quarterScoped;
  if (!tests.length) return 0;
  const byType = new Map();
  tests.forEach((test) => {
    const type = gradeTypeName(test);
    const score = pct(test.score, test.maxScore);
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type).push(score);
  });
  const typeAverages = Array.from(byType.entries()).map(([type, vals]) => ({ type, avg: avg(vals) }));
  const weightedConfigured = configuredGradeTypes()
    .filter((gt) => gt.weight != null && Number(gt.weight) > 0)
    .map((gt) => ({ name: gt.name, weight: Number(gt.weight) }));
  if (!weightedConfigured.length) return avg(typeAverages.map((entry) => entry.avg));

  const weightByType = new Map(weightedConfigured.map((entry) => [entry.name.toLowerCase(), entry.weight]));
  const presentTypes = new Set(typeAverages.map((entry) => entry.type.toLowerCase()));
  const effectiveWeightByType = new Map();
  typeAverages.forEach((entry) => {
    const key = entry.type.toLowerCase();
    if (weightByType.has(key)) effectiveWeightByType.set(key, weightByType.get(key) || 0);
  });

  if (quarterScoped && presentTypes.has("assignment")) {
    const rolloverTypes = ["quiz", "test", "quarterly final"];
    let rolloverWeight = 0;
    rolloverTypes.forEach((typeKey) => {
      if (presentTypes.has(typeKey)) return;
      rolloverWeight += weightByType.get(typeKey) || 0;
    });
    effectiveWeightByType.set("assignment", (effectiveWeightByType.get("assignment") || 0) + rolloverWeight);
  }

  const withWeights = typeAverages.filter((entry) => effectiveWeightByType.has(entry.type.toLowerCase()));
  const withoutWeights = typeAverages.filter((entry) => !effectiveWeightByType.has(entry.type.toLowerCase()));

  let assignedTotalWeight = 0;
  withWeights.forEach((entry) => {
    assignedTotalWeight += effectiveWeightByType.get(entry.type.toLowerCase()) || 0;
  });

  let remainingShare = 0;
  if (withoutWeights.length) {
    const remaining = Math.max(0, 100 - assignedTotalWeight);
    remainingShare = remaining / withoutWeights.length;
    assignedTotalWeight += remaining;
  }

  if (assignedTotalWeight <= 0) return avg(typeAverages.map((entry) => entry.avg));

  let weightedSum = 0;
  withWeights.forEach((entry) => {
    weightedSum += entry.avg * (effectiveWeightByType.get(entry.type.toLowerCase()) || 0);
  });
  withoutWeights.forEach((entry) => {
    weightedSum += entry.avg * remainingShare;
  });
  return weightedSum / assignedTotalWeight;
}

function averageOfQuarterAverages(quarterRows) {
  const vals = quarterRows.filter((row) => row.count > 0).map((row) => row.avg);
  return vals.length ? avg(vals) : 0;
}
function averageToGpa(averageValue) {
  const numeric = Number(averageValue);
  if (!Number.isFinite(numeric)) return 0;
  const gpaMax = currentGpaMax();
  return clamp((numeric / 100) * gpaMax, 0, gpaMax);
}
function parseScheduleOrderValue(value) {
  if (value === "" || value == null) return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}
function sortedStudentEnrollments(studentId, sourceEnrollments = state.enrollments) {
  const studentEnrollments = sourceEnrollments
    .filter((enrollment) => enrollment.studentId === studentId)
    .map((enrollment, index) => ({ ...enrollment, _sourceIndex: index }));
  const autoSorted = [...studentEnrollments].sort((a, b) => {
    const courseA = getCourse(a.courseId);
    const courseB = getCourse(b.courseId);
    const subjectDiff = getSubjectName(courseA?.subjectId || "").localeCompare(getSubjectName(courseB?.subjectId || ""));
    if (subjectDiff !== 0) return subjectDiff;
    const courseDiff = getCourseName(a.courseId).localeCompare(getCourseName(b.courseId));
    if (courseDiff !== 0) return courseDiff;
    return a._sourceIndex - b._sourceIndex;
  });
  const ordered = new Array(autoSorted.length).fill(null);
  const overflow = [];
  autoSorted.forEach((enrollment) => {
    const preferredOrder = parseScheduleOrderValue(enrollment.scheduleOrder);
    if (preferredOrder == null) {
      overflow.push(enrollment);
      return;
    }
    const slotIndex = preferredOrder - 1;
    if (slotIndex < 0 || slotIndex >= ordered.length || ordered[slotIndex]) {
      overflow.push(enrollment);
      return;
    }
    ordered[slotIndex] = enrollment;
  });
  let overflowIndex = 0;
  for (let i = 0; i < ordered.length; i += 1) {
    if (ordered[i]) continue;
    ordered[i] = overflow[overflowIndex] || null;
    overflowIndex += 1;
  }
  return ordered.filter(Boolean);
}
function orderedEventsForStudent(studentId, events) {
  const orderedEnrollments = sortedStudentEnrollments(studentId);
  const enrollmentByCourseId = new Map(orderedEnrollments.map((enrollment) => [enrollment.courseId, enrollment]));
  const orderIndexByCourseId = new Map(orderedEnrollments.map((enrollment, index) => [enrollment.courseId, index]));
  return [...events].sort((a, b) => {
    const indexA = orderIndexByCourseId.get(a.courseId) ?? Number.MAX_SAFE_INTEGER;
    const indexB = orderIndexByCourseId.get(b.courseId) ?? Number.MAX_SAFE_INTEGER;
    if (indexA !== indexB) return indexA - indexB;
    const enrollmentA = enrollmentByCourseId.get(a.courseId);
    const enrollmentB = enrollmentByCourseId.get(b.courseId);
    const sourceA = enrollmentA?._sourceIndex ?? Number.MAX_SAFE_INTEGER;
    const sourceB = enrollmentB?._sourceIndex ?? Number.MAX_SAFE_INTEGER;
    return sourceA - sourceB;
  });
}
function updateEnrollmentScheduleOrder(enrollmentId, rawValue) {
  const source = studentViewMode === "detail" && selectedStudentId
    ? studentEnrollmentDraft
    : state.enrollments;
  const enrollment = source.find((entry) => entry.id === enrollmentId);
  if (!enrollment) return;
  const nextOrder = parseScheduleOrderValue(rawValue);
  const conflict = nextOrder != null && source.some((entry) =>
    entry.id !== enrollmentId
    && entry.studentId === enrollment.studentId
    && parseScheduleOrderValue(entry.scheduleOrder) === nextOrder);
  if (conflict) {
    alert("That schedule order is already assigned to another course for this student.");
    renderStudentDetail();
    return;
  }
  if (studentViewMode === "detail" && selectedStudentId && studentEnrollmentDraftStudentId === enrollment.studentId) {
    enrollment.scheduleOrder = nextOrder;
    studentEnrollmentDraftDirty = true;
    renderStudentDetail();
    return;
  }
  if (hostedModeEnabled) {
    (async () => {
      try {
        await updateHostedEnrollment(enrollmentId, {
          studentId: enrollment.studentId,
          courseId: enrollment.courseId,
          scheduleOrder: nextOrder
        });
        await refreshHostedEnrollments();
        renderAll();
      } catch (error) {
        alert(error.message || "Unable to update schedule order.");
        renderStudentDetail();
      }
    })();
    return;
  }
  enrollment.scheduleOrder = nextOrder;
  saveState();
  renderAll();
}
function studentOverallAverage(studentId) {
  const tests = state.tests.filter((t) => t.studentId === studentId);
  return weightedAverageForTests(tests);
}
function averageOfStudentOverallAverages(studentIds) {
  const averages = studentIds
    .map((studentId) => {
      const tests = state.tests.filter((t) => t.studentId === studentId);
      if (!tests.length) return null;
      return weightedAverageForTests(tests);
    })
    .filter((value) => value != null);
  return averages.length ? avg(averages) : 0;
}
function studentOverallAverageByRange(studentId, startDate, endDate, options = {}) {
  const tests = state.tests
    .filter((t) =>
      t.studentId === studentId
      && inRange(t.date, startDate, endDate));
  return weightedAverageForTests(tests, options);
}
function studentCourseAverage(studentId, courseId) {
  const tests = state.tests.filter((t) => t.studentId === studentId && t.courseId === courseId);
  return weightedAverageForTests(tests);
}
function studentCourseAverageByRange(studentId, courseId, startDate, endDate, options = {}) {
  const tests = state.tests
    .filter((t) =>
      t.studentId === studentId
      && t.courseId === courseId
      && inRange(t.date, startDate, endDate));
  return weightedAverageForTests(tests, options);
}
function studentGradeSummary(studentId, options = {}) {
  const quarterName = options.quarterName || "all";
  const quarterRange = state.settings.quarters.find((q) => q.name === quarterName);
  if (!quarterRange) {
    return {
      overallAverage: studentOverallAverage(studentId),
      courseAverage: (courseId) => studentCourseAverage(studentId, courseId)
    };
  }
  return {
    overallAverage: studentOverallAverageByRange(studentId, quarterRange.startDate, quarterRange.endDate, { quarterScoped: true }),
    courseAverage: (courseId) => studentCourseAverageByRange(studentId, courseId, quarterRange.startDate, quarterRange.endDate, { quarterScoped: true })
  };
}
function instructionalDatesByRange(startDate, endDate) {
  const today = todayISO();
  return instructionalDates().filter((date) =>
    date >= startDate
    && date <= endDate
    && date <= today);
}
function studentAbsenceCount(studentId) {
  const startDate = state.settings.schoolYear.startDate;
  const endDate = state.settings.schoolYear.endDate;
  return studentAttendanceSummaryByRange(studentId, startDate, endDate).absent;
}
function studentAttendanceSummary(studentId) {
  const startDate = state.settings.schoolYear.startDate;
  const endDate = state.settings.schoolYear.endDate;
  return studentAttendanceSummaryByRange(studentId, startDate, endDate);
}
function studentAttendanceSummaryByRange(studentId, startDate, endDate) {
  const validDates = instructionalDatesByRange(startDate, endDate);
  const dateSet = new Set(validDates);
  const recordsByDate = new Map();
  state.attendance.forEach((record) => {
    if (record.studentId !== studentId || !dateSet.has(record.date)) return;
    if (!recordsByDate.has(record.date)) {
      recordsByDate.set(record.date, !!record.present);
      return;
    }
    const existingPresent = recordsByDate.get(record.date);
    if (existingPresent && !record.present) {
      recordsByDate.set(record.date, false);
    }
  });
  let attended = 0;
  let absent = 0;
  validDates.forEach((date) => {
    if (!recordsByDate.has(date)) return;
    if (recordsByDate.get(date)) attended += 1;
    else absent += 1;
  });
  return {
    totalDays: validDates.length,
    attended,
    absent
  };
}

function instructionalHourBuckets() {
  const quarterByName = new Map(
    (state.settings.quarters || []).map((quarter) => [String(quarter.name || "").toUpperCase(), { ...quarter }])
  );
  return [
    {
      key: "total",
      label: "Total",
      startDate: state.settings.schoolYear.startDate,
      endDate: state.settings.schoolYear.endDate
    },
    ..."Q1 Q2 Q3 Q4".split(" ").map((name) => {
      const quarter = quarterByName.get(name);
      return {
        key: name.toLowerCase(),
        label: name,
        startDate: quarter?.startDate || "",
        endDate: quarter?.endDate || ""
      };
    })
  ];
}

function buildInstructionalHoursSnapshot(studentIds = null, options = {}) {
  const targetStudentIds = studentIds && studentIds.length
    ? new Set(studentIds)
    : new Set(state.students.map((student) => student.id));
  const instructorId = options.instructorId || "all";
  const buckets = instructionalHourBuckets();
  const summaryByStudent = new Map();
  const attendanceByStudentDate = new Map();
  const yearStart = toDate(state.settings.schoolYear.startDate);
  const yearEnd = toDate(state.settings.schoolYear.endDate);
  const todayKey = todayISO();
  if (Number.isNaN(yearStart.getTime()) || Number.isNaN(yearEnd.getTime()) || yearEnd < yearStart) {
    return { buckets, summaryByStudent };
  }

  const ensureBucketMetrics = () => ({ earned: 0, projected: 0 });
  const ensureStudentSummary = (studentId) => {
    if (!summaryByStudent.has(studentId)) {
      summaryByStudent.set(studentId, {
        buckets: Object.fromEntries(buckets.map((bucket) => [bucket.key, ensureBucketMetrics()])),
        subjects: new Map()
      });
    }
    return summaryByStudent.get(studentId);
  };
  const ensureSubjectSummary = (studentSummary, subjectId) => {
    if (!studentSummary.subjects.has(subjectId)) {
      studentSummary.subjects.set(subjectId, {
        subjectId,
        buckets: Object.fromEntries(buckets.map((bucket) => [bucket.key, ensureBucketMetrics()]))
      });
    }
    return studentSummary.subjects.get(subjectId);
  };
  const addHours = (metrics, hours, earned) => {
    metrics.projected += hours;
    if (earned) metrics.earned += hours;
  };

  state.attendance.forEach((record) => {
    if (!targetStudentIds.has(record.studentId)) return;
    const key = `${record.studentId}||${record.date}`;
    if (!attendanceByStudentDate.has(key)) {
      attendanceByStudentDate.set(key, !!record.present);
      return;
    }
    const existingPresent = attendanceByStudentDate.get(key);
    if (existingPresent && !record.present) {
      attendanceByStudentDate.set(key, false);
    }
  });

  const cursor = new Date(yearStart);
  while (cursor <= yearEnd) {
    const dateKey = toISO(cursor);
    const blocksByStudent = dailyScheduledBlocks(dateKey, Array.from(targetStudentIds));
    Array.from(blocksByStudent.values()).flat().forEach((block) => {
      if (block.type !== "instruction" || !targetStudentIds.has(block.studentId)) return;
      if (!instructionMatchesInstructorFilter(block.studentId, block.courseId, dateKey, instructorId)) return;
      const course = getCourse(block.courseId);
      if (!course) return;
      const hours = Number(block.actualMinutes || 0) / 60;
      if (!(hours > 0)) return;

      const studentSummary = ensureStudentSummary(block.studentId);
      const subjectSummary = ensureSubjectSummary(studentSummary, course.subjectId || "__unknown_subject__");
      const earned = dateKey <= todayKey && attendanceByStudentDate.get(`${block.studentId}||${dateKey}`) === true;

      addHours(studentSummary.buckets.total, hours, earned);
      addHours(subjectSummary.buckets.total, hours, earned);
      buckets.slice(1).forEach((bucket) => {
        if (!bucket.startDate || !bucket.endDate) return;
        if (!inRange(dateKey, bucket.startDate, bucket.endDate)) return;
        addHours(studentSummary.buckets[bucket.key], hours, earned);
        addHours(subjectSummary.buckets[bucket.key], hours, earned);
      });
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return { buckets, summaryByStudent };
}

function dateDiffDays(a, b){ return Math.floor((b - a) / (1000 * 60 * 60 * 24)); }
function progress(startDate, endDate, ref = new Date()) {
  const s = toDate(startDate), e = toDate(endDate);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return 0;
  if (ref < s) return 0;
  if (ref > e) return 100;
  return clamp(((dateDiffDays(s, ref) + 1) / (dateDiffDays(s, e) + 1)) * 100, 0, 100);
}

function currentQuarter(ref = new Date()) {
  const q = [...state.settings.quarters]
    .map((quarter) => ({ quarter, start: toDate(quarter.startDate), end: toDate(quarter.endDate) }))
    .filter((entry) => !Number.isNaN(entry.start.getTime()) && !Number.isNaN(entry.end.getTime()))
    .sort((a, b) => a.start - b.start);

  for (let i=0;i<q.length;i+=1) {
    if (ref >= q[i].start && ref <= q[i].end) return q[i].quarter;
  }
  for (let i=0;i<q.length;i+=1) {
    if (ref < q[i].start) return q[i].quarter;
  }
  return q.length ? q[q.length - 1].quarter : null;
}

function parseTimeToMinutes(value) {
  const match = String(value || "").match(/^(\d{2}):(\d{2})$/);
  if (!match) return NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return NaN;
  return (hours * 60) + minutes;
}

function formatClockTime(value) {
  const minutes = typeof value === "number" ? value : parseTimeToMinutes(value);
  if (!Number.isFinite(minutes)) return "";
  const h24 = Math.floor(minutes / 60);
  const mins = minutes % 60;
  const ampm = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mins).padStart(2, "0")} ${ampm}`;
}

function dailyBreakLabel(entry) {
  if (!entry) return "Break";
  if (entry.type === "lunch") return "Lunch Break";
  if (entry.type === "recess") return "Recess";
  return entry.description || "Other Break";
}

function getSelectedDailyBreakStudentIds() {
  const selectedIds = Array.from(document.querySelectorAll(".daily-break-student-checkbox:checked")).map((el) => el.value);
  if (selectedIds.length) return selectedIds;

  const allToggle = document.querySelector(".daily-break-student-all-checkbox");
  if (allToggle instanceof HTMLInputElement && allToggle.checked) {
    return Array.from(document.querySelectorAll(".daily-break-student-checkbox"))
      .map((el) => (el instanceof HTMLInputElement ? el.value : ""))
      .filter(Boolean);
  }

  return [];
}

function normalizeDailyBreakStartTime(value) {
  const raw = String(value || "").trim();
  if (/^\d{2}:\d{2}$/.test(raw)) return raw;

  const twelveHourMatch = raw.match(/^(\d{1,2}):(\d{2})\s*([AP]M)$/i);
  if (!twelveHourMatch) return "";

  let hours = Number(twelveHourMatch[1]);
  const minutes = Number(twelveHourMatch[2]);
  const meridiem = twelveHourMatch[3].toUpperCase();
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
    return "";
  }
  if (meridiem === "AM") {
    hours = hours === 12 ? 0 : hours;
  } else {
    hours = hours === 12 ? 12 : hours + 12;
  }
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function updateDailyBreakStudentSummary() {
  const summary = document.getElementById("daily-break-student-summary");
  if (!summary) return;
  const selectedCount = getSelectedDailyBreakStudentIds().length;
  const totalCount = document.querySelectorAll(".daily-break-student-checkbox").length;
  summary.textContent = selectedCount && selectedCount === totalCount
    ? "Students (All)"
    : `Students (${selectedCount} selected)`;
}

function renderDailyBreakStudentChecklist(preselectedStudentIds = []) {
  const optionsWrap = document.getElementById("daily-break-student-options");
  if (!optionsWrap) return;
  const students = state.students.slice().sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));
  const selected = new Set(preselectedStudentIds.filter((studentId) => students.some((student) => student.id === studentId)));
  const allChecked = students.length > 0 && students.every((student) => selected.has(student.id));
  const allRow = students.length ? `<div class="checklist-row"><input id="daily-break-student-all" type="checkbox" class="daily-break-student-all-checkbox"${allChecked ? " checked" : ""}><label for="daily-break-student-all">All</label></div>` : "";
  const checkboxes = students.map((student, idx) => {
    const checked = selected.has(student.id) ? " checked" : "";
    const inputId = `daily-break-student-${idx}-${student.id}`;
    return `<div class="checklist-row"><input id="${inputId}" type="checkbox" class="daily-break-student-checkbox" value="${student.id}"${checked}><label for="${inputId}">${student.firstName} ${student.lastName}</label></div>`;
  }).join("");
  optionsWrap.innerHTML = students.length ? `${allRow}${checkboxes}` : "<span>No students available.</span>";
  syncCalendarAllCheckbox("daily-break-student-checkbox", "daily-break-student-all-checkbox");
  updateDailyBreakStudentSummary();
}

function updateDailyBreakFormMode() {
  const typeSelect = document.getElementById("daily-break-type");
  const descriptionWrap = document.getElementById("daily-break-description-wrap");
  const descriptionInput = document.getElementById("daily-break-description");
  if (!typeSelect || !descriptionWrap || !descriptionInput) return;
  const requiresDescription = typeSelect.value === "other";
  descriptionWrap.classList.toggle("hidden", !requiresDescription);
  descriptionInput.required = requiresDescription;
  if (!requiresDescription) descriptionInput.value = "";
}

function resetDailyBreakForm() {
  const form = document.getElementById("daily-break-form");
  if (!form) return;
  form.reset();
  const startTimeInput = document.getElementById("daily-break-start-time");
  const durationInput = document.getElementById("daily-break-duration");
  const typeSelect = document.getElementById("daily-break-type");
  if (typeSelect) typeSelect.value = "lunch";
  if (startTimeInput) startTimeInput.value = "12:00";
  if (durationInput) durationInput.value = "60";
  document.querySelectorAll("input[name='daily-break-weekday']").forEach((checkbox) => {
    if (!(checkbox instanceof HTMLInputElement)) return;
    checkbox.checked = Number(checkbox.value) >= 1 && Number(checkbox.value) <= 5;
  });
  renderDailyBreakStudentChecklist([]);
  updateDailyBreakFormMode();
}

function holidaySet() {
  const set = new Set();
  state.settings.holidays.forEach((h) => {
    const s = toDate(h.startDate), e = toDate(h.endDate);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return;
    const c = new Date(s);
    while (c <= e) { set.add(toISO(c)); c.setDate(c.getDate() + 1); }
  });
  return set;
}

function holidaySetByRange(startDate, endDate) {
  const set = new Set();
  (state.settings.holidays || []).forEach((holiday) => {
    const start = toDate(holiday.startDate);
    const end = toDate(holiday.endDate);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return;
    const effectiveStart = start > toDate(startDate) ? new Date(start) : toDate(startDate);
    const effectiveEnd = end < toDate(endDate) ? new Date(end) : toDate(endDate);
    if (Number.isNaN(effectiveStart.getTime()) || Number.isNaN(effectiveEnd.getTime()) || effectiveEnd < effectiveStart) return;
    const cursor = new Date(effectiveStart);
    while (cursor <= effectiveEnd) {
      set.add(toISO(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  });
  return set;
}

function instructionalDates() {
  const s = toDate(state.settings.schoolYear.startDate), e = toDate(state.settings.schoolYear.endDate);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return [];
  const exclude = holidaySet();
  const out = []; const c = new Date(s);
  while (c <= e) {
    const wk = c.getDay(); const key = toISO(c);
    if (wk >= 1 && wk <= 5 && !exclude.has(key)) out.push(key);
    c.setDate(c.getDate() + 1);
  }
  return out;
}

function instructionalDaysCountForRange(startDate, endDate) {
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  const excluded = holidaySetByRange(startDate, endDate);
  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const weekday = cursor.getDay();
    const key = toISO(cursor);
    if (weekday >= 1 && weekday <= 5 && !excluded.has(key)) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

function options(selectId, items, textFn, placeholder) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = "";
  if (placeholder !== undefined && placeholder !== null) {
    const o = document.createElement("option"); o.value = ""; o.textContent = placeholder; sel.appendChild(o);
  }
  items.forEach((item) => { const o = document.createElement("option"); o.value = item.id; o.textContent = textFn(item); sel.appendChild(o); });
  if (cur && Array.from(sel.options).some((o) => o.value === cur)) sel.value = cur;
}

function renderSelects() {
  const selectedPlanCourseIds = getSelectedPlanCourseIds();
  const selectedStudentEnrollmentCourseIds = getSelectedStudentEnrollmentCourseIds();
  const viewerStudents = visibleStudents();
  options("course-subject", state.subjects, (s) => s.name, state.subjects.length ? null : "Add a subject first");
  options("course-instructor", [{ id: "", firstName: "Unassigned", lastName: "" }, ...state.instructors], (instructor) => instructor.id ? `${instructor.firstName} ${instructor.lastName}` : "Unassigned");
  options("test-subject", state.subjects, (s) => s.name, state.subjects.length ? null : "Add a subject first");
  options("test-course", state.courses, (c) => `${c.name} (${getSubjectName(c.subjectId)})`, state.courses.length ? null : "Add a course first");
  options("plan-student", viewerStudents, (s) => `${s.firstName} ${s.lastName}`, viewerStudents.length ? null : "Add a student first");
  options("test-student", viewerStudents, (s) => `${s.firstName} ${s.lastName}`, viewerStudents.length ? null : "Add a student first");
  options("user-student-id", state.students, (s) => `${s.firstName} ${s.lastName}`, "Select student");
  renderStudentEnrollmentCourseChecklist(selectedStudentEnrollmentCourseIds, selectedStudentId);
  renderDailyBreakStudentChecklist(getSelectedDailyBreakStudentIds());
  renderAttendanceStudentChecklist();
  renderReportStudentChecklist(Array.from(reportSelectedStudentIds));
  renderReportContentChecklist(Array.from(reportSelectedContentIds));
  renderStudentPerformanceGradeMethodChecklist(Array.from(studentPerformanceSelectedGradeMethods));
  renderTrendStudentChecklist(Array.from(trendSelectedStudentIds));
  renderGpaTrendStudentChecklist(Array.from(gpaTrendSelectedStudentIds));
  renderInstructionHoursTrendStudentChecklist(Array.from(instructionHoursTrendSelectedStudentIds));
  renderVolumeStudentChecklist(Array.from(volumeSelectedStudentIds));
  renderWorkStudentChecklist(Array.from(workSelectedStudentIds));

  const attendanceFilterStudent = document.getElementById("attendance-filter-student");
  if (attendanceFilterStudent) {
    const current = attendanceFilterStudent.value || "all";
    attendanceFilterStudent.innerHTML = "<option value='all'>All Students</option>";
    viewerStudents.forEach((s) => {
      const option = document.createElement("option");
      option.value = s.id;
      option.textContent = `${s.firstName} ${s.lastName}`;
      attendanceFilterStudent.appendChild(option);
    });
    if (Array.from(attendanceFilterStudent.options).some((o) => o.value === current)) attendanceFilterStudent.value = current;
  }

  const attendanceFilterQuarter = document.getElementById("attendance-filter-quarter");
  if (attendanceFilterQuarter) {
    const current = attendanceFilterQuarter.value || "all";
    attendanceFilterQuarter.innerHTML = "<option value='all'>All Quarters</option>";
    state.settings.quarters.forEach((q) => {
      const option = document.createElement("option");
      option.value = q.name;
      option.textContent = q.name;
      attendanceFilterQuarter.appendChild(option);
    });
    if (Array.from(attendanceFilterQuarter.options).some((o) => o.value === current)) attendanceFilterQuarter.value = current;
  }

  const detailQuarterFilter = document.getElementById("student-detail-quarter-filter");
  if (detailQuarterFilter) {
    const current = detailQuarterFilter.value || "all";
    detailQuarterFilter.innerHTML = "<option value='all'>All Quarters</option>";
    state.settings.quarters.forEach((q) => {
      const option = document.createElement("option");
      option.value = q.name;
      option.textContent = q.name;
      detailQuarterFilter.appendChild(option);
    });
    if (Array.from(detailQuarterFilter.options).some((o) => o.value === current)) detailQuarterFilter.value = current;
  }

  const quarterSchoolYear = document.getElementById("quarter-school-year");
  if (quarterSchoolYear) {
    const current = quarterSchoolYear.value || state.settings.currentSchoolYearId;
    quarterSchoolYear.innerHTML = "";
    state.settings.schoolYears.forEach((year) => {
      const option = document.createElement("option");
      option.value = year.id;
      option.textContent = year.label;
      quarterSchoolYear.appendChild(option);
    });
    if (Array.from(quarterSchoolYear.options).some((o) => o.value === current)) quarterSchoolYear.value = current;
    else if (state.settings.currentSchoolYearId) quarterSchoolYear.value = state.settings.currentSchoolYearId;
  }

  const reportsSchoolYear = document.getElementById("reports-school-year");
  if (reportsSchoolYear) {
    const current = reportsSchoolYear.value || state.settings.currentSchoolYearId;
    reportsSchoolYear.innerHTML = "<option value=''>Select school year</option>";
    state.settings.schoolYears
      .slice()
      .sort((a, b) => toDate(a.startDate) - toDate(b.startDate))
      .forEach((year) => {
        const option = document.createElement("option");
        option.value = year.id;
        option.textContent = year.label;
        reportsSchoolYear.appendChild(option);
      });
    if (Array.from(reportsSchoolYear.options).some((o) => o.value === current)) reportsSchoolYear.value = current;
  }
  [
    "trend-filter-instructor",
    "gpa-trend-filter-instructor",
    "instruction-hours-trend-filter-instructor",
    "volume-filter-instructor",
    "work-filter-instructor",
    "grades-filter-instructor",
    "reports-instructor"
  ].forEach((selectId) => populateInstructorFilterSelect(selectId));
  syncReportsQuarterOptions();

  const planFilterStudent = document.getElementById("plan-filter-student");
  if (planFilterStudent) {
    const current = planFilterStudent.value || "all";
    planFilterStudent.innerHTML = "<option value='all'>All Students</option>";
    viewerStudents.forEach((student) => {
      const option = document.createElement("option");
      option.value = student.id;
      option.textContent = `${student.firstName} ${student.lastName}`;
      planFilterStudent.appendChild(option);
    });
    if (Array.from(planFilterStudent.options).some((o) => o.value === current)) planFilterStudent.value = current;
  }

  syncCalendarFilterSubjectCourseOptions();

  const gradeStudentSelect = document.getElementById("grades-filter-student");
  if (gradeStudentSelect) {
    const current = gradeStudentSelect.value || "all";
    gradeStudentSelect.innerHTML = "<option value='all'>All Students</option>";
    viewerStudents.forEach((s) => {
      const option = document.createElement("option");
      option.value = s.id;
      option.textContent = `${s.firstName} ${s.lastName}`;
      gradeStudentSelect.appendChild(option);
    });
    if (Array.from(gradeStudentSelect.options).some((o) => o.value === current)) gradeStudentSelect.value = current;
  }
  const quarterSelect = document.getElementById("grades-filter-quarter");
  if (quarterSelect) {
    const current = quarterSelect.value;
    quarterSelect.innerHTML = "<option value='all'>All Quarters</option>";
    state.settings.quarters.forEach((q) => {
      const option = document.createElement("option");
      option.value = q.name;
      option.textContent = q.name;
      quarterSelect.appendChild(option);
    });
    if (current && Array.from(quarterSelect.options).some((o) => o.value === current)) quarterSelect.value = current;
  }

  const schoolYearSelect = document.getElementById("grades-filter-school-year");
  if (schoolYearSelect) {
    const current = schoolYearSelect.value;
    schoolYearSelect.innerHTML = "<option value='all'>All School Years</option>";
    const option = document.createElement("option");
    option.value = "current";
    option.textContent = `Current (${state.settings.schoolYear.label})`;
    schoolYearSelect.appendChild(option);
    const yearSet = new Set(state.tests.map((t) => String(t.date).slice(0, 4)));
    Array.from(yearSet).sort().forEach((year) => {
      if (!year) return;
      const yearOption = document.createElement("option");
      yearOption.value = year;
      yearOption.textContent = year;
      schoolYearSelect.appendChild(yearOption);
    });
    if (current && Array.from(schoolYearSelect.options).some((o) => o.value === current)) schoolYearSelect.value = current;
  }

  const gradesGradeTypeSelect = document.getElementById("grades-filter-grade-type");
  if (gradesGradeTypeSelect) {
    const current = gradesGradeTypeSelect.value || "all";
    gradesGradeTypeSelect.innerHTML = "<option value='all'>All Grade Types</option>";
    availableGradeTypes().forEach((type) => {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = type;
      gradesGradeTypeSelect.appendChild(option);
    });
    if (Array.from(gradesGradeTypeSelect.options).some((o) => o.value === current)) gradesGradeTypeSelect.value = current;
  }

  const trendQuarterSelect = document.getElementById("trend-filter-quarter");
  if (trendQuarterSelect) {
    const current = trendQuarterSelect.value || "all";
    trendQuarterSelect.innerHTML = "<option value='all'>All Quarters</option>";
    state.settings.quarters.forEach((q) => {
      const option = document.createElement("option");
      option.value = q.name;
      option.textContent = q.name;
      trendQuarterSelect.appendChild(option);
    });
    if (Array.from(trendQuarterSelect.options).some((o) => o.value === current)) trendQuarterSelect.value = current;
  }

  const trendSubjectSelect = document.getElementById("trend-filter-subject");
  if (trendSubjectSelect) {
    const current = trendSubjectSelect.value || "all";
    trendSubjectSelect.innerHTML = "<option value='all'>All Subjects</option>";
    state.subjects.forEach((subject) => {
      const option = document.createElement("option");
      option.value = subject.id;
      option.textContent = subject.name;
      trendSubjectSelect.appendChild(option);
    });
    if (Array.from(trendSubjectSelect.options).some((o) => o.value === current)) trendSubjectSelect.value = current;
  }

  const trendGradeTypeSelect = document.getElementById("trend-filter-grade-type");
  if (trendGradeTypeSelect) {
    const current = trendGradeTypeSelect.value || "all";
    trendGradeTypeSelect.innerHTML = "<option value='all'>All Grade Types</option>";
    availableGradeTypes().forEach((type) => {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = type;
      trendGradeTypeSelect.appendChild(option);
    });
    if (Array.from(trendGradeTypeSelect.options).some((o) => o.value === current)) trendGradeTypeSelect.value = current;
  }

  const gpaTrendQuarterSelect = document.getElementById("gpa-trend-filter-quarter");
  if (gpaTrendQuarterSelect) {
    const current = gpaTrendQuarterSelect.value || "all";
    gpaTrendQuarterSelect.innerHTML = "<option value='all'>All Quarters</option>";
    state.settings.quarters.forEach((q) => {
      const option = document.createElement("option");
      option.value = q.name;
      option.textContent = q.name;
      gpaTrendQuarterSelect.appendChild(option);
    });
    if (Array.from(gpaTrendQuarterSelect.options).some((o) => o.value === current)) gpaTrendQuarterSelect.value = current;
  }

  const gpaTrendSubjectSelect = document.getElementById("gpa-trend-filter-subject");
  if (gpaTrendSubjectSelect) {
    const current = gpaTrendSubjectSelect.value || "all";
    gpaTrendSubjectSelect.innerHTML = "<option value='all'>All Subjects</option>";
    state.subjects.forEach((subject) => {
      const option = document.createElement("option");
      option.value = subject.id;
      option.textContent = subject.name;
      gpaTrendSubjectSelect.appendChild(option);
    });
    if (Array.from(gpaTrendSubjectSelect.options).some((o) => o.value === current)) gpaTrendSubjectSelect.value = current;
  }

  const gpaTrendGradeTypeSelect = document.getElementById("gpa-trend-filter-grade-type");
  if (gpaTrendGradeTypeSelect) {
    const current = gpaTrendGradeTypeSelect.value || "all";
    gpaTrendGradeTypeSelect.innerHTML = "<option value='all'>All Grade Types</option>";
    availableGradeTypes().forEach((type) => {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = type;
      gpaTrendGradeTypeSelect.appendChild(option);
    });
    if (Array.from(gpaTrendGradeTypeSelect.options).some((o) => o.value === current)) gpaTrendGradeTypeSelect.value = current;
  }

  const instructionHoursTrendQuarterSelect = document.getElementById("instruction-hours-trend-filter-quarter");
  if (instructionHoursTrendQuarterSelect) {
    const current = instructionHoursTrendQuarterSelect.value || "all";
    instructionHoursTrendQuarterSelect.innerHTML = "<option value='all'>All Quarters</option>";
    state.settings.quarters.forEach((q) => {
      const option = document.createElement("option");
      option.value = q.name;
      option.textContent = q.name;
      instructionHoursTrendQuarterSelect.appendChild(option);
    });
    if (Array.from(instructionHoursTrendQuarterSelect.options).some((o) => o.value === current)) instructionHoursTrendQuarterSelect.value = current;
  }

  const instructionHoursTrendSubjectSelect = document.getElementById("instruction-hours-trend-filter-subject");
  if (instructionHoursTrendSubjectSelect) {
    const current = instructionHoursTrendSubjectSelect.value || "all";
    instructionHoursTrendSubjectSelect.innerHTML = "<option value='all'>All Subjects</option>";
    state.subjects.forEach((subject) => {
      const option = document.createElement("option");
      option.value = subject.id;
      option.textContent = subject.name;
      instructionHoursTrendSubjectSelect.appendChild(option);
    });
    if (Array.from(instructionHoursTrendSubjectSelect.options).some((o) => o.value === current)) instructionHoursTrendSubjectSelect.value = current;
  }

  const volumeQuarterSelect = document.getElementById("volume-filter-quarter");
  if (volumeQuarterSelect) {
    const current = volumeQuarterSelect.value || "all";
    volumeQuarterSelect.innerHTML = "<option value='all'>All Quarters</option>";
    state.settings.quarters.forEach((q) => {
      const option = document.createElement("option");
      option.value = q.name;
      option.textContent = q.name;
      volumeQuarterSelect.appendChild(option);
    });
    if (Array.from(volumeQuarterSelect.options).some((o) => o.value === current)) volumeQuarterSelect.value = current;
  }

  const volumeSubjectSelect = document.getElementById("volume-filter-subject");
  if (volumeSubjectSelect) {
    const current = volumeSubjectSelect.value || "all";
    volumeSubjectSelect.innerHTML = "<option value='all'>All Subjects</option>";
    state.subjects.forEach((subject) => {
      const option = document.createElement("option");
      option.value = subject.id;
      option.textContent = subject.name;
      volumeSubjectSelect.appendChild(option);
    });
    if (Array.from(volumeSubjectSelect.options).some((o) => o.value === current)) volumeSubjectSelect.value = current;
  }

  const volumeGradeTypeSelect = document.getElementById("volume-filter-grade-type");
  if (volumeGradeTypeSelect) {
    const current = volumeGradeTypeSelect.value || "all";
    volumeGradeTypeSelect.innerHTML = "<option value='all'>All Grade Types</option>";
    availableGradeTypes().forEach((type) => {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = type;
      volumeGradeTypeSelect.appendChild(option);
    });
    if (Array.from(volumeGradeTypeSelect.options).some((o) => o.value === current)) volumeGradeTypeSelect.value = current;
  }

  const workQuarterSelect = document.getElementById("work-filter-quarter");
  if (workQuarterSelect) {
    const current = workQuarterSelect.value || "all";
    workQuarterSelect.innerHTML = "<option value='all'>All Quarters</option>";
    state.settings.quarters.forEach((q) => {
      const option = document.createElement("option");
      option.value = q.name;
      option.textContent = q.name;
      workQuarterSelect.appendChild(option);
    });
    if (Array.from(workQuarterSelect.options).some((o) => o.value === current)) workQuarterSelect.value = current;
  }

  const planStudentId = document.getElementById("plan-student")?.value || "";
  renderPlanCourseChecklist(selectedPlanCourseIds, planStudentId);

  renderPlanQuarterOptions(getSelectedPlanQuarters());

  syncGradesFilterSubjectCourseOptions();
}

function renderAttendanceStudentChecklist(preselectedStudentIds = []) {
  const container = document.getElementById("attendance-student-dropdown");
  const optionsWrap = document.getElementById("attendance-student-options");
  if (!container || !optionsWrap) return;
  const selected = new Set(preselectedStudentIds);
  const checkboxes = visibleStudents().map((s, idx) => {
    const checked = selected.has(s.id) ? " checked" : "";
    const inputId = `attendance-student-${idx}-${s.id}`;
    return `<div class="checklist-row"><input id="${inputId}" type="checkbox" class="attendance-student-checkbox" value="${s.id}"${checked}><label for="${inputId}">${s.firstName} ${s.lastName}</label></div>`;
  }).join("");
  optionsWrap.innerHTML = checkboxes || "<span>No students available.</span>";
  updateAttendanceStudentSummary();
}

function updateAttendanceStudentSummary() {
  const summary = document.getElementById("attendance-student-summary");
  if (!summary) return;
  const selectedCount = document.querySelectorAll(".attendance-student-checkbox:checked").length;
  summary.textContent = `Students (${selectedCount} selected)`;
}

function renderStudentPerformanceInstructorChecklist(preselectedInstructorIds = []) {
  const optionsWrap = document.getElementById("student-performance-instructor-options");
  if (!optionsWrap) return;
  const validIds = new Set(state.instructors.map((instructor) => instructor.id));
  const selected = new Set(preselectedInstructorIds.filter((id) => validIds.has(id)));
  const checkboxes = state.instructors
    .slice()
    .sort((a, b) => `${a.lastName}, ${a.firstName}`.localeCompare(`${b.lastName}, ${b.firstName}`))
    .map((instructor, idx) => {
      const checked = selected.has(instructor.id) ? " checked" : "";
      const inputId = `student-performance-instructor-${idx}-${instructor.id}`;
      return `<div class="checklist-row"><input id="${inputId}" type="checkbox" class="student-performance-instructor-checkbox" value="${instructor.id}"${checked}><label for="${inputId}">${instructor.firstName} ${instructor.lastName}</label></div>`;
    }).join("");
  optionsWrap.innerHTML = checkboxes || "<span>No instructors available.</span>";
  updateStudentPerformanceInstructorSummary();
}

function updateStudentPerformanceInstructorSummary() {
  const summary = document.getElementById("student-performance-instructor-summary");
  if (!summary) return;
  const selectedCount = document.querySelectorAll(".student-performance-instructor-checkbox:checked").length;
  summary.textContent = `Instructors (${selectedCount} selected)`;
}

function getSelectedStudentPerformanceInstructorIds() {
  return Array.from(document.querySelectorAll(".student-performance-instructor-checkbox:checked")).map((el) => el.value);
}

function renderStudentInstructionalHoursInstructorChecklist(preselectedInstructorIds = []) {
  const optionsWrap = document.getElementById("student-instructional-hours-instructor-options");
  if (!optionsWrap) return;
  const validIds = new Set(state.instructors.map((instructor) => instructor.id));
  const selected = new Set(preselectedInstructorIds.filter((id) => validIds.has(id)));
  const checkboxes = state.instructors
    .slice()
    .sort((a, b) => `${a.lastName}, ${a.firstName}`.localeCompare(`${b.lastName}, ${b.firstName}`))
    .map((instructor, idx) => {
      const checked = selected.has(instructor.id) ? " checked" : "";
      const inputId = `student-instructional-hours-instructor-${idx}-${instructor.id}`;
      return `<div class="checklist-row"><input id="${inputId}" type="checkbox" class="student-instructional-hours-instructor-checkbox" value="${instructor.id}"${checked}><label for="${inputId}">${instructor.firstName} ${instructor.lastName}</label></div>`;
    }).join("");
  optionsWrap.innerHTML = checkboxes || "<span>No instructors available.</span>";
  updateStudentInstructionalHoursInstructorSummary();
}

function updateStudentInstructionalHoursInstructorSummary() {
  const summary = document.getElementById("student-instructional-hours-instructor-summary");
  if (!summary) return;
  const selectedCount = document.querySelectorAll(".student-instructional-hours-instructor-checkbox:checked").length;
  summary.textContent = `Instructors (${selectedCount} selected)`;
}

function getSelectedStudentInstructionalHoursInstructorIds() {
  return Array.from(document.querySelectorAll(".student-instructional-hours-instructor-checkbox:checked")).map((el) => el.value);
}

function populateInstructorFilterSelect(selectId, allLabel = "All Instructors") {
  const select = document.getElementById(selectId);
  if (!select) return;
  const current = select.value || "all";
  select.innerHTML = `<option value="all">${escapeHtml(allLabel)}</option>`;
  state.instructors
    .slice()
    .sort((a, b) => `${a.lastName}, ${a.firstName}`.localeCompare(`${b.lastName}, ${b.firstName}`))
    .forEach((instructor) => {
      const option = document.createElement("option");
      option.value = instructor.id;
      option.textContent = `${instructor.firstName} ${instructor.lastName}`;
      select.appendChild(option);
    });
  if (Array.from(select.options).some((option) => option.value === current)) {
    select.value = current;
  }
}

function renderReportStudentChecklist(preselectedStudentIds = []) {
  const optionsWrap = document.getElementById("reports-student-options");
  if (!optionsWrap) return;
  const selected = new Set(preselectedStudentIds.filter((studentId) => visibleStudents().some((student) => student.id === studentId)));
  const checkboxes = visibleStudents().map((student, idx) => {
    const checked = selected.has(student.id) ? " checked" : "";
    const inputId = `reports-student-${idx}-${student.id}`;
    return `<div class="checklist-row"><input id="${inputId}" type="checkbox" class="reports-student-checkbox" value="${student.id}"${checked}><label for="${inputId}">${student.firstName} ${student.lastName}</label></div>`;
  }).join("");
  optionsWrap.innerHTML = checkboxes || "<span>No students available.</span>";
  updateReportStudentSummary();
}

function updateReportStudentSummary() {
  const summary = document.getElementById("reports-student-summary");
  if (!summary) return;
  const selectedCount = document.querySelectorAll(".reports-student-checkbox:checked").length;
  summary.textContent = `Students (${selectedCount} selected)`;
}

function getSelectedReportStudentIds() {
  return Array.from(document.querySelectorAll(".reports-student-checkbox:checked")).map((el) => el.value);
}

function renderReportContentChecklist(preselectedContentIds = []) {
  const optionsWrap = document.getElementById("reports-content-options");
  if (!optionsWrap) return;
  const validIds = new Set(REPORT_CONTENT_OPTIONS.map((option) => option.id));
  const selected = new Set(preselectedContentIds.filter((contentId) => validIds.has(contentId)));
  const checkboxes = REPORT_CONTENT_OPTIONS.map((option, idx) => {
    const checked = selected.has(option.id) ? " checked" : "";
    const inputId = `reports-content-${idx}-${option.id}`;
    return `<div class="checklist-row"><input id="${inputId}" type="checkbox" class="reports-content-checkbox" value="${option.id}"${checked}><label for="${inputId}">${option.label}</label></div>`;
  }).join("");
  optionsWrap.innerHTML = checkboxes;
}

function getSelectedReportContentIds() {
  return Array.from(document.querySelectorAll(".reports-content-checkbox:checked")).map((el) => el.value);
}

function setReportsMessage(kind, message) {
  const el = document.getElementById("reports-message");
  if (!el) return;
  el.className = kind ? `status-text ${kind}` : "muted";
  el.textContent = message || "";
}

function syncReportsQuarterOptions() {
  const schoolYearSelect = document.getElementById("reports-school-year");
  const quarterSelect = document.getElementById("reports-quarter");
  if (!schoolYearSelect || !quarterSelect) return;
  const selectedSchoolYearId = schoolYearSelect.value || "";
  const currentQuarter = quarterSelect.value || "all";
  quarterSelect.innerHTML = "<option value=''>Select quarter</option>";
  if (!selectedSchoolYearId) return;
  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All Quarters";
  quarterSelect.appendChild(allOption);
  state.settings.allQuarters
    .filter((quarter) => quarter.schoolYearId === selectedSchoolYearId)
    .sort((a, b) => toDate(a.startDate) - toDate(b.startDate))
    .forEach((quarter) => {
      const option = document.createElement("option");
      option.value = quarter.name;
      option.textContent = quarter.name;
      quarterSelect.appendChild(option);
    });
  if (Array.from(quarterSelect.options).some((option) => option.value === currentQuarter)) quarterSelect.value = currentQuarter;
  else quarterSelect.value = "all";
}

function reportRangeForSelection(schoolYearId, quarterName) {
  const schoolYear = getSchoolYear(schoolYearId);
  if (!schoolYear) return null;
  if (!quarterName || quarterName === "all") {
    return {
      schoolYear,
      quarter: null,
      startDate: schoolYear.startDate,
      endDate: schoolYear.endDate,
      quarterScoped: false
    };
  }
  const quarter = (state.settings.allQuarters || []).find((entry) => entry.schoolYearId === schoolYearId && entry.name === quarterName);
  if (!quarter) return null;
  return {
    schoolYear,
    quarter,
    startDate: quarter.startDate,
    endDate: quarter.endDate,
    quarterScoped: true
  };
}

function resolvedPlanRangeForSchoolYear(plan, schoolYearId, schoolYear) {
  if (!plan) return { startDate: "", endDate: "" };
  if (plan.planType === "annual") {
    return { startDate: schoolYear.startDate, endDate: schoolYear.endDate };
  }
  if (plan.planType === "quarterly" && plan.quarterName) {
    const quarter = (state.settings.allQuarters || []).find((entry) => entry.schoolYearId === schoolYearId && entry.name === plan.quarterName);
    if (quarter) return { startDate: quarter.startDate, endDate: quarter.endDate };
  }
  return { startDate: plan.startDate, endDate: plan.endDate };
}

function instructionalDatesByRangeForSchoolYear(schoolYear, startDate, endDate) {
  if (!schoolYear) return [];
  const effectiveStart = startDate > schoolYear.startDate ? startDate : schoolYear.startDate;
  const effectiveEnd = endDate < schoolYear.endDate ? endDate : schoolYear.endDate;
  if (!effectiveStart || !effectiveEnd || effectiveEnd < effectiveStart) return [];
  const excluded = holidaySetByRange(effectiveStart, effectiveEnd);
  const dates = [];
  const cursor = toDate(effectiveStart);
  const end = toDate(effectiveEnd);
  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || end < cursor) return [];
  while (cursor <= end) {
    const weekday = cursor.getDay();
    const key = toISO(cursor);
    if (weekday >= 1 && weekday <= 5 && !excluded.has(key)) dates.push(key);
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
}

function reportInstructionalHoursByStudent(studentIds, schoolYearId, range, options = {}) {
  const schoolYear = getSchoolYear(schoolYearId);
  const instructorId = options.instructorId || "all";
  const results = new Map(studentIds.map((studentId) => [studentId, { earned: 0, projected: 0 }]));
  if (!schoolYear) return results;
  const reportDates = instructionalDatesByRangeForSchoolYear(schoolYear, range.startDate, range.endDate);
  const reportDateSet = new Set(reportDates);
  const today = todayISO();
  const attendanceByStudentDate = new Map();
  state.attendance.forEach((record) => {
    if (!studentIds.includes(record.studentId) || !reportDateSet.has(record.date)) return;
    const key = `${record.studentId}||${record.date}`;
    if (!attendanceByStudentDate.has(key)) attendanceByStudentDate.set(key, !!record.present);
    else if (attendanceByStudentDate.get(key) && !record.present) attendanceByStudentDate.set(key, false);
  });

  reportDates.forEach((dateKey) => {
    const blocksByStudent = dailyScheduledBlocks(dateKey, studentIds);
    Array.from(blocksByStudent.values()).flat().forEach((block) => {
      if (block.type !== "instruction" || !studentIds.includes(block.studentId)) return;
      if (!instructionMatchesInstructorFilter(block.studentId, block.courseId, dateKey, instructorId)) return;
      const metrics = results.get(block.studentId);
      if (!metrics) return;
      const hours = Number(block.actualMinutes || 0) / 60;
      if (!(hours > 0)) return;
      metrics.projected += hours;
      if (dateKey <= today && attendanceByStudentDate.get(`${block.studentId}||${dateKey}`) === true) {
        metrics.earned += hours;
      }
    });
  });
  return results;
}

function reportInstructionalHourRows(studentIds, range, options = {}) {
  const schoolYear = getSchoolYear(range.schoolYear.id);
  const instructorId = options.instructorId || "all";
  if (!schoolYear) return [];
  const reportDates = instructionalDatesByRangeForSchoolYear(schoolYear, range.startDate, range.endDate);
  const reportDateSet = new Set(reportDates);
  const today = todayISO();
  const attendanceByStudentDate = new Map();
  state.attendance.forEach((record) => {
    if (!studentIds.includes(record.studentId) || !reportDateSet.has(record.date)) return;
    const key = `${record.studentId}||${record.date}`;
    if (!attendanceByStudentDate.has(key)) attendanceByStudentDate.set(key, !!record.present);
    else if (attendanceByStudentDate.get(key) && !record.present) attendanceByStudentDate.set(key, false);
  });

  const rowsByStudentCourse = new Map();
  reportDates.forEach((dateKey) => {
    const blocksByStudent = dailyScheduledBlocks(dateKey, studentIds);
    Array.from(blocksByStudent.values()).flat().forEach((block) => {
      if (block.type !== "instruction" || !studentIds.includes(block.studentId)) return;
      if (!instructionMatchesInstructorFilter(block.studentId, block.courseId, dateKey, instructorId)) return;
      if (!(dateKey <= today && attendanceByStudentDate.get(`${block.studentId}||${dateKey}`) === true)) return;
      const key = `${block.studentId}||${block.courseId}`;
      if (!rowsByStudentCourse.has(key)) {
        rowsByStudentCourse.set(key, {
          student: getStudentName(block.studentId),
          course: getCourseName(block.courseId),
          instructionalHours: 0
        });
      }
      rowsByStudentCourse.get(key).instructionalHours += Number(block.actualMinutes || 0) / 60;
    });
  });

  return Array.from(rowsByStudentCourse.values()).sort((a, b) =>
    a.student.localeCompare(b.student)
    || a.course.localeCompare(b.course));
}

function reportInstructionalDaysCompleted(startDate, endDate) {
  const effectiveEnd = endDate < todayISO() ? endDate : todayISO();
  if (!startDate || !endDate || effectiveEnd < startDate) return 0;
  const schoolYear = state.settings.schoolYears.find((year) => startDate >= year.startDate && endDate <= year.endDate) || null;
  return schoolYear
    ? instructionalDatesByRangeForSchoolYear(schoolYear, startDate, effectiveEnd).length
    : instructionalDatesByRange(startDate, effectiveEnd).length;
}

function reportSummaryRows(studentIds, range, options = {}) {
  const instructorId = options.instructorId || "all";
  const instructionalHoursByStudent = reportInstructionalHoursByStudent(studentIds, range.schoolYear.id, range, { instructorId });
  return studentIds.map((studentId) => {
    const student = state.students.find((entry) => entry.id === studentId);
    const filteredTests = state.tests.filter((test) =>
      test.studentId === studentId
      && testMatchesInstructorFilter(test, instructorId)
      && inRange(test.date, range.startDate, range.endDate));
    const averageScore = weightedAverageForTests(filteredTests, { quarterScoped: range.quarterScoped });
    const attendanceSummary = studentAttendanceSummaryByRange(studentId, range.startDate, range.endDate);
    const instructionalHoursSummary = instructionalHoursByStudent.get(studentId) || { earned: 0, projected: 0 };
    return {
      studentName: student ? `${student.firstName} ${student.lastName}` : "Unknown Student",
      gradeCount: filteredTests.length,
      averageScore,
      letterGrade: filteredTests.length ? scoreToLetterGrade(averageScore) : "",
      gpa: filteredTests.length ? averageToGpa(averageScore) : 0,
      attended: attendanceSummary.attended,
      absent: attendanceSummary.absent,
      instructionalDaysCompleted: reportInstructionalDaysCompleted(range.startDate, range.endDate),
      instructionalHoursCompleted: instructionalHoursSummary.earned
    };
  });
}

function reportStudentCourseSummaryRows(studentIds, range, options = {}) {
  const instructorId = options.instructorId || "all";
  const studentOrder = new Map(studentIds.map((studentId, index) => [studentId, index]));
  const rows = [];
  studentIds.forEach((studentId) => {
    const tests = state.tests.filter((test) =>
      test.studentId === studentId
      && testMatchesInstructorFilter(test, instructorId)
      && inRange(test.date, range.startDate, range.endDate));
    const courseMap = new Map();
    tests.forEach((test) => {
      const courseId = test.courseId || "__unknown_course__";
      if (!courseMap.has(courseId)) courseMap.set(courseId, []);
      courseMap.get(courseId).push(test);
    });
    Array.from(courseMap.entries()).forEach(([courseId, courseTests]) => {
      const averageScore = weightedAverageForTests(courseTests, { quarterScoped: range.quarterScoped });
      rows.push({
        studentId,
        student: getStudentName(studentId),
        course: courseId === "__unknown_course__" ? "Unknown Course" : getCourseName(courseId),
        averageScore,
        letterGrade: courseTests.length ? scoreToLetterGrade(averageScore) : "",
        gpa: courseTests.length ? averageToGpa(averageScore) : 0,
        count: courseTests.length
      });
    });
  });
  return rows.sort((a, b) =>
    (studentOrder.get(a.studentId) ?? Number.MAX_SAFE_INTEGER) - (studentOrder.get(b.studentId) ?? Number.MAX_SAFE_INTEGER)
    || a.course.localeCompare(b.course));
}

function reportGradeRows(studentIds, range, options = {}) {
  const instructorId = options.instructorId || "all";
  const studentOrder = new Map(studentIds.map((studentId, index) => [studentId, index]));
  return state.tests
    .filter((test) =>
      studentIds.includes(test.studentId)
      && testMatchesInstructorFilter(test, instructorId)
      && inRange(test.date, range.startDate, range.endDate))
    .sort((a, b) =>
      (studentOrder.get(a.studentId) ?? Number.MAX_SAFE_INTEGER) - (studentOrder.get(b.studentId) ?? Number.MAX_SAFE_INTEGER)
      || a.date.localeCompare(b.date)
      || getSubjectName(a.subjectId).localeCompare(getSubjectName(b.subjectId))
      || getCourseName(a.courseId).localeCompare(getCourseName(b.courseId))
      || gradeTypeName(a).localeCompare(gradeTypeName(b)))
    .map((test) => ({
      student: getStudentName(test.studentId),
      subject: getSubjectName(test.subjectId),
      course: getCourseName(test.courseId),
      date: test.date,
      gradeType: gradeTypeName(test),
      grade: `${pct(test.score, test.maxScore).toFixed(1)}%`
    }));
}

function reportAttendanceRows(studentIds, range) {
  const studentOrder = new Map(studentIds.map((studentId, index) => [studentId, index]));
  return state.attendance
    .filter((record) => studentIds.includes(record.studentId) && inRange(record.date, range.startDate, range.endDate))
    .sort((a, b) =>
      (studentOrder.get(a.studentId) ?? Number.MAX_SAFE_INTEGER) - (studentOrder.get(b.studentId) ?? Number.MAX_SAFE_INTEGER)
      || a.date.localeCompare(b.date)
      || Number(a.present) - Number(b.present))
    .map((record) => ({
      student: getStudentName(record.studentId),
      date: record.date,
      attendance: record.present ? "Present" : "Absent"
    }));
}

function buildPrintableReportHtml({ studentIds, range, instructorId = "all" }) {
  const titlePeriod = range.quarter ? `${range.schoolYear.label} | ${range.quarter.name}` : `${range.schoolYear.label} | All Quarters`;
  const selectedStudentsLabel = studentIds.map((studentId) => getStudentName(studentId)).join(", ");
  const selectedInstructorLabel = instructorId === "all" ? "All Instructors" : getInstructorName(instructorId);
  const selectedContentIds = Array.from(reportSelectedContentIds);
  const configuredWeights = configuredGradeTypes();
  const summaryRows = reportSummaryRows(studentIds, range, { instructorId });
  const studentCourseSummaryRows = reportStudentCourseSummaryRows(studentIds, range, { instructorId });
  const gradeRows = reportGradeRows(studentIds, range, { instructorId });
  const attendanceRows = reportAttendanceRows(studentIds, range);
  const instructionalHourRows = reportInstructionalHourRows(studentIds, range, { instructorId });
  const summaryTableRows = summaryRows.length
    ? summaryRows.map((row) => `<tr><td>${escapeHtml(row.studentName)}</td><td>${row.gradeCount ? `${row.averageScore.toFixed(1)}%` : "No grades"}</td><td>${escapeHtml(row.letterGrade || "-")}</td><td>${row.gradeCount ? row.gpa.toFixed(2) : "-"}</td><td>${row.attended}</td><td>${row.absent}</td><td>${row.instructionalDaysCompleted}</td><td>${row.instructionalHoursCompleted.toFixed(1)}</td></tr>`).join("")
    : "<tr><td colspan='8'>No student summary data found for the selected filters.</td></tr>";
  const gradeTableRows = gradeRows.length
    ? gradeRows.map((row) => `<tr><td>${escapeHtml(row.student)}</td><td>${escapeHtml(row.subject)}</td><td>${escapeHtml(row.course)}</td><td>${row.date}</td><td>${escapeHtml(row.gradeType)}</td><td>${escapeHtml(row.grade)}</td></tr>`).join("")
    : "<tr><td colspan='6'>No grade records found for the selected filters.</td></tr>";
  const studentCourseSummarySections = studentCourseSummaryRows.length
    ? (() => {
      const groupedRows = new Map();
      studentCourseSummaryRows.forEach((row) => {
        if (!groupedRows.has(row.student)) groupedRows.set(row.student, []);
        groupedRows.get(row.student).push(row);
      });
      return Array.from(groupedRows.entries()).map(([student, rows]) => {
        const tableRows = rows
          .map((row) => `<tr><td>${escapeHtml(row.course)}</td><td>${row.count ? `${row.averageScore.toFixed(1)}%` : "No grades"}</td><td>${escapeHtml(row.letterGrade || "-")}</td><td>${row.count ? row.gpa.toFixed(2) : "-"}</td></tr>`)
          .join("");
        return `
          <h2>${escapeHtml(student)}</h2>
          <table class="report-table report-table-course-summary">
            <colgroup>
              <col style="width:39%">
              <col style="width:26%">
              <col style="width:23%">
              <col style="width:12%">
            </colgroup>
            <thead><tr><th>Course</th><th>Average Score</th><th>Letter Grade</th><th>GPA</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>`;
      }).join("");
    })()
    : "<p>No course summary data found for the selected filters.</p>";
  const gradeWeightingTableRows = configuredWeights.length
    ? configuredWeights.map((gradeType) => `<tr><td>${escapeHtml(gradeType.name)}</td><td>${gradeType.weight == null ? "Not set" : `${Number(gradeType.weight).toFixed(1)}%`}</td></tr>`).join("")
    : "<tr><td colspan='2'>No grade weighting configured.</td></tr>";
  const attendanceTableRows = attendanceRows.length
    ? attendanceRows.map((row) => `<tr><td>${escapeHtml(row.student)}</td><td>${row.date}</td><td>${row.attendance}</td></tr>`).join("")
    : "<tr><td colspan='3'>No attendance records found for the selected filters.</td></tr>";
  const instructionalHoursSections = instructionalHourRows.length
    ? (() => {
      const groupedRows = new Map();
      instructionalHourRows.forEach((row) => {
        if (!groupedRows.has(row.student)) groupedRows.set(row.student, []);
        groupedRows.get(row.student).push(row);
      });
      return Array.from(groupedRows.entries()).map(([student, rows]) => {
        const studentTotal = rows.reduce((sum, row) => sum + row.instructionalHours, 0);
        const tableRows = rows
          .map((row) => `<tr><td>${escapeHtml(row.course)}</td><td>${row.instructionalHours.toFixed(1)}</td></tr>`)
          .join("");
        return `
          <h2>${escapeHtml(student)}</h2>
          <table class="report-table report-table-instruction-hours">
            <colgroup>
              <col style="width:74%">
              <col style="width:26%">
            </colgroup>
            <thead><tr><th>Course</th><th>Instructional Hours</th></tr></thead>
            <tbody>${tableRows}</tbody>
          </table>
          <p class="report-meta"><strong>${escapeHtml(student)} Total Instructional Hours:</strong> ${studentTotal.toFixed(1)}</p>`;
      }).join("");
    })()
    : "<p>No instructional hours found for the selected filters.</p>";
  const totalInstructionalHours = instructionalHourRows.reduce((sum, row) => sum + row.instructionalHours, 0);
  const pageSections = [];

  if (selectedContentIds.includes("studentSummary")) {
    pageSections.push(`
    <section class="report-page report-page-break">
      <h1>Student Summary</h1>
      <p class="report-meta">Students: ${escapeHtml(selectedStudentsLabel)}<br>Period: ${escapeHtml(titlePeriod)}<br>Instructor: ${escapeHtml(selectedInstructorLabel)}</p>
      <table>
        <thead><tr><th>Student Name</th><th>Average Scores</th><th>Letter Grade</th><th>GPA</th><th>Days Attended</th><th>Days Absent</th><th>Instructional Days Completed</th><th>Instructional Hours Completed</th></tr></thead>
        <tbody>${summaryTableRows}</tbody>
      </table>
    </section>`);
  }

  if (selectedContentIds.includes("courseSummary")) {
    pageSections.push(`
    <section class="report-page report-page-break">
      <h1>Course Summary</h1>
      <p class="report-meta">Students: ${escapeHtml(selectedStudentsLabel)}<br>Period: ${escapeHtml(titlePeriod)}<br>Instructor: ${escapeHtml(selectedInstructorLabel)}</p>
      ${studentCourseSummarySections}
    </section>`);
  }

  if (selectedContentIds.includes("detailedGrades")) {
    pageSections.push(`
    <section class="report-page report-page-break">
      <h1>Detailed Grades</h1>
      <p class="report-meta">Students: ${escapeHtml(selectedStudentsLabel)}<br>Period: ${escapeHtml(titlePeriod)}<br>Instructor: ${escapeHtml(selectedInstructorLabel)}</p>
      <table>
        <thead><tr><th>Student</th><th>Subject</th><th>Course</th><th>Date</th><th>Grade Type</th><th>Grade</th></tr></thead>
        <tbody>${gradeTableRows}</tbody>
      </table>
    </section>`);
  }

  if (selectedContentIds.includes("detailedAttendance")) {
    pageSections.push(`
    <section class="report-page report-page-break">
      <h1>Detailed Attendance</h1>
      <p class="report-meta">Students: ${escapeHtml(selectedStudentsLabel)}<br>Period: ${escapeHtml(titlePeriod)}<br>Instructor: ${escapeHtml(selectedInstructorLabel)}</p>
      <table>
        <thead><tr><th>Student</th><th>Date</th><th>Attendance</th></tr></thead>
        <tbody>${attendanceTableRows}</tbody>
      </table>
    </section>`);
  }

  if (selectedContentIds.includes("instructionalHours")) {
    pageSections.push(`
    <section class="report-page">
      <h1>Instructional Hours</h1>
      <p class="report-meta">Students: ${escapeHtml(selectedStudentsLabel)}<br>Period: ${escapeHtml(titlePeriod)}<br>Instructor: ${escapeHtml(selectedInstructorLabel)}</p>
      ${instructionalHoursSections}
      <p class="report-meta"><strong>Total Instructional Hours:</strong> ${totalInstructionalHours.toFixed(1)}</p>
    </section>`);
  }

  const gradeWeightingSection = `
      <section class="report-subsection report-subsection-grade-weighting">
        <h2>Grade Weighting</h2>
        <table>
          <thead><tr><th>Grade Type</th><th>Weight</th></tr></thead>
          <tbody>${gradeWeightingTableRows}</tbody>
        </table>
      </section>`;
  if (pageSections.length) {
    pageSections[0] = pageSections[0].replace("</section>", `${gradeWeightingSection}
    </section>`);
  }

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Student Report</title>
  <style>
    body { font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif; color: #2f1f14; margin: 0; background: #f4efe7; }
    .report-shell { max-width: 1100px; margin: 0 auto; padding: 24px; }
    .report-toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
    .report-toolbar button { border: 0; border-radius: 8px; padding: 10px 16px; background: #875422; color: #fff; font: inherit; cursor: pointer; }
    .report-page { background: #fff; border: 1px solid #d7c8ad; border-radius: 12px; padding: 24px; margin-bottom: 20px; box-shadow: 0 8px 20px rgba(24, 33, 20, 0.08); }
    .report-page.report-page-break { page-break-after: always; }
    h1 { margin: 0 0 8px; font-size: 28px; }
    h2 { margin: 20px 0 8px; font-size: 20px; }
    .report-subsection-grade-weighting { margin-top: 20px; }
    .report-meta { margin: 0 0 18px; color: #6c5847; }
    table { width: 100%; border-collapse: collapse; }
    .report-table { table-layout: fixed; }
    th, td { border: 1px solid #d9cdb7; padding: 8px 10px; text-align: left; vertical-align: top; }
    th { background: #f6f1e7; }
    @media print {
      body { background: #fff; }
      .report-shell { max-width: none; padding: 0; }
      .report-toolbar { display: none; }
      .report-page { box-shadow: none; border: 0; border-radius: 0; margin: 0; padding: 0; }
      .report-page.report-page-break { page-break-after: always; }
    }
  </style>
</head>
<body>
  <div class="report-shell">
    <div class="report-toolbar">
      <div>
        <strong>Student Report</strong><br>
        <span>${escapeHtml(titlePeriod)}</span>
      </div>
      <button type="button" onclick="window.print()">Print</button>
    </div>

    ${pageSections.join("\n")}
  </div>
</body>
</html>`;
}

function generatePrintableReport() {
  const studentIds = Array.from(reportSelectedStudentIds);
  const selectedContentIds = Array.from(reportSelectedContentIds);
  const schoolYearId = document.getElementById("reports-school-year")?.value || "";
  const quarterName = document.getElementById("reports-quarter")?.value || "";
  const instructorId = document.getElementById("reports-instructor")?.value || "all";
  if (!studentIds.length || !schoolYearId || !quarterName) {
    setReportsMessage("error", "Student, School Year, and Quarter are all required.");
    return;
  }
  if (!selectedContentIds.length) {
    setReportsMessage("error", "Select at least one Report Content option.");
    return;
  }
  const range = reportRangeForSelection(schoolYearId, quarterName);
  if (!range) {
    setReportsMessage("error", "The selected School Year or Quarter is not valid.");
    return;
  }
  const reportWindow = window.open("", "_blank");
  if (!reportWindow) {
    setReportsMessage("error", "The report could not be opened. Please allow pop-ups and try again.");
    return;
  }
  reportWindow.opener = null;
  reportWindow.document.open();
  reportWindow.document.write(buildPrintableReportHtml({ studentIds, range, instructorId }));
  reportWindow.document.close();
  setReportsMessage("success", "Report opened in a new tab.");
}

function renderTrendStudentChecklist(preselectedStudentIds = []) {
  const container = document.getElementById("trend-student-dropdown");
  const optionsWrap = document.getElementById("trend-student-options");
  if (!container || !optionsWrap) return;
  const selected = new Set(preselectedStudentIds);
  const checkboxes = visibleStudents().map((s, idx) => {
    const checked = selected.has(s.id) ? " checked" : "";
    const inputId = `trend-student-${idx}-${s.id}`;
    return `<div class="checklist-row"><input id="${inputId}" type="checkbox" class="trend-student-checkbox" value="${s.id}"${checked}><label for="${inputId}">${s.firstName} ${s.lastName}</label></div>`;
  }).join("");
  optionsWrap.innerHTML = checkboxes || "<span>No students available.</span>";
  updateTrendStudentSummary();
}

function updateTrendStudentSummary() {
  const summary = document.getElementById("trend-student-summary");
  if (!summary) return;
  const selectedCount = document.querySelectorAll(".trend-student-checkbox:checked").length;
  summary.textContent = `Students (${selectedCount} selected)`;
}

function getTrendSelectedStudentIds() {
  return Array.from(document.querySelectorAll(".trend-student-checkbox:checked")).map((el) => el.value);
}

function renderGpaTrendStudentChecklist(preselectedStudentIds = []) {
  const container = document.getElementById("gpa-trend-student-dropdown");
  const optionsWrap = document.getElementById("gpa-trend-student-options");
  if (!container || !optionsWrap) return;
  const selected = new Set(preselectedStudentIds);
  const checkboxes = visibleStudents().map((s, idx) => {
    const checked = selected.has(s.id) ? " checked" : "";
    const inputId = `gpa-trend-student-${idx}-${s.id}`;
    return `<div class="checklist-row"><input id="${inputId}" type="checkbox" class="gpa-trend-student-checkbox" value="${s.id}"${checked}><label for="${inputId}">${s.firstName} ${s.lastName}</label></div>`;
  }).join("");
  optionsWrap.innerHTML = checkboxes || "<span>No students available.</span>";
  updateGpaTrendStudentSummary();
}

function updateGpaTrendStudentSummary() {
  const summary = document.getElementById("gpa-trend-student-summary");
  if (!summary) return;
  const selectedCount = document.querySelectorAll(".gpa-trend-student-checkbox:checked").length;
  summary.textContent = `Students (${selectedCount} selected)`;
}

function getGpaTrendSelectedStudentIds() {
  return Array.from(document.querySelectorAll(".gpa-trend-student-checkbox:checked")).map((el) => el.value);
}

function renderStudentPerformanceGradeMethodChecklist(preselectedMethods = []) {
  const optionsWrap = document.getElementById("student-performance-grade-method-options");
  if (!optionsWrap) return;
  const selected = new Set(preselectedMethods.filter((method) => STUDENT_PERFORMANCE_GRADE_METHODS.includes(method)));
  optionsWrap.innerHTML = STUDENT_PERFORMANCE_GRADE_METHODS.map((method, idx) => {
    const checked = selected.has(method) ? " checked" : "";
    const inputId = `student-performance-grade-method-${idx}`;
    return `<label class="student-performance-grade-method-chip" for="${inputId}"><input id="${inputId}" type="checkbox" class="student-performance-grade-method-checkbox" value="${method}"${checked}><span>${method}</span></label>`;
  }).join("");
}

function getSelectedStudentPerformanceGradeMethods() {
  const selected = Array.from(document.querySelectorAll(".student-performance-grade-method-checkbox:checked")).map((el) => el.value);
  return selected.length ? selected : [...STUDENT_PERFORMANCE_GRADE_METHODS];
}

function renderInstructionHoursTrendStudentChecklist(preselectedStudentIds = []) {
  const container = document.getElementById("instruction-hours-trend-student-dropdown");
  const optionsWrap = document.getElementById("instruction-hours-trend-student-options");
  if (!container || !optionsWrap) return;
  const selected = new Set(preselectedStudentIds);
  const checkboxes = visibleStudents().map((s, idx) => {
    const checked = selected.has(s.id) ? " checked" : "";
    const inputId = `instruction-hours-trend-student-${idx}-${s.id}`;
    return `<div class="checklist-row"><input id="${inputId}" type="checkbox" class="instruction-hours-trend-student-checkbox" value="${s.id}"${checked}><label for="${inputId}">${s.firstName} ${s.lastName}</label></div>`;
  }).join("");
  optionsWrap.innerHTML = checkboxes || "<span>No students available.</span>";
  updateInstructionHoursTrendStudentSummary();
}

function updateInstructionHoursTrendStudentSummary() {
  const summary = document.getElementById("instruction-hours-trend-student-summary");
  if (!summary) return;
  const selectedCount = document.querySelectorAll(".instruction-hours-trend-student-checkbox:checked").length;
  summary.textContent = `Students (${selectedCount} selected)`;
}

function getInstructionHoursTrendSelectedStudentIds() {
  return Array.from(document.querySelectorAll(".instruction-hours-trend-student-checkbox:checked")).map((el) => el.value);
}

function renderVolumeStudentChecklist(preselectedStudentIds = []) {
  const container = document.getElementById("volume-student-dropdown");
  const optionsWrap = document.getElementById("volume-student-options");
  if (!container || !optionsWrap) return;
  const selected = new Set(preselectedStudentIds);
  const checkboxes = visibleStudents().map((s, idx) => {
    const checked = selected.has(s.id) ? " checked" : "";
    const inputId = `volume-student-${idx}-${s.id}`;
    return `<div class="checklist-row"><input id="${inputId}" type="checkbox" class="volume-student-checkbox" value="${s.id}"${checked}><label for="${inputId}">${s.firstName} ${s.lastName}</label></div>`;
  }).join("");
  optionsWrap.innerHTML = checkboxes || "<span>No students available.</span>";
  updateVolumeStudentSummary();
}

function updateVolumeStudentSummary() {
  const summary = document.getElementById("volume-student-summary");
  if (!summary) return;
  const selectedCount = document.querySelectorAll(".volume-student-checkbox:checked").length;
  summary.textContent = `Students (${selectedCount} selected)`;
}

function getVolumeSelectedStudentIds() {
  return Array.from(document.querySelectorAll(".volume-student-checkbox:checked")).map((el) => el.value);
}

function resolveGradeType(test) {
  const allowed = canonicalGradeTypes();
  const type = (test.gradeType || "").trim();
  if (allowed.includes(type)) return type;
  const name = String(test.testName || "").toLowerCase();
  if (name.includes("quarterly final")) return "Quarterly Final";
  if (name === "final" || /\bfinal\b/.test(name)) return "Final";
  if (name.includes("quiz")) return "Quiz";
  if (name.includes("assignment") || name.includes("homework")) return "Assignment";
  if (name.includes("test")) return "Test";
  return null;
}

function availableGradeTypes() {
  const seen = new Set();
  const out = [];
  canonicalGradeTypes().forEach((type) => {
    const key = type.toLowerCase();
    if (EXCLUDED_GRADE_TYPE_FILTER_OPTIONS.has(key)) return;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(type);
  });
  state.tests.forEach((test) => {
    const type = gradeTypeName(test);
    if (!type) return;
    const key = type.toLowerCase();
    if (EXCLUDED_GRADE_TYPE_FILTER_OPTIONS.has(key)) return;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(type);
  });
  return out;
}

function renderWorkDistributionGradeTypeFilter() {
  const host = document.getElementById("work-distribution-grade-type-filter");
  if (!host) return;
  const types = availableGradeTypes();
  if (!workDistributionGradeTypesInitialized) {
    types.forEach((type) => workDistributionSelectedGradeTypes.add(type));
    workDistributionGradeTypesInitialized = true;
  } else {
    Array.from(workDistributionSelectedGradeTypes).forEach((type) => {
      if (!types.includes(type)) workDistributionSelectedGradeTypes.delete(type);
    });
  }
  host.innerHTML = `
    <p class="work-dist-filter-title">Grade Type</p>
    <div class="work-dist-options">
      ${types.map((type, idx) => {
        const id = `work-dist-grade-type-${idx}`;
        const checked = workDistributionSelectedGradeTypes.has(type) ? " checked" : "";
        return `<label for="${id}" class="work-dist-option"><input id="${id}" type="checkbox" class="work-dist-grade-type-checkbox" value="${type}"${checked}>${type}</label>`;
      }).join("")}
    </div>`;
}

function renderWorkStudentChecklist(preselectedStudentIds = []) {
  const container = document.getElementById("work-student-dropdown");
  const optionsWrap = document.getElementById("work-student-options");
  if (!container || !optionsWrap) return;
  const selected = new Set(preselectedStudentIds);
  const checkboxes = visibleStudents().map((s, idx) => {
    const checked = selected.has(s.id) ? " checked" : "";
    const inputId = `work-student-${idx}-${s.id}`;
    return `<div class="checklist-row"><input id="${inputId}" type="checkbox" class="work-student-checkbox" value="${s.id}"${checked}><label for="${inputId}">${s.firstName} ${s.lastName}</label></div>`;
  }).join("");
  optionsWrap.innerHTML = checkboxes || "<span>No students available.</span>";
  updateWorkStudentSummary();
}

function updateWorkStudentSummary() {
  const summary = document.getElementById("work-student-summary");
  if (!summary) return;
  const selectedCount = document.querySelectorAll(".work-student-checkbox:checked").length;
  summary.textContent = `Students (${selectedCount} selected)`;
}

function getWorkSelectedStudentIds() {
  return Array.from(document.querySelectorAll(".work-student-checkbox:checked")).map((el) => el.value);
}

function getPlanEligibleCourses(studentId) {
  if (!studentId) return [];
  const enrolledCourseIds = new Set(
    state.enrollments
      .filter((e) => e.studentId === studentId)
      .map((e) => e.courseId)
  );
  return state.courses.filter((course) => enrolledCourseIds.has(course.id));
}

function getStudentEnrollmentEligibleCourses(studentId) {
  if (!studentId) return [];
  const sourceEnrollments = studentEnrollmentDraftStudentId === studentId
    ? studentEnrollmentDraft
    : state.enrollments;
  const enrolledCourseIds = new Set(
    sourceEnrollments
      .filter((entry) => entry.studentId === studentId)
      .map((entry) => entry.courseId)
  );
  return state.courses.filter((course) => !enrolledCourseIds.has(course.id));
}

function renderStudentEnrollmentCourseChecklist(preselectedCourseIds = [], studentId = "") {
  const container = document.getElementById("student-enroll-course-dropdown");
  const optionsWrap = document.getElementById("student-enroll-course-options");
  if (!container || !optionsWrap) return;
  const eligibleCourses = getStudentEnrollmentEligibleCourses(studentId);
  const eligibleIds = new Set(eligibleCourses.map((course) => course.id));
  const selected = new Set(preselectedCourseIds.filter((id) => eligibleIds.has(id)));
  const checkboxes = eligibleCourses.map((course, idx) => {
    const checked = selected.has(course.id) ? " checked" : "";
    const inputId = `student-enroll-course-${idx}-${course.id}`;
    return `<div class="checklist-row"><input id="${inputId}" type="checkbox" class="student-enroll-course-checkbox" value="${course.id}"${checked}><label for="${inputId}">${escapeHtml(course.name)} (${escapeHtml(getSubjectName(course.subjectId))})</label></div>`;
  }).join("");
  optionsWrap.innerHTML = checkboxes || `<span>${studentId ? "No additional courses available for this student." : "Select a student first."}</span>`;
  updateStudentEnrollmentCourseSummary();
}

function updateStudentEnrollmentCourseSummary() {
  const summary = document.getElementById("student-enroll-course-summary");
  if (!summary) return;
  const selectedCount = document.querySelectorAll(".student-enroll-course-checkbox:checked").length;
  summary.textContent = `Courses (${selectedCount} selected)`;
}

function getSelectedStudentEnrollmentCourseIds() {
  return Array.from(document.querySelectorAll(".student-enroll-course-checkbox:checked")).map((el) => el.value);
}

function renderPlanCourseChecklist(preselectedCourseIds = [], studentId = "") {
  const container = document.getElementById("plan-course-dropdown");
  const optionsWrap = document.getElementById("plan-course-options");
  if (!container || !optionsWrap) return;
  const eligibleCourses = getPlanEligibleCourses(studentId);
  const eligibleIds = new Set(eligibleCourses.map((course) => course.id));
  const selected = new Set(preselectedCourseIds.filter((id) => eligibleIds.has(id)));
  const checkboxes = eligibleCourses.map((course, idx) => {
    const checked = selected.has(course.id) ? " checked" : "";
    const inputId = `plan-course-${idx}-${course.id}`;
    return `<div class="checklist-row"><input id="${inputId}" type="checkbox" class="plan-course-checkbox" value="${course.id}"${checked}><label for="${inputId}">${course.name} (${getSubjectName(course.subjectId)})</label></div>`;
  }).join("");
  optionsWrap.innerHTML = checkboxes || "<span>No enrolled courses available for selected student.</span>";
  updatePlanCourseSummary();
}

function updatePlanCourseSummary() {
  const summary = document.getElementById("plan-course-summary");
  if (!summary) return;
  const selectedCount = document.querySelectorAll(".plan-course-checkbox:checked").length;
  summary.textContent = `Courses (${selectedCount} selected)`;
}

function getSelectedPlanCourseIds() {
  return Array.from(document.querySelectorAll(".plan-course-checkbox:checked")).map((el) => el.value);
}

function renderPlanQuarterOptions(preselectedQuarterNames = []) {
  const optionsWrap = document.getElementById("plan-quarter-options");
  if (!optionsWrap) return;
  const selected = new Set(preselectedQuarterNames);
  optionsWrap.innerHTML = state.settings.quarters.map((q, idx) => {
    const inputId = `plan-quarter-${idx}-${q.name}`;
    const checked = selected.has(q.name) ? " checked" : "";
    return `<div class="checklist-row"><input id="${inputId}" type="checkbox" class="plan-quarter-checkbox" value="${q.name}"${checked}><label for="${inputId}">${q.name} (${q.startDate} to ${q.endDate})</label></div>`;
  }).join("") || "<span>No quarters configured for current school year.</span>";
}

function getSelectedPlanQuarters() {
  return Array.from(document.querySelectorAll(".plan-quarter-checkbox:checked")).map((el) => el.value);
}

function updatePlanFormMode() {
  const planType = document.getElementById("plan-type")?.value || "annual";
  const startWrap = document.getElementById("plan-start-wrap");
  const endWrap = document.getElementById("plan-end-wrap");
  const quarterFieldset = document.getElementById("plan-quarter-fieldset");
  const startInput = document.getElementById("plan-start");
  const endInput = document.getElementById("plan-end");
  if (!startWrap || !endWrap || !quarterFieldset || !startInput || !endInput) return;

  if (planType === "annual") {
    startWrap.classList.remove("hidden");
    endWrap.classList.remove("hidden");
    quarterFieldset.classList.add("hidden");
    startInput.disabled = false;
    endInput.disabled = false;
    startInput.value = state.settings.schoolYear.startDate;
    endInput.value = state.settings.schoolYear.endDate;
    startInput.readOnly = true;
    endInput.readOnly = true;
  } else if (planType === "quarterly") {
    startWrap.classList.add("hidden");
    endWrap.classList.add("hidden");
    quarterFieldset.classList.remove("hidden");
    startInput.disabled = true;
    endInput.disabled = true;
    startInput.readOnly = false;
    endInput.readOnly = false;
    if (!document.querySelector(".plan-quarter-checkbox")) renderPlanQuarterOptions();
  } else {
    startWrap.classList.remove("hidden");
    endWrap.classList.remove("hidden");
    quarterFieldset.classList.add("hidden");
    startInput.disabled = false;
    endInput.disabled = false;
    startInput.readOnly = false;
    endInput.readOnly = false;
  }
}

function rowOrEmpty(tbody, html, emptyMsg, cols) {
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!html.length) { tbody.innerHTML = `<tr><td colspan='${cols}'>${emptyMsg}</td></tr>`; return; }
  tbody.innerHTML = html.join("");
}

function resetUserForm() {
  editingUserId = "";
  const form = document.getElementById("user-form");
  if (form) form.reset();
  ensureStudentSelection();
  const editorTitle = document.getElementById("user-editor-title");
  const submitBtn = document.getElementById("user-submit-btn");
  const passwordInput = document.getElementById("user-password");
  const confirmInput = document.getElementById("user-password-confirm");
  if (editorTitle) editorTitle.textContent = "New User";
  if (submitBtn) submitBtn.textContent = "Create User";
  if (passwordInput) passwordInput.required = true;
  if (confirmInput) confirmInput.required = true;
}

function renderUsersViewMode() {
  const listView = document.getElementById("users-list-view");
  const editorView = document.getElementById("users-editor-view");
  if (listView) listView.classList.toggle("hidden", userViewMode !== "list");
  if (editorView) editorView.classList.toggle("hidden", userViewMode === "list");
}

function beginUserCreate() {
  userViewMode = "create";
  resetUserForm();
  resetUserFormMessage();
  renderUsersViewMode();
}

function beginUserEdit(userId) {
  const user = state.users.find((entry) => entry.id === userId);
  if (!user) return;
  userViewMode = "edit";
  editingUserId = user.id;
  document.getElementById("user-username").value = user.username;
  document.getElementById("user-role").value = user.role;
  document.getElementById("user-student-id").value = user.studentId || "";
  document.getElementById("user-password").value = "";
  document.getElementById("user-password-confirm").value = "";
  const editorTitle = document.getElementById("user-editor-title");
  const passwordInput = document.getElementById("user-password");
  const confirmInput = document.getElementById("user-password-confirm");
  const submitBtn = document.getElementById("user-submit-btn");
  if (editorTitle) editorTitle.textContent = "Edit User";
  if (passwordInput) passwordInput.required = false;
  if (confirmInput) confirmInput.required = false;
  if (submitBtn) submitBtn.textContent = "Update User";
  ensureStudentSelection();
  resetUserFormMessage();
  renderUsersViewMode();
}

function renderUsers() {
  const tableBody = document.getElementById("user-table");
  if (!tableBody) return;
  const rows = state.users
    .slice()
    .sort((a, b) => a.username.localeCompare(b.username))
    .map((user) => {
      const linkedStudent = user.studentId ? escapeHtml(getStudentName(user.studentId)) : "Not linked";
      const roleLabel = user.role === "admin" ? "Administrator" : "Student";
      const passwordStatus = user.mustChangePassword ? "Reset required" : "Managed";
      const disableDelete = state.users.filter((entry) => entry.role === "admin").length <= 1 && user.role === "admin";
      const deleteBtn = disableDelete
        ? "<button type='button' disabled>Remove</button>"
        : `<button data-remove-user='${user.id}' type='button'>Remove</button>`;
      return `<tr><td>${escapeHtml(user.username)}</td><td>${roleLabel}</td><td>${linkedStudent}</td><td>${passwordStatus}</td><td class="users-actions-cell"><div class="table-action-row"><button data-edit-user='${user.id}' type='button'>Edit</button>${deleteBtn}</div></td></tr>`;
    });
  rowOrEmpty(tableBody, rows, "No users configured.", 5);
}

function renderStudents() {
  if (!isAdminUser()) return;
  const rows = state.students.map((s) => {
    const ageNow = calculateAge(s.birthdate);
    const overallAvg = studentOverallAverage(s.id);
    const absences = studentAbsenceCount(s.id);
    return `<tr><td>${s.firstName} ${s.lastName}</td><td>${s.grade}</td><td>${ageNow}</td><td>${overallAvg.toFixed(1)}%</td><td>${absences}</td><td class="student-table-actions"><div class="table-action-row"><button data-edit-student='${s.id}' type='button'>Edit/Enroll</button></div></td></tr>`;
  });
  rowOrEmpty(document.getElementById("student-table"), rows, "No students added yet.", 6);
}

function renderInstructors() {
  if (!isAdminUser()) return;
  const tableBody = document.getElementById("instructor-table");
  if (!tableBody) return;
  const rows = state.instructors
    .slice()
    .sort((a, b) => `${a.lastName} ${a.firstName}`.localeCompare(`${b.lastName} ${b.firstName}`))
    .map((instructor) => {
      const ageNow = calculateAge(instructor.birthdate);
      return `<tr><td>${escapeHtml(instructor.firstName)} ${escapeHtml(instructor.lastName)}</td><td>${escapeHtml(getInstructorCategoryLabel(instructor.category))}</td><td>${escapeHtml(formatDisplayDate(instructor.birthdate))}</td><td>${ageNow}</td><td><div class="table-action-row"><button data-edit-instructor="${instructor.id}" type="button">Edit</button><button data-remove-instructor="${instructor.id}" type="button">Remove</button></div></td></tr>`;
    });
  rowOrEmpty(tableBody, rows, "No instructors added yet.", 5);
}

function renderSubjects() {
  const tableBody = document.getElementById("subject-table");
  if (!tableBody) return;
  const rows = state.subjects
    .map((s) => `<tr><td>${s.name}</td><td><button data-remove-subject='${s.id}' type='button'>Remove</button></td></tr>`);
  rowOrEmpty(tableBody, rows, "No subjects added yet.", 2);
}

function renderManagementSectionVisibility() {
  const mappings = [
    { wrapId: "management-subjects-wrap", tab: "subjects" },
    { wrapId: "management-courses-wrap", tab: "courses" },
    { wrapId: "management-grade-types-wrap", tab: "grade-types" },
    { wrapId: "management-grading-criteria-wrap", tab: "grading-criteria" }
  ];
  mappings.forEach((entry) => {
    const wrap = document.getElementById(entry.wrapId);
    if (!wrap) return;
    wrap.classList.toggle("hidden", entry.tab !== currentManagementTab);
  });
  document.querySelectorAll("[data-management-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-management-tab") === currentManagementTab);
  });
}

function renderScheduleSectionVisibility() {
  const mappings = [
    { wrapId: "schedule-school-years-wrap", tab: "school-years" },
    { wrapId: "schedule-quarters-wrap", tab: "quarters" },
    { wrapId: "schedule-daily-breaks-wrap", tab: "daily-breaks" },
    { wrapId: "schedule-holidays-wrap", tab: "holidays" },
    { wrapId: "schedule-plans-wrap", tab: "plans" }
  ];
  mappings.forEach((entry) => {
    const wrap = document.getElementById(entry.wrapId);
    if (!wrap) return;
    wrap.classList.toggle("hidden", entry.tab !== currentScheduleTab);
  });
  document.querySelectorAll("[data-schedule-tab]").forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-schedule-tab") === currentScheduleTab);
  });
}

function renderCourses() {
  const tableBody = document.getElementById("course-table");
  const submitBtn = document.getElementById("course-submit-btn");
  const cancelBtn = document.getElementById("course-cancel-edit-btn");
  if (submitBtn) submitBtn.textContent = editingCourseId ? "Update Course" : "Add Course";
  if (cancelBtn) cancelBtn.classList.toggle("hidden", !editingCourseId);
  if (!tableBody) return;
  const rows = state.courses
    .map((c) => `<tr><td>${c.name}</td><td>${getSubjectName(c.subjectId)}</td><td>${escapeHtml(c.instructorId ? getInstructorName(c.instructorId) : "Unassigned")}</td><td>${Number(c.hoursPerDay).toFixed(2)}</td><td>${c.exclusiveResource ? "Yes" : "No"}</td><td><button data-edit-course='${c.id}' type='button'>Edit</button> <button data-remove-course='${c.id}' type='button'>Remove</button></td></tr>`);
  rowOrEmpty(tableBody, rows, "No courses added yet.", 6);
}

function renderGradeTypes() {
  const tableBody = document.getElementById("grade-type-table");
  const totalEl = document.getElementById("grade-type-total");
  const submitBtn = document.getElementById("grade-type-submit-btn");
  const cancelBtn = document.getElementById("grade-type-cancel-edit-btn");
  const applyBtn = document.getElementById("grade-type-apply-btn");
  const cancelChangesBtn = document.getElementById("grade-type-cancel-changes-btn");
  if (!tableBody || !totalEl) return;
  if (!gradeTypeDraftDirty) gradeTypesDraft = cloneGradeTypes(state.settings.gradeTypes);

  const rows = draftGradeTypes().map((gt) => {
    const weightText = gt.weight == null ? "Not set" : `${Number(gt.weight).toFixed(1)}%`;
    return `<tr><td>${gt.name}</td><td>${weightText}</td><td><button data-edit-grade-type="${gt.id}" type="button">Edit</button> <button data-remove-grade-type="${gt.id}" type="button">Remove</button></td></tr>`;
  });
  const totalWeight = draftGradeTypes().reduce((sum, gt) => sum + (gt.weight == null ? 0 : Number(gt.weight) || 0), 0);
  if (rows.length) rows.push(`<tr><td><strong>Total Weight</strong></td><td><strong>${totalWeight.toFixed(1)}%</strong></td><td></td></tr>`);
  rowOrEmpty(tableBody, rows, "No grade types configured.", 3);

  totalEl.textContent = totalWeight > 0 && Math.abs(totalWeight - 100) > 0.05
    ? `Configured Weight Total: ${totalWeight.toFixed(1)}% (remaining weight is distributed equally across unweighted grade types)`
    : `Configured Weight Total: ${totalWeight.toFixed(1)}%`;
  if (gradeTypeDraftDirty) totalEl.textContent = `${totalEl.textContent} - Pending changes not applied`;
  if (submitBtn) submitBtn.textContent = editingGradeTypeId ? "Update Grade Type" : "Add Grade Type";
  if (cancelBtn) cancelBtn.classList.toggle("hidden", !editingGradeTypeId);
  if (applyBtn) applyBtn.disabled = !gradeTypeDraftDirty;
  if (cancelChangesBtn) {
    cancelChangesBtn.classList.toggle("hidden", !gradeTypeDraftDirty);
    cancelChangesBtn.disabled = !gradeTypeDraftDirty;
  }
}

function setGradingCriteriaMessage(kind, message) {
  const el = document.getElementById("grading-criteria-message");
  if (!el) return;
  el.className = kind ? `status-text ${kind}` : "muted";
  el.textContent = message || "";
}

function updateGradingCriteriaFormMode() {
  const scaleSelect = document.getElementById("grading-gpa-scale");
  const otherWrap = document.getElementById("grading-gpa-other-wrap");
  const otherInput = document.getElementById("grading-gpa-other");
  if (!scaleSelect || !otherWrap || !otherInput) return;
  const isOther = scaleSelect.value === "other";
  otherWrap.classList.toggle("hidden", !isOther);
  otherInput.required = gradingCriteriaEditMode && isOther;
  if (!isOther) otherInput.value = "";
}

function renderGradingCriteria() {
  const criteria = gradingCriteriaSettings();
  LETTER_GRADE_ORDER.forEach((label) => {
    const entry = (criteria.letterScale || []).find((row) => row.label === label) || { start: null, end: null };
    const startInput = document.getElementById(`grading-scale-${label.toLowerCase()}-start`);
    const endInput = document.getElementById(`grading-scale-${label.toLowerCase()}-end`);
    if (startInput) startInput.value = entry.start == null ? "" : String(entry.start);
    if (endInput) endInput.value = entry.end == null ? "" : String(entry.end);
  });
  const gpaScaleSelect = document.getElementById("grading-gpa-scale");
  const gpaOtherInput = document.getElementById("grading-gpa-other");
  const editBtn = document.getElementById("grading-criteria-edit-btn");
  const saveBtn = document.getElementById("grading-criteria-submit-btn");
  const cancelBtn = document.getElementById("grading-criteria-cancel-btn");
  if (gpaScaleSelect) gpaScaleSelect.value = criteria.gpaScaleOption || "4";
  if (gpaOtherInput) gpaOtherInput.value = criteria.gpaScaleOption === "other" ? String(criteria.gpaMax || "") : "";
  document.querySelectorAll("#grading-criteria-form input, #grading-criteria-form select").forEach((element) => {
    if (!(element instanceof HTMLInputElement) && !(element instanceof HTMLSelectElement)) return;
    element.disabled = !gradingCriteriaEditMode;
  });
  if (editBtn) editBtn.classList.toggle("hidden", gradingCriteriaEditMode);
  if (saveBtn) saveBtn.classList.toggle("hidden", !gradingCriteriaEditMode);
  if (cancelBtn) cancelBtn.classList.toggle("hidden", !gradingCriteriaEditMode);
  updateGradingCriteriaFormMode();
}

function readLetterScaleForm() {
  return LETTER_GRADE_ORDER.map((label) => {
    const startRaw = document.getElementById(`grading-scale-${label.toLowerCase()}-start`)?.value ?? "";
    const endRaw = document.getElementById(`grading-scale-${label.toLowerCase()}-end`)?.value ?? "";
    return {
      label,
      start: startRaw === "" ? null : Number(startRaw),
      end: endRaw === "" ? null : Number(endRaw)
    };
  });
}

function validateLetterScale(letterScale) {
  const hasAnyValues = letterScale.some((entry) => entry.start != null || entry.end != null);
  if (!hasAnyValues) {
    return {
      valid: true,
      scale: DEFAULT_LETTER_GRADE_SCALE.map(({ label }) => ({ label, start: null, end: null }))
    };
  }
  const hasMissingValues = letterScale.some((entry) => entry.start == null || entry.end == null);
  if (hasMissingValues) {
    return { valid: false, message: "If you customize the Letter Grading Scale, all A-F starting and ending scores must be filled in." };
  }
  for (const entry of letterScale) {
    if (!Number.isInteger(entry.start) || !Number.isInteger(entry.end) || entry.start < 0 || entry.end < 0 || entry.start > 100 || entry.end > 100) {
      return { valid: false, message: "Letter grade scores must be whole numbers between 0 and 100." };
    }
    if (entry.start > entry.end) {
      return { valid: false, message: `${entry.label} must have a starting score that is less than or equal to its ending score.` };
    }
  }
  if (letterScale[0].end !== 100 || letterScale[letterScale.length - 1].start !== 0) {
    return { valid: false, message: "Custom letter grade ranges must cover the full 0-100 scale with no gaps." };
  }
  for (let index = 0; index < letterScale.length - 1; index += 1) {
    const current = letterScale[index];
    const next = letterScale[index + 1];
    if (current.start !== (next.end + 1)) {
      return { valid: false, message: "Custom letter grade ranges cannot overlap or leave gaps between A, B, C, D, and F." };
    }
  }
  return {
    valid: true,
    scale: letterScale.map((entry) => ({ label: entry.label, start: entry.start, end: entry.end }))
  };
}

function beginGradeTypeEdit(gradeTypeId) {
  const gradeType = draftGradeTypes().find((gt) => gt.id === gradeTypeId);
  if (!gradeType) return;
  editingGradeTypeId = gradeType.id;
  const nameInput = document.getElementById("grade-type-name");
  const weightInput = document.getElementById("grade-type-weight");
  if (nameInput) nameInput.value = gradeType.name;
  if (weightInput) weightInput.value = gradeType.weight == null ? "" : String(gradeType.weight);
  renderGradeTypes();
}

function cancelGradeTypeEdit() {
  editingGradeTypeId = "";
  const form = document.getElementById("grade-type-form");
  if (form) form.reset();
  renderGradeTypes();
}

function renderStudentDetail() {
  const panel = document.getElementById("student-detail-panel");
  if (!panel) return;

  const student = state.students.find((s) => s.id === selectedStudentId);
  if (!student) {
    selectedStudentId = "";
    resetStudentEnrollmentDraft();
    setStudentViewMode("list");
    renderStudentViewMode();
    return;
  }

  document.getElementById("student-detail-title").textContent = `${student.firstName} ${student.lastName} | Grade ${student.grade} | Age ${calculateAge(student.birthdate)}`;
  renderStudentEnrollmentCourseChecklist(getSelectedStudentEnrollmentCourseIds(), student.id);

  const quarterSelect = document.getElementById("student-detail-quarter-filter");
  const selectedQuarter = quarterSelect ? quarterSelect.value || "all" : "all";
  const quarterRange = state.settings.quarters.find((q) => q.name === selectedQuarter);
  const schoolYear = currentSchoolYear();
  const rangeStart = quarterRange ? quarterRange.startDate : state.settings.schoolYear.startDate;
  const rangeEnd = quarterRange ? quarterRange.endDate : state.settings.schoolYear.endDate;
  const gradeSummary = studentGradeSummary(student.id, { quarterName: selectedQuarter });

  const studentEnrollments = sortedStudentEnrollments(student.id, workingStudentEnrollments(student.id));
  const enrollmentRows = studentEnrollments
    .map((e) => {
      const course = getCourse(e.courseId);
      const subject = course ? getSubjectName(course.subjectId) : "Unknown Subject";
      const courseAvg = gradeSummary.courseAverage(e.courseId);
      const avgDisplay = courseAvg === 0 ? "No grades" : `${courseAvg.toFixed(1)}%`;
      const orderOptions = [`<option value="">Auto</option>`]
        .concat(studentEnrollments.map((_, index) => {
          const value = index + 1;
          const selected = parseScheduleOrderValue(e.scheduleOrder) === value ? " selected" : "";
          return `<option value="${value}"${selected}>${value}</option>`;
        }))
        .join("");
      const orderControl = isAdminUser()
        ? `<select class="student-schedule-order-select" data-enrollment-order-id="${e.id}" aria-label="Schedule order for ${getCourseName(e.courseId)}">${orderOptions}</select>`
        : (parseScheduleOrderValue(e.scheduleOrder) != null ? String(parseScheduleOrderValue(e.scheduleOrder)) : "Auto");
      return `<tr><td>${getCourseName(e.courseId)}</td><td>${subject}</td><td>${orderControl}</td><td>${avgDisplay}</td><td><button data-remove-student-enrollment='${e.id}' type='button'>Remove</button></td></tr>`;
    });
  if (enrollmentRows.length) {
    const overallAverage = gradeSummary.overallAverage;
    const averageDisplay = overallAverage > 0 ? `${overallAverage.toFixed(1)}%` : "No grades";
    enrollmentRows.push(`<tr><td colspan="3"><strong>Average</strong></td><td><strong>${averageDisplay}</strong></td><td></td></tr>`);
  }
  rowOrEmpty(document.getElementById("student-enrollment-table"), enrollmentRows, "No course enrollments for this student.", 5);

  const summary = studentAttendanceSummaryByRange(student.id, rangeStart, rangeEnd);
  const attendanceRows = [
    `<tr><td>${student.firstName} ${student.lastName}</td><td>${summary.attended}</td><td>${summary.absent}</td></tr>`
  ];
  rowOrEmpty(document.getElementById("student-attendance-summary-table"), attendanceRows, "No students available.", 3);

  const instructionalHoursSnapshot = buildInstructionalHoursSnapshot([student.id]);
  const selectedBucketKey = selectedQuarter === "all" ? "total" : selectedQuarter.toLowerCase();
  const bucketSummary = instructionalHoursSnapshot.summaryByStudent.get(student.id)?.buckets?.[selectedBucketKey] || { earned: 0, projected: 0 };
  const completionPct = bucketSummary.projected > 0
    ? ((bucketSummary.earned / bucketSummary.projected) * 100).toFixed(1)
    : "0.0";
  const instructionalHoursRows = [
    `<tr${selectedQuarter === "all" && schoolYear.requiredInstructionalHours != null && bucketSummary.projected < schoolYear.requiredInstructionalHours ? " class='warning-row'" : ""}><td>${student.firstName} ${student.lastName}</td><td>${bucketSummary.earned.toFixed(1)}</td><td>${bucketSummary.projected.toFixed(1)}</td><td>${completionPct}%</td></tr>`
  ];
  rowOrEmpty(
    document.getElementById("student-instructional-hours-summary-table"),
    instructionalHoursRows,
    "No instructional hours available.",
    4
  );
  const hoursWarningId = "student-instructional-hours-warning";
  const detailPanel = document.getElementById("student-detail-panel");
  let warningEl = document.getElementById(hoursWarningId);
  if (!warningEl && detailPanel) {
    warningEl = document.createElement("p");
    warningEl.id = hoursWarningId;
    warningEl.className = "warning-text hidden";
    const hoursTable = document.getElementById("student-instructional-hours-summary-table");
    hoursTable?.closest(".table-wrap")?.insertAdjacentElement("afterend", warningEl);
  }
  if (warningEl) {
    const requiredHours = schoolYear.requiredInstructionalHours;
    const showWarning = selectedQuarter === "all" && requiredHours != null && bucketSummary.projected < requiredHours;
    warningEl.textContent = showWarning
      ? `Warning: Projected instructional hours (${bucketSummary.projected.toFixed(1)}) are below the required instructional hours (${Number(requiredHours).toFixed(1)}).`
      : "";
    warningEl.classList.toggle("hidden", !showWarning);
  }
}

function renderHolidays() {
  const tableBody = document.getElementById("holiday-table");
  if (!tableBody) return;
  const rows = [...state.settings.holidays].sort((a,b)=>a.startDate.localeCompare(b.startDate));
  const htmlRows = rows
    .map((h) => `<tr><td>${h.name}</td><td>${h.type}</td><td>${formatDisplayDate(h.startDate)}</td><td>${formatDisplayDate(h.endDate)}</td><td class="schedule-actions-cell"><div class="table-action-row"><button data-edit-holiday='${h.id}' type='button'>Edit</button><button data-remove-holiday='${h.id}' type='button'>Remove</button></div></td></tr>`);
  rowOrEmpty(tableBody, htmlRows, "No holidays/breaks defined.", 5);
  const submitBtn = document.getElementById("holiday-submit-btn");
  const cancelBtn = document.getElementById("holiday-cancel-edit-btn");
  if (submitBtn) submitBtn.textContent = editingHolidayId ? "Update" : "Add";
  if (cancelBtn) cancelBtn.classList.toggle("hidden", !editingHolidayId);
}

function renderDailyBreaks() {
  const tableBody = document.getElementById("daily-break-table");
  if (!tableBody) return;
  const allDailyBreaks = [...(state.settings.dailyBreaks || [])];
  const visibleDailyBreaks = allDailyBreaks.filter((entry) =>
    !entry.schoolYearId || entry.schoolYearId === state.settings.currentSchoolYearId);
  const rows = (visibleDailyBreaks.length ? visibleDailyBreaks : allDailyBreaks)
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || dailyBreakLabel(a).localeCompare(dailyBreakLabel(b)))
    .map((entry) => {
      const students = entry.studentIds.map((studentId) => getStudentName(studentId)).join(", ");
      const weekdays = (entry.weekdays || []).map((day) => DAY_NAMES[day]).join(", ");
      const description = entry.type === "other" ? escapeHtml(entry.description || "") : "";
      return `<tr><td>${students}</td><td>${dailyBreakLabel(entry)}</td><td>${description || "-"}</td><td>${formatClockTime(entry.startTime)}</td><td>${Number(entry.durationMinutes || 0)} min</td><td>${weekdays}</td><td class="schedule-actions-cell"><div class="table-action-row"><button data-edit-daily-break='${entry.id}' type='button'>Edit</button><button data-remove-daily-break='${entry.id}' type='button'>Remove</button></div></td></tr>`;
    });
  rowOrEmpty(tableBody, rows, "No daily lunch or break schedules defined.", 7);
  const submitBtn = document.getElementById("daily-break-submit-btn");
  const cancelBtn = document.getElementById("daily-break-cancel-edit-btn");
  if (submitBtn) submitBtn.textContent = editingDailyBreakId ? "Update Break" : "Add Break";
  if (cancelBtn) cancelBtn.classList.toggle("hidden", !editingDailyBreakId);
  updateDailyBreakFormMode();
}

function renderPlanningSettings() {
  const schoolYear = currentSchoolYear();
  const schoolYearCurrent = document.getElementById("school-year-current");
  if (schoolYearCurrent) {
    const daysText = schoolYear.requiredInstructionalDays == null ? "not set" : String(schoolYear.requiredInstructionalDays);
    const hoursText = schoolYear.requiredInstructionalHours == null ? "not set" : Number(schoolYear.requiredInstructionalHours).toFixed(1);
    schoolYearCurrent.textContent = `Current School Year: ${schoolYear.label} (${formatDisplayDate(schoolYear.startDate)} to ${formatDisplayDate(schoolYear.endDate)}) | Required Days: ${daysText} | Required Hours: ${hoursText}`;
  }

  const schoolYearRows = state.settings.schoolYears
    .slice()
    .sort((a, b) => toDate(a.startDate) - toDate(b.startDate))
    .map((year) => {
      const instructionalDays = instructionalDaysCountForRange(year.startDate, year.endDate);
      const requiredDays = year.requiredInstructionalDays == null ? "-" : String(year.requiredInstructionalDays);
      const requiredHours = year.requiredInstructionalHours == null ? "-" : Number(year.requiredInstructionalHours).toFixed(1);
      const belowDaysRequirement = year.requiredInstructionalDays != null && instructionalDays < year.requiredInstructionalDays;
      const status = belowDaysRequirement
        ? `<span class="warning-text">Below required days by ${year.requiredInstructionalDays - instructionalDays}</span>`
        : "OK";
      const isCurrentYear = year.id === state.settings.currentSchoolYearId;
      const actionButtons = [
        isCurrentYear ? "" : `<button type="button" data-set-current-school-year="${year.id}">Set Current</button>`,
        `<button type="button" data-edit-school-year="${year.id}">Edit</button>`,
        `<button type="button" data-remove-school-year="${year.id}">Delete</button>`
      ].filter(Boolean).join("");
      return `<tr${belowDaysRequirement ? " class='warning-row'" : ""}><td>${year.label}${isCurrentYear ? " (Current)" : ""}</td><td>${formatDisplayDate(year.startDate)}</td><td>${formatDisplayDate(year.endDate)}</td><td>${requiredDays}</td><td>${requiredHours}</td><td>${instructionalDays}</td><td>${status}</td><td class="schedule-actions-cell"><div class="table-action-row">${actionButtons}</div></td></tr>`;
    });
  rowOrEmpty(document.getElementById("school-year-summary-table"), schoolYearRows, "No school years saved yet.", 8);

  const quarterRows = state.settings.schoolYears
    .slice()
    .sort((a, b) => toDate(a.startDate) - toDate(b.startDate))
    .flatMap((year) => {
      const yearQuarters = state.settings.allQuarters
        .filter((quarter) => quarter.schoolYearId === year.id)
        .sort((a, b) => toDate(a.startDate) - toDate(b.startDate));
      const rows = yearQuarters.map((quarter) => {
        const instructionalDays = instructionalDaysCountForRange(quarter.startDate, quarter.endDate);
        return `<tr><td>${year.label}</td><td>${quarter.name}</td><td>${formatDisplayDate(quarter.startDate)}</td><td>${formatDisplayDate(quarter.endDate)}</td><td>${instructionalDays}</td><td class="schedule-actions-cell"><div class="table-action-row"><button type="button" data-edit-quarters-year="${quarter.schoolYearId}">Edit</button></div></td></tr>`;
      });
      if (rows.length) {
        const totalInstructionalDays = yearQuarters.reduce((sum, quarter) =>
          sum + instructionalDaysCountForRange(quarter.startDate, quarter.endDate), 0);
        rows.push(`<tr><td colspan="3"></td><td class="quarter-summary-total-label"><strong>${year.label} Total</strong></td><td class="quarter-summary-total-value"><strong>${totalInstructionalDays}</strong></td><td></td></tr>`);
      }
      return rows;
    });
  rowOrEmpty(document.getElementById("quarter-summary-table"), quarterRows, "No quarters saved yet.", 6);
  const quarterWarningEl = document.getElementById("quarter-summary-warning");
  if (quarterWarningEl) {
    const mismatches = state.settings.schoolYears
      .filter((year) => year.requiredInstructionalDays != null)
      .map((year) => {
        const quarterInstructionalDays = state.settings.allQuarters
          .filter((quarter) => quarter.schoolYearId === year.id)
          .reduce((sum, quarter) => sum + instructionalDaysCountForRange(quarter.startDate, quarter.endDate), 0);
        return {
          year,
          quarterInstructionalDays,
          difference: quarterInstructionalDays - Number(year.requiredInstructionalDays)
        };
      })
      .filter((entry) => entry.difference < 0);
    if (mismatches.length) {
      quarterWarningEl.className = "warning-text";
      quarterWarningEl.textContent = mismatches
        .map((entry) => `${entry.year.label}: defined quarters total ${entry.quarterInstructionalDays} instructional days, which is below Required Instructional Days of ${entry.year.requiredInstructionalDays}.`)
        .join(" ");
    } else {
      quarterWarningEl.className = "muted hidden";
      quarterWarningEl.textContent = "";
    }
  }

  const schoolYearSubmitBtn = document.getElementById("school-year-submit-btn");
  const schoolYearCancelBtn = document.getElementById("school-year-cancel-edit-btn");
  if (schoolYearSubmitBtn) schoolYearSubmitBtn.textContent = editingSchoolYearId ? "Update School Year" : "Save School Year";
  if (schoolYearCancelBtn) schoolYearCancelBtn.classList.toggle("hidden", !editingSchoolYearId);

  const quartersSubmitBtn = document.getElementById("quarters-submit-btn");
  const quartersCancelBtn = document.getElementById("quarters-cancel-edit-btn");
  if (quartersSubmitBtn) quartersSubmitBtn.textContent = editingQuarterSchoolYearId ? "Update Quarters" : "Save Quarters";
  if (quartersCancelBtn) quartersCancelBtn.classList.toggle("hidden", !editingQuarterSchoolYearId);
}

function renderPlans() {
  const tableBody = document.getElementById("plan-table");
  if (!tableBody) return;
  const viewerStudentId = currentStudentId();
  const typeFilter = document.getElementById("plan-filter-type")?.value || "all";
  const studentFilter = viewerStudentId || document.getElementById("plan-filter-student")?.value || "all";

  const rows = [...state.plans]
    .filter((plan) => {
      if (typeFilter !== "all" && plan.planType !== typeFilter) return false;
      if (studentFilter !== "all" && plan.studentId !== studentFilter) return false;
      return true;
    })
    .sort((a,b)=>a.startDate.localeCompare(b.startDate));
  const htmlRows = rows.map((p) => {
    const periodLabel = p.planType === "quarterly" && p.quarterName ? ` (${p.quarterName})` : "";
    const weekdays = (Array.isArray(p.weekdays) ? p.weekdays : []).map((w) => DAY_NAMES[w]).join(", ");
    const range = resolvedPlanRange(p);
    const actions = isAdminUser() ? `<button data-edit-plan='${p.id}' type='button'>Edit</button> <button data-remove-plan='${p.id}' type='button'>Remove</button>` : "View only";
    return `<tr><td>${p.planType.toUpperCase()}${periodLabel}</td><td>${getStudentName(p.studentId)}</td><td>${getCourseName(p.courseId)}</td><td>${formatDisplayDate(range.startDate)} to ${formatDisplayDate(range.endDate)}</td><td>${weekdays}</td><td class="schedule-actions-cell">${typeof actions === "string" && actions.includes("<button") ? `<div class="table-action-row">${actions}</div>` : actions}</td></tr>`;
  });
  rowOrEmpty(tableBody, htmlRows, "No instruction plans defined.", 6);
  const submitBtn = document.getElementById("plan-submit-btn");
  const cancelBtn = document.getElementById("plan-cancel-edit-btn");
  if (submitBtn) submitBtn.textContent = editingPlanId ? "Update Plan" : "Add Plan";
  if (cancelBtn) cancelBtn.classList.toggle("hidden", !editingPlanId);
}

function renderAttendance() {
  const viewerStudentId = currentStudentId();
  const studentFilter = viewerStudentId || document.getElementById("attendance-filter-student")?.value || "all";
  const dateFilter = document.getElementById("attendance-filter-date")?.value || "";
  const quarterFilter = document.getElementById("attendance-filter-quarter")?.value || "all";
  const statusFilter = document.getElementById("attendance-filter-status")?.value || "all";
  const quarterRange = state.settings.quarters.find((q) => q.name === quarterFilter);

  const filtered = state.attendance.filter((a) => {
    if (studentFilter !== "all" && a.studentId !== studentFilter) return false;
    if (dateFilter && a.date !== dateFilter) return false;
    if (quarterFilter !== "all" && quarterRange && !inRange(a.date, quarterRange.startDate, quarterRange.endDate)) return false;
    if (statusFilter === "present" && !a.present) return false;
    if (statusFilter === "absent" && a.present) return false;
    return true;
  });

  const rows = [...filtered]
    .sort((a,b)=>b.date.localeCompare(a.date))
    .slice(0,100)
    .map((a) => {
      const actions = isAdminUser()
        ? `<button type='button' data-edit-attendance='${a.id}'>Edit</button> <button type='button' data-remove-attendance='${a.id}'>Remove</button>`
        : "View only";
      return `<tr><td>${formatDisplayDate(a.date)}</td><td>${getStudentName(a.studentId)}</td><td>${a.present ? "Present" : "Absent"}</td><td>${typeof actions === "string" && actions.includes("<button") ? `<div class="table-action-row">${actions}</div>` : actions}</td></tr>`;
    });
  rowOrEmpty(document.getElementById("attendance-table"), rows, "No attendance recorded yet.", 4);
}

function resetAttendanceEditMode() {
  editingAttendanceId = "";
  const submitBtn = document.getElementById("attendance-submit-btn");
  const cancelBtn = document.getElementById("attendance-cancel-edit-btn");
  if (submitBtn) submitBtn.textContent = "Save Attendance";
  if (cancelBtn) cancelBtn.classList.add("hidden");
  const dateInput = document.getElementById("attendance-date");
  if (dateInput) dateInput.value = todayISO();
  renderAttendanceStudentChecklist([]);
}

function beginAttendanceEdit(target) {
  if (!target) return;
  editingAttendanceId = target.id;
  renderAttendanceStudentChecklist([target.studentId]);
  document.getElementById("attendance-date").value = target.date;
  document.getElementById("attendance-status").value = target.present ? "present" : "absent";
  document.getElementById("attendance-submit-btn").textContent = "Update Attendance";
  document.getElementById("attendance-cancel-edit-btn").classList.remove("hidden");
}

function renderTests() {
  const viewerStudentId = currentStudentId();
  const studentFilter = viewerStudentId || document.getElementById("grades-filter-student")?.value || "all";
  const quarterFilter = document.getElementById("grades-filter-quarter")?.value || "all";
  const schoolYearFilter = document.getElementById("grades-filter-school-year")?.value || "all";
  const subjectFilter = document.getElementById("grades-filter-subject")?.value || "all";
  const instructorFilter = document.getElementById("grades-filter-instructor")?.value || "all";
  const courseFilter = document.getElementById("grades-filter-course")?.value || "all";
  const gradeTypeFilter = document.getElementById("grades-filter-grade-type")?.value || "all";

  const quarterRange = state.settings.quarters.find((q) => q.name === quarterFilter);
  const schoolYearStart = state.settings.schoolYear.startDate;
  const schoolYearEnd = state.settings.schoolYear.endDate;

  const filtered = state.tests.filter((t) => {
    if (studentFilter !== "all" && t.studentId !== studentFilter) return false;
    if (subjectFilter !== "all" && t.subjectId !== subjectFilter) return false;
    if (!testMatchesInstructorFilter(t, instructorFilter)) return false;
    if (courseFilter !== "all" && t.courseId !== courseFilter) return false;
    const thisGradeType = gradeTypeName(t);
    if (gradeTypeFilter !== "all" && thisGradeType !== gradeTypeFilter) return false;
    if (quarterFilter !== "all" && quarterRange && !inRange(t.date, quarterRange.startDate, quarterRange.endDate)) return false;
    if (schoolYearFilter === "current" && !inRange(t.date, schoolYearStart, schoolYearEnd)) return false;
    if (schoolYearFilter !== "all" && schoolYearFilter !== "current" && String(t.date).slice(0, 4) !== schoolYearFilter) return false;
    return true;
  });

  const rows = [...filtered]
    .sort((a,b)=>b.date.localeCompare(a.date))
    .slice(0,150)
    .map((t) => {
      const gradeType = gradeTypeName(t);
      const actions = isAdminUser()
        ? `<button type='button' data-edit-grade='${t.id}'>Edit</button> <button type='button' data-remove-grade='${t.id}'>Remove</button>`
        : "View only";
      return `<tr><td>${formatDisplayDate(t.date)}</td><td>${getStudentName(t.studentId)}</td><td>${getSubjectName(t.subjectId)}</td><td>${getCourseName(t.courseId)}</td><td>${gradeType}</td><td>${pct(t.score,t.maxScore).toFixed(1)}%</td><td>${typeof actions === "string" && actions.includes("<button") ? `<div class="table-action-row">${actions}</div>` : actions}</td></tr>`;
    });
  const avgGrade = weightedAverageForTests(filtered, { quarterScoped: quarterFilter !== "all" });
  if (rows.length) {
    rows.push(`<tr><td colspan="5"><strong>Average Grade</strong></td><td><strong>${avgGrade.toFixed(1)}%</strong></td><td></td></tr>`);
  }
  rowOrEmpty(document.getElementById("test-table"), rows, "No grades logged yet.", 7);
}

function getCoursesBySubject(subjectId) {
  return state.courses.filter((c) => c.subjectId === subjectId);
}

function getEligibleSubjectsForStudent(studentId, includeSubjectId) {
  const enrolledCourseIds = new Set(
    state.enrollments
      .filter((e) => e.studentId === studentId)
      .map((e) => e.courseId)
  );

  const subjectIds = new Set(
    state.courses
      .filter((c) => enrolledCourseIds.has(c.id))
      .map((c) => c.subjectId)
  );

  if (includeSubjectId) subjectIds.add(includeSubjectId);

  return state.subjects.filter((s) => subjectIds.has(s.id));
}

function getEnrolledCoursesForStudent(studentId) {
  const enrolledCourseIds = new Set(
    state.enrollments
      .filter((e) => e.studentId === studentId)
      .map((e) => e.courseId)
  );
  return state.courses.filter((c) => enrolledCourseIds.has(c.id));
}

function getCalendarSelectedStudentIds() {
  if (currentStudentId()) return [currentStudentId()];
  return Array.from(document.querySelectorAll(".calendar-student-checkbox:checked")).map((el) => el.value);
}

function getCalendarSelectedSubjectIds() {
  return Array.from(document.querySelectorAll(".calendar-subject-checkbox:checked")).map((el) => el.value);
}

function getCalendarSelectedCourseIds() {
  return Array.from(document.querySelectorAll(".calendar-course-checkbox:checked")).map((el) => el.value);
}

function updateCalendarStudentSummary() {
  const summary = document.getElementById("calendar-student-summary");
  if (!summary) return;
  const selectedCount = getCalendarSelectedStudentIds().length;
  const totalCount = visibleStudents().length;
  summary.textContent = selectedCount && selectedCount === totalCount
    ? "Students (All)"
    : `Students (${selectedCount} selected)`;
}

function updateCalendarSubjectSummary() {
  const summary = document.getElementById("calendar-subject-summary");
  if (!summary) return;
  const selectedCount = getCalendarSelectedSubjectIds().length;
  const totalCount = document.querySelectorAll(".calendar-subject-checkbox").length;
  summary.textContent = selectedCount && selectedCount === totalCount
    ? "Subjects (All)"
    : `Subjects (${selectedCount} selected)`;
}

function updateCalendarCourseSummary() {
  const summary = document.getElementById("calendar-course-summary");
  if (!summary) return;
  const selectedCount = getCalendarSelectedCourseIds().length;
  const totalCount = document.querySelectorAll(".calendar-course-checkbox").length;
  summary.textContent = selectedCount && selectedCount === totalCount
    ? "Courses (All)"
    : `Courses (${selectedCount} selected)`;
}

function syncCalendarAllCheckbox(itemClassName, allClassName) {
  const allCheckbox = document.querySelector(`.${allClassName}`);
  if (!(allCheckbox instanceof HTMLInputElement)) return;
  const items = Array.from(document.querySelectorAll(`.${itemClassName}`)).filter((el) => el instanceof HTMLInputElement);
  allCheckbox.checked = !!items.length && items.every((el) => el.checked);
}

function setCalendarChecklistSelection(className, ids) {
  const selected = new Set(ids || []);
  document.querySelectorAll(`.${className}`).forEach((el) => {
    if (!(el instanceof HTMLInputElement)) return;
    el.checked = selected.has(el.value);
  });
}

function applyCalendarFilterSelection({ studentIds = null, subjectIds = null, courseIds = null } = {}) {
  if (studentIds) {
    calendarSelectedStudentIds = new Set(studentIds);
    setCalendarChecklistSelection("calendar-student-checkbox", studentIds);
  }
  if (subjectIds) {
    calendarSelectedSubjectIds = new Set(subjectIds);
    setCalendarChecklistSelection("calendar-subject-checkbox", subjectIds);
  }
  if (courseIds) {
    calendarSelectedCourseIds = new Set(courseIds);
    setCalendarChecklistSelection("calendar-course-checkbox", courseIds);
  }
  updateCalendarStudentSummary();
  updateCalendarSubjectSummary();
  updateCalendarCourseSummary();
}

function renderCalendarStudentChecklist(preselectedStudentIds = []) {
  const optionsWrap = document.getElementById("calendar-student-options");
  if (!optionsWrap) return;
  const selected = new Set(currentStudentId() ? [currentStudentId()] : preselectedStudentIds);
  const forceSingleStudent = !!currentStudentId();
  const students = visibleStudents();
  const allChecked = students.length > 0 && students.every((student) => selected.has(student.id));
  const allRow = forceSingleStudent ? "" : `<div class="checklist-row"><input id="calendar-student-all" type="checkbox" class="calendar-student-all-checkbox"${allChecked ? " checked" : ""}><label for="calendar-student-all">All</label></div>`;
  const checkboxes = students.map((student, idx) => {
    const checked = selected.has(student.id) ? " checked" : "";
    const disabled = forceSingleStudent ? " disabled" : "";
    const inputId = `calendar-student-${idx}-${student.id}`;
    return `<div class="checklist-row"><input id="${inputId}" type="checkbox" class="calendar-student-checkbox" value="${student.id}"${checked}${disabled}><label for="${inputId}">${student.firstName} ${student.lastName}</label></div>`;
  }).join("");
  optionsWrap.innerHTML = students.length ? `${allRow}${checkboxes}` : "<span>No students available.</span>";
  syncCalendarAllCheckbox("calendar-student-checkbox", "calendar-student-all-checkbox");
  updateCalendarStudentSummary();
}

function renderCalendarSubjectChecklist(subjects, preselectedSubjectIds = []) {
  const optionsWrap = document.getElementById("calendar-subject-options");
  if (!optionsWrap) return;
  const selected = new Set(preselectedSubjectIds);
  const allChecked = subjects.length > 0 && subjects.every((subject) => selected.has(subject.id));
  const allRow = subjects.length ? `<div class="checklist-row"><input id="calendar-subject-all" type="checkbox" class="calendar-subject-all-checkbox"${allChecked ? " checked" : ""}><label for="calendar-subject-all">All</label></div>` : "";
  const checkboxes = subjects.map((subject, idx) => {
    const checked = selected.has(subject.id) ? " checked" : "";
    const inputId = `calendar-subject-${idx}-${subject.id}`;
    return `<div class="checklist-row"><input id="${inputId}" type="checkbox" class="calendar-subject-checkbox" value="${subject.id}"${checked}><label for="${inputId}">${subject.name}</label></div>`;
  }).join("");
  optionsWrap.innerHTML = subjects.length ? `${allRow}${checkboxes}` : "<span>No subjects available.</span>";
  syncCalendarAllCheckbox("calendar-subject-checkbox", "calendar-subject-all-checkbox");
  updateCalendarSubjectSummary();
}

function renderCalendarCourseChecklist(courses, preselectedCourseIds = []) {
  const optionsWrap = document.getElementById("calendar-course-options");
  if (!optionsWrap) return;
  const selected = new Set(preselectedCourseIds);
  const allChecked = courses.length > 0 && courses.every((course) => selected.has(course.id));
  const allRow = courses.length ? `<div class="checklist-row"><input id="calendar-course-all" type="checkbox" class="calendar-course-all-checkbox"${allChecked ? " checked" : ""}><label for="calendar-course-all">All</label></div>` : "";
  const checkboxes = courses.map((course, idx) => {
    const checked = selected.has(course.id) ? " checked" : "";
    const inputId = `calendar-course-${idx}-${course.id}`;
    return `<div class="checklist-row"><input id="${inputId}" type="checkbox" class="calendar-course-checkbox" value="${course.id}"${checked}><label for="${inputId}">${course.name} (${getSubjectName(course.subjectId)})</label></div>`;
  }).join("");
  optionsWrap.innerHTML = courses.length ? `${allRow}${checkboxes}` : "<span>No courses available.</span>";
  syncCalendarAllCheckbox("calendar-course-checkbox", "calendar-course-all-checkbox");
  updateCalendarCourseSummary();
}

function syncCalendarFilterSubjectCourseOptions() {
  const previousStudentIds = Array.from(calendarSelectedStudentIds);
  const previousSubjectIds = Array.from(calendarSelectedSubjectIds);
  const previousCourseIds = Array.from(calendarSelectedCourseIds);
  renderCalendarStudentChecklist(previousStudentIds);
  const selectedStudentIds = getCalendarSelectedStudentIds();
  let subjectPool = state.subjects;
  let coursePool = state.courses;

  if (selectedStudentIds.length) {
    const enrolledCourses = Array.from(new Map(
      selectedStudentIds
        .flatMap((studentId) => getEnrolledCoursesForStudent(studentId))
        .map((course) => [course.id, course])
    ).values());
    const subjectIds = new Set(enrolledCourses.map((course) => course.subjectId));
    subjectPool = state.subjects.filter((subject) => subjectIds.has(subject.id));
    coursePool = enrolledCourses;
  }
  const allowedSubjectIds = new Set(subjectPool.map((subject) => subject.id));
  calendarSelectedStudentIds = new Set(selectedStudentIds);
  calendarSelectedSubjectIds = new Set(previousSubjectIds.filter((id) => allowedSubjectIds.has(id)));
  renderCalendarSubjectChecklist(subjectPool, Array.from(calendarSelectedSubjectIds));

  const activeSubjectIds = getCalendarSelectedSubjectIds();
  const filteredCourses = activeSubjectIds.length
    ? coursePool.filter((course) => activeSubjectIds.includes(course.subjectId))
    : coursePool;
  const allowedCourseIds = new Set(filteredCourses.map((course) => course.id));
  calendarSelectedCourseIds = new Set(previousCourseIds.filter((id) => allowedCourseIds.has(id)));
  renderCalendarCourseChecklist(filteredCourses, Array.from(calendarSelectedCourseIds));
}

function syncGradesFilterSubjectCourseOptions() {
  const studentFilter = document.getElementById("grades-filter-student")?.value || "all";
  const instructorFilter = document.getElementById("grades-filter-instructor")?.value || "all";
  const subjectSelect = document.getElementById("grades-filter-subject");
  const courseSelect = document.getElementById("grades-filter-course");
  if (!subjectSelect || !courseSelect) return;

  const previousSubject = subjectSelect.value || "all";
  const previousCourse = courseSelect.value || "all";
  let coursePool = state.courses;

  if (studentFilter !== "all") {
    const enrolledCourses = getEnrolledCoursesForStudent(studentFilter);
    coursePool = enrolledCourses;
  }
  if (instructorFilter !== "all") {
    coursePool = coursePool.filter((course) => matchesInstructorFilter(course.instructorId, instructorFilter));
  }
  const subjectIds = new Set(coursePool.map((course) => course.subjectId));
  const subjectPool = state.subjects.filter((subject) => subjectIds.has(subject.id));

  subjectSelect.innerHTML = "<option value='all'>All Subjects</option>";
  subjectPool.forEach((s) => {
    const option = document.createElement("option");
    option.value = s.id;
    option.textContent = s.name;
    subjectSelect.appendChild(option);
  });
  if (Array.from(subjectSelect.options).some((o) => o.value === previousSubject)) {
    subjectSelect.value = previousSubject;
  }

  const activeSubject = subjectSelect.value || "all";
  const filteredCourses = activeSubject === "all"
    ? coursePool
    : coursePool.filter((c) => c.subjectId === activeSubject);

  courseSelect.innerHTML = "<option value='all'>All Courses</option>";
  filteredCourses.forEach((c) => {
    const option = document.createElement("option");
    option.value = c.id;
    option.textContent = `${c.name} (${getSubjectName(c.subjectId)})`;
    courseSelect.appendChild(option);
  });
  if (Array.from(courseSelect.options).some((o) => o.value === previousCourse)) {
    courseSelect.value = previousCourse;
  }
}

function getEligibleCoursesForStudentSubject(studentId, subjectId, includeCourseId) {
  const enrolledCourseIds = new Set(
    state.enrollments
      .filter((e) => e.studentId === studentId)
      .map((e) => e.courseId)
  );

  if (includeCourseId) enrolledCourseIds.add(includeCourseId);

  return state.courses.filter((c) => enrolledCourseIds.has(c.id));
}

function buildGradeEntryRow(existingGrade) {
  const tr = document.createElement("tr");
  tr.setAttribute("data-grade-entry-row-id", existingGrade?.id || uid());

  const dateValue = existingGrade ? existingGrade.date : todayISO();
  const gradeValue = existingGrade ? Number(existingGrade.score || 0) : "";
  const selectedGradeStudentId = existingGrade ? existingGrade.studentId : (state.students[0] ? state.students[0].id : "");
  const selectedSubjectId = existingGrade ? existingGrade.subjectId : (state.subjects[0] ? state.subjects[0].id : "");
  const selectedCourseId = existingGrade ? existingGrade.courseId : "";
  const allGradeTypes = availableGradeTypes();
  const selectedGradeType = existingGrade
    ? gradeTypeName(existingGrade)
    : (allGradeTypes.includes("Quiz") ? "Quiz" : (allGradeTypes[0] || "Test"));

  const studentOptions = state.students
    .map((s) => `<option value="${s.id}"${s.id === selectedGradeStudentId ? " selected" : ""}>${s.firstName} ${s.lastName}</option>`)
    .join("");

  const eligibleSubjects = getEligibleSubjectsForStudent(selectedGradeStudentId, selectedSubjectId);
  const defaultSubjectId = eligibleSubjects.some((s) => s.id === selectedSubjectId)
    ? selectedSubjectId
    : (eligibleSubjects[0] ? eligibleSubjects[0].id : "");
  const subjectOptions = eligibleSubjects.length
    ? eligibleSubjects.map((s) => `<option value="${s.id}"${s.id === defaultSubjectId ? " selected" : ""}>${s.name}</option>`).join("")
    : "<option value=''>No enrolled subjects</option>";

  const courseOptions = getEligibleCoursesForStudentSubject(selectedGradeStudentId, defaultSubjectId, selectedCourseId)
    .map((c) => `<option value="${c.id}"${c.id === selectedCourseId ? " selected" : ""}>${c.name}</option>`)
    .join("") || "<option value=''>No enrolled courses</option>";
  const gradeTypeOptions = allGradeTypes
    .map((type) => `<option value="${type}"${selectedGradeType === type ? " selected" : ""}>${type}</option>`)
    .join("");

  if (existingGrade) {
    tr.setAttribute("data-edit-grade-id", existingGrade.id);
  }

  tr.innerHTML = `
    <td><input class="grade-row-date" type="date" value="${dateValue}"></td>
    <td><select class="grade-row-student">${studentOptions}</select></td>
    <td><select class="grade-row-subject">${subjectOptions}</select></td>
    <td><select class="grade-row-course">${courseOptions}</select></td>
    <td>
      <select class="grade-row-type">
        ${gradeTypeOptions}
      </select>
    </td>
    <td><input class="grade-row-value" type="number" min="0" max="100" step="0.1" placeholder="0-100" value="${gradeValue}"></td>
    <td>
      <div class="table-action-row grade-entry-actions">
        <button type="button" data-grade-save="1">${existingGrade ? "Update" : "Save"}</button>
        <button type="button" data-grade-calc-toggle="1">Calculate</button>
        <button type="button" data-grade-cancel="1">Cancel</button>
      </div>
    </td>
  `;

  return tr;
}

function buildGradeCalculatorRow(sourceRowId) {
  const tr = document.createElement("tr");
  tr.className = "grade-calc-row";
  tr.setAttribute("data-grade-calc-for", sourceRowId);
  tr.innerHTML = `
    <td colspan="7">
      <div class="grade-calc-panel">
        <label>
          <span>Missed Items</span>
          <input class="grade-calc-missed" type="number" min="0" step="1" value="0">
        </label>
        <label>
          <span>Total Items</span>
          <input class="grade-calc-total" type="number" min="1" step="1" value="">
        </label>
        <div class="table-action-row grade-calc-actions">
          <button type="button" data-grade-calc-apply="1">Calculate Grade</button>
          <button type="button" data-grade-calc-close="1">Cancel</button>
        </div>
      </div>
    </td>
  `;
  return tr;
}

function removeGradeCalculatorRow(sourceRowId) {
  const calcRow = document.querySelector(`tr[data-grade-calc-for="${sourceRowId}"]`);
  if (calcRow) calcRow.remove();
}

function toggleGradeCalculatorRow(row) {
  if (!row) return;
  const rowId = row.getAttribute("data-grade-entry-row-id");
  if (!rowId) return;
  const existing = document.querySelector(`tr[data-grade-calc-for="${rowId}"]`);
  if (existing) {
    existing.remove();
    return;
  }
  removeGradeCalculatorRow(rowId);
  const calcRow = buildGradeCalculatorRow(rowId);
  row.insertAdjacentElement("afterend", calcRow);
  calcRow.querySelector(".grade-calc-total")?.focus();
}

function applyGradeCalculator(calcRow) {
  if (!calcRow) return;
  const rowId = calcRow.getAttribute("data-grade-calc-for");
  const sourceRow = rowId ? document.querySelector(`tr[data-grade-entry-row-id="${rowId}"]`) : null;
  if (!sourceRow) {
    calcRow.remove();
    return;
  }

  const missed = Number(calcRow.querySelector(".grade-calc-missed")?.value);
  const total = Number(calcRow.querySelector(".grade-calc-total")?.value);
  if (!Number.isFinite(total) || total <= 0) {
    alert("Total Items must be greater than 0.");
    return;
  }
  if (!Number.isFinite(missed) || missed < 0) {
    alert("Missed Items cannot be negative.");
    return;
  }
  if (missed > total) {
    alert("Missed Items cannot be greater than Total Items.");
    return;
  }

  const percentage = Math.round(((total - missed) / total) * 100);
  const gradeInput = sourceRow.querySelector(".grade-row-value");
  if (gradeInput) {
    gradeInput.value = String(percentage);
  }
  calcRow.remove();
}

function updateGradeRowCourses(row) {
  const studentSelect = row.querySelector(".grade-row-student");
  const subjectSelect = row.querySelector(".grade-row-subject");
  const courseSelect = row.querySelector(".grade-row-course");
  if (!studentSelect || !subjectSelect || !courseSelect) return;

  const studentId = studentSelect.value;
  const currentSubjectId = subjectSelect.value;
  const currentCourseId = courseSelect.value;

  const eligibleSubjects = getEligibleSubjectsForStudent(studentId, currentSubjectId);
  subjectSelect.innerHTML = eligibleSubjects.length
    ? eligibleSubjects.map((s) => `<option value="${s.id}"${s.id === currentSubjectId ? " selected" : ""}>${s.name}</option>`).join("")
    : "<option value=''>No enrolled subjects</option>";

  const subjectId = eligibleSubjects.some((s) => s.id === currentSubjectId)
    ? currentSubjectId
    : (eligibleSubjects[0] ? eligibleSubjects[0].id : "");
  if (subjectId) subjectSelect.value = subjectId;

  const courseOptions = getEligibleCoursesForStudentSubject(studentId, subjectId, currentCourseId);
  courseSelect.innerHTML = courseOptions.length
    ? courseOptions.map((c) => `<option value="${c.id}"${c.id === currentCourseId ? " selected" : ""}>${c.name}</option>`).join("")
    : "<option value=''>No enrolled courses</option>";

  const resolvedCourseId = courseOptions.some((c) => c.id === currentCourseId)
    ? currentCourseId
    : (courseOptions[0] ? courseOptions[0].id : "");
  if (resolvedCourseId) courseSelect.value = resolvedCourseId;

  const resolvedCourse = courseOptions.find((c) => c.id === resolvedCourseId);
  if (resolvedCourse && eligibleSubjects.some((s) => s.id === resolvedCourse.subjectId)) {
    subjectSelect.value = resolvedCourse.subjectId;
  }
}

function updateGradeEntryVisibility() {
  const wrap = document.getElementById("grade-entry-wrap");
  const body = document.getElementById("grade-entry-body");
  if (!wrap || !body) return;
  wrap.classList.toggle("hidden", !body.querySelector("tr"));
}

function gradeAnalytics(options = {}) {
  const instructorId = options.instructorId || "all";
  const tests = state.tests
    .filter((test) => testMatchesInstructorFilter(test, instructorId))
    .map((t) => ({ ...t, grade: pct(t.score, t.maxScore) }));
  const byStudent = new Map(); const bySubject = new Map();
  tests.forEach((t) => {
    if (!byStudent.has(t.studentId)) byStudent.set(t.studentId, []);
    byStudent.get(t.studentId).push(t);
    if (!bySubject.has(t.subjectId)) bySubject.set(t.subjectId, []);
    bySubject.get(t.subjectId).push(t);
  });
  const student = Array.from(byStudent.entries()).map(([studentId, testsForStudent]) => {
    const quarterRowsForStudent = state.settings.quarters.map((q) => {
      const quarterTests = testsForStudent.filter((t) => inRange(t.date, q.startDate, q.endDate));
      return { avg: weightedAverageForTests(quarterTests, { quarterScoped: true }), count: quarterTests.length };
    });
    return { studentId, avg: averageOfQuarterAverages(quarterRowsForStudent), count: testsForStudent.length };
  });
  const subject = Array.from(bySubject.entries()).map(([subjectId, testsForSubject]) => {
    const quarterRowsForSubject = state.settings.quarters.map((q) => {
      const quarterTests = testsForSubject.filter((t) => inRange(t.date, q.startDate, q.endDate));
      return { avg: weightedAverageForTests(quarterTests, { quarterScoped: true }), count: quarterTests.length };
    });
    return { subjectId, avg: averageOfQuarterAverages(quarterRowsForSubject), count: testsForSubject.length };
  });

  const quarterRows = state.settings.quarters.map((q) => {
    const quarterTests = tests.filter((t) => inRange(t.date, q.startDate, q.endDate));
    return { label: q.name, avg: weightedAverageForTests(quarterTests, { quarterScoped: true }), count: quarterTests.length };
  });
  const running = averageOfStudentOverallAverages(Array.from(byStudent.keys()));

  const sy = state.settings.schoolYear;
  const annualTests = tests.filter((t) => inRange(t.date, sy.startDate, sy.endDate));
  const cq = currentQuarter(new Date());
  const cqTests = cq ? tests.filter((t) => inRange(t.date, cq.startDate, cq.endDate)) : [];

  return {
    student, subject, running,
    quarterRows,
    annualAvg: running,
    annualCount: annualTests.length,
    currentQuarterAvg: weightedAverageForTests(cqTests, { quarterScoped: true })
  };
}

function schoolYearMonths(startDate, endDate) {
  const start = toDate(startDate);
  const end = toDate(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1, 12, 0, 0);
  const limit = new Date(end.getFullYear(), end.getMonth(), 1, 12, 0, 0);
  const out = [];
  while (cursor <= limit) {
    out.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return out;
}

function renderGradeTrending() {
  const chartHost = document.getElementById("grade-trending-chart");
  if (!chartHost) return;
  const allowedStudentIds = visibleStudentIds();

  const sy = state.settings.schoolYear;
  const syStart = toDate(sy.startDate);
  const syEnd = toDate(sy.endDate);
  const today = toDate(todayISO());
  const effectiveEnd = syEnd < today ? syEnd : today;

  const quarterFilter = document.getElementById("trend-filter-quarter")?.value || "all";
  const subjectFilter = document.getElementById("trend-filter-subject")?.value || "all";
  const instructorFilter = document.getElementById("trend-filter-instructor")?.value || "all";
  const gradeTypeFilter = document.getElementById("trend-filter-grade-type")?.value || "all";
  const selectedStudentIds = getTrendSelectedStudentIds();
  const quarterRange = state.settings.quarters.find((q) => q.name === quarterFilter);
  const effectiveEndIso = toISO(effectiveEnd);
  let monthStartIso = sy.startDate;
  let monthEndIso = effectiveEndIso;
  if (quarterRange && quarterFilter !== "all") {
    if (toDate(quarterRange.startDate) > toDate(monthStartIso)) monthStartIso = quarterRange.startDate;
    if (toDate(quarterRange.endDate) < toDate(monthEndIso)) monthEndIso = quarterRange.endDate;
  }

  const months = schoolYearMonths(monthStartIso, monthEndIso);
  if (!months.length) {
    chartHost.innerHTML = syStart > today
      ? "<p class='muted'>School year has not started yet.</p>"
      : (quarterFilter !== "all"
        ? "<p class='muted'>No elapsed months in the selected quarter yet.</p>"
        : "<p class='muted'>No school year range set.</p>");
    return;
  }

  const filteredTests = state.tests.filter((t) => {
    if (!allowedStudentIds.has(t.studentId)) return false;
    if (!inRange(t.date, sy.startDate, sy.endDate)) return false;
    if (quarterRange && quarterFilter !== "all" && !inRange(t.date, quarterRange.startDate, quarterRange.endDate)) return false;
    if (subjectFilter !== "all" && t.subjectId !== subjectFilter) return false;
    if (!testMatchesInstructorFilter(t, instructorFilter)) return false;
    const gradeType = gradeTypeName(t);
    if (gradeTypeFilter !== "all" && gradeType !== gradeTypeFilter) return false;
    return true;
  });

  const seriesBase = selectedStudentIds.length
    ? selectedStudentIds.map((studentId) => ({ id: studentId, label: getStudentName(studentId), tests: filteredTests.filter((t) => t.studentId === studentId) }))
    : (isStudentUser()
      ? visibleStudents().map((student) => ({ id: student.id, label: getStudentName(student.id), tests: filteredTests.filter((t) => t.studentId === student.id) }))
      : [{ id: "all", label: "All Students", tests: filteredTests }]);
  const palette = ["#875422", "#2f6f3e", "#1f4d7a", "#8a3434", "#7c5f1f", "#5a3a88", "#35736f", "#9b4d2f"];

  const series = seriesBase.map((entry, idx) => {
    const monthly = months.map((monthEntry) => {
      const monthStart = new Date(monthEntry.year, monthEntry.month, 1, 12, 0, 0);
      const monthEnd = new Date(monthEntry.year, monthEntry.month + 1, 0, 12, 0, 0);
      const monthStartIso = toISO(monthStart);
      const monthEndIso = toISO(monthEnd);
      const monthTests = entry.tests.filter((t) => inRange(t.date, monthStartIso, monthEndIso));
      return {
        label: monthStart.toLocaleDateString(undefined, { month: "short" }),
        avg: weightedAverageForTests(monthTests),
        count: monthTests.length
      };
    });
    return { ...entry, color: palette[idx % palette.length], monthly };
  });

  const plottedValues = series.flatMap((lineSeries) =>
    lineSeries.monthly.filter((row) => row.count > 0).map((row) => row.avg));
  let yMin = 50;
  let yMax = 100;
  if (plottedValues.length) {
    const rawMin = Math.min(...plottedValues);
    const rawMax = Math.max(...plottedValues);
    yMin = Math.max(50, Math.floor((rawMin - 2) / 5) * 5);
    yMax = Math.min(100, Math.ceil((rawMax + 2) / 5) * 5);
    if (yMax - yMin < 10) {
      yMax = Math.min(100, yMin + 10);
      yMin = Math.max(50, yMax - 10);
    }
  }
  const yTickStep = (yMax - yMin) <= 30 ? 5 : 10;
  const yTicks = [];
  for (let tick = yMin; tick <= yMax; tick += yTickStep) yTicks.push(tick);
  if (yTicks[yTicks.length - 1] !== yMax) yTicks.push(yMax);

  const width = 960;
  const height = 260;
  const margin = { top: 62, right: 20, bottom: 48, left: 52 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const xPad = 16;
  const xSpan = Math.max(1, plotW - (xPad * 2));
  const xStep = months.length > 1 ? xSpan / (months.length - 1) : 0;
  const xFor = (idx) => margin.left + xPad + (xStep * idx);
  const yFor = (value) => {
    const clamped = clamp(value, yMin, yMax);
    return margin.top + ((yMax - clamped) / (yMax - yMin)) * plotH;
  };

  const yTickSvg = yTicks.map((tick) => {
    const y = yFor(tick);
    return `<g><line x1="${margin.left}" y1="${y.toFixed(2)}" x2="${(width - margin.right).toFixed(2)}" y2="${y.toFixed(2)}" class="trend-grid"/><text x="${(margin.left - 10).toFixed(2)}" y="${(y + 4).toFixed(2)}" text-anchor="end" class="trend-axis-label">${tick}</text></g>`;
  }).join("");

  const xTickSvg = months.map((row, idx) => {
    const monthStart = new Date(row.year, row.month, 1, 12, 0, 0);
    const x = xFor(idx);
    return `<text x="${x.toFixed(2)}" y="${(height - margin.bottom + 18).toFixed(2)}" text-anchor="middle" class="trend-axis-label">${monthStart.toLocaleDateString(undefined, { month: "short" })}</text>`;
  }).join("");

  const lineSvg = series.map((lineSeries) => {
    let path = "";
    lineSeries.monthly.forEach((row, idx) => {
      const x = xFor(idx);
      const y = yFor(row.avg || 0);
      if (!path) path += `M ${x.toFixed(2)} ${y.toFixed(2)} `;
      else path += `L ${x.toFixed(2)} ${y.toFixed(2)} `;
    });
    return `<path d="${path.trim()}" class="trend-line" style="stroke:${lineSeries.color}" fill="none"></path>`;
  }).join("");

  const pointSvg = series.flatMap((lineSeries) => lineSeries.monthly.map((row, idx) => {
    const x = xFor(idx);
    const y = yFor(row.avg || 0);
    return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="4" class="trend-point" style="fill:${lineSeries.color};stroke:${lineSeries.color}"><title>${lineSeries.label} ${row.label}: ${row.avg.toFixed(1)}%</title></circle>`;
  })).join("");

  const labelTop = margin.top + 10;
  const labelBottom = height - margin.bottom - 6;
  const minLabelGap = 12;
  const valueLabelParts = [];
  months.forEach((_, monthIdx) => {
    const monthLabels = series.map((lineSeries, lineIdx) => {
      const row = lineSeries.monthly[monthIdx];
      const x = xFor(monthIdx);
      const y = yFor(row.avg || 0);
      const nearTop = y <= margin.top + 16;
      const nearBottom = y >= (height - margin.bottom - 10);
      const offsetBase = ((monthIdx + lineIdx) % 2 === 0) ? -10 : 14;
      const offset = nearTop ? 22 : (nearBottom ? -10 : offsetBase);
      const preferredY = clamp(y + offset, labelTop, labelBottom);
      return {
        color: lineSeries.color,
        text: `${(row.avg || 0).toFixed(1)}%`,
        x,
        preferredY
      };
    }).sort((a, b) => a.preferredY - b.preferredY);

    // Push labels down to enforce a minimum vertical gap.
    for (let i = 1; i < monthLabels.length; i += 1) {
      if (monthLabels[i].preferredY - monthLabels[i - 1].preferredY < minLabelGap) {
        monthLabels[i].preferredY = monthLabels[i - 1].preferredY + minLabelGap;
      }
    }
    // If we overflow bottom, pull labels up while preserving spacing.
    const overflow = monthLabels.length ? monthLabels[monthLabels.length - 1].preferredY - labelBottom : 0;
    if (overflow > 0) {
      for (let i = monthLabels.length - 1; i >= 0; i -= 1) {
        monthLabels[i].preferredY -= overflow;
        if (i > 0 && monthLabels[i].preferredY - monthLabels[i - 1].preferredY < minLabelGap) {
          monthLabels[i - 1].preferredY = monthLabels[i].preferredY - minLabelGap;
        }
      }
    }
    // Final clamp safety.
    monthLabels.forEach((label) => {
      label.preferredY = clamp(label.preferredY, labelTop, labelBottom);
      valueLabelParts.push(`<text x="${label.x.toFixed(2)}" y="${label.preferredY.toFixed(2)}" text-anchor="middle" class="trend-value-label" style="fill:${label.color}">${label.text}</text>`);
    });
  });
  const valueLabelSvg = valueLabelParts.join("");

  const legendHtml = `
    <div class="trend-legend">
      ${series.map((lineSeries) => `
        <span class="trend-legend-item">
          <span class="trend-legend-line" style="background:${lineSeries.color}"></span>
          <span>${lineSeries.label}</span>
        </span>`).join("")}
    </div>`;

  const hasData = series.some((lineSeries) => lineSeries.monthly.some((row) => row.count > 0));
  const noData = hasData ? "" : `<text x="${(margin.left + plotW / 2).toFixed(2)}" y="${(margin.top + plotH / 2).toFixed(2)}" text-anchor="middle" class="trend-empty">No grade data for selected filters</text>`;

  chartHost.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="trend-chart" role="img" aria-label="Monthly grade trend line chart">
      <line x1="${margin.left}" y1="${(height - margin.bottom).toFixed(2)}" x2="${(width - margin.right).toFixed(2)}" y2="${(height - margin.bottom).toFixed(2)}" class="trend-axis"></line>
      <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${(height - margin.bottom).toFixed(2)}" class="trend-axis"></line>
      ${yTickSvg}
      ${xTickSvg}
      ${lineSvg}
      ${pointSvg}
      ${valueLabelSvg}
      ${noData}
      <text x="${(width / 2).toFixed(2)}" y="${(height - 8).toFixed(2)}" text-anchor="middle" class="trend-axis-title">Month</text>
      <text x="16" y="${(margin.top + plotH / 2).toFixed(2)}" text-anchor="middle" transform="rotate(-90 16 ${(margin.top + plotH / 2).toFixed(2)})" class="trend-axis-title">Average Grade (%)</text>
    </svg>
    ${legendHtml}`;
}

function renderGpaTrending() {
  const chartHost = document.getElementById("gpa-trending-chart");
  if (!chartHost) return;
  const allowedStudentIds = visibleStudentIds();

  const sy = state.settings.schoolYear;
  const syStart = toDate(sy.startDate);
  const syEnd = toDate(sy.endDate);
  const today = toDate(todayISO());
  const effectiveEnd = syEnd < today ? syEnd : today;

  const quarterFilter = document.getElementById("gpa-trend-filter-quarter")?.value || "all";
  const subjectFilter = document.getElementById("gpa-trend-filter-subject")?.value || "all";
  const instructorFilter = document.getElementById("gpa-trend-filter-instructor")?.value || "all";
  const gradeTypeFilter = document.getElementById("gpa-trend-filter-grade-type")?.value || "all";
  const selectedStudentIds = getGpaTrendSelectedStudentIds();
  const quarterRange = state.settings.quarters.find((q) => q.name === quarterFilter);
  const effectiveEndIso = toISO(effectiveEnd);
  let monthStartIso = sy.startDate;
  let monthEndIso = effectiveEndIso;
  if (quarterRange && quarterFilter !== "all") {
    if (toDate(quarterRange.startDate) > toDate(monthStartIso)) monthStartIso = quarterRange.startDate;
    if (toDate(quarterRange.endDate) < toDate(monthEndIso)) monthEndIso = quarterRange.endDate;
  }

  const months = schoolYearMonths(monthStartIso, monthEndIso);
  if (!months.length) {
    chartHost.innerHTML = syStart > today
      ? "<p class='muted'>School year has not started yet.</p>"
      : (quarterFilter !== "all"
        ? "<p class='muted'>No elapsed months in the selected quarter yet.</p>"
        : "<p class='muted'>No school year range set.</p>");
    return;
  }

  const filteredTests = state.tests.filter((t) => {
    if (!allowedStudentIds.has(t.studentId)) return false;
    if (!inRange(t.date, sy.startDate, sy.endDate)) return false;
    if (quarterRange && quarterFilter !== "all" && !inRange(t.date, quarterRange.startDate, quarterRange.endDate)) return false;
    if (subjectFilter !== "all" && t.subjectId !== subjectFilter) return false;
    if (!testMatchesInstructorFilter(t, instructorFilter)) return false;
    const gradeType = gradeTypeName(t);
    if (gradeTypeFilter !== "all" && gradeType !== gradeTypeFilter) return false;
    return true;
  });

  const seriesBase = selectedStudentIds.length
    ? selectedStudentIds.map((studentId) => ({ id: studentId, label: getStudentName(studentId), tests: filteredTests.filter((t) => t.studentId === studentId) }))
    : (isStudentUser()
      ? visibleStudents().map((student) => ({ id: student.id, label: getStudentName(student.id), tests: filteredTests.filter((t) => t.studentId === student.id) }))
      : [{ id: "all", label: "All Students", tests: filteredTests }]);
  const palette = ["#875422", "#2f6f3e", "#1f4d7a", "#8a3434", "#7c5f1f", "#5a3a88", "#35736f", "#9b4d2f"];

  const series = seriesBase.map((entry, idx) => {
    const monthly = months.map((monthEntry) => {
      const monthStart = new Date(monthEntry.year, monthEntry.month, 1, 12, 0, 0);
      const monthEnd = new Date(monthEntry.year, monthEntry.month + 1, 0, 12, 0, 0);
      const monthStartIso = toISO(monthStart);
      const monthEndIso = toISO(monthEnd);
      const monthTests = entry.tests.filter((t) => inRange(t.date, monthStartIso, monthEndIso));
      const averageGrade = weightedAverageForTests(monthTests);
      return {
        label: monthStart.toLocaleDateString(undefined, { month: "short" }),
        gpa: averageToGpa(averageGrade),
        count: monthTests.length
      };
    });
    return { ...entry, color: palette[idx % palette.length], monthly };
  });

  const width = 960;
  const height = 260;
  const margin = { top: 62, right: 20, bottom: 48, left: 52 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const xPad = 16;
  const xSpan = Math.max(1, plotW - (xPad * 2));
  const xStep = months.length > 1 ? xSpan / (months.length - 1) : 0;
  const xFor = (idx) => margin.left + xPad + (xStep * idx);
  const yMin = 0;
  const yMax = currentGpaMax();
  const tickCount = 4;
  const yTicks = Array.from({ length: tickCount + 1 }, (_, idx) => (yMax / tickCount) * idx);
  const yFor = (value) => {
    const clamped = clamp(value, yMin, yMax);
    return margin.top + ((yMax - clamped) / (yMax - yMin)) * plotH;
  };

  const yTickSvg = yTicks.map((tick) => {
    const y = yFor(tick);
    return `<g><line x1="${margin.left}" y1="${y.toFixed(2)}" x2="${(width - margin.right).toFixed(2)}" y2="${y.toFixed(2)}" class="trend-grid"/><text x="${(margin.left - 10).toFixed(2)}" y="${(y + 4).toFixed(2)}" text-anchor="end" class="trend-axis-label">${tick.toFixed(1)}</text></g>`;
  }).join("");

  const xTickSvg = months.map((row, idx) => {
    const monthStart = new Date(row.year, row.month, 1, 12, 0, 0);
    const x = xFor(idx);
    return `<text x="${x.toFixed(2)}" y="${(height - margin.bottom + 18).toFixed(2)}" text-anchor="middle" class="trend-axis-label">${monthStart.toLocaleDateString(undefined, { month: "short" })}</text>`;
  }).join("");

  const lineSvg = series.map((lineSeries) => {
    let path = "";
    lineSeries.monthly.forEach((row, idx) => {
      const x = xFor(idx);
      const y = yFor(row.gpa || 0);
      if (!path) path += `M ${x.toFixed(2)} ${y.toFixed(2)} `;
      else path += `L ${x.toFixed(2)} ${y.toFixed(2)} `;
    });
    return `<path d="${path.trim()}" class="trend-line" style="stroke:${lineSeries.color}" fill="none"></path>`;
  }).join("");

  const pointSvg = series.flatMap((lineSeries) => lineSeries.monthly.map((row, idx) => {
    const x = xFor(idx);
    const y = yFor(row.gpa || 0);
    return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="4" class="trend-point" style="fill:${lineSeries.color};stroke:${lineSeries.color}"><title>${lineSeries.label} ${row.label}: ${row.gpa.toFixed(2)} GPA</title></circle>`;
  })).join("");

  const labelTop = margin.top + 10;
  const labelBottom = height - margin.bottom - 6;
  const minLabelGap = 12;
  const valueLabelParts = [];
  months.forEach((_, monthIdx) => {
    const monthLabels = series.map((lineSeries, lineIdx) => {
      const row = lineSeries.monthly[monthIdx];
      const x = xFor(monthIdx);
      const y = yFor(row.gpa || 0);
      const nearTop = y <= margin.top + 16;
      const nearBottom = y >= (height - margin.bottom - 10);
      const offsetBase = ((monthIdx + lineIdx) % 2 === 0) ? -10 : 14;
      const offset = nearTop ? 22 : (nearBottom ? -10 : offsetBase);
      const preferredY = clamp(y + offset, labelTop, labelBottom);
      return {
        color: lineSeries.color,
        text: `${(row.gpa || 0).toFixed(2)}`,
        x,
        preferredY
      };
    }).sort((a, b) => a.preferredY - b.preferredY);

    for (let i = 1; i < monthLabels.length; i += 1) {
      if (monthLabels[i].preferredY - monthLabels[i - 1].preferredY < minLabelGap) {
        monthLabels[i].preferredY = monthLabels[i - 1].preferredY + minLabelGap;
      }
    }
    const overflow = monthLabels.length ? monthLabels[monthLabels.length - 1].preferredY - labelBottom : 0;
    if (overflow > 0) {
      for (let i = monthLabels.length - 1; i >= 0; i -= 1) {
        monthLabels[i].preferredY -= overflow;
        if (i > 0 && monthLabels[i].preferredY - monthLabels[i - 1].preferredY < minLabelGap) {
          monthLabels[i - 1].preferredY = monthLabels[i].preferredY - minLabelGap;
        }
      }
    }
    monthLabels.forEach((label) => {
      label.preferredY = clamp(label.preferredY, labelTop, labelBottom);
      valueLabelParts.push(`<text x="${label.x.toFixed(2)}" y="${label.preferredY.toFixed(2)}" text-anchor="middle" class="trend-value-label" style="fill:${label.color}">${label.text}</text>`);
    });
  });
  const valueLabelSvg = valueLabelParts.join("");

  const legendHtml = `
    <div class="trend-legend">
      ${series.map((lineSeries) => `
        <span class="trend-legend-item">
          <span class="trend-legend-line" style="background:${lineSeries.color}"></span>
          <span>${lineSeries.label}</span>
        </span>`).join("")}
    </div>`;

  const hasData = series.some((lineSeries) => lineSeries.monthly.some((row) => row.count > 0));
  const noData = hasData ? "" : `<text x="${(margin.left + plotW / 2).toFixed(2)}" y="${(margin.top + plotH / 2).toFixed(2)}" text-anchor="middle" class="trend-empty">No grade data for selected filters</text>`;

  chartHost.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="trend-chart" role="img" aria-label="Monthly GPA trend line chart">
      <line x1="${margin.left}" y1="${(height - margin.bottom).toFixed(2)}" x2="${(width - margin.right).toFixed(2)}" y2="${(height - margin.bottom).toFixed(2)}" class="trend-axis"></line>
      <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${(height - margin.bottom).toFixed(2)}" class="trend-axis"></line>
      ${yTickSvg}
      ${xTickSvg}
      ${lineSvg}
      ${pointSvg}
      ${valueLabelSvg}
      ${noData}
      <text x="${(width / 2).toFixed(2)}" y="${(height - 8).toFixed(2)}" text-anchor="middle" class="trend-axis-title">Month</text>
      <text x="16" y="${(margin.top + plotH / 2).toFixed(2)}" text-anchor="middle" transform="rotate(-90 16 ${(margin.top + plotH / 2).toFixed(2)})" class="trend-axis-title">GPA (${currentGpaMax().toFixed(1)} scale)</text>
    </svg>
    ${legendHtml}`;
}

function renderInstructionHoursTrending() {
  const chartHost = document.getElementById("instruction-hours-trending-chart");
  if (!chartHost) return;
  const allowedStudentIds = visibleStudentIds();

  const sy = state.settings.schoolYear;
  const syStart = toDate(sy.startDate);
  const syEnd = toDate(sy.endDate);
  const today = toDate(todayISO());
  const effectiveEnd = syEnd < today ? syEnd : today;

  const quarterFilter = document.getElementById("instruction-hours-trend-filter-quarter")?.value || "all";
  const subjectFilter = document.getElementById("instruction-hours-trend-filter-subject")?.value || "all";
  const instructorFilter = document.getElementById("instruction-hours-trend-filter-instructor")?.value || "all";
  const selectedStudentIds = getInstructionHoursTrendSelectedStudentIds();
  const quarterRange = state.settings.quarters.find((q) => q.name === quarterFilter);
  const effectiveEndIso = toISO(effectiveEnd);
  let monthStartIso = sy.startDate;
  let monthEndIso = effectiveEndIso;
  if (quarterRange && quarterFilter !== "all") {
    if (toDate(quarterRange.startDate) > toDate(monthStartIso)) monthStartIso = quarterRange.startDate;
    if (toDate(quarterRange.endDate) < toDate(monthEndIso)) monthEndIso = quarterRange.endDate;
  }

  const months = schoolYearMonths(monthStartIso, monthEndIso);
  if (!months.length) {
    chartHost.innerHTML = syStart > today
      ? "<p class='muted'>School year has not started yet.</p>"
      : (quarterFilter !== "all"
        ? "<p class='muted'>No elapsed months in the selected quarter yet.</p>"
        : "<p class='muted'>No school year range set.</p>");
    return;
  }

  const targetStudentIds = selectedStudentIds.length
    ? selectedStudentIds.filter((studentId) => allowedStudentIds.has(studentId))
    : (isStudentUser() ? visibleStudents().map((student) => student.id) : []);
  const targetStudentIdSet = new Set(targetStudentIds);
  const seriesBase = targetStudentIds.length
    ? targetStudentIds.map((studentId) => ({ id: studentId, label: getStudentName(studentId) }))
    : [{ id: "all", label: "All Students" }];
  const seriesIndex = new Map(seriesBase.map((entry) => [entry.id, entry]));
  const monthlyHours = new Map(seriesBase.map((entry) => [entry.id, new Map(months.map((month) => [`${month.year}-${month.month}`, 0]))]));
  const attendanceByStudentDate = new Map();

  state.attendance.forEach((record) => {
    if (!allowedStudentIds.has(record.studentId)) return;
    const key = `${record.studentId}||${record.date}`;
    if (!attendanceByStudentDate.has(key)) {
      attendanceByStudentDate.set(key, !!record.present);
      return;
    }
    const existingPresent = attendanceByStudentDate.get(key);
    if (existingPresent && !record.present) attendanceByStudentDate.set(key, false);
  });

  const cursor = new Date(syStart);
  while (cursor <= effectiveEnd) {
    const dateKey = toISO(cursor);
    const events = calendarEventsForDate(dateKey, Array.from(allowedStudentIds));
    events.forEach((event) => {
      if (!allowedStudentIds.has(event.studentId)) return;
      if (targetStudentIds.length && !targetStudentIdSet.has(event.studentId)) return;
      if (quarterRange && quarterFilter !== "all" && !inRange(dateKey, quarterRange.startDate, quarterRange.endDate)) return;
      if (attendanceByStudentDate.get(`${event.studentId}||${dateKey}`) !== true) return;
      const course = getCourse(event.courseId);
      if (!course) return;
      if (subjectFilter !== "all" && course.subjectId !== subjectFilter) return;
      if (!instructionMatchesInstructorFilter(event.studentId, event.courseId, dateKey, instructorFilter)) return;
      const block = Array.from(dailyScheduledBlocks(dateKey, [event.studentId], subjectFilter !== "all" ? [course.subjectId] : [], [event.courseId]).values()).flat()
        .find((entry) => entry.type === "instruction" && entry.studentId === event.studentId && entry.courseId === event.courseId);
      const hours = Number(block?.actualMinutes || 0) / 60;
      if (!(hours > 0)) return;

      const monthKey = `${cursor.getFullYear()}-${cursor.getMonth()}`;
      if (!monthlyHours.get(seriesBase[0].id)?.has(monthKey)) return;

      if (seriesIndex.has(event.studentId)) {
        monthlyHours.set(event.studentId, monthlyHours.get(event.studentId) || new Map());
        monthlyHours.get(event.studentId).set(monthKey, (monthlyHours.get(event.studentId).get(monthKey) || 0) + hours);
        return;
      }
      if (monthlyHours.has("all")) {
        monthlyHours.get("all").set(monthKey, (monthlyHours.get("all").get(monthKey) || 0) + hours);
      }
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  const palette = ["#875422", "#2f6f3e", "#1f4d7a", "#8a3434", "#7c5f1f", "#5a3a88", "#35736f", "#9b4d2f"];
  const series = seriesBase.map((entry, idx) => ({
    ...entry,
    color: palette[idx % palette.length],
    monthly: months.map((monthEntry) => {
      const monthStart = new Date(monthEntry.year, monthEntry.month, 1, 12, 0, 0);
      const total = Number(monthlyHours.get(entry.id)?.get(`${monthEntry.year}-${monthEntry.month}`) || 0);
      return {
        label: monthStart.toLocaleDateString(undefined, { month: "short" }),
        hours: total
      };
    })
  }));

  const plottedValues = series.flatMap((lineSeries) => lineSeries.monthly.map((row) => row.hours));
  const rawMax = plottedValues.length ? Math.max(...plottedValues) : 0;
  const yMax = rawMax > 0 ? Math.ceil((rawMax + Math.max(2, rawMax * 0.08)) / 5) * 5 : 10;
  const yTickStep = yMax <= 20 ? 2 : (yMax <= 60 ? 5 : (yMax <= 120 ? 10 : 20));
  const yTicks = [];
  for (let tick = 0; tick <= yMax; tick += yTickStep) yTicks.push(tick);
  if (yTicks[yTicks.length - 1] !== yMax) yTicks.push(yMax);

  const width = 960;
  const height = 260;
  const margin = { top: 62, right: 20, bottom: 48, left: 52 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const xPad = 16;
  const xSpan = Math.max(1, plotW - (xPad * 2));
  const xStep = months.length > 1 ? xSpan / (months.length - 1) : 0;
  const xFor = (idx) => margin.left + xPad + (xStep * idx);
  const yFor = (value) => {
    const clamped = clamp(value, 0, yMax);
    return margin.top + ((yMax - clamped) / Math.max(yMax, 1)) * plotH;
  };

  const yTickSvg = yTicks.map((tick) => {
    const y = yFor(tick);
    return `<g><line x1="${margin.left}" y1="${y.toFixed(2)}" x2="${(width - margin.right).toFixed(2)}" y2="${y.toFixed(2)}" class="trend-grid"/><text x="${(margin.left - 10).toFixed(2)}" y="${(y + 4).toFixed(2)}" text-anchor="end" class="trend-axis-label">${tick.toFixed(1)}</text></g>`;
  }).join("");

  const xTickSvg = months.map((row, idx) => {
    const monthStart = new Date(row.year, row.month, 1, 12, 0, 0);
    const x = xFor(idx);
    return `<text x="${x.toFixed(2)}" y="${(height - margin.bottom + 18).toFixed(2)}" text-anchor="middle" class="trend-axis-label">${monthStart.toLocaleDateString(undefined, { month: "short" })}</text>`;
  }).join("");

  const lineSvg = series.map((lineSeries) => {
    let path = "";
    lineSeries.monthly.forEach((row, idx) => {
      const x = xFor(idx);
      const y = yFor(row.hours || 0);
      if (!path) path += `M ${x.toFixed(2)} ${y.toFixed(2)} `;
      else path += `L ${x.toFixed(2)} ${y.toFixed(2)} `;
    });
    return `<path d="${path.trim()}" class="trend-line" style="stroke:${lineSeries.color}" fill="none"></path>`;
  }).join("");

  const pointSvg = series.flatMap((lineSeries) => lineSeries.monthly.map((row, idx) => {
    const x = xFor(idx);
    const y = yFor(row.hours || 0);
    return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="4" class="trend-point" style="fill:${lineSeries.color};stroke:${lineSeries.color}"><title>${lineSeries.label} ${row.label}: ${row.hours.toFixed(1)} hours</title></circle>`;
  })).join("");

  const labelTop = margin.top + 10;
  const labelBottom = height - margin.bottom - 6;
  const minLabelGap = 12;
  const valueLabelParts = [];
  months.forEach((_, monthIdx) => {
    const monthLabels = series.map((lineSeries, lineIdx) => {
      const row = lineSeries.monthly[monthIdx];
      const x = xFor(monthIdx);
      const y = yFor(row.hours || 0);
      const nearTop = y <= margin.top + 16;
      const nearBottom = y >= (height - margin.bottom - 10);
      const offsetBase = ((monthIdx + lineIdx) % 2 === 0) ? -10 : 14;
      const offset = nearTop ? 22 : (nearBottom ? -10 : offsetBase);
      const preferredY = clamp(y + offset, labelTop, labelBottom);
      return {
        color: lineSeries.color,
        text: `${(row.hours || 0).toFixed(1)}`,
        x,
        preferredY
      };
    }).sort((a, b) => a.preferredY - b.preferredY);

    for (let i = 1; i < monthLabels.length; i += 1) {
      if (monthLabels[i].preferredY - monthLabels[i - 1].preferredY < minLabelGap) {
        monthLabels[i].preferredY = monthLabels[i - 1].preferredY + minLabelGap;
      }
    }
    const overflow = monthLabels.length ? monthLabels[monthLabels.length - 1].preferredY - labelBottom : 0;
    if (overflow > 0) {
      for (let i = monthLabels.length - 1; i >= 0; i -= 1) {
        monthLabels[i].preferredY -= overflow;
        if (i > 0 && monthLabels[i].preferredY - monthLabels[i - 1].preferredY < minLabelGap) {
          monthLabels[i - 1].preferredY = monthLabels[i].preferredY - minLabelGap;
        }
      }
    }
    monthLabels.forEach((label) => {
      label.preferredY = clamp(label.preferredY, labelTop, labelBottom);
      valueLabelParts.push(`<text x="${label.x.toFixed(2)}" y="${label.preferredY.toFixed(2)}" text-anchor="middle" class="trend-value-label" style="fill:${label.color}">${label.text}</text>`);
    });
  });
  const valueLabelSvg = valueLabelParts.join("");

  const legendHtml = `
    <div class="trend-legend">
      ${series.map((lineSeries) => `
        <span class="trend-legend-item">
          <span class="trend-legend-line" style="background:${lineSeries.color}"></span>
          <span>${lineSeries.label}</span>
        </span>`).join("")}
    </div>`;

  const hasData = series.some((lineSeries) => lineSeries.monthly.some((row) => row.hours > 0));
  const noData = hasData ? "" : `<text x="${(margin.left + plotW / 2).toFixed(2)}" y="${(margin.top + plotH / 2).toFixed(2)}" text-anchor="middle" class="trend-empty">No instructional hours for selected filters</text>`;

  chartHost.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="trend-chart" role="img" aria-label="Monthly instructional hours trend line chart">
      <line x1="${margin.left}" y1="${(height - margin.bottom).toFixed(2)}" x2="${(width - margin.right).toFixed(2)}" y2="${(height - margin.bottom).toFixed(2)}" class="trend-axis"></line>
      <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${(height - margin.bottom).toFixed(2)}" class="trend-axis"></line>
      ${yTickSvg}
      ${xTickSvg}
      ${lineSvg}
      ${pointSvg}
      ${valueLabelSvg}
      ${noData}
      <text x="${(width / 2).toFixed(2)}" y="${(height - 8).toFixed(2)}" text-anchor="middle" class="trend-axis-title">Month</text>
      <text x="16" y="${(margin.top + plotH / 2).toFixed(2)}" text-anchor="middle" transform="rotate(-90 16 ${(margin.top + plotH / 2).toFixed(2)})" class="trend-axis-title">Instruction Hours</text>
    </svg>
    ${legendHtml}`;
}

function renderGradeTypeVolumeChart() {
  const chartHost = document.getElementById("grade-type-volume-chart");
  if (!chartHost) return;
  const allowedStudentIds = visibleStudentIds();

  const sy = state.settings.schoolYear;
  const syStart = toDate(sy.startDate);
  const syEnd = toDate(sy.endDate);
  const today = toDate(todayISO());
  const effectiveEnd = syEnd < today ? syEnd : today;
  const months = schoolYearMonths(sy.startDate, toISO(effectiveEnd));
  if (!months.length) {
    chartHost.innerHTML = syStart > today
      ? "<p class='muted'>School year has not started yet.</p>"
      : "<p class='muted'>No school year range set.</p>";
    return;
  }

  const quarterFilter = document.getElementById("volume-filter-quarter")?.value || "all";
  const subjectFilter = document.getElementById("volume-filter-subject")?.value || "all";
  const instructorFilter = document.getElementById("volume-filter-instructor")?.value || "all";
  const gradeTypeFilter = document.getElementById("volume-filter-grade-type")?.value || "all";
  const selectedStudentIds = getVolumeSelectedStudentIds();
  const quarterRange = state.settings.quarters.find((q) => q.name === quarterFilter);

  const knownTypes = availableGradeTypes().length ? [...availableGradeTypes()] : [...DEFAULT_GRADE_TYPES];
  const inYearTests = state.tests.filter((t) => inRange(t.date, sy.startDate, sy.endDate));
  const filteredTests = inYearTests.filter((t) => {
    if (!allowedStudentIds.has(t.studentId)) return false;
    if (quarterRange && quarterFilter !== "all" && !inRange(t.date, quarterRange.startDate, quarterRange.endDate)) return false;
    if (subjectFilter !== "all" && t.subjectId !== subjectFilter) return false;
    if (!testMatchesInstructorFilter(t, instructorFilter)) return false;
    const thisType = gradeTypeName(t);
    if (gradeTypeFilter !== "all" && thisType !== gradeTypeFilter) return false;
    if (selectedStudentIds.length && !selectedStudentIds.includes(t.studentId)) return false;
    return true;
  });

  filteredTests.forEach((test) => {
    const gradeType = gradeTypeName(test);
    if (!knownTypes.includes(gradeType)) knownTypes.push(gradeType);
  });

  const monthlyCounts = months.map((entry) => {
    const monthStart = new Date(entry.year, entry.month, 1, 12, 0, 0);
    const monthEnd = new Date(entry.year, entry.month + 1, 0, 12, 0, 0);
    const monthStartIso = toISO(monthStart);
    const monthEndIso = toISO(monthEnd);
    const tests = filteredTests.filter((t) => inRange(t.date, monthStartIso, monthEndIso));
    const counts = new Map(knownTypes.map((type) => [type, 0]));
    tests.forEach((test) => {
      const gradeType = gradeTypeName(test);
      counts.set(gradeType, (counts.get(gradeType) || 0) + 1);
    });
    return {
      label: monthStart.toLocaleDateString(undefined, { month: "short" }),
      counts
    };
  });

  const maxCount = Math.max(1, ...monthlyCounts.flatMap((m) => knownTypes.map((type) => m.counts.get(type) || 0)));
  const yTickStep = maxCount <= 10 ? 1 : (maxCount <= 30 ? 5 : 10);
  const yTicks = [];
  for (let tick = 0; tick <= maxCount; tick += yTickStep) yTicks.push(tick);
  if (yTicks[yTicks.length - 1] !== maxCount) yTicks.push(maxCount);

  const width = 960;
  const height = 300;
  const margin = { top: 24, right: 20, bottom: 56, left: 52 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  const groupCount = months.length;
  const groupSlot = plotW / Math.max(1, groupCount);
  const groupWidth = Math.min(86, groupSlot * 0.82);
  const barGap = 2;
  const barCount = Math.max(1, knownTypes.length);
  const barWidth = Math.max(3, (groupWidth - (barGap * (barCount - 1))) / barCount);

  const xGroupStart = (idx) => margin.left + (idx * groupSlot) + ((groupSlot - groupWidth) / 2);
  const xForBar = (monthIdx, typeIdx) => xGroupStart(monthIdx) + (typeIdx * (barWidth + barGap));
  const yFor = (value) => margin.top + ((maxCount - value) / maxCount) * plotH;

  const yTickSvg = yTicks.map((tick) => {
    const y = yFor(tick);
    return `<g><line x1="${margin.left}" y1="${y.toFixed(2)}" x2="${(width - margin.right).toFixed(2)}" y2="${y.toFixed(2)}" class="trend-grid"/><text x="${(margin.left - 10).toFixed(2)}" y="${(y + 4).toFixed(2)}" text-anchor="end" class="trend-axis-label">${tick}</text></g>`;
  }).join("");

  const xTickSvg = monthlyCounts.map((row, idx) => {
    const x = xGroupStart(idx) + (groupWidth / 2);
    return `<text x="${x.toFixed(2)}" y="${(height - margin.bottom + 18).toFixed(2)}" text-anchor="middle" class="trend-axis-label">${row.label}</text>`;
  }).join("");

  const palette = ["#875422", "#2f6f3e", "#1f4d7a", "#8a3434", "#7c5f1f", "#5a3a88", "#35736f", "#9b4d2f"];
  const barsSvg = monthlyCounts.flatMap((row, monthIdx) =>
    knownTypes.map((type, typeIdx) => {
      const count = row.counts.get(type) || 0;
      const x = xForBar(monthIdx, typeIdx);
      const y = yFor(count);
      const h = Math.max(0, (height - margin.bottom) - y);
      const color = palette[typeIdx % palette.length];
      return `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${barWidth.toFixed(2)}" height="${h.toFixed(2)}" fill="${color}" opacity="0.9"><title>${row.label} ${type}: ${count}</title></rect>`;
    })
  ).join("");

  const totalCounts = monthlyCounts.reduce((sum, row) =>
    sum + knownTypes.reduce((inner, type) => inner + (row.counts.get(type) || 0), 0), 0);
  const noData = totalCounts === 0
    ? `<text x="${(margin.left + plotW / 2).toFixed(2)}" y="${(margin.top + plotH / 2).toFixed(2)}" text-anchor="middle" class="trend-empty">No grade entries for this school year</text>`
    : "";

  const legendHtml = `
    <div class="trend-legend">
      ${knownTypes.map((type, idx) => `
        <span class="trend-legend-item">
          <span class="volume-legend-box" style="background:${palette[idx % palette.length]}"></span>
          <span>${type}</span>
        </span>`).join("")}
    </div>`;

  chartHost.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="trend-chart" role="img" aria-label="Monthly grade type volume bar chart">
      <line x1="${margin.left}" y1="${(height - margin.bottom).toFixed(2)}" x2="${(width - margin.right).toFixed(2)}" y2="${(height - margin.bottom).toFixed(2)}" class="trend-axis"></line>
      <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${(height - margin.bottom).toFixed(2)}" class="trend-axis"></line>
      ${yTickSvg}
      ${xTickSvg}
      ${barsSvg}
      ${noData}
      <text x="${(width / 2).toFixed(2)}" y="${(height - 8).toFixed(2)}" text-anchor="middle" class="trend-axis-title">Month</text>
      <text x="16" y="${(margin.top + plotH / 2).toFixed(2)}" text-anchor="middle" transform="rotate(-90 16 ${(margin.top + plotH / 2).toFixed(2)})" class="trend-axis-title">Count</text>
    </svg>
    ${legendHtml}`;
}

function renderWorkDistributionChart() {
  const chartHost = document.getElementById("work-distribution-chart");
  if (!chartHost) return;
  const allowedStudentIds = visibleStudentIds();
  const availableTypes = availableGradeTypes();
  const selectedGradeTypes = workDistributionSelectedGradeTypes.size
    ? Array.from(workDistributionSelectedGradeTypes)
    : availableTypes;
  const selectedGradeTypeSet = new Set(selectedGradeTypes);

  const sy = state.settings.schoolYear;
  const quarterFilter = document.getElementById("work-filter-quarter")?.value || "all";
  const instructorFilter = document.getElementById("work-filter-instructor")?.value || "all";
  const selectedStudentIds = getWorkSelectedStudentIds();
  const quarterRange = state.settings.quarters.find((q) => q.name === quarterFilter);

  const filteredTests = state.tests.filter((t) => {
    if (!allowedStudentIds.has(t.studentId)) return false;
    if (!inRange(t.date, sy.startDate, sy.endDate)) return false;
    if (quarterRange && quarterFilter !== "all" && !inRange(t.date, quarterRange.startDate, quarterRange.endDate)) return false;
    if (selectedStudentIds.length && !selectedStudentIds.includes(t.studentId)) return false;
    if (!testMatchesInstructorFilter(t, instructorFilter)) return false;
    const gradeType = resolveGradeType(t);
    if (!gradeType) return false;
    return selectedGradeTypeSet.has(gradeType);
  });

  const bySubject = new Map();
  filteredTests.forEach((test) => {
    const subjectName = getSubjectName(test.subjectId);
    bySubject.set(subjectName, (bySubject.get(subjectName) || 0) + 1);
  });

  const entries = Array.from(bySubject.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const total = entries.reduce((sum, [, count]) => sum + count, 0);
  const selectedGradeTypeLabel = selectedGradeTypes.length === availableTypes.length
    ? "All"
    : selectedGradeTypes.join(", ");

  if (!total) {
    chartHost.innerHTML = `<p class='muted'>No grades found for the selected grade types: ${escapeHtml(selectedGradeTypeLabel)}.</p>`;
    return;
  }

  const palette = ["#875422", "#2f6f3e", "#1f4d7a", "#8a3434", "#7c5f1f", "#5a3a88", "#35736f", "#9b4d2f"];
  const size = 560;
  const cx = 280;
  const cy = 280;
  const radius = 215;

  function polarToCartesian(centerX, centerY, r, angleDeg) {
    const angleRad = ((angleDeg - 90) * Math.PI) / 180;
    return {
      x: centerX + (r * Math.cos(angleRad)),
      y: centerY + (r * Math.sin(angleRad))
    };
  }

  function arcPath(centerX, centerY, r, startAngle, endAngle) {
    const start = polarToCartesian(centerX, centerY, r, endAngle);
    const end = polarToCartesian(centerX, centerY, r, startAngle);
    const largeArc = endAngle - startAngle > 180 ? 1 : 0;
    return `M ${centerX} ${centerY} L ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArc} 0 ${end.x.toFixed(2)} ${end.y.toFixed(2)} Z`;
  }

  let currentAngle = 0;
  const slices = entries.map(([subject, count], idx) => {
    const pctValue = (count / total) * 100;
    const startAngle = currentAngle;
    const endAngle = currentAngle + ((count / total) * 360);
    currentAngle = endAngle;
    const color = palette[idx % palette.length];
    return {
      subject,
      count,
      pctText: `${pctValue.toFixed(1)}%`,
      color,
      isFull: pctValue >= 99.999,
      path: arcPath(cx, cy, radius, startAngle, endAngle)
    };
  });

  const sliceSvg = slices.map((slice) =>
    slice.isFull
      ? `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${slice.color}" stroke="#ffffff" stroke-width="1"><title>${slice.subject}: ${slice.count} (${slice.pctText})</title></circle>`
      : `<path d="${slice.path}" fill="${slice.color}" stroke="#ffffff" stroke-width="1"><title>${slice.subject}: ${slice.count} (${slice.pctText})</title></path>`
  ).join("");

  const labelSvg = slices.map((slice, idx) => {
    const startAngle = idx === 0 ? 0 : slices.slice(0, idx).reduce((sum, s) => sum + ((s.count / total) * 360), 0);
    const endAngle = startAngle + ((slice.count / total) * 360);
    const midAngle = (startAngle + endAngle) / 2;
    const point = polarToCartesian(cx, cy, radius * 0.62, midAngle);
    const textColor = "#1a1a1a";
    return `<text x="${point.x.toFixed(2)}" y="${point.y.toFixed(2)}" text-anchor="middle" dominant-baseline="middle" class="pie-slice-label" fill="${textColor}">${slice.subject} ${slice.pctText}</text>`;
  }).join("");

  chartHost.innerHTML = `
    <div class="pie-wrap">
      <svg viewBox="0 0 ${size} ${size}" class="pie-chart" role="img" aria-label="Work distribution by subject">
        ${sliceSvg}
        ${labelSvg}
      </svg>
      <div class="pie-total">Total Grades: ${total}</div>
      <div class="muted">Grade Types: ${escapeHtml(selectedGradeTypeLabel)}</div>
    </div>`;
}

function renderDashboard() {
  const allowedStudentIds = visibleStudentIds();
  const dashboardStudents = visibleStudents();
  const dates = instructionalDates();
  const dateSet = new Set(dates);
  const presentSet = new Set(state.attendance
    .filter((a) => allowedStudentIds.has(a.studentId) && a.present && a.date <= todayISO())
    .map((a) => a.date));
  const completeDays = Array.from(presentSet).filter((d) => dateSet.has(d)).length;
  const totalDays = dates.length;

  document.getElementById("kpi-days-complete").textContent = String(completeDays);
  document.getElementById("kpi-days-total").textContent = String(totalDays);

  const g = gradeAnalytics();
  const dashboardInstructionalHours = buildInstructionalHoursSnapshot(dashboardStudents.map((student) => student.id));
  const instructionalTotals = Array.from(dashboardInstructionalHours.summaryByStudent.values()).reduce((totals, studentSummary) => {
    totals.earned += Number(studentSummary.buckets.total?.earned || 0);
    totals.projected += Number(studentSummary.buckets.total?.projected || 0);
    return totals;
  }, { earned: 0, projected: 0 });
  document.getElementById("kpi-instruction-hours").textContent = `${instructionalTotals.earned.toFixed(1)} / ${instructionalTotals.projected.toFixed(1)}`;
  const runningAverage = isStudentUser() && dashboardStudents.length === 1
    ? studentOverallAverage(dashboardStudents[0].id)
    : g.running;
  document.getElementById("kpi-running-avg").textContent = `${runningAverage.toFixed(1)}%`;

  const attendanceDatesThroughToday = dates.filter((d) => d <= todayISO());
  const totalAttendanceDays = attendanceDatesThroughToday.length;
  const attendanceTotals = dashboardStudents.reduce((totals, student) => {
    const summary = studentAttendanceSummary(student.id);
    totals.present += Number(summary.attended || 0);
    return totals;
  }, { present: 0 });
  const totalPossibleAttendance = totalAttendanceDays * dashboardStudents.length;
  const overallAttendanceAverage = totalPossibleAttendance > 0
    ? (attendanceTotals.present / totalPossibleAttendance) * 100
    : 0;
  document.getElementById("kpi-attendance-overall").textContent = `${overallAttendanceAverage.toFixed(1)}%`;

  const yP = progress(state.settings.schoolYear.startDate, state.settings.schoolYear.endDate);
  const q = currentQuarter(new Date());
  const qP = q ? progress(q.startDate, q.endDate) : 0;

  document.getElementById("year-progress-fill").style.width = `${yP.toFixed(1)}%`;
  document.getElementById("year-progress-text").textContent = `${state.settings.schoolYear.label}: ${yP.toFixed(1)}%`;
  document.getElementById("quarter-progress-fill").style.width = `${qP.toFixed(1)}%`;
  document.getElementById("quarter-progress-text").textContent = q ? `${q.name}: ${qP.toFixed(1)}%` : "No quarter set";

  const validStudentIds = new Set(dashboardStudents.map((student) => student.id));
  Array.from(expandedStudentAverageRows).forEach((studentId) => {
    if (!validStudentIds.has(studentId)) expandedStudentAverageRows.delete(studentId);
  });
  Array.from(expandedSubjectAverageRows).forEach((subjectKey) => {
    const studentId = subjectKey.split("::")[0];
    if (!validStudentIds.has(studentId)) expandedSubjectAverageRows.delete(subjectKey);
  });
  Array.from(expandedStudentAttendanceRows).forEach((studentId) => {
    if (!validStudentIds.has(studentId)) expandedStudentAttendanceRows.delete(studentId);
  });
  Array.from(expandedStudentInstructionalHourRows).forEach((studentId) => {
    if (!validStudentIds.has(studentId)) expandedStudentInstructionalHourRows.delete(studentId);
  });
  Array.from(trendSelectedStudentIds).forEach((studentId) => {
    if (!validStudentIds.has(studentId)) trendSelectedStudentIds.delete(studentId);
  });
  Array.from(gpaTrendSelectedStudentIds).forEach((studentId) => {
    if (!validStudentIds.has(studentId)) gpaTrendSelectedStudentIds.delete(studentId);
  });
  Array.from(volumeSelectedStudentIds).forEach((studentId) => {
    if (!validStudentIds.has(studentId)) volumeSelectedStudentIds.delete(studentId);
  });
  Array.from(workSelectedStudentIds).forEach((studentId) => {
    if (!validStudentIds.has(studentId)) workSelectedStudentIds.delete(studentId);
  });
  Array.from(reportSelectedStudentIds).forEach((studentId) => {
    if (!validStudentIds.has(studentId)) reportSelectedStudentIds.delete(studentId);
  });
  const validInstructorIds = new Set(state.instructors.map((instructor) => instructor.id));
  Array.from(studentPerformanceSelectedInstructorIds).forEach((instructorId) => {
    if (!validInstructorIds.has(instructorId)) studentPerformanceSelectedInstructorIds.delete(instructorId);
  });
  Array.from(studentInstructionalHoursSelectedInstructorIds).forEach((instructorId) => {
    if (!validInstructorIds.has(instructorId)) studentInstructionalHoursSelectedInstructorIds.delete(instructorId);
  });
  renderStudentPerformanceInstructorChecklist(Array.from(studentPerformanceSelectedInstructorIds));
  renderStudentInstructionalHoursInstructorChecklist(Array.from(studentInstructionalHoursSelectedInstructorIds));

  const quarterByName = new Map(state.settings.quarters.map((entry) => [entry.name, entry]));
  const selectedGradeMethods = getSelectedStudentPerformanceGradeMethods();
  const studentPerformanceInstructorFilter = Array.from(studentPerformanceSelectedInstructorIds);
  const studentInstructionalHoursInstructorFilter = Array.from(studentInstructionalHoursSelectedInstructorIds);
  const formatAvgCell = (avgValue, count) => {
    if (count <= 0) return "No grades";
    return selectedGradeMethods.map((method) => {
      if (method === "Percentage") return `${avgValue.toFixed(1)}%`;
      if (method === "Letter") return scoreToLetterGrade(avgValue) || "-";
      if (method === "GPA") return averageToGpa(avgValue).toFixed(2);
      return "";
    }).filter(Boolean).join("/");
  };
  const gradeTypeOrder = ["Assignment", "Quiz", "Test", "Quarterly Final", "Final"];
  const studentMetrics = dashboardStudents
    .map((student) => {
      const studentTests = state.tests.filter((t) => t.studentId === student.id && testMatchesInstructorFilter(t, studentPerformanceInstructorFilter));
      const q1 = quarterByName.get("Q1");
      const q2 = quarterByName.get("Q2");
      const q3 = quarterByName.get("Q3");
      const q4 = quarterByName.get("Q4");

      const q1Tests = q1 ? studentTests.filter((t) => inRange(t.date, q1.startDate, q1.endDate)) : [];
      const q2Tests = q2 ? studentTests.filter((t) => inRange(t.date, q2.startDate, q2.endDate)) : [];
      const q3Tests = q3 ? studentTests.filter((t) => inRange(t.date, q3.startDate, q3.endDate)) : [];
      const q4Tests = q4 ? studentTests.filter((t) => inRange(t.date, q4.startDate, q4.endDate)) : [];
      const q1Avg = weightedAverageForTests(q1Tests, { quarterScoped: true });
      const q2Avg = weightedAverageForTests(q2Tests, { quarterScoped: true });
      const q3Avg = weightedAverageForTests(q3Tests, { quarterScoped: true });
      const q4Avg = weightedAverageForTests(q4Tests, { quarterScoped: true });
      const totalAvg = weightedAverageForTests(studentTests);
      const subjectMap = new Map();
      studentTests.forEach((test) => {
        const subjectId = test.subjectId || "__unknown_subject__";
        if (!subjectMap.has(subjectId)) subjectMap.set(subjectId, []);
        subjectMap.get(subjectId).push(test);
      });
      const subjectRows = Array.from(subjectMap.entries())
        .sort((a, b) => getSubjectName(a[0]).localeCompare(getSubjectName(b[0])))
        .flatMap(([subjectId, testsForSubject]) => {
          const subjectName = getSubjectName(subjectId);
          const q1TestsBySubject = q1 ? testsForSubject.filter((test) => inRange(test.date, q1.startDate, q1.endDate)) : [];
          const q2TestsBySubject = q2 ? testsForSubject.filter((test) => inRange(test.date, q2.startDate, q2.endDate)) : [];
          const q3TestsBySubject = q3 ? testsForSubject.filter((test) => inRange(test.date, q3.startDate, q3.endDate)) : [];
          const q4TestsBySubject = q4 ? testsForSubject.filter((test) => inRange(test.date, q4.startDate, q4.endDate)) : [];
          const q1AvgBySubject = weightedAverageForTests(q1TestsBySubject, { quarterScoped: true });
          const q2AvgBySubject = weightedAverageForTests(q2TestsBySubject, { quarterScoped: true });
          const q3AvgBySubject = weightedAverageForTests(q3TestsBySubject, { quarterScoped: true });
          const q4AvgBySubject = weightedAverageForTests(q4TestsBySubject, { quarterScoped: true });
          const totalAvgBySubject = weightedAverageForTests(testsForSubject);

          const subjectKey = `${student.id}::${subjectId}`;
          const expandedSubject = expandedSubjectAverageRows.has(subjectKey);
          const subjectRow = `<tr class="student-avg-detail-row"><td class="student-avg-subject-cell"><button type="button" class="student-avg-toggle student-avg-subtoggle" data-toggle-subject-avg="${subjectKey}" aria-expanded="${expandedSubject ? "true" : "false"}">${expandedSubject ? "-" : "+"}</button>${subjectName}</td><td>${formatAvgCell(totalAvgBySubject, testsForSubject.length)}</td><td>${formatAvgCell(q1AvgBySubject, q1TestsBySubject.length)}</td><td>${formatAvgCell(q2AvgBySubject, q2TestsBySubject.length)}</td><td>${formatAvgCell(q3AvgBySubject, q3TestsBySubject.length)}</td><td>${formatAvgCell(q4AvgBySubject, q4TestsBySubject.length)}</td></tr>`;

          if (!expandedSubject) return [subjectRow];

          const typeMap = new Map();
          testsForSubject.forEach((test) => {
            const gradeType = gradeTypeName(test) || "Other";
            if (!typeMap.has(gradeType)) typeMap.set(gradeType, []);
            typeMap.get(gradeType).push(test);
          });
          const sortedTypes = Array.from(typeMap.keys()).sort((a, b) => {
            const ai = gradeTypeOrder.indexOf(a);
            const bi = gradeTypeOrder.indexOf(b);
            const av = ai === -1 ? Number.MAX_SAFE_INTEGER : ai;
            const bv = bi === -1 ? Number.MAX_SAFE_INTEGER : bi;
            return av - bv || a.localeCompare(b);
          });
          const typeRows = sortedTypes.map((gradeType) => {
            const typeTests = typeMap.get(gradeType) || [];
            const q1TypeTests = q1 ? typeTests.filter((test) => inRange(test.date, q1.startDate, q1.endDate)) : [];
            const q2TypeTests = q2 ? typeTests.filter((test) => inRange(test.date, q2.startDate, q2.endDate)) : [];
            const q3TypeTests = q3 ? typeTests.filter((test) => inRange(test.date, q3.startDate, q3.endDate)) : [];
            const q4TypeTests = q4 ? typeTests.filter((test) => inRange(test.date, q4.startDate, q4.endDate)) : [];
            const q1TypeAvg = weightedAverageForTests(q1TypeTests, { quarterScoped: true });
            const q2TypeAvg = weightedAverageForTests(q2TypeTests, { quarterScoped: true });
            const q3TypeAvg = weightedAverageForTests(q3TypeTests, { quarterScoped: true });
            const q4TypeAvg = weightedAverageForTests(q4TypeTests, { quarterScoped: true });
            const totalTypeAvg = weightedAverageForTests(typeTests);
            return `<tr class="student-avg-type-row"><td class="student-avg-type-cell">${gradeType}</td><td>${formatAvgCell(totalTypeAvg, typeTests.length)}</td><td>${formatAvgCell(q1TypeAvg, q1TypeTests.length)}</td><td>${formatAvgCell(q2TypeAvg, q2TypeTests.length)}</td><td>${formatAvgCell(q3TypeAvg, q3TypeTests.length)}</td><td>${formatAvgCell(q4TypeAvg, q4TypeTests.length)}</td></tr>`;
          });
          return [subjectRow, ...typeRows];
        })
        .join("");
      const expanded = expandedStudentAverageRows.has(student.id);
      const detailRows = subjectRows
        ? subjectRows
        : "<tr class='student-avg-detail-row'><td colspan='6' class='muted student-avg-detail-empty'>No subject grades yet.</td></tr>";

      return {
        studentId: student.id,
        studentName: `${student.firstName} ${student.lastName}`,
        totalCount: studentTests.length,
        q1Count: q1Tests.length,
        q2Count: q2Tests.length,
        q3Count: q3Tests.length,
        q4Count: q4Tests.length,
        totalValue: studentTests.length ? totalAvg : -1,
        q1Value: q1Avg,
        q2Value: q2Avg,
        q3Value: q3Avg,
        q4Value: q4Avg,
        row: `<tr><td><button type="button" class="student-avg-toggle" data-toggle-student-avg="${student.id}" aria-expanded="${expanded ? "true" : "false"}">${expanded ? "-" : "+"}</button> ${student.firstName} ${student.lastName}</td><td>${formatAvgCell(totalAvg, studentTests.length)}</td><td>${formatAvgCell(q1Avg, q1Tests.length)}</td><td>${formatAvgCell(q2Avg, q2Tests.length)}</td><td>${formatAvgCell(q3Avg, q3Tests.length)}</td><td>${formatAvgCell(q4Avg, q4Tests.length)}</td></tr>`,
        detailRow: expanded ? detailRows : ""
      };
    })
    .sort((a, b) => b.totalValue - a.totalValue || a.studentName.localeCompare(b.studentName));

  const studentRows = studentMetrics.flatMap((entry) => entry.detailRow ? [entry.row, entry.detailRow] : [entry.row]);
  if (studentMetrics.length) {
    const totals = {
      total: studentMetrics.filter((entry) => entry.totalCount > 0).map((entry) => entry.totalValue),
      q1: studentMetrics.filter((entry) => entry.q1Count > 0).map((entry) => entry.q1Value),
      q2: studentMetrics.filter((entry) => entry.q2Count > 0).map((entry) => entry.q2Value),
      q3: studentMetrics.filter((entry) => entry.q3Count > 0).map((entry) => entry.q3Value),
      q4: studentMetrics.filter((entry) => entry.q4Count > 0).map((entry) => entry.q4Value)
    };
    studentRows.push(`<tr><td><strong>Average</strong></td><td><strong>${formatAvgCell(avg(totals.total), totals.total.length)}</strong></td><td><strong>${formatAvgCell(avg(totals.q1), totals.q1.length)}</strong></td><td><strong>${formatAvgCell(avg(totals.q2), totals.q2.length)}</strong></td><td><strong>${formatAvgCell(avg(totals.q3), totals.q3.length)}</strong></td><td><strong>${formatAvgCell(avg(totals.q4), totals.q4.length)}</strong></td></tr>`);
  }
  rowOrEmpty(document.getElementById("student-avg-table"), studentRows, "No students added yet.", 6);

  const studentAttendanceRows = dashboardStudents.flatMap((student) => {
    const summary = studentAttendanceSummary(student.id);
    const presentCount = summary.attended;
    const absentCount = summary.absent;
    const attendanceAverage = totalAttendanceDays > 0 ? (presentCount / totalAttendanceDays) * 100 : 0;
    const expandedAttendance = expandedStudentAttendanceRows.has(student.id);
    const studentRow = `<tr><td><button type="button" class="student-avg-toggle" data-toggle-student-attendance="${student.id}" aria-expanded="${expandedAttendance ? "true" : "false"}">${expandedAttendance ? "-" : "+"}</button> ${student.firstName} ${student.lastName}</td><td>${totalAttendanceDays}</td><td>${presentCount}</td><td>${absentCount}</td><td>${totalAttendanceDays > 0 ? `${attendanceAverage.toFixed(1)}%` : "No days yet"}</td></tr>`;
    if (!expandedAttendance) return [studentRow];

    const quarterRows = state.settings.quarters
      .map((quarter) => {
        const quarterDates = attendanceDatesThroughToday.filter((d) => inRange(d, quarter.startDate, quarter.endDate));
        const quarterTotalDays = quarterDates.length;
        const quarterSummary = studentAttendanceSummaryByRange(student.id, quarter.startDate, quarter.endDate);
        const quarterPresent = quarterSummary.attended;
        const quarterAbsent = quarterSummary.absent;
        const quarterAverage = quarterTotalDays > 0 ? (quarterPresent / quarterTotalDays) * 100 : 0;
        return `<tr class="student-avg-detail-row"><td class="student-avg-subject-cell">${quarter.name}</td><td>${quarterTotalDays}</td><td>${quarterPresent}</td><td>${quarterAbsent}</td><td>${quarterTotalDays > 0 ? `${quarterAverage.toFixed(1)}%` : "No days yet"}</td></tr>`;
      });
    return [studentRow, ...quarterRows];
  });
  rowOrEmpty(document.getElementById("dashboard-student-attendance-table"), studentAttendanceRows, "No students added yet.", 5);

  const instructionalHours = buildInstructionalHoursSnapshot(dashboardStudents.map((student) => student.id), { instructorId: studentInstructionalHoursInstructorFilter });
  const formatInstructionalHoursCell = (bucketMetrics) => {
    const earned = Number(bucketMetrics?.earned || 0).toFixed(1);
    const projected = Number(bucketMetrics?.projected || 0).toFixed(1);
    return `<span class="instructional-hours-cell">${earned} / ${projected} hrs</span>`;
  };
  const instructionalHourRows = dashboardStudents
    .map((student) => {
      const studentSummary = instructionalHours.summaryByStudent.get(student.id) || {
        buckets: Object.fromEntries(instructionalHours.buckets.map((bucket) => [bucket.key, { earned: 0, projected: 0 }])),
        subjects: new Map()
      };
      const expanded = expandedStudentInstructionalHourRows.has(student.id);
      const detailRows = Array.from(studentSummary.subjects.values())
        .sort((a, b) =>
          (b.buckets.total.earned - a.buckets.total.earned)
          || getSubjectName(a.subjectId).localeCompare(getSubjectName(b.subjectId)))
        .map((subjectSummary) => `<tr class="student-avg-detail-row"><td class="student-avg-subject-cell">${getSubjectName(subjectSummary.subjectId)}</td>${instructionalHours.buckets.map((bucket) => `<td>${formatInstructionalHoursCell(subjectSummary.buckets[bucket.key])}</td>`).join("")}</tr>`)
        .join("");

      return {
        studentName: `${student.firstName} ${student.lastName}`,
        earnedTotal: studentSummary.buckets.total.earned,
        row: `<tr><td><button type="button" class="student-avg-toggle" data-toggle-student-instructional-hours="${student.id}" aria-expanded="${expanded ? "true" : "false"}">${expanded ? "-" : "+"}</button> ${student.firstName} ${student.lastName}</td>${instructionalHours.buckets.map((bucket) => `<td>${formatInstructionalHoursCell(studentSummary.buckets[bucket.key])}</td>`).join("")}</tr>`,
        detailRow: expanded
          ? (detailRows || "<tr class='student-avg-detail-row'><td colspan='6' class='muted student-avg-detail-empty'>No scheduled instructional hours yet.</td></tr>")
          : ""
      };
    })
    .sort((a, b) => b.earnedTotal - a.earnedTotal || a.studentName.localeCompare(b.studentName));
  rowOrEmpty(
    document.getElementById("dashboard-student-instructional-hours-table"),
    instructionalHourRows.flatMap((entry) => entry.detailRow ? [entry.row, entry.detailRow] : [entry.row]),
    "No students added yet.",
    6
  );

  renderGradeTrending();
  renderGpaTrending();
  renderInstructionHoursTrending();
  renderGradeTypeVolumeChart();
  renderWorkDistributionGradeTypeFilter();
  renderWorkDistributionChart();

  const subjectAvgTable = document.getElementById("subject-avg-table");
  if (subjectAvgTable) {
    rowOrEmpty(subjectAvgTable,
      g.subject.sort((a,b)=>b.avg-a.avg).map((r)=>`<tr><td>${getSubjectName(r.subjectId)}</td><td>${r.avg.toFixed(1)}%</td><td>${r.count}</td></tr>`),
      "No graded tests yet.", 3);
  }

  const periodTable = document.getElementById("period-avg-table");
  if (periodTable) {
    const periodRows = g.quarterRows.map((qRow)=>`<tr><td>${qRow.label}</td><td>${qRow.avg.toFixed(1)}%</td><td>${qRow.count}</td></tr>`);
    periodRows.push(`<tr><td>Annual (${state.settings.schoolYear.label})</td><td>${g.annualAvg.toFixed(1)}%</td><td>${g.annualCount}</td></tr>`);
    rowOrEmpty(periodTable, periodRows, "No period data.", 3);
  }
}
function viewRange(view, refISO) {
  const ref = toDate(refISO);
  if (view === "day") return { start: new Date(ref), end: new Date(ref), label: `Daily view: ${toISO(ref)}` };
  if (view === "week") {
    const start = new Date(ref); const idx = (start.getDay() + 6) % 7; start.setDate(start.getDate() - idx);
    const end = new Date(start); end.setDate(end.getDate() + 6);
    return { start, end, label: `Weekly view: ${toISO(start)} to ${toISO(end)}` };
  }
  if (view === "month") {
    const start = new Date(ref.getFullYear(), ref.getMonth(), 1, 12, 0, 0);
    const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 12, 0, 0);
    return { start, end, label: `Monthly view: ${toISO(start)} to ${toISO(end)}` };
  }
  if (view === "quarter") {
    const q = state.settings.quarters.find((x) => inRange(toISO(ref), x.startDate, x.endDate));
    if (q) return { start: toDate(q.startDate), end: toDate(q.endDate), label: `${q.name}: ${q.startDate} to ${q.endDate}` };
    const qStartMonth = Math.floor(ref.getMonth() / 3) * 3;
    const start = new Date(ref.getFullYear(), qStartMonth, 1, 12, 0, 0);
    const end = new Date(ref.getFullYear(), qStartMonth + 3, 0, 12, 0, 0);
    return { start, end, label: `Quarterly view: ${toISO(start)} to ${toISO(end)}` };
  }
  return {
    start: toDate(state.settings.schoolYear.startDate),
    end: toDate(state.settings.schoolYear.endDate),
    label: `Annual view (${state.settings.schoolYear.label}): ${state.settings.schoolYear.startDate} to ${state.settings.schoolYear.endDate}`
  };
}

function calendarEvents(rangeStart, rangeEnd, studentFilterIds = [], subjectFilterIds = [], courseFilterIds = []) {
  const excluded = holidaySet();
  const events = [];
  state.plans.forEach((p) => {
    if (studentFilterIds.length && !studentFilterIds.includes(p.studentId)) return;
    if (courseFilterIds.length && !courseFilterIds.includes(p.courseId)) return;
    const course = getCourse(p.courseId);
    if (!course) return;
    if (subjectFilterIds.length && !subjectFilterIds.includes(course.subjectId)) return;
    const planRange = resolvedPlanRange(p);
    const s = toDate(planRange.startDate), e = toDate(planRange.endDate);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return;
    const start = s > rangeStart ? new Date(s) : new Date(rangeStart);
    const end = e < rangeEnd ? new Date(e) : new Date(rangeEnd);
    if (end < start) return;
    const days = new Set(p.weekdays || [1,2,3,4,5]);
    const c = new Date(start);
    while (c <= end) {
      const key = toISO(c);
      if (days.has(c.getDay()) && !excluded.has(key)) {
        events.push({ date: key, studentId: p.studentId, courseId: p.courseId, planType: p.planType });
      }
      c.setDate(c.getDate() + 1);
    }
  });
  return events.sort((a,b)=>a.date.localeCompare(b.date));
}

function calendarEventsForDate(dateKey, studentFilterIds = [], subjectFilterIds = [], courseFilterIds = []) {
  const ref = toDate(dateKey);
  if (Number.isNaN(ref.getTime())) return [];

  const events = calendarEvents(ref, ref, studentFilterIds, subjectFilterIds, courseFilterIds);
  const excludedDates = holidaySet();
  const isInstructionalWeekday = ref.getDay() >= 1 && ref.getDay() <= 5;

  if (isInstructionalWeekday && !excludedDates.has(dateKey)) {
    const studentsToFill = studentFilterIds.length
      ? [...studentFilterIds]
      : state.students.map((student) => student.id);
    const plannedPairSet = new Set(events.map((event) => `${event.studentId}||${event.courseId}`));

    studentsToFill.forEach((studentId) => {
      const enrolledCourseIds = Array.from(new Set(
        state.enrollments
          .filter((enrollment) => enrollment.studentId === studentId)
          .map((enrollment) => enrollment.courseId)
      ));

      enrolledCourseIds.forEach((courseId) => {
        if (courseFilterIds.length && !courseFilterIds.includes(courseId)) return;
        const course = getCourse(courseId);
        if (!course) return;
        if (subjectFilterIds.length && !subjectFilterIds.includes(course.subjectId)) return;
        const pairKey = `${studentId}||${courseId}`;
        if (plannedPairSet.has(pairKey)) return;

        const hasAnyPlanForCourse = state.plans.some((plan) =>
          plan.studentId === studentId && plan.courseId === courseId
        );
        if (hasAnyPlanForCourse) return;

        events.push({
          date: dateKey,
          studentId,
          courseId,
          planType: "enrollment-fallback"
        });
        plannedPairSet.add(pairKey);
      });
    });
  }

  const deduped = [];
  const seen = new Set();
  events
    .sort((a, b) =>
      a.studentId.localeCompare(b.studentId)
      || a.courseId.localeCompare(b.courseId)
      || a.planType.localeCompare(b.planType))
    .forEach((event) => {
      const key = `${event.studentId}||${event.courseId}`;
      if (seen.has(key)) return;
      seen.add(key);
      deduped.push(event);
  });
  return deduped;
}

function dailyBreaksForStudentDate(studentId, dateKey) {
  const date = toDate(dateKey);
  if (Number.isNaN(date.getTime())) return [];
  const weekday = date.getDay();
  const matchingBreaks = (state.settings.dailyBreaks || [])
    .filter((entry) =>
      entry.schoolYearId === state.settings.currentSchoolYearId
      && (entry.studentIds || []).includes(studentId)
      && (entry.weekdays || []).includes(weekday))
    .map((entry) => {
      const start = parseTimeToMinutes(entry.startTime);
      const durationMinutes = Math.max(5, Number(entry.durationMinutes || 0));
      return {
        ...entry,
        label: dailyBreakLabel(entry),
        start,
        end: Number.isFinite(start) ? start + durationMinutes : NaN,
        durationMinutes
      };
    })
    .filter((entry) => Number.isFinite(entry.start) && Number.isFinite(entry.end) && entry.end > entry.start)
    .sort((a, b) => a.start - b.start || a.label.localeCompare(b.label));

  if (!matchingBreaks.some((entry) => entry.type === "lunch")) {
    matchingBreaks.push({
      id: `default-lunch-${studentId}-${dateKey}`,
      schoolYearId: state.settings.currentSchoolYearId,
      studentIds: [studentId],
      type: "lunch",
      description: "",
      startTime: "12:00",
      durationMinutes: 60,
      weekdays: [weekday],
      label: "Lunch Break",
      start: 12 * 60,
      end: 13 * 60
    });
    matchingBreaks.sort((a, b) => a.start - b.start || a.label.localeCompare(b.label));
  }

  return matchingBreaks;
}

function dailyScheduledBlocks(dateKey, studentFilterIds = [], subjectFilterIds = [], courseFilterIds = []) {
  const events = calendarEventsForDate(dateKey, studentFilterIds, subjectFilterIds, courseFilterIds);
  const byStudent = new Map();
  events.forEach((event) => {
    if (!byStudent.has(event.studentId)) byStudent.set(event.studentId, []);
    byStudent.get(event.studentId).push(event);
  });

  const exclusiveCourseAvailability = new Map();
  const blocksByStudent = new Map();
  const studentIdsInOrder = Array.from(byStudent.keys())
    .sort((a, b) => getStudentName(a).localeCompare(getStudentName(b)));

  studentIdsInOrder.forEach((studentId) => {
    const studentName = getStudentName(studentId);
    const blocks = [];
    const remaining = orderedEventsForStudent(studentId, byStudent.get(studentId) || []);
    const breakBlocks = dailyBreaksForStudentDate(studentId, dateKey);

    let slot = 8 * 60;
    let breakIndex = 0;

    while (remaining.length || breakIndex < breakBlocks.length) {
      const nextBreak = breakBlocks[breakIndex] || null;
      if (nextBreak && slot >= nextBreak.start) {
        blocks.push({
          student: studentName,
          studentId,
          label: nextBreak.label,
          plannedStart: nextBreak.start,
          plannedEnd: nextBreak.end,
          start: nextBreak.start,
          end: nextBreak.end,
          durationMinutes: nextBreak.durationMinutes,
          type: nextBreak.type
        });
        slot = Math.max(slot, nextBreak.end);
        breakIndex += 1;
        continue;
      }

      const candidates = remaining.map((event) => {
        const course = getCourse(event.courseId);
        const durationMinutes = Math.max(15, Math.round(Number(course?.hoursPerDay || 1) * 60));
        const availableAt = course?.exclusiveResource
          ? Math.max(8 * 60, exclusiveCourseAvailability.get(course.id) || 8 * 60)
          : 8 * 60;
        return {
          event,
          course,
          durationMinutes,
          availableAt
        };
      });

      let chosen = null;
      const startNow = candidates.filter((candidate) => candidate.availableAt <= slot);

      if (nextBreak) {
        const fitsBeforeBreak = startNow.filter((candidate) => slot + candidate.durationMinutes <= nextBreak.start);
        if (fitsBeforeBreak.length) {
          [chosen] = fitsBeforeBreak;
        } else if (startNow.length) {
          slot = nextBreak.start;
          continue;
        }
      } else if (startNow.length) {
        [chosen] = startNow;
      }

      if (!chosen) {
        if (!remaining.length && nextBreak) {
          slot = nextBreak.start;
          continue;
        }
        const nextAvailable = Math.min(...candidates.map((candidate) => candidate.availableAt));
        if (!Number.isFinite(nextAvailable)) break;
        if (nextBreak && nextAvailable >= nextBreak.start) {
          slot = nextBreak.start;
          continue;
        }
        slot = Math.max(slot, nextAvailable || slot);
        continue;
      }

      const startMin = slot;
      const endMin = Math.min(24 * 60, startMin + chosen.durationMinutes);
      blocks.push({
        student: studentName,
        studentId,
        courseId: chosen.event.courseId,
        label: `${chosen.course.name} (${getSubjectName(chosen.course.subjectId)})`,
        plannedStart: startMin,
        plannedEnd: endMin,
        start: startMin,
        end: endMin,
        durationMinutes: chosen.durationMinutes,
        type: "instruction"
      });
      if (chosen.course.exclusiveResource) {
        exclusiveCourseAvailability.set(chosen.course.id, endMin);
      }

      const removeIndex = remaining.findIndex((event) =>
        event.studentId === chosen.event.studentId && event.courseId === chosen.event.courseId);
      if (removeIndex >= 0) remaining.splice(removeIndex, 1);

      slot = endMin;
      if (remaining.length && slot < 24 * 60) slot = Math.min(24 * 60, slot + 5);
    }

    const adjustedBlocks = [];
    let actualCursor = null;
    blocks.forEach((block) => {
      const plannedStart = Number.isFinite(block.plannedStart) ? block.plannedStart : block.start;
      const plannedEnd = Number.isFinite(block.plannedEnd) ? block.plannedEnd : block.end;
      const plannedDuration = Math.max(1, plannedEnd - plannedStart);
      const actualDuration = block.type === "instruction"
        ? effectiveInstructionMinutes(block.studentId, block.courseId, dateKey)
        : plannedDuration;
      const actualStart = actualCursor == null ? plannedStart : Math.max(plannedStart, actualCursor);
      const actualEnd = Math.min(24 * 60, actualStart + actualDuration);
      adjustedBlocks.push({
        ...block,
        plannedStart,
        plannedEnd,
        start: actualStart,
        end: actualEnd,
        actualMinutes: actualDuration
      });
      actualCursor = actualEnd;
    });

    blocksByStudent.set(studentId, adjustedBlocks);
  });

  return blocksByStudent;
}

function calendarDateStudentRows(rangeStart, rangeEnd, studentFilterIds = [], subjectFilterIds = [], courseFilterIds = []) {
  const students = studentFilterIds.length
    ? state.students.filter((s) => studentFilterIds.includes(s.id))
    : [...state.students];
  if (!students.length) return [];

  const rows = [];
  const cursor = new Date(rangeStart);
  while (cursor <= rangeEnd) {
    const dateKey = toISO(cursor);
    const blocksByStudent = dailyScheduledBlocks(dateKey, studentFilterIds, subjectFilterIds, courseFilterIds);
    students.forEach((student) => {
      const entry = {
        date: dateKey,
        studentId: student.id,
        subjects: new Map(),
        subjectOrder: []
      };
      rows.push(entry);
      const blocks = blocksByStudent.get(student.id) || [];
      blocks
        .filter((block) => block.type === "instruction")
        .forEach((block) => {
          const course = getCourse(block.courseId);
          if (!course) return;
          const subjectName = getSubjectName(course.subjectId);
          const current = entry.subjects.get(subjectName) || { hours: 0, courses: new Set() };
          if (!entry.subjects.has(subjectName)) entry.subjectOrder.push(subjectName);
          current.hours += Number(block.actualMinutes || 0) / 60;
          current.courses.add(course.name);
          entry.subjects.set(subjectName, current);
        });
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return rows;
}

function buildDailyStudentScheduleMap(rangeStart, rangeEnd, studentFilterIds = [], subjectFilterIds = [], courseFilterIds = []) {
  const map = new Map();
  calendarDateStudentRows(rangeStart, rangeEnd, studentFilterIds, subjectFilterIds, courseFilterIds).forEach((entry) => {
    const dateKey = entry.date;
    if (!map.has(dateKey)) map.set(dateKey, []);
    map.get(dateKey).push(entry);
  });
  return map;
}

function renderMonthCalendar(referenceISO, studentFilterIds = [], subjectFilterIds = [], courseFilterIds = []) {
  const ref = toDate(referenceISO || todayISO());
  const monthStart = new Date(ref.getFullYear(), ref.getMonth(), 1, 12, 0, 0);
  const monthEnd = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 12, 0, 0);
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const gridEnd = new Date(gridStart);
  gridEnd.setDate(gridStart.getDate() + 41);

  const dailyMap = buildDailyStudentScheduleMap(gridStart, gridEnd, studentFilterIds, subjectFilterIds, courseFilterIds);
  document.getElementById("calendar-month-title").textContent = monthStart.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });

  const grid = document.getElementById("calendar-month-grid");
  grid.innerHTML = "";

  const cursor = new Date(gridStart);
  for (let i = 0; i < 42; i += 1) {
    const dateKey = toISO(cursor);
    const dayRows = (dailyMap.get(dateKey) || [])
      .sort((a, b) => getStudentName(a.studentId).localeCompare(getStudentName(b.studentId)));

    const items = dayRows.map((row) => {
      const subjectParts = row.subjectOrder
        .map((subjectName) => [subjectName, row.subjects.get(subjectName)])
        .filter(([, data]) => !!data)
        .map(([subjectName, data]) => `${subjectName} ${data.hours.toFixed(1)}h`);
      const body = subjectParts.length ? subjectParts.join(", ") : "-";
      return `<div class="calendar-day-item"><button type="button" class="calendar-student-link" data-open-calendar-week="1" data-date="${dateKey}" data-student-id="${row.studentId}">${getStudentName(row.studentId)}</button><br>${body}</div>`;
    });

    if (!items.length) {
      items.push("<div class='calendar-day-item'>No scheduled instruction</div>");
    }

    const inMonth = cursor.getMonth() === monthStart.getMonth();
    const cell = document.createElement("div");
    cell.className = `calendar-day${inMonth ? "" : " muted-day"}`;
    cell.innerHTML = `<div class="calendar-day-header">${cursor.getDate()}</div><div class="calendar-day-items">${items.join("")}</div>`;
    grid.appendChild(cell);
    cursor.setDate(cursor.getDate() + 1);
  }

  return {
    start: monthStart,
    end: monthEnd
  };
}

function renderWeekCalendar(referenceISO, studentFilterIds = [], subjectFilterIds = [], courseFilterIds = []) {
  const ref = toDate(referenceISO || todayISO());
  const start = new Date(ref);
  const idx = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - idx);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);

  const dayRows = calendarDateStudentRows(start, end, studentFilterIds, subjectFilterIds, courseFilterIds);
  const grouped = new Map();
  dayRows.forEach((row) => {
    if (!grouped.has(row.date)) grouped.set(row.date, []);
    grouped.get(row.date).push(row);
  });

  const grid = document.getElementById("calendar-week-grid");
  if (!grid) return { start, end };
  grid.innerHTML = "";

  const cursor = new Date(start);
  for (let i = 0; i < 7; i += 1) {
    const dateKey = toISO(cursor);
    const rows = (grouped.get(dateKey) || [])
      .sort((a, b) => getStudentName(a.studentId).localeCompare(getStudentName(b.studentId)));
    const items = rows.map((row) => {
      const subjectParts = row.subjectOrder
        .map((subjectName) => [subjectName, row.subjects.get(subjectName)])
        .filter(([, data]) => !!data)
        .map(([subjectName, data]) => `${subjectName} ${data.hours.toFixed(1)}h`);
      const body = subjectParts.length ? subjectParts.join(", ") : "-";
      return `<div class="calendar-day-item"><button type="button" class="calendar-student-link" data-open-calendar-day="1" data-date="${dateKey}" data-student-id="${row.studentId}">${getStudentName(row.studentId)}</button><br>${body}</div>`;
    });
    if (!items.length) items.push("<div class='calendar-day-item'>No scheduled instruction</div>");
    const cell = document.createElement("div");
    cell.className = "calendar-day";
    cell.innerHTML = `<div class="calendar-day-header">${cursor.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div><div class="calendar-day-items">${items.join("")}</div>`;
    grid.appendChild(cell);
    cursor.setDate(cursor.getDate() + 1);
  }

  return { start, end };
}

function renderDayCalendar(referenceISO, studentFilterIds = [], subjectFilterIds = [], courseFilterIds = []) {
  const ref = toDate(referenceISO || todayISO());
  const dateKey = toISO(ref);

  const blocksByStudent = dailyScheduledBlocks(dateKey, studentFilterIds, subjectFilterIds, courseFilterIds);
  const rows = Array.from(blocksByStudent.values())
    .flat()
    .sort((a, b) => a.start - b.start || a.student.localeCompare(b.student) || a.label.localeCompare(b.label))
    .map((block) => {
      const actualRange = `${formatClockTime(block.start)} - ${formatClockTime(block.end)}`;
      const plannedRange = `${formatClockTime(block.plannedStart)} - ${formatClockTime(block.plannedEnd)}`;
      if (block.type !== "instruction") {
        return `<tr><td>${actualRange}</td><td>${block.student}</td><td>${block.label}<br><span class="muted">Planned ${plannedRange}</span></td><td>${Number(block.actualMinutes || 0)} min</td><td></td></tr>`;
      }

      const existing = findInstructionActualRecord(block.studentId, block.courseId, dateKey);
      const editKey = instructionActualEditKey(block.studentId, block.courseId, dateKey);
      const isEditing = editingInstructionActualKey === editKey;
      const canEditActualMinutes = isAdminUser();
      const instructorId = effectiveInstructionInstructorId(block.studentId, block.courseId, dateKey);
      const instructorCell = isEditing
        ? `<select data-instruction-actual-instructor="${editKey}">${buildInstructionInstructorOptions(instructorId)}</select>`
        : escapeHtml(instructorId ? getInstructorName(instructorId) : "Unassigned");
      const minutesCell = isEditing
        ? `<input type="number" min="1" step="1" value="${Number(block.actualMinutes || plannedInstructionMinutesForCourse(block.courseId))}" data-instruction-actual-input="${editKey}">`
        : `${Number(block.actualMinutes || plannedInstructionMinutesForCourse(block.courseId))} min`;
      const actionsCell = !canEditActualMinutes
        ? ""
        : (isEditing
          ? `<div class="table-action-row"><button type="button" data-save-instruction-actual="${editKey}" data-student-id="${block.studentId}" data-course-id="${block.courseId}" data-date="${dateKey}">Save</button><button type="button" data-cancel-instruction-actual="${editKey}">Cancel</button></div>`
          : `<div class="table-action-row"><button type="button" data-edit-instruction-actual="${editKey}">Edit</button>${existing ? `<button type="button" data-reset-instruction-actual="${existing.id}">Use Planned</button>` : ""}</div>`);
      return `<tr><td>${actualRange}</td><td>${block.student}</td><td>${block.label}<br><span class="muted">Planned ${plannedRange}</span></td><td>${instructorCell}</td><td>${minutesCell}</td><td class="calendar-actions-cell">${actionsCell}</td></tr>`;
    });
  rowOrEmpty(document.getElementById("calendar-day-table"), rows, "No scheduled instruction for this day.", 6);
  return { dateKey };
}

function renderCalendar() {
  const viewInput = document.getElementById("calendar-view");
  const requestedView = viewInput ? viewInput.value : "month";
  const view = ["day", "week", "month"].includes(requestedView) ? requestedView : "month";
  if (viewInput && viewInput.value !== view) viewInput.value = view;
  const ref = document.getElementById("calendar-date").value || todayISO();
  const studentFilterIds = getCalendarSelectedStudentIds();
  const subjectFilterIds = getCalendarSelectedSubjectIds();
  const courseFilterIds = getCalendarSelectedCourseIds();
  const monthView = document.getElementById("calendar-month-view");
  const detailView = document.getElementById("calendar-detail-view");
  const weekView = document.getElementById("calendar-week-view");
  const dayView = document.getElementById("calendar-day-view");
  const listView = document.getElementById("calendar-list-wrap");
  const detailTitle = document.getElementById("calendar-detail-title");
  const backMonthBtn = document.getElementById("calendar-back-month");
  const backWeekBtn = document.getElementById("calendar-back-week");

  if (view === "month") {
    monthView.classList.remove("hidden");
    if (detailView) detailView.classList.add("hidden");
    listView.classList.add("hidden");
    if (backMonthBtn) backMonthBtn.classList.add("hidden");
    if (backWeekBtn) backWeekBtn.classList.add("hidden");
    calendarBackToMonthContext = null;
    calendarBackToWeekContext = null;
    const monthRange = renderMonthCalendar(ref, studentFilterIds, subjectFilterIds, courseFilterIds);
    const monthStartIso = toISO(monthRange.start);
    const monthEndIso = toISO(monthRange.end);
    document.getElementById("calendar-range").textContent = `Monthly calendar: ${monthStartIso} to ${monthEndIso}`;
    return;
  }

  if (view === "week") {
    monthView.classList.add("hidden");
    if (detailView) detailView.classList.remove("hidden");
    if (weekView) weekView.classList.remove("hidden");
    if (dayView) dayView.classList.add("hidden");
    listView.classList.add("hidden");
    if (backMonthBtn) backMonthBtn.classList.toggle("hidden", !calendarBackToMonthContext);
    if (backWeekBtn) backWeekBtn.classList.add("hidden");
    calendarBackToWeekContext = null;
    const weekRange = renderWeekCalendar(ref, studentFilterIds, subjectFilterIds, courseFilterIds);
    const weekStartIso = toISO(weekRange.start);
    const weekEndIso = toISO(weekRange.end);
    if (detailTitle) detailTitle.textContent = `Week of ${weekStartIso}`;
    document.getElementById("calendar-range").textContent = `Weekly view: ${weekStartIso} to ${weekEndIso}`;
    return;
  }

  if (view === "day") {
    monthView.classList.add("hidden");
    if (detailView) detailView.classList.remove("hidden");
    if (weekView) weekView.classList.add("hidden");
    if (dayView) dayView.classList.remove("hidden");
    listView.classList.add("hidden");
    if (backMonthBtn) backMonthBtn.classList.add("hidden");
    if (backWeekBtn) backWeekBtn.classList.toggle("hidden", !calendarBackToWeekContext);
    const dayRange = renderDayCalendar(ref, studentFilterIds, subjectFilterIds, courseFilterIds);
    if (detailTitle) detailTitle.textContent = dayRange.dateKey;
    document.getElementById("calendar-range").textContent = `Daily view: ${dayRange.dateKey}`;
    return;
  }

  monthView.classList.add("hidden");
  if (detailView) detailView.classList.add("hidden");
  listView.classList.remove("hidden");
  if (backMonthBtn) backMonthBtn.classList.add("hidden");
  if (backWeekBtn) backWeekBtn.classList.add("hidden");
  calendarBackToMonthContext = null;
  calendarBackToWeekContext = null;

  const range = viewRange(view, ref);
  document.getElementById("calendar-range").textContent = range.label;
  const rows = calendarDateStudentRows(range.start, range.end, studentFilterIds, subjectFilterIds, courseFilterIds).slice(0, 5000).map((entry) => {
    const subjectLines = Array.from(entry.subjects.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([subjectName, data]) => `${subjectName}: ${data.hours.toFixed(2)} hrs (${Array.from(data.courses).join(", ")})`);
    const totalHours = Array.from(entry.subjects.values()).reduce((sum, data) => sum + data.hours, 0);
    const detail = subjectLines.length ? subjectLines.join("<br>") : "No scheduled instruction";
    return `<tr><td>${entry.date}</td><td>${getStudentName(entry.studentId)}</td><td>${detail}</td><td>${totalHours.toFixed(2)}</td></tr>`;
  });
  rowOrEmpty(document.getElementById("calendar-table"), rows, "No students to display for this calendar view.", 4);
}

function fillSettingsForms() {
  const schoolYear = currentSchoolYear();
  document.getElementById("school-year-label").value = schoolYear.label;
  document.getElementById("school-year-start").value = schoolYear.startDate;
  document.getElementById("school-year-end").value = schoolYear.endDate;
  document.getElementById("school-year-required-days").value = schoolYear.requiredInstructionalDays == null ? "" : String(schoolYear.requiredInstructionalDays);
  document.getElementById("school-year-required-hours").value = schoolYear.requiredInstructionalHours == null ? "" : String(schoolYear.requiredInstructionalHours);
  const quarterSchoolYearInput = document.getElementById("quarter-school-year");
  const selectedYearId = quarterSchoolYearInput && quarterSchoolYearInput.value
    ? quarterSchoolYearInput.value
    : state.settings.currentSchoolYearId;
  const q = state.settings.allQuarters
    .filter((quarter) => quarter.schoolYearId === selectedYearId)
    .sort((a, b) => toDate(a.startDate) - toDate(b.startDate));
  document.getElementById("q1-start").value = q[0] ? q[0].startDate : "";
  document.getElementById("q1-end").value = q[0] ? q[0].endDate : "";
  document.getElementById("q2-start").value = q[1] ? q[1].startDate : "";
  document.getElementById("q2-end").value = q[1] ? q[1].endDate : "";
  document.getElementById("q3-start").value = q[2] ? q[2].startDate : "";
  document.getElementById("q3-end").value = q[2] ? q[2].endDate : "";
  document.getElementById("q4-start").value = q[3] ? q[3].startDate : "";
  document.getElementById("q4-end").value = q[3] ? q[3].endDate : "";
  if (!document.getElementById("calendar-date").value) document.getElementById("calendar-date").value = todayISO();
  if (!document.getElementById("attendance-date").value) document.getElementById("attendance-date").value = todayISO();
  const dailyBreakStartInput = document.getElementById("daily-break-start-time");
  const dailyBreakDurationInput = document.getElementById("daily-break-duration");
  if (dailyBreakStartInput && !dailyBreakStartInput.value) dailyBreakStartInput.value = "12:00";
  if (dailyBreakDurationInput && !dailyBreakDurationInput.value) dailyBreakDurationInput.value = "60";
  renderGradingCriteria();
}

function beginSchoolYearEdit(schoolYearId) {
  const schoolYear = getSchoolYear(schoolYearId);
  if (!schoolYear) return;
  editingSchoolYearId = schoolYearId;
  document.getElementById("school-year-label").value = schoolYear.label;
  document.getElementById("school-year-start").value = schoolYear.startDate;
  document.getElementById("school-year-end").value = schoolYear.endDate;
  document.getElementById("school-year-required-days").value = schoolYear.requiredInstructionalDays == null ? "" : String(schoolYear.requiredInstructionalDays);
  document.getElementById("school-year-required-hours").value = schoolYear.requiredInstructionalHours == null ? "" : String(schoolYear.requiredInstructionalHours);
  renderPlanningSettings();
}

function cancelSchoolYearEdit() {
  editingSchoolYearId = "";
  fillSettingsForms();
  renderPlanningSettings();
}

function removeSchoolYear(schoolYearId) {
  if (!schoolYearId) return;
  const target = getSchoolYear(schoolYearId);
  if (!target) return;
  if (state.settings.schoolYears.length <= 1) {
    alert("At least one school year must remain.");
    return;
  }
  state.settings.schoolYears = state.settings.schoolYears.filter((year) => year.id !== schoolYearId);
  state.settings.allQuarters = state.settings.allQuarters.filter((quarter) => quarter.schoolYearId !== schoolYearId);
  if (editingSchoolYearId === schoolYearId) editingSchoolYearId = "";
  if (editingQuarterSchoolYearId === schoolYearId) editingQuarterSchoolYearId = "";
  if (state.settings.currentSchoolYearId === schoolYearId) {
    const nextSchoolYear = state.settings.schoolYears
      .slice()
      .sort((a, b) => toDate(a.startDate) - toDate(b.startDate))
      .at(-1);
    if (nextSchoolYear) {
      setCurrentSchoolYear(nextSchoolYear.id);
      return;
    }
  }
  const current = currentSchoolYear();
  if (current) setCurrentSchoolYear(current.id);
}

function beginQuarterEdit(schoolYearId) {
  editingQuarterSchoolYearId = schoolYearId;
  const select = document.getElementById("quarter-school-year");
  if (select) select.value = schoolYearId;
  fillSettingsForms();
  renderPlanningSettings();
}

function cancelQuarterEdit() {
  editingQuarterSchoolYearId = "";
  fillSettingsForms();
  renderPlanningSettings();
}

function validRange(startDate, endDate) { return startDate && endDate && toDate(endDate) >= toDate(startDate); }

function removeStudent(id) {
  state.students = state.students.filter((s)=>s.id!==id);
  state.enrollments = state.enrollments.filter((e)=>e.studentId!==id);
  state.plans = state.plans.filter((p)=>p.studentId!==id);
  state.attendance = state.attendance.filter((a)=>a.studentId!==id);
  state.instructionActuals = state.instructionActuals.filter((entry) => entry.studentId !== id);
  state.tests = state.tests.filter((t)=>t.studentId!==id);
  state.settings.dailyBreaks = (state.settings.dailyBreaks || [])
    .map((entry) => ({ ...entry, studentIds: (entry.studentIds || []).filter((studentId) => studentId !== id) }))
    .filter((entry) => entry.studentIds.length);
  state.users = state.users.map((user) => user.studentId === id ? { ...user, studentId: "" } : user);
  if (selectedStudentId === id) selectedStudentId = "";
}
function removeSubject(id) {
  const courseIds = state.courses.filter((c)=>c.subjectId===id).map((c)=>c.id);
  state.subjects = state.subjects.filter((s)=>s.id!==id);
  state.courses = state.courses.filter((c)=>c.subjectId!==id);
  state.enrollments = state.enrollments.filter((e)=>!courseIds.includes(e.courseId));
  state.plans = state.plans.filter((p)=>!courseIds.includes(p.courseId));
  state.tests = state.tests.filter((t)=>t.subjectId!==id && !courseIds.includes(t.courseId));
}
function removeCourse(id) {
  state.courses = state.courses.filter((c)=>c.id!==id);
  state.enrollments = state.enrollments.filter((e)=>e.courseId!==id);
  state.plans = state.plans.filter((p)=>p.courseId!==id);
  state.instructionActuals = state.instructionActuals.filter((entry) => entry.courseId !== id);
  state.tests = state.tests.filter((t)=>t.courseId!==id);
  if (editingCourseId === id) editingCourseId = "";
}

function findInstructionActualRecord(studentId, courseId, date) {
  return state.instructionActuals.find((entry) =>
    entry.studentId === studentId
    && entry.courseId === courseId
    && entry.date === date);
}

function plannedInstructionMinutesForCourse(courseId) {
  const course = getCourse(courseId);
  return Math.max(15, Math.round(Number(course?.hoursPerDay || 1) * 60));
}

function effectiveInstructionMinutes(studentId, courseId, date) {
  const existing = findInstructionActualRecord(studentId, courseId, date);
  if (existing && Number.isInteger(existing.actualMinutes) && existing.actualMinutes > 0) {
    return existing.actualMinutes;
  }
  return plannedInstructionMinutesForCourse(courseId);
}

function instructionActualEditKey(studentId, courseId, date) {
  return `${studentId}||${courseId}||${date}`;
}

function createLegacyLocalInstructionActual(payload) {
  state.instructionActuals.push({
    id: payload.id || uid(),
    studentId: payload.studentId,
    courseId: payload.courseId,
    instructorId: payload.instructorId || "",
    date: payload.date,
    actualMinutes: payload.actualMinutes
  });
}

function updateLegacyLocalInstructionActual(existing, payload) {
  if (!existing) return;
  existing.studentId = payload.studentId;
  existing.courseId = payload.courseId;
  existing.instructorId = payload.instructorId || "";
  existing.date = payload.date;
  existing.actualMinutes = payload.actualMinutes;
}

function deleteLegacyLocalInstructionActual(id) {
  state.instructionActuals = state.instructionActuals.filter((entry) => entry.id !== id);
}

function defaultInstructorIdForCourse(courseId) {
  return assignedInstructorIdForCourse(courseId);
}

function effectiveInstructionInstructorId(studentId, courseId, date) {
  const existing = findInstructionActualRecord(studentId, courseId, date);
  return String(existing?.instructorId || defaultInstructorIdForCourse(courseId) || "").trim();
}

function buildInstructionInstructorOptions(selectedInstructorId) {
  const normalizedSelected = String(selectedInstructorId || "").trim();
  const optionRows = [{ value: "", label: "Unassigned" }]
    .concat(state.instructors.map((instructor) => ({
      value: instructor.id,
      label: `${instructor.firstName} ${instructor.lastName}`
    })));
  return optionRows
    .map((option) => `<option value="${escapeHtml(option.value)}"${option.value === normalizedSelected ? " selected" : ""}>${escapeHtml(option.label)}</option>`)
    .join("");
}

async function saveInstructionActualMinutes({ studentId, courseId, instructorId, date, actualMinutes }) {
  const existing = findInstructionActualRecord(studentId, courseId, date);
  const payload = { studentId, courseId, instructorId: String(instructorId || "").trim(), date, actualMinutes };
  if (hostedModeEnabled) {
    if (existing) {
      await updateHostedInstructionActual(existing.id, payload);
    } else {
      await createHostedInstructionActual({ id: uid(), ...payload });
    }
    await refreshHostedInstructionActuals();
    return;
  }

  if (existing) {
    updateLegacyLocalInstructionActual(existing, payload);
  } else {
    createLegacyLocalInstructionActual({ id: uid(), ...payload });
  }
  saveState();
}

async function resetInstructionActualMinutes(recordId) {
  if (!recordId) return;
  if (hostedModeEnabled) {
    await deleteHostedInstructionActual(recordId);
    await refreshHostedInstructionActuals();
    return;
  }
  deleteLegacyLocalInstructionActual(recordId);
  saveState();
}

function beginCourseEdit(courseId) {
  const course = state.courses.find((c) => c.id === courseId);
  if (!course) return;
  editingCourseId = course.id;
  document.getElementById("course-name").value = course.name;
  document.getElementById("course-subject").value = course.subjectId;
  document.getElementById("course-instructor").value = course.instructorId || "";
  document.getElementById("course-hours").value = String(Number(course.hoursPerDay));
  document.getElementById("course-exclusive-resource").checked = !!course.exclusiveResource;
  renderCourses();
}

function cancelCourseEdit() {
  editingCourseId = "";
  document.getElementById("course-form").reset();
  const instructorInput = document.getElementById("course-instructor");
  if (instructorInput) instructorInput.value = "";
  const exclusiveInput = document.getElementById("course-exclusive-resource");
  if (exclusiveInput) exclusiveInput.checked = false;
  renderSelects();
  renderCourses();
}

function beginHolidayEdit(holidayId) {
  const holiday = state.settings.holidays.find((h) => h.id === holidayId);
  if (!holiday) return;
  editingHolidayId = holiday.id;
  document.getElementById("holiday-name").value = holiday.name;
  document.getElementById("holiday-type").value = holiday.type;
  document.getElementById("holiday-start").value = holiday.startDate;
  document.getElementById("holiday-end").value = holiday.endDate;
  renderHolidays();
}

function cancelHolidayEdit() {
  editingHolidayId = "";
  document.getElementById("holiday-form").reset();
  renderHolidays();
}

function beginDailyBreakEdit(dailyBreakId) {
  const entry = (state.settings.dailyBreaks || []).find((dailyBreak) => dailyBreak.id === dailyBreakId);
  if (!entry) return;
  editingDailyBreakId = entry.id;
  renderDailyBreakStudentChecklist(entry.studentIds || []);
  document.getElementById("daily-break-type").value = entry.type || "lunch";
  document.getElementById("daily-break-description").value = entry.description || "";
  document.getElementById("daily-break-start-time").value = entry.startTime || "12:00";
  document.getElementById("daily-break-duration").value = String(Number(entry.durationMinutes || 60));
  const selectedDays = new Set((entry.weekdays || []).map(Number));
  document.querySelectorAll("input[name='daily-break-weekday']").forEach((checkbox) => {
    if (!(checkbox instanceof HTMLInputElement)) return;
    checkbox.checked = selectedDays.has(Number(checkbox.value));
  });
  renderDailyBreaks();
}

function cancelDailyBreakEdit() {
  editingDailyBreakId = "";
  resetDailyBreakForm();
  renderDailyBreaks();
}

function beginPlanEdit(planId) {
  const plan = state.plans.find((p) => p.id === planId);
  if (!plan) return;
  editingPlanId = plan.id;
  document.getElementById("plan-type").value = plan.planType;
  updatePlanFormMode();
  document.getElementById("plan-student").value = plan.studentId;
  renderPlanCourseChecklist([plan.courseId], plan.studentId);
  if (plan.planType === "quarterly") {
    const quarterName = plan.quarterName || state.settings.quarters.find((q) => q.startDate === plan.startDate && q.endDate === plan.endDate)?.name;
    renderPlanQuarterOptions(quarterName ? [quarterName] : []);
  } else {
    document.getElementById("plan-start").value = plan.startDate;
    document.getElementById("plan-end").value = plan.endDate;
  }
  const selectedDays = new Set((plan.weekdays || []).map(Number));
  document.querySelectorAll("input[name='weekday']").forEach((checkbox) => {
    if (!(checkbox instanceof HTMLInputElement)) return;
    checkbox.checked = selectedDays.has(Number(checkbox.value));
  });
  renderPlans();
}

function cancelPlanEdit() {
  editingPlanId = "";
  document.getElementById("plan-form").reset();
  document.querySelectorAll("input[name='weekday']").forEach((checkbox) => {
    if (!(checkbox instanceof HTMLInputElement)) return;
    checkbox.checked = Number(checkbox.value) >= 1 && Number(checkbox.value) <= 5;
  });
  const planStudentId = document.getElementById("plan-student")?.value || "";
  renderPlanCourseChecklist([], planStudentId);
  renderPlanQuarterOptions([]);
  updatePlanFormMode();
  renderPlans();
}

function updateLegacyLocalPlan(existingPlan, payload) {
  if (!existingPlan) return;
  existingPlan.planType = payload.planType;
  existingPlan.studentId = payload.studentId;
  existingPlan.courseId = payload.courseId;
  existingPlan.startDate = payload.startDate;
  existingPlan.endDate = payload.endDate;
  existingPlan.weekdays = payload.weekdays;
  if (payload.quarterName) existingPlan.quarterName = payload.quarterName;
  else delete existingPlan.quarterName;
}

function createLegacyLocalPlans(planPayloads) {
  planPayloads.forEach((payload) => {
    state.plans.push({ ...payload });
  });
}

function updateLegacyLocalSchoolYear(existingSchoolYear, payload) {
  if (!existingSchoolYear) return;
  existingSchoolYear.label = payload.label;
  existingSchoolYear.startDate = payload.startDate;
  existingSchoolYear.endDate = payload.endDate;
  existingSchoolYear.requiredInstructionalDays = payload.requiredInstructionalDays;
  existingSchoolYear.requiredInstructionalHours = payload.requiredInstructionalHours;
}

function createLegacyLocalSchoolYear(payload) {
  const schoolYear = { id: uid(), ...payload };
  state.settings.schoolYears.push(schoolYear);
  return schoolYear;
}

function replaceLegacyLocalQuarters(schoolYearId, quarters) {
  state.settings.allQuarters = state.settings.allQuarters.filter((quarter) => quarter.schoolYearId !== schoolYearId);
  state.settings.allQuarters.push(...quarters);
}

function updateLegacyLocalDailyBreak(existingEntry, payload) {
  if (!existingEntry) return;
  Object.assign(existingEntry, payload);
}

function createLegacyLocalDailyBreak(payload) {
  state.settings.dailyBreaks.push({ id: uid(), ...payload });
}

function deleteLegacyLocalDailyBreak(dailyBreakId) {
  state.settings.dailyBreaks = state.settings.dailyBreaks.filter((entry) => entry.id !== dailyBreakId);
}

function updateLegacyLocalHoliday(existingHoliday, payload) {
  if (!existingHoliday) return;
  existingHoliday.name = payload.name;
  existingHoliday.type = payload.type;
  existingHoliday.startDate = payload.startDate;
  existingHoliday.endDate = payload.endDate;
}

function createLegacyLocalHoliday(payload) {
  state.settings.holidays.push({ id: uid(), ...payload });
}

function deleteLegacyLocalHoliday(holidayId) {
  state.settings.holidays = state.settings.holidays.filter((entry) => entry.id !== holidayId);
}

function removeLegacyLocalStudent(studentId) {
  removeStudent(studentId);
}

function removeLegacyLocalInstructor(instructorId) {
  state.instructors = state.instructors.filter((entry) => entry.id !== instructorId);
}

function removeLegacyLocalSubject(subjectId) {
  removeSubject(subjectId);
}

function removeLegacyLocalCourse(courseId) {
  removeCourse(courseId);
}

function removeLegacyLocalEnrollment(enrollmentId) {
  state.enrollments = state.enrollments.filter((entry) => entry.id !== enrollmentId);
}

function removeLegacyLocalUser(userId) {
  state.users = state.users.filter((entry) => entry.id !== userId);
}

function removeLegacyLocalPlan(planId) {
  state.plans = state.plans.filter((entry) => entry.id !== planId);
}

async function createLegacyLocalUser(payload) {
  const user = await createUserRecord(payload);
  state.users.push(user);
  return user;
}

async function updateLegacyLocalUser(existingUser, payload) {
  if (!existingUser) return;
  existingUser.username = payload.username;
  existingUser.role = payload.role === "student" ? "student" : "admin";
  existingUser.studentId = payload.role === "student" ? payload.studentId : "";
  existingUser.mustChangePassword = isLegacyBootstrapAdminUser(existingUser)
    ? !payload.password
    : existingUser.mustChangePassword;
  existingUser.updatedAt = todayISO();
  if (payload.password) {
    const credentials = await buildPasswordCredentials(payload.password);
    existingUser.passwordSalt = credentials.passwordSalt;
    existingUser.passwordHash = credentials.passwordHash;
    existingUser.mustChangePassword = false;
  }
}

function createLegacyLocalStudent(payload) {
  state.students.push({ id: uid(), ...payload });
}

function updateLegacyLocalInstructor(existingInstructor, payload) {
  if (!existingInstructor) return;
  existingInstructor.firstName = payload.firstName;
  existingInstructor.lastName = payload.lastName;
  existingInstructor.birthdate = payload.birthdate;
  existingInstructor.category = payload.category;
  existingInstructor.ageRecorded = payload.ageRecorded;
}

function createLegacyLocalInstructor(payload) {
  state.instructors.push({ id: uid(), ...payload });
}

function createLegacyLocalSubject(payload) {
  state.subjects.push({ id: uid(), ...payload });
}

function updateLegacyLocalCourse(existingCourse, payload) {
  if (!existingCourse) return;
  existingCourse.name = payload.name;
  existingCourse.subjectId = payload.subjectId;
  existingCourse.instructorId = payload.instructorId || "";
  existingCourse.hoursPerDay = payload.hoursPerDay;
  existingCourse.exclusiveResource = payload.exclusiveResource;
}

function createLegacyLocalCourse(payload) {
  state.courses.push({ id: uid(), ...payload });
}

function createLegacyLocalEnrollment(payload) {
  state.enrollments.push({ id: uid(), ...payload });
}

function updateLegacyLocalAttendance(existingAttendance, payload) {
  if (!existingAttendance) return;
  existingAttendance.studentId = payload.studentId;
  existingAttendance.date = payload.date;
  existingAttendance.present = payload.present;
}

function createLegacyLocalAttendance(payload) {
  state.attendance.push({ id: uid(), ...payload });
}

function deleteLegacyLocalAttendance(attendanceId) {
  state.attendance = state.attendance.filter((entry) => entry.id !== attendanceId);
}

function updateLegacyLocalGrade(existingGrade, payload) {
  if (!existingGrade) return;
  existingGrade.date = payload.date;
  existingGrade.studentId = payload.studentId;
  existingGrade.subjectId = payload.subjectId;
  existingGrade.courseId = payload.courseId;
  existingGrade.gradeType = payload.gradeType;
  existingGrade.testName = payload.testName;
  existingGrade.score = payload.score;
  existingGrade.maxScore = payload.maxScore;
}

function createLegacyLocalGrade(payload) {
  state.tests.push({ id: uid(), ...payload });
}

function deleteLegacyLocalGrade(gradeId) {
  state.tests = state.tests.filter((entry) => entry.id !== gradeId);
}

function updateLegacyLocalDraftGradeType(existingGradeType, payload) {
  if (!existingGradeType) return;
  existingGradeType.name = payload.name;
  existingGradeType.weight = payload.weight;
}

function createLegacyLocalDraftGradeType(payload) {
  gradeTypesDraft.push({ id: uid(), ...payload });
}

function applyLegacyLocalGradeTypes(gradeTypes) {
  state.settings.gradeTypes = cloneGradeTypes(gradeTypes);
  gradeTypesDraft = cloneGradeTypes(state.settings.gradeTypes);
}

function removeLegacyLocalDraftGradeType(gradeTypeId) {
  gradeTypesDraft = draftGradeTypes().filter((gt) => gt.id !== gradeTypeId);
}

function saveLegacyLocalGradingCriteria(criteria) {
  state.settings.gradingCriteria = {
    letterScale: criteria.letterScale.map((entry) => ({ ...entry })),
    gpaScaleOption: criteria.gpaScaleOption,
    gpaMax: criteria.gpaMax
  };
}

function bindEvents() {
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.addEventListener("click", () => {
    setActiveTab(btn.dataset.tab || "dashboard");
  }));

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("login-username").value.trim().toLowerCase();
    const password = document.getElementById("login-password").value;
    if (hostedModeEnabled) {
      try {
        await loginWithBackend(username, password);
        resetLoginMessage();
        document.getElementById("login-form").reset();
        renderAll();
      } catch (error) {
        setLoginMessage("error", error.message || "Unable to sign in.");
      }
      return;
    }
    const user = state.users.find((entry) => entry.username.toLowerCase() === username);
    if (!user || !(await verifyPasswordForUser(user, password))) {
      setLoginMessage("error", "Invalid username or password.");
      return;
    }
    if (user.role === "student" && !user.studentId) {
      setLoginMessage("error", "This student account is not linked to a student record yet.");
      return;
    }
    currentUserId = user.id;
    saveSession();
    resetLoginMessage();
    document.getElementById("login-form").reset();
    renderAll();
  });

  const setupForm = document.getElementById("setup-form");
  if (setupForm) setupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const setupToken = document.getElementById("setup-token").value.trim();
    const username = document.getElementById("setup-username").value.trim().toLowerCase();
    const password = document.getElementById("setup-password").value;
    const confirmPassword = document.getElementById("setup-password-confirm").value;
    if (!setupToken || !username || !password) {
      setSetupMessage("error", "Setup token, username, and password are required.");
      return;
    }
    if (password !== confirmPassword) {
      setSetupMessage("error", "Passwords do not match.");
      return;
    }
    try {
      await initializeHostedSetup(setupToken, username, password);
      resetSetupMessage();
      setupForm.reset();
      renderAll();
    } catch (error) {
      setSetupMessage("error", error.message || "Unable to initialize hosted setup.");
    }
  });

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", async () => logout());

  const userRoleSelect = document.getElementById("user-role");
  if (userRoleSelect) userRoleSelect.addEventListener("change", () => ensureStudentSelection());

  const userNewBtn = document.getElementById("user-new-btn");
  if (userNewBtn) {
    userNewBtn.addEventListener("click", () => {
      if (!ensureAdminAction()) return;
      beginUserCreate();
    });
  }

  const studentNewBtn = document.getElementById("student-new-btn");
  if (studentNewBtn) {
    studentNewBtn.addEventListener("click", () => {
      if (!ensureAdminAction()) return;
      beginStudentCreate();
    });
  }

  const instructorNewBtn = document.getElementById("instructor-new-btn");
  if (instructorNewBtn) {
    instructorNewBtn.addEventListener("click", () => {
      if (!ensureAdminAction()) return;
      beginInstructorCreate();
    });
  }

  document.getElementById("user-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!ensureAdminAction()) return;
    const username = document.getElementById("user-username").value.trim();
    const role = document.getElementById("user-role").value;
    const studentId = document.getElementById("user-student-id").value;
    const password = document.getElementById("user-password").value;
    const confirmPassword = document.getElementById("user-password-confirm").value;
    const existing = editingUserId ? state.users.find((entry) => entry.id === editingUserId) : null;
    if (!username) {
      setUserFormMessage("error", "Username is required.");
      return;
    }
    if (state.users.some((entry) => entry.id !== editingUserId && entry.username.toLowerCase() === username.toLowerCase())) {
      setUserFormMessage("error", "Username already exists.");
      return;
    }
    if (role === "student" && !studentId) {
      setUserFormMessage("error", "Student users must be linked to a student record.");
      return;
    }
    if ((password || confirmPassword) && password !== confirmPassword) {
      setUserFormMessage("error", "Passwords do not match.");
      return;
    }
    if (!existing && !password) {
      setUserFormMessage("error", "Password is required for new users.");
      return;
    }
    if (hostedModeEnabled) {
      try {
        const payload = {
          username,
          role,
          studentId,
          mustChangePassword: existing ? existing.mustChangePassword : false,
          ...(password ? { password } : {})
        };
        if (existing) {
          await updateHostedUser(existing.id, payload);
        } else {
          await createHostedUser({ id: uid(), ...payload });
        }
        await refreshHostedUsers();
        resetUserForm();
        userViewMode = "list";
        renderUsersViewMode();
        setUserListMessage("success", existing ? "User account updated." : "User account created.");
        renderAll();
      } catch (error) {
        setUserFormMessage("error", error.message || "Unable to save user account.");
      }
      return;
    }
    if (existing) {
      await updateLegacyLocalUser(existing, {
        username,
        role,
        password,
        studentId
      });
    } else {
      await createLegacyLocalUser({
        username,
        role,
        password,
        studentId,
        mustChangePassword: false
      });
    }
    resetUserForm();
    userViewMode = "list";
    renderUsersViewMode();
    setUserListMessage("success", existing ? "User account updated." : "User account created.");
    saveState();
    renderAll();
  });

  const userCancelEditBtn = document.getElementById("user-cancel-edit-btn");
  if (userCancelEditBtn) {
    userCancelEditBtn.addEventListener("click", () => {
      resetUserForm();
      resetUserFormMessage();
      userViewMode = "list";
      renderUsersViewMode();
      renderUsers();
    });
  }

  document.getElementById("student-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!ensureAdminAction()) return;
    const firstName = document.getElementById("student-first").value.trim();
    const lastName = document.getElementById("student-last").value.trim();
    const birthdate = document.getElementById("student-birthdate").value;
    const grade = document.getElementById("student-grade").value.trim();
    if (!firstName || !lastName || !birthdate || !grade) return;
    if (hostedModeEnabled) {
      (async () => {
        try {
          await createHostedStudent({
            id: uid(),
            firstName,
            lastName,
            birthdate,
            grade,
            ageRecorded: calculateAge(birthdate),
            createdAt: todayISO()
          });
          e.target.reset();
          await refreshHostedStudents();
          setStudentViewMode("list");
          renderStudentViewMode();
          renderAll();
        } catch (error) {
          alert(error.message || "Unable to save student.");
        }
      })();
      return;
    }
    createLegacyLocalStudent({ firstName, lastName, birthdate, grade, ageRecorded: calculateAge(birthdate), createdAt: todayISO() });
    e.target.reset();
    setStudentViewMode("list");
    renderStudentViewMode();
    saveState();
    renderAll();
  });

  const instructorBirthdateInput = document.getElementById("instructor-birthdate");
  if (instructorBirthdateInput) {
    instructorBirthdateInput.addEventListener("input", () => {
      const ageInput = document.getElementById("instructor-age");
      if (!ageInput) return;
      const birthdate = instructorBirthdateInput.value;
      ageInput.value = birthdate ? String(calculateAge(birthdate)) : "";
    });
  }

  document.getElementById("instructor-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!ensureAdminAction()) return;
    const firstName = document.getElementById("instructor-first").value.trim();
    const lastName = document.getElementById("instructor-last").value.trim();
    const category = document.getElementById("instructor-category").value;
    const birthdate = document.getElementById("instructor-birthdate").value;
    const ageRecorded = birthdate ? calculateAge(birthdate) : null;
    if (!firstName || !lastName || !birthdate || !INSTRUCTOR_CATEGORY_OPTIONS.includes(category)) return;
    const payload = {
      firstName,
      lastName,
      category,
      birthdate,
      ageRecorded,
      createdAt: todayISO()
    };
    if (hostedModeEnabled) {
      (async () => {
        try {
          if (editingInstructorId) {
            await updateHostedInstructor(editingInstructorId, payload);
          } else {
            await createHostedInstructor({ id: uid(), ...payload });
          }
          editingInstructorId = "";
          instructorViewMode = "list";
          e.target.reset();
          const ageInput = document.getElementById("instructor-age");
          if (ageInput) ageInput.value = "";
          await refreshHostedInstructors();
          renderInstructorViewMode();
          renderAll();
        } catch (error) {
          alert(error.message || "Unable to save instructor.");
        }
      })();
      return;
    }
    if (editingInstructorId) {
      updateLegacyLocalInstructor(state.instructors.find((entry) => entry.id === editingInstructorId), payload);
      editingInstructorId = "";
    } else {
      createLegacyLocalInstructor(payload);
    }
    instructorViewMode = "list";
    e.target.reset();
    const ageInput = document.getElementById("instructor-age");
    if (ageInput) ageInput.value = "";
    renderInstructorViewMode();
    saveState();
    renderAll();
  });

  const studentCancelEditBtn = document.getElementById("student-cancel-edit-btn");
  if (studentCancelEditBtn) {
    studentCancelEditBtn.addEventListener("click", () => {
      setStudentViewMode("list");
      renderStudentViewMode();
      const form = document.getElementById("student-form");
      if (form) form.reset();
    });
  }

  const instructorCancelEditBtn = document.getElementById("instructor-cancel-edit-btn");
  if (instructorCancelEditBtn) {
    instructorCancelEditBtn.addEventListener("click", () => {
      editingInstructorId = "";
      instructorViewMode = "list";
      renderInstructorViewMode();
      const form = document.getElementById("instructor-form");
      if (form) form.reset();
      const ageInput = document.getElementById("instructor-age");
      if (ageInput) ageInput.value = "";
    });
  }

  document.getElementById("subject-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!ensureAdminAction()) return;
    const name = document.getElementById("subject-name").value.trim();
    if (!name) return;
    if (state.subjects.some((s)=>s.name.toLowerCase()===name.toLowerCase())) { alert("Subject already exists."); return; }
    if (hostedModeEnabled) {
      (async () => {
        try {
          await createHostedSubject({ id: uid(), name });
          e.target.reset();
          await refreshHostedSubjects();
          renderAll();
        } catch (error) {
          alert(error.message || "Unable to save subject.");
        }
      })();
      return;
    }
    createLegacyLocalSubject({ name }); e.target.reset(); saveState(); renderAll();
  });

  document.getElementById("course-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!ensureAdminAction()) return;
    const name = document.getElementById("course-name").value.trim();
    const subjectId = document.getElementById("course-subject").value;
    const instructorId = document.getElementById("course-instructor").value.trim();
    const hoursPerDay = Number(document.getElementById("course-hours").value);
    const exclusiveResource = !!document.getElementById("course-exclusive-resource").checked;
    if (!name || !subjectId || Number.isNaN(hoursPerDay) || hoursPerDay <= 0) { alert("Provide course name, subject, and hours/day."); return; }
    const payload = { name, subjectId, instructorId, hoursPerDay, exclusiveResource };
    if (hostedModeEnabled) {
      (async () => {
        try {
          if (editingCourseId) {
            await updateHostedCourse(editingCourseId, payload);
          } else {
            await createHostedCourse({ id: uid(), ...payload });
          }
          editingCourseId = "";
          e.target.reset();
          document.getElementById("course-instructor").value = "";
          document.getElementById("course-exclusive-resource").checked = false;
          await refreshHostedCourses();
          renderAll();
        } catch (error) {
          alert(error.message || "Unable to save course.");
        }
      })();
      return;
    }
    if (editingCourseId) {
      updateLegacyLocalCourse(state.courses.find((c) => c.id === editingCourseId), payload);
      editingCourseId = "";
    } else {
      createLegacyLocalCourse(payload);
    }
    e.target.reset();
    document.getElementById("course-instructor").value = "";
    document.getElementById("course-exclusive-resource").checked = false;
    saveState();
    renderAll();
  });
  document.getElementById("grade-type-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!ensureAdminAction()) return;
    const nameInput = document.getElementById("grade-type-name");
    const weightInput = document.getElementById("grade-type-weight");
    const name = nameInput.value.trim();
    const weightRaw = weightInput.value.trim();
    if (!name) { alert("Grade Type is required."); return; }
    if (draftGradeTypes().some((gt) => gt.id !== editingGradeTypeId && gt.name.toLowerCase() === name.toLowerCase())) {
      alert("That grade type already exists.");
      return;
    }
    let weight = null;
    if (weightRaw !== "") {
      const parsed = Number(weightRaw);
      if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
        alert("Grade Weight must be a percentage between 0 and 100.");
        return;
      }
      const totalConfiguredExcludingEditing = draftGradeTypes()
        .filter((gt) => gt.id !== editingGradeTypeId)
        .reduce((sum, gt) => sum + (gt.weight == null ? 0 : Number(gt.weight) || 0), 0);
      if ((totalConfiguredExcludingEditing + parsed) > 100.00001) {
        alert("Grade weights cannot exceed 100% total.");
        return;
      }
      weight = parsed;
    }
    if (editingGradeTypeId) {
      updateLegacyLocalDraftGradeType(draftGradeTypes().find((gt) => gt.id === editingGradeTypeId), { name, weight });
      editingGradeTypeId = "";
    } else {
      createLegacyLocalDraftGradeType({ name, weight });
    }
    gradeTypeDraftDirty = true;
    e.target.reset();
    renderGradeTypes();
  });
  const gradeTypeCancelEditBtn = document.getElementById("grade-type-cancel-edit-btn");
  if (gradeTypeCancelEditBtn) {
    gradeTypeCancelEditBtn.addEventListener("click", () => cancelGradeTypeEdit());
  }
  const gradeTypeApplyBtn = document.getElementById("grade-type-apply-btn");
  if (gradeTypeApplyBtn) {
    gradeTypeApplyBtn.addEventListener("click", () => {
      if (!ensureAdminAction()) return;
      const totalWeight = draftGradeTypes().reduce((sum, gt) => sum + (gt.weight == null ? 0 : Number(gt.weight) || 0), 0);
      if (Math.abs(totalWeight - 100) > 0.05) {
        alert("Grade Type weights must total exactly 100% before applying.");
        return;
      }
      if (hostedModeEnabled) {
        (async () => {
          try {
            const saved = await saveHostedGradeTypes(cloneGradeTypes(draftGradeTypes()));
            state.settings.gradeTypes = cloneGradeTypes(Array.isArray(saved) ? saved : []);
            gradeTypesDraft = cloneGradeTypes(state.settings.gradeTypes);
            gradeTypeDraftDirty = false;
            editingGradeTypeId = "";
            renderAll();
          } catch (error) {
            alert(error.message || "Unable to save grade types.");
          }
        })();
        return;
      }
      applyLegacyLocalGradeTypes(draftGradeTypes());
      gradeTypeDraftDirty = false;
      editingGradeTypeId = "";
      saveState();
      renderAll();
    });
  }
  const gradeTypeCancelChangesBtn = document.getElementById("grade-type-cancel-changes-btn");
  if (gradeTypeCancelChangesBtn) {
    gradeTypeCancelChangesBtn.addEventListener("click", () => {
      if (!ensureAdminAction()) return;
      gradeTypesDraft = cloneGradeTypes(state.settings.gradeTypes);
      gradeTypeDraftDirty = false;
      editingGradeTypeId = "";
      const form = document.getElementById("grade-type-form");
      if (form) form.reset();
      renderGradeTypes();
    });
  }
  document.getElementById("grading-criteria-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!ensureAdminAction()) return;
    const letterScale = readLetterScaleForm();
    const validation = validateLetterScale(letterScale);
    if (!validation.valid) {
      setGradingCriteriaMessage("error", validation.message);
      return;
    }
    const gpaScaleOption = document.getElementById("grading-gpa-scale").value;
    const gpaOtherRaw = document.getElementById("grading-gpa-other").value;
    const gpaMax = gpaScaleOption === "other" ? Number(gpaOtherRaw) : Number(gpaScaleOption);
    if (!Number.isInteger(gpaMax) || gpaMax <= 0) {
      setGradingCriteriaMessage("error", "GPA Max must be a whole number greater than 0.");
      return;
    }
    if (hostedModeEnabled) {
      (async () => {
        try {
          const saved = await saveHostedGradingCriteria({
            letterScale: validation.scale.map((entry) => ({ ...entry })),
            gpaScaleOption,
            gpaMax
          });
          state.settings.gradingCriteria = {
            letterScale: Array.isArray(saved?.letterScale) ? saved.letterScale.map((entry) => ({ ...entry })) : [],
            gpaScaleOption: saved?.gpaScaleOption || gpaScaleOption,
            gpaMax: saved?.gpaMax == null ? gpaMax : Number(saved.gpaMax)
          };
          gradingCriteriaEditMode = false;
          setGradingCriteriaMessage("success", "Grading Criteria saved.");
          renderAll();
        } catch (error) {
          setGradingCriteriaMessage("error", error.message || "Unable to save grading criteria.");
        }
      })();
      return;
    }
    saveLegacyLocalGradingCriteria({
      letterScale: validation.scale,
      gpaScaleOption,
      gpaMax
    });
    gradingCriteriaEditMode = false;
    setGradingCriteriaMessage("success", "Grading Criteria saved.");
    saveState();
    renderAll();
  });
  const gradingCriteriaEditBtn = document.getElementById("grading-criteria-edit-btn");
  if (gradingCriteriaEditBtn) {
    gradingCriteriaEditBtn.addEventListener("click", () => {
      if (!ensureAdminAction()) return;
      gradingCriteriaEditMode = true;
      setGradingCriteriaMessage("", "");
      renderGradingCriteria();
    });
  }
  const gradingCriteriaCancelBtn = document.getElementById("grading-criteria-cancel-btn");
  if (gradingCriteriaCancelBtn) {
    gradingCriteriaCancelBtn.addEventListener("click", () => {
      gradingCriteriaEditMode = false;
      setGradingCriteriaMessage("", "");
      renderGradingCriteria();
    });
  }
  const gradingGpaScaleSelect = document.getElementById("grading-gpa-scale");
  if (gradingGpaScaleSelect) {
    gradingGpaScaleSelect.addEventListener("change", () => updateGradingCriteriaFormMode());
  }
  const courseCancelEditBtn = document.getElementById("course-cancel-edit-btn");
  if (courseCancelEditBtn) {
    courseCancelEditBtn.addEventListener("click", () => cancelCourseEdit());
  }

  document.getElementById("student-enrollment-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!ensureAdminAction()) return;
    const studentId = selectedStudentId;
    const courseIds = getSelectedStudentEnrollmentCourseIds();
    if (!studentId || !courseIds.length) return;
    const workingEnrollments = studentEnrollmentDraftStudentId === studentId ? studentEnrollmentDraft : state.enrollments;
    const existingCourseIds = new Set(
      workingEnrollments
        .filter((entry) => entry.studentId === studentId)
        .map((entry) => entry.courseId)
    );
    const newCourseIds = courseIds.filter((courseId) => !existingCourseIds.has(courseId));
    if (!newCourseIds.length) { alert("Student is already enrolled in the selected course(s)."); return; }
    if (studentViewMode === "detail" && studentEnrollmentDraftStudentId === studentId) {
      studentEnrollmentDraft.push(...newCourseIds.map((courseId) => ({ id: uid(), studentId, courseId, scheduleOrder: null })));
      studentEnrollmentDraftDirty = true;
      renderStudentDetail();
      return;
    }
    if (hostedModeEnabled) {
      (async () => {
        try {
          for (const courseId of newCourseIds) {
            await createHostedEnrollment({ id: uid(), studentId, courseId, scheduleOrder: null });
          }
          await refreshHostedEnrollments();
          renderAll();
        } catch (error) {
          alert(error.message || "Unable to save enrollment.");
        }
      })();
      return;
    }
    newCourseIds.forEach((courseId) => createLegacyLocalEnrollment({ studentId, courseId, scheduleOrder: null }));
    saveState();
    renderAll();
  });

  const studentDetailCancelBtn = document.getElementById("student-detail-cancel-btn");
  if (studentDetailCancelBtn) {
    studentDetailCancelBtn.addEventListener("click", () => {
      resetStudentEnrollmentDraft();
      selectedStudentId = "";
      setStudentViewMode("list");
      renderStudentViewMode();
      renderAll();
    });
  }

  const studentDetailApplyBtn = document.getElementById("student-detail-apply-btn");
  if (studentDetailApplyBtn) {
    studentDetailApplyBtn.addEventListener("click", () => {
      if (!ensureAdminAction()) return;
      const studentId = selectedStudentId;
      if (!studentId || studentEnrollmentDraftStudentId !== studentId) return;
      const existingEnrollments = state.enrollments.filter((entry) => entry.studentId === studentId).map((entry) => ({ ...entry }));
      const draftEnrollments = studentEnrollmentDraft.map((entry) => ({
        ...entry,
        studentId,
        scheduleOrder: parseScheduleOrderValue(entry.scheduleOrder)
      }));
      if (hostedModeEnabled) {
        (async () => {
          try {
            const existingById = new Map(existingEnrollments.map((entry) => [entry.id, entry]));
            const draftById = new Map(draftEnrollments.map((entry) => [entry.id, entry]));
            for (const existing of existingEnrollments) {
              if (!draftById.has(existing.id)) {
                await deleteHostedEnrollment(existing.id);
              }
            }
            for (const draft of draftEnrollments) {
              const existing = existingById.get(draft.id);
              if (!existing) {
                await createHostedEnrollment(draft);
                continue;
              }
              const existingOrder = parseScheduleOrderValue(existing.scheduleOrder);
              if (existing.courseId !== draft.courseId || existingOrder !== draft.scheduleOrder) {
                await updateHostedEnrollment(draft.id, {
                  studentId: draft.studentId,
                  courseId: draft.courseId,
                  scheduleOrder: draft.scheduleOrder
                });
              }
            }
            await refreshHostedEnrollments();
            primeStudentEnrollmentDraft(studentId);
            renderAll();
          } catch (error) {
            alert(error.message || "Unable to apply enrollment changes.");
          }
        })();
        return;
      }
      state.enrollments = state.enrollments.filter((entry) => entry.studentId !== studentId);
      state.enrollments.push(...draftEnrollments.map((entry) => ({ ...entry })));
      saveState();
      primeStudentEnrollmentDraft(studentId);
      renderAll();
    });
  }

  document.getElementById("reports-form").addEventListener("submit", (e) => {
    e.preventDefault();
    generatePrintableReport();
  });
  const reportsSchoolYearSelect = document.getElementById("reports-school-year");
  if (reportsSchoolYearSelect) {
    reportsSchoolYearSelect.addEventListener("change", () => {
      syncReportsQuarterOptions();
      setReportsMessage("", "Select report criteria and content to generate a printable report.");
    });
  }
  ["reports-quarter", "reports-instructor"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener("change", () => {
        setReportsMessage("", "Select report criteria and content to generate a printable report.");
      });
    }
  });

  document.getElementById("school-year-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!ensureAdminAction()) return;
    const label = document.getElementById("school-year-label").value.trim();
    const startDate = document.getElementById("school-year-start").value;
    const endDate = document.getElementById("school-year-end").value;
    const requiredInstructionalDaysRaw = document.getElementById("school-year-required-days").value;
    const requiredInstructionalHoursRaw = document.getElementById("school-year-required-hours").value;
    const requiredInstructionalDays = requiredInstructionalDaysRaw === "" ? null : Number(requiredInstructionalDaysRaw);
    const requiredInstructionalHours = requiredInstructionalHoursRaw === "" ? null : Number(requiredInstructionalHoursRaw);
    if (!label) { alert("School year label is required."); return; }
    if (!validRange(startDate, endDate)) { alert("School year range is invalid."); return; }
    if (requiredInstructionalDays != null && (!Number.isInteger(requiredInstructionalDays) || requiredInstructionalDays < 0)) { alert("Required Instructional Days must be a whole number 0 or greater."); return; }
    if (requiredInstructionalHours != null && (!Number.isFinite(requiredInstructionalHours) || requiredInstructionalHours < 0)) { alert("Required Instructional Hours must be 0 or greater."); return; }
    if (hostedModeEnabled) {
      (async () => {
        try {
          const payload = {
            label,
            startDate,
            endDate,
            requiredInstructionalDays,
            requiredInstructionalHours,
            isCurrent: editingSchoolYearId ? (getSchoolYear(editingSchoolYearId)?.id === state.settings.currentSchoolYearId) : state.settings.schoolYears.length === 0
          };
          if (editingSchoolYearId) {
            await ensureHostedSchoolYearRecord({
              id: editingSchoolYearId,
              ...payload
            }, {
              id: editingSchoolYearId,
              isCurrent: payload.isCurrent
            });
          } else {
            await createHostedSchoolYear({ id: uid(), ...payload });
          }
          editingSchoolYearId = "";
          await refreshHostedSchoolConfigState();
          renderAll();
        } catch (error) {
          alert(error.message || "Unable to save school year.");
        }
      })();
      return;
    }
    const existing = state.settings.schoolYears.find((year) => year.id === editingSchoolYearId);
    const previousStartDate = existing?.startDate || "";
    const previousEndDate = existing?.endDate || "";
    if (existing) {
      updateLegacyLocalSchoolYear(existing, {
        label,
        startDate,
        endDate,
        requiredInstructionalDays,
        requiredInstructionalHours
      });
      syncAnnualPlansForSchoolYear(previousStartDate, previousEndDate, startDate, endDate);
    } else {
      const duplicate = state.settings.schoolYears.find((year) =>
        year.label.toLowerCase() === label.toLowerCase()
        && year.startDate === startDate
        && year.endDate === endDate);
      if (duplicate) { alert("That school year already exists."); return; }
      createLegacyLocalSchoolYear({ label, startDate, endDate, requiredInstructionalDays, requiredInstructionalHours });
    }
    const schoolYearId = existing ? existing.id : state.settings.schoolYears[state.settings.schoolYears.length - 1].id;
    setCurrentSchoolYear(schoolYearId);
    editingSchoolYearId = "";
    saveState();
    renderAll();
  });
  const schoolYearCancelEditBtn = document.getElementById("school-year-cancel-edit-btn");
  if (schoolYearCancelEditBtn) {
    schoolYearCancelEditBtn.addEventListener("click", () => cancelSchoolYearEdit());
  }

  document.getElementById("quarters-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!ensureAdminAction()) return;
    const schoolYearId = document.getElementById("quarter-school-year").value;
    if (!schoolYearId) { alert("Select a school year for these quarters."); return; }
    const previousQuarterByName = new Map(
      state.settings.allQuarters
        .filter((quarter) => quarter.schoolYearId === schoolYearId)
        .map((quarter) => [quarter.name, { ...quarter }])
    );
    const q = [
      { id: uid(), schoolYearId, name: "Q1", startDate: document.getElementById("q1-start").value, endDate: document.getElementById("q1-end").value },
      { id: uid(), schoolYearId, name: "Q2", startDate: document.getElementById("q2-start").value, endDate: document.getElementById("q2-end").value },
      { id: uid(), schoolYearId, name: "Q3", startDate: document.getElementById("q3-start").value, endDate: document.getElementById("q3-end").value },
      { id: uid(), schoolYearId, name: "Q4", startDate: document.getElementById("q4-start").value, endDate: document.getElementById("q4-end").value }
    ];
    if (!q.every((x)=>validRange(x.startDate, x.endDate))) { alert("Each quarter needs a valid date range."); return; }
    if (hostedModeEnabled) {
      (async () => {
        try {
          await saveHostedQuarters(schoolYearId, q);
          editingQuarterSchoolYearId = "";
          await refreshHostedSchoolConfigState();
          renderAll();
        } catch (error) {
          alert(error.message || "Unable to save quarters.");
        }
      })();
      return;
    }
    replaceLegacyLocalQuarters(schoolYearId, q);
    syncQuarterlyPlansForSchoolYear(schoolYearId, previousQuarterByName, q);
    if (schoolYearId === state.settings.currentSchoolYearId) setCurrentSchoolYear(schoolYearId);
    editingQuarterSchoolYearId = "";
    saveState();
    renderAll();
  });
  const quartersCancelEditBtn = document.getElementById("quarters-cancel-edit-btn");
  if (quartersCancelEditBtn) {
    quartersCancelEditBtn.addEventListener("click", () => cancelQuarterEdit());
  }
  const quarterSchoolYear = document.getElementById("quarter-school-year");
  if (quarterSchoolYear) {
    quarterSchoolYear.addEventListener("change", () => {
      editingQuarterSchoolYearId = "";
      fillSettingsForms();
      renderPlanningSettings();
    });
  }

  document.getElementById("daily-break-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!ensureAdminAction()) return;
    const selectedSchoolYear = currentSchoolYear();
    const schoolYearId = getSchoolYear(state.settings.currentSchoolYearId)?.id || selectedSchoolYear?.id || "";
    const studentIds = getSelectedDailyBreakStudentIds();
    const type = document.getElementById("daily-break-type").value;
    const description = document.getElementById("daily-break-description").value.trim();
    const startTime = normalizeDailyBreakStartTime(document.getElementById("daily-break-start-time").value);
    const durationMinutes = Number(document.getElementById("daily-break-duration").value);
    const weekdays = Array.from(document.querySelectorAll("input[name='daily-break-weekday']:checked")).map((input) => Number(input.value));
    if (!schoolYearId) {
      alert("Select or create a valid school year before adding a daily lunch or break schedule.");
      return;
    }
    if (!studentIds.length) {
      alert("Select at least one student for the daily lunch or break schedule.");
      return;
    }
    if (!startTime) {
      alert("Provide a valid start time for the daily lunch or break schedule.");
      return;
    }
    if (!Number.isFinite(durationMinutes) || durationMinutes < 5) {
      alert("Provide a duration of at least 5 minutes for the daily lunch or break schedule.");
      return;
    }
    if (!weekdays.length) {
      alert("Select at least one weekday for the daily lunch or break schedule.");
      return;
    }
    if (type === "other" && !description) {
      alert("Provide a description when the break type is Other.");
      return;
    }
    const payload = {
      schoolYearId,
      studentIds,
      type,
      description: type === "other" ? description : "",
      startTime,
      durationMinutes,
      weekdays
    };
    if (hostedModeEnabled) {
      (async () => {
        try {
          const ensuredSchoolYear = await ensureHostedSchoolYearRecord({
            id: schoolYearId,
            ...selectedSchoolYear
          }, {
            id: schoolYearId,
            isCurrent: true
          });
          const resolvedSchoolYearId = ensuredSchoolYear?.id || schoolYearId;
          if (editingDailyBreakId) {
            await updateHostedDailyBreak(editingDailyBreakId, {
              ...payload,
              schoolYearId: resolvedSchoolYearId
            });
          } else {
            await createHostedDailyBreak({
              id: uid(),
              ...payload,
              schoolYearId: resolvedSchoolYearId
            });
          }
          editingDailyBreakId = "";
          resetDailyBreakForm();
          await refreshHostedSchoolConfigState();
          await refreshHostedDailyBreaks();
          renderAll();
        } catch (error) {
          alert(error.message || "Unable to save daily break.");
        }
      })();
      return;
    }
    if (editingDailyBreakId) {
      updateLegacyLocalDailyBreak(state.settings.dailyBreaks.find((entry) => entry.id === editingDailyBreakId), payload);
      editingDailyBreakId = "";
    } else {
      createLegacyLocalDailyBreak(payload);
    }
    resetDailyBreakForm();
    saveState();
    renderAll();
  });
  const dailyBreakCancelEditBtn = document.getElementById("daily-break-cancel-edit-btn");
  if (dailyBreakCancelEditBtn) {
    dailyBreakCancelEditBtn.addEventListener("click", () => cancelDailyBreakEdit());
  }
  const dailyBreakTypeSelect = document.getElementById("daily-break-type");
  if (dailyBreakTypeSelect) {
    dailyBreakTypeSelect.addEventListener("change", () => updateDailyBreakFormMode());
  }

  document.getElementById("holiday-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!ensureAdminAction()) return;
    const name = document.getElementById("holiday-name").value.trim();
    const type = document.getElementById("holiday-type").value;
    const startDate = document.getElementById("holiday-start").value;
    const endDate = document.getElementById("holiday-end").value;
    if (!name || !validRange(startDate, endDate)) { alert("Provide valid holiday/break values."); return; }
    const payload = { name, type, startDate, endDate };
    if (hostedModeEnabled) {
      (async () => {
        try {
          if (editingHolidayId) {
            await updateHostedHoliday(editingHolidayId, payload);
          } else {
            await createHostedHoliday({ id: uid(), ...payload });
          }
          editingHolidayId = "";
          e.target.reset();
          await refreshHostedHolidays();
          renderAll();
        } catch (error) {
          alert(error.message || "Unable to save holiday.");
        }
      })();
      return;
    }
    if (editingHolidayId) {
      updateLegacyLocalHoliday(state.settings.holidays.find((h) => h.id === editingHolidayId), payload);
      editingHolidayId = "";
    } else {
      createLegacyLocalHoliday(payload);
    }
    e.target.reset();
    saveState();
    renderAll();
  });
  const holidayCancelEditBtn = document.getElementById("holiday-cancel-edit-btn");
  if (holidayCancelEditBtn) {
    holidayCancelEditBtn.addEventListener("click", () => cancelHolidayEdit());
  }

  document.getElementById("plan-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!ensureAdminAction()) return;
    const planType = document.getElementById("plan-type").value;
    const studentId = document.getElementById("plan-student").value;
    const courseIds = getSelectedPlanCourseIds();
    const weekdays = Array.from(document.querySelectorAll("input[name='weekday']:checked")).map((x)=>Number(x.value));
    if (!studentId || !courseIds.length || !weekdays.length) { alert("Plan must include student, at least one enrolled course, and at least one weekday."); return; }
    if (editingPlanId && courseIds.length !== 1) { alert("When editing a plan, select exactly one course."); return; }
    const activePlanId = editingPlanId;
    const editCourseId = courseIds[0];
    let hostedCreatePayloads = [];
    let hostedUpdatePayload = null;

    if (planType === "annual") {
      const startDate = state.settings.schoolYear.startDate;
      const endDate = state.settings.schoolYear.endDate;
      if (!validRange(startDate, endDate)) { alert("Current school year range is invalid."); return; }
      hostedCreatePayloads = courseIds.map((courseId) => ({ id: uid(), planType, studentId, courseId, startDate, endDate, weekdays }));
      hostedUpdatePayload = { planType, studentId, courseId: editCourseId, startDate, endDate, weekdays };
      if (isLegacyBridgeMode() && activePlanId) {
        updateLegacyLocalPlan(state.plans.find((p) => p.id === editingPlanId), hostedUpdatePayload);
        editingPlanId = "";
      } else if (isLegacyBridgeMode()) {
        createLegacyLocalPlans(hostedCreatePayloads);
      }
    } else if (planType === "quarterly") {
      const selectedQuarterNames = getSelectedPlanQuarters();
      if (!selectedQuarterNames.length) { alert("Select at least one quarter."); return; }
      const selectedQuarters = selectedQuarterNames
        .map((name) => state.settings.quarters.find((q) => q.name === name))
        .filter(Boolean);
      if (!selectedQuarters.length) { alert("Selected quarter configuration is invalid."); return; }
      hostedCreatePayloads = selectedQuarters.flatMap((quarter) =>
        courseIds.map((courseId) => ({
          id: uid(),
          planType,
          studentId,
          courseId,
          startDate: quarter.startDate,
          endDate: quarter.endDate,
          weekdays,
          quarterName: quarter.name
        }))
      );

      if (activePlanId) {
        if (selectedQuarters.length > 1) {
          alert("When editing a plan, select exactly one quarter.");
          return;
        }
        const targetQuarter = selectedQuarters[0];
        hostedUpdatePayload = {
          planType,
          studentId,
          courseId: editCourseId,
          startDate: targetQuarter.startDate,
          endDate: targetQuarter.endDate,
          weekdays,
          quarterName: targetQuarter.name
        };
        if (isLegacyBridgeMode()) {
          updateLegacyLocalPlan(state.plans.find((p) => p.id === editingPlanId), hostedUpdatePayload);
          editingPlanId = "";
        }
      } else if (isLegacyBridgeMode()) {
        createLegacyLocalPlans(hostedCreatePayloads);
      }
    } else {
      const startDate = document.getElementById("plan-start").value;
      const endDate = document.getElementById("plan-end").value;
      if (!validRange(startDate, endDate)) { alert("Provide a valid weekly start/end range."); return; }
      hostedCreatePayloads = courseIds.map((courseId) => ({ id: uid(), planType, studentId, courseId, startDate, endDate, weekdays }));
      hostedUpdatePayload = { planType, studentId, courseId: editCourseId, startDate, endDate, weekdays };
      if (isLegacyBridgeMode() && activePlanId) {
        updateLegacyLocalPlan(state.plans.find((p) => p.id === editingPlanId), hostedUpdatePayload);
        editingPlanId = "";
      } else if (isLegacyBridgeMode()) {
        createLegacyLocalPlans(hostedCreatePayloads);
      }
    }
    if (hostedModeEnabled) {
      (async () => {
        try {
          if (activePlanId) {
            await updateHostedPlan(activePlanId, hostedUpdatePayload);
          } else {
            await createHostedPlans(hostedCreatePayloads);
          }
          editingPlanId = "";
          await refreshHostedPlans();
          renderAll();
        } catch (error) {
          alert(error.message || "Unable to save plan.");
        }
      })();
      return;
    }
    saveState();
    renderAll();
  });
  const planCancelEditBtn = document.getElementById("plan-cancel-edit-btn");
  if (planCancelEditBtn) {
    planCancelEditBtn.addEventListener("click", () => cancelPlanEdit());
  }
  const planTypeSelect = document.getElementById("plan-type");
  if (planTypeSelect) {
    planTypeSelect.addEventListener("change", () => {
      editingPlanId = "";
      const planStudentId = document.getElementById("plan-student")?.value || "";
      renderPlanCourseChecklist([], planStudentId);
      renderPlanQuarterOptions([]);
      updatePlanFormMode();
      renderPlans();
    });
  }
  const planStudentSelect = document.getElementById("plan-student");
  if (planStudentSelect) {
    planStudentSelect.addEventListener("change", () => {
      const selected = getSelectedPlanCourseIds();
      renderPlanCourseChecklist(selected, planStudentSelect.value);
    });
  }

  document.getElementById("calendar-form").addEventListener("submit", (e) => { e.preventDefault(); renderCalendar(); });
  const calendarViewSelect = document.getElementById("calendar-view");
  if (calendarViewSelect) {
    calendarViewSelect.addEventListener("change", () => renderCalendar());
  }
  const calendarDateInput = document.getElementById("calendar-date");
  if (calendarDateInput) {
    calendarDateInput.addEventListener("change", () => renderCalendar());
  }
  document.getElementById("calendar-prev-month").addEventListener("click", () => {
    const input = document.getElementById("calendar-date");
    const base = toDate(input.value || todayISO());
    const moved = new Date(base.getFullYear(), base.getMonth() - 1, 1, 12, 0, 0);
    input.value = toISO(moved);
    document.getElementById("calendar-view").value = "month";
    renderCalendar();
  });
  document.getElementById("calendar-next-month").addEventListener("click", () => {
    const input = document.getElementById("calendar-date");
    const base = toDate(input.value || todayISO());
    const moved = new Date(base.getFullYear(), base.getMonth() + 1, 1, 12, 0, 0);
    input.value = toISO(moved);
    document.getElementById("calendar-view").value = "month";
    renderCalendar();
  });
  document.getElementById("calendar-prev-period").addEventListener("click", () => {
    const input = document.getElementById("calendar-date");
    const view = document.getElementById("calendar-view").value;
    const base = toDate(input.value || todayISO());
    const moved = new Date(base);
    if (view === "week") moved.setDate(moved.getDate() - 7);
    else moved.setDate(moved.getDate() - 1);
    input.value = toISO(moved);
    renderCalendar();
  });
  document.getElementById("calendar-next-period").addEventListener("click", () => {
    const input = document.getElementById("calendar-date");
    const view = document.getElementById("calendar-view").value;
    const base = toDate(input.value || todayISO());
    const moved = new Date(base);
    if (view === "week") moved.setDate(moved.getDate() + 7);
    else moved.setDate(moved.getDate() + 1);
    input.value = toISO(moved);
    renderCalendar();
  });
  const calendarBackWeekBtn = document.getElementById("calendar-back-week");
  if (calendarBackWeekBtn) {
    calendarBackWeekBtn.addEventListener("click", () => {
      if (!calendarBackToWeekContext) return;
      const viewInput = document.getElementById("calendar-view");
      const dateInput = document.getElementById("calendar-date");
      if (viewInput) viewInput.value = "week";
      if (dateInput) dateInput.value = calendarBackToWeekContext.date;
      applyCalendarFilterSelection(calendarBackToWeekContext);
      syncCalendarFilterSubjectCourseOptions();
      calendarBackToWeekContext = null;
      renderCalendar();
    });
  }
  const calendarBackMonthBtn = document.getElementById("calendar-back-month");
  if (calendarBackMonthBtn) {
    calendarBackMonthBtn.addEventListener("click", () => {
      if (!calendarBackToMonthContext) return;
      const viewInput = document.getElementById("calendar-view");
      const dateInput = document.getElementById("calendar-date");
      if (viewInput) viewInput.value = "month";
      if (dateInput) dateInput.value = calendarBackToMonthContext.date;
      applyCalendarFilterSelection(calendarBackToMonthContext);
      syncCalendarFilterSubjectCourseOptions();
      calendarBackToMonthContext = null;
      calendarBackToWeekContext = null;
      renderCalendar();
    });
  }

  document.getElementById("attendance-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!ensureAdminAction()) return;
    const studentIds = Array.from(document.querySelectorAll(".attendance-student-checkbox:checked")).map((el) => el.value);
    const date = document.getElementById("attendance-date").value;
    const status = document.getElementById("attendance-status").value;
    if (!studentIds.length) { alert("Select at least one student."); return; }
    if (!date) return;
    if (hostedModeEnabled) {
      (async () => {
        try {
          if (editingAttendanceId) {
            const studentId = studentIds[0];
            await updateHostedAttendance(editingAttendanceId, {
              studentId,
              date,
              present: status === "present"
            });
          } else {
            const duplicates = studentIds
              .map((studentId) => state.attendance.find((a) => a.studentId === studentId && a.date === date))
              .filter(Boolean);
            if (duplicates.length) {
              if (duplicates.length === 1 && studentIds.length === 1) {
                const existing = duplicates[0];
                const shouldEdit = confirm(`An attendance record already exists for ${getStudentName(existing.studentId)} on ${date}. Select OK to edit the existing record instead.`);
                if (shouldEdit) {
                  editingAttendanceId = existing.id;
                  renderAttendanceStudentChecklist([existing.studentId]);
                  document.getElementById("attendance-date").value = existing.date;
                  document.getElementById("attendance-status").value = existing.present ? "present" : "absent";
                  document.getElementById("attendance-submit-btn").textContent = "Update Attendance";
                  document.getElementById("attendance-cancel-edit-btn").classList.remove("hidden");
                }
                return;
              }
              const duplicateNames = duplicates.map((record) => getStudentName(record.studentId)).join(", ");
              alert(`Attendance record(s) already exist for ${duplicateNames} on ${date}. Edit the existing record instead of creating a duplicate.`);
              return;
            }
            for (const studentId of studentIds) {
              await createHostedAttendance({
                id: uid(),
                studentId,
                date,
                present: status === "present"
              });
            }
          }
          resetAttendanceEditMode();
          await refreshHostedAttendance();
          renderAll();
        } catch (error) {
          alert(error.message || "Unable to save attendance.");
        }
      })();
      return;
    }
    if (editingAttendanceId) {
      const studentId = studentIds[0];
      const target = state.attendance.find((a) => a.id === editingAttendanceId);
      if (target) {
        updateLegacyLocalAttendance(target, {
          studentId,
          date,
          present: status === "present"
        });
      }
      const duplicate = state.attendance.find((a) => a.id !== editingAttendanceId && a.studentId === studentId && a.date === date);
      if (duplicate) {
        duplicate.present = status === "present";
        deleteLegacyLocalAttendance(editingAttendanceId);
      }
    } else {
      const duplicates = studentIds
        .map((studentId) => state.attendance.find((a) => a.studentId === studentId && a.date === date))
        .filter(Boolean);
      if (duplicates.length) {
        if (duplicates.length === 1 && studentIds.length === 1) {
          const existing = duplicates[0];
          const shouldEdit = confirm(`An attendance record already exists for ${getStudentName(existing.studentId)} on ${date}. Select OK to edit the existing record instead.`);
          if (shouldEdit) {
            editingAttendanceId = existing.id;
            renderAttendanceStudentChecklist([existing.studentId]);
            document.getElementById("attendance-date").value = existing.date;
            document.getElementById("attendance-status").value = existing.present ? "present" : "absent";
            document.getElementById("attendance-submit-btn").textContent = "Update Attendance";
            document.getElementById("attendance-cancel-edit-btn").classList.remove("hidden");
          }
          return;
        }
        const duplicateNames = duplicates.map((record) => getStudentName(record.studentId)).join(", ");
        alert(`Attendance record(s) already exist for ${duplicateNames} on ${date}. Edit the existing record instead of creating a duplicate.`);
        return;
      }
      studentIds.forEach((studentId) => {
        const existing = state.attendance.find((a)=>a.studentId===studentId && a.date===date);
        if (existing) existing.present = status === "present";
        else createLegacyLocalAttendance({ studentId, date, present: status === "present" });
      });
    }
    resetAttendanceEditMode();
    saveState(); renderAll();
  });
  document.getElementById("attendance-cancel-edit-btn").addEventListener("click", () => {
    resetAttendanceEditMode();
    renderAll();
  });
  ["attendance-filter-student", "attendance-filter-date", "attendance-filter-quarter", "attendance-filter-status"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", () => renderAttendance());
  });
  const attendanceClearFiltersBtn = document.getElementById("attendance-clear-filters-btn");
  if (attendanceClearFiltersBtn) {
    attendanceClearFiltersBtn.addEventListener("click", () => {
      const studentFilter = document.getElementById("attendance-filter-student");
      const dateFilter = document.getElementById("attendance-filter-date");
      const quarterFilter = document.getElementById("attendance-filter-quarter");
      const statusFilter = document.getElementById("attendance-filter-status");
      if (studentFilter) studentFilter.value = "all";
      if (dateFilter) dateFilter.value = "";
      if (quarterFilter) quarterFilter.value = "all";
      if (statusFilter) statusFilter.value = "all";
      renderAttendance();
    });
  }
  const studentDetailQuarterFilter = document.getElementById("student-detail-quarter-filter");
  if (studentDetailQuarterFilter) {
    studentDetailQuarterFilter.addEventListener("change", () => renderStudentDetail());
  }
  document.getElementById("add-grade-row-btn").addEventListener("click", () => {
    if (!ensureAdminAction()) return;
    if (!state.students.length || !state.subjects.length || !state.courses.length) {
      alert("Add at least one student, subject, and course before entering grades.");
      return;
    }
    document.getElementById("grade-entry-body").appendChild(buildGradeEntryRow());
    updateGradeEntryVisibility();
  });
  ["grades-filter-student", "grades-filter-quarter", "grades-filter-school-year", "grades-filter-subject", "grades-filter-instructor", "grades-filter-course", "grades-filter-grade-type"]
    .forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("change", () => {
        if (id === "grades-filter-student" || id === "grades-filter-subject" || id === "grades-filter-instructor") {
          syncGradesFilterSubjectCourseOptions();
        }
        renderTests();
      });
    });
  const gradesClearFiltersBtn = document.getElementById("grades-clear-filters-btn");
  if (gradesClearFiltersBtn) {
    gradesClearFiltersBtn.addEventListener("click", () => {
      const filterIds = [
        "grades-filter-student",
        "grades-filter-quarter",
        "grades-filter-school-year",
        "grades-filter-subject",
        "grades-filter-instructor",
        "grades-filter-course",
        "grades-filter-grade-type"
      ];
      filterIds.forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = "all";
      });
      syncGradesFilterSubjectCourseOptions();
      renderTests();
    });
  }
  ["plan-filter-type", "plan-filter-student"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", () => renderPlans());
  });
  const planClearFiltersBtn = document.getElementById("plan-clear-filters-btn");
  if (planClearFiltersBtn) {
    planClearFiltersBtn.addEventListener("click", () => {
      const typeFilter = document.getElementById("plan-filter-type");
      const studentFilter = document.getElementById("plan-filter-student");
      if (typeFilter) typeFilter.value = "all";
      if (studentFilter) studentFilter.value = "all";
      renderPlans();
    });
  }
  ["trend-filter-quarter", "trend-filter-subject", "trend-filter-instructor", "trend-filter-grade-type"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", () => renderGradeTrending());
  });
  const trendClearFiltersBtn = document.getElementById("trend-clear-filters-btn");
  if (trendClearFiltersBtn) {
    trendClearFiltersBtn.addEventListener("click", () => {
      const quarterFilter = document.getElementById("trend-filter-quarter");
      const subjectFilter = document.getElementById("trend-filter-subject");
      const instructorFilter = document.getElementById("trend-filter-instructor");
      const gradeTypeFilter = document.getElementById("trend-filter-grade-type");
      if (quarterFilter) quarterFilter.value = "all";
      if (subjectFilter) subjectFilter.value = "all";
      if (instructorFilter) instructorFilter.value = "all";
      if (gradeTypeFilter) gradeTypeFilter.value = "all";
      trendSelectedStudentIds.clear();
      document.querySelectorAll(".trend-student-checkbox").forEach((el) => { el.checked = false; });
      updateTrendStudentSummary();
      renderGradeTrending();
    });
  }
  ["gpa-trend-filter-quarter", "gpa-trend-filter-subject", "gpa-trend-filter-instructor", "gpa-trend-filter-grade-type"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", () => renderGpaTrending());
  });
  const gpaTrendClearFiltersBtn = document.getElementById("gpa-trend-clear-filters-btn");
  if (gpaTrendClearFiltersBtn) {
    gpaTrendClearFiltersBtn.addEventListener("click", () => {
      const quarterFilter = document.getElementById("gpa-trend-filter-quarter");
      const subjectFilter = document.getElementById("gpa-trend-filter-subject");
      const instructorFilter = document.getElementById("gpa-trend-filter-instructor");
      const gradeTypeFilter = document.getElementById("gpa-trend-filter-grade-type");
      if (quarterFilter) quarterFilter.value = "all";
      if (subjectFilter) subjectFilter.value = "all";
      if (instructorFilter) instructorFilter.value = "all";
      if (gradeTypeFilter) gradeTypeFilter.value = "all";
      gpaTrendSelectedStudentIds.clear();
      document.querySelectorAll(".gpa-trend-student-checkbox").forEach((el) => { el.checked = false; });
      updateGpaTrendStudentSummary();
      renderGpaTrending();
    });
  }
  ["instruction-hours-trend-filter-quarter", "instruction-hours-trend-filter-subject", "instruction-hours-trend-filter-instructor"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", () => renderInstructionHoursTrending());
  });
  const instructionHoursTrendClearFiltersBtn = document.getElementById("instruction-hours-trend-clear-filters-btn");
  if (instructionHoursTrendClearFiltersBtn) {
    instructionHoursTrendClearFiltersBtn.addEventListener("click", () => {
      const quarterFilter = document.getElementById("instruction-hours-trend-filter-quarter");
      const subjectFilter = document.getElementById("instruction-hours-trend-filter-subject");
      const instructorFilter = document.getElementById("instruction-hours-trend-filter-instructor");
      if (quarterFilter) quarterFilter.value = "all";
      if (subjectFilter) subjectFilter.value = "all";
      if (instructorFilter) instructorFilter.value = "all";
      instructionHoursTrendSelectedStudentIds.clear();
      document.querySelectorAll(".instruction-hours-trend-student-checkbox").forEach((el) => { el.checked = false; });
      updateInstructionHoursTrendStudentSummary();
      renderInstructionHoursTrending();
    });
  }
  ["volume-filter-quarter", "volume-filter-subject", "volume-filter-instructor", "volume-filter-grade-type"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", () => renderGradeTypeVolumeChart());
  });
  const volumeClearFiltersBtn = document.getElementById("volume-clear-filters-btn");
  if (volumeClearFiltersBtn) {
    volumeClearFiltersBtn.addEventListener("click", () => {
      const quarterFilter = document.getElementById("volume-filter-quarter");
      const subjectFilter = document.getElementById("volume-filter-subject");
      const instructorFilter = document.getElementById("volume-filter-instructor");
      const gradeTypeFilter = document.getElementById("volume-filter-grade-type");
      if (quarterFilter) quarterFilter.value = "all";
      if (subjectFilter) subjectFilter.value = "all";
      if (instructorFilter) instructorFilter.value = "all";
      if (gradeTypeFilter) gradeTypeFilter.value = "all";
      volumeSelectedStudentIds.clear();
      document.querySelectorAll(".volume-student-checkbox").forEach((el) => { el.checked = false; });
      updateVolumeStudentSummary();
      renderGradeTypeVolumeChart();
    });
  }
  ["work-filter-quarter", "work-filter-instructor"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", () => renderWorkDistributionChart());
  });
  const workClearFiltersBtn = document.getElementById("work-clear-filters-btn");
  if (workClearFiltersBtn) {
    workClearFiltersBtn.addEventListener("click", () => {
      const quarterFilter = document.getElementById("work-filter-quarter");
      const instructorFilter = document.getElementById("work-filter-instructor");
      if (quarterFilter) quarterFilter.value = "all";
      if (instructorFilter) instructorFilter.value = "all";
      workSelectedStudentIds.clear();
      document.querySelectorAll(".work-student-checkbox").forEach((el) => { el.checked = false; });
      workDistributionSelectedGradeTypes.clear();
      availableGradeTypes().forEach((type) => workDistributionSelectedGradeTypes.add(type));
      updateWorkStudentSummary();
      renderWorkDistributionGradeTypeFilter();
      renderWorkDistributionChart();
    });
  }

  document.addEventListener("change", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (t.classList.contains("attendance-student-checkbox")) {
      updateAttendanceStudentSummary();
      return;
    }
    if (t.classList.contains("trend-student-checkbox")) {
      trendSelectedStudentIds.clear();
      getTrendSelectedStudentIds().forEach((id) => trendSelectedStudentIds.add(id));
      updateTrendStudentSummary();
      renderGradeTrending();
      return;
    }
    if (t.classList.contains("gpa-trend-student-checkbox")) {
      gpaTrendSelectedStudentIds.clear();
      getGpaTrendSelectedStudentIds().forEach((id) => gpaTrendSelectedStudentIds.add(id));
      updateGpaTrendStudentSummary();
      renderGpaTrending();
      return;
    }
    if (t.classList.contains("instruction-hours-trend-student-checkbox")) {
      instructionHoursTrendSelectedStudentIds.clear();
      getInstructionHoursTrendSelectedStudentIds().forEach((id) => instructionHoursTrendSelectedStudentIds.add(id));
      updateInstructionHoursTrendStudentSummary();
      renderInstructionHoursTrending();
      return;
    }
    if (t.classList.contains("volume-student-checkbox")) {
      volumeSelectedStudentIds.clear();
      getVolumeSelectedStudentIds().forEach((id) => volumeSelectedStudentIds.add(id));
      updateVolumeStudentSummary();
      renderGradeTypeVolumeChart();
      return;
    }
    if (t.classList.contains("work-student-checkbox")) {
      workSelectedStudentIds.clear();
      getWorkSelectedStudentIds().forEach((id) => workSelectedStudentIds.add(id));
      updateWorkStudentSummary();
      renderWorkDistributionChart();
      return;
    }
    if (t.classList.contains("student-performance-grade-method-checkbox")) {
      studentPerformanceSelectedGradeMethods.clear();
      getSelectedStudentPerformanceGradeMethods().forEach((method) => studentPerformanceSelectedGradeMethods.add(method));
      renderStudentPerformanceGradeMethodChecklist(Array.from(studentPerformanceSelectedGradeMethods));
      renderDashboard();
      return;
    }
    if (t.classList.contains("student-performance-instructor-checkbox")) {
      studentPerformanceSelectedInstructorIds.clear();
      getSelectedStudentPerformanceInstructorIds().forEach((id) => studentPerformanceSelectedInstructorIds.add(id));
      updateStudentPerformanceInstructorSummary();
      renderDashboard();
      return;
    }
    if (t.classList.contains("student-instructional-hours-instructor-checkbox")) {
      studentInstructionalHoursSelectedInstructorIds.clear();
      getSelectedStudentInstructionalHoursInstructorIds().forEach((id) => studentInstructionalHoursSelectedInstructorIds.add(id));
      updateStudentInstructionalHoursInstructorSummary();
      renderDashboard();
      return;
    }
    if (t.classList.contains("work-dist-grade-type-checkbox")) {
      const selectedType = t.getAttribute("value") || "";
      if (!selectedType) return;
      if (t instanceof HTMLInputElement && t.checked) workDistributionSelectedGradeTypes.add(selectedType);
      else workDistributionSelectedGradeTypes.delete(selectedType);
      renderWorkDistributionChart();
      return;
    }
    if (t.classList.contains("plan-course-checkbox")) {
      updatePlanCourseSummary();
      return;
    }
    if (t.classList.contains("student-enroll-course-checkbox")) {
      updateStudentEnrollmentCourseSummary();
      return;
    }
    if (t.classList.contains("daily-break-student-checkbox")) {
      syncCalendarAllCheckbox("daily-break-student-checkbox", "daily-break-student-all-checkbox");
      updateDailyBreakStudentSummary();
      return;
    }
    if (t.classList.contains("daily-break-student-all-checkbox")) {
      const checked = t instanceof HTMLInputElement ? t.checked : false;
      document.querySelectorAll(".daily-break-student-checkbox").forEach((el) => {
        if (!(el instanceof HTMLInputElement)) return;
        el.checked = checked;
      });
      updateDailyBreakStudentSummary();
      return;
    }
    if (t.classList.contains("student-schedule-order-select")) {
      if (!ensureAdminAction()) {
        renderStudentDetail();
        return;
      }
      const enrollmentId = t.getAttribute("data-enrollment-order-id") || "";
      updateEnrollmentScheduleOrder(enrollmentId, t instanceof HTMLSelectElement ? t.value : "");
      return;
    }
    if (t.classList.contains("calendar-student-checkbox")) {
      calendarSelectedStudentIds = new Set(getCalendarSelectedStudentIds());
      syncCalendarAllCheckbox("calendar-student-checkbox", "calendar-student-all-checkbox");
      syncCalendarFilterSubjectCourseOptions();
      renderCalendar();
      return;
    }
    if (t.classList.contains("reports-student-checkbox")) {
      reportSelectedStudentIds = new Set(getSelectedReportStudentIds());
      updateReportStudentSummary();
      return;
    }
    if (t.classList.contains("reports-content-checkbox")) {
      reportSelectedContentIds = new Set(getSelectedReportContentIds());
      return;
    }
    if (t.classList.contains("calendar-student-all-checkbox")) {
      const checked = t instanceof HTMLInputElement ? t.checked : false;
      const studentIds = checked ? visibleStudents().map((student) => student.id) : [];
      applyCalendarFilterSelection({ studentIds });
      syncCalendarFilterSubjectCourseOptions();
      renderCalendar();
      return;
    }
    if (t.classList.contains("calendar-subject-checkbox")) {
      calendarSelectedSubjectIds = new Set(getCalendarSelectedSubjectIds());
      syncCalendarAllCheckbox("calendar-subject-checkbox", "calendar-subject-all-checkbox");
      syncCalendarFilterSubjectCourseOptions();
      renderCalendar();
      return;
    }
    if (t.classList.contains("calendar-subject-all-checkbox")) {
      const checked = t instanceof HTMLInputElement ? t.checked : false;
      const subjectIds = checked
        ? Array.from(document.querySelectorAll(".calendar-subject-checkbox")).map((el) => el.value)
        : [];
      applyCalendarFilterSelection({ subjectIds });
      syncCalendarFilterSubjectCourseOptions();
      renderCalendar();
      return;
    }
    if (t.classList.contains("calendar-course-checkbox")) {
      calendarSelectedCourseIds = new Set(getCalendarSelectedCourseIds());
      syncCalendarAllCheckbox("calendar-course-checkbox", "calendar-course-all-checkbox");
      updateCalendarCourseSummary();
      renderCalendar();
      return;
    }
    if (t.classList.contains("calendar-course-all-checkbox")) {
      const checked = t instanceof HTMLInputElement ? t.checked : false;
      const courseIds = checked
        ? Array.from(document.querySelectorAll(".calendar-course-checkbox")).map((el) => el.value)
        : [];
      applyCalendarFilterSelection({ courseIds });
      updateCalendarCourseSummary();
      renderCalendar();
      return;
    }
    if (t.classList.contains("grade-row-subject") || t.classList.contains("grade-row-student")) {
      const row = t.closest("tr");
      if (row) updateGradeRowCourses(row);
      return;
    }
    if (t.classList.contains("grade-row-course")) {
      const row = t.closest("tr");
      if (!row) return;
      const courseId = t instanceof HTMLSelectElement ? t.value : "";
      const subjectSelect = row.querySelector(".grade-row-subject");
      const selectedCourse = state.courses.find((course) => course.id === courseId);
      if (selectedCourse && subjectSelect instanceof HTMLSelectElement) {
        subjectSelect.value = selectedCourse.subjectId;
      }
      return;
    }
  });

  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const openDayTarget = t.closest("[data-open-calendar-day]");
    if (openDayTarget instanceof HTMLElement) {
      const date = openDayTarget.getAttribute("data-date");
      const studentId = openDayTarget.getAttribute("data-student-id");
      if (!date || !studentId) return;
      calendarBackToWeekContext = {
        date: document.getElementById("calendar-date")?.value || todayISO(),
        studentIds: getCalendarSelectedStudentIds(),
        subjectIds: getCalendarSelectedSubjectIds(),
        courseIds: getCalendarSelectedCourseIds()
      };
      const viewInput = document.getElementById("calendar-view");
      const dateInput = document.getElementById("calendar-date");
      if (viewInput) viewInput.value = "day";
      if (dateInput) dateInput.value = date;
      applyCalendarFilterSelection({ studentIds: [studentId] });
      syncCalendarFilterSubjectCourseOptions();
      renderCalendar();
      return;
    }
    const openWeekTarget = t.closest("[data-open-calendar-week]");
    if (openWeekTarget instanceof HTMLElement) {
      const date = openWeekTarget.getAttribute("data-date");
      const studentId = openWeekTarget.getAttribute("data-student-id");
      if (!date || !studentId) return;
      calendarBackToMonthContext = {
        date: document.getElementById("calendar-date")?.value || todayISO(),
        studentIds: getCalendarSelectedStudentIds(),
        subjectIds: getCalendarSelectedSubjectIds(),
        courseIds: getCalendarSelectedCourseIds()
      };
      calendarBackToWeekContext = null;
      const viewInput = document.getElementById("calendar-view");
      const dateInput = document.getElementById("calendar-date");
      if (viewInput) viewInput.value = "week";
      if (dateInput) dateInput.value = date;
      applyCalendarFilterSelection({ studentIds: [studentId] });
      syncCalendarFilterSubjectCourseOptions();
      renderCalendar();
      return;
    }

    const setCurrentSchoolYearId = t.getAttribute("data-set-current-school-year");
    if (setCurrentSchoolYearId) {
      if (!ensureAdminAction()) return;
      if (hostedModeEnabled) {
        (async () => {
          try {
            try {
              await setHostedCurrentSchoolYear(setCurrentSchoolYearId);
            } catch (error) {
              if (!/School year not found\./i.test(error.message || "")) throw error;
              await ensureHostedSchoolYearRecord(getSchoolYear(setCurrentSchoolYearId), {
                id: setCurrentSchoolYearId,
                isCurrent: true
              });
              await setHostedCurrentSchoolYear(setCurrentSchoolYearId);
            }
            await refreshHostedSchoolConfigState();
            renderAll();
          } catch (error) {
            alert(error.message || "Unable to update current school year.");
          }
        })();
        return;
      }
      setCurrentSchoolYear(setCurrentSchoolYearId);
      saveState();
      renderAll();
      return;
    }
    const editSchoolYearId = t.getAttribute("data-edit-school-year");
    if (editSchoolYearId) {
      if (!ensureAdminAction()) return;
      beginSchoolYearEdit(editSchoolYearId);
      return;
    }
    const removeSchoolYearId = t.getAttribute("data-remove-school-year");
    if (removeSchoolYearId) {
      if (!ensureAdminAction()) return;
      const targetYear = getSchoolYear(removeSchoolYearId);
      if (!targetYear) return;
      const quarterCount = state.settings.allQuarters.filter((quarter) => quarter.schoolYearId === removeSchoolYearId).length;
      const message = quarterCount
        ? `Delete ${targetYear.label}? This will also remove ${quarterCount} quarter definition${quarterCount === 1 ? "" : "s"} for that school year.`
        : `Delete ${targetYear.label}?`;
      if (!confirm(message)) return;
      if (hostedModeEnabled) {
        (async () => {
          try {
            await deleteHostedSchoolYear(removeSchoolYearId);
            await refreshHostedSchoolConfigState();
            renderAll();
          } catch (error) {
            alert(error.message || "Unable to delete school year.");
          }
        })();
        return;
      }
      removeSchoolYear(removeSchoolYearId);
      saveState();
      renderAll();
      return;
    }
    const editQuartersYearId = t.getAttribute("data-edit-quarters-year");
    if (editQuartersYearId) {
      if (!ensureAdminAction()) return;
      beginQuarterEdit(editQuartersYearId);
      return;
    }
    const editCourseId = t.getAttribute("data-edit-course");
    if (editCourseId) {
      if (!ensureAdminAction()) return;
      beginCourseEdit(editCourseId);
      return;
    }
    const managementTab = t.getAttribute("data-management-tab");
    if (managementTab) {
      currentManagementTab = managementTab;
      renderManagementSectionVisibility();
      return;
    }
    const scheduleTab = t.getAttribute("data-schedule-tab");
    if (scheduleTab) {
      currentScheduleTab = scheduleTab;
      renderScheduleSectionVisibility();
      return;
    }
    const editGradeTypeId = t.getAttribute("data-edit-grade-type");
    if (editGradeTypeId) {
      if (!ensureAdminAction()) return;
      beginGradeTypeEdit(editGradeTypeId);
      return;
    }
    const editHolidayId = t.getAttribute("data-edit-holiday");
    if (editHolidayId) {
      if (!ensureAdminAction()) return;
      beginHolidayEdit(editHolidayId);
      return;
    }
    const editDailyBreakId = t.getAttribute("data-edit-daily-break");
    if (editDailyBreakId) {
      if (!ensureAdminAction()) return;
      beginDailyBreakEdit(editDailyBreakId);
      return;
    }
    const editPlanId = t.getAttribute("data-edit-plan");
    if (editPlanId) {
      if (!ensureAdminAction()) return;
      beginPlanEdit(editPlanId);
      return;
    }

    const toggleStudentAvgId = t.getAttribute("data-toggle-student-avg");
    if (toggleStudentAvgId) {
      if (expandedStudentAverageRows.has(toggleStudentAvgId)) expandedStudentAverageRows.delete(toggleStudentAvgId);
      else expandedStudentAverageRows.add(toggleStudentAvgId);
      renderDashboard();
      return;
    }
    const toggleSubjectAvgKey = t.getAttribute("data-toggle-subject-avg");
    if (toggleSubjectAvgKey) {
      if (expandedSubjectAverageRows.has(toggleSubjectAvgKey)) expandedSubjectAverageRows.delete(toggleSubjectAvgKey);
      else expandedSubjectAverageRows.add(toggleSubjectAvgKey);
      renderDashboard();
      return;
    }
    const toggleStudentAttendanceId = t.getAttribute("data-toggle-student-attendance");
    if (toggleStudentAttendanceId) {
      if (expandedStudentAttendanceRows.has(toggleStudentAttendanceId)) expandedStudentAttendanceRows.delete(toggleStudentAttendanceId);
      else expandedStudentAttendanceRows.add(toggleStudentAttendanceId);
      renderDashboard();
      return;
    }
    const toggleStudentInstructionalHoursId = t.getAttribute("data-toggle-student-instructional-hours");
    if (toggleStudentInstructionalHoursId) {
      if (expandedStudentInstructionalHourRows.has(toggleStudentInstructionalHoursId)) expandedStudentInstructionalHourRows.delete(toggleStudentInstructionalHoursId);
      else expandedStudentInstructionalHourRows.add(toggleStudentInstructionalHoursId);
      renderDashboard();
      return;
    }

    const editInstructionActualKey = t.getAttribute("data-edit-instruction-actual");
    if (editInstructionActualKey) {
      if (!ensureAdminAction()) return;
      editingInstructionActualKey = editInstructionActualKey;
      renderCalendar();
      return;
    }
    const cancelInstructionActualKey = t.getAttribute("data-cancel-instruction-actual");
    if (cancelInstructionActualKey) {
      editingInstructionActualKey = "";
      renderCalendar();
      return;
    }
    const saveInstructionActualKey = t.getAttribute("data-save-instruction-actual");
    if (saveInstructionActualKey) {
      if (!ensureAdminAction()) return;
      const studentId = t.getAttribute("data-student-id") || "";
      const courseId = t.getAttribute("data-course-id") || "";
      const date = t.getAttribute("data-date") || "";
      const input = document.querySelector(`[data-instruction-actual-input="${saveInstructionActualKey}"]`);
      const instructorInput = document.querySelector(`[data-instruction-actual-instructor="${saveInstructionActualKey}"]`);
      const instructorId = String(instructorInput?.value || "").trim();
      const actualMinutes = Number(input?.value);
      if (!studentId || !courseId || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isInteger(actualMinutes) || actualMinutes <= 0) {
        alert("Enter a whole number of minutes greater than 0.");
        return;
      }
      (async () => {
        try {
          await saveInstructionActualMinutes({ studentId, courseId, instructorId, date, actualMinutes });
          editingInstructionActualKey = "";
          renderAll();
        } catch (error) {
          alert(error.message || "Unable to save actual instructional minutes.");
        }
      })();
      return;
    }
    const resetInstructionActualId = t.getAttribute("data-reset-instruction-actual");
    if (resetInstructionActualId) {
      if (!ensureAdminAction()) return;
      (async () => {
        try {
          await resetInstructionActualMinutes(resetInstructionActualId);
          editingInstructionActualKey = "";
          renderAll();
        } catch (error) {
          alert(error.message || "Unable to reset to planned minutes.");
        }
      })();
      return;
    }

    const editAttendanceId = t.getAttribute("data-edit-attendance");
    if (editAttendanceId) {
      if (!ensureAdminAction()) return;
      const target = state.attendance.find((a) => a.id === editAttendanceId);
      if (!target) return;
      beginAttendanceEdit(target);
      return;
    }
    const removeAttendanceId = t.getAttribute("data-remove-attendance");
    if (removeAttendanceId) {
      if (!ensureAdminAction()) return;
      const target = state.attendance.find((a) => a.id === removeAttendanceId);
      if (!target) return;
      const isInstructionalRecord = instructionalDates().includes(target.date);
      let confirmed = false;
      if (isInstructionalRecord) {
        confirmed = confirm(`This is an attendance record for a valid instructional day. Select OK to delete it, or Cancel to edit the existing record for ${getStudentName(target.studentId)} on ${target.date}.`);
        if (!confirmed) {
          beginAttendanceEdit(target);
          return;
        }
      } else {
        confirmed = confirm(`Remove the attendance record for ${getStudentName(target.studentId)} on ${target.date}?`);
      }
      if (!confirmed) return;
      if (hostedModeEnabled) {
        (async () => {
          try {
            await deleteHostedAttendance(removeAttendanceId);
            if (editingAttendanceId === removeAttendanceId) resetAttendanceEditMode();
            await refreshHostedAttendance();
            renderAll();
          } catch (error) {
            alert(error.message || "Unable to remove attendance.");
          }
        })();
        return;
      }
      deleteLegacyLocalAttendance(removeAttendanceId);
      if (editingAttendanceId === removeAttendanceId) resetAttendanceEditMode();
      saveState();
      renderAll();
      return;
    }

    const saveGrade = t.getAttribute("data-grade-save");
    if (saveGrade) {
      if (!ensureAdminAction()) return;
      const row = t.closest("tr");
      if (!row) return;
      const editGradeId = row.getAttribute("data-edit-grade-id");
      const date = row.querySelector(".grade-row-date")?.value || "";
      const studentId = row.querySelector(".grade-row-student")?.value || "";
      const subjectId = row.querySelector(".grade-row-subject")?.value || "";
      const courseId = row.querySelector(".grade-row-course")?.value || "";
      const gradeType = row.querySelector(".grade-row-type")?.value || "";
      const gradeValue = Number(row.querySelector(".grade-row-value")?.value);

      if (!date || !studentId || !subjectId || !courseId || !gradeType || Number.isNaN(gradeValue)) {
        alert("Complete all grade fields.");
        return;
      }
      if (gradeValue < 0 || gradeValue > 100) {
        alert("Grade must be between 0 and 100.");
        return;
      }

      if (editGradeId) {
        if (hostedModeEnabled) {
          (async () => {
            try {
              await updateHostedTest(editGradeId, {
                date,
                studentId,
                subjectId,
                courseId,
                gradeType,
                testName: gradeType,
                score: gradeValue,
                maxScore: 100
              });
              row.remove();
              updateGradeEntryVisibility();
              await refreshHostedTests();
              renderAll();
            } catch (error) {
              alert(error.message || "Unable to update grade.");
            }
          })();
          return;
        }
        updateLegacyLocalGrade(state.tests.find((x) => x.id === editGradeId), {
          date,
          studentId,
          subjectId,
          courseId,
          gradeType,
          testName: gradeType,
          score: gradeValue,
          maxScore: 100
        });
      } else {
        if (hostedModeEnabled) {
          (async () => {
            try {
              await createHostedTest({
                id: uid(),
                date,
                studentId,
                subjectId,
                courseId,
                gradeType,
                testName: gradeType,
                score: gradeValue,
                maxScore: 100
              });
              row.remove();
              updateGradeEntryVisibility();
              await refreshHostedTests();
              renderAll();
            } catch (error) {
              alert(error.message || "Unable to save grade.");
            }
          })();
          return;
        }
        createLegacyLocalGrade({
          date,
          studentId,
          subjectId,
          courseId,
          gradeType,
          testName: gradeType,
          score: gradeValue,
          maxScore: 100
        });
      }

      row.remove();
      updateGradeEntryVisibility();
      saveState();
      renderAll();
      return;
    }

    const toggleGradeCalc = t.getAttribute("data-grade-calc-toggle");
    if (toggleGradeCalc) {
      if (!ensureAdminAction()) return;
      const row = t.closest("tr");
      toggleGradeCalculatorRow(row);
      return;
    }

    const applyGradeCalc = t.getAttribute("data-grade-calc-apply");
    if (applyGradeCalc) {
      if (!ensureAdminAction()) return;
      const calcRow = t.closest("tr");
      applyGradeCalculator(calcRow);
      return;
    }

    const closeGradeCalc = t.getAttribute("data-grade-calc-close");
    if (closeGradeCalc) {
      if (!ensureAdminAction()) return;
      const calcRow = t.closest("tr");
      if (calcRow) calcRow.remove();
      return;
    }

    const cancelGrade = t.getAttribute("data-grade-cancel");
    if (cancelGrade) {
      if (!ensureAdminAction()) return;
      const row = t.closest("tr");
      if (row) {
        removeGradeCalculatorRow(row.getAttribute("data-grade-entry-row-id"));
        row.remove();
      }
      updateGradeEntryVisibility();
      return;
    }

    const editStudentId = t.getAttribute("data-edit-student"); if (editStudentId) { beginStudentDetail(editStudentId); renderAll(); return; }
    const editInstructorId = t.getAttribute("data-edit-instructor");
    if (editInstructorId) {
      if (!ensureAdminAction()) return;
      beginInstructorEdit(editInstructorId);
      renderAll();
      return;
    }
    const editGradeId = t.getAttribute("data-edit-grade");
    if (editGradeId) {
      if (!ensureAdminAction()) return;
      const existing = state.tests.find((x) => x.id === editGradeId);
      if (!existing) return;
      const entryBody = document.getElementById("grade-entry-body");
      const existingRow = entryBody.querySelector(`tr[data-edit-grade-id="${editGradeId}"]`);
      if (existingRow) {
        existingRow.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        entryBody.prepend(buildGradeEntryRow(existing));
      }
      updateGradeEntryVisibility();
      return;
    }
    const removeGradeId = t.getAttribute("data-remove-grade");
    if (removeGradeId) {
      if (!ensureAdminAction()) return;
      if (hostedModeEnabled) {
        (async () => {
          try {
            await deleteHostedTest(removeGradeId);
            await refreshHostedTests();
            const editingRow = document.querySelector(`tr[data-edit-grade-id="${removeGradeId}"]`);
            if (editingRow) {
              editingRow.remove();
              updateGradeEntryVisibility();
            }
            renderAll();
          } catch (error) {
            alert(error.message || "Unable to remove grade.");
          }
        })();
        return;
      }
      deleteLegacyLocalGrade(removeGradeId);
      const editingRow = document.querySelector(`tr[data-edit-grade-id="${removeGradeId}"]`);
      if (editingRow) {
        editingRow.remove();
        updateGradeEntryVisibility();
      }
      saveState();
      renderAll();
      return;
    }
    const editUserId = t.getAttribute("data-edit-user");
    if (editUserId) {
      if (!ensureAdminAction()) return;
      beginUserEdit(editUserId);
      resetUserFormMessage();
      return;
    }
    const removeUserId = t.getAttribute("data-remove-user");
    if (removeUserId) {
      if (!ensureAdminAction()) return;
      const targetUser = state.users.find((entry) => entry.id === removeUserId);
      if (targetUser && targetUser.role === "admin" && state.users.filter((entry) => entry.role === "admin").length <= 1) {
        setUserFormMessage("error", "At least one administrator account is required.");
        return;
      }
      if (hostedModeEnabled) {
        (async () => {
          try {
            await deleteHostedUser(removeUserId);
            if (editingUserId === removeUserId) resetUserForm();
            if (currentUserId === removeUserId) {
              currentUserId = "";
              saveSession();
            }
            await refreshHostedUsers();
            renderAll();
          } catch (error) {
            setUserFormMessage("error", error.message || "Unable to remove user account.");
          }
        })();
        return;
      }
      removeLegacyLocalUser(removeUserId);
      if (editingUserId === removeUserId) resetUserForm();
      if (currentUserId === removeUserId) logout();
      saveState();
      renderAll();
      return;
    }
    const studentId = t.getAttribute("data-remove-student");
    if (studentId) {
      if (!ensureAdminAction()) return;
      if (hostedModeEnabled) {
        (async () => {
          try {
            await deleteHostedStudent(studentId);
            if (selectedStudentId === studentId) selectedStudentId = "";
            await refreshHostedStudentCascadeState();
            renderAll();
          } catch (error) {
            alert(error.message || "Unable to remove student.");
          }
        })();
        return;
      }
      removeLegacyLocalStudent(studentId);
      saveState();
      renderAll();
      return;
    }
    const instructorId = t.getAttribute("data-remove-instructor");
    if (instructorId) {
      if (!ensureAdminAction()) return;
      if (hostedModeEnabled) {
        (async () => {
          try {
            await deleteHostedInstructor(instructorId);
            if (editingInstructorId === instructorId) {
              editingInstructorId = "";
              instructorViewMode = "list";
            }
            await refreshHostedInstructors();
            renderAll();
          } catch (error) {
            alert(error.message || "Unable to remove instructor.");
          }
        })();
        return;
      }
      removeLegacyLocalInstructor(instructorId);
      if (editingInstructorId === instructorId) {
        editingInstructorId = "";
        instructorViewMode = "list";
      }
      saveState();
      renderAll();
      return;
    }
    const subjectId = t.getAttribute("data-remove-subject");
    if (subjectId) {
      if (!ensureAdminAction()) return;
      if (hostedModeEnabled) {
        (async () => {
          try {
            await deleteHostedSubject(subjectId);
            await refreshHostedCurriculumCascadeState();
            renderAll();
          } catch (error) {
            alert(error.message || "Unable to remove subject.");
          }
        })();
        return;
      }
      removeLegacyLocalSubject(subjectId);
      saveState();
      renderAll();
      return;
    }
    const courseId = t.getAttribute("data-remove-course");
    if (courseId) {
      if (!ensureAdminAction()) return;
      if (hostedModeEnabled) {
        (async () => {
          try {
            await deleteHostedCourse(courseId);
            await refreshHostedCurriculumCascadeState();
            renderAll();
          } catch (error) {
            alert(error.message || "Unable to remove course.");
          }
        })();
        return;
      }
      removeLegacyLocalCourse(courseId);
      saveState();
      renderAll();
      return;
    }
    const gradeTypeId = t.getAttribute("data-remove-grade-type");
    if (gradeTypeId) {
      if (!ensureAdminAction()) return;
      removeLegacyLocalDraftGradeType(gradeTypeId);
      if (editingGradeTypeId === gradeTypeId) editingGradeTypeId = "";
      gradeTypeDraftDirty = true;
      renderGradeTypes();
      return;
    }
    const enrollmentId = t.getAttribute("data-remove-student-enrollment");
    if (enrollmentId) {
      if (!ensureAdminAction()) return;
      if (studentViewMode === "detail" && selectedStudentId && studentEnrollmentDraftStudentId === selectedStudentId) {
        studentEnrollmentDraft = studentEnrollmentDraft.filter((entry) => entry.id !== enrollmentId);
        studentEnrollmentDraftDirty = true;
        renderStudentDetail();
        return;
      }
      if (hostedModeEnabled) {
        (async () => {
          try {
            await deleteHostedEnrollment(enrollmentId);
            await refreshHostedEnrollments();
            renderAll();
          } catch (error) {
            alert(error.message || "Unable to remove enrollment.");
          }
        })();
        return;
      }
      removeLegacyLocalEnrollment(enrollmentId);
      saveState();
      renderAll();
      return;
    }
    const dailyBreakId = t.getAttribute("data-remove-daily-break");
    if (dailyBreakId) {
      if (!ensureAdminAction()) return;
      if (hostedModeEnabled) {
        (async () => {
          try {
            await deleteHostedDailyBreak(dailyBreakId);
            if (editingDailyBreakId === dailyBreakId) editingDailyBreakId = "";
            resetDailyBreakForm();
            await refreshHostedDailyBreaks();
            renderAll();
          } catch (error) {
            alert(error.message || "Unable to remove daily break.");
          }
        })();
        return;
      }
      deleteLegacyLocalDailyBreak(dailyBreakId);
      if (editingDailyBreakId === dailyBreakId) editingDailyBreakId = "";
      resetDailyBreakForm();
      saveState();
      renderAll();
      return;
    }
    const holidayId = t.getAttribute("data-remove-holiday");
    if (holidayId) {
      if (!ensureAdminAction()) return;
      if (hostedModeEnabled) {
        (async () => {
          try {
            await deleteHostedHoliday(holidayId);
            if (editingHolidayId === holidayId) editingHolidayId = "";
            await refreshHostedHolidays();
            renderAll();
          } catch (error) {
            alert(error.message || "Unable to remove holiday.");
          }
        })();
        return;
      }
      deleteLegacyLocalHoliday(holidayId);
      if (editingHolidayId === holidayId) editingHolidayId = "";
      saveState();
      renderAll();
      return;
    }
    const planId = t.getAttribute("data-remove-plan");
    if (planId) {
      if (!ensureAdminAction()) return;
      if (hostedModeEnabled) {
        (async () => {
          try {
            await deleteHostedPlan(planId);
            if (editingPlanId === planId) editingPlanId = "";
            await refreshHostedPlans();
            renderAll();
          } catch (error) {
            alert(error.message || "Unable to remove plan.");
          }
        })();
        return;
      }
      removeLegacyLocalPlan(planId);
      if (editingPlanId === planId) editingPlanId = "";
      saveState();
      renderAll();
    }
  });
}

function renderAll() {
  renderSessionChrome();
  renderSelects();
  fillSettingsForms();
  updatePlanFormMode();
  renderStudents();
  renderStudentViewMode();
  renderStudentDetail();
  renderInstructors();
  renderInstructorViewMode();
  renderSubjects();
  renderManagementSectionVisibility();
  renderCourses();
  renderGradeTypes();
  renderGradingCriteria();
  renderDailyBreaks();
  renderHolidays();
  renderPlanningSettings();
  renderPlans();
  renderScheduleSectionVisibility();
  renderAttendance();
  renderTests();
  renderUsers();
  renderUsersViewMode();
  ensureStudentSelection();
  updateGradeEntryVisibility();
  renderDashboard();
  renderCalendar();

  const studentMode = isStudentUser();
  const planForm = document.getElementById("plan-form");
  const planFilterForm = document.getElementById("plan-filter-form");
  const attendanceForm = document.getElementById("attendance-form");
  const addGradeBtn = document.getElementById("add-grade-row-btn");
  const gradeEntryWrap = document.getElementById("grade-entry-wrap");
  const calendarForm = document.getElementById("calendar-form");
  if (planForm) planForm.classList.toggle("hidden", studentMode);
  if (planFilterForm) planFilterForm.classList.toggle("hidden", studentMode);
  if (attendanceForm) attendanceForm.classList.toggle("hidden", studentMode);
  if (addGradeBtn) addGradeBtn.classList.toggle("hidden", studentMode);
  if (gradeEntryWrap && studentMode) gradeEntryWrap.classList.add("hidden");
  if (calendarForm) calendarForm.classList.remove("hidden");
}

bindEvents();
renderAll();
if (startupBackfillChanged) saveState();
bootstrapApplicationState();
