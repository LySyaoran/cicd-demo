# Bài tập thực hành — CI/CD với GitHub Actions

Làm trên **chính repo demo** (hoặc repo fork của bạn). Mỗi lab có:

- **Mục tiêu** — bạn học được gì
- **Các bước** — làm gì, sửa file nào
- **Kết quả mong đợi** — thấy gì trên GitHub
- **Gợi ý** — chỉ mở khi bí
- **Tiêu chí xong** — tự chấm

> ⚠️ Trước khi lab 1, chắc chắn pipeline đang **xanh** và bạn đã biết lệnh `git push` lên repo.
> Mỗi lab nên làm trên một nhánh: `git switch -c lab-1`.

---

## Lab 0 — Làm quen (10 phút)

**Mục tiêu:** hiểu vòng lặp cơ bản *sửa → push → CI chạy → xem kết quả*.

1. Mở repo trên GitHub → tab **Actions** → vào run gần nhất, bấm từng job đọc log.
2. Mở tab **Summary**, xem báo cáo bảng kết quả.
3. Mở **Artifacts**, tải `site-dist.zip`, giải nén mở `index.html` → thấy thông tin build.
4. Mở trang live, đối chiếu commit SHA trên trang với commit trong repo.

**Tiêu chí xong:** chỉ được vào đúng nơi chứa (1) log job, (2) artifact, (3) summary, (4) trang live.

---

## Lab 1 — Vòng lặp CI/CD cơ bản (15 phút)

**Mục tiêu:** thấy bằng chứng pipeline tự deploy thật.

1. Sửa tiêu đề hero trong `src/index.html`:

   ```html
   <h1>Pipeline xanh,<br /><span class="gradient-text">deploy tự động!</span></h1>
   ```

2. Chạy local: `npm run verify` → phải xanh.
3. Commit + push lên `main`.
4. Đợi ~1-2 phút, mở trang live → chữ mới xuất hiện, **commit SHA trên trang đổi theo**.

**Kết quả mong đợi:** run mới xanh; commit SHA, run number, thời gian build trên trang cập nhật.

**Gợi ý:** nếu trang chưa đổi, chờ thêm 30s (CDN) rồi Ctrl+F5.

**Tiêu chí xong:** trang live hiển thị đúng commit bạn vừa push (so khớp 7 ký tự đầu).

---

## Lab 2 — Làm pipeline đỏ bằng ESLint, rồi sửa (15 phút)

**Mục tiêu:** đọc và sửa lỗi từ job lint.

1. Thêm vào cuối `src/lib/format.mjs`:

   ```js
   const unusedVariable = 42;
   ```

2. Chạy `npm run lint:js` → thấy lỗi `'unusedVariable' is assigned a value but never used`.
3. Thử push lên nhánh `lab-2` và mở PR vào `main` → job `1 · Lint` đỏ.
4. Sửa: xoá dòng đó (hoặc dùng biến đó thật), push lại → xanh.

**Gợi ý:** lỗi ESLint nằm ở dòng **cuối** cùng của log, có tên rule trong ngoặc.

**Tiêu chí xong:** giải thích được vì sao PR không tự deploy dù CI xanh.

---

## Lab 3 — Prettier đỏ (10 phút)

**Mục tiêu:** hiểu format check là gì và cách sửa đúng.

1. Trong `src/app.js`, đổi một dòng thành sai format, ví dụ thêm dấu nháy đơn:

   ```js
   const THEME_KEY = "cicd-demo:theme";
   ```

2. `npm run lint:format` → đỏ (Prettier muốn `singleQuote`).
3. Chạy `npx prettier --write src/app.js` → tự sửa.
4. Chạy lại `npm run lint` → xanh. Push.

**Gợi ý:** CI dùng `prettier --check` (chỉ báo), local dùng `--write` (tự sửa).

**Tiêu chí xong:** bạn không bao giờ phải sửa format bằng tay nữa.

---

## Lab 4 — Thêm placeholder mới vào build (20 phút)

**Mục tiêu:** hiểu build script, metadata injection và cơ chế fail-fast.

1. Trong `src/index.html`, thêm một dòng vào build card:

   ```html
   <div>
     <dt>Build ID</dt>
     <dd class="mono">__BUILD_ID__</dd>
   </div>
   ```

2. Chạy `npm run build` → build **fail** với `Còn placeholder chưa được thay: __BUILD_ID__`.
3. Vào `scripts/build.mjs`, thêm vào object `replacements`:

   ```js
   __BUILD_ID__: `${meta.shortSha}-${meta.runNumber}`,
   ```

4. Trong `tests/integration/content.test.mjs`, thêm `'__BUILD_ID__'` vào mảng placeholders.
5. `npm run verify` → xanh. Push, xem trang live → thấy Build ID dạng `27fa679-4`.

**Gợi ý:** đây chính là cách demo đã làm với `__TOTAL_SIZE__`.

**Tiêu chí xong:** giải thích được vì sao build fail là **tính năng**, không phải lỗi.

---

## Lab 5 — Viết test mới (20 phút)

**Mục tiêu:** viết test với `node:test` không cần framework.

1. Mở `tests/unit/format.test.mjs`, thêm test cho trường hợp biên:

   ```js
   test('shortenSha không vượt quá độ dài chuỗi gốc', () => {
     assert.equal(shortenSha('abc', 100), 'abc');
   });
   ```

   (Trước tiên sửa `shortenSha` trong `src/lib/format.mjs` để pass nếu cần.)

2. Thêm test cho `formatRelativeTime` với mốc 90 giây → `'1 phút trước'` hoặc `'2 phút trước'`?
   Kiểm tra `Math.round` để quyết định kỳ vọng đúng.

3. `npm test` → xanh, số test tăng lên 39.

**Gợi ý:** test phải **quyết định** hành vi, không chỉ chép lại output hiện tại một cách mù quáng.

**Tiêu chí xong:** `npm test` báo 39 test (hoặc hơn) và bạn giải thích được mỗi assert.

---

## Lab 6 — Thêm Node 24 vào matrix (15 phút)

**Mục tiêu:** matrix strategy và fail-fast.

1. Sửa `.github/workflows/ci-cd.yml`:

   ```yaml
   matrix:
     node-version: ['20', '22', '24']
   ```

2. Chạy `actionlint .github/workflows/ci-cd.yml` (nếu có) → không lỗi.
3. Push nhánh `lab-6`, mở PR → thấy **3 job** test chạy song song.
4. Thử đặt `fail-fast: true` rồi làm một version đỏ (ví dụ dùng API chỉ có ở 22) → quan sát
   các job khác bị huỷ.

**Kết quả mong đợi:** hiểu `fail-fast` ảnh hưởng gì tới thời gian và thông tin nhận được.

**Tiêu chí xong:** giải thích được khi nào chọn `true`, khi nào `false`.

---

## Lab 7 — Thêm input cho "Run workflow" (20 phút)

**Mục tiêu:** `workflow_dispatch` + `inputs` + điều kiện `if`.

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

2. Thêm điều kiện cho job deploy:

   ```yaml
   if: |
     github.event_name != 'pull_request' &&
     github.ref == 'refs/heads/main' &&
     (github.event_name != 'workflow_dispatch' || inputs.deploy)
   ```

3. Push, vào Actions → **Run workflow** → chọn `deploy = false` → chạy.
4. Quan sát: job deploy `skipped`, job report vẫn xanh.

**Gợi ý:** biểu thức nhiều dòng dùng `|` (literal block) và phải giữ đúng thụt lề.

**Tiêu chí xong:** chạy tay được 2 chế độ "có deploy" / "không deploy".

---

## Lab 8 — Build Docker image trong CI (30 phút)

**Mục tiêu:** làm quen container trong pipeline (chưa cần server).

> Lab này cần Docker **chạy trên runner GitHub** — không cần Docker ở máy bạn. Nhưng để test
> local, cài Docker Desktop.

1. Tạo `Dockerfile` ở gốc repo:

   ```dockerfile
   FROM nginx:alpine
   COPY dist/ /usr/share/nginx/html/
   EXPOSE 80
   ```

2. Thêm job vào workflow (chỉ build, chưa push):

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

3. Push → job docker chạy trên runner, build image thành công (chỉ trong runner, không lưu lại).

**Gợi ý:** muốn thấy image thật sự thì thêm bước `docker save -o image.tar` rồi upload artifact,
hoặc nâng cấp lên push GHCR (xem chương 10 của HUONG-DAN.md).

**Tiêu chí xong:** giải thích được vì sao pipeline cần artifact `site-dist` trước khi build Docker.

---

## Bài tập tổng hợp (nếu muốn đi xa)

Chọn **một** trong các hướng sau và làm thành PR:

| Hướng | Việc cần làm | Học được |
| --- | --- | --- |
| E2E | Thêm Playwright test chạy trên URL Pages sau deploy | Test browser thật trong CI |
| Performance | Thêm Lighthouse CI, fail nếu điểm < 90 | Ngưỡng chất lượng |
| Bảo mật | Thêm `npm audit --audit-level=high` | Supply chain |
| Release | Tự tạo GitHub Release khi push tag `v*` | Artifact phát hành |
| Preview | Deploy PR preview ra subfolder/Pages phụ | Nhiều environment |
| Alerts | Gửi Slack/Discord khi pipeline đỏ | Observability |

---

## Cách tự chấm điểm

| Mức | Bạn đạt được |
| --- | --- |
| Cơ bản | Lab 1–3: sửa → push → CI xanh/đỏ, đọc được log |
| Khá | Lab 4–6: hiểu build script, viết được test, cấu hình matrix |
| Tốt | Lab 7–8 + tổng hợp: tự thêm job mới vào pipeline |
| Chuyên nghiệp | Tự dựng pipeline tương đương từ repo trống, không nhìn lại demo |
