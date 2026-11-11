#!/usr/bin/env node
/**
 * Build script cho static site — chạy được cả ở local lẫn trên GitHub Actions.
 *
 * Việc nó làm:
 *  1. Bundle + minify JS (esbuild) và CSS.
 *  2. Gắn hash nội dung vào tên file (cache busting): app.<hash>.js, styles.<hash>.css.
 *  3. Tiêm metadata của lần build (commit SHA, run number, thời điểm...) vào HTML.
 *  4. Ghi .nojekyll (bắt buộc để GitHub Pages không chạy Jekyll) + build-info.json.
 *  5. Nếu đang chạy trong Actions, ghi thêm bảng tóm tắt vào GITHUB_STEP_SUMMARY.
 *
 * Biến môi trường tuỳ chọn:
 *  - BUILD_OUT_DIR: thư mục output (mặc định "dist"), test dùng để build vào tmp.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, readdir, rm, stat, writeFile, appendFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { build as esbuild, transform } from 'esbuild';

import { formatBytes } from '../src/lib/format.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'src');
const OUT_DIR = path.resolve(ROOT, process.env.BUILD_OUT_DIR || 'dist');

const PLACEHOLDER_PATTERN = /__[A-Z][A-Z0-9_]*__/g;

const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));

/* ------------------------------------------------------------------ */
/* Thu thập metadata                                                    */
/* ------------------------------------------------------------------ */

function gitOutput(args) {
  try {
    return execFileSync('git', args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

function resolveRepository() {
  const env = process.env;
  if (env.GITHUB_REPOSITORY) {
    const server = env.GITHUB_SERVER_URL || 'https://github.com';
    return { slug: env.GITHUB_REPOSITORY, url: `${server}/${env.GITHUB_REPOSITORY}` };
  }

  const url = pkg.repository?.url ?? 'https://github.com/LySyaoran/cicd-demo.git';
  const slug = url
    .replace(/^git\+/, '')
    .replace(/\.git$/, '')
    .replace(/^https?:\/\/github\.com\//, '');
  return { slug, url: `https://github.com/${slug}` };
}

function collectMetadata() {
  const env = process.env;
  const repo = resolveRepository();

  const sha = env.GITHUB_SHA || gitOutput(['rev-parse', 'HEAD']) || 'local-dev';
  const branch = env.GITHUB_REF_NAME || gitOutput(['rev-parse', '--abbrev-ref', 'HEAD']) || 'local';
  const runNumber = env.GITHUB_RUN_NUMBER || '0';
  const runId = env.GITHUB_RUN_ID || '';
  const actor = env.GITHUB_ACTOR || 'local';
  const builtAt = new Date().toISOString();

  const runUrl = runId ? `${repo.url}/actions/runs/${runId}` : `${repo.url}/actions`;
  const commitUrl = sha === 'local-dev' ? repo.url : `${repo.url}/commit/${sha}`;

  return {
    version: pkg.version,
    sha,
    shortSha: sha === 'local-dev' ? 'local' : sha.slice(0, 7),
    branch,
    runNumber,
    runId,
    runUrl,
    commitUrl,
    repoUrl: repo.url,
    repoSlug: repo.slug,
    actor,
    builtAt,
  };
}

/* ------------------------------------------------------------------ */
/* Build                                                                */
/* ------------------------------------------------------------------ */

const hash8 = (content) => createHash('sha256').update(content).digest('hex').slice(0, 8);

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function directorySize(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  let total = 0;
  const files = [];

  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const nested = await directorySize(full);
      total += nested.total;
      files.push(...nested.files);
    } else {
      const { size } = await stat(full);
      total += size;
      files.push({ path: path.relative(OUT_DIR, full), size });
    }
  }

  return { total, files };
}

async function buildAssets() {
  const jsResult = await esbuild({
    entryPoints: [path.join(SRC_DIR, 'app.js')],
    bundle: true,
    minify: true,
    format: 'esm',
    target: ['es2020'],
    write: false,
    legalComments: 'none',
    charset: 'utf8',
    logLevel: 'silent',
    absWorkingDir: ROOT,
  });

  const jsCode = jsResult.outputFiles[0].text;
  const cssSource = await readFile(path.join(SRC_DIR, 'styles.css'), 'utf8');
  const cssResult = await transform(cssSource, {
    loader: 'css',
    minify: true,
    charset: 'utf8',
    legalComments: 'none',
  });
  const cssCode = cssResult.code;

  const jsName = `app.${hash8(jsCode)}.js`;
  const cssName = `styles.${hash8(cssCode)}.css`;

  await mkdir(path.join(OUT_DIR, 'assets'), { recursive: true });
  await writeFile(path.join(OUT_DIR, 'assets', jsName), jsCode, 'utf8');
  await writeFile(path.join(OUT_DIR, 'assets', cssName), cssCode, 'utf8');
  await cp(path.join(SRC_DIR, 'favicon.svg'), path.join(OUT_DIR, 'favicon.svg'));

  return {
    js: { name: jsName, bytes: Buffer.byteLength(jsCode) },
    css: { name: cssName, bytes: Buffer.byteLength(cssCode) },
  };
}

async function buildHtml(meta, assets) {
  let html = await readFile(path.join(SRC_DIR, 'index.html'), 'utf8');

  // Thay tham chiếu asset gốc bằng file đã minify + hash.
  const withAssets = html
    .replaceAll('href="./styles.css"', `href="./assets/${assets.css.name}"`)
    .replaceAll('src="./app.js"', `src="./assets/${assets.js.name}"`);

  if (withAssets === html) {
    throw new Error('Không tìm thấy tham chiếu ./styles.css hoặc ./app.js trong src/index.html');
  }

  const totalBytes = assets.js.bytes + assets.css.bytes;
  const replacements = {
    __BUILD_TIME__: meta.builtAt,
    __COMMIT_SHA__: meta.sha,
    __SHORT_SHA__: meta.shortSha,
    __COMMIT_URL__: meta.commitUrl,
    __BRANCH__: meta.branch,
    __RUN_NUMBER__: meta.runNumber,
    __RUN_URL__: meta.runUrl,
    __REPO_URL__: meta.repoUrl,
    __VERSION__: meta.version,
    __ACTOR__: meta.actor,
    __TOTAL_SIZE__: formatBytes(totalBytes),
  };

  let output = withAssets;
  for (const [placeholder, value] of Object.entries(replacements)) {
    output = output.replaceAll(placeholder, escapeHtml(value));
  }

  const leftover = output.match(PLACEHOLDER_PATTERN);
  if (leftover) {
    throw new Error(`Còn placeholder chưa được thay: ${[...new Set(leftover)].join(', ')}`);
  }

  await writeFile(path.join(OUT_DIR, 'index.html'), output, 'utf8');

  return { htmlBytes: Buffer.byteLength(output), totalBytes };
}

async function writeBuildInfo(meta, assets, htmlBytes) {
  const info = {
    version: meta.version,
    commit: meta.sha,
    shortCommit: meta.shortSha,
    branch: meta.branch,
    runNumber: meta.runNumber,
    runUrl: meta.runUrl,
    repository: meta.repoSlug,
    actor: meta.actor,
    builtAt: meta.builtAt,
    assets: {
      js: assets.js,
      css: assets.css,
    },
    sizes: {
      html: htmlBytes,
      js: assets.js.bytes,
      css: assets.css.bytes,
    },
  };

  await writeFile(
    path.join(OUT_DIR, 'build-info.json'),
    `${JSON.stringify(info, null, 2)}\n`,
    'utf8',
  );
  return info;
}

async function writeStepSummary(info, totals) {
  const summaryFile = process.env.GITHUB_STEP_SUMMARY;
  if (!summaryFile) return;

  const rows = [
    '### 📦 Build output',
    '',
    '| Mục | Giá trị |',
    '| --- | --- |',
    `| Commit | \`${info.shortCommit}\` (\`${info.branch}\`) |`,
    `| Run | #${info.runNumber} — ${info.runUrl} |`,
    `| Phiên bản | v${info.version} |`,
    `| JS | \`${info.assets.js.name}\` — ${formatBytes(info.assets.js.bytes)} |`,
    `| CSS | \`${info.assets.css.name}\` — ${formatBytes(info.assets.css.bytes)} |`,
    `| Tổng dung lượng | ${formatBytes(info.sizes.html + totals.total)} |`,
    '',
  ];

  try {
    await appendFile(summaryFile, `${rows.join('\n')}\n`, 'utf8');
  } catch {
    /* summary là best-effort, không làm fail build */
  }
}

/* ------------------------------------------------------------------ */
/* Entrypoint                                                           */
/* ------------------------------------------------------------------ */

async function main() {
  const startedAt = Date.now();
  const meta = collectMetadata();

  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const assets = await buildAssets();
  const { htmlBytes, totalBytes } = await buildHtml(meta, assets);
  await writeFile(path.join(OUT_DIR, '.nojekyll'), '', 'utf8');
  const info = await writeBuildInfo(meta, assets, htmlBytes);
  const totals = await directorySize(OUT_DIR);
  await writeStepSummary(info, totals);

  const elapsed = Date.now() - startedAt;
  console.log(`\n✅ Build xong trong ${elapsed}ms → ${path.relative(ROOT, OUT_DIR) || '.'}/`);
  console.log(`   file      bytes`);
  for (const file of totals.files) {
    console.log(`   ${file.path.padEnd(32)} ${String(file.size).padStart(8)}`);
  }
  console.log(
    `   ${'TOTAL'.padEnd(32)} ${String(totals.total).padStart(8)}  (JS+CSS: ${formatBytes(totalBytes)})`,
  );
}

await main();
