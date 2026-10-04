/* SmartCarTech — Trang Hướng dẫn */
import {
  boot, $, $$, esc, icon, fmtPrice, getLine, getKit, params,
  buyNow, addToCart, setLink, setMeta, toast, fieldError,
} from './core.js';

const CODE_KEY = 'sct_code_key';

// Sample code: a plain file name lives in the shop's private Google Drive folder and needs the code
// printed on the card in the box (checked by google-apps-script.gs). A link or path downloads for anyone.
const isPrivateZip = (zip) => Boolean(zip) && !/[/:]/.test(zip);

/** Save a base64 file returned by Apps Script as a normal download. */
function saveFile(name, base64) {
  const bytes = Uint8Array.from(atob(base64), (ch) => ch.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
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
  // screen: which app screenshot is shown (-1 = the last one, the driving screen)
  const state = { line: getLine(data, q.get('dong')).id, kit: null, video: 0, screen: -1 };
  state.kit = getKit(getLine(data, state.line), q.get('bo')).id;

  const line = () => getLine(data, state.line);
  const kit = () => getKit(line(), state.kit);
  const fullKit = () => line().kits[0];
  const videos = () => line().guide?.videos || [];

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

    // Step 1 — video + video list
    resetVideo();
    $('[data-video-poster]').src = g.poster || l.image.src;
    $('[data-video-list]').innerHTML = videos().map((v, i) => `
      <li>
        <button type="button" class="video-item" data-video="${i}" aria-pressed="false">
          <span class="video-item__num">${icon('play')}<span class="sr-only">Phát</span></span>
          <span class="video-item__title">${esc(v.title)}</span>
          <span class="video-item__dur">${esc(v.duration || '')}</span>
        </button>
      </li>`).join('');
    renderVideoState();

    // Circuit diagram
    const preview = $('[data-zoom]');
    $('.circuit__img', preview)?.remove();
    $('[data-circuit-placeholder]').hidden = Boolean(g.circuit_image);
    if (g.circuit_image) {
      preview.insertAdjacentHTML('afterbegin',
        `<img class="circuit__img" src="${esc(g.circuit_image)}" alt="Sơ đồ mạch ${esc(l.name)}" loading="lazy" decoding="async">`);
    }
    setLink($('[data-file="circuit_download"]'), g.circuit_download, 'File sơ đồ mạch đang được cập nhật.');
    setLink($('[data-file="cad_download"]'), g.cad_download, 'Bản vẽ 3D đang được cập nhật.');
    // Files on this site download directly; external links (Google Drive) open in a new tab
    $$('[data-file]').forEach((a) => {
      const url = g[a.dataset.file];
      a.toggleAttribute('download', Boolean(url) && !/^https?:/i.test(url));
    });

    // Step 2 — software & sample code
    $('[data-software]').textContent = g.software || '';
    const uploadNote = $('[data-upload-note]');
    uploadNote.hidden = !g.upload_note;
    uploadNote.innerHTML = g.upload_note
      ? `<span class="note__text">${icon('info', 'icon--md')}<span><strong>Lưu ý:</strong> ${esc(g.upload_note)}</span></span>`
      : '';
    // Code is for buyers only: no GitHub button unless a link is set
    $('[data-github]').hidden = !g.github;
    setLink($('[data-github]'), g.github);
    const codes = g.code || [];
    $('[data-code-key-box]').hidden = !codes.some((c) => isPrivateZip(c.zip));
    $('[data-code-list]').innerHTML = codes.map((c, i) => {
      const tag = isPrivateZip(c.zip) ? 'button' : 'a';
      return `
      <li class="code-item">
        <span class="code-item__icon">${icon(esc(c.icon || 'code'), 'icon--md')}</span>
        <span class="code-item__body">
          <span class="code-item__title">${esc(c.title)}</span>
          <span class="code-item__desc">${esc(c.desc)}</span>
        </span>
        <${tag} class="btn btn--outline-accent btn--sm code-item__dl" data-zip="${i}" ${tag === 'a' ? 'href="#"' : 'type="button"'} aria-label="Tải .zip – ${esc(c.title)}">
          ${icon('download', 'show-mobile')}<span class="hide-mobile">Tải .zip</span>
        </${tag}>
      </li>`;
    }).join('');
    $$('[data-zip]').forEach((el) => {
      const c = codes[Number(el.dataset.zip)];
      if (isPrivateZip(c.zip)) {
        el.addEventListener('click', () => downloadCode(c, el));
        return;
      }
      setLink(el, c.zip, `Code "${c.title}" đang được cập nhật.`);
      if (c.zip) el.setAttribute('download', '');
    });

    // Step 3 — app
    const app = g.app || {};
    $('[data-app-name]').textContent = app.name || '';
    $('[data-app-connection]').textContent = app.connection || '';
    setLink($('[data-store="google_play"]'), app.google_play, 'Link Google Play đang được cập nhật.');
    // No iOS app yet: hide the App Store button instead of promising one
    $('[data-store="app_store"]').hidden = !app.app_store;
    setLink($('[data-store="app_store"]'), app.app_store);
    $('[data-qr]').innerHTML = app.qr_image
      ? `<img src="${esc(app.qr_image)}" alt="Mã QR tải app ${esc(app.name)} trên Google Play" width="116" height="116" loading="lazy">`
      : '[MÃ QR]';
    $('[data-qr]').classList.toggle('has-img', Boolean(app.qr_image));
    renderAppScreen();

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

  /* ---------- App screenshots: phone mock + tabs ---------- */
  const screenPlaceholder = $('[data-app-screen]').innerHTML;
  const screens = () => line().guide?.app?.screens || [];

  function renderAppScreen() {
    const list = screens();
    const box = $('[data-app-screen]');
    const tabs = $('[data-app-tabs]');
    tabs.hidden = list.length < 2;
    box.classList.toggle('has-img', list.length > 0);
    if (!list.length) {
      box.innerHTML = screenPlaceholder;
      tabs.innerHTML = '';
      return;
    }
    const s = list[state.screen] || list[list.length - 1];
    box.innerHTML = `<img src="${esc(s.src)}" alt="${esc(s.alt || `Màn hình app ${line().guide.app.name}`)}" width="1600" height="768" loading="lazy" decoding="async">`;
    tabs.innerHTML = list.map((t, i) => `
      <button type="button" class="pill-btn" data-screen="${i}" aria-pressed="${t === s}">${esc(t.label)}</button>`).join('');
  }

  /* ---------- Video ---------- */
  function resetVideo() {
    const card = $('[data-guide-video]');
    $('iframe', card)?.remove();
    $('[data-video-overlay]').hidden = false;
  }

  /** Tag on the video card + highlighted item in the list */
  function renderVideoState() {
    const list = videos();
    const v = list[state.video];
    let tag = 'Video';
    if (list.length > 1) tag = `Phần ${state.video + 1}/${list.length}`;
    $('[data-guide-tag]').textContent = v?.duration ? `${tag} · ${v.duration}` : tag;
    $$('[data-video-list] .video-item').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.video) === state.video)));
  }

  function playVideo() {
    const l = line();
    const v = videos()[state.video];
    if (!v?.youtube) {
      toast('Video hướng dẫn đang được cập nhật.');
      return;
    }
    const card = $('[data-guide-video]');
    $('iframe', card)?.remove();
    const frame = document.createElement('iframe');
    frame.className = 'video-frame';
    frame.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v.youtube)}?autoplay=1&rel=0`;
    frame.title = `${v.title} – ${l.name}`;
    frame.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen';
    $('[data-video-overlay]').hidden = true;
    card.appendChild(frame);
  }

  /* ---------- Code mẫu: mã in trên thẻ trong hộp ---------- */
  const keyInput = $('[data-code-key]');
  try { keyInput.value = localStorage.getItem(CODE_KEY) || ''; } catch { /* private mode */ }
  keyInput.addEventListener('input', () => fieldError(keyInput, ''));

  // The QR on the card opens huong-dan.html?ma=K7M3-Q9XP: fill the code in (syncUrl drops it from the address)
  const cardKey = (q.get('ma') || '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 20);
  if (cardKey) {
    keyInput.value = cardKey;
    try { localStorage.setItem(CODE_KEY, cardKey); } catch { /* private mode */ }
    toast(`Đã điền sẵn mã ${cardKey}. Chọn dòng xe bạn đang dùng rồi tải code mẫu ở bước 2.`, { timeout: 8000 });
  }

  async function downloadCode(c, button) {
    const endpoint = data.site.order_endpoint;
    if (!endpoint) {
      toast(`Code "${c.title}" đang được cập nhật.`);
      return;
    }
    const key = keyInput.value.trim();
    if (!fieldError(keyInput, key ? '' : 'Nhập mã in trên thẻ trong hộp để tải code.')) {
      keyInput.focus();
      return;
    }
    button.disabled = true;
    button.setAttribute('aria-busy', 'true');
    try {
      // text/plain keeps this a simple request, so Apps Script needs no CORS preflight
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ type: 'tai-code', code: key, file: c.zip }),
        signal: AbortSignal.timeout(30000),
      });
      const out = await res.json();
      if (!out.ok) {
        fieldError(keyInput, out.error || 'Mã không đúng. Kiểm tra lại mã in trên thẻ trong hộp.');
        keyInput.focus();
        return;
      }
      try { localStorage.setItem(CODE_KEY, key); } catch { /* private mode */ }
      saveFile(out.name || c.zip, out.data);
      toast(`Đã tải ${out.name || c.zip}.`);
    } catch {
      toast('Chưa tải được code. Kiểm tra kết nối mạng rồi thử lại, hoặc nhắn Zalo cho shop.');
    } finally {
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }

  function syncUrl() {
    const url = new URL(location.href);
    url.searchParams.set('dong', state.line);
    url.searchParams.set('bo', state.kit);
    url.searchParams.delete('ma'); // keep the code out of links the customer shares
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
    state.video = 0;
    state.screen = -1;
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

  $('[data-play-guide]').addEventListener('click', playVideo);
  $('[data-video-list]').addEventListener('click', (e) => {
    const b = e.target.closest('.video-item');
    if (!b) return;
    state.video = Number(b.dataset.video) || 0;
    renderVideoState();
    playVideo();
    $('[data-guide-video]').scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  $('[data-app-tabs]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-screen]');
    if (!b) return;
    state.screen = Number(b.dataset.screen);
    renderAppScreen();
    $(`[data-app-tabs] [data-screen="${state.screen}"]`)?.focus();
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
