export default function DemoDataBanner({ isSynthetic = true }) {
  if (!isSynthetic) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm px-4 py-2">
        Verified source research — evidence and citations gathered from public and institutional sources.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-800 text-sm px-4 py-2">
      Demonstration / synthetic data — for showing how the tool works, not real research.
    </div>
  )
}
