# Đánh giá Phase 2

- 31/31 test tự động đạt trên Node.js v24.13.1 (Windows), gồm 17 test hồi quy Phase 1 và 14 test mới của Phase 2; log chi tiết trong `docs/proof/phase-2/tests.txt`.
- Headless simulation đạt hiệu năng xuất sắc: Đêm đầy đủ 21.600 tick chạy trong ~128 ms (yêu cầu DoD: <= 30 s). 10/10 scenario kiểm tra tính năng mới đều tất định và đạt yêu cầu (`docs/proof/phase-2/scenarios.json`).
- Browser Chromium (1280x720):
  + Đã kiểm thử qua chuỗi 3 đêm, màn hình Pause, menu, UI HUD, các màn hình giới thiệu đêm và kết thúc (Bình Minh).
  + Tốc độ khung hình mượt mà: ~144 FPS trên cả 3 đêm với renderer phần cứng D3D11 (`docs/proof/phase-2/browser-phase2.json`).
  + Không có lỗi console hay crash (`pageerror: 0`).
  + Các ảnh chụp màn hình thực tế lưu tại `docs/proof/phase-2/` (menu.png, night-1.png, night-2.png, night-3.png, dawn.png).
- Đã kiểm tra tính năng đầy đủ:
  + Lướt (dash): 14 m/s trong 12 tick, hồi chiêu 90 tick, lướt trên không giữ nguyên độ cao.
  + Tạm dừng (Esc/P): đóng băng toàn bộ tiến trình logic (sim_tick, CD, spawn, TTL), tiếp tục bằng rising edge.
  + Đảo Cau (Đêm 2): 2 đảo tròn r=28m, cầu tre kết nối, 2 bục nhảy với vận tốc Y=14 m/s và ngang 24 m/s.
  + Đảo Chuông (Đêm 3): 3 tầng, vách đứng, dốc 30° và 150°, bục nhảy đáp lên tầng 2, gió mạnh mỗi 30s.
  + Gió Lạc (Đêm 2 & 3): bay 7 m/s, cướp đom đóm, chạy trốn, nhả lại khi bị Tỏa Sáng trúng lúc flee.
  + Bùa Gió: tăng tốc 7.2 m/s, lướt không hồi chiêu trong 600 tick, hồi bùa sau 2700 tick.
- Quy chuẩn Test Contract v1.1: toàn bộ tuning, schema snapshot, scenarios và events đều khớp hoàn toàn với đặc tả Ticket-02.
