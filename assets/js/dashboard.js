/* SmartCarTech — Trang Tổng quan trên trang quản trị (quan-tri.html)
   Vẽ từ số liệu google-apps-script.gs gửi kèm khi mở trang tính "Tổng quan" (dashboardData_): thẻ số tháng này, việc cần
   làm, 3 biểu đồ SVG tự vẽ (trang chỉ chạy script của chính web nên không dùng thư viện ngoài), bảng theo tháng, theo năm.
   Mọi số trên biểu đồ cũng có trong bảng; rê chuột, chạm hoặc dùng phím ← → trên biểu đồ để xem số từng cột, từng ngày.
*/
import { esc, icon } from './core.js';

// Màu đã chạy qua công cụ kiểm tra bảng màu (người mù màu, độ tương phản) trên nền thẻ #0A1118.
// Mỗi thứ một màu cố định theo thứ tự này, không đổi theo dữ liệu. Doanh thu, lượt xem: xám để lợi nhuận, khách nổi lên
const COLOR = {
  web: '#3987e5', shopee: '#d95926', tiktok: '#199e70', other: '#c98500', print: '#d55181',
  revenue: '#5b6b78', profit: '#008300', views: '#5b6b78', visitors: '#3987e5',
};
const PLATFORMS = [['web', 'Website'], ['shopee', 'Shopee'], ['tiktok', 'TikTok'], ['other', 'Khác'], ['print', 'In 3D']];
const WAITING = ['Mới', 'Đã liên hệ', 'Đã chốt', 'Đang in'];
const SVG_NS = 'http://www.w3.org/2000/svg';
const HEIGHT = 230;              // Cao cả khung vẽ, gồm hàng chữ trục ngang
const PAD = { top: 10, bottom: 26, right: 6 };
const charts = [];               // Biểu đồ đang hiện { host, spec }: vẽ lại khi khung đổi cỡ
let frame = 0;

/* ---------- Định dạng số ---------- */
const nf = (digits = 0) => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: digits });
const count = (n) => nf().format(Math.round(n || 0));
const money = (n) => `${count(n)} ₫`;
/** Số gọn cho trục và thẻ số: 12,5 tr · 950k · 1,2 tỷ. */
function short(n) {
  const a = Math.abs(n || 0);
  const sign = n < 0 ? '−' : '';
  const part = (x) => nf(x >= 100 ? 0 : 1).format(x);
  if (a >= 1e9) return `${sign}${part(a / 1e9)} tỷ`;
  if (a >= 1e6) return `${sign}${part(a / 1e6)} tr`;
  if (a >= 1e4) return `${sign}${part(a / 1e3)}k`;
  return `${sign}${count(a)}`;
}
const pct = (x, digits = 0) => (x == null ? '–' : `${nf(digits).format(x * 100)}%`);

/* ---------- Trang Tổng quan ---------- */

/** Vẽ cả trang vào `host`. onOpenSheet(tên trang): bấm một việc cần làm thì mở trang tính đó. */
export function renderDashboard(host, d, { onOpenSheet } = {}) {
  const k = d.kpi.now;
  const p = d.kpi.prev;
  const seen = Boolean(d.visitsSince);
  const months = d.months;
  const labels = months.map((m) => m.label.replace(/\/\d\d(\d\d)$/, '/$1')); // T11/2026 → T11/26: gọn trên trục
  const monthName = (i) => `Tháng ${months[i].label.slice(1)}`;
  const specs = {
    money: {
      kind: 'bars', labels, title: 'Doanh thu và lợi nhuận 12 tháng gần nhất', axis: short, value: money, tipTitle: monthName,
      series: [
        { name: 'Doanh thu', color: COLOR.revenue, values: months.map((m) => m.revenue) },
        { name: 'Lợi nhuận', color: COLOR.profit, values: months.map((m) => m.profit) },
      ],
      extra: (i) => (months[i].margin == null ? '' : `Lợi nhuận bằng ${pct(months[i].margin)} doanh thu`),
      empty: 'Chưa có doanh thu trong 12 tháng gần nhất.',
    },
    orders: {
      kind: 'stack', labels, title: 'Số đơn theo nền tảng 12 tháng gần nhất', axis: count, value: (n) => `${count(n)} đơn`,
      tipTitle: monthName, series: PLATFORMS.map(([key, name]) => ({ name, color: COLOR[key], values: months.map((m) => m[key]) })),
      extra: (i) => `Tổng ${count(months[i].orders)} đơn`,
      empty: 'Chưa có đơn nào trong 12 tháng gần nhất.',
    },
    visits: {
      kind: 'line', labels: d.days.map((x) => x.label), title: 'Khách truy cập 30 ngày gần nhất', axis: count, value: count,
      tipTitle: (i) => `Ngày ${d.days[i].label}`,
      series: [
        { name: 'Lượt xem', color: COLOR.views, values: d.days.map((x) => x.views) },
        { name: 'Khách truy cập', color: COLOR.visitors, values: d.days.map((x) => x.visitors) },
      ],
      empty: seen ? 'Chưa có lượt xem nào trong 30 ngày gần nhất.' : 'Web chưa đếm được lượt xem nào: số liệu có từ khi bản web mới được đưa lên.',
    },
  };
  const others = k.other ? ` · Khác ${count(k.other)}` : '';
  const tiles = [
    { label: 'Lợi nhuận', now: k.profit, prev: p.profit, show: (n) => `${short(n)} ₫`, full: money,
      note: k.margin == null ? 'Chưa có đơn nào điền đủ Doanh thu và Chi phí' : `Bằng ${pct(k.margin)} doanh thu` },
    { label: 'Doanh thu', now: k.revenue, prev: p.revenue, show: (n) => `${short(n)} ₫`, full: money,
      note: k.noProfit ? `${count(k.noProfit)} đơn chưa có lợi nhuận` : k.revenue ? 'Đơn nào cũng đã có lợi nhuận' : 'Chưa có doanh thu tháng này' },
    { label: 'Số đơn', now: k.orders, prev: p.orders, show: count, full: (n) => `${count(n)} đơn`,
      note: `Website ${count(k.web)} · Shopee ${count(k.shopee)} · TikTok ${count(k.tiktok)} · In 3D ${count(k.print)}${others}` },
    { label: 'Khách truy cập', now: k.visitors, prev: p.visitors, show: count, full: (n) => `${count(n)} khách`,
      off: !seen, note: seen ? `Tỷ lệ đặt hàng ${pct(k.conversion, 1)} · ${count(k.views)} lượt xem` : 'Bắt đầu đếm khi bản web mới được đưa lên' },
  ];

  host.innerHTML = `
    <div class="dash__grid">
      <section class="dash__kpis" aria-labelledby="dash-kpis">
        <h2 class="dash__caption" id="dash-kpis">Tháng ${esc(d.month)}, tính tới hôm nay · so với cùng kỳ tháng trước</h2>
        ${tiles.map(tileHtml).join('')}
      </section>
      ${chartCard('money', 'Doanh thu và lợi nhuận', '12 tháng gần nhất', specs.money)}
      ${chartCard('orders', 'Số đơn theo nền tảng', '12 tháng gần nhất', specs.orders)}
      ${chartCard('visits', 'Khách truy cập', `30 ngày gần nhất${seen ? ` · đếm từ ${d.visitsSince}` : ''}`, specs.visits)}
      ${todoHtml(d)}
      ${tablesHtml(d)}
      <p class="dash__foot">Số liệu lúc ${esc(d.updated)}. Số đơn: trang Đơn hàng theo cột Nền tảng, cộng đơn In 3D đặt trên web
        (không tính đơn Huỷ, yêu cầu in theo file đếm riêng). Doanh thu: cột Doanh thu sau điều chỉnh, đơn chưa điền thì lấy Tổng (₫).
        Lợi nhuận chỉ có ở đơn đã điền đủ Doanh thu và Chi phí. Khách truy cập: đếm ẩn danh, mỗi trình duyệt 1 lần trong ngày,
        trong tháng; máy đã mở trang quản trị không được đếm. Tỷ lệ đặt hàng: đơn đặt trên web chia cho khách truy cập.
        Thẻ số so tháng này với cùng kỳ tháng trước (từ ngày 1 tới cùng ngày).${d.undated ? ` ${count(d.undated)} đơn chưa có Thời gian nên chưa được tính.` : ''}</p>
    </div>`;

  charts.length = 0;
  Object.entries(specs).forEach(([id, spec]) => {
    const plot = host.querySelector(`[data-chart="${id}"]`);
    charts.push({ host: plot, spec });
    draw(plot, spec);
  });
  host.querySelectorAll('[data-goto]').forEach((b) => b.addEventListener('click', () => onOpenSheet?.(b.dataset.goto)));
}

/** Khung đổi cỡ (xoay điện thoại, ẩn cột trái): vẽ lại biểu đồ theo độ rộng mới. */
export function redrawDashboard() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => charts.forEach(({ host, spec }) => host.isConnected && draw(host, spec)));
}

function tileHtml(t) {
  const diff = t.now - t.prev;
  let change = '';
  if (!t.off && !diff) change = '<p class="dash-kpi__delta">Bằng cùng kỳ</p>';
  if (!t.off && diff) {
    const up = diff > 0;
    change = `<p class="dash-kpi__delta is-${up ? 'up' : 'down'}"><span aria-hidden="true">${up ? '▲' : '▼'}</span>
      <span class="sr-only">${up ? 'Tăng' : 'Giảm'}</span> ${esc(t.full(Math.abs(diff)))} <span class="dash-kpi__vs">so với cùng kỳ</span></p>`;
  }
  return `
    <article class="dash-kpi">
      <h3 class="dash-kpi__label">${esc(t.label)}</h3>
      <p class="dash-kpi__value"${t.off ? '' : ` title="${esc(t.full(t.now))}"`}>${t.off ? '–' : esc(t.show(t.now))}</p>
      ${change}
      <p class="dash-kpi__note">${esc(t.note)}</p>
    </article>`;
}

function chartCard(id, title, sub, spec) {
  const legend = `<ul class="dash-legend" role="list">${spec.series.map((s) => `
    <li><span class="dash-legend__key is-${spec.kind === 'line' ? 'line' : 'box'}" style="--key:${s.color}"></span>${esc(s.name)}</li>`).join('')}
  </ul>`;
  return `
    <section class="dash-card dash-chart" aria-labelledby="dash-${id}">
      <div class="dash-card__head">
        <h2 class="dash-card__title" id="dash-${id}">${esc(title)}</h2>
        <p class="dash-card__sub">${esc(sub)}</p>
      </div>
      ${legend}
      <div class="dash-plot" data-chart="${id}"></div>
    </section>`;
}

function todoHtml(d) {
  const waiting = WAITING.reduce((n, s) => n + (d.todo.print[s] || 0), 0);
  const items = [
    ['In 3D', waiting, 'Đơn In 3D đang chờ', WAITING.map((s) => `${s} ${count(d.todo.print[s] || 0)}`).join(' · ')],
    ['Đơn hàng', d.todo.noProfit, 'Đơn chưa có lợi nhuận', 'Trong 12 tháng: điền Doanh thu sau điều chỉnh và Chi phí'],
    ['Mã tải code', d.todo.codesNew, 'Mã tải code chưa in', 'In thẻ: mở Google Sheet → menu SmartCarTech'],
    ['Mã tải code', d.todo.cardsInStock, 'Thẻ đã in, chưa gán đơn', 'Số thẻ còn để bỏ vào hộp'],
  ];
  return `
    <section class="dash-card dash-todo" aria-labelledby="dash-todo">
      <h2 class="dash-card__title" id="dash-todo">Việc cần làm</h2>
      <ul class="dash-todo__list" role="list">${items.map(([sheet, n, label, hint]) => `
        <li><button type="button" class="dash-todo__item" data-goto="${esc(sheet)}">
          <span class="dash-todo__count${n ? '' : ' is-zero'}">${count(n)}</span>
          <span class="dash-todo__text"><strong>${esc(label)}</strong><span>${esc(hint)}</span></span>
          ${icon('chevron-right', 'icon--sm')}
        </button></li>`).join('')}
      </ul>
    </section>`;
}

/** Bảng theo tháng, theo năm (mới nhất ở trên): đủ mọi số của biểu đồ, cho người không xem được biểu đồ. */
function tablesHtml(d) {
  const head = ['Website', 'Shopee', 'TikTok', 'Khác', 'In 3D', 'Tổng đơn', 'Doanh thu (₫)', 'Lợi nhuận (₫)', '% lợi nhuận',
    'Khách truy cập', 'Tỷ lệ đặt hàng', 'Tư vấn', 'Yêu cầu in theo file'];
  const cells = (m) => [m.web, m.shopee, m.tiktok, m.other, m.print, m.orders].map(count)
    .concat([count(m.revenue), count(m.profit), pct(m.margin), count(m.visitors), pct(m.conversion, 1), count(m.leads), count(m.quotes)]);
  const table = (id, first, rows, current) => `
    <div class="dash-table-wrap" role="region" tabindex="0" aria-labelledby="${id}">
      <table class="dash-table">
        <thead><tr><th scope="col">${first}</th>${head.map((h) => `<th scope="col">${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map((m) => `
          <tr${m.key === current ? ' class="is-current"' : ''}><th scope="row">${esc(m.label)}</th>${cells(m).map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
    </div>`;
  const thisMonth = d.months[d.months.length - 1];
  return `
    <section class="dash-card dash-tables">
      <h2 class="dash-card__title" id="dash-months">Theo tháng</h2>
      ${table('dash-months', 'Tháng', d.months.slice().reverse(), thisMonth && thisMonth.key)}
      <h2 class="dash-card__title dash-tables__next" id="dash-years">Theo năm</h2>
      ${d.years.length ? table('dash-years', 'Năm', d.years.slice().reverse(), thisMonth && thisMonth.key.slice(0, 4)) : '<p class="dash-empty">Chưa có số liệu.</p>'}
    </section>`;
}

/* ---------- Biểu đồ SVG ---------- */

function svg(name, attrs, parent) {
  const el = document.createElementNS(SVG_NS, name);
  Object.entries(attrs || {}).forEach(([key, value]) => el.setAttribute(key, value));
  if (parent) parent.append(el);
  return el;
}

let measure = null;
function textWidth(text) {
  measure = measure || document.createElement('canvas').getContext('2d');
  measure.font = '12px "Be Vietnam Pro", system-ui, sans-serif';
  return measure.measureText(String(text)).width;
}

/** Vạch chia trục tròn số (0, 500k, 1 tr…), khoảng 4 vạch, luôn có 0. */
function ticksFor(lo, hi) {
  if (hi <= lo) hi = lo + 1;
  const raw = (hi - lo) / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw * 0.999);
  const start = Math.floor(lo / step + 1e-9) * step;
  const end = Math.ceil(hi / step - 1e-9) * step;
  const out = [];
  for (let v = start; v <= end + step / 2; v += step) out.push(Number(v.toPrecision(12)));
  return out;
}

/** Cột có đầu bo tròn 4px ở phía giá trị, vuông ở đường 0. */
function bar(x, y, w, h, up, color) {
  const r = Math.min(4, w / 2, h);
  const d = up
    ? `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`
    : `M${x},${y}V${y + h - r}Q${x},${y + h} ${x + r},${y + h}H${x + w - r}Q${x + w},${y + h} ${x + w},${y + h - r}V${y}Z`;
  return svg('path', { d, fill: color });
}

/**
 * Vẽ một biểu đồ vừa đúng độ rộng của `host`. spec.kind: 'bars' (cột đứng cạnh nhau), 'stack' (cột chồng), 'line'.
 * Cột rộng tối đa 24px, cách nhau 2px; đường dày 2px, điểm cuối có viền màu nền.
 */
function draw(host, spec) {
  const width = Math.floor(host.clientWidth);
  if (!width) return;
  host.textContent = '';
  const n = spec.labels.length;
  const all = spec.series.flatMap((s) => s.values);
  if (!all.some((v) => v)) {
    const p = document.createElement('p');
    p.className = 'dash-empty';
    p.textContent = spec.empty;
    host.append(p);
    return;
  }
  const totals = spec.labels.map((_, i) => spec.series.reduce((t, s) => t + Math.max(0, s.values[i]), 0));
  const ticks = ticksFor(Math.min(0, ...all), spec.kind === 'stack' ? Math.max(...totals) : Math.max(0, ...all));
  const [lo, hi] = [ticks[0], ticks[ticks.length - 1]];
  const left = Math.ceil(Math.max(...ticks.map((t) => textWidth(spec.axis(t))))) + 12;
  const plotW = Math.max(40, width - left - PAD.right);
  const band = plotW / n;
  const y = (v) => PAD.top + (HEIGHT - PAD.top - PAD.bottom) * (1 - (v - lo) / (hi - lo));
  const xc = (i) => left + band * (i + 0.5);
  const unit = spec.kind === 'line' ? 'ngày' : 'tháng';

  const root = svg('svg', {
    class: 'dash-svg', width, height: HEIGHT, viewBox: `0 0 ${width} ${HEIGHT}`, role: 'img', tabindex: '0',
    'aria-label': `${spec.title}. Dùng phím mũi tên trái, phải để xem số từng ${unit}; bảng bên dưới có đủ số liệu.`,
  }, host);
  const grid = svg('g', { class: 'dash-svg__grid' }, root);
  ticks.forEach((t) => {
    svg('line', { x1: left, x2: left + plotW, y1: Math.round(y(t)) + 0.5, y2: Math.round(y(t)) + 0.5, class: t === 0 ? 'is-base' : '' }, grid);
    svg('text', { x: left - 8, y: y(t), 'text-anchor': 'end', 'dominant-baseline': 'middle' }, grid).textContent = spec.axis(t);
  });
  // Chữ trục ngang thưa ra cho khỏi chồng nhau; luôn có nhãn cuối (tháng này, hôm nay)
  const every = Math.max(1, Math.ceil((Math.max(...spec.labels.map(textWidth)) + 10) / band));
  spec.labels.forEach((label, i) => {
    if ((n - 1 - i) % every) return;
    svg('text', { x: xc(i), y: HEIGHT - 8, 'text-anchor': 'middle' }, grid).textContent = label;
  });

  const wash = svg('rect', { class: 'dash-svg__wash', y: PAD.top, width: band, height: HEIGHT - PAD.top - PAD.bottom, visibility: 'hidden' }, root);
  const cross = spec.kind === 'line'
    ? svg('line', { class: 'dash-svg__cross', y1: PAD.top, y2: HEIGHT - PAD.bottom, visibility: 'hidden' }, root) : null;
  const marks = svg('g', {}, root);

  if (spec.kind === 'bars') {
    const k = spec.series.length;
    const w = Math.max(2, Math.min(24, (band * 0.72 - (k - 1) * 2) / k));
    const group = k * w + (k - 1) * 2;
    spec.series.forEach((s, j) => s.values.forEach((v, i) => {
      if (!v) return;
      const top = y(Math.max(v, 0));
      marks.append(bar(xc(i) - group / 2 + j * (w + 2), top, w, Math.max(1, y(Math.min(v, 0)) - top), v > 0, s.color));
    }));
  } else if (spec.kind === 'stack') {
    const w = Math.max(2, Math.min(24, band * 0.6));
    spec.labels.forEach((_, i) => {
      const parts = spec.series.map((s) => ({ color: s.color, v: Math.max(0, s.values[i]) })).filter((part) => part.v);
      let sum = 0;
      parts.forEach((part, j) => {
        const [top, bottom] = [y(sum + part.v), y(sum)];
        sum += part.v;
        if (j === parts.length - 1) {
          marks.append(bar(xc(i) - w / 2, top, w, bottom - top, true, part.color));
        } else if (bottom - top > 2) {
          // Khe 2px màu nền giữa 2 phần của cột chồng
          svg('rect', { x: xc(i) - w / 2, y: top + 2, width: w, height: bottom - top - 2, fill: part.color }, marks);
        }
      });
    });
  } else {
    spec.series.forEach((s) => {
      const d = s.values.map((v, i) => `${i ? 'L' : 'M'}${xc(i)},${y(v)}`).join('');
      svg('path', { d, fill: 'none', stroke: s.color, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, marks);
      svg('circle', { class: 'dash-svg__dot', cx: xc(n - 1), cy: y(s.values[n - 1]), r: 4, fill: s.color }, marks);
    });
  }

  // Chú thích: một ô cho cả cột / cả ngày, liệt kê mọi loại số
  const tip = document.createElement('div');
  tip.className = 'dash-tip';
  tip.hidden = true;
  tip.setAttribute('role', 'status');
  host.append(tip);
  let active = -1;
  const show = (index) => {
    active = Math.max(0, Math.min(n - 1, index));
    const x = left + band * active;
    wash.setAttribute('x', x);
    wash.setAttribute('visibility', 'visible');
    if (cross) {
      cross.setAttribute('x1', xc(active));
      cross.setAttribute('x2', xc(active));
      cross.setAttribute('visibility', 'visible');
    }
    tip.textContent = '';
    const title = document.createElement('p');
    title.className = 'dash-tip__title';
    title.textContent = spec.tipTitle(active);
    tip.append(title);
    (spec.kind === 'stack' ? spec.series.slice().reverse() : spec.series).forEach((s) => {
      const row = document.createElement('p');
      row.className = 'dash-tip__row';
      const key = document.createElement('span');
      key.className = 'dash-tip__key';
      key.style.background = s.color;
      const value = document.createElement('strong');
      value.textContent = spec.value(s.values[active]);
      const name = document.createElement('span');
      name.textContent = s.name;
      row.append(key, value, name);
      tip.append(row);
    });
    const extra = spec.extra ? spec.extra(active) : '';
    if (extra) {
      const p = document.createElement('p');
      p.className = 'dash-tip__extra';
      p.textContent = extra;
      tip.append(p);
    }
    tip.hidden = false;
    const tipW = tip.offsetWidth;
    const right = xc(active) + 14;
    tip.style.left = `${right + tipW <= width ? right : Math.max(0, xc(active) - 14 - tipW)}px`;
  };
  const hide = () => {
    tip.hidden = true;
    wash.setAttribute('visibility', 'hidden');
    if (cross) cross.setAttribute('visibility', 'hidden');
  };
  const at = (e) => Math.floor((e.clientX - root.getBoundingClientRect().left - left) / band);
  root.addEventListener('pointermove', (e) => show(at(e)));
  root.addEventListener('pointerdown', (e) => show(at(e)));
  root.addEventListener('pointerleave', () => { if (document.activeElement !== root) hide(); });
  root.addEventListener('focus', () => show(active < 0 ? n - 1 : active));
  root.addEventListener('blur', hide);
  root.addEventListener('keydown', (e) => {
    const next = { ArrowLeft: active - 1, ArrowRight: active + 1, Home: 0, End: n - 1 }[e.key];
    if (next === undefined) {
      if (e.key === 'Escape') hide();
      return;
    }
    e.preventDefault();
    show(next);
  });
}
