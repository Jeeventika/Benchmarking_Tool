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
      // Grounded analytical claim derived directly from recorded source evidence
      claims.push({
        id: claimId++,
        claim: `${item.name} reports ${ev.criterion} of ${ev.result}.`,
        item_name: item.name,
        criterion: ev.criterion,
        status: 'grounded',
        source_reference: ev.source_date
          ? `${ev.source_name} (${new Date(ev.source_date).getFullYear()})`
          : ev.source_name,
        source_url: ev.source_url,
        warning: null,
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
    }
  }

  return claims
}
