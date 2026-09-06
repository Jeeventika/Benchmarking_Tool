import { Router } from 'express'
import { pool } from '../db/pool.js'

const router = Router()

// GET /api/comparisons — list comparisons (skeleton: reads real table, returns empty until Phase 3 adds data)
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, item_type, goal, criteria, created_at FROM comparisons ORDER BY created_at DESC'
    )
    res.json(rows)
  } catch (err) {
    console.error('Failed to list comparisons', { message: err.message })
    res.status(500).json({ error: 'Could not load comparisons' })
  }
})

// GET /api/comparisons/:id — a single comparison plus its items.
router.get('/:id', async (req, res) => {
  const { id } = req.params

  try {
    const comparisonResult = await pool.query(
      'SELECT id, item_type, goal, criteria, created_at FROM comparisons WHERE id = $1',
      [id]
    )
    if (comparisonResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comparison not found' })
    }

    const itemsResult = await pool.query(
      'SELECT id, name FROM comparison_items WHERE comparison_id = $1 ORDER BY id',
      [id]
    )

    res.json({ ...comparisonResult.rows[0], items: itemsResult.rows })
  } catch (err) {
    console.error('Failed to load comparison', { message: err.message })
    res.status(500).json({ error: 'Could not load comparison' })
  }
})

// POST /api/comparisons — create a comparison (item_type, goal, criteria, item names)
// Full validation + evidence gathering wired up in Phase 3.
router.post('/', async (req, res) => {
  const { item_type, goal, criteria, items } = req.body

  if (!item_type || !Array.isArray(items) || items.length < 2) {
    return res.status(400).json({ error: 'item_type and at least two items are required' })
  }

  try {
    const { rows } = await pool.query(
      'INSERT INTO comparisons (item_type, goal, criteria) VALUES ($1, $2, $3) RETURNING id',
      [item_type, goal || null, JSON.stringify(criteria || [])]
    )
    const comparisonId = rows[0].id

    for (const name of items) {
      await pool.query('INSERT INTO comparison_items (comparison_id, name) VALUES ($1, $2)', [
        comparisonId,
        name,
      ])
    }

    res.status(201).json({ id: comparisonId })
  } catch (err) {
    console.error('Failed to create comparison', { message: err.message })
    res.status(500).json({ error: 'Could not create comparison' })
  }
})

export default router
