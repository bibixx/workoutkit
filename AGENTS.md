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

- `npm install` — workspaces (`sdk`, `tests`). Also runs
  `lefthook install` via the root `prepare` script, wiring up the
  pre-commit and pre-push git hooks.
- `npm test` — Vitest runs against `sdk/src/*.ts` directly via
  `resolve.alias` in `tests/vitest.config.ts`. **No build step** is
  needed in the dev loop.
- `npm run typecheck` — `tsc --noEmit` against both `sdk` and `tests`.
- `npm run lint` / `npm run lint:fix` — `oxlint`.
- `npm run fmt` / `npm run fmt:check` — `oxfmt` (writes / verifies).
- `npm run build:sdk` — tsup → `sdk/dist/` (ESM + CJS + .d.ts).
- `npm run build:corpus` — SwiftPM build of the WorkoutKit oracle CLI.

## Git hooks (lefthook)

Configured in [`lefthook.yml`](lefthook.yml). Installed on `npm install`
via the root `prepare` script.

- **pre-commit** (on staged files): `oxlint`, `oxfmt --check`, full
  `typecheck`. `--check` is deliberate — the hook fails instead of
  silently re-staging reformatted files. Fix with `npm run fmt` and
  re-stage.
- **pre-push**: same three + `npm test`.
- **prepublish** (not a git event): same four checks, invoked from
  `sdk/package.json`'s `prepublishOnly` via `lefthook run prepublish`.
  Runs automatically on `npm publish` so the release skill doesn't
  need an explicit checks step.

If a hook is in the way for a legitimate reason, prefer fixing the root
cause over `--no-verify`.

## Lint / format config

- [`.oxlintrc.json`](.oxlintrc.json) — root config. `correctness` is an
  error, `suspicious` a warning; `dist`, `node_modules`, `.build`,
  `tmp`, `artifacts`, `samples` are ignored.
- [`tests/.oxlintrc.json`](tests/.oxlintrc.json) — enables the `vitest`
  plugin and disables two `jest`-plugin rules (`valid-title`,
  `no-conditional-expect`) that false-positive on our dynamic
  fixture-driven `it(name, …)` pattern and the `try/catch` + `expect`
  shape in `rejected.test.ts`.
- [`.prettierignore`](.prettierignore) — keeps `oxfmt` away from
  hand-crafted docs: `.agents/`, `artifacts/` (ASCII wire-format
  trees, byte dumps), `samples/`. oxfmt picks this up automatically
  (it reads `.gitignore` + `.prettierignore` by default).
- `oxfmt` uses defaults (no `.oxfmtrc.json`). If you find yourself
  fighting a specific rewrite, add an ignore entry rather than a
  repo-wide config override — the defaults are deliberately Prettier-
  compatible.

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
