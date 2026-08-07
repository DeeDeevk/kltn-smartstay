# NHẬT KÝ LÀM VIỆC NHÓM - HỆ THỐNG SMARTSTAY

### Dự án: SmartStay – Nền tảng quản lý đặt phòng trực tuyến thông minh tích hợp Trợ lý ảo AI

### Thành viên nhóm:

1. **Nguyễn Hồ Việt Khoa** (Phụ trách Backend NestJS, Database PostgreSQL, Redis Distributed Lock, WebSocket Real-time, AI Agent/RAG & Server)
2. **Mai Lưu Hữu Vinh** (Phụ trách Frontend React/Vite, UI/UX Design, Chat-to-Book, Cổng thanh toán & Smart Dashboard)

---

| Tuần | Công việc chi tiết | Thành viên thực hiện | Kết quả đạt được |

| :--- | :--- | :--- | :--- |
| **Tuần 01** | − Thảo luận và chốt định hướng đề tài SmartStay: nền tảng đặt phòng thông minh tích hợp trợ lý ảo AI cho một khách sạn/homestay đơn lẻ.<br>− Nghiên cứu kiến trúc Modular Monolith với **NestJS**, cơ chế khóa phân tán **Redis** và **WebSocket (Socket.IO)** cho bài toán chống trùng lịch và real-time.<br>− Khởi tạo Repository GitHub cho hệ thống. | **Nguyễn Hồ Việt Khoa** | Thống nhất phạm vi đề tài SmartStay, xác định rõ 3 trụ cột công nghệ lõi (NestJS – Redis – WebSocket), khởi tạo repo và môi trường backend ban đầu. |  
| | − Nghiên cứu các hệ thống OTA hiện đại (Booking.com, Agoda) và các sản phẩm có tích hợp AI chat để học hỏi trải nghiệm Chat-to-Book.<br>− Nghiên cứu công nghệ Frontend (React 19, Vite, Tailwind CSS v4, RTK Query). | **Mai Lưu Hữu Vinh** | Lựa chọn thành công Tech Stack cho frontend, phác thảo sơ bộ luồng "Chat-to-Book" và giao diện Smart Dashboard.
|
| **Tuần 02** | − Phân tích yêu cầu phi chức năng: bảo mật JWT, thời gian phản hồi API, và đặc biệt là **yêu cầu toàn vẹn dữ liệu khi có nhiều giao dịch đặt phòng đồng thời** (cơ sở cho Redis Lock).<br>− Soạn thảo SRS phần mô tả cơ sở dữ liệu và quản trị. | **Nguyễn Hồ Việt Khoa** | Xác định rõ ràng nghiệp vụ quản lý phòng, đặt phòng và ràng buộc chống trùng lịch ở mức yêu cầu hệ thống. |
| | − Xác định Actors trong hệ thống (Khách hàng, Lễ tân/Admin, Trợ lý AI).<br>− Xây dựng danh sách Use Cases chi tiết, bổ sung use case **"Chat-to-Book"** (đặt phòng qua hội thoại) và **"AI trả lời FAQ"**.<br>− Tổng hợp và hoàn thiện tài liệu SRS. | **Mai Lưu Hữu Vinh** | Tài liệu SRS hoàn chỉnh cho SmartStay, trong đó làm rõ vai trò trung tâm của trợ lý ảo AI trong luồng nghiệp vụ khách hàng. |

| **Tuần 03** | − Thiết kế Sequence Diagram cho luồng **Chat-to-Book**: AI Agent nhận câu hỏi → Function Calling gọi Room/Booking Service → trả kết quả → tạo đơn.<br>− Thiết kế Sequence Diagram cho luồng chống trùng lịch bằng **Redis Distributed Lock**.<br>− Thiết kế Usecase Diagram tổng quan hệ thống. | **Nguyễn Hồ Việt Khoa** | Hoàn thành sơ đồ tuần tự mô tả chính xác cơ chế AI gọi service nghiệp vụ và cơ chế khóa phân tán chống double-booking. |
| | − Thiết kế Activity Diagram mô tả luồng nghiệp vụ khách hàng qua khung chat (Tìm phòng → Tư vấn → Chốt phòng → Nhận QR thanh toán).<br>− Thiết kế Activity Diagram luồng nghiệp vụ Lễ tân (Nhận phòng, Trả phòng, Chuyển phòng vật lý) trên Smart Dashboard. | **Mai Lưu Hữu Vinh** | Bộ Activity Diagram chuẩn hóa luồng đặt phòng qua AI và luồng vận hành thực tế của lễ tân trên dashboard. |

| **Tuần 04** | − Thiết kế System Architecture Diagram tổng thể: NestJS Modular Monolith (Room, Booking, Payment, Shift), Redis, PostgreSQL, WebSocket Gateway, AI Agent Layer.<br>− Thiết kế cơ chế giao tiếp giữa Backend với bên thứ ba: PayOS API, LLM API (Function Calling).<br>− Nguyên tắc **AI không truy cập trực tiếp Database**, chỉ gọi qua tầng service. | **Nguyễn Hồ Việt Khoa** | Bản vẽ kiến trúc hệ thống chính xác, phân tách rõ trách nhiệm từng module và ranh giới bảo mật của AI Agent. |
| | − Thiết kế sơ đồ luồng dữ liệu (DFD) phía Client, bao gồm luồng dữ liệu real-time qua WebSocket.<br>− Khởi tạo cấu trúc dự án Frontend, cấu hình Axios/RTK Query, Router, biến môi trường, và client Socket.IO cơ sở. | **Mai Lưu Hữu Vinh** | Khung dự án Frontend sẵn sàng, chuẩn hóa cấu trúc components/services và tích hợp sẵn kết nối WebSocket phía client. |

| **Tuần 05** | − Thiết kế cơ sở dữ liệu quan hệ trên PostgreSQL, sơ đồ ERD.<br>− Định nghĩa schema chi tiết cho các thực thể cốt lõi (`User`, `Account`, `Room`, `RoomType`, `Floor`, `Booking`...) và các bảng hỗ trợ khóa/giao dịch. | **Nguyễn Hồ Việt Khoa** | Sơ đồ ERD hoàn chỉnh, kịch bản SQL khởi tạo bảng và tài liệu từ điển dữ liệu chi tiết. |
| | − Thiết kế Wireframe cho giao diện Khách hàng, trong đó có **khung chat trợ lý ảo** như một thành phần cố định trên mọi trang.<br>− Thiết kế Wireframe cho **Smart Dashboard** (sơ đồ phòng, doanh thu real-time) dành cho Lễ tân/Admin. | **Mai Lưu Hữu Vinh** | Bản thiết kế Wireframe chi tiết cho toàn bộ màn hình chính, đặt trợ lý AI làm trung tâm trải nghiệm khách hàng. |

| **Tuần 06** | − Khởi tạo dự án Backend bằng **NestJS**, tách module theo domain (Room, Booking, Payment, Shift), cấu hình TypeORM kết nối PostgreSQL.<br>− Viết tài liệu RESTful API (Swagger).<br>− Viết script Seeder dữ liệu phòng mẫu phục vụ kiểm thử. | **Nguyễn Hồ Việt Khoa** | Backend NestJS khởi động ổn định theo kiến trúc Modular Monolith, database được seed đầy đủ dữ liệu mẫu. |
| | − Xây dựng hệ thống UI Components dùng chung (Buttons, Modals, Inputs, Badges) cho Frontend.<br>− Thiết lập hệ màu sắc và Typography theo Tailwind CSS v4. | **Mai Lưu Hữu Vinh** | Bộ thư viện giao diện nội bộ đồng bộ, đáp ứng tiêu chuẩn Premium UI, sẵn sàng cho các module sau. |

| **Tuần 07** | − Thiết lập kết nối tới **Redis**, xây dựng prototype cơ chế **Distributed Lock** cho thao tác giữ phòng/đặt phòng.<br>− Thiết kế khung AI Agent Module: kết nối LLM API, chuẩn bị nền tảng cho **Function Calling**. | **Nguyễn Hồ Việt Khoa** | Cơ chế khóa phân tán Redis hoạt động ở mức prototype; khung kết nối AI Agent với LLM sẵn sàng để tích hợp Function Calling. |
| | − Phát triển giao diện phía Khách hàng (Client UI): trang chủ, banner tìm kiếm.<br>− Tích hợp React Datepicker phục vụ lọc phòng trống; xây dựng khung UI cho **Chatbot widget** (chưa nối AI thật). | **Mai Lưu Hữu Vinh** | Giao diện trang chủ hoàn thiện; khung chatbot nổi ở góc màn hình sẵn sàng để nối luồng Chat-to-Book. |

| **Tuần 08** | − Triển khai **Function Calling**: cho phép AI Agent gọi trực tiếp các service `findAvailableRooms`, `checkAvailability`, `createBooking`.<br>− Xây dựng Knowledge Base FAQ dạng Markdown và tích hợp **Vector Database + kỹ thuật RAG** để AI trả lời chính sách khách sạn (giờ check-in/out, chính sách hủy...). | **Nguyễn Hồ Việt Khoa** | AI Agent gọi được service nghiệp vụ qua Function Calling; pipeline RAG trả lời FAQ chính xác theo ngữ cảnh khách sạn. |
| | − Phát triển giao diện Search Result Page và lọc phòng trống động.<br>− Thiết kế giao diện chi tiết loại phòng (Room Type Detail). | **Mai Lưu Hữu Vinh** | Giao diện Tìm kiếm và Xem chi tiết phòng hoàn thành, responsive tốt trên mobile. |

| **Tuần 09** | − Phát triển module Auth trong NestJS: đăng ký/đăng nhập với JWT, mã hóa mật khẩu `bcrypt`.<br>− Thiết lập JWT Guard/Middleware phân quyền RBAC (Admin, Lễ tân, Khách hàng). | **Nguyễn Hồ Việt Khoa** | API Auth và cơ chế bảo mật RBAC hoàn thành, bảo vệ an toàn tài nguyên hệ thống theo vai trò. |
| | − Phát triển giao diện Đăng ký, Đăng nhập phía Frontend.<br>− Kết nối RTK Query với API Auth, lưu token/profile, đồng bộ trạng thái đăng nhập toàn app. | **Mai Lưu Hữu Vinh** | Tính năng Đăng nhập/Đăng ký hoạt động mượt mà, đồng bộ trạng thái người dùng trên giao diện. |

| **Tuần 10** | − Tích hợp SDK `@payos/node`, phát triển API tạo link thanh toán VietQR và Webhook cập nhật trạng thái đơn hàng.<br>− Triển khai **WebSocket Gateway (Socket.IO)** phát sự kiện cập nhật sơ đồ phòng khi có booking mới. | **Nguyễn Hồ Việt Khoa** | Tích hợp thành công cổng thanh toán PayOS tự động và WebSocket Gateway phát sự kiện real-time. |
| | − Phát triển giao diện Trang đặt phòng, hiển thị tóm tắt đơn.<br>− Nâng cấp **Chatbot widget thành luồng Chat-to-Book**: AI phản hồi gợi ý phòng kèm nút chốt đơn ngay trong khung chat, kết nối API `/chat` tới AI Agent. | **Mai Lưu Hữu Vinh** | Hoàn thành trang đặt phòng; khung chat AI cho phép khách hàng tìm và chốt phòng trực tiếp trong hội thoại. |

| **Tuần 11** | − Phát triển module Booking (`Booking`, `BookingDetail`), logic phân bổ phòng vật lý (`BookingRoomAllocation`) bọc trong **Redis Lock + Transaction** để tránh xung đột lịch đặt.<br>− Triển khai tính năng Chuyển phòng vật lý sau Check-in an toàn. | **Nguyễn Hồ Việt Khoa** | Hoàn thành nghiệp vụ đặt phòng lõi, đảm bảo không xảy ra double-booking dù nhiều người thao tác đồng thời. |
| | − Tích hợp giao diện thanh toán tự động: chuyển hướng sang trang thanh toán QR PayOS.<br>− Xây dựng trang kết quả đặt phòng (Thành công/Thất bại). | **Mai Lưu Hữu Vinh** | Luồng đặt phòng và thanh toán VietQR hoàn tất mượt mà từ Client, kể cả khi đặt qua Chat-to-Book. |
| **Tuần 12** | − Phát triển module Quản lý Ca trực (Shift) và Dịch vụ đi kèm (Extra Services).<br>− Hoàn thiện tài liệu API cho toàn bộ module, hỗ trợ Frontend kết nối. | **Nguyễn Hồ Việt Khoa** | Hỗ trợ Vinh kết nối API các trang quản lý, tối ưu hóa truy vấn dữ liệu. |

| | − Phát triển giao diện quản lý Admin: quản lý phòng, loại phòng (`RoomTypeManagePage.jsx`).<br>− Xây dựng tính năng quản lý tài khoản nhân viên (`AccountManagePage.jsx`, kèm phân quyền). | **Mai Lưu Hữu Vinh** | Toàn bộ giao diện CRUD tài khoản, phòng và loại phòng hoàn thiện, đạt chuẩn UX. |
| **Tuần 13** | − Tối ưu hóa Database: đánh index các cột quan trọng (`booking_date`, `room_id`).<br>− Kiểm thử tích hợp WebSocket end-to-end giữa Backend và nhiều client đồng thời để đảm bảo đồng bộ sơ đồ phòng chính xác. | **Nguyễn Hồ Việt Khoa** | Hiệu năng database tăng đáng kể; WebSocket đồng bộ ổn định giữa nhiều phiên lễ tân cùng lúc. |

| | − Phát triển **Room Grid Map** lắng nghe sự kiện WebSocket để tự động vẽ lại trạng thái phòng **real-time** (không cần refresh).<br>− Tích hợp modal tác vụ nhanh: Check-in, Check-out, Chuyển phòng.<br>− Xây dựng **Smart Dashboard** thống kê doanh thu, tỷ lệ lấp đầy phòng bằng Recharts, cập nhật gần thời gian thực. | **Mai Lưu Hữu Vinh** | Sơ đồ phòng cập nhật tức thời khi có đơn mới; Dashboard báo cáo thống kê trực quan, chuyên nghiệp. |

| **Tuần 14** | − Viết Unit/Integration Test cho logic phân bổ phòng, chống trùng lịch (Redis Lock) và tính chênh lệch giá.<br>− Xây dựng bộ Test Case đánh giá độ chính xác của AI Agent (tỷ lệ nhận đúng ý định, tỷ lệ Function Calling thành công).<br>− Rà soát bảo mật hệ thống. | **Nguyễn Hồ Việt Khoa** | Logic Backend và AI Agent vượt qua các bài kiểm thử; báo cáo thực nghiệm độ chính xác AI được ghi nhận. |
| | − Kiểm thử chất lượng Frontend, tối ưu tốc độ tải trang (Core Web Vitals).<br>− Kiểm thử luồng Chat-to-Book trên nhiều kịch bản hội thoại thực tế; rà soát lỗi hiển thị đa kích thước màn hình. | **Mai Lưu Hữu Vinh** | Giao diện mượt mà, hiệu năng tốt; luồng Chat-to-Book hoạt động ổn định qua nhiều kịch bản kiểm thử. |

| **Tuần 15** | − Triển khai Backend (NestJS + Redis + PostgreSQL) lên Docker/Cloud.<br>− Viết tài liệu triển khai, vận hành hệ thống; chuẩn bị slide báo cáo và kịch bản demo. | **Nguyễn Hồ Việt Khoa** | Backend deploy thành công lên cloud; slide và tài liệu kỹ thuật hoàn tất. |
| | − Triển khai Frontend lên Vercel.<br>− Kiểm tra hoạt động Chat-to-Book, thanh toán và WebSocket real-time trên môi trường production.<br>− Hoàn thiện báo cáo thuyết minh khóa luận bản cuối cùng. | **Mai Lưu Hữu Vinh** | Frontend chạy trực tuyến mượt mà, liên kết thành công với Backend cloud. Báo cáo khóa luận hoàn chỉnh. |
