import { pool } from '../db/pool.js'
import { generateAnalysis } from './ollamaService.js'

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

      const prompt = `Compare the following ${comparison.item_type || 'options'}: ${itemNames.join(', ')}.\nGoal: ${comparison.goal || 'General comparison'}.\nCriteria: ${criteria.join(', ')}.\nProvide an objective, concise comparison (under 150 words). End your response with "LIMITATION:" followed by any key limitations the user should consider.`

      let content = ''
      let generatedBy = 'ollama'

      try {
        content = await generateAnalysis(prompt)
        if (!content.includes('LIMITATION:')) {
          content += '\n\nLIMITATION: This analysis is based on available information for this comparison. Review individual items and criteria before deciding.'
        }
      } catch (err) {
        // Safe error logging — never log raw prompt or sensitive content
        console.error('Ollama analysis generation failed, using safe fallback')
        generatedBy = 'system_fallback'
        content = `Analysis based on the available information: Comparing ${itemNames.join(' vs. ')} for the goal "${comparison.goal || 'comparison'}" across criteria: ${criteria.join(', ')}.\n\nLIMITATION: Detailed source evidence has not yet been recorded for this newly created comparison.`
      }

      // Check once more in case another thread inserted
      const checkAgain = await getAnalysisForComparison(comparisonId)
      if (checkAgain) return checkAgain

      const { rows } = await pool.query(
        `INSERT INTO analyses (comparison_id, content, disagreement_flag, generated_by)
         VALUES ($1, $2, false, $3)
         RETURNING id, content, disagreement_flag, generated_by, created_at`,
        [comparisonId, content, generatedBy]
      )
      return rows[0] || null
    } finally {
      inFlightGenerations.delete(comparisonId)
    }
  })()

  inFlightGenerations.set(comparisonId, generationPromise)
  return await generationPromise
}

