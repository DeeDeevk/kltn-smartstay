// Dùng chung giữa chuông trên header và trang "Thông báo" — để hai nơi luôn hiện
// cùng màu, cùng cách ghi thời gian và bấm vào thì đi cùng một chỗ.

export const TYPE_DOT_CLASSES = {
  BOOKING_CONFIRMED: 'bg-blue-500',
  BOOKING_CANCELLED: 'bg-red-500',
  CHECKED_IN: 'bg-green-500',
  CHECKED_OUT: 'bg-gray-400',
  PAYMENT_PAID: 'bg-green-500',
  PAYMENT_FAILED: 'bg-red-500',
  REVIEW_REPLIED: 'bg-amber-500',
};

// "3 phút trước", "2 giờ trước"... Thông báo mới là thứ khách quan tâm nhất nên hiện
// khoảng cách thời gian dễ đọc hơn là ngày giờ đầy đủ.
export function timeAgo(value) {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Vừa xong';
  if (minutes < 60) return `${minutes} phút trước`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ngày trước`;
  return new Date(value).toLocaleDateString('vi-VN');
}

// Bấm vào một thông báo thì đi đâu. Phản hồi đánh giá -> trang phòng, nơi đánh giá và
// câu trả lời được hiển thị; các loại còn lại xoay quanh đơn -> lịch sử đặt phòng.
export function getNotificationTarget(item) {
  if (item.type === 'REVIEW_REPLIED' && item.roomTypeId) {
    return `/rooms/${item.roomTypeId}`;
  }
  return '/user/historybooking';
}
