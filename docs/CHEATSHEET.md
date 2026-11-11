# Cheat sheet GitHub Actions — CI/CD demo

Tra cứu nhanh. Ví dụ đều lấy từ pipeline đã chạy xanh:
<https://github.com/LySyaoran/cicd-demo/actions/runs/43071645448>

---

## 1. Khung workflow tối thiểu

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '22'

jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm
      - run: npm ci
      - run: npm test
```

## 2. Trigger (`on:`)

| YAML | Khi nào chạy |
| --- | --- |
| `push: { branches: [main] }` | Push/merge vào main |
| `push: { tags: ['v*'] }` | Push tag bắt đầu bằng `v` |
| `pull_request: { branches: [main] }` | PR nhắm vào main |
| `workflow_dispatch:` | Bấm "Run workflow" |
| `schedule: [{ cron: '0 2 * * *' }]` | 02:00 UTC mỗi ngày |
| `release: { types: [published] }` | Khi publish release |

Lọc theo đường dẫn:

```yaml
  push:
    branches: [main]
    paths: ['src/**']
    paths-ignore: ['**.md', 'docs/**']
```

## 3. Job / step

```yaml
jobs:
  test:
    name: Test (Node ${{ matrix.node }})
    needs: [lint]                       # chờ lint xong
    if: github.event_name == 'push'     # điều kiện chạy
    runs-on: ubuntu-latest
    timeout-minutes: 10
    continue-on-error: false
    strategy:
      fail-fast: false
      matrix:
        node: ['20', '22']
        include:
          - node: '22'
            coverage: true
    outputs:
      version: ${{ steps.meta.outputs.version }}
    steps:
      - name: Bước có id
        id: meta
        env:
          FOO: bar
        run: echo "version=1.0.0" >> "$GITHUB_OUTPUT"
```

## 4. Biểu thức `${{ }}`

| Context | Ví dụ | Cho ra |
| --- | --- | --- |
| `github.sha` | `${{ github.sha }}` | commit SHA đầy đủ |
| `github.ref_name` | `main` | tên nhánh/tag ngắn |
| `github.ref` | `refs/heads/main` | ref đầy đủ |
| `github.run_number` | `4` | số run trong repo |
| `github.run_id` | `43071645448` | id run (dùng cho URL) |
| `github.repository` | `owner/repo` | slug repo |
| `github.server_url` | `https://github.com` | domain |
| `github.event_name` | `push` / `pull_request` | loại event |
| `github.actor` | `LySyaoran` | người kích hoạt |
| `github.token` | — | token của run |
| `env.X` | `${{ env.NODE_VERSION }}` | biến `env:` |
| `needs.job.result` | `success` | kết quả job phụ thuộc |
| `steps.id.outputs.X` | `${{ steps.d.outputs.page_url }}` | output step |
| `matrix.X` | `${{ matrix.node }}` | biến matrix |
| `secrets.X` | — | secret |
| `inputs.X` | — | input workflow_dispatch |
| `runner.os` | `Linux` | hệ điều hành runner |

Hàm: `contains(a,b)` · `startsWith(a,b)` · `endsWith(a,b)` · `format('{0}-{1}', a, b)` ·
`join(arr, ',')` · `toJSON(x)` · `fromJSON(s)` · `success()` · `failure()` · `always()` · `cancelled()`.

> `if:` không bắt buộc `${{ }}`; trong `run:`/`with:`/`env:` **bắt buộc** `${{ }}`.

## 5. Quyền (`permissions`)

| Quyền | Dùng cho |
| --- | --- |
| `contents: read` | checkout (mặc định nên có) |
| `contents: write` | push, release |
| `pages: write` | deploy Pages |
| `id-token: write` | OIDC |
| `packages: write` | GHCR |
| `pull-requests: write` | bot comment PR |

```yaml
permissions:            # cấp workflow
  contents: read

jobs:
  deploy:
    permissions:        # job-level THAY THẾ toàn bộ, không cộng dồn
      contents: read
      pages: write
      id-token: write
```

## 6. Action hay dùng

| Action | Việc |
| --- | --- |
| `actions/checkout@v7` | kéo code |
| `actions/setup-node@v7` | cài Node + cache (`cache: npm`) |
| `actions/upload-artifact@v7` | lưu artifact (`name`, `path`, `retention-days`, `if-no-files-found`) |
| `actions/download-artifact@v8` | lấy artifact (`name`, `path`) |
| `actions/configure-pages@v6` | đọc config Pages |
| `actions/upload-pages-artifact@v5` | đóng gói dist cho Pages (`path`) |
| `actions/deploy-pages@v5` | deploy Pages, output `page_url` |
| `actions/cache@v4` | cache thư mục bất kỳ |
| `docker/build-push-action@v6` | build & push image |
| `docker/login-action@v3` | login registry |

## 7. Workflow commands (in trong `run:`)

| Lệnh | Tác dụng |
| --- | --- |
| `echo "::error title=T::msg"` | annotation đỏ |
| `echo "::warning::msg"` | annotation vàng |
| `echo "::notice::msg"` | xanh |
| `echo "::group::X"` … `echo "::endgroup::"` | gấp log |
| `echo "A=1" >> "$GITHUB_ENV"` | env cho step sau |
| `echo "k=v" >> "$GITHUB_OUTPUT"` | output cho step/job |
| `echo "..." >> "$GITHUB_STEP_SUMMARY"` | báo cáo Markdown ở tab Summary |

## 8. Lệnh local hữu ích

```bash
npm ci                 # cài đúng lockfile (như CI)
npm run verify         # lint + test + build
npx prettier --write . # sửa format
npx eslint . --fix     # sửa lỗi lint
actionlint             # kiểm tra workflow (cài: choco/scoop/winget hoặc tải binary)
gh run list            # (cần gh CLI) xem run
gh run watch           # theo dõi run đang chạy
gh run view <id> --log-failed
act -j lint            # chạy workflow local bằng Docker (tuỳ chọn)
```

## 9. Exit code & shell

```yaml
      - run: |
          set -euo pipefail       # dừng ngay khi lỗi, biến rỗng = lỗi, lỗi giữa pipe cũng fail
          npm run build
          test -f dist/index.html
```

| Cờ | Nghĩa |
| --- | --- |
| `-e` | lỗi là dừng |
| `-u` | biến chưa khai báo = lỗi |
| `-o pipefail` | lỗi trong pipe không bị nuốt |

## 10. Status thường gặp

| Chỗ hiện | Nghĩa |
| --- | --- |
| `queued` / `Waiting for a runner` | đang xếp hàng |
| `in_progress` | đang chạy |
| `completed/success` | xanh |
| `completed/failure` | đỏ |
| `skipped` | không chạy do `if`/`needs` |
| `cancelled` | bị huỷ (concurrency/re-run) |

## 11. URL quan trọng

| Việc | URL |
| --- | --- |
| Actions repo | `https://github.com/<owner>/<repo>/actions` |
| 1 run | `https://github.com/<owner>/<repo>/actions/runs/<run_id>` |
| Badge | `https://github.com/<owner>/<repo>/actions/workflows/ci-cd.yml/badge.svg` |
| Pages | `https://<owner>.github.io/<repo>/` |
| Bật Pages | `https://github.com/<owner>/<repo>/settings/pages` |
| Environments | `https://github.com/<owner>/<repo>/deployments/activity_log` |
