// Tomorrow's Crew Sheet: one printable page per crew for tomorrow's visits.
FZ.board('crew-sheet', {
  source: 'Visits, addresses and line items: Jobber, live.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const { h } = ui;
    const NOT_MATERIAL = /labor|labour|haul|travel|trip|fee|assessment|consult|discount/i;
    const client = (t) => fmt.clean(String(t || '').split(' - ')[0]);
    const what = (t) => fmt.clean(String(t || '').split(' - ').slice(1).join(', '));
    const timeOf = (v) => v.allDay ? 'All day' : fmt.fmtTime(v.startAt);

    // Tomorrow in Mountain time. Ask Jobber for a wide window, then keep only tomorrow's date.
    const tomorrow = fmt.dayKey(fmt.isoDaysAhead(1));
    const base = Date.parse(tomorrow + 'T00:00:00Z');
    const iso = (t) => new Date(t).toISOString().replace(/\.\d+Z$/, 'Z');
    const all = await ctx.jobberAll('search_visits', { startAt: { after: iso(base), before: iso(base + 36 * 3600000) }, sort: 'startAt', limit: 50 }, 'visits', 100);
    const visits = all.filter((v) => v.startAt && fmt.dayKey(v.startAt) === tomorrow)
      .sort((a, b) => (a.allDay === b.allDay ? 0 : a.allDay ? -1 : 1) || String(a.startAt).localeCompare(String(b.startAt)));
    const dayLabel = fmt.fmtDay(tomorrow + 'T18:00:00Z');

    // Job details for address and line items, capped.
    const jobIds = [...new Set(visits.map((v) => v.job && v.job.id).filter(Boolean))].slice(0, 25);
    const details = await ctx.pool(jobIds, 4, (id) => ctx.jobber('get_job', { id }));
    const jobs = {};
    jobIds.forEach((id, i) => { if (details[i] && details[i].job) jobs[id] = details[i].job; });
    const addrOf = (v) => {
      const a = v.job && jobs[v.job.id] && jobs[v.job.id].property && jobs[v.job.id].property.address;
      if (!a || !a.street1) return null;
      return [fmt.clean(a.street1), fmt.clean(a.street2), fmt.clean(a.city)].filter(Boolean).join(', ');
    };
    const materials = (v) => {
      const j = v.job && jobs[v.job.id];
      const items = (j && j.lineItems && j.lineItems.nodes) || [];
      return items.filter((li) => !NOT_MATERIAL.test(li.name || ''));
    };
    const crewName = (v) => (v.assignedUsers || []).map((u) => fmt.clean(u.name)).filter(Boolean).sort().join(' and ') || 'No crew yet';

    const crews = new Map();
    visits.forEach((v) => { const k = crewName(v); if (!crews.has(k)) crews.set(k, []); crews.get(k).push(v); });
    const named = [...crews.keys()].filter((k) => k !== 'No crew yet');

    ctx.metric('crew-sheet', visits.length
      ? { value: fmt.plural(visits.length, 'visit') + ' tomorrow', detail: fmt.plural(named.length, 'crew') + ' on ' + dayLabel }
      : { value: 'Nothing booked tomorrow', detail: dayLabel });

    const out = [];
    if (!visits.length) {
      out.push(ui.status(['Tomorrow: ', { b: '0' }, ' visits booked.']));
      out.push(ui.calm('Nothing is on the schedule for ' + dayLabel + '. Enjoy the quiet day.'));
      out.push(ui.how('Every visit in Jobber that starts tomorrow, Mountain time, is listed by crew.'));
      return out;
    }
    out.push(ui.status(['Tomorrow: ', { b: String(visits.length) }, ' ' + (visits.length === 1 ? 'visit' : 'visits') + ' across ', { b: String(named.length) }, ' ' + (named.length === 1 ? 'crew.' : 'crews.')]));

    // Things to sort out before the crews leave.
    const todo = [];
    visits.forEach((v) => {
      const link = v.job && v.job.jobberWebUri;
      if (!(v.assignedUsers || []).length) todo.push({ when: timeOf(v), who: client(v.title), why: 'No crew is assigned yet.', link, flag: true });
      else if (v.job && jobs[v.job.id] && !addrOf(v)) todo.push({ when: timeOf(v), who: client(v.title), why: 'The job has no address in Jobber.', link });
      else if (v.job && jobs[v.job.id] && !materials(v).length) todo.push({ when: timeOf(v), who: client(v.title), why: 'No glass or hardware is listed on the job.', link });
    });
    out.push(todo.length ? ui.cards(todo, { max: 4 }) : ui.calm('Every visit tomorrow has a crew, an address and its materials.'));

    // Printing: hide the rest of the app, one crew per page.
    out.push(h('style', null, '@media print{.fz-nav,.fz-foot,.topbar,.fz-noprint,.fz-cards,.fz-calm,.fz-details{display:none!important}.fz-crewsheet{break-after:page;border-color:#999!important}}'));

    const sheet = (name, list) => h('section', { class: 'fz-crewsheet', style: 'border:1px solid var(--edge);border-radius:12px;background:var(--card);padding:16px;display:flex;flex-direction:column;gap:12px' },
      h('div', { style: 'display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap;border-bottom:2px solid var(--fg);padding-bottom:8px' },
        h('h2', { class: 'fz-h2' }, name),
        h('span', { class: 'fz-sub' }, dayLabel + ' · ' + fmt.plural(list.length, 'visit'))),
      list.map((v, i) => {
        const addr = addrOf(v);
        const mats = materials(v);
        return h('div', { style: 'display:grid;grid-template-columns:2rem 1fr;gap:10px;padding-bottom:12px;' + (i < list.length - 1 ? 'border-bottom:1px solid var(--line)' : '') },
          h('span', { style: 'font-size:20px;font-weight:700;color:var(--muted)' }, String(i + 1)),
          h('div', { style: 'display:flex;flex-direction:column;gap:4px;min-width:0' },
            h('span', { style: 'font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--meta)' }, timeOf(v) + (v.endAt && !v.allDay ? ' to ' + fmt.fmtTime(v.endAt) : '')),
            h('span', { style: 'font-size:17px;font-weight:700;overflow-wrap:anywhere' }, client(v.title) + (what(v.title) ? ' · ' + what(v.title) : '')),
            h('span', { style: 'font-size:14px' }, addr ? ui.extLink('https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(addr), addr) : 'Address not in Jobber'),
            v.instructions ? h('span', { style: 'font-size:14px;background:var(--quiet);border-radius:8px;padding:6px 10px' }, h('b', null, 'On site: '), fmt.clean(v.instructions)) : null,
            mats.length ? h('ul', { style: 'margin:4px 0 0;padding-left:18px;font-size:14px;line-height:1.5' }, mats.map((li) => h('li', null,
              h('b', null, (Number(li.quantity) > 1 ? li.quantity + ' x ' : '') + fmt.clean(li.name)), li.description ? ', ' + fmt.clean(li.description) : ''))) : h('span', { class: 'fz-none' }, 'No glass or hardware listed'),
            v.job && v.job.jobberWebUri ? h('span', { class: 'fz-noprint', style: 'font-size:13px' }, ui.extLink(v.job.jobberWebUri, 'Open job in Jobber')) : null));
      }));
    const order = [...named.sort(), ...(crews.has('No crew yet') ? ['No crew yet'] : [])];
    out.push(h('div', { style: 'display:flex;flex-direction:column;gap:16px' }, order.map((k) => sheet(k, crews.get(k)))));

    out.push(ui.table([
      { label: 'Time', get: (v) => timeOf(v) },
      { label: 'Crew', get: (v) => crewName(v) },
      { label: 'Visit', get: (v) => fmt.clean(v.title) },
      { label: 'Address', get: (v) => addrOf(v) || '' },
      { label: 'Jobber', get: (v) => v.job && v.job.jobberWebUri ? ui.extLink(v.job.jobberWebUri, 'Open') : '' }
    ], visits, { summary: 'All ' + visits.length + ' visits tomorrow as a list' }));
    out.push(ui.how('Every visit in Jobber that starts tomorrow, Mountain time, grouped by the people assigned to it and in time order.',
      'The address comes from the job’s property. Gate codes and parking come from the visit instructions.',
      'Glass and hardware are the job’s line items. Labor, haul away and fees are left off.'));
    return out;
  }
});
