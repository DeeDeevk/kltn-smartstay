# Báo cáo tiến độ cá nhân — Vinh

**Dự án:** ViKaHotel — Hệ thống đặt phòng khách sạn thông minh (KLTN)
**Người thực hiện:** Vinh (vinhmai2109551)
**Báo cáo tính đến ngày:** 02/10/2026
**Buổi báo cáo:** Chủ nhật, 04/10/2026

---

## Tóm tắt nhanh

Trong giai đoạn từ 23/07/2026 đến nay, tôi phụ trách: khởi tạo giao diện frontend, các module nghiệp vụ cốt lõi (loại phòng, phòng, đặt phòng, khuyến mãi, dịch vụ, đánh giá), hệ thống realtime, và đặc biệt là mảng **Trợ lý AI (AI Agent)** — từ chatbot đặt phòng, RAG/FAQ, gợi ý địa điểm/sự kiện xung quanh khách sạn, cho đến các tính năng AI mới nhất: tự động quét sự kiện/địa điểm từ nguồn ngoài và tóm tắt đánh giá khách hàng.

---

## Giai đoạn 1 — Khởi tạo dự án & giao diện nền tảng (23/07 – 16/08/2026)

- **23/07/2026** — Khởi tạo frontend: dựng bộ khung component cốt lõi và tài liệu dự án ban đầu.
- **28/07/2026** — Thêm hiệu ứng nền động (background animation) cho trang Chủ, Đăng nhập, Đăng ký.
- **16/08/2026**:
  - Xây trang Đăng nhập/Đăng ký.
  - Cập nhật layout tổng thể, bổ sung hình ảnh, xây Footer.
  - Làm mới (revamp) Hero section trang chủ, xây trang Chi tiết phòng và trang Checkout.
  - Hoàn thiện giao diện trang xác thực, thanh điều hướng (header), slide video ở Hero.

## Giai đoạn 2 — Các module nghiệp vụ cốt lõi (22/08 – 24/08/2026)

- **22/08/2026**:
  - `feat(room-types)`: Module danh mục loại phòng — endpoint công khai + CRUD cho admin.
  - `feat(rooms)`: Quản lý phòng vật lý — sơ đồ tầng (floor map), kiểm tra phòng trống, theo dõi trạng thái phòng.
  - `feat(services)`: Danh mục dịch vụ đi kèm (add-on service) — lọc công khai + CRUD admin.
  - `feat(promotions)`: Module khuyến mãi — kiểm tra mã giảm giá + CRUD admin.
  - `feat(bookings)`: Vòng đời đặt phòng đầy đủ, dùng **khoá Redis chống đặt trùng phòng (double-booking)**.
- **23/08/2026**:
  - Xác thực: cơ chế tự làm mới token (silent refresh), hợp nhất guard cho route được bảo vệ.
  - Cải thiện giao diện đăng nhập/đăng ký, chuyển sang RTK Query, sửa kiểm tra quyền admin khi điều hướng.
- **24/08/2026**:
  - `feat(dashboard)`: Endpoint thống kê tổng quan (backend) + kết nối hook phía frontend.
  - `feat(admin)`: Tái cấu trúc layout trang quản trị theo nested routing, thêm trang Tổng quan (overview).
  - `feat(users)`: Quản lý người dùng cho admin, tự đổi mật khẩu, RTK Query slice cho user.
  - `feat(booking)`: Tích hợp cổng thanh toán **PayOS**, quản lý ảnh loại phòng qua Cloudinary.
  - `feat(room-types)`: Hỗ trợ tạo phòng vật lý, chặn thao tác khi phòng đang có đơn hoạt động, đa ngôn ngữ (i18n).
  - `feat(booking)`: Xử lý thanh toán PayOS thất bại, thêm VAT phòng, làm mới giao diện lịch sử đặt phòng.

## Giai đoạn 3 — Trải nghiệm quản trị, realtime & tối ưu AI Agent (07/09 – 19/09/2026)

- **07/09/2026**:
  - `feat(admin)`: Sơ đồ phòng (room map) tương tác, modal quản lý hợp nhất.
  - `feat(admin)`: Cấp quyền truy cập khu quản trị cho STAFF, check-in bằng mã QR.
  - Sửa lỗi kiểm tra quyền điều hướng (403), cập nhật sidebar.
- **08/09/2026** — Thanh toán dịch vụ, tách vai trò (role) rõ ràng, trang chi tiết loại phòng, cập nhật UI admin.
- **12/09/2026** — `feat(realtime)`: Tích hợp **Socket.IO** cho sơ đồ phòng trực tiếp, cảnh báo đặt phòng realtime, chat nhân viên–khách; thêm Redis, hỗ trợ SSL cho Neon Postgres.
- **13/09/2026** — Đồng bộ modal chi tiết đặt phòng với dữ liệu realtime, render qua portal an toàn.
- **14/09/2026** — Mở rộng đa dạng loại phòng, backfill dữ liệu phòng trống còn thiếu; sửa lỗi tính `availableCount` khi tìm phòng.
- **15/09/2026** — Cập nhật model embedding, tinh chỉnh bộ công cụ (tools) cho AI Agent.
- **18/09/2026** — Tích hợp Google Maps Places.
- **19/09/2026** — Loạt refactor tối ưu AI Agent:
  - Thêm composite index `(conversationId, createdAt)` trên bảng `AiMessage` (migration riêng).
  - Dùng `batchEmbedContents` để embed FAQ thay vì gọi từng cái một (giảm số lần gọi API).
  - Giới hạn số dòng lịch sử hội thoại đọc từ DB khi dựng ngữ cảnh cho LLM.
  - Ngừng eager-load quan hệ User khi chỉ cần kiểm tra chủ sở hữu hội thoại.
  - Ngừng tracking cache embedding RAG-eval trong git.
  - `feat(uploads)`: Chuyển lưu trữ ảnh từ Cloudinary sang **Cloudflare R2**.

## Giai đoạn 4 — Vị trí khách sạn & Sự kiện địa phương (22/09/2026)

- Redesign giao diện trang **Vị trí khách sạn**; chuyển nền bản đồ sang SDK chính thức của **Vietmap** (thay Google Maps) để sửa lỗi bản đồ trắng.
- `[KAN-98]` Entity + API CRUD cho **Sự kiện địa phương (LocalEvent)**.
- `[KAN-95]` Thêm trạng thái/nguồn gốc (status/source) cho sự kiện, endpoint duyệt sự kiện do AI đề xuất.
- Sửa lỗi agent trả lời sai địa chỉ khách sạn (đọc đúng từ `HotelConfig`).
- Cải thiện agent tổng hợp gợi ý địa điểm và sự kiện quanh khách sạn.
- Thêm tính năng AI hỗ trợ admin trích xuất sự kiện từ nguồn dán vào (link/text/file).

## Giai đoạn 5 — Mở rộng dữ liệu AI: tự động quét & địa điểm tham quan (28/09 – 01/10/2026)

- **28/09/2026** — Vá lỗi bảo mật **SSRF** khi trích xuất nội dung từ URL do admin cung cấp (chặn địa chỉ nội bộ/riêng tư, kiểm tra lại sau mỗi lần redirect).
- **30/09/2026** — Thêm hiển thị làm xám cho sự kiện đã qua ngày diễn ra.
- **01/10/2026**:
  - Thêm phương thức **Gemini search-grounding** (model tự tìm kiếm trên Google Search thật) cho `GeminiProvider`.
  - `[KAN-107]` Xây dựng tính năng **tự động quét sự kiện theo lịch** (`LocalEventAutoScanService`): admin chọn khoảng ngày hoặc cron chạy hàng tuần, AI tự tìm sự kiện thật quanh khách sạn, chống trùng lặp, lưu đầy đủ "nguồn trích dẫn" để admin kiểm chứng — kết quả luôn ở trạng thái chờ duyệt, không tự động hiển thị cho khách.
  - `[KAN-108]` Xây dựng tính năng **trích xuất và quản lý Địa điểm tham quan (LocalPlace)** — nguồn dữ liệu riêng biệt với Google Places: AI đọc link/text do admin cung cấp, đề xuất địa điểm, admin xác nhận địa chỉ qua Vietmap Autocomplete rồi mới duyệt; trợ lý AI dùng song song 2 nguồn (Google Places + địa điểm khách sạn tự giới thiệu) và trình bày tách biệt rõ ràng cho khách.

## Giai đoạn 6 — Rà soát tối ưu & tính năng tóm tắt đánh giá bằng AI (02/10/2026)

- Rà soát lại toàn bộ code mới (tính năng sự kiện/địa điểm tự động), phát hiện và sửa:
  - Lỗi logic: hệ thống báo "quét thành công" nhầm ngay cả khi gặp lỗi thật sự (lỗi lưu dữ liệu, lỗi gọi AI) — sửa lại để phân biệt rõ "quét xong nhưng không có gì" với "quét bị lỗi thật".
  - Gộp các đoạn code trùng lặp (cơ chế thử lại khi gọi AI, cơ chế gợi ý địa chỉ debounce) thành phần dùng chung.
  - Tối ưu truy vấn chống trùng lặp sự kiện, tránh quét toàn bộ bảng dữ liệu không cần thiết.
- **`feat`: AI tóm tắt đánh giá khách hàng (ver.1)** — tính năng mới cho trang chi tiết phòng:
  - AI (Gemini) tự động tổng hợp nhiều đánh giá của cùng 1 loại phòng thành các ý "khách khen" / "khách chê" ngắn gọn kèm 1 câu nhận xét tổng quan, hiển thị ngay trên trang chi tiết phòng cho khách xem.
  - Có cơ chế cache thông minh: chỉ gọi lại AI khi có đánh giá mới, không tính lại mỗi lần tải trang; nếu AI lỗi tạm thời vẫn giữ bản tóm tắt cũ thay vì làm mất thông tin.
  - Dưới 3 đánh giá thì không hiển thị khối tóm tắt (tránh AI "tổng hợp" từ dữ liệu quá ít, không có ý nghĩa thống kê).

---

## Thống kê kỹ thuật (tính đến 02/10/2026)

- Backend: **159 unit test** đang pass (tsc + eslint sạch).
- Có kiểm thử trực tiếp với Gemini API thật cho các tính năng AI mới (không chỉ test giả lập).
- Các migration DB đã áp dụng đầy đủ lên môi trường dev.

## Định hướng tiếp theo

- Theo dõi tính năng tóm tắt đánh giá sau khi có thêm dữ liệu đánh giá thật.
- Cân nhắc bổ sung thêm các gợi ý nghiệp vụ AI khác cho dashboard/khuyến mãi (đang trong giai đoạn đề xuất, chưa triển khai).
