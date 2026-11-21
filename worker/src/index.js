/**
 * Factory Asset Map — Cloudflare Worker API (data backend, D1).
 *
 * Endpoints
 *   GET  /api/health                      → { ok, records }
 *   GET  /api/changes?since=<ms>          → { now, records:[{c,id,data,deleted,updated_at}] }
 *   POST /api/changes   { ops:[...] }     → { now, applied, rejected:[{c,id,reason}] }
 *        op = { op:'put', c, id, data, isNew? } | { op:'del', c, id }
 *   POST /api/replace   { records:[{c,id,data}] }   (header X-Admin-Key when ADMIN_KEY is set)
 *        Replaces ALL data (demo reset, restore backup, clear all).
 *
 * Rules enforced server-side
 *   - No login needed to read or edit (as requested). Destructive full replace needs ADMIN_KEY.
 *   - Location history is append-only: history records can be inserted, never changed or deleted.
 *   - Asset IDs are unique and never reused: a new asset whose ID exists (or existed) is rejected,
 *     together with its location / registration records in the same request.
 */
const COLLECTIONS = new Set(['singleton', 'floors', 'departments', 'zones', 'categories', 'statuses', 'users', 'assets', 'locations', 'history', 'finTx', 'counts', 'countLines']);
const MIN_CLIENT_SCHEMA = 2; // client gửi header X-Client-Schema
const MAX_RECORD = 1_900_000; // D1 row size safety margin (bytes)
const MAX_BODY = 20_000_000;

function cors(req, env) {
  const origin = req.headers.get('Origin') || '';
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const ok = !allowed.length || allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    'Access-Control-Allow-Origin': ok ? origin || '*' : allowed[0] || '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Key, X-Client-Schema',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}
const json = (obj, status, headers) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });

let lastTs = 0;
const now = () => (lastTs = Math.max(Date.now(), lastTs + 1)); // strictly increasing per isolate

export default {
  async fetch(req, env) {
    const h = cors(req, env);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
    const url = new URL(req.url);
    try {
      if (url.pathname === '/api/health') {
        const r = await env.DB.prepare('SELECT COUNT(*) AS n FROM records WHERE deleted = 0').first();
        return json({ ok: true, records: r ? r.n : 0, adminKeyRequired: !!env.ADMIN_KEY }, 200, h);
      }
      if (url.pathname === '/api/changes' && req.method === 'GET') {
        const since = Number(url.searchParams.get('since') || 0);
        const ts = now();
        const { results } = await env.DB.prepare('SELECT c, id, data, deleted, updated_at FROM records WHERE updated_at >= ?1 ORDER BY updated_at').bind(since).all();
        return json({ now: ts, records: results.map((r) => ({ c: r.c, id: r.id, deleted: !!r.deleted, updated_at: r.updated_at, data: r.data ? JSON.parse(r.data) : null })) }, 200, h);
      }
      if (url.pathname === '/api/changes' && req.method === 'POST') {
        // Phiên bản ứng dụng cũ (chưa có module kế toán / kiểm kê) không được ghi, tránh xoá nhầm dữ liệu mới
        if (Number(req.headers.get('X-Client-Schema') || 1) < MIN_CLIENT_SCHEMA) {
          const body = await readBody(req);
          const ops = Array.isArray(body && body.ops) ? body.ops : [];
          return json({ now: now(), applied: 0, rejected: ops.map((o) => ({ c: o.c, id: o.id, reason: 'Ứng dụng đã có phiên bản mới — hãy tải lại trang (Ctrl+F5)' })) }, 200, h);
        }
        return json(await applyChanges(await readBody(req), env), 200, h);
      }
      if (url.pathname === '/api/replace' && req.method === 'POST') {
        if (env.ADMIN_KEY && req.headers.get('X-Admin-Key') !== env.ADMIN_KEY) return json({ error: 'Sai hoặc thiếu admin key.' }, 403, h);
        if (Number(req.headers.get('X-Client-Schema') || 1) < MIN_CLIENT_SCHEMA && req.headers.get('X-Admin-Tool') !== '1') return json({ error: 'Ứng dụng đã có phiên bản mới — hãy tải lại trang (Ctrl+F5).' }, 409, h);
        return json(await replaceAll(await readBody(req), env), 200, h);
      }
      if (url.pathname === '/' || url.pathname === '/api') return json({ app: 'Factory Asset Map API', endpoints: ['/api/health', '/api/changes', '/api/replace'] }, 200, h);
      return json({ error: 'Not found' }, 404, h);
    } catch (e) {
      return json({ error: e.message || String(e) }, e.status || 500, h);
    }
  },
};

async function readBody(req) {
  const len = Number(req.headers.get('Content-Length') || 0);
  if (len > MAX_BODY) throw Object.assign(new Error('Request too large'), { status: 413 });
  const text = await req.text();
  if (text.length > MAX_BODY) throw Object.assign(new Error('Request too large'), { status: 413 });
  try { return JSON.parse(text); } catch { throw Object.assign(new Error('Invalid JSON'), { status: 400 }); }
}

function checkRecord(c, id, data) {
  if (!COLLECTIONS.has(c)) return 'Unknown collection';
  if (typeof id !== 'string' || !id || id.length > 120) return 'Invalid id';
  if (data !== undefined) {
    const s = JSON.stringify(data);
    if (s.length > MAX_RECORD) return 'Bản ghi quá lớn (tối đa ~1,9 MB) — hãy dùng ảnh / bản vẽ nhỏ hơn';
  }
  return null;
}

async function applyChanges(body, env) {
  const ops = Array.isArray(body && body.ops) ? body.ops : [];
  const rejected = [];
  const rejectedAssets = new Set();
  let applied = 0;
  const ts = now();
  // Process new assets first so their dependent records can be rejected together.
  const order = (o) => (o.c === 'assets' && o.isNew ? 0 : o.c === 'assets' ? 1 : 2);
  ops.sort((a, b) => order(a) - order(b));

  for (const o of ops) {
    const bad = checkRecord(o.c, o.id, o.op === 'put' ? o.data : undefined);
    if (bad) { rejected.push({ c: o.c, id: o.id, reason: bad }); continue; }

    // dependents of a rejected duplicate asset
    if (o.c === 'locations' && rejectedAssets.has(o.id)) { rejected.push({ c: o.c, id: o.id, reason: 'Asset rejected' }); continue; }
    if (o.c === 'history' && o.data && rejectedAssets.has(o.data.assetId) && o.data.action === 'REGISTER') { rejected.push({ c: o.c, id: o.id, reason: 'Asset rejected' }); continue; }

    if (o.op === 'del') {
      if (o.c === 'history') { rejected.push({ c: o.c, id: o.id, reason: 'Lịch sử vị trí chỉ được ghi thêm, không được xoá' }); continue; }
      await env.DB.prepare('UPDATE records SET deleted = 1, data = NULL, updated_at = ?3 WHERE c = ?1 AND id = ?2').bind(o.c, o.id, ts).run();
      applied++;
      continue;
    }
    if (o.op !== 'put') { rejected.push({ c: o.c, id: o.id, reason: 'Unknown op' }); continue; }
    const data = JSON.stringify(o.data);

    if (o.c === 'history' || (o.c === 'assets' && o.isNew)) {
      const r = await env.DB.prepare('INSERT INTO records (c, id, data, deleted, updated_at) VALUES (?1, ?2, ?3, 0, ?4) ON CONFLICT (c, id) DO NOTHING').bind(o.c, o.id, data, ts).run();
      if (!r.meta.changes) {
        if (o.c === 'assets') {
          rejectedAssets.add(o.id);
          rejected.push({ c: o.c, id: o.id, reason: `Asset ID ${o.id} đã tồn tại hoặc đã từng được dùng` });
        } // existing history entries are left unchanged (append-only)
        continue;
      }
      applied++;
      continue;
    }
    await env.DB.prepare('INSERT INTO records (c, id, data, deleted, updated_at) VALUES (?1, ?2, ?3, 0, ?4) ON CONFLICT (c, id) DO UPDATE SET data = excluded.data, deleted = 0, updated_at = excluded.updated_at').bind(o.c, o.id, data, ts).run();
    applied++;
  }
  return { now: ts, applied, rejected };
}

async function replaceAll(body, env) {
  const records = Array.isArray(body && body.records) ? body.records : null;
  if (!records) throw Object.assign(new Error('records[] required'), { status: 400 });
  for (const r of records) {
    const bad = checkRecord(r.c, r.id, r.data);
    if (bad) throw Object.assign(new Error(`${r.c}/${r.id}: ${bad}`), { status: 400 });
  }
  const ts = now();
  const stmts = [env.DB.prepare('UPDATE records SET deleted = 1, data = NULL, updated_at = ?1').bind(ts)];
  const ins = env.DB.prepare('INSERT INTO records (c, id, data, deleted, updated_at) VALUES (?1, ?2, ?3, 0, ?4) ON CONFLICT (c, id) DO UPDATE SET data = excluded.data, deleted = 0, updated_at = excluded.updated_at');
  for (const r of records) stmts.push(ins.bind(r.c, r.id, JSON.stringify(r.data), ts));
  await env.DB.batch(stmts);
  return { now: ts, count: records.length };
}
