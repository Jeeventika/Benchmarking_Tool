import { pool } from './src/db/pool.js'

async function check() {
  for (const id of [34, 35, 36]) {
    const { rows } = await pool.query(
      'SELECT ci.name, e.criterion, e.result, e.source_name, e.evidence_status FROM evidence e JOIN comparison_items ci ON ci.id = e.comparison_item_id WHERE ci.comparison_id = $1',
      [id]
    )
    console.log(`=== Comp ID ${id} ===`)
    rows.forEach((r) => console.log(`  ${r.name} | ${r.criterion} -> ${r.result} | ${r.source_name}`))
  }
  process.exit(0)
}

check()
