/* SmartCarTech — Trang quản trị (quan-tri.html)
   Đăng nhập bằng tài khoản admin tạo (mục Tài khoản ở đây, hoặc menu SmartCarTech → "Tài khoản trang quản trị…" trong
   Google Sheet), rồi xem, sửa, thêm, xoá dòng của các trang tính trong Sheet của shop theo vai trò:
   - admin: mọi trang tính, mọi việc, quản lý tài khoản, xem hoa hồng của mọi seller, manager;
   - manager, seller: chỉ các trang tính, các cột admin cho. Manager không thấy cột hoa hồng; seller ở trang Đơn hàng,
     In 3D chỉ thấy đơn mình lên. Cả hai xem hoa hồng của mình và lên đơn ở trang Đặt hàng, In 3D trong cùng tab (khi
     admin cho); manager có thêm hoa hồng quản lý (đơn khách tự đặt).
   google-apps-script.gs kiểm tra phiên và quyền trước mỗi việc (cột ẩn không được gửi về trình duyệt), và chỉ ghi khi dòng
   chưa bị đổi ở nơi khác (web gửi kèm mã của dòng lúc tải). Web giữ mã phiên trong tab đang mở (sessionStorage): đóng tab
   là đăng xuất. Tài khoản đã bật mã 2 bước: đúng mật khẩu thì script trả vé (`ticket`), web hỏi thêm mã 6 số.
*/
import { $, $$, esc, icon, toast, loadData, trapFocus, fmtPrice, NO_COUNT_KEY } from './core.js';
import { renderDashboard, redrawDashboard } from './dashboard.js';

const SESSION_KEY = 'sctech_admin_v1'; // core.js đọc cùng khoá: seller, manager đang đăng nhập thì đơn gửi từ tab này ghi tên người đó
const SHEET_KEY = 'sctech_admin_sheet';
const VISITS_KEY = 'sctech_admin_visits'; // + ":tên": số lần mở mỗi trang tính, để tải trước trang hay mở
const CACHE_MAX = 16;            // Số trang tính nhớ trong tab: quá thì bỏ trang lâu nhất chưa mở lại
const PREFETCH_MAX = 8;          // Mở xong trang đầu: tải trước bấy nhiêu trang hay mở nhất
const LIST_MAX_AGE = 5 * 60000;  // Danh sách trang tính cũ hơn bấy nhiêu thì xin lại (VD vừa thêm trang trên Google Sheet)
const DASH_NAME = 'Tổng quan';   // Giống DASHBOARD_SHEET trong google-apps-script.gs
const SIDE_KEY = 'sctech_admin_side_hidden';
const DEVICE_KEY = 'sctech_admin_trinh_duyet'; // mã ngẫu nhiên của trình duyệt này: script chỉ báo email khi gặp trình duyệt lạ
const WIDE = window.matchMedia('(min-width: 1024px)'); // Giống style.css: từ cỡ này cột trang tính luôn nằm bên trái
const MAX_STICKY_ROWS = 2; // Dòng tiêu đề (hoặc tiêu đề + tên cột) đứng yên khi cuộn; nhiều hơn thì chiếm hết màn hình điện thoại
const HEX = /^#[0-9a-f]{6}$/i;

const ROLES = { admin: 'Admin', manager: 'Manager', seller: 'Seller' };

const app = {
  endpoint: '',
  token: '',
  user: '',
  role: '',       // admin, manager, seller (script trả khi đăng nhập và trong mỗi lần "doc")
  order: false,   // seller, manager được lên đơn trên trang Đặt hàng, In 3D
  view: '',       // mục đang mở thay cho trang tính: "hoa-hong", "tai-khoan" ('' = trang tính)
  doc: null,      // trả lời "doc" gần nhất: { user, me, url, log, sheets, sheet (null: chưa được xem trang nào) }
  query: '',
  ticket: 0,      // lần tải gần nhất: kết quả của lần tải cũ (VD đã bấm sang trang khác) bị bỏ
  loadedAt: null,
  notesOpen: false,
  step2: null,    // đang chờ mã 2 bước: { ticket, user }
  codeBusy: false,
  cache: new Map(),    // trang đã mở, đã tải trước trong tab này: tên → trả lời "doc" (bấm lại thì hiện ngay)
  inflight: new Map(), // tên trang → lần tải đang chạy
  sheets: null,        // danh sách trang tính mới nhất script gửi (các lần tải sau không xin lại, xem LIST_MAX_AGE)
  listAt: 0,           // lúc nhận danh sách đó
  counts: null,        // [số dòng đang hiện, tổng số dòng] của lần vẽ dòng thông tin gần nhất
  gen: 0,              // đổi khi đăng xuất, đổi tài khoản: kết quả tải của phiên trước bị bỏ
  prefetched: false,   // đã tải trước các trang hay mở (mỗi lần đăng nhập một lần)
  waiting: 0,          // số lần tải người dùng đang chờ (tải ngầm nhường các lần này)
};
const els = {};
let panel = null; // khung xem / sửa một dòng đang mở

/* ---------- Helpers ---------- */
function colName(n) {
  let s = '';
  for (let x = n; x > 0; x = Math.floor((x - 1) / 26)) s = String.fromCharCode(65 + ((x - 1) % 26)) + s;
  return s;
}

/** Chữ để sửa của một ô: số không dấu nghìn, ngày dd/mm/yyyy, công thức "=…" (script gửi `e` khi khác chữ hiện). */
const editOf = (cell) => (cell ? cell.e ?? cell.d ?? '' : '');

/** So khớp khi tìm: không phân biệt hoa thường, có dấu hay không ("nguyen" khớp "Nguyễn"). */
const plain = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase();

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

function canEdit(sh, row, col) {
  return !sh.rules.all && !(sh.rules.header && row === 1) && !sh.rules.cols.includes(col);
}

/**
 * Vì sao ô chỉ xem (chuỗi rỗng: sửa được), giống adminLock_ trong google-apps-script.gs: ô script tự tính (VD Lợi nhuận),
 * ô web tự ghi ở đơn đặt trên website (ô tự tính như Doanh thu sau điều chỉnh: trừ ô đang có số gõ tay), ô chỉ dành cho
 * đơn web (Phí ship) ở dòng khác, ô công thức.
 */
function lockOf(sh, row, col, cell) {
  if (cell?.t === 'o') return '[Hình ảnh trong ô: xem trên Google Sheet]';
  if (sh.rules.header && row === 1) return 'Chỉ sửa trên Google Sheet.';
  if (!canEdit(sh, row, col)) return sh.rules.why?.[col] || 'Chỉ sửa trên Google Sheet.';
  const web = sh.webRows.has(row);
  if (web && sh.rules.web?.includes(col)) {
    const auto = sh.rules.webAuto?.[col];
    if (!auto) return sh.rules.webWhy;
    if (cell?.f || !cell?.d) return auto;
  }
  if (!web && sh.rules.notWeb?.includes(col)) return sh.rules.notWebWhy;
  return cell?.f ? `Ô công thức ${cell.e}, tự tính: muốn đổi công thức thì sửa trên Google Sheet.` : '';
}

/** Số thứ tự của `list` trong các danh sách thả xuống của trang tính (thêm vào nếu chưa có). */
function listIndex(sh, list) {
  const key = JSON.stringify(list);
  let at = sh.lists.findIndex((l) => JSON.stringify(l) === key);
  if (at < 0) {
    at = sh.lists.length;
    sh.lists.push(list);
  }
  return at;
}

/* ---------- Phiên đăng nhập ---------- */
function saveSession() {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: app.token, user: app.user, role: app.role })); } catch { /* private mode */ }
}

function readSession() {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (s && typeof s.token === 'string') {
      app.token = s.token;
      app.user = String(s.user || '');
      app.role = Object.hasOwn(ROLES, s.role) ? s.role : '';
    }
  } catch { /* private mode */ }
}

function clearSession() {
  app.token = '';
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* private mode */ }
}

function lastSheet() {
  try { return localStorage.getItem(SHEET_KEY) || ''; } catch { return ''; }
}

function rememberSheet(name) {
  try { localStorage.setItem(SHEET_KEY, name); } catch { /* private mode */ }
}

/** Mã ngẫu nhiên trình duyệt này tự giữ, gửi kèm khi đăng nhập (script chỉ lưu mã băm). Không lưu được thì gửi chuỗi rỗng. */
function deviceKey() {
  try {
    let key = localStorage.getItem(DEVICE_KEY) || '';
    if (!/^[\w-]{20,64}$/.test(key)) {
      key = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24)))).replace(/\+/g, '-').replace(/\//g, '_');
      localStorage.setItem(DEVICE_KEY, key);
    }
    return key;
  } catch {
    return '';
  }
}

/**
 * Gửi một việc tới Google Apps Script. Không ném lỗi: luôn trả { ok, error?, … }.
 * Phiên hết hạn (`login`) thì hiện khung đăng nhập lại, nội dung đang sửa vẫn giữ nguyên.
 */
async function api(action, body = {}, { background = false } = {}) {
  let text = '';
  try {
    // text/plain giữ yêu cầu ở dạng đơn giản: Apps Script không cần bước CORS preflight
    const res = await fetch(app.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ type: 'quan-tri', action, token: app.token, ...body }),
      signal: AbortSignal.timeout(60000),
    });
    text = await res.text();
  } catch {
    return { ok: false, error: 'Không kết nối được tới Google Sheet. Kiểm tra mạng rồi thử lại.' };
  }
  let out = null;
  try { out = JSON.parse(text); } catch { /* xem bên dưới */ }
  if (!out || typeof out !== 'object') {
    // Bản script cũ trả "invalid" cho việc nó chưa biết
    return {
      ok: false,
      error: text.trim() === 'invalid'
        ? 'Google Apps Script chưa có bản mới cho trang quản trị: dán script mới rồi triển khai phiên bản mới (README mục 6).'
        : 'Google Apps Script trả lời không đúng dạng. Thử lại sau ít phút.',
    };
  }
  // Tải ngầm (tải trước trang hay mở) gặp phiên hết hạn: để lần bấm tiếp theo của người dùng hiện khung đăng nhập
  if (out.login && !background) needLogin(out);
  return out;
}

/** Phiên hết hạn (hay trang quản trị vừa tắt): khung đăng nhập nổi lên, nội dung đang sửa không mất. */
function needLogin(out) {
  if (els.login.classList.contains('is-modal') && !app.token) return;
  clearSession();
  showLogin(out.error, true);
}

/* ---------- Đăng nhập ---------- */
function loginMessage(text, isError = true) {
  const msg = $('[data-login-msg]');
  msg.textContent = text || '';
  msg.classList.toggle('is-error', Boolean(text) && isError);
  msg.hidden = !text;
}

/** `again`: phiên vừa hết hạn khi đang làm việc: khung đăng nhập nổi lên trên, không mất nội dung đang sửa. */
function showLogin(message = '', again = false, isError = true) {
  els.boot.hidden = true;
  els.login.hidden = false;
  els.login.classList.toggle('is-modal', again && !els.work.hidden);
  app.step2 = null;
  els.codeForm.hidden = true;
  els.loginForm.hidden = false;
  loginMessage(message, isError);
  const form = els.loginForm;
  if (!form.elements.user.value && app.user) form.elements.user.value = app.user;
  (form.elements.user.value ? form.elements.pass : form.elements.user).focus();
}

function hideLogin() {
  els.login.hidden = true;
  els.login.classList.remove('is-modal');
}

async function onLogin(e) {
  e.preventDefault();
  const form = els.loginForm;
  const user = form.elements.user.value.trim();
  const pass = form.elements.pass.value;
  if (!user || !pass) {
    loginMessage('Nhập tên đăng nhập và mật khẩu.');
    (user ? form.elements.pass : form.elements.user).focus();
    return;
  }
  const button = $('[data-login-submit]');
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.textContent = 'Đang đăng nhập…';
  loginMessage('');
  const out = await api('dang-nhap', { user, pass, may: deviceKey(), ua: navigator.userAgent });
  button.disabled = false;
  button.removeAttribute('aria-busy');
  button.textContent = 'Đăng nhập';
  if (out.needCode) {
    form.elements.pass.value = '';
    showCode(out);
    return;
  }
  if (!out.ok) {
    loginMessage(out.error || 'Chưa đăng nhập được. Thử lại sau ít phút.');
    form.elements.pass.select();
    return;
  }
  form.elements.pass.value = '';
  loggedIn(out);
}

/* Bước 2: mã 6 số trong ứng dụng xác minh. Đủ 6 số là tự gửi; sai thì nhập lại, vé hết hạn thì về bước 1 */
function showCode(out) {
  app.step2 = { ticket: out.ticket, user: out.user };
  els.loginForm.hidden = true;
  els.codeForm.hidden = false;
  $('[data-code-user]').textContent = out.user;
  codeMessage('');
  els.codeForm.elements.code.value = '';
  els.codeForm.elements.code.focus();
}

function codeMessage(text) {
  const msg = $('[data-code-msg]');
  msg.textContent = text || '';
  msg.classList.toggle('is-error', Boolean(text));
  msg.hidden = !text;
}

function backToPassword(message = '') {
  app.step2 = null;
  els.codeForm.hidden = true;
  els.loginForm.hidden = false;
  loginMessage(message);
  els.loginForm.elements.pass.focus();
}

async function onCode(e) {
  e.preventDefault();
  if (!app.step2 || app.codeBusy) return;
  const input = els.codeForm.elements.code;
  const code = input.value.replace(/\D/g, '');
  if (code.length !== 6) {
    codeMessage('Nhập đủ 6 số đang hiện trong ứng dụng xác minh.');
    input.focus();
    return;
  }
  const button = $('[data-code-submit]');
  app.codeBusy = true;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.textContent = 'Đang kiểm tra…';
  codeMessage('');
  const out = await api('ma-2-buoc', { ticket: app.step2.ticket, code });
  app.codeBusy = false;
  button.disabled = false;
  button.removeAttribute('aria-busy');
  button.textContent = 'Xác nhận';
  if (out.ok) {
    input.value = '';
    app.step2 = null;
    loggedIn(out);
    return;
  }
  if (out.login) return; // api() đã hiện lại bước 1 với lý do (VD trang quản trị vừa bị tắt)
  if (out.restart) {
    backToPassword(out.error);
    return;
  }
  codeMessage(out.error || 'Chưa kiểm tra được mã. Thử lại sau ít phút.');
  input.select();
}

/** Đã đăng nhập (sau bước 1, hoặc bước 2 nếu có mã 2 bước): giữ phiên, mở trang tính hoặc quay lại việc đang làm. */
function loggedIn(out) {
  const again = els.login.classList.contains('is-modal');
  // Đăng nhập lại bằng tài khoản khác (VD trên máy dùng chung): bắt đầu lại từ đầu, không giữ phần của người trước
  const other = again && out.user !== app.user;
  app.token = out.token;
  app.user = out.user;
  app.role = Object.hasOwn(ROLES, out.role) ? out.role : 'admin';
  saveSession();
  hideLogin();
  showUser();
  if (!again || other) {
    closePanel();
    closeDrawer();
    if (other) {
      // Không để lại danh sách trang tính, dữ liệu của người trước trong lúc tải phần của người mới
      resetCache();
      app.doc = null;
      app.view = '';
      clearToasts();
      showMain('view');
      els.grid.textContent = '';
      els.tabs.textContent = '';
      els.views.hidden = true;
    }
    openHome();
  } else if (panel) {
    toast('Đã đăng nhập lại. Bấm Lưu lần nữa để ghi phần đang sửa.', { timeout: 6000 });
    $('[data-ap-save]', panel.el)?.focus();
  } else if (drawer) {
    toast('Đã đăng nhập lại. Bấm Lưu lần nữa.', { timeout: 6000 });
  } else if (app.view) {
    openView(app.view);
  } else {
    loadSheet(app.doc?.sheet?.name, { keepScroll: true, wait: true });
  }
}

/** Trang mở đầu tiên: seller vào mục hoa hồng (đơn của mình, nút lên đơn); người khác vào trang tính mở lần trước. */
function openHome() {
  if (app.role === 'seller') openView('hoa-hong');
  else loadSheet(lastSheet());
}

function showUser() {
  els.userName.textContent = app.user;
  els.userRole.textContent = app.role ? `(${ROLES[app.role]})` : '';
  els.userBox.hidden = !app.user;
}

async function logout() {
  const token = app.token;
  closePanel();
  closeDrawer();
  clearToasts();
  clearSession();
  resetCache();
  app.doc = null;
  app.view = '';
  slideSide(false, false);
  showWork(false);
  els.userBox.hidden = true;
  showLogin('Đã đăng xuất.', false, false);
  if (token) api('dang-xuat', { token });
}

/* ---------- Tải trang tính ---------- */
function setStatus(text, isError = false) {
  els.status.textContent = text || '';
  els.status.classList.toggle('is-error', isError);
  els.status.hidden = !text;
}

/** Khung làm việc cao đúng một màn hình và có logo riêng trong cột trái: ẩn đầu trang của web. */
function showWork(on) {
  els.work.hidden = !on;
  document.body.classList.toggle('is-working', on);
}

function bootError(text) {
  els.boot.hidden = false;
  $('[data-admin-boot-text]').textContent = text;
  if (!$('[data-boot-retry]')) {
    els.boot.insertAdjacentHTML('beforeend', '<button type="button" class="btn btn--ghost btn--sm" data-boot-retry>Thử lại</button>');
    $('[data-boot-retry]').addEventListener('click', () => location.reload());
  }
}

/* ---------- Nhớ trang đã mở, tải trước trang hay mở: chuyển trang không phải chờ script ---------- */
/** Bỏ mọi trang đã nhớ, lần tải đang chạy, lượt tải trước (đăng xuất, đổi tài khoản: không giữ dữ liệu của người trước). */
function resetCache() {
  app.gen++;
  app.cache.clear();
  app.inflight.clear();
  app.sheets = null;
  app.listAt = 0;
  app.prefetched = false;
}

/** Dấu vân tay của trả lời "doc" (trước khi prepare): bản mới giống hệt bản đang hiện thì không vẽ lại. */
function fingerprint(out) {
  const s = JSON.stringify([out.sheet, out.dashboard, out.me, out.url]);
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return `${s.length}:${h >>> 0}`;
}

/** Nhớ trả lời của một trang (trang mở lại gần nhất ở cuối; quá CACHE_MAX trang thì bỏ trang lâu nhất). */
function keep(name, out) {
  app.cache.delete(name);
  app.cache.set(name, out);
  while (app.cache.size > CACHE_MAX) app.cache.delete(app.cache.keys().next().value);
}

/**
 * Gọi "doc" cho trang `name`. Trang đó đang được tải (VD tải trước) thì dùng chung lần tải đó. Danh sách trang tính chỉ
 * xin lại khi đã cũ (LIST_MAX_AGE) hay `fresh` (bấm Tải lại: script cũng không dùng số liệu đã nhớ). Trả lời tốt được nhớ.
 */
function fetchDoc(name, { fresh = false, background = false } = {}) {
  const key = name || '';
  if (!fresh && app.inflight.has(key)) return app.inflight.get(key);
  const gen = app.gen;
  const body = { sheet: key };
  if (!fresh && app.sheets && Date.now() - app.listAt < LIST_MAX_AGE) body.list = false;
  if (fresh) body.fresh = true;
  const job = api('doc', body, { background }).then((out) => {
    if (app.inflight.get(key) === job) app.inflight.delete(key);
    if (gen !== app.gen || !out.ok) return out;
    if (out.sheets) {
      app.sheets = out.sheets;
      app.listAt = Date.now();
    } else {
      out.sheets = app.sheets || [];
    }
    out.at = new Date();
    out.fp = fingerprint(out);
    if (out.sheet) keep(out.sheet.name, out);
    return out;
  });
  app.inflight.set(key, job);
  return job;
}

/** Số lần mở mỗi trang tính trên trình duyệt này (theo tài khoản): tải trước trang hay mở nhất. */
function visits() {
  try { return JSON.parse(localStorage.getItem(`${VISITS_KEY}:${app.user}`) || '{}') || {}; } catch { return {}; }
}

function countVisit(name) {
  try {
    const v = visits();
    v[name] = (Number(v[name]) || 0) + 1;
    localStorage.setItem(`${VISITS_KEY}:${app.user}`, JSON.stringify(v));
  } catch { /* private mode */ }
}

/**
 * Mở xong trang đầu tiên: tải ngầm các trang hay mở (tối đa PREFETCH_MAX, 2 trang một lúc), để bấm sang là hiện ngay.
 * Không tải trước Tổng quan (script tính số liệu lúc mở) và trang đang ẩn trên Google Sheet. Mỗi lần đăng nhập một lần.
 */
function prefetch() {
  if (app.prefetched || !app.sheets?.length) return;
  app.prefetched = true;
  const gen = app.gen;
  const count = visits();
  const order = new Map(app.sheets.map((s, i) => [s.name, i]));
  const queue = app.sheets.filter((s) => !s.hidden && s.name !== DASH_NAME).map((s) => s.name)
    .sort((a, b) => (Number(count[b]) || 0) - (Number(count[a]) || 0) || order.get(a) - order.get(b))
    .slice(0, PREFETCH_MAX);
  const next = () => {
    if (gen !== app.gen || !app.token) return;
    // Người dùng đang chờ một trang: trang đó đi trước, tải ngầm đợi xong mới tiếp
    if (app.waiting) {
      setTimeout(next, 300);
      return;
    }
    const name = queue.shift();
    if (name === undefined) return;
    if (app.cache.has(name)) next();
    else fetchDoc(name, { background: true }).then(next, next);
  };
  setTimeout(() => { next(); next(); }, 1500);
}

const REFRESH_TEXT = 'Đang cập nhật dữ liệu mới nhất…';

/** Đang hiện bản đã nhớ và chờ bản mới: dòng báo nhỏ, lưới vẫn dùng được. */
function refreshing(on) {
  [els.grid, els.dash].forEach((el) => el.toggleAttribute('data-refreshing', on));
  if (on) setStatus(REFRESH_TEXT);
  else if (els.status.textContent === REFRESH_TEXT) setStatus('');
}

/**
 * Mở trang tính `name` (không có, hay tài khoản không xem được, thì trang đầu tiên tài khoản xem được). Trả true khi đã
 * hiện dữ liệu. `quiet`: chỉ lấy danh sách trang tính, vai trò (trước khi mở mục Hoa hồng, Tài khoản), không vẽ lưới.
 * Trang đã mở trong tab này thì hiện ngay bản đã nhớ, rồi tải bản mới ở dưới (khác thì vẽ lại, giữ chỗ đang cuộn). `wait`:
 * chờ bản mới (VD vừa thêm, xoá dòng); `fresh`: bấm Tải lại.
 */
async function loadSheet(name, { keepScroll = false, quiet = false, wait = false, fresh = false } = {}) {
  const ticket = ++app.ticket;
  const kept = !quiet && !wait && !fresh && name ? app.cache.get(name) : null;
  if (kept) {
    // Bấm từ một trang đang tải dở sang trang đã nhớ: bỏ trạng thái "đang tải" (lưới mờ) của lần trước
    els.grid.removeAttribute('aria-busy');
    els.dash.removeAttribute('aria-busy');
    showDoc(kept, { keepScroll });
    countVisit(kept.sheet.name);
    refreshing(true);
  } else {
    refreshing(false);
    setStatus(quiet ? 'Đang tải…' : 'Đang tải trang tính…');
    els.grid.setAttribute('aria-busy', 'true');
    els.dash.setAttribute('aria-busy', 'true');
  }
  app.waiting++;
  const out = await fetchDoc(name, { fresh }).finally(() => { app.waiting--; });
  if (ticket !== app.ticket) return false;
  if (kept) {
    refreshing(false);
    if (!out.ok) {
      if (out.login && app.token) needLogin(out);
      if (!out.login) setStatus(`Chưa tải được bản mới nhất (${out.error || 'thử lại sau ít phút'}): đang xem dữ liệu tải lúc ${timeText(kept.at)}.`, true);
      return true;
    }
    // Không đổi gì: giữ bản đang hiện (đã có các dòng vừa sửa); đang sửa một dòng: không vẽ lại dưới tay người dùng
    if (out.fp === kept.fp && out.sheet?.name === kept.sheet.name) {
      kept.at = out.at;
      app.loadedAt = out.at;
      keep(kept.sheet.name, kept);
      if (!app.view) renderInfoAgain();
      return true;
    }
    if (panel || drawer) return true;
    if (out.sheet?.name !== kept.sheet.name) app.cache.delete(kept.sheet.name); // trang đó vừa đổi tên, bị xoá hay không còn được xem
    showDoc(out, { keepScroll: out.sheet?.name === kept.sheet.name });
    prefetch();
    return true;
  }
  els.grid.removeAttribute('aria-busy');
  els.dash.removeAttribute('aria-busy');
  if (!out.ok) {
    // Trang này đang được tải ngầm thì lần tải đó không hiện khung đăng nhập: hiện ở đây
    if (out.login) {
      setStatus('');
      if (app.token) needLogin(out);
    }
    else if (app.doc) setStatus(out.error || 'Chưa tải được trang tính. Thử lại sau ít phút.', true);
    else bootError(out.error || 'Chưa tải được Google Sheet. Thử lại sau ít phút.');
    return false;
  }
  setStatus('');
  showDoc(out, { keepScroll, quiet });
  if (!quiet && out.sheet) countVisit(out.sheet.name);
  prefetch();
  return true;
}

/** "11:43" */
const timeText = (date) => (date ? date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '');

/** Vẽ lại dòng thông tin trang đang mở (giờ tải) mà không vẽ lại lưới. */
function renderInfoAgain() {
  const sh = app.doc?.sheet;
  if (!sh) return;
  renderInfo(...(app.counts || [0, 0]));
}

/** Hiện một trả lời "doc" (vừa tải hay đã nhớ): trang tính, Tổng quan, hay báo chưa được xem trang nào. */
function showDoc(out, { keepScroll = false, quiet = false } = {}) {
  const same = !quiet && !app.view && app.doc?.sheet && out.sheet && app.doc.sheet.name === out.sheet.name;
  // Trang Tổng quan: số liệu, biểu đồ thay cho lưới ô
  const view = out.dashboard ? els.dash : els.grid;
  const scroll = keepScroll && same ? { top: view.scrollTop, left: view.scrollLeft } : null;
  if (!same) app.query = '';
  app.doc = out;
  app.user = out.user || app.user;
  takeMe(out.me);
  app.loadedAt = out.at || new Date();
  if (out.sheet) {
    prepare(out.sheet);
    if (!quiet) rememberSheet(out.sheet.name);
  }
  els.boot.hidden = true;
  showWork(true);
  showUser();
  if (quiet) return;
  app.view = '';
  renderViews();
  renderTabs();
  renderTools();
  showMain(out.sheet ? (out.dashboard ? 'dash' : 'grid') : 'view');
  if (!out.sheet) {
    els.view.innerHTML = `<p class="dash-empty">Tài khoản của bạn chưa được xem trang tính nào. Báo admin của shop để được cấp quyền.</p>`;
    renderInfo(0, 0);
  } else if (out.dashboard) {
    renderDashboard(els.dash, out.dashboard, { onOpenSheet: (sheet) => loadSheet(sheet) });
    renderInfo(0, 0);
  } else {
    els.dash.textContent = '';
    renderGrid();
  }
  view.scrollTop = scroll ? scroll.top : 0;
  view.scrollLeft = scroll ? scroll.left : 0;
}

/** Vai trò script vừa báo (đổi vai trò thì script đã đăng xuất phiên cũ, đây chỉ để chắc chắn giao diện đúng). */
function takeMe(me) {
  if (!me || !Object.hasOwn(ROLES, me.role)) return;
  const changed = me.role !== app.role;
  app.role = me.role;
  app.order = Boolean(me.order);
  app.earns = Boolean(me.earns); // seller; manager có % quản lý hay được lên đơn: có mục Hoa hồng của tôi
  if (changed) saveSession();
}

/** Phần đang hiện ở khung chính: lưới trang tính, Tổng quan, hay một mục (Hoa hồng, Tài khoản, thông báo). */
function showMain(kind) {
  els.grid.hidden = kind !== 'grid';
  els.dash.hidden = kind !== 'dash';
  els.view.hidden = kind !== 'view';
  if (kind !== 'dash') els.dash.textContent = '';
  if (kind !== 'view') els.view.textContent = '';
}

/** Chỉ mục dòng, chữ để tìm, dòng tiêu đề cột của trang tính vừa tải. */
function prepare(sh) {
  sh.index = new Map(sh.rowNums.map((r, i) => [r, i]));
  sh.text = sh.cells.map(rowText);
  sh.headerRow = headerRowOf(sh);
  sh.webRows = new Set(sh.webRows || []);
  // Cột admin ẩn với tài khoản này: script không gửi nội dung, web không vẽ cột đó
  sh.hidden = new Set(sh.rules.hide || []);
  sh.shownCols = Array.from({ length: sh.cols }, (_, c) => c + 1).filter((c) => !sh.hidden.has(c));
  // Lựa chọn của script (VD Nền tảng: Shopee, Tiktok) cho ô chưa có ô thả xuống riêng trên Sheet
  sh.choice = Object.fromEntries(Object.entries(sh.rules.choices || {}).map(([col, list]) => [col, listIndex(sh, list)]));
  // Các dòng đầu đứng yên khi cuộn: tới dòng tiêu đề cột, nếu các dòng đó đều đang hiện
  let head = sh.headerRow && sh.headerRow <= MAX_STICKY_ROWS ? sh.headerRow : 0;
  while (head && sh.rowNums[head - 1] !== head) head--;
  sh.headRows = head;
}

const rowText = (cells) => plain((cells || []).map((c) => (c ? c.d ?? '' : '')).join(' '));

/**
 * Dòng chứa tên cột (0: không có): dòng cố định cuối cùng; trang tính script ghi đơn là dòng 1; còn lại là dòng 1
 * hoặc 2 (dưới một dòng tựa) nếu dòng đó chỉ có chữ, có ít nhất 2 ô và không có ô gộp.
 */
function headerRowOf(sh) {
  if (sh.frozen) return Math.min(sh.frozen, sh.rows);
  if (sh.rules.header) return 1;
  for (const r of [1, 2]) {
    const cells = (sh.index.has(r) && sh.cells[sh.index.get(r)]) || [];
    const filled = cells.filter((c) => c && c.d);
    const merged = sh.merges.some(([mr, , nr]) => mr <= r && r < mr + nr);
    if (filled.length >= 2 && filled.every((c) => !c.t) && !merged) return r;
    if (filled.length > 1) break;
  }
  return 0;
}

/* ---------- Cột trang tính, công cụ ---------- */
/** Mục Hoa hồng, Tài khoản (theo vai trò) và nút lên đơn của seller, manager, ở đầu cột trái. */
function renderViews() {
  const items = [];
  const label = { admin: 'Hoa hồng, lợi nhuận', seller: 'Đơn và hoa hồng của tôi', manager: 'Hoa hồng của tôi' }[app.role];
  if (app.role === 'admin' || app.role === 'seller' || app.earns) items.push(['hoa-hong', 'cash', label]);
  if (app.role === 'admin') items.push(['tai-khoan', 'shield', 'Tài khoản']);
  // Mở ngay trong tab này: trang đặt hàng đọc phiên của tab (sessionStorage) để ghi tên người lên đơn vào đơn
  const links = app.role !== 'admin' && app.order ? [['san-pham.html', 'cart', 'Lên đơn bộ xe'], ['in-3d.html', 'bag', 'Lên đơn In 3D']] : [];
  els.views.hidden = !items.length && !links.length;
  els.views.innerHTML = [
    ...items.map(([name, ic, label]) => `<button type="button" class="admin-tab admin-tab--view" data-view="${name}" aria-pressed="${app.view === name}">${icon(ic)}<span>${esc(label)}</span></button>`),
    ...links.map(([href, ic, label]) => `<a class="admin-tab admin-tab--view" href="${href}">${icon(ic)}<span>${esc(label)}</span></a>`),
  ].join('');
}

function renderTabs() {
  const current = app.view ? '' : app.doc.sheet?.name;
  const bar = els.tabs;
  const top = bar.scrollTop;
  const focused = bar.contains(document.activeElement);
  bar.innerHTML = (app.sheets || app.doc.sheets).map((s) => `
    <button type="button" class="admin-tab${s.hidden ? ' is-hidden' : ''}" data-sheet="${esc(s.name)}" aria-pressed="${s.name === current}"${s.hidden ? ' title="Trang tính đang ẩn trên Google Sheet"' : ''}>${esc(s.name.trim() || '(không tên)')}</button>`).join('');
  // Vẽ lại làm danh sách nhảy về đầu: giữ chỗ đang cuộn, trang đang mở bị khuất thì cuộn tới
  bar.scrollTop = top;
  const active = $('[aria-pressed="true"]', bar);
  if (!active) return;
  if (active.offsetTop < bar.scrollTop) bar.scrollTop = active.offsetTop;
  else if (active.offsetTop + active.offsetHeight > bar.scrollTop + bar.clientHeight) bar.scrollTop = active.offsetTop + active.offsetHeight - bar.clientHeight;
  if (focused) active.focus({ preventScroll: true });
}

/** Nút ☰ cho trình đọc màn hình biết cột trang tính đang mở hay ẩn. */
function syncMenu() {
  const open = WIDE.matches ? !els.work.classList.contains('is-collapsed') : els.side.classList.contains('is-open');
  els.menu.setAttribute('aria-expanded', String(open));
  els.menu.setAttribute('aria-label', `${open ? 'Ẩn' : 'Hiện'} danh sách trang tính`);
}

/** Màn hình hẹp: mở, đóng khung trượt. `focus`: đưa con trỏ vào khung khi mở, trả về nút ☰ khi đóng. */
function slideSide(open, focus = true) {
  els.side.classList.toggle('is-open', open);
  els.sideOverlay.classList.toggle('is-open', open);
  syncMenu();
  if (!focus) return;
  if (open) ($('[aria-pressed="true"]', els.tabs) || els.sideClose).focus({ preventScroll: true });
  else els.menu.focus({ preventScroll: true });
}

/** Nút ☰. Màn hình rộng: ẩn, hiện cột trái để lưới rộng hơn (nhớ cho lần sau). Màn hình hẹp: mở khung trượt. */
function toggleSide() {
  if (!WIDE.matches) {
    slideSide(!els.side.classList.contains('is-open'));
    return;
  }
  const hide = !els.work.classList.contains('is-collapsed');
  els.work.classList.toggle('is-collapsed', hide);
  try {
    if (hide) localStorage.setItem(SIDE_KEY, '1');
    else localStorage.removeItem(SIDE_KEY);
  } catch { /* private mode */ }
  syncMenu();
}

function renderTools() {
  const sh = app.doc.sheet;
  const grid = Boolean(sh) && !app.view;
  els.add.hidden = !grid || !sh.rules.add || !sh.cols;
  const url = grid && /^https:\/\/docs\.google\.com\//.test(app.doc.url || '') ? `${app.doc.url}#gid=${sh.id}` : '';
  els.open.hidden = !url;
  els.open.href = url || '#';
  if (els.search.value !== app.query) els.search.value = app.query;
  els.searchBox.hidden = !grid || Boolean(app.doc.dashboard);
}

/** Dòng tên, dòng thông tin ở đầu khung khi đang mở một mục (Hoa hồng, Tài khoản) thay cho trang tính. */
function renderViewInfo(title, facts = '') {
  els.info.innerHTML = `
    <p class="admin-info__name" title="${esc(title)}">${esc(title)}</p>
    <div class="admin-info__meta"><p class="admin-info__facts">${esc(facts)}</p></div>`;
  els.notes.textContent = '';
  els.notes.hidden = true;
}

function renderInfo(shown, total) {
  app.counts = [shown, total];
  const sh = app.doc.sheet;
  if (!sh) {
    renderViewInfo('Trang quản trị', ROLES[app.role] ? `Tài khoản ${ROLES[app.role]}` : '');
    return;
  }
  const time = timeText(app.loadedAt);
  const took = typeof app.doc.ms === 'number' ? ` title="Script trả lời sau ${(app.doc.ms / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} giây"` : '';
  const q = app.query.trim();
  const unit = sh.rules.own ? 'đơn của bạn' : 'dòng';
  const facts = app.doc.dashboard ? [`số liệu lúc ${esc(app.doc.dashboard.updated)}`]
    : [q ? `Đang lọc: ${shown}/${total} ${unit} có “${esc(q)}”` : `${total} ${unit}`, `${sh.shownCols.length} cột`, time && `<span${took}>tải lúc ${time}</span>`].filter(Boolean);
  const admin = app.role === 'admin';
  const notes = [];
  if (sh.rules.own) notes.push('Chỉ hiện các đơn bạn lên: đơn có cột Seller là tên tài khoản của bạn.');
  if (sh.rules.viewOnly) notes.push('Tài khoản của bạn chỉ xem trang tính này. Cần sửa thì báo admin.');
  if (sh.hidden.size) notes.push('Một số cột admin không cho tài khoản của bạn xem.');
  if (sh.rules.tip) notes.push(esc(sh.rules.tip));
  else if (sh.rules.all && !sh.rules.viewOnly) notes.push('Trang tính này chỉ xem trên web.');
  if (sh.rules.header && admin) notes.push('Dòng 1 là tên cột: script dựa vào đó để ghi đơn, nên chỉ đổi tên cột trên Google Sheet.');
  const locked = sh.rules.cols.filter((c) => !sh.hidden.has(c)).map(colName).join(', ');
  if (locked && (admin || !sh.rules.all)) notes.push(`Cột ${locked} do script tự điền${admin ? '' : ' hoặc chỉ admin sửa'}: chỉ xem.`);
  if (sh.images) notes.push(`Có ${sh.images} hình ảnh đặt trên trang tính: xem trên Google Sheet.`);
  if (app.doc.dashboard && admin) notes.push('Trên Google Sheet, trang Tổng quan có cùng số liệu và biểu đồ của Google.');
  const shownRows = sh.cells.length - sh.headRows;
  if (!app.doc.dashboard && !sh.rules.own && sh.rows - sh.headRows > shownRows) {
    notes.push(`Trang tính lớn: chỉ hiện ${shownRows} dòng ${sh.rules.top ? 'đầu (mới nhất)' : 'cuối'}, dòng cũ hơn xem trên Google Sheet.`);
  }
  if (sh.rules.top && !sh.rules.own) notes.push('Dòng mới nhất ở trên cùng: đơn, yêu cầu, mã, dòng thêm trên web đều chèn ngay dưới dòng tiêu đề.');
  els.info.innerHTML = `
    <p class="admin-info__name" title="${esc(sh.name)}">${esc(sh.name)}</p>
    <div class="admin-info__meta">
      <p class="admin-info__facts">${facts.join(' · ')}</p>
      ${notes.length ? `<button type="button" class="admin-info__more" data-admin-notes-toggle aria-controls="admin-notes" aria-expanded="${app.notesOpen}">${icon('info', 'icon--sm')}Lưu ý (${notes.length})</button>` : ''}
    </div>`;
  els.notes.innerHTML = notes.map((n) => `<p class="admin-notes__item">${icon('info', 'icon--sm')}<span>${n}</span></p>`).join('');
  els.notes.hidden = !app.notesOpen || !notes.length;
}

/* ---------- Lưới trang tính ---------- */
/** Ô gộp trên các dòng đang hiện: chỉ gộp các dòng liền nhau, cùng phần tiêu đề hoặc cùng phần nội dung. */
function mergeMap(sh) {
  const spans = new Map();
  const covered = new Set();
  sh.merges.forEach(([r, c, nr, nc]) => {
    if (!sh.index.has(r)) return;
    const i = sh.index.get(r);
    const head = i < sh.headRows;
    let rows = 1;
    while (rows < nr && sh.rowNums[i + rows] === r + rows && (i + rows < sh.headRows) === head) rows++;
    const cols = Math.min(nc, sh.cols - c + 1);
    if (rows === 1 && cols === 1) return;
    spans.set(`${r}:${c}`, { rows, cols });
    for (let dr = 0; dr < rows; dr++) {
      for (let dc = 0; dc < cols; dc++) if (dr || dc) covered.add(`${r + dr}:${c + dc}`);
    }
  });
  return { spans, covered };
}

function cellHtml(cell, col, span) {
  const cls = [];
  let style = '';
  if (cell) {
    if (HEX.test(cell.bg || '')) style += `background-color:${cell.bg};`;
    if (HEX.test(cell.fc || '')) style += `color:${cell.fc};`;
    if (cell.b) cls.push('is-bold');
    if (cell.t === 'n' || cell.t === 'd') cls.push('is-num');
  }
  let inner = '';
  if (cell && cell.v === 'c') {
    const on = editOf(cell) === 'TRUE';
    inner = `<span class="sheet__check${on ? ' is-on' : ''}" role="img" aria-label="${on ? 'Đã tích' : 'Chưa tích'}"></span>`;
  } else if (cell && typeof cell.v === 'number' && cell.d) {
    inner = `<span class="sheet__chip">${esc(cell.d)}</span>`;
  } else if (cell && cell.t === 'o') {
    inner = '<span class="sheet__muted">[Hình ảnh]</span>';
  } else if (cell && cell.d) {
    inner = `<div class="sheet__cell">${esc(cell.d)}</div>`;
  }
  const attrs = [`data-col="${col}"`];
  if (cls.length) attrs.push(`class="${cls.join(' ')}"`);
  if (style) attrs.push(`style="${style}"`);
  if (span && span.rows > 1) attrs.push(`rowspan="${span.rows}"`);
  if (span && span.cols > 1) attrs.push(`colspan="${span.cols}"`);
  if (cell && cell.n) attrs.push(`title="${esc(cell.n)}"`);
  return `<td ${attrs.join(' ')}>${inner}${cell && cell.n ? '<span class="sheet__note" aria-hidden="true"></span>' : ''}</td>`;
}

function rowHtml(sh, i, merges) {
  const r = sh.rowNums[i];
  const cells = sh.cells[i] || [];
  const out = [`<tr data-row="${r}"${panel && panel.row === r ? ' class="is-active"' : ''}>`,
    `<th scope="row"><button type="button" class="sheet__num" data-open="${r}" aria-label="Mở dòng ${r}">${r}</button></th>`];
  for (const c of sh.shownCols) {
    const key = `${r}:${c}`;
    if (merges && merges.covered.has(key)) continue;
    out.push(cellHtml(cells[c - 1], c, merges && merges.spans.get(key)));
  }
  out.push('</tr>');
  return out.join('');
}

function renderGrid() {
  const sh = app.doc.sheet;
  if (!sh.rows || !sh.cols) {
    els.grid.innerHTML = '<p class="admin-empty">Trang tính này chưa có dữ liệu.</p>';
    renderInfo(0, 0);
    return;
  }
  const q = plain(app.query.trim());
  const body = [];
  for (let i = sh.headRows; i < sh.cells.length; i++) if (!q || sh.text[i].includes(q)) body.push(i);
  const merges = q ? null : mergeMap(sh); // đang lọc thì các dòng không liền nhau: bỏ gộp ô
  // Cột đã chỉnh độ rộng trên Sheet (VD trang nhập từ Excel): giữ đúng tỷ lệ. Cột mặc định (100px): rộng theo chữ
  const widths = sh.widths.length === sh.cols && sh.widths.some((w) => w !== 100)
    ? sh.widths.map((w) => Math.round(clamp(w, 40, 480))) : null;
  const cols = sh.shownCols;
  // Seller chỉ thấy đơn của mình: các dòng không liền nhau, không có "dòng cũ hơn" để xem trên Google Sheet
  const gaps = !q && !sh.rules.own;
  const span = cols.length + 1;

  const html = [widths ? `<table class="sheet sheet--fixed" style="width:${cols.reduce((a, c) => a + widths[c - 1], 52)}px">` : '<table class="sheet">',
    `<colgroup><col class="sheet__numcol">${cols.map((c) => (widths ? `<col style="width:${widths[c - 1]}px">` : '<col>')).join('')}</colgroup>`,
    '<thead><tr class="sheet__letters"><th class="sheet__corner" scope="col"><span class="sr-only">Dòng</span></th>',
    ...cols.map((c) => `<th scope="col">${colName(c)}</th>`), '</tr>'];
  for (let i = 0; i < sh.headRows; i++) html.push(rowHtml(sh, i, merges));
  html.push('</thead><tbody>');
  let prev = sh.headRows ? sh.rowNums[sh.headRows - 1] : 0;
  body.forEach((i) => {
    const r = sh.rowNums[i];
    if (gaps && r > prev + 1) {
      html.push(`<tr class="sheet__gap"><td colspan="${span}">… ${r - prev - 1} dòng cũ hơn: xem trên Google Sheet</td></tr>`);
    }
    html.push(rowHtml(sh, i, merges));
    prev = r;
  });
  // Trang mới nhất ở trên, quá lớn: các dòng cũ hơn nằm sau dòng cuối đang hiện
  if (gaps && body.length && prev < sh.rows) {
    html.push(`<tr class="sheet__gap"><td colspan="${span}">… ${sh.rows - prev} dòng cũ hơn: xem trên Google Sheet</td></tr>`);
  }
  if (!body.length) {
    const none = sh.rules.own ? 'Chưa có đơn nào bạn lên.' : 'Chưa có dòng dữ liệu nào.';
    html.push(`<tr class="sheet__gap"><td colspan="${span}">${q ? 'Không có dòng nào khớp.' : none}</td></tr>`);
  }
  html.push('</tbody></table>');
  els.grid.innerHTML = html.join('');
  stickHead();
  renderInfo(body.length, sh.rows - sh.headRows);
}

/** Dòng chữ cột A, B, C… và các dòng tiêu đề đứng yên khi cuộn: mỗi dòng nằm ngay dưới dòng trên nó. */
function stickHead() {
  let top = 0;
  $$('thead tr', els.grid).forEach((tr) => {
    $$(':scope > th, :scope > td', tr).forEach((cell) => { cell.style.top = `${top}px`; });
    top += tr.offsetHeight;
  });
}

/** Cập nhật một dòng theo trả lời của script sau khi lưu (danh sách thả xuống được gộp vào danh sách của trang). */
function mergeRow(sh, rowNum, fresh) {
  const i = sh.index.get(rowNum);
  if (i === undefined || !fresh) return;
  const remap = (v) => (typeof v === 'number' ? listIndex(sh, fresh.lists[v]) : v);
  sh.cells[i] = fresh.cells.slice(0, sh.cols).map((c) => (c && c.v !== undefined ? { ...c, v: remap(c.v) } : c));
  sh.hashes[i] = fresh.hash;
  sh.text[i] = rowText(sh.cells[i]);
  if (fresh.web) sh.webRows.add(rowNum);
  else sh.webRows.delete(rowNum);
}

/* ---------- Khung xem, sửa, thêm một dòng ---------- */
function labelOf(sh, col) {
  const head = sh.headerRow && sh.index.has(sh.headerRow) ? sh.cells[sh.index.get(sh.headerRow)] : null;
  const name = head && head[col - 1] && head[col - 1].d ? head[col - 1].d.replace(/\s+/g, ' ').trim() : '';
  return name ? `${colName(col)} · ${name}` : `Cột ${colName(col)}`;
}

/** Các cột của dòng `row` nằm trong một ô gộp mà không phải ô đầu: nội dung nằm ở ô đầu của vùng gộp. */
function coveredCols(sh, row) {
  const out = new Set();
  sh.merges.forEach(([r, c, nr, nc]) => {
    if (row < r || row >= r + nr) return;
    for (let x = c; x < c + nc; x++) if (row !== r || x !== c) out.add(x);
  });
  return out;
}

/** Dòng mẫu khi thêm dòng: ô tích, ô thả xuống lấy theo dòng sẽ nằm kề dòng mới (dòng dữ liệu đầu hoặc cuối hiện có). */
function templateRow(sh) {
  const i = sh.rules.top ? sh.headRows : sh.cells.length - 1;
  return i >= sh.headRows && i < sh.cells.length && sh.rowNums[i] > (sh.headerRow || 1) ? sh.cells[i] : [];
}

function nowText() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function buildFields(sh, mode, row, i) {
  const cells = mode === 'edit' ? sh.cells[i] || [] : [];
  const covered = mode === 'edit' ? coveredCols(sh, row) : new Set();
  const template = mode === 'add' ? templateRow(sh) : [];
  const fields = [];
  for (const c of sh.shownCols) {
    if (covered.has(c)) continue;
    const cell = cells[c - 1] || null;
    const label = labelOf(sh, c);
    const own = mode === 'add' ? template[c - 1]?.v : cell?.v;
    const v = own ?? sh.choice[c];
    const why = lockOf(sh, mode === 'add' ? sh.rows + 1 : row, c, cell);
    let original = editOf(cell);
    if (mode === 'add') {
      // Ô thả xuống của Sheet lấy lựa chọn đầu (VD Trạng thái "Mới"); lựa chọn của script để trống cho shop tự chọn
      const list = typeof own === 'number' ? sh.lists[own] : null;
      original = / · Thời gian$/.test(label) && sh.kinds[c - 1] === 'd' ? nowText() : list && list.length ? list[0] : '';
    }
    const list = typeof v === 'number' ? sh.lists[v] || [] : null;
    fields.push({
      col: c, cell, label, v, list, locked: Boolean(why), why, kind: sh.kinds[c - 1] || '',
      qty: Boolean(list) && Boolean(sh.rules.qty?.includes(c)),
      original: v === 'c' ? original === 'TRUE' : original,
      empty: mode === 'edit' && !editOf(cell) && !(cell && cell.n),
    });
  }
  return fields;
}

function controlHtml(sh, f) {
  const id = `ap-f${f.col}`;
  if (f.locked) {
    const text = f.cell?.t === 'o' ? '[Hình ảnh trong ô: xem trên Google Sheet]' : f.cell?.d || '—';
    return `<div class="admin-field__value" id="${id}">${esc(text)}</div>`;
  }
  if (f.v === 'c') {
    return `<label class="check admin-field__check"><input type="checkbox" id="${id}" data-col="${f.col}"> <span>Đã tích</span></label>`;
  }
  const list = f.list;
  if (list) {
    // Giá trị đang có ngoài danh sách được thêm bằng JS lúc mở khung (openPanel): giữ đúng từng ký tự, kể cả xuống dòng
    const select = `<select class="field__input" id="${id}" data-col="${f.col}"${f.qty ? ' data-product' : ''}>
      <option value="">(để trống)</option>
      ${list.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}
    </select>`;
    if (!f.qty) return select;
    return `<div class="admin-product">${select}
      <label class="admin-product__qty"><span>SL</span><input class="field__input" type="number" inputmode="numeric" min="1" max="99" step="1" data-qty="${f.col}" aria-label="Số lượng"></label>
    </div>`;
  }
  // Ô công thức luôn chỉ xem (lockOf): ô sửa được là chữ, số hoặc ngày
  const hint = f.kind === 'd' || f.cell?.t === 'd' ? 'dd/mm/yyyy hh:mm' : '';
  const numeric = f.cell?.t === 'n' || (!f.cell && f.kind === 'n');
  return `<textarea class="field__input admin-field__input" id="${id}" data-col="${f.col}" rows="1"${numeric ? ' inputmode="decimal"' : ''}${hint ? ` placeholder="${esc(hint)}"` : ''} spellcheck="false"></textarea>`;
}

function fieldHtml(sh, f) {
  const hints = [];
  if (f.locked && f.cell?.t !== 'o') hints.push(`${icon('lock', 'icon--sm')}<span>${esc(f.why)}</span>`);
  if (f.cell?.n) hints.push(`<span>Ghi chú: ${esc(f.cell.n)}</span>`);
  return `
    <div class="admin-field" data-field="${f.col}"${f.empty ? ' data-empty' : ''}>
      ${f.locked ? `<p class="field__label">${esc(f.label)}</p>` : `<label class="field__label" for="ap-f${f.col}">${esc(f.label)}</label>`}
      ${controlHtml(sh, f)}
      ${hints.map((h) => `<p class="admin-field__hint">${h}</p>`).join('')}
    </div>`;
}

function inputOf(f) {
  return panel && $(`[data-col="${f.col}"]`, panel.el);
}

/** Các ô đã đổi so với lúc mở khung: [{ col, value }] (ô tích: true/false). */
function changes() {
  if (!panel) return [];
  return panel.fields.map((f) => {
    const value = fieldValue(f);
    return value === null || value === f.original ? null : { col: f.col, value };
  }).filter(Boolean);
}

/* Ô chọn sản phẩm kèm số lượng (VD "Sản phẩm" ở Đơn hàng): ghi "tên × số lượng" như đơn web (saveOrder_ trong script) */
const QTY_RE = /^(.+) × (\d{1,2})$/;

/** Sản phẩm đang ghi trong ô, nếu đúng dạng "tên trong danh sách × số lượng": { name, qty }. */
function productOf(f) {
  const m = f.qty && QTY_RE.exec(String(f.original || ''));
  return m && f.list.includes(m[1]) ? { name: m[1], qty: Number(m[2]) } : null;
}

/** Số lượng chỉ dùng được khi đã chọn một sản phẩm trong danh sách. */
function syncQty(select) {
  const qty = $(`[data-qty="${select.dataset.col}"]`, panel.el);
  const f = panel.fields.find((x) => x.col === Number(select.dataset.col));
  if (qty && f) qty.disabled = !f.list.includes(select.value);
}

/** Giá trị sẽ ghi của một ô trong khung (ô tích: true/false); ô chỉ xem: null. */
function fieldValue(f) {
  const input = inputOf(f);
  if (!input || f.locked) return null;
  if (input.type === 'checkbox') return input.checked;
  if (f.qty && f.list.includes(input.value)) {
    const n = Math.round(Number($(`[data-qty="${f.col}"]`, panel.el)?.value));
    return `${input.value} × ${Number.isFinite(n) ? Math.min(99, Math.max(1, n)) : 1}`;
  }
  return input.value;
}

function autosize(ta) {
  ta.style.height = 'auto';
  ta.style.height = `${ta.scrollHeight + 2}px`;
}

/**
 * Mở khung bên phải. mode "edit": xem, sửa dòng `row` (bấm vào ô nào thì con trỏ ở ô đó); "add": thêm dòng mới.
 * `notice`: lời nhắc ở đầu khung (VD vừa không lưu được vì dòng đã đổi), `typed`: nội dung đã gõ lúc đó để gõ lại.
 */
function openPanel(mode, row = 0, focusCol = 0, { notice = '', typed = [] } = {}) {
  if (!app.doc) return;
  closePanel();
  const sh = app.doc.sheet;
  const i = mode === 'edit' ? sh.index.get(row) : -1;
  if (i === undefined) return;
  const fields = buildFields(sh, mode, row, i);
  const readOnly = fields.every((f) => f.locked);
  const hasHeader = Boolean(sh.headerRow);
  const empties = fields.filter((f) => f.empty && f.col !== focusCol).length;
  const subtitle = mode === 'edit'
    ? [sh.name, ...fields.filter((f) => f.cell?.d && f.cell.t !== 'd').slice(0, 2).map((f) => f.cell.d.replace(/\s+/g, ' ').slice(0, 40))]
    : [sh.name];
  const canDelete = mode === 'edit' && sh.rules.del && !(sh.rules.header && row === 1);

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const el = document.createElement('aside');
  el.className = 'drawer drawer--wide admin-panel';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'ap-title');
  el.innerHTML = `
    <div class="drawer__head">
      <div class="admin-panel__titles">
        <h2 class="drawer__title" id="ap-title">${mode === 'add' ? 'Thêm dòng mới' : `Dòng ${row}`}</h2>
        <p class="admin-panel__sub">${esc(subtitle.join(' · '))}</p>
      </div>
      <button type="button" class="icon-btn" data-ap-close aria-label="Đóng">${icon('close')}</button>
    </div>
    <div class="drawer__body admin-panel__body">
      ${notice ? `<div class="admin-notice" role="alert"><p>${esc(notice)}</p>${typed.length ? `<p>Nội dung bạn vừa gõ:</p><ul>${typed.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}</div>` : ''}
      ${mode === 'add' ? `<p class="admin-panel__intro">Dòng mới được thêm vào ${sh.rules.top ? 'đầu trang tính, ngay dưới dòng tiêu đề' : 'cuối trang tính'}. Ô để trống thì bỏ qua.</p>` : ''}
      <div class="admin-fields${hasHeader || mode === 'add' ? '' : ' is-compact'}">${fields.map((f) => fieldHtml(sh, f)).join('')}</div>
      ${mode === 'edit' && !hasHeader && empties ? `<button type="button" class="link-arrow admin-panel__more" data-ap-empty aria-expanded="false">Hiện ${empties} ô trống</button>` : ''}
    </div>
    <div class="drawer__foot admin-panel__foot">
      <div class="send-error" data-ap-error hidden tabindex="-1"></div>
      <div class="admin-confirm" data-ap-confirm hidden>
        <p data-ap-confirm-text></p>
        <div class="admin-confirm__actions">
          <button type="button" class="btn btn--sm btn--danger" data-ap-confirm-ok></button>
          <button type="button" class="btn btn--ghost btn--sm" data-ap-confirm-no>Quay lại</button>
        </div>
      </div>
      <div class="admin-panel__actions" data-ap-actions>
        ${canDelete ? `<button type="button" class="btn btn--ghost btn--sm admin-panel__delete" data-ap-delete>${icon('trash')} Xoá dòng</button>` : ''}
        <button type="button" class="btn btn--ghost btn--sm" data-ap-cancel>${readOnly ? 'Đóng' : 'Huỷ'}</button>
        ${readOnly ? '' : `<button type="button" class="btn btn--primary btn--sm" data-ap-save>${mode === 'add' ? 'Thêm dòng' : 'Lưu thay đổi'}</button>`}
      </div>
    </div>`;

  panel = { el, overlay, mode, row, index: i, sheet: sh.name, hash: mode === 'edit' ? sh.hashes[i] : sh.hashes[0] || '', fields, busy: false, onConfirm: null };
  document.body.append(overlay, el);

  // Giá trị gán bằng JS (không qua HTML) để giữ đúng xuống dòng, dấu cách ở đầu
  fields.forEach((f) => {
    const input = inputOf(f);
    if (!input) return;
    if (input.type === 'checkbox') {
      input.checked = f.original === true;
    } else if (f.list) {
      const picked = productOf(f);
      const value = picked ? picked.name : f.original;
      if (value && !f.list.includes(value)) input.add(new Option(`${value} (ngoài danh sách)`, value));
      input.value = value;
      if (f.qty) $(`[data-qty="${f.col}"]`, el).value = picked ? picked.qty : 1;
    } else {
      input.value = f.original;
    }
  });
  panel.fields.forEach((f) => { if (f.qty && !f.locked) syncQty(inputOf(f)); });
  if (!hasHeader && mode === 'edit') {
    $$('[data-empty]', el).forEach((box) => { if (Number(box.dataset.field) !== focusCol) box.hidden = true; });
  }
  $$('textarea', el).forEach(autosize);
  $(`tr[data-row="${row}"]`, els.grid)?.classList.add('is-active');

  el.addEventListener('change', (e) => {
    if (e.target.matches('[data-product]')) syncQty(e.target);
  });
  el.addEventListener('input', (e) => {
    if (e.target.tagName === 'TEXTAREA') autosize(e.target);
    const error = $('[data-ap-error]', el);
    if (!error.hidden) error.hidden = true; // gõ tiếp thì bỏ lời nhắc cũ (VD "Dòng mới còn trống")
  });
  el.addEventListener('click', onPanelClick);
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      requestClose();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      save();
    } else {
      trapFocus(el, e);
    }
  });
  overlay.addEventListener('click', requestClose);

  document.documentElement.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    overlay.classList.add('is-open');
    el.classList.add('is-open');
    const target = (focusCol && $(`#ap-f${focusCol}`, el)) || $('textarea, select, input', el) || $('[data-ap-close]', el);
    target.focus({ preventScroll: true });
    target.scrollIntoView?.({ block: 'nearest' });
  });
}

function onPanelClick(e) {
  const t = e.target.closest('button');
  if (!t || !panel || panel.busy) return;
  if (t.matches('[data-ap-close], [data-ap-cancel]')) requestClose();
  else if (t.matches('[data-ap-save]')) save();
  else if (t.matches('[data-ap-delete]')) {
    confirmBox(`Xoá hẳn dòng ${panel.row} khỏi trang tính “${panel.sheet}”? Nội dung dòng này được lưu lại ở trang “${app.doc.log}”.`, 'Xoá dòng', doDelete);
  } else if (t.matches('[data-ap-empty]')) {
    const open = t.getAttribute('aria-expanded') !== 'true';
    $$('[data-empty]', panel.el).forEach((box) => { box.hidden = !open; });
    t.setAttribute('aria-expanded', String(open));
    t.textContent = open ? 'Ẩn các ô trống' : `Hiện ${$$('[data-empty]', panel.el).length} ô trống`;
  } else if (t.matches('[data-ap-confirm-ok]')) {
    const fn = panel.onConfirm;
    confirmBox('');
    fn?.();
  } else if (t.matches('[data-ap-confirm-no]')) {
    confirmBox('');
  }
}

/** Hỏi lại ngay trong khung (không dùng hộp thoại của trình duyệt). text rỗng: đóng phần hỏi. */
function confirmBox(text, okLabel = '', onOk = null) {
  const box = $('[data-ap-confirm]', panel.el);
  const actions = $('[data-ap-actions]', panel.el);
  panel.onConfirm = onOk;
  box.hidden = !text;
  actions.hidden = Boolean(text);
  if (!text) return;
  $('[data-ap-confirm-text]', box).textContent = text;
  $('[data-ap-confirm-ok]', box).textContent = okLabel;
  $('[data-ap-confirm-no]', box).focus();
}

function panelError(text) {
  const box = $('[data-ap-error]', panel.el);
  box.hidden = !text;
  box.innerHTML = text ? `<p class="send-error__text">${icon('info', 'icon--md')}<span>${esc(text)}</span></p>` : '';
  if (text) box.focus();
}

/** Đang gửi: khoá cả khung; nút `which` hiện `label` (VD "Đang lưu…"). */
function setBusy(on, label = '', which = '[data-ap-save]') {
  panel.busy = on;
  $$('button, input, select, textarea', panel.el).forEach((x) => { x.disabled = on; });
  const btn = $(which, panel.el);
  if (!btn) return;
  if (on) {
    btn.dataset.label = btn.innerHTML;
    btn.textContent = label;
    btn.setAttribute('aria-busy', 'true');
  } else {
    if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
    btn.removeAttribute('aria-busy');
  }
}

function requestClose() {
  if (!panel || panel.busy) return;
  if (changes().length) {
    confirmBox('Đóng mà không lưu? Các thay đổi vừa gõ sẽ mất.', 'Bỏ thay đổi', closePanel);
    return;
  }
  closePanel();
}

function closePanel() {
  if (!panel) return;
  const p = panel;
  panel = null;
  p.overlay.classList.remove('is-open');
  p.el.classList.remove('is-open');
  setTimeout(() => {
    p.overlay.remove();
    p.el.remove();
  }, 300);
  document.documentElement.style.overflow = '';
  $$('tr.is-active', els.grid).forEach((tr) => tr.classList.remove('is-active'));
  if (p.mode === 'edit') $(`[data-open="${p.row}"]`, els.grid)?.focus({ preventScroll: true });
  else if (!els.add.hidden) els.add.focus({ preventScroll: true });
}

/** Mô tả nội dung đã gõ (để gõ lại sau khi trang tính vừa thay đổi). */
function describe(list) {
  const sh = app.doc.sheet;
  return list.map(({ col, value }) => `${labelOf(sh, col)}: ${value === true ? 'đã tích' : value === false ? 'bỏ tích' : value}`);
}

/** Script không ghi: phiên hết hạn (khung đăng nhập đã hiện), dòng đã đổi (tải lại rồi mở lại khung), hoặc lỗi khác. */
async function onFail(out, typed) {
  if (out.login) {
    panelError('Phiên đăng nhập đã hết hạn: đăng nhập lại rồi bấm Lưu lần nữa. Nội dung đang sửa vẫn còn.');
    return;
  }
  if (!out.conflict) {
    panelError(out.error || 'Chưa lưu được. Thử lại sau ít phút.');
    return;
  }
  const { mode, row, sheet } = panel;
  const notes = describe(typed);
  closePanel();
  if (!(await loadSheet(sheet, { keepScroll: true, wait: true }))) {
    setStatus(out.error, true);
    return;
  }
  // Admin vừa bỏ quyền xem trang này: web đã mở trang khác
  if (app.doc.sheet?.name !== sheet) toast(out.error, { timeout: 8000 });
  else if (mode === 'add') openPanel('add', 0, 0, { notice: out.error, typed: notes });
  else if (app.doc.sheet.index.has(row)) openPanel('edit', row, 0, { notice: out.error, typed: notes });
  else toast(out.error, { timeout: 8000 });
}

async function save() {
  if (!panel || panel.busy) return;
  panelError('');
  const sh = app.doc.sheet;
  const { mode, row } = panel;
  if (mode === 'add') {
    // values[c - 1] là ô của cột c; cột admin ẩn với tài khoản này không có trong khung, gửi rỗng
    const values = Array.from({ length: sh.cols }, () => '');
    panel.fields.forEach((f) => { values[f.col - 1] = fieldValue(f) ?? ''; });
    const typed = panel.fields.map((f) => ({ col: f.col, value: values[f.col - 1], preset: values[f.col - 1] === f.original }))
      .filter((x) => x.value !== '' && x.value !== false);
    if (!typed.some((x) => !x.preset)) {
      panelError('Dòng mới còn trống: điền ít nhất một ô (ngoài các ô điền sẵn).');
      return;
    }
    setBusy(true, 'Đang thêm…');
    const out = await api('them', { sheet: sh.name, head: panel.hash, values });
    setBusy(false);
    if (!out.ok) {
      onFail(out, typed);
      return;
    }
    closePanel();
    app.cache.delete(DASH_NAME);
    toast(`Đã thêm dòng ${out.row} vào “${sh.name}”.`);
    if (await loadSheet(sh.name, { keepScroll: true, wait: true })) {
      $(`tr[data-row="${out.row}"]`, els.grid)?.scrollIntoView({ block: 'center' });
    }
    return;
  }

  const list = changes();
  if (!list.length) {
    panelError('Chưa có thay đổi nào.');
    return;
  }
  setBusy(true, 'Đang lưu…');
  const out = await api('sua', { sheet: sh.name, row, hash: panel.hash, cells: list });
  setBusy(false);
  if (!out.ok) {
    onFail(out, list);
    return;
  }
  closePanel();
  if (out.saved) {
    mergeRow(sh, row, out.row);
    app.cache.delete(DASH_NAME);
  }
  renderGrid();
  if (out.message) toast(`Đã lưu dòng ${row}. Lưu ý: ${out.message}`, { timeout: 9000 });
  else toast(out.saved ? `Đã lưu dòng ${row}.` : 'Nội dung giống hệt trên Sheet: không có gì thay đổi.');
  // Công thức ở dòng khác có thể đổi theo; gán mã tải code đổi màu ô ở dòng khác
  if (out.saved && (out.reload || sh.formulas || (out.row && out.row.cells.length > sh.cols))) {
    loadSheet(sh.name, { keepScroll: true, wait: true });
  }
}

async function doDelete() {
  const sh = app.doc.sheet;
  const { row } = panel;
  setBusy(true, 'Đang xoá…', '[data-ap-delete]');
  const out = await api('xoa', { sheet: sh.name, row, hash: panel.hash });
  setBusy(false);
  if (!out.ok) {
    onFail(out, []);
    return;
  }
  closePanel();
  app.cache.delete(DASH_NAME);
  toast(`Đã xoá dòng ${row}. Nội dung được lưu ở trang “${app.doc.log}”.`, { timeout: 6000 });
  loadSheet(sh.name, { keepScroll: true, wait: true });
}

/* ---------- Mục Hoa hồng, Tài khoản (thay cho lưới trang tính) ---------- */
const VIEWS = {
  'hoa-hong': { action: 'hoa-hong', render: (out) => renderCommission(out) },
  'tai-khoan': { action: 'tai-khoan', render: (out) => renderAccounts(out) },
};
const STATES = { wait: 'Đang chờ', due: 'Chưa trả', paid: 'Đã trả', cancelled: 'Đơn huỷ' };
const TASKS = { pay: 'Trả hoa hồng', rate: 'Ghi %', base: 'Nhập doanh thu' }; // Việc admin cần làm với một đơn
const KINDS = { manage: 'Quản lý', sale: 'Lên đơn' }; // Phần hoa hồng: đơn khách tự đặt (manager), đơn tự lên (% như seller)
const REVENUE_COL = 'Doanh thu sau điều chỉnh'; // Giống ORDER_REVENUE_COL, ORDER_SHIP_COL trong google-apps-script.gs
const SHIP_COL = 'Phí ship (đơn web)';
const MIN_PASSWORD = 10; // Giống ADMIN_MIN_PASSWORD trong google-apps-script.gs (script kiểm tra lại)

/** "1.250.000 ₫", kể cả 0 ₫ (fmtPrice của trang bán hàng ghi "Liên hệ" khi chưa có giá). */
const vnd = (n) => `${Math.round(Number(n) || 0).toLocaleString('vi-VN')} ₫`;

/** "10%", "2,5%" từ 0,1, 0,025. */
const pctText = (p) => `${(Math.round(Number(p) * 10000) / 100).toLocaleString('vi-VN')}%`;

/** "31/12/2026" từ "2026-12-31". */
const dayText = (day) => String(day).split('-').reverse().join('/');

/** Hôm nay "yyyy-mm-dd" theo giờ máy (ô chọn ngày). */
function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Mở một mục thay cho trang tính. Trả true khi đã hiện. */
async function openView(name) {
  if (!Object.hasOwn(VIEWS, name)) return false;
  if (!app.doc && !(await loadSheet('', { quiet: true }))) return false;
  const ticket = ++app.ticket;
  closePanel();
  setStatus('Đang tải…');
  els.view.setAttribute('aria-busy', 'true');
  const out = await api(VIEWS[name].action);
  if (ticket !== app.ticket) return false;
  els.view.removeAttribute('aria-busy');
  if (!out.ok) {
    if (!out.login) setStatus(out.error || 'Chưa tải được. Thử lại sau ít phút.', true);
    return false;
  }
  setStatus('');
  takeMe(out.me);
  app.view = name;
  app.loadedAt = new Date();
  showWork(true);
  showUser();
  renderViews();
  renderTabs();
  renderTools();
  showMain('view');
  VIEWS[name].render(out);
  els.view.scrollTop = 0;
  return true;
}

/** Bảng số liệu của một mục: `cols` [{ label, num }], ô đã là HTML an toàn (chữ đã qua esc). */
function viewTable(id, cols, rows) {
  return `
    <div class="dash-table-wrap" role="region" tabindex="0" aria-labelledby="${id}">
      <table class="dash-table admin-table">
        <thead><tr>${cols.map((c) => `<th scope="col"${c.num ? '' : ' class="is-text"'}>${esc(c.label)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((r) => `<tr>${r.map((cell, i) => (i ? `<td${cols[i].num ? '' : ' class="is-text"'}>${cell}</td>` : `<th scope="row">${cell}</th>`)).join('')}</tr>`).join('')}</tbody>
      </table>
    </div>`;
}

function kpiHtml(label, value, note) {
  return `
    <article class="dash-kpi">
      <h3 class="dash-kpi__label">${esc(label)}</h3>
      <p class="dash-kpi__value">${esc(value)}</p>
      <p class="dash-kpi__note">${esc(note)}</p>
    </article>`;
}

/**
 * Hoa hồng (script tính từ trang Đơn hàng, In 3D), mỗi người nhận theo phần (`kind`): "sale" hoa hồng lên đơn (người ở cột
 * Seller: seller, hay manager tự lên đơn), "manage" hoa hồng quản lý (đơn Đơn hàng khách tự đặt: manager đang nhận %).
 * Admin: tổng, từng người nhận, các đơn cần làm (trả hoa hồng, ghi %, nhập doanh thu) kèm nút mở đơn, lợi nhuận theo tháng
 * sau khi trừ hoa hồng. Seller, manager (kèm nút lên đơn): hoa hồng của mình, các đơn mình nhận; manager thấy 2 phần riêng.
 */
function renderCommission(out) {
  const admin = app.role === 'admin';
  const manager = app.role === 'manager';
  const people = out.people || [];
  const sum = (key) => people.reduce((s, x) => s + (Number(x[key]) || 0), 0);
  const pct = (o) => (o.pct === null ? '–' : esc(pctText(o.pct)));
  const amount = (o) => (o.amount !== null ? esc(vnd(o.amount)) : o.pct === null ? 'Chưa có %' : 'Chờ doanh thu');
  const chip = (o) => `<span class="admin-chip is-${o.state}">${esc(STATES[o.state] || '')}</span>`;
  const task = (o) => (TASKS[o.task] ? `<span class="admin-chip${o.task === 'pay' ? ' is-due' : ''}">${esc(TASKS[o.task])}</span>` : '');
  const kind = (k) => esc(KINDS[k] || k);
  const sell = admin ? '' : app.order ? `
    <section class="dash-card admin-sell" aria-labelledby="hh-sell">
      <h2 class="dash-card__title" id="hh-sell">Lên đơn cho khách</h2>
      <p class="admin-sell__text">Mở trang đặt hàng ngay trong tab này rồi điền thông tin khách đưa. Đầu trang có dòng “Đang lên đơn cho khách bằng tài khoản ${esc(app.role)} <strong>${esc(app.user)}</strong>”: đơn gửi đi tự ghi tên bạn và % hoa hồng${manager ? ' theo sản phẩm như seller (hoa hồng lên đơn; đơn bạn lên không tính hoa hồng quản lý)' : ''}.</p>
      <div class="admin-sell__actions">
        <a class="btn btn--primary btn--sm" href="san-pham.html">${icon('cart')} Lên đơn bộ xe</a>
        <a class="btn btn--ghost btn--sm" href="in-3d.html">${icon('bag')} Lên đơn In 3D</a>
      </div>
    </section>` : manager ? '' : '<p class="dash-card admin-sell__text">Tài khoản của bạn chưa được lên đơn trên web: báo admin của shop.</p>';
  const missing = sum('noRate') + sum('noBase');
  const names = new Set(people.map((p) => p.name)).size;
  const kpis = `
    <section class="dash__kpis" aria-labelledby="hh-kpis">
      <h2 class="dash__caption" id="hh-kpis">${admin ? `Hoa hồng của ${names} người nhận` : manager ? 'Hoa hồng của bạn (cả 2 phần)' : 'Hoa hồng của bạn'}, đơn huỷ không tính</h2>
      ${kpiHtml('Chưa trả', vnd(sum('due')), 'Đơn đã giao, shop chưa trả hoa hồng')}
      ${kpiHtml('Đang chờ', vnd(sum('wait')), 'Đơn chưa giao xong')}
      ${kpiHtml('Đã trả', vnd(sum('paid')), 'Shop đã trả hoa hồng')}
      ${kpiHtml('Chưa tính được', `${missing} đơn`, admin ? `${sum('noRate')} đơn chưa có %, ${sum('noBase')} đơn chờ ${REVENUE_COL}` : 'Tự tính khi shop có % và doanh thu của đơn')}
    </section>`;
  const totals = (s) => [s.orders, esc(vnd(s.sales)), esc(vnd(s.due)), esc(vnd(s.wait)), esc(vnd(s.paid)), s.noRate + s.noBase];
  const totalCols = [{ label: 'Đơn', num: true }, { label: 'Doanh số', num: true }, { label: 'Chưa trả', num: true }, { label: 'Đang chờ', num: true },
    { label: 'Đã trả', num: true }, { label: 'Chưa tính được', num: true }];
  const byPerson = !admin ? '' : `
    <section class="dash-card dash-tables" aria-labelledby="hh-people">
      <h2 class="dash-card__title" id="hh-people">Theo người nhận</h2>
      ${people.length ? viewTable('hh-people', [{ label: 'Người nhận' }, { label: 'Vai trò' }, { label: 'Hoa hồng' }, ...totalCols],
      people.map((s) => [esc(s.name), esc(ROLES[s.role] || s.role), kind(s.kind), ...totals(s)]))
        : '<p class="dash-empty">Chưa có seller nào, chưa có manager nhận hoa hồng: tạo, bật ở mục Tài khoản.</p>'}
    </section>`;
  // Manager: hoa hồng quản lý (đơn khách tự đặt, % admin đặt riêng) và hoa hồng lên đơn (đơn mình lên, % như seller)
  const mine = out.mine || {};
  const parts = !manager ? '' : `
    <section class="dash-card dash-tables" aria-labelledby="hh-parts">
      <h2 class="dash-card__title" id="hh-parts">2 phần hoa hồng của bạn</h2>
      ${viewTable('hh-parts', [{ label: 'Phần' }, ...totalCols], people.map((s) => [kind(s.kind), ...totals(s)]))}
      <p class="dash__foot"><strong>Quản lý:</strong> ${mine.pct ? `${esc(pctText(mine.pct))} × ${REVENUE_COL} của các đơn ở trang Đơn hàng khách tự đặt (không do seller hay bạn lên), đặt từ ngày ${esc(mine.since)}.`
        : 'shop chưa bật hoa hồng quản lý cho bạn.'} <strong>Lên đơn:</strong> ${mine.order ? '% theo sản phẩm như seller, cho đơn bạn lên ở trang Đặt hàng, In 3D (bấm Lên đơn ở trên).'
        : 'tài khoản của bạn chưa được lên đơn trên web: báo admin của shop.'}</p>
    </section>`;
  const months = !admin ? '' : `
    <section class="dash-card dash-tables" aria-labelledby="hh-months">
      <h2 class="dash-card__title" id="hh-months">Lợi nhuận của shop sau khi trả hoa hồng, theo tháng đặt đơn</h2>
      ${out.months?.length ? viewTable('hh-months', [{ label: 'Tháng' }, { label: 'Đơn có lợi nhuận', num: true }, { label: 'Lợi nhuận', num: true },
        { label: 'Hoa hồng', num: true }, { label: 'Lợi nhuận sau hoa hồng', num: true }],
      out.months.map((m) => [esc(m.label), m.orders, esc(vnd(m.profit)), esc(vnd(m.commission)), esc(vnd(m.net))]))
        : '<p class="dash-empty">Chưa có đơn nào có lợi nhuận: nhập Doanh thu sau điều chỉnh ở trang Đơn hàng, In 3D (Chi phí của đơn mới tự điền theo trang Chi Phí).</p>'}
    </section>`;
  const cols = admin
    ? [{ label: 'Ngày' }, { label: 'Người nhận' }, { label: 'Mã' }, { label: 'Khách' }, { label: 'Sản phẩm' }, { label: 'Trạng thái đơn' },
      { label: '%', num: true }, { label: 'Hoa hồng', num: true }, { label: 'Cần làm' }, { label: 'Đơn' }]
    : [{ label: 'Ngày' }, ...(manager ? [{ label: 'Phần' }] : []), { label: 'Mã' }, { label: 'Khách' }, { label: 'Sản phẩm' }, { label: 'Tổng', num: true },
      { label: 'Trạng thái đơn' }, { label: '%', num: true }, { label: 'Hoa hồng', num: true }, { label: 'Hoa hồng đã' }];
  // Admin: đơn hoa hồng quản lý ghi thêm chữ "quản lý" cạnh tên manager
  const who = (o) => `${esc(o.who)}${o.kind === 'manage' ? ` <span class="admin-chip">${kind(o.kind)}</span>` : ''}`;
  const rows = out.orders.map((o) => (admin
    ? [esc(o.time), who(o), esc(o.code), esc(o.customer), esc(o.what), esc(o.status || '–'), pct(o), amount(o), task(o),
      `<button type="button" class="btn btn--ghost btn--sm" data-goto-sheet="${esc(o.sheet)}" data-goto-row="${o.row}">Mở đơn</button>`]
    : [esc(o.time), ...(manager ? [kind(o.kind)] : []), esc(o.code), esc(o.customer), esc(o.what), esc(vnd(o.total)), esc(o.status || '–'), pct(o), amount(o), chip(o)]));
  const none = admin ? 'Không có đơn nào cần trả hoa hồng, ghi % hay nhập doanh thu.'
    : manager ? 'Chưa có đơn nào: đơn khách tự đặt ở trang Đơn hàng (từ ngày shop bật hoa hồng quản lý cho bạn) và đơn bạn lên sẽ hiện ở đây.'
      : 'Chưa có đơn nào. Bấm Lên đơn ở trên để lên đơn đầu tiên.';
  const orders = `
    <section class="dash-card dash-tables" aria-labelledby="hh-orders">
      <h2 class="dash-card__title" id="hh-orders">${admin ? 'Đơn cần làm: trả hoa hồng, ghi %, nhập doanh thu' : manager ? 'Đơn tôi nhận hoa hồng' : 'Đơn của tôi'}</h2>
      ${rows.length ? viewTable('hh-orders', cols, rows) : `<p class="dash-empty">${none}</p>`}
      ${out.more ? `<p class="dash__foot">Còn ${out.more} đơn cũ hơn: xem ở trang Đơn hàng, In 3D.</p>` : ''}
    </section>`;
  let notes = '';
  if (admin && out.rates) {
    const r = out.rates;
    notes = `% hoa hồng seller cho mỗi sản phẩm ở trang <button type="button" class="link-inline" data-goto-sheet="${esc(r.sheet)}">${esc(r.sheet)}</button>${r.missing
      ? `: còn ${r.missing}/${r.products} sản phẩm chưa có %` : ': đủ % cho mọi sản phẩm'}${r.bad ? `, ${r.bad} ô không phải % (sửa thành % như “10%”)` : ''}. ${out.manager
      ? `Manager ${esc(out.manager.name)} nhận hoa hồng quản lý ${esc(pctText(out.manager.pct))} các đơn ở trang Đơn hàng khách tự đặt (cột Seller trống), từ ngày ${esc(out.manager.since)}.`
      : 'Chưa có manager nào nhận hoa hồng quản lý: bật ở mục Tài khoản.'} Manager được lên đơn thì đơn mình lên ghi tên ở cột Seller, nhận % theo sản phẩm như seller. Trả hoa hồng xong thì mở đơn, tích “Đã trả hoa hồng”. `;
  }
  els.view.innerHTML = `
    <div class="dash__grid">
      ${sell}${kpis}${parts}${byPerson}${orders}${months}
      <p class="dash__foot">${notes}Hoa hồng = % × ${REVENUE_COL} của đơn, trả khi đơn giao xong (trạng thái Đã giao); đơn huỷ không có hoa hồng. Số liệu lúc ${esc(out.updated)}.</p>
    </div>`;
  renderViewInfo(admin ? 'Hoa hồng, lợi nhuận' : manager ? 'Hoa hồng của tôi' : 'Đơn và hoa hồng của tôi', `${out.orders.length} đơn · số liệu lúc ${out.updated}`);
}

/** Mục Tài khoản (chỉ admin): danh sách, bấm một tài khoản để sửa vai trò, quyền, đặt mật khẩu mới. */
function renderAccounts(out) {
  app.accounts = out;
  els.view.innerHTML = `
    <div class="dash__grid">
      <section class="dash-card admin-accounts" aria-labelledby="ac-title">
        <div class="admin-accounts__head">
          <h2 class="dash-card__title" id="ac-title">Tài khoản trang quản trị</h2>
          <button type="button" class="btn btn--primary btn--sm" data-ac-new>${icon('plus')} Thêm tài khoản</button>
        </div>
        <ul class="admin-accounts__list" role="list">${out.accounts.map((a) => `
          <li><button type="button" class="admin-account" data-ac-open="${esc(a.name)}">
            <span class="admin-account__text">
              <span class="admin-account__top"><strong>${esc(a.name)}</strong>${a.self ? ' (bạn)' : ''}
                <span class="admin-chip">${esc(ROLES[a.role] || a.role)}</span>${a.totp ? '' : '<span class="admin-chip is-wait">chưa bật mã 2 bước</span>'}</span>
              <span class="admin-account__perms">${esc(permsSummary(a, out.sheets))}</span>
            </span>
            ${icon('chevron-right')}
          </button></li>`).join('')}
        </ul>
      </section>
      <p class="dash__foot">Admin xem, sửa được mọi thứ và quản lý tài khoản. Manager, seller chỉ xem được các trang tính, các cột bạn chọn: manager không bao giờ thấy cột hoa hồng (hoa hồng quản lý, hoa hồng lên đơn của mình xem ở mục Hoa hồng của tôi), seller chỉ thấy đơn của mình. Trang Chi Phí chỉ admin sửa: tích Xem để cho ai xem. Mã 2 bước bật trong Google Sheet: menu SmartCarTech → Tài khoản trang quản trị…; mọi lần tạo, sửa, xoá tài khoản được ghi ở Nhật ký quản trị.</p>
    </div>`;
  renderViewInfo('Tài khoản', `${out.accounts.length} tài khoản`);
}

/** "Đơn hàng: xem, sửa · In 3D: xem · được lên đơn · nhập phí ship" (manager: "· hoa hồng quản lý 5% từ 01/11/2026") */
function permsSummary(a, sheets) {
  if (a.role === 'admin') return 'Xem, sửa mọi thứ, quản lý tài khoản';
  const own = a.perms?.sheets || {};
  const parts = sheets.filter((s) => Object.hasOwn(own, s.id) && own[s.id]?.view).map((s) => {
    const p = own[s.id];
    return `${s.name}: ${['xem', p.edit && 'sửa', p.add && 'thêm dòng', p.del && 'xoá dòng'].filter(Boolean).join(', ')}${Array.isArray(p.cols) ? ` (${p.cols.length} cột)` : ''}`;
  });
  if (!parts.length) parts.push('Chưa xem được trang tính nào');
  parts.push(a.perms?.order ? 'được lên đơn' : 'chưa được lên đơn');
  if (a.perms?.ship) parts.push('nhập phí ship');
  if (a.role === 'manager' && a.perms?.pct) parts.push(`hoa hồng quản lý ${pctText(a.perms.pct)} từ ${dayText(a.perms.since)}`);
  return parts.join(' · ');
}

/**
 * Quyền ở một trang tính trong khung sửa tài khoản: xem, sửa, thêm, xoá dòng, và các cột được xem. Trang chỉ admin sửa
 * (`viewOnly`, VD Chi Phí): chỉ tích được Xem.
 */
function sheetPermHtml(s, p, role) {
  const own = role === 'seller' && s.own;
  const fixed = Boolean(s.viewOnly);
  const view = Boolean(p && p.view);
  const edit = view && Boolean(p.edit) && !fixed;
  const all = !view || !Array.isArray(p.cols);
  const shown = new Set(all ? [] : p.cols);
  const flag = (name, label, on, off) => `<label class="check"><input type="checkbox" data-flag="${name}"${on ? ' checked' : ''}${off ? ' disabled' : ''}> <span>${label}</span></label>`;
  const cols = s.cols.map((c) => {
    const blocked = role === 'manager' && c.money;
    return `<label class="check"><input type="checkbox" data-col-key="${esc(c.key)}"${!blocked && (all || shown.has(c.key)) ? ' checked' : ''}${blocked || all ? ' disabled' : ''}${blocked ? ' data-blocked' : ''}> <span>${esc(c.label)}${blocked ? ' (manager không xem được)' : ''}</span></label>`;
  }).join('');
  return `
    <div class="admin-perm" data-sheet-id="${esc(s.id)}"${own ? ' data-own' : ''}${fixed ? ' data-view-only' : ''}>
      <p class="admin-perm__name">${esc(s.name)}${own ? ' <span class="admin-perm__note">chỉ đơn của seller này</span>' : ''}${fixed ? ' <span class="admin-perm__note">chỉ xem, chỉ admin sửa</span>' : ''}</p>
      <div class="admin-perm__flags">
        ${flag('view', 'Xem', view, false)}
        ${flag('edit', 'Sửa', edit, !view || fixed)}
        ${flag('add', 'Thêm dòng', edit && p.add, !edit || own)}
        ${flag('del', 'Xoá dòng', edit && p.del, !edit || own)}
        <button type="button" class="admin-perm__more" data-cols-toggle aria-expanded="false"${view && s.cols.length ? '' : ' hidden'}></button>
      </div>
      <div class="admin-perm__cols" data-cols hidden>
        <label class="check"><input type="checkbox" data-cols-all${all ? ' checked' : ''}> <span>Mọi cột, kể cả cột thêm sau này</span></label>
        <div class="admin-perm__list">${cols}</div>
      </div>
    </div>`;
}

/** Phần quyền của khung sửa tài khoản theo vai trò (admin: không cần chọn). */
function permsHtml(role, perms, sheets) {
  if (role === 'admin') {
    return `<p class="admin-field__hint">${icon('info', 'icon--sm')}<span>Admin xem, sửa được mọi trang tính, mọi cột, xem hoa hồng của mọi seller, manager và quản lý tài khoản.</span></p>`;
  }
  const seller = role === 'seller';
  const own = perms?.sheets || {};
  const pct = perms?.pct ? Math.round(perms.pct * 10000) / 100 : '';
  return `
    <label class="check admin-perm__order"><input type="checkbox" data-ac-order${perms?.order ? ' checked' : ''}> <span>Được lên đơn trên trang Đặt hàng, In 3D: đơn ghi tên ${seller ? 'seller' : 'manager này'} ở cột Seller, tự ghi % hoa hồng theo sản phẩm${seller ? '' : ' (như seller; đơn manager tự lên không tính hoa hồng quản lý)'}</span></label>
    <label class="check admin-perm__order"><input type="checkbox" data-ac-ship${perms?.ship ? ' checked' : ''}> <span>Được nhập “${SHIP_COL}” ở đơn web${seller ? ' của mình' : ''} (không tích: chỉ admin nhập)</span></label>
    ${seller ? '' : `<fieldset class="admin-perms admin-pct">
      <legend class="field__label">Hoa hồng quản lý của manager</legend>
      <p class="admin-field__hint">Nhận % này × ${REVENUE_COL} của các đơn ở trang Đơn hàng khách tự đặt (không do seller hay manager lên), đặt từ ngày chọn (đơn In 3D không tính). Để trống: không nhận. Mỗi lúc chỉ một manager nhận.</p>
      <div class="admin-pct__row">
        <div class="field admin-field">
          <label class="field__label" for="ac-pct">% hoa hồng</label>
          <input class="field__input" id="ac-pct" type="number" inputmode="decimal" min="0" max="99.99" step="0.01" placeholder="VD: 5" value="${pct}">
        </div>
        <div class="field admin-field">
          <label class="field__label" for="ac-since">Tính cho đơn từ ngày</label>
          <input class="field__input" id="ac-since" type="date" value="${esc(perms?.since || today())}">
        </div>
      </div>
    </fieldset>`}
    <fieldset class="admin-perms">
      <legend class="field__label">Trang tính được xem</legend>
      <p class="admin-field__hint">${seller ? 'Ở Đơn hàng, In 3D, seller chỉ thấy đơn mình lên và không thêm, xoá dòng.' : 'Manager không bao giờ thấy các cột hoa hồng, ở mọi trang tính.'} Nhật ký quản trị, Hoa hồng seller chỉ admin xem được. Chi Phí: tích Xem thì người đó xem được chi phí từng sản phẩm, không sửa được. Cột Chi phí ở Đơn hàng, In 3D chỉ admin sửa.</p>
      ${sheets.map((s) => sheetPermHtml(s, Object.hasOwn(own, s.id) ? own[s.id] : null, role)).join('')}
    </fieldset>`;
}

/** Chữ trên nút cột của một trang: "Cột: tất cả" hoặc "Cột: 11/20". */
function syncPerm(box) {
  const flag = (name) => $(`[data-flag="${name}"]`, box);
  const view = flag('view').checked;
  const fixed = box.hasAttribute('data-view-only');
  const edit = view && !fixed && flag('edit').checked;
  const own = box.hasAttribute('data-own');
  flag('edit').disabled = !view || fixed;
  if (!view || fixed) flag('edit').checked = false;
  ['add', 'del'].forEach((name) => {
    flag(name).disabled = !edit || own;
    if (!edit || own) flag(name).checked = false;
  });
  const all = $('[data-cols-all]', box).checked;
  const keys = $$('[data-col-key]', box);
  keys.forEach((x) => {
    const blocked = x.hasAttribute('data-blocked');
    x.disabled = blocked || all;
    if (all && !blocked) x.checked = true;
  });
  const more = $('[data-cols-toggle]', box);
  more.hidden = !view || !keys.length;
  more.textContent = all ? 'Cột: mọi cột' : `Cột: ${keys.filter((x) => x.checked).length}/${keys.length}`;
  if (!view) {
    $('[data-cols]', box).hidden = true;
    more.setAttribute('aria-expanded', 'false');
  }
}

/** Quyền đang chọn trong khung: { sheets: { id: { view, edit, add, del, cols? } }, order, ship, pct (0,05 là 5%), since }. */
function readPerms(el) {
  const sheets = {};
  $$('[data-sheet-id]', el).forEach((box) => {
    const on = (name) => $(`[data-flag="${name}"]`, box).checked;
    if (!on('view')) return;
    const p = { view: true };
    if (on('edit')) {
      p.edit = true;
      if (on('add')) p.add = true;
      if (on('del')) p.del = true;
    }
    if (!$('[data-cols-all]', box).checked) p.cols = $$('[data-col-key]', box).filter((x) => x.checked).map((x) => x.dataset.colKey);
    sheets[box.dataset.sheetId] = p;
  });
  const out = { sheets, order: Boolean($('[data-ac-order]', el)?.checked), ship: Boolean($('[data-ac-ship]', el)?.checked) };
  const pct = $('#ac-pct', el);
  if (pct) {
    const n = Number(pct.value);
    out.pct = pct.value !== '' && n > 0 && n < 100 ? Math.round(n * 100) / 10000 : 0;
    out.since = $('#ac-since', el).value || today();
  }
  return out;
}

/** 15 ký tự ngẫu nhiên (khoảng 87 bit), bỏ các chữ dễ nhầm 0/O, 1/l/I. Giống cửa sổ tài khoản trong Google Sheet. */
function strongPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const s = Array.from(crypto.getRandomValues(new Uint32Array(15)), (n) => chars[n % chars.length]).join('');
  return `${s.slice(0, 5)}-${s.slice(5, 10)}-${s.slice(10)}`;
}

/** Khung sửa tài khoản `name` (null: thêm tài khoản). */
function openAccount(name) {
  const data = app.accounts;
  const a = name ? data.accounts.find((x) => x.name === name) : null;
  if (name && !a) return;
  const self = Boolean(a?.self);
  const start = a ? a.role : 'seller';
  const roleOptions = Object.entries({
    admin: 'Admin: xem, sửa mọi thứ, quản lý tài khoản',
    manager: 'Manager: quản lý đơn, lên đơn được, chỉ thấy hoa hồng của mình',
    seller: 'Seller: lên đơn, xem đơn và hoa hồng của mình',
  }).map(([value, label]) => `<option value="${value}"${value === start ? ' selected' : ''}>${esc(label)}</option>`).join('');
  const el = openDrawer({
    title: a ? `Tài khoản ${a.name}` : 'Thêm tài khoản',
    sub: a ? `${ROLES[a.role]} · ${a.totp ? 'đã bật mã 2 bước' : 'chưa bật mã 2 bước'}` : 'Tạo xong, gửi tên đăng nhập và mật khẩu cho người dùng',
    saveLabel: a ? 'Lưu thay đổi' : 'Tạo tài khoản',
    danger: a && !self ? 'Xoá tài khoản' : '',
    body: `
      <div class="admin-fields">
        <div class="field admin-field">
          <label class="field__label" for="ac-name">Tên đăng nhập</label>
          ${a ? `<p class="admin-field__value" id="ac-name">${esc(a.name)}</p>` : `<input class="field__input" id="ac-name" maxlength="30" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="VD: lan.seller" aria-describedby="ac-name-hint">
          <p class="admin-field__hint" id="ac-name-hint">3–30 ký tự: chữ không dấu, số, dấu chấm, gạch ngang, gạch dưới.</p>`}
        </div>
        <div class="field admin-field">
          <label class="field__label" for="ac-role">Vai trò</label>
          <select class="field__input" id="ac-role"${self ? ' disabled aria-describedby="ac-role-hint"' : ''}>${roleOptions}</select>
          ${self ? '<p class="admin-field__hint" id="ac-role-hint">Không tự đổi vai trò của chính mình: nhờ một admin khác.</p>' : ''}
        </div>
        ${self ? '' : `<div class="field admin-field">
          <label class="field__label" for="ac-pass">${a ? 'Đặt mật khẩu mới' : 'Mật khẩu'}</label>
          <div class="admin-newpass">
            <input class="field__input" id="ac-pass" type="text" autocomplete="off" autocapitalize="off" spellcheck="false" maxlength="200" placeholder="${a ? 'Để trống: giữ mật khẩu cũ' : `Ít nhất ${data.min} ký tự`}" aria-describedby="ac-pass-hint">
            <button type="button" class="btn btn--ghost btn--sm" data-ac-gen>Tạo mật khẩu</button>
          </div>
          <p class="admin-field__hint" id="ac-pass-hint">${a ? 'Đặt mật khẩu mới thì người đó bị đăng xuất ở mọi nơi. ' : ''}Chép mật khẩu gửi cho người dùng trước khi bấm ${a ? 'Lưu' : 'Tạo tài khoản'}: sau đó không xem lại được.</p>
        </div>`}
        <div class="admin-field" data-ac-perms>${permsHtml(start, a ? a.perms : data.defaults[start], data.sheets)}</div>
      </div>`,
    onSave: () => saveAccount(a),
    onDanger: () => drawerConfirm(`Xoá hẳn tài khoản “${a.name}”? Người đó bị đăng xuất ngay, đơn cũ vẫn giữ tên seller.`, 'Xoá tài khoản', () => removeAccount(a.name)),
  });
  $$('[data-sheet-id]', el).forEach(syncPerm);
  el.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 'ac-role') {
      // Đổi vai trò: quyền gợi ý của vai trò mới (giữ quyền đang có nếu quay về vai trò cũ của tài khoản)
      const role = t.value;
      $('[data-ac-perms]', el).innerHTML = permsHtml(role, a && a.role === role ? a.perms : data.defaults[role], data.sheets);
      $$('[data-sheet-id]', el).forEach(syncPerm);
      return;
    }
    const box = t.closest('[data-sheet-id]');
    if (box) syncPerm(box);
  });
  el.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t || drawer?.busy) return;
    if (t.matches('[data-ac-gen]')) {
      $('#ac-pass', el).value = strongPassword();
      $('#ac-pass', el).select();
    } else if (t.matches('[data-cols-toggle]')) {
      const box = t.closest('[data-sheet-id]');
      const open = t.getAttribute('aria-expanded') !== 'true';
      $('[data-cols]', box).hidden = !open;
      t.setAttribute('aria-expanded', String(open));
    }
  });
}

async function saveAccount(a) {
  const el = drawer.el;
  const name = a ? a.name : $('#ac-name', el).value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(name)) {
    drawerError('Tên đăng nhập 3–30 ký tự: chữ không dấu, số, dấu chấm, gạch ngang, gạch dưới.');
    $('#ac-name', el).focus();
    return;
  }
  const role = $('#ac-role', el).value;
  const pass = $('#ac-pass', el)?.value || '';
  if ((!a || pass) && pass.length < app.accounts.min) {
    drawerError(`Mật khẩu cần ít nhất ${app.accounts.min} ký tự: bấm “Tạo mật khẩu” để có mật khẩu mạnh.`);
    $('#ac-pass', el).focus();
    return;
  }
  const pct = $('#ac-pct', el);
  if (pct && (pct.validity.badInput || (pct.value !== '' && !(Number(pct.value) >= 0 && Number(pct.value) < 100)))) {
    drawerError('% hoa hồng của manager là số từ 0 đến dưới 100, VD 5 hoặc 2,5. Để trống: không nhận hoa hồng.');
    pct.focus();
    return;
  }
  drawerBusy(true, 'Đang lưu…');
  const out = await api('luu-tai-khoan', { isNew: !a, name, role, pass, perms: role === 'admin' ? null : readPerms(el) });
  drawerBusy(false);
  if (!out.ok) {
    if (!out.login) drawerError(out.error || 'Chưa lưu được. Thử lại sau ít phút.');
    return;
  }
  closeDrawer();
  renderAccounts(out);
  const swept = out.swept ? ` Đã ghi hoa hồng manager cho ${out.swept} đơn từ ngày đã chọn.` : '';
  toast((a ? `Đã lưu tài khoản ${name}.` : `Đã tạo tài khoản ${name}: gửi tên đăng nhập và mật khẩu cho người dùng.`) + swept, { timeout: 6000 });
}

async function removeAccount(name) {
  drawerBusy(true, 'Đang xoá…', '[data-ad-danger]');
  const out = await api('xoa-tai-khoan', { name });
  drawerBusy(false, '', '[data-ad-danger]');
  if (!out.ok) {
    if (!out.login) drawerError(out.error || 'Chưa xoá được. Thử lại sau ít phút.');
    return;
  }
  closeDrawer();
  renderAccounts(out);
  toast(`Đã xoá tài khoản ${name}.`);
}

/** Khung đổi mật khẩu của chính mình (mọi vai trò). Đổi xong script đăng xuất mọi nơi: web về khung đăng nhập. */
function openPassword() {
  openDrawer({
    title: 'Đổi mật khẩu',
    sub: `Tài khoản ${app.user}`,
    saveLabel: 'Đổi mật khẩu',
    body: `
      <div class="admin-fields">
        <input type="text" name="username" autocomplete="username" value="${esc(app.user)}" hidden>
        <div class="field admin-field">
          <label class="field__label" for="pw-old">Mật khẩu hiện tại</label>
          <input class="field__input" id="pw-old" type="password" autocomplete="current-password" maxlength="200">
        </div>
        <div class="field admin-field">
          <label class="field__label" for="pw-new">Mật khẩu mới</label>
          <input class="field__input" id="pw-new" type="password" autocomplete="new-password" maxlength="200" aria-describedby="pw-hint">
          <p class="admin-field__hint" id="pw-hint">Ít nhất ${MIN_PASSWORD} ký tự. Đổi xong, mọi nơi đang đăng nhập bằng tài khoản này bị đăng xuất.</p>
        </div>
        <div class="field admin-field">
          <label class="field__label" for="pw-again">Nhập lại mật khẩu mới</label>
          <input class="field__input" id="pw-again" type="password" autocomplete="new-password" maxlength="200">
        </div>
      </div>`,
    onSave: async () => {
      const el = drawer.el;
      const [old, pass, again] = ['#pw-old', '#pw-new', '#pw-again'].map((id) => $(id, el));
      if (!old.value) {
        drawerError('Nhập mật khẩu hiện tại.');
        old.focus();
        return;
      }
      if (pass.value.length < MIN_PASSWORD) {
        drawerError(`Mật khẩu mới cần ít nhất ${MIN_PASSWORD} ký tự.`);
        pass.focus();
        return;
      }
      if (pass.value !== again.value) {
        drawerError('Hai lần nhập mật khẩu mới chưa giống nhau.');
        again.focus();
        return;
      }
      drawerBusy(true, 'Đang đổi…');
      const out = await api('doi-mat-khau', { old: old.value, pass: pass.value });
      drawerBusy(false);
      if (!out.ok) {
        if (!out.login) drawerError(out.error || 'Chưa đổi được. Thử lại sau ít phút.');
        old.select();
        return;
      }
      signedOut('Đã đổi mật khẩu. Đăng nhập lại bằng mật khẩu mới.');
    },
  });
}

/* Khung bên phải cho Tài khoản, Đổi mật khẩu: giống khung sửa dòng nhưng không gắn với trang tính */
let drawer = null; // { el, overlay, busy, opener, onSave, onDanger, onConfirm }

function openDrawer({ title, sub = '', body, saveLabel = 'Lưu', danger = '', onSave, onDanger }) {
  closeDrawer();
  closePanel();
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const el = document.createElement('aside');
  el.className = 'drawer drawer--wide admin-panel';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'ad-title');
  el.innerHTML = `
    <div class="drawer__head">
      <div class="admin-panel__titles">
        <h2 class="drawer__title" id="ad-title">${esc(title)}</h2>
        ${sub ? `<p class="admin-panel__sub">${esc(sub)}</p>` : ''}
      </div>
      <button type="button" class="icon-btn" data-ad-close aria-label="Đóng">${icon('close')}</button>
    </div>
    <form class="drawer__body admin-panel__body" data-ad-form novalidate>${body}<button type="submit" hidden></button></form>
    <div class="drawer__foot admin-panel__foot">
      <div class="send-error" data-ad-error hidden tabindex="-1"></div>
      <div class="admin-confirm" data-ad-confirm hidden>
        <p data-ad-confirm-text></p>
        <div class="admin-confirm__actions">
          <button type="button" class="btn btn--sm btn--danger" data-ad-confirm-ok></button>
          <button type="button" class="btn btn--ghost btn--sm" data-ad-confirm-no>Quay lại</button>
        </div>
      </div>
      <div class="admin-panel__actions" data-ad-actions>
        ${danger ? `<button type="button" class="btn btn--ghost btn--sm admin-panel__delete" data-ad-danger>${icon('trash')} ${esc(danger)}</button>` : ''}
        <button type="button" class="btn btn--ghost btn--sm" data-ad-close>Huỷ</button>
        <button type="button" class="btn btn--primary btn--sm" data-ad-save>${esc(saveLabel)}</button>
      </div>
    </div>`;
  drawer = { el, overlay, busy: false, opener: document.activeElement, onSave, onDanger, onConfirm: null };
  document.body.append(overlay, el);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || !drawer || drawer.busy) return;
    if (b.matches('[data-ad-close]')) closeDrawer();
    else if (b.matches('[data-ad-save]')) drawer.onSave?.();
    else if (b.matches('[data-ad-danger]')) drawer.onDanger?.();
    else if (b.matches('[data-ad-confirm-ok]')) {
      const fn = drawer.onConfirm;
      drawerConfirm('');
      fn?.();
    } else if (b.matches('[data-ad-confirm-no]')) drawerConfirm('');
  });
  $('[data-ad-form]', el).addEventListener('submit', (e) => {
    e.preventDefault();
    if (drawer && !drawer.busy) drawer.onSave?.();
  });
  el.addEventListener('input', () => {
    const box = $('[data-ad-error]', el);
    if (!box.hidden) box.hidden = true;
  });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (!drawer?.busy) closeDrawer();
    } else {
      trapFocus(el, e);
    }
  });
  overlay.addEventListener('click', () => { if (!drawer?.busy) closeDrawer(); });
  document.documentElement.style.overflow = 'hidden';
  requestAnimationFrame(() => {
    overlay.classList.add('is-open');
    el.classList.add('is-open');
    ($('input:not([hidden]):not([disabled]), select:not([disabled])', el) || $('[data-ad-close]', el)).focus({ preventScroll: true });
  });
  return el;
}

function closeDrawer() {
  if (!drawer) return;
  const d = drawer;
  drawer = null;
  d.overlay.classList.remove('is-open');
  d.el.classList.remove('is-open');
  setTimeout(() => {
    d.overlay.remove();
    d.el.remove();
  }, 300);
  document.documentElement.style.overflow = '';
  if (d.opener?.isConnected) d.opener.focus({ preventScroll: true });
}

function drawerError(text) {
  const box = $('[data-ad-error]', drawer.el);
  box.hidden = !text;
  box.innerHTML = text ? `<p class="send-error__text">${icon('info', 'icon--md')}<span>${esc(text)}</span></p>` : '';
  if (text) box.focus();
}

function drawerConfirm(text, okLabel = '', onOk = null) {
  const box = $('[data-ad-confirm]', drawer.el);
  drawer.onConfirm = onOk;
  box.hidden = !text;
  $('[data-ad-actions]', drawer.el).hidden = Boolean(text);
  if (!text) return;
  $('[data-ad-confirm-text]', box).textContent = text;
  $('[data-ad-confirm-ok]', box).textContent = okLabel;
  $('[data-ad-confirm-no]', box).focus();
}

function drawerBusy(on, label = '', which = '[data-ad-save]') {
  drawer.busy = on;
  $$('button, input, select', drawer.el).forEach((x) => {
    if (on) {
      x.dataset.wasDisabled = x.disabled ? '1' : '';
      x.disabled = true;
    } else {
      x.disabled = x.dataset.wasDisabled === '1';
    }
  });
  const btn = $(which, drawer.el);
  if (!btn) return;
  if (on) {
    btn.dataset.label = btn.innerHTML;
    btn.textContent = label;
    btn.setAttribute('aria-busy', 'true');
  } else {
    if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
    btn.removeAttribute('aria-busy');
  }
}

/** Thông báo của người vừa đăng xuất không hiện tiếp cho người đăng nhập sau trên cùng máy. */
function clearToasts() {
  $$('.toast').forEach((t) => t.remove());
}

/** Phiên vừa hết hiệu lực ở mọi nơi (VD vừa đổi mật khẩu): về khung đăng nhập với lời nhắn. */
function signedOut(message) {
  closePanel();
  closeDrawer();
  clearToasts();
  clearSession();
  app.doc = null;
  app.view = '';
  slideSide(false, false);
  showWork(false);
  els.userBox.hidden = true;
  showLogin(message, false, false);
}

/** Bấm "Mở đơn", "Hoa hồng seller" trong mục Hoa hồng: mở trang tính đó, mở khung của dòng nếu có. */
async function gotoSheet(sheet, row) {
  if (!(await loadSheet(sheet))) return;
  if (row && app.doc.sheet?.name === sheet && app.doc.sheet.index.has(row)) {
    $(`tr[data-row="${row}"]`, els.grid)?.scrollIntoView({ block: 'center' });
    openPanel('edit', row);
  }
}

/* ---------- Khởi động ---------- */
function bind() {
  els.boot = $('[data-admin-boot]');
  els.login = $('[data-admin-login]');
  els.loginForm = $('[data-login-form]');
  els.codeForm = $('[data-code-form]');
  els.work = $('[data-admin-work]');
  els.tabs = $('[data-admin-tabs]');
  els.search = $('[data-admin-search]');
  els.add = $('[data-admin-add]');
  els.open = $('[data-admin-open]');
  els.info = $('[data-admin-info]');
  els.notes = $('[data-admin-notes]');
  els.side = $('[data-admin-side]');
  els.sideOverlay = $('[data-admin-side-overlay]');
  els.sideClose = $('[data-admin-side-close]');
  els.menu = $('[data-admin-menu]');
  els.status = $('[data-admin-status]');
  els.grid = $('[data-admin-grid]');
  els.dash = $('[data-admin-dash]');
  els.view = $('[data-admin-view]');
  els.views = $('[data-admin-views]');
  els.searchBox = els.search.closest('.admin-search');
  els.userBox = $('[data-admin-user]');
  els.userName = $('[data-admin-name]');
  els.userRole = $('[data-admin-role]');

  els.loginForm.addEventListener('submit', onLogin);
  els.codeForm.addEventListener('submit', onCode);
  els.codeForm.elements.code.addEventListener('input', (e) => {
    if (e.target.value.replace(/\D/g, '').length === 6) els.codeForm.requestSubmit();
  });
  $('[data-code-back]').addEventListener('click', () => backToPassword());
  $('[data-pass-toggle]').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const show = btn.getAttribute('aria-pressed') !== 'true';
    els.loginForm.elements.pass.type = show ? 'text' : 'password';
    btn.setAttribute('aria-pressed', String(show));
    btn.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
    $('use', btn).setAttribute('href', `assets/img/icons.svg#i-${show ? 'eye-off' : 'eye'}`);
  });
  $('[data-admin-logout]').addEventListener('click', logout);
  $('[data-admin-password]').addEventListener('click', openPassword);
  $('[data-admin-reload]').addEventListener('click', () => {
    if (app.view) openView(app.view);
    else loadSheet(app.doc?.sheet?.name, { keepScroll: true, fresh: true });
  });
  els.views.addEventListener('click', (e) => {
    const b = e.target.closest('[data-view]');
    if (!b) return;
    if (els.side.classList.contains('is-open')) slideSide(false);
    if (b.getAttribute('aria-pressed') !== 'true') openView(b.dataset.view);
  });
  els.view.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.matches('[data-goto-sheet]')) gotoSheet(b.dataset.gotoSheet, Number(b.dataset.gotoRow) || 0);
    else if (b.matches('[data-ac-new]')) openAccount(null);
    else if (b.matches('[data-ac-open]')) openAccount(b.dataset.acOpen);
  });
  els.add.addEventListener('click', () => openPanel('add'));
  try { els.work.classList.toggle('is-collapsed', Boolean(localStorage.getItem(SIDE_KEY))); } catch { /* private mode */ }
  syncMenu();
  els.menu.addEventListener('click', toggleSide);
  els.sideClose.addEventListener('click', () => slideSide(false));
  els.sideOverlay.addEventListener('click', () => slideSide(false));
  els.side.addEventListener('keydown', (e) => {
    if (!els.side.classList.contains('is-open')) return;
    if (e.key === 'Escape') slideSide(false);
    else trapFocus(els.side, e);
  });
  WIDE.addEventListener('change', () => slideSide(false, false));
  els.info.addEventListener('click', (e) => {
    const b = e.target.closest('[data-admin-notes-toggle]');
    if (!b) return;
    app.notesOpen = !app.notesOpen;
    b.setAttribute('aria-expanded', String(app.notesOpen));
    els.notes.hidden = !app.notesOpen;
  });
  els.tabs.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sheet]');
    if (!b) return;
    if (els.side.classList.contains('is-open')) slideSide(false);
    if (b.getAttribute('aria-pressed') === 'true') return;
    $$('[data-sheet]', els.tabs).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    loadSheet(b.dataset.sheet);
  });
  let timer = 0;
  els.search.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      app.query = els.search.value;
      if (app.doc?.sheet && !app.doc.dashboard && !app.view) renderGrid();
    }, 150);
  });
  els.grid.addEventListener('click', (e) => {
    const num = e.target.closest('[data-open]');
    if (num) {
      openPanel('edit', Number(num.dataset.open));
      return;
    }
    const td = e.target.closest('td[data-col]');
    const tr = td && td.closest('tr[data-row]');
    if (tr) openPanel('edit', Number(tr.dataset.row), Number(td.dataset.col));
  });
  window.addEventListener('resize', () => {
    if (app.doc?.sheet && !app.doc.dashboard && !app.view) stickHead();
  });
  // Biểu đồ vẽ theo độ rộng khung: vẽ lại khi khung đổi cỡ (xoay máy, ẩn hiện cột trái)
  new ResizeObserver(() => { if (!els.dash.hidden) redrawDashboard(); }).observe(els.dash);
}

async function start() {
  // Máy đã mở trang quản trị là máy của shop: không đếm vào khách truy cập web (core.js)
  try { localStorage.setItem(NO_COUNT_KEY, '1'); } catch { /* private mode */ }
  bind();
  let data;
  try {
    data = await loadData();
  } catch {
    bootError('Không tải được products.json. Nếu đang mở file trực tiếp trên máy, hãy chạy qua một web server (README mục 1).');
    return;
  }
  app.endpoint = data.site?.order_endpoint || '';
  if (!app.endpoint) {
    bootError('Chưa có địa chỉ Google Apps Script: điền site.order_endpoint trong products.json (README mục 5).');
    return;
  }
  readSession();
  if (!app.token) {
    showLogin();
    return;
  }
  // Tab này còn phiên đăng nhập: mở thẳng trang tính, hay mục hoa hồng của seller (phiên hết hạn thì api() hiện khung đăng nhập)
  openHome();
}

// Không cho trang khác nhúng trang quản trị vào khung (chống bấm nhầm qua lớp phủ)
if (window.top === window.self) {
  start();
} else {
  document.body.textContent = 'Trang quản trị chỉ mở trực tiếp tại smartcartech.vn/quan-tri.html.';
}
