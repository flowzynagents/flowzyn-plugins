// Local Search Check: where the shop shows up when people nearby search, and the fixes worth making this month.
// Reads a snapshot in datasets/local-search (web results checked by Flowzyn). Map pack rankings come once Google is switched on.
FZ.board('local-search-check', {
  source: 'Google Maps results (Google Places) and your public listings, checked monthly by Flowzyn.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const { h } = ui;
    const doc = await ctx.store('datasets/local-search').catch(() => null);
    const searches = ((doc && doc.searches) || []).map((s) => Object.assign({}, s, { dunlapPosition: s.dunlapPosition != null ? s.dunlapPosition : (s.yourPosition != null ? s.yourPosition : null), results: (s.results || []).map((r) => Object.assign({}, r, { isDunlap: r.isDunlap != null ? r.isDunlap : !!r.isYou })) }));
    if (!searches.length) {
      ctx.metric('local-search-check', { value: 'First search check running', detail: 'Checked once a month' });
      // Example: before and after for the main search. Made up, and labelled so.
      const q = FZ.w.kind + ' ' + FZ.town();
      const side = (when, big, sub, hi) => h('div', { class: 'ls-ba' + (hi ? ' hi' : '') }, h('span', { class: 'ls-ba-w' }, when), h('b', null, big), h('span', null, sub));
      const example = h('section', { class: 'fz-sec ls-ex', 'aria-label': 'Example, not your data' },
        h('div', { class: 'ls-ex-top' }, h('h2', { class: 'fz-h2' }, 'Example: what week 2 looks like'), h('span', { class: 'ls-ex-tag' }, 'Example')),
        h('p', { class: 'fz-sub' }, 'Made up, searching \u201c' + q + '\u201d. Your real spot replaces this.'),
        h('div', { class: 'ls-pair' },
          side('First check', 'Not in top 8', 'Another shop (example) shows first'),
          h('span', { class: 'ls-arrow', 'aria-hidden': 'true' }, '\u2192'),
          side('Week 2', '#5', 'Up from not in the top 8', true)),
        h('ul', { class: 'ls-done' },
          h('li', null, 'Opening hours fixed on Google'),
          h('li', null, 'Your main services added to the profile'),
          h('li', null, 'Phone and address matched on Yelp')),
        h('style', null, '.ls-ex{border:1px dashed var(--line);border-radius:14px;padding:18px 20px;color:var(--muted)}.ls-ex-top{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.ls-ex .fz-h2{margin:0;color:var(--muted)}.ls-ex-tag{font:700 11px/1 var(--font);letter-spacing:.06em;text-transform:uppercase;border:1px solid var(--line);border-radius:999px;padding:5px 9px;color:var(--muted)}.ls-pair{display:grid;grid-template-columns:minmax(0,1fr) 40px minmax(0,1fr);align-items:stretch;gap:8px;margin-top:12px}.ls-ba{border:1px solid var(--line);border-radius:12px;padding:16px;display:flex;flex-direction:column;gap:6px;background:var(--quiet)}.ls-ba b{font:800 28px/1.1 var(--font);color:var(--meta,var(--fg))}.ls-ba span{font-size:13px}.ls-ba-w{font-weight:700;text-transform:uppercase;letter-spacing:.05em;font-size:11px!important}.ls-ba.hi{border-color:var(--accent)}.ls-ba.hi b{color:var(--accent);font-size:40px}.ls-arrow{align-self:center;text-align:center;font-size:22px}.ls-done{margin:14px 0 0;padding-left:20px;font-size:14px;line-height:1.7}@media(max-width:520px){.ls-ex{padding:14px}.ls-pair{grid-template-columns:1fr}.ls-arrow{transform:rotate(90deg)}.ls-ba b{font-size:24px}}'));
      const K = FZ.kit;
      example.classList.remove('fz-sec', 'ls-ex');
      return [
        ui.status(['Checking where you show up in ', { b: '5 local searches' }, '.']),
        K.how(h, 'It checks where you show up when people nearby search, and picks the fixes that move you up.'),
        K.quiet(h,
          K.checked(h, 'First search check running', ['Searches set for ' + FZ.town(), 'Checked once a month, on the 1st', 'Each fix comes with where to go and the words to paste']),
          K.example(h, 'From not in the top 8 to #5', [...example.childNodes].slice(1))),
        ui.how('Searches are the ones a customer near ' + FZ.town() + ' would type, checked on the first of each month.', 'Each check lists who shows up above you and the three fixes most likely to move you up. You make each fix on Google, or hand it to your Operator.')
      ];
    }
    const N = 8;
    const found = searches.filter((s) => s.dunlapPosition);
    const best = found.slice().sort((a, b) => a.dunlapPosition - b.dunlapPosition)[0];
    const missing = searches.filter((s) => !s.dunlapPosition);
    const fixes = (doc.fixes || []).slice(0, 3);
    const when = doc.checkedAt ? fmt.fmtDate(doc.checkedAt) : '';

    ctx.metric('local-search-check', { value: 'Found in ' + found.length + ' of ' + searches.length + ' searches', detail: best ? 'Best #' + best.dunlapPosition + ' for ' + best.query : 'Not in the top ' + N + ' yet' });

    const listings = doc.listings || [];
    const wrong = listings.filter((l) => !l.ok);
    const K = FZ.kit;
    const out = [];
    out.push(ui.status(found.length && searches.length === 1
      ? ['You rank ', { b: '#' + best.dunlapPosition }, ' for “' + best.query + '”.']
      : found.length
      ? ['You show up in ' + found.length + ' of ' + searches.length + ' local searches. ', { b: 'Best is #' + best.dunlapPosition }, ' for “' + best.query + '”.']
      : ['You are not in the top ' + N + ' for the ' + searches.length + ' searches people nearby use. ', fixes.length ? { b: fmt.plural(fixes.length, 'fix', 'fixes') + ' move you up first.' } : '']));
    out.push(K.how(h, 'It checks where you show up when people nearby search, and picks the fixes that move you up.'));

    // Hero: one row per search, a box per spot in the top 8, yours in orange.
    const grid = h('div', { class: 'ls-grid' }, searches.map((sx) => h('div', { class: 'ls-row' },
      h('span', { class: 'ls-q' }, sx.query),
      h('span', { class: 'ls-spots' }, Array.from({ length: N }, (_, i) => {
        const r = (sx.results || []).find((x) => x.position === i + 1);
        const me = sx.dunlapPosition === i + 1;
        return h('span', { class: 'ls-spot' + (me ? ' me' : ''), title: r ? '#' + (i + 1) + ' ' + r.name : '#' + (i + 1) }, String(i + 1));
      })),
      h('span', { class: 'ls-pos' + (sx.dunlapPosition ? '' : ' miss') }, sx.dunlapPosition ? '#' + sx.dunlapPosition : 'Not in top ' + N))),
      h('style', null, LS_CSS));
    out.push(K.hero(h, {
      eyebrow: when ? 'Checked ' + when : 'This month',
      title: found.length ? (missing.length ? [{ b: missing.length + ' of ' + searches.length }, ' searches still miss you'] : ['You show up in ', { b: 'every search' }]) : ['Not in the top ' + N + ' yet for ', { b: fmt.plural(searches.length, 'search', 'searches') }],
      sub: 'Each row is a search someone near you types. Your spot is orange.',
      viz: grid,
      did: [
        { t: 'Checked ' + fmt.plural(searches.length, 'search', 'searches'), s: when ? 'Checked ' + when : 'Listings checked' },
        listings.length ? { t: 'Checked ' + fmt.plural(listings.length, 'listing'), s: wrong.length ? wrong.length + ' send customers the wrong way' : 'All match' } : null,
        fixes.length ? { t: 'Picked the ' + fmt.plural(fixes.length, 'fix', 'fixes') + ' most likely to move you up' } : null,
        { t: 'Next check on the 1st', s: 'Same searches, so you see real moves', done: false }
      ].filter(Boolean)
    }));
    // Needs you: the fixes, one button each to hand it to the Operator.
    const split = (t) => { const m = String(t).match(/^(.{12,}?)[;:]\s+(.*)$/) || String(t).match(/^(.{12,90}?\.)\s+(.*)$/); return m ? [m[1].replace(/\.$/, ''), m[2].charAt(0).toUpperCase() + m[2].slice(1)] : [t, null]; };
    // Directories and review sites are where customers look, not competitors.
    const NOT_SHOP = /(\bTX\b|Texas|\d+[- ]?inch|Breckenridge 21|\b(ebay|wikipedia|amazon|etsy|zoro|pdf|product|oembed|lighting gallery|ule group|quoizel|moon|list of|down to bid|steakhouse|brauerei|pint)\b)/i;
    const TRADE = /\b(glass|glazing|window|windows|door|doors|mirror|shower)\b/i;
    const DIR = /\b(bbb|better business|yelp|yellow ?pages|yp\.com|angi|angie|homeadvisor|thumbtack|mapquest|facebook|nextdoor|houzz|porch|manta|google|bing|apple maps|chamber of commerce|superpages|citysearch|reddit|tripadvisor|bark|buildzoom|networx)\b/i;
    const isShop = (r, sx) => !r.isDunlap && r.position !== sx.dunlapPosition && r.name && !DIR.test(r.name + ' ' + (r.url || '')) && !NOT_SHOP.test(r.name + ' ' + (r.url || '')) && TRADE.test(r.name);
    const shops = (sx) => (sx.results || []).filter((r) => isShop(r, sx));
    const table = ui.table([
      { label: 'Search', get: (sx) => sx.query },
      { label: 'Your spot', get: (sx) => sx.dunlapPosition ? '#' + sx.dunlapPosition : 'Not in top ' + N },
      { label: 'Top business', get: (sx) => { const r = shops(sx)[0]; return r ? (r.url ? ui.extLink(r.url, '#' + r.position + ' ' + r.name) : '#' + r.position + ' ' + r.name) : 'Only directories'; } },
      { label: 'Next', get: (sx) => { const r = shops(sx)[1]; return r ? '#' + r.position + ' ' + r.name : ''; } }
    ], searches, { open: true });
    // Every fix must be doable (Matt, Nov 7): a do it yourself path with the exact place to go and the words ready to paste,
    // a Done button, and the Operator for anyone without the time. No Operator yet: the button says how to get one.
    if (fixes.length) {
      const A = FZ.act;
      const biz = FZ.biz(), town = FZ.town();
      const T = (FZ.tasksNow && FZ.tasksNow().done) || {};
      const kindOf = (t) => /yelp/i.test(t) ? 'yelp' : /review/i.test(t) ? 'reviews' : /google|services|description|profile|hours|category/i.test(t) ? 'google' : /yellow ?pages|yp\.com|bbb|facebook|listing/i.test(t) ? 'listing' : 'other';
      const PLAN = {
        google: { mins: 'About 5 minutes', open: ['Open your Google profile', 'https://business.google.com/'], copy: ['Copy the wording', () => biz + ' does ' + FZ.w.services + ' in ' + town + (FZ.region() !== town ? ' and around ' + FZ.region() : '') + '. Free measures, quotes within the week.'], how: 'In your Google profile press Edit profile, then Services and Description, and paste.' },
        yelp: { mins: 'About 10 minutes', open: ['Open Yelp for Business', 'https://biz.yelp.com/'], copy: ['Copy the message to Yelp', (f) => 'Hi Yelp, ' + biz + ' has two pages. The old page is closed and still holds our reviews. Please merge it into our current page so the reviews show in one place. Old page: ' + (f.url || '[link]') + '. Thank you.'], how: 'Sign in, open Support, choose Duplicate listing, and paste the message.' },
        listing: { mins: 'About 10 minutes', open: ['Open the listing', null], copy: ['Copy the right details', () => biz + ', ' + town + ', CO. ' + ((FZ.profile() || {}).phone || '') ], how: 'Use Claim or Suggest an edit on the listing and paste the right name, phone and address.' },
        reviews: { mins: 'About 1 minute', agent: ['Send the review asks', '#a-review-ask'], how: 'Your Get Reviews agent has the asks written. Approve them there.' },
        other: { mins: 'About 10 minutes', open: ['Open the page', null], how: null }
      };
      out.push(K.needs(h, {
        title: [fmt.plural(fixes.length, 'fix', 'fixes') + ' that move you up, ', { b: 'biggest first' }],
        items: fixes.map((f, i) => {
          const [t, d] = split(f.text); const k = kindOf(f.text); const pl = PLAN[k]; const id = 'ls-fix-' + i;
          const done = (T[id] || {}).done;
          const acts = [];
          if (pl.agent) acts.push(h('a', { class: 'fz-btn act', href: pl.agent[1] }, pl.agent[0]));
          if (pl.open) { const url = pl.open[1] || f.url; if (url) acts.push(ui.extLink(url, pl.open[0], 'fz-btn act')); }
          if (pl.copy && A) acts.push(A.copyBtn(pl.copy[0], () => pl.copy[1](f)));
          const mark = h('button', { type: 'button', class: 'fz-btn', disabled: done || null }, done ? 'Done' : 'Mark done');
          if (!done) mark.addEventListener('click', async () => { mark.disabled = true; const ok = FZ.saveTask ? await FZ.saveTask(id, true) : false; mark.textContent = ok ? 'Done' : 'Could not save'; if (!ok) mark.disabled = false; });
          acts.push(mark);
          // The Operator button hands it over, or offers an Operator when the shop has none yet.
          acts.push(FZ.opButton({ id: 'fix-' + i, title: 'Fix: ' + f.text, link: f.url || null, agent: 'local-search-check' }) || ui.extLink(FZ.opUrl ? FZ.opUrl('Local search fix: ' + t) : 'https://cal.com/flowzyn/flowzyn-15', 'No time? Get an Operator to do it', 'fz-tlink'));
          return { title: t, meta: [{ b: 'Fix ' + (i + 1) }, ' · ' + pl.mins + (done ? ' · done' : '')], detail: [d, pl.how].filter(Boolean).join(' '), actions: acts };
        }),
        rest: doc.fixes && doc.fixes.length > 3 ? { count: doc.fixes.length - 3, label: (FZ.hasOperator && FZ.hasOperator()) ? 'smaller fixes your Operator handles on their own' : 'smaller fixes, after these three' } : null
      }));
    }
    out.push(h('style', null, '.ag-need .ag-row{grid-template-columns:28px minmax(0,1fr)}.ag-need .ag-act{grid-column:2;flex-wrap:wrap;margin-top:4px}'));
    // Who beats you: every business that shows up in these searches, ranked by how many searches they win, with their best spot.
    const shortName = (n) => String(n || '').replace(/\s*[-|:(].*$/, '').trim();
    const comp = new Map();
    searches.forEach((sx, si) => shops(sx).forEach((r) => {
      const k = shortName(r.name).toLowerCase(); if (!k) return;
      const c = comp.get(k) || { name: shortName(r.name), url: r.url || null, best: 99, wins: new Set(), above: 0 };
      c.best = Math.min(c.best, r.position || 99); c.wins.add(si);
      if (!sx.dunlapPosition || (r.position || 99) < sx.dunlapPosition) c.above++;
      if (!c.url && r.url) c.url = r.url; comp.set(k, c);
    }));
    const rivals = [...comp.values()].sort((a, b) => b.wins.size - a.wins.size || a.best - b.best).slice(0, 8);
    if (rivals.length) {
      const maxW = Math.max(...rivals.map((r) => r.wins.size));
      out.push(ui.section(fmt.plural(rivals.length, 'business', 'businesses') + ' also show up', 'Competitors customers see for the searches above, with their best spot. Directories like Yelp and Angi are left out. Google Maps results are added once your Operator switches on Google.',
        h('div', { class: 'ls-comp' }, rivals.map((r, i) => h('div', { class: 'ls-crow' },
          h('span', { class: 'ls-cn' }, String(i + 1)),
          h('span', { class: 'ls-cname' }, r.url ? ui.extLink(r.url, r.name, 'fz-tlink') : r.name,
            h('small', null, searches.filter((_, si) => r.wins.has(si)).map((sx) => sx.query).slice(0, 3).join(' · '))),
          h('span', { class: 'ls-cspots', 'aria-label': 'Best spot ' + r.best }, Array.from({ length: N }, (_, k) => h('i', { class: k + 1 === r.best ? 'on' : '' }))),
          h('span', { class: 'ls-cstat' }, h('b', null, '#' + r.best), ' best spot', r.above ? ' · above you in ' + fmt.plural(r.above, 'search', 'searches') : '')))),
        h('style', null, '.ls-comp{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:12px;background:var(--card)}.ls-crow{display:grid;grid-template-columns:24px minmax(0,1.6fr) minmax(80px,1fr) auto;gap:14px;align-items:center;padding:12px 16px;border-top:1px solid var(--line)}.ls-crow:first-child{border-top:0}.ls-cn{color:var(--muted);font-size:12px}.ls-cname{font-weight:600;font-size:14px;min-width:0}.ls-cname small{display:block;font-weight:400;color:var(--muted);font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.ls-cspots{display:flex;gap:4px}.ls-cspots i{width:18px;height:18px;border-radius:5px;border:1px solid var(--line)}.ls-cspots i.on{background:var(--bar,#6b7280);border-color:transparent}.ls-crow:first-child .ls-cspots i.on{background:var(--accent)}.ls-cstat{font-size:13px;color:var(--muted);white-space:nowrap}.ls-cstat b{color:var(--fg)}@media(max-width:620px){.ls-crow{grid-template-columns:20px minmax(0,1fr)}.ls-cspots,.ls-cstat{grid-column:2}}')));
    }
    out.push(ui.how('Spots are Google Maps results for searches near ' + FZ.town() + ', checked ' + (when || 'by hand') + '.',
      'Each month the same searches run again, so a move up or down is a real change.'));
    return out;
  }
});
const LS_CSS = '.ls-grid{display:flex;flex-direction:column;gap:10px}.ls-row{display:grid;grid-template-columns:minmax(0,1.3fr) auto 96px;gap:14px;align-items:center}.ls-q{font-weight:600;font-size:14px}.ls-spots{display:flex;gap:4px}.ls-spot{width:28px;height:28px;border-radius:6px;border:1px solid var(--line);display:inline-flex;align-items:center;justify-content:center;font-size:12px;color:var(--muted)}.ls-spot.me{background:var(--accent);border-color:var(--accent);color:var(--on-accent);font-weight:700}.ls-pos{font-weight:700;text-align:right;font-size:14px}.ls-pos.miss{color:var(--muted);font-weight:500;font-size:13px}@media(max-width:620px){.ls-row{grid-template-columns:1fr auto}.ls-spots{grid-column:1/-1;grid-row:2}.ls-spot{width:24px;height:24px}}' +
  '.ag-act .fz-btn{min-height:36px;padding:0 14px;font-size:14px;white-space:nowrap}.ag-act .fz-btn.act{background:var(--accent);color:var(--on-accent,#111)!important}.ag-act .fz-btn.act svg{stroke:currentColor}.ag-act .fz-btn.opbtn.act{border:1.5px solid var(--accent)}.ag-act .fz-tlink{font-size:13px;color:var(--muted);font-weight:500}.ag-more details > div{margin-top:12px}';
