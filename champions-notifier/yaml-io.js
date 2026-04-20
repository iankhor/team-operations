import { readFileSync, writeFileSync } from "node:fs";
import { parse, stringify } from "yaml";

export function readChampions(path) {
  return parse(readFileSync(path, "utf8"));
}

export function writeChampions(path, data) {
  writeFileSync(path, stringify(data, { lineWidth: 0 }));
}
