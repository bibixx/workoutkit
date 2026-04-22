import Foundation
import HealthKit
import WorkoutKit

enum BuildError: Error, CustomStringConvertible {
    case unknownActivity(String)
    case unknownLocation(String)
    case unknownSwimmingLocation(String)
    case unknownSbrActivity(String)
    case unknownLengthUnit(String)
    case unknownDurationUnit(String)
    case unknownEnergyUnit(String)
    case unknownPurpose(String)
    case missingWorkout
    case multipleWorkoutVariants
    case invalidGoal(String)

    var description: String {
        switch self {
        case .unknownActivity(let s):          return "unknown activity: \(s)"
        case .unknownLocation(let s):          return "unknown location: \(s)"
        case .unknownSwimmingLocation(let s):  return "unknown swimmingLocation: \(s)"
        case .unknownSbrActivity(let s):       return "unknown SBR activity kind: \(s)"
        case .unknownLengthUnit(let s):        return "unknown length unit: \(s)"
        case .unknownDurationUnit(let s):      return "unknown duration unit: \(s)"
        case .unknownEnergyUnit(let s):        return "unknown energy unit: \(s)"
        case .unknownPurpose(let s):           return "unknown purpose: \(s)"
        case .missingWorkout:                  return "spec contains no workout variant"
        case .multipleWorkoutVariants:         return "spec contains more than one of {custom, goal, pacer, swimBikeRun}"
        case .invalidGoal(let s):              return "invalid goal: \(s)"
        }
    }
}

// MARK: - Activity type table. Keyed by the public Swift name.

let activityByName: [String: HKWorkoutActivityType] = [
    "americanFootball":               .americanFootball,
    "archery":                         .archery,
    "australianFootball":              .australianFootball,
    "badminton":                       .badminton,
    "barre":                           .barre,
    "baseball":                        .baseball,
    "basketball":                      .basketball,
    "bowling":                         .bowling,
    "boxing":                          .boxing,
    "climbing":                        .climbing,
    "coreTraining":                    .coreTraining,
    "cricket":                         .cricket,
    "crossCountrySkiing":              .crossCountrySkiing,
    "crossTraining":                   .crossTraining,
    "curling":                         .curling,
    "cycling":                         .cycling,
    "dance":                           .dance,
    "downhillSkiing":                  .downhillSkiing,
    "elliptical":                      .elliptical,
    "equestrianSports":                .equestrianSports,
    "fencing":                         .fencing,
    "fishing":                         .fishing,
    "fitnessGaming":                   .fitnessGaming,
    "flexibility":                     .flexibility,
    "functionalStrengthTraining":      .functionalStrengthTraining,
    "golf":                            .golf,
    "gymnastics":                      .gymnastics,
    "handball":                        .handball,
    "handCycling":                     .handCycling,
    "highIntensityIntervalTraining":   .highIntensityIntervalTraining,
    "hiking":                          .hiking,
    "hockey":                          .hockey,
    "hunting":                         .hunting,
    "jumpRope":                        .jumpRope,
    "kickboxing":                      .kickboxing,
    "lacrosse":                        .lacrosse,
    "martialArts":                     .martialArts,
    "mindAndBody":                     .mindAndBody,
    "mixedCardio":                     .mixedCardio,
    "other":                           .other,
    "paddleSports":                    .paddleSports,
    "pickleball":                      .pickleball,
    "pilates":                         .pilates,
    "play":                            .play,
    "preparationAndRecovery":          .preparationAndRecovery,
    "racquetball":                     .racquetball,
    "rowing":                          .rowing,
    "rugby":                           .rugby,
    "running":                         .running,
    "sailing":                         .sailing,
    "skatingSports":                   .skatingSports,
    "snowboarding":                    .snowboarding,
    "snowSports":                      .snowSports,
    "soccer":                          .soccer,
    "socialDance":                     .socialDance,
    "softball":                        .softball,
    "squash":                          .squash,
    "stairClimbing":                   .stairClimbing,
    "stairs":                          .stairs,
    "stepTraining":                    .stepTraining,
    "surfingSports":                   .surfingSports,
    "swimBikeRun":                     .swimBikeRun,
    "swimming":                        .swimming,
    "tableTennis":                     .tableTennis,
    "taiChi":                          .taiChi,
    "tennis":                          .tennis,
    "trackAndField":                   .trackAndField,
    "traditionalStrengthTraining":     .traditionalStrengthTraining,
    "transition":                      .transition,
    "underwaterDiving":                .underwaterDiving,
    "volleyball":                      .volleyball,
    "walking":                         .walking,
    "waterFitness":                    .waterFitness,
    "waterPolo":                       .waterPolo,
    "waterSports":                     .waterSports,
    "wheelchairRunPace":               .wheelchairRunPace,
    "wheelchairWalkPace":              .wheelchairWalkPace,
    "wrestling":                       .wrestling,
    "yoga":                            .yoga,
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
    WorkoutStep(
        goal: try buildGoal(s.goal),
        alert: try s.alert.map(buildAlert),
        displayName: s.displayName
    )
}

// MARK: - Alerts

enum AlertBuildError: Error, CustomStringConvertible {
    case unknownMetric(String)
    case unknownUnit(String, String)

    var description: String {
        switch self {
        case .unknownMetric(let s):      return "unknown alert metric: \(s)"
        case .unknownUnit(let kind, let s): return "unknown \(kind) unit: \(s)"
        }
    }
}

private func powerUnit(_ s: String) throws -> UnitPower {
    switch s {
    case "watts":      return .watts
    case "kilowatts":  return .kilowatts
    default: throw AlertBuildError.unknownUnit("power", s)
    }
}

private func speedUnit(_ s: String) throws -> UnitSpeed {
    switch s {
    case "metersPerSecond":     return .metersPerSecond
    case "kilometersPerHour":   return .kilometersPerHour
    case "milesPerHour":        return .milesPerHour
    default: throw AlertBuildError.unknownUnit("speed", s)
    }
}

// WorkoutKit's canonical frequency unit for cadence / heart-rate.
private let countsPerMinute: UnitFrequency = WorkoutAlertMetric.countPerMinute

private func frequencyUnit(_ s: String) throws -> UnitFrequency {
    switch s {
    case "hertz":            return .hertz
    case "beatsPerMinute":   return countsPerMinute
    case "stepsPerMinute":   return countsPerMinute
    case "countPerMinute":   return countsPerMinute
    default: throw AlertBuildError.unknownUnit("frequency", s)
    }
}

private func metric(_ s: String?) throws -> WorkoutAlertMetric {
    switch s {
    case nil, "current": return .current
    case "average":      return .average
    case let .some(x):   throw AlertBuildError.unknownMetric(x)
    }
}

func buildAlert(_ s: AlertSpec) throws -> any WorkoutAlert {
    switch s {
    case .heartRateZone(let zone):
        return HeartRateZoneAlert(zone: zone)
    case .heartRateRange(let lo, let hi):
        let u = try frequencyUnit(lo.unit)
        let range = Measurement(value: lo.value, unit: u)
            ... Measurement(value: hi.value, unit: try frequencyUnit(hi.unit))
        return HeartRateRangeAlert(target: range)
    case .powerZone(let zone, _):
        return PowerZoneAlert(zone: zone)
    case .powerRange(let lo, let hi, let m):
        let range = Measurement(value: lo.value, unit: try powerUnit(lo.unit))
            ... Measurement(value: hi.value, unit: try powerUnit(hi.unit))
        return PowerRangeAlert(target: range, metric: try metric(m))
    case .powerThreshold(let q, let m):
        return PowerThresholdAlert(
            target: Measurement(value: q.value, unit: try powerUnit(q.unit)),
            metric: try metric(m)
        )
    case .speedRange(let lo, let hi, let m):
        let range = Measurement(value: lo.value, unit: try speedUnit(lo.unit))
            ... Measurement(value: hi.value, unit: try speedUnit(hi.unit))
        return SpeedRangeAlert(target: range, metric: try metric(m))
    case .speedThreshold(let q, let m):
        return SpeedThresholdAlert(
            target: Measurement(value: q.value, unit: try speedUnit(q.unit)),
            metric: try metric(m)
        )
    case .cadenceThreshold(let q):
        return CadenceThresholdAlert(
            target: Measurement(value: q.value, unit: try frequencyUnit(q.unit))
        )
    case .cadenceRange(let lo, let hi):
        let range = Measurement(value: lo.value, unit: try frequencyUnit(lo.unit))
            ... Measurement(value: hi.value, unit: try frequencyUnit(hi.unit))
        return CadenceRangeAlert(target: range)
    }
}

func buildBlock(_ s: BlockSpec) throws -> IntervalBlock {
    IntervalBlock(
        steps: try s.steps.map { stepSpec in
            IntervalStep(try purpose(stepSpec.purpose), step: try buildStep(stepSpec.step))
        },
        iterations: s.iterations
    )
}

// MARK: - SwimBikeRun activities

func buildSbrActivity(_ s: SbrActivitySpec) throws -> SwimBikeRunWorkout.Activity {
    switch s.kind {
    case "swimming":
        return .swimming(try swimmingLocation(s.swimmingLocation ?? "unknown"))
    case "cycling":
        return .cycling(try location(s.location ?? "unknown"))
    case "running":
        return .running(try location(s.location ?? "unknown"))
    default:
        throw BuildError.unknownSbrActivity(s.kind)
    }
}

// MARK: - Plan

func buildPlan(from spec: Spec) throws -> WorkoutPlan {
    let id: UUID
    if let s = spec.referenceId, let parsed = UUID(uuidString: s) {
        id = parsed
    } else {
        id = UUID()
    }

    let present = [spec.custom != nil, spec.goal != nil, spec.pacer != nil, spec.swimBikeRun != nil]
        .filter { $0 }.count
    if present == 0 { throw BuildError.missingWorkout }
    if present > 1 { throw BuildError.multipleWorkoutVariants }

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

    if let g = spec.goal {
        let workout = SingleGoalWorkout(
            activity: try activity(g.activity),
            location: try location(g.location),
            swimmingLocation: try swimmingLocation(g.swimmingLocation ?? "unknown"),
            goal: try g.goal.map(buildGoal) ?? .open
        )
        return WorkoutPlan(.goal(workout), id: id)
    }

    if let p = spec.pacer {
        let workout = PacerWorkout(
            activity: try activity(p.activity),
            location: try location(p.location),
            distance: Measurement(value: p.distance.value, unit: try lengthUnit(p.distance.unit)),
            time: Measurement(value: p.time.value, unit: try durationUnit(p.time.unit))
        )
        return WorkoutPlan(.pacer(workout), id: id)
    }

    if let sbr = spec.swimBikeRun {
        let workout = SwimBikeRunWorkout(
            activities: try sbr.activities.map(buildSbrActivity),
            displayName: sbr.displayName
        )
        return WorkoutPlan(.swimBikeRun(workout), id: id)
    }

    throw BuildError.missingWorkout
}
