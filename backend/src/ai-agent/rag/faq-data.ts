// Static FAQ dataset backing the lightweight RAG search used by the get_policy tool.
// Split into short, single-topic entries rather than the original 4 long paragraphs
// (see policy.constants.ts, now removed) — embedding models retrieve short, focused
// passages more reliably than long multi-topic ones, and having "check-in time" and
// "late checkout fee" as separate entries lets a query about only one of them match
// without dragging in unrelated text. Wording is kept identical to the original
// content; only the grouping changed.
export interface FaqEntry {
  id: string;
  question: string;
  content: string;
}

export const FAQ_DATA: FaqEntry[] = [
  {
    id: 'cancellation-before-checkin',
    question: 'Huỷ phòng có mất phí không?',
    content:
      'Quý khách có thể huỷ đặt phòng miễn phí bất kỳ lúc nào trước khi nhận phòng, ' +
      'khi đơn đang ở trạng thái "Chờ xác nhận" hoặc "Đã xác nhận". Sau khi đã nhận phòng ' +
      '(check-in), đơn không thể huỷ qua hệ thống, quý khách vui lòng liên hệ trực tiếp ' +
      'lễ tân để được hỗ trợ.',
  },
  {
    id: 'check-in-time',
    question: 'Giờ nhận phòng (check-in) là mấy giờ?',
    content: 'Giờ nhận phòng (check-in) tiêu chuẩn là từ 14:00.',
  },
  {
    id: 'late-checkout-fee',
    question: 'Trả phòng trễ có bị tính phí không?',
    content:
      'Giờ trả phòng (check-out) tiêu chuẩn là trước 12:00 trưa. Nếu trả phòng sau ' +
      '12:00 trưa, mỗi 24 giờ trễ sẽ tính thêm phụ thu 1 đêm theo đơn giá của loại phòng ' +
      'đang thuê.',
  },
  {
    id: 'payment-methods',
    question: 'Khách sạn hỗ trợ những hình thức thanh toán nào?',
    content:
      'Khách sạn hỗ trợ thanh toán bằng tiền mặt tại quầy lễ tân hoặc chuyển khoản qua ' +
      'PayOS. Giá phòng hiển thị đã bao gồm thuế giá trị gia tăng (VAT) 8%, áp dụng trên ' +
      'tiền phòng, không áp dụng cho các dịch vụ đi kèm.',
  },
  {
    id: 'promotion-usage',
    question: 'Làm sao để biết khách sạn đang có khuyến mãi gì?',
    content:
      'Khuyến mãi đang áp dụng có thể tra cứu qua công cụ get_promotions. Mỗi mã ' +
      'khuyến mãi chỉ áp dụng được khi đặt phòng nếu còn hiệu lực (trong thời gian áp ' +
      'dụng và chưa đạt giới hạn số lượt sử dụng).',
  },
];
