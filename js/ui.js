/* Factory Asset Map — UI components: modal, confirm, toast, form helpers, badges. */
window.FAM = window.FAM || {};
(function (F) {
  'use strict';
  const U = F.util;
  const UI = (F.ui = {});

  /* ---------- toast ---------- */
  UI.toast = (msg, type = 'info', ms = 3200) => {
    let host = U.$('#toasts');
    if (!host) {
      host = U.h('<div id="toasts" aria-live="polite"></div>');
      document.body.appendChild(host);
    }
    const icon = type === 'error' ? 'alert' : type === 'success' ? 'check' : 'info';
    const t = U.h(`<div class="toast toast-${type}">${U.icon(icon, 16)}<span>${U.esc(msg)}</span></div>`);
    host.appendChild(t);
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 400);
  };

  /* ---------- modal ---------- */
  const stack = [];
  UI.modal = ({ title, body, actions = [], size = '', onClose } = {}) => {
    const el = U.h(`
      <div class="modal-backdrop">
        <div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${U.esc(title)}">
          <header class="modal-head"><h3>${U.esc(title)}</h3><button class="icon-btn" data-close title="Close">${U.icon('x')}</button></header>
          <div class="modal-body"></div>
          <footer class="modal-foot"></footer>
        </div>
      </div>`);
    const bodyEl = U.$('.modal-body', el);
    if (typeof body === 'string') bodyEl.innerHTML = body;
    else if (body) bodyEl.appendChild(body);
    const foot = U.$('.modal-foot', el);
    const api = {
      el, body: bodyEl,
      close() {
        el.remove();
        const i = stack.indexOf(api);
        if (i >= 0) stack.splice(i, 1);
        document.removeEventListener('keydown', onKey);
        onClose && onClose();
      },
    };
    if (!actions.length) foot.remove();
    actions.forEach((a) => {
      const b = U.h(`<button class="btn ${a.primary ? 'btn-primary' : a.danger ? 'btn-danger' : ''}">${a.icon ? U.icon(a.icon, 16) : ''}<span>${U.esc(a.label)}</span></button>`);
      b.addEventListener('click', async () => {
        if (!a.onClick) return api.close();
        b.disabled = true;
        try {
          const r = await a.onClick(api);
          if (r !== false) api.close();
        } finally { b.disabled = false; }
      });
      foot.appendChild(b);
    });
    U.$$('[data-close]', el).forEach((b) => b.addEventListener('click', () => api.close()));
    el.addEventListener('mousedown', (e) => { if (e.target === el) api.close(); });
    function onKey(e) { if (e.key === 'Escape' && stack[stack.length - 1] === api) api.close(); }
    document.addEventListener('keydown', onKey);
    document.body.appendChild(el);
    stack.push(api);
    setTimeout(() => { const f = U.$('input:not([type=hidden]):not([readonly]), select, textarea', bodyEl); f && f.focus(); }, 30);
    return api;
  };

  UI.confirm = (message, { title = 'Please confirm', okLabel = 'Confirm', danger = false } = {}) =>
    new Promise((resolve) => {
      let answered = false;
      UI.modal({
        title, size: 'modal-sm',
        body: `<p class="confirm-msg">${message}</p>`,
        actions: [
          { label: 'Cancel', onClick: () => { answered = true; resolve(false); } },
          { label: okLabel, primary: !danger, danger, onClick: () => { answered = true; resolve(true); } },
        ],
        onClose: () => { if (!answered) resolve(false); },
      });
    });

  /* ---------- form helpers ---------- */
  UI.options = (list, selected, { value = 'id', label = (x) => x.name, empty } = {}) =>
    (empty !== undefined ? `<option value="">${U.esc(empty)}</option>` : '') +
    list.map((x) => `<option value="${U.esc(x[value])}" ${String(x[value]) === String(selected ?? '') ? 'selected' : ''}>${U.esc(label(x))}</option>`).join('');

  UI.formData = (form) => {
    const o = {};
    U.$$('[name]', form).forEach((el) => {
      if (el.type === 'checkbox') o[el.name] = el.checked;
      else if (el.type === 'radio') { if (el.checked) o[el.name] = el.value; }
      else o[el.name] = el.value;
    });
    return o;
  };
  UI.showErrors = (form, errors) => {
    U.$$('.field-error', form).forEach((e) => e.remove());
    U.$$('.invalid', form).forEach((e) => e.classList.remove('invalid'));
    let first = null;
    Object.entries(errors || {}).forEach(([k, msg]) => {
      const input = U.$(`[name="${k}"]`, form);
      if (input) {
        input.classList.add('invalid');
        input.closest('.field')?.appendChild(U.h(`<div class="field-error">${U.esc(msg)}</div>`));
        first = first || input;
      } else UI.toast(msg, 'error');
    });
    first && first.focus();
  };

  UI.statusBadge = (statusId) => {
    const s = F.store.status(statusId);
    return `<span class="badge" style="--c:${s.color}"><i></i>${U.esc(s.name)}</span>`;
  };
  UI.empty = (msg, icon = 'box') => `<div class="empty">${U.icon(icon, 28)}<p>${msg}</p></div>`;
})(window.FAM);
