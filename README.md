# workout-file-sdk

TypeScript SDK for reading/writing Apple's `.workout` file format (the one shared
from the Workout app on iOS 17+ / watchOS 10+, produced by
`WorkoutKit.WorkoutPlan`'s `Transferable` conformance).

## Layout

```
workout-file-sdk/
├── scripts/
│   └── extract-workoutkit.sh      one-shot artifact extractor (re-run per OS/Xcode bump)
├── tools/
│   └── workoutkit-section-dumper/ C helper that dumps Mach-O sections from a dlopen'd image
├── artifacts/                     extraction output (regenerable)
├── corpus/                        Swift CLI oracle: spec JSON → .workout bytes via WorkoutKit
├── sdk/                           the TS SDK (encode + decode)
├── tests/                         fixtures + byte-diff harness
└── README.md
```

## Reverse-engineering pipeline

### 1. Extract schema clues from the framework

```bash
./scripts/extract-workoutkit.sh
```

This:
- Enumerates exported Swift symbols via `dyld_info -exports`, demangles them.
- Compiles `tools/workoutkit-section-dumper`, then dumps `__TEXT,__cstring`,
  `__TEXT,__swift5_reflstr`, and `__TEXT,__swift5_types` from an
  in-process `dlopen` of `WorkoutKit.framework` (the binary lives inside the
  dyld shared cache — no on-disk extraction needed).
- Filters proto-message names (`apple.workout.*`) and all-caps enum values.
- Writes `artifacts/provenance.txt` with macOS + Xcode versions so we can
  track schema drift across OS releases.

The key output is `artifacts/proto-messages.txt` and `artifacts/cstring.txt`
— together they give us every proto message name, every field name, and
every enum value Apple ships. `artifacts/swift5reflstr.txt` gives Swift
storage-class field *order*, which maps 1:1 to proto field numbers.

> Requires Xcode Command Line Tools. Works on modern macOS where the
> framework binary is inside the dyld shared cache — we never extract the
> whole cache (the iPhoneOS `dsc_extractor.bundle` segfaults on macOS
> caches anyway).

### 2. Generate ground-truth `.workout` blobs from Swift

`corpus/` is a SwiftPM CLI linked against WorkoutKit. It reads a spec JSON
describing a workout and writes the exact `.workout` bytes that Apple's
runtime produces, via `WorkoutPlan`'s `Transferable` export. This is our
oracle — whatever bytes it produces are, by definition, correct.

### 3. Mirror the format in TypeScript

`sdk/` implements encode + decode against the reconstructed proto schema.
Field numbers are pinned by running one-variable-diff pairs through the
corpus CLI (e.g. same workout with `activity: running` vs `cycling`)
and seeing which varint byte flips.

### 4. Diff tests

`tests/` loads each `fixtures/*.spec.json`, invokes the corpus CLI to
produce `expected.workout` and the TS SDK to produce `actual.workout`,
and asserts byte equality (with a fallback raw-protobuf decode on
mismatch for readable diffs).

## Schema summary (reconstructed, see `artifacts/proto-messages.txt`)

```
apple.workout.WorkoutPlan
├── referenceId: string            (field 9, UUID)
├── customComposition              (field 11, oneof with goal/pacer/swimBikeRun)
│   apple.workout.CustomWorkoutComposition
│   ├── activity: HKWorkoutActivityType   (enum, e.g. 46 = swimming)
│   ├── location                          (indoor/outdoor/pool variants)
│   ├── displayName: string
│   ├── warmup: WorkoutStep
│   ├── blocks: repeated IntervalBlock
│   │   └── steps: repeated IntervalStep { purpose: WORK|RECOVERY, step: WorkoutStep }
│   └── cooldown: WorkoutStep
├── route: WorkoutRoute            (optional)
├── majorVersion / minorVersion / privateVersion   (trailer fields ~1000)
└── ...
```

Value types: `DistanceValue`, `TimeValue`, `EnergyValue`, `PowerValue`,
`HeartRateValue`, `SpeedValue`, `CadenceValue`, `ZoneValue`,
`PoolSwimDistanceWithTimeValue`, `LocationCoordinate2D`.

Range types: `CadenceRange`, `HeartRateRange`, `PowerRange`, `SpeedRange`.

## Schema drift

Apple will evolve this format (the `majorVersion`/`minorVersion`/`privateVersion`
fields are the version gate). Re-run `extract-workoutkit.sh` after each macOS
upgrade, diff `artifacts/` against the previous run, and bump the SDK's
supported range.
