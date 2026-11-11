# Tự xây dựng CI/CD pipeline với GitHub Actions — từ con số 0

> Tài liệu học tập dựa **100% trên một pipeline thật đã chạy xanh**:
>
> - Repo: <https://github.com/LySyaoran/cicd-demo>
> - Trang live: <https://lysyaoran.github.io/cicd-demo/>
> - Run xanh: <https://github.com/LySyaoran/cicd-demo/actions/runs/43071645448>
>
> Mọi con số, thông báo lỗi và kết quả trong tài liệu này đều lấy từ lần chạy thật đó,
> không phải ví dụ giả định. Bạn có thể mở repo để đối chiếu từng file khi đọc.

---

## Mục lục

- [0. Cách dùng tài liệu](#0-cách-dùng-tài-liệu)
- [1. Nền tảng: CI/CD và GitHub Actions là gì](#1-nền-tảng-cicd-và-github-actions-là-gì)
- [2. Bản đồ repo: file nào làm gì](#2-bản-đồ-repo-file-nào-làm-gì)
- [3. Giải phẫu workflow `ci-cd.yml`](#3-giải-phẫu-workflow-ci-cdyml)
- [4. Nguyên tắc "local-first"](#4-nguyên-tắc-local-first)
- [5. Build system: `scripts/build.mjs`](#5-build-system-scriptsbuildmjs)
- [6. Chiến lược test: 37 test che lỗi gì](#6-chiến-lược-test-37-test-che-lỗi-gì)
- [7. Deploy GitHub Pages: cơ chế và quyền](#7-deploy-github-pages-cơ-chế-và-quyền)
- [8. Debug pipeline như người thật việc thật](#8-debug-pipeline-như-người-thật-việc-thật)
- [9. Bảo mật và vận hành](#9-bảo-mật-và-vận-hành)
- [10. Mở rộng: khi bạn thật sự cần server](#10-mở-rộng-khi-bạn-thật-sự-cần-server)
- [11. Checklist tự dựng từ số 0](#11-checklist-tự-dựng-từ-số-0)
- [12. Bài tập](#12-bài-tập)
- [13. Phụ lục: thuật ngữ, FAQ, tra cứu](#13-phụ-lục-thuật-ngữ-faq-tra-cứu)
- [14. Phụ lục B: nguyên liệu copy-paste](#14-phụ-lục-b-nguyên-liệu-copy-paste)

---

## 0. Cách dùng tài liệu

### 0.1. Tài liệu dành cho ai

Cho người **biết viết code cơ bản** (HTML/CSS/JS hoặc Node.js) nhưng **chưa từng dựng CI/CD**.
Không cần biết Docker, không cần server, không cần YAML trước đó.

> **Cần biết trước (tối thiểu):** Git cơ bản và có tài khoản GitHub.
> Đủ dùng nếu bạn làm được 5 lệnh này:
>
> ```bash
> git clone <url>          # tải repo về máy
> git switch -c ten-nhanh  # tạo nhánh mới
> git add -A && git commit -m "mo ta"   # lưu thay đổi
> git push                 # đẩy lên GitHub
> ```
>
> Chưa biết Git? Dành 20 phút học 5 lệnh trên trước; phần còn lại của tài liệu giả định bạn đã biết.
> Nếu dùng **Windows PowerShell 5.1** (mặc định của Windows), đọc thêm hộp ở §4.2 về `npm.cmd`.

### 0.2. Kết quả bạn sẽ tự làm được sau khi đọc hết

- Tự dựng một repo có pipeline: `lint → test → build → deploy → báo cáo` chạy trên GitHub.
- Hiểu **vì sao** từng dòng trong workflow tồn tại — không copy-paste mù.
- Tự debug khi pipeline đỏ, thay vì đoán mò.
- Biết khi nào cần nâng cấp lên server/container thật và nâng cấp thế nào.

### 0.3. Bức tranh tổng thể (nhìn 1 lần là hiểu)

```
        BẠN PUSH CODE
             │
             ▼
   ┌──────────────────────────────────────────────────────────┐
   │ GitHub Actions (máy ảo ubuntu-latest, tạo mới mỗi job)   │
   │                                                          │
   │  1. LINT      2. TEST       3. BUILD       4. DEPLOY     │
   │  eslint       Node 20/22    esbuild        GitHub Pages  │
   │  html-validate 37 test      hash + inject  OIDC + smoke  │
   │  prettier     unit/smoke    artifact ──┐   verify live   │
   │                                        │                 │
   │                                        └──────────────►  │
   │  5. REPORT: gom kết quả 4 job vào Step Summary            │
   └──────────────────────────────────────────────────────────┘
             │
             ▼
   https://<user>.github.io/cicd-demo/   ← người dùng mở được
```

| Từ trong sơ đồ | Nghĩa ngắn (giải thích kỹ ở mục) |
| --- | --- |
| **artifact** | file/thư mục được đóng gói để chuyển từ job này sang job khác (§3.9) |
| **hash + inject** | tên file gắn mã hash nội dung; chèn commit/run/thời gian vào HTML lúc build (§5.2) |
| **OIDC** | cách lấy token ngắn hạn để deploy, không cần lưu secret (§7.4) |
| **smoke** | tự gọi thử URL vừa deploy để chắc nó thật sự chạy, không chỉ "API báo xong" (§7.8) |
| **Step Summary** | báo cáo Markdown hiện ở tab Summary của run (§3.11) |

Nguyên tắc cốt lõi của cả pipeline:

> **Không có gì được deploy nếu chưa qua lint + test + build.**
> Và **mỗi bản deploy đều mang dấu vân tay** (commit SHA, run number, thời điểm build)
> để chứng minh nó do máy tạo ra, không phải do ai đó copy tay lên.

### 0.4. Cách đọc hiệu quả

| Bạn đang ở đâu | Nên đọc |
| --- | --- |
| Mới hoàn toàn, muốn hiểu bức tranh | Chương 1 → 2 → 3 (đọc chậm) |
| Đã biết CI/CD, chỉ muốn xem cách làm | Chương 3 → 5 → 7 |
| Pipeline đang đỏ, cần sửa | Chương 8 (bảng lỗi) → 7 (Pages) |
| Chuẩn bị dựng repo mới | Chương 11 (checklist) + [BAI-TAP.md](BAI-TAP.md) |
| Cần tra cứu nhanh cú pháp | [CHEATSHEET.md](CHEATSHEET.md) |

---

## 1. Nền tảng: CI/CD và GitHub Actions là gì

### 1.1. Vấn đề mà CI/CD giải quyết

Trước khi có CI/CD, quy trình điển hình là:

```
Sửa code → chạy thử trên máy mình → commit → ...vài ngày... → build tay
→ copy file lên server bằng FTP/FileZilla → quên file nào đó → sập → sửa tay lúc 2h sáng
```

Ba bệnh chính:

1. **Lỗi phát hiện muộn** — code sai chạy được trên máy mình nhưng hỏng trên máy người khác.
2. **Deploy phụ thuộc vào trí nhớ con người** — quên bước, quên file, deploy nhầm bản.
3. **Không lặp lại được** — lần sau muốn deploy lại phải nhớ "hôm trước làm thế nào".

CI/CD biến quy trình thành **một chuỗi lệnh máy chạy**, mỗi lần push:

| Thuật ngữ | Nghĩa đơn giản | Trong demo này |
| --- | --- | --- |
| **CI** — Continuous Integration | Mỗi lần đẩy code lên là tự động kiểm tra (lint, test, build) | Job 1 → 3 |
| **CD** — Continuous Delivery | Luôn có bản build sẵn sàng để deploy, deploy là một nút bấm | Artifact `site-dist` |
| **CD** — Continuous Deployment | Tự deploy luôn, không cần ai bấm | Job 4 trên nhánh `main` |

Demo này làm **Continuous Deployment** cho nhánh `main`: push xong ~1 phút là trang live đổi.
Với `pull_request` thì dừng ở Delivery: chạy kiểm tra nhưng **không** deploy.

### 1.2. GitHub Actions — 6 khái niệm phải khắc vào đầu

```
Workflow  (file .github/workflows/*.yml — 1 file = 1 quy trình)
  └── Event (khi nào chạy: push / pull_request / lịch / bấm tay)
  └── Job   (một "công việc"; MỖI JOB = MỘT MÁY ẢO RIÊNG)
        └── Step (bước tuần tự bên trong job; các step CHUNG một máy/filesystem)
              └── Action (đơn vị đóng gói sẵn dùng lại: `uses: actions/checkout@v7`)
```

Sáu khái niệm, kèm ví dụ ngay trong repo:

| Khái niệm | Nghĩa | Ví dụ trong repo |
| --- | --- | --- |
| **Workflow** | Một file YAML mô tả toàn bộ quy trình | `.github/workflows/ci-cd.yml` |
| **Event (trigger)** | Điều kiện kích hoạt | `on: push: branches: [main]` |
| **Job** | Nhóm công việc, chạy trên một máy ảo riêng | `lint:`, `test:`, `build:`, `deploy:`, `report:` |
| **Step** | Một bước trong job | `- name: ESLint` + `run: npm run lint:js` |
| **Action** | Bộ code sẵn của người khác, gọi bằng `uses:` | `actions/checkout@v7` |
| **Runner** | Máy ảo GitHub cấp để chạy job | `runs-on: ubuntu-latest` |

**Điểm người mới hay hiểu sai nhất:**

> Mỗi job là **một máy ảo hoàn toàn mới**. Job `test` không thấy file `node_modules` mà job `lint` vừa cài,
> không thấy `dist/` mà job `build` vừa tạo. Muốn chuyển dữ liệu giữa các job phải dùng
> **artifact** (`upload-artifact` → `download-artifact`) hoặc **cache**.
>
> Hệ quả cụ thể trong repo này: ba job `lint`/`test`/`build` đều bắt đầu bằng `actions/checkout@v7`
> + `npm ci`; riêng job `deploy` **không** checkout mà tải artifact `site-dist`; job `report`
> không cần code nên không checkout. Đó là lý do trong workflow mỗi job trông "tự lập" như vậy.

Còn **step trong cùng job** thì dùng chung máy: `npm ci` ở step 3 thì step 4, 5 dùng lại `node_modules`.

### 1.3. YAML — chỉ cần biết 5 điều, nhưng sai 1 điều là đỏ

```yaml
# 1) Map: "khoá: giá trị"
name: CI/CD

# 2) List: dấu gạch ngang, thụt lề bằng SPACE (không dùng Tab bao giờ)
jobs:
  lint:
    steps:
      - name: Checkout
        uses: actions/checkout@v7

# 3) Thụt lề = cấu trúc. 2 space 1 cấp; sai thụt lề là sai nghĩa, không phải "xấu"
# 4) Chuỗi có dấu ":" hoặc "#" phải bọc nháy
name: "Build: bước 3"

# 5) Version nên để dạng chuỗi trong nháy — YAML có thể hiểu '20' là số, '1.20' là số thực
node-version: '20'
```

Ba lỗi YAML gặp nhiều nhất:

| Lỗi | Biểu hiện | Cách tránh |
| --- | --- | --- |
| Tab thay space | Lỗi parse ngay khi lưu file | Cấu hình editor dùng 2 spaces; repo này có `.editorconfig` |
| Sai thụt lề | Job/step bị hiểu sai cấp, workflow không nhận trigger | Copy indent từ ví dụ chính thức; chạy `actionlint` |
| `on:` bị một số tool đọc thành boolean `true` | Cảnh báo ở linter ngoài GitHub | Chấp nhận (GitHub hiểu đúng), hoặc quote `"on":` |

### 1.4. Bạn sẽ nhìn kết quả ở đâu

| Nơi | Thấy gì |
| --- | --- |
| Tab **Actions** của repo | Danh sách run, trạng thái xanh/đỏ, thời gian từng job |
| Trang 1 run | Sơ đồ 5 job, log từng step (bấm để mở) |
| Tab **Summary** của run | Báo cáo Markdown do workflow tự ghi |
| **Artifacts** (cuối trang run) | File `site-dist.zip` do job build tạo |
| **Environments** (Settings) | Lịch sử deploy lên `github-pages` |
| URL Pages | Sản phẩm cuối cùng người dùng thấy |

---

## 2. Bản đồ repo: file nào làm gì

### 2.1. Cây file đầy đủ

```
cicd-demo/
├── .github/
│   ├── dependabot.yml          # Bot tự mở PR cập nhật dependency/action hằng tuần
│   └── workflows/
│       └── ci-cd.yml           # ★ TOÀN BỘ PIPELINE nằm ở đây (297 dòng)
├── src/                        # Nguồn trang web (chưa build)
│   ├── index.html              # Trang demo; chứa placeholder __COMMIT_SHA__ ...
│   ├── styles.css              # CSS; có design token dark/light
│   ├── app.js                  # JS trình duyệt: theme, copy SHA, mô phỏng pipeline
│   ├── favicon.svg
│   └── lib/
│       ├── format.mjs          # Hàm định dạng thuần (pure) — dễ test
│       └── pipeline.mjs        # State machine của phần mô phỏng — dễ test
├── scripts/
│   ├── build.mjs               # ★ Build: minify, hash tên file, tiêm metadata
│   └── serve.mjs               # Static server: dùng cho dev & smoke test
├── tests/
│   ├── helpers/build.mjs       # Hàm build vào thư mục tạm cho test
│   ├── unit/                   # Test hàm thuần: format, pipeline
│   └── integration/            # Test HTML/CSS, output build, HTTP smoke
├── docs/
│   ├── HUONG-DAN.md            # ← tài liệu bạn đang đọc
│   ├── CHEATSHEET.md           # Tra cứu nhanh cú pháp
│   ├── BAI-TAP.md              # Bài thực hành
│   └── GITHUB-SETUP.md         # Dựng repo + PAT + Pages từ đầu
├── package.json                # Script + dependency (nguồn sự thật duy nhất)
├── package-lock.json           # Khoá phiên bản chính xác (npm ci dùng file này)
├── eslint.config.js            # Cấu hình ESLint (flat config)
├── .htmlvalidate.json          # Cấu hình kiểm tra HTML
├── .prettierrc.json            # Cấu hình format
├── .gitignore                  # node_modules/, dist/ ... không commit
├── .gitattributes              # Ép line-ending LF — tránh Prettier đỏ trên Windows
├── .editorconfig               # 2 spaces, LF — thống nhất editor
├── .prettierignore             # bỏ qua format cho dist/, *.md, package-lock.json
├── LICENSE                     # MIT
└── README.md                   # Giới thiệu + cách chạy
```

`dist/` **không** có trong repo — nó là **sản phẩm** do build sinh ra, mỗi lần chạy lại tạo mới.
Đây là điểm quan trọng: **nguồn** (src) và **sản phẩm** (dist) tách biệt.

### 2.2. Vai trò từng nhóm file và "ai gọi nó"

| File / thư mục | Vai trò | Ai gọi |
| --- | --- | --- |
| `src/*` | Nguồn trang; **chưa** minify, còn placeholder | `build.mjs` đọc |
| `src/lib/*.mjs` | Logic thuần, import được bằng Node → test trực tiếp | `app.js` (bundle) + test unit |
| `scripts/build.mjs` | Biến `src/` thành `dist/` hoàn chỉnh | `npm run build` (local + CI) |
| `scripts/serve.mjs` | Serve file tĩnh; dùng cho dev/preview/smoke test | `npm run dev`, `npm run preview`, test smoke |
| `tests/**` | Kiểm tra chất lượng tự động | `npm test` (local + CI) |
| `.github/workflows/ci-cd.yml` | Định nghĩa pipeline | GitHub Actions |
| `package.json` scripts | **Nguồn sự thật duy nhất** của mọi lệnh | Con người + CI (CI chỉ gọi qua npm) |
| `.github/dependabot.yml` | Tự cập nhật dependency | GitHub Dependabot |

### 2.3. Vì sao tách `src/` và `lib/`

- `src/app.js` là code **chạy trong trình duyệt** (có `document`, `window`), không test trực tiếp bằng Node được.
- `src/lib/*.mjs` là hàm **thuần** (không DOM, không side effect) → `node --test` import thẳng, test cực nhanh.
- `build.mjs` dùng `esbuild` **bundle** `app.js` + các lib thành một file duy nhất cho trình duyệt.

Đây là mẹo rất đáng bắt chước: **tách logic khỏi DOM** để phần khó test nhất (giao diện) trở nên nhỏ nhất.

### 2.4. Vì sao có `.gitattributes` (bài học Windows)

Trên Windows, `git` mặc định (`core.autocrlf=true`) đổi line-ending thành CRLF khi checkout.
Prettier cấu hình `endOfLine: "lf"` sẽ báo đỏ **mọi file** — dù code không sai gì.

Vì vậy repo có `.gitattributes`:

```gitattributes
* text=auto eol=lf
```

Lần đầu thêm file này phải chuẩn hoá lại index:

```bash
git add .gitattributes
git add --renormalize .
git commit -m "chore: chuan hoa line ending LF"
```

Nếu bạn dựng repo trên Windows mà bỏ qua bước này, rất có thể job `Prettier` đỏ ngay lần đầu.

---

## 3. Giải phẫu workflow `ci-cd.yml`

Mở file [.github/workflows/ci-cd.yml](../.github/workflows/ci-cd.yml) để đối chiếu. Chương này đi từ
trên xuống dưới, gặp khối nào giải thích khối đó, kèm lý do **vì sao phải có** và **nếu bỏ thì sao**.

### 3.0. Nhìn nhanh một job hoàn chỉnh trước

Đừng đọc tuần tự ngay. Trước hết nhìn job `lint` — nó là **khuôn mẫu** cho mọi job khác:

```yaml
jobs:                              # khối chứa tất cả job
  lint:                            # ← TÊN JOB (bạn tự đặt, chữ thường)
    name: 1 · Lint & format        # tên hiển thị trên UI
    runs-on: ubuntu-latest         # máy ảo do GitHub cấp
    timeout-minutes: 10            # chết sau 10 phút nếu treo
    steps:                         # danh sách bước, chạy tuần tự
      - uses: actions/checkout@v7        # (1) kéo code repo vào máy ảo
      - uses: actions/setup-node@v7      # (2) cài Node
        with:
          node-version: '22'
          cache: npm                     # cache thư mục npm giữa các run
      - run: npm ci                      # (3) cài dependency theo lockfile
      - run: npm run lint:js             # (4) chạy lệnh shell
      - run: npm run lint:html
      - run: npm run lint:format
```

Đọc hiểu job này là bạn hiểu 80% mọi job còn lại. Bốn job sau chỉ khác nhau ở **3 thứ**:

| Khác biệt | Job nào | Mục giải thích |
| --- | --- | --- |
| `needs:` (chờ job trước) | test, build, deploy, report | §3.6 |
| `matrix` (nhân job ra) | test (Node 20 & 22) | §3.8 |
| `if:` + `permissions` + `environment` | deploy, report | §3.10, §3.11 |

Sau đây là chi tiết từng khối, từ trên xuống.

### 3.1. Năm khối ở cấp cao nhất

```yaml
name: CI/CD                      # (1) tên hiển thị

on:                              # (2) khi nào chạy
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

permissions:                     # (3) workflow được phép làm gì
  contents: read

concurrency:                     # (4) chống chạy chồng nhau
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:                             # (5) biến dùng chung
  NODE_VERSION: '22'

jobs:                            # phần thân: các job
  ...
```

| Khối | Vì sao có | Nếu bỏ |
| --- | --- | --- |
| `name` | Tên hiện ở tab Actions, badge, thông báo | Workflow hiện bằng đường dẫn file — vẫn chạy |
| `on` | Không có trigger thì workflow **không bao giờ chạy** | Workflow "chết" (chỉ chạy tay được) |
| `permissions` | Giới hạn quyền của `GITHUB_TOKEN` (an toàn) | Token có quyền mặc định của repo (có thể full write) — **nguy hiểm** |
| `concurrency` | Push 2 lần liên tiếp sẽ huỷ run cũ, tiết kiệm phút và tránh deploy chồng | 2 run cùng deploy Pages → lần sau ghi đè lần trước một cách ngẫu nhiên |
| `env` | Một chỗ khai báo version Node, tránh sửa 5 chỗ | Phải lặp `node-version: '22'` khắp nơi, dễ lệch nhau |

### 3.2. Trigger `on:` — quyết định vòng đời pipeline

```yaml
on:
  push:
    branches: [main]        # push (kể cả merge) vào main
  pull_request:
    branches: [main]        # PR *nhắm vào* main
  workflow_dispatch:        # nút "Run workflow" bấm tay trên UI
```

Ba đường vào pipeline, mục đích khác nhau:

| Trigger | Khi nào | Pipeline làm gì (trong demo này) |
| --- | --- | --- |
| `push` → `main` | Bạn merge/push trực tiếp lên main | Chạy đủ 5 job, **có deploy** |
| `pull_request` → `main` | Ai đó mở/sửa PR vào main | Chạy lint → test → build, **không deploy** |
| `workflow_dispatch` | Bấm "Run workflow" | Như push (deploy nếu đang ở main) |

Chi tiết dễ nhầm:

- `pull_request.branches` là **nhánh đích** (main), không phải nhánh nguồn.
- PR tạo từ **fork** sẽ không có secret và `GITHUB_TOKEN` chỉ có quyền đọc — đúng thiết kế bảo mật.
  Demo này không dùng secret nên PR từ fork vẫn chạy được bình thường.
- `workflow_dispatch` không có tham số `inputs:` → chạy như push. Muốn "deploy hay không deploy"
  bằng tay thì thêm `inputs:` (xem chương 10).

Muốn chạy theo lịch (giờ UTC — `0 2 * * *` là 02:00 sáng mỗi ngày):

```yaml
on:
  schedule:
    - cron: '0 2 * * *'
```

> Chú ý thụt lề: `schedule:` là khoá, `- cron:` là **một phần tử list** nằm ở dòng dưới và thụt vào
> 2 space. Viết gộp `schedule: - cron: '...'` trên một dòng là **sai YAML** — lỗi rất hay gặp khi
> dán từ tài liệu khác.

### 3.3. `permissions:` — nguyên tắc quyền tối thiểu (least privilege)

```yaml
permissions:
  contents: read
```

`GITHUB_TOKEN` là token GitHub tự tạo cho mỗi run. Nó **có thể ghi vào repo của bạn** nếu bạn không giới hạn.
Mặc định (tuỳ cấu hình repo) có thể là read/write — nghĩa là một action độc hại có thể push code.

Vì vậy: khai báo quyền **ít nhất có thể** ở cấp workflow, và **nâng quyền ở đúng job cần**:

```yaml
  deploy:
    permissions:            # job này cần ghi Pages + xin OIDC token
      contents: read
      pages: write
      id-token: write
```

> ⚠️ **Gotcha cực quan trọng:** quyền khai báo ở cấp job **thay thế toàn bộ** quyền cấp workflow,
> không phải cộng dồn. Trong repo này job `deploy` khai báo lại `contents: read` dù nó **không**
> dùng `actions/checkout` (chỉ tải artifact) — khai báo tường minh để không phụ thuộc hành vi mặc định.
> Nếu sau này bạn thêm `actions/checkout@v7` vào job deploy mà quên `contents: read`, checkout sẽ lỗi
> 403 ngay lập tức.

Bảng quyền hay dùng:

| Quyền | Dùng để | Job nào cần |
| --- | --- | --- |
| `contents: read` | checkout code (action kéo code repo về runner — xem §3.7) | mọi job |
| `contents: write` | push commit/tag, tạo release | job release (nếu có) |
| `pages: write` | deploy GitHub Pages | deploy |
| `id-token: write` | xin OIDC token (đăng nhập không cần secret) | deploy |
| `packages: write` | push image lên GHCR | job docker |
| `pull-requests: write` | bot comment vào PR | job comment (nếu có) |
| `actions: read` | đọc artifact/run khác | hiếm |

### 3.4. `concurrency:` — không bao giờ để 2 run giẫm chân nhau

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

- `group` là **tên nhóm**: mỗi nhóm chỉ có 1 run chạy tại một thời điểm.
  - `${{ github.workflow }}` = "CI/CD", `${{ github.ref }}` = `refs/heads/main`
    → nhóm `CI/CD-refs/heads/main`; push vào `main` và PR vào `main` là **hai nhóm khác nhau**.
- `cancel-in-progress: true`: push mới **huỷ** run cũ đang chạy trong cùng nhóm.
  Bạn push 3 lần liên tiếp → chỉ run cuối được chạy đến cùng. Rất hợp lý cho CI.

Job `deploy` có thêm `concurrency` riêng (dòng 155-157):

```yaml
    concurrency:
      group: pages
      cancel-in-progress: false
```

Lý do **không** dùng `cancel-in-progress: true` cho deploy: huỷ giữa lúc đang đẩy artifact lên Pages
có thể để lại trạng thái deployment dở dang. Pages chỉ cho 1 deployment tại một thời điểm, nên
xếp hàng (`false`) là an toàn hơn.

Đây là ví dụ điển hình của tư duy CI/CD: **CI thì huỷ, CD thì xếp hàng**.

⚠️ Nhưng phải hiểu repo này có **hai tầng concurrency**, đừng gộp chúng làm một:

| Tầng | Khai báo | Huỷ cái gì |
| --- | --- | --- |
| Cấp workflow | `CI/CD-${{ github.ref }}`, `cancel-in-progress: true` | Push mới **huỷ toàn bộ run** cùng nhánh, kể cả job deploy đang chạy |
| Cấp job deploy | `pages`, `cancel-in-progress: false` | Không cho job deploy của run **khác** huỷ deployment đang chạy |

Nghĩa là nhóm `pages` chỉ bảo vệ deployment khỏi một deployment khác — nó **không** chống được việc
run cùng nhánh bị huỷ bởi push mới ở tầng workflow. Nếu cần deploy không bao giờ bị huỷ giữa chừng,
hãy cho tầng workflow nhường nhánh main, ví dụ:

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
```

### 3.5. `env:` và hai loại "biến" — đừng lẫn

```yaml
env:
  NODE_VERSION: '22'
```

Dùng ở nhiều nơi:

```yaml
        with:
          node-version: ${{ env.NODE_VERSION }}
```

Phân biệt 3 thứ rất giống nhau:

| Thứ | Viết ở đâu | Dùng ở đâu | Ví dụ |
| --- | --- | --- | --- |
| `env:` (workflow/job/step) | YAML | Trong `${{ env.X }}` và trong shell `$X` | `NODE_VERSION` |
| `$GITHUB_ENV` | Ghi trong một step | Step **sau** đọc được | `echo "FOO=bar" >> $GITHUB_ENV` |
| `$GITHUB_OUTPUT` | Ghi trong một step có `id:` | Step sau đọc `${{ steps.<id>.outputs.X }}` | `echo "url=..." >> $GITHUB_OUTPUT` |

Trong file này bạn thấy cả 3 loại: `env:` ở đầu; biến shell `$PAGE_URL`/`$SHORT_SHA` (step-level env);
output `${{ steps.deployment.outputs.page_url }}` (đọc output của action `deploy-pages`).

### 3.6. Đồ thị job — `needs` tạo thứ tự

```yaml
  test:   needs: lint
  build:  needs: test
  deploy: needs: build
  report: needs: [lint, test, build, deploy]
```

GitHub dựng **DAG**: job chỉ bắt đầu khi mọi job trong `needs` **success**.
Job `report` có `needs` là cả 4 job + `if: always()` → luôn chạy, kể cả khi có job trước đỏ,
để bạn luôn có bảng tổng kết.

Thứ tự này cố ý làm **rẻ trước, đắt sau**:

| Thứ tự | Lý do |
| --- | --- |
| Lint trước Test | Lint chỉ ~8s; code sai style/chú pháp bị chặn trước khi tốn 2 runner test |
| Test trước Build | Build mới là thứ đem đi deploy — phải chắc test xanh |
| Build trước Deploy | Deploy chỉ được phép dùng artifact đã build thành công |
| Report cuối | Cần biết kết quả cả 4 job |

Đây là nguyên tắc chung: **fail fast** — bước rẻ và hay sai nhất đặt sớm nhất.

### 3.7. Job 1 — `lint`: 3 lớp kiểm tra chất lượng

```yaml
  lint:
    name: 1 · Lint & format
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7

      - uses: actions/setup-node@v7
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: npm

      - run: npm ci --no-audit --fund=false

      - run: npm run lint:js        # ESLint
      - run: npm run lint:html      # html-validate
      - run: npm run lint:format    # Prettier --check
```

Từng mảnh:

| Thành phần | Giải thích |
| --- | --- |
| `runs-on: ubuntu-latest` | Máy ảo Ubuntu do GitHub cấp, sạch mỗi lần |
| `timeout-minutes: 10` | Job treo quá 10 phút bị kill (tránh đốt phút runner vô hạn) |
| `actions/checkout@v7` | Kéo code repo vào máy ảo. **Không có step này thì máy ảo trống!** |
| `actions/setup-node@v7` | Cài Node 22 + bật cache npm |
| `cache: npm` | Cache `~/.npm`; key tự sinh từ hash `package-lock.json`. Đổi lockfile = cache mới |
| `npm ci` | Cài **đúng** phiên bản trong lockfile, xoá `node_modules` cũ. Trong CI luôn dùng `npm ci`, không dùng `npm install` |
| `--no-audit --fund=false` | Bỏ kiểm tra bảo mật & quảng cáo khi cài → nhanh hơn, log gọn |
| 3 step lint | Tách riêng để nhìn thấy ngay **loại lỗi nào**: JS, HTML hay format |

Vì sao tách 3 step thay vì `npm run lint` một lần? Để UI hiện 3 dấu ✓/✗ riêng — đọc kết quả nhanh hơn,
và biết chính xác "đỏ vì ESLint" hay "đỏ vì format". Cả hai cách đều dùng **cùng một bộ script npm**
(`npm run lint` gọi tuần tự 3 cái này) → không lệch nhau.

### 3.8. Job 2 — `test`: matrix hai phiên bản Node

```yaml
  test:
    name: 2 · Test (Node ${{ matrix.node-version }})
    needs: lint
    strategy:
      fail-fast: false
      matrix:
        node-version: ['20', '22']
```

`matrix` nhân job ra thành **2 job song song**:

- `2 · Test (Node 20)`
- `2 · Test (Node 22)`

| Thành phần | Vì sao |
| --- | --- |
| `matrix.node-version` | Chạy test trên 2 version để chắc code không phụ thuộc tính năng mới của riêng một version |
| `fail-fast: false` | Nếu Node 20 đỏ, **vẫn chạy** Node 22 — biết lỗi chỉ ở version nào |
| `name` có `${{ matrix.node-version }}` | Tên job khác nhau → nhìn UI phân biệt được |

`fail-fast: true` (mặc định) sẽ huỷ các biến thể còn lại khi một biến thể đỏ — tiết kiệm phút nhưng
mất thông tin. Demo là repo nhỏ nên chọn `false`.

Bên trong job giống lint: checkout → setup-node (dùng `matrix.node-version`) → `npm ci` → `npm test`.
Một dòng `npm test` chạy **37 test** — chi tiết ở chương 6.

### 3.9. Job 3 — `build`: tạo sản phẩm và "đóng gói" nó

```yaml
  build:
    needs: test
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: ${{ env.NODE_VERSION }}   # dùng chung biến env khai báo ở đầu file
          cache: npm
      - run: npm ci
      - run: npm run build            # ← sinh ra dist/
      - name: Kiểm tra output
        run: |
          set -euo pipefail
          test -f dist/index.html
          ...
```

**Bước "Kiểm tra output" rất đáng học:** nếu build ra thiếu file, job đỏ ngay tại đây,
thay vì deploy một site trắng rồi mới phát hiện. `set -euo pipefail` nghĩa là:

| Cờ | Tác dụng |
| --- | --- |
| `-e` | lệnh nào lỗi là dừng ngay (không chạy tiếp) |
| `-u` | dùng biến chưa khai báo = lỗi (tránh biến rỗng âm thầm) |
| `-o pipefail` | lỗi ở giữa ống `a | b` cũng làm hỏng cả lệnh |

Không có `set -e`, một dòng lỗi có thể bị bỏ qua và job vẫn xanh → deploy bản hỏng.

Upload artifact:

```yaml
      - uses: actions/upload-artifact@v7
        with:
          name: site-dist
          path: dist
          retention-days: 7
          if-no-files-found: error
```

| Tham số | Ý nghĩa |
| --- | --- |
| `name: site-dist` | Tên artifact để job sau tải đúng cái này |
| `path: dist` | Đóng gói **toàn bộ** thư mục dist (giữ cấu trúc) |
| `retention-days: 7` | Giữ 7 ngày rồi tự xoá (tiết kiệm quota) |
| `if-no-files-found: error` | `dist/` rỗng/không có → **đỏ**. Mặc định là `warn` (nguy hiểm!) |

Đây là chỗ nối giữa 2 job: `build` tạo artifact, `deploy` tải artifact. Không có nó thì deploy
phải checkout + cài lại + build lại lần nữa (chậm gấp đôi và có thể build ra kết quả khác).

Ghi Step Summary:

```yaml
      - run: |
          {
            echo "### 📦 Artifact ..."
            echo "| Commit | \`${{ github.sha }}\` |"
          } >> "$GITHUB_STEP_SUMMARY"
```

`$GITHUB_STEP_SUMMARY` là **đường dẫn tới một file** trên runner; ghi Markdown vào đó là
tab Summary của run hiển thị đẹp. Đây là cách "báo cáo" mà không cần dịch vụ ngoài.

### 3.10. Job 4 — `deploy`: job phức tạp nhất

```yaml
  deploy:
    name: 4 · Deploy → GitHub Pages
    needs: build
    if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'
    permissions:
      contents: read
      pages: write
      id-token: write
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    concurrency:
      group: pages
      cancel-in-progress: false
```

Từng dòng đáng chú ý:

| Dòng | Ý nghĩa | Nếu bỏ |
| --- | --- | --- |
| `needs: build` | Chỉ deploy khi build xanh | Deploy bản build cũ/mới nhất tuỳ ý — sai |
| `if: github.event_name != 'pull_request' && github.ref == 'refs/heads/main'` | Chặn PR và chặn nhánh phụ | PR cũng deploy, ghi đè bản production |
| `permissions: pages: write` | Quyền ghi Pages | `deploy-pages` lỗi 403 |
| `permissions: id-token: write` | Cho phép xin OIDC token | Không đăng nhập được bằng OIDC |
| `environment: github-pages` | Gắn deployment vào environment chuẩn; tạo lịch sử deploy + có thể thêm approval | Deploy vẫn có thể chạy nhưng không có "cổng duyệt" |
| `environment.url: ...outputs.page_url` | Hiện nút "View deployment" trên UI | Không thấy link nhanh |
| `concurrency: pages, cancel-in-progress: false` | Pages chỉ 1 deploy/lúc → xếp hàng | Deploy chồng nhau, có thể lỗi |

Các step theo thứ tự:

```yaml
      - uses: actions/download-artifact@v8      # 1. lấy dist từ job build
        with:
          name: site-dist
          path: dist

      - run: test -f dist/index.html            # 2. kiểm tra artifact còn nguyên

      - name: Kiểm tra GitHub Pages đã bật      # 3. precheck (xem chương 7)
        ...

      - uses: actions/configure-pages@v6        # 4. đọc config Pages
      - uses: actions/upload-pages-artifact@v5  # 5. đóng gói dist thành Pages artifact
        with:
          path: dist
      - id: deployment                          # 6. deploy thật, output page_url
        uses: actions/deploy-pages@v5
      - name: Smoke test trang live             # 7. tự kiểm tra URL vừa deploy
      - name: Ghi URL vào step summary          # 8. báo cáo
```

Vì sao cần **cả** `upload-artifact` **và** `upload-pages-artifact`? Vì chúng phục vụ hai việc khác nhau:

| Artifact | Ai dùng | Mục đích |
| --- | --- | --- |
| `site-dist` (`upload-artifact`) | Con người tải về xem, job deploy tải | Debug/lưu trữ |
| Pages artifact (`upload-pages-artifact`) | `deploy-pages` | Đóng gói **tar** đúng chuẩn Pages, gắn với deployment API |

Smoke test trang live là bước đáng học nhất:

```bash
SHORT_SHA="${COMMIT_SHA:0:7}"
BASE_URL="${PAGE_URL%/}"
for attempt in 1 2 3 4 5 6; do        # retry vì CDN Pages có thể trễ
  if curl -fsS --max-time 15 "$BASE_URL/" -o /tmp/live.html; then break; fi
  sleep 5
done
grep -q "$SHORT_SHA" /tmp/live.html              # trang chứa đúng commit?
curl -fsS "$BASE_URL/build-info.json" -o /tmp/build-info.json
grep -q "$COMMIT_SHA" /tmp/build-info.json       # metadata đúng commit?
```

Đây là **deployment verification thật**: deploy xong mới biết thành công thật hay không.
Nhiều pipeline deploy xong báo xanh nhưng site vẫn trắng — bước này bắt đúng lỗi đó.

### 3.11. Job 5 — `report`: luôn chạy, kể cả khi đỏ

```yaml
  report:
    needs: [lint, test, build, deploy]
    if: always()
    steps:
      - env:
          LINT: ${{ needs.lint.result }}
          TEST: ${{ needs.test.result }}
          ...
```

| Thành phần | Ý nghĩa |
| --- | --- |
| `if: always()` | Chạy bất kể job trước success/failure/skipped. Không có nó, job này bị **skip** khi có job đỏ → mất báo cáo đúng lúc cần nhất |
| `needs.<job>.result` | Kết quả từng job: `success`, `failure`, `cancelled`, `skipped` |
| Truyền qua `env:` | Tránh nhét `${{ }}` thẳng vào chuỗi có dấu ngoặc kép (an toàn shell hơn) |

Bash function `icon()` map kết quả thành emoji. Đoạn kiểm tra cuối **trích nguyên văn từ file thật**
(`ci-cd.yml` dòng 283–296):

```bash
failed=0
for result in "$LINT" "$TEST" "$BUILD"; do
  if [ "$result" != "success" ]; then
    failed=1
  fi
done
if [ "$DEPLOY" = "failure" ]; then
  failed=1
fi

if [ "$failed" -ne 0 ]; then
  echo "❌ Pipeline có job thất bại" >&2
  exit 1
fi
echo "✅ Pipeline xanh"
```

Tại sao tách `DEPLOY` khỏi vòng lặp? Vì trên PR, `deploy` là `skipped` — nếu tính là lỗi thì
mọi PR sẽ đỏ. Đây là ví dụ về **xử lý trạng thái `skipped` cho đúng**.

> ⚠️ **Đừng "viết gọn" thành `[ "$failed" -ne 0 ] && exit 1`.** Với `set -euo pipefail`, khi
> `failed=0` phép so sánh sai → cả dòng trả exit code 1 → **job đỏ dù mọi job xanh**. Đó là lý do
> file thật dùng `if ... then ... fi` chứ không dùng `&&` — hãy copy đúng đoạn trên.

### 3.12. Biểu thức `${{ }}` — ngôn ngữ riêng của Actions

Trong workflow có **hai hệ biến khác nhau**, đừng lẫn:

```yaml
        run: echo "Commit ${{ github.sha }}"     # ${{ }} = Actions tính TRƯỚC khi chạy shell
        run: echo "Biến shell: $GITHUB_SHA"      # $VAR  = shell tính KHI chạy
```

Các **context** (nhóm biến do Actions cung cấp — viết `${{ tên.thuộc_tính }}`) dùng nhiều nhất:

| Context | Cho ra gì | Ví dụ |
| --- | --- | --- |
| `github.*` | thông tin run/repo | `github.sha`, `github.ref`, `github.run_number`, `github.repository`, `github.event_name`, `github.server_url`, `github.token` |
| `env.*` | biến `env:` khai báo | `env.NODE_VERSION` |
| `needs.<job>.result` | kết quả job phụ thuộc | `needs.test.result` |
| `steps.<id>.outputs.*` | output của step có `id:` | `steps.deployment.outputs.page_url` |
| `matrix.*` | giá trị matrix hiện tại | `matrix.node-version` |
| `secrets.*` | secret đã lưu | `secrets.SSH_KEY` |
| `inputs.*` | input của `workflow_dispatch` | `inputs.deploy` |
| `runner.*` | thông tin máy chạy | `runner.os` |

Hàm hay dùng: `contains()`, `startsWith()`, `endsWith()`, `format()`, `join()`, `toJSON()`,
`fromJSON()`, `success()`, `failure()`, `always()`, `cancelled()`.

Ví dụ thực tế:

```yaml
    if: contains(github.event.head_commit.message, '[skip ci]')
    if: startsWith(github.ref, 'refs/tags/v')
    env:
      MATRIX: ${{ toJSON(matrix) }}
```

> `[skip ci]` **không phải** tính năng sẵn có của GitHub Actions. Dòng `contains(...)` chỉ đúng khi
> bạn tự viết điều kiện đó cho từng job — nó kiểm tra chuỗi commit message, không làm GitHub bỏ qua
> workflow. Muốn bỏ qua thật thì dùng `paths-ignore` hoặc cấu hình ở chỗ khác.

Ghi nhớ: `if:` **tự hiểu** là biểu thức, không bắt buộc bọc `${{ }}` (viết `if: github.ref == '...'`
là đủ). Nhưng nếu viết trong `run:`/`with:`/`env:` thì **phải** bọc `${{ }}`.

### 3.13. Workflow commands — in thông báo đẹp, chỉ đúng chỗ sai

Trong precheck trang 3.10 có:

```bash
echo "::error title=GitHub Pages chưa bật::Vào Settings → Pages → Source: GitHub Actions ..."
exit 1
```

Bảng lệnh hay dùng:

| Lệnh | Kết quả |
| --- | --- |
| `::error title=X::message` | Dòng đỏ + annotation đỏ trên file/step, hiện ở tab Summary |
| `::warning::message` | Vàng |
| `::notice::message` | Xanh thông tin |
| `::group::Tên` … `::endgroup::` | Gấp log thành khối |
| `echo "X=1" >> $GITHUB_ENV` | Đặt env cho step sau |
| `echo "k=v" >> $GITHUB_OUTPUT` | Đặt output cho job |
| `echo "::add-matcher::<path>"` | Nạp file matcher để tô màu lỗi (hiếm dùng) |

Annotation là cách **báo lỗi cho người đọc**, thay vì để họ lặn trong log 200 dòng.

### 3.14. Gotcha riêng của file này (tổng hợp)

| Chỗ | Cạm bẫy | Cách repo xử lý |
| --- | --- | --- |
| Tên job có `${{ matrix.* }}` | Không dùng matrix ở `name` đúng cách | Đặt trong `name:` của job — hợp lệ |
| `if:` deploy | `github.ref` trên PR là `refs/pull/123/merge`, không phải `refs/heads/main` | Kiểm tra cả `event_name` và `ref` |
| Job-level `permissions` | Ghi đè toàn bộ, mất `contents: read` | Khai báo lại đủ 3 quyền |
| `deploy` cần artifact | Job mới = máy mới, không có `dist/` | `download-artifact` trước |
| Báo cáo trên PR | `deploy` là `skipped` | Chỉ coi `failure` là lỗi |
| Deploy Pages | `GITHUB_TOKEN` không tạo được Pages site | Bật Pages tay 1 lần + precheck |
| `npm ci` | Thiếu `package-lock.json` → lỗi ngay | Lockfile **phải** commit |
| Cache npm | Key đổi khi lockfile đổi | Dùng `cache: npm` để action tự lo |
| Shell nhiều dòng | Một dòng lỗi không làm job dừng | `set -euo pipefail` |
| `$GITHUB_STEP_SUMMARY` | Ghi đè file là mất nội dung step trước | Luôn dùng `>>` (append) |

---

## 4. Nguyên tắc "local-first"

### 4.1. Một câu thần chú

> **Nếu nó không chạy được ở máy bạn bằng một lệnh, nó cũng không nên chạy trong CI bằng lệnh khác.**

Nghĩa là: workflow chỉ gọi `npm run <script>`, và chính các script đó là thứ bạn chạy ở local.
Không có logic nào "chỉ tồn tại trên CI". Lợi ích:

- Debug lỗi CI = chạy đúng script đó ở máy mình.
- Người mới vào repo: `npm run verify` là biết mọi thứ có ổn không.
- Không có chuyện "máy tôi chạy được mà CI không" do lệnh khác nhau.

### 4.2. Toàn bộ `package.json` scripts

```json
{
  "scripts": {
    "lint:js": "eslint .",
    "lint:html": "html-validate \"src/**/*.html\"",
    "lint:format": "prettier --check .",
    "lint": "npm run lint:js && npm run lint:html && npm run lint:format",
    "build": "node scripts/build.mjs",
    "test": "node --test",
    "dev": "node scripts/serve.mjs src 5173",
    "preview": "npm run build && node scripts/serve.mjs dist 4173",
    "verify": "npm run lint && npm test && npm run build"
  }
}
```

| Script | Làm gì | CI dùng ở đâu |
| --- | --- | --- |
| `lint:js` | ESLint toàn repo | job lint, step 1 |
| `lint:html` | html-validate file HTML trong src | job lint, step 2 |
| `lint:format` | Prettier **check** (không sửa) | job lint, step 3 |
| `lint` | Gộp 3 cái trên (dùng khi local) | — (CI gọi từng cái để tách step) |
| `build` | Build ra `dist/` | job build + test integration |
| `test` | 37 test | job test |
| `verify` | lint → test → build | Local, trước khi push |
| `dev` | Serve `src/` trực tiếp (không build), hot-reload bằng F5 | Local |
| `preview` | Build rồi serve `dist/` — **giống bản deploy** | Local, kiểm tra trước khi push |

> 💻 **Windows PowerShell (mặc định Windows 10/11):** lệnh `npm`/`npx` có thể bị chặn với lỗi
> `npm.ps1 cannot be loaded because running scripts is disabled`. Đây là **ExecutionPolicy** của máy,
> không phải repo lỗi. Chọn 1 trong 3 cách:
>
> ```powershell
> # 1) gọi thẳng bản .cmd — nhanh nhất, không đổi cấu hình máy
> npm.cmd ci
> npm.cmd run verify
>
> # 2) cho phép script của user hiện tại
> Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
>
> # 3) dùng Git Bash hoặc WSL nếu đã cài
> ```
>
> Các khối lệnh trong tài liệu viết theo **bash** (`npm ci`, `curl -fsS`, biến `$VAR`, `${SHA:0:7}`).
> Trên PowerShell thuần, `curl` là alias của `Invoke-WebRequest` nên **không** nhận cờ `-fsS`; hãy
> chạy các lệnh đó trong Git Bash, còn không thì chỉ cần quan tâm `npm.cmd`/`node` là đủ cho phần lớn bài.

Hai lệnh `dev` và `preview` khác nhau ở chỗ:

| | `npm run dev` | `npm run preview` |
| --- | --- | --- |
| Serve | `src/` (còn placeholder `__COMMIT_SHA__`) | `dist/` (đã inject metadata, minify) |
| Cần build trước | Không | Có |
| Dùng khi | Sửa giao diện | Kiểm tra đúng thứ sẽ deploy |

### 4.3. `npm ci` khác `npm install` thế nào

| | `npm ci` | `npm install` |
| --- | --- | --- |
| Đọc | `package-lock.json` | `package.json` + lockfile (có thể **sửa** lockfile) |
| `node_modules` cũ | **Xoá sạch** rồi cài | Giữ và cập nhật |
| Nếu lệch lockfile | **Báo lỗi ngay** | Tự sửa lockfile |
| Tốc độ | Nhanh hơn, ổn định | Chậm hơn, có thể trôi phiên bản |
| Dùng ở đâu | **CI, Docker, máy mới** | Khi cài/mượn thêm package |

Vì vậy: **dev dùng `npm install`, CI dùng `npm ci`**. Và `package-lock.json` **bắt buộc commit**.

### 4.4. Chuỗi verify — chạy đúng thứ CI chạy

```bash
npm ci          # cài đúng lockfile
npm run verify  # = lint && test && build
```

Chạy đủ ở local trước khi push gần như loại bỏ hoàn toàn khả năng pipeline đỏ vì code.
Trong demo này, mình đã chạy:

| Kiểm tra | Kết quả |
| --- | --- |
| `npm run lint` | 0 lỗi (sau khi thêm rule `doctype-style` + format) |
| `npm test` | 37/37 pass, ~0,4 giây |
| `npm run build` | 6 file, ~26 KB |
| `git clone` sang thư mục khác + `npm ci` + `npm run verify` | Xin cả — **reproducible** |
| `actionlint .github/workflows/ci-cd.yml` | 0 lỗi |

### 4.5. Giả lập môi trường CI ở local (rất hữu ích)

Build script đọc biến `GITHUB_*` khi có. Ở local, bạn có thể "giả làm GitHub Actions"
để xem trang sẽ hiển thị đúng metadata không:

```powershell
# PowerShell
$env:GITHUB_SHA = 'a3c621a1f2b3c4d5e6f708192a3b4c5d6e7f8091'
$env:GITHUB_RUN_NUMBER = '7'
$env:GITHUB_RUN_ID = '1234567890'
$env:GITHUB_REPOSITORY = 'LySyaoran/cicd-demo'
$env:GITHUB_REF_NAME = 'main'
$env:GITHUB_ACTOR = 'LySyaoran'
node scripts/build.mjs
Get-Content dist\build-info.json
```

```bash
# bash
GITHUB_SHA=deadbeefdeadbeefdeadbeefdeadbeefdeadbeef \
GITHUB_RUN_NUMBER=7 GITHUB_RUN_ID=1234567890 \
GITHUB_REPOSITORY=LySyaoran/cicd-demo GITHUB_REF_NAME=main GITHUB_ACTOR=LySyaoran \
node scripts/build.mjs && cat dist/build-info.json
```

Không có biến `GITHUB_*` thì build script fallback về `git rev-parse HEAD` / `git branch` — vẫn ra
metadata hợp lý cho local.

> Dọn dẹp sau khi thử: các biến trên **vẫn còn** trong terminal đó, lần build sau sẽ tiếp tục dùng
> metadata giả khiến bạn tưởng "build không cập nhật". Xoá chúng:
>
> ```powershell
> Remove-Item Env:GITHUB_SHA, Env:GITHUB_RUN_NUMBER, Env:GITHUB_RUN_ID,
>   Env:GITHUB_REPOSITORY, Env:GITHUB_REF_NAME, Env:GITHUB_ACTOR
> ```
>
> hoặc đơn giản mở terminal mới (bash: `unset GITHUB_SHA GITHUB_RUN_NUMBER ...`).

### 4.6. `.gitignore` — đừng commit sản phẩm

```gitignore
node_modules/
dist/
.env
*.log
```

- `node_modules/` — cài lại bằng `npm ci`, commit chỉ tổ nặng hàng trăm MB.
- `dist/` — **sản phẩm** của build. Commit nó = repo phình + dễ deploy nhầm bản cũ.
- `.env` — chứa secret, không bao giờ commit.

Bạn có thể kiểm tra nhanh repo có "sạch" không: `git status --short` phải trống sau khi build.

---

## 5. Build system: `scripts/build.mjs`

Đây là file "biến source thành sản phẩm". Ở nhiều dự án, bước này do webpack/Vite lo. Demo dùng
**esbuild + script Node thuần** để bạn thấy rõ từng bước, và để pipeline không phụ thuộc framework.

### 5.1. Nhiệm vụ của build (5 việc)

```
1. Bundle + minify JS      src/app.js + src/lib/*.mjs  →  assets/app.<hash>.js
2. Minify CSS              src/styles.css              →  assets/styles.<hash>.css
3. Gắn hash nội dung       cache busting: đổi nội dung = đổi tên file
4. Tiêm metadata           __COMMIT_SHA__, __RUN_NUMBER__ ... → giá trị thật của lần build
5. Đóng gói                .nojekyll + build-info.json + step summary
```

### 5.2. Đọc code theo từng khối

**Khối 1 — xác định đường dẫn và đọc `package.json`:**

```js
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'src');
const OUT_DIR = path.resolve(ROOT, process.env.BUILD_OUT_DIR || 'dist');
const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
```

`BUILD_OUT_DIR` là "cửa sau" quan trọng: test truyền vào một thư mục tạm để **không ghi đè `dist/`**
của repo. Nhờ vậy test build chạy song song an toàn.

**Khối 2 — thu metadata, ưu tiên biến CI rồi fallback git:**

```js
const sha = env.GITHUB_SHA || gitOutput(['rev-parse', 'HEAD']) || 'local-dev';
const branch = env.GITHUB_REF_NAME || gitOutput(['rev-parse', '--abbrev-ref', 'HEAD']) || 'local';
```

Thứ tự ưu tiên:

| Nguồn | Khi nào dùng | Ví dụ |
| --- | --- | --- |
| `process.env.GITHUB_*` | Đang chạy trên Actions | `GITHUB_SHA=27fa679...` |
| `git rev-parse` | Chạy local trong repo git | `27fa679...` |
| Chuỗi mặc định | Chạy local không có git | `local-dev` |

`gitOutput()` bọc `execFileSync` trong `try/catch` — máy không có git thì không làm sập build.

**Khối 3 — bundle JS bằng esbuild:**

```js
const jsResult = await esbuild({
  entryPoints: [path.join(SRC_DIR, 'app.js')],
  bundle: true,       // gộp mọi import thành 1 file
  minify: true,       // xoá khoảng trắng/comment, rút gọn tên biến
  format: 'esm',      // output là ES module
  target: ['es2020'], // cú pháp tương thích trình duyệt hiện đại
  write: false,       // không ghi file ngay — ta cần hash trước
  legalComments: 'none',
  charset: 'utf8',    // giữ tiếng Việt nguyên vẹn thay vì escape \uXXXX
  absWorkingDir: ROOT,
});
const jsCode = jsResult.outputFiles[0].text;
```

Dùng `write: false` vì **phải có nội dung mới tính được hash** rồi mới đặt tên file.

**Khối 4 — minify CSS:**

```js
const cssResult = await transform(cssSource, {
  loader: 'css',
  minify: true,
  charset: 'utf8',
  legalComments: 'none',
});
```

`transform` dùng khi chỉ có một chuỗi (không cần bundle import), nhanh hơn `build`.

**Khối 5 — hash nội dung + đặt tên file (cache busting):**

```js
const hash8 = (content) => createHash('sha256').update(content).digest('hex').slice(0, 8);
const jsName = `app.${hash8(jsCode)}.js`;     // app.b6e43900.js
const cssName = `styles.${hash8(cssCode)}.css`; // styles.af71528c.css
```

Vì sao gắn hash vào tên file? Để **trình duyệt/CDN không phục vụ bản cũ từ cache**:

| Không hash | Có hash |
| --- | --- |
| `app.js` đổi nội dung nhưng URL y nguyên | `app.b6e43900.js` — đổi nội dung là đổi URL |
| Trình duyệt có thể dùng bản cache cũ | Cache mới hoàn toàn, không cần "hard refresh" |
| Phải cấu hình cache ngắn | Cache **vĩnh viễn** được, vì URL đổi khi nội dung đổi |

Đây là kỹ thuật chuẩn của mọi static site production (kể cả GitHub Pages).

**Khối 6 — thay tham chiếu trong HTML:**

```js
html = html
  .replaceAll('href="./styles.css"', `href="./assets/${cssName}"`)
  .replaceAll('src="./app.js"', `src="./assets/${jsName}"`);
```

HTML nguồn trỏ tới `./styles.css` / `./app.js` (để `npm run dev` serve `src/` vẫn chạy được),
còn bản build trỏ vào file đã minify + hash.

**Khối 7 — tiêm metadata (điểm "wow" của demo):**

```js
const replacements = {
  __BUILD_TIME__: meta.builtAt,
  __COMMIT_SHA__: meta.sha,
  __SHORT_SHA__: meta.shortSha,
  __COMMIT_URL__: meta.commitUrl,
  __BRANCH__: meta.branch,
  __RUN_NUMBER__: meta.runNumber,
  __RUN_URL__: meta.runUrl,
  __REPO_URL__: meta.repoUrl,
  __VERSION__: meta.version,
  __ACTOR__: meta.actor,
  __TOTAL_SIZE__: formatBytes(totalBytes),
};
for (const [placeholder, value] of Object.entries(replacements)) {
  output = output.replaceAll(placeholder, escapeHtml(value));
}
```

Bảng placeholder ↔ nơi hiển thị trên trang:

| Placeholder | Hiển thị ở | Nguồn |
| --- | --- | --- |
| `__COMMIT_SHA__` | tooltip + nút Copy | `GITHUB_SHA` |
| `__SHORT_SHA__` | hero stats, footer, link commit | 7 ký tự đầu của SHA |
| `__RUN_NUMBER__` | "#4" ở build card | `GITHUB_RUN_NUMBER` |
| `__RUN_URL__` | nút "Xem workflow run" | `GITHUB_SERVER_URL/REPO/actions/runs/RUN_ID` |
| `__BUILD_TIME__` | "00:48 12 thg 11, 2026" | thời điểm chạy build |
| `__BRANCH__` | "main" | `GITHUB_REF_NAME` |
| `__ACTOR__` | "Người build" | `GITHUB_ACTOR` |
| `__TOTAL_SIZE__` | "13.6 KB" | tổng byte JS + CSS |
| `__REPO_URL__` | link GitHub | `GITHUB_REPOSITORY` |

Hai chi tiết đáng học:

1. **`escapeHtml()`** — giá trị từ biến môi trường được chèn vào HTML, phải escape để tránh
   phá cấu trúc/lỗi bảo mật (XSS nếu ai đó điều khiển được `GITHUB_ACTOR`...).
2. **Kiểm tra placeholder sót**:
   ```js
   const leftover = output.match(PLACEHOLDER_PATTERN);
   if (leftover) throw new Error(`Còn placeholder chưa được thay: ...`);
   ```
   Nếu bạn thêm placeholder mới vào HTML mà quên điền → **build fail ngay**, chứ không deploy
   một trang hiển thị `__FOO__` cho người dùng. Đây là **fail fast** đúng nghĩa.

**Khối 8 — `.nojekyll` và `build-info.json`:**

```js
await writeFile(path.join(OUT_DIR, '.nojekyll'), '', 'utf8');
```

GitHub Pages mặc định chạy **Jekyll** (blog engine cũ). Jekyll bỏ qua file/thư mục bắt đầu bằng `_`
hoặc một số file đặc biệt. Một file `.nojekyll` rỗng **tắt Jekyll** → Pages phục vụ file y nguyên.

`build-info.json` là metadata dạng máy đọc được:

```json
{
  "version": "1.0.0",
  "commit": "27fa679c0611a9b6d22b79f1ac14947d34b371ab",
  "shortCommit": "27fa679",
  "branch": "main",
  "runNumber": "4",
  "runUrl": "https://github.com/LySyaoran/cicd-demo/actions/runs/43071645448",
  "repository": "LySyaoran/cicd-demo",
  "actor": "LySyaoran",
  "builtAt": "2026-11-11T17:48:44.018Z",
  "assets": { "js": { "name": "app.b6e43900.js", "bytes": 3770 },
              "css": { "name": "styles.af71528c.css", "bytes": 10196 } },
  "sizes": { "html": 11534, "js": 3770, "css": 10196 }
}
```

Nhờ file này, pipeline **tự verify** được: `grep "$COMMIT_SHA" /tmp/build-info.json` (xem 3.10).

**Khối 9 — ghi Step Summary nếu đang ở CI:**

```js
const summaryFile = process.env.GITHUB_STEP_SUMMARY;
if (!summaryFile) return;   // chạy local thì bỏ qua
...
await appendFile(summaryFile, rows.join('\n') + '\n', 'utf8');
```

Mẹo: build script tự báo cáo, không cần thêm step riêng trong workflow.

### 5.3. Vì sao build phải "deterministic"

Chạy cùng một commit 2 lần (xanh cả 2) thì **JS/CSS phải giống hệt nhau** → hash giống nhau.
Điều này đạt được vì:

- Không có dữ liệu ngẫu nhiên trong asset (thời gian build chỉ nằm trong HTML, không nằm trong JS/CSS).
- Không phụ thuộc mạng (không tải font/CDN bên ngoài).
- esbuild minify ổn định.

Ví dụ đã kiểm chứng: run #4 sinh ra `app.b6e43900.js` (3.770 B) và `styles.af71528c.css` (10.196 B);
chạy `npm run build` tại commit đó trên máy local cũng ra **đúng hai tên file này** — cùng nội dung
`src/` thì cùng hash. Ngược lại, bản trước khi sửa giao diện sinh ra `app.72ea2a6b.js` — nội dung đổi
thì tên đổi, đó chính là cache busting hoạt động đúng. Test `build.test.mjs` đang kiểm tra tính chất này.

### 5.4. Khi build lỗi, nó báo gì

Build script cố tình **fail loudly** (throw) trong các trường hợp:

| Tình huống | Thông báo |
| --- | --- |
| HTML không còn tham chiếu `./styles.css`/`./app.js` (ai đó đổi tên) | `Không tìm thấy tham chiếu ./styles.css hoặc ./app.js` |
| Còn placeholder chưa thay | `Còn placeholder chưa được thay: __FOO__` |
| esbuild lỗi cú pháp JS/CSS | esbuild throw với vị trí dòng |

Tư duy: **build script là "người gác cổng"**, không phải "người dọn dẹp". Gặp bất thường thì dừng,
không cố đoán.

---

## 6. Chiến lược test: 37 test che lỗi gì

### 6.1. Vì sao cần test trong pipeline static site

Trang tĩnh tưởng "hiển nhiên chạy", nhưng có rất nhiều thứ có thể hỏng mà mắt thường bỏ qua:

| Tình huống | Không có test | Có test |
| --- | --- | --- |
| Quên điền placeholder | Trang hiện `__COMMIT_SHA__` | ❌ đỏ ngay ở job test |
| Đổi tên file CSS | Trang mất toàn bộ giao diện | ❌ đỏ (test content) |
| Hash asset sai | Trang 404 CSS/JS | ❌ đỏ (test build + smoke) |
| HTML có 2 thẻ `<h1>` | SEO/accessibility kém | ❌ đỏ (test content) |
| Link nội bộ gãy | Bấm link không nhảy | ❌ đỏ (test content) |
| Build ra file thiếu | Site trắng | ❌ đỏ (job build verify) |
| Hàm format sai múi giờ | Thời gian hiển thị lệch | ❌ đỏ (test unit) |

### 6.2. Kim tự tháp test của repo này

| Lớp | File | Số test | Thời gian* | Kiểm tra gì |
| --- | --- | --- | --- | --- |
| Unit | `tests/unit/format.test.mjs` | 7 | ~150ms | hàm format ngày giờ, dung lượng, shorten SHA |
| Unit | `tests/unit/pipeline.test.mjs` | 5 | ~110ms | state machine mô phỏng pipeline, phần trăm, nhãn |
| Integration | `tests/integration/content.test.mjs` | 10 | ~120ms | hợp đồng HTML/CSS: cấu trúc, anchor, placeholder, asset |
| Integration | `tests/integration/build.test.mjs` | 9 | ~250ms | build thật vào tmp: file, hash, metadata, minify, kích thước |
| Integration | `tests/integration/smoke.test.mjs` | 6 | ~330ms | dựng server thật, `fetch` index/assets/404/path traversal |
| **Tổng** | | **37** | **~0,4s** | |

\* Thời gian đo bằng `Measure-Command` khi chạy từng file riêng, **đã gồm ~100ms khởi động Node**.
Chạy cả bộ cùng lúc (`npm test`) nhanh hơn vì Node test runner chạy các file **song song**
(trên máy demo: ~0,35–0,45 giây).

Nguyên tắc phân loại:

```
Nhiều, nhanh, rẻ        Unit        (hàm thuần, không IO)
        │
        ▼
      Integration   HTML contract, build output, HTTP smoke
        │
        ▼
Ít, chậm, đắt            E2E browser (demo này KHÔNG có — xem ch.10 để thêm)
```

### 6.3. Viết test với `node:test` — không cần framework

Node 18+ có sẵn test runner. Không cần Jest/Mocha/Vitest.

```js
import assert from 'node:assert/strict';
import test from 'node:test';

test('formatBytes chuyển đổi đơn vị', () => {
  assert.equal(formatBytes(1024), '1.0 KB');
  assert.equal(formatBytes(5 * 1024 * 1024), '5.0 MB');
});
```

| API | Dùng để |
| --- | --- |
| `test('tên', fn)` | Khai báo một test; `fn` lỗi = test đỏ |
| `test.after(fn)` | Dọn dẹp sau khi xong (xoá thư mục tạm, đóng server) |
| `assert.equal / deepEqual / match / ok / throws` | So sánh |
| `node --test` | Tự tìm mọi file `*.test.mjs` (và `test-*.mjs`) |

**Bẫy:** `node --test` quét cả thư mục. Repo có `tests/helpers/build.mjs` — file này **không** khớp
pattern `*.test.mjs` nên không bị chạy như test. Đừng đặt tên helper là `build.test.mjs`.

### 6.4. Helper build vào thư mục tạm — mẹo quan trọng nhất

Nhiều người viết test build rồi build thẳng vào `dist/` của repo. Hậu quả: test làm bẩn working tree,
chạy song song thì tranh nhau ghi, và `git status` lúc nào cũng có file lạ.

Repo này dùng `tests/helpers/build.mjs`:

```js
export async function buildFixture(env = {}) {
  const outDir = await mkdtemp(path.join(os.tmpdir(), 'cicd-demo-build-'));  // thư mục tạm duy nhất
  await new Promise((resolve, reject) => {
    execFile(process.execPath, ['scripts/build.mjs'], {
      cwd: ROOT,
      env: { ...process.env, BUILD_OUT_DIR: outDir, ...env },   // ← build ra tmp
      timeout: 120_000,
    }, (error, stdout, stderr) => {
      if (error) reject(new Error(`build.mjs thất bại: ${error.message}\n${stdout}\n${stderr}`));
      else resolve(undefined);
    });
  });
  return outDir;
}
```

Ba điểm đáng học:

1. `mkdtemp` tạo thư mục **duy nhất** cho mỗi lần test → test chạy song song an toàn.
2. `BUILD_OUT_DIR` là "dependency injection" của build script — nhờ nó test build **đúng script thật**,
   không phải bản mock.
3. `execFile` chạy đúng `node scripts/build.mjs` — **không** import trực tiếp module, vì build script
   có side effect (`process.exit`, đọc env). Đây là "test qua cửa chính".

### 6.5. `content.test.mjs` — test "hợp đồng" của HTML/CSS

Đây là loại test rất ít người nghĩ tới nhưng cực hữu ích. Nó không render trang, chỉ kiểm tra
**những lời hứa** giữa HTML và build script:

| Test | Bảo vệ điều gì |
| --- | --- |
| Đúng `<!doctype>`, `lang="vi"`, meta charset/viewport/description, title | SEO + accessibility |
| Đúng **một** `<h1>`, có `<header>/<main>/<footer>`, skip-link | Cấu trúc ngữ nghĩa |
| Mọi `href="#id"` phải có `id` tương ứng | Link nội bộ không gãy |
| Không có `<script src="https://...">` / `@import url(https://...)` | Build **offline được**, không phụ thuộc mạng |
| Mọi `href="./x"` phải tồn tại trong `src/` | Không tham chiếu file đã xoá |
| Không có `onclick=` inline | CSP-friendly, code sạch |
| Chỉ 1 `<script type="module" src="./app.js">` | Không nạp trùng/thiếu |
| Có đủ 11 placeholder | Build sẽ có đủ chỗ để tiêm metadata |
| CSS có `:root`, `[data-theme='light']`, `prefers-reduced-motion` | Không mất design token/accessibility |

Ví dụ test anchor nội bộ:

```js
test('mọi anchor nội bộ đều trỏ tới id tồn tại', () => {
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  const anchors = [...html.matchAll(/href="#([^"]+)"/g)].map((m) => m[1]);
  for (const anchor of anchors) assert.ok(ids.has(anchor), `anchor #${anchor} không có id`);
});
```

Chỉ 10 dòng nhưng chặn được lỗi "đổi id section mà quên sửa nav" — lỗi rất hay xảy ra.

### 6.6. `build.test.mjs` — test sản phẩm build

Chạy **script build thật** vào thư mục tạm rồi kiểm tra sản phẩm:

| Test | Assert |
| --- | --- |
| Đủ file | `index.html`, `build-info.json`, `.nojekyll`, `favicon.svg`, 2 file trong `assets/` |
| `.nojekyll` rỗng | `stat().size === 0` |
| Không còn placeholder | `index.match(/__[A-Z]+__/g) === null` |
| HTML trỏ đúng asset hash | `html.includes('./assets/' + buildInfo.assets.js.name)` |
| Metadata chính xác | Truyền env giả `GITHUB_SHA`, `RUN_NUMBER`, `ACTOR`... rồi assert `build-info.json` |
| `builtAt` hợp lệ | Parse được và lệch < 5 phút so với hiện tại |
| Minify có tác dụng | Kích thước bundle < tổng source |
| Kích thước trong info khớp file thật | `stat().size === buildInfo.sizes.js` |

Điểm hay: test này **truyền env giả** `GITHUB_SHA='a1b2c3d4...'` rồi kiểm tra metadata được tiêm đúng
— nghĩa là nó test cả phần "tích hợp CI" mà không cần chạy CI.

### 6.7. `smoke.test.mjs` — test như người dùng thật

Test này dựng **server HTTP thật** (`scripts/serve.mjs`) rồi `fetch` như trình duyệt:

```js
const outDir = await buildFixture({ GITHUB_SHA: 'b'.repeat(40), GITHUB_REF_NAME: 'main' });
const site = await startServer({ root: outDir, port: 0 });   // port 0 = OS tự chọn port trống

const response = await fetch(`${site.url}/`);
assert.equal(response.status, 200);
assert.match(response.headers.get('content-type'), /^text\/html/);
const body = await response.text();
assert.match(body, /Pipeline xanh/);
```

Các case:

| Case | Kỳ vọng |
| --- | --- |
| `GET /` | 200, `text/html`, có nội dung, có commit SHA đã tiêm |
| Mọi asset HTML tham chiếu | 200, content-type đúng (`text/css`, `javascript`) |
| `GET /build-info.json` | 200, `application/json`, đúng commit |
| `HEAD /` | 200, có `content-length`, **body rỗng** |
| `GET /khong-ton-tai` | 404 |
| `GET /..%2Fpackage.json` | **403** (chặn path traversal) |

`port: 0` là mẹo chuẩn: OS chọn port trống → test không bao giờ đụng port đang dùng.

Test path traversal đáng chú ý: server phải từ chối đường dẫn thoát khỏi thư mục gốc. Nếu bạn thay
`serve.mjs` bằng `express.static` cũng cần kiểm tra tương tự — đây là lỗ hổng bảo mật kinh điển.

### 6.8. Cách thêm một test mới (quy trình 3 phút)

Ví dụ: muốn bảo đảm `src/favicon.svg` luôn tồn tại.

```js
// thêm vào tests/integration/content.test.mjs
test('có favicon để tránh 404 trên trình duyệt', async () => {
  const fileStat = await stat(path.join(SRC, 'favicon.svg'));
  assert.ok(fileStat.isFile());
});
```

Chạy `npm test` — xong. Không cần cấu hình gì thêm.

### 6.9. Những gì **không** nên test

| Không nên | Vì sao |
| --- | --- |
| Snapshot toàn bộ HTML | Mỗi lần sửa chữ phải update snapshot, không bắt được lỗi thật |
| Test thư viện bên thứ ba (esbuild minify đúng không) | Đã có test của họ |
| Test style chi tiết (`margin-top: 12px`) | Dễ vỡ khi đổi design, giá trị thấp |
| Gọi API ngoài trong test | Test sẽ flaky khi mạng/API lỗi |

---

## 7. Deploy GitHub Pages: cơ chế và quyền

### 7.1. GitHub Pages là gì

Pages là **static hosting miễn phí** của GitHub:

- Phục vụ file tĩnh qua CDN toàn cầu.
- URL dạng `https://<user>.github.io/<repo>/`.
- Miễn phí cho repo **public**.
- Không chạy được backend (Node/PHP/DB) — chỉ file tĩnh.

Vì demo chỉ có HTML/CSS/JS nên Pages là lựa chọn **0 đồng, 0 server, không cần bảo trì** — đúng yêu cầu ban đầu.

### 7.2. Hai kiểu deploy Pages

| Kiểu | Cơ chế | Demo dùng? |
| --- | --- | --- |
| Deploy from a branch | Chọn branch (vd `gh-pages`) + thư mục; GitHub tự build/triển khai từ đó | ❌ |
| **GitHub Actions** | Pipeline tự upload artifact, `deploy-pages` gọi API deploy | ✅ |

Kiểu Actions hiện đại hơn: kiểm soát toàn bộ quá trình, có log, có environment, không cần tạo branch
`gh-pages` "rác" trong repo.

### 7.3. Điều kiện bắt buộc — và bài học thật từ run #1

Điều kiện:

1. Repo **public** (repo private cần GitHub Pro/Team để dùng Pages).
2. Pages đã được bật với **Source: GitHub Actions**.

Điều kiện 2 **không thể tự động hoá bằng `GITHUB_TOKEN`**, vì đây là thao tác quản trị repo.
Bằng chứng là run #1 của chính demo này:

```
HttpError: Resource not accessible by integration
  https://docs.github.com/rest/pages/pages#create-a-pages-site
Create Pages site failed. Error: Resource not accessible by integration
Get Pages site failed. Error: Not Found
```

`configure-pages` với `enablement: true` đã thử tạo Pages site bằng `GITHUB_TOKEN` → bị từ chối.
Cách đúng: **bật tay một lần** trong Settings → Pages → Source: **GitHub Actions**.

Sau bài học đó, workflow có thêm bước **precheck** để biến lỗi mơ hồ thành hướng dẫn rõ ràng:

```bash
api="https://api.github.com/repos/${{ github.repository }}/pages"
status=$(curl -sS -o /tmp/pages.json -w '%{http_code}' \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" "$api")

if [ "$status" = "404" ]; then
  echo "::error title=GitHub Pages chưa bật::Vào Settings → Pages → Source: GitHub Actions ..."
  exit 1
fi
```

| HTTP status | Nghĩa | Hành động |
| --- | --- | --- |
| `200` | Pages đã bật | Chạy tiếp |
| `404` | Chưa bật | Fail + chỉ đường bật |
| `403` | Thiếu quyền `pages: write` | Kiểm tra `permissions` của job |
| `500` | GitHub lỗi tạm | Re-run |

### 7.4. OIDC — deploy mà không cần lưu token

Job deploy có:

```yaml
    permissions:
      pages: write
      id-token: write
```

`id-token: write` cho phép action xin một **JWT ngắn hạn** từ GitHub:

```
deploy-pages  ──xin token──►  GitHub OIDC provider
      │                              │
      └──── JWT (vài phút) ──────────┘
      │
      └── gọi API deploy Pages bằng JWT này
```

Lợi ích so với PAT/secret:

| | OIDC (demo dùng) | PAT lưu trong secret |
| --- | --- | --- |
| Hạn token | Vài phút, 1 lần | Có thể vĩnh viễn |
| Rotate | Tự động | Phải làm tay |
| Lộ token | Không có gì để lộ | Nguy hiểm |
| Gắn với | Repo + workflow + job cụ thể | Bất kỳ đâu dùng token |

Đây là lý do các pipeline hiện đại chuyển sang OIDC (AWS/GCP/Azure cũng vậy).

### 7.5. Environment `github-pages`

```yaml
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
```

| Tác dụng | Chi tiết |
| --- | --- |
| Lịch sử deploy | Mỗi deploy ghi một entry dưới tab **Environments** |
| Gắn deployment với commit | Xem được commit nào đang ở production |
| Protection rules | Có thể thêm "Required reviewers" → deploy phải được duyệt |
| Hiện URL | Nút "View deployment" trên UI run |

`url:` lấy từ output của `deploy-pages` (`steps.deployment.outputs.page_url`) — đây là lý do action
này cần `id: deployment`.

### 7.6. Luồng deploy đầy đủ (nhìn theo file)

```
job build:
  npm run build ──► dist/ ──upload-artifact──► artifact "site-dist" (zip)

job deploy:
  download-artifact "site-dist" ──► dist/
  precheck Pages (curl)                  → fail sớm nếu chưa bật
  configure-pages                        → đọc config, xuất base_url
  upload-pages-artifact (path: dist)     → Pages artifact (tar)
  deploy-pages                           → gọi API deploy, trả page_url
  smoke test (curl + grep)               → xác minh URL live đúng commit
  step summary                           → báo cáo URL
```

### 7.7. Vì sao đường dẫn phải tương đối (`./styles.css`)

Repo là **project page**, không phải user page:

| Loại | URL | Gốc |
| --- | --- | --- |
| User page | `https://user.github.io/` | `/` |
| **Project page (demo)** | `https://user.github.io/cicd-demo/` | `/cicd-demo/` |

Nếu HTML dùng `/styles.css` (tuyệt đối), trình duyệt sẽ tìm `https://user.github.io/styles.css`
→ **404**, trang mất giao diện. Dùng `./styles.css` thì đúng ở cả local (`localhost:4173/`)
lẫn Pages (`/cicd-demo/`). Đây là lỗi rất phổ biến khi mới deploy Pages.

### 7.8. Smoke test sau deploy — vì sao "deploy xanh" chưa đủ

`deploy-pages` báo success khi GitHub đã nhận artifact. Nhưng có những trường hợp vẫn hỏng:

- Deploy xong nhưng thiếu file (artifact rỗng/thừa/thiếu).
- Bản deploy là commit cũ do cache.
- Site trắng vì JS lỗi runtime.

Smoke test trong workflow kiểm tra:

1. URL live trả **200** (retry 6 lần × 5s vì CDN trễ).
2. Nội dung HTML chứa **short SHA của commit vừa push**.
3. `build-info.json` chứa **full SHA**.

Nếu 1 trong 3 sai → job đỏ → biết ngay deployment không thật sự thành công.

### 7.9. Giới hạn của Pages cần biết

| Giới hạn | Giá trị (theo tài liệu GitHub, có thể thay đổi) |
| --- | --- |
| Kích thước site publish | ~1 GB |
| Băng thông | ~100 GB/tháng (mềm) |
| Build/giờ (kiểu deploy từ branch) | 10 lần/giờ — **không áp dụng** khi publish bằng Actions workflow (repo này) |
| Thời gian deploy tối đa | 10 phút/lần; quá 10 phút coi như fail |
| Số site | 1 site cho mỗi repo |
| Custom domain | Có (CNAME + DNS) |
| HTTPS | Tự động (Let's Encrypt) |
| Server-side | ❌ không (không PHP/Node/DB) |

Với demo ~26 KB thì không bao giờ chạm giới hạn.

### 7.10. Rollback khi deploy hỏng

Có 3 cách, xếp theo mức khuyến nghị:

| Cách | Làm gì | Ưu/nhược |
| --- | --- | --- |
| **`git revert`** | Tạo commit đảo ngược rồi push | Sạch, có lịch sử, pipeline chạy lại tự động — **khuyến nghị** |
| Re-run job deploy của run cũ | Vào run cũ → Re-run failed jobs | Nhanh nhưng artifact chỉ giữ 7 ngày; không có commit mới |
| Sửa tay trên Pages | Không có | Không nên |

Với pipeline tự động, rollback = `git revert` + `git push`, ~1 phút sau production về bản cũ.
Đây là một lợi ích lớn của CI/CD mà làm tay không có.

---

## 8. Debug pipeline như người thật việc thật

### 8.1. Case study: run #1 đỏ và cách tìm ra trong 3 phút

**Triệu chứng:** run #1 có **4 job xanh** (`lint`, `test` Node 20, `test` Node 22, `build`), job
`4 · Deploy` đỏ, job `5 · Báo cáo` đỏ theo (đúng thiết kế).

**Bước 1 — xác định job đỏ, không đọc cả log:**

```
1 · Lint & format        ✅ completed/success
2 · Test (Node 20)       ✅ completed/success
2 · Test (Node 22)       ✅ completed/success
3 · Build & artifact     ✅ completed/success
4 · Deploy → GitHub Pages ❌ completed/failure   ← dừng ở đây
5 · Báo cáo pipeline     ❌ completed/failure   ← hệ quả, không phải nguyên nhân
```

> Nguyên tắc: **job đỏ đầu tiên** là nguyên nhân; các job sau đỏ là hệ quả. Đừng sửa job `report`.

**Bước 2 — xem step nào trong job đỏ:**

```
step 2 Tải artifact từ job build       success
step 3 Kiểm tra artifact               success
step 4 Cấu hình GitHub Pages           FAILURE   ← step thật sự hỏng
step 5 Đóng gói artifact cho Pages     skipped
step 6 Deploy lên GitHub Pages         skipped
```

**Bước 3 — lấy thông báo lỗi chính xác:**

Cách nhanh nhất, không cần cài gì: mở job đỏ → mở step đỏ → GitHub hiện **ô Annotations** ở cuối step
(hoặc tab "Annotations" của run) với đúng dòng `Error:` / `::error`. Log dài phía dưới chỉ là ngữ cảnh —
**annotation là nguồn tin chính**.

Nếu muốn lấy bằng API (khi cần tự động hoá), thay `<owner>/<repo>` và `<run_id>`:

```bash
# 1) head_sha của run
curl -s "https://api.github.com/repos/<owner>/<repo>/actions/runs/<run_id>" | jq -r .head_sha

# 2) check-run id (lọc theo tên job)
curl -s "https://api.github.com/repos/<owner>/<repo>/commits/<sha>/check-runs?per_page=100" \
  | jq -r '.check_runs[] | select(.name|startswith("4")) | .id'

# 3) annotations của check-run đó
curl -s "https://api.github.com/repos/<owner>/<repo>/check-runs/<check_id>/annotations" \
  | jq -r '.[] | "\(.annotation_level): \(.message)"'
```

> `jq` và `curl` không có sẵn trên Windows PowerShell. Có `gh` CLI thì ngắn hơn nhiều:
> `gh run view <run_id> --log-failed`. Không có gì thì cứ dùng UI — nhanh hơn cả API.

Kết quả thật của run #1:

```
failure: HttpError: Resource not accessible by integration
         - https://docs.github.com/rest/pages/pages#create-a-pages-site
failure: Create Pages site failed. Error: Resource not accessible by integration
warning: Get Pages site failed. Error: Not Found
```

**Bước 4 — đọc annotation → suy ra nguyên nhân hệ thống:**

| Dữ kiện | Suy luận |
| --- | --- |
| `Get Pages site failed: Not Found` | Repo **chưa bật** Pages |
| `Create Pages site failed: Resource not accessible by integration` | `GITHUB_TOKEN` **không có quyền tạo** Pages site |
| → | Bật Pages phải làm **tay** (hoặc PAT có quyền admin) |

**Bước 5 — sửa đúng gốc, không sửa triệu chứng:**

| Sửa triệu chứng (sai) | Sửa gốc (đúng) |
| --- | --- |
| Bỏ bước `configure-pages` | Giữ nguyên, thêm precheck báo lỗi rõ |
| `continue-on-error: true` cho deploy | Không: deploy hỏng phải đỏ |
| Bật `enablement: true` mạnh hơn | Không thể — token không có quyền admin |

Kết quả sau sửa: precheck + hướng dẫn Settings → bật Pages → run #4 xanh 5/5.

### 8.2. Quy trình debug chuẩn (5 bước, dùng cho mọi pipeline)

```
1. Xác định job đỏ ĐẦU TIÊN (không phải job cuối)
2. Xác định step đỏ đầu tiên trong job
3. Lấy đúng 1 dòng lỗi (annotation / log dòng cuối / exit code)
4. Phân loại lỗi: workflow? action? quyền? code? hạ tầng?
5. Sửa → chạy lại đúng phần đỏ → xác minh
```

Phân loại lỗi giúp chọn cách sửa đúng:

| Nhóm | Dấu hiệu | Sửa ở đâu |
| --- | --- | --- |
| **Workflow sai cú pháp** | Run không tạo được / job không xuất hiện | file `.yml` (chạy `actionlint`) |
| **Thiếu quyền** | `Resource not accessible`, `403`, `Not authorized` | `permissions:` |
| **Thiếu/sai tham số action** | Action fail ngay step setup | `with:` của action |
| **Code/lệnh sai** | Log có stack trace, `command not found`, test assert fail | file nguồn |
| **Hạ tầng/mạng** | timeout, `502`, registry lỗi | re-run, cache |
| **Trạng thái repo** | Pages chưa bật, branch protection chặn | Settings |

### 8.3. Đọc log cho đúng

Một step có 3 phần:

```
▸ Set up job        ← chuẩn bị máy ảo (thường bỏ qua)
▸ Run npm test      ← ví dụ về step của bạn
▸ Post job          ← dọn dẹp (cache, artifact upload) — đôi khi lỗi ở đây
```

| Hiện tượng log | Ý nghĩa |
| --- | --- |
| `Process completed with exit code 1` | Lệnh lỗi; tìm dòng **ngay trước** nó |
| `Process completed with exit code 0` + step đỏ | Hiếm: lỗi ở phần `Post` |
| `Error: Process completed with exit code 1` | Như trên, exit code là manh mối chính |
| `##[error]` | Workflow command báo lỗi |
| `##[warning]` | Cảnh báo (ví dụ Node 20 deprecated) — không làm đỏ |
| `Waiting for a runner to pick up this job...` | Job đang **xếp hàng**, không phải treo |

Phân biệt hai con số rất dễ nhầm: **thời gian chờ runner** và **thời gian chạy**.

- Khi job đang xếp hàng, UI hiện banner `Waiting for a runner to pick up this job...`, còn danh sách job
  có thể hiện `queued`. Job **không** treo — GitHub đang tìm máy trống.
- Con số cạnh tên job (ví dụ `2s`) là thời gian **chạy thật**, không tính lúc chờ.
- Ví dụ thật run #4: job `5 · Báo cáo` chờ runner khoảng **3 giây** rồi chạy **2 giây** — tổng thời gian
  bạn thấy trên UI lớn hơn nhiều chỉ vì khoảng chờ giữa các job.

Đừng vội "sửa" job chỉ vì thấy nó `queued` lâu. Nhưng nếu chờ **quá 10 phút** mà vẫn `queued` thì
kiểm tra billing/quota runner hoặc re-run.

### 8.4. Công cụ nên có trong túi

| Công cụ | Dùng để | Lệnh |
| --- | --- | --- |
| **GitHub CLI** | Xem run/log nhanh | `gh run list`, `gh run view <id> --log-failed`, `gh run watch` |
| **actionlint** | Bắt lỗi workflow trước khi push | `actionlint .github/workflows/ci-cd.yml` |
| **act** (tuỳ chọn) | Chạy workflow ở local qua Docker | `act -j lint` |
| **`npm run verify`** | Giả lập chuỗi CI | lint + test + build |
| **Artifacts** | Tải `site-dist.zip` xem trực tiếp | tab Artifacts của run |
| **Step Summary** | Đọc báo cáo tổng hợp | tab Summary |
| **Re-run failed jobs** | Chạy lại chỉ job đỏ (giữ artifact cũ) | nút trên UI |

> Cài `actionlint` (Windows): tải file zip từ
> <https://github.com/rhysd/actionlint/releases> (chọn `actionlint_<ver>_windows_amd64.zip`), giải nén
> rồi chạy `.\actionlint.exe .github/workflows/ci-cd.yml`. Nếu chưa thêm vào PATH, gọi bằng đường dẫn
> đầy đủ. `actionlint` không có trong npm nên đừng tìm bằng `npx`.

Debug logging nâng cao: thêm secret `ACTIONS_STEP_DEBUG = true` vào repo → log chi tiết từng bước
nội bộ của action.

### 8.5. Bảng 15 lỗi thường gặp và cách xử lý

| # | Thông báo / hiện tượng | Nguyên nhân | Cách sửa |
| --- | --- | --- | --- |
| 1 | `workflow is not valid` / không chạy | YAML sai cú pháp | `actionlint`, kiểm tra thụt lề/tab |
| 2 | Job bị `skipped` | `needs` job trước đỏ, hoặc `if:` sai | Xem điều kiện `if` |
| 3 | `Resource not accessible by integration` | Thiếu quyền trong `permissions` | Thêm quyền đúng job |
| 4 | `Get Pages site failed: Not Found` | Pages chưa bật | Settings → Pages → Source: GitHub Actions |
| 5 | `Create Pages site failed` | `GITHUB_TOKEN` không được tạo Pages | Bật tay một lần (không dùng `enablement`) |
| 6 | `npm ci` báo `can only install with an existing package-lock.json` | Chưa commit lockfile | `npm install` rồi commit lockfile |
| 7 | `npm ci` báo lockfile lệch `package.json` | Sửa dependency mà không cập nhật lockfile | `npm install`, commit lockfile |
| 8 | `command not found: npm` | Chưa `setup-node` hoặc setup sau bước run | Đưa `setup-node` lên trước |
| 9 | `fatal: could not read Username` | Chưa `checkout` | Thêm `actions/checkout` |
| 10 | Artifact tải về rỗng | `path:` sai / build không ra file | `if-no-files-found: error`, kiểm tra `dist/` |
| 11 | Job chờ mãi ở `Waiting for a runner` | Hết runner/độ ưu tiên, hoặc GitHub chậm | Chờ, hoặc re-run; kiểm tra billing |
| 12 | Deploy xong nhưng site 404 | `base path` sai (dùng đường dẫn tuyệt đối) | Dùng `./` tương đối |
| 13 | Site cũ không đổi dù deploy xanh | CDN/browser cache | Hash tên file (đã làm), `cache-control` hợp lý |
| 14 | Prettier đỏ dù code không sai | Line ending CRLF trên Windows | `.gitattributes` + `git add --renormalize .` |
| 15 | Test đỏ khi chạy `node --test` | Vô tình đặt tên helper là `*.test.mjs` | Đổi tên helper |

### 8.6. Vòng lặp debug nhanh nhất

```
Sửa code
  └─► npm run verify            (local, ~2 giây)
        └─► actionlint          (local, ~0.1 giây)
              └─► git push      (CI, ~1 phút)   # run #4: 17:48:09 → 17:49:13 ≈ 64 giây
                    └─► xem job đỏ đầu tiên → quay lại
```

Đừng push rồi ngồi chờ từng lần — chạy `npm run verify` + `actionlint` trước gần như loại bỏ 80%
khả năng đỏ.

---

## 9. Bảo mật và vận hành

### 9.1. Mô hình token — hiểu để không tự bắn vào chân

| Token | Ai cấp | Phạm vi | Sống bao lâu |
| --- | --- | --- | --- |
| `GITHUB_TOKEN` | GitHub tự tạo mỗi run | Chỉ repo hiện tại, theo `permissions:` | Đến hết run |
| PAT (personal access token) | Bạn tự tạo | Có thể rất rộng | Tuỳ bạn (nên ngắn) |
| Secret tự lưu | Bạn nhập vào Settings → Secrets | Tuỳ giá trị | Đến khi xoá |
| OIDC JWT | GitHub cấp khi có `id-token: write` | Chỉ trong run, đúng repo/workflow | Vài phút |

Nguyên tắc: **đẩy quyền xuống thấp nhất có thể** và **ưu tiên OIDC hơn PAT**.

### 9.2. Checklist bảo mật 10 điểm (demo đã làm gần hết)

| # | Việc | Trạng thái trong demo |
| --- | --- | --- |
| 1 | `permissions` khai báo tường minh, tối thiểu | ✅ `contents: read` |
| 2 | Job cần gì mới nâng quyền đó | ✅ `pages: write`, `id-token: write` |
| 3 | Không hard-code secret trong code | ✅ không có secret nào |
| 4 | Deploy dùng OIDC thay vì PAT | ✅ |
| 5 | Pin action theo version (`@v7`) | ✅ |
| 6 | Dependabot cập nhật dependency/action | ✅ `dependabot.yml` |
| 7 | Branch protection + required checks cho `main` | ⬜ nên bật (xem 9.4) |
| 8 | Không dùng `pull_request_target` với code từ fork | ✅ không dùng |
| 9 | `.gitignore` chặn `.env` | ✅ |
| 10 | Review code trước khi merge | ⬜ tuỳ team |

### 9.3. Pin action: `@v7` hay `@<sha>`?

| Cách | Ví dụ | Ưu | Nhược |
| --- | --- | --- | --- |
| Theo major tag | `actions/checkout@v7` | Tự nhận bản vá bảo mật | Tag có thể bị trỏ lại (rủi ro nhỏ) |
| Theo SHA | `actions/checkout@3d3c42e...` | Bất biến, an toàn nhất | Phải cập nhật tay mỗi lần |

Với repo cá nhân học tập → `@v7` là hợp lý. Với repo production/enterprise → pin SHA + Dependabot
tự mở PR nâng cấp. Dù cách nào: **không bao giờ để `@master`/`@main`** — bản mới có thể phá pipeline
bất cứ lúc nào.

### 9.4. Branch protection — biến "CI xanh" thành luật

Tưởng tượng pipeline đỏ mà vẫn merge được — CI/CD mất ý nghĩa. Bật:

**Settings → Branches → Add branch ruleset** cho `main`:

| Thiết lập | Giá trị |
| --- | --- |
| Require a pull request before merging | ✅ (tuỳ team) |
| Require status checks to pass | ✅ |
| Status checks bắt buộc | `1 · Lint & format`, `2 · Test (Node 20)`, `2 · Test (Node 22)`, `3 · Build & artifact` |
| Require branches to be up to date | ✅ |
| Do not allow bypassing | tuỳ |

Khi đó: PR đỏ **không merge được** — đây là điểm khác biệt giữa "có pipeline" và "có quy trình".

### 9.5. Secrets: cách dùng đúng

```yaml
      - name: Deploy lên VPS
        env:
          SSH_KEY: ${{ secrets.SSH_KEY }}
        run: ...
```

| Quy tắc | Lý do |
| --- | --- |
| Đặt ở **Settings → Secrets and variables → Actions** | Không nằm trong repo |
| Không `echo` secret ra log | GitHub che nhưng vẫn hở khi biến đổi |
| Dùng environment secret cho production | Có thể gắn approval |
| Không dùng secret trong workflow chạy trên PR từ fork | PR từ fork không được cấp secret — đúng thiết kế |
| Rotate định kỳ | Bị lộ lúc nào không biết |

### 9.6. Chi phí — pipeline này tốn bao nhiêu?

| Hạng mục | Repo public | Repo private (Free plan) |
| --- | --- | --- |
| Phút Actions | Miễn phí không giới hạn | 2.000 phút/tháng |
| Lưu artifact | Có quota dung lượng | Có quota |
| Pages | Miễn phí | Cần Pro/Team |
| Runner | `ubuntu-latest` | Như nhau |

Pipeline demo chạy khoảng **1 phút/lần** (run #4: 64 giây từ lúc tạo đến khi xong), gồm **5 job / 6 lượt**
(job `test` nhân 2 nhờ matrix). Với repo public: 0 đồng.

### 9.7. Vận hành hằng ngày

| Tình huống | Làm gì |
| --- | --- |
| Muốn xem pipeline đang xanh/đỏ | Badge trong README: `![CI](...badge.svg)` |
| Muốn chạy lại không cần commit | Actions → CI/CD → **Run workflow** |
| Chỉ 1 job lỗi do mạng | Run → **Re-run failed jobs** |
| Muốn xem bản artifact | Run → Artifacts → tải `site-dist.zip` |
| Muốn biết ai deploy gì | Environments → `github-pages` |
| Hết dung lượng artifact | Giảm `retention-days` (đang 7 ngày) |
| Nhiều Dependabot run gây rối tab Actions | Bình thường — chúng là workflow riêng của Dependabot; có thể tắt bằng cách xoá `dependabot.yml` hoặc chọn "grouped updates" |

### 9.8. Những điều **không** nên làm

| Không nên | Vì sao |
| --- | --- |
| `continue-on-error: true` cho test/deploy | Che giấu lỗi, pipeline "xanh giả" |
| Deploy từ job test | Test không được phép deploy; tách job |
| Dùng `pull_request_target` rồi checkout code PR | Lỗ hổng cho phép chạy code lạ với quyền cao |
| `git push --force` lên main từ CI | Phá lịch sử |
| Commit `dist/` | Sản phẩm lẫn nguồn, deploy nhầm |
| Log toàn bộ `env` để debug | Có thể lộ secret |
| Bỏ `timeout-minutes` | Job treo đốt phút runner |

---

## 10. Mở rộng: khi bạn thật sự cần server

Demo này chỉ có frontend tĩnh nên không cần server. Nhưng sớm muộn bạn sẽ cần API/database.
Chương này để bạn biết **nâng cấp theo hướng nào**, không phải bắt đầu lại.

### 10.1. Ma trận chọn nơi deploy

| Loại sản phẩm | Nơi deploy hợp lý | Cần server? | Chi phí điển hình |
| --- | --- | --- | --- |
| Trang tĩnh / landing page / docs | **GitHub Pages** | Không | 0đ |
| SPA (React/Vue build ra tĩnh) | GitHub Pages / Netlify / Cloudflare Pages | Không | 0đ |
| API nhỏ (Node/Python) | Render / Railway / Fly.io | Không (PaaS) | 0–5$/tháng |
| Container + DB | VPS (DigitalOcean/Vultr) + Docker Compose | **Có** | 5–10$/tháng |
| Hệ thống cần kiểm soát mạng | **Self-hosted runner + máy riêng** | Có | 0đ (dùng PC) |

### 10.2. Self-hosted runner — biến PC của bạn thành "server"

GitHub cho bạn đăng ký **máy của mình** làm runner. Khi đó `runs-on: self-hosted` sẽ chạy job
trên máy đó, có toàn quyền filesystem/Docker — đúng nghĩa "deploy xuống server".

Cài đặt (Settings → Actions → Runners → New self-hosted runner — GitHub hiện sẵn lệnh đúng cho máy bạn):

```bash
# Linux / macOS
mkdir actions-runner && cd actions-runner
# tải actions-runner-linux-x64-<version>.tar.gz (hoặc osx-x64) theo link GitHub hiện ra
tar xzf actions-runner-*.tar.gz
./config.sh --url https://github.com/<owner>/<repo> --token <TOKEN>
./run.sh                       # chạy thử
sudo ./svc.sh install && sudo ./svc.sh start   # chạy như service
```

```powershell
# Windows (PowerShell) — dùng bản win-x64
New-Item -ItemType Directory actions-runner; Set-Location actions-runner
# tải actions-runner-win-x64-<version>.zip theo link GitHub hiện ra, giải nén tại đây
.\config.cmd --url https://github.com/<owner>/<repo> --token <TOKEN>
.\run.cmd                      # chạy thử (mở PowerShell thứ hai nếu cần)
# chạy như service: .\svc.cmd install ; .\svc.cmd start
```

> Đừng copy URL `v2.x` ở trên — mỗi thời điểm GitHub có version khác nhau. Luôn lấy đúng lệnh mà trang
> **New self-hosted runner** hiện ra cho máy bạn.

Workflow đổi đúng 1 dòng:

```yaml
  deploy:
    runs-on: self-hosted            # ← chạy trên máy bạn
    steps:
      - uses: actions/checkout@v7
      - run: docker compose up -d --build
```

| Ưu | Nhược |
| --- | --- |
| Miễn phí, toàn quyền | Máy phải bật; tự bảo trì |
| Dùng được Docker/DB/local network | **Code trong workflow chạy trên máy bạn** — repo public + PR từ lạ = rủi ro |
| Không giới hạn phút | Cấu hình phức tạp hơn |

> ⚠️ Nếu dùng self-hosted runner cho repo public, hãy chặn PR từ fork (`if: github.event.pull_request.head.repo.full_name == github.repository`) hoặc chỉ cho `workflow_dispatch`/`push` chạy job đó.

### 10.3. Thêm job build & push Docker image (GHCR)

Khi có backend, pipeline thêm job:

```yaml
  docker:
    name: Build & push image
    needs: test
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write          # ← quyền push lên GHCR
    steps:
      - uses: actions/checkout@v7

      - uses: docker/setup-buildx-action@v3

      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}   # dùng token của run, không cần secret riêng

      - uses: docker/build-push-action@v6
        with:
          context: .
          push: true
          tags: |
            ghcr.io/${{ github.repository }}:${{ github.sha }}
            ghcr.io/${{ github.repository }}:latest
          cache-from: type=gha
          cache-to: type=gha,mode=max
```

Điểm đáng học: `GITHUB_TOKEN` có quyền `packages: write` là push được GHCR — **không cần PAT**.

### 10.4. Deploy lên VPS bằng SSH

```yaml
  deploy-vps:
    needs: [test, docker]
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    environment: production          # có thể gắn approval
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/myapp
            docker compose pull
            docker compose up -d
            docker image prune -f
```

Secrets cần: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY` (private key, không passphrase hoặc dùng passphrase secret).

### 10.5. Environment + approval — "cổng duyệt" trước khi lên production

Job deploy đã khai báo `environment: github-pages`. Với server thật:

```yaml
    environment:
      name: production
      url: https://myapp.example.com
```

Vào Settings → Environments → `production` → bật **Required reviewers**.
Khi đó job deploy **dừng chờ** người được chỉ định bấm Approve — rất hữu ích cho production.

### 10.6. Deploy thủ công có kiểm soát (`workflow_dispatch` + `inputs`)

```yaml
on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Môi trường deploy'
        type: choice
        options: [staging, production]
        default: staging
      skip_tests:
        description: 'Bỏ qua test (chỉ dùng khi khẩn cấp)'
        type: boolean
        default: false
```

Dùng trong job:

```yaml
  deploy:
    if: github.event_name == 'workflow_dispatch' && inputs.environment == 'production'
    environment: production
```

### 10.7. Release tự động khi tag

```yaml
on:
  push:
    tags: ['v*']

jobs:
  release:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v7
      - run: npm ci && npm run build
      - run: zip -r site.zip dist
      - uses: softprops/action-gh-release@v2
        with:
          files: site.zip
          generate_release_notes: true
```

Push tag `v1.0.0` → tự tạo GitHub Release kèm file zip. Đây là "CD" cho bản phát hành.

### 10.8. Tối ưu tốc độ (khi pipeline dài)

| Kỹ thuật | Cách làm | Lợi |
| --- | --- | --- |
| Cache dependency | `setup-node` với `cache: npm` (đã làm) | Bỏ 20–40s `npm ci` |
| Cache build | `actions/cache` cho `node_modules`/`.next`/`dist` | Tuỳ dự án |
| Chạy song song | Bỏ `needs` giữa các job độc lập | Giảm wall-clock |
| Matrix nhỏ | Chỉ test version thật sự hỗ trợ | Giảm phút |
| `paths-ignore` | Bỏ qua khi chỉ sửa docs | Tránh chạy vô ích |
| Build tăng dần | Turborepo/Nx | Repo lớn |

Ví dụ `paths-ignore`:

```yaml
on:
  push:
    branches: [main]
    paths-ignore:
      - '**.md'
      - 'docs/**'
```

### 10.9. Lộ trình nâng cấp hợp lý từ demo này

```
Bước 1 (đang có): static site → Pages
Bước 2: thêm test E2E (Playwright) chạy trên URL preview
Bước 3: thêm backend Node → job docker build/push GHCR
Bước 4: deploy backend lên VPS/Fly.io bằng image đó
Bước 5: thêm migration DB, health check, rollback tự động
Bước 6: thêm monitoring (uptime robot) + alert
```

Mỗi bước chỉ **thêm job**, không phá cấu trúc hiện tại. Đó là lợi ích của việc tách job đúng ngay từ đầu.

---

## 11. Checklist tự dựng từ số 0

### 11.1. Chọn đường đi

| Cách | Dành cho | Làm gì |
| --- | --- | --- |
| **A. Chạy theo repo mẫu** | Muốn thấy pipeline chạy trong 5 phút | Clone repo demo → `npm run verify` → đọc guide song song → làm Lab 1 |
| **B. Dựng lại từ đầu** | Muốn hiểu tường tận | Làm checklist §11.3 theo đúng thứ tự |

> Với cách B: các file dài (`scripts/build.mjs`, `scripts/serve.mjs`, `tests/**`) **hãy copy từ repo mẫu**
> rồi đọc giải thích ở chương 5–6. Tài liệu dạy *cách hoạt động*, không in lại toàn bộ source; còn
> config/package.json thì in đầy đủ ở **Phụ lục B (§14)** để bạn không phải đoán version.

### 11.2. Chuẩn bị (bắt buộc)

1. Cài **Node LTS** (≥ 20), **git**; có **tài khoản GitHub**.
2. Trên GitHub: **New repository** → tên `cicd-demo` → **Public** → **không** tick README/gitignore/license.
3. Ở máy: `git init -b main`, rồi `git remote add origin https://github.com/<owner>/cicd-demo.git`.
4. Windows: nếu `npm` bị chặn ExecutionPolicy, dùng `npm.cmd` (xem §4.2).

### 11.3. Checklist 24 bước — làm đến đâu xanh đến đó

> Nguyên tắc: **bước sau chỉ bắt đầu khi bước trước xanh**. Dồn cả file workflow 297 dòng vào lần đầu
> là cách nhanh nhất để bỏ cuộc.

| # | Việc làm | Kiểm tra xong |
| --- | --- | --- |
| 1 | Tạo thư mục dự án; `git init -b main` | `git status` chạy được |
| 2 | Tạo `.gitignore` (`node_modules/`, `dist/`, `.env`), `.gitattributes` (`* text=auto eol=lf`), `.editorconfig` | `git status` chỉ có file nguồn |
| 3 | Viết `src/index.html`, `src/styles.css`, `src/app.js`, tách logic ra `src/lib/*.mjs` | chưa cần chạy — sẽ serve ở bước 7 |
| 4 | Tạo `package.json`: `type: module`, `engines.node >= 20`, các script như **Phụ lục B** | `node -p "require('./package.json').type"` → `module` |
| 5 | Cài devDependencies (**Phụ lục B** có lệnh đầy đủ) | có `package-lock.json` — **bắt buộc commit** |
| 6 | Thêm `eslint.config.js`, `.prettierrc.json`, `.prettierignore`, `.htmlvalidate.json` (Phụ lục B) | `npm run lint:js` chạy (chưa cần xanh) |
| 7 | Viết `scripts/serve.mjs` (copy repo mẫu, đọc §6.7) | `node scripts/serve.mjs src 5173` → mở `http://127.0.0.1:5173` thấy trang |
| 8 | Sửa cho `npm run lint` xanh (format bằng `npx prettier --write .`) | `npm run lint` xanh |
| 9 | Viết `scripts/build.mjs`: bundle, hash tên file, inject metadata (theo §5.2) | `npm run build` ra `dist/` đủ file |
| 10 | Thêm `.nojekyll` + `build-info.json` vào build (đã có trong script mẫu) | `dist/.nojekyll` tồn tại, `build-info.json` đọc được |
| 11 | Viết test unit cho `src/lib` (§6.3) | `node --test tests/unit` xanh |
| 12 | Viết `tests/integration/content.test.mjs` (§6.5) | `npm test` xanh |
| 13 | Viết helper build vào thư mục tạm + `build.test.mjs` (§6.4, §6.6) | `npm test` xanh, `git status` sạch |
| 14 | Viết `smoke.test.mjs` dùng `serve.mjs` + `fetch` (§6.7) | `npm test` xanh, 6 test smoke |
| 15 | Thêm script `verify` = lint + test + build | `npm run verify` xanh toàn bộ |
| 16 | Commit tất cả (**kể cả `package-lock.json`**) và push lên GitHub | `git push -u origin main` thành công, repo có code |
| 17 | Thêm workflow chỉ có job `lint` (§3.7) | Actions chạy, job lint xanh |
| 18 | Thêm job `test` matrix Node 20/22 + `needs: lint` (§3.8) | 2 job test xanh |
| 19 | Thêm job `build` + `upload-artifact` (§3.9) | artifact `site-dist` xuất hiện trong run |
| 20 | Bật Pages: Settings → Pages → Source: **GitHub Actions** | trang Pages báo đã bật |
| 21 | Thêm job `deploy`: permissions pages/id-token, environment, precheck (§3.10, §7.3) | push main → deploy xanh, URL mở được |
| 22 | Thêm smoke test trang live + job `report` (§3.10, §3.11) | run 5/5 xanh, tab Summary có báo cáo |
| 23 | Thêm badge README + smoke test 200 | badge hiện `passing` |
| 24 | Bật branch protection: required checks là 3 job CI | PR đỏ không merge được |

### 11.4. Nếu bị kẹt

| Hiện tượng | Làm gì |
| --- | --- |
| `npm ci` báo thiếu/lệch lockfile | Chạy `npm install`, commit `package-lock.json` |
| `npm run lint` đỏ ở bước 6–8 | `npx prettier --write .` rồi sửa lỗi ESLint/html-validate còn lại |
| Mở `src/index.html` bằng `file://` thấy trắng/Console đỏ | Bình thường: ES module bị CORS trên `file://`. Dùng `serve.mjs` (bước 7) |
| Push lên rồi mà Actions không chạy | Kiểm tra file nằm đúng `.github/workflows/`, thụt lề YAML, `actionlint` |
| Deploy đỏ `404 Get Pages site failed` | Chưa bật Pages — quay lại bước 20 |
| Không thấy nút "Run workflow" | `workflow_dispatch` chỉ hiện khi file workflow đã có trên **nhánh mặc định** |

Xong checklist này, bạn đã có pipeline tương đương demo. Tiếp theo làm **bài tập** ở chương 12 để
biến nó thành kỹ năng.
## 12. Bài tập

Bộ bài tập thực hành đầy đủ (**Lab 0 → Lab 8**) nằm ở **[BAI-TAP.md](BAI-TAP.md)**.
Đọc mục "Chuẩn bị" trong đó trước: bạn cần **fork repo** (không push được vào repo gốc), và biết lab nào
phải làm trên `main` (vì chỉ push/merge vào `main` mới deploy) lab nào làm trên nhánh.

| Lab | Nội dung | Học được |
| --- | --- | --- |
| 0 | Làm quen: đọc log, artifact, summary, trang live | Định hướng UI |
| 1 | Đổi nội dung trang, push **main**, xem metadata đổi theo | Vòng lặp CI/CD cơ bản |
| 2 | Làm pipeline đỏ bằng ESLint rồi sửa (trên nhánh + PR) | Debug job đầu tiên |
| 3 | Làm job Prettier đỏ bằng nháy kép, sửa bằng `prettier --write` | Format là gì |
| 4 | Thêm placeholder mới `__BUILD_ID__` | Build script + fail fast |
| 5 | Thêm test cho mốc thời gian 59s / 60s / 90s | Viết test với node:test |
| 6 | Thêm matrix Node 24 | Matrix strategy |
| 7 | Thêm `workflow_dispatch` input boolean `deploy` | Inputs, điều kiện |
| 8 | Thêm job build Docker image (không push) | Container trong CI |

---

## 13. Phụ lục: thuật ngữ, FAQ, tra cứu

### 13.1. Thuật ngữ

| Thuật ngữ | Nghĩa ngắn |
| --- | --- |
| Workflow | Một file YAML mô tả quy trình tự động |
| Event / trigger | Sự kiện kích hoạt workflow (push, PR, schedule, dispatch) |
| Job | Nhóm step chạy trên một máy ảo |
| Step | Một bước trong job (`uses:` hoặc `run:`) |
| Action | Gói code tái sử dụng (`actions/checkout`) |
| **Runner** | Máy chạy job: máy ảo GitHub hoặc self-hosted |
| **Artifact** | File/thư mục được đóng gói để giữ lại hoặc chuyển giữa job |
| **Cache** | Bộ nhớ đệm giữa các run (npm, build) — khác artifact ở chỗ có thể dùng lại nhiều lần |
| **Matrix** | Nhân job theo tổ hợp biến (ví dụ Node 20 & 22) |
| **Lockfile** | `package-lock.json` — ghi phiên bản chính xác; `npm ci` bắt buộc dùng file này |
| **SHA / commit SHA** | Mã 40 ký tự định danh duy nhất một commit (vd `27fa679c...`) |
| **PR (Pull Request)** | Đề nghị merge nhánh này vào nhánh khác; nơi CI chạy trước khi merge |
| **DAG** | Đồ thị có hướng không chu trình — thứ tự job do `needs` tạo thành |
| **Context** | Nhóm biến do Actions cung cấp (`${{ github.* }}`, `${{ needs.* }}`...) |
| Runner | Máy chạy job (`ubuntu-latest` hoặc self-hosted) |
| Artifact | File được giữ lại/chuyển giữa job |
| Cache | Bộ nhớ đệm giữa các run (npm, build) |
| Matrix | Nhân job theo tổ hợp biến |
| Context | Không gian biến `${{ github.* }}`, `${{ needs.* }}`... |
| Environment | Môi trường deploy (staging/production) gắn lịch sử + approval |
| OIDC | Cách lấy token ngắn hạn để deploy, không cần secret dài hạn |
| `GITHUB_TOKEN` | Token tự tạo cho mỗi run, quyền do `permissions:` quyết định |
| Concurrency | Giới hạn số run cùng nhóm chạy đồng thời |
| Step Summary | Báo cáo Markdown hiện ở tab Summary của run |
| CI/CD | Tích hợp/triển khai liên tục |
| Fail fast | Dừng sớm khi gặp lỗi rẻ nhất |

### 13.2. FAQ

**Q: Repo private có dùng Pages được không?**
A: Không trên gói Free. Cần GitHub Pro/Team, hoặc dùng Cloudflare Pages/Netlify (cũng free).

**Q: Có bắt buộc dùng Node 22 không?**
A: Không. Demo dùng 20/22 vì `node:test` ổn định từ 20. Bạn có thể dùng 18+ nhưng hãy kiểm tra
`engines` và test trên đúng version sẽ deploy.

**Q: Tại sao `npm test` chạy được 37 test mà không cần Jest?**
A: Node ≥ 18 có test runner tích hợp (`node:test`) + `node:assert`. Ít dependency = ít bảo trì.

**Q: Tại sao build phải dùng esbuild mà không viết JS trực tiếp?**
A: Để có minify + bundle + kiểm soát chặt. Với trang tĩnh cực nhỏ, viết tay cũng được, nhưng
khi dự án lớn lên bạn sẽ cần bundler — học từ đầu sẽ nhẹ hơn.

**Q: Nếu Pages bị lỗi thì site có sập không?**
A: Bản đang chạy vẫn phục vụ. Deploy mới fail chỉ làm run đỏ, không đè bản cũ (deploy chỉ hoàn tất
khi API nhận thành công). Đó là lợi ích của deploy qua artifact.

**Q: Có cần Docker ở local để chạy pipeline này không?**
A: Không. Demo cố tình không dùng Docker. Docker chỉ cần khi thêm job container hoặc `act`.

**Q: Badge hiện "passing" nhưng run gần nhất của tôi đỏ?**
A: Badge có thể cache (vài phút) hoặc trỏ nhầm nhánh. Kiểm tra `?branch=main` trong URL badge.

**Q: Làm sao để pipeline chạy nhanh hơn?**
A: Cache npm (đã bật), giảm matrix, bỏ job không cần, chỉ chạy deploy trên main (đã làm).

**Q: Tôi đổi tên nhánh main thành master thì sao?**
A: Sửa `branches: [main]` và `if: github.ref == 'refs/heads/main'` trong workflow.

**Q: Có cần bật Pages trước hay push trước?**
A: Push trước cũng được, chỉ là job deploy sẽ đỏ ở precheck với hướng dẫn rõ ràng. Bật Pages rồi
bấm "Re-run failed jobs".

### 13.3. Tra cứu nhanh

- Cú pháp workflow, trigger, context, action phổ biến: **[CHEATSHEET.md](CHEATSHEET.md)**
- Dựng repo + PAT + Pages từ đầu: **[GITHUB-SETUP.md](GITHUB-SETUP.md)**
- Bài thực hành: **[BAI-TAP.md](BAI-TAP.md)**
- Tài liệu chính thức: <https://docs.github.com/actions>

---

## 14. Phụ lục B: nguyên liệu copy-paste

> Mục đích: gom mọi thứ "khô" (version, config, lệnh) để bạn dựng lại nhanh, không phải đoán.
> Các file dài (`scripts/build.mjs`, `scripts/serve.mjs`, `tests/**`) hãy **copy từ repo mẫu** —
> chúng đã được giải thích ở chương 5–6.

### B.1. Cài dependency (bước 5 của checklist)

```bash
npm install --save-dev \
  eslint@^10 @eslint/js@^10 globals@^17 \
  prettier@^3 html-validate@^11 esbuild@^0.28
```

> Version trên khớp repo demo tại thời điểm viết (11/2026). Muốn bám **đúng** bản đã chạy xanh:
> copy `package.json` + `package-lock.json` từ repo rồi chạy `npm ci`.

### B.2. `package.json` đầy đủ

```json
{
  "name": "cicd-demo",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": { "node": ">=20" },
  "scripts": {
    "lint:js": "eslint .",
    "lint:html": "html-validate \"src/**/*.html\"",
    "lint:format": "prettier --check .",
    "lint": "npm run lint:js && npm run lint:html && npm run lint:format",
    "build": "node scripts/build.mjs",
    "test": "node --test",
    "dev": "node scripts/serve.mjs src 5173",
    "preview": "npm run build && node scripts/serve.mjs dist 4173",
    "verify": "npm run lint && npm test && npm run build"
  }
}
```

`devDependencies` do lệnh B.1 tự thêm vào — không cần gõ tay.

### B.3. `eslint.config.js`

```js
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'dist/**', 'tmp/**', 'coverage/**', '.tmp/**'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.browser } },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }], eqeqeq: ['error', 'always'] },
  },
  {
    files: ['scripts/**/*.mjs', 'tests/**/*.mjs', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 2023, sourceType: 'module', globals: { ...globals.node } },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^_' }], eqeqeq: ['error', 'always'] },
  },
];
```

### B.4. `.prettierrc.json` và `.prettierignore`

```json
{
  "printWidth": 100,
  "singleQuote": true,
  "trailingComma": "all",
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

```gitignore
node_modules/
dist/
tmp/
coverage/
test-results/
package-lock.json
*.md
```

> Prettier bỏ qua `*.md` để bạn không phải format lại tài liệu/bảng — đây là lựa chọn có chủ ý.

### B.5. `.htmlvalidate.json`

```json
{
  "extends": ["html-validate:recommended"],
  "rules": {
    "no-inline-style": "off",
    "doctype-style": ["error", { "style": "lowercase" }],
    "attr-quotes": ["error", { "style": "double" }],
    "void-style": ["error", { "style": "selfclosing" }],
    "no-trailing-whitespace": "off"
  }
}
```

Vì sao `doctype-style: lowercase`? Prettier tự hạ `<!DOCTYPE html>` thành `<!doctype html>`;
html-validate mặc định lại đòi uppercase → hai tool cãi nhau. Cấu hình về `lowercase` để cả hai đồng ý.
Đây là bài học thật gặp trong demo (job lint đỏ vì đúng lỗi này).

### B.6. `.gitignore` và `.gitattributes`

```gitignore
node_modules/
dist/
.tmp/
test-results/
coverage/
.env
.env.*
*.log
```

```gitattributes
* text=auto eol=lf
```

Sau khi thêm `.gitattributes` lần đầu, chuẩn hoá lại line ending (nếu repo đã có commit):

```bash
git add --renormalize .
git commit -m "chore: chuan hoa line ending LF"
```

### B.7. Các file nên copy từ repo mẫu

| File | Vì sao copy thay vì gõ | Đọc giải thích ở |
| --- | --- | --- |
| `scripts/build.mjs` | ~290 dòng, nhiều nhánh xử lý metadata/asset | §5.2 |
| `scripts/serve.mjs` | ~170 dòng, có chống path traversal + MIME | §6.7 |
| `tests/helpers/build.mjs` | helper build vào thư mục tạm | §6.4 |
| `tests/unit/*.test.mjs`, `tests/integration/*.test.mjs` | 37 test — nên đọc để hiểu, copy để chạy | chương 6 |
| `src/**` | trang demo; thay nội dung theo ý bạn | chương 2 |

Cách nhanh nhất:

```bash
# clone repo mẫu ra thư mục tạm rồi copy những gì cần
git clone https://github.com/LySyaoran/cicd-demo.git _demo
cp -r _demo/scripts _demo/tests .
cp -r _demo/src/. src/          # hoặc tự viết src của bạn
rm -rf _demo
```

### B.8. Kiểm tra sau khi ghép

```bash
npm ci          # nếu đã copy package-lock.json
npm run verify  # phải xanh: lint + 37 test + build
```

Nếu `npm test` báo thiếu file `src/...` thì bạn chưa copy đủ `src/lib/` — test import trực tiếp từ đó.

## Kết

Pipeline này không có gì "cao siêu": chỉ là **5 job nối nhau đúng thứ tự**, mỗi job làm một việc nhỏ,
mỗi bước có lệnh kiểm tra được. Cái làm nó đáng tin là:

1. **Mọi thứ chạy được ở local** (`npm run verify`) — CI chỉ là nơi chạy lại.
2. **Mỗi bản deploy có dấu vân tay** (SHA, run number, thời gian) — kiểm chứng được bằng mắt.
3. **Fail fast và fail loud** — sai thì đỏ ngay, kèm thông báo chỉ đúng chỗ sửa.
4. **Không có secret dài hạn** — quyền tối thiểu, OIDC.
5. **Rollback bằng `git revert`** — vì mọi thứ đi qua git.

Khi bạn tự dựng lại, thứ tự học nên là: **chạy được local → lint → test → build → deploy → báo cáo**.
Đừng cố viết workflow hoàn hảo ngay từ đầu; hãy để pipeline đỏ, đọc lỗi, sửa — đó chính là cách
demo này được hoàn thiện (run #1 đỏ → sửa → run #4 xanh).