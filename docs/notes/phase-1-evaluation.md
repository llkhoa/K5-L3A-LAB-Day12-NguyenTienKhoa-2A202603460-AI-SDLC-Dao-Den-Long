# Đánh giá Phase 1

- 17/17 test tự động qua trên Node.js v24.13.1 Windows; log trong docs/proof/phase-1/tests.txt.
- CLI thật tạo JSONL nạp đèn; hai lần chạy có cùng SHA-256. Không sửa tay output.
- Browser Chrome phần mềm, 1280x720: đã thử menu, W, nhảy, nạp và thắng, chơi lại, hết giờ thua; không có pageerror. Ảnh menu/gameplay/win trong thư mục proof.
- Chưa có bằng chứng chạy native macOS/Linux, test ẩn hoặc chơi một ván đầy đủ bằng tay. Có workflow Ubuntu, chưa có kết quả remote.
- Lần browser test đầu bỏ lỡ phím E vì press xảy ra giữa hai frame render phần mềm. Sửa test giữ phím qua tick; cần cải thiện input buffering ở giao diện để cả bấm nhanh cũng chắc chắn được nhận.
- Một lần sửa script bằng Get-Content mặc định làm sai Unicode; khôi phục script, dùng UTF-8 và selector id. Đã thêm quy tắc encoding vào AGENTS.md.
- Hiệu năng phần mềm khoảng 5–6 FPS trong smoke test, không dùng con số này để nhận đạt ngưỡng GPU. Cần tối ưu và đo Phase 2.
- Contract team chưa có MSSV/họ tên thật. Tag local là tiến độ hiện tại, không khẳng định đúng hạn lab hoặc đã nộp GitHub.
- Chưa review độc lập. Nhật ký token: chưa có số đo đáng tin; cần lấy từ giao diện usage, không suy diễn chi phí.
