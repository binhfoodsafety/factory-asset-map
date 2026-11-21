/*
 * Factory Asset Map — Kế toán TSCĐ: dữ liệu kế toán, khấu hao / phân bổ, nghiệp vụ tăng giảm, khoá sổ.
 *
 * Dữ liệu
 *   asset.fin = {
 *     assetType: 'TSHH' | 'TSVH' | 'CCDC',   accCode (mã TS trên phần mềm kế toán),
 *     cost (nguyên giá, VND), increaseDate (ngày ghi tăng), depStartDate (ngày bắt đầu tính KH),
 *     usefulLifeMonths (thời gian sử dụng), remainingMonths (thời gian còn lại tại ngày bắt đầu tính KH),
 *     openingAccum (hao mòn luỹ kế tại ngày bắt đầu tính KH), method: 'SL' | 'DB' | 'NONE',
 *     assetAccount, depAccount, expenseAccount, fundSource, supplier, invoiceNo, invoiceDate, disposedDate
 *   }
 *   db.finTx   – nghiệp vụ: INCREASE, UPGRADE, REVALUE, TRANSFER, DISPOSE
 *   db.finSettings – hệ thống tài khoản, tính KH theo ngày, khoá sổ đến kỳ (YYYY-MM)
 *
 * Khấu hao
 *   - Đường thẳng: mức KH tháng = (nguyên giá − HM luỹ kế) / số tháng còn lại; tính lại khi nâng cấp / đánh giá lại.
 *   - Số dư giảm dần có điều chỉnh: mức KH năm = GTCL × hệ số / số năm sử dụng (hệ số 1,5 / 2,0 / 2,5),
 *     chuyển sang chia đều cho số năm còn lại khi mức đó thấp hơn. Tính lại mỗi 12 tháng.
 *   - Tính theo ngày (mặc định): tháng ghi tăng / ghi giảm chỉ tính số ngày sử dụng; tháng cuối lấy phần còn lại.
 *   - CCDC: phân bổ đều (TK 242) theo số kỳ.
 */
window.FAM = window.FAM || {};
(function (F) {
  'use strict';
  const U = F.util, S = F.store;
  const FIN = (F.fin = {});

  FIN.TYPES = [
    { id: 'TSHH', name: 'TSCĐ hữu hình', short: 'TSCĐ HH' },
    { id: 'TSVH', name: 'TSCĐ vô hình', short: 'TSCĐ VH' },
    { id: 'CCDC', name: 'Công cụ dụng cụ (phân bổ)', short: 'CCDC' },
  ];
  FIN.METHODS = [
    { id: 'SL', name: 'Đường thẳng' },
    { id: 'DB', name: 'Số dư giảm dần có điều chỉnh' },
    { id: 'NONE', name: 'Không trích khấu hao' },
  ];
  FIN.TX = {
    INCREASE: { name: 'Ghi tăng', prefix: 'GT' },
    UPGRADE: { name: 'Nâng cấp / sửa chữa lớn', prefix: 'NC' },
    REVALUE: { name: 'Đánh giá lại', prefix: 'DG' },
    TRANSFER: { name: 'Điều chuyển bộ phận', prefix: 'DC' },
    DISPOSE: { name: 'Thanh lý / nhượng bán', prefix: 'TL' },
  };
  FIN.DEFAULT_DEP_ACC = { TSHH: '2141', TSVH: '2143', CCDC: '242' };
  FIN.THRESHOLD = 30000000; // tiêu chuẩn nguyên giá TSCĐ (TT 45/2013/TT-BTC)

  /* ---------- helpers ---------- */
  const pad2 = (n) => String(n).padStart(2, '0');
  const ymOf = (d) => String(d || '').slice(0, 7);
  const dayOf = (d) => Number(String(d).slice(8, 10)) || 1;
  const dim = (ym) => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate();
  FIN.ymOf = ymOf;
  FIN.ymAdd = (ym, n) => {
    let y = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) + n;
    y += Math.floor((m - 1) / 12);
    m = (((m - 1) % 12) + 12) % 12 + 1;
    return `${y}-${pad2(m)}`;
  };
  FIN.nowYm = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`; };
  FIN.ymLabel = (ym) => (ym ? `${ym.slice(5, 7)}/${ym.slice(0, 4)}` : '—');
  FIN.lastDay = (ym) => `${ym}-${pad2(dim(ym))}`;
  FIN.fmt = (n) => (n === null || n === undefined || isNaN(n) ? '—' : Math.round(Number(n)).toLocaleString('vi-VN'));
  FIN.isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')) && !isNaN(new Date(s));

  FIN.settings = () => S.raw().finSettings || {};
  FIN.accounts = (kind) => (FIN.settings().accounts || []).filter((a) => !kind || a.kind === kind);
  FIN.accName = (code) => { const a = (FIN.settings().accounts || []).find((x) => x.code === code); return a ? a.name : ''; };
  FIN.typeName = (id) => (FIN.TYPES.find((t) => t.id === id) || { name: id || '—' }).name;
  FIN.typeShort = (id) => (FIN.TYPES.find((t) => t.id === id) || { short: id || '—' }).short;
  FIN.methodName = (id) => (FIN.METHODS.find((t) => t.id === id) || { name: id || '—' }).name;
  FIN.has = (a) => !!(a && a.fin && Number(a.fin.cost) > 0);
  FIN.lockedUntil = () => FIN.settings().lockedUntil || '';
  FIN.isLocked = (date) => { const l = FIN.lockedUntil(); return !!l && ymOf(date) <= l; };
  FIN.txAll = () => S.raw().finTx || [];
  FIN.txFor = (assetId) => FIN.txAll().filter((t) => t.assetId === assetId)
    .sort((a, b) => (a.date === b.date ? String(a.createdAt).localeCompare(String(b.createdAt)) : a.date.localeCompare(b.date)));
  FIN.depCredit = (f) => (f && f.depAccount) || FIN.DEFAULT_DEP_ACC[(f && f.assetType) || 'TSHH'] || '2141';

  /* ---------- khấu hao ---------- */
  // Lịch khấu hao từ tháng bắt đầu đến untilYm. rows: {ym, dep, accum, nbv, cost, dept, exp, remaining}
  FIN.schedule = (a, untilYm) => {
    const f = a && a.fin;
    const res = { rows: [], disposal: null };
    if (!FIN.has(a)) return res;
    const start = f.depStartDate || f.increaseDate;
    if (!FIN.isDate(start)) return res;
    const prorate = FIN.settings().prorateByDay !== false;
    const method = f.assetType === 'CCDC' ? 'SL' : f.method || 'SL';
    let cost = Number(f.cost) || 0;
    let accum = Number(f.openingAccum) || 0;
    let remaining = Number(f.remainingMonths) || Number(f.usefulLifeMonths) || 0;
    const lifeYears = (Number(f.usefulLifeMonths) || remaining) / 12;
    const txs = FIN.txFor(a.id).filter((t) => t.type !== 'INCREASE');
    const firstTr = txs.find((t) => t.type === 'TRANSFER');
    let dept = firstTr ? firstTr.fromDept : a.departmentId;
    let exp = firstTr ? firstTr.fromExpense || f.expenseAccount : f.expenseAccount;
    let cur = ymOf(start), k = 0, ti = 0, monthly = 0, recalc = true;
    const calc = () => {
      const nbv = cost - accum;
      if (method === 'NONE') return 0;
      if (remaining <= 0) return nbv;
      if (method === 'DB' && lifeYears > 0) {
        const coef = lifeYears <= 4 ? 1.5 : lifeYears <= 6 ? 2 : 2.5;
        const annualDB = (nbv * coef) / lifeYears;
        const annualSL = nbv / Math.max(remaining / 12, 1 / 12);
        return Math.max(annualDB, annualSL) / 12;
      }
      return nbv / remaining;
    };
    let guard = 0;
    while (cur <= untilYm && guard++ < 1200) {
      let disposeDate = null;
      while (ti < txs.length && ymOf(txs[ti].date) <= cur) {
        const t = txs[ti++];
        if (t.type === 'UPGRADE') { cost += Number(t.amount) || 0; remaining += Number(t.extraMonths) || 0; recalc = true; }
        else if (t.type === 'REVALUE') { cost += Number(t.costDelta) || 0; accum += Number(t.accumDelta) || 0; if (Number(t.newRemaining) > 0) remaining = Number(t.newRemaining); recalc = true; }
        else if (t.type === 'TRANSFER') { dept = t.toDept || dept; exp = t.toExpense || exp; }
        else if (t.type === 'DISPOSE') { disposeDate = t.date; res.disposalTx = t; }
      }
      if (recalc || (method === 'DB' && k > 0 && k % 12 === 0)) { monthly = calc(); recalc = false; }
      const D = dim(cur);
      const disposingNow = disposeDate && ymOf(disposeDate) === cur;
      let from = 1, to = D;
      if (k === 0 && prorate) from = dayOf(start);
      if (disposingNow) to = dayOf(disposeDate) - 1; // thôi trích từ ngày ghi giảm
      const frac = prorate ? Math.max(0, to - from + 1) / D : disposingNow ? 0 : 1;
      const nbv = cost - accum;
      let dep = 0;
      if (method !== 'NONE' && nbv > 0 && remaining > 0 && frac > 0) {
        dep = remaining - frac <= 1e-9 ? nbv : Math.min(nbv, Math.round(monthly * frac));
        remaining = Math.max(0, remaining - frac);
      }
      accum += dep;
      res.rows.push({ ym: cur, dep, accum, nbv: cost - accum, cost, dept, exp, remaining });
      if (disposingNow) { res.disposal = { date: disposeDate, cost, accum, nbv: cost - accum, tx: res.disposalTx }; break; }
      cur = FIN.ymAdd(cur, 1);
      k++;
    }
    return res;
  };

  // Trạng thái tại cuối kỳ ym
  FIN.stateAt = (a, ym) => {
    if (!FIN.has(a)) return { status: 'NONE' };
    const f = a.fin;
    if (ymOf(f.increaseDate) > ym) return { status: 'NOTYET', cost: 0, accum: 0, nbv: 0, dep: 0 };
    const sc = FIN.schedule(a, ym);
    const last = sc.rows[sc.rows.length - 1];
    if (sc.disposal && ymOf(sc.disposal.date) <= ym) {
      return { status: 'DISPOSED', cost: 0, accum: 0, nbv: 0, dep: last && last.ym === ym ? last.dep : 0, disposal: sc.disposal, dept: last && last.dept, exp: last && last.exp };
    }
    if (!last) { // trước tháng bắt đầu tính KH
      const accum = Number(f.openingAccum) || 0;
      return { status: 'ACTIVE', cost: Number(f.cost), accum, nbv: Number(f.cost) - accum, dep: 0, remaining: Number(f.remainingMonths) || Number(f.usefulLifeMonths), dept: a.departmentId, exp: f.expenseAccount };
    }
    const method = f.assetType === 'CCDC' ? 'SL' : f.method || 'SL';
    const status = method === 'NONE' ? 'NODEP' : last.nbv <= 0 ? 'FULL' : 'ACTIVE';
    return { status, cost: last.cost, accum: last.accum, nbv: last.nbv, dep: last.ym === ym ? last.dep : 0, remaining: last.remaining, dept: last.dept, exp: last.exp };
  };
  FIN.STATUS = {
    NONE: ['Chưa khai báo', '#94a3b8'], NOTYET: ['Chưa ghi tăng', '#94a3b8'], ACTIVE: ['Đang khấu hao', '#0d9488'],
    FULL: ['Đã khấu hao hết', '#d97706'], NODEP: ['Không trích KH', '#64748b'], DISPOSED: ['Đã ghi giảm', '#dc2626'],
  };

  // Bảng tính & phân bổ khấu hao cho các kỳ [fromYm, toYm]
  FIN.period = (fromYm, toYm) => {
    const prevYm = FIN.ymAdd(fromYm, -1);
    const rows = [];
    const alloc = {}; // exp|credit|dept → amount
    S.assets().filter(FIN.has).forEach((a) => {
      const f = a.fin;
      if (ymOf(f.increaseDate) > toYm) return;
      const sc = FIN.schedule(a, toYm);
      if (sc.disposal && ymOf(sc.disposal.date) < fromYm) return; // đã ghi giảm trước kỳ
      const inRange = sc.rows.filter((r) => r.ym >= fromYm && r.ym <= toYm);
      const before = sc.rows.filter((r) => r.ym <= prevYm);
      const openAccum = before.length ? before[before.length - 1].accum : ymOf(f.depStartDate || f.increaseDate) <= prevYm ? Number(f.openingAccum) || 0 : 0;
      const openCost = ymOf(f.increaseDate) <= prevYm ? (before.length ? before[before.length - 1].cost : Number(f.cost)) : 0;
      const dep = inRange.reduce((s, r) => s + r.dep, 0);
      const last = sc.rows.length ? sc.rows[sc.rows.length - 1] : null;
      const credit = FIN.depCredit(f);
      inRange.forEach((r) => {
        if (!r.dep) return;
        const key = `${r.exp || '?'}|${credit}|${r.dept || ''}`;
        alloc[key] = (alloc[key] || 0) + r.dep;
      });
      const disposed = sc.disposal && ymOf(sc.disposal.date) >= fromYm && ymOf(sc.disposal.date) <= toYm ? sc.disposal : null;
      const increased = ymOf(f.increaseDate) >= fromYm && ymOf(f.increaseDate) <= toYm;
      const cost = disposed ? 0 : last ? last.cost : Number(f.cost);
      const accum = disposed ? 0 : last ? last.accum : Number(f.openingAccum) || 0;
      rows.push({
        a, f, openCost, openAccum, dep, cost, accum, nbv: cost - accum,
        dept: last ? last.dept : a.departmentId, exp: last ? last.exp : f.expenseAccount, credit,
        increased, disposed, remaining: last ? last.remaining : Number(f.remainingMonths) || Number(f.usefulLifeMonths),
        monthly: inRange.length ? inRange[inRange.length - 1].dep : 0,
      });
    });
    const allocation = Object.entries(alloc).map(([k, amount]) => { const [debit, credit, dept] = k.split('|'); return { debit, credit, dept, amount }; })
      .sort((x, y) => (x.debit + x.dept).localeCompare(y.debit + y.dept));
    return { fromYm, toYm, rows, allocation, totalDep: rows.reduce((s, r) => s + r.dep, 0) };
  };

  /* ---------- khai báo / sửa dữ liệu kế toán ---------- */
  FIN.validateFin = (fin, a) => {
    const e = {}, warn = [];
    const n = (v) => Number(v);
    if (!FIN.TYPES.some((t) => t.id === fin.assetType)) e.assetType = 'Chọn loại tài sản';
    if (!(n(fin.cost) > 0)) e.cost = 'Nguyên giá phải lớn hơn 0';
    if (!FIN.isDate(fin.increaseDate)) e.increaseDate = 'Nhập ngày ghi tăng';
    if (fin.depStartDate && !FIN.isDate(fin.depStartDate)) e.depStartDate = 'Ngày không hợp lệ';
    if (FIN.isDate(fin.depStartDate) && FIN.isDate(fin.increaseDate) && fin.depStartDate < fin.increaseDate) e.depStartDate = 'Không được trước ngày ghi tăng';
    const noDep = fin.assetType !== 'CCDC' && fin.method === 'NONE';
    if (!noDep && !(n(fin.usefulLifeMonths) >= 1)) e.usefulLifeMonths = 'Thời gian sử dụng ≥ 1 tháng';
    if (!noDep && fin.remainingMonths !== '' && fin.remainingMonths !== undefined && !(n(fin.remainingMonths) >= 1 && n(fin.remainingMonths) <= n(fin.usefulLifeMonths))) e.remainingMonths = 'Từ 1 đến thời gian sử dụng';
    if (n(fin.openingAccum) < 0 || n(fin.openingAccum) >= n(fin.cost)) e.openingAccum = 'Từ 0 đến nhỏ hơn nguyên giá';
    if (!fin.depAccount) e.depAccount = 'Chọn TK khấu hao / phân bổ';
    if (!fin.expenseAccount) e.expenseAccount = 'Chọn TK chi phí';
    if (fin.assetType !== 'CCDC' && !fin.assetAccount) e.assetAccount = 'Chọn TK nguyên giá';
    if (fin.assetType === 'TSHH' && n(fin.cost) > 0 && n(fin.cost) < FIN.THRESHOLD) warn.push('Nguyên giá dưới 30 triệu đồng: theo TT 45/2013/TT-BTC thường hạch toán là CCDC.');
    if (fin.assetType === 'CCDC' && n(fin.usefulLifeMonths) > 36) warn.push('CCDC thường phân bổ tối đa 36 tháng.');
    // khoá sổ: không sửa thông số ảnh hưởng tới kỳ đã khoá
    const old = a && a.fin;
    if (old && FIN.has(a) && FIN.isLocked(old.depStartDate || old.increaseDate)) {
      const keys = ['assetType', 'cost', 'increaseDate', 'depStartDate', 'usefulLifeMonths', 'remainingMonths', 'openingAccum', 'method', 'depAccount', 'expenseAccount'];
      const changed = keys.filter((k) => String(old[k] ?? '') !== String(fin[k] ?? ''));
      if (changed.length) e._lock = `Kỳ đến ${FIN.ymLabel(FIN.lockedUntil())} đã khoá sổ. Không sửa được nguyên giá / thời gian / tài khoản — hãy dùng nghiệp vụ Nâng cấp hoặc Đánh giá lại.`;
    }
    if (!old && fin.increaseDate && FIN.isLocked(fin.increaseDate)) warn.push(`Ngày ghi tăng thuộc kỳ đã khoá (${FIN.ymLabel(FIN.lockedUntil())}). Chỉ dùng cho khai báo số dư đầu kỳ.`);
    return { errors: e, warnings: warn };
  };

  FIN.cleanFin = (fin, base) => {
    const n = (v, d = 0) => (v === '' || v === null || v === undefined || isNaN(Number(v)) ? d : Number(v));
    const type = fin.assetType;
    const life = Math.round(n(fin.usefulLifeMonths));
    return {
      ...(base || {}),
      assetType: type,
      accCode: String(fin.accCode || '').trim(),
      cost: Math.round(n(fin.cost)),
      increaseDate: fin.increaseDate,
      depStartDate: fin.depStartDate || fin.increaseDate,
      usefulLifeMonths: life,
      remainingMonths: Math.round(n(fin.remainingMonths, life)) || life,
      openingAccum: Math.round(n(fin.openingAccum)),
      method: type === 'CCDC' ? 'SL' : fin.method || 'SL',
      assetAccount: type === 'CCDC' ? fin.assetAccount || '' : fin.assetAccount,
      depAccount: fin.depAccount || FIN.DEFAULT_DEP_ACC[type],
      expenseAccount: fin.expenseAccount,
      fundSource: String(fin.fundSource || '').trim(),
      supplier: String(fin.supplier || '').trim(),
      invoiceNo: String(fin.invoiceNo || '').trim(),
      invoiceDate: FIN.isDate(fin.invoiceDate) ? fin.invoiceDate : '',
    };
  };

  FIN.nextDocNo = (type, date) => {
    const p = `${FIN.TX[type].prefix}-${String(date).slice(0, 4)}-`;
    let max = 0;
    FIN.txAll().forEach((t) => { if (t.docNo && t.docNo.startsWith(p)) max = Math.max(max, parseInt(t.docNo.slice(p.length), 10) || 0); });
    return p + String(max + 1).padStart(3, '0');
  };

  // Lưu thông tin kế toán; tạo / cập nhật chứng từ ghi tăng. opts.silent: không commit (dùng khi nhập hàng loạt)
  FIN.saveFin = (assetId, fin, opts = {}) => {
    const a = S.asset(assetId);
    if (!a) throw new Error('Không tìm thấy tài sản: ' + assetId);
    const { errors } = FIN.validateFin(fin, a);
    if (Object.keys(errors).length) throw new S.ValidationError(errors);
    const keep = a.fin && a.fin.disposedDate ? { disposedDate: a.fin.disposedDate } : {};
    a.fin = FIN.cleanFin(fin, keep);
    a.updatedAt = U.nowIso();
    const inc = FIN.txFor(assetId).find((t) => t.type === 'INCREASE');
    if (!inc) {
      S.raw().finTx.push({
        id: U.uid('tx'), type: 'INCREASE', assetId, assetName: a.name, date: a.fin.increaseDate,
        docNo: opts.docNo || FIN.nextDocNo('INCREASE', a.fin.increaseDate), amount: a.fin.cost,
        desc: opts.desc || `Ghi tăng ${FIN.typeShort(a.fin.assetType)}: ${a.name}`,
        refDoc: a.fin.invoiceNo ? `HĐ ${a.fin.invoiceNo}` : '', by: opts.by || S.currentUser(), createdAt: opts.at || U.nowIso(),
      });
    } else if (!FIN.isLocked(inc.date)) {
      Object.assign(inc, { date: a.fin.increaseDate, amount: a.fin.cost, assetName: a.name });
    }
    if (!opts.silent) S.commitExt('finance');
    return a.fin;
  };

  /* ---------- nghiệp vụ ---------- */
  FIN.addTx = (t, opts = {}) => {
    const a = S.asset(t.assetId);
    const e = {};
    if (!a) throw new Error('Không tìm thấy tài sản');
    if (!FIN.has(a)) throw new Error('Tài sản chưa khai báo thông tin kế toán (nguyên giá).');
    if (!FIN.TX[t.type] || t.type === 'INCREASE') throw new Error('Loại nghiệp vụ không hợp lệ');
    if (!FIN.isDate(t.date)) e.date = 'Nhập ngày chứng từ';
    else {
      if (FIN.isLocked(t.date)) e.date = `Kỳ ${FIN.ymLabel(ymOf(t.date))} đã khoá sổ`;
      if (t.date < a.fin.increaseDate) e.date = 'Trước ngày ghi tăng';
      const last = FIN.txFor(a.id).slice(-1)[0];
      if (last && t.date < last.date) e.date = `Phải từ ngày ${U.fmtDate(last.date)} (nghiệp vụ gần nhất) trở đi`;
      if (a.fin.disposedDate) e.date = 'Tài sản đã ghi giảm';
    }
    const num = (v) => (v === '' || v === undefined || v === null ? 0 : Number(v));
    if (t.type === 'UPGRADE') {
      if (!(num(t.amount) > 0)) e.amount = 'Giá trị nâng cấp phải lớn hơn 0';
      if (num(t.extraMonths) < 0) e.extraMonths = 'Không âm';
    }
    if (t.type === 'REVALUE') {
      if (!num(t.costDelta) && !num(t.accumDelta) && !num(t.newRemaining)) e.costDelta = 'Nhập ít nhất một thay đổi';
      if (num(t.newRemaining) < 0) e.newRemaining = 'Không âm';
    }
    if (t.type === 'TRANSFER') {
      if (!S.dept(t.toDept)) e.toDept = 'Chọn bộ phận nhận';
      else if (t.toDept === a.departmentId && (!t.toExpense || t.toExpense === a.fin.expenseAccount)) e.toDept = 'Bộ phận / TK chi phí không thay đổi';
    }
    if (t.type === 'DISPOSE') {
      if (num(t.proceeds) < 0) e.proceeds = 'Không âm';
      if (num(t.expenses) < 0) e.expenses = 'Không âm';
      if (!String(t.reason || '').trim()) e.reason = 'Nhập lý do ghi giảm';
    }
    if (Object.keys(e).length) throw new S.ValidationError(e);

    const tx = {
      id: U.uid('tx'), type: t.type, assetId: a.id, assetName: a.name, date: t.date,
      docNo: String(t.docNo || '').trim() || FIN.nextDocNo(t.type, t.date),
      desc: String(t.desc || '').trim() || `${FIN.TX[t.type].name}: ${a.name}`,
      refDoc: String(t.refDoc || '').trim(), by: opts.by || S.currentUser(), createdAt: opts.at || U.nowIso(),
    };
    if (t.type === 'UPGRADE') Object.assign(tx, { amount: Math.round(num(t.amount)), extraMonths: Math.round(num(t.extraMonths)) });
    if (t.type === 'REVALUE') Object.assign(tx, { costDelta: Math.round(num(t.costDelta)), accumDelta: Math.round(num(t.accumDelta)), newRemaining: Math.round(num(t.newRemaining)) });
    if (t.type === 'TRANSFER') {
      Object.assign(tx, { fromDept: a.departmentId, toDept: t.toDept, fromExpense: a.fin.expenseAccount, toExpense: t.toExpense || a.fin.expenseAccount, receiver: String(t.receiver || '').trim() });
      a.departmentId = tx.toDept;
      a.fin.expenseAccount = tx.toExpense;
    }
    if (t.type === 'DISPOSE') Object.assign(tx, { proceeds: Math.round(num(t.proceeds)), expenses: Math.round(num(t.expenses)), reason: String(t.reason).trim(), buyer: String(t.buyer || '').trim() });
    S.raw().finTx.push(tx);
    if (t.type === 'DISPOSE') {
      a.fin.disposedDate = t.date;
      const sc = FIN.schedule(a, ymOf(t.date));
      if (sc.disposal) tx.snapshot = { cost: sc.disposal.cost, accum: sc.disposal.accum, nbv: sc.disposal.nbv };
    }
    a.updatedAt = U.nowIso();
    if (!opts.silent) S.commitExt('finance');
    return tx;
  };

  FIN.canDeleteTx = (tx) => {
    if (!tx || tx.type === 'INCREASE') return 'Chứng từ ghi tăng được cập nhật cùng thông tin kế toán, không xoá riêng.';
    if (FIN.isLocked(tx.date)) return 'Kỳ đã khoá sổ.';
    const last = FIN.txFor(tx.assetId).slice(-1)[0];
    if (!last || last.id !== tx.id) return 'Chỉ xoá được nghiệp vụ mới nhất của tài sản.';
    return '';
  };
  FIN.deleteTx = (id) => {
    const db = S.raw();
    const tx = db.finTx.find((t) => t.id === id);
    const why = FIN.canDeleteTx(tx);
    if (why) throw new Error(why);
    const a = S.asset(tx.assetId);
    if (a && tx.type === 'TRANSFER') { a.departmentId = tx.fromDept; if (a.fin) a.fin.expenseAccount = tx.fromExpense; }
    if (a && tx.type === 'DISPOSE' && a.fin) delete a.fin.disposedDate;
    db.finTx = db.finTx.filter((t) => t.id !== id);
    S.commitExt('finance');
  };

  FIN.setLock = (ym) => { S.raw().finSettings.lockedUntil = ym || ''; S.commitExt('finance'); };
  FIN.saveSettings = (patch) => { Object.assign(S.raw().finSettings, patch); S.commitExt('finance'); };

  /* ---------- dữ liệu demo ---------- */
  FIN.seedDemo = (out, d) => {
    out.finSettings = JSON.parse(JSON.stringify(d.finSettings || {}));
    const lock = out.finSettings.lockedUntil;
    out.finSettings.lockedUntil = ''; // mở khoá khi tạo dữ liệu, khoá lại ở cuối
    const by = 'Kế toán TSCĐ';
    out.assets.filter((a) => a.fin).sort((x, y) => x.fin.increaseDate.localeCompare(y.fin.increaseDate)).forEach((a) => {
      const fin = a.fin; delete a.fin;
      FIN.saveFin(a.id, fin, { silent: true, by, at: fin.increaseDate + 'T08:00:00.000Z' });
    });
    (d.finTx || []).slice().sort((x, y) => x.date.localeCompare(y.date)).forEach((t) => FIN.addTx(t, { silent: true, by: t.by || by, at: t.date + 'T09:00:00.000Z' }));
    out.finSettings.lockedUntil = lock || '';
  };
})(window.FAM);
