import Foundation
import WorkoutKit

func usage() -> Never {
    FileHandle.standardError.write(Data("""
    usage:
      wkc encode    <spec.json>   <out.workout>  build .workout bytes from spec
      wkc parse     <in.workout>  <out.json>     parse via Apple's API, emit spec JSON
      wkc roundtrip <in.workout>  <out.workout>  parse+re-emit (normalization probe)
    \n
    """.utf8))
    exit(2)
}

let args = CommandLine.arguments
guard args.count == 4 else { usage() }

let cmd = args[1]
let inURL  = URL(fileURLWithPath: args[2])
let outURL = URL(fileURLWithPath: args[3])

do {
    switch cmd {
    case "encode":
        let specData = try Data(contentsOf: inURL)
        let spec = try JSONDecoder().decode(Spec.self, from: specData)
        let plan = try buildPlan(from: spec)
        let bytes = try plan.dataRepresentation
        try bytes.write(to: outURL)
    case "parse":
        let bytes = try Data(contentsOf: inURL)
        let parsed = try parseWorkout(bytes: bytes)
        try encodeOutSpec(parsed).write(to: outURL)
    case "roundtrip":
        // Parse .workout, re-emit .workout (normalization probe for non-determinism).
        let bytes = try Data(contentsOf: inURL)
        let plan = try WorkoutPlan(from: bytes)
        try plan.dataRepresentation.write(to: outURL)
    default:
        usage()
    }
} catch {
    FileHandle.standardError.write(Data("error: \(error)\n".utf8))
    exit(1)
}
