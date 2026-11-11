/**
 * Máy trạng thái thuần cho phần mô phỏng pipeline trên trang.
 * Tách khỏi DOM để unit test được logic, không cần jsdom.
 */

/** @typedef {'idle' | 'active' | 'done'} StepState */

/**
 * Trạng thái của từng bước tại một "con trỏ" thời gian.
 * @param {number} total số bước
 * @param {number} cursor bước đang chạy (0..total-1); total nghĩa là đã xong hết
 * @returns {StepState[]}
 */
export function pipelineStates(total, cursor) {
  if (!Number.isInteger(total) || total < 1) {
    throw new RangeError('total phải là số nguyên >= 1');
  }
  if (!Number.isInteger(cursor) || cursor < 0 || cursor > total) {
    throw new RangeError('cursor phải nằm trong khoảng 0..total');
  }

  return Array.from({ length: total }, (_, index) => {
    if (index < cursor) return 'done';
    if (index === cursor) return 'active';
    return 'idle';
  });
}

const WEIGHT = { idle: 0, active: 50, done: 100 };

/**
 * Phần trăm hoàn thành (bước đang chạy tính 50%).
 * @param {StepState[]} states
 * @returns {number} 0..100, làm tròn
 */
export function progressPercent(states) {
  if (!Array.isArray(states) || states.length === 0) return 0;
  const total = states.reduce((sum, state) => sum + (WEIGHT[state] ?? 0), 0);
  return Math.round(total / states.length);
}

/**
 * Nhãn tiếng Việt mô tả trạng thái pipeline.
 * @param {StepState[]} states
 * @returns {string}
 */
export function pipelineSummary(states) {
  if (!Array.isArray(states) || states.length === 0) return 'Chưa có bước nào.';

  const done = states.filter((state) => state === 'done').length;
  const active = states.some((state) => state === 'active');

  if (done === states.length) return `Hoàn tất · ${done}/${states.length} bước xanh`;
  if (active) return `Đang chạy bước ${done + 1}/${states.length}…`;
  return `Sẵn sàng · 0/${states.length} bước`;
}

/**
 * Nhãn ngắn cho một bước.
 * @param {StepState} state
 * @returns {string}
 */
export function stepLabel(state) {
  if (state === 'done') return 'passed';
  if (state === 'active') return 'running';
  return 'idle';
}
