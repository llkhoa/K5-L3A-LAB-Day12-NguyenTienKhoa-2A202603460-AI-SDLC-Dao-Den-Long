# Phase 2 — kế hoạch kiểm chứng trước thay đổi

Nguồn: Ticket-02 đã phát hành, lưu ở `docs/requirements/phase-2-board.txt`. Phase 3–4 chưa mở tại lần đọc; không suy diễn nội dung.

## Thay đổi bắt buộc

Contract 1.1, --night 1/2/3; chuẩn hóa maps/timers/tick order. Giữ test Phase 1, sửa pulse sang khoảng cách 3D từ chân +0.8 theo ticket. Bổ sung pause, dash, bùa, Gió Lạc, gió Đêm 3, ba bản đồ và chuỗi màn.

| Mục | Acceptance / kiểm chứng |
|---|---|
| Lướt | 12 tick x14 m/s = 2.8 m; CD90 tick từ lúc bắt đầu; giữ nút không lặp; không rơi độ cao lúc lướt |
| Pause | tick vẫn tăng, sim_tick/time/CD/TTL/spawn đứng yên; cạnh nút pause tiếp tục |
| Đảo Cau | Hai tâm 0/70 bán kính28; cầu [26,44]x[-2,2]; bục bắn hướng đảo kia giữ vận tốc tới đáp |
| Đảo Chuông | 3 tầng 0/3/6, vách chặn đi lên, dốc30/150°, bục12/8 hướng-Z, tháp r2 |
| Gió Lạc | spawn1200, chase điều kiện5/15, steal3 một lần, flee240, pulse truy đuổi và hoàn đồ |
| Bùa | pickup600 tick, tốc7.2, dash không CD nhưng có cạnh nhấn, respawn2700 |
| Gió | gió lúc1800k trong300 tick, hướng từ PRNG, báo trước120 tick ở UI |
| Chuỗi đêm | Menu → giới thiệu → chơi → kết quả → đêm sau; thua chơi lại; thắng3 Bình Minh, tổng chỉ đêm thắng |
| Cài đặt | Volume/sensitivity lưu localStorage, reload giữ |
| Âm thanh | Web Audio nhạc và các cue yêu cầu; mute/volume hoạt động |
| HUD | HP, mm:ss đỏ nháy<=30, điểm/đèn,10ô,CD,prompt, chỉ hướng đèn ngoài màn hình |
| Contract | Snapshot fields mới + scenario overrides + events chính xác, malformed exit2 |
| Hiệu năng | headless21600 tick<=30s; đo browser1280x720 và ghi loại renderer, không gọi software result là GPU benchmark |

Mỗi tính năng logic thêm scenario/test, chạy lại suite Phase 1. Browser kiểm tra các map/UI và kết thúc chuỗi qua scenario của test bridge. Số FPS và bằng chứng native Linux phải có log thật trước khi ghi đạt.
