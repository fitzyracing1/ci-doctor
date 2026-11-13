'use strict';
const SPONSOR = 'https://github.com/sponsors/fitzyracing1';
const FOOTER = `Fixed by ci-doctor · Sponsor: ${SPONSOR}`;
const ICON = { error: '🔴', warning: '🟡', notice: '🔵' };
const RULES_URL = 'https://github.com/fitzyracing1/ci-doctor/blob/main/RULES.md';

function esc(s) { return String(s).replace(/\|/g, '\\|').replace(/\n/g, '<br>'); }
function fixCell(s) {
  // render fenced snippets inline-friendly inside a table cell
  return esc(String(s).replace(/```yaml\n([\s\S]*?)```/g, (_, code) => `<pre>${code.replace(/\n$/, '').replace(/\n/g, '&#10;')}</pre>`));
}

function summary(result, opts = {}) {
  const { findings, parseErrors } = result;
  const counts = count(findings);
  const lines = [];
  lines.push('## 🩺 ci-doctor');
  lines.push('');
  if (!findings.length && !parseErrors.length) {
    lines.push(`✅ No known CI breakages found in ${result.workflows} workflow file(s)${result.actions ? ` and ${result.actions} action file(s)` : ''}.`);
  } else {
    lines.push(`Scanned ${result.workflows} workflow file(s)${result.actions ? ` and ${result.actions} action file(s)` : ''}: **${counts.error} error(s)**, **${counts.warning} warning(s)**, ${counts.notice} notice(s).`);
    lines.push('');
    if (findings.length) {
      lines.push('| | Rule | Where | Problem | Fix |');
      lines.push('|---|---|---|---|---|');
      for (const f of findings) {
        const where = opts.repoUrl && opts.sha ? `[${f.file}:${f.line}](${opts.repoUrl}/blob/${opts.sha}/${f.file}#L${f.line})` : `${f.file}:${f.line}`;
        lines.push(`| ${ICON[f.level]} | [${f.rule}](${RULES_URL}#${f.rule.toLowerCase()}) ${f.name} | ${where} | ${esc(f.message)} | ${fixCell(f.fix)} |`);
      }
    }
    for (const p of parseErrors) lines.push(`\n⚠️ Could not parse \`${p.file}\`: ${esc(p.message)}`);
  }
  if (opts.profile) {
    const pr = opts.profile;
    lines.push('');
    if (pr.mode === 'used') {
      lines.push(`📋 Using this repo's profile \`${pr.file}\`: checked ${pr.checks.join(', ')}.${pr.drift ? ` **${pr.drift} drift item(s)**: the repo changed since the profile was made (see CID014 rows).` : ' No drift.'}`);
    } else {
      const inv = opts.inventory || {};
      lines.push(`### 📋 Custom checker for this repo`);
      lines.push('');
      if (pr.error) lines.push(`⚠️ \`${pr.file}\` could not be parsed (${esc(pr.error)}), so a fresh profile was generated.\n`);
      lines.push(`No \`${pr.file}\` yet, so ci-doctor built one from what this repo uses (languages: ${(inv.languages || []).join(', ') || 'none'}; package managers: ${(inv.packageManagers || []).join(', ') || 'none'}; ${(inv.workflows || []).length} workflow(s); ${(inv.actions || []).length} action(s); runners: ${(inv.runners || []).join(', ') || 'none'}).`);
      lines.push(`Commit it as \`${pr.file}\` and later runs will check only these rules and flag drift. It is also uploaded as the \`ci-doctor-profile\` artifact${pr.written ? `, and was written to \`${pr.file}\` in the workspace (\`write-profile: true\`)` : ''}.`);
      lines.push('');
      lines.push('<details><summary>Generated <code>' + pr.file + '</code></summary>\n\n```yaml\n' + pr.yaml.replace(/\n$/, '') + '\n```\n</details>');
    }
  }
  if (opts.env && opts.env.length) {
    lines.push('');
    lines.push(`<details><summary>Runner environment</summary>\n\n${opts.env.map((e) => `- ${e}`).join('\n')}\n</details>`);
  }
  lines.push('');
  lines.push('---');
  lines.push(`<sub>Fixed by [ci-doctor](https://github.com/fitzyracing1/ci-doctor) · Sponsor: ${SPONSOR}</sub>`);
  return lines.join('\n') + '\n';
}

function count(findings) {
  const c = { error: 0, warning: 0, notice: 0 };
  for (const f of findings) c[f.level]++;
  return c;
}

function escData(s) { return String(s).replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A'); }
function escProp(s) { return escData(s).replace(/:/g, '%3A').replace(/,/g, '%2C'); }
function annotation(f) {
  const cmd = f.level === 'warning' ? 'warning' : f.level;
  return `::${cmd} file=${escProp(f.file)},line=${f.line},col=${f.col},title=${escProp(`${f.rule} ${f.name}`)}::${escData(`${f.message}\nFix: ${f.fix.replace(/```yaml\n|```/g, '')}`)}`;
}

function shouldFail(findings, failOn) {
  const c = count(findings);
  if (failOn === 'error') return c.error > 0;
  if (failOn === 'warn' || failOn === 'warning') return c.error + c.warning > 0;
  return false;
}

module.exports = { summary, annotation, count, shouldFail, FOOTER, SPONSOR };
