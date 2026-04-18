function createCommercialPolicyService(deps) {
  const { getPostgresPool, commercialConfig } = deps;
  const schema = qualifySchema(commercialConfig.controlSchema || "hsm_control_staging");
  const tenantEnvironmentId = String(commercialConfig.tenantEnvironmentId || "").trim();

  async function withCommercialContext(work) {
    if (!tenantEnvironmentId) return work(null, null);
    const pool = getPostgresPool();
    const client = await pool.connect();
    try {
      const context = await getCommercialContext(client);
      return await work(client, context);
    } finally {
      client.release();
    }
  }

  async function getCommercialContext(client) {
    const result = await client.query(`
      SELECT
        pr.tenant_id AS "tenantId",
        pr.tenant_environment_id AS "tenantEnvironmentId",
        account.account_name AS "accountName",
        account.owner_email AS "ownerEmail",
        account.billing_email AS "billingEmail",
        sub.id AS "subscriptionId",
        sub.status AS "subscriptionStatus",
        sub.dormant_status AS "dormantStatus",
        sub.current_period_start AS "currentPeriodStart",
        sub.current_period_end AS "currentPeriodEnd",
        sub.base_price_cents AS "basePriceCents",
        sub.included_billable_students AS "includedBillableStudents",
        sub.per_student_overage_cents AS "perStudentOverageCents",
        sub.current_billable_student_count AS "currentBillableStudentCount",
        sub.current_overage_student_count AS "currentOverageStudentCount",
        sub.last_billable_count_calculated_at AS "lastBillableCountCalculatedAt",
        account.status AS "accountStatus",
        plan.id AS "planId",
        plan.code AS "planCode",
        plan.name AS "planName",
        plan.billing_interval AS "billingInterval",
        plan.currency AS "currency"
      FROM ${schema}.provisioning_requests pr
      JOIN ${schema}.customer_subscriptions sub
        ON sub.id = pr.customer_subscription_id
      JOIN ${schema}.customer_accounts account
        ON account.id = sub.customer_account_id
      JOIN ${schema}.commercial_plans plan
        ON plan.id = sub.commercial_plan_id
      WHERE pr.tenant_environment_id = $1
      ORDER BY pr.created_at DESC
      LIMIT 1
    `, [tenantEnvironmentId]);
    return result.rows[0] || null;
  }

  async function assertStudentCreateAllowed() {
    return withCommercialContext(async (_client, context) => {
      ensureLifecycleAllowsWrites(context, "Students cannot be created");
    });
  }

  async function assertEnrollmentCreateAllowed(enrollment) {
    return withCommercialContext(async (client, context) => {
      ensureLifecycleAllowsWrites(context, "Enrollments cannot be created");
      if (!client || !context?.subscriptionId || !context?.tenantId) return;
      const billable = await wouldEnrollmentMakeStudentBillable(client, enrollment.studentId, enrollment.courseId);
      if (!billable) return;
      await assertBillableStudentAllowed(client, context, enrollment.studentId, "current_year_enrollment");
    });
  }

  async function assertEnrollmentUpdateAllowed(enrollment) {
    return withCommercialContext(async (client, context) => {
      ensureLifecycleAllowsWrites(context, "Enrollments cannot be changed");
      if (!client || !context?.subscriptionId || !context?.tenantId) return;
      const effectiveEnrollment = await resolveEnrollmentRecord(client, enrollment);
      const billable = await wouldEnrollmentMakeStudentBillable(client, effectiveEnrollment.studentId, effectiveEnrollment.courseId);
      if (!billable) return;
      await assertBillableStudentAllowed(client, context, effectiveEnrollment.studentId, "current_year_enrollment");
    });
  }

  async function assertPlanWriteAllowed(plan) {
    return withCommercialContext(async (client, context) => {
      ensureLifecycleAllowsWrites(context, "Plans cannot be changed");
      if (!client || !context?.subscriptionId || !context?.tenantId) return;
      const effectivePlan = await resolvePlanRecord(client, plan);
      const billable = await wouldPlanMakeStudentBillable(
        client,
        effectivePlan.studentId,
        effectivePlan.courseId,
        effectivePlan.startDate,
        effectivePlan.endDate
      );
      if (!billable) return;
      await assertBillableStudentAllowed(client, context, effectivePlan.studentId, "current_year_enrollment");
    });
  }

  async function assertAttendanceWriteAllowed(attendance) {
    return withCommercialContext(async (client, context) => {
      ensureLifecycleAllowsWrites(context, "Attendance cannot be changed");
      if (!client || !context?.subscriptionId || !context?.tenantId) return;
      const effectiveAttendance = await resolveAttendanceRecord(client, attendance);
      const currentYearBillable = await isStudentCurrentYearBillable(client, effectiveAttendance.studentId);
      if (!currentYearBillable) {
        await assertBillableStudentAllowed(client, context, effectiveAttendance.studentId, "attendance_write");
        await recordBillableStudentUsage(client, context, effectiveAttendance.studentId, "attendance_write", effectiveAttendance.id, {
          date: effectiveAttendance.date,
          present: effectiveAttendance.present
        });
      } else {
        await refreshBillableCounts(client, context);
      }
    });
  }

  async function assertTestWriteAllowed(test) {
    return withCommercialContext(async (client, context) => {
      ensureLifecycleAllowsWrites(context, "Grades cannot be changed");
      if (!client || !context?.subscriptionId || !context?.tenantId) return;
      const effectiveTest = await resolveTestRecord(client, test);
      const currentYearBillable = await isStudentCurrentYearBillable(client, effectiveTest.studentId);
      if (!currentYearBillable) {
        await assertBillableStudentAllowed(client, context, effectiveTest.studentId, "grade_write");
        await recordBillableStudentUsage(client, context, effectiveTest.studentId, "grade_write", effectiveTest.id, {
          date: effectiveTest.date,
          courseId: effectiveTest.courseId,
          subjectId: effectiveTest.subjectId,
          gradeType: effectiveTest.gradeType
        });
      } else {
        await refreshBillableCounts(client, context);
      }
    });
  }

  async function getTenantCommercialSummary() {
    return withCommercialContext(async (client, context) => {
      if (!context) return null;
      let currentBillableStudentCount = Number(context.currentBillableStudentCount || 0);
      let currentOverageStudentCount = Number(context.currentOverageStudentCount || 0);
      if (client && context.subscriptionId && context.tenantId) {
        const refreshed = await refreshBillableCounts(client, context);
        currentBillableStudentCount = refreshed.total;
        currentOverageStudentCount = refreshed.overage;
      }
      return {
        tenantId: context.tenantId,
        tenantEnvironmentId: context.tenantEnvironmentId,
        accountName: context.accountName || "",
        ownerEmail: context.ownerEmail || "",
        billingEmail: context.billingEmail || "",
        accountStatus: context.accountStatus || "",
        subscriptionId: context.subscriptionId,
        subscriptionStatus: context.subscriptionStatus || "",
        dormantStatus: context.dormantStatus || "active",
        currentPeriodStart: context.currentPeriodStart || null,
        currentPeriodEnd: context.currentPeriodEnd || null,
        basePriceCents: Number(context.basePriceCents || 0),
        includedBillableStudents: Number(context.includedBillableStudents || 0),
        perStudentOverageCents: Number(context.perStudentOverageCents || 0),
        currentBillableStudentCount,
        currentOverageStudentCount,
        lastBillableCountCalculatedAt: context.lastBillableCountCalculatedAt || null,
        planId: context.planId || "",
        planCode: context.planCode || "",
        planName: context.planName || "",
        billingInterval: context.billingInterval || "month",
        currency: context.currency || "usd"
      };
    });
  }

  async function listEligibleUpgradePlans() {
    return withCommercialContext(async (client, context) => {
      if (!client || !context?.planId) return [];
      const currentPlanResult = await client.query(`
        SELECT
          id,
          code,
          name,
          description,
          billing_interval AS "billingInterval",
          price_cents AS "priceCents",
          currency,
          stripe_price_id AS "stripePriceId",
          sort_order AS "sortOrder",
          feature_summary_json AS "featureSummary",
          limits_json AS "limits"
        FROM ${schema}.commercial_plans
        WHERE id = $1
        LIMIT 1
      `, [context.planId]);
      const currentPlan = mapCommercialPlanRow(currentPlanResult.rows[0]);
      if (!currentPlan) return [];

      const result = await client.query(`
        SELECT
          id,
          code,
          name,
          description,
          billing_interval AS "billingInterval",
          price_cents AS "priceCents",
          currency,
          stripe_price_id AS "stripePriceId",
          sort_order AS "sortOrder",
          feature_summary_json AS "featureSummary",
          limits_json AS "limits"
        FROM ${schema}.commercial_plans
        WHERE is_public = TRUE
          AND is_active = TRUE
          AND billing_interval = $2
          AND id <> $1
        ORDER BY sort_order ASC, price_cents ASC, name ASC
      `, [context.planId, currentPlan.billingInterval]);

      return result.rows
        .map(mapCommercialPlanRow)
        .filter((plan) => isHigherPlan(plan, currentPlan));
    });
  }

  async function listRecentBillingEvents(limit = 5) {
    return withCommercialContext(async (client, context) => {
      if (!client || !context?.subscriptionId) return [];
      const result = await client.query(`
        SELECT
          id,
          event_type AS "eventType",
          event_source AS "eventSource",
          stripe_event_id AS "stripeEventId",
          occurred_at AS "occurredAt",
          processing_status AS "processingStatus",
          processing_error AS "processingError",
          created_at AS "createdAt"
        FROM ${schema}.billing_events
        WHERE customer_subscription_id = $1
        ORDER BY occurred_at DESC NULLS LAST, created_at DESC
        LIMIT $2
      `, [context.subscriptionId, normalizePositiveLimit(limit, 5)]);
      return result.rows.map((row) => ({
        id: row.id,
        eventType: row.eventType,
        eventSource: row.eventSource,
        stripeEventId: row.stripeEventId,
        occurredAt: row.occurredAt,
        processingStatus: row.processingStatus,
        processingError: row.processingError,
        createdAt: row.createdAt
      }));
    });
  }

  async function listRecentExportRequests(limit = 5) {
    return withCommercialContext(async (client, context) => {
      if (!client || !context?.subscriptionId) return [];
      const result = await client.query(`
        SELECT
          id,
          status,
          price_cents AS "priceCents",
          currency,
          requested_by_email AS "requestedByEmail",
          artifact_expires_at AS "artifactExpiresAt",
          failure_reason AS "failureReason",
          created_at AS "createdAt",
          updated_at AS "updatedAt"
        FROM ${schema}.cancellation_export_requests
        WHERE customer_subscription_id = $1
        ORDER BY created_at DESC
        LIMIT $2
      `, [context.subscriptionId, normalizePositiveLimit(limit, 5)]);
      return result.rows.map((row) => ({
        id: row.id,
        status: row.status,
        priceCents: Number(row.priceCents || 0),
        currency: row.currency || "usd",
        requestedByEmail: row.requestedByEmail || "",
        artifactExpiresAt: row.artifactExpiresAt || null,
        failureReason: row.failureReason || "",
        createdAt: row.createdAt || null,
        updatedAt: row.updatedAt || null
      }));
    });
  }

  return {
    getTenantCommercialSummary,
    listEligibleUpgradePlans,
    listRecentBillingEvents,
    listRecentExportRequests,
    assertStudentCreateAllowed,
    assertEnrollmentCreateAllowed,
    assertEnrollmentUpdateAllowed,
    assertPlanWriteAllowed,
    assertAttendanceWriteAllowed,
    assertTestWriteAllowed
  };

  function ensureLifecycleAllowsWrites(context, label) {
    if (!context) return;
    const dormantStatus = String(context.dormantStatus || "active").toLowerCase();
    const accountStatus = String(context.accountStatus || "").toLowerCase();
    const subscriptionStatus = String(context.subscriptionStatus || "").toLowerCase();
    if (dormantStatus === "dormant" || dormantStatus === "pending_dormant") {
      const error = new Error(`${label} while the subscription is dormant. Reactivate the subscription to resume academic activity.`);
      error.statusCode = 409;
      throw error;
    }
    if (["suspended", "canceled"].includes(accountStatus) || ["unpaid", "canceled"].includes(subscriptionStatus)) {
      const error = new Error(`${label} because the subscription is not in an active commercial state.`);
      error.statusCode = 409;
      throw error;
    }
  }

  async function assertBillableStudentAllowed(client, context, studentId, reason) {
    const count = await refreshBillableCounts(client, context);
    if (count.billableStudentIds.has(studentId)) return;
    const allowsOverage = Number(context.perStudentOverageCents || 0) > 0;
    const included = Number(context.includedBillableStudents || 0);
    if (allowsOverage || count.total < included) return;
    const error = new Error(`This action would exceed the ${context.planName || "current"} subscription limit for billable students. Upgrade the subscription or reduce current-year billable usage before adding another ${reason === "current_year_enrollment" ? "current-year" : "historical"} billable student.`);
    error.statusCode = 409;
    throw error;
  }

  async function refreshBillableCounts(client, context) {
    const period = resolveBillingPeriod(context);
    const currentYearIds = await listCurrentYearBillableStudentIds(client);
    const historicalResult = await client.query(`
      SELECT student_id
      FROM ${schema}.billable_student_periods
      WHERE customer_subscription_id = $1
        AND billing_period_start = $2
        AND billing_period_end = $3
    `, [context.subscriptionId, period.start, period.end]);
    const billableStudentIds = new Set(currentYearIds);
    historicalResult.rows.forEach((row) => billableStudentIds.add(String(row.student_id)));
    const total = billableStudentIds.size;
    const overage = Math.max(0, total - Number(context.includedBillableStudents || 0));
    await client.query(`
      UPDATE ${schema}.customer_subscriptions
      SET
        current_billable_student_count = $2,
        current_overage_student_count = $3,
        last_billable_count_calculated_at = NOW(),
        updated_at = NOW()
      WHERE id = $1
    `, [context.subscriptionId, total, overage]);
    context.currentBillableStudentCount = total;
    return { total, overage, billableStudentIds, period };
  }

  async function recordBillableStudentUsage(client, context, studentId, eventType, sourceRecordId, payload) {
    const count = await refreshBillableCounts(client, context);
    const period = count.period;
    await client.query(`
      INSERT INTO ${schema}.billable_student_events (
        customer_subscription_id,
        tenant_id,
        student_id,
        billing_period_start,
        billing_period_end,
        event_type,
        event_source,
        source_record_id,
        payload_json
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'tenant_runtime', $7, $8::jsonb)
    `, [
      context.subscriptionId,
      context.tenantId,
      studentId,
      period.start,
      period.end,
      eventType,
      sourceRecordId || null,
      JSON.stringify(payload || {})
    ]);
    await client.query(`
      INSERT INTO ${schema}.billable_student_periods (
        customer_subscription_id,
        tenant_id,
        billing_period_start,
        billing_period_end,
        student_id,
        first_reason
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (customer_subscription_id, billing_period_start, billing_period_end, student_id)
      DO NOTHING
    `, [
      context.subscriptionId,
      context.tenantId,
      period.start,
      period.end,
      studentId,
      eventType
    ]);
    await refreshBillableCounts(client, context);
  }

  function resolveBillingPeriod(context) {
    const start = context?.currentPeriodStart ? new Date(context.currentPeriodStart) : startOfUtcMonth(new Date());
    const end = context?.currentPeriodEnd ? new Date(context.currentPeriodEnd) : endOfUtcMonth(start);
    return {
      start: start.toISOString(),
      end: end.toISOString()
    };
  }

  async function listCurrentYearBillableStudentIds(client) {
    const currentYear = await client.query(`
      SELECT start_date AS "startDate", end_date AS "endDate"
      FROM school_years
      WHERE is_current = TRUE
      LIMIT 1
    `);
    const schoolYear = currentYear.rows[0];
    if (!schoolYear) return [];
    const result = await client.query(`
      SELECT DISTINCT p.student_id AS "studentId"
      FROM plans p
      WHERE p.start_date <= $2::date
        AND p.end_date >= $1::date
        AND EXISTS (
          SELECT 1
          FROM enrollments e
          WHERE e.student_id = p.student_id
            AND e.course_id = p.course_id
        )
    `, [schoolYear.startDate, schoolYear.endDate]);
    return result.rows.map((row) => String(row.studentId));
  }

  async function isStudentCurrentYearBillable(client, studentId) {
    const currentYear = await client.query(`
      SELECT start_date AS "startDate", end_date AS "endDate"
      FROM school_years
      WHERE is_current = TRUE
      LIMIT 1
    `);
    const schoolYear = currentYear.rows[0];
    if (!schoolYear) return false;
    const result = await client.query(`
      SELECT 1
      FROM plans p
      WHERE p.student_id = $1
        AND p.start_date <= $3::date
        AND p.end_date >= $2::date
        AND EXISTS (
          SELECT 1
          FROM enrollments e
          WHERE e.student_id = p.student_id
            AND e.course_id = p.course_id
        )
      LIMIT 1
    `, [studentId, schoolYear.startDate, schoolYear.endDate]);
    return !!result.rows[0];
  }

  async function wouldEnrollmentMakeStudentBillable(client, studentId, courseId) {
    const currentYear = await client.query(`
      SELECT start_date AS "startDate", end_date AS "endDate"
      FROM school_years
      WHERE is_current = TRUE
      LIMIT 1
    `);
    const schoolYear = currentYear.rows[0];
    if (!schoolYear) return false;
    const result = await client.query(`
      SELECT 1
      FROM plans
      WHERE student_id = $1
        AND course_id = $2
        AND start_date <= $4::date
        AND end_date >= $3::date
      LIMIT 1
    `, [studentId, courseId, schoolYear.startDate, schoolYear.endDate]);
    return !!result.rows[0];
  }

  async function wouldPlanMakeStudentBillable(client, studentId, courseId, startDate, endDate) {
    const currentYear = await client.query(`
      SELECT start_date AS "startDate", end_date AS "endDate"
      FROM school_years
      WHERE is_current = TRUE
      LIMIT 1
    `);
    const schoolYear = currentYear.rows[0];
    if (!schoolYear || !studentId || !courseId || !startDate || !endDate) return false;
    const overlaps = String(startDate) <= String(schoolYear.endDate) && String(endDate) >= String(schoolYear.startDate);
    if (!overlaps) return false;
    const enrollment = await client.query(`
      SELECT 1
      FROM enrollments
      WHERE student_id = $1
        AND course_id = $2
      LIMIT 1
    `, [studentId, courseId]);
    return !!enrollment.rows[0];
  }

  async function resolveEnrollmentRecord(client, enrollment) {
    if (enrollment?.studentId && enrollment?.courseId) return enrollment;
    const existing = await fetchById(client, "enrollments", enrollment?.id, `
      SELECT
        id,
        student_id AS "studentId",
        course_id AS "courseId"
      FROM enrollments
      WHERE id = $1
      LIMIT 1
    `);
    return {
      ...existing,
      ...enrollment,
      studentId: enrollment?.studentId || existing.studentId,
      courseId: enrollment?.courseId || existing.courseId
    };
  }

  async function resolvePlanRecord(client, plan) {
    if (plan?.studentId && plan?.courseId && plan?.startDate && plan?.endDate) return plan;
    const existing = await fetchById(client, "plans", plan?.id, `
      SELECT
        id,
        student_id AS "studentId",
        course_id AS "courseId",
        start_date AS "startDate",
        end_date AS "endDate"
      FROM plans
      WHERE id = $1
      LIMIT 1
    `);
    return {
      ...existing,
      ...plan,
      studentId: plan?.studentId || existing.studentId,
      courseId: plan?.courseId || existing.courseId,
      startDate: plan?.startDate || existing.startDate,
      endDate: plan?.endDate || existing.endDate
    };
  }

  async function resolveAttendanceRecord(client, attendance) {
    if (attendance?.studentId && attendance?.date) return attendance;
    const existing = await fetchById(client, "attendance", attendance?.id, `
      SELECT
        id,
        student_id AS "studentId",
        attendance_date AS "date",
        present
      FROM attendance
      WHERE id = $1
      LIMIT 1
    `);
    return {
      ...existing,
      ...attendance,
      studentId: attendance?.studentId || existing.studentId,
      date: attendance?.date || existing.date,
      present: typeof attendance?.present === "boolean" ? attendance.present : existing.present
    };
  }

  async function resolveTestRecord(client, test) {
    if (test?.studentId && test?.date && test?.courseId && test?.subjectId && test?.gradeType) return test;
    const existing = await fetchById(client, "tests", test?.id, `
      SELECT
        id,
        test_date AS "date",
        student_id AS "studentId",
        subject_id AS "subjectId",
        course_id AS "courseId",
        grade_type AS "gradeType"
      FROM tests
      WHERE id = $1
      LIMIT 1
    `);
    return {
      ...existing,
      ...test,
      studentId: test?.studentId || existing.studentId,
      date: test?.date || existing.date,
      courseId: test?.courseId || existing.courseId,
      subjectId: test?.subjectId || existing.subjectId,
      gradeType: test?.gradeType || existing.gradeType
    };
  }

  async function fetchById(client, label, id, queryText) {
    const normalizedId = String(id || "").trim();
    if (!normalizedId) {
      const error = new Error(`A valid ${label} record id is required for this commercial policy check.`);
      error.statusCode = 400;
      throw error;
    }
    const result = await client.query(queryText, [normalizedId]);
    if (result.rows[0]) return result.rows[0];
    const error = new Error(`${capitalizeLabel(label)} record not found.`);
    error.statusCode = 404;
    throw error;
  }

  function mapCommercialPlanRow(row) {
    if (!row) return null;
    return {
      id: row.id,
      code: row.code,
      name: row.name,
      description: row.description || "",
      billingInterval: row.billingInterval || "month",
      priceCents: Number(row.priceCents || 0),
      currency: row.currency || "usd",
      stripePriceId: row.stripePriceId || "",
      sortOrder: Number(row.sortOrder || 0),
      featureSummary: Array.isArray(row.featureSummary) ? row.featureSummary : [],
      limits: row.limits && typeof row.limits === "object" ? row.limits : {}
    };
  }

  function isHigherPlan(plan, currentPlan) {
    const currentIncluded = Number(currentPlan?.limits?.includedBillableStudents || 0);
    const nextIncluded = Number(plan?.limits?.includedBillableStudents || 0);
    return Number(plan?.sortOrder || 0) > Number(currentPlan?.sortOrder || 0)
      || Number(plan?.priceCents || 0) > Number(currentPlan?.priceCents || 0)
      || nextIncluded > currentIncluded;
  }

  function normalizePositiveLimit(value, fallback) {
    const normalized = Number(value);
    return Number.isFinite(normalized) && normalized > 0 ? Math.floor(normalized) : fallback;
  }
}

function qualifySchema(value) {
  const normalized = String(value || "").trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(normalized)) {
    throw new Error("Commercial control schema must be a simple PostgreSQL identifier.");
  }
  return `"${normalized}"`;
}

function startOfUtcMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0));
}

function endOfUtcMonth(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0));
}

function capitalizeLabel(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "Record";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

module.exports = {
  createCommercialPolicyService
};
