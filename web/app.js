const STORAGE_KEY = "hsm_state_v2";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
    students: [], subjects: [], courses: [], enrollments: [], plans: [], attendance: [], tests: [],
    settings: {
      schoolYear: { ...schoolYear },
      schoolYears: [schoolYear],
      currentSchoolYearId: schoolYearId,
      quarters: quarters.map((q) => ({ ...q })),
      allQuarters: quarters,
      holidays: []
    }
  };
}

function validState(s) {
  return s && Array.isArray(s.students) && Array.isArray(s.subjects) && Array.isArray(s.courses)
    && Array.isArray(s.enrollments) && Array.isArray(s.plans) && Array.isArray(s.attendance)
    && Array.isArray(s.tests) && s.settings && s.settings.schoolYear
    && Array.isArray(s.settings.quarters) && Array.isArray(s.settings.holidays);
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
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    if (!validState(parsed)) return defaultState();
    normalizeSettingsShape(parsed);
    return parsed;
  } catch {
    return defaultState();
  }
}

let state = loadState();
setCurrentSchoolYear(state.settings.currentSchoolYearId);
let selectedStudentId = "";
let editingAttendanceId = "";
const expandedStudentAverageRows = new Set();
const expandedSubjectAverageRows = new Set();
const expandedStudentAttendanceRows = new Set();
const trendSelectedStudentIds = new Set();
let editingSchoolYearId = "";
let editingQuarterSchoolYearId = "";
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function getStudentName(id) { const s = state.students.find((x) => x.id === id); return s ? `${s.firstName} ${s.lastName}` : "Unknown Student"; }
function getSubjectName(id) { const s = state.subjects.find((x) => x.id === id); return s ? s.name : "Unknown Subject"; }
function getCourse(id) { return state.courses.find((x) => x.id === id) || null; }
function getCourseName(id) { const c = getCourse(id); return c ? c.name : "Unknown Course"; }
function getSchoolYear(id) { return state.settings.schoolYears.find((x) => x.id === id) || null; }
function currentSchoolYear() {
  return getSchoolYear(state.settings.currentSchoolYearId) || state.settings.schoolYears[0] || state.settings.schoolYear;
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

function inRange(date, startDate, endDate) { return date >= startDate && date <= endDate; }
function avg(vals){ return vals.length ? vals.reduce((a,b)=>a+b,0) / vals.length : 0; }
function pct(score, max) { const s = Number(score), m = Number(max); return m > 0 ? (s / m) * 100 : 0; }
function studentOverallAverage(studentId) {
  const vals = state.tests
    .filter((t) => t.studentId === studentId)
    .map((t) => pct(t.score, t.maxScore));
  return avg(vals);
}
function studentCourseAverage(studentId, courseId) {
  const vals = state.tests
    .filter((t) => t.studentId === studentId && t.courseId === courseId)
    .map((t) => pct(t.score, t.maxScore));
  return avg(vals);
}
function studentCourseAverageByRange(studentId, courseId, startDate, endDate) {
  const vals = state.tests
    .filter((t) =>
      t.studentId === studentId
      && t.courseId === courseId
      && inRange(t.date, startDate, endDate))
    .map((t) => pct(t.score, t.maxScore));
  return avg(vals);
}
function studentAbsenceCount(studentId) {
  const startDate = state.settings.schoolYear.startDate;
  const endDate = state.settings.schoolYear.endDate;
  const today = todayISO();
  return state.attendance.filter((a) =>
    a.studentId === studentId
    && !a.present
    && a.date >= startDate
    && a.date <= endDate
    && a.date <= today).length;
}
function studentAttendanceSummary(studentId) {
  const startDate = state.settings.schoolYear.startDate;
  const endDate = state.settings.schoolYear.endDate;
  const today = todayISO();
  const records = state.attendance.filter((a) =>
    a.studentId === studentId
    && a.date >= startDate
    && a.date <= endDate
    && a.date <= today);
  return {
    attended: records.filter((a) => a.present).length,
    absent: records.filter((a) => !a.present).length
  };
}
function studentAttendanceSummaryByRange(studentId, startDate, endDate) {
  const today = todayISO();
  const records = state.attendance.filter((a) =>
    a.studentId === studentId
    && a.date >= startDate
    && a.date <= endDate
    && a.date <= today);
  return {
    attended: records.filter((a) => a.present).length,
    absent: records.filter((a) => !a.present).length
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
  options("course-subject", state.subjects, (s) => s.name, state.subjects.length ? null : "Add a subject first");
  options("test-subject", state.subjects, (s) => s.name, state.subjects.length ? null : "Add a subject first");
  options("student-enroll-course", state.courses, (c) => `${c.name} (${getSubjectName(c.subjectId)})`, state.courses.length ? null : "Add a course first");
  options("plan-course", state.courses, (c) => `${c.name} (${getSubjectName(c.subjectId)})`, state.courses.length ? null : "Add a course first");
  options("test-course", state.courses, (c) => `${c.name} (${getSubjectName(c.subjectId)})`, state.courses.length ? null : "Add a course first");
  options("plan-student", state.students, (s) => `${s.firstName} ${s.lastName}`, state.students.length ? null : "Add a student first");
  options("calendar-student", state.students, (s) => `${s.firstName} ${s.lastName}`, "All Students");
  options("test-student", state.students, (s) => `${s.firstName} ${s.lastName}`, state.students.length ? null : "Add a student first");
  renderAttendanceStudentChecklist();
  renderTrendStudentChecklist(Array.from(trendSelectedStudentIds));

  const attendanceFilterStudent = document.getElementById("attendance-filter-student");
  if (attendanceFilterStudent) {
    const current = attendanceFilterStudent.value || "all";
    attendanceFilterStudent.innerHTML = "<option value='all'>All Students</option>";
    state.students.forEach((s) => {
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

  const gradeStudentSelect = document.getElementById("grades-filter-student");
  if (gradeStudentSelect) {
    const current = gradeStudentSelect.value || "all";
    gradeStudentSelect.innerHTML = "<option value='all'>All Students</option>";
    state.students.forEach((s) => {
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
    const allTypes = ["Assignment", "Quiz", "Test", "Quarterly Final", "Final"];
    state.tests.forEach((test) => {
      const type = test.gradeType || test.testName || "";
      if (type && !allTypes.includes(type)) allTypes.push(type);
    });
    trendGradeTypeSelect.innerHTML = "<option value='all'>All Grade Types</option>";
    allTypes.forEach((type) => {
      const option = document.createElement("option");
      option.value = type;
      option.textContent = type;
      trendGradeTypeSelect.appendChild(option);
    });
    if (Array.from(trendGradeTypeSelect.options).some((o) => o.value === current)) trendGradeTypeSelect.value = current;
  }

  syncGradesFilterSubjectCourseOptions();
}

function renderAttendanceStudentChecklist(preselectedStudentIds = []) {
  const container = document.getElementById("attendance-student-dropdown");
  const optionsWrap = document.getElementById("attendance-student-options");
  if (!container || !optionsWrap) return;
  const selected = new Set(preselectedStudentIds);
  const checkboxes = state.students.map((s, idx) => {
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
  const checkboxes = state.students.map((s, idx) => {
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

function rowOrEmpty(tbody, html, emptyMsg, cols) {
  if (!tbody) return;
  tbody.innerHTML = "";
  if (!html.length) { tbody.innerHTML = `<tr><td colspan='${cols}'>${emptyMsg}</td></tr>`; return; }
  tbody.innerHTML = html.join("");
}
function renderStudents() {
  const rows = state.students.map((s) => {
    const ageNow = calculateAge(s.birthdate);
    const overallAvg = studentOverallAverage(s.id);
    const absences = studentAbsenceCount(s.id);
    return `<tr><td>${s.firstName} ${s.lastName}</td><td>${s.grade}</td><td>${ageNow}</td><td>${overallAvg.toFixed(1)}%</td><td>${absences}</td><td><button data-open-student='${s.id}' type='button'>Open</button> <button data-remove-student='${s.id}' type='button'>Remove</button></td></tr>`;
  });
  rowOrEmpty(document.getElementById("student-table"), rows, "No students added yet.", 6);
}

function renderSubjects() {
  const list = document.getElementById("subject-list");
  list.innerHTML = "";
  if (!state.subjects.length) { list.innerHTML = "<li><span>No subjects added yet.</span></li>"; return; }
  list.innerHTML = state.subjects.map((s) => `<li><span>${s.name}</span><button data-remove-subject='${s.id}' type='button'>Remove</button></li>`).join("");
}

function renderCourses() {
  const list = document.getElementById("course-list");
  list.innerHTML = "";
  if (!state.courses.length) { list.innerHTML = "<li><span>No courses added yet.</span></li>"; return; }
  list.innerHTML = state.courses.map((c) => `<li><span>${c.name} | ${getSubjectName(c.subjectId)} | ${Number(c.hoursPerDay).toFixed(2)} hrs/day</span><button data-remove-course='${c.id}' type='button'>Remove</button></li>`).join("");
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

  const enrollmentRows = state.enrollments
    .filter((e) => e.studentId === student.id)
    .map((e) => {
      const course = getCourse(e.courseId);
      const subject = course ? getSubjectName(course.subjectId) : "Unknown Subject";
      const courseAvg = studentCourseAverageByRange(student.id, e.courseId, rangeStart, rangeEnd);
      const avgDisplay = courseAvg === 0 ? "No grades" : `${courseAvg.toFixed(1)}%`;
      return `<tr><td>${getCourseName(e.courseId)}</td><td>${subject}</td><td>${avgDisplay}</td><td><button data-remove-student-enrollment='${e.id}' type='button'>Remove</button></td></tr>`;
    });
  const courseAverages = state.enrollments
    .filter((e) => e.studentId === student.id)
    .map((e) => studentCourseAverageByRange(student.id, e.courseId, rangeStart, rangeEnd))
    .filter((value) => value > 0);
  if (enrollmentRows.length) {
    const avgOfCourses = courseAverages.length ? `${avg(courseAverages).toFixed(1)}%` : "No grades";
    enrollmentRows.push(`<tr><td colspan="2"><strong>Average</strong></td><td><strong>${avgOfCourses}</strong></td><td></td></tr>`);
  }
  rowOrEmpty(document.getElementById("student-enrollment-table"), enrollmentRows, "No course enrollments for this student.", 4);

  const summary = studentAttendanceSummaryByRange(student.id, rangeStart, rangeEnd);
  const attendanceRows = [
    `<tr><td>${student.firstName} ${student.lastName}</td><td>${summary.attended}</td><td>${summary.absent}</td></tr>`
  ];
  rowOrEmpty(document.getElementById("student-attendance-summary-table"), attendanceRows, "No students available.", 3);
}

function renderHolidays() {
  const list = document.getElementById("holiday-list");
  const rows = [...state.settings.holidays].sort((a,b)=>a.startDate.localeCompare(b.startDate));
  list.innerHTML = rows.length
    ? rows.map((h) => `<li><span>${h.name} (${h.type}) ${h.startDate} to ${h.endDate}</span><button data-remove-holiday='${h.id}' type='button'>Remove</button></li>`).join("")
    : "<li><span>No holidays/breaks defined.</span></li>";
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
  const list = document.getElementById("plan-list");
  const rows = [...state.plans].sort((a,b)=>a.startDate.localeCompare(b.startDate));
  list.innerHTML = rows.length
    ? rows.map((p) => `<li><span>${p.planType.toUpperCase()} | ${getStudentName(p.studentId)} | ${getCourseName(p.courseId)} | ${p.startDate} to ${p.endDate} | ${p.weekdays.map((w)=>DAY_NAMES[w]).join(", ")}</span><button data-remove-plan='${p.id}' type='button'>Remove</button></li>`).join("")
    : "<li><span>No instruction plans defined.</span></li>";
}

function renderAttendance() {
  const studentFilter = document.getElementById("attendance-filter-student")?.value || "all";
  const quarterFilter = document.getElementById("attendance-filter-quarter")?.value || "all";
  const quarterRange = state.settings.quarters.find((q) => q.name === quarterFilter);

  const filtered = state.attendance.filter((a) => {
    if (studentFilter !== "all" && a.studentId !== studentFilter) return false;
    if (quarterFilter !== "all" && quarterRange && !inRange(a.date, quarterRange.startDate, quarterRange.endDate)) return false;
    return true;
  });

  const rows = [...filtered]
    .sort((a,b)=>b.date.localeCompare(a.date))
    .slice(0,100)
    .map((a) => `<tr><td>${a.date}</td><td>${getStudentName(a.studentId)}</td><td>${a.present ? "Present" : "Absent"}</td><td><button type='button' data-edit-attendance='${a.id}'>Edit</button></td></tr>`);
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

function renderTests() {
  const studentFilter = document.getElementById("grades-filter-student")?.value || "all";
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
    const thisGradeType = t.gradeType || t.testName || "Test";
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
      const gradeType = t.gradeType || t.testName || "Test";
      return `<tr><td>${t.date}</td><td>${getStudentName(t.studentId)}</td><td>${getSubjectName(t.subjectId)}</td><td>${getCourseName(t.courseId)}</td><td>${gradeType}</td><td>${pct(t.score,t.maxScore).toFixed(1)}%</td><td><button type='button' data-edit-grade='${t.id}'>Edit</button></td></tr>`;
    });
  const avgGrade = avg(filtered.map((t) => pct(t.score, t.maxScore)));
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
  const selectedGradeType = existingGrade ? (existingGrade.gradeType || existingGrade.testName || "Test") : "Quiz";

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
        <option value="Assignment"${selectedGradeType === "Assignment" ? " selected" : ""}>Assignment</option>
        <option value="Quiz"${selectedGradeType === "Quiz" ? " selected" : ""}>Quiz</option>
        <option value="Test"${selectedGradeType === "Test" ? " selected" : ""}>Test</option>
        <option value="Quarterly Final"${selectedGradeType === "Quarterly Final" ? " selected" : ""}>Quarterly Final</option>
        <option value="Final"${selectedGradeType === "Final" ? " selected" : ""}>Final</option>
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

function gradeAnalytics() {
  const tests = state.tests.map((t) => ({ ...t, grade: pct(t.score, t.maxScore) }));
  const byStudent = new Map(); const bySubject = new Map();
  tests.forEach((t) => {
    if (!byStudent.has(t.studentId)) byStudent.set(t.studentId, []);
    byStudent.get(t.studentId).push(t.grade);
    if (!bySubject.has(t.subjectId)) bySubject.set(t.subjectId, []);
    bySubject.get(t.subjectId).push(t.grade);
  });
  const student = Array.from(byStudent.entries()).map(([studentId,vals]) => ({ studentId, avg: avg(vals), count: vals.length }));
  const subject = Array.from(bySubject.entries()).map(([subjectId,vals]) => ({ subjectId, avg: avg(vals), count: vals.length }));
  const running = avg(tests.map((t) => t.grade));

  const quarterRows = state.settings.quarters.map((q) => {
    const vals = tests.filter((t) => inRange(t.date, q.startDate, q.endDate)).map((t) => t.grade);
    return { label: q.name, avg: avg(vals), count: vals.length };
  });

  const sy = state.settings.schoolYear;
  const annualVals = tests.filter((t) => inRange(t.date, sy.startDate, sy.endDate)).map((t) => t.grade);
  const cq = currentQuarter(new Date());
  const cqVals = cq ? tests.filter((t) => inRange(t.date, cq.startDate, cq.endDate)).map((t) => t.grade) : [];

  return {
    student, subject, running,
    quarterRows,
    annualAvg: avg(annualVals),
    annualCount: annualVals.length,
    currentQuarterAvg: avg(cqVals)
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

  const quarterFilter = document.getElementById("trend-filter-quarter")?.value || "all";
  const subjectFilter = document.getElementById("trend-filter-subject")?.value || "all";
  const gradeTypeFilter = document.getElementById("trend-filter-grade-type")?.value || "all";
  const selectedStudentIds = getTrendSelectedStudentIds();
  const quarterRange = state.settings.quarters.find((q) => q.name === quarterFilter);

  const filteredTests = state.tests.filter((t) => {
    if (!inRange(t.date, sy.startDate, sy.endDate)) return false;
    if (quarterRange && quarterFilter !== "all" && !inRange(t.date, quarterRange.startDate, quarterRange.endDate)) return false;
    if (subjectFilter !== "all" && t.subjectId !== subjectFilter) return false;
    const gradeType = t.gradeType || t.testName || "Test";
    if (gradeTypeFilter !== "all" && gradeType !== gradeTypeFilter) return false;
    return true;
  });

  const seriesBase = selectedStudentIds.length
    ? selectedStudentIds.map((studentId) => ({ id: studentId, label: getStudentName(studentId), tests: filteredTests.filter((t) => t.studentId === studentId) }))
    : [{ id: "all", label: "All Students", tests: filteredTests }];
  const palette = ["#875422", "#2f6f3e", "#1f4d7a", "#8a3434", "#7c5f1f", "#5a3a88", "#35736f", "#9b4d2f"];

  const series = seriesBase.map((entry, idx) => {
    const monthly = months.map((monthEntry) => {
      const monthStart = new Date(monthEntry.year, monthEntry.month, 1, 12, 0, 0);
      const monthEnd = new Date(monthEntry.year, monthEntry.month + 1, 0, 12, 0, 0);
      const monthStartIso = toISO(monthStart);
      const monthEndIso = toISO(monthEnd);
      const vals = entry.tests
        .filter((t) => inRange(t.date, monthStartIso, monthEndIso))
        .map((t) => pct(t.score, t.maxScore));
      return {
        label: monthStart.toLocaleDateString(undefined, { month: "short" }),
        avg: vals.length ? avg(vals) : 0,
        count: vals.length
      };
    });
    return { ...entry, color: palette[idx % palette.length], monthly };
  });

  const width = 960;
  const height = 260;
  const margin = { top: 18, right: 20, bottom: 48, left: 52 };
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;
  const xPad = 16;
  const xSpan = Math.max(1, plotW - (xPad * 2));
  const xStep = months.length > 1 ? xSpan / (months.length - 1) : 0;
  const xFor = (idx) => margin.left + xPad + (xStep * idx);
  const yFor = (value) => margin.top + ((100 - value) / 100) * plotH;

  const yTicks = [0, 25, 50, 75, 100];
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

  const valueLabelSvg = series.flatMap((lineSeries, lineIdx) => lineSeries.monthly.map((row, idx) => {
    const x = xFor(idx);
    const y = yFor(row.avg || 0);
    const nearTop = y <= margin.top + 16;
    const nearBottom = y >= (height - margin.bottom - 10);
    const offsetBase = ((idx + lineIdx) % 2 === 0) ? -10 : 14;
    const offset = nearTop ? 14 : (nearBottom ? -10 : offsetBase);
    const yLabel = y + offset + (lineIdx * 8);
    return `<text x="${x.toFixed(2)}" y="${yLabel.toFixed(2)}" text-anchor="middle" class="trend-value-label" style="fill:${lineSeries.color}">${(row.avg || 0).toFixed(1)}%</text>`;
  })).join("");

  const legendSvg = series.map((lineSeries, idx) => {
    const x = margin.left + 8 + (idx * 170);
    const y = margin.top - 4;
    return `<g><line x1="${x}" y1="${y}" x2="${x + 18}" y2="${y}" class="trend-line" style="stroke:${lineSeries.color}"></line><text x="${x + 24}" y="${y + 4}" class="trend-axis-label">${lineSeries.label}</text></g>`;
  }).join("");

  const hasData = series.some((lineSeries) => lineSeries.monthly.some((row) => row.count > 0));
  const noData = hasData ? "" : `<text x="${(margin.left + plotW / 2).toFixed(2)}" y="${(margin.top + plotH / 2).toFixed(2)}" text-anchor="middle" class="trend-empty">No grade data for selected filters</text>`;

  chartHost.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" class="trend-chart" role="img" aria-label="Monthly grade trend line chart">
      <line x1="${margin.left}" y1="${(height - margin.bottom).toFixed(2)}" x2="${(width - margin.right).toFixed(2)}" y2="${(height - margin.bottom).toFixed(2)}" class="trend-axis"></line>
      <line x1="${margin.left}" y1="${margin.top}" x2="${margin.left}" y2="${(height - margin.bottom).toFixed(2)}" class="trend-axis"></line>
      ${legendSvg}
      ${yTickSvg}
      ${xTickSvg}
      ${lineSvg}
      ${pointSvg}
      ${valueLabelSvg}
      ${noData}
      <text x="${(width / 2).toFixed(2)}" y="${(height - 8).toFixed(2)}" text-anchor="middle" class="trend-axis-title">Month</text>
      <text x="16" y="${(margin.top + plotH / 2).toFixed(2)}" text-anchor="middle" transform="rotate(-90 16 ${(margin.top + plotH / 2).toFixed(2)})" class="trend-axis-title">Average Grade (%)</text>
    </svg>`;
}

function renderDashboard() {
  const dates = instructionalDates();
  const dateSet = new Set(dates);
  const presentSet = new Set(state.attendance.filter((a) => a.present && a.date <= todayISO()).map((a) => a.date));
  const completeDays = Array.from(presentSet).filter((d) => dateSet.has(d)).length;
  const totalDays = dates.length;

  document.getElementById("kpi-days-complete").textContent = String(completeDays);
  document.getElementById("kpi-days-total").textContent = String(totalDays);

  const g = gradeAnalytics();
  const topStudent = g.student
    .slice()
    .sort((a,b)=>b.avg-a.avg || getStudentName(a.studentId).localeCompare(getStudentName(b.studentId)))[0];
  document.getElementById("kpi-superstar").textContent = topStudent
    ? `${getStudentName(topStudent.studentId)} (${topStudent.avg.toFixed(1)}%)`
    : "No grades yet";
  document.getElementById("kpi-running-avg").textContent = `${g.running.toFixed(1)}%`;
  document.getElementById("kpi-quarter-avg").textContent = `${g.currentQuarterAvg.toFixed(1)}%`;

  const yP = progress(state.settings.schoolYear.startDate, state.settings.schoolYear.endDate);
  const q = currentQuarter(new Date());
  const qP = q ? progress(q.startDate, q.endDate) : 0;

  document.getElementById("year-progress-fill").style.width = `${yP.toFixed(1)}%`;
  document.getElementById("year-progress-text").textContent = `${state.settings.schoolYear.label}: ${yP.toFixed(1)}%`;
  document.getElementById("quarter-progress-fill").style.width = `${qP.toFixed(1)}%`;
  document.getElementById("quarter-progress-text").textContent = q ? `${q.name}: ${qP.toFixed(1)}%` : "No quarter set";

  const validStudentIds = new Set(state.students.map((student) => student.id));
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

  const quarterByName = new Map(state.settings.quarters.map((entry) => [entry.name, entry]));
  const formatAvgCell = (vals) => vals.length ? `${avg(vals).toFixed(1)}%` : "No grades";
  const gradeTypeOrder = ["Assignment", "Quiz", "Test", "Quarterly Final", "Final"];
  const studentMetrics = state.students
    .map((student) => {
      const studentTests = state.tests.filter((t) => t.studentId === student.id);
      const totalVals = studentTests.map((t) => pct(t.score, t.maxScore));
      const q1 = quarterByName.get("Q1");
      const q2 = quarterByName.get("Q2");
      const q3 = quarterByName.get("Q3");
      const q4 = quarterByName.get("Q4");

      const q1Vals = q1 ? studentTests.filter((t) => inRange(t.date, q1.startDate, q1.endDate)).map((t) => pct(t.score, t.maxScore)) : [];
      const q2Vals = q2 ? studentTests.filter((t) => inRange(t.date, q2.startDate, q2.endDate)).map((t) => pct(t.score, t.maxScore)) : [];
      const q3Vals = q3 ? studentTests.filter((t) => inRange(t.date, q3.startDate, q3.endDate)).map((t) => pct(t.score, t.maxScore)) : [];
      const q4Vals = q4 ? studentTests.filter((t) => inRange(t.date, q4.startDate, q4.endDate)).map((t) => pct(t.score, t.maxScore)) : [];
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
          const totalValsBySubject = testsForSubject.map((test) => pct(test.score, test.maxScore));
          const q1ValsBySubject = q1 ? testsForSubject.filter((test) => inRange(test.date, q1.startDate, q1.endDate)).map((test) => pct(test.score, test.maxScore)) : [];
          const q2ValsBySubject = q2 ? testsForSubject.filter((test) => inRange(test.date, q2.startDate, q2.endDate)).map((test) => pct(test.score, test.maxScore)) : [];
          const q3ValsBySubject = q3 ? testsForSubject.filter((test) => inRange(test.date, q3.startDate, q3.endDate)).map((test) => pct(test.score, test.maxScore)) : [];
          const q4ValsBySubject = q4 ? testsForSubject.filter((test) => inRange(test.date, q4.startDate, q4.endDate)).map((test) => pct(test.score, test.maxScore)) : [];

          const subjectKey = `${student.id}::${subjectId}`;
          const expandedSubject = expandedSubjectAverageRows.has(subjectKey);
          const subjectRow = `<tr class="student-avg-detail-row"><td class="student-avg-subject-cell"><button type="button" class="student-avg-toggle student-avg-subtoggle" data-toggle-subject-avg="${subjectKey}" aria-expanded="${expandedSubject ? "true" : "false"}">${expandedSubject ? "-" : "+"}</button>${subjectName}</td><td>${formatAvgCell(totalValsBySubject)}</td><td>${formatAvgCell(q1ValsBySubject)}</td><td>${formatAvgCell(q2ValsBySubject)}</td><td>${formatAvgCell(q3ValsBySubject)}</td><td>${formatAvgCell(q4ValsBySubject)}</td></tr>`;

          if (!expandedSubject) return [subjectRow];

          const typeMap = new Map();
          testsForSubject.forEach((test) => {
            const gradeType = test.gradeType || test.testName || "Other";
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
            const totalValsByType = typeTests.map((test) => pct(test.score, test.maxScore));
            const q1ValsByType = q1 ? typeTests.filter((test) => inRange(test.date, q1.startDate, q1.endDate)).map((test) => pct(test.score, test.maxScore)) : [];
            const q2ValsByType = q2 ? typeTests.filter((test) => inRange(test.date, q2.startDate, q2.endDate)).map((test) => pct(test.score, test.maxScore)) : [];
            const q3ValsByType = q3 ? typeTests.filter((test) => inRange(test.date, q3.startDate, q3.endDate)).map((test) => pct(test.score, test.maxScore)) : [];
            const q4ValsByType = q4 ? typeTests.filter((test) => inRange(test.date, q4.startDate, q4.endDate)).map((test) => pct(test.score, test.maxScore)) : [];
            return `<tr class="student-avg-type-row"><td class="student-avg-type-cell">${gradeType}</td><td>${formatAvgCell(totalValsByType)}</td><td>${formatAvgCell(q1ValsByType)}</td><td>${formatAvgCell(q2ValsByType)}</td><td>${formatAvgCell(q3ValsByType)}</td><td>${formatAvgCell(q4ValsByType)}</td></tr>`;
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
        totalVals,
        q1Vals,
        q2Vals,
        q3Vals,
        q4Vals,
        totalValue: totalVals.length ? avg(totalVals) : -1,
        row: `<tr><td><button type="button" class="student-avg-toggle" data-toggle-student-avg="${student.id}" aria-expanded="${expanded ? "true" : "false"}">${expanded ? "-" : "+"}</button> ${student.firstName} ${student.lastName}</td><td>${formatAvgCell(totalVals)}</td><td>${formatAvgCell(q1Vals)}</td><td>${formatAvgCell(q2Vals)}</td><td>${formatAvgCell(q3Vals)}</td><td>${formatAvgCell(q4Vals)}</td></tr>`,
        detailRow: expanded ? detailRows : ""
      };
    })
    .sort((a, b) => b.totalValue - a.totalValue || a.studentName.localeCompare(b.studentName));

  const studentRows = studentMetrics.flatMap((entry) => entry.detailRow ? [entry.row, entry.detailRow] : [entry.row]);
  if (studentMetrics.length) {
    const totals = {
      total: studentMetrics.filter((entry) => entry.totalVals.length).map((entry) => avg(entry.totalVals)),
      q1: studentMetrics.filter((entry) => entry.q1Vals.length).map((entry) => avg(entry.q1Vals)),
      q2: studentMetrics.filter((entry) => entry.q2Vals.length).map((entry) => avg(entry.q2Vals)),
      q3: studentMetrics.filter((entry) => entry.q3Vals.length).map((entry) => avg(entry.q3Vals)),
      q4: studentMetrics.filter((entry) => entry.q4Vals.length).map((entry) => avg(entry.q4Vals))
    };
    studentRows.push(`<tr><td><strong>Average</strong></td><td><strong>${formatAvgCell(totals.total)}</strong></td><td><strong>${formatAvgCell(totals.q1)}</strong></td><td><strong>${formatAvgCell(totals.q2)}</strong></td><td><strong>${formatAvgCell(totals.q3)}</strong></td><td><strong>${formatAvgCell(totals.q4)}</strong></td></tr>`);
  }
  rowOrEmpty(document.getElementById("student-avg-table"), studentRows, "No students added yet.", 6);

  const attendanceDatesThroughToday = dates.filter((d) => d <= todayISO());
  const attendanceDateSet = new Set(attendanceDatesThroughToday);
  const totalAttendanceDays = attendanceDatesThroughToday.length;
  const studentAttendanceRows = state.students.flatMap((student) => {
    const records = state.attendance.filter((a) => a.studentId === student.id && a.date <= todayISO() && attendanceDateSet.has(a.date));
    const presentCount = records.filter((a) => a.present).length;
    const absentCount = records.filter((a) => !a.present).length;
    const attendanceAverage = totalAttendanceDays > 0 ? (presentCount / totalAttendanceDays) * 100 : 0;
    const expandedAttendance = expandedStudentAttendanceRows.has(student.id);
    const studentRow = `<tr><td><button type="button" class="student-avg-toggle" data-toggle-student-attendance="${student.id}" aria-expanded="${expandedAttendance ? "true" : "false"}">${expandedAttendance ? "-" : "+"}</button> ${student.firstName} ${student.lastName}</td><td>${totalAttendanceDays}</td><td>${presentCount}</td><td>${absentCount}</td><td>${totalAttendanceDays > 0 ? `${attendanceAverage.toFixed(1)}%` : "No days yet"}</td></tr>`;
    if (!expandedAttendance) return [studentRow];

    const quarterRows = state.settings.quarters
      .map((quarter) => {
        const quarterDates = attendanceDatesThroughToday.filter((d) => inRange(d, quarter.startDate, quarter.endDate));
        const quarterDateSet = new Set(quarterDates);
        const quarterTotalDays = quarterDates.length;
        const quarterRecords = records.filter((a) => quarterDateSet.has(a.date));
        const quarterPresent = quarterRecords.filter((a) => a.present).length;
        const quarterAbsent = quarterRecords.filter((a) => !a.present).length;
        const quarterAverage = quarterTotalDays > 0 ? (quarterPresent / quarterTotalDays) * 100 : 0;
        return `<tr class="student-avg-detail-row"><td class="student-avg-subject-cell">${quarter.name}</td><td>${quarterTotalDays}</td><td>${quarterPresent}</td><td>${quarterAbsent}</td><td>${quarterTotalDays > 0 ? `${quarterAverage.toFixed(1)}%` : "No days yet"}</td></tr>`;
      });
    return [studentRow, ...quarterRows];
  });
  rowOrEmpty(document.getElementById("dashboard-student-attendance-table"), studentAttendanceRows, "No students added yet.", 5);
  renderGradeTrending();

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

function calendarEvents(rangeStart, rangeEnd, studentFilter) {
  const excluded = holidaySet();
  const events = [];
  state.plans.forEach((p) => {
    if (studentFilter && p.studentId !== studentFilter) return;
    const s = toDate(p.startDate), e = toDate(p.endDate);
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

function calendarDateStudentRows(rangeStart, rangeEnd, studentFilter) {
  const students = studentFilter
    ? state.students.filter((s) => s.id === studentFilter)
    : [...state.students];
  if (!students.length) return [];

  const rows = [];
  const rowByKey = new Map();
  const cursor = new Date(rangeStart);
  while (cursor <= rangeEnd) {
    const dateKey = toISO(cursor);
    students.forEach((student) => {
      const key = `${dateKey}||${student.id}`;
      const entry = {
        date: dateKey,
        studentId: student.id,
        subjects: new Map()
      };
      rows.push(entry);
      rowByKey.set(key, entry);
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  calendarEvents(rangeStart, rangeEnd, studentFilter).forEach((event) => {
    const course = getCourse(event.courseId);
    if (!course) return;
    const key = `${event.date}||${event.studentId}`;
    const row = rowByKey.get(key);
    if (!row) return;

    const subjectName = getSubjectName(course.subjectId);
    const current = row.subjects.get(subjectName) || { hours: 0, courses: new Set() };
    current.hours += Number(course.hoursPerDay || 0);
    current.courses.add(course.name);
    row.subjects.set(subjectName, current);
  });

  return rows;
}

function buildDailyStudentScheduleMap(rangeStart, rangeEnd, studentFilter) {
  const map = new Map();
  calendarDateStudentRows(rangeStart, rangeEnd, studentFilter).forEach((entry) => {
    const dateKey = entry.date;
    if (!map.has(dateKey)) map.set(dateKey, []);
    map.get(dateKey).push(entry);
  });
  return map;
}

function renderMonthCalendar(referenceISO, studentFilter) {
  const ref = toDate(referenceISO || todayISO());
  const monthStart = new Date(ref.getFullYear(), ref.getMonth(), 1, 12, 0, 0);
  const monthEnd = new Date(ref.getFullYear(), ref.getMonth() + 1, 0, 12, 0, 0);
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const gridEnd = new Date(gridStart);
  gridEnd.setDate(gridStart.getDate() + 41);

  const dailyMap = buildDailyStudentScheduleMap(gridStart, gridEnd, studentFilter);
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
      const subjectParts = Array.from(row.subjects.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([subjectName, data]) => `${subjectName} ${data.hours.toFixed(1)}h`);
      const body = subjectParts.length ? subjectParts.join(", ") : "-";
      return `<div class="calendar-day-item"><span class="name">${getStudentName(row.studentId)}</span><br>${body}</div>`;
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

function renderCalendar() {
  const view = document.getElementById("calendar-view").value;
  const ref = document.getElementById("calendar-date").value || todayISO();
  const studentFilter = document.getElementById("calendar-student").value;
  const monthView = document.getElementById("calendar-month-view");
  const listView = document.getElementById("calendar-list-wrap");

  if (view === "month") {
    monthView.classList.remove("hidden");
    listView.classList.add("hidden");
    const monthRange = renderMonthCalendar(ref, studentFilter);
    const monthStartIso = toISO(monthRange.start);
    const monthEndIso = toISO(monthRange.end);
    document.getElementById("calendar-range").textContent = `Monthly calendar: ${monthStartIso} to ${monthEndIso}`;
    return;
  }

  monthView.classList.add("hidden");
  listView.classList.remove("hidden");

  const range = viewRange(view, ref);
  document.getElementById("calendar-range").textContent = range.label;
  const rows = calendarDateStudentRows(range.start, range.end, studentFilter).slice(0, 5000).map((entry) => {
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
}

function bindEvents() {
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(`tab-${btn.dataset.tab}`).classList.add("active");
  }));

  document.getElementById("student-form").addEventListener("submit", (e) => {
    e.preventDefault();
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
    const name = document.getElementById("subject-name").value.trim();
    if (!name) return;
    if (state.subjects.some((s)=>s.name.toLowerCase()===name.toLowerCase())) { alert("Subject already exists."); return; }
    state.subjects.push({ id: uid(), name }); e.target.reset(); saveState(); renderAll();
  });

  document.getElementById("course-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const name = document.getElementById("course-name").value.trim();
    const subjectId = document.getElementById("course-subject").value;
    const hoursPerDay = Number(document.getElementById("course-hours").value);
    if (!name || !subjectId || Number.isNaN(hoursPerDay) || hoursPerDay <= 0) { alert("Provide course name, subject, and hours/day."); return; }
    state.courses.push({ id: uid(), name, subjectId, hoursPerDay }); e.target.reset(); saveState(); renderAll();
  });

  document.getElementById("student-enrollment-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const studentId = selectedStudentId;
    const courseId = document.getElementById("student-enroll-course").value;
    if (!studentId || !courseId) return;
    if (state.enrollments.some((x)=>x.studentId===studentId && x.courseId===courseId)) { alert("Student already enrolled in this course."); return; }
    state.enrollments.push({ id: uid(), studentId, courseId }); saveState(); renderAll();
  });

  document.getElementById("school-year-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const label = document.getElementById("school-year-label").value.trim();
    const startDate = document.getElementById("school-year-start").value;
    const endDate = document.getElementById("school-year-end").value;
    if (!label) { alert("School year label is required."); return; }
    if (!validRange(startDate, endDate)) { alert("School year range is invalid."); return; }
    const existing = state.settings.schoolYears.find((year) => year.id === editingSchoolYearId);
    if (existing) {
      existing.label = label;
      existing.startDate = startDate;
      existing.endDate = endDate;
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
    const schoolYearId = document.getElementById("quarter-school-year").value;
    if (!schoolYearId) { alert("Select a school year for these quarters."); return; }
    const q = [
      { id: uid(), schoolYearId, name: "Q1", startDate: document.getElementById("q1-start").value, endDate: document.getElementById("q1-end").value },
      { id: uid(), schoolYearId, name: "Q2", startDate: document.getElementById("q2-start").value, endDate: document.getElementById("q2-end").value },
      { id: uid(), schoolYearId, name: "Q3", startDate: document.getElementById("q3-start").value, endDate: document.getElementById("q3-end").value },
      { id: uid(), schoolYearId, name: "Q4", startDate: document.getElementById("q4-start").value, endDate: document.getElementById("q4-end").value }
    ];
    if (!q.every((x)=>validRange(x.startDate, x.endDate))) { alert("Each quarter needs a valid date range."); return; }
    state.settings.allQuarters = state.settings.allQuarters.filter((quarter) => quarter.schoolYearId !== schoolYearId);
    state.settings.allQuarters.push(...q);
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
    const name = document.getElementById("holiday-name").value.trim();
    const type = document.getElementById("holiday-type").value;
    const startDate = document.getElementById("holiday-start").value;
    const endDate = document.getElementById("holiday-end").value;
    if (!name || !validRange(startDate, endDate)) { alert("Provide valid holiday/break values."); return; }
    state.settings.holidays.push({ id: uid(), name, type, startDate, endDate }); e.target.reset(); saveState(); renderAll();
  });

  document.getElementById("plan-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const planType = document.getElementById("plan-type").value;
    const studentId = document.getElementById("plan-student").value;
    const courseId = document.getElementById("plan-course").value;
    const startDate = document.getElementById("plan-start").value;
    const endDate = document.getElementById("plan-end").value;
    const weekdays = Array.from(document.querySelectorAll("input[name='weekday']:checked")).map((x)=>Number(x.value));
    if (!studentId || !courseId || !validRange(startDate, endDate) || !weekdays.length) { alert("Plan must include student, course, valid range, and at least one weekday."); return; }
    state.plans.push({ id: uid(), planType, studentId, courseId, startDate, endDate, weekdays }); saveState(); renderAll();
  });

  document.getElementById("calendar-form").addEventListener("submit", (e) => { e.preventDefault(); renderCalendar(); });
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

  document.getElementById("attendance-form").addEventListener("submit", (e) => {
    e.preventDefault();
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
  ["attendance-filter-student", "attendance-filter-quarter"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", () => renderAttendance());
  });
  const studentDetailQuarterFilter = document.getElementById("student-detail-quarter-filter");
  if (studentDetailQuarterFilter) {
    studentDetailQuarterFilter.addEventListener("change", () => renderStudentDetail());
  }

  document.getElementById("add-grade-row-btn").addEventListener("click", () => {
    if (!state.students.length || !state.subjects.length || !state.courses.length) {
      alert("Add at least one student, subject, and course before entering grades.");
      return;
    }
    document.getElementById("grade-entry-body").appendChild(buildGradeEntryRow());
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
  ["trend-filter-quarter", "trend-filter-subject", "trend-filter-grade-type"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("change", () => renderGradeTrending());
  });

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
    if (t.classList.contains("grade-row-subject") || t.classList.contains("grade-row-student")) {
      const row = t.closest("tr");
      if (row) updateGradeRowCourses(row);
    }
  });

  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;

    const setCurrentSchoolYearId = t.getAttribute("data-set-current-school-year");
    if (setCurrentSchoolYearId) {
      setCurrentSchoolYear(setCurrentSchoolYearId);
      saveState();
      renderAll();
      return;
    }
    const editSchoolYearId = t.getAttribute("data-edit-school-year");
    if (editSchoolYearId) {
      beginSchoolYearEdit(editSchoolYearId);
      return;
    }
    const editQuartersYearId = t.getAttribute("data-edit-quarters-year");
    if (editQuartersYearId) {
      beginQuarterEdit(editQuartersYearId);
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
      const target = state.attendance.find((a) => a.id === editAttendanceId);
      if (!target) return;
      editingAttendanceId = target.id;
      renderAttendanceStudentChecklist([target.studentId]);
      document.getElementById("attendance-date").value = target.date;
      document.getElementById("attendance-status").value = target.present ? "present" : "absent";
      document.getElementById("attendance-submit-btn").textContent = "Update Attendance";
      document.getElementById("attendance-cancel-edit-btn").classList.remove("hidden");
      return;
    }

    const saveGrade = t.getAttribute("data-grade-save");
    if (saveGrade) {
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
      saveState();
      renderAll();
      return;
    }

    const cancelGrade = t.getAttribute("data-grade-cancel");
    if (cancelGrade) {
      const row = t.closest("tr");
      if (row) row.remove();
      return;
    }

    const openStudentId = t.getAttribute("data-open-student"); if (openStudentId) { selectedStudentId = openStudentId; renderAll(); return; }
    const editGradeId = t.getAttribute("data-edit-grade");
    if (editGradeId) {
      const existing = state.tests.find((x) => x.id === editGradeId);
      if (!existing) return;
      const entryBody = document.getElementById("grade-entry-body");
      const existingRow = entryBody.querySelector(`tr[data-edit-grade-id="${editGradeId}"]`);
      if (existingRow) {
        existingRow.scrollIntoView({ behavior: "smooth", block: "center" });
      } else {
        entryBody.prepend(buildGradeEntryRow(existing));
      }
      return;
    }
    const studentId = t.getAttribute("data-remove-student"); if (studentId) { removeStudent(studentId); saveState(); renderAll(); return; }
    const subjectId = t.getAttribute("data-remove-subject"); if (subjectId) { removeSubject(subjectId); saveState(); renderAll(); return; }
    const courseId = t.getAttribute("data-remove-course"); if (courseId) { removeCourse(courseId); saveState(); renderAll(); return; }
    const enrollmentId = t.getAttribute("data-remove-student-enrollment"); if (enrollmentId) { state.enrollments = state.enrollments.filter((x)=>x.id!==enrollmentId); saveState(); renderAll(); return; }
    const holidayId = t.getAttribute("data-remove-holiday"); if (holidayId) { state.settings.holidays = state.settings.holidays.filter((x)=>x.id!==holidayId); saveState(); renderAll(); return; }
    const planId = t.getAttribute("data-remove-plan"); if (planId) { state.plans = state.plans.filter((x)=>x.id!==planId); saveState(); renderAll(); }
  });
}

function renderAll() {
  renderSelects();
  fillSettingsForms();
  renderStudents();
  renderStudentDetail();
  renderSubjects();
  renderCourses();
  renderHolidays();
  renderPlanningSettings();
  renderPlans();
  renderAttendance();
  renderTests();
  renderDashboard();
  renderCalendar();
}

bindEvents();
renderAll();
