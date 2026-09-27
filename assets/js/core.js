/* ==========================================================================
   SmartCarTech — core.js
   Shared by every page: data loading, formatting, icons, cart (localStorage),
   header menu, cart drawer, toast, Zalo/Shopee helpers.
   ========================================================================== */

export const DATA_URL = 'products.json';
const CART_KEY = 'sctech_cart_v1';
const ICONS = 'assets/img/icons.svg';
const MAX_QTY = 99;

/* ---------- DOM helpers ---------- */
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function icon(name, cls = '') {
  return `<svg class="icon ${cls}" aria-hidden="true" focusable="false"><use href="${ICONS}#i-${name}"></use></svg>`;
}

export function fmtPrice(n) {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return 'Liên hệ';
  return v.toLocaleString('vi-VN') + ' ₫';
}

export function digits(str) {
  return String(str ?? '').replace(/\D/g, '');
}

export function params() {
  return new URLSearchParams(location.search);
}

/* ---------- Data ---------- */
let dataPromise = null;

export function loadData() {
  if (!dataPromise) {
    dataPromise = fetch(DATA_URL, { cache: 'no-cache' })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      });
  }
  return dataPromise;
}

export function getLine(data, id) {
  return data.lines.find((l) => l.id === id) || data.lines[0];
}

export function getKit(line, id) {
  return line.kits.find((k) => k.id === id) || line.kits[0];
}

export function minPrice(line) {
  const prices = line.kits.map((k) => Number(k.price)).filter((p) => p > 0);
  return prices.length ? Math.min(...prices) : 0;
}

/* ---------- Links ---------- */
export function zaloUrl(site) {
  return `https://zalo.me/${digits(site.zalo)}`;
}

/** Point an <a> at `url`; if empty, keep it clickable but show a toast instead. */
export function setLink(el, url, emptyMsg = 'Nội dung này đang được cập nhật.') {
  if (!el) return;
  el.onclick = null;
  if (url) {
    el.href = url;
    el.removeAttribute('aria-disabled');
    if (/^https?:/i.test(url)) {
      el.target = '_blank';
      el.rel = 'noopener';
    }
  } else {
    el.href = '#';
    el.setAttribute('aria-disabled', 'true');
    el.removeAttribute('target');
    el.onclick = (e) => { e.preventDefault(); toast(emptyMsg); };
  }
}

/* ---------- Meta / SEO ---------- */
export const SITE_URL = 'https://smartcartech.vn';

/** `path` (e.g. "san-pham.html?dong=pro") sets the canonical URL for pages that change with ?dong. */
export function setMeta({ title, description, path }) {
  if (title) {
    document.title = title;
    $('meta[property="og:title"]')?.setAttribute('content', title);
  }
  if (description) {
    $('meta[name="description"]')?.setAttribute('content', description);
    $('meta[property="og:description"]')?.setAttribute('content', description);
  }
  if (path) {
    let link = $('link[rel="canonical"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'canonical';
      document.head.appendChild(link);
    }
    link.href = `${SITE_URL}/${path}`;
  }
}

export function setJsonLd(id, obj) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('script');
    el.type = 'application/ld+json';
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(obj);
}

/* ---------- Cart (localStorage) ---------- */
function readCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    return Array.isArray(raw) ? raw.filter((i) => i && i.line && i.kit && i.qty > 0) : [];
  } catch {
    return [];
  }
}

function writeCart(items) {
  try { localStorage.setItem(CART_KEY, JSON.stringify(items)); } catch { /* private mode: cart lives in memory only */ }
  memoryCart = items;
  window.dispatchEvent(new CustomEvent('cart:change'));
}

let memoryCart = null;

export const cart = {
  items() { return memoryCart ?? (memoryCart = readCart()); },
  count() { return this.items().reduce((s, i) => s + i.qty, 0); },
  add(line, kit, qty = 1) {
    const items = this.items().map((i) => ({ ...i }));
    const found = items.find((i) => i.line === line && i.kit === kit);
    if (found) found.qty = Math.min(MAX_QTY, found.qty + qty);
    else items.push({ line, kit, qty: Math.min(MAX_QTY, qty) });
    writeCart(items);
  },
  setQty(line, kit, qty) {
    const items = this.items()
      .map((i) => (i.line === line && i.kit === kit ? { ...i, qty: Math.max(0, Math.min(MAX_QTY, qty)) } : i))
      .filter((i) => i.qty > 0);
    writeCart(items);
  },
  remove(line, kit) { writeCart(this.items().filter((i) => !(i.line === line && i.kit === kit))); },
  clear() { writeCart([]); },
};

window.addEventListener('storage', (e) => {
  if (e.key === CART_KEY) {
    memoryCart = null;
    window.dispatchEvent(new CustomEvent('cart:change'));
  }
});

/** Resolve stored {line, kit, qty} into display rows with current prices. */
export function resolveItems(data, items) {
  return items
    .map((i) => {
      const line = data.lines.find((l) => l.id === i.line);
      const kit = line?.kits.find((k) => k.id === i.kit);
      if (!line || !kit) return null;
      const price = Number(kit.price) || 0;
      return { line, kit, qty: i.qty, price, total: price * i.qty };
    })
    .filter(Boolean);
}

/* ---------- Buy actions ---------- */
export function checkoutUrl(lineId, kitId, qty = 1) {
  return `dat-hang.html?mua=${encodeURIComponent(`${lineId}:${kitId}:${qty}`)}`;
}

export function buyNow(lineId, kitId, qty = 1) {
  location.href = checkoutUrl(lineId, kitId, qty);
}

export function addToCart(data, lineId, kitId, qty = 1) {
  const line = getLine(data, lineId);
  const kit = getKit(line, kitId);
  cart.add(line.id, kit.id, qty);
  const badge = $('.cart-count');
  if (badge) {
    badge.classList.remove('is-bump');
    void badge.offsetWidth;
    badge.classList.add('is-bump');
  }
  toast(`Đã thêm <strong>${esc(line.name)} – ${esc(kit.short || kit.name)}</strong> × ${qty} vào giỏ.`, {
    html: true,
    action: { label: 'Xem giỏ', onClick: openCart },
  });
}

/* ---------- Toast ---------- */
export function toast(message, { html = false, action = null, timeout = 4000 } = {}) {
  let region = $('.toast-region');
  if (!region) {
    region = document.createElement('div');
    region.className = 'toast-region';
    region.setAttribute('role', 'status');
    region.setAttribute('aria-live', 'polite');
    document.body.appendChild(region);
  }
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `${icon('check', 'icon--md')}<span class="toast__msg"></span>`;
  const msg = $('.toast__msg', el);
  if (html) msg.innerHTML = message; else msg.textContent = message;
  if (action) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn btn--outline-accent btn--sm toast__action';
    btn.textContent = action.label;
    btn.addEventListener('click', () => { el.remove(); action.onClick(); });
    el.appendChild(btn);
  }
  region.appendChild(el);
  setTimeout(() => el.remove(), timeout);
}

/* ---------- Clipboard ---------- */
export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    ta.remove();
    return ok;
  }
}

/** Send a lead/order to the optional endpoint (Google Apps Script…). Never throws. */
export async function postToEndpoint(site, payload) {
  if (!site.order_endpoint) return false;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    await fetch(site.order_endpoint, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    return true;
  } catch {
    return false;
  }
}

export const PHONE_RE = /^(0|\+?84)(3|5|7|8|9)\d{8}$/;
export function normalizePhone(v) {
  return String(v || '').replace(/[\s.\-()]/g, '');
}

/* ---------- Form helpers ---------- */
/** Show/clear an inline error for a field (uses its aria-describedby element). */
export function fieldError(input, msg) {
  const err = document.getElementById(input.getAttribute('aria-describedby') || '');
  input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  if (err) err.textContent = msg || '';
  return !msg;
}

/**
 * Result panel after a form is submitted: the message is already on the clipboard,
 * the customer opens Zalo and pastes it to the shop.
 */
export function renderSendResult(el, { site, title, message, copied, resetLabel, onReset }) {
  const zalo = zaloUrl(site);
  el.innerHTML = `
    <div class="send-result__head">
      <span class="icon-ring">${icon('check')}</span>
      <div>
        <h3 class="send-result__title">${esc(title)}</h3>
        <p class="send-result__sub">Còn 1 bước: gửi nội dung này cho shop qua Zalo.</p>
      </div>
    </div>
    <ol class="send-steps" role="list">
      <li><span class="num-dot" aria-hidden="true">1</span><span>${copied
        ? 'Nội dung đã được <strong>sao chép sẵn</strong>.'
        : 'Bấm <strong>Sao chép nội dung</strong> bên dưới.'}</span></li>
      <li><span class="num-dot" aria-hidden="true">2</span><span>Bấm <strong>Mở Zalo</strong>, dán vào ô chat (nhấn giữ → Dán) rồi bấm Gửi.</span></li>
    </ol>
    <div class="send-result__actions">
      <a class="btn btn--primary" href="${esc(zalo)}" target="_blank" rel="noopener" data-open-zalo>${icon('chat')} Mở Zalo gửi cho shop</a>
      <button type="button" class="btn btn--ghost" data-copy>${icon('copy')} ${copied ? 'Sao chép lại nội dung' : 'Sao chép nội dung'}</button>
    </div>
    <div class="field">
      <label class="field__label" for="${el.id || 'send'}-msg">Nội dung sẽ gửi</label>
      <textarea class="field__input send-result__msg" id="${el.id || 'send'}-msg" rows="7" readonly>${esc(message)}</textarea>
    </div>
    ${onReset ? `<button type="button" class="link-arrow" data-reset>${esc(resetLabel)}</button>` : ''}`;

  $('[data-open-zalo]', el).addEventListener('click', () => { copyText(message); });
  $('[data-copy]', el).addEventListener('click', async () => {
    const ok = await copyText(message);
    toast(ok ? 'Đã sao chép nội dung.' : 'Trình duyệt chặn sao chép — hãy chọn và sao chép nội dung trong ô bên dưới.');
  });
  if (onReset) $('[data-reset]', el).addEventListener('click', onReset);
}

/* ---------- Focus trap for dialogs ---------- */
function trapFocus(container, e) {
  if (e.key !== 'Tab') return;
  const f = $$('a[href], button:not([disabled]), input, textarea, [tabindex]:not([tabindex="-1"])', container)
    .filter((el) => el.offsetParent !== null);
  if (!f.length) return;
  const first = f[0];
  const last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/* ---------- Cart drawer ---------- */
let drawer = null;
let overlay = null;
let lastFocus = null;
let shellData = null;

function buildDrawer() {
  overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.hidden = true;
  overlay.addEventListener('click', closeCart);

  drawer = document.createElement('aside');
  drawer.className = 'drawer';
  drawer.id = 'cart-drawer';
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  drawer.setAttribute('aria-labelledby', 'cart-title');
  drawer.innerHTML = `
    <div class="drawer__head">
      <h2 class="drawer__title" id="cart-title">Giỏ hàng</h2>
      <button type="button" class="icon-btn" data-cart-close aria-label="Đóng giỏ hàng">${icon('close')}</button>
    </div>
    <div class="drawer__body" data-cart-body></div>
    <div class="drawer__foot" data-cart-foot></div>`;
  drawer.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeCart();
    trapFocus(drawer, e);
  });
  $('[data-cart-close]', drawer).addEventListener('click', closeCart);
  drawer.addEventListener('click', onDrawerClick);

  document.body.append(overlay, drawer);
}

function onDrawerClick(e) {
  const btn = e.target.closest('[data-cart-act]');
  if (!btn) return;
  const { line, kit } = btn.dataset;
  const item = cart.items().find((i) => i.line === line && i.kit === kit);
  if (!item) return;
  const act = btn.dataset.cartAct;
  if (act === 'inc') cart.setQty(line, kit, item.qty + 1);
  if (act === 'dec') cart.setQty(line, kit, item.qty - 1);
  if (act === 'remove') cart.remove(line, kit);
  // keep focus inside the drawer after re-render
  requestAnimationFrame(() => {
    const again = $(`[data-cart-act="${act}"][data-line="${line}"][data-kit="${kit}"]`, drawer);
    (again || $('[data-cart-close]', drawer)).focus();
  });
}

function renderDrawer() {
  if (!drawer || !shellData) return;
  const rows = resolveItems(shellData, cart.items());
  const body = $('[data-cart-body]', drawer);
  const foot = $('[data-cart-foot]', drawer);
  $('#cart-title', drawer).textContent = `Giỏ hàng (${cart.count()})`;

  if (!rows.length) {
    body.innerHTML = `
      <div class="cart-empty">
        <span class="icon-ring">${icon('cart')}</span>
        <p>Giỏ hàng đang trống.</p>
        <a class="btn btn--outline btn--md" href="san-pham.html">Xem sản phẩm</a>
      </div>`;
    foot.hidden = true;
    return;
  }

  body.innerHTML = rows.map((r) => `
    <div class="line-item">
      <img class="line-item__img" src="${esc(r.line.image.thumb)}" alt="" width="72" height="56" loading="lazy">
      <div class="line-item__info">
        <span class="line-item__name">${esc(r.line.name)}</span>
        <span class="line-item__kit">${esc(r.kit.name)} · ${fmtPrice(r.price)}</span>
        <div class="line-item__row">
          <div class="qty qty--sm" role="group" aria-label="Số lượng ${esc(r.line.name)} ${esc(r.kit.name)}">
            <button type="button" class="qty__btn" data-cart-act="dec" data-line="${r.line.id}" data-kit="${r.kit.id}" aria-label="Giảm số lượng">${icon('minus')}</button>
            <span class="qty__val" aria-live="polite">${r.qty}</span>
            <button type="button" class="qty__btn" data-cart-act="inc" data-line="${r.line.id}" data-kit="${r.kit.id}" aria-label="Tăng số lượng" ${r.qty >= MAX_QTY ? 'disabled' : ''}>${icon('plus')}</button>
          </div>
          <span class="price line-item__price">${fmtPrice(r.total)}</span>
          <button type="button" class="icon-btn line-item__remove" data-cart-act="remove" data-line="${r.line.id}" data-kit="${r.kit.id}" aria-label="Xóa ${esc(r.line.name)} – ${esc(r.kit.name)} khỏi giỏ">${icon('trash', 'icon--md')}</button>
        </div>
      </div>
    </div>`).join('');

  const total = rows.reduce((s, r) => s + r.total, 0);
  foot.hidden = false;
  foot.innerHTML = `
    <div class="drawer__total"><span>Tạm tính</span><span class="price">${fmtPrice(total)}</span></div>
    <p class="drawer__hint">Miễn phí vận chuyển toàn quốc.</p>
    <a class="btn btn--primary btn--block" href="dat-hang.html?tu=gio-hang">Đặt hàng</a>`;
}

export function openCart() {
  if (!drawer) buildDrawer();
  renderDrawer();
  lastFocus = document.activeElement;
  overlay.hidden = false;
  requestAnimationFrame(() => {
    overlay.classList.add('is-open');
    drawer.classList.add('is-open');
    $('[data-cart-close]', drawer).focus();
  });
  document.documentElement.style.overflow = 'hidden';
}

export function closeCart() {
  if (!drawer) return;
  overlay.classList.remove('is-open');
  drawer.classList.remove('is-open');
  setTimeout(() => { overlay.hidden = true; }, 250);
  document.documentElement.style.overflow = '';
  lastFocus?.focus?.();
}

function updateBadge() {
  const n = cart.count();
  $$('.cart-count').forEach((b) => { b.textContent = n; });
  $$('[data-cart-open]').forEach((b) => b.setAttribute('aria-label', `Giỏ hàng, ${n} sản phẩm`));
}

/* ---------- Mobile menu ---------- */
function initMenu() {
  const btn = $('.menu-toggle');
  const nav = $('#mobile-nav');
  if (!btn || !nav) return;
  const set = (open) => {
    btn.setAttribute('aria-expanded', String(open));
    btn.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
    $('use', btn).setAttribute('href', `${ICONS}#i-${open ? 'close' : 'menu'}`);
    nav.hidden = !open;
  };
  btn.addEventListener('click', () => set(btn.getAttribute('aria-expanded') !== 'true'));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) set(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && btn.getAttribute('aria-expanded') === 'true') { set(false); btn.focus(); }
  });
  document.addEventListener('click', (e) => {
    if (btn.getAttribute('aria-expanded') === 'true' && !e.target.closest('.site-header')) set(false);
  });
}

/* ---------- Bind site-wide data (contact info, links) ---------- */
function bindSite(site) {
  $$('[data-site]').forEach((el) => {
    const v = site[el.dataset.site];
    if (v != null) el.textContent = v;
  });
  $$('[data-href="zalo"]').forEach((el) => {
    el.href = zaloUrl(site);
    el.target = '_blank';
    el.rel = 'noopener';
  });
  $$('[data-href="tel"]').forEach((el) => { el.href = `tel:${digits(site.hotline)}`; });
  $$('[data-href="mail"]').forEach((el) => { el.href = `mailto:${site.email}`; });
  ['facebook', 'tiktok', 'youtube'].forEach((key) => {
    $$(`[data-href="${key}"]`).forEach((el) => setLink(el, site[`${key}_url`], 'Trang này đang được cập nhật.'));
  });
  $$('[data-href="warranty"]').forEach((el) => setLink(el, site.warranty_url, 'Chính sách bảo hành đang được cập nhật.'));
  $$('[data-href="shipping"]').forEach((el) => setLink(el, site.shipping_url, 'Chính sách vận chuyển & đổi trả đang được cập nhật.'));
}

function showDataError(err) {
  console.error('[SmartCarTech] Không tải được products.json:', err);
  const box = document.createElement('p');
  box.className = 'data-error';
  box.setAttribute('role', 'alert');
  box.textContent = 'Không tải được dữ liệu sản phẩm (products.json). Nếu bạn đang mở file trực tiếp trên máy, hãy chạy qua một web server — xem README.';
  $('main')?.prepend(box);
}

/**
 * Boot a page: load data, wire the header/footer/cart, then run the page init.
 * @param {(data: object) => void} pageInit
 */
export async function boot(pageInit) {
  initMenu();
  $$('[data-cart-open]').forEach((b) => b.addEventListener('click', openCart));
  updateBadge();
  window.addEventListener('cart:change', () => { updateBadge(); renderDrawer(); });
  $('#year') && ($('#year').textContent = new Date().getFullYear());

  let data;
  try {
    data = await loadData();
  } catch (err) {
    showDataError(err);
    return;
  }
  shellData = data;
  bindSite(data.site);
  document.body.classList.add('is-ready');
  pageInit?.(data);
  // Content above an anchor is rendered async; re-align to #hash once it exists.
  if (location.hash.length > 1) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
  }
}
