const { getPostgresPool } = require("./postgres-db");
const { randomUUID } = require("crypto");
const { normalizeOperatorPermissions, deriveOperatorAccountType, isFullAccessPermissionSet } = require("./auth-service");

function mapOperatorRow(row) {
  if (!row) return null;
  const permissions = normalizeOperatorPermissions(row.permissions ?? row.permissions_json ?? {}, row.role);
  return {
    id: row.id,
    username: row.username,
    firstName: row.firstName ?? row.first_name ?? "",
    lastName: row.lastName ?? row.last_name ?? "",
    role: row.role,
    permissions,
    accountType: deriveOperatorAccountType(permissions),
    isActive: row.isActive ?? row.is_active,
    passwordHash: row.password_hash,
    passwordSalt: row.password_salt,
    passwordAlgorithm: row.password_algorithm,
    passwordIterations: row.password_iterations,
    lastLoginAt: row.lastLoginAt ?? row.last_login_at,
    createdAt: row.createdAt ?? row.created_at ?? null,
    updatedAt: row.updatedAt ?? row.updated_at ?? null
  };
}

function mapProvisioningJobRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenantId ?? row.tenant_id ?? null,
    tenantEnvironmentId: row.tenantEnvironmentId ?? row.tenant_environment_id ?? null,
    jobType: row.jobType ?? row.job_type,
    status: row.status,
    requestedByOperatorUserId: row.requestedByOperatorUserId ?? row.requested_by_operator_user_id ?? null,
    requestedAt: row.requestedAt ?? row.requested_at ?? null,
    startedAt: row.startedAt ?? row.started_at ?? null,
    completedAt: row.completedAt ?? row.completed_at ?? null,
    lastAttemptAt: row.lastAttemptAt ?? row.last_attempt_at ?? null,
    nextAttemptAt: row.nextAttemptAt ?? row.next_attempt_at ?? null,
    attemptCount: Number(row.attemptCount ?? row.attempt_count ?? 0),
    maxAttempts: Number(row.maxAttempts ?? row.max_attempts ?? 1),
    retryOfJobId: row.retryOfJobId ?? row.retry_of_job_id ?? null,
    errorCode: row.errorCode ?? row.error_code ?? null,
    errorMessage: row.errorMessage ?? row.error_message ?? null,
    idempotencyKey: row.idempotencyKey ?? row.idempotency_key ?? null,
    payload: row.payload ?? row.payload_json ?? {},
    result: row.result ?? row.result_json ?? {}
  };
}

function mapProvisioningJobEventRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    provisioningJobId: row.provisioningJobId ?? row.provisioning_job_id,
    eventType: row.eventType ?? row.event_type,
    message: row.message,
    details: row.details ?? row.details_json ?? {},
    createdAt: row.createdAt ?? row.created_at
  };
}

function mapOperatorAuditLogRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    operatorUserId: row.operatorUserId ?? row.operator_user_id ?? null,
    operatorUsername: row.operatorUsername ?? row.operator_username ?? null,
    operatorRole: row.operatorRole ?? row.operator_role ?? null,
    actionType: row.actionType ?? row.action_type,
    targetType: row.targetType ?? row.target_type,
    targetId: row.targetId ?? row.target_id ?? null,
    tenantId: row.tenantId ?? row.tenant_id ?? null,
    details: row.details ?? row.details_json ?? {},
    createdAt: row.createdAt ?? row.created_at
  };
}

async function countOperators() {
  const pool = getPostgresPool();
  const result = await pool.query("SELECT COUNT(*)::int AS total FROM operator_users");
  return Number(result.rows[0]?.total || 0);
}

async function getOperatorByUsername(username) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      username,
      first_name,
      last_name,
      role,
      permissions_json,
      is_active,
      password_hash,
      password_salt,
      password_algorithm,
      password_iterations,
      last_login_at,
      created_at,
      updated_at
    FROM operator_users
    WHERE lower(username) = lower($1)
      AND is_active = TRUE
    LIMIT 1
  `, [username]);
  return mapOperatorRow(result.rows[0]);
}

async function createBootstrapOperator(user) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query("LOCK TABLE operator_users IN SHARE ROW EXCLUSIVE MODE");
    const countResult = await client.query("SELECT COUNT(*)::int AS total FROM operator_users");
    const total = Number(countResult.rows[0]?.total || 0);
    if (total > 0) {
      const error = new Error("Control-plane operator bootstrap is already complete.");
      error.statusCode = 409;
      throw error;
    }

    const result = await client.query(`
      INSERT INTO operator_users (
        id,
        username,
        first_name,
        last_name,
        password_hash,
        password_salt,
        password_algorithm,
        password_iterations,
        role,
        permissions_json,
        is_active,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, TRUE, NOW(), NOW())
      RETURNING
        id,
        username,
        first_name,
        last_name,
        role,
        permissions_json,
        is_active,
        password_hash,
        password_salt,
        password_algorithm,
        password_iterations,
        last_login_at,
        created_at,
        updated_at
    `, [
      user.id,
      user.username,
      user.firstName || null,
      user.lastName || null,
      user.passwordHash,
      user.passwordSalt,
      user.passwordAlgorithm,
      user.passwordIterations,
      user.role,
      JSON.stringify(normalizeOperatorPermissions(user.permissions, user.role))
    ]);

    await client.query(`
      INSERT INTO operator_audit_log (operator_user_id, action_type, target_type, target_id, details_json)
      VALUES ($1, 'bootstrap_operator', 'operator_user', $1, $2::jsonb)
    `, [user.id, JSON.stringify({ username: user.username, role: user.role })]);

    await client.query("COMMIT");
    return mapOperatorRow(result.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function createOperatorSession(operatorUserId, tokenHash, expiresAt) {
  const pool = getPostgresPool();
  await pool.query(`
    INSERT INTO operator_sessions (operator_user_id, session_token_hash, expires_at)
    VALUES ($1, $2, $3)
  `, [operatorUserId, tokenHash, expiresAt]);
}

async function getOperatorSessionByTokenHash(tokenHash) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      s.id AS session_id,
      s.operator_user_id,
      s.expires_at,
      u.id,
      u.username,
      u.first_name,
      u.last_name,
      u.role,
      u.permissions_json,
      u.is_active,
      u.password_hash,
      u.password_salt,
      u.password_algorithm,
      u.password_iterations,
      u.last_login_at,
      u.created_at,
      u.updated_at
    FROM operator_sessions s
    JOIN operator_users u ON u.id = s.operator_user_id
    WHERE s.session_token_hash = $1
      AND s.revoked_at IS NULL
      AND s.expires_at > NOW()
      AND u.is_active = TRUE
    LIMIT 1
  `, [tokenHash]);

  const row = result.rows[0];
  if (!row) return null;

  return {
    sessionId: row.session_id,
    user: mapOperatorRow(row)
  };
}

async function revokeOperatorSessionByTokenHash(tokenHash) {
  const pool = getPostgresPool();
  await pool.query(`
    UPDATE operator_sessions
    SET revoked_at = NOW()
    WHERE session_token_hash = $1
      AND revoked_at IS NULL
  `, [tokenHash]);
}

async function updateOperatorLastLogin(userId) {
  const pool = getPostgresPool();
  await pool.query(`
    UPDATE operator_users
    SET last_login_at = NOW(),
        updated_at = NOW()
    WHERE id = $1
  `, [userId]);
}

async function listOperators() {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      username,
      first_name,
      last_name,
      role,
      permissions_json,
      is_active,
      last_login_at,
      created_at,
      updated_at
    FROM operator_users
    ORDER BY created_at ASC
  `);
  return result.rows.map(mapOperatorRow);
}

async function getOperatorById(id) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      username,
      first_name,
      last_name,
      role,
      permissions_json,
      is_active,
      password_hash,
      password_salt,
      password_algorithm,
      password_iterations,
      last_login_at,
      created_at,
      updated_at
    FROM operator_users
    WHERE id = $1
    LIMIT 1
  `, [id]);
  return mapOperatorRow(result.rows[0]);
}

async function createOperatorUser(user, context = {}) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    INSERT INTO operator_users (
      id,
      username,
      first_name,
      last_name,
      password_hash,
      password_salt,
      password_algorithm,
      password_iterations,
      role,
      permissions_json,
      is_active,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, NOW(), NOW())
    RETURNING
      id,
      username,
      first_name,
      last_name,
      role,
      permissions_json,
      is_active,
      last_login_at,
      created_at,
      updated_at
  `, [
    user.id,
    user.username,
    user.firstName || null,
    user.lastName || null,
    user.passwordHash,
    user.passwordSalt,
    user.passwordAlgorithm,
    user.passwordIterations,
    user.role || "support_operator",
    JSON.stringify(normalizeOperatorPermissions(user.permissions, user.role || "support_operator")),
    user.isActive !== false
  ]);

  const created = mapOperatorRow(result.rows[0]);
  await pool.query(`
    INSERT INTO operator_audit_log (operator_user_id, action_type, target_type, target_id, details_json)
    VALUES ($1, 'create_operator_user', 'operator_user', $2, $3::jsonb)
  `, [
    context.operatorUserId || null,
    created.id,
    JSON.stringify({
      username: created.username,
      firstName: created.firstName,
      lastName: created.lastName,
      accountType: created.accountType,
      permissions: created.permissions,
      isActive: created.isActive
    })
  ]);

  return created;
}

async function updateOperatorUser(id, updates, context = {}) {
  const pool = getPostgresPool();
  const existing = await getOperatorById(id);
  if (!existing) return null;

  const role = updates.role || existing.role || "support_operator";
  const permissions = normalizeOperatorPermissions(
    updates.permissions != null ? updates.permissions : existing.permissions,
    role
  );
  const passwordUpdates = updates.passwordHash
    ? {
        passwordHash: updates.passwordHash,
        passwordSalt: updates.passwordSalt,
        passwordAlgorithm: updates.passwordAlgorithm,
        passwordIterations: updates.passwordIterations
      }
    : {
        passwordHash: existing.passwordHash,
        passwordSalt: existing.passwordSalt,
        passwordAlgorithm: existing.passwordAlgorithm,
        passwordIterations: existing.passwordIterations
      };

  const existingIsFullAccess = !!existing.isActive && isFullAccessPermissionSet(existing.permissions);
  const updatedIsActive = updates.isActive != null ? !!updates.isActive : existing.isActive;
  const updatedIsFullAccess = updatedIsActive && isFullAccessPermissionSet(permissions);
  if (existingIsFullAccess && !updatedIsFullAccess) {
    const activeOperators = await listOperators();
    const activeFullAccessCount = activeOperators.filter((operator) => operator.id !== id && operator.isActive && isFullAccessPermissionSet(operator.permissions)).length;
    if (activeFullAccessCount === 0) {
      const error = new Error("At least one active Super Admin must keep full access. Create or upgrade another Super Admin before removing this account's full access or deactivating it.");
      error.statusCode = 400;
      throw error;
    }
  }

  const result = await pool.query(`
    UPDATE operator_users
    SET username = $2,
        first_name = $3,
        last_name = $4,
        password_hash = $5,
        password_salt = $6,
        password_algorithm = $7,
        password_iterations = $8,
        role = $9,
        permissions_json = $10::jsonb,
        is_active = $11,
        updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      username,
      first_name,
      last_name,
      role,
      permissions_json,
      is_active,
      last_login_at,
      created_at,
      updated_at
  `, [
    id,
    updates.username || existing.username,
    updates.firstName != null ? updates.firstName : existing.firstName,
    updates.lastName != null ? updates.lastName : existing.lastName,
    passwordUpdates.passwordHash,
    passwordUpdates.passwordSalt,
    passwordUpdates.passwordAlgorithm,
    passwordUpdates.passwordIterations,
    role,
    JSON.stringify(permissions),
    updates.isActive != null ? !!updates.isActive : existing.isActive
  ]);

  const updated = mapOperatorRow(result.rows[0]);
  await pool.query(`
    INSERT INTO operator_audit_log (operator_user_id, action_type, target_type, target_id, details_json)
    VALUES ($1, 'update_operator_user', 'operator_user', $2, $3::jsonb)
  `, [
    context.operatorUserId || null,
    updated.id,
    JSON.stringify({
      username: updated.username,
      firstName: updated.firstName,
      lastName: updated.lastName,
      accountType: updated.accountType,
      permissions: updated.permissions,
      isActive: updated.isActive
    })
  ]);

  return updated;
}

async function listTenants() {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      t.id,
      t.slug,
      t.display_name AS "displayName",
      t.status,
      t.plan_code AS "planCode",
      t.primary_contact_name AS "primaryContactName",
      t.primary_contact_email AS "primaryContactEmail",
      t.notes,
      t.created_at AS "createdAt",
      t.updated_at AS "updatedAt",
      d.domain AS "primaryDomain",
      d.domain_type AS "primaryDomainType"
    FROM tenants t
    LEFT JOIN tenant_domains d
      ON d.tenant_id = t.id
     AND d.is_primary = TRUE
    ORDER BY t.created_at DESC
  `);
  return result.rows;
}

async function getTenantById(id) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      t.id,
      t.slug,
      t.display_name AS "displayName",
      t.status,
      t.plan_code AS "planCode",
      t.primary_contact_name AS "primaryContactName",
      t.primary_contact_email AS "primaryContactEmail",
      t.notes,
      t.created_at AS "createdAt",
      t.updated_at AS "updatedAt",
      d.domain AS "primaryDomain",
      d.domain_type AS "primaryDomainType"
    FROM tenants t
    LEFT JOIN tenant_domains d
      ON d.tenant_id = t.id
     AND d.is_primary = TRUE
    WHERE t.id = $1
    LIMIT 1
  `, [id]);
  return result.rows[0] || null;
}

async function createTenant(tenant, context = {}) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const tenantResult = await client.query(`
      INSERT INTO tenants (
        id,
        slug,
        display_name,
        status,
        plan_code,
        primary_contact_name,
        primary_contact_email,
        notes,
        created_at,
        updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
      RETURNING
        id,
        slug,
        display_name AS "displayName",
        status,
        plan_code AS "planCode",
        primary_contact_name AS "primaryContactName",
        primary_contact_email AS "primaryContactEmail",
        notes,
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `, [
      tenant.id,
      tenant.slug,
      tenant.displayName,
      tenant.status,
      tenant.planCode,
      tenant.primaryContactName || null,
      tenant.primaryContactEmail || null,
      tenant.notes || null
    ]);

    await client.query(`
      INSERT INTO tenant_domains (
        id,
        tenant_id,
        domain,
        domain_type,
        is_primary,
        verification_status,
        created_at
      )
      VALUES ($1, $2, $3, $4, TRUE, 'pending', NOW())
    `, [tenant.primaryDomainId, tenant.id, tenant.primaryDomain, tenant.primaryDomainType]);

    await client.query(`
      INSERT INTO operator_audit_log (operator_user_id, action_type, target_type, target_id, tenant_id, details_json)
      VALUES ($1, 'create_tenant', 'tenant', $2, $2, $3::jsonb)
    `, [context.operatorUserId || null, tenant.id, JSON.stringify({ slug: tenant.slug, primaryDomain: tenant.primaryDomain })]);

    await client.query("COMMIT");
    return {
      ...tenantResult.rows[0],
      primaryDomain: tenant.primaryDomain,
      primaryDomainType: tenant.primaryDomainType
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function updateTenant(id, tenant, context = {}) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    UPDATE tenants
    SET
      display_name = $2,
      status = $3,
      plan_code = $4,
      primary_contact_name = $5,
      primary_contact_email = $6,
      notes = $7,
      updated_at = NOW()
    WHERE id = $1
    RETURNING
      id,
      slug,
      display_name AS "displayName",
      status,
      plan_code AS "planCode",
      primary_contact_name AS "primaryContactName",
      primary_contact_email AS "primaryContactEmail",
      notes,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `, [
    id,
    tenant.displayName,
    tenant.status,
    tenant.planCode,
    tenant.primaryContactName || null,
    tenant.primaryContactEmail || null,
    tenant.notes || null
  ]);

  const updated = result.rows[0] || null;
  if (updated) {
    const domainResult = await pool.query(`
      SELECT
        domain AS "primaryDomain",
        domain_type AS "primaryDomainType"
      FROM tenant_domains
      WHERE tenant_id = $1
        AND is_primary = TRUE
      LIMIT 1
    `, [id]);
    await pool.query(`
      INSERT INTO operator_audit_log (operator_user_id, action_type, target_type, target_id, tenant_id, details_json)
      VALUES ($1, 'update_tenant', 'tenant', $2, $2, $3::jsonb)
    `, [context.operatorUserId || null, id, JSON.stringify({ status: tenant.status, planCode: tenant.planCode })]);
    return {
      ...updated,
      ...(domainResult.rows[0] || {})
    };
  }
  return updated;
}

async function listTenantEnvironments() {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      e.id,
      e.tenant_id AS "tenantId",
      e.environment_key AS "environmentKey",
      e.display_name AS "displayName",
      e.status,
      e.app_base_url AS "appBaseUrl",
      e.app_host AS "appHost",
      e.web_host AS "webHost",
      e.database_host AS "databaseHost",
      e.database_name AS "databaseName",
      e.database_schema AS "databaseSchema",
      e.current_release_id AS "currentReleaseId",
      e.setup_state AS "setupState",
      e.initialized_at AS "initializedAt",
      e.last_health_check_at AS "lastHealthCheckAt",
      e.last_health_status AS "lastHealthStatus",
      e.created_at AS "createdAt",
      e.updated_at AS "updatedAt",
      t.slug AS "tenantSlug",
      t.display_name AS "tenantDisplayName"
    FROM tenant_environments e
    JOIN tenants t ON t.id = e.tenant_id
    ORDER BY e.created_at DESC
  `);
  return result.rows;
}

async function getTenantEnvironmentById(id) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      e.id,
      e.tenant_id AS "tenantId",
      e.environment_key AS "environmentKey",
      e.display_name AS "displayName",
      e.status,
      e.app_base_url AS "appBaseUrl",
      e.app_host AS "appHost",
      e.web_host AS "webHost",
      e.database_host AS "databaseHost",
      e.database_name AS "databaseName",
      e.database_schema AS "databaseSchema",
      e.current_release_id AS "currentReleaseId",
      e.setup_state AS "setupState",
      e.initialized_at AS "initializedAt",
      e.last_health_check_at AS "lastHealthCheckAt",
      e.last_health_status AS "lastHealthStatus",
      e.created_at AS "createdAt",
      e.updated_at AS "updatedAt",
      t.slug AS "tenantSlug",
      t.display_name AS "tenantDisplayName"
    FROM tenant_environments e
    JOIN tenants t ON t.id = e.tenant_id
    WHERE e.id = $1
    LIMIT 1
  `, [id]);
  return result.rows[0] || null;
}

async function listSetupSyncCandidates() {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      tenant_id AS "tenantId",
      environment_key AS "environmentKey",
      display_name AS "displayName",
      status,
      app_base_url AS "appBaseUrl",
      setup_state AS "setupState",
      initialized_at AS "initializedAt",
      updated_at AS "updatedAt"
    FROM tenant_environments
    WHERE setup_state = 'token_issued'
      AND app_base_url IS NOT NULL
      AND app_base_url <> ''
      AND status IN ('ready', 'provisioning', 'degraded')
    ORDER BY updated_at ASC
  `);
  return result.rows;
}

async function createTenantEnvironment(environment, context = {}) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    INSERT INTO tenant_environments (
      id,
      tenant_id,
      environment_key,
      display_name,
      status,
      app_base_url,
      app_host,
      web_host,
      database_host,
      database_name,
      database_schema,
      setup_state,
      created_at,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'uninitialized', NOW(), NOW())
    RETURNING
      id,
      tenant_id AS "tenantId",
      environment_key AS "environmentKey",
      display_name AS "displayName",
      status,
      app_base_url AS "appBaseUrl",
      app_host AS "appHost",
      web_host AS "webHost",
      database_host AS "databaseHost",
      database_name AS "databaseName",
      database_schema AS "databaseSchema",
      current_release_id AS "currentReleaseId",
      setup_state AS "setupState",
      initialized_at AS "initializedAt",
      last_health_check_at AS "lastHealthCheckAt",
      last_health_status AS "lastHealthStatus",
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `, [
    environment.id,
    environment.tenantId,
    environment.environmentKey,
    environment.displayName,
    environment.status,
    environment.appBaseUrl || null,
    environment.appHost || null,
    environment.webHost || null,
    environment.databaseHost || null,
    environment.databaseName || null,
    environment.databaseSchema || null
  ]);

  await pool.query(`
    INSERT INTO operator_audit_log (operator_user_id, action_type, target_type, target_id, tenant_id, details_json)
    VALUES ($1, 'create_environment', 'tenant_environment', $2, $3, $4::jsonb)
  `, [context.operatorUserId || null, environment.id, environment.tenantId, JSON.stringify({ environmentKey: environment.environmentKey, status: environment.status })]);

  return result.rows[0];
}

async function markTenantEnvironmentInitialized(environmentId, details = {}) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(`
      UPDATE tenant_environments
      SET
        setup_state = 'initialized',
        initialized_at = COALESCE(initialized_at, NOW()),
        status = CASE WHEN status = 'provisioning' THEN 'ready' ELSE status END,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        tenant_id AS "tenantId",
        environment_key AS "environmentKey",
        display_name AS "displayName",
        status,
        app_base_url AS "appBaseUrl",
        app_host AS "appHost",
        web_host AS "webHost",
        database_host AS "databaseHost",
        database_name AS "databaseName",
        database_schema AS "databaseSchema",
        current_release_id AS "currentReleaseId",
        setup_state AS "setupState",
        initialized_at AS "initializedAt",
        last_health_check_at AS "lastHealthCheckAt",
        last_health_status AS "lastHealthStatus",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `, [environmentId]);
    const environment = result.rows[0] || null;
    if (!environment) {
      await client.query("ROLLBACK");
      return null;
    }

    await client.query(`
      INSERT INTO operator_audit_log (operator_user_id, action_type, target_type, target_id, tenant_id, details_json)
      VALUES (NULL, 'sync_setup_initialized', 'tenant_environment', $1, $2, $3::jsonb)
    `, [
      environment.id,
      environment.tenantId,
      JSON.stringify({
        source: details.source || "runtime_setup_status",
        appBaseUrl: details.appBaseUrl || environment.appBaseUrl || null,
        setupCompletedAt: details.setupCompletedAt || null
      })
    ]);

    await client.query("COMMIT");
    return environment;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function resolveTenantRuntimeByHost(host, options = {}) {
  const normalizedHost = String(host || "").trim().toLowerCase();
  if (!normalizedHost) return null;

  const pool = getPostgresPool();
  const params = [normalizedHost];
  let environmentFilterSql = "";
  if (options.environmentKey) {
    params.push(String(options.environmentKey).trim().toLowerCase());
    environmentFilterSql = `AND e.environment_key = $2`;
  }

  const result = await pool.query(`
    SELECT
      t.id AS "tenantId",
      t.slug AS "tenantSlug",
      t.display_name AS "tenantDisplayName",
      d.domain,
      d.domain_type AS "domainType",
      d.verification_status AS "domainVerificationStatus",
      e.id AS "environmentId",
      e.environment_key AS "environmentKey",
      e.display_name AS "environmentDisplayName",
      e.status,
      e.setup_state AS "setupState",
      e.app_base_url AS "appBaseUrl",
      e.app_host AS "appHost",
      e.web_host AS "webHost",
      e.database_host AS "databaseHost",
      e.database_name AS "databaseName",
      e.database_schema AS "databaseSchema",
      e.last_health_status AS "lastHealthStatus",
      e.last_health_check_at AS "lastHealthCheckAt",
      e.created_at AS "createdAt",
      e.updated_at AS "updatedAt"
    FROM tenant_domains d
    JOIN tenants t ON t.id = d.tenant_id
    JOIN tenant_environments e ON e.tenant_id = t.id
    WHERE lower(d.domain) = $1
      AND t.status = 'active'
      AND e.status <> 'archived'
      ${environmentFilterSql}
    ORDER BY
      CASE e.environment_key
        WHEN 'production' THEN 0
        WHEN 'staging' THEN 1
        ELSE 2
      END,
      CASE e.status
        WHEN 'ready' THEN 0
        WHEN 'provisioning' THEN 1
        WHEN 'pending' THEN 2
        WHEN 'degraded' THEN 3
        ELSE 4
      END,
      e.created_at ASC
    LIMIT 1
  `, params);

  return result.rows[0] || null;
}

async function listProvisioningJobs() {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      j.id,
      j.tenant_id AS "tenantId",
      j.tenant_environment_id AS "tenantEnvironmentId",
      j.job_type AS "jobType",
      j.status,
      j.requested_by_operator_user_id AS "requestedByOperatorUserId",
      j.requested_at AS "requestedAt",
      j.started_at AS "startedAt",
      j.completed_at AS "completedAt",
      j.last_attempt_at AS "lastAttemptAt",
      j.next_attempt_at AS "nextAttemptAt",
      j.attempt_count AS "attemptCount",
      j.max_attempts AS "maxAttempts",
      j.retry_of_job_id AS "retryOfJobId",
      j.error_code AS "errorCode",
      j.error_message AS "errorMessage",
      j.idempotency_key AS "idempotencyKey",
      j.payload_json AS "payload",
      j.result_json AS "result"
    FROM provisioning_jobs j
    ORDER BY j.requested_at DESC
  `);
  return result.rows.map(mapProvisioningJobRow);
}

async function getProvisioningJobById(id) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      j.id,
      j.tenant_id AS "tenantId",
      j.tenant_environment_id AS "tenantEnvironmentId",
      j.job_type AS "jobType",
      j.status,
      j.requested_by_operator_user_id AS "requestedByOperatorUserId",
      j.requested_at AS "requestedAt",
      j.started_at AS "startedAt",
      j.completed_at AS "completedAt",
      j.last_attempt_at AS "lastAttemptAt",
      j.next_attempt_at AS "nextAttemptAt",
      j.attempt_count AS "attemptCount",
      j.max_attempts AS "maxAttempts",
      j.retry_of_job_id AS "retryOfJobId",
      j.error_code AS "errorCode",
      j.error_message AS "errorMessage",
      j.idempotency_key AS "idempotencyKey",
      j.payload_json AS "payload",
      j.result_json AS "result"
    FROM provisioning_jobs j
    WHERE j.id = $1
    LIMIT 1
  `, [id]);
  return mapProvisioningJobRow(result.rows[0]);
}

async function listProvisioningJobEvents(jobId) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      id,
      provisioning_job_id AS "provisioningJobId",
      event_type AS "eventType",
      message,
      details_json AS "details",
      created_at AS "createdAt"
    FROM provisioning_job_events
    WHERE provisioning_job_id = $1
    ORDER BY created_at ASC
  `, [jobId]);
  return result.rows.map(mapProvisioningJobEventRow);
}

async function listOperatorAuditLog(filters = {}) {
  const pool = getPostgresPool();
  const params = [];
  const clauses = [];

  if (filters.tenantId) {
    params.push(String(filters.tenantId).trim());
    clauses.push(`a.tenant_id = $${params.length}`);
  }
  if (filters.targetType) {
    params.push(String(filters.targetType).trim());
    clauses.push(`a.target_type = $${params.length}`);
  }
  if (filters.targetId) {
    params.push(String(filters.targetId).trim());
    clauses.push(`a.target_id = $${params.length}`);
  }
  if (filters.actionType) {
    params.push(String(filters.actionType).trim());
    clauses.push(`a.action_type = $${params.length}`);
  }

  const limit = Math.min(Math.max(Number(filters.limit) || 20, 1), 100);
  params.push(limit);

  const whereSql = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const result = await pool.query(`
    SELECT
      a.id,
      a.operator_user_id AS "operatorUserId",
      u.username AS "operatorUsername",
      u.role AS "operatorRole",
      a.action_type AS "actionType",
      a.target_type AS "targetType",
      a.target_id AS "targetId",
      a.tenant_id AS "tenantId",
      a.details_json AS "details",
      a.created_at AS "createdAt"
    FROM operator_audit_log a
    LEFT JOIN operator_users u ON u.id = a.operator_user_id
    ${whereSql}
    ORDER BY a.created_at DESC
    LIMIT $${params.length}
  `, params);

  return result.rows.map(mapOperatorAuditLogRow);
}

async function queueProvisioningJob(job, context = {}) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (job.idempotencyKey) {
      const existingResult = await client.query(`
        SELECT
          id,
          tenant_id AS "tenantId",
          tenant_environment_id AS "tenantEnvironmentId",
          job_type AS "jobType",
          status,
          requested_by_operator_user_id AS "requestedByOperatorUserId",
          requested_at AS "requestedAt",
          started_at AS "startedAt",
          completed_at AS "completedAt",
          last_attempt_at AS "lastAttemptAt",
          next_attempt_at AS "nextAttemptAt",
          attempt_count AS "attemptCount",
          max_attempts AS "maxAttempts",
          retry_of_job_id AS "retryOfJobId",
          error_code AS "errorCode",
          error_message AS "errorMessage",
          idempotency_key AS "idempotencyKey",
          payload_json AS "payload",
          result_json AS "result"
        FROM provisioning_jobs
        WHERE idempotency_key = $1
        LIMIT 1
      `, [job.idempotencyKey]);

      const existing = mapProvisioningJobRow(existingResult.rows[0]);
      if (existing) {
        const sameIntent = existing.jobType === job.jobType
          && existing.tenantId === (job.tenantId || null)
          && existing.tenantEnvironmentId === (job.tenantEnvironmentId || null)
          && JSON.stringify(stableJson(existing.payload || {})) === JSON.stringify(stableJson(job.payload || {}));

        if (!sameIntent) {
          const error = new Error("This idempotency key is already used for a different provisioning request.");
          error.statusCode = 409;
          throw error;
        }

        await client.query("COMMIT");
        return existing;
      }
    }

    const jobResult = await client.query(`
      INSERT INTO provisioning_jobs (
        id,
        tenant_id,
        tenant_environment_id,
        job_type,
        status,
        requested_by_operator_user_id,
        requested_at,
        attempt_count,
        max_attempts,
        next_attempt_at,
        retry_of_job_id,
        idempotency_key,
        payload_json,
        result_json
      )
      VALUES ($1, $2, $3, $4, 'queued', $5, NOW(), 0, $6, NOW(), $7, $8, $9::jsonb, '{}'::jsonb)
      RETURNING
        id,
        tenant_id AS "tenantId",
        tenant_environment_id AS "tenantEnvironmentId",
        job_type AS "jobType",
        status,
        requested_by_operator_user_id AS "requestedByOperatorUserId",
        requested_at AS "requestedAt",
        started_at AS "startedAt",
        completed_at AS "completedAt",
        last_attempt_at AS "lastAttemptAt",
        next_attempt_at AS "nextAttemptAt",
        attempt_count AS "attemptCount",
        max_attempts AS "maxAttempts",
        retry_of_job_id AS "retryOfJobId",
        error_code AS "errorCode",
        error_message AS "errorMessage",
        idempotency_key AS "idempotencyKey",
        payload_json AS "payload",
        result_json AS "result"
    `, [
      job.id,
      job.tenantId || null,
      job.tenantEnvironmentId || null,
      job.jobType,
      context.operatorUserId || null,
      normalizeMaxAttempts(job.maxAttempts),
      job.retryOfJobId || null,
      job.idempotencyKey || null,
      JSON.stringify(job.payload || {})
    ]);

    await client.query(`
      INSERT INTO provisioning_job_events (provisioning_job_id, event_type, message, details_json)
      VALUES ($1, 'queued', $2, $3::jsonb)
    `, [job.id, job.message || `${job.jobType} queued`, JSON.stringify(job.payload || {})]);

    if ((job.jobType === "provision_environment" || job.jobType === "deploy_release") && job.tenantEnvironmentId) {
      await client.query(`
        UPDATE tenant_environments
        SET status = 'provisioning', updated_at = NOW()
        WHERE id = $1
      `, [job.tenantEnvironmentId]);
    }

    await client.query(`
      INSERT INTO operator_audit_log (operator_user_id, action_type, target_type, target_id, tenant_id, details_json)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `, [
      context.operatorUserId || null,
      `queue_${job.jobType}`,
      'provisioning_job',
      job.id,
      job.tenantId || null,
      JSON.stringify({ tenantEnvironmentId: job.tenantEnvironmentId || null, idempotencyKey: job.idempotencyKey || null })
    ]);

    await client.query("COMMIT");
    return mapProvisioningJobRow(jobResult.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function claimNextProvisioningJob() {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(`
      WITH next_job AS (
        SELECT id
        FROM provisioning_jobs
        WHERE status = 'queued'
          AND next_attempt_at <= NOW()
        ORDER BY next_attempt_at ASC, requested_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      UPDATE provisioning_jobs j
      SET
        status = 'running',
        started_at = COALESCE(j.started_at, NOW()),
        last_attempt_at = NOW(),
        attempt_count = j.attempt_count + 1,
        error_code = NULL,
        error_message = NULL,
        next_attempt_at = NOW()
      FROM next_job
      WHERE j.id = next_job.id
      RETURNING
        j.id,
        j.tenant_id AS "tenantId",
        j.tenant_environment_id AS "tenantEnvironmentId",
        j.job_type AS "jobType",
        j.status,
        j.requested_by_operator_user_id AS "requestedByOperatorUserId",
        j.requested_at AS "requestedAt",
        j.started_at AS "startedAt",
        j.completed_at AS "completedAt",
        j.last_attempt_at AS "lastAttemptAt",
        j.next_attempt_at AS "nextAttemptAt",
        j.attempt_count AS "attemptCount",
        j.max_attempts AS "maxAttempts",
        j.retry_of_job_id AS "retryOfJobId",
        j.error_code AS "errorCode",
        j.error_message AS "errorMessage",
        j.idempotency_key AS "idempotencyKey",
        j.payload_json AS "payload",
        j.result_json AS "result"
    `);

    const job = mapProvisioningJobRow(result.rows[0]);
    if (job) {
      await client.query(`
        INSERT INTO provisioning_job_events (provisioning_job_id, event_type, message, details_json)
        VALUES ($1, 'running', 'Worker claimed job', $2::jsonb)
      `, [job.id, JSON.stringify({ status: "running", startedAt: job.startedAt })]);
    }

    await client.query("COMMIT");
    return job;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function appendProvisioningJobEvent(jobId, eventType, message, details = {}) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    INSERT INTO provisioning_job_events (provisioning_job_id, event_type, message, details_json)
    VALUES ($1, $2, $3, $4::jsonb)
    RETURNING
      id,
      provisioning_job_id AS "provisioningJobId",
      event_type AS "eventType",
      message,
      details_json AS "details",
      created_at AS "createdAt"
  `, [jobId, eventType, message, JSON.stringify(details || {})]);
  return mapProvisioningJobEventRow(result.rows[0]);
}

async function markProvisioningJobFailed(jobId, errorCode, errorMessage, result = {}) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const jobResult = await client.query(`
      UPDATE provisioning_jobs
      SET
        status = 'failed',
        completed_at = NOW(),
        error_code = $2,
        error_message = $3,
        result_json = $4::jsonb
      WHERE id = $1
      RETURNING
        id,
        tenant_id AS "tenantId",
        tenant_environment_id AS "tenantEnvironmentId",
        job_type AS "jobType",
        status,
        requested_by_operator_user_id AS "requestedByOperatorUserId",
        requested_at AS "requestedAt",
        started_at AS "startedAt",
        completed_at AS "completedAt",
        last_attempt_at AS "lastAttemptAt",
        next_attempt_at AS "nextAttemptAt",
        attempt_count AS "attemptCount",
        max_attempts AS "maxAttempts",
        retry_of_job_id AS "retryOfJobId",
        error_code AS "errorCode",
        error_message AS "errorMessage",
        idempotency_key AS "idempotencyKey",
        payload_json AS "payload",
        result_json AS "result"
    `, [jobId, errorCode || "job_failed", errorMessage || "Job failed.", JSON.stringify(result || {})]);
    await client.query(`
      INSERT INTO provisioning_job_events (provisioning_job_id, event_type, message, details_json)
      VALUES ($1, 'failed', $2, $3::jsonb)
    `, [jobId, errorMessage || "Job failed.", JSON.stringify({ errorCode: errorCode || "job_failed", ...(result || {}) })]);
    await client.query("COMMIT");
    return mapProvisioningJobRow(jobResult.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function scheduleProvisioningJobRetry(jobId, options = {}) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const delaySeconds = Math.max(Number(options.delaySeconds) || 30, 5);
    const reason = options.reason || "Transient failure detected; retry scheduled.";
    const resultPayload = {
      ...(options.result || {}),
      retryScheduled: true,
      retryDelaySeconds: delaySeconds
    };

    const jobResult = await client.query(`
      UPDATE provisioning_jobs
      SET
        status = 'queued',
        completed_at = NULL,
        error_code = $2,
        error_message = $3,
        result_json = $4::jsonb,
        next_attempt_at = NOW() + ($5 * INTERVAL '1 second')
      WHERE id = $1
      RETURNING
        id,
        tenant_id AS "tenantId",
        tenant_environment_id AS "tenantEnvironmentId",
        job_type AS "jobType",
        status,
        requested_by_operator_user_id AS "requestedByOperatorUserId",
        requested_at AS "requestedAt",
        started_at AS "startedAt",
        completed_at AS "completedAt",
        last_attempt_at AS "lastAttemptAt",
        next_attempt_at AS "nextAttemptAt",
        attempt_count AS "attemptCount",
        max_attempts AS "maxAttempts",
        retry_of_job_id AS "retryOfJobId",
        error_code AS "errorCode",
        error_message AS "errorMessage",
        idempotency_key AS "idempotencyKey",
        payload_json AS "payload",
        result_json AS "result"
    `, [jobId, options.errorCode || "retry_scheduled", reason, JSON.stringify(resultPayload), delaySeconds]);

    await client.query(`
      INSERT INTO provisioning_job_events (provisioning_job_id, event_type, message, details_json)
      VALUES ($1, 'retry_scheduled', $2, $3::jsonb)
    `, [jobId, reason, JSON.stringify(resultPayload)]);

    await client.query("COMMIT");
    return mapProvisioningJobRow(jobResult.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function completeProvisionEnvironmentJob(job, automationResult = {}) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const environmentResult = await client.query(`
      SELECT
        id,
        tenant_id AS "tenantId",
        environment_key AS "environmentKey",
        display_name AS "displayName",
        status,
        app_base_url AS "appBaseUrl",
        app_host AS "appHost",
        web_host AS "webHost",
        database_host AS "databaseHost",
        database_name AS "databaseName",
        database_schema AS "databaseSchema",
        current_release_id AS "currentReleaseId",
        setup_state AS "setupState"
      FROM tenant_environments
      WHERE id = $1
      LIMIT 1
    `, [job.tenantEnvironmentId]);
    const environment = environmentResult.rows[0];
    if (!environment) {
      const error = new Error("Environment not found for provisioning job.");
      error.code = "environment_not_found";
      throw error;
    }

    const payload = job.payload || {};
    const releaseId = `release-${randomUUID()}`;
    const releaseVersion = String(payload.releaseVersion || `env-${environment.environmentKey}-${Date.now()}`).trim();

    await client.query(`
      INSERT INTO tenant_releases (
        id,
        tenant_environment_id,
        release_version,
        deployed_by,
        deployed_at,
        release_notes
      )
      VALUES ($1, $2, $3, $4, NOW(), $5)
    `, [
      releaseId,
      environment.id,
      releaseVersion,
      job.requestedByOperatorUserId || null,
      "Provisioned by control-plane worker"
    ]);

    const updatedEnvironmentResult = await client.query(`
      UPDATE tenant_environments
      SET
        status = 'ready',
        app_base_url = COALESCE(NULLIF($2, ''), app_base_url),
        app_host = COALESCE(NULLIF($3, ''), app_host),
        web_host = COALESCE(NULLIF($4, ''), web_host),
        database_host = COALESCE(NULLIF($5, ''), database_host),
        database_name = COALESCE(NULLIF($6, ''), database_name),
        database_schema = COALESCE(NULLIF($7, ''), database_schema),
        current_release_id = $8,
        last_health_check_at = NOW(),
        last_health_status = 'healthy',
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        tenant_id AS "tenantId",
        environment_key AS "environmentKey",
        display_name AS "displayName",
        status,
        app_base_url AS "appBaseUrl",
        app_host AS "appHost",
        web_host AS "webHost",
        database_host AS "databaseHost",
        database_name AS "databaseName",
        database_schema AS "databaseSchema",
        current_release_id AS "currentReleaseId",
        setup_state AS "setupState",
        initialized_at AS "initializedAt",
        last_health_check_at AS "lastHealthCheckAt",
        last_health_status AS "lastHealthStatus",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `, [
      environment.id,
      payload.appBaseUrl || environment.appBaseUrl || null,
      payload.appHost || environment.appHost || null,
      payload.webHost || environment.webHost || null,
      payload.databaseHost || environment.databaseHost || null,
      payload.databaseName || environment.databaseName || null,
      payload.databaseSchema || environment.databaseSchema || null,
      releaseId
    ]);

    const jobResult = {
      releaseId,
      releaseVersion,
      environmentStatus: "ready",
      setupState: environment.setupState || "uninitialized",
      health: "healthy",
      runtimeBundlePath: automationResult.bundlePath || null,
      databaseSchema: automationResult.databaseSchema || environment.databaseSchema || null,
      deployment: automationResult.deployment || {
        enabled: false,
        app: { attempted: false, skipped: true, reason: "deployment_disabled" },
        web: { attempted: false, skipped: true, reason: "deployment_disabled" }
      }
    };

    const completedJobResult = await client.query(`
      UPDATE provisioning_jobs
      SET
        status = 'succeeded',
        completed_at = NOW(),
        result_json = $2::jsonb
      WHERE id = $1
      RETURNING
        id,
        tenant_id AS "tenantId",
        tenant_environment_id AS "tenantEnvironmentId",
        job_type AS "jobType",
        status,
        requested_by_operator_user_id AS "requestedByOperatorUserId",
        requested_at AS "requestedAt",
        started_at AS "startedAt",
        completed_at AS "completedAt",
        last_attempt_at AS "lastAttemptAt",
        next_attempt_at AS "nextAttemptAt",
        attempt_count AS "attemptCount",
        max_attempts AS "maxAttempts",
        retry_of_job_id AS "retryOfJobId",
        error_code AS "errorCode",
        error_message AS "errorMessage",
        idempotency_key AS "idempotencyKey",
        payload_json AS "payload",
        result_json AS "result"
    `, [job.id, JSON.stringify(jobResult)]);

    await client.query(`
      INSERT INTO provisioning_job_events (provisioning_job_id, event_type, message, details_json)
      VALUES
        ($1, 'runtime_allocated', 'Runtime metadata confirmed for environment', $2::jsonb),
        ($1, 'database_prepared', 'Tenant runtime database routing is available', $3::jsonb),
        ($1, 'migrations_applied', 'Tenant runtime migrations applied', $4::jsonb),
        ($1, 'runtime_bundle_written', 'Tenant runtime bundle written', $5::jsonb),
        ($1, 'app_deploy_completed', 'Tenant app deployment step completed', $6::jsonb),
        ($1, 'web_deploy_completed', 'Tenant web deployment step completed', $7::jsonb),
        ($1, 'release_registered', 'Tenant release registered', $8::jsonb),
        ($1, 'succeeded', 'Provision environment completed', $9::jsonb)
    `, [
      job.id,
      JSON.stringify({
        appHost: payload.appHost || environment.appHost || null,
        webHost: payload.webHost || environment.webHost || null,
        appBaseUrl: payload.appBaseUrl || environment.appBaseUrl || null
      }),
      JSON.stringify({
        databaseHost: payload.databaseHost || environment.databaseHost || null,
        databaseName: payload.databaseName || environment.databaseName || null,
        databaseSchema: payload.databaseSchema || environment.databaseSchema || null
      }),
      JSON.stringify({
        databaseHost: automationResult.databaseHost || payload.databaseHost || environment.databaseHost || null,
        databaseName: automationResult.databaseName || payload.databaseName || environment.databaseName || null,
        databaseSchema: automationResult.databaseSchema || payload.databaseSchema || environment.databaseSchema || null
      }),
      JSON.stringify({
        runtimeBundlePath: automationResult.bundlePath || null
      }),
      JSON.stringify(automationResult.deployment?.app || {
        attempted: false,
        skipped: true,
        reason: "deployment_disabled"
      }),
      JSON.stringify(automationResult.deployment?.web || {
        attempted: false,
        skipped: true,
        reason: "deployment_disabled"
      }),
      JSON.stringify({ releaseId, releaseVersion }),
      JSON.stringify(jobResult)
    ]);

    await client.query("COMMIT");
    return {
      job: mapProvisioningJobRow(completedJobResult.rows[0]),
      environment: updatedEnvironmentResult.rows[0]
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function completeDeployReleaseJob(job, automationResult = {}) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const environmentResult = await client.query(`
      SELECT
        id,
        tenant_id AS "tenantId",
        environment_key AS "environmentKey",
        display_name AS "displayName",
        status,
        app_base_url AS "appBaseUrl",
        app_host AS "appHost",
        web_host AS "webHost",
        database_host AS "databaseHost",
        database_name AS "databaseName",
        database_schema AS "databaseSchema",
        current_release_id AS "currentReleaseId",
        setup_state AS "setupState"
      FROM tenant_environments
      WHERE id = $1
      LIMIT 1
    `, [job.tenantEnvironmentId]);
    const environment = environmentResult.rows[0];
    if (!environment) {
      const error = new Error("Environment not found for deploy-release job.");
      error.code = "environment_not_found";
      throw error;
    }

    const payload = job.payload || {};
    const releaseId = `release-${randomUUID()}`;
    const releaseVersion = String(payload.releaseVersion || `release-${environment.environmentKey}-${Date.now()}`).trim();

    await client.query(`
      INSERT INTO tenant_releases (
        id,
        tenant_environment_id,
        release_version,
        deployed_by,
        deployed_at,
        release_notes
      )
      VALUES ($1, $2, $3, $4, NOW(), $5)
    `, [
      releaseId,
      environment.id,
      releaseVersion,
      job.requestedByOperatorUserId || null,
      "Deployed by control-plane worker"
    ]);

    const updatedEnvironmentResult = await client.query(`
      UPDATE tenant_environments
      SET
        status = 'ready',
        app_base_url = COALESCE(NULLIF($2, ''), app_base_url),
        app_host = COALESCE(NULLIF($3, ''), app_host),
        web_host = COALESCE(NULLIF($4, ''), web_host),
        current_release_id = $5,
        last_health_check_at = NOW(),
        last_health_status = 'healthy',
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        tenant_id AS "tenantId",
        environment_key AS "environmentKey",
        display_name AS "displayName",
        status,
        app_base_url AS "appBaseUrl",
        app_host AS "appHost",
        web_host AS "webHost",
        database_host AS "databaseHost",
        database_name AS "databaseName",
        database_schema AS "databaseSchema",
        current_release_id AS "currentReleaseId",
        setup_state AS "setupState",
        initialized_at AS "initializedAt",
        last_health_check_at AS "lastHealthCheckAt",
        last_health_status AS "lastHealthStatus",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `, [
      environment.id,
      payload.appBaseUrl || environment.appBaseUrl || null,
      payload.appHost || environment.appHost || null,
      payload.webHost || environment.webHost || null,
      releaseId
    ]);

    const jobResult = {
      releaseId,
      releaseVersion,
      environmentStatus: "ready",
      setupState: environment.setupState || "uninitialized",
      health: "healthy",
      runtimeBundlePath: automationResult.bundlePath || null,
      databaseSchema: automationResult.databaseSchema || environment.databaseSchema || null,
      deployment: automationResult.deployment || {
        enabled: false,
        app: { attempted: false, skipped: true, reason: "deployment_disabled" },
        web: { attempted: false, skipped: true, reason: "deployment_disabled" }
      }
    };

    const completedJobResult = await client.query(`
      UPDATE provisioning_jobs
      SET
        status = 'succeeded',
        completed_at = NOW(),
        result_json = $2::jsonb
      WHERE id = $1
      RETURNING
        id,
        tenant_id AS "tenantId",
        tenant_environment_id AS "tenantEnvironmentId",
        job_type AS "jobType",
        status,
        requested_by_operator_user_id AS "requestedByOperatorUserId",
        requested_at AS "requestedAt",
        started_at AS "startedAt",
        completed_at AS "completedAt",
        last_attempt_at AS "lastAttemptAt",
        next_attempt_at AS "nextAttemptAt",
        attempt_count AS "attemptCount",
        max_attempts AS "maxAttempts",
        retry_of_job_id AS "retryOfJobId",
        error_code AS "errorCode",
        error_message AS "errorMessage",
        idempotency_key AS "idempotencyKey",
        payload_json AS "payload",
        result_json AS "result"
    `, [job.id, JSON.stringify(jobResult)]);

    await client.query(`
      INSERT INTO provisioning_job_events (provisioning_job_id, event_type, message, details_json)
      VALUES
        ($1, 'runtime_bundle_written', 'Tenant runtime bundle written for release deployment', $2::jsonb),
        ($1, 'app_deploy_completed', 'Tenant app deployment step completed', $3::jsonb),
        ($1, 'web_deploy_completed', 'Tenant web deployment step completed', $4::jsonb),
        ($1, 'release_registered', 'Tenant release registered', $5::jsonb),
        ($1, 'succeeded', 'Deploy release completed', $6::jsonb)
    `, [
      job.id,
      JSON.stringify({
        runtimeBundlePath: automationResult.bundlePath || null
      }),
      JSON.stringify(automationResult.deployment?.app || {
        attempted: false,
        skipped: true,
        reason: "deployment_disabled"
      }),
      JSON.stringify(automationResult.deployment?.web || {
        attempted: false,
        skipped: true,
        reason: "deployment_disabled"
      }),
      JSON.stringify({ releaseId, releaseVersion }),
      JSON.stringify(jobResult)
    ]);

    await client.query("COMMIT");
    return {
      job: mapProvisioningJobRow(completedJobResult.rows[0]),
      environment: updatedEnvironmentResult.rows[0]
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function completeSetupTokenJob(job, automationResult = {}) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const environmentResult = await client.query(`
      SELECT
        id,
        tenant_id AS "tenantId",
        display_name AS "displayName",
        setup_state AS "setupState"
      FROM tenant_environments
      WHERE id = $1
      LIMIT 1
    `, [job.tenantEnvironmentId]);
    const environment = environmentResult.rows[0];
    if (!environment) {
      const error = new Error("Environment not found for setup-token job.");
      error.code = "environment_not_found";
      throw error;
    }

    const payload = job.payload || {};
    const ttlHours = Number(payload.ttlHours || 2);
    const expiresAt = automationResult.expiresAt ? new Date(automationResult.expiresAt) : new Date(Date.now() + (ttlHours * 60 * 60 * 1000));
    const issuedTokenId = `setup-${randomUUID()}`;

    await client.query(`
      INSERT INTO setup_tokens_issued (
        tenant_environment_id,
        provisioning_job_id,
        issued_by_operator_user_id,
        issued_at,
        expires_at,
        delivered_via,
        notes
      )
      VALUES ($1, $2, $3, NOW(), $4, $5, $6)
    `, [
      environment.id,
      job.id,
      job.requestedByOperatorUserId || null,
      expiresAt,
      payload.deliveredVia || "operator_console",
      payload.notes || null
    ]);

    await client.query(`
      UPDATE tenant_environments
      SET
        setup_state = 'token_issued',
        updated_at = NOW()
      WHERE id = $1
    `, [environment.id]);

    const resultPayload = {
      issuedTokenId,
      expiresAt: expiresAt.toISOString(),
      deliveredVia: payload.deliveredVia || "operator_console",
      setupState: "token_issued",
      tokenPath: automationResult.tokenPath || null
    };

    const completedJobResult = await client.query(`
      UPDATE provisioning_jobs
      SET
        status = 'succeeded',
        completed_at = NOW(),
        result_json = $2::jsonb
      WHERE id = $1
      RETURNING
        id,
        tenant_id AS "tenantId",
        tenant_environment_id AS "tenantEnvironmentId",
        job_type AS "jobType",
        status,
        requested_by_operator_user_id AS "requestedByOperatorUserId",
        requested_at AS "requestedAt",
        started_at AS "startedAt",
        completed_at AS "completedAt",
        last_attempt_at AS "lastAttemptAt",
        next_attempt_at AS "nextAttemptAt",
        attempt_count AS "attemptCount",
        max_attempts AS "maxAttempts",
        retry_of_job_id AS "retryOfJobId",
        error_code AS "errorCode",
        error_message AS "errorMessage",
        idempotency_key AS "idempotencyKey",
        payload_json AS "payload",
        result_json AS "result"
    `, [job.id, JSON.stringify(resultPayload)]);

    await client.query(`
      INSERT INTO provisioning_job_events (provisioning_job_id, event_type, message, details_json)
      VALUES
        ($1, 'token_issued', 'Setup token issuance recorded', $2::jsonb),
        ($1, 'succeeded', 'Issue setup token completed', $3::jsonb)
    `, [
      job.id,
      JSON.stringify(resultPayload),
      JSON.stringify(resultPayload)
    ]);

    await client.query("COMMIT");
    return mapProvisioningJobRow(completedJobResult.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function completeTenantLifecycleJob(job, environment) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const environmentResult = await client.query(`
      SELECT
        e.id,
        e.tenant_id AS "tenantId",
        e.environment_key AS "environmentKey",
        e.display_name AS "displayName",
        e.status,
        e.app_base_url AS "appBaseUrl",
        e.app_host AS "appHost",
        e.web_host AS "webHost",
        e.database_host AS "databaseHost",
        e.database_name AS "databaseName",
        e.database_schema AS "databaseSchema",
        e.current_release_id AS "currentReleaseId",
        e.setup_state AS "setupState",
        t.status AS "tenantStatus",
        t.display_name AS "tenantDisplayName"
      FROM tenant_environments e
      JOIN tenants t ON t.id = e.tenant_id
      WHERE e.id = $1
      LIMIT 1
    `, [environment.id]);
    const current = environmentResult.rows[0];
    if (!current) {
      const error = new Error("Environment not found for tenant lifecycle job.");
      error.code = "environment_not_found";
      throw error;
    }

    const definitions = {
      suspend_tenant: {
        tenantStatus: "suspended",
        environmentStatus: "degraded",
        healthStatus: "suspended",
        eventType: "tenant_suspended",
        message: "Tenant suspended",
        successMessage: "Suspend tenant completed"
      },
      resume_tenant: {
        tenantStatus: "active",
        environmentStatus: "ready",
        healthStatus: "healthy",
        eventType: "tenant_resumed",
        message: "Tenant resumed",
        successMessage: "Resume tenant completed"
      },
      decommission_tenant: {
        tenantStatus: "decommissioned",
        environmentStatus: "archived",
        healthStatus: "decommissioned",
        eventType: "tenant_decommissioned",
        message: "Tenant decommissioned",
        successMessage: "Decommission tenant completed"
      }
    };

    const definition = definitions[job.jobType];
    if (!definition) {
      const error = new Error("Unsupported tenant lifecycle job.");
      error.code = "unsupported_lifecycle_job";
      throw error;
    }

    await client.query(`
      UPDATE tenants
      SET
        status = $2,
        updated_at = NOW()
      WHERE id = $1
    `, [current.tenantId, definition.tenantStatus]);

    const updatedEnvironmentResult = await client.query(`
      UPDATE tenant_environments
      SET
        status = $2,
        last_health_check_at = NOW(),
        last_health_status = $3,
        updated_at = NOW()
      WHERE id = $1
      RETURNING
        id,
        tenant_id AS "tenantId",
        environment_key AS "environmentKey",
        display_name AS "displayName",
        status,
        app_base_url AS "appBaseUrl",
        app_host AS "appHost",
        web_host AS "webHost",
        database_host AS "databaseHost",
        database_name AS "databaseName",
        database_schema AS "databaseSchema",
        current_release_id AS "currentReleaseId",
        setup_state AS "setupState",
        initialized_at AS "initializedAt",
        last_health_check_at AS "lastHealthCheckAt",
        last_health_status AS "lastHealthStatus",
        created_at AS "createdAt",
        updated_at AS "updatedAt"
    `, [current.id, definition.environmentStatus, definition.healthStatus]);

    const jobResultPayload = {
      tenantStatus: definition.tenantStatus,
      environmentStatus: definition.environmentStatus,
      health: definition.healthStatus,
      tenantId: current.tenantId,
      tenantDisplayName: current.tenantDisplayName,
      tenantEnvironmentId: current.id,
      environmentKey: current.environmentKey,
      notes: String(job.payload?.notes || "").trim() || null
    };

    const completedJobResult = await client.query(`
      UPDATE provisioning_jobs
      SET
        status = 'succeeded',
        completed_at = NOW(),
        result_json = $2::jsonb
      WHERE id = $1
      RETURNING
        id,
        tenant_id AS "tenantId",
        tenant_environment_id AS "tenantEnvironmentId",
        job_type AS "jobType",
        status,
        requested_by_operator_user_id AS "requestedByOperatorUserId",
        requested_at AS "requestedAt",
        started_at AS "startedAt",
        completed_at AS "completedAt",
        last_attempt_at AS "lastAttemptAt",
        next_attempt_at AS "nextAttemptAt",
        attempt_count AS "attemptCount",
        max_attempts AS "maxAttempts",
        retry_of_job_id AS "retryOfJobId",
        error_code AS "errorCode",
        error_message AS "errorMessage",
        idempotency_key AS "idempotencyKey",
        payload_json AS "payload",
        result_json AS "result"
    `, [job.id, JSON.stringify(jobResultPayload)]);

    await client.query(`
      INSERT INTO provisioning_job_events (provisioning_job_id, event_type, message, details_json)
      VALUES
        ($1, $2, $3, $4::jsonb),
        ($1, 'succeeded', $5, $6::jsonb)
    `, [
      job.id,
      definition.eventType,
      definition.message,
      JSON.stringify(jobResultPayload),
      definition.successMessage,
      JSON.stringify(jobResultPayload)
    ]);

    await client.query(`
      INSERT INTO operator_audit_log (operator_user_id, action_type, target_type, target_id, tenant_id, details_json)
      VALUES ($1, $2, 'tenant_environment', $3, $4, $5::jsonb)
    `, [
      job.requestedByOperatorUserId || null,
      job.jobType,
      current.id,
      current.tenantId,
      JSON.stringify(jobResultPayload)
    ]);

    await client.query("COMMIT");
    return {
      job: mapProvisioningJobRow(completedJobResult.rows[0]),
      environment: updatedEnvironmentResult.rows[0]
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function retryProvisioningJob(jobId, options = {}, context = {}) {
  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const existingResult = await client.query(`
      SELECT
        id,
        tenant_id AS "tenantId",
        tenant_environment_id AS "tenantEnvironmentId",
        job_type AS "jobType",
        status,
        requested_by_operator_user_id AS "requestedByOperatorUserId",
        requested_at AS "requestedAt",
        started_at AS "startedAt",
        completed_at AS "completedAt",
        last_attempt_at AS "lastAttemptAt",
        next_attempt_at AS "nextAttemptAt",
        attempt_count AS "attemptCount",
        max_attempts AS "maxAttempts",
        retry_of_job_id AS "retryOfJobId",
        error_code AS "errorCode",
        error_message AS "errorMessage",
        idempotency_key AS "idempotencyKey",
        payload_json AS "payload",
        result_json AS "result"
      FROM provisioning_jobs
      WHERE id = $1
      LIMIT 1
      FOR UPDATE
    `, [jobId]);
    const existing = mapProvisioningJobRow(existingResult.rows[0]);
    if (!existing) {
      const error = new Error("Job not found.");
      error.statusCode = 404;
      throw error;
    }
    if (!["failed", "canceled"].includes(existing.status)) {
      const error = new Error("Only failed or canceled jobs can be retried.");
      error.statusCode = 409;
      throw error;
    }

    const retryJobId = `job-${randomUUID()}`;
    const retryResult = await client.query(`
      INSERT INTO provisioning_jobs (
        id,
        tenant_id,
        tenant_environment_id,
        job_type,
        status,
        requested_by_operator_user_id,
        requested_at,
        attempt_count,
        max_attempts,
        next_attempt_at,
        retry_of_job_id,
        idempotency_key,
        payload_json,
        result_json
      )
      VALUES ($1, $2, $3, $4, 'queued', $5, NOW(), 0, $6, NOW(), $7, $8, $9::jsonb, '{}'::jsonb)
      RETURNING
        id,
        tenant_id AS "tenantId",
        tenant_environment_id AS "tenantEnvironmentId",
        job_type AS "jobType",
        status,
        requested_by_operator_user_id AS "requestedByOperatorUserId",
        requested_at AS "requestedAt",
        started_at AS "startedAt",
        completed_at AS "completedAt",
        last_attempt_at AS "lastAttemptAt",
        next_attempt_at AS "nextAttemptAt",
        attempt_count AS "attemptCount",
        max_attempts AS "maxAttempts",
        retry_of_job_id AS "retryOfJobId",
        error_code AS "errorCode",
        error_message AS "errorMessage",
        idempotency_key AS "idempotencyKey",
        payload_json AS "payload",
        result_json AS "result"
    `, [
      retryJobId,
      existing.tenantId || null,
      existing.tenantEnvironmentId || null,
      existing.jobType,
      context.operatorUserId || null,
      normalizeMaxAttempts(options.maxAttempts || existing.maxAttempts || 3),
      existing.id,
      String(options.idempotencyKey || "").trim() || null,
      JSON.stringify(existing.payload || {})
    ]);

    await client.query(`
      INSERT INTO provisioning_job_events (provisioning_job_id, event_type, message, details_json)
      VALUES ($1, 'queued', $2, $3::jsonb)
    `, [
      retryJobId,
      `Retry queued for ${existing.jobType}`,
      JSON.stringify({
        retriedFromJobId: existing.id,
        previousAttemptCount: existing.attemptCount,
        maxAttempts: normalizeMaxAttempts(options.maxAttempts || existing.maxAttempts || 3)
      })
    ]);

    if ((existing.jobType === "provision_environment" || existing.jobType === "deploy_release") && existing.tenantEnvironmentId) {
      await client.query(`
        UPDATE tenant_environments
        SET status = 'provisioning', updated_at = NOW()
        WHERE id = $1
      `, [existing.tenantEnvironmentId]);
    }

    await client.query(`
      INSERT INTO operator_audit_log (operator_user_id, action_type, target_type, target_id, tenant_id, details_json)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    `, [
      context.operatorUserId || null,
      `retry_${existing.jobType}`,
      "provisioning_job",
      retryJobId,
      existing.tenantId || null,
      JSON.stringify({
        retriedFromJobId: existing.id,
        tenantEnvironmentId: existing.tenantEnvironmentId || null,
        maxAttempts: normalizeMaxAttempts(options.maxAttempts || existing.maxAttempts || 3),
        idempotencyKey: String(options.idempotencyKey || "").trim() || null
      })
    ]);

    await client.query("COMMIT");
    return mapProvisioningJobRow(retryResult.rows[0]);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function normalizeMaxAttempts(value) {
  const parsed = Number(value || 3);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 10) return 3;
  return Math.floor(parsed);
}

function stableJson(value) {
  if (Array.isArray(value)) {
    return value.map(stableJson);
  }
  if (value && typeof value === "object") {
    return Object.keys(value).sort().reduce((accumulator, key) => {
      accumulator[key] = stableJson(value[key]);
      return accumulator;
    }, {});
  }
  return value;
}

module.exports = {
  appendProvisioningJobEvent,
  claimNextProvisioningJob,
  completeDeployReleaseJob,
  completeProvisionEnvironmentJob,
  completeSetupTokenJob,
  completeTenantLifecycleJob,
  countOperators,
  createBootstrapOperator,
  createOperatorUser,
  createOperatorSession,
  createTenant,
  createTenantEnvironment,
  getOperatorById,
  getOperatorByUsername,
  getOperatorSessionByTokenHash,
  getProvisioningJobById,
  getTenantById,
  getTenantEnvironmentById,
  listOperators,
  listOperatorAuditLog,
  listSetupSyncCandidates,
  listProvisioningJobEvents,
  listProvisioningJobs,
  listTenantEnvironments,
  listTenants,
  markProvisioningJobFailed,
  markTenantEnvironmentInitialized,
  queueProvisioningJob,
  retryProvisioningJob,
  resolveTenantRuntimeByHost,
  revokeOperatorSessionByTokenHash,
  scheduleProvisioningJobRetry,
  updateOperatorLastLogin,
  updateOperatorUser,
  updateTenant
};
