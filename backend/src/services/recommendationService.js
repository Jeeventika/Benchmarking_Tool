import { pool } from '../db/pool.js'

// Generates a ranked recommendation + reliability score from validated evidence.
// Phase 2: reads the seeded demo recommendation. Automated generation from
// live evidence is a later phase — this keeps the interface the frontend
// depends on stable while that logic is built out.
export async function getRecommendationForComparison(comparisonId) {
  const { rows } = await pool.query(
    `SELECT r.id, r.recommended_item_id, ci.name AS recommended_item_name,
            r.reasons, r.reliability, r.reliability_reason, r.scorecard
     FROM recommendations r
     LEFT JOIN comparison_items ci ON ci.id = r.recommended_item_id
     WHERE r.comparison_id = $1`,
    [comparisonId]
  )
  return rows[0] || null
}
