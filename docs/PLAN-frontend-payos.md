# PLAN: Frontend PayOS Integration (VIKA Hotel)

## Goal

Triển khai luồng chuyển hướng thanh toán PayOS trên giao diện React.

## Task Breakdown

### Phase 1: API & Store Integration

- [ ] Tạo `src/services/booking.js` (RTK Query).
- [ ] Tạo `src/services/payment.js` (RTK Query).
- [ ] Đăng ký API slices vào `src/store/index.js`.

### Phase 2: Booking Flow Update

- [ ] Cập nhật `BookingCard.jsx`: Logic gọi API tạo booking -> lấy checkout link -> redirect.
- [ ] Cập nhật `BookingHistoryPage.jsx`: Gọi API lấy dữ liệu thật, xử lý nút "Thanh toán ngay".

### Phase 3: Payment Result Pages

- [ ] Tạo `src/pages/PaymentSuccessPage.jsx`.
- [ ] Tạo `src/pages/PaymentCancelPage.jsx`.
- [ ] Đăng ký Route trong `AppRoutes.jsx`.

## Agent Assignments

- **frontend-specialist**: Thực hiện toàn bộ các Phase.

## Verification Checklist

- [ ] Nhấn đặt phòng chuyển hướng đúng sang trang Checkout PayOS.
- [ ] Quay lại trang Cancel/Success hiển thị đúng thông báo.
- [ ] Trạng thái đơn hàng trong Lịch sử cập nhật đúng sau khi thanh toán.
