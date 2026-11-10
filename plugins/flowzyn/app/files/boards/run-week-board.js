// Week Board: this week Monday to Saturday by crew, with late visits, open half days, and money waiting per customer.
FZ.board('week-board', {
  source: 'Visits, quotes and invoices: Jobber, live.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    // Core's overflow line pluralises "more" as "mores", so count the rest here.
    const rankedCards = (items, max) => { const w = ui.cards(items.slice(0, max), { max }); if (items.length > max) w.append(ui.h('p', { class: 'fz-more' }, (items.length - max) + ' more in the full list below.')); return w; };
    const { h } = ui;
    const MAX_JOBS = 25;
    const NOON = 12, DAY_END = 17;

    // The week in shop time: Monday to Saturday.
    const todayKey = fmt.dayKey(new Date().toISOString());
    const noonUtc = (key) => new Date(key + 'T12:00:00Z');
    const addDays = (key, n) => new Date(noonUtc(key).getTime() + n * 86400000).toISOString().slice(0, 10);
    const monday = addDays(todayKey, -((noonUtc(todayKey).getUTCDay() + 6) % 7));
    const week = Array.from({ length: 6 }, (_, i) => addDays(monday, i));
    const dayName = (key, long) => noonUtc(key).toLocaleDateString('en-US', { weekday: long ? 'long' : 'short', timeZone: 'UTC' });
    const dayDate = (key) => noonUtc(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const hourOf = (iso) => { const p = new Intl.DateTimeFormat('en-US', { timeZone: fmt.TZ, hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date(iso)); const g = (t) => Number((p.find((x) => x.type === t) || {}).value || 0); return g('hour') + g('minute') / 60; };
    // Shop clock time for a day key and hour, as a real instant.
    const offsetH = (key) => { const n = new Intl.DateTimeFormat('en-US', { timeZone: fmt.TZ, timeZoneName: 'shortOffset' }).formatToParts(noonUtc(key)).find((x) => x.type === 'timeZoneName'); const m = /GMT([+-]\d+)/.exec(n ? n.value : ''); return m ? Number(m[1]) : -7; };
    const at = (key, hr) => new Date(noonUtc(key).getTime() + (hr - 12 - offsetH(key)) * 3600000);

    const unpaidStatuses = ['past_due', 'awaiting_payment', 'sent_not_due'];
    const [weekVisits, lateVisits, quotes, ...unpaidLists] = await Promise.all([
      ctx.jobberAll('search_visits', { startAt: { after: at(week[0], 0).toISOString().replace(/\.\d+Z$/, 'Z'), before: at(addDays(week[5], 1), 0).toISOString().replace(/\.\d+Z$/, 'Z') }, sort: 'startAt', limit: 50 }, 'visits', 300),
      ctx.jobberAll('search_visits', { status: 'late', sort: 'startAt', limit: 50 }, 'visits', 100),
      ctx.jobberAll('search_quotes', { status: 'awaiting_response', limit: 100 }, 'quotes', 200),
      ...unpaidStatuses.map((status) => ctx.jobberAll('search_invoices', { status, limit: 50 }, 'invoices', 200))
    ]);
    const lateIds = new Set(lateVisits.map((v) => v.id));
    const visits = weekVisits.filter((v) => week.includes(fmt.dayKey(v.startAt)));
    visits.forEach((v) => { if (v.status === 'late') lateIds.add(v.id); });
    const isLate = (v) => lateIds.has(v.id);

    // Customer of each visit: from the job (capped), else the name in the visit title.
    const clientName = (t) => fmt.clean(String(t || '').split(' - ')[0]);
    const what = (t) => fmt.clean(String(t || '').split(' - ').slice(1).join(', '));
    const jobIds = [...new Set([...lateVisits, ...visits].map((v) => v.job && v.job.id).filter(Boolean))].slice(0, MAX_JOBS);
    const jobClient = {};
    await ctx.pool(jobIds, 4, async (id) => { const d = await ctx.jobber('get_job', { id }); const c = d && d.job && d.job.client; if (c) jobClient[id] = { id: c.id, name: fmt.clean(c.name) }; });
    const clientOf = (v) => (v.job && jobClient[v.job.id]) || { id: null, name: clientName(v.title) };

    const quoteBy = {}, oweBy = {};
    const add = (map, c, n) => { [c.id, 'n:' + fmt.clean(c.name).toLowerCase()].forEach((k) => { const e = map[k] = map[k] || { total: 0, count: 0 }; e.total += n; e.count++; }); };
    quotes.forEach((q) => q.client && add(quoteBy, q.client, Number(q.total) || 0));
    const seenInv = new Set();
    unpaidLists.flat().forEach((v) => { if (v.client && !seenInv.has(v.id) && Number(v.balance) > 0) { seenInv.add(v.id); add(oweBy, v.client, Number(v.balance)); } });
    const look = (map, c) => (c.id && map[c.id]) || map['n:' + c.name.toLowerCase()] || null;
    const moneyOf = (v) => { const c = clientOf(v); return { quote: look(quoteBy, c), owe: look(oweBy, c) }; };

    // Crews and half days.
    const crewOf = (v) => (v.assignedUsers || []).map((u) => fmt.clean(u.name)).filter(Boolean).sort().join(' and ') || 'No crew yet';
    const covers = (v, half) => {
      if (v.allDay) return true;
      const s = hourOf(v.startAt), e = v.endAt ? hourOf(v.endAt) : s + 1;
      return half === 'am' ? s < NOON : (s >= NOON || e > NOON);
    };
    const crews = [...new Set(visits.map(crewOf))].sort((a, b) => (a === 'No crew yet') - (b === 'No crew yet') || a.localeCompare(b));
    const now = Date.now();
    const halfEnd = (key, half) => at(key, half === 'am' ? NOON : DAY_END).getTime();
    const open = [];
    crews.filter((c) => c !== 'No crew yet').forEach((crew) => week.forEach((key) => ['am', 'pm'].forEach((half) => {
      if (halfEnd(key, half) <= now) return;
      if (!visits.some((v) => crewOf(v) === crew && fmt.dayKey(v.startAt) === key && covers(v, half))) open.push({ crew, key, half });
    })));
    const halfWord = (half) => half === 'am' ? 'morning' : 'afternoon';
    const realCrews = crews.filter((c) => c !== 'No crew yet');

    // Status line.
    let openLine = '';
    if (open.length) {
      const first = open.slice().sort((a, b) => halfEnd(a.key, a.half) - halfEnd(b.key, b.half))[0];
      const who = open.filter((o) => o.key === first.key && o.half === first.half).map((o) => o.crew);
      const when = first.key === todayKey ? 'This ' + halfWord(first.half) : dayName(first.key, true) + ' ' + halfWord(first.half);
      openLine = ' ' + when + ' is open' + (realCrews.length > 1 && who.length < realCrews.length ? ' for ' + who.join(' and ') : '') + '.';
    }
    const lateCount = lateIds.size;
    ctx.metric('week-board', lateCount
      ? { value: fmt.plural(lateCount, 'late visit'), detail: fmt.plural(visits.length, 'visit') + ' this week' }
      : { value: 'No late visits', detail: fmt.plural(visits.length, 'visit') + ' this week' });

    const out = [];
    out.push(ui.status([{ b: String(visits.length) }, ' ' + (visits.length === 1 ? 'visit' : 'visits') + ' this week. ', lateCount ? { b: String(lateCount) } : 'None', ' late.', openLine]));

    // Cards: late visits first, then customers the crew will see who have money waiting.
    const allLate = [...new Map([...lateVisits, ...visits.filter(isLate)].map((v) => [v.id, v])).values()].sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
    const timeOf = (v) => v.allDay ? 'All day' : fmt.fmtTime(v.startAt);
    const cards = allLate.map((v) => ({
      when: 'Late · was ' + fmt.fmtDay(v.startAt) + ' ' + timeOf(v),
      who: clientOf(v).name,
      why: (what(v.title) || 'Visit') + ' with ' + crewOf(v) + '. Not marked done. Close it out or rebook it.',
      flag: true,
      link: v.job && v.job.jobberWebUri
    }));
    visits.filter((v) => !isLate(v) && new Date(v.startAt).getTime() >= now).forEach((v) => {
      const m = moneyOf(v);
      if (!m.owe && !m.quote) return;
      const bits = [];
      if (m.owe) bits.push(fmt.money(m.owe.total) + ' unpaid on their account');
      if (m.quote) bits.push(fmt.plural(m.quote.count, 'quote') + ' for ' + fmt.money(m.quote.total, { short: true }) + ' waiting on a yes');
      cards.push({ when: 'Crew there ' + fmt.fmtDay(v.startAt) + ' ' + timeOf(v), who: clientOf(v).name, why: bits.join(' and ') + '. Worth a word on site.', amount: (m.owe ? m.owe.total : 0) || (m.quote ? m.quote.total : 0), link: v.job && v.job.jobberWebUri, _id: clientOf(v).name });
    });
    const seenWho = new Set();
    const shown = cards.filter((c) => c.flag || (!seenWho.has(c._id) && seenWho.add(c._id)));
    if (shown.length) out.push(rankedCards(shown, 5));
    else out.push(ui.calm('No late visits and nothing waiting on the customers you see this week.'));

    // Week grid, one row of days per crew.
    out.push(h('style', null, '.fz-week.wb6{grid-template-columns:repeat(6,minmax(0,1fr))}@media (max-width:760px){.fz-week.wb6{grid-template-columns:1fr}}' +
      '.wb-crew{margin:14px 0 6px;font-size:14px;font-weight:700}.wb-crew span{font-weight:400;color:var(--muted)}' +
      '.fz-chip.wb-late{box-shadow:inset 0 3px 0 #dc2626}.wb-m{display:block;font-size:12px;font-weight:400;color:var(--muted);margin-top:2px}' +
      '.wb-open{display:block;font-size:12px;color:var(--muted);border:1px dashed var(--line);border-radius:6px;padding:4px 8px}.fz-day.wb-today .dn{color:var(--fg)}'));
    const chip = (v) => {
      const m = moneyOf(v);
      const extra = [m.quote ? 'Quote ' + fmt.money(m.quote.total, { short: true }) + ' waiting' : '', m.owe ? 'Owes ' + fmt.money(m.owe.total, { short: true }) : ''].filter(Boolean).join(' · ');
      const href = v.job && v.job.jobberWebUri;
      return h(href ? 'a' : 'span', { class: 'fz-chip' + (isLate(v) ? ' wb-late' : ''), href, target: href ? '_blank' : null, rel: href ? 'noopener' : null },
        h('span', { class: 't' }, timeOf(v) + (isLate(v) ? ' · Late' : '')), clientOf(v).name, extra ? h('span', { class: 'wb-m' }, extra) : null);
    };
    const grid = crews.map((crew) => {
      const mine = visits.filter((v) => crewOf(v) === crew);
      return h('div', null,
        h('p', { class: 'wb-crew' }, crew + ' ', h('span', null, fmt.plural(mine.length, 'visit'))),
        h('div', { class: 'fz-week wb6' }, week.map((key) => {
          const day = mine.filter((v) => fmt.dayKey(v.startAt) === key).sort((a, b) => new Date(a.startAt) - new Date(b.startAt));
          const opens = open.filter((o) => o.crew === crew && o.key === key);
          const amOpen = opens.some((o) => o.half === 'am'), pmOpen = opens.some((o) => o.half === 'pm');
          const am = day.filter((v) => v.allDay || hourOf(v.startAt) < NOON);
          const pm = day.filter((v) => !am.includes(v));
          return h('div', { class: 'fz-day' + (key === todayKey ? ' wb-today' : '') },
            h('span', { class: 'dn' }, dayName(key) + ' ', h('span', null, key === todayKey ? 'Today' : dayDate(key))),
            h('div', { class: 'jobs' },
              am.map(chip), amOpen ? h('span', { class: 'wb-open' }, 'Morning open') : null,
              pm.map(chip), pmOpen ? h('span', { class: 'wb-open' }, 'Afternoon open') : null,
              !day.length && !amOpen && !pmOpen ? h('span', { class: 'fz-none' }, 'No visits') : null));
        })));
    });
    out.push(ui.section('Your week by crew', 'Monday to Saturday. Dashed boxes are open half days still ahead.', ...grid));

    out.push(ui.table([
      { label: 'Day', get: (v) => fmt.fmtDay(v.startAt) },
      { label: 'Time', get: (v) => timeOf(v) },
      { label: 'Customer', get: (v) => clientOf(v).name },
      { label: 'Work', get: (v) => what(v.title) },
      { label: 'Crew', get: (v) => crewOf(v) },
      { label: 'Visit', get: (v) => isLate(v) ? ui.pill('Late', 'hot') : ui.pill(v.isComplete ? 'Done' : 'Booked') },
      { label: 'Quotes waiting', num: true, get: (v) => { const m = moneyOf(v); return m.quote ? fmt.money(m.quote.total) : ''; } },
      { label: 'Unpaid', num: true, get: (v) => { const m = moneyOf(v); return m.owe ? fmt.money(m.owe.total) : ''; } },
      { label: 'Jobber', get: (v) => v.job ? ui.extLink(v.job.jobberWebUri, 'Open') : '' }
    ], visits.slice().sort((a, b) => new Date(a.startAt) - new Date(b.startAt)), { summary: 'All ' + visits.length + ' visits this week as a list' }));

    out.push(ui.how('Shows every Jobber visit from Monday to Saturday this week, grouped by the people assigned.',
      'Late means Jobber has the visit as late: its time passed and it is not marked done. Late visits from earlier weeks show in the cards too.',
      'A half day is open when a crew has nothing booked before noon, or from noon to 5pm, and that time is still ahead.',
      'Quotes waiting are quotes sent and not answered yet. Unpaid is the balance on invoices past due, awaiting payment, or sent and not due.'));
    return out;
  }
});
