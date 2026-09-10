TÀI LIỆU PHÂN TÍCH VÀ THIẾT KẾ HỆ THỐNG: SMARTSTAY
Nền tảng Quản lý và Đặt phòng Trực tuyến tích hợp Trợ lý ảo AI

1. Tổng quan và Mục tiêu Đề tài
   Tên đề tài: Xây dựng hệ thống SmartStay – Nền tảng quản lý khách sạn/homestay đơn lẻ thông minh tích hợp trợ lý ảo AI.

Mục tiêu cốt lõi: \* Xây dựng nền tảng web toàn diện phục vụ hai nhóm đối tượng chính: Khách hàng (tìm kiếm phòng, trò chuyện với trợ lý ảo AI để đặt phòng, thanh toán trực tuyến qua cổng PayOS) và Ban quản lý/Lễ tân (theo dõi sơ đồ phòng trực quan, quản lý ca trực, theo dõi doanh thu theo thời gian thực qua Smart Dashboard).

Giải quyết triệt để bài toán tranh chấp dữ liệu khi có nhiều người truy cập đặt phòng đồng thời (Double-Booking) bằng cơ chế khóa phân tán Redis Distributed Lock.

2. Công nghệ Sử dụng (Tech Stack Thực Tế)
   Backend:

Framework: NestJS (xây dựng theo kiến trúc Modular Monolith, phân tách rõ ràng theo bounded context: Auth, Account, User, Reservations (gồm Room, RoomType, Booking là các aggregate của cùng nghiệp vụ đặt phòng), Payment, Shift, Dashboard). Các module chỉ giao tiếp qua service công khai của nhau, không truy cập repository/entity của module khác.

Database: PostgreSQL kết hợp TypeORM.

Real-time & Locking: Redis (triển khai Distributed Lock) và WebSocket (Socket.IO) để đồng bộ sơ đồ phòng real-time.

AI & RAG Layer: LLM API kết hợp kỹ thuật Function Calling (để AI gọi an toàn các business services) và RAG trên tập dữ liệu FAQ khách sạn.

Frontend:

Framework/Library: React 19, Vite.

Styling: Tailwind CSS v4.

API & State Management: Sử dụng Axios Custom Services kết hợp React Context API (AuthContext) để quản lý và đồng bộ trạng thái đăng nhập, phân quyền toàn hệ thống.

3. Thiết kế Kiến trúc và Cấu trúc Dữ liệu (ERD)
   Hệ thống được thiết kế phân tầng rõ ràng, với các thực thể cốt lõi ánh xạ trực tiếp xuống cơ sở dữ liệu và các module code:

Module User / Auth: Quản lý tài khoản người dùng, phân quyền bảo mật (RBAC) với các vai trò (UserRole gồm: Admin, Staff/Lễ tân, Customer) và trạng thái tài khoản.

Module Room & RoomType: Quản lý thông tin loại phòng (giá, sức chứa, tiện ích như RoomAmenities) và các phòng vật lý thuộc từng tầng (Floor).

Module Booking: Quản lý thông tin đặt phòng (Booking, BookingDetail), phân bổ phòng vật lý và trạng thái thanh toán tự động qua mã QR/Webhook của cổng thanh toán PayOS.

Module Shift (Ca làm việc): Quản lý ca trực của nhân viên lễ tân (thời gian bắt đầu, kết thúc, bàn giao ca và báo cáo doanh thu trong ca trực thông qua các modal thao tác chuyên biệt như StartShiftModal, EndShiftModal).

4. Các Luồng Nghiệp Vụ Trọng Tâm (Core Flows)
   A. Luồng Chat-to-Book (Trợ lý ảo AI thông minh)
   Mô tả: Khách hàng không cần thực hiện các thao tác tìm kiếm thủ công qua nhiều bước mà có thể trò chuyện tự nhiên với Chatbot widget đặt cố định ở góc màn hình.

Cách vận hành: 1. Khách hàng gửi yêu cầu bằng ngôn ngữ tự nhiên (Ví dụ: "Tìm cho tôi phòng đơn vào cuối tuần này"). 2. AI Agent phân tích ý định (Intent Recognition) và kích hoạt cơ chế Function Calling để gọi trực tiếp các service nghiệp vụ backend tương ứng (như findAvailableRooms, checkAvailability). 3. Hệ thống trả về kết quả phòng trống, AI gợi ý chi tiết và cung cấp ngay nút chốt đơn trong khung chat để khách hàng tiến hành thanh toán.

Nguyên tắc bảo mật: AI tuyệt đối không truy cập trực tiếp vào Database mà phải thông qua Business Service Layer.

B. Cơ chế Chống Trùng Lịch (Anti-Double-Booking với Redis Lock)
Mô tả: Ngăn chặn hoàn toàn hiện tượng hai hay nhiều khách hàng cùng đặt thành công một phòng vật lý tại cùng một thời điểm.

Cách vận hành: Trước khi hệ thống ghi nhận đơn vào bảng bookings trong cơ sở dữ liệu PostgreSQL, Backend sử dụng Redis Distributed Lock để giữ khóa tạm thời định danh phòng trong một khoảng thời gian ngắn (TTL). Giao dịch nào gửi request đến trước sẽ lấy được khóa, các giao dịch tranh chấp đồng thời phía sau sẽ bị từ chối hoặc yêu cầu chọn phòng khác, đảm bảo tính toàn vẹn dữ liệu tuyệt đối.

C. Smart Dashboard và Đồng bộ Thời gian thực (WebSocket)
Mô tả: Phục vụ riêng cho bộ phận Lễ tân và Quản lý vận hành.

Cách vận hành: \* Giao diện Smart Dashboard cung cấp sơ đồ phòng trực quan (Room Grid Map) hiển thị trạng thái phòng theo thời gian thực (Trống, Đang ở, Đã đặt, Cần dọn dẹp).

Ngay khi có một đơn đặt phòng hoặc thanh toán thành công hoàn tất từ phía khách hàng (hoặc qua Chat-to-Book), Backend lập tức phát sự kiện qua WebSocket Gateway (Socket.IO) để tự động cập nhật lại sơ đồ phòng và các chỉ số doanh thu ngay lập tức trên màn hình lễ tân mà không cần phải tải lại trang (refresh).
