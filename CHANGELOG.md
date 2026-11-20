# CHANGELOG — Phase 3 (Breaking Changes & Migration Guide)

## [Phase 3 — Contract v1.2]

### Breaking Changes (Thay đổi phá vỡ tương thích)

1. **Luật kết thúc game**:
   - **Xóa**: `all_lit` không còn làm game thắng sớm nữa. Thắp đủ toàn bộ đèn không làm dừng mô phỏng.
   - **Mới**: Game chỉ kết thúc khi hết giờ (Bình Minh) hoặc hết máu (`no_flames`).
   - Lý do thắng chuyển thành `dawn_survived` nếu số đèn sáng $\ge \lceil 0.6 \times \text{tổng đèn} \rceil$.
   - Nếu hết giờ mà không đủ $60\%$ số đèn sáng, game kết thúc với lý do `dawn` (thua).

2. **Cơ chế đèn & nhiên liệu**:
   - Đèn đã sáng tiếp tục nhận đom đóm để châm dầu (Refuel).
   - Đèn hao hụt 1.0 fuel/s. Khi fuel $\le 0$, đèn bị tắt và phát sinh sự kiện `lantern_out`.
   - Đèn đã từng sáng (`ever_lit: true`) khi tắt chỉ cần 5 đom đóm để thắp lại (thay vì 10).
   - Đèn có fuel < 30 bị mất vùng an toàn 6m.

3. **Bóng Mực**:
   - Thêm trạng thái `drain` khi tiếp cận đèn yếu (fuel < 30) $\le 2$m.
   - Trạng thái `drain` hút 5 fuel/giây và phát sự kiện `fuel_drain` mỗi 60 tick.

4. **Sức chứa người chơi (Carry Capacity)**:
   - Sức chứa không còn cố định ở 10 mà tăng tiến: `10 + 2 * successful_lights`, tối đa 20.

5. **Hệ thống tính điểm**:
   - Bỏ hoàn toàn thưởng thời gian `floor(time_left_s) * 2`.
   - Thay đổi điểm nạp đom đóm thành +5/đom đóm.
   - Thắp lần đầu: +100 điểm; Thắp lại: +40 điểm.
   - Tỏa Sáng trúng bóng đang `drain` được +15 điểm (thay vì +5).
   - Thưởng khi thắng: +50/ngọn lửa và +50 + floor(fuel) cho mỗi đèn còn sáng.

6. **Test Contract v1.2**:
   - Nâng cấp `contract_version` từ `1.1` lên `1.2`.
   - Bổ sung các thông số tuning mới trong `game.contract.json`.
   - Snapshot cập nhật thêm các trường: `fuel`, `ever_lit`, `relit_count` trên mỗi đèn, `capacity` trên người chơi.
