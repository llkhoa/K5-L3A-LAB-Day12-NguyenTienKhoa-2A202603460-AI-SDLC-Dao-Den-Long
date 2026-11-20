# ADR 001: Chuyển đổi mô hình trạng thái đèn và luật kết thúc Đêm (Phase 3)

## Bối cảnh
Theo phản hồi playtest, việc game kết thúc ngay khi thắp hết đèn khiến phần cuối đêm thiếu thử thách. Ticket-03 (Change Request) yêu cầu chuyển đổi từ cơ chế "thắp xong là vĩnh viễn" sang "quản lý nhiên liệu dầu và giữ đảo sáng tới bình minh".

## Quyết định thiết kế

1. **Biểu diễn nhiên liệu (Fuel Representation)**:
   - Sử dụng đơn vị nguyên tick (1 fuel = 60 ticks) trong logic mô phỏng để tránh sai số dấu phẩy động:
     - 1 giây hao hụt = 60 tick-units.
     - Bóng Mực drain = 300 tick-units/giây (5 fuel/giây).
   - Khi xuất snapshot JSONL / API, giá trị `fuel` được tính bằng `Math.round(fuelTicks / 6) / 10` (lấy 1 chữ số thập phân).
   - Đèn có `fuelTicks <= 0` chuyển sang tắt, `deposited = 0`, đánh dấu `ever_lit = true`.

2. **Quy tắc thắp lại (Relight) và nạp thêm (Refuel)**:
   - Đèn chưa từng sáng (`ever_lit: false`): cần 10 đom đóm.
   - Đèn đã từng sáng (`ever_lit: true`): chỉ cần 5 đom đóm để thắp lại (khi thắp lại, `relit_count++`, fuel trở về 100).
   - Đèn đang sáng (`lit: true`): châm dầu bù phần thiếu `used = min(carried, Math.ceil((100 - fuel) / 10))`.
   - Mỗi đom đóm nạp vào cộng 10 fuel.

3. **Mô hình AI Bóng Mực với trạng thái Drain**:
   - Khi ở trạng thái `wander`, Bóng Mực tìm đèn sáng có `fuel < 30` gần nhất.
   - Khi tiếp cận $\le 2$m XZ, chuyển sang trạng thái `drain` và hút dầu liên tục.
   - Phát sự kiện `fuel_drain` mỗi 60 tick.
   - Ưu tiên chuyển trạng thái: bị Tỏa Sáng (`stunned`), người chơi lại gần $\le 6$m (`chase`), hoặc đèn tắt/được cứu lên $\ge 30$ (`wander`).

4. **Luật thắng/thua (Win/Loss Conditions)**:
   - Loại bỏ hoàn toàn sự kiện thắng sớm `all_lit`.
   - Trò chơi chỉ kết thúc khi:
     + Mất hết Ngọn Lửa (`flames === 0`): thua ngay lập tức với lý do `no_flames`.
     + Hết thời gian Đêm (`sim_tick >= duration_ticks`):
       * Thắng (`dawn_survived`): nếu số đèn đang sáng $\ge \lceil 0.6 \times \text{tổng đèn} \rceil$.
       * Thua (`dawn`): nếu số đèn đang sáng không đạt ngưỡng.

## Hậu quả & Đánh đổi (Consequences)
- Các test cũ kỳ vọng game thắng ngay khi 5 đèn sáng sẽ cần được cập nhật theo luật mới.
- Công thức tính điểm thay đổi hoàn toàn: bỏ thưởng thời gian, tăng điểm giữ dầu đèn và bảo vệ đảo.
