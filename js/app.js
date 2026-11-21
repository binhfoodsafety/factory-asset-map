/* Factory Asset Map — application shell: routing, top bar, initialisation. */
window.FAM = window.FAM || {};
(function (F) {
  'use strict';
  const U = F.util, S = F.store, UI = F.ui;
  const A = (F.app = {});
  const ROUTES = {
    dashboard: { title: 'Dashboard – Tổng quan', view: () => F.views.dashboard },
    map: { title: 'Sơ đồ nhà máy tương tác', view: () => F.views.map },
    register: { title: 'Sổ tài sản (Asset Register)', view: () => F.views.register },
    zones: { title: 'Khu vực nhà máy', view: () => F.views.zones },
    history: { title: 'Lịch sử vị trí', view: () => F.views.history },
    qr: { title: 'Quản lý mã QR', view: () => F.views.qr },
    settings: { title: 'Cài đặt & Hướng dẫn', view: () => F.views.settings },
  };
  let current = null;
  let lastHash = null;

  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const [name, qs] = h.split('?');
    const params = {};
    new URLSearchParams(qs || '').forEach((v, k) => (params[k] = v));
    return { name: ROUTES[name] ? name : 'dashboard', params };
  }

  function route() {
    lastHash = location.hash;
    const { name, params } = parseHash();
    const prev = current;
    if (prev && prev !== name) { const pv = ROUTES[prev].view(); pv && pv.hide && pv.hide(); }
    current = name;
    U.$$('.view').forEach((v) => (v.hidden = v.id !== 'view-' + name));
    U.$$('#nav a').forEach((a) => a.classList.toggle('active', a.dataset.route === name));
    U.$('#pageTitle').textContent = ROUTES[name].title;
    document.title = ROUTES[name].title + ' · Bản đồ tài sản nhà máy';
    document.body.classList.remove('nav-open');
    const viewsEl = U.$('#views');
    if (prev !== name) viewsEl.scrollTop = 0;
    try { ROUTES[name].view().show(params); } catch (e) { console.error(e); UI.toast('Lỗi hiển thị trang: ' + e.message, 'error', 6000); }
  }

  A.current = () => current;
  A.go = (name, params) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')).toString() : '';
    const hash = '#/' + name + (qs.length > 1 ? qs : '');
    if (location.hash !== hash) history.pushState(null, '', hash);
    route();
  };

  function refreshShell() {
    U.$('#factoryName').textContent = S.factory().name;
    U.$('#demoBanner').hidden = !S.isDemo();
    const users = S.users();
    const cur = S.currentUser();
    const names = users.map((u) => u.name);
    if (!names.includes(cur)) names.unshift(cur);
    U.$('#userSelect').innerHTML = names.map((n) => `<option ${n === cur ? 'selected' : ''}>${U.esc(n)}</option>`).join('');
    U.$('#assetIdList').innerHTML = S.assets().map((a) => `<option value="${U.esc(a.id)}">${U.esc(a.name)}</option>`).join('');
    const kb = S.storageBytes() / 1024;
    U.$('#storageInfo').textContent = `${S.assets().length} tài sản · lưu ${kb > 1024 ? (kb / 1024).toFixed(1) + ' MB' : Math.round(kb) + ' KB'}`;
  }

  function init() {
    // icons in static markup
    U.$$('[data-icon]').forEach((el) => (el.innerHTML = U.icon(el.dataset.icon, el.classList.contains('gs-ic') ? 16 : 18)));
    U.$('#menuBtn').innerHTML = U.icon('menu', 20);

    const state = S.init();
    if (state === 'seeded' && !F.remote.enabled()) setTimeout(() => UI.toast('Đã nạp dữ liệu demo (nhà máy cà phê minh họa).', 'info', 4500), 400);
    U.bus.on('sync-status', renderSync);
    renderSync(F.remote.state());

    U.$('#menuBtn').addEventListener('click', () => document.body.classList.toggle('nav-open'));
    U.$('#sidebarScrim').addEventListener('click', () => document.body.classList.remove('nav-open'));
    U.$('#userSelect').addEventListener('change', (e) => S.setCurrentUser(e.target.value));
    U.$('#globalSearch').addEventListener('submit', (e) => {
      e.preventDefault();
      const inp = U.$('#globalSearchInput');
      const q = inp.value.trim();
      if (!q) return;
      const a = F.views.map.findAsset(q);
      if (!a) return UI.toast(`Không tìm thấy tài sản "${q}"`, 'error');
      inp.value = '';
      inp.blur();
      if (current === 'map') F.views.map.locate(a.id);
      else A.go('map', { asset: a.id });
    });
    U.$('#demoBanner [data-goto]').addEventListener('click', (e) => { e.preventDefault(); A.go('settings', { section: 'data' }); });

    U.bus.on('change', () => {
      refreshShell();
      const v = current && ROUTES[current].view();
      if (v && v.refresh) v.refresh();
    });
    U.bus.on('store:error', (msg) => UI.toast(msg, 'error', 8000));
    window.addEventListener('hashchange', () => { if (location.hash !== lastHash) route(); });
    window.addEventListener('popstate', () => { if (location.hash !== lastHash) route(); });
    window.addEventListener('afterprint', () => { U.$('#printArea').innerHTML = ''; });
    // keep tabs in sync when data is changed in another tab/window
    window.addEventListener('storage', (e) => { if (e.key === 'fam.db.v1') { S.init(); U.bus.emit('change', 'external'); } });

    refreshShell();
    route();
    F.remote.init();
  }

  function renderSync(st) {
    const el = U.$('#syncInfo');
    if (!el) return;
    const t = st.at ? st.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
    const map = {
      local: ['#94a3b8', 'Chỉ lưu trên trình duyệt này'],
      connecting: ['#fbbf24', 'Đang kết nối máy chủ…'],
      saving: ['#38bdf8', 'Đang lưu lên máy chủ…'],
      online: ['#34d399', 'Đã đồng bộ Cloudflare · ' + t],
      offline: ['#f87171', 'Mất kết nối — thay đổi lưu tạm trên máy'],
    };
    const [c, label] = map[st.status] || map.local;
    el.innerHTML = `<i class="dot" style="--c:${c}"></i> ${U.esc(label)}`;
    el.title = st.detail || (F.remote.enabled() ? 'Máy chủ: ' + F.remote.base() : 'Chưa cấu hình máy chủ (js/config.js)');
  }

  document.addEventListener('DOMContentLoaded', init);
})(window.FAM);
