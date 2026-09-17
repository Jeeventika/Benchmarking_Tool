// Normalisation presentation helpers.
//
// "Normalise" for this MVP means: present results from different
// sources/methodologies in a CONSISTENT STRUCTURE, not mathematically
// convert them into one common score. See Results.jsx for where this
// is used.
//
// This module only ever derives a short, human-readable unit/scale LABEL
// from the text a source already reported (e.g. spotting that a value is
// a currency-per-period figure, a percentage, or a rank). It never
// converts between units and never guesses a value that isn't already in
// the source text. If no recognizable unit/scale is present, it returns
// null — the caller must show that plainly (e.g. "—"), never fabricate
// one. This keeps the function generic across item types (colleges,
// products, research papers, AI models, etc.) rather than hard-coded to
// any one domain.

const CURRENCY_SYMBOLS = { $: 'USD', '€': 'EUR', '£': 'GBP', '¥': 'JPY' }

export function getUnitScale(resultText) {
  if (!resultText) return null
  const text = String(resultText)

  // Currency amount, optionally "/period" (e.g. "$28,500/year").
  const currencyMatch = text.match(/([$€£¥])\s?[\d,]+(\.\d+)?/)
  if (currencyMatch) {
    const currencyName = CURRENCY_SYMBOLS[currencyMatch[1]] || 'currency'
    const periodMatch = text.match(/\/\s*([a-zA-Z]+)/)
    return periodMatch ? `${currencyName} / ${periodMatch[1]}` : currencyName
  }

  // Percentage figures.
  if (/\d+(\.\d+)?\s*%/.test(text)) {
    return '%'
  }

  // Ranking / position figures (e.g. "Ranked #45 nationally").
  if (/rank(ed)?\s*#?\s*\d+/i.test(text)) {
    return 'Rank position'
  }

  // Duration / battery life in hours (e.g. "27 hours continuous video playback").
  if (/\b\d+(\.\d+)?\s*(hours?|hrs?)\b/i.test(text)) {
    return 'Hours'
  }

  // Latency in milliseconds.
  if (/\b\d+(\.\d+)?\s*(ms|milliseconds?)\b/i.test(text)) {
    return 'Milliseconds (ms)'
  }

  // Camera resolution in Megapixels.
  if (/\b\d+\s*MP\b/i.test(text)) {
    return 'Megapixels (MP)'
  }

  // No recognizable unit/scale in the text — do not invent one.
  return null
}
export function normalizeResult(result) {
  return {
    originalValue: result.result,
    normalizedValue: result.result,
    unitScale: getUnitScale(result.result),
    source: result.source_name,
    date: result.source_date,
    method: result.method,
    conditions: result.conditions,
    transformationRule:
      'Preserve the source-reported value and standardize its unit/scale and source metadata. No numerical conversion is performed.'
  }
}