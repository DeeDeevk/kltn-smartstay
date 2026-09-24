# API ViKaHotel — tài liệu cho Mobile

Tài liệu này mô tả toàn bộ REST API + WebSocket của backend NestJS (`t:\kltn-vika-hotel-booking\backend`), viết trực tiếp từ code hiện tại (controller + DTO + entity), không phải từ thiết kế trên giấy — nếu sau này code đổi mà quên cập nhật file này thì code là nguồn đúng.

## 0. Những điều BẮT BUỘC phải đọc trước khi code mobile

### 0.1. Đăng nhập bằng mật khẩu đang yêu cầu Cloudflare Turnstile — có thể chặn mobile hoàn toàn

`POST /auth/login` bắt buộc field `turnstileToken` (captcha invisible của Cloudflare, do widget JS chạy trên web tạo ra). Backend gọi thẳng API `siteverify` của Cloudflare để xác minh token, và còn kiểm tra `hostname` trả về từ Cloudflare có nằm trong danh sách `TURNSTILE_ALLOWED_HOSTNAMES` (cấu hình trong `.env`) hay không — danh sách này hiện chỉ có tên miền web, không có gì tương đương cho app native.

**Hệ quả: app mobile (native, không phải WebView) hiện KHÔNG có cách nào tự tạo ra `turnstileToken` hợp lệ**, vì Turnstile không có SDK cho iOS/Android, chỉ có widget web. Nếu gọi thẳng `POST /auth/login` mà không có token, backend trả lỗi 400 ngay từ `ValidationPipe` (thiếu field bắt buộc).

→ **Cần bên backend (Vinh/Khoa) quyết định hướng xử lý** trước khi mobile code màn đăng nhập bằng mật khẩu, ví dụ một trong các hướng:
- Thêm một endpoint đăng nhập riêng cho mobile (không cần Turnstile, có thể thay bằng cách xác thực khác).
- Cho mobile app nhúng WebView chạy trang login web để lấy token rồi gửi kèm.
- Bỏ Turnstile khi request đến từ 1 API key/secret riêng của app mobile.

**Chưa bị ảnh hưởng:** `POST /auth/register` (đăng ký), `POST /auth/google` (đăng nhập Google) và tất cả các endpoint OTP đều **không** yêu cầu `turnstileToken`. Nếu mobile ưu tiên làm đăng ký + đăng nhập Google trước thì có thể code ngay, không bị chặn bởi vấn đề này.

### 0.2. Refresh token nằm trong cookie `httpOnly`, không trả trong JSON

`POST /auth/login`, `/auth/register` (sau khi verify OTP thì tự đăng nhập ở màn login), `/auth/google`, `/auth/refresh` đều trả access token trong JSON (`accessToken`), nhưng **refresh token KHÔNG có trong JSON** — nó được set qua header `Set-Cookie` (`httpOnly`, `path=/api/v1/auth`, sống 7 ngày), đúng kiểu hành vi trình duyệt web.

Với app mobile (React Native, Flutter, native iOS/Android...), HTTP client cần:
- Có cookie jar/cookie storage và **tự động gửi lại đúng cookie đó** khi gọi `POST /api/v1/auth/refresh` (khớp domain + path `/api/v1/auth`).
- Hầu hết HTTP client hiện đại (OkHttp có `CookieJar`, iOS `URLSession` có `HTTPCookieStorage`, Flutter package `dio` + `cookie_jar`, React Native `fetch` mặc định **không** tự lưu cookie — cần cấu hình thêm hoặc dùng thư viện khác) đều hỗ trợ được, nhưng phải cấu hình rõ ràng, không phải mặc định.
- Nếu HTTP client của mobile không lưu được cookie, sẽ không refresh được token khi access token hết hạn (mặc định access token sống ngắn, xem `.env` biến `JWT_ACCESS_EXPIRES`) → người dùng bị đăng xuất liên tục.

Nếu mobile team không muốn xử lý cookie, cũng cần trao đổi với backend để có phương án khác (ví dụ trả refresh token trong JSON riêng cho mobile, đánh đổi bảo mật).

### 0.3. Base URL, tiền tố, định dạng lỗi chung

- Local dev: `http://localhost:3000/api/v1` (cổng đọc từ `.env` biến `PORT`, mặc định `3000`).
- Mọi route đều có tiền tố `/api/v1` (`app.setGlobalPrefix('api/v1')` trong `main.ts`).
- Ngoài route liệt kê dưới đây, còn `GET /api/v1` trả `"Hello World!"` — chỉ dùng để test backend còn sống, không phải API nghiệp vụ.
- Không có Swagger/OpenAPI tự sinh trong repo — đây là tài liệu thủ công duy nhất.

**Định dạng lỗi (mặc định của NestJS, không có exception filter tuỳ chỉnh):**
```json
{
  "statusCode": 400,
  "message": "Ngày check-in phải trước ngày check-out",
  "error": "Bad Request"
}
```
Lỗi validate `class-validator` (400) có `message` là **mảng chuỗi**, mỗi phần tử là 1 lỗi field:
```json
{
  "statusCode": 400,
  "message": ["email must be an email", "password should not be empty"],
  "error": "Bad Request"
}
```
Body dư field không khai báo trong DTO sẽ bị `ValidationPipe` tự loại bỏ (`whitelist: true`), không báo lỗi.

Riêng lỗi hết hạn mức chat AI (mục 9) có thêm field `code` để phân biệt với lỗi rate-limit thường — xem mục đó.

### 0.4. Header xác thực

Mọi endpoint cần đăng nhập đều đọc access token qua header chuẩn:
```
Authorization: Bearer <accessToken>
```
Không dùng cookie cho access token (chỉ refresh token mới qua cookie — xem 0.2).

### 0.5. Giới hạn tần suất (rate limit)

- Mặc định toàn hệ thống: **30 request/phút** cho mỗi IP (`ThrottlerModule.forRoot([{ ttl: 60000, limit: 30 }])`).
- Các endpoint nhạy cảm ở `/auth` (`register`, `login`, `verify-otp`, `resend-otp`, `forgot-password`, `verify-reset-otp`, `reset-password`): **5 request/phút**.
- `POST /ai-agent/chat`: **10 request/phút** mỗi IP, cộng thêm **100 tin nhắn/24 giờ** mỗi tài khoản đã đăng nhập (xem mục 9).
- Vượt giới hạn trả **429 Too Many Requests**.

---

## 1. Xác thực (`/auth`)

Có 3 kiểu tài khoản (`role`): `CUSTOMER` (khách hàng — mobile chủ yếu phục vụ nhóm này), `STAFF` (lễ tân), `ADMIN`.

### 1.1. `POST /auth/register` — Đăng ký (bước 1/2, gửi OTP)
Không cần đăng nhập. Giới hạn 5 req/phút.

Body:
```json
{
  "email": "khach@example.com",
  "password": "matkhau123",
  "fullName": "Nguyễn Văn A",
  "phone": "0901234567"
}
```
- `password`: tối thiểu 6 ký tự.
- `phone`: không bắt buộc.

Response `200`:
```json
{ "message": "Vui lòng kiểm tra email để lấy mã OTP xác minh tài khoản" }
```
Lưu ý: **chưa tạo tài khoản** ở bước này — dữ liệu đăng ký tạm lưu trong Redis 90 giây, chỉ tạo `User` thật sau khi `verify-otp` đúng mã. Email trùng hoặc SĐT trùng → `409 Conflict`.

### 1.2. `POST /auth/verify-otp` — Xác minh OTP đăng ký (bước 2/2)
Giới hạn 5 req/phút.

Body:
```json
{ "email": "khach@example.com", "otp": "123456" }
```
- `otp`: đúng 6 ký tự.

Response `200`: `{ "message": "Đăng ký tài khoản thành công, vui lòng đăng nhập" }`

Sai OTP quá 5 lần trong 90 giây → khoá luôn phiên đăng ký đó (`401`). Sai mã hoặc hết hạn → `401`.

### 1.3. `POST /auth/resend-otp` — Gửi lại OTP đăng ký
Giới hạn 5 req/phút. Body: `{ "email": "khach@example.com" }`. Phải đợi ít nhất 30 giây kể từ lần gửi trước, nếu không → `401`.

### 1.4. `POST /auth/login` — Đăng nhập bằng mật khẩu
⚠️ Xem mục 0.1 — hiện cần `turnstileToken`, mobile app native chưa tạo được token này.

Giới hạn 5 req/phút. Body:
```json
{
  "email": "khach@example.com",
  "password": "matkhau123",
  "turnstileToken": "<token từ widget Cloudflare Turnstile>"
}
```

Response `200` (JSON body; **refresh token nằm trong `Set-Cookie`, không có ở đây** — xem 0.2):
```json
{
  "accessToken": "eyJhbGciOi...",
  "user": {
    "userId": "b3d1f2b0-....",
    "email": "khach@example.com",
    "role": "CUSTOMER"
  }
}
```
Sai email/mật khẩu, tài khoản bị khoá, hoặc tài khoản chỉ đăng ký bằng Google (không có mật khẩu) → `401`.

### 1.5. `POST /auth/google` — Đăng nhập / đăng ký bằng Google
Không giới hạn riêng (chỉ giới hạn chung 30/phút). **Không cần `turnstileToken`.**

Body: `{ "idToken": "<Google ID token lấy từ Google Sign-In SDK>" }`

Response `200`: giống hệt shape của `login` (accessToken + user + cookie refresh token). Nếu email Google chưa có tài khoản → tự tạo mới (role `CUSTOMER`); nếu email đã tồn tại (kể cả tài khoản tạo bằng mật khẩu) → tự gắn thêm phương thức đăng nhập Google vào tài khoản đó (auto-link). Token Google không hợp lệ hoặc email chưa verify → `401`.

### 1.6. `POST /auth/refresh` — Làm mới access token
Không cần header `Authorization`. **Bắt buộc phải gửi kèm cookie** `refresh_token` (xem 0.2) — nếu thiếu cookie → `401` ngay.

Response `200`: giống `login` (accessToken mới + user), và set lại cookie refresh token mới (rotation — token cũ bị thu hồi ngay sau khi dùng, gọi lại request cũ lần 2 sẽ lỗi).

### 1.7. `POST /auth/logout` — Đăng xuất
Cần đăng nhập (`Authorization: Bearer`). Thu hồi access token hiện tại + refresh token liên quan, xoá cookie refresh token.

Response `200`: `{ "message": "Đăng xuất thành công" }`

### 1.8. `GET /auth/me` — Thông tin tài khoản đang đăng nhập
Cần đăng nhập. Response `200`:
```json
{
  "userId": "b3d1f2b0-....",
  "fullName": "Nguyễn Văn A",
  "email": "khach@example.com",
  "phone": "0901234567",
  "idNumber": null,
  "address": null,
  "role": "CUSTOMER",
  "status": "Active",
  "createdAt": "2026-01-10T02:00:00.000Z",
  "updatedAt": "2026-01-10T02:00:00.000Z",
  "mustChangePassword": false
}
```
`mustChangePassword: true` chỉ xảy ra với tài khoản `STAFF` được Admin tạo hộ (xem 1.9) và chưa đổi mật khẩu tạm lần đầu — mobile khách hàng thường không gặp.

### 1.9. Quên mật khẩu (3 bước)
1. `POST /auth/forgot-password` — Body: `{ "email": "..." }`. Luôn trả cùng 1 message dù email có tồn tại hay không (tránh lộ thông tin): `{ "message": "Nếu email tồn tại trong hệ thống, chúng tôi đã gửi mã OTP đặt lại mật khẩu" }`.
2. `POST /auth/verify-reset-otp` — Body: `{ "email": "...", "otp": "123456" }` → `{ "message": "Mã OTP hợp lệ" }`.
3. `POST /auth/reset-password` — Body: `{ "email": "...", "otp": "123456", "newPassword": "matkhaumoi123" }` (tối thiểu 6 ký tự) → `{ "message": "Đặt lại mật khẩu thành công, vui lòng đăng nhập lại" }`.

Cả 3 bước giới hạn 5 req/phút, không cần đăng nhập.

### 1.10. `POST /auth/create-staff` — Admin tạo tài khoản lễ tân
Chỉ `ADMIN`. Không dùng cho mobile khách hàng, liệt kê để mobile lễ tân/quản lý (nếu có) biết luồng: Admin tạo, backend tự sinh mật khẩu tạm và gửi qua email nhân viên, Admin không thấy mật khẩu này. Body: `{ "email", "fullName", "phone"?, "idNumber"?, "address"? }`.

---

## 2. Người dùng (`/users`)

### 2.1. `GET /users/me` — Hồ sơ của chính mình
Cần đăng nhập. Response: shape `User` giống mục 1.8 nhưng **không có** field `mustChangePassword`.

### 2.2. `PATCH /users/me` — Sửa hồ sơ của chính mình
Cần đăng nhập. Body (mọi field đều tuỳ chọn):
```json
{ "fullName": "Nguyễn Văn A", "phone": "0901234567", "address": "...", "idNumber": "..." }
```
Không đổi được `email`/`role`/`status` qua endpoint này.

### 2.3. `PATCH /users/me/password` — Đổi mật khẩu
Cần đăng nhập. Body:
```json
{ "oldPassword": "matkhaucu", "newPassword": "MatKhauMoi123" }
```
`newPassword`: tối thiểu 8 ký tự, phải có cả chữ và số.

### 2.4–2.7. Các endpoint chỉ `ADMIN`
- `GET /users?role=&status=&search=&page=&limit=` — danh sách người dùng (phân trang).
- `GET /users/:id` — chi tiết 1 người dùng.
- `PATCH /users/:id` — sửa hồ sơ người khác (cùng body như 2.2).
- `PATCH /users/:id/role` — đổi vai trò, body `{ "role": "STAFF" }` (`UserRole`: `CUSTOMER`/`STAFF`/`ADMIN`). Không tự đổi vai trò chính mình được.
- `PATCH /users/:id/status` — khoá/mở khoá, body `{ "status": "Locked" }` (`UserStatus`: `Active`/`Locked`). Không tự khoá chính mình được.

---

## 3. Loại phòng (`/room-types`)

Public (không cần đăng nhập) cho 2 endpoint đọc — dùng để dựng màn "Danh sách phòng" / "Chi tiết phòng" phía khách.

### 3.1. `GET /room-types?capacity=&priceMin=&priceMax=&search=`
Chỉ trả các loại phòng đang `ACTIVE`. Response — mảng object `RoomType`:
```json
[
  {
    "roomTypeId": "d290f1ee-....",
    "name": "Deluxe Ocean View",
    "description": "Phòng nghỉ rộng rãi với view biển...",
    "basePrice": 2500000,
    "capacity": 2,
    "amenities": ["Wifi miễn phí", "Điều hòa", "Minibar"],
    "images": ["https://.../room1.jpg", "https://.../room2.jpg"],
    "status": "ACTIVE",
    "createdAt": "...",
    "updatedAt": "..."
  }
]
```
`amenities`/`images` là mảng chuỗi tự do (không enum).

### 3.2. `GET /room-types/:id` — Chi tiết 1 loại phòng
Response: 1 object `RoomType` như trên. Không tồn tại hoặc đã `INACTIVE` → `404`.

### 3.3–3.5. Chỉ `ADMIN`
- `POST /room-types` — body: `{ "name", "description"?, "basePrice", "capacity", "amenities"?, "images"? }`.
- `PATCH /room-types/:id` — mọi field tuỳ chọn, cùng shape.
- `DELETE /room-types/:id` — ngưng kinh doanh (soft delete, đổi status thành `INACTIVE`), không xoá dữ liệu. Từ chối nếu đang có booking hiệu lực gắn với loại phòng này.

---

## 4. Phòng (`/rooms`)

### 4.1. `GET /rooms/availability?checkIn=YYYY-MM-DD&checkOut=YYYY-MM-DD&guests=2&roomTypeId=` (tuỳ chọn)
**Public**, đây là endpoint tìm phòng trống chính cho màn tìm kiếm phía khách. Trả về **theo loại phòng** (gộp số phòng trống), không phải từng phòng vật lý.

Response — mảng, mỗi phần tử là `RoomType` (như mục 3.1) cộng thêm `availableCount`:
```json
[
  {
    "roomTypeId": "d290f1ee-....",
    "name": "Deluxe Ocean View",
    "basePrice": 2500000,
    "capacity": 2,
    "amenities": [...],
    "images": [...],
    "status": "ACTIVE",
    "availableCount": 3
  }
]
```
Ngày check-in phải trước check-out, nếu không → `400`.

### 4.2. `GET /rooms/map`, `GET /rooms/:id` — chỉ `STAFF`/`ADMIN`
Sơ đồ phòng vật lý — mobile khách hàng không cần. `GET /rooms/map?floorId=&roomTypeId=&checkIn=&checkOut=` trả mảng `Room` (có `roomNumber`, `floor`, `roomType` lồng bên trong, `status`), kèm `rangeStatus: "AVAILABLE" | "BOOKED"` và `rangeGuestName` nếu có truyền `checkIn`/`checkOut`.

### 4.3–4.4. `POST /rooms`, `PATCH /rooms/:id/status` — chỉ `ADMIN`/`STAFF`
Tạo phòng vật lý mới, đổi trạng thái phòng (`RoomStatus`: `AVAILABLE`/`OCCUPIED`/`RESERVED`/`CLEANING`/`MAINTENANCE`).

---

## 5. Đặt phòng (`/bookings`)

**Toàn bộ controller yêu cầu đăng nhập** (`@UseGuards(JwtAuthGuard)` ở cấp controller).

### 5.1. `POST /bookings` — Khách tự đặt phòng
Body:
```json
{
  "roomTypeId": "d290f1ee-....",
  "checkIn": "2026-10-01",
  "checkOut": "2026-10-03",
  "guestInfo": { "fullName": "Nguyễn Văn A", "phone": "0901234567", "email": "a@example.com" },
  "extraServiceIds": ["service-uuid-1"],
  "promotionCode": "SUMMER25",
  "paymentMethod": "CASH"
}
```
- `guestInfo`: bắt buộc `fullName`, `phone`; `email` tuỳ chọn. Đây là thông tin người ở, có thể khác tài khoản đặt (đặt hộ).
- `extraServiceIds`, `promotionCode`, `paymentMethod` đều tuỳ chọn. `paymentMethod`: `CASH` (mặc định) hoặc `PAYOS`.
- Đơn được tạo với `userId` = tài khoản đang đăng nhập (lấy từ token, không truyền trong body).
- Hết phòng loại đó trong khoảng ngày → `409 Conflict`.

Response `201` — object `Booking` chi tiết (xem shape đầy đủ ở mục 5.6), status ban đầu `PENDING`.

Nếu `paymentMethod: "PAYOS"`, đơn tạo xong ở trạng thái `PENDING`/`UNPAID` — gọi tiếp `POST /payments/payos/:bookingId/link` (mục 8.1) để lấy link/QR thanh toán.

### 5.2. `GET /bookings/my?status=&page=` — Đơn của chính mình
Response phân trang:
```json
{ "data": [ { "...Booking..." } ], "total": 12 }
```
`limit` cố định 10/trang (không truyền được qua query).

### 5.3. `GET /bookings/:id` — Chi tiết 1 đơn
Chủ đơn hoặc `STAFF`/`ADMIN` mới xem được, người khác → `403`.

### 5.4. `PATCH /bookings/:id/cancel` — Huỷ đơn
Body: `{ "reason": "Đổi lịch trình" }`. Chủ đơn hoặc `STAFF`/`ADMIN`. Chỉ huỷ được khi đơn đang `PENDING` hoặc `CONFIRMED` (đã check-in thì không huỷ được nữa) — trạng thái khác → `400`. Response `200`: `{ "message": "Đã huỷ đơn đặt phòng" }` (**không** trả lại object `Booking`, khác các endpoint khác trong mục này — nếu cần dữ liệu mới nhất, gọi lại `GET /bookings/:id`).

### 5.5. Nhóm endpoint chỉ `STAFF`/`ADMIN` (không dùng cho mobile khách hàng)
- `GET /bookings?status=&statuses=&roomId=&assignableRoomId=&search=&checkIn=&checkOut=&page=&limit=` — danh sách toàn khách sạn.
- `POST /bookings/walk-in` — lễ tân đặt hộ khách vãng lai cho 1 phòng vật lý cụ thể, tạo thẳng ở trạng thái `CONFIRMED` đã gán phòng (body có `roomId` thay vì `roomTypeId`).
- `GET /bookings/:id/checkout-preview` — xem trước hoá đơn trả phòng (phụ thu trễ giờ + dịch vụ).
- `PATCH /bookings/:id/confirm` — xác nhận đơn (`PENDING` → `CONFIRMED`).
- `POST /bookings/:id/check-in` — body `{ "roomId": "..." }`, gán phòng vật lý + đổi trạng thái.
- `POST /bookings/:id/check-out` — body tuỳ chọn `{ extraServices?, paymentMethod?, markPaid? }`.
- `POST /bookings/:id/services` — thêm dịch vụ vào đơn đang ở, body `{ "serviceId", "quantity" }`.

### 5.6. Shape đầy đủ của `Booking` (trả về từ mọi endpoint booking ở trên)

Backend trả **nguyên object `Booking` từ DB, lồng đầy đủ các quan hệ** (không rút gọn thành ID), cộng thêm 4 field tính toán ở cuối:

```json
{
  "bookingId": "9d2b....",
  "user": { "userId": "...", "fullName": "...", "email": "...", "phone": "...", "role": "CUSTOMER", "status": "Active", "...": "..." },
  "staff": null,
  "roomType": { "roomTypeId": "...", "name": "Deluxe Ocean View", "basePrice": 2500000, "...": "..." },
  "room": null,
  "checkInDate": "2026-10-01",
  "checkOutDate": "2026-10-03",
  "guestInfo": { "fullName": "Nguyễn Văn A", "phone": "0901234567", "email": "a@example.com" },
  "promotion": null,
  "discountAmount": 0,
  "roomAmount": 5000000,
  "lateNights": 0,
  "lateCheckoutFee": 0,
  "paidAmount": 0,
  "status": "PENDING",
  "cancelReason": null,
  "paymentMethod": "CASH",
  "paymentStatus": "UNPAID",
  "payosOrderCode": null,
  "serviceItems": [
    { "bookingServiceId": "...", "service": { "serviceId": "...", "name": "Giặt ủi", "price": 50000, "unit": "lần", "category": "SERVICE" }, "quantity": 1, "unitPrice": 50000, "createdAt": "..." }
  ],
  "createdAt": "...",
  "updatedAt": "...",
  "serviceAmount": 50000,
  "vatAmount": 400000,
  "totalAmount": 5450000,
  "dueAmount": 5450000
}
```
- `roomAmount`: giá phòng snapshot lúc đặt (basePrice × số đêm), không đổi dù giá loại phòng sau này thay đổi.
- `serviceAmount` = tổng `unitPrice × quantity` của `serviceItems` (tính lúc trả response, không lưu cột riêng).
- `vatAmount` = 8% của `(roomAmount + lateCheckoutFee − discountAmount)`, chỉ áp cho tiền phòng, không áp cho dịch vụ.
- `totalAmount` = tiền phòng sau VAT + `serviceAmount`.
- `dueAmount` = `totalAmount − paidAmount` (không âm) — số tiền còn phải thu.
- `staff`, `room`, `promotion` là `null` cho tới khi lễ tân xử lý (gán phòng lúc check-in, gán nhân viên...).

**Enum liên quan:** `BookingStatus`: `PENDING` → `CONFIRMED` → `CHECKED_IN` → `CHECKED_OUT`, hoặc `CANCELLED` bất kỳ lúc nào trước `CHECKED_IN`. `PaymentMethod`: `CASH`/`PAYOS`. `PaymentStatus`: `UNPAID`/`PAID`/`FAILED`.

---

## 6. Dịch vụ đi kèm (`/services`)

### 6.1. `GET /services?search=&category=` — Public
Chỉ trả dịch vụ đang `isActive: true`. `category` (`ServiceCategory`): `MINIBAR` hoặc `SERVICE`.
```json
[{ "serviceId": "...", "name": "Giặt ủi", "category": "SERVICE", "description": null, "price": 50000, "unit": "lần", "isActive": true, "createdAt": "...", "updatedAt": "..." }]
```

### 6.2–6.4. Chỉ `ADMIN`
`POST /services`, `PATCH /services/:id`, `DELETE /services/:id` (soft delete, đổi `isActive` = `false`).

---

## 7. Khuyến mãi (`/promotions`)

### 7.1. `GET /promotions?active=true` — Public
`active` tuỳ chọn (`true`/`false`), lọc theo `isActive`. Response — mảng `Promotion`:
```json
[{ "promotionId": "...", "code": "SUMMER25", "description": "Giảm 25% mùa hè", "discountType": "PERCENTAGE", "discountValue": 25, "startDate": "2026-06-01", "endDate": "2026-08-31", "usageLimit": 100, "usedCount": 12, "isActive": true, "createdAt": "...", "updatedAt": "..." }]
```
`discountType` (`DiscountType`): `PERCENTAGE` (`discountValue` là %, 0–100) hoặc `FIXED` (`discountValue` là số tiền VND cố định).

### 7.2. `GET /promotions/:code/validate?bookingAmount=5000000` — Public
Kiểm tra mã còn dùng được không, dùng khi khách nhập mã khuyến mãi lúc đặt phòng (trước khi thật sự gọi `POST /bookings`). Response `200`:
```json
{ "valid": true, "discountAmount": 1250000, "promotion": { "...Promotion..." } }
```
Mã không tồn tại → `404`. Hết hạn/hết lượt/đang tắt → `400`.

### 7.3–7.6. Chỉ `ADMIN`
`POST /promotions`, `PATCH /promotions/:id`, `PATCH /promotions/:id/toggle` (bật/tắt nhanh `isActive`), `DELETE /promotions/:id`.

---

## 8. Thanh toán PayOS (`/payments/payos`)

Chuyển khoản qua PayOS (QR/link thanh toán). Chỉ áp dụng khi đơn dùng `paymentMethod: "PAYOS"`.

### 8.1. `POST /payments/payos/:bookingId/link` — Tạo link/QR thanh toán cho đơn vừa đặt
Cần đăng nhập (chủ đơn hoặc staff/admin). Không cần body. Response `200`:
```json
{ "checkoutUrl": "https://pay.payos.vn/web/...", "qrCode": "00020101021...", "expiredAt": 1780012345 }
```
`qrCode` là chuỗi dữ liệu VietQR (mobile tự render thành ảnh QR bằng thư viện QR code, không phải URL ảnh). `expiredAt`: epoch giây, link sống ~15 phút. Đơn không dùng PayOS, đã thanh toán, hoặc chưa có mã đơn PayOS → `400`.

### 8.2. `GET /payments/payos/:bookingId/sync` — Đồng bộ trạng thái thanh toán
Cần đăng nhập. Gọi endpoint này khi mobile muốn chủ động hỏi PayOS xem đã thanh toán chưa (thay vì chỉ chờ webhook/realtime). Nếu PayOS báo đã `PAID`, backend tự cập nhật `Booking.paymentStatus` rồi trả **object `Booking` đầy đủ đã cập nhật** (shape như mục 5.6). Nếu chưa thanh toán, trả nguyên `Booking` hiện tại (không đổi).

### 8.3. `POST /payments/payos/webhook` — Chỉ PayOS gọi
Server-to-server, không có auth, chỉ hoạt động khi backend có URL public (không chạy được trên localhost). Mobile không gọi endpoint này.

### 8.4. `POST /payments/payos/:bookingId/checkout-link`, `GET /payments/payos/:bookingId/checkout-sync` — chỉ `STAFF`/`ADMIN`
Lễ tân tạo QR thu tiền còn lại lúc khách trả phòng — không phải luồng khách tự đặt online.

---

## 9. Trợ lý ảo AI (`/ai-agent`)

Chat dạng hỏi-đáp tự nhiên (tiếng Việt), backend tự gọi Gemini + các "tool" nội bộ (tìm phòng, tra khuyến mãi, chính sách, tạo booking...) rồi trả về câu trả lời soạn sẵn. Mobile chỉ cần 1 endpoint gửi tin + 1 endpoint xem lại lịch sử.

### 9.1. `POST /ai-agent/chat`
**Không bắt buộc đăng nhập** — khách vãng lai vẫn chat được (hỏi phòng, giá, khuyến mãi, chính sách, địa điểm/sự kiện quanh khách sạn), nhưng **thao tác đặt phòng qua chat bắt buộc phải đăng nhập** (nếu có gửi `Authorization` hợp lệ thì backend tự nhận diện và mở thêm các tool đặt phòng). Giới hạn 10 req/phút/IP.

Body:
```json
{
  "conversationId": "optional-uuid-nếu-đang-tiếp-tục-hội-thoại-cũ",
  "message": "Cho tôi xem phòng đôi giá dưới 2 triệu cho 2 người ở 20/10 đến 22/10",
  "confirmProposalId": "optional-chỉ-gửi-khi-bấm-nút-Xác-nhận-đặt-phòng"
}
```
- Lần đầu chat: bỏ trống `conversationId`, backend tự tạo hội thoại mới và trả `conversationId` trong response — mobile lưu lại để gửi tiếp các lượt sau (giữ ngữ cảnh hội thoại).
- `message`: tối đa 2000 ký tự.
- `confirmProposalId`: xem quy trình đặt phòng qua chat bên dưới.

Response `200`:
```json
{
  "conversationId": "c1a2....",
  "reply": "Dạ, hiện có Deluxe Ocean View giá 1.800.000đ/đêm còn 3 phòng trống ạ...",
  "rooms": [ { "roomTypeId": "...", "name": "...", "basePrice": 1800000, "capacity": 2, "amenities": [...], "images": [...], "availableCount": 3 } ],
  "promotions": null,
  "pendingBooking": null,
  "booking": null,
  "bookingFormRequest": null
}
```
Các field `rooms`/`promotions`/`pendingBooking`/`booking`/`bookingFormRequest` là **dữ liệu có cấu trúc đi kèm câu trả lời chữ**, để app tự vẽ UI (thẻ phòng, thẻ khuyến mãi...) thay vì phải tự parse `reply`. Field nào không liên quan tới lượt trả lời đó thì là `null`.

**Quy trình đặt phòng qua chat (khách đã đăng nhập):**
1. Khách mô tả nhu cầu → agent trả về `rooms` (danh sách loại phòng gợi ý).
2. Khách chọn phòng, cung cấp thông tin còn thiếu (ngày, số khách, tên, SĐT) → agent có thể trả `bookingFormRequest` (gợi ý các field còn thiếu, để app hiện form nhập thay vì bắt gõ chữ) — shape tuỳ ngữ cảnh, ví dụ `{ "roomTypeId": "...", "roomTypeName": "...", "checkIn": "...", "checkOut": "...", "guests": 2 }`.
3. Agent tính giá cuối cùng và trả về `pendingBooking` — bản tóm tắt đề xuất, **chưa tạo booking thật**:
   ```json
   {
     "proposalId": "p-....",
     "roomTypeId": "...", "roomTypeName": "Deluxe Ocean View",
     "checkIn": "2026-10-20", "checkOut": "2026-10-22", "nights": 2,
     "guestInfo": { "fullName": "Nguyễn Văn A", "phone": "0901234567" },
     "extraServiceIds": [], "promotionCode": null, "paymentMethod": "CASH",
     "roomAmount": 3600000, "serviceAmount": 0, "discountAmount": 0, "vatAmount": 288000,
     "totalAmount": 3888000
   }
   ```
4. Mobile hiển thị bản tóm tắt này cho khách bấm "Xác nhận" → gửi **1 lượt chat tiếp theo** với `confirmProposalId` = đúng `pendingBooking.proposalId` vừa nhận (kèm `message` bất kỳ, vd `"Xác nhận đặt phòng"`, vì backend ưu tiên đọc `confirmProposalId` hơn là đoán ý qua câu chữ).
5. Nếu khớp đúng đề xuất gần nhất, agent thật sự tạo booking (gọi `BookingService.create` bên trong) và trả về field `booking`:
   ```json
   { "bookingId": "...", "status": "PENDING", "totalAmount": 3888000, "paymentMethod": "CASH" }
   ```
   Nếu `paymentMethod` là `PAYOS`, response có thể có thêm thông tin link thanh toán (tương tự mục 8.1) — gọi lại `POST /payments/payos/:bookingId/link` nếu cần lấy lại QR.

Lỗi hết hạn mức ngày (chỉ áp dụng cho tài khoản đã đăng nhập, 100 tin/24h) trả `429` với shape riêng để phân biệt với rate-limit thường:
```json
{
  "statusCode": 429,
  "code": "AI_DAILY_QUOTA_EXCEEDED",
  "message": "Bạn đã dùng hết 100 lượt hỏi trợ lý ảo trong 24 giờ qua. Vui lòng thử lại sau hoặc liên hệ lễ tân để được hỗ trợ."
}
```
Rate-limit theo IP (10/phút) trả `429` shape mặc định (không có `code`).

### 9.2. `GET /ai-agent/conversations/:id` — Xem lại lịch sử 1 hội thoại
Không bắt buộc đăng nhập, nhưng nếu hội thoại đã gắn với 1 tài khoản thì chỉ tài khoản đó xem được (`403` nếu sai người, `404` nếu không tồn tại). Response — mảng tin nhắn theo thứ tự thời gian:
```json
[
  { "messageId": "...", "role": "USER", "content": "Cho tôi xem phòng đôi...", "toolName": null, "toolArgs": null, "toolResult": null, "createdAt": "..." },
  { "messageId": "...", "role": "TOOL", "content": null, "toolName": "search_rooms", "toolArgs": {...}, "toolResult": {...}, "createdAt": "..." },
  { "messageId": "...", "role": "MODEL", "content": "Dạ, hiện có...", "toolName": null, "toolArgs": null, "toolResult": null, "createdAt": "..." }
]
```
`role` (`AiMessageRole`): `USER`/`MODEL`/`TOOL`. Dòng `TOOL` là log nội bộ (agent tự gọi tool gì, tham số gì, kết quả gì) — mobile có thể lọc bỏ, chỉ hiển thị `USER`/`MODEL` cho khách xem, giống cách frontend web đang làm.

---

## 10. Chat với lễ tân (`/chat`) + Realtime (Socket.IO)

Khác mục 9 (chat với AI): đây là **chat thật với con người** (lễ tân trực), qua kênh REST (lấy lịch sử) + WebSocket (gửi/nhận tin nhắn theo thời gian thực). **Bắt buộc đăng nhập.**

### 10.1. REST

- `POST /chat/conversations` — Khách hàng lấy hội thoại đang mở của mình, tự tạo mới nếu chưa có. Response: object `Conversation` — `{ "conversationId": "...", "customer": {...User...}, "staff": null | {...User...}, "status": "OPEN", "createdAt": "...", "lastMessageAt": "..." }`.
- `GET /chat/conversations` — chỉ `STAFF`: danh sách hội thoại đang mở (để lễ tân chọn trả lời).
- `GET /chat/conversations/:id/messages` — lịch sử tin nhắn (chủ hội thoại hoặc `STAFF` mới xem được, `403` nếu sai người). Response — mảng, mỗi tin nhắn shape giống hệt sự kiện `chat:message` bên dưới.

### 10.2. WebSocket (Socket.IO)

Kết nối tới **gốc server** (không kèm `/api/v1`), ví dụ dev: `ws://localhost:3000` (namespace mặc định `/`). Xác thực bằng access token gửi trong `handshake.auth`:
```js
io("http://localhost:3000", { auth: { token: accessToken } })
```
Hoặc header `Authorization: Bearer <token>` lúc handshake. Token sai/hết hạn → server tự `disconnect` ngay sau khi connect. CORS của WebSocket dùng chung danh sách domain với REST (`CORS_ORIGIN` trong `.env`) — app mobile native không bị chặn CORS (CORS chỉ áp dụng cho trình duyệt), chỉ WebView mới cần quan tâm.

Sau khi connect thành công, client tự động được join sẵn 1 số room theo JWT (`user:<userId>` luôn có; thêm `staff`/`chat-staff` nếu role là STAFF/ADMIN) — không cần tự join các room này.

**Sự kiện client gửi lên:**
- `chat:join` — `{ "conversationId": "..." }`: tham gia phòng 1 hội thoại chat để nhận tin nhắn realtime của hội thoại đó. Gọi ngay sau khi có `conversationId` từ `POST /chat/conversations`.
- `chat:message` — `{ "conversationId": "...", "content": "Xin chào" }`: gửi tin nhắn (nội dung tự bị cắt bớt nếu quá dài ở server).

**Sự kiện server bắn xuống:**
- `chat:message` — broadcast tới mọi client đã join đúng hội thoại đó, shape:
  ```json
  { "conversationId": "...", "messageId": "...", "senderId": "...", "senderName": "Nguyễn Văn A", "senderRole": "CUSTOMER", "content": "Xin chào", "createdAt": "..." }
  ```
- `booking:updated` — chỉ gửi riêng cho đúng khách sở hữu đơn (room `user:<userId>`, tự động), bắn khi lễ tân xác nhận/check-in/check-out/huỷ đơn hoặc khi thanh toán PayOS chuyển trạng thái. Payload gồm `bookingId`, `status`, `paymentStatus` (tuỳ trường hợp) — dùng để mobile tự làm mới màn chi tiết đơn mà không cần polling.
- `booking:created`, `booking:paid`, `room:status-changed`, `chat:new-conversation` — chỉ bắn cho room `staff`/`chat-staff`, phía mobile khách hàng không cần lắng nghe.

---

## 11. Ca làm việc (`/shift-types`, `/shift-assignments`)

Dành cho app mobile của **nhân viên** (STAFF/ADMIN), không liên quan khách hàng.

- `GET /shift-types` — cần đăng nhập (mọi role), danh sách loại ca (`{ shiftTypeId, name, startTime, endTime }`, giờ dạng `HH:mm:ss`).
- `POST/PATCH/DELETE /shift-types` — chỉ `ADMIN`.
- `GET /shift-assignments/me?from=YYYY-MM-DD&to=YYYY-MM-DD` — lịch làm việc của chính nhân viên đang đăng nhập.
- `GET /shift-assignments?from=&to=&staffId=` — chỉ `ADMIN`, lịch toàn bộ nhân viên.
- `POST /shift-assignments` — chỉ `ADMIN`, phân ca: `{ "staffId", "shiftTypeId", "workDate", "note"? }`.
- `POST /shift-assignments/copy-week` — chỉ `ADMIN`: `{ "sourceWeekStart", "targetWeekStart" }` (cả 2 là ngày Thứ 2 đầu tuần).
- `DELETE /shift-assignments/:id` — chỉ `ADMIN`.
- `POST /shift-assignments/:id/check-in` — `{ "openingCash": 500000 }` (tiền mặt có sẵn trong két lúc vô ca), chủ ca đó gọi.
- `POST /shift-assignments/:id/check-out` — `{ "closingCash": 1200000 }` (tiền đếm được lúc kết ca), chủ ca đó gọi.
- `GET /shift-assignments/:id/report` — báo cáo chốt két (chủ ca hoặc `ADMIN`).

`ShiftAssignment.status` (`ShiftAssignmentStatus`): `SCHEDULED` → `CHECKEDIN` → `CHECKEDOUT`, hoặc `ABSENT`.

---

## 12. Thống kê — chỉ `ADMIN`/`STAFF` (dashboard), chỉ `ADMIN` (revenue)

- `GET /dashboard/overview` — số liệu tổng quan nhanh:
  ```json
  {
    "users": { "total": 120, "byRole": { "CUSTOMER": 100, "STAFF": 15, "ADMIN": 5 } },
    "bookings": { "total": 340, "byStatus": { "PENDING": 10, "CONFIRMED": 20, "CHECKED_IN": 5, "CHECKED_OUT": 300, "CANCELLED": 5 } },
    "rooms": { "total": 50, "byStatus": { "AVAILABLE": 30, "OCCUPIED": 15, "RESERVED": 2, "CLEANING": 2, "MAINTENANCE": 1 } },
    "roomTypes": { "total": 8 }
  }
  ```
- `GET /revenue/summary?from=YYYY-MM-DD&to=YYYY-MM-DD&groupBy=day|week|month|year` — doanh thu tổng + chuỗi thời gian + cơ cấu theo loại phòng.
- `GET /revenue/by-staff?from=&to=&groupBy=` — doanh thu quy theo từng nhân viên.

(Không liệt kê chi tiết response 2 endpoint revenue — ít khả năng mobile khách hàng cần; nếu mobile quản lý cần, đọc thêm `backend/src/revenue/revenue.service.ts`.)

---

## 13. Upload ảnh (`/uploads`)

`POST /uploads/image` — chỉ `ADMIN`. `multipart/form-data`, field tên `file`. Chấp nhận `jpg/jpeg/png/webp`, tối đa 5MB. Ảnh được tự resize + nén sang WebP trước khi lưu lên Cloudflare R2.

Response `201`: `{ "url": "https://.../abc.webp", "publicId": "vikahotel/room-types/abc.webp" }` — `url` dùng thẳng để hiển thị ảnh hoặc gán vào `RoomType.images`.

---

## 14. FAQ (`/faqs`)

- `GET /faqs` — **Public**, chỉ FAQ đang `isActive: true`. Dùng cho màn "Câu hỏi thường gặp" phía khách.
  ```json
  [{ "faqId": "...", "question": "Có được huỷ phòng miễn phí không?", "answer": "Quý khách có thể huỷ...", "category": "Huỷ phòng", "isActive": true, "createdAt": "...", "updatedAt": "..." }]
  ```
- `GET /faqs/all`, `POST /faqs`, `PATCH /faqs/:id`, `DELETE /faqs/:id`, `POST /faqs/reindex` — chỉ `ADMIN`.

---

## 15. Cấu hình khách sạn & sự kiện lân cận — chỉ `ADMIN`

`/hotel-config` (địa chỉ, toạ độ khách sạn) và `/local-events` (sự kiện địa phương dùng làm dữ liệu cho trợ lý AI) đều yêu cầu `ADMIN` cho **mọi** endpoint, kể cả đọc — hiện **không có API public** nào để mobile khách hàng lấy trực tiếp địa chỉ/toạ độ khách sạn hoặc danh sách sự kiện. Nếu mobile cần hiển thị các thông tin này cho khách, cần trao đổi thêm với backend (có thể cần mở endpoint đọc public riêng, tương tự cách `/faqs` GET đã làm).

---

## 16. Phụ lục — toàn bộ enum

| Enum | Giá trị |
|---|---|
| `UserRole` | `CUSTOMER`, `STAFF`, `ADMIN` |
| `UserStatus` | `Active`, `Locked` |
| `BookingStatus` | `PENDING`, `CONFIRMED`, `CHECKED_IN`, `CHECKED_OUT`, `CANCELLED` |
| `PaymentMethod` | `CASH`, `PAYOS` |
| `PaymentStatus` | `UNPAID`, `PAID`, `FAILED` |
| `RoomStatus` | `AVAILABLE`, `OCCUPIED`, `RESERVED`, `CLEANING`, `MAINTENANCE` |
| `RoomTypeStatus` | `ACTIVE`, `INACTIVE` |
| `ServiceCategory` | `MINIBAR`, `SERVICE` |
| `DiscountType` | `PERCENTAGE`, `FIXED` |
| `ShiftAssignmentStatus` | `SCHEDULED`, `CHECKEDIN`, `CHECKEDOUT`, `ABSENT` |
| `AiMessageRole` | `USER`, `MODEL`, `TOOL` |

---

## 17. Việc cần chốt trước khi mobile bắt đầu

1. **Cách đăng nhập bằng mật khẩu cho mobile** (mục 0.1) — cần quyết định phương án thay Turnstile.
2. **Cách lưu/gửi lại refresh token cookie trên HTTP client của mobile** (mục 0.2), hoặc đổi sang cách khác nếu team mobile không muốn xử lý cookie.
3. Nếu mobile cần hiển thị địa chỉ khách sạn / sự kiện lân cận cho khách (mục 15) — hiện chưa có endpoint public.

*(Tài liệu này do Claude Code tạo ra bằng cách đọc trực tiếp source code backend tại thời điểm viết — branch `Vinh`. Trước khi gửi chính thức cho mobile, Vinh nên đọc lại phần 0 và 17 để xác nhận hướng xử lý với team.)*
