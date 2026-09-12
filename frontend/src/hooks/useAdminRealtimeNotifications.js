import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { toast } from 'react-toastify';
import { useSocket } from '../context/SocketContext';
import { bookingApi } from '../services/booking';

// Toast "có đơn mới / đã thanh toán" cho admin/staff, bất kể đang ở trang admin
// nào — chỉ push tạm thời qua socket, không lưu DB (khác module /notifications).
export default function useAdminRealtimeNotifications() {
  const socket = useSocket();
  const dispatch = useDispatch();

  useEffect(() => {
    const refreshBookingList = () =>
      dispatch(bookingApi.util.invalidateTags([{ type: 'Booking', id: 'STAFF_LIST' }]));

    const handleBookingCreated = (payload) => {
      toast.info(`Có đơn đặt phòng mới${payload?.guestName ? ` từ ${payload.guestName}` : ''}!`);
      refreshBookingList();
    };
    const handleBookingPaid = (payload) => {
      toast.success(`Đơn${payload?.guestName ? ` của ${payload.guestName}` : ''} đã thanh toán thành công!`);
      refreshBookingList();
    };
    const handleNewConversation = (payload) => {
      toast.info(`${payload?.customerName || 'Khách hàng'} vừa gửi tin nhắn chờ hỗ trợ`);
    };

    socket.on('booking:created', handleBookingCreated);
    socket.on('booking:paid', handleBookingPaid);
    socket.on('chat:new-conversation', handleNewConversation);
    return () => {
      socket.off('booking:created', handleBookingCreated);
      socket.off('booking:paid', handleBookingPaid);
      socket.off('chat:new-conversation', handleNewConversation);
    };
  }, [socket, dispatch]);
}
