import { Router } from 'express'
import { getRecommendationForComparison } from '../services/recommendationService.js'

const router = Router()

// GET /api/comparisons/:id/recommendation — recommended option + reliability.
router.get('/:id/recommendation', async (req, res) => {
  try {
    const recommendation = await getRecommendationForComparison(req.params.id)
    if (!recommendation) {
      return res.status(404).json({ error: 'No recommendation found for this comparison' })
    }
    res.json(recommendation)
  } catch (err) {
    console.error('Failed to load recommendation', { message: err.message })
    res.status(500).json({ error: 'Could not load recommendation' })
  }
})

export default router
