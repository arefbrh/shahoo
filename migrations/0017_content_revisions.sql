CREATE TABLE IF NOT EXISTS content_revisions (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('page', 'article')),
  entity_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  snapshot JSONB NOT NULL,
  actor_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT content_revisions_entity_version_unique UNIQUE (entity_type, entity_id, version)
);

CREATE INDEX IF NOT EXISTS content_revisions_entity_created_idx
  ON content_revisions (entity_type, entity_id, created_at DESC);
