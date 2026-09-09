import { Router } from 'express'
import { pool } from '../db/pool.js'
import { getAnalysisForComparison, generateAndSaveAnalysis } from '../services/analysisService.js'
import { generateAnalysis } from '../services/ollamaService.js'

const router = Router()

// GET /api/comparisons/:id/analysis — generated analysis, always clearly
// labeled as "Analysis based on the available evidence" by the caller,
// never presented as a source fact.
router.get('/:id/analysis', async (req, res) => {
  try {
    let analysis = await getAnalysisForComparison(req.params.id)

    if (!analysis) {
      // No stored analysis at all — use the existing generation flow.
      analysis = await generateAndSaveAnalysis(req.params.id)
    } else if (analysis.generated_by === 'fallback' || analysis.generated_by === 'system_fallback') {
      // Stored analysis is a fallback. Attempt to regenerate with Ollama now
      // that it may be available, using the same prompt as generateAndSaveAnalysis.
      try {
        const compResult = await pool.query(
          'SELECT id, item_type, goal, criteria FROM comparisons WHERE id = $1',
          [req.params.id]
        )
        const itemsResult = await pool.query(
          'SELECT id, name FROM comparison_items WHERE comparison_id = $1 ORDER BY id',
          [req.params.id]
        )

        if (compResult.rows.length > 0 && itemsResult.rows.length > 0) {
          const comparison = compResult.rows[0]
          const items = itemsResult.rows
          const itemNames = items.map((i) => i.name)
          const criteria = Array.isArray(comparison.criteria)
            ? comparison.criteria
            : JSON.parse(comparison.criteria || '[]')

          // Same prompt used by generateAndSaveAnalysis in analysisService.js
          const prompt = `Compare the following ${comparison.item_type || 'options'}: ${itemNames.join(', ')}.\nGoal: ${comparison.goal || 'General comparison'}.\nCriteria: ${criteria.join(', ')}.\nProvide an objective, concise comparison (under 150 words). End your response with "LIMITATION:" followed by any key limitations the user should consider.`

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Ollama timeout')), 25000)
          )
          let content = await Promise.race([generateAnalysis(prompt), timeoutPromise])
          if (!content.includes('LIMITATION:')) {
            content += '\n\nLIMITATION: This analysis is based on available information for this comparison. Review individual items and criteria before deciding.'
          }

          // Persist the new Ollama-generated analysis, replacing the stale fallback.
          const { rows } = await pool.query(
            `UPDATE analyses
             SET content = $1, generated_by = 'ollama', created_at = NOW()
             WHERE comparison_id = $2
             RETURNING id, content, disagreement_flag, generated_by, claims, created_at`,
            [content, req.params.id]
          )
          if (rows.length > 0) {
            analysis = rows[0]
          }
        }
      } catch (ollamaErr) {
        // Ollama is unavailable or timed out — return the existing fallback as-is.
        // Safe metadata only — never log raw content.
        console.error('Ollama unavailable during fallback regeneration, returning cached fallback', {
          message: ollamaErr.message,
        })
      }
    }

    if (!analysis) {
      return res.status(404).json({ error: 'No analysis found for this comparison' })
    }
    res.json(analysis)
  } catch (err) {
    console.error('Failed to load analysis', { message: err.message })
    res.status(500).json({ error: 'Could not load analysis' })
  }
})

export default router
