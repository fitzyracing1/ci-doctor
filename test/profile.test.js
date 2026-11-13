'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const YAML = require('yaml');
const P = require('../src/profile');

const repo = (p) => path.join(__dirname, 'fixtures', 'repos', p);
const gen = (p) => {
  const inv = P.inventory(repo(p));
  const { profile, yaml } = P.buildProfile(inv, { date: '2026-11-13', repo: `demo/${p}` });
  return { inv, profile, yaml };
};

test('node repo: tailored profile', () => {
  const { profile, yaml } = gen('node');
  assert.deepEqual(profile.languages, ['node']);
  assert.deepEqual(profile['package-managers'], ['npm']);
  assert.deepEqual(profile.workflows, ['.github/workflows/ci.yml']);
  assert.deepEqual(profile.actions, { 'actions/checkout': 'v4', 'actions/setup-node': 'v4' });
  assert.deepEqual(profile.runners, ['ubuntu-latest']);
  assert.deepEqual(profile.versions, { node: ['22', '24'] });
  assert.deepEqual(profile.checks, ['CID003', 'CID004', 'CID005', 'CID006', 'CID008', 'CID009', 'CID011', 'CID012']);
  // no artifact, cache, container, python or local-action checks for this repo
  for (const id of ['CID001', 'CID002', 'CID007', 'CID010', 'CID013']) assert.ok(!profile.checks.includes(id));
  assert.match(yaml, /^# ci-doctor profile/);
  assert.deepEqual(YAML.parse(yaml), profile, 'YAML round-trips');
});

test('python repo: tailored profile', () => {
  const { profile } = gen('python');
  assert.deepEqual(profile.languages, ['python']);
  assert.deepEqual(profile['package-managers'], ['uv']);
  assert.deepEqual(profile.versions, { python: ['3.12'] });
  assert.deepEqual(profile.runners, ['ubuntu-22.04']);
  assert.ok(profile.checks.includes('CID007'), 'pip-installed linters are checked');
  assert.ok(!profile.checks.includes('CID011'), 'no pull_request trigger');
  assert.ok(!profile.checks.includes('CID008'), 'no branch filters');
});

test('multi-language repo: tailored profile', () => {
  const { profile } = gen('multi');
  assert.deepEqual(profile.languages, ['go', 'node', 'python']);
  assert.deepEqual(profile['package-managers'], ['go-modules', 'pnpm']);
  assert.deepEqual(profile.workflows, ['.github/workflows/ci.yml', '.github/workflows/release.yml']);
  assert.deepEqual(profile.runners, ['macos-15', 'ubuntu-24.04']);
  assert.deepEqual(profile.versions, { go: ['1.26'], node: ['24'], python: ['3.13'] });
  assert.deepEqual(profile.images, ['postgres:17']);
  assert.equal(profile.actions['actions/upload-artifact'], 'v7');
  for (const id of ['CID001', 'CID010', 'CID011', 'CID007']) assert.ok(profile.checks.includes(id), id);
  assert.ok(!profile.checks.includes('CID002'), 'no cache in use');
});

test('drift: new workflow and new action are flagged against a saved profile', () => {
  const inv = P.inventory(repo('drift'));
  const saved = P.loadProfile(path.join(repo('drift'), '.github/ci-doctor.yml'));
  const d = P.drift(saved.data, inv);
  assert.deepEqual(d.map((f) => f.rule), ['CID014', 'CID014']);
  assert.match(d[0].message, /nightly\.yml/);
  assert.match(d[1].message, /actions\/cache@v2/);
  assert.ok(d.every((f) => f.level === 'notice'));
});

test('no drift when the profile matches the repo', () => {
  const { inv, yaml } = gen('multi');
  assert.deepEqual(P.drift(YAML.parse(yaml), inv), []);
});

test('repo with no workflows gets no checks', () => {
  const inv = P.inventory(path.join(__dirname, 'fixtures', 'repos', 'node', 'nonexistent'));
  assert.deepEqual(P.relevantChecks(inv), []);
});
