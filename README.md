# Flowzyn plugin marketplace

This folder becomes its own GitHub repo (suggested `flowzynagents/flowzyn-plugins`). Shops add it in Claude under Customize, Plugins, Add marketplace.

Assume anyone can read it. It holds thin skills that point at the Flowzyn connector, and the shop's copy of the agents app (`plugins/flowzyn/app`, the screens only). The agent run steps, keys and licence live in the connector (private repo `flowzynagents/flowzyn-connector`), which only answers shops with an active Flowzyn licence. Without a licence the skills do nothing and the app is a read only view of the shop's own Jobber.

## What a shop installs
`flowzyn` plugin:
- the Flowzyn connector (`.mcp.json`), signed in with the shop's licence key
- `set-up-flowzyn`: checks the apps already connected (Jobber, QuickBooks or Xero, Gmail or Outlook) and reuses them, fills the shop profile from their data for a yes, switches agents on, creates the morning run
- `morning-run`: the daily scheduled run of every agent that's on. It also tells Flowzyn how much the app was used each day (visits, minutes, screens opened, buttons tapped, emails approved and sent). Counts only, never customer details
- `run-agent`: one agent on request
- `tell-flowzyn`: feedback and Operator hand-offs

## Updating
Bump `version` in `plugins/flowzyn/.claude-plugin/plugin.json` on a branch and merge it to main with a pull request. Claude only syncs on a merged pull request that bumps the version. A direct push to main does not reach shops. Shops with Sync automatically get it, others on Check for updates. Agent wording changes don't need a plugin update: deploy the connector.

Privacy: https://www.flowzyn.com/privacy (set `privacyPolicyUrl` in plugin.json once that page exists).
