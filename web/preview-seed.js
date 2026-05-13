(() => {
  const STORAGE_KEY = "hsm_state_v2";
  const ACTIVE_ACADEMIC_YEAR_STORAGE_KEY = "hsm_active_academic_year_v1";
  const PREVIEW_SEED_BACKUP_KEY = "hsm_preview_seed_backup_v1";
  const PREVIEW_SEED_MARKER_KEY = "hsm_preview_seed_marker_v1";
  const PREVIEW_SEED_RELOAD_KEY = "hsm_preview_seed_reload_v1";
  const isLocalPreview = ["localhost", "127.0.0.1"].includes(window.location.hostname)
    && (window.location.port === "5500" || window.location.port === "");
  if (!isLocalPreview) return;

  const params = new URLSearchParams(window.location.search);
  const forceSeed = params.has("seedPreview") || params.has("resetPreviewSeed");
  const rawState = localStorage.getItem(STORAGE_KEY);

  function hasMeaningfulPreviewData(snapshot) {
    return snapshot
      && Array.isArray(snapshot.students)
      && Array.isArray(snapshot.subjects)
      && Array.isArray(snapshot.courses)
      && Array.isArray(snapshot.enrollments)
      && Array.isArray(snapshot.sectionEnrollments)
      && snapshot.students.length > 0
      && snapshot.subjects.length > 0
      && snapshot.courses.length > 0
      && (snapshot.enrollments.length > 0 || snapshot.sectionEnrollments.length > 0);
  }

  let existingState = null;
  try {
    existingState = rawState ? JSON.parse(rawState) : null;
  } catch {
    existingState = null;
  }

  if (!forceSeed && hasMeaningfulPreviewData(existingState)) return;
  if (rawState && !forceSeed && !localStorage.getItem(PREVIEW_SEED_BACKUP_KEY)) {
    localStorage.setItem(PREVIEW_SEED_BACKUP_KEY, rawState);
  }

  function legacyPasswordHash(password) {
    let hash = 0;
    const source = String(password || "");
    for (let i = 0; i < source.length; i += 1) {
      hash = ((hash << 5) - hash) + source.charCodeAt(i);
      hash |= 0;
    }
    return `legacy-${Math.abs(hash)}`;
  }

  function user(id, username, role, password, studentId = "") {
    return {
      id,
      username,
      role,
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      profilePhotoDataUrl: "",
      studentId,
      mustChangePassword: false,
      createdAt: "2026-05-13",
      updatedAt: "2026-05-13",
      passwordSalt: "",
      passwordHash: legacyPasswordHash(password)
    };
  }

  function course(id, name, subjectId, instructorId, hoursPerDay, weekdays = [1, 2, 3, 4, 5]) {
    return {
      id,
      name,
      subjectId,
      instructorId,
      hoursPerDay,
      exclusiveResource: false,
      resourceGroup: "",
      resourceCapacity: null,
      quarterNames: ["Q2"],
      weekdays,
      materials: []
    };
  }

  function enrollment(id, studentId, courseId, scheduleOrder) {
    return { id, studentId, courseId, scheduleOrder };
  }

  function plan(id, studentId, courseId, weekdays) {
    return {
      id,
      studentId,
      courseId,
      planType: "quarterly",
      quarterName: "Q2",
      startDate: "2026-04-01",
      endDate: "2026-06-30",
      weekdays
    };
  }

  function actual(id, studentId, courseId, status, actualMinutes, startMinutes) {
    return {
      id,
      studentId,
      courseId,
      instructorId: "",
      status,
      completed: status === "completed",
      date: "2026-05-13",
      actualMinutes,
      startMinutes,
      orderIndex: null
    };
  }

  function grade(id, date, studentId, subjectId, courseId, gradeType, testName, score, maxScore = 100) {
    return { id, date, studentId, subjectId, courseId, gradeType, testName, score, maxScore };
  }

  const schoolYearId = "preview-school-year-2026";
  const quarters = [
    { id: "preview-quarter-q1", schoolYearId, name: "Q1", startDate: "2026-01-01", endDate: "2026-03-31" },
    { id: "preview-quarter-q2", schoolYearId, name: "Q2", startDate: "2026-04-01", endDate: "2026-06-30" },
    { id: "preview-quarter-q3", schoolYearId, name: "Q3", startDate: "2026-07-01", endDate: "2026-09-30" },
    { id: "preview-quarter-q4", schoolYearId, name: "Q4", startDate: "2026-10-01", endDate: "2026-12-31" }
  ];
  const schoolYear = {
    id: schoolYearId,
    label: "2026",
    startDate: "2026-01-01",
    endDate: "2026-12-31",
    requiredInstructionalDays: 180,
    requiredInstructionalHours: 900,
    schoolDayStartTime: "08:00",
    minutesBetweenClasses: 5
  };

  const seedState = {
    students: [
      { id: "preview-student-penelope", firstName: "Penelope", lastName: "Mitchell", grade: "7", birthdate: "2012-10-12", archivedAt: "" },
      { id: "preview-student-pj", firstName: "PJ", lastName: "Mitchell", grade: "5", birthdate: "2014-03-08", archivedAt: "" },
      { id: "preview-student-nora", firstName: "Nora", lastName: "Reed", grade: "8", birthdate: "2011-07-22", archivedAt: "" }
    ],
    instructors: [
      { id: "preview-instructor-rebecca", firstName: "Rebecca", lastName: "Mitchell", birthdate: "1982-04-14", category: "parent", educationLevel: "bachelors_degree", ageRecorded: null },
      { id: "preview-instructor-daniel", firstName: "Daniel", lastName: "Mitchell", birthdate: "1980-08-19", category: "parent", educationLevel: "masters_degree", ageRecorded: null }
    ],
    subjects: [
      { id: "preview-subject-math", name: "Mathematics", required: true },
      { id: "preview-subject-language", name: "Language Arts", required: true },
      { id: "preview-subject-science", name: "Science", required: true },
      { id: "preview-subject-history", name: "History", required: true },
      { id: "preview-subject-bible", name: "Bible", required: true },
      { id: "preview-subject-art", name: "Art Studio", required: false }
    ],
    courses: [
      course("preview-course-math", "Algebra Readiness", "preview-subject-math", "preview-instructor-rebecca", 0.75),
      course("preview-course-language", "Literature and Composition", "preview-subject-language", "preview-instructor-rebecca", 0.75),
      course("preview-course-science", "General Science Lab", "preview-subject-science", "preview-instructor-daniel", 0.75, [1, 3, 5]),
      course("preview-course-history", "United States History", "preview-subject-history", "preview-instructor-daniel", 0.5),
      course("preview-course-bible", "Bible Survey", "preview-subject-bible", "preview-instructor-rebecca", 0.5),
      course("preview-course-art", "Watercolor Studio", "preview-subject-art", "preview-instructor-rebecca", 0.5, [3])
    ],
    courseSections: [
      { id: "preview-section-science-lab", courseId: "preview-course-science", label: "Wednesday Lab", resourceGroup: "Kitchen Table", concurrentCapacity: 4, startTime: "10:00", quarterNames: ["Q2"], weekdays: [3], scheduleOrder: null }
    ],
    enrollments: [
      enrollment("preview-enroll-penelope-math", "preview-student-penelope", "preview-course-math", 1),
      enrollment("preview-enroll-penelope-language", "preview-student-penelope", "preview-course-language", 2),
      enrollment("preview-enroll-penelope-history", "preview-student-penelope", "preview-course-history", 4),
      enrollment("preview-enroll-penelope-art", "preview-student-penelope", "preview-course-art", 5),
      enrollment("preview-enroll-pj-math", "preview-student-pj", "preview-course-math", 1),
      enrollment("preview-enroll-pj-language", "preview-student-pj", "preview-course-language", 2),
      enrollment("preview-enroll-pj-bible", "preview-student-pj", "preview-course-bible", 4),
      enrollment("preview-enroll-nora-math", "preview-student-nora", "preview-course-math", 1),
      enrollment("preview-enroll-nora-language", "preview-student-nora", "preview-course-language", 2),
      enrollment("preview-enroll-nora-science", "preview-student-nora", "preview-course-science", 3),
      enrollment("preview-enroll-nora-history", "preview-student-nora", "preview-course-history", 4),
      enrollment("preview-enroll-nora-bible", "preview-student-nora", "preview-course-bible", 5)
    ],
    sectionEnrollments: [
      { id: "preview-section-enroll-penelope-science", studentId: "preview-student-penelope", courseSectionId: "preview-section-science-lab", scheduleOrder: 3 },
      { id: "preview-section-enroll-pj-science", studentId: "preview-student-pj", courseSectionId: "preview-section-science-lab", scheduleOrder: 3 }
    ],
    scheduleBlocks: [
      { id: "preview-block-reading", name: "Independent Reading", type: "other_break", description: "Quiet reading and notebook cleanup", durationMinutes: 20, weekdays: [1, 2, 3, 4, 5] }
    ],
    studentScheduleBlocks: [
      { id: "preview-student-block-penelope-reading", studentId: "preview-student-penelope", scheduleBlockId: "preview-block-reading", scheduleOrder: 6 }
    ],
    plans: [
      plan("preview-plan-penelope-math", "preview-student-penelope", "preview-course-math", [1, 2, 3, 4, 5]),
      plan("preview-plan-penelope-language", "preview-student-penelope", "preview-course-language", [1, 2, 3, 4, 5]),
      plan("preview-plan-penelope-history", "preview-student-penelope", "preview-course-history", [1, 3, 5]),
      plan("preview-plan-penelope-art", "preview-student-penelope", "preview-course-art", [3]),
      plan("preview-plan-pj-math", "preview-student-pj", "preview-course-math", [1, 2, 3, 4, 5]),
      plan("preview-plan-pj-language", "preview-student-pj", "preview-course-language", [1, 2, 3, 4, 5]),
      plan("preview-plan-pj-bible", "preview-student-pj", "preview-course-bible", [1, 3, 5]),
      plan("preview-plan-nora-math", "preview-student-nora", "preview-course-math", [1, 2, 3, 4, 5]),
      plan("preview-plan-nora-language", "preview-student-nora", "preview-course-language", [1, 2, 3, 4, 5]),
      plan("preview-plan-nora-science", "preview-student-nora", "preview-course-science", [1, 3, 5]),
      plan("preview-plan-nora-history", "preview-student-nora", "preview-course-history", [1, 3, 5]),
      plan("preview-plan-nora-bible", "preview-student-nora", "preview-course-bible", [1, 3, 5])
    ],
    attendance: [
      { id: "preview-attendance-penelope-today", studentId: "preview-student-penelope", date: "2026-05-13", present: true },
      { id: "preview-attendance-nora-today", studentId: "preview-student-nora", date: "2026-05-13", present: false },
      { id: "preview-attendance-penelope-mon", studentId: "preview-student-penelope", date: "2026-05-11", present: true },
      { id: "preview-attendance-pj-mon", studentId: "preview-student-pj", date: "2026-05-11", present: true },
      { id: "preview-attendance-nora-mon", studentId: "preview-student-nora", date: "2026-05-11", present: true },
      { id: "preview-attendance-penelope-tue", studentId: "preview-student-penelope", date: "2026-05-12", present: true },
      { id: "preview-attendance-pj-tue", studentId: "preview-student-pj", date: "2026-05-12", present: false },
      { id: "preview-attendance-nora-tue", studentId: "preview-student-nora", date: "2026-05-12", present: true }
    ],
    instructionActuals: [
      actual("preview-actual-penelope-math", "preview-student-penelope", "preview-course-math", "completed", 45, 480),
      actual("preview-actual-penelope-language", "preview-student-penelope", "preview-course-language", "completed", 45, 530),
      actual("preview-actual-penelope-history", "preview-student-penelope", "preview-course-history", "excused", 30, 650),
      actual("preview-actual-penelope-art", "preview-student-penelope", "preview-course-art", "completed", 30, 760),
      actual("preview-actual-nora-math", "preview-student-nora", "preview-course-math", "completed", 45, 480),
      actual("preview-actual-nora-language", "preview-student-nora", "preview-course-language", "scheduled", 45, 530),
      actual("preview-actual-nora-history", "preview-student-nora", "preview-course-history", "completed", 30, 650)
    ],
    flexBlocks: [
      { id: "preview-flex-pj-project", studentId: "preview-student-pj", date: "2026-05-13", startMinutes: 795, endMinutes: 825, purpose: "Project Work" }
    ],
    tests: [
      grade("preview-grade-penelope-math", "2026-05-13", "preview-student-penelope", "preview-subject-math", "preview-course-math", "Assignment", "Linear Equations Practice", 96),
      grade("preview-grade-penelope-art", "2026-05-13", "preview-student-penelope", "preview-subject-art", "preview-course-art", "Project", "Color Wash Study", 100),
      grade("preview-grade-pj-math-low", "2026-05-11", "preview-student-pj", "preview-subject-math", "preview-course-math", "Quiz", "Fractions Checkpoint", 68),
      grade("preview-grade-pj-language-risk", "2026-05-12", "preview-student-pj", "preview-subject-language", "preview-course-language", "Assignment", "Narrative Paragraph", 72),
      grade("preview-grade-nora-science-low", "2026-05-12", "preview-student-nora", "preview-subject-science", "preview-course-science", "Test", "Cells and Systems", 78),
      grade("preview-grade-nora-history", "2026-05-13", "preview-student-nora", "preview-subject-history", "preview-course-history", "Quiz", "Founding Documents", 91)
    ],
    users: [
      user("default-admin-user", "admin", "admin", "ChangeMe123!"),
      user("preview-user-penelope", "penelope", "student", "Student123!", "preview-student-penelope"),
      user("preview-user-pj", "pj", "student", "Student123!", "preview-student-pj")
    ],
    settings: {
      schoolYear: { ...schoolYear },
      schoolYears: [{ ...schoolYear }],
      currentSchoolYearId: schoolYearId,
      quarters: quarters.map((quarter) => ({ ...quarter })),
      allQuarters: quarters.map((quarter) => ({ ...quarter })),
      dailyBreaks: [
        { id: "preview-break-lunch", schoolYearId, studentIds: ["preview-student-penelope", "preview-student-pj", "preview-student-nora"], type: "lunch", description: "Lunch", startTime: "12:00", durationMinutes: 30, weekdays: [1, 2, 3, 4, 5] },
        { id: "preview-break-recess", schoolYearId, studentIds: ["preview-student-pj"], type: "recess", description: "Outdoor break", startTime: "10:30", durationMinutes: 15, weekdays: [1, 3, 5] }
      ],
      holidays: [
        { id: "preview-holiday-spring-break", name: "Spring Break", type: "break", startDate: "2026-03-23", endDate: "2026-03-27" }
      ],
      gradeTypes: [
        { id: "preview-grade-type-assignment", name: "Assignment", weight: 35, iconKey: "assignment" },
        { id: "preview-grade-type-quiz", name: "Quiz", weight: 20, iconKey: "quiz" },
        { id: "preview-grade-type-test", name: "Test", weight: 30, iconKey: "exam" },
        { id: "preview-grade-type-project", name: "Project", weight: 15, iconKey: "project" }
      ],
      gradingCriteria: {
        letterScale: [
          { label: "A", start: 90, end: 100 },
          { label: "B", start: 80, end: 89 },
          { label: "C", start: 70, end: 79 },
          { label: "D", start: 60, end: 69 },
          { label: "F", start: 0, end: 59 }
        ],
        gpaScaleOption: "4",
        gpaMax: 4
      }
    }
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(seedState));
  localStorage.setItem(ACTIVE_ACADEMIC_YEAR_STORAGE_KEY, schoolYearId);
  localStorage.setItem(PREVIEW_SEED_MARKER_KEY, "2026-05-13-school-day-workflow");
  if (typeof window.HSM_REFRESH_PREVIEW_SEED === "function" && window.HSM_REFRESH_PREVIEW_SEED()) {
    sessionStorage.removeItem(PREVIEW_SEED_RELOAD_KEY);
    return;
  }
  if (!sessionStorage.getItem(PREVIEW_SEED_RELOAD_KEY)) {
    sessionStorage.setItem(PREVIEW_SEED_RELOAD_KEY, "1");
    window.location.reload();
  } else {
    sessionStorage.removeItem(PREVIEW_SEED_RELOAD_KEY);
  }
})();
