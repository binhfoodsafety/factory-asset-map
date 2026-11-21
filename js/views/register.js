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
    { k: 'name', h: 'Tên tài sản', fmt: (v) => U.esc(v.name) },
    { k: 'categoryName', h: 'Nhóm', fmt: (v) => `<span class="chip">${U.shapeSvg(v.categoryShape, '#64748b', 10)} ${U.esc(v.categoryName)}</span>` },
    { k: 'deptName', h: 'Bộ phận', fmt: (v) => U.esc(v.deptName) },
    { k: 'floorCode', h: 'Tầng', fmt: (v) => U.esc(v.floorCode) },
    { k: 'zoneName', h: 'Khu vực', fmt: (v) => U.esc(v.zoneName) },
    { k: 'x', h: 'X', num: true, fmt: (v) => v.x },
    { k: 'y', h: 'Y', num: true, fmt: (v) => v.y },
    { k: 'locationCode', h: 'Location Code', fmt: (v) => `<span class="loc-code">${U.esc(v.locationCode)}</span>` },
    { k: 'manufacturer', h: 'Nhà sản xuất', fmt: (v) => U.esc(v.manufacturer) },
    { k: 'model', h: 'Model', fmt: (v) => U.esc(v.model) },
    { k: 'serial', h: 'Serial Number', fmt: (v) => `<span class="mono">${U.esc(v.serial)}</span>` },
    { k: 'statusName', h: 'Trạng thái', fmt: (v) => UI.statusBadge(v.status) },
    { k: 'lastInspection', h: 'Kiểm định', fmt: (v) => `<span class="nowrap">${U.fmtDate(v.lastInspection)}</span>` },
    { k: 'photo', h: 'Ảnh', fmt: (v) => (v.photo ? `<span class="photo-thumb" style="width:34px;height:26px;background-image:url('${U.esc(v.photo)}')"></span>` : '<span class="muted">—</span>') },
    { k: 'remarks', h: 'Ghi chú', fmt: (v) => `<span class="muted small" title="${U.esc(v.remarks)}">${U.esc((v.remarks || '').slice(0, 40))}${(v.remarks || '').length > 40 ? '…' : ''}</span>` },
  ];

  function build() {
    root = U.$('#view-register');
    root.innerHTML = `
      <div class="view-head">
        <h2>Sổ tài sản (Asset Register)</h2>
        <div class="btn-row">
          <button class="btn" id="rgImport">${U.icon('upload', 16)}Nhập CSV / Excel</button>
          <button class="btn" id="rgExportCsv">${U.icon('download', 16)}Xuất CSV</button>
          <button class="btn" id="rgExportXlsx">${U.icon('download', 16)}Xuất Excel</button>
          <button class="btn btn-primary" id="rgAdd">${U.icon('plus', 16)}Thêm tài sản</button>
        </div>
        <div class="sub">Dữ liệu gốc của tài sản. Asset ID cố định; Location Code được tính lại mỗi khi tài sản di chuyển.</div>
      </div>
      <div class="card">
        <div class="toolbar">
          <div class="search">${U.icon('search', 16)}<input type="search" id="rgQ" placeholder="Tìm ID, tên, serial, model, location code…"></div>
          <select id="rgCat"></select><select id="rgDept"></select><select id="rgFloor"></select><select id="rgZone"></select><select id="rgStatus"></select>
          <button class="btn btn-sm btn-ghost" id="rgClear">Xoá lọc</button>
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
    U.$('#rgCat').innerHTML = UI.options(S.categories(), st.cat, { empty: 'Tất cả nhóm' });
    U.$('#rgDept').innerHTML = UI.options(S.departments(), st.dept, { empty: 'Tất cả bộ phận' });
    U.$('#rgFloor').innerHTML = UI.options(S.floors(), st.floor, { empty: 'Tất cả tầng', label: (f) => f.code + ' – ' + f.name });
    U.$('#rgZone').innerHTML = UI.options(S.zones(st.floor || undefined), st.zone, { empty: 'Tất cả khu vực', label: (z) => `${S.floor(z.floorId)?.code}/${z.code} – ${z.name}` });
    U.$('#rgStatus').innerHTML = UI.options(S.statuses(), st.status, { empty: 'Tất cả trạng thái' });
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
    U.$('#rgCount').textContent = `${list.length}/${S.assets().length} tài sản`;
    U.$('#rgTableWrap').innerHTML = rows.length
      ? `<table class="tbl tbl-nowrap"><thead><tr>
          ${COLS.map((c) => `<th class="sortable ${c.cls || ''} ${c.num ? 'num' : ''} ${st.sort === c.k ? 'sorted' : ''}" data-sort="${c.k}">${c.h}<span class="sort">${st.sort === c.k ? (st.dir > 0 ? '▲' : '▼') : '▲'}</span></th>`).join('')}
          <th class="actions">Thao tác</th></tr></thead>
        <tbody>${rows.map((v) => `<tr data-id="${U.esc(v.id)}">
          ${COLS.map((c) => `<td class="${c.cls || ''} ${c.num ? 'num' : ''}">${c.fmt(v)}</td>`).join('')}
          <td class="actions">
            <button class="btn btn-sm" data-act="locate" title="Xem trên sơ đồ">${U.icon('locate', 14)}Định vị</button>
            <button class="icon-btn" data-act="move" title="Di chuyển (cập nhật vị trí)">${U.icon('move', 16)}</button>
            <button class="icon-btn" data-act="edit" title="Sửa">${U.icon('edit', 16)}</button>
            <button class="icon-btn" data-act="qr" title="Mã QR">${U.icon('qr', 16)}</button>
            <button class="icon-btn" data-act="delete" title="Xoá" style="color:var(--red)">${U.icon('trash', 16)}</button>
          </td></tr>`).join('')}</tbody></table>`
      : UI.empty(S.assets().length ? 'Không có tài sản phù hợp với tìm kiếm / bộ lọc.' : 'Chưa có tài sản. Hãy thêm tài sản hoặc nhập file CSV / Excel.');
    U.$$('th[data-sort]', root).forEach((th) => th.addEventListener('click', () => {
      st.dir = st.sort === th.dataset.sort ? -st.dir : 1;
      st.sort = th.dataset.sort;
      renderTable();
    }));
    U.$('#rgPager').innerHTML = pages > 1
      ? `<span>Trang ${st.page + 1} / ${pages}</span><span class="sp"></span><button class="btn btn-sm" data-pg="-1" ${st.page === 0 ? 'disabled' : ''}>Trước</button><button class="btn btn-sm" data-pg="1" ${st.page >= pages - 1 ? 'disabled' : ''}>Sau</button>`
      : `<span>Bấm tiêu đề cột để sắp xếp · ${list.length} dòng</span>`;
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
      const ok = await UI.confirm(`Xoá <b>${U.esc(v.id)}</b> – ${U.esc(v.name)} khỏi sổ tài sản?<br><br><span class="small muted">Lịch sử vị trí vẫn được giữ (thêm một dòng "REMOVE"). Asset ID sẽ không được dùng lại.</span>`, { title: 'Xoá tài sản', okLabel: 'Xoá tài sản', danger: true });
      if (ok) { S.deleteAsset(id, { by: S.currentUser() }); UI.toast(`Đã xoá ${id}.`, 'success'); }
    }
  }

  /* ---------------- import dialog ---------------- */
  R.openImport = () => {
    let analysis = null, fileName = '';
    const box = U.h(`<div>
      <div class="callout">${U.icon('info', 16)}<div>
        Chấp nhận: <b>.csv</b> (dấu phẩy hoặc chấm phẩy) hoặc <b>.xlsx / .xls</b> (sheet đầu tiên, hoặc sheet tên "Assets").
        Cột bắt buộc: Asset ID, Tên tài sản, Nhóm, Bộ phận, Tầng, Khu vực, X, Y, Trạng thái (tiêu đề tiếng Việt hoặc tiếng Anh đều được).
        Nhóm / Bộ phận / Tầng / Khu vực / Trạng thái có thể ghi theo mã hoặc tên. Location Code được tính tự động.
        <div class="btn-row" style="margin-top:8px"><button class="btn btn-sm" id="imTplCsv">${U.icon('download', 14)}Mẫu CSV</button><button class="btn btn-sm" id="imTplXlsx">${U.icon('download', 14)}Mẫu Excel</button></div>
      </div></div>
      <div class="form-grid" style="margin-top:14px">
        <div class="field full"><label>Tệp</label><input type="file" id="imFile" accept=".csv,.txt,.xlsx,.xls,.ods"></div>
        <div class="field full"><span class="lbl">Chế độ</span>
          <label class="check"><input type="radio" name="mode" value="add" checked> Chỉ thêm tài sản mới (ID đã tồn tại sẽ báo lỗi)</label>
          <label class="check"><input type="radio" name="mode" value="upsert"> Thêm mới và cập nhật tài sản đã có (thay đổi vị trí được ghi lịch sử)</label></div>
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
            <span class="chip" style="background:#dcfce7;color:#166534">${a.creates.length} mới</span>
            <span class="chip" style="background:#e0ecff;color:#1d4ed8">${a.updates.length} cập nhật</span>
            <span class="chip" style="background:#fee2e2;color:#991b1b">${a.errors.length} dòng lỗi – sẽ bỏ qua</span>
          </div>
          ${a.errors.length ? `<div class="err-list">${a.errors.map((e) => `<div><b>Dòng ${e.line}</b>${e.id ? ` · <span class="mono">${U.esc(e.id)}</span>` : ''}: ${e.errs.map(U.esc).join('; ')}</div>`).join('')}</div>` : ''}
          ${a.creates.length + a.updates.length ? `<p class="small muted" style="margin-top:8px">Các dòng hợp lệ sẽ được nhập khi bấm <b>Nhập dữ liệu</b>.</p>` : '<p class="small muted" style="margin-top:8px">Không có dữ liệu để nhập.</p>'}`;
      } catch (e) {
        out.innerHTML = `<div class="callout err">${U.icon('alert', 16)}<div>${U.esc(e.message)}</div></div>`;
      }
    };
    U.$('#imFile', box).addEventListener('change', run);
    U.$$('input[name=mode]', box).forEach((r) => r.addEventListener('change', run));
    U.$('#imTplCsv', box).addEventListener('click', () => IO.downloadTemplate('csv'));
    U.$('#imTplXlsx', box).addEventListener('click', () => IO.downloadTemplate('xlsx'));
    UI.modal({
      title: 'Nhập tài sản từ CSV / Excel', size: 'modal-lg', body: box,
      actions: [
        { label: 'Hủy' },
        { label: 'Nhập dữ liệu', primary: true, icon: 'upload', onClick: () => {
          if (!analysis || !(analysis.creates.length + analysis.updates.length)) { UI.toast('Hãy chọn tệp có ít nhất một dòng hợp lệ.', 'error'); return false; }
          try {
            const r = IO.apply(analysis, { by: S.currentUser(), reason: 'Nhập hàng loạt: ' + fileName });
            UI.toast(`Đã nhập: ${r.created} mới, ${r.updated} cập nhật (${r.moved} đổi vị trí). Bỏ qua ${analysis.errors.length} dòng.`, 'success', 5000);
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
