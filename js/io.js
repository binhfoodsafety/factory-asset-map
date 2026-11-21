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
    { h: 'Asset Name', key: 'name', req: true, get: (v) => v.name },
    { h: 'Category', key: 'category', req: true, get: (v) => v.categoryName },
    { h: 'Department', key: 'department', req: true, get: (v) => v.deptName },
    { h: 'Floor', key: 'floor', req: true, get: (v) => v.floorCode },
    { h: 'Zone', key: 'zone', req: true, get: (v) => v.zoneCode },
    { h: 'X', key: 'x', req: true, get: (v) => v.x },
    { h: 'Y', key: 'y', req: true, get: (v) => v.y },
    { h: 'Location Code', key: 'locationCode', get: (v) => v.locationCode },
    { h: 'Manufacturer', key: 'manufacturer', get: (v) => v.manufacturer },
    { h: 'Model', key: 'model', get: (v) => v.model },
    { h: 'Serial Number', key: 'serial', get: (v) => v.serial },
    { h: 'Status', key: 'status', req: true, get: (v) => v.statusName },
    { h: 'Last Inspection', key: 'lastInspection', get: (v) => v.lastInspection },
    { h: 'Photo URL', key: 'photo', get: (v) => (v.photo && /^https?:/i.test(v.photo) ? v.photo : v.photo ? '(embedded image – not exported)' : '') },
    { h: 'Remarks', key: 'remarks', get: (v) => v.remarks },
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
  };
  const normHeader = (h) => String(h || '').toLowerCase().replace(/[^a-z0-9%]/g, '');

  /* ---------------- export ---------------- */
  IO.assetRows = (views) => [IO.ASSET_COLUMNS.map((c) => c.h), ...views.map((v) => IO.ASSET_COLUMNS.map((c) => c.get(v) ?? ''))];

  IO.historyRows = (list) => [
    ['Date Time', 'Action', 'Asset ID', 'Asset Name', 'Previous Floor', 'Previous Zone', 'Previous X', 'Previous Y', 'Previous Location Code', 'New Floor', 'New Zone', 'New X', 'New Y', 'New Location Code', 'Updated By', 'Reason'],
    ...list.map((h) => [
      h.at, h.action, h.assetId, h.assetName,
      h.prev ? h.prev.floorCode : '', h.prev ? h.prev.zoneCode : '', h.prev ? h.prev.x : '', h.prev ? h.prev.y : '', h.prev ? h.prev.code : '',
      h.next ? h.next.floorCode : '', h.next ? h.next.zoneCode : '', h.next ? h.next.x : '', h.next ? h.next.y : '', h.next ? h.next.code : '',
      h.updatedBy, h.reason,
    ]),
  ];
  IO.zoneRows = () => [
    ['Zone Code', 'Zone Name', 'Floor', 'Department', 'X', 'Y', 'Width', 'Height', 'Asset Count'],
    ...S.zones().map((z) => [z.code, z.name, (S.floor(z.floorId) || {}).code, (S.dept(z.departmentId) || {}).code, z.x, z.y, z.w, z.h, S.raw().locations.filter((l) => l.zoneId === z.id).length]),
  ];

  IO.downloadCSV = (rows, name) => U.download(name, U.csv.stringify(rows), 'text/csv;charset=utf-8');

  IO.downloadXLSX = (sheets, name) => {
    if (!IO.hasXLSX()) {
      F.ui.toast('Excel library not loaded (offline?). Use CSV export instead — it opens in Excel too.', 'error', 5000);
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
    const base = `factory-assets-${U.stamp()}`;
    if (format === 'xlsx') {
      const notice = [['Factory Asset Map export'], ['Exported', new Date().toLocaleString()], ['Factory', S.factory().name],
        ['Coordinates', 'Normalized % of floor drawing (0–100). Origin top-left, X → right, Y ↓ down.']];
      if (S.isDemo()) notice.push(['NOTE', 'DEMO DATA — illustrative only, not actual factory records.']);
      IO.downloadXLSX([
        { name: 'Assets', rows, widths: [15, 32, 12, 22, 7, 7, 6, 6, 24, 30, 12, 18, 15, 14, 20, 40] },
        { name: 'Zones', rows: IO.zoneRows() },
        { name: 'Location History', rows: IO.historyRows(S.history().slice().reverse()) },
        { name: 'About', rows: notice, widths: [14, 80] },
      ], base + '.xlsx');
    } else IO.downloadCSV(rows, base + '.csv');
  };

  IO.templateRows = () => [
    IO.ASSET_COLUMNS.filter((c) => c.key !== 'locationCode').map((c) => c.h),
    ['AST-EQP-9001', 'EXAMPLE – Coffee Extractor EX-09', 'Equipment', 'Production', 'F1', 'EXT', '12.5', '20', 'Example Maker', 'MOD-100', 'SN-0000-0001', 'Active', '2026-01-31', '', 'EXAMPLE ROW – delete before importing'],
    ['AST-UTL-9001', 'EXAMPLE – Air Compressor AC-09', 'Utility', 'EN', 'F1', 'Utility', '88', '20', 'Example Maker', 'AC-50', 'SN-0000-0002', 'Inspection Due', '', '', 'EXAMPLE ROW – delete before importing'],
  ];
  IO.downloadTemplate = (format) => {
    const rows = IO.templateRows();
    if (format === 'xlsx') {
      const help = [
        ['Column', 'Required', 'Rules'],
        ['Asset ID', 'Yes', 'Unique, never reused. Recommended format AST-<CAT>-0001. A–Z 0–9 - _ . /'],
        ['Asset Name', 'Yes', 'Free text'],
        ['Category', 'Yes', 'Category code or name: ' + S.categories().map((c) => c.code + ' = ' + c.name).join(', ')],
        ['Department', 'Yes', 'Responsible department code or name: ' + S.departments().map((d) => d.code).join(', ')],
        ['Floor', 'Yes', 'Floor code or name: ' + S.floors().map((f) => f.code).join(', ')],
        ['Zone', 'Yes', 'Zone code or name on that floor: ' + S.zones().map((z) => (S.floor(z.floorId) || {}).code + '/' + z.code).join(', ')],
        ['X / Y', 'Yes', 'Number 0–100 = % of drawing width/height. Origin top-left, X right, Y down.'],
        ['Status', 'Yes', S.statuses().map((s) => s.name).join(' / ')],
        ['Last Inspection', 'No', 'YYYY-MM-DD (DD/MM/YYYY also accepted)'],
        ['Photo URL', 'No', 'http(s) link to an image (optional)'],
        ['Location Code', '—', 'Not imported: calculated automatically'],
      ];
      IO.downloadXLSX([{ name: 'Assets', rows, widths: [15, 32, 12, 14, 7, 9, 6, 6, 16, 12, 16, 15, 14, 20, 36] }, { name: 'Instructions', rows: help, widths: [16, 10, 90] }], 'asset-import-template.xlsx');
    } else IO.downloadCSV(rows, 'asset-import-template.csv');
  };

  /* ---------------- import ---------------- */
  IO.readTable = async (file) => {
    const name = file.name.toLowerCase();
    if (name.endsWith('.csv') || name.endsWith('.txt')) return U.csv.parse(await U.readFile(file, 'text'));
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.ods')) {
      if (!IO.hasXLSX()) throw new Error('Excel library not loaded (offline?). Save the sheet as CSV and import the CSV instead.');
      const wb = XLSX.read(await U.readFile(file, 'arrayBuffer'), { type: 'array', cellDates: false });
      const ws = wb.Sheets[wb.SheetNames.includes('Assets') ? 'Assets' : wb.SheetNames[0]];
      return XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: '' }).filter((r) => r.some((v) => String(v).trim() !== ''));
    }
    throw new Error('Unsupported file type. Use .csv, .xlsx or .xls');
  };

  /*
   * Analyse rows without changing data. Returns { creates, updates, errors, unchanged, headerErrors }.
   * mode: 'add' (new IDs only) | 'upsert' (add new, update existing)
   */
  IO.analyse = (rows, mode) => {
    const res = { creates: [], updates: [], errors: [], skipped: [], headerErrors: [] };
    if (!rows.length) { res.headerErrors.push('The file is empty.'); return res; }
    const header = rows[0].map((h) => ALIASES[normHeader(h)] || null);
    const required = IO.ASSET_COLUMNS.filter((c) => c.req).map((c) => c.key);
    const missing = required.filter((k) => !header.includes(k));
    if (missing.length) {
      res.headerErrors.push('Missing required column(s): ' + missing.map((k) => IO.ASSET_COLUMNS.find((c) => c.key === k).h).join(', '));
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
      if (id && seen.has(id)) fail('id', `Duplicate Asset ID "${id}" within the file`);
      seen.add(id);
      const cat = S.findCategory(o.category);
      const dept = S.findDept(o.department);
      const floor = S.findFloor(o.floor);
      const zone = floor ? S.findZone(o.zone, floor.id) : null;
      const st = S.findStatus(o.status);
      if (String(o.category).trim() && !cat) fail('categoryId', `Unknown category "${o.category}"`);
      if (String(o.department).trim() && !dept) fail('departmentId', `Unknown department "${o.department}"`);
      if (String(o.floor).trim() && !floor) { fail('floorId', `Unknown floor "${o.floor}"`); covered.add('zoneId'); }
      if (floor && String(o.zone).trim() && !zone) fail('zoneId', `Zone "${o.zone}" not found on floor ${floor.code}`);
      if (String(o.status).trim() && !st) fail('status', `Unknown status "${o.status}"`);
      const master = {
        id, name: String(o.name || '').trim(), categoryId: cat && cat.id, departmentId: dept && dept.id,
        manufacturer: o.manufacturer, model: o.model, serial: o.serial, status: st && st.id,
        lastInspection: U.isoDate(o.lastInspection), remarks: o.remarks,
        photo: /^https?:\/\//i.test(String(o.photo || '').trim()) ? String(o.photo).trim() : undefined,
      };
      if (String(o.lastInspection || '').trim() && !master.lastInspection) fail('lastInspection', `Invalid date "${o.lastInspection}"`);
      const loc = { floorId: floor && floor.id, zoneId: zone && zone.id, x: U.num(o.x), y: U.num(o.y) };
      const existing = id && S.asset(id);
      if (existing && mode === 'add') fail('id', `Asset ID "${id}" already exists (mode: add new only)`);
      if (!existing && id && S.history().some((h) => h.assetId === id && h.action === 'REMOVE')) fail('id', `Asset ID "${id}" belonged to a deleted asset — IDs are never reused`);
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
      analysis.creates.forEach(({ master, loc }) => { S.createAsset(master, loc, { by, reason: 'Initial registration (' + reason + ')', silent: true }); created++; });
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
    U.download(`factory-asset-map-backup-${U.stamp()}.json`, JSON.stringify(data, null, 1), 'application/json');
  };
  IO.restore = async () => {
    const file = await U.pickFile('.json,application/json');
    if (!file) return;
    let obj;
    try { obj = JSON.parse(await U.readFile(file, 'text')); } catch (e) { F.ui.toast('Not a valid JSON file.', 'error'); return; }
    const n = obj && Array.isArray(obj.assets) ? obj.assets.length : 0;
    const ok = await F.ui.confirm(`Restore <b>${U.esc(file.name)}</b> with ${n} assets? This replaces <b>all</b> current data in this browser.`, { okLabel: 'Restore backup', danger: true });
    if (!ok) return;
    try { S.importJSON(obj); F.ui.toast('Backup restored.', 'success'); } catch (e) { F.ui.toast(e.message, 'error', 6000); }
  };
})(window.FAM);
