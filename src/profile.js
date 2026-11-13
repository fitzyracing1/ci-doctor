'use strict';
// Per-repo profile: inventory what a repo actually uses, pick only the relevant checks,
// and detect drift on later runs.
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const { get, pairs, scalars, parseRef, listFiles, RULES } = require('./scan');

const PROFILE_PATH = '.github/ci-doctor.yml';

const LANG_MARKERS = [
  ['node', ['package.json']],
  ['python', ['pyproject.toml', 'requirements.txt', 'setup.py', 'setup.cfg', 'Pipfile', 'tox.ini']],
  ['go', ['go.mod']],
  ['rust', ['Cargo.toml']],
  ['java', ['pom.xml', 'build.gradle', 'build.gradle.kts']],
  ['ruby', ['Gemfile']],
  ['php', ['composer.json']],
  ['dotnet', [/\.(csproj|fsproj|sln)$/]],
];
const PM_MARKERS = [
  ['npm', 'package-lock.json'], ['yarn', 'yarn.lock'], ['pnpm', 'pnpm-lock.yaml'], ['bun', 'bun.lockb'], ['bun', 'bun.lock'],
  ['pip', 'requirements.txt'], ['poetry', 'poetry.lock'], ['uv', 'uv.lock'], ['pipenv', 'Pipfile.lock'], ['pdm', 'pdm.lock'],
  ['go-modules', 'go.sum'], ['cargo', 'Cargo.lock'], ['maven', 'pom.xml'], ['gradle', 'build.gradle'], ['gradle', 'build.gradle.kts'],
  ['bundler', 'Gemfile.lock'], ['composer', 'composer.lock'],
];
const SETUP_LANG = { 'actions/setup-node': ['node', 'node-version'], 'actions/setup-python': ['python', 'python-version'], 'actions/setup-go': ['go', 'go-version'], 'actions/setup-java': ['java', 'java-version'], 'actions/setup-dotnet': ['dotnet', 'dotnet-version'], 'ruby/setup-ruby': ['ruby', 'ruby-version'] };

function addTo(map, k, v) { if (!map.has(k)) map.set(k, new Set()); if (v != null && v !== '') map.get(k).add(String(v)); }

function topFiles(root) {
  // root and one level of subdirectories (monorepos), skipping heavy dirs
  const out = [];
  const skip = new Set(['node_modules', '.git', 'dist', 'build', 'vendor', 'target', '.venv', 'venv', 'fixtures', 'test', 'tests', '__fixtures__']);
  const read = (d) => { try { return fs.readdirSync(d, { withFileTypes: true }); } catch { return []; } };
  for (const e of read(root)) {
    if (e.isFile()) out.push(e.name);
    else if (e.isDirectory() && !e.name.startsWith('.') && !skip.has(e.name)) for (const s of read(path.join(root, e.name))) if (s.isFile()) out.push(s.name);
  }
  return out;
}

function inventory(root, opts = {}) {
  const files = topFiles(root);
  const has = (m) => files.some((f) => (m instanceof RegExp ? m.test(f) : f === m));
  const languages = new Set(LANG_MARKERS.filter(([, ms]) => ms.some(has)).map(([l]) => l));
  const packageManagers = new Set(PM_MARKERS.filter(([, f]) => has(f)).map(([p]) => p));
  const { wf, actions: localActions } = listFiles(root, { scanActions: opts.scanActions !== false, excludeDirs: opts.excludeDirs || [] });
  const actions = new Map(); // name -> refs
  const runners = new Set();
  const versions = new Map(); // lang -> versions
  const images = new Set();
  const events = new Set();
  const features = new Set(); // facts used to pick checks
  const rel = (f) => path.relative(root, f).split(path.sep).join('/');

  const noteUses = (n) => {
    if (!YAML.isScalar(n) || typeof n.value !== 'string') return;
    const u = n.value.trim();
    if (u.startsWith('./')) { features.add('local-action-ref'); return; }
    if (u.startsWith('docker://')) { images.add(u.slice(9)); return; }
    const r = parseRef(u);
    if (r) addTo(actions, r.name, r.ref);
  };
  const noteRun = (n) => {
    if (!YAML.isScalar(n)) return;
    features.add('run');
    if (/\bpip3?\s+install\b/.test(String(n.value))) features.add('pip-install');
  };

  for (const f of wf) {
    const doc = YAML.parseDocument(fs.readFileSync(f, 'utf8'));
    const root2 = doc.contents;
    if (!YAML.isMap(root2)) continue;
    const on = get(root2, 'on');
    if (YAML.isScalar(on)) events.add(String(on.value));
    for (const s of YAML.isSeq(on) ? on.items : []) if (YAML.isScalar(s)) events.add(String(s.value));
    for (const [k, v] of pairs(on)) { events.add(k); if (get(v, 'branches') || get(v, 'branches-ignore')) features.add('branch-filters'); }
    for (const [, job] of pairs(get(root2, 'jobs'))) {
      noteUses(get(job, 'uses'));
      const matrix = get(get(job, 'strategy'), 'matrix');
      const mv = (key) => {
        const out = scalars(get(matrix, key)).map((n) => n.source ?? String(n.value));
        for (const inc of YAML.isSeq(get(matrix, 'include')) ? get(matrix, 'include').items : []) { const v = get(inc, key); if (YAML.isScalar(v)) out.push(v.source ?? String(v.value)); }
        return out;
      };
      const expand = (n) => {
        const s = YAML.isScalar(n) ? (n.source ?? String(n.value)) : '';
        const m = /^\$\{\{\s*matrix\.([\w-]+)\s*\}\}$/.exec(s.trim());
        return m ? mv(m[1]) : [s];
      };
      const ro = get(job, 'runs-on');
      for (const n of scalars(ro)) for (const v of expand(n)) if (v) runners.add(v);
      if (YAML.isMap(ro)) for (const n of scalars(get(ro, 'labels'))) runners.add(String(n.value));
      const cont = get(job, 'container');
      if (YAML.isScalar(cont)) images.add(String(cont.value)); else if (YAML.isMap(cont)) { const i = get(cont, 'image'); if (YAML.isScalar(i)) images.add(String(i.value)); }
      for (const [, svc] of pairs(get(job, 'services'))) { const i = YAML.isScalar(svc) ? svc : get(svc, 'image'); if (YAML.isScalar(i)) images.add(String(i.value)); }
      for (const step of YAML.isSeq(get(job, 'steps')) ? get(job, 'steps').items : []) {
        const uses = get(step, 'uses');
        noteUses(uses);
        noteRun(get(step, 'run'));
        const r = YAML.isScalar(uses) ? parseRef(String(uses.value)) : null;
        if (r && SETUP_LANG[r.name]) {
          const [lang, key] = SETUP_LANG[r.name];
          languages.add(lang);
          for (const n of scalars(get(get(step, 'with'), key))) for (const v of expand(n)) addTo(versions, lang, v);
          if (!versions.has(lang)) addTo(versions, lang, null);
        }
      }
    }
  }
  const localMeta = [];
  for (const f of localActions) {
    const doc = YAML.parseDocument(fs.readFileSync(f, 'utf8'));
    const runs = get(doc.contents, 'runs');
    const using = get(runs, 'using');
    localMeta.push({ file: rel(f), using: YAML.isScalar(using) ? String(using.value) : 'unknown' });
    for (const step of YAML.isSeq(get(runs, 'steps')) ? get(runs, 'steps').items : []) { noteUses(get(step, 'uses')); noteRun(get(step, 'run')); }
  }
  return {
    languages: [...languages].sort(),
    packageManagers: [...packageManagers].sort(),
    workflows: wf.map(rel),
    localActions: localMeta,
    actions: [...actions.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, refs]) => ({ name, refs: [...refs].sort() })),
    runners: [...runners].sort(),
    versions: Object.fromEntries([...versions.entries()].sort().map(([k, v]) => [k, [...v].sort()])),
    images: [...images].sort(),
    events: [...events].sort(),
    features: [...features].sort(),
  };
}

// Pick only the checks that can ever fire for this inventory.
function relevantChecks(inv) {
  const names = new Set(inv.actions.map((a) => a.name));
  const c = new Set(['CID009', 'CID012']); // cheap, apply to every workflow repo
  if (!inv.workflows.length && !inv.localActions.length) return [];
  if (names.has('actions/upload-artifact') || names.has('actions/download-artifact')) c.add('CID001');
  if ([...names].some((n) => n.startsWith('actions/cache'))) c.add('CID002');
  if (inv.actions.length) c.add('CID003');
  if (inv.features.includes('run')) c.add('CID004');
  if (inv.runners.length) c.add('CID005');
  if (inv.versions.node || inv.versions.python) c.add('CID006');
  if (inv.languages.includes('python') && inv.features.includes('pip-install')) c.add('CID007');
  if (inv.features.includes('branch-filters')) c.add('CID008');
  if (inv.images.length) c.add('CID010');
  if (inv.events.includes('pull_request')) c.add('CID011');
  if (inv.localActions.length) c.add('CID013');
  return [...c].sort();
}

function buildProfile(inv, meta = {}) {
  const checks = relevantChecks(inv);
  const p = {
    version: 1,
    generated: meta.date || new Date().toISOString().slice(0, 10),
    ...(meta.repo ? { repo: meta.repo } : {}),
    languages: inv.languages,
    'package-managers': inv.packageManagers,
    checks,
    workflows: inv.workflows,
    actions: Object.fromEntries(inv.actions.map((a) => [a.name, a.refs.length === 1 ? a.refs[0] : a.refs])),
    runners: inv.runners,
    versions: inv.versions,
    ...(inv.images.length ? { images: inv.images } : {}),
    ...(inv.localActions.length ? { 'local-actions': inv.localActions.map((a) => a.file) } : {}),
  };
  const header = [
    '# ci-doctor profile: the checks that matter for this repo.',
    '# Generated by https://github.com/fitzyracing1/ci-doctor. Commit it to .github/ci-doctor.yml.',
    '# Later runs check only `checks` and flag drift when new workflows, actions, runners or',
    '# languages appear. Edit `checks` freely; delete this file to regenerate it.',
    '# Checks: ' + checks.map((id) => `${id} ${RULES[id].name}`).join(', '),
  ].join('\n');
  return { profile: p, yaml: `${header}\n${YAML.stringify(p, { lineWidth: 0 })}` };
}

function loadProfile(file) {
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8');
  const lc = new YAML.LineCounter();
  const doc = YAML.parseDocument(text, { lineCounter: lc });
  if (doc.errors.length) return { error: doc.errors[0].message.split('\n')[0] };
  const data = doc.toJS() || {};
  return { data, text };
}

// Compare a saved profile with what the repo uses now.
function drift(profileData, inv, profileRel = PROFILE_PATH) {
  const out = [];
  const known = (k) => new Set((Array.isArray(profileData[k]) ? profileData[k] : []).map(String));
  const add = (file, message, fix) => out.push({ rule: 'CID014', name: RULES.CID014.name, level: 'notice', file, line: 1, col: 1, message, fix });
  const wfKnown = known('workflows');
  for (const w of inv.workflows) if (!wfKnown.has(w)) add(w, `New workflow \`${w}\` is not in the ci-doctor profile, so its checks were picked without it.`, `Add it to \`workflows:\` in ${profileRel}, or delete the profile to regenerate it.`);
  for (const w of wfKnown) if (!inv.workflows.includes(w)) add(profileRel, `Profile lists workflow \`${w}\`, which no longer exists.`, `Remove it from \`workflows:\` in ${profileRel}.`);
  const actKnown = new Set(Object.keys(profileData.actions || {}).map((s) => s.toLowerCase()));
  for (const a of inv.actions) if (!actKnown.has(a.name)) add(profileRel, `New action \`${a.name}@${a.refs.join(', ')}\` is in use but not in the profile.`, `Add \`${a.name}: ${a.refs[0]}\` under \`actions:\` in ${profileRel}.`);
  const rKnown = known('runners');
  for (const r of inv.runners) if (!rKnown.has(r)) add(profileRel, `New runner \`${r}\` is in use but not in the profile.`, `Add it to \`runners:\` in ${profileRel}.`);
  const lKnown = known('languages');
  for (const l of inv.languages) if (!lKnown.has(l)) add(profileRel, `New language \`${l}\` detected but not in the profile.`, `Add it to \`languages:\` in ${profileRel}; regenerating the profile also adds its checks.`);
  return out;
}

module.exports = { inventory, relevantChecks, buildProfile, loadProfile, drift, PROFILE_PATH };
