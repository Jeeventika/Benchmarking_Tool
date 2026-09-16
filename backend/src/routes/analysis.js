import { Router } from 'express'
import { pool } from '../db/pool.js'
import { getAnalysisForComparison, generateAndSaveAnalysis } from '../services/analysisService.js'
import { generateAnalysis } from '../services/ollamaService.js'
import { checkNarrativeConsistency } from '../services/narrativeConsistencyService.js'
import {
  buildAnalysisPrompt,
  validateAndSanitizeAnalysis,
} from '../services/analysisGenerationHelper.js'

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
      // that it may be available, using the evidence-grounded prompt.
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

          // Fetch evidence rows first to ground the prompt
          const evidenceResult = await pool.query(
            `SELECT ci.name AS item_name, e.criterion, e.result
             FROM evidence e
             JOIN comparison_items ci ON ci.id = e.comparison_item_id
             WHERE ci.comparison_id = $1
             ORDER BY ci.id, e.criterion, e.id`,
            [req.params.id]
          )
          const evidenceRows = evidenceResult.rows

          const prompt = buildAnalysisPrompt(comparison, items, evidenceRows)

          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Ollama timeout')), 25000)
          )
          const rawContent = await Promise.race([generateAnalysis(prompt), timeoutPromise])
          const content = validateAndSanitizeAnalysis(
            rawContent,
            comparison,
            items,
            evidenceRows,
            []
          )

          // Recalculate narrative consistency against the current evidence.
          const narrativeCheck = checkNarrativeConsistency(
            content,
            evidenceRows
          )

          const disagreementFlag = narrativeCheck.hasConflict

          // Persist the new Ollama-generated analysis and refreshed conflict flag.
          const { rows } = await pool.query(
            `UPDATE analyses
             SET content = $1,
                 disagreement_flag = $2,
                 generated_by = 'ollama',
                 created_at = NOW()
             WHERE comparison_id = $3
             RETURNING id, content, disagreement_flag, generated_by, claims, created_at`,
            [content, disagreementFlag, req.params.id]
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