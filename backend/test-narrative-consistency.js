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

import {
  checkNarrativeConsistency,
  getMeasurementsForItem,
  extractMeasurementsWithContext,
  detectCameraComponent,
} from './src/services/narrativeConsistencyService.js'

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
// REGRESSION SUITE: BUG 1 — Same-sentence product attribution
// Narrative mentions both Galaxy S26 and iPhone 17 in a SINGLE sentence.
// Values (30h, 27h) must be attributed to their respective products.
// The checker must not compare 27h against Galaxy S26 or 30h against iPhone 17.
// ============================================================================
console.log('\n--- BUG 1: Same-sentence multi-product attribution ---')
const bug1A = runCase(
  'BUG 1: Galaxy 30h and iPhone 27h in ONE sentence — no conflict',
  'Galaxy S26 battery life is 30 hours, while iPhone 17 battery life is 27 hours.',
  [
    { item_name: 'Galaxy S26', criterion: 'Battery Life', result: '30 hours' },
    { item_name: 'iPhone 17',  criterion: 'Battery Life', result: '27 hours' },
  ],
  false,
)
assertEqual('BUG 1: No conflicts returned for valid single-sentence multi-product claim', 0, bug1A.conflicts.length)

// Assertions failing if either attribution bug returns a conflict or misses a contradiction:
const bug1B = runCase(
  'BUG 1: Same-sentence Galaxy contradiction detected (25h vs 30h)',
  'Galaxy S26 battery life is 25 hours, while iPhone 17 battery life is 27 hours.',
  [
    { item_name: 'Galaxy S26', criterion: 'Battery Life', result: '30 hours' },
    { item_name: 'iPhone 17',  criterion: 'Battery Life', result: '27 hours' },
  ],
  true,
)
if (bug1B.conflicts.length > 0) {
  assertEqual('BUG 1: Galaxy contradiction narrative_value is 25', 25, bug1B.conflicts[0].narrative_value)
  assertEqual('BUG 1: Galaxy contradiction item_name is Galaxy S26', 'Galaxy S26', bug1B.conflicts[0].item_name)
} else {
  console.error('  ASSERT FAIL: BUG 1 — no conflicts array to inspect')
  failed++
}

const bug1C = runCase(
  'BUG 1: Same-sentence iPhone contradiction detected (20h vs 27h)',
  'Galaxy S26 battery life is 30 hours, while iPhone 17 battery life is 20 hours.',
  [
    { item_name: 'Galaxy S26', criterion: 'Battery Life', result: '30 hours' },
    { item_name: 'iPhone 17',  criterion: 'Battery Life', result: '27 hours' },
  ],
  true,
)
if (bug1C.conflicts.length > 0) {
  assertEqual('BUG 1: iPhone contradiction narrative_value is 20', 20, bug1C.conflicts[0].narrative_value)
  assertEqual('BUG 1: iPhone contradiction item_name is iPhone 17', 'iPhone 17', bug1C.conflicts[0].item_name)
} else {
  console.error('  ASSERT FAIL: BUG 1 — no conflicts array to inspect')
  failed++
}

// ============================================================================
// REGRESSION SUITE: BUG 2 — Camera multi-value attribution
// Narrative: "iPhone 17 has a 48MP main camera, 48MP Ultra Wide, and 12MP telephoto."
// Evidence tested in BOTH formats:
//   Format 1: Separate rows (48MP main camera, 48MP Ultra Wide, 12MP telephoto)
//   Format 2: Single combined string
// Values must be matched by camera component/descriptor so 12MP is not compared
// against 48MP.
// ============================================================================
console.log('\n--- BUG 2: Camera multi-value attribution ---')

// Format 1: Separate rows
const bug2Separate = runCase(
  'BUG 2: Camera multi-value separate rows (48MP main, 48MP ultra-wide, 12MP telephoto) — no conflict',
  'iPhone 17 has a 48MP main camera, 48MP Ultra Wide, and 12MP telephoto.',
  [
    { item_name: 'iPhone 17', criterion: 'Camera', result: '48MP main camera' },
    { item_name: 'iPhone 17', criterion: 'Camera', result: '48MP Ultra Wide'  },
    { item_name: 'iPhone 17', criterion: 'Camera', result: '12MP telephoto'   },
  ],
  false,
)
assertEqual('BUG 2 (separate rows): No conflicts returned for valid multi-value camera claim', 0, bug2Separate.conflicts.length)

// Format 2: Single combined string
const bug2Combined = runCase(
  'BUG 2: Camera multi-value single combined string — no conflict',
  'iPhone 17 has a 48MP main camera, 48MP Ultra Wide, and 12MP telephoto.',
  [
    {
      item_name: 'iPhone 17',
      criterion: 'Camera',
      result: '48MP Fusion main camera, 48MP Ultra Wide, and 12MP 5x Telephoto (120mm equivalent)',
    },
  ],
  false,
)
assertEqual('BUG 2 (combined string): No conflicts returned for valid multi-value camera claim', 0, bug2Combined.conflicts.length)

// Bug 2 Contradiction on main camera (64MP vs 48MP)
const bug2MainContradiction = runCase(
  'BUG 2: Camera main component contradiction detected (64MP vs 48MP)',
  'iPhone 17 has a 64MP main camera, 48MP Ultra Wide, and 12MP telephoto.',
  [
    { item_name: 'iPhone 17', criterion: 'Camera', result: '48MP main camera' },
    { item_name: 'iPhone 17', criterion: 'Camera', result: '48MP Ultra Wide'  },
    { item_name: 'iPhone 17', criterion: 'Camera', result: '12MP telephoto'   },
  ],
  true,
)
if (bug2MainContradiction.conflicts.length > 0) {
  assertEqual('BUG 2: Main camera contradiction narrative_value is 64', 64, bug2MainContradiction.conflicts[0].narrative_value)
  assertEqual('BUG 2: Main camera contradiction evidence_value is 48', 48, bug2MainContradiction.conflicts[0].evidence_value)
} else {
  console.error('  ASSERT FAIL: BUG 2 — no conflicts array to inspect')
  failed++
}

// Bug 2 Contradiction on telephoto (10MP vs 12MP)
const bug2TeleContradiction = runCase(
  'BUG 2: Camera telephoto component contradiction detected (10MP vs 12MP)',
  'iPhone 17 has a 48MP main camera, 48MP Ultra Wide, and 10MP telephoto.',
  [
    { item_name: 'iPhone 17', criterion: 'Camera', result: '48MP main camera' },
    { item_name: 'iPhone 17', criterion: 'Camera', result: '48MP Ultra Wide'  },
    { item_name: 'iPhone 17', criterion: 'Camera', result: '12MP telephoto'   },
  ],
  true,
)
if (bug2TeleContradiction.conflicts.length > 0) {
  assertEqual('BUG 2: Telephoto contradiction narrative_value is 10', 10, bug2TeleContradiction.conflicts[0].narrative_value)
  assertEqual('BUG 2: Telephoto contradiction evidence_value is 12', 12, bug2TeleContradiction.conflicts[0].evidence_value)
} else {
  console.error('  ASSERT FAIL: BUG 2 — no conflicts array to inspect')
  failed++
}

// ============================================================================
// DEDICATED REGRESSION SUITE: REVIEWER ISSUE 1 — Battery Association
//
// Test this exact single sentence:
// "Galaxy S26 battery life is 30 hours, while iPhone 17 battery life is 27 hours."
//
// Verify that:
// - Galaxy S26 is associated with 30 hours.
// - iPhone 17 is associated with 27 hours.
// - The checker does not attribute both values to Galaxy S26.
// - No false warning is produced.
// ============================================================================
console.log('\n--- DEDICATED REGRESSION: REVIEWER ISSUE 1 — Battery Association ---')
const issue1Sentence = 'Galaxy S26 battery life is 30 hours, while iPhone 17 battery life is 27 hours.'
const issue1Items = ['Galaxy S26', 'iPhone 17']
const issue1Evidence = [
  { item_name: 'Galaxy S26', criterion: 'Battery Life', result: '30 hours' },
  { item_name: 'iPhone 17',  criterion: 'Battery Life', result: '27 hours' },
]

// 1. Verify Galaxy S26 is associated with 30 hours
const s26Assoc = getMeasurementsForItem(issue1Sentence, 'Galaxy S26', issue1Items)
assertEqual('Reviewer Issue 1: Galaxy S26 has exactly 1 measurement associated', 1, s26Assoc.length)
assertEqual('Reviewer Issue 1: Galaxy S26 is associated with 30 hours', 30, s26Assoc[0]?.value)
assertEqual('Reviewer Issue 1: Galaxy S26 unit is hours', 'hours', s26Assoc[0]?.canonicalUnit)

// 2. Verify iPhone 17 is associated with 27 hours
const iphoneAssoc = getMeasurementsForItem(issue1Sentence, 'iPhone 17', issue1Items)
assertEqual('Reviewer Issue 1: iPhone 17 has exactly 1 measurement associated', 1, iphoneAssoc.length)
assertEqual('Reviewer Issue 1: iPhone 17 is associated with 27 hours', 27, iphoneAssoc[0]?.value)
assertEqual('Reviewer Issue 1: iPhone 17 unit is hours', 'hours', iphoneAssoc[0]?.canonicalUnit)

// 3. Verify the checker does not attribute both values to Galaxy S26
assertEqual(
  'Reviewer Issue 1: Checker does not attribute both values to Galaxy S26 (27h not in S26 measurements)',
  false,
  s26Assoc.some((m) => m.value === 27)
)
assertEqual(
  'Reviewer Issue 1: Galaxy S26 count is strictly 1 (not 2)',
  true,
  s26Assoc.length === 1 && !s26Assoc.some((m) => m.value === 27)
)

// 4. Verify no false warning is produced
const issue1Result = checkNarrativeConsistency(issue1Sentence, issue1Evidence)
assertEqual('Reviewer Issue 1: No false warning produced (hasConflict is false)', false, issue1Result.hasConflict)
assertEqual('Reviewer Issue 1: No false warning produced (conflicts count is 0)', 0, issue1Result.conflicts.length)
if (!issue1Result.hasConflict && issue1Result.conflicts.length === 0) {
  passed++
}

// ============================================================================
// DEDICATED REGRESSION SUITE: REVIEWER ISSUE 2 — Camera Component Association
//
// Test this exact evidence:
// "iPhone 17 has a 48MP main camera, 48MP Ultra Wide camera, and 12MP telephoto camera."
//
// Verify that:
// - Main camera = 48MP.
// - Ultra Wide camera = 48MP.
// - Telephoto camera = 12MP.
// - The checker does not compare the 12MP telephoto value against only the first 48MP value.
// - Accurate narrative repeating these values is not flagged.
// ============================================================================
console.log('\n--- DEDICATED REGRESSION: REVIEWER ISSUE 2 — Camera Component Association ---')
const issue2EvidenceText = 'iPhone 17 has a 48MP main camera, 48MP Ultra Wide camera, and 12MP telephoto camera.'
const issue2EvidenceRows = [
  { item_name: 'iPhone 17', criterion: 'Camera', result: issue2EvidenceText },
]

// 1. Verify component extraction from exact evidence
const camExtracted = extractMeasurementsWithContext(issue2EvidenceText)
assertEqual('Reviewer Issue 2: Extracted 3 camera measurements', 3, camExtracted.length)

// Main camera = 48MP
const mainCam = camExtracted.find((m) => m.component === 'main')
assertEqual('Reviewer Issue 2: Main camera component detected', true, Boolean(mainCam))
assertEqual('Reviewer Issue 2: Main camera = 48MP', 48, mainCam?.value)
assertEqual('Reviewer Issue 2: Main camera unit = mp', 'mp', mainCam?.canonicalUnit)

// Ultra Wide camera = 48MP
const uwCam = camExtracted.find((m) => m.component === 'ultra_wide')
assertEqual('Reviewer Issue 2: Ultra Wide camera component detected', true, Boolean(uwCam))
assertEqual('Reviewer Issue 2: Ultra Wide camera = 48MP', 48, uwCam?.value)
assertEqual('Reviewer Issue 2: Ultra Wide camera unit = mp', 'mp', uwCam?.canonicalUnit)

// Telephoto camera = 12MP
const teleCam = camExtracted.find((m) => m.component === 'telephoto')
assertEqual('Reviewer Issue 2: Telephoto camera component detected', true, Boolean(teleCam))
assertEqual('Reviewer Issue 2: Telephoto camera = 12MP', 12, teleCam?.value)
assertEqual('Reviewer Issue 2: Telephoto camera unit = mp', 'mp', teleCam?.canonicalUnit)

// 2. Verify the checker does not compare the 12MP telephoto value against only the first 48MP value
// (a) Telephoto alone: 12MP telephoto narrative must match telephoto evidence, NOT be compared against 48MP main
const teleNarrativeResult = checkNarrativeConsistency(
  'The iPhone 17 includes a 12MP telephoto camera.',
  issue2EvidenceRows
)
assertEqual(
  'Reviewer Issue 2: Checker does not compare 12MP telephoto against first 48MP value (no false warning)',
  false,
  teleNarrativeResult.hasConflict
)
assertEqual(
  'Reviewer Issue 2: 12MP telephoto alone produces 0 conflicts',
  0,
  teleNarrativeResult.conflicts.length
)

// (b) Telephoto contradiction: narrative says 10MP telephoto camera
// It must compare against 12MP (the telephoto evidence), NOT 48MP (the first measurement)
const teleContradictResult = checkNarrativeConsistency(
  'The iPhone 17 includes a 10MP telephoto camera.',
  issue2EvidenceRows
)
assertEqual('Reviewer Issue 2: Contradictory 10MP telephoto flags a conflict', true, teleContradictResult.hasConflict)
if (teleContradictResult.conflicts.length > 0) {
  assertEqual(
    'Reviewer Issue 2: Telephoto contradiction compared against 12MP telephoto evidence (NOT 48MP)',
    12,
    teleContradictResult.conflicts[0].evidence_value
  )
  assertEqual(
    'Reviewer Issue 2: Telephoto contradiction narrative_value is 10',
    10,
    teleContradictResult.conflicts[0].narrative_value
  )
} else {
  console.error('  ASSERT FAIL: Reviewer Issue 2 — telephoto contradiction not flagged')
  failed++
}

// 3. Verify accurate narrative repeating these values is not flagged
const exactRepeatingNarrative = 'iPhone 17 has a 48MP main camera, 48MP Ultra Wide camera, and 12MP telephoto camera.'
const repeatResult = checkNarrativeConsistency(exactRepeatingNarrative, issue2EvidenceRows)
assertEqual(
  'Reviewer Issue 2: Accurate narrative repeating values is not flagged (hasConflict is false)',
  false,
  repeatResult.hasConflict
)
assertEqual(
  'Reviewer Issue 2: Accurate narrative repeating values produces 0 conflicts',
  0,
  repeatResult.conflicts.length
)
if (!repeatResult.hasConflict && repeatResult.conflicts.length === 0) {
  passed++
}

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
