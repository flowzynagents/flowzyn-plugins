// Pay Bills: supplier bills due this week, checked and ready for the owner's OK. Never moves money.
FZ.board('pay-bills', {
  source: 'Bills: QuickBooks, refreshed each weekday morning.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const { h } = ui;
    const DAY = 86400000;
    const WEEK = 7;
    const data = await ctx.store('datasets/bills');

    if (!data || !Array.isArray(data.open)) {
      ctx.metric('pay-bills', { value: 'Needs QuickBooks', detail: 'Connect it to see bills due' });
      return [ui.setup({
        title: 'Connect QuickBooks to see your bills',
        text: 'Pay Bills reads the supplier bills in QuickBooks, checks each one, and lines up what is due this week for your OK. It never pays anything on its own.',
        steps: ['Open Claude, then Settings, then Connectors.', 'Find QuickBooks and press Connect.', 'Sign in and pick the ' + FZ.biz() + ' company.']
      })];
    }

    const db = window.claude && window.claude.use ? await window.claude.use('db') : null;
    const ok = new Map();
    if (db) {
      try { const snap = await db.collection('bills').get(); (snap.docs || []).forEach((d) => ok.set(d.id, d.data())); } catch (e) { /* none approved yet */ }
    }
    const rerender = () => setTimeout(() => window.dispatchEvent(new HashChangeEvent('hashchange')), 400);
    const approve = async (b, msgEl) => {
      if (!db) { msgEl.textContent = 'Open this page in Claude to mark bills paid.'; return false; }
      try { await db.doc('bills/' + b.id).set({ paid: true, at: new Date().toISOString(), vendor: b.vendor, amount: b.amount, dueDate: b.dueDate || null }); return true; }
      catch (e) { msgEl.textContent = 'Could not save. Try again in a moment.'; return false; }
    };

    const now = Date.now();
    const nth = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th'));
    const vendors = (data.vendors || []).map((v) => Object.assign({}, v, { name: fmt.clean(v.name) }));
    const vByName = new Map(vendors.map((v) => [v.name.toLowerCase(), v]));
    const bills = data.open.map((b) => {
      const due = b.dueDate ? Date.parse(b.dueDate) : now;
      const inDays = Math.ceil((due - now) / DAY);
      return Object.assign({}, b, { vendor: fmt.clean(b.vendor), amount: Number(b.amount) || 0, inDays, late: inDays < 0, approved: !!((ok.get(b.id) || {}).paid || (ok.get(b.id) || {}).approved) });
    }).filter((b) => b.amount > 0);

    // Bills open for months were usually paid outside QuickBooks. They go to a check list, not the daily reminder.
    const STALE = 60;
    const stale = bills.filter((b) => b.inDays < -STALE && !b.approved);
    const soon = bills.filter((b) => b.inDays <= WEEK && b.inDays >= -STALE).sort((a, b) => a.inDays - b.inDays || b.amount - a.amount);
    const soonSum = soon.reduce((s, b) => s + b.amount, 0);
    const late = soon.filter((b) => b.late);
    const waiting = soon.filter((b) => !b.approved);
    const flagged = bills.filter((b) => b.flag && b.inDays >= -60);

    ctx.metric('pay-bills', soon.length
      ? { value: fmt.money(soonSum, { short: true }) + ' in bills due this week', detail: waiting.length ? fmt.plural(waiting.length, 'bill') + ' still to pay' : 'All paid' }
      : { value: 'No bills due this week', detail: fmt.plural(bills.length, 'open bill') + ' in QuickBooks' });

    const out = [];
    out.push(ui.status(soon.length
      ? [{ b: fmt.money(soonSum, { short: true }) }, ' in supplier bills due this week' + (late.length ? ', ' + fmt.plural(late.length, 'already late', 'already late') : '') + '. ' + (waiting.length ? fmt.plural(waiting.length, 'bill') + ' still to pay.' : 'All paid.')]
      : ['No supplier bills due this week.']));

    // Action cards: due this week, late first. Approve records the OK. Paying happens in QuickBooks.
    if (soon.length) {
      const list = h('div', { class: 'fz-cards' });
      soon.slice(0, 6).forEach((b) => {
        const v = vByName.get(b.vendor.toLowerCase());
        const why = b.flag ? b.flagNote : (v && v.avg ? 'Usually ' + fmt.money(v.avg) + (v.day ? ', paid around the ' + nth(v.day) : '') + '.' : 'Checked against past bills. Nothing unusual.');
        const msg = h('p', { class: 'fz-hint', role: 'status' });
        const btns = h('div', { class: 'fz-card-btns' });
        if (b.approved) btns.append(ui.pill('Paid', 'live'));
        else {
          if (b.link) btns.append(ui.extLink(b.link, 'Pay in QuickBooks', 'fz-btn act'));
          const btn = h('button', { type: 'button', class: b.link ? 'fz-cardlink fz-linkbtn' : 'fz-btn act' }, 'I paid it');
          btn.addEventListener('click', async () => { btn.disabled = true; if (await approve(b, msg)) { msg.textContent = 'Marked paid. The reminder stops for this bill.'; rerender(); } else btn.disabled = false; });
          btns.append(btn);
        }
        list.append(h('article', { class: 'fz-card' + (b.flag || b.late ? ' flag' : '') },
          h('div', { class: 'fz-card-top' }, h('span', { class: 'when' }, b.late ? fmt.plural(-b.inDays, 'day') + ' late' : (b.inDays === 0 ? 'Due today' : 'Due ' + fmt.fmtDay(b.dueDate))), h('span', { class: 'amt' }, fmt.money(b.amount))),
          h('span', { class: 'who' }, b.vendor + (b.number ? ' · bill ' + b.number : '')),
          h('span', { class: 'why' }, why), btns, msg));
      });
      const wrap = h('div', null, list);
      if (soon.length > 6) wrap.append(h('p', { class: 'fz-more' }, (soon.length - 6) + ' more in the full list below.'));
      out.push(ui.section('Due this week', 'Tap Pay in QuickBooks, hit pay there, then mark it paid here. Nothing is paid for you.', wrap));
    } else {
      out.push(ui.calm('Nothing due in the next ' + WEEK + ' days. Next bill: ' + (bills.length ? bills.slice().sort((a, b) => a.inDays - b.inDays)[0].vendor + ', ' + fmt.fmtDay(bills.slice().sort((a, b) => a.inDays - b.inDays)[0].dueDate) : 'none open') + '.'));
    }

    if (stale.length) {
      const sum = stale.reduce((t, b) => t + b.amount, 0);
      out.push(ui.section(fmt.money(sum) + ' shows unpaid from months ago', 'These have been open in QuickBooks for over ' + STALE + ' days. Usually that means they were paid another way and never marked paid. Worth a check with your bookkeeper.',
        ui.table([
          { label: 'Due', get: (x) => fmt.fmtDay(x.dueDate) },
          { label: 'Supplier', get: (x) => x.vendor },
          { label: 'Note', get: (x) => x.flagNote || '' },
          { label: 'Amount', num: true, get: (x) => fmt.money(x.amount) }
        ], stale.slice().sort((a, b) => a.inDays - b.inDays), { summary: fmt.plural(stale.length, 'bill') + ' to check' })));
    }

    if (flagged.filter((b) => b.inDays > WEEK).length) {
      out.push(ui.section('Worth a look before they are due', null, ui.cards(flagged.filter((b) => b.inDays > WEEK).map((b) => ({ when: 'Due ' + fmt.fmtDay(b.dueDate), who: b.vendor, amount: b.amount, why: b.flagNote, link: b.link, linkLabel: 'Open in QuickBooks', flag: true })), { max: 3 })));
    }

    // Glance: when bills land in a typical month, from the last 12 months.
    if (vendors.length) {
      const today = new Date().getDate();
      const weeks = [[1, 7], [8, 14], [15, 21], [22, 31]].map(([a, z]) => {
        const vs = vendors.filter((v) => v.day >= a && v.day <= z && v.cadence === 'monthly');
        const sum = vs.reduce((s, v) => s + (Number(v.avg) || 0), 0);
        return { label: 'Days ' + a + ' to ' + z, value: sum, hi: today >= a && today <= z, display: fmt.money(sum, { short: true }) + ' · ' + vs.length };
      });
      const top = weeks.slice().sort((a, b) => b.value - a.value)[0];
      out.push(ui.section(top && top.value ? 'Most of your monthly bills land in ' + top.label.toLowerCase() : 'When your bills land each month', 'Usual monthly supplier bills by week of the month, then how many suppliers', ui.bars(weeks)));
    }

    const upcoming = bills.filter((b) => b.inDays > WEEK && b.inDays <= 30).map((b) => ({ when: b.dueDate, vendor: b.vendor, amount: b.amount, kind: 'In QuickBooks', link: b.link }))
      .concat((data.expected || []).map((e) => ({ when: e.date, vendor: fmt.clean(e.vendor), amount: Number(e.amount) || 0, kind: 'Expected, not in yet' })))
      .sort((a, b) => Date.parse(a.when) - Date.parse(b.when));
    if (upcoming.length) {
      out.push(ui.table([
        { label: 'Due', get: (x) => fmt.fmtDay(x.when) },
        { label: 'Supplier', get: (x) => x.vendor },
        { label: 'Status', get: (x) => x.kind },
        { label: 'Amount', num: true, get: (x) => fmt.money(x.amount) },
        { label: 'QuickBooks', get: (x) => x.link ? ui.extLink(x.link, 'Open') : '' }
      ], upcoming, { summary: 'Next 30 days: ' + upcoming.length + ' bills, ' + fmt.money(upcoming.reduce((s, x) => s + x.amount, 0), { short: true }) }));
    }
    if (vendors.length) {
      out.push(ui.table([
        { label: 'Supplier', get: (x) => x.name },
        { label: 'How often', get: (x) => x.cadence === 'monthly' ? 'Monthly' : x.cadence === 'quarterly' ? 'Quarterly' : 'Now and then' },
        { label: 'Usual day', get: (x) => x.day ? 'The ' + nth(x.day) : '' },
        { label: 'Usual amount', num: true, get: (x) => fmt.money(x.avg) },
        { label: 'Bills, 12 months', num: true, get: (x) => String(x.count12 || 0) }
      ], vendors.slice().sort((a, b) => (b.avg || 0) * (b.count12 || 0) - (a.avg || 0) * (a.count12 || 0)), { summary: 'Your ' + vendors.length + ' suppliers and when you pay them' }));
    }

    out.push(ui.how(
      'Reads every unpaid bill in QuickBooks and the bills paid over the last 12 months, each weekday morning.',
      'Due this week means due in the next ' + WEEK + ' days, or already past its due date.',
      'A bill is flagged when it is more than 15% above that supplier’s usual amount, or when the same supplier billed the same amount in the last 30 days.',
      'Expected means a supplier who bills you every month has not sent this month’s bill yet.',
      'You get a reminder 2 days before each bill is due and again on the day, until it is paid. Money only moves when you hit pay in QuickBooks.'));
    return out;
  }
});
