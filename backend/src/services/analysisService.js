import { pool } from '../db/pool.js'
import { generateAnalysis } from './ollamaService.js'
import { checkNarrativeConsistency } from './narrativeConsistencyService.js'
import {
  buildAnalysisPrompt,
  generateGroundedAnalysisSynthesis,
  validateAndSanitizeAnalysis,
} from './analysisGenerationHelper.js'

// Reads generated analysis for a comparison. Always keep this labeled in
// the UI as "Analysis based on the available evidence" — never presented
// as a source fact.
export async function getAnalysisForComparison(comparisonId) {
  const { rows } = await pool.query(
    `SELECT id, content, disagreement_flag, generated_by, claims, created_at
     FROM analyses
     WHERE comparison_id = $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [comparisonId]
)
    return rows[0] || null
}

const inFlightGenerations = new Map()

// Generates and saves an analysis for a comparison using the existing Ollama pipeline.
export async function generateAndSaveAnalysis(comparisonId) {
  // If an analysis was already saved while waiting, return it immediately
  const existing = await getAnalysisForComparison(comparisonId)
  if (existing) return existing

  // If a generation is already running for this comparison, await the same promise
  if (inFlightGenerations.has(comparisonId)) {
    return await inFlightGenerations.get(comparisonId)
  }

  const generationPromise = (async () => {
    try {
      const compResult = await pool.query(
        'SELECT id, item_type, goal, criteria FROM comparisons WHERE id = $1',
        [comparisonId]
      )
      if (compResult.rows.length === 0) return null
      const comparison = compResult.rows[0]

      const itemsResult = await pool.query(
        'SELECT id, name FROM comparison_items WHERE comparison_id = $1 ORDER BY id',
        [comparisonId]
      )
      const items = itemsResult.rows
      if (items.length === 0) return null

      const itemNames = items.map((i) => i.name)
      const criteria = Array.isArray(comparison.criteria)
        ? comparison.criteria
        : JSON.parse(comparison.criteria || '[]')

      // Fetch evidence rows FIRST to ground the prompt and fallback
      const evidenceResult = await pool.query(
        `SELECT ci.name AS item_name, e.criterion, e.result
         FROM evidence e
         JOIN comparison_items ci ON ci.id = e.comparison_item_id
         WHERE ci.comparison_id = $1
         ORDER BY ci.id, e.criterion, e.id`,
        [comparisonId]
      )
      const evidenceRows = evidenceResult.rows

      const prompt = buildAnalysisPrompt(comparison, items, evidenceRows)

      let content = ''
      let generatedBy = 'ollama'

      try {
        content = await generateAnalysis(prompt)
        content = validateAndSanitizeAnalysis(content, comparison, items, evidenceRows, [])
      } catch (err) {
        // Safe error logging — never log raw prompt or sensitive content
        console.error('Ollama analysis generation failed, using safe fallback')
        generatedBy = 'system_fallback'
        content = generateGroundedAnalysisSynthesis(comparison, items, evidenceRows, [])
      }

      const narrativeCheck = checkNarrativeConsistency(
        content,
        evidenceRows
      )

      const disagreementFlag = narrativeCheck.hasConflict

      // Check once more in case another thread inserted
      const checkAgain = await getAnalysisForComparison(comparisonId)
      if (checkAgain) return checkAgain

      const { rows } = await pool.query(
        `INSERT INTO analyses (comparison_id, content, disagreement_flag, generated_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id, content, disagreement_flag, generated_by, created_at`,
        [comparisonId, content, disagreementFlag, generatedBy]
      )
      return rows[0] || null
    } finally {
      inFlightGenerations.delete(comparisonId)
    }
  })()

  inFlightGenerations.set(comparisonId, generationPromise)
  return await generationPromise
}

