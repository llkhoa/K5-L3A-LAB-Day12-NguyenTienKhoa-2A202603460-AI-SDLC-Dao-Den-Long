# Trạng thái bài lab

## Chuẩn bị ngày 20/11/2026

- Đã đọc 6 tài liệu hướng dẫn trong repo.
- Checkout ban đầu chỉ chứa tài liệu, chưa có game hoặc Test Contract.
- Remote origin hiện là repo đề bài VinUni-AI20k/K5-L3-LAB-Day12-AI-SDLC.
- Đã kiểm tra công cụ: Node.js v24.13.1, Python 3.12.10 trên Windows.
- Đã thêm AGENTS.md và quy tắc loại trừ file bí mật/dependency.
- Chưa chạy hello 3D, test game, headless hoặc kiểm tra macOS/Linux.

## Thông tin cần bổ sung

1. PRD-0 và Test Contract từ tab Phase 1 của lab board.
2. Các ticket Phase 2–4 khi đã được phát hành.
3. Mốc giờ bắt đầu và hạn do Coach thông báo.

## Trình tự triển khai sau khi nhận yêu cầu

1. Lưu yêu cầu đã phát hành, lập bảng tiêu chí → test/scenario → bằng chứng.
2. Chọn công nghệ phù hợp contract; tạo hello 3D/headless và kiểm tra môi trường.
3. Xây logic dùng chung cho game và runner headless; thêm giao diện 3D.
4. Chạy test, scenario, kiểm tra tất định nếu contract yêu cầu; lưu output và ảnh thật.
5. Ghi đánh giá, commit và tag từng phase; tiếp nhận ticket và chạy hồi quy.
6. Kiểm tra bản cài sạch, đóng gói, quay demo mp4 dưới 5 phút và chuẩn bị Release.

## Trạng thái bàn giao

CP0: Đã hoàn thành (cấu hình môi trường, tài liệu, quy ước).
CP1 (Phase 1): Đã hoàn thành, tag `phase-1` đã tạo.
CP2 (Phase 2): Đã hoàn thành, tag `phase-2` đã tạo.
CP3 (Phase 3): Đã hoàn thành Change Request Ticket-03 "Đèn cạn dầu", Contract v1.2, 38/38 tests pass, headless và browser proof đầy đủ.
Đang chờ: Gắn tag `phase-3` và tiếp nhận thông tin Phase 4 khi phát hành.
