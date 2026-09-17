import { pool } from '../db/pool.js'
import { gatherAndStoreEvidence } from './evidenceGatheringService.js'

// Determines Comparable / Partly comparable / Not comparable for each
// criterion in a comparison, and explains why.
export async function getComparabilityForComparison(comparisonId) {
  let { rows } = await pool.query(
    `SELECT id, criterion, status, explanation
     FROM comparability_checks
     WHERE comparison_id = $1
     ORDER BY criterion`,
    [comparisonId]
  )

  if (rows.length === 0) {
    const gathered = await gatherAndStoreEvidence(comparisonId)
    if (gathered) {
      const requery = await pool.query(
        `SELECT id, criterion, status, explanation
         FROM comparability_checks
         WHERE comparison_id = $1
         ORDER BY criterion`,
        [comparisonId]
      )
      rows = requery.rows
    }
  }

  return rows
}
