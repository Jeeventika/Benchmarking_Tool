// ============================================================================
// narrativeConsistencyService.js
//
// Checks whether an AI-generated analysis narrative contradicts structured
// evidence rows.  This service is intentionally SEPARATE from the structured
// evidence grounding / comparability checks — it only inspects the free-text
// narrative for numeric/factual contradictions against known evidence values.
//
// Rules:
//  - Only fires when the narrative makes a comparable numeric/factual claim
//    for the same item AND criterion AND unit in the same sentence/clause.
//  - Does NOT fire merely because the evidence number is absent from narrative.
//  - Does NOT fire for a different item or unrelated criterion.
//  - Does NOT fire for a different unit (e.g. camera MP vs battery hours).
//  - Does NOT strip measurement values that happen to share digits with a
//    model name.  Model number stripping is context-aware: digits are only
//    masked when they appear as part of the model-name token (immediately
//    preceded by the letter prefix of the item name), not when they appear
//    as a standalone measurement followed by a unit.
//  - Only inspects evidence rows whose result contains a measurement-style
//    number accompanied by a unit or percentage.
//  - Never modifies the database — callers are responsible for persistence.
//  - Never logs raw analysis content (safe metadata only).
// ============================================================================

// ---------------------------------------------------------------------------
// Unit alias groups
// Each group contains unit strings that should be treated as the same unit.
// ---------------------------------------------------------------------------
const UNIT_ALIAS_GROUPS = [
  ['hours', 'hour', 'hrs', 'hr'],
  ['mp', 'megapixels', 'megapixel'],
  ['mah'],
  ['gb'],
  ['tb'],
  ['mb'],
  ['ghz'],
  ['mhz'],
  ['fps'],
  ['nits', 'nit'],
  ['ms'],
  ['mm'],
  ['cm'],
  ['kg'],
  ['lbs', 'lb'],
  ['inches', 'inch', 'in'],
  ['%'],
  ['dollars', 'dollar', '$', 'usd'],
  ['eur'],
  ['mph'],
  ['km/h'],
  ['watts', 'watt', 'w', 'wh'],
]

// Build a lookup: unit string -> canonical unit string (first entry of its group)
const UNIT_CANONICAL = new Map()
for (const group of UNIT_ALIAS_GROUPS) {
  const canonical = group[0]
  for (const alias of group) {
    UNIT_CANONICAL.set(alias, canonical)
  }
}

/**
 * Return the canonical unit string for a given raw unit token, or null if
 * the unit is not in the known alias map.
 *
 * @param {string} rawUnit
 * @returns {string|null}
 */
function canonicalUnit(rawUnit) {
  if (!rawUnit) return null
  return UNIT_CANONICAL.get(rawUnit.toLowerCase().trim()) ?? null
}

// Measurement pattern: decimal-aware number followed by a known unit.
// Captures group 1 = number (including optional decimal), group 2 = unit token.
// The number must NOT be preceded by another digit (to avoid matching
// mid-number substrings), and the unit must be a word boundary match.
const MEASUREMENT_UNIT_PATTERN =
  /(?<!\d)(\d+(?:\.\d+)?)\s*(hours?|hrs?|wh|gb|tb|mb|ghz|mhz|mp|megapixels?|fps|nits?|ms|mm|cm|kg|lbs?|lb|inches?|in|%|dollars?|\$|usd|eur|mph|km\/h|watts?|mah)\b/gi

/**
 * Extract the primary measurement value and its canonical unit from an
 * evidence result string.  Returns { value, canonicalUnit } if a measurement
 * is found, or null otherwise.
 *
 * We only proceed for evidence rows that contain explicit units so that
 * product version numbers (e.g. "iOS 19") are not mistaken for measurements.
 *
 * @param {string} result
 * @returns {{ value: number, canonicalUnit: string }|null}
 */
function extractMeasurementFromEvidence(result) {
  if (!result || typeof result !== 'string') return null
  const re = new RegExp(MEASUREMENT_UNIT_PATTERN.source, 'gi')
  const m = re.exec(result)
  if (!m) return null
  const cu = canonicalUnit(m[2])
  if (!cu) return null
  return { value: parseFloat(m[1]), canonicalUnit: cu }
}

/**
 * Split a narrative into sentence-level clauses so we can scope checks to
 * individual sentences and avoid cross-item contamination.
 *
 * Splits on sentence-ending punctuation, newlines, and semicolons.
 *
 * @param {string} text
 * @returns {string[]}  Array of lower-cased clause strings
 */
function splitIntoSentences(text) {
  // Split on sentence-ending punctuation, newlines, and semicolons.
  // A period is treated as a sentence boundary ONLY when it is NOT surrounded
  // by digits on both sides (to preserve decimal values like 25.5).
  // Strategy: replace "safe" sentence-end punctuation with a placeholder,
  // then split on the placeholder.
  const SENTINEL = '\x00'
  const processed = text
    // Newlines and semicolons are always sentence boundaries
    .replace(/[\n;!?]+/g, SENTINEL)
    // Period is a sentence boundary only when NOT between two digits
    .replace(/(?<!\d)\.(?!\d)/g, SENTINEL)
    // Also treat a period followed by a space + capital as a sentence boundary
    // (e.g. "life. The" even though we work in lowercase later)
    .replace(/\.(?=\s)/g, SENTINEL)
  return processed
    .split(SENTINEL)
    .map((s) => s.replace(/\.$/, '').trim().toLowerCase())
    .filter((s) => s.length > 0)
}

/**
 * Build a regex pattern that matches the item-name token containing the
 * given digit group.  This is used to mask only the model-name occurrence
 * of those digits, not standalone measurement occurrences.
 *
 * For "Galaxy S26" the digit group is "26".  We build a pattern that matches
 * "s26" (the letter-prefix + digits) and replaces just the digit part with
 * spaces, leaving standalone "26 hours" untouched.
 *
 * Strategy:
 *   1. Find the sub-token in the item name that immediately precedes the digit
 *      group (the "letter prefix", e.g. "s" in "S26").
 *   2. In the sentence, replace occurrences where those digits appear right
 *      after that letter prefix.
 *
 * If the digit group appears at the very start of the item name (no letter
 * prefix) we do NOT strip it, because we cannot safely distinguish the model
 * number from a measurement value in that case.
 *
 * @param {string} sentence   Lower-cased sentence text
 * @param {string} itemName   Original item name (e.g. "Galaxy S26")
 * @returns {string}  Sentence with model-name digit occurrences masked
 */
function stripModelNumbers(sentence, itemName) {
  const itemLower = itemName.toLowerCase()

  // Find each digit group in the item name along with its letter prefix
  // Example: "galaxy s26" -> [{ digits: '26', letterPrefix: 's' }]
  //          "iphone 17"  -> [{ digits: '17', letterPrefix: ' ' }] (space, skip)
  //          "pixel 11"   -> [{ digits: '11', letterPrefix: ' ' }] (skip)
  const tokenRe = /([a-z]+)(\d+)/g
  let result = sentence
  let m
  while ((m = tokenRe.exec(itemLower)) !== null) {
    const letterPrefix = m[1]   // e.g. 's' from 's26'
    const digits = m[2]         // e.g. '26'

    // Only strip when the digits immediately follow a known letter prefix from
    // the item name.  We require at least one letter before the digits.
    if (!letterPrefix || letterPrefix.length === 0) continue

    // Replace occurrences of <letterPrefix><digits> with <letterPrefix><spaces>
    // in the sentence.  The digit portion is blanked; the letter prefix stays
    // so keyword matching (e.g. "s" in "galaxy s26") is not disrupted.
    const re = new RegExp(`(?<=[a-z]*)${letterPrefix}${digits}(?!\\d)`, 'g')
    result = result.replace(re, letterPrefix + ' '.repeat(digits.length))
  }
  return result
}

/**
 * Extract all measurement-unit pairs (value + canonical unit) from a sentence.
 * Returns an array of { value, canonicalUnit } objects.
 *
 * @param {string} sentence  Lower-cased sentence text
 * @returns {Array<{ value: number, canonicalUnit: string }>}
 */
function extractMeasurementsFromSentence(sentence) {
  const results = []
  const re = new RegExp(MEASUREMENT_UNIT_PATTERN.source, 'gi')
  let m
  while ((m = re.exec(sentence)) !== null) {
    const cu = canonicalUnit(m[2])
    if (cu) {
      results.push({ value: parseFloat(m[1]), canonicalUnit: cu })
    }
  }
  return results
}

/**
 * Check whether any measurement in the (cleaned) sentence contradicts the
 * evidence value, using strict unit matching.
 *
 * Only measurements whose canonical unit matches the evidence canonical unit
 * are compared.  Measurements with a different unit are ignored entirely.
 *
 * @param {number} evidenceValue
 * @param {string} evidenceCanonicalUnit
 * @param {string} cleanedSentence
 * @returns {{ contradicted: boolean, narrativeValue: number|null }}
 */
function detectNumericContradiction(evidenceValue, evidenceCanonicalUnit, cleanedSentence) {
  const measurements = extractMeasurementsFromSentence(cleanedSentence)

  // No measurements found — no contradiction
  if (measurements.length === 0) {
    return { contradicted: false, narrativeValue: null }
  }

  const tolerance = 0.5

  for (const { value, canonicalUnit: cu } of measurements) {
    // Strict unit match — skip if units differ
    if (cu !== evidenceCanonicalUnit) continue

    // Same unit: check if the value materially differs from the evidence
    if (Math.abs(value - evidenceValue) > tolerance) {
      return { contradicted: true, narrativeValue: value }
    }
  }

  return { contradicted: false, narrativeValue: null }
}

/**
 * Check whether an AI-generated analysis narrative contradicts structured
 * evidence rows.
 *
 * Algorithm:
 *  1. Split the narrative into individual sentences.
 *  2. For each evidence row that has a measurement-unit value:
 *     a. Find sentences that mention both the item name AND a criterion keyword.
 *     b. Strip model-name letter+digit tokens from those sentences (context-aware).
 *     c. Extract measurement numbers+units from the cleaned sentences.
 *     d. Compare only measurements whose unit matches the evidence unit.
 *     e. If the sentence contains a materially different same-unit measurement, flag it.
 *
 * Structured evidence grounding (comparability checks, source verification,
 * evidence_status flags) is handled separately by other services and is
 * NOT repeated here.
 *
 * @param {string} analysisText  Full text of the generated analysis
 * @param {Array}  evidenceRows  Array of evidence row objects, each with:
 *                                 { item_name, criterion, result, ... }
 * @returns {{ hasConflict: boolean, conflicts: Array }}
 */
export function checkNarrativeConsistency(analysisText, evidenceRows) {
  // Guard: if either input is missing, there is nothing to compare
  if (!analysisText || typeof analysisText !== 'string' || analysisText.trim().length === 0) {
    return { hasConflict: false, conflicts: [] }
  }
  if (!Array.isArray(evidenceRows) || evidenceRows.length === 0) {
    return { hasConflict: false, conflicts: [] }
  }

  // Split the narrative once, lowercased, for all row checks
  const sentences = splitIntoSentences(analysisText)

  const conflicts = []

  for (const row of evidenceRows) {
    const { item_name, criterion, result } = row

    // Skip rows without the required fields
    if (!item_name || !criterion || !result) continue

    // Only inspect evidence rows that contain a measurement-style number with
    // an explicit unit.  This prevents product version numbers (e.g. iOS 19,
    // Galaxy S26) from being treated as measurement values.
    const measurement = extractMeasurementFromEvidence(String(result))
    if (!measurement) continue

    const evidenceValue = measurement.value
    const evidenceCU = measurement.canonicalUnit
    const itemLower = item_name.toLowerCase()

    // Criterion keywords (skip very short/common words)
    const critKeywords = criterion
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2 && !['and', 'the', 'for', 'are'].includes(w))

    // ── For each sentence, check: does it reference BOTH the item AND the criterion?
    for (const sentence of sentences) {
      // Sentence must contain the item name
      if (!sentence.includes(itemLower)) continue

      // Sentence must contain at least one criterion keyword
      const hasCrit =
        critKeywords.length === 0 || critKeywords.some((kw) => sentence.includes(kw))
      if (!hasCrit) continue

      // Strip model-name letter+digit tokens before extracting measurements.
      // This removes e.g. "s26" but preserves "26 hours".
      const cleanedSentence = stripModelNumbers(sentence, item_name)

      // Check for numeric contradiction — strict unit matching
      const { contradicted, narrativeValue } = detectNumericContradiction(
        evidenceValue,
        evidenceCU,
        cleanedSentence,
      )

      if (contradicted) {
        conflicts.push({
          item_name,
          criterion,
          evidence_value: evidenceValue,
          evidence_unit: evidenceCU,
          narrative_value: narrativeValue,
        })
        break  // one conflict per evidence row is sufficient
      }
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  }
}
