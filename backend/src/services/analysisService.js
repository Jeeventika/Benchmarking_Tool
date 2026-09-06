import { pool } from '../db/pool.js'

// Reads generated analysis for a comparison. Always keep this labeled in
// the UI as "Analysis based on the available evidence" — never presented
// as a source fact. Phase 2 uses seeded synthetic analysis text;
// generated_by is 'synthetic_seed' (not 'ollama') until real Ollama
// integration is wired up in a later phase.
export async function getAnalysisForComparison(comparisonId) {
  const { rows } = await pool.query(
    `SELECT id, content, disagreement_flag, generated_by, created_at
     FROM analyses
     WHERE comparison_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [comparisonId]
  )
  return rows[0] || null
}
