// Shop Handbook: search how the shop priced and described past work, from the price list and recent quotes.
FZ.board('shop-handbook', {
  source: 'Price list and quote line items: Jobber, live.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const { h } = ui;
    const QUOTES = 25;
    const STOP = new Set('a an and the of for to in on with how did do does we our you your what price priced pricing describe described charge charged is was it this that show me past usually'.split(' '));
    const [products, recent] = await Promise.all([
      ctx.jobberAll('search_products_and_services', { limit: 50 }, 'productsAndServices', 300),
      ctx.jobberAll('search_quotes', { dateRange: { after: fmt.isoDaysAgo(365) }, sort: 'createdAt', limit: 100 }, 'quotes', 200)
    ]);
    const quotes = recent.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, QUOTES);
    const det = await ctx.pool(quotes, 4, (q) => ctx.jobber('get_quote', { quoteId: q.id }));

    // One entry per item name, gathering its prices, descriptions and the quotes it came from.
    const groups = new Map();
    const group = (name) => { const k = fmt.clean(name).toLowerCase(); if (!groups.has(k)) groups.set(k, { name: fmt.clean(name), prices: [], descs: new Map(), quotes: [], list: null }); return groups.get(k); };
    products.filter((p) => p.active !== false && fmt.clean(p.name)).forEach((p) => {
      const g = group(p.name); g.list = Number(p.defaultPrice) || 0; g.cat = p.category;
      if (fmt.clean(p.description)) g.descs.set(fmt.clean(p.description), (g.descs.get(fmt.clean(p.description)) || 0));
    });
    quotes.forEach((q, i) => {
      const d = det[i] && det[i].quote;
      ((d && d.lineItems) || []).filter((li) => !li.textOnly && fmt.clean(li.name)).forEach((li) => {
        const g = group(li.name);
        const unit = Number(li.unitPrice) || 0;
        if (unit > 0) g.prices.push(unit);
        const ds = fmt.clean(li.description);
        if (ds) g.descs.set(ds, (g.descs.get(ds) || 0) + 1);
        if (!g.quotes.some((x) => x.id === q.id)) g.quotes.push({ id: q.id, num: q.quoteNumber, at: q.createdAt, who: fmt.clean(q.client && q.client.name), link: q.jobberWebUri, status: q.status });
      });
    });
    const all = [...groups.values()];
    all.forEach((g) => { g.text = (g.name + ' ' + [...g.descs.keys()].join(' ')).toLowerCase(); });
    const byUse = all.slice().sort((a, b) => b.quotes.length - a.quotes.length || a.name.localeCompare(b.name));

    ctx.metric('shop-handbook', { value: fmt.plural(all.length, 'item') + ' to look up', detail: 'From the price list and the last ' + quotes.length + ' quotes' });

    const range = (g) => {
      if (!g.prices.length) return g.list != null ? fmt.money(g.list) : '';
      const lo = Math.min(...g.prices), hi = Math.max(...g.prices);
      return Math.round(lo) === Math.round(hi) ? fmt.money(lo) : fmt.money(lo) + ' to ' + fmt.money(hi);
    };
    const card = (g) => {
      const descs = [...g.descs.entries()].sort((a, b) => b[1] - a[1]).map((e) => e[0]);
      return h('article', { class: 'fz-card' },
        h('div', { class: 'fz-card-top' }, h('span', { class: 'when' }, g.quotes.length ? 'On ' + fmt.plural(g.quotes.length, 'quote') : 'Price list only'), h('span', { class: 'amt' }, range(g))),
        h('span', { class: 'who' }, g.name),
        descs.length ? h('span', { class: 'why' }, '“' + descs[0] + '”') : h('span', { class: 'why' }, 'No description written yet.'),
        g.list != null ? h('span', { class: 'fz-hint' }, 'Price list: ' + fmt.money(g.list) + (g.prices.length ? ' · quoted at ' + range(g) : '')) : null,
        g.quotes.length ? h('div', { style: 'display:flex;flex-wrap:wrap;gap:6px;margin-top:4px' }, g.quotes.slice(0, 4).map((q) =>
          h(q.link ? 'a' : 'span', { class: 'fz-chip', href: q.link || null, target: q.link ? '_blank' : null, rel: q.link ? 'noopener' : null, style: 'display:inline-block' }, h('span', { class: 't' }, 'Quote ' + q.num + ' · ' + fmt.fmtDate(q.at)), q.who))) : null);
    };

    const results = h('div', { class: 'fz-cards', 'aria-live': 'polite' });
    const heading = h('p', { class: 'fz-sub' });
    const show = (q) => {
      const words = String(q || '').toLowerCase().split(/[^a-z0-9/]+/).filter((w) => w && !STOP.has(w));
      let list = byUse;
      if (words.length) {
        const stem = (w) => w.replace(/(es|s)$/, '');
        list = all.map((g) => ({ g, s: words.filter((w) => g.text.includes(stem(w))).length })).filter((x) => x.s > 0)
          .sort((a, b) => b.s - a.s || b.g.quotes.length - a.g.quotes.length).map((x) => x.g);
      }
      heading.textContent = words.length ? (list.length ? fmt.plural(list.length, 'match', 'matches') + ', closest first' : 'No matches. Try one word, like shower or mirror.') : 'Most used items in recent quotes';
      results.replaceChildren(...list.slice(0, 6).map(card));
    };
    const input = h('input', { type: 'search', class: 'fz-input', placeholder: 'Try frameless slider or mirror clips', 'aria-label': 'Search past pricing and descriptions', autocomplete: 'off', oninput: (e) => show(e.target.value) });
    show('');

    const out = [];
    out.push(ui.status(['Look up how we priced past work across ', { b: String(all.length) }, ' items.']));
    out.push(ui.section('Ask the handbook', 'Searches item names and descriptions from the price list and the last ' + quotes.length + ' quotes', input, heading, results));
    out.push(ui.table([
      { label: 'Item', get: (g) => g.name },
      { label: 'Quotes', num: true, get: (g) => String(g.quotes.length) },
      { label: 'Price list', num: true, get: (g) => g.list != null ? fmt.money(g.list) : '' },
      { label: 'Quoted at', num: true, get: (g) => g.prices.length ? range(g) : '' }
    ], byUse, { summary: 'All ' + all.length + ' items as a list' }));
    out.push(ui.how('Every active item on the Jobber price list, plus every line on the last ' + quotes.length + ' quotes.',
      'Typing searches names and descriptions. Words like how, did and price are skipped, so a full question works.',
      'The price range is the lowest and highest unit price on those quotes.'));
    return out;
  }
});
