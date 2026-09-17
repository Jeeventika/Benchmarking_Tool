import { useState } from 'react'

const RATING_STYLES = {
  high: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-rose-50 text-rose-700 border-rose-200',
}

export default function ConfidenceScorecard({ scorecard, reliability, reason, defaultExpanded = false }) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const hasScorecard = scorecard && Object.keys(scorecard).length > 0
  const factors = hasScorecard ? Object.entries(scorecard) : []

  return (
    <div className="mt-6 border-t border-slate-100 pt-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Confidence Score & Evidence Quality
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Evaluated using the six-factor evidence scorecard rule: Low if any factor is Low, High only if all six are High.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          aria-controls="confidence-scorecard-details"
          className={`inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider border rounded-full px-3 py-1 shrink-0 cursor-pointer transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-400 hover:opacity-90 ${
            RATING_STYLES[reliability] || 'bg-slate-50 text-slate-600 border-slate-200'
          }`}
          title={isExpanded ? 'Click to collapse evidence factor breakdown' : 'Click to view six-factor evidence breakdown'}
        >
          <span>{reliability || 'Medium'} Confidence</span>
          <svg
            className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {isExpanded && (
        <div id="confidence-scorecard-details" className="mt-4 space-y-4">
          {reason && (
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-700">
              <span className="font-semibold text-slate-800">Score Rationale: </span>
              {reason}
            </div>
          )}

          {hasScorecard && (
            <div>
              <h4 className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-2.5">
                Six-Factor Evidence Scorecard Breakdown
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {factors.map(([key, f]) => (
                  <div
                    key={key}
                    className="rounded-lg border border-slate-200 bg-white p-3 space-y-1.5 shadow-2xs"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-700">{f.label || key}</span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                          RATING_STYLES[f.rating] || 'bg-slate-50 text-slate-600 border-slate-200'
                        }`}
                      >
                        {f.rating}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 leading-relaxed">{f.reason}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
