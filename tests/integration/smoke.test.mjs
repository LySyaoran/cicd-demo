import assert from 'node:assert/strict';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { buildFixture } from '../helpers/build.mjs';
import { startServer } from '../../scripts/serve.mjs';

const outDir = await buildFixture({ GITHUB_SHA: 'b'.repeat(40), GITHUB_REF_NAME: 'main' });
const buildInfo = JSON.parse(await readFile(path.join(outDir, 'build-info.json'), 'utf8'));
const site = await startServer({ root: outDir, port: 0 });

test.after(async () => {
  await site.close();
  await rm(outDir, { recursive: true, force: true });
});

test('GET / trả về 200, HTML và có nội dung site', async () => {
  const response = await fetch(`${site.url}/`);

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /^text\/html/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');

  const body = await response.text();
  assert.match(body, /Pipeline xanh/);
  assert.match(body, /a1b2c3d|b{7}/);
});

test('asset JS/CSS/Favicon mà HTML tham chiếu đều tải được', async () => {
  const html = await (await fetch(`${site.url}/index.html`)).text();
  const refs = [...html.matchAll(/(?:href|src)="\.\/([^"]+)"/g)].map((match) => match[1]);

  assert.ok(refs.length >= 3);

  for (const ref of refs) {
    const response = await fetch(`${site.url}/${ref}`);
    assert.equal(response.status, 200, `không tải được ${ref}`);
    const contentType = response.headers.get('content-type') ?? '';
    assert.notEqual(contentType, 'application/octet-stream', `${ref} bị sai content-type`);
  }

  const css = await fetch(`${site.url}/assets/${buildInfo.assets.css.name}`);
  assert.match(css.headers.get('content-type') ?? '', /text\/css/);

  const js = await fetch(`${site.url}/assets/${buildInfo.assets.js.name}`);
  assert.match(js.headers.get('content-type') ?? '', /javascript/);
});

test('build-info.json phục vụ được và đúng dữ liệu', async () => {
  const response = await fetch(`${site.url}/build-info.json`);

  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type') ?? '', /application\/json/);

  const payload = await response.json();
  assert.equal(payload.commit, 'b'.repeat(40));
  assert.equal(payload.branch, 'main');
});

test('HEAD / trả về header nhưng không có body', async () => {
  const response = await fetch(`${site.url}/`, { method: 'HEAD' });

  assert.equal(response.status, 200);
  assert.ok(Number(response.headers.get('content-length')) > 0);
  assert.equal(await response.text(), '');
});

test('đường dẫn không tồn tại trả về 404', async () => {
  const response = await fetch(`${site.url}/khong-ton-tai`);
  assert.equal(response.status, 404);
});

test('chặn path traversal', async () => {
  const response = await fetch(`${site.url}/..%2Fpackage.json`);
  assert.equal(response.status, 403);
});
