# Tư liệu SC Tech Pro

## Dự án và phạm vi thay đổi

Website tĩnh gồm 5 trang HTML, CSS chung và JavaScript ES modules, không có bước build hay thư viện JavaScript ngoài. `products.json` chứa hai dòng xe và ba bộ linh kiện mỗi dòng, giá, link mua, thông số, FAQ, ảnh, video và tài liệu hướng dẫn. `core.js` tải dữ liệu, xử lý menu, giỏ hàng localStorage, SEO và luồng sao chép đơn để gửi qua Zalo. `home.js`, `product.js`, `guide.js`, `checkout.js` và `policy.js` xử lý từng trang. Google Apps Script là tích hợp lưu đơn tùy chọn; endpoint hiện để trống.

Lần cập nhật này bổ sung media SC Tech Pro trên trang chủ, sản phẩm, hướng dẫn, giỏ hàng và trang đặt hàng. Gallery đổi theo bộ đang chọn, hỗ trợ MP4 và nhiều video, vẫn tương thích trường YouTube cũ. Giá, link mua, thông số phần cứng, video hướng dẫn YouTube và dữ liệu dòng SC Tech được giữ nguyên.

Nguồn có 51 ảnh JPG (gồm `All.jpg` mới bổ sung) và 5 video HEVC, chia thành ba bộ. Toàn bộ file gốc được giữ nguyên. Ảnh master PNG đã hậu kỳ nằm trong `source image and video/SC Tech Pro/edited/`; các bản WebP và MP4 phục vụ website nằm trong `assets/`. Tư liệu gốc, master, script và báo cáo không được đưa lên GitHub Pages.

## Ảnh đã chọn

Các đường dẫn nguồn dưới đây tính từ `source image and video/SC Tech Pro/`. File WebP tính từ `assets/img/sc-tech-pro/`.

| Nguồn | WebP | Mục đích |
|---|---|---|
| `SC Tech Pro day du/20260418_143846.jpg` | `toan-canh.webp` | Góc trước bên trái; thẻ trang chủ, bộ đầy đủ, ảnh hướng dẫn |
| `SC Tech Pro day du/All.jpg` | `linh-kien-day-du.webp` | Linh kiện rời của bộ đầy đủ; ảnh thứ hai trong gallery bộ đầy đủ |
| `SC Tech Pro day du/20260418_144002.jpg` | `mat-truoc.webp` | Ba module siêu âm phía trước và đèn LED |
| `SC Tech Pro day du/20260418_144016.jpg` | `mach-va-pin.webp` | Góc từ trên: Arduino, Bluetooth, driver, nguồn và pin |
| `SC Tech Pro day du/20260418_143937.jpg` | `mat-sau.webp` | Bốn pin và một module siêu âm phía sau |
| `Khung Xe_Dong Co_Banh Xe/20260418_150442.jpg` | `khung-dong-co-banh.webp` | Mẫu khung kèm động cơ và bánh đã lắp |
| `Khung Xe_Dong Co_Banh Xe/20260418_143437.jpg` | `linh-kien-khung-dong-co-banh.webp` | Linh kiện rời: tấm khung, nắp, bốn bánh, bốn động cơ, phụ kiện |
| `Khung Xe/20260418_153513.jpg` | `khung.webp` | Mẫu chỉ khung đã lắp |
| `Khung Xe/20260418_143635.jpg` | `linh-kien-khung.webp` | Hai tấm khung, nắp trong và túi phụ kiện |

Các ảnh trùng góc, có tay che sản phẩm hoặc có quá nhiều bàn, cửa sổ và dây bên ngoài được giữ làm nguồn tham khảo, không đưa thêm vào gallery. Hai ảnh có laptop hiện chưa đưa vào bộ ảnh để giữ gallery tập trung vào sản phẩm.

Ảnh được hậu kỳ bằng công cụ **image_gen tích hợp**, thay nền vải xanh/bàn gỗ bằng nền studio than tối, giảm ám xanh, cân bằng sáng và giữ bố cục sản phẩm. Không dùng CLI/API image generation. Mỗi ảnh có bản lớn, bản `-640.webp` và thumbnail `-thumb.webp`. Các thao tác xuất WebP chỉ đổi định dạng và giảm kích thước; không chỉnh nội dung bằng Python.

`All.jpg` được thay nền trắng bằng nền studio than tối phủ kín khung 1536 × 1024, giữ bố cục linh kiện rời với khoảng nền hai bên. Huy hiệu trên ảnh này được ẩn để không che linh kiện ở mobile. Trang sản phẩm có lưu ý theo bộ đang chọn, ngay trước giá: bộ đầy đủ giao linh kiện rời để khách tự lắp theo hướng dẫn, shop không giao xe lắp sẵn. Ghi chú ở thẻ trang chủ và caption ảnh cũng nêu rõ việc tự lắp.

**Giới hạn:** hậu kỳ bằng AI không bảo đảm giữ từng pixel, chữ in nhỏ hay số trên màn hình điện áp. Ảnh dùng để giới thiệu hình thức sản phẩm; không dùng ảnh hậu kỳ làm sơ đồ đấu dây hoặc tài liệu xác định thông số. Video giữ hình quay thật để người xem đối chiếu cấu tạo.

## Video đã dựng

Các file nằm trong `assets/video/sc-tech-pro/`, kèm poster WebP cùng tên.

| Clip | Nguồn và đoạn chọn (giây) | Đầu ra |
|---|---|---|
| `cau-tao.mp4` | `video 3.mp4`: 1.0–4.5, 7.0–9.5, 17.7–21.5 | Khoảng 10 giây, dọc 720 × 1280; nền gỗ |
| `khung.mp4` | `Khung Xe/video 1.mp4`: 2.2–10.2, 15.2–19.2, 24.0–27.0 | 15 giây, dọc 720 × 1280 |

`video 3` nằm trong thư mục `SC Tech Pro day du`. Các video `2`, `4`, `5` quay trên phông xanh đã bị loại khỏi lựa chọn phục vụ website theo yêu cầu của người dùng. `cau-tao.mp4` được dựng lại trực tiếp từ `video 3`, không lấy cảnh từ bản ghép nền.

FFmpeg cắt/ghép đoạn, chỉnh sáng/màu nhẹ, giảm nhiễu nhẹ, fade đầu/cuối 0,25 giây; xuất H.264, yuv420p, 30 fps, MP4 faststart. Chiều quay được áp dụng vào hình, không phụ thuộc metadata xoay HEVC. Các clip giới thiệu không có âm thanh; không thêm nhạc hoặc thuyết minh. Không tạo thêm chuyển động bằng AI. Tư liệu hiện tại giới thiệu cấu tạo, chưa có cảnh xe chạy, điều khiển qua app hoặc tự tránh vật cản.

### Chỉ giữ video không có phông xanh

Người dùng không chọn bản thay nền vì chất lượng chưa phù hợp. Clip `gioi-thieu.mp4` và poster của nó đã được gỡ khỏi `assets/` và gallery. Đoạn phông xanh từ `video 5` đã được bỏ khỏi `cau-tao.mp4`; clip này hiện là video chính của bộ đầy đủ, hiển thị thời lượng `0:10`. Poster được xuất lại từ cảnh nền gỗ.

Script xuất chỉ dùng `video 1` và `video 3`, giữ nền quay gốc. Đã bỏ bước tách/ghép nền và dependency OpenCV/numpy khỏi quy trình xuất. Các ảnh hậu kỳ và clip chỉ khung giữ nguyên.

Các bản ghép nền bị loại và script thử nghiệm được lưu trong `source image and video/SC Tech Pro/edited/rejected-green-exports/`; các cache thử nghiệm cũ ở `edited/video-background/` chỉ để lưu trữ, không dùng khi xuất và không được đưa lên hosting. Toàn bộ file nguồn được giữ nguyên. Link so sánh nền cũ chuyển về trang sản phẩm hiện tại.

## Prompt hậu kỳ

Toàn bộ prompt cuối cùng cho từng ảnh lưu trong `source image and video/SC Tech Pro/edited/retouch-prompts.json`, gồm file nguồn, tên đầu ra, công cụ và prompt nguyên văn. Ảnh nguồn là **edit target**; ảnh toàn cảnh đã hậu kỳ chỉ làm tham chiếu nền cho các ảnh tiếp theo.

Prompt và tham chiếu hậu kỳ `All.jpg` lưu riêng tại `edited/linh-kien-day-du-prompt.json`; master tại `edited/linh-kien-day-du.png`. Ảnh `linh-kien-khung-dong-co-banh.webp` chỉ được dùng làm tham chiếu nền/ánh sáng.

Yêu cầu chung: thay **chỉ nền**, nền studio matte charcoal `#111a22`, bóng tiếp xúc nhẹ, giảm ám xanh, cân bằng trắng/sáng; giữ góc chụp, tỷ lệ khung, linh kiện, dây, vít và mica; có khoảng trống quanh sản phẩm, không chữ/logo mới, không phản chiếu giả hoặc thêm vật thể. Yêu cầu riêng: ảnh mặt trước giữ sáu vòng transducer; mặt sau giữ hai vòng; ảnh khung không thêm bánh/mạch; ảnh bộ khung có bánh không thêm pin/cảm biến; ảnh linh kiện rời giữ đúng số tấm, bánh và động cơ.

## Xuất lại và cập nhật sau

Máy dùng để xuất cần Python, Pillow, FFmpeg và FFprobe. Website chạy độc lập với các công cụ này.

```powershell
python scripts/prepare-sc-tech-pro-media.py
```

Script đọc master PNG và video gốc, bỏ qua đầu ra đã có. `--images-only` / `--videos-only` chọn loại cần xuất. `--force` chỉ thay bản dẫn xuất trong `assets/`, không ghi đè file nguồn.

Ảnh bìa đã được chọn lại tại giây 0,8 của clip cấu tạo và giây 5,3 của clip khung để thấy trọn sản phẩm. Dùng `--posters-only --force` để cập nhật riêng ảnh bìa mà không mã hóa lại MP4; có thể kết hợp `--video` để chọn clip. Các mốc nằm trong `POSTER_TIMES` của script xuất. Bản poster trước đó lưu tại `edited/previous-posters/` trong thư mục nguồn.

Xuất lại riêng clip cấu tạo không có phông xanh:

```powershell
python scripts/prepare-sc-tech-pro-media.py --videos-only --force --video cau-tao
```

MP4 mới được render xong vào file tạm rồi mới thay bản phục vụ website. `--video` có thể lặp lại để chọn `cau-tao` hoặc `khung`; không chọn thì xuất cả hai clip đang sử dụng.

`lines[].video` là clip đầu, `lines[].videos[]` là clip bổ sung. Bộ có `kits[].gallery` riêng dùng media riêng, không kế thừa clip của xe đầy đủ; có thể thêm `kits[].video` và `kits[].videos[]` khi có tư liệu. `kits[].image` được dùng cho thẻ trang chủ, giỏ hàng và trang đặt hàng. Ảnh gallery có `src_small` trỏ tới bản `-640.webp`; trang Sản phẩm đưa bản này vào `srcset`. Đo trên Chrome ở khung 390 px: màn hình 1× tải bản 640 px, còn màn hình 2×–3× (đa số điện thoại) vẫn tải bản lớn để ảnh không bị mờ.

SC Tech chờ ảnh/video gốc ở lần cập nhật sau. Hình chia sẻ mạng xã hội `og-image.jpg` hiện vẫn dùng thiết kế cũ.

## Kiểm tra

- JSON hợp lệ và `git diff --check`.
- Kiểm tra file ảnh/video được tham chiếu tồn tại; xác minh dữ liệu SC Tech và giá/link/thông số từ bản gốc Git.
- Sau khi thêm `All.jpg`: **73 kiểm tra Chrome đều đạt**, gồm năm ảnh/một clip ở bộ đầy đủ, ảnh linh kiện ở vị trí thứ hai, ghi chú tự lắp hiển thị đúng theo bộ/dòng, huy hiệu không che linh kiện và chức năng gallery/giỏ hàng/đặt hàng. Rà soát ba ảnh chụp desktop 1440 px/mobile 390 px, gồm ghi chú trước giá và nút mua. Kết quả lưu tại `tmp/media-review/all-kit/`.
- Ba WebP mới giải mã được ở 1536 × 1024, 640 × 427 và 324 × 216; 40 đường dẫn asset trong `products.json` tồn tại. SHA-256 của `All.jpg`, 24 WebP cũ, hai MP4 và hai poster không đổi so với trước khi thêm ảnh mới. Dữ liệu SC Tech, giá, link, thông số và video được đối chiếu với bản trước khi thêm `All.jpg`. Tổng media hiện tại là 8.251.892 byte (khoảng 7,87 MiB).
- Chrome headless trước khi thêm `All.jpg`: **56 kiểm tra đều đạt** với bản chỉ giữ nền quay gốc, gồm gallery bộ đầy đủ có bốn ảnh/một clip, thời lượng `0:10`, phát hai MP4, chuyển ảnh/bộ/dòng, giỏ hàng/đặt hàng, trang hướng dẫn/chính sách và không tràn ngang ở 390 px.
- Trước khi thêm `All.jpg`, 51 đường dẫn file cục bộ được tham chiếu đều tồn tại; 24 bản WebP, hai poster và cả hai MP4 giải mã được. Tổng media SC Tech Pro sau khi chọn lại poster là 8.033.546 byte (khoảng 7,66 MiB).
- Khi làm mới ảnh bìa, SHA-256 của 5 video nguồn, 24 ảnh WebP và hai MP4 không đổi. Đã rà soát tám frame xuyên suốt clip cấu tạo mới, gồm các điểm chuyển đoạn; các vùng nền mẫu không có phông xanh.
- Ảnh bìa mới được kiểm tra trên Chrome cho cả bộ đầy đủ và bộ chỉ khung ở desktop 1440 px/mobile 390 px: tải đúng poster, thời lượng và gallery đúng, không tràn ngang. Đã rà soát ảnh chụp của bốn trường hợp này.
- Đã sửa dải nền trống hai bên gallery bằng `object-fit: cover` cho ảnh. Rà soát đủ tám ảnh ở desktop 1686 px/mobile 390 px: ảnh phủ kín khung, chỉ cắt nền thừa và vẫn thấy trọn sản phẩm/linh kiện. Hai ảnh bìa video tiếp tục dùng `contain`; 20 trường hợp ảnh/ảnh bìa đều đạt, 56 kiểm tra chức năng được chạy lại và đạt. Ảnh chụp và kết quả lưu trong `tmp/media-review/gallery-fit/`.
- Các kết quả kiểm tra thay nền trước đây được lưu riêng trong `tmp/media-review/keying/`, chỉ là lịch sử thử nghiệm.
- Kiểm tra mới cho bản chỉ giữ nền quay gốc được lưu trong `tmp/media-review/no-green/`. Chưa kiểm thử trên thiết bị iOS/Android thật.
