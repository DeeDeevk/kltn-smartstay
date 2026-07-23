import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // 1. Thêm import này
import bookingAPI from '../../../services/booking';

const BookingDetailModal = ({ isOpen, onClose, booking, onCheckIn, onCheckOut, room_number }) => {
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate(); // 2. Khởi tạo navigate

  if (!isOpen || !booking) return null;
  console.log('Room number in Modal:', room_number);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const checkInDate = new Date(booking.check_in_date || booking.check_in);
  checkInDate.setHours(0, 0, 0, 0);

  const isBeforeCheckInDate = today < checkInDate;
  const canCheckIn = booking.status !== 'CHECKED_IN' && booking.status !== 'EXPIRED';
  const canCheckOut = booking.status === 'CHECKED_IN';

  const formatDate = (dateString) => {
    if (!dateString) return 'Chưa có thông tin';
    return new Date(dateString).toLocaleDateString('vi-VN');
  };

  const handleCheckInAction = async () => {
    try {
      setIsLoading(true);
      await bookingAPI.updateRoomStatus(booking.booking_id, 'CHECKED_IN', booking.allocation_id);

      alert('Nhận phòng thành công!');
      if (onCheckIn) onCheckIn();
      onClose();
    } catch (error) {
      alert('Lỗi khi nhận phòng: ' + (error.message || 'Vui lòng thử lại'));
    } finally {
      setIsLoading(false);
    }
  };

  // 3. THAY ĐỔI HÀM NÀY: Chuyển sang trang checkout và truyền dữ liệu
  const handleGoToCheckout = () => {
    onClose(); // Đóng modal
    // Chuyển hướng đến route /checkout và đính kèm dữ liệu booking vào state
    navigate('/admin/checkout', { state: { bookingData: booking, room_number: room_number } }); // Truyền room_number nếu cần
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        {/* Header */}
        <div style={styles.header}>
          <h2 style={{ margin: 0 }}>Chi tiết đặt phòng</h2>
          <button onClick={onClose} style={styles.closeBtn} disabled={isLoading}>&times;</button>
        </div>

        {/* Body hiển thị Data */}
        <div style={styles.body}>
          <div style={styles.grid}>
            <div>
              <p style={styles.label}>Mã đặt phòng</p>
              <p style={styles.value}>{booking.booking_code}</p>
            </div>
            <div>
              <p style={styles.label}>Khách hàng</p>
              <p style={styles.value}>{booking.guest_name}</p>
            </div>
            <div>
              <p style={styles.label}>Số điện thoại</p>
              <p style={styles.value}>{booking.guest_phone}</p>
            </div>
            <div>
              <p style={styles.label}>Email</p>
              <p style={styles.value}>{booking.guest_email || 'Chưa cập nhật'}</p>
            </div>
            <div>
              <p style={styles.label}>Thời gian lưu trú</p>
              <p style={styles.value}>
                {formatDate(booking.check_in)} ➔ {formatDate(booking.check_out)}
              </p>
            </div>
            <div>
              <p style={styles.label}>Trạng thái đơn</p>
              <span style={styles.tag}>{booking.status}</span>
            </div>
            <div>
              <p style={styles.label}>Thanh toán</p>
              <span style={{ ...styles.tag, backgroundColor: booking.payment_status === 'unpaid' ? '#fee2e2' : '#dcfce3', color: booking.payment_status === 'unpaid' ? '#991b1b' : '#166534' }}>
                {booking.payment_status === 'unpaid' ? 'Chưa thanh toán' : 'Đã thanh toán'}
              </span>
            </div>
            <div>
              <p style={styles.label}>Ghi chú</p>
              <p style={styles.value}>{booking.note || 'Không có ghi chú'}</p>
            </div>
          </div>
        </div>

        {/* Footer chứa nút Action */}
        <div style={styles.footer}>
          <button onClick={onClose} style={styles.btnDefault} disabled={isLoading}>Đóng</button>

          {/* 4. Đổi onClick gọi handleGoToCheckout */}
          <button
            onClick={handleGoToCheckout}
            // disabled={!canCheckOut || isLoading}
            style={{ ...styles.btnAction, opacity: (!canCheckOut || isLoading) ? 0.5 : 1, backgroundColor: '#ef4444', color: '#fff' }}
          >
            Làm thủ tục trả phòng
          </button>

          <button
            onClick={handleCheckInAction}
            disabled={!canCheckIn || isBeforeCheckInDate || isLoading}
            title={isBeforeCheckInDate ? "Chưa đến ngày nhận phòng" : ""}
            style={{ ...styles.btnAction, opacity: (!canCheckIn || isBeforeCheckInDate || isLoading) ? 0.5 : 1, backgroundColor: '#22c55e', color: '#fff' }}
          >
            {isLoading ? 'Đang xử lý...' : (isBeforeCheckInDate ? 'Chưa đến ngày Check-in' : 'Nhận phòng')}
          </button>
        </div>
      </div>
    </div>
  );
};

// CSS Inline (Giữ nguyên)
const styles = {
  overlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { backgroundColor: '#fff', borderRadius: '8px', width: '600px', maxWidth: '90%', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' },
  header: { padding: '16px', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  closeBtn: { background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' },
  body: { padding: '24px' },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' },
  label: { fontSize: '12px', color: '#6b7280', margin: '0 0 4px 0' },
  value: { fontSize: '14px', fontWeight: '500', margin: 0 },
  tag: { padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 'bold', backgroundColor: '#e5e7eb', color: '#374151', display: 'inline-block' },
  footer: { padding: '16px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end', gap: '8px' },
  btnDefault: { padding: '8px 16px', border: '1px solid #ccc', borderRadius: '4px', background: '#fff', cursor: 'pointer' },
  btnAction: { padding: '8px 16px', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s' }
};

export default BookingDetailModal;