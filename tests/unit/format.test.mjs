import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatBytes,
  formatDateTime,
  formatRelativeTime,
  shortenSha,
} from '../../src/lib/format.mjs';

test('shortenSha rút gọn đúng độ dài', () => {
  const sha = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0';
  assert.equal(shortenSha(sha), 'a1b2c3d');
  assert.equal(shortenSha(sha, 10), 'a1b2c3d4e5');
  assert.equal(shortenSha('abc', 7), 'abc');
  assert.equal(shortenSha('  abcdef  '), 'abcdef');
});

test('shortenSha xử lý đầu vào rỗng hoặc không hợp lệ', () => {
  assert.equal(shortenSha(''), '');
  assert.equal(shortenSha('   '), '');
  assert.equal(shortenSha(null), '');
  assert.equal(shortenSha(123), '');
});

test('formatDateTime trả về chuỗi ổn định theo timezone', () => {
  const iso = '2026-11-12T03:30:00.000Z';
  assert.equal(formatDateTime(iso, { locale: 'en-GB', timeZone: 'UTC' }), '12 Nov 2026, 03:30');
  assert.match(formatDateTime(iso), /2026/);
});

test('formatDateTime trả về dấu gạch cho giá trị không parse được', () => {
  assert.equal(formatDateTime('không-phải-ngày'), '—');
});

test('formatRelativeTime tính đúng các mốc', () => {
  const now = Date.parse('2026-11-12T10:00:00.000Z');
  const before = (ms) => new Date(now - ms).toISOString();

  assert.equal(formatRelativeTime(before(30_000), now), 'vừa xong');
  assert.equal(formatRelativeTime(before(5 * 60_000), now), '5 phút trước');
  assert.equal(formatRelativeTime(before(3 * 60 * 60_000), now), '3 giờ trước');
  assert.equal(formatRelativeTime(before(2 * 24 * 60 * 60_000), now), '2 ngày trước');
  assert.equal(formatRelativeTime(before(60 * 24 * 60 * 60_000), now), 'rất lâu trước');
  assert.equal(formatRelativeTime(new Date(now + 5 * 60_000).toISOString(), now), '5 phút nữa');
});

test('formatBytes chuyển đổi đơn vị', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatBytes(1024), '1.0 KB');
  assert.equal(formatBytes(1536), '1.5 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5.0 MB');
  assert.equal(formatBytes(2.5 * 1024 * 1024 * 1024, 2), '2.50 GB');
});

test('formatBytes trả về dấu gạch cho giá trị không hợp lệ', () => {
  assert.equal(formatBytes(-1), '—');
  assert.equal(formatBytes(Number.NaN), '—');
  assert.equal(formatBytes(undefined), '—');
});
