// To do: one ranked list of what the agents need a person to do, with step by step help in Jobber.
(function () {
  // Kept across re-renders (each save repaints the Tasks page): which agent groups are open, and a bulk approve in progress.
  const OPEN_G = new Set();
  let BULK = null;
  // Builds the task list from Jobber. Returns every task, open or done.
  FZ.buildTasks = async function (ctx) {
    const { ui, fmt } = ctx;
    const { h } = ui;
    const client = (t) => fmt.clean(String(t || '').split(' - ')[0]);

    const [awaiting, approved, needInvoice, pastDue, requestsNew, upcoming, fc] = await Promise.all([
      ctx.jobberAll('search_quotes', { status: 'awaiting_response', limit: 100 }, 'quotes', 200),
      ctx.jobberAll('search_quotes', { status: 'approved', limit: 100 }, 'quotes', 100),
      ctx.jobberAll('search_jobs', { status: 'requires_invoicing', limit: 50 }, 'jobs', 100),
      ctx.jobberAll('search_invoices', { status: 'past_due', limit: 50 }, 'invoices', 100),
      ctx.jobberAll('search_requests', { status: 'new', sort: 'oldestCreatedAt', limit: 50 }, 'requests', 100),
      ctx.jobberAll('search_visits', { status: 'upcoming', sort: 'startAt', limit: 50 }, 'visits', 100).catch(() => []),
      ctx.store('datasets/forecast').catch(() => null)
    ]);

    const tasks = [];
    const add = (t) => tasks.push(t);
    // A company gets "Call them", a person gets their first name.
    const callBtn = (name) => /\b(inc|llc|ltd|co|corp|company|construction|homes|builders|group|properties|design|services)\b\.?/i.test(name) ? 'Call them' : 'Call ' + fmt.firstName(name);

    // Quotes past Jobber's reminders.
    awaiting.filter((q) => q.sentAt && fmt.daysSince(q.sentAt) > 5).forEach((q) => {
      const name = fmt.clean(q.client && q.client.name);
      const big = Number(q.total) >= 5000;
      add({
        id: 'quote-' + q.id, agent: 'quote-chaser', kind: big ? 'Call' : 'Follow up', ready: big ? 'Call steps ready, plus a backup email' : 'Email ready', review: 'Follow up with ' + name + ' on quote #' + q.quoteNumber, approve: big ? callBtn(name) : 'Approve and send', dollars: Number(q.total) || 0, score: Number(q.total) * (q.clientHubViewedAt ? 1.5 : 1),
        title: (big ? 'Call ' : 'Follow up with ') + name + ' about quote #' + q.quoteNumber,
        meta: fmt.money(q.total) + ' · sent ' + fmt.plural(fmt.daysSince(q.sentAt), 'day') + ' ago · ' + (q.clientHubViewedAt ? 'they opened it' : 'not opened yet'),
        link: q.jobberWebUri, linkLabel: 'Open quote in Jobber',
        steps: big
          ? ['Open the quote in Jobber and note the client’s phone number.', 'Call ' + fmt.firstName(name) + '. Ask if they have questions and when they would like to start.', 'If they say yes, press Approve on the quote, or ask them to approve it in their client hub.', 'Then press Called here.']
          : ['Open the quote in Jobber.', 'Copy the note below into an email to ' + fmt.firstName(name) + ', or press Resend in Jobber and paste it as the message.', 'Come back and press Done.'],
        draft: 'Hi ' + fmt.firstName(name) + ',\n\nJust checking in on the quote for ' + fmt.clean(q.title || 'your glass') + '. Happy to answer any questions or adjust anything. If it looks good, I can get you on the schedule.\n\n' + FZ.sign()
      });
    });

    // Approved, not yet a job.
    approved.forEach((q) => {
      const name = fmt.clean(q.client && q.client.name);
      add({
        id: 'approved-' + q.id, agent: 'yes-to-install', kind: 'Book it', ready: 'Booking ready', review: 'Book ' + name + '’s approved job', approve: 'Booked in Jobber', dollars: Number(q.total) || 0, score: Number(q.total) * 2,
        title: 'Turn ' + name + '’s approved quote into a job',
        meta: fmt.money(q.total) + ' · approved ' + (q.approvedAt ? fmt.fmtDate(q.approvedAt) : ''),
        link: q.jobberWebUri, linkLabel: 'Open quote in Jobber',
        steps: ['Open the quote in Jobber.', 'Press Convert to Job.', 'On the new job, schedule the first visit and assign the crew.', 'Order the glass if it is not in stock (Book Jobs has the order email).', 'Come back and press Done.']
      });
    });

    // Finished, not invoiced.
    needInvoice.forEach((j) => {
      const name = fmt.clean(j.client && j.client.name);
      add({
        id: 'invoice-' + j.id, agent: 'bill-it', kind: 'Invoice', ready: 'Ready to invoice', review: 'Invoice ' + name + ' for job #' + j.jobNumber, approve: 'Invoiced in Jobber', dollars: Number(j.total) || 0, score: Number(j.total) * 2.5,
        title: 'Send the invoice for ' + name + '’s job #' + j.jobNumber,
        meta: fmt.money(j.total) + ' · finished ' + (j.completedAt ? fmt.fmtDate(j.completedAt) : ''),
        link: j.jobberWebUri, linkLabel: 'Open job in Jobber',
        steps: ['Open the job in Jobber.', 'Check the line items match what was installed.', 'Press Close Job, then Generate Invoice (or Create Invoice).', 'Press Send to email it to ' + fmt.firstName(name) + '.', 'Come back and press Done.']
      });
    });

    // Overdue invoices.
    pastDue.forEach((v) => {
      const name = fmt.clean(v.client && v.client.name);
      const late = Math.max(0, fmt.daysSince(v.dueDate) || 0);
      const big = Number(v.balance) >= 5000;
      add({
        id: 'overdue-' + v.id, agent: 'get-paid', kind: big ? 'Call' : 'Nudge', ready: big ? 'Call steps ready, plus a backup email' : 'Email ready', review: 'Payment reminder to ' + name + ' for invoice #' + v.invoiceNumber, approve: big ? callBtn(name) : 'Approve and send', dollars: Number(v.balance) || 0, score: Number(v.balance) * (1 + late / 30),
        title: (big ? 'Call ' : 'Send a payment reminder to ') + name + ' for invoice #' + v.invoiceNumber,
        meta: fmt.money(v.balance) + ' · ' + fmt.plural(late, 'day') + ' overdue',
        link: v.jobberWebUri, linkLabel: 'Open invoice in Jobber',
        steps: big
          ? ['Open the invoice in Jobber and check nothing was paid in QuickBooks.', 'Call ' + fmt.firstName(name) + ' and agree a payment date.', 'Add a note on the invoice with what they said.', 'Then press Called here.']
          : ['Open the invoice in Jobber and check nothing was paid in QuickBooks.', 'Press Resend and paste the note below as the message.', 'Come back and press Done.'],
        draft: 'Hi ' + fmt.firstName(name) + ',\n\nA quick reminder that invoice #' + v.invoiceNumber + ' for ' + fmt.money(v.balance) + ' is now past due. You can pay from the link in the invoice. Let me know if anything needs sorting out.\n\nThanks,\n' + FZ.sign()
      });
    });

    // New enquiries.
    requestsNew.forEach((r) => {
      const name = fmt.clean(r.client && r.client.name);
      const wait = fmt.daysSince(r.createdAt) || 0;
      add({
        id: 'request-' + r.id, agent: 'lead-catcher', kind: 'Reply', ready: 'Reply ready', review: 'Reply to ' + name + ' and offer a visit', approve: 'Approve and send', score: 3000 + wait * 500,
        title: 'Reply to ' + name + ' and book a visit',
        meta: fmt.clean(r.title) + ' · waiting ' + fmt.plural(wait, 'day'),
        link: r.jobberWebUri, linkLabel: 'Open request in Jobber',
        steps: ['Open the request in Jobber.', 'Email or call ' + fmt.firstName(name) + (r.client && r.client.phone ? ' (' + r.client.phone + ')' : '') + ' and offer two times to measure.', 'Press Schedule Assessment and pick the time they choose.', 'Come back and press Done.'],
        draft: 'Hi ' + fmt.firstName(name) + ',\n\nThanks for reaching out to ' + FZ.biz() + '. I would be glad to come and measure. Would one of these times work for you: [day and time] or [day and time]?\n\n' + FZ.sign()
      });
    });

    // Weather on booked jobs.
    const periods = (fc && fc.periods) || [];
    upcoming.forEach((v) => {
      const date = fmt.dayKey(v.startAt);
      const home = (fc && fc.home) || (periods[0] && periods[0].area) || '';
      const p = periods.find((x) => x.area === home && String(x.daytime) === 'true' && x.date === date);
      if (!p) return;
      const risk = String(p.snow) === 'true' ? 'Snow' : Number(p.wind_mph) >= 25 ? 'High wind' : Number(p.temp_f) < 20 ? 'Deep cold' : null;
      if (!risk) return;
      add({
        id: 'weather-' + v.id + '-' + date, agent: 'weather-watch', kind: 'Check', ready: 'Heads up ready', review: 'Warn ' + client(v.title) + ' about ' + risk.toLowerCase() + ' on ' + fmt.fmtDay(v.startAt), approve: 'Approve and send', score: 6000,
        title: 'Check ' + client(v.title) + '’s install on ' + fmt.fmtDay(v.startAt),
        meta: risk + ' forecast',
        link: v.job && v.job.jobberWebUri, linkLabel: 'Open job in Jobber',
        steps: ['Decide with the crew whether the install can go ahead.', 'If not, open the job in Jobber, open the visit and drag it to a better day.', 'Let ' + fmt.firstName(client(v.title)) + ' know (the note below works for either).', 'Come back and press Done.'],
        draft: 'Hi ' + fmt.firstName(client(v.title)) + ', it is ' + FZ.me().first + ' at ' + FZ.biz() + '. The forecast for ' + fmt.fmtDay(v.startAt) + ' shows ' + risk.toLowerCase() + '. We can keep your install as planned or move it to a better day. What works for you?'
      });
    });

    // Measured jobs waiting for a quote: Quote Jobs has the draft ready.
    const measured = await ctx.jobberAll('search_requests', { status: 'assessment_completed', sort: 'oldestCreatedAt', limit: 50 }, 'requests', 100).catch(() => []);
    measured.forEach((r) => {
      const name = fmt.clean(r.client && r.client.name) || 'Customer';
      const days = fmt.daysSince(r.updatedAt || r.createdAt) || 0;
      const a = r.property && r.property.address;
      add({ id: 'measure-' + r.id, agent: 'quotes', kind: 'Quote', ready: 'Quote to check', go: '#a-quotes', approve: 'Check the quote', score: 4000 + days * 400,
        title: 'Quote ' + name + '\u2019s measure', review: 'Quote ' + name + '\u2019s measure',
        meta: [a && fmt.clean([a.street1, a.city].filter(Boolean).join(', ')), 'measured ' + (days ? fmt.plural(days, 'day') + ' ago' : 'today')].filter(Boolean).join(' \u00b7 '),
        link: r.jobberWebUri, linkLabel: 'Open request in Jobber' });
    });

    // Installs: the next step for each job waiting on glass, from Schedule Installs.
    const waitJobs = (await ctx.jobberAll('search_jobs', { status: 'unscheduled', limit: 50 }, 'jobs', 100).catch(() => [])).filter((j) => !j.startAt);
    const P = {};
    if (FZ.act) await ctx.pool(waitJobs, 6, async (j) => { P[j.id] = (await FZ.act.getDoc('pipeline/' + j.id.replace(/[^A-Za-z0-9]/g, ''))) || {}; });
    const dayName = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    waitJobs.forEach((j) => {
      const p = P[j.id] || {}; if (p.skip) return;
      const name = fmt.clean(j.client && j.client.name) || 'Customer';
      const base = { agent: 'install-scheduler', kind: 'Install', go: '#a-install-scheduler', link: j.jobberWebUri, linkLabel: 'Open job in Jobber', dollars: Number(j.total) || 0 };
      const since = fmt.daysSince(j.createdAt) || 0;
      if (p.picked) add(Object.assign(base, { id: 'inst-set-' + j.id + '-' + p.picked, ready: 'Day picked', approve: 'Set it in Jobber', score: 6500, title: 'Set ' + name + '\u2019s install for ' + dayName(p.picked), review: 'Set ' + name + '\u2019s install for ' + dayName(p.picked), meta: 'Job #' + j.jobNumber + ' \u00b7 the customer picked the day' }));
      else if (p.askedAt) { if ((fmt.daysSince(p.askedAt) || 0) > 2) add(Object.assign(base, { id: 'inst-ans-' + j.id, ready: 'No answer yet', approve: 'See the job', score: 4500, title: name + ' has not picked an install day', review: name + ' has not picked an install day', meta: 'Asked ' + fmt.plural(fmt.daysSince(p.askedAt), 'day') + ' ago' })); }
      else if (p.delivery) add(Object.assign(base, { id: 'inst-ask-' + j.id, ready: 'Note ready', approve: 'Ask the customer', score: 5500, title: 'Ask ' + name + ' which install day', review: 'Ask ' + name + ' which install day', meta: 'Glass lands ' + dayName(p.delivery) }));
      else if (since > 5) add(Object.assign(base, { id: 'inst-date-' + j.id, ready: 'Needs a date', approve: 'Add the delivery date', score: 3000 + Math.min(since, 30) * 50, title: 'Add the delivery date for ' + name + '\u2019s glass', review: 'Add the delivery date for ' + name + '\u2019s glass', meta: 'Job #' + j.jobNumber + ' \u00b7 no delivery date yet' }));
    });

    // Exceptions an agent handed over.
    FZ.openExc().forEach((x) => add({ id: 'exc-' + x.id, agent: x.agent, kind: 'Exception', score: 9000, title: x.title || 'Needs a look', meta: x.detail || '', link: x.link, linkLabel: 'Open', steps: ['Look at what the agent flagged and decide what to do.', 'Mark it done on the Tasks tab when sorted.'] }));

    return tasks;
  };

  // The bell panel: one row per task, linking straight to the record in Jobber.
  FZ.renderTaskPanel = function (ctx, tasks, doneMap, save) {
    const { ui, fmt } = ctx;
    const { h } = ui;
    const open = tasks.filter((t) => !(doneMap[t.id] && doneMap[t.id].done) && !(FZ.auto && FZ.auto.skips(t))).sort((a, b) => b.score - a.score);
    const doneToday = Object.values(doneMap).filter((d) => d && d.done && d.at && fmt.dayKey(d.at) === fmt.dayKey(new Date().toISOString())).length;
    const owner = !FZ.isOperator();
    const row = (t) => {
      const a = FZ.byKey(t.agent) || { name: 'Agent' };
      if (owner && t.approve) return reviewRow(t, a);
      const check = h('button', { type: 'button', class: 'fz-btn tp-done', 'aria-label': 'Mark done: ' + t.title }, 'Mark done');
      // Hand it over: off the owner's list, into the Operator's queue.
      const hand = t.kind === 'Exception' ? null : FZ.opButton({ id: t.id, title: t.title, meta: t.meta, link: t.link, agent: t.agent, draft: t.draft, onSent: () => { item.classList.add('is-done'); check.hidden = true; } });
      const copyBtn = t.draft ? h('button', { type: 'button', class: 'fz-btn act tp-copy' }, 'Copy email') : null;
      if (copyBtn) copyBtn.addEventListener('click', () => {
        try { navigator.clipboard.writeText(t.draft).then(() => { copyBtn.textContent = 'Copied'; setTimeout(() => { copyBtn.textContent = 'Copy email'; }, 1500); }, () => { copyBtn.textContent = 'Copy blocked, select the text'; }); } catch (_) { copyBtn.textContent = 'Copy blocked, select the text'; }
      });
      const more = (t.steps && t.steps.length) || t.draft ? h('details', { class: 'tp-more' },
        h('summary', null, t.draft ? 'See the email and steps' : 'See the steps'),
        h('div', { class: 'tp-more-body' },
          t.steps && t.steps.length ? h('ol', { class: 'tp-steps' }, t.steps.map((x) => h('li', null, x))) : null,
          t.draft ? h('div', { class: 'tp-note' },
            h('div', { class: 'tp-note-head' }, h('span', null, 'Email ready to send'), copyBtn),
            h('p', { class: 'tp-note-text' }, t.draft)) : null)) : null;
      const item = h('div', { class: 'tp-row' },
        h(t.link ? 'a' : 'span', { class: 'tp-main', href: t.link || null, target: t.link ? '_blank' : null, rel: t.link ? 'noopener' : null },
          h('span', { class: 'tp-top' }, h('span', { class: 'td-kind' }, t.kind), h('span', { class: 'td-agent' }, a.name)),
          h('span', { class: 'tp-title' }, t.title),
          t.meta ? h('span', { class: 'td-meta' }, t.meta) : null),
        h('span', { class: 'tp-act' },
          t.link ? ui.extLink(t.link, t.linkLabel ? t.linkLabel.replace(' in Jobber', '') : 'Open', 'fz-btn tp-open') : null,
          check, hand),
        more);
      check.addEventListener('click', async () => {
        check.disabled = true;
        if (await save(t.id, true)) { item.classList.add('is-done'); check.textContent = 'Done'; } else check.disabled = false;
      });
      return item;
    };
    // Owner view: the agents prepared it, the owner reviews and approves. The agents and the Operator carry it out.
    // One plain word for what kind of thing it is (Matt, Nov 10: no "Call steps ready" pills).
    const KIND = { Call: 'Call', 'Follow up': 'Email', Nudge: 'Email', Reply: 'Email', Check: 'Heads up', 'Book it': 'Booking', Quote: 'Quote', Install: 'Install' };
    const kindOf = (t) => KIND[t.kind] || (t.draft ? 'Email' : 'To do');
    const moneyOf = (t) => { const v = Number(t.dollars || t.amount) || 0; return v ? fmt.money(v) : null; };
    const metaRest = (t) => String(t.meta || '').replace(/^\$[\d,]+\s*·\s*/, '');
    const cardHead = (t, a) => [
      h('p', { class: 'tc-top' }, h('span', { class: 'tc-kind' }, kindOf(t)), h('span', { class: 'tc-agent' }, a.name)),
      h('p', { class: 'tc-title' }, t.review || t.title),
      (moneyOf(t) || metaRest(t)) ? h('p', { class: 'tc-meta' }, moneyOf(t) ? h('b', null, moneyOf(t)) : null, moneyOf(t) && metaRest(t) ? ' · ' : '', metaRest(t)) : null];
    // Owner view: the agents prepared it, the owner reviews and approves. The agents and the Operator carry it out.
    function reviewRow(t, a) {
      // A step that happens on an agent's page: one button that opens it there.
      if (t.go) {
        const later = h('button', { type: 'button', class: 'tp-quiet' }, 'Already handled');
        const row = h('div', { class: 'tp-row tc' },
          h('div', { class: 'tc-main' }, ...cardHead(t, a)),
          h('div', { class: 'tc-act' }, h('a', { class: 'fz-btn act', href: t.go }, t.approve || 'Open'), h('span', { class: 'tc-quiet' }, later)));
        later.addEventListener('click', async () => { later.disabled = true; if (await save(t.id, true)) { row.classList.add('is-done'); later.textContent = 'Off your list'; } else later.disabled = false; });
        return row;
      }
      const skip = h('button', { type: 'button', class: 'tp-quiet' }, 'Already handled');
      const isCall = t.kind === 'Call';
      const readLabel = isCall ? 'Email instead' : 'Read the email';
      // With an email: the button opens it in place, editable, and Approve and send sits under it. Nothing goes out unread.
      const ok = h('button', { type: 'button', class: 'fz-btn' + (isCall ? '' : ' act') }, t.draft ? readLabel : t.approve);
      // A call task: the steps show, Called clears it, Email instead opens the backup email.
      const called = isCall ? h('button', { type: 'button', class: 'fz-btn act' }, 'Called') : null;
      const handOff = FZ.opButton({ id: t.id, title: t.review || t.title, meta: t.meta, link: t.link, agent: t.agent, draft: t.draft, onSent: () => { item.classList.add('is-done'); ok.hidden = true; skip.hidden = true; slot.hidden = true; if (called) called.hidden = true; } });
      if (handOff && handOff.classList) handOff.classList.add('tc-op');
      const slot = h('div', { class: 'tc-mail', hidden: '' });
      const steps = isCall && t.steps && t.steps.length ? h('ol', { class: 'tc-steps' }, t.steps.map((x) => h('li', null, x))) : null;
      const item = h('div', { class: 'tp-row tc' + (isCall ? ' tc-call' : '') },
        h('div', { class: 'tc-main' }, ...cardHead(t, a), steps),
        h('div', { class: 'tc-act' }, called, ok, t.link ? ui.extLink(t.link, 'Open in Jobber', 'fz-btn q') : null, h('span', { class: 'tc-quiet' }, handOff, skip)),
        t.draft ? slot : null);
      if (called) called.addEventListener('click', async () => { called.disabled = true; if (await save(t.id, true)) { item.classList.add('is-done'); called.textContent = 'Called \u2713'; ok.hidden = true; skip.hidden = true; slot.hidden = true; } else called.disabled = false; });
      // Opened from Overview: scroll to it, and open the email when asked for it.
      { const want = FZ.wantOpen ? FZ.wantOpen(t.id) : null; if (want) setTimeout(() => { item.scrollIntoView({ block: 'center' }); item.classList.add('tp-flash'); if (want === 'email' && t.draft) ok.click(); }, 400); }
      const approveWith = async (text) => save(t.id, true, Object.assign({}, t, { title: 'Approved: ' + (t.review || t.title), approved: true }, text != null ? { draft: text } : {}));
      const markSkip = async (btn, label) => { btn.disabled = true; if (await save(t.id, true)) { item.classList.add('is-done'); skip.textContent = label; skip.disabled = true; ok.hidden = true; slot.hidden = true; } else btn.disabled = false; };
      if (t.draft) {
        let built = false;
        const build = () => {
          const ta = h('textarea', { 'aria-label': 'Email for ' + (t.review || t.title) }); ta.value = t.draft;
          const send = h('button', { type: 'button', class: 'fz-btn act' }, 'Approve and send');
          const no = h('button', { type: 'button', class: 'fz-btn ghost' }, 'Not this one');
          const msg = h('span', { class: 'rv-note', role: 'status' }, 'Edit anything first. It goes out from your own email.');
          const x = h('button', { type: 'button', class: 'tc-x', 'aria-label': 'Close the email' }, 'Close');
          x.addEventListener('click', () => ok.click());
          slot.replaceChildren(h('div', { class: 'tc-mail-h' }, h('b', null, 'Email to send'), x), ta, h('div', { class: 'rv-b' }, send, no, msg));
          send.addEventListener('click', async () => {
            send.disabled = true; no.disabled = true; msg.textContent = 'Approving\u2026';
            if (await approveWith(ta.value)) { item.classList.add('is-done'); slot.replaceChildren(h('p', { class: 'rv-ok' }, 'Approved. It goes out on the next run.')); ok.textContent = 'Approved'; ok.disabled = true; skip.hidden = true; }
            else { send.disabled = false; no.disabled = false; msg.textContent = 'Could not save here. Try again, or hand it to your Operator.'; }
          });
          no.addEventListener('click', () => markSkip(no, 'Skipped, nothing sent'));
          built = true;
        };
        ok.setAttribute('aria-expanded', 'false');
        ok.addEventListener('click', () => {
          if (!built) build();
          const opening = slot.hidden; slot.hidden = !opening;
          ok.setAttribute('aria-expanded', String(opening)); ok.textContent = opening ? 'Hide email' : readLabel;
          if (opening) { const ta = slot.querySelector('textarea'); if (ta) ta.focus(); }
        });
      } else {
        // No email to read (a booking): approve straight from the row, and in bulk.
        item._approve = async () => {
          if (item.classList.contains('is-done')) return true;
          ok.disabled = true; skip.disabled = true;
          if (await approveWith(null)) { item.classList.add('is-done'); ok.textContent = 'Approved'; skip.hidden = true; return true; }
          ok.disabled = false; skip.disabled = false; return false;
        };
        ok.addEventListener('click', item._approve);
      }
      skip.addEventListener('click', () => markSkip(skip, 'Marked as handled'));
      return item;
    }
    // Owner: the 5 biggest one by one, everything else grouped by agent with one approve for the lot.
    function ownerList() {
      const TOP = 5;
      const top = open.slice(0, TOP), rest = open.slice(TOP);
      const groups = [];
      rest.forEach((t) => { let g = groups.find((x) => x.agent === t.agent); if (!g) groups.push(g = { agent: t.agent, list: [] }); g.list.push(t); });
      groups.forEach((g) => { g.dollars = g.list.reduce((n, t) => n + (Number(t.dollars) || 0), 0); });
      groups.sort((a, b) => (b.dollars - a.dollars) || (b.list.length - a.list.length));
      const NOUN = { 'quote-chaser': ['follow up', 'follow ups'], 'get-paid': ['reminder', 'reminders'], 'bill-it': ['invoice', 'invoices'], 'yes-to-install': ['booking', 'bookings'], 'lead-catcher': ['reply', 'replies'], 'weather-watch': ['heads up', 'heads ups'] };
      const out = top.map(row);
      // The rest as a row of stat tiles, like HQ (Matt, Nov 7). Tap a tile to see and approve that agent's items.
      if (groups.length) {
        const tiles = h('div', { class: 'tg-tiles' });
        const shelf = h('div', { class: 'tg-shelf' });
        const paintOpen = () => tiles.querySelectorAll('.tg-tile').forEach((x) => x.setAttribute('aria-pressed', String(OPEN_G.has(x.dataset.tg))));
        groups.forEach((g) => {
          const a = FZ.byKey(g.agent) || { name: 'Agent' };
          const noun = NOUN[g.agent] || ['task', 'tasks'];
          const items = g.list.map(row);
          const can = items.filter((it) => it._approve);
          const busy = BULK && BULK.agent === g.agent;
          const all = can.length ? h('button', { type: 'button', class: 'fz-btn act tg-all', 'data-tg': g.agent, disabled: busy || null }, busy ? 'Approving ' + BULK.i + ' of ' + BULK.n : can.length === 1 ? 'Approve it' : 'Approve all ' + can.length) : null;
          if (all && !busy) all.addEventListener('click', async () => {
            if (BULK) return;
            all.disabled = true; let ok = 0;
            BULK = { agent: g.agent, i: 0, n: can.length };
            const show = (t) => { all.textContent = t; const live = document.querySelector('.tg-all[data-tg="' + g.agent + '"]'); if (live) { live.textContent = t; live.disabled = true; } };
            try { for (let i = 0; i < can.length; i++) { BULK.i = i + 1; show('Approving ' + (i + 1) + ' of ' + can.length); if (await can[i]._approve()) ok++; } }
            finally { BULK = null; }
            if (ok < can.length) { const live = document.querySelector('.tg-all[data-tg="' + g.agent + '"]') || all; live.disabled = false; live.textContent = 'Approve the rest'; }
          });
          const sub = h('div', { class: 'tg-sub', 'data-tg': g.agent, hidden: !OPEN_G.has(g.agent) }, all ? h('div', { class: 'tg-bulk' }, all) : null, items);
          shelf.append(sub);
          const tile = h('button', { type: 'button', class: 'tg-tile', 'data-tg': g.agent, 'aria-pressed': String(OPEN_G.has(g.agent)) },
            h('span', { class: 'tg-n' }, String(g.list.length)),
            h('span', { class: 'tg-k' }, a.name),
            h('span', { class: 'tg-v' }, (g.list.length === 1 ? noun[0] : noun[1]) + (g.dollars ? ' · ' + fmt.money(g.dollars, { short: true }) : '')));
          tile.addEventListener('click', () => { const open = !OPEN_G.has(g.agent); OPEN_G.clear(); if (open) OPEN_G.add(g.agent); shelf.querySelectorAll('.tg-sub').forEach((x) => { x.hidden = !OPEN_G.has(x.dataset.tg); }); paintOpen(); });
          tiles.append(tile);
        });
        out.push(h('p', { class: 'tg-lead' }, 'The rest, by agent'), tiles, shelf);
        out.push(h('style', null, '.tg-tiles{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin:6px 0 10px}.tg-tile{all:unset;box-sizing:border-box;cursor:pointer;display:flex;flex-direction:column;gap:2px;padding:14px 16px;border:1px solid var(--line);border-radius:12px;background:var(--card)}.tg-tile:hover,.tg-tile:focus-visible{border-color:var(--accent)}.tg-tile[aria-pressed=true]{border-color:var(--accent)}.tg-n{font:800 28px/1.1 var(--font,inherit);color:var(--fg)}.tg-k{font-weight:700;font-size:14px;color:var(--fg)}.tg-v{font-size:13px;color:var(--muted)}.tg-bulk{display:flex;justify-content:flex-end;margin:4px 0 6px}'));
      }
      out.push(h('style', null, TG_CSS));
      return out;
    }
    return [
      h('div', { class: 'tp-head' },
        h('h2', null, open.length ? fmt.plural(open.length, 'thing') + ' to do' : 'All caught up'),
        h('p', null, open.length ? 'Biggest dollars first. Tap one to open it in Jobber.' + (doneToday ? ' ' + doneToday + ' done today.' : '') : 'The agents will add tasks here as they run.')),
      open.length ? h('div', { class: 'tp-list' }, owner ? ownerList() : open.slice(0, 40).map(row)) : null,
      null
    ];
  };
  const TG_CSS = '.tg-lead{margin:18px 0 0;padding-top:14px;border-top:1px solid var(--line);font-size:13px;font-weight:700;color:var(--muted)}' +
    '.tg-lead + .tg .tg-row{border-top:0}.tg-row .tp-title{font-size:16px}' +
    '.tg-sub{padding-left:16px;border-left:2px solid var(--line);margin-bottom:8px}.tg-sub[hidden]{display:none}' +
    '.tg-row.is-done .tp-title{text-decoration:none}' +
    '@media (max-width:620px){.tg-row{grid-template-columns:minmax(0,1fr)}.tg-row .tp-act{justify-content:flex-start}.tg-sub{padding-left:10px}}';

  // ---------- Operator board: the one place for every manual task ----------
  // Exceptions agents raised, tasks the owner handed over and tasks the Operator adds, on one board.
  // The task lives in exceptions/<id> (open, claimed, waiting, handled). Time lives on tasks/exc-<id>:
  // { entries: [{min, at, note}], totalMin, runningSince, done, doneNote }.
  let ADD_OPEN = false;
  let STAGE = 'all'; // stage filter on the Operator desk, kept across repaints
  const FORM = {}; // which card has its time, done or email form open, kept across repaints
  const hm = (m) => { m = Math.round(Number(m) || 0); if (m < 60) return m + ' min'; const r = m % 60; return Math.floor(m / 60) + 'h' + (r ? ' ' + r + 'm' : ''); };
  const since = (iso) => { const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000)); return m < 1 ? 'just now' : m < 60 ? m + ' min ago' : m < 1440 ? Math.round(m / 60) + 'h ago' : Math.round(m / 1440) === 1 ? 'yesterday' : Math.round(m / 1440) + ' days ago'; };
  const ownerFirst = () => { const f = FZ.me().first; return f && f !== '[your name]' ? f : 'the owner'; };
  const senderOf = (x) => { const m = /(?:Handed over|Approved) by ([^·]+)/.exec(String(x.detail || '')); return (m && m[1].trim()) || ownerFirst(); };
  const cleanDetail = (x) => String(x.detail || '').split(' · ').filter((p) => p && p !== 'x' && !/^(Handed over|Approved) by /.test(p)).join(' · ');
  const agentName = (k) => { const a = k && FZ.byKey(k); return a ? a.name.replace(/ Agent$/, '') : ''; };
  const minutesOn = (t) => (t.entries || []).reduce((n, e) => n + (Number(e.min) || 0), 0);
  const minOf = (x) => Number(x.time.totalMin) || minutesOn(x.time);
  const colOf = (x) => x.status === 'handled' ? 'done' : x.status === 'waiting' ? 'waiting' : (x.status === 'claimed' || x.time.runningSince) ? 'doing' : 'new';
  // The source link, labelled by what it is.
  const linkLabel = (u) => {
    const s = String(u || '');
    if (/getjobber\.com/.test(s)) { const k = /\/(quotes|invoices|jobs|requests|clients|visits)\//.exec(s); return k ? 'Open ' + ({ quotes: 'quote', invoices: 'invoice', jobs: 'job', requests: 'request', clients: 'client', visits: 'visit' })[k[1]] + ' in Jobber' : 'Open in Jobber'; }
    let host = ''; try { host = new URL(s).hostname.replace(/^www\./, ''); } catch (e) { return 'Open the source'; }
    const known = { 'yelp.com': 'the Yelp page', 'google.com': 'the Google listing', 'maps.google.com': 'the Google listing', 'business.google.com': 'the Google listing', 'facebook.com': 'the Facebook page', 'nextdoor.com': 'the Nextdoor page', 'houzz.com': 'the Houzz page', 'angi.com': 'the Angi page', 'bbb.org': 'the BBB page', 'quickbooks.intuit.com': 'QuickBooks', 'app.qbo.intuit.com': 'QuickBooks' };
    const k = Object.keys(known).find((d) => host === d || host.endsWith('.' + d));
    return 'Open ' + (k ? known[k] : host);
  };
  const runText = (iso) => { const m = (Date.now() - new Date(iso).getTime()) / 60000; return m < 1 ? 'Timer on, just started' : 'Timer on, ' + hm(m); };
  let TICK = null;
  const tick = () => document.querySelectorAll('[data-since]').forEach((n) => { n.textContent = runText(n.dataset.since); });
  // Monday of this week in shop time, as a day key, and the 7 day keys from it.
  const weekDays = (fmt) => {
    const key = fmt.dayKey(new Date().toISOString());
    const d = new Date(key + 'T12:00:00Z'); const back = (d.getUTCDay() + 6) % 7;
    return Array.from({ length: 7 }, (_, i) => new Date(d.getTime() + (i - back) * 86400000).toISOString().slice(0, 10));
  };
  const scrub = (s) => String(s || '').replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '').replace(/(\+?1[\s.]?)?\(?\d{3}\)?[\s.]?\d{3}[\s.]?\d{4}\b/g, '').replace(/\s{2,}/g, ' ').replace(/\s+([,.])/g, '$1').trim();

  // Read then approve, the same way as the kit's Needs you rows: the email opens in place, editable.
  const readApprove = (h, x, api, onDone) => {
    const slot = h('div', { class: 'ag-rv tp-rv' });
    const ta = h('textarea', { 'aria-label': 'Email for ' + (x.title || 'this task') }); ta.value = x.draft;
    const send = h('button', { type: 'button', class: 'fz-btn act' }, 'Approve and send');
    const no = h('button', { type: 'button', class: 'fz-btn ghost' }, 'Not this one');
    const msg = h('span', { class: 'rv-note', role: 'status' }, 'Edit anything first. It goes out from ' + ownerFirst() + '’s email.');
    slot.append(h('p', { class: 'rv-h' }, h('b', null, x.title || 'Email')), ta, h('div', { class: 'rv-b' }, send, no, msg));
    send.addEventListener('click', async () => { send.disabled = no.disabled = true; msg.textContent = 'Approving…'; if (await api.approve(x, ta.value)) onDone(); else { send.disabled = no.disabled = false; msg.textContent = 'Could not save here. Try again.'; } });
    no.addEventListener('click', () => { FORM[x.id] = null; onDone(); });
    return slot;
  };

  const DK_CSS = '#fz-operator .fz-status{margin-bottom:0}' +
    '.dk-board{margin:24px 0 32px;display:flex;flex-direction:column;gap:14px}' +
    '.dk-stages{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));background:var(--card);border:1px solid var(--edge);border-radius:12px;overflow:hidden}' +
    '.dk-stage{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:14px 20px;background:none;border:0;border-left:1px solid var(--line);color:var(--fg);font:inherit;text-align:left;cursor:pointer;min-width:0}' +
    '.dk-stage:first-child{border-left:0}.dk-stage:hover{background:var(--quiet)}' +
    '.dk-stage:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}' +
    '.dk-sn{font-size:24px;font-weight:700;line-height:1.2;font-variant-numeric:tabular-nums}' +
    '.dk-sl{font-size:13px;font-weight:600;color:var(--muted);line-height:1.4}' +
    '.dk-stage.is-on,.dk-stage.is-on:hover{background:var(--accent);color:var(--on-accent)}.dk-stage.is-on .dk-sl{color:var(--on-accent)}' +
    '.dk-card{margin:0;padding:8px 0 4px}' +
    '.dk-lhead{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 28px 6px}' +
    '.dk-list{list-style:none;margin:0;padding:0}' +
    '.dk-row{display:grid;grid-template-columns:minmax(0,1fr) 96px 520px;gap:10px 20px;align-items:center;padding:18px 28px;border-top:1px solid var(--line)}' +
    '.dk-list:first-of-type .dk-row:first-child{border-top:0}' +
    '.dk-row.is-running{box-shadow:inset 3px 0 0 var(--accent)}' +
    '.dk-main{min-width:0;display:flex;flex-direction:column;gap:4px}.dk-main p{margin:0}' +
    '.dk-tag{align-self:flex-start;font-size:11px;font-weight:700;color:var(--meta);border:1px solid var(--line);border-radius:999px;padding:1px 9px;line-height:1.6}' +
    '.dk-title{font-size:16px;font-weight:700;color:var(--fg);line-height:1.4;overflow-wrap:anywhere}' +
    '.dk-meta{font-size:13px;color:var(--muted);line-height:1.5;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}' +
    '.dk-note{font-size:14px;color:var(--fg);line-height:1.5}' +
    '.dk-pri{display:flex;justify-content:flex-end;min-width:0}.dk-pri:empty{display:none}' +
    '.dk-acts{display:flex;align-items:center;flex-wrap:wrap;gap:8px 16px;min-width:0}' +
    '.dk-done .dk-acts{grid-column:3}' +
    '.dk-stage.is-zero .dk-sn{color:var(--muted)}' +
    '.dk-acts .fz-btn.mt-b{min-width:76px;justify-content:center}' +
    '.dk-run{display:inline-flex;align-items:center;gap:12px}.dk-runt{font-size:13px;font-weight:700;color:var(--accent-text);font-variant-numeric:tabular-nums;white-space:nowrap}' +
    '.dk-done .dk-title{color:var(--muted);font-weight:600}.dk-done .dk-tag{opacity:.75}.dk-done .dk-note{color:var(--muted)}' +
    '.dk-sub{margin:0;padding:22px 28px 6px;border-top:1px solid var(--line);font-size:11px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}' +
    '.dk-sub + .dk-list .dk-row:first-child{border-top:0}' +
    '.dk-calm{margin:0;padding:10px 28px 22px;font-size:14px;color:var(--muted);line-height:1.5}' +
    '.dk-slot{grid-column:1/-1;min-width:0}' +
    '.dk-slot .ag-rv.tp-rv{margin:4px 0 0;padding:16px}.dk-slot .ag-rv textarea{min-height:180px}' +
    '.dk-form{display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:14px;border-radius:10px;background:var(--quiet)}' +
    '.dk-form .mt-in{flex:1 1 220px}.dk-form .mt-min{flex:0 0 120px}' +
    '@media (max-width:1180px){.dk-row{grid-template-columns:minmax(0,1fr) auto auto}}' +
    '@media (max-width:900px){.dk-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px}.dk-main,.dk-slot{flex:1 1 100%}.dk-pri,.dk-acts{display:contents}.dk-pri .fz-btn{margin-right:2px}}' +
    '@media (max-width:620px){.dk-board{margin:20px 0 24px}.dk-stages{grid-template-columns:repeat(2,minmax(0,1fr))}.dk-stage{padding:12px 16px}.dk-stage:nth-child(3){border-left:0}.dk-stage:nth-child(n+3){border-top:1px solid var(--line)}' +
    '.dk-lhead{padding:12px 18px 4px}.dk-row{padding:16px 18px}.dk-sub{padding:18px 18px 4px}.dk-calm{padding:8px 18px 18px}.dk-form .mt-min{flex:1 1 100%}}';

  FZ.renderBoard = function (ctx, api) {
    const { ui, fmt } = ctx;
    const { h } = ui;
    if (!TICK) TICK = setInterval(tick, 15000);
    const now = () => new Date().toISOString();
    const who = ownerFirst();
    const days = weekDays(fmt);
    const inWeek = (iso) => iso && days.indexOf(fmt.dayKey(iso)) >= 0;
    const all = api.list.slice();
    const cols = { new: [], doing: [], waiting: [], done: [] };
    all.forEach((x) => { const c = colOf(x); if (c === 'done' && !inWeek(x.handledAt)) return; cols[c].push(x); });
    const byAge = (a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || ''));
    cols.new.sort(byAge); cols.waiting.sort(byAge);
    cols.doing.sort((a, b) => (b.time.runningSince ? 1 : 0) - (a.time.runningSince ? 1 : 0) || byAge(a, b));
    cols.done.sort((a, b) => String(b.handledAt).localeCompare(String(a.handledAt)));
    const openN = cols.new.length + cols.doing.length + cols.waiting.length;
    const fromOwner = all.filter((x) => x.from === 'owner' && x.status !== 'handled').length;
    const weekMin = all.reduce((n, x) => n + (x.time.entries || []).filter((e) => inWeek(e.at)).reduce((m, e) => m + (Number(e.min) || 0), 0), 0);

    const fail = (b) => { b.disabled = false; b.textContent = 'Could not save, try again'; };
    const claim = (x) => (!x.status || x.status === 'open') ? { status: 'claimed', claimedAt: now(), claimedBy: FZ.opName() || 'Operator' } : null;
    const logTime = (x, min, note) => { const entries = (x.time.entries || []).concat({ min: Math.max(1, Math.round(min)), at: now(), note: note || '' }); return { entries, totalMin: minutesOn({ entries }) }; };
    const stopPatch = (x) => x.time.runningSince ? Object.assign({ runningSince: null }, logTime(x, (Date.now() - new Date(x.time.runningSince).getTime()) / 60000, 'Timer')) : {};
    const btn = (label, fn, cls) => { const b = h('button', { type: 'button', class: cls || 'fz-btn mt-b' }, label); b.addEventListener('click', async () => { b.disabled = true; if (await fn()) api.repaint(); else fail(b); }); return b; };
    const CLOSE = { mail: 'Close the email', time: 'Cancel', done: 'Cancel' };
    const toggle = (label, id, kind, cls) => { const b = h('button', { type: 'button', class: cls || 'mt-quiet', 'aria-expanded': String(FORM[id] === kind) }, FORM[id] === kind ? (CLOSE[kind] || 'Close') : label); b.addEventListener('click', () => { FORM[id] = FORM[id] === kind ? null : kind; api.repaint(); }); return b; };
    const tagOf = (x) => x.from === 'owner' ? 'From ' + senderOf(x) : x.from === 'operator' ? 'Added by you' : (agentName(x.agent) || 'Agent');

    // One row per task: source tag, title, one meta line, then the actions in one line, primary first.
    const row = (x) => {
      const c = colOf(x);
      const t = x.time;
      const total = minOf(x);
      const d = cleanDetail(x);
      const src = x.link ? ui.extLink(x.link, linkLabel(x.link), 'mt-src') : (x.agent && x.from !== 'operator') ? h('a', { class: 'mt-src', href: '#a-' + x.agent }, 'Open ' + agentName(x.agent)) : null;
      let primary = null;
      const quiet = [src];
      if (c === 'new') {
        primary = btn('Start', () => api.saveManual(x.id, claim(x), { runningSince: now() }));
        if (x.draft) quiet.push(toggle('Read the email', x.id, 'mail'));
        quiet.push(toggle('Add time', x.id, 'time'), toggle('Mark done', x.id, 'done'));
      } else if (c === 'doing') {
        if (t.runningSince) primary = btn('Stop', () => api.saveManual(x.id, null, stopPatch(x)));
        else primary = toggle('Done', x.id, 'done', 'fz-btn mt-b');
        if (x.draft) quiet.push(toggle('Read the email', x.id, 'mail'));
        quiet.push(toggle('Add time', x.id, 'time'));
        quiet.push(t.runningSince ? toggle('Mark done', x.id, 'done') : btn('Start timer', () => api.saveManual(x.id, null, { runningSince: now() }), 'mt-quiet'));
        quiet.push(btn('Waiting on ' + who, () => api.saveManual(x.id, { status: 'waiting', waitingAt: now() }, stopPatch(x)), 'mt-quiet'));
      } else if (c === 'waiting') {
        primary = x.remindedAt && (Date.now() - new Date(x.remindedAt).getTime()) < 3600000 ? h('span', { class: 'mt-sent' }, 'Reminded ' + since(x.remindedAt)) : btn('Remind ' + who, () => api.saveManual(x.id, { remindedAt: now() }, null));
        if (x.draft) quiet.push(toggle('Read the email', x.id, 'mail'));
        quiet.push(toggle('Add time', x.id, 'time'), toggle('Mark done', x.id, 'done'), btn('Back to in progress', () => api.saveManual(x.id, { status: 'claimed' }, null), 'mt-quiet'));
      } else {
        quiet.push(btn('Reopen', () => api.saveManual(x.id, { status: 'claimed', handledAt: null }, { done: false }), 'mt-quiet'));
      }
      let form = null;
      if (c !== 'done' && FORM[x.id] === 'time') {
        const m = h('input', { type: 'number', min: '1', step: '1', inputmode: 'numeric', class: 'mt-in mt-min', 'aria-label': 'Minutes', placeholder: 'Minutes' });
        const n = h('input', { type: 'text', class: 'mt-in', maxlength: '120', 'aria-label': 'What the time was for', placeholder: 'What it was for' });
        const sv = h('button', { type: 'submit', class: 'fz-btn mt-b' }, 'Save time');
        form = h('form', { class: 'dk-form dk-time' }, m, n, sv);
        form.addEventListener('submit', async (e) => {
          e.preventDefault(); const v = Math.round(Number(m.value));
          if (!(v > 0)) { m.setAttribute('aria-invalid', 'true'); m.focus(); return; }
          sv.disabled = true;
          if (await api.saveManual(x.id, claim(x), logTime(x, v, n.value.trim() || 'Added by hand'))) { FORM[x.id] = null; document.activeElement && document.activeElement.blur(); api.repaint(); } else fail(sv);
        });
      }
      if (c !== 'done' && FORM[x.id] === 'done') {
        const n = h('input', { type: 'text', class: 'mt-in', maxlength: '160', 'aria-label': 'What was done', placeholder: 'What was done, one line' });
        const sv = h('button', { type: 'submit', class: 'fz-btn mt-b' }, 'Save as done');
        form = h('form', { class: 'dk-form dk-donef' }, n, sv);
        form.addEventListener('submit', async (e) => {
          e.preventDefault(); sv.disabled = true; const note = n.value.trim();
          if (await api.saveManual(x.id, { status: 'handled', handledAt: now(), handledBy: FZ.opName() || 'Operator', doneNote: note }, Object.assign({ done: true, doneNote: note, runningSince: null }, stopPatch(x)))) { FORM[x.id] = null; document.activeElement && document.activeElement.blur(); api.repaint(); } else fail(sv);
        });
      }
      if (c !== 'done' && x.draft && FORM[x.id] === 'mail') form = readApprove(h, x, api, () => { FORM[x.id] = null; api.repaint(); });
      const age = c === 'done' ? 'Done ' + since(x.handledAt) : c === 'waiting' ? 'Waiting since ' + since(x.waitingAt || x.createdAt).replace(/ ago$/, '') : 'Came in ' + since(x.createdAt || now());
      const metaBits = [d, age, total ? hm(total) + ' logged' : null].filter(Boolean);
      return h('li', { class: 'dk-row dk-' + c + (t.runningSince ? ' is-running' : '') },
        h('div', { class: 'dk-main' },
          h('p', { class: 'dk-tag' }, tagOf(x)),
          h('p', { class: 'dk-title' }, x.title || 'Needs a look'),
          h('p', { class: 'dk-meta' }, metaBits.join(' · '), t.runningSince ? [metaBits.length ? ' · ' : '', h('span', { class: 'dk-runt', 'data-since': t.runningSince }, runText(t.runningSince))] : null),
          c === 'done' && x.doneNote ? h('p', { class: 'dk-note' }, x.doneNote) : null),
        h('div', { class: 'dk-pri' }, primary),
        h('div', { class: 'dk-acts' }, ...quiet.filter(Boolean)),
        form ? h('div', { class: 'dk-slot' }, form) : null);
    };
    // Stage strip: four counts, each a filter. Tap the selected one again for all open.
    const STAGES = [['new', 'New'], ['doing', 'In progress'], ['waiting', 'Waiting on ' + who], ['done', 'Done this week']];
    if (STAGE !== 'all' && !STAGES.some(([k]) => k === STAGE)) STAGE = 'all';
    const strip = h('nav', { class: 'dk-stages', 'aria-label': 'Filter by stage' }, STAGES.map(([k, name]) => {
      const on = STAGE === k;
      const b = h('button', { type: 'button', class: 'dk-stage' + (on ? ' is-on' : '') + (cols[k].length ? '' : ' is-zero'), 'aria-pressed': String(on) }, h('span', { class: 'dk-sn' }, String(cols[k].length)), h('span', { class: 'dk-sl' }, name));
      b.addEventListener('click', () => { STAGE = on ? 'all' : k; api.repaint(); });
      return b;
    }));
    const openRows = [].concat(cols.new, cols.doing, cols.waiting);
    const CALM = { new: 'Nothing new.', doing: 'Nothing in progress.', waiting: 'Nothing waiting on ' + who + '.', done: 'Nothing done yet this week.' };
    let listBody;
    if (STAGE === 'all') {
      listBody = [
        openRows.length ? h('ol', { class: 'dk-list' }, openRows.map(row)) : h('p', { class: 'dk-calm' }, 'Nothing open. New tasks land here.'),
        cols.done.length ? h('p', { class: 'dk-sub' }, 'Done this week') : null,
        cols.done.length ? h('ol', { class: 'dk-list' }, cols.done.map(row)) : null
      ];
    } else {
      listBody = [cols[STAGE].length ? h('ol', { class: 'dk-list' }, cols[STAGE].map(row)) : h('p', { class: 'dk-calm' }, CALM[STAGE])];
    }
    const allBtn = h('button', { type: 'button', class: 'mt-quiet' }, 'Show all open');
    allBtn.addEventListener('click', () => { STAGE = 'all'; api.repaint(); });
    const listHead = h('div', { class: 'dk-lhead' },
      h('p', { class: 'mt-eb' }, STAGE === 'all' ? 'All open' : (STAGES.find(([k]) => k === STAGE) || [])[1]),
      STAGE === 'all' ? null : allBtn);
    // Nothing open and nothing done this week: the headline already says all clear, so no empty strip or box.
    const board = !(openRows.length || cols.done.length) ? h('style', null, DK_CSS) : h('section', { class: 'dk-board', 'aria-label': 'Tasks' }, strip, h('div', { class: 'mt-card dk-card' }, listHead, ...listBody.filter(Boolean)), h('style', null, DK_CSS));

    // Add a task: a small button that opens the form.
    const addBtn = h('button', { type: 'button', class: 'fz-btn mt-b', 'aria-expanded': String(ADD_OPEN) }, ADD_OPEN ? 'Close' : 'Add a task');
    addBtn.addEventListener('click', () => { ADD_OPEN = !ADD_OPEN; api.repaint(); });
    let addForm = null;
    if (ADD_OPEN) {
      const title = h('input', { type: 'text', class: 'mt-in', required: true, maxlength: '140', id: 'mt-title', placeholder: 'Call Kim about the shower door' });
      const link = h('input', { type: 'text', class: 'mt-in', id: 'mt-link', inputmode: 'url', placeholder: 'Jobber link or web address' });
      const agent = h('select', { class: 'mt-in', id: 'mt-agent' }, h('option', { value: '' }, 'No agent'), FZ.AGENTS.map((a) => h('option', { value: a.key }, a.name.replace(/ Agent$/, ''))));
      const sv = h('button', { type: 'submit', class: 'fz-btn mt-b' }, 'Add to the board');
      const msg = h('p', { class: 'mt-msg', role: 'status' });
      addForm = h('form', { class: 'mt-card mt-addform' },
        h('label', { for: 'mt-title' }, 'Task'), title,
        h('label', { for: 'mt-link' }, 'Source link (optional)'), link,
        h('label', { for: 'mt-agent' }, 'Agent (optional)'), agent,
        h('div', { class: 'mt-addbtns' }, sv), msg);
      addForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const tt = title.value.trim(); if (!tt) { title.focus(); return; }
        let u = link.value.trim(); if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u;
        sv.disabled = true;
        if (await api.addManual({ title: tt, link: u || null, agent: agent.value || null })) { ADD_OPEN = false; document.activeElement && document.activeElement.blur(); api.repaint(); }
        else { sv.disabled = false; msg.textContent = 'Could not save. Only an editor of this page can add tasks.'; }
      });
    }

    // This week: hours by day and tasks done, then the owner's report.
    const perDay = days.map((k) => all.reduce((n, x) => n + (x.time.entries || []).filter((e) => e.at && fmt.dayKey(e.at) === k).reduce((m, e) => m + (Number(e.min) || 0), 0), 0));
    const todayKey = fmt.dayKey(now());
    const peak = Math.max(1, ...perDay);
    const seeReport = h('a', { class: 'mt-src', href: '#operator' }, 'See the report ' + who + ' sees');
    seeReport.addEventListener('click', (e) => { e.preventDefault(); if (FZ.setView) FZ.setView('owner', '#operator'); });
    const week = (weekMin || cols.done.length) ? h('section', { class: 'mt-card mb-week' },
      h('div', { class: 'mb-wtext' }, h('p', { class: 'mt-eb' }, 'This week'),
        h('p', { class: 'mb-wt' }, ...[weekMin ? [h('b', null, hm(weekMin)), ' logged'] : null, cols.done.length ? [weekMin ? ', ' : '', h('b', null, fmt.plural(cols.done.length, 'task')), ' done'] : null].flat().filter(Boolean), '.'),
        seeReport),
      !weekMin ? null : h('div', { class: 'mb-days', role: 'img', 'aria-label': 'Time logged by day: ' + days.map((k, i) => new Date(k + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'long' }) + ' ' + hm(perDay[i])).join(', ') },
        days.map((k, i) => h('div', { class: 'mb-day' + (k === todayKey ? ' now' : '') + (k > todayKey ? ' later' : '') },
          h('span', { class: 'mb-dv' }, perDay[i] ? hm(perDay[i]) : ''),
          h('span', { class: 'mb-db', style: 'height:' + (perDay[i] ? Math.max(6, Math.round(perDay[i] / peak * 64)) : 2) + 'px' }),
          h('span', { class: 'mb-dl' }, new Date(k + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', weekday: 'short' })))))) : h('p', { class: 'mb-weekcalm' }, 'Time you log shows here by day. ', seeReport);

    const jobberOpen = api.jobber ? api.jobber.filter((t) => !(api.done[t.id] && api.done[t.id].done)) : null;
    const panel = jobberOpen && jobberOpen.length ? FZ.renderTaskPanel(ctx, api.jobber, api.done, api.save).find((p) => p && p.classList && p.classList.contains('tp-list')) : null;
    const status = openN
      ? [{ b: fmt.plural(openN, 'open task') }, fromOwner ? ', ' + fromOwner + ' from ' + who + '.' : '.', weekMin ? [' ', { b: hm(weekMin) }, ' logged this week.'] : []]
      : ['All clear. Nothing waiting for a person.', weekMin ? [' ', { b: hm(weekMin) }, ' logged this week.'] : []];
    return [
      h('header', { class: 'rp-headrow mb-hero' }, h('h1', { class: 'home' }, FZ.opName() ? 'Operator desk, ' + FZ.opName() : 'Operator desk'), addBtn),
      ui.status([].concat(...status.map((p) => Array.isArray(p) ? p : [p]))),
      addForm,
      board,
      week,
      panel ? h('details', { class: 'mt-card mt-fold' }, h('summary', null, h('b', null, jobberOpen.length + ' more'), ' from Jobber, waiting on ' + who), h('div', { class: 'tk-page mt-jobber' }, panel)) : null,
      api.extra || null
    ];
  };

  // ---------- Owner's Operator page: what the Operator was sent and did this month ----------
  FZ.renderOpReport = function (ctx, api) {
    const { ui, fmt } = ctx;
    const { h } = ui;
    const nowIso = new Date().toISOString();
    const month = fmt.dayKey(nowIso).slice(0, 7);
    const list = api.list.filter((x) => !/^template-/.test(x.id));
    const done = list.filter((x) => x.status === 'handled' && x.handledAt && fmt.dayKey(x.handledAt).slice(0, 7) === month).sort((a, b) => String(b.handledAt).localeCompare(String(a.handledAt)));
    const open = list.filter((x) => x.status !== 'handled').sort((a, b) => (a.status === 'waiting' ? 0 : 1) - (b.status === 'waiting' ? 0 : 1) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    const entries = [];
    list.forEach((x) => (x.time.entries || []).forEach((e) => { if (e.at && fmt.dayKey(e.at).slice(0, 7) === month) entries.push(e); }));
    const monthMin = entries.reduce((n, e) => n + (Number(e.min) || 0), 0);
    const sentBy = (x) => x.from === 'owner' ? 'You sent it' : x.from === 'operator' ? 'Your Operator added it' : 'Your ' + (agentName(x.agent) || 'agent') + ' agent sent it';
    const fromOf = (x) => x.from === 'owner' ? 'You sent it' : x.from === 'operator' ? (agentName(x.agent) ? 'For ' + agentName(x.agent) : 'Your Operator picked it up') : 'From ' + (agentName(x.agent) || 'an agent');
    const head = h('div', { class: 'rp-headrow' }, h('h1', { class: 'home' }, FZ.opName() ? 'Your Operator, ' + FZ.opName() : 'Your Operator'));
    if (!done.length && !open.length) return [head, h('p', { class: 'rp-calm' }, 'Nothing handed over yet this month. Send any task to your Operator from Tasks.')];
    const headline = done.length
      ? ui.status(['Your Operator did ', { b: fmt.plural(done.length, 'task') }, ' for you this month', monthMin ? [', ', { b: hm(monthMin) }, ' in all.'] : ['.']].flat())
      : ui.status(['Your Operator is on ', { b: fmt.plural(open.length, 'task') }, ' for you this month.']);
    // Hours by week (weeks start Monday), this month so far.
    const [y, m] = month.split('-').map(Number);
    const today = Number(fmt.dayKey(nowIso).slice(8, 10));
    const weeks = [];
    for (let d = 1; d <= today; d++) { const dt = new Date(Date.UTC(y, m - 1, d)); if (d === 1 || dt.getUTCDay() === 1) weeks.push({ from: d, label: dt.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }), min: 0 }); }
    entries.forEach((e) => { const d = Number(fmt.dayKey(e.at).slice(8, 10)); let w = weeks[0]; weeks.forEach((x) => { if (x.from <= d) w = x; }); if (w) w.min += Number(e.min) || 0; });
    // This month at a glance (Matt, Nov 7: the one bar chart said nothing). Three plain numbers.
    const waitingN = open.filter((x) => x.status === 'waiting').length;
    const stat = (n, label, sub, hot) => h('div', { class: 'rp-stat' }, h('b', { class: hot ? 'hot' : null }, n), h('span', null, label), sub ? h('small', null, sub) : null);
    const chart = h('div', { class: 'rp-card rp-sum' }, h('p', { class: 'rp-eb' }, 'This month'),
      stat(String(open.length), open.length === 1 ? 'task with your Operator' : 'tasks with your Operator', waitingN ? waitingN + ' waiting on you' : null, waitingN > 0),
      stat(String(done.length), done.length === 1 ? 'task done' : 'tasks done'),
      stat(monthMin ? hm(monthMin) : '0 min', 'of Operator time'),
      h('a', { class: 'fz-btn rp-go', href: '#tasks' }, 'Send a task'),
      h('style', null, '.rp-sum{display:flex;flex-direction:column;gap:0;padding:24px 28px}.rp-stat{display:flex;flex-direction:column;gap:2px;padding:16px 0;border-top:1px solid var(--line)}.rp-eb+.rp-stat{border-top:0;padding-top:8px}.rp-stat b{font-size:32px;font-weight:800;line-height:1.1;color:var(--head,var(--fg))}.rp-stat b.hot{color:var(--accent-text,var(--accent))}.rp-stat span{font-size:14px;color:var(--fg)}.rp-stat small{font-size:13px;color:var(--muted)}.rp-go{align-self:flex-start;margin-top:12px}'));
    const sentList = open.length ? h('section', { class: 'rp-card' }, h('p', { class: 'rp-eb rp-pad' }, 'Sent to your Operator'),
      h('ol', { class: 'rp-list' }, open.map((x) => h('li', { class: 'rp-row rp-open' },
        h('div', { class: 'rp-what' }, h('p', { class: 'rp-t' }, scrub(x.title || 'Task')), h('p', { class: 'rp-from' }, sentBy(x) + ' ' + since(x.createdAt || nowIso))),
        h('span', { class: 'rp-st' + (x.status === 'waiting' ? ' you' : '') }, x.status === 'waiting' ? 'Waiting on you' : 'In progress'))))) : null;
    const doneList = done.length ? h('section', { class: 'rp-card' }, h('p', { class: 'rp-eb rp-pad' }, 'Done this month'),
      h('ol', { class: 'rp-list' }, done.map((x) => h('li', { class: 'rp-row' },
        h('span', { class: 'rp-date' }, fmt.fmtDate(x.handledAt)),
        h('div', { class: 'rp-what' },
          h('p', { class: 'rp-t' }, scrub(x.doneNote || String(x.title || 'Task').replace(/^Approved: /, ''))),
          x.doneNote ? h('p', { class: 'rp-n' }, scrub(String(x.title || '').replace(/^Approved: /, ''))) : null,
          h('p', { class: 'rp-from' }, fromOf(x))),
        h('span', { class: 'rp-min' }, minOf(x) ? hm(minOf(x)) : ''))))) : null;
    return [head, headline, h('div', { class: 'rp-grid' }, h('div', { class: 'rp-lists' }, sentList, doneList), chart)];
  };
})();
