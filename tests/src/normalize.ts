// Canonicalise spec-shaped JSON for deep-equal comparisons.
//
// Swift's JSONEncoder omits missing optionals entirely, but the input spec
// files may or may not include them. We deep-copy both sides through
// `JSON.parse(JSON.stringify(...))`, which drops `undefined` values, and
// then uppercase the UUID (Apple always emits uppercase; user-authored
// spec files sometimes use lowercase).

import type { WorkoutPlan } from "workout-file-sdk";

type Obj = Record<string, unknown>;

function isObject(v: unknown): v is Obj {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function walk(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(walk);
  if (isObject(node)) {
    const out: Obj = {};
    for (const [k, v] of Object.entries(node)) {
      // Drop undefined and empty strings — proto3 default-omission means
      // an empty string on the wire is indistinguishable from "not set".
      // Apple's parser surfaces the absence, not the empty value.
      if (v === undefined) continue;
      if (v === "") continue;
      out[k] = walk(v);
    }
    return out;
  }
  return node;
}

export function normalize(spec: WorkoutPlan | unknown): unknown {
  const copy = JSON.parse(JSON.stringify(spec)) as Obj;
  if (typeof copy.referenceId === "string") {
    copy.referenceId = (copy.referenceId as string).toUpperCase();
  }
  return walk(copy);
}
