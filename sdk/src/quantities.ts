import type {
  CadenceUnit,
  DurationUnit,
  EnergyUnit,
  HeartRateUnit,
  LengthUnit,
  PowerUnit,
  Quantity,
  SpeedJson,
} from "./schema.ts";

export class Distance {
  constructor(public value: number, public unit: LengthUnit) {}

  static fromJson(json: Quantity<LengthUnit>): Distance {
    return new Distance(json.value, json.unit);
  }

  toJSON(): Quantity<LengthUnit> {
    return { value: this.value, unit: this.unit };
  }
}

export class Duration {
  constructor(public value: number, public unit: DurationUnit) {}

  static fromJson(json: Quantity<DurationUnit>): Duration {
    return new Duration(json.value, json.unit);
  }

  toJSON(): Quantity<DurationUnit> {
    return { value: this.value, unit: this.unit };
  }
}

export class Energy {
  constructor(public value: number, public unit: EnergyUnit) {}

  static fromJson(json: Quantity<EnergyUnit>): Energy {
    return new Energy(json.value, json.unit);
  }

  toJSON(): Quantity<EnergyUnit> {
    return { value: this.value, unit: this.unit };
  }
}

export class Power {
  constructor(public value: number, public unit: PowerUnit) {}

  static fromJson(json: Quantity<PowerUnit>): Power {
    return new Power(json.value, json.unit);
  }

  toJSON(): Quantity<PowerUnit> {
    return { value: this.value, unit: this.unit };
  }
}

export class HeartRate {
  constructor(
    public value: number,
    public unit: HeartRateUnit = "beatsPerMinute",
  ) {}

  static fromJson(json: Quantity<HeartRateUnit>): HeartRate {
    return new HeartRate(json.value, json.unit);
  }

  toJSON(): Quantity<HeartRateUnit> {
    return { value: this.value, unit: this.unit };
  }
}

export class Cadence {
  constructor(
    public value: number,
    public unit: CadenceUnit = "countPerMinute",
  ) {}

  static fromJson(json: Quantity<CadenceUnit>): Cadence {
    return new Cadence(json.value, json.unit);
  }

  toJSON(): Quantity<CadenceUnit> {
    return { value: this.value, unit: this.unit };
  }
}

// Speed is stored as a (distance, time) pair. This covers both speed
// (3.5 m/s = 3.5m per 1s) and pace (5:00/mi = 1 mi per 5 min) without lossy
// conversion — Apple's WorkoutKit serializes both shapes identically.
export class Speed {
  constructor(public distance: Distance, public time: Duration) {}

  static fromJson(json: SpeedJson): Speed {
    return new Speed(
      Distance.fromJson(json.distance),
      Duration.fromJson(json.time),
    );
  }

  toJSON(): SpeedJson {
    return { distance: this.distance.toJSON(), time: this.time.toJSON() };
  }
}
