import assert from 'node:assert/strict';
import test from 'node:test';

import {
  pipelineStates,
  pipelineSummary,
  progressPercent,
  stepLabel,
} from '../../src/lib/pipeline.mjs';

test('pipelineStates đánh dấu bước đang chạy và các bước đã xong', () => {
  assert.deepEqual(pipelineStates(3, 0), ['active', 'idle', 'idle']);
  assert.deepEqual(pipelineStates(3, 1), ['done', 'active', 'idle']);
  assert.deepEqual(pipelineStates(3, 3), ['done', 'done', 'done']);
});

test('pipelineStates từ chối tham số không hợp lệ', () => {
  assert.throws(() => pipelineStates(0, 0), RangeError);
  assert.throws(() => pipelineStates(3, -1), RangeError);
  assert.throws(() => pipelineStates(3, 4), RangeError);
  assert.throws(() => pipelineStates(3.5, 1), RangeError);
  assert.throws(() => pipelineStates(3, 1.5), RangeError);
});

test('progressPercent tính phần trăm có trọng số', () => {
  assert.equal(progressPercent([]), 0);
  assert.equal(progressPercent(['idle', 'idle', 'idle']), 0);
  assert.equal(progressPercent(['done', 'active', 'idle']), 50);
  assert.equal(progressPercent(['done', 'done', 'active']), 83);
  assert.equal(progressPercent(['done', 'done', 'done']), 100);
});

test('pipelineSummary mô tả trạng thái bằng tiếng Việt', () => {
  assert.equal(pipelineSummary(['idle', 'idle']), 'Sẵn sàng · 0/2 bước');
  assert.equal(pipelineSummary(['done', 'active', 'idle']), 'Đang chạy bước 2/3…');
  assert.equal(pipelineSummary(['done', 'done', 'done']), 'Hoàn tất · 3/3 bước xanh');
  assert.equal(pipelineSummary([]), 'Chưa có bước nào.');
});

test('stepLabel chuyển trạng thái thành nhãn hiển thị', () => {
  assert.equal(stepLabel('idle'), 'idle');
  assert.equal(stepLabel('active'), 'running');
  assert.equal(stepLabel('done'), 'passed');
  assert.equal(stepLabel('không-tồn-tại'), 'idle');
});
