---
name: tell-flowzyn
description: Use when the owner wants to tell Flowzyn something ("tell Flowzyn...", "this isn't right", "the follow ups are too pushy") or wants a person at Flowzyn to do a task by hand.
---

# Tell Flowzyn

- Feedback: call `tell_flowzyn` with the owner's own words, plus the agent and task if known. Reply: "Passed on to Flowzyn."
- A task for a person: call `hand_to_operator` with what's needed and how soon. Name the record and where to find it, never a customer's email or phone number. Reply with what the tool says back.
