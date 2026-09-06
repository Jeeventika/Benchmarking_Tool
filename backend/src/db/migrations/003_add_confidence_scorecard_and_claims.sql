-- Phase 4 migration: Confidence scorecard (6 factors) & Unsupported claims classifier
-- Decided OPEN items from Product Owner

ALTER TABLE recommendations
  ADD COLUMN IF NOT EXISTS scorecard JSONB DEFAULT '{}';

ALTER TABLE analyses
  ADD COLUMN IF NOT EXISTS claims JSONB DEFAULT '[]';
