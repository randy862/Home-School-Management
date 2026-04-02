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
    subscriptionId: row.subscriptionId ?? row.subscription_id ?? null,
    subscriptionStatus: row.subscriptionStatus ?? row.subscription_status ?? "",
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
      subscription.id AS "subscriptionId",
      subscription.status AS "subscriptionStatus",
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
      subscription.id AS "subscriptionId",
      subscription.status AS "subscriptionStatus",
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
  createBillingEvent,
  createCheckoutCustomerAccount,
  createCheckoutSessionRecord,
  createCheckoutSubscription,
  getBillingEventByStripeEventId,
  getCheckoutSessionByStripeSessionId,
  getPublicCommercialPlanByCode,
  getPublicSignupStatusByToken,
  getSubscriptionByStripeCheckoutSessionId,
  listCommercialOverview,
  listPublicCommercialPlans
  ,
  markCheckoutSessionCompleted,
  updateBillingEventProcessing,
  updateCustomerAccountStatus,
  updateSubscriptionByStripeCheckoutSessionId
};
