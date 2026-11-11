# Dựng GitHub repo + PAT + Pages từ đầu

Tài liệu này dành cho trường hợp bạn muốn tự tay dựng lại từ đầu (máy mới, tài khoản khác).
Nếu repo đã chạy được pipeline thì có thể bỏ qua.

## 1. Tạo Fine-grained PAT

Vào <https://github.com/settings/personal-access-tokens/new>:

1. **Token name**: `cicd-demo-push`
2. **Expiration**: 7 ngày (hoặc 30 ngày) — xong demo thì thu hồi.
3. **Repository access** → **Only select repositories** → chọn đúng repo `cicd-demo`
   (khi repo chưa tồn tại, chọn *All repositories* tạm thời hoặc tạo repo trước rồi quay lại).
4. **Permissions** cần thiết:

   | Permission | Mức | Dùng để |
   | --- | --- | --- |
   | **Contents** | Read and write | push code |
   | **Workflows** | Read and write | cập nhật file trong `.github/workflows/` |
   | **Pages** | Read and write | bật/đổi source Pages (tuỳ chọn — action `configure-pages` cũng tự bật được) |
   | **Metadata** | Read (mặc định) | bắt buộc |

5. Generate token → copy chuỗi `github_pat_...`.

> Token này chỉ là "mật khẩu tạm" để push. Sau khi demo xong hãy vào lại trang token và **Revoke**.
> Không bao giờ commit token vào repo hay gửi vào file `.env` rồi push.

## 2. Tạo repo

Cách A — trên web: New repository → name `cicd-demo` → **Public** (bắt buộc để dùng Pages miễn phí) → không thêm README.

Cách B — bằng API:

```bash
curl -X POST https://api.github.com/user/repos \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -d '{"name":"cicd-demo","private":false,"description":"Demo CI/CD on GitHub Actions"}'
```

## 3. Push code

```bash
git init -b main
git add .
git commit -m "feat: CI/CD demo pipeline"
git remote add origin https://github.com/<owner>/cicd-demo.git
git push -u origin main
```

Push lần đầu sẽ kích hoạt run đầu tiên ngay.

## 4. Bật GitHub Pages

Có 2 cách:

**Cách 1 (khuyến nghị) — để pipeline tự bật:** workflow đã có `configure-pages` với `enablement: true`,
nên job deploy sẽ tự gọi API bật Pages với `build_type: workflow`.

**Cách 2 — bật tay:** Settings → **Pages** → Build and deployment → Source: **GitHub Actions**.
Không cần chọn branch, không cần thư mục.

Sau khi deploy xong, URL có dạng `https://<owner>.github.io/cicd-demo/`.

Nếu muốn bật bằng API:

```bash
curl -X POST https://api.github.com/repos/<owner>/cicd-demo/pages \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -d '{"build_type":"workflow"}'
```

## 5. Theo dõi run

```bash
# liệt kê run gần nhất
curl -s "https://api.github.com/repos/<owner>/cicd-demo/actions/runs?per_page=5" \
  -H "Authorization: Bearer $GH_TOKEN" | jq '.workflow_runs[] | {id, status, conclusion, head_sha}'
```

Hoặc mở trực tiếp: `https://github.com/<owner>/cicd-demo/actions`

## 6. Thu hồi token sau demo

1. <https://github.com/settings/personal-access-tokens>
2. Chọn token → **Revoke**.
3. (Tuỳ chọn) xoá repo nếu chỉ để demo: Settings → General → Danger Zone → Delete this repository.

## Ghi chú về `workflow_dispatch`

Muốn chạy lại pipeline mà không cần commit:

```bash
curl -X POST https://api.github.com/repos/<owner>/cicd-demo/actions/workflows/ci-cd.yml/dispatches \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -d '{"ref":"main"}'
```

Hoặc bấm **Run workflow** trên UI của tab Actions.
