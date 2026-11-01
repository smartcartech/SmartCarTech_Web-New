/**
 * SmartCarTech — Google Apps Script cho website. Hướng dẫn cài từng bước: README.md, mục 5.
 *
 * Script này làm 3 việc:
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
// "Mã đơn", "Khách hàng": script tự điền khi shop gõ mã của thẻ vào đơn ở trang "Đơn hàng"
const CODE_HEADER = ['Mã', 'Ghi chú', 'Khoá', 'Số lần tải', 'Tải lần đầu', 'Tải gần nhất', 'File tải gần nhất', PRINTED_COL, 'Mã đơn', 'Khách hàng'];
// Không có 0/O, 1/I/L để khách đọc và gõ không nhầm
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const ORDER_SHEET = 'Đơn hàng';
const ORDER_KEY_COL = 'Mã tải code'; // Cột ở trang "Đơn hàng": shop gõ mã của thẻ bỏ vào hộp của đơn đó
const ORDER_CHECK_COL = 'Kiểm tra';  // Script ghi khi tổng web gửi khác giá đúng, hoặc chưa đối chiếu được giá
const ORDER_PLATFORM_COL = 'Nền tảng'; // Đơn từ web ghi WEB_PLATFORM; đơn gộp từ "Customer Infor" ghi Shopee, Tiktok…
const WEB_PLATFORM = 'Website';
const ORDER_HEADER = ['Thời gian', 'Mã đơn', 'Họ tên', 'SĐT', 'Địa chỉ', 'Sản phẩm', 'Tổng (₫)', ORDER_CHECK_COL, 'Ghi chú', ORDER_KEY_COL];
const PHONE_RE = /^(0|\+?84)(3|5|7|8|9)\d{8}$/; // Giống assets/js/core.js

const PRINT_SHEET = 'In 3D';
const PRINT_STATUS_COL = 'Trạng thái'; // Shop chọn ở ô thả xuống; đơn, yêu cầu mới ghi "Mới"
const PRINT_STATUSES = ['Mới', 'Đã liên hệ', 'Đã chốt', 'Đang in', 'Đã giao', 'Huỷ'];
const PRINT_HEADER = ['Thời gian', 'Mã', 'Loại', 'Họ tên', 'SĐT', 'Địa chỉ', 'Nội dung', 'Số lượng', 'Tạm tính (₫)', ORDER_CHECK_COL, 'Ghi chú', PRINT_STATUS_COL];
// Chữ in trên bảng tên: chữ cái (có dấu tiếng Việt), số, dấu câu thường dùng. Giống assets/js/print3d.js
const PLATE_TEXT_RE = /^[\p{Script=Latin}\p{M}\p{Nd} .,:;!?&'"’‘“”()\/+\-–—#@*]*$/u;

const LEAD_SHEET = 'Tư vấn';

// Trang quản trị (quan-tri.html). Tạo tài khoản: menu "SmartCarTech" → "Tài khoản trang quản trị…"
const ADMIN_LOG_SHEET = 'Nhật ký quản trị'; // Script ghi mọi lần đăng nhập, sửa, thêm, xoá dòng trên trang quản trị
const ADMIN_IDLE_HOURS = 3;    // Không thao tác quá bấy nhiêu giờ thì phải đăng nhập lại (tối đa 6)
const ADMIN_MAX_HOURS = 12;    // Mỗi lần đăng nhập dùng được tối đa bấy nhiêu giờ
const ADMIN_MAX_FAILS = 5;     // 1 tài khoản sai mật khẩu quá bấy nhiêu lần trong 15 phút thì tạm khoá 15 phút (cả web: gấp 6 lần)
const ADMIN_MIN_PASSWORD = 10; // Mật khẩu ít nhất bấy nhiêu ký tự
const ADMIN_MAX_CELLS = 40000; // Trang tính lớn hơn thì web chỉ hiện các dòng tiêu đề và các dòng cuối (mới nhất)

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
    products.push(`${kit.line} – ${kit.kit} × ${qty}`);
    total += kit.price * qty;
  }
  const sentTotal = Number(data.total) || 0;
  if (kits && sentTotal !== total) {
    checks.push(`Web gửi tổng ${money_(sentTotal)} ₫, giá đúng ${money_(total)} ₫: báo lại giá cho khách khi gọi xác nhận.`);
  }
  if (overLimit_(phone)) return 'busy';

  appendRow_(getSheet_(SpreadsheetApp.getActiveSpreadsheet(), ORDER_SHEET, ORDER_HEADER), {
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

  const sh = getSheet_(SpreadsheetApp.getActiveSpreadsheet(), LEAD_SHEET, ['Thời gian', 'Họ tên', 'SĐT', 'Nội dung']);
  sh.appendRow([new Date(), safe_(name), safe_(phone), safe_(message)]);
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
  appendRow_(sh, Object.assign({ 'Thời gian': new Date(), 'Mã': code, 'Họ tên': name, 'SĐT': phone }, row.cells,
    { [PRINT_STATUS_COL]: PRINT_STATUSES[0] }));
  const statusCol = colOf_(sh, PRINT_STATUS_COL, false);
  if (statusCol) {
    sh.getRange(sh.getLastRow(), statusCol).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(PRINT_STATUSES, true).setAllowInvalid(true).build());
  }
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
    const rows = sh.getDataRange().getValues();
    const i = rows.findIndex((r, n) => n > 0 && normalizeCode_(r[0]) === code);
    if (i < 0) return { ok: false, error: 'Mã không đúng. Kiểm tra lại mã in trên thẻ trong hộp.' };
    const row = rows[i];
    if (isLocked_(row[2])) return { ok: false, error: 'Mã này đã bị khoá. Vui lòng nhắn Zalo cho shop.' };
    const count = Number(row[3]) || 0;
    if (count >= MAX_DOWNLOADS) return { ok: false, error: 'Mã này đã hết lượt tải. Vui lòng nhắn Zalo cho shop.' };

    const file = codeFile_(name);
    if (!file) return { ok: false, error: 'File code này đang được cập nhật. Vui lòng nhắn Zalo cho shop.' };
    const now = new Date();
    sh.getRange(i + 1, 4, 1, 4).setValues([[count + 1, row[4] || now, now, name]]);
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
    .addItem('Tài khoản trang quản trị…', 'showAdminAccounts')
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
  const used = new Set(sh.getDataRange().getValues().map((r) => normalizeCode_(r[0])));
  const rows = [];
  while (rows.length < count) {
    const code = newCode_();
    if (used.has(normalizeCode_(code))) continue;
    used.add(normalizeCode_(code));
    rows.push([code, note, false, 0].concat(CODE_HEADER.slice(4).map(() => '')));
  }
  const start = sh.getLastRow() + 1;
  sh.getRange(start, 1, count, 1).setNumberFormat('@'); // giữ mã ở dạng chữ, VD "2345-6789" không bị đổi thành số
  sh.getRange(start, 1, count, CODE_HEADER.length).setValues(rows);
  sh.getRange(start, 3, count, 1).insertCheckboxes();
  sh.activate();
  sh.setActiveRange(sh.getRange(start, 1, count, 1));
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
    ? `✓ Email báo đơn gửi tới ${NOTIFY_EMAIL}. Hôm nay còn gửi được ${MailApp.getRemainingDailyQuota()} email.`
    : '✗ Chưa điền NOTIFY_EMAIL: shop sẽ không nhận email khi có đơn mới.');
  lines.push(codeFolderStatus_());
  const admins = Object.keys(adminAccounts_()).sort();
  lines.push(admins.length
    ? `✓ Trang quản trị ${SITE_URL}/quan-tri.html: ${admins.length} tài khoản (${admins.join(', ')}).`
    : '✗ Chưa có tài khoản trang quản trị: menu SmartCarTech → Tài khoản trang quản trị… để tạo.');
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
    const code = String(row[0]).trim();
    if (!normalizeCode_(code)) return;
    if (isLocked_(row[2])) data.locked++;
    else if (Number(row[3]) > 0) data.used++;
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
      : 'Bôi chọn các mã cần in ở cột "Mã" (chọn được nhiều dòng) rồi chọn lại menu này.');
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
    if (last < 2 || !want.size) return 0;
    const col = colOf_(sh, PRINTED_COL, true);
    const keys = sh.getRange(2, 1, last - 1, 1).getValues();
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
 */
function onEdit(e) {
  if (!e || !e.range) return;
  const sh = e.range.getSheet();
  if (e.range.getLastRow() < 2 || !watchesCodes_(sh, e.range.getColumn(), e.range.getLastColumn())) return;
  const done = withDocLock_(() => linkCodes_(sh, e.range.getRow(), e.range.getLastRow()));
  if (done && done.issue) sh.getParent().toast(done.issue, 'Chưa gán được mã', 8);
  else if (done && done.linked) sh.getParent().toast(`Đã ghi Mã đơn, Khách hàng ở trang "${CODE_SHEET}".`, 'Đã gán mã', 4);
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
  const head = header_(os);
  const [iId, iName, iPhone, iKey] = ['Mã đơn', 'Họ tên', 'SĐT', ORDER_KEY_COL].map((name) => head.indexOf(name));
  const orders = os.getRange(2, 1, last - 1, head.length).getValues();
  const text = (row, i) => (i < 0 ? '' : String(row[i] == null ? '' : row[i]).trim());

  const cOrder = colOf_(cs, 'Mã đơn', true);
  const cCustomer = colOf_(cs, 'Khách hàng', true);
  const codes = cs.getLastRow() > 1 ? cs.getRange(2, 1, cs.getLastRow() - 1, cs.getLastColumn()).getValues() : [];
  const index = new Map(); // mã đã chuẩn hoá → dòng ở trang "Mã tải code"
  codes.forEach((r, ci) => {
    const k = normalizeCode_(r[0]);
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
      } else if (isLocked_(codes[ci][2])) {
        problems[i].push(`Mã ${codes[ci][0]} đã bị khoá.`);
      } else if (id && !owner.has(k)) {
        owner.set(k, i);
      } else if (id) {
        const prev = owner.get(k);
        const takeOver = text(codes[ci], cOrder - 1) === id && text(orders[prev], iId) !== id;
        if (takeOver) owner.set(k, i);
        const [keep, lose] = takeOver ? [i, prev] : [prev, i];
        problems[lose].push(`Mã ${codes[ci][0]} đã gán cho đơn ${text(orders[keep], iId)} (dòng ${keep + 2}).`);
      }
    });
  });

  // Chỉ ghi ô thay đổi: ghi lại cả cột có thể làm hỏng giá trị khác (VD mã đơn toàn số bị đổi thành số)
  codes.forEach((r, ci) => {
    const oi = owner.get(normalizeCode_(r[0]));
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
      .map((k) => (index.has(k) ? String(codes[index.get(k)][0]).trim() : showCode_(k)))
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

/** Hai lần sửa liền nhau không ghi đè lên nhau. Không lấy được khoá (VD hết 10 giây chờ) thì vẫn chạy. */
function withDocLock_(fn) {
  let lock = null;
  try {
    lock = LockService.getDocumentLock();
    lock.waitLock(10000);
  } catch (err) {
    lock = null;
  }
  try {
    return fn();
  } finally {
    if (lock) lock.releaseLock();
  }
}

/* ---------- Trang quản trị (quan-tri.html): admin xem, sửa Google Sheet ngay trên web ---------- */

const ADMIN_ACCOUNTS_KEY = 'quan-tri:tai-khoan'; // Script Properties: { tên: { salt, hash, ver } }, không lưu mật khẩu
const ADMIN_HASH_ROUNDS = 1000;
const ADMIN_LOG_HEADER = ['Thời gian', 'Tài khoản', 'Việc', 'Trang tính', 'Vị trí', 'Trước', 'Sau'];
const ADMIN_BAD = 'Yêu cầu không hợp lệ. Tải lại trang rồi thử lại.';
const ADMIN_CONFLICT = 'Dòng này vừa thay đổi ở nơi khác (VD vừa sửa trên Google Sheet, có đơn mới hoặc vừa xoá dòng) ' +
  'nên chưa lưu. Đã tải lại dữ liệu mới nhất: kiểm tra rồi làm lại.';

/**
 * Trang tính script tự ghi: dòng 1 là tiêu đề, script tìm cột theo tên nên chỉ đổi trên Sheet. Trang "Mã tải code":
 * mã đã in trên thẻ nên không thêm, xoá dòng trên web; "Mã đơn", "Khách hàng" do script điền. Nhật ký chỉ xem.
 */
const ADMIN_RULES = {
  [ORDER_SHEET]: { header: true },
  [LEAD_SHEET]: { header: true },
  [PRINT_SHEET]: { header: true },
  [CODE_SHEET]: {
    header: true, readOnly: ['Mã', 'Mã đơn', 'Khách hàng'], noAdd: true, noDelete: true,
    tip: 'Tạo mã mới, in thẻ: mở Google Sheet → menu SmartCarTech. Mã đã in trên thẻ không xoá ở đây: muốn ngừng một mã thì tích ô Khoá.',
  },
  [ADMIN_LOG_SHEET]: {
    all: true,
    tip: 'Mọi lần đăng nhập, sửa, thêm, xoá dòng trên trang quản trị. Dòng bị xoá được lưu đủ nội dung ở cột "Trước" để chép lại khi cần.',
  },
};
const ADMIN_ACTIONS = { doc: adminRead_, sua: adminEdit_, them: adminAppend_, xoa: adminDelete_ };

/** Mọi yêu cầu từ trang quản trị. Trừ đăng nhập, việc nào cũng cần mã phiên còn hạn. */
function adminApi_(data) {
  if (data.action === 'dang-nhap') return adminLogin_(data);
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
 * Đúng tên và mật khẩu thì trả mã phiên. Sai quá ADMIN_MAX_FAILS lần trong 15 phút thì tạm khoá tài khoản đó, cả web
 * sai quá 6 lần số đó thì tạm khoá mọi tài khoản: không ai dò được mật khẩu, kể cả khi thử nhiều tên.
 */
function adminLogin_(data) {
  const name = String(data.user == null ? '' : data.user).trim().toLowerCase().slice(0, 40);
  const password = String(data.pass == null ? '' : data.pass).slice(0, 200);
  const accounts = adminAccounts_();
  if (!Object.keys(accounts).length) {
    return { ok: false, error: 'Chưa có tài khoản quản trị. Mở Google Sheet của shop → menu SmartCarTech → "Tài khoản trang quản trị…" để tạo.' };
  }
  if (count_(`qt:sai:${name}`, 900) >= ADMIN_MAX_FAILS || count_('qt:sai', 900) >= ADMIN_MAX_FAILS * 6) {
    return { ok: false, error: 'Đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.' };
  }
  const account = accounts.hasOwnProperty(name) ? accounts[name] : null;
  // Tên không có thật vẫn tính mã băm: thời gian trả lời như nhau, không dò được tên nào có thật
  const hash = passwordHash_(password, account ? account.salt : 'AAAAAAAAAAAAAAAAAAAAAA==');
  if (!account || !sameText_(hash, account.hash)) {
    bump_(`qt:sai:${name}`, 900);
    bump_('qt:sai', 900);
    return { ok: false, error: 'Sai tên đăng nhập hoặc mật khẩu.' };
  }
  const token = randomKey_();
  CacheService.getScriptCache().put(`qt:phien:${token}`, JSON.stringify({ user: name, ver: account.ver, since: Date.now() }), adminIdle_());
  adminLog_(name, 'Đăng nhập', '', '', '', '');
  return { ok: true, token, user: name };
}

/**
 * Phiên còn hạn: tài khoản còn, chưa đổi mật khẩu, chưa quá ADMIN_MAX_HOURS kể từ lúc đăng nhập.
 * Mỗi lần dùng được gia hạn thêm ADMIN_IDLE_HOURS.
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
  if (!account || account.ver !== session.ver || Date.now() - session.since > ADMIN_MAX_HOURS * 3600000) {
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

/** Danh sách trang tính và nội dung trang đang mở (không có tên đó thì mở trang đầu tiên). */
function adminRead_(data, user) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheets = ss.getSheets();
  return {
    ok: true,
    user,
    url: ss.getUrl(),
    log: ADMIN_LOG_SHEET,
    sheets: sheets.map((s) => ({ name: s.getName(), hidden: s.isSheetHidden() })),
    sheet: sheetView_(adminSheet_(data.sheet) || sheets[0]),
  };
}

function adminSheet_(name) {
  return typeof name === 'string' && name ? SpreadsheetApp.getActiveSpreadsheet().getSheetByName(name) : null;
}

function sheetGone_(name) {
  return { ok: false, conflict: true, error: `Không còn trang tính "${String(name).slice(0, 100)}" (có thể vừa đổi tên hoặc xoá trên Google Sheet).` };
}

function adminRules_(sh) {
  const rule = ADMIN_RULES.hasOwnProperty(sh.getName()) ? ADMIN_RULES[sh.getName()] : {};
  const head = rule.readOnly ? header_(sh) : [];
  return {
    all: Boolean(rule.all),
    header: Boolean(rule.header),
    cols: (rule.readOnly || []).map((name) => head.indexOf(name) + 1).filter(Boolean),
    add: !rule.all && !rule.noAdd,
    del: !rule.all && !rule.noDelete,
    tip: rule.tip || '',
  };
}

function editable_(rules, row, col) {
  return !rules.all && !(rules.header && row === 1) && !rules.cols.includes(col);
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
    name: sh.getName(), id: sh.getSheetId(), rows, cols, frozen: sh.getFrozenRows(), rules: adminRules_(sh),
    dec: ctx.dec, images: tryGet_(() => sh.getImages().length) || 0, formulas: false,
    widths: [], kinds: [], merges: [], lists: [], rowNums: [], hashes: [], cells: [],
  };
  if (!rows || !cols) return view;
  const head = Math.min(rows, Math.max(view.frozen, 1));
  const fit = Math.max(head + 1, Math.floor(ADMIN_MAX_CELLS / cols));
  const parts = rows > fit ? [[1, head], [rows - (fit - head) + 1, rows]] : [[1, rows]];
  const kinds = [];
  parts.forEach(([from, to]) => {
    gridRows_(sh.getRange(from, 1, to - from + 1, cols), ctx).forEach((r, i) => {
      view.rowNums.push(from + i);
      view.hashes.push(r.hash);
      view.cells.push(r.cells);
      if (from + i > head) kinds.push(r.kinds);
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
    const changes = [];
    for (const item of items) {
      const col = Number(item && item.col);
      if (!Number.isInteger(col) || col < 1 || col > width) return { ok: false, error: ADMIN_BAD };
      if (!editable_(rules, row, col) || cellKind_(values[col - 1]) === 'o') {
        return { ok: false, error: `Ô ${colName_(col)}${row} chỉ sửa được trên Google Sheet.` };
      }
      const cell = sh.getRange(row, col);
      const kind = cellKind_(values[col - 1]) || columnKind_(sh, col);
      const next = cellInput_(item.value, kind, cell.getNumberFormat(), ctx);
      if (!sameCell_(values[col - 1], formulas[col - 1], next)) changes.push({ cell, col, next, before: formulas[col - 1] || shown[col - 1] });
    }
    changes.forEach((ch) => (ch.next.formula !== undefined ? ch.cell.setFormula(ch.next.formula) : ch.cell.setValue(ch.next.value)));
    const linked = changes.some((ch) => watchesCodes_(sh, ch.col, ch.col)) ? linkCodes_(sh, row, row) || {} : null;
    const fresh = gridRows_(sh.getRange(row, 1, 1, sh.getLastColumn()), ctx)[0];
    changes.forEach((ch) => {
      const cell = fresh.cells[ch.col - 1];
      adminLog_(user, 'Sửa ô', sh.getName(), `${colName_(ch.col)}${row}`, ch.before, cell ? (cell.f ? cell.e : cell.d) || '' : '');
    });
    return {
      ok: true, saved: changes.length, row: { hash: fresh.hash, cells: fresh.cells, lists: ctx.lists },
      reload: Boolean(linked), message: linked && linked.issue ? linked.issue : '',
    };
  });
}

/** Thêm một dòng vào cuối trang tính (ô theo thứ tự cột). Ô tích, ô thả xuống lấy theo dòng cuối hiện có. */
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
    // Định dạng của dòng sắp thêm (VD cả cột để "Văn bản thuần"); dòng cuối của trang thì Sheet tự thêm dòng mới
    const formats = last < sh.getMaxRows() ? sh.getRange(last + 1, 1, 1, width).getNumberFormats()[0] : [];
    const head = rules.header ? header_(sh) : [];
    const row = [];
    const text = [];
    for (let c = 0; c < width; c++) {
      const value = input[c];
      if (value == null || value === '') {
        row.push('');
        continue;
      }
      if (!editable_(rules, last + 1, c + 1)) return { ok: false, error: `Cột ${colName_(c + 1)} chỉ sửa được trên Google Sheet.` };
      const next = cellInput_(value, majorityKind_(old.map((r) => cellKind_(r[c]))), formats[c] || '', ctx);
      row.push(next.formula !== undefined ? next.formula : next.value);
      text.push(`${head[c] || colName_(c + 1)}: ${typeof value === 'boolean' ? (value ? 'đã tích' : 'chưa tích') : value}`);
    }
    while (row.length && row[row.length - 1] === '') row.pop();
    if (!text.length) return { ok: false, error: 'Dòng mới còn trống: điền ít nhất một ô.' };
    sh.appendRow(row);
    const added = sh.getLastRow();
    if (last > skip) {
      const checks = tryGet_(() => sh.getRange(last, 1, 1, width).getDataValidations());
      if (checks && checks[0].some(Boolean)) sh.getRange(added, 1, 1, width).setDataValidations(checks);
    }
    if (watchesCodes_(sh, 1, width)) linkCodes_(sh, added, added);
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
    sh.appendRow([new Date()].concat([user, action, sheet, where, before, after].map((v) => safe_(v, 45000))));
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

/** Menu "Tài khoản trang quản trị…": tạo tài khoản, đổi mật khẩu, xoá tài khoản đăng nhập quan-tri.html. */
function showAdminAccounts() {
  const json = JSON.stringify({ page: `${SITE_URL}/quan-tri.html`, min: ADMIN_MIN_PASSWORD }).replace(/</g, '\\u003c');
  const page = HtmlService.createHtmlOutput(ADMIN_ACCOUNTS_HTML.replace('__DATA__', () => json)).setWidth(460).setHeight(620);
  SpreadsheetApp.getUi().showModalDialog(page, 'Tài khoản trang quản trị');
}

/** Cửa sổ tài khoản gọi: tên các tài khoản (không có mật khẩu). */
function listAdminAccounts() {
  return Object.keys(adminAccounts_()).sort();
}

/** Tạo tài khoản, hoặc đổi mật khẩu nếu tên đã có: mọi nơi đang đăng nhập bằng tài khoản đó bị đăng xuất. */
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
    const accounts = adminAccounts_();
    const changed = accounts.hasOwnProperty(user);
    const salt = Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid()).slice(0, 16));
    accounts[user] = { salt, hash: passwordHash_(pass, salt), ver: randomKey_().slice(0, 12) };
    PropertiesService.getScriptProperties().setProperty(ADMIN_ACCOUNTS_KEY, JSON.stringify(accounts));
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
      PropertiesService.getScriptProperties().setProperty(ADMIN_ACCOUNTS_KEY, JSON.stringify(accounts));
      adminLog_('Google Sheet', 'Xoá tài khoản', '', user, '', '');
    }
  } finally {
    lock.releaseLock();
  }
  return listAdminAccounts();
}

/* ---------- Gộp trang "Customer Infor" (nhập từ file kế hoạch Excel) vào "Đơn hàng" ---------- */

const CUSTOMER_SHEET = 'Customer Infor';
const CUSTOMER_PROFIT_COL = 'Lợi nhuận';
// [cột ở "Customer Infor", cột cùng ý nghĩa ở "Đơn hàng"]. "Đơn hàng" chưa có cột đó thì thêm vào cuối
const CUSTOMER_COLS = [
  ['Thứ tự', 'Thứ tự'], ['Ngày', 'Thời gian'], ['Nền tảng', ORDER_PLATFORM_COL], ['Tên', 'Họ tên'], ['Email', 'Email'],
  ['Số ĐT', 'SĐT'], ['Địa Chỉ', 'Địa chỉ'], ['Sản Phẩm', 'Sản phẩm'], ['Tổng tiền sản phẩm', 'Tổng (₫)'],
  ['Tiền thu người nhận', 'Tiền thu người nhận'], ['Doanh thu sau điều chỉnh', 'Doanh thu sau điều chỉnh'],
  ['Chi phí', 'Chi phí'], [CUSTOMER_PROFIT_COL, CUSTOMER_PROFIT_COL], ['Note', 'Ghi chú'],
];
const CUSTOMER_MONEY_COLS = ['Tiền thu người nhận', 'Doanh thu sau điều chỉnh', 'Chi phí', CUSTOMER_PROFIT_COL];

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
    `^=\\s*${colName_(col('Doanh thu sau điều chỉnh') + 1)}${row}\\s*-\\s*${colName_(col('Chi phí') + 1)}${row}\\s*$`, 'i').test(formula);
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
    if (cols.every(([, to]) => to === 'Thứ tự' || to === CUSTOMER_PROFIT_COL || cells[to] === '')) {
      skipped++;
      return;
    }
    const time = timeOf_(cells['Thời gian'], tz);
    if (time) cells['Thời gian'] = time;
    // Số bị Excel làm mất số 0 ở đầu, hoặc có "(+84)" → dạng SĐT của các đơn khác
    const digits = String(cells['SĐT']).replace(/\D/g, '');
    cells['SĐT'] = /^(0|84)?[35789]\d{8}$/.test(digits) ? `0${digits.slice(-9)}` : String(cells['SĐT']);
    // Lợi nhuận = Doanh thu − Chi phí của chính dòng đó: giữ là công thức, theo cột mới ở "Đơn hàng"
    const formula = own(formulas[i + 1][col(CUSTOMER_PROFIT_COL)], i + 2);
    if (formula) cells[CUSTOMER_PROFIT_COL] = '';
    rows.push({ from: i + 2, cells, time, formula });
  });
  return { rows, skipped, cols };
}

/** Dòng này đã gộp từ lần chạy trước: mọi cột gộp đều giống hệt. Nhờ vậy chạy lại không thêm dòng, kể cả dòng thiếu ngày, tên, địa chỉ. */
function customerSame_(rec, cols, row, head, tz) {
  return cols.every(([, to]) => {
    if (to === CUSTOMER_PROFIT_COL && rec.formula) return true;
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
  const profit = head.indexOf(CUSTOMER_PROFIT_COL);
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
  const setProfit = (row) => os.getRange(row, col(CUSTOMER_PROFIT_COL))
    .setFormula(`=${colName_(col('Doanh thu sau điều chỉnh'))}${row}-${colName_(col('Chi phí'))}${row}`);
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

/* ---------- Dùng chung ---------- */

/** Số thứ tự cột theo tên tiêu đề ở dòng 1 (0 = chưa có). create = true: chưa có thì thêm cột vào cuối. */
function colOf_(sh, name, create) {
  const head = header_(sh);
  const col = head.indexOf(name) + 1;
  if (col || !create) return col;
  sh.getRange(1, head.length + 1).setValue(name);
  return head.length + 1;
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
 * Thêm 1 dòng theo tên cột ở dòng 1 (shop đổi thứ tự cột vẫn ghi đúng chỗ); cột chưa có thì thêm vào cuối.
 * Chữ được ghi qua safe_(). Không ghi vào các cột trống ở cuối dòng (VD cột "Mã tải code" shop tự điền).
 */
function appendRow_(sh, values) {
  const head = header_(sh);
  Object.keys(values).forEach((name) => {
    if (head.includes(name)) return;
    head.push(name);
    sh.getRange(1, head.length).setValue(name);
  });
  const row = head.map((name) => {
    const v = values.hasOwnProperty(name) ? values[name] : '';
    return typeof v === 'string' ? safe_(v) : v;
  });
  while (row.length && row[row.length - 1] === '') row.pop();
  sh.appendRow(row);
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
   dưới không có dấu backtick, "${" hay dấu gạch ngược. Mật khẩu chỉ gửi thẳng tới saveAdminAccount, không lưu ở đâu khác. */
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
.list li { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 42px; padding: 6px 12px; border-top: 1px solid #E6EAED; }
.list li:first-child { border-top: 0; }
.list .empty { color: #5B6B78; }
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
</style>
</head>
<body>
<p class="help">Đăng nhập trang quản trị tại <b id="page"></b>. Mật khẩu chỉ lưu dạng mã hoá trong script của Google Sheet này: không ai xem lại được, quên thì đặt mật khẩu mới ở đây.</p>

<h2>Tài khoản hiện có</h2>
<ul class="list" id="list"><li class="empty">Đang tải…</li></ul>

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

<script type="application/json" id="data">__DATA__</script>
<script>
(function () {
  var data = JSON.parse(document.getElementById('data').textContent);
  var NAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;

  function el(id) { return document.getElementById(id); }
  function setStatus(text, isError) {
    el('status').textContent = text;
    el('status').className = 'status' + (isError ? ' is-error' : '');
  }

  function render(names) {
    var list = el('list');
    list.textContent = '';
    if (!names.length) {
      var empty = document.createElement('li');
      empty.className = 'empty';
      empty.textContent = 'Chưa có tài khoản nào: tạo tài khoản đầu tiên ở dưới.';
      list.appendChild(empty);
      return;
    }
    names.forEach(function (name) {
      var li = document.createElement('li');
      var b = document.createElement('b');
      b.textContent = name;
      var del = document.createElement('button');
      del.type = 'button';
      del.className = 'link danger';
      del.textContent = 'Xoá';
      del.addEventListener('click', function () {
        // Bấm 2 lần mới xoá, tránh lỡ tay
        if (del.dataset.armed !== '1') {
          del.dataset.armed = '1';
          del.textContent = 'Bấm lần nữa để xoá';
          setTimeout(function () { del.dataset.armed = ''; del.textContent = 'Xoá'; }, 4000);
          return;
        }
        run('removeAdminAccount', [name], 'Đã xoá tài khoản ' + name + '.');
      });
      li.appendChild(b);
      li.appendChild(del);
      list.appendChild(li);
    });
  }

  function run(fn, args, done, after) {
    el('save').disabled = true;
    setStatus('Đang lưu…');
    var call = google.script.run
      .withSuccessHandler(function (names) {
        el('save').disabled = false;
        render(names);
        setStatus(done);
        if (after) after();
      })
      .withFailureHandler(function (err) {
        el('save').disabled = false;
        setStatus(err.message, true);
      });
    call[fn].apply(call, args);
  }

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
