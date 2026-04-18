const { Pool } = require("pg");
const { postgres } = require("./config");
const { getRequestPgClient } = require("./request-context");

let pool;
let requestAwarePool;

function getBasePostgresPool() {
  if (!pool) {
    pool = new Pool(postgres);
    pool.on("error", (error) => {
      console.error("PostgreSQL pool error:", error.message);
    });
  }
  return pool;
}

function getPostgresPool() {
  if (!requestAwarePool) {
    requestAwarePool = {
      query(...args) {
        const client = getRequestPgClient();
        if (client) return client.query(...args);
        return getBasePostgresPool().query(...args);
      },
      async connect() {
        const client = getRequestPgClient();
        if (!client) return getBasePostgresPool().connect();
        return {
          query: (...args) => client.query(...args),
          release: () => {},
        };
      },
      on(...args) {
        return getBasePostgresPool().on(...args);
      },
      end(...args) {
        return getBasePostgresPool().end(...args);
      }
    };
  }
  return requestAwarePool;
}

module.exports = {
  getBasePostgresPool,
  getPostgresPool
};
