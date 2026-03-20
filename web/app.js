const STORAGE_KEY = "hsm_state_v2";
const API_BASE_URL = window.HSM_API_BASE_URL || "http://localhost:3000";
const API_STATE_ENDPOINT = `${API_BASE_URL}/api/state`;
const SESSION_KEY = "hsm_session_v1";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DEFAULT_GRADE_TYPES = ["Assignment", "Quiz", "Test", "Quarterly Final", "Final"];
const DEFAULT_ADMIN_USERNAME = "admin";
const DEFAULT_ADMIN_PASSWORD = "ChangeMe123!";
const STUDENT_ALLOWED_TABS = new Set(["dashboard", "calendar", "attendance", "grades"]);

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

function createBootstrapAdmin() {
  return {
    id: "default-admin-user",
    username: DEFAULT_ADMIN_USERNAME,
    role: "admin",
    studentId: "",
    mustChangePassword: true,
    createdAt: todayISO(),
    updatedAt: todayISO(),
    passwordSalt: "",
    passwordHash: createLegacyPasswordHash(DEFAULT_ADMIN_PASSWORD)
  };
}

function normalizeUsersShape(inputState) {
  const s = inputState;
  const studentIds = new Set((s.students || []).map((student) => student.id));
  let repairedDefaultAdmin = false;
  if (!Array.isArray(s.users) || !s.users.length) {
    s.users = [createBootstrapAdmin()];
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
        if (normalized.id === "default-admin-user"
          && normalized.username.toLowerCase() === DEFAULT_ADMIN_USERNAME
          && normalized.passwordHash === createLegacyPasswordHash(DEFAULT_ADMIN_PASSWORD)
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
    if (!s.users.length) s.users = [createBootstrapAdmin()];
  }
  if (!s.users.some((user) => user.role === "admin")) {
    s.users.unshift(createBootstrapAdmin());
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
  const schoolYear = { id: schoolYearId, label: `${y}-${y+1}`, startDate: `${y}-01-01`, endDate: `${y}-12-31` };
  const quarters = [
    { id: uid(), schoolYearId, name: "Q1", startDate: `${y}-01-01`, endDate: `${y}-03-31` },
    { id: uid(), schoolYearId, name: "Q2", startDate: `${y}-04-01`, endDate: `${y}-06-30` },
    { id: uid(), schoolYearId, name: "Q3", startDate: `${y}-07-01`, endDate: `${y}-09-30` },
    { id: uid(), schoolYearId, name: "Q4", startDate: `${y}-10-01`, endDate: `${y}-12-31` }
  ];
  return {
    students: [], subjects: [], courses: [], enrollments: [], plans: [], attendance: [], tests: [], users: [createBootstrapAdmin()],
    settings: {
      schoolYear: { ...schoolYear },
      schoolYears: [schoolYear],
      currentSchoolYearId: schoolYearId,
      quarters: quarters.map((q) => ({ ...q })),
      allQuarters: quarters,
      holidays: [],
      gradeTypes: DEFAULT_GRADE_TYPES.map((name) => ({ id: uid(), name, weight: null }))
    }
  };
}

function validState(s) {
  return s && Array.isArray(s.students) && Array.isArray(s.subjects) && Array.isArray(s.courses)
    && Array.isArray(s.enrollments) && Array.isArray(s.plans) && Array.isArray(s.attendance)
    && Array.isArray(s.tests) && Array.isArray(s.users) && s.settings && s.settings.schoolYear
    && Array.isArray(s.settings.quarters) && Array.isArray(s.settings.holidays);
}

function normalizeCoursesShape(inputState) {
  const s = inputState;
  if (!Array.isArray(s.courses)) {
    s.courses = [];
    return;
  }
  s.courses = s.courses.map((course) => ({
    ...course,
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

function mergeCoursesWithLocalState(remoteState, localState) {
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

function mergeEnrollmentsWithLocalState(remoteState, localState) {
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

function normalizeSettingsShape(inputState) {
  const s = inputState;
  if (!s.settings) s.settings = {};

  const legacySchoolYear = s.settings.schoolYear && s.settings.schoolYear.startDate && s.settings.schoolYear.endDate
    ? s.settings.schoolYear
    : null;
  if (!Array.isArray(s.settings.schoolYears) || !s.settings.schoolYears.length) {
    if (legacySchoolYear) {
      s.settings.schoolYears = [{ id: uid(), label: legacySchoolYear.label || "School Year", startDate: legacySchoolYear.startDate, endDate: legacySchoolYear.endDate }];
    } else {
      const fallback = defaultState().settings.schoolYears[0];
      s.settings.schoolYears = [{ ...fallback }];
    }
  } else {
    s.settings.schoolYears = s.settings.schoolYears
      .filter((year) => year && year.startDate && year.endDate)
      .map((year) => ({ ...year, id: year.id || uid(), label: year.label || `${year.startDate} to ${year.endDate}` }));
    if (!s.settings.schoolYears.length) s.settings.schoolYears = defaultState().settings.schoolYears;
  }

  if (!s.settings.currentSchoolYearId || !s.settings.schoolYears.some((year) => year.id === s.settings.currentSchoolYearId)) {
    s.settings.currentSchoolYearId = s.settings.schoolYears[0].id;
  }

  const currentSchoolYear = s.settings.schoolYears.find((year) => year.id === s.settings.currentSchoolYearId) || s.settings.schoolYears[0];
  s.settings.schoolYear = { label: currentSchoolYear.label, startDate: currentSchoolYear.startDate, endDate: currentSchoolYear.endDate };

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

  normalizeUsersShape(s);
  normalizeCoursesShape(s);
  normalizeEnrollmentsShape(s);
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

async function fetchStateFromApi() {
  const response = await fetch(API_STATE_ENDPOINT, { method: "GET", headers: { "Accept": "application/json" } });
  if (!response.ok) throw new Error(`State fetch failed (${response.status})`);
  return response.json();
}

async function pushStateToApi(snapshot) {
  const response = await fetch(API_STATE_ENDPOINT, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(snapshot)
  });
  if (!response.ok) {
    let message = `State save failed (${response.status})`;
    try {
      const payload = await response.json();
      if (payload && payload.error) message = payload.error;
    } catch {
      // Keep generic message if payload is not JSON.
    }
    throw new Error(message);
  }
}

let currentUserId = "";
let currentTab = "dashboard";
let state = loadState();
loadSession();
if (!state.users.some((user) => user.id === currentUserId)) currentUserId = "";
setCurrentSchoolYear(state.settings.currentSchoolYearId);
const startupBackfillChanged = backfillAttendanceToToday();
let apiSaveInFlight = false;
let apiSavePending = false;
let apiSyncReady = false;
let selectedStudentId = "";
let editingAttendanceId = "";
let editingUserId = "";
const expandedStudentAverageRows = new Set();
const expandedSubjectAverageRows = new Set();
const expandedStudentAttendanceRows = new Set();
const trendSelectedStudentIds = new Set();
const gpaTrendSelectedStudentIds = new Set();
const volumeSelectedStudentIds = new Set();
const workSelectedStudentIds = new Set();
let workDistributionGradeType = "Assignment";
let editingCourseId = "";
let editingHolidayId = "";
let editingPlanId = "";
let editingSchoolYearId = "";
let editingQuarterSchoolYearId = "";
let editingGradeTypeId = "";
let gradeTypeDraftDirty = false;
let showManagementSubjects = false;
let showManagementCourses = false;
let showManagementGradeTypes = false;
let showScheduleSchoolYears = false;
let showScheduleQuarters = false;
let showScheduleHolidays = false;
let showSchedulePlans = false;
let calendarBackToWeekContext = null;
let calendarBackToMonthContext = null;
let calendarSelectedStudentIds = new Set();
let calendarSelectedSubjectIds = new Set();
let calendarSelectedCourseIds = new Set();
let loginMessageKind = "";
let userFormMessageKind = "";
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

function resetUserFormMessage() {
  userFormMessageKind = "";
  setStatusMessage("user-form-message", "", "");
}

function setUserFormMessage(kind, message) {
  userFormMessageKind = kind;
  setStatusMessage("user-form-message", kind, message);
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
  const sessionSummary = document.getElementById("session-summary");
  const defaultAdminNote = document.getElementById("login-default-admin-note");
  const userBanner = document.getElementById("users-default-admin-banner");
  const user = currentUser();
  const signedIn = !!user;

  if (loginShell) loginShell.classList.toggle("hidden", signedIn);
  if (appShell) appShell.classList.toggle("hidden", !signedIn);
  if (defaultAdminNote) defaultAdminNote.classList.toggle("hidden", signedIn || !state.users.some((entry) => entry.id === "default-admin-user"));
  if (userBanner) userBanner.classList.toggle("hidden", !signedIn || !isAdminUser(user) || !state.users.some((entry) => entry.id === "default-admin-user"));

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

function logout() {
  currentUserId = "";
  saveSession();
  resetLoginMessage();
  renderSessionChrome();
}
function scheduleApiSave() {
  if (!apiSyncReady) return;
  if (apiSaveInFlight) {
    apiSavePending = true;
    return;
  }

  apiSaveInFlight = true;
  const snapshot = JSON.parse(JSON.stringify(state));
  pushStateToApi(snapshot)
    .catch((error) => {
      console.warn("API save skipped:", error.message);
    })
    .finally(() => {
      apiSaveInFlight = false;
      if (apiSavePending) {
        apiSavePending = false;
        scheduleApiSave();
      }
    });
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  scheduleApiSave();
}

async function bootstrapStateFromApi() {
  try {
    const localState = state;
    const remoteState = await fetchStateFromApi();
    if (!validState(remoteState)) return;
    const before = JSON.stringify(remoteState.users || []);
    normalizeSettingsShape(remoteState);
    const coursesChanged = mergeCoursesWithLocalState(remoteState, localState);
    const enrollmentsChanged = mergeEnrollmentsWithLocalState(remoteState, localState);
    state = remoteState;
    if (!state.users.some((user) => user.id === currentUserId)) {
      currentUserId = "";
      saveSession();
    }
    setCurrentSchoolYear(state.settings.currentSchoolYearId);
    const usersChanged = before !== JSON.stringify(state.users || []);
    if (backfillAttendanceToToday() || usersChanged || coursesChanged || enrollmentsChanged) saveState();
    gradeTypesDraft = cloneGradeTypes(state.settings.gradeTypes);
    renderAll();
  } catch (error) {
    console.warn("API bootstrap skipped:", error.message);
  } finally {
    apiSyncReady = true;
  }
}

function getStudentName(id) { const s = state.students.find((x) => x.id === id); return s ? `${s.firstName} ${s.lastName}` : "Unknown Student"; }
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
  state.settings.schoolYear = { label: schoolYear.label, startDate: schoolYear.startDate, endDate: schoolYear.endDate };
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
  return clamp(numeric / 25, 0, 4);
}
function parseScheduleOrderValue(value) {
  if (value === "" || value == null) return null;
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}
function sortedStudentEnrollments(studentId) {
  const studentEnrollments = state.enrollments
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
  const enrollment = state.enrollments.find((entry) => entry.id === enrollmentId);
  if (!enrollment) return;
  const nextOrder = parseScheduleOrderValue(rawValue);
  const conflict = nextOrder != null && state.enrollments.some((entry) =>
    entry.id !== enrollmentId
    && entry.studentId === enrollment.studentId
    && parseScheduleOrderValue(entry.scheduleOrder) === nextOrder);
  if (conflict) {
    alert("That schedule order is already assigned to another course for this student.");
    renderStudentDetail();
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
  const viewerStudents = visibleStudents();
  options("course-subject", state.subjects, (s) => s.name, state.subjects.length ? null : "Add a subject first");
  options("test-subject", state.subjects, (s) => s.name, state.subjects.length ? null : "Add a subject first");
  options("student-enroll-course", state.courses, (c) => `${c.name} (${getSubjectName(c.subjectId)})`, state.courses.length ? null : "Add a course first");
  options("test-course", state.courses, (c) => `${c.name} (${getSubjectName(c.subjectId)})`, state.courses.length ? null : "Add a course first");
  options("plan-student", viewerStudents, (s) => `${s.firstName} ${s.lastName}`, viewerStudents.length ? null : "Add a student first");
  options("test-student", viewerStudents, (s) => `${s.firstName} ${s.lastName}`, viewerStudents.length ? null : "Add a student first");
  options("user-student-id", state.students, (s) => `${s.firstName} ${s.lastName}`, "Select student");
  renderAttendanceStudentChecklist();
  renderTrendStudentChecklist(Array.from(trendSelectedStudentIds));
  renderGpaTrendStudentChecklist(Array.from(gpaTrendSelectedStudentIds));
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
    if (seen.has(key)) return;
    seen.add(key);
    out.push(type);
  });
  state.tests.forEach((test) => {
    const type = gradeTypeName(test);
    const key = type.toLowerCase();
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
  if (!types.includes(workDistributionGradeType)) workDistributionGradeType = types[0] || "Assignment";
  host.innerHTML = `
    <p class="work-dist-filter-title">Grade Type</p>
    <div class="work-dist-options">
      ${types.map((type, idx) => {
        const id = `work-dist-grade-type-${idx}`;
        const checked = type === workDistributionGradeType ? " checked" : "";
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
  const submitBtn = document.getElementById("user-submit-btn");
  const cancelBtn = document.getElementById("user-cancel-edit-btn");
  const passwordInput = document.getElementById("user-password");
  const confirmInput = document.getElementById("user-password-confirm");
  if (submitBtn) submitBtn.textContent = "Create User";
  if (cancelBtn) cancelBtn.classList.add("hidden");
  if (passwordInput) passwordInput.required = true;
  if (confirmInput) confirmInput.required = true;
}

function beginUserEdit(userId) {
  const user = state.users.find((entry) => entry.id === userId);
  if (!user) return;
  editingUserId = user.id;
  document.getElementById("user-username").value = user.username;
  document.getElementById("user-role").value = user.role;
  document.getElementById("user-student-id").value = user.studentId || "";
  document.getElementById("user-password").value = "";
  document.getElementById("user-password-confirm").value = "";
  const passwordInput = document.getElementById("user-password");
  const confirmInput = document.getElementById("user-password-confirm");
  const submitBtn = document.getElementById("user-submit-btn");
  const cancelBtn = document.getElementById("user-cancel-edit-btn");
  if (passwordInput) passwordInput.required = false;
  if (confirmInput) confirmInput.required = false;
  if (submitBtn) submitBtn.textContent = "Update User";
  if (cancelBtn) cancelBtn.classList.remove("hidden");
  ensureStudentSelection();
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
      return `<tr><td>${escapeHtml(user.username)}</td><td>${roleLabel}</td><td>${linkedStudent}</td><td>${passwordStatus}</td><td><button data-edit-user='${user.id}' type='button'>Edit</button> ${deleteBtn}</td></tr>`;
    });
  rowOrEmpty(tableBody, rows, "No users configured.", 5);
}

function renderStudents() {
  if (!isAdminUser()) return;
  const rows = state.students.map((s) => {
    const ageNow = calculateAge(s.birthdate);
    const overallAvg = studentOverallAverage(s.id);
    const absences = studentAbsenceCount(s.id);
    return `<tr><td>${s.firstName} ${s.lastName}</td><td>${s.grade}</td><td>${ageNow}</td><td>${overallAvg.toFixed(1)}%</td><td>${absences}</td><td class="student-table-actions"><div class="table-action-row"><button data-open-student='${s.id}' type='button'>Open</button><button data-remove-student='${s.id}' type='button'>Remove</button></div></td></tr>`;
  });
  rowOrEmpty(document.getElementById("student-table"), rows, "No students added yet.", 6);
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
    { wrapId: "management-subjects-wrap", btnId: "management-subjects-toggle-btn", shown: showManagementSubjects, expandLabel: "Expand subjects", collapseLabel: "Collapse subjects" },
    { wrapId: "management-courses-wrap", btnId: "management-courses-toggle-btn", shown: showManagementCourses, expandLabel: "Expand courses", collapseLabel: "Collapse courses" },
    { wrapId: "management-grade-types-wrap", btnId: "management-grade-types-toggle-btn", shown: showManagementGradeTypes, expandLabel: "Expand grade types", collapseLabel: "Collapse grade types" }
  ];
  mappings.forEach((entry) => {
    const wrap = document.getElementById(entry.wrapId);
    const btn = document.getElementById(entry.btnId);
    if (!wrap || !btn) return;
    wrap.classList.toggle("hidden", !entry.shown);
    btn.textContent = entry.shown ? "-" : "+";
    btn.setAttribute("aria-expanded", entry.shown ? "true" : "false");
    btn.setAttribute("aria-label", entry.shown ? entry.collapseLabel : entry.expandLabel);
  });
}

function renderScheduleSectionVisibility() {
  const mappings = [
    { wrapId: "schedule-school-years-wrap", btnId: "schedule-school-years-toggle-btn", shown: showScheduleSchoolYears, expandLabel: "Expand school years", collapseLabel: "Collapse school years" },
    { wrapId: "schedule-quarters-wrap", btnId: "schedule-quarters-toggle-btn", shown: showScheduleQuarters, expandLabel: "Expand quarters", collapseLabel: "Collapse quarters" },
    { wrapId: "schedule-holidays-wrap", btnId: "schedule-holidays-toggle-btn", shown: showScheduleHolidays, expandLabel: "Expand holidays and breaks", collapseLabel: "Collapse holidays and breaks" },
    { wrapId: "schedule-plans-wrap", btnId: "schedule-plans-toggle-btn", shown: showSchedulePlans, expandLabel: "Expand instruction plans", collapseLabel: "Collapse instruction plans" }
  ];
  mappings.forEach((entry) => {
    const wrap = document.getElementById(entry.wrapId);
    const btn = document.getElementById(entry.btnId);
    if (!wrap || !btn) return;
    wrap.classList.toggle("hidden", !entry.shown);
    btn.textContent = entry.shown ? "-" : "+";
    btn.setAttribute("aria-expanded", entry.shown ? "true" : "false");
    btn.setAttribute("aria-label", entry.shown ? entry.collapseLabel : entry.expandLabel);
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
    .map((c) => `<tr><td>${c.name}</td><td>${getSubjectName(c.subjectId)}</td><td>${Number(c.hoursPerDay).toFixed(2)}</td><td>${c.exclusiveResource ? "Yes" : "No"}</td><td><button data-edit-course='${c.id}' type='button'>Edit</button> <button data-remove-course='${c.id}' type='button'>Remove</button></td></tr>`);
  rowOrEmpty(tableBody, rows, "No courses added yet.", 5);
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
  const empty = document.getElementById("student-detail-empty");
  const panel = document.getElementById("student-detail-panel");
  if (!empty || !panel) return;

  const student = state.students.find((s) => s.id === selectedStudentId);
  if (!student) {
    selectedStudentId = "";
    empty.classList.remove("hidden");
    panel.classList.add("hidden");
    return;
  }

  empty.classList.add("hidden");
  panel.classList.remove("hidden");
  document.getElementById("student-detail-title").textContent = `${student.firstName} ${student.lastName} | Grade ${student.grade} | Age ${calculateAge(student.birthdate)}`;

  const quarterSelect = document.getElementById("student-detail-quarter-filter");
  const selectedQuarter = quarterSelect ? quarterSelect.value || "all" : "all";
  const quarterRange = state.settings.quarters.find((q) => q.name === selectedQuarter);
  const rangeStart = quarterRange ? quarterRange.startDate : state.settings.schoolYear.startDate;
  const rangeEnd = quarterRange ? quarterRange.endDate : state.settings.schoolYear.endDate;
  const gradeSummary = studentGradeSummary(student.id, { quarterName: selectedQuarter });

  const studentEnrollments = sortedStudentEnrollments(student.id);
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
}

function renderHolidays() {
  const tableBody = document.getElementById("holiday-table");
  if (!tableBody) return;
  const rows = [...state.settings.holidays].sort((a,b)=>a.startDate.localeCompare(b.startDate));
  const htmlRows = rows
    .map((h) => `<tr><td>${h.name}</td><td>${h.type}</td><td>${h.startDate}</td><td>${h.endDate}</td><td><button data-edit-holiday='${h.id}' type='button'>Edit</button> <button data-remove-holiday='${h.id}' type='button'>Remove</button></td></tr>`);
  rowOrEmpty(tableBody, htmlRows, "No holidays/breaks defined.", 5);
  const submitBtn = document.getElementById("holiday-submit-btn");
  const cancelBtn = document.getElementById("holiday-cancel-edit-btn");
  if (submitBtn) submitBtn.textContent = editingHolidayId ? "Update" : "Add";
  if (cancelBtn) cancelBtn.classList.toggle("hidden", !editingHolidayId);
}

function renderPlanningSettings() {
  const schoolYear = currentSchoolYear();
  const schoolYearCurrent = document.getElementById("school-year-current");
  if (schoolYearCurrent) {
    schoolYearCurrent.textContent = `Current School Year: ${schoolYear.label} (${schoolYear.startDate} to ${schoolYear.endDate})`;
  }

  const schoolYearRows = state.settings.schoolYears
    .slice()
    .sort((a, b) => toDate(a.startDate) - toDate(b.startDate))
    .map((year) => `<tr><td>${year.label}${year.id === state.settings.currentSchoolYearId ? " (Current)" : ""}</td><td>${year.startDate}</td><td>${year.endDate}</td><td><button type="button" data-set-current-school-year="${year.id}">Set Current</button> <button type="button" data-edit-school-year="${year.id}">Edit</button></td></tr>`);
  rowOrEmpty(document.getElementById("school-year-summary-table"), schoolYearRows, "No school years saved yet.", 4);

  const quarterRows = state.settings.allQuarters
    .slice()
    .sort((a, b) => toDate(a.startDate) - toDate(b.startDate))
    .map((quarter) => {
      const year = getSchoolYear(quarter.schoolYearId);
      return `<tr><td>${year ? year.label : "Unknown Year"}</td><td>${quarter.name}</td><td>${quarter.startDate}</td><td>${quarter.endDate}</td><td><button type="button" data-edit-quarters-year="${quarter.schoolYearId}">Edit</button></td></tr>`;
    });
  rowOrEmpty(document.getElementById("quarter-summary-table"), quarterRows, "No quarters saved yet.", 5);

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
    return `<tr><td>${p.planType.toUpperCase()}${periodLabel}</td><td>${getStudentName(p.studentId)}</td><td>${getCourseName(p.courseId)}</td><td>${range.startDate} to ${range.endDate}</td><td>${weekdays}</td><td>${actions}</td></tr>`;
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
      return `<tr><td>${a.date}</td><td>${getStudentName(a.studentId)}</td><td>${a.present ? "Present" : "Absent"}</td><td>${actions}</td></tr>`;
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
  const courseFilter = document.getElementById("grades-filter-course")?.value || "all";
  const gradeTypeFilter = document.getElementById("grades-filter-grade-type")?.value || "all";

  const quarterRange = state.settings.quarters.find((q) => q.name === quarterFilter);
  const schoolYearStart = state.settings.schoolYear.startDate;
  const schoolYearEnd = state.settings.schoolYear.endDate;

  const filtered = state.tests.filter((t) => {
    if (studentFilter !== "all" && t.studentId !== studentFilter) return false;
    if (subjectFilter !== "all" && t.subjectId !== subjectFilter) return false;
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
      const actions = isAdminUser() ? `<button type='button' data-edit-grade='${t.id}'>Edit</button>` : "View only";
      return `<tr><td>${t.date}</td><td>${getStudentName(t.studentId)}</td><td>${getSubjectName(t.subjectId)}</td><td>${getCourseName(t.courseId)}</td><td>${gradeType}</td><td>${pct(t.score,t.maxScore).toFixed(1)}%</td><td>${actions}</td></tr>`;
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
  const subjectSelect = document.getElementById("grades-filter-subject");
  const courseSelect = document.getElementById("grades-filter-course");
  if (!subjectSelect || !courseSelect) return;

  const previousSubject = subjectSelect.value || "all";
  const previousCourse = courseSelect.value || "all";
  let subjectPool = state.subjects;
  let coursePool = state.courses;

  if (studentFilter !== "all") {
    const enrolledCourses = getEnrolledCoursesForStudent(studentFilter);
    const subjectIds = new Set(enrolledCourses.map((c) => c.subjectId));
    subjectPool = state.subjects.filter((s) => subjectIds.has(s.id));
    coursePool = enrolledCourses;
  }

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

  return state.courses.filter((c) => {
    if (!enrolledCourseIds.has(c.id)) return false;
    if (subjectId && c.subjectId !== subjectId) return false;
    return true;
  });
}

function buildGradeEntryRow(existingGrade) {
  const tr = document.createElement("tr");

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
    <td><button type="button" data-grade-save="1">${existingGrade ? "Update" : "Save"}</button> <button type="button" data-grade-cancel="1">Cancel</button></td>
  `;

  return tr;
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
}

function updateGradeEntryVisibility() {
  const wrap = document.getElementById("grade-entry-wrap");
  const body = document.getElementById("grade-entry-body");
  if (!wrap || !body) return;
  wrap.classList.toggle("hidden", !body.querySelector("tr"));
}

function gradeAnalytics() {
  const tests = state.tests.map((t) => ({ ...t, grade: pct(t.score, t.maxScore) }));
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
  const yMax = 4;
  const yTicks = [0, 1, 2, 3, 4];
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
      <text x="16" y="${(margin.top + plotH / 2).toFixed(2)}" text-anchor="middle" transform="rotate(-90 16 ${(margin.top + plotH / 2).toFixed(2)})" class="trend-axis-title">GPA (4.0 scale)</text>
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
  const gradeTypeFilter = document.getElementById("volume-filter-grade-type")?.value || "all";
  const selectedStudentIds = getVolumeSelectedStudentIds();
  const quarterRange = state.settings.quarters.find((q) => q.name === quarterFilter);

  const knownTypes = availableGradeTypes().length ? [...availableGradeTypes()] : [...DEFAULT_GRADE_TYPES];
  const inYearTests = state.tests.filter((t) => inRange(t.date, sy.startDate, sy.endDate));
  const filteredTests = inYearTests.filter((t) => {
    if (!allowedStudentIds.has(t.studentId)) return false;
    if (quarterRange && quarterFilter !== "all" && !inRange(t.date, quarterRange.startDate, quarterRange.endDate)) return false;
    if (subjectFilter !== "all" && t.subjectId !== subjectFilter) return false;
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

  const sy = state.settings.schoolYear;
  const quarterFilter = document.getElementById("work-filter-quarter")?.value || "all";
  const selectedStudentIds = getWorkSelectedStudentIds();
  const quarterRange = state.settings.quarters.find((q) => q.name === quarterFilter);

  const filteredTests = state.tests.filter((t) => {
    if (!allowedStudentIds.has(t.studentId)) return false;
    if (!inRange(t.date, sy.startDate, sy.endDate)) return false;
    if (quarterRange && quarterFilter !== "all" && !inRange(t.date, quarterRange.startDate, quarterRange.endDate)) return false;
    if (selectedStudentIds.length && !selectedStudentIds.includes(t.studentId)) return false;
    const gradeType = resolveGradeType(t);
    if (!gradeType) return false;
    return gradeType === workDistributionGradeType;
  });

  const bySubject = new Map();
  filteredTests.forEach((test) => {
    const subjectName = getSubjectName(test.subjectId);
    bySubject.set(subjectName, (bySubject.get(subjectName) || 0) + 1);
  });

  const entries = Array.from(bySubject.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  if (!total) {
    chartHost.innerHTML = `<p class='muted'>No ${workDistributionGradeType} grades for this school year.</p>`;
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
      <div class="pie-total">Total ${workDistributionGradeType}: ${total}</div>
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
  const topStudent = dashboardStudents
    .map((student) => ({
      studentId: student.id,
      avg: studentOverallAverage(student.id),
      count: state.tests.filter((t) => t.studentId === student.id).length
    }))
    .filter((entry) => entry.count > 0 && allowedStudentIds.has(entry.studentId))
    .sort((a,b)=>b.avg-a.avg || getStudentName(a.studentId).localeCompare(getStudentName(b.studentId)))[0];
  document.getElementById("kpi-superstar").textContent = topStudent
    ? `${getStudentName(topStudent.studentId)} (${topStudent.avg.toFixed(1)}%)`
    : "No grades yet";
  const runningAverage = isStudentUser() && dashboardStudents.length === 1
    ? studentOverallAverage(dashboardStudents[0].id)
    : g.running;
  document.getElementById("kpi-running-avg").textContent = `${runningAverage.toFixed(1)}%`;

  const attendanceDatesThroughToday = dates.filter((d) => d <= todayISO());
  const totalAttendanceDays = attendanceDatesThroughToday.length;
  const attendanceLeaders = dashboardStudents
    .map((student) => {
      const summary = studentAttendanceSummary(student.id);
      const presentCount = summary.attended;
      const attendanceAverage = totalAttendanceDays > 0 ? (presentCount / totalAttendanceDays) * 100 : 0;
      return {
        studentId: student.id,
        attendanceAverage
      };
    })
    .sort((a, b) => b.attendanceAverage - a.attendanceAverage || getStudentName(a.studentId).localeCompare(getStudentName(b.studentId)));
  const topAttendance = attendanceLeaders.length ? attendanceLeaders[0].attendanceAverage : -1;
  const topAttendanceStudents = attendanceLeaders
    .filter((entry) => Math.abs(entry.attendanceAverage - topAttendance) < 0.0001)
    .map((entry) => getStudentName(entry.studentId));
  document.getElementById("kpi-attendance-star").textContent = topAttendanceStudents.length
    ? `${topAttendanceStudents.join(", ")} (${topAttendance.toFixed(1)}%)`
    : "No attendance yet";

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

  const quarterByName = new Map(state.settings.quarters.map((entry) => [entry.name, entry]));
  const formatAvgCell = (avgValue, count) => count > 0 ? `${avgValue.toFixed(1)}%` : "No grades";
  const gradeTypeOrder = ["Assignment", "Quiz", "Test", "Quarterly Final", "Final"];
  const studentMetrics = dashboardStudents
    .map((student) => {
      const studentTests = state.tests.filter((t) => t.studentId === student.id);
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
  renderGradeTrending();
  renderGpaTrending();
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

    let slot = 8 * 60;
    let lunchAdded = false;

    while (remaining.length) {
      if (!lunchAdded && slot >= 12 * 60 && slot < 13 * 60) {
        blocks.push({ student: studentName, label: "Lunch Break", start: 12 * 60, end: 13 * 60, type: "lunch" });
        slot = 13 * 60;
        lunchAdded = true;
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

      if (!lunchAdded && slot < 12 * 60) {
        const fitsBeforeLunch = startNow.filter((candidate) => slot + candidate.durationMinutes <= 12 * 60);
        if (fitsBeforeLunch.length) {
          [chosen] = fitsBeforeLunch;
        } else if (startNow.length) {
          blocks.push({ student: studentName, label: "Lunch Break", start: 12 * 60, end: 13 * 60, type: "lunch" });
          slot = 13 * 60;
          lunchAdded = true;
          continue;
        }
      } else if (startNow.length) {
        [chosen] = startNow;
      }

      if (!chosen) {
        const nextAvailable = Math.min(...candidates.map((candidate) => candidate.availableAt));
        if (!Number.isFinite(nextAvailable)) break;

        if (!lunchAdded && slot < 12 * 60 && nextAvailable >= 12 * 60) {
          blocks.push({ student: studentName, label: "Lunch Break", start: 12 * 60, end: 13 * 60, type: "lunch" });
          slot = 13 * 60;
          lunchAdded = true;
          continue;
        }

        slot = Math.max(slot, nextAvailable);
        continue;
      }

      const startMin = slot;
      const endMin = Math.min(24 * 60, startMin + chosen.durationMinutes);
      blocks.push({
        student: studentName,
        studentId,
        courseId: chosen.event.courseId,
        label: `${chosen.course.name} (${getSubjectName(chosen.course.subjectId)})`,
        start: startMin,
        end: endMin,
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

    blocksByStudent.set(studentId, blocks);
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
          current.hours += Number(course.hoursPerDay || 0);
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
  const formatTime = (minutes) => {
    const h24 = Math.floor(minutes / 60);
    const mins = minutes % 60;
    const ampm = h24 >= 12 ? "PM" : "AM";
    const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
    return `${h12}:${String(mins).padStart(2, "0")} ${ampm}`;
  };

  const blocksByStudent = dailyScheduledBlocks(dateKey, studentFilterIds, subjectFilterIds, courseFilterIds);
  const scheduledByHour = new Map();
  const studentIdsInOrder = Array.from(blocksByStudent.keys())
    .sort((a, b) => getStudentName(a).localeCompare(getStudentName(b)));
  const addBlock = (student, label, startMin, endMin) => {
    if (endMin <= startMin) return;
    const hour = Math.floor(startMin / 60);
    if (hour < 0 || hour > 23) return;
    if (!scheduledByHour.has(hour)) scheduledByHour.set(hour, []);
    scheduledByHour.get(hour).push({
      student,
      label,
      start: startMin,
      end: endMin
    });
  };

  studentIdsInOrder.forEach((studentId) => {
    (blocksByStudent.get(studentId) || []).forEach((block) => {
      addBlock(block.student, block.label, block.start, block.end);
    });
  });

  const instructionalBlocks = Array.from(scheduledByHour.values())
    .flat()
    .filter((item) => item.label !== "Lunch Break");
  const minHour = instructionalBlocks.length
    ? Math.max(0, Math.floor(Math.min(...instructionalBlocks.map((item) => item.start)) / 60))
    : 0;
  const maxHour = instructionalBlocks.length
    ? Math.min(23, Math.floor((Math.max(...instructionalBlocks.map((item) => item.end)) - 1) / 60))
    : 23;

  const rows = [];
  for (let hour = minHour; hour <= maxHour; hour += 1) {
    const label = `${String(hour).padStart(2, "0")}:00`;
    const items = (scheduledByHour.get(hour) || []).sort((a, b) =>
      a.start - b.start || a.student.localeCompare(b.student) || a.label.localeCompare(b.label));
    if (!items.length) {
      rows.push(`<tr><td>${label}</td><td></td><td></td></tr>`);
      continue;
    }
    items.forEach((item, idx) => {
      rows.push(`<tr><td>${idx === 0 ? label : ""}</td><td>${item.student}</td><td>${item.label} (${formatTime(item.start)} - ${formatTime(item.end)})</td></tr>`);
    });
  }
  rowOrEmpty(document.getElementById("calendar-day-table"), rows, "No scheduled instruction for this day.", 3);
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
}

function beginSchoolYearEdit(schoolYearId) {
  const schoolYear = getSchoolYear(schoolYearId);
  if (!schoolYear) return;
  editingSchoolYearId = schoolYearId;
  document.getElementById("school-year-label").value = schoolYear.label;
  document.getElementById("school-year-start").value = schoolYear.startDate;
  document.getElementById("school-year-end").value = schoolYear.endDate;
  renderPlanningSettings();
}

function cancelSchoolYearEdit() {
  editingSchoolYearId = "";
  fillSettingsForms();
  renderPlanningSettings();
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
  state.tests = state.tests.filter((t)=>t.studentId!==id);
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
  state.tests = state.tests.filter((t)=>t.courseId!==id);
  if (editingCourseId === id) editingCourseId = "";
}

function beginCourseEdit(courseId) {
  const course = state.courses.find((c) => c.id === courseId);
  if (!course) return;
  editingCourseId = course.id;
  document.getElementById("course-name").value = course.name;
  document.getElementById("course-subject").value = course.subjectId;
  document.getElementById("course-hours").value = String(Number(course.hoursPerDay));
  document.getElementById("course-exclusive-resource").checked = !!course.exclusiveResource;
  renderCourses();
}

function cancelCourseEdit() {
  editingCourseId = "";
  document.getElementById("course-form").reset();
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

function bindEvents() {
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.addEventListener("click", () => {
    setActiveTab(btn.dataset.tab || "dashboard");
  }));

  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("login-username").value.trim().toLowerCase();
    const password = document.getElementById("login-password").value;
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

  const logoutBtn = document.getElementById("logout-btn");
  if (logoutBtn) logoutBtn.addEventListener("click", () => logout());

  const userRoleSelect = document.getElementById("user-role");
  if (userRoleSelect) userRoleSelect.addEventListener("change", () => ensureStudentSelection());

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
    if (existing) {
      existing.username = username;
      existing.role = role === "student" ? "student" : "admin";
      existing.studentId = role === "student" ? studentId : "";
      existing.mustChangePassword = existing.id === "default-admin-user" ? !password : existing.mustChangePassword;
      existing.updatedAt = todayISO();
      if (password) {
        const credentials = await buildPasswordCredentials(password);
        existing.passwordSalt = credentials.passwordSalt;
        existing.passwordHash = credentials.passwordHash;
        existing.mustChangePassword = false;
      }
    } else {
      state.users.push(await createUserRecord({
        username,
        role,
        password,
        studentId,
        mustChangePassword: false
      }));
    }
    resetUserForm();
    setUserFormMessage("success", existing ? "User account updated." : "User account created.");
    saveState();
    renderAll();
  });

  const userCancelEditBtn = document.getElementById("user-cancel-edit-btn");
  if (userCancelEditBtn) {
    userCancelEditBtn.addEventListener("click", () => {
      resetUserForm();
      resetUserFormMessage();
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
    state.students.push({ id: uid(), firstName, lastName, birthdate, grade, ageRecorded: calculateAge(birthdate), createdAt: todayISO() });
    e.target.reset(); saveState(); renderAll();
  });

  document.getElementById("subject-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!ensureAdminAction()) return;
    const name = document.getElementById("subject-name").value.trim();
    if (!name) return;
    if (state.subjects.some((s)=>s.name.toLowerCase()===name.toLowerCase())) { alert("Subject already exists."); return; }
    state.subjects.push({ id: uid(), name }); e.target.reset(); saveState(); renderAll();
  });

  document.getElementById("course-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!ensureAdminAction()) return;
    const name = document.getElementById("course-name").value.trim();
    const subjectId = document.getElementById("course-subject").value;
    const hoursPerDay = Number(document.getElementById("course-hours").value);
    const exclusiveResource = !!document.getElementById("course-exclusive-resource").checked;
    if (!name || !subjectId || Number.isNaN(hoursPerDay) || hoursPerDay <= 0) { alert("Provide course name, subject, and hours/day."); return; }
    if (editingCourseId) {
      const existing = state.courses.find((c) => c.id === editingCourseId);
      if (existing) {
        existing.name = name;
        existing.subjectId = subjectId;
        existing.hoursPerDay = hoursPerDay;
        existing.exclusiveResource = exclusiveResource;
      }
      editingCourseId = "";
    } else {
      state.courses.push({ id: uid(), name, subjectId, hoursPerDay, exclusiveResource });
    }
    e.target.reset();
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
      const existing = draftGradeTypes().find((gt) => gt.id === editingGradeTypeId);
      if (existing) {
        existing.name = name;
        existing.weight = weight;
      }
      editingGradeTypeId = "";
    } else {
      gradeTypesDraft.push({ id: uid(), name, weight });
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
      state.settings.gradeTypes = cloneGradeTypes(draftGradeTypes());
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
  const courseCancelEditBtn = document.getElementById("course-cancel-edit-btn");
  if (courseCancelEditBtn) {
    courseCancelEditBtn.addEventListener("click", () => cancelCourseEdit());
  }

  document.getElementById("student-enrollment-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!ensureAdminAction()) return;
    const studentId = selectedStudentId;
    const courseId = document.getElementById("student-enroll-course").value;
    if (!studentId || !courseId) return;
    if (state.enrollments.some((x)=>x.studentId===studentId && x.courseId===courseId)) { alert("Student already enrolled in this course."); return; }
    state.enrollments.push({ id: uid(), studentId, courseId, scheduleOrder: null }); saveState(); renderAll();
  });

  document.getElementById("school-year-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!ensureAdminAction()) return;
    const label = document.getElementById("school-year-label").value.trim();
    const startDate = document.getElementById("school-year-start").value;
    const endDate = document.getElementById("school-year-end").value;
    if (!label) { alert("School year label is required."); return; }
    if (!validRange(startDate, endDate)) { alert("School year range is invalid."); return; }
    const existing = state.settings.schoolYears.find((year) => year.id === editingSchoolYearId);
    const previousStartDate = existing?.startDate || "";
    const previousEndDate = existing?.endDate || "";
    if (existing) {
      existing.label = label;
      existing.startDate = startDate;
      existing.endDate = endDate;
      syncAnnualPlansForSchoolYear(previousStartDate, previousEndDate, startDate, endDate);
    } else {
      const duplicate = state.settings.schoolYears.find((year) =>
        year.label.toLowerCase() === label.toLowerCase()
        && year.startDate === startDate
        && year.endDate === endDate);
      if (duplicate) { alert("That school year already exists."); return; }
      state.settings.schoolYears.push({ id: uid(), label, startDate, endDate });
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
    state.settings.allQuarters = state.settings.allQuarters.filter((quarter) => quarter.schoolYearId !== schoolYearId);
    state.settings.allQuarters.push(...q);
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

  document.getElementById("holiday-form").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!ensureAdminAction()) return;
    const name = document.getElementById("holiday-name").value.trim();
    const type = document.getElementById("holiday-type").value;
    const startDate = document.getElementById("holiday-start").value;
    const endDate = document.getElementById("holiday-end").value;
    if (!name || !validRange(startDate, endDate)) { alert("Provide valid holiday/break values."); return; }
    if (editingHolidayId) {
      const existing = state.settings.holidays.find((h) => h.id === editingHolidayId);
      if (existing) {
        existing.name = name;
        existing.type = type;
        existing.startDate = startDate;
        existing.endDate = endDate;
      }
      editingHolidayId = "";
    } else {
      state.settings.holidays.push({ id: uid(), name, type, startDate, endDate });
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
    const editCourseId = courseIds[0];

    if (planType === "annual") {
      const startDate = state.settings.schoolYear.startDate;
      const endDate = state.settings.schoolYear.endDate;
      if (!validRange(startDate, endDate)) { alert("Current school year range is invalid."); return; }
      if (editingPlanId) {
        const existing = state.plans.find((p) => p.id === editingPlanId);
        if (existing) {
          existing.planType = planType;
          existing.studentId = studentId;
          existing.courseId = editCourseId;
          existing.startDate = startDate;
          existing.endDate = endDate;
          existing.weekdays = weekdays;
          delete existing.quarterName;
        }
        editingPlanId = "";
      } else {
        courseIds.forEach((courseId) => {
          state.plans.push({ id: uid(), planType, studentId, courseId, startDate, endDate, weekdays });
        });
      }
    } else if (planType === "quarterly") {
      const selectedQuarterNames = getSelectedPlanQuarters();
      if (!selectedQuarterNames.length) { alert("Select at least one quarter."); return; }
      const selectedQuarters = selectedQuarterNames
        .map((name) => state.settings.quarters.find((q) => q.name === name))
        .filter(Boolean);
      if (!selectedQuarters.length) { alert("Selected quarter configuration is invalid."); return; }

      if (editingPlanId) {
        if (selectedQuarters.length > 1) {
          alert("When editing a plan, select exactly one quarter.");
          return;
        }
        const targetQuarter = selectedQuarters[0];
        const existing = state.plans.find((p) => p.id === editingPlanId);
        if (existing) {
          existing.planType = planType;
          existing.studentId = studentId;
          existing.courseId = editCourseId;
          existing.startDate = targetQuarter.startDate;
          existing.endDate = targetQuarter.endDate;
          existing.weekdays = weekdays;
          existing.quarterName = targetQuarter.name;
        }
        editingPlanId = "";
      } else {
        selectedQuarters.forEach((quarter) => {
          courseIds.forEach((courseId) => {
            state.plans.push({
              id: uid(),
              planType,
              studentId,
              courseId,
              startDate: quarter.startDate,
              endDate: quarter.endDate,
              weekdays,
              quarterName: quarter.name
            });
          });
        });
      }
    } else {
      const startDate = document.getElementById("plan-start").value;
      const endDate = document.getElementById("plan-end").value;
      if (!validRange(startDate, endDate)) { alert("Provide a valid weekly start/end range."); return; }
      if (editingPlanId) {
        const existing = state.plans.find((p) => p.id === editingPlanId);
        if (existing) {
          existing.planType = planType;
          existing.studentId = studentId;
          existing.courseId = editCourseId;
          existing.startDate = startDate;
          existing.endDate = endDate;
          existing.weekdays = weekdays;
          delete existing.quarterName;
        }
        editingPlanId = "";
      } else {
        courseIds.forEach((courseId) => {
          state.plans.push({ id: uid(), planType, studentId, courseId, startDate, endDate, weekdays });
        });
      }
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
    if (editingAttendanceId) {
      const studentId = studentIds[0];
      const target = state.attendance.find((a) => a.id === editingAttendanceId);
      if (target) {
        target.studentId = studentId;
        target.date = date;
        target.present = status === "present";
      }
      const duplicate = state.attendance.find((a) => a.id !== editingAttendanceId && a.studentId === studentId && a.date === date);
      if (duplicate) {
        duplicate.present = status === "present";
        state.attendance = state.attendance.filter((a) => a.id !== editingAttendanceId);
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
        else state.attendance.push({ id: uid(), studentId, date, present: status === "present" });
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
  ["grades-filter-student", "grades-filter-quarter", "grades-filter-school-year", "grades-filter-subject", "grades-filter-course", "grades-filter-grade-type"]
    .forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener("change", () => {
        if (id === "grades-filter-student" || id === "grades-filter-subject") {
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
  ["trend-filter-quarter", "trend-filter-subject", "trend-filter-grade-type"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", () => renderGradeTrending());
  });
  const trendClearFiltersBtn = document.getElementById("trend-clear-filters-btn");
  if (trendClearFiltersBtn) {
    trendClearFiltersBtn.addEventListener("click", () => {
      const quarterFilter = document.getElementById("trend-filter-quarter");
      const subjectFilter = document.getElementById("trend-filter-subject");
      const gradeTypeFilter = document.getElementById("trend-filter-grade-type");
      if (quarterFilter) quarterFilter.value = "all";
      if (subjectFilter) subjectFilter.value = "all";
      if (gradeTypeFilter) gradeTypeFilter.value = "all";
      trendSelectedStudentIds.clear();
      document.querySelectorAll(".trend-student-checkbox").forEach((el) => { el.checked = false; });
      updateTrendStudentSummary();
      renderGradeTrending();
    });
  }
  ["gpa-trend-filter-quarter", "gpa-trend-filter-subject", "gpa-trend-filter-grade-type"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", () => renderGpaTrending());
  });
  const gpaTrendClearFiltersBtn = document.getElementById("gpa-trend-clear-filters-btn");
  if (gpaTrendClearFiltersBtn) {
    gpaTrendClearFiltersBtn.addEventListener("click", () => {
      const quarterFilter = document.getElementById("gpa-trend-filter-quarter");
      const subjectFilter = document.getElementById("gpa-trend-filter-subject");
      const gradeTypeFilter = document.getElementById("gpa-trend-filter-grade-type");
      if (quarterFilter) quarterFilter.value = "all";
      if (subjectFilter) subjectFilter.value = "all";
      if (gradeTypeFilter) gradeTypeFilter.value = "all";
      gpaTrendSelectedStudentIds.clear();
      document.querySelectorAll(".gpa-trend-student-checkbox").forEach((el) => { el.checked = false; });
      updateGpaTrendStudentSummary();
      renderGpaTrending();
    });
  }
  ["volume-filter-quarter", "volume-filter-subject", "volume-filter-grade-type"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", () => renderGradeTypeVolumeChart());
  });
  const volumeClearFiltersBtn = document.getElementById("volume-clear-filters-btn");
  if (volumeClearFiltersBtn) {
    volumeClearFiltersBtn.addEventListener("click", () => {
      const quarterFilter = document.getElementById("volume-filter-quarter");
      const subjectFilter = document.getElementById("volume-filter-subject");
      const gradeTypeFilter = document.getElementById("volume-filter-grade-type");
      if (quarterFilter) quarterFilter.value = "all";
      if (subjectFilter) subjectFilter.value = "all";
      if (gradeTypeFilter) gradeTypeFilter.value = "all";
      volumeSelectedStudentIds.clear();
      document.querySelectorAll(".volume-student-checkbox").forEach((el) => { el.checked = false; });
      updateVolumeStudentSummary();
      renderGradeTypeVolumeChart();
    });
  }
  ["work-filter-quarter"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", () => renderWorkDistributionChart());
  });
  const workClearFiltersBtn = document.getElementById("work-clear-filters-btn");
  if (workClearFiltersBtn) {
    workClearFiltersBtn.addEventListener("click", () => {
      const quarterFilter = document.getElementById("work-filter-quarter");
      if (quarterFilter) quarterFilter.value = "all";
      workSelectedStudentIds.clear();
      document.querySelectorAll(".work-student-checkbox").forEach((el) => { el.checked = false; });
      workDistributionGradeType = "Assignment";
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
    if (t.classList.contains("work-dist-grade-type-checkbox")) {
      const selectedType = t.getAttribute("value") || "";
      if (!selectedType) return;
      workDistributionGradeType = selectedType;
      document.querySelectorAll(".work-dist-grade-type-checkbox").forEach((el) => {
        if (!(el instanceof HTMLInputElement)) return;
        el.checked = el.value === selectedType;
      });
      renderWorkDistributionChart();
      return;
    }
    if (t.classList.contains("plan-course-checkbox")) {
      updatePlanCourseSummary();
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
    if (t.getAttribute("id") === "management-subjects-toggle-btn") {
      showManagementSubjects = !showManagementSubjects;
      renderManagementSectionVisibility();
      return;
    }
    if (t.getAttribute("id") === "management-courses-toggle-btn") {
      showManagementCourses = !showManagementCourses;
      renderManagementSectionVisibility();
      return;
    }
    if (t.getAttribute("id") === "management-grade-types-toggle-btn") {
      showManagementGradeTypes = !showManagementGradeTypes;
      renderManagementSectionVisibility();
      return;
    }
    if (t.getAttribute("id") === "schedule-school-years-toggle-btn") {
      showScheduleSchoolYears = !showScheduleSchoolYears;
      renderScheduleSectionVisibility();
      return;
    }
    if (t.getAttribute("id") === "schedule-quarters-toggle-btn") {
      showScheduleQuarters = !showScheduleQuarters;
      renderScheduleSectionVisibility();
      return;
    }
    if (t.getAttribute("id") === "schedule-holidays-toggle-btn") {
      showScheduleHolidays = !showScheduleHolidays;
      renderScheduleSectionVisibility();
      return;
    }
    if (t.getAttribute("id") === "schedule-plans-toggle-btn") {
      showSchedulePlans = !showSchedulePlans;
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
      state.attendance = state.attendance.filter((a) => a.id !== removeAttendanceId);
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
        const existing = state.tests.find((x) => x.id === editGradeId);
        if (existing) {
          existing.date = date;
          existing.studentId = studentId;
          existing.subjectId = subjectId;
          existing.courseId = courseId;
          existing.gradeType = gradeType;
          existing.testName = gradeType;
          existing.score = gradeValue;
          existing.maxScore = 100;
        }
      } else {
        state.tests.push({
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
      }

      row.remove();
      updateGradeEntryVisibility();
      saveState();
      renderAll();
      return;
    }

    const cancelGrade = t.getAttribute("data-grade-cancel");
    if (cancelGrade) {
      if (!ensureAdminAction()) return;
      const row = t.closest("tr");
      if (row) row.remove();
      updateGradeEntryVisibility();
      return;
    }

    const openStudentId = t.getAttribute("data-open-student"); if (openStudentId) { selectedStudentId = openStudentId; renderAll(); return; }
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
      state.users = state.users.filter((entry) => entry.id !== removeUserId);
      if (editingUserId === removeUserId) resetUserForm();
      if (currentUserId === removeUserId) logout();
      saveState();
      renderAll();
      return;
    }
    const studentId = t.getAttribute("data-remove-student"); if (studentId) { if (!ensureAdminAction()) return; removeStudent(studentId); saveState(); renderAll(); return; }
    const subjectId = t.getAttribute("data-remove-subject"); if (subjectId) { if (!ensureAdminAction()) return; removeSubject(subjectId); saveState(); renderAll(); return; }
    const courseId = t.getAttribute("data-remove-course"); if (courseId) { if (!ensureAdminAction()) return; removeCourse(courseId); saveState(); renderAll(); return; }
    const gradeTypeId = t.getAttribute("data-remove-grade-type");
    if (gradeTypeId) {
      if (!ensureAdminAction()) return;
      gradeTypesDraft = draftGradeTypes().filter((gt) => gt.id !== gradeTypeId);
      if (editingGradeTypeId === gradeTypeId) editingGradeTypeId = "";
      gradeTypeDraftDirty = true;
      renderGradeTypes();
      return;
    }
    const enrollmentId = t.getAttribute("data-remove-student-enrollment"); if (enrollmentId) { if (!ensureAdminAction()) return; state.enrollments = state.enrollments.filter((x)=>x.id!==enrollmentId); saveState(); renderAll(); return; }
    const holidayId = t.getAttribute("data-remove-holiday"); if (holidayId) { if (!ensureAdminAction()) return; state.settings.holidays = state.settings.holidays.filter((x)=>x.id!==holidayId); if (editingHolidayId === holidayId) editingHolidayId = ""; saveState(); renderAll(); return; }
    const planId = t.getAttribute("data-remove-plan"); if (planId) { if (!ensureAdminAction()) return; state.plans = state.plans.filter((x)=>x.id!==planId); if (editingPlanId === planId) editingPlanId = ""; saveState(); renderAll(); }
  });
}

function renderAll() {
  renderSessionChrome();
  renderSelects();
  fillSettingsForms();
  updatePlanFormMode();
  renderStudents();
  renderStudentDetail();
  renderSubjects();
  renderManagementSectionVisibility();
  renderCourses();
  renderGradeTypes();
  renderHolidays();
  renderPlanningSettings();
  renderPlans();
  renderScheduleSectionVisibility();
  renderAttendance();
  renderTests();
  renderUsers();
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
bootstrapStateFromApi();
