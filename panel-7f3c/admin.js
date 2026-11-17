'use strict';

/* ============================================================
   Castellum Shop — admin
   ============================================================ */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const nf = new Intl.NumberFormat('fr-FR');
const money = (n) => `${nf.format(Math.round(Number(n) || 0))} دج`;
const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const STATUS = {
  new: { label: 'جديد', cls: 'new' },
  confirmed: { label: 'مؤكد', cls: 'confirmed' },
  shipped: { label: 'مُرسل', cls: 'shipped' },
  delivered: { label: 'مُسلّم', cls: 'delivered' },
  cancelled: { label: 'ملغى', cls: 'cancelled' }
};

const state = {
  view: 'dashboard',
  settings: null,
  wilayas: [],
  products: [],
  productImages: [], // { src, file }
  heroImage: '',
  orders: { rows: [], page: 1, pages: 1, total: 0 },
  filters: { status: 'all', q: '' },
  dirty: false,
  notifier: false,
  lastNew: null,
  contentLang: 'ar',
  contentDrafts: null
};

function toast(msg, type) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `toast show${type === 'error' ? ' toast--error' : ''}`;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (el.className = 'toast'), 3200);
}

async function api(url, options = {}) {
  const opts = { credentials: 'same-origin', ...options };
  if (opts.body && !(opts.body instanceof FormData)) {
    opts.headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
  }
  const res = await fetch(url, opts);
  if (res.status === 401) {
    showLogin();
    throw new Error('unauthorized');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || 'وقع خطأ، عاود المحاولة.');
    err.data = data;
    err.status = res.status;
    throw err;
  }
  return data;
}

/* ============================================================
   auth
   ============================================================ */

function showLogin() {
  $('#loginView').hidden = false;
  $('#appView').hidden = true;
  setTimeout(() => $('#loginPassword')?.focus(), 100);
}

function showApp() {
  $('#loginView').hidden = true;
  $('#appView').hidden = false;
}

async function login(e) {
  e.preventDefault();
  const btn = $('#loginBtn');
  const errBox = $('#loginError');
  errBox.hidden = true;
  btn.disabled = true;
  try {
    await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: $('#loginPassword').value }) });
    $('#loginForm').reset();
    showApp();
    await boot();
  } catch (err) {
    errBox.hidden = false;
    errBox.textContent = err.message;
    $('#loginPassword').select();
  } finally {
    btn.disabled = false;
  }
}

async function logout() {
  try {
    await api('/api/admin/logout', { method: 'POST' });
  } catch (_) {}
  location.reload();
}

/* ============================================================
   navigation
   ============================================================ */

const VIEWS = {
  dashboard: { title: 'نظرة عامة', sub: 'ملخص أداء المتجر' },
  products: { title: 'المنتجات', sub: 'أضف، عدّل، وتحكّم في المخزون' },
  orders: { title: 'الطلبات', sub: 'تابع وأكّد طلبات الزبائن' },
  settings: { title: 'الإعدادات', sub: 'المتجر، التوصيل، والمحتوى' }
};

function go(view) {
  if (!VIEWS[view]) return;
  state.view = view;
  $$('.snav').forEach((b) => b.classList.toggle('is-active', b.dataset.view === view));
  $$('.view').forEach((v) => (v.hidden = v.id !== `view-${view}`));
  $('#viewTitle').textContent = VIEWS[view].title;
  $('#viewSub').textContent = VIEWS[view].sub;
  closeSidebar();
  if (view === 'orders') loadOrders();
  if (view === 'products') loadProducts();
  if (view === 'dashboard') loadDashboard();
  if (view === 'settings') loadSettings();
}

function closeSidebar() {
  $('#sidebar').classList.remove('open');
  const bd = $('#sideBackdrop');
  if (bd) bd.hidden = true;
  document.body.classList.remove('locked');
}

/* ============================================================
   dashboard
   ============================================================ */

async function loadDashboard() {
  const [stats, orders] = await Promise.all([api('/api/admin/stats'), api('/api/admin/orders?limit=6')]);

  $('#stOrders').textContent = nf.format(stats.orders);
  $('#stToday').textContent = nf.format(stats.todayOrders);
  $('#stNew').textContent = nf.format(stats.counts.new);
  $('#stRevenue').textContent = nf.format(stats.revenue);
  $('#stProducts').textContent = nf.format(stats.products);
  $('#stActive').textContent = nf.format(stats.activeProducts);
  $('#stLow').textContent = nf.format(stats.lowStock);
  $('#navProducts').textContent = stats.products;
  $('#navOrders').textContent = stats.counts.new;

  const rows = orders.orders.slice(0, 6);
  $('#recentOrders').innerHTML = rows.length
    ? rows
        .map(
          (o) => `<tr>
            <td data-label="المرجع" class="o-ref">${esc(o.ref)}</td>
            <td data-label="الزبون" class="o-name">${esc(o.customer.name)}</td>
            <td data-label="الولاية">${esc(o.customer.wilayaName)}</td>
            <td data-label="الإجمالي"><b>${money(o.total)}</b></td>
            <td data-label="الحالة"><span class="badge badge--${STATUS[o.status]?.cls || 'new'}">${STATUS[o.status]?.label || o.status}</span></td>
          </tr>`
        )
        .join('')
    : '<tr><td colspan="5" class="empty">لا توجد طلبات بعد.</td></tr>';

  const total = Math.max(1, stats.orders);
  $('#statusList').innerHTML = Object.entries(STATUS)
    .map(([key, meta]) => {
      const count = stats.counts[key] || 0;
      return `<div class="srow">
        <span class="srow__dot" style="background:${dotColor(key)}"></span>
        <span>${meta.label}</span>
        <span class="srow__bar"><i style="width:${Math.round((count / total) * 100)}%;background:${dotColor(key)}"></i></span>
        <strong>${nf.format(count)}</strong>
      </div>`;
    })
    .join('');
}

function dotColor(status) {
  return { new: '#2f7ec9', confirmed: '#c9a44c', shipped: '#5b64b8', delivered: '#129b78', cancelled: '#c0473a' }[status] || '#ccc';
}

/* ============================================================
   products
   ============================================================ */

async function loadProducts() {
  const { products } = await api('/api/admin/products');
  state.products = products;
  renderProducts();
}

function renderProducts() {
  const q = ($('#productSearch').value || '').trim().toLowerCase();
  const list = state.products.filter((p) => !q || p.name.toLowerCase().includes(q) || p.slug.includes(q));
  const grid = $('#productsGrid');
  $('#productsEmpty').hidden = list.length > 0;

  grid.innerHTML = list
    .map((p) => {
      const off = p.oldPrice > p.price ? Math.round(((p.oldPrice - p.price) / p.oldPrice) * 100) : 0;
      return `<article class="pcard">
        <div class="pcard__media">
          ${p.images[0] ? `<img src="${esc(p.images[0])}" alt="${esc(p.name)}" loading="lazy" />` : ''}
          ${p.badge ? `<span class="pcard__badge">${esc(p.badge)}</span>` : ''}
          ${off ? `<span class="pcard__off">-${off}%</span>` : ''}
          <span class="pcard__state ${p.active ? '' : 'pcard__state--off'}">${p.active ? 'ظاهر' : 'مخفي'}</span>
        </div>
        <div class="pcard__body">
          <span class="pcard__type ${p.type === 'physical' ? 'pcard__type--physical' : ''}">${p.type === 'physical' ? 'منتج مادي' : 'منتج رقمي'}</span>
          <h3>${esc(p.name)}</h3>
          <p>${esc(p.description || 'بلا وصف')}</p>
          <div class="pcard__row">
            <strong>${nf.format(p.price)} دج</strong>
            ${p.oldPrice > p.price ? `<s>${nf.format(p.oldPrice)} دج</s>` : ''}
            <small>${p.stock} في المخزون</small>
          </div>
        </div>
        <div class="pcard__actions">
          <button class="btn btn--ghost btn--sm" data-edit="${esc(p.id)}">تعديل</button>
          <a class="icon-btn" href="../?p=${encodeURIComponent(p.slug)}" target="_blank" rel="noopener" title="عرض">↗</a>
          <button class="icon-btn icon-btn--danger" data-del="${esc(p.id)}" title="حذف">🗑</button>
        </div>
      </article>`;
    })
    .join('');
}

function openProductModal(product) {
  const form = $('#productForm');
  form.reset();
  $('#pmTitle').textContent = product ? 'تعديل المنتج' : 'منتج جديد';
  form.elements.id.value = product ? product.id : '';
  form.elements.name.value = product ? product.name : '';
  form.elements.description.value = product ? product.description || '' : '';
  form.elements.price.value = product ? product.price : '';
  form.elements.oldPrice.value = product ? product.oldPrice || '' : '';
  form.elements.type.value = product ? product.type || 'physical' : 'physical';
  form.elements.stock.value = product ? product.stock : 50;
  form.elements.badge.value = product ? product.badge || '' : '';
  form.elements.sort.value = product ? product.sort || 1 : 1;
  form.elements.active.checked = product ? Boolean(product.active) : true;
  form.elements.featured.checked = product ? Boolean(product.featured) : false;

  $$('#productForm [data-tr]').forEach((el) => (el.value = ''));
  if (product && product.i18n) {
    for (const l of ['fr', 'en']) {
      for (const f of ['name', 'description', 'badge']) {
        const el = $(`#productForm [data-tr="${l}.${f}"]`);
        if (el) el.value = (product.i18n[l] && product.i18n[l][f]) || '';
      }
    }
  }

  state.productImages = (product?.images || []).map((src) => ({ src, file: null }));
  renderImageGrid();
  $('#productModal').hidden = false;
  setTimeout(() => form.elements.name.focus(), 120);
}

function renderImageGrid() {
  $('#imageGrid').innerHTML = state.productImages
    .map(
      (img, i) => `<div class="upload__item">
        <img src="${esc(img.src)}" alt="" />
        ${i === 0 ? '<span>رئيسية</span>' : ''}
        <button type="button" class="upload__remove" data-rm="${i}" aria-label="حذف">✕</button>
      </div>`
    )
    .join('');
}

function addFiles(files) {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
  for (const file of files) {
    if (state.productImages.length >= 8) {
      toast('الحد 8 صور.', 'error');
      break;
    }
    if (!allowed.includes(file.type)) {
      toast(`الصيغة غير مدعومة: ${file.name}`, 'error');
      continue;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast(`الصورة كبيرة: ${file.name}`, 'error');
      continue;
    }
    state.productImages.push({ src: URL.createObjectURL(file), file });
  }
  renderImageGrid();
}

async function saveProduct(e) {
  e.preventDefault();
  const form = $('#productForm');
  const id = form.elements.id.value;
  const fd = new FormData();

  fd.append('name', form.elements.name.value.trim());
  fd.append('description', form.elements.description.value.trim());
  fd.append('price', form.elements.price.value);
  fd.append('oldPrice', form.elements.oldPrice.value || '0');
  fd.append('type', form.elements.type.value);
  fd.append('stock', form.elements.stock.value || '0');
  fd.append('badge', form.elements.badge.value);
  fd.append('sort', form.elements.sort.value || '1');
  fd.append('active', form.elements.active.checked ? 'true' : 'false');
  fd.append('featured', form.elements.featured.checked ? 'true' : 'false');
  const tr = {};
  $$('#productForm [data-tr]').forEach((el) => {
    const [l, f] = el.dataset.tr.split('.');
    tr[l] = tr[l] || {};
    tr[l][f] = el.value.trim();
  });
  fd.append('i18n', JSON.stringify(tr));
  fd.append('images', JSON.stringify(state.productImages.filter((i) => !i.file).map((i) => i.src)));
  state.productImages.filter((i) => i.file).forEach((i) => fd.append('images', i.file));

  const btn = $('#saveProductBtn');
  btn.disabled = true;
  try {
    await api(id ? `/api/admin/products/${id}` : '/api/admin/products', { method: id ? 'PUT' : 'POST', body: fd });
    toast(id ? 'تم تحديث المنتج.' : 'تمت إضافة المنتج.');
    $('#productModal').hidden = true;
    await loadProducts();
    loadDashboard().catch(() => {});
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function deleteProduct(id) {
  const product = state.products.find((p) => p.id === id);
  const ok = await confirmDialog({
    title: 'حذف المنتج',
    text: `راح تحذف «${product?.name || ''}» نهائياً. متأكد؟`,
    okText: 'حذف'
  });
  if (!ok) return;
  try {
    await api(`/api/admin/products/${id}`, { method: 'DELETE' });
    toast('تم حذف المنتج.');
    await loadProducts();
  } catch (err) {
    if (err.status === 409) {
      toast(err.message, 'error');
    } else {
      toast(err.message, 'error');
    }
  }
}

/* ============================================================
   orders
   ============================================================ */

async function loadOrders() {
  const params = new URLSearchParams({
    status: state.filters.status,
    q: state.filters.q,
    page: String(state.orders.page || 1),
    limit: '20'
  });
  const data = await api(`/api/admin/orders?${params}`);
  state.orders = { rows: data.orders, page: data.page, pages: data.pages, total: data.total };
  renderOrders();
  $('#exportCsv').href = `/api/admin/orders.csv?status=${encodeURIComponent(state.filters.status)}`;
}

function renderOrders() {
  const { rows, page, pages, total } = state.orders;
  const body = $('#ordersBody');

  body.innerHTML = rows.length
    ? rows
        .map(
          (o) => `<tr data-order="${esc(o.id)}">
            <td data-label="المرجع" class="o-ref">${esc(o.ref)}</td>
            <td data-label="الزبون" class="o-name">${esc(o.customer.name)}</td>
            <td data-label="الهاتف" dir="ltr"><a href="tel:${esc(o.customer.phone)}">${esc(o.customer.phone)}</a></td>
            <td data-label="الولاية / البلدية">${esc(o.customer.wilayaName)} <small style="color:#98a29d">/ ${esc(o.customer.commune)}</small></td>
            <td data-label="المنتج"><span class="o-prod" title="${esc(o.productName)}">${esc(o.productName)}</span></td>
            <td data-label="الكمية">${o.qty}</td>
            <td data-label="الإجمالي"><b>${money(o.total)}</b></td>
            <td data-label="الحالة">
              <select class="status-select" data-status="${esc(o.id)}">
                ${Object.entries(STATUS)
                  .map(([k, v]) => `<option value="${k}" ${k === o.status ? 'selected' : ''}>${v.label}</option>`)
                  .join('')}
              </select>
            </td>
            <td data-label=""><button class="icon-btn" data-view-order="${esc(o.id)}" title="تفاصيل">⋯</button></td>
          </tr>`
        )
        .join('')
    : '<tr><td colspan="9" class="empty">ما كاينش طلبات بهذا الفلتر.</td></tr>';

  const pager = $('#ordersPager');
  if (pages <= 1) {
    pager.innerHTML = `<span style="font-size:12px;color:#8d968f">${nf.format(total)} طلب</span>`;
    return;
  }
  let html = `<button data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>›</button>`;
  for (let i = 1; i <= pages; i++) {
    if (pages > 7 && Math.abs(i - page) > 2 && i !== 1 && i !== pages) {
      if (Math.abs(i - page) === 3) html += '<span style="color:#b0b8b3">…</span>';
      continue;
    }
    html += `<button data-page="${i}" class="${i === page ? 'is-active' : ''}">${i}</button>`;
  }
  html += `<button data-page="${page + 1}" ${page >= pages ? 'disabled' : ''}>‹</button>`;
  pager.innerHTML = html;
}

async function updateOrderStatus(id, status) {
  try {
    await api(`/api/admin/orders/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) });
    const row = state.orders.rows.find((o) => o.id === id);
    if (row) row.status = status;
    toast(`الحالة: ${STATUS[status].label}`);
    loadDashboard().catch(() => {});
    if (!$('#orderDrawer').hidden) openOrderDrawer(id);
  } catch (err) {
    toast(err.message, 'error');
  }
}

function openOrderDrawer(id) {
  const o = state.orders.rows.find((x) => x.id === id);
  if (!o) return;
  $('#drawerRef').textContent = o.ref;
  const date = new Date(o.createdAt).toLocaleString('ar-DZ', { dateStyle: 'medium', timeStyle: 'short' });

  $('#drawerBody').innerHTML = `
    <div class="dorder__product">
      ${o.productImage ? `<img src="${esc(o.productImage)}" alt="" />` : ''}
      <div>
        <strong>${esc(o.productName)}</strong>
        <small>${o.qty} × ${money(o.unitPrice)}</small>
      </div>
      <span class="badge badge--${STATUS[o.status]?.cls}" style="margin-inline-start:auto">${STATUS[o.status]?.label}</span>
    </div>

    <div class="dorder__rows">
      <div class="dorder__row"><span>المجموع الجزئي</span><b>${money(o.subtotal)}</b></div>
      <div class="dorder__row"><span>التوصيل</span><b>${o.shipping === 0 ? 'مجاني' : money(o.shipping)}</b></div>
      <div class="dorder__row dorder__total"><span>الإجمالي</span><b>${money(o.total)}</b></div>
    </div>

    <div class="dorder__block">
      <h4>الزبون</h4>
      <p><b>${esc(o.customer.name)}</b></p>
      <p dir="ltr" style="text-align:start"><a href="tel:${esc(o.customer.phone)}">${esc(o.customer.phone)}</a></p>
      <p>${esc(o.customer.wilayaName)} — ${esc(o.customer.commune)}</p>
      <p>${esc(o.customer.address)}</p>
      ${o.customer.notes ? `<p style="margin-top:8px;color:#6a746f">📝 ${esc(o.customer.notes)}</p>` : ''}
    </div>

    <div class="dorder__block">
      <h4>الطلب</h4>
      <p>النوع: ${o.productType === 'physical' ? 'منتج مادي — توصيل' : 'منتج رقمي — تسليم فوري'}</p>
      <p>التاريخ: ${esc(date)}</p>
      <p>المرجع: <b>${esc(o.ref)}</b></p>
      <p>الحالة الحالية: ${STATUS[o.status]?.label}</p>
    </div>

    <div class="dorder__actions">
      <a class="btn btn--ghost btn--full" href="tel:${esc(o.customer.phone)}">📞 اتصال بالزبون</a>
      <button class="btn btn--primary btn--full" data-set-status="confirmed" data-id="${esc(o.id)}">✔ تأكيد الطلب</button>
      <button class="btn btn--ghost" data-set-status="shipped" data-id="${esc(o.id)}">🚚 مُرسل</button>
      <button class="btn btn--ghost" data-set-status="delivered" data-id="${esc(o.id)}">📦 مُسلّم</button>
      <button class="btn btn--danger btn--full" data-del-order="${esc(o.id)}">🗑 حذف الطلب</button>
    </div>`;

  $('#orderDrawer').hidden = false;
}

async function deleteOrder(id) {
  const ok = await confirmDialog({ title: 'حذف الطلب', text: 'راح يتحذف الطلب نهائياً من السجل. متأكد؟', okText: 'حذف' });
  if (!ok) return;
  try {
    await api(`/api/admin/orders/${id}`, { method: 'DELETE' });
    $('#orderDrawer').hidden = true;
    toast('تم حذف الطلب.');
    await loadOrders();
    loadDashboard().catch(() => {});
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ============================================================
   settings
   ============================================================ */

const CONTENT_KEYS = ['tagline', 'heroEyebrow', 'heroTitle', 'heroSubtitle', 'announcement', 'codNote'];
const CONTENT_LISTS = ['features', 'reviews', 'faq'];
const STORE_FIELDS = ['storeName', 'address', 'freeShippingThreshold'];

function contentFromSettings(s, lang) {
  const src = lang === 'ar' ? s : (s.i18n && s.i18n[lang]) || {};
  const out = {};
  CONTENT_KEYS.forEach((k) => {
    out[k] = src[k] ?? '';
  });
  CONTENT_LISTS.forEach((k) => {
    out[k] = Array.isArray(src[k]) ? JSON.parse(JSON.stringify(src[k])) : [];
  });
  return out;
}

async function loadSettings() {
  const data = await api('/api/admin/settings');
  state.settings = data.settings;
  state.wilayas = data.wilayas || state.wilayas;
  state.contentDrafts = {
    ar: contentFromSettings(data.settings, 'ar'),
    fr: contentFromSettings(data.settings, 'fr'),
    en: contentFromSettings(data.settings, 'en')
  };
  state.contentLang = 'ar';
  fillSettings();
  state.dirty = false;
  $('#savebar').classList.remove('show');
}

function fillSettings() {
  const s = state.settings;
  const form = $('#settingsForm');
  for (const key of STORE_FIELDS) {
    const input = form.elements[key];
    if (input) input.value = s[key] ?? '';
  }
  state.heroImage = s.heroImage || '';
  updateHeroPreview();

  renderDelivery();
  renderContent();
}

function renderContent() {
  const form = $('#settingsForm');
  const c = (state.contentDrafts && state.contentDrafts[state.contentLang]) || {};
  CONTENT_KEYS.forEach((key) => {
    if (form.elements[key]) form.elements[key].value = c[key] || '';
  });
  renderRepeat('features', c.features || []);
  renderRepeat('reviews', c.reviews || []);
  renderRepeat('faq', c.faq || []);
  $$('[data-content-lang]').forEach((b) => b.classList.toggle('is-on', b.dataset.contentLang === state.contentLang));
  const hints = {
    ar: 'تعدّل الآن النصوص العربية (النسخة الأساسية).',
    fr: 'Vous modifiez la version française du contenu.',
    en: 'You are editing the English content.'
  };
  const hint = $('#contentLangHint');
  if (hint) hint.textContent = hints[state.contentLang];
}

function captureContent() {
  const form = $('#settingsForm');
  const c = {};
  CONTENT_KEYS.forEach((k) => {
    c[k] = (form.elements[k]?.value || '').trim();
  });
  c.features = collectRepeat('features');
  c.reviews = collectRepeat('reviews');
  c.faq = collectRepeat('faq');
  return c;
}

function updateHeroPreview() {
  const el = $('#heroPreview');
  el.style.backgroundImage = state.heroImage ? `url('${state.heroImage}')` : '';
  el.querySelector('span').textContent = state.heroImage ? '' : 'صورة الهيرو';
}

function renderDelivery() {
  const overrides = state.settings.delivery || {};
  $('#deliveryGrid').innerHTML = state.wilayas
    .map((w) => {
      const price = overrides[w.code] !== undefined ? overrides[w.code] : w.delivery;
      return `<label class="delivery-item">
        <span>${w.code}</span>
        <strong>${esc(w.name)}</strong>
        <input type="number" min="0" step="50" data-wilaya="${w.code}" value="${price}" aria-label="سعر التوصيل ${esc(w.name)}" />
      </label>`;
    })
    .join('');
}

function repeatRow(type, value = {}) {
  if (type === 'features') {
    const labels = { bolt: 'تسليم', lock: 'أمان', headset: 'دعم', refresh: 'تحديث', download: 'تحميل', sparkle: 'لمعان' };
    return `<div class="repeat__row" data-type="features" style="grid-template-columns:110px 1fr 2fr 28px">
      <button type="button" class="repeat__del" data-del-row>✕</button>
      <select data-k="icon">
        ${Object.entries(labels).map(([i, label]) => `<option value="${i}" ${value.icon === i ? 'selected' : ''}>${label}</option>`).join('')}
      </select>
      <input data-k="title" placeholder="العنوان" dir="auto" value="${esc(value.title || '')}" />
      <input data-k="text" placeholder="النص" dir="auto" value="${esc(value.text || '')}" />
    </div>`;
  }
  if (type === 'reviews') {
    return `<div class="repeat__row" data-type="reviews" style="grid-template-columns:1fr 1fr 80px 28px">
      <button type="button" class="repeat__del" data-del-row>✕</button>
      <input data-k="name" placeholder="الاسم" dir="auto" value="${esc(value.name || '')}" />
      <input data-k="city" placeholder="المدينة" dir="auto" value="${esc(value.city || '')}" />
      <select data-k="rating">${[5, 4, 3, 2, 1].map((r) => `<option value="${r}" ${Number(value.rating) === r ? 'selected' : ''}>${r} ★</option>`).join('')}</select>
      <input data-k="text" placeholder="التعليق" dir="auto" value="${esc(value.text || '')}" class="full" style="grid-column:1/-1" />
    </div>`;
  }
  return `<div class="repeat__row" data-type="faq" style="grid-template-columns:1fr 1fr 28px">
    <button type="button" class="repeat__del" data-del-row>✕</button>
    <input data-k="q" placeholder="السؤال" dir="auto" value="${esc(value.q || '')}" />
    <input data-k="a" placeholder="الجواب" dir="auto" value="${esc(value.a || '')}" />
  </div>`;
}

function renderRepeat(type, list) {
  const map = { features: '#featuresEditor', reviews: '#reviewsEditor', faq: '#faqEditor' };
  $(map[type]).innerHTML = list.map((v) => repeatRow(type, v)).join('') || '';
}

function collectRepeat(type) {
  const map = { features: '#featuresEditor', reviews: '#reviewsEditor', faq: '#faqEditor' };
  return $$(`${map[type]} .repeat__row`)
    .map((row) => {
      const obj = {};
      $$('[data-k]', row).forEach((input) => {
        obj[input.dataset.k] = input.value.trim();
      });
      return obj;
    })
    .filter((o) => Object.values(o).some(Boolean));
}

function collectSettings() {
  state.contentDrafts[state.contentLang] = captureContent();
  const form = $('#settingsForm');
  const payload = {};
  for (const key of STORE_FIELDS) {
    const input = form.elements[key];
    if (input) payload[key] = input.value.trim();
  }
  payload.freeShippingThreshold = Number(payload.freeShippingThreshold) || 0;
  payload.heroImage = state.heroImage;
  payload.delivery = {};
  $$('#deliveryGrid input[data-wilaya]').forEach((input) => {
    payload.delivery[input.dataset.wilaya] = Number(input.value) || 0;
  });
  const ar = state.contentDrafts.ar;
  CONTENT_KEYS.forEach((k) => {
    payload[k] = ar[k] || '';
  });
  payload.features = ar.features;
  payload.reviews = ar.reviews;
  payload.faq = ar.faq;
  payload.i18n = { fr: state.contentDrafts.fr, en: state.contentDrafts.en };
  return payload;
}

async function saveSettings(e) {
  e && e.preventDefault();
  const btn = $('#saveSettings');
  btn.disabled = true;
  try {
    const { settings } = await api('/api/admin/settings', { method: 'PUT', body: JSON.stringify(collectSettings()) });
    state.settings = settings;
    state.contentDrafts = {
      ar: contentFromSettings(settings, 'ar'),
      fr: contentFromSettings(settings, 'fr'),
      en: contentFromSettings(settings, 'en')
    };
    fillSettings();
    state.dirty = false;
    $('#savebar').classList.remove('show');
    toast('تم حفظ الإعدادات.');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

function markDirty() {
  if (state.view !== 'settings') return;
  state.dirty = true;
  $('#savebar').classList.add('show');
}

/* ============================================================
   hero image upload
   ============================================================ */

async function uploadHero(file) {
  if (!file) return;
  if (file.size > 6 * 1024 * 1024) return toast('الصورة كبيرة (حد 6MB).', 'error');
  const fd = new FormData();
  fd.append('images', file);
  try {
    const { images } = await api('/api/admin/upload', { method: 'POST', body: fd });
    state.heroImage = images[0];
    updateHeroPreview();
    markDirty();
    toast('تم رفع الصورة — لا تنسى الحفظ.');
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ============================================================
   drawer / modal helpers
   ============================================================ */

function confirmDialog({ title, text, okText = 'تأكيد' }) {
  return new Promise((resolve) => {
    const modal = $('#confirmModal');
    $('#confirmTitle').textContent = title;
    $('#confirmText').textContent = text;
    $('#confirmOk').textContent = okText;
    modal.hidden = false;

    const done = (val) => {
      modal.hidden = true;
      $('#confirmOk').replaceWith($('#confirmOk').cloneNode(true));
      resolve(val);
    };

    $('#confirmOk').addEventListener('click', () => done(true), { once: true });
    $$('[data-close-confirm]').forEach((b) => b.addEventListener('click', () => done(false), { once: true }));
  });
}

/* ============================================================
   events
   ============================================================ */

function wire() {
  $('#loginForm').addEventListener('submit', login);
  $('#togglePass').addEventListener('click', () => {
    const input = $('#loginPassword');
    input.type = input.type === 'password' ? 'text' : 'password';
    input.focus();
  });

  $('#logoutBtn').addEventListener('click', logout);
  $$('.snav').forEach((b) => b.addEventListener('click', () => go(b.dataset.view)));
  $$('[data-goto]').forEach((b) => b.addEventListener('click', () => go(b.dataset.goto)));

  $('#sideToggle').addEventListener('click', () => {
    const open = !$('#sidebar').classList.contains('open');
    $('#sidebar').classList.toggle('open', open);
    $('#sideBackdrop').hidden = !open;
    document.body.classList.toggle('locked', open);
  });
  $('#sideBackdrop').addEventListener('click', closeSidebar);

  // products
  $('#newProductBtn').addEventListener('click', () => openProductModal(null));
  $$('[data-new]').forEach((b) => b.addEventListener('click', () => openProductModal(null)));
  $('#productSearch').addEventListener('input', renderProducts);
  $('#productForm').addEventListener('submit', saveProduct);

  $('#productsGrid').addEventListener('click', (e) => {
    const edit = e.target.closest('[data-edit]');
    if (edit) return openProductModal(state.products.find((p) => p.id === edit.dataset.edit));
    const del = e.target.closest('[data-del]');
    if (del) return deleteProduct(del.dataset.del);
  });

  $('#productModal').addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) $('#productModal').hidden = true;
  });

  $('#imageGrid').addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm]');
    if (!rm) return;
    state.productImages.splice(Number(rm.dataset.rm), 1);
    renderImageGrid();
  });

  const drop = $('#dropZone');
  const fileInput = $('#productFiles');
  drop.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', () => {
    addFiles(fileInput.files);
    fileInput.value = '';
  });
  ['dragenter', 'dragover'].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.add('drag');
    })
  );
  ['dragleave', 'drop'].forEach((ev) =>
    drop.addEventListener(ev, (e) => {
      e.preventDefault();
      drop.classList.remove('drag');
    })
  );
  drop.addEventListener('drop', (e) => {
    if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
  });

  // orders
  $('#orderSearch').addEventListener(
    'input',
    debounce((e) => {
      state.filters.q = e.target.value.trim();
      state.orders.page = 1;
      loadOrders();
    }, 350)
  );

  $('#statusChips').addEventListener('click', (e) => {
    const chip = e.target.closest('[data-status]');
    if (!chip) return;
    $$('.chip', $('#statusChips')).forEach((c) => c.classList.toggle('is-active', c === chip));
    state.filters.status = chip.dataset.status;
    state.orders.page = 1;
    loadOrders();
  });

  $('#ordersBody').addEventListener('change', (e) => {
    const sel = e.target.closest('[data-status]');
    if (sel) updateOrderStatus(sel.dataset.status, sel.value);
  });

  $('#ordersBody').addEventListener('click', (e) => {
    const view = e.target.closest('[data-view-order]');
    const row = e.target.closest('tr[data-order]');
    if (view) return openOrderDrawer(view.dataset.viewOrder);
    if (row && !e.target.closest('select') && !e.target.closest('a')) openOrderDrawer(row.dataset.order);
  });

  $('#ordersPager').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-page]');
    if (!btn || btn.disabled) return;
    state.orders.page = Number(btn.dataset.page);
    loadOrders();
  });

  $('#orderDrawer').addEventListener('click', (e) => {
    if (e.target.closest('[data-close-drawer]')) $('#orderDrawer').hidden = true;
    const set = e.target.closest('[data-set-status]');
    if (set) updateOrderStatus(set.dataset.id, set.dataset.setStatus);
    const del = e.target.closest('[data-del-order]');
    if (del) deleteOrder(del.dataset.delOrder);
  });

  // settings
  $('#settingsTabs').addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (!tab) return;
    $$('.tab').forEach((t) => t.classList.toggle('is-active', t === tab));
    $$('.tabpanel').forEach((p) => (p.hidden = p.dataset.panel !== tab.dataset.tab));
  });

  $('#settingsForm').addEventListener('input', markDirty);
  $('#settingsForm').addEventListener('change', markDirty);
  $('#settingsForm').addEventListener('submit', saveSettings);

  $$('[data-content-lang]').forEach((btn) =>
    btn.addEventListener('click', () => {
      if (btn.dataset.contentLang === state.contentLang) return;
      state.contentDrafts[state.contentLang] = captureContent();
      state.contentLang = btn.dataset.contentLang;
      renderContent();
      markDirty();
    })
  );

  $('#resetSettings').addEventListener('click', loadSettings);

  $('#heroPick').addEventListener('click', () => $('#heroFile').click());
  $('#heroFile').addEventListener('change', (e) => {
    uploadHero(e.target.files[0]);
    e.target.value = '';
  });
  $('#heroClear').addEventListener('click', () => {
    state.heroImage = '';
    updateHeroPreview();
    markDirty();
  });

  $('#bulkApply').addEventListener('click', () => {
    const price = Number($('#bulkPrice').value);
    if (!Number.isFinite(price) || price < 0) return toast('اكتب سعر صحيح.', 'error');
    $$('#deliveryGrid input[data-wilaya]').forEach((i) => (i.value = price));
    markDirty();
  });

  $('#settingsForm').addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) {
      const type = add.dataset.add;
      const map = { feature: 'features', review: 'reviews', faq: 'faq' };
      const wrap = { features: '#featuresEditor', reviews: '#reviewsEditor', faq: '#faqEditor' }[map[type]];
      $(wrap).insertAdjacentHTML('beforeend', repeatRow(map[type]));
      markDirty();
      return;
    }
    const del = e.target.closest('[data-del-row]');
    if (del) {
      del.closest('.repeat__row').remove();
      markDirty();
    }
  });

  $('#changePassBtn').addEventListener('click', async () => {
    const form = $('#settingsForm');
    const current = form.elements.current.value;
    const next = form.elements.next.value;
    const confirm = form.elements.confirm.value;
    if (next !== confirm) return toast('كلمتا السر غير متطابقتين.', 'error');
    try {
      await api('/api/admin/password', { method: 'POST', body: JSON.stringify({ current, next }) });
      toast('تم تحديث كلمة السر — عاود الدخول.');
      setTimeout(() => location.reload(), 1200);
    } catch (err) {
      toast(err.message, 'error');
    }
  });
}

function startNotifier() {
  if (state.notifier) return;
  state.notifier = true;
  setInterval(async () => {
    if (document.hidden || $('#appView').hidden) return;
    try {
      const stats = await api('/api/admin/stats');
      $('#navOrders').textContent = stats.counts.new;
      if (state.lastNew !== null && stats.counts.new > state.lastNew) {
        toast('🔔 وصل طلب جديد!');
        if (state.view === 'dashboard') loadDashboard();
        if (state.view === 'orders') loadOrders();
      }
      state.lastNew = stats.counts.new;
    } catch (_) {
      /* silent — keep the dashboard usable if the link drops */
    }
  }, 45000);
}

function debounce(fn, wait) {  let t;
  return function (...args) {
    clearTimeout(t);
    t = setTimeout(() => fn.apply(this, args), wait);
  };
}

/* ============================================================
   boot
   ============================================================ */

async function boot() {
  try {
    const [settings, products] = await Promise.all([api('/api/admin/settings'), api('/api/admin/products')]);
    state.settings = settings.settings;
    state.wilayas = settings.wilayas || [];
    state.products = products.products;
    await loadDashboard();
    go('dashboard');
    startNotifier();
  } catch (err) {
    if (err.message !== 'unauthorized') toast(err.message, 'error');
  }
}

(async function init() {
  wire();
  try {
    const res = await fetch('/api/admin/me', { credentials: 'same-origin' });
    if (res.ok) {
      showApp();
      await boot();
    } else {
      showLogin();
    }
  } catch (_) {
    showLogin();
  }
})();
