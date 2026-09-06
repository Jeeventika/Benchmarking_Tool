import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getComparisons } from '../api/comparisons'

export default function Home() {
  const [comparisons, setComparisons] = useState([])

  useEffect(() => {
    getComparisons()
      .then(setComparisons)
      .catch(() => setComparisons([]))
  }, [])

  // Look up demo comparisons by their item_type rather than assuming a
  // fixed database id — ids can shift depending on seed/reseed order.
  const collegeDemo = comparisons.find((c) => c.item_type === 'college')
  const contaminationDemo = comparisons.find((c) => c.item_type === 'ai_model')

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-semibold text-slate-800">Home page</h1>
      <p className="mt-2 text-slate-500">Placeholder — full homepage design built in a later phase.</p>

      {collegeDemo && (
        <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">
            A demo comparison (College A vs. College B, using synthetic data) is seeded and ready to view.
          </p>
          <Link
            to={`/research/${collegeDemo.id}`}
            className="mt-3 inline-block rounded-full bg-slate-800 text-white text-sm px-4 py-2 hover:bg-slate-700"
          >
            View demo comparison
          </Link>
        </div>
      )}

      {contaminationDemo && (
        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-600">
            A second, minimal demo (Model X vs. Model Y, using synthetic data) shows how the tool flags a
            benchmark with a known contamination risk.
          </p>
          <Link
            to={`/research/${contaminationDemo.id}`}
            className="mt-3 inline-block rounded-full border border-slate-300 text-slate-700 text-sm px-4 py-2 hover:bg-slate-50"
          >
            View contamination-risk demo
          </Link>
        </div>
      )}
    </div>
  )
}
