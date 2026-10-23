import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { useSocket } from '../context/SocketContext';
import { bookingApi } from '../services/booking';
import { chatApi } from '../services/chat';

// Toast "có đơn mới / đã thanh toán" cho admin/staff, bất kể đang ở trang admin
// nào — chỉ push tạm thời qua socket, không lưu DB (khác module /notifications).
export default function useAdminRealtimeNotifications() {
  const socket = useSocket();
  const dispatch = useDispatch();

  useEffect(() => {
    const refreshBookingList = () =>
      dispatch(bookingApi.util.invalidateTags([{ type: 'Booking', id: 'STAFF_LIST' }]));

    // Đơn mới không bật toast nữa — chuông thông báo trên header đã báo (nhảy số chưa
    // đọc). Vẫn làm mới danh sách để trang Đặt phòng đang mở thấy đơn ngay.
    const handleBookingCreated = () => {
      refreshBookingList();
    };
    const handleBookingPaid = (payload) => {
      toast.success(`Đơn${payload?.guestName ? ` của ${payload.guestName}` : ''} đã thanh toán thành công!`);
      refreshBookingList();
    };
    // Tin nhắn của khách không bật toast — chỉ làm mới danh sách hội thoại để số chưa đọc
    // (trang chat + mục "Chat với khách" ở Sidebar) tự nhảy, như các ứng dụng nhắn tin.
    const handleConversationUpdated = () => {
      dispatch(chatApi.util.invalidateTags([{ type: 'Conversation', id: 'LIST' }]));
    };

    socket.on('booking:created', handleBookingCreated);
    socket.on('booking:paid', handleBookingPaid);
    socket.on('chat:conversation-updated', handleConversationUpdated);
    return () => {
      socket.off('booking:created', handleBookingCreated);
      socket.off('booking:paid', handleBookingPaid);
      socket.off('chat:conversation-updated', handleConversationUpdated);
    };
  }, [socket, dispatch]);
}
