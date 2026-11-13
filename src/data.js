'use strict';
// Reference data for ci-doctor rules. Checked against upstream sources on 2026-11-13.
// Keep this file the single place to update when GitHub ships new majors or retires images.

// Runtime of each major of popular actions (from each action's action.yml at the vN tag).
const ACTION_RUNTIMES = {
  'actions/checkout': { latest: 7, runtimes: { 1: 'node12', 2: 'node12', 3: 'node16', 4: 'node20', 5: 'node24', 6: 'node24', 7: 'node24' } },
  'actions/setup-node': { latest: 7, runtimes: { 1: 'node12', 2: 'node12', 3: 'node16', 4: 'node20', 5: 'node24', 6: 'node24', 7: 'node24' } },
  'actions/setup-python': { latest: 7, runtimes: { 1: 'node12', 2: 'node12', 3: 'node16', 4: 'node16', 5: 'node20', 6: 'node24', 7: 'node24' } },
  'actions/setup-java': { latest: 6, runtimes: { 1: 'node12', 2: 'node12', 3: 'node16', 4: 'node20', 5: 'node24', 6: 'node24' } },
  'actions/setup-go': { latest: 7, runtimes: { 1: 'node12', 2: 'node12', 3: 'node16', 4: 'node16', 5: 'node20', 6: 'node24', 7: 'node24' } },
  'actions/setup-dotnet': { latest: 6, runtimes: { 1: 'node12', 2: 'node16', 3: 'node16', 4: 'node20', 5: 'node24', 6: 'node24' } },
  'actions/cache': { latest: 6, runtimes: { 1: 'node12', 2: 'node12', 3: 'node16', 4: 'node20', 5: 'node24', 6: 'node24' } },
  'actions/cache/restore': { latest: 6, runtimes: { 3: 'node16', 4: 'node20', 5: 'node24', 6: 'node24' } },
  'actions/cache/save': { latest: 6, runtimes: { 3: 'node16', 4: 'node20', 5: 'node24', 6: 'node24' } },
  'actions/upload-artifact': { latest: 7, runtimes: { 1: 'node12', 2: 'node12', 3: 'node16', 4: 'node20', 5: 'node20', 6: 'node24', 7: 'node24' } },
  'actions/download-artifact': { latest: 8, runtimes: { 1: 'node12', 2: 'node12', 3: 'node16', 4: 'node20', 5: 'node20', 6: 'node20', 7: 'node24', 8: 'node24' } },
  'actions/github-script': { latest: 9, runtimes: { 1: 'node12', 2: 'node12', 3: 'node12', 4: 'node12', 5: 'node12', 6: 'node16', 7: 'node20', 8: 'node24', 9: 'node24' } },
  'codecov/codecov-action': { latest: 7, runtimes: { 1: 'node12', 2: 'node12', 3: 'node16', 4: 'node20', 5: 'composite', 6: 'composite', 7: 'composite' } },
};

// Hosted runner labels. Sources: actions/runner-images README and announcements.
const RETIRED_RUNNERS = {
  'ubuntu-16.04': { retired: '2021-09-20', replace: 'ubuntu-24.04' },
  'ubuntu-18.04': { retired: '2023-04-03', replace: 'ubuntu-24.04' },
  'ubuntu-20.04': { retired: '2025-04-15', replace: 'ubuntu-24.04' },
  'macos-10.15': { retired: '2022-08-30', replace: 'macos-15' },
  'macos-11': { retired: '2024-06-28', replace: 'macos-15' },
  'macos-12': { retired: '2024-12-03', replace: 'macos-15' },
  'macos-13': { retired: '2025-12-04', replace: 'macos-15 (or macos-15-intel for x86_64)' },
  'macos-13-large': { retired: '2025-12-04', replace: 'macos-15-large' },
  'macos-13-xlarge': { retired: '2025-12-04', replace: 'macos-15-xlarge' },
  'macos-14': { retired: '2026-11-02', replace: 'macos-15 (or macos-15-intel for x86_64)' },
  'macos-14-large': { retired: '2026-11-02', replace: 'macos-15-large' },
  'macos-14-xlarge': { retired: '2026-11-02', replace: 'macos-15-xlarge' },
  'windows-2016': { retired: '2022-03-15', replace: 'windows-2025' },
  'windows-2019': { retired: '2025-06-30', replace: 'windows-2025' },
};
const DEPRECATED_RUNNERS = {
  'ubuntu-22.04': { unsupported: '2027-04-17', replace: 'ubuntu-24.04' },
  'ubuntu-22.04-arm': { unsupported: '2027-04-17', replace: 'ubuntu-24.04-arm' },
};

// End-of-life language versions (upstream EOL dates).
const NODE_EOL = { 10: '2021-04-30', 12: '2022-04-30', 14: '2023-04-30', 16: '2023-09-11', 17: '2022-06-01', 18: '2025-04-30', 19: '2023-06-01', 20: '2026-04-30', 21: '2024-06-01', 23: '2025-06-01' };
const NODE_SUGGEST = '24';
const PYTHON_EOL = { '2.7': '2020-01-01', '3.5': '2020-09-13', '3.6': '2021-12-23', '3.7': '2023-06-27', '3.8': '2024-10-07', '3.9': '2025-10-31' };
const PYTHON_SUGGEST = '3.13';

// Formatters / linters whose new releases routinely change output and turn CI dark.
const PY_LINT_TOOLS = ['black', 'flake8', 'ruff', 'pylint', 'mypy', 'isort', 'autopep8', 'yapf', 'pyright', 'pycodestyle', 'pydocstyle', 'bandit'];

module.exports = { ACTION_RUNTIMES, RETIRED_RUNNERS, DEPRECATED_RUNNERS, NODE_EOL, NODE_SUGGEST, PYTHON_EOL, PYTHON_SUGGEST, PY_LINT_TOOLS };
