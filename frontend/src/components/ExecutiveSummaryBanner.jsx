export default function ExecutiveSummaryBanner({ comparison, evidenceCount, criteriaCount }) {
  if (!comparison) return null

  const itemNames = comparison.items ? comparison.items.map((i) => i.name).join(' vs ') : ''
  const categoryLabel = comparison.item_type ? comparison.item_type.replace(/_/g, ' ') : 'General'

  return (
    <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            Comparison Focus
          </span>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <span>{itemNames}</span>
            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 capitalize">
              {categoryLabel}
            </span>
          </h2>
          {comparison.goal && (
            <p className="text-xs text-slate-600 mt-1">
              <span className="font-semibold text-slate-700">Goal: </span>
              {comparison.goal}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-500 sm:border-l sm:border-slate-200 sm:pl-4">
          <div>
            <span className="font-semibold text-slate-800 text-sm">{comparison.items?.length || 0}</span>
            <span className="block text-[10px] uppercase text-slate-400">Options</span>
          </div>
          <div className="h-6 w-px bg-slate-200" />
          <div>
            <span className="font-semibold text-slate-800 text-sm">
              {comparison.criteria?.length || criteriaCount || 0}
            </span>
            <span className="block text-[10px] uppercase text-slate-400">Criteria</span>
          </div>
          {evidenceCount !== undefined && (
            <>
              <div className="h-6 w-px bg-slate-200" />
              <div>
                <span className="font-semibold text-slate-800 text-sm">{evidenceCount}</span>
                <span className="block text-[10px] uppercase text-slate-400">Facts</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
