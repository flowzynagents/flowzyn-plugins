// Shared write actions for boards. Only what Claude's Jobber connector can do today:
// create a request, create a draft quote. Everything else is saved in the page's own data.
(function () {
  const ui = () => FZ.ui, fmt = () => FZ.fmt;
  const mcp = () => (window.claude && window.claude.use ? window.claude.use('mcp') : Promise.resolve(null));
  const dbP = () => (window.claude && window.claude.use ? window.claude.use('db') : Promise.resolve(null));

  // One Jobber write. No cache, no retry: a second create would make a second record.
  async function write(tool, input) {
    const m = await mcp();
    if (!m) throw new Error('Jobber is not reachable from this view. Open the page in Claude.');
    const res = await m.callTool('Jobber', tool, input);
    let p = res && res.payload;
    if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { /* text */ } }
    return p;
  }
  async function read(tool, input) { return write(tool, input); }

  async function getDoc(path) { try { const db = await dbP(); if (!db) return null; const s = await db.doc(path).get(); return s && s.exists ? s.data() : null; } catch (e) { return null; } }
  async function setDoc(path, data) { try { const db = await dbP(); if (!db) return false; await db.doc(path).set(data); return true; } catch (e) { return false; } }

  // Price book: the owner's formula. Rate per sq ft, install and hardware adders per enclosure, mirror rate.
  const BOOK0 = { showerRate: 38, install: 250, hardware: 900, mirrorRate: 42, approved: false };
  let BOOK = null;
  async function priceBook() { if (!BOOK) BOOK = Object.assign({}, BOOK0, (await getDoc('settings/pricebook')) || {}); return BOOK; }
  async function savePriceBook(patch) { const next = Object.assign({}, await priceBook(), patch, { updatedAt: new Date().toISOString() }); if (await setDoc('settings/pricebook', next)) { BOOK = next; return true; } return false; }

  // Sizes in inches, "60 x 80" or "60x80, 30 x 42". Returns [{w, h, sqft}].
  // Handles 60 x 80, 74x82", 24 3/4" x 87", 60,5" x 94".
  const toIn = (t) => { const m = String(t).replace(',', '.').match(/^(\d+(?:\.\d+)?)(?:\s+(\d{1,2})\/(\d{1,2}))?$/); return m ? Number(m[1]) + (m[2] ? Number(m[2]) / Number(m[3]) : 0) : NaN; };
  function parseSizes(text) {
    const re = /(\d{1,3}(?:[.,]\d+)?(?:\s+\d{1,2}\/\d{1,2})?)\s*(?:"|”|in(?:ch(?:es)?)?)?\s*(?:x|×|by)\s*(\d{1,3}(?:[.,]\d+)?(?:\s+\d{1,2}\/\d{1,2})?)/gi;
    const out = []; let m;
    while ((m = re.exec(String(text || '')))) { const w = toIn(m[1].trim()), h = toIn(m[2].trim()); if (w >= 6 && h >= 6) out.push({ w: Math.round(w * 100) / 100, h: Math.round(h * 100) / 100, sqft: Math.round(w * h / 144 * 10) / 10 }); }
    return out;
  }
  // Price each size from the book. kind: shower or mirror, guessed from the words.
  function priceLines(text, book) {
    const mirror = /mirror/i.test(text) && !/shower|door|enclosure|panel|tub/i.test(text);
    return parseSizes(text).map((s) => {
      if (mirror) {
        const price = Math.round(s.sqft * book.mirrorRate);
        return { name: 'Mirror ' + s.w + ' x ' + s.h, description: 'Measurements: ' + s.w + ' x ' + s.h + ' in. Mirror with polished edges, installed.', quantity: 1, unitPrice: price, math: s.sqft + ' sq ft × $' + book.mirrorRate };
      }
      const price = Math.round(s.sqft * book.showerRate + book.install + book.hardware);
      return { name: 'Shower glass ' + s.w + ' x ' + s.h, description: 'Measurements: ' + s.w + ' x ' + s.h + ' in, ' + s.sqft + ' sq ft. Glass, hardware and install.', quantity: 1, unitPrice: price, math: s.sqft + ' sq ft × $' + book.showerRate + ' + $' + book.install + ' install + $' + book.hardware + ' hardware' };
    });
  }

  // Tax: Jobber asks which rate to use before it creates a quote. Ask once, keep the answer.
  function taxPicker(rates, onPick) {
    const { h } = ui();
    const box = h('div', { class: 'sa-tax' }, h('p', { class: 'fz-hint' }, rates.length ? 'Which tax goes on this quote? Your choice is kept for the next ones.' : 'Your Jobber has no tax rates set up. Create the quote with no tax?'));
    rates.forEach((r) => box.append(h('button', { type: 'button', class: 'fz-btn sm', onclick: () => onPick({ taxRateId: r.id, label: (r.name || 'Tax') + (r.rate != null ? ' ' + r.rate + '%' : '') }) }, (r.name || 'Tax') + (r.rate != null ? ' ' + r.rate + '%' : (r.percentage != null ? ' ' + r.percentage + '%' : '')))));
    box.append(h('button', { type: 'button', class: 'fz-btn sm', onclick: () => onPick({ noTax: true, label: 'No tax' }) }, 'No tax'));
    return box;
  }

  // Create a draft quote in Jobber. The owner's press of the button is the confirmation Jobber asks for.
  // q: {clientId, propertyId, title, lineItems, requestId?}. ui: {msg, mount} to ask about tax when needed.
  async function createQuote(q, place) {
    const book = await priceBook();
    const base = { clientId: q.clientId, propertyId: q.propertyId, title: q.title, lineItems: q.lineItems.map((l) => ({ name: l.name, description: l.description || undefined, quantity: l.quantity || 1, unitPrice: Number(l.unitPrice) || 0, productOrServiceId: l.productOrServiceId || undefined })) };
    if (q.requestId) Object.assign(base, { requestId: q.requestId, requestConversionConfirmedByServiceProvider: true });
    const tax = book.tax;
    const withTax = (t) => Object.assign({}, base, t.taxRateId ? { taxRateId: t.taxRateId, taxRateConfirmedByServiceProvider: true } : { noTaxConfirmedByServiceProvider: true });
    if (tax) return write('create_quote', withTax(tax));
    const ask = await write('create_quote', base);
    if (ask && ask.quote) return ask;
    const rates = (ask && ask.taxRates) || [];
    return new Promise((resolve, reject) => {
      const picker = taxPicker(rates, async (t) => {
        picker.remove();
        try { await savePriceBook({ tax: t }); resolve(await write('create_quote', withTax(t))); } catch (e) { reject(e); }
      });
      (place || document.body).append(picker);
    });
  }

  // Find a client by name and list their properties.
  async function findClients(term) {
    const r = await read('search_clients', { query: term, limit: 8 });
    return ((r && (r.clients || r.nodes)) || []).map((c) => ({ id: c.id, name: fmt().clean((c.name || [c.firstName, c.lastName].filter(Boolean).join(' ') || 'Client') + (c.companyName && c.companyName !== c.name ? ', ' + c.companyName : '')) }));
  }
  async function propertiesOf(clientId) {
    const r = await read('search_properties', { clientId, limit: 10 }).catch(() => null);
    let list = (r && (r.properties || r.nodes)) || [];
    if (!list.length) { const c = await read('get_client', { clientId }).catch(() => null); const cl = c && (c.client || c); list = (cl && (cl.properties && (cl.properties.nodes || cl.properties))) || []; }
    return list.map((p) => { const a = p.address || p; return { id: p.id, label: fmt().clean([a.street1 || a.street || a.street2, a.city].filter(Boolean).join(', ')) || 'Property' }; });
  }

  // The property a quote was for: from its request, since a quote does not carry the property.
  async function propertyOfRequest(requestId) { const r = await read('get_request', { id: requestId }).catch(() => null); const q = r && (r.request || r); return q && q.property && q.property.id || null; }
  // Copy text to the clipboard with feedback on the button.
  function copyBtn(label, getText) {
    const { h } = ui();
    const b = h('button', { type: 'button', class: 'fz-btn sm' }, label);
    b.addEventListener('click', async () => { const t = typeof getText === 'function' ? getText() : getText; try { await navigator.clipboard.writeText(t); b.textContent = 'Copied'; } catch (e) { window.prompt('Copy this', t); } setTimeout(() => { b.textContent = label; }, 1800); });
    return b;
  }

  // A reminder the owner sets on a loose end. It shows in the Daily Brief on the day.
  async function reminders() { return ((await getDoc('tasks/reminders')) || {}).list || []; }
  async function remind(id, o) {
    const list = (await reminders()).filter((r) => r.id !== id);
    list.push({ id, title: o.title, detail: o.detail || '', link: o.link || null, dueAt: o.dueAt, createdAt: new Date().toISOString() });
    return setDoc('tasks/reminders', { list });
  }
  async function clearReminder(id) { return setDoc('tasks/reminders', { list: (await reminders()).filter((r) => r.id !== id) }); }

  const quoteLink = (r) => { const q = r && (r.quote || r); return q && (q.jobberWebUri || q.webUri) || null; };
  const requestLink = (r) => { const q = r && (r.request || r); return q && (q.jobberWebUri || q.webUri) || null; };


  // Ask Claude to read a photo: a drawing (sizes) or a supplier cost sheet (items and costs).
  const sampleP = () => (window.claude && window.claude.use ? window.claude.use('sample') : Promise.resolve(null));
  async function askJson(prompt, files) {
    const sample = await sampleP();
    if (!sample) throw new Error('Reading photos works when the page is open in Claude');
    const images = [...(files || [])].filter((f) => /^image\//.test(f.type));
    if (files && files.length && !images.length) throw new Error('Use a photo or screenshot. For a PDF, take a screenshot of each page');
    const res = await sample(prompt + '\nAnswer with JSON only, no other text.', { images, modelTier: 'default', cache: false });
    const t = String(res && res.text || '').replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
    const m = t.match(/[\[{][\s\S]*[\]}]/);
    return JSON.parse(m ? m[0] : t);
  }
  async function readDrawing(files, hint) {
    const v = await askJson('This is a photo of a glass shop measure drawing' + (hint ? ' for: ' + hint : '') + '. List every piece of glass or mirror with its width and height in inches. Return {"pieces":[{"what":"shower panel|door|mirror|other","w":number,"h":number,"note":"short"}]}. Use decimals for fractions. If a size is unreadable, leave that piece out.', files);
    return (v && v.pieces) || [];
  }
  async function readCostSheet(files, text) {
    const v = await askJson('This is a glass supplier\'s price or cost sheet' + (text ? ':\n' + text : '') + '. List each item a glass shop buys with its cost to the shop. Return {"supplier":"name or empty","items":[{"item":"short name, like 3/8 clear tempered","kind":"glass|mirror|hardware|other","unit":"sqft|each","cost":number}]}. Convert per square meter to per square foot. Leave out anything without a cost.', files);
    return { supplier: (v && v.supplier) || '', items: ((v && v.items) || []).filter((x) => x && x.item && Number(x.cost) > 0).map((x) => ({ item: String(x.item), kind: x.kind || 'other', unit: x.unit === 'each' ? 'each' : 'sqft', cost: Number(x.cost) })) };
  }
  // Supplier's project status sheet: each order with its delivery date (the owner, Nov 2026: he checks this sheet for when the glass lands).
  async function readStatusSheet(files, text) {
    const y = new Date().getFullYear();
    const v = await askJson('This is a glass supplier\'s project or order status sheet' + (text ? ':\n' + text : '') + '. Today is ' + new Date().toDateString() + '. List every order on it. Return {"orders":[{"customer":"job or customer name as written","ref":"PO, job or order number as written, or empty","status":"short status as written","delivery":"YYYY-MM-DD or empty"}]}. delivery is the ship, delivery or ready date. If the year is missing use ' + y + ', or ' + (y + 1) + ' when that month has already passed by more than two months. Leave delivery empty when no date is shown. Never guess a date.', files);
    return ((v && v.orders) || []).filter((o) => o && (o.customer || o.ref)).map((o) => ({ customer: String(o.customer || ''), ref: String(o.ref || ''), status: String(o.status || ''), delivery: /^\d{4}-\d{2}-\d{2}$/.test(o.delivery || '') ? o.delivery : '' }));
  }
  // Price sizes from supplier costs: (glass cost per sq ft x sq ft + hardware) x markup, + install.
  function supplierLines(text, book, glassItem, hwItem) {
    const S = book.supplier || {}; const mk = 1 + (Number(S.markup) || 0) / 100; const inst = Number(S.install) || 0;
    const mirror = /mirror/i.test(text) && !/shower|door|enclosure|panel|tub/i.test(text);
    const items = S.items || [];
    const g = items.find((x) => x.item === glassItem) || items.find((x) => x.kind === (mirror ? 'mirror' : 'glass'));
    const hw = mirror ? null : (items.find((x) => x.item === hwItem) || null);
    if (!g) return [];
    // Hardware once per enclosure: on the first piece, not on every panel.
    return parseSizes(text).map((z, i) => {
      const hwi = i === 0 ? hw : null;
      const cost = z.sqft * g.cost + (hwi ? hwi.cost : 0);
      const price = Math.round(cost * mk + inst);
      return { name: (mirror ? 'Mirror ' : 'Shower glass ') + z.w + ' x ' + z.h, description: 'Measurements: ' + z.w + ' x ' + z.h + ' in. ' + g.item + (hwi ? ', ' + hwi.item : '') + '. Installed.', quantity: 1, unitPrice: price,
        math: z.sqft + ' sq ft × $' + g.cost + (hwi ? ' + $' + hwi.cost + ' hardware' : '') + ' = $' + Math.round(cost).toLocaleString('en-US') + ' cost, +' + (S.markup || 0) + '% + $' + inst + ' install' };
    });
  }
  // Price from the method the owner switched on: supplier costs or the formula.
  function linesFor(text, book, glassItem, hwItem) {
    if (book.method === 'supplier' && book.supplier && (book.supplier.items || []).length) {
      const S = book.supplier.items; const hw = hwItem || ((S.find((x) => x.kind === 'hardware') || {}).item);
      const ls = supplierLines(text, book, glassItem, hw); if (ls.length) return ls;
    }
    return priceLines(text, book);
  }
  // A small "Read from a photo" button that fills a sizes box.
  function photoSizesBtn(input, hint, msg) {
    const { h } = ui();
    const file = h('input', { type: 'file', accept: 'image/*', capture: 'environment', hidden: true, multiple: true });
    const b = h('button', { type: 'button', class: 'fz-btn sm' }, 'Read sizes from a photo');
    b.addEventListener('click', () => file.click());
    file.addEventListener('change', async () => {
      if (!file.files.length) return;
      b.disabled = true; if (msg) msg.textContent = 'Reading the drawing…';
      try {
        const ps = await readDrawing(file.files, typeof hint === 'function' ? hint() : hint);
        if (!ps.length) { if (msg) msg.textContent = 'Could not read any sizes. Type them in.'; }
        else { input.value = ps.map((p) => p.w + ' x ' + p.h + (p.what && p.what !== 'other' ? ' ' + p.what : '')).join(', '); input.dispatchEvent(new Event('input')); if (msg) msg.textContent = 'Read ' + ps.length + ' size' + (ps.length > 1 ? 's' : '') + '. Check them against the drawing.'; }
      } catch (e) { if (msg) msg.textContent = (e && e.message || 'Could not read it') + '.'; }
      b.disabled = false; file.value = '';
    });
    return h('span', null, b, file);
  }
  FZ.act = { write, getDoc, setDoc, priceBook, savePriceBook, parseSizes, priceLines, createQuote, findClients, propertiesOf, copyBtn, propertyOfRequest, readDrawing, readCostSheet, readStatusSheet, supplierLines, linesFor, photoSizesBtn, remind, reminders, clearReminder, quoteLink, requestLink,
    createRequest: (o) => write('create_request', { clientId: o.clientId, propertyId: o.propertyId, title: o.title }) };
  const css = document.createElement('style');
  css.textContent = '.sa-form{display:grid;gap:10px;max-width:560px}.sa-form label{display:grid;gap:4px;font-size:13px;color:var(--muted)}.sa-form input,.sa-form textarea,.sa-form select{font:inherit;font-size:15px;padding:9px 11px;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--fg)}.sa-row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.sa-tax{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:8px}.sa-math{font-size:13px;color:var(--muted);margin:2px 0}.sa-inline{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-top:10px}.sa-inline input{font:inherit;font-size:14px;padding:7px 10px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--fg)}.sa-steps{display:flex;gap:6px;flex-wrap:wrap;margin:8px 0}.sa-steps span{font-size:12px;padding:4px 9px;border-radius:999px;border:1px solid var(--line);color:var(--muted)}.sa-steps span.on{border-color:var(--accent);color:var(--accent)}.sa-steps span.done{background:var(--accent);color:var(--on-accent,#111);border-color:var(--accent)}';
  document.head.append(css);
})();
