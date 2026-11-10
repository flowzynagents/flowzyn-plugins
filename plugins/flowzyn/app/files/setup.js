// Onboarding: connect your tools. Core tools first, then optional growth data that Flowzyn can provide.
// Never collects a key or password. Keys are added to the client's Claude workspace on a call.
(function () {
  const CALL = 'https://cal.com/flowzyn/flowzyn-15';
  const CONNECTORS = 'https://claude.ai/settings/connectors';
  FZ.SETUP = [
    { id: 'jobber', group: 'core', name: 'Jobber', always: true, what: 'Quotes, jobs, visits and invoices. Every Run and Keep agent reads it.' },
    { id: 'gmail', group: 'core', name: 'Gmail', alt: 'microsoft', what: 'Enquiries, replies, supplier and inspection emails. Drafts land in your inbox, nothing is sent for you.',
      unlocks: ['own-permits', 'lead-catcher', 'replies', 'price-watch', 'builder-engine', 'morning-brief'],
      steps: ['Open Claude, then Settings, then Connectors.', 'Find Gmail and press Connect.', 'Sign in with the ' + FZ.biz() + ' Google account and allow access.'], link: CONNECTORS },
    { id: 'microsoft', group: 'core', name: 'Microsoft 365', alt: 'gmail', what: 'Use this instead of Gmail if your email is Outlook.',
      unlocks: ['own-permits', 'lead-catcher', 'replies', 'price-watch', 'builder-engine', 'morning-brief'],
      steps: ['Open Claude, then Settings, then Connectors.', 'Find Microsoft 365 and press Connect.', 'Sign in with your work account and allow access.'], link: CONNECTORS },
    { id: 'quickbooks', group: 'core', name: 'QuickBooks', what: 'Payments and the books, so nobody is chased for money already paid.',
      unlocks: ['get-paid', 'month-close', 'cash-in', 'pay-bills'],
      steps: ['Open Claude, then Settings, then Connectors.', 'Find QuickBooks and press Connect.', 'Sign in and pick the ' + FZ.biz() + ' company.'], link: CONNECTORS },
    { id: 'google', group: 'core', key: true, name: 'Google Places', what: 'Your Google rating and reviews, and nearby competitors.',
      unlocks: ['local-search-check', 'review-watch'],
      steps: ['Nothing to set up on your side. Google business listings are public, so Flowzyn uses its own Google key.', 'Your Operator switches it on for ' + FZ.biz() + ' and marks it done here.'] },
    { id: 'apollo', group: 'data', name: 'Apollo', what: 'Finds the right person and a verified business email for builders, designers, showrooms, property managers and realtors.',
      unlocks: ['builder-engine', 'partner-finder'],
      steps: ['In Apollo, open Settings, then Integrations, then API.', 'Create a key for ' + FZ.biz() + ' Agents.', 'Your Operator adds the key with you on a short call.'], link: 'https://app.apollo.io/' },
    { id: 'lusha', group: 'data', name: 'Lusha', what: 'A second source for names and business emails when Apollo has no match.',
      unlocks: ['builder-engine', 'partner-finder'],
      steps: ['In Lusha, open the API section of your account.', 'Copy your API key.', 'Your Operator adds the key with you on a short call.'], link: 'https://dashboard.lusha.com/' },
    { id: 'other-data', group: 'data', ownOnly: true, name: 'Your own data provider', what: 'Already pay for ZoomInfo, Seamless or another contact data tool? Your agents can use it instead.',
      unlocks: ['builder-engine', 'partner-finder'],
      steps: ['Find the API or integrations page in your data tool and create a key.', 'Your Operator checks it works with your agents and adds it with you.'] }
  ];
  FZ.AGENT_NEEDS = { 'own-permits': 'gmail', 'pay-bills': 'quickbooks' };

  // A step counts as done when connected, provided by Flowzyn, or (for email) the other email tool is connected.
  FZ.setupDone = function (id, state) {
    const s = FZ.SETUP.find((x) => x.id === id);
    if (!s) return false;
    if (s.always) return true;
    const mine = state[id] || {};
    if (mine.done) return true;
    if (s.alt && state[s.alt] && state[s.alt].done) return true;
    return false;
  };

  FZ.renderSetup = function (ctx, state, save) {
    const { ui } = ctx;
    const { h } = ui;
    const op = FZ.isOperator();
    const find = (id) => FZ.SETUP.find((x) => x.id === id);
    const isOn = (id) => { const s = find(id); return !!(s && (s.always || (state[id] && state[id].done))); };
    // Display names only. Keys with no agent in the list are dropped.
    const agentsOf = (keys) => [...new Set(keys || [])].map((k) => FZ.byKey(k)).filter(Boolean);
    const powers = (list) => {
      if (!list.length) return null;
      const names = list.map((a) => a.name);
      const shown = names.length > 4 ? names.slice(0, 4).join(', ') + ' and ' + (names.length - 4) + ' more' : names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0];
      return h('p', { class: 'cx-powers' }, h('span', null, 'Powers: '), shown);
    };
    // Jobber lists only agents no other tool row names, so no name shows twice.
    const elsewhere = new Set(); FZ.SETUP.forEach((s) => (s.unlocks || []).forEach((k) => elsewhere.add(k)));
    const jobberAgents = FZ.AGENTS.filter((a) => (a.group === 'run' || a.group === 'keep') && !FZ.AGENT_NEEDS[a.key] && !elsewhere.has(a.key));

    // The four core tools as rows. Email is one row with two choices.
    const rows = [
      { id: 'jobber', name: 'Jobber', glyph: 'J', what: 'Quotes, jobs, visits and invoices. Every Run and Keep agent reads it.', agents: jobberAgents },
      { id: 'email', name: 'Email', glyph: '@', what: 'Reads enquiries and replies. Drafts land in your inbox, nothing is sent for you.', agents: agentsOf(find('gmail').unlocks), choices: ['gmail', 'microsoft'] },
      { id: 'quickbooks', name: 'QuickBooks', glyph: 'Q', what: find('quickbooks').what, agents: agentsOf(find('quickbooks').unlocks) },
      { id: 'google', name: 'Google Places', glyph: 'G', what: 'Your Google rating, reviews and nearby competitors.', agents: agentsOf(find('google').unlocks), opOnly: true }
    ];
    const rowOn = (r) => r.choices ? r.choices.some(isOn) : isOn(r.id);
    const done = rows.filter(rowOn);
    const left = rows.filter((r) => !rowOn(r));

    // Status line: what is connected, and what is left with what it switches on.
    const ownerLeft = left.filter((r) => !r.opOnly);
    const opLeft = left.filter((r) => r.opOnly);
    const nameLeft = (list) => list.map((r) => r.id === 'email' ? 'email' : r.name).join(' and ');
    const more = (list) => { const set = new Set(); list.forEach((r) => r.agents.forEach((a) => set.add(a.key))); return set.size; };
    let status;
    if (!left.length) status = ['All ', { b: String(rows.length) }, ' tools connected. Every agent that needs them is on.'];
    else {
      const ask = ownerLeft.length ? ownerLeft : opLeft;
      const n = more(ask);
      const verb = ownerLeft.length ? 'Connect ' + nameLeft(ask) + ' to switch on ' : (op ? 'Switch on ' + nameLeft(ask) + ' to start ' : 'Your Operator switches on ' + nameLeft(ask) + ' for ');
      status = [done.length + ' of ' + rows.length + ' tools connected. ', verb, n ? { b: n + ' more ' + (n === 1 ? 'agent' : 'agents') } : 'the rest', '.'];
    }

    const msgBox = () => h('p', { class: 'fz-hint cx-msg', role: 'status' });
    const saver = (b, msg, id, patch) => b.addEventListener('click', async () => { b.disabled = true; if (!(await save(id, patch))) { msg.textContent = 'Could not save here. Only an editor of this page can change setup.'; b.disabled = false; } });
    const btn = (label, cls) => h('button', { type: 'button', class: 'fz-btn ' + (cls || 'act') }, label);

    // The steps for one tool, shown under its row.
    const stepsFor = (s, msg) => {
      const confirm = btn(s.group === 'data' ? 'I added my key' : 'I connected it');
      saver(confirm, msg, s.id, { done: true, mode: 'own' });
      let skip = null;
      if (s.group === 'data') { skip = btn('Skip', 'ghost cx-skip'); saver(skip, msg, s.id, { mode: 'skip', done: false }); }
      const help = !op && FZ.opButton ? FZ.opButton({ id: 'setup-' + s.id, title: 'Help connecting ' + s.name, meta: 'Connect page' }) : null;
      return h('div', { class: 'cx-steps' },
        h('ol', { class: 'cx-ol' }, s.steps.map((t) => t.split('[your business]').join(FZ.biz())).map((t, i) => h('li', null, h('span', { class: 'cx-n', 'aria-hidden': 'true' }, String(i + 1)), h('span', null, t)))),
        h('div', { class: 'cx-btns' }, confirm, s.link ? ui.extLink(s.link, 'Open ' + (s.link === CONNECTORS ? 'Claude connectors' : s.name), 'fz-btn ghost cx-link') : null, help, skip));
    };

    const statusEl = (tone, text) => h('span', { class: 'cx-state ' + tone }, tone === 'green' ? h('span', { class: 'dot green', 'aria-hidden': 'true' }) : null, text);

    const row = (r) => {
      const msg = msgBox();
      const panel = h('div', { class: 'cx-panel', hidden: true });
      const el = h('li', { class: 'cx-row' });
      let state1, action = [];
      const openFor = (s, b, all) => {
        const same = !panel.hidden && panel.dataset.for === s.id;
        all.forEach((x) => { x.classList.remove('on'); x.setAttribute('aria-expanded', 'false'); });
        if (same) { panel.hidden = true; panel.dataset.for = ''; if (b.dataset.label) b.textContent = b.dataset.label; return; }
        panel.replaceChildren(stepsFor(s, msg)); panel.hidden = false; panel.dataset.for = s.id;
        b.classList.add('on'); b.setAttribute('aria-expanded', 'true');
        if (b.dataset.label) b.textContent = 'Hide steps';
      };
      if (r.choices) {
        const on = r.choices.find(isOn);
        if (on) {
          state1 = statusEl('green', 'Connected with ' + find(on).name);
          const u = btn('Undo', 'ghost'); saver(u, msg, on, { done: false, mode: null }); action = [u];
        } else {
          state1 = statusEl('quiet', 'Not connected yet');
          const bs = r.choices.map((c) => btn(find(c).name, 'act cx-choice'));
          bs.forEach((b, i) => { b.setAttribute('aria-expanded', 'false'); b.addEventListener('click', () => openFor(find(r.choices[i]), b, bs)); });
          action = bs;
        }
      } else {
        const s = find(r.id);
        const st = state[r.id] || {};
        if (isOn(r.id)) {
          state1 = statusEl('green', 'Connected');
          if (!s.always && (!r.opOnly || op)) { const u = btn('Undo', 'ghost'); saver(u, msg, r.id, { done: false, mode: null }); action = [u]; }
        } else if (st.mode === 'skip') {
          state1 = statusEl('quiet', 'Skipped');
          const u = btn('Undo', 'ghost'); saver(u, msg, r.id, { done: false, mode: null }); action = [u];
        } else if (r.opOnly) {
          state1 = statusEl('quiet', op ? 'Not switched on yet' : 'Your Operator switches this on');
          if (op) { const b = btn('Switch on'); saver(b, msg, r.id, { done: true, mode: 'own' }); action = [b]; }
        } else {
          state1 = statusEl('quiet', 'Not connected yet');
          const b = btn('Connect'); b.dataset.label = 'Connect'; b.setAttribute('aria-expanded', 'false');
          b.addEventListener('click', () => openFor(s, b, [b]));
          action = [b];
        }
      }
      el.append(
        h('div', { class: 'cx-line' },
          h('span', { class: 'cx-tile', 'aria-hidden': 'true' }, r.glyph),
          h('div', { class: 'cx-main' },
            h('div', { class: 'cx-head' }, h('h3', null, r.name), state1),
            h('p', { class: 'cx-what' }, r.what),
            powers(r.agents)),
          h('div', { class: 'cx-act' + (action.length ? '' : ' empty') }, action)),
        panel, msg);
      return el;
    };

    const dataRows = FZ.SETUP.filter((s) => s.group === 'data').map((s) => ({ id: s.id, name: s.name, glyph: s.name.slice(0, 1), what: s.what, agents: [] }));
    const dataOn = dataRows.filter((r) => isOn(r.id)).length;
    const dataFold = h('details', { class: 'fz-details cx-fold' },
      h('summary', null, h('span', null, 'Contact data, optional'), h('span', { class: 'cx-foldn' }, dataOn ? dataOn + ' connected' : 'Emails for builders, partners and realtors')),
      h('div', null, h('ol', { class: 'cx-list' }, dataRows.map(row))));

    // Your business: the details every agent uses in what it writes (Matt, Nov 7: the phone number is an account setting).
    const bizCard = () => {
      const pr = FZ.profile() || {};
      const F = [['business', 'Business name', FZ.biz()], ['phone', 'Phone customers call', pr.phone || ''], ['shopAddress', 'Shop street address', pr.shopAddress || ''], ['website', 'Website', pr.website || '']];
      const ins = F.map(([k, label, v]) => { const i = h('input', { type: k === 'phone' ? 'tel' : 'text', class: 'fz-input', value: v === '[your business]' ? '' : v, 'aria-label': label }); return [k, label, i]; });
      const msg = h('span', { class: 'fz-hint', role: 'status' }, '');
      const b = h('button', { type: 'button', class: 'fz-btn act' }, 'Save');
      b.addEventListener('click', async () => { const patch = {}; ins.forEach(([k, , i]) => { patch[k] = i.value.trim(); }); b.disabled = true; const ok = await FZ.saveProfile(patch); b.disabled = false; msg.textContent = ok ? 'Saved. Your agents use these from now on.' : 'Could not save. Try again.'; });
      return h('section', { class: 'cx-biz' }, h('h2', null, 'Your business'), h('p', { class: 'fz-hint' }, 'Your agents put these in every email, card and quote they write.'),
        h('div', { class: 'cx-bizf' }, ins.map(([k, label, i]) => h('label', null, h('span', null, label), i))), h('div', { class: 'cx-bizb' }, b, msg),
        h('style', null, '.cx-biz{border:1px solid var(--line);border-radius:12px;background:var(--card);padding:24px 28px;display:flex;flex-direction:column;gap:12px}.cx-biz h2{margin:0;font-size:17px}.cx-bizf{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.cx-bizf label{display:flex;flex-direction:column;gap:6px;font-size:13px;color:var(--muted)}.cx-bizf .fz-input{min-height:42px}.cx-bizb{display:flex;align-items:center;gap:14px}@media(max-width:620px){.cx-bizf{grid-template-columns:1fr}.cx-biz{padding:20px 18px}}'));
    };
    // Auto approve: one switch per agent that sends email, and one for all of them.
    const autoCard = () => {
      if (!FZ.auto) return null;
      const keys = Object.keys(FZ.auto.SENDERS);
      const box = h('section', { class: 'cx-biz cx-auto' });
      const paint = () => {
        const onN = keys.filter((k) => FZ.auto.on(k)).length;
        const all = h('button', { type: 'button', class: 'fz-btn' + (onN === keys.length ? '' : ' act') }, onN === keys.length ? 'Turn off for all' : 'Turn on for all');
        all.addEventListener('click', async () => { all.disabled = true; const v = onN !== keys.length; const patch = {}; keys.forEach((k) => { patch[k] = v; }); await FZ.auto.set(patch); paint(); });
        box.replaceChildren(
          h('div', { class: 'cx-ah' }, h('div', null, h('h2', null, 'Auto approve'), h('p', { class: 'fz-hint' }, onN ? onN + ' of ' + keys.length + ' send on their own. The rest wait for your OK.' : 'Every email waits for your OK. Turn this on and they go out on their own, from your email.')), all),
          h('ul', { class: 'cx-alist' }, keys.map((k) => { const on = FZ.auto.on(k); const a = FZ.byKey(k) || { name: k };
            const t = h('button', { type: 'button', role: 'switch', 'aria-checked': String(on), class: 'cx-sw' + (on ? ' on' : ''), 'aria-label': 'Auto approve ' + FZ.auto.SENDERS[k] }, h('i'));
            t.addEventListener('click', async () => { t.disabled = true; await FZ.auto.set({ [k]: !on }); paint(); });
            return h('li', null, h('span', null, h('b', null, FZ.auto.SENDERS[k]), h('small', null, a.name)), h('span', { class: 'cx-swl' }, on ? 'On' : 'Off'), t); })),
          h('p', { class: 'fz-hint' }, 'Each email is still written for that person and sent only to an address in Jobber or on their own website. Turn any of these off to read them first.'),
          h('style', null, '.cx-ah{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap}.cx-alist{list-style:none;margin:0;padding:0}.cx-alist li{display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:14px;align-items:center;padding:12px 0;border-top:1px solid var(--line)}.cx-alist b{display:block;font-size:14px;color:var(--fg)}.cx-alist small{font-size:12px;color:var(--muted)}.cx-swl{font-size:13px;color:var(--muted);min-width:24px}.cx-sw{all:unset;cursor:pointer;width:44px;height:26px;border-radius:999px;background:var(--line);position:relative}.cx-sw i{position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:var(--fg);transition:left .15s}.cx-sw.on{background:var(--accent)}.cx-sw.on i{left:21px}.cx-sw:focus-visible{outline:2px solid var(--accent);outline-offset:2px}'));
      };
      paint();
      return box;
    };
    return [
      h('style', null, CSS),
      h('header', { class: 'ov-hero' }, h('h1', { class: 'home' }, 'Connect your tools')),
      ui.status(status),
      bizCard(),
      autoCard(),
      h('ol', { class: 'cx-list cx-core', 'aria-label': 'Your tools' }, rows.map(row)),
      dataFold,
      ui.how('Passwords and keys are never typed into this page or a chat. Jobber, email and QuickBooks connect in Claude settings, and you tick the step here when it is done.',
        'Your Operator switches on Google Places and adds any builder data keys with you.',
        'The first scheduled run confirms each connection, and any problem shows on the Agents tab.')
    ];
  };

  const CSS = `
#fz-setupview .fz-status { margin-top: 4px; }
.cx-list { list-style: none; margin: 10px 0 0; padding: 0; background: var(--card); border: 1px solid var(--edge); border-radius: 12px; }
.cx-row { padding: 18px 28px; border-top: 1px solid var(--edge); }
.cx-row:first-child { border-top: 0; }
.cx-line { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; column-gap: 20px; align-items: center; min-height: 96px; }
.cx-tile { width: 40px; height: 40px; border-radius: 10px; display: grid; place-items: center; background: var(--accent); color: var(--on-accent); font-weight: 800; font-size: 18px; align-self: center; }
.cx-main { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.cx-head { display: flex; align-items: baseline; gap: 14px; flex-wrap: wrap; }
.cx-head h3 { margin: 0; font-size: 17px; font-weight: 700; color: var(--head); }
.cx-state { display: inline-flex; align-items: center; gap: 7px; font-size: 13px; font-weight: 600; color: var(--muted); }
.cx-state .dot { width: 8px; height: 8px; margin: 0; align-self: center; }
.cx-state.green { color: var(--ok-fg); }
#fz-setupview .cx-what { margin: 0; font-size: 14px; line-height: 1.5; color: var(--muted); }
#fz-setupview .cx-powers { margin: 0; font-size: 13px; line-height: 1.5; color: var(--meta); }
.cx-powers span { color: var(--muted); }
.cx-act { display: flex; gap: 10px; justify-content: flex-end; align-items: center; }
.cx-act.empty { display: none; }
#fz-setupview .cx-act .fz-btn, #fz-setupview .cx-btns .fz-btn { flex: none; width: auto; min-width: 112px; min-height: 40px; padding: 0 18px; font-size: 14px; margin: 0; align-self: center; justify-content: center; }
#fz-setupview .fz-btn.ghost { border-color: var(--btn); }
#fz-setupview .fz-btn.cx-choice.on { background: var(--accent); border-color: var(--accent); color: var(--on-accent) !important; }
#fz-setupview .fz-btn.opbtn { min-width: 0; }
#fz-setupview .cx-act .fz-btn.cx-choice { min-width: 140px; }
.cx-panel { margin: 4px 0 2px 60px; padding: 20px 0 6px; border-top: 1px dashed var(--edge); }
.cx-ol { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 12px; }
.cx-ol li { display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 12px; align-items: center; font-size: 14px; line-height: 1.5; color: var(--fg); }
.cx-n { width: 26px; height: 26px; border-radius: 50%; border: 1.5px solid var(--accent); color: var(--accent-text); display: grid; place-items: center; font-size: 13px; font-weight: 700; }
.cx-btns { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 18px; }
.cx-msg:empty { display: none; }
.cx-msg { margin-top: 8px; }
.cx-fold { margin-top: 10px !important; }
.cx-fold > summary { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 18px 28px !important; min-height: 60px !important; font-size: 16px !important; font-weight: 700; color: var(--head); }
.cx-foldn { font-size: 13px; font-weight: 600; color: var(--muted); }
.cx-fold > div { padding: 0 !important; }
.cx-fold .cx-list { margin: 0; border: 0; border-top: 1px solid var(--edge); border-radius: 0 0 12px 12px; background: transparent; }
#fz-setupview > .fz-how { margin-top: 10px !important; }
@media (max-width: 640px) {
  .cx-core { margin-top: 2px; }
  .cx-row { padding: 18px 18px; }
  .cx-line { grid-template-columns: 40px minmax(0, 1fr); column-gap: 14px; row-gap: 14px; align-items: start; min-height: 0; }
  .cx-tile { align-self: start; }
  .cx-act { grid-column: 2; justify-content: flex-start; flex-wrap: wrap; }
  #fz-setupview .cx-act .fz-btn, #fz-setupview .cx-act .fz-btn.cx-choice { flex: 1 1 0; min-width: 0; padding: 0 10px; white-space: nowrap; }
  .cx-panel { margin-left: 0; }
  .cx-fold { margin-top: 2px !important; }
  .cx-fold > summary { padding: 16px 18px !important; }
  #fz-setupview > .fz-how { margin-top: 2px !important; }
}
`;
})();
