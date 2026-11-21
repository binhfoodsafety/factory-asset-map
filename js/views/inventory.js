/* Factory Asset Map — TAB Kiểm kê tài sản bằng QR. */
window.FAM = window.FAM || {};
(function (F) {
  'use strict';
  const U = F.util, S = F.store, UI = F.ui, FIN = F.fin, P = F.print;
  F.views = F.views || {};
  const INV = (F.inv = {});
  const V = (F.views.inventory = {});
  const ACTIVE_KEY = 'fam.activeCount';

  INV.RESULTS = {
    FOUND: { name: 'Có – đúng vị trí', short: 'Có', color: '#0d9488' },
    WRONG_LOC: { name: 'Có – sai vị trí', short: 'Sai vị trí', color: '#2563eb' },
    DAMAGED: { name: 'Có – hư hỏng', short: 'Hỏng', color: '#d97706' },
    MISSING: { name: 'Không tìm thấy', short: 'Không thấy', color: '#dc2626' },
    EXTRA: { name: 'Thừa (không có trên sổ)', short: 'Thừa', color: '#7c3aed' },
  };
  const db = () => S.raw();
  INV.counts = () => (db().counts || []).slice().sort((a, b) => b.date.localeCompare(a.date) || b.code.localeCompare(a.code));
  INV.count = (id) => (db().counts || []).find((c) => c.id === id);
  INV.lines = (countId) => (db().countLines || []).filter((l) => l.countId === countId);
  INV.line = (countId, assetId) => (db().countLines || []).find((l) => l.id === `${countId}__${assetId}`);
  INV.active = () => { try { const id = localStorage.getItem(ACTIVE_KEY); const c = id && INV.count(id); return c && c.status === 'OPEN' ? c : null; } catch (e) { return null; } };
  INV.setActive = (id) => { try { id ? localStorage.setItem(ACTIVE_KEY, id) : localStorage.removeItem(ACTIVE_KEY); } catch (e) { /* ignore */ } };

  INV.scopeAssets = (floorIds, zoneIds, date) => S.assets().filter((a) => {
    if (a.fin && a.fin.disposedDate && (!date || a.fin.disposedDate <= date)) return false;
    const l = S.location(a.id);
    if (!l) return false;
    if (floorIds && floorIds.length && !floorIds.includes(l.floorId)) return false;
    if (zoneIds && zoneIds.length && !zoneIds.includes(l.zoneId)) return false;
    return true;
  }).map((a) => a.id);

  INV.nextCode = (date) => {
    const p = `KK-${String(date).slice(0, 7)}`;
    const n = (db().counts || []).filter((c) => c.code.startsWith(p)).length;
    return n ? `${p}-${n + 1}` : p;
  };
  INV.create = (c) => {
    if (!String(c.name || '').trim()) throw new Error('Nhập tên đợt kiểm kê');
    if (!FIN.isDate(c.date)) throw new Error('Nhập ngày kiểm kê');
    const expected = INV.scopeAssets(c.floorIds, c.zoneIds);
    if (!expected.length) throw new Error('Phạm vi đã chọn không có tài sản nào.');
    const count = { id: U.uid('kk'), code: INV.nextCode(c.date), name: c.name.trim(), date: c.date, floorIds: c.floorIds || [], zoneIds: c.zoneIds || [], members: String(c.members || '').trim(), expected, status: 'OPEN', createdBy: S.currentUser(), createdAt: U.nowIso() };
    db().counts.push(count);
    S.commitExt('inventory');
    return count;
  };
  INV.mark = (countId, assetId, patch, opts = {}) => {
    const c = INV.count(countId);
    if (!c || c.status !== 'OPEN') throw new Error('Đợt kiểm kê đã kết thúc.');
    const id = `${countId}__${assetId}`;
    let l = (db().countLines || []).find((x) => x.id === id);
    if (!l) { l = { id, countId, assetId }; db().countLines.push(l); }
    Object.assign(l, patch, { by: S.currentUser(), at: U.nowIso() });
    if (l.result !== 'WRONG_LOC') { delete l.foundZoneId; delete l.foundFloorId; }
    if (!opts.silent) S.commitExt('inventory');
    return l;
  };
  INV.unmark = (countId, assetId) => {
    db().countLines = db().countLines.filter((x) => x.id !== `${countId}__${assetId}`);
    S.commitExt('inventory');
  };
  // Quét một mã (Asset ID, đường dẫn QR, serial). zoneId: khu vực người kiểm đang đứng (tuỳ chọn)
  INV.scan = (countId, raw, zoneId) => {
    const s = String(raw || '').trim();
    if (!s) return null;
    const m = s.match(/[?&#]asset=([^&#\s]+)/i);
    const code = (m ? decodeURIComponent(m[1]) : s).trim();
    const c = INV.count(countId);
    const a = F.views.map.findAsset(code);
    const exact = a && (a.id.toLowerCase() === code.toLowerCase() || (a.serial || '').toLowerCase() === code.toLowerCase());
    if (!a || !exact) {
      const key = 'X__' + code.toUpperCase().replace(/[^A-Z0-9\-_.]/g, '').slice(0, 60);
      INV.mark(countId, key, { result: 'EXTRA', code, note: 'Mã không có trên sổ', foundZoneId: undefined });
      return { kind: 'extra', code };
    }
    const loc = S.location(a.id);
    const inScope = (c.expected || []).includes(a.id);
    const z = zoneId && S.zone(zoneId);
    if (z && loc && loc.zoneId !== z.id) {
      INV.mark(countId, a.id, { result: 'WRONG_LOC', foundZoneId: z.id, foundFloorId: z.floorId, note: inScope ? '' : 'Ngoài phạm vi kiểm kê' });
      return { kind: 'wrong', a, zone: z, inScope };
    }
    const prev = INV.line(countId, a.id);
    INV.mark(countId, a.id, { result: prev && prev.result === 'DAMAGED' ? 'DAMAGED' : 'FOUND', note: inScope ? (prev && prev.note) || '' : 'Ngoài phạm vi kiểm kê' });
    return { kind: prev ? 'again' : 'ok', a, inScope };
  };

  INV.summary = (c) => {
    const lines = INV.lines(c.id);
    const by = {};
    Object.keys(INV.RESULTS).forEach((k) => (by[k] = 0));
    lines.forEach((l) => (by[l.result] = (by[l.result] || 0) + 1));
    const checked = new Set(lines.filter((l) => l.assetId && !l.assetId.startsWith('X__')).map((l) => l.assetId));
    const expected = c.expected || [];
    const unchecked = expected.filter((id) => !checked.has(id));
    const ym = FIN.ymOf(c.date);
    const nbv = (id) => { const a = S.asset(id); return a && FIN.has(a) ? FIN.stateAt(a, ym).nbv || 0 : 0; };
    const missingIds = lines.filter((l) => l.result === 'MISSING').map((l) => l.assetId);
    return {
      lines, by, expected: expected.length, checkedInScope: expected.filter((id) => checked.has(id)).length, unchecked,
      missingValue: missingIds.reduce((s, id) => s + nbv(id), 0) + (c.status === 'OPEN' ? 0 : 0),
      uncheckedValue: unchecked.reduce((s, id) => s + nbv(id), 0),
      damagedValue: lines.filter((l) => l.result === 'DAMAGED').reduce((s, l) => s + nbv(l.assetId), 0),
    };
  };

  INV.close = (countId, { applyMoves, markDamaged }) => {
    const c = INV.count(countId);
    if (!c || c.status !== 'OPEN') return;
    const sm = INV.summary(c);
    sm.unchecked.forEach((id) => INV.mark(countId, id, { result: 'MISSING', note: 'Không được kiểm khi kết thúc đợt' }, { silent: true }));
    let moved = 0, damaged = 0;
    INV.lines(countId).forEach((l) => {
      const a = l.assetId && S.asset(l.assetId);
      if (!a) return;
      if (applyMoves && l.result === 'WRONG_LOC' && l.foundZoneId) {
        const z = S.zone(l.foundZoneId);
        const cur = S.location(a.id);
        if (z && cur && cur.zoneId !== z.id) {
          S.moveAsset(a.id, { floorId: z.floorId, zoneId: z.id, x: U.round1(z.x + z.w / 2), y: U.round1(z.y + z.h / 2) }, { by: S.currentUser(), reason: `Kiểm kê ${c.code}: cập nhật vị trí theo thực tế (tâm khu vực, cần chỉnh lại điểm chính xác)`, silent: true });
          moved++;
        }
      }
      if (markDamaged && l.result === 'DAMAGED' && a.status !== 'OOS' && S.statuses().some((s) => s.id === 'OOS')) { a.status = 'OOS'; a.updatedAt = U.nowIso(); damaged++; }
    });
    Object.assign(c, { status: 'CLOSED', closedAt: U.nowIso(), closedBy: S.currentUser(), applied: { moved, damaged } });
    if (INV.active() && INV.active().id === countId) INV.setActive('');
    S.commitExt('inventory');
    return { moved, damaged, missing: sm.unchecked.length };
  };
  INV.remove = (countId) => {
    db().counts = db().counts.filter((c) => c.id !== countId);
    db().countLines = db().countLines.filter((l) => l.countId !== countId);
    S.commitExt('inventory');
  };

  INV.seedDemo = (out, d) => {
    (d.counts || []).forEach((src) => {
      const { results, ...c } = src;
      c.expected = INV.scopeAssets(c.floorIds, c.zoneIds, c.date);
      c.createdBy = 'Kế toán TSCĐ'; c.createdAt = c.date + 'T07:00:00.000Z';
      if (c.status === 'CLOSED') { c.closedAt = c.date + 'T16:00:00.000Z'; c.closedBy = 'Kế toán TSCĐ'; c.applied = { moved: 0, damaged: 0 }; }
      out.counts.push(c);
      const ids = c.status === 'CLOSED' ? c.expected : Object.keys(results || {});
      ids.forEach((id, i) => {
        const r = (results || {})[id] || {};
        const z = r.foundZoneId && (out.zones.find((x) => x.id === r.foundZoneId));
        out.countLines.push({ id: `${c.id}__${id}`, countId: c.id, assetId: id, result: r.result || 'FOUND', note: r.note || '', ...(z ? { foundZoneId: z.id, foundFloorId: z.floorId } : {}), by: 'Giám sát kho', at: `${c.date}T${String(8 + Math.floor(i / 6)).padStart(2, '0')}:${String((i * 7) % 60).padStart(2, '0')}:00.000Z` });
      });
    });
  };

  /* ======================= VIEW ======================= */
  const st = { countId: null, filter: '', q: '', zoneId: '', last: null };
  let stream = null, timer = null;
  const badge = (r) => { const x = INV.RESULTS[r]; return x ? `<span class="badge" style="--c:${x.color}"><i></i>${x.short}</span>` : '<span class="badge" style="--c:#94a3b8"><i></i>Chưa kiểm</span>'; };
  const scopeText = (c) => [c.floorIds && c.floorIds.length ? c.floorIds.map((f) => (S.floor(f) || { code: f }).code).join(', ') : 'Toàn nhà máy', c.zoneIds && c.zoneIds.length ? c.zoneIds.map((z) => (S.zone(z) || { code: z }).code).join(', ') : ''].filter(Boolean).join(' · ');
  const m = FIN.fmt;

  V.show = (params = {}) => {
    if (params.id) st.countId = params.id;
    if (params.id === '') st.countId = null;
    const root = U.$('#view-inventory');
    if (st.countId && !INV.count(st.countId)) st.countId = null;
    if (params.scan && st.countId) {
      const res = INV.scan(st.countId, params.scan, st.zoneId);
      st.last = res;
      history.replaceState(null, '', '#/inventory?id=' + encodeURIComponent(st.countId));
    }
    st.countId ? renderDetail(root) : renderList(root);
  };
  V.refresh = () => { if (!U.$('#view-inventory').hidden) V.show(); };
  V.hide = stopCamera;

  function renderList(root) {
    const list = INV.counts();
    const act = INV.active();
    root.innerHTML = `<div class="view-head"><h2>Kiểm kê tài sản</h2><button class="btn btn-primary" id="ivNew">${U.icon('plus', 16)}Tạo đợt kiểm kê</button>
      <div class="sub">Quét mã QR trên tài sản để đối chiếu sổ sách với thực tế. Kết quả gồm tài sản đúng vị trí, sai vị trí, hư hỏng, không tìm thấy và tài sản thừa, kèm giá trị còn lại theo sổ kế toán.</div></div>
      ${act ? `<div class="callout" style="margin-bottom:14px">${U.icon('qr', 16)}<div>Đợt đang quét trên máy này: <b>${U.esc(act.code)} – ${U.esc(act.name)}</b>. Quét nhãn QR bằng camera điện thoại sẽ ghi nhận thẳng vào đợt này.</div></div>` : ''}
      <div class="card"><div class="table-wrap">${list.length ? `<table class="tbl"><thead><tr><th>Mã đợt</th><th>Tên đợt kiểm kê</th><th>Ngày</th><th>Phạm vi</th><th style="min-width:180px">Tiến độ</th><th class="num">Không thấy</th><th class="num">Sai vị trí</th><th class="num">Hỏng</th><th class="num">Thừa</th><th>Trạng thái</th><th class="actions"></th></tr></thead><tbody>
        ${list.map((c) => { const s = INV.summary(c); const pct = s.expected ? Math.round((s.checkedInScope / s.expected) * 100) : 0; return `<tr data-id="${c.id}" style="cursor:pointer">
          <td class="mono"><b>${U.esc(c.code)}</b></td><td>${U.esc(c.name)}</td><td class="nowrap">${U.fmtDate(c.date)}</td><td class="small">${U.esc(scopeText(c))}</td>
          <td><div class="progress"><span style="width:${pct}%;--c:var(--teal)"></span></div><div class="small muted">${s.checkedInScope}/${s.expected} (${pct}%)</div></td>
          <td class="num">${s.by.MISSING || (c.status === 'OPEN' ? '–' : 0)}</td><td class="num">${s.by.WRONG_LOC}</td><td class="num">${s.by.DAMAGED}</td><td class="num">${s.by.EXTRA}</td>
          <td>${c.status === 'OPEN' ? '<span class="badge" style="--c:#2563eb"><i></i>Đang kiểm</span>' : '<span class="badge" style="--c:#64748b"><i></i>Đã kết thúc</span>'}</td>
          <td class="actions"><button class="btn btn-sm" data-act="open">Mở</button>${c.status === 'OPEN' ? `<button class="icon-btn" data-act="del" title="Xoá đợt" style="color:var(--red)">${U.icon('trash', 16)}</button>` : ''}</td></tr>`; }).join('')}</tbody></table>`
        : UI.empty('Chưa có đợt kiểm kê. Bấm "Tạo đợt kiểm kê" để bắt đầu.', 'qr')}</div></div>`;
    U.$('#ivNew').addEventListener('click', newCountForm);
    const tw = root.querySelector('.table-wrap');
    tw.addEventListener('click', async (e) => {
      const tr = e.target.closest('tr[data-id]'); if (!tr) return;
      const b = e.target.closest('[data-act]');
      if (b && b.dataset.act === 'del') {
        const c = INV.count(tr.dataset.id);
        if (await UI.confirm(`Xoá đợt kiểm kê <b>${U.esc(c.code)}</b> và toàn bộ kết quả đã ghi nhận?`, { danger: true, okLabel: 'Xoá đợt' })) { INV.remove(c.id); UI.toast('Đã xoá đợt kiểm kê.', 'success'); }
        return;
      }
      F.app.go('inventory', { id: tr.dataset.id });
    });
  }

  function newCountForm() {
    const today = new Date().toISOString().slice(0, 10);
    const form = U.h(`<form class="form-grid">
      <div class="field full"><label>Tên đợt kiểm kê <span class="req">*</span></label><input name="name" value="Kiểm kê tài sản ${today.slice(5, 7)}/${today.slice(0, 4)}"></div>
      <div class="field"><label>Ngày kiểm kê <span class="req">*</span></label><input name="date" type="date" value="${today}"></div>
      <div class="field"><label>Ban kiểm kê</label><input name="members" placeholder="VD: Kế toán TSCĐ; Thủ kho; Kỹ thuật"></div>
      <div class="field full"><span class="lbl">Phạm vi – tầng (bỏ trống = toàn nhà máy)</span><div class="btn-row">${S.floors().map((f) => `<label class="check"><input type="checkbox" name="fl_${f.id}"> ${U.esc(f.code)} – ${U.esc(f.name)}</label>`).join('')}</div></div>
      <div class="field full"><span class="lbl">Giới hạn khu vực (tuỳ chọn)</span><div class="btn-row">${S.zones().map((z) => `<label class="check"><input type="checkbox" name="zn_${z.id}"> ${U.esc((S.floor(z.floorId) || {}).code)}/${U.esc(z.code)} ${U.esc(z.name)}</label>`).join('')}</div></div>
      <div class="full small muted" id="nvCount"></div></form>`);
    const read = () => { const d = UI.formData(form); return { ...d, floorIds: S.floors().filter((f) => d['fl_' + f.id]).map((f) => f.id), zoneIds: S.zones().filter((z) => d['zn_' + z.id]).map((z) => z.id) }; };
    const upd = () => { const d = read(); U.$('#nvCount', form).textContent = `Số tài sản cần kiểm theo sổ: ${INV.scopeAssets(d.floorIds, d.zoneIds).length} (không tính tài sản đã ghi giảm).`; };
    form.addEventListener('change', upd); upd();
    UI.modal({ title: 'Tạo đợt kiểm kê', body: form, actions: [{ label: 'Hủy' }, { label: 'Tạo đợt', primary: true, onClick: () => {
      try { const c = INV.create(read()); INV.setActive(c.id); UI.toast(`Đã tạo ${c.code}.`, 'success'); setTimeout(() => F.app.go('inventory', { id: c.id }), 0); }
      catch (e) { UI.toast(e.message, 'error'); return false; }
    } }] });
  }

  function renderDetail(root) {
    const c = INV.count(st.countId);
    const s = INV.summary(c);
    const open = c.status === 'OPEN';
    const act = INV.active();
    const pct = s.expected ? Math.round((s.checkedInScope / s.expected) * 100) : 0;
    const lineOf = {}; s.lines.forEach((l) => (lineOf[l.assetId] = l));
    const extra = s.lines.filter((l) => l.result === 'EXTRA' || (l.assetId && !l.assetId.startsWith('X__') && !(c.expected || []).includes(l.assetId)));
    const ids = [...(c.expected || []), ...extra.map((l) => l.assetId).filter((id) => !(c.expected || []).includes(id))];
    const q = st.q.trim().toLowerCase();
    const rows = ids.map((id) => ({ id, a: S.asset(id), l: lineOf[id], loc: S.view(id) })).filter((r) =>
      (!st.filter || (st.filter === 'NONE' ? !r.l : r.l && r.l.result === st.filter)) &&
      (!q || [r.id, r.a && r.a.name, r.l && r.l.code].some((x) => String(x || '').toLowerCase().includes(q))));
    const ym = FIN.ymOf(c.date);
    const last = st.last;
    root.innerHTML = `<div class="view-head"><button class="btn btn-sm" id="ivBack">← Danh sách đợt</button><h2>${U.esc(c.code)} – ${U.esc(c.name)}</h2>
        ${open ? '<span class="badge" style="--c:#2563eb"><i></i>Đang kiểm</span>' : '<span class="badge" style="--c:#64748b"><i></i>Đã kết thúc</span>'}
        <div class="sub">Ngày ${U.fmtDate(c.date)} · Phạm vi: ${U.esc(scopeText(c))} · Ban kiểm kê: ${U.esc(c.members || '—')}${c.closedAt ? ` · Kết thúc ${U.fmtDateTime(c.closedAt)} bởi ${U.esc(c.closedBy)}${c.applied ? ` (cập nhật ${c.applied.moved} vị trí, ${c.applied.damaged} tài sản hỏng)` : ''}` : ''}</div></div>
      <div class="stat-row">
        <div class="card stat"><div class="l">Tiến độ</div><div class="v">${s.checkedInScope}/${s.expected}</div><div class="progress" style="margin-top:6px"><span style="width:${pct}%;--c:var(--teal)"></span></div></div>
        ${['FOUND', 'WRONG_LOC', 'DAMAGED', 'MISSING', 'EXTRA'].map((k) => `<div class="card stat" data-f="${k}" style="cursor:pointer"><div class="l"><i class="dot" style="--c:${INV.RESULTS[k].color}"></i> ${INV.RESULTS[k].name}</div><div class="v">${s.by[k] || 0}</div></div>`).join('')}
        <div class="card stat"><div class="l">GTCL tài sản ${open ? 'chưa kiểm' : 'không tìm thấy'}</div><div class="v" style="color:var(--red)">${m(open ? s.uncheckedValue + s.missingValue : s.missingValue)}</div><div class="small muted">theo sổ cuối kỳ ${FIN.ymLabel(ym)}</div></div>
      </div>
      ${open ? `<div class="card" style="margin-bottom:14px"><div class="card-head"><h3>Quét mã</h3>
          <label class="check small"><input type="checkbox" id="ivActive" ${act && act.id === c.id ? 'checked' : ''}> Ghi nhận khi quét QR bằng camera điện thoại trên máy này</label></div>
        <div class="card-body">
          <form class="scan-box" id="ivScan" autocomplete="off">
            <select id="ivZone" title="Khu vực đang kiểm">${UI.options(S.zones().filter((z) => !c.floorIds.length || c.floorIds.includes(z.floorId)), st.zoneId, { empty: 'Khu vực đang kiểm: không chọn', label: (z) => `Đang ở: ${(S.floor(z.floorId) || {}).code}/${z.code} ${z.name}` })}</select>
            <input id="ivCode" placeholder="Quét QR / nhập Asset ID rồi Enter" autofocus>
            <button class="btn btn-primary">Ghi nhận</button>
            ${'BarcodeDetector' in window && navigator.mediaDevices ? `<button type="button" class="btn" id="ivCam">${U.icon('camera', 16)}<span>Camera</span></button>` : ''}
          </form>
          <div id="ivCamArea"></div>
          ${last ? `<div class="scan-last ${last.kind === 'extra' ? 'err' : last.kind === 'wrong' || last.inScope === false ? 'warn' : 'ok'}">${
            last.kind === 'extra' ? `<b>${U.esc(last.code)}</b>: không có trên sổ – ghi nhận là tài sản thừa.`
            : `<b>${U.esc(last.a.id)}</b> – ${U.esc(last.a.name)}: ${last.kind === 'wrong' ? `<b>sai vị trí</b> (sổ: ${U.esc(S.view(last.a.id).zoneName)}, thực tế: ${U.esc(last.zone.name)})` : last.kind === 'again' ? 'đã ghi nhận trước đó' : 'có, đúng vị trí'}${last.inScope === false ? ' · <b>ngoài phạm vi đợt kiểm kê</b>' : ''}`}</div>` : ''}
          <p class="small muted" style="margin-top:8px">Máy quét cầm tay (chế độ bàn phím): đặt con trỏ vào ô trên rồi quét liên tục. Điện thoại: bật tuỳ chọn "Ghi nhận khi quét QR…" rồi dùng ứng dụng camera quét nhãn — mỗi lần quét sẽ mở trang và ghi nhận vào đợt này. Chọn "Khu vực đang kiểm" để tự phát hiện tài sản sai vị trí.</p>
        </div></div>` : ''}
      <div class="card"><div class="toolbar">
          <div class="search">${U.icon('search', 16)}<input type="search" id="ivQ" placeholder="Tìm Asset ID, tên…" value="${U.esc(st.q)}"></div>
          <select id="ivFilter"><option value="">Tất cả (${ids.length})</option><option value="NONE" ${st.filter === 'NONE' ? 'selected' : ''}>Chưa kiểm (${s.unchecked.length})</option>${Object.entries(INV.RESULTS).map(([k, x]) => `<option value="${k}" ${st.filter === k ? 'selected' : ''}>${x.name} (${s.by[k] || 0})</option>`).join('')}</select>
          <span class="count">${rows.length} dòng</span>
          <button class="btn btn-sm" id="ivPrint">${U.icon('printer', 14)}Biên bản kiểm kê</button><button class="btn btn-sm" id="ivXlsx">${U.icon('download', 14)}Xuất Excel</button>
          ${open ? `<button class="btn btn-primary btn-sm" id="ivClose">${U.icon('check', 14)}Kết thúc kiểm kê</button>` : ''}</div>
        <div class="table-wrap" style="max-height:calc(100vh - 250px)">${rows.length ? `<table class="tbl" style="min-width:1040px"><thead><tr><th>Asset ID</th><th>Tên tài sản</th><th>Vị trí theo sổ</th><th>Kết quả</th><th>Vị trí thực tế</th><th>Ghi chú</th><th class="money">GTCL theo sổ</th><th>Người kiểm</th></tr></thead><tbody>
          ${rows.map((r) => { const l = r.l; const isX = r.id.startsWith('X__'); const nbv = r.a && FIN.has(r.a) ? FIN.stateAt(r.a, ym).nbv : null; return `<tr data-id="${U.esc(r.id)}">
            <td><span class="asset-id">${U.esc(isX ? (l && l.code) || r.id.slice(3) : r.id)}</span></td><td>${r.a ? U.esc(r.a.name) : '<i class="muted">Không có trên sổ</i>'}</td>
            <td class="small">${r.loc ? `${U.esc(r.loc.floorCode)} · ${U.esc(r.loc.zoneName)}` : '—'}</td>
            <td>${open && !isX ? `<div class="inv-result">${['FOUND', 'WRONG_LOC', 'DAMAGED', 'MISSING'].map((k) => `<button type="button" data-r="${k}" class="${l && l.result === k ? 'on' : ''}" style="--c:${INV.RESULTS[k].color}">${INV.RESULTS[k].short}</button>`).join('')}${l ? `<button type="button" data-r="" title="Bỏ ghi nhận">↺</button>` : ''}</div>` : badge(l && l.result)}</td>
            <td>${open && l && l.result === 'WRONG_LOC' ? `<select data-zone>${UI.options(S.zones(), l.foundZoneId, { empty: '— chọn khu vực —', label: (z) => `${(S.floor(z.floorId) || {}).code}/${z.code} ${z.name}` })}</select>` : l && l.foundZoneId ? U.esc((S.zone(l.foundZoneId) || {}).name || '') : ''}</td>
            <td>${open && l ? `<input data-note value="${U.esc(l.note || '')}" placeholder="Ghi chú" style="min-width:140px">` : U.esc((l && l.note) || '')}</td>
            <td class="money">${nbv === null ? '' : m(nbv)}</td><td class="small">${l ? `${U.esc(l.by || '')}<div class="muted">${U.fmtDateTime(l.at)}</div>` : ''}</td></tr>`; }).join('')}</tbody></table>` : UI.empty('Không có dòng phù hợp.')}</div></div>`;

    U.$('#ivBack').addEventListener('click', () => { st.countId = null; st.last = null; F.app.go('inventory', { id: '' }); });
    U.$$('[data-f]', root).forEach((x) => x.addEventListener('click', () => { st.filter = st.filter === x.dataset.f ? '' : x.dataset.f; renderDetail(root); }));
    U.$('#ivQ').addEventListener('input', U.debounce((e) => { st.q = e.target.value; renderDetail(root); const i = U.$('#ivQ'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }, 250));
    U.$('#ivFilter').addEventListener('change', (e) => { st.filter = e.target.value; renderDetail(root); });
    U.$('#ivPrint').addEventListener('click', () => printReport(c));
    U.$('#ivXlsx').addEventListener('click', () => exportReport(c));
    if (open) {
      U.$('#ivActive').addEventListener('change', (e) => { INV.setActive(e.target.checked ? c.id : ''); UI.toast(e.target.checked ? 'Quét QR bằng camera điện thoại sẽ ghi nhận vào đợt này.' : 'Đã tắt ghi nhận tự động.', 'info'); });
      U.$('#ivZone').addEventListener('change', (e) => { st.zoneId = e.target.value; });
      U.$('#ivScan').addEventListener('submit', (e) => {
        e.preventDefault();
        const v = U.$('#ivCode').value;
        if (!v.trim()) return;
        try { st.last = INV.scan(c.id, v, st.zoneId); } catch (err) { UI.toast(err.message, 'error'); }
        renderDetail(root);
        const inp = U.$('#ivCode'); if (inp) inp.focus();
      });
      const cam = U.$('#ivCam'); if (cam) cam.addEventListener('click', () => toggleCamera(c.id));
      U.$('#ivClose').addEventListener('click', () => closeForm(c));
      const tb = root.querySelector('.card:last-child .table-wrap');
      tb.addEventListener('click', (e) => {
        const b = e.target.closest('[data-r]'); if (!b) return;
        const id = b.closest('tr').dataset.id;
        try {
          if (!b.dataset.r) INV.unmark(c.id, id);
          else INV.mark(c.id, id, { result: b.dataset.r, ...(b.dataset.r === 'WRONG_LOC' && st.zoneId ? { foundZoneId: st.zoneId, foundFloorId: (S.zone(st.zoneId) || {}).floorId } : {}) });
        } catch (err) { UI.toast(err.message, 'error'); }
      });
      tb.addEventListener('change', (e) => {
        const tr = e.target.closest('tr'); if (!tr) return;
        const l = INV.line(c.id, tr.dataset.id); if (!l) return;
        if (e.target.matches('[data-note]')) INV.mark(c.id, tr.dataset.id, { result: l.result, note: e.target.value, foundZoneId: l.foundZoneId, foundFloorId: l.foundFloorId });
        if (e.target.matches('[data-zone]')) { const z = S.zone(e.target.value); INV.mark(c.id, tr.dataset.id, { result: 'WRONG_LOC', note: l.note, foundZoneId: z ? z.id : undefined, foundFloorId: z ? z.floorId : undefined }); }
      });
    }
  }

  function closeForm(c) {
    const s = INV.summary(c);
    const form = U.h(`<form><p>Kết thúc <b>${U.esc(c.code)}</b>. ${s.unchecked.length ? `<b>${s.unchecked.length}</b> tài sản chưa kiểm sẽ được ghi nhận là <b>Không tìm thấy</b>.` : 'Đã kiểm đủ tài sản theo sổ.'}</p>
      <label class="check" style="margin:8px 0"><input type="checkbox" name="applyMoves" checked> Cập nhật vị trí ${s.by.WRONG_LOC} tài sản sai vị trí theo khu vực thực tế (ghi Lịch sử vị trí)</label>
      <label class="check"><input type="checkbox" name="markDamaged" checked> Chuyển ${s.by.DAMAGED} tài sản hư hỏng sang trạng thái "${U.esc(S.status('OOS').name)}"</label>
      <p class="small muted" style="margin-top:10px">Sau khi kết thúc, kết quả không sửa được nữa. Tài sản không tìm thấy cần được xử lý theo quy định (tìm lại, quy trách nhiệm hoặc ghi giảm trong tab Kế toán TSCĐ).</p></form>`);
    UI.modal({ title: 'Kết thúc kiểm kê', body: form, actions: [{ label: 'Hủy' }, { label: 'Kết thúc', primary: true, onClick: () => {
      const d = UI.formData(form);
      const r = INV.close(c.id, d);
      UI.toast(`Đã kết thúc ${c.code}: ${r.missing} tài sản bổ sung "không tìm thấy", cập nhật ${r.moved} vị trí, ${r.damaged} tài sản hỏng.`, 'success', 6000);
    } }] });
  }

  function reportRows(c) {
    const ym = FIN.ymOf(c.date);
    const lines = INV.lines(c.id);
    const lineOf = {}; lines.forEach((l) => (lineOf[l.assetId] = l));
    const ids = [...(c.expected || []), ...lines.map((l) => l.assetId).filter((id) => !(c.expected || []).includes(id))];
    return ids.map((id) => {
      const a = S.asset(id), l = lineOf[id], v = S.view(id);
      const inBook = (c.expected || []).includes(id) || (!!a && !id.startsWith('X__'));
      const st0 = a && FIN.has(a) ? FIN.stateAt(a, ym) : { cost: 0, nbv: 0 };
      const actualQty = l && l.result !== 'MISSING' ? 1 : 0;
      const bookQty = inBook && a ? 1 : 0;
      return {
        id: id.startsWith('X__') ? (l && l.code) || id.slice(3) : id, accCode: a && a.fin ? a.fin.accCode || '' : '', name: a ? a.name : 'Không có trên sổ',
        dept: a ? (S.dept(a.departmentId) || {}).name || '' : '', loc: v ? `${v.floorCode}/${v.zoneCode}` : '',
        bookQty, bookCost: bookQty ? st0.cost || 0 : 0, bookNbv: bookQty ? st0.nbv || 0 : 0,
        actQty: actualQty, actCost: actualQty && a ? st0.cost || 0 : 0, actNbv: actualQty && a ? st0.nbv || 0 : 0,
        result: l ? INV.RESULTS[l.result].name : 'Chưa kiểm', note: [l && l.note, l && l.foundZoneId ? 'Thực tế: ' + ((S.zone(l.foundZoneId) || {}).name || '') : ''].filter(Boolean).join(' – '),
      };
    });
  }
  function exportReport(c) {
    const rows = reportRows(c);
    const head = ['STT', 'Asset ID', 'Mã TS (KT)', 'Tên tài sản', 'Bộ phận', 'Vị trí theo sổ', 'SL theo sổ', 'Nguyên giá theo sổ', 'GTCL theo sổ', 'SL kiểm kê', 'Nguyên giá kiểm kê', 'GTCL kiểm kê', 'Chênh lệch SL', 'Chênh lệch nguyên giá', 'Chênh lệch GTCL', 'Kết quả', 'Ghi chú'];
    const data = rows.map((r, i) => [i + 1, r.id, r.accCode, r.name, r.dept, r.loc, r.bookQty, r.bookCost, r.bookNbv, r.actQty, r.actCost, r.actNbv, r.actQty - r.bookQty, r.actCost - r.bookCost, r.actNbv - r.bookNbv, r.result, r.note]);
    F.io.downloadXLSX([{ name: 'Kiểm kê', rows: [[`Biên bản kiểm kê ${c.code} – ${c.name} – ngày ${U.fmtDate(c.date)}`], head, ...data], widths: [5, 14, 12, 32, 20, 10, 8, 16, 16, 8, 16, 16, 8, 16, 16, 20, 36] }], `kiem-ke-${c.code}.xlsx`);
  }
  function printReport(c) {
    const rows = reportRows(c);
    const t = rows.reduce((s, r) => { ['bookQty', 'bookCost', 'bookNbv', 'actQty', 'actCost', 'actNbv'].forEach((k) => (s[k] += r[k])); return s; }, { bookQty: 0, bookCost: 0, bookNbv: 0, actQty: 0, actCost: 0, actNbv: 0 });
    P.doc(`${P.header('Kế toán')}${P.title('Biên bản kiểm kê tài sản cố định', `Thời điểm kiểm kê: ${P.dateWords(c.date)} – Số: ${U.esc(c.code)}`)}
      <p>Ban kiểm kê gồm: ${U.esc(c.members || '……………………………………')}</p><p>Phạm vi: ${U.esc(scopeText(c))}. Đã kiểm kê tài sản, kết quả như sau:</p>
      <table class="grid"><tr><th rowspan="2">STT</th><th rowspan="2">Mã TS</th><th rowspan="2">Tên tài sản</th><th rowspan="2">Nơi sử dụng</th><th colspan="3">Theo sổ kế toán</th><th colspan="3">Theo kiểm kê</th><th colspan="3">Chênh lệch</th><th rowspan="2">Ghi chú</th></tr>
      <tr><th>SL</th><th>Nguyên giá</th><th>GTCL</th><th>SL</th><th>Nguyên giá</th><th>GTCL</th><th>SL</th><th>Nguyên giá</th><th>GTCL</th></tr>
      ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${U.esc(r.accCode || r.id)}</td><td>${U.esc(r.name)}</td><td>${U.esc(r.dept)} ${U.esc(r.loc)}</td><td class="r">${r.bookQty}</td><td class="r">${P.money(r.bookCost)}</td><td class="r">${P.money(r.bookNbv)}</td><td class="r">${r.actQty}</td><td class="r">${P.money(r.actCost)}</td><td class="r">${P.money(r.actNbv)}</td><td class="r">${r.actQty - r.bookQty || ''}</td><td class="r">${P.money(r.actCost - r.bookCost) === '0' ? '' : P.money(r.actCost - r.bookCost)}</td><td class="r">${P.money(r.actNbv - r.bookNbv) === '0' ? '' : P.money(r.actNbv - r.bookNbv)}</td><td>${U.esc(r.result)}${r.note ? ' – ' + U.esc(r.note) : ''}</td></tr>`).join('')}
      <tr class="t"><td colspan="4">Cộng</td><td class="r">${t.bookQty}</td><td class="r">${P.money(t.bookCost)}</td><td class="r">${P.money(t.bookNbv)}</td><td class="r">${t.actQty}</td><td class="r">${P.money(t.actCost)}</td><td class="r">${P.money(t.actNbv)}</td><td class="r">${t.actQty - t.bookQty}</td><td class="r">${P.money(t.actCost - t.bookCost)}</td><td class="r">${P.money(t.actNbv - t.bookNbv)}</td><td></td></tr></table>
      <p>Ý kiến giải quyết số chênh lệch: ………………………………………………………………………………</p>
      ${P.signs(['Thủ trưởng đơn vị', 'Kế toán trưởng', 'Trưởng ban kiểm kê'], c.date)}`, { landscape: true });
  }

  // Camera trong hộp thoại riêng để không bị gián đoạn khi danh sách cập nhật sau mỗi lần quét
  async function toggleCamera(countId) {
    if (stream) return stopCamera();
    const box = U.h('<div><video class="scan-video" playsinline muted></video><div class="scan-last" id="camLast">Hướng camera vào nhãn QR…</div></div>');
    const md = UI.modal({ title: 'Quét QR bằng camera', body: box, onClose: stopCamera });
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = U.$('video', box);
      video.srcObject = stream;
      await video.play();
      const det = new window.BarcodeDetector({ formats: ['qr_code'] });
      let lastCode = '', lastAt = 0;
      timer = setInterval(async () => {
        try {
          const codes = await det.detect(video);
          if (!codes.length) return;
          const v = codes[0].rawValue;
          if (v === lastCode && Date.now() - lastAt < 3000) return; // tránh ghi trùng liên tục
          lastCode = v; lastAt = Date.now();
          const r = INV.scan(countId, v, st.zoneId);
          st.last = r;
          const el = U.$('#camLast', box);
          el.className = 'scan-last ' + (r.kind === 'extra' ? 'err' : r.kind === 'wrong' ? 'warn' : 'ok');
          el.textContent = r.kind === 'extra' ? `${r.code}: không có trên sổ (thừa)` : `${r.a.id} – ${r.a.name}: ${r.kind === 'wrong' ? 'sai vị trí' : r.kind === 'again' ? 'đã ghi nhận trước đó' : 'đã ghi nhận'}`;
          if (navigator.vibrate) navigator.vibrate(80);
        } catch (e) { /* bỏ qua khung hình lỗi */ }
      }, 400);
    } catch (e) {
      U.$('#camLast', box).textContent = 'Không mở được camera: ' + e.message;
      stream = null;
      setTimeout(() => md.close(), 4000);
    }
  }
  function stopCamera() {
    clearInterval(timer);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
})(window.FAM);
