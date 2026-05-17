const DEFAULT_LETTER_GRADE_SCALE = [
  { label: "A", start: 90, end: 100 },
  { label: "B", start: 80, end: 89 },
  { label: "C", start: 70, end: 79 },
  { label: "D", start: 60, end: 69 },
  { label: "F", start: 0, end: 59 }
];

async function buildCustomerExportPackage(client, environment, archiveId, job) {
  const schema = String(environment.databaseSchema || "").trim();
  if (!schema) {
    const error = new Error("Tenant database schema is required for data export.");
    error.code = "tenant_schema_missing";
    throw error;
  }

  const data = await fetchCustomerExportData(client, schema);
  const generatedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + (7 * 24 * 60 * 60 * 1000)).toISOString();
  const context = buildExportContext({
    data,
    environment,
    archiveId,
    exportRequestId: job.payload?.exportRequestId || null,
    generatedAt,
    expiresAt
  });
  const files = buildCustomerExportFiles(context);
  return {
    buffer: createZipArchive(files),
    contentType: "application/zip",
    extension: "zip",
    expiresAt,
    rowCounts: Object.fromEntries(files.map((file) => [file.name, file.rowCount ?? null]))
  };
}

async function fetchCustomerExportData(client, schema) {
  const q = (table) => `${quoteIdentifier(schema)}.${quoteIdentifier(table)}`;
  const students = await client.query(`
      SELECT
        id,
        first_name AS "firstName",
        last_name AS "lastName",
        birthdate,
        grade,
        archived_at AS "archivedAt"
      FROM ${q("students")}
      ORDER BY lower(last_name), lower(first_name), id
    `);
  const subjects = await client.query(`
      SELECT id, name, required
      FROM ${q("subjects")}
      ORDER BY lower(name), id
    `);
  const schoolYears = await client.query(`
      SELECT
        id,
        label,
        start_date AS "startDate",
        end_date AS "endDate",
        required_instructional_days AS "requiredInstructionalDays",
        required_instructional_hours AS "requiredInstructionalHours",
        is_current AS "isCurrent"
      FROM ${q("school_years")}
      ORDER BY start_date, id
    `);
  const quarters = await client.query(`
      SELECT
        id,
        school_year_id AS "schoolYearId",
        name,
        start_date AS "startDate",
        end_date AS "endDate"
      FROM ${q("quarters")}
      ORDER BY start_date, id
    `);
  const courses = await client.query(`
      SELECT
        id,
        name,
        subject_id AS "subjectId",
        hours_per_day AS "hoursPerDay",
        quarter_names_json AS "quarterNames",
        weekdays_json AS "weekdays"
      FROM ${q("courses")}
      ORDER BY lower(name), id
    `);
  const enrollments = await client.query(`
      SELECT
        id,
        student_id AS "studentId",
        course_id AS "courseId",
        schedule_order AS "scheduleOrder"
      FROM ${q("enrollments")}
      ORDER BY schedule_order NULLS LAST, id
    `);
  const attendance = await client.query(`
      SELECT
        id,
        student_id AS "studentId",
        attendance_date AS "date",
        present
      FROM ${q("attendance")}
      ORDER BY attendance_date, student_id, id
    `);
  const tests = await client.query(`
      SELECT
        id,
        test_date AS "date",
        student_id AS "studentId",
        subject_id AS "subjectId",
        course_id AS "courseId",
        grade_type AS "gradeType",
        test_name AS "testName",
        score,
        max_score AS "maxScore"
      FROM ${q("tests")}
      ORDER BY test_date, student_id, course_id, id
    `);
  const gradeTypes = await client.query(`
      SELECT id, name, weight
      FROM ${q("grade_types")}
      ORDER BY lower(name), id
    `);
  const gradingCriteria = await client.query(`
      SELECT
        letter_scale_json AS "letterScale",
        gpa_scale_option AS "gpaScaleOption",
        gpa_max AS "gpaMax"
      FROM ${q("grading_criteria")}
      ORDER BY id
      LIMIT 1
    `);

  return {
    students: students.rows,
    subjects: subjects.rows,
    schoolYears: schoolYears.rows,
    quarters: quarters.rows,
    courses: courses.rows,
    enrollments: enrollments.rows,
    attendance: attendance.rows.map((row) => ({ ...row, present: !!row.present })),
    tests: tests.rows.map((row) => ({
      ...row,
      score: Number(row.score || 0),
      maxScore: Number(row.maxScore || 0)
    })),
    gradeTypes: gradeTypes.rows.map((row) => ({
      ...row,
      weight: row.weight == null ? null : Number(row.weight)
    })),
    gradingCriteria: gradingCriteria.rows[0] || {
      letterScale: [],
      gpaScaleOption: "4",
      gpaMax: 4
    }
  };
}

function buildExportContext(input) {
  const data = input.data;
  const studentById = new Map(data.students.map((student) => [student.id, student]));
  const subjectById = new Map(data.subjects.map((subject) => [subject.id, subject]));
  const courseById = new Map(data.courses.map((course) => [course.id, course]));
  const schoolYearById = new Map(data.schoolYears.map((year) => [year.id, year]));
  const quartersBySchoolYear = groupBy(data.quarters, (quarter) => quarter.schoolYearId || "");
  const letterScale = effectiveLetterGradeScale(data.gradingCriteria);
  const gpaMax = currentGpaMax(data.gradingCriteria);

  return {
    ...input,
    studentById,
    subjectById,
    courseById,
    schoolYearById,
    quartersBySchoolYear,
    letterScale,
    gpaMax,
    studentName: (studentId) => formatStudentName(studentById.get(studentId)),
    subjectName: (subjectId) => subjectById.get(subjectId)?.name || "",
    courseName: (courseId) => courseById.get(courseId)?.name || ""
  };
}

function buildCustomerExportFiles(context) {
  const files = [];
  const addCsv = (name, headers, rows) => {
    files.push({
      name: `records/${name}`,
      content: csv(headers, rows),
      rowCount: rows.length
    });
  };

  const studentRows = buildStudentRows(context);
  const schoolYearRows = buildSchoolYearRows(context);
  const courseRows = buildCourseRows(context);
  const attendanceDetailRows = buildAttendanceDetailRows(context);
  const attendanceSummaryRows = buildAttendanceSummaryRows(context);
  const gradeDetailRows = buildGradeDetailRows(context);
  const courseGradeRows = buildCourseGradeRows(context);
  const quarterAverageRows = buildPeriodAverageRows(context, "quarter");
  const yearAverageRows = buildPeriodAverageRows(context, "year");
  const transcriptRows = courseGradeRows.filter((row) => row["Period Type"] === "School Year");
  const gradeScaleRows = buildGradeScaleRows(context);

  addCsv("students.csv", [
    "Student",
    "First Name",
    "Last Name",
    "Grade Level",
    "Birthdate",
    "Status"
  ], studentRows);
  addCsv("school-years.csv", [
    "School Year",
    "Start Date",
    "End Date",
    "Required Instructional Days",
    "Required Instructional Hours",
    "Current"
  ], schoolYearRows);
  addCsv("courses.csv", [
    "Course",
    "Subject",
    "Required Subject",
    "Hours Per Day",
    "Scheduled Quarters",
    "Scheduled Weekdays",
    "Enrolled Students"
  ], courseRows);
  addCsv("attendance-by-day.csv", [
    "Student",
    "Date",
    "Status",
    "School Year",
    "Quarter"
  ], attendanceDetailRows);
  addCsv("attendance-summary.csv", [
    "Student",
    "School Year",
    "Period Type",
    "Period",
    "Present Days",
    "Absent Days",
    "Recorded Days"
  ], attendanceSummaryRows);
  addCsv("assignments-and-tests.csv", [
    "Student",
    "Date",
    "School Year",
    "Quarter",
    "Subject",
    "Course",
    "Grade Type",
    "Name",
    "Score",
    "Max Score",
    "Percent",
    "Letter Grade"
  ], gradeDetailRows);
  addCsv("course-grades.csv", [
    "Student",
    "School Year",
    "Period Type",
    "Period",
    "Subject",
    "Course",
    "Grade Count",
    "Average Percent",
    "Letter Grade",
    "GPA"
  ], courseGradeRows);
  addCsv("quarter-averages.csv", [
    "Student",
    "School Year",
    "Quarter",
    "Grade Count",
    "Average Percent",
    "Letter Grade",
    "GPA",
    "Present Days",
    "Absent Days"
  ], quarterAverageRows);
  addCsv("year-averages.csv", [
    "Student",
    "School Year",
    "Grade Count",
    "Average Percent",
    "Letter Grade",
    "GPA",
    "Present Days",
    "Absent Days"
  ], yearAverageRows);
  addCsv("transcript-summary.csv", [
    "Student",
    "School Year",
    "Subject",
    "Course",
    "Grade Count",
    "Final Average Percent",
    "Final Letter Grade",
    "Final GPA"
  ], transcriptRows.map((row) => ({
    "Student": row["Student"],
    "School Year": row["School Year"],
    "Subject": row["Subject"],
    "Course": row["Course"],
    "Grade Count": row["Grade Count"],
    "Final Average Percent": row["Average Percent"],
    "Final Letter Grade": row["Letter Grade"],
    "Final GPA": row["GPA"]
  })));
  addCsv("grade-scale.csv", [
    "Letter Grade",
    "Start Percent",
    "End Percent",
    "GPA Scale Max"
  ], gradeScaleRows);

  const manifest = {
    format: "navigrader-parent-records-export",
    version: 2,
    generatedAt: context.generatedAt,
    expiresAt: context.expiresAt,
    exportRequestId: context.exportRequestId,
    archiveId: context.archiveId,
    tenant: {
      id: context.environment.tenantId,
      slug: context.environment.tenantSlug,
      displayName: context.environment.tenantDisplayName
    },
    files: files.map((file) => ({
      name: file.name,
      rowCount: file.rowCount
    }))
  };

  return [
    {
      name: "README.txt",
      content: buildReadme(context),
      rowCount: null
    },
    {
      name: "manifest.json",
      content: `${JSON.stringify(manifest, null, 2)}\n`,
      rowCount: null
    },
    ...files
  ];
}

function buildStudentRows(context) {
  return context.data.students.map((student) => ({
    "Student": formatStudentName(student),
    "First Name": student.firstName || "",
    "Last Name": student.lastName || "",
    "Grade Level": student.grade || "",
    "Birthdate": formatDate(student.birthdate),
    "Status": student.archivedAt ? "Archived" : "Active"
  }));
}

function buildSchoolYearRows(context) {
  return context.data.schoolYears.map((year) => ({
    "School Year": year.label || "",
    "Start Date": formatDate(year.startDate),
    "End Date": formatDate(year.endDate),
    "Required Instructional Days": numberOrBlank(year.requiredInstructionalDays, 0),
    "Required Instructional Hours": numberOrBlank(year.requiredInstructionalHours, 1),
    "Current": year.isCurrent ? "Yes" : "No"
  }));
}

function buildCourseRows(context) {
  const enrolledNamesByCourse = new Map();
  context.data.enrollments.forEach((enrollment) => {
    if (!enrolledNamesByCourse.has(enrollment.courseId)) enrolledNamesByCourse.set(enrollment.courseId, []);
    enrolledNamesByCourse.get(enrollment.courseId).push(context.studentName(enrollment.studentId));
  });
  return context.data.courses.map((course) => {
    const subject = context.subjectById.get(course.subjectId);
    return {
      "Course": course.name || "",
      "Subject": subject?.name || "",
      "Required Subject": subject?.required ? "Yes" : "No",
      "Hours Per Day": numberOrBlank(course.hoursPerDay, 2),
      "Scheduled Quarters": listValue(course.quarterNames),
      "Scheduled Weekdays": weekdayNames(course.weekdays),
      "Enrolled Students": listValue(enrolledNamesByCourse.get(course.id) || [])
    };
  });
}

function buildAttendanceDetailRows(context) {
  return context.data.attendance.map((record) => {
    const period = periodForDate(context, record.date);
    return {
      "Student": context.studentName(record.studentId),
      "Date": formatDate(record.date),
      "Status": record.present ? "Present" : "Absent",
      "School Year": period.schoolYear?.label || "",
      "Quarter": period.quarter?.name || ""
    };
  });
}

function buildAttendanceSummaryRows(context) {
  const rows = [];
  context.data.students.forEach((student) => {
    context.data.schoolYears.forEach((year) => {
      rows.push(buildAttendanceSummaryRow(context, student, year, null));
      (context.quartersBySchoolYear.get(year.id) || []).forEach((quarter) => {
        rows.push(buildAttendanceSummaryRow(context, student, year, quarter));
      });
    });
  });
  return rows.filter((row) => Number(row["Recorded Days"]) > 0);
}

function buildAttendanceSummaryRow(context, student, year, quarter) {
  const startDate = quarter ? quarter.startDate : year.startDate;
  const endDate = quarter ? quarter.endDate : year.endDate;
  const records = context.data.attendance.filter((record) =>
    record.studentId === student.id && inRange(record.date, startDate, endDate));
  const present = records.filter((record) => record.present).length;
  const absent = records.filter((record) => !record.present).length;
  return {
    "Student": formatStudentName(student),
    "School Year": year.label || "",
    "Period Type": quarter ? "Quarter" : "School Year",
    "Period": quarter?.name || year.label || "",
    "Present Days": present,
    "Absent Days": absent,
    "Recorded Days": records.length
  };
}

function buildGradeDetailRows(context) {
  return context.data.tests.map((test) => {
    const period = periodForDate(context, test.date);
    const subject = context.subjectById.get(test.subjectId) || context.subjectById.get(context.courseById.get(test.courseId)?.subjectId);
    const percent = pct(test.score, test.maxScore);
    return {
      "Student": context.studentName(test.studentId),
      "Date": formatDate(test.date),
      "School Year": period.schoolYear?.label || "",
      "Quarter": period.quarter?.name || "",
      "Subject": subject?.name || "",
      "Course": context.courseName(test.courseId),
      "Grade Type": gradeTypeName(test),
      "Name": test.testName || "",
      "Score": numberOrBlank(test.score, 2),
      "Max Score": numberOrBlank(test.maxScore, 2),
      "Percent": formatAverage(percent),
      "Letter Grade": scoreToLetterGrade(percent, context.letterScale)
    };
  });
}

function buildCourseGradeRows(context) {
  const rows = [];
  const studentCoursePairs = uniqueStudentCoursePairs(context);
  context.data.schoolYears.forEach((year) => {
    studentCoursePairs.forEach(({ studentId, courseId }) => {
      const yearTests = testsFor(context, { studentId, courseId, startDate: year.startDate, endDate: year.endDate });
      if (yearTests.length) rows.push(courseGradeRow(context, studentId, courseId, year, null, yearTests));
      (context.quartersBySchoolYear.get(year.id) || []).forEach((quarter) => {
        const quarterTests = testsFor(context, { studentId, courseId, startDate: quarter.startDate, endDate: quarter.endDate });
        if (quarterTests.length) rows.push(courseGradeRow(context, studentId, courseId, year, quarter, quarterTests));
      });
    });
  });
  return rows;
}

function courseGradeRow(context, studentId, courseId, year, quarter, tests) {
  const course = context.courseById.get(courseId);
  const subject = context.subjectById.get(course?.subjectId);
  const average = weightedAverageForTests(tests, context.data.gradeTypes, { quarterScoped: !!quarter });
  return {
    "Student": context.studentName(studentId),
    "School Year": year.label || "",
    "Period Type": quarter ? "Quarter" : "School Year",
    "Period": quarter?.name || year.label || "",
    "Subject": subject?.name || "",
    "Course": course?.name || "",
    "Grade Count": tests.length,
    "Average Percent": formatAverage(average),
    "Letter Grade": scoreToLetterGrade(average, context.letterScale),
    "GPA": formatGpa(average, context.gpaMax)
  };
}

function buildPeriodAverageRows(context, mode) {
  const rows = [];
  context.data.students.forEach((student) => {
    context.data.schoolYears.forEach((year) => {
      if (mode === "year") {
        const tests = testsFor(context, { studentId: student.id, startDate: year.startDate, endDate: year.endDate });
        if (!tests.length) return;
        const attendance = attendanceCounts(context, student.id, year.startDate, year.endDate);
        const average = weightedAverageForTests(tests, context.data.gradeTypes);
        rows.push({
          "Student": formatStudentName(student),
          "School Year": year.label || "",
          "Grade Count": tests.length,
          "Average Percent": formatAverage(average),
          "Letter Grade": scoreToLetterGrade(average, context.letterScale),
          "GPA": formatGpa(average, context.gpaMax),
          "Present Days": attendance.present,
          "Absent Days": attendance.absent
        });
        return;
      }
      (context.quartersBySchoolYear.get(year.id) || []).forEach((quarter) => {
        const tests = testsFor(context, { studentId: student.id, startDate: quarter.startDate, endDate: quarter.endDate });
        if (!tests.length) return;
        const attendance = attendanceCounts(context, student.id, quarter.startDate, quarter.endDate);
        const average = weightedAverageForTests(tests, context.data.gradeTypes, { quarterScoped: true });
        rows.push({
          "Student": formatStudentName(student),
          "School Year": year.label || "",
          "Quarter": quarter.name || "",
          "Grade Count": tests.length,
          "Average Percent": formatAverage(average),
          "Letter Grade": scoreToLetterGrade(average, context.letterScale),
          "GPA": formatGpa(average, context.gpaMax),
          "Present Days": attendance.present,
          "Absent Days": attendance.absent
        });
      });
    });
  });
  return rows;
}

function buildGradeScaleRows(context) {
  return context.letterScale.map((entry) => ({
    "Letter Grade": entry.label,
    "Start Percent": entry.start,
    "End Percent": entry.end,
    "GPA Scale Max": context.gpaMax
  }));
}

function buildReadme(context) {
  const tenantName = context.environment.tenantDisplayName || context.environment.tenantSlug || "Navigrader";
  return [
    `${tenantName} Records Export`,
    "",
    `Generated: ${context.generatedAt}`,
    `Expires: ${context.expiresAt}`,
    "",
    "This package is designed for homeschool record keeping. The CSV files can be opened in Excel, Google Sheets, Numbers, or LibreOffice.",
    "",
    "Included files:",
    "- records/students.csv: student roster and active/archive status.",
    "- records/school-years.csv: configured school years and requirements.",
    "- records/courses.csv: course catalog and enrolled students.",
    "- records/attendance-by-day.csv: day-by-day attendance records.",
    "- records/attendance-summary.csv: present/absent totals by school year and quarter.",
    "- records/assignments-and-tests.csv: detailed grade records.",
    "- records/course-grades.csv: course averages by school year and quarter.",
    "- records/quarter-averages.csv: student quarter averages with attendance totals.",
    "- records/year-averages.csv: student year averages with attendance totals.",
    "- records/transcript-summary.csv: full-year course averages suitable for transcript review.",
    "- records/grade-scale.csv: grading scale used for letter grades and GPA conversion.",
    "",
    "Notes:",
    "- Percent and GPA values are calculated from the records available at export time.",
    "- Attendance reflects the present/absent statuses currently tracked in Navigrader.",
    "- This export avoids internal authentication and system tables.",
    ""
  ].join("\n");
}

function testsFor(context, filter) {
  return context.data.tests.filter((test) => {
    if (filter.studentId && test.studentId !== filter.studentId) return false;
    if (filter.courseId && test.courseId !== filter.courseId) return false;
    return inRange(test.date, filter.startDate, filter.endDate);
  });
}

function uniqueStudentCoursePairs(context) {
  const pairs = new Map();
  context.data.enrollments.forEach((enrollment) => {
    if (!enrollment.studentId || !enrollment.courseId) return;
    pairs.set(`${enrollment.studentId}||${enrollment.courseId}`, {
      studentId: enrollment.studentId,
      courseId: enrollment.courseId
    });
  });
  context.data.tests.forEach((test) => {
    if (!test.studentId || !test.courseId) return;
    pairs.set(`${test.studentId}||${test.courseId}`, {
      studentId: test.studentId,
      courseId: test.courseId
    });
  });
  return Array.from(pairs.values());
}

function attendanceCounts(context, studentId, startDate, endDate) {
  const records = context.data.attendance.filter((record) =>
    record.studentId === studentId && inRange(record.date, startDate, endDate));
  return {
    present: records.filter((record) => record.present).length,
    absent: records.filter((record) => !record.present).length
  };
}

function periodForDate(context, value) {
  const date = formatDate(value);
  const schoolYear = context.data.schoolYears.find((year) => inRange(date, year.startDate, year.endDate)) || null;
  const quarter = context.data.quarters.find((entry) =>
    (!schoolYear || entry.schoolYearId === schoolYear.id) && inRange(date, entry.startDate, entry.endDate)) || null;
  return { schoolYear, quarter };
}

function weightedAverageForTests(tests, gradeTypes, options = {}) {
  if (!tests.length) return null;
  const byType = new Map();
  tests.forEach((test) => {
    const type = gradeTypeName(test);
    const score = pct(test.score, test.maxScore);
    if (!byType.has(type)) byType.set(type, []);
    byType.get(type).push(score);
  });
  const typeAverages = Array.from(byType.entries()).map(([type, values]) => ({ type, avg: avg(values) }));
  const weightedConfigured = (Array.isArray(gradeTypes) ? gradeTypes : [])
    .filter((entry) => entry.weight != null && Number(entry.weight) > 0)
    .map((entry) => ({ name: entry.name, weight: Number(entry.weight) }));
  if (!weightedConfigured.length) return avg(typeAverages.map((entry) => entry.avg));

  const weightByType = new Map(weightedConfigured.map((entry) => [String(entry.name || "").toLowerCase(), entry.weight]));
  const presentTypes = new Set(typeAverages.map((entry) => entry.type.toLowerCase()));
  const effectiveWeightByType = new Map();
  typeAverages.forEach((entry) => {
    const key = entry.type.toLowerCase();
    if (weightByType.has(key)) effectiveWeightByType.set(key, weightByType.get(key) || 0);
  });

  if (options.quarterScoped && presentTypes.has("assignment")) {
    let rolloverWeight = 0;
    ["quiz", "test", "quarterly final"].forEach((typeKey) => {
      if (!presentTypes.has(typeKey)) rolloverWeight += weightByType.get(typeKey) || 0;
    });
    effectiveWeightByType.set("assignment", (effectiveWeightByType.get("assignment") || 0) + rolloverWeight);
  }

  const withWeights = typeAverages.filter((entry) => effectiveWeightByType.has(entry.type.toLowerCase()));
  const withoutWeights = typeAverages.filter((entry) => !effectiveWeightByType.has(entry.type.toLowerCase()));
  let assignedTotalWeight = withWeights.reduce((sum, entry) => sum + (effectiveWeightByType.get(entry.type.toLowerCase()) || 0), 0);
  let remainingShare = 0;
  if (withoutWeights.length) {
    const remaining = Math.max(0, 100 - assignedTotalWeight);
    remainingShare = remaining / withoutWeights.length;
    assignedTotalWeight += remaining;
  }
  if (assignedTotalWeight <= 0) return avg(typeAverages.map((entry) => entry.avg));

  const weightedSum = withWeights.reduce((sum, entry) =>
    sum + (entry.avg * (effectiveWeightByType.get(entry.type.toLowerCase()) || 0)), 0)
    + withoutWeights.reduce((sum, entry) => sum + (entry.avg * remainingShare), 0);
  return weightedSum / assignedTotalWeight;
}

function gradeTypeName(test) {
  return String(test.gradeType || "").trim() || String(test.testName || "").trim() || "Test";
}

function effectiveLetterGradeScale(criteria = {}) {
  const configured = Array.isArray(criteria.letterScale) ? criteria.letterScale : [];
  const byLabel = new Map(configured.map((entry) => [String(entry.label || "").toUpperCase(), entry]));
  return DEFAULT_LETTER_GRADE_SCALE.map((entry) => {
    const configuredEntry = byLabel.get(entry.label);
    const start = Number(configuredEntry?.start);
    const end = Number(configuredEntry?.end);
    if (Number.isInteger(start) && Number.isInteger(end)) {
      return { label: entry.label, start, end };
    }
    return { ...entry };
  });
}

function scoreToLetterGrade(scorePct, letterScale) {
  if (scorePct == null || scorePct === "") return "";
  const numeric = Number(scorePct);
  if (!Number.isFinite(numeric)) return "";
  const clampedScore = Number(clamp(numeric, 0, 100).toFixed(1));
  const match = letterScale.find((entry) => {
    const upperBound = entry.end >= 100 ? 100 : entry.end + 1;
    return clampedScore >= entry.start && (entry.end >= 100 ? clampedScore <= upperBound : clampedScore < upperBound);
  });
  return match ? match.label : "";
}

function currentGpaMax(criteria = {}) {
  if (criteria.gpaScaleOption === "other") {
    const custom = Number(criteria.gpaMax);
    return Number.isInteger(custom) && custom > 0 ? custom : 4;
  }
  if (["4", "5", "10"].includes(String(criteria.gpaScaleOption))) return Number(criteria.gpaScaleOption);
  const fallback = Number(criteria.gpaMax);
  return Number.isInteger(fallback) && fallback > 0 ? fallback : 4;
}

function csv(headers, rows) {
  const lines = rows.map((row) => headers.map((header) => csvCell(row[header])).join(","));
  return `\ufeff${headers.map(csvCell).join(",")}\n${lines.join("\n")}${lines.length ? "\n" : ""}`;
}

function csvCell(value) {
  if (value == null) return "";
  const text = Array.isArray(value) ? value.join("; ") : String(value);
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, "\"\"")}"`;
  return text;
}

function createZipArchive(files) {
  const localParts = [];
  const centralParts = [];
  let offset = 0;
  const timestamp = dosDateTime(new Date());

  files.forEach((file) => {
    const nameBuffer = Buffer.from(file.name, "utf8");
    const contentBuffer = Buffer.from(String(file.content || ""), "utf8");
    const crc = crc32(contentBuffer);
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(timestamp.time, 10);
    localHeader.writeUInt16LE(timestamp.date, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(contentBuffer.length, 18);
    localHeader.writeUInt32LE(contentBuffer.length, 22);
    localHeader.writeUInt16LE(nameBuffer.length, 26);
    localHeader.writeUInt16LE(0, 28);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(timestamp.time, 12);
    centralHeader.writeUInt16LE(timestamp.date, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(contentBuffer.length, 20);
    centralHeader.writeUInt32LE(contentBuffer.length, 24);
    centralHeader.writeUInt16LE(nameBuffer.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    localParts.push(localHeader, nameBuffer, contentBuffer);
    centralParts.push(centralHeader, nameBuffer);
    offset += localHeader.length + nameBuffer.length + contentBuffer.length;
  });

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  };
}

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC32_TABLE = Array.from({ length: 256 }, (_, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  }
  return crc >>> 0;
});

function quoteIdentifier(value) {
  return `"${String(value || "").replace(/"/g, "\"\"")}"`;
}

function groupBy(items, keyFn) {
  const groups = new Map();
  items.forEach((item) => {
    const key = keyFn(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  });
  return groups;
}

function inRange(value, startDate, endDate) {
  const date = formatDate(value);
  return !!date && date >= formatDate(startDate) && date <= formatDate(endDate);
}

function formatStudentName(student) {
  if (!student) return "";
  return [student.firstName, student.lastName].filter(Boolean).join(" ").trim();
}

function formatDate(value) {
  if (!value) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function pct(score, max) {
  const s = Number(score);
  const m = Number(max);
  return m > 0 ? (s / m) * 100 : 0;
}

function avg(values) {
  const valid = values.map(Number).filter(Number.isFinite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function formatAverage(value) {
  return numberOrBlank(value, 1);
}

function formatGpa(average, gpaMax) {
  const numeric = Number(average);
  if (!Number.isFinite(numeric)) return "";
  return numberOrBlank(clamp((numeric / 100) * gpaMax, 0, gpaMax), 2);
}

function numberOrBlank(value, digits) {
  if (value == null || value === "") return "";
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "";
  return numeric.toFixed(digits);
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function listValue(value) {
  return Array.isArray(value) ? value.filter(Boolean).join("; ") : "";
}

function weekdayNames(value) {
  const names = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  return Array.isArray(value)
    ? value.map((day) => names[Number(day)] || "").filter(Boolean).join("; ")
    : "";
}

module.exports = {
  buildCustomerExportPackage
};
