// Bill It: finished jobs not invoiced yet, oldest first.
FZ.board('bill-it', {
  source: 'Jobs: Jobber, live.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const MAX_DETAIL = 25;
    const jobs = await ctx.jobberAll('search_jobs', { status: 'requires_invoicing', limit: 50 }, 'jobs', 200);
    const doneAt = (j) => j.completedAt || j.endAt || j.updatedAt;
    const rows = jobs.map((j) => ({ j, who: fmt.clean(j.client && j.client.name), done: doneAt(j), amount: Number(j.total) || 0, exact: false }))
      .sort((a, b) => new Date(a.done) - new Date(b.done));

    // Uninvoiced amount from the job detail, oldest first, capped.
    await ctx.pool(rows.slice(0, MAX_DETAIL), 4, async (r) => {
      const d = await ctx.jobber('get_job', { id: r.j.id });
      const a = d && d.job && d.job.amounts;
      if (a && a.uninvoicedTotal != null) { r.amount = Number(a.uninvoicedTotal) || 0; r.exact = true; r.invoiced = Number(a.invoicedTotal) || 0; }
    });
    rows.forEach((r) => { r.days = Math.max(0, fmt.daysSince(r.done) || 0); });
    const total = rows.reduce((s, r) => s + r.amount, 0);

    ctx.metric('bill-it', rows.length
      ? { value: fmt.money(total, { short: true }) + ' to invoice', detail: fmt.plural(rows.length, 'job') + ' done, oldest finished ' + fmt.fmtDate(rows[0].done) }
      : { value: 'All finished work is invoiced', detail: '' });

    const { h } = ui;
    const K = FZ.kit;
    const out = [];
    const short = (n) => fmt.money(n, { short: true });
    const run = FZ.runs && FZ.runs['bill-it'];
    const ranAt = run && run.last && fmt.dayKey(run.last) === fmt.dayKey(new Date().toISOString()) && !/error/i.test(run.lastStatus || '') ? fmt.fmtTime(run.last) : null;
    const goWork = (needle) => () => {
      const tab = document.querySelector('#fz-board .fz-subtabs [data-id="work"]'); if (tab) tab.click();
      setTimeout(() => { const el = [...document.querySelectorAll('#fz-board .fz-tabbody[data-id="work"] .fz-card')].find((c) => c.textContent.includes(needle)); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
    };
    const btn = (label, fn) => h('button', { type: 'button', class: 'fz-btn act bi-go', onclick: fn }, label);
    const css = h('style', null, '.fz-btn.bi-go{background:var(--accent)!important;color:var(--on-accent,#111)!important}.fz-status.bi-good b{color:var(--ok-fg,#22c55e)}');

    if (!rows.length) {
      const st = ui.status(['Every finished job is invoiced. ', { b: 'Nothing waiting on an invoice.' }]);
      st.classList.add('bi-good');
      out.push(st, K.how(h, 'It watches Jobber for finished jobs and has each invoice ready for your OK the same day.'));
      const DAY = 86400000;
      const exItems = [['Lakeview Condo', 'Install', 1, 4850], ['Bluebird Cabin', 'Repair', 0.5, 3200], ['Main Street Salon', 'Service call', 0.8, 1900], ['Pine Ridge HOA', 'Replacement', 2, 2600]];
      out.push(K.quiet(h,
        K.checked(h, 'Finished jobs checked in Jobber', ['No job is marked as needing an invoice', ranAt ? 'Last check ' + ranAt : 'Checked live from Jobber just now', 'New finished jobs get an invoice ready the same day']),
        K.example(h, 'Most invoices out inside a day', ui.waits(exItems.map(([who, sub, days, amount]) => ({ who: who + ' (example)', sub, days: Math.round(days), amount, act: h('span') })), { goal: 1, goalLabel: '1 day', ok: 'Inside a day', late: 'Waiting longer' }))));
      out.push(css);
      out.push(ui.how('Lists every job Jobber marks as needing an invoice, oldest finished first.'));
      return out;
    }
    const lateBill = rows.filter((r) => r.days > 1);
    const lateD = lateBill.reduce((n, r) => n + r.amount, 0);
    out.push(ui.status(lateBill.length
      ? [short(total) + ' in finished jobs to invoice. ', { b: short(lateD) + ' is past the 1 day goal.' }]
      : [short(total) + ' in finished jobs to invoice. ', { b: 'All inside the 1 day goal.' }]));
    out.push(K.how(h, 'It finds every finished job in Jobber, has the invoice ready for your OK, and flags any job done more than a day ago.'));

    const T = (FZ.tasksNow && FZ.tasksNow().done) || {};
    const okOf = (k) => 'ok-' + String(k || '').replace(/[^A-Za-z0-9]+/g, '-').slice(-80);
    const approved = rows.filter((r) => (T[okOf('invoice-' + r.j.id)] || {}).done).length;
    out.push(K.hero(h, {
      eyebrow: 'Finished, not invoiced',
      title: lateBill.length ? [fmt.plural(lateBill.length, 'job') + ' done ', { b: 'more than a day ago' }] : ['Every finished job is ', { b: 'inside the 1 day goal' }],
      sub: 'Each dot is a finished job, sized by what is left to invoice. The dashed line is the 1 day goal.',
      viz: ui.waits(rows.map((r) => ({ who: r.j.jobberWebUri ? ui.extLink(r.j.jobberWebUri, r.who, 'fz-tlink') : r.who, act: h('span'), sub: 'Job #' + r.j.jobNumber + ' ' + fmt.clean(r.j.title), days: r.days, amount: r.amount, link: r.j.jobberWebUri })),
        { goal: 1, goalLabel: '1 day', ok: 'Inside a day', late: 'Waiting longer' }),
      did: [
        { t: 'Checked Jobber for finished jobs', s: ranAt || 'Live from Jobber' },
        { t: 'Found ' + fmt.plural(rows.length, 'job') + ' done, not invoiced', s: short(total) + ' in total' },
        { t: 'Invoice ready for each one, biggest first' },
        approved ? { t: fmt.plural(approved, 'invoice') + ' approved by you' } : null,
        { t: 'Next: approved invoices are made and sent from Jobber', done: false }
      ].filter(Boolean)
    }));

    const byAmt = rows.slice().sort((a, b) => b.amount - a.amount);
    const picks = byAmt.slice(0, 3);
    const restRows = byAmt.slice(3);
    out.push(K.needs(h, {
      title: fmt.plural(picks.length, 'job') + ' to invoice, biggest first',
      items: picks.map((r) => ({
        meta: [{ b: short(r.amount) }, ' · Job #' + r.j.jobNumber + ' ' + fmt.clean(r.j.title)],
        title: r.who,
        detail: 'Finished ' + fmt.fmtDate(r.done) + ', ' + fmt.plural(r.days, 'day') + ' ago.' + (r.invoiced ? ' Part invoiced already.' : '') + ' Ready to invoice in Jobber.',
        actions: [btn('Invoice it', goWork('Job #' + r.j.jobNumber)), r.j.jobberWebUri ? ui.extLink(r.j.jobberWebUri, 'Open in Jobber', 'fz-tlink') : null].filter(Boolean)
      })),
      rest: { count: restRows.length, label: 'ready to invoice on the next tab', list: ui.table([
        { label: 'Customer', get: (r) => r.j.jobberWebUri ? ui.extLink(r.j.jobberWebUri, r.who, 'fz-tlink') : r.who },
        { label: 'Job', get: (r) => '#' + r.j.jobNumber + ' ' + fmt.clean(r.j.title) },
        { label: 'Finished', get: (r) => fmt.fmtDate(r.done) },
        { label: 'Days', num: true, get: (r) => String(r.days) },
        { label: 'To invoice', num: true, get: (r) => fmt.money(r.amount) + (r.exact ? '' : ' (job total)') }
      ], restRows, { open: true }) }
    }));
    out.push(css);

    // Work tab: one card per invoice, biggest first.
    out.push(ui.cards(byAmt.map((r) => ({
      when: 'Finished ' + fmt.fmtDate(r.done) + ' · ' + fmt.plural(r.days, 'day') + ' ago',
      who: r.who,
      why: fmt.clean(r.j.title) + ', Job #' + r.j.jobNumber + (r.invoiced ? '. Part invoiced already.' : '.'),
      amount: r.amount,
      flag: r.days > 1,
      link: r.j.jobberWebUri,
      linkLabel: 'Open in Jobber',
      agent: 'bill-it', queueId: 'invoice-' + r.j.id, approve: 'Invoiced in Jobber', approveWhat: 'invoice for job #' + r.j.jobNumber + ', ' + fmt.money(r.amount)
    })), { max: 50 }));
    out.push(ui.note(FZ.isOperator() ? 'Open the job in Jobber and press Create Invoice. Invoices are made in Jobber, not from this page.' : 'Open the job in Jobber, press Create Invoice, then Send. Come back and press Invoiced in Jobber so it drops off your list.'));

    out.push(ui.how('Lists every job Jobber marks as needing an invoice, oldest finished first.',
      'The amount is what is not invoiced yet on the job. For the oldest ' + MAX_DETAIL + ' jobs it comes from the job itself, past that it shows the job total.',
      'Finished more than a day ago shows in orange.'));
    return out;
  }
});
