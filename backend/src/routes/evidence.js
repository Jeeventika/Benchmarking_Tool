import { Router } from 'express'
import { getEvidenceForComparison } from '../services/evidenceService.js'

const router = Router()

// GET /api/comparisons/:id/evidence — evidence for every item in a comparison.
router.get('/:id/evidence', async (req, res) => {
  try {
    const evidence = await getEvidenceForComparison(req.params.id)
    res.json(evidence)
  } catch (err) {
    console.error('Failed to load evidence', { message: err.message })
    res.status(500).json({ error: 'Could not load evidence' })
  }
})

export default router
