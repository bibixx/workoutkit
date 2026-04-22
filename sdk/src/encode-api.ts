import { encodeWorkoutPlan } from "./encode.ts";
import type { WorkoutPlan } from "./classes.ts";
import type { WorkoutPlanJson } from "./schema.ts";

type EncodeInput = WorkoutPlan | WorkoutPlanJson;

function toJson(plan: EncodeInput): WorkoutPlanJson {
  // Duck-type detection keeps this subpath free of a runtime dep on the
  // class module — browser bundles that import only `/encode` stay lean.
  const candidate = plan as { toJSON?: () => WorkoutPlanJson };
  return typeof candidate.toJSON === "function" ? candidate.toJSON() : (plan as WorkoutPlanJson);
}

export function encode(plan: EncodeInput): Uint8Array {
  return encodeWorkoutPlan(toJson(plan));
}

export function toBlob(plan: EncodeInput, type = "application/octet-stream"): Blob {
  // Cast needed in TS 5.7+: default Uint8Array<ArrayBufferLike> isn't assignable
  // to BlobPart, which expects Uint8Array<ArrayBuffer>. Runtime is identical.
  return new Blob([encode(plan) as BlobPart], { type });
}

export function toBase64(plan: EncodeInput): string {
  const bytes = encode(plan);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]!);
  }
  // btoa is a Web Standard, available in browser, Node 16+, Bun, and Deno.
  return btoa(binary);
}
