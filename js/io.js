/* Factory Asset Map — import / export (CSV, Excel via SheetJS, JSON backup). */
window.FAM = window.FAM || {};
(function (F) {
  'use strict';
  const U = F.util, S = F.store;
  const IO = (F.io = {});

  IO.hasXLSX = () => typeof window.XLSX !== 'undefined';

  /* Column layout shared by export, template and import */
  IO.ASSET_COLUMNS = [
    { h: 'Asset ID', key: 'id', req: true, get: (v) => v.id },
    { h: 'Tên tài sản', key: 'name', req: true, get: (v) => v.name },
    { h: 'Nhóm tài sản', key: 'category', req: true, get: (v) => v.categoryName },
    { h: 'Bộ phận quản lý', key: 'department', req: true, get: (v) => v.deptName },
    { h: 'Tầng', key: 'floor', req: true, get: (v) => v.floorCode },
    { h: 'Khu vực', key: 'zone', req: true, get: (v) => v.zoneCode },
    { h: 'X', key: 'x', req: true, get: (v) => v.x },
    { h: 'Y', key: 'y', req: true, get: (v) => v.y },
    { h: 'Location Code', key: 'locationCode', get: (v) => v.locationCode },
    { h: 'Nhà sản xuất', key: 'manufacturer', get: (v) => v.manufacturer },
    { h: 'Model', key: 'model', get: (v) => v.model },
    { h: 'Serial Number', key: 'serial', get: (v) => v.serial },
    { h: 'Trạng thái', key: 'status', req: true, get: (v) => v.statusName },
    { h: 'Kiểm định gần nhất', key: 'lastInspection', get: (v) => v.lastInspection },
    { h: 'Link ảnh', key: 'photo', get: (v) => (v.photo && /^https?:/i.test(v.photo) ? v.photo : v.photo ? '(ảnh nhúng – không xuất)' : '') },
    { h: 'Ghi chú', key: 'remarks', get: (v) => v.remarks },
  ];
  const ALIASES = {
    assetid: 'id', id: 'id', assetcode: 'id', assetno: 'id',
    assetname: 'name', name: 'name', description: 'name', assetdescription: 'name',
    category: 'category', assetcategory: 'category',
    department: 'department', responsibledepartment: 'department', dept: 'department',
    floor: 'floor', level: 'floor',
    zone: 'zone', area: 'zone', factoryzone: 'zone',
    x: 'x', xcoordinate: 'x', xpercent: 'x', 'x%': 'x',
    y: 'y', ycoordinate: 'y', ypercent: 'y', 'y%': 'y',
    locationcode: 'locationCode',
    manufacturer: 'manufacturer', maker: 'manufacturer', brand: 'manufacturer',
    model: 'model',
    serialnumber: 'serial', serial: 'serial', serialno: 'serial', sn: 'serial',
    status: 'status',
    lastinspection: 'lastInspection', lastinspectiondate: 'lastInspection', inspectiondate: 'lastInspection',
    photo: 'photo', photourl: 'photo', image: 'photo', imageurl: 'photo',
    remarks: 'remarks', remark: 'remarks', notes: 'remarks', comment: 'remarks',
    // Vietnamese headers (normalised without diacritics)
    mataisan: 'id', masotaisan: 'id',
    tentaisan: 'name', ten: 'name', motataisan: 'name',
    nhomtaisan: 'category', nhom: 'category', loaitaisan: 'category',
    bophanquanly: 'department', bophan: 'department', phongban: 'department',
    tang: 'floor',
    khuvuc: 'zone',
    toadox: 'x', toadoy: 'y',
    nhasanxuat: 'manufacturer', hangsanxuat: 'manufacturer',
    sosori: 'serial', soserial: 'serial',
    trangthai: 'status',
    kiemdinhganhat: 'lastInspection', ngaykiemdinh: 'lastInspection', ngaykiemdinhganhat: 'lastInspection',
    linkanh: 'photo', anh: 'photo', hinhanh: 'photo',
    ghichu: 'remarks',
    mavitri: 'locationCode',
  };
  const normHeader = (h) => String(h || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9%]/g, '');

  /* ---------------- export ---------------- */
  IO.assetRows = (views) => [IO.ASSET_COLUMNS.map((c) => c.h), ...views.map((v) => IO.ASSET_COLUMNS.map((c) => c.get(v) ?? ''))];

  IO.historyRows = (list) => [
    ['Thời gian', 'Hành động', 'Asset ID', 'Tên tài sản', 'Tầng cũ', 'Khu vực cũ', 'X cũ', 'Y cũ', 'Location Code cũ', 'Tầng mới', 'Khu vực mới', 'X mới', 'Y mới', 'Location Code mới', 'Người cập nhật', 'Lý do'],
    ...list.map((h) => [
      h.at, h.action, h.assetId, h.assetName,
      h.prev ? h.prev.floorCode : '', h.prev ? h.prev.zoneCode : '', h.prev ? h.prev.x : '', h.prev ? h.prev.y : '', h.prev ? h.prev.code : '',
      h.next ? h.next.floorCode : '', h.next ? h.next.zoneCode : '', h.next ? h.next.x : '', h.next ? h.next.y : '', h.next ? h.next.code : '',
      h.updatedBy, h.reason,
    ]),
  ];
  IO.zoneRows = () => [
    ['Mã khu vực', 'Tên khu vực', 'Tầng', 'Bộ phận', 'X', 'Y', 'Rộng', 'Cao', 'Số tài sản'],
    ...S.zones().map((z) => [z.code, z.name, (S.floor(z.floorId) || {}).code, (S.dept(z.departmentId) || {}).code, z.x, z.y, z.w, z.h, S.raw().locations.filter((l) => l.zoneId === z.id).length]),
  ];

  IO.downloadCSV = (rows, name) => U.download(name, U.csv.stringify(rows), 'text/csv;charset=utf-8');

  IO.downloadXLSX = (sheets, name) => {
    if (!IO.hasXLSX()) {
      F.ui.toast('Chưa tải được thư viện Excel (mất mạng?). Hãy xuất CSV — Excel vẫn mở được.', 'error', 5000);
      return false;
    }
    const wb = XLSX.utils.book_new();
    sheets.forEach(({ name: sn, rows, widths }) => {
      const ws = XLSX.utils.aoa_to_sheet(rows);
      if (widths) ws['!cols'] = widths.map((w) => ({ wch: w }));
      XLSX.utils.book_append_sheet(wb, ws, sn.slice(0, 31));
    });
    XLSX.writeFile(wb, name);
    return true;
  };

  IO.exportAssets = (format, views) => {
    views = views || S.views();
    const rows = IO.assetRows(views);
    const base = `so-tai-san-${U.stamp()}`;
    if (format === 'xlsx') {
      const notice = [['Xuất từ Bản đồ tài sản nhà máy'], ['Thời gian xuất', new Date().toLocaleString('vi-VN')], ['Nhà máy', S.factory().name],
        ['Tọa độ', '% chuẩn hoá theo bản vẽ (0–100). Gốc ở góc trên bên trái, X → sang phải, Y ↓ xuống dưới.']];
      if (S.isDemo()) notice.push(['LƯU Ý', 'DỮ LIỆU DEMO — chỉ mang tính minh họa, không phải hồ sơ thực tế của nhà máy.']);
      IO.downloadXLSX([
        { name: 'Tài sản', rows, widths: [15, 34, 14, 24, 7, 9, 6, 6, 24, 32, 12, 18, 18, 16, 20, 40] },
        { name: 'Khu vực', rows: IO.zoneRows() },
        { name: 'Lịch sử vị trí', rows: IO.historyRows(S.history().slice().reverse()) },
        { name: 'Thông tin', rows: notice, widths: [16, 80] },
      ], base + '.xlsx');
    } else IO.downloadCSV(rows, base + '.csv');
  };

  IO.templateRows = () => [
    IO.ASSET_COLUMNS.filter((c) => c.key !== 'locationCode').map((c) => c.h),
    ['AST-EQP-9001', 'VÍ DỤ – Bình trích ly cà phê EX-09', 'Thiết bị', 'Sản xuất', 'F1', 'EXT', '12.5', '20', 'Hãng ví dụ', 'MOD-100', 'SN-0000-0001', 'Đang hoạt động', '2026-01-31', '', 'DÒNG VÍ DỤ – xoá trước khi nhập'],
    ['AST-UTL-9001', 'VÍ DỤ – Máy nén khí AC-09', 'UTL', 'EN', 'F1', 'Phụ trợ', '88', '20', 'Hãng ví dụ', 'AC-50', 'SN-0000-0002', 'Đến hạn kiểm định', '', '', 'DÒNG VÍ DỤ – xoá trước khi nhập'],
  ];
  IO.downloadTemplate = (format) => {
    const rows = IO.templateRows();
    if (format === 'xlsx') {
      const help = [
        ['Cột', 'Bắt buộc', 'Quy tắc'],
        ['Asset ID', 'Có', 'Duy nhất, không dùng lại. Định dạng khuyến nghị AST-<NHÓM>-0001. Ký tự A–Z 0–9 - _ . /'],
        ['Tên tài sản', 'Có', 'Văn bản tự do'],
        ['Nhóm tài sản', 'Có', 'Mã hoặc tên nhóm: ' + S.categories().map((c) => c.code + ' = ' + c.name).join(', ')],
        ['Bộ phận quản lý', 'Có', 'Mã hoặc tên bộ phận: ' + S.departments().map((d) => d.code + ' = ' + d.name).join(', ')],
        ['Tầng', 'Có', 'Mã hoặc tên tầng: ' + S.floors().map((f) => f.code).join(', ')],
        ['Khu vực', 'Có', 'Mã hoặc tên khu vực trên tầng đó: ' + S.zones().map((z) => (S.floor(z.floorId) || {}).code + '/' + z.code).join(', ')],
        ['X / Y', 'Có', 'Số 0–100 = % chiều rộng/cao bản vẽ. Gốc ở góc trên bên trái, X sang phải, Y xuống dưới.'],
        ['Trạng thái', 'Có', S.statuses().map((s) => s.name).join(' / ')],
        ['Kiểm định gần nhất', 'Không', 'YYYY-MM-DD (chấp nhận DD/MM/YYYY)'],
        ['Link ảnh', 'Không', 'Đường dẫn http(s) tới ảnh (tuỳ chọn)'],
        ['Location Code', '—', 'Không cần nhập: hệ thống tự tính'],
      ];
      IO.downloadXLSX([{ name: 'Tài sản', rows, widths: [15, 36, 14, 18, 7, 9, 6, 6, 16, 12, 16, 18, 16, 20, 36] }, { name: 'Hướng dẫn', rows: help, widths: [18, 10, 90] }], 'mau-nhap-tai-san.xlsx');
    } else IO.downloadCSV(rows, 'mau-nhap-tai-san.csv');
  };

  /* ---------------- import ---------------- */
  IO.readTable = async (file) => {
    const name = file.name.toLowerCase();
    if (name.endsWith('.csv') || name.endsWith('.txt')) return U.csv.parse(await U.readFile(file, 'text'));
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.ods')) {
      if (!IO.hasXLSX()) throw new Error('Chưa tải được thư viện Excel (mất mạng?). Hãy lưu sheet thành CSV rồi nhập file CSV.');
      const wb = XLSX.read(await U.readFile(file, 'arrayBuffer'), { type: 'array', cellDates: false });
      const ws = wb.Sheets[['Tài sản', 'Assets'].find((n) => wb.SheetNames.includes(n)) || wb.SheetNames[0]];
      return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }).filter((r) => r.some((v) => String(v).trim() !== ''));
    }
    throw new Error('Định dạng tệp không hỗ trợ. Dùng .csv, .xlsx hoặc .xls');
  };

  /*
   * Analyse rows without changing data. Returns { creates, updates, errors, unchanged, headerErrors }.
   * mode: 'add' (new IDs only) | 'upsert' (add new, update existing)
   */
  IO.analyse = (rows, mode) => {
    const res = { creates: [], updates: [], errors: [], skipped: [], headerErrors: [] };
    if (!rows.length) { res.headerErrors.push('Tệp không có dữ liệu.'); return res; }
    const header = rows[0].map((h) => ALIASES[normHeader(h)] || null);
    const required = IO.ASSET_COLUMNS.filter((c) => c.req).map((c) => c.key);
    const missing = required.filter((k) => !header.includes(k));
    if (missing.length) {
      res.headerErrors.push('Thiếu cột bắt buộc: ' + missing.map((k) => IO.ASSET_COLUMNS.find((c) => c.key === k).h).join(', '));
      return res;
    }
    const seen = new Set();
    rows.slice(1).forEach((r, i) => {
      const line = i + 2;
      const o = {};
      header.forEach((k, ci) => { if (k) o[k] = r[ci] === undefined || r[ci] === null ? '' : r[ci]; });
      const errs = [];
      const covered = new Set(); // fields that already have a specific message
      const fail = (key, msg) => { errs.push(msg); covered.add(key); };
      const id = String(o.id || '').trim().toUpperCase();
      if (id && seen.has(id)) fail('id', `Asset ID "${id}" bị trùng trong tệp`);
      seen.add(id);
      const cat = S.findCategory(o.category);
      const dept = S.findDept(o.department);
      const floor = S.findFloor(o.floor);
      const zone = floor ? S.findZone(o.zone, floor.id) : null;
      const st = S.findStatus(o.status);
      if (String(o.category).trim() && !cat) fail('categoryId', `Không có nhóm "${o.category}"`);
      if (String(o.department).trim() && !dept) fail('departmentId', `Không có bộ phận "${o.department}"`);
      if (String(o.floor).trim() && !floor) { fail('floorId', `Không có tầng "${o.floor}"`); covered.add('zoneId'); }
      if (floor && String(o.zone).trim() && !zone) fail('zoneId', `Không có khu vực "${o.zone}" trên tầng ${floor.code}`);
      if (String(o.status).trim() && !st) fail('status', `Không có trạng thái "${o.status}"`);
      const master = {
        id, name: String(o.name || '').trim(), categoryId: cat && cat.id, departmentId: dept && dept.id,
        manufacturer: o.manufacturer, model: o.model, serial: o.serial, status: st && st.id,
        lastInspection: U.isoDate(o.lastInspection), remarks: o.remarks,
        photo: /^https?:\/\//i.test(String(o.photo || '').trim()) ? String(o.photo).trim() : undefined,
      };
      if (String(o.lastInspection || '').trim() && !master.lastInspection) fail('lastInspection', `Ngày không hợp lệ "${o.lastInspection}"`);
      const loc = { floorId: floor && floor.id, zoneId: zone && zone.id, x: U.num(o.x), y: U.num(o.y) };
      const existing = id && S.asset(id);
      if (existing && mode === 'add') fail('id', `Asset ID "${id}" đã tồn tại (chế độ: chỉ thêm mới)`);
      if (!existing && id && S.history().some((h) => h.assetId === id && h.action === 'REMOVE')) fail('id', `Asset ID "${id}" thuộc tài sản đã xoá — không được dùng lại`);
      const v = S.validateAsset(master, loc, false);
      Object.entries(v).forEach(([k, m]) => { if (!covered.has(k)) errs.push(m); });
      if (errs.length) { res.errors.push({ line, id, errs }); return; }
      if (existing) {
        if (master.photo === undefined) master.photo = existing.photo; // keep embedded photo
        res.updates.push({ line, master, loc });
      } else {
        if (master.photo === undefined) master.photo = '';
        res.creates.push({ line, master, loc });
      }
    });
    return res;
  };

  IO.apply = (analysis, { by, reason }) => {
    let created = 0, updated = 0, moved = 0;
    S.batch(() => {
      analysis.creates.forEach(({ master, loc }) => { S.createAsset(master, loc, { by, reason: 'Đăng ký ban đầu (' + reason + ')', silent: true }); created++; });
      analysis.updates.forEach(({ master, loc }) => {
        const before = { ...S.location(master.id) };
        S.updateAsset(master.id, master, loc, { by, reason, silent: true });
        const after = S.location(master.id);
        if (before.code !== after.code || before.x !== after.x || before.y !== after.y) moved++;
        updated++;
      });
    });
    return { created, updated, moved };
  };

  /* ---------------- JSON backup ---------------- */
  IO.backup = () => {
    const data = S.exportJSON();
    U.download(`sao-luu-ban-do-tai-san-${U.stamp()}.json`, JSON.stringify(data, null, 1), 'application/json');
  };
  IO.restore = async () => {
    const file = await U.pickFile('.json,application/json');
    if (!file) return;
    let obj;
    try { obj = JSON.parse(await U.readFile(file, 'text')); } catch (e) { F.ui.toast('Tệp JSON không hợp lệ.', 'error'); return; }
    const n = obj && Array.isArray(obj.assets) ? obj.assets.length : 0;
    const ok = await F.ui.confirm(`Khôi phục <b>${U.esc(file.name)}</b> gồm ${n} tài sản? Thao tác này thay <b>toàn bộ</b> dữ liệu hiện tại.`, { okLabel: 'Khôi phục', danger: true });
    if (!ok) return;
    try { S.importJSON(obj); if (!F.remote.enabled()) F.ui.toast('Đã khôi phục bản sao lưu.', 'success'); } catch (e) { F.ui.toast(e.message, 'error', 6000); }
  };
})(window.FAM);
