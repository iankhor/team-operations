#!/usr/bin/env bun
import { appendFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { readChampions, writeChampions } from "./yaml-io.js";
import { rotate } from "./rotation.js";
import { postToTeams } from "./teams.js";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const force = args.includes("--force");

const here = dirname(fileURLToPath(import.meta.url));
const yamlPath = join(here, "champions.yml");

const webhookUrl = process.env.TEAMS_WEBHOOK_URL;
if (!dryRun && !webhookUrl) {
  console.error("TEAMS_WEBHOOK_URL env var is required (unless --dry-run).");
  process.exit(1);
}

const state = readChampions(yamlPath);
const result = rotate(state, new Date(), { force });

if (!result.shouldPost) {
  console.log(`No rotation today. ${result.reason}`);
  process.exit(0);
}

const payload = {
  previousChampion: result.previousChampion,
  nextChampion: result.nextChampion,
  periodStart: result.periodStart,
  periodEnd: result.periodEnd,
};

if (dryRun) {
  console.log("[DRY RUN] Would POST:");
  console.log(JSON.stringify(payload, null, 2));
  console.log("[DRY RUN] Would update state to:");
  console.log(JSON.stringify(result.newState, null, 2));
  process.exit(0);
}

console.log(
  `Rotating: ${result.previousChampion?.name ?? "(none)"} → ${result.nextChampion.name}`,
);
await postToTeams(webhookUrl, payload);
console.log("Posted to Teams.");

writeChampions(yamlPath, { ...state, ...result.newState });
console.log(`Updated ${yamlPath}`);

if (process.env.GITHUB_OUTPUT) {
  appendFileSync(
    process.env.GITHUB_OUTPUT,
    `new_champion=${result.nextChampion.name}\n`,
  );
}
