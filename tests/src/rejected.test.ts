// Fixtures in tests/fixtures/rejected/ describe specs Apple's parser REJECTS.
// This test asserts that:
//  1. The TS SDK happily encodes the bytes (we don't duplicate Apple's
//     validation — garbage in, garbage out is fine)
//  2. Apple's parser refuses them at `WorkoutPlan(from: Data)` time
//  3. The error matches the `_expectError` annotation in the fixture
//
// This is how we catalog WorkoutKit's validation surface. If Apple loosens a
// rule in a future iOS release, the corresponding test here fails, and we
// move the fixture from rejected/ into the happy set.

import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { encode } from "@bibixx/workoutkit/encode";
import { swiftParse } from "./swift-parse.ts";

const here = dirname(fileURLToPath(import.meta.url));
const rejectedDir = resolve(here, "../fixtures/rejected");

type RejectedSpec = {
  _why: string;
  _expectError: string;
} & Record<string, unknown>;

const fixtures = readdirSync(rejectedDir)
  .filter((f) => f.endsWith(".spec.json"))
  .sort();

describe("Apple parser rejects known-invalid fixtures", () => {
  for (const name of fixtures) {
    it(name, () => {
      const spec = JSON.parse(readFileSync(join(rejectedDir, name), "utf8")) as RejectedSpec;

      // The SDK should encode without objection — our encoder is a dumb
      // serializer, not a validator.
      const bytes = encode(spec as unknown as Parameters<typeof encode>[0]);
      expect(bytes.length).toBeGreaterThan(0);

      // Apple's parser must refuse the bytes. We capture the thrown error
      // and assert it contains the expected error token.
      try {
        swiftParse(bytes);
        throw new Error(
          `Expected Apple to reject ${name} with "${spec._expectError}", but parse succeeded.`,
        );
      } catch (err) {
        const msg = String((err as Error & { stderr?: Buffer }).stderr ?? err);
        expect(msg).toContain(spec._expectError);
      }
    });
  }
});
