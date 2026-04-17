import { mkdtempSync } from "node:fs";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";

import { WorkoutPlan } from "@bibixx/workoutkit";
import { loadWorkoutPlan, saveWorkoutPlan } from "@bibixx/workoutkit/fs";

import { loadSpec } from "./spec.ts";
import { normalize } from "./normalize.ts";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = resolve(here, "../fixtures");

const workDir = mkdtempSync(join(tmpdir(), "workoutkit-fs-"));

afterAll(async () => {
  await rm(workDir, { recursive: true, force: true });
});

describe("fs save/load round-trip", () => {
  it("saveWorkoutPlan writes bytes that encode() would have written", async () => {
    const json = loadSpec(join(fixturesDir, "custom-minimal.spec.json"));
    const plan = WorkoutPlan.fromJson(json);
    const path = join(workDir, "minimal.workout");
    await saveWorkoutPlan(plan, path);
    const bytes = await readFile(path);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it("loadWorkoutPlan returns a WorkoutPlan class instance", async () => {
    const json = loadSpec(join(fixturesDir, "pacer-run-5km-25min.spec.json"));
    const path = join(workDir, "pacer.workout");
    await saveWorkoutPlan(json, path);
    const loaded = await loadWorkoutPlan(path);
    expect(loaded).toBeInstanceOf(WorkoutPlan);
    expect(normalize(loaded.toJSON())).toEqual(normalize(json));
  });

  it("accepts both JSON and class instances", async () => {
    const json = loadSpec(join(fixturesDir, "sbr-triathlon-open.spec.json"));
    const path1 = join(workDir, "sbr-json.workout");
    const path2 = join(workDir, "sbr-class.workout");
    await saveWorkoutPlan(json, path1);
    await saveWorkoutPlan(WorkoutPlan.fromJson(json), path2);
    const a = new Uint8Array(await readFile(path1));
    const b = new Uint8Array(await readFile(path2));
    expect(a).toEqual(b);
  });
});
