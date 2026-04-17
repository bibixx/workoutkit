import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, "../..");
const wkcBin = join(repo, "corpus/.build/debug/wkc");

/**
 * Run Apple's own parser on the given bytes and return the spec-shaped JSON
 * representation of the parsed workout. Throws if `wkc parse` fails (e.g.
 * WorkoutKit rejects the file) — that's the signal we're looking for.
 */
export function swiftParse(bytes: Uint8Array): unknown {
  const dir = mkdtempSync(join(tmpdir(), "wkc-parse-"));
  const inPath = join(dir, "in.workout");
  const outPath = join(dir, "out.json");
  writeFileSync(inPath, bytes);
  execFileSync(wkcBin, ["parse", inPath, outPath], { stdio: "pipe" });
  return JSON.parse(readFileSync(outPath, "utf8"));
}
