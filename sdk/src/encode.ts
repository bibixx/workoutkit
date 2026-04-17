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
  type Purpose,
  type Step,
  type WorkoutPlan,
} from "./schema.ts";

// proto enum: apple.workout.WorkoutSessionLocationType  (values offset from HK)
const LOCATION_PROTO: Record<Location, number> = {
  unknown: 0, // omitted on the wire when 0
  indoor: 2,
  outdoor: 3,
};

// proto enum: apple.workout.IntervalStep.Purpose
const PURPOSE_PROTO: Record<Purpose, number> = {
  work: 1, // UNKNOWN=0
  recovery: 2,
};

// proto enum: apple.workout.WorkoutGoal.Type
const GOAL_TYPE_PROTO: Record<Goal["type"], number> = {
  open: 4, // UNKNOWN=0
  time: 1,
  energy: 2,
  distance: 3,
  poolSwimDistanceWithTime: 5,
};

// proto enum: apple.workout.DistanceValue.Unit
const LENGTH_UNIT_PROTO = {
  meters: 1, // UNKNOWN=0
  kilometers: 2,
  feet: 3,
  yards: 4,
  miles: 5,
} as const;

// proto enum: apple.workout.TimeValue.Unit
const DURATION_UNIT_PROTO = {
  seconds: 1, // UNKNOWN=0
  minutes: 2,
  hours: 3,
} as const;

// proto enum: apple.workout.EnergyValue.Unit
const ENERGY_UNIT_PROTO = {
  kilocalories: 1, // UNKNOWN=0
  kilojoules: 2,
} as const;

// DistanceValue / TimeValue / EnergyValue all share shape {unit: enum, value: double}
function writeQuantity(w: Writer, unit: number, value: number): void {
  w.uint32Required(1, unit);
  w.doubleRequired(2, value);
}

// proto oneof field numbers on WorkoutGoal. Pinned by diffing Swift output:
// TimeValue observed at tag 2, DistanceValue at tag 4. Energy / poolSwim
// remain to be confirmed by fixtures that exercise them.
const GOAL_VALUE_FIELD: Record<Exclude<Goal["type"], "open">, number> = {
  time: 2,
  energy: 3,
  distance: 4,
  poolSwimDistanceWithTime: 5,
};

function writeGoal(w: Writer, g: Goal): void {
  w.uint32Required(1, GOAL_TYPE_PROTO[g.type]);
  switch (g.type) {
    case "open":
      return;
    case "time":
      w.message(GOAL_VALUE_FIELD.time, (sub) =>
        writeQuantity(sub, DURATION_UNIT_PROTO[g.time.unit], g.time.value),
      );
      return;
    case "distance":
      w.message(GOAL_VALUE_FIELD.distance, (sub) =>
        writeQuantity(sub, LENGTH_UNIT_PROTO[g.distance.unit], g.distance.value),
      );
      return;
    case "energy":
      w.message(GOAL_VALUE_FIELD.energy, (sub) =>
        writeQuantity(sub, ENERGY_UNIT_PROTO[g.energy.unit], g.energy.value),
      );
      return;
    case "poolSwimDistanceWithTime":
      w.message(GOAL_VALUE_FIELD.poolSwimDistanceWithTime, (sub) => {
        const { distance, time } = g.poolSwimDistanceWithTime;
        sub.message(1, (d) =>
          writeQuantity(d, LENGTH_UNIT_PROTO[distance.unit], distance.value),
        );
        sub.message(2, (t) =>
          writeQuantity(t, DURATION_UNIT_PROTO[time.unit], time.value),
        );
      });
      return;
  }
}

function writeStep(w: Writer, s: Step): void {
  w.message(1, (sub) => writeGoal(sub, s.goal));
  // field 2 = alert (future)
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

function writeCustomWorkoutComposition(w: Writer, c: CustomWorkout): void {
  w.uint32(1, ActivityType[c.activity]);
  w.uint32(2, LOCATION_PROTO[c.location]);
  w.string(3, c.displayName);
  if (c.warmup) w.message(4, (sub) => writeStep(sub, c.warmup!));
  for (const b of c.blocks) w.message(5, (sub) => writeBlock(sub, b));
  if (c.cooldown) w.message(6, (sub) => writeStep(sub, c.cooldown!));
}

export function encodeWorkoutPlan(plan: WorkoutPlan): Uint8Array {
  const w = new Writer();
  w.string(9, plan.referenceId);
  w.message(11, (sub) => writeCustomWorkoutComposition(sub, plan.custom));
  // Version trailers. Apple's serializer emits these; values pinned from
  // observed Swift output.
  w.uint32Required(1000, 1); // majorVersion
  // 1001 = minorVersion (0, omitted)
  w.uint32Required(1002, 5); // privateVersion
  return w.finish();
}
