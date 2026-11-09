# Releasing

How a new version of Agent Data Lab is checked and published. This page is for maintainers;
visitors never need it.

## Version numbers

Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html): `MAJOR.MINOR.PATCH`.

| Change | Bump | Example |
|---|---|---|
| A new run contract version, or anything that breaks saved runs, forks or public links | Major | 1.4.2 → 2.0.0 |
| A new lesson, view, tool, recording or evaluation case | Minor | 1.4.2 → 1.5.0 |
| A fix, a wording change, a dependency patch | Patch | 1.4.2 → 1.4.3 |

Version 1.0.0 is the first public release.

## While you work

Every user-visible change adds a line under `## [Unreleased]` in [CHANGELOG.md](../CHANGELOG.md),
in the [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) groups: Added, Changed, Deprecated,
Removed, Fixed, Security. Write the plain-language effect first, then the files.

## Before a release

1. Move the `[Unreleased]` entries into a new `## [X.Y.Z] - YYYY-MM-DD` section. Leave `[Unreleased]` in place, empty.
2. Set `"version"` in `package.json` to the same `X.Y.Z`.
3. If a public address changed (repository, hosted site, article, website), update `content/links.ts`
   and every place that uses it. `tests/docs.test.ts` catches mismatches.
4. Run the checks. All must pass:
   - `npm ci`
   - `npm run check`: typecheck, lint, unit tests, build and bundle check, generic safety scan
   - `npm run e2e`: real browsers against the built site
   - the full safety scan with the private term list, which lives outside the repository:
     `LAB_DENYLIST=path/to/denylist npm run scan`
5. Confirm that every result on the page carries its honest label, and that any number new in this
   release has a claim in `content/claims/`.
6. Confirm that README.md describes the page as it is in this release, not as planned: which of the
   three labels the main page actually shows, and that each capability sentence has a claim marker.
7. Confirm that the live recording steps in README.md match what `agent/bedrock.ts` actually reads.
8. Confirm that the built site serves `NOTICE` and the full third-party licence texts for everything
   bundled into `dist/`, and that the page links to them.

## Publishing

The public repository's `main` branch holds one commit per release. Working history stays on the
maintainer's machine.

1. Keep a separate local clone of the public repository for publishing, with your GitHub noreply
   address as `user.email`. Never push working branches, worktree branches or local experiments to it.
2. Create the release commit from the finished working tree, on top of the public `main`:
   `git commit-tree <tree-of-release> -p origin/main -m "Release vX.Y.Z"`, then fast-forward `main` to it.
3. Scan the public history, including author and committer emails:
   `LAB_DENYLIST=path/to/denylist node scripts/public-safety.mjs --history --ref main --since <initial-commit>`
   (`--since` skips the repository's initial commit created on GitHub.)
4. Tag the release on `main` as `vX.Y.Z` (an annotated tag), then push `main` and the tag. Pushing `main`
   runs the checks and deploys the site only if they pass.
4. Create a GitHub Release named `vX.Y.Z` and paste that version's CHANGELOG section as its notes.
5. Deploy the site from the tagged commit. Open it once to check that it loads and labels every result.
6. If the hosted address is new, set `links.project.site` in `content/links.ts`. The tests then
   require the README to link to it instead of the placeholder.

## Never

- Publish internal history, private recordings, `.env` files or local paths.
- Call a simulated or replayed result live in release notes.
- Rewrite a published release to hide a mistake. Ship a patch release that says what was fixed.
