import { pool } from './src/db/pool.js'
import { parseNaturalPrompt } from './src/services/naturalPromptParser.js'
import { gatherAndStoreEvidence } from './src/services/evidenceGatheringService.js'
import {
  getMeasurementsForItem,
  checkNarrativeConsistency,
} from './src/services/narrativeConsistencyService.js'
import { classifyClaims } from './src/services/claimsClassifierService.js'

let actualAssertionCount = 0
let passedAssertionCount = 0

function assertCheck(desc, condition, details = '') {
  actualAssertionCount++
  if (!condition) {
    throw new Error(`Assertion failed [${actualAssertionCount}]: ${desc} ${details}`)
  }
  passedAssertionCount++
}

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

/**
 * Checks if the content explicitly attributes 200MP to iPhone, or claims iPhone has higher/more megapixels than Galaxy.
 * Uses clause-level and sentence-bounded matching to prevent cross-product attribution false positives.
 */
function checkIPhoneHigherMegapixelClaim(content) {
  if (!content || typeof content !== 'string') return false

  const sentences = content
    .split(/(?<=[.?!])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean)

  for (const sentence of sentences) {
    // 1. Direct comparison in a single sentence: iPhone described as having higher/more/greater megapixels than Galaxy
    if (
      /(?:iphone|apple)(?:(?!(?:galaxy|samsung)).)*?(?:higher|more|greater)\s+(?:megapixels?|mp\b)[^.?!]*?(?:than|compared\s+to)\s+(?:the\s+)?(?:galaxy|samsung)/i.test(
        sentence
      )
    ) {
      return true
    }

    // 2. Clause-level isolation
    const clauses = sentence
      .split(
        /[,;]|\s+(?:while|whereas|but|although|compared\s+to|versus|vs\.?)\s+|\s+and\s+(?=(?:the\s+)?(?:galaxy|samsung|iphone|apple)\b)/i
      )
      .map((c) => c.trim())
      .filter(Boolean)

    for (const clause of clauses) {
      const mentionsIPhone = /(?:iphone|apple)/i.test(clause)
      const mentionsGalaxy = /(?:galaxy|samsung)/i.test(clause)

      // iPhone mentioned, Galaxy NOT mentioned in this clause
      if (mentionsIPhone && !mentionsGalaxy) {
        // iPhone explicitly associated with 200MP
        if (/\b200\s*mp\b/i.test(clause)) {
          return true
        }
        // iPhone explicitly described as having higher/more megapixels
        if (/(?:higher|more|greater)\s+(?:megapixels?|mp\b)/i.test(clause)) {
          return true
        }
      }

      // If both mentioned in the same clause (e.g. without clause delimiters)
      if (mentionsIPhone && mentionsGalaxy) {
        // iPhone explicitly associated with 200MP without Galaxy intervening
        if (
          /(?:iphone|apple)(?:(?!(?:galaxy|samsung)).)*?\b200\s*mp\b/i.test(clause) &&
          !/\b200\s*mp\b[^,;.?!]*?(?:for|in|on|from|by)?\s*(?:the\s+)?(?:galaxy|samsung)/i.test(clause)
        ) {
          return true
        }
        // iPhone explicitly described as having higher/more megapixels without Galaxy intervening
        if (/(?:iphone|apple)(?:(?!(?:galaxy|samsung)).)*?(?:higher|more|greater)\s+(?:megapixels?|mp\b)/i.test(clause)) {
          return true
        }
      }
    }
  }

  return false
}

// ============================================================================
// INDEPENDENT TEST IMPLEMENTATIONS (TESTS 1 - 5)
// ============================================================================

async function runTest1() {
  console.log('\n--- TEST 1: Natural-language product comparison ---')
  console.log('Prompt: "Compare iPhone 17 and Galaxy S26 for camera, battery life and price."')
  const id1 = await createComp({ prompt: 'Compare iPhone 17 and Galaxy S26 for camera, battery life and price.' })
  const res1 = await inspectComp(id1)

  console.log('Identified Items:', res1.items.map((i) => i.name))
  console.log('Criteria:', res1.comparison.criteria)
  console.log('Evidence Sample:')
  res1.evidence.forEach((e) =>
    console.log(`  [${e.item_name}] ${e.criterion}: "${e.result.slice(0, 60)}..." | Source: ${e.source_name} | URL: ${e.source_url}`)
  )

  const unverified1 = res1.evidence.filter((e) => e.result.includes('Reliable source not found'))
  console.log(`Unverified rows in Test 1: ${unverified1.length} (Expected: 0)`)

  console.log('\nComplete AI Analysis Content (Test 1):')
  console.log(res1.analysis?.content || '[No analysis generated]')
  console.log('')

  assertCheck('Test 1: Identified items count is 2', res1.items.length === 2)
  assertCheck('Test 1: Criteria includes Camera, Battery Life, Price', res1.comparison.criteria.length === 3)
  assertCheck('Test 1: Evidence count is 6', res1.evidence.length === 6)
  assertCheck('Test 1: Unverified rows is 0', unverified1.length === 0)
  assertCheck('Test 1: Analysis content exists', Boolean(res1.analysis && res1.analysis.content))

  // Factual battery validation (prose-independent)
  const content = res1.analysis.content
  const galaxyItem = res1.items.find((i) => /galaxy/i.test(i.name))
  const iphoneItem = res1.items.find((i) => /iphone/i.test(i.name))
  const knownItems = [galaxyItem?.name || 'Galaxy S26', iphoneItem?.name || 'iPhone 17']

  const galaxyAssoc = getMeasurementsForItem(content, galaxyItem?.name || 'Galaxy S26', knownItems)
  assertCheck('Test 1: Galaxy S26 has battery measurement in hours', galaxyAssoc.some((m) => m.canonicalUnit === 'hours'))
  assertCheck('Test 1: Galaxy S26 associated with 30 hours', galaxyAssoc.some((m) => m.value === 30 && m.canonicalUnit === 'hours'))
  assertCheck('Test 1: Galaxy S26 not assigned 27 hours', !galaxyAssoc.some((m) => m.value === 27))

  const iphoneAssoc = getMeasurementsForItem(content, iphoneItem?.name || 'iPhone 17', knownItems)
  assertCheck('Test 1: iPhone 17 has battery measurement in hours', iphoneAssoc.some((m) => m.canonicalUnit === 'hours'))
  assertCheck('Test 1: iPhone 17 associated with 27 hours', iphoneAssoc.some((m) => m.value === 27 && m.canonicalUnit === 'hours'))
  assertCheck('Test 1: iPhone 17 not assigned 30 hours', !iphoneAssoc.some((m) => m.value === 30))

  assertCheck(
    'Test 1: Analysis does not claim iPhone has longer battery life',
    !/(?:iphone|apple).*(?:longer|more|better|greater).*(?:battery|runtime)/i.test(content)
  )
  assertCheck(
    'Test 1: Analysis does not claim Galaxy has shorter battery life',
    !/(?:galaxy|samsung).*(?:shorter|less|worse).*(?:battery|runtime)/i.test(content)
  )
  assertCheck(
    'Test 1: Analysis includes battery testing conditions caveat',
    /directly comparable|testing conditions/i.test(content)
  )

  const consistency = checkNarrativeConsistency(content, res1.evidence, res1.items)
  assertCheck('Test 1: Narrative consistency check against evidence has no conflict', !consistency.hasConflict)

  // Negative Controls
  const revCheck = checkNarrativeConsistency(
    'Galaxy S26 battery life is 27 hours, while iPhone 17 battery life is 30 hours.',
    res1.evidence,
    res1.items
  )
  assertCheck('Test 1 NC1: Reversed values flag contradiction', revCheck.hasConflict === true)

  const wrongValCheck = checkNarrativeConsistency(
    'Galaxy S26 battery life is 25 hours, while iPhone 17 battery life is 27 hours.',
    res1.evidence,
    res1.items
  )
  assertCheck('Test 1 NC2: Unsupported battery value flags contradiction', wrongValCheck.hasConflict === true)

  const wrongUnitAssoc = getMeasurementsForItem('Galaxy S26 battery life is 30 days.', 'Galaxy S26', ['Galaxy S26'])
  assertCheck('Test 1 NC3: Wrong unit is not treated as hours', !wrongUnitAssoc.some((m) => m.canonicalUnit === 'hours'))

  const crossAssoc = getMeasurementsForItem('iPhone 17 battery life is 27 hours.', 'Galaxy S26', ['Galaxy S26', 'iPhone 17'])
  assertCheck('Test 1 NC4: iPhone 27h not attributed to Galaxy S26', crossAssoc.length === 0)

  const unvClaims = classifyClaims(
    'Galaxy S26 battery life is 30 hours, while iPhone 17 battery life is 27 hours.',
    res1.items,
    res1.evidence.filter((e) => !/iphone/i.test(e.item_name))
  )
  assertCheck(
    'Test 1 NC5: Unsupported battery claim flagged as unverified',
    unvClaims.some((c) => /iphone/i.test(c.item_name) && c.status === 'potentially_unverified')
  )

  // Camera & limitation checks
  assertCheck('Test 1: Analysis does not claim better camera', !/\b(?:better|superior|best)\s+camera\b/i.test(content))
  assertCheck(
    'Test 1: Analysis includes camera neutrality statement',
    content.includes('Camera quality cannot be determined from megapixel counts and specifications alone')
  )
  assertCheck('Test 1: Analysis includes LIMITATION section', content.includes('LIMITATION:'))
  assertCheck('Test 1: Analysis does not claim iPhone has higher megapixel count', !checkIPhoneHigherMegapixelClaim(content))

  // Claims classifier
  const claims1 = Array.isArray(res1.analysis.claims)
    ? res1.analysis.claims
    : JSON.parse(res1.analysis.claims || '[]')
  const grounded1 = claims1.filter((c) => c.status === 'grounded')
  const unverifiedClaims1 = claims1.filter((c) => c.status !== 'grounded')
  console.log(`Claims Classifier: ${grounded1.length} grounded · ${unverifiedClaims1.length} unverified (Expected: 6 grounded · 0 unverified)\n`)
  assertCheck('Test 1: Claims Classifier grounded count is 6', grounded1.length === 6)
  assertCheck('Test 1: Claims Classifier unverified count is 0', unverifiedClaims1.length === 0)
}

async function runTest2() {
  console.log('--- TEST 2: Natural-language comparison without explicit criteria ---')
  console.log('Prompt: "Which is better for a student, MacBook Air or Dell XPS?"')
  const id2 = await createComp({ prompt: 'Which is better for a student, MacBook Air or Dell XPS?' })
  const res2 = await inspectComp(id2)

  console.log('Identified Items:', res2.items.map((i) => i.name))
  console.log('Inferred Criteria:', res2.comparison.criteria)
  console.log('Evidence Sample:')
  res2.evidence.slice(0, 4).forEach((e) =>
    console.log(`  [${e.item_name}] ${e.criterion}: "${e.result.slice(0, 60)}..." | Source: ${e.source_name} | URL: ${e.source_url}`)
  )

  const unverified2 = res2.evidence.filter((e) => e.result.includes('Reliable source not found'))
  console.log(`Unverified rows in Test 2: ${unverified2.length} (Expected: 0)`)

  console.log('\nComplete AI Analysis Content (Test 2):')
  console.log(res2.analysis?.content || '[No analysis generated]')
  console.log('')

  assertCheck('Test 2: Identified Items count is 2', res2.items.length === 2)
  assertCheck('Test 2: Inferred criteria generated', res2.comparison.criteria.length >= 3)
  assertCheck('Test 2: Inferred criteria includes Battery Life', res2.comparison.criteria.includes('Battery Life'))
  assertCheck('Test 2: Unverified rows is 0', unverified2.length === 0)
  assertCheck('Test 2: Analysis content exists', Boolean(res2.analysis && res2.analysis.content))

  assertCheck(
    'Test 2: Analysis includes equal 18-hour battery comparison',
    res2.analysis.content.includes('Both MacBook Air and Dell XPS are listed at up to 18 hours of battery life')
  )
  assertCheck(
    'Test 2: Analysis includes portability trade-off (2.60 lbs vs 0.44 in)',
    res2.analysis.content.includes('2.60 pounds') && res2.analysis.content.includes('0.44-inch')
  )
  assertCheck(
    'Test 2: Analysis includes display refresh rate trade-off (120Hz)',
    res2.analysis.content.includes('120Hz')
  )
  assertCheck(
    'Test 2: Analysis includes neutral performance statement',
    res2.analysis.content.includes('performance cannot be determined from processor names alone')
  )
  assertCheck(
    'Test 2: Analysis includes starting prices for MacBook Air and Dell XPS',
    res2.analysis.content.includes('1,099') && res2.analysis.content.includes('1,299')
  )
  assertCheck(
    'Test 2: Analysis includes corrected Things to consider for MacBook Air and Dell XPS',
    res2.analysis.content.includes('Both laptops offer distinct trade-offs for student and portable computing')
  )

  // Sub-test 2B: Explicit student focus prompt
  console.log('--- TEST 2B: Explicit student criteria prompt ---')
  const prompt2B = 'Compare MacBook Air and Dell XPS for a student focusing on battery life, portability, performance, display quality and price.'
  console.log(`Prompt: "${prompt2B}"`)
  const id2B = await createComp({ prompt: prompt2B })
  const res2B = await inspectComp(id2B)

  assertCheck(
    'Test 2B: Items length is 2 and matches MacBook / Dell',
    res2B.items.length === 2 && res2B.items.some((i) => /macbook/i.test(i.name)) && res2B.items.some((i) => /dell/i.test(i.name))
  )
  assertCheck('Test 2B: Criteria count is 5', res2B.comparison.criteria.length === 5)
  const unverified2B = res2B.evidence.filter((e) => e.result.includes('Reliable source not found'))
  assertCheck('Test 2B: Unverified rows is 0', unverified2B.length === 0)
  assertCheck(
    'Test 2B: Equal 18-hour battery comparison present',
    res2B.analysis.content.includes('Both MacBook Air and Dell XPS are listed at up to 18 hours of battery life')
  )
  assertCheck(
    'Test 2B: Things to consider present',
    res2B.analysis.content.includes('Both laptops offer distinct trade-offs for student and portable computing')
  )
  console.log('Test 2B verified successfully.\n')
}

async function runTest3() {
  console.log('--- TEST 3: Three-item comparison ---')
  console.log('Prompt: "Compare iPhone 17, Galaxy S26 and Pixel 11 for photography and battery life."')
  const id3 = await createComp({ prompt: 'Compare iPhone 17, Galaxy S26 and Pixel 11 for photography and battery life.' })
  const res3 = await inspectComp(id3)

  console.log('Identified Items (3 subjects):', res3.items.map((i) => i.name))
  console.log('Criteria:', res3.comparison.criteria)
  console.log('Evidence count:', res3.evidence.length)
  res3.evidence.forEach((e) =>
    console.log(`  [${e.item_name}] ${e.criterion}: Source: ${e.source_name} | URL: ${e.source_url}`)
  )

  const unverified3 = res3.evidence.filter((e) => e.result.includes('Reliable source not found'))
  console.log(`Unverified rows in Test 3: ${unverified3.length} (Expected: 0)\n`)

  console.log('Complete AI Analysis Content (Test 3):')
  console.log(res3.analysis?.content || '[No analysis generated]')
  console.log('')

  assertCheck('Test 3: Identified items count is 3', res3.items.length === 3)
  assertCheck('Test 3: Criteria count is 2', res3.comparison.criteria.length === 2)
  assertCheck('Test 3: Evidence count is 6', res3.evidence.length === 6)
  assertCheck('Test 3: Unverified rows is 0', unverified3.length === 0)
  assertCheck('Test 3: iPhone 17 evidence present', res3.evidence.some((e) => /iphone/i.test(e.item_name)))
  assertCheck('Test 3: Galaxy S26 evidence present', res3.evidence.some((e) => /galaxy/i.test(e.item_name)))
  assertCheck('Test 3: Pixel 11 evidence present', res3.evidence.some((e) => /pixel/i.test(e.item_name)))
  assertCheck(
    'Test 3: Narrative consistency check has no conflict',
    !checkNarrativeConsistency(res3.analysis.content, res3.evidence, res3.items).hasConflict
  )
}

async function runTest4() {
  console.log('--- TEST 4: Two real research documents ---')
  const id4 = await createComp({
    prompt: 'Compare these papers and determine which provides stronger evidence.',
    documents: [
      {
        name: 'Attention Is All You Need (NeurIPS 2017)',
        text: 'Section 1: Introduction. We propose the Transformer, an architecture based solely on attention mechanisms... Section 3: Methodology. Multi-head self attention... Section 4: Dataset. WMT 2014 En-De 4.5M pairs... Section 5: Results. 28.4 BLEU... Section 6: Limitations. Quadratic memory complexity O(n^2).',
      },
      {
        name: 'BERT: Pre-training of Deep Bidirectional Transformers (NAACL 2019)',
        text: 'Section 1: Introduction. BERT pre-trains deep bidirectional representations... Section 3: Methodology. Masked Language Model... Section 4: Dataset. BooksCorpus (800M words) and Wikipedia (2,500M words)... Section 5: Results. 80.5% GLUE score... Section 6: Limitations. Discrepancy from MASK tokens and high compute.',
      },
    ],
  })
  const res4 = await inspectComp(id4)

  console.log('Items:', res4.items.map((i) => i.name))
  console.log('Criteria:', res4.comparison.criteria)
  console.log('Document Citations:')
  res4.evidence.forEach((e) =>
    console.log(`  [${e.item_name}] ${e.criterion} -> ${e.source_name} (URL: ${e.source_url})`)
  )
  console.log('Confidence Level:', res4.recommendation.reliability, '| Rationale:', res4.recommendation.reliability_reason, '\n')

  console.log('Complete AI Analysis Content (Test 4):')
  console.log(res4.analysis?.content || '[No analysis generated]')
  console.log('')

  assertCheck('Test 4: Identified items count is 2', res4.items.length === 2)
  assertCheck('Test 4: Criteria count is 5', res4.comparison.criteria.length === 5)
  assertCheck('Test 4: Evidence count is 10', res4.evidence.length === 10)
  assertCheck('Test 4: Document citations present for all rows', res4.evidence.every((e) => Boolean(e.source_name)))
  assertCheck('Test 4: Recommendation reliability is low', res4.recommendation.reliability === 'low')
  assertCheck('Test 4: Recommendation reliability reason present', Boolean(res4.recommendation.reliability_reason))
}

async function runTest5() {
  console.log('--- TEST 5: Document comparison with specific question ---')
  console.log('Question: "Which paper has the stronger methodology?"')
  const id5 = await createComp({
    prompt: 'Which paper has the stronger methodology?',
    documents: [
      { name: 'Research Paper Alpha', text: 'Section 1: Introduction. Section 3: Methodology. Randomized control trial across 500 subjects.' },
      { name: 'Research Paper Beta', text: 'Section 1: Introduction. Section 3: Methodology. Observational cohort study across 1200 participants.' },
    ],
  })
  const res5 = await inspectComp(id5)

  console.log('Question-focused Criteria:', res5.comparison.criteria)
  console.log('Methodology-focused citations:')
  res5.evidence.slice(0, 4).forEach((e) => console.log(`  [${e.item_name}] ${e.criterion} -> ${e.source_name}`))

  console.log('\nComplete AI Analysis Content (Test 5):')
  console.log(res5.analysis?.content || '[No analysis generated]')
  console.log('')

  assertCheck(
    'Test 5: Comparison criteria generated and non-empty',
    Boolean(res5.comparison.criteria && res5.comparison.criteria.length > 0)
  )
  assertCheck('Test 5: Criteria count is at least 3', res5.comparison.criteria.length >= 3)
  assertCheck(
    'Test 5: Evidence citations present',
    res5.evidence.length > 0 && res5.evidence.every((e) => Boolean(e.source_name))
  )
  assertCheck(
    'Test 5: Methodology criterion present',
    res5.comparison.criteria.some((c) => /methodology|study design/i.test(c))
  )
}

// ============================================================================
// MAIN RUNNER
// ============================================================================

async function run() {
  console.log('================================================================')
  console.log('CRITICAL VERIFICATION SUITE — CODE FREEZE TEST SUITE')
  console.log('================================================================')

  const EXPECTED_TEST_COUNT = 5
  const EXPECTED_ASSERTION_COUNT = 60

  const testList = [
    { name: 'Test 1', fn: runTest1 },
    { name: 'Test 2', fn: runTest2 },
    { name: 'Test 3', fn: runTest3 },
    { name: 'Test 4', fn: runTest4 },
    { name: 'Test 5', fn: runTest5 },
  ]

  const testResults = []

  for (const t of testList) {
    try {
      await t.fn()
      testResults.push({ name: t.name, status: 'PASS', error: null })
    } catch (err) {
      testResults.push({ name: t.name, status: 'FAIL', error: err.message })
      console.error(`\n[ERROR in ${t.name}]: ${err.message}\n`)
    }
  }

  const totalPassed = testResults.filter((r) => r.status === 'PASS').length
  const totalFailed = testResults.filter((r) => r.status === 'FAIL').length
  const actualTestCount = testResults.length

  console.log('\n================================================================')
  console.log('CRITICAL VERIFICATION SUITE — FINAL EXECUTION SUMMARY')
  console.log('================================================================')
  for (const r of testResults) {
    console.log(`- ${r.name} result: ${r.status}${r.error ? ` (Error: ${r.error})` : ''}`)
  }
  console.log(`- Total passed: ${totalPassed}`)
  console.log(`- Total failed: ${totalFailed}`)
  console.log(`- Expected test count: ${EXPECTED_TEST_COUNT}`)
  console.log(`- Actual test count: ${actualTestCount}`)
  console.log(`- Expected assertion count: ${EXPECTED_ASSERTION_COUNT}`)
  console.log(`- Actual assertion count: ${actualAssertionCount}`)
  console.log(`- Passed assertion count: ${passedAssertionCount}`)

  const countMismatch =
    actualTestCount !== EXPECTED_TEST_COUNT ||
    actualAssertionCount !== EXPECTED_ASSERTION_COUNT

  if (countMismatch) {
    console.error(
      `\nCOUNT MISMATCH: Expected ${EXPECTED_TEST_COUNT} tests / ${EXPECTED_ASSERTION_COUNT} assertions, but executed ${actualTestCount} tests / ${actualAssertionCount} assertions.`
    )
  }

  if (totalFailed > 0 || countMismatch) {
    console.error('\nCRITICAL SUITE VERIFICATION FAILED.')
    process.exit(1)
  }

  console.log('\n================================================================')
  console.log('ALL CRITICAL TESTS VERIFIED SUCCESSFULLY')
  console.log('================================================================')
  process.exit(0)
}

run().catch((err) => {
  console.error('Fatal runner error:', err)
  process.exit(1)
})
