// Month Close: the bookkeeper's checklist for last month, plus this month so far.
FZ.board('month-close', {
  source: 'Invoices and jobs: Jobber, live.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const { h } = ui;
    const JOBBER = 'https://secure.getjobber.com';

    // Month edges in shop time.
    const todayKey = fmt.dayKey(new Date().toISOString());
    const [y, m] = todayKey.split('-').map(Number);
    const monthKey = (yy, mm) => yy + '-' + String(mm).padStart(2, '0');
    const thisM = monthKey(y, m);
    const lastM = m === 1 ? monthKey(y - 1, 12) : monthKey(y, m - 1);
    const nextM = m === 12 ? monthKey(y + 1, 1) : monthKey(y, m + 1);
    const offsetH = (key) => { const n = new Intl.DateTimeFormat('en-US', { timeZone: fmt.TZ, timeZoneName: 'shortOffset' }).formatToParts(new Date(key + 'T12:00:00Z')).find((x) => x.type === 'timeZoneName'); const r = /GMT([+-]\d+)/.exec(n ? n.value : ''); return r ? Number(r[1]) : -7; };
    const startOf = (mk) => new Date(new Date(mk + '-01T00:00:00Z').getTime() - offsetH(mk + '-01') * 3600000).toISOString().replace(/\.\d+Z$/, 'Z');
    const monthName = (mk) => new Date(mk + '-15T12:00:00Z').toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' });
    const inMonth = (iso, mk) => !!iso && fmt.dayKey(iso).slice(0, 7) === mk;

    const [lastInv, thisInv, drafts, unbilled] = await Promise.all([
      ctx.jobberAll('search_invoices', { issuedDate: { after: startOf(lastM), before: startOf(thisM) }, limit: 50 }, 'invoices', 300),
      ctx.jobberAll('search_invoices', { issuedDate: { after: startOf(thisM), before: startOf(nextM) }, limit: 50 }, 'invoices', 300),
      ctx.jobberAll('search_invoices', { status: 'draft', limit: 50 }, 'invoices', 200),
      ctx.jobberAll('search_jobs', { status: 'requires_invoicing', limit: 50 }, 'jobs', 200)
    ]);

    const sum = (list, f) => list.reduce((s, x) => s + (Number(f(x)) || 0), 0);
    const one = (list, uri) => list.length === 1 ? list[0].jobberWebUri : uri;
    const summarize = (inv, mk) => {
      const issued = inv.filter((v) => inMonth(v.issuedDate, mk) && !['draft', 'voided'].includes(v.status));
      const paid = issued.filter((v) => Number(v.paid) > 0);
      const open = issued.filter((v) => Number(v.balance) > 0 && v.status !== 'bad_debt');
      const jobs = unbilled.filter((j) => inMonth(j.completedAt, mk));
      return { issued, paid, open, jobs };
    };
    const L = summarize(lastInv, lastM);
    const T = summarize(thisInv, thisM);

    const lines = (s, mk, withDrafts) => {
      const out = [
        { id: 'issued', label: 'Invoices issued', detail: fmt.plural(s.issued.length, 'invoice') + '. Check each one is in the books.', value: fmt.money(sum(s.issued, (v) => v.total)), link: one(s.issued, JOBBER + '/invoices'), kind: 'check' },
        { id: 'paid', label: 'Payments in', detail: fmt.plural(s.paid.length, 'invoice') + ' paid in full or in part. Match ' + (s.paid.length === 1 ? 'it' : 'them') + ' to deposits.', value: fmt.money(sum(s.paid, (v) => v.paid)), link: one(s.paid, JOBBER + '/invoices'), kind: 'check' },
        { id: 'open', label: 'Still open', detail: s.open.length ? fmt.plural(s.open.length, 'invoice') + ' with a balance. Carry ' + (s.open.length === 1 ? 'it' : 'them') + ' forward.' : 'Every invoice is paid.', value: fmt.money(sum(s.open, (v) => v.balance)), link: one(s.open, JOBBER + '/invoices'), kind: s.open.length ? 'check' : 'clear' },
        { id: 'unbilled', label: 'Finished, not invoiced', detail: s.jobs.length ? fmt.plural(s.jobs.length, 'job') + ' done in ' + monthName(mk) + '. Invoice ' + (s.jobs.length === 1 ? 'it' : 'them') + ' in Jobber.' : 'Every job done in ' + monthName(mk) + ' is invoiced.', value: fmt.money(sum(s.jobs, (j) => j.total)), link: one(s.jobs, JOBBER + '/work_orders'), kind: s.jobs.length ? 'todo' : 'clear' }
      ];
      if (withDrafts) out.push({ id: 'drafts', label: 'Drafts not sent', detail: drafts.length ? fmt.plural(drafts.length, 'draft invoice') + ' in Jobber. Send or clear ' + (drafts.length === 1 ? 'it.' : 'them.') : 'No draft invoices.', value: fmt.money(sum(drafts, (v) => v.total)), link: one(drafts, JOBBER + '/invoices'), kind: drafts.length ? 'todo' : 'clear' });
      return out;
    };
    const lastLines = lines(L, lastM, true);
    const thisLines = lines(T, thisM, false);
    const toClear = lastLines.filter((l) => l.kind === 'todo');

    ctx.metric('month-close', toClear.length
      ? { value: fmt.plural(toClear.length, 'thing') + ' to clear for ' + monthName(lastM), detail: lastLines.find((l) => l.id === 'issued').value + ' invoiced in ' + monthName(lastM) }
      : { value: monthName(lastM) + ' is ready to close', detail: lastLines.find((l) => l.id === 'issued').value + ' invoiced' });

    // Ticks are kept in this browser only, per month.
    const tickKey = (mk, id) => 'fz-mc:' + mk + ':' + id;
    const getTick = (k) => { try { return window.localStorage.getItem(k) === '1'; } catch (e) { return false; } };
    const setTick = (k, on) => { try { window.localStorage.setItem(k, on ? '1' : '0'); } catch (e) { /* ticks just will not stick */ } };
    const css = h('style', null, '.mc-list{display:flex;flex-direction:column;gap:8px}' +
      '.mc-item{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px;border:1px solid var(--edge);border-radius:10px;padding:10px 12px;background:var(--card)}' +
      '.mc-item.todo{border-top:3px solid var(--accent);background:var(--flag-tint)}' +
      '.mc-item label{display:flex;align-items:flex-start;gap:10px;flex:1 1 220px;min-width:0;cursor:pointer}' +
      '.mc-item input{width:18px;height:18px;margin:2px 0 0;accent-color:var(--accent);flex:none}' +
      '.mc-l{display:block;font-weight:700}.mc-d{display:block;font-size:13px;color:var(--muted)}' +
      '.mc-r{display:flex;align-items:center;gap:10px;margin-left:auto}.mc-v{font-weight:700;font-variant-numeric:tabular-nums}' +
      '.mc-item.done .mc-l{text-decoration:line-through;color:var(--muted)}');
    const checklist = (items, mk) => h('div', { class: 'mc-list' }, items.map((l) => {
      const k = tickKey(mk, l.id);
      const row = h('div', { class: 'mc-item' + (l.kind === 'todo' ? ' todo' : '') + (getTick(k) ? ' done' : '') });
      const box = h('input', { type: 'checkbox', checked: getTick(k) || null, onchange: (e) => { setTick(k, e.target.checked); row.classList.toggle('done', e.target.checked); } });
      row.append(
        h('label', null, box, h('span', null, h('span', { class: 'mc-l' }, l.label), h('span', { class: 'mc-d' }, l.detail))),
        h('span', { class: 'mc-r' }, l.kind === 'todo' ? ui.pill('To clear', 'hot') : l.kind === 'clear' ? ui.pill('Clear', 'ok') : null, h('span', { class: 'mc-v' }, l.value), ui.extLink(l.link, 'Open in Jobber', 'fz-cardlink')));
      return row;
    }));

    const out = [css];
    out.push(ui.status(toClear.length
      ? [{ b: String(toClear.length) }, ' ' + (toClear.length === 1 ? 'thing' : 'things') + ' to clear before ' + monthName(lastM) + ' closes.']
      : [monthName(lastM) + ' is ', { b: 'ready' }, ' for the bookkeeper.']));
    out.push(ui.section(monthName(lastM) + ' close', 'Tick each line once it matches the books. Aim to close by the 3rd.', checklist(lastLines, lastM)));
    out.push(ui.section(monthName(thisM) + ' so far', 'Up to today, so the next close is quick.', checklist(thisLines, thisM)));
    out.push(ui.note('Once QuickBooks is connected, this also checks Jobber against the books: invoices missing from QuickBooks and payments that do not match.'));

    const rows = [...L.issued.map((v) => ({ v, mk: lastM })), ...T.issued.map((v) => ({ v, mk: thisM }))];
    out.push(ui.table([
      { label: 'Month', get: (r) => monthName(r.mk) },
      { label: 'Invoice', get: (r) => '#' + r.v.invoiceNumber },
      { label: 'Customer', get: (r) => fmt.clean(r.v.client && r.v.client.name) },
      { label: 'Issued', get: (r) => fmt.fmtDate(r.v.issuedDate) },
      { label: 'Status', get: (r) => ui.pill(Number(r.v.balance) > 0 ? 'Open' : 'Paid') },
      { label: 'Total', num: true, get: (r) => fmt.money(r.v.total) },
      { label: 'Balance', num: true, get: (r) => fmt.money(r.v.balance) },
      { label: 'Jobber', get: (r) => ui.extLink(r.v.jobberWebUri, 'Open') }
    ], rows, { summary: 'All ' + rows.length + ' invoices issued in ' + monthName(lastM) + ' and ' + monthName(thisM) }));

    out.push(ui.how('Invoices issued counts every invoice with an issue date in the month, leaving out drafts and voided ones.',
      'Payments in counts those invoices with any payment recorded in Jobber. Still open is what is left unpaid on them.',
      'Finished, not invoiced is every job Jobber marks as needing an invoice, by the month it was finished. Drafts are all draft invoices, whatever the month.',
      'Lines marked To clear need doing before the month closes. Ticks are saved on this device only.'));
    return out;
  }
});
