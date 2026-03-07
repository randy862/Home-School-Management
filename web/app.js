const STORAGE_KEY = "hsm_state_v2";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function uid() { return `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function toDate(s) { return new Date(`${s}T12:00:00`); }
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
  return {
    students: [], subjects: [], courses: [], enrollments: [], plans: [], attendance: [], tests: [],
    settings: {
      schoolYear: { label: `${y}-${y+1}`, startDate: `${y}-01-01`, endDate: `${y}-12-31` },
      quarters: [
        { name: "Q1", startDate: `${y}-01-01`, endDate: `${y}-03-31` },
        { name: "Q2", startDate: `${y}-04-01`, endDate: `${y}-06-30` },
        { name: "Q3", startDate: `${y}-07-01`, endDate: `${y}-09-30` },
        { name: "Q4", startDate: `${y}-10-01`, endDate: `${y}-12-31` }
      ],
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

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return validState(parsed) ? parsed : defaultState();
  } catch {
    return defaultState();
  }
}

let state = loadState();
function saveState() { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }

function getStudentName(id) { const s = state.students.find((x) => x.id === id); return s ? `${s.firstName} ${s.lastName}` : "Unknown Student"; }
function getSubjectName(id) { const s = state.subjects.find((x) => x.id === id); return s ? s.name : "Unknown Subject"; }
function getCourse(id) { return state.courses.find((x) => x.id === id) || null; }
function getCourseName(id) { const c = getCourse(id); return c ? c.name : "Unknown Course"; }

function inRange(date, startDate, endDate) { return date >= startDate && date <= endDate; }
function avg(vals){ return vals.length ? vals.reduce((a,b)=>a+b,0) / vals.length : 0; }
function pct(score, max) { const s = Number(score), m = Number(max); return m > 0 ? (s / m) * 100 : 0; }

function dateDiffDays(a, b){ return Math.floor((b - a) / (1000 * 60 * 60 * 24)); }
function progress(startDate, endDate, ref = new Date()) {
  const s = toDate(startDate), e = toDate(endDate);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime()) || e < s) return 0;
  if (ref < s) return 0;
  if (ref > e) return 100;
  return clamp(((dateDiffDays(s, ref) + 1) / (dateDiffDays(s, e) + 1)) * 100, 0, 100);
}

function currentQuarter(ref = new Date()) {
  const q = [...state.settings.quarters].sort((a,b)=>a.startDate.localeCompare(b.startDate));
  for (let i=0;i<q.length;i+=1) {
    if (ref >= toDate(q[i].startDate) && ref <= toDate(q[i].endDate)) return q[i];
  }
  return q[0] || null;
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
  options("enroll-course", state.courses, (c) => `${c.name} (${getSubjectName(c.subjectId)})`, state.courses.length ? null : "Add a course first");
  options("plan-course", state.courses, (c) => `${c.name} (${getSubjectName(c.subjectId)})`, state.courses.length ? null : "Add a course first");
  options("test-course", state.courses, (c) => `${c.name} (${getSubjectName(c.subjectId)})`, state.courses.length ? null : "Add a course first");
  options("enroll-student", state.students, (s) => `${s.firstName} ${s.lastName}`, state.students.length ? null : "Add a student first");
  options("plan-student", state.students, (s) => `${s.firstName} ${s.lastName}`, state.students.length ? null : "Add a student first");
  options("calendar-student", state.students, (s) => `${s.firstName} ${s.lastName}`, "All Students");
  options("attendance-student", state.students, (s) => `${s.firstName} ${s.lastName}`, state.students.length ? null : "Add a student first");
  options("test-student", state.students, (s) => `${s.firstName} ${s.lastName}`, state.students.length ? null : "Add a student first");
}

function rowOrEmpty(tbody, html, emptyMsg, cols) {
  tbody.innerHTML = "";
  if (!html.length) { tbody.innerHTML = `<tr><td colspan='${cols}'>${emptyMsg}</td></tr>`; return; }
  tbody.innerHTML = html.join("");
}
function renderStudents() {
  const rows = state.students.map((s) => {
    const ageNow = calculateAge(s.birthdate);
    return `<tr><td>${s.firstName} ${s.lastName}</td><td>${s.birthdate}</td><td>${s.grade}</td><td>${ageNow} (recorded ${s.ageRecorded})</td><td><button data-remove-student='${s.id}' type='button'>Remove</button></td></tr>`;
  });
  rowOrEmpty(document.getElementById("student-table"), rows, "No students added yet.", 5);
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

function renderEnrollments() {
  const list = document.getElementById("enrollment-list");
  list.innerHTML = "";
  if (!state.enrollments.length) { list.innerHTML = "<li><span>No enrollments added yet.</span></li>"; return; }
  list.innerHTML = state.enrollments.map((e) => `<li><span>${getStudentName(e.studentId)} -> ${getCourseName(e.courseId)}</span><button data-remove-enrollment='${e.id}' type='button'>Remove</button></li>`).join("");
}

function renderHolidays() {
  const list = document.getElementById("holiday-list");
  const rows = [...state.settings.holidays].sort((a,b)=>a.startDate.localeCompare(b.startDate));
  list.innerHTML = rows.length
    ? rows.map((h) => `<li><span>${h.name} (${h.type}) ${h.startDate} to ${h.endDate}</span><button data-remove-holiday='${h.id}' type='button'>Remove</button></li>`).join("")
    : "<li><span>No holidays/breaks defined.</span></li>";
}

function renderPlans() {
  const list = document.getElementById("plan-list");
  const rows = [...state.plans].sort((a,b)=>a.startDate.localeCompare(b.startDate));
  list.innerHTML = rows.length
    ? rows.map((p) => `<li><span>${p.planType.toUpperCase()} | ${getStudentName(p.studentId)} | ${getCourseName(p.courseId)} | ${p.startDate} to ${p.endDate} | ${p.weekdays.map((w)=>DAY_NAMES[w]).join(", ")}</span><button data-remove-plan='${p.id}' type='button'>Remove</button></li>`).join("")
    : "<li><span>No instruction plans defined.</span></li>";
}

function renderAttendance() {
  const rows = [...state.attendance]
    .sort((a,b)=>b.date.localeCompare(a.date))
    .slice(0,100)
    .map((a) => `<tr><td>${a.date}</td><td>${getStudentName(a.studentId)}</td><td>${a.present ? "Present" : "Absent"}</td></tr>`);
  rowOrEmpty(document.getElementById("attendance-table"), rows, "No attendance recorded yet.", 3);
}

function renderTests() {
  const rows = [...state.tests]
    .sort((a,b)=>b.date.localeCompare(a.date))
    .slice(0,150)
    .map((t) => `<tr><td>${t.date}</td><td>${getStudentName(t.studentId)}</td><td>${getSubjectName(t.subjectId)}</td><td>${getCourseName(t.courseId)}</td><td>${t.testName}</td><td>${pct(t.score,t.maxScore).toFixed(1)}%</td></tr>`);
  rowOrEmpty(document.getElementById("test-table"), rows, "No tests logged yet.", 6);
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

function renderDashboard() {
  const dates = instructionalDates();
  const dateSet = new Set(dates);
  const presentSet = new Set(state.attendance.filter((a) => a.present && a.date <= todayISO()).map((a) => a.date));
  const completeDays = Array.from(presentSet).filter((d) => dateSet.has(d)).length;
  const totalDays = dates.length;
  const hoursPerDay = state.courses.reduce((sum,c)=>sum + Number(c.hoursPerDay || 0), 0);

  document.getElementById("kpi-days-complete").textContent = String(completeDays);
  document.getElementById("kpi-days-total").textContent = String(totalDays);
  document.getElementById("kpi-hours-complete").textContent = (hoursPerDay * completeDays).toFixed(1);
  document.getElementById("kpi-hours-total").textContent = (hoursPerDay * totalDays).toFixed(1);

  const g = gradeAnalytics();
  document.getElementById("kpi-running-avg").textContent = `${g.running.toFixed(1)}%`;
  document.getElementById("kpi-quarter-avg").textContent = `${g.currentQuarterAvg.toFixed(1)}%`;

  const yP = progress(state.settings.schoolYear.startDate, state.settings.schoolYear.endDate);
  const q = currentQuarter(new Date());
  const qP = q ? progress(q.startDate, q.endDate) : 0;

  document.getElementById("year-progress-fill").style.width = `${yP.toFixed(1)}%`;
  document.getElementById("year-progress-text").textContent = `${state.settings.schoolYear.label}: ${yP.toFixed(1)}%`;
  document.getElementById("quarter-progress-fill").style.width = `${qP.toFixed(1)}%`;
  document.getElementById("quarter-progress-text").textContent = q ? `${q.name}: ${qP.toFixed(1)}%` : "No quarter set";

  rowOrEmpty(document.getElementById("student-avg-table"),
    g.student.sort((a,b)=>b.avg-a.avg).map((r)=>`<tr><td>${getStudentName(r.studentId)}</td><td>${r.avg.toFixed(1)}%</td><td>${r.count}</td></tr>`),
    "No graded tests yet.", 3);

  rowOrEmpty(document.getElementById("subject-avg-table"),
    g.subject.sort((a,b)=>b.avg-a.avg).map((r)=>`<tr><td>${getSubjectName(r.subjectId)}</td><td>${r.avg.toFixed(1)}%</td><td>${r.count}</td></tr>`),
    "No graded tests yet.", 3);

  const periodRows = g.quarterRows.map((qRow)=>`<tr><td>${qRow.label}</td><td>${qRow.avg.toFixed(1)}%</td><td>${qRow.count}</td></tr>`);
  periodRows.push(`<tr><td>Annual (${state.settings.schoolYear.label})</td><td>${g.annualAvg.toFixed(1)}%</td><td>${g.annualCount}</td></tr>`);
  rowOrEmpty(document.getElementById("period-avg-table"), periodRows, "No period data.", 3);
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

function renderCalendar() {
  const view = document.getElementById("calendar-view").value;
  const ref = document.getElementById("calendar-date").value || todayISO();
  const studentFilter = document.getElementById("calendar-student").value;
  const range = viewRange(view, ref);
  document.getElementById("calendar-range").textContent = range.label;
  const rows = calendarEvents(range.start, range.end, studentFilter).slice(0,3000).map((e) => {
    const c = getCourse(e.courseId);
    const subject = c ? getSubjectName(c.subjectId) : "Unknown Subject";
    return `<tr><td>${e.date}</td><td>${getStudentName(e.studentId)}</td><td>${subject}</td><td>${getCourseName(e.courseId)}</td><td>${e.planType}</td></tr>`;
  });
  rowOrEmpty(document.getElementById("calendar-table"), rows, "No scheduled courses for this view.", 5);
}

function fillSettingsForms() {
  document.getElementById("school-year-label").value = state.settings.schoolYear.label;
  document.getElementById("school-year-start").value = state.settings.schoolYear.startDate;
  document.getElementById("school-year-end").value = state.settings.schoolYear.endDate;
  const q = state.settings.quarters;
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
  if (!document.getElementById("test-date").value) document.getElementById("test-date").value = todayISO();
}

function validRange(startDate, endDate) { return startDate && endDate && toDate(endDate) >= toDate(startDate); }

function removeStudent(id) {
  state.students = state.students.filter((s)=>s.id!==id);
  state.enrollments = state.enrollments.filter((e)=>e.studentId!==id);
  state.plans = state.plans.filter((p)=>p.studentId!==id);
  state.attendance = state.attendance.filter((a)=>a.studentId!==id);
  state.tests = state.tests.filter((t)=>t.studentId!==id);
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

  document.getElementById("enrollment-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const studentId = document.getElementById("enroll-student").value;
    const courseId = document.getElementById("enroll-course").value;
    if (!studentId || !courseId) return;
    if (state.enrollments.some((x)=>x.studentId===studentId && x.courseId===courseId)) { alert("Student already enrolled in this course."); return; }
    state.enrollments.push({ id: uid(), studentId, courseId }); saveState(); renderAll();
  });

  document.getElementById("school-year-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const label = document.getElementById("school-year-label").value.trim();
    const startDate = document.getElementById("school-year-start").value;
    const endDate = document.getElementById("school-year-end").value;
    if (!validRange(startDate, endDate)) { alert("School year range is invalid."); return; }
    state.settings.schoolYear = { label, startDate, endDate }; saveState(); renderAll();
  });

  document.getElementById("quarters-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const q = [
      { name: "Q1", startDate: document.getElementById("q1-start").value, endDate: document.getElementById("q1-end").value },
      { name: "Q2", startDate: document.getElementById("q2-start").value, endDate: document.getElementById("q2-end").value },
      { name: "Q3", startDate: document.getElementById("q3-start").value, endDate: document.getElementById("q3-end").value },
      { name: "Q4", startDate: document.getElementById("q4-start").value, endDate: document.getElementById("q4-end").value }
    ];
    if (!q.every((x)=>validRange(x.startDate, x.endDate))) { alert("Each quarter needs a valid date range."); return; }
    state.settings.quarters = q; saveState(); renderAll();
  });

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

  document.getElementById("attendance-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const studentId = document.getElementById("attendance-student").value;
    const date = document.getElementById("attendance-date").value;
    const status = document.getElementById("attendance-status").value;
    if (!studentId || !date) return;
    const existing = state.attendance.find((a)=>a.studentId===studentId && a.date===date);
    if (existing) existing.present = status === "present";
    else state.attendance.push({ id: uid(), studentId, date, present: status === "present" });
    saveState(); renderAll();
  });

  document.getElementById("test-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const date = document.getElementById("test-date").value;
    const studentId = document.getElementById("test-student").value;
    const subjectId = document.getElementById("test-subject").value;
    const courseId = document.getElementById("test-course").value;
    const testName = document.getElementById("test-name").value.trim();
    const score = Number(document.getElementById("test-score").value);
    const maxScore = Number(document.getElementById("test-max").value);
    if (!date || !studentId || !subjectId || !courseId || !testName || Number.isNaN(score) || Number.isNaN(maxScore)) { alert("Complete all test fields."); return; }
    if (maxScore <= 0 || score < 0 || score > maxScore) { alert("Score must be between 0 and max score."); return; }
    state.tests.push({ id: uid(), date, studentId, subjectId, courseId, testName, score, maxScore });
    e.target.reset(); document.getElementById("test-date").value = todayISO(); saveState(); renderAll();
  });

  document.getElementById("test-subject").addEventListener("change", () => {
    const subjectId = document.getElementById("test-subject").value;
    const sel = document.getElementById("test-course");
    const courses = subjectId ? state.courses.filter((c)=>c.subjectId===subjectId) : state.courses;
    sel.innerHTML = "";
    courses.forEach((c) => { const o = document.createElement("option"); o.value = c.id; o.textContent = c.name; sel.appendChild(o); });
  });

  document.addEventListener("click", (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const studentId = t.getAttribute("data-remove-student"); if (studentId) { removeStudent(studentId); saveState(); renderAll(); return; }
    const subjectId = t.getAttribute("data-remove-subject"); if (subjectId) { removeSubject(subjectId); saveState(); renderAll(); return; }
    const courseId = t.getAttribute("data-remove-course"); if (courseId) { removeCourse(courseId); saveState(); renderAll(); return; }
    const enrollmentId = t.getAttribute("data-remove-enrollment"); if (enrollmentId) { state.enrollments = state.enrollments.filter((x)=>x.id!==enrollmentId); saveState(); renderAll(); return; }
    const holidayId = t.getAttribute("data-remove-holiday"); if (holidayId) { state.settings.holidays = state.settings.holidays.filter((x)=>x.id!==holidayId); saveState(); renderAll(); return; }
    const planId = t.getAttribute("data-remove-plan"); if (planId) { state.plans = state.plans.filter((x)=>x.id!==planId); saveState(); renderAll(); }
  });
}

function renderAll() {
  renderSelects();
  fillSettingsForms();
  renderStudents();
  renderSubjects();
  renderCourses();
  renderEnrollments();
  renderHolidays();
  renderPlans();
  renderAttendance();
  renderTests();
  renderDashboard();
  renderCalendar();
}

bindEvents();
renderAll();
