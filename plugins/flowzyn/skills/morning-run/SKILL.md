---
name: morning-run
description: Use for "Run the Flowzyn morning run" (the daily scheduled task) or when the owner asks Flowzyn to run all its agents now.
---

# Flowzyn morning run

Nobody is watching this run. Do it end to end and never stop to ask. Keep it small: read only what each agent's steps need.

## 1. Start
1. Call `flowzyn_status`. If it errors, stop and tell the owner what it says. If `systems` is not set, run the Set up Flowzyn skill instead.
2. Use the install-app skill to check the Flowzyn app is current. It only acts when this plugin carries a newer version.
3. Find the owner's "Flowzyn Agents" app (list their artifacts) and note its link. Its storage is where the agents and the app meet. Read `settings/profile`, `settings/autoapprove`, `settings/templates` and list `agents`, `tasks`, `exceptions` and `runs` once, now, and reuse them for every agent.

## 2. Each agent
`flowzyn_status` lists the agents in run order, each with its app `key`. For each one that is in `agentsOn`:
1. Call `get_agent_instructions` with the agent's name. Those are the current steps and win over anything remembered.
2. Is it due today? The steps say when it runs (every weekday, Mondays, monthly). Skip it when it is not due and `runs/<key>` shows it ran in its last slot. Never skip Plan Today.
3. Is it paused? If `agents/<key>` has `enabled: false`, log it as skipped and move on.
4. Follow the steps exactly, using only the shop's own connectors listed in `systems.connected`.
5. Never send anything to a customer unless the owner approved that email in the app, or auto approve is on for that agent. The steps say how to tell.
6. End the agent the way its steps say: the run record and metric in the app storage, then `log_run`. Counts only, no customer names or contact details.

One agent failing never stops the run. Log it as an error with one plain line and carry on to the next.

## 3. Finish
1. Plan Today runs last. It sends every email the owner approved in the app, then writes the brief.
2. Anything a person at Flowzyn should do goes to `hand_to_operator`, with how soon.
3. Report how the app was used. List `activity` in the app storage and take the last 7 days that have a record. Call `log_usage` once with one entry per day: `day`, `visits` (its `sessions`), `minutes`, `screens` (its `views`), `taps` (as recorded), and for that day in the shop's time zone `approved` (tasks with `approvedAt` that day), `handled` (exceptions with `handledAt` that day), `toOperator` (items handed to Flowzyn that day) and `sent` (`sent` records made that day). Counts only. Never a customer name, an address, a phone number or any email wording. If there are no activity records, or `log_usage` is not there or fails, skip this step and carry on.
4. End with the brief in plain words, biggest dollars first, and one line saying how many agents ran. No dashes, no semicolons.
