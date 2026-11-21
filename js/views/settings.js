/* Factory Asset Map — TAB 07 Settings, configuration, data management and user guide. */
window.FAM = window.FAM || {};
(function (F) {
  'use strict';
  const U = F.util, S = F.store, UI = F.ui, IO = F.io;
  F.views = F.views || {};
  const ST = (F.views.settings = {});
  const SHAPES = ['circle', 'square', 'diamond', 'triangle'];
  const SECTIONS = [
    ['general', 'General'], ['users', 'Users'], ['categories', 'Asset categories'], ['statuses', 'Statuses'],
    ['coding', 'Location coding'], ['data', 'Data & backup'], ['importexport', 'Import / export'],
    ['floorplans', 'Floor plans (SVG/CAD)'], ['guide', 'User guide'], ['future', 'Future integrations'],
  ];

  function card(id, title, body, head = '') {
    return `<div class="card" id="set-${id}"><div class="card-head"><h3>${title}</h3>${head}</div><div class="card-body">${body}</div></div>`;
  }

  ST.show = (params = {}) => {
    const root = U.$('#view-settings');
    const s = S.settings();
    const fac = S.factory();
    const kb = Math.round(S.storageBytes() / 1024);
    const sample = S.views()[0];

    root.innerHTML = `
      <div class="view-head"><h2>Settings &amp; User Guide</h2></div>
      <div class="settings-layout">
        <nav class="card settings-nav">${SECTIONS.map(([k, t]) => `<a href="#" data-sec="${k}">${t}</a>`).join('')}</nav>
        <div class="settings-sections">

        ${card('general', 'General settings', `
          <form class="form-grid" id="setGeneral">
            <div class="field"><label>Factory name</label><input name="factoryName" value="${U.esc(fac.name)}"></div>
            <div class="field"><label>Factory code</label><input name="factoryCode" value="${U.esc(fac.code || '')}" maxlength="10"></div>
            <div class="field full"><label>QR base URL</label><input name="qrBaseUrl" value="${U.esc(s.qrBaseUrl || '')}" placeholder="${U.esc(location.href.split('#')[0])}">
              <div class="hint">Address encoded in QR labels (e.g. https://assets.example-factory.com/). Leave empty to use the current address.</div></div>
            <div class="field"><label>Marker size</label><select name="markerScale">${[0.8, 1, 1.25, 1.5].map((v) => `<option value="${v}" ${Number(s.markerScale || 1) === v ? 'selected' : ''}>${v === 1 ? 'Normal' : v < 1 ? 'Small' : v === 1.25 ? 'Large' : 'Extra large (tablet)'}</option>`).join('')}</select></div>
            <div class="field"><span class="lbl">Map options</span>
              <label class="check"><input type="checkbox" name="autoDetectZone" ${s.autoDetectZone !== false ? 'checked' : ''}> Auto-detect zone from X/Y</label>
              <label class="check"><input type="checkbox" name="showZones" ${s.showZones !== false ? 'checked' : ''}> Show zone boundaries</label>
              <label class="check"><input type="checkbox" name="showLabels" ${s.showLabels !== false ? 'checked' : ''}> Show Asset ID labels when zoomed</label></div>
            <div class="full"><button class="btn btn-primary" type="submit">${U.icon('check', 16)}Save settings</button></div>
          </form>`)}

        ${card('users', 'Users', `
          <p class="small muted">Names available in "Acting as" (top bar) and recorded as <b>Updated By</b> in location history. This demo has no login. <span class="future-tag">FUTURE INTEGRATION</span> authentication &amp; roles with a backend.</p>
          <table class="tbl"><thead><tr><th>Name</th><th>Role</th><th class="actions"></th></tr></thead><tbody>
            ${S.users().map((u) => `<tr data-id="${U.esc(u.id)}"><td>${U.esc(u.name)}</td><td class="muted">${U.esc(u.role)}</td><td class="actions"><button class="icon-btn" data-uact="edit">${U.icon('edit', 16)}</button><button class="icon-btn" data-uact="del" style="color:var(--red)">${U.icon('trash', 16)}</button></td></tr>`).join('')}
          </tbody></table>`, `<button class="btn btn-sm" id="usrAdd">${U.icon('plus', 14)}Add user</button>`)}

        ${card('categories', 'Asset categories', `
          <p class="small muted">The category code is used in new Asset IDs (AST-<b>EQP</b>-0001) and cannot be changed once created. Marker shape identifies the category on the map.</p>
          <table class="tbl"><thead><tr><th>Code</th><th>Name</th><th>Marker</th><th class="num">Assets</th><th class="actions"></th></tr></thead><tbody>
            ${S.categories().map((c) => `<tr data-id="${U.esc(c.id)}"><td class="mono"><b>${U.esc(c.code)}</b></td><td>${U.esc(c.name)}</td><td>${U.shapeSvg(c.shape, '#64748b')} <span class="small muted">${c.shape}</span></td><td class="num">${S.assets().filter((a) => a.categoryId === c.id).length}</td>
              <td class="actions"><button class="icon-btn" data-cact="edit">${U.icon('edit', 16)}</button><button class="icon-btn" data-cact="del" style="color:var(--red)">${U.icon('trash', 16)}</button></td></tr>`).join('')}
          </tbody></table>`, `<button class="btn btn-sm" id="catAdd">${U.icon('plus', 14)}Add category</button>`)}

        ${card('statuses', 'Statuses', `
          <p class="small muted">Status sets the marker colour. The three core statuses (Active, Inspection Due, Out of Service) drive the dashboard and can be renamed/recoloured but not deleted.</p>
          <table class="tbl"><thead><tr><th>Status</th><th>Colour</th><th>Type</th><th class="num">Assets</th><th class="actions"></th></tr></thead><tbody>
            ${S.statuses().map((x) => `<tr data-id="${U.esc(x.id)}"><td>${UI.statusBadge(x.id)}</td><td class="mono small">${x.color}</td><td class="small muted">${x.core ? 'Core' : 'Custom'}</td><td class="num">${S.assets().filter((a) => a.status === x.id).length}</td>
              <td class="actions"><button class="icon-btn" data-sact="edit">${U.icon('edit', 16)}</button>${x.core ? '' : `<button class="icon-btn" data-sact="del" style="color:var(--red)">${U.icon('trash', 16)}</button>`}</td></tr>`).join('')}
          </tbody></table>`, `<button class="btn btn-sm" id="stAdd">${U.icon('plus', 14)}Add status</button>`)}

        ${card('coding', 'Location coding rules', `<div class="guide">
          <p>The system uses <b>two independent identifiers</b>:</p>
          <table><tr><th>Identifier</th><th>Example</th><th>Behaviour</th></tr>
            <tr><td><b>Asset ID</b></td><td class="mono">AST-EQP-0001</td><td>Permanent for the asset's whole lifecycle. Never changes when the asset moves, and is never reused after deletion. Format AST-&lt;category code&gt;-&lt;4-digit sequence&gt;.</td></tr>
            <tr><td><b>Location Code</b></td><td class="mono">F1-PR-EXT-X025-Y040</td><td>Describes where the asset is now. Recalculated automatically on every move (and when floor/department/zone codes are edited).</td></tr></table>
          <h4>Location Code structure</h4>
          <table><tr><th>Part</th><th>Example</th><th>Meaning</th></tr>
            <tr><td>Floor code</td><td class="mono">F1</td><td>Floor 1</td></tr>
            <tr><td>Department code</td><td class="mono">PR</td><td>Department that owns the <i>zone</i> (area), e.g. Production</td></tr>
            <tr><td>Zone code</td><td class="mono">EXT</td><td>Extraction zone</td></tr>
            <tr><td>X</td><td class="mono">X025</td><td>X coordinate, rounded to whole %, 3 digits</td></tr>
            <tr><td>Y</td><td class="mono">Y040</td><td>Y coordinate, rounded to whole %, 3 digits</td></tr></table>
          <h4>Coordinate system</h4>
          <div class="coord-fig">
            <svg width="230" height="150" viewBox="0 0 230 150" role="img" aria-label="Coordinate system diagram">
              <rect x="30" y="20" width="180" height="108" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/>
              <circle cx="30" cy="20" r="4" fill="#dc2626"/><text x="4" y="14" font-size="10" fill="#dc2626">0,0</text>
              <path d="M30 20h70" stroke="#1d63d8" stroke-width="2" marker-end="url(#ar)"/><text x="104" y="16" font-size="11" fill="#1d63d8">X →</text>
              <path d="M30 20v60" stroke="#0d9488" stroke-width="2" marker-end="url(#ar2)"/><text x="6" y="92" font-size="11" fill="#0d9488">Y ↓</text>
              <text x="212" y="140" font-size="10" fill="#64748b" text-anchor="end">100,100</text>
              <circle cx="${30 + 180 * 0.25}" cy="${20 + 108 * 0.4}" r="5" fill="#0d9488" stroke="#fff" stroke-width="1.5"/><text x="${36 + 180 * 0.25}" y="${24 + 108 * 0.4}" font-size="10" fill="#0f172a">X 25 · Y 40</text>
              <defs><marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6z" fill="#1d63d8"/></marker><marker id="ar2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6z" fill="#0d9488"/></marker></defs>
            </svg>
            <ul style="flex:1;min-width:220px">
              <li>Coordinates are <b>normalized percentages 0–100</b> of the floor drawing's width (X) and height (Y).</li>
              <li><b>Origin</b> = top-left corner of the drawing. <b>X</b> increases to the right, <b>Y</b> increases downward (same as SVG and most CAD exports viewed on screen).</li>
              <li>Stored with 0.1 % precision, independent of screen size, zoom or device. On a 100 m wide building, 0.1 % ≈ 10 cm.</li>
              <li>If you replace a drawing, keep the same extents/margins so existing coordinates stay valid.</li>
            </ul></div>
          ${sample ? `<p>Example from current data: <span class="asset-id">${U.esc(sample.id)}</span> → <span class="loc-code">${U.esc(sample.locationCode)}</span></p>` : ''}
        </div>`)}

        ${card('data', 'Data management &amp; backup', `
          <div class="callout ${S.isDemo() ? 'warn' : ''}" style="margin-bottom:12px">${U.icon('database', 16)}<div>${F.remote.enabled()
            ? `Data is shared through the server (<span class="mono">${U.esc(F.remote.base())}</span>, Cloudflare D1) and cached in this browser (${kb} KB). Changes by other users appear within ~20 s. Reset / restore / clear replace data for <b>all users</b> and need the admin key.`
            : `Data is stored in this browser's LocalStorage (${kb} KB used, typical limit ≈ 5 MB). It is <b>not shared</b> between browsers or computers.`} Export a JSON backup regularly. ${S.isDemo() ? '<br><b>Current data is the illustrative demo dataset.</b>' : ''}</div></div>
          <div class="grid grid-2">
            <div><h4>Backup &amp; restore</h4><p class="small muted">Full backup of all data (assets, locations, history, zones, floor plans, settings) as JSON.</p>
              <div class="btn-row"><button class="btn btn-primary" id="dmBackup">${U.icon('download', 16)}Download JSON backup</button><button class="btn" id="dmRestore">${U.icon('upload', 16)}Restore from backup</button></div></div>
            <div><h4>Spreadsheets</h4><p class="small muted">Asset register as CSV/Excel, or bulk import.</p>
              <div class="btn-row"><button class="btn" id="dmCsv">${U.icon('download', 16)}Assets CSV</button><button class="btn" id="dmXlsx">${U.icon('download', 16)}Workbook (.xlsx)</button><button class="btn" id="dmImport">${U.icon('upload', 16)}Import…</button></div></div>
            <div><h4>Reset demo data</h4><p class="small muted">Replace everything with the original illustrative demo dataset.</p>
              <button class="btn btn-danger" id="dmReset">${U.icon('history', 16)}Reset demo data</button></div>
            <div><h4>Start with empty data</h4><p class="small muted">Remove demo assets, zones, history and floor plans; keeps categories, statuses, departments and users.</p>
              <button class="btn btn-danger" id="dmClear">${U.icon('trash', 16)}Clear all data</button></div>
          </div>`)}

        ${card('importexport', 'Import / export instructions', `<div class="guide">
          <h4>Exporting</h4>
          <ul><li><b>Asset Register → Export CSV / Excel</b> exports the rows currently shown (respects search and filters).</li>
            <li>The Excel workbook contains sheets <i>Assets</i>, <i>Zones</i>, <i>Location History</i> and <i>About</i>.</li>
            <li><b>Location History → Export</b> exports the filtered history.</li></ul>
          <h4>Importing assets (CSV / Excel)</h4>
          <ol><li>Download the template (<a href="#" id="tplCsv">CSV</a> · <a href="#" id="tplXlsx">Excel</a>) or use an exported file.</li>
            <li>Fill one row per asset. Required: Asset ID, Asset Name, Category, Department, Floor, Zone, X, Y, Status.</li>
            <li>Category, Department, Floor, Zone and Status can be given as <b>code or name</b> (e.g. <span class="mono">EQP</span> or <span class="mono">Equipment</span>). Zones must already exist on that floor.</li>
            <li>X / Y are percentages 0–100. Decimal comma is accepted. Dates: YYYY-MM-DD or DD/MM/YYYY.</li>
            <li>Asset Register → <b>Import CSV / Excel</b>, choose the file and mode. A preview lists new rows, updates and errors <i>before</i> anything is saved.</li>
            <li>Rows with errors are skipped; valid rows are imported. Location changes on updated assets are written to Location History with reason "Bulk import: &lt;file&gt;".</li></ol>
          <p>Validation: duplicate Asset IDs (in the file and against existing assets), missing required fields, unknown codes, coordinates outside 0–100, zone not on the given floor, and Asset IDs of deleted assets.</p>
          <p>CSV files are written as UTF-8 with BOM so Excel opens Vietnamese/accented text correctly.</p></div>`)}

        ${card('floorplans', 'Floor plans: SVG import and CAD / PDF conversion', `<div class="guide">
          <p>Each floor has its own drawing. <b>SVG is the preferred format</b> (vector, sharp at every zoom, small). PNG/JPG/WEBP images are accepted as a fallback. Import via <a href="#/zones">Factory Zones</a> → Floors → <b>Import plan</b>.</p>
          <h4>Recommended workflow</h4>
          <ol><li><b>From AutoCAD (DWG/DXF):</b> freeze unnecessary layers (dimensions, hatch, furniture text), set the plot area to the building outline, then <i>Plot → "DWG to PDF"</i> or export SVG (AutoCAD Web / third-party plotters). Alternatively open the DXF in <b>Inkscape</b> or <b>LibreCAD</b> and save as SVG.</li>
            <li><b>From PDF:</b> open the PDF page in Inkscape (<i>File → Open</i>, choose "Import via Poppler/Cairo"), crop to the building outline (<i>Edit → Resize Page to Selection</i>) and <i>Save As → Optimized SVG</i>. Command line: <span class="mono">pdftocairo -svg plan.pdf plan.svg</span> or <span class="mono">inkscape plan.pdf --export-type=svg</span>.</li>
            <li><b>From a scanned drawing / image:</b> crop to the building outline and save as PNG (≤ 3000 px wide). Larger images are automatically downscaled.</li>
            <li>Keep file size small (ideally &lt; 1 MB): remove hidden layers, text styles, embedded fonts and raster images. LocalStorage holds about 5 MB in total.</li>
            <li>After import, define zones with <b>Draw boundary on map</b>, then place assets with <b>Move on map</b> or by entering X/Y.</li></ol>
          <h4>Important</h4>
          <ul><li>The whole drawing area maps to 0–100 %. Crop the drawing to a consistent outline (e.g. outside walls + small margin); replacing it later with a different crop would shift all positions.</li>
            <li>Imported SVGs are rendered as images: scripts and event handlers are removed for safety.</li>
            <li>Do not use real coordinates from survey data without verifying them on site. The sample drawings and coordinates provided are <b>demo data only</b>.</li></ul></div>`)}

        ${card('guide', 'User guide', `<div class="guide">
          <h4>Find an asset</h4>
          <ul><li>Type an Asset ID or name in the top search bar (or the map search) and press Enter — the map switches to the correct floor, zooms to the asset and opens its details.</li>
            <li>Or scan its QR label: phone camera opens the link; handheld scanners work in <i>QR Codes → Scan / look up</i>.</li></ul>
          <h4>Use the map</h4>
          <ul><li>Mouse wheel / pinch to zoom, drag to pan, <i>Fit</i> button to reset. Floor tabs switch floors.</li>
            <li>Marker <b>colour = status</b>, marker <b>shape = category</b> (see legend). Click a marker for details.</li>
            <li>Filters: zone, responsible department, categories (show/hide) and statuses. The cursor position is shown bottom-left in %.</li></ul>
          <h4>Add / edit / delete assets</h4>
          <ul><li>Asset Register → <b>Add asset</b>. The Asset ID is suggested from the category; the Location Code is generated automatically.</li>
            <li>Edit from the register or map panel. Changing floor/zone/X/Y requires a reason and creates a history record.</li>
            <li>Delete asks for confirmation; history is retained and the ID is never reused.</li></ul>
          <h4>Move an asset</h4>
          <ol><li>Select the asset on the map → <b>Move on map</b>.</li><li>(Optional) switch floor, then click the new position. The zone is detected automatically.</li><li>Check the new Location Code, enter <b>Reason for change</b> and save. A Location History record is appended.</li></ol>
          <h4>Manage zones</h4>
          <ul><li>Factory Zones → Add zone → <b>Draw boundary on map</b> (drag a rectangle). Zones are assigned to a floor and a department.</li>
            <li>Click a zone in the structure tree or "Map" to view it on the map.</li></ul>
          <h4>Print QR labels</h4>
          <ul><li>QR Codes → tick assets → choose label size → <b>Print labels</b>. Use "Actual size" / 100 % scale in the print dialog. Download single PNGs from the preview.</li>
            <li>Set the <b>QR base URL</b> (General settings) to the hosted address first, so labels open the app from any phone.</li></ul></div>`)}

        ${card('future', 'Future integrations (not available in this local version)', `<div class="future-list">
          ${[
            ['Multi-user database & sync', 'Shared central database (Cloudflare D1, Supabase/PostgreSQL) instead of per-browser LocalStorage. See docs/DATABASE_MIGRATION.md.'],
            ['Authentication & roles', 'Login, viewer/editor/admin permissions; "Updated By" taken from the signed-in user.'],
            ['Real-time location tracking', 'RTLS / BLE / UWB tags or GPS for mobile equipment. QR codes only identify assets; they do not track them.'],
            ['Cross-browser camera scanning', 'Bundled QR decoder for iOS/Firefox. Currently uses the browser BarcodeDetector API where available.'],
            ['CMMS / ERP link', 'Work orders, inspection schedules and maintenance history from the maintenance system (e.g. SAP PM, Maximo).'],
            ['Polygon zones', 'Non-rectangular zone boundaries traced from the drawing.'],
          ].map(([t, d]) => `<div class="it"><span class="future-tag">FUTURE</span><div><b>${t}</b><div class="small muted">${d}</div></div></div>`).join('')}
        </div>`)}
        </div>
      </div>`;

    // navigation inside settings
    U.$$('[data-sec]', root).forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); ST.scrollTo(a.dataset.sec); }));
    if (params.section) setTimeout(() => ST.scrollTo(params.section), 30);

    U.$('#setGeneral').addEventListener('submit', (e) => {
      e.preventDefault();
      const d = UI.formData(e.target);
      if (d.qrBaseUrl && !/^https?:\/\//i.test(d.qrBaseUrl.trim())) return UI.toast('QR base URL must start with http:// or https://', 'error');
      if (!d.factoryName.trim()) return UI.toast('Factory name is required', 'error');
      S.updateFactory({ name: d.factoryName.trim(), code: d.factoryCode.trim() });
      S.updateSettings({ qrBaseUrl: d.qrBaseUrl.trim(), markerScale: Number(d.markerScale), autoDetectZone: d.autoDetectZone, showZones: d.showZones, showLabels: d.showLabels });
      UI.toast('Settings saved.', 'success');
    });

    // users
    U.$('#usrAdd').addEventListener('click', () => userForm());
    U.$('#set-users').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-uact]'); if (!b) return;
      const id = b.closest('tr').dataset.id;
      if (b.dataset.uact === 'edit') userForm(S.users().find((u) => u.id === id));
      else if (S.users().length <= 1) UI.toast('At least one user is required.', 'error');
      else if (await UI.confirm('Remove this user from the list? Existing history records keep the name.', { danger: true, okLabel: 'Remove' })) S.deleteUser(id);
    });
    // categories
    U.$('#catAdd').addEventListener('click', () => categoryForm());
    U.$('#set-categories').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-cact]'); if (!b) return;
      const id = b.closest('tr').dataset.id;
      if (b.dataset.cact === 'edit') categoryForm(S.category(id));
      else if (await UI.confirm(`Delete category <b>${U.esc(id)}</b>?`, { danger: true, okLabel: 'Delete' })) try { S.deleteCategory(id); UI.toast('Category deleted.', 'success'); } catch (err) { UI.toast(err.message, 'error'); }
    });
    // statuses
    U.$('#stAdd').addEventListener('click', () => statusForm());
    U.$('#set-statuses').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-sact]'); if (!b) return;
      const id = b.closest('tr').dataset.id;
      if (b.dataset.sact === 'edit') statusForm(S.status(id));
      else if (await UI.confirm(`Delete status <b>${U.esc(S.status(id).name)}</b>?`, { danger: true, okLabel: 'Delete' })) try { S.deleteStatus(id); UI.toast('Status deleted.', 'success'); } catch (err) { UI.toast(err.message, 'error'); }
    });
    // data
    U.$('#dmBackup').addEventListener('click', IO.backup);
    U.$('#dmRestore').addEventListener('click', IO.restore);
    U.$('#dmCsv').addEventListener('click', () => IO.exportAssets('csv'));
    U.$('#dmXlsx').addEventListener('click', () => IO.exportAssets('xlsx'));
    U.$('#dmImport').addEventListener('click', () => F.views.register.openImport());
    U.$('#tplCsv').addEventListener('click', (e) => { e.preventDefault(); IO.downloadTemplate('csv'); });
    U.$('#tplXlsx').addEventListener('click', (e) => { e.preventDefault(); IO.downloadTemplate('xlsx'); });
    U.$('#dmReset').addEventListener('click', async () => {
      if (await UI.confirm('Replace <b>all</b> current data with the original demo dataset? Download a backup first if you want to keep your changes.', { title: 'Reset demo data', danger: true, okLabel: 'Reset to demo' })) { S.reset(); UI.toast('Demo data restored.', 'success'); }
    });
    U.$('#dmClear').addEventListener('click', async () => {
      if (await UI.confirm('Delete all assets, zones, floor plans and history from this browser? This cannot be undone (except by restoring a backup).', { title: 'Clear all data', danger: true, okLabel: 'Clear all data' })) { S.clearAll(); UI.toast('All data cleared. Start by importing a floor plan in Factory Zones.', 'success', 5000); }
    });
  };
  ST.refresh = () => ST.show();
  ST.scrollTo = (sec) => {
    const el = U.$('#set-' + sec);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    U.$$('[data-sec]').forEach((a) => a.classList.toggle('on', a.dataset.sec === sec));
  };

  function userForm(u) {
    const form = U.h(`<form class="form-grid"><div class="field"><label>Name <span class="req">*</span></label><input name="name" value="${U.esc(u ? u.name : '')}"></div><div class="field"><label>Role</label><input name="role" value="${U.esc(u ? u.role : '')}"></div></form>`);
    UI.modal({ title: u ? 'Edit user' : 'Add user', body: form, actions: [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: () => {
      const d = UI.formData(form);
      try {
        const wasCurrent = u && S.currentUser() === u.name;
        S.saveUser({ id: u && u.id, name: d.name.trim(), role: d.role.trim() });
        if (wasCurrent) S.setCurrentUser(d.name.trim());
      } catch (e) { UI.toast(e.message, 'error'); return false; }
    } }] });
  }
  function categoryForm(c) {
    const form = U.h(`<form class="form-grid">
      <div class="field"><label>Code <span class="req">*</span></label><input name="code" maxlength="6" value="${U.esc(c ? c.code : '')}" ${c ? 'readonly' : ''} style="text-transform:uppercase;font-family:var(--mono)"><div class="hint">Used in Asset IDs, e.g. AST-<b>MHE</b>-0001</div></div>
      <div class="field"><label>Name <span class="req">*</span></label><input name="name" value="${U.esc(c ? c.name : '')}"></div>
      <div class="field"><label>Marker shape</label><select name="shape">${SHAPES.map((s) => `<option ${c && c.shape === s ? 'selected' : ''}>${s}</option>`).join('')}</select></div></form>`);
    UI.modal({ title: c ? 'Edit category' : 'Add category', body: form, actions: [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: () => {
      const d = UI.formData(form);
      try { S.saveCategory({ id: c && c.id, code: d.code.trim().toUpperCase(), name: d.name.trim(), shape: d.shape }); UI.toast('Category saved.', 'success'); } catch (e) { UI.toast(e.message, 'error'); return false; }
    } }] });
  }
  function statusForm(x) {
    const form = U.h(`<form class="form-grid">
      <div class="field"><label>Name <span class="req">*</span></label><input name="name" value="${U.esc(x ? x.name : '')}"></div>
      <div class="field"><label>Colour</label><input type="color" name="color" value="${U.esc(x ? x.color : '#64748b')}"></div></form>`);
    UI.modal({ title: x ? 'Edit status' : 'Add status', body: form, actions: [{ label: 'Cancel' }, { label: 'Save', primary: true, onClick: () => {
      const d = UI.formData(form);
      try { S.saveStatus({ id: x && x.id, name: d.name.trim(), color: d.color }); UI.toast('Status saved.', 'success'); } catch (e) { UI.toast(e.message, 'error'); return false; }
    } }] });
  }
})(window.FAM);
