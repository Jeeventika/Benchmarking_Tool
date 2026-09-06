import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getRecommendation, getEvidence } from '../api/comparisons'
import DemoDataBanner from '../components/DemoDataBanner'
import ConfidenceScorecard from '../components/ConfidenceScorecard'

const RELIABILITY_STYLES = {
  high: 'bg-green-50 text-green-700 border-green-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-red-50 text-red-700 border-red-200',
}

export default function Recommendation() {
  const { id } = useParams()
  const [recommendation, setRecommendation] = useState(null)
  const [evidence, setEvidence] = useState([])
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    setStatus('loading')
    Promise.all([getRecommendation(id), getEvidence(id)])
      .then(([recommendationData, evidenceData]) => {
        setRecommendation(recommendationData)
        setEvidence(evidenceData)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [id])

  if (status === 'loading') {
    return <div className="max-w-3xl mx-auto px-6 py-12 text-slate-500">Loading recommendation…</div>
  }
  if (status === 'error') {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12 text-red-600">
        Could not load a recommendation for this comparison.
      </div>
    )
  }

  // Only warn when the evidence actually records a known contamination risk —
  // never inferred from item_type or criterion name.
  const hasKnownContaminationRisk = evidence.some((e) => e.contamination_risk === 'known_risk')

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-800">Recommended option</h1>
      <div className="mt-4">
        <DemoDataBanner isSynthetic={Number(id) <= 2} />
      </div>

      {hasKnownContaminationRisk && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-4 py-2 font-medium">
          ⚠ CONTAMINATION RISK — some of the underlying evidence has a known contamination risk.
          Review that evidence before relying on this recommendation.
        </div>
      )}

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <p className="text-xl font-semibold text-slate-800">{recommendation.recommended_item_name}</p>

        <p className="mt-5 text-sm font-medium text-slate-500">Why?</p>
        <ul className="mt-2 space-y-1">
          {recommendation.reasons.map((reason, i) => (
            <li key={i} className="text-sm text-slate-700">
              ✓ {reason}
            </li>
          ))}
        </ul>

        <ConfidenceScorecard
          scorecard={recommendation.scorecard}
          reliability={recommendation.reliability}
          reason={recommendation.reliability_reason}
        />
      </div>

      <Link
        to={`/decision/${id}`}
        className="mt-8 inline-block rounded-full bg-slate-800 text-white text-sm px-4 py-2 hover:bg-slate-700"
      >
        Make your decision →
      </Link>
    </div>
  )
}
