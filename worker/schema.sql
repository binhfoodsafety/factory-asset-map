-- Factory Asset Map — Cloudflare D1 schema (record store used by the Worker API)
-- Each record is one entity (asset, location, history entry, zone, floor, ...) stored as JSON.
-- Deletions are tombstones (deleted = 1) so other browsers can sync them.
CREATE TABLE IF NOT EXISTS records (
  c          TEXT    NOT NULL,             -- collection: assets, locations, history, zones, floors, ...
  id         TEXT    NOT NULL,             -- entity id (Asset ID, zone id, history id, ...)
  data       TEXT,                         -- JSON document
  deleted    INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL,             -- server time (ms) of last change
  PRIMARY KEY (c, id)
);
CREATE INDEX IF NOT EXISTS idx_records_updated ON records (updated_at);
