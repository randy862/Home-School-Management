function createCalendarRepository(deps) {
  const { getPostgresPool } = deps;

  return {
    createDailyBreak: async (dailyBreak) => {
      const pool = getPostgresPool();
      const result = await pool.query(`
        INSERT INTO daily_breaks (
          id,
          school_year_id,
          student_ids_json,
          break_type,
          description,
          start_time,
          duration_minutes,
          weekdays_json
        )
        VALUES ($1, $2, $3::jsonb, $4, $5, $6, $7, $8::jsonb)
        RETURNING
          id,
          school_year_id AS "schoolYearId",
          student_ids_json AS "studentIdsJson",
          break_type AS "type",
          description,
          start_time AS "startTime",
          duration_minutes AS "durationMinutes",
          weekdays_json AS "weekdaysJson"
      `, [
        dailyBreak.id,
        dailyBreak.schoolYearId,
        JSON.stringify(dailyBreak.studentIds || []),
        dailyBreak.type,
        dailyBreak.description || "",
        dailyBreak.startTime,
        dailyBreak.durationMinutes,
        JSON.stringify(dailyBreak.weekdays || [])
      ]);
      return mapDailyBreakRow(result.rows[0]);
    },

    createScheduleBlock: async (scheduleBlock) => {
      const pool = getPostgresPool();
      const result = await pool.query(`
        INSERT INTO schedule_blocks (
          id,
          name,
          block_type,
          description,
          duration_minutes,
          weekdays_json
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        RETURNING
          id,
          name,
          block_type AS "type",
          description,
          duration_minutes AS "durationMinutes",
          weekdays_json AS "weekdaysJson"
      `, [
        scheduleBlock.id,
        scheduleBlock.name,
        scheduleBlock.type,
        scheduleBlock.description || "",
        scheduleBlock.durationMinutes,
        JSON.stringify(scheduleBlock.weekdays || [])
      ]);
      return mapScheduleBlockRow(result.rows[0]);
    },

    createHoliday: async (holiday) => {
      const pool = getPostgresPool();
      const result = await pool.query(`
        INSERT INTO holidays (id, name, holiday_type, start_date, end_date)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING
          id,
          name,
          holiday_type AS "type",
          start_date AS "startDate",
          end_date AS "endDate"
      `, [holiday.id, holiday.name, holiday.type, holiday.startDate, holiday.endDate]);
      return result.rows[0];
    },

    createPlans: async (plans) => {
      if (!Array.isArray(plans) || !plans.length) return [];
      const pool = getPostgresPool();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const created = [];
        for (const plan of plans) {
          const result = await client.query(`
            INSERT INTO plans (id, plan_type, student_id, course_id, start_date, end_date, weekdays_json, quarter_name)
            VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)
            RETURNING
              id,
              plan_type AS "planType",
              student_id AS "studentId",
              course_id AS "courseId",
              start_date AS "startDate",
              end_date AS "endDate",
              weekdays_json AS "weekdaysJson",
              quarter_name AS "quarterName"
          `, [
            plan.id,
            plan.planType,
            plan.studentId,
            plan.courseId,
            plan.startDate,
            plan.endDate,
            JSON.stringify(plan.weekdays || []),
            plan.quarterName || null
          ]);
          created.push(mapPlanRow(result.rows[0]));
        }
        await client.query("COMMIT");
        return created;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    createSchoolYear: async (schoolYear) => {
      const pool = getPostgresPool();
      await ensureSchoolYearTableColumns(pool);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        if (schoolYear.isCurrent) {
          await client.query("UPDATE school_years SET is_current = FALSE WHERE is_current = TRUE");
        }
        const result = await client.query(`
          INSERT INTO school_years (
            id,
            label,
            start_date,
            end_date,
            required_instructional_days,
            required_instructional_hours,
            school_day_start_time,
            minutes_between_classes,
            is_current
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING
            id,
            label,
            start_date AS "startDate",
            end_date AS "endDate",
            required_instructional_days AS "requiredInstructionalDays",
            required_instructional_hours AS "requiredInstructionalHours",
            school_day_start_time AS "schoolDayStartTime",
            minutes_between_classes AS "minutesBetweenClasses",
            is_current AS "isCurrent"
        `, [
          schoolYear.id,
          schoolYear.label,
          schoolYear.startDate,
          schoolYear.endDate,
          schoolYear.requiredInstructionalDays,
          schoolYear.requiredInstructionalHours,
          schoolYear.schoolDayStartTime,
          schoolYear.minutesBetweenClasses,
          !!schoolYear.isCurrent
        ]);
        await client.query("COMMIT");
        return mapSchoolYearRow(result.rows[0]);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    deleteDailyBreak: async (id) => {
      const pool = getPostgresPool();
      const result = await pool.query("DELETE FROM daily_breaks WHERE id = $1", [id]);
      return result.rowCount > 0;
    },

    deleteScheduleBlock: async (id) => {
      const pool = getPostgresPool();
      const result = await pool.query("DELETE FROM schedule_blocks WHERE id = $1", [id]);
      return result.rowCount > 0;
    },

    deleteHoliday: async (id) => {
      const pool = getPostgresPool();
      const result = await pool.query("DELETE FROM holidays WHERE id = $1", [id]);
      return result.rowCount > 0;
    },

    deletePlan: async (id) => {
      const pool = getPostgresPool();
      const result = await pool.query("DELETE FROM plans WHERE id = $1", [id]);
      return result.rowCount > 0;
    },

    deleteSchoolYear: async (id) => {
      const pool = getPostgresPool();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const existingResult = await client.query(`
          SELECT is_current AS "isCurrent"
          FROM school_years
          WHERE id = $1
          LIMIT 1
        `, [id]);
        const existing = existingResult.rows[0];
        if (!existing) {
          await client.query("ROLLBACK");
          return false;
        }
        const result = await client.query("DELETE FROM school_years WHERE id = $1", [id]);
        if (existing.isCurrent) {
          await client.query(`
            WITH next_year AS (
              SELECT id
              FROM school_years
              ORDER BY start_date DESC, id DESC
              LIMIT 1
            )
            UPDATE school_years
            SET is_current = TRUE
            WHERE id IN (SELECT id FROM next_year)
          `);
        }
        await client.query("COMMIT");
        return result.rowCount > 0;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    listDailyBreaksForUser: async (user) => {
      const pool = getPostgresPool();
      if (user?.role === "student") {
        const result = await pool.query(`
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
          WHERE student_ids_json @> to_jsonb(ARRAY[$1]::text[])
          ORDER BY start_time, id
        `, [user.studentId || ""]);
        return result.rows.map(mapDailyBreakRow);
      }

      const result = await pool.query(`
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
      return result.rows.map(mapDailyBreakRow);
    },

    listScheduleBlocks: async () => {
      const pool = getPostgresPool();
      const result = await pool.query(`
        SELECT
          id,
          name,
          block_type AS "type",
          description,
          duration_minutes AS "durationMinutes",
          weekdays_json AS "weekdaysJson"
        FROM schedule_blocks
        ORDER BY lower(name), id
      `);
      return result.rows.map(mapScheduleBlockRow);
    },

    listHolidays: async () => {
      const pool = getPostgresPool();
      const result = await pool.query(`
        SELECT
          id,
          name,
          holiday_type AS "type",
          start_date AS "startDate",
          end_date AS "endDate"
        FROM holidays
        ORDER BY start_date, end_date, lower(name)
      `);
      return result.rows;
    },

    listPlansForUser: async (user) => {
      const pool = getPostgresPool();
      if (user?.role === "student") {
        const result = await pool.query(`
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
          WHERE student_id = $1
          ORDER BY start_date, end_date, id
        `, [user.studentId || ""]);
        return result.rows.map(mapPlanRow);
      }

      const result = await pool.query(`
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
      return result.rows.map(mapPlanRow);
    },

    listQuarters: async () => {
      const pool = getPostgresPool();
      const result = await pool.query(`
        SELECT
          id,
          school_year_id AS "schoolYearId",
          name,
          start_date AS "startDate",
          end_date AS "endDate"
        FROM quarters
        ORDER BY start_date
      `);
      return result.rows;
    },

    listSchoolYears: async () => {
      const pool = getPostgresPool();
      await ensureSchoolYearTableColumns(pool);
      const result = await pool.query(`
        SELECT
          id,
          label,
          start_date AS "startDate",
          end_date AS "endDate",
          required_instructional_days AS "requiredInstructionalDays",
          required_instructional_hours AS "requiredInstructionalHours",
          school_day_start_time AS "schoolDayStartTime",
          minutes_between_classes AS "minutesBetweenClasses",
          is_current AS "isCurrent"
        FROM school_years
        ORDER BY start_date
      `);
      return result.rows.map(mapSchoolYearRow);
    },

    replaceQuartersForSchoolYear: async (schoolYearId, quarters) => {
      const pool = getPostgresPool();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const schoolYearResult = await client.query(`
          SELECT is_current AS "isCurrent"
          FROM school_years
          WHERE id = $1
          LIMIT 1
        `, [schoolYearId]);
        if (!schoolYearResult.rows[0]) {
          await client.query("ROLLBACK");
          throw new Error("School year not found.");
        }
        const existingQuartersResult = await client.query(`
          SELECT
            name,
            start_date AS "startDate",
            end_date AS "endDate"
          FROM quarters
          WHERE school_year_id = $1
        `, [schoolYearId]);
        const previousQuarterByName = new Map(existingQuartersResult.rows.map((row) => [row.name, row]));
        await client.query("DELETE FROM quarters WHERE school_year_id = $1", [schoolYearId]);
        const saved = [];
        for (const quarter of quarters) {
          const result = await client.query(`
            INSERT INTO quarters (id, school_year_id, name, start_date, end_date)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING
              id,
              school_year_id AS "schoolYearId",
              name,
              start_date AS "startDate",
              end_date AS "endDate"
          `, [quarter.id, schoolYearId, quarter.name, quarter.startDate, quarter.endDate]);
          saved.push(result.rows[0]);
        }
        if (schoolYearResult.rows[0].isCurrent) {
          const nextQuarterByName = new Map(saved.map((row) => [row.name, row]));
          for (const [name, previousQuarter] of previousQuarterByName.entries()) {
            const nextQuarter = nextQuarterByName.get(name);
            if (!nextQuarter) continue;
            await client.query(`
              UPDATE plans
              SET start_date = $2::date, end_date = $3::date
              WHERE plan_type = 'quarterly'
                AND quarter_name = $1
                AND start_date = $4::date
                AND end_date = $5::date
            `, [name, nextQuarter.startDate, nextQuarter.endDate, previousQuarter.startDate, previousQuarter.endDate]);
          }
        }
        await client.query("COMMIT");
        return saved;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    setCurrentSchoolYear: async (id) => {
      const pool = getPostgresPool();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("UPDATE school_years SET is_current = FALSE WHERE is_current = TRUE");
        const result = await client.query(`
          UPDATE school_years
          SET is_current = TRUE
          WHERE id = $1
          RETURNING
            id,
            label,
            start_date AS "startDate",
            end_date AS "endDate",
            required_instructional_days AS "requiredInstructionalDays",
            required_instructional_hours AS "requiredInstructionalHours",
            is_current AS "isCurrent"
        `, [id]);
        await client.query("COMMIT");
        return result.rows[0] ? mapSchoolYearRow(result.rows[0]) : null;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    updateDailyBreak: async (id, dailyBreak) => {
      const pool = getPostgresPool();
      const result = await pool.query(`
        UPDATE daily_breaks
        SET
          school_year_id = $2,
          student_ids_json = $3::jsonb,
          break_type = $4,
          description = $5,
          start_time = $6,
          duration_minutes = $7,
          weekdays_json = $8::jsonb
        WHERE id = $1
        RETURNING
          id,
          school_year_id AS "schoolYearId",
          student_ids_json AS "studentIdsJson",
          break_type AS "type",
          description,
          start_time AS "startTime",
          duration_minutes AS "durationMinutes",
          weekdays_json AS "weekdaysJson"
      `, [
        id,
        dailyBreak.schoolYearId,
        JSON.stringify(dailyBreak.studentIds || []),
        dailyBreak.type,
        dailyBreak.description || "",
        dailyBreak.startTime,
        dailyBreak.durationMinutes,
        JSON.stringify(dailyBreak.weekdays || [])
      ]);
      return result.rows[0] ? mapDailyBreakRow(result.rows[0]) : null;
    },

    updateScheduleBlock: async (id, scheduleBlock) => {
      const pool = getPostgresPool();
      const result = await pool.query(`
        UPDATE schedule_blocks
        SET
          name = $2,
          block_type = $3,
          description = $4,
          duration_minutes = $5,
          weekdays_json = $6::jsonb
        WHERE id = $1
        RETURNING
          id,
          name,
          block_type AS "type",
          description,
          duration_minutes AS "durationMinutes",
          weekdays_json AS "weekdaysJson"
      `, [
        id,
        scheduleBlock.name,
        scheduleBlock.type,
        scheduleBlock.description || "",
        scheduleBlock.durationMinutes,
        JSON.stringify(scheduleBlock.weekdays || [])
      ]);
      return result.rows[0] ? mapScheduleBlockRow(result.rows[0]) : null;
    },

    updateHoliday: async (id, holiday) => {
      const pool = getPostgresPool();
      const result = await pool.query(`
        UPDATE holidays
        SET
          name = $2,
          holiday_type = $3,
          start_date = $4,
          end_date = $5
        WHERE id = $1
        RETURNING
          id,
          name,
          holiday_type AS "type",
          start_date AS "startDate",
          end_date AS "endDate"
      `, [id, holiday.name, holiday.type, holiday.startDate, holiday.endDate]);
      return result.rows[0] || null;
    },

    updatePlan: async (id, plan) => {
      const pool = getPostgresPool();
      const result = await pool.query(`
        UPDATE plans
        SET
          plan_type = $2,
          student_id = $3,
          course_id = $4,
          start_date = $5,
          end_date = $6,
          weekdays_json = $7::jsonb,
          quarter_name = $8
        WHERE id = $1
        RETURNING
          id,
          plan_type AS "planType",
          student_id AS "studentId",
          course_id AS "courseId",
          start_date AS "startDate",
          end_date AS "endDate",
          weekdays_json AS "weekdaysJson",
          quarter_name AS "quarterName"
      `, [
        id,
        plan.planType,
        plan.studentId,
        plan.courseId,
        plan.startDate,
        plan.endDate,
        JSON.stringify(plan.weekdays || []),
        plan.quarterName || null
      ]);
      return result.rows[0] ? mapPlanRow(result.rows[0]) : null;
    },

    updateSchoolYear: async (id, schoolYear) => {
      const pool = getPostgresPool();
      await ensureSchoolYearTableColumns(pool);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const existingResult = await client.query(`
          SELECT start_date AS "startDate", end_date AS "endDate", is_current AS "isCurrent"
          FROM school_years
          WHERE id = $1
          LIMIT 1
        `, [id]);
        const existing = existingResult.rows[0];
        if (!existing) {
          await client.query("ROLLBACK");
          return null;
        }
        if (schoolYear.isCurrent) {
          await client.query("UPDATE school_years SET is_current = FALSE WHERE id <> $1 AND is_current = TRUE", [id]);
        }
        const result = await client.query(`
          UPDATE school_years
          SET
            label = $2,
            start_date = $3,
            end_date = $4,
            required_instructional_days = $5,
            required_instructional_hours = $6,
            school_day_start_time = $7,
            minutes_between_classes = $8,
            is_current = $9
          WHERE id = $1
          RETURNING
            id,
            label,
            start_date AS "startDate",
            end_date AS "endDate",
            required_instructional_days AS "requiredInstructionalDays",
            required_instructional_hours AS "requiredInstructionalHours",
            school_day_start_time AS "schoolDayStartTime",
            minutes_between_classes AS "minutesBetweenClasses",
            is_current AS "isCurrent"
        `, [
          id,
          schoolYear.label,
          schoolYear.startDate,
          schoolYear.endDate,
          schoolYear.requiredInstructionalDays,
          schoolYear.requiredInstructionalHours,
          schoolYear.schoolDayStartTime,
          schoolYear.minutesBetweenClasses,
          !!schoolYear.isCurrent
        ]);
        await client.query(`
          UPDATE plans
          SET start_date = $3, end_date = $4
          WHERE plan_type = 'annual'
            AND start_date = $1
            AND end_date = $2
        `, [existing.startDate, existing.endDate, schoolYear.startDate, schoolYear.endDate]);
        await client.query("COMMIT");
        return mapSchoolYearRow(result.rows[0]);
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    }
  };
}

function mapDailyBreakRow(row) {
  return {
    id: row.id,
    schoolYearId: row.schoolYearId,
    studentIds: Array.isArray(row.studentIdsJson) ? row.studentIdsJson : [],
    type: row.type,
    description: row.description || "",
    startTime: row.startTime || "12:00",
    durationMinutes: row.durationMinutes == null ? 60 : Number(row.durationMinutes),
    weekdays: Array.isArray(row.weekdaysJson) ? row.weekdaysJson.map((day) => Number(day)).filter(Number.isInteger) : []
  };
}

function mapScheduleBlockRow(row) {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    description: row.description || "",
    durationMinutes: row.durationMinutes == null ? 60 : Number(row.durationMinutes),
    weekdays: Array.isArray(row.weekdaysJson) ? row.weekdaysJson.map((day) => Number(day)).filter(Number.isInteger) : []
  };
}

function mapPlanRow(row) {
  return {
    id: row.id,
    planType: row.planType,
    studentId: row.studentId,
    courseId: row.courseId,
    startDate: row.startDate,
    endDate: row.endDate,
    weekdays: Array.isArray(row.weekdaysJson) ? row.weekdaysJson.map((day) => Number(day)).filter(Number.isInteger) : [],
    ...(row.quarterName ? { quarterName: row.quarterName } : {})
  };
}

function mapSchoolYearRow(row) {
  return {
    ...row,
    requiredInstructionalDays: row.requiredInstructionalDays == null ? null : Number(row.requiredInstructionalDays),
    requiredInstructionalHours: row.requiredInstructionalHours == null ? null : Number(row.requiredInstructionalHours),
    schoolDayStartTime: String(row.schoolDayStartTime || "08:00").slice(0, 5),
    minutesBetweenClasses: row.minutesBetweenClasses == null ? 5 : Number(row.minutesBetweenClasses),
    isCurrent: !!row.isCurrent
  };
}

async function ensureSchoolYearTableColumns(pool) {
  await pool.query(`
    ALTER TABLE school_years
    ADD COLUMN IF NOT EXISTS school_day_start_time TEXT NOT NULL DEFAULT '08:00'
  `);
  await pool.query(`
    ALTER TABLE school_years
    ADD COLUMN IF NOT EXISTS minutes_between_classes INTEGER NOT NULL DEFAULT 5
  `);
}

module.exports = {
  createCalendarRepository
};
