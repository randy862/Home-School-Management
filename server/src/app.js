const express = require("express");
const { app: appConfig } = require("./config");
const { getPool } = require("./db");
const { readState, writeState } = require("./state-store");

const app = express();
app.use(express.json({ limit: "5mb" }));

app.get("/health", async (_req, res) => {
  try {
    const pool = await getPool();
    await pool.request().query("SELECT 1 AS ok");
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

app.get("/api/students", async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        id,
        first_name AS firstName,
        last_name AS lastName,
        birthdate,
        grade,
        age_recorded AS ageRecorded,
        created_at AS createdAt
      FROM dbo.students
      ORDER BY last_name, first_name
    `);
    res.json(result.recordset);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/state", async (_req, res) => {
  try {
    const state = await readState();
    res.json(state);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/state", async (req, res) => {
  try {
    const payload = req.body || {};
    if (!Array.isArray(payload.students)
      || !Array.isArray(payload.subjects)
      || !Array.isArray(payload.courses)
      || !Array.isArray(payload.enrollments)
      || !Array.isArray(payload.plans)
      || !Array.isArray(payload.attendance)
      || !Array.isArray(payload.tests)
      || !payload.settings) {
      return res.status(400).json({ error: "Invalid state payload." });
    }

    await writeState(payload);
    return res.json({ ok: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

app.listen(appConfig.port, () => {
  // Minimal bootstrap log for local operations.
  console.log(`API listening on port ${appConfig.port}`);
});
