# On-device trial workouts

27 `.workout` files you can AirDrop to your iPhone (or drop into iCloud Drive
and open from the iPhone) to verify the SDK's output is accepted by Apple's
Workout app and syncs to your watch.

Both subdirectories contain **byte-identical files** — `from-ts-sdk/` is what
the TypeScript encoder produces, `from-swift-cli/` is what
`WorkoutPlan.dataRepresentation` produces from the same spec. If they open
indistinguishably, round-trip parity is confirmed.

## Coverage

- **Custom workouts** (`custom-*`) — 10 files covering pool-swim endurance,
  open-goal rides, imperial distances, HIIT mixing minutes/seconds, long
  cycling, yards swim, feet hikes, minimal-single-block, indoor core circuits,
  unknown-location yoga.
- **Single-goal workouts** (`goal-*`) — 9 files covering run/cycle/walk/swim/
  hike/row across distance, time, and open goals, with pool and open-water
  swimming locations and every SessionLocation variant.
- **Pacer workouts** (`pacer-*`) — 4 files (run 5K, run 10mi, cycle 40K, and a
  fractional-meters run) exercising the distance+time pacer target.
- **SwimBikeRun triathlon variants** (`sbr-*`) — 4 files covering open-water
  tri, pool-based indoor tri, no-displayName tri, and a duathlon
  (run/bike/run) ordering.

## How to install on your watch

1. AirDrop the file from macOS to your iPhone, **or** drop it into iCloud
   Drive and open from the Files app on the iPhone.
2. When prompted, tap "Add to Workouts".
3. The workout appears under *Custom* in the Workout app, and syncs to the
   paired Apple Watch automatically.
4. On the watch: Workout app → scroll to the activity → tap "..." on the
   tile to see your custom plan.

## Regenerate

From the repo root:

```bash
npm run build:corpus
for spec in tests/fixtures/*.spec.json; do
  name=$(basename "$spec" .spec.json)
  ./corpus/.build/debug/wkc encode "$spec" "samples/from-swift-cli/${name}.workout"
done
```

For the TypeScript side, run the inline script from `README.md` or the
`npm test` flow (which also generates SDK outputs during encoding).
