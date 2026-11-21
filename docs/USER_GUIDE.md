# User guide – Factory Asset Map

The same guide is available inside the app under **Settings & Guide**.

## Concepts

| Term | Meaning |
|---|---|
| Asset ID | Permanent identifier, e.g. `AST-EQP-0001`. Never changes, never reused. |
| Location Code | Current position, e.g. `F1-PR-EXT-X025-Y040` (floor – zone department – zone – X – Y). Recalculated automatically on every move. |
| Coordinates | X / Y in **% of the floor drawing** (0–100). Origin = top-left corner, X to the right, Y downward. |
| Zone | Rectangular area of a floor (e.g. Extraction), owned by a department. |
| Status | Active / Inspection Due / Out of Service (+ custom). Sets the marker colour. |
| Category | Equipment / Utility / Lab / Furniture (+ custom). Sets the marker shape and the Asset ID prefix. |

“Acting as” (top bar) is the name written as **Updated By** in the location history. There is no login.

## Find an asset

* Top search bar or map search: type an Asset ID (or part of a name / serial) and press **Enter**. The map switches floor, zooms to the asset and opens its details.
* Scan its QR label with a phone camera – the link opens the asset on the map.
* QR Codes → *Scan / look up*: works with USB / Bluetooth scanners (keyboard mode) and, on supported browsers, the camera.

## Interactive map

* Wheel / pinch = zoom, drag = pan, ⛶ = fit floor, ⓘ = legend on/off. Floor tabs switch floors.
* Filters: zone (also zooms to it), responsible department, category show/hide, status.
* Bottom-right shows the cursor position in %, useful to read coordinates from the drawing.
* Click a marker → detail panel with all fields, photo, recent history and actions.

## Move an asset

1. Select it → **Move on map** (or Asset Register → move icon).
2. Optionally switch floor, then click the new position. The zone is detected from the zone boundaries.
3. Check floor, zone, X, Y and the new Location Code; enter **Reason for change**; Save.

A history record (previous → new location, user, reason, time) is appended. History is never edited or deleted.

## Asset register

* Add asset: Asset ID is suggested from the category (`AST-UTL-0005`); you may enter your own existing numbering.
* Required: Asset ID, name, category, responsible department, status, floor, zone, X, Y.
* Editing floor / zone / X / Y requires a reason (creates history).
* Delete asks for confirmation; history is kept and the Asset ID becomes unavailable for reuse.
* Click column headers to sort; use filters and search; **Locate** shows the asset on the map.

### Import from CSV / Excel

1. Download the template (Import dialog, Settings, or `templates/asset-import-template.csv`).
2. One row per asset. Category / Department / Floor / Zone / Status may be codes or names.
3. Import → choose file → choose mode (*add new only* or *add & update*) → review the preview (new, updates, errors) → **Import**.
4. Rows with errors are skipped and listed with the reason.

## Factory zones and floor plans

* Factory Zones shows the hierarchy Factory → Floor → Department → Zone with asset counts. Click a zone to see it on the map.
* **Add zone → Draw boundary on map**: drag a rectangle; the form reopens with the boundary filled in.
* A zone containing assets cannot be deleted (move the assets first).
* **Floors → Import plan** replaces the drawing of a floor (SVG preferred; PNG / JPG accepted, max ≈ 1.8 MB).

### Converting CAD / PDF drawings to SVG

* **AutoCAD DWG/DXF** – freeze dimension / hatch / text layers not needed, plot the building outline to PDF (“DWG to PDF”) or open the DXF in Inkscape / LibreCAD and save as SVG.
* **PDF** – Inkscape: *File → Open* (Poppler/Cairo import) → *Edit → Resize Page to Selection* → *Save As → Optimized SVG*. Command line: `pdftocairo -svg plan.pdf plan.svg`.
* **Scan / photo** – crop to the building outline, straighten, save as PNG ≤ 2400 px.
* Keep the drawing extent (crop) the same when you update a plan later; coordinates are relative to the drawing edges.

## QR codes

* QR content = `<QR base URL>#/map?asset=<Asset ID>`. Set the QR base URL (Settings → General) to the published address.
* Preview → **Download PNG** (with ID, name and location code) or **Print label**.
* Tick several assets → choose label size → **Print labels** (print at 100 % / “actual size”).
* QR codes identify assets; they do **not** track position. The map shows the last recorded location.

## Settings & data

* Categories (code used in new Asset IDs, marker shape), statuses (name, colour), users, marker size, map options.
* **Download JSON backup** regularly. **Restore**, **Reset demo data** and **Clear all data** replace data for all users and require the admin key when the Cloudflare backend is used.
* The sidebar shows the sync status: *Synced with Cloudflare*, *Saving…*, or *Offline — changes kept locally* (they are uploaded automatically when the connection returns).
