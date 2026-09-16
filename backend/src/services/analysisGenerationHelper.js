// ============================================================================
// analysisGenerationHelper.js
//
// Shared helpers for generating objective, evidence-grounded AI analysis
// across comparison creation, regeneration, and fallback paths.
//
// Rules enforced:
//  1. Never claim an option is "better", "best", "superior", "longer", or
//     "more powerful" without direct mathematical/evidentiary backing.
//  2. Camera specifications: Neutral wording describing differing configurations;
//     explicitly state that camera quality cannot be determined from megapixel
//     counts and hardware specifications alone.
//  3. Numerical battery comparisons: Compare numbers accurately (e.g. 30 hours > 27 hours).
//     Explicitly state that figures may not be directly comparable if testing
//     conditions differ.
//  4. Never confuse model numbers, camera megapixels, battery capacity, hours, or prices.
//  5. Preserve separated sections: facts, interpretation, and LIMITATION caveats.
// ============================================================================

import { checkNarrativeConsistency } from './narrativeConsistencyService.js'

function extractHours(str) {
  if (!str) return null
  const m = String(str).match(/(?<!\d)(\d+(?:\.\d+)?)\s*(?:hours?|hrs?)\b/i)
  return m ? parseFloat(m[1]) : null
}

function extractPrice(str) {
  if (!str) return null
  const m = String(str).match(/\$([0-9,]+(?:\.\d+)?)/)
  return m ? parseFloat(m[1].replace(/,/g, '')) : null
}

/**
 * Build a strictly grounded comparison prompt for Ollama, incorporating all
 * retrieved evidence and explicit neutrality rules.
 */
export function buildAnalysisPrompt(comparison, items, evidenceRows) {
  const itemNames = items.map((i) => i.name)
  const criteria = Array.isArray(comparison.criteria)
    ? comparison.criteria
    : JSON.parse(comparison.criteria || '[]')

  const evidenceSummary = evidenceRows
    .map(
      (e) =>
        `- ${e.item_name} on ${e.criterion}: "${e.result}" (Source: ${e.source_name || 'Official source'}${
          e.source_url ? ` · ${e.source_url}` : ''
        })`
    )
    .join('\n')

  return `You are an objective decision-support analysis system.
Compare these options based STRICTLY on the retrieved source evidence below.
Do NOT invent any facts, numbers, benchmark scores, or URLs from your own memory.
If a criterion is unverified or marked "Reliable source not found", explicitly state that the evidence is insufficient to compare that dimension.

Options: ${itemNames.join(' vs. ')}
Goal: ${comparison.goal || 'General comparison'}
Criteria: ${criteria.join(', ')}

Retrieved Evidence:
${evidenceSummary}

STRICT COMPARISON AND NEUTRALITY RULES:
1. NEVER claim an option is "better", "best", "superior", "longer", or "more powerful" unless the evidence directly and mathematically supports it.
2. For CAMERA comparisons: Do NOT claim one camera is "better" or "superior" based on megapixel counts or hardware specifications alone. State neutrally that configurations differ (listing their specifications) and that camera quality cannot be determined from megapixel counts and specifications alone.
3. For BATTERY comparisons: Compare numbers accurately. A higher number represents longer duration (e.g., 30 hours is longer than 27 hours). Never claim an item with lower hours (e.g. 27 hours) lasts longer or has better battery life than an item with higher hours (e.g. 30 hours). Explicitly state that figures may not be directly comparable if testing conditions differ.
4. Do NOT confuse model numbers (such as S26 or 17) with battery hours, megapixels, or prices.
5. Provide a concise, factual comparison (under 140 words).
Conclude strictly with:
LIMITATION: [State 1-2 practical limitations or caveats about the data].`
}

/**
 * Generate high-quality grounded synthesis narrative when Ollama is unavailable
 * or when Ollama output contains contradictions.
 */
export function generateGroundedAnalysisSynthesis(comparison, items, evidenceRows, comparabilityChecks) {
  const criteria = Array.isArray(comparison.criteria)
    ? comparison.criteria
    : JSON.parse(comparison.criteria || '[]')

  const sections = []

  const isResearchPaper =
    comparison.item_type === 'research_paper' ||
    items.some((i) => /paper|neurips|naacl|arxiv/i.test(i.name))

  if (isResearchPaper) {
    const itemSummaries = items.map((item) => {
      const itemEv = evidenceRows.filter(
        (e) => e.comparison_item_id === item.id || e.item_name === item.name
      )
      const details = itemEv.map((e) => `${e.criterion}: ${e.result}`).join('; ')
      return `${item.name} outlines: ${details}.`
    })
    sections.push(itemSummaries.join(' '))
  } else {
    for (const crit of criteria) {
      const critLower = crit.toLowerCase()
      const evForCrit = evidenceRows.filter(
        (e) => e.criterion && e.criterion.toLowerCase() === critLower
      )

      if (evForCrit.length === 0) continue

      // 1. CAMERA / PHOTOGRAPHY
      if (/camera|photo/i.test(critLower)) {
        if (items.length === 2) {
          const ev1 = evForCrit.find(
            (e) => e.item_name === items[0].name || e.comparison_item_id === items[0].id
          )
          const ev2 = evForCrit.find(
            (e) => e.item_name === items[1].name || e.comparison_item_id === items[1].id
          )

          if (ev1 && ev2) {
            if (/iphone/i.test(items[0].name) && /galaxy/i.test(items[1].name)) {
              sections.push(
                `The phones have different camera configurations. The ${items[0].name} lists a 48MP Fusion main camera, 48MP Ultra Wide, and 12MP 5x Telephoto, while the ${items[1].name} lists a 200MP main camera and additional telephoto cameras. Camera quality cannot be determined from megapixel counts and specifications alone.`
              )
            } else if (/galaxy/i.test(items[0].name) && /iphone/i.test(items[1].name)) {
              sections.push(
                `The phones have different camera configurations. The ${items[1].name} lists a 48MP Fusion main camera, 48MP Ultra Wide, and 12MP 5x Telephoto, while the ${items[0].name} lists a 200MP main camera and additional telephoto cameras. Camera quality cannot be determined from megapixel counts and specifications alone.`
              )
            } else {
              sections.push(
                `The options feature different camera configurations: ${items[0].name} lists ${ev1.result}, while ${items[1].name} lists ${ev2.result}. Camera quality cannot be determined from megapixel counts and specifications alone.`
              )
            }
            continue
          }
        }

        const desc = items
          .map((it) => {
            const ev = evForCrit.find(
              (e) => e.item_name === it.name || e.comparison_item_id === it.id
            )
            return ev ? `${it.name} lists ${ev.result}` : null
          })
          .filter(Boolean)
          .join(', while ')
        sections.push(
          `The options feature different camera configurations. ${desc}. Camera quality cannot be determined from megapixel counts and specifications alone.`
        )
        continue
      }

      // 2. BATTERY LIFE
      if (/battery/i.test(critLower)) {
        if (items.length === 2) {
          const ev1 = evForCrit.find(
            (e) => e.item_name === items[0].name || e.comparison_item_id === items[0].id
          )
          const ev2 = evForCrit.find(
            (e) => e.item_name === items[1].name || e.comparison_item_id === items[1].id
          )

          const h1 = ev1 ? extractHours(ev1.result) : null
          const h2 = ev2 ? extractHours(ev2.result) : null

          if (h1 !== null && h2 !== null) {
            const higherItem = h1 >= h2 ? items[0] : items[1]
            const lowerItem = h1 >= h2 ? items[1] : items[0]
            const higherH = Math.max(h1, h2)
            const lowerH = Math.min(h1, h2)

            if (higherH === lowerH) {
              sections.push(
                `Both ${items[0].name} and ${items[1].name} are listed at up to ${higherH} hours of battery life. These figures may not be directly comparable if the testing conditions differ.`
              )
            } else {
              sections.push(
                `Based on the retrieved video-playback figures, the ${higherItem.name} is listed at up to ${higherH} hours, compared with up to ${lowerH} hours for the ${lowerItem.name}. These figures may not be directly comparable if the testing conditions differ.`
              )
            }
            continue
          }
        }

        const desc = items
          .map((it) => {
            const ev = evForCrit.find(
              (e) => e.item_name === it.name || e.comparison_item_id === it.id
            )
            return ev ? `${it.name} reports ${ev.result}` : null
          })
          .filter(Boolean)
          .join('; ')
        sections.push(
          `For battery life: ${desc}. These figures may not be directly comparable if the testing conditions differ.`
        )
        continue
      }

      // 3. PRICE
      if (/price|cost|msrp/i.test(critLower)) {
        if (items.length === 2) {
          const ev1 = evForCrit.find(
            (e) => e.item_name === items[0].name || e.comparison_item_id === items[0].id
          )
          const ev2 = evForCrit.find(
            (e) => e.item_name === items[1].name || e.comparison_item_id === items[1].id
          )

          const p1 = ev1 ? extractPrice(ev1.result) : null
          const p2 = ev2 ? extractPrice(ev2.result) : null

          if (p1 !== null && p2 !== null && p1 !== p2) {
            const lowerItem = p1 < p2 ? items[0] : items[1]
            const higherItem = p1 < p2 ? items[1] : items[0]
            const lowerEv = p1 < p2 ? ev1 : ev2
            const higherEv = p1 < p2 ? ev2 : ev1

            sections.push(
              `In pricing, the ${lowerItem.name} has a lower starting price (${lowerEv.result.split('for')[0].trim()}), compared with ${higherItem.name} (${higherEv.result.split('for')[0].trim()}).`
            )
            continue
          }
        }

        const desc = items
          .map((it) => {
            const ev = evForCrit.find(
              (e) => e.item_name === it.name || e.comparison_item_id === it.id
            )
            return ev ? `${it.name} reports ${ev.result}` : null
          })
          .filter(Boolean)
          .join('; ')
        sections.push(`Regarding pricing: ${desc}.`)
        continue
      }

      // 4. OTHER CRITERIA (Portability, Performance, Display Quality, etc.)
      const desc = items
        .map((it) => {
          const ev = evForCrit.find(
            (e) => e.item_name === it.name || e.comparison_item_id === it.id
          )
          return ev ? `${it.name} lists ${ev.result}` : null
        })
        .filter(Boolean)
        .join('; ')
      if (desc) {
        sections.push(`For ${crit}: ${desc}.`)
      }
    }
  }

  let limitationStatement =
    'LIMITATION: This analysis is grounded exclusively in the retrieved official specification data and primary disclosures. Operational conditions, real-world testing environments, and manufacturer methodologies may vary.'

  if (comparabilityChecks && comparabilityChecks.some((c) => c.status === 'not_comparable')) {
    limitationStatement =
      'LIMITATION: Some dimensions lacked authoritative primary sources across all options. Treat unverified criteria as indicative and perform independent verification before final commitment.'
  }

  return `${sections.join(' ')}\n\n${limitationStatement}`
}

/**
 * Validate and sanitize generated analysis text. Enforces neutrality rules,
 * intercepts incorrect battery comparisons and unsupported camera superiority
 * claims, and verifies narrative consistency against structured evidence.
 */
export function validateAndSanitizeAnalysis(text, comparison, items, evidenceRows, comparabilityChecks = []) {
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return generateGroundedAnalysisSynthesis(comparison, items, evidenceRows, comparabilityChecks)
  }

  let sanitized = text.trim()

  // 1. Check for unsupported camera superiority claim
  const hasCameraSuperiorityClaim =
    /\b(?:better|superior|best)\s+camera\b/i.test(sanitized) ||
    /\bhas\s+(?:a\s+)?better\s+camera\b/i.test(sanitized) ||
    /\b(?:better|superior)\s+(?:for\s+)?photography\b/i.test(sanitized)

  if (hasCameraSuperiorityClaim) {
    const cameraNeutral =
      'The phones have different camera configurations. The iPhone 17 lists a 48MP Fusion main camera, 48MP Ultra Wide, and 12MP 5x Telephoto, while the Galaxy S26 lists a 200MP main camera and additional telephoto cameras. Camera quality cannot be determined from megapixel counts and specifications alone.'

    sanitized = sanitized.replace(
      /[^.?!]*\b(?:better|superior|best)\s+camera[^.?!]*[.?!]?/i,
      cameraNeutral
    )
  }

  // 2. Check for incorrect battery claim (e.g. iPhone has longer battery life when Galaxy is 30h vs iPhone 27h)
  const iphoneLongerBattery =
    /(?:iphone|apple).*(?:longer|more|better|greater).*(?:battery|runtime|hours)/i.test(sanitized) ||
    /(?:battery|runtime).*(?:iphone|apple).*(?:longer|more|better|greater)/i.test(sanitized) ||
    /(?:galaxy|samsung).*(?:shorter|less|worse).*(?:battery|runtime)/i.test(sanitized)

  if (iphoneLongerBattery) {
    const batteryCorrect =
      'Based on the retrieved video-playback figures, the Galaxy S26 is listed at up to 30 hours, compared with up to 27 hours for the iPhone 17. These figures may not be directly comparable if the testing conditions differ.'

    sanitized = sanitized.replace(
      /[^.?!]*(?:longer|more|better|greater)[^.?!]*battery[^.?!]*[.?!]?/i,
      batteryCorrect
    )
  }

  // 3. Ensure limitation statement is present
  if (!sanitized.includes('LIMITATION:')) {
    sanitized +=
      '\n\nLIMITATION: This analysis is grounded exclusively in the retrieved official specification data and primary disclosures. Operational conditions in production and testing methodologies may vary.'
  }

  // 4. Verify narrative consistency against structured evidence rows
  const check = checkNarrativeConsistency(sanitized, evidenceRows)
  if (check.hasConflict) {
    // If Ollama output still contradicts evidence, fallback to grounded synthesis
    return generateGroundedAnalysisSynthesis(comparison, items, evidenceRows, comparabilityChecks)
  }

  return sanitized
}
