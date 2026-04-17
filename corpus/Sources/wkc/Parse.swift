import Foundation
import HealthKit
import WorkoutKit

// Parse .workout bytes via WorkoutKit's own API and serialise the resulting
// `WorkoutPlan` back into the same JSON shape consumed by `encode`.

enum ParseError: Error, CustomStringConvertible {
    case unsupportedActivity(HKWorkoutActivityType)
    case unsupportedLocation(HKWorkoutSessionLocationType)
    case unsupportedSwimmingLocation(HKWorkoutSwimmingLocationType)
    case unsupportedLengthUnit(String)
    case unsupportedDurationUnit(String)
    case unsupportedEnergyUnit(String)
    case unsupportedGoal(String)
    case unsupportedWorkoutVariant(String)
    case alertsNotSupported

    var description: String {
        switch self {
        case .unsupportedActivity(let a):        return "unsupported activity: \(a.rawValue)"
        case .unsupportedLocation(let l):        return "unsupported location: \(l.rawValue)"
        case .unsupportedSwimmingLocation(let l): return "unsupported swimmingLocation: \(l.rawValue)"
        case .unsupportedLengthUnit(let s):      return "unsupported length unit: \(s)"
        case .unsupportedDurationUnit(let s):    return "unsupported duration unit: \(s)"
        case .unsupportedEnergyUnit(let s):      return "unsupported energy unit: \(s)"
        case .unsupportedGoal(let s):            return "unsupported goal: \(s)"
        case .unsupportedWorkoutVariant(let s):  return "unsupported workout variant: \(s)"
        case .alertsNotSupported:                return "alerts not yet supported by the SDK"
        }
    }
}

// MARK: - Reverse enum tables

private let activityNameByRaw: [UInt: String] = {
    var out: [UInt: String] = [:]
    for (name, type) in activityByName {
        out[UInt(type.rawValue)] = name
    }
    return out
}()

private func activityName(_ a: HKWorkoutActivityType) throws -> String {
    if let n = activityNameByRaw[UInt(a.rawValue)] { return n }
    throw ParseError.unsupportedActivity(a)
}

private func locationName(_ l: HKWorkoutSessionLocationType) throws -> String {
    switch l {
    case .unknown: return "unknown"
    case .indoor:  return "indoor"
    case .outdoor: return "outdoor"
    @unknown default: throw ParseError.unsupportedLocation(l)
    }
}

private func swimmingLocationName(_ l: HKWorkoutSwimmingLocationType) throws -> String {
    switch l {
    case .unknown:   return "unknown"
    case .pool:      return "pool"
    case .openWater: return "openWater"
    @unknown default: throw ParseError.unsupportedSwimmingLocation(l)
    }
}

private func purposeName(_ p: IntervalStep.Purpose) -> String {
    switch p {
    case .work:     return "work"
    case .recovery: return "recovery"
    @unknown default: return "unknown"
    }
}

private let lengthUnitName: [UnitLength: String] = [
    .meters: "meters", .kilometers: "kilometers",
    .feet: "feet", .yards: "yards", .miles: "miles",
]
private let durationUnitName: [UnitDuration: String] = [
    .seconds: "seconds", .minutes: "minutes", .hours: "hours",
]
private let energyUnitName: [UnitEnergy: String] = [
    .kilocalories: "kilocalories", .kilojoules: "kilojoules",
]

private func name(length u: UnitLength) throws -> String {
    if let n = lengthUnitName[u] { return n }
    throw ParseError.unsupportedLengthUnit(u.symbol)
}
private func name(duration u: UnitDuration) throws -> String {
    if let n = durationUnitName[u] { return n }
    throw ParseError.unsupportedDurationUnit(u.symbol)
}
private func name(energy u: UnitEnergy) throws -> String {
    if let n = energyUnitName[u] { return n }
    throw ParseError.unsupportedEnergyUnit(u.symbol)
}

// MARK: - Output shape (mirrors Spec.swift Decodable side)

struct OutSpec: Encodable {
    let referenceId: String
    let custom: OutCustomWorkout?
    let goal: OutSingleGoalWorkout?
    let pacer: OutPacerWorkout?
    let swimBikeRun: OutSwimBikeRunWorkout?

    enum Key: String, CodingKey {
        case referenceId, custom, goal, pacer, swimBikeRun
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: Key.self)
        try c.encode(referenceId, forKey: .referenceId)
        try c.encodeIfPresent(custom, forKey: .custom)
        try c.encodeIfPresent(goal, forKey: .goal)
        try c.encodeIfPresent(pacer, forKey: .pacer)
        try c.encodeIfPresent(swimBikeRun, forKey: .swimBikeRun)
    }
}

struct OutCustomWorkout: Encodable {
    let activity: String
    let location: String
    let displayName: String?
    let warmup: OutStep?
    let blocks: [OutBlock]
    let cooldown: OutStep?
}

struct OutSingleGoalWorkout: Encodable {
    let activity: String
    let location: String
    let swimmingLocation: String?
    let goal: OutGoal
}

struct OutPacerWorkout: Encodable {
    let activity: String
    let location: String
    let distance: OutQuantity
    let time: OutQuantity
}

struct OutSwimBikeRunWorkout: Encodable {
    let displayName: String?
    let activities: [OutSbrActivity]
}

struct OutSbrActivity: Encodable {
    let kind: String
    let location: String?
    let swimmingLocation: String?
}

struct OutBlock: Encodable {
    let iterations: Int
    let steps: [OutIntervalStep]
}

struct OutIntervalStep: Encodable {
    let purpose: String
    let step: OutStep
}

struct OutStep: Encodable {
    let displayName: String?
    let goal: OutGoal
}

struct OutQuantity: Encodable { let value: Double; let unit: String }

struct OutGoal: Encodable {
    let type: String
    let time: OutQuantity?
    let distance: OutQuantity?
    let energy: OutQuantity?
    let poolSwimDistanceWithTime: OutPoolSwim?

    enum Key: String, CodingKey {
        case type, time, distance, energy, poolSwimDistanceWithTime
    }

    func encode(to encoder: Encoder) throws {
        var c = encoder.container(keyedBy: Key.self)
        try c.encode(type, forKey: .type)
        switch type {
        case "time":
            try c.encodeIfPresent(time, forKey: .time)
        case "distance":
            try c.encodeIfPresent(distance, forKey: .distance)
        case "energy":
            try c.encodeIfPresent(energy, forKey: .energy)
        case "poolSwimDistanceWithTime":
            try c.encodeIfPresent(poolSwimDistanceWithTime, forKey: .poolSwimDistanceWithTime)
        default:
            break
        }
    }
}

struct OutPoolSwim: Encodable {
    let distance: OutQuantity
    let time: OutQuantity
}

// MARK: - Conversion

private func out(_ goal: WorkoutGoal) throws -> OutGoal {
    switch goal {
    case .open:
        return OutGoal(type: "open", time: nil, distance: nil, energy: nil, poolSwimDistanceWithTime: nil)
    case .time(let v, let u):
        return OutGoal(type: "time",
                       time: OutQuantity(value: v, unit: try name(duration: u)),
                       distance: nil, energy: nil, poolSwimDistanceWithTime: nil)
    case .distance(let v, let u):
        return OutGoal(type: "distance", time: nil,
                       distance: OutQuantity(value: v, unit: try name(length: u)),
                       energy: nil, poolSwimDistanceWithTime: nil)
    case .energy(let v, let u):
        return OutGoal(type: "energy", time: nil, distance: nil,
                       energy: OutQuantity(value: v, unit: try name(energy: u)),
                       poolSwimDistanceWithTime: nil)
    case .poolSwimDistanceWithTime(let d, let t):
        return OutGoal(type: "poolSwimDistanceWithTime",
                       time: nil, distance: nil, energy: nil,
                       poolSwimDistanceWithTime: OutPoolSwim(
                           distance: OutQuantity(value: d.value, unit: try name(length: d.unit)),
                           time: OutQuantity(value: t.value, unit: try name(duration: t.unit))
                       ))
    @unknown default: throw ParseError.unsupportedGoal("unknown case")
    }
}

private func out(_ step: WorkoutStep) throws -> OutStep {
    if step.alert != nil { throw ParseError.alertsNotSupported }
    return OutStep(displayName: step.displayName, goal: try out(step.goal))
}

private func out(_ is_: IntervalStep) throws -> OutIntervalStep {
    OutIntervalStep(purpose: purposeName(is_.purpose), step: try out(is_.step))
}

private func out(_ block: IntervalBlock) throws -> OutBlock {
    OutBlock(iterations: block.iterations, steps: try block.steps.map { try out($0) })
}

private func out(_ c: CustomWorkout) throws -> OutCustomWorkout {
    OutCustomWorkout(
        activity: try activityName(c.activity),
        location: try locationName(c.location),
        displayName: c.displayName,
        warmup: try c.warmup.map { try out($0) },
        blocks: try c.blocks.map { try out($0) },
        cooldown: try c.cooldown.map { try out($0) }
    )
}

private func out(_ g: SingleGoalWorkout) throws -> OutSingleGoalWorkout {
    let swimName = try swimmingLocationName(g.swimmingLocation)
    return OutSingleGoalWorkout(
        activity: try activityName(g.activity),
        location: try locationName(g.location),
        swimmingLocation: swimName == "unknown" ? nil : swimName,
        goal: try out(g.goal)
    )
}

private func out(_ p: PacerWorkout) throws -> OutPacerWorkout {
    OutPacerWorkout(
        activity: try activityName(p.activity),
        location: try locationName(p.location),
        distance: OutQuantity(value: p.distance.value, unit: try name(length: p.distance.unit)),
        time: OutQuantity(value: p.time.value, unit: try name(duration: p.time.unit))
    )
}

private func out(_ a: SwimBikeRunWorkout.Activity) throws -> OutSbrActivity {
    switch a {
    case .swimming(let loc):
        let s = try swimmingLocationName(loc)
        return OutSbrActivity(kind: "swimming",
                              location: nil,
                              swimmingLocation: s == "unknown" ? nil : s)
    case .cycling(let loc):
        return OutSbrActivity(kind: "cycling",
                              location: try locationName(loc),
                              swimmingLocation: nil)
    case .running(let loc):
        return OutSbrActivity(kind: "running",
                              location: try locationName(loc),
                              swimmingLocation: nil)
    @unknown default:
        throw ParseError.unsupportedWorkoutVariant("unknown SBR activity")
    }
}

private func out(_ s: SwimBikeRunWorkout) throws -> OutSwimBikeRunWorkout {
    OutSwimBikeRunWorkout(
        displayName: s.displayName,
        activities: try s.activities.map { try out($0) }
    )
}

func parseWorkout(bytes: Data) throws -> OutSpec {
    let plan = try WorkoutPlan(from: bytes)
    let id = plan.id.uuidString
    switch plan.workout {
    case .custom(let c):      return OutSpec(referenceId: id, custom: try out(c), goal: nil, pacer: nil, swimBikeRun: nil)
    case .goal(let g):        return OutSpec(referenceId: id, custom: nil, goal: try out(g), pacer: nil, swimBikeRun: nil)
    case .pacer(let p):       return OutSpec(referenceId: id, custom: nil, goal: nil, pacer: try out(p), swimBikeRun: nil)
    case .swimBikeRun(let s): return OutSpec(referenceId: id, custom: nil, goal: nil, pacer: nil, swimBikeRun: try out(s))
    @unknown default: throw ParseError.unsupportedWorkoutVariant("unknown case")
    }
}

func encodeOutSpec(_ spec: OutSpec) throws -> Data {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys, .prettyPrinted]
    return try encoder.encode(spec)
}
