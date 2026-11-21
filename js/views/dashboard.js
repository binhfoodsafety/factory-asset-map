/* Factory Asset Map — TAB 01 Dashboard */
window.FAM = window.FAM || {};
(function (F) {
  'use strict';
  const U = F.util, S = F.store, UI = F.ui;
  F.views = F.views || {};
  const D = (F.views.dashboard = {});
  const PALETTE = ['#1d63d8', '#0d9488', '#7c3aed', '#ea580c', '#0891b2', '#ca8a04', '#db2777', '#475569'];

  function bars(items, { onClick } = {}) {
    const max = Math.max(1, ...items.map((i) => i.value));
    if (!items.length) return UI.empty('Chưa có dữ liệu');
    return `<div class="bars">${items.map((i, n) => `
      <div class="bar-row ${onClick ? 'clickable' : ''}" data-key="${U.esc(i.key || '')}" title="${U.esc(i.label)}: ${i.value}">
        <span class="lbl">${U.esc(i.label)}</span>
        <span class="bar-track">${i.segments
          ? i.segments.map((s) => `<span class="bar-fill" style="width:${(s.value / max) * 100}%;--c:${s.color}" title="${U.esc(s.label)}: ${s.value}"></span>`).join('')
          : `<span class="bar-fill" style="width:${(i.value / max) * 100}%;--c:${i.color || PALETTE[n % PALETTE.length]}"></span>`}</span>
        <span class="val">${i.value}</span>
      </div>`).join('')}</div>`;
  }

  function donut(parts, total) {
    const r = 42, c = 2 * Math.PI * r;
    let off = 0;
    const segs = parts.filter((p) => p.value > 0).map((p) => {
      const len = (p.value / Math.max(total, 1)) * c;
      const s = `<circle r="${r}" cx="60" cy="60" fill="none" stroke="${p.color}" stroke-width="16" stroke-dasharray="${len} ${c - len}" stroke-dashoffset="${-off}" transform="rotate(-90 60 60)"><title>${U.esc(p.label)}: ${p.value}</title></circle>`;
      off += len;
      return s;
    }).join('');
    return `<svg width="120" height="120" viewBox="0 0 120 120" role="img" aria-label="Phân bổ theo trạng thái">
      <circle r="${r}" cx="60" cy="60" fill="none" stroke="#eef2f7" stroke-width="16"/>${segs}
      <text x="60" y="58" text-anchor="middle" font-size="22" font-weight="650" fill="#0f172a">${total}</text>
      <text x="60" y="75" text-anchor="middle" font-size="10" fill="#64748b">tài sản</text></svg>`;
  }

  D.show = () => {
    const root = U.$('#view-dashboard');
    const views = S.views();
    const total = views.length;
    const by = (fn) => views.filter(fn).length;
    const statuses = S.statuses();
    const stCount = (id) => by((v) => v.status === id);
    const core = { ACTIVE: S.status('ACTIVE'), INSP: S.status('INSP'), OOS: S.status('OOS') };
    const zones = S.zones();
    const pct = (n) => (total ? Math.round((n / total) * 100) : 0);

    const catItems = S.categories().map((c, i) => ({ key: c.id, label: c.name, value: by((v) => v.categoryId === c.id), color: PALETTE[i % PALETTE.length] }));
    const deptItems = S.departments().map((d) => ({
      key: d.id, label: d.name, value: by((v) => v.departmentId === d.id),
      segments: statuses.map((s) => ({ label: s.name, color: s.color, value: by((v) => v.departmentId === d.id && v.status === s.id) })),
    })).filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
    const zoneItems = zones.map((z) => ({
      key: z.id, label: `${S.floor(z.floorId)?.code} · ${z.name}`, value: by((v) => v.zoneId === z.id),
      segments: statuses.map((s) => ({ label: s.name, color: s.color, value: by((v) => v.zoneId === z.id && v.status === s.id) })),
    })).sort((a, b) => b.value - a.value);
    const recent = views.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))).slice(0, 8);
    const moves = S.history().filter((h) => h.action === 'MOVE').slice().sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8);
    const statusLegend = `<div class="legend-inline">${statuses.map((s) => `<span><i class="dot" style="--c:${s.color}"></i>${U.esc(s.name)}</span>`).join('')}</div>`;

    root.innerHTML = `
      <div class="view-head"><h2>Dashboard – Tổng quan</h2><span class="muted small">${U.esc(S.factory().name)} · ${S.floors().length} tầng · cập nhật ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span></div>
      <div class="kpis">
        <div class="card kpi" style="--c:var(--primary)" data-go="register"><span class="kpi-label">${U.icon('box', 15)}Tổng tài sản</span><span class="kpi-value">${total}</span><span class="kpi-sub">${S.categories().length} nhóm tài sản</span></div>
        <div class="card kpi" style="--c:${core.ACTIVE.color}" data-go="register" data-status="ACTIVE"><span class="kpi-label"><i class="dot" style="--c:${core.ACTIVE.color}"></i>${U.esc(core.ACTIVE.name)}</span><span class="kpi-value">${stCount('ACTIVE')}</span><span class="kpi-sub">${pct(stCount('ACTIVE'))}% tổng tài sản</span></div>
        <div class="card kpi" style="--c:${core.INSP.color}" data-go="register" data-status="INSP"><span class="kpi-label"><i class="dot" style="--c:${core.INSP.color}"></i>${U.esc(core.INSP.name)}</span><span class="kpi-value">${stCount('INSP')}</span><span class="kpi-sub">${pct(stCount('INSP'))}% tổng tài sản</span></div>
        <div class="card kpi" style="--c:${core.OOS.color}" data-go="register" data-status="OOS"><span class="kpi-label"><i class="dot" style="--c:${core.OOS.color}"></i>${U.esc(core.OOS.name)}</span><span class="kpi-value">${stCount('OOS')}</span><span class="kpi-sub">${pct(stCount('OOS'))}% tổng tài sản</span></div>
        <div class="card kpi" style="--c:var(--navy-600)" data-go="zones"><span class="kpi-label">${U.icon('layers', 15)}Khu vực nhà máy</span><span class="kpi-value">${zones.length}</span><span class="kpi-sub">trên ${S.floors().length} tầng</span></div>
      </div>
      <div class="grid grid-3">
        <div class="card"><div class="card-head"><h3>Tài sản theo trạng thái</h3></div><div class="card-body donut-wrap">${donut(statuses.map((s) => ({ label: s.name, color: s.color, value: stCount(s.id) })), total)}
          <div class="bars" style="flex:1;min-width:150px">${statuses.map((s) => `<div class="bar-row" style="grid-template-columns:1fr 34px"><span class="lbl"><i class="dot" style="--c:${s.color}"></i> ${U.esc(s.name)}</span><span class="val">${stCount(s.id)}</span></div>`).join('')}</div></div></div>
        <div class="card"><div class="card-head"><h3>Tài sản theo nhóm</h3></div><div class="card-body" id="dbCat">${bars(catItems, { onClick: true })}</div></div>
        <div class="card"><div class="card-head"><h3>Tài sản theo bộ phận</h3><span class="muted small">bộ phận quản lý</span></div><div class="card-body" id="dbDept">${statusLegend}${bars(deptItems, { onClick: true })}</div></div>
      </div>
      <div class="grid grid-2" style="margin-top:16px">
        <div class="card"><div class="card-head"><h3>Tài sản theo khu vực</h3><span class="muted small">bấm vào khu vực để xem trên sơ đồ</span></div><div class="card-body" id="dbZone">${statusLegend}${bars(zoneItems, { onClick: true })}</div></div>
        <div class="card"><div class="card-head"><h3>Thay đổi vị trí gần đây</h3><a href="#/history" class="small">Toàn bộ lịch sử →</a></div>
          <div class="table-wrap">${moves.length ? `<table class="tbl"><thead><tr><th>Thời gian</th><th>Tài sản</th><th>Từ → Đến</th><th>Người cập nhật</th></tr></thead><tbody>
            ${moves.map((h) => `<tr><td class="nowrap small">${U.fmtDateTime(h.at)}</td><td><a href="#/map?asset=${encodeURIComponent(h.assetId)}" class="asset-id">${U.esc(h.assetId)}</a><div class="small muted">${U.esc(h.assetName)}</div></td>
              <td class="small">${U.esc(h.prev?.floorCode)}/${U.esc(h.prev?.zoneCode)} → <b>${U.esc(h.next?.floorCode)}/${U.esc(h.next?.zoneCode)}</b><div class="muted">${U.esc(h.reason)}</div></td><td class="small">${U.esc(h.updatedBy)}</td></tr>`).join('')}
            </tbody></table>` : UI.empty('Chưa có thay đổi vị trí.', 'history')}</div></div>
      </div>
      <div class="card" style="margin-top:16px"><div class="card-head"><h3>Tài sản cập nhật gần đây</h3><a href="#/register" class="small">Sổ tài sản →</a></div>
        <div class="table-wrap">${recent.length ? `<table class="tbl"><thead><tr><th>Asset ID</th><th>Tên tài sản</th><th>Trạng thái</th><th>Location Code</th><th>Cập nhật</th><th></th></tr></thead><tbody>
          ${recent.map((v) => `<tr><td><span class="asset-id">${U.esc(v.id)}</span></td><td>${U.esc(v.name)}</td><td>${UI.statusBadge(v.status)}</td><td><span class="loc-code">${U.esc(v.locationCode)}</span></td><td class="small nowrap">${U.fmtDateTime(v.updatedAt)}</td>
            <td class="actions"><a class="btn btn-sm" href="#/map?asset=${encodeURIComponent(v.id)}">${U.icon('locate', 14)}Định vị</a></td></tr>`).join('')}
          </tbody></table>` : UI.empty('Chưa có tài sản.')}</div></div>`;

    U.$$('[data-go]', root).forEach((k) => k.addEventListener('click', () => {
      if (k.dataset.go === 'register') F.views.register.setFilter({ status: k.dataset.status || '' });
      F.app.go(k.dataset.go);
    }));
    U.$$('#dbCat .bar-row', root).forEach((r) => r.addEventListener('click', () => { F.views.register.setFilter({ cat: r.dataset.key }); F.app.go('register'); }));
    U.$$('#dbDept .bar-row', root).forEach((r) => r.addEventListener('click', () => { F.views.register.setFilter({ dept: r.dataset.key }); F.app.go('register'); }));
    U.$$('#dbZone .bar-row', root).forEach((r) => r.addEventListener('click', () => F.views.map.showZone(r.dataset.key)));
  };
  D.refresh = D.show;
})(window.FAM);
