/* Factory Asset Map — TAB 03 Asset Register (search, filter, sort, CRUD, import/export). */
window.FAM = window.FAM || {};
(function (F) {
  'use strict';
  const U = F.util, S = F.store, UI = F.ui, IO = F.io;
  F.views = F.views || {};
  const R = (F.views.register = {});

  const st = { q: '', cat: '', dept: '', floor: '', zone: '', status: '', sort: 'id', dir: 1, page: 0, size: 50 };
  let root, built = false;

  const COLS = [
    { k: 'id', h: 'Asset ID', cls: 'sticky-col', fmt: (v) => `<a href="#" class="asset-id" data-act="open">${U.esc(v.id)}</a>` },
    { k: 'name', h: 'Asset Name', fmt: (v) => U.esc(v.name) },
    { k: 'categoryName', h: 'Category', fmt: (v) => `<span class="chip">${U.shapeSvg(v.categoryShape, '#64748b', 10)} ${U.esc(v.categoryName)}</span>` },
    { k: 'deptName', h: 'Department', fmt: (v) => U.esc(v.deptName) },
    { k: 'floorCode', h: 'Floor', fmt: (v) => U.esc(v.floorCode) },
    { k: 'zoneName', h: 'Zone', fmt: (v) => U.esc(v.zoneName) },
    { k: 'x', h: 'X', num: true, fmt: (v) => v.x },
    { k: 'y', h: 'Y', num: true, fmt: (v) => v.y },
    { k: 'locationCode', h: 'Location Code', fmt: (v) => `<span class="loc-code">${U.esc(v.locationCode)}</span>` },
    { k: 'manufacturer', h: 'Manufacturer', fmt: (v) => U.esc(v.manufacturer) },
    { k: 'model', h: 'Model', fmt: (v) => U.esc(v.model) },
    { k: 'serial', h: 'Serial Number', fmt: (v) => `<span class="mono">${U.esc(v.serial)}</span>` },
    { k: 'statusName', h: 'Status', fmt: (v) => UI.statusBadge(v.status) },
    { k: 'lastInspection', h: 'Last Insp.', fmt: (v) => `<span class="nowrap">${U.fmtDate(v.lastInspection)}</span>` },
    { k: 'photo', h: 'Photo', fmt: (v) => (v.photo ? `<span class="photo-thumb" style="width:34px;height:26px;background-image:url('${U.esc(v.photo)}')"></span>` : '<span class="muted">—</span>') },
    { k: 'remarks', h: 'Remarks', fmt: (v) => `<span class="muted small" title="${U.esc(v.remarks)}">${U.esc((v.remarks || '').slice(0, 40))}${(v.remarks || '').length > 40 ? '…' : ''}</span>` },
  ];

  function build() {
    root = U.$('#view-register');
    root.innerHTML = `
      <div class="view-head">
        <h2>Asset Register</h2>
        <div class="btn-row">
          <button class="btn" id="rgImport">${U.icon('upload', 16)}Import CSV / Excel</button>
          <button class="btn" id="rgExportCsv">${U.icon('download', 16)}Export CSV</button>
          <button class="btn" id="rgExportXlsx">${U.icon('download', 16)}Export Excel</button>
          <button class="btn btn-primary" id="rgAdd">${U.icon('plus', 16)}Add asset</button>
        </div>
        <div class="sub">Asset master data. Asset ID is permanent; Location Code is recalculated whenever an asset moves.</div>
      </div>
      <div class="card">
        <div class="toolbar">
          <div class="search">${U.icon('search', 16)}<input type="search" id="rgQ" placeholder="Search ID, name, serial, model, location code…"></div>
          <select id="rgCat"></select><select id="rgDept"></select><select id="rgFloor"></select><select id="rgZone"></select><select id="rgStatus"></select>
          <button class="btn btn-sm btn-ghost" id="rgClear">Clear</button>
          <span class="count" id="rgCount"></span>
        </div>
        <div class="table-wrap" id="rgTableWrap"></div>
        <div class="pager" id="rgPager"></div>
      </div>`;
    U.$('#rgQ').addEventListener('input', U.debounce((e) => { st.q = e.target.value; st.page = 0; renderTable(); }, 150));
    [['rgCat', 'cat'], ['rgDept', 'dept'], ['rgFloor', 'floor'], ['rgZone', 'zone'], ['rgStatus', 'status']].forEach(([id, k]) =>
      U.$('#' + id).addEventListener('change', (e) => { st[k] = e.target.value; if (k === 'floor') st.zone = ''; st.page = 0; renderFilters(); renderTable(); }));
    U.$('#rgClear').addEventListener('click', () => { Object.assign(st, { q: '', cat: '', dept: '', floor: '', zone: '', status: '', page: 0 }); U.$('#rgQ').value = ''; renderFilters(); renderTable(); });
    U.$('#rgAdd').addEventListener('click', () => F.views.assetForm.open(null));
    U.$('#rgExportCsv').addEventListener('click', () => IO.exportAssets('csv', filtered()));
    U.$('#rgExportXlsx').addEventListener('click', () => IO.exportAssets('xlsx', filtered()));
    U.$('#rgImport').addEventListener('click', R.openImport);
    U.$('#rgTableWrap').addEventListener('click', onTableClick);
    built = true;
  }

  function renderFilters() {
    U.$('#rgCat').innerHTML = UI.options(S.categories(), st.cat, { empty: 'All categories' });
    U.$('#rgDept').innerHTML = UI.options(S.departments(), st.dept, { empty: 'All departments' });
    U.$('#rgFloor').innerHTML = UI.options(S.floors(), st.floor, { empty: 'All floors', label: (f) => f.code + ' – ' + f.name });
    U.$('#rgZone').innerHTML = UI.options(S.zones(st.floor || undefined), st.zone, { empty: 'All zones', label: (z) => `${S.floor(z.floorId)?.code}/${z.code} – ${z.name}` });
    U.$('#rgStatus').innerHTML = UI.options(S.statuses(), st.status, { empty: 'All statuses' });
  }

  function filtered() {
    const q = st.q.trim().toLowerCase();
    let list = S.views().filter((v) =>
      (!st.cat || v.categoryId === st.cat) && (!st.dept || v.departmentId === st.dept) &&
      (!st.floor || v.floorId === st.floor) && (!st.zone || v.zoneId === st.zone) && (!st.status || v.status === st.status) &&
      (!q || [v.id, v.name, v.serial, v.model, v.manufacturer, v.locationCode, v.zoneName, v.remarks].some((s) => String(s || '').toLowerCase().includes(q))));
    const col = COLS.find((c) => c.k === st.sort) || COLS[0];
    list.sort((a, b) => {
      const x = a[col.k], y = b[col.k];
      if (col.num) return ((Number(x) || 0) - (Number(y) || 0)) * st.dir;
      return String(x ?? '').localeCompare(String(y ?? ''), undefined, { numeric: true, sensitivity: 'base' }) * st.dir;
    });
    return list;
  }

  function renderTable() {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / st.size));
    st.page = Math.min(st.page, pages - 1);
    const rows = list.slice(st.page * st.size, (st.page + 1) * st.size);
    U.$('#rgCount').textContent = `${list.length} of ${S.assets().length} assets`;
    U.$('#rgTableWrap').innerHTML = rows.length
      ? `<table class="tbl tbl-nowrap"><thead><tr>
          ${COLS.map((c) => `<th class="sortable ${c.cls || ''} ${c.num ? 'num' : ''} ${st.sort === c.k ? 'sorted' : ''}" data-sort="${c.k}">${c.h}<span class="sort">${st.sort === c.k ? (st.dir > 0 ? '▲' : '▼') : '▲'}</span></th>`).join('')}
          <th class="actions">Actions</th></tr></thead>
        <tbody>${rows.map((v) => `<tr data-id="${U.esc(v.id)}">
          ${COLS.map((c) => `<td class="${c.cls || ''} ${c.num ? 'num' : ''}">${c.fmt(v)}</td>`).join('')}
          <td class="actions">
            <button class="btn btn-sm" data-act="locate" title="Show on map">${U.icon('locate', 14)}Locate</button>
            <button class="icon-btn" data-act="move" title="Move (update location)">${U.icon('move', 16)}</button>
            <button class="icon-btn" data-act="edit" title="Edit">${U.icon('edit', 16)}</button>
            <button class="icon-btn" data-act="qr" title="QR code">${U.icon('qr', 16)}</button>
            <button class="icon-btn" data-act="delete" title="Delete" style="color:var(--red)">${U.icon('trash', 16)}</button>
          </td></tr>`).join('')}</tbody></table>`
      : UI.empty(S.assets().length ? 'No assets match the current search / filters.' : 'No assets yet. Add an asset or import a CSV / Excel file.');
    U.$$('th[data-sort]', root).forEach((th) => th.addEventListener('click', () => {
      st.dir = st.sort === th.dataset.sort ? -st.dir : 1;
      st.sort = th.dataset.sort;
      renderTable();
    }));
    U.$('#rgPager').innerHTML = pages > 1
      ? `<span>Page ${st.page + 1} / ${pages}</span><span class="sp"></span><button class="btn btn-sm" data-pg="-1" ${st.page === 0 ? 'disabled' : ''}>Previous</button><button class="btn btn-sm" data-pg="1" ${st.page >= pages - 1 ? 'disabled' : ''}>Next</button>`
      : `<span>Click a column header to sort · ${list.length} row(s)</span>`;
    U.$$('[data-pg]', root).forEach((b) => b.addEventListener('click', () => { st.page += Number(b.dataset.pg); renderTable(); }));
  }

  async function onTableClick(e) {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    e.preventDefault();
    const id = btn.closest('tr').dataset.id;
    const act = btn.dataset.act;
    if (act === 'locate') F.views.map.locate(id);
    else if (act === 'edit' || act === 'open') F.views.assetForm.open(id);
    else if (act === 'move') { const v = S.view(id); F.views.map.openMoveDialog(id, { floorId: v.floorId, zoneId: v.zoneId, x: v.x, y: v.y }); }
    else if (act === 'qr') F.views.qr.showFor(id);
    else if (act === 'delete') {
      const v = S.view(id);
      const ok = await UI.confirm(`Delete <b>${U.esc(v.id)}</b> – ${U.esc(v.name)} from the register?<br><br><span class="small muted">Location history is kept (a "REMOVE" record is added). The Asset ID will not be reused.</span>`, { title: 'Delete asset', okLabel: 'Delete asset', danger: true });
      if (ok) { S.deleteAsset(id, { by: S.currentUser() }); UI.toast(`${id} deleted.`, 'success'); }
    }
  }

  /* ---------------- import dialog ---------------- */
  R.openImport = () => {
    let analysis = null, fileName = '';
    const box = U.h(`<div>
      <div class="callout">${U.icon('info', 16)}<div>
        Accepted: <b>.csv</b> (comma or semicolon) or <b>.xlsx / .xls</b> (first sheet, or sheet named "Assets").
        Required columns: Asset ID, Asset Name, Category, Department, Floor, Zone, X, Y, Status.
        Category / Department / Floor / Zone / Status may be given as code or name. Location Code is calculated automatically.
        <div class="btn-row" style="margin-top:8px"><button class="btn btn-sm" id="imTplCsv">${U.icon('download', 14)}CSV template</button><button class="btn btn-sm" id="imTplXlsx">${U.icon('download', 14)}Excel template</button></div>
      </div></div>
      <div class="form-grid" style="margin-top:14px">
        <div class="field full"><label>File</label><input type="file" id="imFile" accept=".csv,.txt,.xlsx,.xls,.ods"></div>
        <div class="field full"><span class="lbl">Mode</span>
          <label class="check"><input type="radio" name="mode" value="add" checked> Add new assets only (existing IDs are reported as errors)</label>
          <label class="check"><input type="radio" name="mode" value="upsert"> Add new and update existing assets (location changes are logged in history)</label></div>
      </div>
      <div id="imResult" style="margin-top:12px"></div>
    </div>`);
    const run = async () => {
      const file = U.$('#imFile', box).files[0];
      const out = U.$('#imResult', box);
      analysis = null;
      if (!file) { out.innerHTML = ''; return; }
      fileName = file.name;
      try {
        const rows = await IO.readTable(file);
        const mode = U.$('input[name=mode]:checked', box).value;
        analysis = IO.analyse(rows, mode);
        if (analysis.headerErrors.length) {
          out.innerHTML = `<div class="callout err">${U.icon('alert', 16)}<div>${analysis.headerErrors.map(U.esc).join('<br>')}</div></div>`;
          analysis = null;
          return;
        }
        const a = analysis;
        out.innerHTML = `<div class="import-summary">
            <span class="chip" style="background:#dcfce7;color:#166534">${a.creates.length} new</span>
            <span class="chip" style="background:#e0ecff;color:#1d4ed8">${a.updates.length} update(s)</span>
            <span class="chip" style="background:#fee2e2;color:#991b1b">${a.errors.length} row(s) with errors – will be skipped</span>
          </div>
          ${a.errors.length ? `<div class="err-list">${a.errors.map((e) => `<div><b>Row ${e.line}</b>${e.id ? ` · <span class="mono">${U.esc(e.id)}</span>` : ''}: ${e.errs.map(U.esc).join('; ')}</div>`).join('')}</div>` : ''}
          ${a.creates.length + a.updates.length ? `<p class="small muted" style="margin-top:8px">Valid rows will be imported when you click <b>Import</b>.</p>` : '<p class="small muted" style="margin-top:8px">Nothing to import.</p>'}`;
      } catch (e) {
        out.innerHTML = `<div class="callout err">${U.icon('alert', 16)}<div>${U.esc(e.message)}</div></div>`;
      }
    };
    U.$('#imFile', box).addEventListener('change', run);
    U.$$('input[name=mode]', box).forEach((r) => r.addEventListener('change', run));
    U.$('#imTplCsv', box).addEventListener('click', () => IO.downloadTemplate('csv'));
    U.$('#imTplXlsx', box).addEventListener('click', () => IO.downloadTemplate('xlsx'));
    UI.modal({
      title: 'Import assets from CSV / Excel', size: 'modal-lg', body: box,
      actions: [
        { label: 'Cancel' },
        { label: 'Import', primary: true, icon: 'upload', onClick: () => {
          if (!analysis || !(analysis.creates.length + analysis.updates.length)) { UI.toast('Choose a file with at least one valid row.', 'error'); return false; }
          try {
            const r = IO.apply(analysis, { by: S.currentUser(), reason: 'Bulk import: ' + fileName });
            UI.toast(`Imported: ${r.created} new, ${r.updated} updated (${r.moved} moved). ${analysis.errors.length} row(s) skipped.`, 'success', 5000);
          } catch (e) { UI.toast(e.message, 'error', 6000); return false; }
        } },
      ],
    });
  };

  R.setFilter = (patch) => {
    Object.assign(st, { q: '', cat: '', dept: '', floor: '', zone: '', status: '', page: 0 }, patch);
    if (built) U.$('#rgQ').value = st.q;
  };
  R.show = () => { if (!built) build(); U.$('#rgQ').value = st.q; renderFilters(); renderTable(); };
  R.refresh = () => { if (built) { renderFilters(); renderTable(); } };
})(window.FAM);
