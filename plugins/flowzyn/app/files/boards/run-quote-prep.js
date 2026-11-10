// Quote Generator: every enquiry that has been measured, or asks for a quote, gets a quote drafted from the shop's
// own past quotes for similar jobs and its Jobber price list. The owner approves. Creating the draft quote is the only write.
FZ.board('quote-prep', {
  source: 'Enquiries, past quotes and price list: Jobber, live.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const { h } = ui;
    const RULES = { recentQuotes: 40, lookbackDays: 365, waitFlagDays: 2 };
    const WANTS_QUOTE = /quote|measure|mesure|estimate/i;
    const STOP = new Set(['quote', 'quotes', 'measure', 'mesure', 'request', 'for', 'the', 'and', 'with', 'new', 'from', 'estimate']);

    const [assessed, fresh, products, recent, allReq] = await Promise.all([
      ctx.jobberAll('search_requests', { status: 'assessment_completed', sort: 'oldestCreatedAt', limit: 50 }, 'requests', 150),
      ctx.jobberAll('search_requests', { status: 'new', sort: 'oldestCreatedAt', limit: 50 }, 'requests', 150),
      ctx.jobberAll('search_products_and_services', { limit: 50 }, 'productsAndServices', 300),
      ctx.jobberAll('search_quotes', { dateRange: { after: fmt.isoDaysAgo(RULES.lookbackDays) }, sort: 'createdAt', limit: 100 }, 'quotes', 300),
      ctx.jobberAll('search_requests', { dateRange: { after: fmt.isoDaysAgo(RULES.lookbackDays) }, limit: 50 }, 'requests', 500).catch(() => [])
    ]);
    const active = products.filter((p) => p.active !== false);
    const priceOf = (name) => { const p = active.find((x) => fmt.clean(x.name).toLowerCase() === String(name).toLowerCase()); return p ? Number(p.defaultPrice) || 0 : null; };

    // Past quotes the customer said yes to are the best model, then any sent quote.
    const pool = recent.filter((q) => q.status !== 'draft').sort((a, b) => (['approved', 'converted'].includes(b.status) - ['approved', 'converted'].includes(a.status)) || (new Date(b.createdAt) - new Date(a.createdAt))).slice(0, RULES.recentQuotes);
    const details = (await ctx.pool(pool, 4, (q) => ctx.jobber('get_quote', { quoteId: q.id }))).map((d) => d && d.quote).filter(Boolean);

    // Enquiries ready to quote.
    const seen = new Set();
    const rows = [];
    assessed.forEach((r) => { if (!seen.has(r.id)) { seen.add(r.id); rows.push({ r, why: 'Visited' }); } });
    fresh.filter((r) => WANTS_QUOTE.test(r.title || '')).forEach((r) => { if (!seen.has(r.id)) { seen.add(r.id); rows.push({ r, why: 'Asked for a quote' }); } });
    const words = (t) => String(t || '').toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 3 && !STOP.has(w)).map((w) => w.replace(/s$/, ''));
    rows.forEach((x) => {
      x.who = fmt.clean(x.r.client && x.r.client.name) || 'Customer';
      const first = x.who.split(' ')[0].toLowerCase();
      const parts = fmt.clean(x.r.title || '').replace(/^request for /i, '').split(/\s+-\s+/).map((t) => t.trim()).filter(Boolean);
      x.ask = (parts.find((t) => !t.toLowerCase().includes(first)) || 'Not stated').replace(/mesure/i, 'measure').replace(/^./, (c) => c.toUpperCase());
      x.days = fmt.daysSince(x.why === 'Visited' ? (x.r.updatedAt || x.r.createdAt) : x.r.createdAt) || 0;
      // Most similar past quote by shared words in the title; yes quotes win ties.
      const mine = words(x.r.title);
      let best = null, bestScore = 0;
      details.forEach((d) => {
        const lines = (d.lineItems || []).filter((l) => !l.textOnly && (Number(l.unitPrice) || 0) > 0);
        if (!lines.length) return;
        const theirs = words(d.title + ' ' + lines.map((l) => l.name).join(' '));
        const score = mine.filter((w) => theirs.some((t) => t.includes(w) || w.includes(t))).length + (['approved', 'converted'].includes(d.status) ? 0.5 : 0);
        if (score > bestScore) { bestScore = score; best = d; }
      });
      x.model = bestScore >= 1 ? best : null;
      x.lines = x.model ? (x.model.lineItems || []).filter((l) => !l.textOnly && (Number(l.unitPrice) || 0) > 0).map((l) => {
        const now = priceOf(l.name);
        const unit = now && now > 0 ? now : Number(l.unitPrice) || 0;
        const qty = Number(l.quantity) || 1;
        return { name: fmt.clean(l.name), desc: fmt.clean(l.description || ''), qty, unit, total: unit * qty, fromList: !!(now && now > 0) };
      }) : [];
      x.total = x.lines.reduce((n, l) => n + l.total, 0);
    });
    rows.sort((a, b) => b.days - a.days);
    // Biggest first, so the top 3 by dollars lead.
    const ready = rows.filter((x) => x.lines.length).sort((a, b) => b.total - a.total);
    const place = (x) => { const a = x.r.property && x.r.property.address; return a ? fmt.clean([a.street1, a.city].filter(Boolean).join(', ')) : ''; };
    const value = ready.reduce((n, x) => n + x.total, 0);

    ctx.metric('quote-prep', rows.length
      ? { value: fmt.plural(ready.length, 'quote') + ' drafted', detail: fmt.money(value, { short: true }) + ' ready to approve' }
      : { value: 'Nothing waiting to quote', detail: '' });

    const done = (FZ.tasksNow && FZ.tasksNow().done) || {};
    // Already dealt with another way: take it off the list.
    const handled = (id, ok) => { const b = h('button', { type: 'button', class: 'fz-btn sm' }, 'Already handled'); b.addEventListener('click', async () => { b.disabled = true; if (await FZ.saveTask(id, true)) { b.textContent = 'Marked as handled'; ok.disabled = true; b.closest('.fz-card').classList.add('is-handled'); } else b.disabled = false; }); return b; };
    const A = FZ.act;
    const book = A ? await A.priceBook() : null;
    // One card per enquiry: the drafted lines, an Add sizes box that prices from the price book, and a real
    // Create draft quote button. Creating the quote also converts the request in Jobber.
    const card = (x) => {
      const id = 'qg-' + x.r.id;
      const was = done[id] && done[id].done;
      let lines = x.lines.slice();
      const ok = h('button', { type: 'button', class: 'fz-btn act' }, was ? 'Draft quote in Jobber' : 'Create draft quote in Jobber');
      if (was) ok.disabled = true;
      const msg = h('p', { class: 'fz-hint', role: 'status' });
      const amt = h('span', { class: 'amt' }, fmt.money(x.total));
      const body = h('tbody');
      const foot = h('td', { class: 'num' });
      const paint = () => {
        const tot = lines.reduce((n, l) => n + (l.total != null ? l.total : l.unitPrice * (l.quantity || 1)), 0);
        body.replaceChildren(...lines.map((l) => h('tr', null, h('td', null, h('b', null, l.name), l.desc || l.math ? h('span', { class: 'd' }, l.math || l.desc) : null), h('td', { class: 'num' }, String(l.qty || l.quantity || 1)), h('td', { class: 'num' }, fmt.money(l.unit != null ? l.unit : l.unitPrice)), h('td', { class: 'num' }, fmt.money(l.total != null ? l.total : l.unitPrice * (l.quantity || 1))))));
        foot.textContent = fmt.money(tot); amt.textContent = lines.length ? fmt.money(tot) : 'Needs sizes';
        if (!was) ok.disabled = !lines.length;
      };
      const sizes = h('input', { type: 'text', placeholder: 'Sizes, like 60 x 80', 'aria-label': 'Sizes in inches' });
      const sup = book.method === 'supplier' && book.supplier && (book.supplier.items || []).length ? book.supplier.items : null;
      const gSel = sup ? h('select', { 'aria-label': 'Glass' }, sup.filter((i) => i.kind === 'glass' || i.kind === 'mirror').map((i) => h('option', { value: i.item }, i.item))) : null;
      const hSel = sup ? h('select', { 'aria-label': 'Hardware' }, [h('option', { value: '' }, 'No hardware')].concat(sup.filter((i) => i.kind === 'hardware').map((i) => h('option', { value: i.item }, i.item)))) : null;
      if (hSel && hSel.options.length > 1) hSel.selectedIndex = 1;
      const useSizes = h('button', { type: 'button', class: 'fz-btn sm' }, sup ? 'Price from supplier costs' : 'Price from my formula');
      useSizes.addEventListener('click', () => {
        const ls = A.linesFor(x.ask + ' ' + sizes.value, book, gSel && gSel.value, hSel && hSel.value);
        if (!ls.length) { msg.textContent = 'Type sizes in inches, like 60 x 80.'; return; }
        lines = ls.map((l) => Object.assign({}, l, { qty: 1, unit: l.unitPrice, total: l.unitPrice })); msg.textContent = ''; paint();
      });
      ok.addEventListener('click', async () => {
        ok.disabled = true; msg.textContent = 'Creating the draft quote in Jobber…';
        try {
          const q = await A.createQuote({ clientId: x.r.client && x.r.client.id, propertyId: x.r.property && x.r.property.id, requestId: x.r.id, title: (/^(measure|not stated)$/i.test(x.ask) ? lines.map((l) => l.name).join(', ') : x.ask) + (place(x) ? ', ' + place(x) : ''),
            lineItems: lines.map((l) => ({ name: l.name, description: l.description || l.desc || undefined, quantity: l.qty || l.quantity || 1, unitPrice: l.unit != null ? l.unit : l.unitPrice })) }, msg.parentNode);
          await FZ.saveTask(id, true);
          const link = A.quoteLink(q);
          ok.textContent = 'Draft quote in Jobber';
          msg.replaceChildren('Done. It is a draft quote in Jobber and the request is converted. Check it and press send in Jobber. ', link ? ui.extLink(link, 'Open the quote', 'fz-tlink') : '');
        } catch (e) { ok.disabled = false; msg.textContent = 'Jobber did not take it: ' + (e && e.message || 'try again') + '.'; }
      });
      const el = h('article', { class: 'fz-card' + (x.days > RULES.waitFlagDays ? ' flag' : ''), 'data-qg': x.r.id },
        h('div', { class: 'fz-card-top' }, h('span', { class: 'when' }, x.why + ' · ' + (x.days ? fmt.plural(x.days, 'day') + ' ago' : 'today')), amt),
        h('span', { class: 'who' }, x.who),
        h('span', { class: 'why' }, x.ask + (place(x) ? ', ' + place(x) : '') + '. ' + (x.model ? 'Based on quote #' + x.model.quoteNumber + (x.model.client && x.model.client.name ? ' for ' + fmt.clean(x.model.client.name) : '') + ', a similar job. Or type the sizes to price it fresh.' : 'The measure is done but the sizes are not in Jobber. Type them here to price it.')),
        h('table', { class: 'qg-lines' },
          h('thead', null, h('tr', null, h('th', null, 'Item'), h('th', { class: 'num' }, 'Qty'), h('th', { class: 'num' }, 'Price'), h('th', { class: 'num' }, 'Total'))),
          body, h('tfoot', null, h('tr', null, h('td', { colspan: '3' }, 'Total before tax'), foot))),
        h('div', { class: 'sa-inline' }, sizes, A.photoSizesBtn(sizes, x.ask, msg), gSel, hSel, useSizes),
        h('div', { class: 'fz-card-btns' }, ok, FZ.opButton({ id: id, title: 'Quote for ' + x.who, meta: x.ask + (place(x) ? ', ' + place(x) : ''), link: x.r.jobberWebUri, agent: 'quote-prep' }), handled(id, ok), x.r.jobberWebUri ? ui.extLink(x.r.jobberWebUri, 'Open in Jobber', 'fz-btn sm') : null), msg);
      paint();
      return el;
    };
    const K = FZ.kit;
    const out = [];
    const short = (n) => fmt.money(n, { short: true });
    const run = FZ.runs && FZ.runs['quote-prep'];
    const ranAt = run && run.last && fmt.dayKey(run.last) === fmt.dayKey(new Date().toISOString()) && !/error/i.test(run.lastStatus || '') ? fmt.fmtTime(run.last) : null;
    const goWork = (id) => () => { const tab = document.querySelector('#fz-board .fz-subtabs [data-id="work"]'); if (tab) tab.click(); setTimeout(() => { const el = document.querySelector('#fz-board [data-qg="' + id + '"]'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); };
    const btn = (label, fn) => h('button', { type: 'button', class: 'fz-btn act qp-go', onclick: fn }, label);
    const CSS = h('style', null, '.fz-btn.qp-go{background:var(--accent)!important;color:var(--on-accent,#111)!important}.fz-status.qp-good b{color:var(--ok-fg,#22c55e)}.qp-gap{margin:14px 0 0;padding-left:12px;border-left:2px solid var(--accent);font-size:13px;color:var(--fg)}' + QP_TL_CSS);
    const tl = (steps) => h('ol', { class: 'qp-tl' }, steps.map((s, i) => h('li', { class: i === steps.length - 1 ? 'hi' : null }, h('span', { class: 'qp-tl-t' }, s[0]), h('b', null, s[1]), h('span', null, s[2]))));

    // The latest real quote: from the enquiry to sent (and the yes, if it came).
    const sentQ = recent.filter((q) => q.sentAt && q.status !== 'draft').sort((a, b) => new Date(b.sentAt) - new Date(a.sentAt))[0];
    let latest = null;
    if (sentQ) {
      const req = allReq.filter((r) => r.client && sentQ.client && r.client.id === sentQ.client.id && r.createdAt <= sentQ.createdAt && (new Date(sentQ.createdAt) - new Date(r.createdAt)) < 60 * 86400000).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
      const when = (iso) => fmt.fmtDate(iso) + ', ' + fmt.fmtTime(iso);
      const gap = (a, b) => { const hrs = Math.max(0, (new Date(b) - new Date(a)) / 3600000); return fmt.dayKey(a) === fmt.dayKey(b) ? 'the same day' : hrs < 48 ? 'the next day' : fmt.plural(Math.round(hrs / 24), 'day') + ' later'; };
      const steps = [];
      if (req) steps.push([when(req.createdAt), 'Enquiry in', fmt.clean(String(req.title || '').split(' - ')[0]) || 'New request']);
      steps.push([when(sentQ.createdAt), 'Quote drafted', 'Quote #' + sentQ.quoteNumber + ', ' + short(Number(sentQ.total) || 0)]);
      steps.push([when(sentQ.sentAt), 'Quote sent', 'To ' + (fmt.clean(sentQ.client && sentQ.client.name) || 'the customer')]);
      if (sentQ.approvedAt && ['approved', 'converted'].includes(sentQ.status)) steps.push([when(sentQ.approvedAt), 'Customer said yes', short(Number(sentQ.total) || 0) + ' won']);
      const from = req ? req.createdAt : sentQ.createdAt;
      latest = { el: tl(steps), title: ['Your latest quote went out ', { b: gap(from, sentQ.sentAt) }], sub: req ? 'From the enquiry to the quote sent, quote #' + sentQ.quoteNumber + '.' : 'From drafted to sent, quote #' + sentQ.quoteNumber + '. No matching enquiry in Jobber.' };
    }

    const measured = rows.filter((x) => !x.lines.length && x.why === 'Visited');
    if (!ready.length && !measured.length) {
      out.push(ui.status(rows.length
        ? ['Your agent drafts a quote as soon as the site visit notes are in Jobber. ', { b: fmt.plural(rows.length, 'enquiry', 'enquiries') }, rows.length === 1 ? ' is' : ' are', ' waiting on a visit.']
        : ['Your agent drafts each quote the same day as the site visit. ', { b: 'Nothing waiting to quote.' }]));
      if (!rows.length) out[out.length - 1].classList.add('qp-good');
      out.push(K.how(h, 'It drafts each quote from your past quotes for similar jobs and your Jobber price list, so it goes out the same day as the site visit.'));
      const STEPS = [['9:00', 'Site visit', 'Measured at Example Lane'], ['11:40', 'Quote drafted', 'From a similar past job'], ['1:15', 'You approve', 'One tap'], ['1:20', 'Quote sent', 'From Jobber, same day']];
      out.push(K.quiet(h,
        K.checked(h, 'Jobber checked for work to quote', [
          rows.length ? fmt.plural(rows.length, 'enquiry', 'enquiries') + ' waiting on a site visit' : 'No enquiry waiting to be quoted',
          active.length ? fmt.plural(active.length, 'item') + ' in your price list' : null,
          details.length ? fmt.plural(details.length, 'past quote') + ' read to draft from' : null
        ]),
        latest ? h('div', null, h('p', { class: 'ag-eyebrow', style: 'color:var(--muted)' }, 'Your latest quote'), h('h3', { class: 'ag-title' }, latest.title[0], h('b', null, latest.title[1].b)), h('p', { class: 'ag-sub' }, latest.sub), latest.el)
          : K.example(h, 'Every quote out the same day as the visit', tl(STEPS))));
      // Example top 3, only while there is nothing real to show.
      out.push(CSS);
    } else {
      out.push(ui.status([{ b: fmt.plural(ready.length, 'quote') }, ' drafted for you, worth ', { b: short(value) }, '. ', measured.length ? fmt.plural(measured.length, 'measured job') + ' needs the sizes typed in. ' : '', 'Create each one as a draft quote in Jobber.']));
      out.push(K.how(h, 'It drafts each quote from your past quotes for similar jobs and your Jobber price list, so it goes out the same day as the site visit.'));
      out.push(K.hero(h, {
        eyebrow: 'Your latest quote',
        title: latest ? latest.title : [fmt.plural(ready.length, 'quote') + ' drafted ', { b: 'today' }],
        sub: latest ? latest.sub : null,
        viz: latest ? latest.el : null,
        did: [
          { t: 'Read ' + fmt.plural(details.length, 'past quote') + ' and your price list', s: ranAt || 'Live from Jobber' },
          { t: 'Drafted ' + fmt.plural(ready.length, 'quote') + ' from similar past jobs', s: short(value) + ' in total' },
          rows.length > ready.length ? { t: fmt.plural(rows.length - ready.length, 'enquiry', 'enquiries') + ' waiting on a site visit' } : null,
          { t: 'Next: you create each draft quote in Jobber with one press', done: false }
        ].filter(Boolean)
      }));
      const picks = (ready.length ? ready : measured).slice(0, 3);
      const restRows = rows.filter((x) => !picks.includes(x));
      out.push(K.needs(h, {
        title: picks.length ? fmt.plural(picks.length, 'quote') + ' ready to check, biggest first' : 'Measured, waiting on sizes',
        items: picks.map((x) => ({
          meta: [{ b: x.lines.length ? short(x.total) : 'Needs sizes' }, ' · ' + x.why + ' ' + (x.days ? fmt.plural(x.days, 'day') + ' ago' : 'today')],
          title: x.who,
          detail: x.ask + (place(x) ? ', ' + place(x) : '') + (x.model ? '. Drafted from quote #' + x.model.quoteNumber + ', a similar job.' : '. Measured. Type the sizes to price it.'),
          actions: [btn('Review quote', goWork(x.r.id)), x.r.jobberWebUri ? ui.extLink(x.r.jobberWebUri, 'Open in Jobber', 'fz-tlink') : null].filter(Boolean)
        })),
        rest: { count: restRows.length, label: 'drafted or waiting on a site visit', list: ui.table([
          { label: 'Customer', get: (x) => x.r.jobberWebUri ? ui.extLink(x.r.jobberWebUri, x.who, 'fz-tlink') : x.who },
          { label: 'Asking about', get: (x) => x.ask },
          { label: 'Where it is', get: (x) => x.lines.length ? 'Drafted, ' + fmt.money(x.total) : 'Needs a site visit' },
          { label: 'Waiting', num: true, get: (x) => fmt.plural(x.days, 'day') }
        ], restRows, { open: true }) }
      }));
      out.push(CSS);
      out.push(ui.section(fmt.plural(ready.length + measured.length, 'job') + ' to quote', 'Check the items and prices, or type the sizes. Create it and it is a draft quote in Jobber for you to send.',
        h('div', { class: 'fz-cards' }, [...ready, ...measured].map(card)),
        h('style', null, '.qg-lines{width:100%;table-layout:fixed;border-collapse:collapse;margin:12px 0 4px;font-size:14px;font-variant-numeric:tabular-nums}.qg-lines th{text-align:left;font-size:12px;color:var(--muted);font-weight:600;padding:6px 8px;border-bottom:1px solid var(--line)}.qg-lines td{padding:8px;border-bottom:1px solid var(--line);vertical-align:top}.qg-lines .num{text-align:right;white-space:nowrap;width:90px}.qg-lines td:first-child{overflow-wrap:anywhere}.qg-lines .d{display:block;color:var(--muted);font-size:12px}.qg-lines tfoot td{font-weight:800;border-bottom:0}@media(max-width:620px){.qg-lines{font-size:13px}.qg-lines .num{width:62px}.qg-lines th:nth-child(2),.qg-lines td:nth-child(2){width:34px}.qg-lines td,.qg-lines th{padding:6px 4px}}')));
    }
    out.push(ui.how('Ready to quote means a Jobber request with its site visit done, or a new request that asks for a quote or a measure.',
      'Each quote copies the items and quantities from your most similar past quote, preferring ones the customer said yes to. Prices come from your Jobber price list, or the past quote when an item has no list price.',
      'Create draft quote puts it into Jobber as a draft and converts the request. You still press send in Jobber. Nothing reaches the customer without you.'));
    return out;
  }
});
const QP_TL_CSS = '.qp-ex{border:1px dashed var(--line);border-radius:14px;padding:18px 20px;color:var(--muted)}.qp-ex-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.qp-ex .fz-h2{margin:0;color:var(--muted)}.qp-ex-tag{font:700 11px/1 var(--font);letter-spacing:.06em;text-transform:uppercase;border:1px solid var(--line);border-radius:999px;padding:5px 9px;color:var(--muted)}.qp-tl{list-style:none;margin:16px 0 6px;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));position:relative}.qp-tl:before{content:"";position:absolute;left:6px;right:calc(25% - 8px);top:6px;height:2px;background:var(--line)}.qp-tl li{position:relative;padding:22px 10px 0 0;display:flex;flex-direction:column;gap:2px}.qp-tl li:before{content:"";position:absolute;left:0;top:0;width:14px;height:14px;border-radius:50%;background:var(--card);border:2px solid var(--muted);box-sizing:border-box}.qp-tl li.hi:before{border-color:var(--accent);background:var(--accent)}.qp-tl-t{font-size:12px;font-weight:700}.qp-tl b{color:var(--meta,var(--fg));font-size:14px}.qp-tl li span{font-size:13px}.qp-tl li.hi b{color:var(--accent)}.qp-ex-k{margin:16px 0 6px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em}.qp-top{display:flex;flex-direction:column;gap:6px}.qp-top-r{display:grid;grid-template-columns:80px minmax(0,1fr);gap:12px;font-size:14px;align-items:baseline}.qp-top-r b{color:var(--meta,var(--fg));text-align:right;font-variant-numeric:tabular-nums}@media(max-width:620px){.qp-ex{padding:14px}.qp-tl{grid-template-columns:1fr;gap:14px;padding-left:4px}.qp-tl:before{left:10px;right:auto;top:6px;bottom:6px;width:2px;height:auto}.qp-tl li{padding:0 0 0 28px}.qp-tl li:before{left:4px}}';
