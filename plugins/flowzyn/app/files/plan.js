// Plan: the shop's subscription. What it costs, when it started and next charges, what is in it, receipts, and how to change it.
(function () {
  const SUITES = [
    { id: 'growth', name: 'Win agents', line: 'Win more of the right work from builders, partners, old quotes and local search' },
    { id: 'run', name: 'Run agents', line: 'Run the office from the first call to money in the bank' },
    { id: 'keep', name: 'Keep agents', line: 'Keep customers and builders coming back with reviews and repeat work' }
  ];
  FZ.SUITES = SUITES;
  const PRICE = 950; // one plan a month: every agent and the human Operator
  const TZ = 'America/Denver';

  // Every agent is always in the plan. The Operator can be switched off by Flowzyn.
  FZ.planOf = (doc) => {
    const p = doc || {};
    const groups = { growth: true, run: true, keep: true };
    const price = Number(p.price) || PRICE;
    return { groups, operator: p.operator === true, startedAt: p.startedAt || null, price, fee: price, pilotDays: 0, client: p.client || 'dunlap-glass', invoices: Array.isArray(p.invoices) ? p.invoices : [] };
  };
  // What the plan costs in a given month counted from the start (0 is the first month).
  FZ.planFeeAt = (plan) => (plan && plan.price) || PRICE;
  FZ.inPlan = () => true;

  const CSS = [
    '#fz-plan.fz-body { gap: 32px; }',
    '#fz-plan .ps-head { display: flex; flex-direction: column; gap: 10px; }',
    '#fz-plan .ps-head .ps-lede { margin: 0; font-size: 16px; line-height: 1.5; color: var(--muted); }',
    '.ps-card { background: var(--card); border: 1px solid var(--edge); border-radius: 12px; box-shadow: var(--shadow); }',
    '.ps-sum { display: grid; grid-auto-flow: column; grid-auto-columns: 1fr; }',
    '.ps-col { padding: 26px 28px; display: flex; flex-direction: column; gap: 6px; min-width: 0; }',
    '.ps-col + .ps-col { border-left: 1px solid var(--line); }',
    '.ps-l { font-size: 13px; font-weight: 600; color: var(--muted); }',
    '.ps-v { font-size: 24px; font-weight: 700; letter-spacing: -0.01em; color: var(--fg); font-variant-numeric: tabular-nums; text-decoration: none; }',
    'a.ps-v:hover { color: var(--accent); }',
    '.ps-s { font-size: 14px; line-height: 1.5; color: var(--muted); }',
    '.ps-list { list-style: none; margin: 0; padding: 0 28px; }',
    '.ps-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 6px 24px; align-items: center; padding: 18px 0; }',
    '.ps-row + .ps-row { border-top: 1px solid var(--line); }',
    '.ps-row .ps-n { font-size: 16px; font-weight: 700; color: var(--fg); }',
    '.ps-row .ps-d { grid-column: 1; font-size: 14px; line-height: 1.5; color: var(--muted); }',
    '.ps-row .ps-c { grid-column: 2; grid-row: 1 / span 2; font-size: 14px; font-weight: 600; color: var(--meta); font-variant-numeric: tabular-nums; text-decoration: none; white-space: nowrap; }',
    'a.ps-c:hover { color: var(--accent); }',
    '.ps-bill { display: grid; grid-template-columns: minmax(0, 1fr) auto auto auto; gap: 8px 24px; align-items: center; padding: 16px 0; }',
    '.ps-bill + .ps-bill { border-top: 1px solid var(--line); }',
    '.ps-bill .ps-date { font-size: 15px; font-weight: 600; color: var(--fg); }',
    '.ps-bill .ps-amt { font-size: 15px; font-weight: 700; font-variant-numeric: tabular-nums; color: var(--fg); }',
    '.ps-bill .pill { justify-self: start; }',
    '.ps-bill .pill.due { background: transparent; border-color: var(--line); color: var(--muted); }',
    '.ps-bill .pill.bad { background: rgba(220, 38, 38, 0.12); border-color: transparent; color: #f87171; }',
    '.ps-quiet { margin: 0; font-size: 15px; line-height: 1.5; color: var(--muted); }',
    '.ps-change { display: flex; align-items: center; gap: 14px 24px; flex-wrap: wrap; }',
    '.ps-admin > div { gap: 18px !important; padding-top: 6px !important; }',
    '.ps-form { display: flex; gap: 14px 18px; flex-wrap: wrap; align-items: flex-end; }',
    '.ps-form label { display: flex; flex-direction: column; gap: 6px; font-size: 13px; font-weight: 600; color: var(--muted); }',
    '.ps-form .fz-input { width: 180px; }',
    '@media (max-width: 620px) {',
    '  #fz-plan.fz-body { gap: 24px; }',
    '  .ps-sum { grid-auto-flow: row; grid-auto-columns: auto; }',
    '  .ps-col { padding: 16px 22px; flex-direction: row; flex-wrap: wrap; align-items: baseline; column-gap: 12px; row-gap: 2px; }',
    '  .ps-col .ps-l { flex: 1 0 100%; }',
    '  .ps-col + .ps-col { border-left: 0; border-top: 1px solid var(--line); }',
    '  .ps-col .ps-v { font-size: 20px; }',
    '  .ps-list { padding: 0 22px; }',
    '  .ps-bill { grid-template-columns: minmax(0, 1fr) auto; }',
    '  .ps-form .fz-input { width: 100%; }',
    '  .ps-form label { flex: 1 1 100%; }',
    '}'
  ].join('\n');

  // A plain date (2026-10-06) is that calendar day. A full timestamp is shown in the shop's time zone.
  const dateOf = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: /^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? 'UTC' : TZ });
  // The start date plus whole months: the first such date after today.
  const nextCharge = (startedAt) => {
    const s = new Date(startedAt); if (isNaN(s)) return null;
    const now = Date.now();
    for (let k = 0; k < 600; k++) {
      const y = s.getUTCFullYear(), m = s.getUTCMonth() + k;
      const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      const d = new Date(Date.UTC(y, m, Math.min(s.getUTCDate(), last), s.getUTCHours(), s.getUTCMinutes()));
      if (d.getTime() > now) return d;
    }
    return null;
  };
  const daysTo = (d) => Math.max(1, Math.ceil((d.getTime() - Date.now()) / 86400000));

  FZ.renderPlan = async function (ctx, planDoc, save) {
    const { ui, fmt } = ctx;
    const { h } = ui;
    // On a direct load the settings listener may not have filled in yet: read the plan doc itself.
    if (!planDoc) planDoc = await ctx.store('settings/plan').catch(() => null);
    const plan = FZ.planOf(planDoc);
    const agents = FZ.AGENTS || [];
    const op = plan.operator;
    const price = fmt.money(plan.price);

    // 1. Headline
    const head = h('header', { class: 'ov-hero ps-head' },
      h('h1', { class: 'home' }, 'Your plan: ', h('b', null, price + ' a month'), '. Every agent' + (op ? ' and your Operator.' : '.')));

    // 2. One summary card. The price is in the headline, so the card shows how it bills.
    const next = plan.startedAt ? nextCharge(plan.startedAt) : null;
    const col = (l, v, s) => h('div', { class: 'ps-col' }, h('span', { class: 'ps-l' }, l), v, s ? h('span', { class: 'ps-s' }, s) : null);
    const summary = h('div', { class: 'ps-card ps-sum' },
      col('Plan', h('span', { class: 'ps-v' }, 'Monthly'), 'One price, everything in'),
      plan.startedAt && !isNaN(new Date(plan.startedAt)) ? col('Started', h('span', { class: 'ps-v' }, dateOf(plan.startedAt)), null) : null,
      next ? col('Next charge', h('span', { class: 'ps-v' }, dateOf(next)), daysTo(next) === 1 ? 'Tomorrow' : 'In ' + daysTo(next) + ' days') : null,
      col('Included', h('a', { class: 'ps-v', href: '#all' }, fmt.plural(agents.length, 'agent')), op ? 'and your Operator' : null));

    // 3. What you get
    const rows = SUITES.map((s) => {
      const n = agents.filter((a) => a.group === s.id).length;
      return h('li', { class: 'ps-row' }, h('span', { class: 'ps-n' }, s.name), h('span', { class: 'ps-d' }, s.line + '.'), h('a', { class: 'ps-c', href: '#all' }, fmt.plural(n, 'agent')));
    });
    if (op) rows.push(h('li', { class: 'ps-row' }, h('span', { class: 'ps-n' }, 'Your Operator'), h('span', { class: 'ps-d' }, 'A real person on the Flowzyn team who takes the calls, manual steps and anything you hand over.'), h('a', { class: 'ps-c', href: '#operator' }, '1 person')));
    const get = ui.section('What you get', null, h('ul', { class: 'ps-card ps-list' }, rows));

    // 4. Billing history: only real charges, else one calm line.
    const inv = plan.invoices.filter((x) => x && x.date).sort((a, b) => new Date(b.date) - new Date(a.date));
    const pill = (st) => { const s = String(st || '').toLowerCase(); return s === 'paid' ? h('span', { class: 'pill live' }, 'Paid') : /fail|declin|past/.test(s) ? h('span', { class: 'pill bad' }, 'Payment failed') : s ? h('span', { class: 'pill due' }, s.charAt(0).toUpperCase() + s.slice(1)) : null; };
    const bills = ui.section('Billing history', null, inv.length
      ? h('div', { class: 'ps-card ps-list' }, inv.map((x) => h('div', { class: 'ps-bill' },
        h('span', { class: 'ps-date' }, dateOf(x.date)), h('span', { class: 'ps-amt' }, fmt.money(x.amount)), pill(x.status) || h('span'),
        x.url ? ui.extLink(x.url, 'Receipt', 'fz-cardlink') : h('span'))))
      : h('p', { class: 'ps-quiet' }, 'Receipts show here after your first charge.'));

    // 5. Change or cancel: inside the app, through the Operator.
    const change = ui.section('Change or cancel', null, h('div', { class: 'ps-change' },
      h('p', { class: 'ps-quiet' }, op ? 'Your Operator handles plan changes. Send a request and they sort it out with you.' : 'The Flowzyn team handles plan changes. Send a request and they sort it out with you.'),
      FZ.opButton({ id: 'plan-change', title: 'Plan change request', meta: 'From the Plan page' }) || ui.extLink(FZ.opUrl('plan'), 'Ask Flowzyn', 'fz-btn')));

    // 6. Flowzyn admin (editors only)
    let admin = null;
    if (FZ.CAN_EDIT) {
      const msg = h('p', { class: 'fz-hint', role: 'status' });
      const priceIn = h('input', { class: 'fz-input', type: 'number', min: '0', step: '1', inputmode: 'numeric', value: String(plan.price) });
      const startIn = h('input', { class: 'fz-input', type: 'date', value: plan.startedAt ? new Date(plan.startedAt).toISOString().slice(0, 10) : '' });
      const saveB = h('button', { type: 'button', class: 'fz-btn act' }, 'Save plan');
      saveB.addEventListener('click', async () => {
        const p = Number(priceIn.value);
        if (!(p > 0)) { msg.textContent = 'Enter the monthly price in dollars.'; return; }
        saveB.disabled = true;
        const patch = { price: Math.round(p), startedAt: startIn.value ? new Date(startIn.value + 'T12:00:00Z').toISOString() : null };
        if (!(await save(patch))) { msg.textContent = 'Only an editor of this page can change the plan.'; saveB.disabled = false; }
      });
      const opB = h('button', { type: 'button', class: 'fz-btn ghost' }, op ? 'Turn off Operator' : 'Turn on Operator');
      opB.addEventListener('click', async () => { opB.disabled = true; if (!(await save({ operator: !op }))) { msg.textContent = 'Only an editor of this page can change the plan.'; opB.disabled = false; } });
      const setupB = h('button', { type: 'button', class: 'fz-btn ghost' }, 'Run first time setup again');
      setupB.addEventListener('click', async () => { setupB.disabled = true; if (!(await FZ.rerunWelcome())) { msg.textContent = 'Could not start setup again here.'; setupB.disabled = false; } });
      admin = ui.details('Flowzyn admin',
        h('div', { class: 'ps-form' }, h('label', null, 'Price a month', priceIn), h('label', null, 'Started', startIn), saveB),
        h('div', { class: 'fz-card-btns' }, opB, setupB), msg);
      admin.classList.add('ps-admin');
    }

    return [h('style', null, CSS), head, summary, get, bills, change, admin];
  };
})();
