/* SmartCarTech — Trang Đặt hàng
   Nguồn sản phẩm:
   - ?mua=pro:day-du:2   (nút "Mua ngay" — chỉ mua đúng bộ này, không đụng giỏ)
   - ?tu=gio-hang        (từ giỏ hàng — sửa số lượng ở đây cũng cập nhật giỏ)
*/
import {
  boot, $, esc, icon, fmtPrice, params, cart, resolveItems,
  copyText, postToEndpoint, renderSendResult, fieldError, normalizePhone, PHONE_RE,
} from './core.js';

const MAX_QTY = 99;

function parseBuyParam(value) {
  return String(value || '')
    .split(',')
    .map((part) => {
      const [line, kit, qty] = part.split(':');
      return { line, kit, qty: Math.min(MAX_QTY, Math.max(1, parseInt(qty, 10) || 1)) };
    })
    .filter((i) => i.line && i.kit);
}

function orderCode() {
  const d = new Date();
  const ymd = [d.getFullYear() % 100, d.getMonth() + 1, d.getDate()].map((n) => String(n).padStart(2, '0')).join('');
  return `SC${ymd}-${Math.floor(1000 + Math.random() * 9000)}`;
}

boot((data) => {
  const q = params();
  const fromCart = q.get('tu') === 'gio-hang' || !q.get('mua');
  let buyItems = fromCart ? [] : parseBuyParam(q.get('mua'));
  let locked = false; // once the order is created the summary becomes read-only

  const currentRows = () => resolveItems(data, fromCart ? cart.items() : buyItems);

  $('[data-order-source]').textContent = fromCart ? 'Từ giỏ hàng' : 'Mua ngay';

  /* ---------- Summary ---------- */
  function lineItem(r) {
    const ids = `data-line="${esc(r.line.id)}" data-kit="${esc(r.kit.id)}"`;
    const controls = locked
      ? `<span class="line-item__qty">Số lượng: ${r.qty}</span>`
      : `<div class="qty qty--sm" role="group" aria-label="Số lượng ${esc(r.line.name)} – ${esc(r.kit.name)}">
           <button type="button" class="qty__btn" data-act="dec" ${ids} aria-label="Giảm số lượng">${icon('minus')}</button>
           <span class="qty__val">${r.qty}</span>
           <button type="button" class="qty__btn" data-act="inc" ${ids} aria-label="Tăng số lượng" ${r.qty >= MAX_QTY ? 'disabled' : ''}>${icon('plus')}</button>
         </div>`;
    const remove = locked ? '' : `
      <button type="button" class="icon-btn line-item__remove" data-act="remove" ${ids} aria-label="Xóa ${esc(r.line.name)} – ${esc(r.kit.name)} khỏi đơn">${icon('trash', 'icon--md')}</button>`;
    return `
      <div class="line-item">
        <img class="line-item__img" src="${esc((r.kit.image || r.line.image).thumb)}" alt="" width="72" height="56" loading="lazy">
        <div class="line-item__info">
          <span class="line-item__name">${esc(r.line.name)}</span>
          <span class="line-item__kit">${esc(r.kit.name)} · ${fmtPrice(r.price)}</span>
          <div class="line-item__row">${controls}<span class="price line-item__price">${fmtPrice(r.total)}</span>${remove}</div>
        </div>
      </div>`;
  }

  function renderSummary(list = currentRows()) {
    const itemsEl = $('[data-order-items]');
    const totalsEl = $('[data-order-totals]');
    $('[data-submit]').disabled = !list.length;

    if (!list.length) {
      itemsEl.innerHTML = `
        <div class="cart-empty">
          <span class="icon-ring">${icon('cart')}</span>
          <p>Chưa có sản phẩm nào trong đơn.</p>
          <a class="btn btn--outline btn--md" href="san-pham.html">Chọn sản phẩm</a>
        </div>`;
      totalsEl.innerHTML = '';
      return;
    }

    itemsEl.innerHTML = list.map(lineItem).join('');
    const total = list.reduce((s, r) => s + r.total, 0);
    totalsEl.innerHTML = `
      <div class="summary__row"><span>Tạm tính</span><span>${fmtPrice(total)}</span></div>
      <div class="summary__row"><span>Phí vận chuyển</span><span>Miễn phí</span></div>
      <div class="summary__row summary__total"><span>Tổng thanh toán</span><span class="price">${fmtPrice(total)}</span></div>`;
  }

  function changeQty(line, kit, act) {
    if (fromCart) {
      const item = cart.items().find((i) => i.line === line && i.kit === kit);
      if (!item) return;
      if (act === 'remove') cart.remove(line, kit);
      else cart.setQty(line, kit, item.qty + (act === 'inc' ? 1 : -1));
      return; // 'cart:change' re-renders
    }
    buyItems = buyItems
      .map((i) => {
        if (i.line !== line || i.kit !== kit) return i;
        const qty = act === 'remove' ? 0 : Math.min(MAX_QTY, i.qty + (act === 'inc' ? 1 : -1));
        return { ...i, qty };
      })
      .filter((i) => i.qty > 0);
    const url = new URL(location.href);
    if (buyItems.length) url.searchParams.set('mua', buyItems.map((i) => `${i.line}:${i.kit}:${i.qty}`).join(','));
    else url.searchParams.delete('mua');
    history.replaceState(null, '', url);
    renderSummary();
  }

  $('[data-order-items]').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || locked) return;
    const { line, kit, act } = b.dataset;
    changeQty(line, kit, act);
    requestAnimationFrame(() => {
      const same = document.querySelector(`[data-order-items] [data-act="${act}"][data-line="${line}"][data-kit="${kit}"]`);
      (same || $('[data-order-items] .btn') || $('#o-name')).focus();
    });
  });

  window.addEventListener('cart:change', () => { if (fromCart && !locked) renderSummary(); });

  /* ---------- Form ---------- */
  const form = $('[data-order-form]');
  const { name, phone, address, note } = form.elements;
  const checks = {
    name: () => fieldError(name, name.value.trim() ? '' : 'Vui lòng nhập họ và tên.'),
    phone: () => fieldError(phone, PHONE_RE.test(normalizePhone(phone.value)) ? '' : 'Số điện thoại chưa đúng (VD: 0912 345 678).'),
    address: () => fieldError(address, address.value.trim().length >= 10 ? '' : 'Vui lòng nhập địa chỉ đầy đủ (số nhà, đường, phường/xã, tỉnh/thành).'),
  };
  [name, phone, address].forEach((el) => el.addEventListener('blur', () => el.value && checks[el.name]()));

  function buildMessage(code, list) {
    const total = list.reduce((s, r) => s + r.total, 0);
    return [
      `ĐƠN HÀNG SMARTCARTECH – #${code}`,
      `Người nhận: ${name.value.trim()}`,
      `SĐT: ${normalizePhone(phone.value)}`,
      `Địa chỉ: ${address.value.trim().replace(/\s*\n\s*/g, ', ')}`,
      '----------------',
      ...list.map((r, i) => `${i + 1}) ${r.line.name} – ${r.kit.name}\n   ${r.qty} × ${fmtPrice(r.price)} = ${fmtPrice(r.total)}`),
      '----------------',
      `Tổng thanh toán: ${fmtPrice(total)} (miễn phí vận chuyển)`,
      note.value.trim() ? `Ghi chú: ${note.value.trim()}` : '',
    ].filter(Boolean).join('\n');
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const valid = [checks.name(), checks.phone(), checks.address()];
    if (valid.includes(false)) {
      form.querySelector('[aria-invalid="true"]')?.focus();
      return;
    }
    const list = currentRows();
    if (!list.length) return;

    const code = orderCode();
    const message = buildMessage(code, list);

    // Copy first (still inside the user's click), then notify the optional endpoint.
    const copied = await copyText(message);
    postToEndpoint(data.site, {
      type: 'don-hang',
      code,
      name: name.value.trim(),
      phone: normalizePhone(phone.value),
      address: address.value.trim(),
      note: note.value.trim(),
      items: list.map((r) => ({ line: r.line.name, kit: r.kit.name, qty: r.qty, price: r.price, total: r.total })),
      total: list.reduce((s, r) => s + r.total, 0),
      created_at: new Date().toISOString(),
    });

    locked = true;
    if (fromCart) cart.clear();
    renderSummary(list);

    form.hidden = true;
    const result = $('[data-order-result]');
    result.hidden = false;
    renderSendResult(result, { site: data.site, title: `Đã tạo đơn #${code}`, message, copied });
    result.focus();
  });

  renderSummary();
});
