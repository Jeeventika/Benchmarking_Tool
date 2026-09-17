import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getComparisons } from '../api/comparisons'

export default function MyComparisons() {
  const [comparisons, setComparisons] = useState([])

  useEffect(() => {
    getComparisons()
      .then(setComparisons)
      .catch(() => setComparisons([]))
  }, [])

  const collegeDemo =
    comparisons.find(
      (c) => c.goal === 'I want to choose the best college for my undergraduate degree.'
    ) || comparisons.find((c) => c.item_type === 'college')
  const contaminationDemo =
    comparisons.find(
      (c) => c.goal === 'I want to compare coding-assistant models on a public benchmark.'
    ) || comparisons.find((c) => c.item_type === 'ai_model')

  const userComparisons = comparisons.filter(
    (c) => c.id !== collegeDemo?.id && c.id !== contaminationDemo?.id
  )

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-800">My Comparisons</h1>
          <p className="mt-1 text-slate-500">
            View all your active research comparisons and synthetic reference demonstrations.
          </p>
        </div>
        <Link
          to="/compare"
          className="rounded-full bg-slate-800 text-white text-sm font-medium px-4 py-2 hover:bg-slate-700 transition"
        >
          + New Comparison
        </Link>
      </div>

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-slate-800">Your comparisons ({userComparisons.length})</h2>
        {userComparisons.length === 0 ? (
          <div className="mt-3 rounded-lg border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
            No custom comparisons yet. Start one from the Home page or New Comparison!
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {userComparisons.map((c) => (
              <div
                key={c.id}
                className="rounded-lg border border-slate-200 bg-white p-5 flex items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {c.item_type ? c.item_type.replace(/_/g, ' ') : 'General'}
                    </span>
                    <span className="text-xs text-slate-400">
                      · {new Date(c.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-slate-800">{c.goal}</p>
                </div>
                <Link
                  to={`/research/${c.id}`}
                  className="rounded-full border border-slate-300 text-slate-700 text-xs font-medium px-3.5 py-1.5 hover:bg-slate-50 transition shrink-0"
                >
                  View comparison →
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-10">
        <h2 className="text-lg font-semibold text-slate-800">Demonstrations & sample data</h2>
        <p className="mt-1 text-xs text-slate-500">
          The scenarios below demonstrate how the tool evaluates evidence, comparability, and warnings.
        </p>

        {collegeDemo && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-indigo-600">
              Synthetic demonstration
            </div>
            <p className="mt-1 text-sm text-slate-700">
              College comparison (College A vs. College B) demonstrating evidence credibility statuses,
              direct comparability, conflicting rankings, and user decision override.
            </p>
            <Link
              to={`/research/${collegeDemo.id}`}
              className="mt-3 inline-block rounded-full bg-slate-800 text-white text-xs font-medium px-4 py-2 hover:bg-slate-700 transition"
            >
              View demo comparison →
            </Link>
          </div>
        )}

        {contaminationDemo && (
          <div className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-red-600">
              Synthetic demonstration
            </div>
            <p className="mt-1 text-sm text-slate-700">
              AI model comparison (Model X vs. Model Y) demonstrating automated contamination-risk flagging
              on public benchmark data.
            </p>
            <Link
              to={`/research/${contaminationDemo.id}`}
              className="mt-3 inline-block rounded-full border border-slate-300 text-slate-700 text-xs font-medium px-4 py-2 hover:bg-slate-50 transition"
            >
              View contamination-risk demo →
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
