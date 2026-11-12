/* Flowzyn Agents app core: agent list, router, Jobber data layer, UI kit.
   Boards live in boards/*.js and register with FZ.board(key, spec). */
(function () {
  'use strict';

  // ---------- Agent list ----------
  const GROUPS = [
    { id: 'growth', name: 'Win agents', line: 'Win more of the right work', sets: [
      { title: 'New work', agents: [
        // Target Areas taken out (Matt, Nov 10). Its board file is kept for later.
        { key: 'builder-engine', name: 'Reach Builders', does: 'Finds builders with new projects near you and drafts a note from you', num: 'Builders who replied' },
        { key: 'partner-finder', name: 'Find Partners', does: 'Finds local businesses that can send you work', num: 'New partners sending work' },
        { key: 'local-search-check', name: 'Fix Listings', does: 'Your Google Maps ranking and three fixes a month', num: 'Searches you show up in' }
      ] },
      { title: 'Lost work', agents: [
        { key: 'lost-quote-revival', name: 'Revive Quotes', does: 'Brings back quotes archived 2 to 12 months ago', num: 'Old quotes won back' }
      ] }
    ] },
    { id: 'run', name: 'Run agents', line: 'Run the office from the first call to money in the bank', sets: [
      { title: 'Every morning', agents: [
        { key: 'morning-brief', featured: true, name: 'Plan Today', step: 'Every weekday', does: 'One short list of what needs you today', num: 'Approvals done each day' }
      ] },
      { title: '1 Enquiries', agents: [
        { key: 'lead-catcher', name: 'Answer Enquiries', step: '1 They ask', does: 'New enquiries waiting for a reply or a visit', num: 'Hours to first reply' }
      ] },
      { title: '2 Quotes', agents: [
        { key: 'quotes', name: 'Quote Jobs', step: '2 You quote', does: 'Every job you have visited quoted, priced the way you price', num: 'Days from measure to quote' },
        { key: 'quick-capture', hidden: true, parent: 'quotes', tab: 'capture', name: 'Capture Requests', step: 'Any time', does: 'Anything asked for on site goes straight into Jobber', num: 'Site asks captured' },
        { key: 'quote-prep', hidden: true, parent: 'quotes', tab: 'work', name: 'Draft Quotes', step: '2 You quote', does: 'Drafts each quote from your site visit, prices and past jobs', num: 'Days from site visit to quote' },
        { key: 'supplier-costs', hidden: true, parent: 'quotes', tab: 'pricing', name: 'Load Costs', step: '2 You quote', does: 'Every quote priced from what the glass really costs you', num: 'Quotes priced from supplier costs' },
        { key: 'price-book', hidden: true, parent: 'quotes', tab: 'pricing', name: 'Set Prices', step: '2 You quote', does: 'Your price book, learned from every past quote', num: 'Quotes priced to the book' },
        { key: 'quote-chaser', featured: true, name: 'Chase Quotes', step: '2 You quote', does: 'Follows up quotes after Jobber stops', num: 'Quotes won after a follow up' }
      ] },
      { title: '3 Booking the work', agents: [
        { key: 'yes-to-install', hidden: true, parent: 'install-scheduler', name: 'Schedule Installs', step: '3 They say yes', does: 'Approved work not yet booked, supplier order written', num: 'Days from yes to install' },
        { key: 'install-scheduler', name: 'Schedule Installs', step: '3 They say yes', does: 'Every yes booked, from the order to the day the work is done', num: 'Days from yes to the booked day' }
      ] },
      { title: '4 Getting paid', agents: [
        { key: 'bill-it', name: 'Send Invoices', step: '4 The job', does: 'Work done but not invoiced, oldest first', num: 'Dollars not invoiced' },
        { key: 'get-paid', featured: true, name: 'Collect Payments', step: '5 They pay', does: 'Overdue invoices with a friendly nudge ready', num: 'Overdue dollars collected' },
        { key: 'pay-bills', name: 'Pay Bills', step: '6 You pay', does: 'Supplier bills due this week, doubles and jumps flagged', num: 'Bills paid on time' }
      ] }
    ] },
    { id: 'keep', name: 'Keep agents', line: 'Keep customers coming back', sets: [
      { title: 'Reviews and repeat work', agents: [
        { key: 'review-ask', name: 'Get Reviews', does: 'Happy customers to ask for a Google review', num: 'New reviews a month' },
        { key: 'come-back', name: 'Rebook Customers', does: 'Past clients due for more work', num: 'Repeat jobs booked' }
      ] }
    ] }
  ];

  const AGENTS = [];
  GROUPS.forEach((g) => g.sets.forEach((s, si) => s.agents.forEach((a) => AGENTS.push(Object.assign(a, { name: a.name.replace(/ Agent$/, ''), group: g.id, groupName: g.name, set: si, setTitle: s.title || '' })))));
  const byKey = (k) => AGENTS.find((a) => a.key === k);
  // The core agents the owner sees. The rest run in the background, looked after by the Operator.
  const CORE = ['builder-engine', 'lost-quote-revival', 'morning-brief', 'lead-catcher', 'quotes', 'quote-chaser', 'install-scheduler', 'bill-it', 'get-paid', 'review-ask'];
  // How each agent reaches Jobber. 'tap': Jobber does not let agents write this record, so the agent lines it up and the owner taps once in Jobber.
  const ACCESS = { 'bill-it': 'tap', 'yes-to-install': 'tap', 'install-scheduler': 'tap', 'quotes': 'tap' };
  AGENTS.forEach((a) => { a.access = ACCESS[a.key] || 'auto'; });
  AGENTS.forEach((a) => { a.core = CORE.includes(a.key); });
  // Owner view or Operator view. Editors of the page (Flowzyn) see the Operator view and can switch to see what the owner sees.
  const readView = () => { try { return localStorage.getItem('fz-view'); } catch (e) { return null; } };
  // A shop's own copy of the app (FZ_SHOP_COPY) is always the owner view, even though its owner can edit it.
  const isOperator = () => !window.FZ_SHOP_COPY && !!(window.FZ && window.FZ.CAN_EDIT) && readView() !== 'owner';
  const shown = (a) => !(a && a.hidden); // parts of a merged agent open inside it
  const opName = () => ((SETTINGS.profile || {}).operatorName || '').trim();
  const opWho = (cap) => opName() || (cap ? 'Your Operator' : 'your Operator');

  // ---------- Formatting ----------
  let TZ = 'America/Denver'; // the shop's own zone once its profile loads (settings/profile timeZone)
  const money = (n, opts) => {
    n = Number(n) || 0;
    if (opts && opts.short && Math.abs(n) >= 1000000) return '$' + (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (opts && opts.short && Math.abs(n) >= 1000) return '$' + (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k';
    return '$' + Math.round(n).toLocaleString('en-US');
  };
  const dayKey = (iso) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
  const asDate = (iso) => /^\d{4}-\d{2}-\d{2}$/.test(String(iso)) ? String(iso) + 'T18:00:00Z' : iso; // date-only values stay on their day in Denver
  const fmtDay = (iso) => new Date(asDate(iso)).toLocaleDateString('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' });
  const fmtDate = (iso) => new Date(asDate(iso)).toLocaleDateString('en-US', { timeZone: TZ, month: 'short', day: 'numeric' });
  const fmtTime = (iso) => new Date(iso).toLocaleTimeString('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).replace(' ', '').toLowerCase();
  const daysSince = (iso) => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null;
  const daysUntil = (iso) => iso ? Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000) : null;
  const plural = (n, one, many) => n + ' ' + (n === 1 ? one : (many || one + 's'));
  const firstName = (name) => String(name || '').trim().split(/\s+/)[0] || 'there';
  const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const isoDaysAgo = (d) => new Date(Date.now() - d * 86400000).toISOString().replace(/\.\d+Z$/, 'Z');
  const isoDaysAhead = (d) => new Date(Date.now() + d * 86400000).toISOString().replace(/\.\d+Z$/, 'Z');
  const fmt = { money, dayKey, fmtDay, fmtDate, fmtTime, daysSince, daysUntil, plural, firstName, clean, isoDaysAgo, isoDaysAhead, get TZ() { return TZ; } };

  // ---------- Jobber data layer ----------
  let mcpP = null;
  const getMcp = () => (mcpP = mcpP || (window.claude && window.claude.use ? window.claude.use('mcp') : Promise.resolve(null)));
  const memo = new Map();
  let FRESH = false; // true for a few seconds after Refresh: read Jobber again instead of the 5 minute cache
  const cacheOpt = () => ({ cache: { staleTime: FRESH ? 0 : 5 * 60 * 1000 } });
  class DataError extends Error { constructor(code, message, server) { super(message || code); this.code = code; this.server = server; } }

  const EMAILS = new Map();
  function clientEmail(id) {
    if (!EMAILS.has(id)) EMAILS.set(id, jobber('get_client', { clientId: id }).then((r) => {
      const c = (r && (r.client || r)) || {}; const list = c.emails || [];
      const e = (list.find((x) => x.primary) || list[0] || {}).address || c.email || '';
      return e;
    }).catch(() => ''));
    return EMAILS.get(id);
  }
  const LANE = { busy: 0, wait: [] };
  const take = () => new Promise((r) => { if (LANE.busy < 4) { LANE.busy++; r(); } else LANE.wait.push(r); });
  const give = () => { const next = LANE.wait.shift(); if (next) next(); else LANE.busy--; };
  async function callJobber(mcp, tool, input) {
    for (let attempt = 0; ; attempt++) {
      let err = null;
      await take();
      try { return await mcp.callTool('Jobber', tool, input || {}, cacheOpt()); }
      catch (e) { err = e; }
      finally { give(); }
      const again = err && (err.retryable || /rate|throttl|busy|timeout/i.test(String(err.code || err.message || ''))) && attempt < 3;
      if (!again) throw err;
      await new Promise((r) => setTimeout(r, (err.retryAfterMs || 1000 * (attempt + 1)) + Math.random() * 600));
    }
  }
  async function jobber(tool, input) {
    const id = tool + ':' + JSON.stringify(input || {});
    if (memo.has(id)) return memo.get(id);
    const p = (async () => {
      const mcp = await getMcp();
      if (!mcp) throw new DataError('no_mcp', 'Jobber is not reachable from this view');
      let res;
      try { res = await callJobber(mcp, tool, input); }
      catch (e) { throw new DataError(e && e.code || 'upstream_error', e && e.message, 'Jobber'); }
      let p = res && res.payload;
      if (typeof p === 'string') { try { p = JSON.parse(p); } catch (_) { /* keep text */ } }
      return p;
    })();
    memo.set(id, p);
    p.catch(() => memo.delete(id));
    return p;
  }

  // Page through a search tool. listKey is the array field (quotes, jobs, invoices...).
  async function jobberAll(tool, input, listKey, max) {
    max = max || 200;
    // Jobber search tools take at most 50 a page. A bigger limit fails the whole call.
    if (input && input.limit > 50) input = Object.assign({}, input, { limit: 50 });
    const out = [];
    let cursor;
    for (let i = 0; i < 20; i++) {
      const page = await jobber(tool, Object.assign({}, input, cursor ? { cursor } : {}));
      const items = (page && page[listKey]) || [];
      out.push(...items);
      const info = page && page.pageInfo;
      if (!info || !info.hasNextPage || !info.endCursor || out.length >= max) break;
      cursor = info.endCursor;
    }
    return out.slice(0, max);
  }

  // Run fn over items with limited parallel calls.
  async function pool(items, n, fn) {
    const out = new Array(items.length);
    let i = 0;
    const workers = Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) { const k = i++; try { out[k] = await fn(items[k], k); } catch (e) { out[k] = null; } }
    });
    await Promise.all(workers);
    return out;
  }

  // Shared store (forecast, metrics, permits) written by Flowzyn's scheduled runs.
  let dbP = null;
  const getDb = () => (dbP = dbP || (window.claude && window.claude.use ? window.claude.use('db') : Promise.resolve(null)));
  async function store(path) {
    const db = await getDb();
    if (!db) return null;
    try { const s = await db.doc(path).get(); return s && s.exists ? s.data() : null; } catch (e) { return null; }
  }

  // ---------- UI kit ----------
  const h = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    if (attrs) for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') n.className = v;
      else if (k === 'text') n.textContent = v;
      else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    kids.flat().forEach((c) => { if (c == null || c === false) return; n.append(c instanceof Node ? c : document.createTextNode(String(c))); });
    return n;
  };
  const extLink = (href, label, cls) => h('a', { href, target: '_blank', rel: 'noopener', class: cls || null }, label);

  const ui = {
    h, extLink,
    // The one sentence that answers the board's question. parts: strings, or {b: 'text'} for orange emphasis.
    // One line headline (Matt, Nov 7): the first sentence is the headline, anything after it drops to a quiet line underneath.
    status(parts) {
      const all = [].concat(parts).filter((p) => p !== null && p !== undefined && p !== false);
      const head = [], rest = [];
      let split = false;
      all.forEach((p, i) => {
        if (split) { rest.push(p); return; }
        if (typeof p === 'string') {
          const m = p.match(/^([\s\S]*?[.!?])\s+(\S[\s\S]*)?$/);
          if (m && (m[2] || i < all.length - 1)) { head.push(m[1]); if (m[2]) rest.push(m[2]); split = true; return; }
        }
        head.push(p);
      });
      const el = (p) => (p && typeof p === 'object' && 'b' in p) ? h('b', null, p.b) : p;
      return h('p', { class: 'fz-status' }, h('span', { class: 'fz-status-h' }, ...head.map(el)),
        rest.length ? h('span', { class: 'fz-status-sub' }, ...rest.map(el)) : null);
    },
    section(title, sub, ...kids) {
      return h('section', { class: 'fz-sec' }, title ? h('h2', { class: 'fz-h2' }, title) : null, sub ? h('p', { class: 'fz-sub' }, sub) : null, ...kids);
    },
    // Ranked action cards. item: {when, who, why, amount, link, linkLabel, draft, draftLabel, flag}
    cards(items, opts) {
      opts = opts || {};
      const max = opts.max || 6;
      const list = h('div', { class: 'fz-cards' });
      items.slice(0, max).forEach((it) => {
        const c = h('article', { class: 'fz-card' + (it.flag ? ' flag' : ''), 'data-lead': it.leadId || null },
          h('div', { class: 'fz-card-top' }, it.when ? h('span', { class: 'when' }, it.when) : null, it.amount != null ? h('span', { class: 'amt' }, typeof it.amount === 'number' ? money(it.amount) : it.amount) : null),
          h('span', { class: 'who' }, it.who),
          it.why ? h('span', { class: 'why' }, it.why) : null);
        // With an email, the drafted email shows in the card, ready to read and send. The record is a quiet link under it.
        if (it.draft) {
          const isMail = !it.draftCall && !it.draftHead;
          // Same as Builder Outreach: one Queue to send button. It goes out from the owner's email on the next run.
          const qid = 'send-' + String(it.queueId || it.link || it.who || '').replace(/[^A-Za-z0-9]+/g, '-').slice(-80);
          c.append(ui.draftButton(it.draft, it.draftLabel, { inline: true, minimal: isMail, open: true, call: it.draftCall || !!it.draftHead, head: it.draftHead, to: it.draftTo, subject: it.draftSubject, clientId: it.clientId,
            queued: isMail && !!(TASKS[qid] && TASKS[qid].outbox),
            queueLabel: isOperator() ? null : 'Approve and send',
            onQueue: isMail ? (ob) => queueSend(qid, Object.assign({ who: it.who, link: it.link || null }, ob)) : null }));
          // Email cards: who it goes to on the left, the email on the right.
          if (isMail) {
            const box = c.lastChild;
            // Already dealt with by phone, text or in person: take it off the list.
            const handled = h('button', { type: 'button', class: 'fz-btn sm fz-handled' }, 'Already handled');
            handled.addEventListener('click', async () => {
              handled.disabled = true;
              try { const db = await getDb(); if (db) { const rec = { done: true, handled: true, at: new Date().toISOString() }; await db.doc('tasks/' + qid).set(rec); TASKS[qid] = rec; } } catch (e) { /* stays on the list */ }
              c.classList.add('is-handled'); handled.textContent = 'Marked as handled';
            });
            const btns = box.querySelector('.fz-draft-btns'); const ob = opButton({ id: qid, title: (it.agent ? '' : '') + 'Email to ' + it.who, meta: it.why || '', link: it.link || null, agent: it.agent || null, draft: it.draft }); if (btns) btns.append(...[ob, handled].filter(Boolean));
            if (TASKS[qid] && TASKS[qid].handled) return;
            const left = h('aside', { class: 'be-who' }, ...[...c.childNodes].filter((n) => n !== box));
            if (it.link) left.append(h('div', { class: 'fz-card-btns' }, extLink(it.link, it.linkLabel || 'Open in Jobber', 'fz-cardlink')));
            c.replaceChildren(left, h('div', { class: 'be-email' }, box));
            c.classList.add('be-mail');
            list.append(c); return;
          }
        }
        // Owner view: prepared work gets one Approve button. The record in Jobber is a quiet link.
        if (it.approve && !it.draft && !isOperator()) {
          const aid = 'ok-' + String(it.queueId || it.link || it.who || '').replace(/[^A-Za-z0-9]+/g, '-').slice(-80);
          const done = !!(TASKS[aid] && TASKS[aid].done);
          const b = h('button', { type: 'button', class: 'fz-btn act' }, done ? 'Approved' : it.approve);
          if (done) b.disabled = true;
          b.addEventListener('click', async () => { b.disabled = true; if (await saveTask(aid, true, { agent: it.agent || null, title: 'Approved: ' + it.who + (it.approveWhat ? ', ' + it.approveWhat : ''), meta: it.why || '', link: it.link || null, approved: true })) b.textContent = 'Approved'; else b.disabled = false; });
          if (TASKS[aid] && TASKS[aid].handled) return;
          const hd = h('button', { type: 'button', class: 'fz-btn sm fz-handled' }, 'Already handled');
          hd.addEventListener('click', async () => { hd.disabled = true; try { const db = await getDb(); if (db) { const rec = { done: true, handled: true, at: new Date().toISOString() }; await db.doc('tasks/' + aid).set(rec); TASKS[aid] = rec; } } catch (e) { /* stays */ } c.classList.add('is-handled'); hd.textContent = 'Marked as handled'; b.disabled = true; });
          c.append(h('div', { class: 'fz-card-btns' }, b, opButton({ id: aid, title: it.who + (it.approveWhat ? ', ' + it.approveWhat : ''), meta: it.why || '', link: it.link || null, agent: it.agent || null }), hd, it.link ? extLink(it.link, 'Open in Jobber', 'fz-cardlink') : null));
          list.append(c); return;
        }
        if (it.toOperator) {
          c.append(h('div', { class: 'fz-card-btns' }, opButton({ id: it.queueId || it.who, title: it.toOperator, meta: it.why || '', link: it.link || null, agent: it.agent || null }), it.link ? extLink(it.link, it.linkLabel || 'Open in Jobber', 'fz-cardlink') : null));
          list.append(c); return;
        }
        if (it.link) c.append(h('div', { class: 'fz-card-btns' }, extLink(it.link, it.linkLabel || 'Open in Jobber', it.draft ? 'fz-cardlink' : 'fz-btn act')));
        list.append(c);
      });
      const wrap = h('div', null, list);
      if (items.length > max) wrap.append(h('p', { class: 'fz-more' }, plural(items.length - max, 'more', 'more') + ' in the full list below.'));
      return wrap;
    },
    // A button that reveals an editable draft: who it goes to, the subject and the note.
    // With o.onQueue it can be added to the send queue, which the owner's morning run sends from their own email.
    draftButton(text, label, o) {
      o = o || {};
      const area = h('textarea', { class: 'fz-draft-text', rows: String(Math.min(14, String(text).split('\n').length + 2)), 'aria-label': 'Note, edit before sending' });
      area.value = text;
      // Grow to fit the whole email, so nothing is cut off on a phone.
      const fit = () => { area.style.height = 'auto'; area.style.height = (area.scrollHeight + 2) + 'px'; };
      area.addEventListener('input', fit);
      requestAnimationFrame(() => requestAnimationFrame(fit));
      try { new ResizeObserver(() => fit()).observe(area); } catch (e) { /* fixed height */ }
      const toIn = h('input', { class: 'fz-draft-field', type: 'email', placeholder: 'name@company.com', value: o.to || '', 'aria-label': 'Send to' });
      const subIn = h('input', { class: 'fz-draft-field', type: 'text', value: o.subject || '', 'aria-label': 'Subject' });
      // Fill the To line from the customer's primary email in Jobber.
      if (!o.to && o.clientId && !o.call) clientEmail(o.clientId).then((e) => { if (e && !toIn.value) toIn.value = e; });
      const useOutlook = !!(SETUP.microsoft && SETUP.microsoft.done) && !(SETUP.gmail && SETUP.gmail.done);
      const msg = h('p', { class: 'fz-hint', role: 'status' });
      const openMail = () => {
        const to = toIn.value.trim(), subject = subIn.value, body = area.value;
        const url = useOutlook
          ? 'https://outlook.office.com/mail/deeplink/compose?' + new URLSearchParams({ to, subject, body }).toString()
          : 'https://mail.google.com/mail/?view=cm&fs=1&' + new URLSearchParams({ to, su: subject, body }).toString();
        window.open(url, '_blank', 'noopener');
      };
      const queueBtn = o.onQueue ? h('button', { type: 'button', class: 'fz-btn act' }, o.queued ? (o.queueLabel ? 'Approved' : 'In the send queue') : (o.queueLabel || (o.minimal ? 'Queue to send' : 'Add to send queue'))) : null;
      if (queueBtn) queueBtn.addEventListener('click', async () => {
        const to = toIn.value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { msg.textContent = 'Add the email address it goes to first.'; toIn.focus(); return; }
        queueBtn.disabled = true;
        const ok = await o.onQueue({ to, subject: subIn.value.trim(), body: area.value });
        if (ok) { queueBtn.textContent = o.queueLabel ? 'Approved' : 'In the send queue'; msg.textContent = 'Queued. It goes out from your email on the next run.'; } else { queueBtn.disabled = false; msg.textContent = 'Could not add it to the queue. Try again.'; }
      });
      const box = h('div', { class: 'fz-draft', hidden: true },
        o.call ? h('span', { class: 'fz-draft-head' }, o.head || 'Call notes') : h('label', { class: 'fz-draft-row' }, h('span', null, 'To'), toIn),
        o.call ? null : h('label', { class: 'fz-draft-row' }, h('span', null, 'Subject'), subIn),
        area,
        h('div', { class: 'fz-draft-btns' }, queueBtn,
          o.minimal || o.call ? null : h('button', { type: 'button', class: o.inline && !queueBtn ? 'fz-btn act' : 'fz-btn', onclick: openMail }, useOutlook ? 'Open in Outlook' : 'Open in Gmail'),
          o.minimal ? null : h('button', { type: 'button', class: 'fz-btn', onclick: (e) => copy(area.value, e.currentTarget) }, 'Copy')),
        msg,
        o.minimal ? null : h('p', { class: 'fz-hint' }, o.call ? (o.head ? 'Copy it and post it as your reply. Nothing is posted from here.' : 'Have these in front of you when you call.') : o.inline && !o.onQueue ? 'Edit it here if you like. Nothing goes out until you press send in your email.' : o.onQueue ? 'Edit it here. Add it to the send queue to go out from your email, or open it in your email and send it yourself.' : 'Edit it here, then open it in your email to send. Nothing goes out until you press send.'));
      if (o.inline) { box.hidden = false; box.classList.add('inline'); return box; }
      const btn = h('button', { type: 'button', class: 'fz-btn act', 'aria-expanded': 'false', onclick: () => { box.hidden = !box.hidden; btn.setAttribute('aria-expanded', String(!box.hidden)); } }, label || 'See draft');
      if (o.open) { box.hidden = false; const wrap = h('span', { class: 'fz-draft-wrap' }); queueMicrotask(() => { const card = wrap.closest('.fz-card'); (card || wrap.parentNode).append(box); }); return wrap; }
      const frag = h('span', { class: 'fz-draft-wrap' }, btn);
      // The draft opens under the card, not inside the button row.
      queueMicrotask(() => { const card = frag.closest('.fz-card'); (card || frag.parentNode).append(box); });
      return frag;
    },
    // Up to 3 headline numbers. item: {label, value, sub}
    kpis(items) {
      return h('div', { class: 'fz-kpis' }, items.slice(0, 3).map((k) => h('div', { class: 'fz-kpi' }, h('span', { class: 'l' }, k.label), h('span', { class: 'v' }, k.value), k.sub ? h('span', { class: 's' }, k.sub) : null)));
    },
    // Ranked horizontal bars. rows: {label, value, display, hi, link}
    bars(rows, opts) {
      opts = opts || {};
      const max = Math.max(1, ...rows.map((r) => Number(r.value) || 0));
      // One highlight only: the biggest of the rows marked hi.
      const his = rows.filter((r) => r.hi);
      const top = his.length ? his.reduce((a, b) => ((Number(b.value) || 0) > (Number(a.value) || 0) ? b : a)) : null;
      return h('div', { class: 'fz-bars' }, rows.slice(0, opts.max || 10).map((r) => h('div', { class: 'fz-bar' + ((opts.allHi ? r.hi : r === top) ? ' hi' : '') },
        h('span', { class: 'lab' }, r.link ? extLink(r.link, r.label) : r.label),
        h('span', { class: 'track' }, h('span', { class: 'fill', style: 'width:' + ((Number(r.value) || 0) > 0 ? Math.max(2, (Number(r.value) || 0) / max * 100) : 0) + '%' })),
        h('span', { class: 'val' }, r.display != null ? r.display : String(r.value)))));
    },
    // Wait map: one row per item, a dot at how long it has waited (sized by dollars), the goal shaded,
    // and a split bar on top showing dollars inside vs past the goal.
    // items: {who, sub, days, amount, link, act}  opts: {goal, goalLabel, unit, max, late, ok}
    waits(items, opts) {
      opts = opts || {};
      const goal = opts.goal || 7;
      const show = items.slice().sort((a, b) => b.days - a.days).slice(0, opts.max || 8);
      const top = Math.max(goal * 2, ...items.map((r) => r.days)) * 1.08;
      const big = Math.max(1, ...items.map((r) => r.amount || 0));
      const pos = (d) => Math.min(100, d / top * 100);
      const lateSet = items.filter((r) => r.days > goal);
      const lateD = lateSet.reduce((n, r) => n + (r.amount || 0), 0);
      const allD = items.reduce((n, r) => n + (r.amount || 0), 0) || 1;
      const unit = (d) => fmt.plural(d, opts.unit || 'day');
      const split = h('div', { class: 'wm-split' },
        h('div', { class: 'wm-bar' }, h('span', { class: 'wm-ok', style: 'width:' + ((allD - lateD) / allD * 100) + '%' }), h('span', { class: 'wm-late', style: 'width:' + (lateD / allD * 100) + '%' })),
        h('div', { class: 'wm-key' },
          items.length - lateSet.length === 0 ? null : h('span', null, h('i', { class: 'k-ok' }), (opts.ok || 'Inside ' + (opts.goalLabel || unit(goal))) + ' ', h('b', null, fmt.money(allD - lateD, { short: true })), ' · ' + (items.length - lateSet.length)),
          lateSet.length === 0 ? null : h('span', null, h('i', { class: 'k-late' }), (opts.late || 'Past ' + (opts.goalLabel || unit(goal))) + ' ', h('b', null, fmt.money(lateD, { short: true })), ' · ' + lateSet.length)));
      const rows = show.map((r) => {
        const late = r.days > goal;
        const sz = 12 + Math.round(Math.sqrt((r.amount || 0) / big) * 16);
        return h('div', { class: 'wm-row' + (late ? ' late' : '') },
          h('div', { class: 'wm-who' }, h('b', null, r.who || ''), r.sub ? h('span', null, r.sub) : null),
          h('div', { class: 'wm-track' }, h('span', { class: 'wm-zone', style: 'width:' + pos(goal) + '%' }), h('span', { class: 'wm-goal', style: 'left:' + pos(goal) + '%' }),
            h('span', { class: 'wm-dot', style: 'left:' + pos(r.days) + '%;width:' + sz + 'px;height:' + sz + 'px' })),
          h('div', { class: 'wm-val' }, h('b', null, fmt.money(r.amount || 0, { short: true })), h('span', null, unit(r.days))),
          r.act || (r.link ? h('a', { href: r.link, target: '_blank', rel: 'noopener', class: 'fz-tlink', title: 'Open in Jobber' }, 'Open') : h('span')));
      });
      const axis = h('div', { class: 'wm-row wm-axis' }, h('div'), h('div', { class: 'wm-track bare' },
        h('span', { style: 'left:0' }, '0'), h('span', { class: 'g', style: 'left:' + pos(goal) + '%' }, opts.goalLabel || unit(goal)), h('span', { style: 'right:0' }, unit(Math.round(top)))), h('div'), h('div'));
      const more = items.length > show.length ? h('p', { class: 'fz-more' }, (items.length - show.length) + ' more in the full list below.') : null;
      return h('div', { class: 'wm viz' }, split, h('div', { class: 'wm-rows' }, rows, axis), more);
    },
    // Money path funnel: steps {label, value, display, hi}
    // opts.time: steps are periods in order. A graph never shows a dead period: if any period is empty,
    // the periods that have data show as bars in time order instead. Stage funnels drop empty stages.
    funnel(steps, opts) {
      opts = opts || {};
      const has = (s) => (Number(s.value) || 0) > 0;
      if (steps.some(has)) {
        if (opts.time && !steps.every(has)) return ui.bars(steps.filter(has).map((s) => ({ label: s.label, value: s.value, display: s.display, hi: s.hi })), { max: steps.length });
        if (!opts.time) steps = steps.filter(has);
      }
      const max = Math.max(1, ...steps.map((s) => Number(s.value) || 0));
      return h('div', { class: 'fz-funnel' }, steps.map((s) => h('div', { class: 'fz-step' + (s.hi ? ' hi' : '') },
        h('span', { class: 'lab' }, s.label), h('span', { class: 'col' }, h('span', { class: 'fill', style: 'height:' + ((Number(s.value) || 0) > 0 ? Math.max(3, (Number(s.value) || 0) / max * 100) : 0) + '%' })), h('span', { class: 'val' }, s.display != null ? s.display : String(s.value)))));
    },
    // Full list. cols: [{label, get(row) -> string|Node, num}]
    table(cols, rows, opts) {
      opts = opts || {};
      const t = h('table', { class: 'fz-table' },
        h('thead', null, h('tr', null, cols.map((c) => h('th', { class: c.num ? 'num' : null }, c.label)))),
        h('tbody', null, rows.map((r) => h('tr', null, cols.map((c) => { const v = c.get(r); return h('td', { class: c.num ? 'num' : null }, v == null ? '' : v); })))));
      // Links to records: the name in the first column becomes the link, so rows carry no button.
      // When a row's first cell is not plain text the link stays as a quiet Open in its own column.
      const moved = new Set();
      t.querySelectorAll('tbody tr').forEach((tr) => {
        const first = tr.cells[0];
        [...tr.querySelectorAll('td a')].filter((x) => /^open$/i.test(x.textContent.trim())).forEach((x) => {
          x.className = 'fz-tlink'; x.title = /jobber/i.test(x.href) ? 'Open in Jobber' : 'Open';
          const td = x.closest('td');
          if (first && td !== first && !first.children.length && first.textContent.trim() && td.textContent.trim() === x.textContent.trim() && !moved.has(tr)) {
            x.textContent = first.textContent; first.replaceChildren(x); moved.add(tr); td.dataset.moved = '1';
          }
        });
      });
      // Drop a link column left empty once every link in it moved to the name.
      if (moved.size) [...t.tHead.rows[0].cells].forEach((th, i) => {
        const cells = [...t.tBodies[0].rows].map((tr) => tr.cells[i]).filter(Boolean);
        if (i > 0 && cells.some((c) => c.dataset.moved) && cells.every((c) => c.dataset.moved || !c.textContent.trim())) { th.remove(); cells.forEach((c) => c.remove()); }
      });
      const box = h('div', { class: 'fz-tablebox' }, t);
      if (opts.open) return box;
      const d = ui.details(opts.summary || ('All ' + rows.length + ' as a list'), box);
      d.open = true; // lists show in full on load
      return d;
    },
    details(summary, ...kids) { return h('details', { class: 'fz-details' }, h('summary', null, summary), h('div', null, ...kids)); },
    how(...lines) { const d = ui.details('How this works', ...lines.map((l) => h('p', null, l))); d.classList.add('fz-how'); return d; },
    calm(text) { return h('p', { class: 'fz-calm' }, text); },
    note(text) { return h('p', { class: 'fz-note' }, text); },
    // A board that needs a connection or key Flowzyn has not set up yet.
    setup(opts) {
      return h('div', { class: 'fz-setup' },
        h('p', { class: 'fz-setup-t' }, opts.title || 'Almost ready'),
        h('p', null, opts.text),
        // The owner never gets setup steps or buttons: the Operator does the setup.
        !isOperator() ? h('p', { class: 'fz-setup-op' }, h('span', { class: 'dot green' }), opWho(true) + ' is setting this up. First results show here.') : null,
        isOperator() && opts.steps ? h('ol', null, opts.steps.map((s) => h('li', null, s))) : null,
        isOperator() ? h('div', { class: 'fz-card-btns' }, h('a', { class: 'fz-btn act', href: '#setup' }, 'Finish setup')) : null,
        opts.preview ? h('div', { class: 'fz-setup-prev' }, h('p', { class: 'fz-sub' }, 'What you will see'), opts.preview) : null);
    },
    pill(text, kind) { return h('span', { class: 'fz-pill' + (kind ? ' ' + kind : '') }, text); },
    source(text) { return h('p', { class: 'fz-source' }, text); }
  };

  function copy(text, btn) {
    const done = () => { const t = btn.textContent; btn.textContent = 'Copied'; setTimeout(() => { btn.textContent = t; }, 1500); };
    try {
      navigator.clipboard.writeText(text).then(done, () => selectFallback(btn));
    } catch (e) { selectFallback(btn); }
  }
  function selectFallback(btn) {
    const pre = btn.closest('.fz-draft') && btn.closest('.fz-draft').querySelector('pre');
    if (!pre) return;
    const r = document.createRange(); r.selectNodeContents(pre);
    const s = window.getSelection(); s.removeAllRanges(); s.addRange(r);
    btn.textContent = 'Selected, press copy';
  }

  // The human offer: agents find the work, a Flowzyn Operator can do it.
  // Operator request form on flowzyn.com, pre-filled with this shop's details.
  const opUrl = (from) => {
    const m = me();
    const q = new URLSearchParams({ from: from || 'Agents app' });
    if (m.owner) q.set('name', m.owner);
    if ((SETTINGS.profile || {}).business) q.set('company', m.business);
    if (m.website) q.set('website', m.website);
    const p = plan(); if (p && p.client) q.set('client', p.client);
    return 'https://flowzyn.com/operator?' + q.toString();
  };
  const customUrl = (from) => opUrl(from).replace('/operator?', '/custom-agent?');
  function operatorBanner(from, compact) {
    const face = h('span', { class: 'op-face', 'aria-hidden': 'true' });
    face.innerHTML = '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"></path></svg>';
    return h('aside', { class: 'op-banner' + (compact ? ' compact' : '') },
      face,
      h('div', { class: 'op-text' },
        h('p', { class: 'op-t' }, opName() ? opName() + ' runs your agents' : 'Your Operator runs your agents'),
        h('p', { class: 'op-d' }, 'A real person on the Flowzyn team sets up your agents, keeps them tuned and picks up the calls, manual steps and exceptions they can’t do. You approve, they handle the rest.')),
      null);
  }

  // ---------- Boards ----------
  const BOARDS = {};
  const TABPICK = {};
  const METRICS = {}; // key -> {value, detail} computed live this session
  function board(key, spec) { BOARDS[key] = spec; const a = byKey(key); if (a) a.status = a.status || spec.status || 'live'; }

  function errorView(e, agent) {
    const code = e && e.code;
    const map = {
      no_mcp: ['Open this in Claude to see live data', 'This page reads Jobber through your Claude connectors, so it only shows data when opened inside Claude.'],
      not_granted: ['Allow Jobber for this page', 'Use the Permissions menu on this page to let it read Jobber.'],
      capability_disabled: ['Live data is off in this view', 'Open the page in Claude to see live Jobber data.'],
      not_in_manifest: ['Jobber is turned off for this page', 'Turn Jobber back on in this page’s Permissions menu.'],
      server_not_connected: ['Connect Jobber', 'Add Jobber in claude.ai Settings, Connectors, then reload this page.'],
      needs_reauth: ['Reconnect Jobber', 'Jobber needs you to sign in again in claude.ai Settings, Connectors.'],
      approval_required: ['Jobber needs your OK', 'Allow Jobber for this page when Claude asks, then reload.'],
      blocked_by_policy: ['Jobber is blocked here', 'Your organisation’s settings block Jobber for this page.'],
      server_unavailable: ['Jobber is not answering right now', 'Give it a minute and reload the page.']
    };
    const m = map[code] || ['Something went wrong loading Jobber', (e && e.message) ? String(e.message).slice(0, 200) : 'Reload the page to try again.'];
    return h('div', { class: 'fz-error' }, h('p', { class: 'fz-setup-t' }, m[0]), h('p', null, m[1]));
  }

  const ctx = { jobber, jobberAll, pool, store, ui, fmt, agents: AGENTS, byKey, metric: (key, m) => { METRICS[key] = m; } };

  // ---------- App shell ----------
  let current = null;
  function renderNav(agent) {
    const g = GROUPS.find((x) => x.id === agent.group);
    return h('nav', { class: 'fz-nav', 'aria-label': 'Agents' },
      h('a', { href: '#all', class: 'fz-navhome' }, '← All agents'),
      h('a', { href: '#' + g.id, class: 'fz-navgroup' }, g.name));
  }

  // "Watch how it works" video for each agent. Links live in the store doc settings/videos as {<agent key>: url},
  // so Flowzyn can add or change one without republishing. Until a link exists the slot says the video is coming.
  let VIDEOS = null;
  // Explainer videos published with the app. settings/videos can add or override any of them.
  const VIDEO_FILES = {'quotes': 'videos/quotes.mp4', 'install-scheduler': 'videos/install-scheduler.mp4', 'builder-engine': 'videos/builder-engine.mp4', 'partner-finder': 'videos/partner-finder.mp4', 'local-search-check': 'videos/local-search-check.mp4', 'lost-quote-revival': 'videos/lost-quote-revival.mp4', 'morning-brief': 'videos/morning-brief.mp4', 'lead-catcher': 'videos/lead-catcher.mp4', 'quote-prep': 'videos/quote-prep.mp4', 'quote-chaser': 'videos/quote-chaser.mp4', 'yes-to-install': 'videos/yes-to-install.mp4', 'bill-it': 'videos/bill-it.mp4', 'get-paid': 'videos/get-paid.mp4', 'review-ask': 'videos/review-ask.mp4', 'come-back': 'videos/come-back.mp4' };
  function videoSlot(agent) {
    const btn = h('button', { type: 'button', class: 'fz-play', 'aria-label': 'Watch how ' + agent.name + ' works' });
    btn.innerHTML = '<span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z" fill="currentColor"/></svg></span>';
    btn.append(h('span', { class: 'tx' }, h('b', null, 'How it works'), h('span', null, 'Short video')));
    btn.onclick = () => {
      const url = VIDEOS && VIDEOS[agent.key];
      const embed = (u) => { const y = u.match(/(?:youtu\.be\/|v=)([\w-]{11})/); const v = u.match(/vimeo\.com\/(\d+)/); const l = u.match(/loom\.com\/share\/(\w+)/);
        return y ? 'https://www.youtube.com/embed/' + y[1] + '?autoplay=1' : v ? 'https://player.vimeo.com/video/' + v[1] + '?autoplay=1' : l ? 'https://www.loom.com/embed/' + l[1] + '?autoplay=1' : null; };
      let media;
      if (url && /\.(mp4|webm|mov)(\?|$)/i.test(url)) media = h('video', { src: url, controls: true, autoplay: true, playsinline: true });
      else if (url && embed(url)) media = h('iframe', { src: embed(url), allow: 'autoplay; fullscreen; picture-in-picture', allowfullscreen: true, title: 'How ' + agent.name + ' works' });
      else media = h('div', { class: 'fz-vm-soon' }, h('b', null, 'How ' + agent.name + ' works'), h('span', null, 'The 60 second video is coming soon.'));
      const close = h('button', { type: 'button', class: 'fz-vm-x', 'aria-label': 'Close video' }, '×');
      const box = h('div', { class: 'fz-vm', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'How ' + agent.name + ' works' }, h('div', { class: 'fz-vm-in' }, close, h('div', { class: 'fz-vm-media' }, media)));
      const shut = () => { box.remove(); document.removeEventListener('keydown', esc); };
      const esc = (e) => { if (e.key === 'Escape') shut(); };
      close.onclick = shut; box.onclick = (e) => { if (e.target === box) shut(); };
      document.addEventListener('keydown', esc);
      document.body.append(box); close.focus();
    };
    // A shop's own copy has no video files (Nov 10), so only links saved in settings/videos play there.
    const FILES = window.FZ_SHOP_COPY ? {} : VIDEO_FILES;
    const showIfAny = () => { btn.hidden = !(VIDEOS && VIDEOS[agent.key]); };
    btn.hidden = true;
    if (VIDEOS === null) store('settings/videos').then((d) => { VIDEOS = Object.assign({}, FILES, d || {}); }).catch(() => { VIDEOS = Object.assign({}, FILES); }).then(() => document.querySelectorAll('.fz-play').forEach((b) => { if (b.__show) b.__show(); }));
    btn.__show = showIfAny; showIfAny();
    return btn;
  }

  async function openBoard(key) {
    { const part = byKey(key); if (part && part.parent) { window.FZ.QTAB = part.tab || null; key = part.parent; } }
    const agent = byKey(key);
    const view = document.getElementById('fz-board');
    const home = document.getElementById('fz-home');
    if (!agent) { location.hash = '#all'; return; }
    showView('fz-board');
    current = key;
    const spec = BOARDS[key];
    const body = h('div', { class: 'fz-body' }, h('p', { class: 'fz-loading' }, 'Reading Jobber…'));
    view.replaceChildren(h('div', { class: 'fz-btop' },
      h('header', { class: 'fz-bhead' }, h('h1', { class: 'fz-title' }, agent.name), h('p', { class: 'fz-goal' }, h('span', null, 'Goal'), GOALS[agent.key] || agent.outcome), h('p', { class: 'fz-outcome' }, 'How: ' + agent.outcome.charAt(0).toLowerCase() + agent.outcome.slice(1))),
      h('div', { class: 'fz-bside' }, renderNav(agent), videoSlot(agent))),
      body,
      h('p', { class: 'fz-foot' }, spec && spec.source ? spec.source : ''));
    window.scrollTo(0, 0);
    document.title = agent.name + ' · Flowzyn Agents';
    if (!spec) { body.replaceChildren(ui.calm('This agent is on the build list.')); return; }
    if (locked(agent)) {
      body.replaceChildren(h('div', { class: 'fz-setup' },
        h('p', { class: 'fz-setup-t' }, agent.name + ' is part of ' + agent.groupName),
        h('p', null, agent.does + '. Tracks ' + agent.num.toLowerCase() + '.'),
        h('p', null, 'Add ' + agent.groupName + ' to your plan to switch it on. The Plan tab shows what it is worth from your own numbers.'),
        h('div', { class: 'fz-card-btns' }, h('a', { class: 'fz-btn', href: '#plan' }, 'See your plan'))));
      return;
    }
    try {
      const out = await spec.render(ctx, agent);
      if (current !== key) return;
      body.replaceChildren(...[].concat(out || []).filter(Boolean));
      if (window.FZ.rulesPanel) { const rp = window.FZ.rulesPanel(key); if (rp) body.append(rp); }
      // The glance visual always sits right under the status line, above cards and tables.
      const kids = [...body.children];
      const st = kids.find((k) => k.classList.contains('fz-status'));
      // Every visual goes above the cards, in the order the board gave them.
      const VIS = '.fz-bars, .fz-funnel, .be-weeks, .ls-grid, .fz-week, .qp-kit, .be-stages, svg.chart, .viz';
      const isVis = (k) => k !== st && !k.matches('details, .fz-how, .fz-tablebox') && (k.matches(VIS) || !!k.querySelector(VIS)) && !k.querySelector('.fz-cards, .fz-card');
      const firstCards = kids.find((k) => k.classList.contains('fz-cards') || k.classList.contains('fz-card') || !!k.querySelector('.fz-cards, .fz-card'));
      if (st && firstCards) {
        const cut = kids.indexOf(firstCards);
        let anchor = st;
        kids.filter((k, i) => i < cut && isVis(k)).forEach((k) => { anchor = k; });
        kids.filter((k, i) => i > cut && isVis(k)).forEach((k) => { anchor.after(k); anchor = k; });
      }
      // Every agent page: Summary tab first (numbers and charts), then the agent's work tab (cards to approve or send).
      if (!body.querySelector('.fz-subtabs')) {
        const all = [...body.children];
        const isAction = (k) => !k.matches('details') && (k.matches('.fz-cards, .fz-card, .fz-more, .tk-page') || !!k.querySelector('.fz-cards, .fz-card, .tk-page'));
        const tail = (k) => k.matches('.fz-how, .fz-source, .fz-video, .fz-watch');
        const action = all.filter(isAction);
        // Summary order: headline numbers first, then charts, then the lists.
        const rank = (k) => k.querySelector('.fz-kpis') || k.matches('.fz-kpis') ? 0 : k.matches('details, .fz-tablebox') || k.querySelector(':scope > .fz-tablebox') ? 2 : 1;
        const summary = all.filter((k) => k !== st && !isAction(k) && !tail(k)).map((k, i) => [k, i]).sort((x, y) => rank(x[0]) - rank(y[0]) || x[1] - y[1]).map((x) => x[0]);
        if (action.length && summary.length) {
          const head = action[0].querySelector('h2, h3');
          const fixed = (body.querySelector('[data-worklabel]') || {}).dataset;
          const n = body.querySelectorAll('.fz-card, .tp-row').length;
          const tabs = [
            { id: 'summary', label: 'Summary', n: null, kids: summary },
            { id: 'work', label: WORKTAB[key] ? WORKTAB[key] : fixed && fixed.worklabel ? fixed.worklabel : head ? head.textContent.replace(/^\d+\s*/, '').replace(/,.*$/, '').replace(/^./, (c) => c.toUpperCase()) : 'Ready for your OK', n, kids: action }
          ];
          TABPICK[key] = TABPICK[key] || 'summary';
          const bar = h('div', { class: 'fz-subtabs', role: 'tablist' });
          const panes = tabs.map((t) => h('div', { class: 'fz-tabbody', 'data-id': t.id }, ...t.kids));
          const paint = () => { bar.querySelectorAll('button').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.id === TABPICK[key]))); panes.forEach((p) => { p.hidden = p.dataset.id !== TABPICK[key]; }); };
          tabs.forEach((t) => { const b = h('button', { type: 'button', role: 'tab', 'data-id': t.id }, t.label, t.n != null ? h('span', { class: 'n' }, String(t.n)) : null); b.addEventListener('click', () => { TABPICK[key] = t.id; paint(); }); bar.append(b); });
          (st || body.firstChild).after(bar, ...panes);
          paint();
        }
      }
      // One clear order (Matt, Nov 7): headline, then what needs you biggest first, then the picture. The how to steps sit folded after the list.
      const need = body.querySelector('.ag-need'), hero = body.querySelector('.ag-hero');
      if (need && hero && hero.parentNode === need.parentNode && (hero.compareDocumentPosition(need) & Node.DOCUMENT_POSITION_FOLLOWING)) hero.before(need);
      if (window.FZ.doStrip) { const ds = window.FZ.doStrip(key); if (ds) { ds.open = false; const anchor = need || hero; if (anchor) anchor.after(ds); else { const st0 = body.querySelector(':scope > .fz-status'); if (st0) st0.after(ds); else body.prepend(ds); } } }
      paintMetrics();
    } catch (e) {
      if (current !== key) return;
      console.error(e);
      body.replaceChildren(errorView(e, agent));
      ERRS[key] = (e && e.code === 'no_mcp') ? null : 'Could not read Jobber';
      paintMetrics();
    }
  }

  // ---------- Agents tab ----------
  const tileNodes = {};
  const stored = {};   // metrics/<key> written by scheduled runs
  const runs = {};     // runs/<key>: {last, week, total}
  const settings = {}; // agents/<key>: {enabled}
  const POPULAR = [['builder-engine', 'Finds builders with new projects near you, drafts your intro, tracks replies.', true], ['quote-chaser', 'Follows up quotes after Jobber\u2019s reminders stop.'], ['get-paid', 'Friendly nudges for overdue invoices.']];
  const popNodes = [];
  const POP_KEYS = new Set(POPULAR.map((p) => p[0]));
  function buildPopular() {
    const box = document.getElementById('pops');
    if (!box) return;
    box.replaceChildren(...POPULAR.map(([key, line, big]) => {
      const a = byKey(key);
      const v = h('span', { class: 'tval', hidden: true });
      popNodes.push({ key, v });
      return h('a', { class: 'ov-pop' + (big ? ' big' : ''), href: '#a-' + key }, h('span', { class: 'step' }, a.groupName), h('span', { class: 'n' }, a.name), h('span', { class: 'd' }, line), v, h('span', { class: 'go' }, 'Open'));
    }));
  }
  // When each agent runs once installed (from its skill), and what a setup agent is waiting on.
  const SCHEDULE = { 'where-to-find-work': 'refreshed monthly', 'quotes': 'weekdays 6:30am', 'supplier-costs': 'whenever you load a new sheet', 'quick-capture': 'whenever you send something', 'price-book': 'Mondays 6:30am', 'install-scheduler': 'weekdays 6:30am',
    'builder-engine': 'Mondays 6:30am', 'lost-quote-revival': 'first Monday of the month', 'partner-finder': 'first Tuesday of the month', 'local-search-check': '1st of the month',
    'morning-brief': 'weekdays 6:30am', 'lead-catcher': 'weekdays 6:30am and 12:30pm', 'quote-prep': 'weekdays 6:30am', 'quote-chaser': 'weekdays 6:30am', 'replies': 'weekdays 6:30am and 12:30pm',
    'yes-to-install': 'weekdays 6:30am', 'week-board': 'weekdays 6:30am', 'bill-it': 'weekdays 6:30am', 'get-paid': 'weekdays 6:30am', 'month-close': '1st of the month',
    'weather-watch': 'daily 6:03am', 'crew-sheet': 'weekdays 3:30pm', 'cash-in': 'Mondays 6:30am', 'pay-bills': 'weekdays 6:30am', 'price-watch': 'Tuesdays 6:30am', 'own-permits': 'weekdays 6:30am',
    'add-on-finder': 'Mondays 6:30am', 'shop-handbook': 'when asked', 'review-ask': 'Thursdays 6:30am', 'review-watch': 'Mondays 6:30am', 'builder-keep': 'every other Wednesday',
    'come-back': '15th of the month', 'stand-behind-it': 'Mondays 6:30am'
  };
  // The outcome each agent is there to deliver, in one line.
  const OUTCOME = {"where-to-find-work": "Picks the neighbourhoods most likely to need glass, and shows why on a map.", "quotes": "Drafts a quote for every job you have visited, from your price list and similar past quotes, and creates the draft in Jobber for you to send.", "supplier-costs": "Reads your supplier's cost sheet from a photo, then prices every quote from the real glass and hardware cost plus your markup.", "quick-capture": "Turns anything asked for on site into a Jobber request, with a draft quote at your price book when you give the sizes.", "price-book": "Reads every past quote and builds your price book, so every new quote is priced the same way.", "install-scheduler": "Takes every yes from the supplier order to a booked day. It reads the delivery date from your supplier's email, lines up the first free days and writes the note asking the customer to pick one.", "builder-engine": "Finds builders with new projects near you and writes each an intro from you.", "lost-quote-revival": "Finds quotes archived 2 to 12 months ago and writes each customer a fresh offer.", "partner-finder": "Finds local businesses that can send you work and writes each an intro.", "local-search-check": "Checks where you show up in local searches and lists the fixes that move you up.", "morning-brief": "One page each weekday with what is ready for your OK and this week's wins.", "lead-catcher": "Spots new enquiries in Jobber and writes the reply that books a visit.", "quote-prep": "Drafts a priced quote after every site visit, from your past jobs and prices.", "quote-chaser": "Picks up quotes after Jobber's reminders stop and writes each follow up.", "replies": "Catches customers who said yes or asked for changes and writes your answer.", "yes-to-install": "Finds approved quotes with no job or date, drafts the order to your supplier, and shows what to book in Jobber.", "week-board": "Shows this week by crew, with late visits and open days.", "bill-it": "Finds finished jobs with no invoice, oldest first, and lines each one up so you invoice it in one tap in Jobber.", "get-paid": "Finds overdue invoices and writes a friendly payment reminder for each.", "month-close": "Checks the month is ready for your bookkeeper by day 3.", "weather-watch": "Checks this week's jobs against the forecast and drafts a heads up to customers.", "crew-sheet": "Builds a page per crew for tomorrow with addresses, notes and gate codes.", "cash-in": "Lists money due in the next 30 days, from invoices and deposits.", "pay-bills": "Lists supplier bills due this week and flags doubles and price jumps.", "price-watch": "Flags price list items selling too close to what they cost you.", "own-permits": "Tracks your own permits and inspections that hold up a final invoice.", "add-on-finder": "Spots extras that usually go with a job and are missing from a quote.", "shop-handbook": "Answers how you priced and described past work, from your own jobs.", "review-ask": "Picks customers who just paid and writes them a review request from you.", "review-watch": "Reads your reviews against nearby shops and writes a reply for each new one.", "builder-keep": "Shows your best builders and the ones you have not spoken to in a while.", "come-back": "Finds clients from 6 to 18 months ago with no work since and writes a check in.", "stand-behind-it": "Lists warranties ending soon and writes a check in before each one ends."};
  AGENTS.forEach((a) => { a.outcome = OUTCOME[a.key] || a.does; });
  const NEEDS = { 'review-watch': 'Needs a Google key', 'own-permits': 'Needs Gmail connected', 'pay-bills': 'Needs your books connected' };
  // What each agent keeps an eye on, for the owner's agent list.
  const WATCHES = { 'where-to-find-work': 'homes near you', 'quotes': 'jobs you have visited', 'supplier-costs': 'your supplier cost sheet', 'quick-capture': 'photos and notes from site', 'price-book': 'your past quotes', 'install-scheduler': 'approved work waiting on a day', 'builder-engine': 'builders with new projects', 'partner-finder': 'local businesses nearby', 'local-search-check': 'your Google Maps spot', 'lost-quote-revival': 'archived quotes', 'morning-brief': 'today\u2019s work', 'lead-catcher': 'new enquiries', 'quote-prep': 'site visits', 'quote-chaser': 'open quotes', 'yes-to-install': 'approved quotes', 'bill-it': 'finished jobs', 'get-paid': 'overdue invoices', 'review-ask': 'customers who just paid', 'come-back': 'past clients' };
  const ERRS = {};       // board errors seen this session
  const SETUP = {};      // setup/<step>: {done, at}
  const TASKS = {};      // tasks/<id>: {done, at}
  const SETTINGS = {};   // settings/<doc>: plan, goals, profile
  // The shop's own details, saved by the first time setup (settings/profile).
  // The shop's wider area for copy like 'across ...': profile region, else the town, else 'your area'.
  const region = () => { const p = SETTINGS.profile || {}; return String(p.region || '').trim() || String(p.place || '').split(',')[0].trim() || 'your area'; };
  // The shop's trade and its own words for what it does. Nothing here assumes a trade: a shop with no trade saved gets plain wording.
  const tradeOf = () => { const p = SETTINGS.profile || {}; return String(p.trade || (/glass|glazing/i.test(String(p.business || '')) ? 'glass' : '')).trim().toLowerCase(); };
  const isGlass = () => /glass|glazing/.test(tradeOf());
  const servicesOf = () => { const p = SETTINGS.profile || {}; const s = Array.isArray(p.services) ? p.services.filter(Boolean).join(', ') : String(p.services || '').trim(); return s || (isGlass() ? 'shower glass, mirrors and windows' : ''); };
  const w = {
    get weDo() { const s = servicesOf(); return s ? 'We do ' + s : 'We work'; },
    get services() { return servicesOf() || 'work like ours'; },
    get kind() { return isGlass() ? 'glass shop' : (tradeOf() ? tradeOf() + ' company' : 'contractor'); }
  };
  // The Flowzyn connector, when this account has it. Used for Operator hand offs and for the shop profile.
  async function toFlowzyn(tool, input) {
    try {
      const mcp = await Promise.race([getMcp(), new Promise((r) => setTimeout(() => r(null), 4000))]);
      if (!mcp) return null;
      for (const s of ['flowzyn', 'Flowzyn']) {
        try { const res = await mcp.callTool(s, tool, input || {}); let p = res && res.payload; if (typeof p === 'string') { try { p = JSON.parse(p); } catch (e) { /* text */ } } return p == null ? true : p; }
        catch (e) { /* try the other name */ }
      }
    } catch (e) { /* not connected */ }
    return null;
  }
  const me = () => {
    const p = SETTINGS.profile || {};
    const owner = String(p.owner || '').trim();
    return { owner, first: owner.split(/\s+/)[0] || '[your name]', business: String(p.business || '').trim() || '[your business]', website: p.website || '', place: String(p.place || '').trim(), town: String(p.place || '').split(',')[0].trim() || '[your town]', onboardedAt: p.onboardedAt || null };
  };
  const paintProfile = () => {
    const m = me();
    const has = !!String((SETTINGS.profile || {}).business || '').trim();
    document.querySelectorAll('[data-biz]').forEach((n) => { n.textContent = has ? m.business : 'your business'; });
    document.querySelectorAll('a[data-op]').forEach((a) => { a.href = opUrl(a.dataset.op); });
    document.querySelectorAll('a[data-custom]').forEach((a) => { a.href = customUrl(a.dataset.custom); });
    document.querySelectorAll('[data-biz-tail]').forEach((n) => { n.textContent = has ? ' \u00b7 ' + m.business : ''; });
  };
  const plan = () => (window.FZ.planOf ? window.FZ.planOf(SETTINGS.plan) : null);
  const locked = (a) => { const p = plan(); return !!(p && window.FZ.inPlan && !window.FZ.inPlan(a, p)); };
  const EXC = {};        // exceptions/<id>: {agent, title, detail, link, createdAt, status}
  const openExc = (key) => Object.values(EXC).filter((x) => x && x.status !== 'handled' && (!key || x.agent === key));
  const ago = (iso) => { const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000); return m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + 'h ago' : fmtDay(iso); };
  // Next run from a schedule line like 'weekdays 6:30am', 'Thursdays 6:30am', '1st of the month' or
  // 'first Monday of the month', in shop time. Gives 'Thu 6:30am', 'today 12:30pm' or 'Dec 1'. Null when it cannot tell.
  const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  function nextRun(when) {
    const w = String(when || '').toLowerCase();
    if (!w || /when asked|every other/.test(w)) return null;
    const times = (w.match(/\d{1,2}(:\d{2})?\s*(am|pm)/g) || []).map((t) => { const m = t.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/); return { h: (Number(m[1]) % 12) + (m[3] === 'pm' ? 12 : 0), m: Number(m[2] || 0), txt: t.replace(/\s+/g, '') }; }).sort((x, y) => x.h * 60 + x.m - (y.h * 60 + y.m));
    const p = {}; new Intl.DateTimeFormat('en-US', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(new Date()).forEach((x) => { p[x.type] = Number(x.value); });
    const nowMin = p.hour * 60 + p.minute;
    const nth = w.match(/(first|1st|second|2nd|third|3rd|fourth|4th) (\w+day) of the month/);
    const dom = w.match(/(\d{1,2})(st|nd|rd|th) of the month/);
    const wd = DAYS.findIndex((d) => w.indexOf(d) >= 0);
    for (let i = 0; i < 70; i++) {
      const d = new Date(Date.UTC(p.year, p.month - 1, p.day + i));
      const dow = d.getUTCDay(), date = d.getUTCDate();
      let ok;
      if (nth) ok = dow === DAYS.indexOf(nth[2]) && Math.ceil(date / 7) === ({ first: 1, '1st': 1, second: 2, '2nd': 2, third: 3, '3rd': 3, fourth: 4, '4th': 4 })[nth[1]];
      else if (dom) ok = date === Number(dom[1]);
      else if (/weekdays/.test(w)) ok = dow >= 1 && dow <= 5;
      else if (/daily|every day/.test(w)) ok = true;
      else if (wd >= 0) ok = dow === wd;
      else return null;
      if (!ok) continue;
      const t = times.length ? (i === 0 ? times.find((x) => x.h * 60 + x.m > nowMin) : times[0]) : (i === 0 ? null : {});
      if (!t) continue;
      const day = i === 0 ? 'today' : i < 7 ? d.toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short' }) : d.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' });
      return day + (t.txt ? ' ' + t.txt : '');
    }
    return null;
  }
  function health(a) {
    const s = settings[a.key];
    const r = runs[a.key];
    if (locked(a)) return { tone: 'grey', label: 'Not in plan', sub: 'Add ' + a.groupName, tip: 'Add this suite on the Plan tab' };
    if (s && s.enabled === false) return { tone: 'grey', label: 'Paused', sub: 'Turned off', tip: 'Paused by Flowzyn' };
    // The owner sees every agent in the plan running. Errors, setup and schedules are the Operator's to look after.
    if (!isOperator()) {
      const ownNeed = window.FZ && window.FZ.AGENT_NEEDS && window.FZ.AGENT_NEEDS[a.key];
      if (a.status === 'setup' && NEEDS[a.key] && !(ownNeed && window.FZ.setupDone && window.FZ.setupDone(ownNeed, SETUP))) return { tone: 'amber', label: 'Needs setup', sub: NEEDS[a.key], tip: 'Switches on once this is connected' };
      // Running means a run is on record. Before the first one, say so plainly.
      const ran = r && r.last;
      if (a.access === 'tap') return { tone: 'green', label: 'Running', sub: 'Lines it up, you tap once in Jobber', tip: 'Jobber does not let agents create this record, so you finish it in one tap' };
      if (!ran) return { tone: 'grey', label: 'Ready', sub: 'Starts with your next morning run', tip: 'No run on record yet' };
      if (r.lastStatus === 'error') return { tone: 'amber', label: 'Needs a look', sub: 'Last run hit a problem', tip: 'Flowzyn has been told' };
      const nx = (s && s.scheduled && s.nextRun && new Date(s.nextRun) > new Date()) ? (dayKey(s.nextRun) === dayKey(new Date().toISOString()) ? 'today' : fmtDay(s.nextRun).split(',')[0]) + ' ' + fmtTime(s.nextRun) : nextRun((s && s.scheduled && s.schedule) || SCHEDULE[a.key]);
      return { tone: 'green', label: 'Running', sub: nx ? 'Next run ' + nx : 'Runs when work comes in', tip: 'Runs on its own' + (SCHEDULE[a.key] ? ', ' + SCHEDULE[a.key] : '') };
    }
    if ((r && r.lastStatus === 'error') || ERRS[a.key]) return { tone: 'red', label: 'Error', sub: (r && r.lastStatus === 'error' && r.error) || ERRS[a.key] || 'Last run failed', tip: 'Flowzyn has been told' };
    const need = window.FZ && window.FZ.AGENT_NEEDS && window.FZ.AGENT_NEEDS[a.key];
    // agents/<key>.scheduled: a scheduled task runs this agent (schedule text and nextRun from the same doc).
    const sch = s && s.scheduled && !need ? s : null;
    const when = (sch && sch.schedule) || SCHEDULE[a.key];
    if (a.status === 'setup' && !sch && !(need && window.FZ.setupDone && window.FZ.setupDone(need, SETUP))) return { tone: 'amber', label: 'Needs setup', sub: NEEDS[a.key] || 'Needs a connection', tip: 'Finish setup to switch it on' };
    if (a.status === 'setup' && !sch && !(r && r.last)) return { tone: 'green', label: 'Active', sub: 'Connected, first run soon', tip: 'Connected in setup' };
    // Scheduled means a real scheduled task has run for this agent. Otherwise it only works when someone opens the page.
    if (r && r.last) return { tone: 'green', label: 'Scheduled', sub: 'Last ran ' + ago(r.last) + ', ' + (when || 'on schedule'), tip: 'A scheduled task runs this agent ' + (when || '') };
    if (sch) return { tone: 'green', label: 'Scheduled', sub: 'On. First run ' + (sch.nextRun ? fmtDay(sch.nextRun) + ' ' + fmtTime(sch.nextRun) : 'soon'), tip: 'A scheduled task runs this agent ' + (when || '') };
    return { tone: 'amber', label: 'Live view only', sub: 'Schedule not set up yet', tip: 'Reads Jobber when the page is opened. Its scheduled task is not set up yet.' };
  }
  function tile(a) {
    const t = h('a', { href: '#a-' + a.key, class: 'arow', 'data-key': a.key });
    const dot = h('span', { class: 'dot' });
    const stat = h('span', { class: 'astat' });
    const runsCell = h('span', { class: 'aruns' });
    const v = h('span', { class: 'tval', hidden: true });
    (tileNodes[a.key] = tileNodes[a.key] || []).push({ v, dot, stat, runsCell, a });
    t.append(dot,
      h('span', { class: 'amain' }, h('span', { class: 'tname' }, a.name), h('span', { class: 'tdo' }, GOALS[a.key] || a.outcome)),
      h('span', { class: 'ametric' }, v, h('span', { class: 'tnum' }, h('span', { class: 'tlab' }, 'Measures'), h('b', null, a.num))),
      stat, runsCell);
    t.dataset.text = (a.name + ' ' + a.does + ' ' + a.outcome + ' ' + a.num + ' ' + a.groupName + ' ' + (a.step || '')).toLowerCase();
    return t;
  }
  function paintMetrics() {
    popNodes.forEach(({ key, v }) => { const m = METRICS[key] || stored[key]; v.hidden = !(m && m.value); if (m && m.value) { v.textContent = m.value; v.title = [m.detail, m.asOf].filter(Boolean).join(' · '); } });
    const counts = { green: 0, amber: 0, red: 0, grey: 0 };
    let fires = 0;
    Object.values(tileNodes).forEach((nodes) => nodes.forEach(({ v, dot, stat, runsCell, a }) => {
      const m = METRICS[a.key] || stored[a.key];
      const has = !!(m && m.value);
      v.hidden = !has;
      const tnum = v.parentNode && v.parentNode.querySelector('.tnum');
      if (tnum) tnum.hidden = has;
      if (has) { v.textContent = m.value; v.title = [m.detail, m.asOf].filter(Boolean).join(' · '); }
      const hs = health(a);
      dot.className = 'dot ' + hs.tone; dot.title = hs.tip;
      stat.replaceChildren(h('b', null, hs.label), h('small', null, hs.sub));
      stat.className = 'astat ' + hs.tone; stat.title = hs.tip;
      const n = openExc(a.key).length;
      const r = runs[a.key];
      if (!isOperator()) {
        const ok = r && r.last && r.lastStatus !== 'error' && r.lastStatus !== 'skipped';
        runsCell.replaceChildren(h('span', null, ok ? 'Last ran ' + ago(r.last) : 'Watches ' + (WATCHES[a.key] || 'Jobber')));
      } else runsCell.replaceChildren(n ? h('span', { class: 'excbadge' }, plural(n, 'exception')) : h('span', null, r && r.week ? plural(r.week, 'run') + ' this week' : 'No runs yet'));
    }));
    AGENTS.filter(shown).forEach((a) => { counts[health(a).tone]++; const r = runs[a.key]; if (r && r.week) fires += r.week; });
    const nExc = openExc().length;
    const sum = document.getElementById('agsum');
    const nOn = AGENTS.filter((a) => shown(a) && !locked(a)).length;
    const foot = document.getElementById('agfoot');
    if (foot) foot.replaceChildren(h('span', { id: 'ntotal' }, String(isOperator() ? nOn : counts.green)), isOperator() ? ' agents. Every board reads Jobber live when you open it. Nothing is sent or changed from here.'
      : ' agents running' + (String((SETTINGS.profile || {}).business || '').trim() ? ' for ' + me().business : '') + '. Each board reads Jobber live.');
    if (sum && !isOperator()) sum.replaceChildren(...[
      h('span', { class: 'chip' }, h('span', { class: 'dot green' }), counts.green + ' running'),
      counts.green < nOn ? h('span', { class: 'chip' }, h('span', { class: 'dot grey' }), (nOn - counts.green) + ' not running yet') : null,
      fires ? h('span', { class: 'chip' }, plural(fires, 'run') + ' this week') : null].filter(Boolean));
    else if (sum) sum.replaceChildren(...[
      h('span', { class: 'chip' }, h('span', { class: 'dot green' }), counts.green + ' on a schedule'),
      counts.amber ? h('span', { class: 'chip' }, h('span', { class: 'dot amber' }), counts.amber + ' live view only') : null,
      counts.red ? h('span', { class: 'chip' }, h('span', { class: 'dot red' }), plural(counts.red, 'error')) : null,
      counts.grey ? h('span', { class: 'chip' }, h('span', { class: 'dot grey' }), counts.grey + ' not running yet') : null,
      h('span', { class: 'chip' }, plural(fires, 'run') + ' this week')].filter(Boolean));
    repaintDesk();
  }
  // Manual tasks (Operator): every exception an agent raised, every task the owner handed over and every task the Operator added.
  // The task itself lives in exceptions/<id> (status open, claimed, waiting or handled). Time lives on tasks/exc-<id>:
  // { entries: [{min, at, note}], totalMin, runningSince, done, doneNote }.
  const manualKey = (excId) => 'exc-' + excId;
  const manualList = () => Object.values(EXC).filter((x) => x && x.id).map((x) => Object.assign({}, x, { time: TASKS[manualKey(x.id)] || {} }));
  async function saveTaskDoc(id, patch) {
    try {
      const db = await getDb(); if (!db) return false;
      const next = Object.assign({}, TASKS[id] || {}, patch, { at: new Date().toISOString() });
      await db.doc('tasks/' + id).set(next); TASKS[id] = next; return true;
    } catch (e) { return false; }
  }
  // One save for a manual task: the exception doc and its time doc together.
  async function saveManual(excId, excPatch, timePatch) {
    const x = EXC[excId]; if (!x) return false;
    if (excPatch && !(await setExc(x, excPatch))) return false;
    if (timePatch && !(await saveTaskDoc(manualKey(excId), timePatch))) return false;
    return true;
  }
  async function addManual(o) {
    const id = 'man-' + Date.now().toString(36);
    const at = new Date().toISOString();
    const ex = { agent: o.agent || null, title: String(o.title || '').trim(), detail: '', link: o.link || null, createdAt: at, status: 'open', from: 'operator', addedBy: opName() || 'Operator' };
    try {
      const db = await getDb(); if (!db) return false;
      await db.doc('exceptions/' + id).set(ex); EXC[id] = Object.assign({ id }, ex);
      if (TASKLIST) TASKLIST.push({ id: manualKey(id), agent: ex.agent, kind: 'Exception', score: 9000, title: ex.title, link: ex.link });
      paintBell(); return true;
    } catch (e) { return false; }
  }

  function buildHome() {
    buildPopular();
    document.getElementById('ntotal').textContent = AGENTS.length;
    const tabs = document.getElementById('tabs');
    const box = document.getElementById('groups');
    const views = [{ id: 'all', name: 'All' }, { id: 'popular', name: 'Core' }, ...GROUPS];
    tabs.replaceChildren(...views.map((v) => {
      const n = v.id === 'all' ? AGENTS.filter(shown).length : v.id === 'popular' ? CORE.length : AGENTS.filter((a) => a.group === v.id && shown(a)).length;
      return h('a', { class: 'tab', href: '#' + v.id, 'data-id': v.id }, v.name, h('span', null, String(n)));
    }));
    box.replaceChildren(...GROUPS.map((g) => h('section', { class: 'group', 'data-id': g.id },
      h('div', { class: 'ghead' }, h('h2', null, g.name), h('p', null, g.line)),
      g.sets.map((s) => h('div', { class: 'set' }, s.title ? h('p', { class: 'sub' }, s.title) : null,
        h('div', { class: 'alist' }, s.agents.filter(shown).map((a) => tile(a))))))));
    document.getElementById('ntotal').textContent = AGENTS.filter(shown).length;
    const lead = document.getElementById('ownerline');
    if (lead) lead.textContent = 'Each agent does one job from start to finish. You approve, they do the rest. Core agents bring in the most money.';
  }

  function showView(which) {
    ['fz-overview', 'fz-tasks', 'fz-home', 'fz-board', 'fz-setupview', 'fz-plan', 'fz-welcome', 'fz-operator'].forEach((id) => { document.getElementById(id).hidden = id !== which; });
    document.querySelectorAll('.apptab').forEach((t) => t.setAttribute('aria-current', t.dataset.view === (which === 'fz-board' ? 'fz-home' : which) ? 'page' : 'false'));
  }

  function showHome(pick) {
    showView('fz-home');
    current = null;
    document.title = 'Agents · Flowzyn';
    const q = document.getElementById('q');
    const words = q.value.toLowerCase().split(/\s+/).filter(Boolean);
    document.querySelectorAll('#tabs .tab').forEach((t) => t.setAttribute('aria-current', t.dataset.id === pick ? 'true' : 'false'));
    let shown = 0;
    document.querySelectorAll('#groups .group').forEach((s) => {
      let inGroup = 0;
      s.querySelectorAll('.set').forEach((set) => {
        let inSet = 0;
        set.querySelectorAll('.arow').forEach((t) => { const hit = words.every((w) => t.dataset.text.includes(w)) && (pick !== 'popular' || CORE.includes(t.dataset.key)); t.hidden = !hit; if (hit) inSet++; });
        set.hidden = inSet === 0; inGroup += inSet;
      });
      s.hidden = (pick !== 'all' && pick !== 'popular' && s.dataset.id !== pick) || inGroup === 0;
      if (!s.hidden) shown += inGroup;
    });
    document.getElementById('empty').hidden = shown > 0;
    paintMetrics();
  }

  let overviewDone = false;
  async function showOverview() {
    showView('fz-overview');
    current = null;
    document.title = me().business + ' · Flowzyn';
    if (overviewDone || !window.FZ.overview) return;
    overviewDone = true;
    const box = document.getElementById('fz-overview');
    box.replaceChildren(h('p', { class: 'fz-loading' }, 'Reading Jobber…'));
    try {
      if (!SETTINGS.plan) { const p = await store('settings/plan'); if (p) SETTINGS.plan = p; }
      const out = await window.FZ.overview(ctx);
      box.replaceChildren(...[].concat(out || []).filter(Boolean));
    } catch (e) {
      console.error(e);
      overviewDone = false;
      box.replaceChildren(errorView(e, { name: 'Overview' }));
    }
  }

  async function saveSetup(id, on) {
    try { const db = await getDb(); if (!db) return false; const next = Object.assign({}, SETUP[id] || {}, (on && typeof on === 'object') ? on : { done: !!on }, { at: new Date().toISOString() }); await db.doc('setup/' + id).set(next); SETUP[id] = next; return true; }
    catch (e) { return false; }
  }
  async function showSetup() {
    showView('fz-setupview');
    current = null;
    document.title = 'Finish setup \u00b7 Flowzyn';
    const box = document.getElementById('fz-setupview');
    const save = async (id, on) => {
      try { const db = await getDb(); if (!db) return false; const next = Object.assign({}, SETUP[id] || {}, (on && typeof on === 'object') ? on : { done: !!on }, { at: new Date().toISOString() }); await db.doc('setup/' + id).set(next); SETUP[id] = next; showSetup(); paintMetrics(); return true; }
      catch (e) { return false; }
    };
    if (window.FZ.renderSetup) box.replaceChildren(...window.FZ.renderSetup(ctx, SETUP, save).filter(Boolean));
  }

  // Notification bell: tasks the agents need a person to do, linking straight to the record.
  let TASKLIST = null;
  function openCount() { return TASKLIST ? TASKLIST.filter((t) => !(TASKS[t.id] && TASKS[t.id].done)).length : 0; }
  function paintBell() {
    // One total everywhere: the bell, the Tasks tab and the Overview all count every open task.
    const n = openCount();
    const b = document.getElementById('bell-count');
    const bell = document.getElementById('fz-bell');
    if (!b || !bell) return;
    b.textContent = n > 99 ? '99+' : String(n);
    b.hidden = !n;
    bell.setAttribute('aria-label', n ? n + ' things to do' : 'Nothing to do');
    const tc = document.getElementById('tab-taskcount');
    if (tc) { tc.textContent = n > 99 ? '99+' : String(n); tc.hidden = !n; }
    if (current === 'tasks') showTasks();
    repaintDesk();
    if (window.FZ.paintToday) window.FZ.paintToday();
  }
  async function loadTasks() {
    if (!window.FZ.buildTasks) return;
    try { TASKLIST = (await window.FZ.buildTasks(ctx)).filter((t) => { const a = byKey(t.agent); return (t.kind === 'Exception' ? true : (!!a && !locked(a))) && (isOperator() || t.kind !== 'Exception'); }); } catch (e) { TASKLIST = null; }
    paintBell(); paintPanel();
  }
  function paintPanel() {
    const panel = document.getElementById('fz-panel');
    if (!panel || panel.hidden) return;
    if (!TASKLIST) { panel.replaceChildren(h('p', { class: 'fz-loading' }, 'Reading Jobber…')); return; }
    const save = saveTask;
    panel.replaceChildren(...window.FZ.renderTaskPanel(ctx, TASKLIST, TASKS, save).filter(Boolean));
  }
  // Queue an email to go out from the owner's email on the next run.
  async function queueSend(id, ob) {
    try {
      const db = await getDb(); if (!db) return false;
      const rec = { done: true, at: new Date().toISOString(), outbox: Object.assign({ queuedAt: new Date().toISOString() }, ob) };
      await db.doc('tasks/' + id).set(rec); TASKS[id] = rec; return true;
    } catch (e) { return false; }
  }
  // Mark a task done, or hand it to the Operator: it leaves the owner's list and lands in the Operator's queue.
  async function saveTask(id, on, hand) {
    try {
      const db = await getDb(); if (!db) return false;
      const at = new Date().toISOString();
      if (hand) {
        const ex = { agent: hand.agent || null, title: hand.title, detail: [hand.meta, (hand.approved ? 'Approved by ' : 'Handed over by ') + me().first].filter(Boolean).join(' · '), approved: !!hand.approved, draft: hand.draft || null, link: hand.link || null, createdAt: at, status: 'open', from: 'owner' };
        await db.doc('exceptions/task-' + id).set(ex); EXC['task-' + id] = Object.assign({ id: 'task-' + id }, ex);
        // Handed to the Operator: tell Flowzyn through the connector, so a person sees it. The record and its link, no contact details.
        if (!hand.approved) toFlowzyn('hand_to_operator', { agent: (byKey(hand.agent) || {}).name || undefined, what: [hand.title, hand.meta, hand.link].filter(Boolean).join(' \u00b7 ').slice(0, 600), urgency: 'today' });
      }
      const rec = { done: on, at }; if (hand) rec.handed = true;
      await db.doc('tasks/' + id).set(rec); TASKS[id] = rec; paintBell(); return true;
    } catch (e) { return false; }
  }
  function initBell() {
    const bell = document.getElementById('fz-bell');
    const panel = document.getElementById('fz-panel');
    if (!bell || !panel) return;
    const close = () => { panel.hidden = true; bell.setAttribute('aria-expanded', 'false'); };
    bell.addEventListener('click', (e) => { e.stopPropagation(); close(); location.hash = '#tasks'; });
    document.addEventListener('click', (e) => { if (!panel.hidden && !panel.contains(e.target) && e.target !== bell) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    window.addEventListener('hashchange', close);
  }

  // Tasks tab: everything the agents need a person to do, biggest dollars first.
  function showTasks() {
    showView('fz-tasks');
    current = 'tasks';
    document.title = 'Tasks \u00b7 Flowzyn';
    const box = document.getElementById('fz-tasks');
    // Operator view: Tasks and the Operator tab are one place, the Operator desk board.
    if (isOperator()) { location.replace('#operator'); return; }
    if (!TASKLIST) { box.replaceChildren(h('header', { class: 'ov-hero' }, h('h1', { class: 'home' }, 'Your tasks')), h('p', { class: 'fz-loading' }, 'Reading Jobber\u2026')); return; }
    const save = saveTask;
    const open = TASKLIST.filter((t) => !(TASKS[t.id] && TASKS[t.id].done));
    const dollars = open.reduce((n, t) => n + (Number(t.amount) || 0), 0);
    const parts = window.FZ.renderTaskPanel(ctx, TASKLIST, TASKS, save).filter(Boolean);
    const list = parts.find((p) => p.classList && p.classList.contains('tp-list'));
    box.replaceChildren(...[
      h('header', { class: 'ov-hero' }, h('h1', { class: 'home' }, 'Your tasks')),
      ui.status(!open.length ? ['All caught up. The agents add tasks here as they run.']
        : isOperator() ? [{ b: fmt.plural(open.length, 'thing') }, ' to do', dollars ? [', ', { b: fmt.money(dollars, { short: true }) }, ' riding on them.'] : '.']
        : [{ b: String(open.length) }, ' ready for your OK, biggest first.']),
      open.length ? h('p', { class: 'fz-sub' }, isOperator() ? 'Biggest dollars first. Tick one off when it is done. Each button opens the record in Jobber.' : 'Read it, approve it, and your agents send it today. Mark anything you already dealt with as handled.') : null,
      tkStats(open, dollars),
      list ? h('section', { class: 'tk-page' }, list) : null,
      null].filter(Boolean));
  }
  // What got done this week: by the owner, by the agents (Matt, Nov 10).
  function tkStats(open, dollars) {
    const wk = Date.now() - 7 * 86400000;
    const recent = Object.values(TASKS).filter((d) => d && d.done && d.at && new Date(d.at).getTime() >= wk);
    const byYou = recent.filter((d) => !d.handed).length;
    const sent = recent.filter((d) => d.handed).length;
    const runsWk = Object.values(runs).reduce((n, r) => n + ((r && Number(r.week)) || 0), 0);
    const tile = (n, label, sub, hi) => h('div', { class: 'tk-stat' + (hi ? ' hi' : '') }, h('b', null, String(n)), h('span', null, label), sub ? h('small', null, sub) : null);
    return h('div', { class: 'tk-stats' },
      tile(open.length, 'waiting for you', dollars ? fmt.money(dollars, { short: true }) + ' riding on them' : null, true),
      tile(byYou, 'done by you', 'this week, called or handled'),
      tile(sent, 'approved, sent by your agents', 'this week'),
      tile(runsWk, 'agent runs', 'this week, on their own'));
  }

  async function showPlan() {
    showView('fz-plan');
    current = 'plan';
    document.title = 'Your plan \u00b7 Flowzyn';
    const box = document.getElementById('fz-plan');
    box.replaceChildren(h('p', { class: 'fz-loading' }, 'Reading Jobber\u2026'));
    const save = async (patch) => {
      try { const db = await getDb(); if (!db) return false; const next = Object.assign({}, SETTINGS.plan || {}, patch, { updatedAt: new Date().toISOString() }); await db.doc('settings/plan').set(next); SETTINGS.plan = next; showPlan(); paintMetrics(); return true; }
      catch (e) { return false; }
    };
    try { const out = await window.FZ.renderPlan(ctx, SETTINGS.plan, save); if (current === 'plan') box.replaceChildren(...out.filter(Boolean)); }
    catch (e) { console.error(e); if (current === 'plan') box.replaceChildren(errorView(e, { name: 'Plan' })); }
  }

  // First time setup: name, website, tools, how it works, then the dashboard.
  let welcomeOpen = false;
  function needsWelcome() { return !!(window.FZ.renderWelcome && DBOK && !me().onboardedAt); }
  async function showWelcome() {
    showView('fz-welcome');
    current = 'welcome';
    welcomeOpen = true;
    document.body.classList.add('fz-onboarding');
    document.title = 'Welcome \u00b7 Flowzyn';
    const box = document.getElementById('fz-welcome');
    const save = async (patch) => {
      try {
        const db = await getDb(); if (!db) return false;
        const next = Object.assign({}, SETTINGS.profile || {}, patch, { updatedAt: new Date().toISOString() });
        await db.doc('settings/profile').set(next); SETTINGS.profile = next; paintProfile(); return true;
      } catch (e) { return false; }
    };
    const saveSetup = async (id, patch) => {
      try { const db = await getDb(); if (!db) return false; const next = Object.assign({}, SETUP[id] || {}, patch, { at: new Date().toISOString() }); await db.doc('setup/' + id).set(next); SETUP[id] = next; return true; }
      catch (e) { return false; }
    };
    const finish = () => { welcomeOpen = false; document.body.classList.remove('fz-onboarding'); overviewDone = false; location.hash = '#overview'; route(); paintMetrics(); };
    box.replaceChildren(...window.FZ.renderWelcome(ctx, { profile: SETTINGS.profile || {}, setup: SETUP, save, saveSetup, finish }).filter(Boolean));
  }

  // Operator desk (editors only): what the owner handed over, a task board, agent health and templates to approve.
  let deskTimer = null;
  function repaintDesk() {
    if (current !== 'operator' || !isOperator()) return;
    const box = document.getElementById('fz-operator');
    if (box && box.contains(document.activeElement) && /TEXTAREA|INPUT|SELECT/.test(document.activeElement.tagName)) return;
    clearTimeout(deskTimer); deskTimer = setTimeout(() => { if (current === 'operator' && isOperator()) showOperatorDesk(); }, 150);
  }
  const deskCol = (x) => {
    const s = x.status || 'open';
    if (s === 'handled') return x.handledAt && dayKey(x.handledAt) === dayKey(new Date().toISOString()) ? 'done' : null;
    if (s === 'claimed') return 'claimed';
    if (s === 'waiting') return 'waiting';
    return 'new';
  };
  async function setExc(x, patch) {
    try {
      const db = await getDb(); if (!db) return false;
      const next = Object.assign({}, x, patch); delete next.id;
      await db.doc('exceptions/' + x.id).set(next); EXC[x.id] = Object.assign({ id: x.id }, next); return true;
    } catch (e) { return false; }
  }
  const senderOf = (x) => { const m = /(?:Handed over|Approved) by ([^·]+)/.exec(String(x.detail || '')); return (m && m[1].trim()) || me().first; };
  const cleanDetail = (x) => String(x.detail || '').split(' · ').filter((p) => !/^(Handed over|Approved) by /.test(p)).join(' · ');
  // Operator desk: one board for every manual task, then this week, then agent health (folded).
  async function approveManual(x, text) {
    const at = new Date().toISOString();
    if (/^template-/.test(x.id)) {
      const key = x.id.slice(9);
      try { const db = await getDb(); if (!db) return false; const next = Object.assign({}, SETTINGS['template-' + key] || {}, { status: 'approved', text, approvedBy: opName() || 'Operator', approvedAt: at }); await db.doc('settings/template-' + key).set(next); SETTINGS['template-' + key] = next; } catch (e) { return false; }
      return saveManual(x.id, { status: 'handled', handledAt: at, handledBy: opName() || 'Operator', doneNote: 'Approved the message' }, { done: true, doneNote: 'Approved the message' });
    }
    // An email task: approved as edited, it goes out from the owner's email on the next run.
    return saveManual(x.id, { status: 'handled', handledAt: at, handledBy: opName() || 'Operator', draft: text, doneNote: 'Approved the email to go out' },
      { done: true, doneNote: 'Approved the email to go out', outbox: { queuedAt: at, who: x.title || '', link: x.link || null, draft: text } });
  }
  function showOperatorDesk() {
    const box = document.getElementById('fz-operator');
    if (!window.FZ.renderBoard) return;
    const now = new Date().toISOString();
    const sched = AGENTS.filter((a) => (settings[a.key] && settings[a.key].scheduled) || (runs[a.key] && runs[a.key].last));
    const tone = (a) => { const r = runs[a.key] || {}; const s = String(r.lastStatus || r.status || '').toLowerCase(); return s === 'error' ? ['red', 'Error'] : s === 'skipped' ? ['amber', 'Skipped'] : r.last ? ['green', 'OK'] : ['grey', 'No run yet']; };
    const bad = sched.filter((a) => tone(a)[0] === 'red').length;
    const healthFold = sched.length ? h('details', { class: 'mt-card mt-fold' },
      h('summary', null, h('b', null, 'Agent health'), ' ' + plural(sched.length, 'scheduled agent') + (bad ? ', ' + plural(bad, 'error') : ', all running')),
      h('div', { class: 'opd-health' }, sched.map((a) => { const r = runs[a.key] || {}; const s = settings[a.key] || {}; const [tn, lb] = tone(a);
        return h('a', { class: 'opd-hrow', href: '#a-' + a.key, title: tn === 'red' && r.error ? String(r.error) : lb },
          h('span', { class: 'dot ' + tn, 'aria-label': lb }),
          h('span', { class: 'opd-hname' }, a.name.replace(/ Agent$/, '')),
          h('span', { class: 'opd-hmeta' }, (r.last ? 'Ran ' + ago(r.last) : 'Not run yet') + ' · ' + lb),
          h('span', { class: 'opd-hmeta' }, s.nextRun ? 'Next ' + (dayKey(s.nextRun) === dayKey(now) ? 'today' : fmtDay(s.nextRun)) + ' ' + fmtTime(s.nextRun) : 'Next run not set'));
      }))) : null;
    const jobber = TASKLIST ? TASKLIST.filter((t) => t.kind !== 'Exception') : null;
    box.replaceChildren(...window.FZ.renderBoard(ctx, { list: manualList(), jobber, done: TASKS, save: saveTask, saveManual, addManual, approve: approveManual, extra: healthFold, repaint: () => { if (current === 'operator' && isOperator()) showOperatorDesk(); } }).filter(Boolean));
  }

  // Operator tab: what a Flowzyn Operator picks up, and how to add one.
  function showOperator() {
    showView('fz-operator');
    current = 'operator';
    document.title = 'Operator \u00b7 Flowzyn';
    if (isOperator()) return showOperatorDesk();
    const box = document.getElementById('fz-operator');
    // Operator in the plan: only the report of what was sent, what was done and the time it took.
    if (hasOperator()) { box.replaceChildren(...[].concat(window.FZ.renderOpReport ? window.FZ.renderOpReport(ctx, { list: manualList() }) : []).filter(Boolean)); return; }
    // No Operator yet: the same simple pitch as flowzyn.com/operator.
    const ICON = {
      phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/>',
      flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
      cal: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
      truck: '<path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/>',
      check: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l3 3 5-6"/>',
      file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>'
    };
    const ico = (k) => { const i = h('span', { class: 'opx-ico', 'aria-hidden': 'true' }); i.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICON[k] + '</svg>'; return i; };
    box.replaceChildren(h('div', { class: 'opp' },
      h('header', { class: 'opp-hero' },
        h('p', { class: 'opp-eb' }, 'For Flowzyn clients'),
        h('h1', { class: 'opp-h' }, 'Need a hand? ', h('b', null, 'Ask your human Operator.')),
        h('p', { class: 'opp-p' }, 'Your agents do the daily office work. When something needs a person, add a human Operator: a real person on the Flowzyn team who makes the calls and does the manual steps your agents can\u2019t. Your Operator comes with your agents.')),
      h('div', { class: 'opp-grid' },
        h('section', null,
          h('h2', { class: 'fz-h2' }, 'What your Operator picks up'),
          h('p', { class: 'fz-sub' }, 'Work that has to be done by hand, is worth money, and your agents can\u2019t do in your tools.'),
          h('div', { class: 'opp-items' }, [
            ['phone', 'Calls that bring money in', 'Phoning a big quote that went quiet or an overdue invoice, and agreeing a date.'],
            ['flag', 'Exceptions your agents flag', 'A payment that doesn\u2019t match, a quote missing prices, a job with no address.'],
            ['cal', 'Booking site visits', 'Calling a new enquiry back and putting the visit on your calendar in Jobber.'],
            ['truck', 'Supplier and builder calls', 'Parts lead times, chasing an order, getting a start date from a builder.'],
            ['check', 'Matching payments in QuickBooks', 'A check or bank transfer that came in but was never marked paid.'],
            ['file', 'Paperwork on other sites', 'Warranty registrations, permit lookups, insurance certificates, supplier portals.']
          ].map(([k, t, d]) => h('div', { class: 'opp-item' }, ico(k), h('div', null, h('b', null, t), h('p', null, d)))))),
        h('aside', { class: 'opp-add' },
          h('h2', { class: 'fz-h2' }, 'Add an Operator to your agents'),
          h('p', { class: 'fz-sub' }, 'Book a free audit. We\u2019ll look at your office together and set up your agents and your Operator.'),
          h('div', { class: 'fz-card-btns' }, extLink('https://cal.com/flowzyn/flowzyn-15', 'Get a Free Audit', 'fz-btn act'))))));
  }

  function route() {
    const hash = (location.hash || '#overview').slice(1);
    if (hash === 'welcome' || needsWelcome()) { if (!welcomeOpen) showWelcome(); return; }
    document.body.classList.remove('fz-onboarding');
    // Operator view is the Operator desk only. The owner screens live behind See owner view.
    if (isOperator() && !hash.startsWith('a-') && hash !== 'operator') { location.replace('#operator'); return; }
    // Connect is the new screen (Matt, Nov 10: roll back, keep the connect screen as it is now).
    if (window.FZ.v3 && window.FZ.v3.connect && !isOperator() && (hash === 'setup' || hash === 'connect' || hash === 'autoapprove' || hash === 'templates' || /^(tpl|shop)-/.test(hash))) {
      showView('fz-setupview');
      const box = document.getElementById('fz-setupview');
      Promise.resolve(window.FZ.v3.connect(box, hash, { SETUP, save: saveSetup })).catch((e) => { console.error(e); box.replaceChildren(errorView(e, { name: 'Connect' })); });
      window.scrollTo(0, 0);
      return;
    }
    if (hash === 'setup') return showSetup();
    if (hash === 'tasks') return showTasks();
    // Plan is hidden for now (Matt, Nov 7). The screen stays in plan.js for later.
    if (hash === 'plan') { location.replace('#overview'); return; }
    if (hash === 'operator') return showOperator();
    if (hash.startsWith('a-')) return openBoard(hash.slice(2));
    if (hash === 'overview' || hash === '') return showOverview();
    const pick = ['all', 'popular', ...GROUPS.map((g) => g.id)].includes(hash) ? hash : (hash === 'agents' ? 'all' : null);
    if (!pick) return showOverview();
    showHome(pick);
  }

  // ---------- Theme ----------
  function initTheme() {
    const btn = document.getElementById('fz-theme');
    const SUN = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"></circle><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"></path></svg>';
    const MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"></path></svg>';
    const apply = (mode) => {
      document.documentElement.setAttribute('data-theme', mode);
      btn.innerHTML = (mode === 'dark' ? SUN : MOON) + '<span>' + (mode === 'dark' ? 'Light' : 'Dark') + '</span>';
      btn.setAttribute('aria-label', mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
    };
    // Flowzyn always opens dark, whatever the viewer's own theme says. The button switches to light for this visit only.
    let chosen = 'dark';
    apply(chosen);
    btn.addEventListener('click', () => { chosen = chosen === 'dark' ? 'light' : 'dark'; apply(chosen); });
    // If the page host sets its own theme on the page, put ours back.
    try { new MutationObserver(() => { if (document.documentElement.getAttribute('data-theme') !== chosen) apply(chosen); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] }); } catch (e) { /* fine */ }
  }

  // Editors only: switch between the Operator view and what the owner sees.
  function setView(v, hash) {
    try { localStorage.setItem('fz-view', v); } catch (e) { /* view stays as is */ }
    document.body.classList.toggle('fz-owner', !isOperator());
    const vb = document.querySelector('.viewbtn'); if (vb) vb.textContent = isOperator() ? 'See owner view' : 'Back to Operator view';
    buildHome(); overviewDone = false; loadTasks();
    if (hash && location.hash !== hash) location.hash = hash; else route();
    paintMetrics();
  }
  function initView() {
    document.body.classList.toggle('fz-owner', !isOperator());
    if (!window.FZ.CAN_EDIT || window.FZ_SHOP_COPY) return;
    const util = document.querySelector('.util');
    const b = h('button', { type: 'button', class: 'themebtn viewbtn' });
    const paint = () => { b.textContent = isOperator() ? 'See owner view' : 'Back to Operator view'; };
    paint();
    b.addEventListener('click', () => {
      try { localStorage.setItem('fz-view', isOperator() ? 'owner' : 'operator'); } catch (e) { /* view stays as is */ }
      document.body.classList.toggle('fz-owner', !isOperator());
      paint(); buildHome(); overviewDone = false; loadTasks(); route(); paintMetrics();
    });
    if (util) util.prepend(b);
  }

  // Refresh: read everything from Jobber again and redraw this screen.
  function initRefresh() {
    const util = document.querySelector('.util');
    if (!util) return;
    const ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.6-6.4"></path><path d="M21 3v6h-6"></path></svg>';
    const b = h('button', { type: 'button', class: 'themebtn', 'aria-label': 'Refresh from Jobber' });
    const paint = (busy) => { b.innerHTML = ICON + '<span>' + (busy ? 'Refreshing' : 'Refresh') + '</span>'; b.disabled = !!busy; };
    paint(false);
    b.addEventListener('click', () => {
      paint(true); FRESH = true; memo.clear(); EMAILS.clear();
      overviewDone = false; loadTasks(); route(); paintMetrics();
      setTimeout(() => { FRESH = false; paint(false); }, 8000);
    });
    util.append(b);
  }

  // Schedule Installs is one agent from the customer's yes to the booked day (Matt, Nov 8). The yes list and supplier
  // order come first, then the delivery and booking board, on one page.
  function mergeScheduleInstalls() {
    const IS = BOARDS['install-scheduler'], YI = BOARDS['yes-to-install'];
    if (!IS || !YI || IS.merged) return;
    const own = IS.render;
    IS.merged = true;
    IS.render = async function (ctx, a) {
      const safe = (p) => Promise.resolve().then(p).then((x) => [].concat(x || []).filter(Boolean)).catch((e) => { console.error(e); return []; });
      const [yes, rest] = await Promise.all([safe(() => YI.render(ctx, byKey('yes-to-install'))), safe(() => own.call(IS, ctx, a))]);
      if (!yes.length) return rest;
      // One headline on the page: the second part's headline becomes a quiet lead line.
      rest.forEach((n) => { if (n.classList && n.classList.contains('fz-status')) { n.classList.remove('fz-status'); n.classList.add('qj-lead'); } });
      return yes.concat(rest);
    };
  }

  let DBOK = false;
  async function start() {
    // Read the shop profile before the first screen so new shops start at the first time setup.
    try {
      const db = await Promise.race([getDb(), new Promise((r) => setTimeout(() => r(null), 4000))]);
      if (db) { DBOK = true; const p = await store('settings/profile'); if (p) SETTINGS.profile = p; const aa = await store('settings/autoapprove').catch(() => null); if (aa) SETTINGS.autoapprove = aa; }
      // Set up Flowzyn already asked the owner who they are. Take the profile from there, so this app never asks again.
      const cur = SETTINGS.profile || {};
      if (db && (!cur.onboardedAt || !cur.trade || !cur.timeZone)) {
        const st = await Promise.race([toFlowzyn('flowzyn_status', {}), new Promise((r) => setTimeout(() => r(null), 3500))]);
        const fp = st && typeof st === 'object' && st.profile;
        if (fp && fp.business) {
          const from = { business: fp.business, owner: fp.owner || fp.ownerFirstName || '', place: fp.place || '', website: fp.website || '', trade: fp.trade || '', services: fp.services || '', timeZone: fp.timeZone || '' };
          const next = Object.assign({}, cur);
          Object.keys(from).forEach((k) => { if (!String(next[k] || '').trim() && from[k]) next[k] = from[k]; });
          if (!next.onboardedAt && next.business && next.owner) { next.onboardedAt = new Date().toISOString(); next.welcomeStep = null; }
          if (JSON.stringify(next) !== JSON.stringify(cur)) { try { await db.doc('settings/profile').set(next); SETTINGS.profile = next; } catch (e) { /* stays as it was */ } }
        }
      }
      if (SETTINGS.profile && SETTINGS.profile.timeZone) { try { new Intl.DateTimeFormat('en-US', { timeZone: SETTINGS.profile.timeZone }); TZ = SETTINGS.profile.timeZone; } catch (e) { /* keep the default */ } }
    } catch (e) { /* the app still works without a profile */ }
    mergeScheduleInstalls();
    // The owner's own email templates, before any board writes a draft.
    try { if (window.FZ.tpl && window.FZ.tpl.load) await Promise.race([window.FZ.tpl.load(), new Promise((r) => setTimeout(r, 3000))]); } catch (e) { /* default wording */ }
    paintProfile();
    // Flowzyn admin controls show only to editors of this page (Flowzyn), never to the shop.
    try { const u = await Promise.race([window.claude && window.claude.use ? window.claude.use('user') : null, new Promise((r) => setTimeout(() => r(null), 3000))]); window.FZ.CAN_EDIT = !!(u && await u.canEdit()); } catch (e) { window.FZ.CAN_EDIT = false; }
    AGENTS.forEach((a) => { if (!BOARDS[a.key]) a.status = 'planned'; });
    initTheme();
    initView();
    initRefresh();
    initBell();
    buildHome();
    paintMetrics();
    document.getElementById('q').addEventListener('input', () => { if (!current) route(); });
    window.addEventListener('hashchange', route);
    route();
    loadTasks();
    // Numbers, run counts and on or off settings written by Flowzyn's scheduled runs.
    (async () => {
      const db = await getDb();
      if (!db) return;
      const listen = (name, into) => {
        try {
          db.collection(name).onSnapshot((snap) => { (snap.docs || []).forEach((d) => { into[d.id] = d.data(); }); paintMetrics(); });
        } catch (e) { /* the list still works without it */ }
      };
      listen('metrics', stored); listen('runs', runs); listen('agents', settings); listen('setup', SETUP); listen('settings', SETTINGS); try { db.collection('settings').onSnapshot(() => paintProfile()); } catch (e) { /* names stay as loaded */ }
      try { db.collection('tasks').onSnapshot((snap) => { (snap.docs || []).forEach((d) => { TASKS[d.id] = d.data(); }); paintBell(); }); } catch (e) { /* ticks only last this visit */ }
      try { db.collection('exceptions').onSnapshot((snap) => { Object.keys(EXC).forEach((k) => delete EXC[k]); (snap.docs || []).forEach((d) => { EXC[d.id] = Object.assign({ id: d.id }, d.data()); }); paintMetrics(); if (current === 'tasks') showTasks(); else if (current === 'operator' && !isOperator()) showOperator(); }); } catch (e) { /* no exceptions list */ }
    })();
  }

  // The few decisions the owner sees today: calls, checks and bookings weigh more. The rest is the Operator's.
  const OWNER_KINDS = { 'Call': 2, 'Check': 2, 'Book it': 1.5 };
  // Auto approve (Matt, Nov 7): the owner turns it on once per sending agent, and those emails go out on the next run without a tap each.
  const SENDERS = { 'builder-engine': 'Builder intros', 'partner-finder': 'Partner intros', 'lost-quote-revival': 'Win back offers on old quotes', 'lead-catcher': 'Replies to new enquiries', 'quote-chaser': 'Quote follow ups', 'yes-to-install': 'Orders to your supplier', 'get-paid': 'Payment reminders', 'review-ask': 'Review asks', 'come-back': 'Check ins with past customers' };
  const autoOn = (k) => !!(SETTINGS.autoapprove && SETTINGS.autoapprove.agents && SETTINGS.autoapprove.agents[k]);
  const autoSkips = (t) => !!(t && t.draft && autoOn(t.agent));
  const autoSet = async (patch) => { const db = await getDb(); if (!db) return false; const cur = SETTINGS.autoapprove || {}; const next = { agents: Object.assign({}, cur.agents || {}, patch), by: me().owner || me().first, at: new Date().toISOString() }; try { await db.doc('settings/autoapprove').set(next); SETTINGS.autoapprove = next; return true; } catch (e) { return false; } };
  const ownerPicks = (list, done, max) => {
    const open = (list || []).filter((t) => !(done && done[t.id] && done[t.id].done) && t.kind !== 'Exception' && !autoSkips(t));
    const mine = open.slice().sort((a, b) => b.score * (OWNER_KINDS[b.kind] || 1) - a.score * (OWNER_KINDS[a.kind] || 1)).slice(0, max || 5);
    return { open, mine, rest: open.length - mine.length };
  };
  // Send to Operator: its own button, colour and icon everywhere, so it never looks like Approve.
  const OP_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"></path></svg>';
  function toast(head, text) {
    document.querySelectorAll('.fz-toast').forEach((x) => x.remove());
    const t = h('div', { class: 'fz-toast', role: 'status' }, h('span', { class: 'ic' }), h('div', null, h('b', null, head), h('span', null, text)));
    t.querySelector('.ic').innerHTML = OP_ICON;
    document.body.append(t); requestAnimationFrame(() => t.classList.add('in'));
    setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 400); }, 4200);
  }
  function opButton(o) {
    if (!isOperator() && !hasOperator()) return null;
    const b = h('button', { type: 'button', class: 'fz-btn opbtn' });
    const label = (t) => { b.innerHTML = OP_ICON; b.append(document.createTextNode(t)); };
    const id = 'op-' + String(o.id || o.title).replace(/[^A-Za-z0-9]+/g, '-').slice(-80);
    const sent = !!(TASKS[id] && TASKS[id].handed);
    label(sent ? 'With your Operator' : (o.label || 'Send to Operator'));
    if (sent) b.disabled = true;
    b.addEventListener('click', async () => {
      const host = b.closest('.fz-card, .tp-row') || b.parentNode;
      if (!hasOperator()) { if (!host.querySelector('.op-offer')) host.append(offerOperator(o.title)); return; }
      b.disabled = true;
      if (await saveTask(id, true, { agent: o.agent || null, title: o.title, meta: o.meta || '', link: o.link || null, draft: o.draft || null })) { label('With your Operator'); toast('Sent to your Operator', o.title + '. They pick it up today and it comes back here marked done.'); if (o.onSent) o.onSent(); } else b.disabled = false;
    });
    return b;
  }
  // No Operator in the plan yet: say so, and point to the form or a call.
  const hasOperator = () => !!(plan() && plan().operator) && !(SETTINGS.plan && SETTINGS.plan.operator === false);
  const offerOperator = (from) => h('div', { class: 'op-offer', role: 'status' },
    h('p', { class: 'op-offer-t' }, 'You don\u2019t have an Operator yet'),
    h('p', { class: 'op-offer-d' }, 'An Operator is a person on the Flowzyn team who picks up tasks like this for you: calls, manual steps and anything you hand over.'),
    h('div', { class: 'fz-card-btns' }, extLink(opUrl('Add Operator: ' + (from || 'task')), 'Add an Operator', 'fz-btn act'), extLink('https://cal.com/flowzyn/flowzyn-15', 'Get a Free Audit', 'fz-btn sm')));
  // The goal each core agent works toward, for the Overview.
  // The action tab says exactly what the owner does there.
  const WORKTAB = { 'where-to-find-work': 'Areas to go after', 'quotes': 'To quote', 'supplier-costs': 'Check costs', 'quick-capture': 'Captured from site', 'price-book': 'Check the price book', 'install-scheduler': 'Line up installs', 'builder-engine': 'Email builders', 'lost-quote-revival': 'Send win back offers', 'partner-finder': 'Send partner intros', 'local-search-check': 'Fix your listings', 'morning-brief': 'Approve today', 'lead-catcher': 'Reply to enquiries', 'quote-prep': 'Approve quotes', 'quote-chaser': 'Send follow ups', 'yes-to-install': 'Order and book jobs', 'bill-it': 'Send invoices', 'get-paid': 'Send payment reminders', 'review-ask': 'Request customer reviews', 'come-back': 'Invite past customers back', 'review-watch': 'Reply to reviews' };
  const GOALS = {"where-to-find-work": "Know which neighbourhoods to go after next, and why.", "quotes": "Every job you have visited quoted within 2 days, priced the same way.", "supplier-costs": "Price every quote from what the glass really costs you.", "quick-capture": "Nothing asked for on site gets forgotten.", "price-book": "Price every shower and mirror quote the same way, from the sizes.", "install-scheduler": "Book every yes within a week, and the work within a day of the delivery landing.", "builder-engine": "Win new jobs from builders whose projects just got approved near you.", "lost-quote-revival": "Win back jobs from quotes you gave up on.", "partner-finder": "Get local businesses sending you work.", "local-search-check": "Get found first when people nearby search for your work.", "morning-brief": "Know what needs your OK each day in under 3 minutes.", "lead-catcher": "Reply to every new enquiry within a day, so you win the job before a competitor does.", "quote-prep": "Get every quote out within 2 days of the site visit.", "quote-chaser": "Win more of the quotes you already sent.", "yes-to-install": "Book every yes within a week, so no approved job goes cold.", "week-board": "Keep every crew busy and every job on time.", "bill-it": "Never miss an invoice: every finished job flagged the day it is done.", "get-paid": "Get overdue money in without awkward calls.", "month-close": "Close the books by day 3 every month.", "weather-watch": "Move jobs before the weather does, not after.", "crew-sheet": "Send every crew out with everything they need, so nobody drives back.", "cash-in": "Know exactly what money is coming in over the next 30 days.", "pay-bills": "Pay every supplier on time, and only once.", "price-watch": "Keep every price above your cost and margin.", "own-permits": "Get inspections passed fast so final invoices go out.", "add-on-finder": "Add the extras that belong on every quote.", "shop-handbook": "Price and describe the same work the same way every time.", "review-ask": "Get more Google reviews every month.", "review-watch": "Answer every review within 48 hours and stay ahead of nearby shops.", "builder-keep": "Keep your best builders sending you work.", "come-back": "Win repeat work from past customers.", "stand-behind-it": "Catch warranty problems before the customer has to call."};
  const metricOf = (k) => METRICS[k] || stored[k] || null;
  window.FZ = Object.assign(window.FZ || {}, { openBoard: (k) => openBoard(k), auto: { SENDERS, on: autoOn, set: autoSet, skips: autoSkips }, BOARDS, GOALS, metricOf, opButton, hasOperator, offerOperator, ownerPicks, saveTask: (id, on, hand) => saveTask(id, on, hand), queueSend: (id, ob) => queueSend(id, ob), tasksNow: () => ({ list: TASKLIST, done: TASKS }), isOperator, opName, opWho, CORE, me, profile: () => SETTINGS.profile || {}, saveProfile: async (patch) => { const db = await getDb(); if (!db) return false; const next = Object.assign({}, SETTINGS.profile || {}, patch); try { await db.doc('settings/profile').set(next); SETTINGS.profile = next; return true; } catch (e) { return false; } }, opUrl: (f) => opUrl(f), biz: () => me().business, town: () => me().town, w, isGlass, trade: tradeOf, toFlowzyn, shown, region: () => region(), sign: () => me().first + ', ' + me().business, rerunWelcome: async () => { const db = await getDb(); if (!db) return false; const next = Object.assign({}, SETTINGS.profile || {}, { onboardedAt: null }); try { await db.doc('settings/profile').set(next); SETTINGS.profile = next; location.hash = '#welcome'; return true; } catch (e) { return false; } }, operatorBanner, setView, board, start, ctx, GROUPS, AGENTS, byKey, ui, fmt, health: (a) => health(a), locked: (a) => locked(a), plan: () => plan(), openExc: (k) => openExc(k), runs, settings });
})();
