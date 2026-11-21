/* Factory Asset Map — TAB 04 Factory structure: Factory → Floor → Department → Zone → Asset */
window.FAM = window.FAM || {};
(function (F) {
  'use strict';
  const U = F.util, S = F.store, UI = F.ui;
  F.views = F.views || {};
  const Z = (F.views.zones = {});
  const ZONE_COLORS = ['#2563eb', '#7c3aed', '#0891b2', '#ea580c', '#16a34a', '#ca8a04', '#db2777', '#475569', '#b45309', '#0d9488'];

  const countIn = (zoneId) => S.raw().locations.filter((l) => l.zoneId === zoneId).length;

  function tree() {
    const fac = S.factory();
    return `<div class="tree"><ul><li><span class="node lvl-factory">${U.icon('box', 15)}${U.esc(fac.name)}</span>
      <ul>${S.floors().map((f) => {
        const zones = S.zones(f.id);
        const deptIds = [...new Set(zones.map((z) => z.departmentId))];
        return `<li><span class="node lvl-floor">${U.icon('layers', 14)}${U.esc(f.code)} – ${U.esc(f.name)} <span class="chip">${S.raw().locations.filter((l) => l.floorId === f.id).length}</span></span>
          <ul>${deptIds.map((did) => {
            const d = S.dept(did);
            return `<li><span class="node lvl-dept">${U.esc(d ? d.code + ' – ' + d.name : did)}</span>
              <ul>${zones.filter((z) => z.departmentId === did).map((z) => `<li><span class="node zone-link" data-zone="${U.esc(z.id)}" title="Xem trên sơ đồ"><i class="swatch" style="--c:${z.color}"></i>${U.esc(z.code)} – ${U.esc(z.name)} <span class="chip">${countIn(z.id)} tài sản</span></span></li>`).join('')}</ul></li>`;
          }).join('') || '<li class="muted small">Chưa có khu vực</li>'}</ul></li>`;
      }).join('')}</ul></li></ul></div>`;
  }

  Z.show = () => {
    const root = U.$('#view-zones');
    root.innerHTML = `
      <div class="view-head"><h2>Khu vực nhà máy</h2>
        <div class="btn-row"><button class="btn" id="znExport">${U.icon('download', 16)}Xuất CSV khu vực</button><button class="btn btn-primary" id="znAdd">${U.icon('plus', 16)}Thêm khu vực</button></div>
        <div class="sub">Phân cấp: Nhà máy → Tầng → Bộ phận → Khu vực → Tài sản. Ranh giới khu vực là hình chữ nhật tính theo % bản vẽ.</div></div>
      <div class="grid" style="grid-template-columns:minmax(260px,340px) minmax(0,1fr)" id="znGrid">
        <div class="card"><div class="card-head"><h3>Cơ cấu</h3></div><div class="card-body">${tree()}</div></div>
        <div class="grid">
          <div class="card"><div class="card-head"><h3>Danh sách khu vực</h3><span class="muted small">${S.zones().length} khu vực</span></div>
            <div class="table-wrap">${S.zones().length ? `<table class="tbl"><thead><tr><th>Mã</th><th>Khu vực</th><th>Tầng</th><th>Bộ phận</th><th class="num">Ranh giới X,Y,R,C (%)</th><th class="num">Tài sản</th><th class="actions"></th></tr></thead><tbody>
              ${S.zones().slice().sort((a, b) => (S.floor(a.floorId)?.level ?? 0) - (S.floor(b.floorId)?.level ?? 0) || a.code.localeCompare(b.code)).map((z) => `<tr data-id="${U.esc(z.id)}">
                <td><span class="node" style="display:inline-flex;gap:6px;align-items:center"><i class="swatch" style="--c:${z.color}"></i><b class="mono">${U.esc(z.code)}</b></span></td>
                <td>${U.esc(z.name)}</td><td>${U.esc(S.floor(z.floorId)?.code)}</td><td>${U.esc(S.dept(z.departmentId)?.name || '—')}</td>
                <td class="num mono small">${z.x}, ${z.y}, ${z.w}, ${z.h}</td><td class="num">${countIn(z.id)}</td>
                <td class="actions"><button class="btn btn-sm" data-act="map">${U.icon('map', 14)}Sơ đồ</button><button class="icon-btn" data-act="assets" title="Danh sách tài sản">${U.icon('list', 16)}</button><button class="icon-btn" data-act="edit" title="Sửa">${U.icon('edit', 16)}</button><button class="icon-btn" data-act="del" title="Xoá" style="color:var(--red)">${U.icon('trash', 16)}</button></td></tr>`).join('')}
              </tbody></table>` : UI.empty('Chưa có khu vực. Hãy thêm khu vực rồi vẽ ranh giới trên sơ đồ.', 'layers')}</div></div>

          <div class="card"><div class="card-head"><h3>Tầng &amp; bản vẽ mặt bằng</h3><button class="btn btn-sm" id="flAdd">${U.icon('plus', 14)}Thêm tầng</button></div>
            <div class="table-wrap"><table class="tbl"><thead><tr><th>Mã</th><th>Tên tầng</th><th class="num">Cao độ</th><th>Bản vẽ</th><th class="num">Khu vực</th><th class="num">Tài sản</th><th class="actions"></th></tr></thead><tbody>
              ${S.floors().map((f) => { const p = S.planInfo(f); return `<tr data-id="${U.esc(f.id)}"><td><b class="mono">${U.esc(f.code)}</b></td><td>${U.esc(f.name)}</td><td class="num">${f.level ?? ''}</td>
                <td class="small">${U.esc(p.label)} <span class="muted">(${Math.round(p.w)}×${Math.round(p.h)})</span></td><td class="num">${S.zones(f.id).length}</td><td class="num">${S.raw().locations.filter((l) => l.floorId === f.id).length}</td>
                <td class="actions"><button class="btn btn-sm" data-act="plan">${U.icon('upload', 14)}Nhập bản vẽ</button><button class="icon-btn" data-act="dlplan" title="Tải bản vẽ hiện tại">${U.icon('download', 16)}</button>${f.plan && f.plan.type !== 'builtin' && F.FLOORPLANS[f.id] ? `<button class="icon-btn" data-act="resetplan" title="Khôi phục bản vẽ mẫu">${U.icon('history', 16)}</button>` : ''}<button class="icon-btn" data-act="edit" title="Sửa">${U.icon('edit', 16)}</button><button class="icon-btn" data-act="del" title="Xoá" style="color:var(--red)">${U.icon('trash', 16)}</button></td></tr>`; }).join('')}
              </tbody></table></div>
            <div class="card-body small muted">Bản vẽ: ưu tiên SVG (sắc nét ở mọi mức phóng); chấp nhận PNG/JPG. Xem Cài đặt &amp; Hướng dẫn → Bản vẽ để chuyển đổi từ CAD/PDF.</div></div>

          <div class="card"><div class="card-head"><h3>Bộ phận</h3><button class="btn btn-sm" id="dpAdd">${U.icon('plus', 14)}Thêm bộ phận</button></div>
            <div class="table-wrap"><table class="tbl"><thead><tr><th>Mã</th><th>Tên bộ phận</th><th class="num">Khu vực</th><th class="num">Tài sản quản lý</th><th class="actions"></th></tr></thead><tbody>
              ${S.departments().map((d) => `<tr data-id="${U.esc(d.id)}"><td><b class="mono">${U.esc(d.code)}</b></td><td>${U.esc(d.name)}</td><td class="num">${S.zones().filter((z) => z.departmentId === d.id).length}</td><td class="num">${S.assets().filter((a) => a.departmentId === d.id).length}</td>
                <td class="actions"><button class="icon-btn" data-act="edit" title="Sửa">${U.icon('edit', 16)}</button><button class="icon-btn" data-act="del" title="Xoá" style="color:var(--red)">${U.icon('trash', 16)}</button></td></tr>`).join('')}
              </tbody></table></div></div>
        </div>
      </div>`;
    if (window.innerWidth < 1024) U.$('#znGrid', root).style.gridTemplateColumns = 'minmax(0,1fr)';

    U.$('#znAdd', root).addEventListener('click', () => Z.zoneForm(null));
    U.$('#znExport', root).addEventListener('click', () => F.io.downloadCSV(F.io.zoneRows(), `factory-zones-${U.stamp()}.csv`));
    U.$('#flAdd', root).addEventListener('click', () => floorForm(null));
    U.$('#dpAdd', root).addEventListener('click', () => deptForm(null));
    U.$$('.zone-link', root).forEach((n) => n.addEventListener('click', () => F.views.map.showZone(n.dataset.zone)));

    const tables = U.$$('.table-wrap', root);
    // zones table
    tables[0].addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const id = b.closest('tr').dataset.id;
      if (b.dataset.act === 'map') F.views.map.showZone(id);
      if (b.dataset.act === 'assets') { const z = S.zone(id); F.views.register.setFilter({ floor: z.floorId, zone: id }); F.app.go('register'); }
      if (b.dataset.act === 'edit') Z.zoneForm(id);
      if (b.dataset.act === 'del') {
        const z = S.zone(id);
        if (await UI.confirm(`Xoá khu vực <b>${U.esc(z.code)} – ${U.esc(z.name)}</b>?`, { danger: true, okLabel: 'Xoá khu vực' }))
          try { S.deleteZone(id); UI.toast('Đã xoá khu vực.', 'success'); } catch (err) { UI.toast(err.message, 'error', 5000); }
      }
    });
    // floors table
    tables[1].addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const id = b.closest('tr').dataset.id;
      const f = S.floor(id);
      if (b.dataset.act === 'plan') importPlan(id);
      if (b.dataset.act === 'dlplan') downloadPlan(f);
      if (b.dataset.act === 'resetplan' && await UI.confirm(`Khôi phục bản vẽ mẫu (demo) cho ${U.esc(f.code)}?`)) { S.setFloorPlan(id, { type: 'builtin', key: id }); UI.toast('Đã khôi phục bản vẽ mẫu.', 'success'); }
      if (b.dataset.act === 'edit') floorForm(id);
      if (b.dataset.act === 'del' && await UI.confirm(`Xoá tầng <b>${U.esc(f.code)} – ${U.esc(f.name)}</b>?`, { danger: true, okLabel: 'Xoá tầng' }))
        try { S.deleteFloor(id); UI.toast('Đã xoá tầng.', 'success'); } catch (err) { UI.toast(err.message, 'error', 5000); }
    });
    // departments table
    tables[2].addEventListener('click', async (e) => {
      const b = e.target.closest('[data-act]'); if (!b) return;
      const id = b.closest('tr').dataset.id;
      if (b.dataset.act === 'edit') deptForm(id);
      if (b.dataset.act === 'del' && await UI.confirm(`Xoá bộ phận <b>${U.esc(id)}</b>?`, { danger: true, okLabel: 'Xoá' }))
        try { S.deleteDepartment(id); UI.toast('Đã xoá bộ phận.', 'success'); } catch (err) { UI.toast(err.message, 'error', 5000); }
    });
  };
  Z.refresh = Z.show;

  /* ---------- zone form (with draw-on-map) ---------- */
  Z.zoneForm = (id, draft) => {
    const z = draft || (id ? { ...S.zone(id) } : { code: '', name: '', floorId: (S.floors()[0] || {}).id, departmentId: '', x: 10, y: 10, w: 20, h: 20, color: ZONE_COLORS[S.zones().length % ZONE_COLORS.length] });
    const form = U.h(`<form class="form-grid" autocomplete="off">
      <div class="field"><label>Mã khu vực <span class="req">*</span></label><input name="code" value="${U.esc(z.code)}" maxlength="6" style="text-transform:uppercase;font-family:var(--mono)"><div class="hint">1–6 chữ/số, dùng trong Location Code (VD: EXT)</div></div>
      <div class="field"><label>Tên khu vực <span class="req">*</span></label><input name="name" value="${U.esc(z.name)}"></div>
      <div class="field"><label>Tầng <span class="req">*</span></label><select name="floorId">${UI.options(S.floors(), z.floorId, { label: (f) => `${f.code} – ${f.name}` })}</select></div>
      <div class="field"><label>Bộ phận <span class="req">*</span></label><select name="departmentId">${UI.options(S.departments(), z.departmentId, { empty: '— chọn —', label: (d) => `${d.code} – ${d.name}` })}</select></div>
      <div class="form-section">Ranh giới (% bản vẽ, gốc ở góc trên bên trái)</div>
      <div class="field"><label>X (cạnh trái)</label><input name="x" type="number" step="0.1" min="0" max="100" value="${z.x}"></div>
      <div class="field"><label>Y (cạnh trên)</label><input name="y" type="number" step="0.1" min="0" max="100" value="${z.y}"></div>
      <div class="field"><label>Chiều rộng</label><input name="w" type="number" step="0.1" min="0.1" max="100" value="${z.w}"></div>
      <div class="field"><label>Chiều cao</label><input name="h" type="number" step="0.1" min="0.1" max="100" value="${z.h}"></div>
      <div class="field"><label>Màu</label><input name="color" type="color" value="${U.esc(z.color)}"></div>
      <div class="field"><span class="lbl">&nbsp;</span><button type="button" class="btn" id="zfDraw">${U.icon('square', 16)}Vẽ ranh giới trên sơ đồ</button></div>
    </form>`);
    let m;
    U.$('#zfDraw', form).addEventListener('click', () => {
      const cur = { ...z, ...UI.formData(form), id };
      m.close();
      F.views.map.startDraw(cur.floorId, (rect) => {
        F.app.go('zones');
        Z.zoneForm(id, rect ? { ...cur, ...rect } : cur);
      });
    });
    m = UI.modal({
      title: id ? `Sửa khu vực ${S.zone(id).code}` : 'Thêm khu vực', body: form,
      actions: [{ label: 'Hủy' }, { label: 'Lưu khu vực', primary: true, icon: 'check', onClick: () => {
        const d = UI.formData(form);
        try {
          S.saveZone({ id: id || undefined, code: d.code.trim().toUpperCase(), name: d.name.trim(), floorId: d.floorId, departmentId: d.departmentId, x: d.x, y: d.y, w: d.w, h: d.h, color: d.color });
          UI.toast('Đã lưu khu vực. Location Code đã được tính lại.', 'success');
        } catch (e) { UI.toast(e.message, 'error', 5000); return false; }
      } }],
    });
  };

  function floorForm(id) {
    const f = id ? S.floor(id) : { code: 'F' + (S.floors().length + 1), name: '', level: S.floors().length + 1 };
    const form = U.h(`<form class="form-grid">
      <div class="field"><label>Mã tầng <span class="req">*</span></label><input name="code" value="${U.esc(f.code)}" maxlength="6" style="text-transform:uppercase;font-family:var(--mono)"><div class="hint">Phần đầu của Location Code</div></div>
      <div class="field"><label>Cao độ (thứ tự sắp xếp)</label><input name="level" type="number" value="${U.esc(f.level)}"></div>
      <div class="field full"><label>Tên tầng <span class="req">*</span></label><input name="name" value="${U.esc(f.name)}"></div></form>`);
    UI.modal({ title: id ? 'Sửa tầng' : 'Thêm tầng', body: form, actions: [{ label: 'Hủy' }, { label: 'Lưu', primary: true, onClick: () => {
      const d = UI.formData(form);
      try { S.saveFloor({ id, code: d.code.trim().toUpperCase(), name: d.name.trim(), level: d.level }); UI.toast('Đã lưu tầng.', 'success'); } catch (e) { UI.toast(e.message, 'error'); return false; }
    } }] });
  }

  function deptForm(id) {
    const d0 = id ? S.dept(id) : { code: '', name: '' };
    const form = U.h(`<form class="form-grid">
      <div class="field"><label>Mã <span class="req">*</span></label><input name="code" value="${U.esc(d0.code)}" maxlength="6" ${id ? 'readonly' : ''} style="text-transform:uppercase;font-family:var(--mono)"><div class="hint">Dùng trong Location Code (VD: PR)</div></div>
      <div class="field"><label>Tên <span class="req">*</span></label><input name="name" value="${U.esc(d0.name)}"></div></form>`);
    UI.modal({ title: id ? 'Sửa bộ phận' : 'Thêm bộ phận', body: form, actions: [{ label: 'Hủy' }, { label: 'Lưu', primary: true, onClick: () => {
      const d = UI.formData(form);
      try { S.saveDepartment({ id, code: d.code.trim().toUpperCase(), name: d.name.trim() }); UI.toast('Đã lưu bộ phận.', 'success'); } catch (e) { UI.toast(e.message, 'error'); return false; }
    } }] });
  }

  /* ---------- floor plan import ---------- */
  async function importPlan(floorId) {
    const f = S.floor(floorId);
    const ok = await UI.confirm(`Nhập bản vẽ mới cho <b>${U.esc(f.code)} – ${U.esc(f.name)}</b>.<br><br>
      <span class="small">Tọa độ tài sản và khu vực được lưu theo <b>% bản vẽ</b> (gốc ở góc trên bên trái). Nếu bản vẽ mới có phạm vi hoặc lề khác bản hiện tại, hãy kiểm tra lại ranh giới khu vực và vị trí tài sản sau khi nhập.<br>Chấp nhận: SVG (khuyến nghị), PNG, JPG, WEBP.</span>`, { title: 'Nhập bản vẽ mặt bằng', okLabel: 'Chọn tệp…' });
    if (!ok) return;
    const file = await U.pickFile('.svg,image/svg+xml,image/png,image/jpeg,image/webp');
    if (!file) return;
    try {
      if (/\.svg$/i.test(file.name) || file.type === 'image/svg+xml') {
        const text = await U.readFile(file, 'text');
        const size = U.svgSize(text);
        if (!size) throw new Error('Tệp này không phải bản vẽ SVG hợp lệ.');
        const clean = U.sanitizeSvg(text);
        if (clean.length > 1.8e6) throw new Error('SVG lớn hơn 1,8 MB. Hãy tối ưu (bỏ layer ẩn, hatch, ảnh nhúng) hoặc xuất sang PNG/JPG.');
        S.setFloorPlan(floorId, { type: 'svg', data: clean, w: size.w, h: size.h, name: file.name });
      } else {
        let src = await U.readFile(file, 'dataURL');
        let img = await U.loadImage(src);
        const max = 2400;
        if (img.width > max || img.height > max || src.length > 1.8e6) {
          const k = Math.min(1, max / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
          const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
          src = c.toDataURL('image/jpeg', 0.85);
          if (src.length > 1.8e6) src = c.toDataURL('image/jpeg', 0.6);
          img = await U.loadImage(src);
        }
        if (src.length > 1.8e6) throw new Error('Ảnh vẫn lớn hơn 1,8 MB sau khi nén. Hãy cắt bớt hoặc đơn giản hoá bản vẽ.');
        S.setFloorPlan(floorId, { type: 'image', data: src, w: img.width, h: img.height, name: file.name });
      }
      UI.toast(`Đã nhập bản vẽ cho ${f.code}.`, 'success');
    } catch (e) { UI.toast(e.message, 'error', 6000); }
  }
  function downloadPlan(f) {
    const p = S.planInfo(f);
    if (p.svg) U.download(`${f.code}-floor-plan.svg`, p.svg, 'image/svg+xml');
    else U.downloadDataUrl(`${f.code}-floor-plan.${/png/.test(p.href.slice(0, 30)) ? 'png' : 'jpg'}`, p.href);
  }
})(window.FAM);
