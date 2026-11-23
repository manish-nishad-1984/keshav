// Deploy to a client site that we reach by FTP only (no Web Deploy), e.g. the demo client:
//   node deploy/ftp-deploy.mjs demo            build + migrate + upload what changed
//   node deploy/ftp-deploy.mjs demo --full     also (re)upload node_modules (first time, or after a dependency change)
//   node deploy/ftp-deploy.mjs demo --skip-build
//
// Settings and secrets come from deploy/deploy.<client>.env (gitignored): LIVE_URL, FTP_HOST, FTP_USER,
// FTP_PASSWORD, DATABASE_URL, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET. Each client has its own database,
// uploads and logins; only the code is shared. Nothing on the server is ever deleted.
import { execSync, spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [client, ...flags] = process.argv.slice(2);
const full = flags.includes('--full');
const skipBuild = flags.includes('--skip-build');

const fail = (msg) => {
  console.error(`\nDEPLOY FAILED: ${msg}\nCopy this window to Claude.`);
  process.exit(1);
};
const step = (msg) => console.log(`\n=== ${msg}`);
const run = (cmd, opts = {}) => {
  const r = spawnSync(cmd, { shell: true, stdio: 'inherit', cwd: root, ...opts });
  if (r.status !== 0) fail(cmd);
};

if (!client || client === 'local') fail('usage: node deploy/ftp-deploy.mjs <client> [--full] [--skip-build]');
const envFile = path.join(root, 'deploy', `deploy.${client}.env`);
if (!fs.existsSync(envFile)) fail(`missing ${envFile}`);
const cfg = Object.fromEntries(
  fs
    .readFileSync(envFile, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/))
    .filter(Boolean)
    .map((m) => [m[1], m[2].replace(/^"|"$/g, '')]),
);
for (const k of ['LIVE_URL', 'FTP_HOST', 'FTP_USER', 'FTP_PASSWORD', 'DATABASE_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET']) {
  if (!cfg[k]) fail(`${k} is empty in ${envFile}`);
}
const liveUrl = cfg.LIVE_URL.replace(/\/+$/, '');
console.log(`Deploying ${execSync('git log --oneline -1', { cwd: root }).toString().trim()} to ${liveUrl}`);

// --- 1. build ----------------------------------------------------------------------------------
if (skipBuild) step('1/5 Build (skipped)');
else {
  step('1/5 Build');
  run('npm run build -w packages/types');
  run('npm run build -w packages/shared');
  run('npx prisma generate', { cwd: path.join(root, 'apps/api') });
  run('npm run build -w apps/api');
  run('npm run build -w apps/web');
}
const indexHtml = fs.readFileSync(path.join(root, 'apps/web/dist/index.html'), 'utf8');
const expectedJs = (indexHtml.match(/assets\/index-[^"]+\.js/) ?? [])[0];
if (!expectedJs) fail('apps/web/dist/index.html has no index-*.js');

// --- 2. migrations -----------------------------------------------------------------------------
step('2/5 Database migrations');
run('npx prisma migrate deploy', { cwd: path.join(root, 'apps/api'), env: { ...process.env, DATABASE_URL: cfg.DATABASE_URL } });

// --- 3. collect files ----------------------------------------------------------------------------
step('3/5 Collect files');
const files = []; // [localPath, remotePath]
const addDir = (localDir, remoteDir, skip = () => false) => {
  if (!fs.existsSync(localDir)) fail(`missing ${localDir}`);
  for (const entry of fs.readdirSync(localDir, { withFileTypes: true })) {
    const local = path.join(localDir, entry.name);
    const remote = `${remoteDir}/${entry.name}`;
    if (skip(local, entry)) continue;
    if (entry.isDirectory()) addDir(local, remote, skip);
    else files.push([local, remote]);
  }
};
addDir(path.join(root, 'apps/api/dist'), 'apps/api/dist');
files.push([path.join(root, 'apps/api/server.js'), 'apps/api/server.js']);
files.push([path.join(root, 'apps/api/package.json'), 'apps/api/package.json']);
addDir(path.join(root, 'apps/web/dist'), 'apps/web/dist');
for (const pkg of ['types', 'shared']) {
  addDir(path.join(root, `packages/${pkg}/dist`), `node_modules/@ckfast/${pkg}/dist`);
  files.push([path.join(root, `packages/${pkg}/package.json`), `node_modules/@ckfast/${pkg}/package.json`]);
}
// Generated Prisma client (with the Windows engine); leftover .tmp copies of the engine are skipped.
addDir(path.join(root, 'node_modules/.prisma/client'), 'node_modules/.prisma/client', (p) => /\.tmp\d*$/.test(p));

if (full) {
  // Only the API's runtime packages, installed fresh (no dev tools), from the versions in package-lock.
  const cache = path.join(root, 'deploy/.cache/runtime');
  fs.rmSync(cache, { recursive: true, force: true });
  fs.mkdirSync(cache, { recursive: true });
  const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8')).packages;
  const deps = JSON.parse(fs.readFileSync(path.join(root, 'apps/api/package.json'), 'utf8')).dependencies;
  const pinned = {};
  for (const name of Object.keys(deps)) {
    if (name.startsWith('@ckfast/')) continue;
    const entry = lock[`node_modules/${name}`] ?? lock[`apps/api/node_modules/${name}`];
    if (!entry) fail(`${name} not in package-lock.json`);
    pinned[name] = entry.version;
  }
  fs.writeFileSync(path.join(cache, 'package.json'), JSON.stringify({ name: 'runtime', private: true, dependencies: pinned }));
  run('npm install --omit=dev --ignore-scripts --no-audit --no-fund', { cwd: cache });
  addDir(path.join(cache, 'node_modules'), 'node_modules', (p) => p.endsWith(`${path.sep}.prisma`) || p.endsWith('.package-lock.json'));
}

// Server settings for this client (its own database and login secrets).
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ckfast-deploy-'));
const serverEnv = path.join(tmp, '.env');
fs.writeFileSync(
  serverEnv,
  [
    'NODE_ENV=production',
    `DATABASE_URL=${cfg.DATABASE_URL}`,
    `JWT_ACCESS_SECRET=${cfg.JWT_ACCESS_SECRET}`,
    `JWT_REFRESH_SECRET=${cfg.JWT_REFRESH_SECRET}`,
    `WEB_ORIGIN=${liveUrl}`,
    `COOKIE_SECURE=${liveUrl.startsWith('https') ? 'true' : 'false'}`,
  ].join('\n') + '\n',
);
files.push([serverEnv, 'apps/api/.env']);

// Upload only what changed since the last deploy to this client.
const manifestFile = path.join(root, `deploy/.cache/${client}-manifest.json`);
const manifest = fs.existsSync(manifestFile) ? JSON.parse(fs.readFileSync(manifestFile, 'utf8')) : {};
const hash = (p) => crypto.createHash('sha1').update(fs.readFileSync(p)).digest('hex');
const changed = files.filter(([local, remote]) => manifest[remote] !== hash(local));
console.log(`${files.length} files, ${changed.length} to upload`);

// --- 4. upload ---------------------------------------------------------------------------------
step('4/5 Upload');
const ftpBase = `ftp://${cfg.FTP_HOST}/`;
const enc = (p) => p.split('/').map(encodeURIComponent).join('/');
const quote = (s) => `"${s.replace(/\\/g, '/').replace(/"/g, '\\"')}"`;
const BATCH = 150;
for (let i = 0; i < changed.length; i += BATCH) {
  const batch = changed.slice(i, i + BATCH);
  const conf = path.join(tmp, 'curl.cfg');
  fs.writeFileSync(
    conf,
    [`user = ${quote(`${cfg.FTP_USER}:${cfg.FTP_PASSWORD}`)}`, 'ftp-create-dirs', 'silent', 'show-error', 'retry = 3', ...batch.flatMap(([l, r]) => [`upload-file = ${quote(l)}`, `url = ${quote(ftpBase + enc(r))}`])].join('\n'),
  );
  const r = spawnSync('curl', ['-K', conf], { stdio: 'inherit' });
  fs.rmSync(conf, { force: true });
  if (r.status !== 0) fail(`FTP upload (batch starting ${batch[0][1]})`);
  for (const [local, remote] of batch) manifest[remote] = hash(local);
  fs.mkdirSync(path.dirname(manifestFile), { recursive: true });
  fs.writeFileSync(manifestFile, JSON.stringify(manifest));
  console.log(`  ${Math.min(i + BATCH, changed.length)} / ${changed.length}`);
}
// web.config last: it restarts the app once everything else is in place.
const webConfig = path.join(tmp, 'web.config');
fs.writeFileSync(webConfig, fs.readFileSync(path.join(root, 'deploy/web.config'), 'utf8').replace('</configuration>', `  <!-- deployed ${new Date().toISOString()} -->\n</configuration>`));
const wc = spawnSync('curl', ['-sS', '--user', `${cfg.FTP_USER}:${cfg.FTP_PASSWORD}`, '-T', webConfig, `${ftpBase}web.config`], { stdio: 'inherit' });
fs.rmSync(tmp, { recursive: true, force: true });
if (wc.status !== 0) fail('web.config upload');

// --- 5. verify ---------------------------------------------------------------------------------
step('5/5 Check live site');
let ok = false;
for (let i = 1; i <= 8 && !ok; i++) {
  await new Promise((r) => setTimeout(r, 5000));
  try {
    const res = await fetch(`${liveUrl}/api/v1/health`);
    ok = (await res.text()).includes('"status":"ok"');
  } catch {
    /* still starting */
  }
  if (!ok) console.log(`  waiting for the app to start (${i}/8)...`);
}
if (!ok) fail(`${liveUrl}/api/v1/health did not answer ok`);
const page = await (await fetch(`${liveUrl}/`)).text();
if (!page.includes(expectedJs)) fail(`live page does not serve this build (${expectedJs})`);
console.log(`\nDEPLOY OK - ${liveUrl} is running this build (${expectedJs}).`);
