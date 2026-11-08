---
name: morning-run
description: Use for "Run the Flowzyn morning run" (the daily scheduled task) or when the owner asks Flowzyn to run all its agents now.
---

# Flowzyn morning run

1. Call `flowzyn_status`. If it errors, stop and tell the owner what it says. If `systems` is not set, run the Set up Flowzyn skill instead.
2. For each agent in `agentsOn`, in the order given:
   - Call `get_agent_instructions` with the agent's name. Follow those instructions exactly. They are the current version and win over anything remembered.
   - Use only the shop's own connectors listed in `systems.connected`.
   - Never send anything to a customer unless the instructions and the shop's auto approve setting allow it. Otherwise leave a draft.
   - End with `log_run`: one plain summary line, counts, and any exceptions. No customer contact details.
3. Anything an agent could not do goes to `hand_to_operator` with urgency.
4. Finish with the morning brief the instructions describe, in plain words, biggest dollars first.
