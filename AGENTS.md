# Hướng dẫn agent — Đảo Đèn Lồng

- Đọc README.md, GUIDE.md, RULES.md, SUBMISSION.md và yêu cầu phase đã phát hành trước khi triển khai.
- PRD-0, Test Contract và các ticket là nguồn yêu cầu; không tự đặt định dạng headless thay contract còn thiếu.
- Ghi tiêu chí nghiệm thu và kế hoạch kiểm chứng trước khi code trong docs/notes/.
- Tách logic mô phỏng khỏi hiển thị 3D; game và headless phải dùng chung logic.
- Sản phẩm phải chạy được trên macOS hoặc Linux; kiểm tra Windows không thay thế kiểm tra nền tảng đích.
- Sau khi chọn công nghệ, bổ sung lệnh cài đặt, chạy, build, test chính xác tại đây.
- Lưu output thật trong docs/proof/; không sửa tay kết quả, không ghi đạt khi chưa chạy.
- Test hồi quy phải chạy lại sau mỗi phase; thay hoặc bỏ test cần ghi lý do.
- Giữ nguyên tài liệu đề bài và file harness; không viết lại lịch sử tag.
- Không commit .env, khóa API, token hoặc thư mục dependency.
- Chỉ gắn tag phase khi có yêu cầu tương ứng và đã ghi rõ kết quả kiểm chứng.

## Công nghệ và lệnh

- Node.js >=22, ES modules, Three.js. `src/game.mjs` là logic dùng chung.
- Cài: `npm ci`. Build: `npm run build`. Chạy: `npm start` (http://127.0.0.1:5173).
- Test: `npm test`. Cổng kiểm chứng: `npm run verify` (exit khác 0 khi test đỏ, không tạo báo cáo đạt).
- Browser: `npm run test:browser` khi server đang chạy và máy có Chrome.
- Headless: `node src/headless.mjs --seed 42 --night 1 --ticks 600 --out result.jsonl`.
- Đọc/ghi file tiếng Việt bằng UTF-8; không dùng Get-Content mã hóa mặc định để sửa file.
- Browser test giữ phím tối thiểu một tick mô phỏng; không giả định một lần press tức thời được render nhận.
- Xem docs/notes/status.md và docs/notes/phase-1-plan.md trước khi tiếp tục.
