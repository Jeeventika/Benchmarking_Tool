import { pool } from '../db/pool.js'

// Determines Comparable / Partly comparable / Not comparable for each
// criterion in a comparison, and explains why.
// Phase 2: reads seeded comparability checks. The comparison logic itself
// (deciding the status from task/method/date/conditions) still needs a
// human or an automated rule set — for this MVP the checks are authored
// as part of the synthetic demo data, matching the "I am responsible for
// the comparability check" requirement from the spec.
export async function getComparabilityForComparison(comparisonId) {
  const { rows } = await pool.query(
    `SELECT id, criterion, status, explanation
     FROM comparability_checks
     WHERE comparison_id = $1
     ORDER BY criterion`,
    [comparisonId]
  )
  return rows
}
