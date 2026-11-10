// Schedule Installs: from glass ordered to install booked.
// Glass ordered (job created) > delivery date from the supplier sheet > two install days lined up after delivery >
// note to the customer asking which day > customer picks > visit set in Jobber. Plus a ready answer to "how's it looking?".
// Jobber's connector can't create visits, so the last step is one tap in Jobber. Everything else is saved here.
FZ.board('install-scheduler', {
  source: 'Jobs and visits: Jobber, live. Delivery dates: read from the supplier\'s emails. Progress: saved in this page.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const { h } = ui;
    const A = FZ.act;
    const RULES = { noDateDays: 5, noAnswerDays: 2 };
    const S = Object.assign({ days: [1, 2, 3, 4, 5], perDay: 2, signer: '' }, (await A.getDoc('settings/schedule')) || {});
    const DN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const jobs = (await ctx.jobberAll('search_jobs', { status: 'unscheduled', limit: 50 }, 'jobs', 200)).filter((j) => !j.startAt);
    const visits = await ctx.jobberAll('search_visits', { startAt: { after: fmt.isoDaysAgo(0), before: fmt.isoDaysAhead(42) }, limit: 50 }, 'visits', 300).catch(() => []);
    const P = {};
    await ctx.pool(jobs, 6, async (j) => { P[j.id] = (await A.getDoc('pipeline/' + j.id.replace(/[^A-Za-z0-9]/g, ''))) || {}; });
    const key = (j) => 'pipeline/' + j.id.replace(/[^A-Za-z0-9]/g, '');

    // Days already holding installs, so a full day is skipped.
    const load = {};
    visits.forEach((v) => { if (v.startAt) { const d = fmt.dayKey(v.startAt); load[d] = (load[d] || 0) + 1; } });
    const DAY = 86400000;
    const ymd = (d) => new Date(d).toISOString().slice(0, 10);
    const nice = (s) => new Date(s + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    const short = (s) => new Date(s + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long' });
    const freeDays = (after, n) => {
      const out = []; let t = new Date(after + 'T12:00:00').getTime() + DAY;
      const today = Date.now();
      if (t < today) t = today + DAY;
      for (let i = 0; i < 40 && out.length < n; i++, t += DAY) {
        const d = new Date(t); const k = ymd(d);
        if (!S.days.includes(d.getDay())) continue;
        if ((load[fmt.dayKey(d.toISOString())] || 0) >= S.perDay) continue;
        out.push(k);
      }
      return out;
    };

    const rows = jobs.filter((j) => !P[j.id].skip).map((j) => {
      const p = P[j.id];
      const who = fmt.clean(j.client && j.client.name) || 'Customer';
      const first = who.split(/\s+/)[0];
      const ordered = p.orderedAt || j.createdAt;
      const stage = p.picked ? 'picked' : p.askedAt ? 'asked' : p.delivery ? 'dated' : 'waiting';
      const days = Math.max(0, fmt.daysSince(ordered) || 0);
      const late = stage === 'waiting' && days > RULES.noDateDays;
      const landed = (!!p.landedAt || (p.delivery && new Date(p.delivery + 'T23:59:00') < new Date())) && stage !== 'picked';
      const noAnswer = stage === 'asked' && (fmt.daysSince(p.askedAt) || 0) > RULES.noAnswerDays;
      return { j, p, who, first, ordered, stage, days, late, landed, noAnswer, total: Number(j.total) || 0, what: fmt.clean(j.title) || 'glass', city: j.property && j.property.address && fmt.clean(j.property.address.city) };
    });
    const ORDER = { picked: 0, asked: 1, dated: 2, waiting: 3 };
    rows.sort((a, b) => (b.late || b.landed || b.noAnswer) - (a.late || a.landed || a.noAnswer) || ORDER[a.stage] - ORDER[b.stage] || b.days - a.days);
    const flags = rows.filter((r) => r.late || r.landed || r.noAnswer);

    ctx.metric('install-scheduler', rows.length
      ? { value: fmt.plural(rows.length, 'job') + ' to get on the schedule', detail: flags.length ? fmt.plural(flags.length, 'needs', 'need') + ' you' : 'All on track' }
      : { value: 'Every job has an install day', detail: '' });

    const save = async (r, patch) => { const next = Object.assign({}, r.p, patch, { at: new Date().toISOString() }); if (await A.setDoc(key(r.j), next)) { r.p = next; P[r.j.id] = next; return true; } return false; };
    const rerender = () => FZ.openBoard('install-scheduler');

    const hi = (r) => (/\b(cabin|builders?|hoa|llc|inc|condo|residence|group|homes|mgmt|management|construction|remodel|dental|company|co)\b/i.test(r.who) ? 'there' : r.first);
    const statusText = (r) => {
      if (r.stage === 'picked') return 'Hi ' + hi(r) + ', you are booked in for ' + nice(r.p.picked) + '. The crew will text when they are on the way. ' + FZ.sign();
      if (r.p.delivery) return 'Hi ' + hi(r) + ', your glass is due ' + nice(r.p.delivery) + '. ' + (r.stage === 'asked' ? 'Just let me know which day works for the install and we will lock it in. ' : 'We will be in touch with install days as soon as it lands. ') + FZ.sign();
      return 'Hi ' + hi(r) + ', your glass is on order with our supplier. I will let you know the delivery date as soon as they confirm it, and we will set the install right after. ' + FZ.sign();
    };
    const askText = (r, two) => 'Hi ' + hi(r) + ', good news, your glass lands ' + short(r.p.delivery) + '. We can install ' + two.map(nice).join(' or ') + '. Which works best for you? ' + FZ.sign();

    // One step at a time (Matt, Nov 7: "not clear what to do here, what happens after"): the one question for this job, one main button,
    // one quiet way out, and what happens next. Every button the same size.
    const nm = (r) => /\b(cabin|builders?|hoa|llc|inc|condo|residence|group|homes|mgmt|management|construction|remodel|dental|company|co)\b/i.test(r.who) ? r.who : r.first;
    const card = (r) => {
      const msg = h('p', { class: 'fz-hint', role: 'status' });
      const at = { waiting: 1, dated: 2, asked: 3, picked: 4 }[r.stage];
      let q, why, ctl = [], quiet = null, next, extra = null;
      if (r.stage === 'waiting') {
        // Nothing for the shop to do here (Matt, Nov 8: "we don't want to create more work for these people"). The Book Approved Jobs
        // agent reads the date from the supplier's reply and order emails, and nudges the supplier after 3 days.
        const sup = (FZ.profile().supplier && (FZ.profile().supplier.name || FZ.profile().supplier)) || 'the supplier';
        q = 'Waiting on ' + (typeof sup === 'string' ? sup : 'the supplier') + ' for a date';
        why = r.late ? 'Ordered ' + fmt.plural(r.days, 'day') + ' ago. It asks the supplier by email and flags it to you only if they still do not answer.' : 'Nothing for you to do. The date is read from the supplier\'s emails as soon as they send it.';
        const d = h('input', { type: 'date', class: 'is-date', 'aria-label': 'Delivery date for ' + r.who });
        d.addEventListener('change', async () => { if (d.value && await save(r, { delivery: d.value, deliveryFrom: 'typed' })) rerender(); });
        quiet = h('label', { class: 'is-quiet' }, 'Already know the date? ', d);
        next = 'Next: once the date is in, it lines up the first free install days.';
      } else if (r.stage === 'dated') {
        const two = freeDays(r.p.delivery, 2); const note = askText(r, two);
        q = 'Ask ' + nm(r) + ' which install day works';
        why = 'Glass lands ' + nice(r.p.delivery) + (r.landed ? ', already here' : '') + '. Free days: ' + two.map(nice).join(' or ') + (S.signer ? '. ' + S.signer + ' signs for it.' : '.');
        extra = h('pre', { class: 'is-note' }, note);
        const sent = h('button', { type: 'button', class: 'fz-btn' }, 'I sent it');
        sent.addEventListener('click', async () => { sent.disabled = true; if (await save(r, { askedAt: new Date().toISOString(), offered: two })) rerender(); else sent.disabled = false; });
        ctl = [A.copyBtn('Copy the text', note), sent];
        next = 'Next: tap the day ' + nm(r) + ' picks.';
      } else if (r.stage === 'asked') {
        const offered = (r.p.offered || []).filter(Boolean);
        q = 'Which day did ' + nm(r) + ' pick?';
        why = r.noAnswer ? 'Asked ' + fmt.plural(fmt.daysSince(r.p.askedAt), 'day') + ' ago, no answer yet. Give them a call.' : 'You offered ' + offered.map(short).join(' or ') + '.';
        ctl = offered.map((day) => { const b = h('button', { type: 'button', class: 'fz-btn act' }, short(day)); b.addEventListener('click', async () => { b.disabled = true; if (await save(r, { picked: day })) rerender(); }); return b; });
        const d = h('input', { type: 'date', class: 'is-date', 'aria-label': 'Another day' });
        d.addEventListener('change', async () => { if (d.value && await save(r, { picked: d.value })) rerender(); });
        quiet = h('label', { class: 'is-quiet' }, 'A different day: ', d);
        next = 'Next: you put the visit in Jobber.';
      } else {
        q = 'Put ' + nice(r.p.picked) + ' in Jobber';
        why = nm(r) + ' picked ' + nice(r.p.picked) + '. Add the visit so the crew sees it.';
        const setBtn = h('button', { type: 'button', class: 'fz-btn' }, 'It is in Jobber');
        setBtn.addEventListener('click', async () => { setBtn.disabled = true; if (await save(r, { setAt: new Date().toISOString() })) { msg.textContent = 'Done. It drops off this list once Jobber shows the visit.'; } });
        ctl = [r.j.jobberWebUri ? ui.extLink(r.j.jobberWebUri, 'Open the job in Jobber', 'fz-btn act') : null, setBtn].filter(Boolean);
        quiet = h('span', { class: 'is-quiet' }, A.copyBtn('Copy the confirmation text', statusText(r)));
        next = 'Then it drops off this list.';
      }
      const ask = A.copyBtn('Customer asking for an update? Copy one', () => statusText(r)); ask.className = 'is-quiet';
      return h('article', { class: 'fz-card is-card' + (r.late || r.landed || r.noAnswer ? ' flag' : '') },
        h('div', { class: 'fz-card-top' }, h('span', { class: 'when' }, 'Job #' + r.j.jobNumber + (r.city ? ' · ' + r.city : '') + ' · ' + r.who), h('span', { class: 'amt' }, fmt.money(r.total))),
        h('p', { class: 'is-stp' }, 'Step ' + at + ' of 4'),
        h('h3', { class: 'is-q' }, q), h('p', { class: 'is-why' }, why), extra,
        h('div', { class: 'is-ctl' }, ...ctl), msg,
        h('p', { class: 'is-next' }, next),
        h('div', { class: 'is-foot' }, quiet, ask, r.j.jobberWebUri && r.stage !== 'picked' ? ui.extLink(r.j.jobberWebUri, 'Open in Jobber', 'is-quiet') : null));
    };
    const IS_CSS = '.is-card{display:flex;flex-direction:column;gap:10px;padding:24px 28px}.is-stp{margin:4px 0 0;font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--accent-text,var(--accent))}.is-q{margin:0;font-size:20px;font-weight:800;color:var(--head,var(--fg))}.is-why{margin:0;font-size:14px;color:var(--muted)}.is-note{white-space:pre-wrap;font:inherit;font-size:14px;line-height:1.5;margin:4px 0 0;padding:12px 14px;border:1px solid var(--line);border-radius:10px;background:var(--quiet,rgba(127,127,127,.06));color:var(--fg)}' +
      '.is-ctl{display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-top:6px}.is-ctl .fz-btn,.is-ctl .is-date{min-width:200px;min-height:46px;box-sizing:border-box;font-size:15px;font-weight:700;display:inline-flex;align-items:center;justify-content:center;border-radius:10px}.is-date{padding:0 14px;background:var(--card);color:var(--fg);border:1px solid var(--line);font-weight:500!important;color-scheme:dark}' +
      '.is-next{margin:2px 0 0;font-size:13px;color:var(--muted)}.is-foot{display:flex;gap:18px;flex-wrap:wrap;align-items:center;padding-top:12px;margin-top:4px;border-top:1px solid var(--line)}.is-quiet{all:unset;cursor:pointer;font-size:13px;color:var(--muted);text-decoration:underline;text-underline-offset:3px}.is-quiet .fz-btn{all:unset;cursor:pointer;text-decoration:underline;text-underline-offset:3px}.is-quiet:hover{color:var(--fg)}label.is-quiet{text-decoration:none;display:inline-flex;align-items:center;gap:8px}label.is-quiet .is-date{min-height:36px;min-width:0}@media(max-width:620px){.is-card{padding:20px 18px}.is-ctl .fz-btn,.is-ctl .is-date{width:100%}}';
    // Shop rules: install days, installs a day, who signs for deliveries.
    const boxes = DN.map((n, i) => { const c = h('input', { type: 'checkbox' }); c.checked = S.days.includes(i); return h('label', { class: 'sa-row' }, c, n); });
    const per = h('input', { type: 'number', min: '1', max: '10', value: String(S.perDay) });
    const signer = h('input', { type: 'text', value: S.signer, placeholder: 'Who signs for deliveries' });
    const sMsg = h('p', { class: 'fz-hint', role: 'status' });
    const sBtn = h('button', { type: 'button', class: 'fz-btn act' }, 'Save');
    sBtn.addEventListener('click', async () => {
      const next = { saved: true, days: boxes.map((b, i) => (b.querySelector('input').checked ? i : -1)).filter((i) => i >= 0), perDay: Number(per.value) || 1, signer: signer.value.trim() };
      sMsg.textContent = (await A.setDoc('settings/schedule', next)) ? 'Saved. Install days are picked with these rules.' : 'Could not save.';
    });

    // The supplier's status sheet already has the dates (Matt, Nov 8: "he knows when the glass will land because of that spreadsheet").
    // Drop a screenshot of it, or paste its rows, and every waiting job gets its date in one tap.
    const norm = (x) => String(x || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
    const matchJob = (o) => {
      const ref = norm(o.ref).replace(/\D/g, '');
      const waiting = rows.filter((r) => r.stage === 'waiting');
      const byNum = ref && waiting.find((r) => String(r.j.jobNumber) === ref);
      if (byNum) return byNum;
      const words = norm(o.customer).split(' ').filter((w) => w.length > 2);
      const scored = waiting.map((r) => ({ r, n: norm(r.who + ' ' + r.what).split(' ').filter((w) => words.includes(w)).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
      return scored.length && (scored.length === 1 || scored[0].n > scored[1].n) ? scored[0].r : null;
    };
    const sheetCard = () => {
      const msg = h('p', { class: 'fz-hint', role: 'status' });
      const list = h('div', { class: 'is-sheetlist' });
      const file = h('input', { type: 'file', accept: 'image/*', multiple: '', style: 'display:none' });
      const paste = h('textarea', { rows: '3', placeholder: 'Or paste the rows from the sheet here', class: 'is-paste' });
      const pick = h('button', { type: 'button', class: 'fz-btn act' }, 'Add a screenshot of the sheet');
      const readBtn = h('button', { type: 'button', class: 'fz-btn' }, 'Read the pasted rows');
      const run = async (files, text) => {
        msg.textContent = 'Reading the sheet…'; list.replaceChildren(); pick.disabled = readBtn.disabled = true;
        try {
          const orders = await A.readStatusSheet(files, text);
          const hits = orders.filter((o) => o.delivery).map((o) => ({ o, r: matchJob(o) })).filter((x) => x.r);
          const seen = new Set(); const uniq = hits.filter((x) => (seen.has(x.r.j.id) ? false : seen.add(x.r.j.id)));
          if (!uniq.length) { msg.textContent = orders.length ? 'Read ' + fmt.plural(orders.length, 'order') + ', but none matched a job waiting on glass with a date. Type the dates below.' : 'Could not read any orders. Try a clearer screenshot.'; return; }
          msg.textContent = 'Found dates for ' + fmt.plural(uniq.length, 'job') + '. Check them, then save.';
          const save1 = h('button', { type: 'button', class: 'fz-btn act' }, 'Save ' + (uniq.length === 1 ? 'this date' : 'all ' + uniq.length + ' dates'));
          save1.addEventListener('click', async () => { save1.disabled = true; let ok = 0; for (const x of uniq) if (await save(x.r, { delivery: x.o.delivery, deliveryFrom: 'supplier sheet' })) ok++; if (ok) rerender(); else { save1.disabled = false; msg.textContent = 'Could not save. Try again.'; } });
          list.replaceChildren(...uniq.map((x) => h('p', { class: 'is-hit' }, h('b', null, 'Job #' + x.r.j.jobNumber + ' · ' + x.r.who), ' lands ' + nice(x.o.delivery) + (x.o.status ? ' (' + x.o.status + ')' : ''))), h('div', { class: 'is-ctl' }, save1));
        } catch (e) { msg.textContent = (e && e.message) || 'Could not read the sheet.'; } finally { pick.disabled = readBtn.disabled = false; }
      };
      pick.addEventListener('click', () => file.click());
      file.addEventListener('change', () => { if (file.files.length) run(file.files, ''); });
      readBtn.addEventListener('click', () => { if (paste.value.trim()) run([], paste.value.trim()); else { msg.textContent = 'Paste the rows first.'; paste.focus(); } });
      return h('article', { class: 'fz-card is-card is-sheet' },
        h('h3', { class: 'is-q' }, 'Get the dates from the supplier sheet'),
        h('p', { class: 'is-why' }, 'Take a screenshot of the status sheet and add it here. It reads each order, matches it to your jobs and fills in when the glass lands.'),
        h('div', { class: 'is-ctl' }, pick, file), paste, h('div', { class: 'is-ctl' }, readBtn), msg, list,
        h('style', null, '.is-paste{width:100%;box-sizing:border-box;background:var(--card);color:var(--fg);border:1px solid var(--line);border-radius:10px;padding:10px 12px;font:inherit;font-size:14px}.is-hit{margin:0;font-size:15px}.is-sheetlist{display:flex;flex-direction:column;gap:6px}'));
    };

    const out = [];
    const first = rows[0];
    const QH = { waiting: ' wait on the supplier for a date. Nothing for you to do', dated: ' need the customer asked', asked: ' wait on the customer', picked: ' need the visit set in Jobber' };
    const sameStage = rows.length && rows.every((r) => r.stage === first.stage);
    out.push(ui.status(rows.length
      ? (sameStage ? [{ b: fmt.plural(rows.length, 'job') }, (rows.length === 1 ? QH[first.stage].replace('need ', 'needs ').replace('wait ', 'waits ') : QH[first.stage]) + '.'] : [{ b: fmt.plural(rows.length, 'job') }, ' to get on the schedule. Start with ' + first.who + '.'])
      : ['Every job has an install day booked.']));
    out.push(h('style', null, IS_CSS));
    // Glance: where every job is, step by step, with the step that needs the owner first.
    const STEPS = [['waiting', 'Waiting on glass', 'Asking the supplier'], ['dated', 'Glass date known', 'Ask the customer'], ['asked', 'Customer asked', 'Waiting on their pick'], ['picked', 'Day picked', 'Set it in Jobber']];
    const cnt = (k) => rows.filter((r) => r.stage === k).length;
    const hot = (k) => rows.some((r) => r.stage === k && (r.late || r.landed || r.noAnswer)) || (k === 'dated' && cnt(k)) || (k === 'picked' && cnt(k));
    if (rows.length) out.push(h('div', { class: 'viz is-flow' }, h('div', { class: 'is-steps' }, STEPS.map(([k, t, next]) => h('a', { class: 'is-step' + (cnt(k) ? '' : ' zero') + (hot(k) ? ' hot' : ''), href: '#a-install-scheduler', onclick: (e) => { e.preventDefault(); const tb = document.querySelector('#fz-board .fz-subtabs [data-id="work"]'); if (tb) tb.click(); } },
      h('b', null, String(cnt(k))), h('span', { class: 't' }, t), h('span', { class: 'nx' }, cnt(k) ? next : 'None'))))),
      h('style', null, '.is-steps{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:14px 0}@media(max-width:620px){.is-steps{grid-template-columns:1fr 1fr}}.is-step{display:flex;flex-direction:column;gap:2px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;color:var(--fg);text-decoration:none}.is-step b{font-size:26px;line-height:1.1}.is-step .t{font-weight:700;font-size:14px}.is-step .nx{font-size:12px;color:var(--muted)}.is-step.hot{border-color:var(--accent)}.is-step.hot b,.is-step.hot .nx{color:var(--accent)}.is-step.zero{opacity:.55}'));
    out.push(rows.length ? h('div', { class: 'fz-cards' }, rows.map(card)) : ui.calm('Nothing waiting on an install day.'));
    out.push(h('details', { class: 'fz-tablebox is-rules', open: S.saved ? null : '' }, h('summary', null, 'Your install rules: ' + S.days.map((d) => DN[d]).join(', ') + ', ' + S.perDay + ' a day'), h('div', { class: 'sa-form' }, h('div', { class: 'sa-row' }, ...boxes), h('label', null, 'Installs a day', per), h('label', null, 'Signs for deliveries', signer), h('div', { class: 'sa-row' }, sBtn), sMsg), h('style', null, '.is-rules{border:1px solid var(--line);border-radius:12px;padding:12px 16px;margin-top:14px}.is-rules summary{cursor:pointer;font-weight:700}')));
    if (rows.some((r) => r.stage === 'waiting')) out.push(h('details', { class: 'fz-tablebox is-rules' }, h('summary', null, 'Have a screenshot of the supplier sheet? Add it to fill dates early'), sheetCard()));
    out.push(ui.note('Customer texts are not connected, so you copy them from here. The note can also go by email from the send queue.'));
    out.push(ui.how('Every job in Jobber with no visit is glass on order. The delivery date is read from the supplier\'s reply to the order email, and the supplier gets a nudge after 3 days.',
      'It picks the first two install days after delivery, skipping days already full in Jobber, and writes the note asking the customer which works.',
      'When they pick, you set the visit in Jobber in one tap. Flags: no delivery date after ' + RULES.noDateDays + ' days, glass landed with no day, no answer after ' + RULES.noAnswerDays + ' days.'));
    return out;
  }
});
