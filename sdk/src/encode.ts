// Proto field numbers and enum values pinned by diffing Swift/WorkoutKit output.
// See ../../README.md for the reverse-engineering methodology.

import { Writer } from "./wire.ts";
import {
  ActivityType,
  type CustomWorkout,
  type Goal,
  type IntervalBlock,
  type IntervalStep,
  type Location,
  type PacerWorkout,
  type Purpose,
  type SbrActivity,
  type SingleGoalWorkout,
  type Step,
  type SwimBikeRunWorkout,
  type SwimmingLocation,
  type WorkoutPlan,
} from "./schema.ts";

// WorkoutPlan composition field numbers (one of these carries the workout).
const PLAN_FIELD = {
  goal: 10,
  custom: 11,
  pacer: 13,
  swimBikeRun: 14,
} as const;

// proto enum: apple.workout.WorkoutSessionLocationType (offset +1 from HK)
const LOCATION_PROTO: Record<Location, number> = {
  unknown: 0,
  indoor: 2,
  outdoor: 3,
};

// proto enum: apple.workout.SwimmingLocationType (matches HK raw values)
const SWIM_LOCATION_PROTO: Record<SwimmingLocation, number> = {
  unknown: 0,
  pool: 1,
  openWater: 2,
};

const PURPOSE_PROTO: Record<Purpose, number> = { work: 1, recovery: 2 };

const GOAL_TYPE_PROTO: Record<Goal["type"], number> = {
  open: 4,
  time: 1,
  energy: 2,
  distance: 3,
  poolSwimDistanceWithTime: 5,
};

const LENGTH_UNIT_PROTO = {
  meters: 1,
  kilometers: 2,
  feet: 3,
  yards: 4,
  miles: 5,
} as const;
const DURATION_UNIT_PROTO = {
  seconds: 1,
  minutes: 2,
  hours: 3,
} as const;
const ENERGY_UNIT_PROTO = {
  kilocalories: 1,
  kilojoules: 2,
} as const;

const GOAL_VALUE_FIELD: Record<Exclude<Goal["type"], "open">, number> = {
  time: 2,
  energy: 3,
  distance: 4,
  poolSwimDistanceWithTime: 5,
};

// DistanceValue / TimeValue / EnergyValue all share shape {unit: enum, value: double}
function writeQuantity(w: Writer, unit: number, value: number): void {
  w.uint32Required(1, unit);
  w.doubleRequired(2, value);
}

function writeLengthQuantity(
  w: Writer,
  q: { value: number; unit: keyof typeof LENGTH_UNIT_PROTO },
): void {
  writeQuantity(w, LENGTH_UNIT_PROTO[q.unit], q.value);
}
function writeDurationQuantity(
  w: Writer,
  q: { value: number; unit: keyof typeof DURATION_UNIT_PROTO },
): void {
  writeQuantity(w, DURATION_UNIT_PROTO[q.unit], q.value);
}
function writeEnergyQuantity(
  w: Writer,
  q: { value: number; unit: keyof typeof ENERGY_UNIT_PROTO },
): void {
  writeQuantity(w, ENERGY_UNIT_PROTO[q.unit], q.value);
}

function writeGoal(w: Writer, g: Goal): void {
  w.uint32Required(1, GOAL_TYPE_PROTO[g.type]);
  switch (g.type) {
    case "open":
      return;
    case "time":
      w.message(GOAL_VALUE_FIELD.time, (sub) => writeDurationQuantity(sub, g.time));
      return;
    case "distance":
      w.message(GOAL_VALUE_FIELD.distance, (sub) => writeLengthQuantity(sub, g.distance));
      return;
    case "energy":
      w.message(GOAL_VALUE_FIELD.energy, (sub) => writeEnergyQuantity(sub, g.energy));
      return;
    case "poolSwimDistanceWithTime":
      w.message(GOAL_VALUE_FIELD.poolSwimDistanceWithTime, (sub) => {
        const { distance, time } = g.poolSwimDistanceWithTime;
        sub.message(1, (d) => writeLengthQuantity(d, distance));
        sub.message(2, (t) => writeDurationQuantity(t, time));
      });
      return;
  }
}

function writeStep(w: Writer, s: Step): void {
  w.message(1, (sub) => writeGoal(sub, s.goal));
  // field 2 = alert (not supported yet)
  w.string(3, s.displayName);
}

function writeIntervalStep(w: Writer, is: IntervalStep): void {
  w.uint32Required(1, PURPOSE_PROTO[is.purpose]);
  w.message(2, (sub) => writeStep(sub, is.step));
}

function writeBlock(w: Writer, b: IntervalBlock): void {
  for (const step of b.steps) {
    w.message(1, (sub) => writeIntervalStep(sub, step));
  }
  w.uint32(2, b.iterations);
}

function writeCustomWorkout(w: Writer, c: CustomWorkout): void {
  w.uint32(1, ActivityType[c.activity]);
  w.uint32(2, LOCATION_PROTO[c.location]);
  w.string(3, c.displayName);
  if (c.warmup) w.message(4, (sub) => writeStep(sub, c.warmup!));
  for (const b of c.blocks) w.message(5, (sub) => writeBlock(sub, b));
  if (c.cooldown) w.message(6, (sub) => writeStep(sub, c.cooldown!));
}

function writeSingleGoalWorkout(w: Writer, g: SingleGoalWorkout): void {
  w.uint32(1, ActivityType[g.activity]);
  w.uint32(2, LOCATION_PROTO[g.location]);
  w.uint32(3, SWIM_LOCATION_PROTO[g.swimmingLocation ?? "unknown"]);
  w.message(4, (sub) => writeGoal(sub, g.goal));
}

function writePacerWorkout(w: Writer, p: PacerWorkout): void {
  w.uint32(1, ActivityType[p.activity]);
  w.uint32(2, LOCATION_PROTO[p.location]);
  w.message(3, (sub) => writeLengthQuantity(sub, p.distance));
  w.message(4, (sub) => writeDurationQuantity(sub, p.time));
}

function writeSbrActivity(w: Writer, a: SbrActivity): void {
  switch (a.kind) {
    case "swimming":
      w.uint32(1, ActivityType.swimming);
      // Apple's serializer fixes sessionLocation to 1 for SBR swim legs (observed).
      w.uint32Required(2, 1);
      w.uint32Required(3, SWIM_LOCATION_PROTO[a.swimmingLocation ?? "unknown"]);
      return;
    case "cycling":
      w.uint32(1, ActivityType.cycling);
      w.uint32Required(2, LOCATION_PROTO[a.location ?? "unknown"]);
      w.uint32Required(3, 0);
      return;
    case "running":
      w.uint32(1, ActivityType.running);
      w.uint32Required(2, LOCATION_PROTO[a.location ?? "unknown"]);
      w.uint32Required(3, 0);
      return;
  }
}

function writeSwimBikeRunWorkout(w: Writer, s: SwimBikeRunWorkout): void {
  for (const a of s.activities) {
    w.message(1, (sub) => writeSbrActivity(sub, a));
  }
  w.string(2, s.displayName);
}

export function encodeWorkoutPlan(plan: WorkoutPlan): Uint8Array {
  const present = [plan.custom, plan.goal, plan.pacer, plan.swimBikeRun]
    .filter((v) => v !== undefined).length;
  if (present === 0) {
    throw new Error("WorkoutPlan must contain one of: custom | goal | pacer | swimBikeRun");
  }
  if (present > 1) {
    throw new Error(
      "WorkoutPlan must contain exactly one of: custom | goal | pacer | swimBikeRun",
    );
  }

  const w = new Writer();
  w.string(9, plan.referenceId);
  if (plan.custom)      w.message(PLAN_FIELD.custom,      (sub) => writeCustomWorkout(sub, plan.custom!));
  if (plan.goal)        w.message(PLAN_FIELD.goal,        (sub) => writeSingleGoalWorkout(sub, plan.goal!));
  if (plan.pacer)       w.message(PLAN_FIELD.pacer,       (sub) => writePacerWorkout(sub, plan.pacer!));
  if (plan.swimBikeRun) w.message(PLAN_FIELD.swimBikeRun, (sub) => writeSwimBikeRunWorkout(sub, plan.swimBikeRun!));

  // Version trailers. Pinned from Apple's output.
  w.uint32Required(1000, 1); // majorVersion
  w.uint32Required(1002, 5); // privateVersion
  return w.finish();
}
