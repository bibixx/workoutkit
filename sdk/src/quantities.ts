import type {
  DurationUnit,
  EnergyUnit,
  LengthUnit,
  Quantity,
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
