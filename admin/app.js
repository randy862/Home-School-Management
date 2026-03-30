const DEFAULT_API_BASE = document.body?.dataset?.apiBase || "/control-api";
const state = {
  apiBase: DEFAULT_API_BASE,
  setupInitialized: null,
  operator: null,
  users: [],
  tenants: [],
  environments: [],
  jobs: [],
  activeWorkspace: "tenants",
  selectedTenantId: "",
  selectedEnvironmentId: "",
  selectedJobId: "",
  selectedUserId: ""
};

const refs = {
  bootstrapCard: document.getElementById("bootstrap-card"),
  loginCard: document.getElementById("login-card"),
  flash: document.getElementById("flash-message"),
  consoleSection: document.getElementById("console-section"),
  operatorName: document.getElementById("operator-name"),
  operatorSessionBadge: document.getElementById("operator-session-badge"),
  operatorMeta: document.getElementById("operator-meta"),
  tabTenants: document.getElementById("tab-tenants"),
  tabEnvironments: document.getElementById("tab-environments"),
  tabJobs: document.getElementById("tab-jobs"),
  tabUsers: document.getElementById("tab-users"),
  workspaceTenants: document.getElementById("workspace-tenants"),
  workspaceEnvironments: document.getElementById("workspace-environments"),
  workspaceJobs: document.getElementById("workspace-jobs"),
  workspaceUsers: document.getElementById("workspace-users"),
  customerCount: document.getElementById("customer-count"),
  customerSummary: document.getElementById("customer-summary"),
  activeCustomerCount: document.getElementById("active-customer-count"),
  activeCustomerSummary: document.getElementById("active-customer-summary"),
  setupNeededCount: document.getElementById("setup-needed-count"),
  setupNeededSummary: document.getElementById("setup-needed-summary"),
  attentionCount: document.getElementById("attention-count"),
  attentionSummary: document.getElementById("attention-summary"),
  tenantList: document.getElementById("tenant-list"),
  tenantPanelHead: document.getElementById("tenant-panel-head"),
  tenantDetailShell: document.getElementById("tenant-detail-shell"),
  tenantDetailBody: document.getElementById("tenant-detail-body"),
  environmentPanelHead: document.getElementById("environment-panel-head"),
  environmentList: document.getElementById("environment-list"),
  jobPanelHead: document.getElementById("job-panel-head"),
  jobList: document.getElementById("job-list"),
  userPanelHead: document.getElementById("user-panel-head"),
  userList: document.getElementById("user-list"),
  environmentFormShell: document.getElementById("environment-form-shell"),
  environmentDetail: document.getElementById("environment-detail"),
  jobFormShell: document.getElementById("job-form-shell"),
  jobDetail: document.getElementById("job-detail"),
  userDetailShell: document.getElementById("user-detail-shell"),
  userDetailBody: document.getElementById("user-detail-body"),
  userFormShell: document.getElementById("user-form-shell"),
  tenantFormShell: document.getElementById("tenant-form-shell"),
  tenantFormTitle: document.getElementById("tenant-form-title"),
  tenantForm: document.getElementById("tenant-form"),
  environmentForm: document.getElementById("environment-form"),
  jobForm: document.getElementById("job-form"),
  userFormTitle: document.getElementById("user-form-title"),
  userForm: document.getElementById("user-form"),
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
  userEditId: document.getElementById("user-edit-id"),
  userUsername: document.getElementById("user-username"),
  userFirstName: document.getElementById("user-first-name"),
  userLastName: document.getElementById("user-last-name"),
  userPassword: document.getElementById("user-password"),
  userIsActive: document.getElementById("user-is-active"),
  userPermissionCustomers: document.getElementById("user-permission-customers"),
  userPermissionEnvironments: document.getElementById("user-permission-environments"),
  userPermissionOperations: document.getElementById("user-permission-operations"),
  userPermissionUsers: document.getElementById("user-permission-users"),
  tenantSubmitBtn: document.getElementById("tenant-submit-btn"),
  tenantResetBtn: document.getElementById("tenant-reset-btn"),
  tenantOpenCreateBtn: document.getElementById("tenant-open-create-btn"),
  tenantDetailEditBtn: document.getElementById("tenant-detail-edit-btn"),
  tenantDetailCloseBtn: document.getElementById("tenant-detail-close-btn"),
  environmentOpenCreateBtn: document.getElementById("environment-open-create-btn"),
  environmentResetBtn: document.getElementById("environment-reset-btn"),
  jobOpenCreateBtn: document.getElementById("job-open-create-btn"),
  jobResetBtn: document.getElementById("job-reset-btn"),
  userSubmitBtn: document.getElementById("user-submit-btn"),
  userResetBtn: document.getElementById("user-reset-btn"),
  userOpenCreateBtn: document.getElementById("user-open-create-btn"),
  userDetailEditBtn: document.getElementById("user-detail-edit-btn"),
  userDetailCloseBtn: document.getElementById("user-detail-close-btn")
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
  if (!message || (kind && kind !== "error")) {
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

function operatorPermissions() {
  return state.operator?.permissions || {};
}

function canManage(permission) {
  if (!state.operator) return false;
  if (state.operator.role === "platform_admin") return true;
  return !!operatorPermissions()[permission];
}

function renderAuthState() {
  const initialized = state.setupInitialized;
  const operator = state.operator;

  refs.bootstrapCard.classList.toggle("hidden", initialized !== false || !!operator);
  refs.loginCard.classList.toggle("hidden", initialized !== true || !!operator);
  refs.consoleSection.classList.toggle("hidden", !operator);

  if (!operator && initialized === false) {
    setSessionState("Bootstrap Required", "No operators yet");
  } else if (!operator && initialized === true) {
    setSessionState("Login Required", "Sign in required");
  } else if (operator) {
    setSessionState("Authenticated", `${operator.username} signed in`);
  } else {
    setSessionState("Checking", "Checking session");
  }
}

function renderOperator() {
  if (!state.operator) return;
  refs.operatorName.textContent = state.operator.username;
  refs.operatorMeta.textContent = `${state.operator.accountType || state.operator.role} | ${state.operator.isActive ? "active" : "inactive"}`;
  refs.operatorSessionBadge.textContent = state.operator.isActive ? "Signed In" : "Inactive";
  refs.tenantForm.classList.toggle("hidden", !canManage("manageCustomers"));
  refs.environmentForm.classList.toggle("hidden", !canManage("manageEnvironments"));
  refs.jobForm.classList.toggle("hidden", !canManage("manageOperations"));
  refs.userForm.classList.toggle("hidden", !canManage("manageUsers"));
  refs.userOpenCreateBtn?.classList.toggle("hidden", !canManage("manageUsers"));
  refs.tenantOpenCreateBtn?.classList.toggle("hidden", !canManage("manageCustomers"));
  refs.environmentOpenCreateBtn?.classList.toggle("hidden", !canManage("manageEnvironments"));
  refs.jobOpenCreateBtn?.classList.toggle("hidden", !canManage("manageOperations"));
  renderWorkspaceTabs();
}

function renderLists() {
  const activeTenants = state.tenants.filter((tenant) => tenant.status === "active").length;
  const draftTenants = state.tenants.filter((tenant) => tenant.status !== "active").length;
  const setupNeeded = state.environments.filter((environment) => !["token_issued", "initialized"].includes(String(environment.setupState || "").toLowerCase())).length;
  const failedJobs = state.jobs.filter((job) => String(job.status || "").toLowerCase() === "failed").length;
  const inFlightJobs = state.jobs.filter((job) => ["queued", "running"].includes(String(job.status || "").toLowerCase())).length;

  refs.customerCount.textContent = String(state.tenants.length);
  refs.customerSummary.textContent = `${activeTenants} live, ${draftTenants} still in draft or inactive states.`;
  refs.activeCustomerCount.textContent = String(activeTenants);
  refs.activeCustomerSummary.textContent = `${Math.max(state.tenants.length - activeTenants, 0)} customer records still need activation or follow-up.`;
  refs.setupNeededCount.textContent = String(setupNeeded);
  refs.setupNeededSummary.textContent = setupNeeded ? `${setupNeeded} environment${setupNeeded === 1 ? "" : "s"} still need onboarding completion.` : "All recorded environments have setup issued or completed.";
  refs.attentionCount.textContent = String(failedJobs + inFlightJobs);
  refs.attentionSummary.textContent = failedJobs
    ? `${failedJobs} operation${failedJobs === 1 ? "" : "s"} need review, with ${inFlightJobs} still in progress.`
    : (inFlightJobs ? `${inFlightJobs} operation${inFlightJobs === 1 ? "" : "s"} currently in progress.` : "No failed or in-progress work needs attention.");

  refs.tenantList.innerHTML = renderTenantTable(state.tenants);
  refs.environmentList.innerHTML = renderEnvironmentTable(state.environments);
  refs.jobList.innerHTML = renderJobTable(state.jobs);
  refs.userList.innerHTML = renderUserTable(state.users);

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
  if (!tenants.length) return '<div class="empty-state">No customer records yet.</div>';
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
                <button type="button" class="text-link-btn tenant-detail-link" data-tenant-detail-id="${escapeHtml(tenant.id)}">${escapeHtml(formatCustomerDisplayName(tenant.displayName))}</button>
              </td>
              <td>${escapeHtml(tenant.primaryContactName || "Not recorded")}</td>
              <td>${escapeHtml(tenant.primaryContactEmail || "Not recorded")}</td>
              <td>${tenant.primaryDomain ? `<a href="http://${escapeHtml(tenant.primaryDomain)}" target="_blank" rel="noreferrer">${escapeHtml(tenant.primaryDomain)}</a>` : "Not recorded"}</td>
              <td>${renderStatusTag(tenant.status, "tenant")}</td>
              <td>${escapeHtml(tenant.planCode || "standard")}</td>
              <td>
                <div class="table-actions">
                  <button type="button" class="secondary-btn table-action-btn" data-tenant-detail-id="${escapeHtml(tenant.id)}">Details</button>
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
  syncTenantWorkspaceFocus();
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
  if (!environments.length) return '<div class="empty-state">No customer environments yet.</div>';
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
                <button type="button" class="text-link-btn" data-environment-detail-id="${escapeHtml(environment.id)}">${escapeHtml(formatCustomerDisplayName(environment.tenantDisplayName || environment.tenantId || "Unknown tenant"))}</button>
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
  if (!jobs.length) return '<div class="empty-state">No operations have been queued yet.</div>';
  return `
    <div class="table-shell">
      <table class="data-table">
        <thead>
          <tr>
            <th>Tenant</th>
            <th>Operation</th>
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
                <button type="button" class="text-link-btn" data-job-detail-id="${escapeHtml(job.id)}">${escapeHtml(formatCustomerDisplayName(resolveJobTenantName(job)))}</button>
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

function renderUserTable(users) {
  if (!users.length) return '<div class="empty-state">No operator accounts recorded yet.</div>';
  return `
    <div class="table-shell">
      <table class="data-table">
        <thead>
          <tr>
            <th>Username</th>
            <th>First Name</th>
            <th>Last Name</th>
            <th>Account Type</th>
            <th>Status</th>
            <th>Last Login</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${users.map((user) => `
            <tr class="${user.id === state.selectedUserId ? "selected-row" : ""}">
              <td>
                <button type="button" class="text-link-btn" data-user-detail-id="${escapeHtml(user.id)}">${escapeHtml(user.username)}</button>
              </td>
              <td>${escapeHtml(user.firstName || "Not recorded")}</td>
              <td>${escapeHtml(user.lastName || "Not recorded")}</td>
              <td>${escapeHtml(user.accountType || "Read Only")}</td>
              <td>${renderStatusTag(user.isActive ? "active" : "inactive", "tenant")}</td>
              <td>${escapeHtml(formatDateTime(user.lastLoginAt) || "Never")}</td>
              <td>
                <div class="table-actions">
                  <button type="button" class="secondary-btn table-action-btn" data-user-detail-id="${escapeHtml(user.id)}">Details</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderUserDetail(user) {
  refs.userDetailShell.classList.remove("hidden");
  syncUserWorkspaceFocus();
  refs.userDetailBody.innerHTML = `
    <div class="compact-details">
      ${renderDetailField("Username", user.username || "Not recorded")}
      ${renderDetailField("First Name", user.firstName || "Not recorded")}
      ${renderDetailField("Last Name", user.lastName || "Not recorded")}
      ${renderDetailField("Account Type", user.accountType || "Read Only")}
      ${renderDetailField("Status", user.isActive ? "Active" : "Inactive")}
      ${renderDetailField("Last Login", formatDateTime(user.lastLoginAt) || "Never")}
      ${renderDetailField("Created", formatDateTime(user.createdAt))}
      ${renderDetailField("Updated", formatDateTime(user.updatedAt))}
      ${renderDetailField("Manage Customers", user.permissions?.manageCustomers ? "Yes" : "No")}
      ${renderDetailField("Manage Environments", user.permissions?.manageEnvironments ? "Yes" : "No")}
      ${renderDetailField("Manage Operations", user.permissions?.manageOperations ? "Yes" : "No")}
      ${renderDetailField("Manage Users", user.permissions?.manageUsers ? "Yes" : "No")}
    </div>
  `;
  refs.userDetailEditBtn?.classList.toggle("hidden", !canManage("manageUsers"));
}

function renderEnvironmentDetail(environment) {
  if (!environment) {
    refs.environmentDetail.classList.add("hidden");
    refs.environmentDetail.innerHTML = "";
    syncEnvironmentWorkspaceFocus();
    return;
  }
  refs.environmentDetail.classList.remove("hidden");
  syncEnvironmentWorkspaceFocus();
  const relatedJobs = state.jobs
    .filter((job) => job.tenantEnvironmentId === environment.id)
    .sort((left, right) => compareDatesDesc(left.requestedAt, right.requestedAt));
  refs.environmentDetail.innerHTML = `
    <div class="detail-toolbar">
      <div>
        <strong>Environment Overview</strong>
        <p class="detail-copy">${escapeHtml(environment.tenantDisplayName || environment.tenantId || "Unknown tenant")} / ${escapeHtml(environment.environmentKey || "environment")}</p>
      </div>
      <div class="operator-actions">
        <button id="environment-detail-refresh" type="button" class="secondary-btn">Refresh Detail</button>
        <button id="environment-detail-close" type="button" class="secondary-btn">Close</button>
      </div>
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
  document.getElementById("environment-detail-close")?.addEventListener("click", () => {
    state.selectedEnvironmentId = "";
    renderEnvironmentDetail(null);
    renderLists();
    setFlash(null, "");
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
    syncJobWorkspaceFocus();
    return;
  }
  refs.jobDetail.classList.remove("hidden");
  syncJobWorkspaceFocus();
  const deployment = job.result?.deployment || null;
  refs.jobDetail.innerHTML = `
    <div class="detail-toolbar">
      <div>
        <strong>Operation Detail</strong>
        <p class="detail-copy">${escapeHtml(formatJobType(job.jobType))}</p>
      </div>
      <div class="operator-actions">
        <button id="job-detail-refresh" type="button" class="secondary-btn">Refresh Detail</button>
        <button id="job-detail-close" type="button" class="secondary-btn">Close</button>
      </div>
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
        { label: "Operation requested", when: job.requestedAt, tone: "info" },
        { label: "Operation started", when: job.startedAt, tone: "warn" },
        { label: "Operation completed", when: job.completedAt, tone: "success" },
        { label: `Operation status is ${job.status || "unknown"}`, when: job.completedAt || job.startedAt || job.requestedAt, tone: ["completed", "succeeded"].includes(job.status) ? "success" : "info" }
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
  document.getElementById("job-detail-close")?.addEventListener("click", () => {
    state.selectedJobId = "";
    renderJobDetail(null);
    renderLists();
    setFlash(null, "");
  });
}

function renderWorkspaceTabs() {
  const active = state.activeWorkspace || "tenants";
  refs.tabTenants?.classList.toggle("active", active === "tenants");
  refs.tabEnvironments?.classList.toggle("active", active === "environments");
  refs.tabJobs?.classList.toggle("active", active === "jobs");
  refs.tabUsers?.classList.toggle("active", active === "users");
  refs.workspaceTenants?.classList.toggle("hidden", active !== "tenants");
  refs.workspaceEnvironments?.classList.toggle("hidden", active !== "environments");
  refs.workspaceJobs?.classList.toggle("hidden", active !== "jobs");
  refs.workspaceUsers?.classList.toggle("hidden", active !== "users");
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
  refs.userList.querySelectorAll("[data-user-detail-id]").forEach((element) => {
    element.addEventListener("click", async () => {
      await loadUserDetail(element.getAttribute("data-user-detail-id"));
    });
  });
}

async function loadTenantDetail(tenantId, silent = false) {
  state.selectedTenantId = tenantId;
  renderLists();
  refs.tenantFormShell.classList.add("hidden");
  refs.tenantForm.classList.add("hidden");
  syncTenantWorkspaceFocus();
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
    setFlash("info", `Loaded customer ${tenant.displayName} for editing.`);
  } catch (error) {
    setFlash("error", error.message);
  }
}

function fillTenantFormForEdit(tenant) {
  refs.tenantFormShell.classList.remove("hidden");
  refs.tenantForm.classList.remove("hidden");
  syncTenantWorkspaceFocus();
  refs.tenantFormTitle.textContent = "Edit Customer";
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
  refs.tenantSubmitBtn.textContent = "Save Customer";
}

function resetTenantForm() {
  refs.tenantForm.reset();
  refs.tenantDetailShell.classList.add("hidden");
  refs.tenantDetailBody.innerHTML = "";
  refs.tenantFormShell.classList.add("hidden");
  refs.tenantForm.classList.add("hidden");
  refs.tenantFormTitle.textContent = "Create Customer";
  refs.tenantEditId.value = "";
  refs.tenantSlug.disabled = false;
  refs.tenantPrimaryDomain.disabled = false;
  refs.tenantDomainType.disabled = false;
  refs.tenantDomainType.value = "platform_subdomain";
  refs.tenantPlanCode.value = "standard";
  refs.tenantStatus.value = "draft";
  refs.tenantSubmitBtn.textContent = "Create Customer";
  state.selectedTenantId = "";
  syncTenantWorkspaceFocus();
  renderLists();
}

function openCreateTenantForm() {
  resetTenantForm();
  refs.tenantFormShell.classList.remove("hidden");
  refs.tenantForm.classList.remove("hidden");
  refs.tenantFormTitle.textContent = "Create Customer";
  syncTenantWorkspaceFocus();
}

function syncTenantWorkspaceFocus() {
  const detailOpen = !refs.tenantDetailShell.classList.contains("hidden");
  const formOpen = !refs.tenantFormShell.classList.contains("hidden");
  refs.tenantPanelHead.classList.toggle("hidden", detailOpen || formOpen);
  refs.tenantList.classList.toggle("hidden", detailOpen || formOpen);
}

function syncEnvironmentWorkspaceFocus() {
  const detailOpen = !refs.environmentDetail.classList.contains("hidden");
  const formOpen = !refs.environmentFormShell.classList.contains("hidden");
  refs.environmentPanelHead.classList.toggle("hidden", detailOpen || formOpen);
  refs.environmentList.classList.toggle("hidden", detailOpen || formOpen);
}

function syncJobWorkspaceFocus() {
  const detailOpen = !refs.jobDetail.classList.contains("hidden");
  const formOpen = !refs.jobFormShell.classList.contains("hidden");
  refs.jobPanelHead.classList.toggle("hidden", detailOpen || formOpen);
  refs.jobList.classList.toggle("hidden", detailOpen || formOpen);
}

function syncUserWorkspaceFocus() {
  const detailOpen = !refs.userDetailShell.classList.contains("hidden");
  const formOpen = !refs.userFormShell.classList.contains("hidden");
  refs.userPanelHead.classList.toggle("hidden", detailOpen || formOpen);
  refs.userList.classList.toggle("hidden", detailOpen || formOpen);
}

function resetEnvironmentForm() {
  refs.environmentForm.reset();
  refs.environmentFormShell.classList.add("hidden");
  refs.environmentForm.classList.add("hidden");
  refs.environmentDetail.classList.add("hidden");
  refs.environmentDetail.innerHTML = "";
  state.selectedEnvironmentId = "";
  syncEnvironmentWorkspaceFocus();
}

function openCreateEnvironmentForm() {
  resetEnvironmentForm();
  refs.environmentFormShell.classList.remove("hidden");
  refs.environmentForm.classList.remove("hidden");
  syncEnvironmentWorkspaceFocus();
}

function resetJobForm() {
  refs.jobForm.reset();
  document.getElementById("job-ttl-hours").value = "2";
  document.getElementById("job-delivered-via").value = "operator_console";
  refs.jobType.value = "provision_environment";
  syncJobFormMode();
  refs.jobFormShell.classList.add("hidden");
  refs.jobForm.classList.add("hidden");
  refs.jobDetail.classList.add("hidden");
  refs.jobDetail.innerHTML = "";
  state.selectedJobId = "";
  syncJobWorkspaceFocus();
}

function openCreateJobForm() {
  resetJobForm();
  refs.jobFormShell.classList.remove("hidden");
  refs.jobForm.classList.remove("hidden");
  syncJobWorkspaceFocus();
}

function fillUserFormForEdit(user) {
  refs.userFormShell.classList.remove("hidden");
  refs.userForm.classList.remove("hidden");
  refs.userDetailShell.classList.add("hidden");
  refs.userDetailBody.innerHTML = "";
  refs.userFormTitle.textContent = "Edit User";
  refs.userEditId.value = user.id;
  refs.userUsername.value = user.username || "";
  refs.userFirstName.value = user.firstName || "";
  refs.userLastName.value = user.lastName || "";
  refs.userPassword.value = "";
  refs.userPassword.placeholder = "Leave blank to keep current password";
  refs.userIsActive.checked = user.isActive !== false;
  refs.userPermissionCustomers.checked = !!user.permissions?.manageCustomers;
  refs.userPermissionEnvironments.checked = !!user.permissions?.manageEnvironments;
  refs.userPermissionOperations.checked = !!user.permissions?.manageOperations;
  refs.userPermissionUsers.checked = !!user.permissions?.manageUsers;
  refs.userSubmitBtn.textContent = "Save User";
  syncUserWorkspaceFocus();
}

function resetUserForm() {
  refs.userForm.reset();
  refs.userDetailShell.classList.add("hidden");
  refs.userDetailBody.innerHTML = "";
  refs.userFormShell.classList.add("hidden");
  refs.userForm.classList.add("hidden");
  refs.userFormTitle.textContent = "New User";
  refs.userEditId.value = "";
  refs.userPassword.placeholder = "";
  refs.userIsActive.checked = true;
  refs.userSubmitBtn.textContent = "Create User";
  state.selectedUserId = "";
  syncUserWorkspaceFocus();
  renderLists();
}

function openCreateUserForm() {
  resetUserForm();
  refs.userFormShell.classList.remove("hidden");
  refs.userForm.classList.remove("hidden");
  refs.userFormTitle.textContent = "New User";
  syncUserWorkspaceFocus();
}

async function loadUserDetail(userId, silent = false) {
  state.selectedUserId = userId;
  renderLists();
  refs.userFormShell.classList.add("hidden");
  refs.userForm.classList.add("hidden");
  syncUserWorkspaceFocus();
  try {
    const user = await apiFetch(`/api/control/operators/${encodeURIComponent(userId)}`);
    renderUserDetail(user);
    if (!silent) setFlash("info", `Loaded user ${user.username}.`);
  } catch (error) {
    setFlash("error", error.message);
  }
}

async function loadEnvironmentDetail(environmentId, silent = false) {
  state.selectedEnvironmentId = environmentId;
  renderLists();
  refs.environmentFormShell.classList.add("hidden");
  refs.environmentForm.classList.add("hidden");
  syncEnvironmentWorkspaceFocus();
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
  syncJobWorkspaceFocus();
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
  resetUserForm();
  renderWorkspaceTabs();
  await refreshSession();
}

async function refreshSession() {
  setFlash(null, "");
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
      setFlash(null, "");
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
    apiFetch("/api/control/operators"),
    apiFetch("/api/control/tenants"),
    apiFetch("/api/control/environments"),
    apiFetch("/api/control/jobs")
  ]);

  const [userResult, tenantResult, environmentResult, jobResult] = results;
  const failures = [];

  if (userResult.status === "fulfilled") {
    state.users = Array.isArray(userResult.value) ? userResult.value : [];
  } else {
    state.users = [];
    failures.push(`users: ${userResult.reason.message}`);
  }

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
  if (state.selectedUserId) await loadUserDetail(state.selectedUserId, true);

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
      state.users = [];
      state.tenants = [];
      state.environments = [];
      state.jobs = [];
      state.selectedTenantId = "";
      state.selectedEnvironmentId = "";
      state.selectedJobId = "";
      state.selectedUserId = "";
      renderEnvironmentDetail(null);
      renderJobDetail(null);
      resetTenantForm();
      resetUserForm();
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
  refs.tabUsers?.addEventListener("click", () => setActiveWorkspace("users"));

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

  refs.userOpenCreateBtn?.addEventListener("click", () => {
    openCreateUserForm();
    setFlash(null, "");
  });

  refs.userResetBtn?.addEventListener("click", () => {
    resetUserForm();
    setFlash(null, "");
  });

  refs.tenantDetailEditBtn?.addEventListener("click", async () => {
    if (!state.selectedTenantId) return;
    await selectTenant(state.selectedTenantId);
  });

  refs.tenantDetailCloseBtn?.addEventListener("click", () => {
    refs.tenantDetailShell.classList.add("hidden");
    refs.tenantDetailBody.innerHTML = "";
    state.selectedTenantId = "";
    syncTenantWorkspaceFocus();
    renderLists();
    setFlash(null, "");
  });

  refs.userDetailEditBtn?.addEventListener("click", async () => {
    if (!state.selectedUserId) return;
    const user = await apiFetch(`/api/control/operators/${encodeURIComponent(state.selectedUserId)}`);
    fillUserFormForEdit(user);
  });

  refs.userDetailCloseBtn?.addEventListener("click", () => {
    refs.userDetailShell.classList.add("hidden");
    refs.userDetailBody.innerHTML = "";
    state.selectedUserId = "";
    syncUserWorkspaceFocus();
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
    setFlash("info", jobType === "issue_setup_token" ? "Queueing setup-token issuance..." : "Queueing environment operation...");
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
      setFlash("success", "Operation queued.");
    } catch (error) {
      setFlash("error", error.message);
    }
  });

  refs.userForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const editId = refs.userEditId.value.trim();
    const creating = !editId;
    try {
      const body = {
        username: refs.userUsername.value.trim(),
        firstName: refs.userFirstName.value.trim(),
        lastName: refs.userLastName.value.trim(),
        password: refs.userPassword.value,
        isActive: refs.userIsActive.checked,
        permissions: collectUserPermissions()
      };
      if (creating) {
        await apiFetch("/api/control/operators", { method: "POST", body: JSON.stringify(body) });
      } else {
        await apiFetch(`/api/control/operators/${encodeURIComponent(editId)}`, { method: "PATCH", body: JSON.stringify(body) });
      }
      resetUserForm();
      setActiveWorkspace("users");
      await refreshData(false);
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

function collectUserPermissions() {
  return {
    manageCustomers: !!refs.userPermissionCustomers?.checked,
    manageEnvironments: !!refs.userPermissionEnvironments?.checked,
    manageOperations: !!refs.userPermissionOperations?.checked,
    manageUsers: !!refs.userPermissionUsers?.checked
  };
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
      <h4>Operational Diagnostics</h4>
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
      <h4>Outcome Summary</h4>
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

function formatCustomerDisplayName(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.replace(/[\s_-]+(\d{8,14})$/, "").trim();
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
