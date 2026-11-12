// The agents' rule book: what each agent can and can't do today, and what you can ask it in Claude.
// Shown at the foot of every agent board. The same rules sit in the shop's Claude project as its knowledge base.
(function () {
  const R = {
    'builder-engine': {
      can: ["Find builders with new projects near you, from open permit lists where your county publishes one and from Google listings", "Find the office email each builder publishes", "Write an intro email from you for each one", "Track replies in your email and write a follow up after 7 days with no reply"],
      cant: ["Send anything you have not approved", "Read permits a county keeps behind a login", "Find personal mobile numbers"],
      ask: ["Which builders have new projects near me this month?", "Write an intro to the builder on the biggest project"]
    },
    'partner-finder': {
      can: ["Find local businesses that can send you work, from Google listings and their own websites", "Write a short partner intro from you", "Track replies in your email"],
      cant: ["Send anything you have not approved", "Guess an email a business does not publish"],
      ask: ["Find 10 businesses near me that could send us work", "Write an intro to a property manager"]
    },
    'local-search-check': {
      can: ["Check where you show up when people nearby search for your work", "List the fixes that move you up, with where to go and the words to paste"],
      cant: ["Change your Google profile for you. You make each fix on Google, then mark it done"],
      ask: ["How do I show up when people near me search for my work?"]
    },
    'lost-quote-revival': {
      can: ["Find quotes that went quiet months ago", "Write a short note to restart each one"],
      cant: ["Send a note you have not approved"],
      ask: ["Which old quotes are worth one more try?", "Write a note to the biggest quote that went quiet"]
    },
    'morning-brief': {
      can: ["Read your field app every weekday morning and list what needs you, biggest dollars first", "Send the emails you approved", "Email you one short brief on days something needs you"],
      cant: ["Read texts on your phone", "See photos or drawings stored in your field app"],
      ask: ["What needs me today?", "What did we promise on finished jobs that never got quoted?"]
    },
    'lead-catcher': {
      can: ["Spot new enquiries in your field app and in your email", "Write the reply from you"],
      cant: ["Read texts or calls to your phone. Forward a text to Claude instead", "Send a reply you have not approved"],
      ask: ["Who enquired this week and has not heard back?", "Write a reply to the newest enquiry"]
    },
    'quotes': {
      can: ["Draft a quote for every job you have visited or measured, from your own price list and similar past quotes", "Save it as a draft in your field app", "Turn anything asked for on site into a request, from a line you type or say"],
      cant: ["Send the quote. You check it and press send", "Open drawings or photos stored in your field app", "Create a new customer from the app"],
      ask: ["Which visited jobs still need a quote?", "Draft the quote for the job I looked at yesterday"]
    },
    'quote-chaser': {
      can: ["Find quotes past your field app's own reminders", "Write a personal follow up from you", "Flag the big ones worth a call"],
      cant: ["Send a follow up you have not approved", "Follow up by text"],
      ask: ["Which quotes need a personal follow up?", "Write a follow up for the biggest open quote"]
    },
    'install-scheduler': {
      can: ["List every yes not booked yet", "Write the order to your supplier from the quote lines", "Read the delivery date from the supplier's reply in your email and nudge them after 3 days", "Pick the first free days after delivery", "Write the note asking the customer which day", "Flag late deliveries and customers who have not answered"],
      cant: ["Create the job or the visit where your field app does not allow it. You set it in one tap", "Read or send texts"],
      ask: ["Which approved quotes still need ordering?", "Which jobs are waiting on a delivery?"]
    },
    'bill-it': {
      can: ["Find finished jobs not invoiced yet", "Open each job ready to invoice"],
      cant: ["Send the invoice. You press send in your field app"],
      ask: ["Which finished jobs still need an invoice?"]
    },
    'get-paid': {
      can: ["Find overdue invoices, biggest first", "Check your books first, so nobody is nudged for a bill they already paid", "Write a friendly reminder from you"],
      cant: ["Take payments", "Send a reminder you have not approved"],
      ask: ["Who owes me money and how late is it?", "Write a reminder for the biggest overdue invoice"]
    },
    'pay-bills': {
      can: ["Show the bills due in your books", "Flag one that looks too high or billed twice", "Remind you before they are late"],
      cant: ["Pay a bill. You press pay in your books"],
      ask: ["What bills are due this week?"]
    },
    'review-ask': {
      can: ["Find customers who just paid, trade customers first", "Write the review ask from you with your saved review link"],
      cant: ["Send an ask you have not approved", "Post or answer reviews"],
      ask: ["Who should I ask for a review this week?"]
    },
    'come-back': {
      can: ["Find past customers due for more work, 6 to 18 months after their job", "Write a note from you"],
      cant: ["Send a note you have not approved"],
      ask: ["Which past customers have not been back in a year?"]
    },
    'yes-to-install': {
      can: ["List every yes not booked yet", "Write the order to your supplier from the quote lines", "Read the delivery date from the supplier's reply in your email and nudge them after 3 days", "Pick the first free days after delivery", "Write the note asking the customer which day", "Flag late deliveries and customers who have not answered"],
      cant: ["Create the job or the visit where your field app does not allow it. You set it in one tap", "Read or send texts"],
      ask: ["Which approved quotes still need ordering?", "Which jobs are waiting on a delivery?"]
    },
    'quick-capture': {
      can: ["Draft a quote for every job you have visited or measured, from your own price list and similar past quotes", "Save it as a draft in your field app", "Turn anything asked for on site into a request, from a line you type or say"],
      cant: ["Send the quote. You check it and press send", "Open drawings or photos stored in your field app", "Create a new customer from the app"],
      ask: ["Which visited jobs still need a quote?", "Draft the quote for the job I looked at yesterday"]
    },
    'quote-prep': {
      can: ["Draft a quote for every job you have visited or measured, from your own price list and similar past quotes", "Save it as a draft in your field app", "Turn anything asked for on site into a request, from a line you type or say"],
      cant: ["Send the quote. You check it and press send", "Open drawings or photos stored in your field app", "Create a new customer from the app"],
      ask: ["Which visited jobs still need a quote?", "Draft the quote for the job I looked at yesterday"]
    },
    'supplier-costs': {
      can: ['Read your supplier\u2019s cost sheet from a photo or pasted text', 'Price every quote from the glass and hardware cost plus your markup and install', 'Show the same panel priced from costs and from your formula, so you can compare'],
      cant: ['Fetch the cost sheet from the supplier. You load the new one when it changes.', 'Read a PDF directly. Take a screenshot of each page.', 'Use a cost before you check it'],
      ask: ['What does a 60 x 80 shower in 3/8 clear cost me from my supplier?', 'Price the next mirror from supplier costs with my markup']
    },
    'price-book': {
      can: ['Learn your all in price from past quotes with sizes', 'Show quotes priced off your book', 'Price every new quote from the formula you approve'],
      cant: ['Learn from quotes with no sizes written on them', 'Change past quotes'],
      ask: ['What do I really charge a square foot for showers?', 'Which quotes were priced under my formula?']
    }
  };
  const ALWAYS = ['Nothing goes out until you approve it, or until you turn on auto approve for that agent', 'Works only in your own field app, books and email'];

  // What to do here: three steps naming the exact tab and buttons, shown at the top of each agent page.
  const DO = {
    'morning-brief': { steps: ['Read the 3 biggest items on the Summary tab', 'Press Read and approve on each, or open the Approve today tab for the rest', 'Loose ends at the bottom: Turn into a request, Remind me, or Done'], idle: 'It reads Jobber every weekday morning. New items show up here by 7am.' },
    'lead-catcher': { steps: ['Open the Reply to enquiries tab', 'Read the reply written for each new enquiry', 'Press Approve and send, or call them yourself'], idle: 'No one is waiting on a reply. New enquiries show up here the same day.' },
    'quotes': { steps: ['Open a job on the To quote tab', 'Check the lines and the price', 'Press Create draft quote in Jobber, then send it from Jobber'], idle: 'Nothing to quote. Jobs you visit show up here the morning after.' },
    'quote-chaser': { steps: ['Open the Send follow ups tab', 'Read the follow up written for each quote', 'Press Approve and send, or call the big ones yourself'], idle: 'No quote needs a personal follow up. Jobber’s own reminders cover the first week.' },
    'yes-to-install': { steps: ['Open the Order and book jobs tab', 'Check the order written for your supplier', 'Press Approve and send, then book the job in Jobber'], idle: 'Every yes is booked. New approvals show up here the same day.' },
    'install-scheduler': { steps: ['Open the Line up installs tab', 'Check the delivery date read from your supplier, or type it and press Save delivery date', 'Send the install day note, tap the day they pick, then set it in Jobber'], idle: 'Every job has a day. Jobs waiting on a delivery show up here.' },
    'bill-it': { steps: ['Press Invoice it on a finished job', 'In Jobber press Create Invoice, then Send', 'Come back and press Invoiced in Jobber so it drops off your list'], idle: 'Every finished job is invoiced.' },
    'get-paid': { steps: ['Open the Send payment reminders tab', 'Read the reminder written for each overdue invoice', 'Press Approve and send, or call them yourself'], idle: 'Nothing overdue. Overdue invoices show up here the day after they are due.' },
    'review-ask': { steps: ['Open the Request customer reviews tab', 'Read the ask written for each customer who just paid', 'Press Approve and send, or Already handled if you asked in person'], idle: 'No one to ask this week. Finished jobs show up here a few days after.' },
    'come-back': { steps: ['Open the Invite past customers back tab', 'Read the check in written for each past customer', 'Press Approve and send, or Already handled'], idle: 'No past customers due this month.' },
    'where-to-find-work': { steps: ['Look at the best areas, top first', 'Tap a block on the map to see what is in it', 'Send the realtor note to agents who sell there'], idle: 'New areas come in monthly from public records.' },
    'builder-engine': { steps: ['Read which builders just got projects approved near you', 'Open the To send tab and read the intro written for each', 'Press Queue to send. Replies and site walks show on the Pipeline tab'], idle: 'No new builders this week. New permits are checked every night.' },
    'lost-quote-revival': { steps: ['Open the Send win back offers tab', 'Read the offer written for each old quote', 'Press Approve and send, or Already handled'], idle: 'No old quotes worth another try right now.' },
    'partner-finder': { steps: ['It finds designers, showrooms and rental managers near you', 'When intros are ready, open the Send partner intros tab', 'Read each intro and press Send it'], idle: 'Needs the local search key set up before it can find partners.' },
    'local-search-check': { steps: ['It checks where you show up when people nearby search', 'When the check is in, open the Fix your listings tab', 'Make each fix on Google, then mark it fixed'], idle: 'Needs the local search key set up before it can check.' }
  };
  FZ.DO = DO;
  FZ.doStrip = function (key) {
    const d = DO[key]; if (!d) return null;
    const { h } = FZ.ui;
    let seen = false; try { seen = localStorage.getItem('fz-do-' + key) === '1'; localStorage.setItem('fz-do-' + key, '1'); } catch (e) { /* storage off */ }
    const box = h('details', { class: 'do-box' }, h('summary', null, h('span', { class: 'do-k' }, 'What to do here'), h('span', { class: 'do-s' }, ' ' + d.steps.length + ' steps')),
      h('ol', { class: 'do-list' }, d.steps.map((t, i) => h('li', null, h('span', { class: 'do-n' }, String(i + 1)), h('span', null, t)))),
      h('style', null, '.do-box{margin:14px 0 6px;border:1px solid var(--accent);border-radius:12px;padding:10px 14px}.do-box summary{cursor:pointer;list-style:none;display:flex;align-items:center;gap:6px;min-height:28px}.do-box summary::-webkit-details-marker{display:none}.do-box summary:before{content:"\\25B8";color:var(--accent);font-size:12px;transition:transform .15s}.do-box[open] summary:before{transform:rotate(90deg)}.do-k{font-weight:800;color:var(--accent);letter-spacing:.02em}.do-s{color:var(--muted);font-size:13px}.do-list{list-style:none;margin:10px 0 2px;padding:0;display:grid;gap:8px}.do-list li{display:grid;grid-template-columns:26px 1fr;gap:10px;align-items:start;font-size:15px;line-height:1.35}.do-n{width:24px;height:24px;border-radius:50%;background:var(--accent);color:var(--on-accent,#111);display:grid;place-items:center;font-weight:800;font-size:13px}'));
    if (!seen) box.open = true;
    return box;
  };
  FZ.RULES = R;
  FZ.rulesPanel = function (key) {
    const r = R[key]; if (!r) return null;
    const { h } = FZ.ui;
    const copy = (t) => { const b = h('button', { type: 'button', class: 'fz-btn sm' }, 'Copy'); b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(t); b.textContent = 'Copied'; } catch (e) { window.prompt('Copy this', t); } setTimeout(() => { b.textContent = 'Copy'; }, 1600); }); return b; };
    const list = (cls, items) => h('ul', { class: 'ar-list ' + cls }, items.map((t) => h('li', null, t)));
    return h('details', { class: 'ar-box' },
      h('summary', null, 'What this agent can and can’t do'),
      h('div', { class: 'ar-cols' },
        h('div', null, h('p', { class: 'ar-k ok' }, 'It can'), list('ok', r.can)),
        h('div', null, h('p', { class: 'ar-k no' }, 'It can’t yet'), list('no', r.cant))),
      h('p', { class: 'fz-hint' }, ALWAYS.join('. ') + '.'),
      h('p', { class: 'ar-k' }, 'Ask it in Claude on your phone'),
      h('div', { class: 'ar-ask' }, r.ask.map((t) => h('div', { class: 'ar-q' }, h('span', null, '“' + t + '”'), copy(t)))),
      h('style', null, '.ar-box{margin:0;border:1px solid var(--line);border-radius:12px;padding:16px 22px;background:var(--card)}.ar-box summary{cursor:pointer;font-weight:700;list-style:none;display:flex;align-items:center;gap:8px;outline:none;border-radius:6px}.ar-box summary::-webkit-details-marker{display:none}.ar-box summary:before{content:"\\25B8";color:var(--muted);font-size:12px;transition:transform .15s}.ar-box[open] summary:before{transform:rotate(90deg)}.ar-box summary:focus-visible{outline:2px solid var(--accent);outline-offset:4px}.ar-box>.fz-hint{margin:16px 0 0}.ar-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:12px}@media(max-width:620px){.ar-cols{grid-template-columns:1fr}}.ar-k{font-size:12px;font-weight:700;letter-spacing:.05em;text-transform:uppercase;color:var(--muted);margin:18px 0 8px}.ar-k.ok{color:var(--ok-fg,#22c55e)}.ar-k.no{color:var(--accent)}.ar-list{margin:0;padding-left:18px;font-size:14px;line-height:1.45;display:grid;gap:6px}.ar-ask{display:grid;gap:8px}.ar-q{display:flex;gap:14px;align-items:center;justify-content:space-between;font-size:14px;border:1px solid var(--line);border-radius:10px;padding:10px 14px}.ar-q span{min-width:0}.ar-q .fz-btn{flex:none}'));
  };
})();
