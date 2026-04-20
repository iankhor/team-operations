.DEFAULT_GOAL := help

DC    := docker compose
RUN   := $(DC) run --rm app
RUN_E := $(DC) run --rm -e TEAMS_WEBHOOK_URL app

.PHONY: help
help: ## Show this help
	@awk 'BEGIN {FS = ":.*## "; printf "Usage: make <target>\n\nTargets:\n"} /^[a-zA-Z0-9_\-]+:.*## / {printf "  %-28s %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# ---------------------------------------------------------------------
# Shared infra (every automation uses these)
# ---------------------------------------------------------------------

.PHONY: build
build: ## Build the Docker image
	$(DC) build

.PHONY: install
install: ## Install/refresh dependencies and write bun.lock on host
	$(RUN) bun install

.PHONY: test
test: ## Run all tests
	$(RUN) bun test

.PHONY: shell
shell: ## Open an interactive shell in the container
	$(RUN) sh

# ---------------------------------------------------------------------
# champions-notifier
# ---------------------------------------------------------------------

.PHONY: champion-notifier
champion-notifier: ## Run the champions notifier (needs TEAMS_WEBHOOK_URL)
	$(RUN_E) bun run champions-notifier/index.js

.PHONY: champion-notifier-dry
champion-notifier-dry: ## Dry-run the champions notifier (no POST, no state write)
	$(RUN) bun run champions-notifier/index.js --dry-run

.PHONY: champion-notifier-force
champion-notifier-force: ## Force champions rotation, overriding the 14-day gate (needs TEAMS_WEBHOOK_URL)
	$(RUN_E) bun run champions-notifier/index.js --force
