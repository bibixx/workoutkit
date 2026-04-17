// Raw protobuf decoder — schema-agnostic, used to produce readable diff output
// when a byte-for-byte comparison fails.

type Field =
  | { field: number; type: "varint"; value: bigint }
  | { field: number; type: "i64"; double: number; int64: bigint }
  | { field: number; type: "i32"; float: number; int32: number }
  | { field: number; type: "string"; value: string }
  | { field: number; type: "message"; fields: Field[] }
  | { field: number; type: "bytes"; hex: string };

function readVarint(data: Uint8Array, i: number): [bigint, number] {
  let result = 0n;
  let shift = 0n;
  while (true) {
    const b = data[i++];
    result |= BigInt(b & 0x7f) << shift;
    if ((b & 0x80) === 0) return [result, i];
    shift += 7n;
  }
}

function isPrintable(bytes: Uint8Array): string | null {
  try {
    const s = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    for (const ch of s) {
      const c = ch.codePointAt(0)!;
      if (c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) return null;
    }
    return s;
  } catch {
    return null;
  }
}

export function rawDecode(data: Uint8Array): Field[] | null {
  const out: Field[] = [];
  let i = 0;
  while (i < data.length) {
    if (i >= data.length) return null;
    let tag: bigint;
    try {
      [tag, i] = readVarint(data, i);
    } catch {
      return null;
    }
    const field = Number(tag >> 3n);
    const wire = Number(tag & 7n);
    if (field === 0) return null;
    if (wire === 0) {
      const [v, ni] = readVarint(data, i);
      i = ni;
      out.push({ field, type: "varint", value: v });
    } else if (wire === 1) {
      if (i + 8 > data.length) return null;
      const dv = new DataView(data.buffer, data.byteOffset + i, 8);
      out.push({
        field,
        type: "i64",
        double: dv.getFloat64(0, true),
        int64: dv.getBigInt64(0, true),
      });
      i += 8;
    } else if (wire === 2) {
      const [lenB, ni] = readVarint(data, i);
      i = ni;
      const len = Number(lenB);
      if (i + len > data.length) return null;
      const sub = data.subarray(i, i + len);
      i += len;
      const text = isPrintable(sub);
      if (text !== null && text.length > 0) {
        out.push({ field, type: "string", value: text });
      } else {
        const nested = rawDecode(sub);
        if (nested !== null) {
          out.push({ field, type: "message", fields: nested });
        } else {
          out.push({
            field,
            type: "bytes",
            hex: Array.from(sub, (b) => b.toString(16).padStart(2, "0")).join(""),
          });
        }
      }
    } else if (wire === 5) {
      if (i + 4 > data.length) return null;
      const dv = new DataView(data.buffer, data.byteOffset + i, 4);
      out.push({
        field,
        type: "i32",
        float: dv.getFloat32(0, true),
        int32: dv.getInt32(0, true),
      });
      i += 4;
    } else {
      return null;
    }
  }
  return out;
}

export function formatFields(fields: Field[], indent = 0): string {
  const pad = "  ".repeat(indent);
  const lines: string[] = [];
  for (const f of fields) {
    switch (f.type) {
      case "varint":
        lines.push(`${pad}${f.field}: varint = ${f.value}`);
        break;
      case "i64":
        lines.push(`${pad}${f.field}: i64 = ${f.double} (int64=${f.int64})`);
        break;
      case "i32":
        lines.push(`${pad}${f.field}: i32 = ${f.float} (int32=${f.int32})`);
        break;
      case "string":
        lines.push(`${pad}${f.field}: string = ${JSON.stringify(f.value)}`);
        break;
      case "bytes":
        lines.push(`${pad}${f.field}: bytes = ${f.hex}`);
        break;
      case "message":
        lines.push(`${pad}${f.field}: {`);
        lines.push(formatFields(f.fields, indent + 1));
        lines.push(`${pad}}`);
        break;
    }
  }
  return lines.join("\n");
}
