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
//    for the same item AND criterion in the same sentence/clause.
//  - Does NOT fire merely because the evidence number is absent from narrative.
//  - Does NOT fire for a different item or unrelated criterion.
//  - Does NOT fire on numbers that are part of product/model names (e.g. "S26").
//  - Only inspects evidence rows whose result contains a measurement-style
//    number (accompanied by a unit or percentage).
//  - Never modifies the database — callers are responsible for persistence.
//  - Never logs raw analysis content (safe metadata only).
// ============================================================================

// Units that indicate a result contains a measurement value worth checking.
// This list keeps non-numeric rows (like "iOS 19 with Vision features") out.
const MEASUREMENT_UNIT_PATTERN =
  /\b(\d+(?:\.\d+)?)\s*(hours?|hrs?|wh|gb|tb|mb|ghz|mhz|mp|megapixels?|fps|nits?|ms|mm|cm|kg|lbs?|lb|inches?|in|%|dollars?|\$|usd|eur|mph|km\/h|watts?|mah)\b/i

/**
 * Extract the primary measurement value from an evidence result string.
 * Returns { value, unit } if a measurement is found, or null otherwise.
 *
 * We only proceed for evidence rows that contain explicit units so that
 * product version numbers (e.g. "iOS 19") are not mistaken for measurements.
 *
 * @param {string} result
 * @returns {{ value: number, unit: string }|null}
 */
function extractMeasurementFromEvidence(result) {
  if (!result || typeof result !== 'string') return null
  const m = result.match(MEASUREMENT_UNIT_PATTERN)
  if (!m) return null
  return { value: parseFloat(m[1]), unit: m[2].toLowerCase() }
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
  // Split on '.', '!', '?', ';', or newlines, then trim and lower-case
  return text
    .split(/[.!?;\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => s.length > 0)
}

/**
 * Strip exact digit groups that appear in the item name from a sentence so
 * that model numbers (e.g. "17" from "iPhone 17", "26" from "Galaxy S26")
 * are not counted as measurement numbers.
 *
 * @param {string} sentence  Lower-cased sentence text
 * @param {string} itemName  Original item name (e.g. "Galaxy S26")
 * @returns {string}  Sentence with model-name digits replaced by spaces
 */
function stripModelNumbers(sentence, itemName) {
  const digitGroups = (itemName.match(/\d+/g) || [])
  let result = sentence
  for (const digits of digitGroups) {
    // Only replace the exact digit group when it stands alone (not part of a larger number)
    const re = new RegExp(`(?<!\\d)${digits}(?!\\d)`, 'g')
    result = result.replace(re, ' ')
  }
  return result
}

/**
 * Extract all measurement-unit numbers from a sentence string.
 *
 * @param {string} sentence  Lower-cased, model-digit-stripped sentence
 * @returns {number[]}
 */
function extractMeasurementsFromSentence(sentence) {
  const results = []
  const re = new RegExp(MEASUREMENT_UNIT_PATTERN.source, 'gi')
  let m
  while ((m = re.exec(sentence)) !== null) {
    results.push(parseFloat(m[1]))
  }
  return results
}
/**
 * Check whether a narrative measurement contradicts the evidence value.
 *
 * @param {number} evidenceValue
 * @param {string} sentence
 * @returns {{ contradicted: boolean, narrativeValue: number|null }}
 */
function detectNumericContradiction(evidenceValue, sentence) {
  const measurements = extractMeasurementsFromSentence(sentence)

  if (measurements.length === 0) {
    return {
      contradicted: false,
      narrativeValue: null,
    }
  }

  const tolerance = 0.5

  for (const value of measurements) {
    if (Math.abs(value - evidenceValue) > tolerance) {
      return {
        contradicted: true,
        narrativeValue: value,
      }
    }
  }

  return {
    contradicted: false,
    narrativeValue: null,
  }
}

/**
 * Check whether an AI-generated analysis narrative contradicts structured
 * evidence rows.
 *
 * Algorithm:
 *  1. Split the narrative into individual sentences.
 *  2. For each evidence row that has a measurement-unit value:
 *     a. Find sentences that mention both the item name AND a criterion keyword.
 *     b. Strip model-name digits from those sentences.
 *     c. Extract measurement numbers from the cleaned sentences.
 *     d. If the sentence contains a materially different measurement, flag it.
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

      // Sentence must contain at least one criterion keyword (or we have no criterion context)
      const hasCrit =
        critKeywords.length === 0 || critKeywords.some((kw) => sentence.includes(kw))
      if (!hasCrit) continue

      // Strip model-name digits before extracting measurements
      const cleanedSentence = stripModelNumbers(sentence, item_name)

      // Check for numeric contradiction in this scoped sentence
      const { contradicted, narrativeValue } = detectNumericContradiction(evidenceValue, cleanedSentence)

      if (contradicted) {
        conflicts.push({
          item_name,
          criterion,
          evidence_value: evidenceValue,
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
