import { execFile } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

/**
 * Chạy scripts/build.mjs vào một thư mục tạm, tránh ghi đè dist/ của repo.
 * @param {Record<string, string>} [env]
 * @returns {Promise<string>} đường dẫn thư mục output
 */
export async function buildFixture(env = {}) {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'cicd-demo-build-'));

  await new Promise((resolve, reject) => {
    execFile(
      process.execPath,
      ['scripts/build.mjs'],
      {
        cwd: ROOT,
        env: { ...process.env, BUILD_OUT_DIR: outDir, ...env },
        timeout: 120_000,
      },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`build.mjs thất bại: ${error.message}\n${stdout}\n${stderr}`));
          return;
        }
        resolve(undefined);
      },
    );
  });

  return outDir;
}
