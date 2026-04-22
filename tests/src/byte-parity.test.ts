// Determinism canary. Not a correctness test — its job is to catch
// non-determinism regressions in the TS encoder (e.g. Map iteration order
// affecting output). When this fires but semantic tests stay green, the
// cause is either a determinism bug or an intentional SDK change — in the
// latter case, regenerate with `scripts/update-snapshots.sh`.

import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { encode } from "@bibixx/workoutkit/encode";
import { loadSpec } from "./spec.ts";
import { byteMismatchReport } from "./debug.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixtureDir = resolve(here, "../fixtures");
const snapshotDir = resolve(here, "../snapshots");

describe("determinism canary", () => {
  it("custom-pool-swim.spec.json → stable bytes", () => {
    const spec = loadSpec(join(fixtureDir, "custom-pool-swim.spec.json"));
    const actual = encode(spec);
    const expected = new Uint8Array(readFileSync(join(snapshotDir, "custom-pool-swim.workout")));

    const equal = actual.length === expected.length && actual.every((b, i) => b === expected[i]);

    if (!equal) {
      throw new Error(
        "custom-pool-swim byte snapshot drifted.\n" +
          "If this is an intentional SDK change, run:\n" +
          "  scripts/update-snapshots.sh\n\n" +
          byteMismatchReport(expected, actual),
      );
    }
    expect(actual.length).toBe(expected.length);
  });
});
