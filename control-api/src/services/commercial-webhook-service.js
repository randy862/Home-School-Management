const { randomUUID } = require("crypto");

async function processStripeBillingEvent(event, deps) {
  const {
    ensureCommercialProvisioningForSubscription,
    createBillingEvent,
    createOperatorAuditEntry,
    getBillingEventByStripeEventId,
    getCheckoutSessionByStripeSessionId,
    getCommercialOverviewBySubscriptionId,
    getCommercialPlanById,
    getCommercialPlanByStripePriceId,
    getSubscriptionByStripeCheckoutSessionId,
    getSubscriptionByStripeSubscriptionId,
    markCheckoutSessionCompleted,
    queueProvisioningJob,
    updateBillingEventProcessing,
    updateCustomerAccountStatus,
    updateSubscriptionByStripeCheckoutSessionId,
    updateSubscriptionByStripeSubscriptionId
  } = deps;

  const existingEvent = await getBillingEventByStripeEventId(event.id);
  if (existingEvent?.processingStatus === "processed") {
    return { duplicate: true, event: existingEvent };
  }

  await createBillingEvent({
    eventType: event.type,
    eventSource: "stripe",
    stripeEventId: event.id,
    stripeObjectId: event.data?.object?.id || null,
    occurredAt: event.created ? new Date(event.created * 1000).toISOString() : new Date().toISOString(),
    payload: event,
    processingStatus: "received"
  });

  try {
    const result = await handleStripeEventByType(event, {
      ensureCommercialProvisioningForSubscription,
      createOperatorAuditEntry,
      getCheckoutSessionByStripeSessionId,
      getCommercialOverviewBySubscriptionId,
      getCommercialPlanById,
      getCommercialPlanByStripePriceId,
      getSubscriptionByStripeCheckoutSessionId,
      getSubscriptionByStripeSubscriptionId,
      markCheckoutSessionCompleted,
      queueProvisioningJob,
      updateCustomerAccountStatus,
      updateSubscriptionByStripeCheckoutSessionId,
      updateSubscriptionByStripeSubscriptionId
    });

    await updateBillingEventProcessing(event.id, {
      customerAccountId: result.customerAccountId || null,
      customerSubscriptionId: result.customerSubscriptionId || null,
      processingStatus: result.processingStatus || "processed",
      processingError: null
    });

    return { duplicate: false, eventId: event.id, ...result };
  } catch (error) {
    await updateBillingEventProcessing(event.id, {
      processingStatus: "failed",
      processingError: error.message || "Webhook processing failed."
    });
    throw error;
  }
}

async function handleStripeEventByType(event, deps) {
  const object = event.data?.object || {};

  if (event.type === "checkout.session.completed") {
    const checkoutSessionId = String(object.id || "").trim();
    const checkoutSession = await deps.getCheckoutSessionByStripeSessionId(checkoutSessionId);
    if (!checkoutSession) {
      return {
        processingStatus: "ignored",
        reason: "checkout_session_not_found"
      };
    }

    await deps.markCheckoutSessionCompleted(checkoutSessionId);
    const subscription = await deps.updateSubscriptionByStripeCheckoutSessionId(checkoutSessionId, {
      status: "active",
      stripeSubscriptionId: String(object.subscription || "").trim() || null
    });
    await deps.updateCustomerAccountStatus(checkoutSession.customerAccountId, "active");
    const provisioning = await deps.ensureCommercialProvisioningForSubscription(checkoutSession, subscription);

    return {
      processingStatus: "processed",
      customerAccountId: checkoutSession.customerAccountId,
      customerSubscriptionId: subscription?.id || null,
      checkoutSessionId,
      provisioningRequestId: provisioning?.provisioningRequest?.id || null
    };
  }

  if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated") {
    const stripeSubscriptionId = String(object.id || "").trim();
    if (!stripeSubscriptionId) {
      return {
        processingStatus: "ignored",
        reason: "stripe_subscription_id_missing"
      };
    }

    const existingSubscription = await deps.getSubscriptionByStripeSubscriptionId(stripeSubscriptionId);
    if (!existingSubscription) {
      return {
        processingStatus: "ignored",
        reason: "stripe_subscription_not_found"
      };
    }

    const plan = await resolvePlanForStripeSubscription(object, deps);
    const dormantTransition = await resolveDormantWebhookTransition(existingSubscription, object, deps);
    const updates = {
      status: normalizeStripeSubscriptionStatus(object.status),
      stripeCheckoutSessionId: existingSubscription.stripeCheckoutSessionId || String(object.metadata?.checkout_session_id || "").trim() || null,
      currentPeriodStart: toIsoFromUnixSeconds(object.current_period_start),
      currentPeriodEnd: toIsoFromUnixSeconds(object.current_period_end),
      cancelAtPeriodEnd: typeof object.cancel_at_period_end === "boolean" ? object.cancel_at_period_end : null,
      canceledAt: toIsoFromUnixSeconds(object.canceled_at),
      trialEndsAt: toIsoFromUnixSeconds(object.trial_end),
      dormantStatus: dormantTransition.dormantStatus || null
    };
    if (plan) {
      updates.commercialPlanId = plan.id;
      updates.basePriceCents = resolveWebhookBasePriceCents(object, plan);
      updates.includedBillableStudents = Number(plan.limits?.includedBillableStudents || 0);
      updates.perStudentOverageCents = Number(plan.limits?.perStudentOverageCents || 0);
    }

    const subscription = await deps.updateSubscriptionByStripeSubscriptionId(stripeSubscriptionId, updates);

    if (subscription?.customerAccountId && subscription?.status) {
      await deps.updateCustomerAccountStatus(subscription.customerAccountId, mapAccountStatusFromSubscriptionStatus(subscription.status));
    }

    return {
      processingStatus: "processed",
      customerAccountId: subscription?.customerAccountId || null,
      customerSubscriptionId: subscription?.id || null,
      dormantLifecycleJobId: dormantTransition.lifecycleJob?.id || null
    };
  }

  if (event.type === "customer.subscription.deleted") {
    const stripeSubscriptionId = String(object.id || "").trim();
    if (!stripeSubscriptionId) {
      return {
        processingStatus: "ignored",
        reason: "stripe_subscription_id_missing"
      };
    }

    const existingSubscription = await deps.getSubscriptionByStripeSubscriptionId(stripeSubscriptionId);
    if (!existingSubscription) {
      return {
        processingStatus: "ignored",
        reason: "stripe_subscription_not_found"
      };
    }

    const subscription = await deps.updateSubscriptionByStripeSubscriptionId(stripeSubscriptionId, {
      status: "canceled",
      currentPeriodStart: toIsoFromUnixSeconds(object.current_period_start),
      currentPeriodEnd: toIsoFromUnixSeconds(object.current_period_end),
      cancelAtPeriodEnd: typeof object.cancel_at_period_end === "boolean" ? object.cancel_at_period_end : null,
      canceledAt: toIsoFromUnixSeconds(object.canceled_at || event.created)
    });

    if (subscription?.customerAccountId) {
      await deps.updateCustomerAccountStatus(subscription.customerAccountId, "canceled");
    }

    return {
      processingStatus: "processed",
      customerAccountId: subscription?.customerAccountId || null,
      customerSubscriptionId: subscription?.id || null
    };
  }

  if (event.type === "invoice.payment_failed") {
    const stripeSubscriptionId = String(object.subscription || "").trim();
    if (!stripeSubscriptionId) {
      return {
        processingStatus: "ignored",
        reason: "stripe_subscription_id_missing"
      };
    }
    const existingSubscription = await deps.getSubscriptionByStripeSubscriptionId(stripeSubscriptionId);
    if (!existingSubscription) {
      return {
        processingStatus: "ignored",
        reason: "stripe_subscription_not_found"
      };
    }
    const subscription = await deps.updateSubscriptionByStripeSubscriptionId(stripeSubscriptionId, {
      status: "past_due"
    });
    if (subscription?.customerAccountId) {
      await deps.updateCustomerAccountStatus(subscription.customerAccountId, "past_due");
    }
    return {
      processingStatus: "processed",
      customerAccountId: subscription?.customerAccountId || null,
      customerSubscriptionId: subscription?.id || null
    };
  }

  return {
    processingStatus: "ignored",
    reason: "event_type_not_yet_handled"
  };
}

module.exports = {
  processStripeBillingEvent
};

function toIsoFromUnixSeconds(value) {
  const normalized = Number(value);
  if (!Number.isFinite(normalized) || normalized <= 0) return null;
  return new Date(normalized * 1000).toISOString();
}

function normalizeStripeSubscriptionStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) return "active";
  if (["trialing", "active", "past_due", "unpaid", "canceled", "incomplete", "incomplete_expired"].includes(normalized)) {
    return normalized === "incomplete_expired" ? "canceled" : normalized;
  }
  return "active";
}

function mapAccountStatusFromSubscriptionStatus(value) {
  const normalized = normalizeStripeSubscriptionStatus(value);
  if (normalized === "canceled") return "canceled";
  if (["past_due", "unpaid"].includes(normalized)) return "past_due";
  return "active";
}

async function resolvePlanForStripeSubscription(subscription, deps) {
  const metadataPlanId = String(subscription?.metadata?.commercialPlanId || "").trim();
  if (metadataPlanId && deps.getCommercialPlanById) {
    const plan = await deps.getCommercialPlanById(metadataPlanId);
    if (plan) return plan;
  }

  if (!deps.getCommercialPlanByStripePriceId) return null;
  const items = Array.isArray(subscription?.items?.data) ? subscription.items.data : [];
  for (const item of items) {
    const billingRole = String(item?.metadata?.billing_role || "").trim().toLowerCase();
    if (billingRole === "overage") continue;
    const priceId = String(item?.price?.id || "").trim();
    if (!priceId) continue;
    const plan = await deps.getCommercialPlanByStripePriceId(priceId);
    if (plan) return plan;
  }

  return null;
}

function resolveWebhookBasePriceCents(subscription, plan) {
  const metadata = subscription?.metadata || {};
  const dormantBilling = String(metadata.dormantBilling || "").trim().toLowerCase() === "true";
  const dormantPriceCents = Number.parseInt(metadata.dormantBasePriceCents, 10);
  if (dormantBilling && Number.isInteger(dormantPriceCents) && dormantPriceCents >= 0) {
    return dormantPriceCents;
  }
  return Number(plan.priceCents || 0);
}

async function resolveDormantWebhookTransition(existingSubscription, stripeSubscription, deps) {
  const currentDormantStatus = String(existingSubscription?.dormantStatus || "active").trim().toLowerCase();
  const metadataDormantStatus = String(stripeSubscription?.metadata?.dormantStatus || "").trim().toLowerCase();
  if (metadataDormantStatus === "active" && currentDormantStatus !== "active") {
    return { dormantStatus: "active", lifecycleJob: null };
  }

  if (currentDormantStatus !== "pending_dormant") {
    return { dormantStatus: null, lifecycleJob: null };
  }

  const previousPeriodEnd = existingSubscription?.currentPeriodEnd ? Date.parse(existingSubscription.currentPeriodEnd) : Number.NaN;
  const stripePeriodStart = Number(stripeSubscription?.current_period_start || 0) * 1000;
  const reachedBoundary = Number.isFinite(previousPeriodEnd)
    && Number.isFinite(stripePeriodStart)
    && stripePeriodStart >= previousPeriodEnd - 60000;
  if (!reachedBoundary) {
    return { dormantStatus: metadataDormantStatus === "pending_dormant" ? "pending_dormant" : null, lifecycleJob: null };
  }

  let lifecycleJob = null;
  if (deps.getCommercialOverviewBySubscriptionId && deps.queueProvisioningJob) {
    const overview = await deps.getCommercialOverviewBySubscriptionId(existingSubscription.id);
    if (overview?.tenantEnvironmentId) {
      lifecycleJob = await deps.queueProvisioningJob(createLifecycleJobPayload({
        tenantId: overview.tenantId,
        tenantEnvironmentId: overview.tenantEnvironmentId,
        jobType: "suspend_tenant",
        idempotencyKey: `stripe-dormant-boundary:${existingSubscription.id}:${stripeSubscription?.current_period_start || ""}`,
        message: "Suspend tenant queued from Stripe dormant billing boundary",
        notes: "Queued automatically when Stripe advanced a pending dormant subscription into the next billing period."
      }), {
        operatorUserId: null
      });
      if (deps.createOperatorAuditEntry) {
        await deps.createOperatorAuditEntry({
          operatorUserId: null,
          actionType: "stripe_mark_subscription_dormant",
          targetType: "customer_subscription",
          targetId: existingSubscription.id,
          tenantId: overview.tenantId || null,
          details: {
            tenantEnvironmentId: overview.tenantEnvironmentId || null,
            lifecycleJobId: lifecycleJob?.id || null,
            previousPeriodEnd: existingSubscription.currentPeriodEnd || null,
            stripePeriodStart: toIsoFromUnixSeconds(stripeSubscription?.current_period_start)
          }
        });
      }
    }
  }

  return { dormantStatus: "dormant", lifecycleJob };
}

function createLifecycleJobPayload({ tenantId, tenantEnvironmentId, jobType, idempotencyKey, message, notes }) {
  return {
    id: `job-${randomUUID()}`,
    tenantId: tenantId || null,
    tenantEnvironmentId,
    jobType,
    idempotencyKey: idempotencyKey || null,
    maxAttempts: 3,
    message,
    payload: {
      notes: notes || ""
    }
  };
}
