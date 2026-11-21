# Database migration recommendations

## Current state (v1)

* **Domain model** is normalized in `js/store.js`: `factory`, `floors`, `departments`, `zones`, `categories`,
  `statuses`, `users`, `assets` (master data only), `locations` (current location per asset), `history`
  (append-only location history).
* **Storage**: Cloudflare D1 table `records(c, id, data JSON, deleted, updated_at)` (see `worker/schema.sql`) —
  one row per entity, JSON payload. Each browser caches data in LocalStorage and syncs record by record.

This keeps the API tiny and the client offline-capable, while the data stays entity-shaped and can be moved into
proper relational tables without changing the UI.

## Recommended next step: relational tables

`db/schema.sql` contains a PostgreSQL / SQLite (D1) compatible schema:

* `asset` – master data (`asset_id` PK, immutable).
* `asset_location` – exactly one current row per asset (FK → asset, zone, floor), with generated `location_code`.
* `location_history` – insert-only; enforce with DB permissions/trigger (no UPDATE/DELETE grants).
* reference tables `floor`, `department`, `zone`, `asset_category`, `asset_status`, `app_user`.

### Migration steps

1. Create the tables from `db/schema.sql` (D1: `npx wrangler d1 execute <db> --remote --file=../db/schema.sql`).
2. Export the current data: Settings → *Download JSON backup* (or `GET /api/changes?since=0`).
3. Transform with a small script: each collection maps 1:1 to a table (field names are listed in the schema
   comments). Floor plan drawings → object storage (Cloudflare R2 / Supabase Storage); keep only the URL in `floor`.
   Asset photos → object storage as well.
4. Replace the Worker endpoints with entity endpoints (`GET/POST/PATCH /assets`, `POST /assets/:id/move`, ...).
   Moving an asset must run **in one transaction**: insert `location_history`, update `asset_location`.
5. In the front-end only `js/remote.js` (and `store.js` mutation functions) need to call the new endpoints; views use
   `FAM.store` only.

### Supabase / PostgreSQL

* Use the same schema; add Row Level Security policies when authentication is introduced.
* `location_code` can be a generated column or computed in a view (`v_asset_current`).
* Use `timestamptz` for `moved_at`; keep times in UTC, format in the browser.

### Things to keep

* Asset ID immutable and never reused (keep deleted asset rows with `deleted_at`, or a `retired_asset_id` table).
* Coordinates as normalized percentages (`numeric(5,2)` 0–100) **plus** the drawing version, so plans can be
  replaced safely (`floor_plan_version` table, optional).
* History append-only, including `updated_by` and `reason`.
