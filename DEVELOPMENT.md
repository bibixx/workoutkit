# Development

Internal docs for hacking on `@bibixx/workoutkit`. If you just want to *use*
the SDK, read [`README.md`](README.md) instead.

## Repo layout

```
workoutkit/
├── sdk/                           the published TS SDK (encode + decode + classes)
│   ├── src/                       source — tests run directly against this
│   ├── tsup.config.ts             build config (ESM + CJS + .d.ts, multi-entry)
│   └── package.json               publishable package metadata
├── tests/                         Vitest harness (fixtures + byte-diff tests)
│   ├── src/                       *.test.ts against sdk/src via Vitest resolve.alias
│   ├── fixtures/                  *.spec.json — input to both the Swift oracle and the TS SDK
│   └── snapshots/                 recorded Apple-parser output per fixture
├── corpus/                        Swift CLI oracle: spec JSON → .workout bytes via WorkoutKit
├── tools/
│   └── workoutkit-section-dumper/ C helper that dumps Mach-O sections from a dlopen'd image
├── artifacts/                     extraction output (regenerable)
├── scripts/
│   ├── extract-workoutkit.sh      one-shot artifact extractor (re-run per OS/Xcode bump)
│   └── update-snapshots.sh        regenerate tests/snapshots from the oracle
├── samples/                       hand-inspected `.workout` files from real shares
└── .agents/skills/release/        the `Release @bibixx/workoutkit` skill
```

## Dev workflow

```bash
npm install               # workspaces: sdk + tests
npm test                  # Vitest — runs against sdk/src directly
npm run typecheck         # tsc --noEmit against sdk/src
npm run build:sdk         # tsup → sdk/dist/
npm run build:corpus      # SwiftPM build of the WorkoutKit oracle CLI
npm run extract           # re-run WorkoutKit symbol/section extraction
```

**Zero-rebuild test loop.** `tests/vitest.config.ts` aliases
`@bibixx/workoutkit[/subpath]` directly to `sdk/src/*.ts`. No build step is
needed between editing source and running tests. Consumers see only
`dist/*` via `exports`.

> Why not a `development` export condition? We tried that — Vite
> default-includes `development` in consumers' dev mode, which then
> resolved against `./src/*.ts` paths that aren't in the published
> tarball (`files: ["dist", ...]`). Scoping the dev-loop resolution to
> our vitest config via `resolve.alias` avoids the leak.

## Testing strategy

Four independent dimensions; a regression in any one is a real regression.

1. **Semantic (Apple-parser oracle).** Every fixture in `tests/fixtures/*.spec.json`
   is fed through the Swift `corpus` CLI (linked against real `WorkoutKit`), which
   writes `expected.workout` bytes. The same spec goes through the TS SDK, and we
   assert byte equality. When they diverge, `raw-protobuf` is used to produce a
   field-by-field diff for readability.
2. **JSON round-trip.** `plan.toJSON()` → `WorkoutPlan.fromJson(...)` must be
   idempotent for every fixture.
3. **Encode/decode symmetry.** `decode(encode(plan))` recovers the same JSON.
4. **Tree-shake guarantee.** `tree-shake.test.ts` statically parses the import
   graph under `sdk/src/` starting from `encode-api.ts` / `decode-api.ts` and
   asserts each subpath pulls in only the modules it should. `tsup` is
   configured with `splitting: false` so the published bundles keep the same
   guarantee — no shared chunks between `/encode` and `/decode`.

## Releasing

Use the `release` skill:

```
.agents/skills/release/SKILL.md
```

It pre-flights, typechecks, runs tests, builds, `npm publish`es, tags, and
creates the GitHub release. The skill never pushes a tag for a version that
isn't on npm — publish happens before tag+push.

## Reverse-engineering pipeline

### 1. Extract schema clues from the framework

```bash
./scripts/extract-workoutkit.sh
```

This:
- Enumerates exported Swift symbols via `dyld_info -exports`, demangles them.
- Compiles `tools/workoutkit-section-dumper`, then dumps `__TEXT,__cstring`,
  `__TEXT,__swift5_reflstr`, and `__TEXT,__swift5_types` from an in-process
  `dlopen` of `WorkoutKit.framework` (the binary lives inside the dyld shared
  cache — no on-disk extraction needed).
- Filters proto-message names (`apple.workout.*`) and all-caps enum values.
- Writes `artifacts/provenance.txt` with macOS + Xcode versions so we can
  track schema drift across OS releases.

The key outputs are `artifacts/proto-messages.txt` and `artifacts/cstring.txt`
— together they give us every proto message name, every field name, and every
enum value Apple ships. `artifacts/swift5reflstr.txt` gives Swift storage-class
field *order*, which maps 1:1 to proto field numbers.

> Requires Xcode Command Line Tools. Works on modern macOS where the framework
> binary is inside the dyld shared cache — we never extract the whole cache
> (the iPhoneOS `dsc_extractor.bundle` segfaults on macOS caches anyway).

### 2. Generate ground-truth `.workout` blobs from Swift

`corpus/` is a SwiftPM CLI linked against WorkoutKit. It reads a spec JSON
describing a workout and writes the exact `.workout` bytes that Apple's
runtime produces, via `WorkoutPlan`'s `Transferable` export. This is our
oracle — whatever bytes it produces are, by definition, correct.

### 3. Mirror the format in TypeScript

`sdk/` implements encode + decode against the reconstructed proto schema.
Field numbers are pinned by running one-variable-diff pairs through the
corpus CLI (e.g. same workout with `activity: running` vs `cycling`) and
seeing which varint byte flips.

### 4. Diff tests

`tests/` loads each `fixtures/*.spec.json`, invokes the corpus CLI to produce
`expected.workout` and the TS SDK to produce `actual.workout`, and asserts
byte equality (with a fallback raw-protobuf decode on mismatch for readable
diffs).

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

Apple will evolve this format (the `majorVersion` / `minorVersion` /
`privateVersion` fields are the version gate). After each macOS upgrade:

1. Re-run `./scripts/extract-workoutkit.sh`.
2. Diff `artifacts/` against the previous run.
3. Update `sdk/src/` and `tests/fixtures/` for any new or changed fields.
4. Re-record oracle snapshots via `./scripts/update-snapshots.sh`.
5. Bump the SDK's supported range and cut a release.
