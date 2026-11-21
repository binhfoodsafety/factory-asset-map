/* Factory Asset Map — TAB 07 Cài đặt, cấu hình, quản lý dữ liệu và hướng dẫn sử dụng. */
window.FAM = window.FAM || {};
(function (F) {
  'use strict';
  const U = F.util, S = F.store, UI = F.ui, IO = F.io;
  F.views = F.views || {};
  const ST = (F.views.settings = {});
  const SHAPES = [['circle', 'Tròn'], ['square', 'Vuông'], ['diamond', 'Thoi'], ['triangle', 'Tam giác']];
  const shapeName = (s) => (SHAPES.find((x) => x[0] === s) || [s, s])[1];
  const SECTIONS = [
    ['general', 'Thông tin chung'], ['users', 'Người dùng'], ['categories', 'Nhóm tài sản'], ['statuses', 'Trạng thái'],
    ['coding', 'Quy tắc mã vị trí'], ['data', 'Dữ liệu & sao lưu'], ['importexport', 'Nhập / xuất dữ liệu'],
    ['floorplans', 'Bản vẽ (SVG/CAD)'], ['guide', 'Hướng dẫn sử dụng'], ['future', 'Tích hợp trong tương lai'],
  ];

  function card(id, title, body, head = '') {
    return `<div class="card" id="set-${id}"><div class="card-head"><h3>${title}</h3>${head}</div><div class="card-body">${body}</div></div>`;
  }

  ST.show = (params = {}) => {
    const root = U.$('#view-settings');
    const s = S.settings();
    const fac = S.factory();
    const kb = Math.round(S.storageBytes() / 1024);
    const sample = S.views()[0];

    root.innerHTML = `
      <div class="view-head"><h2>Cài đặt &amp; Hướng dẫn</h2></div>
      <div class="settings-layout">
        <nav class="card settings-nav">${SECTIONS.map(([k, t]) => `<a href="#" data-sec="${k}">${t}</a>`).join('')}</nav>
        <div class="settings-sections">

        ${card('general', 'Thông tin chung', `
          <form class="form-grid" id="setGeneral">
            <div class="field"><label>Tên nhà máy</label><input name="factoryName" value="${U.esc(fac.name)}"></div>
            <div class="field"><label>Mã nhà máy</label><input name="factoryCode" value="${U.esc(fac.code || '')}" maxlength="10"></div>
            <div class="field full"><label>QR base URL</label><input name="qrBaseUrl" value="${U.esc(s.qrBaseUrl || '')}" placeholder="${U.esc(location.href.split('#')[0])}">
              <div class="hint">Địa chỉ web được mã hoá trong nhãn QR (VD: https://taisan.nhamay.vn/). Để trống để dùng địa chỉ hiện tại.</div></div>
            <div class="field"><label>Kích thước điểm đánh dấu</label><select name="markerScale">${[[0.8, 'Nhỏ'], [1, 'Bình thường'], [1.25, 'Lớn'], [1.5, 'Rất lớn (máy tính bảng)']].map(([v, t]) => `<option value="${v}" ${Number(s.markerScale || 1) === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
            <div class="field"><span class="lbl">Tuỳ chọn sơ đồ</span>
              <label class="check"><input type="checkbox" name="autoDetectZone" ${s.autoDetectZone !== false ? 'checked' : ''}> Tự nhận khu vực theo X/Y</label>
              <label class="check"><input type="checkbox" name="showZones" ${s.showZones !== false ? 'checked' : ''}> Hiện ranh giới khu vực</label>
              <label class="check"><input type="checkbox" name="showLabels" ${s.showLabels !== false ? 'checked' : ''}> Hiện nhãn Asset ID khi phóng to</label></div>
            <div class="full"><button class="btn btn-primary" type="submit">${U.icon('check', 16)}Lưu cài đặt</button></div>
          </form>`)}

        ${card('users', 'Người dùng', `
          <p class="small muted">Danh sách tên trong ô "Người thao tác" (thanh trên cùng), được ghi là <b>Người cập nhật</b> trong lịch sử vị trí. Ứng dụng không yêu cầu đăng nhập. <span class="future-tag">TÍCH HỢP SAU</span> đăng nhập &amp; phân quyền.</p>
          <table class="tbl"><thead><tr><th>Họ tên</th><th>Vai trò</th><th class="actions"></th></tr></thead><tbody>
            ${S.users().map((u) => `<tr data-id="${U.esc(u.id)}"><td>${U.esc(u.name)}</td><td class="muted">${U.esc(u.role)}</td><td class="actions"><button class="icon-btn" data-uact="edit" title="Sửa">${U.icon('edit', 16)}</button><button class="icon-btn" data-uact="del" title="Xoá" style="color:var(--red)">${U.icon('trash', 16)}</button></td></tr>`).join('')}
          </tbody></table>`, `<button class="btn btn-sm" id="usrAdd">${U.icon('plus', 14)}Thêm người dùng</button>`)}

        ${card('categories', 'Nhóm tài sản', `
          <p class="small muted">Mã nhóm được dùng trong Asset ID mới (AST-<b>EQP</b>-0001) và không đổi được sau khi tạo. Hình dạng điểm đánh dấu giúp nhận biết nhóm trên sơ đồ.</p>
          <table class="tbl"><thead><tr><th>Mã</th><th>Tên nhóm</th><th>Ký hiệu</th><th class="num">Tài sản</th><th class="actions"></th></tr></thead><tbody>
            ${S.categories().map((c) => `<tr data-id="${U.esc(c.id)}"><td class="mono"><b>${U.esc(c.code)}</b></td><td>${U.esc(c.name)}</td><td>${U.shapeSvg(c.shape, '#64748b')} <span class="small muted">${shapeName(c.shape)}</span></td><td class="num">${S.assets().filter((a) => a.categoryId === c.id).length}</td>
              <td class="actions"><button class="icon-btn" data-cact="edit" title="Sửa">${U.icon('edit', 16)}</button><button class="icon-btn" data-cact="del" title="Xoá" style="color:var(--red)">${U.icon('trash', 16)}</button></td></tr>`).join('')}
          </tbody></table>`, `<button class="btn btn-sm" id="catAdd">${U.icon('plus', 14)}Thêm nhóm</button>`)}

        ${card('statuses', 'Trạng thái', `
          <p class="small muted">Trạng thái quyết định màu điểm đánh dấu. Ba trạng thái gốc (Đang hoạt động, Đến hạn kiểm định, Ngừng hoạt động) dùng cho Dashboard: có thể đổi tên/màu nhưng không xoá được.</p>
          <table class="tbl"><thead><tr><th>Trạng thái</th><th>Màu</th><th>Loại</th><th class="num">Tài sản</th><th class="actions"></th></tr></thead><tbody>
            ${S.statuses().map((x) => `<tr data-id="${U.esc(x.id)}"><td>${UI.statusBadge(x.id)}</td><td class="mono small">${x.color}</td><td class="small muted">${x.core ? 'Gốc' : 'Tuỳ chỉnh'}</td><td class="num">${S.assets().filter((a) => a.status === x.id).length}</td>
              <td class="actions"><button class="icon-btn" data-sact="edit" title="Sửa">${U.icon('edit', 16)}</button>${x.core ? '' : `<button class="icon-btn" data-sact="del" title="Xoá" style="color:var(--red)">${U.icon('trash', 16)}</button>`}</td></tr>`).join('')}
          </tbody></table>`, `<button class="btn btn-sm" id="stAdd">${U.icon('plus', 14)}Thêm trạng thái</button>`)}

        ${card('coding', 'Quy tắc mã vị trí', `<div class="guide">
          <p>Hệ thống dùng <b>hai mã độc lập</b>:</p>
          <table><tr><th>Mã</th><th>Ví dụ</th><th>Đặc điểm</th></tr>
            <tr><td><b>Asset ID</b></td><td class="mono">AST-EQP-0001</td><td>Cố định trong suốt vòng đời tài sản. Không đổi khi di chuyển và không được dùng lại sau khi xoá. Định dạng AST-&lt;mã nhóm&gt;-&lt;số thứ tự 4 chữ số&gt;.</td></tr>
            <tr><td><b>Location Code</b></td><td class="mono">F1-PR-EXT-X025-Y040</td><td>Mô tả vị trí hiện tại. Tự tính lại mỗi lần di chuyển (và khi sửa mã tầng/bộ phận/khu vực).</td></tr></table>
          <h4>Cấu trúc Location Code</h4>
          <table><tr><th>Thành phần</th><th>Ví dụ</th><th>Ý nghĩa</th></tr>
            <tr><td>Mã tầng</td><td class="mono">F1</td><td>Tầng 1</td></tr>
            <tr><td>Mã bộ phận</td><td class="mono">PR</td><td>Bộ phận phụ trách <i>khu vực</i>, VD: Sản xuất</td></tr>
            <tr><td>Mã khu vực</td><td class="mono">EXT</td><td>Khu trích ly</td></tr>
            <tr><td>X</td><td class="mono">X025</td><td>Tọa độ X, làm tròn %, 3 chữ số</td></tr>
            <tr><td>Y</td><td class="mono">Y040</td><td>Tọa độ Y, làm tròn %, 3 chữ số</td></tr></table>
          <h4>Hệ tọa độ</h4>
          <div class="coord-fig">
            <svg width="230" height="150" viewBox="0 0 230 150" role="img" aria-label="Sơ đồ hệ tọa độ">
              <rect x="30" y="20" width="180" height="108" fill="#f8fafc" stroke="#94a3b8" stroke-width="1.5"/>
              <circle cx="30" cy="20" r="4" fill="#dc2626"/><text x="4" y="14" font-size="10" fill="#dc2626">0,0</text>
              <path d="M30 20h70" stroke="#1d63d8" stroke-width="2" marker-end="url(#ar)"/><text x="104" y="16" font-size="11" fill="#1d63d8">X →</text>
              <path d="M30 20v60" stroke="#0d9488" stroke-width="2" marker-end="url(#ar2)"/><text x="6" y="92" font-size="11" fill="#0d9488">Y ↓</text>
              <text x="212" y="140" font-size="10" fill="#64748b" text-anchor="end">100,100</text>
              <circle cx="${30 + 180 * 0.25}" cy="${20 + 108 * 0.4}" r="5" fill="#0d9488" stroke="#fff" stroke-width="1.5"/><text x="${36 + 180 * 0.25}" y="${24 + 108 * 0.4}" font-size="10" fill="#0f172a">X 25 · Y 40</text>
              <defs><marker id="ar" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6z" fill="#1d63d8"/></marker><marker id="ar2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0 0L6 3L0 6z" fill="#0d9488"/></marker></defs>
            </svg>
            <ul style="flex:1;min-width:220px">
              <li>Tọa độ là <b>phần trăm chuẩn hoá 0–100</b> theo chiều rộng (X) và chiều cao (Y) của bản vẽ.</li>
              <li><b>Gốc tọa độ</b> = góc trên bên trái bản vẽ. <b>X</b> tăng sang phải, <b>Y</b> tăng xuống dưới (giống SVG và hầu hết bản vẽ CAD khi xuất ra).</li>
              <li>Lưu với độ chính xác 0,1 %, không phụ thuộc màn hình, mức phóng hay thiết bị. Với nhà xưởng rộng 100 m, 0,1 % ≈ 10 cm.</li>
              <li>Khi thay bản vẽ, giữ nguyên phạm vi/lề để tọa độ cũ vẫn đúng.</li>
            </ul></div>
          ${sample ? `<p>Ví dụ từ dữ liệu hiện tại: <span class="asset-id">${U.esc(sample.id)}</span> → <span class="loc-code">${U.esc(sample.locationCode)}</span></p>` : ''}
        </div>`)}

        ${card('data', 'Quản lý dữ liệu &amp; sao lưu', `
          <div class="callout ${S.isDemo() ? 'warn' : ''}" style="margin-bottom:12px">${U.icon('database', 16)}<div>${F.remote.enabled()
            ? `Dữ liệu được dùng chung qua máy chủ (<span class="mono">${U.esc(F.remote.base())}</span>, Cloudflare D1) và lưu đệm trên trình duyệt này (${kb} KB). Thay đổi của người khác hiển thị sau khoảng 20 giây. Khôi phục demo / khôi phục bản sao lưu / xoá toàn bộ sẽ thay dữ liệu cho <b>tất cả người dùng</b> và cần admin key.`
            : `Dữ liệu lưu trong LocalStorage của trình duyệt này (đã dùng ${kb} KB, giới hạn khoảng 5 MB) và <b>không dùng chung</b> giữa các máy.`} Hãy tải bản sao lưu JSON định kỳ. ${S.isDemo() ? '<br><b>Dữ liệu hiện tại là bộ dữ liệu demo minh họa.</b>' : ''}</div></div>
          <div class="grid grid-2">
            <div><h4>Sao lưu &amp; khôi phục</h4><p class="small muted">Sao lưu toàn bộ (tài sản, vị trí, lịch sử, khu vực, bản vẽ, cài đặt) dạng JSON.</p>
              <div class="btn-row"><button class="btn btn-primary" id="dmBackup">${U.icon('download', 16)}Tải bản sao lưu JSON</button><button class="btn" id="dmRestore">${U.icon('upload', 16)}Khôi phục từ bản sao lưu</button></div></div>
            <div><h4>Bảng tính</h4><p class="small muted">Xuất sổ tài sản ra CSV/Excel hoặc nhập hàng loạt.</p>
              <div class="btn-row"><button class="btn" id="dmCsv">${U.icon('download', 16)}Tài sản CSV</button><button class="btn" id="dmXlsx">${U.icon('download', 16)}Workbook (.xlsx)</button><button class="btn" id="dmImport">${U.icon('upload', 16)}Nhập…</button></div></div>
            <div><h4>Khôi phục dữ liệu demo</h4><p class="small muted">Thay toàn bộ dữ liệu bằng bộ dữ liệu demo ban đầu.</p>
              <button class="btn btn-danger" id="dmReset">${U.icon('history', 16)}Khôi phục dữ liệu demo</button></div>
            <div><h4>Bắt đầu với dữ liệu trống</h4><p class="small muted">Xoá tài sản, khu vực, lịch sử và bản vẽ demo; giữ nhóm tài sản, trạng thái, bộ phận và người dùng.</p>
              <button class="btn btn-danger" id="dmClear">${U.icon('trash', 16)}Xoá toàn bộ dữ liệu</button></div>
          </div>`)}

        ${card('importexport', 'Hướng dẫn nhập / xuất dữ liệu', `<div class="guide">
          <h4>Xuất dữ liệu</h4>
          <ul><li><b>Sổ tài sản → Xuất CSV / Excel</b> xuất các dòng đang hiển thị (theo tìm kiếm và bộ lọc).</li>
            <li>File Excel gồm các sheet <i>Tài sản</i>, <i>Khu vực</i>, <i>Lịch sử vị trí</i> và <i>Thông tin</i>.</li>
            <li><b>Lịch sử vị trí → Xuất</b> xuất lịch sử theo bộ lọc.</li></ul>
          <h4>Nhập tài sản (CSV / Excel)</h4>
          <ol><li>Tải file mẫu (<a href="#" id="tplCsv">CSV</a> · <a href="#" id="tplXlsx">Excel</a>) hoặc dùng file đã xuất.</li>
            <li>Mỗi dòng một tài sản. Bắt buộc: Asset ID, Tên tài sản, Nhóm, Bộ phận, Tầng, Khu vực, X, Y, Trạng thái. Tiêu đề cột tiếng Việt hoặc tiếng Anh đều được.</li>
            <li>Nhóm, Bộ phận, Tầng, Khu vực và Trạng thái có thể ghi theo <b>mã hoặc tên</b> (VD: <span class="mono">EQP</span> hoặc <span class="mono">Thiết bị</span>). Khu vực phải có sẵn trên tầng đó.</li>
            <li>X / Y là phần trăm 0–100, chấp nhận dấu phẩy thập phân. Ngày: YYYY-MM-DD hoặc DD/MM/YYYY.</li>
            <li>Sổ tài sản → <b>Nhập CSV / Excel</b>, chọn tệp và chế độ. Màn hình xem trước liệt kê dòng mới, dòng cập nhật và lỗi <i>trước khi</i> lưu.</li>
            <li>Dòng lỗi được bỏ qua; dòng hợp lệ được nhập. Thay đổi vị trí của tài sản đã có được ghi vào Lịch sử vị trí với lý do "Nhập hàng loạt: &lt;tên tệp&gt;".</li></ol>
          <p>Kiểm tra: Asset ID trùng (trong file và với dữ liệu hiện có), thiếu trường bắt buộc, mã không tồn tại, tọa độ ngoài 0–100, khu vực không thuộc tầng, Asset ID của tài sản đã xoá.</p>
          <p>File CSV được ghi UTF-8 có BOM nên Excel hiển thị đúng tiếng Việt.</p></div>`)}

        ${card('floorplans', 'Bản vẽ: nhập SVG và chuyển đổi từ CAD / PDF', `<div class="guide">
          <p>Mỗi tầng có một bản vẽ riêng. <b>Khuyến nghị dùng SVG</b> (dạng vector, sắc nét ở mọi mức phóng, dung lượng nhỏ). Chấp nhận PNG/JPG/WEBP. Nhập tại <a href="#/zones">Khu vực nhà máy</a> → Tầng → <b>Nhập bản vẽ</b>.</p>
          <h4>Quy trình khuyến nghị</h4>
          <ol><li><b>Từ AutoCAD (DWG/DXF):</b> tắt các layer không cần (kích thước, hatch, chữ nội thất), đặt vùng in theo tường bao nhà xưởng, rồi <i>Plot → "DWG to PDF"</i> hoặc xuất SVG. Có thể mở DXF bằng <b>Inkscape</b> hoặc <b>LibreCAD</b> rồi lưu SVG.</li>
            <li><b>Từ PDF:</b> mở trang PDF bằng Inkscape (<i>File → Open</i>, chọn "Import via Poppler/Cairo"), cắt theo tường bao (<i>Edit → Resize Page to Selection</i>) rồi <i>Save As → Optimized SVG</i>. Dòng lệnh: <span class="mono">pdftocairo -svg plan.pdf plan.svg</span> hoặc <span class="mono">inkscape plan.pdf --export-type=svg</span>.</li>
            <li><b>Từ bản vẽ scan / ảnh chụp:</b> cắt theo tường bao, nắn thẳng và lưu PNG (≤ 2400 px). Ảnh lớn hơn sẽ tự thu nhỏ.</li>
            <li>Giữ dung lượng nhỏ (tốt nhất &lt; 1 MB, tối đa 1,8 MB): bỏ layer ẩn, kiểu chữ, font nhúng và ảnh raster.</li>
            <li>Sau khi nhập, tạo khu vực bằng <b>Vẽ ranh giới trên sơ đồ</b>, rồi đặt tài sản bằng <b>Di chuyển</b> hoặc nhập X/Y.</li></ol>
          <h4>Lưu ý</h4>
          <ul><li>Toàn bộ vùng bản vẽ tương ứng 0–100 %. Cắt bản vẽ theo một khung cố định (tường bao + lề nhỏ); nếu sau này thay bản vẽ với khung khác, mọi vị trí sẽ bị lệch.</li>
            <li>SVG được hiển thị dưới dạng ảnh: script và mã sự kiện bị loại bỏ để đảm bảo an toàn.</li>
            <li>Không dùng tọa độ thực khi chưa kiểm tra tại hiện trường. Bản vẽ và tọa độ mẫu kèm theo chỉ là <b>dữ liệu demo</b>.</li></ul></div>`)}

        ${card('guide', 'Hướng dẫn sử dụng', `<div class="guide">
          <h4>Tìm tài sản</h4>
          <ul><li>Nhập Asset ID hoặc tên vào ô tìm kiếm trên cùng (hoặc ô tìm trên sơ đồ) và nhấn Enter — sơ đồ chuyển đúng tầng, phóng tới tài sản và mở thông tin chi tiết.</li>
            <li>Hoặc quét nhãn QR: camera điện thoại mở đường dẫn; máy quét cầm tay dùng ở <i>Mã QR → Quét / tra cứu</i>.</li></ul>
          <h4>Sử dụng sơ đồ</h4>
          <ul><li>Lăn chuột / chụm hai ngón để phóng to–thu nhỏ, kéo để di chuyển, nút <i>Vừa màn hình</i> để đặt lại. Các nút tầng để đổi tầng.</li>
            <li><b>Màu = trạng thái</b>, <b>hình dạng = nhóm tài sản</b> (xem chú giải). Bấm điểm đánh dấu để xem chi tiết.</li>
            <li>Bộ lọc: khu vực, bộ phận quản lý, nhóm (ẩn/hiện) và trạng thái. Góc dưới bên phải hiển thị tọa độ con trỏ theo %.</li></ul>
          <h4>Thêm / sửa / xoá tài sản</h4>
          <ul><li>Sổ tài sản → <b>Thêm tài sản</b>. Asset ID được đề xuất theo nhóm; Location Code được tạo tự động.</li>
            <li>Sửa từ sổ tài sản hoặc bảng chi tiết trên sơ đồ. Đổi tầng/khu vực/X/Y phải nhập lý do và hệ thống ghi lịch sử.</li>
            <li>Xoá cần xác nhận; lịch sử được giữ lại và Asset ID không được dùng lại.</li></ul>
          <h4>Di chuyển tài sản</h4>
          <ol><li>Chọn tài sản trên sơ đồ → <b>Di chuyển</b>.</li><li>(Tuỳ chọn) đổi tầng, rồi bấm vào vị trí mới. Khu vực được nhận tự động.</li><li>Kiểm tra Location Code mới, nhập <b>Lý do thay đổi</b> và lưu. Một dòng Lịch sử vị trí được thêm vào.</li></ol>
          <h4>Quản lý khu vực</h4>
          <ul><li>Khu vực nhà máy → Thêm khu vực → <b>Vẽ ranh giới trên sơ đồ</b> (kéo hình chữ nhật). Mỗi khu vực thuộc một tầng và một bộ phận.</li>
            <li>Bấm khu vực trong cây cơ cấu hoặc nút "Sơ đồ" để xem trên sơ đồ.</li></ul>
          <h4>In nhãn QR</h4>
          <ul><li>Mã QR → đánh dấu tài sản → chọn khổ nhãn → <b>In nhãn</b>. Trong hộp thoại in chọn tỉ lệ 100 % / "Actual size". Tải từng ảnh PNG ở phần xem trước.</li>
            <li>Đặt <b>QR base URL</b> (Thông tin chung) thành địa chỉ web trước, để mọi điện thoại quét nhãn đều mở được ứng dụng.</li></ul></div>`)}

        ${card('future', 'Tích hợp trong tương lai (chưa có ở phiên bản này)', `<div class="future-list">
          ${[
            ['Đăng nhập & phân quyền', 'Đăng nhập, quyền xem/sửa/quản trị; "Người cập nhật" lấy từ tài khoản đăng nhập (VD: Cloudflare Access).'],
            ['Định vị thời gian thực', 'Thẻ RTLS / BLE / UWB hoặc GPS cho thiết bị di động như xe nâng. Mã QR chỉ nhận dạng, không theo dõi vị trí.'],
            ['Quét camera trên mọi trình duyệt', 'Thư viện giải mã QR đi kèm cho iOS/Firefox. Hiện dùng BarcodeDetector API nếu trình duyệt hỗ trợ.'],
            ['Kết nối CMMS / ERP', 'Lệnh công việc, lịch kiểm định, lịch sử bảo trì từ hệ thống bảo trì (VD: SAP PM, Maximo).'],
            ['Khu vực dạng đa giác', 'Ranh giới khu vực không phải hình chữ nhật, vẽ theo bản vẽ.'],
            ['Lưu ảnh và bản vẽ trên R2', 'Lưu ảnh tài sản và bản vẽ lớn trên Cloudflare R2 thay vì trong cơ sở dữ liệu.'],
          ].map(([t, d]) => `<div class="it"><span class="future-tag">TƯƠNG LAI</span><div><b>${t}</b><div class="small muted">${d}</div></div></div>`).join('')}
        </div>`)}
        </div>
      </div>`;

    U.$$('[data-sec]', root).forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); ST.scrollTo(a.dataset.sec); }));
    if (params.section) setTimeout(() => ST.scrollTo(params.section), 30);

    U.$('#setGeneral').addEventListener('submit', (e) => {
      e.preventDefault();
      const d = UI.formData(e.target);
      if (d.qrBaseUrl && !/^https?:\/\//i.test(d.qrBaseUrl.trim())) return UI.toast('QR base URL phải bắt đầu bằng http:// hoặc https://', 'error');
      if (!d.factoryName.trim()) return UI.toast('Bắt buộc nhập tên nhà máy', 'error');
      S.updateFactory({ name: d.factoryName.trim(), code: d.factoryCode.trim() });
      S.updateSettings({ qrBaseUrl: d.qrBaseUrl.trim(), markerScale: Number(d.markerScale), autoDetectZone: d.autoDetectZone, showZones: d.showZones, showLabels: d.showLabels });
      UI.toast('Đã lưu cài đặt.', 'success');
    });

    // users
    U.$('#usrAdd').addEventListener('click', () => userForm());
    U.$('#set-users').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-uact]'); if (!b) return;
      const id = b.closest('tr').dataset.id;
      if (b.dataset.uact === 'edit') userForm(S.users().find((u) => u.id === id));
      else if (S.users().length <= 1) UI.toast('Cần ít nhất một người dùng.', 'error');
      else if (await UI.confirm('Xoá người dùng này khỏi danh sách? Các dòng lịch sử đã ghi vẫn giữ tên.', { danger: true, okLabel: 'Xoá' })) S.deleteUser(id);
    });
    // categories
    U.$('#catAdd').addEventListener('click', () => categoryForm());
    U.$('#set-categories').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-cact]'); if (!b) return;
      const id = b.closest('tr').dataset.id;
      if (b.dataset.cact === 'edit') categoryForm(S.category(id));
      else if (await UI.confirm(`Xoá nhóm <b>${U.esc(id)}</b>?`, { danger: true, okLabel: 'Xoá' })) try { S.deleteCategory(id); UI.toast('Đã xoá nhóm.', 'success'); } catch (err) { UI.toast(err.message, 'error'); }
    });
    // statuses
    U.$('#stAdd').addEventListener('click', () => statusForm());
    U.$('#set-statuses').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-sact]'); if (!b) return;
      const id = b.closest('tr').dataset.id;
      if (b.dataset.sact === 'edit') statusForm(S.status(id));
      else if (await UI.confirm(`Xoá trạng thái <b>${U.esc(S.status(id).name)}</b>?`, { danger: true, okLabel: 'Xoá' })) try { S.deleteStatus(id); UI.toast('Đã xoá trạng thái.', 'success'); } catch (err) { UI.toast(err.message, 'error'); }
    });
    // data
    U.$('#dmBackup').addEventListener('click', IO.backup);
    U.$('#dmRestore').addEventListener('click', IO.restore);
    U.$('#dmCsv').addEventListener('click', () => IO.exportAssets('csv'));
    U.$('#dmXlsx').addEventListener('click', () => IO.exportAssets('xlsx'));
    U.$('#dmImport').addEventListener('click', () => F.views.register.openImport());
    U.$('#tplCsv').addEventListener('click', (e) => { e.preventDefault(); IO.downloadTemplate('csv'); });
    U.$('#tplXlsx').addEventListener('click', (e) => { e.preventDefault(); IO.downloadTemplate('xlsx'); });
    U.$('#dmReset').addEventListener('click', async () => {
      if (await UI.confirm('Thay <b>toàn bộ</b> dữ liệu hiện tại bằng bộ dữ liệu demo ban đầu? Hãy tải bản sao lưu trước nếu muốn giữ các thay đổi.', { title: 'Khôi phục dữ liệu demo', danger: true, okLabel: 'Khôi phục demo' })) { S.reset(); if (!F.remote.enabled()) UI.toast('Đã khôi phục dữ liệu demo.', 'success'); }
    });
    U.$('#dmClear').addEventListener('click', async () => {
      if (await UI.confirm('Xoá toàn bộ tài sản, khu vực, bản vẽ và lịch sử? Không thể hoàn tác (trừ khi khôi phục từ bản sao lưu).', { title: 'Xoá toàn bộ dữ liệu', danger: true, okLabel: 'Xoá toàn bộ' })) { S.clearAll(); if (!F.remote.enabled()) UI.toast('Đã xoá toàn bộ dữ liệu. Hãy bắt đầu bằng việc nhập bản vẽ ở Khu vực nhà máy.', 'success', 5000); }
    });
  };
  ST.refresh = () => ST.show();
  ST.scrollTo = (sec) => {
    const el = U.$('#set-' + sec);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    U.$$('[data-sec]').forEach((a) => a.classList.toggle('on', a.dataset.sec === sec));
  };

  function userForm(u) {
    const form = U.h(`<form class="form-grid"><div class="field"><label>Họ tên <span class="req">*</span></label><input name="name" value="${U.esc(u ? u.name : '')}"></div><div class="field"><label>Vai trò</label><input name="role" value="${U.esc(u ? u.role : '')}"></div></form>`);
    UI.modal({ title: u ? 'Sửa người dùng' : 'Thêm người dùng', body: form, actions: [{ label: 'Hủy' }, { label: 'Lưu', primary: true, onClick: () => {
      const d = UI.formData(form);
      try {
        const wasCurrent = u && S.currentUser() === u.name;
        S.saveUser({ id: u && u.id, name: d.name.trim(), role: d.role.trim() });
        if (wasCurrent) S.setCurrentUser(d.name.trim());
      } catch (e) { UI.toast(e.message, 'error'); return false; }
    } }] });
  }
  function categoryForm(c) {
    const form = U.h(`<form class="form-grid">
      <div class="field"><label>Mã <span class="req">*</span></label><input name="code" maxlength="6" value="${U.esc(c ? c.code : '')}" ${c ? 'readonly' : ''} style="text-transform:uppercase;font-family:var(--mono)"><div class="hint">Dùng trong Asset ID, VD: AST-<b>MHE</b>-0001</div></div>
      <div class="field"><label>Tên nhóm <span class="req">*</span></label><input name="name" value="${U.esc(c ? c.name : '')}"></div>
      <div class="field"><label>Ký hiệu trên sơ đồ</label><select name="shape">${SHAPES.map(([v, t]) => `<option value="${v}" ${c && c.shape === v ? 'selected' : ''}>${t}</option>`).join('')}</select></div></form>`);
    UI.modal({ title: c ? 'Sửa nhóm tài sản' : 'Thêm nhóm tài sản', body: form, actions: [{ label: 'Hủy' }, { label: 'Lưu', primary: true, onClick: () => {
      const d = UI.formData(form);
      try { S.saveCategory({ id: c && c.id, code: d.code.trim().toUpperCase(), name: d.name.trim(), shape: d.shape }); UI.toast('Đã lưu nhóm.', 'success'); } catch (e) { UI.toast(e.message, 'error'); return false; }
    } }] });
  }
  function statusForm(x) {
    const form = U.h(`<form class="form-grid">
      <div class="field"><label>Tên trạng thái <span class="req">*</span></label><input name="name" value="${U.esc(x ? x.name : '')}"></div>
      <div class="field"><label>Màu</label><input type="color" name="color" value="${U.esc(x ? x.color : '#64748b')}"></div></form>`);
    UI.modal({ title: x ? 'Sửa trạng thái' : 'Thêm trạng thái', body: form, actions: [{ label: 'Hủy' }, { label: 'Lưu', primary: true, onClick: () => {
      const d = UI.formData(form);
      try { S.saveStatus({ id: x && x.id, name: d.name.trim(), color: d.color }); UI.toast('Đã lưu trạng thái.', 'success'); } catch (e) { UI.toast(e.message, 'error'); return false; }
    } }] });
  }
})(window.FAM);
