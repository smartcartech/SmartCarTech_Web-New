/* SmartCarTech — Trang chủ */
import {
  boot, $, $$, esc, icon, fmtPrice, getLine, getKit, buyNow, addToCart, setLink, setJsonLd, SITE_URL,
  copyText, postToEndpoint, renderSendResult, fieldError, normalizePhone, PHONE_RE, zaloUrl,
} from './core.js';

/* ---------- Chọn bộ phù hợp: 2 thẻ (desktop) / tab + 1 thẻ (mobile) ---------- */
function kitOption(kit, selected) {
  return `
    <button type="button" class="kit-opt" data-kit="${esc(kit.id)}" aria-pressed="${selected}">
      <span class="kit-opt__radio" aria-hidden="true"></span>
      <span class="kit-opt__body">
        <span class="kit-opt__name">${esc(kit.name)}</span>
        <span class="kit-opt__note">${esc(kit.note)}</span>
      </span>
      <span class="kit-opt__price">${fmtPrice(kit.price)}</span>
    </button>`;
}

function kitCard(line, index, active) {
  const featured = index === 0;
  return `
    <article class="kit-card${featured ? ' kit-card--featured' : ''}${active ? ' is-active' : ''}" id="card-${esc(line.id)}" data-line="${esc(line.id)}" aria-labelledby="card-${esc(line.id)}-title">
      <div class="kit-card__media">
        <img class="media-img" src="${esc(line.image.src)}" srcset="${esc(line.image.src_small)} 640w, ${esc(line.image.src)} ${line.image.width || 1024}w"
             sizes="(min-width: 1024px) 620px, 100vw" width="1024" height="697" loading="lazy" decoding="async" alt="${esc(line.image.alt)}">
        <span class="badge${featured ? ' badge--pro' : ''}">${esc(line.badge)}</span>
      </div>
      <div class="kit-card__body">
        <div class="kit-card__intro">
          <h3 class="kit-card__title" id="card-${esc(line.id)}-title">${esc(line.name)}</h3>
          <p class="kit-card__desc">${esc(line.highlight)}</p>
        </div>
        <div class="kit-list" role="group" aria-label="Chọn bộ ${esc(line.name)}">
          <span class="label-caps kit-list__label" aria-hidden="true">Chọn bộ</span>
          ${line.kits.map((k, i) => kitOption(k, i === 0)).join('')}
        </div>
        <div class="buy-actions">
          <div class="buy-actions__row">
            <button type="button" class="btn btn--primary buy-actions__main" data-act="buy">Mua ngay</button>
            <button type="button" class="btn btn--outline" data-act="cart">${icon('cart')} Thêm vào giỏ</button>
          </div>
          <div class="buy-actions__row">
            <a class="btn btn--ghost" data-act="shopee" href="#">${icon('bag')} Mua trên Shopee</a>
            <a class="btn btn--ghost" data-href="zalo" href="https://zalo.me/" target="_blank" rel="noopener">${icon('chat')} Tư vấn qua Zalo</a>
          </div>
        </div>
        <a class="link-arrow" data-detail href="san-pham.html?dong=${esc(line.id)}">
          Xem chi tiết ${esc(line.name)} ${icon('arrow-right')}
        </a>
      </div>
    </article>`;
}

function initKitCards(data) {
  const wrap = $('[data-kit-cards]');
  const switcher = $('[data-line-switch]');
  const selected = Object.fromEntries(data.lines.map((l) => [l.id, l.kits[0].id]));
  let activeLine = data.lines[0].id;

  switcher.innerHTML = data.lines.map((l, i) => `
    <button type="button" class="seg__btn" data-line="${esc(l.id)}" aria-pressed="${i === 0}" aria-controls="card-${esc(l.id)}">${esc(l.name)}</button>`).join('');
  wrap.innerHTML = data.lines.map((l, i) => kitCard(l, i, i === 0)).join('');

  $$('[data-href="zalo"]', wrap).forEach((a) => { a.href = zaloUrl(data.site); });

  function syncCard(lineId) {
    const card = $(`.kit-card[data-line="${lineId}"]`, wrap);
    const line = getLine(data, lineId);
    const kit = getKit(line, selected[lineId]);
    const image = kit.image || line.image;
    const photo = $('.kit-card__media img', card);
    photo.src = image.src;
    photo.srcset = `${image.src_small} 640w, ${image.src} ${image.width || 1024}w`;
    photo.alt = image.alt;
    $$('.kit-opt', card).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.kit === kit.id)));
    setLink($('[data-act="shopee"]', card), kit.shopee, 'Link Shopee cho bộ này đang được cập nhật.');
    $('[data-detail]', card).href = `san-pham.html?dong=${encodeURIComponent(line.id)}&bo=${encodeURIComponent(kit.id)}`;
  }
  data.lines.forEach((l) => syncCard(l.id));

  switcher.addEventListener('click', (e) => {
    const btn = e.target.closest('.seg__btn');
    if (!btn) return;
    activeLine = btn.dataset.line;
    $$('.seg__btn', switcher).forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    $$('.kit-card', wrap).forEach((c) => c.classList.toggle('is-active', c.dataset.line === activeLine));
  });

  wrap.addEventListener('click', (e) => {
    const card = e.target.closest('.kit-card');
    if (!card) return;
    const lineId = card.dataset.line;
    const opt = e.target.closest('.kit-opt');
    if (opt) {
      selected[lineId] = opt.dataset.kit;
      syncCard(lineId);
      return;
    }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'buy') buyNow(lineId, selected[lineId], 1);
    if (act === 'cart') addToCart(data, lineId, selected[lineId], 1);
  });
}

/* ---------- FAQ accordion (one open at a time) ---------- */
function initFaq(data) {
  const list = $('[data-faq]');
  list.innerHTML = data.faq.map((f, i) => `
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

  const answered = data.faq.filter((f) => f.a && !/\[.*\]/.test(f.a));
  if (answered.length) {
    setJsonLd('ld-faq', {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: answered.map((f) => ({
        '@type': 'Question',
        name: f.q,
        acceptedAnswer: { '@type': 'Answer', text: f.a },
      })),
    });
  }
}

/* ---------- Form tư vấn ---------- */
function initLeadForm(data) {
  const form = $('[data-lead-form]');
  const result = $('[data-lead-result]');
  const name = form.elements.name;
  const phone = form.elements.phone;
  const msg = form.elements.message;

  const checkName = () => fieldError(name, name.value.trim() ? '' : 'Vui lòng nhập họ và tên.');
  const checkPhone = () => fieldError(phone, PHONE_RE.test(normalizePhone(phone.value)) ? '' : 'Số điện thoại chưa đúng (VD: 0912 345 678).');
  name.addEventListener('blur', () => name.value && checkName());
  phone.addEventListener('blur', () => phone.value && checkPhone());

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const ok = [checkName(), checkPhone()];
    if (ok.includes(false)) {
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    const message = [
      'YÊU CẦU TƯ VẤN – SMARTCARTECH',
      `Họ tên: ${name.value.trim()}`,
      `SĐT/Zalo: ${normalizePhone(phone.value)}`,
      `Nội dung: ${msg.value.trim() || '(không ghi)'}`,
    ].join('\n');

    const copied = await copyText(message);
    postToEndpoint(data.site, {
      type: 'tu-van',
      name: name.value.trim(),
      phone: normalizePhone(phone.value),
      message: msg.value.trim(),
      created_at: new Date().toISOString(),
    });

    form.hidden = true;
    result.hidden = false;
    renderSendResult(result, {
      site: data.site,
      title: 'Đã ghi nhận yêu cầu tư vấn',
      message,
      copied,
      resetLabel: 'Gửi yêu cầu khác',
      onReset: () => {
        form.reset();
        result.hidden = true;
        form.hidden = false;
        name.focus();
      },
    });
    result.focus();
  });
}

/* ---------- Thông tin thương hiệu cho Google (logo, mạng xã hội) ---------- */
function initOrgJsonLd({ site }) {
  setJsonLd('ld-org', {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: site.brand,
    url: `${SITE_URL}/`,
    logo: `${SITE_URL}/assets/img/logo-smartcartech.png`,
    email: site.email,
    sameAs: [site.facebook_url, site.tiktok_url, site.youtube_url].filter(Boolean),
  });
}

boot((data) => {
  initKitCards(data);
  initFaq(data);
  initLeadForm(data);
  initOrgJsonLd(data);
});
