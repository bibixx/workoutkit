import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    encode: "src/encode-api.ts",
    decode: "src/decode-api.ts",
    fs: "src/fs.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
  treeshake: true,
  splitting: false,
});
