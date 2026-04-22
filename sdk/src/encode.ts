// Proto field numbers and enum values pinned by diffing Swift/WorkoutKit output.
// See ../../README.md for the reverse-engineering methodology.

import { Writer } from "./wire.ts";
import {
  ActivityType,
  type AlertJson,
  type AlertMetric,
  type CadenceUnit,
  type CustomWorkoutJson,
  type GoalJson,
  type HeartRateUnit,
  type IntervalBlockJson,
  type IntervalStepJson,
  type Location,
  type PacerWorkoutJson,
  type PowerUnit,
  type Purpose,
  type Quantity,
  type SbrActivityJson,
  type SingleGoalWorkoutJson,
  type SpeedJson,
  type StepJson,
  type SwimBikeRunWorkoutJson,
  type SwimmingLocation,
  type WorkoutPlanJson,
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

const GOAL_TYPE_PROTO: Record<GoalJson["type"], number> = {
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

const GOAL_VALUE_FIELD: Record<Exclude<GoalJson["type"], "open">, number> = {
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

function writeGoal(w: Writer, g: GoalJson): void {
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

// ---- Alerts -------------------------------------------------------------
// See artifacts/alerts-wire-format.md for the full schema discovery notes.

// apple.workout.AlertTargetType — identifies the metric + current/average axis.
const ALERT_TARGET_TYPE = {
  unknownMetric: 0,
  averageSpeed: 1,
  currentSpeed: 2,
  currentCadence: 3,
  currentPower: 4,
  currentHeartRate: 5,
  averagePower: 6,
} as const;

// apple.workout.AlertTargetKind — which shape the target takes.
const ALERT_TARGET_KIND = {
  unknown: 0,
  value: 1,
  range: 2,
  zone: 3,
} as const;

// WorkoutAlert message fields that carry the per-metric sub-alert.
const WORKOUT_ALERT_FIELD = {
  speed: 4,
  cadence: 5,
  power: 6,
  heartRate: 7,
} as const;

const POWER_UNIT_PROTO: Record<PowerUnit, number> = {
  watts: 1,
  kilowatts: 2,
};

function powerTargetType(metric: AlertMetric | undefined): number {
  return metric === "average"
    ? ALERT_TARGET_TYPE.averagePower
    : ALERT_TARGET_TYPE.currentPower;
}

function speedTargetType(metric: AlertMetric | undefined): number {
  return metric === "average"
    ? ALERT_TARGET_TYPE.averageSpeed
    : ALERT_TARGET_TYPE.currentSpeed;
}

// PowerValue is the standard {unit, value} Quantity shape.
function writePowerValue(w: Writer, p: Quantity<PowerUnit>): void {
  w.uint32Required(1, POWER_UNIT_PROTO[p.unit]);
  w.doubleRequired(2, p.value);
}

// HeartRateValue has a single double field (bpm). Apple resolves
// `WorkoutAlertMetric.countPerMinute` to a canonical UnitFrequency, so the
// magnitude on the wire is exactly beats per minute.
function writeHeartRateValue(w: Writer, hr: Quantity<HeartRateUnit>): void {
  w.doubleRequired(1, hr.value);
}

// SpeedValue is a (distance, time) pair — covers both m/s and pace shapes.
function writeSpeedValue(w: Writer, s: SpeedJson): void {
  w.message(1, (d) => writeLengthQuantity(d, s.distance));
  w.message(2, (t) => writeDurationQuantity(t, s.time));
}

// CadenceValue is a (count, duration) pair. Users only ever supply
// "countPerMinute"; anchor the duration at 1 minute so `count` holds cpm.
function writeCadenceValue(w: Writer, c: Quantity<CadenceUnit>): void {
  w.uint32Required(1, Math.round(c.value));
  w.message(2, (d) => writeDurationQuantity(d, { value: 1, unit: "minutes" }));
}

function writeAlert(w: Writer, a: AlertJson): void {
  switch (a.type) {
    case "heartRateZone":
      w.uint32Required(1, ALERT_TARGET_TYPE.currentHeartRate);
      w.uint32Required(2, ALERT_TARGET_KIND.zone);
      w.message(WORKOUT_ALERT_FIELD.heartRate, (sub) => {
        sub.message(1, (zt) => zt.uint32Required(1, a.zone));
      });
      return;
    case "heartRateRange":
      w.uint32Required(1, ALERT_TARGET_TYPE.currentHeartRate);
      w.uint32Required(2, ALERT_TARGET_KIND.range);
      w.message(WORKOUT_ALERT_FIELD.heartRate, (sub) => {
        sub.message(2, (range) => {
          range.message(1, (m) => writeHeartRateValue(m, a.min));
          range.message(2, (m) => writeHeartRateValue(m, a.max));
        });
      });
      return;
    case "powerZone":
      w.uint32Required(1, ALERT_TARGET_TYPE.currentPower);
      w.uint32Required(2, ALERT_TARGET_KIND.zone);
      w.message(WORKOUT_ALERT_FIELD.power, (sub) => {
        sub.message(3, (zt) => zt.uint32Required(1, a.zone));
      });
      return;
    case "powerRange":
      w.uint32Required(1, powerTargetType(a.metric));
      w.uint32Required(2, ALERT_TARGET_KIND.range);
      w.message(WORKOUT_ALERT_FIELD.power, (sub) => {
        sub.message(2, (range) => {
          range.message(1, (m) => writePowerValue(m, a.min));
          range.message(2, (m) => writePowerValue(m, a.max));
        });
      });
      return;
    case "powerThreshold":
      w.uint32Required(1, powerTargetType(a.metric));
      w.uint32Required(2, ALERT_TARGET_KIND.value);
      w.message(WORKOUT_ALERT_FIELD.power, (sub) => {
        sub.message(1, (target) => writePowerValue(target, a.threshold));
      });
      return;
    case "speedRange":
      w.uint32Required(1, speedTargetType(a.metric));
      w.uint32Required(2, ALERT_TARGET_KIND.range);
      w.message(WORKOUT_ALERT_FIELD.speed, (sub) => {
        sub.message(2, (range) => {
          range.message(1, (m) => writeSpeedValue(m, a.min));
          range.message(2, (m) => writeSpeedValue(m, a.max));
        });
      });
      return;
    case "speedThreshold":
      w.uint32Required(1, speedTargetType(a.metric));
      w.uint32Required(2, ALERT_TARGET_KIND.value);
      w.message(WORKOUT_ALERT_FIELD.speed, (sub) => {
        sub.message(1, (target) => writeSpeedValue(target, a.threshold));
      });
      return;
    case "cadenceThreshold":
      w.uint32Required(1, ALERT_TARGET_TYPE.currentCadence);
      w.uint32Required(2, ALERT_TARGET_KIND.value);
      w.message(WORKOUT_ALERT_FIELD.cadence, (sub) => {
        sub.message(1, (target) => writeCadenceValue(target, a.threshold));
      });
      return;
    case "cadenceRange":
      w.uint32Required(1, ALERT_TARGET_TYPE.currentCadence);
      w.uint32Required(2, ALERT_TARGET_KIND.range);
      w.message(WORKOUT_ALERT_FIELD.cadence, (sub) => {
        sub.message(2, (range) => {
          range.message(1, (m) => writeCadenceValue(m, a.min));
          range.message(2, (m) => writeCadenceValue(m, a.max));
        });
      });
      return;
  }
}

function writeStep(w: Writer, s: StepJson): void {
  w.message(1, (sub) => writeGoal(sub, s.goal));
  if (s.alert) w.message(2, (sub) => writeAlert(sub, s.alert!));
  w.string(3, s.displayName);
}

function writeIntervalStep(w: Writer, is: IntervalStepJson): void {
  w.uint32Required(1, PURPOSE_PROTO[is.purpose]);
  w.message(2, (sub) => writeStep(sub, is.step));
}

function writeBlock(w: Writer, b: IntervalBlockJson): void {
  for (const step of b.steps) {
    w.message(1, (sub) => writeIntervalStep(sub, step));
  }
  w.uint32(2, b.iterations);
}

function writeCustomWorkout(w: Writer, c: CustomWorkoutJson): void {
  w.uint32(1, ActivityType[c.activity]);
  w.uint32(2, LOCATION_PROTO[c.location]);
  w.string(3, c.displayName);
  if (c.warmup) w.message(4, (sub) => writeStep(sub, c.warmup!));
  for (const b of c.blocks) w.message(5, (sub) => writeBlock(sub, b));
  if (c.cooldown) w.message(6, (sub) => writeStep(sub, c.cooldown!));
}

function writeSingleGoalWorkout(w: Writer, g: SingleGoalWorkoutJson): void {
  w.uint32(1, ActivityType[g.activity]);
  w.uint32(2, LOCATION_PROTO[g.location]);
  w.uint32(3, SWIM_LOCATION_PROTO[g.swimmingLocation ?? "unknown"]);
  w.message(4, (sub) => writeGoal(sub, g.goal));
}

function writePacerWorkout(w: Writer, p: PacerWorkoutJson): void {
  w.uint32(1, ActivityType[p.activity]);
  w.uint32(2, LOCATION_PROTO[p.location]);
  w.message(3, (sub) => writeLengthQuantity(sub, p.distance));
  w.message(4, (sub) => writeDurationQuantity(sub, p.time));
}

function writeSbrActivity(w: Writer, a: SbrActivityJson): void {
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

function writeSwimBikeRunWorkout(w: Writer, s: SwimBikeRunWorkoutJson): void {
  for (const a of s.activities) {
    w.message(1, (sub) => writeSbrActivity(sub, a));
  }
  w.string(2, s.displayName);
}

export function encodeWorkoutPlan(plan: WorkoutPlanJson): Uint8Array {
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
