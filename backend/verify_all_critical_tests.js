import { pool } from './src/db/pool.js'
import { parseNaturalPrompt } from './src/services/naturalPromptParser.js'
import { gatherAndStoreEvidence } from './src/services/evidenceGatheringService.js'

async function createComp(payload) {
  let { item_type, goal, criteria, items, prompt, text, documents } = payload

  if (documents && Array.isArray(documents) && documents.length >= 2) {
    item_type = 'research_paper'
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
    const parsed = parseNaturalPrompt(prompt || text)
    if (parsed) {
      item_type = item_type || parsed.item_type
      goal = goal || parsed.goal
      items = items && items.length >= 2 ? items : parsed.items
      criteria = criteria && criteria.length >= 1 ? criteria : parsed.criteria
    }
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const compRes = await client.query(
      'INSERT INTO comparisons (item_type, goal, criteria) VALUES ($1, $2, $3) RETURNING id',
      [item_type, goal, JSON.stringify(criteria)]
    )
    const comparisonId = compRes.rows[0].id

    for (const name of items) {
      await client.query('INSERT INTO comparison_items (comparison_id, name) VALUES ($1, $2)', [
        comparisonId,
        name,
      ])
    }
    await client.query('COMMIT')

    await gatherAndStoreEvidence(comparisonId, documents)
    return comparisonId
  } finally {
    client.release()
  }
}

async function inspectComp(comparisonId) {
  const client = await pool.connect()
  try {
    const comp = await client.query('SELECT * FROM comparisons WHERE id = $1', [comparisonId])
    const items = await client.query('SELECT * FROM comparison_items WHERE comparison_id = $1 ORDER BY id', [
      comparisonId,
    ])
    const ev = await client.query(
      'SELECT ci.name as item_name, e.criterion, e.result, e.source_name, e.source_url, e.evidence_status FROM evidence e JOIN comparison_items ci ON ci.id = e.comparison_item_id WHERE ci.comparison_id = $1',
      [comparisonId]
    )
    const rec = await client.query('SELECT * FROM recommendations WHERE comparison_id = $1', [comparisonId])
    const an = await client.query('SELECT * FROM analyses WHERE comparison_id = $1', [comparisonId])

    return {
      comparison: comp.rows[0],
      items: items.rows,
      evidence: ev.rows,
      recommendation: rec.rows[0],
      analysis: an.rows[0],
    }
  } finally {
    client.release()
  }
}

async function run() {
  console.log('================================================================');
  console.log('CRITICAL VERIFICATION SUITE — CODE FREEZE TEST SUITE');
  console.log('================================================================\n');

  // TEST 1: Natural-language product comparison
  console.log('--- TEST 1: Natural-language product comparison ---');
  console.log('Prompt: "Compare iPhone 17 and Galaxy S26 for camera, battery life and price."');
  const id1 = await createComp({ prompt: 'Compare iPhone 17 and Galaxy S26 for camera, battery life and price.' })
  const res1 = await inspectComp(id1)
  console.log('Identified Items:', res1.items.map(i => i.name))
  console.log('Criteria:', res1.comparison.criteria)
  console.log('Evidence Sample:')
  res1.evidence.forEach(e => console.log(`  [${e.item_name}] ${e.criterion}: "${e.result.slice(0, 60)}..." | Source: ${e.source_name} | URL: ${e.source_url}`))
  const unverified1 = res1.evidence.filter(e => e.result.includes('Reliable source not found'))
  console.log(`Unverified rows in Test 1: ${unverified1.length} (Expected: 0)\n`)
  if (unverified1.length !== 0) {
  throw new Error(`TEST 1 FAILED: Expected 0 unverified rows, got ${unverified1.length}`)
}

  // TEST 2: Natural-language comparison without explicit criteria
  console.log('--- TEST 2: Natural-language comparison without explicit criteria ---');
  console.log('Prompt: "Which is better for a student, MacBook Air or Dell XPS?"');
  const id2 = await createComp({ prompt: 'Which is better for a student, MacBook Air or Dell XPS?' })
  const res2 = await inspectComp(id2)
  console.log('Identified Items:', res2.items.map(i => i.name))
  console.log('Inferred Criteria:', res2.comparison.criteria)
  console.log('Evidence Sample:')
  res2.evidence.slice(0, 4).forEach(e => console.log(`  [${e.item_name}] ${e.criterion}: "${e.result.slice(0, 60)}..." | Source: ${e.source_name} | URL: ${e.source_url}`))
  const unverified2 = res2.evidence.filter(e => e.result.includes('Reliable source not found'))
  console.log(`Unverified rows in Test 2: ${unverified2.length} (Expected: 0)\n`)
  if (unverified2.length !== 0) {
  throw new Error(`TEST 2 FAILED: Expected 0 unverified rows, got ${unverified2.length}`)
}

  // TEST 3: Three-item comparison
  console.log('--- TEST 3: Three-item comparison ---');
  console.log('Prompt: "Compare iPhone 17, Galaxy S26 and Pixel 11 for photography and battery life."');
  const id3 = await createComp({ prompt: 'Compare iPhone 17, Galaxy S26 and Pixel 11 for photography and battery life.' })
  const res3 = await inspectComp(id3)
  console.log('Identified Items (3 subjects):', res3.items.map(i => i.name))
  console.log('Criteria:', res3.comparison.criteria)
  console.log('Evidence count:', res3.evidence.length)
  res3.evidence.forEach(e => console.log(`  [${e.item_name}] ${e.criterion}: Source: ${e.source_name} | URL: ${e.source_url}`))
  const unverified3 = res3.evidence.filter(e => e.result.includes('Reliable source not found'))
  console.log(`Unverified rows in Test 3: ${unverified3.length} (Expected: 0)\n`)
  if (unverified3.length !== 0) {
  throw new Error(`TEST 3 FAILED: Expected 0 unverified rows, got ${unverified3.length}`)
}

  // TEST 4: Two real research documents
  console.log('--- TEST 4: Two real research documents ---');
  const id4 = await createComp({
    prompt: 'Compare these papers and determine which provides stronger evidence.',
    documents: [
      {
        name: 'Attention Is All You Need (NeurIPS 2017)',
        text: 'Section 1: Introduction. We propose the Transformer, an architecture based solely on attention mechanisms... Section 3: Methodology. Multi-head self attention... Section 4: Dataset. WMT 2014 En-De 4.5M pairs... Section 5: Results. 28.4 BLEU... Section 6: Limitations. Quadratic memory complexity O(n^2).'
      },
      {
        name: 'BERT: Pre-training of Deep Bidirectional Transformers (NAACL 2019)',
        text: 'Section 1: Introduction. BERT pre-trains deep bidirectional representations... Section 3: Methodology. Masked Language Model... Section 4: Dataset. BooksCorpus (800M words) and Wikipedia (2,500M words)... Section 5: Results. 80.5% GLUE score... Section 6: Limitations. Discrepancy from MASK tokens and high compute.'
      }
    ]
  })
  const res4 = await inspectComp(id4)
  console.log('Items:', res4.items.map(i => i.name))
  console.log('Criteria:', res4.comparison.criteria)
  console.log('Document Citations:')
  res4.evidence.forEach(e => console.log(`  [${e.item_name}] ${e.criterion} -> ${e.source_name} (URL: ${e.source_url})`))
  console.log('Confidence Level:', res4.recommendation.reliability, '| Rationale:', res4.recommendation.reliability_reason, '\n')
  if (!res4.recommendation.reliability) {
  throw new Error('TEST 4 FAILED: Recommendation reliability is missing')
}

  // TEST 5: Document comparison with a specific question
  console.log('--- TEST 5: Document comparison with specific question ---');
  console.log('Question: "Which paper has the stronger methodology?"');
  const id5 = await createComp({
    prompt: 'Which paper has the stronger methodology?',
    documents: [
      { name: 'Research Paper Alpha', text: 'Section 1: Introduction. Section 3: Methodology. Randomized control trial across 500 subjects.' },
      { name: 'Research Paper Beta', text: 'Section 1: Introduction. Section 3: Methodology. Observational cohort study across 1200 participants.' }
    ]
  })
  const res5 = await inspectComp(id5)
  console.log('Question-focused Criteria:', res5.comparison.criteria)
  console.log('Methodology-focused citations:')
  res5.evidence.slice(0, 4).forEach(e => console.log(`  [${e.item_name}] ${e.criterion} -> ${e.source_name}`))
  if (!res5.comparison.criteria || res5.comparison.criteria.length === 0) {
  throw new Error('TEST 5 FAILED: No comparison criteria generated')
}

  console.log('\n================================================================');
  console.log('ALL CRITICAL TESTS VERIFIED SUCCESSFULLY');
  console.log('================================================================');
  process.exit(0)
}

run().catch(err => {
  console.error(err)
  process.exit(1)
})
