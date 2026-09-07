# Báo cáo tiến độ Khóa luận tốt nghiệp — ViKaHotel

**Sinh viên thực hiện:** Vinh (Mai Hữu Vinh)
**Dự án:** ViKaHotel — Hệ thống đặt phòng khách sạn (KLTN)
**Phạm vi báo cáo:** Các module do Vinh phụ trách theo phân công nhóm (Backend: `room-types`, `rooms`, `bookings`, `promotions`, `services`; Frontend: Auth UI, Session/Route Guard, Quản trị người dùng, Dashboard admin)

---

## 1. Phạm vi công việc được phân công

Theo tài liệu đặc tả API của nhóm, các module thuộc trách nhiệm của Vinh trải trên cả 3 tầng (Backend, FE Web, FE Mobile):

`/room-types`, `/rooms`, `/bookings`, `/promotions`, `/services`, `/reviews`, `/chat` (AI Agent đặt phòng), `/dashboard` (thống kê + AI metrics).

Các module `/auth`, `/users` (nghiệp vụ CRUD gốc), `/payments`, `/shifts`, `/notifications` thuộc trách nhiệm của thành viên còn lại (Khoa). Trong quá trình phát triển, một số hạng mục UI liên quan trực tiếp đến trải nghiệm người dùng (đăng nhập/đăng ký, phiên đăng nhập, quản lý tài khoản cho Admin) đã được bổ sung thêm để hoàn thiện sản phẩm.

---

## 2. Backend — Các module nghiệp vụ đã xây dựng (NestJS + PostgreSQL + Redis)

### 2.1 Room Types (`/room-types`)
Danh mục loại phòng của khách sạn.
- `GET /room-types` — danh sách công khai, hỗ trợ filter (sức chứa, khoảng giá, tìm kiếm).
- `GET /room-types/:id` — chi tiết.
- `POST / PATCH / DELETE` (Admin) — tạo, cập nhật, xóa mềm.

### 2.2 Rooms (`/rooms`)
Quản lý phòng vật lý gắn với từng loại phòng.
- `GET /rooms/availability` — kiểm tra còn phòng trống theo khoảng ngày.
- `GET /rooms/map` — sơ đồ phòng cho nhân viên/quản trị (theo tầng).
- `POST /rooms`, `PATCH /rooms/:id/status` — tạo phòng, cập nhật trạng thái (`AVAILABLE`, `OCCUPIED`, `RESERVED`, `CLEANING`, `MAINTENANCE`).
- Phân quyền theo vai trò: Staff/Admin xem sơ đồ và cập nhật trạng thái, chỉ Admin được tạo phòng mới.

### 2.3 Services (`/services`)
Danh mục dịch vụ đi kèm (ăn sáng, đưa đón sân bay...) — CRUD cho Admin, danh sách công khai cho khách.

### 2.4 Promotions (`/promotions`)
Mã khuyến mãi.
- `GET /promotions/:code/validate` — kiểm tra hợp lệ và tự tính số tiền được giảm theo tổng giá trị đơn.
- CRUD + bật/tắt mã cho Admin, tự đếm số lần mã đã được sử dụng.

### 2.5 Bookings (`/bookings`) — module phức tạp nhất
Quản lý toàn bộ vòng đời một đơn đặt phòng: `PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT`, hoặc `CANCELLED`.

**Điểm kỹ thuật nổi bật — chống đặt trùng phòng (double-booking) bằng Redis Distributed Lock:**
Khi tạo đơn, hệ thống khóa (`SETNX`, TTL 5 giây) theo từng cặp `(loại phòng, ngày lưu trú)` trước khi kiểm tra và trừ số lượng phòng còn trống. Điều này đảm bảo hai khách đặt cùng lúc cùng loại phòng/cùng ngày không thể "lách" qua nhau gây bán vượt quá số phòng thực có — vấn đề race-condition kinh điển trong hệ thống đặt chỗ có nhiều người dùng đồng thời.

Các nghiệp vụ khác trong module: tự tính tiền phòng theo số đêm, cộng dịch vụ phát sinh, áp mã khuyến mãi; check-in gán phòng cụ thể; check-out xuất hóa đơn cuối; hủy đơn có lý do và trả phòng về trạng thái trống; phân quyền khách hàng chỉ thao tác trên đơn của chính mình, Staff/Admin quản lý toàn bộ.

---

## 3. Frontend — Đăng ký / Đăng nhập (UI + xử lý lỗi chuẩn hóa)

- Validate phía client: định dạng email, độ dài mật khẩu tối thiểu (khớp rule backend) — chặn gọi API nếu dữ liệu chưa hợp lệ.
- Chuẩn hóa thông báo lỗi theo mã HTTP (400/401/409) thành câu tiếng Việt dễ hiểu, hiển thị bằng `react-toastify` — loại bỏ hoàn toàn `alert()`/`confirm()` gốc của trình duyệt.
- Đăng ký → xác minh OTP → tự động đăng nhập; đăng nhập thành công lưu token và **điều hướng theo vai trò** (Admin vào khu quản trị, khách hàng tiếp tục luồng đặt phòng).
- Tầng gọi API đăng nhập/đăng ký được xây bằng **RTK Query** (`authApi`), dùng chung một `axiosBaseQuery` nối vào Axios instance thật của dự án (khác với các slice mock dữ liệu mẫu có sẵn trong repo).
- Phát hiện và sửa một lỗi thật trong quá trình kiểm thử: mã kiểm tra quyền Admin cũ so sánh chuỗi `"admin"` (chữ thường) trong khi backend luôn trả `"ADMIN"` — nghĩa là **trước đó không ai đăng nhập vào được khu quản trị**.

---

## 4. Frontend — Duy trì phiên đăng nhập & Phân quyền theo Route

- **Tự động làm mới access token khi hết hạn:** interceptor của Axios bắt lỗi `401`, tự gọi `POST /auth/refresh`, cập nhật token mới rồi gửi lại đúng request gốc — người dùng không bị đăng xuất giữa chừng khi access token (hạn 15 phút) hết hạn, miễn refresh token (hạn 7 ngày) còn hiệu lực.
- Dùng chung một "lời hứa" (promise) làm mới token cho nhiều request 401 xảy ra đồng thời, tránh việc refresh token bị thu hồi (rotate) bởi lần gọi đầu khiến lần gọi sau thất bại oan.
- **Route Guard dùng chung** (`ProtectedRoute`): chặn truy cập nếu chưa đăng nhập (đưa về `/login`, nhớ lại trang muốn vào để quay lại sau) hoặc sai vai trò (đưa về trang `/403` — đã xây riêng, có nút quay về trang chủ) — thay cho việc mỗi trang tự viết logic kiểm tra rời rạc.

---

## 5. Frontend/Backend — Quản trị người dùng (Admin) & Đổi mật khẩu

### Backend bổ sung cho module Users
- `GET /users` — danh sách có filter theo vai trò, trạng thái, từ khóa tìm kiếm (tên/email/SĐT) + phân trang.
- `PATCH /users/:id/role`, `PATCH /users/:id/status` — đổi vai trò, khóa/mở khóa tài khoản (có chặn Admin tự khóa/tự đổi vai trò chính mình).
- `PATCH /users/me/password` — đổi mật khẩu cá nhân, xác thực mật khẩu cũ bằng bcrypt, validate mật khẩu mới đủ mạnh (≥ 8 ký tự, có cả chữ và số).

### Frontend
- Trang **Quản lý tài khoản** (`/admin/accounts`): bảng danh sách có filter + phân trang, đổi vai trò qua dropdown, khóa/mở khóa qua **modal xác nhận** (component `ConfirmModal` dùng chung, xây trên `Modal` dùng chung).
- Component `StatusBadge` dùng chung, tái sử dụng ở cả trang hồ sơ cá nhân lẫn bảng quản lý tài khoản.
- Form **Đổi mật khẩu** gắn vào trang hồ sơ cá nhân, validate độ mạnh mật khẩu, báo lỗi rõ ràng khi nhập sai mật khẩu cũ, toast xác nhận khi thành công.

---

## 6. Frontend — Dashboard tổng quan cho Admin

- Tái cấu trúc route `/admin` theo mô hình **nested routes** chuẩn của React Router: một layout dùng chung (Sidebar + Header) bọc toàn bộ khu quản trị, các trang con (Dashboard, Quản lý tài khoản...) chỉ việc render vào phần nội dung — tránh việc mỗi trang tự lặp lại layout, và giữ Sidebar/Header không bị tải lại khi chuyển trang.
- Trang chủ khu quản trị hiển thị số liệu **thật** (không phải dữ liệu mẫu): tổng số người dùng (theo vai trò), tổng số đơn đặt phòng (theo trạng thái), số phòng trống/đang dùng, tổng số loại phòng — trình bày dạng thẻ KPI và biểu đồ phân bố có chú giải (legend), theo đúng nguyên tắc thiết kế trực quan hóa dữ liệu (màu sắc theo ngữ nghĩa trạng thái, không phối màu tùy tiện).
- Khu vực "Truy cập nhanh" phân biệt rõ trang nào đã hoạt động thật và trang nào còn đang phát triển (gắn nhãn "Sắp ra mắt"), tránh dẫn người dùng vào trang chưa hoàn thiện.

---

## 7. Phương pháp kiểm thử

Toàn bộ các hạng mục trên **không chỉ được kiểm tra qua đọc code**, mà được kiểm thử thật với backend + PostgreSQL + Redis đang chạy: tạo tài khoản thật qua luồng đăng ký → lấy mã OTP thật từ Redis → xác minh → đăng nhập, dựng tài khoản Admin thật để kiểm tra phân quyền, gọi trực tiếp từng API bằng `curl` để xác nhận đúng mã lỗi (400/401/403/409) và đúng hành vi nghiệp vụ (khóa tài khoản chặn đăng nhập ngay lập tức, đổi mật khẩu xong đăng nhập lại bằng mật khẩu mới thành công...). Toàn bộ dữ liệu thử nghiệm được dọn sạch khỏi cơ sở dữ liệu sau khi kiểm thử.

---

## 8. Công nghệ sử dụng

**Backend:** NestJS, TypeORM, PostgreSQL, Redis (ioredis) — dùng cho khóa phân tán chống double-booking và lưu OTP/refresh-token, JWT (access + refresh token có cơ chế rotate), class-validator.

**Frontend:** React, React Router (nested routes), Redux Toolkit Query (gọi API thật qua Axios base query dùng chung), Tailwind CSS, react-toastify.

---

## 9. Các phần đang được phát triển song song (chưa thuộc phạm vi kiểm thử của báo cáo này)

Song song với các hạng mục trên, dự án đang được mở rộng thêm: đa ngôn ngữ Việt/Anh (`react-i18next`) cho các màn hình người dùng, trang quản lý Loại phòng/Phòng vật lý cho Admin, tích hợp lưu trữ ảnh Cloudinary, endpoint thống kê tổng hợp `GET /dashboard/overview` (thay thế cách gộp số liệu tạm thời ban đầu), và cổng thanh toán PayOS. Đây là các hạng mục đang hoàn thiện, chưa được tổng hợp chi tiết trong báo cáo này.

---

*Báo cáo được tổng hợp dựa trên mã nguồn thực tế trong repository và kết quả kiểm thử trực tiếp tính đến thời điểm lập báo cáo.*
