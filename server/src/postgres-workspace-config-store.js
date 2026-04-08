const { getPostgresPool } = require("./postgres-db");

const WORKSPACE_CONFIG_ID = "default-workspace-config";

async function getWorkspaceConfig() {
  const pool = getPostgresPool();
  const result = await pool.query(`
    SELECT
      config_json AS config,
      updated_at AS "updatedAt"
    FROM workspace_config
    WHERE id = $1
    LIMIT 1
  `, [WORKSPACE_CONFIG_ID]);
  return result.rows[0] || null;
}

async function saveWorkspaceConfig(config) {
  const pool = getPostgresPool();
  const result = await pool.query(`
    INSERT INTO workspace_config (id, config_json, updated_at)
    VALUES ($1, $2::jsonb, NOW())
    ON CONFLICT (id) DO UPDATE SET
      config_json = EXCLUDED.config_json,
      updated_at = NOW()
    RETURNING
      config_json AS config,
      updated_at AS "updatedAt"
  `, [WORKSPACE_CONFIG_ID, JSON.stringify(config || {})]);
  return result.rows[0] || null;
}

module.exports = {
  getWorkspaceConfig,
  saveWorkspaceConfig
};
