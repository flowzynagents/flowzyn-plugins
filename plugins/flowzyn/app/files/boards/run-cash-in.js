// 30 Day Cash In: money expected in the next 30 days from unpaid invoices and outstanding deposits.
FZ.board('cash-in', {
  source: 'Invoices and quote deposits: Jobber, live.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const { h } = ui;
    const DAYS = 30;
    const now = Date.now();
    const [notDue, awaiting, pastDue, approved] = await Promise.all([
      ctx.jobberAll('search_invoices', { status: 'sent_not_due', sort: 'dueDate', limit: 50 }, 'invoices', 200),
      ctx.jobberAll('search_invoices', { status: 'awaiting_payment', sort: 'dueDate', limit: 50 }, 'invoices', 200),
      ctx.jobberAll('search_invoices', { status: 'past_due', sort: 'dueDate', limit: 50 }, 'invoices', 200),
      ctx.jobberAll('search_quotes', { status: 'approved', limit: 100 }, 'quotes', 100)
    ]);

    // Deposits: biggest approved quotes first, capped detail calls.
    const top = approved.slice().sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0)).slice(0, 25);
    const det = await ctx.pool(top, 4, (q) => ctx.jobber('get_quote', { quoteId: q.id }));

    const items = [];
    const seen = new Set();
    [...pastDue, ...awaiting, ...notDue].forEach((v) => {
      if (seen.has(v.id)) return; seen.add(v.id);
      const amt = Number(v.balance != null ? v.balance : (Number(v.total) || 0) - (Number(v.paid) || 0)) || 0;
      if (amt <= 0) return;
      const dueT = v.dueDate ? Date.parse(v.dueDate) : now;
      const late = v.status === 'past_due' || dueT < now;
      const inDays = late ? 0 : Math.max(0, Math.ceil((dueT - now) / 86400000));
      if (inDays > DAYS) return;
      items.push({ kind: 'Invoice', id: v.id, num: v.invoiceNumber, who: fmt.clean(v.client && v.client.name), what: fmt.clean(v.subject), amount: amt, inDays, late, due: v.dueDate, lateDays: late && v.dueDate ? Math.max(0, fmt.daysSince(v.dueDate)) : 0, link: v.jobberWebUri });
    });
    top.forEach((q, i) => {
      const d = det[i] && det[i].quote;
      const owed = d && d.amounts ? Number(d.amounts.outstandingDepositAmount) || 0 : 0;
      if (owed <= 0) return;
      items.push({ kind: 'Deposit', id: q.id, num: q.quoteNumber, who: fmt.clean(q.client && q.client.name), what: fmt.clean(q.title), amount: owed, inDays: 0, late: false, deposit: true, approvedAt: q.approvedAt, hub: d.clientHubUri, link: q.jobberWebUri });
    });

    const total = items.reduce((s, x) => s + x.amount, 0);
    const dueNow = items.filter((x) => x.inDays === 0);
    const dueNowSum = dueNow.reduce((s, x) => s + x.amount, 0);

    ctx.metric('cash-in', { value: fmt.money(total, { short: true }) + ' due in 30 days', detail: fmt.money(dueNowSum, { short: true }) + ' of it is due now' });

    const out = [];
    out.push(ui.status(items.length
      ? [{ b: fmt.money(total, { short: true }) }, ' due in the next 30 days.']
      : ['Nothing is due in the next 30 days.']));
    if (!items.length) {
      out.push(ui.calm('No unpaid invoices or deposits are waiting. Nice.'));
      return out;
    }

    // Cards: what is due now, biggest first.
    const cards = dueNow.slice().sort((a, b) => b.amount - a.amount).map((x) => {
      const card = {
        when: x.deposit ? 'Deposit · approved ' + (x.approvedAt ? fmt.fmtDate(x.approvedAt) : '') : 'Invoice ' + x.num + ' · ' + (x.lateDays ? fmt.plural(x.lateDays, 'day') + ' past due' : 'due now'),
        who: x.who, amount: x.amount, link: x.link,
        why: x.deposit ? 'Deposit on the ' + x.what.toLowerCase() + ' quote is still open.' : (x.lateDays > 30 ? 'Worth a call this week.' : 'Worth a friendly nudge.')
      };
      if (x.deposit) {
        card.draft = 'Hi ' + fmt.firstName(x.who) + ', it is ' + FZ.me().first + ' at ' + FZ.biz() + '. Thanks again for saying yes on your ' + x.what.toLowerCase() + '. Once the deposit of ' + fmt.money(x.amount) + ' is in, we order your glass and get you on the schedule.' + (x.hub ? ' You can pay it here: ' + x.hub : '') + '\n\n' + FZ.sign();
        card.draftLabel = 'Draft a deposit note';
      }
      return card;
    });
    out.push(ui.section('Due now', fmt.money(dueNowSum) + ' from ' + fmt.plural(dueNow.length, 'invoice or deposit', 'invoices and deposits'), ui.cards(cards, { max: 4 })));

    // Glance: by week.
    const weeks = [
      { label: 'Due now', test: (x) => x.inDays === 0, hi: true },
      { from: 1, to: 7 }, { from: 8, to: 14 }, { from: 15, to: 21 }, { from: 22, to: 30 }
    ].map((w) => {
      const test = w.test || ((x) => x.inDays >= w.from && x.inDays <= w.to);
      const list = items.filter(test);
      const sum = list.reduce((s, x) => s + x.amount, 0);
      const label = w.label || ('By ' + fmt.fmtDate(fmt.isoDaysAhead(w.to)));
      return { label, value: sum, hi: w.hi, display: fmt.money(sum, { short: true }) + ' · ' + list.length };
    });
    out.push(ui.section('Money coming in by week', 'Dollars due each week, then how many invoices or deposits', ui.bars(weeks)));

    out.push(ui.table([
      { label: 'Due', get: (x) => x.inDays === 0 ? ui.pill('Now', x.lateDays ? 'hot' : null) : fmt.fmtDay(x.due) },
      { label: 'Customer', get: (x) => x.who },
      { label: 'What', get: (x) => x.kind + ' ' + x.num + (x.what ? ', ' + x.what : '') },
      { label: 'Amount', num: true, get: (x) => fmt.money(x.amount) },
      { label: 'Jobber', get: (x) => x.link ? ui.extLink(x.link, 'Open') : '' }
    ], items.slice().sort((a, b) => a.inDays - b.inDays || b.amount - a.amount), { summary: 'All ' + items.length + ' as a list' }));
    out.push(ui.note('Payments recorded in QuickBooks will show here once QuickBooks is connected, so paid invoices drop off the list sooner.'));
    out.push(ui.how('Counts every unpaid Jobber invoice (sent, awaiting payment or past due) with a due date in the next ' + DAYS + ' days, using the balance still owed.',
      'Past due invoices and invoices whose due date has passed count as due now.',
      'Deposits still owed on approved quotes count as due now. The ' + Math.min(25, approved.length) + ' biggest approved quotes are checked.'));
    return out;
  }
});
