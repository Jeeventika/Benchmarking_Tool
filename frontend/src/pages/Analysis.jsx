import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getComparison, getAnalysis, getEvidence } from '../api/comparisons'
import DemoDataBanner from '../components/DemoDataBanner'
import ExecutiveSummaryBanner from '../components/ExecutiveSummaryBanner'

export default function Analysis() {
  const { id } = useParams()
  const [comparison, setComparison] = useState(null)
  const [analysis, setAnalysis] = useState(null)
  const [evidence, setEvidence] = useState([])
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    setStatus('loading')
    Promise.all([getComparison(id), getAnalysis(id), getEvidence(id)])
      .then(([comparisonData, analysisData, evidenceData]) => {
        setComparison(comparisonData)
        setAnalysis(analysisData)
        setEvidence(evidenceData)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [id])

  if (status === 'loading') {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="rounded-lg border border-slate-200 bg-white p-8 text-center space-y-3 shadow-sm">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-slate-800"></div>
          <h2 className="text-lg font-semibold text-slate-800">Generating AI Analysis</h2>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Analyzing your options using local Ollama. This takes a few moments on the first load…
          </p>
        </div>
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12 text-red-600">
        Could not load this comparison. Make sure the backend and database are running.
      </div>
    )
  }

  const content = analysis?.content || ''
  const parts = content.split(/LIMITATION:/i)
  const mainText = parts[0]?.replace(/\*\*+$/, '').trim() || ''
  const limitationText = parts.length > 1 ? parts.slice(1).join('LIMITATION:').replace(/^\*\*+/, '').trim() : null
  // Only warn when the evidence actually records a known contamination risk —
  // never inferred from item_type or criterion name.
  const hasKnownContaminationRisk = evidence.some((e) => e.contamination_risk === 'known_risk')

  const rawClaims = analysis?.claims
  const claims = Array.isArray(rawClaims)
    ? rawClaims
    : typeof rawClaims === 'string'
      ? JSON.parse(rawClaims || '[]')
      : []

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-800">Analysis</h1>
      <div className="mt-4">
        <DemoDataBanner isSynthetic={Number(id) <= 2} />
      </div>

      <div className="mt-6">
        <ExecutiveSummaryBanner comparison={comparison} evidenceCount={evidence.length} />
      </div>

      {analysis.disagreement_flag && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm px-4 py-2 font-medium">
          SOURCES DISAGREE — some of the underlying evidence conflicts. See the details below.
        </div>
      )}

      {hasKnownContaminationRisk && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-4 py-2 font-medium">
          ⚠ CONTAMINATION RISK — some of the underlying evidence has a known contamination risk.
          Review that evidence before relying on this analysis.
        </div>
      )}
            <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <span className="inline-block text-xs font-medium uppercase tracking-wide text-emerald-700 bg-emerald-50 rounded-full px-2 py-1">
          Source evidence / facts
        </span>

        <p className="mt-2 text-sm text-slate-500">
          These are the source-reported facts used as the basis for the analysis.
          They are shown separately from AI-generated interpretation.
        </p>

        <div className="mt-4 space-y-3">
          {evidence.length === 0 ? (
            <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm text-slate-400">
              No specific source evidence recorded yet for this comparison.
            </div>
          ) : (
            evidence.map((e) => (
              <div
                key={e.id}
                className="rounded-md border border-slate-100 bg-slate-50 p-3"
              >
                <div className="font-medium text-slate-700">
                  {e.criterion}
                </div>

                <div className="mt-1 text-sm text-slate-800">
                  {e.result}
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  Source: {e.source_name || '—'}
                  {' · '}
                  Date:{' '}
                  {e.source_date
                    ? new Date(e.source_date).toLocaleDateString()
                    : '—'}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="inline-block text-xs font-medium uppercase tracking-wide text-indigo-600 bg-indigo-50 rounded-full px-2 py-1">
            AI-generated analysis / interpretation
          </span>
          {analysis?.generated_by === 'ollama' ? (
            <span className="inline-flex items-center text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
              Generated by Ollama
            </span>
          ) : (
            <span className="inline-flex items-center text-xs font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-full px-2.5 py-0.5">
              Fallback analysis used
            </span>
          )}
        </div>
        <p className="mt-3 text-slate-700 leading-relaxed whitespace-pre-line">
          {mainText.trim()}
        </p>
        {limitationText && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-sm font-medium text-slate-500">Things to consider</p>
            <p className="mt-1 text-sm text-slate-500">{limitationText.trim()}</p>
          </div>
        )}
      </div>

      {/* Unsupported Claims Classifier — Decided OPEN Item from Product Owner */}
      {claims.length > 0 && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-block text-xs font-semibold uppercase tracking-wide text-indigo-700 bg-indigo-50 rounded-full px-2.5 py-1">
              Claims Classifier & Grounding Verification
            </span>
            <span className="text-xs text-slate-400">
              {claims.filter((c) => c.status === 'grounded').length} grounded · {claims.filter((c) => c.status !== 'grounded').length} unverified
            </span>
          </div>

          <p className="mt-2 text-sm text-slate-500">
            Every claim in the analysis is independently checked against recorded source evidence. A claim is flagged as potentially unverified if it lacks direct source backing or differs in key details.
          </p>

          <div className="mt-4 space-y-3">
            {claims.map((claim) => {
              const isGrounded = claim.status === 'grounded'
              return (
                <div
                  key={claim.id}
                  className={`rounded-lg border p-3.5 text-sm transition-colors ${
                    isGrounded
                      ? 'border-slate-200 bg-white'
                      : 'border-amber-200 bg-amber-50/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-slate-800 leading-snug">{claim.claim}</p>
                    <span
                      className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full shrink-0 border ${
                        isGrounded
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-100 text-amber-800 border-amber-300'
                      }`}
                    >
                      {isGrounded ? 'Grounded ✓' : 'Potentially Unverified ⚠'}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                    <div>
                      <span className="text-slate-400">Target: </span>
                      <span className="font-medium text-slate-700">{claim.item_name}</span>
                      {claim.criterion && <span> ({claim.criterion})</span>}
                    </div>
                    <div>
                      <span className="text-slate-400">Source: </span>
                      {claim.source_url ? (
                        <a
                          href={claim.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-indigo-600 hover:underline font-medium"
                        >
                          {claim.source_reference}
                        </a>
                      ) : (
                        <span>{claim.source_reference || '—'}</span>
                      )}
                    </div>
                  </div>

                  {claim.warning && (
                    <p className="mt-2 text-xs font-medium text-amber-800 bg-amber-100/70 border border-amber-200 rounded px-2.5 py-1.5">
                      Warning: {claim.warning}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Link
        to={`/recommendation/${id}`}
        className="mt-8 inline-block rounded-full bg-slate-800 text-white text-sm px-4 py-2 hover:bg-slate-700"
      >
        See the recommendation →
      </Link>
    </div>
  )
}
