import { readFile, writeFile } from "node:fs/promises";

import { decode } from "./decode-api.ts";
import { encode } from "./encode-api.ts";
import type { WorkoutPlan } from "./classes.ts";
import type { WorkoutPlanJson } from "./schema.ts";

export async function saveWorkoutPlan(
  plan: WorkoutPlan | WorkoutPlanJson,
  path: string,
): Promise<void> {
  await writeFile(path, encode(plan));
}

export async function loadWorkoutPlan(path: string): Promise<WorkoutPlan> {
  const bytes = new Uint8Array(await readFile(path));
  return decode(bytes);
}
