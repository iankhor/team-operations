# Champions notifier

Fortnightly rotation of the Data & AI Champion role, announced in the `#Data and AI Team` MS Teams channel.

## How it works

- `champions.yml` is the source of truth: the ordered roster + state (`last_champion`, `last_rotated_at`).
- A GitHub Actions workflow (`.github/workflows/champions-notifier.yml`) runs **weekly** on Sunday at 23:00 UTC (≈ Monday 09:00–10:00 Melbourne, depending on DST).
- Each run invokes `bun run champions-notifier/index.js` inside the project Docker image.
- The script rotates **only if ≥ 14 days** have elapsed since `last_rotated_at` — otherwise it no-ops. Manual triggers are therefore safe, and missed runs self-heal on the next cron tick.
- On rotation it POSTs JSON to a Power Automate Workflows webhook; the Flow on the Microsoft side @-mentions both the outgoing and incoming champion and posts the message to Teams.
- After a successful post, the Action commits the updated `champions.yml` back to `main`.

## Data flow

```
GitHub Actions (Sunday 23:00 UTC cron)
  └─ docker compose run app bun run champions-notifier/index.js
     ├─ reads  champions-notifier/champions.yml
     ├─ rotates (pure function)
     ├─ POSTs  → Power Automate webhook
     │          └─ Flow resolves @mentions + posts to Teams as Flow bot
     └─ writes champions-notifier/champions.yml
        └─ Action commits the new state back to main
```

## Script → Flow payload contract

The script POSTs this JSON to the webhook URL (stored in the `TEAMS_WEBHOOK_URL` repo secret):

```json
{
  "previousChampion": { "name": "Ian Khor", "upn": "KhorI@redcat.com.au" },
  "nextChampion":     { "name": "Juelv Cayago", "upn": "CayagoJ@redcat.com.au" },
  "periodStart": "2026-05-04",
  "periodEnd":   "2026-05-17"
}
```

On the very first run `previousChampion` is `null`.

## Setup from scratch

You do this once per environment. There are three things to stand up: the Power Automate flow, the GitHub secret, and the roster file.

### 1. Create the Power Automate flow

Goal: an HTTP-triggered Flow that receives the JSON above and posts a nicely-formatted @-mention message to `#Data and AI Team`.

1. Open <https://make.powerautomate.com> (or from Teams → `#Data and AI Team` → `+` → **Power Automate**).
2. **+ Create** → **Instant cloud flow**.
3. Name it `Champions Notifier`.
4. Pick trigger **When a Teams webhook request is received** (preferred) or **When a HTTP request is received** (fallback).
5. Paste this schema into the trigger's **Request Body JSON Schema** field:

   ```json
   {
     "type": "object",
     "properties": {
       "previousChampion": {
         "type": ["object", "null"],
         "properties": {
           "name": { "type": "string" },
           "upn":  { "type": "string" }
         }
       },
       "nextChampion": {
         "type": "object",
         "properties": {
           "name": { "type": "string" },
           "upn":  { "type": "string" }
         }
       },
       "periodStart": { "type": "string" },
       "periodEnd":   { "type": "string" }
     }
   }
   ```

6. Add action **Get an @mention token for a user**.
   - **User:** `triggerBody()?['nextChampion']?['upn']`
   - Rename the step to `nextMention` for clarity.

7. Add another **Get an @mention token for a user** (optional on first run).
   - **User:** `triggerBody()?['previousChampion']?['upn']`
   - Rename to `prevMention`.
   - In the step's **⋯ → Configure run after**, tick **has failed** and **is skipped** so the flow survives the first run (when `previousChampion` is `null`).

8. Add a **Condition**: `triggerBody()?['previousChampion']` **is not equal to** `null`.

9. In the **If yes** branch, add **Reply with a message in a channel**:
   - **Post as:** Flow bot
   - **Post in:** Channel
   - **Team:** `Product Development & IT Infrastructure`
   - **Channel:** `Data and AI Team`
   - **Message ID:** `1776753578605` (the shared automations thread — see `CLAUDE.md` → *Teams notifications*)
   - **Message** (set Format = HTML):
     ```html
     🔥 <strong>Champion baton-pass!</strong><br>
     Huge thanks to @{outputs('prevMention')?['body/atMention']} for flying the flag these past two weeks.<br>
     @{outputs('nextMention')?['body/atMention']} — you're up! You're our Data &amp; AI Champion from
     <strong>@{triggerBody()?['periodStart']}</strong> to
     <strong>@{triggerBody()?['periodEnd']}</strong>. Go cause some good trouble. 🏆
     ```

10. In the **If no** branch (first run, no previous champion), add **Reply with a message in a channel** with the same Post as / Post in / Team / Channel / Message ID, and message:
    ```html
    🏆 <strong>First Champion of the rotation!</strong><br>
    @{outputs('nextMention')?['body/atMention']} — you're up from
    <strong>@{triggerBody()?['periodStart']}</strong> to
    <strong>@{triggerBody()?['periodEnd']}</strong>. Set the tone. 🔥
    ```

11. **Save** the flow. Open the trigger card — it now exposes the **HTTP URL**. Copy it. **Treat this URL as a secret** — anyone with it can post to the channel.

### 2. Store the webhook URL as a GitHub secret

1. GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**.
2. Name: `TEAMS_WEBHOOK_URL`.
3. Value: paste the URL from the previous step. Save.

### 3. Edit the roster

1. Open `champions-notifier/champions.yml`.
2. Under `champions:`, list each person in the rotation order you want.
   - `name` is the display name that will appear in commit messages and logs.
   - `upn` is the Microsoft 365 sign-in address (email). It's used by Power Automate to resolve the @mention.
3. Leave `last_champion` and `last_rotated_at` as `null` to start fresh.
4. Open a PR → merge to `main`.

### 4. Smoke-test the GitHub Action

1. Repo → **Actions** → **Champions notifier** → **Run workflow**.
2. Set **Dry run** = `true`. Leave **Force** = `false`.
3. Inspect the run logs. You should see the payload printed and **no** Teams post, **no** state change.
4. Run it again with **Dry run** = `false` and **Force** = `true`. This should post to Teams and commit an update to `champions.yml`.
5. Check `#Data and AI Team` for the message and the repo's commit log for `chore(champion): rotate to <name>`.

## Local usage (Docker only)

Everything runs via our project Docker image. **Do not install Bun on your host.** Use the root `Makefile`:

```bash
# one-time: build image and generate the host lockfile
make build
make install

# dry-run (no POST, no state write)
make champion-notifier-dry

# force a real rotation now — overrides the 14-day gate
export TEAMS_WEBHOOK_URL="<url>"
make champion-notifier-force

# normal run (respects the 14-day gate; typically only fires in CI)
make champion-notifier

# tests
make test
```

If you don't have `make` installed, see `CLAUDE.md` for the raw `docker compose` equivalents.

## `champions.yml` shape

```yaml
champions:            # ordered list — rotation follows list order
  - name: Ian Khor
    upn: KhorI@redcat.com.au
last_champion: null   # null = no rotation has happened yet; next run picks index 0
last_rotated_at: null # ISO date (UTC) of the most recent rotation
```

If `last_champion` is set but no longer appears in `champions[]` (e.g. they left the team), the rotation treats that as a first-run and starts again at index 0. No manual cleanup is needed — just edit the roster and open a PR.

## Rotating the webhook URL

If `TEAMS_WEBHOOK_URL` is compromised (leaked, pasted in chat, committed by mistake):

1. In Power Automate, open `Champions Notifier` → delete the trigger step → re-add **When a Teams webhook request is received** → **Save**. This regenerates the signature in the URL.
2. Copy the new URL.
3. Update the `TEAMS_WEBHOOK_URL` GitHub secret.
4. The old URL is now dead.

## If the Action can't push back to `main`

If `main` is branch-protected against `GITHUB_TOKEN` pushes the commit-back step will fail with a 403. Two options:

- Grant the bot an exception to the protection rule.
- Switch the Action to open a PR instead of pushing directly (swap the final `git push` step for [`peter-evans/create-pull-request`](https://github.com/peter-evans/create-pull-request)).
