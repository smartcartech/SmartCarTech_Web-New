/* SmartCarTech — Trang Hướng dẫn */
import {
  boot, $, $$, esc, icon, fmtPrice, getLine, getKit, params,
  buyNow, addToCart, setLink, setMeta, toast,
} from './core.js';

/** "1:30" → 90, "01:02:03" → 3723, anything else → 0 */
function toSeconds(time) {
  const parts = String(time || '').trim().split(':').map(Number);
  if (!parts.length || parts.some((n) => !Number.isFinite(n))) return 0;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

function openLightbox(src, alt) {
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', alt);
  box.innerHTML = `
    <button type="button" class="icon-btn lightbox__close" aria-label="Đóng ảnh phóng to">${icon('close')}</button>
    <img src="${esc(src)}" alt="${esc(alt)}">`;
  const last = document.activeElement;
  const close = () => {
    box.remove();
    document.documentElement.style.overflow = '';
    last?.focus?.();
  };
  box.addEventListener('click', (e) => { if (e.target === box || e.target.closest('.lightbox__close')) close(); });
  box.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
    if (e.key === 'Tab') { e.preventDefault(); $('.lightbox__close', box).focus(); }
  });
  document.body.appendChild(box);
  document.documentElement.style.overflow = 'hidden';
  $('.lightbox__close', box).focus();
}

boot((data) => {
  const q = params();
  const state = { line: getLine(data, q.get('dong')).id, kit: null };
  state.kit = getKit(getLine(data, state.line), q.get('bo')).id;

  const line = () => getLine(data, state.line);
  const kit = () => getKit(line(), state.kit);
  const fullKit = () => line().kits[0];

  /* ---------- Chọn dòng xe ---------- */
  function renderLineCards() {
    $('[data-line-cards]').innerHTML = data.lines.map((l) => {
      const on = l.id === state.line;
      return `
        <button type="button" class="line-card" data-line="${esc(l.id)}" aria-pressed="${on}">
          <span class="line-card__media"><img class="media-img" src="${esc(l.image.src_small || l.image.src)}" alt="" width="640" height="436" loading="lazy" decoding="async"></span>
          <span class="line-card__body">
            <span class="line-card__name">${esc(l.name)}</span>
            <span class="line-card__blurb">${esc(l.guide_blurb || '')}</span>
          </span>
          <span class="line-card__status">${on ? 'Đang xem' : '<span class="hide-mobile">Chọn</span><span class="show-mobile">Chạm để chọn</span>'}</span>
        </button>`;
    }).join('');
  }

  /* ---------- Chọn bộ + ghi chú linh kiện cần mua thêm ---------- */
  function renderKits() {
    $('[data-kit-pills]').innerHTML = line().kits.map((k) => `
      <button type="button" class="pill-btn" data-kit="${esc(k.id)}" aria-pressed="${k.id === state.kit}">${esc(k.name)}</button>`).join('');

    const k = kit();
    const note = $('[data-kit-note]');
    if (!k.missing) {
      note.hidden = true;
      note.innerHTML = '';
      return;
    }
    note.hidden = false;
    note.innerHTML = `
      <span class="note__text">
        ${icon('info', 'icon--md')}
        <span>Bộ <strong>${esc(k.name.toLowerCase())}</strong> chưa gồm ${esc(k.missing)}.
        Hãy chuẩn bị thêm <span class="placeholder">${esc(k.buy_more || 'các linh kiện còn thiếu')}</span> trước khi làm bước 2.</span>
      </span>
      <a class="link-arrow" href="san-pham.html?dong=${encodeURIComponent(state.line)}&bo=${encodeURIComponent(fullKit().id)}">Xem bộ đầy đủ ${icon('arrow-right')}</a>`;
  }

  /* ---------- Nội dung theo dòng xe ---------- */
  function renderGuide() {
    const l = line();
    const g = l.guide || {};
    $$('[data-line-name]').forEach((el) => { el.textContent = l.name; });

    // Step 1 — video + chapters
    resetVideo();
    $('[data-video-poster]').src = g.video?.poster || l.image.src;
    $('[data-guide-duration]').textContent = g.video?.duration || '';
    $('[data-chapters]').innerHTML = (g.chapters || []).map((c) => `
      <li>
        <button type="button" class="chapter" data-time="${toSeconds(c.time)}">
          <span class="chapter__time">${esc(c.time)}</span>
          <span class="chapter__title">${esc(c.title)}</span>
        </button>
      </li>`).join('');

    // Circuit diagram
    const preview = $('[data-zoom]');
    $('.circuit__img', preview)?.remove();
    $('[data-circuit-placeholder]').hidden = Boolean(g.circuit_image);
    if (g.circuit_image) {
      preview.insertAdjacentHTML('afterbegin',
        `<img class="circuit__img" src="${esc(g.circuit_image)}" alt="Sơ đồ mạch ${esc(l.name)}" loading="lazy" decoding="async">`);
    }
    setLink($('[data-pdf="circuit_pdf"]'), g.circuit_pdf, 'File sơ đồ mạch (PDF) đang được cập nhật.');
    setLink($('[data-pdf="assembly_pdf"]'), g.assembly_pdf, 'File sơ đồ lắp ráp (PDF) đang được cập nhật.');
    $$('[data-pdf]').forEach((a) => { if (a.getAttribute('aria-disabled') !== 'true') a.setAttribute('download', ''); });

    // Step 2 — software & sample code
    $('[data-software]').textContent = g.software || '';
    setLink($('[data-github]'), g.github, 'Trang GitHub đang được cập nhật.');
    $('[data-code-list]').innerHTML = (g.code || []).map((c, i) => `
      <li class="code-item">
        <span class="code-item__icon">${icon(['wheels', 'sensor', 'phone'][i % 3], 'icon--md')}</span>
        <span class="code-item__body">
          <span class="code-item__title">${esc(c.title)}</span>
          <span class="code-item__desc">${esc(c.desc)}</span>
        </span>
        <a class="btn btn--outline-accent btn--sm code-item__dl" data-zip="${i}" href="#" aria-label="Tải .zip – ${esc(c.title)}">
          ${icon('download', 'show-mobile')}<span class="hide-mobile">Tải .zip</span>
        </a>
      </li>`).join('');
    $$('[data-zip]').forEach((a) => {
      const c = g.code[Number(a.dataset.zip)];
      setLink(a, c.zip, `Code "${c.title}" đang được cập nhật.`);
      if (c.zip) a.setAttribute('download', '');
    });

    // Step 3 — app
    const app = g.app || {};
    $('[data-app-name]').textContent = app.name || '';
    $('[data-app-connection]').textContent = app.connection || '';
    setLink($('[data-store="google_play"]'), app.google_play, 'Link Google Play đang được cập nhật.');
    setLink($('[data-store="app_store"]'), app.app_store, 'Link App Store đang được cập nhật.');
    $('[data-qr]').innerHTML = app.qr_image
      ? `<img src="${esc(app.qr_image)}" alt="Mã QR tải app ${esc(app.name)}" width="116" height="116" loading="lazy">`
      : '[MÃ QR]';
    if (app.screenshot) {
      $('[data-app-screen]').innerHTML = `<img src="${esc(app.screenshot)}" alt="Màn hình app ${esc(app.name)} điều khiển ${esc(l.name)}" loading="lazy">`;
      $('[data-app-screen]').classList.add('has-img');
    }

    // Buy band — full kit of this line
    const fk = fullKit();
    setLink($('[data-shopee]'), fk.shopee, 'Link Shopee cho bộ này đang được cập nhật.');
    $('[data-buy-kit]').textContent = `${fk.name} · ${fmtPrice(fk.price)}`;

    setMeta({
      title: `Hướng dẫn lắp ráp & lập trình xe robot ${l.name} | ${data.site.brand}`,
      description: `Hướng dẫn lắp ráp, sơ đồ mạch, video từng bước, code mẫu và app điều khiển cho xe robot ${l.name}.`,
      path: `huong-dan.html?dong=${encodeURIComponent(l.id)}`,
    });
  }

  /* ---------- Video ---------- */
  function resetVideo() {
    const card = $('[data-guide-video]');
    $('iframe', card)?.remove();
    $('[data-video-overlay]').hidden = false;
  }

  function playVideo(start = 0) {
    const l = line();
    const id = l.guide?.video?.youtube;
    if (!id) {
      toast('Video hướng dẫn đang được cập nhật.');
      return;
    }
    const card = $('[data-guide-video]');
    $('iframe', card)?.remove();
    const frame = document.createElement('iframe');
    frame.className = 'video-frame';
    frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&start=${start}`;
    frame.title = `Video lắp ráp ${l.name}`;
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    $('[data-video-overlay]').hidden = true;
    card.appendChild(frame);
  }

  function syncUrl() {
    const url = new URL(location.href);
    url.searchParams.set('dong', state.line);
    url.searchParams.set('bo', state.kit);
    history.replaceState(null, '', url);
  }

  function renderAll() {
    renderLineCards();
    renderKits();
    renderGuide();
    syncUrl();
  }

  /* ---------- Events ---------- */
  $('[data-line-cards]').addEventListener('click', (e) => {
    const b = e.target.closest('.line-card');
    if (!b || b.dataset.line === state.line) return;
    state.line = b.dataset.line;
    state.kit = getKit(line(), state.kit).id;
    renderAll();
    $(`.line-card[data-line="${state.line}"]`)?.focus();
  });

  $('[data-kit-pills]').addEventListener('click', (e) => {
    const b = e.target.closest('.pill-btn');
    if (!b) return;
    state.kit = b.dataset.kit;
    renderKits();
    syncUrl();
    $(`.pill-btn[data-kit="${state.kit}"]`)?.focus();
  });

  $('[data-play-guide]').addEventListener('click', () => playVideo(0));
  $('[data-chapters]').addEventListener('click', (e) => {
    const c = e.target.closest('.chapter');
    if (!c) return;
    playVideo(Number(c.dataset.time) || 0);
    $('[data-guide-video]').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  $('[data-zoom]').addEventListener('click', () => {
    const src = line().guide?.circuit_image;
    if (src) openLightbox(src, `Sơ đồ mạch ${line().name}`);
    else toast('Ảnh sơ đồ mạch đang được cập nhật.');
  });

  document.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'buy') buyNow(state.line, fullKit().id, 1);
    if (act === 'cart') addToCart(data, state.line, fullKit().id, 1);
  });

  renderAll();
});
