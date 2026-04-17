import { readFileSync } from "node:fs";
import type { WorkoutPlan } from "workout-file-sdk";

// The fixture JSON shape IS the public SDK schema — no translation needed.
export function loadSpec(path: string): WorkoutPlan {
  return JSON.parse(readFileSync(path, "utf8")) as WorkoutPlan;
}
