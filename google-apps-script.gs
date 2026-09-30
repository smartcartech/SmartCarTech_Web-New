/**
 * SmartCarTech — Google Apps Script cho website. Hướng dẫn cài từng bước: README.md, mục 5.
 *
 * Script này làm 2 việc:
 * 1. Lưu đơn hàng & yêu cầu tư vấn từ web vào Google Sheet: mỗi đơn là 1 dòng ở trang tính
 *    "Đơn hàng", mỗi yêu cầu tư vấn ở trang tính "Tư vấn". Khách vẫn gửi đơn qua Zalo như bình
 *    thường — Sheet là bản lưu dự phòng để shop không bỏ sót đơn.
 * 2. Chỉ người mua mới tải được code mẫu: khách nhập mã in trên thẻ trong hộp, script tìm mã ở
 *    trang tính "Mã tải code", đúng thì mới gửi file .zip từ thư mục Google Drive riêng tư.
 *    Tạo mã mới: menu "SmartCarTech" → "Tạo mã tải code…" ngay trên Google Sheet.
 *
 * Cách cài tóm tắt:
 * 1. Tạo 1 Google Sheet mới → Tiện ích mở rộng (Extensions) → Apps Script.
 * 2. Xóa code mẫu, dán toàn bộ file này vào, điền 2 dòng cấu hình bên dưới, bấm Lưu.
 * 3. Triển khai (Deploy) → Tùy chọn triển khai mới → loại "Ứng dụng web" (Web app):
 *    Thực thi dưới dạng: Tôi (Me) · Người có quyền truy cập: Bất kỳ ai (Anyone).
 * 4. Cấp quyền, copy "URL ứng dụng web" (https://script.google.com/macros/s/.../exec)
 *    rồi dán vào products.json → "site" → "order_endpoint".
 *
 * Chỉ điền email và ID thư mục trong trình soạn Apps Script. Đừng sửa file này trong kho GitHub:
 * kho đang để công khai, ai cũng đọc được.
 */

const NOTIFY_EMAIL = '';   // VD: 'shop@gmail.com' — nhận email khi có đơn mới; để trống nếu không cần
const CODE_FOLDER_ID = ''; // ID thư mục Google Drive chứa các file .zip code mẫu (giữ chế độ "Bị hạn chế")
const MAX_DOWNLOADS = 20;  // Mỗi mã tải được tối đa bao nhiêu lượt (tính chung mọi file)

const CODE_SHEET = 'Mã tải code';
const CODE_HEADER = ['Mã', 'Ghi chú', 'Khoá', 'Số lần tải', 'Tải lần đầu', 'Tải gần nhất', 'File tải gần nhất'];
// Không có 0/O, 1/I/L để khách đọc và gõ không nhầm
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/** Mở URL ứng dụng web trên trình duyệt để kiểm tra script đã chạy. */
function doGet() {
  return ContentService.createTextOutput('SmartCarTech: Apps Script đang chạy.');
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);

  if (data.type === 'tai-code') {
    try {
      return json_(downloadCode_(data));
    } catch (err) {
      console.error(err);
      return json_({ ok: false, error: 'Chưa tải được code. Vui lòng thử lại sau ít phút hoặc nhắn Zalo cho shop.' });
    }
  }

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (data.type === 'don-hang') {
    const sh = getSheet_(ss, 'Đơn hàng', ['Thời gian', 'Mã đơn', 'Họ tên', 'SĐT', 'Địa chỉ', 'Sản phẩm', 'Tổng (₫)', 'Ghi chú']);
    const items = (data.items || []).map((i) => `${i.line} – ${i.kit} × ${i.qty}`).join('\n');
    sh.appendRow([new Date(), safe_(data.code), safe_(data.name), safe_(data.phone), safe_(data.address), safe_(items), Number(data.total) || 0, safe_(data.note)]);
    notify_(`Đơn mới #${data.code} – ${data.name}`, `${data.name} – ${data.phone}\n${data.address}\n\n${items}\n\nTổng: ${data.total} ₫\nGhi chú: ${data.note || ''}`);
  } else {
    const sh = getSheet_(ss, 'Tư vấn', ['Thời gian', 'Họ tên', 'SĐT', 'Nội dung']);
    sh.appendRow([new Date(), safe_(data.name), safe_(data.phone), safe_(data.message)]);
    notify_(`Yêu cầu tư vấn – ${data.name}`, `${data.name} – ${data.phone}\n\n${data.message || ''}`);
  }
  return ContentService.createTextOutput('ok');
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

/** Thêm menu "SmartCarTech" khi mở Google Sheet. */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('SmartCarTech')
    .addItem('Tạo mã tải code…', 'createCodes')
    .addToUi();
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
    rows.push([code, note, false, 0, '', '', '']);
  }
  const start = sh.getLastRow() + 1;
  sh.getRange(start, 1, count, 1).setNumberFormat('@'); // giữ mã ở dạng chữ, VD "2345-6789" không bị đổi thành số
  sh.getRange(start, 1, count, CODE_HEADER.length).setValues(rows);
  sh.getRange(start, 3, count, 1).insertCheckboxes();
  sh.activate();
  sh.setActiveRange(sh.getRange(start, 1, count, 1));
  ui.alert(`Đã tạo ${count} mã mới (dòng ${start}–${start + count - 1}). Các mã này đang được chọn sẵn để in hoặc sao chép.`);
}

/* ---------- Dùng chung ---------- */

function getSheet_(ss, name, header) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(header);
    sh.setFrozenRows(1);
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/** Ghi dữ liệu khách nhập dưới dạng chữ, tránh bị hiểu thành công thức (=, +, -, @) và giữ số 0 đầu SĐT. */
function safe_(value) {
  const s = String(value == null ? '' : value).slice(0, 2000);
  return /^[=+\-@0-9]/.test(s) ? "'" + s : s;
}

function notify_(subject, body) {
  if (NOTIFY_EMAIL) MailApp.sendEmail(NOTIFY_EMAIL, subject, body);
}
