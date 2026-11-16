---
name: install-app
description: Use from Set up Flowzyn, from the morning run, or when the owner says "Update my Flowzyn app". Puts the Flowzyn agents app in the owner's own Claude, or updates it to the latest version.
---

# Install or update the Flowzyn agents app

The app is the shop's own screens: Overview, Tasks, Agents and Connect. It lives in the owner's own Claude account as an artifact named "Flowzyn Agents", so it reads their own Jobber with their own connector, and the morning run writes what the agents did into its storage. Flowzyn never sees their logins.

The app files ship with this plugin. From this skill's base directory they are in `../../app/`:
- `VERSION`: the version in this plugin, like 2026.11.10.1
- `FILES`: every file to publish, one path per line, relative to `../../app/files/`
- `files/`: the files themselves
- `capabilities.json`: what the app may use

## 1. Find their app
List the owner's own artifacts and look for one titled "Flowzyn Agents". If there is one, read its file `version.txt`. No such file means it is older than this plugin.

## 2. Already current?
If its `version.txt` matches this plugin's `VERSION`, pin it (see Pin it) and stop. Nothing else to do.

## 3. New install (no app yet)
1. Publish every file in `FILES` as a new artifact: each file's `as` is its path from `FILES`, and its `path` is the absolute path of that file under `../../app/files/`. Title "Flowzyn Agents", icon "Grid".
2. Declare its capabilities with the contents of `capabilities.json`, using the version the publish returned as the base version.
3. Copy the shop profile into the app's storage, so the app never asks the owner who they are. Call `flowzyn_status` and set the document `settings/profile` to `{ business, owner, place, website, trade, services, timeZone, onboardedAt: now, welcomeStep: null }` from its `profile` (`owner` is the owner's first name). Leave out anything you don't have. If the document already exists, only fill the fields that are empty.
4. Pin it (see Pin it).
5. Tell the owner in one line that their Flowzyn app is ready and where it lives (under Pinned in the left sidebar if the pin worked, otherwise under Artifacts), and open it. The first time it opens, Claude asks them to allow Jobber, email and books for it. Tell them to allow each one.

## 4. Update (older version)
1. Read its declaration. If it differs from `capabilities.json`, declare `capabilities.json` first.
2. Publish every file in `FILES` to the same artifact, patch mode, with the live version as the base version. Remove only `boards/*.js` files the app has that are not in `FILES` (old pages that are no longer shipped). Never remove anything else, such as videos or data files. Their saved settings, goal, templates and finished tasks stay, they live in the app's own storage, not in its files.
3. If `settings/profile` in the app's storage has no `trade` or no `timeZone`, fill them from `flowzyn_status`, the same way as a new install.
4. Pin it (see Pin it).
5. Say one line in the morning brief: "Your Flowzyn app was updated to {VERSION}."

## Pin it
Pin the "Flowzyn Agents" artifact to the owner's sidebar, so it is one click away under Pinned. Pinning one that is already pinned changes nothing, so do it every time. If pinning isn't available here, skip it and carry on.

## Rules
- Never publish it anywhere but the owner's own account, and never share it.
- If artifacts can't be published here, say the app needs a Claude plan with artifacts, tell Flowzyn with `tell_flowzyn`, and carry on with the rest of the run.
- If a publish fails, try once more, then tell Flowzyn and carry on. Never leave the run half done because of the app.
