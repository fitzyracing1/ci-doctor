'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { scan } = require('./scan');
const P = require('./profile');
const R = require('./report');

function input(name, def = '') {
  const v = process.env[`INPUT_${name.replace(/ /g, '_').toUpperCase()}`];
  return v == null || v === '' ? def : v.trim();
}
function setOutput(name, value) {
  const f = process.env.GITHUB_OUTPUT;
  const v = String(value);
  if (f) fs.appendFileSync(f, v.includes('\n') ? `${name}<<CIDOCTOR_EOF\n${v}\nCIDOCTOR_EOF\n` : `${name}=${v}\n`);
}
function defaultBranch(root) {
  const explicit = input('default-branch');
  if (explicit) return explicit;
  try {
    const ev = JSON.parse(fs.readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    if (ev.repository && ev.repository.default_branch) return ev.repository.default_branch;
  } catch { /* not in Actions or no event */ }
  try { return execSync('git symbolic-ref --short refs/remotes/origin/HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim().replace(/^origin\//, ''); } catch { return ''; }
}
function runnerEnv() {
  const e = process.env;
  const out = [];
  if (e.RUNNER_OS) out.push(`OS: ${e.RUNNER_OS} ${e.RUNNER_ARCH || ''}`.trim());
  if (e.ImageOS) out.push(`Image: ${e.ImageOS}${e.ImageVersion ? ` ${e.ImageVersion}` : ''}`);
  if (e.RUNNER_ENVIRONMENT) out.push(`Runner: ${e.RUNNER_ENVIRONMENT}`);
  out.push(`ci-doctor Node runtime: ${process.version}`);
  return out;
}

function main() {
  const ws = process.env.GITHUB_WORKSPACE || process.cwd();
  const root = path.resolve(ws, input('path', '.'));
  const failOn = input('fail-on', 'none').toLowerCase();
  if (!['none', 'warn', 'warning', 'error'].includes(failOn)) {
    console.log(`::warning title=ci-doctor::Unknown fail-on value "${failOn}", using "none".`);
  }
  const ignore = input('ignore').split(/[\s,]+/).filter(Boolean);
  const excludeDirs = input('exclude').split(/[\s,]+/).filter(Boolean);
  const scanActions = input('scan-actions', 'true') !== 'false';
  const inv = P.inventory(root, { scanActions, excludeDirs });
  const profileRel = input('profile', P.PROFILE_PATH);
  const profileFile = path.resolve(root, profileRel);
  const loaded = input('use-profile', 'true') !== 'false' ? P.loadProfile(profileFile) : null;
  let only = P.relevantChecks(inv);
  let driftFindings = [];
  let profileInfo;
  if (loaded && !loaded.error && Array.isArray(loaded.data.checks)) {
    driftFindings = P.drift(loaded.data, inv, profileRel).filter(() => !ignore.map((x) => x.toUpperCase()).includes('CID014'));
    // profile picks the checks; if the repo drifted, also run checks newly relevant so nothing slips through
    only = [...new Set([...loaded.data.checks.map(String), ...(driftFindings.length ? only : [])])];
    profileInfo = { mode: 'used', file: profileRel, checks: only, drift: driftFindings.length };
  } else {
    const repo = process.env.GITHUB_REPOSITORY || '';
    const { yaml } = P.buildProfile(inv, { repo });
    const tmp = path.join(process.env.RUNNER_TEMP || require('os').tmpdir(), 'ci-doctor-profile');
    fs.mkdirSync(tmp, { recursive: true });
    const out = path.join(tmp, 'ci-doctor.yml');
    fs.writeFileSync(out, yaml);
    let written = '';
    if (input('write-profile', 'false') === 'true') {
      fs.mkdirSync(path.dirname(profileFile), { recursive: true });
      fs.writeFileSync(profileFile, yaml);
      written = profileFile;
    }
    profileInfo = { mode: 'generated', file: profileRel, yaml, error: loaded && loaded.error, written };
    setOutput('profile-generated', 'true');
    setOutput('profile-path', out);
    setOutput('profile', yaml);
  }
  const result = scan(root, { defaultBranch: defaultBranch(root), ignore, scanActions, excludeDirs, only });
  result.findings.push(...driftFindings);
  // file paths in annotations must be relative to the workspace
  const prefix = path.relative(ws, root).split(path.sep).join('/');
  const shown = result.findings.map((f) => ({ ...f, file: prefix && !prefix.startsWith('..') ? `${prefix}/${f.file}` : f.file }));
  const annotations = input('annotations', 'true') !== 'false';
  for (const f of shown) {
    if (annotations) console.log(R.annotation(f));
    else console.log(`[${f.level}] ${f.rule} ${f.file}:${f.line} ${f.message}`);
  }
  for (const p of result.parseErrors) console.log(`::warning file=${p.file},title=ci-doctor::Could not parse this file: ${p.message}`);
  const repoUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}` : '';
  const md = R.summary({ ...result, findings: shown }, { repoUrl, sha: process.env.GITHUB_SHA, env: runnerEnv(), profile: profileInfo, inventory: inv });
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  else process.stdout.write(`\n${md}`);
  const c = R.count(result.findings);
  setOutput('errors', c.error);
  setOutput('warnings', c.warning);
  setOutput('notices', c.notice);
  setOutput('total', result.findings.length);
  setOutput('findings', JSON.stringify(shown));
  if (profileInfo.mode === 'used') setOutput('profile-generated', 'false');
  console.log(`ci-doctor: ${c.error} error(s), ${c.warning} warning(s), ${c.notice} notice(s). ${R.FOOTER}`);
  if (R.shouldFail(result.findings, failOn)) {
    console.log(`::error title=ci-doctor::Failing because fail-on is "${failOn}" and matching findings exist.`);
    process.exitCode = 1;
  }
}

try { main(); } catch (err) {
  // never break a build because of ci-doctor itself
  console.log(`::warning title=ci-doctor::ci-doctor hit an internal error and skipped the scan: ${String(err && err.stack || err).replace(/\n/g, '%0A')}`);
}
