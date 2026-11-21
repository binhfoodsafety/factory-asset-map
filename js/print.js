/* Factory Asset Map — in chứng từ / báo cáo (A4) qua hộp thoại in của trình duyệt. */
window.FAM = window.FAM || {};
(function (F) {
  'use strict';
  const U = F.util, S = F.store;
  const P = (F.print = {});

  P.money = (n) => (n === null || n === undefined || n === '' || isNaN(n) ? '' : Math.round(Number(n)).toLocaleString('vi-VN'));
  P.date = (d) => (d ? `${String(d).slice(8, 10)}/${String(d).slice(5, 7)}/${String(d).slice(0, 4)}` : '…/…/……');
  P.dateWords = (d) => (d ? `Ngày ${String(d).slice(8, 10)} tháng ${String(d).slice(5, 7)} năm ${String(d).slice(0, 4)}` : 'Ngày … tháng … năm ……');

  // Đầu chứng từ: tên đơn vị + bộ phận bên trái, ghi chú mẫu bên phải
  P.header = (dept) => {
    const fac = S.factory();
    return `<div class="doc-top"><div><b>Đơn vị:</b> ${U.esc(fac.name)}<br><b>Bộ phận:</b> ${U.esc(dept || '')}</div>
      <div class="doc-form">Mẫu tham khảo – áp dụng theo chế độ kế toán<br>${U.esc((F.fin && F.fin.settings().regime) || '')} của đơn vị</div></div>`;
  };
  P.title = (title, sub) => `<h1 class="doc-title">${U.esc(title)}</h1>${sub ? `<div class="doc-sub">${sub}</div>` : ''}`;
  P.signs = (roles, date) => `${date !== false ? `<div class="doc-date">${P.dateWords(date || new Date().toISOString().slice(0, 10))}</div>` : ''}
    <table class="doc-sign"><tr>${roles.map((r) => `<td><b>${U.esc(r)}</b><br><i>(Ký, họ tên)</i></td>`).join('')}</tr></table>`;

  P.doc = (html, { landscape = false } = {}) => {
    const area = U.$('#printArea');
    area.innerHTML = `<div class="doc ${landscape ? 'landscape' : ''}">${html}${S.isDemo() ? '<div class="doc-demo">DỮ LIỆU DEMO – minh họa, không phải chứng từ thật</div>' : ''}</div>`;
    document.body.classList.add('printing-doc');
    setTimeout(() => window.print(), 60);
  };
  window.addEventListener('afterprint', () => document.body.classList.remove('printing-doc'));
})(window.FAM);
