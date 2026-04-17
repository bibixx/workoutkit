# AGENTS.md

Orientation notes for coding agents working in this repo.

## Where to look

- **Writing code that uses the SDK?** Read [`README.md`](README.md).
- **Hacking on the SDK itself?** Read [`DEVELOPMENT.md`](DEVELOPMENT.md) —
  covers repo layout, dev workflow, testing strategy, and the
  reverse-engineering pipeline.
- **Cutting a release?** Use the `release` skill at
  [`.agents/skills/release/SKILL.md`](.agents/skills/release/SKILL.md). It
  handles pre-flight, typecheck, tests, build, publish, tag, and GitHub
  release in the correct order.

## Dev loop

- `npm install` — workspaces (`sdk`, `tests`).
- `npm test` — Vitest runs against `sdk/src/*.ts` directly via
  `resolve.alias` in `tests/vitest.config.ts`. **No build step** is
  needed in the dev loop.
- `npm run typecheck` — `tsc --noEmit` against the SDK sources.
- `npm run build:sdk` — tsup → `sdk/dist/` (ESM + CJS + .d.ts).
- `npm run build:corpus` — SwiftPM build of the WorkoutKit oracle CLI.

## Conventions

- **Published entry points** are declared in `sdk/package.json` `exports`
  with `types`/`import`/`require` pointing at `dist/*`. If you add a new
  subpath, (1) add a tsup entry, (2) add the `exports` block, and (3)
  add a `resolve.alias` line in `tests/vitest.config.ts` so tests resolve
  to `sdk/src/*.ts` without a build step. Do **not** use a `development`
  export condition — Vite default-matches it in consumers, resolving to
  files not in the tarball.
- **Tree-shake guarantee.** `tests/src/tree-shake.test.ts` statically walks
  the import graph and asserts each subpath pulls in only what it should.
  tsup is configured with `splitting: false` so the published output keeps
  the same guarantee. Don't introduce cross-subpath shared state.
- **Commit style.** See the root `CLAUDE.md` / global user instructions.
