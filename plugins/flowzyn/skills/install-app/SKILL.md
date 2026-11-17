---
name: install-app
description: Use from Set up Flowzyn, from the morning run, or when the owner says "Update my Flowzyn app". Puts the Flowzyn agents app in the owner's own Claude, or updates it to the current version.
---

# Install or update the Flowzyn agents app

The app is the shop's own screens: Overview, Tasks, Agents and Connect. It lives in the owner's own Claude account as an artifact named "Flowzyn Agents", so it reads their own Jobber with their own connector, and the morning run writes what the agents did into its storage. Flowzyn never sees their logins.

The artifact is one small page, the shell, given in full below. It loads one exact version of the Flowzyn app code, named in the shell, and the browser checks that code against the fingerprint in the shell and refuses to run it if it differs. It never loads anything newer by itself: a new version only arrives when this skill carries a new shell and you publish it here. There are no app files to find on this computer, everything you need is in this skill.

## 1. Find their app
List the owner's own artifacts and look for one titled "Flowzyn Agents". If there is one, read its page.

## 2. Already current?
If its page contains `window.FZ_SHELL = 'pinned-1.0.5'`, it is current: pin it (see Pin it) and stop. Nothing else to do.

## 3. New install (no app yet)
1. Publish the page under "The shell" below, exactly as written, as a new artifact. Title "Flowzyn Agents", icon "Grid".
2. Declare its capabilities with the JSON under "Capabilities" below, using the version the publish returned as the base version.
3. Copy the shop profile into the app's storage, so the app never asks the owner who they are. Call `flowzyn_status` and set the document `settings/profile` to `{ business, owner, place, website, trade, services, timeZone, onboardedAt: now, welcomeStep: null }` from its `profile` (`owner` is the owner's first name). Leave out anything you don't have. If the document already exists, only fill the fields that are empty.
4. Pin it (see Pin it).
5. Tell the owner in one line that their Flowzyn app is ready and where it lives (under Pinned in the left sidebar if the pin worked, otherwise under Artifacts), and open it. The first time it opens, Claude asks them to allow Jobber, email and books for it. Tell them to allow each one.
6. A new app is empty until the agents have run. Unless a morning run is already under way in this chat, run the Flowzyn morning run now with the morning-run skill, straight away, without asking. The owner must never wait a day to see their agents working.

## 4. Update (an app without the current shell)
This covers an older app with its code in its own files, an app on an earlier shell, and an app on a shell that loads whatever version is live. Each one moves to the shell below.
1. Read its declaration. If it differs from the JSON under "Capabilities", declare that JSON first.
2. Replace the artifact's page (`index.html`) with the page under "The shell", exactly as written, with the live version as the base version. Change only the page. Leave every other file the artifact has: the old script files are simply not used any more. Their saved settings, goal, templates and finished tasks stay, they live in the app's own storage, not in its files.
3. If `settings/profile` in the app's storage has no `trade` or no `timeZone`, fill them from `flowzyn_status`, the same way as a new install.
4. Pin it (see Pin it).
5. Say one line in the morning brief: "Your Flowzyn app was updated."

## Pin it
Pin the "Flowzyn Agents" artifact to the owner's sidebar, so it is one click away under Pinned. Pinning one that is already pinned changes nothing, so do it every time. If pinning isn't available here, skip it and carry on.

## Rules
- Publish the shell exactly as written. Never rewrite it, shorten it or add to it, and never change its version or fingerprint.
- Never publish it anywhere but the owner's own account, and never share it.
- If artifacts can't be published here, say the app needs a Claude plan with artifacts, tell Flowzyn with `tell_flowzyn`, and carry on with the rest of the run.
- If a publish fails, try once more, then tell Flowzyn and carry on. Never leave the run half done because of the app.

## The shell
```html
<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="claude:viewport-fit-sides" content="cover">
<title>Flowzyn Agents</title>
<style>html,body{margin:0;background:#0f1218;color:#f5f3ef;font:15px Inter,system-ui,sans-serif}#fz-boot{padding:48px 20px;text-align:center;color:#9aa0aa}</style>
</head><body>
<div id="fz-boot">Opening your Flowzyn app</div>
<script>
(function () {
  // Loads one exact version of the Flowzyn app code and nothing newer. The browser checks the code against
  // the fingerprint below and refuses to run it if it differs.
  var VERSION = '1.0.5', FINGERPRINT = 'sha384-1q0sYqyLMlBpM6ba9T2lltCbo9tjMBJ6XXmsi7yhdQXhWLq3x08Z7BsMcmdGl3tV';
  window.FZ_SHELL = 'pinned-1.0.5'; window.FZ_PINNED = true;
  var sources = ['https://cdn.jsdelivr.net/npm/flowzyn-agents-app@' + VERSION + '/bundle.js', 'https://unpkg.com/flowzyn-agents-app@' + VERSION + '/bundle.js'];
  function next(i) {
    if (window.__FZ_BUNDLE__) return;
    if (i >= sources.length) { document.getElementById('fz-boot').textContent = 'Your Flowzyn app could not open. Close it and open it again.'; return; }
    var done = false, s = document.createElement('script');
    var move = function () { if (done) return; done = true; if (!window.__FZ_BUNDLE__) { s.remove(); next(i + 1); } };
    s.src = sources[i]; s.integrity = FINGERPRINT; s.crossOrigin = 'anonymous'; s.onerror = move;
    s.onload = function () { done = true; window.FZ_SOURCE = sources[i]; var b = document.getElementById('fz-boot'); if (b) b.remove(); };
    setTimeout(move, 15000);
    document.body.appendChild(s);
  }
  next(0);
})();
</script>
</body></html>
```

## Capabilities
```json
{
  "db": { "rules": [
    { "path": "", "read": "interact", "write": "admin" },
    { "path": "setup", "write": "interact" },
    { "path": "tasks", "write": "interact" },
    { "path": "pipeline", "write": "interact" },
    { "path": "exceptions", "write": "interact" },
    { "path": "settings/goals", "write": "interact" },
    { "path": "settings/profile", "write": "interact" },
    { "path": "settings/pricebook", "write": "interact" },
    { "path": "settings/schedule", "write": "interact" },
    { "path": "settings/budget", "write": "interact" },
    { "path": "settings/autoapprove", "write": "interact" },
    { "path": "settings/templates", "write": "interact" },
    { "path": "settings/template-lost-quote-revival", "write": "interact" },
    { "path": "campaigns", "write": "interact" },
    { "path": "bills", "write": "interact" },
    { "path": "activity", "write": "interact" }
  ] },
  "mcp": { "servers": [
    { "server": "Jobber", "tools": ["search_quotes", "get_quote", "search_jobs", "get_job", "search_invoices", "search_visits", "search_requests", "get_request", "search_clients", "get_client", "search_properties", "search_products_and_services", "create_request", "create_quote"] },
    { "server": "Flowzyn", "tools": ["flowzyn_status", "get_agent_instructions", "hand_to_operator", "tell_flowzyn"] },
    { "server": "flowzyn", "tools": ["flowzyn_status", "get_agent_instructions", "hand_to_operator", "tell_flowzyn"] },
    { "server": "Intuit QuickBooks", "tools": ["company_info"] },
    { "server": "Xero", "tools": ["get_organisation_info"] },
    { "server": "Gmail", "tools": ["search_threads", "search_messages"] },
    { "server": "Microsoft 365", "tools": ["outlook_email_search"] }
  ] },
  "sample": { "images": true },
  "user": {}
}
```
