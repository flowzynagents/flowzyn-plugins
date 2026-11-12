// Email templates (v3, Nov 8): the 13 emails the agents write from, editable in Connect, Your shop, Email templates.
// Defaults are the wording the boards used before. Edits live in settings/templates and every new draft uses them.
// Fill ins are written {like this}. The board supplies each value; a value that starts with a space or comma joins the sentence.
(function () {
  const T = [
    { id: 'enquiry-reply', group: 'run', agent: 'lead-catcher', name: 'Enquiry reply', sub: 'Answer Enquiries',
      subject: 'Your request to {business}',
      body: 'Hi {first name},\n\nThanks for reaching out to {business} about {what they asked}{at address}. The best next step is a quick visit so I can take a look. It takes about half an hour. What day this week or next works for you?\n\n{signature}' },
    { id: 'repair-reply', group: 'run', agent: 'lead-catcher', name: 'Repair reply', sub: 'Answer Enquiries',
      subject: 'Your {what they asked} request',
      body: 'Hi {first name},\n\nThanks for letting us know{about address}. Sorry something needs looking at. I can come take a look, usually within a few days. What day this week or next works for you?\n\n{signature}' },
    { id: 'follow-opened', group: 'run', agent: 'quote-chaser', name: 'Follow up, opened', sub: 'Chase Quotes',
      subject: 'Your {work} quote from {business}',
      body: 'Hi {first name}, it is {owner} at {business}. I saw you had a look at the {work} quote I sent on {sent date}. Any questions I can answer, or anything you would like changed? Happy to walk through it on the phone or at the house.\n\n{signature}' },
    { id: 'follow-unopened', group: 'run', agent: 'quote-chaser', name: 'Follow up, not opened', sub: 'Chase Quotes',
      subject: 'Your {work} quote from {business}',
      body: 'Hi {first name}, it is {owner} at {business}. Just making sure my {work} quote from {sent date} reached you. I can resend it or go over it by phone, whatever is easier.\n\n{signature}' },
    { id: 'supplier-order', group: 'run', agent: 'install-scheduler', name: 'Supplier order', sub: 'Schedule Installs',
      subject: 'Order for {customer}, {quote ref}',
      body: 'Hi {supplier},\n\nPlease confirm price and lead time on this order for {business}.\n\nJob: {customer}{in town} ({quote ref})\n\n{order lines}\n\nLet me know the earliest delivery date and I will book the job around it.\n\nThanks,\n{signature}' },
    { id: 'payment-reminder', group: 'run', agent: 'get-paid', name: 'Payment reminder', sub: 'Collect Payments',
      subject: 'Invoice #{invoice} from {business}',
      body: 'Hi {first name},\n\nHope all is well since we finished up. A quick note that invoice #{invoice} for {amount} was due {due date}. You can pay it online from the invoice email, or just reply and I can take a card over the phone.\n\nIf it is already on its way, thank you and please ignore this.\n\n{signature}' },
    { id: 'builder-intro', group: 'win', agent: 'builder-engine', name: 'Builder intro', sub: 'Reach Builders',
      subject: 'A quote for your {address}',
      body: 'Hello {builder} team,\n\nI saw the approval for your {project}{at address}. I am {owner}, owner of {business}. We work with builders around {town}.\n\nIf you have not lined up our part of that job yet, I would be glad to look at the plans and get you a number within the week.\n\n{signature}' },
    { id: 'builder-follow', group: 'win', agent: 'builder-engine', name: 'Builder follow up', sub: 'Reach Builders',
      subject: 'Following up on your new build',
      body: 'Hello {builder} team,\n\nJust following up on my email about {address}. Happy to look at plans whenever suits and get you a number within the week.\n\n{signature}' },
    { id: 'partner-intro', group: 'win', agent: 'partner-finder', name: 'Partner intro', sub: 'Find Partners · a line for each kind of partner',
      subject: 'Working together in {town}',
      body: '{greeting}\n\nI am {owner}, owner of {business} in {town}.\n\n{partner line}\n\nWould a quick coffee or call next week work?\n\n{signature}',
      lines: { label: 'The line for each kind of partner', fill: 'partner line', items: [
        ['designer', 'Designers', 'If you have clients who need work like ours, I would be glad to be the shop you send them to. We quote within the week and work to your design.'],
        ['showroom', 'Showrooms', 'When your customers need our kind of work to finish a project, I would be glad to be the shop you point them to.'],
        ['rental', 'Rental and property managers', 'When a unit needs something fixed between guests or tenants, we can usually get there fast and work around your bookings.'],
        ['other', 'Everyone else', 'If your customers ever need work like ours, I would be glad to be the shop you send them to. We quote within the week.']] } },
    { id: 'win-back', group: 'win', agent: 'lost-quote-revival', name: 'Win back offer', sub: 'Revive Quotes · a line for each season',
      subject: 'Your {work} from {business}',
      body: 'Hi {first name},\n\nIt is {owner} at {business}. Back in {month} we put together a quote for {for work} ({amount}). {season line}\n\nIf it is still on your list, I am happy to refresh the numbers or come take another look. Just reply here and we will set it up.\n\n{signature}',
      lines: { label: 'The line for each season and kind of work', fill: 'season line', items: [
        ['fall.windows', 'Fall, windows', 'With winter coming, now is a good time to get new windows in before the cold sets in.'],
        ['fall.inside', 'Fall, homeowners', 'We still have room on the calendar before the holidays if you would like it done before family visits.'],
        ['fall.builder', 'Fall, builders', 'If the project is moving again, we can get you on the schedule before the year gets busy.'],
        ['winter.windows', 'Winter, windows', 'Winter is a good time to plan windows so we can install as soon as the weather opens up.'],
        ['winter.inside', 'Winter, homeowners', 'Winter is a quieter stretch for indoor work, so we can usually get to you quickly.'],
        ['winter.builder', 'Winter, builders', 'If the project is back on for spring, I would love to get you on the calendar early.'],
        ['spring.windows', 'Spring, windows', 'Spring is a great time to get new windows in before summer.'],
        ['spring.inside', 'Spring, homeowners', 'If you want it done before summer guests arrive, now is the time.'],
        ['spring.builder', 'Spring, builders', 'Spring starts are filling up and I want to make sure we are ready for yours on time.'],
        ['summer.windows', 'Summer, windows', 'Summer is our best weather for windows and we have a few openings.'],
        ['summer.inside', 'Summer, homeowners', 'We have a few openings this summer if you would still like it done.'],
        ['summer.builder', 'Summer, builders', 'If the project picked back up, we can still fit you in this season.']] } },
    { id: 'review-homeowner', group: 'keep', agent: 'review-ask', name: 'Review ask, homeowner', sub: 'Get Reviews',
      subject: 'Thank you from {business}',
      body: 'Hi {first name},\n\nThank you for choosing {business} for the {work}. I hope you are enjoying it.\n\nIf you have a minute, a short Google review helps other folks near {town} find us. Here is the link: {review link}\n\nThanks again,\n{signature}' },
    { id: 'review-builder', group: 'keep', agent: 'review-ask', name: 'Review ask, builder', sub: 'Get Reviews · builders and managers',
      subject: 'Thank you from {business}',
      body: 'Hi {first name},\n\nThanks for bringing us in on the {work}. It was good working with your team.\n\nIf you have a minute, a short Google review from a builder or manager means a lot to a small shop like ours. Here is the link: {review link}\n\nThanks again,\n{signature}' },
    { id: 'check-in', group: 'keep', agent: 'come-back', name: 'Past customer check in', sub: 'Rebook Customers',
      subject: 'Checking in from {business}',
      body: 'Hi {first name},\n\nIt is {owner} at {business}. It has been about {months} months since we did the {work}{at address}. I hope it is all holding up well.\n\nIf there is anything else on your list, I would be glad to come take a look. Just reply and we will find a time.\n\n{signature}' }
  ];
  const BY = {}; T.forEach((t) => { BY[t.id] = t; });
  let SAVED = {};          // settings/templates: { templates: { id: { subject, body, lines, at, by } } }
  let LOADED = null;
  const dbP = () => (window.claude && window.claude.use ? window.claude.use('db') : Promise.resolve(null));
  async function load(force) {
    if (LOADED && !force) return LOADED;
    LOADED = (async () => {
      try { const db = await dbP(); if (!db) return SAVED; const s = await db.doc('settings/templates').get(); SAVED = (s && s.exists && s.data() && s.data().templates) || {}; } catch (e) { /* defaults */ }
      if (SAVED['glass-order'] && !SAVED['supplier-order']) SAVED['supplier-order'] = SAVED['glass-order'];
      // The builder intro was editable before v3 (settings/profile builderNote). Carry it over until it is saved here.
      try { const p = (window.FZ && FZ.profile && FZ.profile()) || {}; if (p.builderNote && !SAVED['builder-intro']) SAVED['builder-intro'] = { body: legacyBuilder(p.builderNote), legacy: true }; } catch (e) { /* none */ }
      return SAVED;
    })();
    return LOADED;
  }
  const legacyBuilder = (s) => String(s).replace(/\{builder\}/g, '{builder}').replace(/\{project\}\{at\}/g, '{project}{at address}').replace(/\{at\}/g, '{at address}').replace(/\{me\}/g, '{owner}');
  // The template as it stands: saved edits over the default.
  function get(id) {
    const d = BY[id]; if (!d) return null;
    const s = SAVED[id] || {};
    const lines = d.lines ? Object.assign({}, ...d.lines.items.map(([k, , v]) => ({ [k]: v })), s.lines || {}) : null;
    return { id, name: d.name, subject: s.subject != null ? s.subject : d.subject, body: s.body != null ? s.body : d.body, lines, edited: !!(s.subject != null || s.body != null || (s.lines && Object.keys(s.lines).length)), def: d };
  }
  const fillStr = (str, vars) => String(str || '').replace(/\{([^{}]+)\}/g, (m, k) => { const v = vars[k.trim()]; return v == null ? '' : String(v); })
    .replace(/[ \t]{2,}/g, ' ').replace(/ ([,.])/g, '$1').replace(/\(\s*\)/g, '').trim();
  // Fill a template for one email. vars: { 'first name': 'Cody', ... }. line: key into the template's extra lines.
  function fill(id, vars, line) {
    const t = get(id); if (!t) return { subject: '', body: '', template: id };
    const me = (window.FZ && FZ.me && FZ.me()) || {};
    const base = { business: me.business, owner: me.first, signature: me.first + ', ' + me.business, town: me.town };
    const v = Object.assign(base, vars || {});
    if (t.lines && line) v[t.def.lines.fill] = t.lines[line] || '';
    return { subject: fillStr(t.subject, v), body: fillStr(t.body, v).replace(/\n{3,}/g, '\n\n'), template: id, templateName: t.name };
  }
  async function save(id, patch) {
    const db = await dbP(); if (!db) return false;
    const cur = Object.assign({}, SAVED);
    const me = (window.FZ && FZ.me && FZ.me()) || {};
    if (patch === null) delete cur[id];
    else cur[id] = Object.assign({}, cur[id] || {}, patch, { at: new Date().toISOString(), by: me.first || null });
    delete (cur[id] || {}).legacy;
    try { await db.doc('settings/templates').set({ templates: cur, updatedAt: new Date().toISOString() }); SAVED = cur; } catch (e) { return false; }
    if (id === 'win-back') await mirrorWinBack(db, me);
    return true;
  }
  // The scheduled Revive Quotes run reads settings/template-lost-quote-revival in its own wording.
  // Each save of the win back offer writes the same words there, so the run and this page send one template.
  async function mirrorWinBack(db, me) {
    try {
      const t = get('win-back'); if (!t) return;
      const biz = me.business || 'the shop';
      const conv = (x) => String(x || '').replace(/\{first name\}/g, '{first}').replace(/\{signature\}/g, '{owner_first}, ' + biz).replace(/\{owner\}/g, '{owner_first}').replace(/\{business\}/g, biz).replace(/\{month\}/g, '{month_year}').replace(/\{for work\}/g, '{work}').replace(/\{season line\}/g, '{season_line}').replace(/\{town\}/g, me.town || '');
      const seasonLines = {};
      Object.keys(t.lines || {}).forEach((k) => { const [s, kind] = k.split('.'); (seasonLines[s] = seasonLines[s] || {})[kind] = t.lines[k]; });
      const ref = db.doc('settings/template-lost-quote-revival');
      const old = (await ref.get().catch(() => null)) || {};
      const prev = old && typeof old.data === 'function' ? old.data() : old;
      await ref.set(Object.assign({}, prev || {}, { agent: 'lost-quote-revival', subject: conv(t.subject).replace(/\{work\}/g, '{work_short}'), body: conv(t.body), seasonLines, status: 'approved', approvedBy: me.first || 'Owner', approvedAt: new Date().toISOString(), from: 'settings/templates win-back' }));
    } catch (e) { /* the sender keeps the last copy */ }
  }
  // What a board should send: the owner's own template filled in when they have edited it, otherwise the board's wording.
  function body(id, vars, line, fallback) {
    try { const t = get(id); if (t && (SAVED[id] && SAVED[id].body != null || (line && SAVED[id] && SAVED[id].lines))) { const out = fill(id, vars, line).body; if (out) return out; } } catch (e) { /* the board's wording */ }
    return fallback;
  }
  window.FZ = window.FZ || {};
  FZ.TEMPLATES = T;
  FZ.tpl = { list: T, get, fill, body, save, load, reset: (id) => save(id, null), loaded: () => !!LOADED };
  load();
})();
