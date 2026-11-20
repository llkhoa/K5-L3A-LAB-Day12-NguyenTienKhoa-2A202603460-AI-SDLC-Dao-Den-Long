# Phase 1 — tiêu chí và kế hoạch trước triển khai

Nguồn: `docs/requirements/phase-1-board.txt`, đọc từ tab PRD-0 trong Chrome ngày 20/11/2026. Bản trích accessibility có thể lặp từ được nhấn mạnh; không thay đổi yêu cầu.

## Quyết định

JavaScript ES modules, Node.js >=22 cho headless/test/server và Three.js cho 3D. Một lớp Game dùng chung cho browser và CLI; mô phỏng cố định 60 Hz, render độc lập. Bản web tĩnh phục vụ trên macOS/Linux, không cần GPU cho headless.

Các số Phase 1 tự chọn: chạy 6 m/s, nhảy 7 m/s, trọng lực -20 m/s², mang 10, mỗi đèn 10, nhặt 1 m, nạp 2 m, 3 ngọn lửa, 300 giây. Đảo tròn bán kính 40, 5 đèn. Tỏa sáng tốn 3, bán kính 5, choáng 2 giây, đẩy 4 m, hồi chiêu 3 giây. Vùng an toàn 6 m. Điểm nạp 10/đom đóm, thắp 100/đèn, choáng 5/bóng; thắng cộng floor(giây còn)*2 + ngọn lửa*50. Không cộng điểm khi chỉ nhặt. Bóng Mực có tâm cao 0.8 m. Giá trị khai báo phải khớp implementation.

## Tiêu chí → kiểm chứng

| Yêu cầu | Tiêu chí kiểm chứng trước khi ghi đạt |
|---|---|
| Di chuyển/nhảy/camera | 60 tick chạy = 6 m; chéo chuẩn hóa; yaw 90° đổi trục; nhảy lên và hạ xuống; ảnh browser có nhân vật/camera 3D |
| Đom đóm | Trong bán kính thì nhặt, ngoài thì không; không vượt sức chứa; không tự sinh khi scenario tắt |
| Đèn | Nạp từng phần, không vượt chi phí; nhấn giữ không nạp lại; đúng 5 đèn; đèn sáng giữ tiến độ |
| Bóng Mực | Đuổi khi gần, gây mất máu; bất tử ngăn hit lặp; tránh đèn đã sáng |
| Tỏa sáng | Trừ chi phí, choáng đúng mục tiêu, đẩy lùi, không đủ ánh sáng thì không kích hoạt |
| Kết thúc | Thắp đủ thắng; hết máu/hết giờ thua; điểm chính xác; nút chơi lại tạo game mới |
| Contract | snapshot tick 0; event tick k+1; end cuối; tọa độ 3 số lẻ; frame giữ trường cũ; file lỗi exit 2 |
| Tất định | Chạy CLI 2 lần cùng seed/input/scenario và so byte |
| Khả năng cài | npm ci, npm run build, npm start trong thư mục sạch; CI Linux chạy suite |

## Bằng chứng dự kiến

`npm run verify` chạy test thật, sinh JSONL từ scenario và báo cáo exit code. Browser smoke test ghi ảnh, lỗi console và kiểm tra WASD/nhảy/nạp/tỏa sáng/kết thúc/chơi lại. Mọi mục chưa kiểm tra phải ghi rõ. Test ẩn và kiểm tra nền tảng đích chỉ ghi đạt khi có kết quả thật.
