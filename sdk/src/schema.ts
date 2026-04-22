// Public JSON-shape types — WorkoutKit-shaped, not proto-shaped.
// These describe the wire-equivalent JSON that class instances serialize to
// via `toJSON()` (and hydrate from via `fromJson()`). The mutable-class API
// in `classes.ts` builds on top of these.

// HKWorkoutActivityType raw values. Keep them explicit so the TS side reads
// the same as WorkoutKit's Swift API.
export const ActivityType = {
  americanFootball: 1,
  archery: 2,
  australianFootball: 3,
  badminton: 4,
  baseball: 5,
  basketball: 6,
  bowling: 7,
  boxing: 8,
  climbing: 9,
  cricket: 10,
  crossTraining: 11,
  curling: 12,
  cycling: 13,
  dance: 14,
  elliptical: 16,
  equestrianSports: 17,
  fencing: 18,
  fishing: 19,
  functionalStrengthTraining: 20,
  golf: 21,
  gymnastics: 22,
  handball: 23,
  hiking: 24,
  hockey: 25,
  hunting: 26,
  lacrosse: 27,
  martialArts: 28,
  mindAndBody: 29,
  paddleSports: 31,
  play: 32,
  preparationAndRecovery: 33,
  racquetball: 34,
  rowing: 35,
  rugby: 36,
  running: 37,
  sailing: 38,
  skatingSports: 39,
  snowSports: 40,
  soccer: 41,
  softball: 42,
  squash: 43,
  stairClimbing: 44,
  surfingSports: 45,
  swimming: 46,
  tableTennis: 47,
  tennis: 48,
  trackAndField: 49,
  traditionalStrengthTraining: 50,
  volleyball: 51,
  walking: 52,
  waterFitness: 53,
  waterPolo: 54,
  waterSports: 55,
  wrestling: 56,
  yoga: 57,
  barre: 58,
  coreTraining: 59,
  crossCountrySkiing: 60,
  downhillSkiing: 61,
  flexibility: 62,
  highIntensityIntervalTraining: 63,
  jumpRope: 64,
  kickboxing: 65,
  pilates: 66,
  snowboarding: 67,
  stairs: 68,
  stepTraining: 69,
  wheelchairWalkPace: 70,
  wheelchairRunPace: 71,
  taiChi: 72,
  mixedCardio: 73,
  handCycling: 74,
  discSports: 75,
  fitnessGaming: 76,
  cardioDance: 77,
  socialDance: 78,
  pickleball: 79,
  cooldown: 80,
  swimBikeRun: 82,
  transition: 83,
  underwaterDiving: 84,
  other: 3000,
} as const;
export type ActivityName = keyof typeof ActivityType;

export type Location = "unknown" | "indoor" | "outdoor";
export type SwimmingLocation = "unknown" | "pool" | "openWater";

export type LengthUnit = "meters" | "kilometers" | "feet" | "yards" | "miles";
export type DurationUnit = "seconds" | "minutes" | "hours";
export type EnergyUnit = "kilocalories" | "kilojoules";
export type PowerUnit = "watts" | "kilowatts";
export type HeartRateUnit = "beatsPerMinute";
export type CadenceUnit = "countPerMinute";

export type Quantity<U extends string> = { value: number; unit: U };

// Speed is stored on the wire as a (distance, time) pair, which covers both
// speed semantics (m/s) and pace semantics (min/mile) without lossy conversion.
export type SpeedJson = {
  distance: Quantity<LengthUnit>;
  time: Quantity<DurationUnit>;
};

// Power and speed alerts can target either instantaneous or average metric;
// heart-rate and cadence alerts are always "current" on Apple's API surface.
export type AlertMetric = "current" | "average";

export type GoalJson =
  | { type: "open" }
  | { type: "time"; time: Quantity<DurationUnit> }
  | { type: "distance"; distance: Quantity<LengthUnit> }
  | { type: "energy"; energy: Quantity<EnergyUnit> }
  | {
      type: "poolSwimDistanceWithTime";
      poolSwimDistanceWithTime: {
        distance: Quantity<LengthUnit>;
        time: Quantity<DurationUnit>;
      };
    };

export type AlertJson =
  | { type: "heartRateZone"; zone: number }
  | {
      type: "heartRateRange";
      min: Quantity<HeartRateUnit>;
      max: Quantity<HeartRateUnit>;
    }
  | { type: "powerZone"; zone: number }
  | {
      type: "powerRange";
      min: Quantity<PowerUnit>;
      max: Quantity<PowerUnit>;
      metric?: AlertMetric;
    }
  | {
      type: "powerThreshold";
      threshold: Quantity<PowerUnit>;
      metric?: AlertMetric;
    }
  | {
      type: "speedRange";
      min: SpeedJson;
      max: SpeedJson;
      metric?: AlertMetric;
    }
  | {
      type: "speedThreshold";
      threshold: SpeedJson;
      metric?: AlertMetric;
    }
  | { type: "cadenceThreshold"; threshold: Quantity<CadenceUnit> }
  | {
      type: "cadenceRange";
      min: Quantity<CadenceUnit>;
      max: Quantity<CadenceUnit>;
    };

export type StepJson = {
  displayName?: string;
  goal: GoalJson;
  alert?: AlertJson;
};

export type Purpose = "work" | "recovery";

export type IntervalStepJson = {
  purpose: Purpose;
  step: StepJson;
};

export type IntervalBlockJson = {
  iterations: number;
  steps: IntervalStepJson[];
};

export type CustomWorkoutJson = {
  activity: ActivityName;
  location: Location;
  displayName?: string;
  warmup?: StepJson;
  blocks: IntervalBlockJson[];
  cooldown?: StepJson;
};

export type SingleGoalWorkoutJson = {
  activity: ActivityName;
  location: Location;
  swimmingLocation?: SwimmingLocation; // default "unknown"
  goal: GoalJson;
};

export type PacerWorkoutJson = {
  activity: ActivityName;
  location: Location;
  distance: Quantity<LengthUnit>;
  time: Quantity<DurationUnit>;
};

export type SbrActivityJson =
  | { kind: "swimming"; swimmingLocation?: SwimmingLocation }
  | { kind: "cycling"; location?: Location }
  | { kind: "running"; location?: Location };

export type SwimBikeRunWorkoutJson = {
  displayName?: string;
  activities: SbrActivityJson[];
};

// Exactly one of custom/goal/pacer/swimBikeRun must be present. The
// discriminated structure is enforced at the encoder level.
export type WorkoutPlanJson = {
  referenceId: string;
  custom?: CustomWorkoutJson;
  goal?: SingleGoalWorkoutJson;
  pacer?: PacerWorkoutJson;
  swimBikeRun?: SwimBikeRunWorkoutJson;
};
