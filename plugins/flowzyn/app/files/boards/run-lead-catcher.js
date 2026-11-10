// Lead Catcher: new enquiries in Jobber waiting for a reply or an assessment visit, oldest first.
FZ.board('lead-catcher', {
  source: 'Enquiries: Jobber requests, live.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const RULES = { replyHours: 24 };
    const STATUSES = ['new', 'overdue', 'today', 'unscheduled'];
    const LABEL = { new: 'New', overdue: 'Visit overdue', today: 'Visit today', unscheduled: 'No visit booked' };
    const BANDS = [
      { label: 'Under a day', min: 0, max: 0 },
      { label: '1 to 2 days', min: 1, max: 2 },
      { label: '3 to 7 days', min: 3, max: 7 },
      { label: 'Over a week', min: 8, max: Infinity }
    ];

    const lists = await Promise.all(STATUSES.map((s) => ctx.jobberAll('search_requests', { status: s, sort: 'oldestCreatedAt', limit: 50 }, 'requests', 150)));
    const [all90, quotes90] = await Promise.all([
      ctx.jobberAll('search_requests', { dateRange: { after: fmt.isoDaysAgo(90) }, limit: 100 }, 'requests', 400).catch(() => []),
      ctx.jobberAll('search_quotes', { dateRange: { after: fmt.isoDaysAgo(120) }, sort: 'createdAt', limit: 100 }, 'quotes', 400).catch(() => [])
    ]);
    const seen = new Set();
    const rows = [];
    lists.forEach((list, i) => list.forEach((r) => { if (seen.has(r.id)) return; seen.add(r.id); rows.push({ r, status: STATUSES[i] }); }));
    rows.forEach((x) => {
      x.hours = Math.max(0, Math.floor((Date.now() - new Date(x.r.createdAt).getTime()) / 3600000));
      x.days = Math.floor(x.hours / 24);
      x.who = fmt.clean(x.r.client && x.r.client.name) || 'New customer';
      x.title = fmt.clean(x.r.title) || 'Enquiry';
    });
    rows.sort((a, b) => new Date(a.r.createdAt) - new Date(b.r.createdAt));
    const waited = (x) => x.hours < 24 ? fmt.plural(Math.max(1, x.hours), 'hour') : fmt.plural(x.days, 'day');
    const place = (x) => { const a = x.r.property && x.r.property.address; return a ? fmt.clean([a.street1, a.city].filter(Boolean).join(', ')) : ''; };
    const late = rows.filter((x) => x.hours >= RULES.replyHours);

    ctx.metric('lead-catcher', rows.length
      ? { value: fmt.plural(rows.length, 'enquiry', 'enquiries') + ' waiting', detail: 'Oldest has waited ' + waited(rows[0]) }
      : { value: 'Every enquiry answered', detail: '' });

    const { h } = ui;
    const K = FZ.kit;
    const out = [];
    const run = FZ.runs && FZ.runs['lead-catcher'];
    const ranAt = run && run.last && fmt.dayKey(run.last) === fmt.dayKey(new Date().toISOString()) && !/error/i.test(run.lastStatus || '') ? fmt.fmtTime(run.last) : null;
    const goReply = (x) => () => { const tab = document.querySelector('#fz-board .fz-subtabs [data-id="work"]'); if (tab) tab.click(); setTimeout(() => { const el = document.querySelector('#fz-board [data-lead="' + x.r.id + '"]'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); };
    const btn = (label, fn) => h('button', { type: 'button', class: 'fz-btn act lc-go', onclick: fn }, label);
    const inn = all90.filter((r) => fmt.daysSince(r.createdAt) <= 90);
    const waitingIds = new Set(rows.map((x) => x.r.id));

    // Two weeks of enquiries, one box per day: how many came in, and how many are still waiting.
    const grid = (weeks, days) => h('div', { class: 'lc-wk n' + days.length },
      h('span'), ...days.map((d) => h('span', { class: 'lc-wd' }, d)),
      ...weeks.flatMap((w) => [h('span', { class: 'lc-wl' }, w.label), ...w.d.map((c) => h('div', { class: 'lc-wc' + (c.late ? ' late' : '') + (c.n ? '' : ' none') }, h('b', null, c.n ? String(c.n) : ''), h('span', null, c.s || '')))]));
    const D = 86400000;
    const dayKeyOf = (t) => fmt.dayKey(new Date(t).toISOString());
    const cells = Array.from({ length: 14 }, (_, i) => {
      const t = Date.now() - (13 - i) * D;
      const k = dayKeyOf(t);
      const list = inn.filter((r) => fmt.dayKey(r.createdAt) === k);
      const wait = list.filter((r) => waitingIds.has(r.id)).length;
      const late = rows.filter((x) => fmt.dayKey(x.r.createdAt) === k && x.hours >= RULES.replyHours).length;
      return { t, n: list.length, s: list.length ? (wait ? wait + ' waiting' : 'answered') : '', late: late > 0 };
    });
    const in14 = cells.reduce((n, c) => n + c.n, 0);
    const dayNames = cells.slice(7).map((c) => new Date(c.t).toLocaleDateString('en-US', { weekday: 'short', timeZone: fmt.TZ }));
    const realGrid = grid([{ label: 'Last wk', d: cells.slice(0, 7) }, { label: 'This wk', d: cells.slice(7) }], dayNames);
    const enough = in14 >= 6;

    const did = [
      { t: 'Checked Jobber for new enquiries', s: ranAt || 'Live from Jobber' },
      rows.length ? { t: 'Wrote a reply for each of ' + fmt.plural(rows.length, 'enquiry', 'enquiries') + ' waiting', s: 'Offers a free visit, or a look at the problem' } : { t: 'Every enquiry has a reply or a visit' },
      rows.length ? { t: 'Ranked them oldest first' } : null,
      { t: 'Next: queued replies go out from your email', done: false }
    ].filter(Boolean);

    if (rows.length) {
      out.push(ui.status([{ b: String(rows.length) }, rows.length === 1 ? ' enquiry is' : ' enquiries are', ' waiting. The oldest has waited ', { b: waited(rows[0]) }, '.']));
      out.push(K.how(h, 'It answers every new enquiry in Jobber inside the hour with a reply that offers a visit, so you win the job before a competitor does.'));
      out.push(K.hero(h, {
        eyebrow: 'Last 2 weeks',
        title: late.length ? [fmt.plural(in14, 'enquiry', 'enquiries') + ' in 2 weeks. ', { b: late.length + ' waiting past a day' }] : [fmt.plural(in14, 'enquiry', 'enquiries') + ' in 2 weeks, ', { b: 'all inside a day' }],
        sub: 'Each box is a day: enquiries in, and how many still need a reply.',
        viz: realGrid, did
      }));
      const picks = rows.slice(0, 3);
      const restRows = rows.slice(3);
      out.push(K.needs(h, {
        title: fmt.plural(picks.length, 'enquiry', 'enquiries') + ' to answer, oldest first',
        items: picks.map((x) => ({
          meta: [{ b: 'Waiting ' + waited(x) }, ' · ' + LABEL[x.status]],
          title: x.who,
          detail: fmt.clean(String(x.title).split(' - ')[0]) + (place(x) ? ', ' + place(x) : '') + '. The reply is written.',
          actions: [btn('Send reply', goReply(x)), x.r.jobberWebUri ? ui.extLink(x.r.jobberWebUri, 'Open in Jobber', 'fz-tlink') : null].filter(Boolean)
        })),
        rest: { count: restRows.length, label: 'with replies written, on the next tab', list: ui.table([
          { label: 'Came in', get: (x) => fmt.fmtDay(x.r.createdAt) },
          { label: 'Customer', get: (x) => x.r.jobberWebUri ? ui.extLink(x.r.jobberWebUri, x.who, 'fz-tlink') : x.who },
          { label: 'Asking about', get: (x) => x.title },
          { label: 'Waiting', num: true, get: (x) => waited(x) }
        ], restRows, { open: true }) }
      }));

      // Jobber titles often read "Request for adjustment - Name, address". Keep just the ask.
      const topic = (x) => fmt.clean(String(x.title).split(' - ')[0]).toLowerCase().replace(/^request for /, '');
      const isFix = (x) => /adjust|repair|fix|service|warranty|broken|leak|stuck/i.test(x.title);
      const street = (x) => place(x) ? fmt.clean(x.r.property.address.street1) : '';
      const draft = (x) => 'Hi ' + fmt.firstName(x.who) + ',\n\n' +
        (isFix(x)
          ? 'Thanks for letting us know' + (street(x) ? ' about ' + street(x) : '') + '. Sorry something needs looking at. I can come take a look, usually within a few days. What day this week or next works for you?'
          : 'Thanks for reaching out to ' + FZ.biz() + ' about ' + topic(x) + (street(x) ? ' at ' + street(x) : '') + '. The best next step is a quick visit so I can measure and see the space. It takes about half an hour and there is no charge. What day this week or next works for you?') +
        '\n\n' + FZ.sign();
      out.push(ui.cards(rows.map((x) => ({
        when: 'Waiting ' + waited(x) + ' · ' + LABEL[x.status],
        who: x.who,
        why: fmt.clean(String(x.title).split(' - ')[0]) + (place(x) ? ', ' + place(x) : '') + (x.r.client && x.r.client.phone ? '. ' + x.r.client.phone : ''),
        flag: x.hours >= RULES.replyHours, link: x.r.jobberWebUri, linkLabel: 'Open in Jobber',
        clientId: x.r.client && x.r.client.id, queueId: 'lead-' + x.r.id, leadId: x.r.id, draftSubject: isFix(x) ? 'Your ' + topic(x) + ' request' : 'Your request to ' + FZ.biz(), draft: draft(x), draftLabel: 'See reply'
      })), { max: 50 }));
    } else {
      const st = ui.status(inn.length ? ['Every enquiry in Jobber has a reply or a visit. ', { b: 'Nothing waiting.' }] : ['No new enquiries in Jobber right now. ', { b: 'Nothing waiting.' }]);
      st.classList.add('lc-good');
      out.push(st, K.how(h, 'It answers every new enquiry in Jobber inside the hour with a reply that offers a visit, so you win the job before a competitor does.'));
      if (enough) {
        out.push(K.hero(h, { eyebrow: 'Last 2 weeks', title: [fmt.plural(in14, 'enquiry', 'enquiries') + ' in 2 weeks, ', { b: 'none waiting' }], sub: 'Each box is a day: enquiries in, and how many still need a reply.', viz: realGrid, did }));
      } else {
        // Example: two weeks of enquiries, each day with how fast the reply went out. Made up, and labelled so.
        const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
        const EX = [[[2, 14], [1, 32], [3, 18], [1, 41], [2, 22]], [[3, 12], [2, 27], [1, 9], [2, 35], [1, 16]]];
        const total = EX.flat().reduce((n, x) => n + x[0], 0);
        out.push(K.quiet(h,
          K.checked(h, inn.length ? fmt.plural(inn.length, 'enquiry', 'enquiries') + ' checked in Jobber' : 'Jobber checked for enquiries', [
            inn.length ? 'Every one has a reply or a visit booked' : 'No enquiries in the last 90 days',
            in14 ? in14 + ' came in the last 2 weeks' : 'None in the last 2 weeks',
            'New ones get a reply drafted inside the hour'
          ]),
          K.example(h, total + ' enquiries, every one answered inside an hour', [h('p', { class: 'ag-sub' }, 'Each box is a day: enquiries in, and the slowest reply.'),
            grid([{ label: 'Week 1', d: EX[0].map(([n, m]) => ({ n, s: m + ' min' })) }, { label: 'Week 2', d: EX[1].map(([n, m]) => ({ n, s: m + ' min' })) }], DAYS)])));
      }
    }
    out.push(h('style', null, '.fz-btn.lc-go{background:var(--accent)!important;color:var(--on-accent,#111)!important}.fz-status.lc-good b{color:var(--ok-fg,#22c55e)}' +
      '.lc-wk{display:grid;grid-template-columns:64px repeat(7,minmax(0,1fr));gap:6px;}.lc-wk.n5{grid-template-columns:64px repeat(5,minmax(0,1fr))}.lc-wk{margin-top:6px;align-items:center}.lc-wd{font-size:12px;font-weight:600;text-align:center;color:var(--muted)}.lc-wl{font-size:12px;font-weight:600;color:var(--muted)}' +
      '.lc-wc{border:1px solid var(--line);border-radius:10px;padding:10px 4px;display:flex;flex-direction:column;align-items:center;gap:2px;background:var(--quiet,transparent);min-height:58px;justify-content:center;min-width:0}' +
      '.lc-wc.none{background:transparent;border-style:dashed}.lc-wc.late{border-color:var(--accent)}.lc-wc.late span{color:var(--accent)}' +
      '.lc-wc b{font-size:20px;line-height:1;color:var(--fg)}.lc-wc span{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}' +
      '@media(max-width:520px){.lc-wk{grid-template-columns:44px repeat(7,minmax(0,1fr));gap:4px}.lc-wk.n5{grid-template-columns:44px repeat(5,minmax(0,1fr))}.lc-wc{padding:8px 2px;min-height:48px}.lc-wc b{font-size:16px}.lc-wc span{font-size:9px}.lc-wl{font-size:11px}}'));
    if (FZ.isOperator()) out.push(ui.note('Email enquiries that are not in Jobber yet show here once your Operator connects Gmail.'));
    out.push(ui.how('Counts every Jobber request that is new, has its visit overdue or today, or has no visit booked. Oldest first.',
      'Waiting time runs from when the request was created in Jobber. Anything over ' + RULES.replyHours + ' hours is flagged.',
      'The reply offers a free visit, or a look at the problem for repairs. Queued replies go out from your email on the next run.'));
    return out;
  }
});
