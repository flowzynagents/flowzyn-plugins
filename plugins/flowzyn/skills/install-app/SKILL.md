---
name: install-app
description: Use from Set up Flowzyn, from the morning run, or when the owner says "Update my Flowzyn app": puts the Flowzyn agents app in the owner's own Claude, or updates it to the latest version.
---

# Install or update the Flowzyn agents app

The app is the shop's own screens: Overview, Tasks, Agents and Connect. It lives in the owner's own Claude account as an artifact named "Flowzyn Agents", so it reads their own Jobber, email and books with their own connectors. Flowzyn never sees their logins.

The app files ship with this plugin. From this skill's base directory they are in `../../app/`:
- `VERSION`: the version in this plugin, like 2026.11.10.1
- `FILES`: every file to publish, one path per line, relative to `../../app/files/`
- `files/`: the files themselves
- `capabilities.json`: what the app may use

## 1. Find their app
List the owner's own artifacts and look for one titled "Flowzyn Agents". If there is one, read its file `VERSION`.

## 2. Already current?
If its `VERSION` matches this plugin's `VERSION`, stop. Nothing to do.

## 3. New install (no app yet)
1. Publish every file in `FILES` as a new artifact: each file's `as` is its path from `FILES`, and its `path` is the absolute path of that file under `../../app/files/`. Title "Flowzyn Agents", icon "Grid".
2. Declare its capabilities with the contents of `capabilities.json`, using the version the publish returned as the base version.
3. Tell the owner in one line that their Flowzyn app is ready, and open it. The first time it opens, Claude asks them to allow Jobber, email and books for it. Tell them to allow each one.

## 4. Update (older version)
1. Read its declaration. If it differs from `capabilities.json`, declare `capabilities.json` first.
2. Publish every file in `FILES` to the same artifact, patch mode, with the live version as the base version. Their saved settings, goal, templates and finished tasks stay, they live in the app's own storage, not in its files.
3. Say one line in the morning brief: "Your Flowzyn app was updated to {VERSION}."

## Rules
- Never publish it anywhere but the owner's own account, and never share it.
- If artifacts can't be published here, say the app needs a Claude plan with artifacts, tell Flowzyn with `tell_flowzyn`, and carry on with the rest of the run.
- If a publish fails, try once more, then tell Flowzyn and carry on. Never leave the run half done because of the app.
