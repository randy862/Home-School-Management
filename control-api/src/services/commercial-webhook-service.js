async function processStripeBillingEvent(event, deps) {
  const {
    ensureCommercialProvisioningForSubscription,
    createBillingEvent,
    getBillingEventByStripeEventId,
    getCheckoutSessionByStripeSessionId,
    getSubscriptionByStripeCheckoutSessionId,
    getSubscriptionByStripeSubscriptionId,
    markCheckoutSessionCompleted,
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
      getCheckoutSessionByStripeSessionId,
      getSubscriptionByStripeCheckoutSessionId,
      getSubscriptionByStripeSubscriptionId,
      markCheckoutSessionCompleted,
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

    const subscription = await deps.updateSubscriptionByStripeSubscriptionId(stripeSubscriptionId, {
      status: normalizeStripeSubscriptionStatus(object.status),
      stripeCheckoutSessionId: existingSubscription.stripeCheckoutSessionId || String(object.metadata?.checkout_session_id || "").trim() || null,
      currentPeriodStart: toIsoFromUnixSeconds(object.current_period_start),
      currentPeriodEnd: toIsoFromUnixSeconds(object.current_period_end),
      cancelAtPeriodEnd: typeof object.cancel_at_period_end === "boolean" ? object.cancel_at_period_end : null,
      canceledAt: toIsoFromUnixSeconds(object.canceled_at),
      trialEndsAt: toIsoFromUnixSeconds(object.trial_end)
    });

    if (subscription?.customerAccountId && subscription?.status) {
      await deps.updateCustomerAccountStatus(subscription.customerAccountId, mapAccountStatusFromSubscriptionStatus(subscription.status));
    }

    return {
      processingStatus: "processed",
      customerAccountId: subscription?.customerAccountId || null,
      customerSubscriptionId: subscription?.id || null
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
