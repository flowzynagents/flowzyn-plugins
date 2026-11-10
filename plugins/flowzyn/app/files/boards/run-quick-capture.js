// Capture Requests: anything asked for on site goes from the owner's phone into Jobber, so it is not forgotten.
// The form creates the request in Jobber, and a draft quote priced from the price book when sizes are given.
FZ.board('quick-capture', {
  source: 'New requests: Jobber, live. Captures: this form, or Claude on your phone.',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const { h } = ui;
    const A = FZ.act;
    const fresh = await ctx.jobberAll('search_requests', { dateRange: { after: fmt.isoDaysAgo(14) }, limit: 50 }, 'requests', 100).catch(() => []);
    const rows = fresh.map((r) => ({ who: fmt.clean(r.client && r.client.name) || 'Customer', what: fmt.clean(r.title || 'Request'), when: r.createdAt, link: r.jobberWebUri }))
      .sort((a, b) => new Date(b.when) - new Date(a.when));
    ctx.metric('quick-capture', { value: fmt.plural(rows.length, 'request') + ' in the last 2 weeks', detail: 'Capture anything asked for on site' });

    // The capture form.
    const book = await A.priceBook();
    const nameIn = h('input', { type: 'text', placeholder: 'Customer name, like Jake', autocomplete: 'off' });
    const pick = h('select', { hidden: true });
    const propSel = h('select', { hidden: true });
    const whatIn = h('input', { type: 'text', placeholder: 'What they want, like mirror for the primary closet' });
    const sizeIn = h('input', { type: 'text', placeholder: 'Sizes in inches, like 44 x 30 (optional)' });
    const preview = h('div', { class: 'sa-math' });
    const msg = h('p', { class: 'fz-hint', role: 'status' });
    const go = h('button', { type: 'button', class: 'fz-btn act' }, 'Capture it in Jobber');
    let clients = [];
    let timer = null;
    nameIn.addEventListener('input', () => {
      clearTimeout(timer);
      const t = nameIn.value.trim();
      if (t.length < 2) { pick.hidden = true; propSel.hidden = true; return; }
      timer = setTimeout(async () => {
        try { clients = await A.findClients(t); } catch (e) { clients = []; }
        pick.replaceChildren(...(clients.length ? clients.map((c) => h('option', { value: c.id }, c.name)) : [h('option', { value: '' }, 'No customer by that name in Jobber')]));
        pick.hidden = false;
        if (clients.length) loadProps();
      }, 350);
    });
    const loadProps = async () => {
      const props = await A.propertiesOf(pick.value).catch(() => []);
      propSel.replaceChildren(...(props.length ? props.map((p) => h('option', { value: p.id }, p.label)) : [h('option', { value: '' }, 'No address on file. Add one in Jobber first.')]));
      propSel.hidden = false;
    };
    pick.addEventListener('change', loadProps);
    const lines = () => A.linesFor(whatIn.value + ' ' + sizeIn.value, book);
    const showPrice = () => {
      const ls = lines();
      preview.replaceChildren(...ls.map((l) => h('div', null, l.name + ': ' + fmt.money(l.unitPrice) + ' (' + l.math + ')')));
    };
    whatIn.addEventListener('input', showPrice); sizeIn.addEventListener('input', showPrice);
    const form = h('div', { class: 'sa-form' },
      h('label', null, 'Customer', nameIn), pick, propSel,
      h('label', null, 'What they asked for', whatIn),
      h('label', null, 'Sizes', sizeIn), h('div', { class: 'sa-row' }, A.photoSizesBtn(sizeIn, () => whatIn.value, msg)), preview,
      h('div', { class: 'sa-row' }, go), msg);
    go.addEventListener('click', async () => {
      if (!pick.value || !propSel.value) { msg.textContent = 'Pick the customer and the address first.'; return; }
      if (!whatIn.value.trim()) { msg.textContent = 'Say what they asked for.'; whatIn.focus(); return; }
      go.disabled = true; msg.textContent = 'Adding it to Jobber…';
      const title = fmt.clean(whatIn.value) + (sizeIn.value.trim() ? ' (' + sizeIn.value.trim() + ' in)' : '');
      try {
        const r = await A.createRequest({ clientId: pick.value, propertyId: propSel.value, title });
        const req = r && (r.request || r);
        const ls = lines();
        if (ls.length && req && req.id) {
          msg.textContent = 'Request added. Drafting the quote…';
          const q = await A.createQuote({ clientId: pick.value, propertyId: propSel.value, title, requestId: req.id, lineItems: ls }, form);
          const link = A.quoteLink(q);
          msg.replaceChildren('Done. The request and a draft quote are in Jobber. Check it and send it from Jobber. ', link ? ui.extLink(link, 'Open the quote', 'fz-tlink') : '');
        } else {
          const link = A.requestLink(r);
          msg.replaceChildren('Done. The request is in Jobber, so it will not be forgotten. Add sizes when you have them and Draft Quotes drafts it. ', link ? ui.extLink(link, 'Open the request', 'fz-tlink') : '');
        }
        whatIn.value = ''; sizeIn.value = ''; preview.replaceChildren();
      } catch (e) { msg.textContent = 'Jobber did not take it: ' + (e && e.message || 'try again') + '.'; }
      go.disabled = false;
    });

    const out = [];
    out.push(ui.status(['Someone asks for something on site? ', { b: 'Capture it here' }, ' and it is a request in Jobber, with a draft quote if you have the sizes.']));
    out.push(ui.section('Capture it', 'Takes 20 seconds. Nothing is sent to the customer.', form));
    if (rows.length) out.push(ui.section('Recent requests', 'Last 2 weeks, newest first', ui.table([
      { label: 'Customer', get: (x) => x.link ? ui.extLink(x.link, x.who, 'fz-tlink') : x.who },
      { label: 'What', get: (x) => x.what },
      { label: 'Added', get: (x) => fmt.fmtDate(x.when) }
    ], rows.slice(0, 12))));
    out.push(ui.note('Photos: take a photo of the drawing and it reads the sizes. Jobber does not let agents attach the photo to the request, so keep it in Jobber yourself if you need it there.'));
    out.push(ui.how('Finds the customer and address in Jobber.', 'Creates the request. With sizes, it drafts the quote ' + (book.method === 'supplier' ? 'from your supplier costs' : 'at your price book') + ' and links it to the request.', 'The quote stays a draft. You check it and send it from Jobber.'));
    return out;
  }
});
