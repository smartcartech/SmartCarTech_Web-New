/* SmartCarTech — Trang Sản phẩm */
import {
  boot, $, $$, esc, icon, fmtPrice, getLine, getKit, minPrice, params,
  buyNow, addToCart, setLink, setMeta, setJsonLd, toast,
} from './core.js';

const MAX_QTY = 99;

boot((data) => {
  const q = params();
  const state = {
    line: getLine(data, q.get('dong')).id,
    kit: null,
    qty: 1,
    view: 0,
  };
  state.kit = getKit(getLine(data, state.line), q.get('bo')).id;

  const line = () => getLine(data, state.line);
  const kit = () => getKit(line(), state.kit);
  const isFeatured = (l) => data.lines.indexOf(l) === 0;
  const gallery = () => kit().gallery || line().gallery;
  // A kit with its own photos uses only its own videos. Old line-level data still works.
  const videos = () => {
    const media = kit().gallery ? kit() : line();
    return [media.video, ...(media.videos || [])].filter(Boolean);
  };

  /* ---------- Static renders (once) ---------- */
  $('[data-line-switch]').innerHTML = data.lines.map((l) => `
    <button type="button" class="seg__btn" data-line="${esc(l.id)}" aria-pressed="false">${esc(l.name)}</button>`).join('');

  const compareTitle = $('#compare-title');
  if (data.lines.length >= 2) compareTitle.textContent = `${data.lines[0].name} khác gì ${data.lines[1].name}?`;

  /* ---------- Renderers ---------- */
  function renderLine() {
    const l = line();
    $$('[data-line-name]').forEach((el) => { el.textContent = l.name; });
    $('[data-line-tagline]').textContent = l.tagline;
    const badge = $('[data-line-badge]');
    badge.textContent = l.badge;
    badge.classList.toggle('badge--pro', isFeatured(l));
    $$('[data-line-switch] .seg__btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.line === l.id)));
    $$('[data-guide-link]').forEach((a) => { a.href = `huong-dan.html?dong=${encodeURIComponent(l.id)}`; });
    renderKits();
    renderGallery();
    renderFeatures();
    renderCompare();

    setMeta({ title: l.seo?.title, description: l.seo?.description, path: `san-pham.html?dong=${encodeURIComponent(l.id)}` });
    setJsonLd('ld-product', {
      '@context': 'https://schema.org',
      '@type': 'Product',
      name: l.name,
      description: l.seo?.description || l.tagline,
      image: new URL(l.image.src, location.href).href,
      brand: { '@type': 'Brand', name: data.site.brand },
      offers: {
        '@type': 'AggregateOffer',
        priceCurrency: 'VND',
        lowPrice: minPrice(l),
        highPrice: Math.max(...l.kits.map((k) => Number(k.price) || 0)),
        offerCount: l.kits.length,
        availability: 'https://schema.org/InStock',
      },
    });
  }

  function renderGallery() {
    const images = gallery();
    const clips = videos();
    if (state.view >= images.length + clips.length) state.view = 0;
    const thumbs = images.map((g, i) => `
      <button type="button" class="thumb" data-view="${i}" aria-label="${esc(g.label)}" aria-pressed="false">
        <img src="${esc(g.thumb)}" alt="" width="162" height="110" loading="lazy" decoding="async">
      </button>`);
    clips.forEach((v, i) => thumbs.push(`
      <button type="button" class="thumb thumb--video" data-view="${images.length + i}" aria-label="${esc(v.title || 'Video giới thiệu')}" aria-pressed="false">
        <img src="${esc(v.poster || line().image.thumb)}" alt="" width="162" height="110" loading="lazy" decoding="async">
        <span class="thumb__play">${icon('play', 'icon--md')}</span>
        ${v.duration && !v.duration.startsWith('[') ? `<span class="thumb__duration" aria-hidden="true">${esc(v.duration)}</span>` : ''}
      </button>`));
    $('[data-thumbs]').innerHTML = thumbs.join('');
    renderView();
  }

  function renderKits() {
    const l = line();
    $('[data-kits]').innerHTML = `
      <span class="label-caps kit-list__label" aria-hidden="true">Chọn bộ</span>
      ${l.kits.map((k) => `
        <button type="button" class="kit-opt" data-kit="${esc(k.id)}" aria-pressed="false">
          <span class="kit-opt__radio" aria-hidden="true"></span>
          <span class="kit-opt__body">
            <span class="kit-opt__name">${esc(k.name)}</span>
            <span class="kit-opt__note">${esc(k.contents)}</span>
          </span>
          <span class="kit-opt__price">${fmtPrice(k.price)}</span>
        </button>`).join('')}`;

    $('[data-box-chips]').innerHTML = l.kits.map((k) => `
      <button type="button" class="pill-btn" data-kit="${esc(k.id)}" aria-pressed="false">${esc(k.short || k.name)}</button>`).join('');
    renderKitState();
  }

  /** Everything that depends on the selected kit / qty. */
  function renderKitState() {
    const l = line();
    const k = kit();
    $$('[data-kits] .kit-opt, [data-box-chips] .pill-btn').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.kit === k.id)));

    const total = (Number(k.price) || 0) * state.qty;
    $('[data-price]').textContent = fmtPrice(k.price);
    $('[data-price-note]').textContent = state.qty > 1
      ? `Giá ${k.name.toLowerCase()} · ${state.qty} bộ: ${fmtPrice(total)}`
      : `Giá ${k.name.toLowerCase()}`;
    $('[data-sticky-price]').textContent = fmtPrice(total);
    $('[data-qty-val]').textContent = state.qty;
    $('[data-qty="-1"]').disabled = state.qty <= 1;
    $('[data-qty="1"]').disabled = state.qty >= MAX_QTY;
    $$('[data-shopee]').forEach((a) => setLink(a, k.shopee, 'Link Shopee cho bộ này đang được cập nhật.'));

    renderBox();
    syncUrl();
  }

  /* "Mỗi bộ gồm những gì?" — table (desktop) + chips/list (mobile) */
  function renderBox() {
    const l = line();
    const k = kit();
    const comps = l.components || [];
    const has = (kitObj, c) => kitObj.includes.includes(c.id);
    const part = (kitObj, c) => (has(kitObj, c) ? '' : kitObj.partial?.[c.id] || '');
    const yes = `${icon('check', 'icon--md box-yes')}<span class="sr-only">Có</span>`;
    const no = `${icon('dash', 'icon--md box-no')}<span class="sr-only">Không kèm</span>`;
    const cell = (kitObj, c) => {
      if (has(kitObj, c)) return yes;
      const p = part(kitObj, c);
      return p ? `<span class="box-part">${esc(p)}</span>` : no;
    };
    const compName = (c) => `
      <span class="box-comp">${esc(c.name)}</span>${c.detail ? `<span class="box-comp__detail">${esc(c.detail)}</span>` : ''}`;
    const on = (kitObj) => (kitObj.id === k.id ? ' is-col-on' : '');

    $('[data-box-table]').innerHTML = `
      <table class="table box-table">
        <caption class="sr-only">Linh kiện có trong từng bộ ${esc(l.name)}. Cột được làm nổi bật là bộ đang chọn.</caption>
        <thead>
          <tr>
            <th scope="col">Linh kiện</th>
            ${l.kits.map((kk) => `<th scope="col" class="box-table__head${on(kk)}">${esc(kk.name)}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${comps.map((c) => `
            <tr>
              <th scope="row">${compName(c)}</th>
              ${l.kits.map((kk) => `<td class="${on(kk)}">${cell(kk, c)}</td>`).join('')}
            </tr>`).join('')}
          <tr class="box-table__price">
            <th scope="row">Giá</th>
            ${l.kits.map((kk) => `<td class="price${on(kk)}">${fmtPrice(kk.price)}</td>`).join('')}
          </tr>
        </tbody>
      </table>`;

    $('[data-box-list]').innerHTML = `
      <ul class="box-list" role="list" aria-label="Linh kiện trong ${esc(k.name)}">
        ${comps.map((c) => {
          const ok = has(k, c);
          const p = part(k, c);
          let mark = icon('dash', 'icon--md box-no');
          if (ok) mark = icon('check', 'icon--md box-yes');
          else if (p) mark = icon('info', 'icon--md box-part-icon');
          return `
            <li class="box-list__item${ok ? '' : p ? ' is-part' : ' is-off'}">
              ${mark}
              <span class="box-list__name">${compName(c)}</span>
              <span class="box-list__tag">${ok ? 'Có' : esc(p) || 'Không kèm'}</span>
            </li>`;
        }).join('')}
      </ul>
      <div class="box-list__price"><span>Giá bộ này</span><span class="price">${fmtPrice(k.price)}</span></div>`;
  }

  function renderFeatures() {
    const l = line();
    $('[data-features]').innerHTML = (l.features || []).map((f, i) => `
      <article class="func-card">
        <div class="func-card__media corners">
          <img class="media-img" src="${esc(f.image)}" alt="${esc(f.alt)}" width="660" height="300" loading="lazy" decoding="async">
        </div>
        <div class="func-card__body">
          <p class="func-card__tag">${String(i + 1).padStart(2, '0')} · ${esc(f.tag)}</p>
          <h3 class="func-card__title">${esc(f.title)}</h3>
          <p class="func-card__text">${esc(f.text)}</p>
        </div>
      </article>`).join('');
  }

  function renderCompare() {
    const lines = data.lines;
    const on = (l) => (l.id === state.line ? ' is-col-on' : '');
    // A row is a difference when the lines don't all share the same value
    const differs = (s) => new Set(lines.map((l) => String(s[l.id] ?? '').trim())).size > 1;
    $('[data-compare]').innerHTML = `
      <table class="table compare-table">
        <caption class="sr-only">So sánh thông số ${lines.map((l) => esc(l.name)).join(' và ')}. Cột được làm nổi bật là dòng đang chọn.</caption>
        <thead>
          <tr>
            <th scope="col">Thông số</th>
            ${lines.map((l, i) => `
              <th scope="col" class="compare-table__head${on(l)}">
                <span class="compare-table__name">${esc(l.name)}</span>${i === 0 ? `<span class="compare-table__badge">${esc(l.badge)}</span>` : ''}
              </th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${data.specs.map((s) => `
            <tr${differs(s) ? ' class="is-diff"' : ''}>
              <th scope="row">${esc(s.label)}${differs(s) ? '<span class="sr-only"> (khác nhau)</span>' : ''}</th>
              ${lines.map((l) => `<td class="${on(l)}">${esc(s[l.id] ?? '')}</td>`).join('')}
            </tr>`).join('')}
          <tr>
            <th scope="row">Giá từ</th>
            ${lines.map((l) => `<td class="price${on(l)}">${fmtPrice(minPrice(l))}</td>`).join('')}
          </tr>
        </tbody>
      </table>`;
  }

  function resetPlayer() {
    const main = $('.gallery__main');
    const player = $('video', main);
    if (player) {
      player.pause();
      player.removeAttribute('src');
      player.load();
      player.remove();
    }
    $('iframe', main)?.remove();
    main.classList.remove('is-playing');
    $('[data-main-img]').hidden = false;
  }

  /* Gallery main view: images first, then one or more videos. */
  function renderView() {
    const l = line();
    const images = gallery();
    const video = videos()[state.view - images.length];
    const isVideo = Boolean(video);
    const main = $('.gallery__main');
    const img = $('[data-main-img]');
    const layer = $('[data-video-layer]');
    resetPlayer();

    if (isVideo) {
      img.src = video.poster || l.image.src;
      img.alt = `Ảnh bìa ${video.title || `video giới thiệu ${l.name}`}`;
      $('[data-video-title]').textContent = video.title || 'Video giới thiệu';
      $('[data-video-duration]').textContent = video.duration ? ` · ${video.duration}` : '';
      $('[data-play]').setAttribute('aria-label', `Phát ${video.title || `video giới thiệu ${l.name}`}`);
      $('[data-media-caption]').textContent = video.caption || video.title || 'Video giới thiệu';
    } else {
      const g = images[state.view] || images[0];
      img.src = g.src;
      img.alt = g.alt;
      $('[data-media-caption]').textContent = g.caption || g.label;
    }
    layer.hidden = !isVideo;
    main.classList.toggle('is-video', isVideo);
    $$('[data-thumbs] .thumb').forEach((t) => t.setAttribute('aria-pressed', String(Number(t.dataset.view) === state.view)));
  }

  function playVideo() {
    const l = line();
    const video = videos()[state.view - gallery().length];
    if (!video?.src && !video?.youtube) {
      toast('Video giới thiệu đang được cập nhật.');
      return;
    }
    const main = $('.gallery__main');
    resetPlayer();
    if (video.src) {
      const player = document.createElement('video');
      player.className = 'video-frame';
      player.src = video.src;
      player.poster = video.poster || l.image.src;
      player.controls = true;
      player.playsInline = true;
      player.preload = 'metadata';
      player.tabIndex = 0;
      player.setAttribute('aria-label', video.title || `Video giới thiệu ${l.name}`);
      player.addEventListener('error', () => {
        if (!player.isConnected) return;
        renderView();
        toast('Không tải được video. Vui lòng thử lại sau.');
      }, { once: true });
      $('[data-video-layer]').hidden = true;
      $('[data-main-img]').hidden = true;
      main.classList.add('is-playing');
      main.appendChild(player);
      player.play().catch(() => { /* Native controls remain available if autoplay is blocked. */ });
      player.focus();
      return;
    }
    const frame = document.createElement('iframe');
    frame.className = 'video-frame';
    frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(video.youtube)}?autoplay=1&rel=0`;
    frame.title = `Video giới thiệu ${l.name}`;
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    frame.allowFullscreen = true;
    $('[data-video-layer]').hidden = true;
    main.classList.add('is-playing');
    main.appendChild(frame);
    frame.focus();
  }

  function syncUrl() {
    const url = new URL(location.href);
    url.searchParams.set('dong', state.line);
    url.searchParams.set('bo', state.kit);
    history.replaceState(null, '', url);
  }

  /* ---------- Events ---------- */
  $('[data-line-switch]').addEventListener('click', (e) => {
    const b = e.target.closest('.seg__btn');
    if (!b || b.dataset.line === state.line) return;
    state.line = b.dataset.line;
    state.kit = getKit(line(), state.kit).id; // keep the same kit type if it exists
    state.view = 0;
    renderLine();
  });

  const pickKit = (e) => {
    const b = e.target.closest('[data-kit]');
    if (!b || b.dataset.kit === state.kit) return;
    state.kit = b.dataset.kit;
    state.view = 0;
    renderKitState();
    renderGallery();
  };
  $('[data-kits]').addEventListener('click', pickKit);
  $('[data-box-chips]').addEventListener('click', pickKit);

  $('[data-buy-box]').addEventListener('click', (e) => {
    const qtyBtn = e.target.closest('[data-qty]');
    if (qtyBtn) {
      state.qty = Math.min(MAX_QTY, Math.max(1, state.qty + Number(qtyBtn.dataset.qty)));
      renderKitState();
    }
  });

  document.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'buy') buyNow(state.line, state.kit, state.qty);
    if (act === 'cart') addToCart(data, state.line, state.kit, state.qty);
  });

  $('[data-thumbs]').addEventListener('click', (e) => {
    const t = e.target.closest('.thumb');
    if (!t) return;
    state.view = Number(t.dataset.view);
    renderView();
  });
  $('[data-play]').addEventListener('click', playVideo);

  /* ---------- Sticky buy bar (mobile): show when the main buy box is off-screen ---------- */
  const sticky = $('[data-sticky]');
  const mq = window.matchMedia('(max-width: 767.98px)');
  let buyBoxVisible = true;
  const updateSticky = () => {
    const show = mq.matches && !buyBoxVisible;
    sticky.classList.toggle('is-visible', show);
    sticky.inert = !show;
    document.documentElement.style.setProperty('--sticky-h', show ? `${sticky.offsetHeight}px` : '0px');
  };
  new IntersectionObserver(([entry]) => {
    buyBoxVisible = entry.isIntersecting;
    updateSticky();
  }).observe($('[data-buy-box]'));
  mq.addEventListener('change', updateSticky);

  renderLine();
});
