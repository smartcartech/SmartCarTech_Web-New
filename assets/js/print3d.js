/* SmartCarTech — Trang In 3D theo yêu cầu (in-3d.html)
   - Bảng tên để bàn: kiểu 1 hoặc 2 tầng, chữ, kiểu chữ, icon trước và sau tên, màu từng phần (tối đa 4 màu).
     Hình xem trước vẽ bằng SVG giống sản phẩm thật: chữ nổi đứng trên đế bám theo dáng chữ.
   - Giá đỡ điện thoại in tên: tên khắc (in hoa) và màu → hình thanh giá đỡ đang gập.
   - In theo file: form báo giá; file, ảnh trên máy khách gửi qua Zalo kèm mã yêu cầu.
   Nội dung lấy từ products.json → print3d. Đơn và yêu cầu lưu vào trang tính "In 3D"
   (google-apps-script.gs, type "in-3d"); giỏ hàng bộ xe không dùng ở trang này.
*/
import {
  boot, $, $$, esc, icon, fmtPrice, setMeta, renderAccordion, openLightbox,
  sendToShop, renderSendResult, fieldError, normalizePhone, PHONE_RE, orderCode,
} from './core.js';

const MAX_QTY = 99;
// Chữ in được: chữ cái (có dấu tiếng Việt), số và dấu câu thường dùng — font in không có emoji, ký hiệu lạ.
// Giống PLATE_TEXT_RE trong google-apps-script.gs
const PLATE_TEXT_RE = /^[\p{Script=Latin}\p{M}\p{Nd} .,:;!?&'"’‘“”()\/+\-–—#@*]*$/u;
const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const FOCUS_RE = /^\d{1,3}% \d{1,3}%$/;
const NO_ICON = 'khong';
// Tên trên giá đỡ: chữ in hoa đậm như mẫu thật
const STAND_FONT = { family: 'Be Vietnam Pro', weight: 800 };

const pick = (list, id) => list.find((x) => x.id === id) || list[0];
const byId = (list, id) => list.find((x) => x.id === id) || null;
const cleanText = (v) => String(v || '').normalize('NFC').replace(/\s+/g, ' ').trim();
const charCount = (v) => [...cleanText(v)].length;
const hexOf = (c) => (c && HEX_RE.test(c.hex || '') ? c.hex : '#888888');
const fontStack = (f) => `"${String(f.family).replace(/["\\]/g, '')}", var(--f-body)`;
// Tên font trong thuộc tính SVG phải có nháy: tên có chữ số (VD "Baloo 2") không nháy thì trình duyệt bỏ qua
const svgFamily = (family) => `'${String(family).replace(/["'\\<>&]/g, '')}'`;
const upper = (s) => s.toLocaleUpperCase('vi');
const num = (n) => Number(n.toFixed(1));

function rgbOf(hex) {
  const full = hex.length === 4 ? hex.replace(/^#(.)(.)(.)$/, '#$1$1$2$2$3$3') : hex;
  const n = parseInt(full.slice(1), 16);
  return [16, 8, 0].map((bit) => (n >> bit) & 255);
}
/** Màu tối hơn (amount < 0) hoặc sáng hơn (amount > 0). */
function shade(hex, amount) {
  const rgb = rgbOf(hex).map((v) => Math.round(amount < 0 ? v * (1 + amount) : v + (255 - v) * amount));
  return `rgb(${rgb.join(', ')})`;
}
/** Mặt khuất của khối in (cạnh đế, vách chữ): tối hơn; nhựa đen thì sáng lên một chút để vẫn thấy khối. */
function side(hex, depth) {
  const [r, g, b] = rgbOf(hex);
  const luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
  return luma < 0.16 ? shade(hex, depth * 0.45) : shade(hex, -depth);
}

/** Tải các font cần vẽ từ Google Fonts, gộp các độ đậm của cùng một font. */
function loadFonts(fonts) {
  const weights = new Map();
  fonts.forEach((f) => {
    if (!weights.has(f.family)) weights.set(f.family, new Set());
    weights.get(f.family).add(Number(f.weight) || 400);
  });
  const query = [...weights]
    .map(([family, w]) => `family=${encodeURIComponent(family).replace(/%20/g, '+')}:wght@${[...w].sort((a, b) => a - b).join(';')}`)
    .join('&');
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${query}&display=swap`;
  document.head.appendChild(link);
}

/* ---------- Icon trên bảng tên ----------
   Khung 100 × 100. Mỗi lớp vẽ theo thứ tự: role "main" tô màu icon, "detail" tô màu chữ (lá cờ: màu cố định);
   `rim`: viền màu chi tiết quanh lớp. `scale`, `dx`, `dy` đưa hình về khung 100.
   TikTok, Facebook, YouTube vẽ theo Simple Icons (CC0, khung 24). Thêm icon mới: thêm hình ở đây và id trong
   products.json → print3d.nameplate.icons. */
const SI = 100 / 24;
const TIKTOK_D = 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z';
const FACEBOOK_D = 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.468.103a8.68 8.68 0 0 1 1.141.195v3.325a8.623 8.623 0 0 0-.653-.036 26.805 26.805 0 0 0-.733-.009c-.707 0-1.259.096-1.675.309a1.686 1.686 0 0 0-.679.622c-.258.42-.374.995-.374 1.752v1.297h3.919l-.386 2.103-.287 1.564h-3.246v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647Z';
const YOUTUBE_D = 'M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z';
const YOUTUBE_PLAY_D = 'M9.545 15.568V8.432L15.818 12l-6.273 3.568z';

/** Ngôi sao 5 cánh tâm (cx, cy), bán kính ngoài R. */
function starPath(cx, cy, R) {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = ((-90 + i * 36) * Math.PI) / 180;
    const r = i % 2 ? R * 0.4 : R;
    return `${num(cx + r * Math.cos(a))} ${num(cy + r * Math.sin(a))}`;
  });
  return `M${pts.join(' L')} Z`;
}

const ICON_SHAPES = {
  tiktok: [
    { role: 'detail', d: TIKTOK_D, scale: SI, dx: -5, dy: -4 }, // viền lệch như logo TikTok
    { role: 'main', d: TIKTOK_D, scale: SI },
  ],
  facebook: [
    { role: 'detail', circle: [50, 50.2, 46] }, // lộ ra ở chữ f
    { role: 'main', d: FACEBOOK_D, scale: SI },
  ],
  youtube: [
    { role: 'main', d: YOUTUBE_D, scale: SI },
    { role: 'detail', d: YOUTUBE_PLAY_D, scale: SI },
  ],
  'dien-thoai': [
    { role: 'main', d: 'M8 6A86 86 0 0 0 94 92L94 64A58 58 0 0 1 36 6Z' },
    { role: 'main', rect: [2, 0, 46, 24, 10] },
    { role: 'main', rect: [70, 52, 26, 46, 10] },
  ],
  'trai-tim': [
    { role: 'main', d: 'M50 88C22 67 5 51 5 33C5 18 16 8 30 8C39 8 46 13 50 21C54 13 61 8 70 8C84 8 95 18 95 33C95 51 78 67 50 88Z' },
  ],
  // Nơ như mẫu thật: hai quai, hai đuôi, nút giữa; viền mỗi phần in màu chữ (rim)
  no: [
    { role: 'main', rim: 4, d: 'M44 55L30 88Q38 85 42 90L52 58Z' },
    { role: 'main', rim: 4, d: 'M56 55L70 88Q62 85 58 90L48 58Z' },
    { role: 'main', rim: 4, d: 'M46 43C35 25 15 15 7 23C1 29 1 59 7 65C15 73 35 63 46 53Z' },
    { role: 'main', rim: 4, d: 'M54 43C65 25 85 15 93 23C99 29 99 59 93 65C85 73 65 63 54 53Z' },
    { role: 'main', rim: 4, circle: [50, 48, 9] },
  ],
  co: [
    { role: 'main', d: 'M6 24C22 16 36 16 50 22C64 28 78 28 94 20L94 76C78 84 64 84 50 78C36 72 22 72 6 80Z' },
    { role: 'detail', d: starPath(50, 50, 19) },
  ],
};

/**
 * Các lớp của một icon. mode "solid": cả hình một màu (đế, vách); "face": mặt icon (màu icon + chi tiết).
 * k: tỉ lệ khung 100 → đơn vị bảng; outline: viền đế (đơn vị bảng) khi vẽ đế.
 */
function iconLayers(id, mode, { k = 1, fill = '', main = '', detail = '', outline = 0 } = {}) {
  return (ICON_SHAPES[id] || []).map((layer) => {
    const moves = [
      layer.dx || layer.dy ? `translate(${layer.dx || 0} ${layer.dy || 0})` : '',
      layer.scale ? `scale(${num(layer.scale)})` : '',
    ].filter(Boolean).join(' ');
    let paint;
    if (mode === 'face') {
      paint = `fill="${layer.role === 'main' ? main : detail}"`;
      if (layer.rim) paint += ` stroke="${detail}" stroke-width="${layer.rim}" stroke-linejoin="round"`;
    } else if (outline) {
      // Viền đế dày đều ở mọi lớp: nét vẽ bị phóng theo transform nên chia lại
      const width = (2 * outline) / (k * (layer.scale || 1));
      paint = `fill="${fill}" stroke="${fill}" stroke-width="${num(width)}" stroke-linejoin="round"`;
    } else {
      paint = `fill="${fill}"`;
    }
    const tf = moves ? ` transform="${moves}"` : '';
    if (layer.circle) return `<circle cx="${layer.circle[0]}" cy="${layer.circle[1]}" r="${layer.circle[2]}"${tf} ${paint}/>`;
    if (layer.rect) {
      const [x, y, w, h, r] = layer.rect;
      return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}"${tf} ${paint}/>`;
    }
    return `<path d="${layer.d}"${tf} ${paint}/>`;
  }).join('');
}

/* ---------- Ảnh, video thực tế: bấm để phóng to ---------- */
function initMedia(section, media) {
  const list = $('[data-media]', section);
  const items = (media || []).filter((m) => m && (m.src || m.video));
  if (!items.length) {
    list.hidden = true;
    return;
  }
  list.innerHTML = items.map((m, i) => {
    const img = m.video ? m.poster : m.thumb || m.src_small || m.src;
    const srcset = !m.video && m.thumb && m.src_small
      ? ` srcset="${esc(m.thumb)} 324w, ${esc(m.src_small)} 640w" sizes="(min-width: 768px) 180px, 42vw"`
      : '';
    const focus = FOCUS_RE.test(m.focus || '') ? m.focus : '50% 50%';
    return `
      <li class="media-strip__item">
        <button type="button" class="media-tile" data-media-index="${i}" aria-label="${m.video ? 'Xem video' : 'Phóng to ảnh'}: ${esc(m.alt || '')}">
          <img src="${esc(img || '')}"${srcset} alt="" loading="lazy" decoding="async" style="object-position: ${focus}">
          ${m.video ? `<span class="media-tile__play" aria-hidden="true">${icon('play')}</span>` : ''}
          ${m.video && m.duration ? `<span class="media-tile__dur">${esc(m.duration)}</span>` : ''}
        </button>
      </li>`;
  }).join('');
  const viewer = items.map((m) => (m.video ? { video: m.video, poster: m.poster, alt: m.alt } : { src: m.src, alt: m.alt }));
  list.addEventListener('click', (e) => {
    const tile = e.target.closest('[data-media-index]');
    if (tile) openLightbox(viewer, Number(tile.dataset.mediaIndex), tile);
  });
}

/* ---------- Số lượng, người nhận, gửi đơn: dùng chung cho bảng tên và giá đỡ ---------- */
/** Gửi xong một đơn: điền sẵn tên, SĐT, địa chỉ vào các form khác còn trống để khách đặt tiếp khỏi gõ lại. */
function shareContact(order) {
  $$('[data-maker-form], [data-quote-form]').forEach((f) => {
    ['name', 'phone', 'address'].forEach((key) => {
      const el = f.elements[key];
      if (el && !el.value) el.value = order[key];
    });
  });
}

/**
 * opts: kind ("bang-ten" | "gia-do"), product (tên hiện trong tin nhắn), title (khi gửi xong), resetLabel,
 * unitPrice(), validate() → phần tử cần sửa hoặc null, design() → { payload, lines, details },
 * reset() (xoá chữ để đặt sản phẩm khác), focusFirst().
 */
function bindOrder(section, data, opts) {
  const form = $('[data-maker-form]', section);
  const result = $('[data-maker-result]', section);
  const { name, phone, address, note } = form.elements;
  let qty = 1;
  let code = ''; // giữ mã cũ khi khách phải bấm gửi lại, để shop nhận ra dòng gửi trùng

  const checks = {
    name: () => fieldError(name, name.value.trim() ? '' : 'Vui lòng nhập họ và tên.'),
    phone: () => fieldError(phone, PHONE_RE.test(normalizePhone(phone.value)) ? '' : 'Số điện thoại chưa đúng (VD: 0912 345 678).'),
    address: () => fieldError(address, address.value.trim().length >= 10 ? '' : 'Vui lòng nhập địa chỉ đầy đủ (số nhà, đường, phường/xã, tỉnh/thành).'),
  };
  [name, phone, address].forEach((el) => el.addEventListener('blur', () => el.value && checks[el.name]()));

  // Giá 0 (chưa có giá): chỉ hiện "Liên hệ", shop báo giá khi gọi xác nhận
  function renderTotals() {
    const price = opts.unitPrice();
    $('[data-price-row]', form).hidden = !price;
    $('[data-price]', form).textContent = fmtPrice(price);
    $('[data-total]', form).textContent = fmtPrice(price * qty);
    $('[data-qty-val]', form).textContent = qty;
    $('[data-qty="-1"]', form).disabled = qty <= 1;
    $('[data-qty="1"]', form).disabled = qty >= MAX_QTY;
  }

  form.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-qty]');
    if (!b) return;
    qty = Math.min(MAX_QTY, Math.max(1, qty + Number(b.dataset.qty)));
    renderTotals();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const problem = opts.validate();
    const contact = [checks.name(), checks.phone(), checks.address()];
    if (problem || contact.includes(false)) {
      (problem || form.querySelector('[aria-invalid="true"]'))?.focus();
      return;
    }
    if (!code) code = orderCode('IN');
    const design = opts.design();
    const price = opts.unitPrice();
    const order = {
      name: name.value.trim(),
      phone: normalizePhone(phone.value),
      address: address.value.trim(),
      note: note.value.trim(),
    };

    const saved = await sendToShop({
      site: data.site,
      payload: {
        type: 'in-3d',
        kind: opts.kind,
        code,
        ...order,
        // Script tính lại giá, kiểm tra lựa chọn theo products.json bằng các id; tên gửi kèm để vẫn lưu được
        // khi script chưa đọc được products.json
        ...design.payload,
        qty,
        price,
        total: price * qty,
        created_at: new Date().toISOString(),
      },
      message: [
        `ĐƠN ${upper(opts.product)} – SMARTCARTECH – #${code}`,
        ...design.lines,
        `Số lượng: ${qty}${price ? ` × ${fmtPrice(price)} = ${fmtPrice(price * qty)}` : ''}`,
        '----------------',
        `Người nhận: ${order.name}`,
        `SĐT: ${order.phone}`,
        `Địa chỉ: ${order.address.replace(/\s*\n\s*/g, ', ')}`,
        order.note ? `Ghi chú: ${order.note}` : '',
      ].filter(Boolean).join('\n'),
      button: $('[data-submit]', form),
      busyLabel: 'Đang gửi đơn…',
      errorEl: $('[data-send-error]', form),
    });
    if (!saved) return;

    shareContact(order);
    form.hidden = true;
    result.hidden = false;
    renderSendResult(result, {
      site: data.site,
      title: opts.title,
      code,
      text: `Shop sẽ gọi hoặc nhắn Zalo tới số ${order.phone}, gửi ảnh xem trước để bạn duyệt rồi mới in.`,
      details: [
        ...design.details,
        ['Số lượng', String(qty)],
        ['Người nhận', order.name],
        ['Địa chỉ', order.address],
        ['Ghi chú', order.note],
      ],
      zaloHint: 'Cần sửa đơn?',
      resetLabel: opts.resetLabel,
      onReset: () => {
        // Giữ người nhận để đặt tiếp cho nhanh
        code = '';
        qty = 1;
        note.value = '';
        opts.reset();
        result.hidden = true;
        form.hidden = false;
        renderTotals();
        opts.focusFirst();
      },
    });
    result.focus();
  });

  renderTotals();
  return { renderTotals };
}

/* ---------- Bảng tên để bàn ---------- */
// Đơn vị vẽ: cỡ chữ 100. outline: đế nhô ra quanh chữ; wall: chữ cao hơn đế; base: độ dày đế;
// lineGap: khe giữa nét chữ hai tầng (nhỏ hơn 2 × outline để đế hai tầng dính liền một khối).
const PLATE = { size: 100, outline: 16, wall: 9, base: 7, lineGap: 14, iconGap: 12, pad: 8 };
// Bảng dài cỡ này (khoảng 18–20 chữ) thì hình xem trước rộng hết khung; tên ngắn thì hình ngắn lại
const PLATE_FULL_WIDTH = 1250;
// Số ký tự tối đa của cả bảng: chữ mọi dòng (tính cả dấu cách) và icon (mỗi icon 1 ký tự)
const limitOf = (layout) => Number(layout.max_chars) || 19;
/** "a", "a hoặc b", "a, b hoặc c" */
const either = (list) => (list.length > 1 ? `${list.slice(0, -1).join(', ')} hoặc ${list[list.length - 1]}` : list[0] || '');
// Đo chữ: chiều rộng và chiều cao nét thật (dấu tiếng Việt, chân chữ g, y) của từng dòng
const measurer = document.createElement('canvas').getContext('2d');

function initNameplate(data, palette) {
  const cfg = data.print3d.nameplate || {};
  const section = $('[data-maker="nameplate"]');
  const layouts = (cfg.layouts || []).filter((l) => l.id && (l.lines === 1 || l.lines === 2));
  const fonts = (cfg.fonts || []).filter((f) => f.id && f.family);
  const icons = (cfg.icons || []).filter((ic) => ic.id === NO_ICON || ICON_SHAPES[ic.id]);
  if (!layouts.length || !fonts.length || palette.length < 2) {
    section.hidden = true; // products.json thiếu kiểu bảng, font hoặc màu: ẩn hẳn thay vì hiện khung trống
    return null;
  }
  if (!icons.some((ic) => ic.id === NO_ICON)) icons.unshift({ id: NO_ICON, name: 'Để trống' });
  initMedia(section, cfg.media);

  const maxColors = Number(cfg.max_colors) || 4;
  const def = cfg.default || {};
  const colorOr = (id, fallback) => (byId(palette, id) ? id : fallback);
  const iconOr = (id) => (byId(icons, id) ? id : NO_ICON);
  const state = {
    layout: pick(layouts, def.layout).id,
    font: pick(fonts, def.font).id,
    icons: { before: iconOr(def.icon_before), after: iconOr(def.icon_after) },
    colors: { body: colorOr(def.body, palette[0].id), text: colorOr(def.text, palette[1].id) },
    part: 'body',
  };
  ['before', 'after'].forEach((slot) => {
    state.colors[slot] = colorOr(byId(icons, state.icons[slot])?.color, state.colors.text);
  });

  const form = $('[data-maker-form]', section);
  const svg = $('[data-plate]', form);
  const { line1, line2 } = form.elements;
  const layout = () => pick(layouts, state.layout);
  const font = () => pick(fonts, state.font);
  const iconOf = (slot) => byId(icons, state.icons[slot]);
  const hasIcon = (slot) => state.icons[slot] !== NO_ICON;
  const colorOf = (id) => pick(palette, id);
  if (cfg.note) $('[data-maker-note]', form).textContent = cfg.note;
  $('[data-max-colors]', form).textContent = `(tối đa ${maxColors} màu)`;

  /* Lựa chọn */
  $('[data-layouts]', form).innerHTML = layouts.map((l) => `
    <button type="button" class="kit-opt" data-layout="${esc(l.id)}" aria-pressed="false">
      <span class="kit-opt__radio" aria-hidden="true"></span>
      <span class="kit-opt__body">
        <span class="kit-opt__name">${esc(l.name)}</span>
        <span class="kit-opt__note">${l.lines === 2 ? 'Hai dòng chữ xếp chồng' : 'Một dòng chữ'}, tối đa ${limitOf(l)} ký tự${l.lines === 2 ? ' cả hai dòng' : ''}</span>
      </span>
      <span class="kit-opt__price">${fmtPrice(l.price)}</span>
    </button>`).join('');
  $('[data-fonts]', form).innerHTML = fonts.map((f) => `
    <button type="button" class="pill-btn maker-font" data-font="${esc(f.id)}" aria-pressed="false"
            style="font-family: ${esc(fontStack(f))}; font-weight: ${Number(f.weight) || 400}">${esc(f.name)}</button>`).join('');
  const glyph = (ic) => {
    if (ic.id === NO_ICON) {
      return '<svg class="icon-choice__glyph" viewBox="0 0 100 100" aria-hidden="true"><rect x="16" y="16" width="68" height="68" rx="16" fill="none" stroke="currentColor" stroke-width="5" stroke-dasharray="11 9"/></svg>';
    }
    const [main, detail] = ic.fixed
      ? ic.fixed.map((id) => hexOf(colorOf(id)))
      : [hexOf(colorOf(colorOr(ic.color, palette[1].id))), '#FFFFFF'];
    return `<svg class="icon-choice__glyph" viewBox="-8 -8 116 116" aria-hidden="true">${iconLayers(ic.id, 'face', { main, detail })}</svg>`;
  };
  $$('[data-icons]', form).forEach((group) => {
    group.innerHTML = icons.map((ic) => `
      <button type="button" class="icon-choice" data-icon="${esc(ic.id)}" aria-pressed="false">
        <span class="icon-choice__tile">${glyph(ic)}</span>
        <span class="icon-choice__name">${esc(ic.name)}</span>
      </button>`).join('');
  });
  $('[data-palette]', form).innerHTML = palette.map((c) => `
    <button type="button" class="swatch-dot" data-color="${esc(c.id)}" aria-pressed="false" aria-label="${esc(c.name)}" title="${esc(c.name)}">
      <span style="background: ${hexOf(c)}"></span>
    </button>`).join('');

  /* Màu: các phần đang có trên bảng, số màu đang dùng */
  function parts() {
    const list = [{ id: 'body', label: 'Thân bảng' }, { id: 'text', label: 'Chữ' }];
    ['before', 'after'].forEach((slot) => {
      const ic = iconOf(slot);
      if (hasIcon(slot) && !ic.fixed) list.push({ id: slot, label: `${ic.name} (${slot === 'before' ? 'trước' : 'sau'})` });
    });
    return list;
  }
  function usedColors() {
    const ids = [state.colors.body, state.colors.text];
    ['before', 'after'].forEach((slot) => {
      if (!hasIcon(slot)) return;
      const ic = iconOf(slot);
      ids.push(...(ic.fixed || [state.colors[slot]]));
    });
    return [...new Set(ids)];
  }
  const colorCount = $('[data-color-count]', form);
  function renderColors() {
    const list = parts();
    if (!list.some((p) => p.id === state.part)) state.part = 'body';
    $('[data-color-parts]', form).innerHTML = list.map((p) => {
      const c = colorOf(state.colors[p.id]);
      return `
        <button type="button" class="color-part" data-part="${p.id}" aria-pressed="${p.id === state.part}">
          <span class="color-part__dot" style="background: ${hexOf(c)}" aria-hidden="true"></span>
          <span class="color-part__text"><span class="color-part__label">${esc(p.label)}</span><span class="color-part__value">${esc(c.name)}</span></span>
        </button>`;
    }).join('');
    const current = state.colors[state.part];
    const label = list.find((p) => p.id === state.part).label;
    $('[data-palette]', form).setAttribute('aria-label', `Bảng màu cho ${label.toLowerCase()}`);
    $$('[data-palette] [data-color]', form).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color === current)));

    const used = usedColors();
    const names = used.map((id) => colorOf(id).name).join(', ');
    const fixed = ['before', 'after'].map(iconOf).filter((ic) => ic && ic.fixed);
    const over = used.length > maxColors;
    colorCount.classList.toggle('is-over', over);
    colorCount.textContent = over
      ? `Bảng tên in tối đa ${maxColors} màu, bạn đang chọn ${used.length} màu (${names}). Hãy cho vài phần dùng chung một màu.`
      : `Đang dùng ${used.length}/${maxColors} màu: ${names}.${fixed.length ? ` ${fixed[0].name} luôn in đỏ sao vàng.` : ''}`;
  }

  /* Hình xem trước */
  function linesText() {
    const t1 = cleanText(line1.value) || line1.placeholder;
    const t2 = cleanText(line2.value) || line2.placeholder;
    return layout().lines === 2 ? [t1, t2] : [t1];
  }
  function renderPlate() {
    const f = font();
    const lines = linesText();
    const P = PLATE;
    const weight = Number(f.weight) || 400;

    // Đo bằng chính font đang chọn (font chưa tải xong thì đo tạm, tải xong vẽ lại)
    measurer.font = `${weight} ${P.size}px "${f.family}"`;
    const m = lines.map((t) => measurer.measureText(t));
    const width = Math.max(...m.map((x) => x.width), P.size);
    // Tầng 2 đặt ngay dưới chân chữ tầng 1, cách một khe nhỏ: chữ không chồng nhau mà đế vẫn liền
    const ys = [0, m[1] ? m[0].actualBoundingBoxDescent + P.lineGap + m[1].actualBoundingBoxAscent : 0];
    const inkTop = -m[0].actualBoundingBoxAscent;
    const inkBottom = ys[lines.length - 1] + m[lines.length - 1].actualBoundingBoxDescent;

    const fontAttrs = `font-family="${svgFamily(f.family)}" font-weight="${weight}" font-size="${P.size}" text-anchor="middle"`;
    const textEls = (paint) => lines
      .map((t, i) => `<text x="0" y="${num(ys[i])}" ${fontAttrs} ${paint}>${esc(t)}</text>`).join('');

    const two = lines.length === 2;
    // Icon cao bằng thân chữ một tầng; hai tầng thì cao gần bằng cả khối chữ, đặt giữa hai tầng
    const S = two ? Math.min(180, (ys[1] + 0.72 * P.size) * 0.82) : 104;
    const cy = (two ? ys[1] / 2 : 0) - 0.36 * P.size;
    const k = S / 100;
    const slots = {
      before: hasIcon('before') ? -width / 2 - P.iconGap - S : null,
      after: hasIcon('after') ? width / 2 + P.iconGap : null,
    };
    const body = hexOf(colorOf(state.colors.body));
    const text = hexOf(colorOf(state.colors.text));
    const iconsEl = (mode, opts) => ['before', 'after'].map((slot) => {
      if (slots[slot] === null) return '';
      const ic = iconOf(slot);
      const paints = mode === 'face'
        ? (ic.fixed
          ? { main: hexOf(colorOf(ic.fixed[0])), detail: hexOf(colorOf(ic.fixed[1] || ic.fixed[0])) }
          : { main: hexOf(colorOf(state.colors[slot])), detail: text })
        : {};
      return `<g transform="translate(${num(slots[slot])} ${num(cy - S / 2)}) scale(${num(k)})">${iconLayers(ic.id, mode, { k, ...opts, ...paints })}</g>`;
    }).join('');

    // Đế: chữ và icon tô kín, nét dày bao quanh nên dính liền thành một khối bám theo dáng chữ.
    // opacity đặt cho cả nhóm để chỗ các nét chồng nhau không đậm hơn
    const solid = (fill, outline, dy = 0, opacity = 1) => `
      <g transform="translate(0 ${dy})"${opacity < 1 ? ` opacity="${opacity}"` : ''}>
        ${textEls(`fill="${fill}" stroke="${fill}" stroke-width="${2 * outline}" stroke-linejoin="round"`)}
        ${iconsEl('solid', { fill, outline })}
      </g>`;
    const walls = Array.from({ length: 6 }, (_, i) => {
      const dy = -(P.wall * i) / 6;
      return `<g transform="translate(0 ${num(dy)})">${textEls(`fill="${side(body, 0.16)}"`)}${iconsEl('solid', { fill: side(body, 0.16) })}</g>`;
    }).join('');

    // Từ dưới lên: viền sáng mảnh (bảng màu tối vẫn tách khỏi nền), cạnh dày của đế, mặt đế,
    // vách chữ (chữ đứng cao hơn đế), mặt chữ và mặt icon
    svg.innerHTML = `
      ${solid('#FFFFFF', P.outline + 1.6, P.base, 0.16)}
      ${solid(side(body, 0.38), P.outline, P.base)}
      ${solid(body, P.outline)}
      ${walls}
      <g transform="translate(0 ${-P.wall})">
        ${textEls(`fill="${text}" stroke="${side(text, 0.22)}" stroke-width="1.2" paint-order="stroke"`)}
        ${iconsEl('face', {})}
      </g>`;

    const left = (slots.before ?? -width / 2) - P.outline - P.pad;
    const right = (slots.after !== null ? slots.after + S : width / 2) + P.outline + P.pad;
    const top = Math.min(inkTop, cy - S / 2) - P.wall - P.outline - P.pad;
    const bottom = Math.max(inkBottom, cy + S / 2) + P.outline + P.base + P.pad;
    svg.setAttribute('viewBox', `${num(left)} ${num(top)} ${num(right - left)} ${num(bottom - top)}`);
    svg.style.width = `${Math.min(100, ((right - left) / PLATE_FULL_WIDTH) * 100).toFixed(1)}%`;

    const iconNames = ['before', 'after'].filter(hasIcon).map((slot) => `${iconOf(slot).name} ${slot === 'before' ? 'trước' : 'sau'} tên`);
    svg.setAttribute('aria-label', [
      `Hình xem trước bảng tên ${layout().name}: ${lines.join(' / ')}`,
      `kiểu chữ ${f.name.toLowerCase()}`,
      iconNames.length ? `icon ${iconNames.join(', ')}` : 'không có icon',
      `thân ${colorOf(state.colors.body).name.toLowerCase()}, chữ ${colorOf(state.colors.text).name.toLowerCase()}`,
    ].join('; '));
  }

  /* Số ký tự của cả bảng: chữ mọi dòng (tính cả dấu cách) + mỗi icon 1 ký tự */
  const iconCount = () => ['before', 'after'].filter(hasIcon).length;
  const usedChars = () => charCount(line1.value) + (layout().lines === 2 ? charCount(line2.value) : 0) + iconCount();
  const charCountEl = $('[data-char-count]', form);
  function renderCharCount() {
    const l = layout();
    const used = usedChars();
    const max = limitOf(l);
    const icons = iconCount();
    const counted = `tính cả dấu cách${icons ? ` và ${icons} icon` : ''}`;
    charCountEl.classList.toggle('is-over', used > max);
    charCountEl.classList.toggle('is-full', used === max);
    if (used > max) {
      const fixes = ['bớt chữ', icons ? 'bỏ bớt icon' : '', l.lines === 1 && layouts.some((x) => limitOf(x) > max) ? 'chọn 2 tầng' : ''];
      charCountEl.textContent = `Bảng ${l.name} in tối đa ${max} ký tự${l.lines === 2 ? ' cho cả hai dòng' : ''}, bạn đang dùng ${used} (${counted}). Hãy ${either(fixes.filter(Boolean))}.`;
    } else if (used === max) {
      charCountEl.textContent = `Đã đủ ${used}/${max} ký tự (${counted}). Muốn thêm chữ thì bớt chữ khác${icons ? ' hoặc bỏ bớt icon' : ''}.`;
    } else {
      charCountEl.textContent = `Đã dùng ${used}/${max} ký tự (${counted}).`;
    }
  }

  /* Ô chữ: gõ tới giới hạn thì không nhận thêm; đổi icon hay kiểu bảng làm vượt thì bộ đếm báo đỏ */
  function renderFields() {
    const two = layout().lines === 2;
    $('[data-line2-field]', form).hidden = !two;
    line2.required = two;
    $('[data-line1-label]', form).textContent = two ? 'Dòng 1' : 'Chữ cần in';
    const room = limitOf(layout()) - iconCount();
    line1.maxLength = Math.max(0, room - (two ? charCount(line2.value) : 0));
    line2.maxLength = Math.max(0, room - charCount(line1.value));
    renderCharCount();
  }

  // Tóm tắt dưới hình xem trước: luôn thấy khi đang chọn (trên điện thoại hình xem trước dính trên cùng)
  const stageStatus = $('[data-stage-status]', section);
  function renderStatus() {
    const chars = usedChars();
    const colors = usedColors().length;
    stageStatus.innerHTML = `
      <span${chars > limitOf(layout()) ? ' class="is-over"' : ''}>${chars}/${limitOf(layout())} ký tự</span> ·
      <span${colors > maxColors ? ' class="is-over"' : ''}>${colors}/${maxColors} màu</span>`;
  }

  function render() {
    $$('[data-layout]', form).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.layout === state.layout)));
    $$('[data-font]', form).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.font === state.font)));
    $$('[data-icons]', form).forEach((group) => {
      const id = state.icons[group.dataset.icons];
      $$('[data-icon]', group).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.icon === id)));
    });
    renderFields();
    renderColors();
    renderStatus();
    renderPlate();
    totals?.renderTotals();
  }

  /* Kiểm tra */
  const checkLine = (el) => {
    const l = layout();
    const v = cleanText(el.value);
    let msg = '';
    if (el === line2 && l.lines !== 2) return fieldError(el, '');
    if (!v) msg = el === line1 ? 'Vui lòng nhập chữ cần in.' : 'Vui lòng nhập dòng 2, hoặc chọn kiểu 1 tầng.';
    else if (!PLATE_TEXT_RE.test(v)) msg = 'Chỉ dùng chữ, số và dấu câu thông thường (không dùng biểu tượng cảm xúc).';
    return fieldError(el, msg);
  };
  [line1, line2].forEach((el) => {
    el.addEventListener('input', () => {
      if (el.getAttribute('aria-invalid') === 'true') checkLine(el);
      render();
    });
    el.addEventListener('blur', () => el.value && checkLine(el));
  });

  form.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-layout], button[data-font], button[data-icon], button[data-part], button[data-color]');
    if (!b) return;
    if (b.dataset.layout) {
      state.layout = b.dataset.layout;
      [line1, line2].forEach((el) => (el.value || el.getAttribute('aria-invalid') === 'true') && checkLine(el));
    }
    if (b.dataset.font) state.font = b.dataset.font;
    if (b.dataset.icon) {
      const slot = b.closest('[data-icons]').dataset.icons;
      state.icons[slot] = b.dataset.icon;
      // Icon mới lấy màu quen thuộc của nó (TikTok đen, YouTube đỏ…), khách đổi lại được
      state.colors[slot] = colorOr(iconOf(slot).color, state.colors[slot]);
      if (hasIcon(slot) && !iconOf(slot).fixed) state.part = slot;
    }
    if (b.dataset.part) state.part = b.dataset.part;
    if (b.dataset.color) state.colors[state.part] = b.dataset.color;
    render();
    // Danh sách phần tô màu vẽ lại: giữ chỗ đang chọn cho người dùng bàn phím
    if (b.dataset.part) $(`[data-part="${state.part}"]`, form)?.focus();
  });

  const totals = bindOrder(section, data, {
    kind: 'bang-ten',
    product: 'bảng tên',
    title: 'Đã gửi đơn bảng tên',
    resetLabel: 'Đặt thêm bảng tên khác',
    unitPrice: () => Number(layout().price) || 0,
    validate: () => {
      const ok = [checkLine(line1), checkLine(line2)];
      if (ok.includes(false)) return form.querySelector('[aria-invalid="true"]');
      if (usedChars() > limitOf(layout())) return charCountEl;
      if (usedColors().length > maxColors) return colorCount;
      return null;
    },
    design: () => {
      const l = layout();
      const f = font();
      const lines = [cleanText(line1.value), l.lines === 2 ? cleanText(line2.value) : ''];
      const color = (part) => colorOf(state.colors[part]);
      const iconText = (slot) => {
        if (!hasIcon(slot)) return '';
        const ic = iconOf(slot);
        return `${ic.name} (${ic.fixed ? 'đỏ sao vàng' : color(slot).name.toLowerCase()})`;
      };
      const iconsText = [['trước', iconText('before')], ['sau', iconText('after')]]
        .filter(([, t]) => t).map(([where, t]) => `${t} ${where} tên`).join(', ') || 'Không có';
      const colorsText = `thân ${color('body').name.toLowerCase()}, chữ ${color('text').name.toLowerCase()} (${usedColors().length} màu)`;
      return {
        payload: {
          plate: {
            layout_id: l.id, layout: l.name,
            line1: lines[0], line2: lines[1],
            font_id: f.id, font: f.name,
            icon_before_id: state.icons.before, icon_before: iconOf('before').name,
            icon_after_id: state.icons.after, icon_after: iconOf('after').name,
            body_id: state.colors.body, body: color('body').name,
            text_id: state.colors.text, text: color('text').name,
            icon_before_color_id: state.colors.before, icon_before_color: color('before').name,
            icon_after_color_id: state.colors.after, icon_after_color: color('after').name,
          },
        },
        lines: [
          `Kiểu: ${l.name}`,
          ...lines.filter(Boolean).map((t, i) => (l.lines === 2 ? `Dòng ${i + 1}: ${t}` : `Chữ: ${t}`)),
          `Kiểu chữ: ${f.name}`,
          `Icon: ${iconsText}`,
          `Màu: ${colorsText}`,
        ],
        details: [
          ['Chữ in', lines.filter(Boolean).join(' / ')],
          ['Kiểu', `${l.name} · chữ ${f.name.toLowerCase()}`],
          ['Icon', iconsText],
          ['Màu', colorsText.charAt(0).toUpperCase() + colorsText.slice(1)],
        ],
      };
    },
    reset: () => {
      line1.value = '';
      line2.value = '';
      render();
    },
    focusFirst: () => line1.focus(),
  });

  render();
  return () => renderPlate();
}

/* ---------- Giá đỡ điện thoại in tên ---------- */
// Mặt bên của thanh giá đỡ khi gập (khung vẽ 620 × 132): vùng chữ, nắp tròn, tấm đỡ có khớp gập
const STAND = { textCenter: 228, textWidth: 360, baseline: 80, fontSize: 54 };
let standDraws = 0;

function initStand(data, palette) {
  const cfg = data.print3d.stand;
  const section = $('[data-maker="stand"]');
  if (!cfg || !palette.length) {
    section.hidden = true;
    return null;
  }
  initMedia(section, cfg.media);
  const form = $('[data-maker-form]', section);
  const svg = $('[data-stand]', form);
  const input = form.elements.text;
  const max = Number(cfg.max_chars) || 10;
  const state = { color: byId(palette, cfg.color) ? cfg.color : palette[0].id };
  const color = () => pick(palette, state.color);
  const label = () => upper(cleanText(input.value)) || input.placeholder;
  if (cfg.note) $('[data-maker-note]', form).textContent = cfg.note;
  input.maxLength = max;

  $('[data-palette]', form).innerHTML = palette.map((c) => `
    <button type="button" class="swatch-dot" data-color="${esc(c.id)}" aria-pressed="false" aria-label="${esc(c.name)}" title="${esc(c.name)}">
      <span style="background: ${hexOf(c)}"></span>
    </button>`).join('');

  function renderStand() {
    const hex = hexOf(color());
    const light = shade(hex, 0.3);
    const dark = side(hex, 0.3);
    const deep = side(hex, 0.48);
    const t = esc(label());
    const font = `font-family="${svgFamily(STAND_FONT.family)}" font-weight="${STAND_FONT.weight}" text-anchor="middle"`;
    const gradient = `stand-face-${(standDraws += 1)}`; // id mới mỗi lần vẽ: không trùng khi hình được sao chép
    svg.innerHTML = `
      <defs>
        <linearGradient id="${gradient}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="${light}"/>
          <stop offset="0.2" stop-color="${hex}"/>
          <stop offset="0.82" stop-color="${hex}"/>
          <stop offset="1" stop-color="${dark}"/>
        </linearGradient>
      </defs>
      <rect x="6" y="16" width="608" height="106" rx="30" fill="${deep}"/>
      <rect x="6" y="8" width="608" height="106" rx="30" fill="url(#${gradient})"/>
      <rect x="20" y="13" width="580" height="4" rx="2" fill="${light}" opacity="0.6"/>
      <text x="${STAND.textCenter}" y="${STAND.baseline + 1.6}" font-size="${STAND.fontSize}" ${font} fill="${light}">${t}</text>
      <text x="${STAND.textCenter}" y="${STAND.baseline}" font-size="${STAND.fontSize}" ${font} fill="${deep}" data-stand-text>${t}</text>
      <circle cx="452" cy="61" r="25" fill="${shade(hex, 0.06)}" stroke="${dark}" stroke-width="3"/>
      <path d="M488 26L584 26Q600 26 594 40L566 74Q558 83 550 74L530 56L488 56Z" fill="${shade(hex, 0.08)}" stroke="${dark}" stroke-width="3" stroke-linejoin="round"/>`;
    // Tên dài thì thu nhỏ chữ cho vừa vùng khắc
    const width = $('[data-stand-text]', svg).getComputedTextLength();
    if (width > STAND.textWidth) {
      const size = num((STAND.fontSize * STAND.textWidth) / width);
      $$('text', svg).forEach((el) => el.setAttribute('font-size', size));
    }
    svg.setAttribute('aria-label', `Hình xem trước: giá đỡ màu ${color().name.toLowerCase()}, khắc chữ ${label()}`);
  }

  function render() {
    const count = charCount(input.value);
    const counter = $('[data-count="text"]', form);
    counter.textContent = `${count}/${max}`;
    counter.classList.toggle('is-full', count >= max);
    $$('[data-palette] [data-color]', form).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.color === state.color)));
    $('[data-stand-color-name]', form).textContent = `· ${color().name}`;
    renderStand();
  }

  const checkText = () => {
    const v = cleanText(input.value);
    let msg = '';
    if (!v) msg = 'Vui lòng nhập tên cần khắc.';
    else if (!PLATE_TEXT_RE.test(v)) msg = 'Chỉ dùng chữ, số và dấu câu thông thường (không dùng biểu tượng cảm xúc).';
    else if (charCount(v) > max) msg = `Giá đỡ khắc tối đa ${max} ký tự.`;
    return fieldError(input, msg);
  };
  input.addEventListener('input', () => {
    if (input.getAttribute('aria-invalid') === 'true') checkText();
    render();
  });
  input.addEventListener('blur', () => input.value && checkText());
  form.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-color]');
    if (!b) return;
    state.color = b.dataset.color;
    render();
  });

  bindOrder(section, data, {
    kind: 'gia-do',
    product: 'giá đỡ điện thoại',
    title: 'Đã gửi đơn giá đỡ điện thoại',
    resetLabel: 'Đặt thêm giá đỡ khác',
    unitPrice: () => Number(cfg.price) || 0,
    validate: () => (checkText() ? null : input),
    design: () => {
      const text = upper(cleanText(input.value));
      return {
        payload: { stand: { text, color_id: state.color, color: color().name } },
        lines: [`Tên khắc: ${text}`, `Màu: ${color().name}`],
        details: [['Tên khắc', text], ['Màu', color().name]],
      };
    },
    reset: () => {
      input.value = '';
      render();
    },
    focusFirst: () => input.focus(),
  });

  render();
  return () => renderStand();
}

/* ---------- Thẻ sản phẩm đầu trang ---------- */
function initPicks(p3) {
  const firstPhoto = (media) => (media || []).find((m) => m && m.src && !m.video);
  // Giá trên thẻ: bảng tên có nhiều kiểu thì "Từ …" giá thấp nhất; chưa có giá thì không hiện
  const priceText = (prices) => {
    const known = prices.map(Number).filter((p) => p > 0);
    if (!known.length) return '';
    return `${known.length > 1 ? 'Từ ' : ''}${fmtPrice(Math.min(...known))}`;
  };
  const cards = [
    {
      href: '#bang-ten', item: p3.nameplate, photo: firstPhoto(p3.nameplate?.media), cta: 'Tạo bảng tên',
      price: priceText((p3.nameplate?.layouts || []).map((l) => l.price)),
    },
    { href: '#gia-do', item: p3.stand, photo: firstPhoto(p3.stand?.media), cta: 'Đặt giá đỡ', price: priceText([p3.stand?.price]) },
    { href: '#in-theo-file', item: p3.custom, photo: p3.custom?.photo, cta: 'Gửi yêu cầu báo giá', price: '' },
  ].filter((c) => c.item && c.item.name && !$(c.href)?.hidden);
  const list = $('[data-print-picks]');
  list.hidden = !cards.length;
  list.innerHTML = cards.map((c) => {
    const p = c.photo;
    const focus = p && FOCUS_RE.test(p.focus || '') ? p.focus : '50% 50%';
    const media = p ? `
      <span class="pick-card__media">
        <img src="${esc(p.src_small || p.src)}"${p.thumb && p.src_small ? ` srcset="${esc(p.thumb)} 324w, ${esc(p.src_small)} 640w" sizes="(min-width: 768px) 30vw, 104px"` : ''}
             alt="" decoding="async" style="object-position: ${focus}">
      </span>` : '';
    return `
      <li>
        <a class="pick-card" href="${c.href}">
          ${media}
          <span class="pick-card__body">
            <span class="pick-card__title">${esc(c.item.name)}</span>
            ${c.item.summary ? `<span class="pick-card__text">${esc(c.item.summary)}</span>` : ''}
            ${c.price ? `<span class="price pick-card__price">${esc(c.price)}</span>` : ''}
            <span class="pick-card__cta">${esc(c.cta)} ${icon('arrow-down')}</span>
          </span>
        </a>
      </li>`;
  }).join('');
}

/* ---------- In theo file: form báo giá ---------- */
/** "drive.google.com/…" → "https://drive.google.com/…" (khách hay dán link thiếu https://). */
function fixLink(value) {
  const s = String(value || '').trim();
  return s && !/^[a-z][a-z\d+.-]*:/i.test(s) && /^[^\s/]+\.[^\s/]+/.test(s) ? `https://${s}` : s;
}

function initQuote(data) {
  const custom = data.print3d.custom || {};
  const form = $('[data-quote-form]');
  const result = $('[data-quote-result]');
  $('[data-quote-specs]').innerHTML = (custom.specs || []).map((s) => `
    <div><dt>${esc(s.label)}</dt><dd>${esc(s.value)}</dd></div>`).join('');
  $('[data-quote-materials]', form).insertAdjacentHTML('beforeend',
    (custom.materials || []).map((m) => `<option>${esc(m)}</option>`).join(''));

  const { name, phone, message, link, qty, material, color, rights } = form.elements;
  const checks = {
    name: () => fieldError(name, name.value.trim() ? '' : 'Vui lòng nhập họ và tên.'),
    phone: () => fieldError(phone, PHONE_RE.test(normalizePhone(phone.value)) ? '' : 'Số điện thoại chưa đúng (VD: 0912 345 678).'),
    message: () => fieldError(message, message.value.trim() ? '' : 'Vui lòng mô tả món bạn cần in.'),
    link: () => {
      link.value = fixLink(link.value);
      const ok = !link.value || /^https?:\/\/[^\s/]+\.\S+$/i.test(link.value);
      return fieldError(link, ok ? '' : 'Link chưa đúng (VD: https://drive.google.com/…).');
    },
    qty: () => {
      const n = Number(qty.value);
      const ok = !qty.validity.badInput && (qty.value === '' || (Number.isInteger(n) && n >= 1 && n <= 1000));
      return fieldError(qty, ok ? '' : 'Số lượng từ 1 đến 1000.');
    },
    rights: () => fieldError(rights, rights.checked ? '' : 'Vui lòng xác nhận bạn được phép dùng file, mẫu này để in.'),
  };
  ['name', 'phone', 'message', 'link', 'qty'].forEach((key) => {
    form.elements[key].addEventListener('blur', () => form.elements[key].value && checks[key]());
  });
  rights.addEventListener('change', checks.rights);

  let code = '';
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const valid = Object.values(checks).map((check) => check());
    if (valid.includes(false)) {
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    if (!code) code = orderCode('IN');
    const req = {
      name: name.value.trim(),
      phone: normalizePhone(phone.value),
      message: message.value.trim(),
      link: link.value.trim(),
      qty: qty.value ? Number(qty.value) : '',
      material: material.value,
      color: color.value.trim(),
    };

    const saved = await sendToShop({
      site: data.site,
      payload: { type: 'in-3d', kind: 'theo-file', code, ...req, rights: true, created_at: new Date().toISOString() },
      message: [
        `YÊU CẦU IN 3D – SMARTCARTECH – #${code}`,
        `Họ tên: ${req.name}`,
        `SĐT/Zalo: ${req.phone}`,
        `Cần in: ${req.message}`,
        req.link ? `File: ${req.link}` : '',
        req.qty ? `Số lượng: ${req.qty}` : '',
        `Vật liệu: ${req.material || 'shop tư vấn'}`,
        req.color ? `Màu: ${req.color}` : '',
      ].filter(Boolean).join('\n'),
      button: $('[data-submit]', form),
      busyLabel: 'Đang gửi…',
      errorEl: $('[data-send-error]', form),
    });
    if (!saved) return;

    form.hidden = true;
    result.hidden = false;
    renderSendResult(result, {
      site: data.site,
      title: 'Đã gửi yêu cầu báo giá',
      code,
      text: `Shop sẽ gọi hoặc nhắn Zalo tới số ${req.phone} để báo giá.`,
      details: [
        ['Cần in', req.message],
        ['File', req.link],
        ['Số lượng', req.qty ? String(req.qty) : ''],
        ['Vật liệu', req.material || 'Shop tư vấn'],
        ['Màu', req.color],
      ],
      zaloHint: `Có file hoặc ảnh mẫu trên máy? Gửi kèm mã #${code}:`,
      resetLabel: 'Gửi yêu cầu khác',
      onReset: () => {
        code = '';
        form.reset();
        result.hidden = true;
        form.hidden = false;
        name.focus();
      },
    });
    result.focus();
  });
}

/* ---------- Các bước đặt in ---------- */
function initSteps(p3) {
  const steps = p3.steps || [];
  $('#cach-dat').hidden = !steps.length;
  $('[data-print-steps]').innerHTML = steps.map((s, i) => `
    <li class="step">
      <div class="step__head">
        <span class="step__num" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
        <span class="icon-ring">${icon(esc(s.icon || 'check'))}</span>
      </div>
      <h3 class="step__title"><span class="sr-only">Bước ${i + 1}: </span>${esc(s.title)}</h3>
      <p class="step__text">${esc(s.text)}</p>
    </li>`).join('');
}

boot((data) => {
  const p3 = data.print3d;
  if (!p3) {
    $$('[data-maker]').forEach((s) => { s.hidden = true; });
    return;
  }
  if (p3.seo) setMeta(p3.seo);
  const palette = (p3.colors || []).filter((c) => c && c.id && c.name);
  const fonts = (p3.nameplate?.fonts || []).filter((f) => f && f.family);
  loadFonts([...fonts, STAND_FONT]);
  const redraw = [initNameplate(data, palette), initStand(data, palette)].filter(Boolean);
  // Font tải xong thì chữ rộng, hẹp khác: vẽ lại để đế và icon khớp chữ
  document.fonts?.addEventListener('loadingdone', () => redraw.forEach((fn) => fn()));
  initPicks(p3);
  initQuote(data);
  initSteps(p3);
  const faq = p3.faq || [];
  $('#hoi-dap').hidden = !faq.length;
  if (faq.length) renderAccordion($('[data-faq]'), faq);
});
