import { Distance, Duration, Energy } from "./quantities.ts";
import type {
  ActivityName,
  CustomWorkoutJson,
  GoalJson,
  IntervalBlockJson,
  IntervalStepJson,
  Location,
  PacerWorkoutJson,
  Purpose,
  SbrActivityJson,
  SingleGoalWorkoutJson,
  StepJson,
  SwimBikeRunWorkoutJson,
  SwimmingLocation,
  WorkoutPlanJson,
} from "./schema.ts";

// ---- Goals --------------------------------------------------------------

export abstract class Goal {
  abstract toJSON(): GoalJson;

  static fromJson(json: GoalJson): Goal {
    switch (json.type) {
      case "open":
        return new OpenGoal();
      case "time":
        return new TimeGoal(Duration.fromJson(json.time));
      case "distance":
        return new DistanceGoal(Distance.fromJson(json.distance));
      case "energy":
        return new EnergyGoal(Energy.fromJson(json.energy));
      case "poolSwimDistanceWithTime":
        return new PoolSwimDistanceWithTimeGoal(
          Distance.fromJson(json.poolSwimDistanceWithTime.distance),
          Duration.fromJson(json.poolSwimDistanceWithTime.time),
        );
    }
  }
}

export class OpenGoal extends Goal {
  toJSON(): GoalJson {
    return { type: "open" };
  }
}

export class TimeGoal extends Goal {
  constructor(public time: Duration) {
    super();
  }
  toJSON(): GoalJson {
    return { type: "time", time: this.time.toJSON() };
  }
}

export class DistanceGoal extends Goal {
  constructor(public distance: Distance) {
    super();
  }
  toJSON(): GoalJson {
    return { type: "distance", distance: this.distance.toJSON() };
  }
}

export class EnergyGoal extends Goal {
  constructor(public energy: Energy) {
    super();
  }
  toJSON(): GoalJson {
    return { type: "energy", energy: this.energy.toJSON() };
  }
}

export class PoolSwimDistanceWithTimeGoal extends Goal {
  constructor(public distance: Distance, public time: Duration) {
    super();
  }
  toJSON(): GoalJson {
    return {
      type: "poolSwimDistanceWithTime",
      poolSwimDistanceWithTime: {
        distance: this.distance.toJSON(),
        time: this.time.toJSON(),
      },
    };
  }
}

// ---- Step / IntervalStep / IntervalBlock --------------------------------

export class Step {
  displayName?: string;
  goal: Goal;

  constructor(goal: Goal, displayName?: string) {
    this.goal = goal;
    this.displayName = displayName;
  }

  static fromJson(json: StepJson): Step {
    return new Step(Goal.fromJson(json.goal), json.displayName);
  }

  toJSON(): StepJson {
    const out: StepJson = { goal: this.goal.toJSON() };
    if (this.displayName !== undefined) out.displayName = this.displayName;
    return out;
  }
}

export class IntervalStep {
  purpose: Purpose;
  step: Step;

  constructor(purpose: Purpose, step: Step) {
    this.purpose = purpose;
    this.step = step;
  }

  static fromJson(json: IntervalStepJson): IntervalStep {
    return new IntervalStep(json.purpose, Step.fromJson(json.step));
  }

  toJSON(): IntervalStepJson {
    return { purpose: this.purpose, step: this.step.toJSON() };
  }
}

export class IntervalBlock {
  iterations: number;
  steps: IntervalStep[] = [];

  constructor(iterations: number) {
    this.iterations = iterations;
  }

  addStep(purpose: Purpose, goal: Goal, displayName?: string): IntervalStep {
    const s = new IntervalStep(purpose, new Step(goal, displayName));
    this.steps.push(s);
    return s;
  }

  static fromJson(json: IntervalBlockJson): IntervalBlock {
    const b = new IntervalBlock(json.iterations);
    b.steps = json.steps.map((s) => IntervalStep.fromJson(s));
    return b;
  }

  toJSON(): IntervalBlockJson {
    return {
      iterations: this.iterations,
      steps: this.steps.map((s) => s.toJSON()),
    };
  }
}

// ---- Workout variants ---------------------------------------------------

export type CustomWorkoutInit = {
  activity: ActivityName;
  location: Location;
  displayName?: string;
};

export class CustomWorkout {
  activity: ActivityName;
  location: Location;
  displayName?: string;
  warmup?: Step;
  blocks: IntervalBlock[] = [];
  cooldown?: Step;

  constructor(init: CustomWorkoutInit) {
    this.activity = init.activity;
    this.location = init.location;
    this.displayName = init.displayName;
  }

  addBlock(iterations: number): IntervalBlock {
    const b = new IntervalBlock(iterations);
    this.blocks.push(b);
    return b;
  }

  static fromJson(json: CustomWorkoutJson): CustomWorkout {
    const w = new CustomWorkout({
      activity: json.activity,
      location: json.location,
      displayName: json.displayName,
    });
    if (json.warmup) w.warmup = Step.fromJson(json.warmup);
    w.blocks = json.blocks.map((b) => IntervalBlock.fromJson(b));
    if (json.cooldown) w.cooldown = Step.fromJson(json.cooldown);
    return w;
  }

  toJSON(): CustomWorkoutJson {
    const out: CustomWorkoutJson = {
      activity: this.activity,
      location: this.location,
      blocks: this.blocks.map((b) => b.toJSON()),
    };
    if (this.displayName !== undefined) out.displayName = this.displayName;
    if (this.warmup) out.warmup = this.warmup.toJSON();
    if (this.cooldown) out.cooldown = this.cooldown.toJSON();
    return out;
  }
}

export type SingleGoalWorkoutInit = {
  activity: ActivityName;
  location: Location;
  swimmingLocation?: SwimmingLocation;
  goal: Goal;
};

export class SingleGoalWorkout {
  activity: ActivityName;
  location: Location;
  swimmingLocation?: SwimmingLocation;
  goal: Goal;

  constructor(init: SingleGoalWorkoutInit) {
    this.activity = init.activity;
    this.location = init.location;
    this.swimmingLocation = init.swimmingLocation;
    this.goal = init.goal;
  }

  static fromJson(json: SingleGoalWorkoutJson): SingleGoalWorkout {
    return new SingleGoalWorkout({
      activity: json.activity,
      location: json.location,
      swimmingLocation: json.swimmingLocation,
      goal: Goal.fromJson(json.goal),
    });
  }

  toJSON(): SingleGoalWorkoutJson {
    const out: SingleGoalWorkoutJson = {
      activity: this.activity,
      location: this.location,
      goal: this.goal.toJSON(),
    };
    if (this.swimmingLocation !== undefined) {
      out.swimmingLocation = this.swimmingLocation;
    }
    return out;
  }
}

export type PacerWorkoutInit = {
  activity: ActivityName;
  location: Location;
  distance: Distance;
  time: Duration;
};

export class PacerWorkout {
  activity: ActivityName;
  location: Location;
  distance: Distance;
  time: Duration;

  constructor(init: PacerWorkoutInit) {
    this.activity = init.activity;
    this.location = init.location;
    this.distance = init.distance;
    this.time = init.time;
  }

  static fromJson(json: PacerWorkoutJson): PacerWorkout {
    return new PacerWorkout({
      activity: json.activity,
      location: json.location,
      distance: Distance.fromJson(json.distance),
      time: Duration.fromJson(json.time),
    });
  }

  toJSON(): PacerWorkoutJson {
    return {
      activity: this.activity,
      location: this.location,
      distance: this.distance.toJSON(),
      time: this.time.toJSON(),
    };
  }
}

// ---- SwimBikeRun --------------------------------------------------------

export abstract class SbrActivity {
  abstract toJSON(): SbrActivityJson;

  static fromJson(json: SbrActivityJson): SbrActivity {
    switch (json.kind) {
      case "swimming":
        return new SwimmingActivity({ swimmingLocation: json.swimmingLocation });
      case "cycling":
        return new CyclingActivity({ location: json.location });
      case "running":
        return new RunningActivity({ location: json.location });
    }
  }
}

export class SwimmingActivity extends SbrActivity {
  swimmingLocation?: SwimmingLocation;

  constructor(init?: { swimmingLocation?: SwimmingLocation }) {
    super();
    this.swimmingLocation = init?.swimmingLocation;
  }

  toJSON(): SbrActivityJson {
    const out: SbrActivityJson = { kind: "swimming" };
    if (this.swimmingLocation !== undefined) {
      out.swimmingLocation = this.swimmingLocation;
    }
    return out;
  }
}

export class CyclingActivity extends SbrActivity {
  location?: Location;

  constructor(init?: { location?: Location }) {
    super();
    this.location = init?.location;
  }

  toJSON(): SbrActivityJson {
    const out: SbrActivityJson = { kind: "cycling" };
    if (this.location !== undefined) out.location = this.location;
    return out;
  }
}

export class RunningActivity extends SbrActivity {
  location?: Location;

  constructor(init?: { location?: Location }) {
    super();
    this.location = init?.location;
  }

  toJSON(): SbrActivityJson {
    const out: SbrActivityJson = { kind: "running" };
    if (this.location !== undefined) out.location = this.location;
    return out;
  }
}

export type SwimBikeRunWorkoutInit = {
  displayName?: string;
  activities?: SbrActivity[];
};

export class SwimBikeRunWorkout {
  displayName?: string;
  activities: SbrActivity[] = [];

  constructor(init?: SwimBikeRunWorkoutInit) {
    this.displayName = init?.displayName;
    if (init?.activities) this.activities = init.activities;
  }

  add(activity: SbrActivity): this {
    this.activities.push(activity);
    return this;
  }

  static fromJson(json: SwimBikeRunWorkoutJson): SwimBikeRunWorkout {
    const w = new SwimBikeRunWorkout({ displayName: json.displayName });
    w.activities = json.activities.map((a) => SbrActivity.fromJson(a));
    return w;
  }

  toJSON(): SwimBikeRunWorkoutJson {
    const out: SwimBikeRunWorkoutJson = {
      activities: this.activities.map((a) => a.toJSON()),
    };
    if (this.displayName !== undefined) out.displayName = this.displayName;
    return out;
  }
}

// ---- WorkoutPlan --------------------------------------------------------

export type WorkoutPlanInit = { referenceId: string };

export class WorkoutPlan {
  referenceId: string;
  custom?: CustomWorkout;
  goal?: SingleGoalWorkout;
  pacer?: PacerWorkout;
  swimBikeRun?: SwimBikeRunWorkout;

  constructor(init: WorkoutPlanInit) {
    this.referenceId = init.referenceId;
  }

  private clearWorkout(): void {
    this.custom = undefined;
    this.goal = undefined;
    this.pacer = undefined;
    this.swimBikeRun = undefined;
  }

  asCustom(init: CustomWorkoutInit): CustomWorkout {
    this.clearWorkout();
    this.custom = new CustomWorkout(init);
    return this.custom;
  }

  asGoal(init: SingleGoalWorkoutInit): SingleGoalWorkout {
    this.clearWorkout();
    this.goal = new SingleGoalWorkout(init);
    return this.goal;
  }

  asPacer(init: PacerWorkoutInit): PacerWorkout {
    this.clearWorkout();
    this.pacer = new PacerWorkout(init);
    return this.pacer;
  }

  asSwimBikeRun(init?: SwimBikeRunWorkoutInit): SwimBikeRunWorkout {
    this.clearWorkout();
    this.swimBikeRun = new SwimBikeRunWorkout(init);
    return this.swimBikeRun;
  }

  static fromJson(json: WorkoutPlanJson): WorkoutPlan {
    const p = new WorkoutPlan({ referenceId: json.referenceId });
    if (json.custom) p.custom = CustomWorkout.fromJson(json.custom);
    if (json.goal) p.goal = SingleGoalWorkout.fromJson(json.goal);
    if (json.pacer) p.pacer = PacerWorkout.fromJson(json.pacer);
    if (json.swimBikeRun) p.swimBikeRun = SwimBikeRunWorkout.fromJson(json.swimBikeRun);
    return p;
  }

  toJSON(): WorkoutPlanJson {
    const out: WorkoutPlanJson = { referenceId: this.referenceId };
    if (this.custom) out.custom = this.custom.toJSON();
    if (this.goal) out.goal = this.goal.toJSON();
    if (this.pacer) out.pacer = this.pacer.toJSON();
    if (this.swimBikeRun) out.swimBikeRun = this.swimBikeRun.toJSON();
    return out;
  }
}
