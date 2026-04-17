#!/usr/bin/env bash
# Extract reverse-engineering artifacts from WorkoutKit.framework:
#   - Demangled Swift symbol table
#   - __TEXT,__cstring         (proto message/field names, enum values)
#   - __TEXT,__swift5_reflstr  (Swift field names, storage-class order)
#   - __TEXT,__swift5_types    (raw; for deeper analysis if needed)
#
# All outputs are written to ../artifacts/ relative to this script.
# Re-run after each macOS / Xcode upgrade to refresh the schema.
#
# Requirements: Xcode Command Line Tools (cc, xcrun swift-demangle, dyld_info, strings).

set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
OUT="$ROOT/artifacts"
DUMPER_SRC="$ROOT/tools/workoutkit-section-dumper/dump-section.c"
DUMPER_BIN="$ROOT/tools/workoutkit-section-dumper/dump-section"

FRAMEWORK_BUNDLE="/System/Library/Frameworks/WorkoutKit.framework"
FRAMEWORK="$FRAMEWORK_BUNDLE/WorkoutKit"
SWIFTPROTOBUF="/System/Library/PrivateFrameworks/InternalSwiftProtobuf.framework/InternalSwiftProtobuf"

# On modern macOS the framework binary is inside the dyld shared cache, so
# the file doesn't exist on disk — the bundle directory does. dyld resolves
# the in-cache image when we pass the conventional path.
if [[ ! -d "$FRAMEWORK_BUNDLE" ]]; then
  echo "error: WorkoutKit.framework bundle not found at $FRAMEWORK_BUNDLE" >&2
  exit 1
fi

mkdir -p "$OUT"

# -- 1. Record macOS / Xcode / framework versions for provenance -------------
{
  echo "# extracted: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "# sw_vers:"
  sw_vers | sed 's/^/#   /'
  echo "# xcode-select: $(xcode-select -p)"
  echo "# framework uuid + platform:"
  dyld_info "$FRAMEWORK" 2>/dev/null \
    | awk '/-uuid:|-platform:/,/-segments:/' \
    | grep -vE '^\s*-segments:' \
    | sed 's/^/#   /'
} > "$OUT/provenance.txt"

# -- 2. Exports + demangled symbols ------------------------------------------
dyld_info -exports "$FRAMEWORK" \
  | awk '/^[[:space:]]+0x/ {print $2}' \
  | xcrun swift-demangle \
  | sort -u > "$OUT/symbols.demangled.txt"

# WorkoutKit-owned type catalog
grep -oE 'WorkoutKit\.[A-Z][A-Za-z0-9_]+(\.[A-Z][A-Za-z0-9_]+)*' \
  "$OUT/symbols.demangled.txt" | sort -u > "$OUT/types.txt"

# -- 3. Linked libraries (documents which private frameworks it pulls in) ----
dyld_info -dependents "$FRAMEWORK" > "$OUT/dependents.txt"

# -- 4. Build the section dumper ---------------------------------------------
cc -O2 -Wall -o "$DUMPER_BIN" "$DUMPER_SRC"

# -- 5. Dump sections, then run `strings` over them --------------------------
dump() {
  local section="$1" segment="${2:-__TEXT}"
  local base
  base="$(echo "$section" | tr -d '_')"
  "$DUMPER_BIN" WorkoutKit "$section" "$segment" \
    "$FRAMEWORK" "$SWIFTPROTOBUF" \
    > "$OUT/$base.bin" 2> "$OUT/$base.log"
  strings -a "$OUT/$base.bin" > "$OUT/$base.txt"
}

dump __cstring
dump __swift5_reflstr
dump __swift5_types || true   # optional; present on most builds

# -- 6. Pull out proto-relevant strings --------------------------------------
grep -E '^apple\.workout\.' "$OUT/cstring.txt" | sort -u > "$OUT/proto-messages.txt"

# Enum-like all-caps tokens that appear inside proto message neighborhoods
grep -E '^[A-Z][A-Z0-9_]+$' "$OUT/cstring.txt" | sort -u > "$OUT/proto-enum-values.txt"

echo
echo "Artifacts written to: $OUT"
ls -la "$OUT"
