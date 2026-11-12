// Partner Finder: designers, showrooms and rental managers who could send work, found on their own websites, with an intro email ready.
FZ.board('partner-finder', {
  source: 'Current partners: Jobber, live. New partners: their own websites, refreshed monthly by Flowzyn.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const { h } = ui;
    const isCo = (c) => !!(c && (fmt.clean(c.companyName) || c.isCompany));
    const coName = (c) => fmt.clean(c.companyName) || fmt.clean(c.name);
    const [clients, jobs] = await Promise.all([
      ctx.jobberAll('search_clients', { limit: 100 }, 'clients', 300),
      ctx.jobberAll('search_jobs', { createdAt: { after: fmt.isoDaysAgo(365) }, limit: 50 }, 'jobs', 200)
    ]);
    const byId = new Map(clients.map((c) => [c.id, c]));
    const groups = new Map();
    const byMonth = new Map();
    jobs.filter((j) => fmt.daysSince(j.createdAt) <= 365).forEach((j) => {
      const c = j.client && byId.get(j.client.id);
      if (!isCo(c)) return;
      const k = coName(c).toLowerCase();
      const g = groups.get(k) || { name: coName(c), link: c.jobberWebUri, jobs: 0, dollars: 0, last: null };
      g.jobs++; g.dollars += Number(j.total) || 0;
      if (!g.last || j.createdAt > g.last) g.last = j.createdAt;
      groups.set(k, g);
      const mk = fmt.dayKey(j.createdAt).slice(0, 7);
      byMonth.set(mk, (byMonth.get(mk) || 0) + (Number(j.total) || 0));
    });
    const partners = [...groups.values()].sort((a, b) => b.dollars - a.dollars);
    const total = partners.reduce((s, p) => s + p.dollars, 0);

    ctx.metric('partner-finder', partners.length
      ? { value: fmt.plural(partners.length, 'partner') + ' sending work', detail: fmt.money(total, { short: true }) + ' in jobs, last 12 months' }
      : { value: 'Building your partner list', detail: 'First intros show here' });

    // New partners: researched monthly from their own websites. Only ones with a published email get an intro.
    const doc = await ctx.store('datasets/partners').catch(() => null);
    const known = new Set(clients.map((c) => coName(c).toLowerCase()));
    const found = Object.entries((doc && doc.partners) || {}).map(([id, p]) => Object.assign({ id }, p)).filter((p) => !known.has(String(p.name).toLowerCase()));
    const TYPE = { designer: 'Interior designer', showroom: 'Showroom', rental: 'Rental and property manager' };
    // The run names each kind of partner in plain words (typeLabel). Older data only has the type.
    const kindOf = (p) => (p && (p.typeLabel || TYPE[p.type])) || '';
    const withEmail = found.filter((p) => p.email);
    const firstName = (p) => p.person ? String(p.person).split(' ')[0] : null;
    const ASK = {
      designer: 'If you have clients who need ' + FZ.w.services + ', I would be glad to be the shop you send them to. We quote within the week and work to your design.',
      showroom: 'When your customers need ' + FZ.w.services + ' to finish a project, I would be glad to be the shop you point them to.',
      rental: 'When a unit needs something fixed between guests or tenants, we can usually get there fast and work around your bookings.',
      other: 'If your customers ever need ' + FZ.w.services + ', I would be glad to be the shop you send them to. We quote within the week.'
    };
    const draft = (p) => FZ.tpl.body('partner-intro', { greeting: (firstName(p) ? 'Hi ' + firstName(p) + ',' : 'Hello ' + p.name + ' team,') }, ASK[p.type] ? p.type : 'other', draft0(p));
    const draft0 = (p) => (firstName(p) ? 'Hi ' + firstName(p) + ',' : 'Hello ' + p.name + ' team,') + '\n\n' +
      'I am ' + FZ.me().first + ', owner of ' + FZ.biz() + ' in ' + FZ.town() + '. ' + FZ.w.weDo + ' around ' + FZ.region() + '.\n\n' +
      (ASK[p.type] || ASK.other) + '\n\nWould a quick coffee or call next week work?\n\n' + FZ.sign();
    const order = { designer: 0, showroom: 1, rental: 2 };
    withEmail.sort((a, b) => (order[a.type] - order[b.type]) || String(a.name).localeCompare(String(b.name)));

    const K = FZ.kit;
    const out = [];
    const T = (FZ.tasksNow && FZ.tasksNow().done) || {};
    const qidOf = (k) => 'send-' + String(k || '').replace(/[^A-Za-z0-9]+/g, '-').slice(-80);
    const sentOf = (p) => { const t = T[qidOf(p.website || p.name)] || {}; return t.handled || t.outbox; };
    // Jump to the intro in the work tab.
    const goWork = (name) => { const b = document.querySelector('.fz-subtabs button[data-id="work"]'); if (b) b.click(); setTimeout(() => { const c = [...document.querySelectorAll('.fz-card')].find((x) => (x.querySelector('.who') || {}).textContent === name); if (c) c.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); };

    // Example (shown only when there is nothing real yet). Made up, and labelled so.
    const EXROWS = [
      { name: 'Summit Interiors', type: 'Interior designer', state: 'Replied', hi: true },
      { name: 'Alpine Kitchen and Bath', type: 'Showroom', state: 'Contacted' },
      { name: 'Peak Design Studio', type: 'Interior designer', state: 'Contacted' },
      { name: 'Timberline Interiors', type: 'Interior designer', state: 'Contacted' }
    ];
    const rankList = (rows) => h('ol', { class: 'pf-rank' }, rows.map((r, i) => h('li', { class: r.hi ? 'hi' : null },
      h('span', { class: 'pf-rn' }, String(i + 1)),
      h('span', { class: 'pf-rw' }, r.link ? ui.extLink(r.link, r.name, 'pf-nm') : h('b', { class: 'pf-nm' }, r.name), h('span', null, r.sub)),
      r.amt ? h('span', { class: 'pf-ra' }, r.amt) : h('span'),
      r.note ? pfCopy(r) : h('span', { class: 'pf-pill ' + (r.kind || '') }, r.state))));
    // Partners already sending work get one action: a thank you that asks for the next one (Matt, Nov 7: everything needs a use).
    const pfCopy = (r) => { const b = h('button', { type: 'button', class: 'fz-btn sm' }, r.state === 'Quiet' ? 'Copy a check in' : 'Copy a thank you'); b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(r.note); b.textContent = 'Copied'; } catch (e) { b.textContent = 'Could not copy'; } setTimeout(() => { b.textContent = r.state === 'Quiet' ? 'Copy a check in' : 'Copy a thank you'; }, 1800); }); return b; };
    const thanks = (p) => { const quiet = fmt.daysSince(p.last) >= 90; return 'Hi ' + (String(p.name).split(/\s+/)[0]) + ' team, it is ' + FZ.me().first + ' at ' + FZ.biz() + '. ' + (quiet ? 'It has been a while since we worked together on your ' + fmt.plural(p.jobs, 'job') + '. ' : 'Thank you for the ' + fmt.plural(p.jobs, 'job') + ' this year. ') + 'If you have a project coming up that needs ' + FZ.w.services + ', I would be glad to get it on our calendar early.'; };

    if (!withEmail.length && !partners.length) {
      out.push(ui.status(['Finding ', { b: 'local businesses that can send you work' }, ' near ' + FZ.town() + '.']));
      out.push(K.how(h, 'It finds businesses near you that could send you work, and writes each one a short intro from you.'));
      out.push(K.quiet(h,
        K.checked(h, found.length ? fmt.plural(found.length, 'nearby business', 'nearby businesses') + ' checked' : 'First partner search running', [
          found.length ? 'None publish an office email yet, so no intros were written' : 'Searching around ' + FZ.town(),
          clients.length ? fmt.plural(clients.length, 'Jobber client') + ' left out, you already know them' : 'No company clients in your Jobber yet',
          'Emails come only from their own website, never guessed'
        ]),
        K.example(h, 'Summit Interiors replied and booked coffee', [
          rankList(EXROWS.map((r) => ({ name: r.name, sub: r.type + ' nearby', state: r.state, kind: r.state === 'Replied' ? 'rep' : 'con', hi: r.hi }))),
          h('p', { class: 'pf-note' }, 'Made up. Your real partners replace this.')])));
    } else {
      // Headline: what the owner gets. Two orange parts at most.
      out.push(ui.status(withEmail.length
        ? [partners.length ? fmt.plural(partners.length, 'partner') + ' sent you ' + fmt.money(total, { short: true }) + ' this year. ' : '', { b: fmt.plural(withEmail.length, 'new partner') + ' near ' + FZ.town() }, withEmail.length === 1 ? ' has an intro ready.' : ' have intros ready.']
        : [fmt.plural(partners.length, 'company', 'companies') + ' sent you ', { b: fmt.money(total, { short: true }) }, ' in jobs this year.']));
      out.push(K.how(h, 'It finds local businesses that can send you work and writes each a short intro from you.'));
      // Hero: one ranked list, partners sending work first, then the new ones and where each stands.
      const rows = partners.slice(0, 3).map((p) => ({ name: p.name, link: p.link, sub: fmt.plural(p.jobs, 'job') + ', last ' + fmt.fmtDate(p.last), amt: fmt.money(p.dollars, { short: true }), state: fmt.daysSince(p.last) >= 90 ? 'Quiet' : 'Sending work', kind: fmt.daysSince(p.last) >= 90 ? '' : 'ok', note: thanks(p) }))
        .concat(found.slice().sort((a, b) => (!!sentOf(b) - !!sentOf(a)) || (!!b.email - !!a.email) || ((order[a.type] || 0) - (order[b.type] || 0)) || String(a.name).localeCompare(String(b.name))).slice(0, 6 - Math.min(3, partners.length)).map((p) => ({ name: p.name, link: p.website, sub: (kindOf(p) || 'Partner') + (p.town ? ' in ' + p.town : ''), state: sentOf(p) ? 'Contacted' : p.email ? 'Intro ready' : 'Finding email', kind: sentOf(p) ? 'con' : p.email ? 'hot' : '' })));
      const contacted = found.filter(sentOf).length;
      out.push(K.hero(h, {
        eyebrow: partners.length ? 'Your partners' : 'Near ' + FZ.town(),
        title: partners.length ? [partners[0].name + ' sends the most, ', { b: fmt.money(partners[0].dollars, { short: true }) }] : [fmt.plural(found.length, 'partner') + ' found, ', { b: withEmail.length + ' with an email' }],
        sub: partners.length ? 'Job dollars in the last 12 months, then the new partners the agent found.' : 'Local businesses not in your Jobber yet.',
        viz: rankList(rows),
        did: [
          found.length ? { t: 'Checked ' + fmt.plural(found.length, 'nearby business', 'nearby businesses'), s: doc && doc.updatedAt ? 'On their own websites, ' + fmt.fmtDate(doc.updatedAt) : 'On their own websites' } : null,
          { t: 'Read ' + fmt.plural(jobs.length, 'job') + ' from the last 12 months', s: fmt.plural(partners.length, 'company', 'companies') + ' sending work' },
          withEmail.length ? { t: 'Wrote ' + fmt.plural(withEmail.length, 'intro') + ' for your OK', s: contacted ? contacted + ' already contacted' : 'Only to a published email' } : null,
          { t: 'Next: new partner search', s: 'Once a month', done: false }
        ].filter(Boolean)
      }));
      const foundTable = found.length ? ui.table([
        { label: 'Partner', get: (p) => p.name },
        { label: 'Type', get: (p) => kindOf(p) },
        { label: 'Town', get: (p) => p.town || '' },
        { label: 'Email', get: (p) => p.email || 'Not published' },
        { label: 'Website', get: (p) => p.website ? ui.extLink(p.website, 'Open') : '' }
      ], found.filter((p) => !withEmail.slice(0, 3).includes(p)), { open: true }) : null;
      const top3 = withEmail.slice(0, 3);
      if (top3.length) out.push(K.needs(h, {
        title: [fmt.plural(top3.length, 'intro') + ' to approve, ', { b: 'best fit first' }],
        items: top3.map((p) => ({
          title: p.name,
          meta: [{ b: kindOf(p) || 'Partner' }, p.town ? ' · ' + p.town : '', p.person ? ' · ' + p.person : ''],
          detail: (p.why ? p.why + ' ' : '') + 'Intro to ' + p.email + ' is written.',
          actions: [h('button', { type: 'button', class: 'fz-btn act', onclick: () => goWork(p.name) }, 'Send it'), p.website ? ui.extLink(p.website, 'Website', 'fz-tlink') : null].filter(Boolean)
        })),
        rest: { count: found.length - top3.length, label: 'nearby partners the agent is working through', list: foundTable }
      }));
      else if (foundTable) out.push(ui.details(fmt.plural(found.length, 'nearby partner') + ' the agent found', foundTable));
      if (partners.length) out.push(ui.details(fmt.plural(partners.length, 'current partner') + ', last 12 months', ui.table([
        { label: 'Company', get: (p) => p.name },
        { label: 'Jobs', num: true, get: (p) => String(p.jobs) },
        { label: 'Job dollars', num: true, get: (p) => fmt.money(p.dollars) },
        { label: 'Latest job', get: (p) => fmt.fmtDate(p.last) },
        { label: 'Jobber', get: (p) => p.link ? ui.extLink(p.link, 'Open') : '' }
      ], partners, { open: true })));
      if (withEmail.length) {
        const sec = ui.section(fmt.plural(withEmail.length, 'intro email') + ' ready to send', 'Read each email, then approve it. It goes out from your email on the next run.',
          ui.cards(withEmail.map((p) => ({
            when: (kindOf(p) || 'Partner') + ' · ' + (p.town || ''),
            who: p.name,
            why: p.why || '',
            link: p.website, linkLabel: 'Visit website',
            draft: draft(p), draftTo: p.email, draftSubject: 'Working together in ' + (p.town || FZ.town())
          })), { max: withEmail.length }));
        sec.dataset.worklabel = 'To send';
        out.push(sec);
      }
    }
    out.push(h('style', null, PF_CSS));
    out.push(ui.how('New partners are local businesses whose customers need your kind of work, found on Google and their own websites each month. Anyone already in your Jobber is left out.',
      'Only businesses that publish an email on their own website get an intro email. Emails are never guessed.',
      'A current partner is any Jobber client with a company name that had a job in the last 12 months, ranked by job dollars. Queued emails go out from your email on the next run. Nothing goes out unless you queue it.'));
    return out;
  }
});
const PF_CSS = '.pf-rank{list-style:none;margin:4px 0 0;padding:0;display:flex;flex-direction:column}.pf-rank li{display:grid;grid-template-columns:28px minmax(0,1fr) auto 104px;gap:12px;align-items:center;padding:10px 0;border-bottom:1px solid var(--line)}.pf-rank li:last-child{border-bottom:0}.pf-rn{width:26px;height:26px;border-radius:50%;border:1px solid var(--line);display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:var(--muted)}.pf-rw{display:flex;flex-direction:column;min-width:0}.pf-nm{color:var(--fg);font-weight:600;font-size:14px;overflow-wrap:anywhere;text-decoration:none}a.pf-nm:hover{text-decoration:underline}.pf-rw span{font-size:12px;color:var(--muted)}.pf-ra{font-weight:700;font-size:14px;font-variant-numeric:tabular-nums}.pf-pill{justify-self:end;font-size:12px;font-weight:600;border:1px solid var(--line);border-radius:999px;padding:3px 10px;color:var(--muted);white-space:nowrap}.pf-pill.ok{border-color:#22c55e;color:#4ade80}.pf-pill.hot,.pf-pill.rep{border-color:var(--accent);color:var(--accent)}.pf-pill.con{color:var(--fg)}.pf-rank li.hi .pf-rn{border-color:var(--accent);color:var(--accent)}.pf-note{margin:8px 0 0;font-size:12px;color:var(--muted)}' +
  '.ag-act .fz-btn{min-height:36px;padding:0 14px;font-size:14px;white-space:nowrap}.ag-act .fz-btn.act{background:var(--accent);color:var(--on-accent,#111)!important}.ag-act .fz-tlink{font-size:13px;color:var(--muted);font-weight:500}.ag-more details > div{margin-top:12px}' +
  '@media(max-width:520px){.pf-rank li{grid-template-columns:26px minmax(0,1fr) auto}.pf-pill{grid-column:2/4;justify-self:start}}';
