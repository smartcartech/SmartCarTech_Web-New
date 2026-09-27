/**
 * SmartCarTech — lưu đơn hàng & yêu cầu tư vấn vào Google Sheet (TÙY CHỌN).
 *
 * Cách cài (5 phút):
 * 1. Tạo 1 Google Sheet mới → menu Tiện ích mở rộng (Extensions) → Apps Script.
 * 2. Xóa code mẫu, dán toàn bộ file này vào, bấm Lưu.
 * 3. (Tùy chọn) Điền email của bạn vào NOTIFY_EMAIL để nhận email mỗi khi có đơn.
 * 4. Bấm Triển khai (Deploy) → Tùy chọn triển khai mới (New deployment) → loại "Ứng dụng web" (Web app)
 *    - Thực thi dưới dạng (Execute as): Tôi (Me)
 *    - Người có quyền truy cập (Who has access): Bất kỳ ai (Anyone)
 * 5. Cấp quyền, copy "URL ứng dụng web" (dạng https://script.google.com/macros/s/.../exec)
 *    rồi dán vào products.json → "site" → "order_endpoint".
 *
 * Mỗi đơn hàng sẽ thành 1 dòng ở trang tính "Đơn hàng", mỗi yêu cầu tư vấn ở trang tính "Tư vấn".
 * Khách vẫn gửi đơn qua Zalo như bình thường — Sheet là bản lưu dự phòng để shop không bỏ sót đơn.
 */

const NOTIFY_EMAIL = ''; // VD: 'shop@gmail.com' — để trống nếu không cần email

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
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

function getSheet_(ss, name, header) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(header);
  return sh;
}

/** Ghi dữ liệu khách nhập dưới dạng chữ, tránh bị hiểu thành công thức (=, +, -, @) và giữ số 0 đầu SĐT. */
function safe_(value) {
  const s = String(value == null ? '' : value).slice(0, 2000);
  return /^[=+\-@0-9]/.test(s) ? "'" + s : s;
}

function notify_(subject, body) {
  if (NOTIFY_EMAIL) MailApp.sendEmail(NOTIFY_EMAIL, subject, body);
}
