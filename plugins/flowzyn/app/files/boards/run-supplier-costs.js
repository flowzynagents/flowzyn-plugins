// Load Costs: the supplier's cost sheet, read once from a photo, then every quote is priced from
// what the glass and hardware really cost plus the shop's markup. The owner checks the costs before they are used.
FZ.board('supplier-costs', {
  source: 'Costs: your supplier sheet, read from a photo and checked by you. Saved in this page.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const { h } = ui;
    const A = FZ.act;
    const book = await A.priceBook();
    const S = Object.assign({ name: (FZ.profile().supplier || {}).name || 'your supplier', items: [], markup: 40, install: 250 }, book.supplier || {});
    let items = (S.items || []).map((x) => Object.assign({}, x));
    const live = book.method === 'supplier' && items.length;

    ctx.metric('supplier-costs', items.length
      ? { value: fmt.plural(items.length, 'cost') + ' from ' + S.name, detail: live ? 'Quotes priced from these' : 'Not in use yet' }
      : { value: 'No cost sheet yet', detail: 'Add a photo of it' });

    const msg = h('p', { class: 'fz-hint', role: 'status' });
    // Read the sheet.
    const file = h('input', { type: 'file', accept: 'image/*', multiple: true });
    const paste = h('textarea', { rows: '3', placeholder: 'Or paste the price list text here' });
    const readBtn = h('button', { type: 'button', class: 'fz-btn act' }, 'Read the cost sheet');
    readBtn.addEventListener('click', async () => {
      if (!file.files.length && !paste.value.trim()) { msg.textContent = 'Add a photo of the sheet or paste its text.'; return; }
      readBtn.disabled = true; msg.textContent = 'Reading the sheet. This takes a few seconds…';
      try {
        const r = await A.readCostSheet(file.files, paste.value.trim());
        if (!r.items.length) msg.textContent = 'No costs found. Try a clearer photo, or type them in below.';
        else { items = r.items; if (r.supplier) nameIn.value = r.supplier; paintRows(); msg.textContent = 'Read ' + fmt.plural(r.items.length, 'cost') + '. Check each one against the sheet, then save.'; }
      } catch (e) { msg.textContent = (e && e.message || 'Could not read it') + '.'; }
      readBtn.disabled = false;
    });

    // The cost table, editable.
    const body = h('tbody');
    const sel = (opts, v) => { const s = h('select', null, opts.map(([k, t]) => h('option', { value: k }, t))); s.value = v; return s; };
    const paintRows = () => {
      body.replaceChildren(...items.map((x, i) => {
        const nm = h('input', { type: 'text', value: x.item });
        const kd = sel([['glass', 'Shower glass'], ['mirror', 'Mirror'], ['hardware', 'Hardware'], ['other', 'Other']], x.kind);
        const un = sel([['sqft', 'per sq ft'], ['each', 'each']], x.unit);
        const co = h('input', { type: 'number', min: '0', step: '0.01', value: String(x.cost) });
        const del = h('button', { type: 'button', class: 'fz-btn sm' }, 'Remove');
        nm.addEventListener('input', () => { x.item = nm.value; });
        kd.addEventListener('change', () => { x.kind = kd.value; paintEx(); });
        un.addEventListener('change', () => { x.unit = un.value; });
        co.addEventListener('input', () => { x.cost = Number(co.value) || 0; paintEx(); });
        del.addEventListener('click', () => { items.splice(i, 1); paintRows(); });
        return h('tr', null, h('td', null, nm), h('td', null, kd), h('td', null, un), h('td', null, co), h('td', null, del));
      }));
      paintEx();
    };
    const add = h('button', { type: 'button', class: 'fz-btn sm' }, 'Add a line');
    add.addEventListener('click', () => { items.push({ item: '', kind: 'glass', unit: 'sqft', cost: 0 }); paintRows(); });
    const nameIn = h('input', { type: 'text', value: S.name });
    const mkIn = h('input', { type: 'number', min: '0', step: '1', value: String(S.markup) });
    const instIn = h('input', { type: 'number', min: '0', step: '1', value: String(S.install) });
    [mkIn, instIn].forEach((x) => x.addEventListener('input', () => paintEx()));

    // Check: the same 74 x 82 panel priced both ways.
    const ex = h('div', { class: 'sc-ex' });
    const paintEx = () => {
      const tmp = { supplier: { items, markup: Number(mkIn.value) || 0, install: Number(instIn.value) || 0 } };
      const hw = items.find((x) => x.kind === 'hardware');
      const sup = A.supplierLines('shower 74 x 82', tmp, null, hw && hw.item)[0];
      const own = A.priceLines('shower 74 x 82', book)[0];
      ex.replaceChildren(
        h('p', { class: 'ar-k' }, 'Check: one 74 x 82 shower panel'),
        sup ? h('p', null, 'From supplier costs: ', h('b', null, fmt.money(sup.unitPrice)), h('span', { class: 'sa-math' }, '  ' + sup.math)) : h('p', { class: 'fz-hint' }, 'Add a shower glass cost to see the price.'),
        own ? h('p', null, 'From your formula: ', h('b', null, fmt.money(own.unitPrice)), h('span', { class: 'sa-math' }, '  ' + own.math)) : null);
    };
    const save = h('button', { type: 'button', class: 'fz-btn act' }, live ? 'Save changes' : 'Price quotes from these costs');
    const saveMsg = h('p', { class: 'fz-hint', role: 'status' }, live ? 'In use. Draft Quotes and Capture Requests price from these costs.' : 'Not in use yet. Quotes use your formula until you save.');
    save.addEventListener('click', async () => {
      const clean = items.filter((x) => x.item.trim() && x.cost > 0);
      if (!clean.some((x) => x.kind === 'glass' || x.kind === 'mirror')) { saveMsg.textContent = 'Add at least one glass or mirror cost first.'; return; }
      save.disabled = true;
      const ok = await A.savePriceBook({ method: 'supplier', supplier: { name: nameIn.value.trim() || 'Supplier', items: clean, markup: Number(mkIn.value) || 0, install: Number(instIn.value) || 0, checkedAt: new Date().toISOString() } });
      save.disabled = false;
      if (ok) { save.textContent = 'Save changes'; saveMsg.textContent = 'In use. Every new quote is priced from these costs. You can switch back to your formula any time.'; } else saveMsg.textContent = 'Could not save. Try again.';
    });
    const back = live ? h('button', { type: 'button', class: 'fz-btn sm' }, 'Use my formula instead') : null;
    if (back) back.addEventListener('click', async () => { back.disabled = true; if (await A.savePriceBook({ method: 'formula' })) saveMsg.textContent = 'Back on your formula. Your costs are kept here.'; });
    paintRows();

    const out = [];
    out.push(ui.status(live
      ? ['Every quote is priced from ', { b: S.name + '’s costs' }, ' plus your ' + S.markup + '% markup.']
      : items.length ? ['Costs from ' + S.name + ' are loaded. ', { b: 'Check them and switch them on.' }]
        : ['Add a photo of ', { b: S.name + '’s cost sheet' }, ' and every quote is priced from what the glass really costs you.']));
    out.push(ui.section('1. Load the cost sheet', 'A photo or screenshot of each page. Claude reads the items and costs.', h('div', { class: 'sa-form' }, file, paste, h('div', { class: 'sa-row' }, readBtn), msg)));
    out.push(ui.section('2. Check the costs', 'Fix anything the photo got wrong. These are your costs, not what the customer sees.',
      h('div', { class: 'sc-wrap' }, h('table', { class: 'sc-t' }, h('thead', null, h('tr', null, h('th', null, 'Item'), h('th', null, 'Kind'), h('th', null, 'Unit'), h('th', null, 'Cost $'), h('th'))), body)), h('div', { class: 'sa-row' }, add)));
    out.push(ui.section('3. Your markup', 'Added on top of the supplier cost',
      h('div', { class: 'sa-form' }, h('label', null, 'Supplier', nameIn), h('label', null, 'Markup %', mkIn), h('label', null, 'Install, $ per piece', instIn), ex, h('div', { class: 'sa-row' }, save, back), saveMsg)));
    out.push(h('style', null, '.sc-wrap{overflow-x:auto}.sc-t{width:100%;border-collapse:collapse;font-size:14px}.sc-t th{text-align:left;font-size:12px;color:var(--muted);padding:6px}.sc-t td{padding:4px 6px}.sc-t input,.sc-t select{font:inherit;font-size:14px;padding:7px 9px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--fg);width:100%;min-width:70px}.sc-t td:first-child input{min-width:200px}.sc-ex{border:1px solid var(--line);border-radius:12px;padding:10px 14px}.sc-ex p{margin:4px 0}'));
    out.push(ui.note('A new cost sheet from the supplier? Load it again and the new costs replace the old ones after you check them. Supplier bills are on Pay Bills.'));
    out.push(ui.how('Claude reads the photo of your supplier’s sheet into a list of costs. You check every line before it is used.',
      'Each quote line is the glass cost per square foot times the size, plus the hardware, plus your markup and install.',
      'Draft Quotes and Capture Requests use it once you switch it on. You still check every quote and press send in Jobber.'));
    return out;
  }
});
