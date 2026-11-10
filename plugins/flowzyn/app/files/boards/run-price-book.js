// Set Prices: learns the shop's all in price per square foot from every past quote that recorded its sizes.
// Reads only. The owner approves the price book; Draft Quotes then prices from it.
FZ.board('price-book', {
  source: 'Past quotes and line items: Jobber, live.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const RULES = { lookbackDays: 365, maxQuotes: 60, driftPct: 15 };
    const SIZE = /(\d{2,3}(?:\.\d+)?)\s*(?:"|in|inch(?:es)?)?\s*[x×by]+\s*(\d{2,3}(?:\.\d+)?)/i;
    const recent = await ctx.jobberAll('search_quotes', { dateRange: { after: fmt.isoDaysAgo(RULES.lookbackDays) }, sort: 'createdAt', limit: 100 }, 'quotes', 300);
    const pool = recent.filter((q) => q.status !== 'draft').slice(0, RULES.maxQuotes);
    const details = (await ctx.pool(pool, 4, (q) => ctx.jobber('get_quote', { quoteId: q.id }))).map((d) => d && d.quote).filter(Boolean);
    const lines = [];
    let noSize = 0;
    details.forEach((d) => (d.lineItems || []).forEach((l) => {
      const price = (Number(l.unitPrice) || 0) * (Number(l.quantity) || 1);
      if (l.textOnly || price <= 0) return;
      const text = fmt.clean((l.name || '') + ' ' + (l.description || ''));
      const sz = FZ.act.parseSizes(text);
      if (!sz.length) { noSize++; return; }
      const sqft = Math.round(sz.reduce((n, z) => n + z.sqft, 0) * 10) / 10;
      const m = [null, sz[0].w, sz[0].h];
      if (sqft < 1) return;
      const kind = /mirror/i.test(text) ? 'Mirror' : /shower|door|enclosure|panel|tub/i.test(text) ? 'Shower' : 'Other glass';
      lines.push({ who: fmt.clean(d.client && d.client.name) || 'Customer', ref: '#' + d.quoteNumber, kind, size: sz.map((z) => z.w + ' × ' + z.h).join(', '), sqft, price, rate: Math.round(price / (Number(l.quantity) || 1) / sqft), won: ['approved', 'converted'].includes(d.status), link: d.jobberWebUri });
    }));
    const median = (xs) => { const s = xs.slice().sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
    const kinds = ['Shower', 'Mirror', 'Other glass'].map((k) => {
      const xs = lines.filter((x) => x.kind === k);
      return { k, n: xs.length, rate: median(xs.map((x) => x.rate)), won: xs.filter((x) => x.won).length };
    }).filter((x) => x.n);
    const book = Object.fromEntries(kinds.map((x) => [x.k, x.rate]));
    const drift = lines.filter((x) => book[x.kind] && Math.abs(x.rate - book[x.kind]) / book[x.kind] * 100 > RULES.driftPct).sort((a, b) => Math.abs(b.rate - book[b.kind]) - Math.abs(a.rate - book[a.kind]));

    ctx.metric('price-book', kinds.length
      ? { value: kinds.map((x) => x.k + ' ' + fmt.money(x.rate) + '/sq ft').join(' · '), detail: 'From ' + fmt.plural(lines.length, 'priced line') + ' with sizes' }
      : { value: 'No sizes found yet', detail: 'Write sizes like 60 x 80 on quote lines' });

    const out = [];
    out.push(ui.status(kinds.length
      ? ['Your all in price is about ', { b: kinds.map((x) => fmt.money(x.rate) + ' a sq ft for ' + x.k.toLowerCase()).join(', ') }, '.']
      : ['No past quote lines carry their sizes yet, so there is nothing to learn from.']));
    if (kinds.length) out.push(ui.section('Your price book', 'All in, per square foot, the middle of your past quotes', ui.table([
      { label: 'Work', get: (x) => x.k },
      { label: 'All in per sq ft', num: true, get: (x) => fmt.money(x.rate) },
      { label: 'Quotes it learned from', num: true, get: (x) => String(x.n) },
      { label: 'Won', num: true, get: (x) => String(x.won) }
    ], kinds, { open: true })));
    out.push(drift.length
      ? ui.cards(drift.map((x) => ({ when: x.kind + ' · ' + x.size + ' in', who: x.who + ' ' + x.ref, amount: x.price, flag: x.rate < book[x.kind], why: fmt.money(x.rate) + ' a sq ft against your usual ' + fmt.money(book[x.kind]) + '. ' + (x.rate < book[x.kind] ? 'Priced under your book.' : 'Priced over your book.'), actions: [x.link ? ui.extLink(x.link, 'Open in Jobber', 'fz-tlink') : null].filter(Boolean) })), { max: 5 })
      : ui.calm('Every quote with sizes is within ' + RULES.driftPct + '% of your price book.'));
    // The formula every new quote is priced from. The owner sets it and approves it.
    const A = FZ.act; const { h } = ui;
    const bk = await A.priceBook();
    const num = (v, label) => h('label', null, label, h('input', { type: 'number', min: '0', step: '1', value: String(v) }));
    const f = { showerRate: num(bk.showerRate, 'Shower glass, $ per sq ft'), install: num(bk.install, 'Install, $ per enclosure'), hardware: num(bk.hardware, 'Hardware, $ per enclosure'), mirrorRate: num(bk.mirrorRate, 'Mirror installed, $ per sq ft') };
    const val = (k) => Number(f[k].querySelector('input').value) || 0;
    const ex = h('p', { class: 'sa-math' });
    const paintEx = () => { const sq = 42.1; ex.textContent = 'A 74 x 82 panel is ' + sq + ' sq ft. ' + sq + ' × $' + val('showerRate') + ' + $' + val('install') + ' + $' + val('hardware') + ' = ' + fmt.money(Math.round(sq * val('showerRate') + val('install') + val('hardware'))) + '.'; };
    Object.values(f).forEach((l) => l.querySelector('input').addEventListener('input', paintEx)); paintEx();
    const saveMsg = h('p', { class: 'fz-hint', role: 'status' }, bk.approved ? 'Saved ' + fmt.fmtDate(bk.updatedAt) + '. Quotes use this formula unless you switch to supplier costs.' : 'Check the numbers and save. Quotes use this formula unless you switch to supplier costs.');
    const appr = h('button', { type: 'button', class: 'fz-btn act' }, bk.approved ? 'Save changes' : 'Save my formula');
    const useMed = book.Shower ? h('button', { type: 'button', class: 'fz-btn sm' }, 'Use my past quotes') : null;
    if (useMed) useMed.addEventListener('click', () => { f.mirrorRate.querySelector('input').value = String(book.Mirror || val('mirrorRate')); paintEx(); saveMsg.textContent = 'Mirror rate set from your past quotes. Shower rate stays as your formula, since past prices include install and hardware.'; });
    appr.addEventListener('click', async () => {
      appr.disabled = true;
      const ok = await A.savePriceBook({ showerRate: val('showerRate'), install: val('install'), hardware: val('hardware'), mirrorRate: val('mirrorRate'), approved: true });
      appr.disabled = false; appr.textContent = ok ? 'Save changes' : appr.textContent;
      saveMsg.textContent = ok ? 'Saved. Quotes use this formula unless you switch to supplier costs.' : 'Could not save. Try again.';
    });
    out.push(ui.section('Your formula', 'Square feet times your rate, plus install and hardware', h('div', { class: 'sa-form' }, f.showerRate, f.install, f.hardware, f.mirrorRate, ex, h('div', { class: 'sa-row' }, appr, useMed), saveMsg)));
    if (noSize) out.push(ui.note(fmt.plural(noSize, 'quote line') + ' had no sizes written on it, so it could not teach the price book. Ask the crew to type sizes like 60 x 80 into each line or the request.'));
    out.push(ui.how('Reads every sent quote from the last year and finds lines with sizes written on them, like 60 x 80.',
      'Works out the all in price per square foot for each line, then takes the middle value for showers, mirrors and other glass.',
      'Lines more than ' + RULES.driftPct + '% away from the book are shown so you can see where pricing drifted. Nothing is changed in Jobber.'));
    return out;
  }
});
