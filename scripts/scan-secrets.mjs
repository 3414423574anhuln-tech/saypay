import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parseEnv } from 'node:util';

const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const findings = [];
// Compare locally configured values in memory; never print them or scan .env as a publishable file.
const localEnv = existsSync('.env') ? parseEnv(readFileSync('.env', 'utf8')) : {};
const localSecrets = ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET'].map(name => localEnv[name]).filter(value => value?.trim());
const patterns = [
  ['PRIVATE_KEY', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['OPENAI_STYLE_KEY', /\bsk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{20,}\b/],
  ['GITHUB_TOKEN', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/],
  ['PAYPAL_BEARER_TOKEN', /\bA21AA[A-Za-z0-9_-]{30,}\b/],
  ['AWS_ACCESS_KEY', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['JWT_TOKEN', /\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\b/],
];
function inspect(path, content, revision) {
  if (/(^|\/)(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?)$/.test(path) && !path.endsWith('/.env.example') && path !== '.env.example') findings.push({ path, revision, code: 'FORBIDDEN_SECRET_FILE' });
  for (const [code, pattern] of patterns) if (pattern.test(content)) findings.push({ path, revision, code });
  if (localSecrets.some(value => content.includes(value))) findings.push({ path, revision, code: 'LOCAL_CREDENTIAL_VALUE' });
  for (const line of content.split(/\r?\n/)) {
    const match = /^\s*(PAYPAL_CLIENT_ID|PAYPAL_CLIENT_SECRET|LLM_API_KEY|CLOUDFLARE_API_TOKEN)\s*=\s*(.*?)\s*$/.exec(line);
    if (match && match[2].replace(/^['"]|['"]$/g, '') !== '') findings.push({ path, revision, code: 'POPULATED_CREDENTIAL_ASSIGNMENT' });
  }
}
const current = git(['ls-files', '-z', '--cached', '--others', '--exclude-standard']).split('\0').filter(Boolean);
for (const path of [...new Set(current)]) inspect(path, readFileSync(path, 'utf8'), 'working-tree');
const stagedPaths = git(['diff', '--cached', '--name-only', '--diff-filter=ACMR', '-z']).split('\0').filter(Boolean);
for (const path of stagedPaths) inspect(path, git(['show', `:${path}`]), 'index');
let builtFiles = 0;
if (existsSync('dist')) {
  for (const entry of readdirSync('dist', { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const path = join(entry.parentPath, entry.name);
    const content = readFileSync(path);
    builtFiles++;
    if (/^\.dev\.vars(?:\..*)?$/.test(entry.name)) findings.push({ path, revision: 'build-output', code: 'FORBIDDEN_SECRET_FILE' });
    if (localSecrets.some(value => content.includes(Buffer.from(value)))) findings.push({ path, revision: 'build-output', code: 'LOCAL_CREDENTIAL_VALUE' });
  }
}
const revisions = git(['rev-list', '--all']).trim().split(/\r?\n/).filter(Boolean);
let historyFiles = 0;
for (const revision of revisions) {
  const paths = git(['ls-tree', '-r', '--name-only', '-z', revision]).split('\0').filter(Boolean);
  for (const path of paths) { inspect(path, git(['show', `${revision}:${path}`]), revision); historyFiles++; }
}
const trackedSecrets = git(['ls-files', '-z']).split('\0').filter(p => /(^|\/)(?:\.env(?:\..*)?|\.dev\.vars(?:\..*)?)$/.test(p) && p !== '.env.example');
execFileSync('git', ['check-ignore', '-q', '.env'], { stdio: 'ignore' });
const result = { method: 'selected credential patterns + dotenv assignments + forbidden paths + exact local credential comparison including build output; no candidate values printed', currentFiles: new Set(current).size, stagedFiles: stagedPaths.length, builtFiles, localCredentialValuesChecked: localSecrets.length, reachableCommits: revisions.length, historyFileVersions: historyFiles, findings, trackedSecretFiles: trackedSecrets, envIgnored: true };
console.log(JSON.stringify(result, null, 2));
if (findings.length || trackedSecrets.length) process.exitCode = 1;
