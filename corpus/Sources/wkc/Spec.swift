import Foundation

// Shared declarative spec format. Mirrored byte-for-byte semantics by the
// TypeScript SDK. Keep field names identical.

struct Spec: Decodable {
    let referenceId: String?        // UUID; optional for round-trip tests
    let custom: CustomWorkoutSpec?
    // future: `goal`, `pacer`, `swimBikeRun`
}

struct CustomWorkoutSpec: Decodable {
    let activity: String            // "swimming", "running", "cycling", ...
    let location: String            // "unknown" | "indoor" | "outdoor"
    let swimmingLocation: String?   // "unknown" | "pool" | "openWater"
    let displayName: String?
    let warmup: StepSpec?
    let blocks: [BlockSpec]
    let cooldown: StepSpec?
}

struct BlockSpec: Decodable {
    let iterations: Int
    let steps: [IntervalStepSpec]
}

struct IntervalStepSpec: Decodable {
    let purpose: String             // "work" | "recovery"
    let step: StepSpec
}

struct StepSpec: Decodable {
    let displayName: String?
    let goal: GoalSpec
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
