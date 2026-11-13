# 🩺 ci-doctor

**Builds a custom checker for your repo and catches the GitHub deprecations that quietly break CI, then tells you the exact line to change.**

```yaml
- uses: fitzyracing1/ci-doctor@v0
```

That's the whole setup. It never fails your build unless you ask it to.

[![CI](https://github.com/fitzyracing1/ci-doctor/actions/workflows/ci.yml/badge.svg)](https://github.com/fitzyracing1/ci-doctor/actions/workflows/ci.yml)
[![Self-test](https://github.com/fitzyracing1/ci-doctor/actions/workflows/self-test.yml/badge.svg)](https://github.com/fitzyracing1/ci-doctor/actions/workflows/self-test.yml)
[![Sponsor](https://img.shields.io/badge/sponsor-fitzyracing1-ea4aaa?logo=githubsponsors)](https://github.com/sponsors/fitzyracing1)

---

## Why

Workflows rot. Nobody changes the code, and one morning CI is red because:

- `actions/upload-artifact@v3` or `actions/cache@v2` was **shut down**
- `ubuntu-20.04`, `windows-2019`, `macos-13` or `macos-14` was **retired**, so jobs never start
- an action still runs on **Node 12/16/20**, which GitHub removed from runners
- `::set-output` / `::set-env` are deprecated or disabled
- `python-version: 3.10` (unquoted) quietly means **Python 3.1**
- `on.push.branches: [main]` on a `master` repo means CI hasn't run in months

ci-doctor reads your `.github/workflows` and `action.yml` files and reports each of these where it happens, with the fix.

## What you get

- **Annotations** on the exact file and line, right in the PR "Files changed" view
- **A job summary** with a table of problems and copy-paste fixes
- **Outputs** (`errors`, `warnings`, `notices`, `findings` JSON) to drive later steps
- **A custom checker for your repo** (see below)

## A custom checker for your repo

The first time it runs, ci-doctor looks at your repo's workflows, languages, package managers, runners, actions and container images. From that it builds a **profile** with only the checks that matter for your repo, plus the versions it saw:

```yaml
# .github/ci-doctor.yml (generated)
version: 1
languages: [go, node, python]
package-managers: [go-modules, pnpm]
checks: [CID001, CID003, CID004, CID005, CID006, CID007, CID009, CID010, CID011, CID012]
workflows: [.github/workflows/ci.yml, .github/workflows/release.yml]
actions:
  actions/checkout: v7
  actions/setup-node: v7
runners: [macos-15, ubuntu-24.04]
versions:
  node: ['24']
  python: ['3.13']
```

ci-doctor **never commits anything**. The profile shows up in the job summary and as the `ci-doctor-profile` artifact. Set `write-profile: true` to also write it into the workspace, so your own step or a PR action can commit it. Once `.github/ci-doctor.yml` exists, later runs check only what's in it and flag **drift**: new workflows, actions, runners or languages the profile doesn't know about. Delete the file to regenerate it.

## Usage

```yaml
name: CI
on: [push, pull_request]
permissions:
  contents: read
jobs:
  doctor:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: fitzyracing1/ci-doctor@v0
```

### Inputs

| Input | Default | What it does |
|---|---|---|
| `fail-on` | `none` | `none` never fails; `warn` fails on warnings or errors; `error` fails on errors only. Notices never fail. |
| `path` | `.` | Directory to scan. |
| `ignore` | | Comma-separated rule IDs to skip, e.g. `CID009,CID011`. You can also put `# ci-doctor: ignore CID009` in one file. |
| `exclude` | | Directories to skip when looking for `action.yml` files. |
| `profile` | `.github/ci-doctor.yml` | Where the per-repo profile lives. |
| `use-profile` | `true` | Set `false` to ignore an existing profile. |
| `write-profile` | `false` | On first run, also write the generated profile into the workspace. |
| `upload-profile` | `true` | Upload the generated profile as an artifact. |
| `default-branch` | auto | Used by the branch-filter check. |
| `annotations` | `true` | Emit file annotations. |

### Outputs

`errors`, `warnings`, `notices`, `total`, `findings` (JSON), `profile-generated`, `profile`.

## Rules

| ID | Catches | Level |
|---|---|---|
| CID001 | `upload-artifact` / `download-artifact` v1–v3 (shut down) | 🔴 |
| CID002 | `actions/cache` v1–v2 (shut down) | 🔴 |
| CID003 | Actions pinned to Node 12/16/20 majors | 🟡 |
| CID004 | `set-output`, `save-state`, `set-env`, `add-path` | 🟡/🔴 |
| CID005 | Retired or deprecated runner images | 🔴/🟡 |
| CID006 | EOL Node/Python, unquoted `3.10` | 🟡/🔴 |
| CID007 | Unpinned `pip install black/ruff/flake8…` | 🔵 |
| CID008 | Branch filters that skip the default branch | 🟡/🔵 |
| CID009 | No `permissions:` block | 🔵 |
| CID010 | `:latest` / untagged container images | 🔵 |
| CID011 | Secrets used on fork pull requests | 🔵 |
| CID012 | Removed runner opt-outs (`ACTIONS_ALLOW_…`) | 🟡 |
| CID013 | Local `action.yml` on Node 12/16/20 | 🟡 |
| CID014 | Repo drifted from its profile | 🔵 |

Every rule cites the GitHub changelog or docs it comes from. See **[RULES.md](RULES.md)**.

## Development

```bash
npm ci
npm test        # unit tests for every rule + profile + end-to-end runs of dist/
npm run build   # bundles src/ into dist/index.js (commit it)
```

## Roadmap (planned, not live yet)

**Sales pitches in a bot.** ci-doctor is the pitch: it diagnoses a repo's CI, writes up the quote, and the fix and the story follow from there. Today only the diagnosis exists. The rest is planned:

1. **Diagnose and quote.** ci-doctor finds what's breaking a repo's CI and gives the owner a clear list of the parts that need fixing.
2. **Fixed for you (paid).** Owners who'd rather not do it themselves can have Joshua's team fix it for a set price.
3. **A bot built for your repo.** When the fix lands, the owner is told it was done by a custom bot built for their repo, the same per-repo profile idea ci-doctor starts with.
4. **Told in public.** Each fix becomes a short CI-fix write-up on X, part of the *go to Mars with the Sunrise protocol* story.

## Sponsor

If ci-doctor saved you a red build, consider [sponsoring @fitzyracing1](https://github.com/sponsors/fitzyracing1). 💚

## License

[MIT](LICENSE) © 2026 Joshua Almeida
