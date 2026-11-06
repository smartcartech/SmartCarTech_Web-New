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
// Tiền của đơn ở trang Đơn hàng (gộp từ Customer Infor) và In 3D, theo thứ tự cột. Đơn web: script ghi Tiền thu người nhận bằng
// tổng tiền đơn (sửa được), Doanh thu sau điều chỉnh tự tính bằng Tiền thu người nhận trừ Phí ship (đơn web). Đơn Shopee, Tiktok:
// shop tự điền Doanh thu. Đủ Doanh thu và Chi phí thì Lợi nhuận tự tính (syncProfit_)
const ORDER_RECEIVED_COL = 'Tiền thu người nhận';
const ORDER_SHIP_COL = 'Phí ship (đơn web)'; // Chỉ đơn web. Admin nhập; cho manager, seller nhập thì tích ở mục Tài khoản
const ORDER_REVENUE_COL = 'Doanh thu sau điều chỉnh';
const ORDER_COST_COL = 'Chi phí';
const ORDER_PROFIT_COL = 'Lợi nhuận';
const MONEY_COLS = [ORDER_RECEIVED_COL, ORDER_SHIP_COL, ORDER_REVENUE_COL, ORDER_COST_COL, ORDER_PROFIT_COL];
// Lợi nhuận trừ Hoa hồng (₫) (seller hay manager: mỗi đơn chỉ một người nhận), tự tính cùng Lợi nhuận. Tên có chữ "hoa hồng" nên
// manager không thấy: thấy cả 2 cột lợi nhuận thì trừ ra được hoa hồng
const ORDER_NET_COL = 'Lợi nhuận sau hoa hồng';
const ORDER_STATUS_COL = 'Trạng thái'; // Đơn web mới ghi "Mới", shop chọn tiếp ở ô thả xuống; seller theo dõi đơn của mình ở đây
const ORDER_STATUSES = ['Mới', 'Đã xác nhận', 'Đang giao', 'Đã giao', 'Huỷ'];
// Hoa hồng: đơn có seller (seller lên trên trang Đặt hàng, In 3D, hay admin ghi) thì seller nhận, % theo sản phẩm ở trang
// COMMISSION_SHEET; đơn ở trang Đơn hàng không có seller, từ ngày admin bật % cho manager, thì manager nhận. Hoa hồng (₫) =
// % hoa hồng × Doanh thu sau điều chỉnh, tự tính khi đơn có doanh thu. Admin tích "Đã trả hoa hồng" khi đã trả
const SELLER_COL = 'Seller';
const COMMISSION_COL = 'Hoa hồng (₫)';
const COMMISSION_PAID_COL = 'Đã trả hoa hồng';
const SELLER_COLS = [SELLER_COL, COMMISSION_COL, COMMISSION_PAID_COL];
const COMMISSION_PCT_COL = '% hoa hồng'; // % của đơn, ghi 1 lần khi biết người nhận; đổi % ở trang mức hay ở manager không đổi đơn cũ
const MANAGER_COL = 'Manager';           // Manager nhận hoa hồng của đơn (chỉ trang Đơn hàng)
const COMMISSION_SHEET = 'Hoa hồng seller'; // Script tạo, mỗi sản phẩm trên web một dòng; admin điền %. Chỉ admin xem được
const COMMISSION_HEADER = ['Mã', 'Sản phẩm', 'Giá bán (₫)', '% hoa hồng seller'];
const COMMISSION_OLD_RATE = 'Hoa hồng mỗi sản phẩm (₫)'; // Tên cột mức ở bản trước (số tiền): script đổi tên thành cột %
// Cột "Mã" ở trang đó: bộ xe là "dòng:bộ" như products.json (VD "pro:day-du"); bảng tên thêm id kiểu bảng (1-tang, 2-tang)
const COMMISSION_PLATE = 'in-3d:bang-ten:';
const COMMISSION_STAND = 'in-3d:gia-do';
const ORDER_HEADER = ['Thời gian', 'Mã đơn', 'Họ tên', 'SĐT', 'Địa chỉ', 'Sản phẩm', 'Tổng (₫)', ORDER_CHECK_COL, 'Ghi chú', ORDER_KEY_COL,
  ORDER_STATUS_COL, ...SELLER_COLS];
const PHONE_RE = /^(0|\+?84)(3|5|7|8|9)\d{8}$/; // Giống assets/js/core.js

const PRINT_SHEET = 'In 3D';
const PRINT_STATUS_COL = 'Trạng thái'; // Shop chọn ở ô thả xuống; đơn, yêu cầu mới ghi "Mới"
const PRINT_STATUSES = ['Mới', 'Đã liên hệ', 'Đã chốt', 'Đang in', 'Đã giao', 'Huỷ'];
const PRINT_HEADER = ['Thời gian', 'Mã', 'Loại', 'Họ tên', 'SĐT', 'Địa chỉ', 'Nội dung', 'Số lượng', 'Tạm tính (₫)', ORDER_CHECK_COL, 'Ghi chú', PRINT_STATUS_COL,
  ...SELLER_COLS, ...MONEY_COLS, ORDER_NET_COL, COMMISSION_PCT_COL];
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
  const sold = []; // { key, qty } của từng bộ: tính hoa hồng khi seller lên đơn
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
    sold.push({ key: kit.key || `${item.line_id}:${item.kit_id}`, qty });
    total += kit.price * qty;
  }
  const sentTotal = Number(data.total) || 0;
  if (kits && sentTotal !== total) {
    checks.push(`Web gửi tổng ${money_(sentTotal)} ₫, giá đúng ${money_(total)} ₫: báo lại giá cho khách khi gọi xác nhận.`);
  }
  const seller = orderSeller_(data);
  if (seller.error) return seller.error;
  if (overLimit_(phone)) return 'busy';

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = getSheet_(ss, ORDER_SHEET, ORDER_HEADER);
  const pct = seller.name ? commissionOf_(ss, sold) : '';
  // Ghi dòng và ô thả xuống, ô tích trong cùng một khoá: đơn khác chèn lên trên giữa chừng thì vẫn vào đúng dòng
  withDocLock_(() => {
    const added = addRow_(sh, Object.assign({
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
      [ORDER_STATUS_COL]: ORDER_STATUSES[0],
    }, receivedCell_(sh, total), sellerCells_(seller.name, pct)));
    orderCells_(sh, added, ORDER_STATUSES, Boolean(seller.name));
    syncProfit_(sh, added, added); // đơn không có seller: manager nhận hoa hồng (nếu admin đã bật)
  });
  notify_(`Đơn mới #${code} – ${name}`, [
    `${name} – ${phone}`, address, '', ...products, '',
    `Tổng: ${money_(total)} ₫`, `Ghi chú: ${note}`, ...sellerLines_(seller.name, pct),
    ...(checks.length ? ['', `Cần kiểm tra: ${checks.join(' ')}`] : []),
  ].join('\n'));
  return 'ok';
}

/** Đơn web: Tiền thu người nhận ghi bằng tổng tiền đơn (shop sửa khi khác), nếu trang đã có cột đó (gộp từ Customer Infor). */
function receivedCell_(sh, total) {
  return colOf_(sh, ORDER_RECEIVED_COL) && Number(total) > 0 ? { [ORDER_RECEIVED_COL]: Number(total) } : {};
}

/**
 * Đơn do seller lên: trang đặt hàng gửi kèm mã phiên trang quản trị của seller (`data.seller`). Trả { name } (rỗng: đơn
 * khách tự đặt) hoặc { error } là câu trả lời cho web: "seller-login" phiên đã hết hạn, "seller-off" admin chưa cho
 * seller này lên đơn. Không ghi đơn trong 2 trường hợp đó, để seller đăng nhập lại rồi gửi lại, không mất hoa hồng.
 * Mã phiên của admin, manager: đơn thường.
 */
function orderSeller_(data) {
  if (data.seller == null || data.seller === '') return { name: '' };
  const session = adminSession_(data.seller);
  if (!session) return { error: 'seller-login' };
  if (session.role !== 'seller') return { name: '' };
  if (!adminPerms_(session.user).order) return { error: 'seller-off' };
  return { name: session.user };
}

/**
 * Các ô của seller ở dòng đơn: tên, % hoa hồng (rỗng: sản phẩm chưa có %), chưa trả. Hoa hồng (₫) để trống: tự tính bằng %
 * × Doanh thu sau điều chỉnh khi đơn có doanh thu (syncProfit_). Đơn không có seller: không ghi gì.
 */
function sellerCells_(name, pct) {
  return name ? { [SELLER_COL]: name, [COMMISSION_PCT_COL]: pct, [COMMISSION_COL]: '', [COMMISSION_PAID_COL]: false } : {};
}

/** "10%", "10,18%": % hoa hồng viết cho người đọc. */
function pctText_(pct) {
  return `${String(Math.round(pct * 10000) / 100).replace('.', ',')}%`;
}

/** Dòng trong email báo đơn mới: seller nào lên, % hoa hồng. Email chỉ gửi tới shop (NOTIFY_EMAIL). */
function sellerLines_(name, pct) {
  if (!name) return [];
  const rate = pct === '' ? `chưa có % hoa hồng (điền ở trang "${COMMISSION_SHEET}" rồi ghi vào đơn)`
    : `hoa hồng ${pctText_(pct)} ${ORDER_REVENUE_COL} (tự tính khi đơn có doanh thu)`;
  return ['', `Seller lên đơn: ${name}, ${rate}`];
}

/** Ô "Đã trả hoa hồng" thành ô tích (đơn có người nhận hoa hồng); ô đang trống thì ghi "chưa tích". */
function paidBox_(sh, row, col) {
  const cell = sh.getRange(row, col);
  cell.setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox().build());
  if (cell.getValue() === '') cell.setValue(false);
}

/**
 * Ô thả xuống "Trạng thái" và ô tích "Đã trả hoa hồng" của dòng đơn vừa ghi. Dòng chèn trên cùng lấy ô tích của dòng
 * ngay dưới: đơn không có seller thì bỏ ô tích đó đi (manager nhận hoa hồng thì syncProfit_ đặt lại).
 */
function orderCells_(sh, row, statuses, seller) {
  const status = colOf_(sh, ORDER_STATUS_COL, false);
  if (status) {
    sh.getRange(row, status).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(statuses, true).setAllowInvalid(true).build());
  }
  const paid = colOf_(sh, COMMISSION_PAID_COL, false);
  if (paid) {
    sh.getRange(row, paid).setDataValidation(seller ? SpreadsheetApp.newDataValidation().requireCheckbox().build() : null);
  }
  const pct = colOf_(sh, COMMISSION_PCT_COL, false);
  if (pct && seller) sh.getRange(row, pct).setNumberFormat('0.##%');
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
  const seller = orderSeller_(data);
  if (seller.error) return seller.error;
  if (overLimit_(phone)) return 'busy';

  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = getSheet_(ss, PRINT_SHEET, PRINT_HEADER);
  // In theo file chưa có giá: admin ghi % hoa hồng sau khi báo giá
  const pct = seller.name && row.sold ? commissionOf_(ss, [row.sold]) : '';
  // Ghi dòng và ô thả xuống trong cùng một khoá: đơn khác chèn lên trên giữa chừng thì ô thả xuống vẫn vào đúng dòng
  withDocLock_(() => {
    const added = addRow_(sh, Object.assign({ 'Thời gian': new Date(), 'Mã': code, 'Họ tên': name, 'SĐT': phone }, row.cells,
      { [PRINT_STATUS_COL]: PRINT_STATUSES[0] }, receivedCell_(sh, row.cells['Tạm tính (₫)']), sellerCells_(seller.name, pct)));
    orderCells_(sh, added, PRINT_STATUSES, Boolean(seller.name));
  });
  notify_(`${row.title} #${code} – ${name}`, [`${name} – ${phone}`, ...row.email, ...sellerLines_(seller.name, pct)].join('\n'));
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
  // Hoa hồng theo kiểu bảng (1 tầng, 2 tầng); không đọc được products.json thì theo id web gửi
  const sold = { key: `${COMMISSION_PLATE}${layout.id || String(p.layout_id || '').replace(/[^\w-]/g, '').slice(0, 40)}`, qty };
  return orderRow_('Đơn bảng tên', 'Bảng tên để bàn', { address, content, qty, price, total, checks, note, sold });
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
  return orderRow_('Đơn giá đỡ điện thoại', 'Giá đỡ điện thoại', { address, content, qty, price, total, checks, note, sold: { key: COMMISSION_STAND, qty } });
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

/** Dòng ở trang tính "In 3D" và email báo shop cho một đơn đặt ngay (bảng tên, giá đỡ). `sold`: tính hoa hồng. */
function orderRow_(title, kind, o) {
  return {
    title,
    sold: o.sold,
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

/* ---------- Hoa hồng seller: mức cho mỗi sản phẩm ở trang COMMISSION_SHEET ---------- */

/** Sản phẩm trên web có hoa hồng: { key (cột "Mã"), name, price }. In theo file chưa có giá nên admin ghi hoa hồng từng đơn. */
function commissionProducts_() {
  const data = siteData_();
  const list = [];
  (data.lines || []).forEach((l) => (l.kits || []).forEach((k) => {
    list.push({ key: `${l.id}:${k.id}`, name: productName_(l.name, k.name), price: Number(k.price) || 0 });
  }));
  const p = data.print3d || {};
  ((p.nameplate || {}).layouts || []).forEach((x) => {
    list.push({ key: COMMISSION_PLATE + x.id, name: `${PRINT_KINDS[0]} – ${x.name}`, price: Number(x.price) || 0 });
  });
  if (p.stand) list.push({ key: COMMISSION_STAND, name: PRINT_KINDS[1], price: Number(p.stand.price) || 0 });
  return list;
}

/**
 * Trang COMMISSION_SHEET có đủ các sản phẩm đang bán theo products.json: sản phẩm mới thêm dòng (% để trống cho admin
 * điền), tên hay giá đổi thì ghi lại, % đã điền giữ nguyên. Sản phẩm đã bỏ khỏi web vẫn giữ dòng. Không đọc được
 * products.json thì để danh sách như cũ. Trang từ bản trước (cột số tiền "Hoa hồng mỗi sản phẩm (₫)"): đổi tên cột đó thành
 * cột %, số đã gõ giữ nguyên (số ngoài 0–100 không phải %: Kiểm tra cài đặt báo để sửa). Trả trang tính.
 */
function syncCommission_(ss) {
  const sh = getSheet_(ss, COMMISSION_SHEET, COMMISSION_HEADER);
  migrateRates_(sh);
  let list;
  try {
    list = commissionProducts_();
  } catch (err) {
    console.warn(err);
    return sh;
  }
  withDocLock_(() => {
    const [key, name, price, rate] = COMMISSION_HEADER.map((col) => colOf_(sh, col, true));
    const width = sh.getLastColumn();
    const last = sh.getLastRow();
    const rows = last > 1 ? sh.getRange(2, 1, last - 1, width).getValues() : [];
    const at = new Map(rows.map((r, i) => [String(r[key - 1]).trim(), i + 2]));
    list.forEach((p) => {
      const r = at.get(p.key);
      if (r) {
        if (rows[r - 2][name - 1] !== p.name) sh.getRange(r, name).setValue(p.name);
        if (rows[r - 2][price - 1] !== p.price) sh.getRange(r, price).setValue(p.price);
        return;
      }
      const row = new Array(width).fill('');
      row[key - 1] = p.key;
      row[name - 1] = p.name;
      row[price - 1] = p.price;
      sh.appendRow(row);
      sh.getRange(sh.getLastRow(), price).setNumberFormat('#,##0');
      sh.getRange(sh.getLastRow(), rate).setNumberFormat('0.##%');
    });
  });
  return sh;
}

/**
 * Trang COMMISSION_SHEET của bản trước (cột số tiền "Hoa hồng mỗi sản phẩm (₫)"): đổi tên cột đó thành cột %, hiện dạng %;
 * số đã gõ giữ nguyên. Chạy khi mở Sheet và khi đồng bộ sản phẩm.
 */
function migrateRates_(sh) {
  const head = header_(sh);
  const old = head.indexOf(COMMISSION_OLD_RATE) + 1;
  if (!old || head.includes(COMMISSION_HEADER[3])) return;
  withDocLock_(() => {
    sh.getRange(1, old).setValue(COMMISSION_HEADER[3]);
    if (sh.getMaxRows() > 1) sh.getRange(2, old, sh.getMaxRows() - 1, 1).setNumberFormat('0.##%');
  });
}

/** % gõ "10%", 10 hay "0,1" đều là 10% (trả 0,1). Ô trống, chữ không ra số, số ngoài 0–100 (VD số tiền của bản trước): null. */
function pctOf_(value, dec) {
  const n = typeof value === 'number' ? value : String(value == null ? '' : value).trim() === '' ? null : numberFrom_(String(value), dec || ',');
  if (n === null || !Number.isFinite(n) || n < 0 || n > 100) return null;
  return n < 1 ? n : n / 100;
}

/**
 * % hoa hồng seller ở trang COMMISSION_SHEET: { byKey: Map mã → { pct, price, name }, byName: Map tên sản phẩm (matchText_)
 * → như trên, bad: số ô gõ không ra % }. `pct` null: sản phẩm chưa có %. Chưa có trang thì tạo, đủ sản phẩm.
 */
function commissionTable_(ss) {
  const sh = ss.getSheetByName(COMMISSION_SHEET) || syncCommission_(ss);
  const out = { byKey: new Map(), byName: new Map(), bad: 0 };
  const head = header_(sh).map(matchText_);
  const [key, name, price, pctCol] = COMMISSION_HEADER.map((col) => head.indexOf(matchText_(col)));
  // Sheet chưa mở lại từ khi dán script (cột còn tên của bản trước): vẫn đọc cột đó, số tiền cũ không ra % nên không dùng
  const rate = pctCol >= 0 ? pctCol : head.indexOf(matchText_(COMMISSION_OLD_RATE));
  if (key < 0 || rate < 0 || sh.getLastRow() < 2) return out;
  const dec = gridContext_(sh).dec;
  sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues().forEach((r) => {
    const k = String(r[key]).trim();
    if (!k) return;
    const pct = pctOf_(r[rate], dec);
    if (pct === null && String(r[rate]).trim() !== '') out.bad++;
    const item = { pct, price: price < 0 ? 0 : Number(r[price]) || 0, name: name < 0 ? '' : String(r[name]).trim() };
    out.byKey.set(k, item);
    if (item.name) out.byName.set(matchText_(item.name), item);
  });
  return out;
}

/** % chung của nhiều sản phẩm: trung bình các % theo giá bán × số lượng. Sản phẩm nào chưa có %, hay giá đều 0: "". */
function weightedPct_(items) {
  let base = 0;
  let sum = 0;
  for (const { item, qty } of items) {
    if (!item || item.pct === null) return '';
    base += item.price * qty;
    sum += item.pct * item.price * qty;
  }
  return base > 0 ? Math.round((sum / base) * 10000) / 10000 : ''; // tới 0,01%: % hiện trên Sheet đúng bằng % dùng để tính
}

/** % hoa hồng của đơn seller lên trên web (`sold`: { key, qty } của từng sản phẩm). Không đọc được trang %: "". */
function commissionOf_(ss, sold) {
  try {
    const table = commissionTable_(ss);
    return weightedPct_(sold.map(({ key, qty }) => ({ item: table.byKey.get(key), qty })));
  } catch (err) {
    console.error(err); // Không đọc được %: vẫn ghi đơn, % để trống cho admin ghi
    return '';
  }
}

/** % hoa hồng theo ô "Sản phẩm" của đơn (mỗi dòng "tên × số lượng", như đơn web và ô thả xuống trên trang quản trị). */
function productsPct_(table, text) {
  const lines = String(text == null ? '' : text).split('\n').map((s) => s.trim()).filter(Boolean);
  if (!lines.length) return '';
  return weightedPct_(lines.map((line) => {
    const m = line.match(/^(.+) × (\d{1,3})$/);
    return { item: table.byName.get(matchText_(m ? m[1] : line)), qty: m ? Number(m[2]) : 1 };
  }));
}

/**
 * Bảng giá theo products.json trên website: "pro:day-du" và "SC Tech Pro|Bộ đầy đủ linh kiện"
 * cùng trỏ tới { line, kit, price } của bộ đó.
 */
function catalog_() {
  const kits = new Map();
  siteData_().lines.forEach((l) => l.kits.forEach((k) => {
    const kit = { line: l.name, kit: k.name, price: Number(k.price) || 0, key: `${l.id}:${k.id}` };
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
    // Cột tiền, hoa hồng có sẵn để admin cấp quyền xem cột cho manager, seller ngay, trước khi có đơn đầu tiên dùng tới
    if (orders && orders.getLastRow()) {
      [ORDER_KEY_COL, ORDER_CHECK_COL, ORDER_STATUS_COL, ...SELLER_COLS].forEach((name) => colOf_(orders, name, true));
      addMoneyColumns_(orders);
      addNetColumn_(orders);
      addColumn_(orders, MANAGER_COL);
      addColumn_(orders, COMMISSION_PCT_COL, '0.##%');
    }
    const prints = ss.getSheetByName(PRINT_SHEET);
    if (prints && prints.getLastRow()) {
      SELLER_COLS.forEach((name) => colOf_(prints, name, true));
      addMoneyColumns_(prints);
      addNetColumn_(prints);
      addColumn_(prints, COMMISSION_PCT_COL, '0.##%');
    }
    const rates = ss.getSheetByName(COMMISSION_SHEET);
    if (rates) migrateRates_(rates);
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
  lines.push(commissionStatus_());
  const ui = SpreadsheetApp.getUi();
  ui.alert('Kiểm tra cài đặt', lines.join('\n\n'), ui.ButtonSet.OK);
}

/** Trang COMMISSION_SHEET (tạo nếu chưa có, thêm sản phẩm mới trên web): còn bao nhiêu sản phẩm chưa có mức hoa hồng. */
function commissionStatus_() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    syncCommission_(ss);
    const table = commissionTable_(ss);
    const items = [...table.byKey.values()];
    const missing = items.filter((x) => x.pct === null).length;
    if (!items.length) return `✗ Trang "${COMMISSION_SHEET}" chưa có sản phẩm nào (chưa đọc được products.json): chạy lại mục này sau.`;
    const bad = table.bad ? ` ${table.bad} ô không phải % (VD số tiền của bản trước): sửa thành % như "10%".` : '';
    return missing
      ? `• Trang "${COMMISSION_SHEET}": ${missing}/${items.length} sản phẩm chưa có % hoa hồng.${bad} Seller lên đơn sản phẩm đó thì ô % để trống, admin tự ghi.`
      : `✓ Trang "${COMMISSION_SHEET}" có % hoa hồng cho cả ${items.length} sản phẩm.`;
  } catch (err) {
    return `✗ Chưa kiểm tra được trang "${COMMISSION_SHEET}" (${err.message}).`;
  }
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
  const name = sh.getName();
  if (e.range.getLastRow() < 2 || ![ORDER_SHEET, PRINT_SHEET, COMMISSION_SHEET].includes(name)) return;
  const [rowFrom, rowTo, colFrom, colTo] = [e.range.getRow(), e.range.getLastRow(), e.range.getColumn(), e.range.getLastColumn()];
  if (name === COMMISSION_SHEET) {
    withDocLock_(() => fixRates_(sh, rowFrom, rowTo, colFrom, colTo));
    return;
  }
  if (watchesCodes_(sh, colFrom, colTo)) {
    const done = withDocLock_(() => linkCodes_(sh, rowFrom, rowTo));
    if (done && done.issue) sh.getParent().toast(done.issue, 'Chưa gán được mã', 8);
    else if (done && done.linked) sh.getParent().toast(`Đã ghi Mã đơn, Khách hàng ở trang "${CODE_SHEET}".`, 'Đã gán mã', 4);
  }
  if (watchesProfit_(sh, colFrom, colTo)) {
    withDocLock_(() => syncProfit_(sh, rowFrom, rowTo));
  } else {
    // Shop tự gõ, tự xoá ô Lợi nhuận: chỉ cột Lợi nhuận sau hoa hồng theo, ô Lợi nhuận giữ đúng như vừa gõ
    const cols = profitCols_(sh);
    if (cols && cols.net && cols.profit >= colFrom && cols.profit <= colTo) withDocLock_(() => syncProfit_(sh, rowFrom, rowTo, true));
  }
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

/* ---------- Tiền của đơn (trang Đơn hàng, In 3D): doanh thu đơn web, lợi nhuận, hoa hồng tự tính ---------- */

/**
 * Số thứ tự các cột tiền, hoa hồng ở trang Đơn hàng, In 3D (tìm theo tên; 0: trang không có cột đó). Trang khác, hay thiếu
 * Doanh thu sau điều chỉnh, Chi phí, Lợi nhuận: null. `net` chỉ có khi có cột Hoa hồng (₫).
 */
function profitCols_(sh) {
  if (sh.getName() !== ORDER_SHEET && sh.getName() !== PRINT_SHEET) return null;
  const head = header_(sh);
  const at = (name) => head.indexOf(name) + 1;
  const [revenue, cost, profit, commission] = [ORDER_REVENUE_COL, ORDER_COST_COL, ORDER_PROFIT_COL, COMMISSION_COL].map(at);
  if (!revenue || !cost || !profit) return null;
  const orders = sh.getName() === ORDER_SHEET;
  return {
    revenue, cost, profit, commission, net: commission ? at(ORDER_NET_COL) : 0,
    received: at(ORDER_RECEIVED_COL), ship: at(ORDER_SHIP_COL), pct: at(COMMISSION_PCT_COL), paid: at(COMMISSION_PAID_COL),
    seller: at(SELLER_COL), manager: orders ? at(MANAGER_COL) : 0, product: orders ? at('Sản phẩm') : 0, time: at('Thời gian'),
  };
}

/** Chỉ có dấu trừ, dấu nhân, không có dấu phân cách đối số (Sheet vùng Việt Nam có thể dùng ";" thay ","): vùng nào cũng nhận. */
function profitFormula_(cols, row) {
  return `=${colName_(cols.revenue)}${row}-${colName_(cols.cost)}${row}`;
}

/** Đơn web: Doanh thu sau điều chỉnh = Tiền thu người nhận trừ Phí ship (đơn web). */
function revenueFormula_(cols, row) {
  return `=${colName_(cols.received)}${row}-${colName_(cols.ship)}${row}`;
}

/** Hoa hồng (₫) = % hoa hồng × Doanh thu sau điều chỉnh của đơn. */
function commissionFormula_(cols, row) {
  return `=${colName_(cols.pct)}${row}*${colName_(cols.revenue)}${row}`;
}

/** Lợi nhuận sau hoa hồng: ô Lợi nhuận trừ ô Hoa hồng (₫); ô hoa hồng trống (đơn không ai nhận hoa hồng) tính là 0. */
function netFormula_(cols, row) {
  return `=${colName_(cols.profit)}${row}-${colName_(cols.commission)}${row}`;
}

/**
 * Cột colFrom–colTo có ô mà các bước của syncProfit_ dùng (tiền, %, Seller, Sản phẩm, Thời gian) hay ô quyết định đơn web
 * (Nền tảng, mã đơn): sửa thì chạy syncProfit_.
 */
function watchesProfit_(sh, colFrom, colTo) {
  const cols = profitCols_(sh);
  if (!cols) return false;
  const head = header_(sh);
  const other = [ORDER_PLATFORM_COL, 'Mã đơn', 'Mã'].map((name) => head.indexOf(name) + 1);
  return [cols.received, cols.ship, cols.revenue, cols.cost, cols.pct, cols.seller, cols.product, cols.time, ...other]
    .some((c) => c > 0 && c >= colFrom && c <= colTo);
}

/** Manager nhận hoa hồng của đơn ở trang Đơn hàng không có seller: { name, pct, since: "yyyy-mm-dd" }, null khi chưa bật. */
function managerCommission_() {
  const accounts = adminAccounts_();
  for (const name of Object.keys(accounts).sort()) {
    if (roleOf_(accounts[name]) !== 'manager') continue;
    const p = adminPerms_(name);
    if (p.pct > 0) return { name, pct: p.pct, since: p.since };
  }
  return null;
}

/** Ngày của đơn "yyyy-mm-dd" theo múi giờ của Sheet (ô ngày giờ hay chữ "31/10/2026 14:30"); không đọc ra ngày thì "". */
function orderDay_(value, tz) {
  const date = timeOf_(value, tz);
  return date ? Utilities.formatDate(date, tz, 'yyyy-MM-dd') : '';
}

/**
 * Các ô tự tính ở dòng from–to của trang Đơn hàng, In 3D, lần lượt:
 * 1. Đơn web: Doanh thu sau điều chỉnh = Tiền thu người nhận − Phí ship (đơn web).
 * 2. Lợi nhuận = Doanh thu sau điều chỉnh − Chi phí.
 * 3. Người nhận hoa hồng, ghi 1 lần khi ô % còn trống: đơn có seller lấy % theo ô Sản phẩm (trang Đơn hàng; In 3D admin ghi
 *    %); đơn ở trang Đơn hàng không có seller, ngày đơn từ ngày admin bật hoa hồng cho manager: tên và % của manager. Kèm ô
 *    tích Đã trả hoa hồng. % gõ 10 được ghi lại thành 10%.
 * 4. Hoa hồng (₫) = % hoa hồng × Doanh thu sau điều chỉnh.
 * 5. Lợi nhuận sau hoa hồng = Lợi nhuận − Hoa hồng (₫).
 * Công thức chỉ đặt khi các ô nó dùng đều có số và ô còn trống; thiếu số thì xoá đúng công thức đó (không hiện số sai, VD
 * lợi nhuận bằng cả doanh thu, lợi nhuận sau hoa hồng âm). Ô shop tự gõ, công thức khác giữ nguyên. `netOnly`: chỉ bước 5
 * (VD shop vừa tự gõ ô Lợi nhuận).
 */
function syncProfit_(sh, from, to, netOnly) {
  const cols = profitCols_(sh);
  const first = Math.max(from, 2);
  const last = Math.min(to, sh.getLastRow());
  if (!cols || last < first || (netOnly && !cols.net)) return;
  const range = sh.getRange(first, 1, last - first + 1, sh.getLastColumn());
  const values = range.getValues();
  const formulas = range.getFormulas();
  const names = header_(sh).map(matchText_);
  const tz = sh.getParent().getSpreadsheetTimeZone();
  const orders = sh.getName() === ORDER_SHEET;
  const manager = !netOnly && orders && cols.manager && cols.pct ? managerCommission_() : null;
  const same = (formula, wanted) => String(formula).replace(/\s/g, '').toUpperCase() === wanted;
  let table = null; // % theo sản phẩm, đọc khi cần
  values.forEach((row, i) => {
    const r = first + i;
    const has = {}; // ô có số, sau các bước đã làm ở dòng này
    const num = (c) => c > 0 && (Object.prototype.hasOwnProperty.call(has, c) ? has[c] : typeof row[c - 1] === 'number');
    const formula = (target, wanted, ok, format) => {
      if (!target) return;
      const now = formulas[i][target - 1];
      if (ok && row[target - 1] === '' && !now) {
        const cell = sh.getRange(r, target).setFormula(wanted);
        if (format) cell.setNumberFormat(format); // VD % × doanh thu có số lẻ: hiện tròn đồng
        has[target] = true;
      } else if (!ok && same(now, wanted)) {
        sh.getRange(r, target).clearContent();
        has[target] = false;
      }
    };
    if (!netOnly) {
      if (cols.received && cols.ship && webRow_(sh, row, names)) formula(cols.revenue, revenueFormula_(cols, r), num(cols.received) && num(cols.ship));
      formula(cols.profit, profitFormula_(cols, r), num(cols.revenue) && num(cols.cost));
      if (cols.pct && cols.commission) {
        const typed = row[cols.pct - 1];
        const own = !formulas[i][cols.pct - 1];
        if (own && typeof typed === 'number' && typed >= 1 && typed <= 100) {
          setPct_(sh, r, cols.pct, typed / 100); // gõ 10 nghĩa là 10%
          row[cols.pct - 1] = typed / 100;
        } else if (own && typed === '' && row[cols.commission - 1] === '' && (!cols.manager || String(row[cols.manager - 1]).trim() === '')) {
          // Ô % trống, chưa ai nhận: ghi người nhận, % (ô Hoa hồng (₫) đã có số, VD đơn seller bản trước ghi số tiền: giữ, không ghi %)
          const seller = cols.seller ? String(row[cols.seller - 1]).trim() : '';
          let pct = '';
          if (seller && cols.product) {
            table = table || commissionTable_(sh.getParent());
            pct = productsPct_(table, row[cols.product - 1]);
          } else if (!seller && manager && cols.time && orderDay_(row[cols.time - 1], tz) >= manager.since) {
            pct = manager.pct;
            sh.getRange(r, cols.manager).setValue(manager.name);
          }
          if (pct !== '') {
            setPct_(sh, r, cols.pct, pct);
            row[cols.pct - 1] = pct;
            has[cols.pct] = true;
            if (cols.paid) paidBox_(sh, r, cols.paid);
          }
        }
        const pct = row[cols.pct - 1];
        formula(cols.commission, commissionFormula_(cols, r), num(cols.pct) && pct >= 0 && pct <= 1 && num(cols.revenue), '#,##0');
      }
    }
    if (cols.net) formula(cols.net, netFormula_(cols, r), num(cols.profit));
  });
}

/** Ghi % hoa hồng của đơn (0,1 là 10%), hiện dạng "10%". */
function setPct_(sh, row, col, pct) {
  sh.getRange(row, col).setValue(pct).setNumberFormat('0.##%');
}

/**
 * Trang Hoa hồng seller, dòng rowFrom–rowTo vừa sửa: % gõ 10 (ô dạng % hiện thành 1000%) ghi lại thành 10%, như ô % của
 * đơn (pctOf_ vẫn đọc 10 là 10%: chỉ cho Sheet hiện đúng). Ô công thức, ô gõ số khác giữ nguyên.
 */
function fixRates_(sh, rowFrom, rowTo, colFrom, colTo) {
  const col = colOf_(sh, COMMISSION_HEADER[3]);
  const first = Math.max(rowFrom, 2);
  const last = Math.min(rowTo, sh.getLastRow());
  if (!col || col < colFrom || col > colTo || last < first) return;
  const range = sh.getRange(first, col, last - first + 1, 1);
  const formulas = range.getFormulas();
  range.getValues().forEach(([v], i) => {
    if (!formulas[i][0] && typeof v === 'number' && v >= 1 && v <= 100) setPct_(sh, first + i, col, v / 100);
  });
}

/** Cột mới ở cuối trang, định dạng số cho cả cột (VD "#,##0", "0.##%"); cột đã có thì để nguyên. Trả số thứ tự cột. */
function addColumn_(sh, name, format) {
  const had = colOf_(sh, name);
  if (had) return had;
  const col = colOf_(sh, name, true);
  if (format && sh.getMaxRows() > 1) sh.getRange(2, col, sh.getMaxRows() - 1, 1).setNumberFormat(format);
  return col;
}

/**
 * Cột tiền (MONEY_COLS). Trang Đơn hàng gộp từ Customer Infor đã có Tiền thu người nhận, Doanh thu sau điều chỉnh…: Phí ship
 * (đơn web) chèn ngay trước Doanh thu sau điều chỉnh (chưa gộp, chưa có cột Doanh thu thì thôi). Trang In 3D: thêm cả cụm ở
 * cuối. Chỉ thêm cột (tên ở dòng 1, định dạng số), không sửa ô nào đang có; chèn cột thì Google Sheet tự dời công thức theo.
 */
function addMoneyColumns_(sh) {
  const head = header_(sh);
  const revenue = head.indexOf(ORDER_REVENUE_COL) + 1;
  if (revenue && !head.includes(ORDER_SHIP_COL)) {
    sh.insertColumnBefore(revenue);
    sh.getRange(1, revenue + 1).copyFormatToRange(sh, revenue, revenue, 1, 1);
    sh.getRange(1, revenue).setValue(ORDER_SHIP_COL);
    if (sh.getMaxRows() > 1) sh.getRange(2, revenue, sh.getMaxRows() - 1, 1).setNumberFormat('#,##0');
  }
  if (revenue || sh.getName() === PRINT_SHEET) MONEY_COLS.forEach((name) => addColumn_(sh, name, '#,##0'));
}

/**
 * Thêm cột Lợi nhuận sau hoa hồng vào cuối trang (khi đã có Doanh thu, Chi phí, Lợi nhuận và Hoa hồng (₫)). Lần đầu thêm
 * thì điền công thức cho mọi đơn đã có lợi nhuận, ghi cả cột một lần (cột mới nên chưa có gì để ghi đè).
 */
function addNetColumn_(sh) {
  if (!profitCols_(sh) || !header_(sh).includes(COMMISSION_COL) || header_(sh).includes(ORDER_NET_COL)) return;
  colOf_(sh, ORDER_NET_COL, true);
  const cols = profitCols_(sh);
  const last = sh.getLastRow();
  if (last < 2) return;
  const values = sh.getRange(2, cols.profit, last - 1, 1).getValues();
  sh.getRange(2, cols.net, last - 1, 1).setFormulas(values.map(([v], i) => [typeof v === 'number' ? netFormula_(cols, i + 2) : '']));
  sh.getRange(2, cols.net, last - 1, 1).setNumberFormat('#,##0');
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
const ADMIN_AUTO_PRODUCT = 'Script ghi theo products.json trên web.';
// Ô tiền tự tính ở trang Đơn hàng, In 3D: Lợi nhuận mọi dòng; Doanh thu sau điều chỉnh của đơn web. Phí ship chỉ ở đơn web
const ADMIN_MONEY_AUTO = {
  [ORDER_PROFIT_COL]: `Tự tính: ${ORDER_REVENUE_COL} trừ ${ORDER_COST_COL}.`,
  [ORDER_NET_COL]: `Tự tính: ${ORDER_PROFIT_COL} trừ ${COMMISSION_COL}.`,
};
// Doanh thu sau điều chỉnh của đơn web: tự tính khi trang có đủ 2 cột nó dùng. Ô đã có số gõ tay (đơn web cũ) vẫn sửa được
const ADMIN_WEB_REVENUE = {
  [ORDER_REVENUE_COL]: { why: `Tự tính cho đơn web: ${ORDER_RECEIVED_COL} trừ ${ORDER_SHIP_COL}.`, needs: [ORDER_RECEIVED_COL, ORDER_SHIP_COL] },
};
const ADMIN_SHIP_WEB_ONLY = { why: `${ORDER_SHIP_COL} chỉ dành cho đơn đặt trên website.`, cols: [ORDER_SHIP_COL] };
const ADMIN_RULES = {
  [ORDER_SHEET]: {
    header: true,
    readOnly: ADMIN_MONEY_AUTO,
    web: {
      why: 'Web tự ghi cho đơn đặt trên website.', auto: ADMIN_WEB_REVENUE,
      cols: ['Thời gian', 'Mã đơn', ORDER_PLATFORM_COL, 'Sản phẩm', 'Tổng (₫)', ORDER_CHECK_COL],
    },
    notWeb: ADMIN_SHIP_WEB_ONLY,
    choices: {
      [ORDER_PLATFORM_COL]: ORDER_PLATFORMS, 'Sản phẩm': () => productNames_(), [ORDER_STATUS_COL]: ORDER_STATUSES,
      [SELLER_COL]: () => sellerNames_(), [MANAGER_COL]: () => managerNames_(),
    },
    qty: ['Sản phẩm'],
  },
  [LEAD_SHEET]: { header: true },
  [PRINT_SHEET]: {
    header: true,
    readOnly: ADMIN_MONEY_AUTO,
    // Nội dung, Số lượng, Tạm tính vẫn sửa được: shop chốt lại với khách, yêu cầu in theo file chờ shop báo giá
    web: { why: 'Web tự ghi cho yêu cầu đặt trên website.', auto: ADMIN_WEB_REVENUE, cols: ['Thời gian', 'Mã', 'Loại', ORDER_CHECK_COL] },
    notWeb: ADMIN_SHIP_WEB_ONLY,
    choices: { 'Loại': PRINT_KINDS, [PRINT_STATUS_COL]: PRINT_STATUSES, [SELLER_COL]: () => sellerNames_() },
  },
  [COMMISSION_SHEET]: {
    header: true, noAdd: true,
    readOnly: { [COMMISSION_HEADER[0]]: ADMIN_AUTO_PRODUCT, [COMMISSION_HEADER[1]]: ADMIN_AUTO_PRODUCT, [COMMISSION_HEADER[2]]: ADMIN_AUTO_PRODUCT },
    tip: `% hoa hồng seller cho mỗi sản phẩm (gõ "10%"): đơn seller lên tự tính ${COMMISSION_COL} = % × ${ORDER_REVENUE_COL} của đơn (đơn nhiều sản phẩm: % theo tỷ trọng giá bán). Đổi % chỉ áp dụng cho đơn mới, đơn đã có thì sửa ở cột "${COMMISSION_PCT_COL}" của đơn đó. Chỉ admin xem được trang này.`,
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
const ADMIN_ACTIONS = {
  doc: adminRead_, sua: adminEdit_, them: adminAppend_, xoa: adminDelete_, phien: adminWho_, 'doi-mat-khau': adminPassword_,
  'hoa-hong': adminCommission_, 'tai-khoan': adminAccountList_, 'luu-tai-khoan': adminAccountSave_, 'xoa-tai-khoan': adminAccountRemove_,
};
const ADMIN_ONLY_ACTIONS = ['tai-khoan', 'luu-tai-khoan', 'xoa-tai-khoan']; // Quản lý tài khoản: chỉ admin

/* Vai trò: admin làm được mọi việc. Manager, seller chỉ thấy các trang tính admin cho (quyền lưu ở ADMIN_PERMS_KEY + tên):
   manager không bao giờ thấy cột hoa hồng; seller ở trang Đơn hàng, In 3D chỉ thấy đơn mình lên. Tài khoản tạo từ trước
   khi có vai trò (không ghi role) là admin. */
const ADMIN_ROLES = { admin: 'Admin', manager: 'Manager', seller: 'Seller' };
const ADMIN_PERMS_KEY = 'quan-tri:quyen:'; // + tên: { sheets: { id trang tính: { view, edit, add, del, cols? } }, order }
const ADMIN_ONLY_SHEETS = [ADMIN_LOG_SHEET, COMMISSION_SHEET]; // Không cấp cho manager, seller được
const OWN_ROW_SHEETS = [ORDER_SHEET, PRINT_SHEET];            // Seller chỉ thấy dòng có cột Seller là tên mình
const ADMIN_NOT_ALLOWED = 'Tài khoản của bạn không làm được việc này.';
const ADMIN_ONLY_EDIT = 'Chỉ admin sửa được.';
const ADMIN_SHIP_ONLY = 'Chỉ admin nhập phí ship (đơn web).';
const ADMIN_VIEW_ONLY = 'Tài khoản của bạn chỉ xem cột này.';
const ADMIN_NAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;
const ADMIN_NAME_TEXT = 'Tên đăng nhập 3–30 ký tự: chữ không dấu, số, dấu chấm, gạch ngang, gạch dưới.';

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
  // Quyền đọc lại mỗi lần: admin vừa đổi quyền thì áp dụng ngay ở lần bấm tiếp theo
  const me = { user: session.user, role: session.role, perms: session.role === 'admin' ? null : adminPerms_(session.user) };
  if (ADMIN_ONLY_ACTIONS.includes(data.action) && me.role !== 'admin') return { ok: false, error: ADMIN_NOT_ALLOWED };
  return ADMIN_ACTIONS[data.action](data, session.user, me);
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
  return { ok: true, token, user: name, role: roleOf_(account) };
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
  session.role = roleOf_(account); // không lưu vào phiên: admin đổi vai trò thì có hiệu lực ngay
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

/** Vai trò của tài khoản: "manager", "seller", hoặc "admin" (cả tài khoản tạo từ trước khi có vai trò). */
function roleOf_(account) {
  return account && (account.role === 'manager' || account.role === 'seller') ? account.role : 'admin';
}

/** Quyền admin cấp cho manager, seller: { sheets: { id trang tính: { view, edit, add, del, cols? } }, order }. */
function adminPerms_(name) {
  let p = null;
  try {
    p = JSON.parse(PropertiesService.getScriptProperties().getProperty(ADMIN_PERMS_KEY + name) || 'null');
  } catch (err) {
    p = null;
  }
  const pct = p && typeof p.pct === 'number' && p.pct > 0 && p.pct < 1 ? p.pct : 0;
  return {
    sheets: p && p.sheets && typeof p.sheets === 'object' ? p.sheets : {},
    order: Boolean(p && p.order === true),
    ship: Boolean(p && p.ship === true),
    pct,
    since: pct && /^\d{4}-\d{2}-\d{2}$/.test(p.since) ? p.since : '',
  };
}

/** Tên, vai trò của người đang đăng nhập cho trang quản trị; `order`: seller được lên đơn trên trang Đặt hàng, In 3D. */
function whoami_(me) {
  return {
    user: me.user, role: me.role, label: ADMIN_ROLES[me.role], order: me.role === 'seller' && me.perms.order,
    earns: me.role === 'seller' || (me.role === 'manager' && me.perms.pct > 0), // có mục Hoa hồng của tôi
  };
}

/** Tên các tài khoản seller: ô thả xuống ở cột Seller (chỉ admin thấy). */
function sellerNames_() {
  const accounts = adminAccounts_();
  return Object.keys(accounts).filter((name) => roleOf_(accounts[name]) === 'seller').sort();
}

/** Cột tiền hoa hồng: tên cột có chữ "hoa hồng", ở bất kỳ trang nào. Manager không bao giờ thấy, chỉ admin sửa được. */
function commissionCol_(label) {
  return /(^| )hoa hong( |$)/.test(matchText_(label));
}

/** Tài khoản xem được trang tính này không (chưa xét từng cột). */
function canSee_(me, sh) {
  if (me.role === 'admin') return true;
  if (ADMIN_ONLY_SHEETS.includes(sh.getName())) return false;
  const id = String(sh.getSheetId());
  return Object.prototype.hasOwnProperty.call(me.perms.sheets, id) && Boolean(me.perms.sheets[id]) && me.perms.sheets[id].view === true;
}

/**
 * Tên các cột để cấp quyền xem: chữ ở dòng tiêu đề (như headRow_), cột không có tên thì "#A", "#B"… Admin đổi tên cột
 * thì manager, seller không thấy cột đó nữa tới khi admin cho xem lại: cột mới không tự lộ ra ngoài ý admin.
 */
function columnKeys_(sh, rules) {
  const cols = sh.getLastColumn();
  if (!cols) return [];
  const row = headRow_(sh, rules || adminRules_(sh));
  const head = row ? sh.getRange(row, 1, 1, cols).getDisplayValues()[0] : [];
  return Array.from({ length: cols }, (_, c) => {
    const label = String(head[c] == null ? '' : head[c]).replace(/\s+/g, ' ').trim();
    return { col: c + 1, key: label || `#${colName_(c + 1)}`, label: label || `Cột ${colName_(c + 1)}` };
  });
}

/**
 * Quyền của tài khoản với trang tính `sh` (null: không xem được): sửa, thêm, xoá dòng; các cột ẩn `hide` (không gửi dữ
 * liệu đi); các cột chỉ xem `lock` ({ cột: lý do }); `own` > 0: chỉ các dòng có cột đó là tên seller (-1: trang thiếu
 * cột Seller nên không có dòng nào). Seller không thêm, xoá dòng ở trang đơn: seller lên đơn ở trang Đặt hàng, In 3D.
 */
function sheetAccess_(me, sh, rules) {
  if (me.role === 'admin') return { admin: true, edit: true, add: true, del: true, hide: new Set(), lock: {}, extra: new Set(), own: 0 };
  if (!canSee_(me, sh)) return null;
  const p = me.perms.sheets[String(sh.getSheetId())];
  const shown = Array.isArray(p.cols) ? new Set(p.cols.map(matchText_)) : null;
  const orders = OWN_ROW_SHEETS.includes(sh.getName());
  const edit = p.edit === true;
  const hide = new Set();
  const lock = {};
  const extra = new Set(); // cột sửa được cả khi trang chỉ xem: Phí ship (đơn web), khi admin cho tài khoản này nhập
  const keys = columnKeys_(sh, rules);
  keys.forEach(({ col, key, label }) => {
    const name = matchText_(label);
    if (orders && name === matchText_(ORDER_SHIP_COL)) {
      if (me.perms.ship) extra.add(col); // được nhập: luôn hiện
      else if (shown && !shown.has(matchText_(key))) hide.add(col);
      else lock[col] = ADMIN_SHIP_ONLY;
      return;
    }
    const money = commissionCol_(label);
    if ((shown && !shown.has(matchText_(key))) || (money && me.role === 'manager')) hide.add(col);
    else if (money || (orders && (name === matchText_(SELLER_COL) || name === matchText_(MANAGER_COL)))) lock[col] = ADMIN_ONLY_EDIT;
  });
  // Trang chỉ xem mà được nhập phí ship: khoá từng cột khác (thay vì khoá cả trang)
  if (!edit && extra.size) keys.forEach(({ col }) => { if (!extra.has(col) && !hide.has(col) && !lock[col]) lock[col] = ADMIN_VIEW_ONLY; });
  const own = me.role === 'seller' && orders ? colOf_(sh, SELLER_COL) || -1 : 0;
  return { admin: false, edit, add: edit && p.add === true && !own, del: edit && p.del === true && !own, hide, lock, extra, own };
}

/** Luật trang tính (adminRules_) theo quyền của tài khoản: thêm cột chỉ xem, bỏ phần của cột ẩn, chỉ xem cả trang… */
function restrict_(rules, access) {
  if (!access || access.admin) return Object.assign({}, rules, { hide: [], own: false, viewOnly: false });
  const visible = (col) => !access.hide.has(Number(col));
  const locked = Object.keys(access.lock).map(Number);
  const why = Object.assign({}, rules.why);
  locked.forEach((col) => { if (!why[col]) why[col] = access.lock[col]; });
  // Cột chỉ xem không gửi lựa chọn: VD seller không thấy tên các seller khác trong ô thả xuống cột Seller
  const choices = {};
  Object.keys(rules.choices).forEach((col) => { if (visible(col) && !access.lock[col]) choices[col] = rules.choices[col]; });
  return Object.assign({}, rules, {
    all: rules.all || (!access.edit && !access.extra.size),
    cols: rules.cols.concat(locked.filter((col) => !rules.cols.includes(col))),
    why,
    choices,
    web: rules.web.filter(visible),
    notWeb: rules.notWeb.filter(visible),
    qty: rules.qty.filter((col) => choices[col]),
    add: rules.add && access.add,
    del: rules.del && access.del,
    hide: [...access.hide].sort((a, b) => a - b),
    own: Boolean(access.own),
    viewOnly: !access.edit && !rules.all && !access.extra.size,
  });
}

/** Ô của các cột ẩn thành rỗng: mã dòng (rowHash_) chỉ tính phần tài khoản thấy, không dò ngược ra được ô ẩn. */
function maskRow_(values, hide) {
  return hide && hide.size ? values.map((v, c) => (hide.has(c + 1) ? '' : v)) : values;
}

/** Dòng của seller `user`: ô ở cột `own` là tên tài khoản đó (không phân biệt hoa thường, dấu cách thừa). */
function ownRow_(values, own, user) {
  return own > 0 && String(values[own - 1] == null ? '' : values[own - 1]).trim().toLowerCase() === user;
}

/** Admin vừa bỏ quyền xem trang này: web tải lại, mở trang khác. */
function sheetHidden_(name) {
  return { ok: false, conflict: true, error: `Tài khoản của bạn không còn xem được trang tính "${String(name).slice(0, 100)}".` };
}

/** Muối mới cho mã băm mật khẩu. */
function newSalt_() {
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid()).slice(0, 16));
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
 * Danh sách trang tính tài khoản này xem được và nội dung trang đang mở (không có tên đó thì mở trang đầu tiên; không
 * xem được trang nào thì `sheet` null). Mở trang Tổng quan thì số liệu được tính lại và gửi kèm (`dashboard`) để web vẽ
 * biểu đồ. Lần đầu admin đăng nhập sau khi dán script, trang Tổng quan được tạo ở đầu.
 */
function adminRead_(data, user, me) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const admin = me.role === 'admin';
  let dashboard = admin && !ss.getSheetByName(DASHBOARD_SHEET) ? dashboardFor_(ss) : null;
  const sheets = ss.getSheets().filter((s) => canSee_(me, s));
  const wanted = adminSheet_(data.sheet);
  const sh = wanted && canSee_(me, wanted) ? wanted : sheets[0] || null;
  if (sh && admin && sh.getName() === COMMISSION_SHEET) syncCommission_(ss); // sản phẩm mới trên web có dòng ngay
  const own = Boolean(sh) && sh.getName() === DASHBOARD_SHEET;
  if (own && !dashboard) dashboard = dashboardFor_(ss);
  // Trang cùng tên do shop tự tạo (không có ghi chú của script ở ô A1): hiện như trang tính thường
  if (!own || sh.getRange(1, 1).getNote() !== DASH_MARK) dashboard = null;
  return {
    ok: true,
    user,
    me: whoami_(me),
    url: admin ? ss.getUrl() : '', // người không phải admin không mở Google Sheet: không cần biết địa chỉ
    log: admin ? ADMIN_LOG_SHEET : '',
    sheets: sheets.map((s) => ({ name: s.getName(), hidden: s.isSheetHidden() })),
    sheet: sh ? sheetView_(sh, sheetAccess_(me, sh), user) : null,
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
  // Ô tự tính ở dòng web (VD Doanh thu sau điều chỉnh), chỉ khi trang có đủ các cột công thức dùng: khoá với lý do riêng
  const webAuto = {};
  Object.entries((rule.web && rule.web.auto) || {}).forEach(([name, auto]) => { if (at(name) && auto.needs.every(at)) webAuto[at(name)] = auto.why; });
  return {
    all: Boolean(rule.all),
    header: Boolean(rule.header),
    cols,
    why,
    web: rule.web ? rule.web.cols.map(at).filter(Boolean).concat(Object.keys(webAuto).map(Number)) : [],
    webWhy: rule.web ? rule.web.why : '',
    webAuto, // { cột: lý do }: ô trống hay ô công thức thì khoá, ô gõ tay vẫn sửa được
    notWeb: rule.notWeb ? rule.notWeb.cols.map(at).filter(Boolean) : [], // khoá ở dòng không phải đơn web (VD Phí ship)
    notWebWhy: rule.notWeb ? rule.notWeb.why : '',
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

/**
 * Ô `col` của dòng `row` không sửa được trên trang quản trị: trả lý do, sửa được thì trả chuỗi rỗng. `value`: ô đang có gì
 * (ô tự tính ở dòng web mà đang có số gõ tay thì vẫn sửa được).
 */
function adminLock_(rules, row, col, web, formula, value) {
  if (rules.header && row === 1) return 'chỉ sửa được trên Google Sheet.';
  if (!editable_(rules, row, col)) return rules.why[col] || 'chỉ sửa được trên Google Sheet.';
  if (web && rules.web.includes(col)) {
    if (!rules.webAuto[col]) return rules.webWhy;
    if (formula || value === '' || value == null) return rules.webAuto[col];
  }
  if (!web && rules.notWeb.includes(col)) return rules.notWebWhy;
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
 * `access` (sheetAccess_): cột ẩn không gửi gì; seller ở trang đơn chỉ nhận dòng tiêu đề và các đơn của `user`.
 */
function sheetView_(sh, access, user) {
  const ctx = gridContext_(sh);
  const rows = sh.getLastRow();
  const cols = sh.getLastColumn();
  const view = {
    name: sh.getName(), id: sh.getSheetId(), rows, cols, frozen: sh.getFrozenRows(), rules: restrict_(adminRules_(sh, true), access),
    dec: ctx.dec, images: tryGet_(() => sh.getImages().length) || 0, formulas: false,
    widths: [], kinds: [], merges: [], lists: [], rowNums: [], hashes: [], cells: [], webRows: [],
  };
  if (!rows || !cols) return view;
  const hide = access ? access.hide : null;
  const own = access ? access.own : 0;
  const head = Math.min(rows, Math.max(view.frozen, 1));
  const fit = Math.max(head + 1, Math.floor(ADMIN_MAX_CELLS / cols));
  // Trang mới nhất ở trên: các dòng đầu; trang khác: dòng tiêu đề và các dòng cuối
  const parts = rows <= fit ? [[1, rows]] : view.rules.top ? [[1, fit]] : [[1, head], [rows - (fit - head) + 1, rows]];
  const names = view.rules.web.length || view.rules.notWeb.length ? header_(sh).map(matchText_) : null;
  const kinds = [];
  parts.forEach(([from, to]) => {
    gridRows_(sh.getRange(from, 1, to - from + 1, cols), ctx, hide).forEach((r, i) => {
      const at = from + i;
      if (own && at > head && !ownRow_(r.values, own, user)) return;
      view.rowNums.push(at);
      view.hashes.push(r.hash);
      view.cells.push(r.cells);
      if (at > head) kinds.push(r.kinds);
      if (names && at > 1 && webRow_(sh, r.shown, names)) view.webRows.push(at);
    });
  });
  view.kinds = Array.from({ length: cols }, (_, c) => majorityKind_(kinds.map((k) => k[c])));
  view.widths = tryGet_(() => Array.from({ length: cols }, (_, c) => sh.getColumnWidth(c + 1))) || [];
  // Chỉ xem đơn của mình: bỏ ô gộp ở phần dữ liệu (các dòng không liền nhau); ô gộp chạm cột ẩn cũng bỏ
  view.merges = (tryGet_(() => sh.getRange(1, 1, rows, cols).getMergedRanges()) || [])
    .map((m) => [m.getRow(), m.getColumn(), m.getNumRows(), m.getNumColumns()])
    .filter(([r, c, nr, nc]) => (!own || r + nr - 1 <= head) && !(hide && [...hide].some((h) => h >= c && h < c + nc)));
  view.lists = ctx.lists;
  view.formulas = ctx.formulas;
  if (own) view.rows = view.rowNums[view.rowNums.length - 1] || 0;
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

/**
 * Các dòng của `range`; ô trống hẳn (không chữ, màu, ghi chú) là null cho dữ liệu gửi đi gọn. Cột trong `hide` (số cột)
 * cũng là null và không tính vào mã dòng. `values`, `shown` (giá trị, chữ hiện đủ mọi cột) chỉ để script dùng, không gửi đi.
 */
function gridRows_(range, ctx, hide) {
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
  const hidden = (c) => Boolean(hide) && hide.has(c + 1);
  return values.map((row, r) => ({
    hash: rowHash_(maskRow_(row, hide)),
    kinds: row.map((value, c) => (hidden(c) ? '' : cellKind_(value))),
    values: row,
    shown: shown[r],
    cells: row.map((value, c) => {
      if (hidden(c)) return null;
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
function adminEdit_(data, user, me) {
  const sh = adminSheet_(data.sheet);
  if (!sh) return sheetGone_(data.sheet);
  const row = Number(data.row);
  const items = Array.isArray(data.cells) ? data.cells : [];
  if (!Number.isInteger(row) || row < 1 || !items.length || items.length > 500) return { ok: false, error: ADMIN_BAD };
  const access = sheetAccess_(me, sh);
  if (!access) return sheetHidden_(data.sheet);
  if (!access.edit && !access.extra.size) return { ok: false, error: 'Tài khoản của bạn chỉ xem được trang tính này.' };
  const rules = restrict_(adminRules_(sh), access);
  return withDocLock_(() => {
    const width = sh.getLastColumn();
    if (row > sh.getLastRow()) return { ok: false, conflict: true, error: ADMIN_CONFLICT };
    const range = sh.getRange(row, 1, 1, width);
    const values = range.getValues()[0];
    if (rowHash_(maskRow_(values, access.hide)) !== data.hash) return { ok: false, conflict: true, error: ADMIN_CONFLICT };
    if (access.own && !ownRow_(values, access.own, user)) return { ok: false, conflict: true, error: ADMIN_CONFLICT };
    const ctx = gridContext_(sh);
    const formulas = range.getFormulas()[0];
    const shown = range.getDisplayValues()[0];
    const names = rules.web.length || rules.notWeb.length ? header_(sh).map(matchText_) : null;
    const web = Boolean(names) && webRow_(sh, values, names);
    const changes = [];
    for (const item of items) {
      const col = Number(item && item.col);
      if (!Number.isInteger(col) || col < 1 || col > width || access.hide.has(col)) return { ok: false, error: ADMIN_BAD };
      const lock = cellKind_(values[col - 1]) === 'o' ? 'chỉ sửa được trên Google Sheet.'
        : adminLock_(rules, row, col, web, formulas[col - 1], values[col - 1]);
      if (lock) return { ok: false, error: lockText_(sh, row, col, lock) };
      const cell = sh.getRange(row, col);
      const kind = cellKind_(values[col - 1]) || columnKind_(sh, col);
      const next = cellInput_(item.value, kind, cell.getNumberFormat(), ctx);
      if (!sameCell_(values[col - 1], formulas[col - 1], next)) changes.push({ cell, col, next, before: formulas[col - 1] || shown[col - 1] });
    }
    changes.forEach((ch) => (ch.next.formula !== undefined ? ch.cell.setFormula(ch.next.formula) : ch.cell.setValue(ch.next.value)));
    if (sh.getName() === COMMISSION_SHEET) fixRates_(sh, row, row, 1, width);
    const linked = changes.some((ch) => watchesCodes_(sh, ch.col, ch.col)) ? linkCodes_(sh, row, row) || {} : null;
    if (changes.some((ch) => watchesProfit_(sh, ch.col, ch.col))) syncProfit_(sh, row, row);
    const fresh = gridRows_(sh.getRange(row, 1, 1, sh.getLastColumn()), ctx, access.hide)[0];
    changes.forEach((ch) => {
      const cell = fresh.cells[ch.col - 1];
      adminLog_(user, 'Sửa ô', sh.getName(), `${colName_(ch.col)}${row}`, ch.before, cell ? (cell.f ? cell.e : cell.d) || '' : '');
    });
    return {
      ok: true, saved: changes.length,
      row: { hash: fresh.hash, cells: fresh.cells, lists: ctx.lists, web: Boolean(names) && webRow_(sh, fresh.shown, names) },
      reload: Boolean(linked), message: linked && linked.issue ? linked.issue : '',
    };
  });
}

/**
 * Thêm một dòng (ô theo thứ tự cột): trang trong NEWEST_FIRST ngay dưới dòng tiêu đề, trang khác ở cuối. Ô tích, ô thả
 * xuống, định dạng lấy theo dòng dữ liệu kề bên (dòng đầu hoặc dòng cuối hiện có).
 */
function adminAppend_(data, user, me) {
  const sh = adminSheet_(data.sheet);
  if (!sh) return sheetGone_(data.sheet);
  const access = sheetAccess_(me, sh);
  if (!access) return sheetHidden_(data.sheet);
  const rules = restrict_(adminRules_(sh), access);
  if (!rules.add) {
    return { ok: false, error: access.admin ? 'Trang tính này không thêm dòng trên web được.' : 'Tài khoản của bạn không thêm dòng ở trang tính này được.' };
  }
  const input = Array.isArray(data.values) ? data.values : [];
  return withDocLock_(() => {
    const width = sh.getLastColumn();
    const last = sh.getLastRow();
    if (!width || input.length > width || rowHash_(maskRow_(sh.getRange(1, 1, 1, width).getValues()[0], access.hide)) !== data.head) {
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
    const names = rules.notWeb.length ? header_(sh).map(matchText_) : null;
    const web = Boolean(names) && webRow_(sh, input.map((v) => (v == null ? '' : v)), names);
    const row = [];
    const text = [];
    for (let c = 0; c < width; c++) {
      const value = input[c];
      if (value == null || value === '') {
        row.push('');
        continue;
      }
      if (access.hide.has(c + 1)) return { ok: false, error: ADMIN_BAD };
      if (!web && rules.notWeb.includes(c + 1)) return { ok: false, error: `Cột ${colName_(c + 1)} (${header_(sh)[c]}): ${rules.notWebWhy}` };
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
function adminDelete_(data, user, me) {
  const sh = adminSheet_(data.sheet);
  if (!sh) return sheetGone_(data.sheet);
  const access = sheetAccess_(me, sh);
  if (!access) return sheetHidden_(data.sheet);
  const rules = restrict_(adminRules_(sh), access);
  const row = Number(data.row);
  if (!rules.del) {
    return { ok: false, error: access.admin ? 'Trang tính này không xoá dòng trên web được.' : 'Tài khoản của bạn không xoá dòng ở trang tính này được.' };
  }
  if (!Number.isInteger(row) || row < (rules.header ? 2 : 1)) return { ok: false, error: ADMIN_BAD };
  return withDocLock_(() => {
    if (row > sh.getLastRow()) return { ok: false, conflict: true, error: ADMIN_CONFLICT };
    const range = sh.getRange(row, 1, 1, sh.getLastColumn());
    if (rowHash_(maskRow_(range.getValues()[0], access.hide)) !== data.hash) return { ok: false, conflict: true, error: ADMIN_CONFLICT };
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

/** Việc "phien": ai đang đăng nhập. Trang Đặt hàng, In 3D hỏi khi seller mở, để báo đơn sẽ ghi tên seller. Phiên được gia hạn. */
function adminWho_(data, user, me) {
  return Object.assign({ ok: true }, whoami_(me));
}

/** Đổi mật khẩu của chính mình (mọi vai trò), cần mật khẩu hiện tại. Đổi xong mọi nơi đang đăng nhập bị đăng xuất. */
function adminPassword_(data, user) {
  const old = typeof data.old === 'string' ? data.old.slice(0, 200) : '';
  const pass = typeof data.pass === 'string' ? data.pass : '';
  if (pass.length < ADMIN_MIN_PASSWORD || pass.length > 200) return { ok: false, error: `Mật khẩu mới cần ít nhất ${ADMIN_MIN_PASSWORD} ký tự.` };
  if (adminLocked_(user)) return { ok: false, error: ADMIN_LOCKED };
  const account = adminAccounts_()[user];
  // Sai mật khẩu hiện tại tính như đăng nhập sai: ai mượn được phiên đang mở cũng không dò được mật khẩu
  if (!account || !sameText_(passwordHash_(old, account.salt), account.hash)) {
    adminFailed_(user, true, false);
    return { ok: false, error: adminLocked_(user) ? ADMIN_LOCKED : 'Mật khẩu hiện tại chưa đúng.' };
  }
  const salt = newSalt_();
  const hash = passwordHash_(pass, salt);
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const accounts = adminAccounts_();
    if (!accounts.hasOwnProperty(user)) return { ok: false, login: true, error: 'Tài khoản này vừa bị xoá.' };
    Object.assign(accounts[user], { salt, hash, ver: randomKey_().slice(0, 12) });
    PropertiesService.getScriptProperties().setProperty(ADMIN_ACCOUNTS_KEY, JSON.stringify(accounts));
  } finally {
    lock.releaseLock();
  }
  adminLog_(user, 'Đổi mật khẩu', '', user, '', '');
  return { ok: true };
}

/**
 * Việc "hoa-hong": hoa hồng ở trang Đơn hàng, In 3D theo người nhận (seller của đơn; đơn Đơn hàng không có seller: manager
 * ở cột Manager): đang chờ (đơn chưa giao xong), chưa trả (đơn đã giao), đã trả (đã tích "Đã trả hoa hồng"); đơn huỷ không
 * tính. Đơn chưa có số tiền: `noRate` chưa có %, `noBase` chờ Doanh thu sau điều chỉnh. Admin: mọi người nhận, các đơn cần
 * làm (trả hoa hồng, ghi %, nhập doanh thu) và lợi nhuận theo tháng sau khi trừ hoa hồng. Seller, manager: của mình và các
 * đơn mình nhận hoa hồng.
 */
function adminCommission_(data, user, me) {
  const admin = me.role === 'admin';
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tz = ss.getSpreadsheetTimeZone();
  const people = new Map();
  const of = (name, role) => {
    if (!people.has(name)) people.set(name, { name, role, orders: 0, sales: 0, wait: 0, due: 0, paid: 0, noRate: 0, noBase: 0, cancelled: 0 });
    return people.get(name);
  };
  const manager = managerCommission_();
  if (admin) {
    sellerNames_().forEach((name) => of(name, 'seller'));
    if (manager) of(manager.name, 'manager');
  } else {
    of(user, me.role);
  }
  const orders = [];
  const months = new Map(); // admin: "yyyy-MM" → lợi nhuận, hoa hồng của các đơn đã có lợi nhuận
  [[ORDER_SHEET, 'Mã đơn', 'Tổng (₫)', 'Sản phẩm'], [PRINT_SHEET, 'Mã', 'Tạm tính (₫)', 'Loại']].forEach(([name, codeCol, totalCol, whatCol]) => {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return;
    const head = header_(sh);
    const at = (col) => head.indexOf(col);
    const c = {
      seller: at(SELLER_COL), manager: name === ORDER_SHEET ? at(MANAGER_COL) : -1, amount: at(COMMISSION_COL), pct: at(COMMISSION_PCT_COL),
      paid: at(COMMISSION_PAID_COL), status: at(ORDER_STATUS_COL), profit: at(ORDER_PROFIT_COL),
      code: at(codeCol), total: at(totalCol), what: at(whatCol), time: at('Thời gian'), customer: at('Họ tên'),
    };
    const dec = gridContext_(sh).dec;
    const cell = (row, i) => (i < 0 || row[i] == null ? '' : row[i]);
    const money = (v) => (typeof v === 'number' ? v : numberFrom_(String(v), dec));
    sh.getRange(2, 1, sh.getLastRow() - 1, head.length).getValues().forEach((row, i) => {
      const seller = String(cell(row, c.seller)).trim().toLowerCase();
      const managed = seller ? '' : String(cell(row, c.manager)).trim().toLowerCase();
      const amount = money(cell(row, c.amount));
      const time = cell(row, c.time);
      const date = timeOf_(time, tz);
      if (admin) {
        const profit = money(cell(row, c.profit));
        if (profit !== null && date) {
          const key = Utilities.formatDate(date, tz, 'yyyy-MM');
          const m = months.get(key) || { month: key, orders: 0, profit: 0, commission: 0 };
          m.orders++;
          m.profit += profit;
          m.commission += amount || 0;
          months.set(key, m);
        }
      }
      const who = seller || managed;
      if (!who) return;
      if (!admin && (me.role === 'seller' ? seller !== user : seller !== '' || managed !== user)) return;
      const s = of(who, seller ? 'seller' : 'manager'); // admin: cả người đã xoá tài khoản mà còn đơn
      const pct = pctOf_(cell(row, c.pct), dec);
      const status = String(cell(row, c.status)).trim();
      const state = commissionState_(status, paidCell_(cell(row, c.paid)));
      if (state === 'cancelled') {
        s.cancelled++;
      } else {
        s.orders++;
        s.sales += Number(cell(row, c.total)) || 0;
        if (amount !== null) s[state] += amount;
        else if (pct === null) s.noRate++;
        else s.noBase++;
      }
      // Admin chỉ cần các đơn phải làm: trả hoa hồng (đã giao), ghi % còn thiếu, nhập doanh thu cho đơn đã giao
      let task = '';
      if (state !== 'cancelled' && state !== 'paid') {
        if (amount !== null) task = state === 'due' ? 'pay' : '';
        else task = pct === null ? 'rate' : state === 'due' ? 'base' : '';
      }
      if (admin && !task) return;
      orders.push({
        sheet: name, row: i + 2, who, role: seller ? 'seller' : 'manager', code: String(cell(row, c.code)),
        customer: String(cell(row, c.customer)), what: String(cell(row, c.what)).split('\n')[0].slice(0, 80),
        total: Number(cell(row, c.total)) || 0, status, pct, amount, state, task: admin ? task : '', at: date ? date.getTime() : 0,
        time: date ? Utilities.formatDate(date, tz, 'dd/MM/yyyy') : String(time),
      });
    });
  });
  orders.sort((a, b) => b.at - a.at);
  const limit = admin ? 200 : 300;
  const out = {
    ok: true, me: whoami_(me), updated: adminNow_(),
    people: [...people.values()].sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name)),
    orders: orders.slice(0, limit), more: Math.max(0, orders.length - limit),
  };
  if (admin) {
    syncCommission_(ss);
    const table = commissionTable_(ss);
    const items = [...table.byKey.values()];
    out.rates = { sheet: COMMISSION_SHEET, products: items.length, missing: items.filter((x) => x.pct === null).length, bad: table.bad };
    out.manager = manager ? { name: manager.name, pct: manager.pct, since: dayText_(manager.since) } : null;
    out.months = [...months.values()].sort((a, b) => b.month.localeCompare(a.month)).slice(0, 12)
      .map((m) => Object.assign(m, { label: m.month.split('-').reverse().join('/'), net: m.profit - m.commission }));
  }
  return out;
}

/** Hoa hồng của một đơn đang ở đâu: "paid" đã trả, "cancelled" đơn huỷ, "due" đã giao chưa trả, "wait" chờ đơn giao xong. */
function commissionState_(status, paid) {
  const s = matchText_(status);
  if (paid) return 'paid';
  if (s === 'huy' || s === 'da huy' || s === 'hoan hang') return 'cancelled';
  return s === 'da giao' ? 'due' : 'wait';
}

/** Ô "Đã trả hoa hồng": ô tích đã tích, hoặc gõ tay "x", "có", "đã trả". */
function paidCell_(value) {
  return value === true || /^(true|x|co|da tra)$/.test(matchText_(value));
}

// Quyền gợi ý khi tạo tài khoản, admin chỉnh lại được: manager quản lý đơn; seller xem đơn mình lên, tình trạng, hoa hồng
const MANAGER_SHEETS = [ORDER_SHEET, PRINT_SHEET, LEAD_SHEET];
// Theo thứ tự cột trên Sheet (gộp Customer Infor xong, mở lại Sheet): khung quyền trên web gửi lên đúng thứ tự này
const SELLER_SHEET_COLS = {
  [ORDER_SHEET]: ['Thời gian', 'Mã đơn', 'Họ tên', 'SĐT', 'Địa chỉ', 'Sản phẩm', 'Tổng (₫)', 'Ghi chú', ORDER_REVENUE_COL, ORDER_STATUS_COL,
    COMMISSION_COL, COMMISSION_PAID_COL, COMMISSION_PCT_COL],
  [PRINT_SHEET]: ['Thời gian', 'Mã', 'Loại', 'Họ tên', 'SĐT', 'Địa chỉ', 'Nội dung', 'Số lượng', 'Tạm tính (₫)', 'Ghi chú', PRINT_STATUS_COL,
    COMMISSION_COL, COMMISSION_PAID_COL, ORDER_REVENUE_COL, COMMISSION_PCT_COL],
};

function defaultPerms_(role, ss) {
  const sheets = {};
  ss.getSheets().forEach((s) => {
    const id = String(s.getSheetId());
    if (role === 'manager' && MANAGER_SHEETS.includes(s.getName())) sheets[id] = { view: true, edit: true, add: true };
    if (role === 'seller' && SELLER_SHEET_COLS.hasOwnProperty(s.getName())) sheets[id] = { view: true, cols: SELLER_SHEET_COLS[s.getName()] };
  });
  return { sheets, order: role === 'seller', ship: false, pct: 0, since: '' };
}

/** Quyền admin gửi lên, chỉ giữ phần hợp lệ: trang tính có thật (trừ trang chỉ admin), cờ đúng/sai, tên cột ngắn. */
function cleanPerms_(raw, ss, role) {
  const src = raw && typeof raw === 'object' && raw.sheets && typeof raw.sheets === 'object' ? raw.sheets : {};
  const sheets = {};
  ss.getSheets().forEach((s) => {
    const id = String(s.getSheetId());
    if (ADMIN_ONLY_SHEETS.includes(s.getName()) || !Object.prototype.hasOwnProperty.call(src, id)) return;
    const p = src[id];
    if (!p || p.view !== true) return;
    const out = { view: true };
    if (p.edit === true) {
      out.edit = true;
      const own = role === 'seller' && OWN_ROW_SHEETS.includes(s.getName());
      if (p.add === true && !own) out.add = true;
      if (p.del === true && !own) out.del = true;
    }
    if (Array.isArray(p.cols)) {
      out.cols = [...new Set(p.cols.filter((k) => typeof k === 'string' && k.trim()).map((k) => k.trim().slice(0, 100)))].slice(0, 200);
    }
    sheets[id] = out;
  });
  // % hoa hồng manager (0,05 là 5%; đơn ở trang Đơn hàng không có seller), tính cho đơn từ ngày `since` (mặc định hôm nay)
  const pct = role === 'manager' && raw && typeof raw.pct === 'number' && raw.pct > 0 && raw.pct < 1 ? Math.round(raw.pct * 10000) / 10000 : 0;
  const since = raw && typeof raw.since === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.since) ? raw.since
    : Utilities.formatDate(new Date(), ss.getSpreadsheetTimeZone(), 'yyyy-MM-dd');
  return {
    sheets,
    order: role === 'seller' && Boolean(raw && raw.order === true),
    ship: role !== 'admin' && Boolean(raw && raw.ship === true),
    pct,
    since: pct ? since : '',
  };
}

/** Tên các tài khoản manager: ô thả xuống cột Manager (chỉ admin thấy). */
function managerNames_() {
  const accounts = adminAccounts_();
  return Object.keys(accounts).filter((name) => roleOf_(accounts[name]) === 'manager').sort();
}

/** "31/12/2026" từ "2026-12-31". */
function dayText_(day) {
  return String(day).split('-').reverse().join('/');
}

/** Quyền viết gọn cho nhật ký, email: "Seller · Đơn hàng: xem (11 cột) · In 3D: xem, sửa · được lên đơn". */
function permsText_(role, perms, ss) {
  if (!perms) return ADMIN_ROLES[role];
  // Theo thứ tự trang tính trong Sheet (id trang là số ngẫu nhiên)
  const parts = ss.getSheets().filter((s) => Object.prototype.hasOwnProperty.call(perms.sheets, String(s.getSheetId()))).map((s) => {
    const p = perms.sheets[String(s.getSheetId())];
    const can = ['xem', p.edit && 'sửa', p.add && 'thêm dòng', p.del && 'xoá dòng'].filter(Boolean).join(', ');
    return `${s.getName()}: ${can}${p.cols ? ` (${p.cols.length} cột)` : ''}`;
  });
  return [ADMIN_ROLES[role], ...(parts.length ? parts : ['chưa xem được trang tính nào']), ...(perms.order ? ['được lên đơn'] : []),
    ...(perms.ship ? ['nhập phí ship'] : []), ...(perms.pct ? [`hoa hồng ${pctText_(perms.pct)} từ ${dayText_(perms.since)}`] : [])].join(' · ');
}

/** Việc "tai-khoan" (chỉ admin): các tài khoản (không có mật khẩu, khoá mã 2 bước), các trang tính và cột để cấp quyền. */
function adminAccountList_(data, user) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const accounts = adminAccounts_();
  return {
    ok: true,
    accounts: Object.keys(accounts).sort().map((name) => {
      const role = roleOf_(accounts[name]);
      return { name, role, totp: Boolean(accounts[name].totp), perms: role === 'admin' ? null : adminPerms_(name), self: name === user };
    }),
    sheets: ss.getSheets().filter((s) => !ADMIN_ONLY_SHEETS.includes(s.getName())).map((s) => ({
      id: String(s.getSheetId()), name: s.getName(), own: OWN_ROW_SHEETS.includes(s.getName()),
      cols: columnKeys_(s).map(({ key, label }) => ({ key, label, money: commissionCol_(label) })),
    })),
    roles: ADMIN_ROLES,
    defaults: { manager: defaultPerms_('manager', ss), seller: defaultPerms_('seller', ss) },
    min: ADMIN_MIN_PASSWORD,
  };
}

/**
 * Việc "luu-tai-khoan" (chỉ admin): tạo hoặc sửa tài khoản: vai trò, quyền, mật khẩu mới (để trống: giữ mật khẩu cũ).
 * Đổi mật khẩu hay vai trò thì người đó bị đăng xuất. Không tự đổi vai trò, mật khẩu của mình ở đây, không để web hết
 * admin. Ghi nhật ký; tạo tài khoản, đổi vai trò, đặt mật khẩu mới thì báo email.
 */
function adminAccountSave_(data, user) {
  const name = String(data.name == null ? '' : data.name).trim().toLowerCase();
  const role = ADMIN_ROLES.hasOwnProperty(data.role) ? data.role : '';
  const pass = typeof data.pass === 'string' ? data.pass : '';
  const isNew = data.isNew === true;
  if (!ADMIN_NAME_RE.test(name)) return { ok: false, error: ADMIN_NAME_TEXT };
  if (!role) return { ok: false, error: ADMIN_BAD };
  if (pass && (pass.length < ADMIN_MIN_PASSWORD || pass.length > 200)) return { ok: false, error: `Mật khẩu cần ít nhất ${ADMIN_MIN_PASSWORD} ký tự.` };
  if (isNew && !pass) return { ok: false, error: 'Tài khoản mới cần mật khẩu.' };
  if (name === user && pass) return { ok: false, error: 'Đổi mật khẩu của chính bạn ở mục "Đổi mật khẩu" (cần mật khẩu hiện tại).' };
  if (name === user && role !== 'admin') return { ok: false, error: 'Không tự đổi vai trò của chính mình được: nhờ một admin khác.' };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const perms = role === 'admin' ? null : cleanPerms_(data.perms, ss, role);
  if (perms && JSON.stringify(perms).length > 8000) return { ok: false, error: 'Quyền quá dài để lưu: bớt các cột chọn riêng.' };
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let before = '';
  let was = '';
  let sweep = false;
  try {
    const props = PropertiesService.getScriptProperties();
    const accounts = adminAccounts_();
    const exists = accounts.hasOwnProperty(name);
    if (isNew && exists) return { ok: false, error: `Đã có tài khoản "${name}".` };
    if (!isNew && !exists) return { ok: false, conflict: true, error: `Không còn tài khoản "${name}" (có thể vừa bị xoá).` };
    const old = exists ? accounts[name] : {};
    was = exists ? roleOf_(old) : '';
    const had = exists && was !== 'admin' ? adminPerms_(name) : null;
    before = exists ? permsText_(was, had, ss) : '';
    // Vừa bật, đổi % hay ngày hoa hồng manager: ghi luôn cho các đơn đã có từ ngày đó (sau khi lưu)
    sweep = Boolean(perms && perms.pct) && (was !== 'manager' || !had || had.pct !== perms.pct || had.since !== perms.since);
    const admins = Object.keys(accounts).filter((n) => roleOf_(accounts[n]) === 'admin').length;
    if (was === 'admin' && role !== 'admin' && admins < 2) return { ok: false, error: 'Đây là tài khoản admin cuối cùng: cần một admin khác trước.' };
    // Đơn không có seller chỉ có một manager nhận hoa hồng
    const other = perms && perms.pct ? Object.keys(accounts).find((n) => n !== name && roleOf_(accounts[n]) === 'manager' && adminPerms_(n).pct > 0) : '';
    if (other) return { ok: false, error: `Manager "${other}" đang nhận hoa hồng đơn không có seller: bỏ % của "${other}" trước (mỗi lúc chỉ một manager nhận).` };
    const next = Object.assign({}, old);
    if (role === 'admin') delete next.role;
    else next.role = role;
    if (pass) {
      next.salt = newSalt_();
      next.hash = passwordHash_(pass, next.salt);
    }
    if (pass || was !== role) next.ver = randomKey_().slice(0, 12);
    accounts[name] = next;
    const text = JSON.stringify(accounts);
    if (text.length > 8500) return { ok: false, error: 'Đã quá nhiều tài khoản để lưu: xoá bớt tài khoản không dùng.' };
    props.setProperty(ADMIN_ACCOUNTS_KEY, text);
    if (perms) props.setProperty(ADMIN_PERMS_KEY + name, JSON.stringify(perms));
    else props.deleteProperty(ADMIN_PERMS_KEY + name);
    if (pass) props.deleteProperty(ADMIN_DEVICES_KEY + name);
  } finally {
    lock.releaseLock();
  }
  const after = permsText_(role, perms, ss) + (pass ? ' · đặt mật khẩu mới' : '');
  adminLog_(user, isNew ? 'Tạo tài khoản' : 'Sửa tài khoản', '', name, before, after);
  const swept = sweep ? sweepManager_(ss, perms.since) : 0;
  if (swept) adminLog_(user, 'Ghi hoa hồng manager', ORDER_SHEET, `${swept} đơn`, '', `${name}: ${pctText_(perms.pct)} các đơn không có seller từ ${dayText_(perms.since)}`);
  if (isNew || pass || was !== role) {
    adminAlert_(`tk:${name}:${Date.now()}`, `SmartCarTech: tài khoản quản trị "${name}" vừa được ${isNew ? 'tạo' : 'sửa'}`, [
      `Admin "${user}" vừa ${isNew ? 'tạo' : 'sửa'} tài khoản "${name}" trên trang quản trị lúc ${adminNow_()}: ${after}.`,
      'Nếu không phải bạn hay người bạn tin: mở Google Sheet → menu SmartCarTech → "Tài khoản trang quản trị…" để xoá tài khoản lạ, đổi mật khẩu admin. Muốn chặn ngay: menu SmartCarTech → "Bật hoặc tắt trang quản trị…".',
    ]);
  }
  return Object.assign(adminAccountList_(data, user), swept ? { swept } : {});
}

/**
 * Admin vừa bật (hay đổi) hoa hồng manager: các đơn ở trang Đơn hàng đặt từ ngày `since`, chưa có seller, manager, % thì
 * ghi manager và % luôn (syncProfit_ trên các dòng đó), không chờ tới lần sửa đơn sau. Trả số đơn vừa ghi.
 */
function sweepManager_(ss, since) {
  const sh = ss.getSheetByName(ORDER_SHEET);
  const cols = sh && profitCols_(sh);
  if (!cols || !cols.manager || !cols.pct || !cols.commission || !cols.time || sh.getLastRow() < 2) return 0;
  const tz = ss.getSpreadsheetTimeZone();
  return withDocLock_(() => {
    const values = sh.getRange(2, 1, sh.getLastRow() - 1, sh.getLastColumn()).getValues();
    const blank = (row, c) => !c || String(row[c - 1]).trim() === '';
    const rows = [];
    values.forEach((row, i) => {
      const free = blank(row, cols.seller) && blank(row, cols.manager) && blank(row, cols.pct) && blank(row, cols.commission);
      if (free && orderDay_(row[cols.time - 1], tz) >= since) rows.push(i + 2);
    });
    if (!rows.length) return 0;
    syncProfit_(sh, rows[0], rows[rows.length - 1]);
    const names = sh.getRange(rows[0], cols.manager, rows[rows.length - 1] - rows[0] + 1, 1).getValues();
    return rows.filter((r) => String(names[r - rows[0]][0]).trim() !== '').length;
  });
}

/** Việc "xoa-tai-khoan" (chỉ admin): không tự xoá mình. Người đang đăng nhập bằng tài khoản đó bị đăng xuất. */
function adminAccountRemove_(data, user) {
  const name = String(data.name == null ? '' : data.name).trim().toLowerCase();
  if (!ADMIN_NAME_RE.test(name)) return { ok: false, error: ADMIN_BAD };
  if (name === user) return { ok: false, error: 'Không tự xoá tài khoản của chính mình được.' };
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  let before = '';
  try {
    const props = PropertiesService.getScriptProperties();
    const accounts = adminAccounts_();
    if (!accounts.hasOwnProperty(name)) return { ok: false, conflict: true, error: `Không còn tài khoản "${name}".` };
    const role = roleOf_(accounts[name]);
    before = permsText_(role, role === 'admin' ? null : adminPerms_(name), ss);
    delete accounts[name];
    props.setProperty(ADMIN_ACCOUNTS_KEY, JSON.stringify(accounts));
    [ADMIN_PERMS_KEY, ADMIN_DEVICES_KEY].forEach((key) => props.deleteProperty(key + name));
    CacheService.getScriptCache().remove(`qt:cai-ma:${name}`);
  } finally {
    lock.releaseLock();
  }
  adminLog_(user, 'Xoá tài khoản', '', name, before, '');
  adminAlert_(`tk:${name}:${Date.now()}`, `SmartCarTech: tài khoản quản trị "${name}" vừa bị xoá`, [
    `Admin "${user}" vừa xoá tài khoản "${name}" (${before}) trên trang quản trị lúc ${adminNow_()}.`,
  ]);
  return adminAccountList_(data, user);
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

/** Cửa sổ tài khoản gọi: các tài khoản, vai trò và đã bật mã 2 bước chưa (không có mật khẩu hay khoá). */
function listAdminAccounts() {
  const accounts = adminAccounts_();
  return Object.keys(accounts).sort().map((name) => ({ name, totp: Boolean(accounts[name].totp), role: roleOf_(accounts[name]) }));
}

/**
 * Tạo tài khoản, hoặc đổi mật khẩu nếu tên đã có: mọi nơi đang đăng nhập bằng tài khoản đó bị đăng xuất. Mã 2 bước
 * vẫn giữ. Đổi mật khẩu (VD vì nghi bị lộ) cũng quên các trình duyệt đã biết: lần sau trình duyệt nào cũng báo email.
 * `role` (admin, manager, seller; không gửi: giữ như cũ, tài khoản mới là admin). Manager, seller chưa có quyền thì nhận
 * quyền gợi ý (defaultPerms_); chỉnh chi tiết trên trang quản trị bằng tài khoản admin.
 */
function saveAdminAccount(name, password, role) {
  const user = String(name == null ? '' : name).trim().toLowerCase();
  const pass = String(password == null ? '' : password);
  if (!ADMIN_NAME_RE.test(user)) throw new Error(ADMIN_NAME_TEXT);
  if (pass.length < ADMIN_MIN_PASSWORD || pass.length > 200) throw new Error(`Mật khẩu cần ít nhất ${ADMIN_MIN_PASSWORD} ký tự.`);
  if (role != null && !ADMIN_ROLES.hasOwnProperty(role)) throw new Error('Vai trò không hợp lệ.');
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const props = PropertiesService.getScriptProperties();
    const accounts = adminAccounts_();
    const changed = accounts.hasOwnProperty(user);
    const salt = newSalt_();
    const next = Object.assign({}, changed ? accounts[user] : {}, { salt, hash: passwordHash_(pass, salt), ver: randomKey_().slice(0, 12) });
    const was = changed ? roleOf_(accounts[user]) : '';
    if (role === 'admin') delete next.role;
    else if (role) next.role = role;
    accounts[user] = next;
    props.setProperty(ADMIN_ACCOUNTS_KEY, JSON.stringify(accounts));
    props.deleteProperty(ADMIN_DEVICES_KEY + user);
    const now = roleOf_(next);
    if (now === 'admin') props.deleteProperty(ADMIN_PERMS_KEY + user);
    else if (!props.getProperty(ADMIN_PERMS_KEY + user)) {
      props.setProperty(ADMIN_PERMS_KEY + user, JSON.stringify(defaultPerms_(now, SpreadsheetApp.getActiveSpreadsheet())));
    }
    const what = changed ? (was === now ? 'Đổi mật khẩu' : `Đổi mật khẩu, vai trò ${ADMIN_ROLES[was]} → ${ADMIN_ROLES[now]}`) : 'Tạo tài khoản';
    adminLog_('Google Sheet', what, '', user, '', changed ? '' : ADMIN_ROLES[now]);
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
      [ADMIN_DEVICES_KEY, ADMIN_PERMS_KEY].forEach((key) => props.deleteProperty(key + user));
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
  const label = (name) => (roleOf_(accounts[name]) === 'admin' ? name : `${name} – ${ADMIN_ROLES[roleOf_(accounts[name])].toLowerCase()}`);
  const lines = [
    `✓ Trang quản trị ${SITE_URL}/quan-tri.html: ${names.length} tài khoản (${names.map(label).join(', ')}).`,
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
  // Đã có cột Lợi nhuận sau hoa hồng: các dòng vừa gộp có lợi nhuận cũng có công thức của cột đó
  syncProfit_(os, 2, os.getLastRow(), true);
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
input, select { width: 100%; padding: 9px 10px; border: 1px solid #A9B3BB; border-radius: 6px; font: inherit; background: #fff; }
input:focus, select:focus { outline: 2px solid #0B6E8A; outline-offset: 0; border-color: #0B6E8A; }
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
  <label for="role">Vai trò</label>
  <select id="role">
    <option value="admin">Admin: xem, sửa mọi thứ, quản lý tài khoản</option>
    <option value="manager">Manager: quản lý đơn, không thấy hoa hồng</option>
    <option value="seller">Seller: lên đơn, xem đơn và hoa hồng của mình</option>
  </select>
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
<p class="help">Manager, seller xem được trang tính nào, cột nào: đăng nhập trang quản trị bằng tài khoản admin, mở mục <b>Tài khoản</b>.</p>
</div>

<script type="application/json" id="data">__DATA__</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcode-generator/1.4.4/qrcode.min.js" integrity="sha512-ZDSPMa/JM1D+7kdg2x3BsruQ6T/JpJo3jWDWkCZsP+5yVyp1KfESqLI+7RqB5k24F7p2cV7i2YHh/890y6P6Sw==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
<script>
(function () {
  var data = JSON.parse(document.getElementById('data').textContent);
  var NAME_RE = /^[a-z0-9][a-z0-9._-]{2,29}$/;
  var ROLES = { admin: 'Admin', manager: 'Manager', seller: 'Seller' };
  var setup = null; // { name, key, uri }: đang bật mã 2 bước cho tài khoản này
  var known = {};   // tên → vai trò của các tài khoản đang có: gõ tên đã có thì chọn sẵn vai trò của tài khoản đó

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
    known = {};
    accounts.forEach(function (a) { known[a.name] = a.role || 'admin'; });
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
      state.textContent = (ROLES[a.role] || ROLES.admin) + ' · ' + (a.totp ? 'Đã bật mã 2 bước' : 'Chưa bật mã 2 bước');
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
  el('name').addEventListener('input', function () {
    var name = el('name').value.trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(known, name)) el('role').value = known[name];
  });
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
    run('saveAdminAccount', [name, el('pass').value, el('role').value], 'Đã lưu tài khoản ' + name + '. Đăng nhập tại ' + data.page, function () {
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
