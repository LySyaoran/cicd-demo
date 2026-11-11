/**
 * Các hàm định dạng thuần (pure) — không đụng DOM nên test trực tiếp bằng node:test.
 * Mọi hàm nhận `now`/`timeZone` tường minh để test không phụ thuộc đồng hồ máy.
 */

const DEFAULT_TIME_ZONE = 'Asia/Ho_Chi_Minh';

/**
 * Rút gọn commit SHA.
 * @param {string} sha
 * @param {number} [length]
 * @returns {string}
 */
export function shortenSha(sha, length = 7) {
  if (typeof sha !== 'string') return '';
  const clean = sha.trim();
  if (clean.length === 0) return '';
  const size = Math.max(1, Math.min(length, clean.length));
  return clean.slice(0, size);
}

/**
 * Định dạng ngày giờ theo locale, mặc định giờ Việt Nam.
 * @param {string | number | Date} value
 * @param {{ locale?: string, timeZone?: string }} [options]
 * @returns {string}
 */
export function formatDateTime(value, options = {}) {
  const { locale = 'vi-VN', timeZone = DEFAULT_TIME_ZONE } = options;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  try {
    return new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone,
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Thời gian tương đối bằng tiếng Việt.
 * @param {string | number | Date} value
 * @param {number} [now]
 * @returns {string}
 */
export function formatRelativeTime(value, now = Date.now()) {
  const date = value instanceof Date ? value : new Date(value);
  const time = date.getTime();
  if (Number.isNaN(time)) return '—';

  const diff = now - time;
  const abs = Math.abs(diff);
  const suffix = diff >= 0 ? 'trước' : 'nữa';

  if (abs < MINUTE) return 'vừa xong';
  if (abs < HOUR) {
    const minutes = Math.round(abs / MINUTE);
    return `${minutes} phút ${suffix}`;
  }
  if (abs < DAY) {
    const hours = Math.round(abs / HOUR);
    return `${hours} giờ ${suffix}`;
  }
  if (abs < 30 * DAY) {
    const days = Math.round(abs / DAY);
    return `${days} ngày ${suffix}`;
  }
  return diff >= 0 ? 'rất lâu trước' : 'trong tương lai';
}

/**
 * Định dạng kích thước byte thành chuỗi dễ đọc.
 * @param {number} bytes
 * @param {number} [decimals]
 * @returns {string}
 */
export function formatBytes(bytes, decimals = 1) {
  if (typeof bytes !== 'number' || Number.isNaN(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;

  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(decimals)} ${units[unitIndex]}`;
}
