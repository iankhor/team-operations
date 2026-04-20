# Tasks

Work in this repo is executed in **phases**. Every phase is planned here *before* any code is written, and this file is the source of truth for what's in-flight and what's done.

## How this file is used

- Add a new `## Phase N — <title>` section before starting work.
- Fill in **Goal**, **Scope**, and the task checklist *first*. Only start coding once this is written.
- Tick tasks as they land. Flip **Status** when the phase moves.
- When a phase is complete, leave it in place (don't delete) — the file is also the history.

## Phase template

```md
## Phase N — <title>

**Goal:** <one sentence: what this phase delivers>
**Status:** not started | in progress | complete
**Started:** YYYY-MM-DD
**Completed:** YYYY-MM-DD

### Scope
- in scope: <…>
- out of scope: <…>

### Tasks
- [ ] <task>
- [ ] <task>

### Notes
<decisions, blockers, links to PRs or tickets>
```

---

<!-- Phases go below this line, newest first. -->

## Phase 1 — Champion rotation notifier for MS Teams

**Goal:** Post a fortnightly message to the Data & AI Team channel in MS Teams announcing who the Champion is for the next two weeks, with the roster and rotation state driven by a YAML file in this repo.
**Status:** in progress
**Started:** 2026-04-20
**Completed:** —

### Scope

- In scope:
  - A committed YAML file listing champions and tracking `last_champion` + `last_rotated_at`.
  - A Bun script that: reads the YAML, picks the next champion (wraparound), POSTs to a Power Automate Workflows webhook, updates the YAML.
  - A GitHub Actions workflow that runs the script on a schedule inside our Docker image and commits the updated YAML back to `main`.
  - Dry-run mode (logs the payload, doesn't POST, doesn't mutate state) — used for local testing and a `workflow_dispatch` smoke test.
- Out of scope:
  - Holiday / leave handling (handled manually by editing the YAML in a PR).
  - Multiple channels or parallel rotations.
  - A separate audit log — git history of `champions.yml` is the audit trail.
  - Replies, threading, or interactive cards.
  - Configuring the Power Automate flow itself (done manually in the Teams/Power Automate UI — this repo only owns the HTTP caller). The contract is defined below.

### Confirmed decisions

| Decision | Value |
|---|---|
| Webhook path | **Power Automate Workflows** (HTTP-triggered flow, `When a Teams webhook request is received`) |
| Cadence | **Fortnightly, Monday 09:00 Australia/Melbourne** |
| @-mentions | Yes — mention both previous and next champion |
| CI execution | **Inside the project Docker image** (parity with local) |
| Confluence link in message | **Removed** (old flow had one, we drop it) |
| Initial roster (rotation order) | 1. Ian Khor `KhorI@redcat.com.au`<br>2. Juelv Cayago `CayagoJ@redcat.com.au` |

### Design

#### `config/champions.yml`

```yaml
champions:
  - name: Ian Khor
    upn: KhorI@redcat.com.au
  - name: Juelv Cayago
    upn: CayagoJ@redcat.com.au
last_champion: null       # null on first run
last_rotated_at: null     # null on first run
```

Rules:
- `last_champion` must be either `null` or a `name` present in `champions[]`.
- `last_rotated_at` is ISO-8601 date (UTC date).
- On first run (`last_champion: null`), pick index 0.
- Otherwise pick the entry after `last_champion` in the list, wrapping to 0 at the end.
- If `last_champion` is set but no longer in the list (removed from roster), treat as first run.

#### Power Automate flow contract

A new HTTP-triggered Power Automate flow owns the actual Teams post. This repo POSTs the following JSON to its webhook URL:

```json
{
  "previousChampion": { "name": "Ian Khor",     "upn": "KhorI@redcat.com.au" },
  "nextChampion":     { "name": "Juelv Cayago", "upn": "CayagoJ@redcat.com.au" },
  "periodStart": "2026-05-04",
  "periodEnd":   "2026-05-17"
}
```

On first run `previousChampion` is `null`.

The flow is responsible for:
- Resolving each UPN into an `@mention` token (`Get @mention token for a user`).
- Formatting and posting the message to the **Data and AI Team** channel (`Product Development & IT Infrastructure` team) as Flow bot.

The message body the flow should render (keep it playful):

> 🔥 **Champion baton-pass!**
> Huge thanks to @{previousChampion} for flying the flag these past two weeks.
> @{nextChampion} — you're up! You're our Data & AI Champion from **{periodStart}** to **{periodEnd}**. Go cause some good trouble. 🏆

On first run (no previous champion), the flow skips the thank-you line and just announces the first champion.

#### Schedule

- GitHub Actions cron: `0 23 * * 0` (23:00 UTC Sunday) — fires at 09:00 Melbourne in AEST (winter) and 10:00 Melbourne in AEDT (summer). GitHub cron is not punctual anyway; the 14-day gate below tolerates drift.
- The script rotates only if `today (UTC) - last_rotated_at >= 14 days`. This means:
  - The workflow runs every Sunday night UTC, but posts only every second week.
  - `workflow_dispatch` manual runs are safe — they no-op unless 14+ days have passed (or `force: true` is set for smoke testing).

#### State write-back

On a successful post:
1. Update `last_champion` and `last_rotated_at` in `config/champions.yml`.
2. Commit back to `main` using the default `GITHUB_TOKEN` with `contents: write`.
3. Commit message: `chore(champion): rotate to {name}` — authored by `github-actions[bot]`.

If `main` is branch-protected against `GITHUB_TOKEN` pushes we'll switch to a short-lived PAT or a PR-based write-back. We'll discover this on first real run.

#### Secrets

- `TEAMS_WEBHOOK_URL` — GitHub Actions repository secret. Never in the repo.

#### Repository layout for this phase

```
champions-notifier/
  README.md           # full setup guide (Flow config, secrets, local usage)
  champions.yml       # roster + rotation state
  index.js            # CLI entry point (supports --dry-run, --force)
  rotation.js         # pure function: given roster + state + today, returns next state + payload
  teams.js            # HTTP POST to TEAMS_WEBHOOK_URL
  yaml-io.js          # read/write champions.yml
  rotation.test.js    # bun test
.github/workflows/
  champions-notifier.yml
```

### Tasks

- [x] Confirm open questions with user
- [x] Smoke-test a Power Automate Workflows webhook (manual curl from host — message landed in channel)
- [x] Add `champions-notifier/champions.yml` with initial roster
- [x] Implement `champions-notifier/` source (rotation, YAML I/O, Teams post, `--dry-run` and `--force` flags)
- [x] Add `bun:test` tests for rotation logic (first-run, next-from-last, wraparound, removed-champion, <14-day no-op, force-override, empty-roster)
- [x] Add package.json script entries and `yaml` dependency
- [x] Add `.github/workflows/champions-notifier.yml` — runs inside Docker image, weekly cron, `workflow_dispatch` with `dry_run` and `force` inputs, `contents: write`, uses `TEAMS_WEBHOOK_URL` secret, commits state back
- [x] Document Power Automate flow setup in `champions-notifier/README.md`
- [ ] User: rebuild the Power Automate flow against the real JSON contract (README step 1)
- [ ] User: rotate the webhook URL (the smoke-test URL was shared in chat) and store as `TEAMS_WEBHOOK_URL` GitHub secret
- [ ] User: install dependencies locally via `docker compose build && docker compose run --rm app bun install` to generate `bun.lockb`
- [ ] Smoke test: `docker compose run --rm app bun test`
- [ ] Smoke test: `workflow_dispatch` with `dry_run: true`
- [ ] First real run (`force: true`); verify Teams post, @-mentions resolve, YAML commit lands
- [ ] Delete the old Recurrence-triggered Power Automate flow once the new path is verified

### Notes

- Rotation state lives in the YAML (not a GitHub variable or artifact) so it's visible, diffable, and editable via normal PRs. Adding/removing people = edit YAML, open PR.
- The 14-day gate means `workflow_dispatch` is safe to use for debugging — it just no-ops unless `force: true`.
- If we outgrow the Power Automate hop (e.g. want reactions, threads, adaptive cards with buttons), migration path is Microsoft Graph — same script, different transport.
