// Public SDK types — WorkoutKit-shaped, not proto-shaped.

// HKWorkoutActivityType raw values. Keep them explicit so the TS side reads
// the same as WorkoutKit's Swift API.
export const ActivityType = {
  running: 37,
  cycling: 13,
  swimming: 46,
  walking: 52,
  hiking: 17,
  rowing: 35,
  functionalStrength: 20,
  traditionalStrength: 50,
  coreTraining: 62,
  yoga: 57,
  highIntensityIntervalTraining: 63,
} as const;
export type ActivityName = keyof typeof ActivityType;

export type Location = "unknown" | "indoor" | "outdoor";

export type LengthUnit = "meters" | "kilometers" | "feet" | "yards" | "miles";
export type DurationUnit = "seconds" | "minutes" | "hours";
export type EnergyUnit = "kilocalories" | "kilojoules";

export type Quantity<U extends string> = { value: number; unit: U };

export type Goal =
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

export type Step = {
  displayName?: string;
  goal: Goal;
  // alert — future
};

export type Purpose = "work" | "recovery";

export type IntervalStep = {
  purpose: Purpose;
  step: Step;
};

export type IntervalBlock = {
  iterations: number;
  steps: IntervalStep[];
};

export type CustomWorkout = {
  activity: ActivityName;
  location: Location;
  displayName?: string;
  warmup?: Step;
  blocks: IntervalBlock[];
  cooldown?: Step;
};

export type WorkoutPlan = {
  referenceId: string; // UUID
  custom: CustomWorkout;
  // future: goal | pacer | swimBikeRun
};
