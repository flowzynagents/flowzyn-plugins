// Review Watch: the shop's reviews against nearby glass shops, with a reply ready for each recent review.
// Reads a snapshot in datasets/local-search (public review pages checked by Flowzyn). Weekly Google checks once Google is switched on.
FZ.board('review-watch', {
  source: 'Public review pages, checked by Flowzyn. Weekly Google checks once your Operator switches on Google.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const { h } = ui;
    const doc = await ctx.store('datasets/local-search').catch(() => null);
    const me = doc && doc.dunlap;
    if (!me) {
      ctx.metric('review-watch', { value: 'Being set up by your Operator', detail: 'Checked every Monday' });
      return [
        ui.status(['Your review check starts once your Operator runs the first one.']),
        ui.setup({ title: 'Your first review check is on its way', text: 'Review Watch reads your reviews and those of nearby glass shops.', steps: ['Your Operator runs the first check.', 'After that it runs every Monday morning.'] }),
        ui.how('Nothing in Jobber shows reviews, so this board waits for the first check.')
      ];
    }
    const g = me.google || {};
    const rivals = (doc.rivals || []).filter((r) => r.google && r.google.count != null);
    const rows = [{ name: FZ.biz(), rating: g.rating, count: g.count, me: true, url: g.url }]
      .concat(rivals.map((r) => ({ name: r.name, rating: r.google.rating, count: r.google.count, url: r.google.url || r.website, town: r.town })))
      .filter((r) => r.count != null).sort((a, b) => b.count - a.count);
    const myRank = rows.findIndex((r) => r.me) + 1;
    const most = rows[0];
    const reviews = (doc.reviews || []).slice().sort((a, b) => (Number(a.rating) || 5) - (Number(b.rating) || 5));
    const low = reviews.filter((r) => r.rating != null && Number(r.rating) < 4);
    const when = doc.checkedAt ? fmt.fmtDate(doc.checkedAt) : '';

    ctx.metric('review-watch', g.rating != null ? { value: g.rating + ' stars from ' + g.count + ' Google reviews', detail: myRank ? '#' + myRank + ' of ' + rows.length + ' nearby shops by reviews' : '' } : { value: 'Reviews checked', detail: when });

    const out = [];
    out.push(ui.status(g.rating != null
      ? [{ b: String(g.rating) }, ' stars from ', { b: String(g.count) }, ' Google reviews. ', myRank === 1 ? 'The most of any glass shop near you.' : (most && !most.me ? most.name + ' has ' + most.count + '. ' + (most.count - g.count) + ' more reviews would put you level.' : '')]
      : [doc.reviewHeadline || 'Your reviews were checked ' + when + '.']));

    const reply = (r) => 'Thank you' + (r.author ? ' ' + r.author : '') + ' for taking the time to write this. ' +
      (r.rating != null && Number(r.rating) < 4 ? 'I am sorry it was not the experience we aim for. I would like to make it right, please call me directly so we can sort it out.' : 'It was a pleasure working with you, and we are glad you are happy with the glass.') +
      '\n\n' + FZ.sign();
    if (reviews.length) out.push(ui.section(low.length ? fmt.plural(low.length, 'review') + ' under 4 stars to answer first' : fmt.plural(reviews.length, 'recent review') + ' with a reply ready', 'A reply within 48 hours shows the next customer you care. Your Operator can post these for you.',
      ui.cards(reviews.slice(0, 5).map((r) => ({
        when: [r.site, r.date, r.rating != null ? r.rating + ' stars' : null].filter(Boolean).join(' · '),
        who: '“' + r.excerpt + '”', flag: r.rating != null && Number(r.rating) < 4,
        link: r.url, linkLabel: 'Open the review',
        draft: reply(r), draftHead: 'Reply to post'
      })), { max: 5 })));

    if (rows.length > 1) out.push(ui.section(myRank === 1 ? 'You have the most reviews nearby' : 'You are #' + myRank + ' of ' + rows.length + ' nearby shops for reviews', 'Google reviews for glass shops near ' + FZ.town() + '. More reviews usually means a higher spot on the map.',
      ui.bars(rows.map((r) => ({ label: r.name, value: r.count, display: r.count + ' reviews' + (r.rating != null ? ' · ' + r.rating + '★' : ''), hi: !!r.me })))));

    out.push(ui.table([
      { label: 'Shop', get: (r) => r.name },
      { label: 'Town', get: (r) => r.me ? FZ.town() : (r.town || '') },
      { label: 'Google rating', num: true, get: (r) => r.rating != null ? String(r.rating) : '' },
      { label: 'Reviews', num: true, get: (r) => String(r.count) },
      { label: 'Source', get: (r) => r.url ? ui.extLink(r.url, 'Open') : '' }
    ], rows, { summary: 'All ' + rows.length + ' shops as a list' }));
    const other = [me.yelp && me.yelp.count != null ? 'Yelp ' + me.yelp.rating + ' from ' + me.yelp.count : null].concat((me.other || []).map((o) => o.site + (o.rating != null ? ' ' + o.rating : '') + (o.count != null ? ' from ' + o.count : ''))).filter(Boolean);
    out.push(ui.how('Ratings and counts are what each public page showed on ' + (when || 'the check date') + '. ' + (other.length ? 'Elsewhere: ' + other.join(', ') + '.' : ''),
      'Replies are never posted from here. Copy one and post it on the review site, or hand it to your Operator.'));
    return out;
  }
});
