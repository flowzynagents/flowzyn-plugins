// Supplier Price Watch: price list items priced below cost or too close to it.
FZ.board('price-watch', {
  source: 'Price list: Jobber Products and Services, live.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const MIN_MARGIN = 15;
    const list = await ctx.jobberAll('search_products_and_services', { limit: 50 }, 'productsAndServices', 300);
    const items = list.filter((p) => p.active !== false).map((p) => {
      const price = Number(p.defaultPrice) || 0;
      const cost = p.internalCost == null ? null : Number(p.internalCost);
      const hasCost = cost != null && cost > 0;
      const margin = hasCost && price > 0 ? Math.round((price - cost) / price * 1000) / 10 : null;
      const state = !hasCost ? (price > 0 ? 'nocost' : 'free') : price < cost ? 'below' : margin < MIN_MARGIN ? 'thin' : 'ok';
      return { p, name: fmt.clean(p.name), price, cost, margin, state, target: hasCost ? Math.ceil(cost / (1 - MIN_MARGIN / 100)) : null };
    });
    const close = items.filter((x) => x.state === 'below' || x.state === 'thin').sort((a, b) => a.margin - b.margin);
    const noCost = items.filter((x) => x.state === 'nocost');

    ctx.metric('price-watch', close.length
      ? { value: fmt.plural(close.length, 'item') + ' close to cost', detail: close[0].name + ' at ' + close[0].margin + '% margin' }
      : { value: 'Prices clear cost', detail: noCost.length ? fmt.plural(noCost.length, 'item') + ' with no cost entered' : '' });

    const out = [];
    out.push(ui.status(close.length
      ? [{ b: String(close.length) }, ' ' + (close.length === 1 ? 'item is' : 'items are') + ' priced too close to cost.']
      : ['Every item with a cost clears ', { b: MIN_MARGIN + '%' }, ' margin.']));

    const cards = close.map((x) => ({
      when: x.state === 'below' ? 'Below cost' : x.margin + '% margin',
      who: x.name, amount: x.price, flag: x.state === 'below',
      why: 'Costs you ' + fmt.money(x.cost) + '. Pricing it at ' + fmt.money(x.target) + ' keeps a ' + MIN_MARGIN + '% margin.'
    }));
    noCost.forEach((x) => cards.push({ when: 'No cost entered', who: x.name, amount: x.price, why: 'Add what it costs you in Jobber so its margin can be checked.' }));
    out.push(cards.length ? ui.cards(cards, { max: 6 }) : ui.calm('Every item on the price list has a cost and a healthy margin.'));

    const priced = items.filter((x) => x.margin != null).sort((a, b) => a.margin - b.margin);
    if (priced.length) out.push(ui.section('Lowest margins on the price list', 'Margin on the default price, lowest first', ui.bars(priced.map((x) => ({ label: x.name, value: Math.max(0, x.margin), display: x.margin + '%', hi: x.state !== 'ok' })), { max: 8 })));

    const word = { below: 'Below cost', thin: 'Too close', ok: 'Healthy', nocost: 'No cost', free: 'No price' };
    out.push(ui.table([
      { label: 'Item', get: (x) => x.name },
      { label: 'Type', get: (x) => x.p.category === 'service' ? 'Service' : 'Product' },
      { label: 'Price', num: true, get: (x) => fmt.money(x.price) },
      { label: 'Cost', num: true, get: (x) => x.cost ? fmt.money(x.cost) : '' },
      { label: 'Margin', num: true, get: (x) => x.margin != null ? x.margin + '%' : '' },
      { label: 'Check', get: (x) => ui.pill(word[x.state], x.state === 'below' || x.state === 'thin' ? 'hot' : null) }
    ], items.slice().sort((a, b) => (a.margin == null ? 999 : a.margin) - (b.margin == null ? 999 : b.margin)), { summary: 'All ' + items.length + ' price list items' }));
    out.push(ui.note('Supplier price change emails will show here once Gmail is connected, so a cost going up is caught the day it lands.'));
    out.push(ui.how('Reads every active item on the Jobber price list and compares its default price with its cost.',
      'Margin is price minus cost, divided by price. Under ' + MIN_MARGIN + '% counts as too close. Below cost comes first.',
      'Items with a price but no cost entered are listed so their margin can be checked.'));
    return out;
  }
});
