/**
 * SmartCarTech — Google Apps Script cho website. Hướng dẫn cài từng bước: README.md, mục 5.
 *
 * Script này làm 2 việc:
 * 1. Lưu đơn hàng & yêu cầu tư vấn từ web vào Google Sheet: mỗi đơn là 1 dòng ở trang tính
 *    "Đơn hàng", mỗi yêu cầu tư vấn ở trang tính "Tư vấn". Web chờ script trả về "ok" (đã lưu) mới
 *    báo khách "Đã gửi" — khách không nhắn Zalo nữa, nên điền NOTIFY_EMAIL để biết khi có đơn mới.
 *    Ai cũng gửi thẳng được tới script, nên script không tin số liệu gửi lên: tên sản phẩm và tổng tiền
 *    tính lại theo products.json trên website (tổng web gửi khác giá đúng thì ghi ở cột "Kiểm tra"),
 *    dữ liệu sai dạng bị bỏ, gửi dồn dập (VD bị spam) bị chặn tạm thời — khách vẫn có nút gửi qua Zalo.
 * 2. Chỉ người mua mới tải được code mẫu: khách nhập mã in trên thẻ trong hộp, script tìm mã ở
 *    trang tính "Mã tải code", đúng thì mới gửi file .zip từ thư mục Google Drive riêng tư.
 *    Tạo mã mới: menu "SmartCarTech" → "Tạo mã tải code…" ngay trên Google Sheet.
 *    In thẻ bỏ vào hộp: bôi chọn các mã → menu "SmartCarTech" → "In thẻ cho các mã đang chọn…".
 *    Biết khách nào nhận mã nào: gõ mã của thẻ vào cột "Mã tải code" của đơn ở trang "Đơn hàng",
 *    script tự điền "Mã đơn" và "Khách hàng" ở trang "Mã tải code".
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

const NOTIFY_EMAIL = '';   // VD: 'shop@gmail.com' — nên điền: nhận email mỗi khi có đơn hàng / yêu cầu tư vấn mới
const CODE_FOLDER_ID = ''; // ID thư mục Google Drive chứa các file .zip code mẫu (giữ chế độ "Bị hạn chế")
const MAX_DOWNLOADS = 20;  // Mỗi mã tải được tối đa bao nhiêu lượt (tính chung mọi file)
const MAX_SENDS_PER_10_MIN = 30; // Đơn + yêu cầu tư vấn mỗi 10 phút. Quá mức (VD bị spam), web báo khách "chưa gửi được" và mời nhắn Zalo
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
const ORDER_HEADER = ['Thời gian', 'Mã đơn', 'Họ tên', 'SĐT', 'Địa chỉ', 'Sản phẩm', 'Tổng (₫)', ORDER_CHECK_COL, 'Ghi chú', ORDER_KEY_COL];
const PHONE_RE = /^(0|\+?84)(3|5|7|8|9)\d{8}$/; // Giống assets/js/core.js

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

  // Web chỉ báo khách "Đã gửi" khi nhận "ok"; câu trả lời khác thì web mời khách gửi lại hoặc gửi qua Zalo
  let result = 'invalid';
  try {
    if (data && data.type === 'don-hang') result = saveOrder_(data);
    if (data && data.type === 'tu-van') result = saveLead_(data);
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

  const sh = getSheet_(SpreadsheetApp.getActiveSpreadsheet(), 'Tư vấn', ['Thời gian', 'Họ tên', 'SĐT', 'Nội dung']);
  sh.appendRow([new Date(), safe_(name), safe_(phone), safe_(message)]);
  notify_(`Yêu cầu tư vấn – ${name}`, `${name} – ${phone}\n\n${message}`);
  return 'ok';
}

/**
 * Bảng giá theo products.json trên website, lưu tạm 10 phút: "pro:day-du" và "SC Tech Pro|Bộ đầy đủ linh kiện"
 * cùng trỏ tới { line, kit, price } của bộ đó.
 */
function catalog_() {
  const cache = CacheService.getScriptCache();
  let text = cache.get('products');
  const fresh = !text;
  if (fresh) {
    const res = UrlFetchApp.fetch(`${SITE_URL}/products.json`, { muteHttpExceptions: true });
    if (res.getResponseCode() !== 200) throw new Error(`HTTP ${res.getResponseCode()}`);
    text = res.getContentText('UTF-8');
  }
  const kits = new Map();
  JSON.parse(text).lines.forEach((l) => l.kits.forEach((k) => {
    const kit = { line: l.name, kit: k.name, price: Number(k.price) || 0 };
    kits.set(`${l.id}:${k.id}`, kit);
    kits.set(`${l.name}|${k.name}`, kit); // trang web bản cũ chưa gửi line_id, kit_id: chỉ có tên dòng, tên bộ
  }));
  if (fresh) {
    try {
      cache.put('products', text, 600);
    } catch (err) {
      console.warn(err); // file lớn hơn 100 KB thì không lưu tạm được: lần sau đọc lại
    }
  }
  return kits;
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
  SpreadsheetApp.getUi()
    .createMenu('SmartCarTech')
    .addItem('Tạo mã tải code…', 'createCodes')
    .addItem('In thẻ cho các mã đang chọn…', 'printCards')
    .addSeparator()
    .addItem('Kiểm tra cài đặt…', 'checkSetup')
    .addToUi();
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
    lines.push(`✓ Đọc được bảng giá ${SITE_URL}/products.json: ${new Set(catalog_().values()).size} bộ.`);
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
  if (sh.getName() !== ORDER_SHEET || e.range.getLastRow() < 2) return;
  const head = header_(sh);
  if (!head.includes(ORDER_KEY_COL)) return;
  const watched = ['Mã đơn', 'Họ tên', 'SĐT', ORDER_KEY_COL].map((name) => head.indexOf(name) + 1);
  if (!watched.some((c) => c >= e.range.getColumn() && c <= e.range.getLastColumn())) return;
  withDocLock_(() => linkCodes_(sh, e.range.getRow(), e.range.getLastRow()));
}

/**
 * Đối chiếu mọi đơn với trang "Mã tải code": điền "Mã đơn", "Khách hàng" cho mã đã gán, xoá ở mã mà đơn
 * không còn ghi. Ô có mã sai được tô đỏ, rê chuột vào ô để xem lý do. Dòng from–to (vừa sửa) được viết lại
 * mã cho đúng dạng (VD "k7m3 q9xp" → "K7M3-Q9XP").
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
  if (issue) ss.toast(issue, 'Chưa gán được mã', 8);
  else if (edited.some((i) => parsed[i].keys.length)) ss.toast(`Đã ghi Mã đơn, Khách hàng ở trang "${CODE_SHEET}".`, 'Đã gán mã', 4);
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
function safe_(value) {
  const s = String(value == null ? '' : value).slice(0, 2000);
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
    body = `Trong giờ này đã có hơn ${MAX_EMAILS_PER_HOUR} đơn hàng / yêu cầu tư vấn mới, có thể web đang bị spam. ` +
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
