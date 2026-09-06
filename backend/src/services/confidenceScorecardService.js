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

  // 1. Source Quality
  let sourceQualityRating = 'high'
  let sourceQualityReason = 'Sources are authoritative institutional publications, official technical specifications, or verified registries.'
  const hasContamination = evidenceRows.some((e) => e.contamination_risk === 'known_risk')
  const hasReviewStatus = evidenceRows.some((e) => e.evidence_status === 'needs_review')
  const hasUnverified = evidenceRows.some(
    (e) => (e.source_name && e.source_name.includes('Unverified')) || (e.result && e.result.includes('Reliable source not found'))
  )

  if (hasContamination) {
    sourceQualityRating = 'low'
    sourceQualityReason = 'Known data contamination risk was flagged in the underlying evidence.'
  } else if (hasUnverified) {
    sourceQualityRating = 'low'
    sourceQualityReason = 'One or more criteria lack verified primary sources; sufficient reliable evidence was not found.'
  } else if (hasReviewStatus) {
    sourceQualityRating = 'medium'
    sourceQualityReason = 'Certain sources require secondary verification or self-report review.'
  }

  // 2. Completeness
  let completenessRating = 'high'
  let completenessReason = `Full evidence recorded across all ${items.length} options and all ${criteria.length} criteria.`
  const unverifiedCount = evidenceRows.filter(
    (e) => (e.result && e.result.includes('Reliable source not found')) || (e.source_name && e.source_name.includes('Unverified'))
  ).length

  if (actualCount === 0 || unverifiedCount === actualCount) {
    completenessRating = 'low'
    completenessReason = 'No verified source evidence could be retrieved for the requested criteria.'
  } else if (unverifiedCount > 0) {
    completenessRating = 'low'
    completenessReason = `Evidence gap: ${unverifiedCount} of ${actualCount} criteria could not be verified with an authoritative source.`
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

  // 3. Recency
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

  // 4. Sample Size
  let sampleSizeRating = 'high'
  let sampleSizeReason = 'Metrics reflect comprehensive population cohorts, national ranking indices, or standard benchmark suites.'
  const hasSmallSample = evidenceRows.some((e) =>
    /\b(preliminary|pilot|anecdotal|small sample|n\s*<\s*50)\b/i.test(e.conditions || '')
  )
  if (hasSmallSample) {
    sampleSizeRating = 'medium'
    sampleSizeReason = 'Certain criteria rely on smaller cohorts or preliminary test iterations.'
  }

  // 5. Methodology
  let methodologyRating = 'high'
  let methodologyReason = 'Evaluation protocols follow standardized, published institutional or laboratory procedures.'
  const hasSubjectiveMethod = evidenceRows.some((e) =>
    /\b(informal|uncalibrated|self-reported\s+survey)\b/i.test(e.method || '')
  )
  if (hasSubjectiveMethod) {
    methodologyRating = 'medium'
    methodologyReason = 'Includes self-reported or uncalibrated survey responses that carry subjective variance.'
  }

  // 6. Consistency Across Sources
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
    source_quality: {
      label: 'Source Quality',
      rating: sourceQualityRating,
      reason: sourceQualityReason,
    },
    completeness: {
      label: 'Completeness',
      rating: completenessRating,
      reason: completenessReason,
    },
    recency: {
      label: 'Recency',
      rating: recencyRating,
      reason: recencyReason,
    },
    sample_size: {
      label: 'Sample Size',
      rating: sampleSizeRating,
      reason: sampleSizeReason,
    },
    methodology: {
      label: 'Methodology',
      rating: methodologyRating,
      reason: methodologyReason,
    },
    consistency_across_sources: {
      label: 'Consistency Across Sources',
      rating: consistencyRating,
      reason: consistencyReason,
    },
  }

  const ratings = Object.values(factors).map((f) => f.rating)

  let overallScore = 'medium'
  let drivingRationale = ''

  if (ratings.includes('low')) {
    overallScore = 'low'
    const lowFactors = Object.entries(factors)
      .filter(([_, f]) => f.rating === 'low')
      .map(([_, f]) => f.label)
    drivingRationale = `Confidence is rated Low because ${lowFactors.join(' and ')} rated Low. ${
      factors[Object.keys(factors).find((k) => factors[k].rating === 'low')].reason
    }`
  } else if (ratings.every((r) => r === 'high')) {
    overallScore = 'high'
    drivingRationale =
      'Confidence is rated High because all six evidence-quality factors (source quality, completeness, recency, sample size, methodology, consistency) met rigorous standards.'
  } else {
    overallScore = 'medium'
    const mediumFactors = Object.entries(factors)
      .filter(([_, f]) => f.rating === 'medium')
      .map(([_, f]) => f.label)
    drivingRationale = `Confidence is rated Medium due to ${mediumFactors.join(', ')} factors requiring observation. ${
      factors[Object.keys(factors).find((k) => factors[k].rating === 'medium')].reason
    }`
  }

  return {
    overallScore,
    drivingRationale,
    factors,
  }
}
