const { Pool } = require("pg");
const { postgres } = require("../config");

const ABSENCE_FLOOR = 0.97;
const ABSENCE_CEILING = 0.98;
const DEFAULT_SEED = 20260407;
const DEFAULT_TENANT_SCHEMA = "tenant_mitchell_family";
const GRADE_TYPE_PATTERN = ["Assignment", "Assignment", "Assignment", "Assignment", "Assignment", "Assignment", "Assignment", "Assignment", "Quiz", "Test"];

function getArg(name, fallback = "") {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  return process.argv[index + 1] || fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function isIsoDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function toDate(isoDate) {
  const date = new Date(`${isoDate}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toISO(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function formatShortDate(isoDate) {
  const date = toDate(isoDate);
  if (!date) return isoDate;
  return `${String(date.getMonth() + 1).padStart(2, "0")}/${String(date.getDate()).padStart(2, "0")}/${date.getFullYear()}`;
}

function todayIso() {
  return toISO(new Date());
}

function addDays(isoDate, count) {
  const date = toDate(isoDate);
  if (!date) return isoDate;
  date.setDate(date.getDate() + count);
  return toISO(date);
}

function weekKey(isoDate) {
  const date = toDate(isoDate);
  if (!date) return isoDate;
  const cursor = new Date(date);
  const day = (cursor.getDay() + 6) % 7;
  cursor.setDate(cursor.getDate() - day);
  return toISO(cursor);
}

function parseJson(value, fallback) {
  if (Array.isArray(value)) return value;
  if (value == null || value === "") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function asIsoDate(value) {
  if (!value) return "";
  if (typeof value === "string" && isIsoDate(value)) return value;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return toISO(value);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : toISO(date);
}

function parseTimeToMinutes(value) {
  const match = String(value || "").trim().match(/^(\d{2}):(\d{2})/);
  if (!match) return NaN;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return NaN;
  return hours * 60 + minutes;
}

function hashString(input) {
  let hash = 2166136261;
  const source = String(input || "");
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableFraction(...parts) {
  return hashString(parts.join("||")) / 0xffffffff;
}

function pickByHash(items, ...parts) {
  if (!items.length) return null;
  const index = hashString(parts.join("||")) % items.length;
  return items[index];
}

function numericScore(min, max, ...parts) {
  const span = max - min;
  return Number((min + (stableFraction(...parts) * span)).toFixed(2));
}

function quoteIdent(name) {
  if (!/^[a-z_][a-z0-9_]*$/i.test(name)) {
    throw new Error(`Invalid schema identifier: ${name}`);
  }
  return `"${name.replace(/"/g, "\"\"")}"`;
}

function buildPool(tenantSchema) {
  return new Pool({
    ...postgres,
    options: `-c search_path=${tenantSchema},public`
  });
}

async function loadTenantData(client, throughDate) {
  const studentsResult = await client.query(`
      SELECT id, first_name AS "firstName", last_name AS "lastName"
      FROM students
      ORDER BY lower(last_name), lower(first_name), id
    `);
  const instructorsResult = await client.query(`
      SELECT id, first_name AS "firstName", last_name AS "lastName", category
      FROM instructors
      ORDER BY lower(last_name), lower(first_name), id
    `);
  const subjectsResult = await client.query(`
      SELECT id, name
      FROM subjects
      ORDER BY lower(name), id
    `);
  const coursesResult = await client.query(`
      SELECT
        id,
        name,
        subject_id AS "subjectId",
        instructor_id AS "instructorId",
        hours_per_day AS "hoursPerDay",
        exclusive_resource AS "exclusiveResource"
      FROM courses
      ORDER BY lower(name), id
    `);
  const enrollmentsResult = await client.query(`
      SELECT
        id,
        student_id AS "studentId",
        course_id AS "courseId",
        schedule_order AS "scheduleOrder"
      FROM enrollments
      ORDER BY id
    `);
  const plansResult = await client.query(`
      SELECT
        id,
        plan_type AS "planType",
        student_id AS "studentId",
        course_id AS "courseId",
        start_date AS "startDate",
        end_date AS "endDate",
        weekdays_json AS "weekdaysJson",
        quarter_name AS "quarterName"
      FROM plans
      ORDER BY start_date, end_date, id
    `);
  const dailyBreaksResult = await client.query(`
      SELECT
        id,
        school_year_id AS "schoolYearId",
        student_ids_json AS "studentIdsJson",
        break_type AS "type",
        description,
        start_time AS "startTime",
        duration_minutes AS "durationMinutes",
        weekdays_json AS "weekdaysJson"
      FROM daily_breaks
      ORDER BY start_time, id
    `);
  const holidaysResult = await client.query(`
      SELECT
        id,
        name,
        holiday_type AS "type",
        start_date AS "startDate",
        end_date AS "endDate"
      FROM holidays
      ORDER BY start_date, end_date, lower(name)
    `);
  const schoolYearsResult = await client.query(`
      SELECT
        id,
        label,
        start_date AS "startDate",
        end_date AS "endDate",
        is_current AS "isCurrent"
      FROM school_years
      ORDER BY start_date, id
    `);
  const quartersResult = await client.query(`
      SELECT
        id,
        school_year_id AS "schoolYearId",
        name,
        start_date AS "startDate",
        end_date AS "endDate"
      FROM quarters
      ORDER BY start_date, id
    `);
  const attendanceCountResult = await client.query("SELECT COUNT(*)::int AS count FROM attendance");
  const actualCountResult = await client.query("SELECT COUNT(*)::int AS count FROM actual_instruction_minutes");
  const testsCountResult = await client.query("SELECT COUNT(*)::int AS count FROM tests");

  const schoolYears = schoolYearsResult.rows.map((row) => ({
    ...row,
    startDate: asIsoDate(row.startDate),
    endDate: asIsoDate(row.endDate)
  }));
  const currentSchoolYear = schoolYears.find((row) => row.isCurrent)
    || schoolYears.find((row) => row.startDate <= throughDate && row.endDate >= throughDate)
    || schoolYears[schoolYears.length - 1]
    || null;
  if (!currentSchoolYear) {
    throw new Error("No school year exists in the target tenant.");
  }

  return {
    students: studentsResult.rows,
    instructors: instructorsResult.rows,
    subjects: subjectsResult.rows,
    courses: coursesResult.rows.map((row) => ({
      ...row,
      hoursPerDay: Number(row.hoursPerDay || 0),
      exclusiveResource: !!row.exclusiveResource
    })),
    enrollments: enrollmentsResult.rows.map((row, index) => ({
      ...row,
      scheduleOrder: row.scheduleOrder == null ? null : Number(row.scheduleOrder),
      _sourceIndex: index
    })),
    plans: plansResult.rows.map((row) => ({
      ...row,
      startDate: asIsoDate(row.startDate),
      endDate: asIsoDate(row.endDate),
      weekdays: parseJson(row.weekdaysJson, []).map(Number).filter((value) => Number.isInteger(value))
    })),
    dailyBreaks: dailyBreaksResult.rows.map((row) => ({
      ...row,
      studentIds: parseJson(row.studentIdsJson, []),
      weekdays: parseJson(row.weekdaysJson, []).map(Number).filter((value) => Number.isInteger(value))
    })),
    holidays: holidaysResult.rows.map((row) => ({
      ...row,
      startDate: asIsoDate(row.startDate),
      endDate: asIsoDate(row.endDate)
    })),
    schoolYears,
    currentSchoolYear,
    quarters: quartersResult.rows
      .map((row) => ({
        ...row,
        startDate: asIsoDate(row.startDate),
        endDate: asIsoDate(row.endDate)
      }))
      .filter((row) => row.schoolYearId === currentSchoolYear.id),
    existingCounts: {
      attendance: Number(attendanceCountResult.rows[0]?.count || 0),
      actualInstructionMinutes: Number(actualCountResult.rows[0]?.count || 0),
      tests: Number(testsCountResult.rows[0]?.count || 0)
    }
  };
}

function buildReferenceMaps(data) {
  return {
    studentsById: new Map(data.students.map((row) => [row.id, row])),
    subjectsById: new Map(data.subjects.map((row) => [row.id, row])),
    coursesById: new Map(data.courses.map((row) => [row.id, row])),
    quartersByName: new Map(data.quarters.map((row) => [row.name, row])),
    enrollmentsByStudent: data.students.reduce((map, student) => {
      const enrollments = data.enrollments.filter((entry) => entry.studentId === student.id);
      map.set(student.id, sortStudentEnrollments(enrollments, data.courses, data.subjects));
      return map;
    }, new Map()),
    plansByStudent: data.students.reduce((map, student) => {
      map.set(student.id, data.plans.filter((entry) => entry.studentId === student.id));
      return map;
    }, new Map())
  };
}

function sortStudentEnrollments(enrollments, courses, subjects) {
  const courseById = new Map(courses.map((row) => [row.id, row]));
  const subjectById = new Map(subjects.map((row) => [row.id, row]));
  const autoSorted = [...enrollments].sort((a, b) => {
    const courseA = courseById.get(a.courseId);
    const courseB = courseById.get(b.courseId);
    const subjectA = subjectById.get(courseA?.subjectId || "")?.name || "";
    const subjectB = subjectById.get(courseB?.subjectId || "")?.name || "";
    const subjectDiff = subjectA.localeCompare(subjectB);
    if (subjectDiff !== 0) return subjectDiff;
    const courseDiff = (courseA?.name || "").localeCompare(courseB?.name || "");
    if (courseDiff !== 0) return courseDiff;
    return (a._sourceIndex || 0) - (b._sourceIndex || 0);
  });
  const ordered = new Array(autoSorted.length).fill(null);
  const overflow = [];
  autoSorted.forEach((entry) => {
    const preferred = Number.isInteger(entry.scheduleOrder) && entry.scheduleOrder > 0 ? entry.scheduleOrder : null;
    if (preferred == null) {
      overflow.push(entry);
      return;
    }
    const slotIndex = preferred - 1;
    if (slotIndex < 0 || slotIndex >= ordered.length || ordered[slotIndex]) {
      overflow.push(entry);
      return;
    }
    ordered[slotIndex] = entry;
  });
  let overflowIndex = 0;
  for (let index = 0; index < ordered.length; index += 1) {
    if (ordered[index]) continue;
    ordered[index] = overflow[overflowIndex] || null;
    overflowIndex += 1;
  }
  return ordered.filter(Boolean);
}

function holidaySet(holidays, throughDate) {
  const set = new Set();
  holidays.forEach((holiday) => {
    const start = toDate(holiday.startDate);
    const end = toDate(holiday.endDate);
    if (!start || !end || end < start) return;
    const effectiveEnd = end > toDate(throughDate) ? toDate(throughDate) : end;
    const cursor = new Date(start);
    while (cursor <= effectiveEnd) {
      set.add(toISO(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  });
  return set;
}

function resolvedPlanRange(plan, currentSchoolYear, quartersByName) {
  if (!plan) return { startDate: "", endDate: "" };
  if (plan.planType === "annual") {
    return {
      startDate: currentSchoolYear?.startDate || plan.startDate,
      endDate: currentSchoolYear?.endDate || plan.endDate
    };
  }
  if (plan.planType === "quarterly" && plan.quarterName) {
    const quarter = quartersByName.get(plan.quarterName);
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

function calendarEventsForDate(dateKey, data, refs, excludedDates) {
  const date = toDate(dateKey);
  if (!date) return [];
  const weekday = date.getDay();
  const events = [];
  const seen = new Set();
  data.plans.forEach((plan) => {
    const enrolled = (refs.enrollmentsByStudent.get(plan.studentId) || []).some((entry) => entry.courseId === plan.courseId);
    if (!enrolled) return;
    const range = resolvedPlanRange(plan, data.currentSchoolYear, refs.quartersByName);
    if (!range.startDate || !range.endDate) return;
    if (dateKey < range.startDate || dateKey > range.endDate) return;
    if (!(plan.weekdays || [1, 2, 3, 4, 5]).includes(weekday)) return;
    if (excludedDates.has(dateKey)) return;
    const key = `${plan.studentId}||${plan.courseId}`;
    if (seen.has(key)) return;
    seen.add(key);
    events.push({
      date: dateKey,
      studentId: plan.studentId,
      courseId: plan.courseId,
      planType: plan.planType
    });
  });

  const isInstructionalWeekday = weekday >= 1 && weekday <= 5;
  if (isInstructionalWeekday && !excludedDates.has(dateKey)) {
    data.students.forEach((student) => {
      const enrollments = refs.enrollmentsByStudent.get(student.id) || [];
      enrollments.forEach((enrollment) => {
        const pairKey = `${student.id}||${enrollment.courseId}`;
        if (seen.has(pairKey)) return;
        const hasAnyPlan = (refs.plansByStudent.get(student.id) || []).some((entry) => entry.courseId === enrollment.courseId);
        if (hasAnyPlan) return;
        seen.add(pairKey);
        events.push({
          date: dateKey,
          studentId: student.id,
          courseId: enrollment.courseId,
          planType: "enrollment-fallback"
        });
      });
    });
  }

  return events;
}

function dailyBreaksForStudentDate(studentId, dateKey, data) {
  const date = toDate(dateKey);
  if (!date) return [];
  const weekday = date.getDay();
  const matchingBreaks = data.dailyBreaks
    .filter((entry) =>
      entry.schoolYearId === data.currentSchoolYear.id
      && (entry.studentIds || []).includes(studentId)
      && (entry.weekdays || []).includes(weekday))
    .map((entry) => {
      const start = parseTimeToMinutes(entry.startTime);
      const durationMinutes = Math.max(5, Number(entry.durationMinutes || 0));
      return {
        ...entry,
        label: entry.type === "lunch" ? "Lunch Break" : (entry.description || "Break"),
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
      type: "lunch",
      label: "Lunch Break",
      start: 12 * 60,
      end: 13 * 60,
      durationMinutes: 60
    });
    matchingBreaks.sort((a, b) => a.start - b.start || a.label.localeCompare(b.label));
  }

  return matchingBreaks;
}

function orderEventsForStudent(studentId, events, enrollmentsByStudent) {
  const orderedEnrollments = enrollmentsByStudent.get(studentId) || [];
  const orderIndexByCourseId = new Map(orderedEnrollments.map((entry, index) => [entry.courseId, index]));
  return [...events].sort((a, b) => {
    const indexA = orderIndexByCourseId.get(a.courseId) ?? Number.MAX_SAFE_INTEGER;
    const indexB = orderIndexByCourseId.get(b.courseId) ?? Number.MAX_SAFE_INTEGER;
    return indexA - indexB;
  });
}

function buildDailyScheduledBlocks(dateKey, data, refs, excludedDates) {
  const events = calendarEventsForDate(dateKey, data, refs, excludedDates);
  const byStudent = new Map();
  events.forEach((event) => {
    if (!byStudent.has(event.studentId)) byStudent.set(event.studentId, []);
    byStudent.get(event.studentId).push(event);
  });

  const exclusiveCourseAvailability = new Map();
  const blocksByStudent = new Map();
  const studentIdsInOrder = Array.from(byStudent.keys()).sort((a, b) => {
    const studentA = refs.studentsById.get(a);
    const studentB = refs.studentsById.get(b);
    const labelA = `${studentA?.lastName || ""}, ${studentA?.firstName || ""}`;
    const labelB = `${studentB?.lastName || ""}, ${studentB?.firstName || ""}`;
    return labelA.localeCompare(labelB);
  });

  studentIdsInOrder.forEach((studentId) => {
    const baseOrderedEvents = orderEventsForStudent(studentId, byStudent.get(studentId) || [], refs.enrollmentsByStudent);
    const remaining = [...baseOrderedEvents];
    const breakBlocks = dailyBreaksForStudentDate(studentId, dateKey, data);
    const blocks = [];
    let slot = 8 * 60;
    let breakIndex = 0;

    while (remaining.length || breakIndex < breakBlocks.length) {
      const nextBreak = breakBlocks[breakIndex] || null;
      if (nextBreak && slot >= nextBreak.start) {
        blocks.push({
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
        const course = refs.coursesById.get(event.courseId);
        const durationMinutes = Math.max(15, Math.round(Number(course?.hoursPerDay || 1) * 60));
        const availableAt = course?.exclusiveResource
          ? Math.max(8 * 60, exclusiveCourseAvailability.get(course.id) || 8 * 60)
          : 8 * 60;
        return { event, course, durationMinutes, availableAt };
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
        studentId,
        courseId: chosen.event.courseId,
        subjectId: chosen.course?.subjectId || "",
        plannedStart: startMin,
        plannedEnd: endMin,
        start: startMin,
        end: endMin,
        durationMinutes: chosen.durationMinutes,
        type: "instruction"
      });
      if (chosen.course?.exclusiveResource) {
        exclusiveCourseAvailability.set(chosen.course.id, endMin);
      }

      const removeIndex = remaining.findIndex((event) =>
        event.studentId === chosen.event.studentId && event.courseId === chosen.event.courseId);
      if (removeIndex >= 0) remaining.splice(removeIndex, 1);

      slot = endMin;
      if (remaining.length && slot < 24 * 60) slot = Math.min(24 * 60, slot + 5);
    }

    const instructionBlocks = blocks.filter((entry) => entry.type === "instruction");
    instructionBlocks.forEach((entry, index) => {
      entry.orderIndex = index + 1;
    });
    blocksByStudent.set(studentId, blocks);
  });

  return blocksByStudent;
}

function buildEligibleScheduleMap(data, refs, throughDate) {
  const excludedDates = holidaySet(data.holidays, throughDate);
  const scheduleByStudentDate = new Map();
  const eligibleDatesByStudent = new Map(data.students.map((student) => [student.id, []]));
  const startDate = data.currentSchoolYear.startDate;
  for (let dateKey = startDate; dateKey <= throughDate; dateKey = addDays(dateKey, 1)) {
    const date = toDate(dateKey);
    if (!date) continue;
    const weekday = date.getDay();
    if (weekday < 1 || weekday > 5) continue;
    if (excludedDates.has(dateKey)) continue;
    const blocksByStudent = buildDailyScheduledBlocks(dateKey, data, refs, excludedDates);
    blocksByStudent.forEach((blocks, studentId) => {
      const instructionBlocks = blocks.filter((entry) => entry.type === "instruction");
      if (!instructionBlocks.length) return;
      eligibleDatesByStudent.get(studentId).push(dateKey);
      scheduleByStudentDate.set(`${studentId}||${dateKey}`, instructionBlocks);
    });
  }
  return { scheduleByStudentDate, eligibleDatesByStudent };
}

function chooseAbsenceDates(studentId, eligibleDates, seed) {
  if (!eligibleDates.length) return new Set();
  const total = eligibleDates.length;
  const possibleCounts = [];
  for (let count = 0; count <= total; count += 1) {
    const rate = (total - count) / total;
    if (rate >= ABSENCE_FLOOR && rate <= ABSENCE_CEILING) {
      possibleCounts.push(count);
    }
  }
  let absenceCount;
  if (possibleCounts.length) {
    absenceCount = possibleCounts[hashString(`${seed}||${studentId}||absence-count`) % possibleCounts.length];
  } else {
    const preferred = total * (1 - ((ABSENCE_FLOOR + ABSENCE_CEILING) / 2));
    absenceCount = Math.max(0, Math.min(total, Math.round(preferred)));
  }
  if (!absenceCount) return new Set();
  const rankedDates = [...eligibleDates]
    .map((dateKey) => ({
      dateKey,
      rank: hashString(`${seed}||${studentId}||${dateKey}||absence-date`)
    }))
    .sort((a, b) => a.rank - b.rank)
    .slice(0, absenceCount)
    .map((entry) => entry.dateKey);
  return new Set(rankedDates);
}

function buildAttendanceRows(data, eligibleDatesByStudent, seed) {
  const attendanceRows = [];
  const absenceSummary = [];

  data.students.forEach((student) => {
    const eligibleDates = eligibleDatesByStudent.get(student.id) || [];
    const absenceDates = chooseAbsenceDates(student.id, eligibleDates, seed);
    eligibleDates.forEach((dateKey) => {
      attendanceRows.push({
        id: `seed-att-${student.id}-${dateKey}`,
        studentId: student.id,
        date: dateKey,
        present: !absenceDates.has(dateKey)
      });
    });
    const presentCount = eligibleDates.length - absenceDates.size;
    const attendanceRate = eligibleDates.length ? Number(((presentCount / eligibleDates.length) * 100).toFixed(2)) : 0;
    absenceSummary.push({
      studentId: student.id,
      eligibleDays: eligibleDates.length,
      absences: absenceDates.size,
      attendanceRate
    });
  });

  return { attendanceRows, absenceSummary };
}

function buildActualInstructionRows(refs, scheduleByStudentDate, attendanceRows) {
  const attendanceMap = new Map(attendanceRows.map((row) => [`${row.studentId}||${row.date}`, row.present]));
  const actualRows = [];
  scheduleByStudentDate.forEach((blocks, key) => {
    const [studentId, dateKey] = key.split("||");
    if (!attendanceMap.get(`${studentId}||${dateKey}`)) return;
    blocks.forEach((block) => {
      const course = refs.coursesById.get(block.courseId);
      actualRows.push({
        id: `seed-act-${studentId}-${block.courseId}-${dateKey}`,
        studentId,
        courseId: block.courseId,
        instructorId: course?.instructorId || null,
        date: dateKey,
        actualMinutes: block.durationMinutes,
        startMinutes: block.start,
        orderIndex: block.orderIndex,
        completed: true
      });
    });
  });
  return actualRows;
}

function scoreForGradeType(gradeType, seed, studentId, courseId, date, sequence) {
  if (gradeType === "Assignment") return numericScore(85, 99, seed, studentId, courseId, date, sequence, gradeType);
  if (gradeType === "Quiz") return numericScore(82, 98, seed, studentId, courseId, date, sequence, gradeType);
  if (gradeType === "Test") return numericScore(80, 97, seed, studentId, courseId, date, sequence, gradeType);
  return numericScore(78, 96, seed, studentId, courseId, date, sequence, gradeType);
}

function buildGradeRows(data, refs, actualRows, throughDate, seed) {
  const actualByStudentCourse = new Map();
  actualRows.forEach((row) => {
    const key = `${row.studentId}||${row.courseId}`;
    if (!actualByStudentCourse.has(key)) actualByStudentCourse.set(key, []);
    actualByStudentCourse.get(key).push(row);
  });
  actualByStudentCourse.forEach((rows) => rows.sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes));

  const slots = [];
  actualByStudentCourse.forEach((rows, key) => {
    const [studentId, courseId] = key.split("||");
    const course = refs.coursesById.get(courseId);
    if (!course) return;
    const groupedByWeek = new Map();
    rows.forEach((row) => {
      if (row.date > throughDate) return;
      const week = weekKey(row.date);
      if (!groupedByWeek.has(week)) groupedByWeek.set(week, []);
      groupedByWeek.get(week).push(row);
    });

    Array.from(groupedByWeek.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([week, weekRows], weekIndex) => {
        const orderedRows = [...weekRows].sort((a, b) => a.date.localeCompare(b.date) || a.startMinutes - b.startMinutes);
        const primaryRow = pickByHash(orderedRows, seed, studentId, courseId, week, "primary-grade") || orderedRows[0];
        slots.push({
          studentId,
          courseId,
          subjectId: course.subjectId,
          date: primaryRow.date,
          sequence: 1
        });
        if (weekIndex % 4 === 1 && orderedRows.length) {
          const secondaryRow = pickByHash(orderedRows, seed, studentId, courseId, week, "secondary-grade") || orderedRows[orderedRows.length - 1];
          slots.push({
            studentId,
            courseId,
            subjectId: course.subjectId,
            date: secondaryRow.date,
            sequence: 2
          });
        }
      });
  });

  const gradeRows = [];
  slots
    .sort((a, b) => a.date.localeCompare(b.date) || a.studentId.localeCompare(b.studentId) || a.courseId.localeCompare(b.courseId) || a.sequence - b.sequence)
    .forEach((slot, index) => {
      const gradeType = GRADE_TYPE_PATTERN[index % GRADE_TYPE_PATTERN.length];
      const testName = gradeType === "Assignment"
        ? `Assignment ${formatShortDate(slot.date)}`
        : `${gradeType} ${formatShortDate(slot.date)}`;
      gradeRows.push({
        id: `seed-test-${slot.studentId}-${slot.courseId}-${slot.date}-${slot.sequence}`,
        date: slot.date,
        studentId: slot.studentId,
        subjectId: slot.subjectId,
        courseId: slot.courseId,
        gradeType,
        testName,
        score: scoreForGradeType(gradeType, seed, slot.studentId, slot.courseId, slot.date, slot.sequence),
        maxScore: 100
      });
    });

  data.quarters
    .filter((quarter) => quarter.endDate <= throughDate)
    .forEach((quarter) => {
      actualByStudentCourse.forEach((rows, key) => {
        const [studentId, courseId] = key.split("||");
        const course = refs.coursesById.get(courseId);
        if (!course) return;
        const inQuarter = rows.filter((row) => row.date >= quarter.startDate && row.date <= quarter.endDate);
        if (!inQuarter.length) return;
        const finalRow = inQuarter[inQuarter.length - 1];
        gradeRows.push({
          id: `seed-test-qf-${studentId}-${courseId}-${quarter.name.toLowerCase().replace(/\s+/g, "-")}`,
          date: finalRow.date,
          studentId,
          subjectId: course.subjectId,
          courseId,
          gradeType: "Quarter Final",
          testName: `${quarter.name} Final`,
          score: numericScore(78, 96, seed, studentId, courseId, quarter.name, "quarter-final"),
          maxScore: 100
        });
      });
    });

  return gradeRows.sort((a, b) => a.date.localeCompare(b.date) || a.studentId.localeCompare(b.studentId) || a.courseId.localeCompare(b.courseId) || a.testName.localeCompare(b.testName));
}

async function deleteExistingData(client, mode) {
  if (mode === "replace-existing") {
    await client.query("DELETE FROM tests");
    await client.query("DELETE FROM actual_instruction_minutes");
    await client.query("DELETE FROM attendance");
    return;
  }
  if (mode === "replace-generated") {
    await client.query("DELETE FROM tests WHERE id LIKE 'seed-test-%'");
    await client.query("DELETE FROM actual_instruction_minutes WHERE id LIKE 'seed-act-%'");
    await client.query("DELETE FROM attendance WHERE id LIKE 'seed-att-%'");
  }
}

async function insertAttendance(client, rows) {
  for (const row of rows) {
    await client.query(`
      INSERT INTO attendance (id, student_id, attendance_date, present)
      VALUES ($1, $2, $3, $4)
    `, [row.id, row.studentId, row.date, row.present]);
  }
}

async function insertActualInstructionRows(client, rows) {
  for (const row of rows) {
    await client.query(`
      INSERT INTO actual_instruction_minutes (
        id,
        student_id,
        course_id,
        instructor_id,
        instruction_date,
        actual_minutes,
        start_minutes,
        order_index,
        completed
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [row.id, row.studentId, row.courseId, row.instructorId || null, row.date, row.actualMinutes, row.startMinutes, row.orderIndex, row.completed]);
  }
}

async function insertTests(client, rows) {
  for (const row of rows) {
    await client.query(`
      INSERT INTO tests (
        id,
        test_date,
        student_id,
        subject_id,
        course_id,
        grade_type,
        test_name,
        score,
        max_score
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [row.id, row.date, row.studentId, row.subjectId, row.courseId, row.gradeType, row.testName, row.score, row.maxScore]);
  }
}

function printSummary(summary) {
  console.log("Mitchell tenant backfill summary:");
  console.log(`  Tenant schema: ${summary.tenantSchema}`);
  console.log(`  Through date: ${summary.throughDate}`);
  console.log(`  Seed: ${summary.seed}`);
  console.log(`  Dry run: ${summary.dryRun ? "yes" : "no"}`);
  console.log(`  Replace mode: ${summary.replaceMode || "none"}`);
  console.log(`  Current school year: ${summary.schoolYearLabel} (${summary.schoolYearStart} to ${summary.schoolYearEnd})`);
  console.log(`  Attendance rows: ${summary.attendanceRows}`);
  console.log(`  Actual instruction rows: ${summary.actualRows}`);
  console.log(`  Grade rows: ${summary.gradeRows}`);
  console.log("  Student attendance:");
  summary.studentAttendance.forEach((row) => {
    console.log(`    ${row.studentName}: ${row.presentDays}/${row.eligibleDays} days (${row.attendanceRate.toFixed(2)}%), absences ${row.absences}`);
  });
}

async function run() {
  const tenantSchema = String(getArg("--tenant-schema", DEFAULT_TENANT_SCHEMA)).trim();
  const throughDate = String(getArg("--through-date", todayIso())).trim();
  const seed = Number(getArg("--seed", String(DEFAULT_SEED)));
  const dryRun = hasFlag("--dry-run");
  const replaceMode = hasFlag("--replace-existing")
    ? "replace-existing"
    : (hasFlag("--replace-generated") ? "replace-generated" : "");
  const allowOtherTenant = hasFlag("--allow-other-tenant");

  if (!/^[a-z_][a-z0-9_]*$/i.test(tenantSchema)) {
    throw new Error("Provide a valid tenant schema name.");
  }
  if (!isIsoDate(throughDate)) {
    throw new Error("Provide --through-date in YYYY-MM-DD format.");
  }
  if (!Number.isInteger(seed)) {
    throw new Error("Provide an integer --seed value.");
  }
  if (!allowOtherTenant && tenantSchema !== DEFAULT_TENANT_SCHEMA) {
    throw new Error(`Refusing to run against ${tenantSchema}. Use ${DEFAULT_TENANT_SCHEMA} or add --allow-other-tenant intentionally.`);
  }

  const pool = buildPool(tenantSchema);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`SET LOCAL search_path TO ${quoteIdent(tenantSchema)}, public`);
    const data = await loadTenantData(client, throughDate);
    if (throughDate < data.currentSchoolYear.startDate) {
      throw new Error("Through date is before the current school year start.");
    }
    if (!replaceMode && (data.existingCounts.attendance || data.existingCounts.actualInstructionMinutes || data.existingCounts.tests)) {
      throw new Error("Existing attendance, actual instruction, or grade records are present. Re-run with --replace-generated or --replace-existing.");
    }

    const refs = buildReferenceMaps(data);
    const { scheduleByStudentDate, eligibleDatesByStudent } = buildEligibleScheduleMap(data, refs, throughDate);
    const { attendanceRows } = buildAttendanceRows(data, eligibleDatesByStudent, seed);
    const actualRows = buildActualInstructionRows(refs, scheduleByStudentDate, attendanceRows);
    const gradeRows = buildGradeRows(data, refs, actualRows, throughDate, seed);

    await deleteExistingData(client, replaceMode);
    await insertAttendance(client, attendanceRows);
    await insertActualInstructionRows(client, actualRows);
    await insertTests(client, gradeRows);

    if (dryRun) {
      await client.query("ROLLBACK");
    } else {
      await client.query("COMMIT");
    }

    const attendanceByStudent = new Map();
    attendanceRows.forEach((row) => {
      if (!attendanceByStudent.has(row.studentId)) {
        attendanceByStudent.set(row.studentId, { eligibleDays: 0, presentDays: 0 });
      }
      const current = attendanceByStudent.get(row.studentId);
      current.eligibleDays += 1;
      if (row.present) current.presentDays += 1;
    });

    printSummary({
      tenantSchema,
      throughDate,
      seed,
      dryRun,
      replaceMode,
      schoolYearLabel: data.currentSchoolYear.label,
      schoolYearStart: data.currentSchoolYear.startDate,
      schoolYearEnd: data.currentSchoolYear.endDate,
      attendanceRows: attendanceRows.length,
      actualRows: actualRows.length,
      gradeRows: gradeRows.length,
      studentAttendance: data.students.map((student) => {
        const stats = attendanceByStudent.get(student.id) || { eligibleDays: 0, presentDays: 0 };
        const absences = stats.eligibleDays - stats.presentDays;
        return {
          studentName: `${student.firstName} ${student.lastName}`,
          eligibleDays: stats.eligibleDays,
          presentDays: stats.presentDays,
          absences,
          attendanceRate: stats.eligibleDays ? (stats.presentDays / stats.eligibleDays) * 100 : 0
        };
      }).sort((a, b) => a.studentName.localeCompare(b.studentName))
    });
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Keep the original failure as the surfaced error.
    }
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((error) => {
  console.error("Mitchell tenant backfill failed:", error.message);
  process.exit(1);
});
