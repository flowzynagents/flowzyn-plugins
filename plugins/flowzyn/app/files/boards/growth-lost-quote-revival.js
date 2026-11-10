// Lost Quote Revival: quotes archived 2 to 12 months ago, ranked by dollars, with a seasonal note from the owner.
FZ.board('lost-quote-revival', {
  source: 'Quotes: Jobber, live.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const MIN = 60, MAX = 365;
    const [archived, recent] = await Promise.all([
      ctx.jobberAll('search_quotes', { status: 'archived', dateRange: { after: fmt.isoDaysAgo(MAX * 2) }, sort: 'createdAt', limit: 100 }, 'quotes', 300),
      ctx.jobberAll('search_quotes', { dateRange: { after: fmt.isoDaysAgo(MAX) }, sort: 'createdAt', limit: 100 }, 'quotes', 300)
    ]);
    const lastTouch = (q) => q.updatedAt || q.createdAt;
    const rows = archived
      .filter((q) => { const d = fmt.daysSince(lastTouch(q)); return d >= MIN && d <= MAX; })
      .map((q) => {
        const newer = recent.filter((r) => r.id !== q.id && r.client && q.client && r.client.id === q.client.id && r.status !== 'archived' && r.createdAt > q.createdAt)
          .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
        return { q, who: fmt.clean(q.client && q.client.name), total: Number(q.total) || 0, newer };
      })
      .sort((a, b) => (!!a.newer - !!b.newer) || b.total - a.total);
    const sum = rows.reduce((s, r) => s + r.total, 0);

    // Season by today's month in Mountain time.
    const month = Number(fmt.dayKey(new Date().toISOString()).slice(5, 7));
    const season = month === 12 || month <= 3 ? 'winter' : month <= 5 ? 'spring' : month <= 8 ? 'summer' : 'fall';
    const kindOf = (t) => /window|door/i.test(t) ? 'windows' : /shower|mirror|bath/i.test(t) ? 'inside' : /builder|package|commercial/i.test(t) ? 'builder' : 'inside';
    const LINES = {
      fall: { windows: 'With winter coming, now is a good time to get new windows in before the cold sets in.', inside: 'We still have room on the calendar before the holidays if you would like it done before family visits.', builder: 'If the project is moving again, we can get you on the schedule before ski season gets busy.' },
      winter: { windows: 'Winter is a good time to plan windows so we can install as soon as the weather opens up.', inside: 'Winter is a quieter stretch for indoor work, so we can usually get to you quickly.', builder: 'If the project is back on for spring, I would love to get your glass on the calendar early.' },
      spring: { windows: 'Spring is a great time for new glass before the summer rental season.', inside: 'If you want it done before summer guests arrive, now is the time.', builder: 'Spring starts are filling up and I want to make sure your glass is ready on time.' },
      summer: { windows: 'Summer is our best weather for windows and we have a few openings.', inside: 'We have a few openings this summer if you would still like it done.', builder: 'If the project picked back up, we can still fit your glass in this season.' }
    };
    const monthYear = (iso) => new Date(iso).toLocaleDateString('en-US', { timeZone: fmt.TZ, month: 'long', year: 'numeric' });
    const draft = (r) => 'Hi ' + fmt.firstName(r.who) + ',\n\n' +
      'It is ' + FZ.me().first + ' at ' + FZ.biz() + '. Back in ' + monthYear(r.q.createdAt) + ' we put together a quote for ' + (fmt.clean(r.q.title) ? 'your ' + fmt.clean(r.q.title).toLowerCase().replace(/\s*quote$/, '') : 'you') + ' (' + fmt.money(r.total) + '). ' + LINES[season][kindOf(r.q.title)] + '\n\n' +
      'If it is still on your list, I am happy to refresh the numbers or come take another look. Just reply here and we will set it up.\n\n' +
      FZ.sign();

    ctx.metric('lost-quote-revival', rows.length
      ? { value: fmt.plural(rows.length, 'quote') + ' worth a second look', detail: fmt.money(sum, { short: true }) + ' archived 2 to 12 months ago' }
      : { value: 'No archived quotes to revisit', detail: '2 to 12 months back' });

    const out = [];
    const { h } = ui;
    const K = FZ.kit;
    const mName = (k) => new Date(k + '-15T12:00:00Z').toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
    const cellStrip = (cells, peak) => h('ol', { class: 'lq-cells' }, cells.map((c, i) => h('li', { class: 'lq-cell' + (c.n ? '' : ' none') + (i < 2 && c.n ? ' hi' : ''), title: mName(c.k) + ' ' + c.k.slice(0, 4) + ': ' + (c.n ? fmt.plural(c.n, 'quote') + ', ' + fmt.money(c.d) : 'none') },
      h('span', { class: 'lq-m' }, mName(c.k) + (c.k.endsWith('-01') || i === cells.length - 1 ? ' ’' + c.k.slice(2, 4) : '')),
      h('span', { class: 'lq-heat', style: c.n ? '--lq:' + Math.round(18 + 70 * c.d / peak) + '%' : null }),
      h('b', { class: 'lq-v' }, fmt.money(c.d, { short: true })),
      h('span', { class: 'lq-n' }, c.n ? fmt.plural(c.n, 'quote') : ''))));
    const months = [];
    for (let m = 2; m <= 12; m++) { const d = new Date(); d.setDate(15); d.setMonth(d.getMonth() - m); months.push(d.toISOString().slice(0, 7)); }
    if (!rows.length) {
      out.push(ui.status(['No quotes went quiet 2 to 12 months ago. ', { b: 'Nothing to win back right now.' }]));
      out.push(K.how(h, 'It finds archived quotes from 2 to 12 months ago and writes each customer a win back offer from you.'));
      const ex = months.slice(0, 6).map((k, i) => ({ k, n: [2, 1, 0, 3, 1, 0][i], d: [6400, 2100, 0, 7800, 1500, 0][i] }));
      out.push(K.quiet(h,
        K.checked(h, fmt.plural(archived.length, 'archived quote') + ' checked', [
          'None last touched 2 to 12 months ago',
          'Quotes newer than 2 months stay with Chase Quotes',
          'Checked again on every run'
        ]),
        K.example(h, '$8.5k went quiet in the last 2 months', [h('div', { class: 'lq-strip viz' }, cellStrip(ex, 7800), h('p', { class: 'lq-key' }, 'Made up for a glass shop. Your own quotes replace this.'), h('style', null, LQ_CSS))])));
      out.push(ui.how('Looks at every Jobber quote marked archived and last touched 60 to 365 days ago.'));
      return out;
    }
    out.push(ui.status([fmt.plural(rows.length, 'archived quote') + ' worth ', { b: fmt.money(sum, { short: true }) }, ' could come back. ', { b: rows.length === 1 ? 'The offer is written.' : 'All ' + rows.length + ' offers are written.' }]));
    out.push(K.how(h, 'It finds archived quotes from 2 to 12 months ago and writes each customer a win back offer from you.'));

    // Hero: a month strip, archived dollars by the month the quote went quiet. Fresher months are easier to win back.
    const mKey = (iso) => fmt.dayKey(iso).slice(0, 7);
    const cells = months.map((k) => { const list = rows.filter((r) => mKey(lastTouch(r.q)) === k); return { k, n: list.length, d: list.reduce((n, r) => n + r.total, 0) }; });
    const freshD = cells[0].d + cells[1].d;
    const peak = Math.max(1, ...cells.map((c) => c.d));
    const T = (FZ.tasksNow && FZ.tasksNow().done) || {};
    const qidOf = (k) => 'send-' + String(k || '').replace(/[^A-Za-z0-9]+/g, '-').slice(-80);
    const queuedN = rows.filter((r) => (T[qidOf(r.q.jobberWebUri || r.who)] || {}).outbox).length;
    out.push(K.hero(h, {
      eyebrow: 'Last 12 months',
      title: freshD ? [{ b: fmt.money(freshD, { short: true }) }, ' went quiet in ' + [cells[1], cells[0]].filter((c) => c.n).map((c) => mName(c.k)).join(' and ') + ', the easiest to win back'] : ['Most of it went quiet ', { b: 'over 3 months ago' }],
      sub: 'Archived quote dollars by the month they went quiet. Newest months on the left, a fuller shade means more dollars.',
      viz: h('div', { class: 'lq-strip viz' }, cellStrip(cells, peak), h('style', null, LQ_CSS)),
      did: [
        { t: 'Read ' + fmt.plural(archived.length, 'archived quote'), s: 'From Jobber' },
        { t: 'Found ' + fmt.plural(rows.length, 'quote') + ' from 2 to 12 months ago', s: fmt.money(sum, { short: true }) + ' in all' },
        { t: 'Wrote ' + fmt.plural(rows.length, 'win back offer'), s: 'Changed for the ' + season + ' and the kind of work' },
        queuedN ? { t: 'Next: ' + fmt.plural(queuedN, 'queued offer') + ' go out', s: 'From your email on the next run', done: false } : { t: 'Next: offers go out after your OK', s: 'From your own email', done: false }
      ]
    }));
    // Needs you: the 3 biggest win back offers.
    const goWork = (who) => { const b = document.querySelector('.fz-subtabs button[data-id="work"]'); if (b) b.click(); setTimeout(() => { const c = [...document.querySelectorAll('.fz-card')].find((x) => (x.querySelector('.who') || {}).textContent === who); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); };
    const top3 = rows.slice().sort((a, b) => b.total - a.total).slice(0, 3);
    const rest = rows.filter((r) => !top3.includes(r));
    out.push(K.needs(h, {
      title: [fmt.plural(top3.length, 'win back offer') + ' ready, ', { b: 'biggest first' }],
      items: top3.map((r) => ({
        title: r.who,
        meta: [{ b: fmt.money(r.total) }, ' · Quote #' + r.q.quoteNumber + (fmt.clean(r.q.title) ? ' ' + fmt.clean(r.q.title) : '') + ' · quiet ' + Math.round(fmt.daysSince(lastTouch(r.q)) / 30.4) + ' months'],
        detail: r.newer ? 'Has a newer quote from ' + fmt.fmtDate(r.newer.createdAt) + ', check it first.' : 'Offer written for this customer and this job.',
        actions: [h('button', { type: 'button', class: 'fz-btn act', onclick: () => goWork(r.who) }, 'Send it'), r.q.jobberWebUri ? ui.extLink(r.q.jobberWebUri, 'Open quote', 'fz-tlink') : null].filter(Boolean)
      })),
      rest: { count: rest.length, label: 'archived quotes the agent is holding', list: ui.table([
        { label: 'Archived', get: (r) => fmt.fmtDate(lastTouch(r.q)) },
        { label: 'Customer', get: (r) => r.q.jobberWebUri ? ui.extLink(r.q.jobberWebUri, r.who, 'fz-tlink') : r.who },
        { label: 'Quote', get: (r) => '#' + r.q.quoteNumber + ' ' + fmt.clean(r.q.title) },
        { label: 'Total', num: true, get: (r) => fmt.money(r.total) },
        { label: 'Newer quote', get: (r) => r.newer ? ui.pill(fmt.fmtDate(r.newer.createdAt)) : '' }
      ], rest, { open: true }) }
    }));
    out.push(h('style', null, LQ_ACT_CSS));

    const offers = ui.section(fmt.plural(rows.length, 'win back offer') + ' ready', 'Each one is written for that customer and that job. Approve it and it goes out from your email.', ui.cards(rows.map((r) => ({
      when: 'Archived ' + fmt.fmtDate(lastTouch(r.q)) + ' · ' + fmt.daysSince(lastTouch(r.q)) + ' days ago',
      who: r.who,
      why: (fmt.clean(r.q.title) ? fmt.clean(r.q.title) + ', quoted ' : 'Quote #' + r.q.quoteNumber + ', quoted ') + fmt.fmtDate(r.q.createdAt) + '.' + (r.newer ? ' Has a newer quote from ' + fmt.fmtDate(r.newer.createdAt) + ', check it first.' : ''),
      amount: r.total,
      link: r.q.jobberWebUri, linkLabel: 'Open quote',
      clientId: r.q.client && r.q.client.id, draft: draft(r), draftLabel: 'Draft an email', draftSubject: 'Your ' + (fmt.clean(r.q.title) ? fmt.clean(r.q.title).replace(/\s*quote$/i, '') : 'quote') + ' from ' + FZ.biz()
    })), { max: rows.length }));
    offers.dataset.worklabel = 'Win back offers';
    out.push(offers);
    out.push(ui.how(
      'Every Jobber quote marked archived and last touched 60 to 365 days ago. Newer ones are left to the Chase Quotes agent.',
      'Ranked by dollars. Customers who already have a newer open quote go to the bottom so you can check that one first.',
      'The email changes with the season and the kind of work. Queued emails go out from your email on the next run. Nothing goes out unless you queue it.'));
    return out;
  }
});
const LQ_ACT_CSS = '.ag-act .fz-btn{min-height:36px;padding:0 14px;font-size:14px;white-space:nowrap}.ag-act .fz-btn.act{background:var(--accent);color:var(--on-accent,#111)!important}.ag-act .fz-tlink{font-size:13px;color:var(--muted);font-weight:500}.ag-more details > div{margin-top:12px}';
const LQ_AON_CSS = '.aon-list{display:flex;flex-direction:column;border:1px solid var(--edge);border-radius:12px;background:var(--card)}' +
  '.aon-row{display:grid;grid-template-columns:minmax(0,1.4fr) 6.5rem 8rem minmax(0,1.6fr);gap:6px 16px;align-items:baseline;padding:12px 16px;border-top:1px solid var(--line)}' +
  '.aon-row:first-child{border-top:0}.aon-who{display:flex;flex-direction:column;gap:2px;min-width:0}' +
  '.aon-who a,.aon-who b{font-weight:700;font-size:15px;color:var(--fg)}.aon-who span{font-size:13px;color:var(--muted)}' +
  '.aon-amt{font-weight:700;font-variant-numeric:tabular-nums;text-align:right}.aon-age{font-size:14px;color:var(--muted);font-variant-numeric:tabular-nums}' +
  '.aon-do{font-size:14px;color:var(--meta)}.aon-do.done{color:var(--ok-fg,var(--meta))}' +
  '@media (max-width:620px){.aon-row{grid-template-columns:minmax(0,1fr) auto}.aon-do{grid-column:1;grid-row:2}.aon-age{grid-column:2;grid-row:2;text-align:right}}';
const LQ_CSS = '.lq-strip{display:flex;flex-direction:column;gap:8px}' +
  '.lq-cells{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(68px,1fr));gap:4px}' +
  '.lq-cell{display:flex;flex-direction:column;gap:3px;min-width:0;padding:8px 6px;border-radius:4px}' +
  '.lq-m{font-size:12px;color:var(--muted);white-space:nowrap}.lq-heat{display:block;height:28px;border-radius:4px;background:color-mix(in srgb,var(--fg) var(--lq,0%),var(--card));border:1px solid var(--line)}' +
  '.lq-cell.hi .lq-heat{border:2px solid var(--accent)}.lq-cell.hi .lq-m{color:var(--accent-text);font-weight:600}' +
  '.lq-v{font-size:14px;color:var(--fg);font-variant-numeric:tabular-nums;white-space:nowrap}.lq-cell.none .lq-v{font-weight:400;font-size:12px;color:var(--muted)}.lq-n{font-size:12px;color:var(--muted);white-space:nowrap}' +
  '.lq-key{margin:0;font-size:12px;color:var(--muted)}' +
  '@media (max-width:620px){.lq-cells{grid-template-columns:repeat(auto-fill,minmax(58px,1fr));row-gap:8px}.lq-cell{padding:4px 2px}.lq-v{font-size:13px}}';
