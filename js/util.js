/* Factory Asset Map — shared helpers (DOM, formatting, files, CSV, events, icons). */
window.FAM = window.FAM || {};
(function (F) {
  'use strict';
  const U = (F.util = {});

  U.$ = (sel, root = document) => root.querySelector(sel);
  U.$$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  U.esc = (s) =>
    String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  U.h = (html) => {
    const t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  };
  U.uid = (p = 'id') => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  U.nowIso = () => new Date().toISOString();
  U.pad = (n, len) => String(n).padStart(len, '0');
  U.round1 = (n) => Math.round(Number(n) * 10) / 10;
  U.clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  U.num = (v) => {
    if (v === null || v === undefined || v === '') return NaN;
    return Number(String(v).replace(',', '.').trim());
  };
  U.fmtDateTime = (iso) =>
    iso
      ? new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      : '—';
  U.fmtDate = (d) => {
    if (!d) return '—';
    const dt = new Date(d.length === 10 ? d + 'T00:00:00' : d);
    return isNaN(dt) ? U.esc(d) : dt.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
  };
  U.isoDate = (v) => {
    // Normalise dates from CSV/Excel to YYYY-MM-DD ('' when empty/invalid)
    if (v === null || v === undefined || v === '') return '';
    if (typeof v === 'number') {
      // Excel serial date
      const d = new Date(Math.round((v - 25569) * 86400 * 1000));
      return isNaN(d) ? '' : d.toISOString().slice(0, 10);
    }
    const s = String(v).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
    const m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/); // DD/MM/YYYY
    if (m) return `${m[3]}-${U.pad(m[2], 2)}-${U.pad(m[1], 2)}`;
    const d = new Date(s);
    return isNaN(d) ? '' : d.toISOString().slice(0, 10);
  };
  U.debounce = (fn, ms = 200) => {
    let t;
    return (...a) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...a), ms);
    };
  };
  U.stamp = () => new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');

  /* ---------- files ---------- */
  U.download = (filename, content, mime = 'text/plain;charset=utf-8') => {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };
  U.downloadDataUrl = (filename, dataUrl) => {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };
  U.readFile = (file, as = 'text') =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      if (as === 'dataURL') r.readAsDataURL(file);
      else if (as === 'arrayBuffer') r.readAsArrayBuffer(file);
      else r.readAsText(file);
    });
  U.pickFile = (accept) =>
    new Promise((resolve) => {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = accept || '';
      inp.style.display = 'none';
      inp.onchange = () => {
        resolve(inp.files[0] || null);
        inp.remove();
      };
      document.body.appendChild(inp);
      inp.click();
    });
  U.loadImage = (src) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  // Resize photos before storing (keeps LocalStorage small)
  U.resizeImage = async (file, max = 480, quality = 0.8) => {
    const src = await U.readFile(file, 'dataURL');
    const img = await U.loadImage(src);
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', quality);
  };
  U.svgToDataUrl = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  // Width/height of an SVG drawing from its viewBox (preferred) or width/height attributes.
  U.svgSize = (svgText) => {
    try {
      const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
      const svg = doc.documentElement;
      if (!svg || svg.nodeName.toLowerCase() !== 'svg' || doc.getElementsByTagName('parsererror').length) return null;
      const vb = (svg.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
      if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) return { w: vb[2], h: vb[3] };
      const w = parseFloat(svg.getAttribute('width'));
      const h = parseFloat(svg.getAttribute('height'));
      if (w > 0 && h > 0) return { w, h };
      return { w: 1000, h: 600 };
    } catch (e) {
      return null;
    }
  };
  // Remove scripts / event handlers from imported SVG (it is rendered as an <image>, but be safe on export too)
  U.sanitizeSvg = (svgText) => {
    const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml');
    doc.querySelectorAll('script, foreignObject').forEach((n) => n.remove());
    doc.querySelectorAll('*').forEach((n) => {
      [...n.attributes].forEach((a) => {
        if (/^on/i.test(a.name)) n.removeAttribute(a.name);
      });
    });
    const svg = doc.documentElement;
    if (!svg.getAttribute('viewBox')) {
      const w = parseFloat(svg.getAttribute('width'));
      const h = parseFloat(svg.getAttribute('height'));
      if (w > 0 && h > 0) svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    }
    return new XMLSerializer().serializeToString(doc);
  };

  /* ---------- CSV ---------- */
  U.csv = {
    parse(text) {
      text = String(text || '').replace(/^﻿/, '');
      const firstLine = text.split(/\r?\n/)[0] || '';
      const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
      const rows = [];
      let row = [], field = '', q = false;
      for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (q) {
          if (c === '"') {
            if (text[i + 1] === '"') { field += '"'; i++; } else q = false;
          } else field += c;
        } else if (c === '"') q = true;
        else if (c === delim) { row.push(field); field = ''; }
        else if (c === '\n' || c === '\r') {
          if (c === '\r' && text[i + 1] === '\n') i++;
          row.push(field); rows.push(row); row = []; field = '';
        } else field += c;
      }
      if (field !== '' || row.length) { row.push(field); rows.push(row); }
      return rows.filter((r) => r.some((v) => String(v).trim() !== ''));
    },
    // rows: array of arrays (first row = headers)
    stringify(rows) {
      const cell = (v) => {
        const s = v === null || v === undefined ? '' : String(v);
        return /[",\n\r;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      };
      return '﻿' + rows.map((r) => r.map(cell).join(',')).join('\r\n');
    },
  };

  /* ---------- event bus ---------- */
  const listeners = {};
  U.bus = {
    on(ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); },
    off(ev, fn) { listeners[ev] = (listeners[ev] || []).filter((f) => f !== fn); },
    emit(ev, data) { (listeners[ev] || []).forEach((f) => { try { f(data); } catch (e) { console.error(e); } }); },
  };

  /* ---------- icons (simple stroke icons, 24px grid) ---------- */
  const P = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>',
    map: '<path d="M9 3 3 6v15l6-3 6 3 6-3V3l-6 3-6-3z"/><path d="M9 3v15M15 6v15"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13"/><circle cx="3.5" cy="6" r="1"/><circle cx="3.5" cy="12" r="1"/><circle cx="3.5" cy="18" r="1"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7l10-5z"/><path d="m2 12 10 5 10-5"/><path d="m2 17 10 5 10-5"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>',
    locate: '<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 1v4M12 19v4M1 12h4M19 12h4"/>',
    pin: '<path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/>',
    download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 19h16"/>',
    upload: '<path d="M12 21V9M7 14l5-5 5 5"/><path d="M4 5h16"/>',
    zoomIn: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/>',
    zoomOut: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M8 11h6"/>',
    fit: '<path d="M3 9V3h6M21 9V3h-6M3 15v6h6M21 15v6h-6"/>',
    move: '<path d="M5 9 2 12l3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    filter: '<path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3z"/>',
    printer: '<path d="M6 9V2h12v7"/><rect x="2" y="9" width="20" height="9" rx="2"/><rect x="6" y="14" width="12" height="8"/>',
    camera: '<path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/>',
    box: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    square: '<rect x="4" y="4" width="16" height="16" rx="1"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.7-4 3-9 3s-9-1.3-9-3"/><path d="M3 5v14c0 1.7 4 3 9 3s9-1.3 9-3V5"/>',
    book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5v14z"/><path d="M4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5"/>',
    eye: '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
    tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L2 12V2h10l8.6 8.6a2 2 0 0 1 0 2.8z"/><circle cx="7" cy="7" r="1.5"/>',
  };
  U.icon = (name, size = 18, cls = '') =>
    `<svg class="ic ${cls}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ''}</svg>`;

  // Marker shape path centred at 0,0 with radius ~r (used on the map & legends)
  U.shapePath = (shape, r = 8) => {
    switch (shape) {
      case 'square': return `M${-r * 0.85} ${-r * 0.85}h${r * 1.7}v${r * 1.7}h${-r * 1.7}z`;
      case 'diamond': return `M0 ${-r * 1.15}L${r * 1.15} 0L0 ${r * 1.15}L${-r * 1.15} 0z`;
      case 'triangle': return `M0 ${-r * 1.1}L${r * 1.05} ${r * 0.8}L${-r * 1.05} ${r * 0.8}z`;
      default: return `M${-r} 0a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`;
    }
  };
  U.shapeSvg = (shape, color, size = 14) =>
    `<svg width="${size}" height="${size}" viewBox="-10 -10 20 20" aria-hidden="true"><path d="${U.shapePath(shape, 8)}" fill="${color}" stroke="#fff" stroke-width="1.5"/></svg>`;
})(window.FAM);
