/* Factory Asset Map — TAB 05 Location history (append-only audit trail). */
window.FAM = window.FAM || {};
(function (F) {
  'use strict';
  const U = F.util, S = F.store, UI = F.ui;
  F.views = F.views || {};
  const H = (F.views.history = {});
  const st = { q: '', action: 'MOVE', floor: '', from: '', to: '', page: 0, size: 100 };
  let built = false;

  function filtered() {
    const q = st.q.trim().toLowerCase();
    return S.history().filter((h) =>
      (!st.action || h.action === st.action) &&
      (!st.floor || (h.prev && h.prev.floorId === st.floor) || (h.next && h.next.floorId === st.floor)) &&
      (!st.from || h.at.slice(0, 10) >= st.from) && (!st.to || h.at.slice(0, 10) <= st.to) &&
      (!q || [h.assetId, h.assetName, h.updatedBy, h.reason, h.prev?.code, h.next?.code].some((s) => String(s || '').toLowerCase().includes(q)))
    ).slice().sort((a, b) => b.at.localeCompare(a.at));
  }
  const locCell = (l) => l ? `<div class="nowrap">${U.esc(l.floorCode)} · ${U.esc(l.zoneName || l.zoneCode)}</div><div class="small muted nowrap">X ${l.x} · Y ${l.y}</div><span class="loc-code">${U.esc(l.code)}</span>` : '<span class="muted">—</span>';

  function build() {
    const root = U.$('#view-history');
    root.innerHTML = `
      <div class="view-head"><h2>Lịch sử vị trí</h2>
        <div class="btn-row"><button class="btn" id="hsCsv">${U.icon('download', 16)}Xuất CSV</button><button class="btn" id="hsXlsx">${U.icon('download', 16)}Xuất Excel</button></div>
        <div class="sub">Chỉ ghi thêm. Mỗi lần thay đổi vị trí tạo một dòng mới; các dòng cũ không bao giờ bị sửa hoặc ghi đè.</div></div>
      <div class="card">
        <div class="toolbar">
          <div class="search">${U.icon('search', 16)}<input type="search" id="hsQ" placeholder="Asset ID, tên, người cập nhật, lý do, location code…"></div>
          <select id="hsAction"><option value="MOVE">Chỉ di chuyển</option><option value="">Tất cả</option><option value="REGISTER">Đăng ký mới</option><option value="REMOVE">Xoá tài sản</option></select>
          <select id="hsFloor"></select>
          <label class="small muted">Từ <input type="date" id="hsFrom"></label>
          <label class="small muted">Đến <input type="date" id="hsTo"></label>
          <button class="btn btn-sm btn-ghost" id="hsClear">Xoá lọc</button>
          <span class="count" id="hsCount"></span>
        </div>
        <div class="table-wrap" id="hsTable"></div>
        <div class="pager" id="hsPager"></div>
      </div>`;
    U.$('#hsQ').addEventListener('input', U.debounce((e) => { st.q = e.target.value; st.page = 0; renderTable(); }, 150));
    [['hsAction', 'action'], ['hsFloor', 'floor'], ['hsFrom', 'from'], ['hsTo', 'to']].forEach(([id, k]) => U.$('#' + id).addEventListener('change', (e) => { st[k] = e.target.value; st.page = 0; renderTable(); }));
    U.$('#hsClear').addEventListener('click', () => { Object.assign(st, { q: '', action: 'MOVE', floor: '', from: '', to: '', page: 0 }); syncInputs(); renderTable(); });
    U.$('#hsCsv').addEventListener('click', () => F.io.downloadCSV(F.io.historyRows(filtered()), `location-history-${U.stamp()}.csv`));
    U.$('#hsXlsx').addEventListener('click', () => F.io.downloadXLSX([{ name: 'Location History', rows: F.io.historyRows(filtered()) }], `location-history-${U.stamp()}.xlsx`));
    built = true;
  }
  function syncInputs() {
    U.$('#hsQ').value = st.q; U.$('#hsAction').value = st.action; U.$('#hsFrom').value = st.from; U.$('#hsTo').value = st.to;
    U.$('#hsFloor').innerHTML = UI.options(S.floors(), st.floor, { empty: 'Tất cả tầng', label: (f) => f.code + ' – ' + f.name });
  }
  function renderTable() {
    const list = filtered();
    const pages = Math.max(1, Math.ceil(list.length / st.size));
    st.page = Math.min(st.page, pages - 1);
    const rows = list.slice(st.page * st.size, (st.page + 1) * st.size);
    U.$('#hsCount').textContent = `${list.length} dòng`;
    U.$('#hsTable').innerHTML = rows.length ? `<table class="tbl"><thead><tr><th>Thời gian</th><th>Hành động</th><th>Asset ID</th><th>Tên tài sản</th><th>Vị trí cũ</th><th>Vị trí mới</th><th>Người cập nhật</th><th>Lý do thay đổi</th></tr></thead><tbody>
      ${rows.map((h) => `<tr><td class="nowrap small">${U.fmtDateTime(h.at)}</td><td><span class="tag-action tag-${h.action}">${h.action}</span></td>
        <td>${S.asset(h.assetId) ? `<a href="#/map?asset=${encodeURIComponent(h.assetId)}" class="asset-id" title="Xem trên sơ đồ">${U.esc(h.assetId)}</a>` : `<span class="asset-id">${U.esc(h.assetId)}</span>`}</td>
        <td>${U.esc(h.assetName)}</td><td>${locCell(h.prev)}</td><td>${locCell(h.next)}</td><td class="small">${U.esc(h.updatedBy)}</td><td class="small">${U.esc(h.reason)}</td></tr>`).join('')}
      </tbody></table>` : UI.empty('Không có dòng lịch sử phù hợp.', 'history');
    U.$('#hsPager').innerHTML = pages > 1 ? `<span>Trang ${st.page + 1} / ${pages}</span><span class="sp"></span><button class="btn btn-sm" data-pg="-1" ${st.page === 0 ? 'disabled' : ''}>Trước</button><button class="btn btn-sm" data-pg="1" ${st.page >= pages - 1 ? 'disabled' : ''}>Sau</button>` : '<span>Mới nhất ở trên</span>';
    U.$$('#hsPager [data-pg]').forEach((b) => b.addEventListener('click', () => { st.page += Number(b.dataset.pg); renderTable(); }));
  }
  H.show = (params = {}) => {
    if (!built) build();
    if (params.asset) Object.assign(st, { q: params.asset, action: '', page: 0 });
    syncInputs();
    renderTable();
  };
  H.refresh = () => { if (built) { syncInputs(); renderTable(); } };
})(window.FAM);
