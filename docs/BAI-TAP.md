# Bài tập thực hành — CI/CD với GitHub Actions

Làm trên **bản fork** của repo demo. Mỗi lab có: mục tiêu → các bước → kết quả mong đợi →
**lệnh kiểm** → **đáp án ngắn** → tiêu chí xong.

---

## Chuẩn bị (bắt buộc, đừng bỏ)

### 1. Fork — bạn không push được vào repo gốc

1. Mở <https://github.com/LySyaoran/cicd-demo> → bấm **Fork** → tạo bản của bạn.
2. Clone **fork của bạn** (không phải repo gốc):

```bash
git clone https://github.com/<tên-bạn>/cicd-demo.git
cd cicd-demo
git remote -v      # phải thấy origin = fork của bạn
```

3. Nếu repo bạn clone từ máy đã có sẵn `origin` trỏ repo gốc, sửa lại:
   `git remote set-url origin https://github.com/<tên-bạn>/cicd-demo.git`

> Nếu chưa quen fork: đây chỉ là "bản sao repo dưới tài khoản bạn" để bạn có quyền push.
> Không cần quyền gì từ tác giả gốc.

### 2. Chạy thử ở local trước khi làm lab

```bash
npm ci
npm run verify     # phải xanh: lint + 37 test + build
```

### 3. Chọn nhánh cho từng lab

| Lab | Làm trên | Vì sao |
| --- | --- | --- |
| 0, 1, 4, 7 | **`main`** | Cần deploy thật / cần thấy nút **Run workflow** (chỉ hiện với workflow trên nhánh mặc định) |
| 2, 3, 5, 6, 8 | nhánh riêng + PR | Học nhánh `pull_request`: CI chạy nhưng **không deploy** |

Tạo nhánh: `git switch -c lab-2`

> ⚠️ Push lên nhánh phụ thì **trang live sẽ không đổi** — đúng thiết kế (`if:` chặn deploy).
> Đừng tưởng pipeline hỏng. Muốn thấy deploy: merge/push vào `main`.

### 4. Windows

Nếu `npm` báo `npm.ps1 cannot be loaded because running scripts is disabled` → dùng `npm.cmd`
(xem hộp Windows ở `docs/HUONG-DAN.md` §4.2).

---

## Lab 0 — Làm quen (10 phút)

**Mục tiêu:** biết tìm đúng 4 nơi: log, artifact, summary, trang live.

1. Repo fork → tab **Actions** → mở run gần nhất (nếu fork chưa có run: vào **Actions** → chọn
   workflow `CI/CD` → **Run workflow**).
2. Mở từng job, bấm từng step đọc log.
3. Tab **Summary** — xem báo cáo bảng kết quả.
4. Phần **Artifacts** cuối trang run — tải `site-dist.zip`, giải nén, mở `index.html`.
5. Mở trang live của fork: `https://<tên-bạn>.github.io/cicd-demo/` (nếu bật Pages ở lab 1).

**Kiểm:** chỉ đúng được nơi chứa (1) log job, (2) artifact, (3) summary, (4) trang live.

---

## Lab 1 — Vòng lặp CI/CD cơ bản (15 phút, trên `main`)

**Mục tiêu:** thấy pipeline tự deploy và metadata đổi theo commit.

1. Đổi hero cho **khác rõ rệt** (không chỉ dấu chấm):

```html
<h1>Pipeline xanh,<br /><span class="gradient-text">deploy tự động thật rồi!</span></h1>
```

2. Thêm một dòng mô tả dưới `lede`:

```html
<p class="muted">Lần sửa này do <strong>tôi</strong> push — xem SHA bên dưới thay đổi.</p>
```

3. `npm run verify` → xanh.
4. `git add -A && git commit -m "test: doi noi dung hero" && git push` (lên `main`).
5. Đợi ~1 phút, mở trang live, Ctrl+F5.

**Kết quả mong đợi:** run xanh; hero đổi; **commit SHA / run number / thời gian build trên trang đổi theo**.

**Lệnh kiểm:**

```bash
git rev-parse --short HEAD                     # SHA của bạn
curl -s https://<tên-bạn>.github.io/cicd-demo/build-info.json   # (cần curl) xem shortCommit
```

**Đáp án ngắn:** trang live hiển thị đúng 7 ký tự đầu SHA bạn vừa push; `runNumber` tăng lên.

**Tiêu chí xong:** trang live có chữ mới **và** SHA khớp commit của bạn.

---

## Lab 2 — Làm pipeline đỏ bằng ESLint (15 phút, nhánh + PR)

**Mục tiêu:** đọc và sửa lỗi từ job lint.

1. `git switch -c lab-2`, thêm vào cuối `src/lib/format.mjs`:

```js
const unusedVariable = 42;
```

2. `npm run lint:js` → lỗi `'unusedVariable' is assigned a value but never used`.
3. Push nhánh, mở PR vào `main` của **fork bạn** → job `1 · Lint` đỏ.
4. Sửa (xoá dòng đó), push lại → xanh. Merge PR nếu muốn.

**Đáp án ngắn:** lỗi ESLint ở dòng **cuối** log, kèm tên rule; CI báo đúng file:dòng.

**Tiêu chí xong:** giải thích được **vì sao PR không tự deploy** dù CI xanh (do `if:` của job deploy).

---

## Lab 3 — Prettier đỏ (10 phút, nhánh)

**Mục tiêu:** hiểu `--check` vs `--write`.

1. `git switch -c lab-3`, trong `src/app.js` đổi dòng đầu thành **nháy kép**:

```js
const THEME_KEY = "cicd-demo:theme";
```

2. `npm run lint:format` → đỏ (Prettier cấu hình `singleQuote: true`).
3. `npx prettier --write src/app.js` → tự đổi về nháy đơn.
4. `npm run lint` → xanh.

**Lệnh kiểm:** `npx prettier --check .` → "All matched files use Prettier code style!"

**Đáp án ngắn:** job lint đỏ nhưng **không** có nghĩa code sai — chỉ là format lệch quy ước.

---

## Lab 4 — Thêm placeholder mới (20 phút, trên `main`)

**Mục tiêu:** hiểu build script, metadata injection, fail-fast.

1. Trong `src/index.html` (khu vực build card), thêm:

```html
<div>
  <dt>Build ID</dt>
  <dd class="mono">__BUILD_ID__</dd>
</div>
```

2. `npm run build` → **fail**: `Còn placeholder chưa được thay: __BUILD_ID__`.
3. Trong `scripts/build.mjs`, thêm vào object `replacements`:

```js
__BUILD_ID__: `${meta.shortSha}-${meta.runNumber}`,
```

4. Trong `tests/integration/content.test.mjs`, thêm `'__BUILD_ID__'` vào mảng placeholders
   (mảng này "khoá hợp đồng": bảo đảm HTML luôn còn chỗ để build tiêm).
5. `npm run verify` → xanh. Push `main`, chờ deploy, xem trang live.

**Kết quả mong đợi:** Build ID dạng `<7-ký-tự-SHA-của-bạn>-<run-number>`; ví dụ với demo là `27fa679-4`,
với bạn sẽ là SHA/run của bạn.

**Đáp án ngắn:** build fail vì `PLACEHOLDER_PATTERN` quét thấy `__BUILD_ID__` còn sót — **tính năng
an toàn**, không phải bug.

**Tiêu chí xong:** giải thích được vì sao nên fail thay vì để trang hiện chữ `__BUILD_ID__`.

---

## Lab 5 — Test mốc thời gian (20 phút, nhánh)

**Mục tiêu:** viết test với `node:test`, hiểu `Math.round` tạo ranh giới.

1. Thêm vào `tests/unit/format.test.mjs`:

```js
test('formatRelativeTime quanh mốc 1 phút', () => {
  const now = Date.parse('2026-11-12T10:00:00.000Z');
  const at = (ms) => new Date(now - ms).toISOString();

  assert.equal(formatRelativeTime(at(59_000), now), 'vừa xong');
  assert.equal(formatRelativeTime(at(60_000), now), '1 phút trước');
  assert.equal(formatRelativeTime(at(90_000), now), '2 phút trước');
});
```

2. Chạy `npm test` → xanh, số test tăng 37 → 38.

**Câu hỏi tự trả lời:** vì sao 90 giây lại là "2 phút trước" mà không phải "1 phút trước"?
(`Math.round` → 1.5 làm tròn lên 2.) Nếu muốn "1 phút trước", phải dùng `Math.floor` — thử đổi
`formatRelativeTime` và xem test nào đỏ.

**Lệnh kiểm:** `node --test tests/unit/format.test.mjs`

**Đáp án ngắn:** test **quyết định hành vi**, không phải chép lại output. Đổi công thức làm test đỏ
nghĩa là test đang bảo vệ đúng thứ cần bảo vệ.

---

## Lab 6 — Thêm Node 24 vào matrix (15 phút, nhánh)

**Mục tiêu:** matrix strategy + `fail-fast`.

1. Trong `.github/workflows/ci-cd.yml`:

```yaml
        node-version: ['20', '22', '24']
```

2. Kiểm tra YAML (nếu có actionlint), push nhánh, mở PR.
3. Quan sát **3 job** test chạy song song.
4. Đổi `fail-fast: true`, tạo lỗi chỉ ở Node 24 (ví dụ dùng API mới) → các job còn lại bị huỷ.

**Kết quả mong đợi:** hiểu `fail-fast: false` giữ thông tin, `true` tiết kiệm thời gian.

**Lệnh kiểm:** PR có 3 check `2 · Test (Node ...)`.

**Đáp án ngắn:** matrix là **nhân job**, không phải nhân step; mỗi biến thể là một job riêng, tính phút riêng.

---

## Lab 7 — Thêm input cho "Run workflow" (20 phút, trên `main`)

**Mục tiêu:** `workflow_dispatch` + `inputs` + `if`.

1. Sửa trigger:

```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:
    inputs:
      deploy:
        description: 'Deploy lên Pages?'
        type: boolean
        default: true
```

2. Sửa `if:` của job deploy:

```yaml
    if: |
      github.event_name != 'pull_request' &&
      github.ref == 'refs/heads/main' &&
      (github.event_name != 'workflow_dispatch' || inputs.deploy)
```

3. Push **main** (để workflow trên nhánh mặc định có input), rồi vào **Actions → CI/CD → Run workflow**,
   chọn `deploy = false`.

**Kết quả mong đợi:** job deploy `skipped`, job report vẫn **xanh** (vì report chỉ coi `failure` là lỗi).

**Lệnh kiểm:** run vừa chạy có 4 job xanh + 1 job skipped; nhấn thử với `deploy = true` → deploy chạy.

**Đáp án ngắn:** `workflow_dispatch` chỉ hiện nút khi file workflow nằm trên nhánh mặc định.
Biểu thức `||` short-circuit nên trên `push` (inputs rỗng) điều kiện vẫn đúng.

---

## Lab 8 — Build Docker image trong CI (30 phút, nhánh)

**Mục tiêu:** làm quen container trong pipeline (chưa cần server).

> Cần Docker trên **runner GitHub** (có sẵn) — không cần Docker ở máy bạn.

1. Tạo `Dockerfile` ở gốc:

```dockerfile
FROM nginx:alpine
COPY dist/ /usr/share/nginx/html/
EXPOSE 80
```

2. Thêm job:

```yaml
  docker:
    name: 6 · Docker image
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v7
      - uses: actions/download-artifact@v8
        with:
          name: site-dist
          path: dist
      - run: docker build -t cicd-demo:${GITHUB_SHA::7} .
      - run: docker image ls
```

3. Push nhánh, xem job docker trong run.

**Kết quả mong đợi:** image build xong trong runner (log `docker image ls` có `cicd-demo:<sha>`).

**Đáp án ngắn:** job docker **phải** `needs: build` + tải artifact, vì máy ảo mới không có `dist/`.

**Tiêu chí xong:** giải thích được tại sao `COPY dist/` sẽ fail nếu quên `download-artifact`.

---

## Bài tập tổng hợp (chọn 1, làm thành PR)

| Hướng | Việc cần làm | Học được |
| --- | --- | --- |
| E2E | Playwright test chạy trên URL Pages sau deploy | Test browser thật trong CI |
| Performance | Lighthouse CI, fail nếu điểm < 90 | Ngưỡng chất lượng |
| Bảo mật | `npm audit --audit-level=high` | Supply chain |
| Release | GitHub Release khi push tag `v*` | Artifact phát hành |
| Preview | Deploy PR preview ra Pages phụ | Nhiều environment |
| Alerts | Slack/Discord khi pipeline đỏ | Observability |

---

## Tự chấm điểm

| Mức | Đạt được |
| --- | --- |
| Cơ bản | Lab 1–3: sửa → push → CI xanh/đỏ, đọc được log |
| Khá | Lab 4–6: hiểu build script, viết được test, cấu hình matrix |
| Tốt | Lab 7–8 + tổng hợp: tự thêm job mới vào pipeline |
| Chuyên nghiệp | Dựng lại pipeline tương đương từ repo trống, **không nhìn lại demo** (checklist chương 11 của HUONG-DAN.md) |

**Bảng kết quả kỳ vọng nhanh:**

| Lab | Dấu hiệu đúng |
| --- | --- |
| 1 | trang live đổi chữ + SHA khớp commit |
| 2 | job Lint đỏ với `no-unused-vars`, sửa thì xanh |
| 3 | `prettier --check` đỏ → `--write` → xanh |
| 4 | build fail `Còn placeholder chưa được thay` → thêm replacement → xanh |
| 5 | `npm test` báo 38 test |
| 6 | PR có 3 job test |
| 7 | deploy `skipped` khi input `false`, report vẫn xanh |
| 8 | log job docker có `cicd-demo:<sha>` |
