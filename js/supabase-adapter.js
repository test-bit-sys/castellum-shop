'use strict';

/* Supabase adapter for the static build (GitHub Pages).
   It answers the existing /api/* calls in the browser, so the
   landing and admin code stay unchanged. */
(function () {
  const cfg = window.CASTELLUM_SUPABASE;
  if (!cfg || !window.supabase || !cfg.url || !cfg.anonKey) return;

  const sb = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  window.__sb = sb;

  const GEO = window.__GEO__ || { wilayas: [], communes: {} };
  const BUCKET = cfg.bucket || 'product-images';
  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];

  const json = (body, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const fail = (message, status = 400, error = 'error') => json({ error, message }, status);

  const productFromRow = (r) => ({
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description || '',
    price: r.price,
    oldPrice: r.old_price || 0,
    stock: r.stock,
    active: r.active,
    featured: r.featured,
    type: r.type,
    badge: r.badge || '',
    images: r.images || [],
    i18n: r.i18n || {},
    sort: r.sort,
    createdAt: r.created_at
  });

  const orderFromRow = (r) => ({
    id: r.id,
    ref: r.ref,
    productId: r.product_id,
    productName: r.product_name,
    productImage: r.product_image || '',
    productType: r.product_type,
    unitPrice: r.unit_price,
    qty: r.qty,
    subtotal: r.subtotal,
    shipping: r.shipping,
    total: r.total,
    customer: r.customer,
    status: r.status,
    createdAt: r.created_at,
    updatedAt: r.updated_at
  });

  function slugify(name) {
    return (
      String(name || '')
        .toLowerCase()
        .trim()
        .replace(/[^\p{L}\p{N}]+/gu, '-')
        .replace(/^-+|-+$/g, '') || `item-${Date.now().toString(36)}`
    );
  }

  async function uploadFile(file, prefix = 'img') {
    if (!(file instanceof File)) throw new Error('bad_file');
    if (!ALLOWED.includes(file.type)) throw new Error('bad_type');
    if (file.size > 6 * 1024 * 1024) throw new Error('too_large');
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
    const path = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const up = await sb.storage.from(BUCKET).upload(path, file, { contentType: file.type, upsert: false });
    if (up.error) throw up.error;
    return sb.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  }

  async function getSettings() {
    const { data, error } = await sb.from('settings').select('data').eq('id', 1).maybeSingle();
    if (error) throw error;
    return (data && data.data) || {};
  }

  async function getProducts(activeOnly) {
    let q = sb.from('products').select('*').order('sort', { ascending: true }).order('created_at', { ascending: false });
    if (activeOnly) q = q.eq('active', true);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map(productFromRow);
  }

  function deliveryFor(code, settings) {
    const override = settings.delivery && settings.delivery[code];
    if (override !== undefined && Number.isFinite(Number(override))) return Number(override);
    const w = GEO.wilayas.find((x) => x.code === code);
    return w ? Number(w.delivery) : 600;
  }

  function communeFor(wilayaCode, communeCode) {
    const list = GEO.communes[String(wilayaCode).padStart(2, '0')] || [];
    return list.find((c) => c.code === String(communeCode)) || null;
  }

  async function publicStore() {
    const [settings, products] = await Promise.all([getSettings(), getProducts(true)]);
    return {
      settings,
      products,
      wilayas: GEO.wilayas.map((w) => ({ code: w.code, name: w.name, nameFr: w.nameFr, delivery: w.delivery }))
    };
  }

  async function createOrder(body) {
    const settings = await getSettings();
    const products = await getProducts(false);
    const product = products.find((p) => p.id === String(body.productId || '') && p.active);
    if (!product) return fail('المنتج غير متوفر.', 400, 'product_not_found');
    if (Number(product.stock) <= 0) return fail('هذا المنتج نفد من المخزون.', 400, 'out_of_stock');

    const name = String(body.name || '').trim().replace(/\s+/g, ' ');
    const phoneRaw = String(body.phone || '').replace(/[\s\-().]/g, '');
    const wilayaCode = String(body.wilaya || '').padStart(2, '0');
    const communeCode = String(body.commune || '').trim();
    const address = String(body.address || '').trim();
    const notes = String(body.notes || '').trim().slice(0, 400);
    const qty = Math.max(1, Math.min(20, parseInt(body.qty, 10) || 1));
    const physical = product.type !== 'digital';

    if (name.length < 3 || name.length > 80) return fail('الاسم الكامل مطلوب (3 أحرف على الأقل).', 400, 'invalid_name');
    let phone = phoneRaw;
    if (phone.startsWith('00213')) phone = `0${phone.slice(5)}`;
    else if (phone.startsWith('+213')) phone = `0${phone.slice(4)}`;
    else if (phone.startsWith('213') && phone.length === 12) phone = `0${phone.slice(3)}`;
    if (!/^0[5-7]\d{8}$/.test(phone)) return fail('رقم الهاتف غير صحيح — مثال: 0555123456.', 400, 'invalid_phone');

    const wilaya = GEO.wilayas.find((w) => w.code === wilayaCode);
    if (!wilaya) return fail('اختر الولاية.', 400, 'invalid_wilaya');
    const commune = communeFor(wilayaCode, communeCode);
    if (!commune) return fail('اختر البلدية من القائمة.', 400, 'invalid_commune');
    if (physical && (address.length < 5 || address.length > 200))
      return fail('العنوان الكامل مطلوب (5 أحرف على الأقل).', 400, 'invalid_address');
    if (qty > Number(product.stock)) return fail(`المتوفر حالياً ${product.stock} قطعة فقط.`, 400, 'qty_unavailable');

    const unitPrice = Number(product.price) || 0;
    const subtotal = unitPrice * qty;
    const threshold = Number(settings.freeShippingThreshold) || 0;
    const shipping = !physical ? 0 : threshold > 0 && subtotal >= threshold ? 0 : deliveryFor(wilayaCode, settings);
    const total = subtotal + shipping;
    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;

    let lastError = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const ref = `CST-${ymd}-${Math.floor(1000 + Math.random() * 9000)}`;
      const row = {
        ref,
        product_id: product.id,
        product_name: product.name,
        product_image: product.images[0] || '',
        product_type: physical ? 'physical' : 'digital',
        unit_price: unitPrice,
        qty,
        subtotal,
        shipping,
        total,
        customer: {
          name,
          phone,
          wilayaCode,
          wilayaName: wilaya.name,
          commune: commune.name,
          communeCode: commune.code,
          address,
          notes
        },
        status: 'new'
      };
      const { error } = await sb.from('orders').insert(row);
      if (!error) return json({ ok: true, ref, total, shipping }, 201);
      lastError = error;
      if (error.code !== '23505') break;
    }
    console.error('[order]', lastError);
    return fail('تعذّر تسجيل الطلب، عاود المحاولة.', 500, 'insert_failed');
  }

  /* ---------------- admin ---------------- */

  async function requireSession() {
    const { data } = await sb.auth.getSession();
    return data && data.session ? data.session : null;
  }

  async function adminStats() {
    const [{ data: orders, error: e1 }, { data: products, error: e2 }] = await Promise.all([
      sb.from('orders').select('status,total,created_at'),
      sb.from('products').select('id,stock,active')
    ]);
    if (e1) throw e1;
    if (e2) throw e2;
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const counts = { new: 0, confirmed: 0, shipped: 0, delivered: 0, cancelled: 0 };
    let revenue = 0;
    let todayOrders = 0;
    let todayRevenue = 0;
    for (const o of orders || []) {
      if (counts[o.status] !== undefined) counts[o.status] += 1;
      if (o.status === 'delivered') revenue += Number(o.total) || 0;
      if (new Date(o.created_at) >= start) {
        todayOrders += 1;
        if (o.status !== 'cancelled') todayRevenue += Number(o.total) || 0;
      }
    }
    return {
      orders: (orders || []).length,
      todayOrders,
      todayRevenue,
      revenue,
      counts,
      products: (products || []).length,
      activeProducts: (products || []).filter((p) => p.active).length,
      lowStock: (products || []).filter((p) => p.active && Number(p.stock) <= 5).length
    };
  }

  function formProduct(fd, existing) {
    const get = (k) => (fd.get(k) === null ? '' : String(fd.get(k)));
    const name = get('name').trim() || (existing && existing.name) || '';
    let i18n = {};
    try {
      i18n = JSON.parse(get('i18n') || '{}');
    } catch (_) {
      i18n = {};
    }
    return {
      name,
      description: get('description').trim(),
      price: Math.max(0, parseInt(get('price'), 10) || 0),
      old_price: Math.max(0, parseInt(get('oldPrice'), 10) || 0),
      stock: Math.max(0, parseInt(get('stock'), 10) || 0),
      badge: get('badge').trim().slice(0, 40),
      type: get('type') === 'digital' ? 'digital' : 'physical',
      active: get('active') !== 'false',
      featured: get('featured') === 'true',
      sort: parseInt(get('sort'), 10) || 99,
      i18n
    };
  }

  async function productImages(fd, existing) {
    let kept = existing ? existing.images || [] : [];
    if (fd.get('images') !== null) {
      try {
        const parsed = JSON.parse(String(fd.get('images')));
        if (Array.isArray(parsed)) kept = parsed.filter((u) => typeof u === 'string').slice(0, 8);
      } catch (_) {
        /* keep existing */
      }
    }
    const files = fd.getAll('images').filter((v) => v instanceof File);
    const uploaded = [];
    for (const f of files) uploaded.push(await uploadFile(f));
    return [...kept, ...uploaded].slice(0, 8);
  }

  async function downloadCsv(status) {
    const { data, error } = await sb.from('orders').select('*').order('created_at', { ascending: false });
    if (error) return;
    const rows = (data || []).filter((o) => !status || status === 'all' || o.status === status);
    const labels = { new: 'جديد', confirmed: 'مؤكد', shipped: 'تم الإرسال', delivered: 'تم التسليم', cancelled: 'ملغى' };
    const head = ['المرجع', 'التاريخ', 'الاسم', 'الهاتف', 'الولاية', 'البلدية', 'العنوان', 'المنتج', 'النوع', 'الكمية', 'سعر الوحدة', 'التوصيل', 'الإجمالي', 'الحالة', 'ملاحظات'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const lines = [head.map(esc).join(',')];
    for (const o of rows) {
      const c = o.customer || {};
      lines.push(
        [
          o.ref,
          new Date(o.created_at).toLocaleString('fr-DZ'),
          c.name,
          `'${c.phone}`,
          c.wilayaName,
          c.commune,
          c.address,
          o.product_name,
          o.product_type === 'physical' ? 'مادي' : 'رقمي',
          o.qty,
          o.unit_price,
          o.shipping,
          o.total,
          labels[o.status] || o.status,
          c.notes || ''
        ]
          .map(esc)
          .join(',')
      );
    }
    const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
  }

  async function handle(url, init) {
    const u = new URL(url, location.origin);
    const path = u.pathname;
    const method = (init.method || 'GET').toUpperCase();
    const bodyRaw = init.body;
    const isForm = typeof FormData !== 'undefined' && bodyRaw instanceof FormData;
    let body = {};
    if (!isForm && typeof bodyRaw === 'string' && bodyRaw) {
      try {
        body = JSON.parse(bodyRaw);
      } catch (_) {
        body = {};
      }
    }

    try {
      if (path === '/api/public/health') return json({ ok: true });
      if (path === '/api/public/store' && method === 'GET') return json(await publicStore());
      if (path.startsWith('/api/public/communes/')) {
        const code = path.split('/').pop().padStart(2, '0');
        const w = GEO.wilayas.find((x) => x.code === code);
        if (!w) return json({ error: 'not_found' }, 404);
        return json({ wilaya: { code: w.code, name: w.name }, communes: GEO.communes[code] || [] });
      }
      if (path === '/api/public/orders' && method === 'POST') return createOrder(body);

      /* auth */
      if (path === '/api/admin/login' && method === 'POST') {
        if (!cfg.adminEmail) return fail('إعدادات الدخول ناقصة.', 500, 'config');
        const { error } = await sb.auth.signInWithPassword({ email: cfg.adminEmail, password: String(body.password || '') });
        if (error) return fail('كلمة السر غير صحيحة.', 401, 'invalid_credentials');
        return json({ ok: true });
      }
      if (path === '/api/admin/logout') {
        await sb.auth.signOut();
        return json({ ok: true });
      }
      if (path === '/api/admin/me') {
        const session = await requireSession();
        if (!session) return json({ authenticated: false }, 401);
        const settings = await getSettings();
        return json({ authenticated: true, store: settings.storeName || 'Castellum Shop' });
      }

      if (path.startsWith('/api/admin/')) {
        const session = await requireSession();
        if (!session) return json({ error: 'unauthorized' }, 401);
      }

      if (path === '/api/admin/stats') return json(await adminStats());

      if (path === '/api/admin/products' && method === 'GET') return json({ products: await getProducts(false) });
      if (path === '/api/admin/products' && method === 'POST') {
        const row = formProduct(bodyRaw);
        row.images = await productImages(bodyRaw, null);
        let slug = slugify(row.name);
        let inserted = null;
        for (let i = 0; i < 3 && !inserted; i++) {
          const { data, error } = await sb.from('products').insert({ ...row, slug }).select().single();
          if (!error) inserted = data;
          else if (error.code === '23505') slug = `${slugify(row.name)}-${Math.random().toString(36).slice(2, 5)}`;
          else throw error;
        }
        if (!inserted) throw new Error('insert_failed');
        return json({ product: productFromRow(inserted) }, 201);
      }

      const mProduct = path.match(/^\/api\/admin\/products\/([^/]+)$/);
      if (mProduct) {
        const id = mProduct[1];
        const { data: existingRow, error: exErr } = await sb.from('products').select('*').eq('id', id).single();
        if (exErr || !existingRow) return json({ error: 'not_found' }, 404);
        const existing = productFromRow(existingRow);
        if (method === 'PUT') {
          const row = formProduct(bodyRaw, existing);
          row.images = await productImages(bodyRaw, existing);
          const { data, error } = await sb.from('products').update(row).eq('id', id).select().single();
          if (error) throw error;
          return json({ product: productFromRow(data) });
        }
        if (method === 'DELETE') {
          const { error } = await sb.from('products').delete().eq('id', id);
          if (error) throw error;
          return json({ ok: true });
        }
      }

      if (path === '/api/admin/orders' && method === 'GET') {
        const status = u.searchParams.get('status') || 'all';
        const q = (u.searchParams.get('q') || '').toLowerCase();
        const page = Math.max(1, parseInt(u.searchParams.get('page'), 10) || 1);
        const limit = Math.min(100, Math.max(5, parseInt(u.searchParams.get('limit'), 10) || 20));
        const { data, error } = await sb.from('orders').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        let rows = data || [];
        if (['new', 'confirmed', 'shipped', 'delivered', 'cancelled'].includes(status)) rows = rows.filter((o) => o.status === status);
        if (q) {
          rows = rows.filter((o) => {
            const c = o.customer || {};
            return [o.ref, o.product_name, c.name, c.phone, c.wilayaName, c.commune].join(' ').toLowerCase().includes(q);
          });
        }
        const total = rows.length;
        const start = (page - 1) * limit;
        return json({
          total,
          page,
          pages: Math.max(1, Math.ceil(total / limit)),
          orders: rows.slice(start, start + limit).map(orderFromRow)
        });
      }

      const mOrder = path.match(/^\/api\/admin\/orders\/([^/]+)$/);
      if (mOrder && method === 'PATCH') {
        const status = String(body.status || '');
        if (!['new', 'confirmed', 'shipped', 'delivered', 'cancelled'].includes(status)) return fail('invalid_status', 400);
        const { data, error } = await sb.from('orders').update({ status }).eq('id', mOrder[1]).select().single();
        if (error) throw error;
        return json({ order: orderFromRow(data) });
      }
      if (mOrder && method === 'DELETE') {
        const { error } = await sb.from('orders').delete().eq('id', mOrder[1]);
        if (error) throw error;
        return json({ ok: true });
      }

      if (path === '/api/admin/settings' && method === 'GET') {
        return json({ settings: await getSettings(), wilayas: GEO.wilayas });
      }
      if (path === '/api/admin/settings' && method === 'PUT') {
        const current = await getSettings();
        const merged = { ...current, ...body };
        const { error } = await sb.from('settings').upsert({ id: 1, data: merged });
        if (error) throw error;
        return json({ settings: merged });
      }

      if (path === '/api/admin/password' && method === 'POST') {
        const current = String(body.current || '');
        const next = String(body.next || '');
        const { error: signErr } = await sb.auth.signInWithPassword({ email: cfg.adminEmail, password: current });
        if (signErr) return fail('كلمة السر الحالية غير صحيحة.', 400, 'wrong_password');
        if (next.length < 8) return fail('كلمة السر الجديدة لازم 8 أحرف على الأقل.', 400, 'weak_password');
        const { error } = await sb.auth.updateUser({ password: next });
        if (error) return fail(error.message, 400);
        await sb.auth.signOut();
        return json({ ok: true });
      }

      if (path === '/api/admin/upload' && method === 'POST') {
        const file = bodyRaw.get('images');
        const url = await uploadFile(file);
        return json({ images: [url] });
      }

      return json({ error: 'not_found' }, 404);
    } catch (err) {
      console.error('[api]', path, err);
      const msg = err && err.message === 'bad_type' ? 'نوع الصورة غير مدعوم.' : err && err.message === 'too_large' ? 'الصورة كبيرة (حد 6MB).' : 'وقع خطأ، عاود المحاولة.';
      return fail(msg, 500, 'server_error');
    }
  }

  const originalFetch = window.fetch.bind(window);
  window.fetch = function (input, init = {}) {
    const url = typeof input === 'string' ? input : input.url;
    if (url.startsWith('/api/')) return handle(url, init);
    return originalFetch(input, init);
  };

  document.addEventListener('DOMContentLoaded', () => {
    const a = document.getElementById('exportCsv');
    if (a) {
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const status = new URL(a.href, location.origin).searchParams.get('status') || 'all';
        downloadCsv(status);
      });
    }
  });
})();
