import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Point `@bibixx/workoutkit[/subpath]` at the SDK sources so edits hit the
// test runner with no rebuild in between. The published package.json has no
// `development` export condition — it used to, but Vite default-includes
// `development` in consumers' dev mode, which resolved to ./src/*.ts files
// that aren't in the tarball. Aliasing here keeps the dev loop for us only.
const src = resolve(fileURLToPath(new URL("./", import.meta.url)), "../sdk/src");

export default defineConfig({
  resolve: {
    alias: [
      { find: "@bibixx/workoutkit/encode", replacement: resolve(src, "encode-api.ts") },
      { find: "@bibixx/workoutkit/decode", replacement: resolve(src, "decode-api.ts") },
      { find: "@bibixx/workoutkit/fs", replacement: resolve(src, "fs.ts") },
      { find: "@bibixx/workoutkit", replacement: resolve(src, "index.ts") },
    ],
  },
  test: {
    include: ["src/**/*.test.ts"],
    reporters: ["verbose"],
  },
});
