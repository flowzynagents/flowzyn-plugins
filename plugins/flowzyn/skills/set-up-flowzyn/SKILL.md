---
name: set-up-flowzyn
description: Use when the owner says "Set up Flowzyn", has just installed the Flowzyn plugin, or Flowzyn says the shop is not set up yet. Checks the apps already connected, fills the shop profile from their own data, and creates the morning run.
---

# Set up Flowzyn

The owner is a busy trades owner. They should confirm, never type things out. Short plain sentences. Never say AI.

## 1. Check the licence
Call `flowzyn_status` on the Flowzyn connector.
- If the Flowzyn connector is not reachable: tell the owner to open Customize, Plugins, Flowzyn, Connectors, click Connect on Flowzyn and paste the licence key from the welcome email. Stop until that is done.
- If it returns an error about the licence: tell the owner exactly what it says and stop.

## 2. Use what is already connected
Do not ask the owner to connect anything that already works. Test each app with one small read, using the connectors already in this account:

| Need | Try, in this order | Test |
| --- | --- | --- |
| Field app | Jobber (also Housecall Pro, ServiceTitan if present) | find one client |
| Books | QuickBooks, then Xero | read the company info |
| Email | Gmail, then Outlook | search the inbox for one message |

Record what worked as `connected` and the app the shop uses for each need. Only for a need with nothing working, tell the owner the one app to connect (Customize, Connectors, the app, Connect), wait, and test again. If they don't use books software, set books to `none` and move on.

## 3. Fill the shop profile from their data
Read their field app and books (last 90 days) and draft:
- services they sell and typical price ranges, from recent quotes and invoices
- service area (towns that come up most)
- crew names that appear on visits
- who signs customer emails (from sent mail)
- business hours, if shown

Show it as a short list and ask: "Is this right? Tell me anything to change." Apply their changes. Don't invent anything you didn't see.

## 4. Choose the agents
Show the Flowzyn agents from `flowzyn_status` that their connected apps can support, all on by default (Flowzyn's rule: everything runs, only exceptions go to the owner). Let them switch any off.

## 5. Save
Call `save_setup` with `systems`, the confirmed `profile` and `agentsOn`.

## 6. Create the morning run
Create a scheduled task named "Flowzyn morning run", weekdays at 6:30 am in the owner's time zone, with this prompt:

> Run the Flowzyn morning run.

If scheduled tasks aren't available on their plan, say they need Claude Pro or higher and stop here.

## 7. Finish
Tell the owner, in three lines: which apps Flowzyn is using, which agents are on, and that the first morning run happens tomorrow at 6:30 am. Offer to do a first run now.
