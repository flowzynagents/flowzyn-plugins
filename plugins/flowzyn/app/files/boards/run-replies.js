// Replies: customers who asked for changes or said yes, so someone answers or books them the same day.
FZ.board('replies', {
  source: 'Quotes: Jobber, live.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const RULES = { yesDays: 14, maxDetail: 25 };

    const [changes, approved] = await Promise.all([
      ctx.jobberAll('search_quotes', { status: 'changes_requested', limit: 100 }, 'quotes', 200),
      ctx.jobberAll('search_quotes', { status: 'approved', limit: 100 }, 'quotes', 200)
    ]);
    const yes = approved.filter((q) => q.approvedAt && fmt.daysSince(q.approvedAt) <= RULES.yesDays);

    // get_quote gives the exact time changes were asked for, and confirms no job yet.
    const both = [...changes, ...yes].slice(0, RULES.maxDetail);
    const det = await ctx.pool(both, 4, (q) => ctx.jobber('get_quote', { quoteId: q.id }));
    const detail = new Map(both.map((q, i) => [q.id, det[i] && det[i].quote]));

    const row = (q, kind) => {
      const d = detail.get(q.id) || {};
      const lt = d.lastTransitioned || {};
      const at = kind === 'changes' ? (lt.changesRequestedAt || q.updatedAt) : (lt.approvedAt || q.approvedAt);
      return { q, kind, at, days: fmt.daysSince(at) || 0, who: fmt.clean(q.client && q.client.name) || 'Customer', title: fmt.clean(q.title) || 'Quote', total: Number(q.total) || 0, booked: (d.convertedJobIds || []).length > 0 };
    };
    const rows = [
      ...changes.map((q) => row(q, 'changes')),
      ...yes.map((q) => row(q, 'yes')).filter((r) => !r.booked)
    ].sort((a, b) => b.days - a.days || b.total - a.total);
    const nChanges = rows.filter((r) => r.kind === 'changes').length;
    const nYes = rows.length - nChanges;
    const sum = rows.reduce((s, r) => s + r.total, 0);
    const ago = (r) => r.days === 0 ? 'today' : r.days === 1 ? 'yesterday' : fmt.plural(r.days, 'day') + ' ago';

    ctx.metric('replies', rows.length
      ? { value: fmt.plural(rows.length, 'customer') + ' to answer', detail: [nChanges ? nChanges + ' asked for changes' : '', nYes ? nYes + ' said yes' : ''].filter(Boolean).join(', ') + ', ' + fmt.money(sum, { short: true }) }
      : { value: 'Everyone answered', detail: '' });

    const out = [];
    const parts = [];
    if (nChanges) parts.push({ b: String(nChanges) }, nChanges === 1 ? ' customer asked for changes' : ' customers asked for changes');
    if (nChanges && nYes) parts.push(' and ');
    if (nYes) parts.push({ b: String(nYes) }, nYes === 1 ? ' said yes and is not booked' : ' said yes and are not booked');
    out.push(ui.status(rows.length ? [...parts, '. ', { b: fmt.money(sum, { short: true }) }, ' in quotes.'] : ['Nobody is waiting on an answer from you.']));

    const draft = (r) => {
      const n = fmt.firstName(r.who);
      return r.kind === 'changes'
        ? 'Hi ' + n + ', thanks for looking over the ' + r.title.toLowerCase() + ' quote. I saw you would like some changes. Tell me what you have in mind, or I can give you a quick call, and I will send an updated quote today.\n\n' + FZ.sign()
        : 'Hi ' + n + ', thank you for going ahead with the ' + r.title.toLowerCase() + '. Let’s get you on the calendar. Which days next week work best for you?\n\n' + FZ.sign();
    };
    if (rows.length) {
      out.push(ui.cards(rows.slice(0, 6).map((r) => ({
        when: (r.kind === 'changes' ? 'Asked for changes ' : 'Said yes ') + ago(r),
        who: r.who, amount: r.total,
        why: r.title + ', quote #' + r.q.quoteNumber + (r.kind === 'changes' ? '. Send an updated quote.' : '. Book the job.'),
        flag: r.days >= 1, link: r.q.jobberWebUri, linkLabel: 'Open in Jobber',
        clientId: r.q.client && r.q.client.id, draftSubject: 'Your ' + r.title.toLowerCase().replace(/\s*quote$/, '') + ' quote', draft: draft(r), draftLabel: r.kind === 'changes' ? 'See reply' : 'See booking note'
      }))));
      if (rows.length > 6) out.push(ui.h('p', { class: 'fz-more' }, (rows.length - 6) + ' more in the full list below.'));
      out.push(ui.table([
        { label: 'Customer', get: (r) => r.who },
        { label: 'Quote', get: (r) => '#' + r.q.quoteNumber + ' ' + r.title },
        { label: 'What happened', get: (r) => r.kind === 'changes' ? 'Asked for changes' : 'Said yes' },
        { label: 'When', get: (r) => r.at ? fmt.fmtDay(r.at) : '' },
        { label: 'Amount', num: true, get: (r) => fmt.money(r.total) },
        { label: 'Jobber', get: (r) => ui.extLink(r.q.jobberWebUri, 'Open') }
      ], rows, { summary: 'All ' + rows.length + ' as a list' }));
    } else {
      out.push(ui.calm('No changes asked for and every yes is booked. Nice.'));
    }

    out.push(ui.note('Customer emails about a quote show here, matched to the quote, once Gmail is connected.'));
    out.push(ui.how('Counts Jobber quotes where the customer asked for changes, and quotes approved in the last ' + RULES.yesDays + ' days that are not a job yet.',
      'Oldest first. Anything waiting since yesterday or before is flagged. The goal is an answer the same day.',
      'Queued emails go out from your email on the next run. Nothing goes out unless you queue it.'));
    return out;
  }
});
