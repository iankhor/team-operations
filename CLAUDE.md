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

Run everything via `docker compose run --rm app …`:

```bash
docker compose build                           # build/rebuild the image (after Dockerfile or dep changes)
docker compose run --rm app bun install        # install deps
docker compose run --rm app bun add <pkg>      # add a runtime dep
docker compose run --rm app bun add -d <pkg>   # add a dev dep
docker compose run --rm app bun run <script>   # run a package.json script
docker compose run --rm app bun <file.js>      # execute a JS file
docker compose run --rm app bun test           # run tests
docker compose run --rm app bun test <path>    # run a single test file
docker compose run --rm app sh                 # interactive shell in the container
```

After `bun add`, rebuild (`docker compose build`) so future containers start with the new dep baked into the image, not just the bind-mounted `node_modules`.

Lockfile is `bun.lockb` (binary — do not hand-edit). Commit it.

## Repository layout

Single root `package.json`. Keep it that way until there's a concrete reason to split into a monorepo.

## Conventions to capture over time

As patterns emerge, update this file with:

- Common commands (install, build, lint, test, run a single test, run an automation locally).
- How automations are deployed / scheduled (cron, GitHub Actions, Cloud Run, etc.).
- External systems the automations talk to (BigQuery, Jira, Slack, etc.) and where credentials come from.
- Any Redcat-specific conventions for commits, PRs, or branching.
