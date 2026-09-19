import { LlmTool } from '../llm/llm-provider.interface';

// Định nghĩa các tool mà model được phép gọi. So với đặc tả gốc (5 tool), có thêm
// propose_booking: đây là bước bắt buộc agent phải đi qua trước create_booking —
// server tính giá cuối cùng (đã áp khuyến mãi) và lưu lại thành "pendingBooking"
// gắn với cuộc hội thoại. create_booking chỉ thực thi khi có đúng 1 pendingBooking
// đang chờ, được đề xuất ở một lượt trước đó, và tin nhắn mới nhất của khách là một
// lời đồng ý rõ ràng — đây là cách hiện thực guardrail "phải tóm tắt & chờ khách xác
// nhận ở lượt kế tiếp" một cách chắc chắn bằng code, thay vì chỉ dựa vào việc model
// tự giác làm đúng theo system prompt.
export const AI_AGENT_TOOLS: LlmTool[] = [
  {
    name: 'search_rooms',
    description:
      'Tìm các loại phòng còn trống trong một khoảng ngày cho số lượng khách nhất định. Trả về danh sách loại phòng kèm giá, sức chứa và số phòng còn trống.',
    parameters: {
      type: 'object',
      properties: {
        checkIn: {
          type: 'string',
          description: 'Ngày nhận phòng, định dạng YYYY-MM-DD',
        },
        checkOut: {
          type: 'string',
          description: 'Ngày trả phòng, định dạng YYYY-MM-DD',
        },
        guests: {
          type: 'integer',
          description: 'Số lượng khách sẽ lưu trú',
        },
        roomTypeName: {
          type: 'string',
          description:
            'Tên hoặc mô tả loại phòng khách muốn lọc, giữ nguyên cách khách nói (VD "phòng tiêu chuẩn", "deluxe hướng biển") — server tự quy đổi sang tên tiếng Anh. Nếu kết quả rỗng, KHÔNG gọi lại mà bỏ bộ lọc; hãy báo khách không có loại phòng đó trống và hỏi khách có muốn xem các phòng khác không (không bắt buộc).',
        },
        maxPrice: {
          type: 'integer',
          description:
            'Mức giá tối đa (VNĐ/đêm) khách chấp nhận, nếu khách có nêu ngân sách (VD "dưới 2 triệu") — PHẢI truyền vào đây để lọc đúng, không được tự lọc bằng lời rồi vẫn để nguyên toàn bộ kết quả (không bắt buộc).',
        },
        minPrice: {
          type: 'integer',
          description:
            'Mức giá tối thiểu (VNĐ/đêm) nếu khách có nêu, ví dụ "trên 1 triệu" (không bắt buộc).',
        },
      },
      required: ['checkIn', 'checkOut', 'guests'],
    },
  },
  {
    name: 'check_availability',
    description:
      'Kiểm tra một loại phòng cụ thể (theo roomTypeId đã biết từ search_rooms) còn trống hay không trong khoảng ngày cho trước.',
    parameters: {
      type: 'object',
      properties: {
        roomTypeId: { type: 'string', description: 'ID loại phòng' },
        checkIn: { type: 'string', description: 'Ngày nhận phòng YYYY-MM-DD' },
        checkOut: { type: 'string', description: 'Ngày trả phòng YYYY-MM-DD' },
      },
      required: ['roomTypeId', 'checkIn', 'checkOut'],
    },
  },
  {
    name: 'get_promotions',
    description: 'Lấy danh sách khuyến mãi đang áp dụng tại khách sạn.',
    parameters: { type: 'object', properties: {} },
  },
  {
    // Semantic search (lightweight RAG) over the hotel's FAQ/policy knowledge base —
    // there is no fixed topic list to pick from, "query" is the guest's own question
    // or intent, matched against indexed FAQ entries by embedding similarity.
    name: 'get_policy',
    description:
      'Semantic search over the hotel\'s FAQ/policy knowledge base (cancellation, check-in/check-out time, late-checkout fee, payment methods, promotions, ...). Pass the guest\'s question or intent as free text in their own words — do NOT try to map it to a fixed keyword, just describe what they actually want to know (e.g. "trả phòng trễ có bị tính phí không").',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description:
            "The guest's question or intent, in their own words, used for semantic search over the FAQ knowledge base.",
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'request_booking_form',
    description:
      'Gọi tool này khi cần khách cung cấp các trường thông tin để đặt phòng (ngày nhận phòng, ngày trả phòng, số khách, họ tên, số điện thoại, email) — hệ thống sẽ hiển thị cho khách một biểu mẫu để điền trực tiếp thay vì phải hỏi từng trường bằng văn bản. Truyền kèm các giá trị đã biết (nếu có) để biểu mẫu điền sẵn. Sau khi gọi tool này, chỉ trả lời một câu ngắn gọn mời khách điền biểu mẫu, KHÔNG liệt kê lại các trường cần điền bằng văn bản.',
    parameters: {
      type: 'object',
      properties: {
        roomTypeId: {
          type: 'string',
          description: 'ID loại phòng khách đang chọn, nếu đã biết',
        },
        roomTypeName: {
          type: 'string',
          description: 'Tên loại phòng khách đang chọn, nếu đã biết',
        },
        checkIn: {
          type: 'string',
          description: 'Ngày nhận phòng đã biết, YYYY-MM-DD (nếu có)',
        },
        checkOut: {
          type: 'string',
          description: 'Ngày trả phòng đã biết, YYYY-MM-DD (nếu có)',
        },
        guests: {
          type: 'integer',
          description: 'Số khách đã biết, nếu có',
        },
      },
      required: [],
    },
  },
  {
    name: 'propose_booking',
    description:
      'Tính toán và tóm tắt một đề xuất đặt phòng (giá phòng, khuyến mãi nếu có, thuế, tổng tiền) để trình bày cho khách xác nhận. PHẢI gọi tool này trước create_booking, và phải trình bày đầy đủ bản tóm tắt trả về cho khách rồi chờ khách đồng ý ở lượt sau — không được tự suy ra giá hay gọi create_booking ngay trong cùng lượt này.',
    parameters: {
      type: 'object',
      properties: {
        roomTypeId: { type: 'string', description: 'ID loại phòng khách chọn' },
        checkIn: { type: 'string', description: 'Ngày nhận phòng YYYY-MM-DD' },
        checkOut: { type: 'string', description: 'Ngày trả phòng YYYY-MM-DD' },
        guestFullName: {
          type: 'string',
          description: 'Họ tên khách đặt phòng',
        },
        guestPhone: { type: 'string', description: 'Số điện thoại khách' },
        guestEmail: {
          type: 'string',
          description: 'Email khách (không bắt buộc)',
        },
        paymentMethod: {
          type: 'string',
          description:
            'Phương thức thanh toán khách đã chọn — PHẢI hỏi khách rõ ràng trước khi gọi tool này, không được tự suy đoán hay mặc định.',
          enum: ['CASH', 'PAYOS'],
        },
        promotionCode: {
          type: 'string',
          description: 'Mã khuyến mãi khách muốn áp dụng (không bắt buộc)',
        },
        extraServiceIds: {
          type: 'array',
          description:
            'Danh sách ID dịch vụ đi kèm khách muốn thêm (không bắt buộc)',
          items: { type: 'string' },
        },
      },
      required: [
        'roomTypeId',
        'checkIn',
        'checkOut',
        'guestFullName',
        'guestPhone',
        'paymentMethod',
      ],
    },
  },
  {
    name: 'create_booking',
    description:
      'Tạo booking thật trong hệ thống dựa trên đề xuất đã propose_booking và đã được khách xác nhận đồng ý ở lượt hội thoại kế tiếp. Không cần truyền tham số — server dùng lại đúng thông tin đã tóm tắt cho khách trước đó. Nếu khách chưa xác nhận, tool sẽ báo lỗi và không tạo booking.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'get_nearby_places',
    description:
      'Tìm các địa điểm ăn uống/vui chơi/tham quan/mua sắm gần khách sạn theo danh mục, lấy từ Google Places (tên, địa chỉ, đánh giá, link Google Maps). Dùng khi khách hỏi có gì ăn/chơi/tham quan/mua sắm gần đây, quán cà phê gần đây, quán bar/club gần đây, v.v.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Loại địa điểm khách quan tâm',
          enum: [
            'restaurant',
            'tourist_attraction',
            'cafe',
            'shopping_mall',
            'night_club',
          ],
        },
        radius: {
          type: 'integer',
          description:
            'Bán kính tìm kiếm tính bằng mét, không bắt buộc (mặc định 2000m)',
        },
      },
      required: ['category'],
    },
  },
  {
    name: 'get_local_events',
    description:
      'Tra cứu sự kiện/hoạt động địa phương (do khách sạn quản lý) diễn ra vào một ngày cụ thể — lễ hội, chợ đêm, sự kiện định kỳ trong tuần... Dùng khi khách hỏi "có sự kiện gì" hoặc "cuối tuần này có gì chơi" quanh khu vực khách sạn.',
    parameters: {
      type: 'object',
      properties: {
        date: {
          type: 'string',
          description: 'Ngày cần tra cứu sự kiện, định dạng YYYY-MM-DD',
        },
      },
      required: ['date'],
    },
  },
];
