// First time setup for a new shop: your name, your website and town, your tools, how it all works, then the dashboard.
// Never asks for a password or key. Tools connect in Claude settings.
(function () {
  const STEPS = ['You', 'Your business', 'Your tools', 'How it works'];

  // Where most of the shop's clients are, from Jobber billing addresses.
  async function guessPlace(ctx) {
    const clients = await ctx.jobberAll('search_clients', { limit: 100 }, 'clients', 200);
    const count = {};
    clients.forEach((c) => {
      const a = c && c.billingAddress;
      if (!a || !a.city) return;
      const k = String(a.city).trim() + (a.province ? ', ' + String(a.province).trim() : '');
      count[k] = (count[k] || 0) + 1;
    });
    const best = Object.entries(count).sort((x, y) => y[1] - x[1])[0];
    return best ? { place: best[0], n: best[1], of: clients.length } : null;
  }

  const cleanSite = (v) => {
    let s = String(v || '').trim();
    if (!s) return '';
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    try { const u = new URL(s); return /\./.test(u.hostname) ? u.origin + (u.pathname === '/' ? '' : u.pathname) : ''; } catch (e) { return ''; }
  };

  FZ.renderWelcome = function (ctx, opts) {
    const { ui } = ctx;
    const { h } = ui;
    const p = Object.assign({}, opts.profile || {});
    let step = Math.min(Number(p.welcomeStep) || 0, STEPS.length - 1);
    const root = h('div', { class: 'wz' });

    const field = (id, label, value, attrs) => {
      const input = h('input', Object.assign({ id, class: 'wz-input', value: value || '', autocomplete: 'off' }, attrs || {}));
      return { input, el: h('div', { class: 'wz-field' }, h('label', { for: id }, label), input) };
    };
    const msg = () => h('p', { class: 'wz-msg', role: 'status' });
    const saveOrSay = async (patch, out) => {
      if (await opts.save(patch)) return true;
      out.textContent = 'Could not save. Check your connection and try again.';
      return false;
    };
    const go = async (n, out) => { if (await saveOrSay({ welcomeStep: n }, out)) { step = n; paint(); } };
    const back = () => { const b = h('button', { type: 'button', class: 'fz-btn ghost' }, 'Back'); b.addEventListener('click', () => { step = Math.max(0, step - 1); paint(); }); return b; };
    const next = (label) => h('button', { type: 'submit', class: 'fz-btn' }, label || 'Next');

    const progress = () => h('ol', { class: 'wz-steps', 'aria-label': 'Setup steps' },
      STEPS.map((s, i) => h('li', { class: i < step ? 'done' : i === step ? 'on' : '', 'aria-current': i === step ? 'step' : null }, h('span', { class: 'n' }, String(i + 1)), h('span', { class: 't' }, s))));

    // 1. Your name and business name
    function stepYou() {
      const a = field('wz-owner', 'Your name', p.owner, { placeholder: 'First and last name', autocomplete: 'name' });
      const b = field('wz-biz', 'Business name', p.business, { placeholder: 'As your customers know it', autocomplete: 'organization' });
      const out = msg();
      const form = h('form', { class: 'wz-form' }, a.el, b.el, out, h('div', { class: 'fz-card-btns' }, next()));
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const owner = a.input.value.trim(), business = b.input.value.trim();
        if (!owner || !business) { out.textContent = 'Add your name and your business name.'; return; }
        p.owner = owner; p.business = business;
        if (await saveOrSay({ owner, business }, out)) go(1, out);
      });
      return [h('h1', { class: 'home' }, 'Welcome to your Flowzyn agents'), h('p', { class: 'wz-lead' }, 'Four quick steps and your agents start working. First, who are we working for?'), form];
    }

    // 2. Website, then the town we found in Jobber
    function stepBiz() {
      const site = field('wz-site', 'Business website', p.website, { placeholder: 'yourbusiness.com', inputmode: 'url' });
      const town = field('wz-town', 'Where you are based', p.place, { placeholder: 'Town, State' });
      const found = h('p', { class: 'wz-found', role: 'status' });
      const out = msg();
      if (!p.place) {
        found.textContent = 'Looking up where your jobs are in Jobber…';
        guessPlace(ctx).then((g) => {
          if (g && !town.input.value) { town.input.value = g.place; found.textContent = 'Most of your clients in Jobber are in ' + g.place + '. Change it if that is not your base.'; }
          else if (!g) found.textContent = 'Type the town your business works from.';
          else found.textContent = '';
        }).catch(() => { found.textContent = 'Type the town your business works from.'; });
      }
      const form = h('form', { class: 'wz-form' }, site.el, town.el, found, out, h('div', { class: 'fz-card-btns' }, back(), next()));
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const website = cleanSite(site.input.value);
        const place = town.input.value.trim();
        if (site.input.value.trim() && !website) { out.textContent = 'That website does not look right. Try yourbusiness.com'; return; }
        if (!place) { out.textContent = 'Add the town you work from. Your agents use it for weather and local searches.'; return; }
        p.website = website; p.place = place;
        if (await saveOrSay({ website, place }, out)) go(2, out);
      });
      return [h('h1', { class: 'home' }, 'Your business'), h('p', { class: 'wz-lead' }, 'Your agents use your town for the weather on job days and for local searches.'), form];
    }

    // 3. Connect your tools (core tools only here, growth data later on the Connect tab)
    function stepTools() {
      const out = msg();
      const core = FZ.SETUP.filter((s) => s.group === 'core');
      const done = (id) => FZ.setupDone(id, opts.setup);
      const rows = h('div', { class: 'wz-tools' });
      const paintRows = () => rows.replaceChildren(...core.map((s) => {
        const on = done(s.id);
        const viaAlt = !(opts.setup[s.id] || {}).done && s.alt && done(s.alt) && !s.always;
        const btn = s.always ? null : h('button', { type: 'button', class: 'fz-btn' + (on ? ' ghost' : '') }, on ? (viaAlt ? 'Not needed' : 'Undo') : 'I connected it');
        if (btn && !viaAlt) btn.addEventListener('click', async () => {
          btn.disabled = true;
          if (!(await opts.saveSetup(s.id, on ? { done: false, mode: null } : { done: true, mode: 'own' }))) out.textContent = 'Could not save. Try again.';
          paintRows();
        });
        if (viaAlt && btn) btn.disabled = true;
        return h('div', { class: 'wz-tool' + (on ? ' on' : '') },
          h('span', { class: 'cn-logo', 'aria-hidden': 'true' }, s.name.slice(0, 1)),
          h('div', { class: 'wz-tool-t' }, h('b', null, s.name), h('span', null, s.always ? 'Connected. Your agents read it every time you open them.' : s.what)),
          h('span', { class: 'cn-state ' + (on ? 'green' : 'amber') }, h('span', { class: 'dot ' + (on ? 'green' : 'amber') }), on ? 'Connected' : 'Not yet'),
          btn);
      }));
      paintRows();
      const form = h('form', { class: 'wz-form' },
        h('ol', { class: 'wz-list' }, h('li', null, 'Open ', ui.extLink('https://claude.ai/settings/connectors', 'Claude connectors'), ' in a new tab.'), h('li', null, 'Press Connect on your email (Gmail or Microsoft 365) and on QuickBooks, and sign in.'), h('li', null, 'Come back here and press I connected it on each one.')),
        rows, out,
        h('p', { class: 'fz-hint' }, 'Builder contact data like Apollo comes later, on the Connect tab. You can finish any of this later too.'),
        h('div', { class: 'fz-card-btns' }, back(), next('Next')));
      form.addEventListener('submit', (e) => { e.preventDefault(); go(3, out); });
      return [h('h1', { class: 'home' }, 'Connect your tools'), h('p', { class: 'wz-lead' }, 'Your agents work inside the tools you already use. Nothing new for your team to learn.'), form];
    }

    // 4. How it works: a short explainer, or Flowzyn's video when one is set
    function stepHow() {
      const out = msg();
      const name = p.business || 'your business';
      const SCENES = [
        { k: 'tools', t: 'Your tools', d: 'Jobber, your email and QuickBooks. Everything already lives here.' },
        { k: 'agents', t: 'Your agents read them', d: 'Every morning they look for quotes going quiet, money owed and jobs that need a check.' },
        { k: 'work', t: 'They do the office work', d: 'Follow ups, reminders and notes are written and waiting in your inbox.' },
        { k: 'person', t: 'A real person for the rest', d: 'When something needs a phone call, a manual step or a judgment call, your agents hand it to a human Operator.' },
        { k: 'you', t: 'You stay in charge', d: 'Drafts wait for you or your team to send. Nothing goes out on its own.' }
      ];
      const video = p.explainerVideo || (FZ.EXPLAINER && FZ.EXPLAINER.url);
      let i = 0, timer = null;
      const stage = h('div', { class: 'ex-stage', 'aria-live': 'polite' });
      const dots = h('div', { class: 'ex-dots' });
      const node = (cls, label, sub) => h('div', { class: 'ex-node ' + cls }, h('b', null, label), sub ? h('span', null, sub) : null);
      const art = (k) => {
        if (k === 'tools') return h('div', { class: 'ex-row' }, node('t', 'Jobber', 'Quotes and jobs'), node('t', 'Email', 'Gmail or Outlook'), node('t', 'QuickBooks', 'Payments'));
        if (k === 'agents') return h('div', { class: 'ex-row' }, node('t dim', 'Jobber'), h('span', { class: 'ex-flow' }), node('a', 'Agents', FZ.AGENTS.length + ' working for ' + name), h('span', { class: 'ex-flow' }), node('t dim', 'Email'));
        if (k === 'work') return h('div', { class: 'ex-col' }, node('c', 'Follow up drafted', 'Quote from last week, ready to send'), node('c', 'Reminder drafted', 'Invoice past due, ready to send'), node('c', 'Job flagged', 'Snow on install day, call the client'));
        if (k === 'person') return h('div', { class: 'ex-row' }, node('a', 'Agents', 'Do the work'), h('span', { class: 'ex-flow' }), node('c', 'Exception', 'Needs a call'), h('span', { class: 'ex-flow' }), node('p', 'Operator', 'Picks it up'));
        return h('div', { class: 'ex-row' }, node('c', 'Draft ready'), h('span', { class: 'ex-flow' }), node('y', 'You', 'Check and send'), h('span', { class: 'ex-flow' }), node('t', 'Paid', 'More work won'));
      };
      const show = (n) => {
        i = n;
        const s = SCENES[i];
        stage.replaceChildren(h('div', { class: 'ex-scene' }, h('p', { class: 'ex-n' }, (i + 1) + ' of ' + SCENES.length), h('h2', null, s.t), h('p', { class: 'ex-d' }, s.d), art(s.k)));
        dots.replaceChildren(...SCENES.map((_, j) => { const b = h('button', { type: 'button', class: 'ex-dot' + (j === i ? ' on' : ''), 'aria-label': 'Part ' + (j + 1) }); b.addEventListener('click', () => { stop(); show(j); }); return b; }));
      };
      const stop = () => { if (timer) clearInterval(timer); timer = null; play.textContent = 'Play'; };
      const start = () => { stop(); timer = setInterval(() => { if (!stage.isConnected) return stop(); if (i >= SCENES.length - 1) return stop(); show(i + 1); }, 4500); play.textContent = 'Pause'; };
      const play = h('button', { type: 'button', class: 'fz-btn ghost' }, 'Pause');
      play.addEventListener('click', () => { if (timer) stop(); else { if (i >= SCENES.length - 1) show(0); start(); } });
      const done = h('button', { type: 'button', class: 'fz-btn' }, 'Go to my dashboard');
      done.addEventListener('click', async () => {
        done.disabled = true;
        stop();
        if (await saveOrSay({ onboardedAt: new Date().toISOString(), welcomeStep: null }, out)) opts.finish();
        else done.disabled = false;
      });
      let body;
      if (video) {
        body = h('video', { class: 'ex-video', src: video, controls: true, playsinline: true, preload: 'metadata' });
      } else {
        show(0);
        let reduce = false; try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* default motion */ }
        if (!reduce) start(); else play.textContent = 'Play';
        body = h('div', { class: 'ex' }, stage, h('div', { class: 'ex-ctl' }, dots, play));
      }
      return [h('h1', { class: 'home' }, 'How your agents work'), h('p', { class: 'wz-lead' }, 'Under a minute. Then your dashboard.'), body, out, h('div', { class: 'fz-card-btns' }, back(), done)];
    }

    function paint() {
      const views = [stepYou, stepBiz, stepTools, stepHow];
      root.replaceChildren(h('div', { class: 'wz-card' }, progress(), ...views[step]().filter(Boolean)));
      const first = root.querySelector('input, button.fz-btn:not(.ghost)');
      if (first && step < 3) { try { first.focus({ preventScroll: true }); } catch (e) { /* focus is a nicety */ } }
    }
    paint();
    return [root];
  };
})();
