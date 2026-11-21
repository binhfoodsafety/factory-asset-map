/* Factory Asset Map — TAB 06 QR code management (generate, preview, PNG, printable labels, lookup/scan). */
window.FAM = window.FAM || {};
(function (F) {
  'use strict';
  const U = F.util, S = F.store, UI = F.ui;
  F.views = F.views || {};
  const Q = (F.views.qr = {});
  const st = { q: '', floor: '', cat: '', selected: new Set(), current: null, labelSize: '63x38' };
  const SIZES = {
    '63x38': { w: 63.5, h: 38.1, cols: 3, label: '63.5 × 38.1 mm (3 per row, A4)' },
    '50x30': { w: 50, h: 30, cols: 3, label: '50 × 30 mm (3 per row)' },
    '100x50': { w: 99, h: 50, cols: 2, label: '99 × 50 mm (2 per row)' },
  };
  let built = false, stream = null, scanTimer = null;

  const hasLib = () => typeof window.qrcode === 'function';
  Q.baseUrl = () => (S.settings().qrBaseUrl || '').trim() || location.href.split('#')[0];
  Q.content = (id) => `${Q.baseUrl()}#/map?asset=${encodeURIComponent(id)}`;
  function make(text) {
    const qr = window.qrcode(0, 'M');
    qr.addData(text, 'Byte');
    qr.make();
    return qr;
  }
  Q.svg = (id) => {
    if (!hasLib()) return `<div class="small muted" style="text-align:center">QR library not loaded (offline?).<br>See README → Offline use.</div>`;
    const qr = make(Q.content(id));
    const n = qr.getModuleCount(), m = 2;
    let d = '';
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + m} ${r + m}h1v1h-1z`;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n + m * 2} ${n + m * 2}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#000"/></svg>`;
  };
  Q.png = (id) => {
    const v = S.view(id);
    const qr = make(Q.content(id));
    const n = qr.getModuleCount(), cell = 10, m = 4;
    const size = (n + m * 2) * cell;
    const c = document.createElement('canvas');
    c.width = size; c.height = size + 92;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = '#000';
    for (let r = 0; r < n; r++) for (let col = 0; col < n; col++) if (qr.isDark(r, col)) ctx.fillRect((col + m) * cell, (r + m) * cell, cell, cell);
    ctx.textAlign = 'center';
    ctx.font = 'bold 30px Consolas, monospace'; ctx.fillText(v.id, size / 2, size + 22);
    ctx.font = '20px Arial, sans-serif'; ctx.fillText(v.name.slice(0, 40), size / 2, size + 52);
    ctx.font = '16px Consolas, monospace'; ctx.fillStyle = '#444'; ctx.fillText(v.locationCode, size / 2, size + 78);
    return c.toDataURL('image/png');
  };

  function filtered() {
    const q = st.q.trim().toLowerCase();
    return S.views().filter((v) => (!st.floor || v.floorId === st.floor) && (!st.cat || v.categoryId === st.cat) &&
      (!q || [v.id, v.name, v.locationCode, v.serial].some((s) => String(s || '').toLowerCase().includes(q)))).sort((a, b) => a.id.localeCompare(b.id));
  }

  function build() {
    const root = U.$('#view-qr');
    root.innerHTML = `
      <div class="view-head"><h2>QR Code Management</h2>
        <div class="sub">QR codes <b>identify</b> assets (Asset ID + link to the asset on the map). They do not provide real-time GPS tracking — the location shown is the last location recorded in this system.</div></div>
      <div class="qr-layout">
        <div class="card">
          <div class="toolbar">
            <div class="search">${U.icon('search', 16)}<input type="search" id="qrQ" placeholder="Filter assets…"></div>
            <select id="qrFloor"></select><select id="qrCat"></select>
            <span class="count" id="qrCount"></span>
          </div>
          <div class="toolbar" style="border-top:1px solid var(--line)">
            <label class="check"><input type="checkbox" id="qrAll"> Select all shown</label>
            <select id="qrSize" title="Label size">${Object.entries(SIZES).map(([k, s]) => `<option value="${k}">${s.label}</option>`).join('')}</select>
            <button class="btn btn-primary btn-sm" id="qrPrint">${U.icon('printer', 15)}Print labels</button>
          </div>
          <div class="table-wrap" style="max-height:calc(100vh - 290px)" id="qrTable"></div>
        </div>
        <div class="grid">
          <div class="card"><div class="card-head"><h3>Preview</h3></div><div id="qrPreview"></div></div>
          <div class="card"><div class="card-head"><h3>Scan / look up asset</h3></div>
            <div class="card-body">
              <form id="qrLookup" class="field-row" autocomplete="off"><input id="qrLookupIn" placeholder="Scan with USB/Bluetooth scanner or type Asset ID"><button class="btn btn-primary">Find</button></form>
              <p class="small muted" style="margin-top:8px">Handheld barcode/QR scanners that act as a keyboard work here: scan, and the asset opens on the map. Phones can simply scan the label with their camera app to open the link.</p>
              <div id="qrCamBox"></div>
            </div></div>
        </div>
      </div>`;
    U.$('#qrQ').addEventListener('input', U.debounce((e) => { st.q = e.target.value; renderList(); }, 150));
    U.$('#qrFloor').addEventListener('change', (e) => { st.floor = e.target.value; renderList(); });
    U.$('#qrCat').addEventListener('change', (e) => { st.cat = e.target.value; renderList(); });
    U.$('#qrSize').addEventListener('change', (e) => { st.labelSize = e.target.value; });
    U.$('#qrAll').addEventListener('change', (e) => { filtered().forEach((v) => (e.target.checked ? st.selected.add(v.id) : st.selected.delete(v.id))); renderList(); });
    U.$('#qrPrint').addEventListener('click', () => {
      const ids = [...st.selected].filter((id) => S.asset(id));
      if (!ids.length) return UI.toast('Select one or more assets to print labels.', 'error');
      Q.printLabels(ids);
    });
    U.$('#qrTable').addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (!tr) return;
      if (e.target.matches('input[type=checkbox]')) {
        e.target.checked ? st.selected.add(tr.dataset.id) : st.selected.delete(tr.dataset.id);
        updatePrintBtn();
        return;
      }
      st.current = tr.dataset.id;
      renderList(); renderPreview();
    });
    U.$('#qrLookup').addEventListener('submit', (e) => { e.preventDefault(); lookup(U.$('#qrLookupIn').value); });
    const cam = U.$('#qrCamBox');
    if ('BarcodeDetector' in window && navigator.mediaDevices) {
      cam.innerHTML = `<button class="btn" id="qrCamBtn">${U.icon('camera', 16)}Scan with camera</button><div id="qrCamArea" style="margin-top:10px"></div>`;
      U.$('#qrCamBtn').addEventListener('click', toggleCamera);
    } else {
      cam.innerHTML = `<div class="callout">${U.icon('info', 16)}<div class="small"><b>In-browser camera scanning</b> needs the BarcodeDetector API (Chrome/Edge on Android, ChromeOS, macOS). It is not available in this browser — use a phone camera app or a handheld scanner instead. <span class="future-tag">FUTURE INTEGRATION</span> cross-browser camera scanning via a bundled decoder library.</div></div>`;
    }
    built = true;
  }

  function updatePrintBtn() { U.$('#qrPrint').innerHTML = `${U.icon('printer', 15)}Print labels${st.selected.size ? ` (${st.selected.size})` : ''}`; }
  function renderList() {
    U.$('#qrFloor').innerHTML = UI.options(S.floors(), st.floor, { empty: 'All floors', label: (f) => f.code + ' – ' + f.name });
    U.$('#qrCat').innerHTML = UI.options(S.categories(), st.cat, { empty: 'All categories' });
    const list = filtered();
    U.$('#qrCount').textContent = `${list.length} asset(s)`;
    U.$('#qrAll').checked = list.length > 0 && list.every((v) => st.selected.has(v.id));
    U.$('#qrTable').innerHTML = list.length ? `<table class="tbl qr-list"><thead><tr><th></th><th>Asset ID</th><th>Name</th><th>Location Code</th></tr></thead><tbody>
      ${list.map((v) => `<tr data-id="${U.esc(v.id)}" class="${v.id === st.current ? 'sel' : ''}" style="cursor:pointer"><td><input type="checkbox" ${st.selected.has(v.id) ? 'checked' : ''} aria-label="Select ${U.esc(v.id)}"></td>
        <td><span class="asset-id">${U.esc(v.id)}</span></td><td>${U.esc(v.name)}</td><td><span class="loc-code">${U.esc(v.locationCode)}</span></td></tr>`).join('')}</tbody></table>` : UI.empty('No assets.');
    updatePrintBtn();
  }
  function renderPreview() {
    const el = U.$('#qrPreview');
    const v = st.current && S.view(st.current);
    if (!v) { el.innerHTML = UI.empty('Select an asset in the list to preview its QR code.', 'qr'); return; }
    const fileWarn = location.protocol === 'file:' && !S.settings().qrBaseUrl;
    el.innerHTML = `<div class="qr-preview">
      <div class="qr-box">${Q.svg(v.id)}</div>
      <div style="text-align:center"><div class="asset-id" style="font-size:15px">${U.esc(v.id)}</div><div>${U.esc(v.name)}</div><div class="loc-code">${U.esc(v.locationCode)}</div></div>
      <div class="small muted" style="align-self:flex-start">QR content</div>
      <div class="qr-content">${U.esc(Q.content(v.id))}</div>
      ${fileWarn ? `<div class="callout warn small">${U.icon('alert', 16)}<div>The app is opened from a local file, so the link only works on this computer. Set the <b>QR base URL</b> in Settings to your hosted address before printing labels.</div></div>` : ''}
      <div class="btn-row" style="justify-content:center">
        <button class="btn btn-primary" id="qpPng">${U.icon('download', 15)}Download PNG</button>
        <button class="btn" id="qpPrint">${U.icon('printer', 15)}Print label</button>
        <button class="btn" id="qpCopy">Copy link</button>
        <button class="btn" id="qpMap">${U.icon('locate', 15)}Show on map</button>
      </div></div>`;
    U.$('#qpPng').addEventListener('click', () => { if (!hasLib()) return UI.toast('QR library not loaded.', 'error'); U.downloadDataUrl(`QR-${v.id}.png`, Q.png(v.id)); });
    U.$('#qpPrint').addEventListener('click', () => Q.printLabels([v.id]));
    U.$('#qpCopy').addEventListener('click', async () => { try { await navigator.clipboard.writeText(Q.content(v.id)); UI.toast('Link copied.', 'success'); } catch (e) { UI.toast('Clipboard not available.', 'error'); } });
    U.$('#qpMap').addEventListener('click', () => F.views.map.locate(v.id));
  }

  Q.printLabels = (ids) => {
    if (!hasLib()) return UI.toast('QR library not loaded (offline?).', 'error');
    const sz = SIZES[st.labelSize] || SIZES['63x38'];
    const fac = S.factory().name;
    const area = U.$('#printArea');
    area.innerHTML = `<div class="labels" style="--cols:${sz.cols};--lw:${sz.w}mm;--lh:${sz.h}mm">${ids.map((id) => {
      const v = S.view(id);
      return `<div class="label"><div class="lq">${Q.svg(id)}</div><div class="lt"><div class="lid">${U.esc(v.id)}</div><div class="lname">${U.esc(v.name)}</div><div class="lloc">${U.esc(v.locationCode)}</div><div class="lfac">${U.esc(fac)}</div></div></div>`;
    }).join('')}</div>`;
    setTimeout(() => window.print(), 50);
  };

  function lookup(raw) {
    const s = String(raw || '').trim();
    if (!s) return;
    const m = s.match(/[?&#]asset=([^&#\s]+)/i);
    const id = m ? decodeURIComponent(m[1]) : s;
    const a = F.views.map.findAsset(id);
    if (!a) return UI.toast(`No asset found for "${id}"`, 'error');
    U.$('#qrLookupIn').value = '';
    stopCamera();
    F.views.map.locate(a.id);
  }

  async function toggleCamera() {
    if (stream) return stopCamera();
    const area = U.$('#qrCamArea');
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      area.innerHTML = '<video class="scan-video" playsinline muted></video><div class="small muted">Point the camera at an asset QR label…</div>';
      const video = U.$('video', area);
      video.srcObject = stream;
      await video.play();
      const det = new window.BarcodeDetector({ formats: ['qr_code'] });
      scanTimer = setInterval(async () => {
        try { const codes = await det.detect(video); if (codes.length) lookup(codes[0].rawValue); } catch (e) { /* ignore frame errors */ }
      }, 350);
      U.$('#qrCamBtn').lastChild.textContent = 'Stop camera';
    } catch (e) {
      area.innerHTML = `<div class="callout err small">${U.icon('alert', 16)}<div>Camera not available: ${U.esc(e.message)}. Camera access requires HTTPS or localhost.</div></div>`;
      stream = null;
    }
  }
  function stopCamera() {
    clearInterval(scanTimer);
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    const area = U.$('#qrCamArea'); if (area) area.innerHTML = '';
    const b = U.$('#qrCamBtn'); if (b) b.lastChild.textContent = 'Scan with camera';
  }

  Q.showFor = (id) => { st.current = id; st.q = ''; st.floor = ''; st.cat = ''; F.app.go('qr'); };
  Q.show = () => { if (!built) build(); U.$('#qrQ').value = st.q; renderList(); renderPreview(); };
  Q.refresh = () => { if (built) { renderList(); renderPreview(); } };
  Q.hide = stopCamera;
})(window.FAM);
