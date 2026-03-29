const DEFAULT_API_BASE = document.body?.dataset?.apiBase || "/control-api";
const state = {
  apiBase: DEFAULT_API_BASE,
  setupInitialized: null,
  operator: null,
  tenants: [],
  environments: [],
  jobs: [],
  activeWorkspace: "tenants",
  selectedTenantId: "",
  selectedEnvironmentId: "",
  selectedJobId: ""
};

const refs = {
  bootstrapCard: document.getElementById("bootstrap-card"),
  loginCard: document.getElementById("login-card"),
  flash: document.getElementById("flash-message"),
  consoleSection: document.getElementById("console-section"),
  tabTenants: document.getElementById("tab-tenants"),
  tabEnvironments: document.getElementById("tab-environments"),
  tabJobs: document.getElementById("tab-jobs"),
  workspaceTenants: document.getElementById("workspace-tenants"),
  workspaceEnvironments: document.getElementById("workspace-environments"),
  workspaceJobs: document.getElementById("workspace-jobs"),
  operatorName: document.getElementById("operator-name"),
  operatorSessionBadge: document.getElementById("operator-session-badge"),
  operatorMeta: document.getElementById("operator-meta"),
  customerCount: document.getElementById("customer-count"),
  customerSummary: document.getElementById("customer-summary"),
  activeCustomerCount: document.getElementById("active-customer-count"),
  activeCustomerSummary: document.getElementById("active-customer-summary"),
  setupNeededCount: document.getElementById("setup-needed-count"),
  setupNeededSummary: document.getElementById("setup-needed-summary"),
  attentionCount: document.getElementById("attention-count"),
  attentionSummary: document.getElementById("attention-summary"),
  tenantList: document.getElementById("tenant-list"),
  tenantDetailShell: document.getElementById("tenant-detail-shell"),
  tenantDetailBody: document.getElementById("tenant-detail-body"),
  environmentList: document.getElementById("environment-list"),
  jobList: document.getElementById("job-list"),
  environmentFormShell: document.getElementById("environment-form-shell"),
  environmentDetail: document.getElementById("environment-detail"),
  jobFormShell: document.getElementById("job-form-shell"),
  jobDetail: document.getElementById("job-detail"),
  tenantFormShell: document.getElementById("tenant-form-shell"),
  tenantFormTitle: document.getElementById("tenant-form-title"),
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
  tenantResetBtn: document.getElementById("tenant-reset-btn"),
  tenantOpenCreateBtn: document.getElementById("tenant-open-create-btn"),
  tenantDetailEditBtn: document.getElementById("tenant-detail-edit-btn"),
  tenantDetailCloseBtn: document.getElementById("tenant-detail-close-btn"),
  environmentOpenCreateBtn: document.getElementById("environment-open-create-btn"),
  environmentResetBtn: document.getElementById("environment-reset-btn"),
  jobOpenCreateBtn: document.getElementById("job-open-create-btn"),
  jobResetBtn: document.getElementById("job-reset-btn")
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
  if (refs.operatorSessionBadge) refs.operatorSessionBadge.textContent = title;
  if (refs.operatorMeta && !state.operator) refs.operatorMeta.textContent = detail;
}

function renderAuthState() {
  const initialized = state.setupInitialized;
  const operator = state.operator;

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
  refs.operatorSessionBadge.textContent = state.operator.isActive ? "Signed In" : "Inactive";
  const isPlatformAdmin = state.operator.role === "platform_admin";
  refs.tenantForm.classList.toggle("hidden", !isPlatformAdmin);
  refs.environmentForm.classList.toggle("hidden", !isPlatformAdmin);
  refs.jobForm.classList.toggle("hidden", !isPlatformAdmin);
  renderWorkspaceTabs();
}

function renderLists() {
  const activeTenants = state.tenants.filter((tenant) => tenant.status === "active").length;
  const draftTenants = state.tenants.filter((tenant) => tenant.status !== "active").length;
  const setupNeeded = state.environments.filter((environment) => !["token_issued", "initialized"].includes(String(environment.setupState || "").toLowerCase())).length;
  const failedJobs = state.jobs.filter((job) => String(job.status || "").toLowerCase() === "failed").length;
  const inFlightJobs = state.jobs.filter((job) => ["queued", "running"].includes(String(job.status || "").toLowerCase())).length;

  refs.customerCount.textContent = String(state.tenants.length);
  refs.customerSummary.textContent = `${activeTenants} active, ${draftTenants} still in draft or inactive states.`;
  refs.activeCustomerCount.textContent = String(activeTenants);
  refs.activeCustomerSummary.textContent = `${Math.max(state.tenants.length - activeTenants, 0)} customer records still need activation or follow-up.`;
  refs.setupNeededCount.textContent = String(setupNeeded);
  refs.setupNeededSummary.textContent = setupNeeded ? `${setupNeeded} environment${setupNeeded === 1 ? "" : "s"} still need setup completion.` : "All recorded environments have setup issued or completed.";
  refs.attentionCount.textContent = String(failedJobs + inFlightJobs);
  refs.attentionSummary.textContent = failedJobs
    ? `${failedJobs} failed job${failedJobs === 1 ? "" : "s"} need review, with ${inFlightJobs} still in progress.`
    : (inFlightJobs ? `${inFlightJobs} job${inFlightJobs === 1 ? "" : "s"} currently in progress.` : "No failed or in-progress jobs need attention.");

  refs.tenantList.innerHTML = renderTenantTable(state.tenants);
  refs.environmentList.innerHTML = renderEnvironmentTable(state.environments);
  refs.jobList.innerHTML = renderJobTable(state.jobs);

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

function renderTenantTable(tenants) {
  if (!tenants.length) return '<div class="empty-state">No tenants recorded yet.</div>';
  return `
    <div class="table-shell">
      <table class="data-table">
        <thead>
          <tr>
            <th>Organization</th>
            <th>Contact Name</th>
            <th>Contact Email</th>
            <th>Tenant URL</th>
            <th>Status</th>
            <th>Plan</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${tenants.map((tenant) => `
            <tr class="${tenant.id === state.selectedTenantId ? "selected-row" : ""}">
              <td>
                <button type="button" class="text-link-btn tenant-detail-link" data-tenant-detail-id="${escapeHtml(tenant.id)}">${escapeHtml(tenant.displayName)}</button>
                <div class="table-subcopy">${escapeHtml(tenant.slug)}</div>
              </td>
              <td>${escapeHtml(tenant.primaryContactName || "Not recorded")}</td>
              <td>${escapeHtml(tenant.primaryContactEmail || "Not recorded")}</td>
              <td>${tenant.primaryDomain ? `<a href="http://${escapeHtml(tenant.primaryDomain)}" target="_blank" rel="noreferrer">${escapeHtml(tenant.primaryDomain)}</a>` : "Not recorded"}</td>
              <td>${renderStatusTag(tenant.status, "tenant")}</td>
              <td>${escapeHtml(tenant.planCode || "standard")}</td>
              <td>
                <div class="table-actions">
                  <button type="button" class="secondary-btn table-action-btn" data-tenant-detail-id="${escapeHtml(tenant.id)}">Details</button>
                  <button type="button" class="secondary-btn table-action-btn" data-tenant-id="${escapeHtml(tenant.id)}">View / Edit</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderTenantDetail(tenant) {
  refs.tenantDetailShell.classList.remove("hidden");
  refs.tenantDetailBody.innerHTML = `
    <div class="compact-details">
      ${renderDetailField("Organization Name", tenant.displayName || "Not recorded")}
      ${renderDetailField("Slug", tenant.slug || "Not recorded")}
      ${renderDetailFieldHtml("Tenant URL", tenant.primaryDomain ? `<a href="http://${escapeHtml(tenant.primaryDomain)}" target="_blank" rel="noreferrer">${escapeHtml(tenant.primaryDomain)}</a>` : "Not recorded")}
      ${renderDetailField("Domain Type", startCase(tenant.primaryDomainType || "platform_subdomain"))}
      ${renderDetailField("Status", startCase(tenant.status || "draft"))}
      ${renderDetailField("Subscription Plan", tenant.planCode || "standard")}
      ${renderDetailField("Contact Name", tenant.primaryContactName || "Not recorded")}
      ${renderDetailField("Contact Email", tenant.primaryContactEmail || "Not recorded")}
      ${renderDetailField("Notes", tenant.notes || "None recorded")}
      ${renderDetailField("Created", formatDateTime(tenant.createdAt))}
      ${renderDetailField("Updated", formatDateTime(tenant.updatedAt))}
    </div>
    <section class="history-block">
      <h4>Operator Activity</h4>
      ${renderAuditTrail(tenant.auditEntries || [], "No operator activity recorded for this customer yet.")}
    </section>
  `;
}

function renderEnvironmentTable(environments) {
  if (!environments.length) return '<div class="empty-state">No environments created yet.</div>';
  return `
    <div class="table-shell">
      <table class="data-table">
        <thead>
          <tr>
            <th>Tenant</th>
            <th>Environment</th>
            <th>App URL</th>
            <th>Status</th>
            <th>Setup</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${environments.map((environment) => `
            <tr class="${environment.id === state.selectedEnvironmentId ? "selected-row" : ""}">
              <td>
                <button type="button" class="text-link-btn" data-environment-detail-id="${escapeHtml(environment.id)}">${escapeHtml(environment.tenantDisplayName || environment.tenantId || "Unknown tenant")}</button>
                <div class="table-subcopy">${escapeHtml(environment.tenantSlug || "")}</div>
              </td>
              <td>
                <strong>${escapeHtml(environment.displayName || "Environment")}</strong>
                <div class="table-subcopy">${escapeHtml(environment.environmentKey || "No key recorded")}</div>
              </td>
              <td>${environment.appBaseUrl ? `<a href="${escapeHtml(environment.appBaseUrl)}" target="_blank" rel="noreferrer">${escapeHtml(environment.appBaseUrl)}</a>` : "Not recorded"}</td>
              <td>${renderStatusTag(environment.status, "environment")}</td>
              <td>${renderStateTag(environment.setupState || "uninitialized", "setup", formatSetupState(environment.setupState || "uninitialized"))}</td>
              <td>
                <div class="table-actions">
                  <button type="button" class="secondary-btn table-action-btn" data-environment-detail-id="${escapeHtml(environment.id)}">Details</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderJobTable(jobs) {
  if (!jobs.length) return '<div class="empty-state">No provisioning jobs queued yet.</div>';
  return `
    <div class="table-shell">
      <table class="data-table">
        <thead>
          <tr>
            <th>Tenant</th>
            <th>Job Type</th>
            <th>Environment</th>
            <th>Requested</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${jobs.map((job) => `
            <tr class="${job.id === state.selectedJobId ? "selected-row" : ""}">
              <td>
                <button type="button" class="text-link-btn" data-job-detail-id="${escapeHtml(job.id)}">${escapeHtml(resolveJobTenantName(job))}</button>
                <div class="table-subcopy">${escapeHtml(resolveJobTenantSlug(job))}</div>
              </td>
              <td>${escapeHtml(formatJobType(job.jobType))}</td>
              <td>${escapeHtml(resolveEnvironmentName(job.tenantEnvironmentId) || job.tenantEnvironmentId || "Not recorded")}</td>
              <td>${escapeHtml(formatDateTime(job.requestedAt) || "Not recorded")}</td>
              <td>${renderStatusTag(job.status, "job")}</td>
              <td>
                <div class="table-actions">
                  <button type="button" class="secondary-btn table-action-btn" data-job-detail-id="${escapeHtml(job.id)}">Details</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
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
    <section class="history-block">
      <h4>Operator Activity</h4>
      ${renderAuditTrail(environment.auditEntries || [], "No operator activity recorded for this environment yet.")}
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
  const deployment = job.result?.deployment || null;
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
    ${renderJobDiagnostics(job)}
    ${renderJobResultSummary(job.result || {})}
    ${renderDeploymentSummary(deployment)}
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
      ${renderJobEvents(job.events || [])}
    </section>
    <section class="history-block">
      <h4>Operator Activity</h4>
      ${renderAuditTrail(job.auditEntries || [], "No operator activity recorded for this job yet.")}
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

function renderWorkspaceTabs() {
  const active = state.activeWorkspace || "tenants";
  refs.tabTenants?.classList.toggle("active", active === "tenants");
  refs.tabEnvironments?.classList.toggle("active", active === "environments");
  refs.tabJobs?.classList.toggle("active", active === "jobs");
  refs.workspaceTenants?.classList.toggle("hidden", active !== "tenants");
  refs.workspaceEnvironments?.classList.toggle("hidden", active !== "environments");
  refs.workspaceJobs?.classList.toggle("hidden", active !== "jobs");
}

function setActiveWorkspace(workspace) {
  state.activeWorkspace = workspace;
  renderWorkspaceTabs();
}

function bindRecordClicks() {
  refs.tenantList.querySelectorAll("[data-tenant-detail-id]").forEach((element) => {
    element.addEventListener("click", async () => {
      await loadTenantDetail(element.getAttribute("data-tenant-detail-id"));
    });
  });
  refs.tenantList.querySelectorAll("[data-tenant-id]").forEach((element) => {
    element.addEventListener("click", async () => {
      await selectTenant(element.getAttribute("data-tenant-id"));
    });
  });
  refs.environmentList.querySelectorAll("[data-environment-detail-id]").forEach((element) => {
    element.addEventListener("click", async () => {
      await loadEnvironmentDetail(element.getAttribute("data-environment-detail-id"));
    });
  });
  refs.jobList.querySelectorAll("[data-job-detail-id]").forEach((element) => {
    element.addEventListener("click", async () => {
      await loadJobDetail(element.getAttribute("data-job-detail-id"));
    });
  });
}

async function loadTenantDetail(tenantId, silent = false) {
  state.selectedTenantId = tenantId;
  renderLists();
  refs.tenantFormShell.classList.add("hidden");
  refs.tenantForm.classList.add("hidden");
  try {
    const [tenant, auditEntries] = await Promise.all([
      apiFetch(`/api/control/tenants/${encodeURIComponent(tenantId)}`),
      fetchAuditEntries({ tenantId, targetType: "tenant", targetId: tenantId, limit: 12 })
    ]);
    tenant.auditEntries = auditEntries;
    renderTenantDetail(tenant);
    if (!silent) setFlash("info", `Loaded customer record for ${tenant.displayName}.`);
  } catch (error) {
    setFlash("error", error.message);
  }
}

async function selectTenant(tenantId) {
  state.selectedTenantId = tenantId;
  renderLists();
  try {
    const tenant = await apiFetch(`/api/control/tenants/${encodeURIComponent(tenantId)}`);
    refs.tenantDetailShell.classList.add("hidden");
    refs.tenantDetailBody.innerHTML = "";
    fillTenantFormForEdit(tenant);
    setFlash("info", `Loaded tenant ${tenant.displayName} for editing.`);
  } catch (error) {
    setFlash("error", error.message);
  }
}

function fillTenantFormForEdit(tenant) {
  refs.tenantFormShell.classList.remove("hidden");
  refs.tenantForm.classList.remove("hidden");
  refs.tenantFormTitle.textContent = "Edit Tenant";
  refs.tenantEditId.value = tenant.id;
  refs.tenantSlug.value = tenant.slug || "";
  refs.tenantSlug.disabled = true;
  refs.tenantPrimaryDomain.disabled = true;
  refs.tenantDomainType.disabled = true;
  refs.tenantPrimaryDomain.value = tenant.primaryDomain || "";
  refs.tenantDomainType.value = tenant.primaryDomainType || "platform_subdomain";
  refs.tenantDisplayName.value = tenant.displayName || "";
  refs.tenantPlanCode.value = tenant.planCode || "standard";
  refs.tenantStatus.value = tenant.status || "draft";
  refs.tenantContactName.value = tenant.primaryContactName || "";
  refs.tenantContactEmail.value = tenant.primaryContactEmail || "";
  refs.tenantNotes.value = tenant.notes || "";
  refs.tenantSubmitBtn.textContent = "Save Tenant";
}

function resetTenantForm() {
  refs.tenantForm.reset();
  refs.tenantDetailShell.classList.add("hidden");
  refs.tenantDetailBody.innerHTML = "";
  refs.tenantFormShell.classList.add("hidden");
  refs.tenantForm.classList.add("hidden");
  refs.tenantFormTitle.textContent = "Create Tenant";
  refs.tenantEditId.value = "";
  refs.tenantSlug.disabled = false;
  refs.tenantPrimaryDomain.disabled = false;
  refs.tenantDomainType.disabled = false;
  refs.tenantDomainType.value = "platform_subdomain";
  refs.tenantPlanCode.value = "standard";
  refs.tenantStatus.value = "draft";
  refs.tenantSubmitBtn.textContent = "Create Tenant";
  state.selectedTenantId = "";
  renderLists();
}

function openCreateTenantForm() {
  resetTenantForm();
  refs.tenantFormShell.classList.remove("hidden");
  refs.tenantForm.classList.remove("hidden");
  refs.tenantFormTitle.textContent = "Create Tenant";
}

function resetEnvironmentForm() {
  refs.environmentForm.reset();
  refs.environmentFormShell.classList.add("hidden");
  refs.environmentForm.classList.add("hidden");
}

function openCreateEnvironmentForm() {
  resetEnvironmentForm();
  refs.environmentFormShell.classList.remove("hidden");
  refs.environmentForm.classList.remove("hidden");
}

function resetJobForm() {
  refs.jobForm.reset();
  document.getElementById("job-ttl-hours").value = "2";
  document.getElementById("job-delivered-via").value = "operator_console";
  refs.jobType.value = "provision_environment";
  syncJobFormMode();
  refs.jobFormShell.classList.add("hidden");
  refs.jobForm.classList.add("hidden");
}

function openCreateJobForm() {
  resetJobForm();
  refs.jobFormShell.classList.remove("hidden");
  refs.jobForm.classList.remove("hidden");
}

async function loadEnvironmentDetail(environmentId, silent = false) {
  state.selectedEnvironmentId = environmentId;
  renderLists();
  refs.environmentFormShell.classList.add("hidden");
  refs.environmentForm.classList.add("hidden");
  try {
    const environment = await apiFetch(`/api/control/environments/${encodeURIComponent(environmentId)}`);
    environment.auditEntries = await fetchAuditEntries({
      tenantId: environment.tenantId,
      targetType: "tenant_environment",
      targetId: environmentId,
      limit: 12
    });
    renderEnvironmentDetail(environment);
    if (!silent) setFlash("info", `Loaded environment ${environment.displayName}.`);
  } catch (error) {
    setFlash("error", error.message);
  }
}

async function loadJobDetail(jobId, silent = false) {
  state.selectedJobId = jobId;
  renderLists();
  refs.jobFormShell.classList.add("hidden");
  refs.jobForm.classList.add("hidden");
  try {
    const job = await apiFetch(`/api/control/jobs/${encodeURIComponent(jobId)}`);
    job.auditEntries = await fetchAuditEntries({
      tenantId: job.tenantId,
      targetType: "provisioning_job",
      targetId: jobId,
      limit: 12
    });
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
  renderWorkspaceTabs();
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
  const results = await Promise.allSettled([
    apiFetch("/api/control/tenants"),
    apiFetch("/api/control/environments"),
    apiFetch("/api/control/jobs")
  ]);

  const [tenantResult, environmentResult, jobResult] = results;
  const failures = [];

  if (tenantResult.status === "fulfilled") {
    state.tenants = Array.isArray(tenantResult.value) ? tenantResult.value : [];
  } else {
    state.tenants = [];
    failures.push(`tenant registry: ${tenantResult.reason.message}`);
  }

  if (environmentResult.status === "fulfilled") {
    state.environments = Array.isArray(environmentResult.value) ? environmentResult.value : [];
  } else {
    state.environments = [];
    failures.push(`environments: ${environmentResult.reason.message}`);
  }

  if (jobResult.status === "fulfilled") {
    state.jobs = Array.isArray(jobResult.value) ? jobResult.value : [];
  } else {
    state.jobs = [];
    failures.push(`provisioning queue: ${jobResult.reason.message}`);
  }

  renderOperator();
  renderLists();
  syncJobFormMode();
  if (state.selectedEnvironmentId) await loadEnvironmentDetail(state.selectedEnvironmentId, true);
  if (state.selectedJobId) await loadJobDetail(state.selectedJobId, true);

  if (failures.length) {
    setFlash("error", `Some data could not be loaded: ${failures.join("; ")}`);
    return;
  }

  if (showFlash) setFlash("success", "Control-plane data refreshed.");
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

  refs.tabTenants?.addEventListener("click", () => setActiveWorkspace("tenants"));
  refs.tabEnvironments?.addEventListener("click", () => setActiveWorkspace("environments"));
  refs.tabJobs?.addEventListener("click", () => setActiveWorkspace("jobs"));

  refs.tenantResetBtn?.addEventListener("click", () => {
    resetTenantForm();
    setFlash("info", "Tenant form closed.");
  });

  refs.tenantOpenCreateBtn?.addEventListener("click", () => {
    openCreateTenantForm();
    setFlash(null, "");
  });

  refs.environmentOpenCreateBtn?.addEventListener("click", () => {
    openCreateEnvironmentForm();
    setFlash(null, "");
  });

  refs.environmentResetBtn?.addEventListener("click", () => {
    resetEnvironmentForm();
    setFlash("info", "Environment form closed.");
  });

  refs.jobOpenCreateBtn?.addEventListener("click", () => {
    openCreateJobForm();
    setFlash(null, "");
  });

  refs.jobResetBtn?.addEventListener("click", () => {
    resetJobForm();
    setFlash("info", "Job form closed.");
  });

  refs.tenantDetailEditBtn?.addEventListener("click", async () => {
    if (!state.selectedTenantId) return;
    await selectTenant(state.selectedTenantId);
  });

  refs.tenantDetailCloseBtn?.addEventListener("click", () => {
    refs.tenantDetailShell.classList.add("hidden");
    refs.tenantDetailBody.innerHTML = "";
    state.selectedTenantId = "";
    renderLists();
    setFlash(null, "");
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
      resetEnvironmentForm();
      setActiveWorkspace("environments");
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
      resetJobForm();
      state.selectedJobId = job.id;
      setActiveWorkspace("jobs");
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

function renderStateTag(value, kind, label) {
  return `<span class="tag tag-${escapeHtml(kind)} tag-${escapeHtml(String(value || "unknown").toLowerCase().replace(/[^a-z0-9-]/g, "-"))}">${escapeHtml(label || value || "unknown")}</span>`;
}

function renderDetailField(label, value) {
  return `
    <div class="detail-field">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "Not recorded")}</strong>
    </div>
  `;
}

function renderDetailFieldHtml(label, value) {
  return `
    <div class="detail-field">
      <span>${escapeHtml(label)}</span>
      <strong>${value || "Not recorded"}</strong>
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

function renderAuditTrail(entries, emptyMessage) {
  if (!entries.length) {
    return `<div class="empty-state">${escapeHtml(emptyMessage)}</div>`;
  }
  return `
    <div class="timeline event-timeline">
      ${entries.map((entry) => `
        <div class="timeline-item event-item">
          <span class="timeline-dot timeline-info"></span>
          <div>
            <div class="event-head">
              <strong>${escapeHtml(formatAuditAction(entry.actionType))}</strong>
              <span class="tag">${escapeHtml(formatDateTime(entry.createdAt))}</span>
            </div>
            <p>${escapeHtml(buildAuditSummary(entry))}</p>
            ${renderEventDetails({ details: entry.details || {} })}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderJobEvents(events) {
  if (!events.length) {
    return '<div class="empty-state">No job events recorded yet.</div>';
  }
  return `
    <div class="timeline event-timeline">
      ${events.filter((event) => event.createdAt).map((event) => `
        <div class="timeline-item event-item">
          <span class="timeline-dot timeline-${escapeHtml(eventTone(event.eventType))}"></span>
          <div>
            <div class="event-head">
              <strong>${escapeHtml(formatJobEventType(event.eventType))}</strong>
              <span class="tag">${escapeHtml(formatDateTime(event.createdAt))}</span>
            </div>
            <p>${escapeHtml(event.message || "No message recorded.")}</p>
            ${renderEventDetails(event)}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function renderJobDiagnostics(job) {
  const childRetries = state.jobs.filter((item) => item.retryOfJobId === job.id);
  const parentRetry = job.retryOfJobId ? state.jobs.find((item) => item.id === job.retryOfJobId) : null;
  const entries = [
    { label: "Attempts", value: `${Number(job.attemptCount || 0)} of ${Number(job.maxAttempts || 1)}` },
    { label: "Last Attempt", value: formatDateTime(job.lastAttemptAt) || null },
    { label: "Next Retry", value: renderNextRetry(job) },
    { label: "Retry Parent", value: job.retryOfJobId || null },
    { label: "Retry Parent Type", value: parentRetry ? formatJobType(parentRetry.jobType) : null },
    { label: "Child Retries", value: childRetries.length ? String(childRetries.length) : null },
    { label: "Failure Class", value: classifyJobFailure(job) },
    { label: "Guidance", value: buildJobGuidance(job) }
  ].filter((entry) => entry.value);

  if (!entries.length) return "";
  return `
    <section class="history-block">
      <h4>Diagnostics</h4>
      <p class="panel-copy">${escapeHtml(buildJobDiagnosticSummary(job, childRetries.length))}</p>
      <div class="info-chip-grid">
        ${entries.map((entry) => renderInfoChip(entry.label, entry.value)).join("")}
      </div>
    </section>
  `;
}

function renderEventDetails(event) {
  const details = event?.details || {};
  const detailEntries = summarizeObject(details);
  const hasRaw = Object.keys(details).length > 0;
  return `
    ${detailEntries.length ? `<div class="event-meta">${detailEntries.map(({ label, value }) => renderInfoChip(label, value)).join("")}</div>` : ""}
    ${hasRaw ? `<details class="raw-details compact-details"><summary>Event Details</summary><pre>${escapeHtml(JSON.stringify(details, null, 2))}</pre></details>` : ""}
  `;
}

function renderJobResultSummary(result) {
  const entries = [
    { label: "Release", value: result.releaseVersion || null },
    { label: "Release Id", value: result.releaseId || null },
    { label: "Environment", value: formatEnvironmentStatus(result.environmentStatus) || null },
    { label: "Setup", value: formatSetupState(result.setupState) || null },
    { label: "Health", value: result.health || null },
    { label: "Schema", value: result.databaseSchema || null }
  ].filter((entry) => entry.value);

  if (!entries.length) return "";
  return `
    <section class="history-block">
      <h4>Result Summary</h4>
      <p class="panel-copy">${escapeHtml(buildJobOutcomeSummary(result))}</p>
      <div class="info-chip-grid">
        ${entries.map((entry) => renderInfoChip(entry.label, entry.value)).join("")}
      </div>
    </section>
  `;
}

function renderDeploymentSummary(deployment) {
  if (!deployment || !deployment.enabled) return "";
  return `
    <section class="history-block">
      <h4>Deployment</h4>
      <p class="panel-copy">This job can restart the tenant app on the app host and publish the hosted web assets on the web host.</p>
      <div class="deployment-grid">
        ${renderDeploymentCard("App Deploy", deployment.app)}
        ${renderDeploymentCard("Web Deploy", deployment.web)}
      </div>
    </section>
  `;
}

function renderDeploymentCard(title, step) {
  if (!step) {
    return `
      <article class="deploy-card">
        <h5>${escapeHtml(title)}</h5>
        <p class="panel-copy">No deployment step recorded.</p>
      </article>
    `;
  }
  const status = step.attempted ? "attempted" : (step.skipped ? "skipped" : "pending");
  const chips = [
    { label: "Method", value: formatDeployMethod(step.method) || null },
    { label: "Host", value: formatHostLabel(step.host) || null },
    { label: "Resolved Host", value: step.resolvedHost || null },
    { label: "Target Path", value: step.deployDir || null },
    { label: "Service", value: step.serviceName || null },
    { label: "Health Check", value: step.healthCheckUrl || null },
    { label: "SSH Target", value: step.sshTarget || null },
    { label: "Runtime Env File", value: step.runtimeEnvPath || null },
    { label: "Source Copy", value: step.sourceCopySkipped ? "Skipped because app files were already on the app host" : null },
    { label: "Reason", value: formatStepReason(step.reason) || null }
  ].filter((entry) => entry.value);
  return `
    <article class="deploy-card">
      <div class="deploy-head">
        <h5>${escapeHtml(title)}</h5>
        ${renderStatusTag(status, "job")}
      </div>
      <p class="panel-copy">${escapeHtml(buildDeploySummary(title, step, status))}</p>
      <div class="info-chip-grid">
        ${chips.map((entry) => renderInfoChip(entry.label, entry.value)).join("")}
      </div>
    </article>
  `;
}

function renderInfoChip(label, value) {
  return `
    <div class="info-chip">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "Not recorded")}</strong>
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
  if (["succeeded", "completed", "release_registered", "app_deploy_completed", "web_deploy_completed"].includes(normalized)) return "success";
  if (["failed", "error"].includes(normalized)) return "danger";
  if (["running", "database_prepared", "runtime_allocated", "token_issued"].includes(normalized)) return "warn";
  return "info";
}

function buildJobOutcomeSummary(result) {
  const env = formatEnvironmentStatus(result.environmentStatus) || "Unknown";
  const setup = formatSetupState(result.setupState) || "Unknown";
  const health = result.health || "unknown";
  return `Environment is ${env.toLowerCase()}, setup is ${setup.toLowerCase()}, and runtime health is ${String(health).toLowerCase()}.`;
}

function buildDeploySummary(title, step, status) {
  if (status === "attempted") {
    const host = formatHostLabel(step.host) || "the target host";
    if (title === "App Deploy") {
      return `The tenant app was updated on ${host} and checked through its local health endpoint.`;
    }
    return `The hosted web assets were published on ${host} and checked through the web server health endpoint.`;
  }
  if (status === "skipped") {
    return formatStepReason(step.reason) || "This deployment step was skipped.";
  }
  return "This deployment step has not run yet.";
}

function formatHostLabel(value) {
  const normalized = String(value || "").trim().toUpperCase();
  if (normalized === "APP001") return "APP001 (app host)";
  if (normalized === "WEB001") return "WEB001 (web host)";
  if (normalized === "DB001" || normalized === "SQL001") return `${normalized} (database host)`;
  return value || "";
}

function formatDeployMethod(value) {
  if (value === "local") return "Local on app host";
  if (value === "ssh") return "Remote over SSH";
  return value || "";
}

function formatStepReason(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "deployment_disabled") return "Deployment automation is disabled for this worker.";
  if (normalized === "app_host_not_configured") return "No app host is configured for this environment.";
  if (normalized === "web_host_not_configured") return "No web host is configured for this environment.";
  return value || "";
}

function formatSetupState(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "token_issued") return "Setup Token Issued";
  if (normalized === "initialized") return "Initialized";
  if (normalized === "uninitialized") return "Not Initialized";
  return startCase(value);
}

function formatEnvironmentStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "ready") return "Ready";
  if (normalized === "provisioning") return "Provisioning";
  if (normalized === "pending") return "Pending";
  if (normalized === "degraded") return "Degraded";
  return startCase(value);
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

function formatAuditAction(value) {
  return formatJobType(value);
}

function buildAuditSummary(entry) {
  const actor = entry.operatorUsername ? `${entry.operatorUsername}${entry.operatorRole ? ` (${entry.operatorRole})` : ""}` : "System";
  const target = [entry.targetType, entry.targetId].filter(Boolean).join(" ");
  return `${actor} recorded ${formatAuditAction(entry.actionType)}${target ? ` on ${target}.` : "."}`;
}

function buildJobDiagnosticSummary(job, childRetryCount) {
  const parts = [`This ${formatJobType(job.jobType).toLowerCase()} job is currently ${String(job.status || "unknown").toLowerCase()}.`];
  if (job.errorMessage || job.errorCode) {
    parts.push(`Latest failure: ${job.errorMessage || job.errorCode}.`);
  }
  if (childRetryCount) {
    parts.push(`${childRetryCount} follow-up retry job${childRetryCount === 1 ? "" : "s"} were created from this job.`);
  } else if (job.retryOfJobId) {
    parts.push("This job was created as a retry of an earlier failed or canceled job.");
  }
  return parts.join(" ");
}

function renderNextRetry(job) {
  const normalizedStatus = String(job.status || "").toLowerCase();
  if (normalizedStatus !== "queued") return null;
  const nextAttempt = formatDateTime(job.nextAttemptAt);
  const requested = formatDateTime(job.requestedAt);
  if (!nextAttempt || nextAttempt === requested) return null;
  return nextAttempt;
}

function classifyJobFailure(job) {
  if (!job.errorCode && !job.errorMessage && String(job.status || "").toLowerCase() !== "failed") return null;
  const message = String(job.errorMessage || "").toLowerCase();
  const code = String(job.errorCode || "").toLowerCase();
  if (message.includes("timeout") || message.includes("no route to host") || message.includes("connection") || ["etimedout", "econnrefused", "econnreset", "enotfound"].includes(code)) {
    return "Connectivity / infrastructure";
  }
  if (code.includes("auth") || message.includes("unauthorized") || message.includes("forbidden")) {
    return "Authentication / authorization";
  }
  if (message.includes("not found")) {
    return "Missing dependency";
  }
  return "Execution failure";
}

function buildJobGuidance(job) {
  const normalizedStatus = String(job.status || "").toLowerCase();
  if (normalizedStatus === "failed") {
    if ((job.attemptCount || 0) < (job.maxAttempts || 1)) {
      return "Review the failure and retry if the dependency issue has been corrected.";
    }
    return "Retry budget is exhausted. Create a follow-up retry job after correcting the underlying issue.";
  }
  if (normalizedStatus === "queued" && renderNextRetry(job)) {
    return "This job is waiting for its scheduled retry window.";
  }
  if (normalizedStatus === "running") {
    return "Watch the event stream and deployment results for the next completed step.";
  }
  return null;
}

async function fetchAuditEntries(filters = {}) {
  const params = new URLSearchParams();
  if (filters.tenantId) params.set("tenantId", filters.tenantId);
  if (filters.targetType) params.set("targetType", filters.targetType);
  if (filters.targetId) params.set("targetId", filters.targetId);
  if (filters.limit) params.set("limit", String(filters.limit));
  const query = params.toString();
  return apiFetch(`/api/control/audit${query ? `?${query}` : ""}`);
}

function resolveEnvironmentName(environmentId) {
  const environment = state.environments.find((item) => item.id === environmentId);
  return environment?.displayName || "";
}

function resolveJobTenantName(job) {
  const tenant = state.tenants.find((item) => item.id === job.tenantId);
  if (tenant?.displayName) return tenant.displayName;
  const environment = state.environments.find((item) => item.id === job.tenantEnvironmentId);
  return environment?.tenantDisplayName || job.tenantId || "Unknown tenant";
}

function resolveJobTenantSlug(job) {
  const tenant = state.tenants.find((item) => item.id === job.tenantId);
  if (tenant?.slug) return tenant.slug;
  const environment = state.environments.find((item) => item.id === job.tenantEnvironmentId);
  return environment?.tenantSlug || "";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function summarizeObject(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return [];
  return Object.entries(input)
    .filter(([, value]) => value != null && value !== "" && typeof value !== "object")
    .slice(0, 6)
    .map(([key, value]) => ({
      label: startCase(key),
      value: String(value)
    }));
}

function startCase(value) {
  return String(value || "")
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

bootstrap();
