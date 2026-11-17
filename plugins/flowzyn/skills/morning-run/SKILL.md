---
name: morning-run
description: Use for "Run the Flowzyn morning run" (the daily scheduled task) or when the owner asks Flowzyn to run all its agents now.
---

# Flowzyn morning run

Nobody is watching this run. Do it end to end and never stop to ask. Keep it small: read only what each agent's steps need.

This run has to finish in one go with nobody there to say "keep going", so spend as little of the reply as you can:
- Say nothing while you work. No progress notes, no summary after each agent. The only words the owner gets are the brief at the end.
- Never show a report, table, chart or card from the books or the field app in the chat. Read what you need and move on.
- Read each thing once and reuse it. Ask for small pages and only the fields the steps name.

## 1. Start
1. Call `flowzyn_status`. If it errors, stop and tell the owner what it says. If `systems` is not set, run the Set up Flowzyn skill instead.
2. Use the install-app skill to check the Flowzyn app is there and current. It installs the app if the owner has none, and updates an older app to the current version.
3. Find the owner's "Flowzyn Agents" app (list their artifacts) and note its link. Its storage is where the agents and the app meet. Read `settings/profile`, `settings/autoapprove`, `settings/templates` and list `agents`, `tasks`, `exceptions` and `runs` once, now, and reuse them for every agent.

## 2. Each agent
`flowzyn_status` lists the agents, each with its app `key`. Run the ones in `agentsOn` in this order, so the owner always gets today's brief even if the run is cut short:
1. The daily agents: `lead-catcher`, `quotes`, `quote-chaser`, `install-scheduler` (with `yes-to-install`), `bill-it`, `get-paid`, `pay-bills`.
2. Plan Today (`morning-brief`): send the approved emails and write and send the brief now, from what has run so far.
3. The rest, most valuable first: `builder-engine`, `review-ask`, `lost-quote-revival`, `come-back`, `partner-finder`, `local-search-check`.

Picking up a run that stopped: if `runs/<key>` shows an agent already finished today with `lastStatus` ok, skip it. So running this skill again the same day carries on from where the last one stopped, and never does an agent twice.

For each one:
1. Call `get_agent_instructions` with the agent's name. Those are the current steps and win over anything remembered.
2. Is it due today? The steps say when it runs (every weekday, Mondays, monthly). Skip it when it is not due and `runs/<key>` shows it ran in its last slot. Never skip Plan Today. An agent with no `runs/<key>` record has never run for this shop: run it now, whatever day it is.
3. Is it paused? If `agents/<key>` has `enabled: false`, log it as skipped and move on.
4. Follow the steps exactly, using only the shop's own connectors listed in `systems.connected`.
5. Never send anything to a customer unless the owner approved that email in the app, or auto approve is on for that agent. The steps say how to tell.
6. End the agent the way its steps say: the run record and metric in the app storage, then `log_run`. Counts only, no customer names or contact details.

One agent failing never stops the run. Log it as an error with one plain line and carry on to the next.

## 3. Finish
1. Plan Today has already run, right after the daily agents. If agents that ran after it found something that needs the owner today, add it to `datasets/brief` and mention it in the closing words. Do not send a second brief email.
2. Anything a person at Flowzyn should do goes to `hand_to_operator`, with how soon.
3. Report how the app was used. List `activity` in the app storage and take the last 7 days that have a record. Call `log_usage` once with one entry per day: `day`, `visits` (its `sessions`), `minutes`, `screens` (its `views`), `taps` (as recorded), and for that day in the shop's time zone `approved` (tasks with `approvedAt` that day), `handled` (exceptions with `handledAt` that day), `toOperator` (items handed to Flowzyn that day) and `sent` (`sent` records made that day). Counts only. Never a customer name, an address, a phone number or any email wording. If there are no activity records, or `log_usage` is not there or fails, skip this step and carry on.
4. End with the brief in plain words, biggest dollars first, and one line saying how many agents ran. No dashes, no semicolons. If any agent that was due did not run, say which in one line and that the next run picks them up.
