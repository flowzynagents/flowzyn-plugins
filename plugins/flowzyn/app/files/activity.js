/* Activity log: what the shop owner opens and taps in the app, counts only.
   One doc per day: activity/<YYYY-MM-DD> = {views:{screen:n}, taps:{"screen|label":n},
   minutes, sessions, firstAt, lastAt}. Skipped for the artifact owner (Flowzyn) so
   our own testing never counts. Read by the Client Pulse step for HQ. */
(function () {
  'use strict';
  const day = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  const screen = () => { const h = (location.hash || '#overview').slice(1).split(/[?&/]/)[0]; return (h || 'overview').replace(/[^a-z0-9-]/gi, '').slice(0, 40) || 'overview'; };
  // Button words only: no digits, money or long text, so no customer details end up here
  const label = (el) => (el.getAttribute('aria-label') || el.textContent || '').replace(/[$\d#@.,:/()]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 32);
  let pend = { views: {}, taps: {}, minutes: 0, sessions: 0 }, dirty = false, lastAct = Date.now(), db = null, on = false, busy = false;
  const bump = (o, k) => { o[k] = (o[k] || 0) + 1; dirty = true; };

  async function flush() {
    if (!on || !dirty || busy || !db) return;
    busy = true; const p = pend; pend = { views: {}, taps: {}, minutes: 0, sessions: 0 }; dirty = false;
    try {
      const ref = db.doc('activity/' + day()); const s = await ref.get(); const cur = (s && s.exists) ? s.data() : {};
      const add = (a, b) => { const o = Object.assign({}, a || {}); for (const k in b) o[k] = (o[k] || 0) + b[k]; return o; };
      const now = new Date().toISOString();
      await ref.set({ views: add(cur.views, p.views), taps: add(cur.taps, p.taps), minutes: (cur.minutes || 0) + p.minutes, sessions: (cur.sessions || 0) + p.sessions, firstAt: cur.firstAt || now, lastAt: now });
    } catch (e) { /* keep for next flush */ for (const k in p.views) pend.views[k] = (pend.views[k] || 0) + p.views[k]; for (const k in p.taps) pend.taps[k] = (pend.taps[k] || 0) + p.taps[k]; pend.minutes += p.minutes; pend.sessions += p.sessions; dirty = true; }
    busy = false;
  }

  async function start() {
    try {
      const use = window.claude && window.claude.use; if (!use) return;
      const u = await Promise.race([window.claude.use('user'), new Promise((r) => setTimeout(() => r(null), 12000))]);
      if (!u || (!window.FZ_SHOP_COPY && await u.isOwner())) return; // our own views never count; in a shop's own copy the owner is the shop
      db = await window.claude.use('db'); if (!db) return;
      on = true; pend.sessions = 1; bump(pend.views, screen());
      window.addEventListener('hashchange', () => { lastAct = Date.now(); bump(pend.views, screen()); });
      document.addEventListener('click', (e) => { lastAct = Date.now(); const el = e.target && e.target.closest && e.target.closest('button, a, [role="button"], summary, input[type="checkbox"]'); if (!el) return; const l = label(el); if (l) bump(pend.taps, screen() + '|' + l); }, true);
      ['keydown', 'scroll', 'pointermove', 'touchstart'].forEach((t) => window.addEventListener(t, () => { lastAct = Date.now(); }, { passive: true, capture: true }));
      // An active minute: page visible and touched in the last 2 minutes
      setInterval(() => { if (document.visibilityState === 'visible' && Date.now() - lastAct < 120000) { pend.minutes += 1; dirty = true; } }, 60000);
      setInterval(flush, 20000);
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
      setTimeout(flush, 3000);
    } catch (e) { /* the app works the same without it */ }
  }
  start();
})();
