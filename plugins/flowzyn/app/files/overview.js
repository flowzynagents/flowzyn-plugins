// Overview: the first screen. Where the shop is now, where the owner wants to be, and what it takes to get there.
(function () {
  // Open one task on Tasks, and its email straight away when the owner would rather email than call (Matt, Nov 10).
  window.FZ = window.FZ || {};
  let WANT = null;
  FZ.openTask = (id, mode) => { WANT = { id, mode }; location.hash = '#tasks'; };
  FZ.wantOpen = (id) => { if (!WANT || WANT.id !== id) return null; const m = WANT.mode || 'open'; WANT = null; return m; };
  // The Recommend line says what to do, even when the button confirms it was done.
  const REC = { 'Booked in Jobber': 'book it in Jobber', 'Invoiced in Jobber': 'invoice it in Jobber', 'See the job': 'look at the job' };
  const recOf = (t) => REC[t.approve] || (t.approve || 'review it').replace(/^./, (c) => c.toLowerCase());
  const PROFILE = { get name() { return FZ.biz(); }, get place() { return FZ.me().place; } };

  FZ.overview = async function (ctx) {
    const { ui, fmt } = ctx;
    const { h } = ui;
    const MONTH_MS = 30.44 * 86400000;
    const after = fmt.isoDaysAgo(185);

    const [quotes, invoices, pastDue, awaiting, notDue, visits, goalDoc] = await Promise.all([
      ctx.jobberAll('search_quotes', { dateRange: { after }, sort: 'createdAt', limit: 100 }, 'quotes', 600),
      ctx.jobberAll('search_invoices', { issuedDate: { after }, limit: 50 }, 'invoices', 600),
      ctx.jobberAll('search_invoices', { status: 'past_due', limit: 50 }, 'invoices', 300),
      ctx.jobberAll('search_invoices', { status: 'awaiting_payment', limit: 50 }, 'invoices', 300),
      ctx.jobberAll('search_invoices', { status: 'sent_not_due', limit: 50 }, 'invoices', 300),
      ctx.jobberAll('search_visits', { status: 'upcoming', sort: 'startAt', limit: 50 }, 'visits', 100).catch(() => []),
      ctx.store('settings/goals')
    ]);
    const [needInvoice, forecastDoc] = await Promise.all([
      ctx.jobberAll('search_jobs', { status: 'requires_invoicing', limit: 50 }, 'jobs', 100).catch(() => []),
      ctx.store('datasets/forecast').catch(() => null)
    ]);

    // ---- Where you are now (last 3 full months, plus this month so far) ----
    const now = new Date();
    const monthKey = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: fmt.TZ }).slice(0, 7);
    const months = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 15); months.push(d.toISOString().slice(0, 7)); }
    const thisMonth = months[5];
    const full3 = months.slice(2, 5);
    const sum = (arr, f) => arr.reduce((n, x) => n + (Number(f(x)) || 0), 0);
    const inMonths = (iso, list) => iso && list.includes(monthKey(iso));

    const sent = quotes.filter((q) => q.sentAt);
    const won = sent.filter((q) => q.status === 'approved' || q.status === 'converted');
    const issued = invoices.filter((v) => v.issuedDate && v.status !== 'draft' && v.status !== 'voided');

    const sent3 = sent.filter((q) => inMonths(q.sentAt, full3));
    const won3 = won.filter((q) => inMonths(q.sentAt, full3));
    const inv3 = issued.filter((v) => inMonths(v.issuedDate, full3));
    const quotesPerMonth = sent3.length / 3;
    const quotedPerMonth = sum(sent3, (q) => q.total) / 3;
    const winRate = sent3.length ? won3.length / sent3.length : (sent.length ? won.length / sent.length : 0);
    const invoicedPerMonth = sum(inv3, (v) => v.total) / 3;
    const invoicesPerMonth = inv3.length / 3;
    const avgInvoice = inv3.length ? sum(inv3, (v) => v.total) / inv3.length : (issued.length ? sum(issued, (v) => v.total) / issued.length : 0);
    const unpaid = [...pastDue, ...awaiting, ...notDue];
    const seen = new Set();
    const unpaidUnique = unpaid.filter((v) => (seen.has(v.id) ? false : seen.add(v.id)));
    const owed = sum(unpaidUnique, (v) => v.balance);
    const overdue = sum(pastDue, (v) => v.balance);
    const waitingQuotes = quotes.filter((q) => q.status === 'awaiting_response');
    const waitingDollars = sum(waitingQuotes, (q) => q.total);
    const invThisMonth = sum(issued.filter((v) => monthKey(v.issuedDate) === thisMonth), (v) => v.total);
    const dayOfMonth = Number(new Date().toLocaleDateString('en-CA', { timeZone: fmt.TZ }).slice(8, 10));
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

    // ---- Where you want to be ----
    const roundUp = (n, step) => Math.ceil(n / step) * step;
    const suggested = invoicedPerMonth > 0 ? roundUp(invoicedPerMonth * 1.25, 5000) : 0;
    const goal = (goalDoc && Number(goalDoc.monthlyRevenue)) || 0;
    const target = goal || suggested;
    const usingSuggestion = !goal;

    // ---- How to get there (per month) ----
    const invoicesNeeded = avgInvoice ? target / avgInvoice : 0;
    const quotesNeeded = winRate ? invoicesNeeded / winRate : 0;
    const r1 = (n) => Math.round(n);

    // ---------- Build ----------
    const permitsDoc = await ctx.store('datasets/permits').catch(() => null);
    const permits = (permitsDoc && permitsDoc.permits) || [];
    const builders = new Set(permits.map((p) => p.contractor).filter(Boolean)).size;
    const heroName = h('div', { class: 'ov-who' },
      h('h1', { class: 'home' }, PROFILE.name),
      PROFILE.place ? h('div', { class: 'ov-biz' }, h('span', { class: 'chip' }, PROFILE.place)) : null);

    // Live numbers for the popular agents on the Agents tab.
    ctx.metric('quote-chaser', { value: fmt.plural(waitingQuotes.length, 'quote') + ' waiting', detail: fmt.money(waitingDollars, { short: true }) + ' in total' });
    ctx.metric('get-paid', { value: fmt.money(overdue, { short: true }) + ' overdue', detail: fmt.plural(pastDue.length, 'invoice') });
    if (permits.length) ctx.metric('builder-engine', { value: fmt.plural(builders, 'builder') + ' with new approvals', detail: permits.length + ' approvals in Denver and Boulder' });

    // Ask box: type what you need, get the agent that does it.
    const ASK = {
      'builder-engine': 'builders builder gc contractors permits new work denver boulder grow growth leads find work outreach',
      'lost-quote-revival': 'old quotes archived lost dead revive bring back',
      'partner-finder': 'partners designers showrooms rental managers referrals',
      'local-search-check': 'google maps ranking seo search found online',
      'morning-brief': 'today brief what needs me summary morning priorities',
      'lead-catcher': 'enquiries inquiries leads new requests reply',
      'quote-prep': 'write quote prepare price measure estimate',
      'quote-chaser': 'chase follow up quotes waiting unanswered win more',
      'replies': 'replies changes customers said yes answered',
      'yes-to-install': 'approved book schedule install order supplier',
      'week-board': 'week schedule calendar crew late open days',
      'bill-it': 'invoice billing bill unbilled done finished',
      'get-paid': 'paid overdue owed money collect payments chase invoices',
      'month-close': 'month close bookkeeper books accounting quickbooks',
      'weather-watch': 'weather snow wind cold forecast',
      'crew-sheet': 'tomorrow crew sheet jobs addresses gate codes',
      'cash-in': 'cash flow money coming in forecast due',
      'pay-bills': 'pay bills supplier vendor payables due owe quickbooks',
      'price-watch': 'prices margin cost supplier price list',
      'own-permits': 'permit inspection inspections',
      'add-on-finder': 'add ons upsell extras missing lines quote value',
      'shop-handbook': 'how do we price handbook new hire train describe',
      'review-ask': 'reviews ask google review happy customers',
      'review-watch': 'rating reviews competitors reply',
      'builder-keep': 'builders keep repeat best builders quiet',
      'come-back': 'past clients repeat work come back',
      'stand-behind-it': 'warranty claims seals installs'
    };
    const score = (a, words) => {
      const hay = (a.name + ' ' + a.does + ' ' + (ASK[a.key] || '')).toLowerCase();
      return words.reduce((n, w) => n + (hay.includes(w) ? (a.name.toLowerCase().includes(w) ? 3 : 1) : (w.length > 4 && hay.includes(w.slice(0, -1)) ? 1 : 0)), 0);
    };
    const results = h('div', { class: 'ov-askres', role: 'listbox', 'aria-label': 'Matching agents' });
    const askInput = h('input', { id: 'ov-ask', type: 'search', autocomplete: 'off', placeholder: 'What do you need done today?', 'aria-label': 'What can your agents take off your plate today?' });
    const show = () => {
      const stop = new Set(['the', 'a', 'an', 'my', 'me', 'i', 'to', 'for', 'in', 'of', 'and', 'what', 'who', 'is', 'are', 'do', 'can', 'how', 'with', 'on', 'need', 'want']);
      const words = askInput.value.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w && !stop.has(w));
      if (!words.length) { results.replaceChildren(...(document.activeElement === askInput ? [h('div', { class: 'ov-askchips' }, chips)] : [])); return; }
      const hits = FZ.AGENTS.map((a) => ({ a, s: score(a, words) })).filter((x) => x.s > 0).sort((x, y) => y.s - x.s).slice(0, 3);
      results.replaceChildren(...(hits.length ? hits.map(({ a }) => h('a', { class: 'ov-hit', href: '#a-' + a.key, role: 'option' },
        h('span', { class: 'n' }, a.name), h('span', { class: 'd' }, a.does), h('span', { class: 'go' }, 'Open →')))
        : [h('p', { class: 'fz-hint' }, 'No agent for that yet. See the ', h('a', { href: '#all' }, 'Agents tab'), ' to ask for a custom one.')]));
    };
    askInput.addEventListener('input', show);
    askInput.addEventListener('focus', show);
    // Example searches, cycling in the empty box.
    const EXAMPLES = ['Try \u201cwho owes me money\u201d', 'Try \u201cchase my quotes\u201d', 'Try \u201cfind builders near me\u201d', 'Try \u201cwhat\u2019s on tomorrow\u201d', 'Try \u201cany weather problems\u201d', 'Try \u201cget more reviews\u201d'];
    let ex = 0;
    askInput.placeholder = EXAMPLES[0];
    const exTimer = setInterval(() => {
      if (!askInput.isConnected) return clearInterval(exTimer);
      if (document.activeElement === askInput || askInput.value) return;
      ex = (ex + 1) % EXAMPLES.length;
      askInput.placeholder = EXAMPLES[ex];
    }, 3000);
    askInput.addEventListener('blur', () => setTimeout(() => { if (!askInput.value.trim() && !results.contains(document.activeElement)) results.replaceChildren(); }, 150));
    askInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { const first = results.querySelector('a.ov-hit'); if (first) { e.preventDefault(); location.hash = first.getAttribute('href'); } } });
    const chips = ['Find builders in Denver', 'Chase my quotes', 'Who owes me money', 'What’s on tomorrow', 'Any weather problems'].map((t) =>
      h('button', { type: 'button', class: 'ov-askchip', onclick: () => { askInput.value = t; show(); askInput.focus(); } }, t));
    const ask = h('div', { class: 'ov-ask' },
      h('div', { class: 'ov-askbox' },
        h('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }),
        askInput),
      results);
    const hero = h('header', { class: 'ov-top' }, heroName);
    const askBar = h('div', { class: 'ov-askbar' }, ask);
    const sv = ask.querySelector('svg');
    sv.outerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"></circle><path d="M20 20l-4-4"></path></svg>';

    const pace = invThisMonth / Math.max(1, dayOfMonth) * daysInMonth;
    const status = ui.status(target
      ? ['Goal ', h('b', { class: 'goalhl' }, fmt.money(target, { short: true })), ' a month. ',
        pace >= target ? 'This month is on pace.' : 'This month is pacing ' + fmt.money(pace, { short: true }) + '.']
      : ['Invoicing ', { b: fmt.money(invoicedPerMonth, { short: true }) }, ' a month over the last 3 months.']);

    // Now: stats + trend chart
    const stat = (l, v, s) => h('div', { class: 'ov-stat' }, h('span', { class: 'l' }, l), h('span', { class: 'v' }, v), s ? h('span', { class: 's' }, s) : null);
    const kpis = h('div', { class: 'ov-kpis' },
      stat('Average invoiced a month', fmt.money(invoicedPerMonth, { short: true }), r1(invoicesPerMonth) + ' invoices a month at ' + fmt.money(avgInvoice, { short: true }) + ' each'),
      stat('Average quotes sent a month', String(r1(quotesPerMonth)), 'Worth ' + fmt.money(quotedPerMonth, { short: true }) + ' a month'),
      stat('Share of quotes you win', Math.round(winRate * 100) + '%', 'Over the last 3 months'),
      stat('Owed to you today', fmt.money(owed, { short: true }), fmt.money(overdue, { short: true }) + ' of it overdue'));
    const nowCard = h('section', { class: 'ov-card' },
      h('h2', null, 'Where you are now'),
      h('p', { class: 'lead' }, ['Invoicing ', h('b', null, fmt.money(invoicedPerMonth, { short: true })), ' a month over the last 3 months']),
      h('p', { class: 'fz-sub' }, 'What you invoiced each month in Jobber, against your goal.'),
      trendChart(months, issued, target, monthKey, fmt));

    // Want: goal editor
    const input = h('input', { class: 'fz-input', id: 'ov-goal', type: 'number', min: '0', step: '1000', inputmode: 'numeric', value: String(target || ''), 'aria-label': 'Monthly invoiced goal in dollars' });
    const msg = h('p', { class: 'fz-hint', role: 'status' }, usingSuggestion
      ? (suggested ? 'Suggested: 25% above your last 3 months. Set your own and save.' : 'Set a monthly goal to see what it takes.')
      : 'Set by ' + (goalDoc.setBy || 'you') + (goalDoc.setAt ? ' on ' + fmt.fmtDate(goalDoc.setAt) : '') + '.');
    const save = h('button', { type: 'button', class: 'fz-btn' }, 'Save goal');
    save.addEventListener('click', async () => {
      const n = Math.round(Number(input.value));
      if (!n || n < 1000) { msg.textContent = 'Enter a monthly amount, for example 60000.'; return; }
      save.disabled = true;
      try {
        const db = window.claude && window.claude.use ? await window.claude.use('db') : null;
        if (!db) throw new Error('no db');
        await db.doc('settings/goals').set({ monthlyRevenue: n, setBy: FZ.me().first, setAt: new Date().toISOString() });
        msg.textContent = 'Saved. Reload to see the plan for ' + fmt.money(n, { short: true }) + ' a month.';
      } catch (e) {
        msg.textContent = 'Could not save here. Only an editor of this page can change the goal.';
      } finally { save.disabled = false; }
    });
    const wantCard = h('section', { class: 'ov-card' },
      h('h2', null, 'Where you desire to be'),
      h('p', { class: 'lead' }, target ? ['Invoice ', h('b', { class: 'goalhl' }, fmt.money(target)), ' a month'] : 'Set your monthly goal'),
      h('p', { class: 'fz-sub' }, 'That is ' + (target && invoicedPerMonth ? fmt.money(target - invoicedPerMonth, { short: true }) + ' a month more than you invoice now.' : 'the number every agent works toward.')),
      h('div', { class: 'ov-goal' }, h('label', { for: 'ov-goal' }, 'Monthly invoiced goal ($)', input), save),
      msg);
    // Your goal: one card, the chart with the goal line and the goal setting under it.
    const goalCard = h('section', { class: 'ov-card ov-goalcard' },
      h('h2', null, 'Your goal'),
      h('p', { class: 'lead' }, ['Invoicing ', h('b', null, fmt.money(invoicedPerMonth, { short: true })), ' a month', target ? [', goal ', h('b', { class: 'goalhl' }, fmt.money(target, { short: true }))] : ''].flat()),
      h('p', { class: 'fz-sub' }, target && invoicedPerMonth > 0 && target > invoicedPerMonth ? 'That is ' + fmt.money(target - invoicedPerMonth, { short: true }) + ' a month more than your last 3 months. Change the goal any time.' : 'What you invoiced each month in Jobber. Change the goal any time.'),
      h('div', { class: 'ov-goalbody' }, trendChart(months, issued, target, monthKey, fmt),
        h('div', { class: 'ov-goalside' }, h('div', { class: 'ov-goal ov-goalset' }, h('label', { for: 'ov-goal' }, 'Monthly invoiced goal ($)', input), save), msg)));

    // How: three gap bars
    // How: one tile per lever, a ring showing how far along you are.
    const NS = 'http://www.w3.org/2000/svg';
    const ring = (part, centre, sub) => {
      const pct = Math.max(0, Math.min(1, part));
      const r = 34, c = 2 * Math.PI * r;
      const svg = document.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 84 84'); svg.setAttribute('class', 'lv-ring'); svg.setAttribute('aria-hidden', 'true');
      const mk = (cls, extra) => { const n = document.createElementNS(NS, 'circle'); n.setAttribute('cx', '42'); n.setAttribute('cy', '42'); n.setAttribute('r', String(r)); n.setAttribute('class', cls); Object.entries(extra || {}).forEach(([k, v]) => n.setAttribute(k, v)); return n; };
      svg.append(mk('bg'), mk('fg', { 'stroke-dasharray': (c * pct) + ' ' + c, transform: 'rotate(-90 42 42)' }));
      return h('div', { class: 'lv-dial' }, svg, h('div', { class: 'lv-mid' }, h('b', null, centre), h('span', null, sub)));
    };
    // Pace bar: where you are now (orange) against what the goal needs (the full track).
    const paceBar = (part, left, right) => {
      const pct = Math.max(0, Math.min(1, part || 0));
      return h('div', { class: 'lv-pace' },
        h('div', { class: 'lv-track', role: 'img', 'aria-label': left + ' of ' + right }, pct > 0 ? h('span', { class: 'lv-fill', style: 'width:' + Math.max(pct * 100, 3).toFixed(1) + '%' }) : null, pct < 1 ? h('span', { class: 'lv-rest' + (pct > 0 ? '' : ' all') }) : null),
        h('div', { class: 'lv-ends' }, h('span', null, h('b', null, left.split(' ')[0]), ' ' + left.split(' ').slice(1).join(' ')), h('span', null, right)));
    };
    const lever = (o) => h('div', { class: 'lv' },
      h('p', { class: 'lv-t' }, o.title),
      h('p', { class: 'lv-big' }, /^[+$]/.test(o.big) ? [h('b', null, o.big.split(' ')[0]), ' ' + o.big.split(' ').slice(1).join(' ')] : o.big),
      paceBar(o.part, o.left, o.right),
      h('p', { class: 'lv-note' }, o.note),
      h('a', { class: 'fz-btn act', href: o.btn[1] }, o.btn[0]));
    const moreQ = Math.max(0, quotesNeeded - quotesPerMonth), moreI = Math.max(0, invoicesNeeded - invoicesPerMonth);
    const howCard = h('section', { class: 'ov-card' },
      h('h2', null, 'How you get there'),
      target ? h('p', { class: 'lead' }, moreQ > 0.5 || moreI > 0.5 ? 'The goal needs ' + [moreQ > 0.5 ? r1(moreQ) + ' more quotes' : null, moreI > 0.5 ? r1(moreI) + ' more jobs' : null].filter(Boolean).join(' and ') + ' a month' : 'You are on track for the goal') : null,
      target ? h('div', { class: 'lv-grid' },
        lever({ title: 'Send more quotes', part: quotesNeeded ? quotesPerMonth / quotesNeeded : 1, left: r1(quotesPerMonth) + ' sent now', right: r1(quotesNeeded) + ' needed',
          big: moreQ > 0.5 ? '+' + r1(moreQ) + ' quotes a month' : 'On track', note: 'At your ' + Math.round(winRate * 100) + '% win rate the goal needs ' + r1(quotesNeeded) + ' quotes a month.', btn: ['Follow up quotes', '#a-quote-chaser'] }),
        lever({ title: 'Invoice more jobs', part: invoicesNeeded ? invoicesPerMonth / invoicesNeeded : 1, left: r1(invoicesPerMonth) + ' invoiced now', right: r1(invoicesNeeded) + ' needed',
          big: moreI > 0.5 ? '+' + r1(moreI) + ' jobs a month' : 'On track', note: 'At about ' + fmt.money(avgInvoice, { short: true }) + ' a job the goal needs ' + r1(invoicesNeeded) + ' a month.', btn: ['Invoice finished work', '#a-bill-it'] }),
        lever({ title: 'Collect what you are owed', part: owed ? overdue / owed : 0, left: fmt.money(overdue, { short: true }) + ' overdue', right: fmt.money(owed, { short: true }) + ' owed',
          big: overdue > 0 ? fmt.money(overdue, { short: true }) + ' overdue' : 'Nothing overdue', note: fmt.plural(pastDue.length, 'invoice') + ' past due. The rest of what you are owed is not due yet.', btn: ['Get paid', '#a-get-paid'] })) : ui.calm('Set a goal to see the plan.'));

    // Your return: money from the work the agents target, last 30 days, against the plan.
    const planNow = FZ.plan ? FZ.plan() : null;
    const suitesOn = planNow ? Object.values(planNow.groups).filter(Boolean).length : 3;
    const planCost = (planNow && planNow.price) || 1400;
    const feeAt = (i) => (FZ.planFeeAt ? FZ.planFeeAt(planNow, i) : planCost);
    const d30 = (iso) => iso && fmt.daysSince(iso) <= 30;
    const lateWins = won.filter((q) => d30(q.approvedAt) && q.sentAt && (new Date(q.approvedAt) - new Date(q.sentAt)) / 86400000 > 5);
    const lateWon = sum(lateWins, (q) => q.total);
    const overduePaid = issued.filter((v) => v.status === 'paid' && v.dueDate && v.updatedAt && v.updatedAt > v.dueDate && d30(v.updatedAt));
    const collected = sum(overduePaid, (v) => v.total);
    const back = lateWon + collected;
    // Return over time: what the agents' work brought back each month, added up, against what the plan cost, added up.
    const isLate = (q) => q.approvedAt && q.sentAt && (new Date(q.approvedAt) - new Date(q.sentAt)) / 86400000 > 5;
    const isOverduePaid = (v) => v.status === 'paid' && v.dueDate && v.updatedAt && v.updatedAt > v.dueDate;
    const started = planNow && planNow.startedAt ? monthKey(planNow.startedAt) : null;
    const span = started ? months.filter((m) => m >= started) : months;
    let cb = 0, cf = 0;
    const series = span.map((m, i) => {
      cb += sum(won.filter((q) => isLate(q) && monthKey(q.approvedAt) === m), (q) => q.total) + sum(issued.filter((v) => isOverduePaid(v) && monthKey(v.updatedAt) === m), (v) => v.total);
      cf += feeAt(i);
      return { m, back: cb, fees: cf };
    });
    const lastPt = series[series.length - 1];
    // Project forward to 12 months at the pace so far, so the owner sees the gap grow.
    const proj = series.slice();
    if (lastPt && lastPt.back > 0) {
      const perMonth = lastPt.back / series.length;
      let pb = lastPt.back, pf = lastPt.fees;
      const [yy, mm] = lastPt.m.split('-').map(Number);
      for (let i = 1; proj.length < 12; i++) { pb += perMonth; pf += feeAt(series.length - 1 + i); const d = new Date(Date.UTC(yy, mm - 1 + i, 15)); proj.push({ m: d.toISOString().slice(0, 7), back: pb, fees: pf, proj: true }); }
    }
    const roiChart = proj.length > 1 ? returnChart(proj, fmt) : null;
    const roiCard = h('section', { class: 'ov-card' },
      h('h2', null, 'Your return'),
      lastPt && lastPt.back ? h('p', { class: 'lead' }, [h('b', { class: 'goalhl' }, fmt.money(lastPt.back, { short: true })), ' back ' + (started ? 'since you started' : 'over the last ' + series.length + ' months') + (lastPt.fees > 0 ? ', against ' + fmt.money(lastPt.fees, { short: true }) + ' for your plan. That is ' + (lastPt.back / lastPt.fees >= 2 ? Math.round(lastPt.back / lastPt.fees) : (lastPt.back / lastPt.fees).toFixed(1)) + ' times what you paid.' : '.')]) : null,
      roiChart,
      roiChart && proj.some((p) => p.proj) ? h('p', { class: 'fz-hint' }, 'Solid lines are real. Dashed lines show where you land in 12 months if this pace holds: about ' + fmt.money(proj[proj.length - 1].back, { short: true }) + ' back for ' + fmt.money(proj[proj.length - 1].fees, { short: true }) + ' of plan.') : null,
      h('h3', { class: 'ov-h3' }, 'Last 30 days'),
      h('div', { class: 'ov-split' },
        stat('Quotes won after day 5', fmt.money(lateWon, { short: true }), fmt.plural(lateWins.length, 'quote') + ' Jobber’s reminders missed'),
        stat('Overdue invoices paid', fmt.money(collected, { short: true }), fmt.plural(overduePaid.length, 'invoice')),
        stat('Your plan', fmt.money(planCost) + ' a month', FZ.hasOperator && FZ.hasOperator() ? 'Every agent and your Operator' : 'Every agent')),
      h('div', { class: 'fz-card-btns' }, h('a', { class: 'fz-btn act', href: '#plan' }, 'See your plan')));

    // Today: the few decisions that need the owner, with the buttons right on each row. Everything else is the Operator's.
    // Merged with the demo's Needs you: the biggest decisions first, each with its own buttons.
    const TODAY_MAX = 5;
    const todayKey = fmt.dayKey(new Date().toISOString());
    const isToday = (iso) => !!iso && fmt.dayKey(iso) === todayKey;
    const valOf = (t) => { const m = /^\$([\d,]+)/.exec(String(t.meta || '')); return m ? Number(m[1].replace(/,/g, '')) : 0; };
    const skipped = new Set();
    const todayBody = h('div', { class: 'ov-today-list' }, h('p', { class: 'fz-loading' }, 'Reading Jobber\u2026'));
    const todayHead = h('p', { class: 'lead' }, 'Today');
    const todayNote = h('p', { class: 'fz-sub' });
    const todayBtns = h('div', { class: 'fz-card-btns' });
    const todayCard = h('section', { class: 'ov-card ov-today' }, h('h2', null, 'Needs you'), todayHead, todayNote, todayBody, todayBtns);
    const calmLine = h('p', { class: 'ov-calm', hidden: true }, 'Nothing needs you right now. Your agents are on it.');
    // Status line, painted again whenever the task list or the agents' runs change.
    const statusHead = h('p', { class: 'fz-status ov-line' }, 'Reading Jobber\u2026');
    const statusSince = h('p', { class: 'ov-since' });
    // Office today: what is left for the office, and what got done today.
    const officeHead = h('p', { class: 'lead' }, 'Office today');
    const officeBody = h('div', { class: 'ov-office' }, h('p', { class: 'fz-loading' }, 'Reading Jobber\u2026'));
    const officeCard = h('section', { class: 'ov-card' }, h('h2', null, 'Office today'), officeHead, officeBody,
      h('p', { class: 'fz-hint' }, 'One tap each. Open it in Jobber, then press Done so it drops off the list.'));
    const runsToday = () => FZ.AGENTS.map((a) => { const r = (FZ.runs || {})[a.key] || {}; const list = (r.history || []).slice(); if (r.last && !list.includes(r.last)) list.push(r.last); return { a, times: list.filter(isToday).sort() }; }).filter((x) => x.times.length);
    const nextCheck = () => { const t = Object.values(FZ.settings || {}).map((s) => s && s.nextRun).filter((x) => x && new Date(x) > new Date()).sort()[0]; return t || null; };
    const paintStatus = (mine) => {
      const ran = runsToday();
      const loading = !mine;
      mine = mine || [];
      const worth = mine.reduce((n, t) => n + valOf(t), 0);
      const need = mine.length ? [h('b', null, fmt.plural(mine.length, 'thing')), ' need you' + (worth ? ', worth ' : '.'), worth ? h('b', null, fmt.money(worth, { short: true })) : null, worth ? '.' : null] : ['Nothing needs you right now.'];
      const goalPart = target ? ['Goal ', h('b', { class: 'goalhl' }, fmt.money(target, { short: true })), ' a month, ', pace >= target ? 'on pace. ' : ['pacing ', h('b', null, fmt.money(pace, { short: true })), '. ']] : ['Invoicing ', h('b', null, fmt.money(invoicedPerMonth, { short: true })), ' a month. '];
      statusHead.replaceChildren(...[].concat(...goalPart.map((x) => [].concat(x))), ...(loading ? ['Checking what needs you\u2026'] : need.filter(Boolean)));
      const { done } = FZ.tasksNow();
      const doneToday = Object.values(done || {}).filter((d) => d && d.done && isToday(d.at)).length;
      const sentToday = issued.filter((v) => isToday(v.issuedDate)).length;
      const quotedToday = sent.filter((q) => isToday(q.sentAt)).length;
      const nRuns = ran.reduce((n, x) => n + x.times.length, 0);
      const nc = nextCheck();
      statusSince.textContent = 'So far today: ' + [fmt.plural(nRuns, 'agent run'), fmt.plural(doneToday, 'task') + ' done', fmt.plural(quotedToday, 'quote') + ' sent', fmt.plural(sentToday, 'invoice') + ' sent'].join(', ') + '.' + (nc ? ' Next check ' + (isToday(nc) ? fmt.fmtTime(nc) : fmt.fmtDay(nc) + ' ' + fmt.fmtTime(nc)) + '.' : '');
    };
    const needRow = (t) => {
      const v = valOf(t);
      const meta = String(t.meta || '').replace(/^\$[\d,]+\s*\u00b7\s*/, '');
      const btns = h('div', { class: 'ov-need-btns' },
        t.go ? h('a', { class: 'fz-btn act', href: t.go }, t.approve || 'Review it') : h('button', { type: 'button', class: 'fz-btn act', onclick: () => FZ.openTask(t.id, 'call') }, t.approve || 'Review it'),
        t.kind === 'Call' && t.draft ? h('button', { type: 'button', class: 'fz-btn', onclick: () => FZ.openTask(t.id, 'email') }, 'Email instead') : null,
        t.link ? ui.extLink(t.link, 'Open in Jobber', 'fz-btn') : null,
        h('button', { type: 'button', class: 'fz-btn ghost', onclick: () => { skipped.add(t.id); FZ.paintToday(); } }, 'Not now'));
      return h('div', { class: 'ov-need' },
        h('p', { class: 'ov-need-top' }, v ? h('b', null, fmt.money(v)) : null, v && meta ? ' \u00b7 ' : '', meta),
        h('p', { class: 'ov-need-q' }, t.title),
        h('p', { class: 'ov-need-rec' }, (t.ready ? t.ready + '. ' : '') + 'Recommend: ' + recOf(t) + ' today.'),
        btns);
    };
    const paintOffice = (rest) => {
      const { done } = FZ.tasksNow();
      const doneRows = (FZ.tasksNow().list || []).filter((t) => done && done[t.id] && done[t.id].done && isToday(done[t.id].at)).slice(0, 4);
      const withOp = FZ.openExc().filter((x) => x.from === 'owner').slice(0, 3);
      const rows = [
        ...rest.slice(0, 5).map((t) => {
          const b = h('button', { type: 'button', class: 'fz-btn ghost sm' }, 'Done');
          b.addEventListener('click', async () => { b.disabled = true; if (await FZ.saveTask(t.id, true)) { b.textContent = 'Done'; FZ.paintToday(); } else { b.disabled = false; b.textContent = 'Only an editor can do this'; } });
          return h('div', { class: 'ov-off-row' }, h('span', { class: 'ov-off-t' }, t.title, h('small', null, t.meta || '')), h('span', { class: 'ov-off-btns' }, t.link ? ui.extLink(t.link, 'Open in Jobber', 'fz-btn sm') : null, b));
        }),
        ...withOp.map((x) => h('div', { class: 'ov-off-row' }, h('span', { class: 'ov-off-t' }, x.title || 'Handed over', h('small', null, 'With ' + FZ.opWho())), h('span', { class: 'fz-pill' }, 'Handed over'))),
        ...doneRows.map((t) => h('div', { class: 'ov-off-row is-done' }, h('span', { class: 'ov-off-t' }, t.title), h('span', { class: 'fz-pill ok' }, 'Done')))];
      officeHead.textContent = rest.length ? fmt.plural(rest.length, 'thing') + ' left for the office' + (doneRows.length ? ', ' + doneRows.length + ' done today' : '') : (doneRows.length ? 'All done for today' : 'Nothing left for the office today');
      officeBody.replaceChildren(...(rows.length ? rows : [ui.calm('Nothing waiting. New work shows here as the agents find it.')]));
    };
    FZ.paintToday = () => {
      const { list, done } = FZ.tasksNow();
      if (!list) return;
      const picked = FZ.ownerPicks(list.filter((t) => !skipped.has(t.id)), done, list.length);
      const open = picked.open;
      const mine = picked.mine.slice().sort((a, b) => valOf(b) - valOf(a) || b.score - a.score).slice(0, TODAY_MAX);
      const rest = open.length - mine.length;
      const restList = open.filter((t) => !mine.includes(t));
      paintStatus(FZ.isOperator() ? open : mine);
      // Operator view: the work lives in Tasks. The Overview only says how much is waiting.
      if (FZ.isOperator()) {
        const approved = FZ.openExc().filter((x) => x.approved).length;
        todayHead.textContent = 'Your queue today';
        todayNote.textContent = fmt.plural(open.length, 'task') + ' to work' + (approved ? ' and ' + fmt.plural(approved, 'approval') + ' from the owner to carry out.' : '.') + ' The owner sees only what is ready for their OK.';
        todayBody.replaceChildren();
        todayBtns.replaceChildren(h('a', { class: 'fz-btn act', href: '#tasks' }, 'Open Tasks'), h('a', { class: 'fz-cardlink', href: '#all' }, 'Exceptions and agents'));
        return;
      }
      todayCard.hidden = !mine.length; calmLine.hidden = !!mine.length;
      todayHead.textContent = fmt.plural(mine.length, 'thing') + ' need' + (mine.length === 1 ? 's' : '') + ' you, biggest first';
      todayNote.textContent = 'Approve opens it in Tasks. Not now hides it until you open this page again.';
      todayBody.replaceChildren(...mine.map(needRow));
      todayBtns.replaceChildren(
        rest ? h('a', { class: 'fz-cardlink', href: '#tasks' }, 'See all ' + open.length + ' tasks') : null,
        h('a', { class: 'fz-cardlink', href: '#a-morning-brief' }, 'Open Plan Today'));
    };
    FZ.paintToday();
    if (!FZ.tasksNow().list) paintStatus(null);

    // Agents at work, grouped Win, Run, Keep, with today's runs and the one working now.
    const todayRuns = runsToday();
    const workingNow = (a) => { const r = (FZ.runs || {})[a.key]; return !!(r && r.last && Date.now() - new Date(r.last).getTime() < 10 * 60000 && r.lastStatus !== 'error'); };
    const working = FZ.AGENTS.filter(workingNow);
    const counts = { green: 0, amber: 0, red: 0, grey: 0 };
    FZ.AGENTS.forEach((a) => { counts[FZ.health(a).tone]++; });
    const nExc = FZ.openExc().length;
    const agentsCard = h('section', { class: 'ov-card' },
      h('h2', null, 'Your agents'),
      h('p', { class: 'lead' }, fmt.plural(FZ.AGENTS.filter((a) => a.core).length, 'agent') + ' working for you' + (todayRuns.length ? ', ' + todayRuns.length + ' ran today' : '')),
      h('div', { class: 'agsum' },
        h('span', { class: 'chip' }, h('span', { class: 'dot green' }), counts.green + (FZ.isOperator() ? ' on a schedule' : ' running')),
        counts.amber ? h('span', { class: 'chip' }, h('span', { class: 'dot amber' }), counts.amber + ' live view only') : null,
        counts.red ? h('span', { class: 'chip' }, h('span', { class: 'dot red' }), fmt.plural(counts.red, 'error')) : null,
        FZ.isOperator() ? h('span', { class: 'chip' }, h('span', { class: 'dot ' + (nExc ? 'red' : 'green') }), nExc ? fmt.plural(nExc, 'exception') + ' need a person' : 'No exceptions') : null),
      FZ.isOperator() ? h('p', { class: 'fz-sub' }, FZ.AGENTS.length + ' agents across Win, Run and Keep. Each one moves a number above.')
        : h('div', null,
          ['growth', 'run', 'keep'].map((g) => {
            const list = FZ.AGENTS.filter((a) => a.core && a.group === g);
            if (!list.length) return null;
            return h('div', { class: 'ov-aggroup' }, h('h3', { class: 'ov-h3' }, (FZ.GROUPS.find((x) => x.id === g) || {}).name || g),
              h('div', { class: 'ov-goals' }, list.map((a) => { const m = FZ.metricOf(a.key); const hs = FZ.health(a); const nToday = (todayRuns.find((x) => x.a.key === a.key) || { times: [] }).times.length; const working = workingNow(a); return h('a', { class: 'ov-goal' + (working ? ' is-working' : ''), href: '#a-' + a.key },
                h('span', { class: 'top' }, h('span', { class: 'g' }, a.groupName.replace(' agents', '')), h('span', { class: 'st' }, h('span', { class: 'dot ' + hs.tone }), working ? 'Working now' : hs.tone === 'green' ? (FZ.isOperator() ? 'Scheduled' : 'Running') : 'Live view')),
                h('b', null, a.name),
                h('span', { class: 'goal' }, (FZ.GOALS[a.key] || a.does)),
                h('span', { class: 'foot' },
                  m && m.value ? h('span', { class: 'now' }, m.value) : h('span', { class: 'now none' }, 'Measures ' + (a.num || 'results').toLowerCase()),
                  m && m.value && m.detail ? h('span', { class: 'det' }, m.detail) : h('span', { class: 'det go' }, 'Open agent \u2192'),
                  nToday ? h('span', { class: 'det' }, 'Ran ' + fmt.plural(nToday, 'time') + ' today') : null)); })));
          }),
          h('p', { class: 'fz-sub' }, (working.length ? 'Now: ' + working.map((a) => a.name).join(', ') + '. ' : '') + 'Win brings work in, Run gets it done and paid, Keep brings customers back.')),
      h('div', { class: 'fz-card-btns' }, h('a', { class: 'fz-btn act', href: '#all' }, 'See all ' + FZ.AGENTS.length + ' agents')));

    // ---- This month: three numbers, each against last month and pace ----
    const lastMonth = months[4];
    const dom = (iso) => Number(fmt.dayKey(iso).slice(8, 10));
    const byNow = (iso) => iso && monthKey(iso) === lastMonth && dom(iso) <= dayOfMonth;
    const wonThis = won.filter((q) => q.approvedAt && monthKey(q.approvedAt) === thisMonth);
    const wonLast = won.filter((q) => byNow(q.approvedAt));
    const invLast = sum(issued.filter((v) => byNow(v.issuedDate)), (v) => v.total);
    const pastDueOldest = pastDue.reduce((n, v) => Math.max(n, fmt.daysSince(v.dueDate) || 0), 0);
    const stale = waitingQuotes.filter((q) => q.sentAt && fmt.daysSince(q.sentAt) > 2);
    const cmp = (now, then, money) => then ? (now >= then ? 'Up from ' : 'Down from ') + (money ? fmt.money(then, { short: true }) : then) + ' by this day last month' : 'None by this day last month';
    const paceMark = dayOfMonth / daysInMonth;
    const mTile = (l, v, s1, s2, extra) => h('div', { class: 'ov-stat ov-mtile' }, h('span', { class: 'l' }, l), h('span', { class: 'v' }, v), extra || null, h('span', { class: 's' }, s1), s2 ? h('span', { class: 's' }, s2) : null);
    const goalBar = target ? h('div', { class: 'ov-mbar', role: 'img', 'aria-label': fmt.money(invThisMonth, { short: true }) + ' of ' + fmt.money(target, { short: true }) + ', pace mark at ' + Math.round(paceMark * 100) + ' percent' },
      h('span', { class: 'fill', style: 'width:' + Math.min(100, invThisMonth / target * 100).toFixed(1) + '%' }),
      h('span', { class: 'mark', style: 'left:' + (paceMark * 100).toFixed(1) + '%' })) : null;
    const monthCard = h('section', { class: 'ov-card' },
      h('h2', null, 'This month'),
      h('p', { class: 'lead' }, target ? (invThisMonth >= target * paceMark ? 'Invoicing is ahead of pace' : 'Invoicing is behind pace') : 'Money this month'),
      h('div', { class: 'ov-mgrid' },
        mTile('Overdue now', fmt.money(overdue, { short: true }), fmt.plural(pastDue.length, 'invoice') + ' past due' + (pastDueOldest ? ', oldest ' + fmt.plural(pastDueOldest, 'day') + ' late.' : '.'), fmt.plural(unpaidUnique.length, 'invoice') + ' waiting to be paid in all.'),
        mTile('Quotes won this month', String(wonThis.length) + (wonThis.length ? ', ' + fmt.money(sum(wonThis, (q) => q.total), { short: true }) : ''), cmp(wonThis.length, wonLast.length, false), fmt.plural(stale.length, 'quote') + ' waiting more than 2 days for a follow up.'),
        mTile('Invoiced this month', fmt.money(invThisMonth, { short: true }) + (target ? ' of ' + fmt.money(target, { short: true }) : ''), cmp(invThisMonth, invLast, true), target ? 'The orange mark is where you should be today.' : 'Set a goal below to see your pace.', goalBar)),
      h('p', { class: 'fz-hint' }, 'If a number is down, open the agent for it on the Agents tab.'));

    // ---- This week: booked jobs by day, forecast on top when the Weather Watch has it ----
    const HOME = (forecastDoc && forecastDoc.home) || (((forecastDoc && forecastDoc.periods) || [])[0] || {}).area || '';
    const periods = ((forecastDoc && forecastDoc.periods) || []).filter((p) => p.area === HOME && String(p.daytime) === 'true');
    const riskOf = (p) => !p ? null : String(p.snow) === 'true' ? 'Snow' : Number(p.wind_mph) >= 25 ? 'High wind' : Number(p.temp_f) < 20 ? 'Deep cold' : null;
    const clientOf = (t) => fmt.clean(String(t || '').split(' - ')[0]);
    const week = Array.from({ length: 7 }, (_, i) => fmt.dayKey(new Date(Date.now() + i * 86400000).toISOString()));
    const wkRows = visits.map((v) => ({ v, date: fmt.dayKey(v.startAt) })).filter((r) => week.includes(r.date));
    const wkRisky = wkRows.filter((r) => riskOf(periods.find((p) => p.date === r.date)));
    const weekCard = h('section', { class: 'ov-card' },
      h('h2', null, 'This week'),
      h('p', { class: 'lead' }, fmt.plural(wkRows.length, 'booked job') + ' in the next 7 days' + (periods.length ? (wkRisky.length ? ', ' + wkRisky.length + ' on a day with weather to watch' : ', weather looks workable') : '')),
      h('div', { class: 'fz-week ov-week' }, week.filter((date) => wkRows.some((r) => r.date === date)).map((date) => { const i = week.indexOf(date);
        const p = periods.find((x) => x.date === date);
        const risk = riskOf(p);
        const jobs = wkRows.filter((r) => r.date === date);
        const d = new Date(date + 'T12:00:00Z');
        return h('div', { class: 'fz-day' + (risk ? ' flag' : '') + (i === 0 ? ' is-today' : '') },
          h('span', { class: 'dn' }, d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }) + (i === 0 ? ', today ' : ' '), h('span', null, String(jobs.length))),
          p ? h('span', { class: 'ov-wx', title: p.forecast }, fmt.clean(String(p.forecast || '').split(/ then |,/i)[0]) + ' ' + p.temp_f + '°') : null,
          risk ? h('span', { class: 'flagtxt' }, risk) : null,
          h('div', { class: 'jobs' }, jobs.length ? jobs.map((r) => h(r.v.job ? 'a' : 'span', { class: 'fz-chip', href: r.v.job ? r.v.job.jobberWebUri : null, target: r.v.job ? '_blank' : null, rel: r.v.job ? 'noopener' : null },
            h('span', { class: 't' }, (r.v.allDay ? 'All day' : fmt.fmtTime(r.v.startAt)) + ((r.v.assignedUsers || []).length ? ', ' + fmt.clean(r.v.assignedUsers[0].name).split(' ')[0] : '')), clientOf(r.v.title),
            risk ? h('span', { class: 'ov-chipnote' }, 'Check the weather') : null)) : h('span', { class: 'fz-none' }, 'No jobs')));
      })),
      h('p', { class: 'fz-sub' }, 'Tap a job to open it in Jobber.' + (periods.length ? ' Forecast from the Weather Watch each morning.' : '')));

    // ---- Money path this month: quoted, won, done, invoiced, paid ----
    const quotedM = sum(sent.filter((q) => monthKey(q.sentAt) === thisMonth), (q) => q.total);
    const wonM = sum(wonThis, (q) => q.total);
    const waitingInv = sum(needInvoice, (j) => j.total);
    const paidM = sum(issued.filter((v) => monthKey(v.issuedDate) === thisMonth && v.status === 'paid'), (v) => v.total);
    const path = [['Quoted', quotedM], ['Won', wonM], ['Done', invThisMonth + waitingInv], ['Invoiced', invThisMonth], ['Paid', paidM]];
    const GAPS = ['quotes not won yet', 'won work not done yet', 'finished work not invoiced yet', 'invoices not paid yet'];
    let gi = -1, gv = 0;
    path.slice(1).forEach((s2, i) => { const d = path[i][1] - s2[1]; if (d > gv) { gv = d; gi = i; } });
    const pmax = Math.max(1, ...path.map((x) => x[1]));
    const moneyCard = h('section', { class: 'ov-card' },
      h('h2', null, 'Money path, this month'),
      h('p', { class: 'lead' }, gi >= 0 ? ['The biggest gap is ' + GAPS[gi] + ', ', h('b', null, fmt.money(gv, { short: true }))] : 'No gap between the steps this month'),
      h('p', { class: 'fz-sub' }, 'Dollars at each step from quoted to paid. Work on the orange step first.'),
      h('div', { class: 'ov-path' }, path.map(([l, v], i) => h('div', { class: 'ov-path-row' + (i === gi + 1 && gi >= 0 ? ' gap' : '') },
        h('span', { class: 'l' }, l),
        h('span', { class: 'track' }, h('span', { class: 'fill', style: 'width:' + Math.max(v > 0 ? 2 : 0, v / pmax * 100).toFixed(1) + '%' })),
        h('b', null, fmt.money(v, { short: true }))))),
    );
    const hasMoney = path.some((x) => x[1] > 0);

    // ---- What they told each other today: real runs and hand offs only ----
    const feed = [];
    todayRuns.forEach(({ a, times }) => { const m = FZ.metricOf(a.key); feed.push({ at: times[times.length - 1], a, text: m && m.value ? m.value + (m.detail ? '. ' + m.detail : '') : 'Ran on schedule' + (times.length > 1 ? ', ' + times.length + ' times today' : '') }); });
    FZ.openExc().filter((x) => isToday(x.createdAt)).forEach((x) => { const a = FZ.byKey(x.agent); feed.push({ at: x.createdAt, a, text: 'Handed to a person: ' + (x.title || 'needs a look') }); });
    feed.sort((x, y) => String(y.at).localeCompare(String(x.at)));
    const grpTag = (a) => a ? a.groupName.replace(' agents', '') : 'Office';
    if (feed.length) agentsCard.insertBefore(h('div', { class: 'ov-feedwrap' }, h('h3', { class: 'ov-h3' }, 'What they told each other today'),
      h('div', { class: 'ov-feed' }, feed.slice(0, 6).map((f) => h('div', { class: 'ov-feed-row' },
        h('span', { class: 'g' }, grpTag(f.a)),
        h('span', { class: 'tx' }, h('b', null, f.a ? f.a.name : 'Office'), ' › ' + f.text),
        h('span', { class: 'tm' }, f.at ? fmt.fmtTime(f.at) : ''))))), agentsCard.querySelector(':scope > .fz-card-btns'));

    status.classList.add('ov-line');
    // ================= Trades demo layout, filled with this shop's own data =================
    const short = (a) => String(a.name || '').replace(/ Agent$/, '');
    const tagOf = (a) => a ? a.groupName.replace(' agents', '').toUpperCase() : 'OFFICE';
    const D = (cls, ...kids) => h('div', { class: cls }, ...kids);
    const panelHead = (eb, title, sub, right) => D('dt-phead', D('dt-pl', h('p', { class: 'dt-eb' }, eb), h('h2', { class: 'dt-t' }, ...[].concat(title)), sub ? h('p', { class: 'dt-sub' }, sub) : null), right ? h('span', { class: 'dt-right' }, right) : null);
    const ICO = { doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>', money: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>', cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>', cloud: '<path d="M17.5 19H8a5 5 0 1 1 1.6-9.7A6 6 0 0 1 21 12.5 3.5 3.5 0 0 1 17.5 19z"/>' };
    const ico = (k) => { const s2 = h('span', { class: 'dt-ico', 'aria-hidden': 'true' }); s2.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + (ICO[k] || ICO.doc) + '</svg>'; return s2; };
    const icoFor = (t) => ({ 'quote-chaser': 'doc', 'yes-to-install': 'cal', 'bill-it': 'money', 'get-paid': 'money', 'lead-catcher': 'user', 'weather-watch': 'cloud', 'install-scheduler': 'cal', 'quotes': 'doc' })[t.agent] || 'doc';

    // 1 Header and 2 status
    const syncedAt = fmt.fmtTime(new Date().toISOString());
    const dtHead = D('dt-head', h('h1', { class: 'dt-name' }, FZ.biz()), h('span', { class: 'dt-live' }, h('span', { class: 'dot green' }), 'Live · Jobber synced ' + syncedAt));
    const dtStatus = h('p', { class: 'dt-status' }, 'Reading Jobber…');
    const dtSince = h('p', { class: 'dt-since', hidden: true });
    // 3 Needs you
    const dtNeedsList = D('dt-needs');
    const dtNeedsMore = h('p', { class: 'dt-more', hidden: true });
    const dtNeeds = h('section', { class: 'dt-sec', hidden: true }, h('p', { class: 'dt-eb' }, 'Needs you, biggest first'), dtNeedsList, dtNeedsMore);
    // 7 Office today
    const dtOfficeTitle = h('h2', { class: 'dt-t' });
    const dtOfficeList = D('dt-office');
    const dtOffice = h('section', { class: 'dt-panel', hidden: true }, D('dt-phead', D('dt-pl', h('p', { class: 'dt-eb' }, 'Office today'), dtOfficeTitle, h('p', { class: 'dt-sub' }, 'What the agents left for your office, one tap each.'))), dtOfficeList);
    const dtNeedRow = (t) => {
      const v = valOf(t);
      const meta = String(t.meta || '').replace(/^\$[\d,]+\s*·\s*/, '');
      return D('dt-need', ico(icoFor(t)),
        D('dt-need-main',
          h('p', { class: 'dt-need-top' }, v ? h('b', null, fmt.money(v)) : null, v && meta ? ' · ' : '', meta),
          h('p', { class: 'dt-need-q' }, t.title + '?'),
          h('p', { class: 'dt-need-rec' }, (t.ready ? t.ready + '. ' : '') + 'Recommend: ' + recOf(t) + ' today.')),
        D('dt-need-btns',
          t.go ? h('a', { class: 'dt-btn pri', href: t.go }, t.approve || 'Review it') : h('button', { type: 'button', class: 'dt-btn pri', onclick: () => FZ.openTask(t.id, 'call') }, t.approve || 'Review it'),
          t.kind === 'Call' && t.draft ? h('button', { type: 'button', class: 'dt-btn', onclick: () => FZ.openTask(t.id, 'email') }, 'Email instead') : null,
          t.link ? ui.extLink(t.link, 'Open in Jobber', 'dt-btn') : null,
          h('button', { type: 'button', class: 'dt-btn', onclick: () => { skipped.add(t.id); FZ.paintToday(); } }, 'Not now')));
    };
    const paintDt = () => {
      const { list, done } = FZ.tasksNow();
      if (!list) return;
      const picked = FZ.ownerPicks(list.filter((t) => !skipped.has(t.id)), done, list.length);
      const mine = picked.mine.slice().sort((x, y) => valOf(y) - valOf(x) || y.score - x.score).slice(0, 3);
      const rest = picked.open.filter((t) => !mine.includes(t));
      // One total everywhere: the same count as the bell and the Tasks tab.
      const all = FZ.ownerPicks(list, done, list.length).open;
      const total = all.length;
      const worth = all.reduce((n, t) => n + valOf(t), 0);
      const ran = runsToday();
      dtStatus.replaceChildren(...[].concat(
        total ? (FZ.isOperator() ? h('b', null, fmt.plural(total, 'task') + ' for a person' + (worth ? ', worth ' + fmt.money(worth, { short: true }) : '') + '.')
          : [h('b', null, fmt.plural(total, 'task') + ' to approve' + (worth ? ', worth ' + fmt.money(worth, { short: true }) : '') + '.'), h('span', { class: 'dt-more' }, total > mine.length ? 'The biggest ' + mine.length + ' are below.' : 'Each one is below.')]) : h('b', { class: 'ok' }, 'Nothing needs you right now.')));
      const doneToday = Object.values(done || {}).filter((d) => d && d.done && isToday(d.at)).length;
      const bits = [];
      const nRuns = ran.reduce((n, x) => n + x.times.length, 0);
      if (nRuns) bits.push(fmt.plural(nRuns, 'agent run'));
      if (doneToday) bits.push(fmt.plural(doneToday, 'task') + ' done');
      const qT = sent.filter((q) => isToday(q.sentAt)).length; if (qT) bits.push(fmt.plural(qT, 'quote') + ' sent');
      const iT = issued.filter((v) => isToday(v.issuedDate)).length; if (iT) bits.push(fmt.plural(iT, 'job') + ' invoiced');
      const nc = nextCheck();
      dtSince.hidden = !bits.length && !nc;
      dtSince.textContent = (bits.length ? 'Today: ' + bits.join(', ') + '.' : '') + (nc ? (bits.length ? ' ' : '') + 'Next check ' + (isToday(nc) ? fmt.fmtTime(nc) : fmt.fmtDay(nc) + ' ' + fmt.fmtTime(nc)) + '.' : '');
      dtNeeds.hidden = !mine.length || FZ.isOperator();
      dtNeedsList.replaceChildren(...mine.map(dtNeedRow));
      dtNeedsMore.hidden = total <= mine.length;
      dtNeedsMore.replaceChildren(h('a', { href: '#tasks' }, 'and ' + (total - mine.length) + ' more ready for your OK'));
      // Office today
      const doneRows = list.filter((t) => done && done[t.id] && done[t.id].done && isToday(done[t.id].at)).slice(0, 3);
      const left = rest.slice(0, 5);
      dtOffice.hidden = !(left.length || doneRows.length);
      dtOfficeTitle.textContent = left.length ? (FZ.isOperator() ? fmt.plural(rest.length, 'thing') + ' left' + (doneRows.length ? ', the rest is done' : ' for the office') : rest.length + ' more ready for your OK') : 'All done for today';
      dtOfficeList.replaceChildren(
        ...left.map((t) => {
          const box = h('button', { type: 'button', class: 'dt-check', 'aria-label': 'Mark done: ' + t.title });
          box.addEventListener('click', async () => { box.disabled = true; if (await FZ.saveTask(t.id, true)) FZ.paintToday(); else box.disabled = false; });
          return D('dt-orow', box, h('span', { class: 'dt-ot' }, t.title), t.link ? ui.extLink(t.link, 'Open in Jobber', 'dt-oact') : h('span', { class: 'dt-oact' }, t.meta || ''));
        }),
        ...doneRows.map((t) => D('dt-orow is-done', h('span', { class: 'dt-check on', 'aria-hidden': 'true' }), h('span', { class: 'dt-ot' }, t.title), h('span', { class: 'dt-oact' }, 'Done'))));
      dtMoneyRow.classList.toggle('one', dtOffice.hidden);
    };
    const basePaint = FZ.paintToday;
    FZ.paintToday = () => { basePaint(); paintDt(); };

    // 4 This month
    // Pace only means something from day 8. Before that, no behind marks.
    const showPace = dayOfMonth >= 8;
    const fasterLine = showPace && invLast ? (invThisMonth >= invLast ? 'Money is moving faster than last month' : 'Money is moving slower than last month') : 'Where your money stands';
    const tile = (eb, big, cmpLine, note, extra) => D('dt-tile', h('p', { class: 'dt-eb2' }, eb), h('p', { class: 'dt-big' }, ...[].concat(big)), extra || null, cmpLine ? h('p', { class: 'dt-cmp' }, cmpLine) : null, note ? h('p', { class: 'dt-note' }, note) : null);
    const goalBar2 = target && showPace ? D('dt-bar', h('span', { class: 'fill', style: 'width:' + Math.min(100, invThisMonth / target * 100).toFixed(1) + '%' }), h('span', { class: 'mark', style: 'left:' + (paceMark * 100).toFixed(1) + '%' })) : null;
    const monthTitle = new Date().toLocaleDateString('en-US', { timeZone: fmt.TZ, month: 'short' }) + ' 1 to today';
    // Each tile leads with a number that is not zero. When this month's number is 0, it leads with a wider window from the same data.
    const inv30 = issued.filter((v) => fmt.daysSince(v.issuedDate) <= 30);
    const sent90 = sent.filter((q) => fmt.daysSince(q.sentAt) <= 90);
    const won90 = sent90.filter((q) => q.status === 'approved' || q.status === 'converted');
    const used = new Set();
    const pick = (list) => { const c = list.find((x) => x.n > 0 && !used.has(x.id)) || list[0]; used.add(c.id); return c; };
    const ALT = {
      inv30: { id: 'inv30', n: sum(inv30, (v) => v.total), eb: 'Invoiced, last 30 days', big: () => fmt.money(sum(inv30, (v) => v.total), { short: true }), cmp: () => fmt.plural(inv30.length, 'invoice') + ' sent', note: () => null },
      waitQ: { id: 'waitQ', n: waitingDollars, eb: 'Quotes waiting for a yes', big: () => fmt.money(waitingDollars, { short: true }), cmp: () => fmt.plural(waitingQuotes.length, 'quote') + ' out with customers', note: () => stale.length ? fmt.plural(stale.length, 'quote') + ' waiting more than 2 days, with the Chase Quotes Agent.' : null },
      won90: { id: 'won90', n: won90.length, eb: 'Quotes won, last 90 days', big: () => [String(won90.length), h('small', null, ' of ' + sent90.length + ' sent')], cmp: () => fmt.money(sum(won90, (q) => q.total), { short: true }) + ' won', note: () => null }
    };
    const tOwed = pick([
      { id: 'owed', n: owed, eb: 'Waiting to be paid', big: () => fmt.money(owed, { short: true }), cmp: () => overdue ? fmt.money(overdue, { short: true }) + ' of it is overdue' : 'Nothing overdue', note: () => unpaidUnique.length ? fmt.plural(unpaidUnique.length, 'invoice') + '. Oldest is ' + fmt.plural(unpaidUnique.reduce((n, v) => Math.max(n, fmt.daysSince(v.issuedDate) || 0), 0), 'day') + ', with the Collect Payments Agent.' : null },
      ALT.waitQ, ALT.inv30, ALT.won90]);
    const tWon = pick([
      { id: 'wonM', n: wonThis.length, eb: 'Quotes won this month', big: () => [String(wonThis.length), h('small', null, ' worth ' + fmt.money(sum(wonThis, (q) => q.total), { short: true }))], cmp: () => wonLast.length ? 'Last month by this day ' + wonLast.length : null, note: () => stale.length ? fmt.plural(stale.length, 'quote') + ' waiting more than 2 days, with the Chase Quotes Agent.' : null },
      ALT.won90, ALT.waitQ, ALT.inv30]);
    const tInv = pick([
      { id: 'invM', n: invThisMonth, eb: 'Invoiced this month', big: () => [fmt.money(invThisMonth, { short: true }), target ? h('small', null, ' of ' + fmt.money(target, { short: true }) + ' goal') : null], cmp: () => target && showPace ? (invThisMonth >= target * paceMark ? 'Ahead of pace. ' : 'Behind pace. ') + 'The orange mark is where you should be today.' : null, note: () => invLast ? 'Last month by this day ' + fmt.money(invLast, { short: true }) + '.' : null, bar: true },
      ALT.inv30, ALT.waitQ, ALT.won90]);
    const mk = (c) => c.n > 0 ? tile(c.eb, c.big(), c.cmp(), c.note(), c.bar ? goalBar2 : null) : tile(c.eb, h('small', null, 'None yet'), null, 'Shows here once Jobber has some.');
    const dtMonth = h('section', { class: 'dt-panel' },
      panelHead('This month', fasterLine, showPace ? 'Three numbers, each against last month and your pace.' : 'Three numbers from Jobber. Your pace shows from day 8.', monthTitle),
      D('dt-tiles', mk(tOwed), mk(tWon), mk(tInv)));

    // 5 This week: a compact strip, today first. Weekdays always, Sat and Sun only when they have jobs.
    const fcAt = forecastDoc && (forecastDoc.updatedAt || forecastDoc.asOf);
    const WX = { sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
      cloud: '<path d="M17.5 19H8a5 5 0 1 1 1.6-9.7A6 6 0 0 1 21 12.5 3.5 3.5 0 0 1 17.5 19z"/>',
      snow: '<path d="M12 2v20M4 6l16 12M20 6L4 18"/>',
      wind: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>' };
    const wxKind = (p) => String(p.snow) === 'true' || /snow/i.test(p.forecast || '') ? 'snow' : Number(p.wind_mph) >= 25 ? 'wind' : /cloud|overcast|rain|shower|fog/i.test(p.forecast || '') ? 'cloud' : 'sun';
    const wxIco = (k) => { const s2 = h('span', { class: 'dt-wxi ' + k, 'aria-hidden': 'true' }); s2.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + WX[k] + '</svg>'; return s2; };
    const dowOf = (date) => new Date(date + 'T12:00:00Z').getUTCDay();
    const stripDays = week.filter((date) => { const d = dowOf(date); return (d >= 1 && d <= 5) || wkRows.some((r) => r.date === date); });
    const dayName = (date) => new Date(date + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    const crewOf = (v) => (v.assignedUsers || []).length ? fmt.clean(v.assignedUsers[0].name).trim().charAt(0).toUpperCase() : '';
    const tShort = (v) => v.allDay ? 'All day' : fmt.fmtTime(v.startAt).replace(/\s?[ap]\.?m\.?$/i, '');
    let wkHead;
    if (wkRisky.length) {
      const r0 = wkRisky[0], risk0 = riskOf(periods.find((p) => p.date === r0.date));
      const sameDay = wkRisky.every((r) => r.date === r0.date);
      const what = { 'Snow': 'snow forecast', 'High wind': 'high wind forecast', 'Deep cold': 'deep cold forecast' }[risk0] || 'weather to watch';
      wkHead = wkRisky.length === 1 ? '1 job has ' + what + ': ' + clientOf(r0.v.title) + ', ' + dayName(r0.date)
        : fmt.plural(wkRisky.length, 'job') + ' have ' + (sameDay ? what + ' on ' + dayName(r0.date) : 'weather to watch');
    } else wkHead = fmt.plural(wkRows.length, 'booked job') + ' this week' + (periods.length ? ', weather looks workable' : '');
    const dtWeek = wkRows.length ? h('section', { class: 'dt-panel' },
      panelHead('This week', wkHead, 'Your booked jobs for the next 7 days' + (periods.length ? ', with the forecast for each day.' : '.'), 'From Jobber' + (periods.length ? ' and the forecast' + (fcAt ? ', ' + fmt.fmtTime(fcAt) : '') : '')),
      D('dt-strip', ...stripDays.map((date) => {
        const i = week.indexOf(date);
        const p = periods.find((x) => x.date === date);
        const risk = riskOf(p);
        const jobs = wkRows.filter((r) => r.date === date);
        return D('dt-sday' + (i === 0 ? ' today' : '') + (risk ? ' risk' : ''),
          D('dt-sdh', h('b', null, dayName(date) + (i === 0 ? ', today' : '')),
            p ? h('span', { class: 'dt-swx', title: p.forecast || '' }, wxIco(wxKind(p)), String(p.temp_f) + '°') : null),
          risk ? h('p', { class: 'dt-sflag' }, risk) : null,
          D('dt-sjobs', ...(jobs.length ? jobs.map((r) => { const c = crewOf(r.v);
            return h(r.v.job ? 'a' : 'span', { class: 'dt-schip' + (risk ? ' warn' : ''), href: r.v.job ? r.v.job.jobberWebUri : null, target: r.v.job ? '_blank' : null, rel: r.v.job ? 'noopener' : null, title: clientOf(r.v.title) },
              h('b', null, tShort(r.v)), ' ' + clientOf(r.v.title) + (c ? ' · ' + c : '')); })
            : [h('span', { class: 'dt-snone' }, 'No jobs')])));
      })),
      // Weather risk is only useful with something to do about it (Matt, Nov 7): a heads up text for each job at risk.
      wkRisky.length ? D('dt-wact', ...wkRisky.slice(0, 3).map((r) => {
        const risk = riskOf(periods.find((p) => p.date === r.date)) || 'Bad weather';
        const who = clientOf(r.v.title); const first = String(who).split(/\s+/)[0] || 'there';
        const txt = 'Hi ' + first + ', it is ' + FZ.me().first + ' at ' + FZ.biz() + '. ' + risk + ' is forecast for ' + dayName(r.date) + ', the day of your install. We may need to move it a day or two. I will confirm the day before. Thanks for your patience.';
        const b = h('button', { type: 'button', class: 'fz-btn' }, 'Copy a heads up text');
        b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(txt); b.textContent = 'Copied. Text it to ' + first; } catch (e) { b.textContent = 'Could not copy'; } });
        return D('dt-wrow', h('span', null, h('b', null, who), ' · ' + dayName(r.date) + ' · ' + risk), b, r.v.job ? h('a', { class: 'fz-tlink', href: r.v.job.jobberWebUri, target: '_blank', rel: 'noopener' }, 'Move it in Jobber') : null);
      }), h('style', null, '.dt-wact{display:flex;flex-direction:column;gap:10px;margin-top:16px;padding-top:16px;border-top:1px solid var(--line)}.dt-wrow{display:flex;align-items:center;gap:14px;flex-wrap:wrap;font-size:14px;color:var(--muted)}.dt-wrow b{color:var(--fg)}.dt-wrow>span{flex:1;min-width:200px}')) : null) : null;

    // 6 Money path
    const STEP_NOTE = ['quoted and not won yet. The Chase Quotes Agent follows up every open quote.', 'won and not done yet. The Book Jobs Agent books every yes.', 'of finished work not invoiced yet. The Send Invoices Agent invoices it.', 'invoiced and not paid yet. The Collect Payments Agent nudges every late one.'];
    const GAP_T = ['quotes not yet won', 'won work not yet done', 'finished work not yet invoiced', 'invoices not yet paid'];
    // Only steps with money in them are drawn. The gap mark sits on the step after the gap, or on the step before it when that one is empty.
    const gapAt = gi < 0 ? -1 : path[gi + 1][1] > 0 ? gi + 1 : gi;
    const dtMoney = hasMoney ? h('section', { class: 'dt-panel' },
      panelHead('Money path, this month', gi >= 0 ? 'The biggest gap is ' + GAP_T[gi] : 'Money is moving through every step', 'Dollars at each step, from quoted to paid.'),
      D('dt-cols', path.map(([l, v], i) => v > 0 ? D('dt-col' + (i === gapAt ? ' gap' : ''), h('b', null, fmt.money(v, { short: true })), h('span', { class: 'bar', style: 'height:' + Math.max(4, v / pmax * 100).toFixed(1) + '%' }), h('span', { class: 'l' }, l)) : null)),
      gi >= 0 ? h('p', { class: 'dt-callout' }, fmt.money(gv, { short: true }) + ' ' + STEP_NOTE[gi]) : null)
      : h('section', { class: 'dt-panel' }, panelHead('Money path, this month', 'No money has moved yet this month', 'Quotes, jobs and invoices show here as they happen in Jobber.'));
    const dtMoneyRow = D('dt-row2', dtMoney, dtOffice);

    // 8 Your agents and 9 what they told each other
    const coreAgents = FZ.AGENTS.filter((a) => a.core);
    const dtAgents = h('section', { class: 'dt-panel' },
      panelHead('Your agents', [FZ.AGENTS.length + ' agents, ' + coreAgents.length + ' core, keep the office moving. ', working.length ? h('span', { class: 'okt' }, working.length + ' ' + (working.length === 1 ? 'is' : 'are') + ' working now.') : null], (counts.green === FZ.AGENTS.length ? 'All ' + FZ.AGENTS.length + ' agents running. ' : counts.green + ' of ' + FZ.AGENTS.length + ' agents running. ') + coreAgents.length + ' core agents shown. Win brings work in, Run gets it done and paid, Keep brings customers back.', working.length ? [h('span', { class: 'dot green' }), ' Now: ' + working.map(short).join(', ')] : null),
      D('dt-agents', ['growth', 'run', 'keep'].flatMap((g) => coreAgents.filter((a) => a.group === g)).map((a) => {
        const m = FZ.metricOf(a.key);
        const n = (todayRuns.find((x) => x.a.key === a.key) || { times: [] }).times.length;
        const wk = workingNow(a);
        const res = m && m.value && !/^\$?0\b/.test(m.value) ? m.value : n ? 'Ran ' + fmt.plural(n, 'time') + ' today' : null;
        return h('a', { class: 'dt-agent' + (wk ? ' on' : ''), href: '#a-' + a.key },
          h('span', { class: 'dt-tag' + (wk ? ' on' : '') }, tagOf(a)),
          h('b', null, short(a)),
          h('span', { class: 'dt-ado' }, a.does),
          wk ? h('span', { class: 'dt-ares okt' }, h('span', { class: 'dot green' }), ' Working now') : res ? h('span', { class: 'dt-ares' }, res) : null);
      })),
      feed.length ? D('dt-feedwrap', h('p', { class: 'dt-eb2' }, 'What they told each other today'),
        D('dt-feed', feed.slice(0, 6).map((f) => D('dt-frow', h('span', { class: 'dt-tag' }, tagOf(f.a)), h('span', { class: 'dt-ftx' }, h('b', null, f.a ? short(f.a) : 'Office'), ' › ' + f.text), h('span', { class: 'dt-ftm' }, f.at ? (Date.now() - new Date(f.at).getTime() < 5 * 60000 ? 'now' : fmt.fmtTime(f.at)) : ''))))) : (() => {
        const ag = (k) => FZ.AGENTS.find((x) => x.key === k);
        const MOCK = [
          ['builder-engine', 'Hand off to Draft Quotes: 2 new permits near Breckenridge. One builder asked for shower glass pricing.', '5:02am'],
          ['quote-prep', 'Claimed both. Drafted from your price book, ready for your OK by 9am.', '5:26am'],
          ['quote-chaser', '3 quotes past Jobber reminders. Follow ups written, one waits for you above.', '5:33am'],
          ['get-paid', 'One invoice over 60 days. Handed to Rob for a call, the rest got a friendly nudge.', '5:51am'],
          ['morning-brief', 'Your brief is ready. 4 things need you, worth about $12k.', '6:17am']
        ].filter(([k]) => ag(k));
        return false && MOCK.length ? D('dt-feedwrap', h('p', { class: 'dt-eb2' }, 'Agent message board', h('span', { class: 'dt-extag' }, 'Example')), h('p', { class: 'dt-note' }, 'Example of how your agents hand work to each other.'),
          D('dt-feed is-example', MOCK.map(([k, t, tm]) => D('dt-frow', h('span', { class: 'dt-tag' }, tagOf(ag(k))), h('span', { class: 'dt-ftx' }, h('b', null, short(ag(k))), ' › ' + t), h('span', { class: 'dt-ftm' }, tm))))) : null;
      })());

    const dtFoot = D('dt-foot', h('span', null, 'Sources: Jobber' + (periods.length ? ', the forecast' : '') + '. Numbers update when you open this page or press Refresh.'), h('a', { href: '#operator' }, 'Need a hand? Ask your Flowzyn Operator'));
    paintDt();

    // Search bar: type what you need, get the agent that does it.
    const dtAsk = D('dt-ask', ask);

    // ---- Your goal: where you are now, where you want to be, how you get there. One section, each number once. ----
    // Each lever gets its own picture: a ring for the goal, one square per quote, week columns for jobs, blocks for what is owed.
    const gap = target && invoicedPerMonth > 0 ? Math.max(0, target - invoicedPerMonth) : 0;
    const pctGoal = target && invoicedPerMonth > 0 ? invoicedPerMonth / target : 0;
    const pctR = Math.round(pctGoal * 100);
    const payoffBits = [moreQ > 0.5 ? 'More quotes' : null, moreI > 0.5 ? 'more jobs' : null].filter(Boolean);
    const payoff = payoffBits.length ? payoffBits.join(' and ').replace(/^m/, 'M') + ' close the gap.' : overdue > 0 ? 'Collecting what is overdue helps most.' : 'Keep the pace.';
    const goalTitle = !target ? ['Set a goal. ', h('span', { class: 'dt-hl' }, 'Every agent works toward it.')]
      : pctGoal >= 1 ? ['You are past your goal. ', h('span', { class: 'dt-hl' }, 'Keep the pace.')]
        : !invoicedPerMonth ? ['Your goal is set. ', h('span', { class: 'dt-hl' }, payoff)]
          : pctGoal >= 0.9 ? ['Your goal is in reach. ', h('span', { class: 'dt-hl' }, payoff)]
            : pctGoal >= 0.6 ? ['You are ' + pctR + '% of the way to your goal. ', h('span', { class: 'dt-hl' }, payoff)]
              : ['You are ' + fmt.money(gap, { short: true }) + ' a month short of your goal. ', h('span', { class: 'dt-hl' }, payoff)];
    const step = (n, label, ...kids) => D('dt-gstep', h('p', { class: 'dt-gl' }, h('span', { class: 'dt-gn' }, String(n)), label), ...kids);
    const nowStep = step(1, 'Where you are now',
      invoicedPerMonth > 0
        ? h('p', { class: 'dt-gbig' }, fmt.money(invoicedPerMonth, { short: true }), h('small', null, ' invoiced a month'))
        : h('p', { class: 'dt-gbig' }, h('small', null, 'No invoices in the last 3 months')),
      h('p', { class: 'dt-note' }, 'Average of the last 3 full months in Jobber.' + (invThisMonth > 0 ? ' The orange bar is this month so far.' : '')),
      trendChart(months, issued, target, monthKey, fmt, true));
    // Ring: share of the goal you invoice today.
    const goalRing = target && invoicedPerMonth > 0 ? D('dt-gring', ring(pctGoal, Math.min(pctR, 999) + '%', 'of goal'),
      D('dt-gringtx',
        pctGoal >= 1 ? h('p', { class: 'dt-cmp' }, h('b', null, 'Past your goal'), ' at today’s pace.')
          : h('p', { class: 'dt-cmp' }, h('b', { class: 'dt-hl' }, fmt.money(gap, { short: true })), ' a month to go'),
        h('p', { class: 'dt-note' }, 'Your last 3 months against the goal.'))) : null;
    const wantStep = step(2, 'Where you want to be',
      target ? h('p', { class: 'dt-gbig goal' }, fmt.money(target, { short: true }), h('small', null, ' a month')) : h('p', { class: 'dt-gbig' }, h('small', null, 'No goal set yet')),
      goalRing,
      // The goal is set in Connect (Matt, Nov 10). Here it only shows.
      h('p', { class: 'dt-note' }, (goalDoc && goalDoc.setAt ? 'Set by ' + (goalDoc.setBy || 'you') + ' on ' + fmt.fmtDate(goalDoc.setAt) + '. ' : ''), h('a', { href: '#shop-goal', class: 'dt-golink' }, target ? 'Change your goal in Connect' : 'Set your goal in Connect')));
    const card = (title, big, pic, cap, note, btn) => D('dt-lever',
      h('p', { class: 'dt-eb2' }, title),
      big ? h('p', { class: 'dt-lbig' }, ...[].concat(big)) : null,
      pic,
      cap ? h('p', { class: 'dt-lcap' }, ...[].concat(cap)) : null,
      note ? h('p', { class: 'dt-note' }, note) : null,
      h('a', { class: 'fz-btn act', href: btn[1] }, btn[0]));
    // Quotes: one square per quote the goal needs this month. Grey for sent, orange outline for still to send.
    const qNeed = Math.max(0, r1(quotesNeeded));
    const qSent = sent.filter((q) => monthKey(q.sentAt) === thisMonth).length;
    const qPer = qNeed > 120 ? Math.ceil(qNeed / 120) : 1;
    const qBox = D('dt-units', ...Array.from({ length: Math.ceil(Math.max(qNeed, qSent) / qPer) }, (_, i) => h('span', { class: 'u' + (i < Math.ceil(qSent / qPer) ? ' on' : '') })));
    qBox.setAttribute('role', 'img'); qBox.setAttribute('aria-label', qSent + ' of ' + qNeed + ' quotes sent this month');
    const qLeft = Math.max(0, qNeed - qSent);
    // Simple cards (Matt, Nov 7: "too much, more simple"): one number, one thin bar, one line, one button.
    const pbar = (part, label) => { const el = D('dt-pbar', h('i', { style: 'width:' + Math.max(2, Math.min(100, Math.round(part * 100))) + '%' })); el.setAttribute('role', 'img'); el.setAttribute('aria-label', label); return el; };
    const quotesCard = card('Send more quotes', qNeed ? [h('b', null, String(qLeft)), qLeft === 1 ? ' quote to send this month' : ' quotes to send this month'] : 'On track',
      qNeed ? pbar(qSent / qNeed, qSent + ' of ' + qNeed + ' sent') : null,
      qNeed ? [h('b', null, qSent + ' of ' + qNeed), ' sent'] : null, null, ['Follow up quotes', '#a-quote-chaser']);
    const jobsCard = card('Invoice more jobs', moreI > 0.5 ? [h('b', null, '+' + r1(moreI)), r1(moreI) === 1 ? ' job a month' : ' jobs a month'] : 'On track',
      invoicesNeeded ? pbar(invoicesPerMonth / invoicesNeeded, r1(invoicesPerMonth) + ' of ' + r1(invoicesNeeded) + ' a month') : null,
      [h('b', null, r1(invoicesPerMonth) + ' of ' + r1(invoicesNeeded)), ' a month'], null, ['Invoice finished work', '#a-bill-it']);
    const owedCard = overdue > 0 ? card('Collect what you are owed', [h('b', null, fmt.money(overdue, { short: true })), ' overdue'],
      pbar(owed ? overdue / owed : 1, fmt.money(overdue, { short: true }) + ' of ' + fmt.money(owed, { short: true }) + ' owed is overdue'),
      [h('b', null, fmt.plural(pastDue.length, 'invoice')), ' past due'], null, ['Get paid', '#a-get-paid']) : null;
    const howStep = target ? step(3, 'How you get there', D('dt-levers' + (owedCard ? '' : ' two'), quotesCard, jobsCard, owedCard)) : null;
    const dtGoal = h('section', { class: 'dt-panel dt-goal' },
      panelHead('Your goal', goalTitle, 'Where you are now, where you want to be, and how you get there.'),
      D('dt-grow', nowStep, wantStep),
      howStep);

    // ---- How your agents are getting smarter: an Example until real run data exists ----
    const skillDoc = await ctx.store('datasets/skill').catch(() => null);
    const realWeeks = (skillDoc && Array.isArray(skillDoc.weeks) ? skillDoc.weeks : []).map(Number).filter((n) => n > 0);
    const isReal = realWeeks.length >= 3;
    const EX_WEEKS = [58, 60, 61, 64, 66, 67, 70, 72];
    const weeksS = isReal ? realWeeks : EX_WEEKS;
    const sFirst = weeksS[0], sLast = weeksS[weeksS.length - 1], sUp = Math.round(sLast - sFirst);
    const EX_LEARN = [
      ['Follow up quotes on day 3, not day 7', '+18%', 'quotes won', 'Chase Quotes'],
      ['Invoice the day the job is done', '4 days', 'sooner paid', 'Send Invoices'],
      ['Ask for the review the same day', '2x', 'reviews', 'Get Reviews']
    ];
    const learned = isReal && Array.isArray(skillDoc.lessons) && skillDoc.lessons.length ? skillDoc.lessons.slice(0, 3).map((l) => [l.title, l.value, l.unit, l.agent || '']) : EX_LEARN;
    const exTag = isReal ? null : h('span', { class: 'dt-extag' }, 'Example');
    // Only shown once there are real scores (no example).
    const dtSkill = !isReal ? null : h('section', { class: 'dt-panel dt-skill' + (isReal ? '' : ' is-ex') },
      panelHead('Getting smarter', isReal ? ['Your agents are up ' + sUp + ' points ', h('span', { class: 'dt-hl' }, 'since they started')] : ['Example: ', h('span', { class: 'dt-hl' }, 'how your agents get smarter')],
        'One score from 0 to 100 for finishing work, getting it right, learning and asking well.' + (isReal ? '' : ' Your own score shows here once your agents have a few weeks of runs.'), exTag),
      D('dt-sk',
        D('dt-skl',
          h('p', { class: 'dt-eb2' }, isReal ? 'Your agents score' : 'Score · Example'),
          h('p', { class: 'dt-skbig' }, String(Math.round(sLast)), h('small', null, '/100')),
          h('p', { class: 'dt-skup' }, 'Up ' + sUp + ' in ' + weeksS.length + ' weeks'),
          h('p', { class: 'dt-note' }, isReal ? 'Every job they finish teaches them your shop.' : 'Example of a new shop. Every job they finish teaches them your shop.')),
        skillChart(weeksS)),
      D('dt-learn', learned.map(([t, v, u, ag]) => D('dt-lcard',
        h('p', { class: 'dt-lt' }, t),
        h('p', { class: 'dt-lv' }, h('b', null, v), ' ' + u),
        ag ? h('p', { class: 'dt-note' }, ag + (isReal ? '' : ' · Example')) : null))),
      D('dt-hqlink',
        h('a', { class: 'fz-btn act', href: 'https://flowzyn.com/demo-hq', target: '_blank', rel: 'noopener' }, 'See how every shop’s agents get smarter'),
        h('p', { class: 'dt-net' }, 'The Flowzyn network HQ: 60 example shops, what their agents learned, and how the best shops run.')));

    // New work first: the Win agents need only email, so they lead the page.
    const winAgents = FZ.AGENTS.filter((a) => a.group === 'growth');
    const dtWin = h('section', { class: 'ov-card ov-win' }, h('h2', null, 'New work'),
      h('p', { class: 'fz-sub' }, 'Your Win agents: new builders, referral partners, local search and old quotes.'),
      h('div', { class: 'ov-win-list' }, winAgents.map((a) => { const m = FZ.metricOf(a.key); const hs = FZ.health ? FZ.health(a) : null;
        return h('a', { class: 'ov-win-row', href: '#a-' + a.key }, h('b', null, a.name), h('span', null, (m && m.value) ? m.value : (hs ? hs.label + (hs.sub ? ', ' + hs.sub.charAt(0).toLowerCase() + hs.sub.slice(1) : '') : ''))); })),
      h('style', null, '.ov-win-list{display:grid;gap:8px;margin-top:10px}.ov-win-row{display:flex;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid var(--line,#2d323d);border-radius:10px;text-decoration:none;color:inherit}.ov-win-row span{opacity:.7;text-align:right}'));
    // Set up once moved to Connect (Matt, Nov 10). Kept built but not shown on the home page.
    const dtStart = h('section', { class: 'dt-panel dt-start', hidden: true });
    (async () => {
      if (!FZ.act) return;
      const [bk, sc] = await Promise.all([FZ.act.priceBook(), FZ.act.getDoc('settings/schedule')]);
      const steps = [
        { t: 'Check your prices', s: 'Your formula, or your supplier costs plus markup', done: !!(bk.approved || bk.method === 'supplier'), go: '#a-price-book' },
        { t: 'Load your supplier cost sheet', s: 'A photo of it. Optional, if you price from costs', done: !!(bk.supplier && (bk.supplier.items || []).length), go: '#a-supplier-costs' },
        { t: 'Set your install days', s: 'Which days you install and how many a day', done: !!sc, go: '#a-install-scheduler' }
      ];
      const left = steps.filter((x) => !x.done).length;
      if (!left) return;
      dtStart.replaceChildren(
        D('dt-phead', D('dt-pl', h('p', { class: 'dt-eb' }, 'Set up once'), h('h2', { class: 'dt-t' }, left === 1 ? 'One thing left to set up' : left + ' quick things to set up'), h('p', { class: 'dt-sub' }, 'So quotes and install days come out the way you do them.'))),
        h('ol', { class: 'dt-steps' }, steps.map((x, i) => h('li', { class: x.done ? 'done' : null }, h('span', { class: 'n' }, x.done ? '\u2713' : String(i + 1)), h('span', { class: 'b' }, h('b', null, x.t), h('span', null, x.s)), x.done ? h('span', { class: 'ok' }, 'Done') : h('a', { class: 'dt-btn pri', href: x.go }, 'Do it')))),
        h('style', null, '.dt-steps{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:8px}.dt-steps li{display:grid;grid-template-columns:28px 1fr auto;gap:12px;align-items:center;padding:10px 12px;border:1px solid var(--line);border-radius:12px}.dt-steps .n{width:26px;height:26px;border-radius:50%;border:2px solid var(--accent);display:grid;place-items:center;font-weight:700;font-size:13px;color:var(--accent)}.dt-steps li.done .n{background:var(--accent);color:var(--on-accent,#111)}.dt-steps .b{display:flex;flex-direction:column;gap:2px}.dt-steps .b span{font-size:13px;color:var(--muted)}.dt-steps li.done b{color:var(--muted)}.dt-steps .ok{font-size:13px;color:var(--ok-fg,#22c55e);font-weight:700}'));
      dtStart.hidden = false;
    })().catch(() => {});
    return [h('div', { class: 'dt' }, dtHead, dtAsk, D('dt-statusbox', dtStatus, dtSince), dtNeeds, dtGoal, dtWeek, dtMoneyRow, dtAgents, dtSkill, dtFoot)];
  };

  // Invoiced dollars per month as bars, with the goal as a dashed line.
  // Added up month by month: money back (green) against plan fees (dashed grey).
  function returnChart(series, fmt) {
    const NS = 'http://www.w3.org/2000/svg';
    const el = (tag, attrs, text) => { const n = document.createElementNS(NS, tag); Object.entries(attrs || {}).forEach(([k, v]) => n.setAttribute(k, v)); if (text != null) n.textContent = text; return n; };
    const W = 1100, H = 260, L = 52, R = 120, T = 16, B = 28;
    const max = Math.max(1, ...series.map((p) => Math.max(p.back, p.fees))) * 1.1;
    const x = (i) => L + (W - L - R) * (series.length === 1 ? 0 : i / (series.length - 1));
    const y = (v) => T + (H - T - B) * (1 - v / max);
    const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'ov-chart', role: 'img', 'aria-label': 'Money back against plan cost, added up month by month, with the next months projected at the same pace' });
    [0, max / 2 / 1.1, max / 1.1].forEach((v) => { svg.append(el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: 'var(--line)', 'stroke-width': 1 })); svg.append(el('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--muted)' }, fmt.money(v, { short: true }))); });
    series.forEach((p, i) => svg.append(el('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--muted)' }, new Date(p.m + '-15T12:00:00Z').toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }))));
    const nReal = Math.max(1, series.filter((p) => !p.proj).length);
    const pts = (key, from, to) => series.slice(from, to).map((p, j) => x(from + j) + ',' + y(p[key])).join(' ');
    const line = (key, from, to, attrs) => { if (to - from < 2 && !(from === 0 && to === 1)) return; svg.append(el('polyline', Object.assign({ points: pts(key, from, to), fill: 'none', 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, attrs))); };
    line('fees', 0, nReal, { stroke: 'var(--bar)', 'stroke-width': 2 });
    line('back', 0, nReal, { stroke: 'var(--accent)' });
    if (series.length > nReal) {
      line('fees', nReal - 1, series.length, { stroke: 'var(--bar)', 'stroke-width': 2, 'stroke-dasharray': '6 5', opacity: 0.7 });
      line('back', nReal - 1, series.length, { stroke: 'var(--accent)', 'stroke-dasharray': '6 5', opacity: 0.8 });
      svg.append(el('circle', { cx: x(nReal - 1), cy: y(series[nReal - 1].back), r: 4, fill: 'var(--accent)' }));
    }
    const last = series[series.length - 1];
    const yb = y(last.back), yf = y(last.fees), apart = Math.abs(yb - yf) < 18 ? (yb < yf ? [-6, 12] : [12, -6]) : [4, 4];
    svg.append(el('circle', { cx: x(series.length - 1), cy: yb, r: 5, fill: 'var(--accent)' }));
    svg.append(el('text', { x: W - R + 8, y: yb + apart[0], 'font-size': 12, 'font-weight': 700, fill: 'var(--accent)' }, fmt.money(last.back, { short: true }) + ' back'));
    svg.append(el('text', { x: W - R + 8, y: yf + apart[1], 'font-size': 12, fill: 'var(--muted)' }, fmt.money(last.fees, { short: true }) + ' plan cost'));
    const wrap = document.createElement('div');
    wrap.append(svg);
    return wrap;
  }

  // Score over the weeks since the agents started, as one orange line with a soft area under it.
  function skillChart(weeks) {
    const NS = 'http://www.w3.org/2000/svg';
    const el = (tag, attrs, text) => { const n = document.createElementNS(NS, tag); Object.entries(attrs || {}).forEach(([k, v]) => n.setAttribute(k, v)); if (text != null) n.textContent = text; return n; };
    const narrow = window.innerWidth < 600;
    const W = narrow ? 380 : 760, H = narrow ? 190 : 210, L = 34, R = 14, T = 12, B = 26;
    const lo = Math.max(0, Math.floor((Math.min(...weeks) - 10) / 10) * 10), hi = Math.min(100, Math.ceil((Math.max(...weeks) + 6) / 10) * 10);
    const x = (i) => L + (W - L - R) * (weeks.length === 1 ? 0 : i / (weeks.length - 1));
    const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo || 1));
    const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'ov-chart dt-skchart', role: 'img', 'aria-label': 'Agent score by week, from ' + weeks[0] + ' to ' + weeks[weeks.length - 1] });
    [lo, (lo + hi) / 2, hi].forEach((v) => { svg.append(el('line', { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: 'var(--line)', 'stroke-width': 1 })); svg.append(el('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--muted)' }, String(Math.round(v)))); });
    weeks.forEach((_, i) => svg.append(el('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--muted)' }, 'W' + (i + 1))));
    const pts = weeks.map((v, i) => x(i) + ',' + y(v)).join(' ');
    svg.append(el('polygon', { points: x(0) + ',' + y(lo) + ' ' + pts + ' ' + x(weeks.length - 1) + ',' + y(lo), fill: 'var(--accent)', opacity: 0.12 }));
    svg.append(el('polyline', { points: pts, fill: 'none', stroke: 'var(--accent)', 'stroke-width': 3, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    svg.append(el('circle', { cx: x(weeks.length - 1), cy: y(weeks[weeks.length - 1]), r: 5, fill: 'var(--accent)' }));
    const wrap = document.createElement('div'); wrap.className = 'dt-skc'; wrap.append(svg); return wrap;
  }

  function trendChart(allMonths, issued, target, monthKey, fmt, plainGoal) {
    // Only months with invoices are drawn, never an empty month.
    const all = allMonths.map((m) => [m, issued.filter((v) => monthKey(v.issuedDate) === m).reduce((n, v) => n + (Number(v.total) || 0), 0)]);
    const thisM = allMonths[allMonths.length - 1];
    const kept = all.filter(([, v]) => v > 0);
    const months = (kept.length ? kept : all.slice(-1)).map((x) => x[0]);
    const vals = (kept.length ? kept : all.slice(-1)).map((x) => x[1]);
    const narrow = window.innerWidth < 600;
    const W = narrow ? 360 : 560, H = plainGoal ? (narrow ? 190 : 170) : 200, L = 44, B = 26, T = 14;
    const max = Math.max(target || 0, ...vals, 1) * 1.1;
    const y = (v) => T + (H - T - B) * (1 - v / max);
    const bw = (W - L - 10) / months.length;
    const ns = 'http://www.w3.org/2000/svg';
    const el = (tag, attrs, text) => { const n = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v)); if (text != null) n.textContent = text; return n; };
    const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'ov-chart', role: 'img', 'aria-label': 'Invoiced each month for the last 6 months' });
    [0, 0.5, 1].forEach((f) => {
      const v = max / 1.1 * f;
      svg.append(el('line', { x1: L, x2: W, y1: y(v), y2: y(v), stroke: 'var(--line)', 'stroke-width': 1 }));
      svg.append(el('text', { x: L - 6, y: y(v) + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--muted)' }, fmt.money(v, { short: true })));
    });
    vals.forEach((v, i) => {
      const x = L + i * bw + bw * 0.2;
      const last = months[i] === thisM;
      svg.append(el('rect', { x, y: y(v), width: bw * 0.6, height: Math.max(0, H - B - y(v)), rx: 4, fill: last ? 'var(--accent)' : 'var(--bar)' }));
      const label = new Date(months[i] + '-15T12:00:00Z').toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
      svg.append(el('text', { x: x + bw * 0.3, y: H - 8, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--muted)' }, label + (last ? ' so far' : '')));
    });
    if (target) {
      svg.append(el('line', { x1: L, x2: W, y1: y(target), y2: y(target), stroke: 'var(--goal)', 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }));
      svg.append(el('text', { x: W - 4, y: y(target) - 5, 'text-anchor': 'end', 'font-size': 11, 'font-weight': 700, fill: 'var(--goal)' }, plainGoal ? 'Goal' : 'Goal ' + fmt.money(target, { short: true })));
    }
    const wrap = document.createElement('div');
    wrap.append(svg);
    return wrap;
  }
})();
