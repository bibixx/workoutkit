---
name: Release @bibixx/workoutkit
description: Build, publish to npm, tag, and create a GitHub release for the SDK.
allowed-tools:
  - Bash
  - Read
  - Edit
---

# Release @bibixx/workoutkit

End-to-end release: pre-flight → typecheck → test → build → publish → tag →
GitHub release. **Publish happens before tag+push**, so a failed publish
never leaves an orphan tag pointing at a version that isn't on npm.

## Non-negotiables

- Never `npm publish` before `typecheck`, `test`, and `build` all succeed.
- Never push a tag before `npm publish` succeeds.
- Never use `--force` and never skip git hooks.
- If publish succeeds but `git push` fails, surface both the published
  version and the push error clearly — the user has to resolve manually.

## Steps

### 1. Pre-flight

Run each and stop on any failure:

```bash
git status --porcelain                                  # must be empty
git rev-parse --abbrev-ref HEAD                         # must print "main"
git fetch origin && git status -sb                      # must be up to date with origin/main
npm whoami                                              # must be logged in; if not, tell user to run `npm login` and stop
gh auth status                                          # must be authenticated
```

### 2. Decide the new version

- Read current version from `sdk/package.json`.
- Ask the user for the bump type: `patch` / `minor` / `major` / explicit
  `x.y.z`. Default suggestion: `patch`.
- Compute `NEW` (the new version) but **do not write it yet**.

### 3. Preview release notes

Run:

```bash
gh api repos/bibixx/workoutkit/releases/generate-notes \
  -f tag_name=vNEW -f target_commitish=main -f previous_tag_name=vPREV
```

(`vPREV` = the most recent `v*` tag; run `git describe --tags --abbrev=0` to
find it.) If no previous tag exists, fall back to:

```bash
git log --pretty=format:'- %s (%h)'
```

Show the generated notes to the user and capture the approved body as
`$NOTES`. The user may edit before approving.

### 4. Checks & build

Run from the repo root. All must pass:

```bash
npm run typecheck          # tsc --noEmit against sdk/src
npm test                   # Vitest — 154+ tests against sdk/src
npm run build:sdk          # tsup → sdk/dist/
npm pack --dry-run -w @bibixx/workoutkit
```

Show the `npm pack --dry-run` file list to the user for final review —
catches anything accidentally shipped or missing.

### 5. Bump version & commit

```bash
npm version NEW --workspace @bibixx/workoutkit --no-git-tag-version
git add sdk/package.json package-lock.json
git commit -m "Release @bibixx/workoutkit vNEW"
```

`--no-git-tag-version` matters: we control tagging ourselves (step 7) so
publish can happen first.

### 6. Publish to npm

```bash
npm publish -w @bibixx/workoutkit
```

Uses `publishConfig.access: "public"` from `sdk/package.json`. The `prepack`
script copies `README.md` + `LICENSE` into `sdk/`; `postpack` cleans them
back up so `git status` stays clean.

**On failure:** do NOT push commit or tag. Surface the error and stop.

### 7. Tag & push

Use an **annotated** tag — lightweight tags are rejected when
`tag.gpgSign=true` is set (it is in this repo).

```bash
git tag -a vNEW -m "Release @bibixx/workoutkit vNEW"
git push origin main --follow-tags
```

### 8. GitHub release

```bash
gh release create vNEW --title "vNEW" --notes "$NOTES"
```

Use the approved body from step 3.

### 9. Summary

Print:
- Published version.
- npm URL: `https://www.npmjs.com/package/@bibixx/workoutkit/v/NEW`
- Release URL (from `gh release create` output).
- Tag SHA: `git rev-parse vNEW`.
