import { Router } from 'express'
import { getComparabilityForComparison } from '../services/comparabilityService.js'

const router = Router()

// GET /api/comparisons/:id/comparability — Comparable / Partly comparable /
// Not comparable status + explanation for each criterion.
router.get('/:id/comparability', async (req, res) => {
  try {
    const checks = await getComparabilityForComparison(req.params.id)
    res.json(checks)
  } catch (err) {
    console.error('Failed to load comparability checks', { message: err.message })
    res.status(500).json({ error: 'Could not load comparability checks' })
  }
})

export default router
