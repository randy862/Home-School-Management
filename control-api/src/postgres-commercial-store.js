const { randomUUID } = require("crypto");
const { getPostgresPool } = require("./postgres-db");

function mapCommercialPlanRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description || "",
    billingInterval: row.billingInterval ?? row.billing_interval,
    priceCents: Number(row.priceCents ?? row.price_cents ?? 0),
    currency: row.currency || "usd",
    stripeProductId: row.stripeProductId ?? row.stripe_product_id ?? null,
    stripePriceId: row.stripePriceId ?? row.stripe_price_id ?? null,
    isPublic: row.isPublic ?? row.is_public ?? false,
    isActive: row.isActive ?? row.is_active ?? false,
    sortOrder: Number(row.sortOrder ?? row.sort_order ?? 0),
    featureSummary: row.featureSummary ?? row.feature_summary_json ?? [],
    limits: row.limits ?? row.limits_json ?? {},
    createdAt: row.createdAt ?? row.created_at ?? null,
    updatedAt: row.updatedAt ?? row.updated_at ?? null
  };
}

function mapBillingEventRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    customerAccountId: row.customerAccountId ?? row.customer_account_id ?? null,
    customerSubscriptionId: row.customerSubscriptionId ?? row.customer_subscription_id ?? null,
    eventType: row.eventType ?? row.event_type,
    eventSource: row.eventSource ?? row.event_source,
    stripeEventId: row.stripeEventId ?? row.stripe_event_id,
    stripeObjectId: row.stripeObjectId ?? row.stripe_object_id ?? null,
    occurredAt: row.occurredAt ?? row.occurred_at ?? null,
    payload: row.payload ?? row.payload_json ?? {},
    processedAt: row.processedAt ?? row.processed_at ?? null,
    processingStatus: row.processingStatus ?? row.processing_status,
    processingError: row.processingError ?? row.processing_error ?? null,
    createdAt: row.createdAt ?? row.created_at ?? null
  };
}

function mapProvisioningRequestRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    customerAccountId: row.customerAccountId ?? row.customer_account_id,
    customerSubscriptionId: row.customerSubscriptionId ?? row.customer_subscription_id,
    commercialPlanId: row.commercialPlanId ?? row.commercial_plan_id,
    status: row.status,
    triggerSource: row.triggerSource ?? row.trigger_source,
    requestedSubdomainLabel: row.requestedSubdomainLabel ?? row.requested_subdomain_label ?? "",
    tenantId: row.tenantId ?? row.tenant_id ?? null,
    tenantEnvironmentId: row.tenantEnvironmentId ?? row.tenant_environment_id ?? null,
    provisioningJobId: row.provisioningJobId ?? row.provisioning_job_id ?? null,
    resultAccessUrl: row.resultAccessUrl ?? row.result_access_url ?? null,
    resultSetupTokenIssued: row.resultSetupTokenIssued ?? row.result_setup_token_issued ?? false,
    failureReason: row.failureReason ?? row.failure_reason ?? null,
    createdAt: row.createdAt ?? row.created_at ?? null,
    updatedAt: row.updatedAt ?? row.updated_at ?? null,
    completedAt: row.completedAt ?? row.completed_at ?? null
  };
}

function mapAccessHandoffRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    customerAccountId: row.customerAccountId ?? row.customer_account_id,
    customerSubscriptionId: row.customerSubscriptionId ?? row.customer_subscription_id,
    provisioningRequestId: row.provisioningRequestId ?? row.provisioning_request_id,
    signupStatusToken: row.signupStatusToken ?? row.signup_status_token,
    tenantUrl: row.tenantUrl ?? row.tenant_url ?? null,
    adminSetupMode: row.adminSetupMode ?? row.admin_setup_mode,
    setupToken: row.setupToken ?? row.setup_token ?? null,
    setupTokenExpiresAt: row.setupTokenExpiresAt ?? row.setup_token_expires_at ?? null,
    deliveryChannel: row.deliveryChannel ?? row.delivery_channel ?? null,
    deliveredAt: row.deliveredAt ?? row.delivered_at ?? null,
    lastViewedAt: row.lastViewedAt ?? row.last_viewed_at ?? null,
    createdAt: row.createdAt ?? row.created_at ?? null
  };
}

function mapCommercialOverviewRow(row) {
  if (!row) return null;
  return {
    customerAccountId: row.customerAccountId ?? row.customer_account_id,
    accountName: row.accountName ?? row.account_name,
    accountSlug: row.accountSlug ?? row.account_slug,
    accountStatus: row.accountStatus ?? row.account_status,
    ownerName: row.ownerName ?? row.owner_name ?? "",
    ownerEmail: row.ownerEmail ?? row.owner_email ?? "",
    billingEmail: row.billingEmail ?? row.billing_email ?? "",
    commercialPlanId: row.commercialPlanId ?? row.commercial_plan_id ?? null,
    planCode: row.planCode ?? row.plan_code ?? "",
    planName: row.planName ?? row.plan_name ?? "",
    planPriceCents: Number(row.planPriceCents ?? row.plan_price_cents ?? 0),
    subscriptionId: row.subscriptionId ?? row.subscription_id ?? null,
    subscriptionStatus: row.subscriptionStatus ?? row.subscription_status ?? "",
    dormantStatus: row.dormantStatus ?? row.dormant_status ?? "active",
    basePriceCents: Number(row.basePriceCents ?? row.base_price_cents ?? 0),
    includedBillableStudents: Number(row.includedBillableStudents ?? row.included_billable_students ?? 0),
    perStudentOverageCents: Number(row.perStudentOverageCents ?? row.per_student_overage_cents ?? 0),
    currentBillableStudentCount: Number(row.currentBillableStudentCount ?? row.current_billable_student_count ?? 0),
    currentOverageStudentCount: Number(row.currentOverageStudentCount ?? row.current_overage_student_count ?? 0),
    lastBillableCountCalculatedAt: row.lastBillableCountCalculatedAt ?? row.last_billable_count_calculated_at ?? null,
    stripeSubscriptionId: row.stripeSubscriptionId ?? row.stripe_subscription_id ?? null,
    checkoutSessionId: row.checkoutSessionId ?? row.checkout_session_id ?? null,
    checkoutStatus: row.checkoutStatus ?? row.checkout_status ?? "",
    provisioningRequestId: row.provisioningRequestId ?? row.provisioning_request_id ?? null,
    provisioningStatus: row.provisioningStatus ?? row.provisioning_status ?? "",
    requestedSubdomainLabel: row.requestedSubdomainLabel ?? row.requested_subdomain_label ?? "",
    resultAccessUrl: row.resultAccessUrl ?? row.result_access_url ?? "",
    tenantUrl: row.tenantUrl ?? row.tenant_url ?? "",
    tenantId: row.tenantId ?? row.tenant_id ?? null,
    tenantEnvironmentId: row.tenantEnvironmentId ?? row.tenant_environment_id ?? null,
    signupStatusToken: row.signupStatusToken ?? row.signup_status_token ?? null,
    createdAt: row.createdAt ?? row.created_at ?? null,
    updatedAt: row.updatedAt ?? row.updated_at ?? null
  };
}

function mapCustomerSubscriptionRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    customerAccountId: row.customerAccountId ?? row.customer_account_id,
    commercialPlanId: row.commercialPlanId ?? row.commercial_plan_id,
    status: row.status,
    dormantStatus: row.dormantStatus ?? row.dormant_status ?? "active",
    stripeSubscriptionId: row.stripeSubscriptionId ?? row.stripe_subscription_id ?? null,
    stripeCheckoutSessionId: row.stripeCheckoutSessionId ?? row.stripe_checkout_session_id ?? null,
    currentPeriodStart: row.currentPeriodStart ?? row.current_period_start ?? null,
    currentPeriodEnd: row.currentPeriodEnd ?? row.current_period_end ?? null,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd ?? row.cancel_at_period_end ?? false,
    canceledAt: row.canceledAt ?? row.canceled_at ?? null,
    trialEndsAt: row.trialEndsAt ?? row.trial_ends_at ?? null,
    gracePeriodEndsAt: row.gracePeriodEndsAt ?? row.grace_period_ends_at ?? null,
    basePriceCents: Number(row.basePriceCents ?? row.base_price_cents ?? 0),
    includedBillableStudents: Number(row.includedBillableStudents ?? row.included_billable_students ?? 0),
    perStudentOverageCents: Number(row.perStudentOverageCents ?? row.per_student_overage_cents ?? 0),
    currentBillableStudentCount: Number(row.currentBillableStudentCount ?? row.current_billable_student_count ?? 0),
    currentOverageStudentCount: Number(row.currentOverageStudentCount ?? row.current_overage_student_count ?? 0),
    lastBillableCountCalculatedAt: row.lastBillableCountCalculatedAt ?? row.last_billable_count_calculated_at ?? null,
    createdAt: row.createdAt ?? row.created_at ?? null,
    updatedAt: row.updatedAt ?? row.updated_at ?? null
  };
}

function mapCancellationExportRequestRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    customerAccountId: row.customerAccountId ?? row.customer_account_id,
    customerSubscriptionId: row.customerSubscriptionId ?? row.customer_subscription_id,
    status: row.status,
    priceCents: Number(row.priceCents ?? row.price_cents ?? 0),
    currency: row.currency || "usd",
    requestedByEmail: row.requestedByEmail ?? row.requested_by_email ?? null,
    paymentReference: row.paymentReference ?? row.payment_reference ?? null,
    exportJobId: row.exportJobId ?? row.export_job_id ?? null,
    artifactPath: row.artifactPath ?? row.artifact_path ?? null,
    artifactExpiresAt: row.artifactExpiresAt ?? row.artifact_expires_at ?? null,
    failureReason: row.failureReason ?? row.failure_reason ?? null,
    createdAt: row.createdAt ?? row.created_at ?? null,
    updatedAt: row.updatedAt ?? row.updated_at ?? null
  };
}

async function listPublicCommercialPlans() {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      code,
      name,
      description,
      billing_interval AS "billingInterval",
      price_cents AS "priceCents",
      currency,
      stripe_product_id AS "stripeProductId",
      stripe_price_id AS "stripePriceId",
      is_public AS "isPublic",
      is_active AS "isActive",
      sort_order AS "sortOrder",
      feature_summary_json AS "featureSummary",
      limits_json AS "limits",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM commercial_plans
    WHERE is_public = TRUE
      AND is_active = TRUE
    ORDER BY sort_order ASC, price_cents ASC, name ASC
  `);
  return result.rows.map(mapCommercialPlanRow);
}

async function getPublicCommercialPlanByCode(code) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      code,
      name,
      description,
      billing_interval AS "billingInterval",
      price_cents AS "priceCents",
      currency,
      stripe_product_id AS "stripeProductId",
      stripe_price_id AS "stripePriceId",
      is_public AS "isPublic",
      is_active AS "isActive",
      sort_order AS "sortOrder",
      feature_summary_json AS "featureSummary",
      limits_json AS "limits",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM commercial_plans
    WHERE code = $1
      AND is_public = TRUE
      AND is_active = TRUE
    LIMIT 1
  `, [code]);
  return mapCommercialPlanRow(result.rows[0]);
}

async function getCommercialPlanById(id) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      code,
      name,
      description,
      billing_interval AS "billingInterval",
      price_cents AS "priceCents",
      currency,
      stripe_product_id AS "stripeProductId",
      stripe_price_id AS "stripePriceId",
      is_public AS "isPublic",
      is_active AS "isActive",
      sort_order AS "sortOrder",
      feature_summary_json AS "featureSummary",
      limits_json AS "limits",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM commercial_plans
    WHERE id = $1
    LIMIT 1
  `, [id]);
  return mapCommercialPlanRow(result.rows[0]);
}

async function getCommercialPlanByStripePriceId(stripePriceId) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      code,
      name,
      description,
      billing_interval AS "billingInterval",
      price_cents AS "priceCents",
      currency,
      stripe_product_id AS "stripeProductId",
      stripe_price_id AS "stripePriceId",
      is_public AS "isPublic",
      is_active AS "isActive",
      sort_order AS "sortOrder",
      feature_summary_json AS "featureSummary",
      limits_json AS "limits",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM commercial_plans
    WHERE stripe_price_id = $1
    LIMIT 1
  `, [stripePriceId]);
  return mapCommercialPlanRow(result.rows[0]);
}

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

async function createCheckoutCustomerAccount(input) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const baseSlug = slugify(input.requestedSubdomainLabel || input.accountName || `account-${randomUUID()}`) || `account-${randomUUID()}`;
    let accountSlug = baseSlug;
    let suffix = 1;

    while (true) {
      const existing = await client.query("SELECT 1 FROM customer_accounts WHERE account_slug = $1 LIMIT 1", [accountSlug]);
      if (!existing.rows.length) break;
      suffix += 1;
      accountSlug = `${baseSlug}-${suffix}`;
    }

    const accountId = `acct-${randomUUID()}`;
    const result = await client.query(`
      INSERT INTO customer_accounts (
        id,
        account_name,
        account_slug,
        status,
        owner_first_name,
        owner_last_name,
        owner_email,
        owner_phone,
        billing_email,
        notes,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, 'checkout_started', $4, $5, $6, $7, $8, $9, NOW(), NOW())
      RETURNING
        id,
        account_name AS "accountName",
        account_slug AS "accountSlug",
        status,
        owner_first_name AS "ownerFirstName",
        owner_last_name AS "ownerLastName",
        owner_email AS "ownerEmail",
        owner_phone AS "ownerPhone",
        billing_email AS "billingEmail",
        stripe_customer_id AS "stripeCustomerId",
        notes,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `, [
      accountId,
      input.accountName,
      accountSlug,
      input.ownerFirstName,
      input.ownerLastName,
      input.ownerEmail,
      input.ownerPhone || null,
      input.billingEmail || null,
      input.notes || null
    ]);

    await client.query("COMMIT");
    return result.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function getCustomerAccountById(id) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      account_name AS "accountName",
      account_slug AS "accountSlug",
      status,
      owner_first_name AS "ownerFirstName",
      owner_last_name AS "ownerLastName",
      owner_email AS "ownerEmail",
      owner_phone AS "ownerPhone",
      billing_email AS "billingEmail",
      stripe_customer_id AS "stripeCustomerId",
      notes,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM customer_accounts
    WHERE id = $1
    LIMIT 1
  `, [id]);
  return result.rows[0] || null;
}

async function createCheckoutSubscription(input) {
  const pool = getPostgresPool();
  const plan = await getCommercialPlanById(input.commercialPlanId);
  const includedBillableStudents = Number(plan?.limits?.includedBillableStudents || 0);
  const perStudentOverageCents = Number(plan?.limits?.perStudentOverageCents || 0);
  const result = await pool.query(`
    INSERT INTO customer_subscriptions (
      id,
      customer_account_id,
      commercial_plan_id,
      status,
      stripe_checkout_session_id,
      dormant_status,
      base_price_cents,
      included_billable_students,
      per_student_overage_cents,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, 'incomplete', $4, 'active', $5, $6, $7, NOW(), NOW())
    RETURNING
      id,
      customer_account_id AS "customerAccountId",
      commercial_plan_id AS "commercialPlanId",
      status,
      dormant_status AS "dormantStatus",
      stripe_subscription_id AS "stripeSubscriptionId",
      stripe_checkout_session_id AS "stripeCheckoutSessionId",
      current_period_start AS "currentPeriodStart",
      current_period_end AS "currentPeriodEnd",
      cancel_at_period_end AS "cancelAtPeriodEnd",
      canceled_at AS "canceledAt",
      trial_ends_at AS "trialEndsAt",
      grace_period_ends_at AS "gracePeriodEndsAt",
      base_price_cents AS "basePriceCents",
      included_billable_students AS "includedBillableStudents",
      per_student_overage_cents AS "perStudentOverageCents",
      current_billable_student_count AS "currentBillableStudentCount",
      current_overage_student_count AS "currentOverageStudentCount",
      last_billable_count_calculated_at AS "lastBillableCountCalculatedAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `, [
    `sub-${randomUUID()}`,
    input.customerAccountId,
    input.commercialPlanId,
    input.stripeCheckoutSessionId,
    Number(plan?.priceCents || 0),
    includedBillableStudents,
    perStudentOverageCents
  ]);
  return mapCustomerSubscriptionRow(result.rows[0]);
}

async function createCheckoutSessionRecord(input) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    INSERT INTO checkout_sessions (
      id,
      customer_account_id,
      commercial_plan_id,
      status,
      stripe_checkout_session_id,
      stripe_checkout_url,
      requested_subdomain_label,
      success_token,
      cancel_token,
      expires_at,
      created_at
    )
    VALUES ($1, $2, $3, 'created', $4, $5, $6, $7, $8, $9, NOW())
    RETURNING
      id,
      customer_account_id AS "customerAccountId",
      commercial_plan_id AS "commercialPlanId",
      status,
      stripe_checkout_session_id AS "stripeCheckoutSessionId",
      stripe_checkout_url AS "stripeCheckoutUrl",
      requested_subdomain_label AS "requestedSubdomainLabel",
      success_token AS "successToken",
      cancel_token AS "cancelToken",
      expires_at AS "expiresAt",
      completed_at AS "completedAt",
      created_at AS "createdAt"
  `, [
    `checkout-${randomUUID()}`,
    input.customerAccountId,
    input.commercialPlanId,
    input.stripeCheckoutSessionId,
    input.stripeCheckoutUrl || null,
    input.requestedSubdomainLabel || null,
    input.successToken,
    input.cancelToken,
    input.expiresAt || null
  ]);
  return result.rows[0];
}

async function getCheckoutSessionByStripeSessionId(stripeCheckoutSessionId) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      customer_account_id AS "customerAccountId",
      commercial_plan_id AS "commercialPlanId",
      status,
      stripe_checkout_session_id AS "stripeCheckoutSessionId",
      stripe_checkout_url AS "stripeCheckoutUrl",
      requested_subdomain_label AS "requestedSubdomainLabel",
      success_token AS "successToken",
      cancel_token AS "cancelToken",
      expires_at AS "expiresAt",
      completed_at AS "completedAt",
      created_at AS "createdAt"
    FROM checkout_sessions
    WHERE stripe_checkout_session_id = $1
    LIMIT 1
  `, [stripeCheckoutSessionId]);
  return result.rows[0] || null;
}

async function markCheckoutSessionCompleted(stripeCheckoutSessionId) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    UPDATE checkout_sessions
    SET
      status = 'completed',
      completed_at = COALESCE(completed_at, NOW())
    WHERE stripe_checkout_session_id = $1
    RETURNING
      id,
      customer_account_id AS "customerAccountId",
      commercial_plan_id AS "commercialPlanId",
      status,
      stripe_checkout_session_id AS "stripeCheckoutSessionId",
      stripe_checkout_url AS "stripeCheckoutUrl",
      requested_subdomain_label AS "requestedSubdomainLabel",
      success_token AS "successToken",
      cancel_token AS "cancelToken",
      expires_at AS "expiresAt",
      completed_at AS "completedAt",
      created_at AS "createdAt"
  `, [stripeCheckoutSessionId]);
  return result.rows[0] || null;
}

async function getSubscriptionByStripeCheckoutSessionId(stripeCheckoutSessionId) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      customer_account_id AS "customerAccountId",
      commercial_plan_id AS "commercialPlanId",
      status,
      dormant_status AS "dormantStatus",
      stripe_subscription_id AS "stripeSubscriptionId",
      stripe_checkout_session_id AS "stripeCheckoutSessionId",
      current_period_start AS "currentPeriodStart",
      current_period_end AS "currentPeriodEnd",
      cancel_at_period_end AS "cancelAtPeriodEnd",
      canceled_at AS "canceledAt",
      trial_ends_at AS "trialEndsAt",
      grace_period_ends_at AS "gracePeriodEndsAt",
      base_price_cents AS "basePriceCents",
      included_billable_students AS "includedBillableStudents",
      per_student_overage_cents AS "perStudentOverageCents",
      current_billable_student_count AS "currentBillableStudentCount",
      current_overage_student_count AS "currentOverageStudentCount",
      last_billable_count_calculated_at AS "lastBillableCountCalculatedAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM customer_subscriptions
    WHERE stripe_checkout_session_id = $1
    LIMIT 1
  `, [stripeCheckoutSessionId]);
  return mapCustomerSubscriptionRow(result.rows[0]);
}

async function getSubscriptionByStripeSubscriptionId(stripeSubscriptionId) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      customer_account_id AS "customerAccountId",
      commercial_plan_id AS "commercialPlanId",
      status,
      dormant_status AS "dormantStatus",
      stripe_subscription_id AS "stripeSubscriptionId",
      stripe_checkout_session_id AS "stripeCheckoutSessionId",
      current_period_start AS "currentPeriodStart",
      current_period_end AS "currentPeriodEnd",
      cancel_at_period_end AS "cancelAtPeriodEnd",
      canceled_at AS "canceledAt",
      trial_ends_at AS "trialEndsAt",
      grace_period_ends_at AS "gracePeriodEndsAt",
      base_price_cents AS "basePriceCents",
      included_billable_students AS "includedBillableStudents",
      per_student_overage_cents AS "perStudentOverageCents",
      current_billable_student_count AS "currentBillableStudentCount",
      current_overage_student_count AS "currentOverageStudentCount",
      last_billable_count_calculated_at AS "lastBillableCountCalculatedAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM customer_subscriptions
    WHERE stripe_subscription_id = $1
    LIMIT 1
  `, [stripeSubscriptionId]);
  return mapCustomerSubscriptionRow(result.rows[0]);
}

async function updateSubscriptionByStripeCheckoutSessionId(stripeCheckoutSessionId, updates = {}) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    UPDATE customer_subscriptions
    SET
      status = COALESCE($2, status),
      stripe_subscription_id = COALESCE($3, stripe_subscription_id),
      current_period_start = COALESCE($4, current_period_start),
      current_period_end = COALESCE($5, current_period_end),
      cancel_at_period_end = COALESCE($6, cancel_at_period_end),
      canceled_at = COALESCE($7, canceled_at),
      trial_ends_at = COALESCE($8, trial_ends_at),
      grace_period_ends_at = COALESCE($9, grace_period_ends_at),
      dormant_status = COALESCE($10, dormant_status),
      current_billable_student_count = COALESCE($11, current_billable_student_count),
      current_overage_student_count = COALESCE($12, current_overage_student_count),
      last_billable_count_calculated_at = COALESCE($13, last_billable_count_calculated_at),
      updated_at = NOW()
    WHERE stripe_checkout_session_id = $1
    RETURNING
      id,
      customer_account_id AS "customerAccountId",
      commercial_plan_id AS "commercialPlanId",
      status,
      dormant_status AS "dormantStatus",
      stripe_subscription_id AS "stripeSubscriptionId",
      stripe_checkout_session_id AS "stripeCheckoutSessionId",
      current_period_start AS "currentPeriodStart",
      current_period_end AS "currentPeriodEnd",
      cancel_at_period_end AS "cancelAtPeriodEnd",
      canceled_at AS "canceledAt",
      trial_ends_at AS "trialEndsAt",
      grace_period_ends_at AS "gracePeriodEndsAt",
      base_price_cents AS "basePriceCents",
      included_billable_students AS "includedBillableStudents",
      per_student_overage_cents AS "perStudentOverageCents",
      current_billable_student_count AS "currentBillableStudentCount",
      current_overage_student_count AS "currentOverageStudentCount",
      last_billable_count_calculated_at AS "lastBillableCountCalculatedAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `, [
    stripeCheckoutSessionId,
    updates.status || null,
    updates.stripeSubscriptionId || null,
    updates.currentPeriodStart || null,
    updates.currentPeriodEnd || null,
    typeof updates.cancelAtPeriodEnd === "boolean" ? updates.cancelAtPeriodEnd : null,
    updates.canceledAt || null,
    updates.trialEndsAt || null,
    updates.gracePeriodEndsAt || null,
    updates.dormantStatus || null,
    Number.isInteger(updates.currentBillableStudentCount) ? updates.currentBillableStudentCount : null,
    Number.isInteger(updates.currentOverageStudentCount) ? updates.currentOverageStudentCount : null,
    updates.lastBillableCountCalculatedAt || null
  ]);
  return mapCustomerSubscriptionRow(result.rows[0]);
}

async function updateSubscriptionByStripeSubscriptionId(stripeSubscriptionId, updates = {}) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    UPDATE customer_subscriptions
    SET
      status = COALESCE($2, status),
      stripe_checkout_session_id = COALESCE($3, stripe_checkout_session_id),
      current_period_start = COALESCE($4, current_period_start),
      current_period_end = COALESCE($5, current_period_end),
      cancel_at_period_end = COALESCE($6, cancel_at_period_end),
      canceled_at = COALESCE($7, canceled_at),
      trial_ends_at = COALESCE($8, trial_ends_at),
      grace_period_ends_at = COALESCE($9, grace_period_ends_at),
      dormant_status = COALESCE($10, dormant_status),
      current_billable_student_count = COALESCE($11, current_billable_student_count),
      current_overage_student_count = COALESCE($12, current_overage_student_count),
      last_billable_count_calculated_at = COALESCE($13, last_billable_count_calculated_at),
      updated_at = NOW()
    WHERE stripe_subscription_id = $1
    RETURNING
      id,
      customer_account_id AS "customerAccountId",
      commercial_plan_id AS "commercialPlanId",
      status,
      dormant_status AS "dormantStatus",
      stripe_subscription_id AS "stripeSubscriptionId",
      stripe_checkout_session_id AS "stripeCheckoutSessionId",
      current_period_start AS "currentPeriodStart",
      current_period_end AS "currentPeriodEnd",
      cancel_at_period_end AS "cancelAtPeriodEnd",
      canceled_at AS "canceledAt",
      trial_ends_at AS "trialEndsAt",
      grace_period_ends_at AS "gracePeriodEndsAt",
      base_price_cents AS "basePriceCents",
      included_billable_students AS "includedBillableStudents",
      per_student_overage_cents AS "perStudentOverageCents",
      current_billable_student_count AS "currentBillableStudentCount",
      current_overage_student_count AS "currentOverageStudentCount",
      last_billable_count_calculated_at AS "lastBillableCountCalculatedAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `, [
    stripeSubscriptionId,
    updates.status || null,
    updates.stripeCheckoutSessionId || null,
    updates.currentPeriodStart || null,
    updates.currentPeriodEnd || null,
    typeof updates.cancelAtPeriodEnd === "boolean" ? updates.cancelAtPeriodEnd : null,
    updates.canceledAt || null,
    updates.trialEndsAt || null,
    updates.gracePeriodEndsAt || null,
    updates.dormantStatus || null,
    Number.isInteger(updates.currentBillableStudentCount) ? updates.currentBillableStudentCount : null,
    Number.isInteger(updates.currentOverageStudentCount) ? updates.currentOverageStudentCount : null,
    updates.lastBillableCountCalculatedAt || null
  ]);
  return mapCustomerSubscriptionRow(result.rows[0]);
}

async function getCommercialSubscriptionById(id) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      customer_account_id AS "customerAccountId",
      commercial_plan_id AS "commercialPlanId",
      status,
      dormant_status AS "dormantStatus",
      stripe_subscription_id AS "stripeSubscriptionId",
      stripe_checkout_session_id AS "stripeCheckoutSessionId",
      current_period_start AS "currentPeriodStart",
      current_period_end AS "currentPeriodEnd",
      cancel_at_period_end AS "cancelAtPeriodEnd",
      canceled_at AS "canceledAt",
      trial_ends_at AS "trialEndsAt",
      grace_period_ends_at AS "gracePeriodEndsAt",
      base_price_cents AS "basePriceCents",
      included_billable_students AS "includedBillableStudents",
      per_student_overage_cents AS "perStudentOverageCents",
      current_billable_student_count AS "currentBillableStudentCount",
      current_overage_student_count AS "currentOverageStudentCount",
      last_billable_count_calculated_at AS "lastBillableCountCalculatedAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM customer_subscriptions
    WHERE id = $1
    LIMIT 1
  `, [id]);
  return mapCustomerSubscriptionRow(result.rows[0]);
}

async function getCommercialOverviewBySubscriptionId(id) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      account.id AS "customerAccountId",
      account.account_name AS "accountName",
      account.account_slug AS "accountSlug",
      account.status AS "accountStatus",
      TRIM(CONCAT(account.owner_first_name, ' ', account.owner_last_name)) AS "ownerName",
      account.owner_email AS "ownerEmail",
      account.billing_email AS "billingEmail",
      account.created_at AS "createdAt",
      account.updated_at AS "updatedAt",
      plan.id AS "commercialPlanId",
      plan.code AS "planCode",
      plan.name AS "planName",
      plan.price_cents AS "planPriceCents",
      subscription.id AS "subscriptionId",
      subscription.status AS "subscriptionStatus",
      subscription.dormant_status AS "dormantStatus",
      subscription.base_price_cents AS "basePriceCents",
      subscription.included_billable_students AS "includedBillableStudents",
      subscription.per_student_overage_cents AS "perStudentOverageCents",
      subscription.current_billable_student_count AS "currentBillableStudentCount",
      subscription.current_overage_student_count AS "currentOverageStudentCount",
      subscription.last_billable_count_calculated_at AS "lastBillableCountCalculatedAt",
      subscription.stripe_subscription_id AS "stripeSubscriptionId",
      checkout.stripe_checkout_session_id AS "checkoutSessionId",
      checkout.status AS "checkoutStatus",
      provisioning.id AS "provisioningRequestId",
      provisioning.status AS "provisioningStatus",
      provisioning.requested_subdomain_label AS "requestedSubdomainLabel",
      provisioning.result_access_url AS "resultAccessUrl",
      provisioning.tenant_id AS "tenantId",
      provisioning.tenant_environment_id AS "tenantEnvironmentId",
      access.tenant_url AS "tenantUrl",
      access.signup_status_token AS "signupStatusToken"
    FROM customer_subscriptions subscription
    JOIN customer_accounts account
      ON account.id = subscription.customer_account_id
    LEFT JOIN commercial_plans plan
      ON plan.id = subscription.commercial_plan_id
    LEFT JOIN LATERAL (
      SELECT *
      FROM checkout_sessions cs
      WHERE cs.customer_account_id = account.id
      ORDER BY cs.created_at DESC
      LIMIT 1
    ) checkout ON TRUE
    LEFT JOIN provisioning_requests provisioning
      ON provisioning.customer_subscription_id = subscription.id
    LEFT JOIN access_handoffs access
      ON access.provisioning_request_id = provisioning.id
    WHERE subscription.id = $1
    ORDER BY provisioning.created_at DESC NULLS LAST
    LIMIT 1
  `, [id]);
  return mapCommercialOverviewRow(result.rows[0]);
}

async function updateCommercialSubscription(id, updates = {}) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    UPDATE customer_subscriptions
    SET
      commercial_plan_id = COALESCE($2, commercial_plan_id),
      status = COALESCE($3, status),
      dormant_status = COALESCE($4, dormant_status),
      current_period_start = COALESCE($5, current_period_start),
      current_period_end = COALESCE($6, current_period_end),
      base_price_cents = COALESCE($7, base_price_cents),
      included_billable_students = COALESCE($8, included_billable_students),
      per_student_overage_cents = COALESCE($9, per_student_overage_cents),
      current_billable_student_count = COALESCE($10, current_billable_student_count),
      current_overage_student_count = COALESCE($11, current_overage_student_count),
      last_billable_count_calculated_at = COALESCE($12, last_billable_count_calculated_at),
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      customer_account_id AS "customerAccountId",
      commercial_plan_id AS "commercialPlanId",
      status,
      dormant_status AS "dormantStatus",
      stripe_subscription_id AS "stripeSubscriptionId",
      stripe_checkout_session_id AS "stripeCheckoutSessionId",
      current_period_start AS "currentPeriodStart",
      current_period_end AS "currentPeriodEnd",
      cancel_at_period_end AS "cancelAtPeriodEnd",
      canceled_at AS "canceledAt",
      trial_ends_at AS "trialEndsAt",
      grace_period_ends_at AS "gracePeriodEndsAt",
      base_price_cents AS "basePriceCents",
      included_billable_students AS "includedBillableStudents",
      per_student_overage_cents AS "perStudentOverageCents",
      current_billable_student_count AS "currentBillableStudentCount",
      current_overage_student_count AS "currentOverageStudentCount",
      last_billable_count_calculated_at AS "lastBillableCountCalculatedAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `, [
    id,
    updates.commercialPlanId || null,
    updates.status || null,
    updates.dormantStatus || null,
    updates.currentPeriodStart || null,
    updates.currentPeriodEnd || null,
    Number.isInteger(updates.basePriceCents) ? updates.basePriceCents : null,
    Number.isInteger(updates.includedBillableStudents) ? updates.includedBillableStudents : null,
    Number.isInteger(updates.perStudentOverageCents) ? updates.perStudentOverageCents : null,
    Number.isInteger(updates.currentBillableStudentCount) ? updates.currentBillableStudentCount : null,
    Number.isInteger(updates.currentOverageStudentCount) ? updates.currentOverageStudentCount : null,
    updates.lastBillableCountCalculatedAt || null
  ]);
  return mapCustomerSubscriptionRow(result.rows[0]);
}

async function createCancellationExportRequest(input) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    INSERT INTO cancellation_export_requests (
      id,
      customer_account_id,
      customer_subscription_id,
      status,
      price_cents,
      currency,
      requested_by_email,
      payment_reference,
      export_job_id,
      artifact_path,
      artifact_expires_at,
      failure_reason,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
    RETURNING
      id,
      customer_account_id AS "customerAccountId",
      customer_subscription_id AS "customerSubscriptionId",
      status,
      price_cents AS "priceCents",
      currency,
      requested_by_email AS "requestedByEmail",
      payment_reference AS "paymentReference",
      export_job_id AS "exportJobId",
      artifact_path AS "artifactPath",
      artifact_expires_at AS "artifactExpiresAt",
      failure_reason AS "failureReason",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `, [
    input.id || `cancel-export-${randomUUID()}`,
    input.customerAccountId,
    input.customerSubscriptionId,
    input.status || "pending_payment",
    Number(input.priceCents || 1999),
    input.currency || "usd",
    input.requestedByEmail || null,
    input.paymentReference || null,
    input.exportJobId || null,
    input.artifactPath || null,
    input.artifactExpiresAt || null,
    input.failureReason || null
  ]);
  return mapCancellationExportRequestRow(result.rows[0]);
}

async function listCancellationExportRequestsBySubscriptionId(customerSubscriptionId) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      customer_account_id AS "customerAccountId",
      customer_subscription_id AS "customerSubscriptionId",
      status,
      price_cents AS "priceCents",
      currency,
      requested_by_email AS "requestedByEmail",
      payment_reference AS "paymentReference",
      export_job_id AS "exportJobId",
      artifact_path AS "artifactPath",
      artifact_expires_at AS "artifactExpiresAt",
      failure_reason AS "failureReason",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM cancellation_export_requests
    WHERE customer_subscription_id = $1
    ORDER BY created_at DESC
  `, [customerSubscriptionId]);
  return result.rows.map(mapCancellationExportRequestRow);
}

async function updateCustomerAccountStatus(customerAccountId, status) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    UPDATE customer_accounts
    SET
      status = $2,
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      account_name AS "accountName",
      account_slug AS "accountSlug",
      status,
      owner_first_name AS "ownerFirstName",
      owner_last_name AS "ownerLastName",
      owner_email AS "ownerEmail",
      owner_phone AS "ownerPhone",
      billing_email AS "billingEmail",
      stripe_customer_id AS "stripeCustomerId",
      notes,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `, [customerAccountId, status]);
  return result.rows[0] || null;
}

async function getBillingEventByStripeEventId(stripeEventId) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      customer_account_id AS "customerAccountId",
      customer_subscription_id AS "customerSubscriptionId",
      event_type AS "eventType",
      event_source AS "eventSource",
      stripe_event_id AS "stripeEventId",
      stripe_object_id AS "stripeObjectId",
      occurred_at AS "occurredAt",
      payload_json AS "payload",
      processed_at AS "processedAt",
      processing_status AS "processingStatus",
      processing_error AS "processingError",
      created_at AS "createdAt"
    FROM billing_events
    WHERE stripe_event_id = $1
    LIMIT 1
  `, [stripeEventId]);
  return mapBillingEventRow(result.rows[0]);
}

async function listBillingEventsBySubscriptionId(customerSubscriptionId, options = {}) {
  const pool = getPostgresPool();
  const normalizedLimit = Number.isFinite(Number(options.limit)) && Number(options.limit) > 0
    ? Math.floor(Number(options.limit))
    : 10;
  const result = await pool.query(`
    SELECT
      id,
      customer_account_id AS "customerAccountId",
      customer_subscription_id AS "customerSubscriptionId",
      event_type AS "eventType",
      event_source AS "eventSource",
      stripe_event_id AS "stripeEventId",
      stripe_object_id AS "stripeObjectId",
      occurred_at AS "occurredAt",
      payload_json AS "payload",
      processed_at AS "processedAt",
      processing_status AS "processingStatus",
      processing_error AS "processingError",
      created_at AS "createdAt"
    FROM billing_events
    WHERE customer_subscription_id = $1
    ORDER BY occurred_at DESC NULLS LAST, created_at DESC
    LIMIT $2
  `, [customerSubscriptionId, normalizedLimit]);
  return result.rows.map(mapBillingEventRow);
}

async function createBillingEvent(input) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    INSERT INTO billing_events (
      customer_account_id,
      customer_subscription_id,
      event_type,
      event_source,
      stripe_event_id,
      stripe_object_id,
      occurred_at,
      payload_json,
      processing_status,
      processing_error,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, NOW())
    ON CONFLICT (stripe_event_id) DO NOTHING
    RETURNING
      id,
      customer_account_id AS "customerAccountId",
      customer_subscription_id AS "customerSubscriptionId",
      event_type AS "eventType",
      event_source AS "eventSource",
      stripe_event_id AS "stripeEventId",
      stripe_object_id AS "stripeObjectId",
      occurred_at AS "occurredAt",
      payload_json AS "payload",
      processed_at AS "processedAt",
      processing_status AS "processingStatus",
      processing_error AS "processingError",
      created_at AS "createdAt"
  `, [
    input.customerAccountId || null,
    input.customerSubscriptionId || null,
    input.eventType,
    input.eventSource || "stripe",
    input.stripeEventId,
    input.stripeObjectId || null,
    input.occurredAt,
    JSON.stringify(input.payload || {}),
    input.processingStatus || "received",
    input.processingError || null
  ]);
  if (result.rows[0]) return mapBillingEventRow(result.rows[0]);
  return getBillingEventByStripeEventId(input.stripeEventId);
}

async function updateBillingEventProcessing(stripeEventId, updates = {}) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    UPDATE billing_events
    SET
      customer_account_id = COALESCE($2, customer_account_id),
      customer_subscription_id = COALESCE($3, customer_subscription_id),
      processing_status = COALESCE($4, processing_status),
      processing_error = $5,
      processed_at = CASE
        WHEN $4 IN ('processed', 'ignored', 'failed') THEN NOW()
        ELSE processed_at
      END
    WHERE stripe_event_id = $1
    RETURNING
      id,
      customer_account_id AS "customerAccountId",
      customer_subscription_id AS "customerSubscriptionId",
      event_type AS "eventType",
      event_source AS "eventSource",
      stripe_event_id AS "stripeEventId",
      stripe_object_id AS "stripeObjectId",
      occurred_at AS "occurredAt",
      payload_json AS "payload",
      processed_at AS "processedAt",
      processing_status AS "processingStatus",
      processing_error AS "processingError",
      created_at AS "createdAt"
  `, [
    stripeEventId,
    updates.customerAccountId || null,
    updates.customerSubscriptionId || null,
    updates.processingStatus || null,
    updates.processingError || null
  ]);
  return mapBillingEventRow(result.rows[0]);
}

async function getProvisioningRequestBySubscriptionId(customerSubscriptionId) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      customer_account_id AS "customerAccountId",
      customer_subscription_id AS "customerSubscriptionId",
      commercial_plan_id AS "commercialPlanId",
      status,
      trigger_source AS "triggerSource",
      requested_subdomain_label AS "requestedSubdomainLabel",
      tenant_id AS "tenantId",
      tenant_environment_id AS "tenantEnvironmentId",
      provisioning_job_id AS "provisioningJobId",
      result_access_url AS "resultAccessUrl",
      result_setup_token_issued AS "resultSetupTokenIssued",
      failure_reason AS "failureReason",
      created_at AS "createdAt",
      updated_at AS "updatedAt",
      completed_at AS "completedAt"
    FROM provisioning_requests
    WHERE customer_subscription_id = $1
    LIMIT 1
  `, [customerSubscriptionId]);
  return mapProvisioningRequestRow(result.rows[0]);
}

async function getProvisioningRequestByJobId(provisioningJobId) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      customer_account_id AS "customerAccountId",
      customer_subscription_id AS "customerSubscriptionId",
      commercial_plan_id AS "commercialPlanId",
      status,
      trigger_source AS "triggerSource",
      requested_subdomain_label AS "requestedSubdomainLabel",
      tenant_id AS "tenantId",
      tenant_environment_id AS "tenantEnvironmentId",
      provisioning_job_id AS "provisioningJobId",
      result_access_url AS "resultAccessUrl",
      result_setup_token_issued AS "resultSetupTokenIssued",
      failure_reason AS "failureReason",
      created_at AS "createdAt",
      updated_at AS "updatedAt",
      completed_at AS "completedAt"
    FROM provisioning_requests
    WHERE provisioning_job_id = $1
    LIMIT 1
  `, [provisioningJobId]);
  return mapProvisioningRequestRow(result.rows[0]);
}

async function getProvisioningRequestByEnvironmentId(tenantEnvironmentId) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      customer_account_id AS "customerAccountId",
      customer_subscription_id AS "customerSubscriptionId",
      commercial_plan_id AS "commercialPlanId",
      status,
      trigger_source AS "triggerSource",
      requested_subdomain_label AS "requestedSubdomainLabel",
      tenant_id AS "tenantId",
      tenant_environment_id AS "tenantEnvironmentId",
      provisioning_job_id AS "provisioningJobId",
      result_access_url AS "resultAccessUrl",
      result_setup_token_issued AS "resultSetupTokenIssued",
      failure_reason AS "failureReason",
      created_at AS "createdAt",
      updated_at AS "updatedAt",
      completed_at AS "completedAt"
    FROM provisioning_requests
    WHERE tenant_environment_id = $1
    LIMIT 1
  `, [tenantEnvironmentId]);
  return mapProvisioningRequestRow(result.rows[0]);
}

async function createProvisioningRequest(input) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    INSERT INTO provisioning_requests (
      id,
      customer_account_id,
      customer_subscription_id,
      commercial_plan_id,
      status,
      trigger_source,
      requested_subdomain_label,
      tenant_id,
      tenant_environment_id,
      provisioning_job_id,
      result_access_url,
      result_setup_token_issued,
      failure_reason,
      created_at,
      updated_at,
      completed_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW(), NOW(), $14)
    RETURNING
      id,
      customer_account_id AS "customerAccountId",
      customer_subscription_id AS "customerSubscriptionId",
      commercial_plan_id AS "commercialPlanId",
      status,
      trigger_source AS "triggerSource",
      requested_subdomain_label AS "requestedSubdomainLabel",
      tenant_id AS "tenantId",
      tenant_environment_id AS "tenantEnvironmentId",
      provisioning_job_id AS "provisioningJobId",
      result_access_url AS "resultAccessUrl",
      result_setup_token_issued AS "resultSetupTokenIssued",
      failure_reason AS "failureReason",
      created_at AS "createdAt",
      updated_at AS "updatedAt",
      completed_at AS "completedAt"
  `, [
    input.id,
    input.customerAccountId,
    input.customerSubscriptionId,
    input.commercialPlanId,
    input.status,
    input.triggerSource,
    input.requestedSubdomainLabel || null,
    input.tenantId || null,
    input.tenantEnvironmentId || null,
    input.provisioningJobId || null,
    input.resultAccessUrl || null,
    !!input.resultSetupTokenIssued,
    input.failureReason || null,
    input.completedAt || null
  ]);
  return mapProvisioningRequestRow(result.rows[0]);
}

async function updateProvisioningRequest(id, updates = {}) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    UPDATE provisioning_requests
    SET
      status = COALESCE($2, status),
      tenant_id = COALESCE($3, tenant_id),
      tenant_environment_id = COALESCE($4, tenant_environment_id),
      provisioning_job_id = COALESCE($5, provisioning_job_id),
      result_access_url = COALESCE($6, result_access_url),
      result_setup_token_issued = COALESCE($7, result_setup_token_issued),
      failure_reason = $8,
      updated_at = NOW(),
      completed_at = CASE
        WHEN $9::timestamptz IS NOT NULL THEN $9::timestamptz
        WHEN COALESCE($2, status) IN ('ready', 'failed', 'canceled') THEN COALESCE(completed_at, NOW())
        ELSE completed_at
      END
    WHERE id = $1
    RETURNING
      id,
      customer_account_id AS "customerAccountId",
      customer_subscription_id AS "customerSubscriptionId",
      commercial_plan_id AS "commercialPlanId",
      status,
      trigger_source AS "triggerSource",
      requested_subdomain_label AS "requestedSubdomainLabel",
      tenant_id AS "tenantId",
      tenant_environment_id AS "tenantEnvironmentId",
      provisioning_job_id AS "provisioningJobId",
      result_access_url AS "resultAccessUrl",
      result_setup_token_issued AS "resultSetupTokenIssued",
      failure_reason AS "failureReason",
      created_at AS "createdAt",
      updated_at AS "updatedAt",
      completed_at AS "completedAt"
  `, [
    id,
    updates.status || null,
    updates.tenantId || null,
    updates.tenantEnvironmentId || null,
    updates.provisioningJobId || null,
    updates.resultAccessUrl || null,
    typeof updates.resultSetupTokenIssued === "boolean" ? updates.resultSetupTokenIssued : null,
    updates.failureReason || null,
    updates.completedAt || null
  ]);
  return mapProvisioningRequestRow(result.rows[0]);
}

async function getAccessHandoffByProvisioningRequestId(provisioningRequestId) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      customer_account_id AS "customerAccountId",
      customer_subscription_id AS "customerSubscriptionId",
      provisioning_request_id AS "provisioningRequestId",
      signup_status_token AS "signupStatusToken",
      tenant_url AS "tenantUrl",
      admin_setup_mode AS "adminSetupMode",
      setup_token AS "setupToken",
      setup_token_expires_at AS "setupTokenExpiresAt",
      delivery_channel AS "deliveryChannel",
      delivered_at AS "deliveredAt",
      last_viewed_at AS "lastViewedAt",
      created_at AS "createdAt"
    FROM access_handoffs
    WHERE provisioning_request_id = $1
    ORDER BY created_at DESC
    LIMIT 1
  `, [provisioningRequestId]);
  return mapAccessHandoffRow(result.rows[0]);
}

async function createAccessHandoff(input) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    INSERT INTO access_handoffs (
      id,
      customer_account_id,
      customer_subscription_id,
      provisioning_request_id,
      signup_status_token,
      tenant_url,
      admin_setup_mode,
      setup_token,
      setup_token_expires_at,
      delivery_channel,
      delivered_at,
      last_viewed_at,
      created_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
    RETURNING
      id,
      customer_account_id AS "customerAccountId",
      customer_subscription_id AS "customerSubscriptionId",
      provisioning_request_id AS "provisioningRequestId",
      signup_status_token AS "signupStatusToken",
      tenant_url AS "tenantUrl",
      admin_setup_mode AS "adminSetupMode",
      setup_token AS "setupToken",
      setup_token_expires_at AS "setupTokenExpiresAt",
      delivery_channel AS "deliveryChannel",
      delivered_at AS "deliveredAt",
      last_viewed_at AS "lastViewedAt",
      created_at AS "createdAt"
  `, [
    input.id,
    input.customerAccountId,
    input.customerSubscriptionId,
    input.provisioningRequestId,
    input.signupStatusToken,
    input.tenantUrl || null,
    input.adminSetupMode || "pending",
    input.setupToken || null,
    input.setupTokenExpiresAt || null,
    input.deliveryChannel || null,
    input.deliveredAt || null,
    input.lastViewedAt || null
  ]);
  return mapAccessHandoffRow(result.rows[0]);
}

async function updateAccessHandoffByProvisioningRequestId(provisioningRequestId, updates = {}) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    UPDATE access_handoffs
    SET
      tenant_url = COALESCE($2, tenant_url),
      admin_setup_mode = COALESCE($3, admin_setup_mode),
      setup_token = COALESCE($4, setup_token),
      setup_token_expires_at = COALESCE($5, setup_token_expires_at),
      delivery_channel = COALESCE($6, delivery_channel),
      delivered_at = COALESCE($7, delivered_at),
      last_viewed_at = COALESCE($8, last_viewed_at)
    WHERE provisioning_request_id = $1
    RETURNING
      id,
      customer_account_id AS "customerAccountId",
      customer_subscription_id AS "customerSubscriptionId",
      provisioning_request_id AS "provisioningRequestId",
      signup_status_token AS "signupStatusToken",
      tenant_url AS "tenantUrl",
      admin_setup_mode AS "adminSetupMode",
      setup_token AS "setupToken",
      setup_token_expires_at AS "setupTokenExpiresAt",
      delivery_channel AS "deliveryChannel",
      delivered_at AS "deliveredAt",
      last_viewed_at AS "lastViewedAt",
      created_at AS "createdAt"
  `, [
    provisioningRequestId,
    updates.tenantUrl || null,
    updates.adminSetupMode || null,
    updates.setupToken || null,
    updates.setupTokenExpiresAt || null,
    updates.deliveryChannel || null,
    updates.deliveredAt || null,
    updates.lastViewedAt || null
  ]);
  return mapAccessHandoffRow(result.rows[0]);
}

async function getPublicSignupStatusByToken(token) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      checkout.id AS "checkoutSessionRecordId",
      checkout.status AS "checkoutStatus",
      checkout.success_token AS "successToken",
      checkout.cancel_token AS "cancelToken",
      checkout.completed_at AS "checkoutCompletedAt",
      checkout.created_at AS "checkoutCreatedAt",
      checkout.requested_subdomain_label AS "requestedSubdomainLabel",
      account.id AS "customerAccountId",
      account.account_name AS "accountName",
      account.account_slug AS "accountSlug",
      account.status AS "accountStatus",
      account.owner_first_name AS "ownerFirstName",
      account.owner_last_name AS "ownerLastName",
      account.owner_email AS "ownerEmail",
      account.billing_email AS "billingEmail",
      plan.id AS "commercialPlanId",
      plan.code AS "planCode",
      plan.name AS "planName",
      plan.price_cents AS "planPriceCents",
      subscription.id AS "subscriptionId",
      subscription.status AS "subscriptionStatus",
      subscription.dormant_status AS "dormantStatus",
      subscription.current_period_end AS "currentPeriodEnd",
      provisioning.id AS "provisioningRequestId",
      provisioning.status AS "provisioningStatus",
      provisioning.result_access_url AS "resultAccessUrl",
      provisioning.failure_reason AS "failureReason",
      access.id AS "accessHandoffId",
      access.signup_status_token AS "signupStatusToken",
      access.tenant_url AS "tenantUrl",
      access.admin_setup_mode AS "adminSetupMode",
      access.setup_token AS "setupToken",
      access.setup_token_expires_at AS "setupTokenExpiresAt",
      access.delivered_at AS "deliveredAt"
    FROM checkout_sessions checkout
    JOIN customer_accounts account
      ON account.id = checkout.customer_account_id
    JOIN commercial_plans plan
      ON plan.id = checkout.commercial_plan_id
    LEFT JOIN customer_subscriptions subscription
      ON subscription.stripe_checkout_session_id = checkout.stripe_checkout_session_id
    LEFT JOIN provisioning_requests provisioning
      ON provisioning.customer_subscription_id = subscription.id
    LEFT JOIN access_handoffs access
      ON access.provisioning_request_id = provisioning.id
    WHERE checkout.success_token = $1
       OR checkout.cancel_token = $1
       OR access.signup_status_token = $1
    ORDER BY checkout.created_at DESC
    LIMIT 1
  `, [token]);

  const row = result.rows[0];
  if (!row) return null;

  const checkoutStatus = String(row.checkoutStatus || "created").toLowerCase();
  const provisioningStatus = String(row.provisioningStatus || "").toLowerCase();
  const subscriptionStatus = String(row.subscriptionStatus || "").toLowerCase();
  const isCancelToken = row.cancelToken === token && row.successToken !== token;
  let stage = "checkout_started";
  let headline = "Your hosted signup is in progress.";
  let message = "We have your request and will keep this page updated as your subscription and environment move forward.";

  if (isCancelToken) {
    stage = "checkout_canceled";
    headline = "Checkout was canceled before subscription confirmation.";
    message = "No billing confirmation was recorded for this signup. You can return to pricing and restart whenever you are ready.";
  } else if (provisioningStatus === "failed") {
    stage = "provisioning_failed";
    headline = "Subscription confirmed, but provisioning needs review.";
    message = row.failureReason || "The customer account is recorded, but automated environment provisioning did not finish successfully.";
  } else if (["ready", "awaiting_customer_setup"].includes(provisioningStatus)) {
    stage = provisioningStatus;
    headline = provisioningStatus === "ready" ? "Your environment is ready." : "Your environment is almost ready.";
    message = provisioningStatus === "ready"
      ? "Hosted access information is available below."
      : "Billing is confirmed and provisioning finished. The final customer handoff is waiting on setup completion.";
  } else if (["queued", "provisioning", "pending_billing_confirmation"].includes(provisioningStatus)) {
    stage = provisioningStatus;
    headline = "Provisioning is underway.";
    message = "Billing is confirmed and the control plane is preparing the hosted tenant environment now.";
  } else if (["active", "trialing", "past_due", "unpaid", "canceled"].includes(subscriptionStatus) || checkoutStatus === "completed") {
    stage = "billing_confirmed";
    headline = "Subscription confirmed.";
    message = "Billing confirmation is recorded. Provisioning details will appear here as soon as the hosted environment handoff is created.";
  }

  return {
    token,
    stage,
    headline,
    message,
    account: {
      id: row.customerAccountId,
      name: row.accountName,
      slug: row.accountSlug,
      status: row.accountStatus,
      ownerName: [row.ownerFirstName, row.ownerLastName].filter(Boolean).join(" ").trim(),
      ownerEmail: row.ownerEmail,
      billingEmail: row.billingEmail || row.ownerEmail
    },
    plan: {
      id: row.commercialPlanId,
      code: row.planCode,
      name: row.planName
    },
    checkout: {
      status: checkoutStatus,
      createdAt: row.checkoutCreatedAt,
      completedAt: row.checkoutCompletedAt,
      requestedSubdomainLabel: row.requestedSubdomainLabel || ""
    },
    subscription: row.subscriptionId ? {
      id: row.subscriptionId,
      status: row.subscriptionStatus,
      dormantStatus: row.dormantStatus,
      currentPeriodEnd: row.currentPeriodEnd
    } : null,
    provisioning: row.provisioningRequestId ? {
      id: row.provisioningRequestId,
      status: row.provisioningStatus,
      resultAccessUrl: row.resultAccessUrl || null,
      failureReason: row.failureReason || null
    } : null,
    access: row.accessHandoffId ? {
      id: row.accessHandoffId,
      signupStatusToken: row.signupStatusToken,
      tenantUrl: row.tenantUrl || row.resultAccessUrl || null,
      adminSetupMode: row.adminSetupMode || "pending",
      setupToken: row.setupToken || null,
      setupTokenExpiresAt: row.setupTokenExpiresAt || null,
      deliveredAt: row.deliveredAt || null
    } : null
  };
}

async function listCommercialOverview() {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      account.id AS "customerAccountId",
      account.account_name AS "accountName",
      account.account_slug AS "accountSlug",
      account.status AS "accountStatus",
      TRIM(CONCAT(account.owner_first_name, ' ', account.owner_last_name)) AS "ownerName",
      account.owner_email AS "ownerEmail",
      account.billing_email AS "billingEmail",
      account.created_at AS "createdAt",
      account.updated_at AS "updatedAt",
      plan.id AS "commercialPlanId",
      plan.code AS "planCode",
      plan.name AS "planName",
      plan.price_cents AS "planPriceCents",
      subscription.id AS "subscriptionId",
      subscription.status AS "subscriptionStatus",
      subscription.dormant_status AS "dormantStatus",
      subscription.base_price_cents AS "basePriceCents",
      subscription.included_billable_students AS "includedBillableStudents",
      subscription.per_student_overage_cents AS "perStudentOverageCents",
      subscription.current_billable_student_count AS "currentBillableStudentCount",
      subscription.current_overage_student_count AS "currentOverageStudentCount",
      subscription.last_billable_count_calculated_at AS "lastBillableCountCalculatedAt",
      subscription.stripe_subscription_id AS "stripeSubscriptionId",
      checkout.stripe_checkout_session_id AS "checkoutSessionId",
      checkout.status AS "checkoutStatus",
      provisioning.id AS "provisioningRequestId",
      provisioning.status AS "provisioningStatus",
      provisioning.requested_subdomain_label AS "requestedSubdomainLabel",
      provisioning.result_access_url AS "resultAccessUrl",
      provisioning.tenant_id AS "tenantId",
      provisioning.tenant_environment_id AS "tenantEnvironmentId",
      access.tenant_url AS "tenantUrl",
      access.signup_status_token AS "signupStatusToken"
    FROM customer_accounts account
    LEFT JOIN LATERAL (
      SELECT *
      FROM customer_subscriptions sub
      WHERE sub.customer_account_id = account.id
      ORDER BY sub.created_at DESC
      LIMIT 1
    ) subscription ON TRUE
    LEFT JOIN commercial_plans plan
      ON plan.id = subscription.commercial_plan_id
    LEFT JOIN LATERAL (
      SELECT *
      FROM checkout_sessions cs
      WHERE cs.customer_account_id = account.id
      ORDER BY cs.created_at DESC
      LIMIT 1
    ) checkout ON TRUE
    LEFT JOIN provisioning_requests provisioning
      ON provisioning.customer_subscription_id = subscription.id
    LEFT JOIN access_handoffs access
      ON access.provisioning_request_id = provisioning.id
    ORDER BY account.created_at DESC, account.account_name ASC
  `);
  return result.rows.map(mapCommercialOverviewRow);
}

module.exports = {
  createAccessHandoff,
  createBillingEvent,
  createCancellationExportRequest,
  createCheckoutCustomerAccount,
  createCheckoutSessionRecord,
  createCheckoutSubscription,
  createProvisioningRequest,
  getBillingEventByStripeEventId,
  getCommercialPlanById,
  getCommercialPlanByStripePriceId,
  getCommercialSubscriptionById,
  getCommercialOverviewBySubscriptionId,
  getCustomerAccountById,
  getAccessHandoffByProvisioningRequestId,
  getCheckoutSessionByStripeSessionId,
  getPublicCommercialPlanByCode,
  getPublicSignupStatusByToken,
  getProvisioningRequestByJobId,
  getProvisioningRequestByEnvironmentId,
  getProvisioningRequestBySubscriptionId,
  getSubscriptionByStripeCheckoutSessionId,
  getSubscriptionByStripeSubscriptionId,
  listBillingEventsBySubscriptionId,
  listCancellationExportRequestsBySubscriptionId,
  listCommercialOverview,
  listPublicCommercialPlans
  ,
  markCheckoutSessionCompleted,
  updateAccessHandoffByProvisioningRequestId,
  updateBillingEventProcessing,
  updateCommercialSubscription,
  updateCustomerAccountStatus,
  updateProvisioningRequest,
  updateSubscriptionByStripeCheckoutSessionId,
  updateSubscriptionByStripeSubscriptionId
};
