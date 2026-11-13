'use strict';
const fs = require('fs');
const path = require('path');
const YAML = require('yaml');
const D = require('./data');

const RULES = {
  CID001: { name: 'artifact-actions-v1-v3', level: 'error' },
  CID002: { name: 'cache-action-v1-v2', level: 'error' },
  CID003: { name: 'action-on-old-node-runtime', level: 'warning' },
  CID004: { name: 'deprecated-workflow-command', level: 'warning' },
  CID005: { name: 'retired-runner-image', level: 'error' },
  CID006: { name: 'eol-language-version', level: 'warning' },
  CID007: { name: 'unpinned-lint-tool', level: 'notice' },
  CID008: { name: 'branch-filter-skips-default-branch', level: 'warning' },
  CID009: { name: 'missing-token-permissions', level: 'notice' },
  CID010: { name: 'unpinned-container-image', level: 'notice' },
  CID011: { name: 'secrets-on-fork-pull-requests', level: 'notice' },
  CID012: { name: 'removed-runner-opt-out', level: 'warning' },
  CID013: { name: 'local-action-old-node-runtime', level: 'warning' },
};

const isMap = YAML.isMap, isSeq = YAML.isSeq, isScalar = YAML.isScalar;

function get(node, key) {
  if (!isMap(node)) return undefined;
  for (const pair of node.items) {
    const k = isScalar(pair.key) ? pair.key.value : pair.key;
    if (String(k) === key) return pair.value;
  }
  return undefined;
}
function pairs(node) {
  if (!isMap(node)) return [];
  return node.items.map((p) => [String(isScalar(p.key) ? p.key.value : p.key), p.value, p.key]);
}
function scalars(node) {
  // A scalar or a sequence of scalars -> list of scalar nodes
  if (isScalar(node)) return [node];
  if (isSeq(node)) return node.items.filter(isScalar);
  return [];
}
function parseRef(uses) {
  // owner/repo[/path]@ref
  const at = uses.lastIndexOf('@');
  if (at < 0) return null;
  const name = uses.slice(0, at).toLowerCase();
  const ref = uses.slice(at + 1).trim();
  const m = /^v?(\d+)(?:\.\d+)*$/.exec(ref);
  return { name, ref, major: m ? Number(m[1]) : null };
}
function hasExpr(s) { return /\$\{\{/.test(String(s)); }

class FileCtx {
  constructor(root, file, text) {
    this.rel = path.relative(root, file).split(path.sep).join('/');
    this.text = text;
    this.lc = new YAML.LineCounter();
    this.doc = YAML.parseDocument(text, { lineCounter: this.lc, uniqueKeys: false });
    this.ignored = new Set();
    const m = text.match(/#\s*ci-doctor:\s*ignore\s+([A-Z0-9,\s]+)/gi) || [];
    for (const line of m) for (const id of line.replace(/.*ignore\s+/i, '').split(/[\s,]+/)) if (id) this.ignored.add(id.toUpperCase());
  }
  pos(node, offset) {
    const o = offset != null ? offset : (node && node.range ? node.range[0] : 0);
    const p = this.lc.linePos(o);
    return { line: p.line, col: p.col };
  }
}

function makeAdd(findings, ctx, opts) {
  return (rule, node, message, fix, offset, levelOverride) => {
    if (opts.ignore.has(rule) || ctx.ignored.has(rule)) return;
    if (opts.only && !opts.only.has(rule)) return;
    const { line, col } = ctx.pos(node, offset);
    findings.push({ rule, name: RULES[rule].name, level: levelOverride || RULES[rule].level, file: ctx.rel, line, col, message, fix });
  };
}

// ---- rules over `uses:` ----
function checkUses(add, node) {
  if (!isScalar(node) || typeof node.value !== 'string') return;
  const uses = node.value.trim();
  if (uses.startsWith('./') || uses.startsWith('docker://')) return;
  const r = parseRef(uses);
  if (!r || r.major == null) return; // SHA or branch pins: cannot judge the version
  if ((r.name === 'actions/upload-artifact' || r.name === 'actions/download-artifact') && r.major <= 3) {
    const latest = D.ACTION_RUNTIMES[r.name].latest;
    add('CID001', node, `${uses} has been shut down by GitHub (v1-v3 artifact actions stopped working on 2025-01-30); this step fails.`,
      `Use \`${r.name}@v${latest}\`. Note v4+ artifacts are immutable: give each upload a unique \`name\` (e.g. include \${{ matrix.os }}), or merge them with \`merge-multiple: true\` on download.`);
    return;
  }
  if (r.name.startsWith('actions/cache') && r.major <= 2) {
    add('CID002', node, `${uses} uses the retired cache service (actions/cache v1-v2 stopped working on 2025-03-01); this step fails.`,
      `Use \`${r.name}@v${D.ACTION_RUNTIMES['actions/cache'].latest}\` (inputs are compatible).`);
    return;
  }
  const info = D.ACTION_RUNTIMES[r.name];
  if (!info) return;
  const rt = info.runtimes[r.major];
  if (rt === 'node12' || rt === 'node16' || rt === 'node20') {
    add('CID003', node, `${uses} runs on ${rt}, which GitHub has removed from hosted runners (Node 20 was removed on 2026-09-23). The runner force-runs it on Node 24, which this version was never built or tested for.`,
      `Use \`${r.name}@v${info.latest}\` (runs natively on node24).`);
  }
}

// ---- rules over `run:` scripts ----
function checkRun(add, ctx, node) {
  if (!isScalar(node) || typeof node.value !== 'string' || !node.range) return;
  const start = node.range[0], end = node.range[1];
  const raw = ctx.text.slice(start, end);
  const cmds = [
    [/::set-output\s+name=/g, 'warning', '`::set-output` is deprecated and GitHub has announced it will be disabled.', 'Write `echo "NAME=VALUE" >> "$GITHUB_OUTPUT"` instead of `echo "::set-output name=NAME::VALUE"`.'],
    [/::save-state\s+name=/g, 'warning', '`::save-state` is deprecated and GitHub has announced it will be disabled.', 'Write `echo "NAME=VALUE" >> "$GITHUB_STATE"` instead of `echo "::save-state name=NAME::VALUE"`.'],
    [/::set-env\s+name=/g, 'error', '`::set-env` was disabled in 2020 for security reasons; the step errors.', 'Write `echo "NAME=VALUE" >> "$GITHUB_ENV"`.'],
    [/::add-path::/g, 'error', '`::add-path` was disabled in 2020 for security reasons; the step errors.', 'Write `echo "/some/dir" >> "$GITHUB_PATH"`.'],
  ];
  for (const [re, level, msg, fix] of cmds) {
    let m;
    while ((m = re.exec(raw))) add('CID004', node, msg, fix, start + m.index, level);
  }
  // CID007: unpinned formatters/linters via pip
  const pipRe = /\bpip3?\s+install\b([^\n;&|#]*)/g;
  let m;
  while ((m = pipRe.exec(raw))) {
    const toks = m[1].trim().split(/\s+/).filter(Boolean);
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i].replace(/^['"]|['"]$/g, '');
      if (/^(-r|-c|-e|--requirement|--constraint|--editable|-i|--index-url|--extra-index-url|-t|--target)$/.test(t)) { i++; continue; }
      if (t.startsWith('-')) continue;
      const name = t.split(/[=<>~!\[;@ ]/)[0].toLowerCase();
      if (D.PY_LINT_TOOLS.includes(name) && !/[=<>~!@]/.test(t)) {
        add('CID007', node, `\`pip install ${name}\` is unpinned. New ${name} releases change rules/formatting and can turn CI red with no code change.`,
          `Pin it, e.g. \`pip install "${name}==<version you use>"\`, or put it in a requirements/lock file and let Dependabot bump it.`, start + m.index);
      }
    }
  }
}

// ---- runner labels ----
function checkRunnerLabel(add, node) {
  if (!isScalar(node)) return;
  const label = String(node.value).trim().toLowerCase();
  if (D.RETIRED_RUNNERS[label]) {
    const r = D.RETIRED_RUNNERS[label];
    add('CID005', node, `Runner image \`${label}\` was retired on ${r.retired}; jobs on it never start or fail immediately.`, `Use \`runs-on: ${r.replace}\`.`);
  } else if (D.DEPRECATED_RUNNERS[label]) {
    const r = D.DEPRECATED_RUNNERS[label];
    add('CID005', node, `Runner image \`${label}\` is being deprecated (brownouts now, unsupported on ${r.unsupported}).`, `Move to \`runs-on: ${r.replace}\`.`, undefined, 'warning');
  }
}

// ---- language versions ----
function nodeMajor(v) {
  const s = String(v).trim().replace(/^v/, '');
  const m = /^(\d+)(?:\.(?:\d+|x))*$/.exec(s);
  return m ? Number(m[1]) : null;
}
function pyMinor(v) {
  const s = String(v).trim();
  const m = /^(\d+)\.(\d+)(?:\.\d+)?$/.exec(s);
  return m ? `${m[1]}.${m[2]}` : null;
}
function checkNodeVersion(add, node) {
  if (!isScalar(node) || hasExpr(node.value)) return;
  const maj = nodeMajor(node.value);
  if (maj == null || !D.NODE_EOL[maj]) return;
  add('CID006', node, `Node.js ${node.value} reached end-of-life on ${D.NODE_EOL[maj]}; no security fixes, and tools increasingly drop it.`,
    `Use \`node-version: '${D.NODE_SUGGEST}'\` (or '22'), or add ${D.NODE_SUGGEST} to your matrix and drop ${maj}.`);
}
function checkPythonVersion(add, node) {
  if (!isScalar(node) || hasExpr(node.value)) return;
  // YAML turns 3.10 into 3.1 - that's a classic breakage of its own
  if (typeof node.value === 'number' && /^\d+\.\d0$/.test(node.source || '')) {
    add('CID006', node, `\`${node.source}\` is parsed by YAML as the number ${node.value}, so setup-python installs Python ${node.value}, not ${node.source}.`,
      `Quote it: \`'${node.source}'\`.`, undefined, 'error');
    return;
  }
  const v = pyMinor(node.source != null ? node.source : node.value);
  if (!v || !D.PYTHON_EOL[v]) return;
  add('CID006', node, `Python ${v} reached end-of-life on ${D.PYTHON_EOL[v]}${['2.7', '3.5', '3.6', '3.7'].includes(v) ? ' and is not available for ubuntu-24.04 runners in setup-python, so the job fails' : ''}.`,
    `Use \`python-version: '${D.PYTHON_SUGGEST}'\` (oldest supported is '3.10').`);
}

// ---- branch filters ----
function globToRe(g) {
  let re = '';
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === '*') { if (g[i + 1] === '*') { re += '.*'; i++; } else re += '[^/]*'; }
    else if (c === '?') re += '.';
    else re += c.replace(/[.+^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`);
}
function branchMatches(patterns, branch) {
  let ok = false;
  for (const p of patterns) {
    if (p.startsWith('!')) { if (globToRe(p.slice(1)).test(branch)) ok = false; }
    else if (globToRe(p).test(branch)) ok = true;
  }
  return ok;
}

function scanWorkflow(ctx, opts, findings) {
  const add = makeAdd(findings, ctx, opts);
  const root = ctx.doc.contents;
  if (!isMap(root)) return;
  const on = get(root, 'on');
  const events = new Set();
  if (isScalar(on)) events.add(String(on.value));
  for (const s of isSeq(on) ? on.items : []) if (isScalar(s)) events.add(String(s.value));
  for (const [k] of pairs(on)) events.add(k);

  // CID008
  if (opts.defaultBranch) {
    for (const ev of ['push', 'pull_request']) {
      const evNode = get(on, ev);
      const br = get(evNode, 'branches');
      if (br) {
        const pats = scalars(br).map((n) => String(n.value));
        if (pats.length && !branchMatches(pats, opts.defaultBranch)) {
          add('CID008', br, `\`on.${ev}.branches\` is [${pats.join(', ')}], but this repo's default branch is \`${opts.defaultBranch}\`, so this workflow never runs for ${ev === 'push' ? 'pushes to' : 'pull requests into'} it.`,
            `Add it: \`branches: [${[...pats, opts.defaultBranch].join(', ')}]\`.`);
        }
      }
      const ign = get(evNode, 'branches-ignore');
      if (ign) {
        const pats = scalars(ign).map((n) => String(n.value));
        if (pats.some((p) => !p.startsWith('!') && globToRe(p).test(opts.defaultBranch))) {
          add('CID008', ign, `\`on.${ev}.branches-ignore\` excludes the default branch \`${opts.defaultBranch}\`, so the default branch never gets a CI result.`,
            `Remove \`${opts.defaultBranch}\` from \`branches-ignore\` unless that is intentional.`, undefined, 'notice');
        }
      }
    }
  }

  // CID012: removed opt-outs anywhere in the file
  const optOuts = [
    [/ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION\s*:\s*['"]?true/gi, '`ACTIONS_ALLOW_USE_UNSECURE_NODE_VERSION` no longer does anything: GitHub removed Node 20 from runners on 2026-09-23.', 'Delete it and upgrade the actions it was propping up (see CID003).'],
    [/ACTIONS_ALLOW_UNSECURE_COMMANDS\s*:\s*['"]?true/gi, '`ACTIONS_ALLOW_UNSECURE_COMMANDS: true` re-enables `set-env`/`add-path`, which GitHub disabled because they let untrusted log output inject environment variables.', 'Delete it and write to `$GITHUB_ENV` / `$GITHUB_PATH` instead.'],
  ];
  for (const [re, msg, fix] of optOuts) { let m; while ((m = re.exec(ctx.text))) add('CID012', null, msg, fix, m.index); }

  const jobs = get(root, 'jobs');
  const jobList = pairs(jobs);

  // CID009
  if (!get(root, 'permissions') && jobList.length && !jobList.every(([, j]) => get(j, 'permissions'))) {
    add('CID009', get(root, 'jobs') ? root.items.find((p) => isScalar(p.key) && p.key.value === 'jobs').key : root,
      'No `permissions:` block, so GITHUB_TOKEN gets the repository default, which is read/write on many repos.',
      'Add at the top level:\n```yaml\npermissions:\n  contents: read\n```\nthen grant extra scopes per job only where needed.');
  }

  const prTriggered = events.has('pull_request');
  for (const [, job] of jobList) {
    if (!isMap(job)) continue;
    checkUses(add, get(job, 'uses')); // reusable workflow call
    // runs-on (direct labels and matrix values)
    const runsOn = get(job, 'runs-on');
    for (const n of scalars(runsOn)) checkRunnerLabel(add, n);
    if (isMap(runsOn)) for (const n of scalars(get(runsOn, 'labels'))) checkRunnerLabel(add, n);
    const matrix = get(get(job, 'strategy'), 'matrix');
    const mvals = (key) => {
      const out = [...scalars(get(matrix, key))];
      for (const inc of isSeq(get(matrix, 'include')) ? get(matrix, 'include').items : []) { const v = get(inc, key); if (isScalar(v)) out.push(v); }
      return out;
    };
    if (isMap(matrix)) {
      for (const [k] of pairs(matrix)) {
        if (/^(os|runs-on|runner|platform)$/i.test(k)) for (const n of mvals(k)) checkRunnerLabel(add, n);
      }
      for (const inc of isSeq(get(matrix, 'include')) ? get(matrix, 'include').items : []) for (const k of ['os', 'runs-on', 'runner', 'platform']) { const v = get(inc, k); if (isScalar(v)) checkRunnerLabel(add, v); }
    }
    // container / services images
    const images = [];
    const cont = get(job, 'container');
    if (isScalar(cont)) images.push(cont); else if (isMap(cont)) images.push(get(cont, 'image'));
    for (const [, svc] of pairs(get(job, 'services'))) images.push(isScalar(svc) ? svc : get(svc, 'image'));
    for (const img of images) {
      if (!isScalar(img) || hasExpr(img.value)) continue;
      const s = String(img.value);
      const last = s.split('/').pop();
      if (s.includes('@sha256:')) continue;
      if (!last.includes(':') || last.endsWith(':latest')) {
        add('CID010', img, `Container image \`${s}\` is not pinned to a version; a new upstream release (or the image being unpublished) can break this job overnight.`,
          `Pin a tag or digest, e.g. \`${s.replace(/:latest$/, '')}:<version>\`.`);
      }
    }
    // steps
    const jobIf = String(get(job, 'if') ? get(job, 'if').value : '');
    let secretFlagged = false;
    const steps = get(job, 'steps');
    for (const step of isSeq(steps) ? steps.items : []) {
      if (!isMap(step)) continue;
      const uses = get(step, 'uses');
      checkUses(add, uses);
      checkRun(add, ctx, get(step, 'run'));
      const usesName = isScalar(uses) ? String(uses.value).toLowerCase() : '';
      const w = get(step, 'with');
      const resolve = (n, fn) => {
        if (!isScalar(n)) return;
        const mm = /^\$\{\{\s*matrix\.([\w-]+)\s*\}\}$/.exec(String(n.value).trim());
        if (mm) { for (const v of mvals(mm[1])) fn(add, v); } else fn(add, n);
      };
      if (usesName.startsWith('actions/setup-node@')) for (const n of scalars(get(w, 'node-version'))) resolve(n, checkNodeVersion);
      if (usesName.startsWith('actions/setup-python@')) for (const n of scalars(get(w, 'python-version'))) resolve(n, checkPythonVersion);
      // CID011
      if (prTriggered && !secretFlagged) {
        const stepIf = String(get(step, 'if') ? get(step, 'if').value : '');
        const guarded = /secrets\.|head\.repo|fork|github\.repository\b|event_name/.test(jobIf + ' ' + stepIf);
        const stepText = step.range ? ctx.text.slice(step.range[0], step.range[1]) : '';
        const m = /\$\{\{\s*secrets\.(?!GITHUB_TOKEN\b)([A-Za-z0-9_]+)/.exec(stepText);
        if (m && !guarded) {
          secretFlagged = true;
          add('CID011', null, `This job runs on \`pull_request\` and reads \`secrets.${m[1]}\`. Secrets are empty for pull requests from forks, so contributor PRs fail here (or the code crashes on an unset value).`,
            `Guard the step, e.g. \`if: github.event.pull_request.head.repo.full_name == github.repository\`, or give the code a safe fallback when the value is empty.`, step.range[0] + stepText.indexOf(m[0]));
        }
      }
    }
  }
}

function scanActionMetadata(ctx, opts, findings) {
  const add = makeAdd(findings, ctx, opts);
  const runs = get(ctx.doc.contents, 'runs');
  const using = get(runs, 'using');
  if (isScalar(using) && /^node(12|16|20)$/.test(String(using.value))) {
    add('CID013', using, `This action declares \`using: ${using.value}\`. GitHub has removed ${using.value} from hosted runners, so it is force-run on Node 24.`,
      'Change it to `using: node24`, test, and release a new major.');
  }
  if (isScalar(using) && using.value === 'composite') {
    for (const step of isSeq(get(runs, 'steps')) ? get(runs, 'steps').items : []) {
      checkUses(add, get(step, 'uses'));
      checkRun(add, ctx, get(step, 'run'));
    }
  }
}

function listFiles(root, opts) {
  const wf = [];
  const wfDir = path.join(root, '.github', 'workflows');
  if (fs.existsSync(wfDir)) for (const f of fs.readdirSync(wfDir).sort()) if (/\.ya?ml$/i.test(f)) wf.push(path.join(wfDir, f));
  const actions = [];
  const walk = (dir, depth) => {
    if (depth > 6) return;
    let ents = [];
    try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents.sort((a, b) => a.name.localeCompare(b.name))) {
      if (e.isDirectory()) {
        if (['node_modules', '.git', 'vendor', 'dist', 'build', 'target', '.venv', 'venv'].includes(e.name)) continue;
        if (opts.excludeDirs.some((x) => path.resolve(dir, e.name) === path.resolve(root, x))) continue;
        walk(path.join(dir, e.name), depth + 1);
      } else if (/^action\.ya?ml$/.test(e.name)) actions.push(path.join(dir, e.name));
    }
  };
  if (opts.scanActions) walk(root, 0);
  return { wf, actions };
}

const ORDER = { error: 0, warning: 1, notice: 2 };

function scan(root, options = {}) {
  const opts = {
    defaultBranch: options.defaultBranch || '',
    ignore: new Set((options.ignore || []).map((s) => s.toUpperCase())),
    scanActions: options.scanActions !== false,
    excludeDirs: options.excludeDirs || [],
    only: options.only ? new Set(options.only.map((s) => s.toUpperCase())) : null,
  };
  const findings = [];
  const parseErrors = [];
  const { wf, actions } = listFiles(root, opts);
  for (const [files, fn] of [[wf, scanWorkflow], [actions, scanActionMetadata]]) {
    for (const f of files) {
      const ctx = new FileCtx(root, f, fs.readFileSync(f, 'utf8'));
      if (ctx.doc.errors.length) { parseErrors.push({ file: ctx.rel, message: ctx.doc.errors[0].message.split('\n')[0] }); continue; }
      fn(ctx, opts, findings);
    }
  }
  const seen = new Set();
  const unique = findings.filter((f) => { const k = `${f.rule}|${f.file}|${f.line}|${f.col}|${f.message}`; if (seen.has(k)) return false; seen.add(k); return true; });
  findings.length = 0; findings.push(...unique);
  findings.sort((a, b) => ORDER[a.level] - ORDER[b.level] || a.file.localeCompare(b.file) || a.line - b.line || a.rule.localeCompare(b.rule));
  return { findings, parseErrors, workflows: wf.length, actions: actions.length };
}

RULES.CID014 = { name: "profile-drift", level: "notice" };
module.exports = { scan, RULES, branchMatches, get, pairs, scalars, parseRef, listFiles };
