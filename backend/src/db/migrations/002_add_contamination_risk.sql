-- Phase 3 (source contamination / credibility workstream).
--
-- Adds an OPTIONAL contamination-risk property to evidence. This is
-- deliberately separate from evidence_status (source credibility/freshness)
-- because contamination risk is a different concept: it says whether a
-- benchmark/result is known to be compromised by test-set/training-data
-- overlap, not whether the source itself is reliable or recent.
--
-- Nullable by design: most evidence (e.g. college cost or placement figures)
-- has no meaningful contamination claim at all, so the default is NULL
-- ("not assessed / not applicable"), never a fabricated "no known risk".
-- Only rows where the underlying data explicitly records an assessment get
-- 'no_known_risk' or 'known_risk'.

ALTER TABLE evidence
  ADD COLUMN IF NOT EXISTS contamination_risk TEXT
    CHECK (contamination_risk IN ('no_known_risk', 'known_risk')),
  ADD COLUMN IF NOT EXISTS contamination_reason TEXT;

-- Guardrail: a reason should only be present when a risk has actually been
-- recorded, and 'known_risk' should always come with an explanation.
-- Wrapped in a DO block (rather than a plain ADD CONSTRAINT) so this
-- migration stays safe to re-run, matching the idempotent style of
-- 001_init.sql — migrate.js has no migration-tracking table and simply
-- re-runs every file in this directory.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'evidence_contamination_reason_consistency'
  ) THEN
    ALTER TABLE evidence
      ADD CONSTRAINT evidence_contamination_reason_consistency CHECK (
        (contamination_risk IS NULL AND contamination_reason IS NULL)
        OR (contamination_risk = 'no_known_risk')
        OR (contamination_risk = 'known_risk' AND contamination_reason IS NOT NULL)
      );
  END IF;
END $$;
