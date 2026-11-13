# GitHub Marketplace listing (draft, not published)

Draft for Joshua's review. Nothing is published until he says so.

## Name (from `action.yml`)

**CI Doctor by fitzyracing1**

- `CI Doctor` is already taken on Marketplace (https://github.com/marketplace/actions/ci-doctor), and names must be unique.
- `CI Doctor by fitzyracing1` → https://github.com/marketplace/actions/ci-doctor-by-fitzyracing1 was free on 2026-11-13.
- Alternatives: `ci-doctor-action`, `Workflow Doctor by fitzyracing1`.
- The repo stays `fitzyracing1/ci-doctor`, so usage is still `uses: fitzyracing1/ci-doctor@v0`.

## Description (from `action.yml`, 125 characters max)

> Builds a custom checker for your repo and flags the deprecations that silently break GitHub Actions, with the exact fix.

## Branding (from `action.yml`)

- icon: `activity` (Feather heartbeat line, fits "doctor")
- color: `green`

## Categories

- Primary: **Continuous integration**
- Secondary: **Code quality**

## Release (when approved)

1. Merge PR `feat/initial` into `main`.
2. Create release `v0.1.0` from `main`, tick **Publish this Action to the GitHub Marketplace**, and pick the categories above. This needs the Marketplace Developer Agreement to be accepted, plus 2FA.
3. Create or move the floating tag `v0` to the same commit, so `@v0` works.

## Short listing blurb

Workflows rot: artifact and cache actions get shut down, runner images get retired, and Node versions get pulled from runners. ci-doctor reads your workflows, builds a profile of what *your* repo uses, and annotates the exact lines that will break, each with a copy-paste fix. It never fails your build unless you set `fail-on`.
