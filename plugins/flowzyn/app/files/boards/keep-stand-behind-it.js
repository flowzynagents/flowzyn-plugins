// Stand Behind It: warranty dates on finished work, with a check in before each one ends.
FZ.board('stand-behind-it', {
  source: 'Finished jobs: Jobber, live. Supplier claims: Gmail, once connected.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const YEAR = 365, SOON = 60, RECENT = 30;
    const range = { after: fmt.isoDaysAgo(YEAR + 5) };
    const [archived, toBill] = await Promise.all([
      ctx.jobberAll('search_jobs', { status: 'archived', completedAt: range, limit: 50 }, 'jobs', 200),
      ctx.jobberAll('search_jobs', { status: 'requires_invoicing', completedAt: range, limit: 50 }, 'jobs', 200)
    ]);
    const seen = new Set();
    const rows = [...archived, ...toBill]
      .filter((j) => j.completedAt && !seen.has(j.id) && seen.add(j.id))
      .map((j) => { const end = new Date(new Date(j.completedAt).getTime() + YEAR * 86400000).toISOString(); return { j, end, left: fmt.daysUntil(end), who: fmt.clean(j.client && j.client.name) }; })
      .filter((r) => r.left >= 0)
      .sort((a, b) => a.left - b.left);
    const ending = rows.filter((r) => r.left <= SOON);
    const recent = rows.filter((r) => fmt.daysSince(r.j.completedAt) <= RECENT);

    const place = (j) => { const a = j.property && j.property.address; return a ? [fmt.clean(a.street1), fmt.clean(a.city)].filter(Boolean).join(', ') : ''; };
    const longDate = (iso) => new Date(iso).toLocaleDateString('en-US', { timeZone: fmt.TZ, month: 'short', day: 'numeric', year: 'numeric' });
    const monthName = (iso) => new Date(iso).toLocaleDateString('en-US', { timeZone: fmt.TZ, month: 'long' });
    const draft = (r) => 'Hi ' + fmt.firstName(r.who) + ',\n\n' +
      'It is ' + FZ.me().first + ' at ' + FZ.biz() + '. The ' + fmt.clean(r.j.title).toLowerCase() + ' we finished' + (r.j.property && r.j.property.address && r.j.property.address.street1 ? ' at ' + fmt.clean(r.j.property.address.street1) : '') + ' last ' + monthName(r.j.completedAt) + ' is coming up on one year. Our warranty covers it until ' + fmt.fmtDate(r.end) + '.\n\n' +
      'If anything has shifted, leaks or sticks, let me know before then and we will come take care of it. If it all looks good, there is nothing to do.\n\n' +
      FZ.sign();

    ctx.metric('stand-behind-it', ending.length
      ? { value: fmt.plural(ending.length, 'warranty', 'warranties') + ' ending soon', detail: 'Next ' + SOON + ' days, first ' + fmt.fmtDate(ending[0].end) }
      : { value: 'No warranties ending soon', detail: 'Next ' + SOON + ' days' });

    const out = [ui.status(ending.length
      ? [{ b: String(ending.length) }, ending.length === 1 ? ' warranty ends' : ' warranties end', ' in the next ' + SOON + ' days.']
      : ['No warranties end in the next ' + SOON + ' days.'])];
    if (ending.length) {
      out.push(ui.cards(ending.map((r) => ({
        when: 'Ends ' + fmt.fmtDay(r.end) + ' · in ' + fmt.plural(r.left, 'day'),
        who: r.who,
        why: fmt.clean(r.j.title) + (place(r.j) ? ' at ' + place(r.j) : '') + '. Finished ' + longDate(r.j.completedAt) + '.',
        flag: r.left <= 14,
        link: r.j.jobberWebUri, linkLabel: 'Open job',
        draft: draft(r), draftLabel: 'Draft a check in'
      }))));
    } else {
      out.push(ui.calm('Nothing to check on before a warranty ends. Nice.'));
    }
    if (recent.length) {
      out.push(ui.section(fmt.plural(recent.length, 'new install') + ' in the last ' + RECENT + ' days', 'Each one is covered for a year from its finish date',
        ui.h('div', { class: 'fz-cards' }, recent.map((r) => ui.h('a', { class: 'fz-chip', href: r.j.jobberWebUri, target: '_blank', rel: 'noopener' },
          ui.h('span', { class: 't' }, 'Covered until ' + fmt.fmtDate(r.end)), r.who + ' · ' + fmt.clean(r.j.title))))));
    }
    out.push(ui.note('Once Gmail is connected, customer emails about cracked or faulty glass show up here so you can file the claim with your supplier.'));
    out.push(ui.table([
      { label: 'Warranty ends', get: (r) => r.left <= SOON ? ui.pill(fmt.fmtDate(r.end), 'hot') : fmt.fmtDate(r.end) },
      { label: 'Customer', get: (r) => r.who },
      { label: 'Job', get: (r) => '#' + r.j.jobNumber + ' ' + fmt.clean(r.j.title) },
      { label: 'Where', get: (r) => place(r.j) },
      { label: 'Finished', get: (r) => longDate(r.j.completedAt) + (fmt.daysSince(r.j.completedAt) <= RECENT ? ' (new)' : '') },
      { label: 'Jobber', get: (r) => r.j.jobberWebUri ? ui.extLink(r.j.jobberWebUri, 'Open') : '' }
    ], rows, { summary: 'All ' + rows.length + ' jobs under warranty as a list' }));
    out.push(ui.how(
      'Every finished job in Jobber, archived or waiting on an invoice, with a finish date in the last year.',
      'Warranty is taken as 1 year from the finish date. Tell Flowzyn if yours is different and the dates will change.',
      'Jobs whose warranty ends in the next ' + SOON + ' days come first. Queued emails go out from your email on the next run. Nothing goes out unless you queue it.'));
    return out;
  }
});
