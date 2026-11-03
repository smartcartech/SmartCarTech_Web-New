/**
 * SmartCarTech — Google Apps Script cho website. Hướng dẫn cài từng bước: README.md, mục 5.
 *
 * Script này làm 4 việc:
 * 1. Lưu đơn hàng & yêu cầu tư vấn từ web vào Google Sheet: mỗi đơn là 1 dòng ở trang tính
 *    "Đơn hàng", mỗi yêu cầu tư vấn ở trang tính "Tư vấn". Đơn bảng tên, giá đỡ điện thoại và yêu cầu in theo
 *    file từ trang In 3D (in-3d.html) ở trang tính "In 3D", có cột "Trạng thái" để shop theo dõi từng đơn.
 *    Web chờ script trả về "ok" (đã lưu) mới báo khách "Đã gửi" — khách không nhắn Zalo nữa,
 *    nên điền NOTIFY_EMAIL để biết khi có đơn mới.
 *    Ai cũng gửi thẳng được tới script, nên script không tin số liệu gửi lên: tên sản phẩm và tổng tiền
 *    tính lại theo products.json trên website (tổng web gửi khác giá đúng thì ghi ở cột "Kiểm tra"),
 *    dữ liệu sai dạng bị bỏ, gửi dồn dập (VD bị spam) bị chặn tạm thời — khách vẫn có nút gửi qua Zalo.
 * 2. Chỉ người mua mới tải được code mẫu: khách nhập mã in trên thẻ trong hộp, script tìm mã ở
 *    trang tính "Mã tải code", đúng thì mới gửi file .zip từ thư mục Google Drive riêng tư.
 *    Tạo mã mới: menu "SmartCarTech" → "Tạo mã tải code…" ngay trên Google Sheet.
 *    In thẻ bỏ vào hộp: bôi chọn các mã → menu "SmartCarTech" → "In thẻ cho các mã đang chọn…".
 *    Biết khách nào nhận mã nào: gõ mã của thẻ vào cột "Mã tải code" của đơn ở trang "Đơn hàng",
 *    script tự điền "Mã đơn" và "Khách hàng" ở trang "Mã tải code".
 * 3. Trang quản trị (smartcartech.vn/quan-tri.html): admin đăng nhập bằng tài khoản tạo ở menu "SmartCarTech" →
 *    "Tài khoản trang quản trị…", rồi xem, sửa, thêm, xoá dòng của mọi trang tính ngay trên web (kể cả các trang
 *    kế hoạch nhập từ Excel). Dòng tiêu đề và các cột script tự điền chỉ sửa được trên Sheet. Mọi lần đăng nhập, sửa,
 *    thêm, xoá được ghi ở trang tính "Nhật ký quản trị"; dòng bị xoá được lưu đủ nội dung để chép lại.
 *    Nên bật mã 2 bước cho từng tài khoản (ứng dụng xác minh trên điện thoại, cũng ở menu đó). Đăng nhập từ trình duyệt
 *    lạ, hay bị khoá vì nhập sai nhiều lần, thì có email báo tới NOTIFY_EMAIL. Tắt hẳn trang quản trị khi không dùng:
 *    menu "SmartCarTech" → "Bật hoặc tắt trang quản trị…".
 * 4. Trang tính "Tổng quan": lợi nhuận, doanh thu, số đơn theo nền tảng, khách truy cập theo tháng, năm, có biểu đồ; xem
 *    được cả trên trang quản trị. Khách truy cập do web đếm ẩn danh (không cookie, không lưu IP), lưu ở trang "Lượt truy cập".
 *
 * Cách cài tóm tắt:
 * 1. Tạo 1 Google Sheet mới → Tiện ích mở rộng (Extensions) → Apps Script.
 * 2. Xóa code mẫu, dán toàn bộ file này vào, điền 2 dòng cấu hình bên dưới, bấm Lưu.
 * 3. Triển khai (Deploy) → Tùy chọn triển khai mới → loại "Ứng dụng web" (Web app):
 *    Thực thi dưới dạng: Tôi (Me) · Người có quyền truy cập: Bất kỳ ai (Anyone).
 * 4. Cấp quyền, copy "URL ứng dụng web" (https://script.google.com/macros/s/.../exec)
 *    rồi dán vào products.json → "site" → "order_endpoint".
 * 5. Tải lại Google Sheet → menu "SmartCarTech" → "Kiểm tra cài đặt…": cấp quyền đọc products.json và xem
 *    email, thư mục code đã đúng chưa. Mỗi lần dán bản script mới cũng chạy lại mục này rồi mới triển khai.
 *
 * Chỉ điền email và ID thư mục trong trình soạn Apps Script. Đừng sửa file này trong kho GitHub:
 * kho đang để công khai, ai cũng đọc được.
 */

const NOTIFY_EMAIL = '';   // VD: 'shop@gmail.com' — nên điền: nhận email mỗi khi có đơn hàng / yêu cầu tư vấn / yêu cầu in 3D mới
const CODE_FOLDER_ID = ''; // ID thư mục Google Drive chứa các file .zip code mẫu (giữ chế độ "Bị hạn chế")
const MAX_DOWNLOADS = 20;  // Mỗi mã tải được tối đa bao nhiêu lượt (tính chung mọi file)
const MAX_SENDS_PER_10_MIN = 30; // Đơn + yêu cầu tư vấn + yêu cầu in 3D mỗi 10 phút. Quá mức (VD bị spam), web báo khách "chưa gửi được" và mời nhắn Zalo
const MAX_SENDS_PER_PHONE = 5;   // Mỗi SĐT gửi tối đa bao nhiêu lần trong 10 phút
const MAX_EMAILS_PER_HOUR = 10;  // Email báo shop mỗi giờ. Quá mức thì gửi 1 email nhắc mở Sheet, rồi dừng đến đầu giờ sau

const CODE_SHEET = 'Mã tải code';
const PRINTED_COL = 'Đã in';
const CODE_ID_COL = 'Mã tải code'; // Cột chứa mã
const CODE_ID_OLD_COL = 'Mã';      // Tên cột đó ở bản script đầu tiên: Sheet còn tên này thì script vẫn nhận
// "Mã đơn", "Khách hàng": script tự điền khi shop gõ mã của thẻ vào đơn ở trang "Đơn hàng"
const CODE_HEADER = [CODE_ID_COL, 'Ghi chú', 'Khoá', 'Số lần tải', 'Tải lần đầu', 'Tải gần nhất', 'File tải gần nhất', PRINTED_COL, 'Mã đơn', 'Khách hàng'];
const CODE_NEEDED_COLS = [CODE_ID_COL, 'Khoá', 'Số lần tải']; // Quyết định mã có tải được không: thiếu cột nào thì script dừng (codeCols_)
// Không có 0/O, 1/I/L để khách đọc và gõ không nhầm
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const ORDER_SHEET = 'Đơn hàng';
const ORDER_KEY_COL = 'Mã tải code'; // Cột ở trang "Đơn hàng": shop gõ mã của thẻ bỏ vào hộp của đơn đó
const ORDER_CHECK_COL = 'Kiểm tra';  // Script ghi khi tổng web gửi khác giá đúng, hoặc chưa đối chiếu được giá
const ORDER_PLATFORM_COL = 'Nền tảng'; // Đơn từ web ghi WEB_PLATFORM; đơn gộp từ "Customer Infor" ghi Shopee, Tiktok…
const WEB_PLATFORM = 'Website';
const ORDER_PLATFORMS = ['Shopee', 'Tiktok']; // Ô thả xuống "Nền tảng" khi shop tự thêm, sửa đơn trên trang quản trị
const ORDER_REVENUE_COL = 'Doanh thu sau điều chỉnh'; // Shop tự điền 2 cột này; đủ 2 số thì ORDER_PROFIT_COL tự tính (syncProfit_)
const ORDER_COST_COL = 'Chi phí';
const ORDER_PROFIT_COL = 'Lợi nhuận';
const ORDER_HEADER = ['Thời gian', 'Mã đơn', 'Họ tên', 'SĐT', 'Địa chỉ', 'Sản phẩm', 'Tổng (₫)', ORDER_CHECK_COL, 'Ghi chú', ORDER_KEY_COL];
const PHONE_RE = /^(0|\+?84)(3|5|7|8|9)\d{8}$/; // Giống assets/js/core.js

const PRINT_SHEET = 'In 3D';
const PRINT_STATUS_COL = 'Trạng thái'; // Shop chọn ở ô thả xuống; đơn, yêu cầu mới ghi "Mới"
const PRINT_STATUSES = ['Mới', 'Đã liên hệ', 'Đã chốt', 'Đang in', 'Đã giao', 'Huỷ'];
const PRINT_HEADER = ['Thời gian', 'Mã', 'Loại', 'Họ tên', 'SĐT', 'Địa chỉ', 'Nội dung', 'Số lượng', 'Tạm tính (₫)', ORDER_CHECK_COL, 'Ghi chú', PRINT_STATUS_COL];
const PRINT_KINDS = ['Bảng tên để bàn', 'Giá đỡ điện thoại', 'In theo file']; // Cột "Loại", giống plateRow_, standRow_, fileRow_
// Chữ in trên bảng tên: chữ cái (có dấu tiếng Việt), số, dấu câu thường dùng. Giống assets/js/print3d.js
const PLATE_TEXT_RE = /^[\p{Script=Latin}\p{M}\p{Nd} .,:;!?&'"’‘“”()\/+\-–—#@*]*$/u;

const LEAD_SHEET = 'Tư vấn';
const LEAD_HEADER = ['Thời gian', 'Họ tên', 'SĐT', 'Nội dung'];

const DASHBOARD_SHEET = 'Tổng quan'; // Script tự tạo, tự tính lại: lợi nhuận, số đơn, khách truy cập (dashboardData_)
const VISIT_SHEET = 'Lượt truy cập'; // Lượt xem web theo ngày, đếm ẩn danh (countVisit_); hôm nay còn đang đếm nên chưa có ở đây
const DASH_REFRESH_MINUTES = 10;     // Mở Google Sheet thì trang Tổng quan tự tính lại, nếu lần trước đã quá bấy nhiêu phút

// Trang quản trị (quan-tri.html). Tạo tài khoản: menu "SmartCarTech" → "Tài khoản trang quản trị…"
const ADMIN_LOG_SHEET = 'Nhật ký quản trị'; // Script ghi mọi lần đăng nhập, sửa, thêm, xoá dòng trên trang quản trị
// Các trang này: dòng mới (đơn web, yêu cầu tư vấn, đơn in 3D, mã mới, nhật ký, dòng thêm trên trang quản trị) chèn ngay
// dưới dòng tiêu đề, mới nhất ở trên cùng. Trang khác (VD các trang kế hoạch nhập từ Excel) thêm dòng ở cuối
const NEWEST_FIRST = [ORDER_SHEET, LEAD_SHEET, PRINT_SHEET, CODE_SHEET, ADMIN_LOG_SHEET, VISIT_SHEET];
// Trang shop tự tạo: thêm dòng trên trang quản trị thì dòng mới cũng nằm trên cùng, ngay dưới dòng tiêu đề.
// Tên không phân biệt hoa thường, dấu, dấu cách thừa; đổi tên trang thì sửa tên ở đây
const ADMIN_NEWEST_FIRST = ['Task Tracking'];
const ADMIN_IDLE_HOURS = 3;    // Không thao tác quá bấy nhiêu giờ thì phải đăng nhập lại (tối đa 6)
const ADMIN_MAX_HOURS = 12;    // Mỗi lần đăng nhập dùng được tối đa bấy nhiêu giờ
const ADMIN_MAX_FAILS = 5;     // 1 tài khoản sai mật khẩu quá bấy nhiêu lần trong 15 phút thì tạm khoá 15 phút (cả web: gấp 6 lần)
const ADMIN_MIN_PASSWORD = 10; // Mật khẩu ít nhất bấy nhiêu ký tự
const ADMIN_MAX_CELLS = 40000; // Trang tính lớn hơn thì web chỉ hiện các dòng tiêu đề và các dòng mới nhất (đầu hoặc cuối trang)

/** Mở URL ứng dụng web trên trình duyệt để kiểm tra script đã chạy. */
function doGet() {
  return ContentService.createTextOutput('SmartCarTech: Apps Script đang chạy.');
}

function doPost(e) {
  let data = null;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    // Không phải JSON (VD bot gửi linh tinh): trả lỗi, không ghi gì
  }

  // Lượt xem trang (core.js gửi ngầm, không chờ trả lời): đếm rồi trả "ok"; lỗi thì bỏ qua lượt đó
  if (data && data.type === 'luot-xem') {
    try {
      countVisit_(data);
    } catch (err) {
      console.error(err);
    }
    return ContentService.createTextOutput('ok');
  }

  if (data && data.type === 'tai-code') {
    try {
      return json_(downloadCode_(data));
    } catch (err) {
      console.error(err);
      return json_({ ok: false, error: 'Chưa tải được code. Vui lòng thử lại sau ít phút hoặc nhắn Zalo cho shop.' });
    }
  }

  if (data && data.type === 'quan-tri') {
    try {
      return json_(adminApi_(data));
    } catch (err) {
      console.error(err);
      return json_({ ok: false, error: 'Script đang lỗi nên chưa làm được việc này. Thử lại sau ít phút.' });
    }
  }

  // Web chỉ báo khách "Đã gửi" khi nhận "ok"; câu trả lời khác thì web mời khách gửi lại hoặc gửi qua Zalo
  let result = 'invalid';
  try {
    if (data && data.type === 'don-hang') result = saveOrder_(data);
    if (data && data.type === 'tu-van') result = saveLead_(data);
    if (data && data.type === 'in-3d') result = savePrint_(data);
  } catch (err) {
    console.error(err);
    result = 'error';
  }
  return ContentService.createTextOutput(result);
}

/* ---------- Đơn hàng & yêu cầu tư vấn từ web ---------- */

/** Đơn từ trang Đặt hàng: chỉ ghi khi đủ thông tin; tên sản phẩm và tổng tiền lấy theo products.json. */
function saveOrder_(data) {
  const name = clean_(data.name, 100);
  const phone = normalizePhone_(data.phone);
  const address = clean_(data.address, 300, true);
  const note = clean_(data.note, 300, true);
  const code = String(data.code || '');
  const items = Array.isArray(data.items) ? data.items : [];
  if (!name || !PHONE_RE.test(phone) || address.length < 10 || !/^SC\d{6}-\d{4}$/.test(code)) return 'invalid';
  if (!items.length || items.length > 20) return 'invalid';

  const checks = [];
  let kits = null;
  try {
    kits = catalog_();
  } catch (err) {
    console.error(err);
    checks.push('Chưa đối chiếu được giá với products.json: kiểm tra lại sản phẩm và tổng tiền.');
  }
  const products = [];
  let total = 0;
  for (const item of items) {
    const qty = Number(item && item.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) return 'invalid';
    // Không đọc được bảng giá thì vẫn nhận đơn theo tên và giá web gửi (đã ghi lời nhắc ở cột "Kiểm tra")
    const kit = kits
      ? kits.get(`${item.line_id}:${item.kit_id}`) || kits.get(`${item.line}|${item.kit}`)
      : { line: clean_(item.line, 100), kit: clean_(item.kit, 100), price: Number(item.price) || 0 };
    if (!kit || !kit.line || !kit.kit) return 'invalid';
    products.push(`${productName_(kit.line, kit.kit)} × ${qty}`);
    total += kit.price * qty;
  }
  const sentTotal = Number(data.total) || 0;
  if (kits && sentTotal !== total) {
    checks.push(`Web gửi tổng ${money_(sentTotal)} ₫, giá đúng ${money_(total)} ₫: báo lại giá cho khách khi gọi xác nhận.`);
  }
  if (overLimit_(phone)) return 'busy';

  addRow_(getSheet_(SpreadsheetApp.getActiveSpreadsheet(), ORDER_SHEET, ORDER_HEADER), {
    'Thời gian': new Date(),
    'Mã đơn': code,
    'Họ tên': name,
    'SĐT': phone,
    'Địa chỉ': address,
    'Sản phẩm': products.join('\n'),
    'Tổng (₫)': total,
    [ORDER_CHECK_COL]: checks.join('\n'),
    'Ghi chú': note,
    [ORDER_PLATFORM_COL]: WEB_PLATFORM,
  });
  notify_(`Đơn mới #${code} – ${name}`, [
    `${name} – ${phone}`, address, '', ...products, '',
    `Tổng: ${money_(total)} ₫`, `Ghi chú: ${note}`, ...(checks.length ? ['', `Cần kiểm tra: ${checks.join(' ')}`] : []),
  ].join('\n'));
  return 'ok';
}

/** Yêu cầu tư vấn từ Trang chủ. */
function saveLead_(data) {
  const name = clean_(data.name, 100);
  const phone = normalizePhone_(data.phone);
  const message = clean_(data.message, 1000, true);
  if (!name || !PHONE_RE.test(phone)) return 'invalid';
  if (overLimit_(phone)) return 'busy';

  const sh = getSheet_(SpreadsheetApp.getActiveSpreadsheet(), LEAD_SHEET, LEAD_HEADER);
  addRow_(sh, { 'Thời gian': new Date(), 'Họ tên': name, 'SĐT': phone, 'Nội dung': message });
  notify_(`Yêu cầu tư vấn – ${name}`, `${name} – ${phone}\n\n${message}`);
  return 'ok';
}

/* ---------- Trang In 3D: đơn bảng tên, giá đỡ điện thoại, yêu cầu in theo file ---------- */

const PRINT_ROWS = { 'bang-ten': plateRow_, 'gia-do': standRow_, 'theo-file': fileRow_ };

/**
 * Mỗi đơn bảng tên, giá đỡ điện thoại hay yêu cầu in theo file là 1 dòng ở trang tính "In 3D". Cột "Trạng thái"
 * có ô thả xuống (Mới → Đã liên hệ → …) để shop theo dõi. Giá tính lại theo products.json như đơn bộ xe.
 */
function savePrint_(data) {
  const name = clean_(data.name, 100);
  const phone = normalizePhone_(data.phone);
  const code = String(data.code || '');
  if (!name || !PHONE_RE.test(phone) || !/^IN\d{6}-\d{4}$/.test(code)) return 'invalid';
  const row = PRINT_ROWS.hasOwnProperty(data.kind) ? PRINT_ROWS[data.kind](data) : null;
  if (!row) return 'invalid';
  if (overLimit_(phone)) return 'busy';

  const sh = getSheet_(SpreadsheetApp.getActiveSpreadsheet(), PRINT_SHEET, PRINT_HEADER);
  // Ghi dòng và ô thả xuống trong cùng một khoá: đơn khác chèn lên trên giữa chừng thì ô thả xuống vẫn vào đúng dòng
  withDocLock_(() => {
    const added = addRow_(sh, Object.assign({ 'Thời gian': new Date(), 'Mã': code, 'Họ tên': name, 'SĐT': phone }, row.cells,
      { [PRINT_STATUS_COL]: PRINT_STATUSES[0] }));
    const statusCol = colOf_(sh, PRINT_STATUS_COL, false);
    if (statusCol) {
      sh.getRange(added, statusCol).setDataValidation(
        SpreadsheetApp.newDataValidation().requireValueInList(PRINT_STATUSES, true).setAllowInvalid(true).build());
    }
  });
  notify_(`${row.title} #${code} – ${name}`, [`${name} – ${phone}`, ...row.email].join('\n'));
  return 'ok';
}

/**
 * Đơn bảng tên để bàn. Kiểu bảng (1 hoặc 2 tầng), kiểu chữ, icon, màu tìm theo id trong products.json → print3d:
 * không có thì bỏ đơn (VD shop vừa bỏ màu đó). Cả bảng tối đa layout.max_chars ký tự (mọi dòng, dấu cách, mỗi icon
 * 1 ký tự) và nameplate.max_colors màu, tính cả màu icon (lá cờ: màu cố định).
 * Không đọc được products.json thì vẫn lưu theo tên web gửi, cột "Kiểm tra" nhắc đối chiếu lại.
 */
function plateRow_(data) {
  const p = data.plate || {};
  const lines = [p.line1, p.line2].map((v) => clean_(String(v == null ? '' : v).normalize('NFC'), 60));
  const qty = Number(data.qty);
  const address = clean_(data.address, 300, true);
  const note = clean_(data.note, 500, true);
  if (!lines[0] || !lines.every((t) => PLATE_TEXT_RE.test(t))) return null;
  if (!Number.isInteger(qty) || qty < 1 || qty > 99 || address.length < 10) return null;

  const checks = [];
  const cat = printCatalog_(checks);
  const np = cat && cat.nameplate;
  const find = (list, id, label) => (cat ? findById_(list, id) : { name: clean_(label, 40) });
  const layout = find(np && np.layouts, p.layout_id, p.layout);
  const font = find(np && np.fonts, p.font_id, p.font);
  const body = find(cat && cat.colors, p.body_id, p.body);
  const text = find(cat && cat.colors, p.text_id, p.text);
  if (![layout, font, body, text].every((x) => x && x.name)) return null;

  // Icon trước, sau tên: "khong" là để trống
  const icons = [
    ['trước', p.icon_before_id, p.icon_before, p.icon_before_color_id, p.icon_before_color],
    ['sau', p.icon_after_id, p.icon_after, p.icon_after_color_id, p.icon_after_color],
  ].map(([where, id, label, colorId, colorLabel]) => {
    if (!id || id === 'khong') return { where, none: true };
    const icon = find(np && np.icons, id, label);
    if (!icon || !icon.name) return null;
    const colors = cat && icon.fixed
      ? icon.fixed.map((c) => findById_(cat.colors, c))
      : [find(cat && cat.colors, colorId, colorLabel)];
    return colors.every((c) => c && c.name) ? { where, icon, colors } : null;
  });
  if (icons.includes(null)) return null;

  if (cat) {
    // Số ký tự của cả bảng: chữ mọi dòng (tính cả dấu cách) và mỗi icon 1 ký tự
    const twoLines = Number(layout.lines) === 2;
    const chars = lines.reduce((n, t) => n + Array.from(t).length, 0) + icons.filter((ic) => !ic.none).length;
    if (twoLines !== Boolean(lines[1]) || chars > (Number(layout.max_chars) || 19)) return null;
    const used = new Set([body.id, text.id]);
    icons.forEach((ic) => ic.colors && ic.colors.forEach((c) => used.add(c.id)));
    if (used.size > np.max_colors) return null;
  }

  const price = cat ? Number(layout.price) || 0 : Number(data.price) || 0;
  const total = printTotal_(price, qty, data, checks, Boolean(cat));
  const iconText = icons.filter((ic) => !ic.none)
    .map((ic) => `${ic.icon.name} ${ic.where} tên (${ic.icon.fixed ? 'đỏ sao vàng' : ic.colors[0].name})`);
  const content = [
    `Kiểu: ${layout.name}`,
    ...(lines[1] ? [`Dòng 1: ${lines[0]}`, `Dòng 2: ${lines[1]}`] : [`Chữ: ${lines[0]}`]),
    `Kiểu chữ: ${font.name}${font.family ? ` (font ${font.family})` : ''}`,
    `Icon: ${iconText.length ? iconText.join(', ') : 'không'}`,
    `Màu: thân ${body.name}, chữ ${text.name}`,
  ];
  return orderRow_('Đơn bảng tên', 'Bảng tên để bàn', { address, content, qty, price, total, checks, note });
}

/** Đơn giá đỡ điện thoại in tên: tên khắc (in hoa) và màu theo products.json → print3d.stand. */
function standRow_(data) {
  const s = data.stand || {};
  const text = clean_(String(s.text == null ? '' : s.text).normalize('NFC'), 40).toUpperCase();
  const qty = Number(data.qty);
  const address = clean_(data.address, 300, true);
  const note = clean_(data.note, 500, true);
  if (!text || !PLATE_TEXT_RE.test(text)) return null;
  if (!Number.isInteger(qty) || qty < 1 || qty > 99 || address.length < 10) return null;

  const checks = [];
  const cat = printCatalog_(checks);
  if (cat && !cat.stand) return null; // shop đã bỏ sản phẩm này khỏi products.json
  const color = cat ? findById_(cat.colors, s.color_id) : { name: clean_(s.color, 40) };
  if (!color || !color.name) return null;
  if (cat && Array.from(text).length > (Number(cat.stand.max_chars) || 10)) return null;

  const price = cat ? Number(cat.stand.price) || 0 : Number(data.price) || 0;
  const total = printTotal_(price, qty, data, checks, Boolean(cat));
  const content = [`Tên khắc: ${text}`, `Màu: ${color.name}`];
  return orderRow_('Đơn giá đỡ điện thoại', 'Giá đỡ điện thoại', { address, content, qty, price, total, checks, note });
}

/** Tổng tiền theo giá trong products.json; tổng web gửi khác thì ghi lời nhắc vào cột "Kiểm tra". */
function printTotal_(price, qty, data, checks, known) {
  const total = price * qty;
  const sent = Number(data.total) || 0;
  if (known && sent !== total) {
    checks.push(`Web gửi tổng ${money_(sent)} ₫, giá đúng ${money_(total)} ₫: báo lại giá cho khách khi gọi xác nhận.`);
  }
  if (known && !price) checks.push('Sản phẩm này chưa có giá trong products.json: báo giá khi gọi xác nhận.');
  return total;
}

/** Dòng ở trang tính "In 3D" và email báo shop cho một đơn đặt ngay (bảng tên, giá đỡ). */
function orderRow_(title, kind, o) {
  return {
    title,
    cells: {
      'Loại': kind,
      'Địa chỉ': o.address,
      'Nội dung': o.content.join('\n'),
      'Số lượng': o.qty,
      'Tạm tính (₫)': o.price ? o.total : '',
      [ORDER_CHECK_COL]: o.checks.join('\n'),
      'Ghi chú': o.note,
    },
    email: [o.address, '', ...o.content, `Số lượng: ${o.qty}`, `Tạm tính: ${o.price ? `${money_(o.total)} ₫` : 'chưa có giá'}`,
      `Ghi chú: ${o.note}`, ...(o.checks.length ? ['', `Cần kiểm tra: ${o.checks.join(' ')}`] : [])],
  };
}

/** Yêu cầu báo giá in theo file: mô tả, link file (nếu có). File, ảnh trên máy khách gửi qua Zalo kèm mã. */
function fileRow_(data) {
  const message = clean_(data.message, 1000, true);
  const link = clean_(data.link, 500);
  const material = clean_(data.material, 40);
  const color = clean_(data.color, 60);
  const qty = data.qty === '' || data.qty == null ? '' : Number(data.qty);
  if (!message || data.rights !== true) return null;
  if (link && !/^https?:\/\/[^\s/]+\.\S+$/i.test(link)) return null;
  if (qty !== '' && (!Number.isInteger(qty) || qty < 1 || qty > 1000)) return null;

  const content = [
    message,
    link ? `File: ${link}` : '',
    `Vật liệu: ${material || 'shop tư vấn'}`,
    color ? `Màu: ${color}` : '',
  ].filter(Boolean);
  return {
    title: 'Yêu cầu in 3D',
    cells: { 'Loại': 'In theo file', 'Nội dung': content.join('\n'), 'Số lượng': qty },
    email: ['', ...content, ...(qty ? [`Số lượng: ${qty}`] : []), '', 'Khách có thể gửi file, ảnh qua Zalo kèm mã này.'],
  };
}

function findById_(list, id) {
  return (list || []).find((x) => x && x.id === id) || null;
}

/** products.json trên website (đã đọc thành object), lưu tạm 10 phút. */
function siteData_() {
  const cache = CacheService.getScriptCache();
  let text = cache.get('products');
  const fresh = !text;
  if (fresh) {
    const res = UrlFetchApp.fetch(`${SITE_URL}/products.json`, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error(`HTTP ${res.getResponseCode()}`);
    text = res.getContentText('UTF-8');
  }
  const data = JSON.parse(text);
  if (fresh) {
    try {
      cache.put('products', text, 600);
    } catch (err) {
      console.warn(err); // file lớn hơn 100 KB thì không lưu tạm được: lần sau đọc lại
    }
  }
  return data;
}

/** Tên sản phẩm ở cột "Sản phẩm" của đơn: "SC Tech Pro – Bộ đầy đủ linh kiện" (đơn ghi thêm " × số lượng"). */
function productName_(line, kit) {
  return `${line} – ${kit}`;
}

/** Các sản phẩm đang bán theo products.json, cho ô thả xuống "Sản phẩm" trên trang quản trị. Không đọc được thì []. */
function productNames_() {
  try {
    return siteData_().lines.flatMap((l) => l.kits.map((k) => productName_(l.name, k.name)));
  } catch (err) {
    console.warn(err);
    return [];
  }
}

/**
 * Bảng giá theo products.json trên website: "pro:day-du" và "SC Tech Pro|Bộ đầy đủ linh kiện"
 * cùng trỏ tới { line, kit, price } của bộ đó.
 */
function catalog_() {
  const kits = new Map();
  siteData_().lines.forEach((l) => l.kits.forEach((k) => {
    const kit = { line: l.name, kit: k.name, price: Number(k.price) || 0 };
    kits.set(`${l.id}:${k.id}`, kit);
    kits.set(`${l.name}|${k.name}`, kit); // trang web bản cũ chưa gửi line_id, kit_id: chỉ có tên dòng, tên bộ
  }));
  return kits;
}

/**
 * Bảng màu, bảng tên (kiểu bảng kèm giá, kiểu chữ, icon) và giá đỡ đang bán: products.json → print3d.
 * Không đọc được products.json thì trả null và ghi lời nhắc vào `checks` (cột "Kiểm tra"): đơn vẫn được lưu.
 */
function printCatalog_(checks) {
  try {
    const p = siteData_().print3d || {};
    const np = p.nameplate || {};
    return {
      colors: p.colors || [],
      nameplate: {
        layouts: np.layouts || [], fonts: np.fonts || [], icons: np.icons || [],
        max_colors: Number(np.max_colors) || 4,
      },
      stand: p.stand || null,
    };
  } catch (err) {
    console.error(err);
    if (checks) checks.push('Chưa đối chiếu được với products.json: kiểm tra lại lựa chọn, màu và giá.');
    return null;
  }
}

/** Chống spam: 1 SĐT gửi quá nhiều lần, hoặc tổng số lần gửi quá nhiều, trong 10 phút. Chỉ đếm lần gửi hợp lệ. */
function overLimit_(phone) {
  return bump_(`sdt:${phone}`, 600) > MAX_SENDS_PER_PHONE || bump_('gui', 600) > MAX_SENDS_PER_10_MIN;
}

/** Đếm số lần trong khung thời gian hiện tại (dài `seconds` giây), tính cả lần này. Đếm gần đúng, đủ để chống spam. */
function bump_(name, seconds) {
  const cache = CacheService.getScriptCache();
  const key = `${name}:${Math.floor(Date.now() / 1000 / seconds)}`;
  const count = (Number(cache.get(key)) || 0) + 1;
  cache.put(key, String(count), seconds);
  return count;
}

/** Số lần bump_ đã đếm trong khung thời gian hiện tại, không tính thêm lần này. */
function count_(name, seconds) {
  return Number(CacheService.getScriptCache().get(`${name}:${Math.floor(Date.now() / 1000 / seconds)}`)) || 0;
}

/** Chữ khách nhập: bỏ khoảng trắng ở hai đầu, cắt ở `max` ký tự. Ô một dòng (tên) gộp xuống dòng thành dấu cách. */
function clean_(value, max, multiline) {
  const s = String(value == null ? '' : value).trim();
  return (multiline ? s : s.replace(/\s+/g, ' ')).slice(0, max);
}

/** Giống normalizePhone trong core.js: "0912 345.678" → "0912345678". */
function normalizePhone_(value) {
  return String(value == null ? '' : value).replace(/[\s.\-()]/g, '').slice(0, 20);
}

/** 2980000 → "2.980.000" */
function money_(n) {
  return String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/* ---------- Code mẫu: chỉ người có mã trên thẻ trong hộp ---------- */

/** Kiểm tra mã khách nhập; đúng thì trả file .zip (base64) trong thư mục CODE_FOLDER_ID. */
function downloadCode_(data) {
  const code = normalizeCode_(data.code);
  const name = String(data.file || '');
  if (!code) return { ok: false, error: 'Vui lòng nhập mã in trên thẻ trong hộp.' };
  // Chỉ nhận tên file .zip đơn giản, không dấu, không đường dẫn
  if (!/^\w[\w.-]*\.zip$/i.test(name)) return { ok: false, error: 'File code không hợp lệ.' };
  if (!CODE_FOLDER_ID) return { ok: false, error: 'Shop chưa cài thư mục code. Vui lòng nhắn Zalo cho shop.' };

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = getSheet_(SpreadsheetApp.getActiveSpreadsheet(), CODE_SHEET, CODE_HEADER);
    const cols = codeCols_(sh);
    if (cols.missing) return { ok: false, error: `Shop đang cập nhật danh sách mã (thiếu cột ${cols.missing}). Vui lòng nhắn Zalo cho shop.` };
    const rows = sh.getDataRange().getValues();
    const i = rows.findIndex((r, n) => n > 0 && normalizeCode_(r[cols.id - 1]) === code);
    if (i < 0) return { ok: false, error: 'Mã không đúng. Kiểm tra lại mã in trên thẻ trong hộp.' };
    const row = rows[i];
    if (isLocked_(row[cols.lock - 1])) return { ok: false, error: 'Mã này đã bị khoá. Vui lòng nhắn Zalo cho shop.' };
    const count = Number(row[cols.count - 1]) || 0;
    if (count >= MAX_DOWNLOADS) return { ok: false, error: 'Mã này đã hết lượt tải. Vui lòng nhắn Zalo cho shop.' };

    const file = codeFile_(name);
    if (!file) return { ok: false, error: 'File code này đang được cập nhật. Vui lòng nhắn Zalo cho shop.' };
    const now = new Date();
    const [first, latest, lastFile] = ['Tải lần đầu', 'Tải gần nhất', 'File tải gần nhất'].map((col) => colOf_(sh, col, true));
    sh.getRange(i + 1, cols.count).setValue(count + 1);
    if (!row[first - 1]) sh.getRange(i + 1, first).setValue(now);
    sh.getRange(i + 1, latest).setValue(now);
    sh.getRange(i + 1, lastFile).setValue(name);
    SpreadsheetApp.flush(); // Ghi xong lượt tải rồi mới nhả khoá: mã mới tạo chèn dòng trên cùng làm đổi số dòng
    return { ok: true, name: file.getName(), data: Utilities.base64Encode(file.getBlob().getBytes()) };
  } finally {
    lock.releaseLock();
  }
}

/** File chưa bị xoá trong thư mục code; script không đọc file ở nơi khác trên Drive. */
function codeFile_(name) {
  const files = DriveApp.getFolderById(CODE_FOLDER_ID).getFilesByName(name);
  while (files.hasNext()) {
    const file = files.next();
    if (!file.isTrashed()) return file;
  }
  return null;
}

/** "k7m3 q9xp" và "K7M3-Q9XP" là cùng một mã: bỏ khoảng trắng, gạch nối, không phân biệt hoa thường. */
function normalizeCode_(value) {
  return String(value == null ? '' : value).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Ô "Khoá" được tích, hoặc có ghi bất kỳ chữ nào (VD "x"). */
function isLocked_(value) {
  return value === true || (typeof value === 'string' && value.trim() !== '');
}

/**
 * Số thứ tự cột mã, Khoá, Số lần tải ở trang "Mã tải code", tìm theo tên nên shop đổi thứ tự cột vẫn đúng. "Khóa", "KHOÁ"
 * cũng nhận ra: gõ lại tên cột dễ khác dấu. Thiếu cột thì missing ghi tên cột đó và script dừng, không tự thêm cột như các
 * cột khác: cột mới trống thì mã đã khoá lại tải được, lượt tải đếm lại từ 0.
 */
function codeCols_(sh) {
  const [idName, oldName] = [CODE_ID_COL, CODE_ID_OLD_COL].map(matchText_);
  const head = header_(sh).map(matchText_).map((name) => (name === oldName ? idName : name));
  const [id, lock, count] = CODE_NEEDED_COLS.map((name) => head.indexOf(matchText_(name)) + 1);
  const missing = CODE_NEEDED_COLS.filter((name) => !head.includes(matchText_(name)));
  return { id, lock, count, missing: missing.map((name) => `"${name}"`).join(', ') };
}

/** Câu báo shop khi thiếu cột: ở menu, khi gán mã cho đơn, ở "Kiểm tra cài đặt". */
function codeColsIssue_(cols) {
  return `Trang "${CODE_SHEET}" không có cột ${cols.missing} (có thể vừa bị đổi tên). Đổi lại đúng tên ở dòng 1 rồi làm lại.`;
}

/** Mã ngẫu nhiên dạng "K7M3-Q9XP": 31^8 ≈ 850 tỉ khả năng, không đoán được. */
function newCode_() {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid());
  let s = '';
  for (let i = 0; i < 8; i++) s += CODE_CHARS[(bytes[i] + 256) % CODE_CHARS.length];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/** Thêm menu "SmartCarTech" khi mở Google Sheet; trang tính tạo từ bản script cũ được thêm các cột mới. */
function onOpen() {
  const menu = SpreadsheetApp.getUi()
    .createMenu('SmartCarTech')
    .addItem('Tạo mã tải code…', 'createCodes')
    .addItem('In thẻ cho các mã đang chọn…', 'printCards')
    .addSeparator()
    .addItem('Cập nhật trang Tổng quan', 'updateDashboard')
    .addItem('Tài khoản trang quản trị…', 'showAdminAccounts')
    .addItem('Bật hoặc tắt trang quản trị…', 'toggleAdminPage')
    .addItem('Kiểm tra cài đặt…', 'checkSetup');
  try {
    // Chỉ hiện khi còn trang "Customer Infor": gộp xong, xoá trang đó thì mục này tự mất
    if (SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CUSTOMER_SHEET)) {
      menu.addSeparator().addItem('Gộp Customer Infor vào Đơn hàng…', 'mergeCustomerInfo');
    }
  } catch (err) {
    console.warn(err);
  }
  menu.addToUi();
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const codes = ss.getSheetByName(CODE_SHEET);
    if (codes && codes.getLastRow()) CODE_HEADER.slice(7).forEach((name) => colOf_(codes, name, true));
    const orders = ss.getSheetByName(ORDER_SHEET);
    if (orders && orders.getLastRow()) [ORDER_KEY_COL, ORDER_CHECK_COL].forEach((name) => colOf_(orders, name, true));
  } catch (err) {
    console.warn(err); // VD người chỉ có quyền xem: không thêm được cột, menu vẫn dùng được
  }
  try {
    const last = Number(PropertiesService.getScriptProperties().getProperty(DASH_UPDATED_KEY)) || 0;
    if (Date.now() - last > DASH_REFRESH_MINUTES * 60000) refreshDashboard_(SpreadsheetApp.getActiveSpreadsheet());
  } catch (err) {
    console.warn(err); // VD người chỉ có quyền xem: không ghi được, trang Tổng quan giữ số liệu lần trước
  }
}

/** Tạo mã mới để in lên thẻ bỏ vào hộp. Mỗi mã tải được mọi file code mẫu. */
function createCodes() {
  const ui = SpreadsheetApp.getUi();
  const asked = ui.prompt('Tạo mã tải code', 'Cần tạo bao nhiêu mã? (1–500)', ui.ButtonSet.OK_CANCEL);
  if (asked.getSelectedButton() !== ui.Button.OK) return;
  const count = Number(asked.getResponseText().trim());
  if (!Number.isInteger(count) || count < 1 || count > 500) {
    ui.alert('Vui lòng nhập một số từ 1 đến 500.');
    return;
  }
  const noted = ui.prompt('Ghi chú cho các mã này', 'VD: Lô tháng 10/2026 — có thể để trống.', ui.ButtonSet.OK_CANCEL);
  if (noted.getSelectedButton() !== ui.Button.OK) return;
  const note = safe_(noted.getResponseText().trim());

  const sh = getSheet_(SpreadsheetApp.getActiveSpreadsheet(), CODE_SHEET, CODE_HEADER);
  const cols = codeCols_(sh);
  if (cols.missing) {
    ui.alert(codeColsIssue_(cols));
    return;
  }
  const used = new Set(sh.getDataRange().getValues().map((r) => normalizeCode_(r[cols.id - 1])));
  const codes = [];
  while (codes.length < count) {
    const code = newCode_();
    if (used.has(normalizeCode_(code))) continue;
    used.add(normalizeCode_(code));
    codes.push([code]);
  }
  const noteCol = colOf_(sh, 'Ghi chú', true);
  const width = Math.max(sh.getLastColumn(), noteCol);
  const rows = codes.map(([code]) => {
    const row = new Array(width).fill('');
    row[cols.id - 1] = safe_(code); // "2345-6789" giữ dạng chữ, không bị đổi thành số
    row[noteCol - 1] = note;
    row[cols.count - 1] = 0;
    return row;
  });
  // Mã mới ở trên cùng. Chèn dòng làm đổi số dòng các mã cũ: giữ cả khoá của script (tải code, ghi ngày in theo số dòng)
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let start = 0;
  try {
    withDocLock_(() => {
      start = insertTop_(sh, rows);
      sh.getRange(start, cols.id, count, 1).setNumberFormat('@');
      sh.getRange(start, cols.lock, count, 1).insertCheckboxes();
    });
  } finally {
    lock.releaseLock();
  }
  sh.activate();
  sh.setActiveRange(sh.getRange(start, cols.id, count, 1));
  ui.alert(`Đã tạo ${count} mã mới (dòng ${start}–${start + count - 1}). Các mã này đang được chọn sẵn: vào menu SmartCarTech → In thẻ cho các mã đang chọn… để in.`);
}

/**
 * Menu "Kiểm tra cài đặt…". Chạy lại mỗi khi dán bản script mới: Google hỏi cấp các quyền script cần (gồm
 * "kết nối với dịch vụ bên ngoài" để đọc products.json đối chiếu giá), rồi báo phần nào đã cài đúng.
 */
function checkSetup() {
  // Google cho tick từng quyền, và script có quyền mới thì chạy menu không tự hỏi lại. Lệnh này dừng script
  // và hiện hộp cấp quyền khi còn thiếu quyền nào: tích "Chọn tất cả" rồi chạy lại menu này.
  if (ScriptApp.requireAllScopes) ScriptApp.requireAllScopes(ScriptApp.AuthMode.FULL);
  const lines = [];
  try {
    CacheService.getScriptCache().remove('products'); // đọc bản mới nhất trên website
    const print = printCatalog_();
    lines.push(`✓ Đọc được bảng giá ${SITE_URL}/products.json: ${new Set(catalog_().values()).size} bộ xe, ` +
      `${print ? print.nameplate.layouts.length : 0} kiểu bảng tên, ${print && print.stand ? 1 : 0} giá đỡ điện thoại.`);
  } catch (err) {
    const why = /external_request/.test(err.message)
      ? 'chưa cấp quyền "Kết nối với dịch vụ bên ngoài" (cách cấp: README mục 5, bước 7)'
      : err.message;
    lines.push(`✗ Chưa đọc được bảng giá ${SITE_URL}/products.json: ${why}. Đơn vẫn được lưu, nhưng cột "${ORDER_CHECK_COL}" sẽ báo chưa đối chiếu được giá.`);
  }
  lines.push(NOTIFY_EMAIL
    ? `✓ Email báo đơn và báo đăng nhập lạ vào trang quản trị gửi tới ${NOTIFY_EMAIL}. Hôm nay còn gửi được ${MailApp.getRemainingDailyQuota()} email.`
    : '✗ Chưa điền NOTIFY_EMAIL: shop sẽ không nhận email khi có đơn mới, hay khi trang quản trị có đăng nhập lạ.');
  lines.push(codeFolderStatus_());
  lines.push(...columnLines_());
  lines.push(visitStatus_());
  lines.push(...adminStatus_());
  const ui = SpreadsheetApp.getUi();
  ui.alert('Kiểm tra cài đặt', lines.join('\n\n'), ui.ButtonSet.OK);
}

/** Thư mục code mẫu và các file trong đó phải ở chế độ "Bị hạn chế": chia sẻ công khai thì ai có link cũng tải được code. */
function codeFolderStatus_() {
  if (!CODE_FOLDER_ID) return '✗ Chưa điền CODE_FOLDER_ID: khách chưa tải được code mẫu.';
  try {
    const folder = DriveApp.getFolderById(CODE_FOLDER_ID);
    const open = folder.getSharingAccess() === DriveApp.Access.PRIVATE ? [] : [`thư mục "${folder.getName()}"`];
    let zips = 0;
    const files = folder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      if (file.isTrashed()) continue;
      if (/\.zip$/i.test(file.getName())) zips++;
      if (file.getSharingAccess() !== DriveApp.Access.PRIVATE) open.push(`file "${file.getName()}"`);
    }
    return open.length
      ? `✗ Đang chia sẻ công khai: ${open.join(', ')}. Ai có link cũng tải được code: đổi "Quyền truy cập chung" về "Bị hạn chế".`
      : `✓ Thư mục code "${folder.getName()}" có ${zips} file .zip, tất cả đều ở chế độ Bị hạn chế.`;
  } catch (err) {
    return `✗ Không mở được thư mục CODE_FOLDER_ID (${err.message}).`;
  }
}

/**
 * So dòng 1 của các trang này với tên cột script tìm, để biết trước khi triển khai: tên cột trên Sheet có thể khác tên
 * trong script (VD shop đã đổi tên). Trang chưa có hoặc còn trống thì script tự tạo đủ cột. Chỉ đọc, không ghi gì.
 */
function columnLines_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lines = [];
  const fine = [];
  [[CODE_SHEET, CODE_HEADER], [LEAD_SHEET, LEAD_HEADER], [ADMIN_LOG_SHEET, ADMIN_LOG_HEADER]].forEach(([name, header]) => {
    const sh = ss.getSheetByName(name);
    if (!sh || !sh.getLastRow()) return;
    const head = header_(sh);
    const cols = name === CODE_SHEET ? codeCols_(sh) : { missing: '' };
    const others = header.filter((col) => !CODE_NEEDED_COLS.includes(col) && !head.includes(col));
    const current = `Dòng 1 đang là: ${head.filter(Boolean).join(' | ')}.`;
    if (cols.missing) lines.push(`✗ ${codeColsIssue_(cols)} ${current} Trong lúc thiếu cột, khách không tải được code; menu tạo mã, in thẻ và việc gán mã cho đơn cũng dừng.`);
    if (others.length) lines.push(`✗ Trang "${name}" không có cột ${others.map((col) => `"${col}"`).join(', ')}. ${current} Cột nào chỉ khác tên thì đổi lại đúng tên, nếu không script sẽ thêm cột mới ở cuối bảng và ghi vào đó.`);
    if (!cols.missing && !others.length) fine.push(name);
  });
  if (fine.length) lines.push(`✓ Các trang ${fine.join(', ')} có đủ cột script cần.`);
  return lines;
}

/* ---------- In thẻ mã: 10 thẻ cỡ danh thiếp (85 × 54 mm) trên 1 tờ A4 ---------- */

const SITE_URL = 'https://smartcartech.vn'; // Địa chỉ in trên thẻ, trong mã QR, và nơi script đọc products.json để đối chiếu giá
// Logo lấy từ bản web trên GitHub Pages; khi chuyển tên miền, link này tự chuyển về smartcartech.vn
const LOGO_URL = 'https://smartcartech.github.io/SmartCarTech_Web-New/assets/img/logo-smartcartech.png';
const SHOP_ZALO = '0374 489 282';

/** Mở cửa sổ xem trước & in thẻ cho các mã đang bôi chọn. Bỏ qua mã đã khoá, đã có lượt tải hoặc đã gán cho đơn. */
function printCards() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getActiveSheet();
  if (sh.getName() !== CODE_SHEET) {
    ui.alert(`Mở trang tính "${CODE_SHEET}", bôi chọn các mã cần in rồi chọn lại menu này.`);
    return;
  }
  const cols = codeCols_(sh);
  if (cols.missing) {
    ui.alert(codeColsIssue_(cols));
    return;
  }
  const last = sh.getLastRow();
  const rowNums = new Set();
  const ranges = sh.getActiveRangeList();
  (ranges ? ranges.getRanges() : []).forEach((r) => {
    for (let n = Math.max(r.getRow(), 2); n <= Math.min(r.getLastRow(), last); n++) rowNums.add(n);
  });

  const printedCol = colOf_(sh, PRINTED_COL, false);
  const orderCol = colOf_(sh, 'Mã đơn', false);
  const values = last > 1 ? sh.getRange(1, 1, last, sh.getLastColumn()).getValues() : [];
  const tz = ss.getSpreadsheetTimeZone();
  const data = { site: SITE_URL, logo: LOGO_URL, zalo: SHOP_ZALO, cards: [], locked: 0, used: 0, linked: 0 };
  [...rowNums].sort((a, b) => a - b).forEach((n) => {
    const row = values[n - 1];
    const code = String(row[cols.id - 1]).trim();
    if (!normalizeCode_(code)) return;
    if (isLocked_(row[cols.lock - 1])) data.locked++;
    else if (Number(row[cols.count - 1]) > 0) data.used++;
    else if (orderCol && String(row[orderCol - 1]).trim()) data.linked++;
    else data.cards.push({ code, printed: printedCol ? printedText_(row[printedCol - 1], tz) : '' });
  });

  if (!data.cards.length) {
    const skipped = [
      data.locked && `${data.locked} mã đã khoá`,
      data.used && `${data.used} mã đã có lượt tải`,
      data.linked && `${data.linked} mã đã gán cho đơn`,
    ].filter(Boolean);
    ui.alert(skipped.length
      ? `Không có mã nào để in: ${skipped.join(', ')}. Hãy chọn các mã chưa dùng.`
      : `Bôi chọn các mã cần in ở cột "${CODE_ID_COL}" (chọn được nhiều dòng) rồi chọn lại menu này.`);
    return;
  }
  // Mã hoá dấu "<" để dữ liệu không đóng nhầm thẻ <script>; replace nhận hàm để giữ nguyên ký tự "$"
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const page = HtmlService.createHtmlOutput(CARD_PAGE_HTML.replace('__DATA__', () => json)).setWidth(900).setHeight(720);
  ui.showModalDialog(page, 'In thẻ mã tải code');
}

/** Cửa sổ in thẻ gọi hàm này khi bấm In: ghi ngày in vào cột "Đã in" để lần sau không in trùng. */
function markCardsPrinted(codes) {
  const want = new Set((Array.isArray(codes) ? codes : []).slice(0, 1000).map(normalizeCode_).filter(Boolean));
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const sh = getSheet_(SpreadsheetApp.getActiveSpreadsheet(), CODE_SHEET, CODE_HEADER);
    const last = sh.getLastRow();
    const idCol = codeCols_(sh).id;
    if (last < 2 || !want.size || !idCol) return 0;
    const col = colOf_(sh, PRINTED_COL, true);
    const keys = sh.getRange(2, idCol, last - 1, 1).getValues();
    const range = sh.getRange(2, col, last - 1, 1);
    const printed = range.getValues();
    const now = new Date();
    let count = 0;
    keys.forEach((r, i) => {
      if (!want.has(normalizeCode_(r[0]))) return;
      printed[i][0] = now;
      count++;
    });
    range.setValues(printed).setNumberFormat('dd/mm/yyyy');
    SpreadsheetApp.flush();
    return count;
  } finally {
    lock.releaseLock();
  }
}

function printedText_(value, tz) {
  if (value instanceof Date) return Utilities.formatDate(value, tz, 'dd/MM/yyyy');
  return String(value == null ? '' : value).trim();
}

/* ---------- Mã tải code ↔ đơn hàng: biết khách nào nhận mã nào ---------- */

/**
 * Tự chạy khi sửa Sheet. Lúc đóng hàng, shop gõ mã của thẻ bỏ vào hộp vào cột "Mã tải code" của đơn ở
 * trang "Đơn hàng" (nhiều hộp: các mã cách nhau bằng dấu phẩy; có máy quét thì quét QR trên thẻ cũng được).
 * Script ghi "Mã đơn" và "Khách hàng" sang trang "Mã tải code". Sửa mã đơn, tên hoặc SĐT thì cũng cập nhật theo.
 * Sửa Doanh thu, Chi phí thì Lợi nhuận tự tính (syncProfit_).
 */
function onEdit(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  if (sh.getName() !== ORDER_SHEET || e.range.getLastRow() < 2) return;
  const [rowFrom, rowTo, colFrom, colTo] = [e.range.getRow(), e.range.getLastRow(), e.range.getColumn(), e.range.getLastColumn()];
  if (watchesCodes_(sh, colFrom, colTo)) {
    const done = withDocLock_(() => linkCodes_(sh, rowFrom, rowTo));
    if (done && done.issue) sh.getParent().toast(done.issue, 'Chưa gán được mã', 8);
    else if (done && done.linked) sh.getParent().toast(`Đã ghi Mã đơn, Khách hàng ở trang "${CODE_SHEET}".`, 'Đã gán mã', 4);
  }
  if (watchesProfit_(sh, colFrom, colTo)) withDocLock_(() => syncProfit_(sh, rowFrom, rowTo));
}

/** Cột colFrom–colTo của trang "Đơn hàng" có "Mã đơn", "Họ tên", "SĐT" hoặc "Mã tải code": sửa thì phải gán lại mã. */
function watchesCodes_(sh, colFrom, colTo) {
  if (sh.getName() !== ORDER_SHEET) return false;
  const head = header_(sh);
  if (!head.includes(ORDER_KEY_COL)) return false;
  const watched = ['Mã đơn', 'Họ tên', 'SĐT', ORDER_KEY_COL].map((name) => head.indexOf(name) + 1);
  return watched.some((c) => c >= colFrom && c <= colTo);
}

/**
 * Đối chiếu mọi đơn với trang "Mã tải code": điền "Mã đơn", "Khách hàng" cho mã đã gán, xoá ở mã mà đơn
 * không còn ghi. Ô có mã sai được tô đỏ, rê chuột vào ô để xem lý do. Dòng from–to (vừa sửa) được viết lại
 * mã cho đúng dạng (VD "k7m3 q9xp" → "K7M3-Q9XP"). Trả { issue: lỗi đầu tiên ở các dòng vừa sửa, linked: có gán mã }.
 */
function linkCodes_(os, from, to) {
  const ss = os.getParent();
  const cs = ss.getSheetByName(CODE_SHEET);
  const last = os.getLastRow();
  if (!cs || !cs.getLastRow() || last < 2) return;
  // Không tìm được cột mã mà vẫn chạy tiếp thì mọi mã đang gán bị xoá khỏi đơn: dừng, không ghi gì
  const cols = codeCols_(cs);
  if (cols.missing) return { issue: codeColsIssue_(cols), linked: false };
  const head = header_(os);
  const [iId, iName, iPhone, iKey] = ['Mã đơn', 'Họ tên', 'SĐT', ORDER_KEY_COL].map((name) => head.indexOf(name));
  const orders = os.getRange(2, 1, last - 1, head.length).getValues();
  const text = (row, i) => (i < 0 ? '' : String(row[i] == null ? '' : row[i]).trim());

  const cOrder = colOf_(cs, 'Mã đơn', true);
  const cCustomer = colOf_(cs, 'Khách hàng', true);
  const codes = cs.getLastRow() > 1 ? cs.getRange(2, 1, cs.getLastRow() - 1, cs.getLastColumn()).getValues() : [];
  const index = new Map(); // mã đã chuẩn hoá → dòng ở trang "Mã tải code"
  codes.forEach((r, ci) => {
    const k = normalizeCode_(r[cols.id - 1]);
    if (k && !index.has(k)) index.set(k, ci);
  });
  const ids = new Set(orders.map((r) => text(r, iId)).filter(Boolean));

  // Đơn nào giữ mã nào. Một mã ghi ở 2 đơn: giữ đơn mà trang "Mã tải code" đang ghi (không có thì đơn ở trên)
  const owner = new Map();
  const parsed = orders.map((r) => parseCodes_(text(r, iKey)));
  const problems = parsed.map((p) => p.bad.map((t) => `"${t}" không phải mã tải code (8 ký tự, VD K7M3-Q9XP).`));
  parsed.forEach((p, i) => {
    const id = text(orders[i], iId);
    if (p.keys.length && !id) problems[i].push('Điền Mã đơn cho dòng này thì mới gán được mã.');
    p.keys.forEach((k) => {
      const ci = index.get(k);
      if (ci === undefined) {
        problems[i].push(`Không có mã ${showCode_(k)} ở trang "${CODE_SHEET}".`);
      } else if (isLocked_(codes[ci][cols.lock - 1])) {
        problems[i].push(`Mã ${codes[ci][cols.id - 1]} đã bị khoá.`);
      } else if (id && !owner.has(k)) {
        owner.set(k, i);
      } else if (id) {
        const prev = owner.get(k);
        const takeOver = text(codes[ci], cOrder - 1) === id && text(orders[prev], iId) !== id;
        if (takeOver) owner.set(k, i);
        const [keep, lose] = takeOver ? [i, prev] : [prev, i];
        problems[lose].push(`Mã ${codes[ci][cols.id - 1]} đã gán cho đơn ${text(orders[keep], iId)} (dòng ${keep + 2}).`);
      }
    });
  });

  // Chỉ ghi ô thay đổi: ghi lại cả cột có thể làm hỏng giá trị khác (VD mã đơn toàn số bị đổi thành số)
  codes.forEach((r, ci) => {
    const oi = owner.get(normalizeCode_(r[cols.id - 1]));
    let want;
    if (oi !== undefined) {
      const o = orders[oi];
      want = [text(o, iId), [text(o, iName), text(o, iPhone)].filter(Boolean).join(' – ')];
    } else if (ids.has(text(r, cOrder - 1))) {
      want = ['', '']; // đơn đó không còn ghi mã này
    } else {
      return; // mã chưa gán, hoặc đơn đã bị xoá khỏi trang "Đơn hàng": giữ nguyên
    }
    if (want[0] !== text(r, cOrder - 1)) cs.getRange(ci + 2, cOrder).setValue(safe_(want[0]));
    if (want[1] !== text(r, cCustomer - 1)) cs.getRange(ci + 2, cCustomer).setValue(safe_(want[1]));
  });

  const keyRange = os.getRange(2, iKey + 1, orders.length, 1);
  keyRange.setBackgrounds(problems.map((p) => [p.length ? '#F4CCCC' : null]));
  keyRange.setNotes(problems.map((p) => [p.join('\n')]));

  const edited = [];
  for (let row = Math.max(from, 2); row <= Math.min(to, last); row++) {
    const i = row - 2;
    edited.push(i);
    const shown = parsed[i].keys
      .map((k) => (index.has(k) ? String(codes[index.get(k)][cols.id - 1]).trim() : showCode_(k)))
      .concat(parsed[i].bad)
      .join(', ');
    if (shown !== text(orders[i], iKey)) os.getRange(row, iKey + 1).setValue(safe_(shown));
  }
  const issue = edited.map((i) => problems[i][0]).find(Boolean);
  return { issue: issue || '', linked: edited.some((i) => parsed[i].keys.length) };
}

/**
 * Đọc ô "Mã tải code" của một đơn: các mã cách nhau bằng dấu phẩy, chấm phẩy hoặc xuống dòng.
 * Nhận cả link đọc từ mã QR trên thẻ (…/huong-dan.html?ma=K7M3-Q9XP).
 */
function parseCodes_(value) {
  const keys = [];
  const bad = [];
  String(value == null ? '' : value)
    .replace(/\S*[?&]ma=([A-Za-z0-9-]+)\S*/gi, ',$1,')
    .split(/[,;\n]+/)
    .forEach((part) => {
      const k = normalizeCode_(part);
      if (!k) return;
      if (k.length % 8) {
        bad.push(part.trim());
        return;
      }
      // "K7M3-Q9XP A2B3-C4D5" trên cùng một dòng: tách mỗi 8 ký tự
      for (let i = 0; i < k.length; i += 8) {
        if (!keys.includes(k.slice(i, i + 8))) keys.push(k.slice(i, i + 8));
      }
    });
  return { keys, bad };
}

function showCode_(key) {
  return `${key.slice(0, 4)}-${key.slice(4)}`;
}

let docLockHeld_ = false; // Lần chạy này đang giữ khoá của Sheet: gọi lồng nhau thì không xin lại

/**
 * Hai việc cùng lúc không ghi đè, ghi nhầm dòng của nhau (VD đơn web mới chèn dòng trên cùng đúng lúc đang sửa trên web
 * hay gán mã). Chờ khoá tối đa 15 giây; không lấy được thì báo lỗi, không chạy.
 */
function withDocLock_(fn) {
  if (docLockHeld_) return fn();
  const lock = LockService.getDocumentLock();
  lock.waitLock(15000);
  docLockHeld_ = true;
  try {
    return fn();
  } finally {
    docLockHeld_ = false;
    SpreadsheetApp.flush(); // Ghi xong hẳn rồi mới nhả khoá: việc chờ sau đọc đúng dữ liệu mới
    lock.releaseLock();
  }
}

/* ---------- Lợi nhuận của đơn: tự tính khi shop điền đủ Doanh thu và Chi phí ---------- */

/** Số thứ tự cột Doanh thu, Chi phí, Lợi nhuận ở trang "Đơn hàng" (tìm theo tên); trang khác hoặc thiếu cột thì null. */
function profitCols_(sh) {
  if (sh.getName() !== ORDER_SHEET) return null;
  const head = header_(sh);
  const [revenue, cost, profit] = [ORDER_REVENUE_COL, ORDER_COST_COL, ORDER_PROFIT_COL].map((name) => head.indexOf(name) + 1);
  return revenue && cost && profit ? { revenue, cost, profit } : null;
}

/** Chỉ có dấu trừ, không có dấu phân cách đối số (Sheet vùng Việt Nam có thể dùng ";" thay ","): vùng nào cũng nhận. */
function profitFormula_(cols, row) {
  return `=${colName_(cols.revenue)}${row}-${colName_(cols.cost)}${row}`;
}

/** Cột colFrom–colTo có Doanh thu hoặc Chi phí: sửa thì phải chạy syncProfit_. */
function watchesProfit_(sh, colFrom, colTo) {
  const cols = profitCols_(sh);
  return Boolean(cols) && [cols.revenue, cols.cost].some((c) => c >= colFrom && c <= colTo);
}

/**
 * Dòng from–to: đủ 2 số Doanh thu, Chi phí mà ô Lợi nhuận còn trống thì đặt công thức; thiếu 1 trong 2 số thì xoá đúng
 * công thức đó (nếu không, đơn chỉ có doanh thu sẽ hiện lợi nhuận bằng cả doanh thu). Ô shop tự gõ số, công thức khác giữ nguyên.
 */
function syncProfit_(sh, from, to) {
  const cols = profitCols_(sh);
  const first = Math.max(from, 2);
  const last = Math.min(to, sh.getLastRow());
  if (!cols || last < first) return;
  const values = sh.getRange(first, 1, last - first + 1, sh.getLastColumn()).getValues();
  const formulas = sh.getRange(first, cols.profit, last - first + 1, 1).getFormulas();
  values.forEach((row, i) => {
    const wanted = profitFormula_(cols, first + i);
    const formula = formulas[i][0];
    const both = typeof row[cols.revenue - 1] === 'number' && typeof row[cols.cost - 1] === 'number';
    if (both && row[cols.profit - 1] === '' && !formula) sh.getRange(first + i, cols.profit).setFormula(wanted);
    else if (!both && formula.replace(/\s/g, '').toUpperCase() === wanted) sh.getRange(first + i, cols.profit).clearContent();
  });
}

/* ---------- Trang quản trị (quan-tri.html): admin xem, sửa Google Sheet ngay trên web ---------- */

const ADMIN_ACCOUNTS_KEY = 'quan-tri:tai-khoan'; // Script Properties: { tên: { salt, hash, ver, totp? } }, không lưu mật khẩu
const ADMIN_OFF_KEY = 'quan-tri:tat';             // Có giá trị (giờ tắt) = trang quản trị đang tắt: menu "Bật hoặc tắt trang quản trị…"
const ADMIN_CUTOFF_KEY = 'quan-tri:dang-xuat-luc'; // Phiên đăng nhập từ trước giờ này (lần tắt gần nhất) không dùng được nữa
const ADMIN_DEVICES_KEY = 'quan-tri:trinh-duyet:'; // + tên tài khoản: mã băm các trình duyệt đã đăng nhập xong, để chỉ báo email khi gặp trình duyệt lạ
const ADMIN_MAX_DEVICES = 30;  // Mỗi tài khoản nhớ bấy nhiêu trình duyệt mới nhất
const ADMIN_CODE_MINUTES = 5;  // Nhập đúng mật khẩu xong có bấy nhiêu phút để nhập mã 2 bước
const ADMIN_ALERT_HOURS = 6;   // Cùng một việc (VD cùng tài khoản bị khoá) chỉ báo email 1 lần trong bấy nhiêu giờ (tối đa 6)
const ADMIN_ALERTS_PER_HOUR = 5;  // Email báo của trang quản trị mỗi giờ, tính chung mọi loại
const ADMIN_ALERT_RESERVE = 20;   // Hạn mức email trong ngày còn từng này thì thôi báo: để dành cho email báo đơn
const ADMIN_HASH_ROUNDS = 1000;
const ADMIN_LOG_HEADER = ['Thời gian', 'Tài khoản', 'Việc', 'Trang tính', 'Vị trí', 'Trước', 'Sau'];
const ADMIN_BAD = 'Yêu cầu không hợp lệ. Tải lại trang rồi thử lại.';
const ADMIN_CONFLICT = 'Dòng này vừa thay đổi ở nơi khác (VD vừa sửa trên Google Sheet, có đơn mới hoặc vừa xoá dòng) ' +
  'nên chưa lưu. Đã tải lại dữ liệu mới nhất: kiểm tra rồi làm lại.';
const ADMIN_LOCKED = 'Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.';
const ADMIN_OFF_TEXT = 'Trang quản trị đang tắt. Bật lại trong Google Sheet: menu SmartCarTech → "Bật hoặc tắt trang quản trị…".';

/**
 * Trang tính script tự ghi: dòng 1 là tiêu đề, script tìm cột theo tên nên chỉ đổi trên Sheet. Trang "Mã tải code":
 * mã đã in trên thẻ nên không thêm, xoá dòng trên web; "Mã đơn", "Khách hàng" do script điền. Nhật ký chỉ xem.
 * Ô script tự tính, tự ghi chỉ xem trên trang quản trị (trên Google Sheet vẫn sửa được khi thật cần):
 * - readOnly: { cột: lý do } khoá ở mọi dòng, VD Lợi nhuận.
 * - web: các cột khoá ở dòng do web tạo (webRow_), VD Nền tảng của đơn website. Ô công thức ở trang nào cũng khoá.
 * - choices: { cột: lựa chọn } hiện ô thả xuống khi ô đó chưa có ô thả xuống riêng trên Sheet. Lựa chọn là hàm thì chỉ
 *   gọi khi gửi trang tính cho web (VD tên sản phẩm đọc từ products.json).
 * - qty: các cột chọn sản phẩm kèm số lượng, ghi "tên × số lượng" như đơn web (saveOrder_).
 */
const ADMIN_AUTO_DOWNLOAD = 'Script tự ghi khi khách tải code.';
const ADMIN_AUTO_LINK = 'Script tự điền khi gõ mã này vào một đơn ở trang Đơn hàng.';
const ADMIN_FORMULA = 'Ô công thức, tự tính: muốn đổi công thức thì sửa trên Google Sheet.';
const ADMIN_RULES = {
  [ORDER_SHEET]: {
    header: true,
    readOnly: { [ORDER_PROFIT_COL]: `Tự tính: ${ORDER_REVENUE_COL} trừ ${ORDER_COST_COL}.` },
    web: { why: 'Web tự ghi cho đơn đặt trên website.', cols: ['Thời gian', 'Mã đơn', ORDER_PLATFORM_COL, 'Sản phẩm', 'Tổng (₫)', ORDER_CHECK_COL] },
    choices: { [ORDER_PLATFORM_COL]: ORDER_PLATFORMS, 'Sản phẩm': () => productNames_() },
    qty: ['Sản phẩm'],
  },
  [LEAD_SHEET]: { header: true },
  [PRINT_SHEET]: {
    header: true,
    // Nội dung, Số lượng, Tạm tính vẫn sửa được: shop chốt lại với khách, yêu cầu in theo file chờ shop báo giá
    web: { why: 'Web tự ghi cho yêu cầu đặt trên website.', cols: ['Thời gian', 'Mã', 'Loại', ORDER_CHECK_COL] },
    choices: { 'Loại': PRINT_KINDS },
  },
  [CODE_SHEET]: {
    header: true, noAdd: true, noDelete: true,
    // "Số lần tải" vẫn sửa được: khách hết lượt tải thì shop đặt lại về 0
    readOnly: {
      [CODE_ID_COL]: 'Mã đã in trên thẻ nên không đổi.', [CODE_ID_OLD_COL]: 'Mã đã in trên thẻ nên không đổi.',
      'Mã đơn': ADMIN_AUTO_LINK, 'Khách hàng': ADMIN_AUTO_LINK,
      'Tải lần đầu': ADMIN_AUTO_DOWNLOAD, 'Tải gần nhất': ADMIN_AUTO_DOWNLOAD, 'File tải gần nhất': ADMIN_AUTO_DOWNLOAD,
      [PRINTED_COL]: 'Script tự ghi ngày in thẻ.',
    },
    tip: 'Tạo mã mới, in thẻ: mở Google Sheet → menu SmartCarTech. Mã đã in trên thẻ không xoá ở đây: muốn ngừng một mã thì tích ô Khoá.',
  },
  [DASHBOARD_SHEET]: {
    all: true,
    tip: 'Script tự tính từ các trang Đơn hàng, In 3D, Tư vấn, Mã tải code, Lượt truy cập mỗi lần mở trang này hoặc bấm Tải lại. Cách tính ở cuối trang.',
  },
  [VISIT_SHEET]: {
    all: true,
    tip: 'Mỗi dòng là 1 ngày, đếm ẩn danh. Hôm nay còn đang đếm nên chưa có ở đây: xem ở trang Tổng quan.',
  },
  [ADMIN_LOG_SHEET]: {
    all: true,
    tip: 'Mọi lần đăng nhập, sửa, thêm, xoá dòng trên trang quản trị. Dòng bị xoá được lưu đủ nội dung ở cột "Trước" để chép lại khi cần.',
  },
};
const ADMIN_ACTIONS = { doc: adminRead_, sua: adminEdit_, them: adminAppend_, xoa: adminDelete_ };

/** Mọi yêu cầu từ trang quản trị. Trừ 2 bước đăng nhập, việc nào cũng cần mã phiên còn hạn. Trang đang tắt thì từ chối hết. */
function adminApi_(data) {
  if (PropertiesService.getScriptProperties().getProperty(ADMIN_OFF_KEY)) return { ok: false, login: true, off: true, error: ADMIN_OFF_TEXT };
  if (data.action === 'dang-nhap') return adminLogin_(data);
  if (data.action === 'ma-2-buoc') return adminCode_(data);
  const session = adminSession_(data.token);
  if (!session) return { ok: false, login: true, error: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.' };
  if (data.action === 'dang-xuat') {
    CacheService.getScriptCache().remove(`qt:phien:${data.token}`);
    return { ok: true };
  }
  if (!ADMIN_ACTIONS.hasOwnProperty(data.action)) return { ok: false, error: ADMIN_BAD };
  return ADMIN_ACTIONS[data.action](data, session.user);
}

/**
 * Bước 1: tên và mật khẩu. Tài khoản chưa bật mã 2 bước: đúng là vào luôn (trả mã phiên). Đã bật: trả vé `ticket` dùng
 * ADMIN_CODE_MINUTES phút để nhập mã 6 số (adminCode_). Sai quá ADMIN_MAX_FAILS lần trong 15 phút (mật khẩu hay mã) thì
 * tạm khoá tài khoản đó, cả web sai quá 6 lần số đó thì tạm khoá mọi tài khoản: không ai dò được, kể cả khi thử nhiều tên.
 */
function adminLogin_(data) {
  const name = String(data.user == null ? '' : data.user).trim().toLowerCase().slice(0, 40);
  const password = String(data.pass == null ? '' : data.pass).slice(0, 200);
  const accounts = adminAccounts_();
  if (!Object.keys(accounts).length) {
    return { ok: false, error: 'Chưa có tài khoản quản trị. Mở Google Sheet của shop → menu SmartCarTech → "Tài khoản trang quản trị…" để tạo.' };
  }
  if (adminLocked_(name)) return { ok: false, error: ADMIN_LOCKED };
  const account = accounts.hasOwnProperty(name) ? accounts[name] : null;
  // Tên không có thật vẫn tính mã băm: thời gian trả lời như nhau, không dò được tên nào có thật
  const hash = passwordHash_(password, account ? account.salt : 'AAAAAAAAAAAAAAAAAAAAAA==');
  if (!account || !sameText_(hash, account.hash)) {
    adminFailed_(name, Boolean(account), false);
    return { ok: false, error: 'Sai tên đăng nhập hoặc mật khẩu.' };
  }
  const device = adminDevice_(data, name);
  if (!account.totp) return adminStart_(name, account, device, false);
  // Đúng mật khẩu trên trình duyệt lạ: báo ngay, kể cả khi người đó không có mã để đi tiếp
  if (!device.known) adminNewDevice_(name, account, device, true);
  const ticket = randomKey_();
  const step = { user: name, ver: account.ver, device, until: Date.now() + ADMIN_CODE_MINUTES * 60000, tries: 0 };
  CacheService.getScriptCache().put(`qt:buoc-2:${ticket}`, JSON.stringify(step), ADMIN_CODE_MINUTES * 60);
  // ok: false để bản trang cũ (chưa có ô nhập mã) hiện câu nhắc tải lại trang
  return { ok: false, needCode: true, ticket, user: name, error: 'Tài khoản này cần mã 2 bước: tải lại trang (Ctrl + F5) để có ô nhập mã.' };
}

/** Bước 2: mã 6 số trong ứng dụng xác minh. Mỗi vé nhập sai tối đa ADMIN_MAX_FAILS lần; mỗi mã chỉ dùng được 1 lần. */
function adminCode_(data) {
  const cache = CacheService.getScriptCache();
  const ticket = typeof data.ticket === 'string' && /^[\w-]{43}$/.test(data.ticket) ? data.ticket : '';
  const key = `qt:buoc-2:${ticket}`;
  let step = null;
  try {
    step = ticket ? JSON.parse(cache.get(key) || 'null') : null;
  } catch (err) {
    step = null;
  }
  // Vé tự hết hạn trong CacheService (lưu lại sau mỗi lần sai chỉ với thời gian còn lại, không gia hạn thêm)
  if (!step) return { ok: false, restart: true, error: `Đã quá ${ADMIN_CODE_MINUTES} phút kể từ lúc nhập mật khẩu. Vui lòng đăng nhập lại.` };
  const user = step.user;
  if (adminLocked_(user)) {
    cache.remove(key);
    return { ok: false, restart: true, error: ADMIN_LOCKED };
  }
  const accounts = adminAccounts_();
  const account = accounts.hasOwnProperty(user) ? accounts[user] : null;
  if (!account || account.ver !== step.ver || !account.totp) {
    cache.remove(key);
    return { ok: false, restart: true, error: 'Tài khoản vừa được đổi trên Google Sheet. Vui lòng đăng nhập lại.' };
  }
  const code = String(data.code == null ? '' : data.code).replace(/\s/g, '');
  const at = /^\d{6}$/.test(code) ? totpMatch_(account.totp, code) : -1;
  const usedKey = `qt:ma-da-dung:${user}`;
  // Mã đã dùng (VD ai đó nhìn thấy mã lúc bạn gõ) không dùng lại được, kể cả trong 30 giây mã còn hiện
  const reused = at >= 0 && at <= (Number(cache.get(usedKey)) || 0);
  if (at < 0 || reused) {
    adminFailed_(user, true, true);
    adminLog_(user, reused ? 'Mã 2 bước đã dùng rồi' : 'Sai mã 2 bước', '', step.device.label, '', '');
    step.tries += 1;
    if (adminLocked_(user)) {
      cache.remove(key);
      return { ok: false, restart: true, error: ADMIN_LOCKED };
    }
    if (step.tries >= ADMIN_MAX_FAILS) {
      cache.remove(key);
      return { ok: false, restart: true, error: 'Nhập sai mã quá nhiều lần. Vui lòng đăng nhập lại.' };
    }
    cache.put(key, JSON.stringify(step), Math.max(1, Math.ceil((step.until - Date.now()) / 1000)));
    return {
      ok: false,
      error: reused ? 'Mã này vừa được dùng. Chờ ứng dụng hiện mã mới rồi nhập.' : 'Mã chưa đúng. Nhập mã 6 số đang hiện trong ứng dụng xác minh (30 giây đổi một lần).',
    };
  }
  cache.put(usedKey, String(at), 4 * TOTP_STEP);
  cache.remove(key);
  return adminStart_(user, account, step.device, true);
}

/** Đăng nhập xong: tạo phiên, ghi nhật ký. Trình duyệt lạ: báo email (nếu bước 1 chưa báo), rồi nhớ trình duyệt này. */
function adminStart_(name, account, device, alerted) {
  const token = randomKey_();
  CacheService.getScriptCache().put(`qt:phien:${token}`, JSON.stringify({ user: name, ver: account.ver, since: Date.now() }), adminIdle_());
  if (!device.known) {
    if (!alerted) adminNewDevice_(name, account, device, false);
    adminRemember_(name, device.id);
  }
  adminLog_(name, 'Đăng nhập', '', device.known ? device.label : `${device.label} (trình duyệt mới)`, '', '');
  return { ok: true, token, user: name };
}

function adminLocked_(name) {
  return count_(`qt:sai:${name}`, 900) >= ADMIN_MAX_FAILS || count_('qt:sai', 900) >= ADMIN_MAX_FAILS * 6;
}

/** Đếm 1 lần sai: mật khẩu, hoặc mã 2 bước (`code`). Lần sai làm tài khoản (có thật) hay cả web bị khoá thì báo email. */
function adminFailed_(name, real, code) {
  const mine = bump_(`qt:sai:${name}`, 900);
  const all = bump_('qt:sai', 900);
  const codes = code ? bump_(`qt:sai-ma:${name}`, 900) : count_(`qt:sai-ma:${name}`, 900);
  const again = `Trong ${ADMIN_ALERT_HOURS} giờ tới không báo lại việc này.`;
  if (real && mine === ADMIN_MAX_FAILS) {
    adminAlert_(`khoa:${name}`, `SmartCarTech: tài khoản quản trị "${name}" bị tạm khoá`, [
      `Tài khoản "${name}" nhập sai ${ADMIN_MAX_FAILS} lần trong 15 phút nên bị khoá đăng nhập 15 phút (lúc ${adminNow_()}).`,
      codes
        ? `Trong đó ${codes} lần nhập đúng mật khẩu nhưng sai mã 2 bước. Nếu không phải bạn thì mật khẩu đã bị lộ: mở Google Sheet → menu SmartCarTech → "Tài khoản trang quản trị…" → đặt mật khẩu mới ngay.`
        : 'Nếu không phải bạn: có người đang thử mật khẩu. Nên dùng mật khẩu dài và bật mã 2 bước (menu SmartCarTech → "Tài khoản trang quản trị…").',
      again,
    ]);
  }
  if (all === ADMIN_MAX_FAILS * 6) {
    adminAlert_('khoa-web', 'SmartCarTech: trang quản trị bị tạm khoá vì có nhiều lần đăng nhập sai', [
      `Cả web có ${ADMIN_MAX_FAILS * 6} lần đăng nhập sai trong 15 phút nên mọi tài khoản bị khoá đăng nhập 15 phút (lúc ${adminNow_()}). Có thể có người đang dò mật khẩu.`,
      'Trong lúc khoá không ai vào được, Google Sheet vẫn dùng bình thường. Muốn chặn hẳn: menu SmartCarTech → "Bật hoặc tắt trang quản trị…".',
      again,
    ]);
  }
}

/**
 * Trình duyệt đang đăng nhập. Trang gửi kèm một mã ngẫu nhiên trình duyệt tự giữ (`may`) và chuỗi tự giới thiệu (`ua`).
 * Script chỉ lưu mã băm của `may`; `ua` ai cũng giả được nên chỉ dùng để ghi tên trình duyệt, không quyết định gì.
 */
function adminDevice_(data, name) {
  const raw = typeof data.may === 'string' && /^[\w-]{20,64}$/.test(data.may) ? data.may : '';
  const id = raw ? Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw)).slice(0, 22) : '';
  return { id, known: Boolean(id) && adminDevices_(name).hasOwnProperty(id), label: browserName_(data.ua) };
}

/** { mã băm trình duyệt: lúc đăng nhập xong lần đầu } của một tài khoản. */
function adminDevices_(name) {
  try {
    const list = JSON.parse(PropertiesService.getScriptProperties().getProperty(ADMIN_DEVICES_KEY + name) || '{}');
    return list && typeof list === 'object' ? list : {};
  } catch (err) {
    return {};
  }
}

/** Nhớ trình duyệt vừa đăng nhập xong: lần sau không báo email nữa. Giữ ADMIN_MAX_DEVICES trình duyệt mới nhất. */
function adminRemember_(name, id) {
  if (!id) return;
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) return; // bận thì thôi: lần sau trình duyệt này bị báo thêm 1 lần, không hại gì
  try {
    const list = adminDevices_(name);
    list[id] = Date.now();
    const keep = Object.keys(list).sort((a, b) => list[b] - list[a]).slice(0, ADMIN_MAX_DEVICES);
    PropertiesService.getScriptProperties().setProperty(ADMIN_DEVICES_KEY + name, JSON.stringify(Object.fromEntries(keep.map((k) => [k, list[k]]))));
  } finally {
    lock.releaseLock();
  }
}

/** "Chrome trên Windows", "Safari trên iPhone"…: đọc từ chuỗi trình duyệt tự giới thiệu. */
function browserName_(ua) {
  const s = String(ua == null ? '' : ua).slice(0, 500);
  const browser = [
    [/Edg(e|A|iOS)?\//, 'Edge'], [/coc_coc_browser/i, 'Cốc Cốc'], [/OPR\/|Opera/, 'Opera'], [/SamsungBrowser/, 'Samsung Internet'],
    [/Zalo/i, 'Zalo'], [/FBAN|FBAV/, 'Facebook'], [/Firefox\/|FxiOS/, 'Firefox'], [/Chrome\/|CriOS/, 'Chrome'], [/Safari\//, 'Safari'],
  ].find(([re]) => re.test(s));
  const os = [
    [/iPhone/, 'iPhone'], [/iPad/, 'iPad'], [/Android/, 'Android'], [/Windows/, 'Windows'], [/Mac OS X|Macintosh/, 'Mac'],
    [/CrOS/, 'Chromebook'], [/Linux/, 'Linux'],
  ].find(([re]) => re.test(s));
  if (!browser && !os) return 'Trình duyệt không rõ';
  return (browser ? browser[1] : 'Trình duyệt') + (os ? ` trên ${os[1]}` : '');
}

/**
 * Email báo tài khoản vừa nhập đúng mật khẩu (`needCode`: còn phải nhập mã 2 bước) trên một trình duyệt lạ. Khoá báo
 * gồm cả `ver`: đổi mật khẩu thì trình duyệt nào cũng được báo lại, kể cả trình duyệt vừa báo trong vài giờ trước.
 */
function adminNewDevice_(name, account, device, needCode) {
  adminAlert_(`moi:${name}:${account.ver}:${device.id || 'khong-ro'}`, `SmartCarTech: tài khoản quản trị "${name}" đăng nhập trên trình duyệt lạ`, [
    needCode
      ? `Tài khoản "${name}" vừa được nhập đúng mật khẩu trên một trình duyệt chưa từng đăng nhập trang quản trị. Tài khoản này đã bật mã 2 bước: người đó còn phải nhập mã trên điện thoại của bạn mới vào được.`
      : `Tài khoản "${name}" vừa đăng nhập trang quản trị trên một trình duyệt chưa từng dùng. Tài khoản này chưa bật mã 2 bước: nên bật ở menu SmartCarTech → "Tài khoản trang quản trị…".`,
    '',
    `Lúc: ${adminNow_()}`,
    `Trình duyệt: ${device.label} (do trình duyệt tự báo)`,
    '',
    'Nếu là bạn: không cần làm gì. Đăng nhập xong thì trình duyệt này không bị báo nữa.',
    `Nếu không phải bạn: mở Google Sheet → menu SmartCarTech → "Tài khoản trang quản trị…" → đặt mật khẩu mới cho "${name}" (mọi nơi đang đăng nhập bằng tài khoản này bị đăng xuất). Muốn chặn hẳn ngay: menu SmartCarTech → "Bật hoặc tắt trang quản trị…".`,
  ]);
}

/**
 * Email báo của trang quản trị, tới NOTIFY_EMAIL. Mỗi việc (`key`) báo 1 lần trong ADMIN_ALERT_HOURS giờ, tối đa
 * ADMIN_ALERTS_PER_HOUR email mỗi giờ, và chừa ADMIN_ALERT_RESERVE email trong ngày cho email báo đơn: bị dò mật khẩu
 * dồn dập cũng không làm hết hạn mức. Gửi lỗi thì bỏ qua: đăng nhập vẫn chạy bình thường.
 */
function adminAlert_(key, subject, lines) {
  if (!NOTIFY_EMAIL) return false;
  const cache = CacheService.getScriptCache();
  if (cache.get(`qt:bao:${key}`)) return false;
  cache.put(`qt:bao:${key}`, '1', Math.min(21600, ADMIN_ALERT_HOURS * 3600));
  if (bump_('qt:bao', 3600) > ADMIN_ALERTS_PER_HOUR) return false;
  try {
    if (MailApp.getRemainingDailyQuota() <= ADMIN_ALERT_RESERVE) return false;
    MailApp.sendEmail(NOTIFY_EMAIL, subject, lines.concat(['', `Email tự động từ Google Sheet của shop (trang quản trị ${SITE_URL}/quan-tri.html).`]).join('\n'));
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

function adminNow_() {
  return Utilities.formatDate(new Date(), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'dd/MM/yyyy HH:mm');
}

/**
 * Phiên còn hạn: tài khoản còn, chưa đổi mật khẩu hay bật mã 2 bước, chưa quá ADMIN_MAX_HOURS kể từ lúc đăng nhập, và
 * không có trước lần tắt trang quản trị gần nhất. Mỗi lần dùng được gia hạn thêm ADMIN_IDLE_HOURS.
 */
function adminSession_(token) {
  if (typeof token !== 'string' || !/^[\w-]{40,64}$/.test(token)) return null;
  const cache = CacheService.getScriptCache();
  const key = `qt:phien:${token}`;
  let session = null;
  try {
    session = JSON.parse(cache.get(key) || 'null');
  } catch (err) {
    session = null;
  }
  if (!session) return null;
  const accounts = adminAccounts_();
  const account = accounts.hasOwnProperty(session.user) ? accounts[session.user] : null;
  const cutoff = Number(PropertiesService.getScriptProperties().getProperty(ADMIN_CUTOFF_KEY)) || 0;
  if (!account || account.ver !== session.ver || session.since <= cutoff || Date.now() - session.since > ADMIN_MAX_HOURS * 3600000) {
    cache.remove(key);
    return null;
  }
  cache.put(key, JSON.stringify(session), adminIdle_());
  return session;
}

function adminIdle_() {
  return Math.min(21600, Math.max(300, Math.round(ADMIN_IDLE_HOURS * 3600))); // CacheService giữ tối đa 6 giờ
}

/** Tài khoản trang quản trị, lưu trong Script Properties: chỉ người sửa được script mới xem được, và chỉ thấy mã băm. */
function adminAccounts_() {
  try {
    const accounts = JSON.parse(PropertiesService.getScriptProperties().getProperty(ADMIN_ACCOUNTS_KEY) || '{}');
    return accounts && typeof accounts === 'object' ? accounts : {};
  } catch (err) {
    return {};
  }
}

/** PBKDF2-HMAC-SHA256 có muối: lộ Script Properties cũng không đọc ngược ra được mật khẩu. */
function passwordHash_(password, salt) {
  const key = Utilities.newBlob(String(password)).getBytes();
  let u = Utilities.computeHmacSha256Signature(Utilities.base64Decode(salt).concat([0, 0, 0, 1]), key);
  const out = u.slice();
  for (let i = 1; i < ADMIN_HASH_ROUNDS; i++) {
    u = Utilities.computeHmacSha256Signature(u, key);
    for (let j = 0; j < out.length; j++) out[j] ^= u[j];
  }
  return Utilities.base64Encode(out);
}

/** So 2 chuỗi mất cùng một thời gian dù khác ở ký tự nào. */
function sameText_(a, b) {
  const x = String(a);
  const y = String(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x.charCodeAt(i) || 0) ^ (y.charCodeAt(i) || 0);
  return diff === 0;
}

/** Chuỗi ngẫu nhiên 43 ký tự (256 bit), không đoán được: mã phiên, muối, phiên bản tài khoản. */
function randomKey_() {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid());
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/, '');
}

/* Mã 2 bước (TOTP, RFC 6238): ứng dụng xác minh trên điện thoại (VD Google Authenticator) và script cùng tính mã 6 số
   từ khoá bí mật và giờ hiện tại, 30 giây đổi một lần. Khoá chỉ hiện 1 lần lúc cài, lưu cùng tài khoản trong Script
   Properties (chỉ người sửa được script mới đọc được). Nhận cả mã của 30 giây trước và sau: giờ điện thoại lệch
   một chút vẫn đăng nhập được. */
const TOTP_STEP = 30;
const TOTP_ISSUER = 'SmartCarTech';
const BASE32_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

/** Khoá mới: 160 bit ngẫu nhiên, viết bằng 32 chữ base32 (dạng các ứng dụng xác minh đọc được). */
function newTotpKey_() {
  return base32_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid() + Utilities.getUuid()).slice(0, 20));
}

/** Byte[] → base32 (RFC 4648), không có dấu = ở cuối. */
function base32_(bytes) {
  let out = '';
  let value = 0;
  let bits = 0;
  bytes.forEach((b) => {
    value = ((value << 8) | (b & 255)) & 0xfff;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_CHARS[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  });
  if (bits) out += BASE32_CHARS[(value << (5 - bits)) & 31];
  return out;
}

/** base32 → Byte[] của Apps Script (số từ -128 đến 127). Bỏ qua khoảng trắng, dấu = và chữ thường. */
function unbase32_(text) {
  const out = [];
  let value = 0;
  let bits = 0;
  String(text).toUpperCase().replace(/[\s=]/g, '').split('').forEach((ch) => {
    const i = BASE32_CHARS.indexOf(ch);
    if (i < 0) throw new Error(`Khoá mã 2 bước có ký tự lạ: ${ch}`);
    value = ((value << 5) | i) & 0xfff;
    bits += 5;
    if (bits >= 8) {
      const b = (value >>> (bits - 8)) & 255;
      out.push(b > 127 ? b - 256 : b);
      bits -= 8;
    }
  });
  return out;
}

/** Mã 6 số của khoá `key` ở khoảng 30 giây thứ `step` (đếm từ năm 1970). */
function totpCode_(key, step) {
  const msg = new Array(8).fill(0);
  let n = step;
  for (let i = 7; i >= 0 && n > 0; i--) {
    const b = n % 256;
    msg[i] = b > 127 ? b - 256 : b;
    n = Math.floor(n / 256);
  }
  const h = Utilities.computeHmacSignature(Utilities.MacAlgorithm.HMAC_SHA_1, msg, unbase32_(key)).map((b) => b & 255);
  const off = h[h.length - 1] & 15;
  const bin = ((h[off] & 127) << 24) | (h[off + 1] << 16) | (h[off + 2] << 8) | h[off + 3];
  return String(bin % 1000000).padStart(6, '0');
}

/** Mã khớp khoảng 30 giây nào (bây giờ, ngay trước hoặc ngay sau): trả số thứ tự khoảng đó, không khớp thì -1. */
function totpMatch_(key, code) {
  const now = Math.floor(Date.now() / 1000 / TOTP_STEP);
  return [now, now - 1, now + 1].find((step) => sameText_(totpCode_(key, step), code)) ?? -1;
}

/** Đường dẫn otpauth:// trong mã QR: ứng dụng xác minh đọc tên shop, tên tài khoản và khoá từ đây. */
function totpUri_(name, key) {
  return `otpauth://totp/${encodeURIComponent(`${TOTP_ISSUER}:${name}`)}?secret=${key}&issuer=${encodeURIComponent(TOTP_ISSUER)}`;
}

/**
 * Danh sách trang tính và nội dung trang đang mở (không có tên đó thì mở trang đầu tiên). Mở trang Tổng quan thì số liệu
 * được tính lại và gửi kèm (`dashboard`) để web vẽ biểu đồ. Lần đầu sau khi dán script, trang Tổng quan được tạo ở đầu.
 */
function adminRead_(data, user) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let dashboard = ss.getSheetByName(DASHBOARD_SHEET) ? null : dashboardFor_(ss);
  const sheets = ss.getSheets();
  const sh = adminSheet_(data.sheet) || sheets[0];
  const own = sh.getName() === DASHBOARD_SHEET;
  if (own && !dashboard) dashboard = dashboardFor_(ss);
  // Trang cùng tên do shop tự tạo (không có ghi chú của script ở ô A1): hiện như trang tính thường
  if (!own || sh.getRange(1, 1).getNote() !== DASH_MARK) dashboard = null;
  return {
    ok: true,
    user,
    url: ss.getUrl(),
    log: ADMIN_LOG_SHEET,
    sheets: sheets.map((s) => ({ name: s.getName(), hidden: s.isSheetHidden() })),
    sheet: sheetView_(sh),
    dashboard,
  };
}

/** Số liệu Tổng quan cho trang quản trị: tính lại và ghi trang trong Sheet; Sheet đang bận thì chỉ tính, không ghi. */
function dashboardFor_(ss) {
  try {
    return refreshDashboard_(ss);
  } catch (err) {
    console.warn(err);
    return dashboardData_(ss, new Date());
  }
}

function adminSheet_(name) {
  return typeof name === 'string' && name ? SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name) : null;
}

function sheetGone_(name) {
  return { ok: false, conflict: true, error: `Không còn trang tính "${String(name).slice(0, 100)}" (có thể vừa đổi tên hoặc xoá trên Google Sheet).` };
}

/**
 * Luật của trang tính cho trang quản trị, cột tìm theo tên ở dòng 1 (cột không có thì bỏ qua). `lists`: tính cả các lựa
 * chọn cần đọc products.json (chỉ khi gửi trang tính cho web; lúc sửa, thêm dòng không cần).
 */
function adminRules_(sh, lists) {
  const rule = ADMIN_RULES.hasOwnProperty(sh.getName()) ? ADMIN_RULES[sh.getName()] : {};
  const head = rule.readOnly || rule.web || rule.choices ? header_(sh).map(matchText_) : [];
  const at = (name) => head.indexOf(matchText_(name)) + 1;
  const cols = [];
  const why = {};
  Object.entries(rule.readOnly || {}).forEach(([name, reason]) => {
    const col = at(name);
    if (!col) return;
    cols.push(col);
    why[col] = reason;
  });
  const choices = {};
  Object.entries(rule.choices || {}).forEach(([name, list]) => {
    if (typeof list === 'function') list = lists ? list() : [];
    if (at(name) && list.length) choices[at(name)] = list;
  });
  return {
    all: Boolean(rule.all),
    header: Boolean(rule.header),
    cols,
    why,
    web: rule.web ? rule.web.cols.map(at).filter(Boolean) : [],
    webWhy: rule.web ? rule.web.why : '',
    choices,
    qty: (rule.qty || []).map(at).filter((col) => col && choices[col]),
    add: !rule.all && !rule.noAdd,
    del: !rule.all && !rule.noDelete,
    tip: rule.tip || '',
    top: NEWEST_FIRST.includes(sh.getName()) || ADMIN_NEWEST_FIRST.some((name) => matchText_(name) === matchText_(sh.getName())),
  };
}

/**
 * Dòng tiêu đề cột, giống headerRowOf trong admin.js: trang script tự ghi là dòng 1; trang khác là các dòng cố định
 * (nếu có), hoặc dòng 1 hay 2 nếu có ít nhất 2 ô, toàn chữ, không gộp ô. Không có dòng tiêu đề thì 0.
 */
function headRow_(sh, rules) {
  if (rules.header) return 1;
  const last = sh.getLastRow();
  const frozen = sh.getFrozenRows();
  if (frozen) return Math.min(frozen, last);
  const cols = sh.getLastColumn();
  if (!last || !cols) return 0;
  const n = Math.min(2, last);
  const values = sh.getRange(1, 1, n, cols).getValues();
  const merges = tryGet_(() => sh.getRange(1, 1, n, cols).getMergedRanges()) || [];
  for (let r = 1; r <= n; r++) {
    const filled = values[r - 1].filter((v) => v !== '' && v != null);
    const merged = merges.some((m) => m.getRow() <= r && r < m.getRow() + m.getNumRows());
    if (filled.length >= 2 && filled.every((v) => typeof v === 'string') && !merged) return r;
    if (filled.length > 1) break;
  }
  return 0;
}

function editable_(rules, row, col) {
  return !rules.all && !(rules.header && row === 1) && !rules.cols.includes(col);
}

/**
 * Dòng do web tạo: đơn đặt trên website (Nền tảng "Website", hoặc trống mà mã đơn dạng SC…) hay yêu cầu ở trang In 3D
 * (mã IN…). `values`: các ô của dòng (giá trị hoặc chữ hiện), `names`: dòng 1 đã qua matchText_.
 */
function webRow_(sh, values, names) {
  const cell = (name) => {
    const i = names.indexOf(matchText_(name));
    return i < 0 || values[i] == null ? '' : values[i];
  };
  if (sh.getName() === ORDER_SHEET) return platformOf_(cell(ORDER_PLATFORM_COL), String(cell('Mã đơn')).trim()) === WEB_PLATFORM;
  if (sh.getName() === PRINT_SHEET) return /^IN\d{6}-\d{4}$/.test(String(cell('Mã')).trim());
  return false;
}

/** Ô `col` của dòng `row` không sửa được trên trang quản trị: trả lý do, sửa được thì trả chuỗi rỗng. */
function adminLock_(rules, row, col, web, formula) {
  if (rules.header && row === 1) return 'chỉ sửa được trên Google Sheet.';
  if (!editable_(rules, row, col)) return rules.why[col] || 'chỉ sửa được trên Google Sheet.';
  if (web && rules.web.includes(col)) return rules.webWhy;
  return formula ? ADMIN_FORMULA : '';
}

/** Câu báo khi trang quản trị gửi sửa một ô bị khoá, VD "Ô Q5 (Lợi nhuận): Tự tính: …". */
function lockText_(sh, row, col, reason) {
  const where = `Ô ${colName_(col)}${row}`;
  return /^chỉ /.test(reason) ? `${where} ${reason}` : `${where} (${header_(sh)[col - 1] || colName_(col)}): ${reason}`;
}

/**
 * Nội dung một trang tính: chữ hiện như trên Sheet, chữ để sửa, màu nền, màu chữ, chữ đậm, ghi chú, ô tích, ô thả
 * xuống, ô gộp, độ rộng cột. Trang lớn hơn ADMIN_MAX_CELLS ô: chỉ gửi các dòng tiêu đề và các dòng cuối (mới nhất).
 */
function sheetView_(sh) {
  const ctx = gridContext_(sh);
  const rows = sh.getLastRow();
  const cols = sh.getLastColumn();
  const view = {
    name: sh.getName(), id: sh.getSheetId(), rows, cols, frozen: sh.getFrozenRows(), rules: adminRules_(sh, true),
    dec: ctx.dec, images: tryGet_(() => sh.getImages().length) || 0, formulas: false,
    widths: [], kinds: [], merges: [], lists: [], rowNums: [], hashes: [], cells: [], webRows: [],
  };
  if (!rows || !cols) return view;
  const head = Math.min(rows, Math.max(view.frozen, 1));
  const fit = Math.max(head + 1, Math.floor(ADMIN_MAX_CELLS / cols));
  // Trang mới nhất ở trên: các dòng đầu; trang khác: dòng tiêu đề và các dòng cuối
  const parts = rows <= fit ? [[1, rows]] : view.rules.top ? [[1, fit]] : [[1, head], [rows - (fit - head) + 1, rows]];
  const names = view.rules.web.length ? header_(sh).map(matchText_) : null;
  const kinds = [];
  parts.forEach(([from, to]) => {
    gridRows_(sh.getRange(from, 1, to - from + 1, cols), ctx).forEach((r, i) => {
      view.rowNums.push(from + i);
      view.hashes.push(r.hash);
      view.cells.push(r.cells);
      if (from + i > head) kinds.push(r.kinds);
      if (names && from + i > 1 && webRow_(sh, shownOf_(r.cells), names)) view.webRows.push(from + i);
    });
  });
  view.kinds = Array.from({ length: cols }, (_, c) => majorityKind_(kinds.map((k) => k[c])));
  view.widths = tryGet_(() => Array.from({ length: cols }, (_, c) => sh.getColumnWidth(c + 1))) || [];
  view.merges = (tryGet_(() => sh.getRange(1, 1, rows, cols).getMergedRanges()) || [])
    .map((m) => [m.getRow(), m.getColumn(), m.getNumRows(), m.getNumColumns()]);
  view.lists = ctx.lists;
  view.formulas = ctx.formulas;
  return view;
}

/** Chữ hiện của các ô một dòng (gridRows_), ô trống là "". */
function shownOf_(cells) {
  return cells.map((cell) => (cell && cell.d) || '');
}

/** Múi giờ, dấu thập phân theo vùng của Sheet (VD vi_VN: 1,5) và các danh sách thả xuống đã gặp khi đọc. */
function gridContext_(sh) {
  const ss = sh.getParent();
  const locale = tryGet_(() => ss.getSpreadsheetLocale()) || 'vi_VN';
  return {
    tz: ss.getSpreadsheetTimeZone(),
    dec: /^(vi|de|fr|es|it|pt|ru|id|nl|tr|pl|cs|da|fi|nb|sv|uk|ro|hu|el|bg|hr|sk|sl|lt|lv|et)/i.test(locale) ? ',' : '.',
    lists: [], listIndex: new Map(), ranges: new Map(), formulas: false,
  };
}

/** Các dòng của `range`; ô trống hẳn (không chữ, màu, ghi chú) là null cho dữ liệu gửi đi gọn. */
function gridRows_(range, ctx) {
  const values = range.getValues();
  const shown = range.getDisplayValues();
  const formulas = range.getFormulas();
  const notes = tryGet_(() => range.getNotes());
  const bgs = tryGet_(() => range.getBackgrounds());
  const colors = tryGet_(() => range.getFontColors());
  const weights = tryGet_(() => range.getFontWeights());
  const rules = tryGet_(() => range.getDataValidations());
  const color = (list, r, c, plain) => {
    const v = list && String(list[r][c] || '').toLowerCase();
    return v && /^#[0-9a-f]{6}$/.test(v) && v !== plain ? v : '';
  };
  return values.map((row, r) => ({
    hash: rowHash_(row),
    kinds: row.map(cellKind_),
    cells: row.map((value, c) => {
      const cell = {};
      const text = shown[r][c];
      const formula = formulas[r][c];
      const kind = cellKind_(value);
      if (text !== '') cell.d = text;
      if (kind && kind !== 's') cell.t = kind;
      const edit = formula || editText_(value, text, ctx);
      if (edit !== text) cell.e = edit;
      if (formula) {
        cell.f = 1;
        ctx.formulas = true;
      }
      if (notes && notes[r][c]) cell.n = String(notes[r][c]);
      const bg = color(bgs, r, c, '#ffffff');
      const fc = color(colors, r, c, '#000000');
      if (bg) cell.bg = bg;
      if (fc) cell.fc = fc;
      if (weights && weights[r][c] === 'bold') cell.b = 1;
      const rule = rules && rules[r][c] ? ruleView_(rules[r][c], ctx) : null;
      if (rule !== null) cell.v = rule;
      return Object.keys(cell).length ? cell : null;
    }),
  }));
}

/** Ô tích → "c"; ô thả xuống → số thứ tự danh sách lựa chọn trong ctx.lists (nhiều ô cùng danh sách chỉ gửi 1 lần). */
function ruleView_(rule, ctx) {
  const C = SpreadsheetApp.DataValidationCriteria;
  const type = rule.getCriteriaType();
  const args = rule.getCriteriaValues() || [];
  let list;
  if (type === C.CHECKBOX) {
    if (!args.length) return 'c';
    list = args.filter((v) => v !== '' && v != null).map(String); // ô tích dùng giá trị riêng, VD "Có" / "Không"
  } else if (type === C.VALUE_IN_LIST) {
    list = (args[0] || []).map(String);
  } else if (type === C.VALUE_IN_RANGE && args[0]) {
    const key = `${args[0].getSheet().getName()}!${args[0].getA1Notation()}`;
    if (!ctx.ranges.has(key)) {
      ctx.ranges.set(key, [...new Set(args[0].getDisplayValues().flat().map((s) => s.trim()).filter(Boolean))].slice(0, 500));
    }
    list = ctx.ranges.get(key);
  } else {
    return null;
  }
  const id = JSON.stringify(list);
  if (!ctx.listIndex.has(id)) {
    ctx.listIndex.set(id, ctx.lists.length);
    ctx.lists.push(list);
  }
  return ctx.listIndex.get(id);
}

/** "" ô trống, "s" chữ, "n" số, "d" ngày giờ, "b" đúng/sai, "o" thứ khác (VD hình ảnh trong ô). */
function cellKind_(value) {
  if (value === '' || value == null) return '';
  if (value instanceof Date) return 'd';
  if (typeof value === 'number') return 'n';
  if (typeof value === 'boolean') return 'b';
  return typeof value === 'string' ? 's' : 'o';
}

/** Kiểu của đa số ô trong cột ("" khi cột chưa có dữ liệu): ô trống mới gõ thì ghi theo kiểu này, VD cột "Tổng (₫)" là số. */
function majorityKind_(kinds) {
  const count = {};
  let total = 0;
  kinds.forEach((k) => {
    if (!k) return;
    count[k] = (count[k] || 0) + 1;
    total++;
  });
  const top = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
  if (!top) return '';
  return count[top] * 2 >= total && top !== 'o' ? top : 's';
}

function columnKind_(sh, col) {
  const skip = Math.max(sh.getFrozenRows(), 1);
  const last = sh.getLastRow();
  return last > skip ? majorityKind_(sh.getRange(skip + 1, col, last - skip, 1).getValues().map((r) => cellKind_(r[0]))) : '';
}

/** Chữ hiện trong ô sửa: số không có dấu nghìn (2980000, 1,5, 15%), ngày dd/mm/yyyy hh:mm:ss theo múi giờ của Sheet. */
function editText_(value, shown, ctx) {
  if (value instanceof Date) {
    const time = Utilities.formatDate(value, ctx.tz, 'HH:mm:ss');
    if (value.getFullYear() < 1900) return time; // ô chỉ có giờ (Sheet tính từ 30/12/1899)
    return Utilities.formatDate(value, ctx.tz, 'dd/MM/yyyy') + (time === '00:00:00' ? '' : ` ${time}`);
  }
  if (typeof value === 'number') {
    const pct = /%\s*$/.test(shown);
    return String(pct ? Number((value * 100).toPrecision(12)) : value).replace('.', ctx.dec) + (pct ? '%' : '');
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  return value !== null && typeof value === 'object' ? shown : String(value);
}

/**
 * Chữ admin gõ → giá trị ghi vào ô, giống gõ trên Sheet nhưng giữ đúng kiểu của ô (kind, xem cellKind_; ô trống
 * thì theo kiểu đa số của cột): "=…" là công thức; ô số nhận "2.980.000", "1,5", "15%"; ô ngày nhận "31/10/2026 14:30".
 * Số 0 ở đầu (SĐT), dấu + ở đầu, số dài hơn 15 chữ số (mã đơn) luôn giữ dạng chữ.
 */
function cellInput_(input, kind, format, ctx) {
  if (typeof input === 'boolean') return { value: input };
  const text = String(input == null ? '' : input).replace(/\r\n?/g, '\n').trim().slice(0, 50000);
  if (text === '') return { value: '' };
  if (text[0] === '=') return { formula: text };
  if (kind === 'd') {
    const date = dateFrom_(text, ctx.tz);
    if (date) return { value: date };
  }
  if (kind === 'n' || kind === '') {
    const n = numberFrom_(text, ctx.dec);
    if (n !== null) return { value: n };
  }
  if (kind === 'b' && /^(true|false)$/i.test(text)) return { value: /^true$/i.test(text) };
  // Chữ: thêm dấu ' để Sheet không tự đổi thành số, ngày (ô định dạng "Văn bản thuần" thì Sheet không đổi)
  if (format === '@' || text[0] === "'" || !/^[+\-@0-9.,$₫(]|^(true|false)$/i.test(text)) return { value: text };
  return { value: `'${text}` };
}

/** "2.980.000", "2980000", "1,5", "15%", "119.000đ" → số; dec là dấu thập phân của Sheet. Không phải số thì null. */
function numberFrom_(text, dec) {
  let s = String(text).replace(/[\s\u00a0]/g, '').replace(/(₫|đ|vnđ|vnd)$/i, '');
  const pct = s.endsWith('%');
  if (pct) s = s.slice(0, -1);
  const group = dec === ',' ? '.' : ',';
  const g = group === '.' ? '\\.' : ',';
  const d = dec === '.' ? '\\.' : ',';
  let plain = null;
  if (new RegExp(`^-?\\d{1,3}(${g}\\d{3})+(${d}\\d+)?$`).test(s)) plain = s.split(group).join('').replace(dec, '.');
  else if (new RegExp(`^-?\\d+(${d}\\d+)?$`).test(s)) plain = s.replace(dec, '.');
  else if (new RegExp(`^-?\\d+${g}(\\d{1,2}|\\d{4,})$`).test(s)) plain = s.replace(group, '.'); // VD gõ 1.5 khi Sheet dùng dấu phẩy
  if (plain === null || /^-?0\d/.test(plain) || plain.replace(/\D/g, '').length > 15) return null;
  const n = Number(plain);
  return Number.isFinite(n) ? (pct ? n / 100 : n) : null;
}

/** "31/10/2026", "31/10/2026 14:30", "14:30" (ô chỉ có giờ) → Date theo múi giờ của Sheet; sai ngày (VD 31/02) thì null. */
function dateFrom_(text, tz) {
  const m = String(text).trim().match(/^(?:(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4}))?\s*(?:(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m || (!m[1] && !m[4])) return null;
  const [d, mo, y] = m[1] ? [m[1], m[2], m[3]].map(Number) : [30, 12, 1899];
  const [h, mi, se] = [m[4], m[5], m[6]].map((v) => Number(v || 0));
  if (mo < 1 || mo > 12 || d < 1 || d > new Date(Date.UTC(y, mo, 0)).getUTCDate() || h > 23 || mi > 59 || se > 59) return null;
  const pad = (n) => String(n).padStart(2, '0');
  return Utilities.parseDate(`${pad(d)}/${pad(mo)}/${y} ${pad(h)}:${pad(mi)}:${pad(se)}`, tz, 'dd/MM/yyyy HH:mm:ss');
}

/** Giá trị mới giống hệt ô hiện có: không ghi, không ghi nhật ký. */
function sameCell_(before, formula, next) {
  if (next.formula !== undefined) return next.formula === formula;
  if (formula) return false;
  const v = next.value;
  if (v instanceof Date) return before instanceof Date && before.getTime() === v.getTime();
  if (typeof v === 'string') return typeof before === 'string' && before === v.replace(/^'/, '');
  return before === v;
}

/** Mã nhận diện nội dung một dòng (băm cyrb53). Web gửi kèm khi sửa, xoá: dòng đã đổi thì không ghi. */
function rowHash_(row) {
  const cells = row.map((v) => (v instanceof Date ? `d${v.getTime()}` : v !== null && typeof v === 'object' ? 'o' : `${typeof v}:${v}`));
  while (cells.length && cells[cells.length - 1] === 'string:') cells.pop();
  const s = cells.join('\u0001');
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Sửa các ô của một dòng. Web gửi kèm mã của dòng lúc tải: dòng đã đổi (VD vừa sửa trên Sheet, vừa xoá dòng phía
 * trên) thì không ghi gì. Sửa cột "Mã tải code" (hoặc mã đơn, tên, SĐT) ở trang "Đơn hàng" thì gán mã như khi gõ trên Sheet.
 */
function adminEdit_(data, user) {
  const sh = adminSheet_(data.sheet);
  if (!sh) return sheetGone_(data.sheet);
  const row = Number(data.row);
  const items = Array.isArray(data.cells) ? data.cells : [];
  if (!Number.isInteger(row) || row < 1 || !items.length || items.length > 500) return { ok: false, error: ADMIN_BAD };
  const rules = adminRules_(sh);
  return withDocLock_(() => {
    const width = sh.getLastColumn();
    if (row > sh.getLastRow()) return { ok: false, conflict: true, error: ADMIN_CONFLICT };
    const range = sh.getRange(row, 1, 1, width);
    const values = range.getValues()[0];
    if (rowHash_(values) !== data.hash) return { ok: false, conflict: true, error: ADMIN_CONFLICT };
    const ctx = gridContext_(sh);
    const formulas = range.getFormulas()[0];
    const shown = range.getDisplayValues()[0];
    const names = rules.web.length ? header_(sh).map(matchText_) : null;
    const web = Boolean(names) && webRow_(sh, values, names);
    const changes = [];
    for (const item of items) {
      const col = Number(item && item.col);
      if (!Number.isInteger(col) || col < 1 || col > width) return { ok: false, error: ADMIN_BAD };
      const lock = cellKind_(values[col - 1]) === 'o' ? 'chỉ sửa được trên Google Sheet.' : adminLock_(rules, row, col, web, formulas[col - 1]);
      if (lock) return { ok: false, error: lockText_(sh, row, col, lock) };
      const cell = sh.getRange(row, col);
      const kind = cellKind_(values[col - 1]) || columnKind_(sh, col);
      const next = cellInput_(item.value, kind, cell.getNumberFormat(), ctx);
      if (!sameCell_(values[col - 1], formulas[col - 1], next)) changes.push({ cell, col, next, before: formulas[col - 1] || shown[col - 1] });
    }
    changes.forEach((ch) => (ch.next.formula !== undefined ? ch.cell.setFormula(ch.next.formula) : ch.cell.setValue(ch.next.value)));
    const linked = changes.some((ch) => watchesCodes_(sh, ch.col, ch.col)) ? linkCodes_(sh, row, row) || {} : null;
    if (changes.some((ch) => watchesProfit_(sh, ch.col, ch.col))) syncProfit_(sh, row, row);
    const fresh = gridRows_(sh.getRange(row, 1, 1, sh.getLastColumn()), ctx)[0];
    changes.forEach((ch) => {
      const cell = fresh.cells[ch.col - 1];
      adminLog_(user, 'Sửa ô', sh.getName(), `${colName_(ch.col)}${row}`, ch.before, cell ? (cell.f ? cell.e : cell.d) || '' : '');
    });
    return {
      ok: true, saved: changes.length,
      row: { hash: fresh.hash, cells: fresh.cells, lists: ctx.lists, web: Boolean(names) && webRow_(sh, shownOf_(fresh.cells), names) },
      reload: Boolean(linked), message: linked && linked.issue ? linked.issue : '',
    };
  });
}

/**
 * Thêm một dòng (ô theo thứ tự cột): trang trong NEWEST_FIRST ngay dưới dòng tiêu đề, trang khác ở cuối. Ô tích, ô thả
 * xuống, định dạng lấy theo dòng dữ liệu kề bên (dòng đầu hoặc dòng cuối hiện có).
 */
function adminAppend_(data, user) {
  const sh = adminSheet_(data.sheet);
  if (!sh) return sheetGone_(data.sheet);
  const rules = adminRules_(sh);
  if (!rules.add) return { ok: false, error: 'Trang tính này không thêm dòng trên web được.' };
  const input = Array.isArray(data.values) ? data.values : [];
  return withDocLock_(() => {
    const width = sh.getLastColumn();
    const last = sh.getLastRow();
    if (!width || input.length > width || rowHash_(sh.getRange(1, 1, 1, width).getValues()[0]) !== data.head) {
      return { ok: false, conflict: true, error: 'Các cột vừa thay đổi trên Google Sheet nên chưa thêm dòng. Đã tải lại: kiểm tra rồi làm lại.' };
    }
    const ctx = gridContext_(sh);
    const skip = Math.max(sh.getFrozenRows(), 1);
    const old = last > skip ? sh.getRange(skip + 1, 1, last - skip, width).getValues() : [];
    // Định dạng của dòng sắp thêm (VD cả cột để "Văn bản thuần"): dòng chèn trên cùng (ngay dưới dòng tiêu đề) giống dòng
    // dữ liệu đầu tiên; dòng thêm ở cuối là dòng trống kế tiếp (dòng cuối của trang thì Sheet tự thêm dòng mới)
    const after = rules.top ? headRow_(sh, rules) : 0;
    const at = rules.top && last > after ? after + 1 : last + 1;
    const formats = at <= sh.getMaxRows() ? sh.getRange(at, 1, 1, width).getNumberFormats()[0] : [];
    const head = rules.header ? header_(sh) : [];
    const row = [];
    const text = [];
    for (let c = 0; c < width; c++) {
      const value = input[c];
      if (value == null || value === '') {
        row.push('');
        continue;
      }
      if (!editable_(rules, last + 1, c + 1)) {
        const why = rules.why[c + 1];
        return { ok: false, error: why ? `Cột ${colName_(c + 1)} (${head[c] || header_(sh)[c]}): ${why}` : `Cột ${colName_(c + 1)} chỉ sửa được trên Google Sheet.` };
      }
      const next = cellInput_(value, majorityKind_(old.map((r) => cellKind_(r[c]))), formats[c] || '', ctx);
      row.push(next.formula !== undefined ? next.formula : next.value);
      text.push(`${head[c] || colName_(c + 1)}: ${typeof value === 'boolean' ? (value ? 'đã tích' : 'chưa tích') : value}`);
    }
    while (row.length && row[row.length - 1] === '') row.pop();
    if (!text.length) return { ok: false, error: 'Dòng mới còn trống: điền ít nhất một ô.' };
    let added;
    if (rules.top) {
      added = insertTop_(sh, [row], after);
    } else {
      sh.appendRow(row);
      added = sh.getLastRow();
      if (last > skip) {
        const checks = tryGet_(() => sh.getRange(last, 1, 1, width).getDataValidations());
        if (checks && checks[0].some(Boolean)) sh.getRange(added, 1, 1, width).setDataValidations(checks);
      }
    }
    if (watchesCodes_(sh, 1, width)) linkCodes_(sh, added, added);
    syncProfit_(sh, added, added);
    adminLog_(user, 'Thêm dòng', sh.getName(), `Dòng ${added}`, '', text.join('\n'));
    return { ok: true, row: added };
  });
}

/** Xoá một dòng: ghi đủ nội dung vào "Nhật ký quản trị" trước (để chép lại khi lỡ tay), ghi được rồi mới xoá. */
function adminDelete_(data, user) {
  const sh = adminSheet_(data.sheet);
  if (!sh) return sheetGone_(data.sheet);
  const rules = adminRules_(sh);
  const row = Number(data.row);
  if (!rules.del) return { ok: false, error: 'Trang tính này không xoá dòng trên web được.' };
  if (!Number.isInteger(row) || row < (rules.header ? 2 : 1)) return { ok: false, error: ADMIN_BAD };
  return withDocLock_(() => {
    if (row > sh.getLastRow()) return { ok: false, conflict: true, error: ADMIN_CONFLICT };
    const range = sh.getRange(row, 1, 1, sh.getLastColumn());
    if (rowHash_(range.getValues()[0]) !== data.hash) return { ok: false, conflict: true, error: ADMIN_CONFLICT };
    const formulas = range.getFormulas()[0];
    const head = rules.header ? header_(sh) : [];
    const text = range.getDisplayValues()[0]
      .map((shown, c) => [head[c] || colName_(c + 1), formulas[c] || shown])
      .filter(([, v]) => v !== '')
      .map(([name, v]) => `${name}: ${v}`);
    if (!adminLog_(user, 'Xoá dòng', sh.getName(), `Dòng ${row}`, text.join('\n'), '')) {
      return { ok: false, error: 'Chưa ghi được nhật ký nên chưa xoá dòng. Thử lại sau ít phút.' };
    }
    // Google Sheet không cho xoá hết các dòng không cố định: thêm 1 dòng trống ở cuối trước
    if (sh.getMaxRows() <= sh.getFrozenRows() + 1) sh.insertRowAfter(sh.getMaxRows());
    sh.deleteRow(row);
    return { ok: true };
  });
}

/** Ghi 1 dòng vào trang tính "Nhật ký quản trị" (script tự tạo). Trả false nếu chưa ghi được. */
function adminLog_(user, action, sheet, where, before, after) {
  try {
    const sh = getSheet_(SpreadsheetApp.getActiveSpreadsheet(), ADMIN_LOG_SHEET, ADMIN_LOG_HEADER);
    addRow_(sh, { 'Thời gian': new Date(), 'Tài khoản': user, 'Việc': action, 'Trang tính': sheet, 'Vị trí': where, 'Trước': before, 'Sau': after }, 45000);
    return true;
  } catch (err) {
    console.error(err);
    return false;
  }
}

/** 1 → "A", 27 → "AA" */
function colName_(n) {
  let s = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

/** Đọc phần phụ (màu, ghi chú, độ rộng…): lỗi thì bỏ qua phần đó, trang quản trị vẫn hiện được dữ liệu. */
function tryGet_(fn) {
  try {
    return fn();
  } catch (err) {
    console.warn(err);
    return null;
  }
}

/** Menu "Tài khoản trang quản trị…": tạo tài khoản, đổi mật khẩu, bật mã 2 bước, xoá tài khoản đăng nhập quan-tri.html. */
function showAdminAccounts() {
  const json = JSON.stringify({ page: `${SITE_URL}/quan-tri.html`, min: ADMIN_MIN_PASSWORD }).replace(/</g, '\\u003c');
  const page = HtmlService.createHtmlOutput(ADMIN_ACCOUNTS_HTML.replace('__DATA__', () => json)).setWidth(480).setHeight(680);
  SpreadsheetApp.getUi().showModalDialog(page, 'Tài khoản trang quản trị');
}

/** Cửa sổ tài khoản gọi: các tài khoản và đã bật mã 2 bước chưa (không có mật khẩu hay khoá). */
function listAdminAccounts() {
  const accounts = adminAccounts_();
  return Object.keys(accounts).sort().map((name) => ({ name, totp: Boolean(accounts[name].totp) }));
}

/**
 * Tạo tài khoản, hoặc đổi mật khẩu nếu tên đã có: mọi nơi đang đăng nhập bằng tài khoản đó bị đăng xuất. Mã 2 bước
 * vẫn giữ. Đổi mật khẩu (VD vì nghi bị lộ) cũng quên các trình duyệt đã biết: lần sau trình duyệt nào cũng báo email.
 */
function saveAdminAccount(name, password) {
  const user = String(name == null ? '' : name).trim().toLowerCase();
  const pass = String(password == null ? '' : password);
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(user)) {
    throw new Error('Tên đăng nhập 3–30 ký tự: chữ không dấu, số, dấu chấm, gạch ngang, gạch dưới.');
  }
  if (pass.length < ADMIN_MIN_PASSWORD || pass.length > 200) throw new Error(`Mật khẩu cần ít nhất ${ADMIN_MIN_PASSWORD} ký tự.`);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const props = PropertiesService.getScriptProperties();
    const accounts = adminAccounts_();
    const changed = accounts.hasOwnProperty(user);
    const salt = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid()).slice(0, 16));
    accounts[user] = Object.assign({}, changed ? accounts[user] : {}, { salt, hash: passwordHash_(pass, salt), ver: randomKey_().slice(0, 12) });
    props.setProperty(ADMIN_ACCOUNTS_KEY, JSON.stringify(accounts));
    props.deleteProperty(ADMIN_DEVICES_KEY + user);
    adminLog_('Google Sheet', changed ? 'Đổi mật khẩu' : 'Tạo tài khoản', '', user, '', '');
  } finally {
    lock.releaseLock();
  }
  return listAdminAccounts();
}

/** Xoá tài khoản: người đang đăng nhập bằng tài khoản này bị đăng xuất ở lần bấm tiếp theo. */
function removeAdminAccount(name) {
  const user = String(name == null ? '' : name);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const accounts = adminAccounts_();
    if (accounts.hasOwnProperty(user)) {
      delete accounts[user];
      const props = PropertiesService.getScriptProperties();
      props.setProperty(ADMIN_ACCOUNTS_KEY, JSON.stringify(accounts));
      props.deleteProperty(ADMIN_DEVICES_KEY + user);
      CacheService.getScriptCache().remove(`qt:cai-ma:${user}`);
      adminLog_('Google Sheet', 'Xoá tài khoản', '', user, '', '');
    }
  } finally {
    lock.releaseLock();
  }
  return listAdminAccounts();
}

/**
 * Cửa sổ tài khoản, nút "Bật mã 2 bước": tạo khoá mới để hiện mã QR. Khoá chỉ có hiệu lực khi nhập đúng mã ứng dụng hiện
 * ra (confirmAdminTotp); trước đó tài khoản vẫn đăng nhập như cũ, kể cả khi đang cài lại cho điện thoại mới.
 */
function startAdminTotp(name) {
  const user = String(name == null ? '' : name);
  if (!adminAccounts_().hasOwnProperty(user)) throw new Error('Không có tài khoản này nữa: đóng cửa sổ rồi mở lại.');
  const key = newTotpKey_();
  CacheService.getScriptCache().put(`qt:cai-ma:${user}`, key, 900);
  return { name: user, key, uri: totpUri_(user, key) };
}

/** Mã 6 số ứng dụng hiện ra đúng thì bật mã 2 bước. Mọi nơi đang đăng nhập bằng tài khoản này bị đăng xuất. */
function confirmAdminTotp(name, code) {
  const user = String(name == null ? '' : name);
  const cache = CacheService.getScriptCache();
  const key = cache.get(`qt:cai-ma:${user}`);
  if (!key) throw new Error('Đã quá 15 phút: bấm "Huỷ" rồi bấm lại "Bật mã 2 bước" để có mã QR mới.');
  const typed = String(code == null ? '' : code).replace(/\s/g, '');
  const at = /^\d{6}$/.test(typed) ? totpMatch_(key, typed) : -1;
  if (at < 0) {
    throw new Error('Mã chưa đúng. Nhập mã 6 số ứng dụng đang hiện cho SmartCarTech. Mã đúng mà vẫn báo sai: đặt giờ của điện thoại về chế độ tự động.');
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const accounts = adminAccounts_();
    if (!accounts.hasOwnProperty(user)) throw new Error('Tài khoản này vừa bị xoá.');
    const again = Boolean(accounts[user].totp);
    accounts[user].totp = key;
    accounts[user].ver = randomKey_().slice(0, 12);
    PropertiesService.getScriptProperties().setProperty(ADMIN_ACCOUNTS_KEY, JSON.stringify(accounts));
    cache.remove(`qt:cai-ma:${user}`);
    cache.put(`qt:ma-da-dung:${user}`, String(at), 4 * TOTP_STEP); // mã vừa nhập ở đây không dùng để đăng nhập được
    adminLog_('Google Sheet', again ? 'Cài lại mã 2 bước' : 'Bật mã 2 bước', '', user, '', '');
  } finally {
    lock.releaseLock();
  }
  return listAdminAccounts();
}

/** Tắt mã 2 bước (VD mất điện thoại): đăng nhập lại chỉ cần mật khẩu, bật lại được ngay trên điện thoại mới. */
function removeAdminTotp(name) {
  const user = String(name == null ? '' : name);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const accounts = adminAccounts_();
    if (accounts.hasOwnProperty(user) && accounts[user].totp) {
      delete accounts[user].totp;
      PropertiesService.getScriptProperties().setProperty(ADMIN_ACCOUNTS_KEY, JSON.stringify(accounts));
      adminLog_('Google Sheet', 'Tắt mã 2 bước', '', user, '', '');
    }
  } finally {
    lock.releaseLock();
  }
  return listAdminAccounts();
}

/**
 * Menu "Bật hoặc tắt trang quản trị…". Tắt: script từ chối mọi việc của trang quản trị, kể cả đăng nhập, và mọi phiên đang
 * mở bị đăng xuất (bật lại cũng phải đăng nhập lại). Web bán hàng và Google Sheet vẫn chạy bình thường.
 */
function toggleAdminPage() {
  const ui = SpreadsheetApp.getUi();
  const props = PropertiesService.getScriptProperties();
  const off = Number(props.getProperty(ADMIN_OFF_KEY)) || 0;
  const page = `${SITE_URL}/quan-tri.html`;
  if (off) {
    const since = Utilities.formatDate(new Date(off), SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone(), 'dd/MM/yyyy HH:mm');
    if (ui.alert('Trang quản trị đang tắt', `Tắt từ ${since}. Bật lại để đăng nhập được ở ${page}?`, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
    props.deleteProperty(ADMIN_OFF_KEY);
    adminLog_('Google Sheet', 'Bật trang quản trị', '', '', '', '');
    ui.alert('Đã bật trang quản trị', `Đăng nhập lại ở ${page}.`, ui.ButtonSet.OK);
    return;
  }
  const ask = `Khi tắt, không ai đăng nhập được ${page}; người đang đăng nhập bị đăng xuất ngay ở lần bấm tiếp theo. ` +
    'Web bán hàng và Google Sheet vẫn dùng bình thường. Bật lại: cũng ở menu này.';
  if (ui.alert('Tắt trang quản trị?', ask, ui.ButtonSet.YES_NO) !== ui.Button.YES) return;
  const now = String(Date.now());
  props.setProperty(ADMIN_OFF_KEY, now);
  props.setProperty(ADMIN_CUTOFF_KEY, now);
  adminLog_('Google Sheet', 'Tắt trang quản trị', '', '', '', '');
  ui.alert('Đã tắt trang quản trị', 'Mọi người đã bị đăng xuất. Muốn bật lại: vào lại menu này.', ui.ButtonSet.OK);
}

/** Các dòng về trang quản trị trong "Kiểm tra cài đặt": tài khoản, mã 2 bước, đang tắt hay bật. */
function adminStatus_() {
  const accounts = adminAccounts_();
  const names = Object.keys(accounts).sort();
  if (!names.length) return ['✗ Chưa có tài khoản trang quản trị: menu SmartCarTech → Tài khoản trang quản trị… để tạo.'];
  const plain = names.filter((name) => !accounts[name].totp);
  const lines = [
    `✓ Trang quản trị ${SITE_URL}/quan-tri.html: ${names.length} tài khoản (${names.join(', ')}).`,
    plain.length
      ? `• Chưa bật mã 2 bước: ${plain.join(', ')}. Nên bật: menu SmartCarTech → Tài khoản trang quản trị… → "Bật mã 2 bước".`
      : '✓ Mọi tài khoản trang quản trị đã bật mã 2 bước.',
  ];
  if (PropertiesService.getScriptProperties().getProperty(ADMIN_OFF_KEY)) {
    lines.push('• Trang quản trị đang TẮT: không ai đăng nhập được. Bật lại ở menu SmartCarTech → "Bật hoặc tắt trang quản trị…".');
  }
  return lines;
}

/* ---------- Gộp trang "Customer Infor" (nhập từ file kế hoạch Excel) vào "Đơn hàng" ---------- */

const CUSTOMER_SHEET = 'Customer Infor';
// [cột ở "Customer Infor", cột cùng ý nghĩa ở "Đơn hàng"]. "Đơn hàng" chưa có cột đó thì thêm vào cuối
const CUSTOMER_COLS = [
  ['Thứ tự', 'Thứ tự'], ['Ngày', 'Thời gian'], ['Nền tảng', ORDER_PLATFORM_COL], ['Tên', 'Họ tên'], ['Email', 'Email'],
  ['Số ĐT', 'SĐT'], ['Địa Chỉ', 'Địa chỉ'], ['Sản Phẩm', 'Sản phẩm'], ['Tổng tiền sản phẩm', 'Tổng (₫)'],
  ['Tiền thu người nhận', 'Tiền thu người nhận'], [ORDER_REVENUE_COL, ORDER_REVENUE_COL],
  [ORDER_COST_COL, ORDER_COST_COL], [ORDER_PROFIT_COL, ORDER_PROFIT_COL], ['Note', 'Ghi chú'],
];
const CUSTOMER_MONEY_COLS = ['Tiền thu người nhận', ORDER_REVENUE_COL, ORDER_COST_COL, ORDER_PROFIT_COL];

/**
 * Menu "Gộp Customer Infor vào Đơn hàng…". Chỉ thêm, không sửa ô đang có:
 * - Dòng chưa có ở "Đơn hàng": thêm mới, xếp đúng vị trí theo ngày.
 * - Dòng trùng đơn đã có (xem sameOrder_): chỉ điền các ô còn trống; ô đã có mà khác thì giữ nguyên, ghi giá trị
 *   của "Customer Infor" vào ghi chú của ô đó.
 * Hỏi lại trước khi ghi; chạy lại không tạo dòng trùng. Trang "Customer Infor" giữ nguyên, kiểm tra xong shop tự xoá.
 */
function mergeCustomerInfo() {
  const ui = SpreadsheetApp.getUi();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const title = `Gộp ${CUSTOMER_SHEET} vào ${ORDER_SHEET}`;
  const plan = customerPlan_(ss);
  if (plan.error) {
    ui.alert(title, plan.error, ui.ButtonSet.OK);
    return;
  }
  if (!customerPending_(plan)) {
    ui.alert(title, `Không còn gì để gộp: ${plan.total} dòng của "${CUSTOMER_SHEET}" đều đã có ở "${ORDER_SHEET}". Kiểm tra xong thì có thể xoá trang "${CUSTOMER_SHEET}".`, ui.ButtonSet.OK);
    return;
  }
  const asked = customerPlanLines_(plan).concat('',
    `Các ô đang có ở "${ORDER_SHEET}" không bị sửa, trang "${CUSTOMER_SHEET}" giữ nguyên.`,
    'Nên đặt tên phiên bản trước khi gộp: Tệp → Lịch sử phiên bản → Đặt tên cho phiên bản hiện tại.', '', 'Gộp ngay?');
  if (ui.alert(title, asked.join('\n'), ui.ButtonSet.YES_NO) !== ui.Button.YES) return;

  // Đọc lại sau khi bấm: trong lúc hộp thoại mở có thể đã có đơn mới
  const done = withDocLock_(() => {
    const fresh = customerPlan_(ss);
    if (!fresh.error) applyCustomerPlan_(ss, fresh);
    return fresh;
  });
  if (done.error) {
    ui.alert(title, done.error, ui.ButtonSet.OK);
    return;
  }
  ss.getSheetByName(ORDER_SHEET).activate();
  ui.alert(title, ['Đã gộp xong.', ...customerPlanLines_(done), '',
    `Kiểm tra lại trang "${ORDER_SHEET}". Đúng rồi thì xoá trang "${CUSTOMER_SHEET}", mục này trong menu tự mất ở lần mở sau.`,
    'Gộp sai: Tệp → Lịch sử phiên bản, khôi phục phiên bản đã đặt tên.'].join('\n'), ui.ButtonSet.OK);
}

/** Việc sẽ làm, chưa ghi gì: { total, skipped, newCols, fill: dòng trùng đơn đã có, add: dòng mới, web: đơn web chưa ghi nền tảng, times }. */
function customerPlan_(ss) {
  const src = ss.getSheetByName(CUSTOMER_SHEET);
  if (!src) return { error: `Không thấy trang "${CUSTOMER_SHEET}". Nhập file kế hoạch Excel trước (README mục 6) rồi tải lại Sheet.` };
  const tz = ss.getSpreadsheetTimeZone();
  const os = getSheet_(ss, ORDER_SHEET, ORDER_HEADER);
  const head = header_(os);
  const source = customerRows_(src, tz, head);
  if (source.error) return source;
  const last = os.getLastRow();
  const range = last > 1 ? os.getRange(2, 1, last - 1, head.length) : null;
  const rows = range ? range.getValues() : [];
  const notes = range ? range.getNotes() : [];
  const getter = (row) => (name) => (head.includes(name) ? row[head.indexOf(name)] : '');
  const signs = rows.map((row) => orderSign_(getter(row), tz));
  const label = (i) => [getter(rows[i])('Mã đơn'), getter(rows[i])('Họ tên')].filter(Boolean).join(' – ') || `dòng ${i + 2}`;

  const plan = { total: source.rows.length, skipped: source.skipped, newCols: [], fill: [], add: [], web: [],
    times: rows.map((row) => timeOf_(getter(row)('Thời gian'), tz)) };
  const used = new Set();
  source.rows.forEach((rec) => {
    const sign = orderSign_((name) => rec.cells[name], tz);
    let at = rows.findIndex((row, i) => !used.has(i) && customerSame_(rec, source.cols, row, head, tz));
    if (at < 0) at = signs.findIndex((o, i) => !used.has(i) && sameOrder_(sign, o));
    if (at < 0) {
      const similar = signs.findIndex((o) => maybeSameOrder_(sign, o));
      plan.add.push(Object.assign({ warn: similar < 0 ? '' : `Có thể trùng đơn ${label(similar)}: kiểm tra, trùng thì xoá 1 dòng.` }, rec));
      return;
    }
    used.add(at);
    plan.fill.push(Object.assign({ row: at + 2, label: label(at) }, customerFill_(rec, source.cols, rows[at], notes[at], head, tz)));
  });

  const platform = new Set(plan.fill.filter((f) => f.cells.some(([to]) => to === ORDER_PLATFORM_COL)).map((f) => f.row));
  rows.forEach((row, i) => {
    const code = String(getter(row)('Mã đơn')).trim();
    if (/^SC\d{6}-\d{4}$/.test(code) && getter(row)(ORDER_PLATFORM_COL) === '' && !platform.has(i + 2)) plan.web.push(i + 2);
  });
  const wanted = source.cols.map(([, to]) => to).concat(plan.add.some((rec) => rec.warn) ? [ORDER_CHECK_COL] : []);
  plan.newCols = wanted.filter((name, i) => !head.includes(name) && wanted.indexOf(name) === i);
  return plan;
}

/**
 * Các dòng có dữ liệu của "Customer Infor" đã đổi về dạng của "Đơn hàng"; dòng chỉ có số thứ tự (để dành sẵn) bị bỏ qua.
 * cols: các cột gộp. Cột ngoài CUSTOMER_COLS (VD shop mới thêm vào Excel): vào cột cùng tên ở "Đơn hàng", chưa có thì thêm mới.
 */
function customerRows_(src, tz, orderHead) {
  const range = src.getRange(1, 1, Math.max(src.getLastRow(), 1), Math.max(src.getLastColumn(), 1));
  const values = range.getValues();
  const formulas = range.getFormulas();
  const names = values[0].map((v) => String(v).trim());
  const head = names.map(matchText_);
  const col = (name) => head.indexOf(matchText_(name));
  const missing = CUSTOMER_COLS.map(([from]) => from).filter((from) => col(from) < 0);
  if (missing.length) return { error: `Trang "${CUSTOMER_SHEET}" thiếu cột: ${missing.join(', ')}. Đổi lại đúng tên cột rồi chạy lại.` };
  const known = CUSTOMER_COLS.map(([from]) => matchText_(from));
  const cols = CUSTOMER_COLS.concat(names.filter((name) => name && !known.includes(matchText_(name)))
    .map((name) => [name, orderHead.find((h) => matchText_(h) === matchText_(name)) || name]));

  const own = (formula, row) => new RegExp(
    `^=\\s*${colName_(col(ORDER_REVENUE_COL) + 1)}${row}\\s*-\\s*${colName_(col(ORDER_COST_COL) + 1)}${row}\\s*$`, 'i').test(formula);
  const rows = [];
  let skipped = 0;
  values.slice(1).forEach((row, i) => {
    const cells = {};
    cols.forEach(([from, to]) => {
      const v = row[col(from)];
      if (cells[to] !== undefined && cells[to] !== '') return; // 2 cột cùng vào 1 cột: giữ giá trị đầu
      if (typeof v !== 'string') cells[to] = v;
      else cells[to] = /^\s*(n\/?a|-+)?\s*$/i.test(v) ? '' : v.trim(); // "N/A": không có thông tin, để trống như các đơn khác
    });
    if (cols.every(([, to]) => to === 'Thứ tự' || to === ORDER_PROFIT_COL || cells[to] === '')) {
      skipped++;
      return;
    }
    const time = timeOf_(cells['Thời gian'], tz);
    if (time) cells['Thời gian'] = time;
    // Số bị Excel làm mất số 0 ở đầu, hoặc có "(+84)" → dạng SĐT của các đơn khác
    const digits = String(cells['SĐT']).replace(/\D/g, '');
    cells['SĐT'] = /^(0|84)?[35789]\d{8}$/.test(digits) ? `0${digits.slice(-9)}` : String(cells['SĐT']);
    // Lợi nhuận = Doanh thu − Chi phí của chính dòng đó: giữ là công thức, theo cột mới ở "Đơn hàng"
    const formula = own(formulas[i + 1][col(ORDER_PROFIT_COL)], i + 2);
    if (formula) cells[ORDER_PROFIT_COL] = '';
    rows.push({ from: i + 2, cells, time, formula });
  });
  return { rows, skipped, cols };
}

/** Dòng này đã gộp từ lần chạy trước: mọi cột gộp đều giống hệt. Nhờ vậy chạy lại không thêm dòng, kể cả dòng thiếu ngày, tên, địa chỉ. */
function customerSame_(rec, cols, row, head, tz) {
  return cols.every(([, to]) => {
    if (to === ORDER_PROFIT_COL && rec.formula) return true;
    const cur = head.includes(to) ? row[head.indexOf(to)] : '';
    const value = rec.cells[to];
    return value === '' || cur === '' ? value === cur : sameContent_(to, cur, value, tz);
  });
}

/** Việc cho một dòng trùng đơn đã có: { from, cells: ô còn trống cần điền, notes: ô đã có mà khác, formula: cần công thức lợi nhuận }. */
function customerFill_(rec, cols, row, notes, head, tz) {
  const out = { from: rec.from, cells: [], notes: [], formula: false };
  new Set(cols.map(([, to]) => to)).forEach((to) => {
    const value = rec.cells[to];
    if (value === '') return;
    const i = head.indexOf(to);
    if (i < 0 || row[i] === '') {
      out.cells.push([to, value]);
      return;
    }
    if (sameContent_(to, row[i], value, tz)) return;
    const shown = value instanceof Date ? Utilities.formatDate(value, tz, 'dd/MM/yyyy HH:mm:ss') : value;
    const text = `${CUSTOMER_SHEET} ghi: ${shown}`;
    if (!String(notes[i] || '').includes(text)) out.notes.push([to, text]);
  });
  const profit = head.indexOf(ORDER_PROFIT_COL);
  out.formula = rec.formula && (profit < 0 || row[profit] === '');
  return out;
}

function customerPending_(plan) {
  return Boolean(plan.newCols.length || plan.add.length || plan.web.length || plan.fill.some(fillPending_));
}

function fillPending_(f) {
  return Boolean(f.cells.length || f.notes.length || f.formula);
}

function customerPlanLines_(plan) {
  const lines = [`Trang "${CUSTOMER_SHEET}" có ${plan.total} dòng dữ liệu${plan.skipped ? ` (bỏ qua ${plan.skipped} dòng chỉ có số thứ tự)` : ''}.`];
  if (plan.newCols.length) lines.push(`• Thêm ${plan.newCols.length} cột vào cuối "${ORDER_SHEET}": ${plan.newCols.join(', ')}.`);
  if (plan.add.length) lines.push(`• ${plan.add.length} dòng chưa có: thêm mới, xếp đúng vị trí theo ngày.`);
  const fill = plan.fill.filter(fillPending_);
  if (fill.length) {
    lines.push(`• ${fill.length} dòng trùng đơn đã có: chỉ điền các ô còn trống; ô đã có mà khác thì ghi vào ghi chú của ô:`);
    fill.forEach((f) => lines.push(`   Dòng ${f.from} ↔ ${f.label}`));
  }
  const warn = plan.add.filter((rec) => rec.warn);
  if (warn.length) {
    lines.push(`• ${warn.length} dòng có thể trùng nhưng chưa chắc: vẫn thêm mới, nhắc ở cột "${ORDER_CHECK_COL}":`);
    warn.forEach((rec) => lines.push(`   Dòng ${rec.from}: ${rec.warn}`));
  }
  if (plan.web.length) lines.push(`• ${plan.web.length} đơn web có sẵn: ghi ${ORDER_PLATFORM_COL} = ${WEB_PLATFORM}.`);
  return lines;
}

function applyCustomerPlan_(ss, plan) {
  const os = ss.getSheetByName(ORDER_SHEET);
  const tz = ss.getSpreadsheetTimeZone();
  const oldWidth = os.getLastColumn();
  const spare = oldWidth + plan.newCols.length - os.getMaxColumns();
  if (spare > 0) os.insertColumnsAfter(os.getMaxColumns(), spare);
  plan.newCols.forEach((name) => colOf_(os, name, true));
  if (plan.newCols.length) os.getRange(1, oldWidth).copyFormatToRange(os, oldWidth + 1, oldWidth + plan.newCols.length, 1, 1);
  const head = header_(os);
  const col = (name) => head.indexOf(name) + 1;
  const cols = profitCols_(os);
  const setProfit = (row) => os.getRange(row, cols.profit).setFormula(profitFormula_(cols, row));
  const dateOnly = (row, value) => {
    if (value instanceof Date && Utilities.formatDate(value, tz, 'HH:mm:ss') === '00:00:00') {
      os.getRange(row, col('Thời gian')).setNumberFormat('dd/mm/yyyy'); // file Excel chỉ ghi ngày: không hiện 00:00:00
    }
  };

  // Điền ô trống trước khi chèn dòng: số dòng trong kế hoạch còn đúng
  plan.fill.forEach((f) => {
    f.cells.forEach(([name, value]) => {
      const cell = os.getRange(f.row, col(name));
      cell.setValue(customerValue_(value, cell.getNumberFormat()));
      if (name === 'Thời gian') dateOnly(f.row, value);
    });
    f.notes.forEach(([name, text]) => {
      const cell = os.getRange(f.row, col(name));
      const old = cell.getNote();
      cell.setNote(old ? `${old}\n${text}` : text);
    });
    if (f.formula) setProfit(f.row);
  });
  plan.web.forEach((row) => os.getRange(row, col(ORDER_PLATFORM_COL)).setValue(WEB_PLATFORM));

  // Dòng mới theo thứ tự ngày, đặt trước đơn đầu tiên mới hơn nó. Mới hơn mọi đơn thì dùng appendRow: không đè đơn khách vừa gửi
  const times = plan.times.slice();
  const order = (rec) => (rec.time ? rec.time.getTime() : Infinity);
  plan.add.slice().sort((a, b) => order(a) - order(b) || a.from - b.from).forEach((rec) => {
    const next = rec.time ? times.findIndex((t) => t && t > rec.time) : -1;
    const row = next >= 0 ? next + 2 : os.getLastRow() + 1;
    if (next >= 0) os.insertRowBefore(row);
    const formats = row <= os.getMaxRows() ? os.getRange(row, 1, 1, head.length).getNumberFormats()[0] : [];
    const cells = head.map((name, c) => {
      const value = rec.cells.hasOwnProperty(name) ? rec.cells[name] : name === ORDER_CHECK_COL ? rec.warn : '';
      return customerValue_(value, formats[c]);
    });
    let at = row;
    if (next >= 0) {
      os.getRange(row, 1, 1, head.length).setValues([cells]);
      times.splice(next, 0, rec.time);
    } else {
      while (cells.length && cells[cells.length - 1] === '') cells.pop();
      os.appendRow(cells);
      at = os.getLastRow();
      times.push(rec.time);
    }
    dateOnly(at, rec.time);
    if (rec.formula) setProfit(at);
  });

  if (os.getMaxRows() > 1) {
    CUSTOMER_MONEY_COLS.filter((name) => plan.newCols.includes(name))
      .forEach((name) => os.getRange(2, col(name), os.getMaxRows() - 1, 1).setNumberFormat('#,##0'));
  }
  // Dòng chèn vào có thể mang màu đỏ báo lỗi của ô bên cạnh ở cột "Mã tải code": tô lại cả cột như mỗi lần sửa
  if (head.includes(ORDER_KEY_COL)) linkCodes_(os, 0, -1);
  adminLog_('Google Sheet', `Gộp ${CUSTOMER_SHEET}`, ORDER_SHEET, '', '', customerPlanLines_(plan).join('\n'));
}

/** Chữ ghi qua safe_ để Sheet không tự đổi kiểu; ô định dạng "Văn bản thuần" thì Sheet không đổi, không cần dấu '. */
function customerValue_(value, format) {
  return typeof value === 'string' && format !== '@' ? safe_(value, 45000) : value;
}

/** Những gì dùng để nhận ra 2 dòng là cùng một đơn. `cell(tên cột)` trả giá trị ô. */
function orderSign_(cell, tz) {
  const time = timeOf_(cell('Thời gian'), tz);
  const name = String(cell('Họ tên'));
  return {
    day: time ? Utilities.formatDate(time, tz, 'yyyyMMdd') : '',
    phone: phoneKey_(cell('SĐT')),
    name: name.includes('*') ? '' : matchText_(name), // Shopee che tên (VD "N*****A"): không đủ để nhận ra đơn
    address: matchText_(cell('Địa chỉ')),
    product: matchText_(cell('Sản phẩm')),
    total: Number(cell('Tổng (₫)')) || 0,
  };
}

/**
 * Chắc là cùng một đơn: cùng ngày và cùng SĐT, cùng tên, hoặc cùng địa chỉ + sản phẩm (hay tổng tiền).
 * Một bên chưa có ngày (VD đơn Shopee shop gõ tay): cần cùng địa chỉ + sản phẩm, hoặc SĐT, tên kèm địa chỉ hay tổng tiền.
 */
function sameOrder_(a, b) {
  const eq = (key) => Boolean(a[key]) && a[key] === b[key];
  const person = eq('phone') || eq('name');
  const goods = eq('address') && (eq('product') || eq('total'));
  if (a.day && b.day) return a.day === b.day && (person || goods);
  return goods || (person && (eq('address') || eq('total')));
}

/** Có thể là một đơn nhưng chưa chắc (VD khách cũ mua lại): cùng SĐT, cùng địa chỉ, tên này nằm trong tên kia. Vẫn thêm mới và nhắc kiểm tra. */
function maybeSameOrder_(a, b) {
  const near = a.name.length >= 5 && b.name.length >= 5 && (a.name.includes(b.name) || b.name.includes(a.name));
  return near || (Boolean(a.phone) && a.phone === b.phone) || (Boolean(a.address) && a.address === b.address);
}

/** Ô đang có và giá trị của "Customer Infor" có cùng nội dung không, dù viết khác (cùng ngày, cùng SĐT, khác dấu câu). */
function sameContent_(name, a, b, tz) {
  if (name === 'Thời gian') {
    const [x, y] = [a, b].map((v) => timeOf_(v, tz));
    if (x && y && Utilities.formatDate(x, tz, 'yyyyMMdd') === Utilities.formatDate(y, tz, 'yyyyMMdd')) return true;
  }
  if (name === 'SĐT' && phoneKey_(a) && phoneKey_(a) === phoneKey_(b)) return true;
  return matchText_(a) === matchText_(b);
}

function timeOf_(value, tz) {
  return value instanceof Date ? value : dateFrom_(String(value == null ? '' : value), tz);
}

/** Chữ để so khớp: bỏ dấu, hoa thường, dấu câu, khoảng trắng thừa ("Nguyễn Văn, A." → "nguyen van a"). */
function matchText_(value) {
  return String(value == null ? '' : value).normalize('NFD').replace(/\p{M}+/gu, '').replace(/[đĐ]/g, 'd').toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

/** 9 số cuối của SĐT: "0912345678", 912345678 và "(+84)912345678" là một. Không đủ số (VD "N/A") thì "". */
function phoneKey_(value) {
  const digits = String(value == null ? '' : value).replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(-9) : '';
}

/* ---------- Lượt truy cập web: đếm ẩn danh (assets/js/core.js gửi khi mở trang công khai) ---------- */

const VISIT_HEADER = ['Ngày', 'Lượt xem', 'Khách truy cập', 'Khách mới trong tháng', 'Khách mới trong năm'];
const VISIT_FIELDS = [['Lượt xem', 'v'], ['Khách truy cập', 'd'], ['Khách mới trong tháng', 'm'], ['Khách mới trong năm', 'y']];
const VISIT_KEY = 'xem:'; // Script Properties "xem:2026-11-03" → { v: lượt xem, d: khách trong ngày, m: khách mới trong tháng, y: khách mới trong năm }
const VISIT_MAX_PER_DAY = 10000; // Quá số này trong 1 ngày (VD bị spam) thì ngừng đếm tới hôm sau, chừa hạn mức Script Properties cho đăng nhập quản trị

/**
 * Một lượt xem trang công khai. Web không gửi gì nhận ra khách (không cookie, IP hay mã riêng), chỉ báo đây có phải lần
 * đầu trong ngày, tháng, năm của trình duyệt đó không. Đếm trong Script Properties: không ghi Sheet, không giữ khoá nên
 * không làm chậm đơn hàng. Hai lượt đúng cùng lúc có thể mất 1 lượt đếm: số liệu gần đúng.
 */
function countVisit_(data) {
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const key = VISIT_KEY + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const props = PropertiesService.getScriptProperties();
  const c = visitCount_(props.getProperty(key));
  if (c.v >= VISIT_MAX_PER_DAY) return;
  // Lần đầu trong năm thì cũng là lần đầu trong tháng, trong ngày
  const year = data.y === 1;
  const month = year || data.m === 1;
  c.v++;
  if (month || data.d === 1) c.d++;
  if (month) c.m++;
  if (year) c.y++;
  props.setProperty(key, JSON.stringify(c));
}

/** Số đếm của 1 ngày (chữ JSON trong Script Properties) → { v, d, m, y }; thiếu hoặc hỏng thì là 0. */
function visitCount_(text) {
  let c = null;
  try {
    c = JSON.parse(text || '{}');
  } catch (err) {
    c = null;
  }
  const n = (x) => (Number.isFinite(Number(x)) && Number(x) > 0 ? Math.floor(Number(x)) : 0);
  return c && typeof c === 'object' ? { v: n(c.v), d: n(c.d), m: n(c.m), y: n(c.y) } : { v: 0, d: 0, m: 0, y: 0 };
}

/** Các dòng của trang "Lượt truy cập" (đọc theo tên cột): { row, day: "yyyy-MM-dd", v, d, m, y }. */
function visitRows_(sh, tz) {
  const last = sh.getLastRow();
  if (last < 2) return [];
  const head = header_(sh);
  const at = (name) => head.indexOf(name);
  return sh.getRange(2, 1, last - 1, head.length).getValues().map((r, i) => {
    const date = timeOf_(at('Ngày') < 0 ? '' : r[at('Ngày')], tz);
    const out = { row: i + 2, day: date ? Utilities.formatDate(date, tz, 'yyyy-MM-dd') : '' };
    VISIT_FIELDS.forEach(([name, f]) => { out[f] = at(name) < 0 ? 0 : Number(r[at(name)]) || 0; });
    return out;
  });
}

/**
 * Các ngày đã qua: cộng số đếm từ Script Properties vào trang "Lượt truy cập" (mỗi ngày 1 dòng, mới nhất ở trên) rồi
 * xoá khỏi Script Properties. Hôm nay còn đang đếm nên để lại. Gọi khi đang giữ khoá của Sheet.
 */
function archiveVisits_(ss, today) {
  const props = PropertiesService.getScriptProperties();
  const all = props.getProperties();
  const keys = Object.keys(all).filter((k) => k.startsWith(VISIT_KEY) && k.slice(VISIT_KEY.length) < today).sort();
  if (!keys.length) return;
  const tz = ss.getSpreadsheetTimeZone();
  const sh = getSheet_(ss, VISIT_SHEET, VISIT_HEADER);
  keys.forEach((key) => {
    const day = key.slice(VISIT_KEY.length);
    const c = visitCount_(all[key]);
    const found = visitRows_(sh, tz).find((r) => r.day === day);
    if (found) {
      // Ngày đã có dòng (VD có lượt đếm muộn sau lần chuyển trước): cộng thêm, không ghi đè
      VISIT_FIELDS.forEach(([name, f]) => sh.getRange(found.row, colOf_(sh, name, true)).setValue(found[f] + c[f]));
    } else {
      const cells = { 'Ngày': dateFrom_(`${day.slice(8, 10)}/${day.slice(5, 7)}/${day.slice(0, 4)}`, tz) };
      VISIT_FIELDS.forEach(([name, f]) => { cells[name] = c[f]; });
      const row = addRow_(sh, cells);
      sh.getRange(row, colOf_(sh, 'Ngày', false)).setNumberFormat('dd/mm/yyyy');
    }
    props.deleteProperty(key);
  });
}

/** Số đếm theo ngày: trang "Lượt truy cập" cộng các ngày còn trong Script Properties. Map "yyyy-MM-dd" → { v, d, m, y }. */
function visitsByDay_(ss, tz) {
  const out = new Map();
  const add = (day, c) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
    const cur = out.get(day) || { v: 0, d: 0, m: 0, y: 0 };
    ['v', 'd', 'm', 'y'].forEach((f) => { cur[f] += c[f]; });
    out.set(day, cur);
  };
  const sh = ss.getSheetByName(VISIT_SHEET);
  if (sh) visitRows_(sh, tz).forEach((r) => add(r.day, r));
  const all = PropertiesService.getScriptProperties().getProperties();
  Object.keys(all).filter((k) => k.startsWith(VISIT_KEY)).forEach((k) => add(k.slice(VISIT_KEY.length), visitCount_(all[k])));
  return out;
}

/* ---------- Trang "Tổng quan": lợi nhuận, số đơn, khách truy cập (tab trong Google Sheet và trang quản trị) ---------- */

const DASH_MONTHS = 12;
const DASH_DAYS = 30;
const DASH_YEARS = 5;
const DASH_PLATFORMS = ['Website', 'Shopee', 'TikTok', 'Khác'];
const DASH_WAITING = ['Mới', 'Đã liên hệ', 'Đã chốt', 'Đang in']; // Trạng thái đơn In 3D còn phải làm
const DASH_UPDATED_KEY = 'tong-quan:cap-nhat'; // Script Properties: lần cập nhật gần nhất (ms), để mở Sheet liên tục không tính lại mỗi lần
const DASH_MARK = 'SmartCarTech: trang này do script tạo và ghi lại mỗi lần cập nhật, đừng sửa tay.'; // Ghi chú ở ô A1
// Màu biểu đồ trên nền trắng của Google Sheet (cùng thứ tự màu với trang quản trị, đã kiểm tra cho người mù màu)
const DASH_COLORS = { platforms: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'], money: ['#c3c2b7', '#008300'], visits: ['#c3c2b7', '#2a78d6'] };

/** Nền tảng của một đơn ở trang "Đơn hàng": Website, Shopee, TikTok hoặc Khác. Ô trống mà mã đơn dạng SC… là đơn web. */
function platformOf_(value, code) {
  const p = matchText_(value);
  if (p.includes('shopee')) return 'Shopee';
  if (/tik ?tok/.test(p)) return 'TikTok';
  if (p === 'website' || p === 'web' || (!p && /^SC\d{6}-\d{4}$/.test(code))) return 'Website';
  return 'Khác';
}

/** Các dòng dữ liệu của một trang (bỏ dòng tiêu đề), đọc theo tên cột: cell(tên cột) → giá trị ô, không có cột đó thì "". */
function sheetRows_(ss, name) {
  const sh = ss.getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const head = header_(sh);
  return sh.getRange(2, 1, sh.getLastRow() - 1, head.length).getValues().map((row) => (col) => {
    const i = head.indexOf(col);
    return i < 0 ? '' : row[i];
  });
}

/**
 * Số liệu của trang Tổng quan, tính lúc `now`: 12 tháng gần nhất, các năm, 30 ngày gần nhất, tháng này so với cùng kỳ
 * tháng trước (từ ngày 1 tới cùng ngày), việc cần làm. Chỉ đọc, không ghi gì.
 */
function dashboardData_(ss, now) {
  const tz = ss.getSpreadsheetTimeZone();
  const fmt = (d, f) => Utilities.formatDate(d, tz, f);
  const pad = (n) => String(n).padStart(2, '0');
  const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const [year, month, day] = fmt(now, 'yyyy-MM-dd').split('-').map(Number);
  const monthAt = (shift) => {
    const t = year * 12 + month - 1 + shift;
    return `${Math.floor(t / 12)}-${pad((t % 12) + 1)}`;
  };
  const monthKeys = Array.from({ length: DASH_MONTHS }, (_, i) => monthAt(i - DASH_MONTHS + 1));
  const [thisMonth, lastMonth] = [monthAt(0), monthAt(-1)];
  const blank = () => ({ Website: 0, Shopee: 0, TikTok: 0, 'Khác': 0, print: 0, quotes: 0, leads: 0,
    revenue: 0, profit: 0, base: 0, noProfit: 0, views: 0, visitors: 0, counted: 0 });
  const months = new Map(monthKeys.map((k) => [k, blank()]));
  const years = new Map();
  const mtd = { now: blank(), prev: blank() };
  // Một dòng có ngày được tính vào năm, tháng (nếu trong 12 tháng), và tháng này / cùng kỳ tháng trước
  const buckets = (date) => {
    const [y, m, d] = fmt(date, 'yyyy-MM-dd').split('-').map(Number);
    const key = `${y}-${pad(m)}`;
    if (!years.has(y)) years.set(y, blank());
    const out = [years.get(y)];
    if (months.has(key)) out.push(months.get(key));
    if (d <= day && key === thisMonth) out.push(mtd.now);
    if (d <= day && key === lastMonth) out.push(mtd.prev);
    return out;
  };

  // Tỷ lệ đặt hàng chỉ tính đơn web từ ngày web bắt đầu đếm khách (counted): đơn cũ hơn không có khách để chia
  const visits = visitsByDay_(ss, tz);
  const first = [...visits.keys()].sort()[0] || '';
  const counted = (date) => Boolean(first) && fmt(date, 'yyyy-MM-dd') >= first;

  let undated = 0;
  sheetRows_(ss, ORDER_SHEET).forEach((cell) => {
    if (!['Mã đơn', 'Họ tên', 'Sản phẩm'].some((name) => String(cell(name)).trim())) return;
    const date = timeOf_(cell('Thời gian'), tz);
    if (!date) {
      undated++;
      return;
    }
    const platform = platformOf_(cell(ORDER_PLATFORM_COL), String(cell('Mã đơn')).trim());
    const revenue = num(cell(ORDER_REVENUE_COL)) ?? num(cell('Tổng (₫)'));
    const profit = num(cell(ORDER_PROFIT_COL));
    const web = platform === 'Website' && counted(date);
    buckets(date).forEach((b) => {
      b[platform]++;
      if (web) b.counted++;
      b.revenue += revenue || 0;
      if (profit === null) {
        b.noProfit++;
      } else {
        b.profit += profit;
        b.base += revenue || 0;
      }
    });
  });

  const waiting = Object.fromEntries(DASH_WAITING.map((s) => [s, 0]));
  sheetRows_(ss, PRINT_SHEET).forEach((cell) => {
    if (!String(cell('Mã')).trim() && !String(cell('Họ tên')).trim()) return;
    const status = matchText_(cell(PRINT_STATUS_COL));
    const open = DASH_WAITING.find((s) => matchText_(s) === status);
    if (open) waiting[open]++;
    const date = timeOf_(cell('Thời gian'), tz);
    if (!date) return;
    // Yêu cầu in theo file là yêu cầu báo giá, đếm riêng; đơn đã huỷ không tính
    const quote = matchText_(cell('Loại')).includes('theo file');
    const web = counted(date);
    buckets(date).forEach((b) => {
      if (quote) {
        b.quotes++;
      } else if (status !== 'huy') {
        b.print++;
        if (web) b.counted++;
      }
    });
  });

  sheetRows_(ss, LEAD_SHEET).forEach((cell) => {
    const date = timeOf_(cell('Thời gian'), tz);
    if (date && String(cell('Họ tên')).trim()) buckets(date).forEach((b) => { b.leads++; });
  });

  // Khách theo tháng: mỗi trình duyệt 1 lần trong tháng (cộng "khách mới trong tháng"); theo năm: 1 lần trong năm
  visits.forEach((c, key) => {
    const [y, m, d] = key.split('-').map(Number);
    const mk = `${y}-${pad(m)}`;
    if (!years.has(y)) years.set(y, blank());
    years.get(y).views += c.v;
    years.get(y).visitors += c.y;
    [[months.get(mk), true], [mtd.now, mk === thisMonth && d <= day], [mtd.prev, mk === lastMonth && d <= day]].forEach(([b, ok]) => {
      if (!b || !ok) return;
      b.views += c.v;
      b.visitors += c.m;
    });
  });

  const summary = (key, label, b) => {
    const orders = DASH_PLATFORMS.reduce((n, p) => n + b[p], 0) + b.print;
    return {
      key, label, web: b.Website, shopee: b.Shopee, tiktok: b.TikTok, other: b['Khác'], print: b.print, orders,
      quotes: b.quotes, leads: b.leads, revenue: Math.round(b.revenue), profit: Math.round(b.profit),
      margin: b.base > 0 ? b.profit / b.base : null, noProfit: b.noProfit, views: b.views, visitors: b.visitors,
      // Đơn đặt trên web (bộ xe + In 3D) từ ngày bắt đầu đếm, trên số khách truy cập
      conversion: b.visitors > 0 ? b.counted / b.visitors : null,
    };
  };
  const monthLabel = (key) => `T${Number(key.slice(5))}/${key.slice(0, 4)}`;

  let codesNew = 0;
  let cardsInStock = 0;
  const cs = ss.getSheetByName(CODE_SHEET);
  const cc = cs && cs.getLastRow() > 1 ? codeCols_(cs) : null;
  if (cc && !cc.missing) {
    const head = header_(cs);
    const [iPrinted, iOrder] = [PRINTED_COL, 'Mã đơn'].map((name) => head.indexOf(name));
    cs.getRange(2, 1, cs.getLastRow() - 1, head.length).getValues().forEach((r) => {
      if (!normalizeCode_(r[cc.id - 1]) || isLocked_(r[cc.lock - 1]) || Number(r[cc.count - 1]) > 0) return;
      if (iOrder >= 0 && String(r[iOrder]).trim()) return;
      if (iPrinted >= 0 && String(r[iPrinted]).trim()) cardsInStock++;
      else codesNew++;
    });
  }

  return {
    updated: fmt(now, 'dd/MM/yyyy HH:mm'),
    month: `${pad(month)}/${year}`,
    kpi: { now: summary(thisMonth, monthLabel(thisMonth), mtd.now), prev: summary(lastMonth, monthLabel(lastMonth), mtd.prev) },
    months: monthKeys.map((k) => summary(k, monthLabel(k), months.get(k))),
    years: [...years.keys()].sort((a, b) => a - b).slice(-DASH_YEARS).map((y) => summary(String(y), String(y), years.get(y))),
    days: Array.from({ length: DASH_DAYS }, (_, i) => {
      const date = new Date(now.getTime() - (DASH_DAYS - 1 - i) * 86400000);
      const c = visits.get(fmt(date, 'yyyy-MM-dd')) || { v: 0, d: 0 };
      return { key: fmt(date, 'yyyy-MM-dd'), label: fmt(date, 'dd/MM'), views: c.v, visitors: c.d };
    }),
    todo: { print: waiting, noProfit: monthKeys.reduce((n, k) => n + months.get(k).noProfit, 0), codesNew, cardsInStock },
    undated,
    visitsSince: first ? `${first.slice(8)}/${first.slice(5, 7)}/${first.slice(0, 4)}` : '',
  };
}

/** Tính lại số liệu và ghi trang "Tổng quan" (tạo nếu chưa có). Trả số liệu cho trang quản trị. */
function refreshDashboard_(ss) {
  return withDocLock_(() => {
    const now = new Date();
    archiveVisits_(ss, Utilities.formatDate(now, ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd'));
    const data = dashboardData_(ss, now);
    writeDashboard_(ss, data);
    PropertiesService.getScriptProperties().setProperty(DASH_UPDATED_KEY, String(Date.now()));
    return data;
  });
}

/** Dòng của "Kiểm tra cài đặt" về đếm khách truy cập: hôm nay đã đếm được bao nhiêu. */
function visitStatus_() {
  const tz = SpreadsheetApp.getActiveSpreadsheet().getSpreadsheetTimeZone();
  const c = visitCount_(PropertiesService.getScriptProperties().getProperty(VISIT_KEY + Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd')));
  return c.v
    ? `✓ Đếm khách truy cập: hôm nay ${money_(c.v)} lượt xem, ${money_(c.d)} khách.`
    : '• Hôm nay web chưa đếm được lượt xem nào. Sau khi đưa bản web mới lên, mở thử web bằng tab ẩn danh (máy đã mở trang quản trị không được đếm) rồi chạy lại mục này.';
}

/** Menu "Cập nhật trang Tổng quan". */
function updateDashboard() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  refreshDashboard_(ss);
  const sh = ss.getSheetByName(DASHBOARD_SHEET);
  if (sh) sh.activate();
  ss.toast('Đã cập nhật số liệu mới nhất.', DASHBOARD_SHEET, 4);
}

// Bố cục trang Tổng quan: dòng bắt đầu của từng phần (14 cột A–N). Biểu đồ lấy số từ các bảng bên dưới
const DASH_LAYOUT = { cols: 14, kpi: 4, todo: 9, charts: 15, months: 46, years: 61, days: 69, notes: 102, rows: 108 };
const DASH_MONTH_HEAD = ['Tháng', 'Website', 'Shopee', 'TikTok', 'Khác', 'In 3D', 'Tổng đơn', 'Doanh thu', 'Lợi nhuận',
  '% lợi nhuận', 'Khách truy cập', 'Tỷ lệ đặt hàng', 'Tư vấn', 'Yêu cầu in theo file'];

/**
 * Ghi trang "Tổng quan" trong Google Sheet: thẻ số tháng này, việc cần làm, 3 biểu đồ, bảng theo tháng, theo năm, 30
 * ngày. Trang cùng tên mà shop tự tạo (ô A1 không có ghi chú DASH_MARK) thì không đụng tới.
 */
function writeDashboard_(ss, d) {
  const L = DASH_LAYOUT;
  let sh = ss.getSheetByName(DASHBOARD_SHEET);
  if (sh && sh.getLastRow() && sh.getRange(1, 1).getNote() !== DASH_MARK) {
    console.warn(`Trang "${DASHBOARD_SHEET}" có sẵn do shop tạo: không ghi đè.`);
    return;
  }
  if (!sh) sh = ss.insertSheet(DASHBOARD_SHEET, 0);
  if (sh.getMaxRows() < L.rows) sh.insertRowsAfter(sh.getMaxRows(), L.rows - sh.getMaxRows());
  if (sh.getMaxColumns() < L.cols) sh.insertColumnsAfter(sh.getMaxColumns(), L.cols - sh.getMaxColumns());
  sh.getRange(1, 1, L.rows, L.cols).breakApart().clear();
  sh.setHiddenGridlines(true);
  sh.setColumnWidths(1, L.cols, 92);
  sh.setColumnWidth(1, 110);

  const ink = { main: '#0b0b0b', soft: '#52514e', muted: '#898781', up: '#006300', down: '#d03b3b', card: '#f3f5f7', line: '#e1e0d9' };
  const box = (r, c, h, w) => sh.getRange(r, c, h, w);
  const put = (r, c, value, w = 1) => {
    sh.getRange(r, c).setValue(value);
    if (w > 1) box(r, c, 1, w).merge();
    return box(r, c, 1, w);
  };
  const section = (r, title) => put(r, 1, title, L.cols).setFontSize(12).setFontWeight('bold').setFontColor(ink.main)
    .setBorder(null, null, true, null, null, null, ink.line, SpreadsheetApp.BorderStyle.SOLID);
  const money = '#,##0" ₫"';
  const k = d.kpi.now;
  const p = d.kpi.prev;

  put(1, 1, 'TỔNG QUAN KINH DOANH', L.cols).setFontSize(18).setFontWeight('bold').setFontColor(ink.main);
  sh.getRange(1, 1).setNote(DASH_MARK);
  put(2, 1, `Số liệu lúc ${d.updated}. Tự cập nhật khi mở Google Sheet, khi mở trang Tổng quan trên trang quản trị, hoặc menu ` +
    'SmartCarTech → Cập nhật trang Tổng quan. Trang do script tạo: sửa tay sẽ bị ghi đè.', L.cols).setFontColor(ink.muted).setFontSize(9);

  // Thẻ số tháng này, so với cùng kỳ tháng trước (từ ngày 1 tới cùng ngày)
  const delta = (now, prev, unit) => {
    const diff = now - prev;
    if (!diff) return ['– bằng cùng kỳ tháng trước', ink.muted];
    const text = unit === 'money' ? `${money_(Math.abs(diff))} ₫` : `${money_(Math.abs(diff))} ${unit}`;
    return [`${diff > 0 ? '▲ +' : '▼ −'}${text} so với cùng kỳ tháng trước`, diff > 0 ? ink.up : ink.down];
  };
  const pct = (x, digits) => (x === null ? '' : `${(x * 100).toFixed(digits).replace('.', ',')}%`);
  const cards = [
    ['Lợi nhuận tháng này', k.profit, money, delta(k.profit, p.profit, 'money'),
      k.margin === null ? 'Chưa có đơn nào điền đủ Doanh thu và Chi phí' : `Bằng ${pct(k.margin, 0)} doanh thu`],
    ['Doanh thu tháng này', k.revenue, money, delta(k.revenue, p.revenue, 'money'),
      k.noProfit ? `${k.noProfit} đơn chưa có lợi nhuận` : 'Đơn nào cũng đã có lợi nhuận'],
    ['Số đơn tháng này', k.orders, '#,##0', delta(k.orders, p.orders, 'đơn'),
      `Website ${k.web} · Shopee ${k.shopee} · TikTok ${k.tiktok} · In 3D ${k.print}${k.other ? ` · Khác ${k.other}` : ''}`],
    ['Khách truy cập tháng này', k.visitors, '#,##0', delta(k.visitors, p.visitors, 'khách'),
      d.visitsSince ? `Tỷ lệ đặt hàng ${pct(k.conversion, 1) || '–'} · ${money_(k.views)} lượt xem` : 'Web bắt đầu đếm sau khi đưa bản mới lên'],
  ];
  cards.forEach(([label, value, format, [change, color], note], i) => {
    const c = 1 + i * 3;
    box(L.kpi, c, 4, 3).setBackground(ink.card);
    put(L.kpi, c, label, 3).setFontColor(ink.soft).setFontSize(10);
    put(L.kpi + 1, c, value, 3).setNumberFormat(format).setFontSize(20).setFontWeight('bold').setFontColor(ink.main)
      .setHorizontalAlignment('left');
    put(L.kpi + 2, c, change, 3).setFontColor(color).setFontSize(9);
    put(L.kpi + 3, c, note, 3).setFontColor(ink.muted).setFontSize(9);
  });

  section(L.todo, 'Việc cần làm');
  const waiting = DASH_WAITING.map((s) => `${s} ${d.todo.print[s]}`).join(' · ');
  [
    ['Đơn In 3D đang chờ', DASH_WAITING.reduce((n, s) => n + d.todo.print[s], 0), waiting],
    ['Đơn chưa có lợi nhuận (12 tháng)', d.todo.noProfit, 'Điền Doanh thu sau điều chỉnh và Chi phí ở trang Đơn hàng'],
    ['Mã tải code chưa in', d.todo.codesNew, 'In thẻ: menu SmartCarTech → In thẻ cho các mã đang chọn…'],
    ['Thẻ đã in, chưa gán đơn', d.todo.cardsInStock, 'Số thẻ còn để bỏ vào hộp'],
  ].forEach(([label, value, hint], i) => {
    put(L.todo + 1 + i, 1, label, 4).setFontColor(ink.main);
    put(L.todo + 1 + i, 5, value).setFontWeight('bold').setHorizontalAlignment('right').setNumberFormat('#,##0');
    put(L.todo + 1 + i, 6, hint, L.cols - 5).setFontColor(ink.muted).setFontSize(9);
  });

  // Bảng nguồn của biểu đồ: tháng cũ ở trên, giống trục ngang của biểu đồ
  const table = (r, title, head, rows, size) => {
    section(r, title);
    box(r + 1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setFontColor(ink.soft).setBackground(ink.card)
      .setWrap(true).setVerticalAlignment('middle');
    const body = Array.from({ length: size }, (_, i) => (rows[i] || head.map(() => '')));
    if (size) box(r + 2, 1, size, head.length).setValues(body).setFontColor(ink.main);
    return r + 2;
  };
  // Nhãn tháng, năm dạng chữ (dấu ' ở đầu): "2026" không bị Sheet đổi thành số
  const row = (m) => [`'${m.label}`, m.web, m.shopee, m.tiktok, m.other, m.print, m.orders, m.revenue, m.profit,
    m.margin === null ? '' : m.margin, m.visitors, m.conversion === null ? '' : m.conversion, m.leads, m.quotes];
  const formats = (r, n) => {
    if (!n) return;
    box(r, 2, n, 6).setNumberFormat('#,##0');
    box(r, 8, n, 2).setNumberFormat('#,##0');
    box(r, 10, n, 1).setNumberFormat('0%');
    box(r, 11, n, 1).setNumberFormat('#,##0');
    box(r, 12, n, 1).setNumberFormat('0.0%');
    box(r, 13, n, 2).setNumberFormat('#,##0');
  };
  const monthsAt = table(L.months, `Theo tháng (${DASH_MONTHS} tháng gần nhất)`, DASH_MONTH_HEAD, d.months.map(row), DASH_MONTHS);
  formats(monthsAt, DASH_MONTHS);
  const yearsAt = table(L.years, 'Theo năm', ['Năm'].concat(DASH_MONTH_HEAD.slice(1)), d.years.map(row), DASH_YEARS);
  formats(yearsAt, d.years.length);
  // Ngày dạng chữ (dấu ' ở đầu): "03/11" không bị Sheet đổi thành ngày tháng
  const daysAt = table(L.days, `Lượt truy cập ${DASH_DAYS} ngày gần nhất`, ['Ngày', 'Lượt xem', 'Khách truy cập'],
    d.days.map((x) => [`'${x.label}`, x.views, x.visitors]), DASH_DAYS);
  box(daysAt, 2, DASH_DAYS, 2).setNumberFormat('#,##0');

  section(L.notes, 'Cách tính');
  [
    'Số đơn: trang Đơn hàng theo cột Nền tảng (trống mà mã đơn dạng SC… là đơn web), cộng đơn In 3D đặt trên web (bảng tên, giá đỡ; không tính đơn Huỷ). Yêu cầu in theo file là yêu cầu báo giá, đếm riêng.',
    'Doanh thu: cột Doanh thu sau điều chỉnh, đơn chưa điền thì lấy Tổng (₫). Lợi nhuận: cột Lợi nhuận, chỉ có ở đơn đã điền đủ Doanh thu và Chi phí; % lợi nhuận tính trên các đơn đó.',
    'Khách truy cập: số trình duyệt ghé web, đếm ẩn danh (không cookie, không lưu IP); máy đã mở trang quản trị không bị đếm. Theo tháng, mỗi khách tính 1 lần. Tỷ lệ đặt hàng: đơn đặt trên web (bộ xe + In 3D) chia cho khách truy cập.',
    `Tháng này so với cùng kỳ tháng trước: từ ngày 1 tới cùng ngày của tháng trước.${d.undated ? ` Có ${d.undated} đơn chưa có Thời gian nên chưa được tính.` : ''}`,
  ].forEach((text, i) => put(L.notes + 1 + i, 1, text, L.cols).setFontColor(ink.soft).setFontSize(9).setWrap(true));

  dashboardCharts_(sh, monthsAt, daysAt);
}

/** 3 biểu đồ của trang Tổng quan. Đã có đủ thì giữ nguyên (bảng nguồn không đổi chỗ), tránh vẽ lại mỗi lần cập nhật. */
function dashboardCharts_(sh, monthsAt, daysAt) {
  const charts = sh.getCharts();
  if (charts.length === 3) return;
  charts.forEach((c) => sh.removeChart(c));
  const L = DASH_LAYOUT;
  const style = {
    legend: { position: 'top', textStyle: { color: '#52514e', fontSize: 11 } },
    titleTextStyle: { color: '#0b0b0b', fontSize: 13, bold: true },
    vAxis: { format: 'short', gridlines: { color: '#e1e0d9' }, minorGridlines: { count: 0 }, textStyle: { color: '#898781' } },
    hAxis: { textStyle: { color: '#898781' } },
  };
  const add = (type, ranges, row, col, width, height, options) => {
    let b = sh.newChart().setChartType(type).setNumHeaders(1).setPosition(row, col, 0, 0)
      .setOption('width', width).setOption('height', height);
    ranges.forEach(([r, c, h, w]) => { b = b.addRange(sh.getRange(r, c, h, w)); });
    Object.keys(style).concat(Object.keys(options)).forEach((key) => {
      b = b.setOption(key, options.hasOwnProperty(key) ? options[key] : style[key]);
    });
    sh.insertChart(b.build());
  };
  const head = monthsAt - 1;
  add(Charts.ChartType.COLUMN, [[head, 1, DASH_MONTHS + 1, 1], [head, 8, DASH_MONTHS + 1, 2]], L.charts, 1, 640, 300,
    { title: 'Doanh thu và lợi nhuận theo tháng', colors: DASH_COLORS.money });
  add(Charts.ChartType.COLUMN, [[head, 1, DASH_MONTHS + 1, 1], [head, 2, DASH_MONTHS + 1, 5]], L.charts, 8, 640, 300,
    { title: 'Số đơn theo nền tảng', colors: DASH_COLORS.platforms, isStacked: true });
  add(Charts.ChartType.LINE, [[daysAt - 1, 1, DASH_DAYS + 1, 3]], L.charts + 16, 1, 1290, 280,
    { title: `Khách truy cập ${DASH_DAYS} ngày gần nhất`, colors: DASH_COLORS.visits, lineWidth: 2 });
}

/* ---------- Dùng chung ---------- */

/** Số thứ tự cột theo tên tiêu đề ở dòng 1 (0 = chưa có). create = true: chưa có thì thêm cột vào cuối. */
function colOf_(sh, name, create) {
  const head = header_(sh);
  const col = head.indexOf(name) + 1;
  if (col || !create) return col;
  addHeadCell_(sh, head.length + 1, name);
  return head.length + 1;
}

/** Ghi tên cột mới ở dòng 1. Trang tính đã xoá hết cột trống ở bên phải thì thêm cột trước, nếu không Sheet báo lỗi. */
function addHeadCell_(sh, col, name) {
  if (col > sh.getMaxColumns()) sh.insertColumnsAfter(sh.getMaxColumns(), col - sh.getMaxColumns());
  sh.getRange(1, col).setValue(name);
}

function header_(sh) {
  const width = sh.getLastColumn();
  return width ? sh.getRange(1, 1, 1, width).getValues()[0].map((v) => String(v).trim()) : [];
}

function getSheet_(ss, name, header) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(header);
    sh.setFrozenRows(1);
  }
  return sh;
}

/**
 * Thêm 1 dòng theo tên cột ở dòng 1 (shop đổi thứ tự cột vẫn ghi đúng chỗ); cột chưa có thì thêm vào cuối. Trang trong
 * NEWEST_FIRST: dòng mới ngay dưới dòng tiêu đề; trang khác: cuối trang. Trả số dòng vừa ghi.
 * Chữ được ghi qua safe_(), max là số ký tự tối đa mỗi ô như ở safe_(). Không ghi vào các cột trống ở cuối dòng (VD cột
 * "Mã tải code" shop tự điền).
 */
function addRow_(sh, values, max) {
  const head = header_(sh);
  Object.keys(values).forEach((name) => {
    if (head.includes(name)) return;
    head.push(name);
    addHeadCell_(sh, head.length, name);
  });
  const row = head.map((name) => {
    const v = values.hasOwnProperty(name) ? values[name] : '';
    return typeof v === 'string' ? safe_(v, max) : v;
  });
  while (row.length && row[row.length - 1] === '') row.pop();
  if (NEWEST_FIRST.includes(sh.getName())) return insertTop_(sh, [row]);
  sh.appendRow(row);
  return sh.getLastRow();
}

/**
 * Chèn các dòng `rows` (mỗi dòng: mảng ô theo thứ tự cột) ngay dưới dòng tiêu đề (dòng `after`, mặc định dòng 1), giữ
 * thứ tự; trả số dòng đầu tiên. Dòng chèn lấy định dạng số, ô tích, ô thả xuống của dòng dữ liệu ngay dưới nó, không mang
 * màu, chữ đậm của dòng tiêu đề. Chèn dòng làm số dòng của mọi dòng bên dưới đổi: chạy trong khoá của Sheet để việc
 * khác không ghi nhầm dòng.
 */
function insertTop_(sh, rows, after = 1) {
  return withDocLock_(() => {
    const first = after + 1;
    if (sh.getLastRow() < first) {
      rows.forEach((row) => sh.appendRow(row));
      return sh.getLastRow() - rows.length + 1;
    }
    const width = Math.max(sh.getLastColumn(), ...rows.map((row) => row.length));
    sh.insertRowsBefore(first, rows.length);
    const below = sh.getRange(first + rows.length, 1, 1, width);
    const formats = below.getNumberFormats()[0];
    const checks = tryGet_(() => below.getDataValidations()[0]);
    const range = sh.getRange(first, 1, rows.length, width);
    range.clearFormat().setNumberFormats(rows.map(() => formats));
    if (checks) range.setDataValidations(rows.map(() => checks));
    // Ô "Văn bản thuần" giữ nguyên dấu ' ở đầu: bỏ đi, ô đó vốn không đổi chữ thành số, ngày hay công thức
    const values = rows.map((row) => Array.from({ length: width }, (_, c) => {
      const v = c < row.length ? row[c] : '';
      return formats[c] === '@' && typeof v === 'string' && v[0] === "'" ? v.slice(1) : v;
    }));
    try {
      range.setValues(values);
    } catch (err) {
      sh.deleteRows(first, rows.length); // Không để lại dòng trống trên cùng
      throw err;
    }
    return first;
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Ghi dữ liệu khách nhập dưới dạng chữ, tránh bị hiểu thành công thức (=, +, -, @) và giữ số 0 đầu SĐT. */
function safe_(value, max) {
  const s = String(value == null ? '' : value).slice(0, max || 2000);
  return /^[=+\-@0-9]/.test(s) ? "'" + s : s;
}

/**
 * Email báo shop, tối đa MAX_EMAILS_PER_HOUR email mỗi giờ: bị spam cũng không hết hạn mức email trong ngày
 * (Gmail thường khoảng 100 email/ngày). Gửi lỗi thì bỏ qua: đơn đã lưu, web vẫn báo khách đã gửi.
 */
function notify_(subject, body) {
  if (!NOTIFY_EMAIL) return;
  const count = bump_('email', 3600);
  if (count > MAX_EMAILS_PER_HOUR + 1) return;
  if (count > MAX_EMAILS_PER_HOUR) {
    subject = 'SmartCarTech: tạm dừng email báo đơn đến đầu giờ sau';
    body = `Trong giờ này đã có hơn ${MAX_EMAILS_PER_HOUR} đơn hàng / yêu cầu mới, có thể web đang bị spam. ` +
      'Các đơn vẫn được lưu: mở Google Sheet để xem. Email báo đơn tự gửi lại từ đầu giờ sau.';
  }
  try {
    MailApp.sendEmail(NOTIFY_EMAIL, subject, body);
  } catch (err) {
    console.error(err);
  }
}

/* ---------- Giao diện cửa sổ in thẻ (printCards) ----------
   __DATA__ được thay bằng danh sách mã. Mã QR mở huong-dan.html?ma=<mã>: trang Hướng dẫn tự điền mã.
   Giữ phần dưới không có dấu backtick, "${" hay dấu gạch ngược vì cả khối là một chuỗi template.
   Thư viện QR có integrity (SRI): file trên CDN bị đổi thì trình duyệt không chạy, cửa sổ báo không tải được
   thư viện. Đổi phiên bản thư viện thì lấy mã SRI mới ở cdnjs.com. */
const CARD_PAGE_HTML = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>Thẻ mã tải code</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700&family=Chakra+Petch:wght@600;700&family=JetBrains+Mono:wght@700&display=swap">
<style id="css">
@page { size: A4; margin: 0; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
html, body { margin: 0; }
body { font-family: 'Be Vietnam Pro', Arial, sans-serif; color: #04080C; background: #E6EAED; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

.toolbar { position: sticky; top: 0; z-index: 1; display: flex; flex-wrap: wrap; align-items: flex-start; gap: 10px 20px; padding: 12px 16px; background: #fff; border-bottom: 1px solid #D5DBE0; font-size: 13px; line-height: 1.45; }
.toolbar__info { flex: 1 1 360px; min-width: 0; }
.toolbar__info p { margin: 3px 0 0; color: #4A5560; }
.toolbar h1 { margin: 0; font-size: 16px; }
.toolbar label { display: flex; align-items: center; gap: 6px; margin-top: 6px; cursor: pointer; }
.toolbar .warn { color: #9A5B00; }
.toolbar__actions { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; max-width: 300px; text-align: right; }
.btn { padding: 9px 22px; border: 0; border-radius: 8px; background: #04080C; color: #fff; font: 600 14px 'Be Vietnam Pro', Arial, sans-serif; cursor: pointer; }
.btn:disabled { opacity: 0.4; cursor: default; }
.link { padding: 0; border: 0; background: none; color: #0B6E8A; font: inherit; font-size: 12px; text-decoration: underline; cursor: pointer; }
.link:disabled { color: #8A9199; cursor: default; }
.status { font-size: 12px; color: #0B6E8A; }
.status.is-error { color: #B42318; }

.pages { padding: 16px; }
.sheet { width: 210mm; height: 296mm; margin: 0 auto 16px; overflow: hidden; background: #fff; box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18); }
.grid { display: grid; grid-template-columns: repeat(2, 85mm); grid-auto-rows: 54mm; width: 170mm; margin: 13mm auto 0; }

/* Đường cắt: viền 0,2 mm nằm giữa mép thẻ nên 2 thẻ cạnh nhau chỉ có 1 nét */
.card { position: relative; display: flex; flex-direction: column; overflow: hidden; padding: 4.4mm 4.5mm 2.8mm; outline: 0.2mm solid #A9B3BB; outline-offset: -0.1mm; }
.card__bar { position: absolute; top: 0; left: 0; right: 0; border-top: 1.3mm solid #18E5FE; }
.card__main { flex: 1; display: flex; gap: 3mm; min-height: 0; }
.card__info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.card__logo { display: block; align-self: flex-start; height: 10.5mm; width: auto; }
.card__brand { font: 700 13pt 'Chakra Petch', Arial, sans-serif; line-height: 10.5mm; }
.card__eyebrow { margin: 1.4mm 0 0; font: 600 6.4pt 'Chakra Petch', Arial, sans-serif; letter-spacing: 0.08em; text-transform: uppercase; color: #5B6B78; }
.card__how { margin: 0.5mm 0 0; font-size: 6.8pt; line-height: 1.35; }
.card__key { align-self: flex-start; margin-top: auto; padding: 0.8mm 2.4mm 1mm; border: 0.35mm solid #04080C; border-radius: 1.6mm; }
.card__key span { display: block; font-size: 5.4pt; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: #5B6B78; }
.card__key b { display: block; font: 700 14.5pt 'JetBrains Mono', Consolas, monospace; letter-spacing: 0.05em; line-height: 1.2; }
.card__qr { display: flex; flex-direction: column; align-items: center; gap: 1mm; width: 23mm; padding-top: 0.6mm; }
.qr { width: 23mm; height: 23mm; }
.qr svg { display: block; width: 100%; height: 100%; shape-rendering: crispEdges; }
.card__qr span { font-size: 5.8pt; font-weight: 600; color: #5B6B78; text-align: center; }
.card__foot { margin: 1.6mm 0 0; padding-top: 1.1mm; border-top: 0.2mm solid #D5DBE0; font-size: 5.6pt; color: #5B6B78; }

@media print {
  body { background: #fff; }
  .toolbar { display: none; }
  .pages { padding: 0; }
  .sheet { margin: 0; box-shadow: none; break-after: page; }
  .sheet:last-child { break-after: auto; }
}
</style>
</head>
<body>
<div class="toolbar">
  <div class="toolbar__info">
    <h1 id="summary">Đang chuẩn bị thẻ…</h1>
    <p class="warn" id="notes" hidden></p>
    <label id="reprint-box" hidden><input type="checkbox" id="reprint"> <span id="reprint-text"></span></label>
    <p>Khi in: khổ giấy A4, tỷ lệ Mặc định (100%). Nên in giấy cứng, cắt theo đường viền xám.</p>
  </div>
  <div class="toolbar__actions">
    <button type="button" class="btn" id="print" disabled>In thẻ</button>
    <button type="button" class="link" id="open-tab" disabled>Không hiện hộp thoại in? Mở trong tab mới</button>
    <span class="status" id="status" role="status"></span>
  </div>
</div>
<div class="pages" id="pages"></div>

<script type="application/json" id="data">__DATA__</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js" integrity="sha512-ZDSPMa/JM1D+7kdg2x3BsruQ6T/JpJo3jWDWkCZsP+5yVyp1KfESqLI+7RqB5k24F7p2cV7i2YHh/890y6P6Sw==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
<script>
(function () {
  var PER_PAGE = 10;
  var data = JSON.parse(document.getElementById('data').textContent);
  var host = data.site.replace(/^https?:[/][/]/, '');
  var printedBefore = data.cards.filter(function (c) { return c.printed; });
  var ready = false;
  var logoOk = true;

  function el(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function selected() {
    return data.cards.filter(function (c) { return !c.printed || el('reprint').checked; });
  }
  function setStatus(text, isError) {
    el('status').textContent = text;
    el('status').classList.toggle('is-error', Boolean(isError));
  }

  function qrSvg(text) {
    var qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 1, margin: 0, scalable: true });
  }

  function cardHtml(code) {
    var url = data.site + '/huong-dan.html?ma=' + encodeURIComponent(code);
    var logo = logoOk
      ? '<img class="card__logo" src="' + esc(data.logo) + '" alt="SmartCarTech">'
      : '<div class="card__brand">SmartCarTech</div>';
    return '<div class="card">' +
      '<div class="card__bar"></div>' +
      '<div class="card__main">' +
        '<div class="card__info">' + logo +
          '<p class="card__eyebrow">Code mẫu cho xe robot</p>' +
          '<p class="card__how">Quét mã QR hoặc vào<br><b>' + esc(host) + '/huong-dan.html</b></p>' +
          '<div class="card__key"><span>Mã tải code</span><b>' + esc(code) + '</b></div>' +
        '</div>' +
        '<div class="card__qr"><div class="qr">' + qrSvg(url) + '</div><span>Quét để tải code</span></div>' +
      '</div>' +
      '<p class="card__foot">Vui lòng không chia sẻ mã · Hỗ trợ qua Zalo ' + esc(data.zalo) + '</p>' +
    '</div>';
  }

  function render() {
    var list = selected();
    var pages = [];
    for (var i = 0; i < list.length; i += PER_PAGE) {
      pages.push('<section class="sheet"><div class="grid">' +
        list.slice(i, i + PER_PAGE).map(function (c) { return cardHtml(c.code); }).join('') +
        '</div></section>');
    }
    el('pages').innerHTML = pages.join('');
    if (list.length) el('summary').textContent = list.length + ' thẻ · ' + pages.length + ' trang A4';
    else el('summary').textContent = 'Các mã đã chọn đều đã in. Tích ô bên dưới nếu cần in lại.';
    updateButtons();
  }

  function updateButtons() {
    var off = !ready || !selected().length;
    el('print').disabled = off;
    el('open-tab').disabled = off;
  }

  function markPrinted() {
    var codes = selected().map(function (c) { return c.code; });
    setStatus('Đang ghi ngày in vào Sheet…');
    google.script.run
      .withSuccessHandler(function (n) { setStatus('Đã ghi ngày in cho ' + n + ' mã (cột "Đã in").'); })
      .withFailureHandler(function (err) { setStatus('Chưa ghi được ngày in: ' + err.message, true); })
      .markCardsPrinted(codes);
  }

  function openTab() {
    var w = window.open('', '_blank');
    if (!w) {
      setStatus('Trình duyệt đã chặn cửa sổ mới. Cho phép cửa sổ bật lên rồi thử lại.', true);
      return;
    }
    var head = document.querySelector('link[rel="stylesheet"]').outerHTML + '<style>' + el('css').textContent + '</style>';
    w.document.open();
    w.document.write('<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Thẻ mã tải code</title>' +
      head + '</head><body>' + el('pages').outerHTML + '</body></html>');
    w.document.close();
  }

  if (typeof qrcode !== 'function') {
    el('summary').textContent = 'Không tải được thư viện tạo mã QR. Kiểm tra kết nối mạng rồi mở lại cửa sổ này.';
    return;
  }

  var notes = [];
  if (data.locked) notes.push(data.locked + ' mã đã khoá');
  if (data.used) notes.push(data.used + ' mã đã có lượt tải');
  if (data.linked) notes.push(data.linked + ' mã đã gán cho đơn');
  if (notes.length) {
    el('notes').hidden = false;
    el('notes').textContent = 'Bỏ qua ' + notes.join(', ') + ' (không in các mã này).';
  }
  if (printedBefore.length) {
    el('reprint-box').hidden = false;
    el('reprint-text').textContent = 'In lại ' + printedBefore.length + ' mã đã in trước đó (ngày ' +
      printedBefore[0].printed + (printedBefore.length > 1 ? ', …' : '') + ')';
  }
  el('reprint').addEventListener('change', render);
  el('print').addEventListener('click', function () { markPrinted(); window.print(); });
  el('open-tab').addEventListener('click', function () {
    markPrinted();
    openTab();
  });

  // Chờ logo và font tải xong mới cho in, tránh thẻ in ra thiếu logo hoặc sai font
  var logo = new Image();
  new Promise(function (resolve) {
    logo.onload = resolve;
    logo.onerror = function () { logoOk = false; resolve(); };
    logo.src = data.logo;
  }).then(function () {
    render();
    return document.fonts.ready;
  }).then(function () {
    ready = true;
    updateButtons();
  });
})();
</script>
</body>
</html>`;

/* ---------- Cửa sổ "Tài khoản trang quản trị" (showAdminAccounts) ----------
   __DATA__ được thay bằng địa chỉ trang quản trị và số ký tự tối thiểu của mật khẩu. Như CARD_PAGE_HTML: giữ phần
   dưới không có dấu backtick, "${" hay dấu gạch ngược. Mật khẩu chỉ gửi thẳng tới saveAdminAccount, không lưu ở đâu khác.
   Mã QR để bật mã 2 bước được vẽ ngay trong cửa sổ, bằng đúng thư viện (có SRI) của CARD_PAGE_HTML: khoá không gửi đi
   đâu, và biến khỏi trang khi đóng phần cài. */
const ADMIN_ACCOUNTS_HTML = `<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600&display=swap">
<style>
* { box-sizing: border-box; }
[hidden] { display: none !important; }
body { margin: 0; padding: 2px 4px 12px; font: 14px/1.5 'Be Vietnam Pro', Arial, sans-serif; color: #04080C; }
p { margin: 0; }
.help { color: #4A5560; font-size: 13px; }
.help b { color: #04080C; }
h2 { margin: 18px 0 8px; font-size: 14px; }
.list { list-style: none; margin: 0; padding: 0; border: 1px solid #D5DBE0; border-radius: 8px; }
.list li { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 4px 12px; min-height: 42px; padding: 6px 12px; border-top: 1px solid #E6EAED; }
.list li:first-child { border-top: 0; }
.list .empty { color: #5B6B78; }
.acct { display: flex; flex-direction: column; min-width: 0; }
.acct small { font-size: 12px; color: #8A4B00; }
.acct small.is-on { color: #1D6B3A; }
.tools { display: flex; flex-wrap: wrap; gap: 4px 14px; }
label { display: block; margin: 12px 0 4px; font-size: 13px; font-weight: 600; }
input { width: 100%; padding: 9px 10px; border: 1px solid #A9B3BB; border-radius: 6px; font: inherit; }
input:focus { outline: 2px solid #0B6E8A; outline-offset: 0; border-color: #0B6E8A; }
.actions { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 16px; }
.btn { padding: 9px 22px; border: 0; border-radius: 8px; background: #04080C; color: #fff; font: 600 14px 'Be Vietnam Pro', Arial, sans-serif; cursor: pointer; }
.btn:disabled { opacity: 0.5; cursor: progress; }
.link { padding: 0; border: 0; background: none; color: #0B6E8A; font: inherit; font-size: 13px; text-decoration: underline; cursor: pointer; }
.link.danger { color: #B42318; }
.generated { margin-top: 10px; padding: 8px 10px; border-radius: 6px; background: #E9F6F9; font-size: 13px; }
.generated code { font: 600 15px Consolas, monospace; letter-spacing: 0.04em; user-select: all; }
.status { min-height: 21px; margin-top: 10px; color: #0B6E8A; font-size: 13px; }
.status.is-error { color: #B42318; }
.totp { margin-top: 18px; padding: 2px 14px 14px; border: 1px solid #D5DBE0; border-radius: 8px; }
.steps { margin: 0 0 6px; padding-left: 20px; font-size: 13px; }
.steps li { margin: 3px 0; }
.qr { width: 196px; height: 196px; margin: 8px auto; }
.qr svg { display: block; width: 100%; height: 100%; }
.key-line { margin: 4px 0 2px; text-align: center; }
.key { font: 600 14px Consolas, monospace; letter-spacing: 0.04em; user-select: all; }
#totp-code { font: 600 20px Consolas, monospace; letter-spacing: 0.25em; text-align: center; }
</style>
</head>
<body>
<p class="help">Đăng nhập trang quản trị tại <b id="page"></b>. Mật khẩu chỉ lưu dạng mã hoá trong script của Google Sheet này: không ai xem lại được, quên thì đặt mật khẩu mới ở đây.</p>

<h2>Tài khoản hiện có</h2>
<ul class="list" id="list"><li class="empty">Đang tải…</li></ul>

<section class="totp" id="totp" hidden aria-labelledby="totp-title">
  <h2 id="totp-title">Mã 2 bước cho <span id="totp-name"></span></h2>
  <ol class="steps">
    <li>Trên điện thoại, cài ứng dụng <b>Google Authenticator</b> (hoặc Microsoft Authenticator).</li>
    <li>Trong ứng dụng bấm <b>+</b> → <b>Quét mã QR</b> (Scan a QR code), quét mã dưới đây.</li>
    <li>Nhập mã 6 số ứng dụng hiện cho SmartCarTech, rồi bấm <b>Xác nhận</b>.</li>
  </ol>
  <div class="qr" id="totp-qr" role="img" aria-label="Mã QR để thêm tài khoản vào ứng dụng xác minh"></div>
  <p class="help" id="totp-noqr" hidden>Không tải được thư viện vẽ mã QR (kiểm tra mạng): dùng cách nhập khoá bên dưới.</p>
  <p class="help">Không quét được: trong ứng dụng chọn <b>Nhập khoá thiết lập</b> (Enter a setup key), tên tuỳ ý, loại <b>theo thời gian</b>, khoá:</p>
  <p class="key-line"><span class="key" id="totp-key"></span></p>
  <form id="totp-form" novalidate>
    <label for="totp-code">Mã 6 số trong ứng dụng</label>
    <input id="totp-code" inputmode="numeric" autocomplete="one-time-code" maxlength="7" placeholder="123 456">
    <div class="actions">
      <button type="button" class="link" id="totp-cancel">Huỷ</button>
      <button type="submit" class="btn" id="totp-ok">Xác nhận</button>
    </div>
    <p class="status" id="totp-status" role="status"></p>
  </form>
  <p class="help">Bật xong, mọi nơi đang đăng nhập bằng tài khoản này bị đăng xuất; lần sau đăng nhập cần mật khẩu và mã 6 số. Mất điện thoại: mở cửa sổ này, bấm <b>Tắt mã 2 bước</b> rồi bật lại trên điện thoại mới.</p>
</section>

<div id="add">
<h2>Thêm tài khoản hoặc đổi mật khẩu</h2>
<form id="form" novalidate>
  <label for="name">Tên đăng nhập</label>
  <input id="name" maxlength="30" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="VD: admin">
  <label for="pass">Mật khẩu mới</label>
  <input id="pass" type="password" maxlength="200" autocomplete="new-password">
  <label for="pass2">Nhập lại mật khẩu</label>
  <input id="pass2" type="password" maxlength="200" autocomplete="new-password">
  <p class="generated" id="generated" hidden>Mật khẩu vừa tạo: <code id="generated-text"></code><br>Chép lại cẩn thận rồi mới bấm Lưu.</p>
  <div class="actions">
    <button type="button" class="link" id="gen">Tạo mật khẩu mạnh</button>
    <button type="submit" class="btn" id="save">Lưu tài khoản</button>
  </div>
  <p class="status" id="status" role="status"></p>
</form>
<p class="help">Đổi mật khẩu: nhập tên đã có và mật khẩu mới. Mọi nơi đang đăng nhập bằng tài khoản đó sẽ bị đăng xuất.</p>
</div>

<script type="application/json" id="data">__DATA__</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js" integrity="sha512-ZDSPMa/JM1D+7kdg2x3BsruQ6T/JpJo3jWDWkCZsP+5yVyp1KfESqLI+7RqB5k24F7p2cV7i2YHh/890y6P6Sw==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
<script>
(function () {
  var data = JSON.parse(document.getElementById('data').textContent);
  var NAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;
  var setup = null; // { name, key, uri }: đang bật mã 2 bước cho tài khoản này

  function el(id) { return document.getElementById(id); }
  function show(node, text, isError) {
    node.textContent = text;
    node.className = 'status' + (isError ? ' is-error' : '');
  }
  function setStatus(text, isError) { show(el('status'), text, isError); }

  function button(text, act, name, danger) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'link' + (danger ? ' danger' : '');
    b.textContent = text;
    b.dataset.act = act;
    b.dataset.name = name;
    return b;
  }

  // Bấm 2 lần mới làm, tránh lỡ tay
  function twice(b, ask, go) {
    var idle = b.textContent;
    b.addEventListener('click', function () {
      if (b.dataset.armed !== '1') {
        b.dataset.armed = '1';
        b.textContent = ask;
        setTimeout(function () { b.dataset.armed = ''; b.textContent = idle; }, 4000);
        return;
      }
      go();
    });
  }

  function render(accounts) {
    var list = el('list');
    list.textContent = '';
    if (!accounts.length) {
      var empty = document.createElement('li');
      empty.className = 'empty';
      empty.textContent = 'Chưa có tài khoản nào: tạo tài khoản đầu tiên ở dưới.';
      list.appendChild(empty);
      return;
    }
    accounts.forEach(function (a) {
      var li = document.createElement('li');
      var info = document.createElement('div');
      info.className = 'acct';
      var b = document.createElement('b');
      b.textContent = a.name;
      var state = document.createElement('small');
      state.className = a.totp ? 'is-on' : '';
      state.textContent = a.totp ? 'Đã bật mã 2 bước' : 'Chưa bật mã 2 bước';
      info.appendChild(b);
      info.appendChild(state);
      var tools = document.createElement('div');
      tools.className = 'tools';
      var on = button(a.totp ? 'Cài lại mã 2 bước' : 'Bật mã 2 bước', 'totp', a.name);
      on.addEventListener('click', function () { startTotp(a.name); });
      tools.appendChild(on);
      if (a.totp) {
        var off = button('Tắt mã 2 bước', 'totp-off', a.name, true);
        twice(off, 'Bấm lần nữa để tắt', function () { run('removeAdminTotp', [a.name], 'Đã tắt mã 2 bước của ' + a.name + '.'); });
        tools.appendChild(off);
      }
      var del = button('Xoá', 'del', a.name, true);
      twice(del, 'Bấm lần nữa để xoá', function () { run('removeAdminAccount', [a.name], 'Đã xoá tài khoản ' + a.name + '.'); });
      tools.appendChild(del);
      li.appendChild(info);
      li.appendChild(tools);
      list.appendChild(li);
    });
  }

  function run(fn, args, done, after) {
    closeTotp();
    el('save').disabled = true;
    setStatus('Đang lưu…');
    var call = google.script.run
      .withSuccessHandler(function (accounts) {
        el('save').disabled = false;
        render(accounts);
        setStatus(done);
        if (after) after();
      })
      .withFailureHandler(function (err) {
        el('save').disabled = false;
        setStatus(err.message, true);
      });
    call[fn].apply(call, args);
  }

  /* ---------- Mã 2 bước ---------- */
  function drawQr(text) {
    var box = el('totp-qr');
    var ok = typeof qrcode === 'function';
    box.textContent = '';
    if (ok) {
      var qr = qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      box.innerHTML = qr.createSvgTag({ cellSize: 1, margin: 4, scalable: true });
    }
    box.hidden = !ok;
    el('totp-noqr').hidden = ok;
  }

  function startTotp(name) {
    closeTotp();
    setStatus('Đang tạo mã QR…');
    google.script.run
      .withSuccessHandler(function (s) {
        setup = s;
        setStatus('');
        el('totp-name').textContent = s.name;
        el('totp-key').textContent = s.key.replace(/(....)/g, '$1 ').trim();
        drawQr(s.uri);
        el('totp-code').value = '';
        show(el('totp-status'), '');
        el('add').hidden = true;
        el('totp').hidden = false;
        el('totp').scrollIntoView();
        el('totp-code').focus();
      })
      .withFailureHandler(function (err) { setStatus(err.message, true); })
      .startAdminTotp(name);
  }

  // Đóng phần cài: khoá và mã QR biến khỏi trang
  function closeTotp() {
    setup = null;
    el('totp').hidden = true;
    el('add').hidden = false;
    el('totp-qr').textContent = '';
    el('totp-key').textContent = '';
  }

  el('totp-cancel').addEventListener('click', function () {
    closeTotp();
    setStatus('');
  });
  el('totp-form').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!setup) return;
    var code = el('totp-code').value.replace(/[^0-9]/g, '');
    if (code.length !== 6) {
      show(el('totp-status'), 'Nhập đủ 6 số ứng dụng đang hiện.', true);
      el('totp-code').focus();
      return;
    }
    var name = setup.name;
    el('totp-ok').disabled = true;
    show(el('totp-status'), 'Đang kiểm tra…');
    google.script.run
      .withSuccessHandler(function (accounts) {
        el('totp-ok').disabled = false;
        closeTotp();
        render(accounts);
        setStatus('Đã bật mã 2 bước cho ' + name + '. Lần sau đăng nhập cần mật khẩu và mã 6 số trên điện thoại.');
      })
      .withFailureHandler(function (err) {
        el('totp-ok').disabled = false;
        show(el('totp-status'), err.message, true);
        el('totp-code').select();
      })
      .confirmAdminTotp(name, code);
  });

  // 15 ký tự ngẫu nhiên (khoảng 87 bit), bỏ các chữ dễ nhầm 0/O, 1/l/I
  function strongPassword() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
    var bytes = new Uint32Array(15);
    crypto.getRandomValues(bytes);
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += chars.charAt(bytes[i] % chars.length);
    return s.slice(0, 5) + '-' + s.slice(5, 10) + '-' + s.slice(10);
  }

  el('page').textContent = data.page;
  el('pass').placeholder = 'Ít nhất ' + data.min + ' ký tự';
  el('gen').addEventListener('click', function () {
    var p = strongPassword();
    el('pass').value = p;
    el('pass2').value = p;
    el('generated-text').textContent = p;
    el('generated').hidden = false;
  });
  el('form').addEventListener('submit', function (e) {
    e.preventDefault();
    var name = el('name').value.trim().toLowerCase();
    if (!NAME_RE.test(name)) {
      setStatus('Tên đăng nhập 3–30 ký tự: chữ không dấu, số, dấu chấm, gạch ngang, gạch dưới.', true);
      el('name').focus();
      return;
    }
    if (el('pass').value.length < data.min) {
      setStatus('Mật khẩu cần ít nhất ' + data.min + ' ký tự.', true);
      el('pass').focus();
      return;
    }
    if (el('pass').value !== el('pass2').value) {
      setStatus('Hai lần nhập mật khẩu chưa giống nhau.', true);
      el('pass2').focus();
      return;
    }
    run('saveAdminAccount', [name, el('pass').value], 'Đã lưu tài khoản ' + name + '. Đăng nhập tại ' + data.page, function () {
      el('pass').value = '';
      el('pass2').value = '';
      el('generated').hidden = true;
    });
  });

  google.script.run
    .withSuccessHandler(render)
    .withFailureHandler(function (err) { setStatus(err.message, true); })
    .listAdminAccounts();
})();
</script>
</body>
</html>`;
