async function processStripeBillingEvent(event, deps) {
  const {
    createBillingEvent,
    getBillingEventByStripeEventId,
    getCheckoutSessionByStripeSessionId,
    getSubscriptionByStripeCheckoutSessionId,
    markCheckoutSessionCompleted,
    updateBillingEventProcessing,
    updateCustomerAccountStatus,
    updateSubscriptionByStripeCheckoutSessionId
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
      getCheckoutSessionByStripeSessionId,
      getSubscriptionByStripeCheckoutSessionId,
      markCheckoutSessionCompleted,
      updateCustomerAccountStatus,
      updateSubscriptionByStripeCheckoutSessionId
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

    return {
      processingStatus: "processed",
      customerAccountId: checkoutSession.customerAccountId,
      customerSubscriptionId: subscription?.id || null,
      checkoutSessionId
    };
  }

  if (event.type === "invoice.payment_failed") {
    const checkoutSessionId = String(object.subscription_details?.metadata?.checkout_session_id || "").trim();
    if (!checkoutSessionId) {
      return {
        processingStatus: "ignored",
        reason: "checkout_session_metadata_missing"
      };
    }
    const subscription = await deps.updateSubscriptionByStripeCheckoutSessionId(checkoutSessionId, {
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
