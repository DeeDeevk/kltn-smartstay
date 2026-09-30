import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { bookingApi } from '../../services/booking';
import { useMarkNotificationReadMutation } from '../../services/notification';

// Dùng chung giữa chuông trên header và trang "Thông báo" — để hai nơi luôn hiện
// cùng màu, cùng cách ghi thời gian và bấm vào thì đi cùng một chỗ.
// Tên loại khớp enum NotificationType ở backend (notification.service.ts).
export const TYPE_DOT_CLASSES = {
  BOOKING_CREATED: 'bg-blue-400',
  BOOKING_CONFIRMED: 'bg-blue-500',
  BOOKING_CANCELLED: 'bg-red-500',
  BOOKING_CHECKED_IN: 'bg-green-500',
  BOOKING_CHECKED_OUT: 'bg-gray-400',
  PAYMENT_SUCCESS: 'bg-green-500',
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

// Trả về hàm xử lý khi bấm vào một thông báo: đánh dấu đã đọc rồi mở đúng trang.
//
// Phản hồi đánh giá -> trang phòng, nơi đánh giá và câu trả lời được hiển thị. Thông
// báo chỉ lưu bookingId (NotificationModule không phụ thuộc Booking), nên phải tra
// đơn để biết loại phòng. Tra không được thì rơi về lịch sử đặt phòng — vẫn thấy đơn.
// Các loại còn lại xoay quanh đơn -> lịch sử đặt phòng.
export function useOpenNotification(onBeforeNavigate) {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [markRead] = useMarkNotificationReadMutation();

  return async (item) => {
    onBeforeNavigate?.();
    // Đánh dấu đã đọc là việc phụ — lỗi thì vẫn cho khách đi tiếp.
    if (!item.isRead) markRead(item.id);

    if (item.type === 'REVIEW_REPLIED' && item.bookingId) {
      try {
        const booking = await dispatch(
          bookingApi.endpoints.getBookingById.initiate(item.bookingId),
        ).unwrap();
        const roomTypeId = booking?.roomType?.roomTypeId;
        if (roomTypeId) {
          navigate(`/rooms/${roomTypeId}`);
          return;
        }
      } catch {
        // rơi xuống dưới
      }
    }
    navigate('/user/historybooking');
  };
}
