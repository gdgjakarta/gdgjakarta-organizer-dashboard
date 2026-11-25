---
name: release-changelog
description: >-
  Update both CHANGELOG.md and src/config/changelog.ts from recent git commits,
  keep them in sync so the dashboard Release Changelog modal and CURRENT_APP_VERSION
  stay current, and create the matching vX.Y.Z git tag. Use for "/release-changelog",
  "update changelog and tag", "cut a release", "sync changelog", or "bump changelog".
---

# Release Changelog & Git Tag Skill

Updates `CHANGELOG.md` and `src/config/changelog.ts` together from commits since the latest git tag, then commits and tags the release.

## Arguments (optional)

- `patch` (default) | `minor` | `major` | explicit version like `v1.0.66` or `1.0.66`
- `--sync-only`: only mirror missing versions from `CHANGELOG.md` into `src/config/changelog.ts` without bumping or tagging
- `--push`: also push the release commit and tag to `origin`

## Workflow

### 1. Inspect Current State

Run:

```bash
git status --short
git tag --sort=-v:refname | head -n 5
```

Read the top entry of:
- `CHANGELOG.md` (latest `## [X.Y.Z] - YYYY-MM-DD`)
- `src/config/changelog.ts` (`CHANGELOG_RELEASES[0].version`, which drives `CURRENT_APP_VERSION`)

If there are unrelated uncommitted changes, ask the user whether to proceed or stash/exclude them before committing.

### 2. Collect Commits Since Last Tag

Let `<last-tag>` be the latest `v*` tag (e.g. `v1.0.65`).

```bash
git log <last-tag>..HEAD --no-merges --pretty=format:"%h %ad %s%n%b---" --date=short
```

- **Sync-only fallback**: If `<last-tag>..HEAD` has **no** new commits (or `--sync-only` was passed), check whether `src/config/changelog.ts` is behind `CHANGELOG.md`. If behind, backfill every missing release into `src/config/changelog.ts`, verify, commit `chore(release): sync dashboard changelog with CHANGELOG.md`, and stop without creating a new tag.
- If there are no new commits and both files already match, report that everything is up to date and stop.

### 3. Determine Target Version & Date

- If the user supplied an explicit version (e.g. `v1.0.66`), use it (strip leading `v` for `CHANGELOG.md` and `changelog.ts`; keep `v` for the git tag).
- Otherwise bump `<last-tag>`:
  - `major` (or commit has `BREAKING CHANGE` / `!:`): `(X+1).0.0`
  - `minor`: `X.(Y+1).0`
  - `patch` (default for this repo's `1.0.N` cadence): `X.Y.(Z+1)`
- Release date: today in `YYYY-MM-DD` (WIB / `Asia/Jakarta`).

### 4. Update Both Files Together (Mandatory Invariant)

Never update `CHANGELOG.md` without also updating `src/config/changelog.ts`.

1. **`CHANGELOG.md`**:
   - Prepend a new Keep a Changelog section above the previous top version, separated by `---`:
     ```markdown
     ## [X.Y.Z] - YYYY-MM-DD

     ### Added / Improved / Changed / Fixed
     - **Short Feature/Fix Title**: Concise summary of user-visible changes.

     ---
     ```
   - Skip pure noise commits (e.g. trivial formatting or merge commits) and group related commits cleanly.

2. **`src/config/changelog.ts`**:
   - First backfill any versions present in `CHANGELOG.md` that are missing from `CHANGELOG_RELEASES` (newest first).
   - Remove `badge: "Latest"` from the previous top entry.
   - Prepend the new `ChangelogRelease` at index `0`:
     ```ts
     {
       version: "X.Y.Z",
       releaseDate: "YYYY-MM-DD",
       title: "Concise Release Title",
       badge: "Latest",
       items: [
         {
           category: "Added", // strictly "Added" | "Fixed" | "Improved" | "Changed"
           text: "Concise, user-readable summary matching CHANGELOG.md.",
         },
       ],
     },
     ```
   - Keep `items` concise and readable in the dashboard modal; avoid raw markdown syntax (`**bold**`, backticks) in `text` because `ChangelogDialog` renders plain text.

### 5. Verify

1. Confirm top version in `CHANGELOG.md` === `CHANGELOG_RELEASES[0].version` in `src/config/changelog.ts`.
2. Confirm only `CHANGELOG_RELEASES[0]` has `badge: "Latest"`.
3. Run targeted Biome check:
   ```bash
   npx biome check --write src/config/changelog.ts
   ```

### 6. Commit & Tag

Stage only the changelog files:

```bash
git add CHANGELOG.md src/config/changelog.ts
git commit -m "chore(release): update changelog for vX.Y.Z"
git tag -a vX.Y.Z -m "Release vX.Y.Z: <Concise Release Title>"
```

- Never overwrite an existing git tag unless the user explicitly asks to move/retag it.
- Only run `git push && git push origin vX.Y.Z` if the user passed `--push` or explicitly asked to push; otherwise show the exact push command for them to run or confirm.
