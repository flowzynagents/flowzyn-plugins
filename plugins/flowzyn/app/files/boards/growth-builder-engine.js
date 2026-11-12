// Builder Outreach: builders pulling permits in the areas the shop picks, with a note from the owner.
FZ.board('builder-engine', {
  status: 'live',
  source: 'New projects: open county permit lists where one is published, checked by your Monday run. Builders: Jobber, live.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const WINDOW = 60, PER_WEEK = 10, MATCH_CAP = 25;
    let AREAS = FZ.town();
    const isCo = (c) => !!(c && (fmt.clean(c.companyName) || c.isCompany));
    const coName = (c) => fmt.clean(c.companyName) || fmt.clean(c.name);
    const norm = (s) => fmt.clean(s).toLowerCase().replace(/[.,&'’]/g, ' ').replace(/\b(llc|inc|incorporated|co|corp|corporation|company|ltd|the)\b/g, ' ').replace(/\s+/g, ' ').trim();
    const big = (n) => (n = Number(n) || 0) >= 1e6 ? '$' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M' : fmt.money(n, { short: true });
    // Permit dates are calendar days, so show them as written.
    const pday = (d) => /^\d{4}-\d{2}-\d{2}(T00:00:00(\.0+)?Z)?$/.test(String(d)) ? new Date(String(d).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }) : fmt.fmtDate(d);
    const sameCo = (a, b) => { a = norm(a); b = norm(b); return !!a && !!b && (a === b || (a.length > 4 && b.length > 4 && (a.includes(b) || b.includes(a)))); };

    const data = await ctx.store('datasets/permits');
    if (data && data.sources && data.sources.length) { const a = [...new Set(data.sources.map((s) => s.area))]; AREAS = a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a.join(''); }
    // Only the areas the owner picked in Connect, Builder areas (all loaded areas until they pick).
    const PICK = ((FZ.profile && FZ.profile().builderAreas) || []).map((a) => fmt.clean(a).toLowerCase()).filter(Boolean);
    if (PICK.length && data && data.sources) { const a = [...new Set(data.sources.map((s) => s.area).filter((x) => PICK.includes(fmt.clean(x).toLowerCase())))]; if (a.length) AREAS = a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0]; }
    const inPick = (p) => { if (!PICK.length) return true; const pa = fmt.clean(p.area).toLowerCase(); return !!pa && PICK.some((a) => pa.includes(a) || a.includes(pa)); };
    const permits = ((data && data.permits) || []).filter((p) => p && fmt.clean(p.contractor) && (!p.issued || fmt.daysSince(p.issued) <= WINDOW) && inPick(p));

    // ---------- No permits yet: show the builders the shop already works with ----------
    if (!permits.length) {
      const [clients, quotes] = await Promise.all([
        ctx.jobberAll('search_clients', { limit: 100 }, 'clients', 300),
        ctx.jobberAll('search_quotes', { dateRange: { after: fmt.isoDaysAgo(365) }, sort: 'createdAt', limit: 100 }, 'quotes', 300)
      ]);
      const groups = new Map();
      clients.filter((c) => isCo(c) && !c.isArchived).forEach((c) => {
        const k = norm(coName(c));
        if (!groups.has(k)) groups.set(k, { name: coName(c), ids: new Set(), contacts: [], link: c.jobberWebUri, quoted: 0, won: 0, n: 0 });
        const g = groups.get(k); g.ids.add(c.id); g.contacts.push(fmt.clean(c.name));
      });
      const list = [...groups.values()];
      quotes.forEach((q) => {
        const g = list.find((x) => q.client && x.ids.has(q.client.id));
        if (!g) return;
        g.n++; g.quoted += Number(q.total) || 0;
        if (q.status === 'converted' || q.status === 'approved') g.won += Number(q.total) || 0;
      });
      list.sort((a, b) => b.won - a.won || b.quoted - a.quoted);

      ctx.metric('builder-engine', list.length
        ? { value: fmt.plural(list.length, 'builder') + ' already in Jobber', detail: 'Checked every Monday' }
        : { value: 'Looking for new projects', detail: 'Checked every Monday' });
      const K = FZ.kit, { h } = ui;
      const EX = [{ n: 10, label: 'Intro emails sent', w: 100 }, { n: 2, label: 'Builders replied', w: 62 }, { n: 1, label: 'Site visit booked', w: 38, hi: true }];
      const out0 = [
        ui.status(list.length
          ? ['You already quote ' + fmt.plural(list.length, 'builder') + '. ', { b: 'About ' + PER_WEEK + ' new builder intros a week' }, ' show here.']
          : [data && data.updatedAt ? 'No new approvals near you this week. ' : 'The first check runs with your Monday run. ', { b: 'About ' + PER_WEEK + ' builder intros a week' }, ' show here.']),
        K.how(h, 'It finds builders with new projects near you each week and writes a short intro from you to each one not in your Jobber yet.'),
        K.quiet(h,
          K.checked(h, data && data.updatedAt ? 'Permit list checked ' + fmt.fmtDay(data.updatedAt) : 'First check runs with your Monday run', [
            data && data.updatedAt ? 'No new approvals in the last ' + WINDOW + ' days for ' + AREAS : 'Areas set: ' + AREAS,
            list.length ? fmt.plural(list.length, 'builder') + ' already in your Jobber, left out of intros' : 'No builders in your Jobber yet, so every builder counts as new',
            list.length && list[0].quoted ? 'Top builder you quote: ' + K.name(list[0].name) + ', ' + fmt.money(list[0].quoted, { short: true }) + ' in 12 months' : null,
            'Up to ' + PER_WEEK + ' intros a week, only to a published office email'
          ]),
          K.example(h, 'Ridge Line Builders booked a site walk', [
            h('div', { class: 'be-fun' }, EX.map((st) => h('div', { class: 'be-fstep' + (st.hi ? ' hi' : ''), style: 'width:' + st.w + '%' }, h('b', null, String(st.n)), h('span', null, st.label)))),
            h('p', { class: 'be-ex-note' }, 'Made up. Your real builders replace this.'),
            h('style', null, BE_EX_CSS)]))
      ];
      if (list.length) out0.push(ui.details(fmt.plural(list.length, 'builder') + ' you already work with', h('div', { class: 'fz-tablebox' }, ui.table([
        { label: 'Builder', get: (g) => K.name(g.name) },
        { label: 'Quotes', num: true, get: (g) => String(g.n) },
        { label: 'Quoted', num: true, get: (g) => fmt.money(g.quoted) },
        { label: 'Won', num: true, get: (g) => fmt.money(g.won) },
        { label: 'Jobber', get: (g) => g.link ? ui.extLink(g.link, 'Open') : '' }
      ], list, { open: true }))));
      out0.push(ui.how('Each week new building permits for ' + AREAS + ' are loaded. Builders with new approvals are ranked by how much they are building.', 'Builders already in your Jobber are left out of the intros. About ' + PER_WEEK + ' short emails a week are written for your OK.', 'A builder is any Jobber client with a company name. Quoted counts every quote in the last 12 months. Won counts approved and converted quotes.'));
      return out0;
    }

    // ---------- Permits loaded ----------
    const byCo = new Map();
    permits.forEach((p) => {
      const k = norm(p.contractor);
      if (!byCo.has(k)) byCo.set(k, { name: fmt.clean(p.contractor), permits: [], value: 0, areas: new Set() });
      const g = byCo.get(k);
      g.permits.push(p); g.value += Number(p.valuation) || 0; if (p.area) g.areas.add(fmt.clean(p.area));
    });
    const builders = [...byCo.values()].map((g) => {
      g.permits.sort((a, b) => (String(a.issued) < String(b.issued) ? 1 : -1));
      g.latest = g.permits[0];
      return g;
    }).sort((a, b) => b.permits.length - a.permits.length || b.value - a.value);

    // Match the top builders against Jobber by company name.
    const core = (s) => norm(s).split(' ').slice(0, 3).join(' ');
    await ctx.pool(builders.slice(0, MATCH_CAP), 4, async (g) => {
      const res = await ctx.jobber('search_clients', { query: core(g.name), limit: 10 });
      const hit = ((res && res.clients) || []).find((c) => sameCo(c.companyName || '', g.name) || sameCo(c.name, g.name));
      g.checked = true;
      g.client = hit || null;
    });
    const fresh = builders.filter((g) => g.checked && !g.client);
    // Published office emails, found on each builder's own website by the morning run. Never guessed.
    const contactsDoc = await ctx.store('datasets/builder-contacts').catch(() => null);
    const contacts = (contactsDoc && contactsDoc.contacts) || {};
    const known = builders.filter((g) => g.client);

    // The note follows the shop's own template, so it reads right without editing each one.
    const DEFAULT_NOTE = 'Hello {builder} team,\n\nI saw the approval for your {project}{at}. I am {me}, owner of {business}. ' + FZ.w.weDo + ' for builders around ' + FZ.town() + '.\n\nIf you have not lined up our part of that job yet, I would be glad to look at the plans and get you a number within the week.\n\n{signature}';
    const template = () => (FZ.profile().builderNote || DEFAULT_NOTE);
    // "COLUMBINE HOME BUILDERS LLC" reads as "Columbine Home Builders" in a note.
    const niceName = (n) => { let x = fmt.clean(n).replace(/[,.]?\s*\b(llc|inc|incorporated|corp|corporation|co|ltd)\b\.?/gi, '').trim(); if (x === x.toUpperCase()) x = x.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()); return x; };
    const fill = (tpl, g) => {
      const p = g.latest;
      const addr = fmt.clean(p.address), area = fmt.clean(p.area);
      const where = addr && area && !addr.toLowerCase().includes(area.toLowerCase()) ? addr + ' in ' + area : (addr || area);
      const t = (fmt.clean(p.type) || '').toLowerCase();
      const kind = /non.?residential|commercial/.test(t) ? 'commercial' : /residential|single|multi|dwelling/.test(t) ? (/multi|loretto|mf\b/.test(t) ? 'multifamily' : 'home') : '';
      const project = /addition/.test(t) ? (kind ? kind + ' addition' : 'addition') : (kind ? 'new ' + kind + ' build' : 'new build');
      const vals = { builder: niceName(g.name), project, at: where ? ' at ' + where : '', address: fmt.clean(p.address) || 'your new build', area: fmt.clean(p.area) || '', permits: String(g.permits.length), me: FZ.me().first, business: FZ.biz(), signature: FZ.sign() };
      return tpl.replace(/\{(\w+)\}/g, (m, k) => (k in vals ? vals[k] : m));
    };
    // Notes the morning run wrote for each builder (Builder Outreach skill, note rules) win over the template.
    const draftsDoc = await ctx.store('datasets/builder-drafts').catch(() => null);
    const drafts = (draftsDoc && draftsDoc.drafts) || {};
    const note = (g) => (drafts[slug(g.name)] && drafts[slug(g.name)].body) || fill(template(), g);

    // ---------- Pipeline: drafted, sent, replied, site walk, quoted, won ----------
    const STAGES = [
      { id: 'drafted', label: 'Drafted' }, { id: 'queued', label: 'Send queue' }, { id: 'sent', label: 'Sent' }, { id: 'replied', label: 'Replied' },
      { id: 'meeting', label: 'Site walk or call' }, { id: 'quoted', label: 'Quoted' }, { id: 'won', label: 'Won' }
    ];
    const rank = (id) => STAGES.findIndex((s) => s.id === id);
    const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80) || 'builder';
    const db = window.claude && window.claude.use ? await window.claude.use('db') : null;
    const pipe = new Map();
    if (db) {
      try { const snap = await db.collection('pipeline').get(); (snap.docs || []).forEach((d) => pipe.set(d.id, Object.assign({ id: d.id }, d.data()))); } catch (e) { /* pipeline starts empty */ }
    }
    const rerender = () => setTimeout(() => window.dispatchEvent(new HashChangeEvent('hashchange')), 400);
    const saveStage = async (g, stage, msgEl) => {
      if (!db) { if (msgEl) msgEl.textContent = 'Open this page in Claude to update the pipeline.'; return false; }
      const id = slug(g.name);
      const prev = pipe.get(id) || {};
      const now = new Date().toISOString();
      const doc = {
        name: g.name, stage, updatedAt: now,
        areas: g.areas ? [...g.areas] : (prev.areas || []), permits: g.permits ? g.permits.length : (prev.permits || 0), value: g.value != null ? g.value : (prev.value || 0),
        latest: g.latest ? { type: fmt.clean(g.latest.type), address: fmt.clean(g.latest.address), issued: g.latest.issued || null } : (prev.latest || null),
        sentAt: stage === 'sent' && !prev.sentAt ? now : (prev.sentAt || null),
        history: (prev.history || []).concat([{ stage, at: now }]).slice(-20),
        outbox: stage === 'queued' && g.outbox ? Object.assign({ queuedAt: now }, g.outbox) : (stage === 'sent' ? null : (prev.outbox || null))
      };
      try { await db.doc('pipeline/' + id).set(doc); pipe.set(id, Object.assign({ id }, doc)); return true; }
      catch (e) { if (msgEl) msgEl.textContent = 'Could not save. Only an editor of this page can move builders.'; return false; }
    };

    // Quoted and Won move on their own from Jobber.
    const inPipe = [...pipe.values()];
    await ctx.pool(inPipe.filter((p) => rank(p.stage) < rank('won')).slice(0, 20), 4, async (p) => {
      const res = await ctx.jobber('search_clients', { query: core(p.name), limit: 10 });
      const hit = ((res && res.clients) || []).find((c) => sameCo(c.companyName || '', p.name) || sameCo(c.name, p.name));
      if (!hit) return;
      const qs = await ctx.jobberAll('search_quotes', { clientId: hit.id, limit: 50 }, 'quotes', 50);
      const since = p.sentAt || p.updatedAt;
      const recent = qs.filter((q) => !since || (q.createdAt && q.createdAt >= since.slice(0, 10)));
      let auto = null;
      if (recent.some((q) => q.status === 'approved' || q.status === 'converted')) auto = 'won';
      else if (recent.some((q) => q.sentAt)) auto = 'quoted';
      if (auto && rank(auto) > rank(p.stage)) {
        await saveStage({ name: p.name }, auto);
        p.stage = auto;
        p.quoteDollars = recent.reduce((n, q) => n + (Number(q.total) || 0), 0);
      }
    });

    const count = (id) => [...pipe.values()].filter((p) => p.stage === id).length;
    const contacted = [...pipe.values()].filter((p) => rank(p.stage) >= rank('sent')).length;
    const replied = [...pipe.values()].filter((p) => rank(p.stage) >= rank('replied')).length;
    const quotedN = [...pipe.values()].filter((p) => rank(p.stage) >= rank('quoted')).length;
    ctx.metric('builder-engine', contacted
      ? { value: contacted + ' contacted, ' + replied + ' replied, ' + fmt.plural(quotedN, 'quote'), detail: fmt.plural(fresh.length, 'new builder') + ' with new approvals to reach' }
      : { value: fmt.plural(fresh.length, 'new builder') + ' to reach', detail: fmt.plural(permits.length, 'approval') + ' in the last ' + WINDOW + ' days' });

    const out = [];

    const { h } = ui;
    const subjectFor = (g) => 'A quote for your ' + (fmt.clean(g.latest && g.latest.address) || 'new build');

    // Pipeline: a stage strip with counts, then every builder as a readable row.
    const pipeOut = [], notesOut = [], overOut = [];
    const pipeRows = [...pipe.values()].sort((a, b) => rank(b.stage) - rank(a.stage) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const strip = h('div', { class: 'be-stages' }, STAGES.map((st) => { const n = count(st.id); return h('div', { class: 'be-stage' + (n ? ' on' : '') + (st.id === 'won' && n ? ' won' : '') }, h('span', { class: 'n' }, String(n)), h('span', { class: 'l' }, st.label)); }));
    const mover = (p) => {
      const sel = h('select', { class: 'fz-pipe-move', 'aria-label': 'Move ' + niceName(p.name) }, STAGES.map((s) => h('option', { value: s.id, selected: s.id === p.stage ? true : null }, s.label)));
      sel.addEventListener('change', async () => { sel.disabled = true; if (await saveStage({ name: p.name }, sel.value)) rerender(); sel.disabled = false; });
      return sel;
    };
    pipeOut.push(ui.section(pipe.size ? fmt.plural(pipe.size, 'builder') + ' in your pipeline' : 'Your pipeline starts with your first email',
      pipe.size ? 'Quoted and Won move on their own when the builder gets a quote in Jobber' : 'Queue an email in To send and the builder starts here',
      strip,
      pipe.size ? ui.table([
        { label: 'Builder', get: (p) => h('b', null, niceName(p.name)) },
        { label: 'Area', get: (p) => (p.areas || []).join(', ') },
        { label: 'Last step', get: (p) => p.sentAt ? 'Sent ' + fmt.fmtDate(p.sentAt) : (p.updatedAt ? fmt.fmtDate(p.updatedAt) : '') },
        { label: 'Stage', get: mover }
      ], pipeRows, { open: true }) : null,
      h('style', null, '.be-stages{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:10px;margin:4px 0 22px}.be-stage{border:1px solid var(--line);border-radius:12px;padding:14px 12px;background:var(--card);display:flex;flex-direction:column;gap:4px;min-height:72px}.be-stage .n{font:800 28px/1 var(--font);color:var(--muted)}.be-stage .l{font-size:13px;color:var(--muted);line-height:1.25}.be-stage.on{border-color:var(--accent)}.be-stage.on .n{color:var(--fg)}.be-stage.won .n{color:var(--ok,#16a34a)}@media(max-width:900px){.be-stages{grid-template-columns:repeat(4,minmax(0,1fr))}}@media(max-width:520px){.be-stages{grid-template-columns:repeat(4,minmax(0,1fr));gap:6px}.be-stage{min-height:0;padding:10px 8px}.be-stage .n{font-size:20px}.be-stage .l{font-size:11px}.fz-pipe-move{min-width:0;width:100%}}.fz-pipe-move{min-width:170px;font:500 14px var(--font);color:var(--fg);background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px 10px;min-height:40px}')));

    // Follow ups: sent 7+ days ago, no reply yet.
    const due = [...pipe.values()].filter((p) => p.stage === 'sent' && p.sentAt && fmt.daysSince(p.sentAt) >= 7);
    if (due.length) {
      const followNote = (p) => 'Hello ' + p.name + ' team,\n\nJust following up on my email about ' + ((p.latest && p.latest.address) || 'your new build') + '. Happy to look at plans whenever suits and get you a number within the week.\n\n' + FZ.sign();
      pipeOut.push(ui.section(fmt.plural(due.length, 'builder') + ' to follow up', 'Sent a week or more ago with no reply yet',
        h('div', { class: 'fz-cards' }, due.map((p) => {
          const msg = h('p', { class: 'fz-hint', role: 'status' });
          const card = h('article', { class: 'fz-card flag' },
            h('div', { class: 'fz-card-top' }, h('span', { class: 'when' }, 'Sent ' + fmt.fmtDate(p.sentAt) + ' · ' + fmt.plural(fmt.daysSince(p.sentAt), 'day') + ' ago')),
            h('span', { class: 'who' }, p.name),
            h('div', { class: 'fz-card-btns' },
              ui.draftButton(followNote(p), 'Write follow up', { subject: 'Following up on your new build' }),
              h('button', { type: 'button', class: 'fz-btn ghost', onclick: async (ev) => { ev.currentTarget.disabled = true; if (await saveStage({ name: p.name }, 'replied', msg)) { msg.textContent = 'Moved to Replied.'; rerender(); } } }, 'They replied')),
            msg);
          return card;
        }))));
    }

    // Send queue: notes the owner approved, sent from their own email on the next run.
    const queued = [...pipe.values()].filter((p) => p.stage === 'queued');
    if (queued.length) {
      pipeOut.unshift(ui.section('Send queue: ' + fmt.plural(queued.length, 'email'), 'These go out from your email on the next run, then move to Sent',
        h('div', { class: 'fz-cards' }, queued.map((p) => {
          const m = h('p', { class: 'fz-hint', role: 'status' });
          const back = h('button', { type: 'button', class: 'fz-btn' }, 'Take out of queue');
          back.addEventListener('click', async () => { back.disabled = true; if (await saveStage({ name: p.name }, 'drafted', m)) rerender(); else back.disabled = false; });
          return h('article', { class: 'fz-card' },
            h('div', { class: 'fz-card-top' }, h('span', { class: 'when' }, 'Queued ' + fmt.fmtDate((p.outbox && p.outbox.queuedAt) || p.updatedAt))),
            h('span', { class: 'who' }, niceName(p.name)),
            h('span', { class: 'why' }, [(p.outbox && p.outbox.to) ? 'To ' + p.outbox.to : '', (p.outbox && p.outbox.subject) || ''].filter(Boolean).join(' · ')),
            h('div', { class: 'fz-card-btns' }, back), m);
        }))));
    }

    // This week's notes: only builders with a published email, so every note can actually go out.
    const emailOf = (g) => { const c = contacts[slug(g.name)] || {}; return (c.email || (g.client && g.client.email) || '').trim(); };
    const notYet = fresh.filter((g) => !pipe.has(slug(g.name)) || pipe.get(slug(g.name)).stage === 'drafted');
    const toReach = notYet.filter((g) => emailOf(g));
    const freshValue = fresh.reduce((t, g) => t + (Number(g.value) || 0), 0);
    const ready = Math.min(PER_WEEK, toReach.length);
    const freshPermits = fresh.reduce((t, g) => t + g.permits.length, 0);
    const waitEmail = notYet.length - toReach.length;
    {
      // One headline, counting one set: builders new to you (not in Jobber), last 60 days. Two orange parts at most.
      out.unshift(ui.status(fresh.length
        ? [fmt.plural(fresh.length, 'new builder') + ' near you have ', freshValue > 0 ? { b: big(freshValue) } : { b: fmt.plural(freshPermits, 'permit') }, freshValue > 0 ? ' in approved projects. ' : ' in ' + WINDOW + ' days. ',
          ready ? { b: fmt.plural(ready, 'intro') + (ready === 1 ? ' is ready to send.' : ' are ready to send.') } : waitEmail ? 'Your agent is finding each office email first.' : 'Your agent writes the intros next.']
        : [fmt.plural(builders.length, 'builder') + ' near you pulled permits in ' + WINDOW + ' days. ', { b: 'All already work with you.' }]));
    }
    const noEmail = notYet.length - toReach.length;
    if (toReach.length) {
      notesOut.push(ui.section(fmt.plural(Math.min(PER_WEEK, toReach.length), 'email') + ' ready to send', 'Read each email, change anything you like, then queue it. It goes out from your email on the next run.',
        h('div', { class: 'fz-cards' }, toReach.slice(0, PER_WEEK).map((g) => {
          const msg = h('p', { class: 'fz-hint', role: 'status' });
          const c = contacts[slug(g.name)] || {};
          const site = c.website ? c.website.replace(/^https?:\/\//, '').replace(/\/$/, '') : '';
          const addr = (a) => fmt.clean(a).replace(/\b([A-Za-z]+)\b/g, (w) => /^\d/.test(w) ? w : (w.length <= 2 && /^(NE|NW|SE|SW|N|S|E|W)$/i.test(w) ? w.toUpperCase() : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())).replace(/\b(\d+)(ST|ND|RD|TH)\b/gi, (m, n, x) => n + x.toLowerCase());
          // Two columns: who you are writing to on the left, the email on the right.
          return h('article', { class: 'fz-card be-mail', id: 'be-' + slug(g.name) },
            h('aside', { class: 'be-who' },
              h('span', { class: 'when' }, [...g.areas].join(', ')),
              h('span', { class: 'who' }, niceName(g.name)),
              h('span', { class: 'be-sum' }, (g.value ? big(g.value) + ' approved · ' : '') + fmt.plural(g.permits.length, 'approval') + ' in ' + WINDOW + ' days'),
              h('div', { class: 'be-person' },
                h('span', { class: 'be-av' }, (c.person || (String(emailOf(g) || '').split('@')[0].match(/^[a-z]{3,}$/i) && !/^(info|hello|office|contact|admin|sales|team|mail)$/i.test(String(emailOf(g)).split('@')[0]) ? String(emailOf(g)).split('@')[0] : niceName(g.name))).split(/\s+/).map((w) => w.charAt(0)).slice(0, 2).join('').toUpperCase()),
                // Name and job title when known (Matt, Nov 7). A shared inbox says so, and a personal address gives the first name.
                (() => { const em = String(emailOf(g) || ''); const local = em.split('@')[0] || ''; const generic = /^(info|hello|office|contact|admin|sales|team|mail|inquiries|enquiries|support|build|builders?)$/i.test(local);
                  const first = !generic && /^[a-z]{2,}$/i.test(local.split(/[._]/)[0]) ? local.split(/[._]/)[0].replace(/^./, (x) => x.toUpperCase()) : '';
                  const name = c.person || first || 'Main office inbox';
                  const role = c.title || (generic ? 'Reaches whoever runs the office' : 'Job title not listed yet');
                  return h('div', null, h('b', null, name), h('span', { class: 'be-title' + (c.title ? '' : ' be-tq') }, role)); })()),
              h('div', { class: 'be-links' },
                h('span', null, h('i', null, '@'), emailOf(g)),
                site ? h('span', null, h('i', null, '↗'), ui.extLink(c.website, site)) : null),
              h('div', { class: 'be-latest' },
                h('span', { class: 'k' }, 'Latest approval'),
                h('span', null, (g.latest.issued ? pday(g.latest.issued) : 'Date not listed') + (fmt.clean(g.latest.type) ? ' · ' + fmt.clean(g.latest.type) : '')),
                g.latest.address ? h('span', { class: 'be-addr' }, addr(g.latest.address)) : null)),
            h('div', { class: 'be-email' }, ui.draftButton(note(g), 'Read and send', { minimal: true, inline: true, subject: (drafts[slug(g.name)] && drafts[slug(g.name)].subject) || subjectFor(g), to: emailOf(g), queued: (pipe.get(slug(g.name)) || {}).stage === 'queued', onQueue: async (ob) => { const ok = await saveStage(Object.assign({}, g, { outbox: ob }), 'queued', msg); if (ok) rerender(); return ok; } }), msg));
        })),
        noEmail ? h('p', { class: 'fz-hint' }, fmt.plural(noEmail, 'more builder') + ' with new approvals but no published email yet. They show in the full list below.') : null));
    } else {
      notesOut.push(ui.calm(noEmail ? 'No emails ready yet. ' + fmt.plural(noEmail, 'new builder') + ' with new approvals are waiting on an office email. The Monday morning run looks each one up on their own website, and their emails show here as soon as an email is found.' : 'Every new builder with new approvals is already in your pipeline.'));
    }

    // Your note: one template for every builder note, so each one is ready to queue as it is.
    const tplArea = h('textarea', { class: 'fz-draft-text', rows: '10', 'aria-label': 'Your builder email' });
    tplArea.value = template();
    const tplMsg = h('p', { class: 'fz-hint', role: 'status' });
    const tplSave = h('button', { type: 'button', class: 'fz-btn act' }, 'Save template');
    tplSave.addEventListener('click', async () => { tplSave.disabled = true; const ok = await FZ.saveProfile({ builderNote: tplArea.value }); tplMsg.textContent = ok ? 'Saved. Every new email uses it.' : 'Could not save. Only an editor of this page can change it.'; tplSave.disabled = false; if (ok) rerender(); });
    notesOut.push(ui.details('Your email template, used for every builder',
      h('p', { class: 'fz-hint' }, 'Write it once. These fill in for each builder: {builder}, {project}, {address}, {area}, {permits}, {me}, {business}, {signature}. Keep it short: their project, who you are, one easy next step.'),
      tplArea, h('div', { class: 'fz-card-btns' }, tplSave), tplMsg));

    // Replies: builders who wrote back. One button to open the thread in your email.
    const repliedList = [...pipe.values()].filter((p) => p.stage === 'replied').sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    const replyOut = [repliedList.length
      ? ui.section(fmt.plural(repliedList.length, 'builder') + ' replied', 'Answer them and move them on in the pipeline when you book a site walk or call',
        h('div', { class: 'fz-cards' }, repliedList.map((p) => {
          const em = (contacts[p.id] || {}).email || (p.outbox && p.outbox.to) || '';
          return h('article', { class: 'fz-card' },
            h('div', { class: 'fz-card-top' }, h('span', { class: 'when' }, 'Replied ' + fmt.fmtDate(p.updatedAt))),
            h('span', { class: 'who' }, p.name),
            p.latest ? h('span', { class: 'why' }, 'About ' + (p.latest.address || 'their new build') + '.') : null,
            em ? h('div', { class: 'fz-card-btns' }, ui.extLink('https://mail.google.com/mail/u/0/#search/' + encodeURIComponent('from:' + em), 'Open reply', 'fz-btn act')) : null);
        })))
      : ui.calm('No replies yet. When a builder writes back, they show here.')];

    // ---------- Summary: headline, how line, one hero (ranked bars + what it did today), top 3 intros, the rest folded ----------
    const K = FZ.kit;
    const val = (g) => Number(g.value) || 0;
    const hasValues = fresh.some((g) => val(g) > 0);
    const freshRanked = fresh.slice().sort((a, b) => val(b) - val(a) || b.permits.length - a.permits.length);
    const top6 = freshRanked.slice(0, 6);
    const lead = top6[0];
    const knownN = builders.filter((g) => g.checked && g.client).length;
    const checkedN = builders.filter((g) => g.checked).length;
    overOut.push(K.how(h, 'It finds builders with new projects near you each week and writes a short intro from you to each one not in your Jobber yet.'));
    const did = [
      { t: 'Loaded ' + fmt.plural(permits.length, 'permit') + ' for ' + AREAS, s: data.updatedAt ? 'Last load ' + fmt.fmtDay(data.updatedAt) : 'Last ' + WINDOW + ' days' },
      { t: (checkedN === builders.length ? 'Checked all ' : 'Checked the top ') + fmt.plural(checkedN, 'builder') + ' against Jobber', s: knownN ? fmt.plural(knownN, 'already works', 'already work') + ' with you, left out' : 'None of them are in your Jobber yet' },
      ready ? { t: 'Wrote ' + fmt.plural(ready, 'intro') + ' for your OK', s: 'Only builders with a published office email' }
        : { t: 'Finding office emails for ' + fmt.plural(waitEmail, 'builder'), s: 'Never guessed', done: false },
      queued.length ? { t: 'Next: ' + fmt.plural(queued.length, 'queued intro') + ' go out', s: 'From your email on the next run', done: false }
        : { t: 'Next: intros go out after your OK', s: 'From your own email', done: false }
    ];
    if (lead) {
      overOut.push(K.hero(h, {
        eyebrow: 'Last ' + WINDOW + ' days',
        title: hasValues ? [K.name(niceName(lead.name)) + ' leads with ', { b: big(val(lead)) }, ' in new approvals'] : [K.name(niceName(lead.name)) + ' leads with ', { b: fmt.plural(lead.permits.length, 'permit') }],
        sub: (hasValues ? 'Approved project value' : 'Permits') + ' for the top ' + top6.length + ' of ' + fmt.plural(fresh.length, 'builder') + ' new to you' + (hasValues ? ', ' + big(freshValue) + ' in all.' : '.') + ' Builders in your Jobber are left out.',
        viz: ui.bars(top6.map((g, i) => ({ label: K.name(niceName(g.name)), value: hasValues ? val(g) : g.permits.length, display: hasValues ? big(val(g)) : String(g.permits.length), hi: i === 0 })), { max: 6 }),
        did
      }));
    } else {
      overOut.push(K.hero(h, { eyebrow: 'Last ' + WINDOW + ' days', title: ['Every builder pulling permits ', { b: 'already works with you' }], sub: fmt.plural(builders.length, 'builder') + ' with new approvals near you.', did }));
    }
    // Needs you: the 3 biggest intros ready to send. Send it jumps to the email in To send.
    const goSend = (g) => { pickTab = 'emails'; FZ._beTab = 'emails'; paint(); setTimeout(() => { const el = document.getElementById('be-' + slug(g.name)); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50); };
    const readySet = toReach.slice(0, PER_WEEK);
    const top3 = readySet.slice().sort((a, b) => val(b) - val(a)).slice(0, 3);
    const restB = freshRanked.filter((g) => !top3.includes(g));
    const siteOf = (g) => { const c = contacts[slug(g.name)] || {}; return c.website || 'https://www.google.com/search?q=' + encodeURIComponent(niceName(g.name) + ' ' + [...g.areas].join(' ') + ' Colorado'); };
    const restTable = ui.table([
      { label: 'Builder', get: (g) => K.name(niceName(g.name)) },
      { label: 'Area', get: (g) => [...g.areas].join(', ') },
      { label: 'Permits', num: true, get: (g) => String(g.permits.length) },
      hasValues ? { label: 'Value', num: true, get: (g) => val(g) > 0 ? big(val(g)) : '' } : null,
      { label: 'Latest', get: (g) => g.latest.issued ? pday(g.latest.issued) : '' },
      { label: 'Status', get: (g) => { const st = (pipe.get(slug(g.name)) || {}).stage; return st && st !== 'drafted' ? ui.pill(STAGES[rank(st)].label) : emailOf(g) ? ui.pill('Intro written') : ui.pill('Finding email'); } },
      { label: 'Website', get: (g) => ui.extLink(siteOf(g), 'Open') }
    ].filter(Boolean), restB, { open: true });
    const restLabel = (restB.length === 1 ? 'builder' : 'builders') + ' the agent is working through';
    if (top3.length) {
      overOut.push(K.needs(h, {
        title: [fmt.plural(top3.length, 'intro') + ' ready, ', { b: 'biggest projects first' }],
        items: top3.map((g) => {
          const p = g.latest;
          return {
            title: K.name(niceName(g.name)),
            meta: [val(g) > 0 ? { b: big(val(g)) } : fmt.plural(g.permits.length, 'permit'), ' · ' + [...g.areas].join(', ') + ' · ' + fmt.plural(g.permits.length, 'approval')],
            detail: (p.issued ? 'Latest approval ' + pday(p.issued) + '. ' : '') + 'Intro to ' + emailOf(g) + ' is written.',
            actions: [h('button', { type: 'button', class: 'fz-btn act', onclick: () => goSend(g) }, 'Send it'), ui.extLink(siteOf(g), 'Open', 'fz-tlink')]
          };
        }),
        rest: { count: restB.length, label: restLabel, list: restTable }
      }));
    } else if (restB.length) {
      overOut.push(ui.details(fmt.plural(restB.length, 'builder') + ' the agent is working through', restTable));
    }
    overOut.push(h('style', null, BE_ACT_CSS));
    // Three views: notes to send, replies, and the pipeline.
    const tabs = [
      { id: 'overview', label: 'Summary', n: null, body: h('div', { class: 'fz-tabbody' }, overOut) },
      { id: 'emails', label: 'To send', n: Math.min(PER_WEEK, toReach.length), body: h('div', { class: 'fz-tabbody' }, notesOut) },
      { id: 'replies', label: 'Replies', n: repliedList.length, body: h('div', { class: 'fz-tabbody' }, replyOut) },
      { id: 'pipeline', label: 'Pipeline', n: pipe.size, body: h('div', { class: 'fz-tabbody' }, pipeOut) }
    ];
    let pickTab = FZ._beTab || 'overview';
    const bar = h('div', { class: 'fz-subtabs', role: 'tablist', 'aria-label': 'Builder Outreach views' });
    const paint = () => { bar.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === pickTab))); tabs.forEach((t) => { t.body.hidden = t.id !== pickTab; }); };
    tabs.forEach((t) => { const b = h('button', { type: 'button', role: 'tab', 'data-id': t.id }, t.label, t.n != null ? h('span', { class: 'n' }, String(t.n)) : null); b.addEventListener('click', () => { pickTab = t.id; FZ._beTab = t.id; paint(); }); bar.append(b); });
    paint();
    out.push(bar, ...tabs.map((t) => t.body));
    out.push(ui.how(
      'Permits come from the county lists for ' + AREAS + ', loaded each night' + (data.updatedAt ? ', last on ' + fmt.fmtDay(data.updatedAt) : '') + '.',
      'Builders are ranked by number of approvals in the last ' + WINDOW + ' days, then by total approved value.',
      'The top ' + MATCH_CAP + ' are checked against Jobber by company name. ' + known.length + ' already work with you.',
      'Up to ' + PER_WEEK + ' emails a week, only to builders with an office email published on their own website. Builders with no published email are left out, never guessed. Queued emails go out from your email on the next run.',
      'Your Operator marks Sent and Replied until Gmail is connected, then the morning run moves them by itself. Quoted and Won follow Jobber.'));
    return out;
  }
});
const BE_EX_CSS = '.be-fun{display:flex;flex-direction:column;align-items:center;gap:6px;margin:12px 0 8px}.be-fstep{display:flex;align-items:baseline;justify-content:center;gap:10px;padding:12px 10px;border:1px solid var(--line);border-radius:10px;background:var(--quiet);min-width:160px;max-width:100%;box-sizing:border-box}.be-fstep b{font:800 22px/1 var(--font);color:var(--meta,var(--fg))}.be-fstep span{font-size:14px;color:var(--muted)}.be-fstep.hi{border-color:var(--accent)}.be-fstep.hi b{color:var(--accent)}.be-ex-note{margin:6px 0 0;font-size:12px;color:var(--muted);text-align:center}';
const BE_ACT_CSS = '.ag-act .fz-btn{min-height:36px;padding:0 14px;font-size:14px;white-space:nowrap}.ag-act .fz-btn.act{background:var(--accent);color:var(--on-accent,#111)!important}.ag-act .fz-tlink{font-size:13px;color:var(--muted);font-weight:500}.ag-more details > .fz-tablebox, .ag-more details > div{margin-top:12px}';
