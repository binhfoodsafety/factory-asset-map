# Hướng dẫn sử dụng – Bản đồ tài sản nhà máy

Hướng dẫn này cũng có trong ứng dụng, mục **Cài đặt & Hướng dẫn**.

## Khái niệm

| Thuật ngữ | Ý nghĩa |
|---|---|
| Asset ID | Mã tài sản cố định, VD `AST-EQP-0001`. Không đổi, không dùng lại. |
| Location Code | Vị trí hiện tại, VD `F1-PR-EXT-X025-Y040` (tầng – bộ phận của khu vực – khu vực – X – Y). Tự tính lại mỗi lần di chuyển. |
| Tọa độ | X / Y tính theo **% bản vẽ** (0–100). Gốc ở góc trên bên trái, X sang phải, Y xuống dưới. |
| Khu vực | Vùng hình chữ nhật trên một tầng (VD: Trích ly), thuộc một bộ phận. |
| Trạng thái | Đang hoạt động / Đến hạn kiểm định / Ngừng hoạt động (+ tuỳ chỉnh). Quyết định màu điểm đánh dấu. |
| Nhóm tài sản | Thiết bị / Phụ trợ / Phòng thí nghiệm / Nội thất (+ tuỳ chỉnh). Quyết định hình dạng điểm đánh dấu và tiền tố Asset ID. |

"Người thao tác" (thanh trên cùng) là tên được ghi vào cột **Người cập nhật** của lịch sử vị trí. Ứng dụng không cần đăng nhập.

## Tìm tài sản

* Ô tìm kiếm trên cùng hoặc ô tìm trên sơ đồ: nhập Asset ID (hoặc một phần tên / serial) rồi nhấn **Enter**. Sơ đồ chuyển đúng tầng, phóng tới tài sản và mở thông tin chi tiết.
* Quét nhãn QR bằng camera điện thoại – đường dẫn mở tài sản trên sơ đồ.
* Mã QR → *Quét / tra cứu*: dùng được máy quét USB / Bluetooth (chế độ bàn phím) và camera trên trình duyệt hỗ trợ.

## Sơ đồ tương tác

* Lăn chuột / chụm hai ngón = phóng to–thu nhỏ, kéo = di chuyển, ⛶ = vừa màn hình, ⓘ = bật/tắt chú giải. Các nút tầng để đổi tầng.
* Bộ lọc: khu vực (đồng thời phóng tới khu vực), bộ phận quản lý, ẩn/hiện nhóm, trạng thái.
* Góc dưới bên phải hiển thị tọa độ con trỏ theo %, tiện để đọc tọa độ từ bản vẽ.
* Bấm điểm đánh dấu → bảng chi tiết với đầy đủ thông tin, ảnh, lịch sử gần đây và các thao tác.

## Di chuyển tài sản

1. Chọn tài sản → **Di chuyển** (hoặc Sổ tài sản → biểu tượng di chuyển).
2. Có thể đổi tầng, sau đó bấm vào vị trí mới. Khu vực được nhận tự động theo ranh giới.
3. Kiểm tra tầng, khu vực, X, Y và Location Code mới; nhập **Lý do thay đổi**; Lưu.

Hệ thống thêm một dòng lịch sử (vị trí cũ → mới, người cập nhật, lý do, thời gian). Lịch sử không bao giờ bị sửa hoặc xoá.

## Sổ tài sản (Asset Register)

* Thêm tài sản: Asset ID được đề xuất theo nhóm (`AST-UTL-0005`); có thể nhập mã theo hệ thống đánh số sẵn có.
* Bắt buộc: Asset ID, tên, nhóm, bộ phận quản lý, trạng thái, tầng, khu vực, X, Y.
* Sửa tầng / khu vực / X / Y phải nhập lý do (hệ thống ghi lịch sử).
* Xoá cần xác nhận; lịch sử được giữ lại và Asset ID không được dùng lại.
* Bấm tiêu đề cột để sắp xếp; dùng bộ lọc và ô tìm kiếm; **Định vị** để xem tài sản trên sơ đồ.

### Nhập từ CSV / Excel

1. Tải file mẫu (hộp thoại Nhập, mục Cài đặt, hoặc `templates/mau-nhap-tai-san.csv`).
2. Mỗi dòng một tài sản. Nhóm / Bộ phận / Tầng / Khu vực / Trạng thái ghi theo mã hoặc tên. Tiêu đề cột tiếng Việt hoặc tiếng Anh đều được.
3. Nhập → chọn tệp → chọn chế độ (*chỉ thêm mới* hoặc *thêm mới & cập nhật*) → xem trước (mới, cập nhật, lỗi) → **Nhập dữ liệu**.
4. Dòng lỗi được bỏ qua và liệt kê kèm lý do.

## Khu vực nhà máy và bản vẽ

* Khu vực nhà máy hiển thị cây Nhà máy → Tầng → Bộ phận → Khu vực kèm số tài sản. Bấm vào khu vực để xem trên sơ đồ.
* **Thêm khu vực → Vẽ ranh giới trên sơ đồ**: kéo một hình chữ nhật; biểu mẫu mở lại với ranh giới đã điền.
* Không xoá được khu vực đang có tài sản (hãy di chuyển tài sản trước).
* **Tầng → Nhập bản vẽ** thay bản vẽ của tầng (ưu tiên SVG; chấp nhận PNG / JPG, tối đa khoảng 1,8 MB).

### Chuyển bản vẽ CAD / PDF sang SVG

* **AutoCAD DWG/DXF** – tắt các layer không cần (kích thước, hatch, chữ), in vùng tường bao ra PDF ("DWG to PDF") hoặc mở DXF bằng Inkscape / LibreCAD rồi lưu SVG.
* **PDF** – Inkscape: *File → Open* (Poppler/Cairo) → *Edit → Resize Page to Selection* → *Save As → Optimized SVG*. Dòng lệnh: `pdftocairo -svg plan.pdf plan.svg`.
* **Bản scan / ảnh chụp** – cắt theo tường bao, nắn thẳng, lưu PNG ≤ 2400 px.
* Khi cập nhật bản vẽ sau này, giữ nguyên khung cắt; tọa độ được tính theo mép bản vẽ.

## Mã QR

* Nội dung QR = `<QR base URL>#/map?asset=<Asset ID>`. Đặt QR base URL (Cài đặt → Thông tin chung) bằng địa chỉ web đã công bố.
* Xem trước → **Tải PNG** (kèm ID, tên và Location Code) hoặc **In nhãn**.
* Đánh dấu nhiều tài sản → chọn khổ nhãn → **In nhãn** (in tỉ lệ 100 % / "Actual size").
* Mã QR chỉ nhận dạng tài sản, **không** định vị theo thời gian thực. Sơ đồ hiển thị vị trí được ghi nhận gần nhất.

## Cài đặt & dữ liệu

* Nhóm tài sản (mã dùng trong Asset ID mới, hình dạng điểm đánh dấu), trạng thái (tên, màu), người dùng, kích thước điểm đánh dấu, tuỳ chọn sơ đồ.
* **Tải bản sao lưu JSON** định kỳ. **Khôi phục**, **Khôi phục dữ liệu demo** và **Xoá toàn bộ dữ liệu** thay dữ liệu cho mọi người dùng và cần admin key khi dùng máy chủ Cloudflare.
* Thanh bên trái hiển thị trạng thái đồng bộ: *Đã đồng bộ Cloudflare*, *Đang lưu…*, hoặc *Mất kết nối — thay đổi lưu tạm trên máy* (tự tải lên khi có kết nối lại).

## Kế toán TSCĐ

Tab **Kế toán TSCĐ** dành cho bộ phận tài chính – kế toán.

| Màn hình | Chức năng |
|---|---|
| Danh sách TSCĐ & CCDC | Nguyên giá, khấu hao kỳ, hao mòn luỹ kế, giá trị còn lại, thời gian còn lại, tình trạng (đang khấu hao / đã khấu hao hết / đã ghi giảm). In Thẻ TSCĐ. Xuất Excel cho MISA. |
| Nghiệp vụ tăng / giảm | Ghi tăng (tự tạo khi khai báo), nâng cấp / sửa chữa lớn, đánh giá lại, điều chuyển bộ phận, thanh lý / nhượng bán. In biên bản giao nhận, điều chuyển, thanh lý. |
| Khấu hao & phân bổ | Bảng tính khấu hao chi tiết và bảng phân bổ (TK Nợ – TK Có – bộ phận) cho một hoặc nhiều kỳ. Xuất Excel gồm sheet bút toán để nhập vào MISA. |
| Sổ TSCĐ / CCDC | Sổ theo năm: ghi tăng – khấu hao – ghi giảm. In / xuất Excel. |
| Khoá sổ & tài khoản | Khoá sổ đến kỳ, danh mục tài khoản, nguồn vốn, cách tính khấu hao theo ngày hoặc tròn tháng. |

### Cách tính

* **Đường thẳng:** mức khấu hao tháng = (nguyên giá − hao mòn luỹ kế) / số tháng còn lại. Tính lại khi nâng cấp hoặc đánh giá lại.
* **Số dư giảm dần có điều chỉnh:** mức năm = giá trị còn lại × hệ số (1,5 nếu ≤ 4 năm; 2,0 nếu 4–6 năm; 2,5 nếu > 6 năm) / số năm sử dụng; chuyển sang chia đều cho số năm còn lại khi mức này thấp hơn.
* **CCDC:** phân bổ đều qua TK 242 theo số kỳ.
* **Theo ngày (mặc định):** tháng ghi tăng chỉ tính số ngày sử dụng; tháng ghi giảm tính đến ngày trước ngày ghi giảm; tháng cuối lấy phần còn lại để tổng khấu hao đúng bằng nguyên giá.

### Khoá sổ

Sau khi khoá sổ đến một kỳ, không thể thêm hoặc xoá nghiệp vụ trong kỳ đó, và không sửa được nguyên giá / thời gian / tài khoản của tài sản bắt đầu khấu hao trong kỳ đã khoá. Ứng dụng không có đăng nhập, nên mọi người dùng đều có thể mở khoá — cần quy trình nội bộ.

### Lưu ý

* Danh mục tài khoản mặc định cần được đối chiếu với hệ thống tài khoản chi tiết của đơn vị theo chế độ kế toán đang áp dụng (TT 99/2025/TT-BTC).
* Mẫu chứng từ in là **mẫu tham khảo**; đối chiếu với mẫu biểu đơn vị đang dùng.
* File "Xuất Excel cho MISA" và sheet bút toán theo cấu trúc khai báo / nghiệp vụ khác; trước khi nhập khẩu cần đối chiếu tên và thứ tự cột với file mẫu tải từ phiên bản MISA đang dùng.
* Tài sản đã khai báo kế toán không xoá được; hãy ghi giảm (thanh lý). Tài sản đã ghi giảm không còn hiển thị trên sơ đồ.

## Kiểm kê

1. **Tạo đợt kiểm kê:** tab Kiểm kê → Tạo đợt kiểm kê; chọn tầng / khu vực. Danh sách tài sản theo sổ được chốt khi tạo.
2. **Quét:** máy quét cầm tay (gõ vào ô quét), nút Camera (trình duyệt hỗ trợ BarcodeDetector), hoặc bật *Ghi nhận khi quét QR bằng camera điện thoại* rồi quét nhãn bằng ứng dụng camera — mỗi lần quét mở trang và ghi nhận vào đợt.
3. **Khu vực đang kiểm:** chọn khu vực mình đang đứng; tài sản quét được nhưng theo sổ ở khu khác sẽ ghi "sai vị trí".
4. **Đánh dấu tay:** Có / Sai vị trí / Hỏng / Không thấy, kèm ghi chú.
5. **Kết thúc:** tài sản chưa kiểm ghi nhận "Không tìm thấy"; tuỳ chọn cập nhật vị trí theo thực tế (ghi Lịch sử vị trí) và chuyển tài sản hỏng sang "Ngừng hoạt động".
6. **Biên bản kiểm kê:** in hoặc xuất Excel với các cột theo sổ kế toán – theo kiểm kê – chênh lệch (số lượng, nguyên giá, giá trị còn lại).
