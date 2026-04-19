const SIGNUP_STATUS_API_BASE = `${window.location.origin}/control-api/api/public`;

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  });
}

async function fetchJson(url) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error || `Request failed (${response.status})`);
    error.statusCode = response.status;
    throw error;
  }
  return payload;
}

function setStatusCopy({ kicker, title, message, detailsHtml = "", metaHtml = "" }) {
  const kickerEl = document.getElementById("signup-status-kicker");
  const titleEl = document.getElementById("signup-status-title");
  const messageEl = document.getElementById("signup-status-message");
  const detailsEl = document.getElementById("signup-status-details");
  const metaEl = document.getElementById("signup-status-meta");
  if (kickerEl) kickerEl.textContent = kicker;
  if (titleEl) titleEl.textContent = title;
  if (messageEl) messageEl.textContent = message;
  if (detailsEl) {
    detailsEl.innerHTML = detailsHtml;
    detailsEl.classList.toggle("hidden", !detailsHtml);
  }
  if (metaEl) {
    metaEl.innerHTML = metaHtml;
    metaEl.classList.toggle("hidden", !metaHtml);
  }
}

function renderMetaBlock(status) {
  if (status.stage === "checkout_canceled") return "";
  if (status.provisioning?.failureReason || status.emailDelivery?.status === "failed") {
    const entries = [
      ["Account", status.account?.name],
      ["Owner", status.account?.ownerName || status.account?.ownerEmail],
      ["Tenant URL", status.access?.tenantUrl || status.provisioning?.resultAccessUrl],
      ["Setup Email", status.emailDelivery?.status]
    ].filter(([, value]) => value);
    if (!entries.length) return "";
    return entries.map(([label, value]) => `
      <div class="detail-field">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </div>
    `).join("");
  }

  const entries = [
    ["Tenant URL", status.access?.tenantUrl || status.provisioning?.resultAccessUrl],
    ["Setup Email", status.emailDelivery?.status]
  ].filter(([, value]) => value);

  if (!entries.length) return "";
  return entries.map(([label, value]) => `
    <div class="detail-field">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `).join("");
}

function renderStatusDetails(status) {
  const messages = [];
  if (status.stage === "checkout_canceled") {
    messages.push("No billing confirmation was recorded for this token.");
  }

  if (status.provisioning?.failureReason) {
    messages.push(`Provisioning note: ${escapeHtml(status.provisioning.failureReason)}`);
  }
  if (status.emailDelivery?.status === "sent") {
    messages.push(`Your setup link email was sent to ${escapeHtml(status.emailDelivery.recipientEmail || "the account owner")} on ${escapeHtml(formatDateTime(status.emailDelivery.deliveredAt || status.emailDelivery.createdAt))}.`);
    messages.push("Open that email and use the setup link there to finish creating your first admin account.");
  } else if (status.emailDelivery?.status === "logged") {
    messages.push("Your setup link is being handled by support for this environment.");
  } else if (status.emailDelivery?.status === "skipped") {
    messages.push("Your setup link is waiting on staged allowlist approval before delivery.");
  } else if (status.emailDelivery?.status === "failed") {
    messages.push(`Your setup email needs support review: ${escapeHtml(status.emailDelivery.errorMessage || "Delivery did not complete.")}`);
  } else if (status.stage === "awaiting_customer_setup") {
    messages.push("We are finalizing your setup-link email now.");
  } else if (["queued", "provisioning", "billing_confirmed"].includes(status.stage)) {
    messages.push("You do not need to stay on this page. We will email your setup link when it is ready.");
  }

  return messages.map((item) => `<p>${item}</p>`).join("");
}

async function loadSignupStatus() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  const checkoutState = params.get("checkout");

  if (!token && checkoutState === "cancel") {
    setStatusCopy({
      kicker: "Checkout Canceled",
      title: "Checkout was canceled before subscription confirmation.",
      message: "No subscription was started. You can return to the pricing page and restart when you are ready."
    });
    return;
  }

  if (!token) {
    setStatusCopy({
      kicker: "Status Link Needed",
      title: "A signup status token is required for this page.",
      message: "Return from the subscription flow using the generated handoff link, or start a new subscription from the hosted plans page."
    });
    return;
  }

  setStatusCopy({
    kicker: "Loading Status",
    title: "Looking up your hosted signup.",
    message: "Checking your hosted workspace status now."
  });

  try {
    const status = await fetchJson(`${SIGNUP_STATUS_API_BASE}/signup-status/${encodeURIComponent(token)}`);
    setStatusCopy({
      kicker: "Signup Status",
      title: status.headline || "Your hosted signup is in progress.",
      message: status.message || "We have your signup and will email your setup link as soon as it is ready.",
      detailsHtml: renderStatusDetails(status),
      metaHtml: renderMetaBlock(status)
    });
  } catch (error) {
    setStatusCopy({
      kicker: error.statusCode === 404 ? "Status Not Found" : "Status Unavailable",
      title: error.statusCode === 404 ? "This signup status link was not found." : "The signup status service could not be loaded.",
      message: error.message || "Please try again shortly."
    });
  }
}

loadSignupStatus();
