// Không có bảng "policies" trong DB — hard-code nội dung chính sách cho MVP đồ án.
// Chính sách huỷ phòng và giờ trả phòng trễ được viết khớp với logic thật trong
// BookingService (cancel(), computeLateCheckout()); chính sách giờ nhận phòng và
// thanh toán là quy ước nghiệp vụ chung, hiện chưa được enforce bằng code.
export const POLICY_TOPICS = [
  'cancellation',
  'check_in_out',
  'payment',
  'promotion',
] as const;

export type PolicyTopic = (typeof POLICY_TOPICS)[number];

export const POLICY_CONTENT: Record<PolicyTopic, string> = {
  cancellation:
    'Quý khách có thể huỷ đặt phòng miễn phí bất kỳ lúc nào trước khi nhận phòng, ' +
    'khi đơn đang ở trạng thái "Chờ xác nhận" hoặc "Đã xác nhận". Sau khi đã nhận phòng ' +
    '(check-in), đơn không thể huỷ qua hệ thống, quý khách vui lòng liên hệ trực tiếp ' +
    'lễ tân để được hỗ trợ.',
  check_in_out:
    'Giờ nhận phòng (check-in) tiêu chuẩn là từ 14:00, giờ trả phòng (check-out) tiêu ' +
    'chuẩn là trước 12:00 trưa. Nếu trả phòng sau 12:00 trưa, mỗi 24 giờ trễ sẽ tính ' +
    'thêm phụ thu 1 đêm theo đơn giá của loại phòng đang thuê.',
  payment:
    'Khách sạn hỗ trợ thanh toán bằng tiền mặt tại quầy lễ tân hoặc chuyển khoản qua ' +
    'PayOS. Giá phòng hiển thị đã bao gồm thuế giá trị gia tăng (VAT) 8%, áp dụng trên ' +
    'tiền phòng, không áp dụng cho các dịch vụ đi kèm.',
  promotion:
    'Khuyến mãi đang áp dụng có thể tra cứu qua công cụ get_promotions. Mỗi mã khuyến ' +
    'mãi chỉ áp dụng được khi đặt phòng nếu còn hiệu lực (trong thời gian áp dụng và ' +
    'chưa đạt giới hạn số lượt sử dụng).',
};

export function getPolicyContent(topic: string): string {
  if ((POLICY_TOPICS as readonly string[]).includes(topic)) {
    return POLICY_CONTENT[topic as PolicyTopic];
  }
  return (
    `Không tìm thấy chính sách cho chủ đề "${topic}". ` +
    `Các chủ đề hiện có: ${POLICY_TOPICS.join(', ')}.`
  );
}
