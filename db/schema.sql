-- Factory Asset Map — recommended relational schema (future full database).
-- Compatible with PostgreSQL and SQLite / Cloudflare D1 (types kept simple).
-- Coordinates: normalized percent of the floor drawing, 0–100, origin top-left, X right, Y down.

CREATE TABLE factory (
  factory_id   TEXT PRIMARY KEY,
  code         TEXT NOT NULL,
  name         TEXT NOT NULL,
  address      TEXT
);

CREATE TABLE floor (
  floor_id     TEXT PRIMARY KEY,
  factory_id   TEXT NOT NULL REFERENCES factory(factory_id),
  code         TEXT NOT NULL UNIQUE,          -- F1 (used in Location Code)
  name         TEXT NOT NULL,
  level        INTEGER NOT NULL DEFAULT 0,
  plan_url     TEXT,                          -- drawing in object storage (SVG preferred)
  plan_width   REAL,
  plan_height  REAL
);

CREATE TABLE department (
  department_id TEXT PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,         -- PR (used in Location Code)
  name          TEXT NOT NULL
);

CREATE TABLE zone (
  zone_id       TEXT PRIMARY KEY,
  floor_id      TEXT NOT NULL REFERENCES floor(floor_id),
  department_id TEXT NOT NULL REFERENCES department(department_id),
  code          TEXT NOT NULL,                -- EXT (used in Location Code)
  name          TEXT NOT NULL,
  x REAL NOT NULL, y REAL NOT NULL, w REAL NOT NULL, h REAL NOT NULL,   -- boundary, % of drawing
  color         TEXT,
  UNIQUE (floor_id, code)
);

CREATE TABLE asset_category (
  category_id   TEXT PRIMARY KEY,
  code          TEXT NOT NULL UNIQUE,         -- EQP (Asset ID prefix)
  name          TEXT NOT NULL,
  marker_shape  TEXT NOT NULL DEFAULT 'circle'
);

CREATE TABLE asset_status (
  status_id     TEXT PRIMARY KEY,             -- ACTIVE, INSP, OOS, ...
  name          TEXT NOT NULL,
  color         TEXT NOT NULL,
  is_core       INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE app_user (
  user_id       TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  role          TEXT
);

-- Asset master data (no location here)
CREATE TABLE asset (
  asset_id        TEXT PRIMARY KEY,           -- AST-EQP-0001, immutable, never reused
  name            TEXT NOT NULL,
  category_id     TEXT NOT NULL REFERENCES asset_category(category_id),
  department_id   TEXT NOT NULL REFERENCES department(department_id),  -- responsible department
  manufacturer    TEXT,
  model           TEXT,
  serial_number   TEXT,
  status_id       TEXT NOT NULL REFERENCES asset_status(status_id),
  photo_url       TEXT,
  last_inspection DATE,
  remarks         TEXT,
  created_at      TIMESTAMP NOT NULL,
  updated_at      TIMESTAMP NOT NULL,
  deleted_at      TIMESTAMP                   -- soft delete keeps the ID reserved
);

-- Current location: one row per asset
CREATE TABLE asset_location (
  asset_id      TEXT PRIMARY KEY REFERENCES asset(asset_id),
  floor_id      TEXT NOT NULL REFERENCES floor(floor_id),
  zone_id       TEXT NOT NULL REFERENCES zone(zone_id),
  x             REAL NOT NULL CHECK (x >= 0 AND x <= 100),
  y             REAL NOT NULL CHECK (y >= 0 AND y <= 100),
  location_code TEXT NOT NULL,                -- F1-PR-EXT-X025-Y040 (recomputed on move)
  updated_at    TIMESTAMP NOT NULL
);

-- Append-only location history (grant INSERT/SELECT only)
CREATE TABLE location_history (
  history_id      TEXT PRIMARY KEY,
  moved_at        TIMESTAMP NOT NULL,
  action          TEXT NOT NULL CHECK (action IN ('REGISTER', 'MOVE', 'REMOVE')),
  asset_id        TEXT NOT NULL,
  asset_name      TEXT NOT NULL,              -- snapshot
  prev_floor_code TEXT, prev_zone_code TEXT, prev_x REAL, prev_y REAL, prev_location_code TEXT,
  new_floor_code  TEXT, new_zone_code  TEXT, new_x  REAL, new_y  REAL, new_location_code  TEXT,
  updated_by      TEXT NOT NULL,
  reason          TEXT NOT NULL
);
CREATE INDEX idx_history_asset ON location_history (asset_id, moved_at);
CREATE INDEX idx_history_time  ON location_history (moved_at);
