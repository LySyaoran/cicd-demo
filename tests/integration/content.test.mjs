import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

import { ROOT } from '../helpers/build.mjs';

const SRC = path.join(ROOT, 'src');
const html = await readFile(path.join(SRC, 'index.html'), 'utf8');
const css = await readFile(path.join(SRC, 'styles.css'), 'utf8');
const appJs = await readFile(path.join(SRC, 'app.js'), 'utf8');

test('HTML có cấu trúc cơ bản đúng chuẩn', () => {
  assert.match(html, /^<!doctype html>/i);
  assert.match(html, /<html lang="vi"/);
  assert.match(html, /<meta charset="utf-8" \/>/);
  assert.match(html, /name="viewport"/);
  assert.match(html, /name="description"/);
  assert.match(html, /<title>[^<]+<\/title>/);
});

test('HTML chỉ có đúng một thẻ h1 và đủ landmark', () => {
  assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1);
  assert.match(html, /<header class="site-header">/);
  assert.match(html, /<main id="main">/);
  assert.match(html, /<footer class="site-footer">/);
  assert.match(html, /class="skip-link"/);
});

test('mọi anchor nội bộ đều trỏ tới id tồn tại', () => {
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
  const anchors = [...html.matchAll(/href="#([^"]+)"/g)].map((match) => match[1]);

  assert.ok(anchors.length > 0, 'phải có ít nhất một anchor nội bộ');
  for (const anchor of anchors) {
    assert.ok(ids.has(anchor), `anchor #${anchor} không có id tương ứng`);
  }
});

test('không có asset ngoài (build phải offline được)', () => {
  assert.doesNotMatch(html, /<(?:script|link)[^>]+(?:src|href)="https?:\/\//i);
  assert.doesNotMatch(css, /@import\s+url\(\s*["']?https?:/i);
});

test('mọi tham chiếu file cục bộ đều tồn tại trong src/', async () => {
  const refs = [...html.matchAll(/(?:href|src)="\.\/([^"#?]+)"/g)].map((match) => match[1]);
  assert.ok(refs.length >= 3, `phải tham chiếu ít nhất 3 file, đang có ${refs.length}`);

  for (const ref of refs) {
    const fileStat = await stat(path.join(SRC, ref));
    assert.ok(fileStat.isFile(), `không tìm thấy src/${ref}`);
  }
});

test('không dùng inline event handler (CSP-friendly)', () => {
  assert.doesNotMatch(html, /\son(?:click|load|error|submit|change)=/i);
});

test('chỉ nạp đúng một module script', () => {
  const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((match) => match[0]);
  assert.equal(scripts.length, 1);
  assert.match(scripts[0], /type="module"/);
  assert.match(scripts[0], /src="\.\/app\.js"/);
});

test('HTML giữ đủ placeholder để build tiêm metadata', () => {
  const placeholders = [
    '__BUILD_TIME__',
    '__COMMIT_SHA__',
    '__SHORT_SHA__',
    '__COMMIT_URL__',
    '__BRANCH__',
    '__RUN_NUMBER__',
    '__RUN_URL__',
    '__REPO_URL__',
    '__VERSION__',
    '__ACTOR__',
    '__TOTAL_SIZE__',
  ];

  for (const placeholder of placeholders) {
    assert.ok(html.includes(placeholder), `thiếu placeholder ${placeholder}`);
  }
});

test('CSS có design token cho cả hai theme và tôn trọng reduced motion', () => {
  assert.match(css, /:root\s*\{/);
  assert.match(css, /\[data-theme='light'\]/);
  assert.match(css, /--accent:/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /@media \(max-width: 720px\)/);
});

test('app.js import logic từ lib để test được', () => {
  assert.match(appJs, /from '\.\/lib\/format\.mjs'/);
  assert.match(appJs, /from '\.\/lib\/pipeline\.mjs'/);
  assert.doesNotMatch(appJs, /console\.log\(/);
});
