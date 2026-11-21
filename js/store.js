/*
 * Factory Asset Map — data store / repository layer.
 *
 * All reads and writes go through FAM.store. The demo persists to LocalStorage;
 * to move to a real database (Cloudflare D1, Supabase, PostgreSQL ...), replace the
 * persistence functions (load/commit) with API calls — the rest of the UI only uses
 * the functions exported here. See docs/DATABASE_MIGRATION.md.
 *
 * Entities (normalized):
 *   factory, floors, departments, zones, categories, statuses, users, settings
 *   assets      – master data (never contains location)
 *   locations   – current location per asset (assetId → floor/zone/x/y/code)
 *   history     – append-only location history
 */
window.FAM = window.FAM || {};
(function (F) {
  'use strict';
  const U = F.util;
  const KEY = 'fam.db.v1';
  const SCHEMA = 1;
  let db = null;
  const S = (F.store = {});

  /* ---------------- persistence ---------------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function seed() {
    const d = clone(F.DEMO);
    const out = {
      schemaVersion: SCHEMA,
      meta: { demo: true, seededAt: U.nowIso() },
      factory: d.factory,
      floors: d.floors.map((f) => ({ id: f.id, code: f.code, name: f.name, level: f.level, plan: { type: 'builtin', key: f.builtinPlan } })),
      departments: d.departments,
      zones: d.zones,
      categories: d.categories,
      statuses: d.statuses,
      users: d.users,
      settings: d.settings,
      assets: [],
      locations: [],
      history: [],
    };
    db = out;
    const movesByAsset = {};
    d.moves.forEach((m) => (movesByAsset[m.assetId] = movesByAsset[m.assetId] || []).push(m));
    Object.values(movesByAsset).forEach((list) => list.sort((a, b) => a.at.localeCompare(b.at)));

    d.assets.forEach((a) => {
      const { floorId, zoneId, x, y, updatedAt, ...master } = a;
      const current = { floorId, zoneId, x, y };
      out.assets.push({ ...master, photo: '', createdAt: d.registeredAt, updatedAt: updatedAt || d.registeredAt });
      const moves = movesByAsset[a.id] || [];
      const origin = moves.length ? moves[0].from : current;
      out.history.push(histRecord('REGISTER', a.id, a.name, null, origin, 'Quản trị viên', 'Đăng ký ban đầu (dữ liệu demo)', d.registeredAt));
      moves.forEach((m, i) => {
        const next = i + 1 < moves.length ? moves[i + 1].from : current;
        out.history.push(histRecord('MOVE', a.id, a.name, m.from, next, m.by, m.reason, m.at));
      });
      const lastMove = moves[moves.length - 1];
      out.locations.push({ assetId: a.id, ...current, code: locationCode(current), updatedAt: lastMove ? lastMove.at : d.registeredAt });
    });
    out.history.sort((a, b) => a.at.localeCompare(b.at));
    return out;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.schemaVersion === SCHEMA && Array.isArray(parsed.assets)) {
          db = parsed;
          return 'loaded';
        }
      }
    } catch (e) {
      console.warn('Could not read saved data, re-seeding demo', e);
    }
    db = seed();
    persist();
    return 'seeded';
  }

  function persist() {
    try {
      localStorage.setItem(KEY, JSON.stringify(db));
      return true;
    } catch (e) {
      console.error(e);
      U.bus.emit('store:error', 'Bộ nhớ trình duyệt đã đầy hoặc không khả dụng — thay đổi có thể chưa được lưu. Hãy tải bản sao lưu JSON và xoá bớt ảnh / bản vẽ dung lượng lớn.');
      return false;
    }
  }

  function commit(what) {
    persist();
    U.bus.emit('change', what || 'data');
    // tell the sync layer (js/remote.js) to push to the server
    U.bus.emit(what === 'reset' ? 'local-replace' : 'local-commit', what);
  }

  S.init = load;
  S.reset = () => { db = seed(); commit('reset'); };
  S.clearAll = () => {
    const keep = clone(db);
    db = {
      schemaVersion: SCHEMA,
      meta: { demo: false, clearedAt: U.nowIso() },
      factory: { ...keep.factory, name: 'Nhà máy của tôi' },
      floors: [{ id: 'F1', code: 'F1', name: 'Tầng 1', level: 1, plan: { type: 'blank' } }],
      departments: keep.departments,
      zones: [],
      categories: keep.categories,
      statuses: keep.statuses,
      users: keep.users,
      settings: keep.settings,
      assets: [], locations: [], history: [],
    };
    commit('reset');
  };
  S.storageBytes = () => { try { return (localStorage.getItem(KEY) || '').length * 2; } catch (e) { return 0; } };
  S.exportJSON = () => ({ app: 'Factory Asset Map', exportedAt: U.nowIso(), ...clone(db) });
  S.importJSON = (obj) => {
    if (!obj || obj.schemaVersion !== SCHEMA) throw new Error('File không phải bản sao lưu của Bản đồ tài sản (schemaVersion ' + (obj && obj.schemaVersion) + ').');
    const req = ['floors', 'departments', 'zones', 'categories', 'statuses', 'assets', 'locations', 'history'];
    req.forEach((k) => { if (!Array.isArray(obj[k])) throw new Error('Bản sao lưu thiếu mục "' + k + '".'); });
    const ids = new Set();
    obj.assets.forEach((a) => {
      if (!a.id) throw new Error('Bản sao lưu có tài sản không có Asset ID.');
      if (ids.has(a.id)) throw new Error('Bản sao lưu có Asset ID trùng: ' + a.id);
      ids.add(a.id);
    });
    const { app, exportedAt, ...rest } = obj;
    db = { users: [], settings: clone(F.DEMO.settings), factory: clone(F.DEMO.factory), ...rest };
    commit('reset');
  };

  /* ---------------- getters ---------------- */
  S.raw = () => db;
  S.factory = () => db.factory;
  S.settings = () => db.settings;
  S.isDemo = () => !!(db.meta && db.meta.demo);
  S.floors = () => db.floors.slice().sort((a, b) => (a.level ?? 0) - (b.level ?? 0));
  S.floor = (id) => db.floors.find((f) => f.id === id);
  S.departments = () => db.departments;
  S.dept = (id) => db.departments.find((d) => d.id === id);
  S.zones = (floorId) => db.zones.filter((z) => !floorId || z.floorId === floorId);
  S.zone = (id) => db.zones.find((z) => z.id === id);
  S.categories = () => db.categories;
  S.category = (id) => db.categories.find((c) => c.id === id);
  S.statuses = () => db.statuses;
  S.status = (id) => db.statuses.find((s) => s.id === id) || { id, name: id || '—', color: '#64748b' };
  S.users = () => db.users || [];
  S.assets = () => db.assets;
  S.asset = (id) => db.assets.find((a) => a.id === id);
  S.location = (assetId) => db.locations.find((l) => l.assetId === assetId);
  S.history = () => db.history;
  // "Acting as" user is per device (not shared through the server)
  S.currentUser = () => {
    let u = null;
    try { u = localStorage.getItem('fam.user'); } catch (e) { /* ignore */ }
    return u || (db.settings && db.settings.currentUser) || 'Không rõ';
  };
  S.setCurrentUser = (name) => {
    try { localStorage.setItem('fam.user', name); } catch (e) { /* ignore */ }
    U.bus.emit('change', 'user');
  };

  /* ---------------- record conversion (used by the server sync layer) ---------------- */
  const COLL = ['floors', 'departments', 'zones', 'categories', 'statuses', 'users', 'assets', 'locations', 'history'];
  const SINGLE = ['factory', 'settings', 'meta'];
  S.toRecords = (src) => {
    const d = src || db;
    const out = [];
    SINGLE.forEach((k) => { if (d[k]) out.push({ c: 'singleton', id: k, data: d[k] }); });
    COLL.forEach((c) => (d[c] || []).forEach((r) => out.push({ c, id: c === 'locations' ? r.assetId : r.id, data: r })));
    return out;
  };
  S.fromRecords = (records) => {
    const next = { schemaVersion: SCHEMA, factory: clone(F.DEMO.factory), settings: clone(F.DEMO.settings), meta: {} };
    COLL.forEach((c) => (next[c] = []));
    records.forEach((r) => {
      if (r.c === 'singleton') next[r.id] = r.data;
      else if (next[r.c]) next[r.c].push(r.data);
    });
    next.history.sort((a, b) => String(a.at).localeCompare(String(b.at)));
    next.schemaVersion = SCHEMA;
    db = next;
    persist();
    U.bus.emit('change', 'remote');
  };

  // Find by any of: id, code, or name (case-insensitive) — used by importers
  function findBy(list, v) {
    if (v === null || v === undefined) return null;
    const s = String(v).trim().toLowerCase();
    if (!s) return null;
    return list.find((x) => [x.id, x.code, x.name].some((k) => k && String(k).toLowerCase() === s)) || null;
  }
  S.findFloor = (v) => findBy(db.floors, v);
  S.findDept = (v) => findBy(db.departments, v);
  // English names are still accepted in imports (older files / English templates)
  const EN_CAT = { equipment: 'EQP', utility: 'UTL', lab: 'LAB', laboratory: 'LAB', furniture: 'FUR' };
  const EN_STATUS = { active: 'ACTIVE', 'inspection due': 'INSP', 'out of service': 'OOS' };
  const enKey = (v) => String(v || '').trim().toLowerCase();
  S.findCategory = (v) => findBy(db.categories, v) || findBy(db.categories, EN_CAT[enKey(v)]);
  S.findStatus = (v) => findBy(db.statuses, v) || findBy(db.statuses, EN_STATUS[enKey(v)]);
  S.findZone = (v, floorId) => findBy(db.zones.filter((z) => !floorId || z.floorId === floorId), v);

  /* Joined, read-only view of an asset for the UI */
  S.view = (id) => {
    const a = typeof id === 'string' ? S.asset(id) : id;
    if (!a) return null;
    const loc = S.location(a.id) || {};
    const floor = S.floor(loc.floorId);
    const zone = S.zone(loc.zoneId);
    const zoneDept = zone ? S.dept(zone.departmentId) : null;
    const cat = S.category(a.categoryId);
    const dept = S.dept(a.departmentId);
    const st = S.status(a.status);
    return {
      ...a,
      floorId: loc.floorId, zoneId: loc.zoneId, x: loc.x, y: loc.y, locationCode: loc.code || '', locationUpdatedAt: loc.updatedAt,
      floorName: floor ? floor.name : '—', floorCode: floor ? floor.code : '',
      zoneName: zone ? zone.name : '—', zoneCode: zone ? zone.code : '',
      areaDeptName: zoneDept ? zoneDept.name : '—',
      categoryName: cat ? cat.name : a.categoryId || '—', categoryShape: cat ? cat.shape : 'circle',
      deptName: dept ? dept.name : a.departmentId || '—',
      statusName: st.name, statusColor: st.color,
    };
  };
  S.views = () => db.assets.map((a) => S.view(a));

  /* ---------------- location coding ---------------- */
  // Location Code = <FloorCode>-<ZoneDeptCode>-<ZoneCode>-X<000>-Y<000>
  // X/Y = normalized % (0–100) of the drawing, origin top-left, X → right, Y ↓ down.
  function locationCode(loc) {
    if (!loc) return '';
    const fl = S.floor(loc.floorId);
    const z = S.zone(loc.zoneId);
    const d = z ? S.dept(z.departmentId) : null;
    const xx = U.pad(Math.round(U.clamp(Number(loc.x) || 0, 0, 100)), 3);
    const yy = U.pad(Math.round(U.clamp(Number(loc.y) || 0, 0, 100)), 3);
    return `${fl ? fl.code : 'F?'}-${d ? d.code : 'XX'}-${z ? z.code : 'NA'}-X${xx}-Y${yy}`;
  }
  S.locationCode = locationCode;
  S.recomputeCodes = () => db.locations.forEach((l) => (l.code = locationCode(l)));

  S.zoneAt = (floorId, x, y) => {
    const hits = S.zones(floorId).filter((z) => x >= z.x && x <= z.x + z.w && y >= z.y && y <= z.y + z.h);
    hits.sort((a, b) => a.w * a.h - b.w * b.h); // smallest zone wins when nested
    return hits[0] || null;
  };

  function snap(loc) {
    if (!loc) return null;
    const fl = S.floor(loc.floorId);
    const z = S.zone(loc.zoneId);
    return {
      floorId: loc.floorId, floorCode: fl ? fl.code : '', zoneId: loc.zoneId,
      zoneCode: z ? z.code : '', zoneName: z ? z.name : '',
      x: U.round1(loc.x), y: U.round1(loc.y), code: locationCode(loc),
    };
  }
  function histRecord(action, assetId, assetName, prev, next, by, reason, at) {
    return { id: U.uid('h'), at: at || U.nowIso(), action, assetId, assetName, prev: snap(prev), next: snap(next), updatedBy: by || S.currentUser(), reason: reason || '' };
  }

  /* ---------------- validation ---------------- */
  S.ID_PATTERN = /^[A-Z0-9][A-Z0-9_\-\.\/]{1,39}$/;
  S.nextAssetId = (categoryId) => {
    const cat = S.category(categoryId);
    const code = cat ? cat.code : 'GEN';
    const prefix = `AST-${code}-`;
    let max = 0;
    db.assets.forEach((a) => {
      if (a.id.startsWith(prefix)) {
        const n = parseInt(a.id.slice(prefix.length), 10);
        if (n > max) max = n;
      }
    });
    // history also reserves IDs of deleted assets (IDs are never reused)
    db.history.forEach((h) => {
      if (h.assetId && h.assetId.startsWith(prefix)) {
        const n = parseInt(h.assetId.slice(prefix.length), 10);
        if (n > max) max = n;
      }
    });
    return prefix + U.pad(max + 1, 4);
  };

  S.validateLocation = (loc) => {
    const e = {};
    if (!loc.floorId || !S.floor(loc.floorId)) e.floorId = 'Bắt buộc chọn tầng';
    if (!loc.zoneId || !S.zone(loc.zoneId)) e.zoneId = 'Bắt buộc chọn khu vực';
    else if (S.zone(loc.zoneId).floorId !== loc.floorId) e.zoneId = 'Khu vực không thuộc tầng đã chọn';
    const x = Number(loc.x), y = Number(loc.y);
    if (loc.x === '' || loc.x === null || isNaN(x) || x < 0 || x > 100) e.x = 'X phải là số từ 0 đến 100';
    if (loc.y === '' || loc.y === null || isNaN(y) || y < 0 || y > 100) e.y = 'Y phải là số từ 0 đến 100';
    return e;
  };

  S.validateAsset = (a, loc, isNew) => {
    const e = {};
    const id = String(a.id || '').trim();
    if (!id) e.id = 'Bắt buộc nhập Asset ID';
    else if (!S.ID_PATTERN.test(id)) e.id = 'Dùng 2–40 ký tự: A–Z, 0–9, - _ . /';
    else if (isNew && (S.asset(id) || db.history.some((h) => h.assetId === id && h.action === 'REMOVE')))
      e.id = S.asset(id) ? 'Asset ID đã tồn tại' : 'Asset ID đã dùng cho tài sản đã xoá — không được dùng lại';
    if (!String(a.name || '').trim()) e.name = 'Bắt buộc nhập tên tài sản';
    if (!a.categoryId || !S.category(a.categoryId)) e.categoryId = 'Bắt buộc chọn nhóm tài sản';
    if (!a.departmentId || !S.dept(a.departmentId)) e.departmentId = 'Bắt buộc chọn bộ phận';
    if (!a.status || !db.statuses.find((s) => s.id === a.status)) e.status = 'Bắt buộc chọn trạng thái';
    if (a.lastInspection && !/^\d{4}-\d{2}-\d{2}$/.test(a.lastInspection)) e.lastInspection = 'Định dạng YYYY-MM-DD';
    return Object.assign(e, S.validateLocation(loc));
  };

  function cleanMaster(a) {
    return {
      id: String(a.id).trim(),
      name: String(a.name || '').trim(),
      categoryId: a.categoryId,
      departmentId: a.departmentId,
      manufacturer: String(a.manufacturer || '').trim(),
      model: String(a.model || '').trim(),
      serial: String(a.serial || '').trim(),
      status: a.status,
      photo: a.photo || '',
      lastInspection: a.lastInspection || '',
      remarks: String(a.remarks || '').trim(),
    };
  }
  function cleanLoc(l) {
    return { floorId: l.floorId, zoneId: l.zoneId, x: U.round1(U.clamp(Number(l.x), 0, 100)), y: U.round1(U.clamp(Number(l.y), 0, 100)) };
  }
  const sameLoc = (a, b) => a && b && a.floorId === b.floorId && a.zoneId === b.zoneId && U.round1(a.x) === U.round1(b.x) && U.round1(a.y) === U.round1(b.y);

  /* ---------------- asset mutations ---------------- */
  class ValidationError extends Error {
    constructor(errors) { super(Object.values(errors).join('; ')); this.errors = errors; }
  }
  S.ValidationError = ValidationError;

  S.createAsset = (master, loc, opts = {}) => {
    const errs = S.validateAsset(master, loc, true);
    if (Object.keys(errs).length) throw new ValidationError(errs);
    const now = opts.at || U.nowIso();
    const a = { ...cleanMaster(master), createdAt: now, updatedAt: now };
    const l = cleanLoc(loc);
    db.assets.push(a);
    db.locations.push({ assetId: a.id, ...l, code: locationCode(l), updatedAt: now });
    db.history.push(histRecord('REGISTER', a.id, a.name, null, l, opts.by, opts.reason || 'Đăng ký ban đầu', now));
    if (!opts.silent) commit('asset');
    return a;
  };

  // Updates master data; if location differs it is recorded as a move (reason required).
  S.updateAsset = (id, master, loc, opts = {}) => {
    const a = S.asset(id);
    if (!a) throw new Error('Không tìm thấy tài sản: ' + id);
    const errs = S.validateAsset({ ...master, id }, loc, false);
    if (Object.keys(errs).length) throw new ValidationError(errs);
    const cur = S.location(id);
    const moving = !sameLoc(cur, cleanLoc(loc));
    if (moving && !String(opts.reason || '').trim()) throw new ValidationError({ reason: 'Bắt buộc nhập lý do khi thay đổi vị trí' });
    const clean = cleanMaster({ ...master, id }); // Asset ID is immutable
    Object.assign(a, clean, { updatedAt: U.nowIso() });
    if (moving) S.moveAsset(id, loc, { ...opts, silent: true });
    if (!opts.silent) commit('asset');
    return a;
  };

  S.moveAsset = (id, loc, opts = {}) => {
    const a = S.asset(id);
    if (!a) throw new Error('Không tìm thấy tài sản: ' + id);
    const errs = S.validateLocation(loc);
    if (!String(opts.reason || '').trim()) errs.reason = 'Bắt buộc nhập lý do thay đổi';
    if (Object.keys(errs).length) throw new ValidationError(errs);
    const cur = S.location(id);
    const next = cleanLoc(loc);
    if (sameLoc(cur, next)) return false;
    const now = U.nowIso();
    db.history.push(histRecord('MOVE', id, a.name, cur, next, opts.by, String(opts.reason).trim(), now));
    if (cur) Object.assign(cur, next, { code: locationCode(next), updatedAt: now });
    else db.locations.push({ assetId: id, ...next, code: locationCode(next), updatedAt: now });
    a.updatedAt = now;
    if (!opts.silent) commit('asset');
    return true;
  };

  S.deleteAsset = (id, opts = {}) => {
    const a = S.asset(id);
    if (!a) return;
    const cur = S.location(id);
    db.history.push(histRecord('REMOVE', id, a.name, cur, null, opts.by, opts.reason || 'Xoá khỏi sổ tài sản'));
    db.assets = db.assets.filter((x) => x.id !== id);
    db.locations = db.locations.filter((x) => x.assetId !== id);
    commit('asset');
  };

  S.batch = (fn) => { fn(); commit('asset'); };

  /* ---------------- structure mutations ---------------- */
  const CODE_RE = /^[A-Z0-9]{1,6}$/;
  function requireCode(code, list, selfId, label) {
    if (!CODE_RE.test(code || '')) throw new Error('Mã ' + label + ' phải gồm 1–6 ký tự A–Z / 0–9');
    if (list.some((x) => x.code === code && x.id !== selfId)) throw new Error('Mã ' + label + ' "' + code + '" đã tồn tại');
  }

  S.saveZone = (z) => {
    requireCode(z.code, db.zones.filter((x) => x.floorId === z.floorId), z.id, 'khu vực');
    if (!String(z.name || '').trim()) throw new Error('Bắt buộc nhập tên khu vực');
    if (!S.floor(z.floorId)) throw new Error('Bắt buộc chọn tầng');
    if (!S.dept(z.departmentId)) throw new Error('Bắt buộc chọn bộ phận');
    ['x', 'y', 'w', 'h'].forEach((k) => { z[k] = U.round1(Number(z[k])); if (isNaN(z[k])) throw new Error('Ranh giới khu vực phải là số'); });
    if (z.x < 0 || z.y < 0 || z.w <= 0 || z.h <= 0 || z.x + z.w > 100.01 || z.y + z.h > 100.01) throw new Error('Ranh giới khu vực phải nằm trong 0–100 %');
    const existing = z.id && S.zone(z.id);
    if (existing) {
      if (existing.floorId !== z.floorId && db.locations.some((l) => l.zoneId === z.id))
        throw new Error('Không thể chuyển khu vực đang có tài sản sang tầng khác. Hãy di chuyển tài sản trước.');
      Object.assign(existing, z);
    } else db.zones.push({ ...z, id: z.id || U.uid('Z') });
    S.recomputeCodes();
    commit('structure');
  };
  S.deleteZone = (id) => {
    const n = db.locations.filter((l) => l.zoneId === id).length;
    if (n) throw new Error(`Khu vực đang có ${n} tài sản. Hãy chuyển sang khu vực khác trước.`);
    db.zones = db.zones.filter((z) => z.id !== id);
    commit('structure');
  };
  S.saveFloor = (f) => {
    requireCode(f.code, db.floors, f.id, 'tầng');
    if (!String(f.name || '').trim()) throw new Error('Bắt buộc nhập tên tầng');
    const existing = f.id && S.floor(f.id);
    if (existing) Object.assign(existing, { code: f.code, name: f.name, level: Number(f.level) || 0 });
    else db.floors.push({ id: U.uid('FL'), code: f.code, name: f.name, level: Number(f.level) || 0, plan: { type: 'blank' } });
    S.recomputeCodes();
    commit('structure');
  };
  S.deleteFloor = (id) => {
    if (db.zones.some((z) => z.floorId === id)) throw new Error('Tầng vẫn còn khu vực. Hãy xoá hoặc chuyển các khu vực trước.');
    if (db.floors.length <= 1) throw new Error('Cần ít nhất một tầng.');
    db.floors = db.floors.filter((f) => f.id !== id);
    commit('structure');
  };
  S.setFloorPlan = (id, plan) => {
    const f = S.floor(id);
    if (!f) throw new Error('Không tìm thấy tầng');
    const before = f.plan;
    f.plan = plan;
    if (!persist()) { f.plan = before; throw new Error('Không đủ bộ nhớ trình duyệt cho bản vẽ này. Dùng SVG nhỏ/tối ưu hơn hoặc PNG/JPG nén.'); }
    U.bus.emit('change', 'structure');
    U.bus.emit('local-commit', 'structure');
  };
  // Renderable plan: { href, w, h, label }
  S.planInfo = (floor) => {
    const p = (floor && floor.plan) || { type: 'blank' };
    if (p.type === 'builtin' && F.FLOORPLANS && F.FLOORPLANS[p.key]) {
      const svg = F.FLOORPLANS[p.key];
      const sz = U.svgSize(svg) || { w: 1000, h: 600 };
      return { href: U.svgToDataUrl(svg), w: sz.w, h: sz.h, label: 'Bản vẽ mẫu (demo)', svg };
    }
    if (p.type === 'svg') return { href: U.svgToDataUrl(p.data), w: p.w, h: p.h, label: p.name || 'SVG đã nhập', svg: p.data };
    if (p.type === 'image') return { href: p.data, w: p.w, h: p.h, label: p.name || 'Ảnh đã nhập' };
    const blank = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600"><defs><pattern id="g" width="50" height="50" patternUnits="userSpaceOnUse"><path d="M50 0H0V50" fill="none" stroke="#e2e8f0"/></pattern></defs><rect width="1000" height="600" fill="#fff"/><rect width="1000" height="600" fill="url(#g)"/><rect x="2" y="2" width="996" height="596" fill="none" stroke="#94a3b8" stroke-width="4" stroke-dasharray="12 8"/><text x="500" y="300" font-family="Arial" font-size="22" fill="#94a3b8" text-anchor="middle">Chưa có bản vẽ — Khu vực nhà máy → Tầng → Nhập bản vẽ</text></svg>`;
    return { href: U.svgToDataUrl(blank), w: 1000, h: 600, label: 'Chưa có bản vẽ', svg: blank };
  };

  S.saveDepartment = (d) => {
    requireCode(d.code, db.departments, d.id, 'bộ phận');
    if (!String(d.name || '').trim()) throw new Error('Bắt buộc nhập tên bộ phận');
    const existing = d.id && S.dept(d.id);
    if (existing) Object.assign(existing, { code: d.code, name: d.name });
    else db.departments.push({ id: d.code, code: d.code, name: d.name });
    S.recomputeCodes();
    commit('structure');
  };
  S.deleteDepartment = (id) => {
    if (db.zones.some((z) => z.departmentId === id)) throw new Error('Bộ phận đang được gán cho khu vực.');
    if (db.assets.some((a) => a.departmentId === id)) throw new Error('Bộ phận đang quản lý tài sản.');
    db.departments = db.departments.filter((d) => d.id !== id);
    commit('structure');
  };

  S.saveCategory = (c) => {
    requireCode(c.code, db.categories, c.id, 'nhóm');
    if (!String(c.name || '').trim()) throw new Error('Bắt buộc nhập tên nhóm');
    const existing = c.id && S.category(c.id);
    if (existing) Object.assign(existing, { name: c.name, shape: c.shape || 'circle' }); // code is fixed once used in IDs
    else db.categories.push({ id: c.code, code: c.code, name: c.name, shape: c.shape || 'circle' });
    commit('config');
  };
  S.deleteCategory = (id) => {
    if (db.assets.some((a) => a.categoryId === id)) throw new Error('Nhóm đang được dùng cho tài sản.');
    db.categories = db.categories.filter((c) => c.id !== id);
    commit('config');
  };
  S.saveStatus = (s) => {
    if (!String(s.name || '').trim()) throw new Error('Bắt buộc nhập tên trạng thái');
    if (!/^#[0-9a-f]{6}$/i.test(s.color || '')) throw new Error('Màu phải có dạng #RRGGBB');
    const existing = s.id && db.statuses.find((x) => x.id === s.id);
    if (existing) Object.assign(existing, { name: s.name, color: s.color });
    else {
      const id = s.name.toUpperCase().replace(/[^A-Z0-9]+/g, '_').slice(0, 12) || U.uid('ST');
      if (db.statuses.some((x) => x.id === id)) throw new Error('Trạng thái đã tồn tại');
      db.statuses.push({ id, name: s.name, color: s.color, core: false });
    }
    commit('config');
  };
  S.deleteStatus = (id) => {
    const st = db.statuses.find((s) => s.id === id);
    if (st && st.core) throw new Error('Không xoá được trạng thái gốc (chỉ đổi tên).');
    if (db.assets.some((a) => a.status === id)) throw new Error('Trạng thái đang được dùng cho tài sản.');
    db.statuses = db.statuses.filter((s) => s.id !== id);
    commit('config');
  };
  S.saveUser = (u) => {
    if (!String(u.name || '').trim()) throw new Error('Bắt buộc nhập tên người dùng');
    db.users = db.users || [];
    const existing = u.id && db.users.find((x) => x.id === u.id);
    if (existing) Object.assign(existing, { name: u.name, role: u.role || '' });
    else db.users.push({ id: U.uid('U'), name: u.name.trim(), role: u.role || '' });
    commit('config');
  };
  S.deleteUser = (id) => { db.users = db.users.filter((u) => u.id !== id); commit('config'); };
  S.updateSettings = (patch) => { Object.assign(db.settings, patch); commit('settings'); };
  S.updateFactory = (patch) => { Object.assign(db.factory, patch); commit('settings'); };
})(window.FAM);
