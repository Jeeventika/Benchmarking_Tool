import { Router } from 'express'
import { pool } from '../db/pool.js'

const router = Router()

// GET /api/comparisons/:id/decision — the most recent decision recorded for
// this comparison, or null if the user hasn't decided yet. Used so the
// frontend can restore "System Accepted" / "User Override" state after a
// page refresh instead of always re-showing the decision form.
router.get('/:id/decision', async (req, res) => {
  const { id } = req.params
  try {
    const { rows } = await pool.query(
      `SELECT d.id, d.accepted_recommendation, d.chosen_item_id, ci.name AS chosen_item_name,
              d.override_reason, d.override_note, d.created_at
       FROM decisions d
       LEFT JOIN comparison_items ci ON ci.id = d.chosen_item_id
       WHERE d.comparison_id = $1
       ORDER BY d.created_at DESC
       LIMIT 1`,
      [id]
    )
    res.json(rows[0] || null)
  } catch (err) {
    console.error('Failed to load decision', { message: err.message })
    res.status(500).json({ error: 'Could not load decision' })
  }
})

// POST /api/comparisons/:id/decision — record the user's final decision + override reason.
router.post('/:id/decision', async (req, res) => {
  const { id } = req.params
  const { accepted_recommendation, chosen_item_id, override_reason, override_note } = req.body

  if (typeof accepted_recommendation !== 'boolean') {
    return res.status(400).json({ error: 'accepted_recommendation (boolean) is required' })
  }

  try {
    const { rows } = await pool.query(
      `INSERT INTO decisions (comparison_id, accepted_recommendation, chosen_item_id, override_reason, override_note)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [id, accepted_recommendation, chosen_item_id || null, override_reason || null, override_note || null]
    )
    res.status(201).json({ id: rows[0].id })
  } catch (err) {
    console.error('Failed to record decision', { message: err.message })
    res.status(500).json({ error: 'Could not record decision' })
  }
})

export default router
