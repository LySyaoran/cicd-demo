# CI/CD Demo — GitHub Actions → GitHub Pages

Pipeline CI/CD **thật**, chạy hoàn toàn trên GitHub Actions, deploy lên GitHub Pages — **không cần server riêng**.

Trang live hiển thị chính `commit SHA`, `run number`, `thời điểm build` do pipeline tiêm vào lúc build, nên bạn có thể kiểm chứng bằng mắt rằng nó được deploy tự động chứ không phải chỉnh tay.

[![CI/CD](https://github.com/LySyaoran/cicd-demo/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/LySyaoran/cicd-demo/actions/workflows/ci-cd.yml)
[![Live demo](https://img.shields.io/badge/demo-live-2ea44f)](https://lysyaoran.github.io/cicd-demo/)
[![Node](https://img.shields.io/badge/node-%3E%3D20-339933)](https://nodejs.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

## Pipeline làm gì?

```
push / pull_request / workflow_dispatch
        │
        ▼
┌────────────┐   ┌─────────────────────┐   ┌──────────────┐   ┌──────────────────┐   ┌───────────┐
│ 1. Lint    │──►│ 2. Test             │──►│ 3. Build     │──►│ 4. Deploy        │──►│ 5. Report │
│ ESLint     │   │ Node 20 & 22 matrix │   │ esbuild      │   │ GitHub Pages     │   │ summary   │
│ html-valid │   │ unit + integration  │   │ hash + inject│   │ (chỉ trên main)  │   │ toàn bộ   │
│ Prettier   │   │ + smoke HTTP        │   │ artifact     │   │ OIDC, env        │   │ job       │
└────────────┘   └─────────────────────┘   └──────┬───────┘   └──────────────────┘   └───────────┘
                                                  │
                                            artifact site-dist
```

Chi tiết từng job:

| # | Job | Chạy khi | Việc chính | Kiểm chứng |
| - | --- | --- | --- | --- |
| 1 | `lint` | mọi lần chạy | `eslint`, `html-validate`, `prettier --check` | log của 3 step |
| 2 | `test` | sau lint | `node --test` trên **Node 20 & 22** (37 test): unit, test nội dung HTML, build thật vào tmp, smoke test HTTP bằng server tự viết | 2 check xanh trong tab Tests |
| 3 | `build` | sau test | minify JS/CSS bằng esbuild, gắn hash nội dung vào tên file, tiêm metadata, upload artifact `site-dist` | artifact tải được ở trang run |
| 4 | `deploy` | chỉ `main` | tải artifact, `upload-pages-artifact`, deploy bằng OIDC | URL Pages + environment `github-pages` |
| 5 | `report` | `always()` | bảng kết quả 4 job vào GitHub Step Summary | tab Summary của run |

> PR vào `main` sẽ chạy job 1 → 3, **không deploy**. Chỉ push/merge vào `main` mới deploy thật.

## Cấu trúc

```
.
├── .github/
│   ├── dependabot.yml          # tự cập nhật npm + actions hằng tuần
│   └── workflows/
│       └── ci-cd.yml           # pipeline 5 job
├── src/
│   ├── index.html              # trang demo (có placeholder __COMMIT_SHA__ ...)
│   ├── styles.css              # design token dark/light, responsive
│   ├── app.js                  # theme toggle, copy SHA, mô phỏng pipeline
│   ├── favicon.svg
│   └── lib/
│       ├── format.mjs          # format ngày giờ, dung lượng (pure)
│       └── pipeline.mjs        # state machine của phần mô phỏng (pure)
├── scripts/
│   ├── build.mjs               # build + tiêm metadata + step summary
│   └── serve.mjs               # static server (dev/preview/smoke test)
├── tests/
│   ├── helpers/build.mjs       # build vào thư mục tạm
│   ├── unit/                   # test logic thuần
│   └── integration/            # test HTML/CSS, build output, HTTP smoke
├── docs/GITHUB-SETUP.md        # dựng repo + PAT + Pages từ đầu
├── package.json
└── eslint / prettier / html-validate config
```

## Chạy local

```bash
npm ci              # cài dependencies theo lockfile (giống CI)
npm run lint        # ESLint + html-validate + Prettier
npm test            # 37 test (unit + integration + smoke HTTP)
npm run build       # build ra dist/
npm run preview     # build rồi mở http://127.0.0.1:4173
npm run verify      # lint + test + build (đúng chuỗi CI chạy)
npm run dev         # serve thẳng src/ ở :5173 (không cần build)
```

Build khi chạy local sẽ lấy commit/branch từ git; trên Actions nó lấy `GITHUB_SHA`, `GITHUB_RUN_NUMBER`, `GITHUB_REPOSITORY`... để tiêm vào trang và `dist/build-info.json`.

## Deploy không cần server

GitHub Pages là static hosting miễn phí, không cần VPS/nginx. Pipeline đẩy artifact lên đó qua 3 action chính thức:

- `actions/configure-pages@v5` — cấu hình/bật Pages (`enablement: true`)
- `actions/upload-pages-artifact@v3` — đóng gói `dist/`
- `actions/deploy-pages@v4` — deploy, trả về `page_url`

Điều kiện: repo **public** (Pages cho repo private yêu cầu GitHub Pro/Team), Pages source = **GitHub Actions**.

### Khi nào cần server thật?

Demo này chỉ có frontend tĩnh. Nếu sau này thêm API/database thì pipeline vẫn dùng được, chỉ đổi job `deploy`:

| Nhu cầu | Cách deploy hợp lý |
| --- | --- |
| Static site (như demo này) | **GitHub Pages** — 0 đồng, 0 server |
| Container image | Push lên GHCR/Docker Hub rồi deploy lên VPS/Fly.io/Render/Railway |
| Cần chạy đúng máy nội bộ | **Self-hosted runner** trên chính máy bạn, job `deploy` chạy `docker compose up -d` |

## Bảo mật

- `permissions: contents: read` mặc định; job `deploy` mới nâng lên `pages: write` + `id-token: write`.
- Deploy Pages dùng **OIDC** (`id-token`), không cần lưu token dài hạn trong secrets.
- `concurrency` chống deploy chồng nhau (`group: pages`).
- Không có secret nào trong repo; workflow chạy được cả trên fork/PR.

## Kiểm chứng "pipeline chạy thật"

1. Vào **Actions** → run mới nhất: thấy 5 job xanh.
2. Tải artifact `site-dist` → thấy `build-info.json` chứa đúng commit vừa push.
3. Mở URL Pages → phần **Bản build đang chạy** hiển thị đúng commit/run đó.
4. Sửa một chữ trong `src/index.html`, push → sau ~1 phút trang live đổi theo. Đây là bằng chứng mạnh nhất.

## Troubleshooting

| Lỗi | Nguyên nhân | Cách xử lý |
| --- | --- | --- |
| `Get Pages site failed` | Pages chưa bật hoặc source không phải GitHub Actions | Settings → Pages → Source: **GitHub Actions**, hoặc để `configure-pages` bật hộ (`enablement: true`) |
| `Resource not accessible by integration` | Thiếu quyền trong workflow | Kiểm tra `permissions` của job deploy |
| Deploy bị `skipped` | Không phải push lên `main` (PR/branch khác) | Đúng thiết kế; merge vào `main` để deploy |
| `npm ci` fail | `package-lock.json` lệch `package.json` | Chạy `npm install` rồi commit lại lockfile |
| Trang Pages 404 | Chưa có `index.html` ở root artifact | Build ghi đè `.nojekyll`; kiểm tra artifact `site-dist` |

Xem thêm: [docs/GITHUB-SETUP.md](docs/GITHUB-SETUP.md).

## License

MIT — xem [LICENSE](LICENSE).
