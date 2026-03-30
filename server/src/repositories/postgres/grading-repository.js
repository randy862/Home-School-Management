function createGradingRepository(deps) {
  const { getPostgresPool } = deps;

  return {
    getGradingCriteria: async () => {
      const pool = getPostgresPool();
      const result = await pool.query(`
        SELECT
          id,
          letter_scale_json AS "letterScale",
          gpa_scale_option AS "gpaScaleOption",
          gpa_max AS "gpaMax"
        FROM grading_criteria
        ORDER BY id
        LIMIT 1
      `);
      const row = result.rows[0];
      if (!row) {
        return {
          letterScale: [],
          gpaScaleOption: "4",
          gpaMax: 4
        };
      }

      return {
        letterScale: Array.isArray(row.letterScale) ? row.letterScale : [],
        gpaScaleOption: row.gpaScaleOption || "4",
        gpaMax: row.gpaMax == null ? 4 : Number(row.gpaMax)
      };
    },

    listGradeTypes: async () => {
      const pool = getPostgresPool();
      const result = await pool.query(`
        SELECT
          id,
          name,
          weight
        FROM grade_types
        ORDER BY lower(name)
      `);
      return result.rows.map((row) => ({
        ...row,
        weight: row.weight == null ? null : Number(row.weight)
      }));
    },

    replaceGradeTypes: async (gradeTypes) => {
      const pool = getPostgresPool();
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("DELETE FROM grade_types");
        const saved = [];
        for (const gradeType of gradeTypes) {
          const result = await client.query(`
            INSERT INTO grade_types (id, name, weight)
            VALUES ($1, $2, $3)
            RETURNING
              id,
              name,
              weight
          `, [gradeType.id, gradeType.name, gradeType.weight]);
          saved.push({
            ...result.rows[0],
            weight: result.rows[0].weight == null ? null : Number(result.rows[0].weight)
          });
        }
        await client.query("COMMIT");
        return saved.sort((a, b) => a.name.localeCompare(b.name));
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },

    saveGradingCriteria: async (criteria) => {
      const pool = getPostgresPool();
      const existing = await pool.query("SELECT id FROM grading_criteria ORDER BY id LIMIT 1");
      const id = existing.rows[0]?.id || "default-grading-criteria";
      const result = await pool.query(`
        INSERT INTO grading_criteria (id, letter_scale_json, gpa_scale_option, gpa_max)
        VALUES ($1, $2::jsonb, $3, $4)
        ON CONFLICT (id) DO UPDATE SET
          letter_scale_json = EXCLUDED.letter_scale_json,
          gpa_scale_option = EXCLUDED.gpa_scale_option,
          gpa_max = EXCLUDED.gpa_max
        RETURNING
          letter_scale_json AS "letterScale",
          gpa_scale_option AS "gpaScaleOption",
          gpa_max AS "gpaMax"
      `, [id, JSON.stringify(criteria.letterScale || []), criteria.gpaScaleOption, criteria.gpaMax]);
      return {
        letterScale: Array.isArray(result.rows[0].letterScale) ? result.rows[0].letterScale : [],
        gpaScaleOption: result.rows[0].gpaScaleOption || "4",
        gpaMax: result.rows[0].gpaMax == null ? 4 : Number(result.rows[0].gpaMax)
      };
    }
  };
}

module.exports = {
  createGradingRepository
};
