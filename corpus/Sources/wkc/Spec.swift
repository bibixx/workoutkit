import Foundation

// Shared declarative spec format. Mirrored byte-for-byte semantics by the
// TypeScript SDK. Keep field names identical.

struct Spec: Decodable {
    let referenceId: String?
    // Exactly one of the following four must be present.
    let custom: CustomWorkoutSpec?
    let goal: SingleGoalWorkoutSpec?
    let pacer: PacerWorkoutSpec?
    let swimBikeRun: SwimBikeRunWorkoutSpec?
}

struct CustomWorkoutSpec: Decodable {
    let activity: String
    let location: String
    let swimmingLocation: String?
    let displayName: String?
    let warmup: StepSpec?
    let blocks: [BlockSpec]
    let cooldown: StepSpec?
}

struct SingleGoalWorkoutSpec: Decodable {
    let activity: String
    let location: String
    let swimmingLocation: String?
    let goal: GoalSpec?     // defaults to .open when omitted
}

struct PacerWorkoutSpec: Decodable {
    let activity: String
    let location: String
    let distance: GoalSpec.Quantity
    let time: GoalSpec.Quantity
}

struct SwimBikeRunWorkoutSpec: Decodable {
    let displayName: String?
    let activities: [SbrActivitySpec]
}

struct SbrActivitySpec: Decodable {
    let kind: String              // "swimming" | "cycling" | "running"
    let location: String?         // session location; used by cycling/running
    let swimmingLocation: String? // used by swimming
}

struct BlockSpec: Decodable {
    let iterations: Int
    let steps: [IntervalStepSpec]
}

struct IntervalStepSpec: Decodable {
    let purpose: String
    let step: StepSpec
}

struct StepSpec: Decodable {
    let displayName: String?
    let goal: GoalSpec
    let alert: AlertSpec?
}

enum AlertSpec: Decodable, Equatable {
    case heartRateZone(zone: Int)
    case heartRateRange(min: Quantity, max: Quantity)
    case powerZone(zone: Int, metric: String?)
    case powerRange(min: Quantity, max: Quantity, metric: String?)
    case powerThreshold(threshold: Quantity, metric: String?)
    case speedRange(min: Quantity, max: Quantity, metric: String?)
    case speedThreshold(threshold: Quantity, metric: String?)
    case cadenceThreshold(threshold: Quantity)
    case cadenceRange(min: Quantity, max: Quantity)

    struct Quantity: Decodable, Equatable { let value: Double; let unit: String }

    private enum Key: String, CodingKey {
        case type, zone, min, max, threshold, metric
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Key.self)
        let kind = try c.decode(String.self, forKey: .type)
        switch kind {
        case "heartRateZone":
            self = .heartRateZone(zone: try c.decode(Int.self, forKey: .zone))
        case "heartRateRange":
            self = .heartRateRange(
                min: try c.decode(Quantity.self, forKey: .min),
                max: try c.decode(Quantity.self, forKey: .max)
            )
        case "powerZone":
            self = .powerZone(
                zone: try c.decode(Int.self, forKey: .zone),
                metric: try c.decodeIfPresent(String.self, forKey: .metric)
            )
        case "powerRange":
            self = .powerRange(
                min: try c.decode(Quantity.self, forKey: .min),
                max: try c.decode(Quantity.self, forKey: .max),
                metric: try c.decodeIfPresent(String.self, forKey: .metric)
            )
        case "powerThreshold":
            self = .powerThreshold(
                threshold: try c.decode(Quantity.self, forKey: .threshold),
                metric: try c.decodeIfPresent(String.self, forKey: .metric)
            )
        case "speedRange":
            self = .speedRange(
                min: try c.decode(Quantity.self, forKey: .min),
                max: try c.decode(Quantity.self, forKey: .max),
                metric: try c.decodeIfPresent(String.self, forKey: .metric)
            )
        case "speedThreshold":
            self = .speedThreshold(
                threshold: try c.decode(Quantity.self, forKey: .threshold),
                metric: try c.decodeIfPresent(String.self, forKey: .metric)
            )
        case "cadenceThreshold":
            self = .cadenceThreshold(
                threshold: try c.decode(Quantity.self, forKey: .threshold)
            )
        case "cadenceRange":
            self = .cadenceRange(
                min: try c.decode(Quantity.self, forKey: .min),
                max: try c.decode(Quantity.self, forKey: .max)
            )
        default:
            throw DecodingError.dataCorruptedError(
                forKey: .type, in: c,
                debugDescription: "unknown alert type: \(kind)")
        }
    }
}

enum GoalSpec: Decodable, Equatable {
    case open
    case time(value: Double, unit: String)
    case distance(value: Double, unit: String)
    case energy(value: Double, unit: String)
    case poolSwimDistanceWithTime(distance: Quantity, time: Quantity)

    struct Quantity: Decodable, Equatable { let value: Double; let unit: String }

    private enum Key: String, CodingKey { case type, time, distance, energy, poolSwimDistanceWithTime }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: Key.self)
        switch try c.decode(String.self, forKey: .type) {
        case "open":
            self = .open
        case "time":
            let q = try c.decode(Quantity.self, forKey: .time)
            self = .time(value: q.value, unit: q.unit)
        case "distance":
            let q = try c.decode(Quantity.self, forKey: .distance)
            self = .distance(value: q.value, unit: q.unit)
        case "energy":
            let q = try c.decode(Quantity.self, forKey: .energy)
            self = .energy(value: q.value, unit: q.unit)
        case "poolSwimDistanceWithTime":
            struct Pair: Decodable { let distance: Quantity; let time: Quantity }
            let p = try c.decode(Pair.self, forKey: .poolSwimDistanceWithTime)
            self = .poolSwimDistanceWithTime(distance: p.distance, time: p.time)
        case let other:
            throw DecodingError.dataCorruptedError(
                forKey: .type, in: c,
                debugDescription: "unknown goal type: \(other)")
        }
    }
}
