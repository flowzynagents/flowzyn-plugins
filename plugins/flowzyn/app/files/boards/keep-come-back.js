// Come Back: past clients with work finished 6 to 18 months ago and no quote since.
FZ.board('come-back', {
  source: 'Jobs and quotes: Jobber, live.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const FROM = 182, TO = 548, CHECK_CAP = 25;
    const [done, newer] = await Promise.all([
      ctx.jobberAll('search_jobs', { status: 'archived', completedAt: { after: fmt.isoDaysAgo(TO), before: fmt.isoDaysAgo(FROM) }, limit: 50 }, 'jobs', 200),
      ctx.jobberAll('search_jobs', { createdAt: { after: fmt.isoDaysAgo(TO) }, limit: 50 }, 'jobs', 200)
    ]);

    const byClient = new Map();
    done.filter((j) => j.client && j.completedAt).forEach((j) => {
      const d = fmt.daysSince(j.completedAt);
      if (d < FROM || d > TO) return;
      const g = byClient.get(j.client.id) || { id: j.client.id, name: fmt.clean(j.client.name), jobs: [], dollars: 0, last: null };
      g.jobs.push(j); g.dollars += Number(j.total) || 0;
      if (!g.last || j.completedAt > g.last.completedAt) g.last = j;
      byClient.set(j.client.id, g);
    });
    const all = [...byClient.values()].sort((a, b) => b.dollars - a.dollars);

    // A newer job for the same client means they already came back.
    all.forEach((g) => {
      const j = newer.find((x) => x.client && x.client.id === g.id && x.createdAt > g.last.completedAt);
      if (j) g.since = { what: 'Job', at: j.createdAt };
    });
    // Check quotes since, for the top clients only.
    await ctx.pool(all.filter((g) => !g.since).slice(0, CHECK_CAP), 4, async (g) => {
      const r = await ctx.jobber('search_quotes', { clientId: g.id, dateRange: { after: g.last.completedAt }, limit: 5 });
      const q = ((r && r.quotes) || []).filter((x) => x.createdAt > g.last.completedAt).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))[0];
      g.checked = true;
      if (q) g.since = { what: 'Quote', at: q.createdAt };
    });
    const due = all.filter((g) => g.checked && !g.since);
    const dueSum = due.reduce((s, g) => s + g.dollars, 0);

    const months = (iso) => Math.max(1, Math.round(fmt.daysSince(iso) / 30.4));
    const street = (j) => fmt.clean(j.property && j.property.address && j.property.address.street1);
    const draft = (g) => 'Hi ' + fmt.firstName(g.name) + ',\n\n' +
      'It is ' + FZ.me().first + ' at ' + FZ.biz() + '. It has been about ' + months(g.last.completedAt) + ' months since we did the ' + fmt.clean(g.last.title).toLowerCase() + (street(g.last) ? ' at ' + street(g.last) : '') + '. I hope it is all holding up well.\n\n' +
      'If there is anything else on your list, like a mirror, a shower door or a window that sticks, I would be glad to come take a look. Just reply and we will find a time.\n\n' +
      FZ.sign();

    ctx.metric('come-back', due.length
      ? { value: fmt.plural(due.length, 'past client') + ' to reach', detail: fmt.money(dueSum, { short: true }) + ' in past work, 6 to 18 months ago' }
      : all.length ? { value: 'Past clients all reached', detail: 'Work from 6 to 18 months ago' } : { value: 'Checking past clients', detail: 'Work from 6 to 18 months ago' });

    const out = [];
    const { h } = ui;
    const K = FZ.kit;
    const tiles = (list) => h('div', { class: 'cb-grid' }, list.map((g) => h('div', { class: 'cb-tile' + (g.hi ? ' hi' : '') },
      h('span', { class: 'cb-mo' }, h('b', null, String(g.mo)), ' months'),
      h('span', { class: 'cb-nm' }, g.name),
      h('span', { class: 'cb-amt' }, g.amt),
      h('span', { class: 'cb-tag' }, g.tag))));
    out.push(h('style', null, CB_CSS));
    if (!all.length) {
      out.push(ui.status(['No jobs finished 6 to 18 months ago yet. ', { b: 'Check ins start as they come due.' }]));
      out.push(K.how(h, 'It writes a check in from you to past clients 6 to 18 months after their job, when no quote or job came since.'));
      const EX = [
        { name: 'Lakeside Condo HOA', past: 8400, mo: 7, ask: true },
        { name: 'Ridge Road Cabin', past: 6200, mo: 9 },
        { name: 'Main Street Dental', past: 5100, mo: 11, ask: true },
        { name: 'Pine Lane Home', past: 3900, mo: 13 },
        { name: 'Ski Hill Rental', past: 2700, mo: 15 },
        { name: 'Hilltop Duplex', past: 1800, mo: 17 }
      ];
      out.push(K.quiet(h,
        K.checked(h, newer.length ? fmt.plural(newer.length, 'recent job') + ' checked in Jobber' : 'Jobber checked for past jobs', [
          'None finished 6 to 18 months ago',
          'Clients with a newer job or quote are left alone',
          'Checked again on every run'
        ]),
        K.example(h, '2 of 6 past clients asked for a quote', [
          tiles(EX.map((g) => ({ name: g.name, mo: g.mo, amt: fmt.money(g.past, { short: true }) + ' past work', tag: g.ask ? 'Asked for a quote' : 'Checked in', hi: g.ask }))),
          h('p', { class: 'cb-note' }, 'Made up for a glass shop in Breckenridge. Your real past clients replace this.')])));
    } else {
      out.push(ui.status(due.length
        ? [fmt.plural(due.length, 'past client') + ' worth ', { b: fmt.money(dueSum, { short: true }) }, ' have not heard from you in 6 to 18 months. ', { b: due.length === 1 ? 'The check in is written.' : 'Check ins are written.' }]
        : ['The ' + fmt.plural(all.length, 'client') + ' from 6 to 18 months ago ', { b: 'all came back' }, ' with a quote or job.']));
      out.push(K.how(h, 'It writes a check in from you to past clients 6 to 18 months after their job, when no quote or job came since.'));
      // Hero: a tile per past client, by months since their job. Orange means nothing since.
      const byAge = all.slice().sort((a, b) => fmt.daysSince(a.last.completedAt) - fmt.daysSince(b.last.completedAt)).slice(0, 12);
      out.push(K.hero(h, {
        eyebrow: '6 to 18 months ago',
        title: due.length ? [{ b: fmt.money(dueSum, { short: true }) }, ' of past work has gone quiet'] : ['Every past client ', { b: 'came back' }],
        sub: 'Each tile is a past client, newest job first. Orange means no quote or job since.',
        viz: tiles(byAge.map((g) => ({ name: g.name, mo: months(g.last.completedAt), amt: fmt.money(g.dollars, { short: true }) + ' past work', tag: g.since ? g.since.what + ' since' : g.checked ? 'Nothing since' : 'Not checked', hi: g.checked && !g.since }))),
        did: [
          { t: 'Found ' + fmt.plural(all.length, 'client') + ' with a job 6 to 18 months ago', s: fmt.money(all.reduce((n, g) => n + g.dollars, 0), { short: true }) + ' in past work' },
          { t: 'Checked each for a newer job or quote', s: all.length - due.length ? (all.length - due.length) + ' came back, left alone' : 'None came back yet' },
          due.length ? { t: 'Wrote ' + fmt.plural(due.length, 'check in'), s: 'Names their last job and street' } : null,
          { t: 'Next: check ins go out after your OK', s: 'From your own email', done: false }
        ].filter(Boolean)
      }));
      const goWork = (who) => { const b = document.querySelector('.fz-subtabs button[data-id="work"]'); if (b) b.click(); setTimeout(() => { const c = [...document.querySelectorAll('.fz-card')].find((x) => (x.querySelector('.who') || {}).textContent === who); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); };
      const top3 = due.slice(0, 3);
      const rest = all.filter((g) => !top3.includes(g));
      const table = ui.table([
        { label: 'Customer', get: (g) => g.name },
        { label: 'Last job', get: (g) => fmt.clean(g.last.title) },
        { label: 'Finished', get: (g) => fmt.fmtDate(g.last.completedAt) },
        { label: 'Past work', num: true, get: (g) => fmt.money(g.dollars) },
        { label: 'Since then', get: (g) => g.since ? g.since.what + ' ' + fmt.fmtDate(g.since.at) : g.checked ? ui.pill('Nothing yet', 'hot') : ui.pill('Not checked') }
      ], rest, { open: true });
      if (top3.length) out.push(K.needs(h, {
        title: [fmt.plural(top3.length, 'check in') + ' ready, ', { b: 'biggest past work first' }],
        items: top3.map((g) => ({
          title: g.name,
          meta: [{ b: fmt.money(g.dollars, { short: true }) }, ' past work · ' + months(g.last.completedAt) + ' months ago'],
          detail: fmt.clean(g.last.title) + (street(g.last) ? ' at ' + street(g.last) : '') + '. Check in is written.',
          actions: [h('button', { type: 'button', class: 'fz-btn act', onclick: () => goWork(g.name) }, 'Send it'), g.last.jobberWebUri ? ui.extLink(g.last.jobberWebUri, 'Open last job', 'fz-tlink') : null].filter(Boolean)
        })),
        rest: { count: rest.length, label: 'past clients the agent is watching', list: table }
      }));
      else out.push(ui.details(fmt.plural(all.length, 'client') + ' from 6 to 18 months ago', table));
      if (due.length) {
        out.push(ui.cards(due.map((g) => ({
          when: 'Finished ' + fmt.fmtDate(g.last.completedAt) + ' · ' + months(g.last.completedAt) + ' months ago',
          who: g.name,
          why: fmt.clean(g.last.title) + (street(g.last) ? ' at ' + street(g.last) : '') + '. ' + fmt.plural(g.jobs.length, 'job') + ' in that stretch.',
          amount: g.dollars,
          link: g.last.jobberWebUri, linkLabel: 'Open last job',
          clientId: g.id, draftSubject: 'Checking in from ' + FZ.biz(), draft: draft(g), draftLabel: 'Draft a note'
        })), { max: due.length }));
      }
    }
    out.push(ui.how(
      'Clients with a Jobber job finished 6 to 18 months ago, ranked by the dollars of that work.',
      'Anyone with a newer job or quote since is left out. Quotes are checked for the top ' + CHECK_CAP + ' clients.',
      'Queued emails go out from your email on the next run. Nothing goes out unless you queue it.'));
    return out;
  }
});
const CB_CSS = '.cb-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:10px}.cb-tile{border:1px solid var(--line);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:3px;min-width:0;background:var(--quiet,transparent)}.cb-mo{font-size:12px;color:var(--muted)}.cb-mo b{font:800 22px/1 var(--font);color:var(--fg);margin-right:2px}.cb-nm{color:var(--fg);font-weight:600;font-size:14px;overflow-wrap:anywhere}.cb-amt{font-size:12px;color:var(--muted)}.cb-tag{font-size:12px;font-weight:600;color:var(--muted);margin-top:2px}.cb-tile.hi{border-color:var(--accent)}.cb-tile.hi .cb-tag,.cb-tile.hi .cb-mo b{color:var(--accent)}.cb-note{margin:8px 0 0;font-size:12px;color:var(--muted)}' +
  '.ag-act .fz-btn{min-height:36px;padding:0 14px;font-size:14px;white-space:nowrap}.ag-act .fz-btn.act{background:var(--accent);color:var(--on-accent,#111)!important}.ag-act .fz-tlink{font-size:13px;color:var(--muted);font-weight:500}.ag-more details > div{margin-top:12px}' +
  '@media(max-width:520px){.cb-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}';
