import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getComparison, getEvidence, getComparability } from '../api/comparisons'
import { ComparabilityBadge, EvidenceStatusBadge, ContaminationRiskBadge } from '../components/StatusBadges'
import DemoDataBanner from '../components/DemoDataBanner'
import ExecutiveSummaryBanner from '../components/ExecutiveSummaryBanner'
import { getUnitScale, normalizeResult } from '../utils/normalization'

export default function Results() {
  const { id } = useParams()
  const [comparison, setComparison] = useState(null)
  const [evidence, setEvidence] = useState([])
  const [comparability, setComparability] = useState([])
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    setStatus('loading')
    Promise.all([getComparison(id), getEvidence(id), getComparability(id)])
      .then(([comparisonData, evidenceData, comparabilityData]) => {
        setComparison(comparisonData)
        setEvidence(evidenceData)
        setComparability(comparabilityData)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [id])

  if (status === 'loading') {
    return <div className="max-w-3xl mx-auto px-6 py-12 text-slate-500">Loading comparison…</div>
  }
  if (status === 'error') {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12 text-red-600">
        Could not load this comparison. Make sure the backend and database are running.
      </div>
    )
  }

  const criteria = comparison.criteria
  // NOTE: a single item/criterion pair can have more than one evidence row
  // (e.g. two rankings that disagree). Return all of them — using .find()
  // here previously hid conflicting evidence whenever a criterion had more
  // than one source.
  const resultsFor = (itemId, criterion) =>
    evidence.filter((e) => e.comparison_item_id === itemId && e.criterion === criterion)
  const comparabilityFor = (criterion) => comparability.find((c) => c.criterion === criterion)

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-800">Your Comparison</h1>
      <div className="mt-4">
        <DemoDataBanner isSynthetic={Number(id) <= 2} />
      </div>

      <div className="mt-6">
        <ExecutiveSummaryBanner comparison={comparison} evidenceCount={evidence.length} />
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 font-medium text-slate-500">Criterion</th>
              {comparison.items.map((item) => (
                <th key={item.id} className="px-4 py-3 font-medium text-slate-500">
                  {item.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {criteria.map((criterion) => (
              <tr key={criterion} className="border-b border-slate-100 last:border-0 align-top">
                <td className="px-4 py-3 text-slate-700">
                  <div className="font-medium capitalize">{criterion}</div>
                  {/* Same comparability status shown per-criterion in the detail
                      section below — surfaced here too so it sits next to the
                      results it applies to, in the same consistent structure. */}
                  <div className="mt-1.5">
                    <ComparabilityBadge status={comparabilityFor(criterion)?.status || 'not_assessed'} />
                  </div>
                </td>
                {comparison.items.map((item) => {
                  const results = resultsFor(item.id, criterion)
                  if (results.length === 0) {
                    return (
                      <td key={item.id} className="px-4 py-3 text-slate-600">
                        —
                      </td>
                    )
                  }
                  return (
                    <td key={item.id} className="px-4 py-3 text-slate-600">
                      <div className="space-y-3">
                        {results.map((r) => {
                          const unitScale = getUnitScale(r.result)
                          return (
                            <div
                              key={r.id}
                              className="border-b border-slate-100 last:border-0 pb-3 last:pb-0"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <span>{r.result}</span>
                                  {/* Unit/scale is a label describing what kind of value this
                                      is (currency, %, rank, …) — never a converted value, and
                                      never shown when it can't be determined from the source
                                      text (see normalization.js). */}
                                  <div className="mt-0.5 text-xs text-slate-400">
                                    Unit/scale: {unitScale || '—'}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                  <EvidenceStatusBadge status={r.evidence_status} />
                                  <ContaminationRiskBadge risk={r.contamination_risk} />
                                </div>
                              </div>
                              {r.contamination_risk === 'known_risk' && (
                                <p className="mt-1 text-xs text-red-700">{r.contamination_reason}</p>
                              )}
                              {/* Source / date / method / conditions — the same fields shown
                                  on the Research page, presented here in the same consistent
                                  structure for every source so results can be read side by
                                  side without losing how each was actually produced. */}
                              <dl className="mt-2 grid grid-cols-1 gap-y-0.5 text-xs text-slate-500">
                                <div>
                                  <dt className="inline text-slate-400">Source: </dt>
                                  <dd className="inline">
                                    {r.source_url ? (
                                      <a
                                        href={r.source_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-indigo-600 hover:text-indigo-800 underline"
                                      >
                                        {r.source_name}
                                      </a>
                                    ) : (
                                      r.source_name
                                    )}
                                  </dd>
                                </div>
                                <div>
                                  <dt className="inline text-slate-400">Date: </dt>
                                  <dd className="inline">
                                    {r.source_date ? new Date(r.source_date).toLocaleDateString() : '—'}
                                  </dd>
                                </div>
                                {r.method && (
                                  <div>
                                    <dt className="inline text-slate-400">Method: </dt>
                                    <dd className="inline">{r.method}</dd>
                                  </div>
                                )}
                                {r.conditions && (
                                  <div>
                                    <dt className="inline text-slate-400">Conditions: </dt>
                                    <dd className="inline">{r.conditions}</dd>
                                  </div>
                                )}
                              </dl>
                            </div>
                          )
                        })}
                      </div>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="mt-10 text-lg font-semibold text-slate-800">
        Normalization evidence
      </h2>

      <p className="mt-2 text-sm text-slate-500">
        This step puts results from different sources into a consistent
        comparison structure without changing the original source value.
      </p>

      <div className="mt-4 space-y-4">
        {evidence.length === 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-400">
            No evidence recorded to normalize yet.
          </div>
        ) : (
          evidence.map((r) => {
            const normalized = normalizeResult(r)

          return (
            <div
              key={r.id}
              className="rounded-lg border border-slate-200 bg-white p-4"
            >
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Before — source value
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-800">
                    {normalized.originalValue}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    Transformation rule
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {normalized.transformationRule}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-medium uppercase tracking-wide text-slate-400">
                    After — normalized representation
                  </div>
                  <div className="mt-1 text-sm font-medium text-slate-800">
                    {normalized.normalizedValue}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    Unit/scale: {normalized.unitScale || 'Not identified'}
                  </div>
                </div>
              </div>

              <div className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">
                <span className="font-medium text-slate-700">Source:</span>{' '}
                {r.source_url ? (
                  <a
                    href={r.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-indigo-600 hover:text-indigo-800 underline"
                  >
                    {normalized.source || '—'}
                  </a>
                ) : (
                  normalized.source || '—'
                )}
                {' · '}
                <span className="font-medium text-slate-700">Date:</span>{' '}
                {normalized.date
                  ? new Date(normalized.date).toLocaleDateString()
                  : '—'}
              </div>
            </div>
          )
        }))}
      </div>      
      <h2 className="mt-10 text-lg font-semibold text-slate-800">
        Can these results be fairly compared?
      </h2>
      
      <div className="mt-3 space-y-3">
        {criteria.map((criterion) => {
          const c = comparabilityFor(criterion)
          // A criterion with no recorded check is genuinely unassessed —
          // show that plainly instead of silently omitting it, so absence
          // of a check is never mistaken for "comparable".
          return (
            <div key={criterion} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium text-slate-800 capitalize">{criterion}</span>
                <ComparabilityBadge status={c ? c.status : 'not_assessed'} />
              </div>
              <p className="mt-2 text-sm text-slate-500">
                {c ? c.explanation : 'A comparability check has not been recorded for this criterion yet.'}
              </p>
            </div>
          )
        })}
      </div>

      <Link
        to={`/analysis/${id}`}
        className="mt-8 inline-block rounded-full bg-slate-800 text-white text-sm px-4 py-2 hover:bg-slate-700"
      >
        See the analysis →
      </Link>
    </div>
  )
}
