import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getComparison, getEvidence } from '../api/comparisons'
import { EvidenceStatusBadge, ContaminationRiskBadge } from '../components/StatusBadges'
import DemoDataBanner from '../components/DemoDataBanner'
import ExecutiveSummaryBanner from '../components/ExecutiveSummaryBanner'

export default function Research() {
  const { id } = useParams()
  const [comparison, setComparison] = useState(null)
  const [evidence, setEvidence] = useState([])
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    setStatus('loading')
    Promise.all([getComparison(id), getEvidence(id)])
      .then(([comparisonData, evidenceData]) => {
        setComparison(comparisonData)
        setEvidence(evidenceData)
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [id])

  if (status === 'loading') {
    return <div className="max-w-3xl mx-auto px-6 py-12 text-slate-500">Loading evidence…</div>
  }
  if (status === 'error') {
    return (
      <div className="max-w-3xl mx-auto px-6 py-12 text-red-600">
        Could not load this comparison. Make sure the backend and database are running.
      </div>
    )
  }

  const byItem = comparison.items.map((item) => ({
    item,
    rows: evidence.filter((e) => e.comparison_item_id === item.id),
  }))

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-800">Where this information came from</h1>
      <p className="mt-1 text-slate-500">
        Evidence gathered for: <span className="font-medium text-slate-700">{comparison.goal}</span>
      </p>
      <div className="mt-4">
        <DemoDataBanner isSynthetic={Number(id) <= 2} />
      </div>

      <div className="mt-6">
        <ExecutiveSummaryBanner comparison={comparison} evidenceCount={evidence.length} />
      </div>

      <div className="mt-8 space-y-8">
        {byItem.map(({ item, rows }) => (
          <div key={item.id}>
            <h2 className="text-lg font-semibold text-slate-800">{item.name}</h2>
            <div className="mt-3 space-y-3">
              {rows.length === 0 ? (
                <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm text-slate-400">
                  No evidence recorded yet for this item.
                </div>
              ) : (
                rows.map((e) => (
                <div key={e.id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs uppercase tracking-wide text-slate-400">
                        {e.criterion}
                      </span>
                      <p className="font-medium text-slate-800">{e.result}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <EvidenceStatusBadge status={e.evidence_status} />
                      <ContaminationRiskBadge risk={e.contamination_risk} />
                    </div>
                  </div>
                  {e.contamination_risk === 'known_risk' && (
                    <p className="mt-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                      Reason: {e.contamination_reason}
                    </p>
                  )}
                  <dl className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm text-slate-500">
                    <div>
                      <dt className="inline text-slate-400">Source: </dt>
                      <dd className="inline">{e.source_name}</dd>
                    </div>
                    <div>
                      <dt className="inline text-slate-400">Date: </dt>
                      <dd className="inline">{new Date(e.source_date).toLocaleDateString()}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="inline text-slate-400">How this result was measured: </dt>
                      <dd className="inline">{e.method}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="inline text-slate-400">Conditions: </dt>
                      <dd className="inline">{e.conditions}</dd>
                    </div>
                    {e.source_url && (
                      <div className="sm:col-span-2">
                        <dt className="inline text-slate-400">Reference: </dt>
                        <dd className="inline">
                          <a
                            href={e.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-600 hover:text-indigo-800 underline break-all"
                          >
                            {e.source_url}
                          </a>
                        </dd>
                      </div>
                    )}
                  </dl>
                </div>
              )))}
            </div>
          </div>
        ))}
      </div>

      <Link
        to={`/results/${id}`}
        className="mt-8 inline-block rounded-full bg-slate-800 text-white text-sm px-4 py-2 hover:bg-slate-700"
      >
        Can these results be fairly compared? →
      </Link>
    </div>
  )
}
