-- Phase 2 seed data.
--
-- ============================================================
-- DEMONSTRATION / SYNTHETIC DATA — NOT REAL RESEARCH
-- All institution names, figures, sources, and URLs below are
-- fabricated for demo purposes only. Do not treat any of it as
-- real college data. Source URLs are placeholders under the
-- reserved "example.com" domain, clearly labelled as synthetic.
-- ============================================================
--
-- One complete comparison scenario: "College A" vs "College B" on
-- cost, placement, and reputation. Covers every evidence status,
-- all three comparability states, an analysis with a disagreement
-- flag, a recommendation with a reliability explanation, and one
-- demo user decision (an override).

BEGIN;

WITH new_comparison AS (
  INSERT INTO comparisons (item_type, goal, criteria)
  VALUES (
    'college',
    'I want to choose the best college for my undergraduate degree.',
    '["cost", "placement", "reputation"]'
  )
  RETURNING id
),
item_a AS (
  INSERT INTO comparison_items (comparison_id, name)
  SELECT id, 'College A (Synthetic Demo)' FROM new_comparison
  RETURNING id, comparison_id
),
item_b AS (
  INSERT INTO comparison_items (comparison_id, name)
  SELECT id, 'College B (Synthetic Demo)' FROM new_comparison
  RETURNING id, comparison_id
),

-- ---------------------------------------------------------------
-- EVIDENCE
-- ---------------------------------------------------------------

ev_a_cost AS (
  INSERT INTO evidence (comparison_item_id, criterion, result, source_name, source_url, source_date, method, conditions, evidence_status)
  SELECT id, 'cost', '$28,500/year average net cost',
    'Demo College Cost Database (SYNTHETIC SOURCE)',
    'https://example.com/synthetic-sources/college-cost-db',
    '2025-08-01',
    'Average net cost after grants/aid, self-reported by the institution',
    'In-state tuition, 2024-25 academic year',
    'reliable'
  FROM item_a
  RETURNING id
),
ev_b_cost AS (
  INSERT INTO evidence (comparison_item_id, criterion, result, source_name, source_url, source_date, method, conditions, evidence_status)
  SELECT id, 'cost', '$31,200/year average net cost',
    'Demo College Cost Database (SYNTHETIC SOURCE)',
    'https://example.com/synthetic-sources/college-cost-db',
    '2025-08-01',
    'Average net cost after grants/aid, self-reported by the institution',
    'In-state tuition, 2024-25 academic year',
    'reliable'
  FROM item_b
  RETURNING id
),
ev_a_placement AS (
  INSERT INTO evidence (comparison_item_id, criterion, result, source_name, source_url, source_date, method, conditions, evidence_status)
  SELECT id, 'placement', '89% of graduates employed within 6 months',
    'Synthetic Career Outcomes Survey (DEMO)',
    'https://example.com/synthetic-sources/career-outcomes-survey',
    '2025-01-15',
    'Self-reported survey of the graduating class',
    'Includes both full-time and part-time employment; 6-month post-graduation window',
    'needs_review'
  FROM item_a
  RETURNING id
),
ev_b_placement AS (
  INSERT INTO evidence (comparison_item_id, criterion, result, source_name, source_url, source_date, method, conditions, evidence_status)
  SELECT id, 'placement', '82% of graduates employed within 3 months',
    'Synthetic Alumni Outcomes Report (DEMO)',
    'https://example.com/synthetic-sources/alumni-outcomes-report',
    '2023-06-01',
    'Alumni self-report survey',
    'Includes both full-time and part-time employment; 3-month post-graduation window',
    'outdated'
  FROM item_b
  RETURNING id
),
ev_a_reputation AS (
  INSERT INTO evidence (comparison_item_id, criterion, result, source_name, source_url, source_date, method, conditions, evidence_status)
  SELECT id, 'reputation', 'Ranked #45 nationally (synthetic ranking)',
    'Demo University Rankings (SYNTHETIC SOURCE)',
    'https://example.com/synthetic-sources/university-rankings',
    '2024-09-01',
    'Composite score from synthetic peer-assessment surveys and outcome data',
    'Weighted average of peer assessment (40%) and outcomes (60%)',
    'reliable'
  FROM item_a
  RETURNING id
),
ev_b_reputation_1 AS (
  INSERT INTO evidence (comparison_item_id, criterion, result, source_name, source_url, source_date, method, conditions, evidence_status)
  SELECT id, 'reputation', 'Ranked #38 nationally (synthetic ranking)',
    'Demo University Rankings (SYNTHETIC SOURCE)',
    'https://example.com/synthetic-sources/university-rankings',
    '2024-09-01',
    'Composite score from synthetic peer-assessment surveys and outcome data',
    'Weighted average of peer assessment (40%) and outcomes (60%)',
    'reliable'
  FROM item_b
  RETURNING id
),
ev_b_reputation_2 AS (
  INSERT INTO evidence (comparison_item_id, criterion, result, source_name, source_url, source_date, method, conditions, evidence_status)
  SELECT id, 'reputation', 'Ranked #52 nationally (different synthetic methodology)',
    'Alt Demo Rankings (SYNTHETIC SOURCE)',
    'https://example.com/synthetic-sources/alt-rankings',
    '2024-03-01',
    'Composite score emphasising research output over peer assessment',
    'Weighted average of research output (60%) and peer assessment (40%)',
    'conflicting'
  FROM item_b
  RETURNING id
),

-- ---------------------------------------------------------------
-- COMPARABILITY CHECKS
-- ---------------------------------------------------------------

comp_cost AS (
  INSERT INTO comparability_checks (comparison_id, criterion, status, explanation)
  SELECT id, 'cost', 'comparable',
    'Both figures use the same average-net-cost methodology, the same in-state tuition basis, and the same 2024-25 academic year, so they can be directly compared.'
  FROM new_comparison
),
comp_placement AS (
  INSERT INTO comparability_checks (comparison_id, criterion, status, explanation)
  SELECT id, 'placement', 'partly_comparable',
    'Both results measure post-graduation employment, but College B''s figure uses a shorter survey window (3 months vs. 6 months) and is from an earlier year (2023 vs. 2025), so the comparison should be treated with caution.'
  FROM new_comparison
),
comp_reputation AS (
  INSERT INTO comparability_checks (comparison_id, criterion, status, explanation)
  SELECT id, 'reputation', 'not_comparable',
    'College A''s ranking and College B''s rankings come from methodologies with different weightings, and College B''s own two sources disagree with each other (#38 vs. #52), so a direct ranking comparison would be misleading.'
  FROM new_comparison
),

-- ---------------------------------------------------------------
-- ANALYSIS
-- ---------------------------------------------------------------

new_analysis AS (
  INSERT INTO analyses (comparison_id, content, disagreement_flag, generated_by)
  SELECT id,
    'College A shows a lower average net cost than College B, and this figure is directly comparable between the two. College A also reports a higher graduate placement rate, but that figure should be read with caution because College B''s placement evidence was measured over a shorter window and is from an earlier year. Reputation evidence is not comparable: College A has one ranking, while College B has two rankings that disagree with each other (#38 vs. #52) depending on the ranking methodology used.' || E'\n\n' ||
    'LIMITATION: This analysis is based only on the synthetic evidence supplied for this demo. It does not account for financial aid packages, program-specific outcomes, campus environment, or other factors that were not included in this dataset.',
    true,
    'synthetic_seed'
  FROM new_comparison
  RETURNING id
),

-- ---------------------------------------------------------------
-- RECOMMENDATION
-- ---------------------------------------------------------------

new_recommendation AS (
  INSERT INTO recommendations (comparison_id, recommended_item_id, reasons, reliability, reliability_reason)
  SELECT
    nc.id,
    ia.id,
    '["Lower average net cost for the same academic year, and this criterion was fully comparable", "Higher self-reported placement rate, though College B''s figure used a shorter survey window so this factor carries less weight", "Cost was the only criterion rated fully comparable, so it was weighted most heavily in this recommendation"]',
    'medium',
    'Medium — the cost evidence is reliable and directly comparable, but the placement evidence uses different survey windows and the reputation evidence conflicts between sources, which limits overall confidence in the full picture.'
  FROM new_comparison nc, item_a ia
  RETURNING id
)

-- ---------------------------------------------------------------
-- DEMO USER DECISION (an override, to demonstrate the workflow)
-- ---------------------------------------------------------------

INSERT INTO decisions (comparison_id, accepted_recommendation, chosen_item_id, override_reason, override_note)
SELECT nc.id, false, ib.id, 'personal_preference',
  'Synthetic demo note: choosing College B despite the recommendation because campus location matters more to this demo user than the cost difference.'
FROM new_comparison nc, item_b ib;

COMMIT;
