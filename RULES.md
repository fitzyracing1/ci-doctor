# ci-doctor rules

Every rule comes from an official GitHub deprecation or retirement notice, or from GitHub's own
documentation of a common CI failure. Each rule lists its sources. Reference data (current action
majors, runner labels, EOL dates) lives in [`src/data.js`](src/data.js) and was last checked on
**2026-11-13**.

Levels: 🔴 **error** = the job breaks today · 🟡 **warning** = deprecated, breaking or about to ·
🔵 **notice** = common cause of red builds, worth fixing. Only `fail-on` decides whether ci-doctor
fails your build. The default is `none`.

Skip a rule everywhere with `ignore: CID009`, or in one file with a comment: `# ci-doctor: ignore CID009`.

| ID | Name | Level |
|---|---|---|
| [CID001](#cid001) | artifact-actions-v1-v3 | 🔴 error |
| [CID002](#cid002) | cache-action-v1-v2 | 🔴 error |
| [CID003](#cid003) | action-on-old-node-runtime | 🟡 warning |
| [CID004](#cid004) | deprecated-workflow-command | 🟡 warning / 🔴 error |
| [CID005](#cid005) | retired-runner-image | 🔴 error / 🟡 warning |
| [CID006](#cid006) | eol-language-version | 🟡 warning / 🔴 error |
| [CID007](#cid007) | unpinned-lint-tool | 🔵 notice |
| [CID008](#cid008) | branch-filter-skips-default-branch | 🟡 warning / 🔵 notice |
| [CID009](#cid009) | missing-token-permissions | 🔵 notice |
| [CID010](#cid010) | unpinned-container-image | 🔵 notice |
| [CID011](#cid011) | secrets-on-fork-pull-requests | 🔵 notice |
| [CID012](#cid012) | removed-runner-opt-out | 🟡 warning |
| [CID013](#cid013) | local-action-old-node-runtime | 🟡 warning |
| [CID014](#cid014) | profile-drift | 🔵 notice |

---

## CID001

**artifact-actions-v1-v3 (error).** Flags `actions/upload-artifact` and `actions/download-artifact` at v1, v2 or v3.
These were shut down on github.com on 2025-01-30, and steps that use them now fail.

**Fix:** use `actions/upload-artifact@v7` / `actions/download-artifact@v8`. From v4 on, artifacts are immutable, so give each matrix leg a unique `name` or use `merge-multiple: true` when downloading.

Sources:
- [Deprecation notice: v3 of the artifact actions](https://github.blog/changelog/2024-04-16-deprecation-notice-v3-of-the-artifact-actions/)
- [Ubuntu 20 brownouts and other breaking changes (artifact v3 shutdown)](https://github.blog/changelog/2025-01-15-github-actions-ubuntu-20-runner-image-brownout-dates-and-other-breaking-changes/)
- [Docs: workflow artifacts](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts)

## CID002

**cache-action-v1-v2 (error).** Flags `actions/cache` (and `/restore`, `/save`) at v1 or v2. The old cache service was turned off on 2025-03-01.

**Fix:** use `actions/cache@v6`. The inputs are compatible.

Sources:
- [Notice of upcoming releases and breaking changes for GitHub Actions (Dec 2024)](https://github.blog/changelog/2024-12-05-notice-of-upcoming-releases-and-breaking-changes-for-github-actions/)
- [actions/cache v1-v2 closing down (Jan 2025 changelog)](https://github.blog/changelog/2025-01-15-github-actions-ubuntu-20-runner-image-brownout-dates-and-other-breaking-changes/)

## CID003

**action-on-old-node-runtime (warning).** Flags popular actions (checkout, setup-node, setup-python, setup-java, setup-go, setup-dotnet, cache, upload/download-artifact, github-script, codecov) pinned to a major whose `action.yml` declares `node12`, `node16` or `node20`. GitHub removed Node 20 from hosted runners on 2026-09-23, so these versions are force-run on Node 24, which they were never built or tested for. SHA and branch pins are skipped because their version can't be read from the ref.

**Fix:** move to the newest major. The table of majors and runtimes comes from each action's `action.yml` at its `vN` tag.

Sources:
- [Deprecation of Node 20 on GitHub Actions runners](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/)
- [Transitioning from Node 16 to Node 20](https://github.blog/changelog/2023-09-22-github-actions-transitioning-from-node-16-to-node-20/)
- [All actions will begin running on Node16 instead of Node12](https://github.blog/changelog/2022-09-22-github-actions-all-actions-will-begin-running-on-node16-instead-of-node12/)

## CID004

**deprecated-workflow-command.** Flags these commands in `run:` scripts:
- `::set-output` and `::save-state` (warning). Both are deprecated and scheduled to be disabled.
- `::set-env` and `::add-path` (error). Both have been disabled since 2020, so the step errors.

**Fix:** append to `$GITHUB_OUTPUT`, `$GITHUB_STATE`, `$GITHUB_ENV` or `$GITHUB_PATH` instead.

Sources:
- [Deprecating save-state and set-output commands](https://github.blog/changelog/2022-10-11-github-actions-deprecating-save-state-and-set-output-commands/)
- [Deprecating set-env and add-path commands](https://github.blog/changelog/2020-10-01-github-actions-deprecating-set-env-and-add-path-commands/)
- [Docs: workflow commands](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands)

## CID005

**retired-runner-image.** Checks `runs-on` labels, including `matrix.os` / `include` values.
- **Error** for retired images: `ubuntu-16.04/18.04/20.04`, `macos-10.15/11/12/13/14` (and the `-large`/`-xlarge` variants), and `windows-2016/2019`. Jobs on these labels never start.
- **Warning** for `ubuntu-22.04` / `ubuntu-22.04-arm`. These are in deprecation and fully unsupported from 2027-04-17.

**Fix:** `ubuntu-24.04`, `macos-15` (or `macos-15-intel` if you need x86_64), `windows-2025`.

Sources:
- [actions/runner-images: available images](https://github.com/actions/runner-images)
- [Ubuntu 20 runner image closing down](https://github.blog/changelog/2025-01-15-github-actions-ubuntu-20-runner-image-brownout-dates-and-other-breaking-changes/)
- [Windows Server 2019 closing down](https://github.blog/changelog/2025-04-15-upcoming-breaking-changes-and-releases-for-github-actions/)
- [macOS 13 runner image is closing down](https://github.blog/changelog/2025-09-19-github-actions-macos-13-runner-image-is-closing-down/)
- [macOS 14 retirement (runner-images #13518)](https://github.com/actions/runner-images/issues/13518)
- [Ubuntu 22 deprecation (runner-images #14254)](https://github.com/actions/runner-images/issues/14254)
- [Ubuntu 18.04 deprecation (runner-images #6002)](https://github.com/actions/runner-images/issues/6002), [macOS 12 deprecation (runner-images #10721)](https://github.com/actions/runner-images/issues/10721)

## CID006

**eol-language-version.** Checks the versions passed to `actions/setup-node` (`node-version`) and `actions/setup-python` (`python-version`), including values that come from the matrix.
- **Warning** for end-of-life versions: Node ≤ 20 and odd-numbered releases, and Python ≤ 3.9. Python 2.7 and 3.5–3.7 aren't available for `ubuntu-24.04` in setup-python, so jobs using them fail outright.
- **Error** for an unquoted `3.10` (or `3.20`, and so on). YAML reads it as the number `3.1`, so setup-python goes looking for Python 3.1.

**Fix:** use Node `'24'` (or `'22'`) and Python `'3.13'`, and always quote version numbers.

Sources:
- [Node.js release schedule / EOL dates](https://nodejs.org/en/about/previous-releases)
- [Python versions and EOL dates](https://devguide.python.org/versions/)
- [Docs: workflow syntax (YAML values)](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)

## CID007

**unpinned-lint-tool (notice).** Flags `pip install` of formatters and linters (black, flake8, ruff, pylint, mypy, isort, …) with no version. A new release can change the rules or the formatting and turn CI red even though your code didn't change.

**Fix:** pin the version (`black==X.Y.Z`) or use a requirements or lock file, and let Dependabot bump it.

Sources:
- [pip: repeatable installs](https://pip.pypa.io/en/stable/topics/repeatable-installs/)
- [Docs: secure use reference (pin dependencies)](https://docs.github.com/en/actions/reference/security/secure-use)

## CID008

**branch-filter-skips-default-branch.**
- **Warning** when `on.push.branches` / `on.pull_request.branches` doesn't match the repository's default branch (for example `[main]` on a `master` repo). CI silently stops running there.
- **Notice** when `branches-ignore` excludes the default branch.

The default branch is read from the event payload, or set it with `default-branch:`.

Sources:
- [Docs: workflow syntax, `on.<push|pull_request>.<branches|branches-ignore>`](https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax)

## CID009

**missing-token-permissions (notice).** Flags workflows with no top-level `permissions:` where not every job sets its own. In that case `GITHUB_TOKEN` gets the repository default, which is read/write on many older repos.

**Fix:** add `permissions: { contents: read }` at the top and grant more per job only where needed.

Sources:
- [Docs: GITHUB_TOKEN permissions](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token)
- [Default GITHUB_TOKEN permissions changed to read-only](https://github.blog/changelog/2023-02-02-github-actions-updating-the-default-github_token-permissions-to-read-only/)
- [Docs: secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)

## CID010

**unpinned-container-image (notice).** Flags `container:` and `services:` images with no tag or with `:latest`. Digests and `${{ }}` expressions are skipped.

**Fix:** pin a tag or a digest.

Sources:
- [Docs: Docker service containers](https://docs.github.com/en/actions/tutorials/use-containerized-services/use-docker-service-containers)
- [Docs: secure use reference](https://docs.github.com/en/actions/reference/security/secure-use)

## CID011

**secrets-on-fork-pull-requests (notice).** Flags jobs triggered by `pull_request` that read a secret (other than `GITHUB_TOKEN`) with no fork guard. Secrets aren't passed to workflows triggered from forks, so contributor PRs fail, or the code crashes on an empty value.

**Fix:** guard the step (`if: github.event.pull_request.head.repo.full_name == github.repository`) or handle an empty value.

Sources:
- [Docs: using secrets in GitHub Actions](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)

## CID012

**removed-runner-opt-out (warning).** Flags these environment settings:
- `ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION: true`. It has done nothing since Node 20 was removed on 2026-09-23.
- `ACTIONS_ALLOW_UNSECURE_COMMANDS: true`. It re-enables the disabled `set-env`/`add-path` commands.

Sources:
- [Deprecation of Node 20 on GitHub Actions runners](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/)
- [Deprecating set-env and add-path commands](https://github.blog/changelog/2020-10-01-github-actions-deprecating-set-env-and-add-path-commands/)

## CID013

**local-action-old-node-runtime (warning).** Flags any `action.yml` in the repo that declares `runs.using: node12|node16|node20`. Composite actions are also scanned with all the step rules above.

**Fix:** set `using: node24` and release a new major.

Sources:
- [Docs: metadata syntax, `runs` for JavaScript actions](https://docs.github.com/en/actions/reference/workflows-and-actions/metadata-syntax)
- [Deprecation of Node 20 on GitHub Actions runners](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/)

## CID014

**profile-drift (notice).** Only fires once a `.github/ci-doctor.yml` profile exists. It flags workflows, actions, runners or languages that aren't in the profile, and workflows the profile lists that no longer exist. When the repo has drifted, ci-doctor also runs every check that is newly relevant, so a breaking change in a new workflow still gets caught.

**Fix:** update the profile, or delete it so the next run generates a fresh one.
