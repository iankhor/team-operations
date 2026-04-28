# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Purpose

Home for automation owned by the **Data & AI team at Redcat**. Scripts, jobs, and tooling that support the team's operational workflows live here.

## Stack

- **Runtime & package manager:** [Bun](https://bun.sh) — use `bun install`, `bun run`, `bun test`. Do **not** use `npm` / `pnpm` / `yarn` or `node` directly.
- **Language:** plain JavaScript, **ESM** (`"type": "module"` — use `import`, not `require`).
- No framework or test runner locked in yet; Bun's built-in test runner (`bun test`) is the default unless a concrete reason to choose otherwise comes up.

## Execution environment

**All code runs inside Docker.** Contributors use macOS and Windows; Docker keeps the runtime, lockfile, and native deps identical on every machine. **Do not install Bun (or Node) on the host**, and do not suggest commands that assume a host Bun install.

Toolchain:
- `Dockerfile` — Bun image (`oven/bun:1`)
- `docker-compose.yml` — dev service named `app` with the repo bind-mounted at `/app` and a named volume for `node_modules` so host and container don't fight over it
- `.dockerignore` — keeps secrets, `.git`, and host `node_modules` out of the build context

## Common commands

A root `Makefile` wraps the verbose `docker compose run --rm app …` pattern. **Prefer `make` targets** for anything defined there; fall back to raw `docker compose` only for one-offs.

```bash
make                           # show all available targets
make build                     # build/rebuild the Docker image (after Dockerfile or dep changes)
make install                   # install deps and write bun.lock on the host
make test                      # run all tests
make shell                     # interactive shell in the container

make champion-notifier-dry     # dry-run the champions notifier (no POST, no state write)
make champion-notifier-force   # force a rotation right now (needs TEAMS_WEBHOOK_URL)
make champion-notifier         # normal run (respects the 14-day gate)
```

For anything the Makefile doesn't cover:

```bash
docker compose run --rm app bun add <pkg>     # add a runtime dep (then `make build`)
docker compose run --rm app bun add -d <pkg>  # add a dev dep
docker compose run --rm app bun <file.js>     # execute an arbitrary file
docker compose run --rm app bun test <path>   # run a single test file
```

After any `bun add`, run `make build` so future containers start with the new dep baked into the image.

Lockfile is `bun.lock`. Commit it.

**When adding a new automation, add its targets to the root `Makefile`** (namespaced with the automation's name — see the `champion-notifier*` targets as a template).

## Planning: phases and `docs/tasks.md`

Work in this repo is executed in **phases**, and every phase is planned in [`docs/tasks.md`](docs/tasks.md) *before* code is written.

Before implementing anything non-trivial:
1. Open `docs/tasks.md` and add a new `## Phase N — <title>` section using the template at the top of that file.
2. Fill in **Goal**, **Scope**, and the **Tasks** checklist. Confirm the plan with the user.
3. Only then start coding. Tick tasks as they land; flip **Status** when the phase moves.

Do not start a new phase (or mix work across phases) without updating `docs/tasks.md` first. If the user asks for a change mid-phase, update the plan in-file rather than silently expanding scope.

## Code style

How we write and evaluate code in this repo:

- **Clean and explicit over clever.** Code should read like plain English. Prefer long descriptive identifiers over short cryptic ones. Abstractions are welcome — *when they're earned* by real, repeated use and they make the calling code clearer, not just shorter. A good abstraction hides complexity a reader doesn't need; a bad one just adds a layer to step through.
- **YAGNI.** Build for the task in front of you, not for hypothetical futures. No speculative parameters, flags, or hooks "in case we need them later". No generic helper for a single caller. When the second caller appears, *then* abstract — not before.
- **KISS.** Pick the simplest design that solves the current problem. Three similar lines is better than a premature abstraction. Reach for frameworks, classes, and layers only when the simpler version has a concrete, present-day pain point.
- **Minimal comments.** If code needs a comment to explain *what* it does, rename the identifiers instead. Only add a comment when the *why* is non-obvious — a hidden constraint, a subtle invariant, a workaround for a specific bug, or behaviour that would surprise a reader. Never write comments that restate the code, reference the current task/PR, or explain "what we used to do".
- **Delete, don't deprecate.** No dead branches, no `// removed`/`// legacy` markers, no re-exports kept for nothing. If the feature is gone, so is its code.

## Repository layout

**Colocation principle: each automation lives in its own top-level folder, containing everything specific to it.** That means the automation's code, config, YAML/JSON data, README, and tests all sit together (e.g. `champions-notifier/`). Anyone who opens the folder should see the whole automation at a glance.

What stays at the root (shared across automations, not duplicated per folder):

- `Dockerfile`, `docker-compose.yml`, `.dockerignore` — one Bun runtime image serves every automation
- `package.json`, `bun.lock` — one dependency graph; per-automation scripts are namespaced (e.g. `"champion-notifier"`, `"champion-notifier:dry"`)
- `.github/workflows/` — GitHub requires workflows at this path; one file per automation, named after it
- `CLAUDE.md`, `.gitignore`, `docs/` — repo-wide

When adding a new automation:
1. Create a new top-level folder named after the automation.
2. Put its code, README, config, and tests inside.
3. Add scripts to the root `package.json` namespaced with the automation name.
4. Add a dedicated workflow file at `.github/workflows/<automation>.yml`.

If an automation ever needs a different runtime (Python, Go, etc.), that's when we split infra — until then, shared root infra is the default.

## Teams notifications

All automations post into the **same Teams thread** in `#Data and AI Team` (Team: `Product Development & IT Infrastructure`), parent message ID **`1776753578605`**. In Power Automate, use **Reply with a message in a channel** (not **Post message in a chat or channel**) and set **Message ID** to that parent ID. Keeps automation chatter threaded under one anchor instead of cluttering the channel top-level.

## Conventions to capture over time

As patterns emerge, update this file with:

- Common commands (install, build, lint, test, run a single test, run an automation locally).
- How automations are deployed / scheduled (cron, GitHub Actions, Cloud Run, etc.).
- External systems the automations talk to (BigQuery, Jira, Slack, etc.) and where credentials come from.
- Any Redcat-specific conventions for commits, PRs, or branching.
