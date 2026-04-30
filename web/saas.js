const SAAS_API_BASE = `${window.location.origin}/control-api/api/public`;
const SIGNUP_STATUS_PAGE = `${window.location.origin}/signup-status.html`;
const LOCAL_PLAN_FALLBACK = [
  {
    code: "starter_monthly",
    name: "Starter",
    priceCents: 999,
    currency: "usd",
    billingInterval: "month",
    featureSummary: [
      "1-3 students",
      "Grades, attendance, and reports",
      "Performance and compliance dashboards",
      "Scheduling and planning tools",
      "Historical records preserved",
      "Secure online access"
    ]
  },
  {
    code: "growth_monthly",
    name: "Growth",
    priceCents: 1499,
    currency: "usd",
    billingInterval: "month",
    featureSummary: [
      "4-10 students",
      "Everything in Starter",
      "More room to grow",
      "Great for multi-child households",
      "Ideal for pods and shared teaching groups"
    ]
  },
  {
    code: "large_monthly",
    name: "Co-op Pro",
    priceCents: 1599,
    currency: "usd",
    billingInterval: "month",
    featureSummary: [
      "11 students included",
      "$0.99 per billable student above 11",
      "Add students as needed",
      "Everything in Growth",
      "Full grades, attendance, and reports",
      "Great for organized group instruction",
      "Historical records preserved"
    ]
  }
];

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload?.error || `Request failed (${response.status})`);
    error.statusCode = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

function formatPrice(cents, currency = "usd") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: String(currency || "usd").toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number(cents || 0) / 100);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getPlanMarketingCopy(planCode) {
  const copyByCode = {
    starter_monthly: "Best for smaller homeschool families.",
    growth_monthly: "Best for larger families and small learning groups.",
    large_monthly: "Best for co-ops and larger programs.",
    support_plus_monthly: "Best for co-ops and larger programs."
  };
  return copyByCode[planCode] || "Hosted access for the Navigrader Homeschool Records Management platform.";
}

function renderPricingCards(plans) {
  const pricingGrid = document.getElementById("pricing-grid");
  if (!pricingGrid) return;
  if (!Array.isArray(plans) || !plans.length) {
    pricingGrid.innerHTML = `
      <article class="pricing-card loading-card">
        <p class="plan-kicker">Plans Unavailable</p>
        <h3>The live plan catalog could not be loaded right now.</h3>
        <ul><li>Refresh the page or try again shortly.</li></ul>
      </article>
    `;
    return;
  }

  pricingGrid.innerHTML = plans.map((plan) => {
    const featured = plan.code === "growth_monthly";
    const features = Array.isArray(plan.featureSummary) ? plan.featureSummary : [];
    return `
      <article class="pricing-card${featured ? " featured-plan" : ""}">
        ${featured ? '<p class="featured-badge">Most Popular</p>' : ""}
        <p class="plan-kicker">${escapeHtml(plan.name)}</p>
        <h3>${escapeHtml(getPlanMarketingCopy(plan.code))}</h3>
        <p class="price-line">${escapeHtml(formatPrice(plan.priceCents, plan.currency))}<span>/${escapeHtml(plan.billingInterval)}</span></p>
        <ul>${features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("")}</ul>
        <a class="plan-cta" href="#subscribe" data-plan-select="${escapeHtml(plan.code)}">Choose ${escapeHtml(plan.name)}</a>
      </article>
    `;
  }).join("");
}

function renderCheckoutPlanOptions(plans) {
  const optionsWrap = document.getElementById("checkout-plan-options");
  if (!optionsWrap || !Array.isArray(plans) || !plans.length) return;
  optionsWrap.innerHTML = plans.map((plan, index) => `
    <label>
      <input type="radio" name="planCode" value="${escapeHtml(plan.code)}"${index === 0 ? " checked" : ""}>
      <span>${escapeHtml(plan.name)} | ${escapeHtml(formatPrice(plan.priceCents, plan.currency))}/${escapeHtml(plan.billingInterval)}</span>
    </label>
  `).join("");
}

function setCheckoutMessage(message, tone = "") {
  const el = document.getElementById("checkout-form-message");
  if (!el) return;
  el.textContent = message || "";
  el.className = `checkout-message${tone ? ` ${tone}` : ""}${message ? "" : " hidden"}`;
}

function redirectSignupStatusRoute() {
  const params = new URLSearchParams(window.location.search);
  const checkoutState = params.get("checkout");
  const token = params.get("token");
  if (!checkoutState && !token) return;
  window.location.replace(`${SIGNUP_STATUS_PAGE}${window.location.search}`);
}

async function loadPlans() {
  try {
    const payload = await fetchJson(`${SAAS_API_BASE}/plans`);
    const plans = Array.isArray(payload?.plans) ? payload.plans : [];
    renderPricingCards(plans);
    renderCheckoutPlanOptions(plans);
  } catch (error) {
    if (window.location.protocol === "file:") {
      renderPricingCards(LOCAL_PLAN_FALLBACK);
      renderCheckoutPlanOptions(LOCAL_PLAN_FALLBACK);
      setCheckoutMessage("Local preview is showing the approved plan copy. Open the hosted page to use live checkout.", "");
      return;
    }
    renderPricingCards([]);
    setCheckoutMessage(error.message || "Unable to load the current public plans.", "error");
  }
}

function bindPlanSelection() {
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const planCode = target.getAttribute("data-plan-select");
    if (!planCode) return;
    const planRadio = document.querySelector(`input[name="planCode"][value="${planCode}"]`);
    if (planRadio instanceof HTMLInputElement) {
      planRadio.checked = true;
      document.getElementById("subscribe")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  });
}

function collectCheckoutPayload() {
  const selectedPlan = document.querySelector('input[name="planCode"]:checked');
  return {
    planCode: selectedPlan instanceof HTMLInputElement ? selectedPlan.value : "",
    accountName: document.getElementById("checkout-account-name")?.value.trim() || "",
    requestedSubdomainLabel: document.getElementById("checkout-subdomain")?.value.trim() || "",
    ownerFirstName: document.getElementById("checkout-owner-first-name")?.value.trim() || "",
    ownerLastName: document.getElementById("checkout-owner-last-name")?.value.trim() || "",
    ownerEmail: document.getElementById("checkout-owner-email")?.value.trim() || "",
    ownerPhone: document.getElementById("checkout-owner-phone")?.value.trim() || "",
    billingEmail: document.getElementById("checkout-billing-email")?.value.trim() || ""
  };
}

function bindCheckoutForm() {
  const form = document.getElementById("checkout-form");
  const submitBtn = document.getElementById("checkout-submit-btn");
  if (!(form instanceof HTMLFormElement) || !(submitBtn instanceof HTMLButtonElement)) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    setCheckoutMessage("");
    submitBtn.disabled = true;
    submitBtn.textContent = "Preparing Secure Checkout...";
    try {
      const payload = collectCheckoutPayload();
      const result = await fetchJson(`${SAAS_API_BASE}/checkout/session`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (result.checkoutUrl) {
        setCheckoutMessage("Checkout session created. Redirecting to secure Stripe Checkout...", "success");
        window.location.assign(result.checkoutUrl);
        return;
      }

      setCheckoutMessage("Checkout session created, but no redirect URL was returned.", "error");
    } catch (error) {
      if (error.statusCode === 409) {
        setCheckoutMessage(`${error.message} The public form and backend are ready; this will begin redirecting once Stripe plan IDs are loaded.`, "error");
      } else {
        setCheckoutMessage(error.message || "Unable to start checkout right now.", "error");
      }
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "Continue To Secure Checkout";
    }
  });
}

redirectSignupStatusRoute();
bindPlanSelection();
bindCheckoutForm();
loadPlans();
