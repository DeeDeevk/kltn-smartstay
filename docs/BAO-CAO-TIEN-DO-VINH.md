# Báo cáo tiến độ Khóa luận tốt nghiệp — ViKaHotel

**Sinh viên thực hiện:** Vinh (Mai Lưu Hữu Vinh)
**Dự án:** ViKaHotel — Hệ thống đặt phòng khách sạn (KLTN)
**Phạm vi báo cáo:** Các module do Vinh phụ trách theo phân công nhóm (Backend: `room-types`, `rooms`, `bookings`, `promotions`, `services`, tích hợp cổng thanh toán PayOS; Frontend: Auth UI, Session/Route Guard, Quản trị người dùng, Dashboard admin, toàn bộ khu vực vận hành lễ tân — Sơ đồ phòng, Check-in/Check-out, Quản lý đặt phòng)

---

## 0. Tóm tắt dễ hiểu (đọc trước khi báo cáo)

Phần này diễn giải lại từng mục bằng lời văn đơn giản, để dùng khi thuyết trình miệng với giảng viên — nội dung kỹ thuật chi tiết nằm ở các mục 1–12 bên dưới.

- **Mục 1 — Phạm vi**: Liệt kê module nào là của bạn (room-types, rooms, bookings, promotions, services, thanh toán PayOS) và phần FE nào là của bạn (đăng nhập, dashboard, toàn bộ khu lễ tân). Có giải thích vì sao trong code thấy tên `ReservationsModule` — đó chỉ là Khoa gói lại code của bạn thành 1 module NestJS để phục vụ tính năng phân ca của Khoa, không phải Khoa viết lại logic bên trong.
- **Mục 2 — Backend**: Các API bạn đã xây cho room-types, rooms, services, promotions, bookings. Phần bookings dài nhất vì phức tạp nhất — có đủ vòng đời đặt phòng (đặt → xác nhận → nhận phòng → trả phòng), khóa Redis chống 2 người đặt trùng phòng cùng lúc, và 3 lỗi kỹ thuật khó bạn đã tìm ra và sửa (lỗi phân trang khi join dữ liệu, lỗi ẩn của thư viện TypeORM, lỗi tính giờ trả phòng muộn sai múi giờ) — nên nhấn mạnh phần này khi báo cáo vì thể hiện khả năng debug sâu.
- **Mục 3 — Khu vực lễ tân (phần mới nhất, lớn nhất)**: Trang Sơ đồ phòng xem theo tầng, quét mã QR để nhận phòng, trả phòng có tính phụ thu trả muộn, lập đơn tại quầy cho khách vãng lai, xem lịch sử từng phòng, và phân quyền để nhân viên (STAFF) chỉ thấy đúng menu họ cần dùng.
- **Mục 4 — Trang Quản lý đặt phòng**: Khác mục 3 (xem theo phòng), đây là trang cho Admin xem theo đơn — tìm kiếm, lọc, xem chi tiết toàn bộ đơn đặt phòng của khách sạn.
- **Mục 5 — Thanh toán PayOS & VAT**: Luồng thanh toán online bằng QR ngay trong trang (không rời trang), tự động kiểm tra khi khách thanh toán xong, xử lý khi thanh toán thất bại, và cách tính thuế VAT 8% áp dụng thống nhất.
- **Mục 6–9 — Các phần nền tảng đã làm trước đó**: Đăng ký/đăng nhập, giữ phiên đăng nhập tự động, phân quyền theo route, quản lý tài khoản người dùng, dashboard thống kê tổng quan.
- **Mục 10 — Cách kiểm thử**: Không chỉ đọc code mà test thật với database/Redis chạy thật, dùng curl gọi API, và có dựng cả 1 backend phụ để test lỗi mà không ảnh hưởng server đang chạy — chi tiết tốt để chứng minh sự cẩn thận khi được hỏi.
- **Mục 11 — Công nghệ**: Danh sách công nghệ dùng, để giảng viên thấy dùng đúng stack hiện đại (NestJS, TypeORM, Redis, RTK Query, i18next...).
- **Mục 12 — Ngoài phạm vi**: Thành thật nói rõ `/reviews` và `/chat` (AI agent) hiện mới là dữ liệu giả ở frontend, chưa có backend thật — để không bị hỏi dồn nếu giảng viên test thử mà báo cáo lại nói "đã xong".

---

## 1. Phạm vi công việc được phân công

Theo tài liệu đặc tả API của nhóm, các module thuộc trách nhiệm của Vinh trải trên cả 3 tầng (Backend, FE Web, FE Mobile):

`/room-types`, `/rooms`, `/bookings`, `/promotions`, `/services`, `/reviews`, `/chat` (AI Agent đặt phòng), `/dashboard` (thống kê + AI metrics).

Các module `/auth`, `/users` (nghiệp vụ CRUD gốc), `/payments` (hạ tầng cổng thanh toán), `/shifts` (phân ca nhân viên), `/notifications` thuộc trách nhiệm của thành viên còn lại (Khoa). Trong quá trình phát triển, Vinh đã tích hợp trực tiếp cổng thanh toán PayOS vào luồng đặt phòng/thanh toán của mình, và bổ sung thêm một số hạng mục UI liên quan trực tiếp đến trải nghiệm người dùng (đăng nhập/đăng ký, phiên đăng nhập, quản lý tài khoản cho Admin) để hoàn thiện sản phẩm.

Ghi chú kiến trúc: gần cuối đợt phát triển, các entity/service `Room`, `RoomType`, `Booking` (đều là code của Vinh) được nhóm chung lại vào một `ReservationsModule` ở tầng khai báo NestJS Module (do Khoa thực hiện, phục vụ cho việc `ShiftModule` mới cần tham chiếu tới phòng/đặt phòng mà không tạo phụ thuộc vòng). Đây chỉ là thay đổi cách "gói" module, toàn bộ logic nghiệp vụ bên trong (`RoomService`, `RoomTypeService`, `BookingService`, các controller tương ứng) vẫn do Vinh xây dựng và không đổi.

---

## 2. Backend — Các module nghiệp vụ đã xây dựng (NestJS + PostgreSQL + Redis)

### 2.1 Room Types (`/room-types`)
Danh mục loại phòng của khách sạn.
- `GET /room-types` — danh sách công khai, hỗ trợ filter (sức chứa, khoảng giá, tìm kiếm).
- `GET /room-types/:id` — chi tiết, kèm trang chi tiết loại phòng riêng ở FE.
- `POST / PATCH / DELETE` (Admin) — tạo, cập nhật, xóa mềm; quản lý ảnh minh họa qua Cloudinary.
- **Active-booking guard:** chặn xóa/vô hiệu một loại phòng nếu vẫn còn đơn đặt phòng chưa hoàn tất tham chiếu tới nó, tránh làm hỏng dữ liệu lịch sử.

### 2.2 Rooms (`/rooms`)
Quản lý phòng vật lý gắn với từng loại phòng.
- `GET /rooms/availability` — kiểm tra còn phòng trống theo khoảng ngày.
- `GET /rooms/map` — sơ đồ phòng theo tầng, kèm trạng thái và (nếu có) đơn đặt phòng đang gắn với phòng đó — nền tảng cho trang **Sơ đồ phòng** ở mục 3.
- `POST /rooms`, `PATCH /rooms/:id/status` — tạo phòng, cập nhật trạng thái (`AVAILABLE`, `OCCUPIED`, `RESERVED`, `CLEANING`, `MAINTENANCE`).
- Phân quyền theo vai trò: Staff/Admin xem sơ đồ và cập nhật trạng thái, chỉ Admin được tạo phòng mới.
- **Sửa lỗi race-condition khi tạo phòng:** hai Admin tạo cùng lúc một số phòng trùng nhau trước đây có thể lọt qua kiểm tra trùng lặp ở tầng ứng dụng; nay bắt lỗi vi phạm ràng buộc `UNIQUE` từ chính PostgreSQL (mã lỗi `23505`) và trả về thông báo nghiệp vụ rõ ràng ("Số phòng đã tồn tại") thay vì lỗi 500 khó hiểu.

### 2.3 Services (`/services`)
Danh mục dịch vụ đi kèm (ăn sáng, đưa đón sân bay...) — CRUD cho Admin, danh sách công khai cho khách. Dịch vụ có thể được ghi nhận thêm vào một đơn đặt phòng đang lưu trú (xem 2.5) và cộng dồn vào hóa đơn cuối.

### 2.4 Promotions (`/promotions`)
Mã khuyến mãi.
- `GET /promotions/:code/validate` — kiểm tra hợp lệ và tự tính số tiền được giảm theo tổng giá trị đơn.
- CRUD + bật/tắt mã cho Admin, tự đếm số lần mã đã được sử dụng.

### 2.5 Bookings (`/bookings`) — module phức tạp nhất

Quản lý toàn bộ vòng đời một đơn đặt phòng: `PENDING → CONFIRMED → CHECKED_IN → CHECKED_OUT`, hoặc `CANCELLED`.

**Chống đặt trùng phòng (double-booking) bằng Redis Distributed Lock:**
Khi tạo đơn, hệ thống khóa (`SETNX`, TTL 5 giây) theo từng cặp `(loại phòng, ngày lưu trú)` trước khi kiểm tra và trừ số lượng phòng còn trống, đảm bảo hai khách đặt cùng lúc cùng loại phòng/cùng ngày không thể "lách" qua nhau gây bán vượt quá số phòng thực có.

**Các nghiệp vụ đã xây dựng đầy đủ vòng đời đặt phòng:**
- `POST /bookings` — khách tự đặt phòng online: tự tính tiền phòng theo số đêm, áp mã khuyến mãi, tính **VAT 8%** trên tiền phòng ròng (sau giảm giá).
- `POST /bookings/walk-in` (Staff/Admin) — lễ tân lập đơn tại quầy cho khách vãng lai, gán thẳng vào một phòng cụ thể đang trống, không qua luồng đặt online.
- `PATCH /bookings/:id/confirm` — xác nhận đơn (dùng cho các phương thức cần lễ tân duyệt).
- `POST /bookings/:id/check-in` — nhận phòng: gán phòng thực tế, chuyển trạng thái phòng sang `OCCUPIED`; nếu khách thanh toán tiền mặt tại quầy thì tự động đánh dấu đơn là **đã thanh toán** (`paymentStatus = PAID`) ngay lúc check-in thay vì để lễ tân phải thao tác thêm bước riêng.
- `GET /bookings/:id/checkout-preview` — xem trước hóa đơn trả phòng (tiền phòng + dịch vụ phát sinh + phụ thu trả muộn nếu có) trước khi lễ tân chốt check-out.
- `POST /bookings/:id/check-out` — trả phòng: tính phụ thu trả muộn (checkout sau 12:00 giờ Việt Nam), cộng dồn dịch vụ, xuất hóa đơn cuối, trả phòng về trạng thái trống. **Toàn bộ các bước ghi dữ liệu (cập nhật đơn, cập nhật phòng, ghi dịch vụ) được bọc trong một transaction** để đảm bảo tính toàn vẹn — nếu một bước thất bại giữa chừng, không để lại dữ liệu nửa vời (vd. phòng đã set trống nhưng đơn chưa đóng).
- `POST /bookings/:id/services` — ghi nhận dịch vụ phát sinh trong lúc khách đang lưu trú, cộng dồn vào hóa đơn.
- `PATCH /bookings/:id/cancel` — hủy đơn có lý do, trả phòng về trạng thái trống.
- `GET /bookings`, `GET /bookings/my` — tra cứu có phân trang, lọc theo trạng thái (nhiều trạng thái cùng lúc), khoảng ngày ở, từ khóa (mã đơn/tên khách/SĐT/email), phòng cụ thể; khách hàng chỉ thấy đơn của chính mình, Staff/Admin thấy toàn bộ.

**Điểm kỹ thuật đáng chú ý phát hiện và sửa trong quá trình kiểm thử sâu (code review):**
- **Lỗi phân trang khi có join một-nhiều:** khi truy vấn đơn kèm join `serviceItems` (quan hệ một-nhiều), việc `skip()/take()` trực tiếp trên câu query chính làm nhân bản dòng kết quả (mỗi dịch vụ phát sinh tạo thêm 1 dòng đơn giả), khiến phân trang trả sai số lượng/nội dung. Khắc phục bằng chiến lược 2 bước chuẩn: truy vấn lấy đúng tập `id` cần trên trang hiện tại trước (không join quan hệ một-nhiều), rồi mới truy vấn lại đầy đủ dữ liệu theo đúng các `id` đó.
- **Lỗi ẩn sâu hơn của TypeORM:** trong bước lấy `id`, `.skip()/.take()` kết hợp với `getRawMany()` **không** sinh ra `LIMIT/OFFSET` trong SQL thực thi (đã xác minh trực tiếp bằng cách in ra câu SQL sinh ra), khiến toàn bộ dữ liệu vẫn bị trả về dù đã "phân trang". Khắc phục bằng cách dùng `.limit()/.offset()` thay thế — đã kiểm thử lại bằng cách gọi API thật trên một instance backend cô lập, xác nhận đúng số dòng ở nhiều trang khác nhau.
- **Lỗi múi giờ khi tính phụ thu trả muộn:** thời điểm "12:00 giờ" trước đó được tính theo giờ hệ điều hành của máy chủ, sai lệch khi triển khai ở múi giờ khác Việt Nam. Sửa bằng cách tính mốc 12:00 giờ Việt Nam (UTC+7) tường minh bằng `Date.UTC`, không phụ thuộc múi giờ máy chủ.

---

## 3. Frontend/Backend — Khu vực vận hành lễ tân (Sơ đồ phòng, Check-in/Check-out)

Đây là hạng mục lớn mới hoàn thiện trong đợt phát triển gần nhất, giải quyết bài toán thực tế: nhân viên lễ tân cần một nơi để xem trạng thái toàn bộ phòng, nhận/trả phòng và tra cứu lịch sử theo từng phòng — thay vì chỉ có luồng đặt phòng phía khách hàng.

### 3.1 Trang Sơ đồ phòng (`/admin/rooms`)
- Hiển thị toàn bộ phòng khách sạn theo từng tầng (dùng lại `GET /rooms/map`), có thanh lọc theo tầng/trạng thái/từ khóa và chú giải màu theo trạng thái (`Trống`, `Đang ở`, `Đã giữ chỗ`, `Đang dọn dẹp`, `Bảo trì`) — giao diện được xây dựng lại theo tham khảo thực tế từ phần mềm quản lý khách sạn thương mại, thống nhất bảng màu với Dashboard tổng quan.
- Bấm vào một phòng mở modal thao tác hợp nhất: xem chi tiết đơn đang gắn với phòng, nhận phòng, trả phòng, hoặc lập đơn vãng lai (walk-in) ngay tại phòng đang trống — không cần điều hướng qua nhiều trang rời rạc.

### 3.2 Nhận phòng bằng quét mã QR
- Mỗi đơn đặt phòng có một mã QR (sinh bằng `qrcode.react`) mã hóa `bookingId` để tra cứu nhanh — thiết kế lại từ payload ban đầu (chuỗi mô tả dài, không dùng để tra cứu được) thành payload gọn để quét-là-ra-đơn.
- Lễ tân quét QR bằng camera (`html5-qrcode`, component `QrCheckInModal`) → hệ thống tự tìm đúng đơn, hiển thị số tiền cần thu (nếu thanh toán tiền mặt) trước khi xác nhận nhận phòng.
- Nhận phòng bằng tiền mặt tự động chuyển trạng thái thanh toán sang "Đã thanh toán" (khớp phần backend ở mục 2.5).

### 3.3 Trả phòng (`AdminCheckoutPage`)
- Xem trước hóa đơn trả phòng (tiền phòng, dịch vụ phát sinh, phụ thu trả muộn nếu có, VAT) trước khi chốt, dùng chung component tổng hợp giá `BookingPriceSummary` với luồng đặt phòng phía khách hàng.
- Sau khi chốt trả phòng, trạng thái phòng trên Sơ đồ phòng được làm mới ngay (invalidate đúng cache tag của RTK Query cho cả danh sách phòng lẫn phòng cụ thể vừa trả) — trước đó có lỗi làm phòng vẫn hiển thị "đang ở" dù đã trả, đã được phát hiện và sửa trong đợt review.

### 3.4 Lập đơn vãng lai tại quầy (`WalkInBookingModal`)
Lễ tân có thể lập đơn ngay cho khách vãng lai trên một phòng trống cụ thể từ Sơ đồ phòng, không cần khách tự đặt online trước.

### 3.5 Lịch sử theo từng phòng
Từ trang chi tiết phòng (`AdminRoomDetailPage`), lễ tân/Admin xem lại được các đơn đặt phòng đã gắn với phòng đó theo thời gian — trả lời trực tiếp nhu cầu thực tế đã đặt ra: "nhân viên có xem được lịch sử check-in/check-out của từng phòng không".

### 3.6 Phân quyền STAFF vào khu quản trị
- Trước đây chỉ Admin đăng nhập được vào khu quản trị; STAFF bị đưa nhầm về luồng khách hàng. Đã mở quyền cho STAFF vào `/admin`, nhưng **giới hạn đúng phạm vi công việc**: STAFF chỉ thấy menu Sơ đồ phòng và Lịch làm việc cá nhân trên Sidebar, không thấy các mục quản trị hệ thống (Loại phòng, Tài khoản, Đặt phòng, Nhân viên...) — kiểm soát bằng danh sách `roles` cho từng mục menu và `@Roles()` guard tương ứng ở backend.
- STAFF đăng nhập vào `/admin` được điều hướng thẳng tới Sơ đồ phòng (không có trang Tổng quan/Dashboard, vốn chỉ dành cho Admin).

---

## 4. Frontend — Trang Quản lý đặt phòng cho Admin (`/admin/bookings`)

Trang mới cho Admin tra cứu **toàn bộ** lịch sử đặt phòng của khách sạn (khác với Sơ đồ phòng — vốn nhìn theo phòng, còn trang này nhìn theo đơn):
- Thẻ thống kê nhanh theo trạng thái (tổng đơn, chờ xác nhận, đã xác nhận, đang lưu trú, đã hoàn thành).
- Bộ lọc theo tab trạng thái, từ khóa (mã đơn/tên khách/SĐT/email) và khoảng ngày ở, có phân trang.
- Xem chi tiết từng đơn (khách, phòng, các dịch vụ đã dùng, tổng tiền, VAT) qua modal riêng mà không rời trang danh sách.

---

## 5. Frontend/Backend — Thanh toán trực tuyến qua PayOS & VAT

- Tích hợp cổng thanh toán **PayOS**: sinh mã QR thanh toán ngay trong luồng đặt phòng (inline checkout, không chuyển hướng rời trang), tự động **polling** trạng thái giao dịch để phát hiện khi khách đã thanh toán xong mà không cần khách tự bấm làm mới.
- Xử lý đúng trường hợp giao dịch **thất bại/hết hạn** (`FAILED`) — báo lỗi rõ ràng cho khách và cho phép thử lại, thay vì để đơn treo ở trạng thái không xác định.
- Áp dụng **VAT 8%** thống nhất trên tiền phòng ròng (sau khuyến mãi) ở cả luồng đặt online lẫn luồng lễ tân (check-in/check-out tại quầy), hiển thị tách bạch trong mọi bảng tổng hợp giá (`BookingPriceSummary`) và hóa đơn.
- Giao diện **lịch sử đặt phòng của khách hàng** được thiết kế lại: mã QR vé, tóm tắt phòng, thông tin khách, bảng dịch vụ đã dùng, và bảng tổng hợp giá — tách thành các component nhỏ dùng lại được (`BookingRoomSummary`, `BookingGuestInfoCard`, `BookingServiceItemsTable`, `BookingPriceSummary`) thay vì một khối JSX lớn khó bảo trì.

---

## 6. Frontend — Đăng ký / Đăng nhập (UI + xử lý lỗi chuẩn hóa)

- Validate phía client: định dạng email, độ dài mật khẩu tối thiểu (khớp rule backend) — chặn gọi API nếu dữ liệu chưa hợp lệ.
- Chuẩn hóa thông báo lỗi theo mã HTTP (400/401/409) thành câu tiếng Việt dễ hiểu, hiển thị bằng `react-toastify` — loại bỏ hoàn toàn `alert()`/`confirm()` gốc của trình duyệt.
- Đăng ký → xác minh OTP → tự động đăng nhập; đăng nhập thành công lưu token và **điều hướng theo vai trò** (Admin/Staff vào khu quản trị, khách hàng tiếp tục luồng đặt phòng).
- Tầng gọi API đăng nhập/đăng ký được xây bằng **RTK Query** (`authApi`), dùng chung một `axiosBaseQuery` nối vào Axios instance thật của dự án.
- Phát hiện và sửa một lỗi thật trong quá trình kiểm thử: mã kiểm tra quyền Admin cũ so sánh chuỗi `"admin"` (chữ thường) trong khi backend luôn trả `"ADMIN"` — nghĩa là trước đó không ai đăng nhập vào được khu quản trị. Sau này phát hiện thêm lỗi tương tự với vai trò STAFF (mục 3.6).

---

## 7. Frontend — Duy trì phiên đăng nhập & Phân quyền theo Route

- **Tự động làm mới access token khi hết hạn:** interceptor của Axios bắt lỗi `401`, tự gọi `POST /auth/refresh`, cập nhật token mới rồi gửi lại đúng request gốc — người dùng không bị đăng xuất giữa chừng khi access token (hạn 15 phút) hết hạn, miễn refresh token (hạn 7 ngày) còn hiệu lực.
- Dùng chung một "lời hứa" (promise) làm mới token cho nhiều request 401 xảy ra đồng thời, tránh việc refresh token bị thu hồi (rotate) bởi lần gọi đầu khiến lần gọi sau thất bại oan.
- **Route Guard dùng chung** (`ProtectedRoute`): chặn truy cập nếu chưa đăng nhập (đưa về `/login`, nhớ lại trang muốn vào để quay lại sau) hoặc sai vai trò (đưa về trang `/403`) — thay cho việc mỗi trang tự viết logic kiểm tra rời rạc. Áp dụng cho cả 3 vai trò (Customer/Staff/Admin) sau khi mở rộng quyền truy cập ở mục 3.6.

---

## 8. Frontend/Backend — Quản trị người dùng (Admin) & Đổi mật khẩu

### Backend bổ sung cho module Users
- `GET /users` — danh sách có filter theo vai trò, trạng thái, từ khóa tìm kiếm (tên/email/SĐT) + phân trang.
- `PATCH /users/:id/role`, `PATCH /users/:id/status` — đổi vai trò, khóa/mở khóa tài khoản (có chặn Admin tự khóa/tự đổi vai trò chính mình).
- `PATCH /users/me/password` — đổi mật khẩu cá nhân, xác thực mật khẩu cũ bằng bcrypt, validate mật khẩu mới đủ mạnh (≥ 8 ký tự, có cả chữ và số).

### Frontend
- Trang **Quản lý tài khoản** (`/admin/accounts`): bảng danh sách có filter + phân trang, đổi vai trò qua dropdown, khóa/mở khóa qua **modal xác nhận** (component `ConfirmModal` dùng chung, xây trên `Modal` dùng chung — modal dùng chung này sau đó được nâng cấp render qua React Portal để tránh bị một ancestor có `backdrop-blur`/`transform` bóp méo layout).
- Component `StatusBadge` dùng chung, tái sử dụng ở cả trang hồ sơ cá nhân lẫn bảng quản lý tài khoản.
- Form **Đổi mật khẩu** gắn vào trang hồ sơ cá nhân, validate độ mạnh mật khẩu, báo lỗi rõ ràng khi nhập sai mật khẩu cũ, toast xác nhận khi thành công.

---

## 9. Frontend — Dashboard tổng quan cho Admin

- Route `/admin` theo mô hình **nested routes** của React Router: một layout dùng chung (Sidebar + Header) bọc toàn bộ khu quản trị; Sidebar hỗ trợ **thu gọn/mở rộng** (lưu trạng thái vào `localStorage`) để nhường không gian cho các bảng dữ liệu rộng như Sơ đồ phòng/Quản lý đặt phòng.
- Trang chủ khu quản trị (chỉ Admin — STAFF vào `/admin` được điều hướng thẳng sang Sơ đồ phòng) hiển thị số liệu **thật**: tổng số người dùng (theo vai trò), tổng số đơn đặt phòng (theo trạng thái), số phòng trống/đang dùng, tổng số loại phòng — dạng thẻ KPI và biểu đồ phân bố có chú giải, đồng bộ màu sắc với Sơ đồ phòng.
- Backend `GET /dashboard/overview` được refactor để **tuân thủ đúng ranh giới modular monolith**: `DashboardService` không tự truy vấn trực tiếp vào repository của các module khác nữa, mà gọi qua service công khai của từng module (`UserService.countGroupedByRole()`, `BookingService.countGroupedByStatus()`, `RoomService.countGroupedByStatus()`, `RoomTypeService.count()`), giữ đúng nguyên tắc mỗi module chỉ lộ ra hành vi công khai, không lộ dữ liệu nội bộ.
- Khu vực "Truy cập nhanh" đã được cập nhật để phản ánh đúng các trang thật sự đã hoạt động (Sơ đồ phòng & Check-in, Loại phòng, Quản lý tài khoản, Quản lý đặt phòng), chỉ còn "Báo cáo doanh thu" (thuộc phạm vi Khoa) là gắn nhãn "Sắp ra mắt".

---

## 10. Phương pháp kiểm thử

Toàn bộ các hạng mục trên được kiểm thử thật với backend + PostgreSQL + Redis đang chạy, không chỉ đọc code:
- Tạo tài khoản thật qua luồng đăng ký → lấy mã OTP thật từ Redis → xác minh → đăng nhập; dựng tài khoản Admin/Staff thật để kiểm tra phân quyền.
- Gọi trực tiếp từng API bằng `curl` để xác nhận đúng mã lỗi (400/401/403/409) và đúng hành vi nghiệp vụ (khóa tài khoản chặn đăng nhập ngay lập tức, đổi mật khẩu xong đăng nhập lại bằng mật khẩu mới thành công, phân trang trả đúng số dòng ở nhiều trang khác nhau...).
- Với các lỗi khó tái hiện (race-condition, lỗi sinh SQL của ORM), dựng một **instance backend cô lập trên cổng riêng** để kiểm thử fix mà không ảnh hưởng tới server dev đang chạy của người dùng, xác minh bằng cách so sánh trực tiếp câu SQL sinh ra và kết quả trả về trước/sau khi sửa.
- Toàn bộ dữ liệu thử nghiệm và các script debug tạm thời được dọn sạch khỏi cơ sở dữ liệu/repository sau khi kiểm thử xong.

---

## 11. Công nghệ sử dụng

**Backend:** NestJS, TypeORM, PostgreSQL, Redis (ioredis) — dùng cho khóa phân tán chống double-booking và lưu OTP/refresh-token, JWT (access + refresh token có cơ chế rotate), class-validator, tích hợp PayOS SDK, Cloudinary (lưu trữ ảnh).

**Frontend:** React, React Router (nested routes), Redux Toolkit Query (gọi API thật qua Axios base query dùng chung, quản lý cache bằng tag-based invalidation), Tailwind CSS, react-toastify, `react-i18next` (đa ngôn ngữ Việt/Anh), `qrcode.react` (sinh mã QR vé), `html5-qrcode` (quét QR bằng camera để check-in).

---

## 12. Các phần ngoài phạm vi báo cáo này

Hai module `/reviews` (đánh giá) và `/chat` (trợ lý AI đặt phòng qua hội thoại) hiện mới có phần khung ở frontend (dữ liệu mẫu tĩnh, chưa nối API thật) và **chưa có module backend tương ứng** — đây là hạng mục dự kiến triển khai tiếp theo, chưa thuộc phạm vi kiểm thử của báo cáo này. Các module `/shifts` (phân ca nhân viên), `/payments` (hạ tầng cổng thanh toán dùng chung) và `/notifications` thuộc phạm vi trách nhiệm của Khoa nên không được trình bày chi tiết ở đây.

---

*Báo cáo được tổng hợp dựa trên mã nguồn thực tế trong repository (nhánh `Vinh`) và kết quả kiểm thử trực tiếp tính đến thời điểm lập báo cáo.*
