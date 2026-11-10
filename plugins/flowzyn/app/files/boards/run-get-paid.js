// Get Paid: unpaid invoices, past due first, with a friendly nudge or a call brief ready.
FZ.board('get-paid', {
  source: 'Invoices: Jobber, live.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    // Core's overflow line pluralises "more" as "mores", so count the rest here.
    const rankedCards = (items, max) => { const w = ui.cards(items.slice(0, max), { max }); if (items.length > max) w.append(ui.h('p', { class: 'fz-more' }, (items.length - max) + ' more in the full list below.')); return w; };
    const BIG = 5000;
    const [pastDue, awaiting, notDue] = await Promise.all(['past_due', 'awaiting_payment', 'sent_not_due']
      .map((status) => ctx.jobberAll('search_invoices', { status, limit: 50, sort: 'dueDate' }, 'invoices', 200)));
    const seen = new Set();
    const rows = [...pastDue, ...awaiting, ...notDue].filter((v) => !seen.has(v.id) && seen.add(v.id) && Number(v.balance) > 0).map((v) => {
      const late = v.dueDate ? fmt.daysSince(v.dueDate) : null;
      const overdue = v.status === 'past_due' || (late != null && late > 0);
      return { v, who: fmt.clean(v.client && v.client.name), bal: Number(v.balance) || 0, overdue, days: overdue ? Math.max(1, late || 0) : 0 };
    });
    const score = (r) => r.bal * (1 + r.days / 30);
    rows.sort((a, b) => (b.overdue - a.overdue) || (score(b) - score(a)));
    const due = rows.filter((r) => r.overdue);
    const dueTotal = due.reduce((s, r) => s + r.bal, 0);
    const allTotal = rows.reduce((s, r) => s + r.bal, 0);

    ctx.metric('get-paid', due.length
      ? { value: fmt.money(dueTotal, { short: true }) + ' overdue', detail: fmt.plural(due.length, 'invoice') + ' to follow up, ' + fmt.money(allTotal, { short: true }) + ' unpaid in all' }
      : { value: 'Nothing overdue', detail: rows.length ? fmt.money(allTotal, { short: true }) + ' sent and not due yet' : '' });

    const out = [];
    const { h } = ui;
    const K = FZ.kit;
    const short = (n) => fmt.money(n, { short: true });
    const T = (FZ.tasksNow && FZ.tasksNow().done) || {};
    const qidOf = (k) => 'send-' + String(k || '').replace(/[^A-Za-z0-9]+/g, '-').slice(-80);
    const run = FZ.runs && FZ.runs['get-paid'];
    const ranAt = run && run.last && fmt.dayKey(run.last) === fmt.dayKey(new Date().toISOString()) && !/error/i.test(run.lastStatus || '') ? fmt.fmtTime(run.last) : null;
    const goWork = (needle) => () => {
      const tab = document.querySelector('#fz-board .fz-subtabs [data-id="work"]'); if (tab) tab.click();
      setTimeout(() => { const el = [...document.querySelectorAll('#fz-board .fz-tabbody[data-id="work"] .fz-card')].find((c) => c.textContent.includes(needle)); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
    };
    const btn = (label, fn) => h('button', { type: 'button', class: 'fz-btn act gp-go', onclick: fn }, label);
    const css = h('style', null, GP_CSS + '.fz-btn.gp-go{background:var(--accent)!important;color:var(--on-accent,#111)!important}.fz-status.gp-good b{color:var(--ok-fg,#22c55e)}');
    const HOW = 'It checks every unpaid invoice in Jobber, writes a friendly reminder the day one goes late, and brings you only the big ones.';
    // Ageing bar: grey for not due, then one orange ramp from light to full.
    const BUCKETS = [
      { label: 'Not due yet', test: (r) => !r.overdue, cls: 'a0' },
      { label: '1 to 15 days late', test: (r) => r.overdue && r.days <= 15, cls: 'a1' },
      { label: '16 to 30 days late', test: (r) => r.overdue && r.days > 15 && r.days <= 30, cls: 'a2' },
      { label: 'Over 30 days late', test: (r) => r.overdue && r.days > 30, cls: 'a3' }
    ];
    const ageBar = (AGE) => {
      const tot = AGE.reduce((n, b) => n + b.d, 0) || 1;
      return h('div', { class: 'gp-age viz' },
        h('div', { class: 'gp-bar', role: 'img', 'aria-label': AGE.map((b) => b.label + ' ' + short(b.d)).join(', ') },
          AGE.filter((b) => b.d > 0).map((b) => h('span', { class: 'gp-seg ' + b.cls, style: 'flex:' + (b.d / tot) + ' 1 0', title: b.label + ': ' + fmt.money(b.d) + ', ' + fmt.plural(b.n, 'invoice') }))),
        h('div', { class: 'gp-key' }, AGE.map((b) => h('div', { class: 'gp-k' + (b.d ? '' : ' none') },
          h('span', { class: 'gp-kl' }, h('i', { class: b.cls }), b.label),
          h('b', null, short(b.d)),
          h('span', { class: 'gp-kn' }, b.n ? fmt.plural(b.n, 'invoice') : '')))));
    };
    const table = (list, open) => ui.table([
      { label: 'Customer', get: (r) => r.v.jobberWebUri ? ui.extLink(r.v.jobberWebUri, r.who, 'fz-tlink') : r.who },
      { label: 'Invoice', get: (r) => '#' + r.v.invoiceNumber },
      { label: 'Due', get: (r) => r.v.dueDate ? fmt.fmtDate(r.v.dueDate) : '' },
      { label: 'Status', get: (r) => r.overdue ? ui.pill(fmt.plural(r.days, 'day') + ' late', 'hot') : ui.pill('Not due yet') },
      { label: 'Balance', num: true, get: (r) => fmt.money(r.bal) }
    ], list, { open });

    // Quiet: nothing unpaid.
    if (!rows.length) {
      const st = ui.status(['Every invoice is paid. ', { b: 'Nothing to chase.' }]);
      st.classList.add('gp-good');
      out.push(st, K.how(h, HOW));
      const ex = [[6, 12400, 'a0', 'Not due yet'], [2, 3200, 'a1', '1 to 15 days late'], [1, 1800, 'a2', '16 to 30 days late'], [1, 2400, 'a3', 'Over 30 days late']].map(([n, d, cls, label]) => ({ n, d, cls, label }));
      out.push(K.quiet(h,
        K.checked(h, 'Unpaid invoices checked in Jobber', ['No invoice is past due, awaiting payment or sent and not due', ranAt ? 'Last check ' + ranAt : 'Checked live from Jobber just now', 'A reminder is written the day an invoice goes late']),
        K.example(h, 'Most late money is caught before 30 days', [ageBar(ex)])));
      out.push(css);
      out.push(ui.how('Unpaid means Jobber shows the invoice as past due, awaiting payment, or sent and not due.'));
      return out;
    }

    // 1. Headline. 2. What it does.
    out.push(ui.status(due.length
      ? [short(dueTotal) + ' overdue on ' + fmt.plural(due.length, 'invoice') + '. ', { b: 'A reminder is ready for each.' }]
      : [short(allTotal) + ' sent and not due yet. ', { b: 'Nothing overdue.' }]));
    out.push(K.how(h, HOW));

    // 3. Hero: the ageing bar, and what it did today.
    const AGE = BUCKETS.map((b) => { const list = rows.filter(b.test); return Object.assign({}, b, { n: list.length, d: list.reduce((n, r) => n + r.bal, 0) }); });
    const over = AGE[3];
    const queued = due.filter((r) => (T[qidOf(r.v.jobberWebUri || r.who)] || {}).outbox).length;
    const handled = due.filter((r) => (T[qidOf(r.v.jobberWebUri || r.who)] || {}).handled).length;
    out.push(K.hero(h, {
      eyebrow: 'Unpaid by how late',
      title: over.d ? [short(over.d) + ' is ', { b: 'more than 30 days late' }] : due.length ? [short(dueTotal) + ' is late, ', { b: 'none past 30 days' }] : ['Every unpaid invoice is ', { b: 'not due yet' }],
      sub: due.length ? 'Every unpaid dollar by how late it is. Past 30 days a reminder alone rarely works.' : 'Every unpaid dollar by how late it is.',
      viz: ageBar(AGE),
      did: [
        { t: 'Checked Jobber for unpaid invoices', s: ranAt || 'Live from Jobber' },
        { t: 'Found ' + fmt.plural(rows.length, 'unpaid invoice'), s: due.length ? due.length + ' overdue, ' + short(dueTotal) : 'None overdue' },
        due.length ? { t: 'Wrote a reminder for each overdue invoice' } : null,
        queued ? { t: fmt.plural(queued, 'reminder') + ' queued by you' } : null,
        handled ? { t: fmt.plural(handled, 'invoice') + ' marked as handled' } : null,
        { t: due.length ? 'Next: queued reminders go out on the next run' : 'Next: a reminder only if one goes late', done: false }
      ].filter(Boolean)
    }));

    // 4. The top 3 that need you, the rest folded with the detail table.
    if (due.length) {
      const picks = due.slice().sort((a, b) => b.bal - a.bal).slice(0, 3);
      const rest = rows.filter((r) => !picks.includes(r));
      const restDue = rest.filter((r) => r.overdue).length;
      out.push(K.needs(h, {
        title: fmt.plural(picks.length, 'overdue invoice') + ' to OK, biggest first',
        items: picks.map((r) => {
          const t = T[qidOf(r.v.jobberWebUri || r.who)] || {};
          const call = r.bal > BIG && FZ.isOperator();
          return {
            meta: [{ b: short(r.bal) }, ' · Invoice #' + r.v.invoiceNumber + ' · ' + fmt.plural(r.days, 'day') + ' late'],
            title: r.who,
            detail: t.handled ? 'Marked as handled.' : t.outbox ? 'Reminder queued, goes out next run.' : call ? 'Big balance. Call notes are ready.' : 'Reminder written, ready for your OK.',
            actions: [btn(call ? 'Call notes' : 'Review reminder', goWork('Invoice #' + r.v.invoiceNumber)), r.v.jobberWebUri ? ui.extLink(r.v.jobberWebUri, 'Open in Jobber', 'fz-tlink') : null].filter(Boolean)
          };
        }),
        rest: { count: rest.length, label: restDue ? 'with a reminder ready on the next tab or not due yet' : 'not due yet, the agent is watching them', list: table(rest, true) }
      }));
    } else {
      // Nothing needs you: the list stays folded.
      const d = ui.details('See the ' + fmt.plural(rows.length, 'invoice') + ' not due yet', table(rows, true));
      out.push(d);
    }
    out.push(css);

    if (due.length) {
      out.push(rankedCards(due.map((r) => {
        const big = r.bal > BIG;
        return {
          when: fmt.plural(r.days, 'day') + ' overdue · Invoice #' + r.v.invoiceNumber,
          who: r.who,
          why: (big && FZ.isOperator() ? 'Big balance. Worth a call. ' : '') + 'Due ' + fmt.fmtDate(r.v.dueDate || r.v.issuedDate) + ' for ' + fmt.clean(r.v.subject || 'your work') + '.',
          amount: r.bal,
          flag: big || r.days > 30,
          link: r.v.jobberWebUri,
          clientId: r.v.client && r.v.client.id, draftSubject: 'Invoice ' + (r.v.invoiceNumber ? '#' + r.v.invoiceNumber + ' ' : '') + 'from ' + FZ.biz(), draft: big && FZ.isOperator() ? callBrief(r) : nudge(r),
          draftLabel: big ? 'Call notes' : 'Draft a nudge', draftCall: big && FZ.isOperator()
        };
      }), 50));
    }

    out.push(ui.how('Unpaid means Jobber shows the invoice as past due, awaiting payment, or sent and not due.',
      'Overdue invoices come first, ranked by balance and days late together.',
      'Balances over ' + fmt.money(BIG) + ' get call notes instead of a written nudge. Over 30 days late or over ' + fmt.money(BIG) + ' gets the orange line.',
      'Payments recorded in QuickBooks but not in Jobber are matched once QuickBooks is linked, so nobody gets nudged for a bill they already paid.'));
    return out;

    function nudge(r) {
      return 'Hi ' + fmt.firstName(r.who) + ',\n\nHope all is well since we finished up. A quick note that invoice #' + r.v.invoiceNumber + ' for ' + fmt.money(r.bal) +
        ' was due ' + fmt.fmtDate(r.v.dueDate || r.v.issuedDate) + '. You can pay it online from the invoice email, or just reply and I can take a card over the phone.\n\nIf it is already on its way, thank you and please ignore this.\n\n' + FZ.sign();
    }
    function callBrief(r) {
      return 'Call ' + r.who + '\n\n' +
        'Invoice #' + r.v.invoiceNumber + ', ' + fmt.clean(r.v.subject || '') + '\n' +
        'Balance ' + fmt.money(r.bal) + ' of ' + fmt.money(r.v.total) + (Number(r.v.paid) > 0 ? ', ' + fmt.money(r.v.paid) + ' paid so far' : '') + '\n' +
        'Issued ' + fmt.fmtDate(r.v.issuedDate) + ', due ' + fmt.fmtDate(r.v.dueDate || r.v.issuedDate) + ', ' + fmt.plural(r.days, 'day') + ' late\n\n' +
        'Ask: is everything right with the work? Then, when can we expect payment?\n' +
        'Offer: card over the phone, or resend the online link.\n' +
        'Note the date they give in Jobber after the call.';
    }
  }
});
const GP_CSS = '.gp-age{display:flex;flex-direction:column;gap:14px}' +
  '.gp-bar{display:flex;gap:2px;height:14px}.gp-seg{min-width:4px;border-radius:2px}.gp-seg:first-child{border-radius:4px 2px 2px 4px}.gp-seg:last-child{border-radius:2px 4px 4px 2px}.gp-seg:only-child{border-radius:4px}' +
  '.a0{background:var(--bar)}.a1{background:color-mix(in srgb,var(--accent) 35%,#fff)}.a2{background:color-mix(in srgb,var(--accent) 65%,#fff)}.a3{background:var(--accent)}' +
  '.gp-key{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}.gp-k{display:flex;flex-direction:column;gap:2px;min-width:0}' +
  '.gp-kl{font-size:13px;color:var(--muted)}.gp-kl i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px;vertical-align:0}' +
  '.gp-k b{font-size:18px;color:var(--fg);font-variant-numeric:tabular-nums}.gp-kn{font-size:12px;color:var(--muted)}.gp-k.none b{color:var(--muted)}' +
  '@media (max-width:620px){.gp-key{grid-template-columns:repeat(2,minmax(0,1fr))}}';
