// ============================================================================
// test-narrative-consistency.js
//
// Focused unit tests for the numeric consistency checker.
//
// Run from the backend directory:
//   node ".\test-narrative-consistency.js"
//
// Exits with code 0 when all assertions pass.
// Exits with code 1 on the first failure, printing FAIL with expected/actual.
// ============================================================================

import { checkNarrativeConsistency } from './src/services/narrativeConsistencyService.js'

let passed = 0
let failed = 0

/**
 * Assert that two values are strictly equal.
 * Prints PASS or FAIL with full expected/actual detail.
 *
 * @param {string} label
 * @param {*} expected
 * @param {*} actual
 */
function assertEqual(label, expected, actual) {
  if (expected === actual) {
    console.log(`  ASSERT PASS: ${label}`)
  } else {
    console.error(`  ASSERT FAIL: ${label}`)
    console.error(`    Expected: ${JSON.stringify(expected)}`)
    console.error(`    Actual:   ${JSON.stringify(actual)}`)
    failed++
  }
}

/**
 * Run a single named test case.
 *
 * @param {string} name           Human-readable case description
 * @param {string} analysisText   The generated analysis text
 * @param {Array}  evidenceRows   Evidence rows ({ item_name, criterion, result })
 * @param {boolean} expectConflict  Whether hasConflict should be true
 */
function runCase(name, analysisText, evidenceRows, expectConflict) {
  const result = checkNarrativeConsistency(analysisText, evidenceRows)
  const label = expectConflict ? 'conflict' : 'no conflict'
  const ok = result.hasConflict === expectConflict

  if (ok) {
    console.log(`PASS: ${name} — ${label}`)
    passed++
  } else {
    console.error(`FAIL: ${name}`)
    console.error(`  Expected hasConflict: ${expectConflict}`)
    console.error(`  Actual   hasConflict: ${result.hasConflict}`)
    if (result.conflicts.length > 0) {
      console.error(`  Conflicts: ${JSON.stringify(result.conflicts, null, 2)}`)
    }
    failed++
  }
  return result
}

// ============================================================================
// CASE 1 — NO CONFLICT: Galaxy 30 h vs iPhone 27 h (different items)
// ============================================================================
console.log('\n--- CASE 1: Two products, matching values, no conflict ---')
runCase(
  'Galaxy 30 hours vs iPhone 27 hours — no conflict',
  'The Galaxy S26 offers 30 hours of battery life. The iPhone 17 provides 27 hours of battery life.',
  [
    { item_name: 'Galaxy S26', criterion: 'Battery Life', result: '30 hours' },
    { item_name: 'iPhone 17',  criterion: 'Battery Life', result: '27 hours' },
  ],
  false,
)

// ============================================================================
// CASE 2 — NO CONFLICT: Galaxy battery 30 h and camera 200 MP (same item, different criteria)
// ============================================================================
console.log('\n--- CASE 2: Same item, two criteria, matching values, no conflict ---')
runCase(
  'Galaxy S26 battery 30 hours vs camera 200 MP — no conflict',
  'The Galaxy S26 has 30 hours of battery life and a 200 MP camera.',
  [
    { item_name: 'Galaxy S26', criterion: 'Battery Life', result: '30 hours' },
    { item_name: 'Galaxy S26', criterion: 'Camera',       result: '200 MP'   },
  ],
  false,
)

// ============================================================================
// CASE 3 — CONFLICT: Galaxy battery evidence 30 h, analysis says 26 h
// This also tests that model-number '26' in 'Galaxy S26' is NOT confused
// with measurement '26 hours'.
// ============================================================================
console.log('\n--- CASE 3: Analysis says 26 hours vs evidence 30 hours — conflict ---')
const case3 = runCase(
  'Galaxy S26 battery 26 hours vs evidence 30 hours — conflict',
  'The Galaxy S26 provides 26 hours of battery life.',
  [
    { item_name: 'Galaxy S26', criterion: 'Battery Life', result: '30 hours' },
  ],
  true,
)
// Extra assertion: the detected narrative value must be 26, not some other number
if (case3.conflicts.length > 0) {
  assertEqual(
    'Case 3 narrative_value is 26',
    26,
    case3.conflicts[0].narrative_value,
  )
} else {
  // Already failed above; count additional assertion as failed for completeness
  console.error('  ASSERT FAIL: Case 3 — no conflicts array to inspect')
  failed++
}

// ============================================================================
// CASE 4 — CONFLICT: Galaxy battery evidence 30 h, analysis says 25.5 h
// Tests decimal preservation — 25.5 must not be split into 25 and 5.
// ============================================================================
console.log('\n--- CASE 4: Analysis says 25.5 hours vs evidence 30 hours — conflict ---')
const case4 = runCase(
  'Galaxy S26 battery 25.5 hours vs evidence 30 hours — conflict',
  'The Galaxy S26 delivers 25.5 hours of battery life.',
  [
    { item_name: 'Galaxy S26', criterion: 'Battery Life', result: '30 hours' },
  ],
  true,
)
if (case4.conflicts.length > 0) {
  assertEqual(
    'Case 4 narrative_value is 25.5 (decimal preserved)',
    25.5,
    case4.conflicts[0].narrative_value,
  )
} else {
  console.error('  ASSERT FAIL: Case 4 — no conflicts array to inspect')
  failed++
}

// ============================================================================
// ORIGINAL CASE — CONFLICT: Galaxy battery evidence 30 h, analysis says 25 h
// ============================================================================
console.log('\n--- ORIGINAL CASE: Analysis says 25 hours vs evidence 30 hours — conflict ---')
const caseOrig = runCase(
  'Galaxy S26 battery 25 hours vs evidence 30 hours — conflict',
  'The Galaxy S26 offers 25 hours of battery life.',
  [
    { item_name: 'Galaxy S26', criterion: 'Battery Life', result: '30 hours' },
  ],
  true,
)
if (caseOrig.conflicts.length > 0) {
  assertEqual(
    'Original case narrative_value is 25',
    25,
    caseOrig.conflicts[0].narrative_value,
  )
} else {
  console.error('  ASSERT FAIL: Original case — no conflicts array to inspect')
  failed++
}

// ============================================================================
// CONTROL CASE — NO CONFLICT: Galaxy battery 30 h matches evidence 30 h
// ============================================================================
console.log('\n--- CONTROL CASE: Analysis says 30 hours vs evidence 30 hours — no conflict ---')
runCase(
  'Galaxy S26 battery 30 hours vs evidence 30 hours — no conflict',
  'The Galaxy S26 provides 30 hours of battery life.',
  [
    { item_name: 'Galaxy S26', criterion: 'Battery Life', result: '30 hours' },
  ],
  false,
)

// ============================================================================
// EXTRA CASE A — NO FALSE POSITIVE: camera MP must not trigger battery conflict
// Analysis mentions battery correctly (30 h) and camera (200 MP).
// Evidence only has battery. The camera MP value must not trigger a battery hit.
// ============================================================================
console.log('\n--- EXTRA A: Camera 200 MP must not trigger battery conflict ---')
runCase(
  'Camera MP value must not compare against battery hours evidence — no conflict',
  'The Galaxy S26 has 200 MP camera and 30 hours of battery life.',
  [
    { item_name: 'Galaxy S26', criterion: 'Battery Life', result: '30 hours' },
  ],
  false,
)

// ============================================================================
// EXTRA CASE B — NO FALSE POSITIVE: model number 26 must not be treated as
// a measurement.  Analysis says "Galaxy S26" but no numeric measurement that
// contradicts evidence.
// ============================================================================
console.log('\n--- EXTRA B: Model number 26 in item name must not be treated as battery life ---')
runCase(
  'Galaxy S26 model number — 26 not treated as battery life — no conflict',
  'The Galaxy S26 leads in battery performance.',
  [
    { item_name: 'Galaxy S26', criterion: 'Battery Life', result: '30 hours' },
  ],
  false,
)

// ============================================================================
// EXTRA CASE C — SOURCE-TO-SOURCE: two evidence records disagree about
// Galaxy S26 battery life.  The checker only checks narrative vs evidence,
// so it returns no conflict if the narrative is absent.
// (Source-to-source disagreement is detected by other services.)
// ============================================================================
console.log('\n--- EXTRA C: Source-to-source disagreement — checker sees no narrative conflict ---')
const caseC = runCase(
  'Source-to-source disagreement (no narrative) — no narrative conflict',
  // No analysis content that mentions battery life hours at all
  'The Galaxy S26 is a premium smartphone with advanced features.',
  [
    { item_name: 'Galaxy S26', criterion: 'Battery Life', result: '30 hours' },
    { item_name: 'Galaxy S26', criterion: 'Battery Life', result: '27 hours' },
  ],
  false,
)

// ============================================================================
// EXTRA CASE D — SOURCE-TO-SOURCE + NARRATIVE CONFLICT: narrative says 25 h,
// one source says 30 h.  The checker must still flag the narrative conflict.
// ============================================================================
console.log('\n--- EXTRA D: Narrative conflicts with one of two disagreeing sources ---')
runCase(
  'Narrative 25 h with source disagreement (30 h / 27 h) — narrative conflict detected',
  'The Galaxy S26 provides 25 hours of battery life.',
  [
    { item_name: 'Galaxy S26', criterion: 'Battery Life', result: '30 hours' },
    { item_name: 'Galaxy S26', criterion: 'Battery Life', result: '27 hours' },
  ],
  true,
)

// ============================================================================
// EXTRA CASE E — NO FALSE POSITIVE: iPhone 17 analysis correct,
// Galaxy evidence only.  Must not trigger a cross-item conflict.
// ============================================================================
console.log('\n--- EXTRA E: iPhone 17 27 h must not conflict with Galaxy 30 h evidence ---')
runCase(
  'iPhone 17 27 hours correct — no conflict with Galaxy evidence',
  'The iPhone 17 delivers 27 hours of battery life.',
  [
    { item_name: 'Galaxy S26', criterion: 'Battery Life', result: '30 hours' },
  ],
  false,
)

// ============================================================================
// Summary
// ============================================================================
console.log('\n================================================================')
if (failed === 0) {
  console.log(`ALL ${passed} TESTS PASSED`)
  console.log('================================================================')
  process.exit(0)
} else {
  console.error(`${failed} TEST(S) FAILED, ${passed} passed`)
  console.error('================================================================')
  process.exit(1)
}
