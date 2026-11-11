import { formatDateTime, formatRelativeTime } from './lib/format.mjs';
import { pipelineStates, pipelineSummary, stepLabel } from './lib/pipeline.mjs';

const THEME_KEY = 'cicd-demo:theme';
const STEP_DELAY_MS = 780;
const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const storage = {
  get(key) {
    try {
      return window.localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* trình duyệt chặn localStorage (chế độ riêng tư) — bỏ qua */
    }
  },
};

/* ------------------------------------------------------------------ */
/* Giao diện sáng / tối                                                */
/* ------------------------------------------------------------------ */

function resolveTheme() {
  const fromUrl = new URLSearchParams(window.location.search).get('theme');
  if (fromUrl === 'light' || fromUrl === 'dark') return fromUrl;

  const stored = storage.get(THEME_KEY);
  if (stored === 'light' || stored === 'dark') return stored;

  // Mặc định dark cho đúng "chất dev"; người dùng có thể bấm nút để đổi.
  return 'dark';
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const button = document.getElementById('theme-toggle');
  if (!button) return;

  const isLight = theme === 'light';
  button.setAttribute('aria-pressed', String(isLight));
  button.setAttribute(
    'aria-label',
    isLight ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng',
  );

  const glyph = button.querySelector('.icon-btn-glyph');
  if (glyph) glyph.textContent = isLight ? '☀' : '☾';
}

/* ------------------------------------------------------------------ */
/* Metadata build được tiêm lúc build                                   */
/* ------------------------------------------------------------------ */

function hydrateRelativeTimes() {
  document.querySelectorAll('[data-relative-time]').forEach((element) => {
    element.textContent = formatRelativeTime(element.dataset.relativeTime);
  });
}

function hydrateBuildInfo() {
  document.querySelectorAll('[data-build-time]').forEach((element) => {
    element.textContent = formatDateTime(element.dataset.buildTime);
  });

  hydrateRelativeTimes();
}

/* ------------------------------------------------------------------ */
/* Toast + copy commit SHA                                             */
/* ------------------------------------------------------------------ */

const toast = document.getElementById('toast');
let toastTimer = 0;

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.hidden = false;
  window.requestAnimationFrame(() => toast.classList.add('is-visible'));

  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    toast.classList.remove('is-visible');
    window.setTimeout(() => {
      toast.hidden = true;
    }, 220);
  }, 2200);
}

function setupCopyCommit() {
  const button = document.getElementById('copy-sha');
  const link = document.getElementById('commit-link');
  if (!button || !link) return;

  button.addEventListener('click', async () => {
    const sha = link.dataset.sha ?? '';
    try {
      await navigator.clipboard.writeText(sha);
      showToast(`Đã copy ${sha.slice(0, 7)}`);
    } catch {
      showToast('Trình duyệt chặn clipboard — bạn copy thủ công nhé.');
    }
  });
}

/* ------------------------------------------------------------------ */
/* Mô phỏng pipeline (logic thuần nằm ở ./lib/pipeline.mjs)             */
/* ------------------------------------------------------------------ */

const steps = Array.from(document.querySelectorAll('#pipeline-steps [data-step]'));
const replayButton = document.getElementById('replay');
const statusElement = document.getElementById('pipeline-status');
let animating = false;

function renderPipeline(cursor) {
  const states = pipelineStates(steps.length, cursor);

  steps.forEach((step, index) => {
    const state = states[index];
    step.dataset.state = state;
    const badge = step.querySelector('[data-status]');
    if (badge) badge.textContent = stepLabel(state);
  });

  if (statusElement) statusElement.textContent = pipelineSummary(states);
}

const sleep = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

async function runPipeline() {
  if (animating || steps.length === 0) return;

  animating = true;
  if (replayButton) replayButton.disabled = true;

  try {
    const delay = prefersReducedMotion.matches ? 0 : STEP_DELAY_MS;
    for (let cursor = 0; cursor <= steps.length; cursor += 1) {
      renderPipeline(cursor);
      if (cursor < steps.length) await sleep(delay);
    }
  } finally {
    animating = false;
    if (replayButton) replayButton.disabled = false;
  }
}

/* ------------------------------------------------------------------ */
/* Khởi động                                                           */
/* ------------------------------------------------------------------ */

function init() {
  applyTheme(resolveTheme());
  hydrateBuildInfo();
  setupCopyCommit();

  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    const current = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    const next = current === 'light' ? 'dark' : 'light';
    storage.set(THEME_KEY, next);
    applyTheme(next);
  });

  replayButton?.addEventListener('click', () => {
    void runPipeline();
  });

  if (steps.length > 0) {
    renderPipeline(0);
    if (prefersReducedMotion.matches) {
      renderPipeline(steps.length);
    } else {
      window.setTimeout(() => {
        void runPipeline();
      }, 600);
    }
  }

  window.setInterval(hydrateRelativeTimes, 30_000);
}

init();
