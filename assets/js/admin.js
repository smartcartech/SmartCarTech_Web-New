/* SmartCarTech — Trang quản trị (quan-tri.html)
   Chỉ admin: đăng nhập bằng tài khoản tạo trong Google Sheet (menu SmartCarTech → "Tài khoản trang quản trị…"),
   rồi xem, sửa, thêm, xoá dòng của mọi trang tính trong Sheet của shop, kể cả các trang kế hoạch nhập từ Excel.
   google-apps-script.gs kiểm tra phiên đăng nhập trước mỗi việc, và chỉ ghi khi dòng chưa bị đổi ở nơi khác
   (web gửi kèm mã của dòng lúc tải). Web giữ mã phiên trong tab đang mở (sessionStorage): đóng tab là đăng xuất.
*/
import { $, $$, esc, icon, toast, loadData, trapFocus } from './core.js';

const SESSION_KEY = 'sctech_admin_v1';
const SHEET_KEY = 'sctech_admin_sheet';
const SIDE_KEY = 'sctech_admin_side_hidden';
const WIDE = window.matchMedia('(min-width: 1024px)'); // Giống style.css: từ cỡ này cột trang tính luôn nằm bên trái
const MAX_STICKY_ROWS = 2; // Dòng tiêu đề (hoặc tiêu đề + tên cột) đứng yên khi cuộn; nhiều hơn thì chiếm hết màn hình điện thoại
const HEX = /^#[0-9a-f]{6}$/i;

const app = {
  endpoint: '',
  token: '',
  user: '',
  doc: null,      // trả lời "doc" gần nhất: { user, url, log, sheets, sheet }
  query: '',
  ticket: 0,      // lần tải gần nhất: kết quả của lần tải cũ (VD đã bấm sang trang khác) bị bỏ
  loadedAt: null,
  notesOpen: false,
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

/* ---------- Phiên đăng nhập ---------- */
function saveSession() {
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ token: app.token, user: app.user })); } catch { /* private mode */ }
}

function readSession() {
  try {
    const s = JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
    if (s && typeof s.token === 'string') {
      app.token = s.token;
      app.user = String(s.user || '');
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

/**
 * Gửi một việc tới Google Apps Script. Không ném lỗi: luôn trả { ok, error?, … }.
 * Phiên hết hạn (`login`) thì hiện khung đăng nhập lại, nội dung đang sửa vẫn giữ nguyên.
 */
async function api(action, body = {}) {
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
  if (out.login) {
    clearSession();
    showLogin(out.error, true);
  }
  return out;
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
  const out = await api('dang-nhap', { user, pass });
  button.disabled = false;
  button.removeAttribute('aria-busy');
  button.textContent = 'Đăng nhập';
  if (!out.ok) {
    loginMessage(out.error || 'Chưa đăng nhập được. Thử lại sau ít phút.');
    form.elements.pass.select();
    return;
  }
  form.elements.pass.value = '';
  app.token = out.token;
  app.user = out.user;
  saveSession();
  const again = els.login.classList.contains('is-modal');
  hideLogin();
  showUser();
  if (!again) {
    loadSheet(lastSheet());
  } else if (panel) {
    toast('Đã đăng nhập lại. Bấm Lưu lần nữa để ghi phần đang sửa.', { timeout: 6000 });
    $('[data-ap-save]', panel.el)?.focus();
  } else {
    loadSheet(app.doc?.sheet.name, { keepScroll: true });
  }
}

function showUser() {
  els.userName.textContent = app.user;
  els.userBox.hidden = !app.user;
}

async function logout() {
  const token = app.token;
  closePanel();
  clearSession();
  app.doc = null;
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

/** Mở trang tính `name` (không có thì trang đầu tiên). Trả true khi đã hiện dữ liệu. */
async function loadSheet(name, { keepScroll = false } = {}) {
  const ticket = ++app.ticket;
  setStatus('Đang tải trang tính…');
  els.grid.setAttribute('aria-busy', 'true');
  const out = await api('doc', { sheet: name || '' });
  if (ticket !== app.ticket) return false;
  els.grid.removeAttribute('aria-busy');
  if (!out.ok) {
    if (out.login) setStatus('');
    else if (app.doc) setStatus(out.error || 'Chưa tải được trang tính. Thử lại sau ít phút.', true);
    else bootError(out.error || 'Chưa tải được Google Sheet. Thử lại sau ít phút.');
    return false;
  }
  setStatus('');
  const same = app.doc && app.doc.sheet.name === out.sheet.name;
  const scroll = keepScroll && same ? { top: els.grid.scrollTop, left: els.grid.scrollLeft } : null;
  if (!same) app.query = '';
  app.doc = out;
  app.user = out.user || app.user;
  app.loadedAt = new Date();
  prepare(out.sheet);
  rememberSheet(out.sheet.name);
  els.boot.hidden = true;
  showWork(true);
  showUser();
  renderTabs();
  renderTools();
  renderGrid();
  if (scroll) {
    els.grid.scrollTop = scroll.top;
    els.grid.scrollLeft = scroll.left;
  } else {
    els.grid.scrollTop = 0;
    els.grid.scrollLeft = 0;
  }
  return true;
}

/** Chỉ mục dòng, chữ để tìm, dòng tiêu đề cột của trang tính vừa tải. */
function prepare(sh) {
  sh.index = new Map(sh.rowNums.map((r, i) => [r, i]));
  sh.text = sh.cells.map(rowText);
  sh.headerRow = headerRowOf(sh);
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
function renderTabs() {
  const current = app.doc.sheet.name;
  const bar = els.tabs;
  const top = bar.scrollTop;
  const focused = bar.contains(document.activeElement);
  bar.innerHTML = app.doc.sheets.map((s) => `
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
  els.add.hidden = !sh.rules.add || !sh.cols;
  const url = /^https:\/\/docs\.google\.com\//.test(app.doc.url || '') ? `${app.doc.url}#gid=${sh.id}` : '';
  els.open.hidden = !url;
  els.open.href = url || '#';
  if (els.search.value !== app.query) els.search.value = app.query;
}

function renderInfo(shown, total) {
  const sh = app.doc.sheet;
  const time = app.loadedAt ? app.loadedAt.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '';
  const q = app.query.trim();
  const facts = [q ? `Đang lọc: ${shown}/${total} dòng có “${esc(q)}”` : `${total} dòng`, `${sh.cols} cột`, time && `tải lúc ${time}`].filter(Boolean);
  const notes = [];
  if (sh.rules.tip) notes.push(esc(sh.rules.tip));
  else if (sh.rules.all) notes.push('Trang tính này chỉ xem trên web.');
  if (sh.rules.header) notes.push('Dòng 1 là tên cột: script dựa vào đó để ghi đơn, nên chỉ đổi tên cột trên Google Sheet.');
  if (sh.rules.cols.length) notes.push(`Cột ${sh.rules.cols.map(colName).join(', ')} do script tự điền: chỉ xem.`);
  if (sh.images) notes.push(`Có ${sh.images} hình ảnh đặt trên trang tính: xem trên Google Sheet.`);
  const shownRows = sh.cells.length - sh.headRows;
  if (sh.rows - sh.headRows > shownRows) {
    notes.push(`Trang tính lớn: chỉ hiện ${shownRows} dòng ${sh.rules.top ? 'đầu (mới nhất)' : 'cuối'}, dòng cũ hơn xem trên Google Sheet.`);
  }
  if (sh.rules.top) notes.push('Dòng mới nhất ở trên cùng: đơn, yêu cầu, mã, dòng thêm trên web đều chèn ngay dưới dòng tiêu đề.');
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
  for (let c = 1; c <= sh.cols; c++) {
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
  const cols = Array.from({ length: sh.cols }, (_, c) => c + 1);

  const html = [widths ? `<table class="sheet sheet--fixed" style="width:${widths.reduce((a, b) => a + b, 52)}px">` : '<table class="sheet">',
    `<colgroup><col class="sheet__numcol">${cols.map((c) => (widths ? `<col style="width:${widths[c - 1]}px">` : '<col>')).join('')}</colgroup>`,
    '<thead><tr class="sheet__letters"><th class="sheet__corner" scope="col"><span class="sr-only">Dòng</span></th>',
    ...cols.map((c) => `<th scope="col">${colName(c)}</th>`), '</tr>'];
  for (let i = 0; i < sh.headRows; i++) html.push(rowHtml(sh, i, merges));
  html.push('</thead><tbody>');
  let prev = sh.headRows ? sh.rowNums[sh.headRows - 1] : 0;
  body.forEach((i) => {
    const r = sh.rowNums[i];
    if (!q && r > prev + 1) {
      html.push(`<tr class="sheet__gap"><td colspan="${sh.cols + 1}">… ${r - prev - 1} dòng cũ hơn: xem trên Google Sheet</td></tr>`);
    }
    html.push(rowHtml(sh, i, merges));
    prev = r;
  });
  // Trang mới nhất ở trên, quá lớn: các dòng cũ hơn nằm sau dòng cuối đang hiện
  if (!q && body.length && prev < sh.rows) {
    html.push(`<tr class="sheet__gap"><td colspan="${sh.cols + 1}">… ${sh.rows - prev} dòng cũ hơn: xem trên Google Sheet</td></tr>`);
  }
  if (!body.length) {
    html.push(`<tr class="sheet__gap"><td colspan="${sh.cols + 1}">${q ? 'Không có dòng nào khớp.' : 'Chưa có dòng dữ liệu nào.'}</td></tr>`);
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
  const remap = (v) => {
    if (typeof v !== 'number') return v;
    const key = JSON.stringify(fresh.lists[v]);
    let at = sh.lists.findIndex((l) => JSON.stringify(l) === key);
    if (at < 0) {
      at = sh.lists.length;
      sh.lists.push(fresh.lists[v]);
    }
    return at;
  };
  sh.cells[i] = fresh.cells.slice(0, sh.cols).map((c) => (c && c.v !== undefined ? { ...c, v: remap(c.v) } : c));
  sh.hashes[i] = fresh.hash;
  sh.text[i] = rowText(sh.cells[i]);
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
  for (let c = 1; c <= sh.cols; c++) {
    if (covered.has(c)) continue;
    const cell = cells[c - 1] || null;
    const label = labelOf(sh, c);
    const v = mode === 'add' ? template[c - 1]?.v : cell?.v;
    const locked = cell?.t === 'o' || !canEdit(sh, mode === 'add' ? sh.rows + 1 : row, c);
    let original = editOf(cell);
    if (mode === 'add') {
      const list = typeof v === 'number' ? sh.lists[v] : null;
      original = / · Thời gian$/.test(label) && sh.kinds[c - 1] === 'd' ? nowText() : list && list.length ? list[0] : '';
    }
    fields.push({
      col: c, cell, label, v, locked, kind: sh.kinds[c - 1] || '',
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
  const list = typeof f.v === 'number' ? sh.lists[f.v] || [] : null;
  if (list) {
    const extra = f.original && !list.includes(f.original) ? [f.original] : [];
    return `<select class="field__input" id="${id}" data-col="${f.col}">
      <option value="">(để trống)</option>
      ${list.map((o) => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}
      ${extra.map((o) => `<option value="${esc(o)}">${esc(o)} (ngoài danh sách)</option>`).join('')}
    </select>`;
  }
  const formula = f.cell?.f;
  const hint = formula ? 'Công thức' : f.kind === 'd' || f.cell?.t === 'd' ? 'dd/mm/yyyy hh:mm' : '';
  const numeric = !formula && (f.cell?.t === 'n' || (!f.cell && f.kind === 'n'));
  return `<textarea class="field__input admin-field__input${formula ? ' is-formula' : ''}" id="${id}" data-col="${f.col}" rows="1"${numeric ? ' inputmode="decimal"' : ''}${hint ? ` placeholder="${esc(hint)}"` : ''} spellcheck="false"></textarea>`;
}

function fieldHtml(sh, f) {
  const hints = [];
  if (f.locked && f.cell?.t !== 'o') hints.push(`${icon('lock', 'icon--sm')}<span>Chỉ sửa trên Google Sheet.</span>`);
  if (f.cell?.f) hints.push(`<span>Kết quả hiện tại: ${esc(f.cell.d || '(trống)')}</span>`);
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
    const input = inputOf(f);
    if (!input || f.locked) return null;
    const value = input.type === 'checkbox' ? input.checked : input.value;
    return value === f.original ? null : { col: f.col, value };
  }).filter(Boolean);
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
    if (input.type === 'checkbox') input.checked = f.original === true;
    else input.value = f.original;
  });
  if (!hasHeader && mode === 'edit') {
    $$('[data-empty]', el).forEach((box) => { if (Number(box.dataset.field) !== focusCol) box.hidden = true; });
  }
  $$('textarea', el).forEach(autosize);
  $(`tr[data-row="${row}"]`, els.grid)?.classList.add('is-active');

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
  if (!(await loadSheet(sheet, { keepScroll: true }))) {
    setStatus(out.error, true);
    return;
  }
  if (mode === 'add') openPanel('add', 0, 0, { notice: out.error, typed: notes });
  else if (app.doc.sheet.index.has(row)) openPanel('edit', row, 0, { notice: out.error, typed: notes });
  else toast(out.error, { timeout: 8000 });
}

async function save() {
  if (!panel || panel.busy) return;
  panelError('');
  const sh = app.doc.sheet;
  const { mode, row } = panel;
  if (mode === 'add') {
    // Khi thêm dòng, khung có đủ mọi cột theo thứ tự: values[c - 1] là ô của cột c
    const values = panel.fields.map((f) => {
      const input = inputOf(f);
      if (!input || f.locked) return '';
      return input.type === 'checkbox' ? input.checked : input.value;
    });
    const typed = panel.fields.map((f, k) => ({ col: f.col, value: values[k], preset: values[k] === f.original }))
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
    toast(`Đã thêm dòng ${out.row} vào “${sh.name}”.`);
    if (await loadSheet(sh.name, { keepScroll: true })) {
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
  if (out.saved) mergeRow(sh, row, out.row);
  renderGrid();
  if (out.message) toast(`Đã lưu dòng ${row}. Lưu ý: ${out.message}`, { timeout: 9000 });
  else toast(out.saved ? `Đã lưu dòng ${row}.` : 'Nội dung giống hệt trên Sheet: không có gì thay đổi.');
  // Công thức ở dòng khác có thể đổi theo; gán mã tải code đổi màu ô ở dòng khác
  if (out.saved && (out.reload || sh.formulas || (out.row && out.row.cells.length > sh.cols))) {
    loadSheet(sh.name, { keepScroll: true });
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
  toast(`Đã xoá dòng ${row}. Nội dung được lưu ở trang “${app.doc.log}”.`, { timeout: 6000 });
  loadSheet(sh.name, { keepScroll: true });
}

/* ---------- Khởi động ---------- */
function bind() {
  els.boot = $('[data-admin-boot]');
  els.login = $('[data-admin-login]');
  els.loginForm = $('[data-login-form]');
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
  els.userBox = $('[data-admin-user]');
  els.userName = $('[data-admin-name]');

  els.loginForm.addEventListener('submit', onLogin);
  $('[data-pass-toggle]').addEventListener('click', (e) => {
    const btn = e.currentTarget;
    const show = btn.getAttribute('aria-pressed') !== 'true';
    els.loginForm.elements.pass.type = show ? 'text' : 'password';
    btn.setAttribute('aria-pressed', String(show));
    btn.setAttribute('aria-label', show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu');
    $('use', btn).setAttribute('href', `assets/img/icons.svg#i-${show ? 'eye-off' : 'eye'}`);
  });
  $('[data-admin-logout]').addEventListener('click', logout);
  $('[data-admin-reload]').addEventListener('click', () => loadSheet(app.doc?.sheet.name, { keepScroll: true }));
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
      if (app.doc) renderGrid();
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
    if (app.doc) stickHead();
  });
}

async function start() {
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
  // Tab này còn phiên đăng nhập: mở thẳng trang tính (phiên hết hạn thì api() hiện khung đăng nhập)
  await loadSheet(lastSheet());
}

// Không cho trang khác nhúng trang quản trị vào khung (chống bấm nhầm qua lớp phủ)
if (window.top === window.self) {
  start();
} else {
  document.body.textContent = 'Trang quản trị chỉ mở trực tiếp tại smartcartech.vn/quan-tri.html.';
}
