export default function About() {
  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      <div className="rounded-lg border border-slate-200 bg-white p-8 space-y-8 shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">About</h2>
          <div className="mt-4 space-y-3 text-sm text-slate-700 leading-relaxed">
            <p>
              <strong className="font-semibold text-slate-900">Decision Support Tool</strong> is an evidence-based
              comparison system designed to help users research different options, compare information from multiple
              sources, identify credibility and comparability issues, and make more informed decisions.
            </p>
            <p>
              The tool focuses on making the decision-making process{' '}
              <strong className="font-semibold text-slate-900">transparent and understandable</strong> by showing the
              evidence behind results, highlighting limitations, and clearly separating source information from
              AI-generated analysis.
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100">
          <h3 className="text-xl font-bold text-slate-800">Our Team</h3>
          <p className="mt-3 text-base font-semibold text-slate-900">
            Jeeventika R. • Kanishma • Sruthi • Mobisha
          </p>
          <p className="mt-3 text-sm text-slate-700 leading-relaxed">
            Together, we developed the tool with a focus on{' '}
            <strong className="font-semibold text-slate-900">
              evidence, transparency, comparability, and user-controlled decisions
            </strong>
            .
          </p>
          <p className="mt-4 text-xs italic text-slate-500">
            Built to help people understand their options before making a decision.
          </p>
        </div>
      </div>
    </div>
  )
}
