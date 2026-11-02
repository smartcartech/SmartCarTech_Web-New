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
   - email báo đơn gửi tới đâu, hôm nay còn gửi được bao nhiêu email;
   - thư mục code và các file trong đó có đang ở chế độ **Bị hạn chế** không;
   - các trang **Mã tải code**, **Tư vấn**, **Nhật ký quản trị** có đủ cột script cần không. Dòng ✗ cho biết thiếu cột nào và dòng 1 của trang đó đang ghi gì.

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
- **Sắp xếp lại cột:** ở các trang Đơn hàng, Tư vấn, In 3D, Mã tải code và Nhật ký quản trị, kéo tiêu đề cột để đổi chỗ, hoặc chèn thêm cột của shop, đều được: script tìm cột theo tên ở dòng 1. Dòng 1 phải luôn là tên cột, và đừng đổi tên các cột script dùng:
  - **Mã tải code** (tên cũ `Mã` cũng được), **Khoá**, **Số lần tải** ở trang Mã tải code: đổi tên thì script dừng để không mở nhầm mã đã khoá. Khách không tải được code, web báo thiếu cột nào. Tạo mã, in thẻ, gán mã cũng dừng và báo như vậy. Đổi lại đúng tên là chạy lại ngay (gõ `Khóa` hay `KHOÁ` cũng được).
  - Các cột khác: script thêm lại cột mang tên cũ ở cuối bảng và ghi dữ liệu mới vào đó. Dữ liệu cũ vẫn nằm ở cột vừa đổi tên.
- **Sửa script sau này:** sửa trong trình soạn Apps Script, rồi vào **Triển khai → Quản lý các lần triển khai**, bấm biểu tượng bút chì, chọn Phiên bản **Phiên bản mới** → **Triển khai**. Làm vậy thì URL giữ nguyên. Nếu chọn "Tùy chọn triển khai mới", URL sẽ đổi và phải dán lại vào `products.json`.
  - Menu trên Sheet (tạo mã, in thẻ) và phần gán mã cho đơn luôn chạy bản vừa **Lưu**, không cần triển khai lại. Tải lại trang Sheet để script thêm các cột mới. Chỉ phần web dùng (lưu đơn, tải code) mới cần triển khai phiên bản mới.
  - Dán đè toàn bộ bằng bản script mới thì nhớ điền lại `NOTIFY_EMAIL` và `CODE_FOLDER_ID`.
  - Dán bản mới, bấm **Lưu** xong thì tải lại Sheet và chạy **SmartCarTech → Kiểm tra cài đặt…** *trước khi* triển khai. Bản mới cần thêm quyền thì Google hỏi ở bước này.

## 6. Trang quản trị (chỉ admin)

Mở `smartcartech.vn/quan-tri.html`, đăng nhập, rồi xem và sửa dữ liệu Google Sheet của shop ngay trên web, trên điện thoại cũng được, không cần mở Google Sheet. Web không có link nào tới trang này, Google cũng không hiện trang này khi tìm kiếm.

**Làm được gì:**

- Xem mọi trang tính trong Sheet: Đơn hàng, Tư vấn, In 3D, Mã tải code, các trang kế hoạch nhập từ Excel (xem *Đưa file kế hoạch Excel vào Google Sheet* bên dưới) và trang Nhật ký quản trị. Màu nền, màu chữ, chữ đậm, ô gộp hiện như trên Sheet.
  - Danh sách trang tính nằm ở cột bên trái, cuộn lên xuống được. Nút ☰ ẩn cột này để bảng rộng hơn; trên điện thoại, nút ☰ mở danh sách.
  - Ghi chú của từng trang gom ở nút *Lưu ý* cạnh tên trang.
- Bấm số dòng hoặc một ô: cả dòng mở ở khung bên phải. Sửa rồi bấm **Lưu thay đổi**.
  - Ô thả xuống (VD *Trạng thái* ở trang In 3D) và ô tích (VD *Khoá* ở trang Mã tải code) hiện đúng như trên Sheet.
  - Ô công thức hiện công thức để sửa, kèm kết quả hiện tại.
- **Thêm dòng**: thêm vào cuối trang tính, VD đơn Shopee, đơn Zalo. Ô thả xuống, ô tích lấy theo dòng cuối hiện có.
- **Xoá dòng**: nút ở cuối khung, bấm thêm một lần để xác nhận.
- Ô tìm kiếm lọc các dòng có chữ đó, không cần gõ dấu: gõ "binh" tìm được "Bình".
- Ghi đúng kiểu như khi gõ trên Sheet: SĐT giữ số 0 ở đầu, mã đơn dài giữ dạng chữ, ô số nhận "2.980.000", ô ngày nhận "31/10/2026 14:30".

**Dữ liệu được giữ an toàn:**

- Mỗi lần lưu, script kiểm tra dòng đó có bị đổi ở nơi khác từ lúc mở không: VD vừa sửa trên Google Sheet, có đơn mới, hay vừa xoá một dòng phía trên. Nếu có, web không ghi gì, tải lại dữ liệu mới, rồi hiện lại nội dung bạn vừa gõ để làm lại.
- Dòng 1 (tên cột) của các trang Đơn hàng, Tư vấn, In 3D, Mã tải code chỉ sửa được trên Sheet, vì script tìm cột theo tên để ghi đơn.
- Trang Mã tải code không thêm, xoá dòng trên web được, vì mã đã in trên thẻ. Cột Mã tải code, Mã đơn, Khách hàng chỉ xem. Tạo mã, in thẻ vẫn làm ở menu SmartCarTech. Muốn ngừng một mã: tích ô Khoá.
- Sửa cột Mã tải code (hoặc Mã đơn, Họ tên, SĐT) ở trang Đơn hàng trên web thì script gán mã y như khi gõ trên Sheet.
- Mọi lần đăng nhập, sửa ô, thêm, xoá dòng được ghi ở trang tính **Nhật ký quản trị** (script tự tạo; trên web chỉ xem). Dòng bị xoá được lưu đủ nội dung ở cột *Trước*: lỡ tay xoá thì chép lại từ đây. Script không ghi được nhật ký thì cũng không xoá dòng.
- Google Sheet cũng giữ mọi thay đổi ở **Tệp → Lịch sử phiên bản**.
- Hình ảnh đặt trên trang tính và định dạng (màu, cỡ chữ, độ rộng cột) chỉ sửa trên Google Sheet.
- Trang tính rất lớn (hơn 40.000 ô, `ADMIN_MAX_CELLS` trong script): web chỉ hiện các dòng cuối, dòng cũ hơn xem trên Sheet.

**Tài khoản, đăng nhập:**

- Tạo tài khoản trong Google Sheet: menu **SmartCarTech → Tài khoản trang quản trị…**. Nhập tên đăng nhập (chữ không dấu) và mật khẩu ít nhất 10 ký tự, hoặc bấm *Tạo mật khẩu mạnh* rồi chép lại. Bấm **Lưu tài khoản**. Tạo được nhiều tài khoản, VD mỗi người một tài khoản.
- Quên hoặc muốn đổi mật khẩu: nhập lại tên đó với mật khẩu mới. Mọi nơi đang đăng nhập bằng tài khoản đó bị đăng xuất. Xoá tài khoản: bấm *Xoá* 2 lần.
- Mật khẩu chỉ lưu dạng mã hoá trong script (Script Properties), không nằm trong kho GitHub hay trên web: không ai xem lại được mật khẩu, kể cả chủ Sheet.
- Sai mật khẩu 5 lần trong 15 phút thì tài khoản đó tạm khoá 15 phút. Cả web sai 30 lần thì mọi tài khoản tạm khoá 15 phút. Như vậy không ai dò được mật khẩu. Bị khoá mà cần gấp thì mở thẳng Google Sheet.
- Phiên đăng nhập chỉ giữ trong tab đang mở: đóng tab là phải đăng nhập lại. Không thao tác 3 giờ (`ADMIN_IDLE_HOURS`) hoặc dùng quá 12 giờ (`ADMIN_MAX_HOURS`) cũng phải đăng nhập lại. Đang sửa dở thì khung đăng nhập hiện đè lên: đăng nhập xong bấm Lưu lần nữa, nội dung đang sửa không mất.
- Ai được chia sẻ quyền **sửa** Google Sheet thì cũng mở được Apps Script và menu tạo tài khoản: chỉ chia sẻ quyền sửa cho người tin cậy.

**Cài đặt (làm một lần, theo đúng thứ tự):**

1. Dự phòng: mở Google Sheet → **Tệp → Lịch sử phiên bản → Đặt tên cho phiên bản hiện tại**, VD "Trước trang quản trị".
2. Dán bản `google-apps-script.gs` mới vào Apps Script, điền lại `NOTIFY_EMAIL` và `CODE_FOLDER_ID`, bấm **Lưu**.
3. Tải lại Sheet → **SmartCarTech → Kiểm tra cài đặt…** (Google hỏi cấp quyền thì làm như mục 5, bước 7). Dòng cuối báo chưa có tài khoản trang quản trị là đúng.
4. **SmartCarTech → Tài khoản trang quản trị…** → tạo tài khoản. Chạy lại *Kiểm tra cài đặt…*: dòng cuối có ✓ và tên tài khoản.
5. Triển khai phiên bản mới (mục 5, *Sửa script sau này*). URL giữ nguyên, không phải sửa `products.json`.
6. Đưa web lên, rồi mở `smartcartech.vn/quan-tri.html` và đăng nhập.

Web lên trước khi triển khai script mới thì trang quản trị báo "chưa có bản mới"; các phần khác của web vẫn chạy bình thường.

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
- Các cột tiền của đơn mới để trống, shop tự điền, trên trang quản trị hay trên Sheet đều được. Điền đủ Doanh thu và Chi phí thì Lợi nhuận tự tính.
- Xoá 1 trong 2 số đó thì Lợi nhuận trống lại. Ô Lợi nhuận shop tự gõ số hoặc công thức khác thì được giữ nguyên.
- Tự tính khi sửa trên Sheet chạy ngay sau khi Lưu script; khi sửa trên trang quản trị thì cần triển khai phiên bản mới.

## 7. Ghi chú kỹ thuật

- **Giao diện co giãn:** thiết kế cho 390px (mobile) và 1440px (desktop). Khoảng cách và cỡ chữ co giãn mượt giữa hai mốc này bằng `clamp()`. Bố cục đổi ở 768px và 1024px, riêng phần đầu trang chủ đổi ở 1200px.
- **Mọi màu, font, bo góc, khoảng cách** được khai báo ở phần `:root` đầu file `style.css`.
- **SEO:**
  - Mỗi trang có title và description riêng.
  - Trang Sản phẩm và Hướng dẫn tự đổi title theo dòng xe đang chọn.
  - Có dữ liệu cấu trúc Product và FAQ (JSON-LD).
  - Trang Đặt hàng đặt `noindex` để không hiện trên Google. Trang quản trị đặt `noindex, nofollow` và không có trong `sitemap.xml`.
- **Trang quản trị:** `quan-tri.html` có Content-Security-Policy, chỉ cho chạy script của chính web và chỉ gửi dữ liệu tới Google Apps Script. Trang không mở được khi bị trang khác nhúng vào khung. Mọi quyền đọc, ghi nằm ở script: không có mã phiên còn hạn thì script không trả dữ liệu, dù ai cũng mở được file HTML.
- **Ảnh:** định dạng WebP, `loading="lazy"` (trừ ảnh đầu trang) và có `alt` đầy đủ.
- **Trình duyệt hỗ trợ:** Chrome, Edge, Safari, Firefox bản từ 2023 trở lên.
