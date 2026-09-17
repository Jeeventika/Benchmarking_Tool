// ─── Evidence provenance classification ─────────────────────────────────────
// Determines which banner to show based on the actual content of the
// evidence rows returned by the API, NOT the comparison database ID.
//
// Fields used (all confirmed present in the existing schema / API response):
//   evidence_status  – 'reliable' | 'needs_review' | 'outdated' | 'conflicting'
//   source_name      – human-readable label written by the gathering service
//   source_url       – URL string or null
//   result           – the evidence result text
//   method           – how the result was measured (string or undefined)
//
// Signal reference (all drawn from evidenceGatheringService.js):
//   Synthetic seed   → source_url contains "example.com"  OR
//                      source_name contains "SYNTHETIC" / "DEMO" (case-insensitive)
//   Unextracted PDF  → result === "Structure only, content not extracted"  OR
//                      method contains "content extraction not performed"
//   Unverified fallback → source_name contains "Unverified"  OR
//                         result contains "Reliable source not found"
//   Verified         → NONE of the above, evidence non-empty,
//                      every row is evidence_status === 'reliable',
//                      every row has a genuine (non-null, non-example.com) source_url
//
// Curated/manual reference data (E in the spec):
//   There is no dedicated field in the current schema that reliably distinguishes
//   "manually entered reference" from other needs_review evidence.
//   evidence_status === 'needs_review' alone is not sufficient because uploaded
//   PDFs whose content was not extracted also carry needs_review status.
//   To avoid a false positive, this case is conservatively mapped to the
//   demonstration/unverified banner. See implementation_plan.md for details.
// ────────────────────────────────────────────────────────────────────────────

function classifyEvidenceProvenance(evidence) {
  // F – empty or unknown → never claim verified
  if (!Array.isArray(evidence) || evidence.length === 0) {
    return 'demo'
  }

  for (const row of evidence) {
    const sourceName = (row.source_name || '').toLowerCase()
    const sourceUrl  = (row.source_url  || '').toLowerCase()
    const result     = (row.result      || '')
    const method     = (row.method      || '').toLowerCase()

    // A – synthetic / demo seed data
    if (
      sourceUrl.includes('example.com') ||
      sourceName.includes('synthetic') ||
      sourceName.includes('demo')
    ) {
      return 'demo'
    }

    // B – uploaded PDF whose content was NOT extracted
    if (
      result === 'Structure only, content not extracted' ||
      method.includes('content extraction not performed')
    ) {
      return 'demo'
    }

    // C – unverified fallback (honest "no source found" placeholder)
    if (
      sourceName.includes('unverified') ||
      result.includes('Reliable source not found')
    ) {
      return 'demo'
    }
  }

  // D – verified source research:
  //   every row must be reliable AND carry a real (non-placeholder) source URL
  const allReliable = evidence.every((row) => row.evidence_status === 'reliable')
  const allHaveRealUrl = evidence.every((row) => {
    const url = (row.source_url || '').toLowerCase()
    return url.length > 0 && !url.includes('example.com')
  })

  if (allReliable && allHaveRealUrl) {
    return 'verified'
  }

  // Conservative default — provenance unclear
  return 'demo'
}

export default function DemoDataBanner({ evidence }) {
  const provenance = classifyEvidenceProvenance(evidence)

  if (provenance === 'verified') {
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
