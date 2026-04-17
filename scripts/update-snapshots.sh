#!/usr/bin/env bash
# Refresh the byte-parity canary snapshot(s) from the current SDK output.
# Run after intentional encoder changes when the canary fails but semantic
# tests still pass.

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

cd "$ROOT"

# Currently only pool-swim is snapshotted.
node --experimental-strip-types --no-warnings \
  -e "
    import('workout-file-sdk').then(async ({ encodeWorkoutPlan }) => {
      const { loadSpec } = await import('./tests/src/spec.ts');
      const fs = await import('node:fs');
      const path = await import('node:path');
      const bytes = encodeWorkoutPlan(loadSpec('tests/fixtures/pool-swim.spec.json'));
      fs.writeFileSync('tests/snapshots/pool-swim.workout', bytes);
      console.log('updated tests/snapshots/pool-swim.workout (' + bytes.length + ' bytes)');
    });
  "
