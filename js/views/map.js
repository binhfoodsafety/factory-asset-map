/* Factory Asset Map — TAB 02 Interactive factory map (SVG floor plan, markers, zoom/pan, move & draw modes). */
window.FAM = window.FAM || {};
(function (F) {
  'use strict';
  const U = F.util, S = F.store, UI = F.ui;
  F.views = F.views || {};
  const M = (F.views.map = {});

  let root, svg, gPlan, gZones, gMarkers, gOverlay, stage, body, detailEl, readout, banner, infoEl, legendEl;
  let built = false;
  const st = {
    floorId: null,
    planKey: '',
    selected: null,
    W: 1000, H: 600,
    vb: { x: 0, y: 0, w: 1000, h: 600 },
    filters: { zone: '', dept: '', cats: null, statuses: null },
    mode: null, // {type:'place', assetId} | {type:'draw', cb, start, rect}
    highlightZone: null,
  };

  /* ---------------- build ---------------- */
  function build() {
    root = U.$('#view-map');
    root.innerHTML = `
      <div class="map-top">
        <button class="btn btn-sm filters-toggle" id="mapFiltersBtn">${U.icon('filter', 16)}<span>Bộ lọc</span></button>
        <form class="search" id="mapSearchForm" autocomplete="off">${U.icon('search', 16)}
          <input id="mapSearch" type="search" list="assetIdList" placeholder="Asset ID hoặc tên, rồi nhấn Enter" aria-label="Tìm tài sản trên sơ đồ">
        </form>
        <div class="floor-tabs" id="floorTabs" role="tablist" aria-label="Tầng"></div>
        <span class="muted small" id="mapCount"></span>
      </div>
      <div class="map-body" id="mapBody">
        <aside class="map-filters" id="mapFilters" aria-label="Bộ lọc sơ đồ"></aside>
        <div class="map-stage" id="mapStage">
          <svg class="map-svg" id="mapSvg" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mặt bằng nhà máy">
            <g id="lyPlan"><image id="planImg" x="0" y="0" preserveAspectRatio="none"/></g>
            <g id="lyZones"></g>
            <g id="lyMarkers"></g>
            <g id="lyOverlay"></g>
          </svg>
          <div class="map-info" id="mapInfo"></div>
          <div class="map-ctrls">
            <button data-z="in" title="Phóng to">${U.icon('zoomIn')}</button>
            <button data-z="out" title="Thu nhỏ">${U.icon('zoomOut')}</button>
            <button data-z="fit" title="Vừa màn hình">${U.icon('fit')}</button>
            <button data-z="legend" title="Hiện / ẩn chú giải">${U.icon('info')}</button>
          </div>
          <div class="map-readout" id="mapReadout">X — · Y —</div>
          <div class="map-legend" id="mapLegend"></div>
          <div class="map-mode-banner" id="mapBanner" hidden></div>
        </div>
        <aside class="detail" id="mapDetail" aria-label="Chi tiết tài sản"></aside>
      </div>`;
    svg = U.$('#mapSvg'); gPlan = U.$('#lyPlan'); gZones = U.$('#lyZones'); gMarkers = U.$('#lyMarkers'); gOverlay = U.$('#lyOverlay');
    stage = U.$('#mapStage'); body = U.$('#mapBody'); detailEl = U.$('#mapDetail'); readout = U.$('#mapReadout');
    banner = U.$('#mapBanner'); infoEl = U.$('#mapInfo'); legendEl = U.$('#mapLegend');

    U.$('#mapFiltersBtn').addEventListener('click', () => body.classList.toggle('filters-open'));
    U.$('#mapSearchForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const q = U.$('#mapSearch').value.trim();
      if (!q) return;
      const a = M.findAsset(q);
      if (a) M.locate(a.id);
      else UI.toast(`Không tìm thấy tài sản "${q}"`, 'error');
    });
    U.$$('.map-ctrls button', root).forEach((b) =>
      b.addEventListener('click', () => {
        const z = b.dataset.z;
        if (z === 'in') zoomBy(1.5);
        else if (z === 'out') zoomBy(1 / 1.5);
        else if (z === 'fit') fit(true);
        else if (z === 'legend') legendEl.classList.toggle('toggled');
      })
    );
    bindPointer();
    new ResizeObserver(() => updateScale()).observe(stage);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && st.mode && !U.$('.modal-backdrop')) cancelMode();
    });
    built = true;
  }

  /* ---------------- helpers ---------------- */
  M.findAsset = (q) => {
    const s = q.trim().toLowerCase();
    const list = S.assets();
    return list.find((a) => a.id.toLowerCase() === s) ||
      list.find((a) => a.id.toLowerCase().endsWith(s)) ||
      list.find((a) => a.name.toLowerCase() === s) ||
      list.find((a) => a.id.toLowerCase().includes(s) || a.name.toLowerCase().includes(s) || (a.serial || '').toLowerCase() === s);
  };
  const toUser = (cx, cy) => {
    const p = svg.createSVGPoint();
    p.x = cx; p.y = cy;
    const m = svg.getScreenCTM();
    return m ? p.matrixTransform(m.inverse()) : { x: 0, y: 0 };
  };
  const pxPerUnit = () => { const m = svg.getScreenCTM(); return m ? m.a : 1; };
  const toPct = (u) => ({ x: U.round1(U.clamp((u.x / st.W) * 100, 0, 100)), y: U.round1(U.clamp((u.y / st.H) * 100, 0, 100)) });
  const inPlan = (u) => u.x >= 0 && u.y >= 0 && u.x <= st.W && u.y <= st.H;

  function ensureFilters() {
    if (!st.filters.cats) st.filters.cats = new Set(S.categories().map((c) => c.id));
    if (!st.filters.statuses) st.filters.statuses = new Set(S.statuses().map((s) => s.id));
    // add newly created categories/statuses as visible
    S.categories().forEach((c) => { if (!st.filters._knownCats?.has(c.id)) st.filters.cats.add(c.id); });
    S.statuses().forEach((s) => { if (!st.filters._knownSt?.has(s.id)) st.filters.statuses.add(s.id); });
    st.filters._knownCats = new Set(S.categories().map((c) => c.id));
    st.filters._knownSt = new Set(S.statuses().map((s) => s.id));
  }
  function passes(v) {
    const f = st.filters;
    if (v.floorId !== st.floorId) return false;
    if (f.zone && v.zoneId !== f.zone) return false;
    if (f.dept && v.departmentId !== f.dept) return false;
    if (!f.cats.has(v.categoryId)) return false;
    if (!f.statuses.has(v.status)) return false;
    return true;
  }
  function resetFilters() {
    st.filters.zone = ''; st.filters.dept = '';
    st.filters.cats = new Set(S.categories().map((c) => c.id));
    st.filters.statuses = new Set(S.statuses().map((s) => s.id));
  }

  /* ---------------- rendering ---------------- */
  function render() {
    ensureFilters();
    const floors = S.floors();
    if (!st.floorId || !S.floor(st.floorId)) st.floorId = floors[0] && floors[0].id;
    if (st.filters.zone && (!S.zone(st.filters.zone) || S.zone(st.filters.zone).floorId !== st.floorId)) st.filters.zone = '';
    renderFloorTabs();
    renderPlan();
    renderZones();
    renderMarkers();
    renderFilters();
    renderLegend();
    renderDetail();
  }

  function renderFloorTabs() {
    const el = U.$('#floorTabs');
    el.innerHTML = S.floors().map((f) => {
      const n = S.raw().locations.filter((l) => l.floorId === f.id).length;
      return `<button role="tab" data-f="${U.esc(f.id)}" class="${f.id === st.floorId ? 'on' : ''}" title="${U.esc(f.name)}">${U.esc(f.code)} <span class="muted small">${U.esc(f.name.replace(/^(Floor|Tầng)\s*\d+\s*[–-]\s*/i, ''))}</span> <span class="chip">${n}</span></button>`;
    }).join('');
    U.$$('button', el).forEach((b) => b.addEventListener('click', () => M.setFloor(b.dataset.f)));
  }

  function renderPlan() {
    const floor = S.floor(st.floorId);
    const info = S.planInfo(floor);
    const key = st.floorId + '|' + info.w + 'x' + info.h + '|' + info.href.length;
    const img = U.$('#planImg');
    if (key !== st.planKey) {
      img.setAttribute('href', info.href);
      img.setAttribute('width', info.w);
      img.setAttribute('height', info.h);
      st.W = info.w; st.H = info.h;
      st.planKey = key;
      fit(false);
    }
    infoEl.innerHTML = `${U.esc(floor ? floor.name : '')} · <span title="Nguồn bản vẽ">${U.esc(info.label)}</span>${S.isDemo() ? ' · <b style="color:#b45309">tọa độ demo</b>' : ''}`;
  }

  function renderZones() {
    const showZones = S.settings().showZones !== false;
    gZones.style.display = showZones ? '' : 'none';
    gZones.innerHTML = S.zones(st.floorId).map((z) => {
      const x = (z.x / 100) * st.W, y = (z.y / 100) * st.H, w = (z.w / 100) * st.W, h = (z.h / 100) * st.H;
      const hl = st.highlightZone === z.id || st.filters.zone === z.id;
      return `<g class="zone-g ${hl ? 'hl' : ''}" data-zone="${U.esc(z.id)}">
        <rect class="zone-rect" x="${x}" y="${y}" width="${w}" height="${h}" fill="${z.color}" fill-opacity="${hl ? 0.16 : 0.07}" stroke="${z.color}"/>
        <g class="zone-lbl" data-x="${x}" data-y="${y}"><text class="zone-label" x="6" y="14" fill="${z.color}">${U.esc(z.code)} · ${U.esc(z.name)}</text></g>
      </g>`;
    }).join('');
    updateScale();
  }

  function renderMarkers() {
    const views = S.views();
    const visible = views.filter(passes);
    const sel = st.selected && views.find((v) => v.id === st.selected && v.floorId === st.floorId);
    if (sel && !visible.includes(sel)) visible.push(sel);
    // draw selected last so it sits on top
    visible.sort((a, b) => (a.id === st.selected) - (b.id === st.selected));
    gMarkers.innerHTML = visible.map((v) => {
      const px = (v.x / 100) * st.W, py = (v.y / 100) * st.H;
      return `<g class="mk ${v.id === st.selected ? 'sel' : ''}" data-id="${U.esc(v.id)}" data-px="${px}" data-py="${py}" tabindex="0" role="button" aria-label="${U.esc(v.id + ' ' + v.name)}">
        <circle class="mk-ring" r="11"/>
        <path class="mk-shape" d="${U.shapePath(v.categoryShape, 8)}" fill="${v.statusColor}"/>
        <text class="mk-label" x="13" y="4">${U.esc(v.id)}</text>
        <title>${U.esc(v.id)} — ${U.esc(v.name)}\n${U.esc(v.statusName)} · ${U.esc(v.locationCode)}</title>
      </g>`;
    }).join('');
    U.$$('.mk', gMarkers).forEach((g) => g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); M.select(g.dataset.id); } }));
    const onFloor = views.filter((v) => v.floorId === st.floorId).length;
    U.$('#mapCount').textContent = `Hiển thị ${visible.length}/${onFloor} tài sản trên tầng này`;
    updateScale();
  }

  function renderFilters() {
    const el = U.$('#mapFilters');
    const onFloor = S.views().filter((v) => v.floorId === st.floorId);
    const cnt = (fn) => onFloor.filter(fn).length;
    const s = S.settings();
    el.innerHTML = `
      <div class="grp"><h4>Khu vực</h4>
        <select id="fZone">${UI.options(S.zones(st.floorId), st.filters.zone, { empty: 'Tất cả khu vực trên tầng', label: (z) => `${z.code} – ${z.name}` })}</select></div>
      <div class="grp"><h4>Bộ phận quản lý</h4>
        <select id="fDept">${UI.options(S.departments(), st.filters.dept, { empty: 'Tất cả bộ phận', label: (d) => `${d.code} – ${d.name}` })}</select></div>
      <div class="grp"><h4>Nhóm tài sản</h4>
        ${S.categories().map((c) => `<label class="check"><span><input type="checkbox" data-cat="${U.esc(c.id)}" ${st.filters.cats.has(c.id) ? 'checked' : ''}>${U.shapeSvg(c.shape, '#64748b')}${U.esc(c.name)}</span><span class="count">${cnt((v) => v.categoryId === c.id)}</span></label>`).join('')}
      </div>
      <div class="grp"><h4>Trạng thái</h4>
        ${S.statuses().map((x) => `<label class="check"><span><input type="checkbox" data-st="${U.esc(x.id)}" ${st.filters.statuses.has(x.id) ? 'checked' : ''}><i class="dot" style="--c:${x.color}"></i>${U.esc(x.name)}</span><span class="count">${cnt((v) => v.status === x.id)}</span></label>`).join('')}
      </div>
      <div class="grp"><h4>Hiển thị</h4>
        <label class="check"><span><input type="checkbox" id="fShowZones" ${s.showZones !== false ? 'checked' : ''}>Ranh giới khu vực</span></label>
        <label class="check"><span><input type="checkbox" id="fShowLabels" ${s.showLabels !== false ? 'checked' : ''}>Nhãn Asset ID (khi phóng to)</span></label>
      </div>
      <button class="btn btn-sm" id="fReset">Xoá bộ lọc</button>`;
    U.$('#fZone', el).addEventListener('change', (e) => {
      st.filters.zone = e.target.value;
      renderZones(); renderMarkers(); renderFilters();
      if (st.filters.zone) M.zoomToZone(st.filters.zone);
    });
    U.$('#fDept', el).addEventListener('change', (e) => { st.filters.dept = e.target.value; renderMarkers(); });
    U.$$('[data-cat]', el).forEach((c) => c.addEventListener('change', () => { c.checked ? st.filters.cats.add(c.dataset.cat) : st.filters.cats.delete(c.dataset.cat); renderMarkers(); }));
    U.$$('[data-st]', el).forEach((c) => c.addEventListener('change', () => { c.checked ? st.filters.statuses.add(c.dataset.st) : st.filters.statuses.delete(c.dataset.st); renderMarkers(); }));
    U.$('#fShowZones', el).addEventListener('change', (e) => S.updateSettings({ showZones: e.target.checked }));
    U.$('#fShowLabels', el).addEventListener('change', (e) => S.updateSettings({ showLabels: e.target.checked }));
    U.$('#fReset', el).addEventListener('click', () => { resetFilters(); st.highlightZone = null; render(); });
  }

  function renderLegend() {
    legendEl.innerHTML = `
      <h5>Trạng thái</h5>
      ${S.statuses().map((s) => `<span class="row"><i class="dot" style="--c:${s.color}"></i>${U.esc(s.name)}</span>`).join('')}
      <span class="sep"></span><h5>Nhóm</h5>
      ${S.categories().map((c) => `<span class="row">${U.shapeSvg(c.shape, '#64748b', 13)}${U.esc(c.name)}</span>`).join('')}
      <span class="sep"></span>
      <span class="row"><svg width="14" height="14" viewBox="-10 -10 20 20"><circle r="7" fill="none" stroke="#1d63d8" stroke-width="3"/></svg>Đang chọn</span>
      <span class="row"><svg width="16" height="12"><rect x="1" y="1" width="14" height="10" fill="#2563eb" fill-opacity=".1" stroke="#2563eb" stroke-dasharray="3 2"/></svg>Khu vực</span>`;
  }

  function kv(label, val) { return `<div>${U.esc(label)}</div><div>${val}</div>`; }
  function renderDetail() {
    const v = st.selected && S.view(st.selected);
    if (!v) {
      body.classList.remove('detail-open');
      detailEl.innerHTML = `<div class="detail-empty">${U.icon('pin', 32)}<p><b>Chọn một tài sản</b></p><p class="small">Bấm vào điểm đánh dấu trên sơ đồ hoặc tìm Asset ID ở trên. Thông tin chi tiết, vị trí và lịch sử sẽ hiển thị tại đây.</p>
        <div class="callout" style="text-align:left;margin-top:14px">${U.icon('info', 16)}<div class="small">Tọa độ tính theo % bản vẽ: gốc ở <b>góc trên bên trái</b>, X → sang phải, Y ↓ xuống dưới. ${S.isDemo() ? 'Mọi vị trí hiển thị là <b>dữ liệu demo</b>.' : ''}</div></div></div>`;
      return;
    }
    const hist = S.history().filter((h) => h.assetId === v.id).slice(-4).reverse();
    detailEl.innerHTML = `
      <div class="detail-head">
        <div class="row1">
          <div style="flex:1;min-width:0">
            <span class="asset-id">${U.esc(v.id)}</span>
            <h3>${U.esc(v.name)}</h3>
            ${UI.statusBadge(v.status)} <span class="chip">${U.shapeSvg(v.categoryShape, '#64748b', 11)} ${U.esc(v.categoryName)}</span>
          </div>
          <button class="icon-btn close-detail" id="dClose" title="Đóng">${U.icon('x')}</button>
        </div>
      </div>
      <div class="detail-photo ${v.photo ? 'has' : ''}" ${v.photo ? `style="background-image:url('${U.esc(v.photo)}')"` : ''}>${v.photo ? '' : `<div style="text-align:center">${U.icon('image', 30)}<div class="small">Chưa có ảnh</div></div>`}</div>
      <div class="detail-actions">
        <button class="btn btn-sm btn-primary" id="dMove">${U.icon('move', 15)}Di chuyển</button>
        <button class="btn btn-sm" id="dEdit">${U.icon('edit', 15)}Sửa tài sản</button>
        <button class="btn btn-sm" id="dZoom">${U.icon('locate', 15)}Phóng tới</button>
        <button class="btn btn-sm" id="dQr">${U.icon('qr', 15)}Mã QR</button>
      </div>
      <div class="kv">
        <div class="kv-section">Thông tin nhận dạng</div>
        ${kv('Asset ID', `<span class="asset-id">${U.esc(v.id)}</span>`)}
        ${kv('Tên tài sản', U.esc(v.name))}
        ${kv('Nhóm tài sản', U.esc(v.categoryName))}
        ${kv('Trạng thái', UI.statusBadge(v.status))}
        <div class="kv-section">Vị trí</div>
        ${kv('Tầng', U.esc(v.floorName))}
        ${kv('Bộ phận (khu vực)', U.esc(v.areaDeptName))}
        ${kv('Khu vực', `${U.esc(v.zoneCode)} – ${U.esc(v.zoneName)}`)}
        ${kv('Location Code', `<span class="loc-code">${U.esc(v.locationCode)}</span>`)}
        ${kv('Tọa độ X', `${v.x} %`)}
        ${kv('Tọa độ Y', `${v.y} %`)}
        ${kv('Cập nhật vị trí', U.fmtDateTime(v.locationUpdatedAt))}
        <div class="kv-section">Thông số kỹ thuật</div>
        ${kv('Nhà sản xuất', U.esc(v.manufacturer || '—'))}
        ${kv('Model', U.esc(v.model || '—'))}
        ${kv('Serial Number', `<span class="mono">${U.esc(v.serial || '—')}</span>`)}
        ${kv('Kiểm định gần nhất', U.fmtDate(v.lastInspection))}
        ${kv('Bộ phận quản lý', U.esc(v.deptName))}
        ${kv('Ghi chú', U.esc(v.remarks || '—'))}
      </div>
      <div class="kv"><div class="kv-section">Lịch sử vị trí gần đây</div></div>
      <div class="mini-hist">
        ${hist.map((h) => `<div class="it"><div class="t">${U.fmtDateTime(h.at)} · <span class="tag-action tag-${h.action}">${h.action}</span> · ${U.esc(h.updatedBy)}</div>
          <div>${h.prev ? `<span class="loc-code">${U.esc(h.prev.code)}</span> → ` : ''}${h.next ? `<span class="loc-code">${U.esc(h.next.code)}</span>` : '<i>đã xoá</i>'}</div>
          <div class="muted small">${U.esc(h.reason)}</div></div>`).join('') || '<div class="muted small">Chưa có lịch sử.</div>'}
        <a href="#/history?asset=${encodeURIComponent(v.id)}" class="small">Xem toàn bộ lịch sử →</a>
      </div>`;
    U.$('#dClose', detailEl).addEventListener('click', () => { body.classList.remove('detail-open'); });
    U.$('#dMove', detailEl).addEventListener('click', () => M.startPlace(v.id));
    U.$('#dEdit', detailEl).addEventListener('click', () => F.views.assetForm.open(v.id));
    U.$('#dZoom', detailEl).addEventListener('click', () => M.locate(v.id));
    U.$('#dQr', detailEl).addEventListener('click', () => F.views.qr.showFor(v.id));
  }

  /* ---------------- view box / zoom / pan ---------------- */
  function applyVB() {
    const b = st.vb;
    svg.setAttribute('viewBox', `${b.x} ${b.y} ${b.w} ${b.h}`);
    updateScale();
  }
  function updateScale() {
    if (!svg) return;
    const ppu = pxPerUnit();
    if (!ppu) return;
    const k = 1 / ppu;
    const ms = (S.settings().markerScale || 1) * k;
    U.$$('.mk', gMarkers).forEach((g) => g.setAttribute('transform', `translate(${g.dataset.px} ${g.dataset.py}) scale(${ms})`));
    U.$$('.zone-lbl', gZones).forEach((g) => g.setAttribute('transform', `translate(${g.dataset.x} ${g.dataset.y}) scale(${k})`));
    U.$$('.ghost-pin', gOverlay).forEach((g) => g.setAttribute('transform', `translate(${g.dataset.px} ${g.dataset.py}) scale(${k})`));
    // zoom level relative to "fit": show labels when zoomed in
    const zoom = st.W / st.vb.w;
    svg.classList.toggle('labels-on', S.settings().showLabels !== false && zoom >= 1.6);
  }
  function fit(animate) {
    const pad = st.W * 0.02;
    const target = { x: -pad, y: -pad, w: st.W + pad * 2, h: st.H + pad * 2 };
    animate ? animateVB(target) : ((st.vb = target), applyVB());
  }
  function clampVB(b) {
    const minW = st.W / 14, maxW = st.W * 2.2;
    const k = U.clamp(b.w, minW, maxW) / b.w;
    const cx = b.x + b.w / 2, cy = b.y + b.h / 2;
    const w = b.w * k, h = b.h * k;
    return { x: cx - w / 2, y: cy - h / 2, w, h };
  }
  function zoomBy(f, center) {
    const b = st.vb;
    const c = center || { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    let w = b.w / f, h = b.h / f;
    const minW = st.W / 14, maxW = st.W * 2.2;
    if (w < minW) { h *= minW / w; w = minW; }
    if (w > maxW) { h *= maxW / w; w = maxW; }
    const kx = w / b.w;
    st.vb = { x: c.x - (c.x - b.x) * kx, y: c.y - (c.y - b.y) * kx, w, h };
    applyVB();
  }
  let anim = 0;
  function animateVB(target, ms = 380) {
    const from = { ...st.vb };
    target = clampVB(target);
    const t0 = performance.now();
    const id = ++anim;
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    const step = (now) => {
      if (id !== anim) return;
      const t = Math.min(1, (now - t0) / ms), e = ease(t);
      st.vb = { x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, w: from.w + (target.w - from.w) * e, h: from.h + (target.h - from.h) * e };
      applyVB();
      if (t < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  // aspect of the visible stage, so targets fill the screen nicely
  function stageAspect() { const r = stage.getBoundingClientRect(); return r.height ? r.width / r.height : st.W / st.H; }
  function centerOn(px, py, w) {
    const a = stageAspect();
    const h = w / a;
    // on phones the detail sheet covers the lower part of the map: keep the asset in the upper area
    const shift = window.innerWidth <= 720 && body.classList.contains('detail-open') ? h * 0.27 : 0;
    animateVB({ x: px - w / 2, y: py - h / 2 + shift, w, h });
  }

  /* ---------------- pointer handling ---------------- */
  function bindPointer() {
    const pts = new Map();
    let drag = null, pinch = null;
    svg.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      svg.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      anim++; // stop animations
      if (pts.size === 2) {
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), vb: { ...st.vb } };
        drag = null;
        return;
      }
      const target = e.target.closest && e.target.closest('.mk');
      drag = { sx: e.clientX, sy: e.clientY, vb: { ...st.vb }, ppu: pxPerUnit(), moved: false, target };
      if (st.mode && st.mode.type === 'draw') {
        const u = toUser(e.clientX, e.clientY);
        st.mode.start = { x: U.clamp(u.x, 0, st.W), y: U.clamp(u.y, 0, st.H) };
        drag.drawing = true;
      }
    });
    svg.addEventListener('pointermove', (e) => {
      const u = toUser(e.clientX, e.clientY);
      if (inPlan(u)) { const p = toPct(u); readout.textContent = `X ${p.x.toFixed(1)} % · Y ${p.y.toFixed(1)} %`; }
      else readout.textContent = 'X — · Y —';
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && pts.size >= 2) {
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const mid = toUser((a.x + b.x) / 2, (a.y + b.y) / 2);
        const f = d / pinch.d;
        pinch.d = d;
        zoomBy(f, mid);
        return;
      }
      if (!drag) return;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (Math.abs(dx) + Math.abs(dy) > 5) drag.moved = true;
      if (drag.drawing) {
        const s0 = st.mode.start, c = { x: U.clamp(u.x, 0, st.W), y: U.clamp(u.y, 0, st.H) };
        const r = { x: Math.min(s0.x, c.x), y: Math.min(s0.y, c.y), w: Math.abs(c.x - s0.x), h: Math.abs(c.y - s0.y) };
        st.mode.rect = r;
        gOverlay.innerHTML = `<rect class="draw-rect" x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}"/>`;
        return;
      }
      if (drag.moved) {
        svg.classList.add('panning');
        st.vb = { ...drag.vb, x: drag.vb.x - dx / drag.ppu, y: drag.vb.y - dy / drag.ppu };
        applyVB();
      }
    });
    const end = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId);
      svg.classList.remove('panning');
      if (pinch) { if (pts.size < 2) pinch = null; drag = null; return; }
      if (!drag) return;
      const d = drag; drag = null;
      if (e.type === 'pointercancel') return;
      if (d.drawing) { finishDraw(); return; }
      if (d.moved) return;
      // click
      if (st.mode && st.mode.type === 'place') {
        const u = toUser(e.clientX, e.clientY);
        if (!inPlan(u)) return UI.toast('Hãy bấm bên trong bản vẽ.', 'error');
        placeAt(toPct(u));
        return;
      }
      if (d.target) M.select(d.target.dataset.id);
    };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
    svg.addEventListener('pointerleave', () => { readout.textContent = 'X — · Y —'; });
    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const f = Math.pow(1.0015, -e.deltaY * (e.deltaMode === 1 ? 30 : 1));
      zoomBy(f, toUser(e.clientX, e.clientY));
    }, { passive: false });
  }

  /* ---------------- modes ---------------- */
  function showBanner(html) {
    banner.innerHTML = `${html}<button class="btn btn-sm" id="mbCancel">Hủy</button>`;
    banner.hidden = false;
    U.$('#mbCancel', banner).addEventListener('click', cancelMode);
  }
  function cancelMode() {
    const m = st.mode;
    st.mode = null;
    banner.hidden = true;
    gOverlay.innerHTML = '';
    stage.classList.remove('mode-place', 'mode-draw');
    if (m && m.type === 'draw' && m.cb) m.cb(null);
  }

  M.startPlace = (assetId) => {
    const v = S.view(assetId);
    if (!v) return;
    if (st.mode) cancelMode();
    st.mode = { type: 'place', assetId };
    stage.classList.add('mode-place');
    body.classList.remove('detail-open');
    showBanner(`${U.icon('move', 16)}<span>Bấm vào vị trí mới của <b>${U.esc(v.id)}</b>. Có thể đổi tầng trước nếu cần. Esc để hủy.</span>`);
  };

  function placeAt(p) {
    const m = st.mode;
    const zone = S.zoneAt(st.floorId, p.x, p.y);
    const px = (p.x / 100) * st.W, py = (p.y / 100) * st.H;
    gOverlay.innerHTML = `<g class="ghost-pin" data-px="${px}" data-py="${py}"><path d="M0 0c-6-8-10-12-10-18a10 10 0 1 1 20 0c0 6-4 10-10 18z" fill="#1d63d8" stroke="#fff" stroke-width="2"/><circle cy="-18" r="3.5" fill="#fff"/></g>`;
    updateScale();
    M.openMoveDialog(m.assetId, { floorId: st.floorId, zoneId: zone ? zone.id : '', x: p.x, y: p.y }, () => {
      st.mode = null; banner.hidden = true; gOverlay.innerHTML = ''; stage.classList.remove('mode-place');
    }, () => { gOverlay.innerHTML = ''; });
  }

  // Move dialog (also used from register "Move" action)
  M.openMoveDialog = (assetId, proposed, onDone, onCancel) => {
    const v = S.view(assetId);
    const form = U.h(`<form class="form-grid" autocomplete="off">
      <div class="full callout">${U.icon('info', 16)}<div>Hiện tại: <span class="loc-code">${U.esc(v.locationCode)}</span> (${U.esc(v.floorCode)} · ${U.esc(v.zoneName)} · X ${v.x} · Y ${v.y})</div></div>
      <div class="field"><label>Tầng <span class="req">*</span></label><select name="floorId">${UI.options(S.floors(), proposed.floorId, { label: (f) => `${f.code} – ${f.name}` })}</select></div>
      <div class="field"><label>Khu vực <span class="req">*</span></label><select name="zoneId"></select></div>
      <div class="field"><label>X (%) <span class="req">*</span></label><input name="x" type="number" step="0.1" min="0" max="100" value="${proposed.x}"></div>
      <div class="field"><label>Y (%) <span class="req">*</span></label><input name="y" type="number" step="0.1" min="0" max="100" value="${proposed.y}"></div>
      <div class="field full"><label>Location Code mới</label><input name="_code" readonly></div>
      <div class="field"><label>Người cập nhật <span class="req">*</span></label><input name="by" value="${U.esc(S.currentUser())}"></div>
      <div class="field"><label>Lý do thay đổi <span class="req">*</span></label><input name="reason" list="reasonList" placeholder="VD: Bố trí lại dây chuyền">
        <datalist id="reasonList"><option>Di dời</option><option>Bố trí lại dây chuyền</option><option>Đưa đi bảo trì</option><option>Nhận về sau bảo trì</option><option>Hiệu chỉnh vị trí đã ghi</option><option>Lưu kho tạm</option></datalist></div>
      <div class="full small muted" id="mvWarn"></div>
    </form>`);
    const fSel = U.$('[name=floorId]', form), zSel = U.$('[name=zoneId]', form);
    const fillZones = (sel) => { zSel.innerHTML = UI.options(S.zones(fSel.value), sel, { empty: '— chọn khu vực —', label: (z) => `${z.code} – ${z.name}` }); };
    const refresh = () => {
      const d = UI.formData(form);
      U.$('[name=_code]', form).value = S.locationCode({ floorId: d.floorId, zoneId: d.zoneId, x: U.num(d.x), y: U.num(d.y) });
      const z = S.zone(d.zoneId);
      const x = U.num(d.x), y = U.num(d.y);
      const w = U.$('#mvWarn', form);
      if (!d.zoneId) w.innerHTML = `<span style="color:var(--amber)">${U.icon('alert', 14)} Điểm này nằm ngoài mọi khu vực của tầng — hãy chọn khu vực thủ công.</span>`;
      else if (z && !(x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h)) w.innerHTML = `<span style="color:var(--amber)">${U.icon('alert', 14)} Lưu ý: X/Y nằm ngoài ranh giới khu vực ${U.esc(z.code)}.</span>`;
      else w.textContent = 'Khi lưu, hệ thống thêm một dòng vào Lịch sử vị trí. Asset ID không thay đổi.';
    };
    fillZones(proposed.zoneId);
    fSel.addEventListener('change', () => { const auto = S.zoneAt(fSel.value, U.num(U.$('[name=x]', form).value), U.num(U.$('[name=y]', form).value)); fillZones(auto ? auto.id : ''); refresh(); });
    ['x', 'y'].forEach((n) => U.$(`[name=${n}]`, form).addEventListener('input', () => {
      const d = UI.formData(form);
      const auto = S.settings().autoDetectZone !== false && S.zoneAt(d.floorId, U.num(d.x), U.num(d.y));
      if (auto) zSel.value = auto.id;
      refresh();
    }));
    zSel.addEventListener('change', refresh);
    refresh();
    let saved = false;
    UI.modal({
      title: `Di chuyển ${v.id} – ${v.name}`,
      body: form,
      actions: [
        { label: 'Hủy' },
        { label: 'Lưu vị trí mới', primary: true, icon: 'check', onClick: () => {
          const d = UI.formData(form);
          if (!String(d.by).trim()) { UI.showErrors(form, { by: 'Bắt buộc nhập người cập nhật' }); return false; }
          try {
            const changed = S.moveAsset(assetId, { floorId: d.floorId, zoneId: d.zoneId, x: U.num(d.x), y: U.num(d.y) }, { by: d.by.trim(), reason: d.reason });
            saved = true;
            UI.toast(changed ? `${assetId} đã chuyển → ${S.location(assetId).code}` : 'Vị trí không đổi — không ghi nhận.', changed ? 'success' : 'info');
            onDone && onDone();
            if (F.app.current() === 'map') { st.selected = assetId; if (d.floorId !== st.floorId) M.setFloor(d.floorId); render(); }
          } catch (e) {
            UI.showErrors(form, e.errors || {});
            if (!e.errors) UI.toast(e.message, 'error');
            return false;
          }
        } },
      ],
      onClose: () => { if (!saved) onCancel && onCancel(); },
    });
  };

  M.startDraw = (floorId, cb) => {
    F.app.go('map');
    if (st.mode) cancelMode();
    if (floorId && floorId !== st.floorId) M.setFloor(floorId);
    st.mode = { type: 'draw', cb };
    stage.classList.add('mode-draw');
    body.classList.remove('detail-open');
    fit(true);
    showBanner(`${U.icon('square', 16)}<span>Kéo một hình chữ nhật trên <b>${U.esc(S.floor(st.floorId).code)}</b> để xác định ranh giới khu vực.</span>`);
  };
  function finishDraw() {
    const m = st.mode;
    if (!m || !m.rect || m.rect.w < 3 || m.rect.h < 3) { gOverlay.innerHTML = ''; return UI.toast('Hãy kéo hình chữ nhật lớn hơn.', 'error'); }
    const r = m.rect;
    const pct = { x: U.round1((r.x / st.W) * 100), y: U.round1((r.y / st.H) * 100), w: U.round1((r.w / st.W) * 100), h: U.round1((r.h / st.H) * 100), floorId: st.floorId };
    st.mode = null;
    banner.hidden = true;
    stage.classList.remove('mode-draw');
    setTimeout(() => (gOverlay.innerHTML = ''), 600);
    m.cb && m.cb(pct);
  }

  /* ---------------- public API ---------------- */
  M.setFloor = (id) => {
    if (!S.floor(id)) return;
    st.floorId = id;
    st.filters.zone = '';
    st.highlightZone = null;
    render();
  };
  M.select = (id) => {
    st.selected = id;
    renderMarkers();
    renderDetail();
    body.classList.add('detail-open');
  };
  M.locate = (id) => {
    const v = S.view(id);
    if (!v) return UI.toast('Không tìm thấy tài sản: ' + id, 'error');
    if (F.app.current() !== 'map') { F.app.go('map', { asset: id }); return; }
    if (v.floorId !== st.floorId) { st.floorId = v.floorId; st.filters.zone = ''; }
    ensureFilters();
    if (!passes(v)) { resetFilters(); UI.toast('Đã xoá bộ lọc để hiển thị ' + id, 'info'); }
    st.selected = id;
    render();
    body.classList.add('detail-open');
    const px = (v.x / 100) * st.W, py = (v.y / 100) * st.H;
    requestAnimationFrame(() => centerOn(px, py, Math.min(st.vb.w, st.W / 2.2)));
  };
  M.zoomToZone = (zoneId) => {
    const z = S.zone(zoneId);
    if (!z) return;
    const pad = 4;
    const x = ((z.x - pad) / 100) * st.W, y = ((z.y - pad) / 100) * st.H, w = ((z.w + pad * 2) / 100) * st.W, h = ((z.h + pad * 2) / 100) * st.H;
    const a = stageAspect();
    const W = Math.max(w, h * a), H = W / a;
    animateVB({ x: x + w / 2 - W / 2, y: y + h / 2 - H / 2, w: W, h: H });
  };
  M.showZone = (zoneId) => {
    const z = S.zone(zoneId);
    if (!z) return;
    if (F.app.current() !== 'map') { F.app.go('map', { zone: zoneId }); return; }
    st.floorId = z.floorId;
    st.highlightZone = zoneId;
    render();
    requestAnimationFrame(() => M.zoomToZone(zoneId));
  };

  M.show = (params = {}) => {
    if (!built) build();
    render();
    requestAnimationFrame(updateScale);
    if (params.asset) setTimeout(() => M.locate(params.asset), 30);
    else if (params.zone) setTimeout(() => M.showZone(params.zone), 30);
  };
  M.refresh = () => { if (built) render(); };
  M.hide = () => {
    // leave any place/draw mode silently (no callbacks while navigating away)
    if (!st.mode) return;
    st.mode = null;
    banner.hidden = true;
    gOverlay.innerHTML = '';
    stage.classList.remove('mode-place', 'mode-draw');
  };
})(window.FAM);
