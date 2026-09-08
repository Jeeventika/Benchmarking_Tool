import { Router } from 'express'
import { pool } from '../db/pool.js'
import { generateAndSaveAnalysis } from '../services/analysisService.js'
import { gatherAndStoreEvidence } from '../services/evidenceGatheringService.js'
import { parseNaturalPrompt } from '../services/naturalPromptParser.js'
import { extractTextFromPdf } from '../services/pdfExtractor.js'

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

// GET /api/comparisons/:id — fetch single comparison with its items
router.get('/:id', async (req, res) => {
  const { id } = req.params

  const client = await pool.connect()
  try {
    const compResult = await client.query('SELECT * FROM comparisons WHERE id = $1', [id])
    if (compResult.rows.length === 0) {
      return res.status(404).json({ error: 'Comparison not found' })
    }

    const itemsResult = await client.query(
      'SELECT * FROM comparison_items WHERE comparison_id = $1 ORDER BY id',
      [id]
    )

    const comparison = compResult.rows[0]
    comparison.items = itemsResult.rows

    res.json(comparison)
  } catch (err) {
    console.error('Failed to get comparison', { message: err.message })
    res.status(500).json({ error: 'Could not load comparison' })
  } finally {
    client.release()
  }
})

// POST /api/comparisons — create a comparison (supports explicit fields or natural language prompt)
router.post('/', async (req, res) => {
  let { item_type, goal, criteria, items, prompt, text, documents } = req.body

  // If uploaded documents are provided (e.g. 2 research papers/reports)
  if (documents && Array.isArray(documents) && documents.length >= 2) {
    item_type = 'research_paper'
    documents = documents.map((d, i) => {
      let docText = d.text || ''
      if (typeof docText === 'string' && (docText.startsWith('data:') || docText.startsWith('%PDF'))) {
        try {
          docText = extractTextFromPdf(docText)
        } catch (pdfErr) {
          console.error('PDF text extraction error', { message: pdfErr.message })
        }
      }
      docText = typeof docText === 'string' ? docText.replace(/\0/g, '').trim() : ''
      const docName = (d.name || d.fileName || `Research Document ${i + 1}`)
        .replace(/\0/g, '')
        .replace(/\.[^/.]+$/, '')
        .trim()
      return {
        ...d,
        name: docName,
        text: docText || '',
      }
    })

    items = documents.map((d, i) => d.name || `Research Document ${i + 1}`)
    goal = goal || `Compare ${items.join(' vs ')} for research methodology, evidence strength, and findings`
    if (prompt && /methodology/i.test(prompt)) {
      criteria = ['Study Design', 'Methodology', 'Dataset & Sample Size', 'Evaluation Approach', 'Limitations']
    } else {
      criteria = criteria && criteria.length >= 1 ? criteria : [
        'Research Objective',
        'Methodology',
        'Dataset & Sample Size',
        'Results & Evaluation',
        'Limitations',
      ]
    }
  } else if ((prompt || text) && (!items || items.length < 2)) {
    // If a natural language prompt or paragraph was submitted, parse it automatically
    const parsed = parseNaturalPrompt(prompt || text)
    if (parsed) {
      item_type = item_type || parsed.item_type
      goal = goal || parsed.goal
      items = items && items.length >= 2 ? items : parsed.items
      criteria = criteria && criteria.length >= 1 ? criteria : parsed.criteria
    }
  }

  if (!item_type || typeof item_type !== 'string' || !item_type.trim()) {
    return res.status(400).json({ error: 'Comparison type is required' })
  }

  if (!goal || typeof goal !== 'string' || !goal.trim()) {
    return res.status(400).json({ error: 'Goal is required' })
  }

  if (!Array.isArray(items) || items.length < 2) {
    return res.status(400).json({ error: 'At least two items are required' })
  }

  const cleanItems = items.map((i) => (typeof i === 'string' ? i.replace(/\0/g, '').trim() : '')).filter(Boolean)
  if (cleanItems.length < 2 || cleanItems.length !== items.length) {
    return res.status(400).json({ error: 'Item names cannot be empty' })
  }

  // Check for duplicate item names
  const lowerItems = cleanItems.map((i) => i.toLowerCase())
  const uniqueItems = new Set(lowerItems)
  if (uniqueItems.size !== cleanItems.length) {
    return res.status(400).json({ error: 'Item names must be unique' })
  }

  if (!Array.isArray(criteria) || criteria.length < 1) {
    return res.status(400).json({ error: 'At least one criterion is required' })
  }

  const cleanCriteria = criteria
    .map((c) => (typeof c === 'string' ? c.replace(/\0/g, '').trim() : ''))
    .filter(Boolean)
  if (cleanCriteria.length < 1 || cleanCriteria.length !== criteria.length) {
    return res.status(400).json({ error: 'Criterion names cannot be empty' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const compResult = await client.query(
      'INSERT INTO comparisons (item_type, goal, criteria) VALUES ($1, $2, $3) RETURNING id',
      [item_type.replace(/\0/g, '').trim(), goal.replace(/\0/g, '').trim(), JSON.stringify(cleanCriteria)]
    )
    const comparisonId = compResult.rows[0].id

    const createdItemIds = []
    for (const name of cleanItems) {
      const itemResult = await client.query(
        'INSERT INTO comparison_items (comparison_id, name) VALUES ($1, $2) RETURNING id',
        [comparisonId, name]
      )
      createdItemIds.push(itemResult.rows[0].id)
    }

    // Initialize recommendation record so downstream workflow is complete
    const firstItemId = createdItemIds[0]
    const defaultReasons = JSON.stringify([
      `Initial option based on user criteria: ${cleanCriteria.join(', ')}`,
      'Detailed evidence and comparability checks can be reviewed in the earlier steps',
    ])
    await client.query(
      `INSERT INTO recommendations (comparison_id, recommended_item_id, reasons, reliability, reliability_reason)
       VALUES ($1, $2, $3, 'medium', $4)`,
      [
        comparisonId,
        firstItemId,
        defaultReasons,
        'Medium — user-created comparison. Review the available details before making your final decision.',
      ]
    )

    await client.query('COMMIT')

    // Automatically gather and store real evidence with citations, comparability checks,
    // and analysis so the comparison is fully populated before redirecting
    try {
      await gatherAndStoreEvidence(comparisonId, documents)
    } catch (evErr) {
      console.error('Evidence auto-gathering failed', { message: evErr.message })
    }

    res.status(201).json({ id: comparisonId })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Failed to create comparison', { message: err.message })
    res.status(500).json({ error: 'Could not create comparison' })
  } finally {
    client.release()
  }
})

export default router
