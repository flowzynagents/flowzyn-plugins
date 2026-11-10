// Our Own Permits: jobs with a permit or inspection, and finished work an inspection may be holding up.
FZ.board('own-permits', {
  source: 'Jobs: Jobber, live. Inspection emails: needs Gmail.',
  status: 'setup',
  async render(ctx) {
    const { ui, fmt } = ctx;
    const WORDS = /permit|inspect|commercial|code check|egress/i;
    const [active, finished, toInvoice] = await Promise.all([
      ctx.jobberAll('search_jobs', { status: 'active', limit: 50 }, 'jobs', 100),
      ctx.jobberAll('search_jobs', { completedAt: { after: fmt.isoDaysAgo(60) }, limit: 50 }, 'jobs', 100),
      ctx.jobberAll('search_jobs', { status: 'requires_invoicing', limit: 50 }, 'jobs', 100)
    ]);
    const all = new Map();
    [...toInvoice, ...active, ...finished].forEach((j) => { if (!all.has(j.id)) all.set(j.id, j); });
    const jobs = [...all.values()];

    // Look inside the line items of the jobs whose title does not already say it.
    const toCheck = jobs.filter((j) => !WORDS.test(j.title || '')).slice(0, 25);
    const det = await ctx.pool(toCheck, 4, (j) => ctx.jobber('get_job', { id: j.id }));
    const lineHit = {};
    toCheck.forEach((j, i) => {
      const items = (det[i] && det[i].job && det[i].job.lineItems && det[i].job.lineItems.nodes) || [];
      const hit = items.find((li) => WORDS.test((li.name || '') + ' ' + (li.description || '')));
      if (hit) lineHit[j.id] = fmt.clean(hit.name);
    });
    const permitJobs = jobs.filter((j) => WORDS.test(j.title || '') || lineHit[j.id]);
    const waiting = toInvoice.slice().sort((a, b) => (Number(b.total) || 0) - (Number(a.total) || 0));
    const waitingSum = waiting.reduce((s, j) => s + (Number(j.total) || 0), 0);
    const who = (j) => fmt.clean(j.client && j.client.name);
    const where = (j) => j.property && j.property.address ? [fmt.clean(j.property.address.street1), fmt.clean(j.property.address.city)].filter(Boolean).join(', ') : '';
    const stage = (j) => j.status === 'requires_invoicing' ? 'Finished, not invoiced' : j.completedAt ? 'Finished ' + fmt.fmtDate(j.completedAt) : 'In progress';

    ctx.metric('own-permits', waiting.length
      ? { value: fmt.plural(waiting.length, 'job') + ' to invoice', detail: fmt.money(waitingSum, { short: true }) + ' finished, not invoiced yet' }
      : { value: 'Nothing waiting to invoice', detail: fmt.plural(permitJobs.length, 'job') + ' mention a permit' });

    const preview = [];
    preview.push(ui.section('Jobs that mention a permit or inspection', 'Active and finished in the last 60 days',
      permitJobs.length ? ui.cards(permitJobs.map((j) => ({
        when: stage(j), who: who(j), amount: Number(j.total) || 0, link: j.jobberWebUri,
        why: fmt.clean(j.title) + (lineHit[j.id] ? ', line item ' + lineHit[j.id] : '') + (where(j) ? ' at ' + where(j) : '')
      })), { max: 4 }) : ui.calm('No active or recent job mentions a permit, inspection or commercial work.')));
    if (waiting.length) {
      preview.push(ui.section('Finished, not invoiced yet', 'An open inspection can hold up the final invoice', ui.cards(waiting.map((j) => ({
        when: j.completedAt ? 'Finished ' + fmt.fmtDate(j.completedAt) + ' · ' + fmt.plural(Math.max(0, fmt.daysSince(j.completedAt)), 'day') + ' ago' : 'Finished',
        who: who(j), amount: Number(j.total) || 0, link: j.jobberWebUri,
        why: fmt.clean(j.title) + (WORDS.test(j.title || '') || lineHit[j.id] ? '. Mentions a permit or inspection.' : '. Check if an inspection is still open.')
      })), { max: 4 })));
    }
    preview.push(ui.table([
      { label: 'Job', get: (j) => '#' + j.jobNumber + ' ' + fmt.clean(j.title) },
      { label: 'Customer', get: (j) => who(j) },
      { label: 'Where', get: (j) => where(j) },
      { label: 'Stage', get: (j) => stage(j) },
      { label: 'Permit', get: (j) => WORDS.test(j.title || '') || lineHit[j.id] ? ui.pill('Mentions it', 'hot') : '' },
      { label: 'Total', num: true, get: (j) => fmt.money(j.total) },
      { label: 'Jobber', get: (j) => j.jobberWebUri ? ui.extLink(j.jobberWebUri, 'Open') : '' }
    ], [...permitJobs, ...waiting.filter((j) => !permitJobs.includes(j))], { summary: 'All jobs checked as a list' }));

    const out = [];
    out.push(ui.status(waiting.length
      ? [{ b: String(waiting.length) }, ' finished ' + (waiting.length === 1 ? 'job is' : 'jobs are') + ' waiting on a final invoice.']
      : ['No finished jobs are waiting on a final invoice.']));
    out.push(ui.setup({
      title: 'Connect Gmail to follow inspections',
      text: 'The county sends inspection dates and results by email. Once Gmail is connected, each one is matched to its Jobber job here, so you see which inspections could hold up an invoice.',
      steps: ['Your human Operator connects Gmail to this page, read only.', 'Each morning, new permit and inspection emails are matched to their Jobber job.', 'Jobs with an inspection booked, passed or still open show at the top.'],
      preview: ui.h('div', { style: 'display:flex;flex-direction:column;gap:16px' }, preview)
    }));
    out.push(ui.how('Checks active jobs, jobs finished in the last 60 days and jobs waiting to be invoiced.',
      'A job counts when its title or a line item mentions a permit, an inspection or commercial work. Up to 25 jobs are opened to read their line items.',
      'Finished jobs not invoiced yet are listed too, since a final inspection often comes before the last invoice.'));
    return out;
  }
});
