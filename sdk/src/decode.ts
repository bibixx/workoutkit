// Pure-TS protobuf reader. Mirrors wire.ts and is the inverse of encode.ts,
// producing a WorkoutPlanJson from bytes. Unknown fields are skipped per
// proto3 conventions; the version trailers (tags 1000 / 1002) Apple appends
// to every plan also fall through that path.

import {
  ActivityType,
  type ActivityName,
  type CustomWorkoutJson,
  type DurationUnit,
  type EnergyUnit,
  type GoalJson,
  type IntervalBlockJson,
  type IntervalStepJson,
  type LengthUnit,
  type Location,
  type PacerWorkoutJson,
  type Purpose,
  type Quantity,
  type SbrActivityJson,
  type SingleGoalWorkoutJson,
  type StepJson,
  type SwimBikeRunWorkoutJson,
  type SwimmingLocation,
  type WorkoutPlanJson,
} from "./schema.ts";

// ---- Wire primitives ----------------------------------------------------

const WIRE_VARINT = 0;
const WIRE_I64 = 1;
const WIRE_LEN = 2;
const WIRE_I32 = 5;

class Reader {
  private off = 0;

  constructor(private readonly bytes: Uint8Array) {}

  eof(): boolean {
    return this.off >= this.bytes.length;
  }

  tag(): { field: number; wire: number } {
    const t = Number(this.varint());
    return { field: t >>> 3, wire: t & 0x7 };
  }

  varint(): bigint {
    let result = 0n;
    let shift = 0n;
    while (true) {
      if (this.off >= this.bytes.length) {
        throw new Error("varint: unexpected end of buffer");
      }
      const b = this.bytes[this.off++]!;
      result |= BigInt(b & 0x7f) << shift;
      if ((b & 0x80) === 0) return result;
      shift += 7n;
      if (shift > 70n) throw new Error("varint: too long");
    }
  }

  uint32(): number {
    const v = this.varint();
    return Number(v);
  }

  double(): number {
    if (this.off + 8 > this.bytes.length) {
      throw new Error("double: unexpected end of buffer");
    }
    const view = new DataView(
      this.bytes.buffer,
      this.bytes.byteOffset + this.off,
      8,
    );
    this.off += 8;
    return view.getFloat64(0, true);
  }

  bytes_(n: number): Uint8Array {
    if (this.off + n > this.bytes.length) {
      throw new Error("len: unexpected end of buffer");
    }
    const out = this.bytes.subarray(this.off, this.off + n);
    this.off += n;
    return out;
  }

  lenDelimited(): Uint8Array {
    const n = Number(this.varint());
    return this.bytes_(n);
  }

  string(): string {
    return new TextDecoder().decode(this.lenDelimited());
  }

  subReader(): Reader {
    return new Reader(this.lenDelimited());
  }

  skip(wire: number): void {
    switch (wire) {
      case WIRE_VARINT:
        this.varint();
        return;
      case WIRE_I64:
        this.bytes_(8);
        return;
      case WIRE_LEN:
        this.lenDelimited();
        return;
      case WIRE_I32:
        this.bytes_(4);
        return;
      default:
        throw new Error(`unsupported wire type: ${wire}`);
    }
  }
}

// ---- Reverse enum maps --------------------------------------------------

const ACTIVITY_NAME_BY_VALUE: Record<number, ActivityName> = (() => {
  const out: Record<number, ActivityName> = {};
  for (const [name, value] of Object.entries(ActivityType) as [ActivityName, number][]) {
    out[value] = name;
  }
  return out;
})();

const LOCATION_BY_PROTO: Record<number, Location> = {
  0: "unknown",
  2: "indoor",
  3: "outdoor",
};

const SWIM_LOCATION_BY_PROTO: Record<number, SwimmingLocation> = {
  0: "unknown",
  1: "pool",
  2: "openWater",
};

const PURPOSE_BY_PROTO: Record<number, Purpose> = { 1: "work", 2: "recovery" };

const GOAL_TYPE_BY_PROTO: Record<number, GoalJson["type"]> = {
  1: "time",
  2: "energy",
  3: "distance",
  4: "open",
  5: "poolSwimDistanceWithTime",
};

const LENGTH_UNIT_BY_PROTO: Record<number, LengthUnit> = {
  1: "meters",
  2: "kilometers",
  3: "feet",
  4: "yards",
  5: "miles",
};
const DURATION_UNIT_BY_PROTO: Record<number, DurationUnit> = {
  1: "seconds",
  2: "minutes",
  3: "hours",
};
const ENERGY_UNIT_BY_PROTO: Record<number, EnergyUnit> = {
  1: "kilocalories",
  2: "kilojoules",
};

// ---- Quantity readers ---------------------------------------------------

type Q<U extends string> = Quantity<U>;

function readQuantity<U extends string>(
  r: Reader,
  unitMap: Record<number, U>,
  label: string,
): Q<U> {
  let unitRaw = 0;
  let value = 0;
  while (!r.eof()) {
    const { field, wire } = r.tag();
    if (field === 1 && wire === WIRE_VARINT) unitRaw = r.uint32();
    else if (field === 2 && wire === WIRE_I64) value = r.double();
    else r.skip(wire);
  }
  const unit = unitMap[unitRaw];
  if (!unit) throw new Error(`${label}: unknown unit enum ${unitRaw}`);
  return { value, unit };
}

const readLengthQuantity = (r: Reader): Q<LengthUnit> =>
  readQuantity(r, LENGTH_UNIT_BY_PROTO, "length");
const readDurationQuantity = (r: Reader): Q<DurationUnit> =>
  readQuantity(r, DURATION_UNIT_BY_PROTO, "duration");
const readEnergyQuantity = (r: Reader): Q<EnergyUnit> =>
  readQuantity(r, ENERGY_UNIT_BY_PROTO, "energy");

// ---- Goal / Step / Block readers ---------------------------------------

function readGoal(r: Reader): GoalJson {
  let typeRaw = 0;
  let timeQ: Q<DurationUnit> | undefined;
  let energyQ: Q<EnergyUnit> | undefined;
  let distanceQ: Q<LengthUnit> | undefined;
  let poolPair: { distance: Q<LengthUnit>; time: Q<DurationUnit> } | undefined;

  while (!r.eof()) {
    const { field, wire } = r.tag();
    if (field === 1 && wire === WIRE_VARINT) {
      typeRaw = r.uint32();
    } else if (field === 2 && wire === WIRE_LEN) {
      timeQ = readDurationQuantity(r.subReader());
    } else if (field === 3 && wire === WIRE_LEN) {
      energyQ = readEnergyQuantity(r.subReader());
    } else if (field === 4 && wire === WIRE_LEN) {
      distanceQ = readLengthQuantity(r.subReader());
    } else if (field === 5 && wire === WIRE_LEN) {
      const sub = r.subReader();
      let d: Q<LengthUnit> | undefined;
      let t: Q<DurationUnit> | undefined;
      while (!sub.eof()) {
        const tag = sub.tag();
        if (tag.field === 1 && tag.wire === WIRE_LEN) d = readLengthQuantity(sub.subReader());
        else if (tag.field === 2 && tag.wire === WIRE_LEN) t = readDurationQuantity(sub.subReader());
        else sub.skip(tag.wire);
      }
      if (!d || !t) throw new Error("poolSwimDistanceWithTime: missing distance or time");
      poolPair = { distance: d, time: t };
    } else {
      r.skip(wire);
    }
  }

  const kind = GOAL_TYPE_BY_PROTO[typeRaw];
  if (!kind) throw new Error(`goal: unknown type enum ${typeRaw}`);

  switch (kind) {
    case "open":
      return { type: "open" };
    case "time":
      if (!timeQ) throw new Error("goal.time: missing value");
      return { type: "time", time: timeQ };
    case "energy":
      if (!energyQ) throw new Error("goal.energy: missing value");
      return { type: "energy", energy: energyQ };
    case "distance":
      if (!distanceQ) throw new Error("goal.distance: missing value");
      return { type: "distance", distance: distanceQ };
    case "poolSwimDistanceWithTime":
      if (!poolPair) throw new Error("goal.poolSwim: missing pair");
      return { type: "poolSwimDistanceWithTime", poolSwimDistanceWithTime: poolPair };
  }
}

function readStep(r: Reader): StepJson {
  let goal: GoalJson | undefined;
  let displayName: string | undefined;
  while (!r.eof()) {
    const { field, wire } = r.tag();
    if (field === 1 && wire === WIRE_LEN) goal = readGoal(r.subReader());
    else if (field === 3 && wire === WIRE_LEN) displayName = r.string();
    else r.skip(wire);
  }
  if (!goal) throw new Error("step: missing goal");
  const out: StepJson = { goal };
  if (displayName !== undefined && displayName !== "") out.displayName = displayName;
  return out;
}

function readIntervalStep(r: Reader): IntervalStepJson {
  let purposeRaw = 0;
  let step: StepJson | undefined;
  while (!r.eof()) {
    const { field, wire } = r.tag();
    if (field === 1 && wire === WIRE_VARINT) purposeRaw = r.uint32();
    else if (field === 2 && wire === WIRE_LEN) step = readStep(r.subReader());
    else r.skip(wire);
  }
  const purpose = PURPOSE_BY_PROTO[purposeRaw];
  if (!purpose) throw new Error(`intervalStep: unknown purpose enum ${purposeRaw}`);
  if (!step) throw new Error("intervalStep: missing step");
  return { purpose, step };
}

function readBlock(r: Reader): IntervalBlockJson {
  const steps: IntervalStepJson[] = [];
  let iterations = 0;
  while (!r.eof()) {
    const { field, wire } = r.tag();
    if (field === 1 && wire === WIRE_LEN) steps.push(readIntervalStep(r.subReader()));
    else if (field === 2 && wire === WIRE_VARINT) iterations = r.uint32();
    else r.skip(wire);
  }
  return { iterations, steps };
}

// ---- Workout variants ---------------------------------------------------

function readActivity(raw: number): ActivityName {
  const name = ACTIVITY_NAME_BY_VALUE[raw];
  if (!name) throw new Error(`unknown activity enum ${raw}`);
  return name;
}

function readCustomWorkout(r: Reader): CustomWorkoutJson {
  let activityRaw = 0;
  let locationRaw = 0;
  let displayName: string | undefined;
  let warmup: StepJson | undefined;
  const blocks: IntervalBlockJson[] = [];
  let cooldown: StepJson | undefined;

  while (!r.eof()) {
    const { field, wire } = r.tag();
    if (field === 1 && wire === WIRE_VARINT) activityRaw = r.uint32();
    else if (field === 2 && wire === WIRE_VARINT) locationRaw = r.uint32();
    else if (field === 3 && wire === WIRE_LEN) displayName = r.string();
    else if (field === 4 && wire === WIRE_LEN) warmup = readStep(r.subReader());
    else if (field === 5 && wire === WIRE_LEN) blocks.push(readBlock(r.subReader()));
    else if (field === 6 && wire === WIRE_LEN) cooldown = readStep(r.subReader());
    else r.skip(wire);
  }

  const out: CustomWorkoutJson = {
    activity: readActivity(activityRaw),
    location: LOCATION_BY_PROTO[locationRaw] ?? "unknown",
    blocks,
  };
  if (displayName !== undefined && displayName !== "") out.displayName = displayName;
  if (warmup) out.warmup = warmup;
  if (cooldown) out.cooldown = cooldown;
  return out;
}

function readSingleGoalWorkout(r: Reader): SingleGoalWorkoutJson {
  let activityRaw = 0;
  let locationRaw = 0;
  let swimRaw = 0;
  let goal: GoalJson | undefined;

  while (!r.eof()) {
    const { field, wire } = r.tag();
    if (field === 1 && wire === WIRE_VARINT) activityRaw = r.uint32();
    else if (field === 2 && wire === WIRE_VARINT) locationRaw = r.uint32();
    else if (field === 3 && wire === WIRE_VARINT) swimRaw = r.uint32();
    else if (field === 4 && wire === WIRE_LEN) goal = readGoal(r.subReader());
    else r.skip(wire);
  }

  if (!goal) throw new Error("singleGoal: missing goal");
  const out: SingleGoalWorkoutJson = {
    activity: readActivity(activityRaw),
    location: LOCATION_BY_PROTO[locationRaw] ?? "unknown",
    goal,
  };
  // Only surface swimmingLocation when explicitly non-unknown, matching the
  // JSON-shape convention where "unknown" is the default.
  const swim = SWIM_LOCATION_BY_PROTO[swimRaw] ?? "unknown";
  if (swim !== "unknown") out.swimmingLocation = swim;
  return out;
}

function readPacerWorkout(r: Reader): PacerWorkoutJson {
  let activityRaw = 0;
  let locationRaw = 0;
  let distance: Q<LengthUnit> | undefined;
  let time: Q<DurationUnit> | undefined;

  while (!r.eof()) {
    const { field, wire } = r.tag();
    if (field === 1 && wire === WIRE_VARINT) activityRaw = r.uint32();
    else if (field === 2 && wire === WIRE_VARINT) locationRaw = r.uint32();
    else if (field === 3 && wire === WIRE_LEN) distance = readLengthQuantity(r.subReader());
    else if (field === 4 && wire === WIRE_LEN) time = readDurationQuantity(r.subReader());
    else r.skip(wire);
  }

  if (!distance) throw new Error("pacer: missing distance");
  if (!time) throw new Error("pacer: missing time");
  return {
    activity: readActivity(activityRaw),
    location: LOCATION_BY_PROTO[locationRaw] ?? "unknown",
    distance,
    time,
  };
}

function readSbrActivity(r: Reader): SbrActivityJson {
  let activityRaw = 0;
  let field2Raw = 0;
  let field3Raw = 0;

  while (!r.eof()) {
    const { field, wire } = r.tag();
    if (field === 1 && wire === WIRE_VARINT) activityRaw = r.uint32();
    else if (field === 2 && wire === WIRE_VARINT) field2Raw = r.uint32();
    else if (field === 3 && wire === WIRE_VARINT) field3Raw = r.uint32();
    else r.skip(wire);
  }

  const name = readActivity(activityRaw);
  if (name === "swimming") {
    const out: SbrActivityJson = { kind: "swimming" };
    const swim = SWIM_LOCATION_BY_PROTO[field3Raw] ?? "unknown";
    if (swim !== "unknown") out.swimmingLocation = swim;
    return out;
  }
  if (name === "cycling") {
    const out: SbrActivityJson = { kind: "cycling" };
    const loc = LOCATION_BY_PROTO[field2Raw] ?? "unknown";
    if (loc !== "unknown") out.location = loc;
    return out;
  }
  if (name === "running") {
    const out: SbrActivityJson = { kind: "running" };
    const loc = LOCATION_BY_PROTO[field2Raw] ?? "unknown";
    if (loc !== "unknown") out.location = loc;
    return out;
  }
  throw new Error(`sbrActivity: unsupported activity "${name}"`);
}

function readSwimBikeRunWorkout(r: Reader): SwimBikeRunWorkoutJson {
  const activities: SbrActivityJson[] = [];
  let displayName: string | undefined;
  while (!r.eof()) {
    const { field, wire } = r.tag();
    if (field === 1 && wire === WIRE_LEN) activities.push(readSbrActivity(r.subReader()));
    else if (field === 2 && wire === WIRE_LEN) displayName = r.string();
    else r.skip(wire);
  }
  const out: SwimBikeRunWorkoutJson = { activities };
  if (displayName !== undefined && displayName !== "") out.displayName = displayName;
  return out;
}

// ---- Top-level ---------------------------------------------------------

export function decodeWorkoutPlanJson(bytes: Uint8Array): WorkoutPlanJson {
  const r = new Reader(bytes);
  let referenceId: string | undefined;
  let custom: CustomWorkoutJson | undefined;
  let goal: SingleGoalWorkoutJson | undefined;
  let pacer: PacerWorkoutJson | undefined;
  let swimBikeRun: SwimBikeRunWorkoutJson | undefined;

  while (!r.eof()) {
    const { field, wire } = r.tag();
    if (field === 9 && wire === WIRE_LEN) {
      referenceId = r.string();
    } else if (field === 10 && wire === WIRE_LEN) {
      goal = readSingleGoalWorkout(r.subReader());
    } else if (field === 11 && wire === WIRE_LEN) {
      custom = readCustomWorkout(r.subReader());
    } else if (field === 13 && wire === WIRE_LEN) {
      pacer = readPacerWorkout(r.subReader());
    } else if (field === 14 && wire === WIRE_LEN) {
      swimBikeRun = readSwimBikeRunWorkout(r.subReader());
    } else {
      // Skips version trailers (tags 1000/1002) and any unknown fields.
      r.skip(wire);
    }
  }

  if (referenceId === undefined) {
    throw new Error("workoutPlan: missing referenceId");
  }

  const out: WorkoutPlanJson = { referenceId };
  if (custom) out.custom = custom;
  if (goal) out.goal = goal;
  if (pacer) out.pacer = pacer;
  if (swimBikeRun) out.swimBikeRun = swimBikeRun;
  return out;
}
