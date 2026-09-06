import { Router } from 'express'
import { getAnalysisForComparison } from '../services/analysisService.js'

const router = Router()

// GET /api/comparisons/:id/analysis — generated analysis, always clearly
// labeled as "Analysis based on the available evidence" by the caller,
// never presented as a source fact.
router.get('/:id/analysis', async (req, res) => {
  try {
    const analysis = await getAnalysisForComparison(req.params.id)
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
