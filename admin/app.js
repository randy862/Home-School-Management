const DEFAULT_API_BASE = document.body?.dataset?.apiBase || "/control-api";
const state = {
  apiBase: DEFAULT_API_BASE,
  setupInitialized: null,
  operator: null,
  users: [],
  tenants: [],
  commercialRecords: [],
  environments: [],
  jobs: [],
  activeWorkspace: "tenants",
  selectedTenantId: "",
  selectedCommercialSubscriptionId: "",
  selectedEnvironmentId: "",
  selectedJobId: "",
  selectedUserId: ""
};

const refs = {
  bootstrapCard: document.getElementById("bootstrap-card"),
  loginCard: document.getElementById("login-card"),
  flash: document.getElementById("flash-message"),
  consoleSection: document.getElementById("console-section"),
  accountPanel: document.getElementById("account-panel"),
  accountSummary: document.getElementById("account-summary"),
  operatorName: document.getElementById("operator-name"),
  operatorSessionBadge: document.getElementById("operator-session-badge"),
  operatorMeta: document.getElementById("operator-meta"),
  tabTenants: document.getElementById("tab-tenants"),
  tabCommercial: document.getElementById("tab-commercial"),
  tabEnvironments: document.getElementById("tab-environments"),
  tabJobs: document.getElementById("tab-jobs"),
  tabUsers: document.getElementById("tab-users"),
  workspaceTenants: document.getElementById("workspace-tenants"),
  workspaceCommercial: document.getElementById("workspace-commercial"),
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
  tenantSummary: document.getElementById("tenant-summary"),
  tenantDetailShell: document.getElementById("tenant-detail-shell"),
  tenantDetailBody: document.getElementById("tenant-detail-body"),
  commercialPanelHead: document.getElementById("commercial-panel-head"),
  commercialSummary: document.getElementById("commercial-summary"),
  commercialDetailShell: document.getElementById("commercial-detail-shell"),
  commercialDetailBody: document.getElementById("commercial-detail-body"),
  commercialList: document.getElementById("commercial-list"),
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
  myAccountBtn: document.getElementById("my-account-btn"),
  accountPanelCloseBtn: document.getElementById("account-panel-close-btn"),
  accountPasswordForm: document.getElementById("account-password-form"),
  accountCurrentPassword: document.getElementById("account-current-password"),
  accountNewPassword: document.getElementById("account-new-password"),
  accountConfirmPassword: document.getElementById("account-confirm-password"),
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
  userConfirmPassword: document.getElementById("user-confirm-password"),
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
  commercialDetailRefreshBtn: document.getElementById("commercial-detail-refresh-btn"),
  commercialDetailCloseBtn: document.getElementById("commercial-detail-close-btn"),
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
  if (!message) {
    refs.flash.className = "flash hidden";
    refs.flash.textContent = "";
    return;
  }
  refs.flash.className = `flash ${kind || "info"}`;
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

function canViewUserManagement() {
  return canManage("manageUsers");
}

function canViewCommercial() {
  return canManage("manageCustomers");
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
  refs.tabCommercial?.classList.toggle("hidden", !canViewCommercial());
  refs.tabUsers?.classList.toggle("hidden", !canViewUserManagement());
  refs.userOpenCreateBtn?.classList.toggle("hidden", !canManage("manageUsers"));
  if (!canViewCommercial() && state.activeWorkspace === "commercial") {
    state.activeWorkspace = "tenants";
    state.selectedCommercialSubscriptionId = "";
  }
  if (!canViewUserManagement() && state.activeWorkspace === "users") {
    state.activeWorkspace = "tenants";
    state.selectedUserId = "";
  }
  refs.tenantOpenCreateBtn?.classList.toggle("hidden", !canManage("manageCustomers"));
  refs.environmentOpenCreateBtn?.classList.toggle("hidden", !canManage("manageEnvironments"));
  refs.jobOpenCreateBtn?.classList.toggle("hidden", !canManage("manageOperations"));
  renderMyAccountSummary();
  renderWorkspaceTabs();
}

function renderMyAccountSummary() {
  if (!state.operator || !refs.accountSummary) return;
  refs.accountSummary.innerHTML = `
    ${renderDetailField("Username", state.operator.username || "Not recorded")}
    ${renderDetailField("First Name", state.operator.firstName || "Not recorded")}
    ${renderDetailField("Last Name", state.operator.lastName || "Not recorded")}
    ${renderDetailField("Account Type", state.operator.accountType || state.operator.role || "Not recorded")}
    ${renderDetailField("Status", state.operator.isActive ? "Active" : "Inactive")}
  `;
}

function renderLists() {
  const activeTenants = state.tenants.filter((tenant) => tenant.status === "active").length;
  const draftTenants = state.tenants.filter((tenant) => tenant.status !== "active").length;
  const activeSubscriptions = state.commercialRecords.filter((record) => String(record.subscriptionStatus || "").toLowerCase() === "active").length;
  const provisioningAttention = state.commercialRecords.filter((record) => ["failed", "pending_billing_confirmation", "queued", "provisioning", "awaiting_customer_setup"].includes(String(record.provisioningStatus || "").toLowerCase())).length;
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

  if (refs.tenantSummary) refs.tenantSummary.innerHTML = renderTenantSummary(state.tenants, state.commercialRecords);
  refs.tenantList.innerHTML = renderTenantTable(state.tenants);
  if (refs.commercialSummary) refs.commercialSummary.innerHTML = renderCommercialSummary(state.commercialRecords, activeSubscriptions, provisioningAttention);
  if (refs.commercialList) refs.commercialList.innerHTML = renderCommercialTable(state.commercialRecords);
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
            <th>Commercial</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${tenants.map((tenant) => `
            <tr class="${tenant.id === state.selectedTenantId ? "selected-row" : ""}">
              <td>
                <button type="button" class="text-link-btn tenant-detail-link" data-tenant-detail-id="${escapeHtml(tenant.id)}">${escapeHtml(formatCustomerDisplayName(tenant.displayName))}</button>
              </td>
              <td data-label="Contact Name">${escapeHtml(tenant.primaryContactName || "Not recorded")}</td>
              <td data-label="Contact Email">${escapeHtml(tenant.primaryContactEmail || "Not recorded")}</td>
              <td data-label="Tenant URL">${tenant.primaryDomain ? `<a href="http://${escapeHtml(tenant.primaryDomain)}" target="_blank" rel="noreferrer">${escapeHtml(tenant.primaryDomain)}</a>` : "Not recorded"}</td>
              <td data-label="Status">${renderStatusTag(tenant.status, "tenant", formatTenantStatus(tenant.status))}</td>
              <td data-label="Plan">${escapeHtml(tenant.planCode || "standard")}</td>
              <td data-label="Commercial">${renderTenantCommercialCell(tenant)}</td>
              <td data-label="Actions">
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
  const commercialRecord = findCommercialRecordForTenant(tenant.id);
  const tenantEnvironments = state.environments.filter((environment) => environment.tenantId === tenant.id);
  refs.tenantDetailShell.classList.remove("hidden");
  syncTenantWorkspaceFocus();
  refs.tenantDetailBody.innerHTML = `
    <div class="compact-details">
      ${renderDetailField("Organization Name", tenant.displayName || "Not recorded")}
      ${renderDetailField("Slug", tenant.slug || "Not recorded")}
      ${renderDetailFieldHtml("Tenant URL", tenant.primaryDomain ? `<a href="http://${escapeHtml(tenant.primaryDomain)}" target="_blank" rel="noreferrer">${escapeHtml(tenant.primaryDomain)}</a>` : "Not recorded")}
      ${renderDetailField("Domain Type", formatDomainType(tenant.primaryDomainType || "platform_subdomain"))}
      ${renderDetailField("Status", formatTenantStatus(tenant.status || "draft"))}
      ${renderDetailField("Subscription Plan", tenant.planCode || "standard")}
      ${renderDetailField("Contact Name", tenant.primaryContactName || "Not recorded")}
      ${renderDetailField("Contact Email", tenant.primaryContactEmail || "Not recorded")}
      ${renderDetailField("Notes", tenant.notes || "None recorded")}
      ${renderDetailField("Created", formatDateTime(tenant.createdAt))}
      ${renderDetailField("Updated", formatDateTime(tenant.updatedAt))}
    </div>
    <section class="history-block">
      <h4>Commercial Snapshot</h4>
      <div class="detail-grid detail-grid-compact">
        ${renderDetailField("Commercial Account", commercialRecord?.accountName || "No commercial profile linked")}
        ${renderDetailField("Billing Contact", commercialRecord ? (commercialRecord.billingEmail || commercialRecord.ownerEmail || "Not recorded") : "Not recorded")}
        ${renderDetailField("Subscription", commercialRecord?.subscriptionStatus ? formatSubscriptionStatus(commercialRecord.subscriptionStatus) : "Not started")}
        ${renderDetailField("Provisioning", commercialRecord?.provisioningStatus ? formatProvisioningStatus(commercialRecord.provisioningStatus) : "No provisioning request")}
        ${renderDetailFieldHtml("Tenant Access", commercialRecord?.tenantUrl || commercialRecord?.resultAccessUrl ? `<a href="${escapeHtml(commercialRecord.tenantUrl || commercialRecord.resultAccessUrl)}" target="_blank" rel="noreferrer">${escapeHtml(commercialRecord.tenantUrl || commercialRecord.resultAccessUrl)}</a>` : "Not issued")}
        ${renderDetailField("Signup Status Token", commercialRecord?.signupStatusToken || "Not issued")}
      </div>
    </section>
    <section class="history-block">
      <h4>Environment Footprint</h4>
      ${renderTenantEnvironmentSummary(tenantEnvironments)}
    </section>
    <section class="history-block">
      <h4>Operator Activity</h4>
      ${renderAuditTrail(tenant.auditEntries || [], "No operator activity recorded for this customer yet.")}
    </section>
  `;
}

function renderTenantSummary(tenants, records) {
  const linkedTenantIds = new Set(records.map((record) => String(record.tenantId || "").trim()).filter(Boolean));
  const billingAttentionCount = records.filter((record) => ["past_due", "unpaid"].includes(String(record.subscriptionStatus || "").toLowerCase())).length;
  const noCommercialProfileCount = tenants.filter((tenant) => !linkedTenantIds.has(String(tenant.id || "").trim())).length;
  const readyForHandoffCount = records.filter((record) => ["ready", "awaiting_customer_setup"].includes(String(record.provisioningStatus || "").toLowerCase())).length;
  const tiles = [
    {
      kicker: "Commercially Linked",
      value: linkedTenantIds.size,
      copy: linkedTenantIds.size ? `${linkedTenantIds.size} customer${linkedTenantIds.size === 1 ? "" : "s"} already have a commercial profile tied to the control plane.` : "No customer records are linked to a commercial profile yet."
    },
    {
      kicker: "Billing Attention",
      value: billingAttentionCount,
      copy: billingAttentionCount ? `${billingAttentionCount} subscription${billingAttentionCount === 1 ? "" : "s"} are past due or unpaid.` : "No linked customers currently show billing trouble."
    },
    {
      kicker: "Ready Handoffs",
      value: readyForHandoffCount,
      copy: readyForHandoffCount ? `${readyForHandoffCount} signup${readyForHandoffCount === 1 ? "" : "s"} are ready or awaiting customer setup.` : "No customer handoffs are currently waiting in the final stretch."
    },
    {
      kicker: "Directly Managed",
      value: noCommercialProfileCount,
      copy: noCommercialProfileCount ? `${noCommercialProfileCount} customer${noCommercialProfileCount === 1 ? "" : "s"} still exist without a linked commercial profile.` : "Every current customer record is linked to the commercial layer."
    }
  ];

  return tiles.map((tile) => `
    <article class="metric-card mini-metric-card">
      <span class="status-kicker">${escapeHtml(tile.kicker)}</span>
      <strong>${escapeHtml(String(tile.value))}</strong>
      <p class="metric-copy">${escapeHtml(tile.copy)}</p>
    </article>
  `).join("");
}

function findCommercialRecordForTenant(tenantId) {
  return state.commercialRecords.find((record) => String(record.tenantId || "").trim() === String(tenantId || "").trim()) || null;
}

function renderTenantCommercialCell(tenant) {
  const record = findCommercialRecordForTenant(tenant.id);
  if (!record) {
    return `
      <span class="tag commercial-tag">No commercial profile</span>
      <div class="table-subcopy">Customer is currently managed only through the control plane.</div>
    `;
  }

  return `
    <div class="inline-tag-list">
      ${record.subscriptionStatus ? renderStatusTag(record.subscriptionStatus, "tenant", formatSubscriptionStatus(record.subscriptionStatus)) : '<span class="tag commercial-tag">Subscription Pending</span>'}
      ${record.provisioningStatus ? renderStateTag(record.provisioningStatus, "setup", formatProvisioningStatus(record.provisioningStatus)) : '<span class="tag commercial-tag">Provisioning Not Queued</span>'}
    </div>
    <div class="table-subcopy">${escapeHtml(record.billingEmail || record.ownerEmail || "No billing email recorded")}</div>
  `;
}

function renderTenantEnvironmentSummary(environments) {
  if (!environments.length) {
    return '<div class="empty-state">No environments are attached to this customer yet.</div>';
  }

  return `
    <div class="environment-footprint-list">
      ${environments.map((environment) => `
        <article class="mini-item environment-footprint-card">
          <div class="environment-footprint-header">
            <div class="environment-footprint-heading">
              <span class="eyebrow">Environment</span>
              <h5>${escapeHtml(environment.displayName || environment.environmentKey || "Environment")}</h5>
              <p class="environment-footprint-subcopy">${escapeHtml(formatEnvironmentKey(environment.environmentKey) || "No key recorded")}</p>
            </div>
            <div class="environment-footprint-status">
              <div class="environment-footprint-status-group">
                <span class="detail-label">Runtime Status</span>
                <div class="detail-badges detail-badges-compact">
                  ${renderStatusTag(environment.status, "environment", formatEnvironmentStatus(environment.status))}
                </div>
              </div>
              <div class="environment-footprint-status-group">
                <span class="detail-label">Setup State</span>
                <div class="detail-badges detail-badges-compact">
                  ${renderStatusTag(environment.setupState || "uninitialized", "setup", formatSetupState(environment.setupState || "uninitialized"))}
                </div>
              </div>
            </div>
          </div>
          <div class="detail-grid detail-grid-compact">
            ${renderDetailField("App Base URL", environment.appBaseUrl || "Not recorded")}
            ${renderDetailField("App Server", environment.appHost || "Not recorded")}
            ${renderDetailField("Web Server", environment.webHost || "Not recorded")}
            ${renderDetailField("Database", [environment.databaseHost, environment.databaseName, environment.databaseSchema].filter(Boolean).join(" / ") || "Not recorded")}
          </div>
        </article>
      `).join("")}
    </div>
  `;
}

function renderCommercialSummary(records, activeSubscriptions, provisioningAttention) {
  const totalAccounts = records.length;
  const readyAccounts = records.filter((record) => ["ready", "awaiting_customer_setup"].includes(String(record.provisioningStatus || "").toLowerCase())).length;
  const tiles = [
    {
      kicker: "Customer Accounts",
      value: totalAccounts,
      copy: totalAccounts ? `${activeSubscriptions} subscription${activeSubscriptions === 1 ? "" : "s"} currently active.` : "No SaaS customer records yet."
    },
    {
      kicker: "Provisioning Queue",
      value: provisioningAttention,
      copy: provisioningAttention ? `${provisioningAttention} commercial signup${provisioningAttention === 1 ? "" : "s"} still need follow-up.` : "No SaaS signups currently need provisioning follow-up."
    },
    {
      kicker: "Ready For Handoff",
      value: readyAccounts,
      copy: readyAccounts ? `${readyAccounts} account${readyAccounts === 1 ? "" : "s"} have reached customer-ready status.` : "No ready customer handoffs are recorded yet."
    }
  ];

  return tiles.map((tile) => `
    <article class="metric-card mini-metric-card">
      <span class="status-kicker">${escapeHtml(tile.kicker)}</span>
      <strong>${escapeHtml(String(tile.value))}</strong>
      <p class="metric-copy">${escapeHtml(tile.copy)}</p>
    </article>
  `).join("");
}

function renderCommercialTable(records) {
  if (!records.length) return '<div class="empty-state">No SaaS customer or subscription records have been created yet.</div>';
  return `
    <div class="table-shell">
      <table class="data-table">
        <thead>
          <tr>
            <th>Account</th>
            <th>Owner</th>
            <th>Plan</th>
            <th>Subscription</th>
            <th>Billable Students</th>
            <th>Provisioning</th>
            <th>Tenant Access</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${records.map((record) => `
            <tr class="${record.subscriptionId === state.selectedCommercialSubscriptionId ? "selected-row" : ""}">
              <td data-label="Account">
                <button type="button" class="text-link-btn" data-commercial-detail-id="${escapeHtml(record.subscriptionId || "")}">${escapeHtml(formatCustomerDisplayName(record.accountName) || record.accountName || "Not recorded")}</button>
                <div class="table-subcopy">${escapeHtml(record.accountSlug || "No slug recorded")}</div>
              </td>
              <td data-label="Owner">
                ${escapeHtml(record.ownerName || "Not recorded")}
                <div class="table-subcopy">${escapeHtml(record.ownerEmail || record.billingEmail || "No email recorded")}</div>
              </td>
              <td data-label="Plan">
                ${escapeHtml(record.planName || "Plan pending")}
                <div class="table-subcopy">${escapeHtml(formatMoney(record.basePriceCents || record.planPriceCents || 0))}${record.perStudentOverageCents ? ` base + ${escapeHtml(formatMoney(record.perStudentOverageCents))}/student overage` : ""}</div>
              </td>
              <td data-label="Subscription">
                <div class="inline-tag-list">
                  ${record.subscriptionStatus ? renderStatusTag(record.subscriptionStatus, "tenant", formatSubscriptionStatus(record.subscriptionStatus)) : '<span class="tag">Pending</span>'}
                  ${record.dormantStatus ? renderStateTag(record.dormantStatus, "setup", formatDormantStatus(record.dormantStatus)) : ""}
                </div>
              </td>
              <td data-label="Billable Students">
                ${escapeHtml(formatBillableSummary(record))}
                ${Number(record.currentOverageStudentCount || 0) > 0 ? `<div class="table-subcopy">${escapeHtml(`${record.currentOverageStudentCount} over included range`)}</div>` : ""}
              </td>
              <td data-label="Provisioning">${record.provisioningStatus ? renderStateTag(record.provisioningStatus, "setup", formatProvisioningStatus(record.provisioningStatus)) : '<span class="tag">Not Queued</span>'}</td>
              <td data-label="Tenant Access">
                ${record.tenantUrl || record.resultAccessUrl ? `<a href="${escapeHtml(record.tenantUrl || record.resultAccessUrl)}" target="_blank" rel="noreferrer">${escapeHtml(record.tenantUrl || record.resultAccessUrl)}</a>` : "Not issued"}
                ${record.signupStatusToken ? `<div class="table-subcopy">Status token: ${escapeHtml(record.signupStatusToken)}</div>` : ""}
              </td>
              <td data-label="Actions">
                <div class="table-actions">
                  <button type="button" class="secondary-btn table-action-btn" data-commercial-detail-id="${escapeHtml(record.subscriptionId || "")}" ${record.subscriptionId ? "" : "disabled"}>Details</button>
                </div>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
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
              <td data-label="Tenant">
                <button type="button" class="text-link-btn" data-environment-detail-id="${escapeHtml(environment.id)}">${escapeHtml(formatCustomerDisplayName(environment.tenantDisplayName || environment.tenantId || "Unknown tenant"))}</button>
              </td>
              <td data-label="Environment">
                <strong>${escapeHtml(environment.displayName || "Environment")}</strong>
                <div class="table-subcopy">${escapeHtml(formatEnvironmentKey(environment.environmentKey) || "No key recorded")}</div>
              </td>
              <td data-label="App URL">${environment.appBaseUrl ? `<a href="${escapeHtml(environment.appBaseUrl)}" target="_blank" rel="noreferrer">${escapeHtml(environment.appBaseUrl)}</a>` : "Not recorded"}</td>
              <td data-label="Status">${renderStatusTag(environment.status, "environment", formatEnvironmentStatus(environment.status))}</td>
              <td data-label="Setup">${renderStateTag(environment.setupState || "uninitialized", "setup", formatSetupState(environment.setupState || "uninitialized"))}</td>
              <td data-label="Actions">
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
              <td data-label="Tenant">
                <button type="button" class="text-link-btn" data-job-detail-id="${escapeHtml(job.id)}">${escapeHtml(formatCustomerDisplayName(resolveJobTenantName(job)))}</button>
              </td>
              <td data-label="Operation">${escapeHtml(formatJobType(job.jobType))}</td>
              <td data-label="Environment">${escapeHtml(resolveEnvironmentName(job.tenantEnvironmentId) || formatRecordReference("Environment", job.tenantEnvironmentId) || "Not recorded")}</td>
              <td data-label="Requested">${escapeHtml(formatDateTime(job.requestedAt) || "Not recorded")}</td>
              <td data-label="Status">${renderStatusTag(job.status, "job", formatJobStatus(job.status))}</td>
              <td data-label="Actions">
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
              <td data-label="Username">
                <button type="button" class="text-link-btn" data-user-detail-id="${escapeHtml(user.id)}">${escapeHtml(user.username)}</button>
              </td>
              <td data-label="First Name">${escapeHtml(user.firstName || "Not recorded")}</td>
              <td data-label="Last Name">${escapeHtml(user.lastName || "Not recorded")}</td>
              <td data-label="Account Type">${escapeHtml(user.accountType || "Read Only")}</td>
              <td data-label="Status">${renderStatusTag(user.isActive ? "active" : "inactive", "tenant", user.isActive ? "Active" : "Inactive")}</td>
              <td data-label="Last Login">${escapeHtml(formatDateTime(user.lastLoginAt) || "Never")}</td>
              <td data-label="Actions">
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
        <p class="detail-copy">${escapeHtml(environment.tenantDisplayName || environment.tenantId || "Unknown tenant")} / ${escapeHtml(formatEnvironmentKeyShort(environment.environmentKey) || "Environment")}</p>
      </div>
      <div class="operator-actions">
        <button id="environment-detail-refresh" type="button" class="secondary-btn">Refresh Detail</button>
        <button id="environment-detail-close" type="button" class="secondary-btn">Close</button>
      </div>
    </div>
    <div class="detail-badges">
      ${renderStatusTag(environment.status, "environment", formatEnvironmentStatus(environment.status))}
      ${renderStatusTag(environment.setupState || "uninitialized", "setup", formatSetupState(environment.setupState || "uninitialized"))}
      <span class="tag">${escapeHtml(environment.appHost ? `App Server: ${environment.appHost}` : "App Server Not Assigned")}</span>
      <span class="tag">${escapeHtml(environment.webHost ? `Web Server: ${environment.webHost}` : "Web Server Not Assigned")}</span>
    </div>
    <div class="detail-grid">
      ${renderDetailField("App Base URL", environment.appBaseUrl)}
      ${renderDetailField("App Server", environment.appHost || "Not recorded")}
      ${renderDetailField("Web Server", environment.webHost || "Not recorded")}
      ${renderDetailField("Database", [environment.databaseHost, environment.databaseName, environment.databaseSchema].filter(Boolean).join(" / "))}
      ${renderDetailField("Created", formatDateTime(environment.createdAt))}
      ${renderDetailField("Updated", formatDateTime(environment.updatedAt))}
      ${renderDetailField("Initialized", formatDateTime(environment.initializedAt))}
      ${renderDetailField("Health", environment.lastHealthStatus ? `${formatHealthStatus(environment.lastHealthStatus)} at ${formatDateTime(environment.lastHealthCheckAt)}` : "No health check recorded")}
    </div>
    <section class="history-block">
      <h4>Action History</h4>
      ${renderTimeline([
        { label: "Environment record created", when: environment.createdAt, tone: "info" },
        { label: `Runtime status updated to ${formatEnvironmentStatus(environment.status) || "Unknown"}`, when: environment.updatedAt, tone: environment.status === "ready" ? "success" : "info" },
        { label: `Setup state updated to ${formatSetupState(environment.setupState) || "Unknown"}`, when: environment.updatedAt, tone: environment.setupState === "token_issued" ? "warn" : "info" },
        { label: "Environment initialized", when: environment.initializedAt, tone: "success" },
        { label: `Latest health check: ${formatHealthStatus(environment.lastHealthStatus) || "Unknown"}`, when: environment.lastHealthCheckAt, tone: environment.lastHealthStatus === "healthy" ? "success" : "warn" }
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
      ${renderStatusTag(job.status, "job", formatJobStatus(job.status))}
      <span class="tag">${escapeHtml(job.tenantEnvironmentId ? formatRecordReference("Environment", job.tenantEnvironmentId) : "Environment Not Linked")}</span>
      <span class="tag">${escapeHtml(job.tenantId ? formatRecordReference("Customer", job.tenantId) : "Customer Not Linked")}</span>
    </div>
    <div class="detail-grid">
      ${renderDetailField("Requested", formatDateTime(job.requestedAt))}
      ${renderDetailField("Started", formatDateTime(job.startedAt))}
      ${renderDetailField("Completed", formatDateTime(job.completedAt))}
      ${renderDetailField("Requested By", job.requestedByOperatorUserId ? formatRecordReference("Operator", job.requestedByOperatorUserId) : "System")}
      ${renderDetailField("Error", job.errorMessage || job.errorCode || "None")}
      ${renderDetailField("Request Key", job.idempotencyKey || "None")}
    </div>
    ${renderJobDiagnostics(job)}
    ${renderJobResultSummary(job.result || {})}
    ${renderDeploymentSummary(deployment)}
    <section class="history-block">
      <h4>Timeline</h4>
      ${renderTimeline([
        { label: "Operation requested", when: job.requestedAt, tone: "info" },
        { label: "Operation started", when: job.startedAt, tone: "warn" },
        { label: "Operation completed", when: job.completedAt, tone: "success" },
        { label: `Operation status is ${formatJobStatus(job.status) || "Unknown"}`, when: job.completedAt || job.startedAt || job.requestedAt, tone: ["completed", "succeeded"].includes(job.status) ? "success" : "info" }
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
      <h4>Request Details</h4>
      <pre>${escapeHtml(JSON.stringify(job.payload || {}, null, 2))}</pre>
    </section>
    <section class="history-block">
      <h4>Result Details</h4>
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
  const allowCommercial = canViewCommercial();
  const allowUsers = canViewUserManagement();
  if (!allowCommercial && state.activeWorkspace === "commercial") {
    state.activeWorkspace = "tenants";
  }
  if (!allowUsers && state.activeWorkspace === "users") {
    state.activeWorkspace = "tenants";
  }
  const active = state.activeWorkspace || "tenants";
  refs.tabTenants?.classList.toggle("active", active === "tenants");
  refs.tabCommercial?.classList.toggle("active", allowCommercial && active === "commercial");
  refs.tabCommercial?.classList.toggle("hidden", !allowCommercial);
  refs.tabEnvironments?.classList.toggle("active", active === "environments");
  refs.tabJobs?.classList.toggle("active", active === "jobs");
  refs.tabUsers?.classList.toggle("active", allowUsers && active === "users");
  refs.tabUsers?.classList.toggle("hidden", !allowUsers);
  refs.workspaceTenants?.classList.toggle("hidden", active !== "tenants");
  refs.workspaceCommercial?.classList.toggle("hidden", !allowCommercial || active !== "commercial");
  refs.workspaceEnvironments?.classList.toggle("hidden", active !== "environments");
  refs.workspaceJobs?.classList.toggle("hidden", active !== "jobs");
  refs.workspaceUsers?.classList.toggle("hidden", !allowUsers || active !== "users");
}

function setActiveWorkspace(workspace) {
  if (workspace === "commercial" && !canViewCommercial()) {
    workspace = "tenants";
  }
  if (workspace === "users" && !canViewUserManagement()) {
    workspace = "tenants";
  }
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
  refs.commercialList.querySelectorAll("[data-commercial-detail-id]").forEach((element) => {
    element.addEventListener("click", async () => {
      const subscriptionId = element.getAttribute("data-commercial-detail-id");
      if (!subscriptionId) return;
      await loadCommercialDetail(subscriptionId);
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

async function loadCommercialDetail(subscriptionId, silent = false) {
  state.selectedCommercialSubscriptionId = subscriptionId;
  renderLists();
  syncCommercialWorkspaceFocus();
  try {
    const detail = await apiFetch(`/api/control/commercial/subscriptions/${encodeURIComponent(subscriptionId)}`);
    renderCommercialDetail(detail);
    if (!silent) {
      setFlash("info", `Loaded commercial detail for ${detail?.overview?.accountName || "subscription"}.`);
    }
  } catch (error) {
    setFlash("error", error.message);
  }
}

function renderCommercialDetail(detail) {
  if (!detail) {
    refs.commercialDetailShell.classList.add("hidden");
    refs.commercialDetailBody.innerHTML = "";
    syncCommercialWorkspaceFocus();
    return;
  }

  const overview = detail.overview || {};
  const subscription = detail.subscription || {};
  const exportRequests = Array.isArray(detail.exportRequests) ? detail.exportRequests : [];
  const auditEntries = Array.isArray(detail.auditEntries) ? detail.auditEntries : [];
  const actionButtons = [];
  const requiresOperations = !!overview.tenantEnvironmentId;
  const canRunLifecycle = !requiresOperations || canManage("manageOperations");
  const lifecycleDisabledAttr = canRunLifecycle ? "" : 'disabled title="Manage Operations permission is required to change live tenant access."';

  if (String(subscription.dormantStatus || "active").toLowerCase() === "active") {
    actionButtons.push(`<button id="commercial-mark-dormant-btn" type="button" class="secondary-btn" ${lifecycleDisabledAttr}>Mark Dormant</button>`);
  } else {
    actionButtons.push(`<button id="commercial-reactivate-btn" type="button" class="primary-btn" ${lifecycleDisabledAttr}>Reactivate</button>`);
  }
  actionButtons.push(`<button id="commercial-request-export-btn" type="button" class="secondary-btn">Request CSV Export</button>`);

  refs.commercialDetailShell.classList.remove("hidden");
  syncCommercialWorkspaceFocus();
  refs.commercialDetailBody.innerHTML = `
    <div class="detail-badges">
      ${subscription.status ? renderStatusTag(subscription.status, "tenant", formatSubscriptionStatus(subscription.status)) : '<span class="tag">Pending</span>'}
      ${subscription.dormantStatus ? renderStateTag(subscription.dormantStatus, "setup", formatDormantStatus(subscription.dormantStatus)) : ""}
      ${overview.provisioningStatus ? renderStateTag(overview.provisioningStatus, "setup", formatProvisioningStatus(overview.provisioningStatus)) : '<span class="tag">Provisioning Not Queued</span>'}
      <span class="tag">${escapeHtml(formatBillableSummary(overview))}</span>
    </div>
    <div class="detail-grid">
      ${renderDetailField("Account", overview.accountName || "Not recorded")}
      ${renderDetailField("Account Slug", overview.accountSlug || "Not recorded")}
      ${renderDetailField("Owner", overview.ownerName || "Not recorded")}
      ${renderDetailField("Billing Email", overview.billingEmail || overview.ownerEmail || "Not recorded")}
      ${renderDetailField("Plan", overview.planName || "Pending")}
      ${renderDetailField("Base Price", formatMoney(subscription.basePriceCents || overview.planPriceCents || 0))}
      ${renderDetailField("Included Billable Students", String(subscription.includedBillableStudents ?? overview.includedBillableStudents ?? 0))}
      ${renderDetailField("Per-Student Overage", Number(subscription.perStudentOverageCents ?? overview.perStudentOverageCents ?? 0) > 0 ? formatMoney(subscription.perStudentOverageCents ?? overview.perStudentOverageCents ?? 0) : "None")}
      ${renderDetailField("Current Billable Students", String(subscription.currentBillableStudentCount ?? overview.currentBillableStudentCount ?? 0))}
      ${renderDetailField("Current Overage Students", String(subscription.currentOverageStudentCount ?? overview.currentOverageStudentCount ?? 0))}
      ${renderDetailField("Billing Period Start", formatDateTime(subscription.currentPeriodStart) || "Not recorded")}
      ${renderDetailField("Billing Period End", formatDateTime(subscription.currentPeriodEnd) || "Not recorded")}
      ${renderDetailField("Last Count Refresh", formatDateTime(subscription.lastBillableCountCalculatedAt || overview.lastBillableCountCalculatedAt) || "Not recorded")}
      ${renderDetailField("Provisioning Tenant", overview.tenantId || "Not linked")}
      ${renderDetailField("Environment", overview.tenantEnvironmentId || "Not linked")}
      ${renderDetailFieldHtml("Tenant Access", overview.tenantUrl || overview.resultAccessUrl ? `<a href="${escapeHtml(overview.tenantUrl || overview.resultAccessUrl)}" target="_blank" rel="noreferrer">${escapeHtml(overview.tenantUrl || overview.resultAccessUrl)}</a>` : "Not issued")}
    </div>
    <section class="history-block">
      <div class="detail-toolbar">
        <div>
          <h4>Actions</h4>
          <p class="detail-copy">Use these actions to transition dormant state or request paid offboarding exports.</p>
        </div>
        <div class="operator-actions">
          ${actionButtons.join("")}
        </div>
      </div>
      <form id="commercial-action-form" class="stack-form action-form">
        <label><span>Operator Note</span><input id="commercial-action-notes" placeholder="Optional note for the audit trail or lifecycle job"></label>
        <label><span>Export Request Email</span><input id="commercial-export-email" type="email" value="${escapeHtml(overview.billingEmail || overview.ownerEmail || "")}"></label>
      </form>
    </section>
    <section class="history-block">
      <h4>Cancellation Export Requests</h4>
      ${renderCommercialExportRequests(exportRequests)}
    </section>
    <section class="history-block">
      <h4>Operator Activity</h4>
      ${renderAuditTrail(auditEntries, "No operator activity recorded for this subscription yet.")}
    </section>
    <section class="history-block">
      <h4>Commercial Snapshot</h4>
      <pre>${escapeHtml(JSON.stringify({ overview, subscription }, null, 2))}</pre>
    </section>
  `;

  document.getElementById("commercial-mark-dormant-btn")?.addEventListener("click", async () => {
    await submitCommercialAction(subscription.id, "dormant");
  });
  document.getElementById("commercial-reactivate-btn")?.addEventListener("click", async () => {
    await submitCommercialAction(subscription.id, "reactivate");
  });
  document.getElementById("commercial-request-export-btn")?.addEventListener("click", async () => {
    await submitCommercialAction(subscription.id, "cancellation-export");
  });
}

function renderCommercialExportRequests(requests) {
  if (!requests.length) {
    return '<div class="empty-state">No cancellation export requests have been recorded for this subscription.</div>';
  }
  return `
    <div class="table-shell">
      <table class="data-table">
        <thead>
          <tr>
            <th>Status</th>
            <th>Requested By</th>
            <th>Price</th>
            <th>Requested</th>
            <th>Artifact</th>
          </tr>
        </thead>
        <tbody>
          ${requests.map((request) => `
            <tr>
              <td data-label="Status">${renderStatusTag(request.status || "pending_payment", "job", formatExportRequestStatus(request.status))}</td>
              <td data-label="Requested By">${escapeHtml(request.requestedByEmail || "Not recorded")}</td>
              <td data-label="Price">${escapeHtml(formatMoney(request.priceCents || 0))}</td>
              <td data-label="Requested">${escapeHtml(formatDateTime(request.createdAt) || "Not recorded")}</td>
              <td data-label="Artifact">${escapeHtml(request.artifactPath || request.failureReason || "Not yet available")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function syncCommercialWorkspaceFocus() {
  const detailOpen = !refs.commercialDetailShell.classList.contains("hidden");
  refs.commercialPanelHead.classList.toggle("hidden", detailOpen);
  refs.commercialList.classList.toggle("hidden", detailOpen);
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

function resetAccountPanel() {
  refs.accountPasswordForm?.reset();
  refs.accountPanel?.classList.add("hidden");
}

function openAccountPanel() {
  renderMyAccountSummary();
  refs.accountPasswordForm?.reset();
  refs.accountPanel?.classList.remove("hidden");
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
  refs.userConfirmPassword.value = "";
  refs.userPassword.placeholder = "Leave blank to keep current password";
  refs.userConfirmPassword.placeholder = "Leave blank to keep current password";
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
  refs.userConfirmPassword.placeholder = "";
  refs.userIsActive.checked = true;
  refs.userSubmitBtn.textContent = "Create User";
  state.selectedUserId = "";
  syncUserWorkspaceFocus();
  renderLists();
}

function openCreateUserForm() {
  if (!canViewUserManagement()) return;
  resetUserForm();
  refs.userFormShell.classList.remove("hidden");
  refs.userForm.classList.remove("hidden");
  refs.userFormTitle.textContent = "New User";
  syncUserWorkspaceFocus();
}

async function loadUserDetail(userId, silent = false) {
  if (!canViewUserManagement()) return;
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
    canViewUserManagement() ? apiFetch("/api/control/operators") : Promise.resolve([]),
    apiFetch("/api/control/tenants"),
    canViewCommercial() ? apiFetch("/api/control/commercial/overview") : Promise.resolve([]),
    apiFetch("/api/control/environments"),
    apiFetch("/api/control/jobs")
  ]);

  const [userResult, tenantResult, commercialResult, environmentResult, jobResult] = results;
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

  if (commercialResult.status === "fulfilled") {
    state.commercialRecords = Array.isArray(commercialResult.value) ? commercialResult.value : [];
  } else {
    state.commercialRecords = [];
    failures.push(`commercial overview: ${commercialResult.reason.message}`);
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
  if (state.selectedCommercialSubscriptionId) await loadCommercialDetail(state.selectedCommercialSubscriptionId, true);
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
      state.commercialRecords = [];
      state.environments = [];
      state.jobs = [];
      state.selectedTenantId = "";
      state.selectedCommercialSubscriptionId = "";
      state.selectedEnvironmentId = "";
      state.selectedJobId = "";
      state.selectedUserId = "";
      resetAccountPanel();
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

  refs.myAccountBtn?.addEventListener("click", () => {
    openAccountPanel();
    setFlash(null, "");
  });

  refs.accountPanelCloseBtn?.addEventListener("click", () => {
    resetAccountPanel();
    setFlash(null, "");
  });

  refs.tabTenants?.addEventListener("click", () => setActiveWorkspace("tenants"));
  refs.tabCommercial?.addEventListener("click", () => setActiveWorkspace("commercial"));
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

  refs.commercialDetailRefreshBtn?.addEventListener("click", async () => {
    if (!state.selectedCommercialSubscriptionId) return;
    await loadCommercialDetail(state.selectedCommercialSubscriptionId, true);
  });

  refs.commercialDetailCloseBtn?.addEventListener("click", () => {
    refs.commercialDetailShell.classList.add("hidden");
    refs.commercialDetailBody.innerHTML = "";
    state.selectedCommercialSubscriptionId = "";
    syncCommercialWorkspaceFocus();
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
      if (refs.userPassword.value && refs.userPassword.value !== refs.userConfirmPassword.value) {
        throw new Error("Password and confirmation must match.");
      }
      const body = {
        username: refs.userUsername.value.trim(),
        firstName: refs.userFirstName.value.trim(),
        lastName: refs.userLastName.value.trim(),
        password: refs.userPassword.value,
        confirmPassword: refs.userConfirmPassword.value,
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

  refs.accountPasswordForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      if (refs.accountNewPassword.value !== refs.accountConfirmPassword.value) {
        throw new Error("New password and confirmation must match.");
      }
      const result = await apiFetch("/api/operator/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          currentPassword: refs.accountCurrentPassword.value,
          newPassword: refs.accountNewPassword.value,
          confirmPassword: refs.accountConfirmPassword.value
        })
      });
      if (result?.user) {
        state.operator = result.user;
        renderOperator();
      }
      resetAccountPanel();
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

function renderStatusTag(value, kind = "neutral", label = null) {
  return `<span class="tag tag-${escapeHtml(kind)} tag-${escapeHtml(String(value || "unknown").toLowerCase().replace(/[^a-z0-9-]/g, "-"))}">${escapeHtml(label || value || "unknown")}</span>`;
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
    return '<div class="empty-state">No timeline entries recorded yet.</div>';
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
      <h4>Support Guidance</h4>
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
    ${hasRaw ? `<details class="raw-details compact-details"><summary>Technical Details</summary><pre>${escapeHtml(JSON.stringify(details, null, 2))}</pre></details>` : ""}
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
      <p class="panel-copy">This operation can update the tenant app on the app server and publish hosted web assets on the web server.</p>
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
        ${renderStatusTag(status, "job", formatDeploymentStepStatus(status))}
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
  const health = formatHealthStatus(result.health) || "Unknown";
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
  if (normalized === "archived") return "Archived";
  return startCase(value);
}

function formatEnvironmentKey(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return `Environment Key: ${normalized}`;
}

function formatEnvironmentKeyShort(value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return startCase(normalized);
}

function formatTenantStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "draft") return "Draft";
  if (normalized === "active") return "Active";
  if (normalized === "suspended") return "Suspended";
  if (normalized === "decommissioned") return "Decommissioned";
  if (normalized === "provisioning") return "Provisioning";
  return startCase(value);
}

function formatDomainType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "platform_subdomain") return "Platform Subdomain";
  if (normalized === "custom_domain") return "Custom Domain";
  return startCase(value);
}

function formatSubscriptionStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "active") return "Active";
  if (normalized === "trialing") return "Trialing";
  if (normalized === "incomplete") return "Checkout Incomplete";
  if (normalized === "past_due") return "Past Due";
  if (normalized === "unpaid") return "Unpaid";
  if (normalized === "canceled") return "Canceled";
  return startCase(value);
}

function formatDormantStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "active") return "Active";
  if (normalized === "pending_dormant") return "Pending Dormant";
  if (normalized === "dormant") return "Dormant";
  return startCase(value);
}

function formatProvisioningStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "pending_billing_confirmation") return "Waiting For Billing Confirmation";
  if (normalized === "queued") return "Queued";
  if (normalized === "provisioning") return "Provisioning In Progress";
  if (normalized === "awaiting_customer_setup") return "Waiting For Customer Setup";
  if (normalized === "ready") return "Ready For Customer";
  if (normalized === "failed") return "Needs Attention";
  if (normalized === "canceled") return "Canceled";
  return startCase(value);
}

function formatJobStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "queued") return "Queued";
  if (normalized === "running") return "In Progress";
  if (normalized === "succeeded") return "Completed Successfully";
  if (normalized === "completed") return "Completed";
  if (normalized === "failed") return "Needs Attention";
  if (normalized === "canceled") return "Canceled";
  return startCase(value);
}

function formatExportRequestStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "pending_payment") return "Pending Payment";
  if (normalized === "paid") return "Paid";
  if (normalized === "queued") return "Queued";
  if (normalized === "running") return "In Progress";
  if (normalized === "completed") return "Completed";
  if (normalized === "failed") return "Needs Attention";
  return startCase(value);
}

function formatHealthStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "healthy") return "Healthy";
  if (normalized === "degraded") return "Degraded";
  if (normalized === "unhealthy") return "Unhealthy";
  return startCase(value);
}

function formatRecordReference(label, value) {
  const normalized = String(value || "").trim();
  if (!normalized) return "";
  return `${label} Record: ${normalized}`;
}

function formatAuditTarget(targetType, targetId) {
  const typeLabel = String(targetType || "").trim().toLowerCase();
  if (!targetId && !typeLabel) return "";
  if (typeLabel === "tenant") return formatRecordReference("Customer", targetId);
  if (typeLabel === "customer_subscription") return formatRecordReference("Subscription", targetId);
  if (typeLabel === "tenant_environment") return formatRecordReference("Environment", targetId);
  if (typeLabel === "provisioning_job") return formatRecordReference("Operation", targetId);
  if (typeLabel === "operator_user") return formatRecordReference("Operator", targetId);
  return [startCase(targetType), targetId].filter(Boolean).join(": ");
}

function formatAuditActionSentence(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "tenant_created") return "created a customer record";
  if (normalized === "tenant_updated") return "updated a customer record";
  if (normalized === "mark_subscription_pending_dormant") return "marked a subscription to become dormant at period end";
  if (normalized === "mark_subscription_dormant") return "marked a subscription dormant";
  if (normalized === "reactivate_subscription") return "reactivated a subscription";
  if (normalized === "tenant_reactivate_subscription") return "reactivated a subscription from the tenant account";
  if (normalized === "tenant_upgrade_subscription") return "upgraded a subscription from the tenant account";
  if (normalized === "tenant_request_cancellation_export") return "requested a cancellation export from the tenant account";
  if (normalized === "request_cancellation_export") return "requested a cancellation export";
  if (normalized === "environment_created") return "created an environment";
  if (normalized === "environment_updated") return "updated an environment";
  if (normalized === "job_created") return "queued an operation";
  if (normalized === "job_retried") return "queued a follow-up retry";
  if (normalized === "operator_created") return "created an operator account";
  if (normalized === "operator_updated") return "updated an operator account";
  return `recorded ${formatJobType(value).toLowerCase()}`;
}

function formatDeploymentStepStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "attempted") return "Completed";
  if (normalized === "skipped") return "Skipped";
  if (normalized === "pending") return "Not Started";
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

function formatMoney(cents, currency = "USD") {
  const normalized = Number(cents || 0) / 100;
  try {
    return new Intl.NumberFormat([], {
      style: "currency",
      currency: String(currency || "USD").toUpperCase()
    }).format(normalized);
  } catch (_error) {
    return `$${normalized.toFixed(2)}`;
  }
}

function formatBillableSummary(record) {
  const current = Number(record.currentBillableStudentCount || 0);
  const included = Number(record.includedBillableStudents || 0);
  if (!included) return `${current} billable`;
  return `${current} of ${included} included`;
}

function formatJobType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "provision_environment") return "Provision Environment";
  if (normalized === "issue_setup_token") return "Issue Setup Token";
  if (normalized === "deploy_release") return "Deploy Release";
  if (normalized === "suspend_tenant") return "Suspend Customer Access";
  if (normalized === "resume_tenant") return "Resume Customer Access";
  if (normalized === "decommission_tenant") return "Decommission Customer";
  return startCase(value || "job");
}

function formatCustomerDisplayName(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  return text.replace(/[\s_-]+(\d{8,14})$/, "").trim();
}

function formatJobEventType(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "database_prepared") return "Database Prepared";
  if (normalized === "runtime_allocated") return "Runtime Assigned";
  if (normalized === "token_issued") return "Setup Token Issued";
  if (normalized === "release_registered") return "Release Registered";
  if (normalized === "app_deploy_completed") return "App Update Completed";
  if (normalized === "web_deploy_completed") return "Web Update Completed";
  return formatJobType(value);
}

function formatAuditAction(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "tenant_created") return "Created Customer Record";
  if (normalized === "tenant_updated") return "Updated Customer Record";
  if (normalized === "mark_subscription_pending_dormant") return "Marked Subscription Pending Dormant";
  if (normalized === "mark_subscription_dormant") return "Marked Subscription Dormant";
  if (normalized === "reactivate_subscription") return "Reactivated Subscription";
  if (normalized === "tenant_reactivate_subscription") return "Tenant Reactivated Subscription";
  if (normalized === "tenant_upgrade_subscription") return "Tenant Upgraded Subscription";
  if (normalized === "tenant_request_cancellation_export") return "Tenant Requested Cancellation Export";
  if (normalized === "request_cancellation_export") return "Requested Cancellation Export";
  if (normalized === "environment_created") return "Created Environment";
  if (normalized === "environment_updated") return "Updated Environment";
  if (normalized === "job_created") return "Queued Operation";
  if (normalized === "job_retried") return "Queued Follow-Up Retry";
  if (normalized === "operator_created") return "Created Operator Account";
  if (normalized === "operator_updated") return "Updated Operator Account";
  return formatJobType(value);
}

function buildAuditSummary(entry) {
  const actor = entry.operatorUsername ? `${entry.operatorUsername}${entry.operatorRole ? ` (${entry.operatorRole})` : ""}` : "System";
  const target = formatAuditTarget(entry.targetType, entry.targetId);
  return `${actor} ${formatAuditActionSentence(entry.actionType)}${target ? ` for ${target}.` : "."}`;
}

function buildJobDiagnosticSummary(job, childRetryCount) {
  const parts = [`This ${formatJobType(job.jobType).toLowerCase()} is currently ${String(formatJobStatus(job.status) || "unknown").toLowerCase()}.`];
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

async function submitCommercialAction(subscriptionId, action) {
  const notes = document.getElementById("commercial-action-notes")?.value.trim() || "";
  const requestedByEmail = document.getElementById("commercial-export-email")?.value.trim() || "";
  const actionLabels = {
    dormant: "Marking subscription dormant...",
    reactivate: "Reactivating subscription...",
    "cancellation-export": "Requesting cancellation export..."
  };
  const successLabels = {
    dormant: "Subscription updated for dormant handling.",
    reactivate: "Subscription reactivated.",
    "cancellation-export": "Cancellation export request created."
  };

  setFlash("info", actionLabels[action] || "Submitting commercial action...");
  try {
    if (action === "dormant") {
      await apiFetch(`/api/control/commercial/subscriptions/${encodeURIComponent(subscriptionId)}/dormant`, {
        method: "POST",
        body: JSON.stringify({ notes })
      });
    } else if (action === "reactivate") {
      await apiFetch(`/api/control/commercial/subscriptions/${encodeURIComponent(subscriptionId)}/reactivate`, {
        method: "POST",
        body: JSON.stringify({ notes })
      });
    } else if (action === "cancellation-export") {
      await apiFetch(`/api/control/commercial/subscriptions/${encodeURIComponent(subscriptionId)}/cancellation-export`, {
        method: "POST",
        body: JSON.stringify({ requestedByEmail, notes })
      });
    } else {
      throw new Error("Unsupported commercial action.");
    }
    await refreshData(false);
    await loadCommercialDetail(subscriptionId, true);
    setFlash("success", successLabels[action] || "Commercial action completed.");
  } catch (error) {
    setFlash("error", error.message);
  }
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
