// Add On Finder: learns which quote lines usually go together, then spots open quotes missing the usual partner.
FZ.board('add-on-finder', {
  source: 'Quotes and line items: Jobber, live.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const LEARN = 25, MIN_SEEN = 3, MIN_SHARE = 0.6, EXTRA = 10;
    const key = (s) => fmt.clean(s).toLowerCase();
    const recent = (await ctx.jobberAll('search_quotes', { dateRange: { after: fmt.isoDaysAgo(365) }, sort: 'createdAt', limit: 100 }, 'quotes', 200))
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    const learnFrom = recent.slice(0, LEARN);
    const [awaiting, drafts] = await Promise.all([
      ctx.jobberAll('search_quotes', { status: 'awaiting_response', limit: 50 }, 'quotes', 50),
      ctx.jobberAll('search_quotes', { status: 'draft', limit: 50 }, 'quotes', 50)
    ]);
    const openList = [...awaiting, ...drafts];
    const learnIds = new Set(learnFrom.map((q) => q.id));
    const extra = openList.filter((q) => !learnIds.has(q.id)).slice(0, EXTRA);
    const toRead = [...learnFrom, ...extra];
    const det = await ctx.pool(toRead, 4, (q) => ctx.jobber('get_quote', { quoteId: q.id }));
    const lines = {};
    toRead.forEach((q, i) => {
      const d = det[i] && det[i].quote;
      lines[q.id] = d ? (d.lineItems || []).filter((li) => !li.textOnly && fmt.clean(li.name)) : null;
    });

    // Count items and pairs across the learning quotes.
    const names = {}, seen = {}, pair = {}, dollars = {};
    learnFrom.forEach((q) => {
      const ls = lines[q.id];
      if (!ls) return;
      const ks = [...new Set(ls.map((li) => key(li.name)))];
      ls.forEach((li) => { const k = key(li.name); names[k] = names[k] || fmt.clean(li.name); (dollars[k] = dollars[k] || []).push(Number(li.totalPrice) || 0); });
      ks.forEach((a) => { seen[a] = (seen[a] || 0) + 1; ks.forEach((b) => { if (a !== b) pair[a + '|' + b] = (pair[a + '|' + b] || 0) + 1; }); });
    });
    const median = (arr) => { const s = arr.slice().sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };
    const rules = Object.entries(pair).map(([k, n]) => { const [a, b] = k.split('|'); return { a, b, n, share: n / seen[a], adds: median(dollars[b] || []) }; })
      .filter((r) => seen[r.a] >= MIN_SEEN && r.share >= MIN_SHARE)
      .sort((x, y) => y.share - x.share || y.n - x.n);

    // Open quotes that have the first item but not its usual partner.
    const finds = [];
    openList.forEach((q) => {
      const ls = lines[q.id];
      if (!ls) return;
      const ks = new Set(ls.map((li) => key(li.name)));
      rules.forEach((r) => { if (ks.has(r.a) && !ks.has(r.b) && !finds.some((f) => f.q.id === q.id && f.r.b === r.b)) finds.push({ q, r }); });
    });
    finds.sort((x, y) => y.r.adds - x.r.adds);
    const quotesWith = new Set(finds.map((f) => f.q.id)).size;
    const addsSum = finds.reduce((s, f) => s + f.r.adds, 0);

    ctx.metric('add-on-finder', quotesWith
      ? { value: fmt.plural(quotesWith, 'quote') + ' may need an add on', detail: 'About ' + fmt.money(addsSum, { short: true }) + ' in usual add ons' }
      : { value: 'Open quotes look complete', detail: fmt.plural(rules.length, 'usual pairing') + ' learned' });

    const out = [];
    out.push(ui.status(quotesWith
      ? [{ b: String(quotesWith) }, ' open ' + (quotesWith === 1 ? 'quote' : 'quotes') + ' may be missing a usual add on.']
      : ['Open quotes have their usual add ons.']));
    out.push(finds.length ? ui.cards(finds.map((f) => ({
      when: 'Quote ' + f.q.quoteNumber + ' · ' + (f.q.status === 'draft' ? 'Draft' : 'Waiting on customer'),
      who: fmt.clean(f.q.client && f.q.client.name), amount: '+' + fmt.money(f.r.adds),
      why: 'Has ' + names[f.r.a] + ' but no ' + names[f.r.b] + '. They go together on ' + Math.round(f.r.share * 100) + '% of recent quotes.',
      link: f.q.jobberWebUri, linkLabel: 'Open quote in Jobber'
    })), { max: 4 }) : ui.calm(rules.length ? 'Every open quote already has its usual add ons. Nice.' : 'Not enough recent quotes yet to learn which lines go together.'));

    const shown = rules.filter((r, i) => !rules.slice(0, i).some((x) => x.a === r.b && x.b === r.a));
    if (shown.length) out.push(ui.section('Lines that usually go together', 'How often the second line comes with the first, last ' + learnFrom.length + ' quotes',
      ui.bars(shown.map((r) => ({ label: names[r.a] + ' + ' + names[r.b], value: Math.round(r.share * 100), display: Math.round(r.share * 100) + '%' })), { max: 6 })));

    if (finds.length) out.push(ui.table([
      { label: 'Quote', get: (f) => f.q.jobberWebUri ? ui.extLink(f.q.jobberWebUri, '#' + f.q.quoteNumber) : '#' + f.q.quoteNumber },
      { label: 'Customer', get: (f) => fmt.clean(f.q.client && f.q.client.name) },
      { label: 'Has', get: (f) => names[f.r.a] },
      { label: 'Usually adds', get: (f) => names[f.r.b] },
      { label: 'Usual dollars', num: true, get: (f) => fmt.money(f.r.adds) }
    ], finds, { summary: 'All ' + finds.length + ' possible add ons as a list' }));
    out.push(ui.how('Reads the line items on the last ' + learnFrom.length + ' quotes in Jobber.',
      'Two lines count as a usual pair when the first shows up on at least ' + MIN_SEEN + ' quotes and the second is with it at least ' + Math.round(MIN_SHARE * 100) + '% of the time.',
      'Open quotes waiting on the customer or still in draft are checked for the missing partner. The dollars are what that line usually comes to.'));
    return out;
  }
});
