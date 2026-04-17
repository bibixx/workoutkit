// Read the same spec JSON the Swift CLI consumes and lift it into the SDK's
// public schema types, so a single source drives both encoders.

import { readFileSync } from "node:fs";
import type {
  CustomWorkout,
  Goal,
  IntervalBlock,
  IntervalStep,
  Step,
  WorkoutPlan,
} from "workout-file-sdk";

type SpecStep = { displayName?: string; goal: Goal };
type SpecIntervalStep = { purpose: "work" | "recovery"; step: SpecStep };
type SpecBlock = { iterations: number; steps: SpecIntervalStep[] };
type SpecCustom = {
  activity: CustomWorkout["activity"];
  location: CustomWorkout["location"];
  swimmingLocation?: string;
  displayName?: string;
  warmup?: SpecStep;
  blocks: SpecBlock[];
  cooldown?: SpecStep;
};
type SpecRoot = { referenceId: string; custom?: SpecCustom };

export function loadSpec(path: string): WorkoutPlan {
  const raw = JSON.parse(readFileSync(path, "utf8")) as SpecRoot;
  if (!raw.custom) {
    throw new Error(`${path}: only custom workouts are supported by the SDK yet`);
  }
  const s = raw.custom;
  const custom: CustomWorkout = {
    activity: s.activity,
    location: s.location,
    displayName: s.displayName,
    warmup: s.warmup as Step | undefined,
    blocks: s.blocks.map(
      (b): IntervalBlock => ({
        iterations: b.iterations,
        steps: b.steps.map(
          (is): IntervalStep => ({
            purpose: is.purpose,
            step: is.step as Step,
          }),
        ),
      }),
    ),
    cooldown: s.cooldown as Step | undefined,
  };
  return { referenceId: raw.referenceId, custom };
}
