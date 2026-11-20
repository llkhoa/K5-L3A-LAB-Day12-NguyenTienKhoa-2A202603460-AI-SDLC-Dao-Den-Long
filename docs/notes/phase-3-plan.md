# Phase 3 — Kế hoạch kiểm chứng trước thay đổi (Ticket-03 "Đèn cạn dầu")

Nguồn: `docs/requirements/phase-3-board.txt`. Change Request luật cốt lõi, Contract v1.2, tag `phase-3`.

## Phân tích tác động và Breaking Changes

1. **Nhiên liệu đèn**:
   - `fuel`: max 100, vừa thắp (mới/lại) đặt `100 * 60` tick-units (hoặc số nguyên chia 60).
   - Hao hụt: 1.0/s (1/60 mỗi tick).
   - Châm dầu khi đang sáng: `used = min(carried, ceil((100 - fuel) / 10))`, `fuel = min(100, fuel + 10 * used)`, trừ `used` đom đóm.
   - Khi đầy (used = 0) không chọn, không phát sự kiện, không cộng điểm.
   - Hết dầu (`fuel <= 0`): đèn tắt (`lit = false`), `deposited = 0`, phát `lantern_out`, `ever_lit = true`.
   - Thắp lại: `ever_lit === true` cần 5 đom đóm; chưa từng sáng cần 10 đom đóm.
2. **Bóng Mực hút dầu**:
   - `fuel < 30`: mất vùng an toàn 6m. Đúng 30 vẫn còn vùng an toàn.
   - Bóng Mực `wander` ưu tiên đèn sáng có `fuel < 30` gần nhất (id nhỏ hơn nếu bằng). Cách đèn $\le$ 2m (XZ) chuyển `drain`.
   - `drain`: đứng yên, hút 5 fuel/giây (5/60 mỗi tick). Cộng dồn nếu nhiều con.
   - Phát sự kiện `fuel_drain {lantern_id, shade_id, fuel}` mỗi 60 tick khi đang hút.
   - Chuyển trạng thái từ `drain`:
     + Mây vào $\le$ 6m -> `chase`.
     + Trúng Tỏa Sáng -> `stunned`.
     + Đèn tắt, fuel $\ge$ 30, hoặc cách đèn > 2m -> `wander`.
   - Khi châm dầu $\ge$ 30, bóng mực trong 6m bị đẩy ra mép trong 30 tick không gây sát thương.
3. **Luật thắng mới**:
   - Thời gian Đêm: 240 / 270 / 300 s.
   - Không còn thắng sớm `all_lit`.
   - Thắng: Hết giờ (`time_left_s <= 0`), Mây còn sống (`flames > 0`), số đèn sáng $\ge \lceil 0.6 \times \text{tổng đèn} \rceil$ (Đêm 1: 3/5, Đêm 2: 4/6, Đêm 3: 5/7). Reason: `dawn_survived`.
   - Thua: Hết Ngọn Lửa (`no_flames`) hoặc hết giờ mà không đủ đèn sáng (`dawn`).
4. **Sức chứa tăng dần**:
   - `capacity = min(20, 10 + 2 * successful_lights)`.
5. **Điểm mới**:
   - Nạp đom đóm (thắp mới/lại/châm dầu): +5 / đom đóm.
   - Thắp lần đầu: +100.
   - Thắp lại: +40.
   - Tỏa sáng trúng bóng: +5 / con; nếu ngay trước đó đang `drain`: +15.
   - Bình minh (thắng): +50/đèn sáng + floor(fuel), +50/ngọn lửa còn lại.
   - Bỏ thưởng thời gian.
6. **Chế độ mù màu**:
   - Cài đặt "Bảng màu dễ phân biệt": viền & mắt bóng mực `#00B3FF`, cảnh báo UI `#FFFFFF` kèm `⚠`, đèn tắt xẹp 20%, rách giấy; đèn sắp hết dầu nhấp nháy.
7. **Test Contract v1.2**:
   - contract_version: "1.2".
   - tuning thêm: `fuel_max: 100`, `fuel_decay_per_s: 1.0`, `fuel_per_mote: 10`, `relight_cost: 5`, `win_ratio: 0.6`, `drain_per_s: 5`, `low_fuel_threshold: 30`, `capacity_max: 20`, `night1_duration_s: 240`, `night2_duration_s: 270`, `night3_duration_s: 300`.
   - Snapshot: lanterns[].fuel (1 chữ số thập phân), lanterns[].ever_lit, lanterns[].relit_count, player.capacity.
   - Events: `refuel`, `lantern_out`, `fuel_drain`, `lantern_lit` thêm `{relight: boolean}`. `game_over.reason` có `dawn_survived`.
