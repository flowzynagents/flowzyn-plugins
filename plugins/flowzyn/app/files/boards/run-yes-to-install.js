// Book Jobs: approved work that is not booked yet, with the glass order to the shop's supplier ready to send.
FZ.board('yes-to-install', {
  source: 'Quotes and jobs: Jobber, live.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const MAX_CALLS = 20;
    const [quotes, jobs, booked] = await Promise.all([
      ctx.jobberAll('search_quotes', { status: 'approved', limit: 100 }, 'quotes', 200),
      ctx.jobberAll('search_jobs', { status: 'unscheduled', limit: 50 }, 'jobs', 200),
      ctx.jobberAll('search_quotes', { status: 'converted', dateRange: { after: fmt.isoDaysAgo(90) }, limit: 100 }, 'quotes', 200).catch(() => [])
    ]);

    // One list of yeses: approved quotes not yet turned into a job, and jobs with no visit booked.
    const seenQuote = new Set();
    let rows = [];
    quotes.forEach((q) => { seenQuote.add(q.id); rows.push({ kind: 'quote', id: q.id, ref: 'Quote #' + q.quoteNumber, title: fmt.clean(q.title), who: fmt.clean(q.client && q.client.name), clientId: q.client && q.client.id, total: Number(q.total) || 0, yesAt: q.approvedAt || q.updatedAt, link: q.jobberWebUri }); });
    jobs.forEach((j) => rows.push({ kind: 'job', id: j.id, ref: 'Job #' + j.jobNumber, title: fmt.clean(j.title), who: fmt.clean(j.client && j.client.name), clientId: j.client && j.client.id, total: Number(j.total) || 0, yesAt: j.createdAt, link: j.jobberWebUri, city: j.property && j.property.address && fmt.clean(j.property.address.city) }));
    const score = (r) => Math.max(1, fmt.daysSince(r.yesAt) || 0) * r.total;
    rows.sort((a, b) => score(b) - score(a));

    // Line items for the supplier order, in rank order, within a call budget.
    let calls = 0;
    const take = () => (calls < MAX_CALLS ? ++calls : 0);
    await ctx.pool(rows, 4, async (r) => {
      if (r.kind === 'quote') {
        if (!take()) return;
        const d = await ctx.jobber('get_quote', { quoteId: r.id });
        r.lines = (d && d.quote && d.quote.lineItems) || [];
        return;
      }
      if (!take()) return;
      const jd = await ctx.jobber('get_job', { id: r.id });
      const job = jd && jd.job;
      const qid = job && job.relatedWork && job.relatedWork.quote && job.relatedWork.quote.id;
      r.lines = (job && job.lineItems && job.lineItems.nodes) || [];
      if (qid && !seenQuote.has(qid) && take()) {
        const qd = await ctx.jobber('get_quote', { quoteId: qid });
        const q = qd && qd.quote;
        if (q) {
          if (q.lineItems && q.lineItems.length) r.lines = q.lineItems;
          if (q.lastTransitioned && q.lastTransitioned.approvedAt) r.yesAt = q.lastTransitioned.approvedAt;
          r.ref += ', Quote #' + q.quoteNumber;
        }
      }
    });
    rows.forEach((r) => { r.days = Math.max(0, fmt.daysSince(r.yesAt) || 0); });
    rows.sort((a, b) => score(b) - score(a));

    const total = rows.reduce((s, r) => s + r.total, 0);
    ctx.metric('yes-to-install', rows.length
      ? { value: fmt.plural(rows.length, 'job') + ' to book', detail: fmt.money(total, { short: true }) + ' approved, oldest yes ' + Math.max(...rows.map((r) => r.days)) + ' days ago' }
      : { value: 'Every yes is booked', detail: '' });

    // The shop orders from one supplier. Name comes from the QuickBooks bills, email is set once here.
    const sup = Object.assign({ name: '', email: '' }, FZ.profile().supplier || {});
    const named = !!sup.name; if (!named) sup.name = 'your supplier';
    // The supplier's order email comes from Jobber: the supplier kept as a client there.
    if (!sup.email && named) {
      try {
        const found = await ctx.jobber('search_clients', { query: sup.name.replace(/&/g, 'and').split(' ')[0], limit: 10 });
        const list = (found && (found.clients || found.nodes || found)) || [];
        const want = sup.name.toLowerCase().replace(/[^a-z]/g, '').slice(0, 6);
        const c = [].concat(list).find((x) => x && String((x.companyName || x.name || '')).toLowerCase().replace(/[^a-z]/g, '').startsWith(want));
        const em = c && ((c.emails && c.emails[0] && (c.emails[0].address || c.emails[0])) || c.email);
        if (em) { sup.email = String(em); sup.fromJobber = true; }
      } catch (e) { /* stays unset, Operator view shows the field */ }
    }
    const { h } = ui;
    const K = FZ.kit;
    const out = [];
    const short = (n) => fmt.money(n, { short: true });
    const run = FZ.runs && FZ.runs['yes-to-install'];
    const ranAt = run && run.last && fmt.dayKey(run.last) === fmt.dayKey(new Date().toISOString()) && !/error/i.test(run.lastStatus || '') ? fmt.fmtTime(run.last) : null;
    const goWork = (needle) => () => {
      const tab = document.querySelector('#fz-board .fz-subtabs [data-id="work"]'); if (tab) tab.click();
      setTimeout(() => { const el = [...document.querySelectorAll('#fz-board .fz-tabbody[data-id="work"] .fz-card')].find((c) => c.textContent.includes(needle)); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
    };
    const btn = (label, fn) => h('button', { type: 'button', class: 'fz-btn act yi-go', onclick: fn }, label);
    const GOAL = 7;
    // Ranked bars of days waiting, a marker at 1 week. Works for real rows and the labelled example.
    const daysChart = (list, linkIt) => {
      const show = list.slice().sort((a, b) => b.days - a.days || b.total - a.total).slice(0, 8);
      const top = Math.max(GOAL * 2, ...list.map((r) => r.days)) * 1.05;
      const pos = (d) => Math.min(100, d / top * 100);
      return h('div', { class: 'yi-chart' },
        h('div', { class: 'yi-rows' }, show.map((r) => h('div', { class: 'yi-row' + (r.days > GOAL ? ' late' : ''), title: r.who + ', ' + fmt.plural(r.days, 'day') + ' since yes, ' + fmt.money(r.total) },
          h('div', { class: 'yi-who' }, linkIt && r.link ? ui.extLink(r.link, r.who, 'fz-tlink') : r.who),
          h('div', { class: 'yi-track' }, h('span', { class: 'yi-fill', style: 'width:' + Math.max(1.5, pos(Math.min(r.days, GOAL))) + '%' }),
            r.days > GOAL ? h('span', { class: 'yi-over', style: 'left:calc(' + pos(GOAL) + '% + 2px);width:calc(' + (pos(r.days) - pos(GOAL)) + '% - 2px)' }) : null,
            h('span', { class: 'yi-mark', style: 'left:' + pos(GOAL) + '%' })),
          h('div', { class: 'yi-val' }, h('b', null, short(r.total)), h('span', null, fmt.plural(r.days, 'day'))))),
          h('div', { class: 'yi-row yi-axis' }, h('div'), h('div', { class: 'yi-track bare' }, pos(GOAL) > 12 ? h('span', { style: 'left:0' }, '0') : null, h('span', { class: 'g', style: 'left:' + pos(GOAL) + '%' }, '1 week'), h('span', { style: 'right:0' }, fmt.plural(Math.round(top), 'day'))), h('div'))),
        h('div', { class: 'yi-key' }, h('span', null, h('i', { class: 'k-late' }), 'Days past 1 week'), h('span', null, h('i', { class: 'k-ok' }), 'First week')),
        list.length > show.length ? h('p', { class: 'fz-more' }, (list.length - show.length) + ' more, listed under Needs you.') : null,
        h('style', null, YI_CSS));
    };

    if (!rows.length) {
      const st = ui.status(['Every yes is booked. ', { b: 'Nothing waiting to go on the schedule.' }]);
      st.classList.add('yi-good');
      out.push(st, K.how(h, 'It turns every yes into a booked job inside a week, with the order to ' + sup.name + ' written for you.'));
      const ex = [['Lakeview Condo', 4850, 11], ['Bluebird Cabin', 3200, 6], ['Main Street Salon', 1900, 3], ['Pine Ridge HOA', 2600, 1]].map(([who, total, days]) => ({ who, total, days }));
      out.push(K.quiet(h,
        K.checked(h, 'Approved quotes checked in Jobber', ['No approved quote waiting to be booked', 'No job without a visit date', booked.length ? fmt.plural(booked.length, 'yes', 'yeses') + ' turned into jobs in the last 90 days' : null]),
        K.example(h, 'One yes waiting over a week', daysChart(ex, false))));
      out.push(ui.how('Counts approved quotes not yet converted to a job, and jobs in Jobber with no visit scheduled.'));
      return out;
    }
    const late = rows.filter((r) => r.days > GOAL);
    const lateD = late.reduce((n, r) => n + r.total, 0);
    out.push(ui.status(late.length
      ? [short(total) + ' in yeses not booked yet. ', { b: short(lateD) + ' has waited over a week.' }]
      : [short(total) + ' in yeses not booked yet. ', { b: 'All inside a week.' }]));
    out.push(K.how(h, 'It turns every yes into a booked job inside a week, with the order to ' + sup.name + ' written for you.'));

    const yes90 = booked.length + quotes.filter((q) => fmt.daysSince(q.approvedAt || q.updatedAt) <= 90).length;
    const bookedPct = yes90 ? Math.round(booked.length / yes90 * 100) : 0;
    const orders = rows.filter((r) => r.lines).length;
    const T = (FZ.tasksNow && FZ.tasksNow().done) || {};
    const qidOf = (k) => 'send-' + String(k || '').replace(/[^A-Za-z0-9]+/g, '-').slice(-80);
    const queued = rows.filter((r) => (T[qidOf(r.link || r.who)] || {}).outbox).length;
    out.push(K.hero(h, {
      eyebrow: 'Days since the customer said yes',
      title: late.length ? [fmt.plural(late.length, 'yes', 'yeses') + ' waiting ', { b: 'over a week' }] : ['Every yes is ', { b: 'inside a week' }],
      sub: 'Yeses not booked, by how long they have waited. ' + (yes90 ? bookedPct + '% of yeses in the last 90 days got booked.' : ''),
      viz: (() => {
        const B = [['Inside a week', 0, 7], ['1 to 4 weeks', 8, 28], ['1 to 3 months', 29, 90], ['Over 3 months', 91, 1e9]].map(([l, a, z]) => { const rs = rows.filter((r) => r.days >= a && r.days <= z); return { l, n: rs.length, d: rs.reduce((n, r) => n + r.total, 0), late: a > 7 }; }).filter((b) => b.n);
        const mx = Math.max(...B.map((b) => b.d), 1);
        return h('div', { class: 'yi-cols' }, B.map((b) => h('div', { class: 'yi-col' },
          h('b', null, short(b.d)), h('span', { class: 'yi-bar' + (b.late ? ' late' : ''), style: 'height:' + Math.max(8, Math.round(b.d / mx * 120)) + 'px' }),
          h('span', { class: 'yi-l' }, b.l), h('span', { class: 'yi-n' }, fmt.plural(b.n, 'job')))),
          h('style', null, '.yi-cols{display:flex;gap:18px;align-items:flex-end;min-height:190px;padding-top:8px}.yi-col{flex:1;min-width:0;display:flex;flex-direction:column;align-items:flex-start;gap:6px}.yi-col b{font-size:18px}.yi-bar{display:block;width:100%;max-width:140px;border-radius:6px 6px 0 0;background:var(--bar,#6b7280)}.yi-bar.late{background:var(--accent)}.yi-l{font-size:13px;color:var(--fg)}.yi-n{font-size:12px;color:var(--muted)}'));
      })(),
      did: [
        { t: 'Checked ' + fmt.plural(rows.length, 'yes', 'yeses') + ' not booked in Jobber', s: ranAt || 'Live from Jobber' },
        orders ? { t: 'Wrote ' + fmt.plural(orders, 'supplier order') + ' to ' + sup.name, s: 'From the quote line items' } : null,
        queued ? { t: fmt.plural(queued, 'order') + ' queued by you' } : null,
        { t: 'Ranked them by days waiting and dollars' },
        { t: 'Next: queued orders go out, then book the install', done: false }
      ].filter(Boolean)
    }));

    const picks = rows.slice(0, 3);
    const restRows = rows.slice(3);
    out.push(K.needs(h, {
      title: fmt.plural(picks.length, 'job') + ' to book, longest wait and biggest first',
      items: picks.map((r) => ({
        meta: [{ b: short(r.total) }, ' · ' + r.ref + ', yes ' + fmt.plural(r.days, 'day') + ' ago'],
        title: r.who,
        detail: [String(r.title || '').replace(/^[\s.]+/, ''), r.kind === 'quote' ? 'Not a job yet' : 'No visit booked', r.lines ? 'Order to ' + sup.name + ' is written' : 'Book the install'].filter(Boolean).join('. ') + '.',
        review: r.lines && sup.email ? { to: sup.name + ' <' + sup.email + '>', subject: 'Order for ' + r.who + ', ' + r.ref, draft: supplierDraft(r), approveLabel: 'Approve and order',
          note: 'Edit anything first. It goes to ' + sup.name + ' from your own email' + (sup.fromJobber ? ', address from Jobber.' : '.'),
          approve: (text) => !FZ.queueSend ? Promise.resolve(false) : FZ.queueSend('send-' + String(r.link || r.who).replace(/[^A-Za-z0-9]+/g, '-').slice(-80), { who: r.who, link: r.link || null, to: sup.email, subject: 'Order for ' + r.who + ', ' + r.ref, body: text }) } : null,
        actions: [r.lines && sup.email ? null : btn(r.lines ? 'Order from supplier' : 'Book it', goWork(r.ref)), r.link ? ui.extLink(r.link, 'Open in Jobber', 'fz-tlink') : null].filter(Boolean)
      })),
      rest: { count: restRows.length, label: 'the agent is lining up on its own', list: ui.table([
        { label: 'Customer', get: (r) => r.link ? ui.extLink(r.link, r.who, 'fz-tlink') : r.who },
        { label: 'Work', get: (r) => r.title },
        { label: 'Where it is', get: (r) => r.kind === 'quote' ? 'Approved quote' : 'Job, no visit' },
        { label: 'Days', num: true, get: (r) => String(r.days) },
        { label: 'Amount', num: true, get: (r) => fmt.money(r.total) }
      ], restRows, { open: true }) }
    }));
    out.push(h('style', null, '.fz-btn.yi-go{background:var(--accent)!important;color:var(--on-accent,#111)!important}'));

    // Work tab: the orders and bookings.
    out.push(ui.cards(rows.map((r) => ({
      when: 'Yes ' + fmt.plural(r.days, 'day') + ' ago · ' + (r.kind === 'quote' ? 'Not a job yet' : 'No visit booked'),
      who: r.who,
      why: r.title + ', ' + r.ref + '. ' + (r.kind === 'quote' ? 'Convert it to a job and book the install.' : 'Book the install.'),
      amount: r.total,
      flag: r.days > GOAL,
      link: r.link,
      draft: r.lines ? supplierDraft(r) : null,
      draftLabel: 'Order to ' + sup.name,
      draftTo: sup.email || '',
      draftSubject: 'Order for ' + r.who + ', ' + r.ref
    })), { max: 50 }));
    if (!sup.email) out.push((FZ.isOperator() || !FZ.hasOperator()) ? supplierField() : ui.note('No order email for ' + sup.name + ' in Jobber yet. Your Operator adds it once.'));

    out.push(ui.how('Counts approved quotes not yet converted to a job, and jobs in Jobber with no visit scheduled.',
      'Days count from the day the customer said yes. Ranked by days waiting times dollars, so a big job waiting a week comes before a small one waiting a day.',
      'The supplier order is built from the quote line items, as written on the quote. Check it before you send it.',
      'Orders go to ' + sup.name + ', the supplier on your QuickBooks bills, at the email on their record in Jobber.', 'Waiting more than a week shows in orange.'));
    return out;

    function supplierField() {
      const inp = ui.h('input', { type: 'email', placeholder: sup.name + ' order email', 'aria-label': sup.name + ' order email' });
      const msg = ui.h('span', { class: 'fz-more' });
      const save = ui.h('button', { type: 'button', class: 'fz-btn sm' }, 'Save');
      save.onclick = async () => {
        const v = inp.value.trim();
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) { msg.textContent = 'That does not look like an email.'; return; }
        const ok = await FZ.saveProfile({ supplier: { name: sup.name, email: v } });
        msg.textContent = ok ? 'Saved. Reload to fill every order.' : 'Could not save. Try again.';
      };
      return ui.section('Where should orders go?', 'Every order is addressed to ' + sup.name + '. Add their order email once.', ui.h('div', { class: 'sp-field' }, inp, save, msg));
    }
    function supplierDraft(r) {
      const items = (r.lines || []).filter((l) => !l.textOnly && !/labor|labour|haul|assessment|travel|disposal|measure|deposit/i.test(l.name || ''));
      const lines = items.length ? items.map((l, i) => {
        const p = parseLine(l);
        const head = (i + 1) + '. ' + fmt.clean(l.name) + ', qty ' + (l.quantity || 1);
        if (p.hardwareOnly && FZ.isGlass()) return head + '\n   Hardware: ' + (p.hardware || 'as quoted');
        return head +
          (FZ.isGlass()
            ? '\n   Glass: ' + (p.glass || 'see quote, please confirm') +
              '\n   Size: ' + (p.sizes.length ? p.sizes.join(', ') : 'to follow after final measure') +
              '\n   Hardware: ' + (p.hardware || 'none listed')
            : (fmt.clean(l.description) ? '\n   ' + fmt.clean(l.description) : ''));
      }).join('\n') : '1. ' + r.title + '\n   Details to follow after final measure';
      const own = FZ.tpl.body('supplier-order', { supplier: (sup.contact || sup.name), customer: r.who, 'in town': r.city ? ', ' + r.city : '', 'quote ref': r.ref, 'order lines': lines }, null, null);
      if (own) return own;
      return 'Hi ' + (sup.contact || sup.name) + ',\n\nPlease confirm price and lead time on this order for ' + FZ.biz() + '.\n\n' +
        'Job: ' + r.who + (r.city ? ', ' + r.city : '') + ' (' + r.ref + ')\n\n' + lines +
        '\n\nLet me know the earliest delivery date and I will book the job around it.\n\nThanks,\n' + FZ.sign();
    }
    function parseLine(l) {
      const name = fmt.clean(l.name);
      const desc = fmt.clean(l.description);
      const text = desc ? name + '. ' + desc : name;
      const sentences = (desc || name).split(/(?<=\.)\s+/);
      const hwRe = /hardware|hinge|clamp|handle|pull|channel|clip|header|knob|towel bar|seal|sweep/i;
      const glassRe = /tempered|laminated|annealed|low ?e\b|low iron|starphire|ultra clear|clear|frosted|obscure|tinted|bronze|gr[ae]y|mirror|insulated|igu|dual pane|double pane|glass/i;
      const thick = text.match(/\b(\d+\/\d+|\d+(?:\.\d+)?)\s*(?:inch|in\b|")/i);
      const glassSentence = desc ? sentences.find((s) => glassRe.test(s) && !hwRe.test(s)) : '';
      let glass = glassSentence ? glassSentence.replace(/\.$/, '') : '';
      if (!glass && thick) glass = thick[0];
      if (!desc && hwRe.test(name)) return { hardwareOnly: true, glass: '', sizes: [], hardware: name };
      const sizes = [];
      const sizeRe = /(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?)\s*(?:"|in\b|inch(?:es)?)?\s*[x×]\s*(\d+(?:\.\d+)?(?:\s+\d+\/\d+)?)\s*(?:"|in\b|inch(?:es)?)?/gi;
      let m;
      while ((m = sizeRe.exec(text))) sizes.push(m[1] + ' x ' + m[2] + ' in');
      const hw = desc ? sentences.filter((s) => hwRe.test(s)).map((s) => s.replace(/\.$/, '')) : [];
      return { glass, sizes, hardware: hw.join(', ') };
    }
  }
});
const YI_CSS = '.yi-chart{display:flex;flex-direction:column;gap:10px}.yi-rows{display:flex;flex-direction:column;gap:8px}' +
  '.yi-row{display:grid;grid-template-columns:minmax(0,12rem) 1fr 7.5rem;gap:12px;align-items:center;font-size:14px}' +
  '.yi-who{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--fg)}.yi-who a{color:var(--fg)}' +
  '.yi-track{position:relative;height:8px}.yi-fill{position:absolute;left:0;top:0;bottom:0;border-radius:0 4px 4px 0;background:var(--bar)}' +
  '.yi-over{position:absolute;top:0;bottom:0;border-radius:0 4px 4px 0;background:var(--accent)}.yi-row.late .yi-fill{border-radius:0}' +
  '.yi-mark{position:absolute;top:-3px;bottom:-3px;width:0;border-left:2px dashed var(--muted)}' +
  '.yi-val{display:flex;gap:8px;justify-content:flex-end;align-items:baseline;font-variant-numeric:tabular-nums}.yi-val b{color:var(--fg)}.yi-val span{font-size:13px;color:var(--muted);min-width:3.6rem;text-align:right}' +
  '.yi-axis .yi-track.bare{height:16px}.yi-axis span{position:absolute;top:0;font-size:12px;color:var(--muted);white-space:nowrap}.yi-axis .g{transform:translateX(-50%);color:var(--meta)}' +
  '.yi-key{display:flex;gap:18px;flex-wrap:wrap;font-size:13px;color:var(--meta)}.yi-key i{display:inline-block;width:10px;height:10px;border-radius:3px;margin-right:6px}.yi-key .k-late{background:var(--accent)}.yi-key .k-ok{background:var(--bar)}' +
  '.fz-status.yi-good b{color:var(--ok-fg,#22c55e)}' +
  '@media (max-width:620px){.yi-row{grid-template-columns:minmax(0,1fr) auto;row-gap:4px}.yi-who{grid-column:1;grid-row:1}.yi-val{grid-column:2;grid-row:1}.yi-track{grid-column:1/-1;grid-row:2}.yi-axis .yi-track{grid-row:1}}';
