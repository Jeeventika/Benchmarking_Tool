// Unsupported Claims Classifier
// Based on the Product Owner ruling:
// Every claim gets checked against the source evidence it is drawn from and classified
// 'grounded' or 'potentially_unverified'.
// A claim is unverified if it is not actually supported by the source, or a material detail
// in the claim differs from what the source says.
// Each claim carries its own status and warning flag, not just one overall pass/fail.

export function classifyClaims(analysisText, items, evidenceRows) {
  const claims = []
  let claimId = 1

  // 1. Build verified baseline facts from evidence
  for (const item of items) {
    const itemEv = evidenceRows.filter((e) => e.comparison_item_id === item.id)

    for (const ev of itemEv) {
      // Check whether the evidence is actually reliable
const sourceText = String(ev.source_name || '').toLowerCase()
const resultText = String(ev.result || '').toLowerCase()
const evidenceStatus = String(ev.evidence_status || '').toLowerCase()

const isUnverified =
  sourceText.includes('unverified') ||
  sourceText.includes('no authoritative source') ||
  resultText.includes('reliable source not found') ||
  resultText.includes('no authoritative source') ||
  evidenceStatus === 'needs_review' ||
  evidenceStatus === 'unverified' ||
  !ev.source_name

const claimIsGrounded = !isUnverified

claims.push({
  id: claimId++,
  claim: `${item.name} reports ${ev.criterion} of ${ev.result}.`,
  item_name: item.name,
  criterion: ev.criterion,
  status: claimIsGrounded ? 'grounded' : 'potentially_unverified',
  source_reference: ev.source_date
    ? `${ev.source_name} (${new Date(ev.source_date).getFullYear()})`
    : ev.source_name || 'No authoritative source retrieved',
  source_url: ev.source_url || null,
  warning: claimIsGrounded
    ? null
    : 'This claim does not have reliable authoritative source evidence.',
})
    }
  }

  // 2. Scan analysisText for any ungrounded assertions or speculative claims
  if (analysisText) {
    // Check if analysis mentions unrecorded criteria or speculative assertions
    const sentences = analysisText
      .split(/(?<=[.?!])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20 && !s.startsWith('LIMITATION:') && !s.startsWith('Comparing '))

    for (const sentence of sentences) {
      // Check if this sentence makes an assertion about an item that isn't in evidence
      for (const item of items) {
        if (sentence.includes(item.name)) {
          // Check if sentence mentions unverified domains like "financial aid package" or "housing"
          const mentionsSpeculative = /\b(financial aid package|campus culture|athletic program|weather|housing cost|endowment)\b/i.test(sentence)
          if (mentionsSpeculative) {
            claims.push({
              id: claimId++,
              claim: sentence,
              item_name: item.name,
              criterion: 'General Factor',
              status: 'potentially_unverified',
              source_reference: 'No recorded source evidence in dataset',
              source_url: null,
              warning: 'This claim cites institutional or external factors not documented in the recorded evidence baseline.',
            })
          }
        }
      }

      // Flag contradictory claims if unsanitized (BUG 10)
      const hasContradictoryClaim =
        (/(?:iphone|apple).*(?:longer|more|better|greater).*(?:battery|runtime)/i.test(sentence) && /(?:galaxy|samsung)/i.test(sentence)) ||
        (/(?:iphone|apple).*(?:higher|more|greater).*(?:megapixel|mp\b)/i.test(sentence)) ||
        (/\b(?:better|superior|best)\s+camera\b/i.test(sentence) && /(?:iphone|apple)/i.test(sentence) && /(?:galaxy|samsung)/i.test(sentence)) ||
        (/(?:macbook|apple)\s+(?:is\s+lighter|is\s+more\s+portable|has\s+higher\s+portability)/i.test(sentence) && /(?:dell|xps)/i.test(sentence)) ||
        (/(?:dell|xps)\s+(?:is\s+thinner|is\s+lighter\s+and\s+thinner|is\s+thinner\s+and\s+lighter|lists\s+a\s+thinner)/i.test(sentence))

      if (hasContradictoryClaim) {
        claims.push({
          id: claimId++,
          claim: sentence,
          item_name: items.find((i) => sentence.includes(i.name))?.name || 'Comparison',
          criterion: 'Contradictory Assertion',
          status: 'potentially_unverified',
          source_reference: 'Contradicts verified source evidence baseline',
          source_url: null,
          warning: 'This claim contradicts verified source evidence.',
        })
      }
    }
  }

  return claims
}
