# Installation & deployment

## 1. Run locally (no server data)

Requirements: any modern browser. Python 3 is optional (for the local server).

```powershell
python tools/serve.py          # → http://127.0.0.1:8765/
```

Or double-click `index.html`. With `js/config.js` → `apiBase: ''` all data is stored in that browser's LocalStorage.

## 2. Front-end on GitHub Pages

1. Push the repository to GitHub (public).
2. Repository → **Settings → Pages** → *Deploy from a branch* → `main` / `(root)`.
3. The app is served at `https://<user>.github.io/<repo>/`.

A `.nojekyll` file is included so all files are served as-is.

## 3. Data backend on Cloudflare (Worker + D1)

Requires Node.js 18+ and a Cloudflare account (free plan is enough).

```powershell
cd worker
npm install
npx wrangler login                                   # opens the browser to authorise your Cloudflare account
npx wrangler d1 create factory-asset-map             # copy the database_id into wrangler.toml
npx wrangler d1 execute factory-asset-map --remote --file=schema.sql
npx wrangler secret put ADMIN_KEY                    # key needed for reset / restore / clear-all
npx wrangler deploy                                  # → https://factory-asset-map-api.<subdomain>.workers.dev
```

Then:

1. Set `ALLOWED_ORIGINS` in `worker/wrangler.toml` to your GitHub Pages origin (e.g. `https://<user>.github.io`) and redeploy.
2. Set `apiBase` in `js/config.js` to the Worker URL, commit and push.
3. Open the site. On the very first visit against an empty database the browser uploads the demo dataset; every later visitor loads the shared data.

Check the API: `https://<worker-url>/api/health`.

### What the Worker guarantees

* Location history is append-only (no update / delete through the API).
* A new asset whose Asset ID exists — or existed before — is rejected (IDs are never reused).
* Replacing all data (`/api/replace`) requires `X-Admin-Key` when `ADMIN_KEY` is set.
* CORS only for `ALLOWED_ORIGINS` (plus localhost for development).

### No login – consequences

Anyone with the link can view and edit. Options to restrict later without changing the app much:

* **Cloudflare Access** (Zero Trust, free up to 50 users) in front of the Worker and/or a custom domain.
* An *edit key* check in the Worker for `POST /api/changes`.

### Backups

Settings → Data & backup → **Download JSON backup** (all data incl. floor plans). Cloudflare D1 also offers
Time Travel (point-in-time restore, 30 days on paid plans / 7 days free): `npx wrangler d1 time-travel info factory-asset-map`.

## 4. Offline / intranet use

The two libraries are loaded from cdnjs. For networks without internet:

```powershell
mkdir vendor
curl -o vendor/xlsx.full.min.js https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js
curl -o vendor/qrcode.min.js https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js
```

and change the two `<script src="https://cdnjs…">` tags in `index.html` to `vendor/…`. Without them the app still
works; Excel import/export and QR codes show a clear message (CSV always works).

Any static web server (IIS, nginx, Apache, NAS) can host the front-end; the Worker can be replaced by your own API
implementing the same three endpoints (see `worker/src/index.js`).

## 5. Updating the app

After changing JS/CSS, bump the `?v=` number on the `<script>`/`<link>` tags in `index.html` so browsers fetch the
new files instead of cached ones.
