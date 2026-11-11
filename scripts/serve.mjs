#!/usr/bin/env node
/**
 * Static file server tối giản, chỉ dùng thư viện chuẩn Node.
 * - `npm run dev`  → serve thư mục src (không cần build)
 * - `npm run preview` → build rồi serve dist
 * - test HTTP smoke import startServer() để kiểm tra dist thật.
 */

import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function contentTypeFor(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

/**
 * @param {{ root: string, port?: number, host?: string }} options
 * @returns {Promise<{ server: import('node:http').Server, port: number, url: string, close: () => Promise<void> }>}
 */
export function startServer({ root, port = 0, host = '127.0.0.1' }) {
  const baseDir = path.resolve(root);

  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`);
      const pathname = decodeURIComponent(url.pathname);

      // Chặn path traversal.
      const relative = pathname.replace(/^\/+/, '');
      let filePath = path.resolve(baseDir, relative);
      if (filePath !== baseDir && !filePath.startsWith(baseDir + path.sep)) {
        response.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('403 Forbidden');
        return;
      }

      let fileStat;
      try {
        fileStat = await stat(filePath);
      } catch {
        fileStat = null;
      }

      if (!fileStat) {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('404 Not Found');
        return;
      }

      if (fileStat.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
        try {
          fileStat = await stat(filePath);
        } catch {
          response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
          response.end('404 Not Found');
          return;
        }
      }

      const headers = {
        'content-type': contentTypeFor(filePath),
        'content-length': String(fileStat.size),
        'cache-control': 'no-cache',
        'x-content-type-options': 'nosniff',
      };

      if (request.method === 'HEAD') {
        response.writeHead(200, headers);
        response.end();
        return;
      }

      response.writeHead(200, headers);
      createReadStream(filePath).pipe(response);
    } catch (error) {
      response.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
      response.end(`500 ${error instanceof Error ? error.message : 'Internal Server Error'}`);
    }
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      const address = server.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      resolve({
        server,
        port: actualPort,
        url: `http://${host}:${actualPort}`,
        close: () =>
          new Promise((closeResolve, closeReject) => {
            server.close((error) => (error ? closeReject(error) : closeResolve()));
          }),
      });
    });
  });
}

const isDirectRun =
  process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectRun) {
  const root = process.argv[2] ?? 'dist';
  const port = Number(process.argv[3] ?? 4173);

  startServer({ root, port })
    .then(({ url }) => {
      console.log(`▶ Serving ${path.resolve(root)} tại ${url}`);
    })
    .catch((error) => {
      console.error(`✖ Không khởi động được server: ${error.message}`);
      process.exitCode = 1;
    });
}
