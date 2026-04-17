import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { encodeWorkoutPlan } from "workout-file-sdk";
import { loadSpec } from "./spec.ts";
import { swiftParse } from "./swift-parse.ts";
import { normalize } from "./normalize.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(here, "../fixtures");

const fixtures = readdirSync(fixturesDir)
  .filter((f) => f.endsWith(".spec.json"))
  .sort();

describe("semantic round-trip: TS SDK bytes → Apple parser → spec JSON", () => {
  for (const name of fixtures) {
    it(name, () => {
      const specPath = join(fixturesDir, name);
      const plan = loadSpec(specPath);

      // TS SDK encodes → Apple's WorkoutPlan(from:) parses → spec JSON
      const bytes = encodeWorkoutPlan(plan);
      const parsed = swiftParse(bytes);

      // Strict equality: every field Apple surfaces must be accounted for
      // in the original spec (and vice versa). Normalisation only drops
      // undefined-valued keys and uppercases the UUID.
      expect(normalize(parsed)).toEqual(normalize(plan));
    });
  }
});
