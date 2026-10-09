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
  STAFF_NEW_BOOKING: 'bg-blue-500',
  // Thông báo cho admin: đỏ = có tiền/uy tín đang bị ảnh hưởng, vàng = cần kiểm tra.
  ADMIN_CASH_MISMATCH: 'bg-red-500',
  ADMIN_PAID_BOOKING_CANCELLED: 'bg-red-500',
  ADMIN_NEGATIVE_REVIEW: 'bg-red-500',
  ADMIN_SHIFT_ABSENT: 'bg-amber-500',
  ADMIN_SHIFT_AUTO_CLOSED: 'bg-amber-500',
};

// Thông báo nội bộ (nhân viên/admin) -> trang quản lý tương ứng để xử lý ngay.
const ADMIN_TARGETS = {
  STAFF_NEW_BOOKING: '/admin/bookings',
  ADMIN_PAID_BOOKING_CANCELLED: '/admin/bookings',
  ADMIN_NEGATIVE_REVIEW: '/admin/reviews',
  ADMIN_CASH_MISMATCH: '/admin/schedule',
  ADMIN_SHIFT_ABSENT: '/admin/schedule',
  ADMIN_SHIFT_AUTO_CLOSED: '/admin/schedule',
};

// Các loại thông báo nội bộ gắn với đúng 1 đơn đặt phòng.
const BOOKING_DETAIL_TYPES = new Set(['STAFF_NEW_BOOKING', 'ADMIN_PAID_BOOKING_CANCELLED']);

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

// Thông báo tạo trước khi backend định dạng ngày còn lưu chuỗi ISO thô
// ('2026-10-08T00:00:00.000Z') trong nội dung — đổi về 'dd/MM/yyyy' lúc hiển thị.
// Lấy ngày theo UTC (giống formatDay ở backend) để khớp đúng ngày của đơn.
const ISO_DATE_IN_TEXT = /\b(\d{4})-(\d{2})-(\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z\b/g;
export function formatNotificationBody(text) {
  return (text ?? '').replace(ISO_DATE_IN_TEXT, (_, y, m, d) => `${d}/${m}/${y}`);
}

const pad = (n) => String(n).padStart(2, '0');

// Giờ trong ngày, VD "14:29" — đi kèm nhãn nhóm ngày nên không cần lặp lại ngày.
export function formatClock(value) {
  const date = new Date(value);
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// Ngày giờ đầy đủ cho tooltip, VD "08/10/2026 14:29".
export function formatFullDateTime(value) {
  const date = new Date(value);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${formatClock(value)}`;
}

// Nhãn nhóm theo ngày: "Hôm nay", "Hôm qua", hoặc "08/10/2026".
export function dayGroupLabel(value) {
  const date = new Date(value);
  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(new Date()) - startOf(date)) / 86_400_000);
  if (days <= 0) return 'Hôm nay';
  if (days === 1) return 'Hôm qua';
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
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

    // Thông báo gắn với 1 đơn cụ thể -> mở thẳng chi tiết đơn đó trên trang Đặt phòng,
    // không bắt nhân viên tự dò lại trong danh sách.
    if (BOOKING_DETAIL_TYPES.has(item.type) && item.bookingId) {
      navigate(`/admin/bookings?bookingId=${item.bookingId}`);
      return;
    }

    if (ADMIN_TARGETS[item.type]) {
      navigate(ADMIN_TARGETS[item.type]);
      return;
    }

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
