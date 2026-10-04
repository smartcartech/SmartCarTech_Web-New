# Website SmartCarTech

Website bán xe robot SC Tech Pro / SC Tech của SmartCarTech. Được viết bằng HTML, CSS và JavaScript thuần: không có bước build, không dùng thư viện ngoài, chỉ tải font từ Google Fonts.

> **Tên gọi:** **SmartCarTech** là tên thương hiệu (logo, tiêu đề trang, footer, `site.brand`). **SC Tech Pro** và **SC Tech** chỉ là tên 2 dòng sản phẩm — đừng dùng "SC Tech" để chỉ shop.

```
index.html            Trang chủ
san-pham.html         Sản phẩm (?dong=pro|std&bo=day-du|khung-dong-co-banh|chi-khung)
huong-dan.html        Hướng dẫn (?dong=…&bo=…)
dat-hang.html         Đặt hàng (?mua=pro:day-du:2  hoặc  ?tu=gio-hang)
chinh-sach.html       Chính sách bảo hành (#bao-hanh), vận chuyển & đổi trả (#van-chuyen)
products.json         ★ DỮ LIỆU — file duy nhất bạn cần sửa
google-apps-script.gs Lưu đơn vào Google Sheet + kiểm tra mã tải code mẫu — không tải lên hosting
robots.txt, sitemap.xml  Cho Google biết các trang cần hiển thị
_config.yml           Danh sách file GitHub Pages không đưa lên web
assets/css/style.css  Toàn bộ giao diện (màu, font, khoảng cách ở đầu file)
assets/js/core.js     Phần dùng chung: tải dữ liệu, giỏ hàng, menu, gửi Zalo
assets/js/*.js        Mã riêng của từng trang
assets/img/           Ảnh WebP, icon (icons.svg), favicon, ảnh chia sẻ (og-image.jpg)
                      Logo: logo-smartcartech-nen-toi.webp (header/footer, viền trắng cho nền tối)
                            logo-smartcartech.png (màu gốc, cho nền sáng — Google dùng file này)
```

## 1. Chạy thử trên máy

Trình duyệt chặn việc đọc `products.json` khi bạn mở file bằng cách nhấp đúp. Vì vậy cần chạy qua một web server nhỏ:

- **VS Code:** cài extension *Live Server* → chuột phải vào `index.html` → *Open with Live Server*.
- **Hoặc dùng Python:** mở terminal trong thư mục này, chạy `python -m http.server 8080`, rồi mở http://localhost:8080

## 2. Đưa lên mạng

Web chạy trên mọi hosting tĩnh, không cần cài đặt thêm gì trên server. Nhưng **chỉ đưa lên các file của website**. File nào có trên hosting thì ai cũng mở được, VD `smartcartech.vn/README.md`.

**Tải lên:**

```
index.html  san-pham.html  huong-dan.html  dat-hang.html  chinh-sach.html
products.json  robots.txt  sitemap.xml
assets/        (cả thư mục)
```

**Không tải lên:**

- `README.md`: ghi chú nội bộ (việc cần làm, nguồn ảnh…).
- `google-apps-script.gs`: chỉ dùng để dán vào Google Apps Script. Nếu điền email báo đơn vào file này rồi tải lên thì email bị lộ.
- `_config.yml`, `.git/`, `.gitignore`, `.gitattributes`: file cấu hình.

Cách làm với từng loại hosting:

- **GitHub Pages** (web cũ đang dùng cách này): đẩy code lên GitHub như bình thường. GitHub Pages tự bỏ qua các file đã khai báo trong `_config.yml`. Nếu thêm file nội bộ mới, ghi tên vào mục `exclude` trong file đó. Dùng tên miền riêng thì thêm file `CNAME` chứa một dòng `smartcartech.vn`.
  - Lưu ý: nếu kho GitHub để **công khai (public)**, ai cũng xem được mọi file trong kho trên github.com, kể cả README. `_config.yml` chỉ giữ chúng khỏi web smartcartech.vn.
- **Hosting cPanel:** chỉ upload các file trong danh sách "Tải lên" vào `public_html`.
- **Netlify:** chép các file trong danh sách "Tải lên" sang một thư mục riêng, rồi kéo thả thư mục đó vào app.netlify.com/drop. Đừng kéo thả cả thư mục dự án.

Tên miền **smartcartech.vn** đã được ghi sẵn trong: `og:image` (4 file HTML), `og:url` + `canonical` (index.html), `SITE_URL` (assets/js/core.js), `robots.txt` và `sitemap.xml`. Nếu đổi tên miền, sửa hết các chỗ này.

- Web phải chạy ở **gốc tên miền** (`https://smartcartech.vn/index.html`), không đặt trong thư mục con.
- Bật **HTTPS** trên hosting và chuyển hướng `www.smartcartech.vn` → `smartcartech.vn` cho thống nhất.
- Sau khi web chạy: khai báo `https://smartcartech.vn/sitemap.xml` trong Google Search Console. Dán link vào developers.facebook.com/tools/debug để kiểm tra ảnh chia sẻ.

## 3. Sửa nội dung — chỉ sửa `products.json`

| Muốn đổi | Sửa ở |
|---|---|
| Số Zalo, hotline, email, link Facebook / TikTok / YouTube | `site` |
| Giá từng bộ | `lines[].kits[].price` — số nguyên, không có dấu chấm. VD: `1590000` |
| Link Shopee từng bộ | `lines[].kits[].shopee` — 2 bộ khung của cùng một dòng dùng chung 1 link, khách chọn phân loại trên Shopee |
| Danh sách linh kiện của từng dòng (các hàng trong bảng "Mỗi bộ gồm những gì") | `lines[].components` — mỗi linh kiện có `id`, `name`, `detail` (mô tả nhỏ, có thể bỏ) |
| Bộ nào gồm linh kiện gì | `lines[].kits[].includes` — dùng các `id` trong `components` của dòng đó. Linh kiện chỉ có một phần: ghi vào `partial`, VD: `{ "phu-kien": "Chỉ dây nối động cơ" }` |
| Ghi chú "chưa gồm… / chuẩn bị thêm…" ở trang Hướng dẫn | `lines[].kits[].missing`, `buy_more` |
| Tên, mô tả, điểm nổi bật, huy hiệu từng dòng | `lines[].name / tagline / highlight / badge` |
| Tiêu đề & mô tả SEO của trang sản phẩm | `lines[].seo` |
| Ảnh sản phẩm, ảnh gallery | `lines[].image`, `lines[].gallery`. Bộ có ảnh riêng: `kits[].image`, `kits[].gallery`. Đặt `hide_badge: true` trên ảnh gallery nếu huy hiệu che linh kiện. Thêm `src_small` (bản rộng 640px, đuôi `-640.webp`): trình duyệt tự tải bản nhẹ này khi màn hình không cần ảnh lớn |
| Lưu ý giao linh kiện để tự lắp trên trang Sản phẩm | `kits[].assembly_note` — hiển thị theo bộ đang chọn; bỏ trống thì ẩn |
| Video giới thiệu (trang Sản phẩm) | `video.src`: đường dẫn MP4 trong `assets/video/`, hoặc `video.youtube`: **mã** YouTube. Điền `title`, `poster`, `duration`. Video bổ sung: `videos[]`. Bộ có gallery riêng dùng `kits[].video` / `kits[].videos[]` |
| Video hướng dẫn (trang Hướng dẫn) | `guide.videos` — mỗi video có `title`, `youtube` (mã video), `duration` (VD `"13:36"`). Nhiều video thì hiện thành danh sách Phần 1, 2, 3… |
| Lưu ý khi nạp code (bước 2) | `guide.upload_note` — để `""` thì ẩn |
| Ảnh sơ đồ mạch (bấm để phóng to) | `guide.circuit_image` |
| Nút "Tải sơ đồ mạch", "Bản vẽ 3D (SolidWorks)" | `guide.circuit_download`, `guide.cad_download` — link Google Drive hoặc file trong `assets/` |
| Code mẫu .zip (chỉ người mua tải được) | `guide.code[].zip`: tên file .zip trong thư mục Google Drive riêng tư — xem mục 5. `guide.code[].icon`: hình minh họa, VD `sensor`, `phone`, `wheels` (bỏ trống thì dùng `code`). `guide.github`: để trống thì ẩn nút GitHub |
| Nội dung chính sách bảo hành, vận chuyển & đổi trả | Sửa trực tiếp trong `chinh-sach.html` (không nằm trong `products.json`) |
| App: tên, kết nối, link cửa hàng, mã QR | `guide.app` |
| Ảnh chụp màn hình app (khung điện thoại nằm ngang) | `guide.app.screens` — mỗi ảnh có `label` (tên nút chuyển), `src`, `alt`. Mặc định hiện ảnh cuối cùng |
| Các bước kết nối app (HC-06, mật khẩu 1234…) | Sửa trực tiếp trong `huong-dan.html`, phần Bước 3 |
| Chức năng ("Xe làm được gì?") | `lines[].features` |
| Bảng thông số & so sánh | `specs` — mỗi dòng có `label`, `pro`, `std`. Hàng nào `pro` khác `std` sẽ tự được đánh dấu vạch xanh |
| Câu hỏi thường gặp | `faq` |

**Lưu ý khi sửa:**

- **Link còn trống `""`:** nút vẫn hiện. Khi khách bấm, web báo "đang cập nhật". Riêng nút App Store (`guide.app.app_store`) sẽ ẩn hẳn khi để trống, vì app hiện chỉ có trên Google Play. Nút GitHub (`guide.github`) cũng ẩn khi để trống, vì code mẫu chỉ dành cho người mua.
- **Chữ trong `[NGOẶC VUÔNG]`** là chỗ trống còn chờ nội dung thật.
- **Kiểm tra lỗi cú pháp:** sau khi sửa, dán nội dung file vào jsonlint.com. Một dấu phẩy thừa hoặc thiếu cũng làm web không tải được dữ liệu.
- **Thêm ảnh mới:** lưu ảnh dạng **WebP**, rộng khoảng 1600px, đặt vào `assets/img/`, rồi sửa đường dẫn trong JSON.
- **SC Tech Pro:** ảnh đã hậu kỳ trong `assets/img/sc-tech-pro/`, clip giới thiệu/cấu tạo trong `assets/video/sc-tech-pro/`. Xem [SC_TECH_PRO_MEDIA.md](SC_TECH_PRO_MEDIA.md) để biết nguồn, đoạn cắt, prompt hậu kỳ và cách xuất lại.
- **SC Tech (bộ khung + động cơ + bánh, bộ chỉ khung):** ảnh chụp thật trong `assets/img/sc-tech/`, video quay thực tế trong `assets/video/sc-tech/`, xuất từ `source image and video/SC Tech/` bằng `python scripts/prepare-sc-tech-media.py` (thêm `--force` để xuất lại). Ảnh giữ nền bàn gỗ thật, không thay nền bằng AI: chỉ cắt khung 3:2, cân độ sáng và màu nền cho đều cả bộ, tăng nhẹ độ trong. Ảnh nào dùng, vùng cắt và đoạn video nào được ghép đều ghi ở đầu script. Video giữ nguyên bối cảnh quay (có chậu hoa, tượng đồ chơi, hộp dụng cụ phía sau) theo lựa chọn của shop; quay lại trên bàn trống thì chỉ cần sửa đoạn cắt trong script rồi xuất lại. Bộ đầy đủ SC Tech vẫn dùng ảnh minh họa AI cũ, chờ tư liệu.
- **Ảnh hero trang chủ:** `assets/img/xe-toan-canh-hero.webp` (và bản `-640`), hậu kỳ từ ảnh AI gốc `source image and video/Hero/xe-toan-canh-goc.jpg`: xoá watermark, phóng 2×, làm nét, nền tối dần về màu nền trang để vòng sáng xanh không bị che. Giữ đúng tỷ lệ 1024:697 vì vị trí hotspot trong CSS đo theo ảnh này. Xuất lại: `python scripts/prepare-hero-image.py`. Ảnh `xe-toan-canh.webp` dùng ở các trang khác giữ nguyên.
- **Ảnh/video gốc:** giữ trong `source image and video/`; thư mục này được bỏ qua bởi Git và GitHub Pages. Chỉ upload bản tối ưu trong `assets/`. Thư mục `scripts/`, `tmp/` và báo cáo media cũng không đưa lên hosting.
- **Video MP4:** tải và phát sau khi khách bấm, có điều khiển và phát nội tuyến trên điện thoại. Video dọc giữ đúng tỷ lệ. Khi đổi ảnh, bộ hoặc dòng xe, trình phát cũ được dừng và gỡ.
- **Video SC Tech Pro:** chỉ dùng cảnh quay nền gỗ, giữ nền gốc. Các đoạn phông xanh và bản ghép nền đã được gỡ khỏi website; bản cũ và video nguồn vẫn được lưu để tham khảo.
- **Ảnh bìa video:** chọn frame tại `POSTER_TIMES` trong script xuất. Chạy `python scripts/prepare-sc-tech-pro-media.py --posters-only --force` để cập nhật ảnh bìa riêng, giữ nguyên MP4.

## 4. Nút mua hàng hoạt động thế nào

- **Mua ngay:** mở `dat-hang.html` với đúng dòng xe, bộ và số lượng đang chọn. Nút này không thêm gì vào giỏ.
- **Thêm vào giỏ:** giỏ hàng được lưu trên trình duyệt của khách, nên vẫn còn khi khách chuyển trang hoặc tải lại trang. Mở giỏ, bấm *Đặt hàng* để sang cùng trang đặt hàng.
- **Mua trên Shopee:** mở link Shopee của bộ đang chọn. Với 2 bộ khung, khách chọn phân loại "Chỉ khung" hay "Khung + động cơ + bánh" ngay trên Shopee.
- **Tư vấn Zalo:** mở `https://zalo.me/<số Zalo>`.

### Đơn hàng đến Zalo của shop bằng cách nào?

Zalo **không cho** website tự gửi tin nhắn tới số Zalo cá nhân, và link `zalo.me` cũng không điền sẵn được nội dung. Vì vậy web làm như sau:

1. Khách điền tên, số điện thoại, địa chỉ rồi bấm **Gửi đơn qua Zalo**.
2. Web kiểm tra thông tin, tạo mã đơn (VD: `#SC260926-4821`) và **tự sao chép** nội dung đơn gồm: sản phẩm, bộ, số lượng, giá, tổng, thông tin người nhận.
3. Khách bấm **Mở Zalo gửi cho shop**, dán nội dung vào ô chat rồi gửi.

Nếu khách quên bấm gửi thì shop mất đơn. Để tránh việc này, hãy **bật lưu đơn vào Google Sheet**: cài `google-apps-script.gs` theo mục 5 bên dưới, rồi dán URL vào `site.order_endpoint`. Script này có thể gửi thêm email báo đơn mới cho bạn. Form "Gửi yêu cầu tư vấn" ở Trang chủ cũng hoạt động theo cách này.

Nếu muốn tin nhắn tự động vào Zalo, cần đăng ký **Zalo Official Account** (tài khoản doanh nghiệp) và có một server riêng để giữ token. Phần này làm sau được, không cần sửa giao diện.

## 5. Code mẫu: chỉ người mua tải được

Mỗi hộp có một thẻ in **mã tải code** riêng, VD `K7M3-Q9XP`. Ở trang Hướng dẫn, khách nhập mã rồi bấm *Tải .zip*. Quét mã QR trên thẻ thì mở `huong-dan.html?ma=K7M3-Q9XP`, trang tự điền sẵn mã. Script `google-apps-script.gs` tìm mã trong Google Sheet của shop, mã đúng thì mới gửi file từ một thư mục Google Drive riêng tư. File code không nằm trên website nên người không có mã không tải được.

- Mỗi mã tải được mọi file code mẫu, tối đa 20 lượt (`MAX_DOWNLOADS` trong script).
- Mã nào bị lộ thì tích ô **Khoá** của mã đó, các mã khác vẫn dùng bình thường.
- Mỗi mã gắn với một đơn hàng: biết khách nào nhận mã nào (xem *Dùng hằng ngày*).
- Không cách nào ngăn người đã tải gửi file cho người khác. Cách này chỉ để website không phát code công khai.

### Cài đặt (làm một lần)

1. **Chuẩn bị file code.** Nén mỗi chương trình thành 1 file .zip, đặt tên đúng như `guide.code[].zip` trong `products.json`:
   - SC Tech Pro: `sc-tech-pro-tranh-vat-can.zip`, `sc-tech-pro-dieu-khien-app.zip`
   - SC Tech: `sc-tech-dieu-khien-app.zip`

   Tên file không dấu, không khoảng trắng. Muốn đổi tên thì sửa cả tên file lẫn `products.json`.
2. **Tạo thư mục trên Google Drive**, VD `SmartCarTech - Code mau`, rồi tải 3 file .zip vào. Giữ quyền truy cập chung là **Bị hạn chế** (mặc định), đừng chọn "Bất kỳ ai có đường liên kết". Mở thư mục và copy phần ID ở cuối địa chỉ: `drive.google.com/drive/folders/<ID>`.
3. **Tạo Google Sheet mới**, VD `SmartCarTech - Don hang va ma code`, rồi vào menu **Tiện ích mở rộng → Apps Script**.
4. Xoá code mẫu trong trình soạn, dán toàn bộ nội dung `google-apps-script.gs`, rồi điền:
   - `CODE_FOLDER_ID`: ID thư mục ở bước 2, giữ trong dấu nháy: `'1AbC…'`.
   - `NOTIFY_EMAIL` (tùy chọn): email nhận thông báo khi có đơn mới.

   Bấm biểu tượng **Lưu**. Chỉ điền ở đây, đừng sửa file trong kho GitHub vì kho đang để công khai.
5. **Triển khai:** bấm **Triển khai → Tùy chọn triển khai mới**, bấm biểu tượng bánh răng, chọn **Ứng dụng web**:
   - Thực thi dưới dạng: **Tôi**
   - Người có quyền truy cập: **Bất kỳ ai**

   Bấm **Triển khai → Ủy quyền truy cập** và chọn tài khoản Google của shop. Google sẽ báo *"Google chưa xác minh ứng dụng này"*. Điều này bình thường với script tự viết: bấm **Nâng cao → Chuyển đến … (không an toàn) → Cho phép**.
6. Copy **URL ứng dụng web** (dạng `https://script.google.com/macros/s/…/exec`) và dán vào `products.json` → `site.order_endpoint`. Mở URL này trên trình duyệt, thấy dòng *"SmartCarTech: Apps Script đang chạy."* là được. Từ lúc này đơn hàng và yêu cầu tư vấn cũng được lưu vào Sheet.
7. **Tạo mã:** tải lại trang Google Sheet, chọn menu **SmartCarTech → Tạo mã tải code…**, nhập số mã cần tạo và ghi chú (VD lô hàng). Mã mới nằm ở trang tính **Mã tải code**.
8. **In thẻ:** các mã vừa tạo đã được chọn sẵn. Chọn menu **SmartCarTech → In thẻ cho các mã đang chọn…**. Lần đầu Google hỏi cấp quyền thì làm như bước 5. Cửa sổ xem trước xếp 10 thẻ cỡ danh thiếp (85 × 54 mm) trên 1 tờ A4. Mỗi thẻ có logo, địa chỉ `smartcartech.vn/huong-dan.html`, mã và mã QR. Bấm **In thẻ**, chọn khổ A4, tỷ lệ Mặc định. Nên in giấy cứng rồi cắt theo đường viền xám. Muốn gửi tiệm in thì chọn máy in *Lưu dưới dạng PDF*.
   - Mã đã khoá, đã có lượt tải hoặc đã gán cho đơn tự được bỏ qua. Bấm In xong, ngày in được ghi vào cột **Đã in**. Lần sau chọn trùng mã đã in, cửa sổ sẽ hỏi có in lại không. Mỗi hộp một mã, không dùng lại mã đã in.
   - Không hiện hộp thoại in: bấm *Mở trong tab mới* trong cửa sổ, rồi nhấn Ctrl+P ở tab đó.
   - Địa chỉ trên thẻ, logo và số Zalo nằm ở `SITE_URL`, `LOGO_URL`, `SHOP_ZALO` trong script.
9. **Thử:** vào trang Hướng dẫn, nhập một mã vừa tạo rồi bấm *Tải .zip*. Cột **Số lần tải** của mã đó tăng lên 1 là xong.

### Dùng hằng ngày

- **Đóng hàng:** bỏ 1 thẻ vào mỗi hộp, rồi gõ mã trên thẻ vào cột **Mã tải code** của đơn đó ở trang **Đơn hàng**.
  - Đơn nhiều hộp: các mã cách nhau bằng dấu phẩy.
  - Có máy quét mã vạch đọc được QR: quét thẻ thay vì gõ.
  - Script tự điền **Mã đơn** và **Khách hàng** (tên – SĐT) của mã đó ở trang **Mã tải code**. Đừng gõ tay vào 2 cột này.
  - Ô tô đỏ: mã gõ sai, mã đã khoá hoặc đã gán cho đơn khác. Rê chuột vào ô để xem lý do.
- **Đơn Shopee, đơn Zalo không đặt qua web:** thêm 1 dòng ở trang **Đơn hàng**, ít nhất có **Mã đơn** (VD mã đơn Shopee) và **Họ tên**, rồi gõ mã như trên.
- **Gửi mã qua Zalo thay vì bỏ thẻ:** chọn một mã chưa in, chưa gán (cột Đã in và Mã đơn trống), gửi cho khách rồi gõ mã vào đơn như trên.
- **Khách làm mất thẻ:** tìm đơn của khách ở trang **Đơn hàng**, gửi lại mã ở cột Mã tải code.
- **Tra ngược:** mã bị tải nhiều bất thường thì xem cột Mã đơn, Khách hàng của mã đó để biết của khách nào.
- **Mã bị lộ:** tích ô **Khoá**. **Khách hết lượt tải:** sửa Số lần tải của mã đó về 0.
- **Thay file code:** xoá file cũ trong thư mục Drive rồi tải file mới cùng tên lên.
- **Sửa script sau này:** sửa trong trình soạn Apps Script, rồi vào **Triển khai → Quản lý các lần triển khai**, bấm biểu tượng bút chì, chọn Phiên bản **Phiên bản mới** → **Triển khai**. Làm vậy thì URL giữ nguyên. Nếu chọn "Tùy chọn triển khai mới", URL sẽ đổi và phải dán lại vào `products.json`.
  - Menu trên Sheet (tạo mã, in thẻ) và phần gán mã cho đơn luôn chạy bản vừa **Lưu**, không cần triển khai lại. Tải lại trang Sheet để script thêm các cột mới. Chỉ phần web dùng (lưu đơn, tải code) mới cần triển khai phiên bản mới.
  - Dán đè toàn bộ bằng bản script mới thì nhớ điền lại `NOTIFY_EMAIL` và `CODE_FOLDER_ID`.

## 6. Việc cần làm trước khi đưa web lên

- [x] Bổ sung **ảnh và video SC Tech Pro** từ tư liệu gốc: 9 ảnh hậu kỳ nền bằng AI (gồm ảnh linh kiện bộ đầy đủ từ `All.jpg`), 2 clip quay thực tế không có phông xanh; ảnh riêng theo từng bộ, ghi rõ bộ đầy đủ giao linh kiện để khách tự lắp.
- [x] Ảnh/video thật cho 2 bộ khung **SC Tech** (khung + động cơ + bánh, chỉ khung).
- [ ] Thay ảnh/video **bộ đầy đủ SC Tech** khi có tư liệu: bộ này vẫn dùng ảnh minh họa AI cũ (rộng 1024px), ảnh vẽ cả cảm biến siêu âm và 4 pin dù SC Tech không có.
- [ ] Cài **Google Apps Script** theo mục 5: lưu đơn vào Google Sheet, tải 3 file code mẫu lên Drive, tạo mã và in thẻ bỏ vào hộp.
- [ ] Điền các chỗ trống `[…]`: mô tả, thông số, câu trả lời FAQ, tên app, v.v.
- [ ] Đọc lại **bản nháp `chinh-sach.html`** và sửa cho đúng với cách shop làm. Các điểm giả định được ghi trong comment ở đầu thẻ `<main>`.

## 7. Ghi chú kỹ thuật

- **Giao diện co giãn:** thiết kế cho 390px (mobile) và 1440px (desktop). Khoảng cách và cỡ chữ co giãn mượt giữa hai mốc này bằng `clamp()`. Bố cục đổi ở 768px và 1024px, riêng phần đầu trang chủ đổi ở 1200px.
- **Mọi màu, font, bo góc, khoảng cách** được khai báo ở phần `:root` đầu file `style.css`.
- **SEO:**
  - Mỗi trang có title và description riêng.
  - Trang Sản phẩm và Hướng dẫn tự đổi title theo dòng xe đang chọn.
  - Có dữ liệu cấu trúc Product và FAQ (JSON-LD).
  - Trang Đặt hàng đặt `noindex` để không hiện trên Google.
- **Ảnh:** định dạng WebP, `loading="lazy"` (trừ ảnh đầu trang) và có `alt` đầy đủ.
- **Trình duyệt hỗ trợ:** Chrome, Edge, Safari, Firefox bản từ 2023 trở lên.
