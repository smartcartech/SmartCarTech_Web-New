# Website SmartCarTech

Website bán xe robot SC Tech Pro / SC Tech của SmartCarTech. Được viết bằng HTML, CSS và JavaScript thuần: không có bước build, không dùng thư viện ngoài, chỉ tải font từ Google Fonts.

> **Tên gọi:** **SmartCarTech** là tên thương hiệu (logo, tiêu đề trang, footer, `site.brand`). **SC Tech Pro** và **SC Tech** chỉ là tên 2 dòng sản phẩm — đừng dùng "SC Tech" để chỉ shop.

```
index.html            Trang chủ
san-pham.html         Sản phẩm (?dong=pro|std&bo=day-du|khung-dong-co-banh|chi-khung)
huong-dan.html        Hướng dẫn (?dong=…&bo=…)
dat-hang.html         Đặt hàng (?mua=pro:day-du:2  hoặc  ?tu=gio-hang)
in-3d.html            In 3D theo yêu cầu: bảng tên để bàn, giá đỡ điện thoại in tên (đặt ngay), in theo file
chinh-sach.html       Chính sách bảo hành (#bao-hanh), vận chuyển & đổi trả (#van-chuyen)
chinh-sach-bao-mat.html  Chính sách bảo mật thông tin khách hàng
quan-tri.html         Trang quản trị (chỉ admin): xem, sửa dữ liệu Google Sheet ngay trên web — mục 6
products.json         ★ DỮ LIỆU — file duy nhất bạn cần sửa
google-apps-script.gs Lưu đơn vào Google Sheet + kiểm tra mã tải code mẫu + trang quản trị — không tải lên hosting
source plan/          File kế hoạch Excel (có thông tin khách hàng, giá vốn) — không đưa lên GitHub, không tải lên hosting
robots.txt, sitemap.xml  Cho Google biết các trang cần hiển thị
_config.yml           Danh sách file GitHub Pages không đưa lên web
assets/css/style.css  Toàn bộ giao diện (màu, font, khoảng cách ở đầu file)
assets/js/core.js     Phần dùng chung: tải dữ liệu, giỏ hàng, menu, gửi đơn lên Google Sheet
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
index.html  san-pham.html  huong-dan.html  dat-hang.html  in-3d.html  chinh-sach.html  chinh-sach-bao-mat.html  quan-tri.html
products.json  robots.txt  sitemap.xml
assets/        (cả thư mục)
```

**Không tải lên:**

- `README.md`: ghi chú nội bộ (việc cần làm, nguồn ảnh…).
- `google-apps-script.gs`: chỉ dùng để dán vào Google Apps Script. Nếu điền email báo đơn vào file này rồi tải lên thì email bị lộ.
- `source plan/`: file kế hoạch Excel có tên, địa chỉ khách và giá vốn. Đã khai báo trong `.gitignore` (không đưa lên GitHub) và `_config.yml` (không lên web).
- `_config.yml`, `.git/`, `.gitignore`, `.gitattributes`: file cấu hình.

Cách làm với từng loại hosting:

- **GitHub Pages** (web cũ đang dùng cách này): đẩy code lên GitHub như bình thường. GitHub Pages tự bỏ qua các file đã khai báo trong `_config.yml`. Nếu thêm file nội bộ mới, ghi tên vào mục `exclude` trong file đó. Dùng tên miền riêng thì thêm file `CNAME` chứa một dòng `smartcartech.vn`.
  - Lưu ý: nếu kho GitHub để **công khai (public)**, ai cũng xem được mọi file trong kho trên github.com, kể cả README. `_config.yml` chỉ giữ chúng khỏi web smartcartech.vn.
- **Hosting cPanel:** chỉ upload các file trong danh sách "Tải lên" vào `public_html`.
- **Netlify:** chép các file trong danh sách "Tải lên" sang một thư mục riêng, rồi kéo thả thư mục đó vào app.netlify.com/drop. Đừng kéo thả cả thư mục dự án.

Tên miền **smartcartech.vn** đã được ghi sẵn trong: `og:image` (7 file HTML), `og:url` + `canonical` (index.html, in-3d.html, chinh-sach.html, chinh-sach-bao-mat.html), `SITE_URL` (assets/js/core.js và google-apps-script.gs: script đọc giá ở `SITE_URL/products.json`), `robots.txt` và `sitemap.xml`. Nếu đổi tên miền, sửa hết các chỗ này.

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
| Nội dung chính sách bảo mật thông tin | Sửa trực tiếp trong `chinh-sach-bao-mat.html`. Sửa nội dung thì đổi cả ngày *Cập nhật* ở đầu trang. Thêm công cụ theo dõi (Google Analytics, Facebook Pixel…) thì phải sửa mục "Trên trình duyệt của bạn" |
| App: tên, kết nối, link cửa hàng, mã QR | `guide.app` |
| Ảnh chụp màn hình app (khung điện thoại nằm ngang) | `guide.app.screens` — mỗi ảnh có `label` (tên nút chuyển), `src`, `alt`. Mặc định hiện ảnh cuối cùng |
| Các bước kết nối app (HC-06, mật khẩu 1234…) | Sửa trực tiếp trong `huong-dan.html`, phần Bước 3 |
| Chức năng ("Xe làm được gì?") | `lines[].features` |
| Bảng thông số & so sánh | `specs` — mỗi dòng có `label`, `pro`, `std`. Hàng nào `pro` khác `std` sẽ tự được đánh dấu vạch xanh |
| Câu hỏi thường gặp | `faq` |
| **Trang In 3D:** bảng màu nhựa | `print3d.colors` — `id`, `name`, `hex` (màu gần giống cuộn nhựa). Bảng tên và giá đỡ dùng chung bảng màu này. Bỏ màu hết nhựa: xoá dòng đó, nhớ đổi các chỗ đang dùng `id` của nó |
| Kiểu bảng tên, số ký tự, giá | `print3d.nameplate.layouts` — `lines` (1 hoặc 2 dòng chữ), `max_chars` (số ký tự tối đa của **cả bảng**: mọi dòng, tính cả dấu cách và icon, mỗi icon là 1 ký tự; hiện là 19 và 24), `price` (VD `119000`; để `0` thì web hiện "Liên hệ", shop báo giá khi gọi xác nhận). Bảng dài hay ngắn theo số chữ, không có cỡ để chọn |
| Kiểu chữ bảng tên | `print3d.nameplate.fonts` — `name` (tên hiện cho khách), `family` (tên font trên Google Fonts, phải có bộ chữ *Vietnamese*), `weight` (độ đậm). Tải đúng font đó từ fonts.google.com và cài vào máy tính để Bambu Studio dùng: bản in mới giống hình xem trước |
| Icon bảng tên | `print3d.nameplate.icons` — `id`, `name`, `color` (màu chọn sẵn khi khách chọn icon). `fixed`: icon luôn in đúng các màu này (lá cờ: đỏ, vàng). Chỉ dùng được các icon đã có hình vẽ trong `assets/js/print3d.js` (`khong`, `tiktok`, `facebook`, `youtube`, `dien-thoai`, `trai-tim`, `no`, `co`); icon mới cần vẽ thêm trong file đó |
| Tối đa mấy màu, lựa chọn có sẵn | `print3d.nameplate.max_colors` (4 = số khe AMS lite: tính màu thân, chữ, icon; chi tiết icon in cùng màu chữ). `print3d.nameplate.default` — kiểu bảng, kiểu chữ, icon trước/sau tên, màu thân, màu chữ khi khách mới vào trang |
| Giá đỡ điện thoại | `print3d.stand` — `max_chars` (số ký tự tối đa của tên khắc, tính cả dấu cách; hiện là 11), `price`, `color` (màu chọn sẵn). Tên luôn khắc in hoa |
| Ảnh, video thực tế | `print3d.nameplate.media`, `print3d.stand.media` — ảnh: `src`, `src_small`, `thumb`, `width`, `height`, `alt`, `focus` (điểm giữa khi cắt ô vuông nhỏ, VD `"50% 68%"`: 68% là đặt sản phẩm thấp xuống); video: `video`, `poster`, `duration`, `alt`. Ảnh đầu tiên của mỗi sản phẩm cũng là ảnh thẻ ở đầu trang |
| Thẻ "In theo file", khung "Shop in được", vật liệu | `print3d.custom` — `name`, `summary`, `photo` (ảnh thẻ), `specs` (mỗi dòng `label`, `value`), `materials` |
| Các bước đặt in, câu hỏi thường gặp trang In 3D | `print3d.steps` (`icon` là tên hình trong `icons.svg`, VD `chat`, `image`, `wrench`, `truck`), `print3d.faq` |

**Lưu ý khi sửa:**

- **Link còn trống `""`:** nút vẫn hiện. Khi khách bấm, web báo "đang cập nhật". Riêng nút App Store (`guide.app.app_store`) sẽ ẩn hẳn khi để trống, vì app hiện chỉ có trên Google Play. Nút GitHub (`guide.github`) cũng ẩn khi để trống, vì code mẫu chỉ dành cho người mua.
- **Chữ trong `[NGOẶC VUÔNG]`** là chỗ trống còn chờ nội dung thật.
- **Kiểm tra lỗi cú pháp:** sau khi sửa, dán nội dung file vào jsonlint.com. Một dấu phẩy thừa hoặc thiếu cũng làm web không tải được dữ liệu.
- **Thêm ảnh mới:** lưu ảnh dạng **WebP**, rộng khoảng 1600px, đặt vào `assets/img/`, rồi sửa đường dẫn trong JSON.
- **SC Tech Pro:** ảnh đã hậu kỳ trong `assets/img/sc-tech-pro/`, clip giới thiệu/cấu tạo trong `assets/video/sc-tech-pro/`. Xem [SC_TECH_PRO_MEDIA.md](SC_TECH_PRO_MEDIA.md) để biết nguồn, đoạn cắt, prompt hậu kỳ và cách xuất lại.
- **SC Tech (bộ khung + động cơ + bánh, bộ chỉ khung):** ảnh trong `assets/img/sc-tech/`, video quay thực tế trong `assets/video/sc-tech/`, xuất từ `source image and video/SC Tech/` bằng `python scripts/prepare-sc-tech-media.py` (thêm `--force` để xuất lại). Ảnh do shop tự hậu kỳ nền studio tối giống bộ SC Tech Pro; script chỉ xuất WebP 1536/640/324px, không cắt, không chỉnh màu. Master PNG nằm trong `edited/`: thư mục nguồn không có file gốc nền tối nên master được chép nguyên từ ảnh 1536px đang dùng trên web. Có file gốc đẹp hơn thì chép đè vào `edited/` đúng tên rồi chạy `--images-only --force`. Bản nền bàn gỗ cũ lưu trong `edited/previous-wood-desk/`. Ảnh nào dùng và đoạn video nào được ghép đều ghi ở đầu script. Video giữ nguyên bối cảnh quay (có chậu hoa, tượng đồ chơi, hộp dụng cụ phía sau) theo lựa chọn của shop; quay lại trên bàn trống thì chỉ cần sửa đoạn cắt trong script rồi xuất lại.
- **SC Tech bộ đầy đủ:** 5 ảnh shop đã tự hậu kỳ (nền studio tối) trong `source image and video/SC Tech/SC Tech day du/`. Script chỉ đặt tên mới `xe-day-du*.webp` và xuất WebP 1536/640/324px, không cắt, không chỉnh màu; file gốc giữ nguyên tên. Video `xe-day-du.mp4` (0:19) chỉ cắt ghép từ `sc tech day du.mp4`: nhấc xe xem nóc, mặt trước, mặt bên → phía sau, hộp pin → xe đặt trên bàn. Giữ màu quay gốc, bỏ tiếng. Bộ media này dùng cho gallery dòng SC Tech (bộ đầy đủ), thẻ trang chủ, giỏ hàng, phần tính năng và ảnh bìa video hướng dẫn. Xuất lại riêng clip: `python scripts/prepare-sc-tech-media.py --videos-only --force --video xe-day-du`.
- **In 3D (bảng tên, giá đỡ điện thoại):** ảnh trong `assets/img/in-3d/`, video trong `assets/video/in-3d/`, xuất từ `source image and video/In 3D/` bằng `python scripts/prepare-in-3d-media.py` (thêm `--force` để xuất lại). Ảnh chụp điện thoại dùng nguyên khung, không chỉnh màu; script xoay đúng chiều và xuất WebP 1080/640/324px, không kèm thông tin máy ảnh, vị trí chụp. Trang web tự cắt ô nhỏ theo `focus`, bấm vào xem ảnh đầy đủ. Video bảng tên chỉ cắt đầu đuôi; video giá đỡ cắt lại từ bản CapCut của shop: bỏ hiệu ứng lấp lánh, chớp sáng, làm mờ và đoạn màn hình máy tính, ghép các cảnh thật theo thứ tự máy in → vừa in xong → tên khắc → mở giá → dựng điện thoại → 3 màu. Bỏ tiếng, giữ màu quay. Ảnh nào dùng, ảnh nào bỏ và đoạn cắt ghi ở đầu script.
- **Ảnh, video đăng Shopee / TikTok Shop (bảng tên, giá đỡ, cây thông Noel clicker):** `python scripts/prepare-in-3d-shop-media.py` (thêm `--force` để xuất lại) ghi vào `source image and video/In 3D/Shopee TikTok/<sản phẩm>/`, không lên web. Ảnh vuông 1:1, đánh số theo thứ tự tải lên (01 là ảnh bìa), cắt theo bề ngang ảnh gốc, không phóng to, không chỉnh màu, lưu JPEG chất lượng cao nhất dưới 2 MB, bỏ thông tin máy ảnh. Ảnh ngang quá rộng (6 cây thông xếp hàng) để nguyên khung trên nền mờ của chính ảnh đó. Ảnh phân loại màu giá đỡ được tô lại từ một ảnh thật theo bảng màu web. Cây thông hồng chụp trên đế đen nhưng bán đế đồng, nên đế được tô lại theo đế đồng thật của cây khác. Video giữ nguyên, chỉ nén lại cho dưới 30 MB. Ảnh nào dùng và vị trí cắt ghi ở đầu script.
- **Ảnh hero trang chủ:** `assets/img/xe-toan-canh-hero.webp` (và bản `-640`), hậu kỳ từ ảnh AI gốc `source image and video/Hero/xe-toan-canh-goc.jpg`: xoá watermark, phóng 2×, làm nét, nền tối dần về màu nền trang để vòng sáng xanh không bị che. Giữ đúng tỷ lệ 1024:697 vì vị trí hotspot trong CSS đo theo ảnh này. Xuất lại: `python scripts/prepare-hero-image.py`.
- **Ảnh/video gốc:** giữ trong `source image and video/`; thư mục này được bỏ qua bởi Git và GitHub Pages. Chỉ upload bản tối ưu trong `assets/`. Thư mục `scripts/`, `tmp/` và báo cáo media cũng không đưa lên hosting.
- **Video MP4:** tải và phát sau khi khách bấm, có điều khiển và phát nội tuyến trên điện thoại. Video dọc giữ đúng tỷ lệ. Khi đổi ảnh, bộ hoặc dòng xe, trình phát cũ được dừng và gỡ.
- **Video SC Tech Pro:** chỉ dùng cảnh quay nền gỗ, giữ nền gốc. Các đoạn phông xanh và bản ghép nền đã được gỡ khỏi website; bản cũ và video nguồn vẫn được lưu để tham khảo.
- **Ảnh bìa video:** chọn frame tại `POSTER_TIMES` trong script xuất. Chạy `python scripts/prepare-sc-tech-pro-media.py --posters-only --force` để cập nhật ảnh bìa riêng, giữ nguyên MP4.

## 4. Nút mua hàng hoạt động thế nào

- **Mua ngay:** mở `dat-hang.html` với đúng dòng xe, bộ và số lượng đang chọn. Nút này không thêm gì vào giỏ.
- **Thêm vào giỏ:** giỏ hàng được lưu trên trình duyệt của khách, nên vẫn còn khi khách chuyển trang hoặc tải lại trang. Mở giỏ, bấm *Đặt hàng* để sang cùng trang đặt hàng.
- **Mua trên Shopee:** mở link Shopee của bộ đang chọn. Với 2 bộ khung, khách chọn phân loại "Chỉ khung" hay "Khung + động cơ + bánh" ngay trên Shopee.
- **Tư vấn Zalo:** mở `https://zalo.me/<số Zalo>`.

### Đơn hàng đến shop bằng cách nào?

Đơn đặt trên web được lưu thẳng vào **Google Sheet** của shop (cài theo mục 5). Khách không phải sao chép nội dung hay nhắn Zalo:

1. Khách điền tên, số điện thoại, địa chỉ rồi bấm **Đặt hàng**.
2. Web tạo mã đơn (VD: `#SC260926-4821`) và gửi đơn lên Sheet. Mỗi đơn là 1 dòng ở trang **Đơn hàng**, gồm sản phẩm, bộ, số lượng, tổng tiền và thông tin người nhận.
3. Sheet báo đã lưu xong thì web mới hiện *"Đã gửi đơn #…"*. Sau đó shop gọi hoặc nhắn Zalo cho khách để xác nhận đơn.

Form **Gửi yêu cầu tư vấn** ở Trang chủ cũng làm như vậy, lưu vào trang **Tư vấn**.

Trang **In 3D** (`in-3d.html`) có 3 form, đều lưu vào trang tính **In 3D** (script tự tạo trang tính này). Mã đơn dạng `#IN261011-4821`:

- **Đặt bảng tên:** khách chọn 1 tầng (tối đa 19 ký tự) hoặc 2 tầng (tối đa 24 ký tự cả hai dòng), gõ chữ, chọn kiểu chữ, icon trước và sau tên (mỗi icon tính 1 ký tự), màu thân, chữ, icon (tối đa 4 màu), rồi điền tên, số điện thoại, địa chỉ. Cột **Nội dung** ghi đủ chữ in, kiểu bảng, font, icon, màu để shop làm file in.
- **Đặt giá đỡ điện thoại:** tên cần khắc (in hoa, tối đa 11 ký tự) và màu.
- Script kiểm tra lại từng lựa chọn và tính lại giá theo `print3d` trong `products.json`; chọn quá 4 màu hoặc quá số ký tự thì đơn bị bỏ. Sản phẩm chưa có giá thì cột **Kiểm tra** nhắc báo giá khi gọi xác nhận.
- **In theo file:** khách mô tả món cần in, dán link file (nếu có). File, ảnh trên máy khách gửi qua Zalo kèm mã yêu cầu.
- Cột **Trạng thái** có ô chọn: Mới → Đã liên hệ → Đã chốt → Đang in → Đã giao (hoặc Huỷ). Shop gọi hoặc nhắn Zalo cho khách để chốt giá, cách thanh toán và giao hàng.
- Phần In 3D cần bản `google-apps-script.gs` mới: dán vào Apps Script, chạy **Kiểm tra cài đặt…**, rồi **triển khai phiên bản mới** (mục 5, *Sửa script sau này*) **trước khi** đưa web lên. Web lên trước thì form In 3D báo "chưa gửi được".

- **Gửi không được** (mất mạng, script lỗi, gửi quá nhiều lần trong thời gian ngắn…): web báo lý do ngay dưới nút để khách bấm gửi lại. Thông tin khách điền sai (VD số điện thoại thiếu số) thì web báo đỏ ngay dưới ô đó và không gửi đi. Khách cũng có thể bấm **Gửi qua Zalo**: web tự sao chép nội dung, khách dán vào Zalo rồi gửi cho shop. Lần gửi lại vẫn dùng mã đơn cũ, nên nếu Sheet có 2 dòng cùng mã đơn thì đó là đơn bị gửi trùng.
- **Bắt buộc có `site.order_endpoint`** trong `products.json`. Nếu để trống, web không lưu được đơn nào và khách chỉ gửi được qua Zalo.
- **Biết khi có đơn mới:** điền `NOTIFY_EMAIL` trong script (mục 5, bước 4) để nhận email mỗi khi có đơn hàng hoặc yêu cầu tư vấn. Nếu không điền, shop phải tự mở Sheet kiểm tra thường xuyên.
- **Script kiểm tra lại từng đơn:** URL script nằm công khai trong `products.json`, ai cũng gửi thẳng tới script được, nên script không tin số liệu gửi lên.
  - Tên sản phẩm và tổng tiền được tính lại theo `products.json` trên website.
  - Tổng web gửi khác giá đúng (khách mở trang từ trước khi shop đổi giá, hoặc có người cố sửa) thì cột **Kiểm tra** ghi lý do. Gọi xác nhận thì báo lại giá đúng cho khách.
  - Không đọc được `products.json` thì đơn vẫn được lưu, cột **Kiểm tra** nhắc đối chiếu lại giá.
  - Đơn thiếu tên, sai số điện thoại, địa chỉ quá ngắn hoặc có bộ không tồn tại bị bỏ, không ghi vào Sheet.
- **Chống spam:** mỗi số điện thoại gửi tối đa 5 lần và cả web tối đa 30 lần trong 10 phút (`MAX_SENDS_PER_PHONE`, `MAX_SENDS_PER_10_MIN` trong script). Quá mức thì khách thấy lời mời gửi lại hoặc gửi qua Zalo. Email báo đơn tối đa 10 email mỗi giờ (`MAX_EMAILS_PER_HOUR`): quá mức thì shop nhận 1 email nhắc mở Sheet, đơn vẫn được lưu đủ.

Muốn nhận thông báo đơn mới qua Zalo thay vì email thì cần đăng ký **Zalo Official Account** (tài khoản doanh nghiệp) và có một server riêng để giữ token. Phần này làm sau được, không cần sửa giao diện.

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
   - `NOTIFY_EMAIL` (nên điền): email nhận thông báo mỗi khi có đơn hàng hoặc yêu cầu tư vấn mới. Đơn đặt trên web chỉ nằm trong Sheet, email này báo cho shop biết có đơn.

   Bấm biểu tượng **Lưu**. Chỉ điền ở đây, đừng sửa file trong kho GitHub vì kho đang để công khai.
5. **Triển khai:** bấm **Triển khai → Tùy chọn triển khai mới**, bấm biểu tượng bánh răng, chọn **Ứng dụng web**:
   - Thực thi dưới dạng: **Tôi**
   - Người có quyền truy cập: **Bất kỳ ai**

   Bấm **Triển khai → Ủy quyền truy cập** và chọn tài khoản Google của shop. Google sẽ báo *"Google chưa xác minh ứng dụng này"*. Điều này bình thường với script tự viết: bấm **Nâng cao → Chuyển đến … (không an toàn) → Cho phép**.
6. Copy **URL ứng dụng web** (dạng `https://script.google.com/macros/s/…/exec`) và dán vào `products.json` → `site.order_endpoint`. Mở URL này trên trình duyệt, thấy dòng *"SmartCarTech: Apps Script đang chạy."* là được. Từ lúc này đơn hàng và yêu cầu tư vấn cũng được lưu vào Sheet.
7. **Kiểm tra cài đặt:** tải lại trang Google Sheet, chọn menu **SmartCarTech → Kiểm tra cài đặt…**. Còn thiếu quyền thì Google hiện hộp cấp quyền: làm như bước 5, đến màn hình chọn quyền thì tích **Chọn tất cả**, rồi chạy lại menu này.
   - Google cho tick từng quyền. Bỏ sót *"Kết nối với dịch vụ bên ngoài"* thì script không đọc được `products.json` để đối chiếu giá.
   - Vẫn báo ✗ thiếu quyền mà Google không hỏi lại: vào myaccount.google.com/connections, chọn dự án Apps Script của shop, xoá kết nối, rồi chạy lại menu này và tích **Chọn tất cả**.

   Cửa sổ kết quả cho biết:
   - script đọc được bảng giá chưa;
   - email báo đơn (và báo đăng nhập lạ vào trang quản trị) gửi tới đâu, hôm nay còn gửi được bao nhiêu email;
   - thư mục code và các file trong đó có đang ở chế độ **Bị hạn chế** không;
   - các trang **Mã tải code**, **Tư vấn**, **Nhật ký quản trị** có đủ cột script cần không. Dòng ✗ cho biết thiếu cột nào và dòng 1 của trang đó đang ghi gì;
   - trang quản trị có những tài khoản nào, tài khoản nào chưa bật mã 2 bước, và trang có đang tắt không (mục 6).

   Dòng nào có dấu ✗ thì sửa theo lời nhắc rồi chạy lại.
8. **Tạo mã:** chọn menu **SmartCarTech → Tạo mã tải code…**, nhập số mã cần tạo và ghi chú (VD lô hàng). Mã mới nằm ở trang tính **Mã tải code**.
9. **In thẻ:** các mã vừa tạo đã được chọn sẵn. Chọn menu **SmartCarTech → In thẻ cho các mã đang chọn…**. Lần đầu Google hỏi cấp quyền thì làm như bước 5. Cửa sổ xem trước xếp 10 thẻ cỡ danh thiếp (85 × 54 mm) trên 1 tờ A4. Mỗi thẻ có logo, địa chỉ `smartcartech.vn/huong-dan.html`, mã và mã QR. Bấm **In thẻ**, chọn khổ A4, tỷ lệ Mặc định. Nên in giấy cứng rồi cắt theo đường viền xám. Muốn gửi tiệm in thì chọn máy in *Lưu dưới dạng PDF*.
   - Mã đã khoá, đã có lượt tải hoặc đã gán cho đơn tự được bỏ qua. Bấm In xong, ngày in được ghi vào cột **Đã in**. Lần sau chọn trùng mã đã in, cửa sổ sẽ hỏi có in lại không. Mỗi hộp một mã, không dùng lại mã đã in.
   - Không hiện hộp thoại in: bấm *Mở trong tab mới* trong cửa sổ, rồi nhấn Ctrl+P ở tab đó.
   - Địa chỉ trên thẻ, logo và số Zalo nằm ở `SITE_URL`, `LOGO_URL`, `SHOP_ZALO` trong script.
10. **Thử:** vào trang Hướng dẫn, nhập một mã vừa tạo rồi bấm *Tải .zip*. Cột **Số lần tải** của mã đó tăng lên 1 là xong.

### Dùng hằng ngày

- **Đóng hàng:** bỏ 1 thẻ vào mỗi hộp, rồi gõ mã trên thẻ vào cột **Mã tải code** của đơn đó ở trang **Đơn hàng**.
  - Đơn nhiều hộp: các mã cách nhau bằng dấu phẩy.
  - Có máy quét mã vạch đọc được QR: quét thẻ thay vì gõ.
  - Script tự điền **Mã đơn** và **Khách hàng** (tên – SĐT) của mã đó ở trang **Mã tải code**. Đừng gõ tay vào 2 cột này.
  - Ô tô đỏ: mã gõ sai, mã đã khoá hoặc đã gán cho đơn khác. Rê chuột vào ô để xem lý do.
- **Đơn Shopee, đơn Zalo không đặt qua web:** thêm 1 dòng ở trang **Đơn hàng**, ít nhất có **Mã đơn** (VD mã đơn Shopee) và **Họ tên**, rồi gõ mã như trên. Cột **Nền tảng** ghi nơi khách mua; đơn web script tự ghi `Website`.
- **Gửi mã qua Zalo thay vì bỏ thẻ:** chọn một mã chưa in, chưa gán (cột Đã in và Mã đơn trống), gửi cho khách rồi gõ mã vào đơn như trên.
- **Khách làm mất thẻ:** tìm đơn của khách ở trang **Đơn hàng**, gửi lại mã ở cột Mã tải code.
- **Tra ngược:** mã bị tải nhiều bất thường thì xem cột Mã đơn, Khách hàng của mã đó để biết của khách nào.
- **Mã bị lộ:** tích ô **Khoá**. **Khách hết lượt tải:** sửa Số lần tải của mã đó về 0.
- **Thay file code:** xoá file cũ trong thư mục Drive rồi tải file mới cùng tên lên.
- **Mới nhất ở trên cùng:** ở các trang Đơn hàng, Tư vấn, In 3D, Mã tải code, Nhật ký quản trị, dòng mới (đơn web, yêu cầu tư vấn, đơn in 3D, mã vừa tạo, nhật ký, dòng thêm trên trang quản trị) được chèn ngay dưới dòng tiêu đề. Trang **Task Tracking** của shop cũng vậy khi thêm dòng trên trang quản trị (tên trang ở `ADMIN_NEWEST_FIRST` trong script: đổi tên trang thì sửa ở đó). Các trang kế hoạch khác vẫn thêm dòng ở cuối. Dòng chèn lấy định dạng số, ô tích, ô thả xuống của dòng ngay dưới, không lấy màu nền.
  - Dữ liệu đã có thì tự sắp xếp một lần: bấm ô A1, nhấn Ctrl+A để chọn cả bảng (kể cả dòng tiêu đề), **Dữ liệu → Sắp xếp dải ô → Tùy chọn sắp xếp dải ô nâng cao**, tích *Dữ liệu có hàng tiêu đề*, chọn cột *Thời gian*, **Z → A**. Xong thì xem lại vài ô Lợi nhuận; sai thì lấy lại ở Tệp → Lịch sử phiên bản. Trang Mã tải code không có cột ngày: thêm tạm một cột đánh số 1, 2, 3… theo thứ tự hiện tại, sắp xếp cột đó Z → A rồi xoá cột tạm.
  - Số dòng ghi trong Nhật ký quản trị (VD "Dòng 5") là vị trí lúc sửa: sau đó có dòng mới chèn lên trên thì dòng đó đã dời xuống.
- **Sắp xếp lại cột:** ở các trang Đơn hàng, Tư vấn, In 3D, Mã tải code và Nhật ký quản trị, kéo tiêu đề cột để đổi chỗ, hoặc chèn thêm cột của shop, đều được: script tìm cột theo tên ở dòng 1. Dòng 1 phải luôn là tên cột, và đừng đổi tên các cột script dùng:
  - **Mã tải code** (tên cũ `Mã` cũng được), **Khoá**, **Số lần tải** ở trang Mã tải code: đổi tên thì script dừng để không mở nhầm mã đã khoá. Khách không tải được code, web báo thiếu cột nào. Tạo mã, in thẻ, gán mã cũng dừng và báo như vậy. Đổi lại đúng tên là chạy lại ngay (gõ `Khóa` hay `KHOÁ` cũng được).
  - Các cột khác: script thêm lại cột mang tên cũ ở cuối bảng và ghi dữ liệu mới vào đó. Dữ liệu cũ vẫn nằm ở cột vừa đổi tên.
- **Sửa script sau này:** sửa trong trình soạn Apps Script, rồi vào **Triển khai → Quản lý các lần triển khai**, bấm biểu tượng bút chì, chọn Phiên bản **Phiên bản mới** → **Triển khai**. Làm vậy thì URL giữ nguyên. Nếu chọn "Tùy chọn triển khai mới", URL sẽ đổi và phải dán lại vào `products.json`.
  - Menu trên Sheet (tạo mã, in thẻ) và phần gán mã cho đơn luôn chạy bản vừa **Lưu**, không cần triển khai lại. Tải lại trang Sheet để script thêm các cột mới. Chỉ phần web dùng (lưu đơn, tải code) mới cần triển khai phiên bản mới.
  - Dán đè toàn bộ bằng bản script mới thì nhớ điền lại `NOTIFY_EMAIL` và `CODE_FOLDER_ID`.
  - Dán bản mới, bấm **Lưu** xong thì tải lại Sheet và chạy **SmartCarTech → Kiểm tra cài đặt…** *trước khi* triển khai. Bản mới cần thêm quyền thì Google hỏi ở bước này.

## 6. Trang quản trị: admin, manager, seller

Mở `smartcartech.vn/quan-tri.html`, đăng nhập, rồi xem và sửa dữ liệu Google Sheet của shop ngay trên web, trên điện thoại cũng được, không cần mở Google Sheet. Web không có link nào tới trang này, Google cũng không hiện trang này khi tìm kiếm. Phần dưới đây là những gì tài khoản **admin** làm được; manager, seller chỉ xem, làm được phần admin cho (xem *Tài khoản manager, seller và hoa hồng* bên dưới).

**Làm được gì:**

- Trang đầu tiên là **Tổng quan**: lợi nhuận, số đơn, khách truy cập có biểu đồ (xem *Trang Tổng quan và khách truy cập* bên dưới).
- Xem mọi trang tính trong Sheet: Đơn hàng, Tư vấn, In 3D, Mã tải code, các trang kế hoạch nhập từ Excel (xem *Đưa file kế hoạch Excel vào Google Sheet* bên dưới) và trang Nhật ký quản trị. Màu nền, màu chữ, chữ đậm, ô gộp hiện như trên Sheet.
  - Danh sách trang tính nằm ở cột bên trái, cuộn lên xuống được. Nút ☰ ẩn cột này để bảng rộng hơn; trên điện thoại, nút ☰ mở danh sách.
  - Ghi chú của từng trang gom ở nút *Lưu ý* cạnh tên trang.
- Bấm số dòng hoặc một ô: cả dòng mở ở khung bên phải. Sửa rồi bấm **Lưu thay đổi**.
  - Ô thả xuống (VD *Trạng thái* ở trang In 3D) và ô tích (VD *Khoá* ở trang Mã tải code) hiện đúng như trên Sheet.
  - *Nền tảng* ở trang Đơn hàng chọn trong ô thả xuống: Shopee, Tiktok (`ORDER_PLATFORMS` trong script). *Loại* ở trang In 3D cũng vậy: bảng tên, giá đỡ, in theo file. Ô nào đã có ô thả xuống riêng trên Sheet thì dùng danh sách của Sheet.
  - *Sản phẩm* ở trang Đơn hàng: chọn một sản phẩm đang bán trên web (đọc từ `products.json`) và số lượng (ô *SL*). Ô được ghi đúng như đơn web, VD "SC Tech Pro – Bộ đầy đủ linh kiện × 2". Chữ cũ gõ tay (VD đơn gộp từ Excel) được giữ nguyên, hiện là "(ngoài danh sách)". Đơn nhiều sản phẩm khác nhau thì sửa ô đó trên Google Sheet, mỗi sản phẩm một dòng trong ô như đơn web.
  - Trang **Task Tracking**: cột *Deadline* chọn ngày trên lịch, ghi giống các ô đang có trong cột (VD "Nov132026"; cột toàn ngày thật thì ghi ngày thật). Cột *Status* chọn Waiting hoặc Done, dòng mới chọn sẵn Waiting. Lưu xong, ô Status được tô màu giống các ô Waiting (cam nhạt), Done (xanh lá) đã tô trong cột; cột chưa có ô nào tô thì dùng cam nhạt, xanh lá mặc định. Muốn thêm cột chọn ngày, lựa chọn hay màu khác: sửa `ADMIN_SHOP_RULES` trong script (cột tìm theo tên ở dòng tiêu đề).
  - Ô script tự tính, tự ghi chỉ xem, có dòng nhỏ ghi lý do (xem *Dữ liệu được giữ an toàn*).
- **Thêm dòng**: VD đơn Shopee, đơn Zalo. Ở Đơn hàng, Tư vấn, In 3D, Task Tracking: dòng mới nằm trên cùng, ngay dưới dòng tiêu đề (trang có dòng cố định thì dưới các dòng cố định; có dòng tên bảng ở trên thì dưới dòng tên cột); trang khác: cuối trang tính. Ô thả xuống, ô tích lấy theo dòng kề bên.
- **Xoá dòng**: nút ở cuối khung, bấm thêm một lần để xác nhận.
- Ô tìm kiếm lọc các dòng có chữ đó, không cần gõ dấu: gõ "binh" tìm được "Bình".
- **Chuyển trang nhanh:** mỗi lần tải, script phải đọc cả trang tính trên Google Sheet nên mất vài giây. Vì vậy:
  - Trang đã mở trong tab này hiện ngay khi bấm lại, rồi web tải bản mới ở dưới (dòng "Đang cập nhật dữ liệu mới nhất…"). Có gì khác thì tự vẽ lại, giữ chỗ đang cuộn. Đang mở khung sửa một dòng thì không vẽ lại; lưu vẫn được kiểm tra như thường.
  - Mở xong trang đầu tiên, web tải ngầm 8 trang hay mở nhất trên máy đó (`PREFETCH_MAX` trong `assets/js/admin.js`), để lần đầu bấm sang cũng hiện ngay. Người dùng đang chờ một trang thì phần tải ngầm nhường.
  - Bấm **Tải lại** để lấy bản mới nhất ngay. Rê chuột vào chữ "tải lúc …" để xem script mất bao lâu.
  - Đăng xuất hay đổi tài khoản thì mọi trang đã nhớ bị bỏ.
- Ghi đúng kiểu như khi gõ trên Sheet: SĐT giữ số 0 ở đầu, mã đơn dài giữ dạng chữ, ô số nhận "2.980.000", ô ngày nhận "31/10/2026 14:30".

**Dữ liệu được giữ an toàn:**

- Mỗi lần lưu, script kiểm tra dòng đó có bị đổi ở nơi khác từ lúc mở không: VD vừa sửa trên Google Sheet, có đơn mới, hay vừa xoá một dòng phía trên. Nếu có, web không ghi gì, tải lại dữ liệu mới, rồi hiện lại nội dung bạn vừa gõ để làm lại.
- Dòng 1 (tên cột) của các trang Đơn hàng, Tư vấn, In 3D, Mã tải code chỉ sửa được trên Sheet, vì script tìm cột theo tên để ghi đơn.
- Trang Mã tải code không thêm, xoá dòng trên web được, vì mã đã in trên thẻ. Cột Mã tải code, Mã đơn, Khách hàng chỉ xem. Tạo mã, in thẻ vẫn làm ở menu SmartCarTech. Muốn ngừng một mã: tích ô Khoá.
- Ô script tự tính, tự ghi chỉ xem trên trang quản trị (trên Google Sheet vẫn sửa được khi thật cần):
  - **Lợi nhuận** ở trang Đơn hàng, In 3D, mọi dòng: script tự tính bằng Doanh thu sau điều chỉnh trừ Chi phí. Muốn lợi nhuận đổi thì sửa 2 cột đó.
  - **Lợi nhuận sau hoa hồng**: script tự tính bằng Lợi nhuận trừ Hoa hồng (₫) (xem *Hoa hồng* bên dưới).
  - **Đơn đặt trên website** (Nền tảng là Website, hoặc trống mà mã đơn dạng SC…): Thời gian, Mã đơn, Nền tảng, Sản phẩm, Tổng (₫), Kiểm tra, và **Doanh thu sau điều chỉnh** (tự tính bằng Tiền thu người nhận trừ Phí ship (đơn web), xem *Phí ship, doanh thu đơn web* bên dưới). Họ tên, SĐT, Địa chỉ, Ghi chú (khách gõ, có thể sai) và các cột shop tự điền vẫn sửa được. Đơn shop tự thêm (Shopee, Tiktok) thì sửa được hết, trừ Lợi nhuận và Phí ship (đơn web) (chỉ dành cho đơn web).
  - **Yêu cầu đặt ở trang In 3D** (mã dạng IN…): Thời gian, Mã, Loại, Kiểm tra, Doanh thu sau điều chỉnh (tự tính như đơn web). Nội dung, Số lượng, Tạm tính vẫn sửa được, vì shop chốt lại với khách và báo giá in theo file.
  - Trang **Mã tải code**: Tải lần đầu, Tải gần nhất, File tải gần nhất, Đã in. *Số lần tải* vẫn sửa được để đặt lại về 0 khi khách hết lượt.
  - **Ô công thức** ở mọi trang: hiện kết quả và công thức; đổi công thức thì sửa trên Google Sheet.
- Sửa cột Mã tải code (hoặc Mã đơn, Họ tên, SĐT) ở trang Đơn hàng trên web thì script gán mã y như khi gõ trên Sheet.
- Mọi lần đăng nhập, sửa ô, thêm, xoá dòng, tạo, sửa, xoá tài khoản, đổi mật khẩu được ghi ở trang tính **Nhật ký quản trị** (script tự tạo; trên web chỉ xem, chỉ admin thấy). Dòng bị xoá được lưu đủ nội dung ở cột *Trước*: lỡ tay xoá thì chép lại từ đây. Script không ghi được nhật ký thì cũng không xoá dòng.
- Google Sheet cũng giữ mọi thay đổi ở **Tệp → Lịch sử phiên bản**.
- Hình ảnh đặt trên trang tính và định dạng (màu, cỡ chữ, độ rộng cột) chỉ sửa trên Google Sheet.
- Trang tính rất lớn (hơn 40.000 ô, `ADMIN_MAX_CELLS` trong script): web chỉ hiện các dòng mới nhất (đầu trang với Đơn hàng, Tư vấn, In 3D, Mã tải code, Nhật ký quản trị; cuối trang với trang khác), dòng cũ hơn xem trên Sheet.

**Tài khoản, đăng nhập:**

- Tạo tài khoản trên trang quản trị bằng tài khoản admin (mục **Tài khoản**, xem bên dưới), hoặc trong Google Sheet: menu **SmartCarTech → Tài khoản trang quản trị…**. Nhập tên đăng nhập (chữ không dấu), chọn vai trò và mật khẩu ít nhất 10 ký tự, hoặc bấm *Tạo mật khẩu mạnh* rồi chép lại. Bấm **Lưu tài khoản**. Tạo được nhiều tài khoản, VD mỗi người một tài khoản.
- Tự đổi mật khẩu: nút ổ khoá cạnh tên mình ở cuối cột trái (cần mật khẩu hiện tại). Quên mật khẩu: admin đặt mật khẩu mới ở mục Tài khoản, hoặc trong cửa sổ trên Google Sheet nhập lại tên đó với mật khẩu mới. Mọi nơi đang đăng nhập bằng tài khoản đó bị đăng xuất. Xoá tài khoản: bấm *Xoá* 2 lần.
- Mật khẩu chỉ lưu dạng mã hoá trong script (Script Properties), không nằm trong kho GitHub hay trên web: không ai xem lại được mật khẩu, kể cả chủ Sheet.
- Sai mật khẩu hoặc mã 2 bước 5 lần trong 15 phút thì tài khoản đó tạm khoá 15 phút. Cả web sai 30 lần thì mọi tài khoản tạm khoá 15 phút. Như vậy không ai dò được mật khẩu. Bị khoá mà cần gấp thì mở thẳng Google Sheet.
- Phiên đăng nhập chỉ giữ trong tab đang mở: đóng tab là phải đăng nhập lại. Không thao tác 3 giờ (`ADMIN_IDLE_HOURS`) hoặc dùng quá 12 giờ (`ADMIN_MAX_HOURS`) cũng phải đăng nhập lại. Đang sửa dở thì khung đăng nhập hiện đè lên: đăng nhập xong bấm Lưu lần nữa, nội dung đang sửa không mất.
- Ai được chia sẻ quyền **sửa** Google Sheet thì cũng mở được Apps Script và menu tạo tài khoản: chỉ chia sẻ quyền sửa cho người tin cậy. Tài khoản Google sở hữu Sheet nên bật xác minh 2 bước của Google.

**Mã 2 bước (nên bật cho mọi tài khoản):** đăng nhập cần mật khẩu và mã 6 số trong ứng dụng xác minh trên điện thoại. Lộ mật khẩu thì người khác vẫn không vào được.

1. Cài **Google Authenticator** (hoặc Microsoft Authenticator) trên điện thoại.
2. Google Sheet → **SmartCarTech → Tài khoản trang quản trị…** → bấm **Bật mã 2 bước** ở tài khoản đó.
3. Trong ứng dụng bấm **+** → **Quét mã QR**, quét mã trong cửa sổ. Không quét được thì chọn *Nhập khoá thiết lập* và gõ khoá hiện dưới mã QR.
4. Nhập mã 6 số ứng dụng hiện cho SmartCarTech → **Xác nhận**. Cửa sổ ghi *Đã bật mã 2 bước*.

- Từ đó, đăng nhập xong bước mật khẩu thì trang hỏi mã 6 số: gõ đủ 6 số là tự gửi. Có 5 phút để nhập mã, mã của 30 giây trước hoặc sau vẫn được nhận, mỗi mã chỉ dùng được 1 lần.
- Bật xong, mọi nơi đang đăng nhập bằng tài khoản đó bị đăng xuất. Đổi mật khẩu vẫn giữ mã 2 bước.
- Đổi điện thoại: bấm **Cài lại mã 2 bước**, quét bằng điện thoại mới. Điện thoại cũ vẫn dùng được cho tới lúc xác nhận xong.
- Mất điện thoại: bấm **Tắt mã 2 bước** (2 lần), đăng nhập chỉ bằng mật khẩu, rồi bật lại trên điện thoại mới. Chỉ người mở được Google Sheet mới làm được việc này.
- Mã đúng mà vẫn báo sai: đặt giờ của điện thoại về chế độ tự động.
- Khoá bí mật chỉ hiện 1 lần trong cửa sổ lúc cài, lưu cùng tài khoản trong Script Properties. Mã QR vẽ ngay trong cửa sổ, khoá không gửi đi đâu.

**Email báo** (cần điền `NOTIFY_EMAIL`, cùng email nhận báo đơn):

- Tài khoản nhập đúng mật khẩu trên một trình duyệt chưa từng đăng nhập xong. Tài khoản có mã 2 bước được báo ngay sau bước mật khẩu, trước khi nhập mã: email ghi rõ người đó còn phải có điện thoại của bạn. Mỗi máy, mỗi trình duyệt bạn dùng sẽ báo 1 lần đầu, là bình thường. Tab ẩn danh hay xoá dữ liệu trình duyệt thì tính là trình duyệt mới. Đổi mật khẩu thì script quên hết các trình duyệt đã biết.
- Tài khoản bị khoá vì sai 5 lần, hoặc cả web bị khoá vì sai 30 lần. Có lần nhập đúng mật khẩu mà sai mã 2 bước thì email nói mật khẩu đã lộ: đặt mật khẩu mới ngay.
- Admin tạo, xoá tài khoản, đổi vai trò hay đặt mật khẩu mới cho người khác trên trang quản trị (đổi quyền xem thì chỉ ghi nhật ký).
- Cùng một việc chỉ báo 1 lần trong 6 giờ, tối đa 5 email báo mỗi giờ. Hạn mức email trong ngày còn 20 thì thôi báo, để dành cho email báo đơn.
- Email ghi giờ, tài khoản và tên trình duyệt (do trình duyệt tự báo, có thể bị giả). Script không biết địa chỉ IP. Trình duyệt được nhận ra nhờ một mã ngẫu nhiên nó tự giữ; script chỉ lưu mã băm của mã đó.
- Nhật ký quản trị ghi tên trình duyệt ở cột *Vị trí* của mỗi lần đăng nhập, kèm "(trình duyệt mới)", và mọi lần nhập sai mã 2 bước.

**Tắt trang quản trị** khi không dùng, hay khi nghi có người lạ: menu **SmartCarTech → Bật hoặc tắt trang quản trị…**. Khi tắt, không ai đăng nhập được và người đang đăng nhập bị đăng xuất ở lần bấm tiếp theo, trang hiện lý do. Web bán hàng, Google Sheet và menu vẫn chạy bình thường. Bật lại cũng ở menu đó; mọi người phải đăng nhập lại.

**Cài đặt (làm một lần, theo đúng thứ tự):**

1. Dự phòng: mở Google Sheet → **Tệp → Lịch sử phiên bản → Đặt tên cho phiên bản hiện tại**, VD "Trước trang quản trị".
2. Dán bản `google-apps-script.gs` mới vào Apps Script, điền lại `NOTIFY_EMAIL` và `CODE_FOLDER_ID`, bấm **Lưu**.
3. Tải lại Sheet → **SmartCarTech → Kiểm tra cài đặt…** (Google hỏi cấp quyền thì làm như mục 5, bước 7). Dòng cuối báo chưa có tài khoản trang quản trị là đúng.
4. **SmartCarTech → Tài khoản trang quản trị…** → tạo tài khoản, rồi bật mã 2 bước cho tài khoản đó. Chạy lại *Kiểm tra cài đặt…*: có dòng ✓ với tên tài khoản, và dòng nêu tài khoản nào chưa bật mã 2 bước.
5. Triển khai phiên bản mới (mục 5, *Sửa script sau này*). URL giữ nguyên, không phải sửa `products.json`.
6. Đưa web lên, rồi mở `smartcartech.vn/quan-tri.html` và đăng nhập.

Web lên trước khi triển khai script mới thì trang quản trị báo "chưa có bản mới"; các phần khác của web vẫn chạy bình thường. Thứ tự giữa script và web không quan trọng với mã 2 bước: trang cũ gặp tài khoản đã bật mã thì nhắc tải lại trang.

### Tài khoản manager, seller và hoa hồng

Mỗi tài khoản có một vai trò:

- **Admin**: xem, sửa mọi thứ, quản lý tài khoản, xem hoa hồng của mọi seller, manager và lợi nhuận của shop sau khi trả hoa hồng. Tài khoản tạo từ trước khi có vai trò đều là admin.
- **Manager**: giúp quản lý đơn, và tự lên đơn cho khách mình tìm được như seller (khi admin tích *Được lên đơn*). Chỉ xem được các trang tính, các cột admin cho. Không bao giờ thấy cột hoa hồng trên trang tính (mọi cột có chữ "hoa hồng", ở mọi trang tính, kể cả % hoa hồng). Manager xem hoa hồng của mình ở mục **Hoa hồng của tôi**, tách 2 phần: *hoa hồng quản lý* và *hoa hồng lên đơn* (xem *Hoa hồng của manager* bên dưới). Không có mục Tài khoản.
- **Seller**: tự tìm khách rồi lên đơn trên web. Ở Đơn hàng, In 3D chỉ thấy đơn mình lên, không thêm, xoá dòng ở đó; xem tình trạng đơn và hoa hồng của mình.

Nhật ký quản trị và trang Hoa hồng seller chỉ admin xem được. Trang **Chi Phí** chỉ admin sửa; admin tích *Xem* cho ai thì người đó xem được, không sửa được (xem *Chi phí sản phẩm* bên dưới). Mọi quyền do script kiểm tra ở mỗi lần bấm: cột bị ẩn, đơn của người khác không được gửi về trình duyệt, nên xem mã nguồn trang cũng không thấy. Seller xem được Doanh thu sau điều chỉnh, % hoa hồng, Hoa hồng (₫), Đã trả hoa hồng của đơn mình; các cột hoa hồng chỉ admin sửa, cột Seller, Manager, Chi phí cũng vậy.

**Tạo, sửa tài khoản** (đăng nhập bằng tài khoản admin → mục **Tài khoản** ở đầu cột trái):

1. Bấm **Thêm tài khoản**, nhập tên đăng nhập, chọn vai trò, bấm *Tạo mật khẩu* rồi chép lại.
2. Chọn trang tính được xem và việc được làm ở trang đó: *Xem*, *Sửa*, *Thêm dòng*, *Xoá dòng* (trang Chi Phí chỉ tích được *Xem*). Bấm *Cột* để chỉ cho xem một số cột, hoặc để *Mọi cột, kể cả cột thêm sau này*. Vai trò mới có sẵn quyền gợi ý: manager xem, sửa, thêm dòng ở Đơn hàng, In 3D, Tư vấn và được lên đơn; seller xem đơn của mình ở Đơn hàng, In 3D (các cột khách, sản phẩm, tổng, trạng thái, doanh thu, % và hoa hồng) và được lên đơn.
3. **Được nhập "Phí ship (đơn web)"**: mặc định chỉ admin nhập phí ship. Tích ô này thì manager, seller đó nhập được phí ship của đơn web (seller: đơn của mình), kể cả khi trang tính đó chỉ cho xem: các cột khác vẫn chỉ xem.
4. **Được lên đơn** (seller, manager): tích thì người đó lên đơn cho khách trên trang Đặt hàng, In 3D (xem *Seller, manager lên đơn* bên dưới).
5. Manager: ô **% hoa hồng** (hoa hồng quản lý) và **Tính cho đơn từ ngày** (xem *Hoa hồng của manager* bên dưới). Để trống: không nhận hoa hồng quản lý.
6. Bấm **Tạo tài khoản**, gửi tên đăng nhập và mật khẩu cho người đó. Họ tự đổi mật khẩu ở nút ổ khoá cạnh tên mình.

- Đổi quyền có hiệu lực ngay ở lần bấm tiếp theo của người đó. Đổi vai trò hay đặt mật khẩu mới thì người đó bị đăng xuất.
- Không tự đổi vai trò, không tự xoá tài khoản của mình, và web luôn còn ít nhất 1 admin. Mất hết admin (VD quên mật khẩu): tạo lại trong Google Sheet, menu SmartCarTech → Tài khoản trang quản trị…, vai trò Admin.
- Cột được chọn theo tên cột: đổi tên một cột thì manager, seller không thấy cột đó nữa tới khi admin tích lại.
- Trang Tổng quan không có số liệu hoa hồng, cấp cho manager được.
- Mã 2 bước của manager, seller cũng bật trong Google Sheet như admin (cần điện thoại của người đó để quét mã).

**Seller, manager lên đơn:**

1. Seller (hay manager) đăng nhập trang quản trị, bấm **Lên đơn bộ xe** hoặc **Lên đơn In 3D**: trang bán hàng mở ngay trong tab đó, đầu trang có dòng "Đang lên đơn cho khách bằng tài khoản seller …" (manager: "tài khoản manager …").
2. Chọn sản phẩm, điền thông tin khách đưa rồi gửi như khách đặt. Đơn được ghi ở Đơn hàng hoặc In 3D: cột **Seller** là tên người lên đơn (seller hay manager), **% hoa hồng** theo sản phẩm, **Đã trả hoa hồng** chưa tích; **Hoa hồng (₫)** tự tính khi đơn có Doanh thu sau điều chỉnh. Email báo đơn ghi "Seller lên đơn" hay "Manager lên đơn", tên và %.

- Cột Seller là *người lên đơn*: đơn manager tự lên ghi tên manager ở cột này, cột Manager để trống, nên đơn đó chỉ có hoa hồng lên đơn (% như seller), không có hoa hồng quản lý. Ô thả xuống cột Seller (chỉ admin sửa) có cả tên seller và manager.
- Phải mở trang bán hàng trong cùng tab với trang quản trị: ở tab khác, máy khác, đơn là đơn khách tự đặt, không có tên người lên đơn.
- Phiên hết hạn (3 giờ không dùng) thì dòng đầu trang báo đăng nhập lại. Đơn gửi lúc đó không được ghi, để người lên đơn đăng nhập lại rồi gửi lại, không mất hoa hồng.
- Admin bỏ tích *Được lên đơn* của seller, manager nào thì đơn người đó gửi từ tab trang quản trị không được ghi (trang báo lý do).

**Phí ship, doanh thu đơn web:**

- Trang Đơn hàng có cột **Phí ship (đơn web)** ngay trước Doanh thu sau điều chỉnh. Trang In 3D có cụm cột tiền giống vậy ở cuối: Tiền thu người nhận, Phí ship (đơn web), Doanh thu sau điều chỉnh, Chi phí, Lợi nhuận, Lợi nhuận sau hoa hồng.
- Đơn web mới (khách tự đặt hay seller, manager lên): **Tiền thu người nhận** ghi bằng tổng tiền đơn (sửa được khi khách trả khác). Nhập Phí ship (miễn ship thì gõ 0): **Doanh thu sau điều chỉnh** = Tiền thu người nhận − Phí ship, tự tính. Đổi một trong 2 ô thì doanh thu, lợi nhuận, hoa hồng tự tính lại.
- Đơn Shopee, Tiktok: ô Phí ship (đơn web) để trống, trang quản trị không cho nhập; Doanh thu sau điều chỉnh gõ như trước.
- Đơn web có từ trước bản này: số doanh thu đã gõ được giữ nguyên và vẫn sửa được. Muốn tính tự động thì xoá ô doanh thu đó, điền Tiền thu người nhận và Phí ship.

**Chi phí sản phẩm (trang Chi Phí):**

- Trang tính **Chi Phí** do script tạo khi chạy *Kiểm tra cài đặt* (hoặc khi admin mở trang này trên trang quản trị): mỗi sản phẩm trên web một dòng (các bộ xe, bảng tên 1 tầng, 2 tầng, giá đỡ), như trang Hoa hồng seller. Admin điền cột *Chi phí mỗi sản phẩm (₫)*, VD 450.000. Sản phẩm mới trên web tự có dòng (để trống).
- **Đơn mới** (khách đặt trên web, seller, manager lên đơn, dòng thêm trên trang quản trị, dòng gõ trên Google Sheet): cột **Chi phí** tự ghi = chi phí mỗi sản phẩm × số lượng; đơn nhiều sản phẩm thì cộng lại. Có Doanh thu sau điều chỉnh thì **Lợi nhuận** tự tính như trước. Ô tự ghi có ghi chú "Tự điền theo trang "Chi Phí" lúc …".
  - Trang Đơn hàng: số lượng đọc ở cột Sản phẩm, dạng "SC Tech Pro – Bộ đầy đủ linh kiện × 2" (như đơn web và ô Sản phẩm + SL trên trang quản trị); dòng không có "× số" là 1 cái.
  - Trang In 3D: bảng tên theo kiểu bảng (dòng "Kiểu: 1 tầng" ở cột Nội dung), giá đỡ, nhân cột Số lượng. Yêu cầu in theo file chưa có sản phẩm cố định: admin tự ghi chi phí.
  - Sản phẩm chưa có chi phí ở trang Chi Phí (hay tên gõ tay không có ở đó): ô Chi phí của đơn để trống cho admin ghi, không ghi một phần. *Kiểm tra cài đặt* báo còn bao nhiêu sản phẩm chưa có chi phí.
- **Sửa chi phí ở trang Chi Phí** (trên trang quản trị hay Google Sheet): đơn tiếp theo dùng số mới ngay, không cần triển khai lại. Đơn đã có giữ nguyên chi phí đã ghi.
- **Sửa sản phẩm, số lượng của một đơn** mà ô Chi phí do script ghi: chi phí tính lại theo trang Chi Phí lúc sửa. Ô Chi phí admin đã gõ tay thì giữ nguyên, không bao giờ bị tính lại.
- **Đơn có từ trước** (đặt trước ngày chạy *Kiểm tra cài đặt* tạo trang Chi Phí): không tự điền, không đổi, kể cả khi sửa sản phẩm. Chi phí của các đơn này vẫn gõ tay như trước. Dòng gõ tay trên Google Sheet mà *Thời gian* trước ngày đó cũng tính là đơn cũ; dòng thêm trên trang quản trị thì luôn là đơn mới.
- **Chỉ admin sửa cột Chi phí** ở Đơn hàng, In 3D trên trang quản trị; manager, seller chỉ xem (nếu được cho xem cột đó). Trang Chi Phí cũng chỉ admin sửa: muốn cho manager, seller xem thì vào mục **Tài khoản**, tích *Xem* ở trang Chi Phí (bấm *Cột* để chọn cột). Không tích thì người đó không thấy trang này.
- Manager được xem cột Chi phí ở Đơn hàng thì vẫn thấy chi phí của từng đơn (chia số lượng ra chi phí mỗi sản phẩm). Muốn giữ kín chi phí với người đó thì bỏ tích cột Chi phí và Lợi nhuận trong quyền của họ.
- Sản phẩm bán ngoài web (không có trong `products.json`): thêm dòng ở trang Chi Phí trên Google Sheet, để trống cột Mã, cột Sản phẩm gõ đúng như ở cột Sản phẩm của đơn.
- Google Sheet đã có sẵn một trang tên "Chi Phí" mà dòng 1 không có cột *Mã* và *Chi phí mỗi sản phẩm (₫)* (VD shop tự tạo trước): script không ghi vào trang đó, *Kiểm tra cài đặt* báo ✗. Đổi tên trang đó (VD "Chi Phí cũ") rồi chạy lại *Kiểm tra cài đặt* để script tạo trang mới.

**Cài đặt phần Chi phí (sau khi dán script mới):** điền lại `NOTIFY_EMAIL`, `CODE_FOLDER_ID`, bấm **Lưu**, tải lại Google Sheet, chạy **Kiểm tra cài đặt…** (tạo trang Chi Phí), điền chi phí cho từng sản phẩm, rồi triển khai phiên bản mới. Từ lúc đó đơn mới tự có chi phí.

**Hoa hồng seller:**

- % hoa hồng ở trang tính **Hoa hồng seller** (script tạo, chỉ admin xem): mỗi sản phẩm trên web một dòng (các bộ xe, bảng tên 1 tầng, 2 tầng, giá đỡ), admin điền cột *% hoa hồng seller*, VD "10%" (gõ 10 cũng được: script ghi lại thành 10%), chung cho mọi seller và cho manager khi manager tự lên đơn. Sản phẩm mới trên web tự có dòng (để trống) khi mở trang này hoặc chạy *Kiểm tra cài đặt*.
- Bản trước ghi số tiền mỗi sản phẩm: cột được đổi tên thành *% hoa hồng seller*, số tiền cũ giữ nguyên nhưng không dùng. *Kiểm tra cài đặt* báo còn bao nhiêu ô cần sửa thành %.
- Đơn seller (hay manager) lên: % của sản phẩm ghi vào cột **% hoa hồng** của đơn (đơn nhiều sản phẩm: % chung theo tỷ trọng giá bán × số lượng, tới 0,01%). **Hoa hồng (₫) = % hoa hồng × Doanh thu sau điều chỉnh** của đơn, tự tính khi đơn có doanh thu. Sản phẩm chưa có %, hay đơn in theo file (chưa có giá), thì ô % để trống: admin ghi vào đơn.
- Đổi % ở trang Hoa hồng seller chỉ áp dụng cho đơn mới; đơn đã có thì sửa ở cột % hoa hồng của đơn đó. Đơn seller của bản trước (đã ghi số tiền hoa hồng) giữ số tiền đó.

**Hoa hồng của manager** có 2 phần:

- **Hoa hồng quản lý** (% do admin đặt riêng): mục Tài khoản → mở tài khoản manager → điền **% hoa hồng** và **Tính cho đơn từ ngày** → Lưu. Manager nhận % đó × Doanh thu sau điều chỉnh của các đơn ở trang Đơn hàng **khách tự đặt** (cột Seller trống: không do seller hay manager nào lên), đặt từ ngày đó (đơn web và Shopee, Tiktok). Đơn In 3D khách tự đặt không có hoa hồng quản lý.
  - Lưu xong, các đơn từ ngày đó chưa có người nhận được ghi luôn tên manager ở cột **Manager** và % ở cột % hoa hồng; đơn mới tự ghi. Đổi % chỉ áp dụng cho đơn chưa ghi.
  - Mỗi lúc chỉ một manager nhận hoa hồng quản lý. Xoá % (để trống) thì đơn mới thôi tính; đơn đã ghi vẫn giữ hoa hồng.
- **Hoa hồng lên đơn** (% như seller): đơn manager tự lên cho khách mình tìm được (xem *Seller, manager lên đơn*), ở cả Đơn hàng và In 3D, % theo sản phẩm ở trang Hoa hồng seller. Đơn này không tính hoa hồng quản lý.
- Manager theo dõi ở mục **Hoa hồng của tôi**: bảng *2 phần hoa hồng của bạn* (Quản lý, Lên đơn), tổng cả 2 phần, và từng đơn ghi rõ thuộc phần nào. Trên trang tính manager vẫn không thấy cột hoa hồng của ai.

**Mục Hoa hồng:**

- Trang Đơn hàng có cột **Trạng thái** (Mới, Đã xác nhận, Đang giao, Đã giao, Huỷ; `ORDER_STATUSES` trong script): đơn web mới ghi "Mới", manager cập nhật ở ô thả xuống. In 3D dùng cột Trạng thái sẵn có.
- **Hoa hồng, lợi nhuận** (admin), **Đơn và hoa hồng của tôi** (seller), **Hoa hồng của tôi** (manager): *Chưa trả* là đơn Đã giao mà chưa tích Đã trả hoa hồng, *Đang chờ* là đơn chưa giao xong, *Đã trả*; *Chưa tính được* là đơn chưa có % hay chưa có doanh thu; đơn Huỷ không tính.
- Admin thấy từng người nhận (seller, manager; manager có 2 dòng: Quản lý, Lên đơn) và các đơn cần làm: **Trả hoa hồng** (đơn đã giao), **Ghi %**, **Nhập doanh thu** (đơn đã giao mà chưa có doanh thu). Bấm **Mở đơn**, tích **Đã trả hoa hồng** khi đã trả.
- Bảng **Lợi nhuận của shop sau khi trả hoa hồng** (admin): theo tháng đặt đơn, cả Đơn hàng và In 3D: Lợi nhuận, Hoa hồng (trả cho seller, manager), Lợi nhuận sau hoa hồng là số tiền shop thật sự kiếm được.
- Cột **Lợi nhuận sau hoa hồng** ở trang Đơn hàng, In 3D = Lợi nhuận trừ Hoa hồng (₫), tự tính như cột Lợi nhuận: đơn có lợi nhuận thì có số, đơn không ai nhận hoa hồng thì bằng Lợi nhuận, hoa hồng đổi thì tự tính lại. Đơn chưa có lợi nhuận thì để trống.
- Manager không thấy cột Lợi nhuận sau hoa hồng (tên có chữ "hoa hồng"): thấy cả 2 cột lợi nhuận thì trừ ra được hoa hồng. Trang Tổng quan chưa có lợi nhuận sau hoa hồng, vì trang đó cấp cho manager được.
- Các cột mới được thêm khi mở Google Sheet sau khi dán script: Phí ship (đơn web) chèn trước Doanh thu sau điều chỉnh (Google Sheet tự dời công thức theo), Trạng thái, Seller, Hoa hồng (₫), Đã trả hoa hồng, Lợi nhuận sau hoa hồng, Manager, % hoa hồng ở cuối trang. Ô của đơn cũ không bị sửa.

**Cài đặt (sau khi dán script mới):** tải lại Google Sheet (các cột mới được thêm), chạy **Kiểm tra cài đặt…** (tạo trang Hoa hồng seller, báo ô % cần sửa), điền % hoa hồng ở trang Hoa hồng seller, triển khai phiên bản mới, rồi tạo tài khoản manager, seller ở mục Tài khoản (manager nhận hoa hồng: điền %).

### Trang Tổng quan và khách truy cập

Trang tính **Tổng quan** (trang đầu tiên của Sheet, script tự tạo) gom số liệu kinh doanh, có biểu đồ. Trên trang quản trị, mở trang này thì thấy thẻ số, biểu đồ vẽ riêng cho web (xem được trên điện thoại) và bảng.

Tính lại Tổng quan khá lâu, nên trang quản trị dùng lại số liệu vừa tính nếu chưa quá 10 phút (`DASH_REFRESH_MINUTES`) và chưa có gì đổi: đơn mới, lượt xem mới, sửa, thêm, xoá dòng ở Đơn hàng, In 3D, Tư vấn (trên web hay trên Google Sheet), gộp Customer Infor. Có một trong các việc đó thì lần mở sau tính lại. Bấm **Tải lại** để tính lại ngay.

- **Tháng này, tính tới hôm nay** so với cùng kỳ tháng trước (từ ngày 1 tới cùng ngày): lợi nhuận, doanh thu, số đơn, khách truy cập, tỷ lệ đặt hàng.
- **Biểu đồ**: doanh thu và lợi nhuận 12 tháng gần nhất; số đơn theo nền tảng (Website, Shopee, TikTok, Khác, In 3D); khách truy cập 30 ngày gần nhất. Trên web: rê chuột, chạm hoặc dùng phím ← → trên biểu đồ để xem số từng tháng, từng ngày.
- **Việc cần làm**: đơn In 3D đang chờ (Mới, Đã liên hệ, Đã chốt, Đang in), đơn chưa có lợi nhuận, mã tải code chưa in, thẻ đã in chưa gán đơn. Trên web, bấm vào một việc để mở trang tính đó.
- **Bảng** theo tháng (12 tháng) và theo năm: số đơn từng nền tảng, doanh thu, lợi nhuận, % lợi nhuận, khách truy cập, tỷ lệ đặt hàng, yêu cầu tư vấn, yêu cầu in theo file.

**Cách tính:**

- Số đơn: trang Đơn hàng theo cột **Nền tảng** (ô trống mà mã đơn dạng `SC…` là đơn web; tên khác Website, Shopee, TikTok vào nhóm Khác), cộng đơn In 3D đặt trên web (bảng tên, giá đỡ; không tính đơn *Huỷ*). Yêu cầu in theo file là yêu cầu báo giá, đếm riêng. Đơn chưa có *Thời gian* không được tính, cuối trang có ghi số đơn đó.
- Doanh thu: cột **Doanh thu sau điều chỉnh**; đơn chưa điền thì lấy **Tổng (₫)**. Lợi nhuận: cột **Lợi nhuận**, chỉ có ở đơn đã điền đủ Doanh thu và Chi phí; % lợi nhuận tính trên các đơn đó. Muốn số đúng thì điền Doanh thu sau điều chỉnh và Chi phí cho mọi đơn (Chi phí của đơn mới tự ghi theo trang Chi Phí).
- Khách truy cập: số trình duyệt ghé web, mỗi trình duyệt tính 1 lần trong ngày, trong tháng, trong năm. Tỷ lệ đặt hàng: đơn đặt trên web (bộ xe + In 3D) từ ngày bắt đầu đếm, chia cho khách truy cập.

**Số liệu cập nhật khi nào:** mỗi lần mở trang Tổng quan trên trang quản trị (hoặc bấm *Tải lại*), mỗi lần mở Google Sheet (nếu lần trước đã quá 10 phút, `DASH_REFRESH_MINUTES`), hoặc menu **SmartCarTech → Cập nhật trang Tổng quan**. Trang do script ghi lại mỗi lần cập nhật: đừng sửa tay. Biểu đồ trong Google Sheet có thể kéo đổi chỗ, đổi cỡ; xoá đi thì lần cập nhật sau tự vẽ lại. Sheet đã có trang tên "Tổng quan" do shop tự tạo thì script không đụng tới.

**Đếm khách truy cập (ẩn danh):**

- Mỗi lần mở một trang công khai trên `smartcartech.vn`, trình duyệt báo về script 1 lượt xem, kèm cho biết đây có phải lần đầu trình duyệt đó ghé trong ngày, tháng, năm không. Không dùng cookie, không gửi IP, tên hay mã riêng nào. Trình duyệt chỉ nhớ ngày nó được đếm gần nhất (`sctech_seen` trong bộ nhớ trình duyệt). Chính sách bảo mật đã ghi điều này.
- Không đếm: máy đã từng mở trang quản trị (máy của shop), các công cụ tự động (bot), bản web chạy thử trên máy.
- Số đếm trong ngày nằm ở Script Properties (đếm không cần ghi Sheet nên không làm chậm đơn hàng). Mỗi lần cập nhật Tổng quan, các ngày đã qua được chuyển sang trang tính **Lượt truy cập** (mỗi ngày 1 dòng, mới nhất ở trên; trên web chỉ xem).
- Số liệu gần đúng: 2 lượt xem đúng cùng lúc có thể chỉ đếm 1; xoá dữ liệu trình duyệt hoặc dùng tab ẩn danh thì được đếm như khách mới. Quá 10.000 lượt xem một ngày (`VISIT_MAX_PER_DAY`, VD bị spam) thì ngừng đếm tới hôm sau.
- Chỉ đếm từ lúc đưa bản web này lên, không có số liệu cũ. Kiểm tra: mở web bằng tab ẩn danh rồi chạy **SmartCarTech → Kiểm tra cài đặt…**, dòng *Đếm khách truy cập* báo số lượt xem hôm nay.

### Đưa file kế hoạch Excel vào Google Sheet

File `source plan/SmartCarTech_Plan.xlsx` (10 trang: Video Creation, Product, Customer Infor, Affiliate, Assembly Instruction, Commercial video, Note_Buy, Contact, Tips) được nhập vào chính Google Sheet đơn hàng. Mọi thứ nằm một chỗ, xem và sửa được trên trang quản trị.

1. Làm bước dự phòng ở trên (đặt tên phiên bản hiện tại).
2. Mở Google Sheet của shop → **Tệp → Nhập → Tải lên** → chọn file `SmartCarTech_Plan.xlsx`.
3. Ở **Nhập vị trí**, chọn **Chèn trang tính mới**. Không tích **Nhập giao diện**: ô đó thay giao diện cả bảng tính, có thể đổi định dạng các trang đang có. Bấm **Nhập dữ liệu**.
   - **Không chọn "Thay thế bảng tính"**: lựa chọn đó xoá hết đơn hàng, mã tải code đang có.
4. 10 trang tính mới được thêm vào cuối, giữ công thức, màu, ô gộp. Các trang Đơn hàng, Tư vấn, In 3D, Mã tải code không bị đụng tới. Mở các trang có hình (Product, Assembly Instruction, Commercial video) xem hình đã sang đủ chưa; thiếu thì chèn lại trên Sheet.

- Từ đây sửa kế hoạch trên Google Sheet hoặc trang quản trị. File Excel trên máy chỉ còn là bản lưu.

### Gộp "Customer Infor" vào "Đơn hàng"

Sau khi nhập file Excel, gộp danh sách đơn cũ (Shopee, TikTok…) vào trang Đơn hàng để mọi đơn nằm trong một bảng.

1. Làm bước dự phòng ở trên nếu chưa làm (đặt tên phiên bản hiện tại).
2. Tải lại trang Google Sheet → **SmartCarTech → Gộp Customer Infor vào Đơn hàng…**. Mục này chỉ hiện khi Sheet có trang Customer Infor, và chạy được ngay sau khi Lưu script, không cần triển khai.
3. Cửa sổ cho biết sẽ thêm cột nào, bao nhiêu dòng mới, dòng nào trùng đơn đã có. Đọc rồi bấm **Có**. Bấm **Không** thì chưa có gì được ghi.
4. Kiểm tra trang Đơn hàng. Đúng rồi thì xoá trang Customer Infor: mục trong menu tự mất ở lần mở Sheet sau. Gộp sai thì khôi phục phiên bản đã đặt tên ở **Tệp → Lịch sử phiên bản**.

| Customer Infor | Đơn hàng |
|---|---|
| Ngày | Thời gian |
| Tên | Họ tên |
| Số ĐT | SĐT |
| Địa Chỉ | Địa chỉ |
| Sản Phẩm | Sản phẩm |
| Tổng tiền sản phẩm | Tổng (₫) |
| Note | Ghi chú |
| Thứ tự, Nền tảng, Email, Tiền thu người nhận, Doanh thu sau điều chỉnh, Chi phí, Lợi nhuận | Cột mới, thêm vào cuối bảng, giữ nguyên tên |

Cột sau này mới thêm vào Customer Infor cũng theo quy tắc đó: cùng tên thì vào cột có sẵn, chưa có thì thêm vào cuối.

**Cách gộp:**

- Các ô đang có ở Đơn hàng không bị sửa, các cột cũ giữ nguyên vị trí, trang Customer Infor giữ nguyên.
- Dòng chưa có: thêm mới, xếp đúng vị trí theo ngày. Mã đơn để trống vì Customer Infor không có mã; muốn gán mã tải code cho đơn đó thì điền Mã đơn trước.
- Dòng trùng đơn đã có (cùng ngày và cùng SĐT, cùng tên, hoặc cùng địa chỉ kèm sản phẩm hay tổng tiền): không thêm dòng, chỉ điền các ô còn trống. Ô đã có mà khác thì giữ nguyên, giá trị của Customer Infor được ghi vào ghi chú của ô đó.
- Có thể trùng nhưng chưa chắc (VD cùng SĐT khác ngày, có thể là khách cũ mua lại): vẫn thêm mới, cột Kiểm tra nhắc xem lại. Trùng thật thì xoá 1 dòng.
- Đổi cho giống các đơn khác: "N/A" thành ô trống, SĐT về dạng 0… (VD `(+84)912345678` → `0912345678`). Dòng chỉ có số thứ tự bị bỏ qua.
- Lợi nhuận vẫn là công thức Doanh thu − Chi phí của chính dòng đó, tính theo cột mới.
- Chạy lại không tạo dòng trùng, chỉ thêm phần chưa có (VD dòng mới ghi thêm vào Customer Infor).

**Sau khi gộp:**

- Đơn web có sẵn và đơn web mới ghi Nền tảng là `Website`. Đơn mới tự ghi cần triển khai phiên bản mới của script (mục 5, *Sửa script sau này*).
- Các cột tiền của đơn mới để trống, shop tự điền, trên trang quản trị hay trên Sheet đều được (riêng Chi phí tự ghi theo trang Chi Phí, xem *Chi phí sản phẩm*). Điền đủ Doanh thu và Chi phí thì Lợi nhuận tự tính.
- Xoá 1 trong 2 số đó thì Lợi nhuận trống lại. Ô Lợi nhuận shop tự gõ số hoặc công thức khác trên Google Sheet thì được giữ nguyên. Trên trang quản trị ô Lợi nhuận chỉ xem.
- Tự tính khi sửa trên Sheet chạy ngay sau khi Lưu script; khi sửa trên trang quản trị thì cần triển khai phiên bản mới.

## 7. Ghi chú kỹ thuật

- **Giao diện co giãn:** thiết kế cho 390px (mobile) và 1440px (desktop). Khoảng cách và cỡ chữ co giãn mượt giữa hai mốc này bằng `clamp()`. Bố cục đổi ở 768px và 1024px, riêng phần đầu trang chủ đổi ở 1200px.
- **Mọi màu, font, bo góc, khoảng cách** được khai báo ở phần `:root` đầu file `style.css`.
- **SEO:**
  - Mỗi trang có title và description riêng.
  - Trang Sản phẩm và Hướng dẫn tự đổi title theo dòng xe đang chọn.
  - Có dữ liệu cấu trúc Product và FAQ (JSON-LD).
  - Trang Đặt hàng đặt `noindex` để không hiện trên Google. Trang quản trị đặt `noindex, nofollow` và không có trong `sitemap.xml`.
- **Trang quản trị:** `quan-tri.html` có Content-Security-Policy, chỉ cho chạy script của chính web và chỉ gửi dữ liệu tới Google Apps Script. Trang không mở được khi bị trang khác nhúng vào khung. Mọi quyền đọc, ghi nằm ở script: không có mã phiên còn hạn thì script không trả dữ liệu, dù ai cũng mở được file HTML. Mã 2 bước theo chuẩn TOTP (RFC 6238: HMAC-SHA1, 6 số, 30 giây), cùng cách tính với Google Authenticator.
- **Ảnh:** định dạng WebP, `loading="lazy"` (trừ ảnh đầu trang) và có `alt` đầy đủ.
- **Trình duyệt hỗ trợ:** Chrome, Edge, Safari, Firefox bản từ 2023 trở lên.
