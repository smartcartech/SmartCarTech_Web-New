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
 *    In thẻ bỏ vào hộp: bôi chọn các mã → menu "SmartCarTech" → "In thẻ cho các mã đang chọn…".
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
const PRINTED_COL = 'Đã in';
const CODE_HEADER = ['Mã', 'Ghi chú', 'Khoá', 'Số lần tải', 'Tải lần đầu', 'Tải gần nhất', 'File tải gần nhất', PRINTED_COL];
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
    .addItem('In thẻ cho các mã đang chọn…', 'printCards')
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
    rows.push([code, note, false, 0, '', '', '', '']);
  }
  const start = sh.getLastRow() + 1;
  sh.getRange(start, 1, count, 1).setNumberFormat('@'); // giữ mã ở dạng chữ, VD "2345-6789" không bị đổi thành số
  sh.getRange(start, 1, count, CODE_HEADER.length).setValues(rows);
  sh.getRange(start, 3, count, 1).insertCheckboxes();
  sh.activate();
  sh.setActiveRange(sh.getRange(start, 1, count, 1));
  ui.alert(`Đã tạo ${count} mã mới (dòng ${start}–${start + count - 1}). Các mã này đang được chọn sẵn: vào menu SmartCarTech → In thẻ cho các mã đang chọn… để in.`);
}

/* ---------- In thẻ mã: 10 thẻ cỡ danh thiếp (85 × 54 mm) trên 1 tờ A4 ---------- */

const SITE_URL = 'https://smartcartech.vn'; // Địa chỉ in trên thẻ và trong mã QR
// Logo lấy từ bản web trên GitHub Pages; khi chuyển tên miền, link này tự chuyển về smartcartech.vn
const LOGO_URL = 'https://smartcartech.github.io/SmartCarTech_Web-New/assets/img/logo-smartcartech.png';
const SHOP_ZALO = '0374 489 282';

/** Mở cửa sổ xem trước & in thẻ cho các mã đang bôi chọn. Bỏ qua mã đã khoá hoặc đã có lượt tải. */
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

  const col = printedCol_(sh, false);
  const values = last > 1 ? sh.getRange(1, 1, last, sh.getLastColumn()).getValues() : [];
  const tz = ss.getSpreadsheetTimeZone();
  const data = { site: SITE_URL, logo: LOGO_URL, zalo: SHOP_ZALO, cards: [], locked: 0, used: 0 };
  [...rowNums].sort((a, b) => a - b).forEach((n) => {
    const row = values[n - 1];
    const code = String(row[0]).trim();
    if (!normalizeCode_(code)) return;
    if (isLocked_(row[2])) data.locked++;
    else if (Number(row[3]) > 0) data.used++;
    else data.cards.push({ code, printed: col ? printedText_(row[col - 1], tz) : '' });
  });

  if (!data.cards.length) {
    const skipped = [data.locked && `${data.locked} mã đã khoá`, data.used && `${data.used} mã đã có lượt tải`].filter(Boolean);
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
    const col = printedCol_(sh, true);
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

/** Vị trí cột "Đã in" (0 = chưa có). Trang tính tạo bằng bản script cũ chưa có cột này: create = true sẽ thêm vào cuối. */
function printedCol_(sh, create) {
  const width = sh.getLastColumn();
  const col = width ? sh.getRange(1, 1, 1, width).getValues()[0].indexOf(PRINTED_COL) + 1 : 0;
  if (col || !create) return col;
  sh.getRange(1, width + 1).setValue(PRINTED_COL);
  return width + 1;
}

function printedText_(value, tz) {
  if (value instanceof Date) return Utilities.formatDate(value, tz, 'dd/MM/yyyy');
  return String(value == null ? '' : value).trim();
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

/* ---------- Giao diện cửa sổ in thẻ (printCards) ----------
   __DATA__ được thay bằng danh sách mã. Mã QR mở huong-dan.html?ma=<mã>: trang Hướng dẫn tự điền mã.
   Giữ phần dưới không có dấu backtick, "${" hay dấu gạch ngược vì cả khối là một chuỗi template. */
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
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js"></script>
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
  if (notes.length) {
    el('notes').hidden = false;
    el('notes').textContent = 'Bỏ qua ' + notes.join(' và ') + ' (không in các mã này).';
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
