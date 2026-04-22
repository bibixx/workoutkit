// On-demand diagnostic helpers. Not wired into the primary test path;
// imported by the byte-parity canary when its snapshot mismatches, and
// available manually from REPLs / ad-hoc scripts.

import { formatFields, rawDecode } from "./raw-decode.ts";

export function hexDump(buf: Uint8Array): string {
  const lines: string[] = [];
  for (let i = 0; i < buf.length; i += 16) {
    const slice = buf.subarray(i, i + 16);
    const hex = Array.from(slice, (b) => b.toString(16).padStart(2, "0"))
      .join(" ")
      .padEnd(48);
    const ascii = Array.from(slice, (b) =>
      b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : ".",
    ).join("");
    lines.push(`${i.toString(16).padStart(4, "0")}  ${hex}  ${ascii}`);
  }
  return lines.join("\n");
}

export function semanticDiff(expected: Uint8Array, actual: Uint8Array): string {
  const ex = rawDecode(expected);
  const ac = rawDecode(actual);
  if (!ex || !ac) return "(raw proto decode failed)";
  return ["--- expected ---", formatFields(ex), "--- actual ---", formatFields(ac)].join("\n");
}

export function byteMismatchReport(expected: Uint8Array, actual: Uint8Array): string {
  return [
    `size: expected=${expected.length} actual=${actual.length}`,
    "--- expected ---",
    hexDump(expected),
    "--- actual ---",
    hexDump(actual),
    "--- proto diff ---",
    semanticDiff(expected, actual),
  ].join("\n");
}
