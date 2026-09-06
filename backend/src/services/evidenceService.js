import { pool } from '../db/pool.js'

// Evidence gathering + validation logic.
// Phase 2: reads seeded mock/synthetic evidence from Postgres.
// Real source integration can replace the seed data later without
// changing this interface.

// All evidence for every item in a comparison, grouped by item.
export async function getEvidenceForComparison(comparisonId) {
  const { rows } = await pool.query(
    `SELECT e.id, e.comparison_item_id, ci.name AS item_name, e.criterion, e.result,
            e.source_name, e.source_url, e.source_date, e.method, e.conditions, e.evidence_status,
            e.contamination_risk, e.contamination_reason
     FROM evidence e
     JOIN comparison_items ci ON ci.id = e.comparison_item_id
     WHERE ci.comparison_id = $1
     ORDER BY ci.id, e.criterion, e.id`,
    [comparisonId]
  )
  return rows
}

// Evidence for a single comparison item (used by item-level views).
export async function getEvidenceForItem(comparisonItemId) {
  const { rows } = await pool.query(
    `SELECT id, criterion, result, source_name, source_url, source_date, method, conditions, evidence_status,
            contamination_risk, contamination_reason
     FROM evidence
     WHERE comparison_item_id = $1
     ORDER BY criterion, id`,
    [comparisonItemId]
  )
  return rows
}
