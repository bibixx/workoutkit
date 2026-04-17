import { WorkoutPlan } from "./classes.ts";
import { decodeWorkoutPlanJson } from "./decode.ts";

export function decode(bytes: Uint8Array): WorkoutPlan {
  return WorkoutPlan.fromJson(decodeWorkoutPlanJson(bytes));
}
