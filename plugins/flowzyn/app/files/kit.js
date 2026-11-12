// Agent screen kit: the one layout every agent screen uses (design concept, core #52).
// Order: agent strip, headline, how line, hero card (one visual + what it did today), the top 3 that need you, the rest folded.
(function () {
  const css = `
  .ag-strip { display:flex; align-items:center; gap:10px; flex-wrap:wrap; margin: 4px 0 10px; }
  .ag-run { display:inline-flex; align-items:center; gap:6px; font-size:12px; color:var(--muted); border:1px solid var(--line); border-radius:999px; padding:3px 10px; }
  .ag-run i { width:7px; height:7px; border-radius:50%; background:#22c55e; display:inline-block; }
  .ag-how { color: var(--muted); font-size: 14px; margin: -6px 0 18px; max-width: 70ch; }
  .ag-hero { display:grid; grid-template-columns: minmax(0,1.6fr) minmax(280px,1fr); gap: 0; border:1px solid var(--line); border-radius:12px; background: var(--card); margin: 0 0 18px; overflow:hidden; }
  .ag-hero > .ag-viz { padding: 18px 20px; min-width:0; }
  .ag-hero > .ag-did { padding: 22px 26px; border-left:1px solid var(--line); }
  .ag-eyebrow { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: var(--accent); font-weight: 700; margin:0 0 4px; }
  .ag-title { font-size: 18px; font-weight: 700; margin: 0 0 4px; color: var(--fg); }
  .ag-title b { color: var(--accent); font-weight: 700; }
  .ag-sub { font-size: 13px; color: var(--muted); margin: 0 0 14px; }
  .ag-tag { float:right; font-size:11px; color:var(--muted); border:1px solid var(--line); border-radius:6px; padding:1px 7px; }
  .ag-tl { list-style:none; margin: 14px 0 0; padding:0; position:relative; }
  .ag-tl li { position:relative; padding: 0 0 22px 28px; font-size: 14px; line-height: 1.45; color: var(--fg); }
  .ag-tl li:last-child { padding-bottom: 0; }
  .ag-tl li::before { content:''; position:absolute; left:2px; top:5px; width:10px; height:10px; border-radius:50%; border:1.5px solid var(--muted); background: var(--card); box-sizing: border-box; z-index:1; }
  .ag-tl li.done::before { border-color:#22c55e; background:#22c55e; }
  .ag-tl li::after { content:''; position:absolute; left:6.5px; top:16px; bottom:2px; width:1px; background: var(--line); }
  .ag-tl li:last-child::after { display:none; }
  .ag-tl small { display:block; color: var(--muted); font-size: 13px; margin-top: 3px; line-height: 1.4; }
  .ag-need { border:1px solid var(--line); border-radius:12px; background: var(--card); margin: 0 0 18px; }
  .ag-need > header { padding: 16px 20px 6px; }
  .ag-nh { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; }
  .ag-nhr { display:flex; flex-direction:column; align-items:flex-end; gap:6px; } .ag-nhr small { font-size:12px; color:var(--muted); }
  .ag-autoon { border-color: var(--ok-fg, #22c55e); } .ag-autoon > header { padding-bottom: 20px !important; }
  @media (max-width: 720px) { .ag-nhr { align-items:flex-start; } }
  .ag-row { display:grid; grid-template-columns: 28px minmax(0,1fr) auto; gap: 12px; align-items:center; padding: 12px 20px; border-top:1px solid var(--line); }
  .ag-n { color: var(--muted); font-size: 12px; font-variant-numeric: tabular-nums; }
  .ag-what { min-width:0; }
  .ag-what .t { font-size: 14px; font-weight: 600; color: var(--fg); }
  .ag-what .t a { color: inherit; text-decoration: underline; text-decoration-color: var(--line); text-underline-offset: 3px; }
  .ag-what .m { font-size: 12px; color: var(--muted); }
  .ag-what .m b { color: var(--accent); font-weight: 700; }
  .ag-what .d { font-size: 13px; color: var(--fg); opacity:.85; margin-top: 2px; }
  .ag-act { display:flex; gap: 10px; align-items:center; }
  .ag-act { flex-wrap: wrap; justify-content: flex-end; }
  .ag-act .fz-btn.ag-clear { border: 1px solid var(--line) !important; color: var(--muted) !important; min-width: 0 !important; padding: 0 14px !important; }
  .ag-act .fz-btn.ag-clear:hover:not(:disabled) { background: var(--v3-card2, var(--card)) !important; color: var(--fg) !important; }
  .ag-row.ag-cleared { opacity: .45; }
  .ag-act .fz-btn, .ag-act .fz-btn.act { background: transparent !important; border: 1px solid var(--accent) !important; color: var(--fg) !important; font-weight: 700; min-height: 40px; border-radius: 10px; }
  .ag-act .fz-btn:hover, .ag-act .fz-btn:focus-visible, .ag-act .fz-btn.act:hover { background: var(--accent) !important; color: #fff !important; }
  .ag-read { margin-top: 8px; }
  .ag-read summary { cursor: pointer; font-size: 13px; color: var(--muted); text-decoration: underline; text-underline-offset: 3px; list-style: none; }
  .ag-read pre { white-space: pre-wrap; font: inherit; font-size: 13px; line-height: 1.55; background: var(--quiet, rgba(127,127,127,.08)); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; margin: 8px 0 0; color: var(--fg); }
  .ag-more { display:flex; justify-content:space-between; gap: 12px; padding: 12px 20px; border-top:1px solid var(--line); font-size: 13px; color: var(--muted); }
  .ag-more b { color: var(--fg); }
  .ag-more details { width:100%; }
  .ag-more summary { cursor:pointer; color: var(--fg); text-decoration: underline; text-underline-offset:3px; list-style:none; }
  .ag-more summary::-webkit-details-marker { display:none; }
  .ag-check { list-style:none; padding:0; margin: 8px 0 0; }
  .ag-check li { display:flex; gap:10px; align-items:flex-start; font-size:13px; padding: 6px 0; }
  .ag-check li::before { content:'\\2713'; flex:none; width:16px; height:16px; border-radius:4px; background:#22c55e; color:#0f1218; font-size:11px; font-weight:800; display:inline-flex; align-items:center; justify-content:center; }
  .ag-ex { border:1px dashed var(--line); border-radius:10px; padding: 14px 16px; opacity:.92; }
  .ag-rv { grid-column: 1 / -1; margin: 4px 0 2px 40px; border: 1px solid var(--line); border-radius: 12px; background: var(--quiet, rgba(127,127,127,.06)); padding: 14px 16px; }
  .ag-rv[hidden] { display: none; }
  .ag-rv .rv-h { font-size: 12px; color: var(--muted); margin: 0 0 8px; }
  .ag-rv .rv-h b { color: var(--fg); font-weight: 600; }
  .ag-rv textarea { width: 100%; min-height: 160px; box-sizing: border-box; font: inherit; font-size: 14px; line-height: 1.55; color: var(--fg); background: var(--card); border: 1px solid var(--line); border-radius: 10px; padding: 12px 14px; resize: vertical; }
  .ag-rv .rv-b { display: flex; gap: 10px; align-items: center; margin-top: 10px; flex-wrap: wrap; }
  .ag-rv .rv-note { font-size: 12px; color: var(--muted); }
  .ag-rv .rv-ok { font-size: 14px; color: #22c55e; font-weight: 600; }
  @media (max-width: 720px) { .ag-rv { margin-left: 0; } }
  @media (max-width: 720px) {
    .ag-hero { grid-template-columns: 1fr; }
    .ag-hero > .ag-did { border-left:0; border-top:1px solid var(--line); }
    .ag-row { grid-template-columns: 22px minmax(0,1fr); }
    .ag-act { grid-column: 2; flex-wrap: wrap; }
  }`;
  try { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); } catch (e) { /* no styles */ }

  const K = {};
  // h comes from ctx.ui.h. Every function returns one element (or null).
  // Agent strip: green "Working" pill with last or next run. text: e.g. "Working now · last run 7:40am".
  K.strip = (h, text) => h('div', { class: 'ag-strip' }, h('span', { class: 'ag-run' }, h('i'), text || 'Running'));
  // One line under the headline: what the agent does, in plain words.
  K.how = (h, text) => text ? h('p', { class: 'ag-how' }, text) : null;
  // Hero card: one visual with a finding title, and what the agent did today on the right.
  // o: { eyebrow, title (string or [parts] with {b}), sub, tag ('Example' etc), viz (element), did: [{t, s, done}] , didTitle }
  K.hero = (h, o) => {
    const title = [].concat(o.title || []).map((p) => (p && typeof p === 'object' && 'b' in p) ? h('b', null, p.b) : p);
    const viz = h('div', { class: 'ag-viz' },
      o.tag ? h('span', { class: 'ag-tag' }, o.tag) : null,
      o.eyebrow ? h('p', { class: 'ag-eyebrow' }, o.eyebrow) : null,
      h('h3', { class: 'ag-title' }, ...title),
      o.sub ? h('p', { class: 'ag-sub' }, o.sub) : null,
      o.viz || null);
    const did = (o.did && o.did.length) ? h('div', { class: 'ag-did' },
      h('p', { class: 'ag-eyebrow', style: 'color:var(--muted)' }, o.didTitle || 'What it found just now'),
      h('ol', { class: 'ag-tl' }, o.did.map((d) => h('li', { class: d.done === false ? '' : 'done' }, d.t, d.s ? h('small', null, d.s) : null)))) : null;
    const box = h('section', { class: 'ag-hero' }, viz, did);
    if (!did) box.style.gridTemplateColumns = '1fr';
    return box;
  };
  // The top items that need the owner, ranked. items: [{title, link, meta (string or parts), detail, actions: [elements]}]
  // rest: { count, label, list (element shown when opened) }
  // Sending agents: a Turn on auto approve switch right where the approvals are. When it is on, the list folds to one line.
  K.autoKey = () => { const m = String(location.hash || '').match(/^#a-(.+)$/); const k = m && m[1]; return k && window.FZ && FZ.auto && FZ.auto.SENDERS[k] ? k : null; };
  K.autoBtn = (h, key, onDone) => { const on = FZ.auto.on(key); const b = h('button', { type: 'button', class: 'fz-btn ag-auto' + (on ? '' : ' act') }, on ? 'Turn off auto approve' : 'Turn on auto approve');
    b.addEventListener('click', async () => { b.disabled = true; const ok = await FZ.auto.set({ [key]: !on }); b.disabled = false; if (ok && window.FZ.openBoard) FZ.openBoard(key); else if (!ok) b.textContent = 'Could not save'; if (onDone) onDone(); }); return b; };
  K.needs = (h, o) => {
    if (!o.items || !o.items.length) return null;
    const ak = K.autoKey();
    if (ak && FZ.auto.on(ak)) {
      const n = o.items.length + ((o.rest && o.rest.count) || 0);
      return h('section', { class: 'ag-need ag-autoon' }, h('header', null, h('p', { class: 'ag-eyebrow', style: 'color:var(--ok-fg,#22c55e)' }, 'Auto approve is on'),
        h('h3', { class: 'ag-title' }, n + ' go out from your email on the next run. Nothing for you to do.'),
        h('p', { class: 'ag-sub' }, 'Each one is still written for that person. Turn it off any time to read them first.'),
        h('div', { class: 'ag-act' }, K.autoBtn(h, ak))));
    }
    const title = [].concat(o.title || []).map((p) => (p && typeof p === 'object' && 'b' in p) ? h('b', null, p.b) : p);
    return h('section', { class: 'ag-need' },
      h('header', { class: ak ? 'ag-nh' : null }, h('div', null, h('p', { class: 'ag-eyebrow' }, o.eyebrow || 'Needs you'), h('h3', { class: 'ag-title' }, ...title)), ak ? h('div', { class: 'ag-nhr' }, K.autoBtn(h, ak), h('small', null, 'Send these without a tap each')) : null),
      ...o.items.map((it, i) => K._row(h, it, i)).filter(Boolean),
      o.rest && o.rest.count ? h('div', { class: 'ag-more' },
        o.rest.list ? h('details', null, h('summary', null, h('b', null, o.rest.count + ' more'), ' ' + (o.rest.label || 'the agent is handling on its own')), o.rest.list)
          : h('span', null, h('b', null, o.rest.count + ' more'), ' ' + (o.rest.label || 'the agent is handling on its own'))) : null);
  };

  // One Needs you row. When the item carries an email (it.review), the only button is Read and approve:
  // it opens the email in place, editable, and Approve and send sits under it. Nothing sends unread.
  // it.review: { to, subject, draft, approve: async (text) => bool, skip: async () => bool }
  K._row = (h, it, i) => {
    const parts = (v) => [].concat(v).map((p) => (p && typeof p === 'object' && 'b' in p) ? h('b', null, p.b) : p);
    // The agent's prepared email for the same Jobber record, looked up when the button is pressed (tasks load after the screen).
    const fromTask = () => {
      const a = (it.actions || []).find((x) => x && x.tagName === 'A' && x.href);
      const link = it.link || (a && a.getAttribute('href'));
      if (!link || !(window.FZ && FZ.tasksNow)) return null;
      const now = FZ.tasksNow(); const t = (now.list || []).find((x) => x.link === link && x.draft);
      if (!t) return null; const d = (now.done || {})[t.id]; if (d && d.done) return null;
      return { draft: t.draft, subject: t.review || null,
        approve: (text) => FZ.saveTask(t.id, true, Object.assign({}, t, { title: 'Approved: ' + (t.review || t.title), approved: true, draft: text })),
        skip: () => FZ.saveTask(t.id, true) };
    };
    const slot = h('div', { class: 'ag-rv', hidden: '' });
    let built = false, readBtn = null;
    const build = (rv) => {
      const ta = h('textarea', { 'aria-label': 'Email to ' + (rv.to || 'the customer') }); ta.value = rv.draft;
      const ok = h('button', { type: 'button', class: 'fz-btn act' }, rv.approveLabel || 'Approve and send');
      const skip = rv.skip ? h('button', { type: 'button', class: 'fz-btn ghost' }, 'Not this one') : null;
      const msg = h('span', { class: 'rv-note', role: 'status' }, rv.note || 'Edit anything first. It goes out from your own email.');
      slot.replaceChildren(
        (rv.to || rv.subject) ? h('p', { class: 'rv-h' }, rv.to ? ['To ', h('b', null, rv.to)] : null, rv.subject ? [rv.to ? ' · ' : '', h('b', null, rv.subject)] : null) : null,
        ta, h('div', { class: 'rv-b' }, ok, skip, msg));
      ok.addEventListener('click', async () => {
        ok.disabled = true; if (skip) skip.disabled = true; msg.textContent = 'Approving…';
        const done = rv.approve ? await rv.approve(ta.value) : false;
        if (done) { slot.replaceChildren(h('p', { class: 'rv-ok' }, rv.doneText || 'Approved. It goes out on the next run.')); if (readBtn) { readBtn.textContent = 'Approved'; readBtn.disabled = true; } }
        else { ok.disabled = false; if (skip) skip.disabled = false; msg.textContent = 'Could not save here. Try again, or hand it to your Operator.'; }
      });
      if (skip) skip.addEventListener('click', async () => { skip.disabled = true; if (await rv.skip()) { slot.replaceChildren(h('p', { class: 'rv-note' }, 'Skipped. Nothing was sent.')); if (readBtn) { readBtn.textContent = 'Skipped'; readBtn.disabled = true; } } else skip.disabled = false; });
      built = true; return ta;
    };
    const toggle = (rv) => { if (!built) build(rv); const open = slot.hidden; slot.hidden = !open; readBtn.setAttribute('aria-expanded', String(open)); readBtn.textContent = open ? 'Close' : 'Read and approve'; if (open) { const ta = slot.querySelector('textarea'); if (ta) ta.focus(); } };
    const given = it.review && it.review.draft ? it.review : null;
    const acts = [];
    if (given) { readBtn = h('button', { type: 'button', class: 'fz-btn act', 'aria-expanded': 'false' }, 'Read and approve'); readBtn.addEventListener('click', () => toggle(given)); acts.push(readBtn); }
    (it.actions || []).forEach((a) => {
      if (!a) return;
      if (given && a.tagName === 'BUTTON') return;
      if (!given && !readBtn && a.tagName === 'BUTTON' && /^\s*(Send( it| reply| follow up)?|Approve( and send)?|Review( reminder| the ask)?)\s*$/i.test(a.textContent)) {
        readBtn = a; a.textContent = 'Read and approve'; a.setAttribute('aria-expanded', 'false');
        const orig = a.onclick; a.onclick = null;
        a.addEventListener('click', (e) => { const rv = fromTask(); if (rv || built) { e.preventDefault(); toggle(rv); } else if (orig) orig.call(a, e); });
      }
      acts.push(a);
    });
    // Every row can be cleared (Matt, Nov 10): Done (or Called when a call is the ask) and Dismiss. Saved, so it stays gone.
    const linkA = (it.actions || []).find((x) => x && x.tagName === 'A' && x.href);
    const recLink = it.link || (linkA && linkA.getAttribute('href')) || '';
    const rowId = () => { const now = (window.FZ && FZ.tasksNow) ? FZ.tasksNow() : {}; const t = recLink && (now.list || []).find((x) => x.link === recLink); return t ? t.id : 'need-' + String(recLink || [].concat(it.title).join(' ')).replace(/[^A-Za-z0-9]+/g, '-').slice(-80); };
    const wasDone = (() => { try { const d = ((FZ.tasksNow && FZ.tasksNow().done) || {})[rowId()]; return !!(d && d.done); } catch (e) { return false; } })();
    const callAsk = /\bcall\b/i.test(String(it.detail || '')) || /^Call\b/.test(String([].concat(it.title).join(' ')));
    const clear = (label, doneLabel) => { const b = h('button', { type: 'button', class: 'fz-btn ghost ag-clear' }, label); b.addEventListener('click', async () => { b.disabled = true; const ok = FZ.saveTask ? await FZ.saveTask(rowId(), true) : false; const row = b.closest('.ag-row'); if (ok && row) { row.classList.add('ag-cleared'); row.querySelectorAll('.ag-clear').forEach((x) => { x.disabled = true; }); b.textContent = doneLabel; } else { b.disabled = false; b.textContent = 'Could not save'; } }); return b; };
    if (!wasDone) acts.push(clear(callAsk ? 'Called' : 'Done', callAsk ? 'Called ✓' : 'Done ✓'), clear('Dismiss', 'Dismissed'));
    if (wasDone) return null;
    return h('div', { class: 'ag-row' },
      h('span', { class: 'ag-n' }, String(i + 1).padStart(2, '0')),
      h('div', { class: 'ag-what' },
        it.meta ? h('div', { class: 'm' }, ...parts(it.meta)) : null,
        h('div', { class: 't' }, it.link ? h('a', { href: it.link, target: '_blank', rel: 'noopener' }, it.title) : it.title),
        it.detail ? h('div', { class: 'd' }, it.detail) : null),
      acts.length ? h('div', { class: 'ag-act' }, ...acts) : null,
      slot);
  };
  // What it checked just now (for quiet weeks): lines of plain facts from the data.
  K.checked = (h, title, lines) => h('div', null, h('p', { class: 'ag-eyebrow' }, 'What it checked just now'), h('h3', { class: 'ag-title' }, title), h('ul', { class: 'ag-check' }, lines.filter(Boolean).map((l) => h('li', null, l))));
  // Example panel: always labelled.
  // No made up data anywhere (Matt, Nov 10): examples are switched off.
  K.example = () => null;
  K.exampleOld = (h, title, kids) => h('div', { class: 'ag-ex' }, h('span', { class: 'ag-tag' }, 'Example'), h('p', { class: 'ag-eyebrow', style: 'color:var(--muted)' }, 'What week 2 looks like'), h('h3', { class: 'ag-title' }, title), ...[].concat(kids || []));
  // Quiet state: checked today on the left, example on the right, in one hero card.
  K.quiet = (h, checkedEl, exampleEl) => exampleEl ? h('section', { class: 'ag-hero' }, h('div', { class: 'ag-viz' }, checkedEl), h('div', { class: 'ag-did' }, exampleEl)) : h('section', { class: 'ag-hero ag-hero-one' }, checkedEl);
  // Title case a builder or company name written in capitals.
  K.name = (s) => { s = String(s || '').trim(); if (s && s === s.toUpperCase()) s = s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/\b(Llc|Inc|Co)\b/g, (m) => m.toUpperCase() === 'LLC' ? 'LLC' : m); return s; };
  window.FZ = window.FZ || {};
  window.FZ.kit = K;
})();
