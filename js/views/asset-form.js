/* Factory Asset Map — Add / Edit asset dialog (shared by Map, Register, QR). */
window.FAM = window.FAM || {};
(function (F) {
  'use strict';
  const U = F.util, S = F.store, UI = F.ui;
  F.views = F.views || {};
  const AF = (F.views.assetForm = {});

  AF.open = (assetId, preset = {}) => {
    const isNew = !assetId;
    const v = isNew ? null : S.view(assetId);
    if (!isNew && !v) return UI.toast('Không tìm thấy tài sản', 'error');
    const firstFloor = preset.floorId || (S.floors()[0] || {}).id;
    const d = v || {
      id: '', name: '', categoryId: (S.categories()[0] || {}).id, departmentId: '', manufacturer: '', model: '', serial: '',
      status: (S.statuses()[0] || {}).id, lastInspection: '', remarks: '', photo: '',
      floorId: firstFloor, zoneId: preset.zoneId || '', x: preset.x ?? 50, y: preset.y ?? 50,
    };
    if (isNew) d.id = S.nextAssetId(d.categoryId);
    let photo = d.photo || '';
    let idTouched = false;

    const form = U.h(`<form class="form-grid" autocomplete="off" novalidate>
      <div class="form-section">Thông tin nhận dạng</div>
      <div class="field"><label>Asset ID <span class="req">*</span></label>
        <input name="id" value="${U.esc(d.id)}" ${isNew ? '' : 'readonly'} style="text-transform:uppercase;font-family:var(--mono)">
        <div class="hint">${isNew ? 'Tự đề xuất theo nhóm tài sản. Duy nhất và cố định — không đổi khi tài sản di chuyển.' : 'Asset ID là cố định, không sửa được.'}</div></div>
      <div class="field"><label>Tên tài sản <span class="req">*</span></label><input name="name" value="${U.esc(d.name)}" maxlength="120"></div>
      <div class="field"><label>Nhóm tài sản <span class="req">*</span></label><select name="categoryId">${UI.options(S.categories(), d.categoryId, { label: (c) => `${c.name} (${c.code})` })}</select></div>
      <div class="field"><label>Bộ phận quản lý <span class="req">*</span></label><select name="departmentId">${UI.options(S.departments(), d.departmentId, { empty: '— chọn —', label: (x) => `${x.code} – ${x.name}` })}</select></div>
      <div class="field"><label>Trạng thái <span class="req">*</span></label><select name="status">${UI.options(S.statuses(), d.status)}</select></div>
      <div class="field"><label>Ngày kiểm định gần nhất</label><input name="lastInspection" type="date" value="${U.esc(d.lastInspection)}"></div>

      <div class="form-section">Thông số kỹ thuật</div>
      <div class="field"><label>Nhà sản xuất</label><input name="manufacturer" value="${U.esc(d.manufacturer)}"></div>
      <div class="field"><label>Model</label><input name="model" value="${U.esc(d.model)}"></div>
      <div class="field"><label>Serial Number</label><input name="serial" value="${U.esc(d.serial)}"></div>
      <div class="field"><label>Hình ảnh</label>
        <div class="photo-field"><div class="photo-thumb" id="afThumb"></div>
          <div class="btn-row"><button type="button" class="btn btn-sm" id="afPhotoUp">${U.icon('upload', 14)}Tải ảnh lên</button>
          <button type="button" class="btn btn-sm" id="afPhotoUrl">URL</button>
          <button type="button" class="btn btn-sm btn-ghost" id="afPhotoDel">Xoá ảnh</button></div></div>
        <div class="hint">Ảnh tải lên được thu nhỏ còn 480 px để tiết kiệm dung lượng.</div></div>

      <div class="form-section">Vị trí</div>
      <div class="field"><label>Tầng <span class="req">*</span></label><select name="floorId">${UI.options(S.floors(), d.floorId, { label: (f) => `${f.code} – ${f.name}` })}</select></div>
      <div class="field"><label>Khu vực <span class="req">*</span></label><select name="zoneId"></select></div>
      <div class="field"><label>X (%) <span class="req">*</span></label><input name="x" type="number" min="0" max="100" step="0.1" value="${U.esc(d.x)}"><div class="hint">0 = mép trái, 100 = mép phải bản vẽ</div></div>
      <div class="field"><label>Y (%) <span class="req">*</span></label><input name="y" type="number" min="0" max="100" step="0.1" value="${U.esc(d.y)}"><div class="hint">0 = mép trên, 100 = mép dưới bản vẽ</div></div>
      <div class="field full"><label>Location Code (tự động)</label><input name="_code" readonly style="font-family:var(--mono)"></div>
      <div class="full" id="afMoveBox" hidden>
        <div class="callout warn" style="margin-bottom:10px">${U.icon('history', 16)}<div>Vị trí đã thay đổi — hệ thống sẽ ghi một dòng Lịch sử vị trí.</div></div>
        <div class="form-grid">
          <div class="field"><label>Người cập nhật <span class="req">*</span></label><input name="by" value="${U.esc(S.currentUser())}"></div>
          <div class="field"><label>Lý do thay đổi <span class="req">*</span></label><input name="reason" placeholder="VD: Di dời sau khi bố trí lại dây chuyền"></div>
        </div>
      </div>

      <div class="form-section">Khác</div>
      <div class="field full"><label>Ghi chú</label><textarea name="remarks" maxlength="1000">${U.esc(d.remarks)}</textarea></div>
    </form>`);

    const $ = (n) => U.$(`[name="${n}"]`, form);
    const fillZones = (sel) => ($('zoneId').innerHTML = UI.options(S.zones($('floorId').value), sel, { empty: '— chọn khu vực —', label: (z) => `${z.code} – ${z.name}` }));
    const thumb = () => {
      const t = U.$('#afThumb', form);
      t.style.backgroundImage = photo ? `url("${photo.replace(/"/g, '%22')}")` : '';
      t.innerHTML = photo ? '' : U.icon('image', 22);
    };
    const refresh = () => {
      const f = UI.formData(form);
      const loc = { floorId: f.floorId, zoneId: f.zoneId, x: U.num(f.x), y: U.num(f.y) };
      $('_code').value = S.locationCode(loc);
      if (!isNew) {
        const changed = v.floorId !== loc.floorId || v.zoneId !== loc.zoneId || U.round1(v.x) !== U.round1(loc.x) || U.round1(v.y) !== U.round1(loc.y);
        U.$('#afMoveBox', form).hidden = !changed;
      }
    };
    fillZones(d.zoneId);
    if (!d.zoneId) { const z = S.zoneAt(d.floorId, d.x, d.y); if (z) $('zoneId').value = z.id; }
    thumb();
    refresh();

    $('id').addEventListener('input', () => { idTouched = true; });
    $('categoryId').addEventListener('change', () => { if (isNew && !idTouched) $('id').value = S.nextAssetId($('categoryId').value); });
    $('floorId').addEventListener('change', () => { const z = S.zoneAt($('floorId').value, U.num($('x').value), U.num($('y').value)); fillZones(z ? z.id : ''); refresh(); });
    ['x', 'y'].forEach((n) => $(n).addEventListener('input', () => {
      if (S.settings().autoDetectZone !== false) { const z = S.zoneAt($('floorId').value, U.num($('x').value), U.num($('y').value)); if (z) $('zoneId').value = z.id; }
      refresh();
    }));
    $('zoneId').addEventListener('change', refresh);
    U.$('#afPhotoUp', form).addEventListener('click', async () => {
      const file = await U.pickFile('image/*');
      if (!file) return;
      try { photo = await U.resizeImage(file); thumb(); } catch (e) { UI.toast('Không đọc được ảnh này.', 'error'); }
    });
    U.$('#afPhotoUrl', form).addEventListener('click', () => {
      const url = prompt('Đường dẫn ảnh (http/https):', /^https?:/.test(photo) ? photo : '');
      if (url === null) return;
      if (url && !/^https?:\/\//i.test(url.trim())) return UI.toast('Đường dẫn phải bắt đầu bằng http:// hoặc https://', 'error');
      photo = url.trim(); thumb();
    });
    U.$('#afPhotoDel', form).addEventListener('click', () => { photo = ''; thumb(); });

    UI.modal({
      title: isNew ? 'Thêm tài sản' : `Sửa ${v.id}`,
      size: 'modal-lg',
      body: form,
      actions: [
        { label: 'Hủy' },
        { label: isNew ? 'Thêm tài sản' : 'Lưu thay đổi', primary: true, icon: 'check', onClick: () => {
          const f = UI.formData(form);
          const master = { ...f, id: String(f.id).trim().toUpperCase(), photo };
          const loc = { floorId: f.floorId, zoneId: f.zoneId, x: U.num(f.x), y: U.num(f.y) };
          try {
            if (isNew) {
              S.createAsset(master, loc, { by: S.currentUser() });
              UI.toast(`Đã thêm tài sản ${master.id}.`, 'success');
            } else {
              const moving = !U.$('#afMoveBox', form).hidden;
              if (moving && !String(f.by).trim()) { UI.showErrors(form, { by: 'Bắt buộc nhập người cập nhật' }); return false; }
              S.updateAsset(v.id, master, loc, { by: String(f.by).trim(), reason: f.reason });
              UI.toast(`Đã lưu tài sản ${v.id}.`, 'success');
            }
          } catch (e) {
            if (e.errors) UI.showErrors(form, e.errors);
            else UI.toast(e.message, 'error');
            return false;
          }
        } },
      ],
    });
  };
})(window.FAM);
