// Static import-graph check: the `/encode` subpath must not reach
// `decode.ts`, and vice versa. Walks TS `import` statements from the
// respective entrypoints and asserts the other side never appears.

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const sdkSrc = resolve(here, "../../sdk/src");

function importsIn(filePath: string): string[] {
  const src = readFileSync(filePath, "utf8");
  const re = /(?:import|export)\s+(?:[^"']*?from\s+)?["']([^"']+)["']/g;
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src)) !== null) out.push(m[1]!);
  return out;
}

function reachable(entry: string): Set<string> {
  const visited = new Set<string>();
  const queue = [entry];
  while (queue.length) {
    const f = queue.shift()!;
    if (visited.has(f)) continue;
    visited.add(f);
    for (const spec of importsIn(f)) {
      if (!spec.startsWith(".")) continue; // skip node:/bare
      const full = resolve(dirname(f), spec);
      queue.push(full);
    }
  }
  return visited;
}

describe("subpath tree-shaking (static import graph)", () => {
  it("/encode entry does not pull in decode.ts", () => {
    const reached = reachable(resolve(sdkSrc, "encode-api.ts"));
    const asPaths = [...reached].map((p) => p.replace(sdkSrc + "/", ""));
    expect(asPaths).not.toContain("decode.ts");
    expect(asPaths).not.toContain("decode-api.ts");
  });

  it("/decode entry does not pull in encode.ts", () => {
    const reached = reachable(resolve(sdkSrc, "decode-api.ts"));
    const asPaths = [...reached].map((p) => p.replace(sdkSrc + "/", ""));
    expect(asPaths).not.toContain("encode.ts");
    expect(asPaths).not.toContain("encode-api.ts");
    expect(asPaths).not.toContain("wire.ts");
  });

  it("/encode entry does not pull in fs.ts (node-only)", () => {
    const reached = reachable(resolve(sdkSrc, "encode-api.ts"));
    const asPaths = [...reached].map((p) => p.replace(sdkSrc + "/", ""));
    expect(asPaths).not.toContain("fs.ts");
  });
});
