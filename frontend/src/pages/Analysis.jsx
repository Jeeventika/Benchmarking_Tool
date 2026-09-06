import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getComparison, getAnalysis, getEvidence } from '../api/comparisons'
import DemoDataBanner from '../components/DemoDataBanner'

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
    return <div className="max-w-3xl mx-auto px-6 py-12 text-slate-500">Loading analysis…</div>
  }
  if (status === 'error') {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12 text-red-600">
        Could not load this comparison. Make sure the backend and database are running.
      </div>
    )
  }

  const [mainText, limitationText] = analysis.content.split('LIMITATION:')
  // Only warn when the evidence actually records a known contamination risk —
  // never inferred from item_type or criterion name.
  const hasKnownContaminationRisk = evidence.some((e) => e.contamination_risk === 'known_risk')

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-800">Analysis</h1>
      <div className="mt-4">
        <DemoDataBanner />
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
          {evidence.map((e) => (
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
          ))}
        </div>
      </div>
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <span className="inline-block text-xs font-medium uppercase tracking-wide text-indigo-600 bg-indigo-50 rounded-full px-2 py-1">
                    AI-generated analysis / interpretation
        </span>
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

      <Link
        to={`/recommendation/${id}`}
        className="mt-8 inline-block rounded-full bg-slate-800 text-white text-sm px-4 py-2 hover:bg-slate-700"
      >
        See the recommendation →
      </Link>
    </div>
  )
}
