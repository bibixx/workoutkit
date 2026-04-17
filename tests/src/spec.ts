import { readFileSync } from "node:fs";
import type { WorkoutPlanJson } from "@bibixx/workoutkit";

// The fixture JSON shape IS the public SDK schema — no translation needed.
export function loadSpec(path: string): WorkoutPlanJson {
  return JSON.parse(readFileSync(path, "utf8")) as WorkoutPlanJson;
}
