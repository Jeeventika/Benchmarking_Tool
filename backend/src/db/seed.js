import { readFileSync, readdirSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'
import { pool } from './pool.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const seedsDir = path.join(__dirname, 'seeds')

// Seeding is destructive-but-scoped: it clears only the app tables (never
// touches migration history) so this script can be re-run safely while
// building the demo dataset. TRUNCATE ... CASCADE respects the FK chain.
async function seed() {
  console.log('Clearing existing demo data...')
  await pool.query(
    'TRUNCATE TABLE decisions, recommendations, analyses, comparability_checks, evidence, comparison_items, comparisons RESTART IDENTITY CASCADE'
  )

  const files = readdirSync(seedsDir).filter((f) => f.endsWith('.sql')).sort()
  for (const file of files) {
    const sql = readFileSync(path.join(seedsDir, file), 'utf-8')
    console.log(`Running seed: ${file}`)
    await pool.query(sql)
  }
  console.log('Seeding complete.')
  await pool.end()
}

seed().catch((err) => {
  console.error('Seed failed:', err.message)
  process.exit(1)
})
