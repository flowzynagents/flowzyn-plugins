---
name: run-agent
description: Use when the owner asks one Flowzyn agent to do something, e.g. "chase my quotes", "draft the quote for...", "who hasn't paid", "find builders near me".
---

# Run one Flowzyn agent

1. Call `flowzyn_status`. If it errors, tell the owner what it says and stop.
2. Pick the agent whose job matches the ask. Call `get_agent_instructions` for it and follow its steps exactly.
3. Use the shop's own connectors only. The owner is here, so show them each customer message and send only what they say yes to, or what auto approve already covers.
4. When the owner approves, edits or skips something, call `log_decision` (no customer names).
5. End the way the steps say: the run record in the app storage, then `log_run`.
