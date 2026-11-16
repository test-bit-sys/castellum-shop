'use strict';

/* ============================================================
   Castellum Shop — landing (AR / FR / EN)
   ============================================================ */

const { lang: LANG, t: T } = window.CLX;
const IS_AR = LANG === 'ar';
const NF = new Intl.NumberFormat(LANG === 'en' ? 'en-US' : 'fr-FR');
const nf = (n) => NF.format(Math.round(Number(n) || 0)).replace(/\u202f/g, '\u00a0');
const CUR = IS_AR ? 'دج' : 'DZD';
const money = (n) => `${nf(n)} ${CUR}`;

const state = {
  store: null,
  product: null,
  qty: 1,
  wilaya: null,
  communes: [],
  digital: true,
  total: 0
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICONS = {
  leaf: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 4c-8 0-14 4-14 11a5 5 0 0 0 5 5c7 0 9-7 9-16z"/><path d="M4 21c2-5 6-8 11-10"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l7 3v5c0 5-3 9-7 10-4-1-7-5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>',
  truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 16V6h11v10"/><path d="M14 10h4l3 3v3h-7"/><circle cx="7" cy="18" r="1.7"/><circle cx="18" cy="18" r="1.7"/></svg>',
  sparkle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18 16l.8 2.2L21 19l-2.2.8L18 22l-.8-2.2L15 19l2.2-.8z"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h6l-1 8 9-12h-6z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/><circle cx="12" cy="15.5" r="1.4" fill="currentColor"/></svg>',
  headset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14v-2a8 8 0 0 1 16 0v2"/><rect x="2.5" y="13" width="4.5" height="7" rx="2"/><rect x="17" y="13" width="4.5" height="7" rx="2"/><path d="M19 20a5 5 0 0 1-5 2h-2"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 0 0-14-4L4 9"/><path d="M4 5v4h4"/><path d="M4 13a8 8 0 0 0 14 4l2-2"/><path d="M20 19v-4h-4"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12"/><path d="M7 10l5 5 5-5"/><path d="M4 21h16"/></svg>'
};

const SOCIAL = {
  facebook: {
    label: 'Facebook',
    icon: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13.4 21v-7.1h2.4l.4-2.8h-2.8V9.3c0-.8.2-1.4 1.4-1.4h1.5V5.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.7 1.3-3.7 3.8v2H8v2.8h2.4V21z"/></svg>'
  },
  instagram: {
    label: 'Instagram',
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3.6" y="3.6" width="16.8" height="16.8" rx="5.2"/><circle cx="12" cy="12" r="4"/><circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" stroke="none"/></svg>'
  },
  tiktok: {
    label: 'TikTok',
    icon: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.5 3c.4 2.3 1.8 3.8 4.1 4v2.9c-1.5.1-2.9-.3-4.1-1.1v5.9c0 3.6-2.4 6.3-5.9 6.3-3.1 0-5.5-2.2-5.5-5.3 0-2.9 2.3-5.3 5.3-5.3.4 0 .8 0 1.2.1v3a2.5 2.5 0 1 0 1.8 2.4V3z"/></svg>'
  },
  whatsapp: {
    label: 'WhatsApp',
    icon: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.5 15.3L2 22l4.8-1.4A10 10 0 1 0 12 2zm0 2a8 8 0 1 1-4.2 14.8l-.4-.2-2.5.7.7-2.4-.3-.4A8 8 0 0 1 12 4zm-3.6 4.2c-.2 0-.5.1-.7.4-.3.3-.9.9-.9 2.1s.9 2.4 1 2.6c.1.2 1.7 2.8 4.2 3.8 2 .8 2.5.7 2.9.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.1-1.2l-.7-.4c-.2-.1-1.4-.7-1.6-.8-.2-.1-.4-.1-.5.1l-.7 1c-.1.2-.3.2-.5.1-.2-.1-1-.4-1.9-1.2-.7-.6-1.2-1.4-1.3-1.6-.1-.2 0-.4.1-.5l.4-.5c.1-.2.1-.3 0-.5l-.7-1.7c-.2-.4-.4-.4-.6-.4z"/></svg>'
  }
};

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 3200);
}

/* ---------------- content localization ---------------- */

function sText(key) {
  const s = state.store.settings;
  const base = s[key] || '';
  if (IS_AR) return base;
  const loc = s.i18n && s.i18n[LANG];
  return (loc && loc[key]) || base;
}

function sList(key) {
  const s = state.store.settings;
  const base = Array.isArray(s[key]) ? s[key] : [];
  if (IS_AR) return base;
  const arr = s.i18n && s.i18n[LANG] && s.i18n[LANG][key];
  return Array.isArray(arr) && arr.length ? arr : base;
}

function pText(p, field) {
  if (IS_AR) return p[field] || '';
  const l = p.i18n && p.i18n[LANG];
  return (l && l[field]) || p[field] || '';
}

function placeName(row) {
  return IS_AR ? row.name : row.nameFr || row.name;
}

/* ---------------- render ---------------- */

function hydrate() {
  const { settings, wilayas, products } = state.store;
  document.title = `${settings.storeName} — ${sText('tagline')}`;
  const desc = document.querySelector('meta[name="description"]');
  if (desc) desc.setAttribute('content', sText('heroSubtitle'));

  $('#announce .announce__track').innerHTML = [
    sText('announcement'),
    '✦',
    T('announce.secure'),
    '✦',
    T('announce.support'),
    '✦'
  ]
    .map((t) => `<span>${esc(t)}</span>`)
    .join('');

  $('#heroEyebrow').textContent = sText('heroEyebrow');
  $('#heroTitle').textContent = sText('heroTitle');
  $('#heroSubtitle').textContent = sText('heroSubtitle');
  $('#codNote').textContent = sText('codNote');
  $('#footerTagline').textContent = sText('tagline');
  $('#year').textContent = new Date().getFullYear();
  $('#qtyInput').setAttribute('aria-label', T('summary.qty'));

  const featured = products.find((p) => p.featured) || products[0];
  if (featured) {
    state.product = featured;
    const heroImg = $('#heroImage');
    heroImg.src = settings.heroImage || featured.images[0] || 'img/demo-perfume.svg';
    heroImg.alt = pText(featured, 'name');
    $('#heroPrice').innerHTML = `${nf(featured.price)} <small>${CUR}</small>`;
    const old = $('#heroOldPrice');
    if (featured.oldPrice > featured.price) {
      old.textContent = money(featured.oldPrice);
      old.hidden = false;
    } else {
      old.hidden = true;
    }
  }

  // address only — phone/e-mail/socials removed by client request
  $('#footerAddress').textContent = settings.address || '';

  // wilayas (69 — algeria-geo)
  const select = $('#fWilaya');
  select.innerHTML =
    `<option value="">${esc(T('form.wilayaPh'))}</option>` +
    wilayas.map((w) => `<option value="${w.code}">${w.code} — ${esc(placeName(w))}</option>`).join('');
  $('#fCommune').innerHTML = `<option value="">${esc(T('form.communeFirst'))}</option>`;

  // features
  $('#featuresGrid').innerHTML = sList('features')
    .map(
      (f, i) => `
      <article class="feature" data-reveal data-delay="${(i % 4) + 1}">
        <div class="feature__icon">${ICONS[f.icon] || ICONS.sparkle}</div>
        <h3>${esc(f.title)}</h3>
        <p>${esc(f.text)}</p>
      </article>`
    )
    .join('');

  // reviews
  $('#reviewsGrid').innerHTML = sList('reviews')
    .map(
      (r, i) => `
      <article class="review" data-reveal data-delay="${(i % 3) + 1}">
        <div class="review__stars">${'★'.repeat(Math.max(1, Math.min(5, Number(r.rating) || 5)))}</div>
        <p class="review__text">«${esc(r.text)}»</p>
        <div class="review__who">
          <span class="review__avatar">${esc((r.name || '?').trim().charAt(0))}</span>
          <div><strong>${esc(r.name)}</strong><small>${esc(r.city)}</small></div>
        </div>
      </article>`
    )
    .join('');

  // faq
  $('#faqList').innerHTML = sList('faq')
    .map(
      (f, i) => `
      <details class="acc" ${i === 0 ? 'open' : ''} data-reveal data-delay="${Math.min(i + 1, 5)}">
        <summary>${esc(f.q)}</summary>
        <p>${esc(f.a)}</p>
      </details>`
    )
    .join('');
}

function renderProducts() {
  const grid = $('#productsGrid');
  const products = state.store.products;

  if (!products.length) {
    grid.innerHTML = `<div class="pcard" style="grid-column:1/-1;padding:40px;text-align:center;color:var(--muted)">${esc(T('product.empty'))}</div>`;
    return;
  }

  grid.innerHTML = products
    .map((p, i) => {
      const name = pText(p, 'name');
      const badge = pText(p, 'badge');
      const off = p.oldPrice > p.price ? Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100) : 0;
      const stockTxt = p.stock > 0 ? (p.stock <= 5 ? T('product.stockLow', { n: p.stock }) : T('product.stock')) : T('product.stockOut');
      const soldOut = p.stock <= 0;
      const kind = p.type === 'physical' ? T('product.physical') : T('product.digital');
      return `
        <article class="pcard" data-reveal data-delay="${(i % 3) + 1}">
          <div class="pcard__media">
            <img src="${esc(p.images[0] || 'img/demo-perfume.svg')}" alt="${esc(name)}" loading="lazy" />
            ${badge ? `<span class="pcard__badge">${esc(badge)}</span>` : '<span class="pcard__badge"></span>'}
            ${off ? `<span class="pcard__sale">-${off}%</span>` : ''}
          </div>
          <div class="pcard__body">
            <span class="pcard__kind ${p.type === 'physical' ? '' : 'pcard__kind--digital'}">${kind}</span>
            <h3 class="pcard__title">${esc(name)}</h3>
            <p class="pcard__desc">${esc(pText(p, 'description'))}</p>
            <div class="pcard__meta">
              <span class="pcard__price">${nf(p.price)} <small>${CUR}</small></span>
              ${p.oldPrice > p.price ? `<s class="pcard__old">${nf(p.oldPrice)} ${CUR}</s>` : ''}
              <span class="pcard__stock ${p.stock <= 5 ? 'pcard__stock--low' : ''}">${stockTxt}</span>
            </div>
            <div class="pcard__actions">
              <button type="button" class="btn btn--primary btn--sm" data-order="${esc(p.id)}" ${soldOut ? 'disabled' : ''}>${soldOut ? T('product.soldout') : T('product.order')}</button>
              ${p.images.length > 1 ? `<button type="button" class="btn btn--ghost btn--sm" data-gallery="${esc(p.id)}">${T('product.gallery')}</button>` : ''}
            </div>
          </div>
        </article>`;
    })
    .join('');

  $$('[data-order]', grid).forEach((btn) =>
    btn.addEventListener('click', () => {
      const p = products.find((x) => x.id === btn.dataset.order);
      if (!p) return;
      selectProduct(p);
      $('#order').scrollIntoView({ behavior: 'smooth', block: 'start' });
    })
  );

  $$('[data-gallery]', grid).forEach((btn) =>
    btn.addEventListener('click', () => {
      const p = products.find((x) => x.id === btn.dataset.gallery);
      if (p) openLightbox(p);
    })
  );

  observeReveals();
}

/* ---------------- lightbox ---------------- */

function openLightbox(product) {
  const name = pText(product, 'name');
  const desc = pText(product, 'description');
  const overlay = document.createElement('div');
  overlay.className = 'lightbox';
  overlay.innerHTML = `
    <div class="lightbox__box" role="dialog" aria-modal="true" aria-label="${esc(name)}">
      <button class="lightbox__close" type="button" aria-label="Close">✕</button>
      <div class="lightbox__main"><img id="lbMain" src="${esc(product.images[0])}" alt="${esc(name)}" /></div>
      <div class="lightbox__thumbs">
        ${product.images.map((src, i) => `<button type="button" class="${i === 0 ? 'on' : ''}" data-src="${esc(src)}"><img src="${esc(src)}" alt="" /></button>`).join('')}
      </div>
      <div class="lightbox__info">
        <h3>${esc(name)}</h3>
        <p>${esc(desc)}</p>
        <div class="lightbox__buy">
          <strong>${money(product.price)}</strong>
          <button class="btn btn--primary" type="button" id="lbOrder">${T('lightbox.order')}</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.body.classList.add('locked');
  requestAnimationFrame(() => overlay.classList.add('open'));

  const close = () => {
    overlay.classList.remove('open');
    document.body.classList.remove('locked');
    setTimeout(() => overlay.remove(), 250);
  };

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay || e.target.closest('.lightbox__close')) close();
    const thumb = e.target.closest('[data-src]');
    if (thumb) {
      $('#lbMain', overlay).src = thumb.dataset.src;
      $$('.lightbox__thumbs button', overlay).forEach((b) => b.classList.toggle('on', b === thumb));
    }
  });

  $('#lbOrder', overlay).addEventListener('click', () => {
    selectProduct(product);
    close();
    $('#order').scrollIntoView({ behavior: 'smooth' });
  });

  document.addEventListener('keydown', function onKey(e) {
    if (e.key === 'Escape') {
      close();
      document.removeEventListener('keydown', onKey);
    }
  });
}

/* ---------------- order summary ---------------- */

function applyProductType(product) {
  const digital = product.type !== 'physical';
  state.digital = digital;
  $('#deliveryLabel').textContent = T('summary.delivery');
  $('#deliveryRow').classList.toggle('is-digital', digital);
  const label = $('#addressLabel');
  const input = $('[name="address"]');
  label.textContent = digital ? T('form.addressOpt') : T('form.address');
  input.required = !digital;
  input.placeholder = digital ? T('form.addressPhOpt') : T('form.addressPh');
  setFieldError('address', '');
}

function selectProduct(product) {
  state.product = product;
  const name = pText(product, 'name');
  $('#summaryImage').src = product.images[0] || 'img/demo-perfume.svg';
  $('#summaryImage').alt = name;
  $('#summaryName').textContent = name;
  $('#summaryDesc').textContent = pText(product, 'description');
  $('#summaryPrice').textContent = money(product.price);
  const badge = pText(product, 'badge');
  $('#summaryBadge').textContent = badge;
  $('#summaryBadge').hidden = !badge;
  applyProductType(product);
  updateTotals();
}

function updateTotals() {
  const p = state.product;
  if (!p) return;
  const subtotal = p.price * state.qty;
  const settings = state.store.settings;
  const digital = p.type !== 'physical';
  let shipping = null;

  if (digital) {
    shipping = 0;
    $('#deliveryLabel').textContent = T('summary.delivery');
    $('#lineWilaya').textContent = '';
    $('#lineShipping').textContent = T('summary.digital');
  } else if (state.wilaya) {
    const w = state.store.wilayas.find((x) => x.code === state.wilaya);
    const base = w ? w.delivery : 0;
    shipping = settings.freeShippingThreshold > 0 && subtotal >= settings.freeShippingThreshold ? 0 : base;
    $('#deliveryLabel').textContent = T('summary.delivery');
    $('#lineWilaya').textContent = w ? `— ${placeName(w)}` : '';
    $('#lineShipping').textContent = shipping === 0 ? T('summary.free') : money(shipping);
  } else {
    $('#deliveryLabel').textContent = T('summary.delivery');
    $('#lineWilaya').textContent = '';
    $('#lineShipping').textContent = '—';
  }

  const total = subtotal + (shipping ?? 0);
  state.total = total;

  $('#lineSubtotal').textContent = money(subtotal);
  $('#lineTotal').textContent = money(total);
  $('#btnPrice').textContent = money(total);
  $('#stickyPrice').textContent = money(total);
}

/* ---------------- form ---------------- */

const RULES = {
  name: (v) => (v.trim().length >= 3 ? '' : T('error.name')),
  phone: (v) => {
    let p = v.replace(/[\s\-().]/g, '');
    if (p.startsWith('00213')) p = `0${p.slice(5)}`;
    else if (p.startsWith('+213')) p = `0${p.slice(4)}`;
    else if (p.startsWith('213') && p.length === 12) p = `0${p.slice(3)}`;
    return /^0[5-7]\d{8}$/.test(p) ? '' : T('error.phone');
  },
  wilaya: (v) => (v ? '' : T('error.wilaya')),
  commune: (v) => (/^\d{4}$/.test(v) ? '' : T('error.commune')),
  address: (v) => {
    if (state.product && state.product.type !== 'physical') {
      return v.trim().length <= 200 ? '' : T('error.addressLong');
    }
    return v.trim().length >= 5 ? '' : T('error.address');
  }
};

function setFieldError(name, message) {
  const input = $(`[name="${name}"]`);
  if (!input) return;
  const field = input.closest('.field');
  const slot = $(`[data-error-for="${name}"]`);
  field.classList.toggle('has-error', Boolean(message));
  if (slot) slot.textContent = message || '';
}

function validateForm() {
  let firstBad = null;
  for (const [name, rule] of Object.entries(RULES)) {
    const input = $(`[name="${name}"]`);
    const msg = rule(input.value || '');
    setFieldError(name, msg);
    if (msg && !firstBad) firstBad = input;
  }
  if (firstBad) {
    firstBad.focus({ preventScroll: true });
    firstBad.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }
  return true;
}

async function submitOrder(e) {
  e.preventDefault();
  if (!state.product) return toast(T('error.productFirst'));
  if (!validateForm()) return;

  if (window.__STATIC_PREVIEW__) {
    const ref = `DEMO-${String(Date.now()).slice(-6)}`;
    const note = $('.success__sub');
    if (note) note.textContent = T('success.demo');
    $('#orderForm').hidden = true;
    $('#orderSuccess').hidden = false;
    $('#successRef').textContent = ref;
    $('#orderSuccess').scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast(T('success.demoShort'));
    return;
  }

  const btn = $('#submitBtn');
  const alertBox = $('#formAlert');
  alertBox.hidden = true;
  btn.classList.add('is-loading');

  const payload = {
    productId: state.product.id,
    qty: state.qty,
    name: $('[name="name"]').value.trim(),
    phone: $('[name="phone"]').value.trim(),
    wilaya: $('[name="wilaya"]').value,
    commune: $('[name="commune"]').value,
    address: $('[name="address"]').value.trim(),
    notes: $('[name="notes"]').value.trim()
  };

  try {
    const res = await fetch('/api/public/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const map = {
        out_of_stock: 'error.outOfStock',
        qty_unavailable: 'error.qty',
        rate_limited: 'error.rate',
        product_not_found: 'error.unavailable'
      };
      throw new Error(map[data.error] ? T(map[data.error]) : T('error.generic'));
    }

    $('#orderForm').hidden = true;
    $('#orderSuccess').hidden = false;
    $('#successRef').textContent = data.ref;
    $('#orderSuccess').scrollIntoView({ behavior: 'smooth', block: 'center' });
    toast(T('toast.order', { ref: data.ref }));
  } catch (err) {
    alertBox.hidden = false;
    alertBox.textContent = err.message;
  } finally {
    btn.classList.remove('is-loading');
  }
}

/* ---------------- reveals + ui ---------------- */

let observer;

function observeReveals() {
  if (!('IntersectionObserver' in window)) {
    $$('[data-reveal]').forEach((el) => el.classList.add('in'));
    return;
  }
  if (!observer) {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('in');
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
  }
  $$('[data-reveal]:not(.in)').forEach((el) => observer.observe(el));
}

async function loadCommunes(wilayaCode) {
  const select = $('#fCommune');
  state.communes = [];
  if (!wilayaCode) {
    select.innerHTML = `<option value="">${esc(T('form.communeFirst'))}</option>`;
    select.disabled = true;
    return;
  }
  if (window.__STATIC_COMMUNES__) {
    state.communes = window.__STATIC_COMMUNES__[String(wilayaCode).padStart(2, '0')] || [];
    select.innerHTML =
      `<option value="">${esc(T('form.communePh'))}</option>` +
      state.communes.map((c) => `<option value="${c.code}">${esc(placeName(c))}</option>`).join('');
    select.disabled = false;
    return;
  }
  select.disabled = true;
  select.innerHTML = `<option value="">${esc(T('form.communeLoading'))}</option>`;
  try {
    const res = await fetch(`/api/public/communes/${encodeURIComponent(wilayaCode)}`);
    const data = await res.json();
    state.communes = data.communes || [];
    select.innerHTML =
      `<option value="">${esc(T('form.communePh'))}</option>` +
      state.communes.map((c) => `<option value="${c.code}">${esc(placeName(c))}</option>`).join('');
  } catch (_) {
    select.innerHTML = `<option value="">${esc(T('form.communeFail'))}</option>`;
    toast(T('toast.communesError'));
  } finally {
    select.disabled = false;
  }
}

function initChrome() {
  const header = $('#header');
  const stickyBar = $('#stickyBar');
  const orderSection = $('#order');

  const onScroll = () => {
    header.classList.toggle('is-stuck', window.scrollY > 8);
    const rect = orderSection.getBoundingClientRect();
    const pastHero = window.scrollY > window.innerHeight * 0.6;
    const inOrder = rect.top < window.innerHeight * 0.8 && rect.bottom > 0;
    stickyBar.classList.toggle('show', pastHero && !inOrder);
  };

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  const burger = $('#burger');
  const nav = $('.nav');
  burger.addEventListener('click', () => {
    const open = burger.getAttribute('aria-expanded') === 'true';
    burger.setAttribute('aria-expanded', String(!open));
    nav.classList.toggle('open', !open);
    document.body.classList.toggle('locked', !open);
  });
  $$('.nav a').forEach((a) =>
    a.addEventListener('click', () => {
      burger.setAttribute('aria-expanded', 'false');
      nav.classList.remove('open');
      document.body.classList.remove('locked');
    })
  );

  $('#qtyMinus').addEventListener('click', () => {
    state.qty = Math.max(1, state.qty - 1);
    $('#qtyInput').value = state.qty;
    updateTotals();
  });
  $('#qtyPlus').addEventListener('click', () => {
    state.qty = Math.min(20, state.qty + 1);
    $('#qtyInput').value = state.qty;
    updateTotals();
  });
  $('#qtyInput').addEventListener('change', (e) => {
    state.qty = Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1));
    e.target.value = state.qty;
    updateTotals();
  });

  $('#fWilaya').addEventListener('change', (e) => {
    state.wilaya = e.target.value || null;
    setFieldError('wilaya', state.wilaya ? '' : T('error.wilaya'));
    setFieldError('commune', '');
    loadCommunes(state.wilaya);
    updateTotals();
  });

  $('#fCommune').addEventListener('change', () => setFieldError('commune', ''));

  ['name', 'phone', 'address'].forEach((name) => {
    const input = $(`[name="${name}"]`);
    input.addEventListener('blur', () => setFieldError(name, RULES[name](input.value || '')));
    input.addEventListener('input', () => {
      if (input.closest('.field').classList.contains('has-error')) setFieldError(name, RULES[name](input.value || ''));
    });
  });

  $('#orderForm').addEventListener('submit', submitOrder);
}

/* ---------------- boot ---------------- */

async function boot() {
  if (window.__STATIC_PREVIEW__) {
    const bar = document.createElement('div');
    bar.className = 'preview-bar';
    bar.textContent = T('preview.banner');
    document.body.prepend(bar);
  }

  if (window.__STATIC_STORE__) {
    state.store = window.__STATIC_STORE__;
  } else {
    try {
      const res = await fetch('/api/public/store', { headers: { Accept: 'application/json' } });
      if (!res.ok) throw new Error('failed');
      state.store = await res.json();
    } catch (err) {
      toast(T('toast.loadError'));
      return;
    }
  }

  hydrate();
  renderProducts();

  const params = new URLSearchParams(location.search);
  const rawSlug = params.get('p') || location.pathname.split('/p/')[1];
  const slug = rawSlug ? decodeURIComponent(rawSlug) : '';
  const wanted = slug ? state.store.products.find((p) => p.slug === slug) : null;
  const initial = wanted || state.store.products.find((p) => p.featured) || state.store.products[0];
  if (initial) selectProduct(initial);

  initChrome();
  updateTotals();
  observeReveals();

  if (wanted) setTimeout(() => $('#order').scrollIntoView({ behavior: 'smooth' }), 400);
}

document.addEventListener('DOMContentLoaded', boot);
