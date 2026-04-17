# On-device trial workouts

Four `.workout` files you can AirDrop to your iPhone (or drop into Files on
iCloud and open from the iPhone) to verify the SDK's output is accepted by
Apple's Workout app and syncs to your watch.

Both subdirectories contain **byte-identical files** — `from-ts-sdk/` is what
the TypeScript encoder produced, `from-swift-cli/` is what Apple's own
`WorkoutPlan.dataRepresentation` produced from the same spec. If they open
indistinguishably, round-trip parity is confirmed.

## Fixtures

| File | Activity | Structure | Why |
|---|---|---|---|
| `pool-swim.workout`     | Pool swim, outdoor | 200m WU → 4×(200m Free / 40s rest) → 1×(200m Back) → 100m CD | The one you attached; round-trip proof |
| `walking-miles.workout` | Walking, outdoor | 2.5 mi | Imperial distance unit |
| `cycling-open.workout`  | Cycling, outdoor | Open WU → open "Freeride" → 5 min CD | `open` goal coverage |
| `hiit-mixed.workout`    | HIIT, indoor | 5 min WU → 2×(30s/15s) → 2×(45s/30s) → 3 min CD | Multi-block + minutes/seconds mix |

## How to install on your watch

1. AirDrop the file from macOS to your iPhone, **or** drop it into iCloud
   Drive and open from the Files app on the iPhone.
2. When prompted, tap "Add to Workouts".
3. The workout appears under *Custom* in the Workout app, and syncs to the
   paired Apple Watch automatically.
4. On the watch: Workout app → scroll to the activity → tap "..." on the
   tile to see your custom plan.

## Regenerate

```bash
# from the repo root
./corpus/.build/debug/wkc encode tests/fixtures/pool-swim.spec.json samples/from-swift-cli/pool-swim.workout
```

Or, for all fixtures:

```bash
for spec in tests/fixtures/*.spec.json; do
  name=$(basename "$spec" .spec.json)
  ./corpus/.build/debug/wkc encode "$spec" "samples/from-swift-cli/${name}.workout"
done
```
