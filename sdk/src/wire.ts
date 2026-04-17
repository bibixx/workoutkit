// Minimal protobuf wire encoder. Deterministic output: callers emit fields
// in ascending tag order, and we never emit scalar defaults.

const WIRE_VARINT = 0;
const WIRE_I64 = 1;
const WIRE_LEN = 2;
const WIRE_I32 = 5;

export class Writer {
  private chunks: Uint8Array[] = [];
  private len = 0;

  private push(bytes: Uint8Array): void {
    this.chunks.push(bytes);
    this.len += bytes.length;
  }

  private tag(field: number, wire: number): void {
    this.varint((field << 3) | wire);
  }

  private varint(value: number | bigint): void {
    let v = typeof value === "bigint" ? value : BigInt(value);
    const out: number[] = [];
    while (v >= 0x80n) {
      out.push(Number(v & 0x7fn) | 0x80);
      v >>= 7n;
    }
    out.push(Number(v));
    this.push(new Uint8Array(out));
  }

  /** varint field, omitted when value == 0 (proto3 default). */
  uint32(field: number, value: number): void {
    if (value === 0) return;
    this.tag(field, WIRE_VARINT);
    this.varint(value);
  }

  /** uint32 but always emitted (for enums where 0 is still a valid value to serialize). */
  uint32Required(field: number, value: number): void {
    this.tag(field, WIRE_VARINT);
    this.varint(value);
  }

  double(field: number, value: number): void {
    if (value === 0) return;
    this.tag(field, WIRE_I64);
    const buf = new ArrayBuffer(8);
    new DataView(buf).setFloat64(0, value, true);
    this.push(new Uint8Array(buf));
  }

  /** double without default-skip (for message fields where 0.0 is meaningful). */
  doubleRequired(field: number, value: number): void {
    this.tag(field, WIRE_I64);
    const buf = new ArrayBuffer(8);
    new DataView(buf).setFloat64(0, value, true);
    this.push(new Uint8Array(buf));
  }

  string(field: number, value: string | null | undefined): void {
    if (value == null || value.length === 0) return;
    this.tag(field, WIRE_LEN);
    const bytes = new TextEncoder().encode(value);
    this.varint(bytes.length);
    this.push(bytes);
  }

  /** Nested length-delimited message, built via a sub-writer. */
  message(field: number, build: (w: Writer) => void): void {
    const sub = new Writer();
    build(sub);
    const bytes = sub.finish();
    this.tag(field, WIRE_LEN);
    this.varint(bytes.length);
    this.push(bytes);
  }

  /** Like `message`, but omits the field when the sub-message has no bytes. */
  messageOptional(field: number, build: (w: Writer) => void): void {
    const sub = new Writer();
    build(sub);
    const bytes = sub.finish();
    if (bytes.length === 0) return;
    this.tag(field, WIRE_LEN);
    this.varint(bytes.length);
    this.push(bytes);
  }

  finish(): Uint8Array {
    const out = new Uint8Array(this.len);
    let off = 0;
    for (const c of this.chunks) {
      out.set(c, off);
      off += c.length;
    }
    return out;
  }
}
