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

async function createCheckoutSubscription(input) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    INSERT INTO customer_subscriptions (
      id,
      customer_account_id,
      commercial_plan_id,
      status,
      stripe_checkout_session_id,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, 'incomplete', $4, NOW(), NOW())
    RETURNING
      id,
      customer_account_id AS "customerAccountId",
      commercial_plan_id AS "commercialPlanId",
      status,
      stripe_subscription_id AS "stripeSubscriptionId",
      stripe_checkout_session_id AS "stripeCheckoutSessionId",
      current_period_start AS "currentPeriodStart",
      current_period_end AS "currentPeriodEnd",
      cancel_at_period_end AS "cancelAtPeriodEnd",
      canceled_at AS "canceledAt",
      trial_ends_at AS "trialEndsAt",
      grace_period_ends_at AS "gracePeriodEndsAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `, [
    `sub-${randomUUID()}`,
    input.customerAccountId,
    input.commercialPlanId,
    input.stripeCheckoutSessionId
  ]);
  return result.rows[0];
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
      stripe_subscription_id AS "stripeSubscriptionId",
      stripe_checkout_session_id AS "stripeCheckoutSessionId",
      current_period_start AS "currentPeriodStart",
      current_period_end AS "currentPeriodEnd",
      cancel_at_period_end AS "cancelAtPeriodEnd",
      canceled_at AS "canceledAt",
      trial_ends_at AS "trialEndsAt",
      grace_period_ends_at AS "gracePeriodEndsAt",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM customer_subscriptions
    WHERE stripe_checkout_session_id = $1
    LIMIT 1
  `, [stripeCheckoutSessionId]);
  return result.rows[0] || null;
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
      updated_at = NOW()
    WHERE stripe_checkout_session_id = $1
    RETURNING
      id,
      customer_account_id AS "customerAccountId",
      commercial_plan_id AS "commercialPlanId",
      status,
      stripe_subscription_id AS "stripeSubscriptionId",
      stripe_checkout_session_id AS "stripeCheckoutSessionId",
      current_period_start AS "currentPeriodStart",
      current_period_end AS "currentPeriodEnd",
      cancel_at_period_end AS "cancelAtPeriodEnd",
      canceled_at AS "canceledAt",
      trial_ends_at AS "trialEndsAt",
      grace_period_ends_at AS "gracePeriodEndsAt",
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
    updates.gracePeriodEndsAt || null
  ]);
  return result.rows[0] || null;
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

module.exports = {
  createBillingEvent,
  createCheckoutCustomerAccount,
  createCheckoutSessionRecord,
  createCheckoutSubscription,
  getBillingEventByStripeEventId,
  getCheckoutSessionByStripeSessionId,
  getPublicCommercialPlanByCode,
  getSubscriptionByStripeCheckoutSessionId,
  listPublicCommercialPlans
  ,
  markCheckoutSessionCompleted,
  updateBillingEventProcessing,
  updateCustomerAccountStatus,
  updateSubscriptionByStripeCheckoutSessionId
};
