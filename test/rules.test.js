'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { scan, RULES, branchMatches } = require('../src/scan');

const fx = (p) => path.join(__dirname, 'fixtures', p);
const brief = (r) => r.findings.map((f) => `${f.rule}:${f.level}:${f.file}:${f.line}`).sort();

const expected = {
  CID001: ['CID001:error:.github/workflows/ci.yml:9', 'CID001:error:.github/workflows/ci.yml:13'],
  CID002: ['CID002:error:.github/workflows/ci.yml:9'],
  CID003: ['CID003:warning:.github/workflows/ci.yml:9', 'CID003:warning:.github/workflows/ci.yml:10', 'CID003:warning:.github/workflows/ci.yml:11'],
  CID004: ['CID004:warning:.github/workflows/ci.yml:12', 'CID004:warning:.github/workflows/ci.yml:13', 'CID004:error:.github/workflows/ci.yml:14', 'CID004:error:.github/workflows/ci.yml:15'],
  CID005: ['CID005:error:.github/workflows/ci.yml:7', 'CID005:error:.github/workflows/ci.yml:13', 'CID005:error:.github/workflows/ci.yml:13', 'CID005:warning:.github/workflows/ci.yml:18'],
  CID006: ['CID006:warning:.github/workflows/ci.yml:9', 'CID006:warning:.github/workflows/ci.yml:9', 'CID006:warning:.github/workflows/ci.yml:20', 'CID006:error:.github/workflows/ci.yml:23'],
  CID007: ['CID007:notice:.github/workflows/ci.yml:9', 'CID007:notice:.github/workflows/ci.yml:9'],
  CID008: ['CID008:warning:.github/workflows/ci.yml:4', 'CID008:notice:.github/workflows/ci.yml:7'],
  CID009: ['CID009:notice:.github/workflows/ci.yml:3'],
  CID010: ['CID010:notice:.github/workflows/ci.yml:8', 'CID010:notice:.github/workflows/ci.yml:11'],
  CID011: ['CID011:notice:.github/workflows/ci.yml:11'],
  CID012: ['CID012:warning:.github/workflows/ci.yml:6', 'CID012:warning:.github/workflows/ci.yml:7'],
  CID013: ['CID013:warning:action.yml:4'],
};

for (const [id, want] of Object.entries(expected)) {
  test(`${id} ${RULES[id].name} fires exactly where expected`, () => {
    const r = scan(fx(`rules/${id}`), { defaultBranch: 'master' });
    assert.deepEqual(r.parseErrors, []);
    assert.deepEqual(brief(r), [...want].sort());
    for (const f of r.findings) {
      assert.ok(f.message.length > 20, 'has a message');
      assert.ok(f.fix.length > 10, 'has a fix');
    }
  });
}

test('every rule has a fixture', () => {
  for (const id of Object.keys(RULES)) if (id !== 'CID014') assert.ok(expected[id], `${id} needs a fixture`);
});

test('a modern workflow is clean', () => {
  const r = scan(fx('clean'), { defaultBranch: 'main' });
  assert.deepEqual(r.findings, []);
  assert.equal(r.workflows, 1);
});

test('fix suggestions name the current major', () => {
  const r = scan(fx('rules/CID001'), {});
  assert.match(r.findings[0].fix, /actions\/upload-artifact@v7/);
  assert.match(r.findings[1].fix, /actions\/download-artifact@v8/);
  const c = scan(fx('rules/CID003'), {});
  assert.match(c.findings[0].fix, /actions\/checkout@v7/);
});

test('SHA-pinned and up-to-date actions are not flagged', () => {
  const r = scan(fx('rules/CID003'), {});
  assert.ok(!r.findings.some((f) => /0123456789abcdef/.test(f.message)));
  assert.ok(!r.findings.some((f) => /github-script/.test(f.message)));
});

test('CID008 is skipped when the default branch is unknown', () => {
  assert.deepEqual(scan(fx('rules/CID008'), {}).findings, []);
});

test('in-file ignore comment and ignore option both suppress rules', () => {
  assert.deepEqual(scan(fx('ignored'), {}).findings, []);
  assert.deepEqual(scan(fx('rules/CID009'), { ignore: ['cid009'] }).findings, []);
});

test('only option limits checks', () => {
  const r = scan(fx('rules/CID004'), { only: ['CID004'] });
  assert.equal(r.findings.length, 4);
  assert.deepEqual(scan(fx('rules/CID004'), { only: ['CID001'] }).findings, []);
});

test('guarded secret use is not flagged', () => {
  const r = scan(fx('rules/CID011'), {});
  assert.equal(r.findings.length, 1);
});

test('branch glob matching', () => {
  assert.ok(branchMatches(['main', 'release/**'], 'release/1.2/x'));
  assert.ok(branchMatches(['*'], 'master'));
  assert.ok(!branchMatches(['*', '!master'], 'master'));
  assert.ok(!branchMatches(['main'], 'master'));
});
