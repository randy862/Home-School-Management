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
  const entries = [
    ["Account", status.account?.name],
    ["Owner", status.account?.ownerName || status.account?.ownerEmail],
    ["Plan", status.plan?.name],
    ["Account Status", status.account?.status],
    ["Subscription Status", status.subscription?.status],
    ["Provisioning", status.provisioning?.status],
    ["Requested Subdomain", status.checkout?.requestedSubdomainLabel],
    ["Tenant URL", status.access?.tenantUrl || status.provisioning?.resultAccessUrl],
    ["Setup Mode", status.access?.adminSetupMode],
    ["Period Ends", formatDateTime(status.subscription?.currentPeriodEnd)],
    ["Checkout Completed", formatDateTime(status.checkout?.completedAt)]
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
  } else {
    messages.push("This link is now the dedicated customer-facing checkpoint for signup and provisioning.");
  }

  if (status.access?.tenantUrl) {
    messages.push(`Hosted URL: <a href="${escapeHtml(status.access.tenantUrl)}" target="_blank" rel="noreferrer">${escapeHtml(status.access.tenantUrl)}</a>`);
  }
  if (status.provisioning?.failureReason) {
    messages.push(`Provisioning note: ${escapeHtml(status.provisioning.failureReason)}`);
  }
  if (status.access?.setupToken) {
    messages.push(`Setup token recorded for handoff: ${escapeHtml(status.access.setupToken)}`);
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
    message: "Checking billing confirmation and provisioning progress now."
  });

  try {
    const status = await fetchJson(`${SIGNUP_STATUS_API_BASE}/signup-status/${encodeURIComponent(token)}`);
    setStatusCopy({
      kicker: "Signup Status",
      title: status.headline || "Your hosted signup is in progress.",
      message: status.message || "We have your signup and will keep this page updated as billing and provisioning progress.",
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
