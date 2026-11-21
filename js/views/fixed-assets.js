/* Factory Asset Map — TAB Kế toán TSCĐ: danh sách, khai báo, nghiệp vụ, khấu hao & phân bổ, sổ TSCĐ, khoá sổ. */
window.FAM = window.FAM || {};
(function (F) {
  'use strict';
  const U = F.util, S = F.store, UI = F.ui, FIN = F.fin, P = F.print;
  F.views = F.views || {};
  const FA = (F.views.fa = {});
  const thisYear = String(new Date().getFullYear());
  const st = { tab: 'list', ym: FIN.nowYm(), q: '', type: '', dept: '', status: '', from: thisYear + '-01', to: FIN.nowYm(), txType: '', txQ: '', year: thisYear, bookType: 'TSCD' };
  const TABS = [['list', 'Danh sách TSCĐ & CCDC'], ['tx', 'Nghiệp vụ tăng / giảm'], ['dep', 'Khấu hao & phân bổ'], ['book', 'Sổ TSCĐ / CCDC'], ['lock', 'Khoá sổ & tài khoản']];
  const m = FIN.fmt;
  const deptName = (id) => (S.dept(id) || { name: id || '—' }).name;
  const accOpt = (kind, sel, empty) => UI.options(FIN.accounts(kind), sel, { value: 'code', label: (a) => `${a.code} – ${a.name}`, empty });
  const stBadge = (s) => { const [n, c] = FIN.STATUS[s] || FIN.STATUS.NONE; return `<span class="badge" style="--c:${c}"><i></i>${n}</span>`; };

  /* ---------------- shell ---------------- */
  FA.show = (params = {}) => {
    if (params.tab) st.tab = params.tab;
    const root = U.$('#view-fa');
    const lock = FIN.lockedUntil();
    root.innerHTML = `
      <div class="view-head"><h2>Kế toán TSCĐ</h2>
        <span class="chip">${U.esc(FIN.settings().regime || '')}</span>
        ${lock ? `<span class="lock-chip">🔒 Đã khoá sổ đến ${FIN.ymLabel(lock)}</span>` : '<span class="chip">Chưa khoá sổ</span>'}
        <div class="sub">Nguyên giá, khấu hao / phân bổ, nghiệp vụ tăng giảm và chứng từ. Số tiền tính bằng VND. ${S.isDemo() ? '<b>Số liệu hiện tại là dữ liệu demo giả định.</b>' : ''}</div></div>
      <div class="tabs-row">${TABS.map(([k, t]) => `<button data-tab="${k}" class="${st.tab === k ? 'on' : ''}">${t}</button>`).join('')}</div>
      <div id="faBody"></div>`;
    U.$$('[data-tab]', root).forEach((b) => b.addEventListener('click', () => { st.tab = b.dataset.tab; FA.show(); }));
    ({ list: renderList, tx: renderTx, dep: renderDep, book: renderBook, lock: renderLock }[st.tab] || renderList)(U.$('#faBody'));
  };
  FA.refresh = () => { if (!U.$('#view-fa').hidden) FA.show(); };

  /* ---------------- 1. danh sách ---------------- */
  function listRows() {
    const q = st.q.trim().toLowerCase();
    return S.assets().map((a) => ({ a, s: FIN.stateAt(a, st.ym) })).filter(({ a, s }) =>
      (!st.type || (a.fin && a.fin.assetType === st.type) || (st.type === 'NONE' && !FIN.has(a))) &&
      (!st.dept || (s.dept || a.departmentId) === st.dept) &&
      (!st.status || s.status === st.status) &&
      (!q || [a.id, a.name, a.fin && a.fin.accCode, a.serial].some((x) => String(x || '').toLowerCase().includes(q))))
      .sort((x, y) => String((x.a.fin && x.a.fin.accCode) || 'zz' + x.a.id).localeCompare(String((y.a.fin && y.a.fin.accCode) || 'zz' + y.a.id)));
  }
  function renderList(el) {
    el.innerHTML = `<div class="card">
      <div class="toolbar">
        <div class="search">${U.icon('search', 16)}<input type="search" id="faQ" placeholder="Mã TS, Asset ID, tên, serial…" value="${U.esc(st.q)}"></div>
        <select id="faType"><option value="">Tất cả loại</option>${FIN.TYPES.map((t) => `<option value="${t.id}" ${st.type === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}<option value="NONE" ${st.type === 'NONE' ? 'selected' : ''}>Chưa khai báo kế toán</option></select>
        <select id="faDept">${UI.options(S.departments(), st.dept, { empty: 'Tất cả bộ phận' })}</select>
        <select id="faStatus"><option value="">Tất cả tình trạng</option>${Object.entries(FIN.STATUS).map(([k, [n]]) => `<option value="${k}" ${st.status === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
        <label class="small muted">Kỳ <input type="month" id="faYm" value="${st.ym}"></label>
        <span class="count" id="faCount"></span>
      </div>
      <div class="toolbar" style="border-top:1px solid var(--line)">
        <button class="btn btn-primary btn-sm" id="faDeclare">${U.icon('plus', 15)}Khai báo TSCĐ / CCDC</button>
        <button class="btn btn-sm" id="faImport">${U.icon('upload', 15)}Nhập từ Excel</button>
        <button class="btn btn-sm" id="faMisa">${U.icon('download', 15)}Xuất Excel cho MISA</button>
      </div>
      <div class="table-wrap" id="faTable" style="max-height:calc(100vh - 330px)"></div></div>`;
    const rerender = () => renderListTable();
    U.$('#faQ').addEventListener('input', U.debounce((e) => { st.q = e.target.value; rerender(); }, 150));
    [['faType', 'type'], ['faDept', 'dept'], ['faStatus', 'status'], ['faYm', 'ym']].forEach(([id, k]) => U.$('#' + id).addEventListener('change', (e) => { st[k] = e.target.value || FIN.nowYm(); rerender(); }));
    U.$('#faDeclare').addEventListener('click', () => pickAsset((a) => !FIN.has(a), 'Chọn tài sản cần khai báo kế toán', (id) => FA.finForm(id)));
    U.$('#faImport').addEventListener('click', () => F.views.register.openImport());
    U.$('#faMisa').addEventListener('click', () => FA.exportMisa(st.ym));
    U.$('#faTable').addEventListener('click', onListClick);
    renderListTable();
  }
  function renderListTable() {
    const rows = listRows();
    const tot = rows.reduce((t, { s }) => ({ cost: t.cost + (s.cost || 0), dep: t.dep + (s.dep || 0), accum: t.accum + (s.accum || 0), nbv: t.nbv + (s.nbv || 0) }), { cost: 0, dep: 0, accum: 0, nbv: 0 });
    U.$('#faCount').textContent = `${rows.length} tài sản`;
    U.$('#faTable').innerHTML = rows.length ? `<table class="tbl tbl-nowrap"><thead><tr>
        <th>Mã TS (KT)</th><th>Asset ID</th><th>Tên tài sản</th><th>Loại</th><th>Bộ phận sử dụng</th><th>Ngày ghi tăng</th>
        <th class="money">Nguyên giá</th><th class="money">KH kỳ ${FIN.ymLabel(st.ym)}</th><th class="money">HM luỹ kế</th><th class="money">Giá trị còn lại</th><th class="num">Còn lại (th)</th><th>Tình trạng</th><th class="actions"></th></tr></thead>
      <tbody>${rows.map(({ a, s }) => `<tr data-id="${U.esc(a.id)}">
        <td class="mono">${U.esc((a.fin && a.fin.accCode) || '—')}</td><td><span class="asset-id">${U.esc(a.id)}</span></td><td>${U.esc(a.name)}</td>
        <td>${a.fin ? `<span class="chip">${FIN.typeShort(a.fin.assetType)}</span>` : ''}</td><td>${U.esc(deptName(s.dept || a.departmentId))}</td>
        <td>${a.fin ? U.fmtDate(a.fin.increaseDate) : ''}</td>
        <td class="money">${FIN.has(a) ? m(s.cost) : ''}</td><td class="money">${FIN.has(a) ? m(s.dep) : ''}</td><td class="money">${FIN.has(a) ? m(s.accum) : ''}</td><td class="money">${FIN.has(a) ? m(s.nbv) : ''}</td>
        <td class="num">${s.status === 'ACTIVE' ? Math.ceil(s.remaining || 0) : ''}</td><td>${stBadge(s.status)}</td>
        <td class="actions">${FIN.has(a)
          ? `<button class="btn btn-sm" data-act="card" title="In thẻ TSCĐ">${U.icon('printer', 14)}Thẻ</button><button class="icon-btn" data-act="tx" title="Thêm nghiệp vụ">${U.icon('plus', 16)}</button><button class="icon-btn" data-act="fin" title="Sửa thông tin kế toán">${U.icon('edit', 16)}</button>`
          : `<button class="btn btn-sm btn-primary" data-act="fin">Khai báo</button>`}<button class="icon-btn" data-act="map" title="Xem trên sơ đồ">${U.icon('locate', 16)}</button></td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="6">Cộng (${rows.filter((r) => FIN.has(r.a)).length} tài sản có khai báo)</td><td class="money">${m(tot.cost)}</td><td class="money">${m(tot.dep)}</td><td class="money">${m(tot.accum)}</td><td class="money">${m(tot.nbv)}</td><td colspan="3"></td></tr></tfoot></table>`
      : UI.empty('Không có tài sản phù hợp.');
  }
  function onListClick(e) {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.closest('tr').dataset.id;
    ({ card: () => FA.printCard(id), tx: () => FA.txMenu(id), fin: () => FA.finForm(id), map: () => F.views.map.locate(id) })[b.dataset.act]();
  }

  function pickAsset(filter, title, cb) {
    const list = S.assets().filter(filter);
    if (!list.length) return UI.toast('Không có tài sản phù hợp.', 'info');
    const form = U.h(`<form><div class="field"><label>Tài sản</label><input name="a" list="faPickList" placeholder="Gõ Asset ID hoặc tên"><datalist id="faPickList">${list.map((a) => `<option value="${U.esc(a.id)}">${U.esc(a.name)}</option>`).join('')}</datalist></div></form>`);
    UI.modal({ title, size: 'modal-sm', body: form, actions: [{ label: 'Hủy' }, { label: 'Tiếp tục', primary: true, onClick: () => {
      const v = U.$('[name=a]', form).value.trim();
      const a = list.find((x) => x.id.toLowerCase() === v.toLowerCase()) || list.find((x) => x.name.toLowerCase() === v.toLowerCase());
      if (!a) { UI.toast('Chọn một tài sản trong danh sách.', 'error'); return false; }
      setTimeout(() => cb(a.id), 0);
    } }] });
  }

  /* ---------------- form khai báo kế toán ---------------- */
  FA.finForm = (assetId) => {
    const a = S.asset(assetId);
    if (!a) return;
    const isNew = !FIN.has(a);
    const cat = S.category(a.categoryId);
    const f = a.fin || {
      assetType: 'TSHH', accCode: '', cost: '', increaseDate: new Date().toISOString().slice(0, 10), depStartDate: '', usefulLifeMonths: 60, remainingMonths: '', openingAccum: 0, method: 'SL',
      assetAccount: cat && cat.code === 'FUR' ? '2114' : '2112', depAccount: '2141', expenseAccount: a.departmentId === 'AD' ? '6424' : '6274', fundSource: 'Vốn chủ sở hữu',
    };
    const locked = !isNew && FIN.isLocked(f.depStartDate || f.increaseDate);
    const form = U.h(`<form class="form-grid" autocomplete="off" novalidate>
      <div class="full callout ${locked ? 'warn' : ''}">${U.icon(locked ? 'alert' : 'info', 16)}<div><b>${U.esc(a.id)}</b> – ${U.esc(a.name)} · Bộ phận sử dụng: ${U.esc(deptName(a.departmentId))}${locked ? `<br>Tài sản thuộc kỳ đã khoá sổ (đến ${FIN.ymLabel(FIN.lockedUntil())}): chỉ sửa được thông tin mô tả. Thay đổi giá trị dùng nghiệp vụ Nâng cấp / Đánh giá lại.` : ''}</div></div>
      <div class="form-section">Phân loại</div>
      <div class="field"><label>Loại tài sản <span class="req">*</span></label><select name="assetType">${FIN.TYPES.map((t) => `<option value="${t.id}" ${f.assetType === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}</select></div>
      <div class="field"><label>Mã tài sản trên phần mềm kế toán</label><input name="accCode" value="${U.esc(f.accCode || '')}" placeholder="VD: TS-SX-001 (mã trên MISA)"></div>
      <div class="form-section">Nguyên giá &amp; khấu hao</div>
      <div class="field"><label>Nguyên giá (VND) <span class="req">*</span></label><input name="cost" type="number" min="0" step="1" value="${U.esc(f.cost)}"></div>
      <div class="field"><label>Ngày ghi tăng <span class="req">*</span></label><input name="increaseDate" type="date" value="${U.esc(f.increaseDate)}"></div>
      <div class="field fin-dep"><label>Phương pháp khấu hao</label><select name="method">${FIN.METHODS.map((x) => `<option value="${x.id}" ${f.method === x.id ? 'selected' : ''}>${x.name}</option>`).join('')}</select></div>
      <div class="field"><label><span class="lbl-life">Thời gian sử dụng</span> (tháng) <span class="req">*</span></label><input name="usefulLifeMonths" type="number" min="1" step="1" value="${U.esc(f.usefulLifeMonths)}"></div>
      <div class="field"><label>Ngày bắt đầu tính KH / phân bổ</label><input name="depStartDate" type="date" value="${U.esc(f.depStartDate || '')}"><div class="hint">Để trống = ngày ghi tăng. Với tài sản đã dùng trước khi đưa vào hệ thống: nhập ngày bắt đầu tính trong hệ thống.</div></div>
      <div class="field"><label>Hao mòn / đã phân bổ luỹ kế tại ngày bắt đầu (VND)</label><input name="openingAccum" type="number" min="0" step="1" value="${U.esc(f.openingAccum || 0)}"></div>
      <div class="field"><label>Thời gian còn lại tại ngày bắt đầu (tháng)</label><input name="remainingMonths" type="number" min="1" step="1" value="${U.esc(f.remainingMonths === f.usefulLifeMonths ? '' : f.remainingMonths || '')}" placeholder="= thời gian sử dụng"></div>
      <div class="form-section">Tài khoản</div>
      <div class="field fin-asset"><label>TK nguyên giá <span class="req">*</span></label><select name="assetAccount">${accOpt('asset', f.assetAccount, '— chọn —')}</select></div>
      <div class="field"><label><span class="lbl-depacc">TK khấu hao</span> <span class="req">*</span></label><select name="depAccount">${accOpt('dep', f.depAccount, '— chọn —')}</select></div>
      <div class="field"><label>TK chi phí <span class="req">*</span></label><select name="expenseAccount">${accOpt('exp', f.expenseAccount, '— chọn —')}</select></div>
      <div class="field"><label>Nguồn vốn</label><input name="fundSource" list="faFunds" value="${U.esc(f.fundSource || '')}"><datalist id="faFunds">${(FIN.settings().fundSources || []).map((x) => `<option>${U.esc(x)}</option>`).join('')}</datalist></div>
      <div class="form-section">Chứng từ gốc</div>
      <div class="field"><label>Nhà cung cấp</label><input name="supplier" value="${U.esc(f.supplier || '')}"></div>
      <div class="field"><label>Số hoá đơn</label><input name="invoiceNo" value="${U.esc(f.invoiceNo || '')}"></div>
      <div class="field"><label>Ngày hoá đơn</label><input name="invoiceDate" type="date" value="${U.esc(f.invoiceDate || '')}"></div>
      <div class="full"><div class="small muted" style="margin-bottom:4px">Dự kiến</div><div class="preview-box" id="faPrev"></div><div id="faWarn" class="small" style="color:var(--amber);margin-top:6px"></div></div>
    </form>`);
    const $ = (n) => U.$(`[name="${n}"]`, form);
    const sync = () => {
      const t = $('assetType').value, ccdc = t === 'CCDC';
      U.$$('.fin-dep, .fin-asset', form).forEach((x) => (x.style.display = ccdc ? 'none' : ''));
      U.$('.lbl-life', form).textContent = ccdc ? 'Số kỳ phân bổ' : 'Thời gian sử dụng';
      U.$('.lbl-depacc', form).textContent = ccdc ? 'TK chờ phân bổ' : 'TK khấu hao';
      const d = UI.formData(form);
      const tmp = { ...a, fin: FIN.cleanFin({ ...d, remainingMonths: d.remainingMonths || d.usefulLifeMonths }) };
      const now = FIN.nowYm();
      const v = FIN.validateFin(tmp.fin, null);
      const sc = FIN.has(tmp) && FIN.isDate(tmp.fin.increaseDate) ? FIN.schedule(tmp, FIN.ymAdd(now, 600)) : { rows: [] };
      const full = sc.rows.find((r) => r.ym > FIN.ymOf(tmp.fin.depStartDate) && r.dep > 0) || sc.rows[0];
      const end = sc.rows.filter((r) => r.dep > 0).slice(-1)[0];
      const s = FIN.has(tmp) ? FIN.stateAt(tmp, now) : null;
      U.$('#faPrev', form).innerHTML = `<div>Mức ${ccdc ? 'phân bổ' : 'khấu hao'} tháng: <b>${full ? m(full.dep) : '—'}</b></div>
        <div>Kết thúc ${ccdc ? 'phân bổ' : 'khấu hao'}: <b>${end ? FIN.ymLabel(end.ym) : '—'}</b></div>
        <div>HM luỹ kế đến ${FIN.ymLabel(now)}: <b>${s ? m(s.accum) : '—'}</b></div><div>Giá trị còn lại: <b>${s ? m(s.nbv) : '—'}</b></div>`;
      U.$('#faWarn', form).innerHTML = v.warnings.map((w) => `${U.icon('alert', 13)} ${U.esc(w)}`).join('<br>');
    };
    $('assetType').addEventListener('change', () => {
      const t = $('assetType').value;
      $('depAccount').value = FIN.DEFAULT_DEP_ACC[t];
      if (t === 'CCDC') { $('expenseAccount').value = a.departmentId === 'AD' ? '6423' : '6273'; if (Number($('usefulLifeMonths').value) > 36) $('usefulLifeMonths').value = 24; }
      else if (['6273', '6423'].includes($('expenseAccount').value)) $('expenseAccount').value = a.departmentId === 'AD' ? '6424' : '6274';
      sync();
    });
    U.$$('input, select', form).forEach((x) => x.addEventListener('input', U.debounce(sync, 120)));
    if (locked) ['assetType', 'cost', 'increaseDate', 'depStartDate', 'usefulLifeMonths', 'remainingMonths', 'openingAccum', 'method', 'depAccount', 'expenseAccount', 'assetAccount'].forEach((n) => { $(n).disabled = true; });
    sync();
    UI.modal({
      title: isNew ? 'Khai báo thông tin kế toán' : 'Thông tin kế toán ' + a.id, size: 'modal-lg', body: form,
      actions: [{ label: 'Hủy' }, { label: 'Lưu', primary: true, icon: 'check', onClick: () => {
        const d = UI.formData(form);
        const fin = locked ? { ...a.fin, accCode: d.accCode, fundSource: d.fundSource, supplier: d.supplier, invoiceNo: d.invoiceNo, invoiceDate: d.invoiceDate } : { ...d, remainingMonths: d.remainingMonths || d.usefulLifeMonths };
        try { FIN.saveFin(a.id, fin); UI.toast(isNew ? `Đã khai báo ${a.id} và tạo chứng từ ghi tăng.` : `Đã lưu thông tin kế toán ${a.id}.`, 'success'); }
        catch (e) { if (e.errors) { UI.showErrors(form, e.errors); if (e.errors._lock) UI.toast(e.errors._lock, 'error', 6000); } else UI.toast(e.message, 'error'); return false; }
      } }],
    });
  };

  /* ---------------- nghiệp vụ ---------------- */
  FA.txMenu = (assetId) => {
    const a = S.asset(assetId);
    if (S.isDisposed(a)) return UI.toast('Tài sản đã ghi giảm.', 'info');
    const box = U.h(`<div class="grid" style="gap:8px">${['UPGRADE', 'REVALUE', 'TRANSFER', 'DISPOSE'].map((t) => `<button class="btn" data-t="${t}" style="justify-content:flex-start">${FIN.TX[t].name}</button>`).join('')}</div>`);
    const md = UI.modal({ title: `Nghiệp vụ cho ${a.id}`, size: 'modal-sm', body: box });
    U.$$('[data-t]', box).forEach((b) => b.addEventListener('click', () => { md.close(); FA.txForm(b.dataset.t, assetId); }));
  };
  FA.txForm = (type, assetId) => {
    if (!assetId) return pickAsset((a) => FIN.has(a) && !S.isDisposed(a), `${FIN.TX[type].name}: chọn tài sản`, (id) => FA.txForm(type, id));
    const a = S.asset(assetId);
    const today = new Date().toISOString().slice(0, 10);
    const s = FIN.stateAt(a, FIN.ymAdd(FIN.nowYm(), -1));
    const extra = {
      UPGRADE: `<div class="field"><label>Giá trị nâng cấp (VND) <span class="req">*</span></label><input name="amount" type="number" min="0"></div>
        <div class="field"><label>Tăng thời gian sử dụng (tháng)</label><input name="extraMonths" type="number" min="0" value="0"></div>`,
      REVALUE: `<div class="field"><label>Chênh lệch nguyên giá (+/− VND)</label><input name="costDelta" type="number" value="0"></div>
        <div class="field"><label>Chênh lệch hao mòn luỹ kế (+/− VND)</label><input name="accumDelta" type="number" value="0"></div>
        <div class="field"><label>Thời gian còn lại mới (tháng)</label><input name="newRemaining" type="number" min="0" placeholder="Giữ nguyên"></div>`,
      TRANSFER: `<div class="field"><label>Bộ phận nhận <span class="req">*</span></label><select name="toDept">${UI.options(S.departments().filter((d) => d.id !== a.departmentId), '', { empty: '— chọn —', label: (d) => `${d.code} – ${d.name}` })}</select></div>
        <div class="field"><label>TK chi phí sau điều chuyển</label><select name="toExpense">${accOpt('exp', a.fin.expenseAccount)}</select></div>
        <div class="field"><label>Người nhận</label><input name="receiver"></div>`,
      DISPOSE: `<div class="field full"><label>Lý do ghi giảm <span class="req">*</span></label><input name="reason" placeholder="VD: Hư hỏng không sửa được, thanh lý"></div>
        <div class="field"><label>Thu thanh lý / nhượng bán (VND)</label><input name="proceeds" type="number" min="0" value="0"></div>
        <div class="field"><label>Chi phí thanh lý (VND)</label><input name="expenses" type="number" min="0" value="0"></div>
        <div class="field full"><label>Bên mua / bên nhận</label><input name="buyer"></div>
        <div class="full callout warn small">${U.icon('alert', 15)}<div>Sau khi ghi giảm, tài sản thôi trích khấu hao từ ngày chứng từ và không còn hiển thị trên sơ đồ. Hồ sơ và lịch sử vẫn được giữ.</div></div>`,
    }[type];
    const form = U.h(`<form class="form-grid" autocomplete="off">
      <div class="full callout">${U.icon('info', 16)}<div><b>${U.esc(a.id)}</b> – ${U.esc(a.name)}<br>Nguyên giá ${m(s.cost)} · HM luỹ kế ${m(s.accum)} · GTCL ${m(s.nbv)} (cuối ${FIN.ymLabel(FIN.ymAdd(FIN.nowYm(), -1))}) · Bộ phận: ${U.esc(deptName(a.departmentId))}</div></div>
      <div class="field"><label>Ngày chứng từ <span class="req">*</span></label><input name="date" type="date" value="${today}"></div>
      <div class="field"><label>Số chứng từ</label><input name="docNo" placeholder="Tự đánh số: ${FIN.nextDocNo(type, today)}"></div>
      ${extra}
      <div class="field full"><label>Diễn giải</label><input name="desc" placeholder="${U.esc(FIN.TX[type].name + ': ' + a.name)}"></div>
      <div class="field full"><label>Chứng từ gốc kèm theo</label><input name="refDoc" placeholder="VD: HĐ 0001234, Quyết định số …"></div>
    </form>`);
    UI.modal({
      title: FIN.TX[type].name, size: 'modal-lg', body: form,
      actions: [{ label: 'Hủy' }, { label: 'Ghi nghiệp vụ', primary: true, icon: 'check', onClick: async () => {
        const d = UI.formData(form);
        if (type === 'DISPOSE' && !(await UI.confirm(`Ghi giảm <b>${U.esc(a.id)}</b> từ ngày ${U.fmtDate(d.date)}?`, { danger: true, okLabel: 'Ghi giảm' }))) return false;
        try {
          const tx = FIN.addTx({ ...d, type, assetId });
          UI.toast(`Đã ghi ${FIN.TX[type].name.toLowerCase()} – chứng từ ${tx.docNo}.`, 'success');
          setTimeout(async () => { if (await UI.confirm(`In ${docTitle(tx).toLowerCase()} cho chứng từ ${U.esc(tx.docNo)}?`, { okLabel: 'In', title: 'In chứng từ' })) FA.printTx(tx.id); }, 50);
        } catch (e) { if (e.errors) UI.showErrors(form, e.errors); else UI.toast(e.message, 'error'); return false; }
      } }],
    });
  };

  function txAmount(t) {
    if (t.type === 'INCREASE' || t.type === 'UPGRADE') return t.amount;
    if (t.type === 'REVALUE') return t.costDelta;
    if (t.type === 'DISPOSE') return t.snapshot ? t.snapshot.nbv : '';
    return '';
  }
  function renderTx(el) {
    const q = st.txQ.trim().toLowerCase();
    const list = FIN.txAll().filter((t) => (!st.txType || t.type === st.txType) && FIN.ymOf(t.date) >= st.from && FIN.ymOf(t.date) <= st.to &&
      (!q || [t.docNo, t.assetId, t.assetName, t.desc].some((x) => String(x || '').toLowerCase().includes(q)))).sort((a, b) => b.date.localeCompare(a.date) || b.docNo.localeCompare(a.docNo));
    el.innerHTML = `<div class="card">
      <div class="toolbar">
        <div class="search">${U.icon('search', 16)}<input type="search" id="txQ" placeholder="Số CT, tài sản, diễn giải…" value="${U.esc(st.txQ)}"></div>
        <select id="txType"><option value="">Tất cả nghiệp vụ</option>${Object.entries(FIN.TX).map(([k, v]) => `<option value="${k}" ${st.txType === k ? 'selected' : ''}>${v.name}</option>`).join('')}</select>
        <label class="small muted">Từ kỳ <input type="month" id="txFrom" value="${st.from}"></label><label class="small muted">Đến kỳ <input type="month" id="txTo" value="${st.to}"></label>
        <span class="count">${list.length} chứng từ</span></div>
      <div class="toolbar" style="border-top:1px solid var(--line)">${['UPGRADE', 'REVALUE', 'TRANSFER', 'DISPOSE'].map((t) => `<button class="btn btn-sm" data-new="${t}">${U.icon('plus', 14)}${FIN.TX[t].name}</button>`).join('')}
        <button class="btn btn-sm" id="txXlsx">${U.icon('download', 14)}Xuất Excel</button></div>
      <div class="table-wrap" style="max-height:calc(100vh - 330px)">${list.length ? `<table class="tbl"><thead><tr><th>Ngày CT</th><th>Số CT</th><th>Nghiệp vụ</th><th>Asset ID</th><th>Tài sản</th><th>Diễn giải</th><th class="money">Giá trị</th><th>Người lập</th><th class="actions"></th></tr></thead><tbody>
        ${list.map((t) => `<tr data-id="${t.id}"><td class="nowrap">${U.fmtDate(t.date)}</td><td class="mono nowrap">${U.esc(t.docNo)}</td><td class="nowrap">${FIN.TX[t.type].name}${FIN.isLocked(t.date) ? ' 🔒' : ''}</td>
          <td><span class="asset-id">${U.esc(t.assetId)}</span></td><td>${U.esc(t.assetName)}</td><td class="small">${U.esc(t.desc)}${t.type === 'TRANSFER' ? `<div class="muted">${U.esc(deptName(t.fromDept))} → ${U.esc(deptName(t.toDept))}</div>` : ''}</td>
          <td class="money">${m(txAmount(t))}</td><td class="small">${U.esc(t.by)}</td>
          <td class="actions"><button class="btn btn-sm" data-act="print">${U.icon('printer', 14)}In</button>${FIN.canDeleteTx(t) ? '' : `<button class="icon-btn" data-act="del" title="Xoá nghiệp vụ" style="color:var(--red)">${U.icon('trash', 16)}</button>`}</td></tr>`).join('')}</tbody></table>` : UI.empty('Không có chứng từ trong khoảng thời gian này.', 'history')}</div></div>`;
    U.$('#txQ').addEventListener('input', U.debounce((e) => { st.txQ = e.target.value; renderTx(el); U.$('#txQ').focus(); }, 300));
    [['txType', 'txType'], ['txFrom', 'from'], ['txTo', 'to']].forEach(([id, k]) => U.$('#' + id).addEventListener('change', (e) => { st[k] = e.target.value; renderTx(el); }));
    U.$$('[data-new]', el).forEach((b) => b.addEventListener('click', () => FA.txForm(b.dataset.new)));
    U.$('#txXlsx').addEventListener('click', () => F.io.downloadXLSX([{ name: 'Nghiệp vụ TSCĐ', rows: [['Ngày CT', 'Số CT', 'Nghiệp vụ', 'Asset ID', 'Mã TS (KT)', 'Tài sản', 'Diễn giải', 'Giá trị', 'Bộ phận cũ', 'Bộ phận mới', 'Thu thanh lý', 'Chi phí thanh lý', 'Chứng từ gốc', 'Người lập'],
      ...list.map((t) => [t.date, t.docNo, FIN.TX[t.type].name, t.assetId, (S.asset(t.assetId) || { fin: {} }).fin.accCode || '', t.assetName, t.desc, txAmount(t) || '', t.fromDept ? deptName(t.fromDept) : '', t.toDept ? deptName(t.toDept) : '', t.proceeds ?? '', t.expenses ?? '', t.refDoc, t.by])], widths: [11, 13, 22, 14, 12, 32, 40, 15, 16, 16, 13, 13, 18, 16] }], `nghiep-vu-tscd-${st.from}-${st.to}.xlsx`));
    el.querySelector('.table-wrap').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const id = b.closest('tr').dataset.id;
      if (b.dataset.act === 'print') FA.printTx(id);
      if (b.dataset.act === 'del') {
        const t = FIN.txAll().find((x) => x.id === id);
        if (await UI.confirm(`Xoá nghiệp vụ <b>${U.esc(t.docNo)}</b> (${FIN.TX[t.type].name})? Số liệu khấu hao sẽ được tính lại.`, { danger: true, okLabel: 'Xoá' }))
          try { FIN.deleteTx(id); UI.toast('Đã xoá nghiệp vụ.', 'success'); } catch (err) { UI.toast(err.message, 'error'); }
      }
    });
  }

  /* ---------------- 3. khấu hao & phân bổ ---------------- */
  function renderDep(el) {
    if (st.from > st.to) st.to = st.from;
    const p = FIN.period(st.from, st.to);
    const rows = p.rows.filter((r) => r.dep || r.increased || r.disposed || r.nbv > 0).sort((x, y) => String(x.f.accCode || x.a.id).localeCompare(String(y.f.accCode || y.a.id)));
    const sum = (k) => rows.reduce((s, r) => s + (r[k] || 0), 0);
    el.innerHTML = `
      <div class="card" style="margin-bottom:14px"><div class="toolbar">
        <label class="small muted">Từ kỳ <input type="month" id="dpFrom" value="${st.from}"></label><label class="small muted">Đến kỳ <input type="month" id="dpTo" value="${st.to}"></label>
        <button class="btn btn-sm" data-q="month">Tháng này</button><button class="btn btn-sm" data-q="prev">Tháng trước</button><button class="btn btn-sm" data-q="year">Từ đầu năm</button>
        <span class="count"></span>
        <button class="btn btn-sm" id="dpPrint">${U.icon('printer', 14)}In bảng</button><button class="btn btn-primary btn-sm" id="dpXlsx">${U.icon('download', 14)}Xuất Excel (kèm bút toán MISA)</button></div></div>
      <div class="stat-row">
        <div class="card stat"><div class="l">Khấu hao / phân bổ trong kỳ</div><div class="v">${m(p.totalDep)}</div></div>
        <div class="card stat"><div class="l">Nguyên giá cuối kỳ</div><div class="v">${m(sum('cost'))}</div></div>
        <div class="card stat"><div class="l">HM luỹ kế cuối kỳ</div><div class="v">${m(sum('accum'))}</div></div>
        <div class="card stat"><div class="l">Giá trị còn lại cuối kỳ</div><div class="v">${m(sum('nbv'))}</div></div>
      </div>
      <div class="card" style="margin-bottom:14px"><div class="card-head"><h3>Bảng phân bổ khấu hao (định khoản)</h3><span class="muted small">Kỳ ${FIN.ymLabel(st.from)} – ${FIN.ymLabel(st.to)}</span></div>
        <div class="table-wrap">${p.allocation.length ? `<table class="tbl"><thead><tr><th>TK Nợ</th><th>TK Có</th><th>Bộ phận (đối tượng chi phí)</th><th class="money">Số tiền</th></tr></thead><tbody>
          ${p.allocation.map((x) => `<tr><td><b class="mono">${x.debit}</b> <span class="small muted">${U.esc(FIN.accName(x.debit))}</span></td><td><b class="mono">${x.credit}</b> <span class="small muted">${U.esc(FIN.accName(x.credit))}</span></td><td>${U.esc(deptName(x.dept))}</td><td class="money">${m(x.amount)}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="3">Cộng</td><td class="money">${m(p.totalDep)}</td></tr></tfoot></table>` : UI.empty('Không phát sinh khấu hao trong kỳ.')}</div></div>
      <div class="card"><div class="card-head"><h3>Bảng tính khấu hao chi tiết</h3><span class="muted small">${rows.length} tài sản</span></div>
        <div class="table-wrap" style="max-height:60vh"><table class="tbl tbl-nowrap"><thead><tr><th>Mã TS (KT)</th><th>Tên tài sản</th><th>Loại</th><th>Bộ phận</th><th>TK CP</th><th>Phương pháp</th><th class="money">Nguyên giá</th><th class="money">HM đầu kỳ</th><th class="money">KH trong kỳ</th><th class="money">HM cuối kỳ</th><th class="money">GTCL cuối kỳ</th><th>Ghi chú</th></tr></thead><tbody>
          ${rows.map((r) => `<tr><td class="mono">${U.esc(r.f.accCode || r.a.id)}</td><td>${U.esc(r.a.name)}</td><td>${FIN.typeShort(r.f.assetType)}</td><td>${U.esc(deptName(r.dept))}</td><td class="mono">${U.esc(r.exp)}</td><td class="small">${r.f.assetType === 'CCDC' ? 'Phân bổ đều' : FIN.methodName(r.f.method)}</td>
            <td class="money">${m(r.disposed ? r.disposed.cost : r.cost)}</td><td class="money">${m(r.openAccum)}</td><td class="money">${m(r.dep)}</td><td class="money">${m(r.disposed ? r.disposed.accum : r.accum)}</td><td class="money">${m(r.nbv)}</td>
            <td class="small">${r.increased ? 'Tăng trong kỳ ' : ''}${r.disposed ? `Ghi giảm ${U.fmtDate(r.disposed.date)}` : ''}</td></tr>`).join('')}</tbody>
          <tfoot><tr><td colspan="6">Cộng</td><td class="money">${m(sum('cost'))}</td><td class="money">${m(sum('openAccum'))}</td><td class="money">${m(p.totalDep)}</td><td class="money">${m(sum('accum'))}</td><td class="money">${m(sum('nbv'))}</td><td></td></tr></tfoot></table></div></div>`;
    U.$('#dpFrom').addEventListener('change', (e) => { st.from = e.target.value; renderDep(el); });
    U.$('#dpTo').addEventListener('change', (e) => { st.to = e.target.value; renderDep(el); });
    U.$$('[data-q]', el).forEach((b) => b.addEventListener('click', () => {
      const now = FIN.nowYm();
      if (b.dataset.q === 'month') st.from = st.to = now;
      if (b.dataset.q === 'prev') st.from = st.to = FIN.ymAdd(now, -1);
      if (b.dataset.q === 'year') { st.from = now.slice(0, 4) + '-01'; st.to = now; }
      renderDep(el);
    }));
    U.$('#dpXlsx').addEventListener('click', () => FA.exportDep(p, rows));
    U.$('#dpPrint').addEventListener('click', () => FA.printDep(p, rows));
  }

  FA.exportDep = (p, rows) => {
    const det = [['Mã TS (KT)', 'Asset ID', 'Tên tài sản', 'Loại', 'Bộ phận', 'TK chi phí', 'TK khấu hao', 'Phương pháp', 'Nguyên giá', 'HM đầu kỳ', 'KH trong kỳ', 'HM cuối kỳ', 'GTCL cuối kỳ', 'Ghi chú'],
      ...rows.map((r) => [r.f.accCode || '', r.a.id, r.a.name, FIN.typeName(r.f.assetType), deptName(r.dept), r.exp, r.credit, r.f.assetType === 'CCDC' ? 'Phân bổ đều' : FIN.methodName(r.f.method), r.disposed ? r.disposed.cost : r.cost, r.openAccum, r.dep, r.disposed ? r.disposed.accum : r.accum, r.nbv, (r.increased ? 'Tăng trong kỳ ' : '') + (r.disposed ? 'Ghi giảm ' + r.disposed.date : '')])];
    const alloc = [['TK Nợ', 'Tên TK Nợ', 'TK Có', 'Tên TK Có', 'Bộ phận', 'Số tiền'], ...p.allocation.map((x) => [x.debit, FIN.accName(x.debit), x.credit, FIN.accName(x.credit), deptName(x.dept), x.amount]), ['', '', '', '', 'Cộng', p.totalDep]];
    const docDate = FIN.lastDay(p.toYm);
    const docNo = `KH-${p.toYm.replace('-', '')}`;
    const misa = [['Ngày hạch toán', 'Ngày chứng từ', 'Số chứng từ', 'Diễn giải', 'TK Nợ', 'TK Có', 'Số tiền', 'Đơn vị (bộ phận)', 'Mã đơn vị'],
      ...p.allocation.map((x) => [docDate, docDate, docNo, `Trích khấu hao / phân bổ kỳ ${FIN.ymLabel(p.fromYm)}${p.fromYm !== p.toYm ? ' – ' + FIN.ymLabel(p.toYm) : ''} – ${deptName(x.dept)}`, x.debit, x.credit, x.amount, deptName(x.dept), x.dept])];
    const note = [['Ghi chú'], ['Sheet "Bút toán (MISA)" theo cấu trúc chứng từ nghiệp vụ khác: Ngày hạch toán, Số CT, Diễn giải, TK Nợ, TK Có, Số tiền, Đơn vị.'],
      ['Trước khi nhập vào MISA, đối chiếu thứ tự / tên cột với mẫu nhập khẩu của phiên bản MISA đang dùng (Nghiệp vụ khác hoặc Chứng từ tính khấu hao).'],
      ['Số liệu tính theo: ' + (FIN.settings().prorateByDay !== false ? 'số ngày sử dụng thực tế trong tháng ghi tăng / ghi giảm' : 'tròn tháng')], ...(S.isDemo() ? [['DỮ LIỆU DEMO – số liệu giả định.']] : [])];
    F.io.downloadXLSX([
      { name: 'Bảng tính KH', rows: det, widths: [12, 14, 34, 18, 22, 10, 10, 26, 16, 16, 16, 16, 16, 22] },
      { name: 'Phân bổ', rows: alloc, widths: [8, 34, 8, 30, 24, 16] },
      { name: 'Bút toán (MISA)', rows: misa, widths: [12, 12, 12, 56, 8, 8, 16, 24, 10] },
      { name: 'Ghi chú', rows: note, widths: [120] },
    ], `khau-hao-${p.fromYm}_${p.toYm}.xlsx`);
  };

  FA.printDep = (p, rows) => {
    const sum = (k) => rows.reduce((s, r) => s + (r[k] || 0), 0);
    P.doc(`${P.header('Kế toán')}${P.title('Bảng tính và phân bổ khấu hao TSCĐ', `Kỳ ${FIN.ymLabel(p.fromYm)}${p.fromYm !== p.toYm ? ' – ' + FIN.ymLabel(p.toYm) : ''}`)}
      <table class="grid"><tr><th>STT</th><th>Mã TS</th><th>Tên tài sản</th><th>Bộ phận</th><th>TK CP</th><th>Nguyên giá</th><th>HM đầu kỳ</th><th>KH trong kỳ</th><th>HM cuối kỳ</th><th>GTCL cuối kỳ</th></tr>
      ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${U.esc(r.f.accCode || r.a.id)}</td><td>${U.esc(r.a.name)}</td><td>${U.esc(deptName(r.dept))}</td><td>${r.exp}</td><td class="r">${P.money(r.disposed ? r.disposed.cost : r.cost)}</td><td class="r">${P.money(r.openAccum)}</td><td class="r">${P.money(r.dep)}</td><td class="r">${P.money(r.disposed ? r.disposed.accum : r.accum)}</td><td class="r">${P.money(r.nbv)}</td></tr>`).join('')}
      <tr class="t"><td colspan="5">Cộng</td><td class="r">${P.money(sum('cost'))}</td><td class="r">${P.money(sum('openAccum'))}</td><td class="r">${P.money(p.totalDep)}</td><td class="r">${P.money(sum('accum'))}</td><td class="r">${P.money(sum('nbv'))}</td></tr></table>
      <p><b>Phân bổ (định khoản):</b></p>
      <table class="grid"><tr><th>TK Nợ</th><th>TK Có</th><th>Bộ phận</th><th>Số tiền</th></tr>${p.allocation.map((x) => `<tr><td>${x.debit} – ${U.esc(FIN.accName(x.debit))}</td><td>${x.credit}</td><td>${U.esc(deptName(x.dept))}</td><td class="r">${P.money(x.amount)}</td></tr>`).join('')}
      <tr class="t"><td colspan="3">Cộng</td><td class="r">${P.money(p.totalDep)}</td></tr></table>
      ${P.signs(['Người lập', 'Kế toán trưởng'], FIN.lastDay(p.toYm))}`, { landscape: true });
  };

  /* ---------------- 4. sổ TSCĐ / CCDC ---------------- */
  function bookRows() {
    const y = st.year, from = y + '-01', to = y + '-12';
    return S.assets().filter(FIN.has).filter((a) => (st.bookType === 'CCDC') === (a.fin.assetType === 'CCDC')).map((a) => {
      const f = a.fin;
      if (FIN.ymOf(f.increaseDate) > to) return null;
      const sc = FIN.schedule(a, to);
      if (sc.disposal && FIN.ymOf(sc.disposal.date) < from) return null;
      const yr = sc.rows.filter((r) => r.ym >= from && r.ym <= to);
      const last = sc.rows[sc.rows.length - 1];
      const inc = FIN.txFor(a.id).find((t) => t.type === 'INCREASE');
      const dis = sc.disposal && FIN.ymOf(sc.disposal.date) <= to ? sc.disposal : null;
      return { a, f, inc, dis, depYear: yr.reduce((s, r) => s + r.dep, 0), accum: last ? last.accum : Number(f.openingAccum) || 0, cost: last ? last.cost : f.cost, nbv: dis ? 0 : last ? last.nbv : f.cost - (f.openingAccum || 0), dept: last ? last.dept : a.departmentId };
    }).filter(Boolean).sort((x, y2) => x.f.increaseDate.localeCompare(y2.f.increaseDate));
  }
  function renderBook(el) {
    const rows = bookRows();
    const years = []; for (let y = Number(thisYear) + 1; y >= Number(thisYear) - 8; y--) years.push(String(y));
    el.innerHTML = `<div class="card"><div class="toolbar">
        <select id="bkType"><option value="TSCD" ${st.bookType === 'TSCD' ? 'selected' : ''}>Sổ tài sản cố định</option><option value="CCDC" ${st.bookType === 'CCDC' ? 'selected' : ''}>Sổ theo dõi CCDC</option></select>
        <label class="small muted">Năm <select id="bkYear">${years.map((y) => `<option ${y === st.year ? 'selected' : ''}>${y}</option>`).join('')}</select></label>
        <span class="count">${rows.length} tài sản</span>
        <button class="btn btn-sm" id="bkPrint">${U.icon('printer', 14)}In sổ</button><button class="btn btn-sm" id="bkXlsx">${U.icon('download', 14)}Xuất Excel</button></div>
      <div class="table-wrap" style="max-height:calc(100vh - 290px)">${rows.length ? `<table class="tbl tbl-nowrap"><thead>
        <tr><th colspan="6" style="text-align:center">Ghi tăng</th><th colspan="3" style="text-align:center">${st.bookType === 'CCDC' ? 'Phân bổ' : 'Khấu hao'}</th><th colspan="3" style="text-align:center">Ghi giảm</th></tr>
        <tr><th>Số CT</th><th>Ngày</th><th>Mã TS</th><th>Tên tài sản</th><th>Bộ phận</th><th class="money">Nguyên giá</th><th class="money">Trong năm ${st.year}</th><th class="money">Luỹ kế đến 31/12</th><th class="money">GTCL</th><th>Số CT</th><th>Ngày</th><th>Lý do</th></tr></thead><tbody>
        ${rows.map((r) => `<tr><td class="mono">${U.esc(r.inc ? r.inc.docNo : '')}</td><td>${U.fmtDate(r.f.increaseDate)}</td><td class="mono">${U.esc(r.f.accCode || r.a.id)}</td><td>${U.esc(r.a.name)}</td><td>${U.esc(deptName(r.dept))}</td><td class="money">${m(r.dis ? r.dis.cost : r.cost)}</td>
          <td class="money">${m(r.depYear)}</td><td class="money">${m(r.dis ? r.dis.accum : r.accum)}</td><td class="money">${m(r.nbv)}</td>
          <td class="mono">${r.dis ? U.esc(r.dis.tx.docNo) : ''}</td><td>${r.dis ? U.fmtDate(r.dis.date) : ''}</td><td class="small">${r.dis ? U.esc(r.dis.tx.reason || '') : ''}</td></tr>`).join('')}</tbody>
        <tfoot><tr><td colspan="5">Cộng</td><td class="money">${m(rows.reduce((s, r) => s + (r.dis ? r.dis.cost : r.cost), 0))}</td><td class="money">${m(rows.reduce((s, r) => s + r.depYear, 0))}</td><td class="money">${m(rows.reduce((s, r) => s + (r.dis ? r.dis.accum : r.accum), 0))}</td><td class="money">${m(rows.reduce((s, r) => s + r.nbv, 0))}</td><td colspan="3"></td></tr></tfoot></table>` : UI.empty('Không có tài sản trong năm này.')}</div></div>`;
    U.$('#bkType').addEventListener('change', (e) => { st.bookType = e.target.value; renderBook(el); });
    U.$('#bkYear').addEventListener('change', (e) => { st.year = e.target.value; renderBook(el); });
    const head = ['Số CT ghi tăng', 'Ngày ghi tăng', 'Mã TS', 'Asset ID', 'Tên tài sản', 'Bộ phận', 'Nguyên giá', `${st.bookType === 'CCDC' ? 'Phân bổ' : 'Khấu hao'} năm ${st.year}`, 'Luỹ kế 31/12', 'GTCL', 'Số CT ghi giảm', 'Ngày ghi giảm', 'Lý do ghi giảm'];
    const data = rows.map((r) => [r.inc ? r.inc.docNo : '', r.f.increaseDate, r.f.accCode || '', r.a.id, r.a.name, deptName(r.dept), r.dis ? r.dis.cost : r.cost, r.depYear, r.dis ? r.dis.accum : r.accum, r.nbv, r.dis ? r.dis.tx.docNo : '', r.dis ? r.dis.date : '', r.dis ? r.dis.tx.reason || '' : '']);
    const title = st.bookType === 'CCDC' ? 'Sổ theo dõi công cụ dụng cụ' : 'Sổ tài sản cố định';
    U.$('#bkXlsx').addEventListener('click', () => F.io.downloadXLSX([{ name: title.slice(0, 31), rows: [[title + ' – năm ' + st.year], head, ...data], widths: [14, 12, 12, 14, 34, 22, 16, 16, 16, 16, 14, 12, 34] }], `${st.bookType === 'CCDC' ? 'so-ccdc' : 'so-tscd'}-${st.year}.xlsx`));
    U.$('#bkPrint').addEventListener('click', () => P.doc(`${P.header('Kế toán')}${P.title(title, 'Năm ' + st.year)}
      <table class="grid"><tr><th colspan="5">Ghi tăng</th><th colspan="3">${st.bookType === 'CCDC' ? 'Phân bổ' : 'Khấu hao'}</th><th colspan="3">Ghi giảm</th></tr>
      <tr><th>Số CT</th><th>Ngày</th><th>Mã TS</th><th>Tên tài sản</th><th>Nguyên giá</th><th>Năm ${st.year}</th><th>Luỹ kế</th><th>GTCL</th><th>Số CT</th><th>Ngày</th><th>Lý do</th></tr>
      ${data.map((d) => `<tr><td>${U.esc(d[0])}</td><td>${P.date(d[1])}</td><td>${U.esc(d[2] || d[3])}</td><td>${U.esc(d[4])}</td><td class="r">${P.money(d[6])}</td><td class="r">${P.money(d[7])}</td><td class="r">${P.money(d[8])}</td><td class="r">${P.money(d[9])}</td><td>${U.esc(d[10])}</td><td>${d[11] ? P.date(d[11]) : ''}</td><td>${U.esc(d[12])}</td></tr>`).join('')}
      <tr class="t"><td colspan="4">Cộng</td><td class="r">${P.money(data.reduce((s, d) => s + d[6], 0))}</td><td class="r">${P.money(data.reduce((s, d) => s + d[7], 0))}</td><td class="r">${P.money(data.reduce((s, d) => s + d[8], 0))}</td><td class="r">${P.money(data.reduce((s, d) => s + d[9], 0))}</td><td colspan="3"></td></tr></table>
      ${P.signs(['Người ghi sổ', 'Kế toán trưởng', 'Giám đốc'], st.year + '-12-31')}`, { landscape: true }));
  }

  /* ---------------- 5. khoá sổ & tài khoản ---------------- */
  function renderLock(el) {
    const s = FIN.settings();
    el.innerHTML = `<div class="grid grid-2">
      <div class="card"><div class="card-head"><h3>Khoá sổ</h3></div><div class="card-body">
        <p>Đã khoá đến kỳ: <b>${s.lockedUntil ? FIN.ymLabel(s.lockedUntil) : 'chưa khoá'}</b></p>
        <p class="small muted">Sau khi khoá, không thể thêm / xoá nghiệp vụ có ngày thuộc kỳ đã khoá, và không sửa được nguyên giá, thời gian, tài khoản của tài sản bắt đầu khấu hao trong kỳ đã khoá. Ứng dụng không có đăng nhập nên mọi người dùng đều có thể mở khoá — hãy thống nhất quy trình nội bộ.</p>
        <div class="field-row" style="max-width:420px"><input type="month" id="lkYm" value="${s.lockedUntil || FIN.ymAdd(FIN.nowYm(), -1)}"><button class="btn btn-primary" id="lkSet">🔒 Khoá sổ đến kỳ này</button></div>
        ${s.lockedUntil ? '<button class="btn btn-danger btn-sm" id="lkClear" style="margin-top:10px">Mở khoá toàn bộ</button>' : ''}
        <hr style="border:0;border-top:1px solid var(--line);margin:16px 0">
        <form id="lkSettings" class="form-grid">
          <div class="field full"><label>Chế độ kế toán áp dụng</label><input name="regime" value="${U.esc(s.regime || '')}"></div>
          <div class="field full"><label class="check"><input type="checkbox" name="prorateByDay" ${s.prorateByDay !== false ? 'checked' : ''}> Tính khấu hao theo số ngày sử dụng trong tháng ghi tăng / ghi giảm</label>
            <div class="hint">Bỏ chọn để tính tròn tháng (tháng ghi tăng tính đủ, tháng ghi giảm không tính).</div></div>
          <div class="field full"><label>Nguồn vốn (mỗi dòng một mục)</label><textarea name="fundSources">${U.esc((s.fundSources || []).join('\n'))}</textarea></div>
          <div class="full"><button class="btn btn-primary" type="submit">${U.icon('check', 16)}Lưu</button></div></form>
      </div></div>
      <div class="card"><div class="card-head"><h3>Danh mục tài khoản</h3><button class="btn btn-sm" id="acAdd">${U.icon('plus', 14)}Thêm TK</button></div>
        <div class="card-body small muted">Danh mục mặc định theo hệ thống tài khoản doanh nghiệp. Hãy đối chiếu với hệ thống tài khoản chi tiết của đơn vị theo ${U.esc(s.regime || 'chế độ kế toán áp dụng')}.</div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>Số hiệu</th><th>Tên tài khoản</th><th>Dùng cho</th><th class="actions"></th></tr></thead><tbody>
        ${(s.accounts || []).map((a, i) => `<tr data-i="${i}"><td class="mono"><b>${U.esc(a.code)}</b></td><td>${U.esc(a.name)}</td><td class="small">${{ asset: 'Nguyên giá', dep: 'Khấu hao / chờ phân bổ', exp: 'Chi phí', other: 'Khác' }[a.kind] || a.kind}</td>
          <td class="actions"><button class="icon-btn" data-ac="edit" title="Sửa">${U.icon('edit', 16)}</button><button class="icon-btn" data-ac="del" title="Xoá" style="color:var(--red)">${U.icon('trash', 16)}</button></td></tr>`).join('')}</tbody></table></div></div></div>`;
    U.$('#lkSet').addEventListener('click', async () => {
      const ym = U.$('#lkYm').value;
      if (!ym) return;
      if (await UI.confirm(`Khoá sổ đến hết kỳ <b>${FIN.ymLabel(ym)}</b>?`, { okLabel: 'Khoá sổ' })) { FIN.setLock(ym); UI.toast(`Đã khoá sổ đến ${FIN.ymLabel(ym)}.`, 'success'); }
    });
    const clr = U.$('#lkClear');
    if (clr) clr.addEventListener('click', async () => { if (await UI.confirm('Mở khoá toàn bộ các kỳ? Số liệu các kỳ trước có thể bị thay đổi.', { danger: true, okLabel: 'Mở khoá' })) { FIN.setLock(''); UI.toast('Đã mở khoá sổ.', 'success'); } });
    U.$('#lkSettings').addEventListener('submit', (e) => {
      e.preventDefault();
      const d = UI.formData(e.target);
      FIN.saveSettings({ regime: d.regime.trim(), prorateByDay: d.prorateByDay, fundSources: d.fundSources.split('\n').map((x) => x.trim()).filter(Boolean) });
      UI.toast('Đã lưu. Khấu hao được tính lại theo thiết lập mới.', 'success');
    });
    const accForm = (i) => {
      const acc = i === undefined ? { code: '', name: '', kind: 'exp' } : s.accounts[i];
      const form = U.h(`<form class="form-grid"><div class="field"><label>Số hiệu TK</label><input name="code" value="${U.esc(acc.code)}"></div><div class="field"><label>Dùng cho</label><select name="kind">${[['asset', 'Nguyên giá'], ['dep', 'Khấu hao / chờ phân bổ'], ['exp', 'Chi phí'], ['other', 'Khác']].map(([k, t]) => `<option value="${k}" ${acc.kind === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div><div class="field full"><label>Tên tài khoản</label><input name="name" value="${U.esc(acc.name)}"></div></form>`);
      UI.modal({ title: i === undefined ? 'Thêm tài khoản' : 'Sửa tài khoản', body: form, actions: [{ label: 'Hủy' }, { label: 'Lưu', primary: true, onClick: () => {
        const d = UI.formData(form);
        if (!/^\d{3,8}$/.test(d.code.trim()) || !d.name.trim()) { UI.toast('Nhập số hiệu (3–8 chữ số) và tên tài khoản.', 'error'); return false; }
        const list = (s.accounts || []).slice();
        if (list.some((x, j) => x.code === d.code.trim() && j !== i)) { UI.toast('Số hiệu tài khoản đã có.', 'error'); return false; }
        const item = { code: d.code.trim(), name: d.name.trim(), kind: d.kind };
        if (i === undefined) list.push(item); else list[i] = item;
        list.sort((x, y) => x.code.localeCompare(y.code));
        FIN.saveSettings({ accounts: list });
      } }] });
    };
    U.$('#acAdd').addEventListener('click', () => accForm());
    el.querySelector('.card:last-child tbody').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-ac]'); if (!b) return;
      const i = Number(b.closest('tr').dataset.i);
      if (b.dataset.ac === 'edit') return accForm(i);
      const code = s.accounts[i].code;
      const used = S.assets().some((a) => a.fin && [a.fin.assetAccount, a.fin.depAccount, a.fin.expenseAccount].includes(code));
      if (used) return UI.toast(`TK ${code} đang được dùng cho tài sản.`, 'error');
      if (await UI.confirm(`Xoá tài khoản ${code}?`, { danger: true, okLabel: 'Xoá' })) FIN.saveSettings({ accounts: s.accounts.filter((_, j) => j !== i) });
    });
  }

  /* ---------------- xuất Excel cho MISA (khai báo đầu kỳ) ---------------- */
  FA.exportMisa = (ym) => {
    const day = FIN.lastDay(ym);
    const list = S.assets().filter(FIN.has).map((a) => ({ a, s: FIN.stateAt(a, ym) })).filter(({ s }) => !['DISPOSED', 'NOTYET'].includes(s.status));
    const ts = list.filter(({ a }) => a.fin.assetType !== 'CCDC');
    const cc = list.filter(({ a }) => a.fin.assetType === 'CCDC');
    const tsRows = [['Mã tài sản', 'Tên tài sản', 'Loại tài sản', 'Đơn vị sử dụng', 'Ngày ghi tăng', 'Ngày bắt đầu tính KH', 'Thời gian sử dụng (tháng)', 'Thời gian sử dụng còn lại (tháng)', 'Nguyên giá', 'Giá trị tính khấu hao', 'Hao mòn luỹ kế', 'Giá trị còn lại', 'Giá trị KH tháng', 'TK nguyên giá', 'TK khấu hao', 'TK chi phí', 'Nguồn vốn', 'Số lượng', 'Asset ID (Bản đồ tài sản)'],
      ...ts.map(({ a, s }) => [a.fin.accCode || a.id, a.name, FIN.typeName(a.fin.assetType), deptName(s.dept || a.departmentId), a.fin.increaseDate, a.fin.depStartDate, a.fin.usefulLifeMonths, Math.ceil(s.remaining || 0), s.cost, s.cost, s.accum, s.nbv, s.dep, a.fin.assetAccount, a.fin.depAccount, s.exp || a.fin.expenseAccount, a.fin.fundSource || '', 1, a.id])];
    const ccRows = [['Mã CCDC', 'Tên CCDC', 'Đơn vị sử dụng', 'Ngày ghi tăng', 'Số kỳ phân bổ', 'Số kỳ phân bổ còn lại', 'Giá trị CCDC', 'Giá trị đã phân bổ', 'Giá trị còn lại', 'Giá trị phân bổ kỳ', 'TK chờ phân bổ', 'TK chi phí', 'Số lượng', 'Asset ID (Bản đồ tài sản)'],
      ...cc.map(({ a, s }) => [a.fin.accCode || a.id, a.name, deptName(s.dept || a.departmentId), a.fin.increaseDate, a.fin.usefulLifeMonths, Math.ceil(s.remaining || 0), s.cost, s.accum, s.nbv, s.dep, a.fin.depAccount, s.exp || a.fin.expenseAccount, 1, a.id])];
    const note = [['Số liệu tại ngày ' + U.fmtDate(day) + ' (cuối kỳ ' + FIN.ymLabel(ym) + ').'],
      ['Cấu trúc cột theo màn hình khai báo TSCĐ / CCDC đầu kỳ của MISA. Trước khi nhập khẩu, đối chiếu tên và thứ tự cột với file mẫu tải từ chính phần mềm MISA đang dùng (SME / AMIS), sau đó sao chép dữ liệu sang file mẫu.'],
      ['Mã đơn vị sử dụng và mã loại tài sản phải trùng với danh mục đã khai báo trong MISA.'], ...(S.isDemo() ? [['DỮ LIỆU DEMO – số liệu giả định.']] : [])];
    F.io.downloadXLSX([
      { name: 'TSCĐ', rows: tsRows, widths: [12, 34, 16, 24, 12, 14, 10, 12, 16, 16, 16, 16, 14, 10, 10, 10, 18, 8, 16] },
      { name: 'CCDC', rows: ccRows, widths: [12, 34, 24, 12, 10, 12, 14, 14, 14, 14, 10, 10, 8, 16] },
      { name: 'Ghi chú', rows: note, widths: [130] },
    ], `misa-khai-bao-tscd-ccdc-${ym}.xlsx`);
  };

  /* ---------------- chứng từ in ---------------- */
  function docTitle(t) {
    return { INCREASE: 'Biên bản giao nhận TSCĐ', UPGRADE: 'Biên bản giao nhận TSCĐ sửa chữa lớn hoàn thành', REVALUE: 'Biên bản đánh giá lại TSCĐ', TRANSFER: 'Biên bản bàn giao điều chuyển TSCĐ', DISPOSE: 'Biên bản thanh lý TSCĐ' }[t.type];
  }
  const infoTable = (a) => `<table class="grid"><tr><th>Tên, ký hiệu, quy cách</th><th>Mã TS</th><th>Asset ID</th><th>Nhà sản xuất</th><th>Model</th><th>Số serial</th></tr>
    <tr><td>${U.esc(a.name)}</td><td>${U.esc((a.fin && a.fin.accCode) || '')}</td><td>${U.esc(a.id)}</td><td>${U.esc(a.manufacturer)}</td><td>${U.esc(a.model)}</td><td>${U.esc(a.serial)}</td></tr></table>`;
  FA.printTx = (id) => {
    const t = FIN.txAll().find((x) => x.id === id);
    if (!t) return;
    const a = S.asset(t.assetId) || { id: t.assetId, name: t.assetName, fin: {} };
    const f = a.fin || {};
    const loc = S.view(a.id);
    let body = '';
    if (t.type === 'INCREASE') {
      body = `<p>Căn cứ: ${U.esc(t.refDoc || '……………………………')}</p>
        <p>Bên giao: ${U.esc(f.supplier || '……………………………………')}</p><p>Bên nhận: ${U.esc(deptName(a.departmentId))} – ${U.esc(S.factory().name)}</p>
        <p>Địa điểm giao nhận: ${loc ? U.esc(`${loc.floorName} – ${loc.zoneName} (Location Code ${loc.locationCode})`) : '……………'}</p>
        <p>Xác nhận việc giao nhận tài sản như sau:</p>${infoTable(a)}
        <table class="grid"><tr><th>Loại</th><th>Ngày ghi tăng</th><th>Nguyên giá</th><th>Thời gian sử dụng</th><th>Nguồn vốn</th><th>Hoá đơn</th></tr>
        <tr><td>${FIN.typeName(f.assetType)}</td><td>${P.date(f.increaseDate)}</td><td class="r">${P.money(f.cost)}</td><td>${f.usefulLifeMonths} tháng</td><td>${U.esc(f.fundSource || '')}</td><td>${U.esc(f.invoiceNo || '')} ${f.invoiceDate ? '– ' + P.date(f.invoiceDate) : ''}</td></tr></table>
        <p>Dụng cụ, phụ tùng kèm theo: ……………………………………………………………</p>`;
      body += P.signs(['Giám đốc bên nhận', 'Kế toán trưởng bên nhận', 'Người nhận', 'Người giao'], t.date);
    } else if (t.type === 'TRANSFER') {
      body = `<p>Căn cứ: ${U.esc(t.refDoc || '……………………………')}</p><p>Bên giao: <b>${U.esc(deptName(t.fromDept))}</b></p><p>Bên nhận: <b>${U.esc(deptName(t.toDept))}</b>${t.receiver ? ' – Người nhận: ' + U.esc(t.receiver) : ''}</p>
        ${infoTable(a)}<table class="grid"><tr><th>Nguyên giá</th><th>HM luỹ kế đến cuối kỳ trước</th><th>Giá trị còn lại</th><th>TK chi phí cũ</th><th>TK chi phí mới</th></tr>
        ${(() => { const s = FIN.stateAt(a, FIN.ymAdd(FIN.ymOf(t.date), -1)); return `<tr><td class="r">${P.money(s.cost)}</td><td class="r">${P.money(s.accum)}</td><td class="r">${P.money(s.nbv)}</td><td>${U.esc(t.fromExpense || '')}</td><td>${U.esc(t.toExpense || '')}</td></tr>`; })()}</table>
        <p>Nội dung: ${U.esc(t.desc)}</p>${P.signs(['Kế toán trưởng', 'Đại diện bên giao', 'Đại diện bên nhận'], t.date)}`;
    } else if (t.type === 'DISPOSE') {
      const sn = t.snapshot || {};
      body = `<p>Căn cứ: ${U.esc(t.refDoc || 'Quyết định số …… ngày …… về việc thanh lý TSCĐ')}</p>
        <p><b>I. Ban thanh lý TSCĐ gồm:</b> ………………………………………………………………</p><p><b>II. Tiến hành thanh lý TSCĐ:</b></p>${infoTable(a)}
        <table class="grid"><tr><th>Năm đưa vào sử dụng</th><th>Nguyên giá</th><th>Hao mòn đến thời điểm thanh lý</th><th>Giá trị còn lại</th></tr>
        <tr><td>${String(f.increaseDate || '').slice(0, 4)}</td><td class="r">${P.money(sn.cost)}</td><td class="r">${P.money(sn.accum)}</td><td class="r">${P.money(sn.nbv)}</td></tr></table>
        <p><b>III. Kết luận của Ban thanh lý:</b> ${U.esc(t.reason || '')}</p>
        <p><b>IV. Kết quả thanh lý:</b> Chi phí thanh lý: <b>${P.money(t.expenses)}</b> đồng. Giá trị thu hồi: <b>${P.money(t.proceeds)}</b> đồng${t.buyer ? ' – Bên mua / nhận: ' + U.esc(t.buyer) : ''}.</p>
        <p>Đã ghi giảm sổ TSCĐ ngày ${P.date(t.date)}.</p>${P.signs(['Trưởng ban thanh lý', 'Kế toán trưởng', 'Giám đốc'], t.date)}`;
    } else {
      const rows = t.type === 'UPGRADE'
        ? `<tr><th>Giá trị nâng cấp / sửa chữa lớn</th><td class="r">${P.money(t.amount)}</td></tr><tr><th>Tăng thời gian sử dụng</th><td>${t.extraMonths || 0} tháng</td></tr>`
        : `<tr><th>Chênh lệch nguyên giá</th><td class="r">${P.money(t.costDelta)}</td></tr><tr><th>Chênh lệch hao mòn luỹ kế</th><td class="r">${P.money(t.accumDelta)}</td></tr><tr><th>Thời gian còn lại mới</th><td>${t.newRemaining ? t.newRemaining + ' tháng' : 'Giữ nguyên'}</td></tr>`;
      body = `<p>Căn cứ: ${U.esc(t.refDoc || '……………………………')}</p>${infoTable(a)}<table class="grid">${rows}</table><p>Nội dung: ${U.esc(t.desc)}</p>
        ${P.signs(t.type === 'UPGRADE' ? ['Kế toán trưởng', 'Bên có TSCĐ', 'Bên sửa chữa / nâng cấp'] : ['Uỷ viên', 'Kế toán trưởng', 'Trưởng ban đánh giá'], t.date)}`;
    }
    P.doc(`${P.header(deptName(a.departmentId))}${P.title(docTitle(t), `${P.dateWords(t.date)} – Số: ${U.esc(t.docNo)}`)}${body}`);
  };

  FA.printCard = (assetId) => {
    const a = S.asset(assetId);
    if (!FIN.has(a)) return;
    const f = a.fin, ym = FIN.nowYm();
    const sc = FIN.schedule(a, ym);
    const years = {};
    sc.rows.forEach((r) => { const y = r.ym.slice(0, 4); years[y] = years[y] || { dep: 0, accum: 0 }; years[y].dep += r.dep; years[y].accum = r.accum; });
    const inc = FIN.txFor(a.id).find((t) => t.type === 'INCREASE');
    const others = FIN.txFor(a.id).filter((t) => t.type !== 'INCREASE');
    const v = S.view(a.id);
    P.doc(`${P.header(deptName(a.departmentId))}${P.title(f.assetType === 'CCDC' ? 'Thẻ theo dõi công cụ dụng cụ' : 'Thẻ tài sản cố định', `Số: ${U.esc(f.accCode || a.id)} – Ngày lập thẻ: ${P.date(new Date().toISOString().slice(0, 10))}`)}
      <p>Căn cứ vào biên bản giao nhận số ${U.esc(inc ? inc.docNo : '……')} ngày ${P.date(f.increaseDate)}</p>
      <p>Tên, ký mã hiệu, quy cách: <b>${U.esc(a.name)}</b> – Model ${U.esc(a.model)} – Số hiệu: ${U.esc(a.serial)}</p>
      <p>Nhà sản xuất: ${U.esc(a.manufacturer)} · Asset ID: ${U.esc(a.id)} · Vị trí: ${U.esc(v ? v.locationCode : '')}</p>
      <p>Bộ phận quản lý, sử dụng: ${U.esc(deptName(a.departmentId))} · Năm đưa vào sử dụng: ${String(f.increaseDate).slice(0, 4)} · Nguồn vốn: ${U.esc(f.fundSource || '')}</p>
      <p>Phương pháp: ${f.assetType === 'CCDC' ? 'phân bổ đều' : FIN.methodName(f.method)} · Thời gian sử dụng: ${f.usefulLifeMonths} tháng · TK: ${U.esc(f.assetAccount || '')} / ${U.esc(f.depAccount)} / ${U.esc(f.expenseAccount)}</p>
      ${f.disposedDate ? `<p><b>Đình chỉ sử dụng / ghi giảm ngày ${P.date(f.disposedDate)}</b></p>` : ''}
      <table class="grid"><tr><th colspan="4">Nguyên giá tài sản cố định</th><th colspan="3">Giá trị hao mòn</th></tr>
      <tr><th>Số hiệu CT</th><th>Ngày</th><th>Diễn giải</th><th>Nguyên giá</th><th>Năm</th><th>Giá trị hao mòn</th><th>Cộng dồn</th></tr>
      ${(() => {
        const left = [[inc ? inc.docNo : '', f.increaseDate, 'Ghi tăng', f.cost], ...others.filter((t) => ['UPGRADE', 'REVALUE'].includes(t.type)).map((t) => [t.docNo, t.date, FIN.TX[t.type].name, t.type === 'UPGRADE' ? t.amount : t.costDelta])];
        const right = Object.entries(years);
        const n = Math.max(left.length, right.length);
        let h = '';
        for (let i = 0; i < n; i++) {
          const l = left[i], r = right[i];
          h += `<tr><td>${l ? U.esc(l[0]) : ''}</td><td>${l ? P.date(l[1]) : ''}</td><td>${l ? U.esc(l[2]) : ''}</td><td class="r">${l ? P.money(l[3]) : ''}</td><td>${r ? r[0] : ''}</td><td class="r">${r ? P.money(r[1].dep) : ''}</td><td class="r">${r ? P.money(r[1].accum) : ''}</td></tr>`;
        }
        return h;
      })()}</table>
      ${others.length ? `<p><b>Biến động:</b></p><table class="grid"><tr><th>Số CT</th><th>Ngày</th><th>Nghiệp vụ</th><th>Nội dung</th></tr>${others.map((t) => `<tr><td>${U.esc(t.docNo)}</td><td>${P.date(t.date)}</td><td>${FIN.TX[t.type].name}</td><td>${U.esc(t.desc)}${t.type === 'TRANSFER' ? ` (${U.esc(deptName(t.fromDept))} → ${U.esc(deptName(t.toDept))})` : ''}</td></tr>`).join('')}</table>` : ''}
      ${P.signs(['Người lập thẻ', 'Kế toán trưởng'], false)}`);
  };
})(window.FAM);
