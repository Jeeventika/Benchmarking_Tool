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
//  - Multi-product sentences: accurately attributes measurements to the
//    governing item based on token order, clause conjunctions, and proximity,
//    preventing cross-item false contradictions in combined sentences.
//  - Multi-value criteria (e.g. camera systems): matches measurements by
//    component descriptors (main, ultra_wide, telephoto, front, macro, depth)
//    across multi-row and combined-string evidence rows without cross-component
//    conflict.
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
 * Detect camera component descriptor from surrounding context phrase.
 * Returns normalized component identifier:
 *   'ultra_wide' | 'telephoto' | 'front' | 'macro' | 'depth' | 'main' | null
 *
 * @param {string} text
 * @returns {string|null}
 */
export function detectCameraComponent(text) {
  if (!text || typeof text !== 'string') return null
  const lower = text.toLowerCase()
  // Check ultra-wide first so 'wide' doesn't greedily capture 'ultra wide'
  if (/\b(?:ultra[-\s]?wide|ultrawide)\b/i.test(lower)) return 'ultra_wide'
  if (/\b(?:telephoto|tele|periscope|zoom)\b/i.test(lower)) return 'telephoto'
  if (/\b(?:front|selfie)\b/i.test(lower)) return 'front'
  if (/\b(?:macro)\b/i.test(lower)) return 'macro'
  if (/\b(?:depth|tof|lidar)\b/i.test(lower)) return 'depth'
  if (/\b(?:main|primary|fusion|wide)\b/i.test(lower)) return 'main'
  return null
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
  const SENTINEL = '\x00'
  const processed = text
    // Newlines and semicolons are always sentence boundaries
    .replace(/[\n;!?]+/g, SENTINEL)
    // Period is a sentence boundary only when NOT between two digits
    .replace(/(?<!\d)\.(?!\d)/g, SENTINEL)
    // Also treat a period followed by a space + capital as a sentence boundary
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
 * spaces, leaving standalone "26 hours" untouched and character offsets unchanged.
 *
 * @param {string} sentence   Lower-cased sentence text
 * @param {string} itemName   Original item name (e.g. "Galaxy S26")
 * @returns {string}  Sentence with model-name digit occurrences masked
 */
function stripModelNumbers(sentence, itemName) {
  if (!sentence || typeof sentence !== 'string') return ''
  if (!itemName || typeof itemName !== 'string') return sentence
  const itemLower = itemName.toLowerCase()
  const tokenRe = /([a-z]+)(\d+)/g
  let result = sentence
  let m
  while ((m = tokenRe.exec(itemLower)) !== null) {
    const letterPrefix = m[1]
    const digits = m[2]
    if (!letterPrefix || letterPrefix.length === 0) continue
    const re = new RegExp(`(?<=[a-z]*)${letterPrefix}${digits}(?!\\d)`, 'gi')
    result = result.replace(re, (match) => match.slice(0, letterPrefix.length) + ' '.repeat(digits.length))
  }
  return result
}

/**
 * Extract all measurement-unit pairs along with their canonical unit,
 * character range, and surrounding component context from a text string.
 *
 * @param {string} text
 * @returns {Array<{ value: number, canonicalUnit: string, component: string|null, startIndex: number, endIndex: number, phrase: string }>}
 */
export function extractMeasurementsWithContext(text) {
  const results = []
  const re = new RegExp(MEASUREMENT_UNIT_PATTERN.source, 'gi')
  let m
  while ((m = re.exec(text)) !== null) {
    const cu = canonicalUnit(m[2])
    if (!cu) continue

    const beforeText = text.slice(0, m.index)
    const afterText = text.slice(m.index + m[0].length)

    // Backward delimiter: comma, semicolon, clause conjunctions
    const delimBefore = /[,;]|\b(?:and|or|while|whereas|with)\b/gi
    let lastBeforeIndex = 0
    let dm
    while ((dm = delimBefore.exec(beforeText)) !== null) {
      lastBeforeIndex = dm.index + dm[0].length
    }
    const phraseStart = lastBeforeIndex

    // Forward delimiter: comma, semicolon, period, clause conjunctions
    const delimAfter = /[,;.]|\b(?:and|or|while|whereas|with)\b/gi
    const afterMatch = delimAfter.exec(afterText)
    const phraseEnd = afterMatch
      ? m.index + m[0].length + afterMatch.index
      : text.length

    const phrase = text.slice(phraseStart, phraseEnd).trim()
    const comp = detectCameraComponent(phrase)

    results.push({
      value: parseFloat(m[1]),
      canonicalUnit: cu,
      component: comp,
      startIndex: m.index,
      endIndex: m.index + m[0].length,
      phrase,
    })
  }
  return results
}

/**
 * Backward compatibility helper for callers expecting single measurement.
 *
 * @param {string} result
 * @returns {{ value: number, canonicalUnit: string }|null}
 */
function extractMeasurementFromEvidence(result) {
  if (!result || typeof result !== 'string') return null
  const measurements = extractMeasurementsWithContext(result)
  return measurements.length > 0 ? measurements[0] : null
}

const NON_MODEL_WORDS = new Set([
  'battery', 'camera', 'display', 'price', 'screen', 'specs', 'weight',
  'hours', 'life', 'offers', 'provides', 'lists', 'has', 'is', 'for',
  'with', 'and', 'while', 'whereas', 'at', 'in', 'on', 'reports',
  'continuous', 'video', 'playback', 'starting', 'msrp', 'baseline',
  'capacity', 'resolution', 'chassis', 'enclosure', 'unibody'
])

/**
 * Discovers potential product and entity names mentioned in a given text string,
 * incorporating both explicit known item names and recognized brand/model patterns.
 *
 * @param {string} text
 * @param {Array<string|{name: string}>} existingNames
 * @returns {string[]}
 */
export function discoverEntitiesInText(text, existingNames = []) {
  if (!text || typeof text !== 'string') return (existingNames || []).map((n) => (typeof n === 'string' ? n : n?.name)).filter(Boolean)
  const discovered = new Set(
    (existingNames || [])
      .map((n) => (typeof n === 'string' ? n.toLowerCase() : n?.name?.toLowerCase()))
      .filter(Boolean)
  )
  const result = [...(existingNames || [])]
    .map((n) => (typeof n === 'string' ? n : n?.name))
    .filter(Boolean)

  const brandPattern = /\b(iPhone|Galaxy|Pixel|MacBook|Dell|ThinkPad|iPad|Surface)\s+([A-Za-z0-9]+(?:\s+(?:Pro(?:\s+Max)?|Ultra|Plus|Max|Air|Mini|FE|Fold|Flip|XPS|\d+))?)\b/gi
  let m
  while ((m = brandPattern.exec(text)) !== null) {
    const raw = m[0].trim()
    const lower = raw.toLowerCase()
    if (!discovered.has(lower)) {
      discovered.add(lower)
      result.push(raw)
    }
  }

  return result
}

/**
 * Determine which measurements in a sentence belong to a specific target item.
 * Accurately handles same-sentence multi-product comparisons by attributing
 * measurements to the governing product mention based on word order,
 * contrastive clause boundaries (e.g. ", while "), and proximity.
 *
 * @param {string} sentence
 * @param {string} targetItemName
 * @param {string[]} allItemNames
 * @returns {Array<{ value: number, canonicalUnit: string, component: string|null, startIndex: number, endIndex: number, phrase: string }>}
 */
export function getMeasurementsForItem(sentence, targetItemName, allItemNames) {
  if (!sentence || typeof sentence !== 'string') return []
  if (!targetItemName || typeof targetItemName !== 'string') return []

  const targetLower = targetItemName.toLowerCase()
  const sentLower = sentence.toLowerCase()
  if (!sentLower.includes(targetLower)) return []

  // Ensure allItemNames includes targetItemName and any discovered entities in this sentence
  const passedItems = Array.isArray(allItemNames) && allItemNames.length > 0 ? allItemNames : [targetItemName]
  const itemsInSentence = discoverEntitiesInText(sentence, passedItems)

  // Clean model numbers for all known items so model tokens (e.g. s26) do not interfere
  let cleaned = sentLower
  for (const item of itemsInSentence) {
    cleaned = stripModelNumbers(cleaned, item)
  }

  const measurements = extractMeasurementsWithContext(cleaned)
  if (measurements.length === 0) return []

  const otherItems = itemsInSentence
    .map((n) => (typeof n === 'string' ? n.toLowerCase() : n?.name?.toLowerCase()))
    .filter((n) => n && n !== targetLower && sentLower.includes(n))

  // If no other products appear in the sentence, ensure measurements in disconnected
  // contrastive clauses (e.g. ", while ... 27 hours") are NOT falsely attributed to target
  if (otherItems.length === 0) {
    const targetIdx = sentLower.indexOf(targetLower)
    const targetEnd = targetIdx + targetLower.length

    return measurements.filter((m) => {
      if (targetEnd <= m.startIndex) {
        const textBetween = sentLower.slice(targetEnd, m.startIndex)
        if (/[,;]?\s*\b(?:while|whereas|although|though|but|compared\s+(?:with|to)|versus|vs\.?)\b/i.test(textBetween)) {
          return false
        }
      } else if (targetIdx >= m.endIndex) {
        const textBetween = sentLower.slice(m.endIndex, targetIdx)
        if (/[,;]?\s*\b(?:while|whereas|although|though|but|compared\s+(?:with|to)|versus|vs\.?)\b/i.test(textBetween)) {
          return false
        }
      }
      return true
    })
  }

  // Sort items descending by length so longer names take precedence
  const sortedItems = [...itemsInSentence]
    .map((name) => {
      const n = typeof name === 'string' ? name : name?.name
      return {
        name: n.toLowerCase(),
        isTarget: n.toLowerCase() === targetLower,
      }
    })
    .sort((a, b) => b.name.length - a.name.length)

  const matchedSpans = []
  const itemMentions = []

  for (const item of sortedItems) {
    let idx = 0
    while ((idx = sentLower.indexOf(item.name, idx)) !== -1) {
      const start = idx
      const end = idx + item.name.length
      idx = end

      const overlaps = matchedSpans.some(
        (span) => Math.max(start, span.start) < Math.min(end, span.end)
      )
      if (!overlaps) {
        matchedSpans.push({ start, end })
        itemMentions.push({
          name: item.name,
          isTarget: item.isTarget,
          start,
          end,
        })
      }
    }
  }

  itemMentions.sort((a, b) => a.start - b.start)

  // Support "respectively" syntactic binding: item A and B offer X and Y respectively
  if (sentLower.includes('respectively') && itemMentions.length === measurements.length) {
    const targetIdx = itemMentions.findIndex((it) => it.isTarget)
    if (targetIdx !== -1 && measurements[targetIdx]) {
      return [measurements[targetIdx]]
    }
  }

  return measurements.filter((m) => {
    let precedingItem = null
    let followingItem = null

    for (const item of itemMentions) {
      if (item.end <= m.startIndex) {
        precedingItem = item
      } else if (item.start >= m.endIndex && !followingItem) {
        followingItem = item
      }
    }

    // 1. Direct prepositional binding to following item: "27 hours for the iPhone 17"
    if (followingItem) {
      const toFollowing = sentLower.slice(m.endIndex, followingItem.start)
      if (/^\s*(?:for|in|on|from|by|to|of)?\s*(?:the\s+)?$/i.test(toFollowing)) {
        return followingItem.isTarget
      }
    }

    // 2. Check preceding item if not separated by a comparative or contrastive boundary
    if (precedingItem) {
      const between = sentLower.slice(precedingItem.end, m.startIndex)
      const hasContrastiveSplit = /[,;]?\s*\b(?:while|whereas|although|though|but|compared\s+(?:with|to)|versus|vs\.?)\b/i.test(between)
      if (!hasContrastiveSplit) {
        return precedingItem.isTarget
      }
      if (followingItem && followingItem.start <= m.startIndex) {
        return followingItem.isTarget
      }
    }

    // 3. Check following item when preceding item was separated by a contrastive boundary
    if (followingItem) {
      const between = sentLower.slice(m.endIndex, followingItem.start)
      const hasContrastiveSplit = /[,;]?\s*\b(?:while|whereas|although|though|but|compared\s+(?:with|to)|versus|vs\.?)\b/i.test(between)
      if (!hasContrastiveSplit) {
        return followingItem.isTarget
      }
    }

    // Proximity fallback: nearest item mention
    let closest = null
    let minDist = Infinity
    for (const item of itemMentions) {
      const dist = Math.min(
        Math.abs(m.startIndex - item.end),
        Math.abs(item.start - m.endIndex)
      )
      if (dist < minDist) {
        minDist = dist
        closest = item
      }
    }

    return closest ? closest.isTarget : true
  })
}

/**
 * Check whether an AI-generated analysis narrative contradicts structured
 * evidence rows.
 *
 * Algorithm:
 *  1. Group evidence rows by (item_name, criterion) to gather all applicable
 *     measurements (handling multi-row and single-string camera components).
 *  2. Split the narrative into sentence clauses.
 *  3. For each sentence mentioning an item and criterion:
 *     a. Attribute measurements within the sentence to the correct product.
 *     b. Filter measurements strictly matching canonical units.
 *     c. For multi-component criteria (e.g. camera), match by component descriptor
 *        (main, ultra_wide, telephoto) so 12MP telephoto is never compared against 48MP main.
 *     d. Flag only genuine contradictions where narrative values diverge from
 *        the matching evidence value beyond tolerance (0.5).
 *
 * @param {string} analysisText  Full text of the generated analysis
 * @param {Array}  evidenceRows  Array of evidence row objects, each with:
 *                                 { item_name, criterion, result, ... }
 * @param {Array<string|{name: string}>} [knownItemNames]  Optional list of known comparison items
 * @returns {{ hasConflict: boolean, conflicts: Array }}
 */
export function checkNarrativeConsistency(analysisText, evidenceRows, knownItemNames = []) {
  // Guard: if either input is missing, there is nothing to compare
  if (!analysisText || typeof analysisText !== 'string' || analysisText.trim().length === 0) {
    return { hasConflict: false, conflicts: [] }
  }
  if (!Array.isArray(evidenceRows) || evidenceRows.length === 0) {
    return { hasConflict: false, conflicts: [] }
  }

  const explicitNames = [
    ...evidenceRows.map((r) => r.item_name),
    ...(Array.isArray(knownItemNames)
      ? knownItemNames.map((i) => (typeof i === 'string' ? i : i?.name))
      : []),
  ].filter(Boolean)

  const allItemNames = discoverEntitiesInText(analysisText, [...new Set(explicitNames)])
  const sentences = splitIntoSentences(analysisText)
  const conflicts = []

  // Group evidence measurements by item_name and criterion
  const evidenceGroupMap = new Map()

  for (const row of evidenceRows) {
    const { item_name, criterion, result } = row
    if (!item_name || !criterion || !result) continue

    const measurements = extractMeasurementsWithContext(String(result))
    if (measurements.length === 0) continue

    const key = `${item_name.toLowerCase()}:::${criterion.toLowerCase()}`
    if (!evidenceGroupMap.has(key)) {
      evidenceGroupMap.set(key, {
        item_name,
        criterion,
        measurements: [],
      })
    }
    const group = evidenceGroupMap.get(key)
    for (const m of measurements) {
      if (
        !group.measurements.some(
          (existing) =>
            existing.value === m.value &&
            existing.canonicalUnit === m.canonicalUnit &&
            existing.component === m.component
        )
      ) {
        group.measurements.push(m)
      }
    }
  }

  // Inspect each (item, criterion) group against the narrative
  for (const group of evidenceGroupMap.values()) {
    const { item_name, criterion, measurements: evMeasurements } = group
    const itemLower = item_name.toLowerCase()
    const critKeywords = criterion
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 2 && !['and', 'the', 'for', 'are'].includes(w))

    for (const sentence of sentences) {
      if (!sentence.includes(itemLower)) continue

      const hasCrit =
        critKeywords.length === 0 ||
        critKeywords.some((kw) => sentence.includes(kw)) ||
        evMeasurements.some((em) => em.canonicalUnit && sentence.includes(em.canonicalUnit))
      if (!hasCrit) continue

      const narrativeMeasurements = getMeasurementsForItem(sentence, item_name, allItemNames)
      if (narrativeMeasurements.length === 0) continue

      const tolerance = 0.5

      for (const narM of narrativeMeasurements) {
        const sameUnitEv = evMeasurements.filter((e) => e.canonicalUnit === narM.canonicalUnit)
        if (sameUnitEv.length === 0) continue

        let isConflict = false
        let conflictingEvidenceValue = sameUnitEv[0].value

        if (narM.component) {
          // Narrative specifies a component (e.g. telephoto, ultra_wide, main)
          const compEv = sameUnitEv.filter((e) => e.component === narM.component)
          if (compEv.length > 0) {
            const matchesComp = compEv.some((e) => Math.abs(narM.value - e.value) <= tolerance)
            if (!matchesComp) {
              isConflict = true
              conflictingEvidenceValue = compEv[0].value
            }
          } else {
            // If all evidence measurements have different explicit components,
            // evidence simply didn't cover this component (not a contradiction)
            const allHaveOtherComponents = sameUnitEv.every((e) => e.component && e.component !== narM.component)
            if (!allHaveOtherComponents) {
              const matchesAny = sameUnitEv.some((e) => Math.abs(narM.value - e.value) <= tolerance)
              if (!matchesAny) {
                isConflict = true
                conflictingEvidenceValue = sameUnitEv[0].value
              }
            }
          }
        } else {
          // Narrative does not specify a component (e.g. generic battery hours or generic MP)
          const matchesAny = sameUnitEv.some((e) => Math.abs(narM.value - e.value) <= tolerance)
          if (!matchesAny) {
            isConflict = true
            conflictingEvidenceValue = sameUnitEv[0].value
          }
        }

        if (isConflict) {
          if (
            !conflicts.some(
              (c) =>
                c.item_name === item_name &&
                c.criterion === criterion &&
                c.narrative_value === narM.value
            )
          ) {
            conflicts.push({
              item_name,
              criterion,
              evidence_value: conflictingEvidenceValue,
              evidence_unit: narM.canonicalUnit,
              narrative_value: narM.value,
            })
          }
        }
      }
    }
  }

  return {
    hasConflict: conflicts.length > 0,
    conflicts,
  }
}
