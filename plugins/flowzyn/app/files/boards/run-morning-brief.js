// Morning Brief: one page the owner reads in under 3 minutes. Decisions first, then wins from the last 7 days.
FZ.board('morning-brief', {
  source: 'Quotes, jobs, invoices, enquiries and visits: Jobber, live.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const { h } = ui;
    const RULES = { reminderDays: 5, winDays: 7, lookbackDays: 180 };

    const [waiting, approved, converted, unscheduled, toBill, overdue, fresh, late, today, paid] = await Promise.all([
      ctx.jobberAll('search_quotes', { status: 'awaiting_response', limit: 100 }, 'quotes', 300),
      ctx.jobberAll('search_quotes', { status: 'approved', limit: 100 }, 'quotes', 200),
      ctx.jobberAll('search_quotes', { status: 'converted', dateRange: { after: fmt.isoDaysAgo(RULES.lookbackDays) }, limit: 100 }, 'quotes', 200),
      ctx.jobberAll('search_jobs', { status: 'unscheduled', limit: 50 }, 'jobs', 150),
      ctx.jobberAll('search_jobs', { status: 'requires_invoicing', limit: 50 }, 'jobs', 150),
      ctx.jobberAll('search_invoices', { status: 'past_due', limit: 50 }, 'invoices', 150),
      ctx.jobberAll('search_requests', { status: 'new', sort: 'oldestCreatedAt', limit: 50 }, 'requests', 150),
      ctx.jobberAll('search_requests', { status: 'overdue', sort: 'oldestCreatedAt', limit: 50 }, 'requests', 150),
      ctx.jobberAll('search_visits', { status: 'today', sort: 'startAt', limit: 50 }, 'visits', 100),
      ctx.jobberAll('search_invoices', { status: 'paid', sort: 'createdAt', limit: 50 }, 'invoices', 150)
    ]);

    const name = (x) => fmt.clean(x && x.client && x.client.name) || 'Customer';
    const val = (n) => Number(n) || 0;
    const sum = (list, f) => list.reduce((s, x) => s + val(f(x)), 0);
    const biggest = (list, f) => list.slice().sort((a, b) => val(f(b)) - val(f(a)))[0];

    // Each decision: one line, linked to the board that handles it and to the top item in Jobber.
    const chase = waiting.filter((q) => (fmt.daysSince(q.sentAt || q.createdAt) || 0) > RULES.reminderDays);
    const book = [...approved.map((q) => ({ kind: 'quote', x: q, amt: q.total, at: q.approvedAt })), ...unscheduled.map((j) => ({ kind: 'job', x: j, amt: j.total, at: j.createdAt }))];
    const enquiries = [...new Map([...late, ...fresh].map((r) => [r.id, r])).values()].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    const lines = [];
    if (chase.length) { const t = biggest(chase, (q) => q.total); lines.push({ key: 'quote-chaser', n: chase.length, what: fmt.plural(chase.length, 'quote') + ' to follow up', dollars: sum(chase, (q) => q.total), top: name(t) + ', ' + fmt.money(t.total) + ', sent ' + fmt.plural(fmt.daysSince(t.sentAt || t.createdAt), 'day') + ' ago', link: t.jobberWebUri }); }
    if (book.length) { const t = biggest(book, (b) => b.amt); lines.push({ key: 'yes-to-install', n: book.length, what: fmt.plural(book.length, 'yes', 'yeses') + ' not booked yet', dollars: sum(book, (b) => b.amt), top: name(t.x) + ', ' + fmt.money(t.amt) + (t.kind === 'quote' ? ', quote approved' : ', job with no date'), link: t.x.jobberWebUri }); }
    if (toBill.length) { const t = biggest(toBill, (j) => j.total); lines.push({ key: 'bill-it', n: toBill.length, what: fmt.plural(toBill.length, 'job') + ' done, not invoiced', dollars: sum(toBill, (j) => j.total), top: name(t) + ', ' + fmt.money(t.total) + (t.completedAt ? ', done ' + fmt.fmtDate(t.completedAt) : ''), link: t.jobberWebUri }); }
    if (overdue.length) { const t = biggest(overdue, (i) => i.balance); lines.push({ key: 'get-paid', n: overdue.length, what: fmt.plural(overdue.length, 'invoice') + ' past due', dollars: sum(overdue, (i) => i.balance), top: name(t) + ', ' + fmt.money(t.balance) + ', due ' + fmt.fmtDate(t.dueDate), link: t.jobberWebUri }); }
    lines.sort((a, b) => b.dollars - a.dollars);
    if (enquiries.length) { const t = enquiries[0]; lines.push({ key: 'lead-catcher', n: enquiries.length, what: fmt.plural(enquiries.length, 'new enquiry', 'new enquiries') + ' to answer', top: 'Oldest: ' + name(t) + ', ' + fmt.clean(t.title).toLowerCase() + ', ' + fmt.plural(fmt.daysSince(t.createdAt), 'day') + ' waiting', link: t.jobberWebUri }); }
    if (today.length) { const crews = new Set(today.flatMap((v) => (v.assignedUsers || []).map((u) => fmt.clean(u.name)))); lines.push({ key: 'week-board', info: true, n: today.length, what: fmt.plural(today.length, 'visit') + ' on today', top: today.slice(0, 3).map((v) => fmt.clean(String(v.title).split(' - ')[0])).join(', ') + (crews.size ? ' with ' + fmt.plural(crews.size, 'crew member') : ''), link: today[0].job && today[0].job.jobberWebUri }); }

    const need = lines.filter((l) => !l.info);
    const nItems = need.reduce((s, l) => s + l.n, 0);
    const dollars = need.reduce((s, l) => s + (l.dollars || 0), 0);

    // Wins: quotes approved or converted, invoices paid, last 7 days.
    const inWin = (iso) => iso && fmt.daysSince(iso) <= RULES.winDays;
    const won = [...approved, ...converted].filter((q) => inWin(q.approvedAt)).sort((a, b) => val(b.total) - val(a.total));
    const paidWeek = paid.filter((i) => inWin(i.updatedAt)).sort((a, b) => val(b.total) - val(a.total));

    ctx.metric('morning-brief', need.length
      ? { value: fmt.plural(nItems, 'thing') + ' need you today', detail: fmt.money(dollars, { short: true }) + ' waiting' }
      : { value: 'Nothing needs you today', detail: '' });

    // Today's decisions: the same few as the Overview, with the buttons right here. No hopping to other agents.
    const all = FZ.buildTasks ? await FZ.buildTasks(ctx).catch(() => []) : [];
    const doneMap = (FZ.tasksNow && FZ.tasksNow().done) || {};
    const { mine, rest } = FZ.ownerPicks(all, doneMap, 5);

    const K = FZ.kit;
    const out = [];
    const short = (n) => fmt.money(n, { short: true });
    const run = FZ.runs && FZ.runs['morning-brief'];
    const ranAt = run && run.last && fmt.dayKey(run.last) === fmt.dayKey(new Date().toISOString()) && !/error/i.test(run.lastStatus || '') ? fmt.fmtTime(run.last) : null;
    const goWork = (needle) => () => {
      const tab = document.querySelector('#fz-board .fz-subtabs [data-id="work"]'); if (tab) tab.click();
      setTimeout(() => { const el = [...document.querySelectorAll('#fz-board .fz-tabbody[data-id="work"] .tp-row')].find((c) => c.textContent.includes(needle)); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
    };
    const btn = (label, fn) => h('button', { type: 'button', class: 'fz-btn act mb-go', onclick: fn }, label);
    const CSS = h('style', null, '.fz-btn.mb-go{background:var(--accent)!important;color:var(--on-accent,#111)!important}.fz-status.mb-good b{color:var(--ok-fg,#22c55e)}.mb-fun .fz-funnel{min-height:200px}.mb-fun .fz-step .val{font-size:17px}.mb-note{margin:16px 0 0;padding-left:12px;border-left:2px solid var(--accent);font-size:13px;color:var(--fg)}');

    // Money waiting at each step of the money path, left to right.
    const step = (k) => need.find((l) => l.key === k);
    const path = [['quote-chaser', 'Quoted, no answer'], ['yes-to-install', 'Said yes, not booked'], ['bill-it', 'Job finished, no invoice'], ['get-paid', 'Invoiced, past due']]
      .map(([k, label]) => { const l = step(k); return { label: label + (l ? ' · ' + l.n : ''), value: l ? l.dollars || 0 : 0 }; });
    const stuck = path.reduce((a, b) => (b.value > a.value ? b : a), path[0]);
    const pathTotal = path.reduce((n, p) => n + p.value, 0);
    // Under the bars: what is in each step, each one linked to Jobber.
    const row = (who, amt, when, link) => h('li', null, link ? ui.extLink(link, who, 'fz-tlink') : who, h('span', null, fmt.money(amt) + (when ? ' · ' + when : '')));
    const STEPS = [
      { label: 'Quoted, no answer', what: 'Quotes sent more than ' + RULES.reminderDays + ' days ago with no reply. Chase Quotes writes each follow up.', items: chase.slice().sort((a, b) => val(b.total) - val(a.total)).map((q) => row(name(q) + ' · quote #' + q.quoteNumber, q.total, 'sent ' + fmt.plural(fmt.daysSince(q.sentAt || q.createdAt), 'day') + ' ago', q.jobberWebUri)) },
      { label: 'Said yes, not booked', what: 'Approved quotes, and jobs with no date yet. Book Jobs orders the glass and books each one.', items: book.slice().sort((a, b) => val(b.amt) - val(a.amt)).map((b) => row(name(b.x) + (b.kind === 'quote' ? ' · quote #' + b.x.quoteNumber : ' · job #' + b.x.jobNumber), b.amt, b.kind === 'quote' ? 'approved ' + fmt.fmtDate(b.at) : 'no date set', b.x.jobberWebUri)) },
      { label: 'Job finished, no invoice', what: 'Work is done in Jobber but no invoice has gone out. Send Invoices gets each one ready.', items: toBill.slice().sort((a, b) => val(b.total) - val(a.total)).map((j) => row(name(j) + ' · job #' + j.jobNumber, j.total, j.completedAt ? 'finished ' + fmt.fmtDate(j.completedAt) : '', j.jobberWebUri)) },
      { label: 'Invoiced, past due', what: 'Invoices past their due date with money still owed. Collect Payments writes each reminder.', items: overdue.slice().sort((a, b) => val(b.balance) - val(a.balance)).map((i) => row(name(i) + ' · invoice #' + i.invoiceNumber, i.balance, 'due ' + fmt.fmtDate(i.dueDate), i.jobberWebUri)) }
    ].filter((x) => x.items.length);
    const stepLists = STEPS.length ? h('div', { class: 'mb-steps' }, STEPS.map((x) => h('details', { class: 'mb-step' },
      h('summary', null, h('b', null, x.label), h('span', null, fmt.plural(x.items.length, 'item') + ', see them')),
      h('p', { class: 'mb-what' }, x.what), h('ul', null, x.items.slice(0, 12)), x.items.length > 12 ? h('p', { class: 'mb-what' }, (x.items.length - 12) + ' more in Jobber') : null)),
      h('style', null, '.mb-steps{margin-top:16px;border-top:1px solid var(--line)}.mb-step{border-bottom:1px solid var(--line)}.mb-step summary{display:flex;justify-content:space-between;gap:12px;padding:10px 0;cursor:pointer;list-style:none;font-size:14px}.mb-step summary::-webkit-details-marker{display:none}.mb-step summary span{color:var(--muted);font-size:13px;text-decoration:underline;text-underline-offset:3px}.mb-step .mb-what{font-size:13px;color:var(--muted);margin:0 0 8px}.mb-step ul{list-style:none;margin:0 0 12px;padding:0}.mb-step li{display:flex;justify-content:space-between;gap:12px;padding:6px 0;font-size:13px;border-top:1px solid var(--line)}.mb-step li span{color:var(--muted);white-space:nowrap}')) : null;
    const fun = (steps) => h('div', { class: 'mb-fun' }, ui.funnel(steps), stepLists);
    const wonD = sum(won, (q) => q.total), paidD = sum(paidWeek, (i) => i.total);
    const winsLine = won.length || paidWeek.length ? 'This week: ' + [won.length ? short(wonD) + ' in quotes said yes' : '', paidWeek.length ? short(paidD) + ' in invoices paid' : ''].filter(Boolean).join(', ') + '.' : null;
    const field = lines.find((l) => l.info);
    const enq = step('lead-catcher');

    const picks = mine.slice().sort((a, b) => (b.dollars || 0) - (a.dollars || 0)).slice(0, 3);
    const mineD = mine.reduce((n, t) => n + (Number(t.dollars) || 0), 0);

    if (!mine.length && !pathTotal) {
      const st = ui.status(['Nothing needs you today. ', { b: 'Your agents have it.' }]);
      st.classList.add('mb-good');
      out.push(st, K.how(h, 'Every morning it reads Jobber and puts the few things that need your OK on one page, biggest first.'));
      const ex = [['Quoted, waiting · 6', 18400], ['Said yes, not booked · 2', 7900], ['Done, not invoiced · 3', 5200], ['Invoiced, overdue · 2', 3100]];
      out.push(K.quiet(h,
        K.checked(h, 'Your money path checked in Jobber', [
          waiting.length ? fmt.plural(waiting.length, 'open quote') + (chase.length ? '' : ', none past Jobber’s reminders') : 'No quotes waiting on a customer',
          book.length ? null : 'Every yes is booked',
          toBill.length ? null : 'Every finished job is invoiced',
          overdue.length ? null : 'No invoice past due',
          today.length ? fmt.plural(today.length, 'visit') + ' on today' : null,
          winsLine
        ]),
        K.example(h, 'Most money waits at the quote', fun(ex.map(([label, value], i) => ({ label, value, display: short(value), hi: i === 0 }))))));
      out.push(CSS);
    } else {
      out.push(ui.status(mine.length
        ? [(mineD ? short(mineD) : fmt.plural(mine.length, 'thing')) + ' waiting on your OK. ', { b: fmt.plural(mine.length, 'approval') + ' and your day is clear.' }]
        : [short(pathTotal) + ' waiting along your money path. ', { b: 'Your agents are on all of it.' }]));
      out.push(K.how(h, 'Every morning it reads Jobber and puts the few things that need your OK on one page, biggest first. Your agents work the rest.'));
      out.push(K.hero(h, {
        eyebrow: 'Your money path today',
        title: [short(pathTotal) + ' waiting. Most is stuck at ', { b: stuck.label.split(' · ')[0].toLowerCase() }],
        sub: 'Each bar is money waiting at one step, from quote to paid.',
        viz: h('div', null, fun(path.map((p) => ({ label: p.label, value: p.value, display: short(p.value), hi: p === stuck && p.value > 0 }))),
          winsLine || enq || field ? h('p', { class: 'mb-note' }, [winsLine, enq ? enq.what + '.' : null, field ? field.what + ': ' + field.top + '.' : null].filter(Boolean).join(' ')) : null),
        did: [
          { t: 'Read Jobber: quotes, jobs, invoices, enquiries', s: ranAt ? 'Brief ran ' + ranAt : 'Live from Jobber' },
          { t: 'Found ' + fmt.plural(nItems, 'thing') + ' along the money path', s: short(dollars) + ' in total' },
          mine.length ? { t: 'Picked ' + mine.length + ' for your OK, biggest first' } : null,
          rest ? { t: 'Left ' + rest + ' more with your agents' } : null,
          { t: 'Next: tomorrow’s brief, first thing in the morning', done: false }
        ].filter(Boolean)
      }));
      if (picks.length) {
        const agentName = (k) => (FZ.byKey(k) || {}).name || 'Agent';
        out.push(K.needs(h, {
          title: picks.length === 1 ? 'The one approval today' : 'The ' + picks.length + ' biggest approvals, biggest first',
          items: picks.map((t) => ({
            meta: t.dollars ? [{ b: short(t.dollars) }, ' · ' + agentName(t.agent)] : agentName(t.agent),
            title: t.review || t.title,
            detail: t.meta || null,
            actions: [btn(t.approve || 'Review', goWork(t.review || t.title)), t.link ? ui.extLink(t.link, 'Open in Jobber', 'fz-tlink') : null].filter(Boolean)
          })),
          rest: { count: (mine.length - picks.length) + (rest || 0), label: 'your agents are working through on their own' }
        }));
        // Work tab: every approval, with the buttons.
        const parts = FZ.renderTaskPanel(ctx, mine, doneMap, FZ.saveTask).filter(Boolean);
        const rowsEl = parts.find((x) => x.classList && x.classList.contains('tp-list'));
        out.push(ui.section('Ready for your OK, biggest first', 'Your agents prepared these. Approve and they go out today.', h('div', { class: 'tk-page' }, rowsEl)));
      }
      out.push(CSS);
    }

    // Loose ends: things promised on finished work that never became a quote, like the mirror after the shower job.
    const A = FZ.act;
    const LOOSE = /re-?measure|need(?:s)? (?:to be )?measur|when ready|\btbd\b|to follow|follow up|come back|later/i;
    const [measured, recentYes] = await Promise.all([
      ctx.jobberAll('search_requests', { status: 'assessment_completed', limit: 50 }, 'requests', 100).catch(() => []),
      ctx.jobberAll('search_quotes', { dateRange: { after: fmt.isoDaysAgo(120) }, sort: 'createdAt', limit: 50 }, 'quotes', 100).catch(() => [])
    ]);
    const yesQ = recentYes.filter((q) => ['approved', 'converted'].includes(q.status)).slice(0, 25);
    const qd = (await ctx.pool(yesQ, 4, (q) => ctx.jobber('get_quote', { quoteId: q.id }))).map((d) => d && d.quote).filter(Boolean);
    const loose = [];
    qd.forEach((q) => (q.lineItems || []).forEach((l) => {
      const t = fmt.clean((l.name || '') + ' ' + (l.description || ''));
      if (LOOSE.test(t)) loose.push({ id: 'le-' + q.id.replace(/[^A-Za-z0-9]/g, '').slice(-24) + '-' + fmt.clean(l.name || '').replace(/[^A-Za-z0-9]/g, '').slice(0, 16), who: fmt.clean(q.client && q.client.name) || 'Customer', what: fmt.clean(l.name || 'Item'), why: 'On quote #' + q.quoteNumber + ': ' + (t.length > 140 ? t.slice(0, 140).replace(/\s\S*$/, '') + '…' : t), clientId: q.client && q.client.id, requestId: q.request && q.request.id, link: q.jobberWebUri });
    }));
    measured.filter((r) => (fmt.daysSince(r.updatedAt || r.createdAt) || 0) > 2).forEach((r) => loose.push({ id: 'le-' + r.id.replace(/[^A-Za-z0-9]/g, '').slice(-24), who: name(r), what: fmt.clean(r.title || 'Measure'), why: 'Measured ' + fmt.plural(fmt.daysSince(r.updatedAt || r.createdAt), 'day') + ' ago, no quote yet. Draft Quotes can draft it.', link: r.jobberWebUri, measuredOnly: true }));
    const rem = A ? await A.reminders() : [];
    const due = rem.filter((r) => new Date(r.dueAt) <= new Date());
    const doneL = (FZ.tasksNow && FZ.tasksNow().done) || {};
    const snoozed = new Set(rem.filter((r) => new Date(r.dueAt) > new Date()).map((r) => r.id));
    const openLoose = loose.filter((x) => !(doneL[x.id] && doneL[x.id].done) && !snoozed.has(x.id) && !due.some((d) => d.id === x.id));
    const leCard = (x, isDue) => {
      const msg = h('p', { class: 'fz-hint', role: 'status' });
      const d = h('input', { type: 'date', value: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10), 'aria-label': 'Remind me on' });
      const rBtn = h('button', { type: 'button', class: 'fz-btn sm' }, 'Remind me');
      rBtn.addEventListener('click', async () => { rBtn.disabled = true; msg.textContent = (await A.remind(x.id, { title: x.who + ': ' + x.what, detail: x.why, link: x.link, dueAt: d.value + 'T13:00:00Z' })) ? 'Back in your brief on ' + fmt.fmtDate(d.value + 'T13:00:00Z') + '.' : 'Could not save.'; });
      const doneBtn = h('button', { type: 'button', class: 'fz-btn sm' }, 'Done');
      doneBtn.addEventListener('click', async () => { doneBtn.disabled = true; if (isDue) await A.clearReminder(x.id); await FZ.saveTask(x.id, true); doneBtn.closest('.fz-card').classList.add('is-handled'); msg.textContent = 'Off your list.'; });
      const reqBtn = x.clientId ? h('button', { type: 'button', class: 'fz-btn act' }, 'Turn into a request') : null;
      if (reqBtn) reqBtn.addEventListener('click', async () => {
        reqBtn.disabled = true; msg.textContent = 'Adding it to Jobber…';
        try { let pid = x.requestId ? await A.propertyOfRequest(x.requestId) : null; if (!pid) { const props = await A.propertiesOf(x.clientId); if (props.length !== 1) throw new Error(props.length ? 'this customer has more than one address, so open it in Jobber and add it there' : 'no address on file for this customer'); pid = props[0].id; } const r = await A.createRequest({ clientId: x.clientId, propertyId: pid, title: x.what + ' (follow up)' }); await FZ.saveTask(x.id, true); const link = A.requestLink(r); msg.replaceChildren('Done. It is a request in Jobber now. ', link ? ui.extLink(link, 'Open it', 'fz-tlink') : ''); }
        catch (e) { reqBtn.disabled = false; msg.textContent = 'Jobber did not take it: ' + (e && e.message || 'try again') + '.'; }
      });
      return h('article', { class: 'fz-card' + (isDue ? ' flag' : '') },
        h('div', { class: 'fz-card-top' }, h('span', { class: 'when' }, isDue ? 'Reminder for today' : 'Loose end')),
        h('span', { class: 'who' }, x.who), h('span', { class: 'why' }, x.what + '. ' + (x.why || x.detail || '')),
        h('div', { class: 'sa-inline' }, reqBtn, x.measuredOnly ? ui.extLink('#a-quote-prep', 'Draft the quote', 'fz-btn act') : null, d, rBtn, doneBtn, x.link ? ui.extLink(x.link, 'Open in Jobber', 'fz-tlink') : null), msg);
    };
    const dueCards = due.map((r) => { const x = loose.find((l) => l.id === r.id) || { id: r.id, who: r.title.split(': ')[0], what: r.title.split(': ').slice(1).join(': ') || r.title, detail: r.detail, link: r.link }; return leCard(x, true); });
    if (dueCards.length || openLoose.length) out.push(ui.section('Loose ends', 'Promised on finished work and not quoted yet, plus anything you asked to be reminded about', h('div', { class: 'fz-cards' }, ...dueCards, ...openLoose.slice(0, 6).map((x) => leCard(x, false)))));
    out.push(ui.how('Decisions come straight from Jobber this morning, biggest first. Calls and checks come before emails. Anything you hand over goes to your Operator.',
      'Quotes to follow up are waiting more than ' + RULES.reminderDays + ' days since sent, past Jobber’s own reminders. Yeses not booked are approved quotes plus jobs with no date.',
      'Done not invoiced are jobs Jobber marks as needing an invoice. Past due invoices count their unpaid balance.',
      'Wins count quotes approved in the last ' + RULES.winDays + ' days and invoices marked paid in that time.'));
    return out;
  }
});
