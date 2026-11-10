// Flowzyn Agents app v3 (design approved by Matt, Nov 8 2026).
// Four tabs: Today, Tasks, Agents, Connect. One task list shared by Tasks and every agent page: each task is built once
// from the agent's own board (same data, same drafts), so done in one place clears both.
(function () {
  'use strict';
  const FZ = window.FZ;
  const ui = FZ.ui, fmt = FZ.fmt, h = ui.h;
  const V = {};
  FZ.v3 = V;
  // Rolled back (Matt, Nov 10): only the Connect screen uses this file, so no global v3 class.

  // ---------- The 14 agents, in the order the owner sees them ----------
  const LIST = [
    ['win', 'The work', ['where-to-find-work', 'builder-engine', 'partner-finder', 'local-search-check', 'lost-quote-revival']],
    ['run', 'The office', ['morning-brief', 'lead-catcher', 'quotes', 'quote-chaser', 'install-scheduler', 'bill-it', 'get-paid']],
    ['keep', 'The customers', ['review-ask', 'come-back']]
  ];
  const KEYS = LIST.flatMap((g) => g[2]);
  const GROUP = {}; LIST.forEach(([g, , ks]) => ks.forEach((k) => { GROUP[k] = g; }));
  const TAG = { win: 'Win', run: 'Run', keep: 'Keep' };
  // Line under each name on the Agents tab.
  const LINE = { 'where-to-find-work': 'Flyer drops ready', 'builder-engine': 'Builders who replied', 'partner-finder': 'Partners found near you', 'local-search-check': 'Fixes that move you up', 'lost-quote-revival': 'Quotes 2 to 12 months quiet',
    'morning-brief': 'Your morning brief', 'lead-catcher': 'Enquiries waiting', 'quotes': 'Measured jobs to quote', 'quote-chaser': 'Open quotes', 'install-scheduler': 'Yes to install day', 'bill-it': 'Finished, not invoiced', 'get-paid': 'Overdue',
    'review-ask': 'Paid in the last 30 days', 'come-back': 'Past clients due back' };
  // What each agent reads, shown as chips on its page.
  const LOOKS = {
    'where-to-find-work': ['Public property records', 'Zillow recent sales', 'Short term rental licences', 'Your Jobber customers'],
    'builder-engine': ['County permit lists, nightly', 'Builders already in your Jobber', 'Replies in your Gmail'],
    'partner-finder': ['Google Maps listings', 'Their own websites', 'Your Jobber clients', 'Replies in your Gmail'],
    'local-search-check': ['Google Maps results', 'Your Google profile', 'Your other public listings'],
    'lost-quote-revival': ['Archived Jobber quotes, 2 to 12 months old'],
    'morning-brief': ['Jobber quotes', 'Jobs', 'Invoices', 'Enquiries', 'Visits'],
    'lead-catcher': ['New Jobber requests', 'Your website form, via Jobber', 'Enquiries in your Gmail'],
    'quotes': ['Measured Jobber requests', 'Similar past quotes', 'Your price book', 'Drawing photos you add'],
    'quote-chaser': ['Jobber quotes waiting on the customer', 'When they opened them'],
    'install-scheduler': ['Approved Jobber quotes', 'Jobs with no visit', 'Quote line items', 'Supplier replies in Gmail', 'Your Jobber schedule'],
    'bill-it': ['Jobs Jobber marks as needing an invoice'],
    'get-paid': ['Jobber invoices past due or awaiting payment', 'Payments in QuickBooks'],
    'review-ask': ['Invoices paid in Jobber, last 30 days', 'Your Google review link'],
    'come-back': ['Jobber jobs finished 6 to 18 months ago', 'Newer jobs and quotes']
  };
  // Where the tap happens for each agent's tasks.
  const TAPGROUP = { 'bill-it': 'jobber', 'quotes': 'quote', 'local-search-check': 'google' };
  const GROUPS = [['send', 'Read and send'], ['quote', 'Quote it'], ['jobber', 'In Jobber'], ['google', 'On Google']];
  // The words on each task row.
  const VERB = { 'quote-chaser': 'Follow up', 'get-paid': 'Remind', 'lead-catcher': 'Reply to', 'review-ask': 'Review ask,', 'come-back': 'Check in with', 'lost-quote-revival': 'Win back', 'partner-finder': 'Intro to', 'builder-engine': 'Intro to', 'yes-to-install': 'Glass order,' };
  const nameOf = (k) => ((FZ.byKey(k) || {}).name || '').replace(/ Agent$/, '');
  const slug = (s) => String(s || '').replace(/[^A-Za-z0-9]+/g, '-').slice(-80);
  const short = (n) => fmt.money(n, { short: true });
  const done = (id) => { const d = (FZ.tasksNow().done || {})[id]; return !!(d && d.done); };
  const el = (tag, cls, ...kids) => h(tag, cls ? { class: cls } : null, ...kids);
  const btn = (label, on, cls) => { const b = h('button', { type: 'button', class: 'v3-btn' + (cls ? ' ' + cls : '') }, label); if (on) b.addEventListener('click', on); return b; };
  const linkBtn = (label, href, cls) => h('a', { class: 'v3-btn' + (cls ? ' ' + cls : ''), href, target: /^https?:/.test(href) ? '_blank' : null, rel: /^https?:/.test(href) ? 'noopener' : null }, label);
  const gt = (label, right, plain) => h('p', { class: 'v3-gt' + (plain ? ' plain' : '') }, label, right != null ? h('i', null, String(right)) : null);
  const parts = (p) => [].concat(p).map((x) => (x && typeof x === 'object' && !(x instanceof Node) && 'b' in x) ? h('b', null, x.b) : x);
  const head = (eyebrow, title, sub) => el('header', 'v3-head', eyebrow || null, h('h1', { class: 'v3-h1' }, ...parts(title)), sub ? h('p', { class: 'v3-sub' }, sub) : null);
  const stripDash = (s) => String(s == null ? '' : s).replace(/\s+[-–—]\s+/g, ', ').replace(/;/g, ',');

  // ---------- Running a board and catching what it lines up ----------
  function capCtx(key) {
    const cap = { key, cards: [], needs: [], heroes: [], drafts: [] };
    const hh = (...a) => h(...a); hh.__cap = cap;
    const u = Object.assign({}, ui, { h: hh,
      cards(items, o) { (items || []).forEach((it) => cap.cards.push(it)); return ui.cards(items, o); },
      draftButton(t, l, o) { cap.drafts.push({ text: t, label: l, o: o || {} }); return ui.draftButton(t, l, o); } });
    return { ctx: Object.assign({}, FZ.ctx, { ui: u, cap }), cap };
  }
  const RUNS = new Map();
  async function runBoard(key, fresh) {
    if (!fresh && RUNS.has(key)) return RUNS.get(key);
    const p = (async () => {
      const spec = FZ.BOARDS[key];
      const { ctx, cap } = capCtx(key);
      if (!spec) return { key, out: [], cap, err: null };
      try { const out = [].concat(await spec.render(ctx, FZ.byKey(key))).filter(Boolean); return { key, out, cap, err: null }; }
      catch (e) { console.error(key, e); return { key, out: [], cap, err: e }; }
    })();
    RUNS.set(key, p);
    return p;
  }
  V.clear = () => { RUNS.clear(); TASKS_P = null; MONEY_P = null; if (V.missed) V.missed.clear(); };

  // ---------- One task list ----------
  // A task: { id, agent (page), src (board), tap, who, title, amount, reason, draft {to, subject, body, clientId, template}, send(ob), link, actions, go }
  const isoOK = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').replace(/^.*<|>$/g, ''));
  function fromCards(res, page) {
    const out = [];
    res.cap.cards.forEach((it) => {
      if (!it) return;
      const src = res.key;
      if (it.draft && !it.draftCall && !it.draftHead) {
        const id = 'send-' + slug(it.queueId || it.link || it.who);
        out.push({ id, agent: page, src, tap: TAPGROUP[page] || 'send', who: it.who, title: (VERB[src] ? VERB[src] + ' ' : '') + it.who, amount: typeof it.amount === 'number' ? it.amount : null, reason: stripDash(it.when || it.why || ''), why: stripDash(it.why || ''),
          link: it.link || null, draft: { to: it.draftTo || '', subject: it.draftSubject || '', body: it.draft, clientId: it.clientId || null, template: it.template || null } });
      } else if (it.approve && src === 'bill-it') {
        const id = 'ok-' + slug(it.queueId || it.link || it.who);
        out.push({ id, agent: page, src, tap: 'jobber', who: it.who, title: 'Invoice ' + it.who, amount: it.amount, reason: stripDash(it.why + ' ' + (it.when || '')), link: it.link, linkLabel: 'Invoice it', jobberNote: 'Opens the job in Jobber. Press Create Invoice, then Send.' });
      }
    });
    return out;
  }
  async function buildTasks(fresh) {
    const keys = KEYS.filter((k) => k !== 'morning-brief' && k !== 'where-to-find-work').concat(['yes-to-install']);
    const runs = await Promise.all(keys.map((k) => runBoard(k, fresh)));
    const all = [];
    runs.forEach((res) => {
      const page = res.key === 'yes-to-install' ? 'install-scheduler' : res.key;
      if (res.key === 'quotes') return all.push(...quoteTasks(res));
      if (res.key === 'local-search-check') return all.push(...fixTasks(res));
      if (res.key === 'install-scheduler') return all.push(...installTasks(res));
      if (res.key === 'builder-engine') return all.push(...builderTasks(res));
      all.push(...fromCards(res, page));
      if (res.key === 'yes-to-install') all.push(...convertTasks(res));
    });
    const seen = new Set();
    // A review ask needs the shop's own review link. Until it is saved in Connect, none go on Tasks.
    const hasLink = !!String((FZ.profile() || {}).reviewLink || '').trim();
    return all.filter((t) => (seen.has(t.id) ? false : seen.add(t.id))).filter((t) => hasLink || t.src !== 'review-ask');
  }
  function builderTasks(res) {
    return res.cap.drafts.filter((d) => d.o && d.o.onQueue && !d.o.queued).map((d) => {
      const m = /^Hello (.+?) team/.exec(d.text || ''); const who = m ? m[1] : (d.o.subject || 'Builder');
      return { id: 'be-' + slug(who), agent: 'builder-engine', src: 'builder-engine', tap: 'send', who, title: 'Intro to ' + who, amount: null, reason: stripDash(d.o.subject || ''), noJobber: true,
        draft: { to: d.o.to || '', subject: d.o.subject || '', body: d.text, template: 'Builder intro' }, send: (ob) => d.o.onQueue(ob) };
    });
  }
  function convertTasks(res) {
    return res.cap.cards.filter((it) => it && /Not a job yet/.test(it.when || '')).map((it) => ({ id: 'cv-' + slug(it.link || it.who), agent: 'install-scheduler', src: 'yes-to-install', tap: 'jobber', who: it.who, title: 'Convert ' + it.who + '’s quote to a job', amount: it.amount, reason: 'Said yes ' + String(it.when || '').split(' · ')[0].replace(/^Yes /, '').trim(), link: it.link, linkLabel: 'Open in Jobber', jobberNote: 'Agents can’t make jobs yet. Press Convert to Job in Jobber.' }));
  }
  function installTasks(res) {
    const s = res.cap.sched; if (!s) return [];
    const out = [];
    s.rows.forEach((r) => {
      if (r.stage === 'dated') {
        const two = s.freeDays(r.p.delivery, 2);
        out.push({ id: 'is-ask-' + slug(r.j.id), agent: 'install-scheduler', src: 'install-scheduler', tap: 'send', who: r.who, title: 'Ask ' + s.nm(r) + ' which day', amount: r.total, reason: 'Glass lands ' + s.nice(r.p.delivery) + '. Free: ' + two.map(s.short).join(' or '),
          link: r.j.jobberWebUri, draft: { to: '', subject: 'Your install day', body: s.askText(r, two), clientId: r.j.client && r.j.client.id },
          send: async (ob) => (await FZ.queueSend('is-ask-' + slug(r.j.id), Object.assign({ who: r.who, link: r.j.jobberWebUri }, ob))) && s.save(r, { askedAt: new Date().toISOString(), offered: two }) });
      } else if (r.stage === 'asked') {
        const offered = (r.p.offered || []).filter(Boolean);
        const acts = offered.map((day) => btn(s.short(day), async (e) => { e.currentTarget.disabled = true; await s.save(r, { picked: day }); V.refreshSoon(); }));
        out.push({ id: 'is-pick-' + slug(r.j.id), agent: 'install-scheduler', src: 'install-scheduler', tap: 'jobber', who: r.who, title: 'Which day did ' + s.nm(r) + ' pick?', amount: r.total, reason: r.noAnswer ? 'Asked ' + fmt.plural(fmt.daysSince(r.p.askedAt), 'day') + ' ago, no answer yet' : 'You offered ' + offered.map(s.short).join(' or '), actions: acts, link: r.j.jobberWebUri });
      } else if (r.stage === 'picked' && !r.p.setAt) {
        out.push({ id: 'is-set-' + slug(r.j.id), agent: 'install-scheduler', src: 'install-scheduler', tap: 'jobber', who: r.who, title: 'Put ' + s.nice(r.p.picked) + ' in Jobber', amount: r.total, reason: s.nm(r) + ' picked it. Add the visit so the crew sees it', link: r.j.jobberWebUri, linkLabel: 'Open in Jobber', jobberNote: 'Agents can’t make visits yet. Add the visit in Jobber.' });
      }
    });
    return out;
  }
  function quoteTasks(res) {
    return (res.cap.quotes || []).map((x) => ({ id: 'q-' + slug(x.r.id), agent: 'quotes', src: 'quote-prep', tap: 'quote', who: x.who, title: 'Quote ' + x.who, amount: x.lines && x.lines.length ? x.total : null,
      reason: stripDash(fmt.clean(x.ask).replace(/[.\s]+$/, '') + ' · ' + (x.why || 'Measured').toLowerCase() + ' ' + (x.days ? fmt.plural(x.days, 'day') + ' ago' : 'today')), go: '#a-quotes', goLabel: 'Check', link: x.r.jobberWebUri }));
  }
  function fixTasks(res) {
    const n = res.cap.needs[0]; if (!n) return [];
    return (n.items || []).filter((it) => !/done$/.test(String([].concat(it.meta).map((m) => (m && m.b) || m).join('')))).map((it, i) => ({ id: 'fix-task-' + i, agent: 'local-search-check', src: 'local-search-check', tap: 'google', who: it.title, title: it.title,
      reason: stripDash([].concat(it.meta).map((m) => (m && m.b) || m).join('').replace(/^Fix \d+ · /, 'Words written · ')), detail: it.detail, actions: (it.actions || []).filter(Boolean) }));
  }
  let TASKS_P = null;
  V.tasks0 = (fresh) => { if (fresh || !TASKS_P) TASKS_P = buildTasks(fresh).then((l) => { V._last = l; return l; }); return TASKS_P; };
  const autoOn = (t) => t.tap === 'send' && FZ.auto && FZ.auto.on(t.src);
  V.open = (list) => (list || []).filter((t) => !done(t.id) && !autoOn(t));
  const byBig = (a, b) => (b.amount || 0) - (a.amount || 0);

  // ---------- The money path: the one money total for the email, Today, Tasks and Plan Today ----------
  let MONEY_P = null;
  // One Jobber read that can't take the page down: it tries again once, then counts as empty and is noted.
  V.missed = new Set();
  // Jobber turns some reads away when many arrive at once. Wait and ask again, up to 3 more times, before giving up.
  const soft = (what, fn) => { const go = (n) => fn().catch((e) => n >= 3 ? Promise.reject(e) : new Promise((r) => setTimeout(r, [1500, 4000, 8000][n])).then(() => go(n + 1))); return go(0).catch(() => { V.missed.add(what); return []; }); };
  V.money = () => MONEY_P || (MONEY_P = (async () => {
    const c = FZ.ctx;
    const [waiting, approved, unscheduled, toBill, overdue] = await Promise.all([
      soft('quotes', () => c.jobberAll('search_quotes', { status: 'awaiting_response', limit: 100 }, 'quotes', 300)),
      soft('quotes', () => c.jobberAll('search_quotes', { status: 'approved', limit: 100 }, 'quotes', 200)),
      soft('jobs', () => c.jobberAll('search_jobs', { status: 'unscheduled', limit: 50 }, 'jobs', 150)),
      soft('jobs', () => c.jobberAll('search_jobs', { status: 'requires_invoicing', limit: 50 }, 'jobs', 150)),
      // Same rule as Collect Payments: past due in Jobber, or awaiting payment with the due date gone by.
      Promise.all(['past_due', 'awaiting_payment', 'sent_not_due'].map((st) => soft('invoices', () => c.jobberAll('search_invoices', { status: st, limit: 50 }, 'invoices', 150))))
        .then((sets) => { const seen = new Set(); return [].concat(...sets).filter((v) => { if (!v || seen.has(v.id)) return false; seen.add(v.id); const late = fmt.daysSince(v.dueDate); return Number(v.balance) > 0 && (v.status === 'past_due' || (late != null && late > 0)); }); })]);
    const nm = (x) => fmt.clean(x && x.client && x.client.name) || 'Customer';
    // Same window as Chase Quotes: past Jobber's day 5 reminder, sent in the last 90 days.
    const chase = waiting.filter((q) => { const d = fmt.daysSince(q.sentAt || q.createdAt) || 0; return d > 5 && FZ.inChase(q, d, 90); });
    const steps = [
      { key: 'quote-chaser', label: 'No answer', items: chase.map((q) => ({ who: nm(q) + ' · quote #' + q.quoteNumber, v: Number(q.total) || 0, note: 'sent ' + fmt.plural(fmt.daysSince(q.sentAt || q.createdAt), 'day') + ' ago', link: q.jobberWebUri })) },
      { key: 'install-scheduler', label: 'Not booked', items: [...approved.map((q) => ({ who: nm(q) + ' · quote #' + q.quoteNumber, v: Number(q.total) || 0, note: 'said yes ' + fmt.fmtDate(q.approvedAt || q.updatedAt), link: q.jobberWebUri })), ...unscheduled.map((j) => ({ who: nm(j) + ' · job #' + j.jobNumber, v: Number(j.total) || 0, note: 'no install day yet', link: j.jobberWebUri }))] },
      { key: 'bill-it', label: 'Not invoiced', items: toBill.map((j) => ({ who: nm(j) + ' · job #' + j.jobNumber, v: Number(j.total) || 0, note: j.completedAt ? 'finished ' + fmt.fmtDate(j.completedAt) : '', link: j.jobberWebUri })) },
      { key: 'get-paid', label: 'Past due', items: overdue.map((v) => ({ who: nm(v) + ' · invoice #' + v.invoiceNumber, v: Number(v.balance) || 0, note: 'due ' + fmt.fmtDate(v.dueDate), link: v.jobberWebUri })) }];
    steps.forEach((s) => { s.items.sort((a, b) => b.v - a.v); s.dollars = s.items.reduce((n, x) => n + x.v, 0); s.n = s.items.length; });
    return { steps, total: steps.reduce((n, s) => n + s.dollars, 0) };
  })());

  // Minutes for a normal list: about 1 for an email, 2 for anything in Jobber or on Google.
  const minutes = (list) => Math.max(1, Math.round(list.reduce((n, t) => n + (t.tap === 'send' ? 0.5 : t.tap === 'quote' ? 1.5 : 2), 0)));

  // ---------- A task row and its open state ----------
  function mailBox(t, onDone) {
    const d = t.draft;
    const to = h('input', { type: 'email', value: d.to || '', placeholder: 'name@company.com', 'aria-label': 'To' });
    if (!d.to && d.clientId && FZ.clientEmail) FZ.clientEmail(d.clientId).then((e) => { if (e && !to.value) to.value = e; });
    const sub = h('input', { type: 'text', value: d.subject || '', 'aria-label': 'Subject' });
    const ta = h('textarea', { 'aria-label': 'Email to ' + t.who }); ta.value = d.body || '';
    const fit = () => { ta.style.height = 'auto'; ta.style.height = (ta.scrollHeight + 2) + 'px'; };
    ta.addEventListener('input', fit); requestAnimationFrame(() => requestAnimationFrame(fit));
    const msg = h('p', { class: 'v3-msg', role: 'status' });
    // A glass order with no supplier address yet: say where it gets saved, once, instead of a blank To.
    if (!d.to && t.src === 'yes-to-install') msg.textContent = 'Save your glass supplier\u2019s order email in Connect, Shop details, and it fills in here every time.';
    const ok = btn('Approve and send', async () => {
      const addr = to.value.trim();
      if (!isoOK(addr)) { msg.textContent = 'Add the email address it goes to first.'; to.focus(); return; }
      ok.disabled = no.disabled = true; msg.textContent = 'Approving…';
      const ob = { to: addr, subject: sub.value.trim(), body: ta.value, who: t.who, link: t.link || null, agent: t.src };
      const sent = t.send ? await t.send(ob) : await FZ.queueSend(t.id, ob);
      if (sent) { if (t.send) await FZ.markDone(t.id, { outbox: Object.assign({ queuedAt: new Date().toISOString() }, ob) }); box.replaceChildren(h('p', { class: 'v3-ok' }, 'Approved. It goes out from your email on the next run.')); if (onDone) onDone(); }
      else { ok.disabled = no.disabled = false; msg.textContent = 'Could not save here. Try again.'; }
    });
    const no = btn('Already handled', async () => {
      no.disabled = ok.disabled = true;
      if (await FZ.markDone(t.id, { handled: true })) { box.replaceChildren(h('p', { class: 'v3-calm' }, 'Marked as handled. Nothing was sent.')); if (onDone) onDone(); } else no.disabled = ok.disabled = false;
    }, 'q');
    const tplLine = d.template ? h('p', { class: 'from' }, 'From your ', h('b', null, d.template), ' template · ', h('a', { href: '#templates' }, 'edit it in Connect')) : null;
    const box = el('div', 'v3-mail',
      h('label', { class: 'f' }, h('span', null, 'To'), to),
      h('label', { class: 'f' }, h('span', null, 'Subject'), sub),
      ta, tplLine,
      el('div', 'v3-btns', ok, no), msg,
      t.link && !t.noJobber && /getjobber/.test(t.link) ? el('p', 'v3-center', h('a', { class: 'v3-link', href: t.link, target: '_blank', rel: 'noopener' }, 'Open in Jobber')) : null);
    return box;
  }
  function openBody(t, onDone) {
    if (t.draft) return mailBox(t, onDone);
    const msg = h('p', { class: 'v3-msg', role: 'status' });
    const markDone = btn('Mark done', async (e) => { e.currentTarget.disabled = true; if (await FZ.markDone(t.id, {})) { msg.textContent = 'Off your list.'; if (onDone) onDone(); } else e.currentTarget.disabled = false; }, 'q');
    const acts = (t.actions || []).map((a) => { if (a && a.classList) { a.classList.add('v3-btn'); if (/^(Mark done|Done)$/.test(a.textContent.trim()) || /opbtn/.test(a.className)) a.classList.add('q'); } return a; });
    const hasMark = acts.some((a) => a && /Mark done|^Done$/.test(a.textContent || ''));
    return el('div', 'v3-open',
      t.detail ? h('p', { class: 'v3-calm' }, stripDash(t.detail)) : null,
      t.jobberNote ? h('p', { class: 'v3-calm' }, t.jobberNote) : null,
      el('div', 'acts', ...acts, t.link && !acts.length ? linkBtn(t.linkLabel || 'Open in Jobber', t.link) : null, hasMark ? null : markDone), msg);
  }
  // Compact row: agent name small above, what, money or reason, one button.
  function taskRow(t, opts) {
    opts = opts || {};
    const amt = t.amount ? h('span', { class: 'm' }, fmt.money(t.amount)) : null;
    const row = el('div', 'v3-row', el('div', 't', opts.noAgent ? null : h('span', { class: 'ag' }, nameOf(t.agent)), h('b', null, t.title), h('span', null, amt, amt && t.reason ? ' · ' : '', t.reason)));
    const wrap = el('div', 'v3-trow', row);
    let open = null;
    const toggle = () => { if (open) { open.remove(); open = null; b.textContent = label; return; } open = openBody(t, () => { wrap.classList.add('done'); b.disabled = true; b.textContent = 'Done'; FZ.paintCount && FZ.paintCount(); }); wrap.append(open); b.textContent = 'Close'; };
    const label = t.go ? (t.goLabel || 'Check') : t.draft ? 'Read' : t.tap === 'jobber' && t.link && !t.actions ? (t.linkLabel === 'Invoice it' ? 'Invoice it' : 'Open') : 'Read';
    const b = t.go ? linkBtn(label, t.go) : t.tap === 'jobber' && t.link && !t.actions && !t.jobberNote ? linkBtn(label, t.link) : btn(label, toggle);
    row.append(b);
    if (opts.openFirst && (t.draft || t.actions)) toggle();
    return wrap;
  }
  // The first task with its email open, the way it shows on an agent page.
  function taskCard(t) {
    const amt = t.amount ? fmt.money(t.amount) : null;
    const meta = [amt, t.reason].filter(Boolean).join(' · ');
    const card = el('article', 'v3-task', meta ? h('p', { class: 'meta' }, meta) : null, h('p', { class: 'who' }, t.who), t.why && t.why !== t.reason ? h('p', { class: 'why' }, t.why) : null);
    card.append(openBody(t, () => card.classList.add('done')));
    return card;
  }

  // ---------- Shell ----------
  V.paintNav = () => {
    const tabs = document.querySelector('.apptabs'); if (!tabs) return;
    tabs.querySelectorAll('[data-view="fz-overview"]').forEach((a) => { a.textContent = 'Today'; a.setAttribute('href', '#today'); });
    tabs.querySelectorAll('[data-view="fz-operator"], [data-view="fz-plan"]').forEach((a) => { a.hidden = true; a.style.display = 'none'; });
  };
  V.count = async () => { try { const list = V.open(await V.tasks0()); return list.length; } catch (e) { return 0; } };
  FZ.paintCount = async () => {
    const n = await V.count();
    const tc = document.getElementById('tab-taskcount'); if (tc) { tc.textContent = n > 99 ? '99+' : String(n); tc.hidden = !n; }
  };
  V.refreshSoon = () => { clearTimeout(V._rt); V._rt = setTimeout(() => { V.clear(); FZ.rerouteV3 && FZ.rerouteV3(); FZ.paintCount(); }, 300); };
  const foot = (text) => h('p', { class: 'v3-foot' }, text, ' · ', h('a', { href: FZ.opUrl ? FZ.opUrl('Question from the agents app') : '#operator', target: '_blank', rel: 'noopener' }, 'Ask your Operator'));
  const loading = (box, what) => box.replaceChildren(h('p', { class: 'fz-loading' }, what || 'Reading Jobber…'));

  // ---------- Today ----------
  V.today = async (box, quiet) => {
    if (!quiet) { loading(box); box.__tries = 0; }
    const c = FZ.ctx;
    const after = fmt.isoDaysAgo(185);
    const [money, tasks, invoices, quotes, visits, goalDoc] = await Promise.all([
      V.money(), V.tasks0(),
      soft('invoices', () => c.jobberAll('search_invoices', { issuedDate: { after }, limit: 50 }, 'invoices', 600)),
      soft('quotes', () => c.jobberAll('search_quotes', { dateRange: { after }, sort: 'createdAt', limit: 100 }, 'quotes', 600)),
      soft('visits', () => c.jobberAll('search_visits', { status: 'upcoming', sort: 'startAt', limit: 50 }, 'visits', 100)),
      c.store('settings/goals').catch(() => null)]);
    const open = V.open(tasks);
    const monthKey = (iso) => fmt.dayKey(iso).slice(0, 7);
    const now = new Date();
    const months = []; for (let i = 3; i >= 1; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 15); months.push(d.toISOString().slice(0, 7)); }
    const thisMonth = monthKey(now.toISOString());
    const issued = invoices.filter((v) => v.issuedDate && !['draft', 'voided'].includes(v.status));
    const inv3 = issued.filter((v) => months.includes(monthKey(v.issuedDate)));
    const perMonth = inv3.reduce((n, v) => n + (Number(v.total) || 0), 0) / 3;
    const goal = (goalDoc && Number(goalDoc.monthlyRevenue)) || 0;
    const sent = quotes.filter((q) => q.sentAt);
    const sent3 = sent.filter((q) => months.includes(monthKey(q.sentAt)));
    const won3 = sent3.filter((q) => ['approved', 'converted'].includes(q.status));
    const winRate = sent3.length ? won3.length / sent3.length : 0;
    const avgInv = inv3.length ? perMonth * 3 / inv3.length : 0;
    const invNeed = goal && avgInv ? Math.ceil(goal / avgInv) : 0;
    const invPer = Math.round(inv3.length / 3);
    const qNeed = invNeed && winRate ? Math.ceil(invNeed / winRate) : 0;
    const qSent = sent.filter((q) => monthKey(q.sentAt) === thisMonth).length;
    const overdue = money.steps[3];
    const pct = goal ? perMonth / goal : 0;

    const out = [];
    const noInv = V.missed.has('invoices');
    out.push(head(null, perMonth > 0 ? [{ b: short(perMonth) }, ' invoiced a month.'] : noInv ? ['Jobber didn’t send your invoices just now.'] : ['No invoices in the last 3 months.'],
      perMonth > 0 ? 'Average of the last 3 full months' + (goal ? '. Goal ' + short(goal) + '.' : '.') : noInv ? 'Press Refresh at the top in a minute. Everything else below is live.' : 'Invoices show here as you send them in Jobber.'));
    // One row to Tasks.
    out.push(el('section', 'v3-card', el('div', 'v3-need',
      el('div', 't', h('b', null, open.length ? [h('i', null, String(open.length)), open.length === 1 ? ' task needs you' : ' tasks need you'] : 'Nothing needs you right now'),
        h('span', null, open.length ? short(money.total) + ' waiting · about ' + minutes(open) + ' min' : 'Your agents have the rest.')),
      open.length ? linkBtn('Open tasks', '#tasks') : null)));
    // Your goal.
    const lever = (title, sub, pic) => el('div', 'v3-row v3-lever', el('div', 't', h('b', null, title), h('span', null, sub)), pic || null);
    const units = (n, on) => { const box2 = el('div', 'v3-units'); const all = Math.min(16, Math.max(n, on)); for (let i = 0; i < all; i++) box2.append(h('i', { class: i < Math.min(on, all) ? 'on' : '' })); return box2; };
    const qLeft = Math.max(0, qNeed - qSent);
    const goalCard = (el('section', 'v3-card',
      h('p', { class: 'v3-eb' }, 'Your goal'),
      goal ? [el('div', 'v3-pace', h('span', { class: 'f', style: 'width:' + Math.min(100, Math.round(pct * 100)) + '%' }), h('span', { class: 'mk', style: 'left:' + Math.min(99, Math.round(pct * 100)) + '%' })),
        el('div', 'v3-lab', h('span', null, '$0'), h('span', null, Math.round(pct * 100) + '% of ' + short(goal)), h('span', null, short(goal))),
        h('p', { class: 'v3-gt plain', style: 'margin-top:26px' }, 'How you get there'),
        el('div', 'v3-rows',
          lever(qNeed ? (qLeft ? 'Send ' + qLeft + ' more ' + (qLeft === 1 ? 'quote' : 'quotes') : 'Quotes on pace') : 'Send quotes', qNeed ? qSent + ' of ' + qNeed + ' sent this month' : (V.missed.has('quotes') || V.missed.has('invoices') ? 'Shows once Jobber answers' : 'No quotes sent in the last 3 months'), qNeed ? units(qNeed, qSent) : null),
          lever(noInv ? 'Invoices' : invNeed > invPer ? 'Invoice ' + (invNeed - invPer) + ' more ' + (invNeed - invPer === 1 ? 'job' : 'jobs') + ' a month' : 'Invoices on pace', noInv ? 'Shows once Jobber answers' : invPer + ' of ' + invNeed + ' a month', invNeed ? units(invNeed, invPer) : null),
          overdue.dollars ? lever('Collect ' + short(overdue.dollars) + ' overdue', fmt.plural(overdue.n, 'invoice') + ', reminders written', null) : null)]
        : h('p', { class: 'v3-calm' }, 'Set a monthly goal and every agent works toward it.'),
      h('p', { class: 'v3-note' }, goal ? 'Change your goal in ' : 'Set it in ', h('a', { href: '#shop-goal' }, 'Connect'), '.')));
    // Money path.
    const hasMoney = money.total > 0;
    const big = money.steps.reduce((a, b) => (b.dollars > a.dollars ? b : a), money.steps[0]);
    const maxD = Math.max(1, ...money.steps.map((s) => s.dollars));
    const mrows = el('div', 'v3-money');
    money.steps.filter((s) => s.dollars > 0).forEach((s) => {
      const b2 = h('button', { type: 'button', class: s === big ? 'hi' : '', 'aria-expanded': 'false' }, h('span', { class: 'l' }, s.label + ' · ' + s.n), h('span', { class: 'b', style: 'width:' + Math.max(3, s.dollars / maxD * 100) + '%' }), h('span', { class: 'v' }, short(s.dollars)));
      let list = null;
      b2.addEventListener('click', () => { if (list) { list.remove(); list = null; b2.setAttribute('aria-expanded', 'false'); return; } list = h('ul', { class: 'v3-money-items' }, s.items.slice(0, 8).map((x) => h('li', null, x.link ? ui.extLink(x.link, x.who) : x.who, h('span', null, fmt.money(x.v) + (x.note ? ' · ' + x.note : ''))))); b2.after(list); b2.setAttribute('aria-expanded', 'true'); });
      mrows.append(b2);
    });
    const BIGT = { 'quote-chaser': 'quotes with no answer', 'install-scheduler': 'yeses not booked', 'bill-it': 'finished work not invoiced', 'get-paid': 'invoices past due' };
    out.push(el('div', 'v3-pair', goalCard, el('section', 'v3-card', h('p', { class: 'v3-eb' }, 'Money path'),
      hasMoney ? [h('h3', null, 'Most is ' + BIGT[big.key]), mrows, h('p', { class: 'v3-note' }, 'Tap a row to see who.')] : h('p', { class: 'v3-calm' }, 'Nothing is stuck between quote and paid.'))));
    // This week: Mon to Fri, Saturday as a line under it.
    const dayK = (d) => fmt.dayKey(d.toISOString());
    const todayD = new Date();
    const dow = Number(new Date(fmt.dayKey(todayD.toISOString()) + 'T12:00:00Z').getUTCDay());
    const monday = new Date(Date.now() - ((dow + 6) % 7) * 86400000 + (dow === 6 || dow === 0 ? 7 * 86400000 : 0));
    const days = Array.from({ length: 6 }, (_, i) => dayK(new Date(monday.getTime() + i * 86400000)));
    const vis = visits.map((v) => ({ v, d: fmt.dayKey(v.startAt) })).filter((x) => days.includes(x.d));
    const who = (v) => fmt.clean(String(v.title || '').split(' - ')[0]);
    const whoShort = (v) => { const p = who(v).split(/\s+/); return p.length > 1 && !/\b(llc|inc|homes|group|construction)\b/i.test(who(v)) ? p[0].charAt(0) + '. ' + p[p.length - 1] : who(v); };
    const crew = (v) => (v.assignedUsers || []).map((u) => fmt.clean(u.name).split(' ')[0]).slice(0, 2).join(', ');
    const chip = (x) => h(x.v.job ? 'a' : 'span', { class: 'v3-wchip', href: x.v.job ? x.v.job.jobberWebUri : null, target: '_blank', rel: 'noopener', title: who(x.v) }, whoShort(x.v), crew(x.v) ? h('small', null, crew(x.v)) : null);
    const wk = el('div', 'v3-week', ...days.slice(0, 5).map((d) => el('div', d === fmt.dayKey(todayD.toISOString()) ? 'today' : null, h('h5', null, new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })), ...vis.filter((x) => x.d === d).map(chip))));
    const sat = vis.filter((x) => x.d === days[5]);
    out.push(el('section', 'v3-card', h('p', { class: 'v3-eb' }, 'This week'),
      h('h3', null, vis.length ? fmt.plural(vis.length, 'booked job') : 'No jobs booked this week'), vis.length ? wk : h('p', { class: 'v3-calm' }, 'Booked visits in Jobber show here, Monday to Friday.'),
      sat.length ? h('p', { class: 'v3-sat' }, 'Sat: ' + sat.map((x) => who(x.v)).join(', ')) : null));
    out.push(foot('Jobber, live' + (FZ.runs && FZ.runs['morning-brief'] && FZ.runs['morning-brief'].last ? ' · updated ' + fmt.fmtTime(FZ.runs['morning-brief'].last) : '')));
    const missNote = [...V.missed].filter((x) => !(x === 'invoices' && noInv));
    // Missing reads: try again quietly in the background. Only after that, a plain note with what to do.
    if (missNote.length && (box.__tries || 0) < 2) {
      box.__tries = (box.__tries || 0) + 1;
      out.unshift(h('p', { class: 'v3-note v3-missed' }, 'Still loading ' + missNote.join(' and ') + ' from Jobber.'));
      setTimeout(() => { if (!box.isConnected) return; V.missed.clear(); MONEY_P = null; V.today(box, true); }, 6000);
    } else if (missNote.length) {
      out.unshift(h('p', { class: 'v3-note v3-missed' }, 'Jobber is busy, so ' + missNote.join(' and ') + ' didn’t load. Those numbers fill in on the next refresh. ', h('a', { href: '#', onclick: (e) => { e.preventDefault(); const r = document.querySelector('[aria-label="Refresh from Jobber"]'); if (r) r.click(); else location.reload(); } }, 'Refresh now'), '. If it keeps happening, check Jobber shows Connected in ', h('a', { href: '#connect' }, 'Connect'), '.'));
    }
    box.replaceChildren(el('div', 'v3p', ...out));
    FZ.paintCount();
  };

  // ---------- Tasks ----------
  let FILT = 'all';
  V.tasksView = async (box) => {
    loading(box, 'Getting your tasks from every agent…');
    const [all, money] = await Promise.all([V.tasks0(), V.money()]);
    const open = V.open(all).sort(byBig);
    const n = (g) => open.filter((t) => g === 'all' || GROUP[t.agent] === g).length;
    const paint = () => {
      const shown = open.filter((t) => FILT === 'all' || GROUP[t.agent] === FILT);
      const filt = el('div', 'v3-filt', ...[['all', 'All'], ['win', 'Win'], ['run', 'Run'], ['keep', 'Keep']].map(([k, l]) => { const b2 = h('button', { type: 'button', 'aria-pressed': String(FILT === k) }, l + ' ' + n(k)); b2.addEventListener('click', () => { FILT = k; paint(); }); return b2; }));
      const groups = GROUPS.map(([g, label]) => {
        const list = shown.filter((t) => t.tap === g); if (!list.length) return null;
        const first = list.slice(0, 5), rest = list.slice(5);
        const rows = el('div', 'v3-rows', ...first.map((t) => taskRow(t)));
        const more = rest.length ? h('button', { type: 'button', class: 'v3-link' }, rest.length + ' more: ' + rest.slice(0, 3).map((t) => t.who).join(', ') + (rest.length > 3 ? ' and others' : '')) : null;
        if (more) more.addEventListener('click', () => { rest.forEach((t) => rows.append(taskRow(t))); more.remove(); });
        return el('section', null, gt(label, list.length), el('div', 'v3-card', rows, more ? h('p', { class: 'v3-more' }, more) : null));
      }).filter(Boolean);
      const autoN = (all || []).filter((t) => !done(t.id) && autoOn(t)).length;
      box.replaceChildren(el('div', 'v3p',
        head(null, open.length ? [{ b: String(open.length) }, ' need you. ' + short(money.total) + '.'] : ['Nothing needs you.'], open.length ? 'Every agent’s tasks in one list, biggest first.' : 'Your agents add tasks here as they find them.'),
        open.length ? filt : null,
        ...(groups.length ? groups : open.length ? [h('p', { class: 'v3-calm' }, 'Nothing in this group right now.')] : []),
        el('section', 'v3-card', el('div', 'v3-need', el('div', 't', h('b', null, autoN ? fmt.plural(autoN, 'email') + ' going out on their own' : 'Turn on auto approve'), h('span', null, autoN ? 'Auto approve is on for some agents. Change it in Connect.' : 'Agents send these without a tap each, under rules you set once.')), linkBtn('Connect', '#autoapprove'))),
        foot('Jobber, live')));
    };
    paint();
    FZ.paintCount();
  };

  // ---------- Agents list ----------
  const numOf = (res) => {
    if (res && PAGES[res.key] && PAGES[res.key].num) return PAGES[res.key].num(res);
    const st = res && res.out.find((n) => n.classList && n.classList.contains('fz-status'));
    const t = st ? (st.querySelector('.fz-status-h') || st).textContent : '';
    const m = t.match(/\$[\d.,]+[kM]?|\b\d+\b/);
    return /^(No|Nothing|Every)\b/.test(t.trim()) ? '0' : m ? m[0] : '';
  };
  V.agents = async (box) => {
    loading(box, 'Checking your agents…');
    const [tasks] = await Promise.all([V.tasks0()]);
    const open = V.open(tasks);
    const runs = await Promise.all(KEYS.map((k) => runBoard(k)));
    const R = {}; runs.forEach((r) => { R[r.key] = r; });
    V._yesN = yesJobs(await runBoard('yes-to-install')).length;
    const brief = (FZ.runs && FZ.runs['morning-brief'] && FZ.runs['morning-brief'].last) ? fmt.fmtTime(FZ.runs['morning-brief'].last) : '6:03am';
    const row = (k) => {
      const mine = open.filter((t) => t.agent === k).length;
      return h('a', { class: 'v3-row', href: '#a-' + k }, h('span', { class: 'v3-dot' }),
        el('div', 't', h('b', null, nameOf(k), mine ? h('span', { class: 'v3-for' }, mine + ' for you') : null), h('span', null, LINE[k])),
        h('span', { class: 'n' }, k === 'morning-brief' ? brief : numOf(R[k])));
    };
    box.replaceChildren(el('div', 'v3p',
      head(null, [{ b: KEYS.length + ' agents' }, ' working.'], 'Tap one to see what it found and why.'),
      ...LIST.map(([g, label, ks]) => el('section', null, h('p', { class: 'v3-gt' }, h('span', { class: 'v3-eb', style: 'margin:0' }, h('span', { class: 'tag ' + g }, TAG[g].toUpperCase()), label.toUpperCase())), el('div', 'v3-card v3-rows', ...ks.map(row)))),
      foot('Jobber, live')));
  };

  // ---------- One agent page, same order on every one ----------
  // 1 tag, name, headline, goal line  2 Looks at  3 Ready for you  4 Insights  5 How it picks  6 What it did today  7 can and can't, source
  V.page = async (key, body) => {
    const a = FZ.byKey(key);
    const g = GROUP[key];
    const tasksAll = await V.tasks0();
    const tasks = tasksAll.filter((t) => t.agent === key);
    const res = await runBoard(key, true);
    if (res.err) throw res.err;
    RUNS.delete(key); // the DOM below is used here; Tasks reads the board again when it needs to
    const extra = key === 'install-scheduler' ? await runBoard('yes-to-install', true) : null;
    if (extra) RUNS.delete('yes-to-install');
    const mine = V.open(tasks).sort(byBig);
    const out = res.out;
    const st = out.find((n) => n.classList && n.classList.contains('fz-status'));
    const P0 = PAGES[key] || {};
    const headTxt = P0.headline ? P0.headline({ res, extra }) : st ? [...(st.querySelector('.fz-status-h') || st).childNodes].map((n) => n.nodeName === 'B' ? { b: n.textContent } : n.textContent) : [a.name + '.'];
    const howLine = (out.find((n) => n.classList && n.classList.contains('ag-how')) || {}).textContent || FZ.GOALS[key] || a.outcome;
    const howBox = out.find((n) => n.matches && n.matches('details.fz-how'));
    const how = howBox ? [...howBox.querySelectorAll('p')].slice(0, 2).map((p) => stripDash(p.textContent)) : [];
    const hero = res.cap.heroes[0] || (extra && extra.cap.heroes[0]);
    const page = [];
    page.push(head(h('p', { class: 'v3-eb' }, h('span', { class: 'tag ' + g }, TAG[g].toUpperCase()), a.name.toUpperCase()), headTxt, stripDash(FZ.GOALS[key] || howLine)));
    page.push(el('div', 'v3-chips', h('span', { class: 'k' }, 'Looks at'), ...(LOOKS[key] || []).map((s) => h('span', { class: 'v3-chip' }, s))));
    // The agent's short explainer video, same player as before v3.
    if (FZ.videoSlot) page.push(el('div', 'v3-video', FZ.videoSlot(a)));
    const P = PAGES[key] || {};
    if (P.pre) await P.pre();
    if (P.note) page.push(h('p', { class: 'v3-warn' }, P.note));
    // Ready for you
    const ready = P.ready ? P.ready({ res, extra, mine, tasks }) : readyList(mine, P);
    page.push(el('section', null, gt(P.readyLabel || 'Ready for you', P.readyCount != null ? P.readyCount : (mine.length || null)), ready));
    // Insights
    const ins = P.insights ? P.insights({ res, extra, hero, out }) : insightsFrom(res, hero, out);
    if (ins && ins.length) page.push(el('section', null, gt('Insights'), el('div', 'v3-ins', ...ins)));
    if (P.after) page.push(...[].concat(P.after({ res, extra })).filter(Boolean));
    // How it picks: two lines, shown.
    if (how.length) page.push(el('section', 'v3-card v3-how', h('p', { class: 'v3-eb', style: 'color:var(--muted)' }, 'How it picks'), ...how.map((t) => h('p', null, t))));
    // What it did today
    const did = ((hero && hero.did) || []).filter((d) => d && d.done !== false).slice(0, 3);
    const extraDid = extra && extra.cap.heroes[0] ? (extra.cap.heroes[0].did || []).filter((d) => d && d.done !== false).slice(0, 2) : [];
    const didAll = (P.did ? P.did({ res, extra, did }) : did.concat(extraDid)).slice(0, 3);
    if (didAll.length) page.push(el('section', null, gt('What it did today'), el('div', 'v3-card v3-rows v3-did', ...didAll.map((d) => el('div', 'v3-row', el('div', 't', h('b', null, stripDash(d.t))), d.s ? h('span', { class: 's' }, stripDash(d.s)) : null)))));
    // Can and can't, folded
    const rp = FZ.rulesPanel ? FZ.rulesPanel(key) : null;
    if (rp) page.push(h('details', { class: 'v3-fold' }, h('summary', null, 'What it can and can’t do'), el('div', null, rp)));
    page.push(foot(stripDash((FZ.BOARDS[key] || {}).source || 'Jobber, live').replace(/\.$/, '')));
    body.replaceChildren(el('div', 'v3p', ...page));
    // Maps and charts draw once they are on the page.
    requestAnimationFrame(() => window.dispatchEvent(new Event('resize')));
    // Plain words on the buttons the boards made.
    const REN = { 'Copy the addresses': 'Copy list', 'Copy the flyer text': 'Copy flyer', 'Mark as done': 'Mark done', 'Copy the note': 'Copy note' };
    body.querySelectorAll('button, a.fz-btn').forEach((b) => { const t = b.textContent.trim(); if (REN[t]) b.textContent = REN[t]; });
  };
  function readyList(mine, P) {
    if (!mine.length) return el('div', 'v3-card', h('p', { class: 'v3-calm' }, P.calm || 'Nothing needs you right now. It is watching and writes the next one for your OK.'));
    const [first, ...rest] = mine;
    const restBox = rest.length ? el('div', 'v3-card v3-rows', ...rest.slice(0, 4).map((t) => taskRow(t, { noAgent: true }))) : null;
    return el('div', 'v3-stack', P.openFirst === false ? el('div', 'v3-card v3-rows', taskRow(first, { noAgent: true })) : taskCard(first), restBox, rest.length > 4 ? h('p', { class: 'v3-more' }, (rest.length - 4) + ' more: ' + rest.slice(4, 7).map((t) => t.who).join(', ') + ', same layout.') : null);
  }
  // Insights: the board's own picture, without the old Needs you and work lists.
  function insightsFrom(res, hero, out) {
    const keep = [];
    if (hero) {
      const title = [].concat(hero.title || []).map((p) => (p && typeof p === 'object' && 'b' in p) ? h('span', { class: 'v3-hl' }, p.b) : p);
      keep.push(el('section', 'v3-card', hero.tag ? h('span', { class: 'v3-ex' }, hero.tag) : null, h('h3', null, ...title), hero.sub ? h('p', { class: 'v3-note', style: 'margin:4px 0 16px' }, stripDash(hero.sub)) : null, hero.viz || null));
    }
    out.forEach((n) => {
      if (!n.matches) return;
      if (n.matches('.ag-hero') && !hero) { const v = n.querySelector('.ag-viz'), d = n.querySelector('.ag-did'); keep.push(el('section', 'v3-card', v ? [...v.childNodes] : null)); if (d) keep.push(el('section', 'v3-card', [...d.childNodes])); }
      if (n.matches('.fz-sec') && !n.querySelector('.fz-card, .fz-cards, textarea, input') && n.querySelector('.ls-comp, .fz-bars, .viz, svg, .be-stages')) keep.push(el('section', 'v3-card', [...n.childNodes]));
      if (n.matches('style')) keep.push(n);
    });
    return keep;
  }

  // ---------- Per agent pieces where the board needs more than the template ----------
  const PAGES = {
    'lead-catcher': { note: 'Not covered yet: texts and calls to your phone. Forward a text to Claude and it becomes a request.' },
    'local-search-check': { headline: ({ res }) => { const n = (res.cap.needs[0] || {}).items; return n && n.length ? [{ b: fmt.plural(n.length, 'fix', 'fixes') }, ' would move you up.'] : ['Checking ', { b: 'where you show up' }, '.']; }, note: 'It finds what to fix and writes it up. It can’t change your Google profile, so you make each fix on Google, then mark it done.', openFirst: true,
      ready: ({ mine }) => mine.length ? el('div', 'v3-stack', ...mine.map((t, i) => { const c = el('article', 'v3-task', h('p', { class: 'meta' }, 'Fix ' + (i + 1) + ' · ' + t.reason.replace(/^Words written · /, '')), h('p', { class: 'who' }, t.title)); c.append(openBody(t, () => c.classList.add('done'))); return c; })) : el('div', 'v3-card', h('p', { class: 'v3-calm' }, 'No fixes waiting. The next check is on the 1st.')) },
    'builder-engine': { note: null },
    'review-ask': { get note() { return String((FZ.profile() || {}).reviewLink || '').trim() ? null : h('span', null, 'Save your Google review link once in ', h('a', { href: '#shop-review' }, 'Connect'), ' and the asks below go on Tasks, each with your link.'); },
      ready: ({ mine, res }) => { if (String((FZ.profile() || {}).reviewLink || '').trim()) return readyList(mine, {}); const n = res.cap.cards.filter((c) => c && c.draft).length; return el('div', 'v3-card', el('div', 'v3-need', el('div', 't', h('b', null, n ? fmt.plural(n, 'review ask') + ' written' : 'No one to ask yet'), h('span', null, 'They wait for your review link, so no ask goes out with a blank.')), linkBtn('Add the link', '#shop-review'))); } },
    'where-to-find-work': { headline: ({ res }) => { const n = (res.cap.needs[0] || {}).items; return n && n.length ? [{ b: fmt.plural(n.length, 'way') }, ' to find new work.'] : ['Ranking the areas near you.']; }, readyLabel: 'Ways to find work, best first, not on Tasks',
      ready: ({ res }) => { const n = res.out.find((x) => x.matches && x.matches('.ag-need')); if (!n) return el('div', 'v3-card', h('p', { class: 'v3-calm' }, 'Ranking the areas near you.')); n.classList.add('v3-card'); const hd = n.querySelector(':scope > header'); if (hd) hd.remove(); return n; },
      insights: ({ res, out }) => out.filter((x) => x.matches && !x.matches('.ag-need, .fz-status, .ag-how, details.fz-how') && !x.classList.contains('do-box') && (x.matches('style') || x.textContent.trim() || x.querySelector('canvas, svg'))).map((x) => x.matches('style') ? x : el('section', 'v3-card', x)) },
    'morning-brief': { headline: () => { const n = V.open(V._last || []).length; return n ? [{ b: fmt.plural(n, 'task') }, ' in today’s brief.'] : ['Nothing needs you today.']; }, readyLabel: 'Ready for you · loose ends',
      ready: ({ res }) => { const le = res.out.find((x) => x.matches && x.matches('.fz-sec') && /Loose ends/.test(x.textContent)); if (!le) return el('div', 'v3-card', h('p', { class: 'v3-calm' }, 'No loose ends today. Everything else is on Tasks.')); le.classList.add('v3-card'); const h2 = le.querySelector('h2'); if (h2) h2.remove(); return le; },
      insights: ({ res, hero }) => {
        const keep = [el('section', 'v3-card', h('p', { class: 'v3-eb' }, 'Your brief this morning'), h('h3', null, FZ.runs && FZ.runs['morning-brief'] && FZ.runs['morning-brief'].last ? 'Sent at ' + fmt.fmtTime(FZ.runs['morning-brief'].last) : 'Comes at 6:03am on weekdays'), h('p', { class: 'v3-note' }, 'The email you get is this agent. Every task in it is on Tasks.'), el('div', 'v3-btns', linkBtn('See the email', '#brief', 'q')))];
        return keep.concat(insightsFrom(res, hero, []));
      } },
    'quotes': {
      ready: ({ res, mine }) => quotesReady(res, mine),
      pre: async () => { V._book = await FZ.act.priceBook(); },
      insights: ({ res }) => quotesInsights(res) },
    'install-scheduler': {
      num: () => String(V._yesN || 0),
      headline: ({ extra }) => { const n = yesJobs(extra).length; return n ? [{ b: fmt.plural(n, 'job') }, ' from yes to install.'] : ['Every yes has an install day.']; },
      ready: ({ mine, extra }) => readyList(mine, { calm: 'Nothing needs you. It is waiting on the supplier and reads the date from their reply.' }),
      after: () => null,
      insights: ({ res, extra }) => installInsights(res, extra) }
  };

  // Quote Jobs: the drafted quote with line items open, then the rest; price book and capture as insights.
  function quotesReady(res, mine) {
    const cards = []; res.out.forEach((n) => { if (n.querySelectorAll) n.querySelectorAll('[data-qg]').forEach((c) => cards.push(c)); });
    if (!cards.length) return el('div', 'v3-card', h('p', { class: 'v3-calm' }, 'Nothing waiting to quote. New measures show up here.'));
    const box = el('div', 'v3-stack');
    cards.forEach((c, i) => {
      c.classList.add('v3-task');
      c.querySelectorAll('button, a').forEach((b) => { const t = b.textContent.trim(); if (t === 'Read sizes from a photo') b.textContent = 'Read a photo'; if (t === 'Price from my formula') b.textContent = 'Use my formula'; if (/opbtn/.test(b.className)) { b.remove(); return; } if (b.matches('button.fz-btn, a.fz-btn')) { b.classList.add('v3-btn'); if (!/act/.test(b.className)) b.classList.add('q'); } });
      if (i > 0) { // folded: a compact row that opens the full card
        const t = mine[i] || {};
        const wrap = el('div', 'v3-card v3-rows');
        const r = el('div', 'v3-row', el('div', 't', h('b', null, (c.querySelector('.who') || {}).textContent || t.who || 'Quote'), h('span', null, t.amount ? h('span', { class: 'm' }, fmt.money(t.amount)) : null, t.amount ? ' · ' : '', t.reason || '')));
        const b2 = btn('Check', () => { wrap.replaceWith(c); });
        r.append(b2); wrap.append(r); box.append(wrap);
      } else box.append(c);
    });
    return box;
  }
  function quotesInsights(res) {
    const out = [];
    // The price book, shown not edited: what every quote is priced from, and what past quotes say. Changes live in Connect.
    const pane = (() => { let x = null; res.out.forEach((n) => { if (n.querySelectorAll && !x) x = n.querySelector('.fz-tabbody[data-id="pricing"]'); }); return x; })();
    const book = V._book || {};
    const learned = pane ? [...pane.querySelectorAll('p, h2, h3')].map((p) => p.textContent.trim()).filter((t) => /past quote|within \d+%/i.test(t) && t.length < 160).slice(0, 2) : [];
    out.push(el('section', 'v3-card', h('p', { class: 'v3-eb' }, 'Your price book'),
      h('h3', null, 'Shower all in: ', h('span', { class: 'v3-hl' }, '$' + (book.showerRate || 38) + ' a sq ft'), ' + $' + (book.install || 250) + ' + $' + (book.hardware || 900)),
      h('p', { class: 'v3-note', style: 'margin-top:4px' }, 'Mirrors $' + (book.mirrorRate || 42) + ' a sq ft installed.' + (book.method === 'supplier' ? ' Priced from supplier costs while those are on.' : ' Every new quote is priced off this book.')),
      ...learned.map((t) => h('p', { class: 'v3-note' }, stripDash(t))),
      h('p', { class: 'v3-note' }, 'Change it in ', h('a', { href: '#shop-prices' }, 'Connect'), '.')));
    // On site? Capture it.
    const capPane = (() => { let x = null; res.out.forEach((n) => { if (n.querySelectorAll && !x) x = n.querySelector('.fz-tabbody[data-id="capture"]'); }); return x; })();
    const capCard = el('section', 'v3-card', h('p', { class: 'v3-eb' }, 'On site? Capture it'),
      el('div', 'v3-need', el('div', 't', h('b', null, 'Capture a site request'), h('span', null, 'Becomes a Jobber request, with a draft quote')), linkBtn('Capture it', '#capture')));
    out.push(capCard);
    if (capPane) V._capturePane = capPane;
    res.out.forEach((n) => { if (n.matches && n.matches('style')) out.push(n); n.querySelectorAll && n.querySelectorAll('style').forEach((s) => out.push(s.cloneNode(true))); });
    return out;
  }
  // Schedule Installs: where each job is, one track per job, plus the board's own yes picture.
  // A yes is a job only once Jobber has it, and its glass is ordered only once the order went out (queued here or dated by the supplier).
  const yesJobs = (extra) => (extra && extra.cap.cards || []).filter(Boolean);
  const orderedJob = (r) => !!(r.p && (r.p.orderedAt || r.p.delivery || r.p.landedAt)) || done('send-' + slug(r.j.jobberWebUri || r.who));
  function installInsights(res, extra) {
    const s = res.cap.sched; const out = [];
    const all = s ? s.rows : [];
    const rows = all.filter(orderedJob);
    const toOrder = all.filter((r) => !orderedJob(r));
    const yesRows = (extra && extra.cap.cards || []).filter((c) => /Not a job yet/.test(c.when || '')).concat(toOrder.map((r) => ({ who: r.who + ' · job #' + r.j.jobNumber, amount: r.total, when: 'Job, no glass order yet' })));
    const STEPS = ['Order glass', 'Glass coming', 'Customer asked', 'Day set'];
    const at = (r) => ({ waiting: 1, dated: 2, asked: 2, picked: 3 })[r.stage] + (r.p && r.p.setAt ? 1 : 0);
    const cnt = [yesRows.length, rows.filter((r) => r.stage === 'waiting').length, rows.filter((r) => r.stage === 'dated' || r.stage === 'asked').length, rows.filter((r) => r.stage === 'picked').length];
    const steps = el('div', 'v3-steps', ...STEPS.map((l, i) => el('div', cnt[i] && i !== 1 ? 'hot' : null, h('b', null, String(cnt[i])), h('span', null, l))));
    const track = (n, labels) => { const pct = (i) => (i / 3 * 100) + '%'; return el('div', 'v3-track', el('div', 'ln', h('span', { class: 'done', style: 'width:calc(' + pct(Math.max(0, n)) + ' - 0px)' }), ...[0, 1, 2, 3].map((i) => h('span', { class: 'st' + (i < n ? ' d' : i === n ? ' n' : ''), style: 'left:calc(7px + (100% - 14px) * ' + (i / 3) + ')' }))), el('div', 'tl', ...labels.map((l) => h('span', null, l)))); };
    const jobs = [
      ...yesRows.slice(0, 4).map((c) => el('div', 'v3-job', h('p', { class: 'jh' }, h('b', null, c.who), h('span', null, ' · ' + fmt.money(c.amount) + ' · ' + String(c.when || '').split(' · ')[0].toLowerCase())), track(0, STEPS))),
      ...rows.slice(0, 4).map((r) => el('div', 'v3-job', h('p', { class: 'jh' }, h('b', null, r.who + ' · job #' + r.j.jobNumber), h('span', null, ' · ' + fmt.money(r.total) + ' · ' + (r.stage === 'waiting' ? (r.p.delivery ? 'lands ' + s.nice(r.p.delivery) : 'ordered ' + fmt.plural(r.days, 'day') + ' ago') : r.stage))),
        track(at(r), ['Ordered', r.p.delivery ? 'Lands ' + s.short(r.p.delivery) : 'No date yet', 'Ask', 'Day set']),
        el('div', 'v3-btns', A_copy('Copy an update', () => s.statusText(r)), r.j.jobberWebUri ? linkBtn('Open in Jobber', r.j.jobberWebUri, 'q') : null)))];
    out.push(el('section', 'v3-card', h('h3', null, 'Where each job is'), ...(jobs.length ? [steps, ...jobs] : [h('p', { class: 'v3-calm' }, 'Every yes has an install day. New yeses show up here the day they come in.')])));
    const yh = extra && extra.cap.heroes[0];
    if (yh) out.push(...insightsFrom({ cap: { heroes: [] }, out: [] }, yh, []));
    out.push(el('section', 'v3-card', el('div', 'v3-need', el('div', 't', h('b', null, 'Install rules'), h('span', null, s ? (s.S.days.map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d]).join(', ') + ' · ' + s.S.perDay + ' a day' + (s.S.signer ? ' · ' + s.S.signer + ' signs' : '')) : 'Set once in Connect')), linkBtn('Connect', '#shop-installs', 'q'))));
    return out;
  }
  const A_copy = (label, get) => { const b2 = btn(label, async () => { try { await navigator.clipboard.writeText(typeof get === 'function' ? get() : get); b2.textContent = 'Copied'; } catch (e) { window.prompt('Copy this', typeof get === 'function' ? get() : get); } }, 'q'); return b2; };

  // ---------- Capture flow (Quote Jobs): customer from Jobber, what they asked, sizes or a photo ----------
  // Same logic as the Capture Requests part: finds the customer and address in Jobber, creates the request,
  // and with sizes drafts the quote from the price book. Nothing goes to the customer.
  V.capture = async (box) => {
    const A = FZ.act;
    const book = await A.priceBook();
    const msg = h('p', { class: 'v3-msg', role: 'status' });
    let client = null, prop = null;
    const q = h('input', { type: 'text', placeholder: 'Start typing a customer name', autocomplete: 'off', 'aria-label': 'Customer' });
    const picks = el('div', 'v3-picklist');
    const chosen = el('div', null);
    let timer = null;
    q.addEventListener('input', () => { clearTimeout(timer); client = null; chosen.replaceChildren(); timer = setTimeout(async () => {
      const term = q.value.trim(); if (term.length < 2) { picks.replaceChildren(); return; }
      let list = []; try { list = await A.findClients(term); } catch (e) { list = []; }
      picks.replaceChildren(...(list.length ? list.slice(0, 6).map((c) => { const b2 = h('button', { type: 'button' }, c.name); b2.addEventListener('click', async () => {
        client = c; picks.replaceChildren(); q.value = c.name;
        const props = await A.propertiesOf(c.id).catch(() => []); prop = props[0] || null;
        chosen.replaceChildren(el('div', 'v3-pick', el('div', null, h('b', null, c.name), h('span', null, prop ? prop.label + ' · from Jobber' + (props.length > 1 ? ', ' + props.length + ' addresses, the first is used' : '') : 'No address on file. Add one in Jobber first.')), prop ? h('span', { class: 'v3-ok' }, '✓') : null));
      }); return b2; }) : [h('p', { class: 'v3-calm' }, 'No customer by that name in Jobber.')]));
    }, 300); });
    const what = h('input', { type: 'text', placeholder: 'Mirror for the primary closet', 'aria-label': 'What they asked for' });
    const sizes = h('input', { type: 'text', placeholder: '44 x 30', 'aria-label': 'Sizes in inches' });
    const preview = h('p', { class: 'v3-note' });
    const lines = () => A.linesFor(what.value + ' ' + sizes.value, book);
    const showPrice = () => { const ls = lines(); preview.textContent = ls.map((l) => l.name + ': ' + fmt.money(l.unitPrice) + ' (' + l.math + ')').join(' · '); };
    what.addEventListener('input', showPrice); sizes.addEventListener('input', showPrice);
    const file = h('input', { type: 'file', accept: 'image/*', style: 'display:none' });
    const photoBtn = btn('Read a photo', () => file.click(), 'q');
    file.addEventListener('change', async () => {
      if (!file.files.length) return;
      msg.textContent = 'Reading the sizes from your photo…';
      try { const p = await A.readDrawing(file.files, what.value); if (p.length) { sizes.value = p.map((x) => x.w + ' x ' + x.h).join(', '); showPrice(); msg.textContent = 'Read ' + fmt.plural(p.length, 'size') + ' from the photo. Check them before you capture it.'; } else msg.textContent = 'Could not read a size from that photo. Type it instead.'; }
      catch (e) { msg.textContent = (e && e.message) || 'Could not read the photo.'; }
    });
    const form = el('section', 'v3-card v3-form');
    const goBtn = btn('Capture it', async () => {
      if (!client || !prop) { msg.textContent = client ? 'This customer has no address in Jobber. Add it there first.' : 'Pick the customer from Jobber first.'; q.focus(); return; }
      if (!what.value.trim()) { msg.textContent = 'Say what they asked for.'; what.focus(); return; }
      goBtn.disabled = photoBtn.disabled = true; msg.textContent = 'Adding it to Jobber…';
      const title = fmt.clean(what.value) + (sizes.value.trim() ? ' (' + sizes.value.trim() + ' in)' : '');
      try {
        const r = await A.createRequest({ clientId: client.id, propertyId: prop.id, title });
        const req = r && (r.request || r);
        const ls = lines();
        let quote = null;
        if (ls.length && req && req.id) { msg.textContent = 'Request added. Drafting the quote…'; quote = await A.createQuote({ clientId: client.id, propertyId: prop.id, title, requestId: req.id, lineItems: ls }, form); }
        const reqLink = A.requestLink(r), qLink = quote ? A.quoteLink(quote) : null;
        const total = ls.reduce((n, l) => n + (Number(l.unitPrice) || 0) * (l.quantity || 1), 0);
        box.replaceChildren(el('div', 'v3p',
          head(h('p', { class: 'v3-eb' }, h('span', { class: 'tag run' }, 'RUN'), 'QUOTE JOBS · CAPTURE'), quote ? ['Done. ', { b: fmt.money(total) }, ' draft in Jobber.'] : ['Done. ', { b: 'Request' }, ' in Jobber.'], (quote ? 'Request and draft quote' : 'Request') + ' added for ' + client.name + '.'),
          el('section', 'v3-card', quote ? [h('p', { class: 'v3-eb', style: 'color:var(--muted)' }, 'Draft quote · not sent'), el('div', 'v3-rows v3-qlines', ...ls.map((l) => el('div', 'v3-row', el('div', 't', h('b', null, l.name), h('span', null, l.math)), h('span', { class: 'n' }, fmt.money(l.unitPrice)))), el('div', 'v3-row tot', el('div', 't', h('b', null, 'Total before tax')), h('span', { class: 'n' }, fmt.money(total))))] : h('p', { class: 'v3-calm' }, 'No sizes, so it saved the request only. Add sizes later and Quote Jobs drafts it.'),
            el('div', 'v3-btns', qLink ? linkBtn('Open the quote', qLink) : null, reqLink ? linkBtn('Open the request', reqLink, 'q') : null),
            h('p', { class: 'v3-note' }, quote ? 'Check it and press Send in Jobber. It shows on Tasks until it is sent.' : 'It shows on Quote Jobs once it is measured.')),
          el('div', 'v3-btns', linkBtn('Capture another', '#capture', 'q'), linkBtn('Back to Quote Jobs', '#a-quotes', 'q'))));
        V.clear();
      } catch (e) { goBtn.disabled = photoBtn.disabled = false; msg.textContent = 'Jobber did not take it: ' + ((e && e.message) || 'try again') + '.'; }
    });
    form.append(h('label', null, 'Customer', q), picks, chosen, h('label', null, 'What they asked for', what), h('label', null, 'Sizes in inches', sizes), preview,
      el('div', 'v3-btns', photoBtn, goBtn), file, msg, h('p', { class: 'v3-note' }, 'No sizes yet? Leave it blank and it saves the request only. The same works from Claude on your phone: say “Quote a 44 x 30 mirror for Jake at Monroe St”.'));
    box.replaceChildren(el('div', 'v3p',
      head(h('p', { class: 'v3-eb' }, h('span', { class: 'tag run' }, 'RUN'), 'QUOTE JOBS · CAPTURE'), ['Capture a ', { b: 'site request' }, '.'], 'Takes 20 seconds. Nothing goes to the customer.'),
      form, h('button', { type: 'button', class: 'v3-back', onclick: () => { location.hash = '#a-quotes'; } }, '← Back to Quote Jobs')));
  };

  // ---------- The morning brief email (Plan Today) ----------
  // One email each weekday at 6:03am from Flowzyn agents, only on days with something for him. It is built from the same
  // task list and money path as Today and Tasks, so the numbers match. Switching it on for a shop is Matt's call.
  const APP_URL = 'https://claude.ai/artifact/EZAYhhLr8Ltg6PU8So9ers';
  const esc = (t) => String(t == null ? '' : t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  V.briefEmail = async () => {
    const [all, money] = await Promise.all([V.tasks0(), V.money()]);
    const open = V.open(all);
    const me = FZ.me();
    const n = open.length;
    if (!n) return null; // no email on days with nothing for him
    const top = open.filter((t) => t.amount).sort(byBig).slice(0, 3);
    const emails = open.filter((t) => t.tap === 'send').length, quotes = open.filter((t) => t.tap === 'quote').length;
    const day = new Date().toLocaleDateString('en-US', { timeZone: fmt.TZ, weekday: 'short', month: 'short', day: 'numeric' });
    const subject = me.first + ', ' + n + (n === 1 ? ' thing needs' : ' things need') + ' you today';
    const pre = 'Morning brief for ' + me.business + ' · ' + short(money.total) + ' waiting';
    const did = 'Your agents have ' + [emails ? fmt.plural(emails, 'email') : null, quotes ? fmt.plural(quotes, 'quote') : null].filter(Boolean).join(' and ') + ' written for your OK.';
    const addr = String((FZ.profile() || {}).flowzynAddress || '').trim();
    const rows = top.map((t) => '<tr><td style="padding:14px 0;border-top:1px solid #e2e2df"><div style="font-size:15px;font-weight:600;color:#111">' + esc(t.title) + '</div><div style="font-size:13px;color:#666;margin-top:2px">' + esc(fmt.money(t.amount)) + ' · ' + esc(nameOf(t.agent)) + '</div></td></tr>').join('');
    const html = '<!DOCTYPE html><html><body style="margin:0;background:#f4f4f2;font-family:Inter,Segoe UI,Arial,sans-serif">' +
      '<div style="display:none;max-height:0;overflow:hidden">' + esc(pre) + '</div>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2"><tr><td align="center" style="padding:24px 12px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid #e2e2df;border-radius:16px;overflow:hidden">' +
      '<tr><td style="background:#0e1116;padding:16px 24px"><table role="presentation" width="100%"><tr><td style="color:#ff6b00;font-size:12px;font-weight:700;letter-spacing:.14em">FLOWZYN</td><td align="right" style="color:#f5f3ef;font-size:12px">Morning brief · ' + esc(day) + '</td></tr></table></td></tr>' +
      '<tr><td style="padding:26px 24px 8px"><div style="font-size:24px;font-weight:700;color:#111;line-height:1.25">' + n + ' need you, <span style="color:#ff6b00">' + esc(short(money.total)) + '</span> waiting.</div>' +
      '<div style="font-size:14px;color:#555;margin-top:8px">' + esc(did) + '</div></td></tr>' +
      '<tr><td style="padding:16px 24px 0"><div style="font-size:12px;font-weight:700;letter-spacing:.1em;color:#777">BIGGEST FIRST <span style="float:right;color:#111">' + top.length + ' OF ' + n + '</span></div>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px">' + rows + '</table></td></tr>' +
      '<tr><td style="padding:20px 24px 26px"><a href="' + APP_URL + '#today" style="display:block;text-align:center;background:#ff6b00;color:#fff;font-weight:700;font-size:15px;text-decoration:none;padding:14px 0;border-radius:10px">Open today</a></td></tr>' +
      '<tr><td style="padding:16px 24px;border-top:1px solid #e2e2df;font-size:12px;color:#777">One email a day. Flowzyn' + (addr ? ' · ' + esc(addr) : '') + ' · Turn off in Connect</td></tr>' +
      '</table></td></tr></table></body></html>';
    const text = n + ' need you, ' + short(money.total) + ' waiting.\n' + did + '\n\nBiggest first:\n' + top.map((t) => '· ' + t.title + ', ' + fmt.money(t.amount) + ' (' + nameOf(t.agent) + ')').join('\n') + '\n\nOpen today: ' + APP_URL + '#today\n\nOne email a day. Flowzyn' + (addr ? ', ' + addr : '') + '. Turn off in Connect.';
    return { from: 'Flowzyn agents', subject, preheader: pre, html, text, count: n, total: money.total, at: new Date().toISOString() };
  };
  // Preview of tomorrow's email, from Plan Today.
  V.briefPreview = async (box) => {
    loading(box, 'Writing the brief…');
    const m = await V.briefEmail();
    const frame = m ? h('iframe', { title: 'Morning brief email', style: 'width:100%;height:640px;border:0;border-radius:16px;background:#f4f4f2', sandbox: '' }) : null;
    if (frame) frame.srcdoc = m.html;
    box.replaceChildren(el('div', 'v3p',
      el('header', null, h('p', null, h('a', { class: 'v3-back', href: '#a-morning-brief' }, '← Plan Today')), h('h1', { class: 'v3-h1' }, m ? ['Your ', h('b', null, 'morning brief'), '.'] : 'No brief today.'), h('p', { class: 'v3-sub' }, m ? 'Subject: ' + m.subject + ' · From: ' + m.from : 'There is nothing for you today, so no email goes out.')),
      m ? el('section', 'v3-card', h('p', { class: 'v3-note', style: 'margin:0 0 14px' }, 'Preheader: ' + m.preheader), frame) : null));
  };

  window.FZ.v3 = V;
})();
