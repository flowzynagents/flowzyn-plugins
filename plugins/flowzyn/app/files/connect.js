// Connect (v3): every setting lives here. Tools, Your shop, Auto approve, and the email templates with their editor.
// Agent pages carry no forms or settings (Matt, Nov 8).
(function () {
  'use strict';
  const FZ = window.FZ, V = FZ.v3;
  if (!V) return;
  const ui = FZ.ui, fmt = FZ.fmt, h = ui.h;
  const el = (tag, cls, ...kids) => h(tag, cls ? { class: cls } : null, ...kids);
  const btn = (label, on, cls) => { const b = h('button', { type: 'button', class: 'v3-btn' + (cls ? ' ' + cls : '') }, label); if (on) b.addEventListener('click', on); return b; };
  const linkBtn = (label, href, cls) => h('a', { class: 'v3-btn' + (cls ? ' ' + cls : ''), href, target: /^https?:/.test(href) ? '_blank' : null, rel: /^https?:/.test(href) ? 'noopener' : null }, label);
  const gt = (label) => h('p', { class: 'v3-gt' }, label);
  const short = (n) => fmt.money(n, { short: true });
  const A = () => FZ.act;
  const DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const head = (title, sub, back) => el('header', null, back ? h('p', null, h('a', { class: 'v3-back', href: back[1] }, '← ' + back[0])) : null, h('h1', { class: 'v3-h1' }, ...[].concat(title).map((p) => (p && p.b) ? h('b', null, p.b) : p)), sub ? h('p', { class: 'v3-sub' }, sub) : null);
  const row = (title, sub, right) => el('div', 'v3-row', el('div', 't', h('b', null, title), sub ? h('span', null, sub) : null), right || null);

  // ---------- Tools: each connector tested with one small read, never a tap from the owner ----------
  // Jobber lists one client, the books app reads its company, email searches one message, and Places counts as
  // connected when the Flowzyn connector answers (Flowzyn holds that key). Set up Flowzyn saves what it found
  // (flowzyn_status, systems), and that is the answer when a live check can't run in this view.
  const FZC = ['Flowzyn', 'flowzyn'];
  const PROBES = {
    jobber: [['Jobber', 'search_clients', { limit: 1 }]],
    quickbooks: [['Intuit QuickBooks', 'company_info', {}], ['Intuit QuickBooks', 'company-info', {}]],
    xero: [['Xero', 'get_organisation_info', {}]],
    gmail: [['Gmail', 'search_threads', { query: 'newer_than:30d', maxResults: 1 }], ['Gmail', 'search_messages', { query: 'newer_than:30d', maxResults: 1 }]],
    outlook: [['Microsoft 365', 'outlook_email_search', { query: 'received:this month', limit: 1 }]]
  };
  const NAMES = { flowzyn: 'Flowzyn', jobber: 'Jobber', quickbooks: 'QuickBooks', xero: 'Xero', gmail: 'Gmail', outlook: 'Outlook', places: 'Google Places' };
  const WHAT = { flowzyn: 'Your licence and the agents’ rules', jobber: 'Quotes, jobs, invoices', quickbooks: 'Bills and payments', xero: 'Bills and payments', gmail: 'Sends from your email', outlook: 'Sends from your email', places: 'Partners and local search' };
  const mcpP = () => (window.claude && window.claude.use ? window.claude.use('mcp') : Promise.resolve(null));
  // One read. Connected when the tool answers, even with an error of its own: the connector was reached with his sign in.
  async function probe(list) {
    const mcp = await mcpP(); if (!mcp) return { state: 'unknown' };
    let last = null;
    for (const [server, tool, input] of list) {
      try { await mcp.callTool(server, tool, input, { cache: { staleTime: 10 * 60000, gcTime: 30 * 60000 } }); return { state: 'on', server }; }
      catch (e) {
        const c = e && e.code;
        if (c === 'tool_error') return { state: 'on', server };
        if (c === 'needs_reauth') return { state: 'reauth', server };
        if (c === 'approval_required') return { state: 'ask', server, retry: [server, tool, input] };
        last = c || 'upstream_error';
      }
    }
    // Only a missing connector reads as not connected. Any other refusal falls back to what Set up Flowzyn saved.
    return { state: last === 'server_not_connected' ? 'off' : last === 'server_unavailable' ? 'down' : 'unknown' };
  }
  let STATUS_P = null;
  // What Set up Flowzyn saved, and whether the Flowzyn connector (and so Places) is on.
  const flowzyn = () => STATUS_P || (STATUS_P = (async () => {
    const mcp = await mcpP(); if (!mcp) return { state: 'unknown' };
    for (const s of FZC) {
      try { const r = await mcp.callTool(s, 'flowzyn_status', {}, { cache: { staleTime: 10 * 60000, gcTime: 30 * 60000 } }); const p = r && r.payload; return { state: 'on', server: s, status: typeof p === 'object' ? p : null }; }
      catch (e) { const c = e && e.code; if (c === 'tool_error') return { state: 'licence', server: s, reason: String((e && e.message) || '').slice(0, 200) }; if (c === 'needs_reauth') return { state: 'reauth', server: s }; if (c === 'approval_required') return { state: 'ask', server: s }; }
    }
    return { state: 'off' };
  })());
  FZ.flowzynStatus = flowzyn;
  async function checkTools(o, fresh) {
    if (fresh) { STATUS_P = null; try { const m = await mcpP(); if (m && m.invalidate) await m.invalidate(); } catch (e) { /* fine */ } }
    const fz = await flowzyn();
    const sys = (fz.status && typeof fz.status.systems === 'object' && fz.status.systems) || {};
    const saved = (sys.connected || []).map((x) => String(x).toLowerCase());
    const books = sys.books && sys.books !== 'none' ? sys.books : null;
    const email = sys.email && sys.email !== 'none' ? sys.email : null;
    const [jobber, qb, xero, gm, ol] = await Promise.all([probe(PROBES.jobber), books === 'xero' ? null : probe(PROBES.quickbooks), books === 'quickbooks' ? null : probe(PROBES.xero), email === 'outlook' ? null : probe(PROBES.gmail), email === 'gmail' ? null : probe(PROBES.outlook)]);
    const pick = (a, b, ka, kb, chosen) => chosen === ka ? [ka, a] : chosen === kb ? [kb, b] : (b && b.state === 'on' && !(a && a.state === 'on')) ? [kb, b] : [ka, a];
    // The Flowzyn connector first: every agent needs it (Matt, Nov 10).
    const rows = [['flowzyn', fz.state === 'on' ? { state: 'on', server: fz.server } : fz], ['jobber', jobber], pick(qb, xero, 'quickbooks', 'xero', books), pick(gm, ol, 'gmail', 'outlook', email),
      // Places runs on Flowzyn's own key (Matt, Nov 10), so there is nothing for the shop to connect.
      ['places', { state: 'included', via: 'Flowzyn' }]];
    // A live check that could not run falls back to what Set up Flowzyn saved.
    rows.forEach((r) => { if (r[1] && r[1].state === 'unknown' && saved.some((x) => x.includes(r[0] === 'places' ? 'flowzyn' : r[0]))) r[1] = { state: 'on', saved: true }; });
    const at = new Date().toISOString();
    await Promise.all(rows.map(([id, r]) => o.save(id === 'outlook' ? 'microsoft' : id === 'xero' ? 'quickbooks' : id === 'places' ? 'google' : id, { done: !!(r && (r.state === 'on' || r.state === 'included')), state: (r && r.state) || 'unknown', app: NAMES[id], checkedAt: at, via: r && r.saved ? 'Set up Flowzyn' : 'app check' }).catch(() => false)));
    return { rows, fz, at };
  }
  function toolRows(box, hash, o, res) {
    const STATE = { on: ['Connected', ''], included: ['Included', ''], reauth: ['Sign in again', 'no'], ask: ['Needs your OK', 'no'], off: ['Not connected', 'no'], down: ['Not answering', 'no'], licence: ['Licence off', 'no'], unknown: ['Not checked', 'no'] };
    return res.rows.map(([id, r]) => {
      r = r || { state: 'unknown' };
      const [label, cls] = STATE[r.state] || STATE.unknown;
      const sub = WHAT[id] + (r.state === 'included' ? ' · runs on Flowzyn’s key, nothing to connect' : r.state === 'on' ? '' : r.state === 'licence' ? ' · ' + (r.reason || 'Flowzyn licence is off') : r.state === 'reauth' ? ' · sign in again in Claude, Settings, Connectors' : r.state === 'down' ? ' · not answering right now' : r.state === 'unknown' ? ' · connect it in Claude, then press Check again' : id === 'places' ? ' · comes with the Flowzyn connector' : ' · add it in Claude, Settings, Connectors');
      let right = h('span', { class: 'v3-conn' + (cls ? ' ' + cls : '') }, label);
      if (r.state === 'ask' && r.retry) right = btn('Allow', async (e) => { e.currentTarget.disabled = true; try { const m = await mcpP(); await m.callTool(...r.retry); } catch (x) { /* shown on recheck */ } V.connect(box, hash, o); });
      // Every tool row has its action (Matt, Nov 10): Connect when it is not connected, Disconnect when it is.
      // Both open Claude's Connectors settings, where connectors are added and removed.
      else if (r.state === 'reauth') right = linkBtn('Sign in', 'https://claude.ai/settings/connectors', 'q');
      else if (r.state === 'on') right = el('div', 'v3-connr', h('span', { class: 'v3-conn' }, 'Connected'), linkBtn('Disconnect', 'https://claude.ai/settings/connectors', 'q'));
      else if (r.state !== 'included') right = linkBtn('Connect', 'https://claude.ai/settings/connectors');
      return row(NAMES[id], sub, right);
    });
  }

  V.connect = async (box, hash, o) => {
    const parts = hash.split('-');
    if (hash === 'templates') return templates(box);
    if (/^tpl-/.test(hash)) return editor(box, hash.slice(4));
    if (hash === 'setup-check') { /* falls through to Connect with a fresh check */ }
    if (/^shop-/.test(hash)) return shopEdit(box, parts.slice(1).join('-'), o);
    const S = o.SETUP || {};
    const prof = FZ.profile();
    const [goals, sched, book] = await Promise.all([FZ.ctx.store('settings/goals'), A().getDoc('settings/schedule'), A().priceBook()]);
    await FZ.tpl.load();
    const res = await checkTools(o, hash === 'setup-check');
    const nOn = res.rows.filter((r) => r[1] && (r[1].state === 'on' || r[1].state === 'included')).length, nAll = res.rows.length;
    const tools = el('div', 'v3-card v3-rows', ...toolRows(box, hash, o, res));
    const sch = Object.assign({ days: [1, 2, 3, 4, 5], perDay: 2, signer: '' }, sched || {});
    const goal = goals && Number(goals.monthlyRevenue);
    const nTpl = FZ.tpl.list.length;
    const edited = FZ.tpl.list.filter((t) => FZ.tpl.get(t.id).edited).length;
    const shop = el('div', 'v3-card v3-rows',
      row('Monthly goal', goal ? short(goal) + ' invoiced' : 'Not set yet', linkBtn('Edit', '#shop-goal', 'q')),
      row('Shop details', [prof.phone, prof.shopAddress, prof.website ? String(prof.website).replace(/^https?:\/\//, '') : null].filter(Boolean).join(' · ') || 'Phone, address, from your website', linkBtn('Edit', '#shop-details', 'q')),
      row('Install days and crew', sch.days.map((d) => DN[d]).join(', ') + ' · ' + sch.perDay + ' a day' + (sch.signer ? ' · ' + sch.signer + ' signs' : ''), linkBtn('Edit', '#shop-installs', 'q')),
      row('Price book', '$' + book.showerRate + ' sq ft + $' + book.install + ' + $' + book.hardware + (book.method === 'supplier' ? ' · priced from supplier costs' : ''), linkBtn('Edit', '#shop-prices', 'q')),
      row('Supplier cost sheet', (book.supplier && (book.supplier.items || []).length) ? fmt.plural(book.supplier.items.length, 'price') + ' loaded' : 'Not loaded. A photo of it. Optional, if you price from costs', linkBtn((book.supplier && (book.supplier.items || []).length) ? 'Edit' : 'Add', '#a-supplier-costs', 'q')),
      row('Builder areas', ((Array.isArray(prof.builderAreas) && prof.builderAreas.length) ? prof.builderAreas.join(', ') : 'Every area loaded') + (prof.builderWanted ? ' · wants ' + prof.builderWanted : ''), linkBtn('Edit', '#shop-builders', 'q')),
      row('Google review link', prof.reviewLink ? String(prof.reviewLink).replace(/^https?:\/\//, '') : 'Not saved yet. Used in every review ask', linkBtn('Edit', '#shop-review', 'q')),
      row('Morning brief', (prof.briefTime || '6:03am') + ' weekdays · email', linkBtn('Edit', '#shop-brief', 'q')),
      row('Email templates', nTpl + ' your agents write from' + (edited ? ', ' + edited + ' edited' : ''), linkBtn('Edit', '#templates', 'q')));
    const senders = Object.entries(FZ.auto.SENDERS);
    const togs = el('div', 'v3-card v3-rows', ...senders.map(([k, label]) => {
      const t = h('button', { type: 'button', class: 'v3-tog', role: 'switch', 'aria-checked': String(FZ.auto.on(k)), 'aria-label': label });
      t.addEventListener('click', async () => { t.disabled = true; const next = !FZ.auto.on(k); if (await FZ.auto.set({ [k]: next })) { t.setAttribute('aria-checked', String(next)); V.clear(); FZ.paintCount(); } t.disabled = false; });
      return row(label, (FZ.byKey(k === 'yes-to-install' ? 'install-scheduler' : k) || {}).name, t);
    }));
    box.replaceChildren(el('div', 'v3p',
      head(nOn === nAll ? ['All set. ', { b: nOn + ' of ' + nAll }, ' connected.'] : [{ b: nOn + ' of ' + nAll }, ' connected.'], 'Every setting lives here. Nothing else asks you.'),
      el('section', null, gt('Tools'), tools, h('p', { class: 'v3-note' }, 'Each one is checked with one small read when this opens' + (res.fz.status && res.fz.status.systems ? ', and Set up Flowzyn saved what it found' : '') + '. ', h('a', { href: '#setup-check' }, 'Check again'), '.')),
      el('section', null, gt('Your shop'), shop),
      h('section', { id: 'autoapprove' }, gt('Auto approve'), togs, h('p', { class: 'v3-note' }, 'Off means each email waits for your OK on Tasks. On means that agent sends under its template on the next run.')),
      h('p', { class: 'v3-foot' }, 'Saved for ' + FZ.biz() + ' · ', h('a', { href: FZ.opUrl ? FZ.opUrl('Question about Connect') : '#', target: '_blank', rel: 'noopener' }, 'Ask your Operator'))));
    if (hash === 'autoapprove') setTimeout(() => { const s = document.getElementById('autoapprove'); if (s) s.scrollIntoView({ block: 'start' }); }, 50);
  };

  // ---------- Your shop editors: one screen each, Save goes back to Connect ----------
  async function shopEdit(box, which, o) {
    const prof = FZ.profile();
    const msg = h('p', { class: 'v3-msg', role: 'status' });
    const inp = (label, value, attrs) => { const i = h('input', Object.assign({ type: 'text', value: value == null ? '' : String(value) }, attrs || {})); return [h('label', null, label, i), i]; };
    const done = (ok) => { if (ok) { V.clear(); location.hash = '#setup'; } else msg.textContent = 'Could not save. Try again.'; };
    let title, sub, fields = [], save;
    if (which === 'goal') {
      const g = await FZ.ctx.store('settings/goals');
      const [l, i] = inp('Monthly invoiced goal ($)', g && g.monthlyRevenue, { type: 'number', min: '0', step: '1000', inputmode: 'numeric' });
      title = ['Your ', { b: 'monthly goal' }, '.']; sub = 'Every agent works toward it. Overview shows how far along you are.'; fields = [l];
      save = async () => { const v = Math.round(Number(i.value) || 0); const db = await window.claude.use('db'); try { await db.doc('settings/goals').set(Object.assign({}, g || {}, { monthlyRevenue: v, setAt: new Date().toISOString(), setBy: FZ.me().first })); return true; } catch (e) { return false; } };
    } else if (which === 'details') {
      const sup = Object.assign({ name: '', email: '' }, prof.supplier || {});
      const f = [['Business', 'business', prof.business], ['Your name', 'owner', prof.owner], ['Phone', 'phone', prof.phone], ['Shop address', 'shopAddress', prof.shopAddress], ['Website', 'website', prof.website]].map(([l, k, v]) => [k, ...inp(l, v)]);
      const [ls, is] = inp('Glass supplier', sup.name); const [le, ie] = inp('Supplier order email', sup.email, { type: 'email', placeholder: 'orders@supplier.com' });
      title = ['Shop ', { b: 'details' }, '.']; sub = 'From your website and Jobber. Used on emails, flyers and glass orders.'; fields = [...f.map((x) => x[1]), ls, le];
      save = async () => { const patch = {}; f.forEach(([k, , i]) => { patch[k] = i.value.trim(); }); patch.supplier = Object.assign({}, sup, { name: is.value.trim() || sup.name, email: ie.value.trim() }); return FZ.saveProfile(patch); };
    } else if (which === 'installs') {
      const S = Object.assign({ days: [1, 2, 3, 4, 5], perDay: 2, signer: '' }, (await A().getDoc('settings/schedule')) || {});
      const boxes = DN.map((n, i) => { const c = h('input', { type: 'checkbox' }); c.checked = S.days.includes(i); return [h('label', null, c, n), c]; });
      const [lp, ip] = inp('Installs a day', S.perDay, { type: 'number', min: '1', max: '10' });
      const [lsg, isg] = inp('Who signs for deliveries', S.signer, { placeholder: 'Who is at the shop for deliveries' });
      title = ['Install ', { b: 'days and crew' }, '.']; sub = 'Schedule Installs picks the first free days with these rules.';
      fields = [h('label', null, 'Days you install', el('div', 'days', ...boxes.map((b) => b[0]))), lp, lsg];
      save = () => A().setDoc('settings/schedule', { saved: true, days: boxes.map((b, i) => (b[1].checked ? i : -1)).filter((i) => i >= 0), perDay: Number(ip.value) || 1, signer: isg.value.trim(), at: new Date().toISOString() });
    } else if (which === 'prices') {
      const b = await A().priceBook();
      const f = [['Shower glass, per sq ft ($)', 'showerRate'], ['Install, per enclosure ($)', 'install'], ['Hardware, per enclosure ($)', 'hardware'], ['Mirror, per sq ft installed ($)', 'mirrorRate']].map(([l, k]) => [k, ...inp(l, b[k], { type: 'number', min: '0', step: '1' })]);
      title = ['Your ', { b: 'price book' }, '.']; sub = 'Every new quote is priced from this formula' + (b.method === 'supplier' ? ', or from your supplier costs while those are switched on in Quote Jobs.' : '.') + ' Quotes already in Jobber do not change.';
      fields = f.map((x) => x[1]);
      save = () => A().savePriceBook(Object.assign({}, ...f.map(([k, , i]) => ({ [k]: Number(i.value) || 0 }))));
    } else if (which === 'builders') {
      // Where Reach Builders looks: the loaded areas the owner picks, plus areas they want next.
      const ds = (await FZ.ctx.store('datasets/permits')) || {};
      const have = [...new Set((ds.sources || []).map((s) => fmt.clean(s.area)).filter(Boolean))];
      const picked = Array.isArray(prof.builderAreas) && prof.builderAreas.length ? prof.builderAreas : have;
      const boxes = have.map((a) => { const c = h('input', { type: 'checkbox' }); c.checked = picked.includes(a); return [h('label', null, c, a), c, a]; });
      const [lw, iw] = inp('Other areas you want builders in', prof.builderWanted || '', { placeholder: 'Towns or cities, with commas' });
      title = ['Builder ', { b: 'areas' }, '.']; sub = 'Reach Builders writes intros to builders with new approvals in the areas you pick.';
      fields = [
        have.length ? h('label', null, 'Areas with new approvals loaded each night', el('div', 'days', ...boxes.map((b) => b[0]))) : h('p', { class: 'v3-note' }, 'No permit areas are loaded yet.'),
        lw,
        h('p', { class: 'v3-note' }, 'Flowzyn adds an area once its county publishes new approvals. Some counties keep permits behind a login, so those areas can’t load yet. Until then, builders there come from your Jobber.')];
      save = () => FZ.saveProfile({ builderAreas: boxes.filter((b) => b[1].checked).map((b) => b[2]), builderWanted: iw.value.trim() });
    } else if (which === 'review') {
      const [l, i] = inp('Google review link', prof.reviewLink, { type: 'url', placeholder: 'https://g.page/r/…/review' });
      title = ['Google ', { b: 'review link' }, '.']; sub = 'Every review ask uses it, so customers land straight on your review form.';
      // How to get it, with the links (Matt, Nov 10). Steps from Google's own help page.
      fields = [
        h('ol', { class: 'v3-how-steps' },
          h('li', null, 'Open your Google Business Profile, signed in with the Google account that manages it.'),
          h('li', null, 'On Google Search, press ', h('b', null, 'Ask for reviews'), '. On Google Maps, open ', h('b', null, 'Customer reviews'), ', then ', h('b', null, 'Get more reviews'), '.'),
          h('li', null, 'Copy the link it shows and paste it below.')),
        el('div', 'v3-btns', linkBtn('Open my Google profile', 'https://business.google.com/'), linkBtn('Google’s help page', 'https://support.google.com/business/answer/3474122', 'q')),
        l];
      save = () => FZ.saveProfile({ reviewLink: i.value.trim() });
    } else if (which === 'brief') {
      const sel = h('select', null, ...['5:33am', '6:03am', '6:33am', '7:03am'].map((t) => h('option', { value: t, selected: (prof.briefTime || '6:03am') === t ? '' : null }, t)));
      title = ['Morning ', { b: 'brief' }, '.']; sub = 'One email a day on weekdays, only when something needs you. It opens Today.';
      fields = [h('label', null, 'Send it at', sel), h('p', { class: 'v3-note' }, 'The email turns on once your Operator switches it on for you.')];
      save = () => FZ.saveProfile({ briefTime: sel.value });
    } else { location.hash = '#setup'; return; }
    const sv = btn('Save', async () => { sv.disabled = true; msg.textContent = 'Saving…'; done(await save()); sv.disabled = false; });
    box.replaceChildren(el('div', 'v3p', head(title, sub, ['Connect', '#setup']), el('section', 'v3-card v3-form', ...fields, el('div', 'v3-btns', sv, linkBtn('Cancel', '#setup', 'q')), msg)));
  }

  // ---------- Email templates ----------
  async function templates(box) {
    await FZ.tpl.load();
    const groups = [['run', 'Run the office'], ['win', 'Win the work'], ['keep', 'Keep the customers']];
    box.replaceChildren(el('div', 'v3p',
      el('header', null, h('p', null, h('a', { class: 'v3-back', href: '#setup' }, '← Connect')), h('p', { class: 'v3-eb' }, 'Your shop · Email templates'), h('h1', { class: 'v3-h1' }, h('b', null, FZ.tpl.list.length + ' templates.'), ' Edit any one.'), h('p', { class: 'v3-sub' }, 'Your agents fill in names, prices and dates.')),
      rewriteCard(box),
      ...groups.map(([g, label]) => el('section', null, gt(label), el('div', 'v3-card v3-rows', ...FZ.tpl.list.filter((t) => t.group === g).map((t) => row(t.name, t.sub + (FZ.tpl.get(t.id).edited ? ' · edited' : ''), linkBtn('Edit', '#tpl-' + t.id, 'q'))))))));
  }
  // Rewrite every template for this shop in one go (Matt, Nov 10). Claude writes them from the shop details,
  // every {fill in} is kept, and nothing is saved unless all of a template's fill ins survive.
  const fillsOf = (s) => (String(s || '').match(/\{[^{}]+\}/g) || []).sort().join('|');
  function rewriteCard(box) {
    const msg = h('p', { class: 'v3-msg', role: 'status' });
    const go = btn('Rewrite all for my shop', async () => {
      const sample = await window.claude.use('sample').catch(() => null);
      if (!sample) { msg.textContent = 'Rewriting is not available in this view.'; return; }
      go.disabled = true; reset.disabled = true; msg.textContent = 'Writing ' + FZ.tpl.list.length + ' templates for your shop. About a minute.';
      const p = FZ.profile() || {}, me = FZ.me();
      const shop = { business: me.business, owner: me.first, town: me.town, place: p.place || '', website: p.website || '', trade: p.trade || p.industry || '', services: p.services || '', areas: [].concat(p.builderAreas || []).join(', '), wants: p.builderWanted || '' };
      const list = FZ.tpl.list.map((d) => { const c = FZ.tpl.get(d.id); return { id: d.id, name: d.name, agent: d.sub, subject: c.subject, body: c.body, lines: c.lines || undefined }; });
      const prompt = 'Rewrite these email templates for this shop. Shop: ' + JSON.stringify(shop) + '\n\nRules: keep every {fill in} exactly as written, same braces and words, and use each one the same number of times. Keep what each email is for. Write as the owner, plain friendly words a tradesperson would use, short sentences, no dashes, no semicolons, never the word AI. Only mention this shop, its town and the work it does. Never name any other business, person or town. If the trade is unknown, keep the work general. For lines, keep the same keys.\n\nReturn only JSON: {"templates":[{"id":"...","subject":"...","body":"...","lines":{...}}]}\n\nTemplates: ' + JSON.stringify(list);
      try {
        const out = await sample.json(prompt, { modelTier: 'default' });
        const got = (out && out.templates) || [];
        let ok = 0, kept = 0;
        for (const n of got) {
          const cur = list.find((x) => x.id === n.id); if (!cur || !n.body) continue;
          if (fillsOf(cur.subject) !== fillsOf(n.subject) || fillsOf(cur.body) !== fillsOf(n.body)) { kept++; continue; }
          const patch = { subject: String(n.subject), body: String(n.body) };
          if (cur.lines && n.lines && typeof n.lines === 'object') { const l = {}; Object.keys(cur.lines).forEach((k) => { if (n.lines[k]) l[k] = String(n.lines[k]); }); patch.lines = l; }
          if (await FZ.tpl.save(n.id, patch)) ok++;
        }
        msg.textContent = 'Rewrote ' + ok + ' of ' + list.length + ' templates.' + (kept ? ' ' + kept + ' kept as they were, because a fill in went missing.' : '') + ' Open any one to check it.';
        setTimeout(() => templates(box).then(() => { const m = box.querySelector('.v3-rw .v3-msg'); if (m) m.textContent = msg.textContent; }), 600);
      } catch (e) { msg.textContent = e && e.code === 'rate_limited' ? 'Busy right now. Try again in a minute.' : 'Could not rewrite them just now. Nothing changed.'; }
      go.disabled = false; reset.disabled = false;
    });
    const reset = btn('Back to the originals', async () => {
      reset.disabled = true; let n = 0;
      for (const d of FZ.tpl.list) { if (FZ.tpl.get(d.id).edited && await FZ.tpl.reset(d.id)) n++; }
      msg.textContent = n ? 'Put back ' + fmt.plural(n, 'template') + '.' : 'All are already the originals.';
      reset.disabled = false; templates(box);
    }, 'q');
    return el('section', 'v3-card v3-rw', h('h3', null, 'Write them for your shop'), h('p', { class: 'v3-note' }, 'Rewrites all ' + FZ.tpl.list.length + ' from your shop details in Connect: name, town and the work you do. The fill ins stay. Nothing goes out, and you can edit any one after.'), el('div', 'v3-btns', go, reset), msg);
  }
  // Text with {fill ins} shown as orange chips. The chips can be moved or deleted, not typed into.
  const toNodes = (text) => String(text || '').split(/(\{[^{}]+\})/).filter((x) => x !== '').map((p) => /^\{[^{}]+\}$/.test(p) ? h('span', { class: 'v3-fill', contenteditable: 'false', 'data-fill': p.slice(1, -1) }, p.slice(1, -1)) : document.createTextNode(p));
  const fromNodes = (root) => {
    let s = '';
    const walk = (n) => n.childNodes.forEach((c) => {
      if (c.nodeType === 3) s += c.nodeValue;
      else if (c.dataset && c.dataset.fill) s += '{' + c.dataset.fill + '}';
      else if (c.nodeName === 'BR') s += '\n';
      else { const block = /^(DIV|P)$/.test(c.nodeName); if (block && s && !s.endsWith('\n')) s += '\n'; walk(c); }
    });
    walk(root);
    return s.replace(/ /g, ' ');
  };
  const edBox = (text, one) => {
    const d = h('div', { class: 'v3-ed' + (one ? ' one' : ''), contenteditable: 'true', spellcheck: 'true', role: 'textbox', 'aria-multiline': one ? 'false' : 'true' });
    d.append(...toNodes(text));
    d.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); if (!one) document.execCommand('insertText', false, '\n'); } });
    d.addEventListener('paste', (e) => { e.preventDefault(); const t = (e.clipboardData || window.clipboardData).getData('text/plain'); document.execCommand('insertText', false, t); });
    return d;
  };
  async function editor(box, id) {
    await FZ.tpl.load();
    const t = FZ.tpl.get(id); if (!t) { location.hash = '#templates'; return; }
    const fills = [...new Set((t.def.subject + ' ' + t.def.body).match(/\{[^{}]+\}/g) || [])].map((x) => x.slice(1, -1));
    const subj = edBox(t.subject, true), body = edBox(t.body, false);
    let last = body;
    [subj, body].forEach((e) => e.addEventListener('focus', () => { last = e; }));
    const add = el('div', 'v3-addfill', ...fills.map((f) => { const b = h('button', { type: 'button' }, '+ ' + f); b.addEventListener('mousedown', (e) => e.preventDefault()); b.addEventListener('click', () => { last.focus(); const chip = toNodes('{' + f + '}')[0]; const sel = window.getSelection(); if (sel.rangeCount && last.contains(sel.anchorNode)) { const r = sel.getRangeAt(0); r.deleteContents(); r.insertNode(chip); r.setStartAfter(chip); r.collapse(true); sel.removeAllRanges(); sel.addRange(r); } else last.append(chip); }); return b; }));
    const lineEds = t.lines ? t.def.lines.items.map(([k, label]) => [k, label, edBox(t.lines[k], false)]) : [];
    const msg = h('p', { class: 'v3-msg', role: 'status' });
    const save = btn('Save template', async () => {
      save.disabled = true;
      const patch = { subject: fromNodes(subj).trim(), body: fromNodes(body).replace(/\n{3,}/g, '\n\n').trim() };
      if (lineEds.length) patch.lines = Object.assign({}, ...lineEds.map(([k, , e]) => ({ [k]: fromNodes(e).trim() })));
      const ok = await FZ.tpl.save(id, patch);
      msg.textContent = ok ? 'Saved. New drafts use it from the next run. Drafts already written keep their words.' : 'Could not save. Try again.';
      if (ok) V.clear();
      save.disabled = false;
    });
    const back = btn('Back to the original', async () => { back.disabled = true; if (await FZ.tpl.reset(id)) { V.clear(); editor(box, id); } else { msg.textContent = 'Could not reset. Try again.'; back.disabled = false; } }, 'q');
    // A preview with example values, so he sees how the fill ins read.
    const EX = { 'first name': 'Cody', business: FZ.biz(), owner: FZ.me().first, signature: FZ.sign(), town: FZ.town(), invoice: '2997', amount: '$5,100', 'due date': 'Oct 25', work: 'shower enclosure', 'sent date': 'Aug 15', 'what they asked': 'shower enclosure and mirrors', 'at address': ' at 19 Lodge Pole Ln', 'about address': ' about 19 Lodge Pole Ln', customer: 'Taylor Reed', 'quote ref': 'Quote #2437', 'in town': ', ' + FZ.town(), supplier: ((FZ.profile().supplier || {}).name || 'your supplier'), 'order lines': '1. Shower enclosure, qty 1\n   Glass: 3/8 clear\n   Size: 74 x 82 in', builder: 'Ridge Line Builders', project: 'new home build', address: '120 Ski Hill Rd', greeting: 'Hello Alpine Kitchen and Bath team,', month: 'July 2026', 'for work': 'your shower enclosure', months: '9', 'review link': (FZ.profile().reviewLink || 'your review link') };
    const prev = h('pre', { class: 'v3-paste' });
    const paintPrev = () => { const sub = fromNodes(subj), bd = fromNodes(body); const line = lineEds[0] ? fromNodes(lineEds[0][2]) : ''; const f = (s) => s.replace(/\{([^{}]+)\}/g, (m, k) => (k === (t.def.lines && t.def.lines.fill) ? line : EX[k] != null ? EX[k] : '')).replace(/ ([,.])/g, '$1'); prev.textContent = 'Subject: ' + f(sub) + '\n\n' + f(bd); };
    [subj, body, ...lineEds.map((x) => x[2])].forEach((e) => e.addEventListener('input', paintPrev));
    paintPrev();
    box.replaceChildren(el('div', 'v3p',
      el('header', null, h('p', null, h('a', { class: 'v3-back', href: '#templates' }, '← Email templates')), h('p', { class: 'v3-eb' }, t.def.sub.split(' · ')[0]), h('h1', { class: 'v3-h1' }, h('b', null, t.name), ' template.'), h('p', { class: 'v3-sub' }, 'Orange words are filled in for each email. Keep them where you want them.')),
      el('section', 'v3-card',
        h('p', { class: 'v3-edlab' }, 'Subject'), subj,
        h('p', { class: 'v3-edlab' }, 'Email'), body, add,
        ...lineEds.flatMap(([k, label, e], i) => [i === 0 ? h('p', { class: 'v3-edlab' }, t.def.lines.label) : null, h('p', { class: 'v3-note', style: 'margin:10px 0 6px' }, label), e]).filter(Boolean),
        el('div', 'v3-btns', save, back), msg,
        h('p', { class: 'v3-note' }, 'New drafts use it from the next run. Drafts already written keep their words.')),
      el('section', null, gt('How it reads, with example names'), el('div', 'v3-card', prev))));
  }
})();
