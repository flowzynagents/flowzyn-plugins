// Weather Watch: this week's booked jobs against the shop's local forecast.
FZ.board('weather-watch', {
  source: 'Jobs: Jobber, live. Forecast: National Weather Service, refreshed daily at 5:47am.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const { h } = ui;
    const LIMITS = { wind: 25, cold: 20 };
    const [visits, fc] = await Promise.all([
      ctx.jobberAll('search_visits', { status: 'upcoming', sort: 'startAt', limit: 50 }, 'visits', 100),
      ctx.store('datasets/forecast')
    ]);
    const periods = (fc && fc.periods) || [];
    const HOME = (fc && fc.home) || (periods[0] && periods[0].area) || '';
    const days = periods.filter((p) => p.area === HOME && String(p.daytime) === 'true').slice(0, 7);
    const dayOf = (date) => days.find((p) => p.date === date);
    const riskOf = (p) => !p ? null : String(p.snow) === 'true' ? 'Snow' : Number(p.wind_mph) >= LIMITS.wind ? 'High wind' : Number(p.temp_f) < LIMITS.cold ? 'Deep cold' : null;
    const client = (t) => fmt.clean(String(t).split(' - ')[0]);
    const timeOf = (v) => v.allDay ? 'All day' : fmt.fmtTime(v.startAt);
    const rows = visits.map((v) => { const date = fmt.dayKey(v.startAt); const p = dayOf(date); return { v, date, p, risk: riskOf(p) }; });
    const flagged = rows.filter((r) => r.risk);
    const why = { Snow: 'Snow is forecast. Worth a quick call to the customer.', 'High wind': 'High wind is forecast. Big panes are hard to carry and set.', 'Deep cold': 'Deep cold is forecast. Sealant may need a warmer day.' };

    ctx.metric('weather-watch', flagged.length
      ? { value: fmt.plural(flagged.length, 'job') + ' to check this week', detail: flagged[0].risk + ' forecast ' + fmt.fmtDay(flagged[0].v.startAt) + ' for ' + client(flagged[0].v.title) }
      : { value: 'All jobs look good this week', detail: days.length ? 'Forecast is workable every day' : '' });

    const out = [];
    if (!days.length) {
      out.push(ui.status([{ b: String(rows.length) }, ' booked jobs coming up.']));
      out.push(ui.note('The forecast has not loaded yet. It refreshes every morning at 5:47am.'));
    } else {
      out.push(ui.status(flagged.length
        ? [{ b: String(flagged.length) }, ' of ', { b: String(rows.length) }, ' jobs this week may need a check.']
        : ['All ', { b: String(rows.length) }, ' booked jobs have workable weather.']));
    }
    if (flagged.length) {
      out.push(ui.cards(flagged.map((r) => ({
        when: fmt.fmtDay(r.v.startAt) + ' · ' + timeOf(r.v) + ' · ' + r.risk, who: client(r.v.title), why: why[r.risk], flag: true,
        link: r.v.job && r.v.job.jobberWebUri,
        draft: 'Hi ' + fmt.firstName(client(r.v.title)) + ', it is ' + FZ.me().first + ' at ' + FZ.biz() + '. The forecast for ' + fmt.fmtDay(r.v.startAt) + ' shows ' + r.risk.toLowerCase() + '. We can keep your install as planned or move it to a better day. What works for you?',
        draftLabel: 'Draft a heads up'
      }))));
    }

    if (days.length) {
      const icon = (p) => {
        const ns = 'http://www.w3.org/2000/svg';
        const svg = document.createElementNS(ns, 'svg');
        svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('aria-hidden', 'true');
        const kind = String(p.snow) === 'true' ? 'snow' : Number(p.wind_mph) >= LIMITS.wind ? 'wind' : /sun|clear/i.test(p.forecast) ? 'sun' : 'cloud';
        ({ sun: ['M12 4V2', 'M12 22v-2', 'M4 12H2', 'M22 12h-2', 'M16 12a4 4 0 1 1-8 0a4 4 0 0 1 8 0'], cloud: ['M17.5 19H8a5 5 0 1 1 1.6-9.7A6 6 0 0 1 21 12.5 3.5 3.5 0 0 1 17.5 19z'], snow: ['M12 2v20', 'M4.9 7l14.2 10', 'M4.9 17L19.1 7'], wind: ['M3 8h11a3 3 0 1 0-3-3', 'M3 12h16a3 3 0 1 1-3 3', 'M3 16h8'] })[kind]
          .forEach((d) => { const pa = document.createElementNS(ns, 'path'); pa.setAttribute('d', d); svg.append(pa); });
        return svg;
      };
      out.push(ui.section('Your next 7 days', null, h('div', { class: 'fz-week' }, days.map((p) => {
        const risk = riskOf(p);
        const jobs = rows.filter((r) => r.date === p.date);
        const d = new Date(p.date + 'T12:00:00Z');
        return h('div', { class: 'fz-day' + (risk ? ' flag' : '') },
          h('span', { class: 'dn' }, d.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }) + ' ', h('span', null, d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }))),
          h('span', { class: 'wx', title: p.forecast + ', wind to ' + p.wind_mph + ' mph' }, icon(p), p.temp_f + '°'),
          risk ? h('span', { class: 'flagtxt' }, risk) : null,
          h('div', { class: 'jobs' }, jobs.length ? jobs.map((r) => h(r.v.job ? 'a' : 'span', { class: 'fz-chip', href: r.v.job ? r.v.job.jobberWebUri : null, target: r.v.job ? '_blank' : null, rel: r.v.job ? 'noopener' : null }, h('span', { class: 't' }, timeOf(r.v)), client(r.v.title))) : h('span', { class: 'fz-none' }, 'No jobs')));
      }))));
    }

    out.push(ui.table([
      { label: 'Day', get: (r) => fmt.fmtDay(r.v.startAt) },
      { label: 'Job', get: (r) => fmt.clean(r.v.title) },
      { label: 'Crew', get: (r) => (r.v.assignedUsers || []).map((u) => fmt.clean(u.name)).join(', ') || 'No crew yet' },
      { label: 'Forecast', get: (r) => r.p ? r.p.forecast : 'Not forecast yet' },
      { label: 'High °F', num: true, get: (r) => r.p ? String(r.p.temp_f) : '' },
      { label: 'Weather', get: (r) => r.risk ? ui.pill(r.risk, 'hot') : ui.pill(r.p ? 'Workable' : 'No forecast') },
      { label: 'Jobber', get: (r) => r.v.job ? ui.extLink(r.v.job.jobberWebUri, 'Open') : '' }
    ], rows, { summary: 'All ' + rows.length + ' booked jobs as a list' }));
    out.push(ui.how('Every upcoming job in Jobber is matched to the National Weather Service daytime forecast for ' + FZ.town() + ' on its day.',
      'A job is flagged for snow, wind of ' + LIMITS.wind + ' mph or more, or a high under ' + LIMITS.cold + '°F.'));
    return out;
  }
});
