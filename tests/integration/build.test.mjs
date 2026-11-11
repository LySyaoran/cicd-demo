import assert from 'node:assert/strict';
import { readdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { buildFixture, ROOT } from '../helpers/build.mjs';

const SHA = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0';
const RUN_ID = '987654321';

const buildEnv = {
  GITHUB_SHA: SHA,
  GITHUB_REF_NAME: 'main',
  GITHUB_RUN_NUMBER: '42',
  GITHUB_RUN_ID: RUN_ID,
  GITHUB_ACTOR: 'ci-bot',
  GITHUB_REPOSITORY: 'LySyaoran/cicd-demo',
  GITHUB_SERVER_URL: 'https://github.com',
};

const outDir = await buildFixture(buildEnv);
const distIndex = await readFile(path.join(outDir, 'index.html'), 'utf8');
const buildInfoRaw = await readFile(path.join(outDir, 'build-info.json'), 'utf8');
const buildInfo = JSON.parse(buildInfoRaw);

test.after(async () => {
  await rm(outDir, { recursive: true, force: true });
});

test('build tạo đủ file output', async () => {
  const files = (await readdir(outDir)).sort();

  assert.ok(files.includes('index.html'));
  assert.ok(files.includes('build-info.json'));
  assert.ok(files.includes('.nojekyll'));
  assert.ok(files.includes('favicon.svg'));
  assert.ok(files.includes('assets'));

  const assets = (await readdir(path.join(outDir, 'assets'))).sort();
  assert.equal(assets.length, 2, `assets phải có đúng 2 file, đang có: ${assets.join(', ')}`);
  for (const asset of assets) {
    assert.match(asset, /^(?:app|styles)\.[0-9a-f]{8}\.(?:js|css)$/);
  }
});

test('.nojekyll rỗng để GitHub Pages không chạy Jekyll', async () => {
  const fileStat = await stat(path.join(outDir, '.nojekyll'));
  assert.equal(fileStat.size, 0);
});

test('HTML không còn placeholder nào', () => {
  const leftover = distIndex.match(/__[A-Z][A-Z0-9_]*__/g);
  assert.equal(leftover, null, `còn placeholder: ${leftover?.join(', ')}`);
});

test('HTML trỏ tới đúng asset đã hash', () => {
  assert.ok(
    distIndex.includes(`./assets/${buildInfo.assets.js.name}`),
    'không thấy script đã hash trong HTML',
  );
  assert.ok(
    distIndex.includes(`./assets/${buildInfo.assets.css.name}`),
    'không thấy stylesheet đã hash trong HTML',
  );
  assert.doesNotMatch(distIndex, /href="\.\/styles\.css"/);
  assert.doesNotMatch(distIndex, /src="\.\/app\.js"/);
});

test('metadata từ GitHub Actions được tiêm chính xác', () => {
  assert.equal(buildInfo.commit, SHA);
  assert.equal(buildInfo.shortCommit, 'a1b2c3d');
  assert.equal(buildInfo.branch, 'main');
  assert.equal(buildInfo.runNumber, '42');
  assert.equal(buildInfo.actor, 'ci-bot');
  assert.equal(buildInfo.repository, 'LySyaoran/cicd-demo');
  assert.equal(buildInfo.version, '1.0.0');
  assert.equal(buildInfo.runUrl, `https://github.com/LySyaoran/cicd-demo/actions/runs/${RUN_ID}`);

  assert.ok(distIndex.includes('a1b2c3d'), 'HTML phải hiển thị short SHA');
  assert.ok(distIndex.includes('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0'));
  assert.ok(distIndex.includes('#42'), 'HTML phải hiển thị run number');
});

test('builtAt là ISO timestamp hợp lệ và gần thời điểm hiện tại', () => {
  const builtAt = Date.parse(buildInfo.builtAt);
  assert.ok(Number.isFinite(builtAt), 'builtAt phải parse được');
  assert.ok(Math.abs(Date.now() - builtAt) < 5 * 60_000, 'builtAt phải là thời điểm hiện tại');
});

test('JS và CSS đã được minify nhỏ hơn source', async () => {
  const [appSource, formatSource, pipelineSource, cssSource] = await Promise.all([
    readFile(path.join(ROOT, 'src/app.js'), 'utf8'),
    readFile(path.join(ROOT, 'src/lib/format.mjs'), 'utf8'),
    readFile(path.join(ROOT, 'src/lib/pipeline.mjs'), 'utf8'),
    readFile(path.join(ROOT, 'src/styles.css'), 'utf8'),
  ]);

  const jsOut = await readFile(path.join(outDir, 'assets', buildInfo.assets.js.name), 'utf8');
  const cssOut = await readFile(path.join(outDir, 'assets', buildInfo.assets.css.name), 'utf8');

  assert.ok(
    jsOut.length < appSource.length + formatSource.length + pipelineSource.length,
    'bundle JS phải nhỏ hơn tổng source',
  );
  assert.ok(cssOut.length < cssSource.length, 'CSS minify phải nhỏ hơn source');

  assert.doesNotMatch(jsOut, /^\s*\/\*\*/m, 'bundle không nên còn block comment');
});

test('sizes trong build-info khớp dung lượng file thật', async () => {
  const jsStat = await stat(path.join(outDir, 'assets', buildInfo.assets.js.name));
  const cssStat = await stat(path.join(outDir, 'assets', buildInfo.assets.css.name));
  const htmlStat = await stat(path.join(outDir, 'index.html'));

  assert.equal(buildInfo.sizes.js, jsStat.size);
  assert.equal(buildInfo.sizes.css, cssStat.size);
  assert.equal(buildInfo.sizes.html, htmlStat.size);
});

test('HTML hiển thị tổng dung lượng bundle', () => {
  assert.match(distIndex, /Kích thước bundle[\s\S]{0,400}?\d+(?:\.\d+)?\s?(?:B|KB|MB)/);
});
