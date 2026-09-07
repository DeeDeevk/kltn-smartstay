import formatCurrency from './formatCurrency';
import formatDate from './formatDate';
import getBookingCode from './bookingCode';

// Nội dung text mã hoá trong QR vé đặt phòng — hàm thuần (không React), dễ unit test độc
// lập. Dùng chung được cho cả vé lúc đặt thành công lẫn vé xem lại trong lịch sử đặt phòng,
// miễn `booking` có đủ field từ response toDetailResponse() của BE (bookingId, guestInfo,
// roomType, checkInDate, checkOutDate, totalAmount).
export default function buildBookingQrTicket(booking, language = 'vi') {
  return [
    'VIKA HOTEL - BOOKING TICKET',
    `Ma: ${getBookingCode(booking.bookingId)}`,
    `Khach: ${booking.guestInfo?.fullName ?? ''}`,
    `Phong: ${booking.roomType?.name ?? ''}`,
    `Thoi gian: ${formatDate(booking.checkInDate, language)} -> ${formatDate(booking.checkOutDate, language)}`,
    `Tong tien: ${formatCurrency(booking.totalAmount, language)}`,
  ].join('\n');
}
