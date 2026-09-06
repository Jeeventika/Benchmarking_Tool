import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  getComparison,
  getRecommendation,
  getEvidence,
  getDecision,
  submitDecision,
} from '../api/comparisons'
import { EvidenceStatusBadge, ContaminationRiskBadge } from '../components/StatusBadges'
import DemoDataBanner from '../components/DemoDataBanner'
import ConfidenceScorecard from '../components/ConfidenceScorecard'

const OVERRIDE_REASONS = [
  { value: 'price', label: 'Price' },
  { value: 'personal_preference', label: 'Personal preference' },
  { value: 'different_priority', label: 'Different priority' },
  { value: 'distrust_recommendation', label: "I don't trust the recommendation" },
  { value: 'more_information', label: 'More information available to me' },
  { value: 'other', label: 'Other' },
]

const RELIABILITY_STYLES = {
  high: 'bg-green-50 text-green-700 border-green-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  low: 'bg-red-50 text-red-700 border-red-200',
}

function EvidenceList({ rows }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-400">No evidence recorded.</p>
  }
  return (
    <ul className="space-y-2">
      {rows.map((e) => (
        <li key={e.id} className="text-sm">
          <div className="flex items-start justify-between gap-3">
            <span className="text-slate-700">
              <span className="text-slate-400 capitalize">{e.criterion}: </span>
              {e.result}
            </span>
            <div className="flex flex-col items-end gap-1 shrink-0">
              <EvidenceStatusBadge status={e.evidence_status} />
              <ContaminationRiskBadge risk={e.contamination_risk} />
            </div>
          </div>
          {e.contamination_risk === 'known_risk' && (
            <p className="mt-1 text-xs text-red-700">Reason: {e.contamination_reason}</p>
          )}
        </li>
      ))}
    </ul>
  )
}

export default function Decision() {
  const { id } = useParams()
  const [comparison, setComparison] = useState(null)
  const [recommendation, setRecommendation] = useState(null)
  const [evidence, setEvidence] = useState([])
  const [existingDecision, setExistingDecision] = useState(null)
  const [status, setStatus] = useState('loading')

  const [mode, setMode] = useState(null) // 'accept' | 'override' | null
  const [chosenItemId, setChosenItemId] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideNote, setOverrideNote] = useState('')
  const [submitError, setSubmitError] = useState(null)

  useEffect(() => {
    setStatus('loading')
    Promise.all([getComparison(id), getRecommendation(id), getEvidence(id), getDecision(id)])
      .then(([comparisonData, recommendationData, evidenceData, decisionData]) => {
        setComparison(comparisonData)
        setRecommendation(recommendationData)
        setEvidence(evidenceData)
        setExistingDecision(decisionData)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [id])

  if (status === 'loading') {
    return <div className="max-w-3xl mx-auto px-6 py-12 text-slate-500">Loading…</div>
  }
  if (status === 'error') {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12 text-red-600">
        Could not load this comparison. Make sure the backend and database are running.
      </div>
    )
  }

  async function acceptRecommendation() {
    setSubmitError(null)
    try {
      const result = await submitDecision(id, {
        accepted_recommendation: true,
        chosen_item_id: recommendation.recommended_item_id,
      })
      setExistingDecision({
        id: result.id,
        accepted_recommendation: true,
        chosen_item_id: recommendation.recommended_item_id,
        chosen_item_name: recommendation.recommended_item_name,
        override_reason: null,
        override_note: null,
        created_at: new Date().toISOString(),
      })
    } catch {
      setSubmitError('Could not record your decision. Please try again.')
    }
  }

  async function submitOverride(e) {
    e.preventDefault()
    setSubmitError(null)
    try {
      const result = await submitDecision(id, {
        accepted_recommendation: false,
        chosen_item_id: chosenItemId || null,
        override_reason: overrideReason || null,
        override_note: overrideNote || null,
      })
      const chosenItem = comparison.items.find((i) => String(i.id) === String(chosenItemId))
      setExistingDecision({
        id: result.id,
        accepted_recommendation: false,
        chosen_item_id: chosenItemId || null,
        chosen_item_name: chosenItem ? chosenItem.name : null,
        override_reason: overrideReason || null,
        override_note: overrideNote || null,
        created_at: new Date().toISOString(),
      })
    } catch {
      setSubmitError('Could not record your decision. Please try again.')
    }
  }

  const recommendedId = recommendation.recommended_item_id
  const supportingEvidence = evidence.filter((e) => e.comparison_item_id === recommendedId)
  const conflictingByItem = comparison.items
    .filter((item) => item.id !== recommendedId)
    .map((item) => ({
      item,
      rows: evidence.filter((e) => e.comparison_item_id === item.id),
    }))

  const overrideReasonLabel = existingDecision?.override_reason
    ? OVERRIDE_REASONS.find((r) => r.value === existingDecision.override_reason)?.label ||
      existingDecision.override_reason
    : null

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-800">Final decision</h1>
      <div className="mt-4">
        <DemoDataBanner isSynthetic={Number(id) <= 2} />
      </div>

      {/* Final Decision Section — recommendation, reliability, evidence, and the user's decision, all in one place */}
      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 space-y-6">
        <div>
          <p className="text-sm font-medium text-slate-500">System recommendation</p>
          <p className="mt-1 text-xl font-semibold text-slate-800">
            {recommendation.recommended_item_name}
          </p>
          <ul className="mt-3 space-y-1">
            {recommendation.reasons.map((reason, i) => (
              <li key={i} className="text-sm text-slate-700">
                ✓ {reason}
              </li>
            ))}
          </ul>
        </div>

        <ConfidenceScorecard
          scorecard={recommendation.scorecard}
          reliability={recommendation.reliability}
          reason={recommendation.reliability_reason}
        />

        <div className="border-t border-slate-100 pt-4">
          <p className="text-sm font-medium text-slate-500">
            Supporting evidence for {recommendation.recommended_item_name}
          </p>
          <div className="mt-2">
            <EvidenceList rows={supportingEvidence} />
          </div>
        </div>

        {conflictingByItem.map(({ item, rows }) => (
          <div key={item.id} className="border-t border-slate-100 pt-4">
            <p className="text-sm font-medium text-slate-500">
              Conflicting evidence — what {item.name} offers instead
            </p>
            <div className="mt-2">
              <EvidenceList rows={rows} />
            </div>
          </div>
        ))}
      </div>

      {/* User decision state */}
      {existingDecision ? (
        <div className="mt-6 rounded-lg border border-green-200 bg-green-50 px-5 py-4">
          <p className="text-sm font-semibold text-green-800">
            {existingDecision.accepted_recommendation ? 'System Accepted' : 'User Override'}
          </p>
          <p className="mt-1 text-sm text-green-800">
            Your final decision: <span className="font-medium">{existingDecision.chosen_item_name}</span>
          </p>
          {!existingDecision.accepted_recommendation && (
            <>
              {overrideReasonLabel && (
                <p className="mt-1 text-sm text-green-800">Reason: {overrideReasonLabel}</p>
              )}
              {existingDecision.override_note && (
                <p className="mt-1 text-sm text-green-800">Note: "{existingDecision.override_note}"</p>
              )}
            </>
          )}
          <p className="mt-2 text-xs text-green-700">
            This decision is yours. The system's recommendation is a suggestion, not a requirement.
          </p>
        </div>
      ) : (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm font-medium text-slate-500">No Decision Yet</p>
          <p className="mt-1 text-slate-600">
            Do you agree with the recommendation, or would you choose differently? The final decision is
            yours.
          </p>

          {mode === null && (
            <div className="mt-4 flex flex-wrap gap-3">
              <button
                onClick={acceptRecommendation}
                className="rounded-full bg-slate-800 text-white text-sm px-4 py-2 hover:bg-slate-700"
              >
                Agree with {recommendation.recommended_item_name}
              </button>
              <button
                onClick={() => setMode('override')}
                className="rounded-full border border-slate-300 text-slate-700 text-sm px-4 py-2 hover:bg-slate-50"
              >
                Choose another option
              </button>
            </div>
          )}

          {mode === 'override' && (
            <form onSubmit={submitOverride} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Which option would you choose?
                </label>
                <select
                  value={chosenItemId}
                  onChange={(e) => setChosenItemId(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  required
                >
                  <option value="" disabled>
                    Select an option
                  </option>
                  {comparison.items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Why did you choose differently?
                </label>
                <select
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  required
                >
                  <option value="" disabled>
                    Select a reason
                  </option>
                  {OVERRIDE_REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">
                  Anything you'd like to add? (optional)
                </label>
                <textarea
                  value={overrideNote}
                  onChange={(e) => setOverrideNote(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              {submitError && <p className="text-sm text-red-600">{submitError}</p>}

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="rounded-full bg-slate-800 text-white text-sm px-4 py-2 hover:bg-slate-700"
                >
                  Confirm final decision
                </button>
                <button
                  type="button"
                  onClick={() => setMode(null)}
                  className="rounded-full border border-slate-300 text-slate-700 text-sm px-4 py-2 hover:bg-slate-50"
                >
                  Back
                </button>
              </div>
            </form>
          )}

          {submitError && mode === null && <p className="mt-3 text-sm text-red-600">{submitError}</p>}
        </div>
      )}
    </div>
  )
}
