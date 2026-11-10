// Review Ask: customers who paid in the last 30 days, builders and managers first, with a review ask from the owner.
FZ.board('review-ask', {
  source: 'Invoices and clients: Jobber, live.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const DAYS = 30, LOOKUP_CAP = 25, MONTHS = 6;
    const LINK = (FZ.profile().reviewLink || '').trim() || '[your Google review link]';
    // No review link yet: one box to add it, so every ask carries the real link.
    const linkBox = () => {
      if ((FZ.profile().reviewLink || '').trim()) return null;
      const { h } = ui;
      const inp = h('input', { type: 'url', placeholder: 'Paste your Google review link', style: 'font:inherit;font-size:14px;padding:8px 10px;border-radius:9px;border:1px solid var(--line);background:var(--card);color:var(--fg);min-width:260px;flex:1' });
      const msg = h('p', { class: 'fz-hint', role: 'status' }, 'Find it in your Google Business Profile: Ask for reviews, then Copy link.');
      const b = h('button', { type: 'button', class: 'fz-btn act' }, 'Save link');
      b.addEventListener('click', async () => {
        const v = inp.value.trim(); if (!/^https?:\/\//.test(v)) { msg.textContent = 'Paste the full link, starting with https.'; return; }
        b.disabled = true;
        const cur = (FZ.act && await FZ.act.getDoc('settings/profile')) || {};
        const ok = FZ.act && await FZ.act.setDoc('settings/profile', Object.assign({}, cur, { reviewLink: v }));
        msg.textContent = ok ? 'Saved. Every review ask now carries your link. Refresh to see it in the notes.' : 'Could not save. Try again.'; b.disabled = false;
      });
      return ui.section('Add your Google review link', 'Every ask uses it. You only do this once.', h('div', { style: 'display:flex;gap:8px;flex-wrap:wrap;align-items:center' }, inp, b), msg);
    };
    const [invoices, clients] = await Promise.all([
      ctx.jobberAll('search_invoices', { status: 'paid', issuedDate: { after: fmt.isoDaysAgo(MONTHS * 31 + 31) }, sort: 'createdAt', limit: 50 }, 'invoices', 500),
      ctx.jobberAll('search_clients', { limit: 100 }, 'clients', 300)
    ]);
    const paidAt = (v) => v.updatedAt || v.issuedDate || v.createdAt;
    const recent = invoices.filter((v) => v.client && fmt.daysSince(paidAt(v)) <= DAYS).sort((a, b) => (paidAt(a) < paidAt(b) ? 1 : -1));

    // One per client, most recent invoice.
    const seen = new Set();
    const picks = recent.filter((v) => !seen.has(v.client.id) && seen.add(v.client.id));
    const byId = new Map(clients.map((c) => [c.id, c]));
    const missing = picks.filter((v) => !byId.has(v.client.id)).slice(0, LOOKUP_CAP);
    await ctx.pool(missing, 4, async (v) => { const r = await ctx.jobber('get_client', { clientId: v.client.id }); if (r && r.client) byId.set(v.client.id, r.client); });

    const rows = picks.map((v) => {
      const c = byId.get(v.client.id) || {};
      const co = fmt.clean(c.companyName) || (c.isCompany ? fmt.clean(c.name) : '');
      const name = fmt.clean(c.name || v.client.name);
      const first = co && name.toLowerCase() === co.toLowerCase() ? 'there' : fmt.firstName(name);
      return { v, c, co, name, first };
    }).sort((a, b) => (!!b.co - !!a.co) || (paidAt(a.v) < paidAt(b.v) ? 1 : -1));
    const pros = rows.filter((r) => r.co);

    const work = (r) => fmt.clean(r.v.subject).toLowerCase() || 'recent work';
    const draft = (r) => r.co
      ? 'Hi ' + r.first + ',\n\nThanks for bringing us in on the ' + work(r) + '. It was good working with your team.\n\n' +
        'If you have a minute, a short Google review from a builder or manager means a lot to a small shop like ours. Here is the link: ' + LINK + '\n\nThanks again,\n' + FZ.sign()
      : 'Hi ' + r.first + ',\n\nThank you for choosing ' + FZ.biz() + ' for the ' + work(r) + '. I hope you are enjoying it.\n\n' +
        'If you have a minute, a short Google review helps other folks near ' + FZ.town() + ' find us. Here is the link: ' + LINK + '\n\nThanks again,\n' + FZ.sign();

    ctx.metric('review-ask', rows.length
      ? { value: fmt.plural(rows.length, 'customer') + ' to ask', detail: fmt.plural(pros.length, 'builder or manager', 'builders or managers') + ', paid in the last ' + DAYS + ' days' }
      : { value: 'No one new to ask', detail: 'Last ' + DAYS + ' days' });

    const out = [];
    const { h } = ui;
    const K = FZ.kit;
    const short = (n) => fmt.money(n, { short: true });
    const T = (FZ.tasksNow && FZ.tasksNow().done) || {};
    const qidOf = (k) => 'send-' + String(k || '').replace(/[^A-Za-z0-9]+/g, '-').slice(-80);
    const linkOf = (r) => r.c.jobberWebUri || r.v.jobberWebUri;
    const nameLink = (r) => linkOf(r) ? ui.extLink(linkOf(r), r.co || r.name, 'fz-tlink') : (r.co || r.name);
    const ago = (r) => Math.max(0, fmt.daysSince(paidAt(r.v)) || 0);
    const agoText = (r) => ago(r) === 0 ? 'today' : fmt.plural(ago(r), 'day') + ' ago';
    const run = FZ.runs && FZ.runs['review-ask'];
    const ranAt = run && run.last && fmt.dayKey(run.last) === fmt.dayKey(new Date().toISOString()) && !/error/i.test(run.lastStatus || '') ? fmt.fmtTime(run.last) : null;
    const goWork = (needle) => () => {
      const tab = document.querySelector('#fz-board .fz-subtabs [data-id="work"]'); if (tab) tab.click();
      setTimeout(() => { const el = [...document.querySelectorAll('#fz-board .fz-tabbody[data-id="work"] .fz-card')].find((c) => c.textContent.includes(needle)); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60);
    };
    const btn = (label, fn) => h('button', { type: 'button', class: 'fz-btn act ra-go', onclick: fn }, label);
    const css = h('style', null, RA_MO_CSS + RA_CSS + '.fz-btn.ra-go{background:var(--accent)!important;color:var(--on-accent,#111)!important}');
    const HOW = 'It picks customers who just paid, builders and managers first, and writes each one a review ask from you.';

    // Paid customers per month, last 6 months: everyone you could ask. Shown with 2 or more months of data.
    const months = [];
    const now = new Date();
    for (let i = MONTHS - 1; i >= 0; i--) { const dt = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ key: dt.getFullYear() + '-' + String(dt.getMonth() + 1).padStart(2, '0'), label: dt.toLocaleString('en-US', { month: 'short' }), who: new Set() }); }
    invoices.forEach((v) => { const p = paidAt(v); if (!p || !v.client) return; const m = months.find((x) => x.key === String(p).slice(0, 7)); if (m) m.who.add(v.client.id); });
    const monthCount = months.filter((m) => m.who.size).length;
    const sixMonths = new Set(); months.forEach((m) => m.who.forEach((id) => sixMonths.add(id)));
    const cur = months[months.length - 1];
    const monthBars = () => {
      const peak = Math.max(1, ...months.map((m) => m.who.size));
      return h('div', { class: 'ra-mw' },
        h('p', { class: 'ra-mh' }, 'Paid customers per month'),
        h('div', { class: 'ra-mo viz', role: 'img', 'aria-label': months.map((m) => m.label + ' ' + m.who.size).join(', ') },
          months.map((m) => h('div', { class: 'ra-mc' + (m === cur ? ' hi' : '') },
            h('span', { class: 'ra-mv' }, String(m.who.size)),
            h('span', { class: 'ra-mt' }, h('span', { class: 'ra-mf', style: 'height:' + (m.who.size ? Math.max(4, m.who.size / peak * 100) : 0) + '%' })),
            h('span', { class: 'ra-ml' }, m.label)))));
    };

    // Quiet: no one paid in the last 30 days.
    if (!rows.length) {
      out.push(ui.status(['No invoices were paid in the last ' + DAYS + ' days. ', { b: 'No one new to ask yet.' }]));
      out.push(K.how(h, HOW));
      const exChip = (n, m) => h('li', { class: 'ra-chip' }, h('span', { class: 'ra-n' }, n), h('span', { class: 'ra-m' }, m));
      out.push(K.quiet(h,
        K.checked(h, 'Paid invoices checked in Jobber', [
          'No invoice marked paid in the last ' + DAYS + ' days',
          sixMonths.size ? fmt.plural(sixMonths.size, 'customer') + ' paid in the last ' + MONTHS + ' months' : null,
          ranAt ? 'Last check ' + ranAt : 'Checked live from Jobber just now',
          'A review ask is written the week a customer pays']),
        K.example(h, 'Asks go out the week they pay', [h('div', { class: 'ra-col fresh' }, h('p', { class: 'ra-h' }, h('b', null, '3'), ' paid this week'),
          h('ul', { class: 'ra-chips' }, exChip('Lakeview Builders', 'Builder · Paid today'), exChip('Pine Ridge HOA', 'Builder · 2 days ago'), exChip('Kim Residence', '5 days ago')))])));
      out.push(css);
      out.push(ui.how('Customers with an invoice marked paid in Jobber in the last ' + DAYS + ' days, one per customer, newest first.'));
      return out;
    }

    // 1. Headline. 2. What it does.
    out.push(ui.status([fmt.plural(rows.length, 'customer') + ' paid in the last ' + DAYS + ' days. ', { b: 'A review ask is ready for each.' }]));
    out.push(K.how(h, HOW));

    // 3. Hero: this week against older as chips, the monthly bars under them, and what it did today.
    const fresh = rows.filter((r) => ago(r) <= 7);
    const older = rows.filter((r) => ago(r) > 7);
    const chip = (r) => h('li', { class: 'ra-chip', title: (r.co || r.name) + ', paid ' + fmt.fmtDate(paidAt(r.v)) + ', ' + fmt.money(r.v.total) },
      h('span', { class: 'ra-n' }, nameLink(r)), h('span', { class: 'ra-m' }, (r.co ? 'Builder · ' : '') + (ago(r) === 0 ? 'Paid today' : agoText(r))));
    const col = (cls, label, list, empty) => h('div', { class: 'ra-col ' + (list.length ? cls : 'none') },
      list.length ? h('p', { class: 'ra-h' }, h('b', null, String(list.length)), ' ' + label) : h('p', { class: 'ra-h' }, label.replace(/^./, (c) => c.toUpperCase())),
      list.length ? h('ul', { class: 'ra-chips' }, list.slice(0, 8).map(chip)) : h('p', { class: 'ra-empty' }, empty),
      list.length > 8 ? h('p', { class: 'fz-more' }, 'And ' + (list.length - 8) + ' more.') : null);
    const queued = rows.filter((r) => (T[qidOf(linkOf(r) || r.co || r.name)] || {}).outbox).length;
    out.push(K.hero(h, {
      eyebrow: 'Paid in the last ' + DAYS + ' days',
      title: fresh.length ? [fmt.plural(fresh.length, 'customer') + ' paid this week, ', { b: 'the best time to ask' }] : ['No one paid this week. ', { b: fmt.plural(older.length, 'customer') + ' still worth asking' }],
      sub: 'Asked inside the first week, far more customers leave a review.',
      viz: h('div', { class: 'ra-hero' },
        h('div', { class: 'ra-split viz' + (fresh.length && older.length ? '' : ' one') }, fresh.length ? col('fresh', 'paid this week', fresh, '') : null, older.length ? col('old', 'paid 1 to 4 weeks ago', older, '') : null),
        monthCount >= 2 ? monthBars() : null),
      did: [
        { t: 'Checked Jobber for paid invoices', s: ranAt || 'Live from Jobber' },
        { t: 'Found ' + fmt.plural(rows.length, 'customer') + ' who paid', s: pros.length ? fmt.plural(pros.length, 'builder or manager', 'builders or managers') : 'All homeowners' },
        { t: 'Wrote a review ask for each, builders first' },
        queued ? { t: fmt.plural(queued, 'ask') + ' queued by you' } : null,
        { t: 'Next: queued asks go out from your email on the next run', done: false }
      ].filter(Boolean)
    }));

    // 4. The top 3 by job size, the rest folded with the detail table.
    const byAmt = rows.slice().sort((x, y) => (Number(y.v.total) || 0) - (Number(x.v.total) || 0));
    const top3 = byAmt.slice(0, 3), rest = byAmt.slice(3);
    out.push(K.needs(h, {
      title: fmt.plural(top3.length, 'review ask') + ' to OK, biggest jobs first',
      items: top3.map((r) => {
        const t = T[qidOf(linkOf(r) || r.co || r.name)] || {};
        return {
          meta: [{ b: short(Number(r.v.total) || 0) }, ' · ' + (r.co ? 'Builder or manager' : 'Homeowner') + ' · Paid ' + agoText(r)],
          title: r.co || r.name,
          detail: t.handled ? 'Marked as handled.' : t.outbox ? 'Review ask queued, goes out next run.' : 'Review ask written, ready for your OK.',
          actions: [btn('Review the ask', goWork(r.co || r.name)), linkOf(r) ? ui.extLink(linkOf(r), 'Open in Jobber', 'fz-tlink') : null].filter(Boolean)
        };
      }),
      rest: { count: rest.length, label: 'with a review ask ready on the next tab', list: ui.table([
        { label: 'Paid', get: (r) => fmt.fmtDate(paidAt(r.v)) },
        { label: 'Customer', get: (r) => linkOf(r) ? ui.extLink(linkOf(r), r.name, 'fz-tlink') : r.name },
        { label: 'Company', get: (r) => r.co || '' },
        { label: 'Invoice', get: (r) => '#' + r.v.invoiceNumber + ' ' + fmt.clean(r.v.subject) },
        { label: 'Total', num: true, get: (r) => fmt.money(r.v.total) }
      ], rest, { open: true }) }
    }));
    out.push(css);

    // Work tab: one card per customer.
    out.push(ui.cards(rows.map((r) => ({
      when: (r.co ? 'Builder or manager · ' : 'Homeowner · ') + 'Paid ' + fmt.fmtDay(paidAt(r.v)),
      who: r.co ? r.co : r.name,
      why: (r.co && r.name.toLowerCase() !== r.co.toLowerCase() ? r.name + ', ' : '') + fmt.clean(r.v.subject) + ', invoice #' + r.v.invoiceNumber + '.',
      amount: Number(r.v.total) || 0,
      link: r.c.jobberWebUri || r.v.jobberWebUri, linkLabel: 'Open client',
      draftSubject: 'Thank you from ' + FZ.biz(), clientId: r.v.client && r.v.client.id, draft: draft(r), draftLabel: 'Draft a review ask'
    })), { max: 50 }));
    { const lb = linkBox(); if (lb) out.push(lb); }
    out.push(ui.how(
      'Customers with an invoice marked paid in Jobber in the last ' + DAYS + ' days, one per customer, newest first.',
      'Builders and property managers come first. That means any client with a company name in Jobber.',
      'Jobber Reviews may already ask homeowners after each paid invoice. These notes are for builders and managers to hear from you personally.',
      'The monthly bars count each customer once per month they paid, for the last ' + MONTHS + ' months.',
      'Swap ' + LINK + ' for your review link before you send. Queued emails go out from your email on the next run. Nothing goes out unless you queue it.'));
    return out;
  }
});
const RA_MO_CSS = '.ra-hero{display:flex;flex-direction:column;gap:18px}.ra-mh{margin:0 0 8px;font-size:13px;color:var(--muted)}.ra-mo{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:10px;max-width:420px}' +
  '.ra-mc{display:flex;flex-direction:column;align-items:stretch;gap:4px;min-width:0;text-align:center}' +
  '.ra-mt{height:56px;display:flex;align-items:flex-end}.ra-mf{display:block;width:100%;background:var(--bar);border-radius:4px 4px 0 0}.ra-mc.hi .ra-mf{background:var(--accent)}' +
  '.ra-mv{font-size:14px;font-weight:700;color:var(--fg);font-variant-numeric:tabular-nums}.ra-mc.hi .ra-mv{color:var(--accent-text)}.ra-ml{font-size:12px;color:var(--muted)}';
const RA_CSS = '.ra-split{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}' +
  '.ra-col{display:flex;flex-direction:column;gap:10px;min-width:0;padding:14px 16px;border:1px solid var(--edge);border-radius:12px;background:var(--card)}' +
  '.ra-col.fresh{border-color:var(--accent)}.ra-h{margin:0;font-size:14px;color:var(--meta)}.ra-h b{font-size:22px;color:var(--fg);font-variant-numeric:tabular-nums;margin-right:2px}.ra-col.fresh .ra-h b{color:var(--accent-text)}' +
  '.ra-chips{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:8px}' +
  '.ra-chip{display:flex;flex-direction:column;gap:1px;padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--chip,var(--quiet));min-width:0;max-width:100%}' +
  '.ra-n{font-size:14px;font-weight:600;color:var(--fg);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ra-n a{color:var(--fg)}.ra-m{font-size:12px;color:var(--muted)}' +
  '.ra-empty{margin:0;font-size:14px;color:var(--muted)}' +
  '.ra-split.one{grid-template-columns:minmax(0,1fr)}@media (max-width:620px){.ra-split{grid-template-columns:minmax(0,1fr)}}';
