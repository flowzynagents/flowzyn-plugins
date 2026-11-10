// Quote Chaser: quotes waiting on the customer, picked up after Jobber's day 2 and day 5 reminders stop.
FZ.board('quote-chaser', {
  source: 'Quotes: Jobber, live.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const RULES = { reminderDays: 5, bigQuote: 5000, maxDetail: 25, windowDays: 90 };
    const BANDS = [
      { label: '0 to 5 days', min: 0, max: 5 },
      { label: '6 to 14 days', min: 6, max: 14 },
      { label: '15 to 30 days', min: 15, max: 30 },
      { label: 'Over 30 days', min: 31, max: Infinity }
    ];

    const [waitingAll, sentRecent] = await Promise.all([
      ctx.jobberAll('search_quotes', { status: 'awaiting_response', limit: 100 }, 'quotes', 300),
      ctx.jobberAll('search_quotes', { dateRange: { after: fmt.isoDaysAgo(RULES.windowDays) }, sort: 'createdAt', limit: 100 }, 'quotes', 300).catch(() => [])
    ]);
    // Only quotes sent in the last 90 days. Older ones belong to Lost Quote Revival.
    const quotes = waitingAll.filter((q) => (fmt.daysSince(q.sentAt || q.createdAt) || 0) <= RULES.windowDays);
    const rows = quotes.map((q) => {
      const days = fmt.daysSince(q.sentAt || q.createdAt) || 0;
      const total = Number(q.total) || 0;
      const opened = !!q.clientHubViewedAt;
      const kind = total > RULES.bigQuote ? 'big' : opened ? 'opened' : 'unopened';
      return { q, days, total, opened, kind, who: fmt.clean(q.client && q.client.name), title: fmt.clean(q.title) || 'Quote', past: days > RULES.reminderDays };
    }).sort((a, b) => b.total - a.total);
    const past = rows.filter((r) => r.past);
    const sum = (list) => list.reduce((s, r) => s + r.total, 0);
    const totalAll = sum(rows);

    // Call notes for the big ones: line items and deposit from the quote itself.
    const big = past.filter((r) => r.kind === 'big').slice(0, RULES.maxDetail);
    const details = await ctx.pool(big, 4, (r) => ctx.jobber('get_quote', { quoteId: r.q.id }));
    big.forEach((r, i) => { r.detail = details[i] && details[i].quote; });

    ctx.metric('quote-chaser', rows.length
      ? { value: past.length ? fmt.plural(past.length, 'quote') + ' to follow up' : 'Jobber reminders have it', detail: fmt.money(sum(past), { short: true }) + ' past day ' + RULES.reminderDays + ', ' + fmt.money(totalAll, { short: true }) + ' waiting in total' }
      : { value: 'No quotes waiting', detail: '' });

    const first = (r) => fmt.firstName(r.who);
    const sentOn = (r) => r.q.sentAt ? fmt.fmtDate(r.q.sentAt) : 'recently';
    const draftFor = (r) => r.opened
      ? 'Hi ' + first(r) + ', it is ' + FZ.me().first + ' at ' + FZ.biz() + '. I saw you had a look at the ' + r.title.toLowerCase() + ' quote I sent on ' + sentOn(r) + '. Any questions I can answer, or anything you would like changed? Happy to walk through it on the phone or at the house.\n\n' + FZ.sign()
      : 'Hi ' + first(r) + ', it is ' + FZ.me().first + ' at ' + FZ.biz() + '. Just making sure my ' + r.title.toLowerCase() + ' quote from ' + sentOn(r) + ' reached you. I can resend it or go over it by phone, whatever is easier.\n\n' + FZ.sign();
    const callBrief = (r) => {
      const d = r.detail || {};
      const lines = ((d.lineItems || []).filter((l) => !l.textOnly)).map((l) => '  ' + fmt.clean(l.name) + ' ' + fmt.money(l.totalPrice));
      const dep = d.amounts && Number(d.amounts.depositAmount) ? 'Deposit to start: ' + fmt.money(d.amounts.depositAmount) : 'No deposit set on the quote';
      return ['Call ' + r.who + ' about quote #' + r.q.quoteNumber + ', ' + r.title + ', ' + fmt.money(r.total) + '.',
        'Sent ' + sentOn(r) + ', ' + fmt.plural(r.days, 'day') + ' ago. ' + (r.opened ? 'They opened it ' + fmt.fmtDate(r.q.clientHubViewedAt) + '.' : 'They have not opened it yet.'),
        lines.length ? 'On the quote:\n' + lines.join('\n') : '', dep + '.',
        'Ask: does it still fit the plan and timing? Anything to change? Can we book a start date?',
        '', 'If no answer, leave this message:', draftFor(r)].filter((x) => x !== '').join('\n');
    };
    const card = (r) => ({
      when: 'Day ' + r.days + ' · ' + (r.opened ? 'Opened ' + fmt.fmtDate(r.q.clientHubViewedAt) : 'Not opened'),
      who: r.who, amount: r.total,
      why: r.title + ', quote #' + r.q.quoteNumber + (r.kind === 'big' && FZ.isOperator() ? '. Worth a call.' : ''),
      flag: r.kind === 'big', link: r.q.jobberWebUri,
      clientId: r.q.client && r.q.client.id, draftSubject: 'Your ' + r.title.toLowerCase().replace(/\s*quote$/, '') + ' quote from ' + FZ.biz(), draft: r.kind === 'big' && FZ.isOperator() ? callBrief(r) : draftFor(r), draftLabel: r.kind === 'big' ? 'See call notes' : 'See follow up', draftCall: r.kind === 'big' && FZ.isOperator()
    });
    const { h } = ui;
    const K = FZ.kit;
    const out = [];
    const T = (FZ.tasksNow && FZ.tasksNow().done) || {};
    const qidOf = (k) => 'send-' + String(k || '').replace(/[^A-Za-z0-9]+/g, '-').slice(-80);
    const short = (n) => fmt.money(n, { short: true });
    const run = FZ.runs && FZ.runs['quote-chaser'];
    const ranAt = run && run.last && fmt.dayKey(run.last) === fmt.dayKey(new Date().toISOString()) ? fmt.fmtTime(run.last) : null;
    // Primary action: open the follow up on the work tab.
    const goWork = (needle) => () => {
      const tab = document.querySelector('#fz-board .fz-subtabs [data-id="work"]'); if (tab) tab.click();
      setTimeout(() => { const el = [...document.querySelectorAll('#fz-board .fz-tabbody[data-id="work"] .fz-card')].find((c) => c.textContent.includes(needle)); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
    };
    const btn = (label, fn) => h('button', { type: 'button', class: 'fz-btn act qc-go', onclick: fn }, label);

    // Last 90 days: sent, opened, replied, won.
    const sent = sentRecent.filter((q) => q.status !== 'draft');
    const answered = (q) => ['approved', 'converted', 'changes_requested'].includes(q.status);
    const openedL = sent.filter((q) => q.clientHubViewedAt || answered(q));
    const replied = sent.filter(answered);
    const won = sent.filter((q) => ['approved', 'converted'].includes(q.status));
    const quietN = Math.max(0, openedL.length - replied.length);
    const funnel = (s, o, r, w, q) => {
      const top = Math.max(1, s);
      const pct = (n) => (n / top * 100).toFixed(1) + '%';
      const row = (label, n, extra) => h('div', { class: 'qc-fr' }, h('span', { class: 'qc-fl' }, label),
        h('span', { class: 'qc-ft' }, h('span', { class: 'qc-ff', style: 'width:' + (n ? pct(n) : '0') }), extra || null,
          h('span', { class: 'qc-fv', style: 'left:calc(' + pct(extra ? o : n) + ' + 8px)' }, String(n))));
      return h('div', { class: 'qc-fun', role: 'img', 'aria-label': s + ' sent, ' + o + ' opened, ' + r + ' replied, ' + w + ' won' },
        row('Sent', s), row('Opened', o),
        row('Replied', r, q ? h('span', { class: 'qc-quiet', style: 'left:' + pct(r) + ';width:calc(' + pct(o - r) + ')' }, h('span', { class: 'qc-ql' }, q + ' went quiet'), h('span', { class: 'qc-qs' }, String(q))) : null),
        row('Won', w), h('style', null, QC_CSS));
    };

    if (!past.length) {
      // Quiet week: nothing past Jobber's reminders yet.
      const st = ui.status(rows.length
        ? ['Every open quote is inside Jobber’s ' + RULES.reminderDays + ' day reminders. ', { b: 'Nothing to chase yet.' }]
        : ['No quotes are waiting on a customer. ', { b: 'Nothing to chase yet.' }]);
      st.classList.add('qc-good');
      out.push(st);
      out.push(K.how(h, 'It follows up every open quote once Jobber’s reminders stop, and brings you only the ones a call would win.'));
      const checked = K.checked(h, fmt.plural(rows.length + replied.length, 'quote') + ' checked in Jobber', [
        rows.length ? fmt.plural(rows.length, 'open quote') + ' inside ' + RULES.reminderDays + ' days, Jobber is reminding them' : 'No quotes waiting on a customer',
        replied.length ? fmt.plural(replied.length, 'quote') + ' answered or won, left alone' : null,
        'Follow ups start once a quote passes day ' + RULES.reminderDays
      ]);
      const right = sent.length >= 10
        ? h('div', null, h('p', { class: 'ag-eyebrow', style: 'color:var(--muted)' }, 'Your last ' + RULES.windowDays + ' days'), h('h3', { class: 'ag-title' }, won.length + ' won of ' + sent.length + ' sent'), funnel(sent.length, openedL.length, replied.length, won.length, quietN))
        : K.example(h, 'A typical shop in week 2', [funnel(42, 31, 14, 9, 17), h('p', { class: 'ag-sub', style: 'margin:12px 0 0' }, 'Shown until your own quotes reach day ' + (RULES.reminderDays + 1) + '. Then this panel shows yours.')]);
      out.push(K.quiet(h, checked, right));
      out.push(h('style', null, QC_CSS));
    } else {
      const closeL = past.filter((r) => r.opened);
      const picks = [...closeL, ...past.filter((r) => !r.opened)].slice(0, 3);
      out.push(ui.status(closeL.length
        ? [short(totalAll) + ' in open quotes. ', { b: (closeL.length === 1 ? '1 is' : closeL.length + ' are') + ' close to a yes.' }]
        : [short(totalAll) + ' in open quotes. ', { b: (past.length === 1 ? '1 needs' : past.length + ' need') + ' a follow up.' }]));
      out.push(K.how(h, 'It follows up every open quote once Jobber’s day 2 and day ' + RULES.reminderDays + ' reminders stop, and brings you only the ones a call would win.'));

      const queued = past.filter((r) => (T[qidOf(r.q.jobberWebUri || r.who)] || {}).outbox).length;
      const lostAtOpen = sent.length - openedL.length;
      out.push(K.hero(h, {
        eyebrow: 'Last ' + RULES.windowDays + ' days',
        title: !sent.length ? fmt.plural(past.length, 'quote') + ' past Jobber’s reminders'
          : quietN >= lostAtOpen ? ['Most quotes go quiet ', { b: 'after they are opened' }] : ['Most quotes are ', { b: 'never opened' }],
        sub: sent.length ? fmt.plural(sent.length, 'quote') + ' sent. ' + quietN + ' were opened and never answered. ' + (quietN >= lostAtOpen ? 'That is where follow ups win the most.' : lostAtOpen + ' were never opened.') : null,
        viz: sent.length ? h('div', null, funnel(sent.length, openedL.length, replied.length, won.length, quietN), h('p', { class: 'qc-note' }, won.length + ' won of ' + sent.length + ' sent.')) : null,
        did: [
          { t: 'Checked ' + fmt.plural(rows.length, 'open quote') + ' in Jobber', s: ranAt || 'Live from Jobber' },
          { t: 'Wrote ' + fmt.plural(past.length, 'follow up') + ' for quotes past day ' + RULES.reminderDays },
          queued ? { t: fmt.plural(queued, 'follow up') + ' queued by you', s: 'Goes out on the next run' } : null,
          { t: 'Picked ' + picks.length + ' for you, ranked by value' },
          { t: 'Next: queued follow ups go out from your email', done: false }
        ].filter(Boolean)
      }));

      const restRows = rows.filter((r) => !picks.includes(r));
      out.push(K.needs(h, {
        title: closeL.length ? fmt.plural(picks.length, 'quote') + ' a call would win, biggest first' : fmt.plural(picks.length, 'quote') + ' to follow up, biggest first',
        items: picks.map((r) => ({
          meta: [{ b: short(r.total) }, ' · ' + r.title + ' #' + r.q.quoteNumber + ', day ' + r.days],
          title: r.who,
          detail: r.opened ? 'Opened it ' + fmt.fmtDate(r.q.clientHubViewedAt) + ' and never answered. A call today, or send the follow up it wrote.' : 'Not opened yet. Check the email reached them. A follow up is written.',
          actions: [btn(r.kind === 'big' && FZ.isOperator() ? 'Call notes' : 'Send follow up', goWork('quote #' + r.q.quoteNumber)), r.q.jobberWebUri ? ui.extLink(r.q.jobberWebUri, 'Open in Jobber', 'fz-tlink') : null].filter(Boolean)
        })),
        rest: { count: restRows.length, label: 'the agent is following up on its own', list: ui.table([
          { label: 'Customer', get: (r) => r.q.jobberWebUri ? ui.extLink(r.q.jobberWebUri, r.who, 'fz-tlink') : r.who },
          { label: 'Quote', get: (r) => '#' + r.q.quoteNumber + ' ' + r.title },
          { label: 'Days', num: true, get: (r) => String(r.days) },
          { label: 'Opened', get: (r) => r.opened ? 'Yes' : 'No' },
          { label: 'Amount', num: true, get: (r) => fmt.money(r.total) }
        ], restRows, { open: true }) }
      }));

      // Work tab: the follow ups, ready to send.
      const groups = [
        { kind: 'big', title: (n) => fmt.plural(n, 'big quote') + (FZ.isOperator() ? ' worth a call' : ' to follow up'), sub: 'Over ' + fmt.money(RULES.bigQuote) + '. ' + (FZ.isOperator() ? 'Call notes are ready.' : 'A follow up is written for each one.') },
        { kind: 'opened', title: (n) => n + ' opened but no answer yet', sub: 'They looked. A short personal note usually gets a reply.' },
        { kind: 'unopened', title: (n) => n + ' never opened', sub: 'Check the email reached them, or give them a ring.' }
      ];
      groups.forEach((g) => {
        const list = past.filter((r) => r.kind === g.kind);
        if (!list.length) return;
        const sec = ui.section(g.title(list.length) + ', ' + short(sum(list)), g.sub, ui.cards(list.map(card), { max: 6 }));
        sec.dataset.worklabel = 'Send follow ups';
        out.push(sec);
      });
    }
    out.push(ui.how('Every Jobber quote waiting on the customer is counted, ranked by dollars.',
      'Jobber sends its own reminders on day 2 and day 5. A quote needs a follow up once it is past day ' + RULES.reminderDays + ' since it was sent.',
      'Replied means the customer said yes or asked for changes. Went quiet means they opened it and never answered.',
      'Quotes over ' + fmt.money(RULES.bigQuote) + ' get call notes. Queued emails go out from your email on the next run. Nothing goes out unless you queue it.'));
    return out;
  }
});
const QC_CSS = '.qc-fun{display:flex;flex-direction:column;gap:14px;margin-top:6px}' +
  '.qc-fr{display:grid;grid-template-columns:76px minmax(0,1fr);gap:12px;align-items:center}' +
  '.qc-fl{font-size:14px;color:var(--fg)}.qc-ft{position:relative;height:30px;margin-right:44px}' +
  '.qc-ff{position:absolute;left:0;top:0;bottom:0;border-radius:4px;background:var(--bar,#3a3f4b)}' +
  '.qc-fv{position:absolute;top:50%;transform:translateY(-50%);font-weight:700;font-size:15px;font-variant-numeric:tabular-nums;color:var(--fg)}' +
  '.qc-quiet{position:absolute;top:0;bottom:0;display:flex;align-items:center;justify-content:center;border:1.5px dashed var(--accent);border-radius:4px;background:color-mix(in srgb,var(--accent) 14%,transparent);color:var(--accent);font-size:13px;font-weight:700;white-space:nowrap;overflow:hidden;box-sizing:border-box}' +
  '.qc-note{margin:18px 0 0;padding-left:12px;border-left:2px solid var(--accent);font-size:13px;color:var(--fg)}' +
  '.qc-qs{display:none}.fz-btn.qc-go{background:var(--accent)!important;color:var(--on-accent,#111)!important}' +
  '.fz-status.qc-good b{color:var(--ok-fg,#22c55e)}' +
  '@media (max-width:520px){.qc-fr{grid-template-columns:62px minmax(0,1fr);gap:8px}.qc-ql{display:none}.qc-qs{display:inline}.qc-ft{margin-right:34px}}';
