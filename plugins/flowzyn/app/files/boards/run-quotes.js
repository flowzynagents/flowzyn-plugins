// Quote Jobs: one agent for the whole quote step. Three tabs: To quote, Capture from site, Pricing.
// It runs the parts that used to be separate agents (Draft Quotes, Capture Requests, Load Costs,
// Set Prices) and shows them as one page, so the owner never has to pick which agent.
FZ.board('quotes', {
  source: 'Requests, quotes and price list: Jobber, live.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const { h } = ui;
    const A = FZ.act;
    const B = FZ.BOARDS;
    const book = await A.priceBook();
    const sup = book.supplier || {};
    const supplierOn = book.method === 'supplier' && (sup.items || []).length;
    const GLASS = FZ.isGlass(); // sizes, the per square foot formula and the supplier cost sheet are for glass shops

    const run = async (k) => { try { return [].concat(await B[k].render(ctx)).filter(Boolean); } catch (e) { console.error(e); return [ui.note('This part could not read Jobber just now. Press Refresh.')]; } };
    const [toQuote, capture, costs, formula] = await Promise.all([run('quote-prep'), run('quick-capture'), GLASS ? run('supplier-costs') : [], GLASS ? run('price-book') : []]);

    // Each part's own one line summary becomes a quiet line inside its tab. The rules sit once at the foot.
    const tidy = (nodes) => nodes.filter((n) => !n.matches('.fz-how, details.fz-how') && !(n.querySelector && n.querySelector(':scope > .fz-how'))).map((n) => { if (n.classList && n.classList.contains('fz-status')) { n.classList.remove('fz-status'); n.classList.add('qj-lead'); } return n; });

    // Pricing: say plainly which price every quote uses, and switch in one tap.
    const usingText = supplierOn ? (sup.name || 'Supplier') + ' costs plus your ' + (sup.markup || 0) + '% markup' : 'your formula, $' + book.showerRate + ' a sq ft + $' + book.install + ' install + $' + book.hardware + ' hardware';
    const pick = (label, on, sub, method, can) => {
      const b = h('button', { type: 'button', class: 'qj-pick' + (on ? ' on' : ''), 'aria-pressed': String(!!on), disabled: (!can && !on) ? '' : null }, h('b', null, label), h('span', null, sub));
      if (!on && can) b.addEventListener('click', async () => { b.disabled = true; if (await A.savePriceBook({ method })) FZ.openBoard('quotes'); else b.disabled = false; });
      return b;
    };
    const using = h('section', { class: 'fz-sec' },
      h('h2', { class: 'fz-h2' }, 'Every quote is priced from ' + (supplierOn ? (sup.name || 'supplier') + ' costs' : 'your formula')),
      h('p', { class: 'fz-sub' }, 'Tap to switch. Quotes already in Jobber do not change.'),
      h('div', { class: 'qj-picks' },
        pick('Supplier costs', supplierOn, (sup.items || []).length ? fmt.plural(sup.items.length, 'cost') + ' from ' + (sup.name || 'your supplier') + ', +' + (sup.markup || 0) + '%' : 'Load the cost sheet below first', 'supplier', (sup.items || []).length),
        pick('Your formula', !supplierOn, '$' + book.showerRate + ' a sq ft + $' + book.install + ' + $' + book.hardware, 'formula', true)));

    const tabs = [
      { id: 'work', label: 'To quote', kids: tidy(toQuote).filter((n) => !(n.matches && n.matches('.ag-hero, .ag-need, .ag-how, .qj-lead'))) },
      { id: 'capture', label: 'Capture from site', kids: tidy(capture) },
      GLASS ? { id: 'pricing', label: 'Pricing', kids: [using, ...tidy(costs), ...tidy(formula)] } : null
    ].filter(Boolean);
    const priced = GLASS ? 'Priced from ' + (supplierOn ? 'supplier costs' : 'your formula') : 'Priced from your price list and past quotes';
    const nCards = tabs[0].kids.reduce((c, k) => c + (k.querySelectorAll ? k.querySelectorAll('[data-qg]').length : 0), 0);
    const pickTab = FZ.QTAB || 'work'; FZ.QTAB = null;
    const bar = h('div', { class: 'fz-subtabs', role: 'tablist' });
    const panes = tabs.map((t) => h('div', { class: 'fz-tabbody', 'data-id': t.id }, ...t.kids));
    const paint = (id) => { bar.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === id))); panes.forEach((p) => { p.hidden = p.dataset.id !== id; }); };
    tabs.forEach((t) => { const b = h('button', { type: 'button', role: 'tab', 'data-id': t.id }, t.label, t.id === 'work' && nCards ? h('span', { class: 'n' }, String(nCards)) : null); b.addEventListener('click', () => paint(t.id)); bar.append(b); });

    ctx.metric('quotes', nCards ? { value: fmt.plural(nCards, 'job') + ' to quote', detail: priced } : { value: 'Nothing waiting to quote', detail: priced });

    const out = [];
    out.push(ui.status(nCards
      ? [{ b: fmt.plural(nCards, 'job') }, ' ready to quote.']
      : ['Nothing waiting to quote. ', { b: GLASS ? 'New measures show up here.' : 'Jobs you have visited show up here.' }]));
    out.push(h('div', { class: 'qj-tabs' }, bar, ...panes));
    out.push(ui.note('The first time you create a quote' + (GLASS ? ' or read a photo' : '') + ', Claude asks you to allow this page to do it. Press Allow. Nothing is sent to a customer from here.'));
    out.push(GLASS
      ? ui.how('To quote: every measured job in Jobber, with a draft quote you check, then create in Jobber with one press.',
        'Capture from site: anything asked for on site becomes a request in Jobber, with a draft quote if you have the sizes or a photo of the drawing.',
        'Pricing: pick supplier costs or your formula. You can see your real price per square foot from past quotes, and quotes priced off it.')
      : ui.how('To quote: every job you have visited, or that asked for a quote, with a draft built from your Jobber price list and your most similar past quote. You check it, then create it in Jobber with one press.',
        'Capture from site: anything asked for on site becomes a request in Jobber, so it is never forgotten.'));
    out.push(h('style', null, '.qj-lead{font-size:15px;font-weight:600;margin:14px 0 4px}.qj-lead b{color:var(--accent)}.qj-picks{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:620px){.qj-picks{grid-template-columns:1fr}}.qj-pick{display:flex;flex-direction:column;gap:4px;text-align:left;font:inherit;padding:14px 16px;border-radius:12px;border:1px solid var(--line);background:var(--card);color:var(--fg);cursor:pointer;min-height:44px}.qj-pick span{font-size:13px;color:var(--muted)}.qj-pick.on{border-color:var(--accent);box-shadow:inset 0 0 0 1px var(--accent)}.qj-pick.on b:after{content:"  In use";color:var(--accent);font-size:12px;font-weight:700}.qj-pick[disabled]{opacity:.55;cursor:default}'));
    queueMicrotask(() => paint(pickTab));
    setTimeout(() => paint(pickTab), 0);
    return out;
  }
});
