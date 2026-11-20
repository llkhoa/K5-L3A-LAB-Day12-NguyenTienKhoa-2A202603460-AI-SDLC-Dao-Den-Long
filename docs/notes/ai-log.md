# Nhật ký dùng AI

## 20/11/2026 — Chuẩn bị

- Yêu cầu người dùng: làm theo hướng dẫn bài lab.
- Công cụ: Codex, đọc file cục bộ, Git, kiểm tra phiên bản runtime và thử truy cập lab board.
- Kết quả: xác định repo chỉ có hướng dẫn chung; tạo harness và ghi trạng thái thực tế.
- Quyết định: chờ PRD-0/Test Contract trước khi thiết kế giao thức headless và luật chơi.
- Kiểm chứng: Node.js và Python có sẵn; chưa kiểm chứng game vì chưa có mã nguồn.
- Token/chi phí: chưa có số đo từ giao diện sử dụng; không khai số liệu giả.
- Tiết kiệm ngữ cảnh: tìm file trước, chỉ đọc tài liệu liên quan, không dựng tính năng khi thiếu đề.
- Lỗi công cụ đã gặp: đọc UTF-8 bằng mã hóa mặc định PowerShell hiển thị sai dấu; đọc lại bằng UTF-8.
- Review độc lập: chưa thực hiện.

## 20/11/2026 — Phase 1 & 2 Triển khai và Kiểm chứng

- Triển khai toàn bộ Phase 1 (Đảo Bến, cơ chế đom đóm, đèn, Bóng Mực, Tỏa Sáng, Contract v1.0).
- Triển khai và tích hợp Phase 2 Ticket-02 (Chuỗi 3 Đêm: Đảo Bến, Đảo Cau, Đảo Chuông; bục nhảy, bùa gió, gió lạc, dash, pause, Contract v1.1).
- Chạy toàn bộ suite 31 tests (17 hồi quy Phase 1, 14 test Phase 2) đạt 100% không lỗi.
- Kiểm chứng headless 21.600 tick trong ~128ms (< 30s), browser đạt ~144 FPS trên D3D11.
- Lưu trữ đầy đủ snapshot, scenario proofs và hình ảnh minh chứng trong `docs/proof/phase-2/`.

## 20/11/2026 — Phase 3 Change Request "Đèn cạn dầu"

- Nhận Ticket-03 (Change Request), phân tích tác động và lập kế hoạch kiểm chứng tại `docs/notes/phase-3-plan.md`.
- Tạo Architecture Decision Record (ADR 001) tại `docs/notes/adr-phase-3.md` và `CHANGELOG.md` ghi nhận các breaking changes.
- Nâng cấp `game.contract.json` lên v1.2 với đầy đủ tuning tham số mới.
- Triển khai cơ chế nhiên liệu đèn (hao 1.0/s, tắt khi hết dầu, châm dầu refuel, thắp lại tốn 5 đom đóm).
- Triển khai Bóng Mực hút dầu (`drain`), mất vùng an toàn khi fuel < 30, cơ chế đẩy lùi khi châm dầu lại.
- Triển khai luật thắng mới theo ngưỡng $\ge 60\%$ đèn sáng tại Bình Minh (`dawn_survived`).
- Triển khai sức chứa đom đóm tăng dần (tối đa 20) và chế độ mù màu (Colorblind mode).
- Cập nhật test suite cũ, bổ sung `tests/phase3.test.mjs`, tổng 38/38 tests pass.
- Chạy kiểm chứng `verify` và browser headless Chromium, thu thập bằng chứng đầy đủ tại `docs/proof/phase-3/`.
