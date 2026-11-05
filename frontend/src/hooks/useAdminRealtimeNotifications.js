import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useSocket } from '../context/SocketContext';
import { bookingApi } from '../services/booking';
import { chatApi } from '../services/chat';
import formatDate from '../utils/formatDate';

// Toast "có đơn mới / đã thanh toán" cho admin/staff, bất kể đang ở trang admin
// nào — chỉ push tạm thời qua socket, không lưu DB (khác module /notifications).
export default function useAdminRealtimeNotifications() {
  const socket = useSocket();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    const refreshBookingList = () =>
      dispatch(bookingApi.util.invalidateTags([{ type: 'Booking', id: 'STAFF_LIST' }]));

    // Bật lại toast cho đơn mới: chuông thông báo đã báo (nhảy số chưa đọc), nhưng toast
    // giúp admin/lễ tân thấy ngay cả khi không mở khu vực chuông — bấm vào mở thẳng trang
    // Đặt phòng thay vì bắt tự tìm trong danh sách.
    const handleBookingCreated = (payload) => {
      const guestLabel = payload?.guestName ? ` của ${payload.guestName}` : '';
      const dateRange =
        payload?.checkIn && payload?.checkOut
          ? `, ${formatDate(payload.checkIn)} → ${formatDate(payload.checkOut)}`
          : '';
      toast.info(`Có đơn mới${guestLabel}${dateRange}`, {
        onClick: () => navigate('/admin/bookings'),
      });
      refreshBookingList();
    };
    const handleBookingPaid = (payload) => {
      toast.success(`Đơn${payload?.guestName ? ` của ${payload.guestName}` : ''} đã thanh toán thành công!`);
      refreshBookingList();
    };
    const handleBookingCancelled = (payload) => {
      toast.warn(`Đơn${payload?.guestName ? ` của ${payload.guestName}` : ''} đã bị huỷ`);
      refreshBookingList();
    };
    // Tin nhắn của khách không bật toast — chỉ làm mới danh sách hội thoại để số chưa đọc
    // (trang chat + mục "Chat với khách" ở Sidebar) tự nhảy, như các ứng dụng nhắn tin.
    const handleConversationUpdated = () => {
      dispatch(chatApi.util.invalidateTags([{ type: 'Conversation', id: 'LIST' }]));
    };

    socket.on('booking:created', handleBookingCreated);
    socket.on('booking:paid', handleBookingPaid);
    socket.on('booking:cancelled', handleBookingCancelled);
    socket.on('chat:conversation-updated', handleConversationUpdated);
    return () => {
      socket.off('booking:created', handleBookingCreated);
      socket.off('booking:paid', handleBookingPaid);
      socket.off('booking:cancelled', handleBookingCancelled);
      socket.off('chat:conversation-updated', handleConversationUpdated);
    };
  }, [socket, dispatch, navigate]);
}
