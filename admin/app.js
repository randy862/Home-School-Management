const DEFAULT_API_BASE = document.body?.dataset?.apiBase || "/control-api";
const state = {
  apiBase: DEFAULT_API_BASE,
  setupInitialized: null,
  operator: null,
  tenants: [],
  environments: [],
  jobs: [],
  selectedTenantId: "",
  selectedEnvironmentId: "",
  selectedJobId: ""
};

const refs = {
  apiBaseLabel: document.getElementById("api-base-label"),
  sessionStateLabel: document.getElementById("session-state-label"),
  sessionStateDetail: document.getElementById("session-state-detail"),
  bootstrapCard: document.getElementById("bootstrap-card"),
  loginCard: document.getElementById("login-card"),
  flash: document.getElementById("flash-message"),
  consoleSection: document.getElementById("console-section"),
  operatorName: document.getElementById("operator-name"),
  operatorMeta: document.getElementById("operator-meta"),
  tenantCount: document.getElementById("tenant-count"),
  tenantSummary: document.getElementById("tenant-summary"),
  environmentCount: document.getElementById("environment-count"),
  environmentSummary: document.getElementById("environment-summary"),
  jobCount: document.getElementById("job-count"),
  jobSummary: document.getElementById("job-summary"),
  tenantList: document.getElementById("tenant-list"),
  environmentList: document.getElementById("environment-list"),
  jobList: document.getElementById("job-list"),
  environmentDetail: document.getElementById("environment-detail"),
  jobDetail: document.getElementById("job-detail"),
  tenantForm: document.getElementById("tenant-form"),
  environmentForm: document.getElementById("environment-form"),
  jobForm: document.getElementById("job-form"),
  bootstrapForm: document.getElementById("bootstrap-form"),
  loginForm: document.getElementById("login-form"),
  refreshBtn: document.getElementById("refresh-btn"),
  logoutBtn: document.getElementById("logout-btn"),
  environmentTenantId: document.getElementById("environment-tenant-id"),
  jobEnvironmentId: document.getElementById("job-environment-id"),
  jobTenantId: document.getElementById("job-tenant-id"),
  jobType: document.getElementById("job-type"),
  provisionFields: document.getElementById("provision-fields"),
  setupFields: document.getElementById("setup-fields"),
  tenantEditId: document.getElementById("tenant-edit-id"),
  tenantSlug: document.getElementById("tenant-slug"),
  tenantDisplayName: document.getElementById("tenant-display-name"),
  tenantPrimaryDomain: document.getElementById("tenant-primary-domain"),
  tenantDomainType: document.getElementById("tenant-domain-type"),
  tenantPlanCode: document.getElementById("tenant-plan-code"),
  tenantStatus: document.getElementById("tenant-status"),
  tenantContactName: document.getElementById("tenant-contact-name"),
  tenantContactEmail: document.getElementById("tenant-contact-email"),
  tenantNotes: document.getElementById("tenant-notes"),
  tenantSubmitBtn: document.getElementById("tenant-submit-btn"),
  tenantResetBtn: document.getElementById("tenant-reset-btn")
};

function apiUrl(path) {
  return `${state.apiBase}${path}`;
}

async function apiFetch(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const body = isJson ? await response.json() : null;
  if (!response.ok) {
    const error = new Error(body?.error || `Request failed: ${response.status}`);
    error.status = response.status;
    error.body = body;
    throw error;
  }
  return body;
}

function setFlash(kind, message) {
  if (!message) {
    refs.flash.className = "flash hidden";
    refs.flash.textContent = "";
    return;
  }
  refs.flash.className = `flash ${kind}`;
  refs.flash.textContent = message;
}

function setSessionState(title, detail) {
  refs.sessionStateLabel.textContent = title;
  refs.sessionStateDetail.textContent = detail;
}

function renderAuthState() {
  const initialized = state.setupInitialized;
  const operator = state.operator;

  refs.apiBaseLabel.textContent = state.apiBase;
  refs.bootstrapCard.classList.toggle("hidden", initialized !== false || !!operator);
  refs.loginCard.classList.toggle("hidden", initialized !== true || !!operator);
  refs.consoleSection.classList.toggle("hidden", !operator);

  if (!operator && initialized === false) {
    setSessionState("Bootstrap Required", "No control-plane operators exist yet. Create the first platform administrator.");
  } else if (!operator && initialized === true) {
    setSessionState("Login Required", "Control-plane bootstrap is complete. Sign in with an operator account.");
  } else if (operator) {
    setSessionState("Authenticated", `${operator.username} is signed in as ${operator.role}.`);
  } else {
    setSessionState("Checking", "Determining control-plane setup and session state.");
  }
}

function renderOperator() {
  if (!state.operator) return;
  refs.operatorName.textContent = state.operator.username;
  refs.operatorMeta.textContent = `${state.operator.role} | ${state.operator.isActive ? "active" : "inactive"}`;
  const isPlatformAdmin = state.operator.role === "platform_admin";
  refs.tenantForm.classList.toggle("hidden", !isPlatformAdmin);
  refs.environmentForm.classList.toggle("hidden", !isPlatformAdmin);
  refs.jobForm.classList.toggle("hidden", !isPlatformAdmin);
}

function renderLists() {
  const activeTenants = state.tenants.filter((tenant) => tenant.status === "active").length;
  const provisioningEnvironments = state.environments.filter((environment) => environment.status === "provisioning").length;
  const tokenIssuedEnvironments = state.environments.filter((environment) => environment.setupState === "token_issued").length;
  const queuedJobs = state.jobs.filter((job) => job.status === "queued").length;
  const completedJobs = state.jobs.filter((job) => ["completed", "succeeded"].includes(job.status)).length;

  refs.tenantCount.textContent = String(state.tenants.length);
  refs.tenantSummary.textContent = `${activeTenants} active, ${Math.max(state.tenants.length - activeTenants, 0)} not active.`;
  refs.environmentCount.textContent = String(state.environments.length);
  refs.environmentSummary.textContent = `${provisioningEnvironments} provisioning, ${tokenIssuedEnvironments} token issued.`;
  refs.jobCount.textContent = String(queuedJobs);
  refs.jobSummary.textContent = `${completedJobs} completed, ${Math.max(state.jobs.length - queuedJobs - completedJobs, 0)} in other states.`;

  refs.tenantList.innerHTML = renderTenantItems(state.tenants);
  refs.environmentList.innerHTML = renderEnvironmentItems(state.environments);
  refs.jobList.innerHTML = renderJobItems(state.jobs);

  populateSelect(refs.environmentTenantId, state.tenants, "id", (tenant) => `${tenant.displayName} (${tenant.slug})`);
  populateSelect(refs.jobTenantId, state.tenants, "id", (tenant) => `${tenant.displayName} (${tenant.slug})`, true);
  populateSelect(refs.jobEnvironmentId, state.environments, "id", (environment) => `${environment.displayName} (${environment.environmentKey})`, true);

  bindRecordClicks();
}

function populateSelect(select, items, valueKey, labelFn, includeBlank = false) {
  if (!select) return;
  const current = select.value;
  const options = [];
  if (includeBlank) options.push('<option value="">Choose one</option>');
  for (const item of items) {
    options.push(`<option value="${escapeHtml(item[valueKey])}">${escapeHtml(labelFn(item))}</option>`);
  }
  select.innerHTML = options.join("");
  if (Array.from(select.options).some((option) => option.value === current)) {
    select.value = current;
  }
}

function renderTenantItems(tenants) {
  if (!tenants.length) return '<div class="empty-state">No tenants recorded yet.</div>';
  return tenants.map((tenant) => `
    <article class="record-item ${tenant.id === state.selectedTenantId ? "selected" : ""}" data-tenant-id="${escapeHtml(tenant.id)}">
      <h3>${escapeHtml(tenant.displayName)}</h3>
      <div class="record-meta">
        ${renderStatusTag(tenant.status, "tenant")}
        <span class="tag">${escapeHtml(tenant.planCode || "standard")}</span>
        <span class="tag">${escapeHtml(tenant.slug)}</span>
      </div>
      <p>${escapeHtml(tenant.primaryContactName || "No primary contact recorded.")}</p>
      <p>${escapeHtml(tenant.primaryContactEmail || tenant.primaryDomain || "No contact channel recorded.")}</p>
      <p><code>${escapeHtml(tenant.id)}</code></p>
    </article>
  `).join("");
}

function renderEnvironmentItems(environments) {
  if (!environments.length) return '<div class="empty-state">No environments created yet.</div>';
  return environments.map((environment) => `
    <article class="record-item ${environment.id === state.selectedEnvironmentId ? "selected" : ""}" data-environment-id="${escapeHtml(environment.id)}">
      <h3>${escapeHtml(environment.displayName)}</h3>
      <div class="record-meta">
        ${renderStatusTag(environment.status, "environment")}
        ${renderStatusTag(environment.setupState || "uninitialized", "setup")}
        <span class="tag">${escapeHtml(environment.environmentKey)}</span>
      </div>
      <p>${escapeHtml(environment.tenantDisplayName || environment.tenantId || "Unknown tenant")}</p>
      <p>${escapeHtml(environment.appBaseUrl || "No app base URL recorded.")}</p>
      <p><code>${escapeHtml(environment.id)}</code></p>
    </article>
  `).join("");
}

function renderJobItems(jobs) {
  if (!jobs.length) return '<div class="empty-state">No provisioning jobs queued yet.</div>';
  return jobs.map((job) => `
    <article class="record-item ${job.id === state.selectedJobId ? "selected" : ""}" data-job-id="${escapeHtml(job.id)}">
      <h3>${escapeHtml(formatJobType(job.jobType))}</h3>
      <div class="record-meta">
        ${renderStatusTag(job.status, "job")}
        <span class="tag">${escapeHtml(job.tenantEnvironmentId || "no-environment")}</span>
      </div>
      <p>${escapeHtml(formatDateTime(job.requestedAt) || "No request time recorded.")}</p>
      <p><code>${escapeHtml(job.id)}</code></p>
    </article>
  `).join("");
}

function renderEnvironmentDetail(environment) {
  if (!environment) {
    refs.environmentDetail.classList.add("hidden");
    refs.environmentDetail.innerHTML = "";
    return;
  }
  refs.environmentDetail.classList.remove("hidden");
  const relatedJobs = state.jobs
    .filter((job) => job.tenantEnvironmentId === environment.id)
    .sort((left, right) => compareDatesDesc(left.requestedAt, right.requestedAt));
  refs.environmentDetail.innerHTML = `
    <div class="detail-toolbar">
      <div>
        <strong>Environment Detail</strong>
        <p class="detail-copy">${escapeHtml(environment.tenantDisplayName || environment.tenantId || "Unknown tenant")} / ${escapeHtml(environment.environmentKey || "environment")}</p>
      </div>
      <button id="environment-detail-refresh" type="button" class="secondary-btn">Refresh Detail</button>
    </div>
    <div class="detail-badges">
      ${renderStatusTag(environment.status, "environment")}
      ${renderStatusTag(environment.setupState || "uninitialized", "setup")}
      <span class="tag">${escapeHtml(environment.appHost || "no-app-host")}</span>
      <span class="tag">${escapeHtml(environment.webHost || "no-web-host")}</span>
    </div>
    <div class="detail-grid">
      ${renderDetailField("App Base URL", environment.appBaseUrl)}
      ${renderDetailField("Database", [environment.databaseHost, environment.databaseName, environment.databaseSchema].filter(Boolean).join(" / "))}
      ${renderDetailField("Created", formatDateTime(environment.createdAt))}
      ${renderDetailField("Updated", formatDateTime(environment.updatedAt))}
      ${renderDetailField("Initialized", formatDateTime(environment.initializedAt))}
      ${renderDetailField("Health", environment.lastHealthStatus ? `${environment.lastHealthStatus} at ${formatDateTime(environment.lastHealthCheckAt)}` : "No health check recorded")}
    </div>
    <section class="history-block">
      <h4>Action History</h4>
      ${renderTimeline([
        { label: "Environment record created", when: environment.createdAt, tone: "info" },
        { label: `Runtime status set to ${environment.status || "unknown"}`, when: environment.updatedAt, tone: environment.status === "ready" ? "success" : "info" },
        { label: `Setup state is ${environment.setupState || "uninitialized"}`, when: environment.updatedAt, tone: environment.setupState === "token_issued" ? "warn" : "info" },
        { label: "Environment initialized", when: environment.initializedAt, tone: "success" },
        { label: `Last health check: ${environment.lastHealthStatus || "unknown"}`, when: environment.lastHealthCheckAt, tone: environment.lastHealthStatus === "healthy" ? "success" : "warn" }
      ])}
    </section>
    <section class="history-block">
      <h4>Related Jobs</h4>
      ${renderRelatedJobs(relatedJobs)}
    </section>
    <details class="raw-details">
      <summary>Raw JSON</summary>
      <pre>${escapeHtml(JSON.stringify(environment, null, 2))}</pre>
    </details>
  `;
  document.getElementById("environment-detail-refresh")?.addEventListener("click", async () => {
    if (state.selectedEnvironmentId) await loadEnvironmentDetail(state.selectedEnvironmentId, true);
  });
  refs.environmentDetail.querySelectorAll("[data-job-id]").forEach((element) => {
    element.addEventListener("click", async () => {
      await loadJobDetail(element.getAttribute("data-job-id"));
    });
  });
}

function renderJobDetail(job) {
  if (!job) {
    refs.jobDetail.classList.add("hidden");
    refs.jobDetail.innerHTML = "";
    return;
  }
  refs.jobDetail.classList.remove("hidden");
  refs.jobDetail.innerHTML = `
    <div class="detail-toolbar">
      <div>
        <strong>Job Detail</strong>
        <p class="detail-copy">${escapeHtml(formatJobType(job.jobType))}</p>
      </div>
      <button id="job-detail-refresh" type="button" class="secondary-btn">Refresh Detail</button>
    </div>
    <div class="detail-badges">
      ${renderStatusTag(job.status, "job")}
      <span class="tag">${escapeHtml(job.tenantEnvironmentId || "no-environment")}</span>
      <span class="tag">${escapeHtml(job.tenantId || "no-tenant")}</span>
    </div>
    <div class="detail-grid">
      ${renderDetailField("Requested", formatDateTime(job.requestedAt))}
      ${renderDetailField("Started", formatDateTime(job.startedAt))}
      ${renderDetailField("Completed", formatDateTime(job.completedAt))}
      ${renderDetailField("Requested By", job.requestedByOperatorUserId)}
      ${renderDetailField("Error", job.errorMessage || job.errorCode || "None")}
      ${renderDetailField("Idempotency", job.idempotencyKey || "None")}
    </div>
    <section class="history-block">
      <h4>Lifecycle</h4>
      ${renderTimeline([
        { label: "Job queued", when: job.requestedAt, tone: "info" },
        { label: "Job started", when: job.startedAt, tone: "warn" },
        { label: "Job completed", when: job.completedAt, tone: "success" },
        { label: `Job status is ${job.status || "unknown"}`, when: job.completedAt || job.startedAt || job.requestedAt, tone: ["completed", "succeeded"].includes(job.status) ? "success" : "info" }
      ])}
    </section>
    <section class="history-block">
      <h4>Events</h4>
      ${renderTimeline((job.events || []).map((event) => ({
        label: `${formatJobEventType(event.eventType)}: ${event.message}`,
        when: event.createdAt,
        tone: eventTone(event.eventType)
      })))}
    </section>
    <section class="history-block">
      <h4>Payload</h4>
      <pre>${escapeHtml(JSON.stringify(job.payload || {}, null, 2))}</pre>
    </section>
    <section class="history-block">
      <h4>Result</h4>
      <pre>${escapeHtml(JSON.stringify(job.result || {}, null, 2))}</pre>
    </section>
  `;
  document.getElementById("job-detail-refresh")?.addEventListener("click", async () => {
    if (state.selectedJobId) await loadJobDetail(state.selectedJobId, true);
  });
}

function bindRecordClicks() {
  refs.tenantList.querySelectorAll("[data-tenant-id]").forEach((element) => {
    element.addEventListener("click", async () => {
      await selectTenant(element.getAttribute("data-tenant-id"));
    });
  });
  refs.environmentList.querySelectorAll("[data-environment-id]").forEach((element) => {
    element.addEventListener("click", async () => {
      await loadEnvironmentDetail(element.getAttribute("data-environment-id"));
    });
  });
  refs.jobList.querySelectorAll("[data-job-id]").forEach((element) => {
    element.addEventListener("click", async () => {
      await loadJobDetail(element.getAttribute("data-job-id"));
    });
  });
}

async function selectTenant(tenantId) {
  state.selectedTenantId = tenantId;
  renderLists();
  try {
    const tenant = await apiFetch(`/api/control/tenants/${encodeURIComponent(tenantId)}`);
    fillTenantFormForEdit(tenant);
    setFlash("info", `Loaded tenant ${tenant.displayName} for editing.`);
  } catch (error) {
    setFlash("error", error.message);
  }
}

function fillTenantFormForEdit(tenant) {
  refs.tenantEditId.value = tenant.id;
  refs.tenantSlug.value = tenant.slug || "";
  refs.tenantSlug.disabled = true;
  refs.tenantPrimaryDomain.disabled = true;
  refs.tenantDomainType.disabled = true;
  refs.tenantDisplayName.value = tenant.displayName || "";
  refs.tenantPlanCode.value = tenant.planCode || "standard";
  refs.tenantStatus.value = tenant.status || "draft";
  refs.tenantContactName.value = tenant.primaryContactName || "";
  refs.tenantContactEmail.value = tenant.primaryContactEmail || "";
  refs.tenantNotes.value = tenant.notes || "";
  refs.tenantSubmitBtn.textContent = "Save Tenant";
  refs.tenantResetBtn.classList.remove("hidden");
}

function resetTenantForm() {
  refs.tenantForm.reset();
  refs.tenantEditId.value = "";
  refs.tenantSlug.disabled = false;
  refs.tenantPrimaryDomain.disabled = false;
  refs.tenantDomainType.disabled = false;
  refs.tenantDomainType.value = "platform_subdomain";
  refs.tenantPlanCode.value = "standard";
  refs.tenantStatus.value = "draft";
  refs.tenantSubmitBtn.textContent = "Create Tenant";
  refs.tenantResetBtn.classList.add("hidden");
  state.selectedTenantId = "";
  renderLists();
}

async function loadEnvironmentDetail(environmentId, silent = false) {
  state.selectedEnvironmentId = environmentId;
  renderLists();
  try {
    const environment = await apiFetch(`/api/control/environments/${encodeURIComponent(environmentId)}`);
    renderEnvironmentDetail(environment);
    if (!silent) setFlash("info", `Loaded environment ${environment.displayName}.`);
  } catch (error) {
    setFlash("error", error.message);
  }
}

async function loadJobDetail(jobId, silent = false) {
  state.selectedJobId = jobId;
  renderLists();
  try {
    const job = await apiFetch(`/api/control/jobs/${encodeURIComponent(jobId)}`);
    renderJobDetail(job);
    if (!silent) setFlash("info", `Loaded job ${job.id}.`);
  } catch (error) {
    setFlash("error", error.message);
  }
}

async function bootstrap() {
  renderAuthState();
  bindEvents();
  syncJobFormMode();
  resetTenantForm();
  await refreshSession();
}

async function refreshSession() {
  setFlash("info", "Loading control-plane status...");
  try {
    const status = await apiFetch("/api/operator/setup/status");
    state.setupInitialized = !!status.initialized;
    try {
      const me = await apiFetch("/api/operator/me");
      state.operator = me.user;
    } catch (error) {
      if (error.status === 401) {
        state.operator = null;
      } else {
        throw error;
      }
    }

    renderAuthState();
    if (state.operator) {
      renderOperator();
      await refreshData(false);
      setFlash("success", "Control-plane session ready.");
    } else {
      setFlash(null, "");
    }
  } catch (error) {
    setFlash("error", error.message);
    renderAuthState();
  }
}

async function refreshData(showFlash = true) {
  if (!state.operator) return;
  if (showFlash) setFlash("info", "Refreshing control-plane data...");
  try {
    const [tenants, environments, jobs] = await Promise.all([
      apiFetch("/api/control/tenants"),
      apiFetch("/api/control/environments"),
      apiFetch("/api/control/jobs")
    ]);
    state.tenants = Array.isArray(tenants) ? tenants : [];
    state.environments = Array.isArray(environments) ? environments : [];
    state.jobs = Array.isArray(jobs) ? jobs : [];
    renderOperator();
    renderLists();
    syncJobFormMode();
    if (state.selectedEnvironmentId) await loadEnvironmentDetail(state.selectedEnvironmentId, true);
    if (state.selectedJobId) await loadJobDetail(state.selectedJobId, true);
    if (showFlash) setFlash("success", "Control-plane data refreshed.");
  } catch (error) {
    setFlash("error", error.message);
  }
}

function bindEvents() {
  refs.bootstrapForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFlash("info", "Creating the first operator...");
    try {
      const body = {
        username: document.getElementById("bootstrap-username").value.trim(),
        password: document.getElementById("bootstrap-password").value
      };
      await apiFetch("/api/operator/setup/bootstrap", {
        method: "POST",
        body: JSON.stringify(body)
      });
      refs.bootstrapForm.reset();
      await refreshSession();
      setFlash("success", "First operator created and signed in.");
    } catch (error) {
      setFlash("error", error.message);
    }
  });

  refs.loginForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFlash("info", "Signing in...");
    try {
      const body = {
        username: document.getElementById("login-username").value.trim(),
        password: document.getElementById("login-password").value
      };
      await apiFetch("/api/operator/auth/login", {
        method: "POST",
        body: JSON.stringify(body)
      });
      refs.loginForm.reset();
      await refreshSession();
      setFlash("success", "Signed in to the control plane.");
    } catch (error) {
      setFlash("error", error.message);
    }
  });

  refs.logoutBtn?.addEventListener("click", async () => {
    setFlash("info", "Signing out...");
    try {
      await apiFetch("/api/operator/auth/logout", { method: "POST", body: JSON.stringify({}) });
      state.operator = null;
      state.tenants = [];
      state.environments = [];
      state.jobs = [];
      state.selectedTenantId = "";
      state.selectedEnvironmentId = "";
      state.selectedJobId = "";
      renderEnvironmentDetail(null);
      renderJobDetail(null);
      resetTenantForm();
      renderLists();
      renderAuthState();
      setFlash("success", "Signed out.");
    } catch (error) {
      setFlash("error", error.message);
    }
  });

  refs.refreshBtn?.addEventListener("click", async () => {
    await refreshData(true);
  });

  refs.tenantResetBtn?.addEventListener("click", () => {
    resetTenantForm();
    setFlash("info", "Tenant edit canceled.");
  });

  refs.tenantForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const editId = refs.tenantEditId.value.trim();
    const creating = !editId;
    setFlash("info", creating ? "Creating tenant..." : "Saving tenant changes...");
    try {
      const body = {
        slug: refs.tenantSlug.value.trim(),
        displayName: refs.tenantDisplayName.value.trim(),
        primaryDomain: refs.tenantPrimaryDomain.value.trim(),
        primaryDomainType: refs.tenantDomainType.value,
        planCode: refs.tenantPlanCode.value.trim(),
        status: refs.tenantStatus.value,
        primaryContactName: refs.tenantContactName.value.trim(),
        primaryContactEmail: refs.tenantContactEmail.value.trim(),
        notes: refs.tenantNotes.value.trim()
      };
      if (creating) {
        await apiFetch("/api/control/tenants", { method: "POST", body: JSON.stringify(body) });
      } else {
        await apiFetch(`/api/control/tenants/${encodeURIComponent(editId)}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      resetTenantForm();
      await refreshData(false);
      setFlash("success", creating ? "Tenant created." : "Tenant updated.");
    } catch (error) {
      setFlash("error", error.message);
    }
  });

  refs.environmentForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    setFlash("info", "Creating environment...");
    try {
      const tenantId = refs.environmentTenantId.value;
      const body = {
        environmentKey: document.getElementById("environment-key").value.trim(),
        displayName: document.getElementById("environment-display-name").value.trim(),
        appBaseUrl: document.getElementById("environment-app-base-url").value.trim(),
        appHost: document.getElementById("environment-app-host").value.trim(),
        webHost: document.getElementById("environment-web-host").value.trim(),
        databaseHost: document.getElementById("environment-db-host").value.trim(),
        databaseName: document.getElementById("environment-db-name").value.trim(),
        databaseSchema: document.getElementById("environment-db-schema").value.trim()
      };
      await apiFetch(`/api/control/tenants/${encodeURIComponent(tenantId)}/environments`, {
        method: "POST",
        body: JSON.stringify(body)
      });
      refs.environmentForm.reset();
      await refreshData(false);
      setFlash("success", "Environment created.");
    } catch (error) {
      setFlash("error", error.message);
    }
  });

  refs.jobForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const jobType = refs.jobType.value;
    const environmentId = refs.jobEnvironmentId.value;
    const tenantId = refs.jobTenantId.value;
    setFlash("info", jobType === "issue_setup_token" ? "Queueing setup-token issuance..." : "Queueing provision job...");
    try {
      const path = `/api/control/environments/${encodeURIComponent(environmentId)}/${jobType === "issue_setup_token" ? "setup-token" : "provision"}`;
      let body;
      if (jobType === "issue_setup_token") {
        body = {
          tenantId,
          ttlHours: Number(document.getElementById("job-ttl-hours").value || 2),
          deliveredVia: document.getElementById("job-delivered-via").value.trim(),
          notes: document.getElementById("job-notes").value.trim(),
          idempotencyKey: document.getElementById("job-idempotency-key").value.trim()
        };
      } else {
        body = {
          tenantId,
          releaseVersion: document.getElementById("job-release-version").value.trim(),
          appHost: document.getElementById("job-app-host").value.trim(),
          webHost: document.getElementById("job-web-host").value.trim(),
          databaseHost: document.getElementById("job-db-host").value.trim(),
          databaseName: document.getElementById("job-db-name").value.trim(),
          idempotencyKey: document.getElementById("job-idempotency-key").value.trim()
        };
      }
      const job = await apiFetch(path, { method: "POST", body: JSON.stringify(body) });
      refs.jobForm.reset();
      document.getElementById("job-ttl-hours").value = "2";
      document.getElementById("job-delivered-via").value = "operator_console";
      refs.jobType.value = "provision_environment";
      syncJobFormMode();
      state.selectedJobId = job.id;
      await refreshData(false);
      await loadJobDetail(job.id, true);
      setFlash("success", "Job queued.");
    } catch (error) {
      setFlash("error", error.message);
    }
  });

  refs.jobType?.addEventListener("change", syncJobFormMode);
}

function syncJobFormMode() {
  const isSetup = refs.jobType?.value === "issue_setup_token";
  refs.provisionFields?.classList.toggle("hidden", isSetup);
  refs.setupFields?.classList.toggle("hidden", !isSetup);
}

function renderStatusTag(value, kind = "neutral") {
  return `<span class="tag tag-${escapeHtml(kind)} tag-${escapeHtml(String(value || "unknown").toLowerCase().replace(/[^a-z0-9-]/g, "-"))}">${escapeHtml(value || "unknown")}</span>`;
}

function renderDetailField(label, value) {
  return `
    <div class="detail-field">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "Not recorded")}</strong>
    </div>
  `;
}

function renderTimeline(events) {
  const visibleEvents = events.filter((event) => event.when);
  if (!visibleEvents.length) {
    return '<div class="empty-state">No action history recorded yet.</div>';
  }
  return `
    <div class="timeline">
      ${visibleEvents.map((event) => `
        <div class="timeline-item">
          <span class="timeline-dot timeline-${escapeHtml(event.tone || "info")}"></span>
          <div>
            <strong>${escapeHtml(event.label)}</strong>
            <p>${escapeHtml(formatDateTime(event.when))}</p>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderRelatedJobs(jobs) {
  if (!jobs.length) {
    return '<div class="empty-state">No jobs have targeted this environment yet.</div>';
  }
  return `
    <div class="mini-list">
      ${jobs.map((job) => `
        <button type="button" class="mini-item" data-job-id="${escapeHtml(job.id)}">
          <div>
            <strong>${escapeHtml(formatJobType(job.jobType))}</strong>
            <p>${escapeHtml(formatDateTime(job.requestedAt))}</p>
          </div>
          ${renderStatusTag(job.status, "job")}
        </button>
      `).join("")}
    </div>
  `;
}

function eventTone(eventType) {
  const normalized = String(eventType || "").toLowerCase();
  if (["succeeded", "completed", "release_registered"].includes(normalized)) return "success";
  if (["failed", "error"].includes(normalized)) return "danger";
  if (["running", "database_prepared", "runtime_allocated", "token_issued"].includes(normalized)) return "warn";
  return "info";
}

function compareDatesDesc(left, right) {
  return new Date(right || 0).getTime() - new Date(left || 0).getTime();
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

function formatJobType(value) {
  return String(value || "job")
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function formatJobEventType(value) {
  return formatJobType(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

bootstrap();
