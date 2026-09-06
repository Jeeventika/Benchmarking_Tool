const EVIDENCE_STATUS_STYLES = {
  reliable: { label: 'Reliable', className: 'bg-green-50 text-green-700 border-green-200' },
  needs_review: {
    label: 'Needs review',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  outdated: { label: 'Outdated', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  conflicting: { label: 'Conflicting', className: 'bg-red-50 text-red-700 border-red-200' },
}

export function EvidenceStatusBadge({ status }) {
  const style = EVIDENCE_STATUS_STYLES[status] || {
    label: status,
    className: 'bg-slate-50 text-slate-600 border-slate-200',
  }
  return (
    <span className={`inline-flex items-center text-xs font-medium border rounded-full px-2 py-0.5 ${style.className}`}>
      {style.label}
    </span>
  )
}

const COMPARABILITY_STYLES = {
  comparable: { label: '✓ Comparable', className: 'bg-green-50 text-green-700 border-green-200' },
  partly_comparable: {
    label: '⚠ Partly comparable',
    className: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  not_comparable: { label: '✕ Not comparable', className: 'bg-red-50 text-red-700 border-red-200' },
  // Client-side-only pseudo-status: no comparability_checks row exists yet
  // for this criterion. Distinct from 'not_comparable' — this means
  // "not yet assessed", not "assessed and found not comparable".
  not_assessed: { label: 'Not yet assessed', className: 'bg-slate-50 text-slate-500 border-slate-200' },
}

export function ComparabilityBadge({ status }) {
  const style = COMPARABILITY_STYLES[status] || {
    label: status,
    className: 'bg-slate-50 text-slate-600 border-slate-200',
  }
  return (
    <span className={`inline-flex items-center text-sm font-medium border rounded-full px-3 py-1 ${style.className}`}>
      {style.label}
    </span>
  )
}

// Contamination risk is an OPTIONAL, separate property from evidence_status.
// It should only render when the underlying evidence explicitly records an
// assessment — contamination_risk is null/undefined for most evidence
// (e.g. cost or placement figures), which is expected and not an error.
const CONTAMINATION_RISK_STYLES = {
  known_risk: {
    label: '⚠ Contamination risk: Known',
    className: 'bg-red-50 text-red-700 border-red-200',
  },
  no_known_risk: {
    label: 'No known contamination risk',
    className: 'bg-slate-50 text-slate-600 border-slate-200',
  },
}

export function ContaminationRiskBadge({ risk }) {
  if (!risk) return null
  const style = CONTAMINATION_RISK_STYLES[risk] || {
    label: risk,
    className: 'bg-slate-50 text-slate-600 border-slate-200',
  }
  return (
    <span className={`inline-flex items-center text-xs font-medium border rounded-full px-2 py-0.5 ${style.className}`}>
      {style.label}
    </span>
  )
}
