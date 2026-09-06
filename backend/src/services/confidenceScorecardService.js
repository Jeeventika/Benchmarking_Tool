// Six-Factor Evidence-Quality Scorecard Engine
// Based on the Product Owner ruling:
// Factors: source_quality, completeness, recency, sample_size, methodology, consistency_across_sources
// Rule:
// - Low if any one factor is rated Low.
// - High only if all six are High.
// - Medium otherwise.
// Rationale: explicitly names which factor or factors drove the rating.

export function evaluateConfidenceScorecard(comparison, items, evidenceRows, comparabilityChecks) {
  const criteria = comparison.criteria || []
  const expectedCount = items.length * criteria.length
  const actualCount = evidenceRows.length

  // 1. Source Quality (Jeeventika's stream: contamination/credibility risk)
  let sourceQualityRating = 'high'
  let sourceQualityReason = 'Sources are authoritative institutional publications, official technical specifications, or verified registries.'
  const hasContamination = evidenceRows.some((e) => e.contamination_risk === 'known_risk')
  const hasReviewStatus = evidenceRows.some((e) => e.evidence_status === 'needs_review')

  if (hasContamination) {
    sourceQualityRating = 'low'
    sourceQualityReason = 'Known data contamination risk was flagged in the underlying evidence.'
  } else if (hasReviewStatus) {
    sourceQualityRating = 'medium'
    sourceQualityReason = 'Certain sources require secondary verification or self-report review.'
  }

  // 2. Completeness (Kanishma's stream: coverage across items & criteria)
  let completenessRating = 'high'
  let completenessReason = `Full evidence recorded across all ${items.length} options and all ${criteria.length} criteria.`
  if (actualCount === 0) {
    completenessRating = 'low'
    completenessReason = 'No source evidence has been recorded for this comparison.'
  } else if (actualCount < expectedCount) {
    const ratio = actualCount / expectedCount
    if (ratio < 0.6) {
      completenessRating = 'low'
      completenessReason = `Significant evidence gaps: only ${actualCount} of ${expectedCount} expected data points are recorded.`
    } else {
      completenessRating = 'medium'
      completenessReason = `Partial coverage: ${actualCount} of ${expectedCount} item/criterion combinations have recorded evidence.`
    }
  }

  // 3. Recency (Dates of evidence)
  let recencyRating = 'high'
  let recencyReason = 'All evidence sources were published or updated within the current reporting cycle (last 12–24 months).'
  const hasOutdated = evidenceRows.some((e) => e.evidence_status === 'outdated')
  const nowYear = new Date().getFullYear()
  const oldestDate = evidenceRows.reduce((min, e) => {
    if (!e.source_date) return min
    const d = new Date(e.source_date).getFullYear()
    return d < min ? d : min
  }, nowYear)

  if (hasOutdated || (nowYear - oldestDate > 4)) {
    recencyRating = 'low'
    recencyReason = 'One or more evidence sources are older than 4 years or flagged as outdated.'
  } else if (nowYear - oldestDate >= 2) {
    recencyRating = 'medium'
    recencyReason = `Some evidence figures date back to ${oldestDate}, which may not reflect the newest revisions.`
  }

  // 4. Sample Size (Survey cohort or benchmark evaluation depth)
  let sampleSizeRating = 'high'
  let sampleSizeReason = 'Metrics reflect comprehensive population cohorts, national ranking indices, or standard benchmark suites.'
  const hasSmallSample = evidenceRows.some((e) =>
    /\b(preliminary|pilot|anecdotal|small sample|n\s*<\s*50)\b/i.test(e.conditions || '')
  )
  if (hasSmallSample) {
    sampleSizeRating = 'medium'
    sampleSizeReason = 'Certain criteria rely on smaller cohorts or preliminary test iterations.'
  }

  // 5. Methodology (Kanishma & Jeeventika stream: standardized vs ad-hoc)
  let methodologyRating = 'high'
  let methodologyReason = 'Evaluation protocols follow standardized, published institutional or laboratory procedures.'
  const hasSubjectiveMethod = evidenceRows.some((e) =>
    /\b(informal|uncalibrated|self-reported\s+survey)\b/i.test(e.method || '')
  )
  if (hasSubjectiveMethod) {
    methodologyRating = 'medium'
    methodologyReason = 'Includes self-reported or uncalibrated survey responses that carry subjective variance.'
  }

  // 6. Consistency Across Sources (Sruthi & Mobisha stream: comparability & conflict)
  let consistencyRating = 'high'
  let consistencyReason = 'All evaluated criteria are confirmed directly comparable without conflicting data points.'
  const hasNotComparable = comparabilityChecks.some((c) => c.status === 'not_comparable')
  const hasPartlyComparable = comparabilityChecks.some((c) => c.status === 'partly_comparable')
  const hasConflictingEvidence = evidenceRows.some((e) => e.evidence_status === 'conflicting')

  if (hasNotComparable || hasConflictingEvidence) {
    consistencyRating = 'low'
    consistencyReason = 'Conflicting evidence or non-comparable methodologies detected across items.'
  } else if (hasPartlyComparable) {
    consistencyRating = 'medium'
    consistencyReason = 'Some criteria are only partly comparable due to differing measurement windows or baselines.'
  }

  const factors = {
    source_quality: { rating: sourceQualityRating, reason: sourceQualityReason, label: 'Source Quality' },
    completeness: { rating: completenessRating, reason: completenessReason, label: 'Completeness' },
    recency: { rating: recencyRating, reason: recencyReason, label: 'Recency' },
    sample_size: { rating: sampleSizeRating, reason: sampleSizeReason, label: 'Sample Size' },
    methodology: { rating: methodologyRating, reason: methodologyReason, label: 'Methodology' },
    consistency_across_sources: { rating: consistencyRating, reason: consistencyReason, label: 'Consistency Across Sources' },
  }

  // Strict Product Owner Rule:
  // Low if any one factor is rated Low.
  // High only if all six are High.
  // Medium otherwise.
  const allRatings = Object.values(factors).map((f) => f.rating)
  let overallScore = 'medium'
  let drivingRationale = ''

  const lowFactors = Object.entries(factors).filter(([_, f]) => f.rating === 'low')
  const mediumFactors = Object.entries(factors).filter(([_, f]) => f.rating === 'medium')
  const highFactors = Object.entries(factors).filter(([_, f]) => f.rating === 'high')

  if (lowFactors.length > 0) {
    overallScore = 'low'
    const names = lowFactors.map(([_, f]) => f.label).join(' and ')
    const factorReasons = lowFactors.map(([_, f]) => f.reason).join(' ')
    drivingRationale = `Confidence is rated Low because ${names} rated Low. ${factorReasons}`
  } else if (allRatings.every((r) => r === 'high')) {
    overallScore = 'high'
    drivingRationale = 'Confidence is rated High because all six evidence-quality factors (Source Quality, Completeness, Recency, Sample Size, Methodology, and Consistency Across Sources) met the highest standard.'
  } else {
    overallScore = 'medium'
    const mediumNames = mediumFactors.map(([_, f]) => f.label).join(', ')
    const mediumDetails = mediumFactors.map(([_, f]) => f.reason).join(' ')
    const highNames = highFactors.map(([_, f]) => f.label).join(', ')
    drivingRationale = `Confidence is rated Medium: while ${highNames} achieved High ratings, the score is driven to Medium by ${mediumNames} (${mediumDetails}).`
  }

  return {
    overallScore,
    drivingRationale,
    factors,
  }
}
