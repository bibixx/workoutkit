import Foundation
import HealthKit
import WorkoutKit

enum BuildError: Error, CustomStringConvertible {
    case unknownActivity(String)
    case unknownLocation(String)
    case unknownSwimmingLocation(String)
    case unknownLengthUnit(String)
    case unknownDurationUnit(String)
    case unknownEnergyUnit(String)
    case unknownPurpose(String)
    case missingWorkout

    var description: String {
        switch self {
        case .unknownActivity(let s):          return "unknown activity: \(s)"
        case .unknownLocation(let s):          return "unknown location: \(s)"
        case .unknownSwimmingLocation(let s):  return "unknown swimmingLocation: \(s)"
        case .unknownLengthUnit(let s):        return "unknown length unit: \(s)"
        case .unknownDurationUnit(let s):      return "unknown duration unit: \(s)"
        case .unknownEnergyUnit(let s):        return "unknown energy unit: \(s)"
        case .unknownPurpose(let s):           return "unknown purpose: \(s)"
        case .missingWorkout:                  return "spec contains no workout variant"
        }
    }
}

// MARK: - Enums

private let activityByName: [String: HKWorkoutActivityType] = [
    "running":            .running,
    "cycling":            .cycling,
    "swimming":           .swimming,
    "walking":            .walking,
    "hiking":             .hiking,
    "rowing":             .rowing,
    "functionalStrength": .functionalStrengthTraining,
    "traditionalStrength": .traditionalStrengthTraining,
    "coreTraining":       .coreTraining,
    "yoga":               .yoga,
    "highIntensityIntervalTraining": .highIntensityIntervalTraining,
]

func activity(_ name: String) throws -> HKWorkoutActivityType {
    guard let a = activityByName[name] else { throw BuildError.unknownActivity(name) }
    return a
}

func location(_ name: String) throws -> HKWorkoutSessionLocationType {
    switch name {
    case "unknown": return .unknown
    case "indoor":  return .indoor
    case "outdoor": return .outdoor
    default: throw BuildError.unknownLocation(name)
    }
}

func swimmingLocation(_ name: String) throws -> HKWorkoutSwimmingLocationType {
    switch name {
    case "unknown":   return .unknown
    case "pool":      return .pool
    case "openWater": return .openWater
    default: throw BuildError.unknownSwimmingLocation(name)
    }
}

func purpose(_ name: String) throws -> IntervalStep.Purpose {
    switch name {
    case "work":     return .work
    case "recovery": return .recovery
    default: throw BuildError.unknownPurpose(name)
    }
}

private let lengthUnits: [String: UnitLength] = [
    "meters": .meters, "kilometers": .kilometers,
    "feet": .feet, "yards": .yards, "miles": .miles,
]
private let durationUnits: [String: UnitDuration] = [
    "seconds": .seconds, "minutes": .minutes, "hours": .hours,
]
private let energyUnits: [String: UnitEnergy] = [
    "kilocalories": .kilocalories, "kilojoules": .kilojoules,
]

func lengthUnit(_ s: String) throws -> UnitLength {
    guard let u = lengthUnits[s] else { throw BuildError.unknownLengthUnit(s) }
    return u
}
func durationUnit(_ s: String) throws -> UnitDuration {
    guard let u = durationUnits[s] else { throw BuildError.unknownDurationUnit(s) }
    return u
}
func energyUnit(_ s: String) throws -> UnitEnergy {
    guard let u = energyUnits[s] else { throw BuildError.unknownEnergyUnit(s) }
    return u
}

// MARK: - Goal / Step / Block

func buildGoal(_ s: GoalSpec) throws -> WorkoutGoal {
    switch s {
    case .open:
        return .open
    case .time(let v, let u):
        return .time(v, try durationUnit(u))
    case .distance(let v, let u):
        return .distance(v, try lengthUnit(u))
    case .energy(let v, let u):
        return .energy(v, try energyUnit(u))
    case .poolSwimDistanceWithTime(let d, let t):
        return .poolSwimDistanceWithTime(
            Measurement(value: d.value, unit: try lengthUnit(d.unit)),
            Measurement(value: t.value, unit: try durationUnit(t.unit))
        )
    }
}

func buildStep(_ s: StepSpec) throws -> WorkoutStep {
    WorkoutStep(goal: try buildGoal(s.goal), alert: nil, displayName: s.displayName)
}

func buildBlock(_ s: BlockSpec) throws -> IntervalBlock {
    IntervalBlock(
        steps: try s.steps.map { stepSpec in
            IntervalStep(try purpose(stepSpec.purpose), step: try buildStep(stepSpec.step))
        },
        iterations: s.iterations
    )
}

// MARK: - Plan

func buildPlan(from spec: Spec) throws -> WorkoutPlan {
    let id: UUID
    if let s = spec.referenceId, let parsed = UUID(uuidString: s) {
        id = parsed
    } else {
        id = UUID()
    }

    if let c = spec.custom {
        let custom = CustomWorkout(
            activity: try activity(c.activity),
            location: try location(c.location),
            displayName: c.displayName,
            warmup: try c.warmup.map(buildStep),
            blocks: try c.blocks.map(buildBlock),
            cooldown: try c.cooldown.map(buildStep)
        )
        return WorkoutPlan(.custom(custom), id: id)
    }

    throw BuildError.missingWorkout
}
