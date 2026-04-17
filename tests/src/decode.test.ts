import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { WorkoutPlan } from "@bibixx/workoutkit";
import { encode } from "@bibixx/workoutkit/encode";
import { decode } from "@bibixx/workoutkit/decode";

import { loadSpec } from "./spec.ts";
import { normalize } from "./normalize.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(here, "../fixtures");

const fixtures = readdirSync(fixturesDir)
  .filter((f) => f.endsWith(".spec.json"))
  .sort();

describe("encode → decode round-trip", () => {
  for (const name of fixtures) {
    it(name, () => {
      const json = loadSpec(join(fixturesDir, name));
      const bytes = encode(json);
      const decoded = decode(bytes);
      expect(decoded).toBeInstanceOf(WorkoutPlan);
      expect(normalize(decoded.toJSON())).toEqual(normalize(json));
    });
  }
});

describe("decode tolerates Apple-produced bytes (parser via real files)", () => {
  // Snapshots are byte-exact to Apple's output for these fixtures.
  const snapshotDir = resolve(here, "../snapshots");
  // Only custom-pool-swim has a pinned snapshot; exercise it.
  it("custom-pool-swim.workout", async () => {
    const { readFile } = await import("node:fs/promises");
    const bytes = new Uint8Array(
      await readFile(join(snapshotDir, "custom-pool-swim.workout")),
    );
    const decoded = decode(bytes);
    const expected = loadSpec(join(fixturesDir, "custom-pool-swim.spec.json"));
    expect(normalize(decoded.toJSON())).toEqual(normalize(expected));
  });
});
