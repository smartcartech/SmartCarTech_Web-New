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
google-apps-script.gs (Tùy chọn) Lưu đơn vào Google Sheet — không tải lên hosting
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
| Code .zip, GitHub | `guide.code[].zip`, `guide.github` |
| Nội dung chính sách bảo hành, vận chuyển & đổi trả | Sửa trực tiếp trong `chinh-sach.html` (không nằm trong `products.json`) |
| App: tên, kết nối, link cửa hàng, mã QR | `guide.app` |
| Ảnh chụp màn hình app (khung điện thoại nằm ngang) | `guide.app.screens` — mỗi ảnh có `label` (tên nút chuyển), `src`, `alt`. Mặc định hiện ảnh cuối cùng |
| Các bước kết nối app (HC-06, mật khẩu 1234…) | Sửa trực tiếp trong `huong-dan.html`, phần Bước 3 |
| Chức năng ("Xe làm được gì?") | `lines[].features` |
| Bảng thông số & so sánh | `specs` — mỗi dòng có `label`, `pro`, `std`. Hàng nào `pro` khác `std` sẽ tự được đánh dấu vạch xanh |
| Câu hỏi thường gặp | `faq` |

**Lưu ý khi sửa:**

- **Link còn trống `""`:** nút vẫn hiện. Khi khách bấm, web báo "đang cập nhật". Riêng nút App Store (`guide.app.app_store`) sẽ ẩn hẳn khi để trống, vì app hiện chỉ có trên Google Play.
- **Chữ trong `[NGOẶC VUÔNG]`** là chỗ trống còn chờ nội dung thật.
- **Kiểm tra lỗi cú pháp:** sau khi sửa, dán nội dung file vào jsonlint.com. Một dấu phẩy thừa hoặc thiếu cũng làm web không tải được dữ liệu.
- **Thêm ảnh mới:** lưu ảnh dạng **WebP**, rộng khoảng 1600px, đặt vào `assets/img/`, rồi sửa đường dẫn trong JSON.
- **SC Tech Pro:** ảnh đã hậu kỳ trong `assets/img/sc-tech-pro/`, clip giới thiệu/cấu tạo trong `assets/video/sc-tech-pro/`. Xem [SC_TECH_PRO_MEDIA.md](SC_TECH_PRO_MEDIA.md) để biết nguồn, đoạn cắt, prompt hậu kỳ và cách xuất lại.
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

Nếu khách quên bấm gửi thì shop mất đơn. Để tránh việc này, hãy **bật lưu đơn vào Google Sheet**: làm theo hướng dẫn ở đầu file `google-apps-script.gs`, rồi dán URL vào `site.order_endpoint`. Script này có thể gửi thêm email báo đơn mới cho bạn. Form "Gửi yêu cầu tư vấn" ở Trang chủ cũng hoạt động theo cách này.

Nếu muốn tin nhắn tự động vào Zalo, cần đăng ký **Zalo Official Account** (tài khoản doanh nghiệp) và có một server riêng để giữ token. Phần này làm sau được, không cần sửa giao diện.

## 5. Việc cần làm trước khi đưa web lên

- [x] Bổ sung **ảnh và video SC Tech Pro** từ tư liệu gốc: 9 ảnh hậu kỳ nền bằng AI (gồm ảnh linh kiện bộ đầy đủ từ `All.jpg`), 2 clip quay thực tế không có phông xanh; ảnh riêng theo từng bộ, ghi rõ bộ đầy đủ giao linh kiện để khách tự lắp.
- [ ] Thay **ảnh SC Tech** khi có tư liệu: dòng này vẫn dùng ảnh minh họa AI cũ từ file thiết kế, rộng 1024px.
- [ ] Điền các chỗ trống `[…]`: mô tả, thông số, câu trả lời FAQ, tên app, v.v.
- [ ] Đọc lại **bản nháp `chinh-sach.html`** và sửa cho đúng với cách shop làm. Các điểm giả định được ghi trong comment ở đầu thẻ `<main>`.

## 6. Ghi chú kỹ thuật

- **Giao diện co giãn:** thiết kế cho 390px (mobile) và 1440px (desktop). Khoảng cách và cỡ chữ co giãn mượt giữa hai mốc này bằng `clamp()`. Bố cục đổi ở 768px và 1024px, riêng phần đầu trang chủ đổi ở 1200px.
- **Mọi màu, font, bo góc, khoảng cách** được khai báo ở phần `:root` đầu file `style.css`.
- **SEO:**
  - Mỗi trang có title và description riêng.
  - Trang Sản phẩm và Hướng dẫn tự đổi title theo dòng xe đang chọn.
  - Có dữ liệu cấu trúc Product và FAQ (JSON-LD).
  - Trang Đặt hàng đặt `noindex` để không hiện trên Google.
- **Ảnh:** định dạng WebP, `loading="lazy"` (trừ ảnh đầu trang) và có `alt` đầy đủ.
- **Trình duyệt hỗ trợ:** Chrome, Edge, Safari, Firefox bản từ 2023 trở lên.
