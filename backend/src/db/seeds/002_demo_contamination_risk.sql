-- Phase 3 (source contamination / credibility workstream, plus a small
-- comparability-check addition from the comparability workstream) seed data.
--
-- ============================================================
-- DEMONSTRATION / SYNTHETIC DATA — NOT REAL RESEARCH
-- All model names, scores, sources, and URLs below are fabricated
-- for demo purposes only. Source URLs are placeholders under the
-- reserved "example.com" domain, clearly labelled as synthetic.
-- ============================================================
--
-- The existing College A vs. College B demo (001) has no benchmark
-- evidence, so contamination risk should not be attached to any of
-- its rows. This is a separate, minimal comparison whose sole purpose
-- is to demonstrate the contamination_risk / contamination_reason
-- fields on a domain where the concept actually applies: an AI-model
-- This demo also seeds analysis and recommendation data so the
-- contamination-risk workflow can be tested end-to-end.
--
-- Comparability check: both benchmark_score rows below use the exact
-- same method, conditions, source, and date — that equivalence is what
-- the 'comparable' status and explanation cite. This is not invented;
-- it follows directly from the evidence fields already being seeded.

BEGIN;

WITH new_comparison AS (
  INSERT INTO comparisons (item_type, goal, criteria)
  VALUES (
    'ai_model',
    'I want to compare coding-assistant models on a public benchmark.',
    '["benchmark_score"]'
  )
  RETURNING id
),
item_x AS (
  INSERT INTO comparison_items (comparison_id, name)
  SELECT id, 'Model X (Synthetic Demo)' FROM new_comparison
  RETURNING id, comparison_id
),
item_y AS (
  INSERT INTO comparison_items (comparison_id, name)
  SELECT id, 'Model Y (Synthetic Demo)' FROM new_comparison
  RETURNING id, comparison_id
),
ev_benchmark AS (
  INSERT INTO evidence (
    comparison_item_id, criterion, result, source_name, source_url, source_date,
    method, conditions, evidence_status, contamination_risk, contamination_reason
  )
  SELECT id, 'benchmark_score', '92% on Synthetic-Code-Bench v1 (DEMO)',
    'Synthetic Leaderboard (DEMO)',
    'https://example.com/synthetic-sources/code-bench-leaderboard',
    '2025-11-01'::date,
    'Automated pass/fail scoring against the public Synthetic-Code-Bench v1 test set',
    'Zero-shot, default sampling settings',
    'needs_review',
    'known_risk',
    'The Synthetic-Code-Bench v1 test set is publicly posted online and may overlap with common model pretraining corpora, so this score may partly reflect memorization rather than genuine task performance.'
  FROM item_x

  UNION ALL

  SELECT id, 'benchmark_score', '78% on Synthetic-Code-Bench v1 (DEMO)',
    'Synthetic Leaderboard (DEMO)',
    'https://example.com/synthetic-sources/code-bench-leaderboard',
    '2025-11-01'::date,
    'Automated pass/fail scoring against the public Synthetic-Code-Bench v1 test set',
    'Zero-shot, default sampling settings',
    'reliable',
    'no_known_risk',
    NULL
  FROM item_y
  RETURNING id
)

INSERT INTO comparability_checks (comparison_id, criterion, status, explanation)
SELECT id, 'benchmark_score', 'comparable',
  'Both scores were produced using the same automated scoring method against the same benchmark test set, under identical sampling conditions and from the same source, so they can be directly compared.'
FROM new_comparison;

-- ============================================================
-- ANALYSIS
-- ============================================================

INSERT INTO analyses (
  comparison_id,
  content,
  disagreement_flag,
  generated_by
)
SELECT
  id,
  'Model X scores higher than Model Y on the Synthetic-Code-Bench v1 benchmark. However, Model X''s evidence carries a known contamination risk because the public benchmark may overlap with model pretraining data. This means the higher score may partly reflect memorization rather than genuine coding performance.' || E'\n\n' ||
  'LIMITATION: This analysis is based only on the synthetic benchmark evidence supplied for this demonstration. The contamination risk should be reviewed before treating the benchmark score as strong evidence of real-world performance.',
  false,
  'synthetic_seed'
FROM comparisons
WHERE goal = 'I want to compare coding-assistant models on a public benchmark.';

-- ============================================================
-- RECOMMENDATION
-- ============================================================

INSERT INTO recommendations (
  comparison_id,
  recommended_item_id,
  reasons,
  reliability,
  reliability_reason
)
SELECT
  c.id,
  ci.id,
  '["Model X has the higher benchmark score (92% vs 78%)", "Both models were tested using the same benchmark method and conditions, so the scores are directly comparable", "However, Model X''s benchmark evidence has a known contamination risk, so the result should be treated cautiously"]',
  'medium',
  'Medium — the benchmark scores are directly comparable, but Model X''s evidence has a known contamination risk because the public test set may overlap with model pretraining data.'
FROM comparisons c
JOIN comparison_items ci
  ON ci.comparison_id = c.id
 AND ci.name = 'Model X (Synthetic Demo)'
WHERE c.goal = 'I want to compare coding-assistant models on a public benchmark.';

COMMIT;

