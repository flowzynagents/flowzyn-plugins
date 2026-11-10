// Builder Keep: builders ranked by quoted and won dollars, last touch, and a check in for the quiet ones.
FZ.board('builder-keep', {
  source: 'Clients, quotes and jobs: Jobber, live.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const QUIET = 60;
    const isCo = (c) => !!(c && (fmt.clean(c.companyName) || c.isCompany));
    const coName = (c) => fmt.clean(c.companyName) || fmt.clean(c.name);
    const [clients, quotes, jobs] = await Promise.all([
      ctx.jobberAll('search_clients', { limit: 100 }, 'clients', 300),
      ctx.jobberAll('search_quotes', { dateRange: { after: fmt.isoDaysAgo(365) }, sort: 'createdAt', limit: 100 }, 'quotes', 300),
      ctx.jobberAll('search_jobs', { createdAt: { after: fmt.isoDaysAgo(365) }, limit: 50 }, 'jobs', 200)
    ]);

    // Group contacts by company so two people at one builder count once.
    const groups = new Map();
    const owner = new Map();
    clients.filter((c) => isCo(c) && !c.isArchived).forEach((c) => {
      const k = coName(c).toLowerCase();
      if (!groups.has(k)) groups.set(k, { name: coName(c), contacts: [], link: c.jobberWebUri, quoted: 0, won: 0, nq: 0, nj: 0, touch: null, lastWork: '' });
      const g = groups.get(k);
      g.contacts.push(c);
      owner.set(c.id, g);
    });
    const nowIso = new Date().toISOString();
    const touch = (g, iso, what) => { if (!iso) return; const t = iso > nowIso ? nowIso : iso; if (!g.touch || t > g.touch) { g.touch = t; g.lastWork = what; } };
    quotes.forEach((q) => {
      const g = q.client && owner.get(q.client.id);
      if (!g || fmt.daysSince(q.createdAt) > 365) return;
      g.nq++; g.quoted += Number(q.total) || 0;
      if (q.status === 'approved' || q.status === 'converted') g.won += Number(q.total) || 0;
      touch(g, q.sentAt || q.createdAt, fmt.clean(q.title));
    });
    jobs.forEach((j) => {
      const g = j.client && owner.get(j.client.id);
      if (!g || fmt.daysSince(j.createdAt) > 365) return;
      g.nj++;
      touch(g, j.completedAt || j.startAt || j.createdAt, fmt.clean(j.title));
    });
    const list = [...groups.values()].map((g) => Object.assign(g, { quiet: g.touch ? fmt.daysSince(g.touch) : null }))
      .sort((a, b) => b.won - a.won || b.quoted - a.quoted);
    const quiet = list.filter((g) => g.quiet == null || g.quiet >= QUIET);

    const pickContact = (g) => g.contacts.find((c) => fmt.clean(c.name).toLowerCase() !== g.name.toLowerCase()) || g.contacts[0];
    const greet = (g) => { const c = pickContact(g); const n = fmt.clean(c && c.name); return n && n.toLowerCase() !== g.name.toLowerCase() ? fmt.firstName(n) : 'there'; };
    const draft = (g) => 'Hi ' + greet(g) + ',\n\n' +
      'It has been a little while since ' + (g.lastWork ? 'the ' + g.lastWork.toLowerCase() : 'we last worked together') + '. I wanted to check in and see how the next project is looking.\n\n' +
      'If you have plans or a start date, send them over and I will get your glass priced and on the calendar early.\n\n' +
      FZ.sign();
    const lastLabel = (g) => g.touch ? fmt.fmtDate(g.touch) + ' · ' + fmt.plural(g.quiet, 'day') + ' ago' : 'Nothing in 12 months';

    ctx.metric('builder-keep', { value: fmt.plural(quiet.length, 'builder') + ' to check in with', detail: fmt.plural(list.length, 'builder') + ' in Jobber, quiet ' + QUIET + ' days or more' });

    const out = [];
    if (!list.length) {
      out.push(ui.status(['No builders in Jobber yet.']));
      out.push(ui.calm('Clients with a company name show here once you add them.'));
      return out;
    }
    out.push(ui.status(quiet.length
      ? [{ b: String(quiet.length) }, ' of your ', String(list.length), ' builders ', quiet.length === 1 ? 'has' : 'have', ' been quiet ' + QUIET + ' days or more.']
      : ['All ', { b: String(list.length) }, ' builders have heard from you in the last ' + QUIET + ' days.']));
    if (quiet.length) {
      out.push(ui.cards(quiet.map((g) => ({
        when: 'Last touch ' + lastLabel(g), who: g.name,
        why: fmt.money(g.won, { short: true }) + ' won of ' + fmt.money(g.quoted, { short: true }) + ' quoted in 12 months.' + (g.lastWork ? ' Last was ' + g.lastWork + '.' : ''),
        amount: g.won || null, flag: g.won > 0,
        link: g.link, linkLabel: 'Open in Jobber',
        draft: draft(g), draftLabel: 'Draft a check in'
      }))));
    } else {
      out.push(ui.calm('Everyone has heard from you lately. Nice.'));
    }

    const useWon = list.some((g) => g.won > 0);
    const ranked = list.slice().sort((a, b) => useWon ? b.won - a.won : b.quoted - a.quoted);
    out.push(ui.section(ranked[0].name + (useWon ? ' sends the most work' : ' leads on quoted dollars'), (useWon ? 'Won' : 'Quoted') + ' dollars, last 12 months',
      ui.bars(ranked.map((g, i) => ({ label: g.name, value: useWon ? g.won : g.quoted, display: fmt.money(useWon ? g.won : g.quoted, { short: true }), hi: i === 0, link: g.link })))));

    out.push(ui.table([
      { label: 'Builder', get: (g) => g.name },
      { label: 'Contacts', get: (g) => g.contacts.map((c) => fmt.clean(c.name)).join(', ') },
      { label: 'Quotes', num: true, get: (g) => String(g.nq) },
      { label: 'Quoted', num: true, get: (g) => fmt.money(g.quoted) },
      { label: 'Won', num: true, get: (g) => fmt.money(g.won) },
      { label: 'Jobs', num: true, get: (g) => String(g.nj) },
      { label: 'Last touch', get: (g) => g.quiet != null && g.quiet >= QUIET ? ui.pill(lastLabel(g), 'hot') : lastLabel(g) }
    ], list, { summary: 'All ' + list.length + ' builders as a list' }));
    out.push(ui.how(
      'A builder is any Jobber client with a company name. Contacts at the same company count as one builder.',
      'Quoted is every quote in the last 12 months. Won is approved and converted quotes.',
      'Last touch is the latest quote sent or job date. Quiet means ' + QUIET + ' days or more.'));
    return out;
  }
});
