const { getBasePostgresPool } = require("../postgres-db");
const { runWithRequestContext } = require("../request-context");

function createTenantRuntimeContextMiddleware(options) {
  const {
    commercialConfig,
    isPostgresMode
  } = options;

  const controlSchema = qualifySchema(commercialConfig?.controlSchema || "hsm_control_staging");
  const fallbackRuntime = buildFallbackRuntimeContext(commercialConfig);

  return async function tenantRuntimeContextMiddleware(req, res, next) {
    if (!isPostgresMode) {
      req.tenantRuntime = null;
      next();
      return;
    }

    try {
      const runtime = await resolveTenantRuntimeForRequest(req, controlSchema) || fallbackRuntime;
      req.tenantRuntime = runtime || null;
      if (!runtime?.databaseSchema) {
        runWithRequestContext({
          pgClient: null,
          tenantRuntime: runtime || null
        }, () => next());
        return;
      }

      const client = await getBasePostgresPool().connect();
      try {
        await client.query(`SET search_path TO ${quoteIdent(runtime.databaseSchema)}, public`);
      } catch (error) {
        client.release();
        throw error;
      }

      let released = false;
      const releaseClient = () => {
        if (released) return;
        released = true;
        res.off("finish", releaseClient);
        res.off("close", releaseClient);
        client.release();
      };
      res.on("finish", releaseClient);
      res.on("close", releaseClient);

      runWithRequestContext({
        pgClient: client,
        tenantRuntime: runtime
      }, () => next());
    } catch (error) {
      next(error);
    }
  };

  async function resolveTenantRuntimeForRequest(req, schema) {
    const host = normalizeHost(req.headers["x-forwarded-host"] || req.headers.host || "");
    if (!host) return null;

    const pool = getBasePostgresPool();
    const result = await pool.query(`
      WITH matching_domains AS (
        SELECT
          e.id AS "tenantEnvironmentId",
          e.tenant_id AS "tenantId",
          t.slug AS "tenantSlug",
          t.display_name AS "tenantDisplayName",
          e.environment_key AS "environmentKey",
          e.status AS "environmentStatus",
          e.setup_state AS "setupState",
          e.database_schema AS "databaseSchema",
          e.app_base_url AS "appBaseUrl",
          d.domain AS "matchedDomain",
          CASE
            WHEN lower(split_part(split_part(coalesce(e.app_base_url, ''), '://', 2), '/', 1)) = $1 THEN 1
            WHEN lower(split_part(split_part(coalesce(access.tenant_url, ''), '://', 2), '/', 1)) = $1 THEN 2
            WHEN lower(coalesce(d.domain, '')) = $1 THEN 3
            ELSE 9
          END AS "matchRank",
          CASE e.status
            WHEN 'ready' THEN 1
            WHEN 'degraded' THEN 2
            WHEN 'provisioning' THEN 3
            WHEN 'pending' THEN 4
            WHEN 'archived' THEN 5
            ELSE 9
          END AS "statusRank"
        FROM ${schema}.tenant_environments e
        JOIN ${schema}.tenants t
          ON t.id = e.tenant_id
        LEFT JOIN ${schema}.tenant_domains d
          ON d.tenant_id = t.id
        LEFT JOIN ${schema}.provisioning_requests pr
          ON pr.tenant_environment_id = e.id
        LEFT JOIN ${schema}.access_handoffs access
          ON access.provisioning_request_id = pr.id
        WHERE lower(split_part(split_part(coalesce(e.app_base_url, ''), '://', 2), '/', 1)) = $1
          OR lower(split_part(split_part(coalesce(access.tenant_url, ''), '://', 2), '/', 1)) = $1
          OR lower(coalesce(d.domain, '')) = $1
      )
      SELECT *
      FROM matching_domains
      ORDER BY "matchRank" ASC, "statusRank" ASC, "tenantEnvironmentId" DESC
      LIMIT 1
    `, [host]);

    const row = result.rows[0];
    if (!row?.databaseSchema) return null;
    return {
      host,
      tenantId: row.tenantId || "",
      tenantEnvironmentId: row.tenantEnvironmentId || "",
      tenantSlug: row.tenantSlug || "",
      tenantDisplayName: row.tenantDisplayName || "",
      environmentKey: row.environmentKey || "",
      environmentStatus: row.environmentStatus || "",
      setupState: row.setupState || "",
      databaseSchema: row.databaseSchema || "",
      appBaseUrl: row.appBaseUrl || "",
      matchedDomain: row.matchedDomain || ""
    };
  }
}

function normalizeHost(value) {
  const source = String(Array.isArray(value) ? value[0] : value || "").trim().toLowerCase();
  if (!source) return "";
  return source.replace(/:\d+$/, "");
}

function buildFallbackRuntimeContext(commercialConfig) {
  const databaseSchema = parseSchemaFromSearchPath(process.env.PGOPTIONS || "");
  if (!databaseSchema && !commercialConfig?.tenantEnvironmentId && !commercialConfig?.tenantId) return null;
  return {
    host: "",
    tenantId: String(commercialConfig?.tenantId || "").trim(),
    tenantEnvironmentId: String(commercialConfig?.tenantEnvironmentId || "").trim(),
    tenantSlug: "",
    tenantDisplayName: "",
    environmentKey: String(process.env.TENANT_ENVIRONMENT_KEY || "").trim(),
    environmentStatus: "",
    setupState: "",
    databaseSchema,
    appBaseUrl: String(process.env.TENANT_APP_BASE_URL || "").trim(),
    matchedDomain: ""
  };
}

function parseSchemaFromSearchPath(value) {
  const source = String(value || "");
  const match = source.match(/search_path\s*=\s*("?)([a-zA-Z_][a-zA-Z0-9_]*)\1/i);
  return match ? match[2] : "";
}

function qualifySchema(value) {
  const normalized = String(value || "").trim();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(normalized)) {
    throw new Error(`Invalid schema name: ${value}`);
  }
  return `"${normalized}"`;
}

function quoteIdent(value) {
  const normalized = String(value || "").trim();
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(normalized)) {
    throw new Error(`Invalid PostgreSQL identifier: ${value}`);
  }
  return `"${normalized}"`;
}

module.exports = {
  createTenantRuntimeContextMiddleware
};
