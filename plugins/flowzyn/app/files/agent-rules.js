// The agents' rule book: what each agent can and can't do today, and what you can ask it in Claude.
// Shown at the foot of every agent board. The same rules sit in the shop's Claude project as its knowledge base.
(function () {
  const R = {
    'where-to-find-work': {
      can: ['Map every home near you by value, from public records', 'Show licensed rentals, homes that sold recently (from Zillow) and your own customers on the map', 'Rank the 5 areas with the most work you have not reached', 'Write your intro to local realtors', 'Work out what a month of hangers or postcards costs, and the response it needs to pay off', 'Match new Jobber requests to the houses you dropped cards at, for 90 days'],
      cant: ['Show county permits yet. The county keeps those behind a login.', 'Show sale dates or sold condos. Zillow gives recently sold houses and townhomes, without the date.', 'Show rentals inside Breckenridge town limits yet. The town keeps its own list.', 'Mail anything for you'],
      ask: ['Which neighbourhoods should I go after next?', 'Which areas have the most homes that sold recently?', 'Where are my customers clustered?']
    },
    'builder-engine': {
      can: ['Find builders pulling new permits near you', 'Write an intro email from you for each one', 'Send it from your email once you approve it, or on its own with auto approve'],
      cant: ['Send without your OK, unless auto approve is on', 'Find personal mobile numbers'],
      ask: ['Which builders pulled permits near me this month?', 'Write an intro to the builder on the biggest permit']
    },
    'partner-finder': {
      can: ['Find showrooms, designers and property managers near you', 'Write a short partner intro from you'],
      cant: ['Run until the Google key is set up', 'Send without your OK, unless auto approve is on'],
      ask: ['Find 10 interior designers near me I should know', 'Write an intro to a kitchen and bath showroom']
    },
    'local-search-check': {
      can: ['Check how you show up when people search for glass near you', 'List the fixes that move you up'],
      cant: ['Run until the Google key is set up', 'Change your Google profile for you'],
      ask: ['How do I show up for shower glass in the next town over?']
    },
    'lost-quote-revival': {
      can: ['Find quotes that went quiet months ago', 'Write a short note to restart each one'],
      cant: ['Send a note without your OK, unless auto approve is on'],
      ask: ['Which old quotes are worth one more try?', 'Write a note to the biggest quote that went quiet']
    },
    'morning-brief': {
      can: ['Read Jobber every morning and list what needs you, biggest dollars first', 'Catch loose ends, like a mirror promised after a shower job', 'Turn a loose end into a request in Jobber', 'Remind you on a day you pick'],
      cant: ['Read texts on your phone', 'See photos or drawings in Jobber'],
      ask: ['What needs me today?', 'What did we promise on finished jobs that never got quoted?']
    },
    'lead-catcher': {
      can: ['Spot new enquiries in Jobber', 'Write the reply from you'],
      cant: ['Reply to texts', 'Send a reply without your OK, unless auto approve is on'],
      ask: ['Who enquired this week and has not heard back?', 'Write a reply to the newest enquiry']
    },
    'quick-capture': {
      can: ['Create a request in Jobber for any customer and address on file', 'Read the sizes from a photo of the drawing', 'Draft the quote from your supplier costs or formula when it has the sizes'],
      cant: ['Attach a photo in Jobber', 'Create a new customer from here yet', 'Send the quote'],
      ask: ['Quote a mirror 44 x 30 for Jake at Monroe St', 'Add a request for Rich: remeasure the mirror at Westridge']
    },
    'quotes': {
      can: ['Draft a quote for every measured job in Jobber', 'Read the sizes from a photo of the drawing', 'Price it from your supplier costs or your formula, your choice', 'Create the draft quote in Jobber and convert the request', 'Capture anything asked for on site as a request'],
      cant: ['Open drawings stored in Jobber. Take a photo of the drawing instead.', 'Send the quote. You press send in Jobber.', 'Read a PDF cost sheet directly. Take a screenshot of each page.'],
      ask: ['Draft the quote for the Smith job: 74 x 82 shower, 30 x 42 mirror', 'Quote a mirror 44 x 30 for Jake at Monroe St', 'What does a 60 x 80 shower in 3/8 clear cost me from my supplier?']
    },
    'quote-prep': {
      can: ['Draft a quote for every measured request', 'Read the sizes from a photo of the drawing', 'Price it from your supplier costs or your formula', 'Create the draft quote in Jobber and convert the request'],
      cant: ['Open drawings stored in Jobber. Take a photo of the drawing instead.', 'Send the quote. You press send in Jobber.'],
      ask: ['Draft the quote for the Smith job: 74 x 82 shower, 30 x 42 mirror', 'Which measured requests still need a quote?']
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
    },
    'quote-chaser': {
      can: ['Find quotes past Jobber’s own reminders', 'Write a personal follow up from you', 'Send it from your email once you approve it, or on its own with auto approve'],
      cant: ['Send a follow up without your OK, unless auto approve is on', 'Follow up by text'],
      ask: ['Which quotes need a personal follow up?', 'Write a follow up for the biggest open quote']
    },
    'yes-to-install': {
      can: ['List every yes not booked yet', 'Write the glass order to your supplier with the job details'],
      cant: ['Convert a quote to a job in Jobber', 'Attach the drawing to the order. Forward it yourself.'],
      ask: ['Which approved quotes still need the glass ordered?', 'Write the glass order for the Westridge job']
    },
    'install-scheduler': {
      can: ['Track every job from glass ordered to install day', 'Pick the first free install days after delivery', 'Write the note asking the customer which day', 'Answer “how’s it looking” with one tap', 'Flag late glass and customers who have not answered'],
      cant: ['Open the supplier sheet itself. Add a screenshot and it reads the dates.', 'Read or send texts. You copy the text.', 'Create the visit. You set it in Jobber in one tap.'],
      ask: ['When is the glass for Wayne landing, and what days can we install?', 'Write a text to Nick saying his glass is on order']
    },
    'bill-it': {
      can: ['Find finished jobs not invoiced yet', 'Open each job ready to invoice'],
      cant: ['Create or send the invoice. You press Create Invoice in Jobber.'],
      ask: ['Which finished jobs still need an invoice?']
    },
    'get-paid': {
      can: ['Find overdue invoices, biggest first', 'Write a friendly nudge from you'],
      cant: ['Take payments', 'Send a nudge without your OK, unless auto approve is on'],
      ask: ['Who owes me money and how late is it?', 'Write a nudge for the biggest overdue invoice']
    },
    'pay-bills': {
      can: ['Show the bills due in QuickBooks', 'Remind you before they are late'],
      cant: ['Pay a bill. You press pay in QuickBooks.'],
      ask: ['What bills are due this week?']
    },
    'review-ask': {
      can: ['Find happy customers from finished jobs', 'Write the review ask from you'],
      cant: ['Send an ask without your OK, unless auto approve is on', 'Post or answer reviews'],
      ask: ['Who should I ask for a review this week?']
    },
    'come-back': {
      can: ['Find past customers due for more work', 'Write a note from you'],
      cant: ['Send a note without your OK, unless auto approve is on'],
      ask: ['Which past customers might want a mirror or a second shower?']
    }
  };
  const ALWAYS = ['Nothing goes out until you approve it, or until you turn on auto approve for that agent', 'Works only in your Jobber, your email and QuickBooks'];

  // What to do here: three steps naming the exact tab and buttons, shown at the top of each agent page.
  const DO = {
    'morning-brief': { steps: ['Read the 3 biggest items on the Summary tab', 'Press Read and approve on each, or open the Approve today tab for the rest', 'Loose ends at the bottom: Turn into a request, Remind me, or Done'], idle: 'It reads Jobber every weekday morning. New items show up here by 7am.' },
    'lead-catcher': { steps: ['Open the Reply to enquiries tab', 'Read the reply written for each new enquiry', 'Press Approve and send, or call them yourself'], idle: 'No one is waiting on a reply. New enquiries show up here the same day.' },
    'quotes': { steps: ['Open a job on the To quote tab', 'Check the price, or type the sizes or press Read sizes from a photo', 'Press Create draft quote in Jobber, then send it from Jobber'], idle: 'Nothing to quote. New measures show up here the morning after the visit.' },
    'quote-chaser': { steps: ['Open the Send follow ups tab', 'Read the follow up written for each quote', 'Press Approve and send, or call the big ones yourself'], idle: 'No quote needs a personal follow up. Jobber’s own reminders cover the first week.' },
    'yes-to-install': { steps: ['Open the Order and book jobs tab', 'Check the glass order written for your supplier', 'Press Approve and send, then book the job in Jobber'], idle: 'Every yes is booked. New approvals show up here the same day.' },
    'install-scheduler': { steps: ['Open the Line up installs tab', 'Type the delivery date from the supplier sheet and press Save delivery date', 'Send the install day note, tap the day they pick, then set it in Jobber'], idle: 'Every job has an install day. Jobs waiting on glass show up here.' },
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
