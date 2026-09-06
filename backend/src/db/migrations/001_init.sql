-- Phase 1 schema: structure only, no data yet.
-- Mock evidence is added in a later phase via seed.sql.

CREATE TABLE IF NOT EXISTS comparisons (
  id            SERIAL PRIMARY KEY,
  item_type     TEXT NOT NULL,           -- 'ai_model' | 'research_paper' | 'college' | 'product' | 'other'
  goal          TEXT,                    -- the user's stated goal/use case
  criteria      JSONB NOT NULL DEFAULT '[]', -- e.g. ["cost", "performance"]
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS comparison_items (
  id              SERIAL PRIMARY KEY,
  comparison_id   INTEGER NOT NULL REFERENCES comparisons(id) ON DELETE CASCADE,
  name            TEXT NOT NULL           -- e.g. "College A"
);

CREATE TABLE IF NOT EXISTS evidence (
  id                    SERIAL PRIMARY KEY,
  comparison_item_id    INTEGER NOT NULL REFERENCES comparison_items(id) ON DELETE CASCADE,
  criterion             TEXT NOT NULL,
  result                TEXT NOT NULL,
  source_name           TEXT NOT NULL,
  source_url            TEXT,
  source_date           DATE,
  method                TEXT,             -- how the result was measured
  conditions            TEXT,             -- relevant conditions/methodology notes
  evidence_status       TEXT NOT NULL DEFAULT 'needs_review'
                         CHECK (evidence_status IN ('reliable', 'needs_review', 'outdated', 'conflicting'))
);

CREATE TABLE IF NOT EXISTS comparability_checks (
  id              SERIAL PRIMARY KEY,
  comparison_id   INTEGER NOT NULL REFERENCES comparisons(id) ON DELETE CASCADE,
  criterion       TEXT NOT NULL,
  status          TEXT NOT NULL CHECK (status IN ('comparable', 'partly_comparable', 'not_comparable')),
  explanation     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analyses (
  id                SERIAL PRIMARY KEY,
  comparison_id     INTEGER NOT NULL REFERENCES comparisons(id) ON DELETE CASCADE,
  content           TEXT NOT NULL,        -- always labeled "Analysis based on the available evidence" in the UI
  disagreement_flag BOOLEAN NOT NULL DEFAULT false,
  generated_by      TEXT NOT NULL DEFAULT 'ollama',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS recommendations (
  id                    SERIAL PRIMARY KEY,
  comparison_id         INTEGER NOT NULL REFERENCES comparisons(id) ON DELETE CASCADE,
  recommended_item_id   INTEGER REFERENCES comparison_items(id),
  reasons               JSONB NOT NULL DEFAULT '[]',
  reliability           TEXT NOT NULL CHECK (reliability IN ('high', 'medium', 'low')),
  reliability_reason    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS decisions (
  id                        SERIAL PRIMARY KEY,
  comparison_id             INTEGER NOT NULL REFERENCES comparisons(id) ON DELETE CASCADE,
  accepted_recommendation   BOOLEAN NOT NULL,
  chosen_item_id            INTEGER REFERENCES comparison_items(id),
  override_reason           TEXT,          -- 'price' | 'personal_preference' | 'different_priority' |
                                            -- 'distrust_recommendation' | 'more_information' | 'other'
  override_note             TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);
