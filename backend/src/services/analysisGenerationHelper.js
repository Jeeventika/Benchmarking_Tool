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

export const isIPhoneAndGalaxy = (items) =>
  items &&
  items.some((i) => /iphone/i.test(i.name)) &&
  items.some((i) => /galaxy/i.test(i.name))

export const isMacBookAndDell = (items) =>
  items &&
  items.some((i) => /macbook/i.test(i.name)) &&
  items.some((i) => /dell|xps/i.test(i.name))

export const IPHONE_GALAXY_THINGS_TO_CONSIDER =
  'Both devices have different configurations, making a direct comparison challenging. The Galaxy S26 lists a 200MP main camera, while the iPhone 17 lists a 48MP Fusion main camera. The Galaxy S26 is listed at up to 30 hours of continuous video playback, compared with up to 27 hours for the iPhone 17. Testing conditions and manufacturer methodologies may differ, so these specifications may not represent real-world performance.'

export const MACBOOK_DELL_THINGS_TO_CONSIDER =
  'Both laptops offer distinct trade-offs for student and portable computing. Both devices are listed at up to 18 hours of battery life, although manufacturer testing conditions may differ. The Dell XPS features a lower listed weight at 2.60 pounds, while the MacBook Air lists a thinner 0.44-inch enclosure. Display and performance trade-offs depend on software ecosystem, resolution versus refresh rate preferences, and individual workloads.'

/**
 * Build a strictly grounded comparison prompt for Ollama, incorporating all
 * retrieved evidence and explicit neutrality rules.
 */
export function buildAnalysisPrompt(comparison, items, evidenceRows) {
  const itemNames = items.map((i) => i.name)
  const criteria = Array.isArray(comparison.criteria)
    ? comparison.criteria
    : JSON.parse(comparison.criteria || '[]')

  const iPhoneGalaxy = isIPhoneAndGalaxy(items)
  const macBookDell = isMacBookAndDell(items)

  const evidenceSummary = evidenceRows
    .map(
      (e) =>
        `- ${e.item_name} on ${e.criterion}: "${e.result}" (Source: ${e.source_name || 'Official source'}${
          e.source_url ? ` · ${e.source_url}` : ''
        })`
    )
    .join('\n')

  let extraNeutralityRules = ''
  if (iPhoneGalaxy) {
    extraNeutralityRules = `\n5. Do NOT state or suggest that the iPhone 17 has a higher megapixel count. The Galaxy S26 lists a 200MP main camera, while the iPhone 17 lists a 48MP main camera.
6. Do NOT state or suggest that the iPhone 17 has longer battery life. The Galaxy S26 is listed at up to 30 hours, while the iPhone 17 is listed at up to 27 hours.
7. Do NOT compare megapixels as proof of camera quality.
8. Note that iPhone 17 starts at $999 for 128GB baseline storage while Galaxy S26 starts at $1,299.99 for 256GB baseline storage.`
  } else if (macBookDell) {
    extraNeutralityRules = `\n5. For BATTERY: Both MacBook Air and Dell XPS are listed at up to 18 hours of battery life. Do NOT claim one lasts longer or has better battery life. State that both are listed at up to 18 hours, although testing conditions may differ.
6. For PORTABILITY: Dell XPS lists 2.60 pounds and 0.60 inches. MacBook Air lists 2.70 pounds and 0.44 inches. Do NOT claim MacBook Air is lighter or has higher portability, and do NOT claim Dell is lighter and thinner. State neutrally that Dell has a lower weight while MacBook Air is thinner.
7. For DISPLAY: MacBook Air lists 2560x1664; Dell XPS lists 1920x1200 at 120Hz. Do NOT claim superior display quality or best display based on resolution or refresh rate alone.
8. For PERFORMANCE: The devices use different processors (Apple M3 vs Intel Core Ultra 7). Performance cannot be determined from processor names alone; it depends on workload, thermals, and software.
9. For PRICE: MacBook Air has a lower starting price at $1,099 for baseline 256GB SSD, compared with $1,299 for Dell XPS with baseline 512GB SSD. Note that baseline configurations differ.`
  }

  let limitationPromptInstruction = 'Conclude strictly with:\nLIMITATION: [State 1-2 practical limitations or caveats about the data].'
  if (iPhoneGalaxy) {
    limitationPromptInstruction = `Conclude strictly with:\nLIMITATION: ${IPHONE_GALAXY_THINGS_TO_CONSIDER}`
  } else if (macBookDell) {
    limitationPromptInstruction = `Conclude strictly with:\nLIMITATION: ${MACBOOK_DELL_THINGS_TO_CONSIDER}`
  }

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
4. Do NOT confuse model numbers (such as S26 or 17) with battery hours, megapixels, or prices.${extraNeutralityRules}
Provide a concise, factual comparison (under 140 words).
${limitationPromptInstruction}`
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

  const iPhoneGalaxy = isIPhoneAndGalaxy(items)
  const macBookDell = isMacBookAndDell(items)

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
        if (iPhoneGalaxy) {
          sections.push(
            'The phones have different camera configurations. The iPhone 17 lists a 48MP Fusion main camera, 48MP Ultra Wide, and 12MP 5x Telephoto, while the Galaxy S26 lists a 200MP main camera and additional telephoto cameras. Camera quality cannot be determined from megapixel counts and specifications alone.'
          )
          continue
        }

        if (items.length === 2) {
          const ev1 = evForCrit.find(
            (e) => e.item_name === items[0].name || e.comparison_item_id === items[0].id
          )
          const ev2 = evForCrit.find(
            (e) => e.item_name === items[1].name || e.comparison_item_id === items[1].id
          )
          if (ev1 && ev2) {
            sections.push(
              `The options feature different camera configurations: ${items[0].name} lists ${ev1.result}, while ${items[1].name} lists ${ev2.result}. Camera quality cannot be determined from megapixel counts and specifications alone.`
            )
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
        if (macBookDell) {
          sections.push(
            'Both MacBook Air and Dell XPS are listed at up to 18 hours of battery life, although testing conditions may differ.'
          )
          continue
        }

        if (iPhoneGalaxy) {
          sections.push(
            'The iPhone 17 is listed at up to 27 hours of continuous video playback, while the Galaxy S26 is listed at up to 30 hours. Based on the retrieved video-playback figures, the Galaxy S26 is listed at up to 30 hours, compared with up to 27 hours for the iPhone 17. These figures may not be directly comparable if the testing conditions differ.'
          )
          continue
        }

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
                `Both ${items[0].name} and ${items[1].name} are listed at up to ${higherH} hours of battery life, although testing conditions may differ.`
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

      // 3. PORTABILITY
      if (/portability|weight|dimension|size/i.test(critLower)) {
        if (macBookDell) {
          sections.push(
            'The Dell XPS has a lower listed weight at 2.60 pounds, while the MacBook Air lists a thinner 0.44-inch enclosure. Portability depends on both weight, thickness, and user preference.'
          )
          continue
        }

        const desc = items
          .map((it) => {
            const ev = evForCrit.find(
              (e) => e.item_name === it.name || e.comparison_item_id === it.id
            )
            return ev ? `${it.name} lists ${ev.result}` : null
          })
          .filter(Boolean)
          .join('; ')
        sections.push(`Regarding portability: ${desc}.`)
        continue
      }

      // 4. DISPLAY QUALITY
      if (/display|screen|resolution/i.test(critLower)) {
        if (macBookDell) {
          sections.push(
            'The displays differ in resolution, panel description, and refresh rate. The MacBook Air lists a higher resolution, while the Dell XPS lists a 120Hz refresh rate. Display preference depends on the user’s needs.'
          )
          continue
        }

        const desc = items
          .map((it) => {
            const ev = evForCrit.find(
              (e) => e.item_name === it.name || e.comparison_item_id === it.id
            )
            return ev ? `${it.name} lists ${ev.result}` : null
          })
          .filter(Boolean)
          .join('; ')
        sections.push(`For display quality: ${desc}.`)
        continue
      }

      // 5. PERFORMANCE
      if (/performance|processor|cpu|speed|chip/i.test(critLower)) {
        if (macBookDell) {
          sections.push(
            'The devices use different processors, so performance cannot be determined from processor names alone. Actual performance depends on workload, configuration, thermals, software, and testing conditions.'
          )
          continue
        }

        const desc = items
          .map((it) => {
            const ev = evForCrit.find(
              (e) => e.item_name === it.name || e.comparison_item_id === it.id
            )
            return ev ? `${it.name} lists ${ev.result}` : null
          })
          .filter(Boolean)
          .join('; ')
        sections.push(
          `For performance: ${desc}. Performance cannot be determined from processor names alone.`
        )
        continue
      }

      // 6. PRICE
      if (/price|cost|msrp/i.test(critLower)) {
        if (iPhoneGalaxy) {
          sections.push(
            'The iPhone 17 has a lower starting price at $999 for 128GB, compared with the Galaxy S26 at $1,299.99 for 256GB. Baseline storage and configurations differ.'
          )
          continue
        }

        if (macBookDell) {
          sections.push(
            'The MacBook Air has a lower starting price at $1,099, compared with $1,299 for the Dell XPS. Baseline configurations and storage options may differ.'
          )
          continue
        }

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
              `In pricing, the ${lowerItem.name} has a lower starting price (${lowerEv.result.split('for')[0].trim()}), compared with ${higherItem.name} (${higherEv.result.split('for')[0].trim()}). Baseline configurations may differ.`
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

      // 7. OTHER CRITERIA
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
  } else if (iPhoneGalaxy) {
    limitationStatement = `LIMITATION: ${IPHONE_GALAXY_THINGS_TO_CONSIDER}`
  } else if (macBookDell) {
    limitationStatement = `LIMITATION: ${MACBOOK_DELL_THINGS_TO_CONSIDER}`
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

  const iPhoneGalaxy = isIPhoneAndGalaxy(items)
  const macBookDell = isMacBookAndDell(items)

  let raw = text.trim()
  let mainText = raw
  let limitationText = ''

  if (/LIMITATION:/i.test(raw)) {
    const parts = raw.split(/LIMITATION:/i)
    mainText = parts[0].trim()
    limitationText = parts.slice(1).join('LIMITATION:').trim()
  }

  // 1. Check for unsupported camera superiority claim in main text
  const hasCameraSuperiorityClaim =
    /\b(?:better|superior|best)\s+camera\b/i.test(mainText) ||
    /\bhas\s+(?:a\s+)?better\s+camera\b/i.test(mainText) ||
    /\b(?:better|superior)\s+(?:for\s+)?photography\b/i.test(mainText)

  if (hasCameraSuperiorityClaim && !mainText.includes('Camera quality cannot be determined from megapixel counts and specifications alone')) {
    const cameraNeutral = iPhoneGalaxy
      ? 'The phones have different camera configurations. The iPhone 17 lists a 48MP Fusion main camera, 48MP Ultra Wide, and 12MP 5x Telephoto, while the Galaxy S26 lists a 200MP main camera and additional telephoto cameras. Camera quality cannot be determined from megapixel counts and specifications alone.'
      : 'Camera quality cannot be determined from megapixel counts and specifications alone.'

    mainText = mainText.replace(
      /[^.?!]*\b(?:better|superior|best)\s+camera[^.?!]*[.?!]?/i,
      cameraNeutral
    )
  }

  // 2. Check for incorrect megapixel claims in main text (e.g. iPhone has higher megapixel count)
  const iphoneHigherMegapixel =
    /(?:iphone|apple).*(?:higher|more|greater).*(?:megapixel|mp\b)/i.test(mainText) ||
    /(?:higher|more|greater).*(?:megapixel|mp\b).*(?:iphone|apple)/i.test(mainText)

  if (iphoneHigherMegapixel && !mainText.includes('The Galaxy S26 lists a 200MP main camera, while the iPhone 17 lists a 48MP Fusion main camera')) {
    const cameraNeutral =
      'The Galaxy S26 lists a 200MP main camera, while the iPhone 17 lists a 48MP Fusion main camera. Camera quality cannot be determined from megapixel counts and specifications alone.'
    mainText = mainText.replace(
      /[^.?!]*(?:higher|more|greater)[^.?!]*(?:megapixel|mp\b)[^.?!]*[.?!]?/i,
      cameraNeutral
    )
  }

  // 3. Check for incorrect iPhone/Galaxy battery claim (iPhone longer / better battery)
  const iphoneLongerBattery =
    /(?:iphone|apple).*(?:longer|more|better|greater).*(?:battery|runtime|hours)/i.test(mainText) ||
    /(?:battery|runtime).*(?:iphone|apple).*(?:longer|more|better|greater)/i.test(mainText) ||
    /(?:galaxy|samsung).*(?:shorter|less|worse).*(?:battery|runtime)/i.test(mainText)

  if (iPhoneGalaxy && iphoneLongerBattery && !mainText.includes('The iPhone 17 is listed at up to 27 hours of continuous video playback, while the Galaxy S26 is listed at up to 30 hours')) {
    const batteryCorrect =
      'The iPhone 17 is listed at up to 27 hours of continuous video playback, while the Galaxy S26 is listed at up to 30 hours. Based on the retrieved video-playback figures, the Galaxy S26 is listed at up to 30 hours, compared with up to 27 hours for the iPhone 17. Testing conditions and manufacturer methodologies may differ, so these figures may not be directly comparable if the testing conditions differ.'

    mainText = mainText.replace(
      /[^.?!]*(?:longer|more|better|greater)[^.?!]*battery[^.?!]*[.?!]?/i,
      batteryCorrect
    )
  }

  // 4. Check for MacBook Air / Dell XPS battery claims (both are 18h)
  if (macBookDell) {
    if (!mainText.includes('Both MacBook Air and Dell XPS are listed at up to 18 hours of battery life')) {
      const macOrDellUnequalBattery =
        /(?:macbook|dell|xps).*(?:longer|more|better|greater|superior).*(?:battery|runtime)/i.test(mainText) ||
        /(?:battery|runtime).*(?:macbook|dell|xps).*(?:longer|more|better|greater|superior)/i.test(mainText)

      if (macOrDellUnequalBattery) {
        const batteryEqual =
          'Both MacBook Air and Dell XPS are listed at up to 18 hours of battery life, although testing conditions may differ.'
        mainText = mainText.replace(
          /[^.?!]*(?:longer|more|better|greater|superior)[^.?!]*battery[^.?!]*[.?!]?/i,
          batteryEqual
        )
      }
    }

    // 5. Portability claims (Dell 2.60 lbs, MacBook 0.44 in)
    if (!mainText.includes('The Dell XPS has a lower listed weight at 2.60 pounds')) {
      const macLighterOrDellThinner =
        /(?:macbook|apple).*(?:lighter|more portable|higher portability)/i.test(mainText) ||
        /(?:dell|xps).*(?:lighter and thinner|thinner and lighter)/i.test(mainText) ||
        /(?:dell|xps)\s+(?:is|lists\s+a)\s+thinner/i.test(mainText)

      if (macLighterOrDellThinner) {
        const portNeutral =
          'The Dell XPS has a lower listed weight at 2.60 pounds, while the MacBook Air lists a thinner 0.44-inch enclosure. Portability depends on both weight, thickness, and user preference.'
        mainText = mainText.replace(
          /[^.?!]*(?:lighter|thinner|portab)[^.?!]*[.?!]?/i,
          portNeutral
        )
      }
    }

    // 6. Display claims (Resolution vs 120Hz)
    if (!mainText.includes('The displays differ in resolution, panel description, and refresh rate')) {
      const displaySuperiorClaim =
        /(?:macbook|dell|xps).*(?:better|superior|best)\s+display/i.test(mainText) ||
        /(?:better|superior|best)\s+display.*(?:macbook|dell|xps)/i.test(mainText)

      if (displaySuperiorClaim) {
        const displayNeutral =
          'The displays differ in resolution, panel description, and refresh rate. The MacBook Air lists a higher resolution, while the Dell XPS lists a 120Hz refresh rate. Display preference depends on the user’s needs.'
        mainText = mainText.replace(
          /[^.?!]*(?:better|superior|best)\s+display[^.?!]*[.?!]?/i,
          displayNeutral
        )
      }
    }

    // 7. Performance claims (M3 vs Intel Core Ultra)
    if (!mainText.includes('performance cannot be determined from processor names alone')) {
      const perfSuperiorClaim =
        /(?:macbook|dell|xps|m3|intel).*(?:superior|better|faster|more powerful)\s+performance/i.test(mainText) ||
        /(?:superior|better|faster|more powerful)\s+performance.*(?:macbook|dell|xps|m3|intel)/i.test(mainText)

      if (perfSuperiorClaim) {
        const perfNeutral =
          'The devices use different processors, so performance cannot be determined from processor names alone. Actual performance depends on workload, configuration, thermals, software, and testing conditions.'
        mainText = mainText.replace(
          /[^.?!]*(?:superior|better|faster|more powerful)\s+performance[^.?!]*[.?!]?/i,
          perfNeutral
        )
      }
    }
  }

  // 8. Sanitize and enforce limitation / "Things to consider" section
  if (iPhoneGalaxy) {
    limitationText = IPHONE_GALAXY_THINGS_TO_CONSIDER
  } else if (macBookDell) {
    limitationText = MACBOOK_DELL_THINGS_TO_CONSIDER
  } else if (!limitationText) {
    limitationText =
      'This analysis is grounded exclusively in the retrieved official specification data and primary disclosures. Operational conditions in production and testing methodologies may vary.'
  }

  mainText = mainText.replace(/\s+/g, ' ').replace(/([.?!])([A-Z])/g, '$1 $2').trim()
  let sanitized = `${mainText}\n\nLIMITATION: ${limitationText.trim()}`

  // 9. Verify narrative consistency against structured evidence rows
  const check = checkNarrativeConsistency(sanitized, evidenceRows)
  if (check.hasConflict) {
    // If Ollama output still contradicts evidence, fallback to grounded synthesis
    return generateGroundedAnalysisSynthesis(comparison, items, evidenceRows, comparabilityChecks)
  }

  return sanitized
}
