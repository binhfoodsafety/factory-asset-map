/*
 * Factory Asset Map — server sync (Cloudflare Worker + D1).
 *
 * The app keeps working from LocalStorage (fast, offline-capable). When js/config.js sets
 * FAM_CONFIG.apiBase, every change is pushed to the server and changes from other users are
 * pulled every 20 s. Sync is record-based: each asset / location / history entry / zone ... is a
 * record; only changed records are sent (detected by hashing against the last synced state).
 * No login is needed. Replacing ALL data (reset demo, restore backup, clear) needs the admin key.
 */
window.FAM = window.FAM || {};
(function (F) {
  'use strict';
  const U = F.util, S = F.store, UI = F.ui;
  const R = (F.remote = {});
  const base = String((window.FAM_CONFIG && window.FAM_CONFIG.apiBase) || '').replace(/\/+$/, '');
  const SKEY = 'fam.sync.v1';
  const POLL_MS = 20000;
  const CLIENT_SCHEMA = 2; // tăng khi thêm loại dữ liệu mới; Worker từ chối ghi từ phiên bản cũ hơn MIN_CLIENT_SCHEMA
  let sync = { base, since: 0, hashes: {} };
  let state = { status: base ? 'connecting' : 'local', detail: '', at: null };
  let pushing = false, pushAgain = false, pushTimer = null, ready = false;

  R.enabled = () => !!base;
  R.base = () => base;
  R.state = () => state;

  /* ---------- helpers ---------- */
  function hash(str) { // FNV-1a 32-bit
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(36) + ':' + str.length;
  }
  const keyOf = (r) => r.c + '/' + r.id;
  const splitKey = (k) => { const i = k.indexOf('/'); return { c: k.slice(0, i), id: k.slice(i + 1) }; };
  const known = (r) => S.syncKnown(r);
  const hashOf = (data) => hash(JSON.stringify(data));
  function loadSync() {
    try { const s = JSON.parse(localStorage.getItem(SKEY)); if (s && s.base === base) sync = s; } catch (e) { /* ignore */ }
    Object.keys(sync.hashes).forEach((k) => { if (!known(splitKey(k))) delete sync.hashes[k]; });
  }
  function saveSync() { try { localStorage.setItem(SKEY, JSON.stringify(sync)); } catch (e) { /* ignore */ } }
  function setStatus(status, detail) {
    state = { status, detail: detail || '', at: new Date() };
    U.bus.emit('sync-status', state);
  }
  async function api(path, opts = {}) {
    const res = await fetch(base + path, { ...opts, headers: { 'Content-Type': 'application/json', 'X-Client-Schema': String(CLIENT_SCHEMA), ...(opts.headers || {}) } });
    let body = {};
    try { body = await res.json(); } catch (e) { /* empty */ }
    if (!res.ok) throw Object.assign(new Error(body.error || res.status + ' ' + res.statusText), { status: res.status });
    return body;
  }
  function localMap() {
    const m = new Map();
    S.toRecords().forEach((r) => m.set(keyOf(r), r));
    return m;
  }
  const isDirty = (k, rec) => (rec ? hashOf(rec.data) : undefined) !== sync.hashes[k];

  /* ---------- initial load ---------- */
  R.init = async () => {
    if (!base) { setStatus('local'); return; }
    loadSync();
    setStatus('connecting');
    try {
      const res = await api('/api/changes?since=0');
      const live = res.records.filter((r) => !r.deleted && known(r));
      const firstTimeHere = !Object.keys(sync.hashes).length;
      if (!live.length) {
        // Empty server (first deployment): upload the data in this browser (demo dataset).
        sync.hashes = {};
      } else {
        const local = localMap();
        const merged = new Map(live.map((r) => [keyOf(r), { c: r.c, id: r.id, data: r.data }]));
        if (!firstTimeHere) {
          // keep changes made in this browser while offline
          local.forEach((rec, k) => { if (isDirty(k, rec)) merged.set(k, rec); });
          Object.keys(sync.hashes).forEach((k) => { if (!local.has(k) && !k.startsWith('history/')) merged.delete(k); });
        }
        sync.hashes = {};
        live.forEach((r) => (sync.hashes[keyOf(r)] = hashOf(r.data)));
        S.fromRecords([...merged.values()]);
      }
      sync.since = res.now;
      saveSync();
      ready = true;
      setStatus('online');
      await R.push();
    } catch (e) {
      ready = true; // work offline with local data
      setStatus('offline', e.message);
    }
    setInterval(() => { if (document.visibilityState === 'visible') R.tick(); }, POLL_MS);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') R.tick(); });
    window.addEventListener('online', () => R.tick());
  };

  R.tick = async () => {
    if (!base || !ready) return;
    await R.push();
    await R.pull();
  };

  /* ---------- pull changes from other users ---------- */
  R.pull = async (force) => {
    if (!base || pushing) return;
    try {
      const res = await api('/api/changes?since=' + (force ? 0 : sync.since));
      const local = localMap();
      let changed = false;
      res.records.filter(known).forEach((r) => {
        const k = keyOf(r);
        const cur = local.get(k);
        const forced = force && force.has(k);
        if (!forced && isDirty(k, cur)) return; // local unsynced change wins (pushed next)
        if (force && !forced && !r.deleted && cur && hashOf(cur.data) === hashOf(r.data)) { sync.hashes[k] = hashOf(r.data); return; }
        if (r.deleted) {
          if (cur) { local.delete(k); changed = true; }
          delete sync.hashes[k];
        } else {
          const h = hashOf(r.data);
          if (!cur || hashOf(cur.data) !== h) { local.set(k, { c: r.c, id: r.id, data: r.data }); changed = true; }
          sync.hashes[k] = h;
        }
      });
      if (force) { // records the server does not have: drop local copies of rejected keys
        const onServer = new Set(res.records.filter((r) => !r.deleted && known(r)).map(keyOf));
        force.forEach((k) => { if (!onServer.has(k) && local.has(k)) { local.delete(k); delete sync.hashes[k]; changed = true; } });
      }
      sync.since = res.now;
      saveSync();
      if (changed) S.fromRecords([...local.values()]);
      setStatus('online');
    } catch (e) {
      setStatus('offline', e.message);
    }
  };

  /* ---------- push local changes ---------- */
  U.bus.on('local-commit', () => {
    if (!base) return;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => R.push(), 300);
  });

  R.push = async () => {
    if (!base || !ready) return;
    if (pushing) { pushAgain = true; return; }
    const local = localMap();
    const ops = [];
    local.forEach((rec, k) => {
      if (isDirty(k, rec)) ops.push({ op: 'put', c: rec.c, id: rec.id, data: rec.data, isNew: rec.c === 'assets' && !(k in sync.hashes), _h: hashOf(rec.data) });
    });
    Object.keys(sync.hashes).forEach((k) => {
      const r = splitKey(k);
      if (!local.has(k) && known(r)) ops.push({ op: 'del', c: r.c, id: r.id });
    });
    if (!ops.length) return;
    pushing = true;
    setStatus('saving');
    try {
      const res = await api('/api/changes', { method: 'POST', body: JSON.stringify({ ops: ops.map(({ _h, ...o }) => o) }) });
      const rej = new Set(res.rejected.map(keyOf));
      ops.forEach((o) => {
        const k = keyOf(o);
        if (rej.has(k)) return;
        if (o.op === 'del') delete sync.hashes[k];
        else sync.hashes[k] = o._h;
      });
      saveSync();
      pushing = false;
      if (res.rejected.length) {
        const msgs = [...new Set(res.rejected.filter((r) => r.reason !== 'Asset rejected').map((r) => r.reason))];
        UI.toast('Máy chủ từ chối một số thay đổi: ' + msgs.join('; ') + '. Đã tải lại dữ liệu từ máy chủ.', 'error', 8000);
        await R.pull(rej);
      } else setStatus('online');
    } catch (e) {
      pushing = false;
      setStatus('offline', e.message);
    }
    if (pushAgain) { pushAgain = false; await R.push(); }
  };

  /* ---------- replace all (reset demo / restore backup / clear) ---------- */
  function askAdminKey() {
    return new Promise((resolve) => {
      let key = null;
      try { key = sessionStorage.getItem('fam.adminKey'); } catch (e) { /* ignore */ }
      if (key) return resolve(key);
      const form = U.h(`<form><p class="small">Thao tác này thay <b>toàn bộ dữ liệu dùng chung trên máy chủ</b> cho mọi người dùng. Nhập admin key (đặt trên Cloudflare Worker) để tiếp tục.</p>
        <div class="field"><label>Admin key</label><input name="k" type="password" autocomplete="off"></div></form>`);
      let done = false;
      UI.modal({
        title: 'Cần admin key', size: 'modal-sm', body: form,
        actions: [{ label: 'Hủy' }, { label: 'Tiếp tục', primary: true, onClick: () => { done = true; resolve(U.$('[name=k]', form).value.trim()); } }],
        onClose: () => { if (!done) resolve(null); },
      });
    });
  }
  U.bus.on('local-replace', async () => {
    if (!base) return;
    const key = await askAdminKey();
    if (!key) { UI.toast('Đã hủy — dữ liệu máy chủ không đổi. Đang tải lại dữ liệu từ máy chủ.', 'info'); return reloadAll(); }
    setStatus('saving');
    try {
      const records = S.toRecords();
      const res = await api('/api/replace', { method: 'POST', headers: { 'X-Admin-Key': key }, body: JSON.stringify({ records }) });
      try { sessionStorage.setItem('fam.adminKey', key); } catch (e) { /* ignore */ }
      sync.hashes = {};
      records.forEach((r) => (sync.hashes[keyOf(r)] = hashOf(r.data)));
      sync.since = res.now;
      saveSync();
      setStatus('online');
      UI.toast('Đã thay dữ liệu máy chủ cho tất cả người dùng.', 'success');
    } catch (e) {
      try { sessionStorage.removeItem('fam.adminKey'); } catch (err) { /* ignore */ }
      UI.toast('Dữ liệu máy chủ KHÔNG thay đổi: ' + e.message + ' — đang tải lại dữ liệu từ máy chủ.', 'error', 7000);
      reloadAll();
    }
  });
  async function reloadAll() {
    try {
      const res = await api('/api/changes?since=0');
      const live = res.records.filter((r) => !r.deleted && known(r));
      sync.hashes = {};
      live.forEach((r) => (sync.hashes[keyOf(r)] = hashOf(r.data)));
      sync.since = res.now;
      saveSync();
      S.fromRecords(live.map((r) => ({ c: r.c, id: r.id, data: r.data })));
      setStatus('online');
    } catch (e) { setStatus('offline', e.message); }
  }
  R.reloadAll = reloadAll;
})(window.FAM);
