/* ==========================================================================
   SmartCarTech — core.js
   Shared by every page: data loading, formatting, icons, cart (localStorage),
   header menu, cart drawer, toast, sending forms to the shop, Zalo/Shopee helpers.
   ========================================================================== */

export const DATA_URL = 'products.json';
const CART_KEY = 'sctech_cart_v1';
const SEEN_KEY = 'sctech_seen';                   // day / month / year this browser was last counted
export const NO_COUNT_KEY = 'sctech_khong_dem';   // set by quan-tri.html: the shop's own browsers are not counted
const COUNT_HOST = 'smartcartech.vn';             // only the live site counts (not local copies, previews)
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
async function copyText(text) {
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

/**
 * Send an order/lead to the shop's Google Sheet (Apps Script at site.order_endpoint). Never throws.
 * Resolves to the script's answer: "ok" (row saved), "busy" (too many sends), "invalid" (rejected data),
 * or "network" when the script couldn't be reached.
 */
async function postToEndpoint(site, payload) {
  if (!site.order_endpoint) return 'error';
  try {
    // text/plain keeps this a simple request (no CORS preflight), so the script's answer can be read
    const res = await fetch(site.order_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    });
    return res.ok ? (await res.text()).trim() : 'error';
  } catch {
    return 'network';
  }
}

/** What to tell the customer when the script didn't save the form, by its answer (see postToEndpoint). */
const SEND_FAILED = {
  network: 'Kiểm tra kết nối mạng rồi bấm gửi lại',
  busy: 'Đang có quá nhiều lượt gửi, vui lòng đợi khoảng 10 phút rồi bấm gửi lại',
  invalid: 'Shop chưa nhận được thông tin này (có thể sản phẩm vừa được cập nhật), vui lòng tải lại trang rồi gửi lại',
  error: 'Vui lòng thử lại sau ít phút',
};

/**
 * Submit a form to the shop: the button shows `busyLabel` while sending. If the Sheet can't be reached,
 * `errorEl` says so and offers Zalo instead (tapping it copies `message`, ready to paste in the chat).
 * Resolves true once the order/lead is saved.
 */
export async function sendToShop({ site, payload, message, button, busyLabel, errorEl }) {
  const label = button.innerHTML;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.textContent = busyLabel;
  errorEl.hidden = true;

  const reply = await postToEndpoint(site, payload);
  const saved = reply === 'ok';

  button.innerHTML = label;
  button.disabled = false;
  button.removeAttribute('aria-busy');
  if (!saved) {
    errorEl.innerHTML = `
      <p class="send-error__text">${icon('info', 'icon--md')}<span><strong>Chưa gửi được tới shop.</strong>
        ${Object.hasOwn(SEND_FAILED, reply) ? SEND_FAILED[reply] : SEND_FAILED.error}, hoặc bấm <strong>Gửi qua Zalo</strong>: nội dung sẽ được sao chép sẵn, bạn chỉ cần dán vào ô chat rồi gửi.</span></p>
      <a class="btn btn--ghost btn--sm" href="${esc(zaloUrl(site))}" target="_blank" rel="noopener">${icon('chat')} Gửi qua Zalo</a>`;
    $('a', errorEl).addEventListener('click', async () => {
      const copied = await copyText(message);
      toast(copied ? 'Đã sao chép nội dung — dán vào ô chat Zalo rồi gửi cho shop.' : 'Trình duyệt chặn sao chép — hãy nhắn cho shop thông tin bạn vừa điền.');
    });
    errorEl.hidden = false;
    errorEl.focus();
  }
  return saved;
}

export const PHONE_RE = /^(0|\+?84)(3|5|7|8|9)\d{8}$/;
export function normalizePhone(v) {
  return String(v || '').replace(/[\s.\-()]/g, '');
}

/** Code shown to the customer and saved in the Sheet, e.g. "SC260926-4821" (prefix + yymmdd + 4 digits). */
export function orderCode(prefix) {
  const d = new Date();
  const ymd = [d.getFullYear() % 100, d.getMonth() + 1, d.getDate()].map((n) => String(n).padStart(2, '0')).join('');
  return `${prefix}${ymd}-${Math.floor(1000 + Math.random() * 9000)}`;
}

/* ---------- Form helpers ---------- */
/** Show/clear an inline error for a field (the first element in its aria-describedby). */
export function fieldError(input, msg) {
  const err = document.getElementById((input.getAttribute('aria-describedby') || '').split(/\s+/)[0]);
  input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  if (err) err.textContent = msg || '';
  return !msg;
}

/**
 * Result panel once the shop's Google Sheet has the order/lead: nothing left for the customer to do.
 * `code`: order code shown after the title, never split across lines.
 * `details`: [label, value] rows to double-check (empty values skipped); `zaloHint` leads into a Zalo link.
 */
export function renderSendResult(el, { site, title, code = '', text, details = [], zaloHint = '', resetLabel, onReset }) {
  const rows = details.filter(([, value]) => value);
  el.innerHTML = `
    <div class="send-result__head">
      <span class="icon-ring">${icon('check')}</span>
      <div>
        <h3 class="send-result__title">${esc(title)}${code ? ` <span class="nowrap">#${esc(code)}</span>` : ''}</h3>
        <p class="send-result__sub">${esc(text)}</p>
      </div>
    </div>
    ${rows.length ? `<dl class="send-result__details">${rows.map(([label, value]) => `
      <div><dt>${esc(label)}</dt><dd>${esc(value)}</dd></div>`).join('')}
    </dl>` : ''}
    ${zaloHint ? `<p class="send-result__help">${esc(zaloHint)} <a href="${esc(zaloUrl(site))}" target="_blank" rel="noopener">Nhắn Zalo cho shop</a></p>` : ''}
    ${onReset ? `<button type="button" class="link-arrow" data-reset>${esc(resetLabel)}</button>` : ''}`;

  if (onReset) $('[data-reset]', el).addEventListener('click', onReset);
}

/* ---------- FAQ accordion (one open at a time) ---------- */
/** Render [{q, a}] into `list` as an accordion; the first answer starts open. */
export function renderAccordion(list, items) {
  list.innerHTML = items.map((f, i) => `
    <div class="acc-item">
      <h3>
        <button type="button" class="acc-item__btn" id="faq-q-${i}" aria-expanded="${i === 0}" aria-controls="faq-a-${i}">
          <span>${esc(f.q)}</span>
          <span class="acc-item__sign" aria-hidden="true">${icon('plus', 'i-plus')}${icon('minus', 'i-minus')}</span>
        </button>
      </h3>
      <div class="acc-item__panel${i === 0 ? ' is-open' : ''}" id="faq-a-${i}" role="region" aria-labelledby="faq-q-${i}"${i === 0 ? '' : ' inert'}>
        <div><p>${esc(f.a)}</p></div>
      </div>
    </div>`).join('');

  list.addEventListener('click', (e) => {
    const btn = e.target.closest('.acc-item__btn');
    if (!btn) return;
    const willOpen = btn.getAttribute('aria-expanded') !== 'true';
    $$('.acc-item__btn', list).forEach((b) => {
      const open = b === btn && willOpen;
      b.setAttribute('aria-expanded', String(open));
      const panel = document.getElementById(b.getAttribute('aria-controls'));
      panel.classList.toggle('is-open', open);
      panel.inert = !open;
    });
  });
}

/* ---------- Focus trap for dialogs ---------- */
export function trapFocus(container, e) {
  if (e.key !== 'Tab') return;
  const f = $$('a[href], button:not([disabled]), input, select, textarea, video[controls], [tabindex]:not([tabindex="-1"])', container)
    .filter((el) => el.offsetParent !== null);
  if (!f.length) return;
  const first = f[0];
  const last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
  else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

/* ---------- Lightbox: enlarged photo or video ---------- */
/**
 * Full-screen viewer. `items`: one or more { src, alt, caption } photos or { video, poster, alt, caption } MP4 clips.
 * With several items, the arrow buttons and ←/→ keys step through them. Esc or a click outside closes it and
 * focus goes back to `opener` (Safari does not focus a button on click, so pass the button that was clicked).
 */
export function openLightbox(items, start = 0, opener = null) {
  const list = Array.isArray(items) ? items : [items];
  const many = list.length > 1;
  let index = 0;
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.innerHTML = `
    <div class="lightbox__stage" data-lb-stage></div>
    <p class="lightbox__caption" data-lb-caption></p>
    ${many ? `
    <button type="button" class="icon-btn lightbox__nav lightbox__nav--prev" data-lb-step="-1" aria-label="Xem ảnh trước">${icon('chevron-right')}</button>
    <button type="button" class="icon-btn lightbox__nav lightbox__nav--next" data-lb-step="1" aria-label="Xem ảnh sau">${icon('chevron-right')}</button>` : ''}
    <button type="button" class="icon-btn lightbox__close" aria-label="Đóng">${icon('close')}</button>`;
  const stage = $('[data-lb-stage]', box);
  const caption = $('[data-lb-caption]', box);

  function show(i) {
    index = (i + list.length) % list.length;
    const item = list[index];
    // Replacing the stage also stops a clip that was playing
    stage.innerHTML = item.video
      ? `<video src="${esc(item.video)}"${item.poster ? ` poster="${esc(item.poster)}"` : ''} controls autoplay muted playsinline preload="auto" aria-label="${esc(item.alt || 'Video')}"></video>`
      : `<img src="${esc(item.src)}" alt="${esc(item.alt || '')}">`;
    box.setAttribute('aria-label', item.alt || 'Xem ảnh');
    caption.textContent = [item.caption, many ? `${index + 1} / ${list.length}` : ''].filter(Boolean).join(' · ');
    caption.hidden = !caption.textContent;
  }

  const last = opener || document.activeElement;
  const close = () => {
    box.remove();
    document.documentElement.style.overflow = '';
    last?.focus?.();
  };
  box.addEventListener('click', (e) => {
    const step = e.target.closest('[data-lb-step]');
    if (step) show(index + Number(step.dataset.lbStep));
    else if (e.target === box || e.target === stage || e.target.closest('.lightbox__close')) close();
  });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    // ←/→ on a focused video seek inside the clip instead
    else if (many && (e.key === 'ArrowLeft' || e.key === 'ArrowRight') && e.target.tagName !== 'VIDEO') {
      show(index + (e.key === 'ArrowLeft' ? -1 : 1));
    } else trapFocus(box, e);
  });
  document.body.appendChild(box);
  document.documentElement.style.overflow = 'hidden';
  show(start);
  $('.lightbox__close', box).focus();
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
      <img class="line-item__img" src="${esc((r.kit.image || r.line.image).thumb)}" alt="" width="72" height="56" loading="lazy">
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
 * Count this page view in the shop's Google Sheet, anonymously: no cookie, no id, nothing about the visitor. The
 * browser only remembers the day it was last counted, to tell the Sheet whether this is its first view today /
 * this month / this year. Skipped for bots, other hosts and browsers that opened the admin page. Fire-and-forget.
 */
function countVisit(site) {
  try {
    if (location.hostname !== COUNT_HOST || !site?.order_endpoint || !navigator.sendBeacon) return;
    if (navigator.webdriver || /bot|crawl|spider|slurp|headless|lighthouse|preview/i.test(navigator.userAgent)) return;
    if (localStorage.getItem(NO_COUNT_KEY)) return;
    const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()).split('-');
    const now = { d: `${y}-${m}-${d}`, m: `${y}-${m}`, y };
    let seen = {};
    try { seen = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') || {}; } catch { seen = {}; }
    localStorage.setItem(SEEN_KEY, JSON.stringify(now));
    const first = (key) => (seen[key] === now[key] ? 0 : 1);
    const body = JSON.stringify({ type: 'luot-xem', d: first('d'), m: first('m'), y: first('y') });
    navigator.sendBeacon(site.order_endpoint, new Blob([body], { type: 'text/plain;charset=utf-8' }));
  } catch { /* storage blocked (private mode in some browsers): not counted */ }
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
  countVisit(data.site);
  document.body.classList.add('is-ready');
  pageInit?.(data);
  // Content above an anchor is rendered async; re-align to #hash once it exists.
  if (location.hash.length > 1) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (target) requestAnimationFrame(() => target.scrollIntoView({ block: 'start' }));
  }
}
