const { Pool } = require("pg");
const { postgres } = require("./config");

let pool;

function getPostgresPool() {
  if (!pool) {
    pool = new Pool(postgres);
    pool.on("error", (error) => {
      console.error("Control API PostgreSQL pool error:", error.message);
    });
  }
  return pool;
}

module.exports = {
  getPostgresPool
};
