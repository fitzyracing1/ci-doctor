'use strict';
// End-to-end: run the bundled action the way the runner does.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const DIST = path.join(__dirname, '..', 'dist', 'index.js');
const FX = path.join(__dirname, 'fixtures');

function run(workspace, inputs = {}) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cid-'));
  const env = { PATH: process.env.PATH, GITHUB_WORKSPACE: workspace, GITHUB_STEP_SUMMARY: path.join(tmp, 'summary.md'), GITHUB_OUTPUT: path.join(tmp, 'out'), RUNNER_TEMP: tmp };
  for (const [k, v] of Object.entries(inputs)) env[`INPUT_${k.toUpperCase()}`] = v;
  fs.writeFileSync(env.GITHUB_OUTPUT, '');
  const p = spawnSync(process.execPath, [DIST], { env, encoding: 'utf8' });
  const outputs = {};
  const raw = fs.readFileSync(env.GITHUB_OUTPUT, 'utf8');
  for (const m of raw.matchAll(/^([\w-]+)<<CIDOCTOR_EOF\n([\s\S]*?)\nCIDOCTOR_EOF$/gm)) outputs[m[1]] = m[2];
  for (const m of raw.matchAll(/^([\w-]+)=(.*)$/gm)) outputs[m[1]] = m[2];
  const summary = fs.existsSync(env.GITHUB_STEP_SUMMARY) ? fs.readFileSync(env.GITHUB_STEP_SUMMARY, 'utf8') : '';
  return { code: p.status, stdout: p.stdout, summary, outputs, tmp };
}
function copy(src) {
  const dst = fs.mkdtempSync(path.join(os.tmpdir(), 'cid-repo-'));
  fs.cpSync(src, dst, { recursive: true });
  return dst;
}

test('never fails by default, prints annotations, summary, footer and outputs', () => {
  const r = run(path.join(FX, 'rules', 'CID001'));
  assert.equal(r.code, 0);
  assert.match(r.stdout, /^::error file=\.github\/workflows\/ci\.yml,line=9,col=15,title=CID001 artifact-actions-v1-v3::/m);
  assert.match(r.summary, /## 🩺 ci-doctor/);
  assert.match(r.summary, /Fixed by \[ci-doctor\]\(https:\/\/github\.com\/fitzyracing1\/ci-doctor\) · Sponsor: https:\/\/github\.com\/sponsors\/fitzyracing1/);
  assert.equal(r.outputs.errors, '2');
  assert.equal(r.outputs.total, '2');
  assert.equal(JSON.parse(r.outputs.findings).length, 2);
});

test('fail-on error fails on errors; fail-on warn fails on warnings; notices never fail', () => {
  assert.equal(run(path.join(FX, 'rules', 'CID001'), { 'fail-on': 'error' }).code, 1);
  assert.equal(run(path.join(FX, 'rules', 'CID003'), { 'fail-on': 'error' }).code, 0);
  assert.equal(run(path.join(FX, 'rules', 'CID003'), { 'fail-on': 'warn' }).code, 1);
  assert.equal(run(path.join(FX, 'rules', 'CID009'), { 'fail-on': 'warn' }).code, 0);
});

test('path input scans a subdirectory and prefixes annotation paths', () => {
  const r = run(FX, { path: 'rules/CID002' });
  assert.match(r.stdout, /file=rules\/CID002\/\.github\/workflows\/ci\.yml/);
});

test('first run generates a profile in the summary and artifact file, without writing the repo', () => {
  const ws = copy(path.join(FX, 'repos', 'node'));
  const r = run(ws);
  assert.equal(r.code, 0);
  assert.equal(r.outputs['profile-generated'], 'true');
  assert.match(r.summary, /Custom checker for this repo/);
  assert.match(r.summary, /```yaml\n# ci-doctor profile/);
  assert.ok(fs.existsSync(path.join(r.tmp, 'ci-doctor-profile', 'ci-doctor.yml')), 'artifact file staged');
  assert.ok(!fs.existsSync(path.join(ws, '.github', 'ci-doctor.yml')), 'repo untouched');
});

test('write-profile: true writes the profile into the workspace; next run uses it', () => {
  const ws = copy(path.join(FX, 'repos', 'multi'));
  const first = run(ws, { 'write-profile': 'true' });
  assert.ok(fs.existsSync(path.join(ws, '.github', 'ci-doctor.yml')));
  assert.equal(first.outputs['profile-generated'], 'true');
  const second = run(ws);
  assert.equal(second.outputs['profile-generated'], 'false');
  assert.match(second.summary, /Using this repo's profile/);
  assert.match(second.summary, /No drift/);
});

test('drift: later run flags new workflow/action and still catches the new breakage', () => {
  const r = run(path.join(FX, 'repos', 'drift'));
  assert.equal(r.outputs['profile-generated'], 'false');
  const f = JSON.parse(r.outputs.findings);
  assert.equal(f.filter((x) => x.rule === 'CID014').length, 2);
  assert.ok(f.some((x) => x.rule === 'CID002'), 'cache@v2 in the new workflow is still reported');
  assert.match(r.summary, /2 drift item/);
});

test('profile checks limit the scan', () => {
  const ws = copy(path.join(FX, 'rules', 'CID009'));
  fs.writeFileSync(path.join(ws, '.github', 'ci-doctor.yml'), 'version: 1\nchecks: [CID005]\nworkflows: [.github/workflows/ci.yml]\nactions: {}\nrunners: [ubuntu-latest]\nlanguages: []\n');
  const r = run(ws);
  assert.equal(r.outputs.total, '0');
});
