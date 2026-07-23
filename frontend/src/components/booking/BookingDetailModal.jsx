import { X, Calendar, User as UserIcon, Receipt, PlusCircle, QrCode } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { BookingStatus, PaymentStatus } from '../../constants/Enums';

// Component hiển thị Trạng thái (Badge)
export const StatusBadge = ({ status }) => {
  const styles = {
    COMPLETED: {
      bg: 'bg-green-100',
      text: 'text-green-700',
      label: 'Hoàn thành'
    },

    CONFIRMED: {
      bg: 'bg-blue-100',
      text: 'text-blue-700',
      label: 'Đã xác nhận'
    },

    CANCELLED: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      label: 'Đã hủy'
    },

    EXPIRED: {
      bg: 'bg-red-100',
      text: 'text-red-700',
      label: 'Hết hạn'
    },

    PENDING: {
      bg: 'bg-yellow-100',
      text: 'text-yellow-700',
      label: 'Chờ thanh toán'
    },

    CHECKED_IN: {
      bg: 'bg-indigo-100',
      text: 'text-indigo-700',
      label: 'Đã nhận phòng'
    },
  };

  const normalizedStatus = String(status).toUpperCase();


  const style = styles[normalizedStatus] || styles.PENDING;

  return (
    <span
      className={`${style.bg} ${style.text} px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap`}
    >
      {style.label}
    </span>
  );
};

const BookingDetailModal = ({ booking, onClose, formatCurrency }) => {
  if (!booking) return null;

  // Helper to generate text for QR code
  const generateBookingQRString = () => {
    const roomName = booking.bookingDetails?.[0]?.roomType?.name || 'Phòng nghỉ';
    const checkIn = new Date(booking.check_in_date).toLocaleDateString('vi-VN');
    const checkOut = new Date(booking.check_out_date).toLocaleDateString('vi-VN');

    let servicesText = "";
    if (booking.serviceOrders && booking.serviceOrders.length > 0) {
      servicesText = "\nDịch vụ: " + booking.serviceOrders.map(s => `${s.service_name_snapshot} (x${s.quantity})`).join(", ");
    }

    return `VIKA HOTEL - BOOKING TICKET
---------------------------
Mã: ${booking.booking_code}
Khách: ${booking.guest_name}
Phòng: ${roomName}
Thời gian: ${checkIn} -> ${checkOut}${servicesText}
Tổng tiền: ${formatCurrency(booking.total_price)}
---------------------------
Cảm ơn quý khách!`;
  };

  const qrString = generateBookingQRString();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 ">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col">
        {/* Modal Header */}
        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Chi tiết đặt phòng</h2>
              <p className="text-xs text-gray-500 mt-1">Mã đặt: <span className="font-mono font-bold text-blue-600">{booking.booking_code}</span></p>
            </div>


          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-8">
          {/* Status and Room Info */}
          <div className="flex flex-col md:flex-row gap-6">
            <div className="w-full md:w-1/3 aspect-video md:aspect-square bg-gray-100 rounded-xl overflow-hidden shrink-0 shadow-inner">
              <img
                src={booking.bookingDetails?.[0]?.roomType?.images?.[0]?.url || 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=2070&auto=format&fit=crop'}
                alt="Room"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{booking.bookingDetails?.[0]?.roomType?.name || 'Phòng nghỉ'}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <StatusBadge status={booking.status} />
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${booking.payment_status === PaymentStatus.PAID ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                      {booking.payment_status === PaymentStatus.PAID ? 'Đã thanh toán' : 'Chưa thanh toán'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <Calendar size={10} /> Nhận phòng
                  </p>
                  <p className="text-sm font-semibold text-gray-700">{new Date(booking.check_in_date).toLocaleDateString('vi-VN')}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                    <Calendar size={10} /> Trả phòng
                  </p>
                  <p className="text-sm font-semibold text-gray-700">{new Date(booking.check_out_date).toLocaleDateString('vi-VN')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Guest Information */}
          <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1">
              <UserIcon size={12} /> Thông tin khách hàng
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-6">
              <div>
                <p className="text-[11px] text-gray-500">Người nhận phòng</p>
                <p className="text-sm font-bold text-gray-800">{booking.guest_name}</p>
              </div>
              <div>
                <p className="text-[11px] text-gray-500">Số điện thoại</p>
                <p className="text-sm font-bold text-gray-800">{booking.guest_phone}</p>
              </div>
              <div className="sm:col-span-2">
                <p className="text-[11px] text-gray-500">Email liên hệ</p>
                <p className="text-sm font-bold text-gray-800">{booking.guest_email}</p>
              </div>
              {booking.note && (
                <div className="sm:col-span-2 pt-2 border-t border-gray-200/50">
                  <p className="text-[11px] text-gray-500">Ghi chú</p>
                  <p className="text-xs text-gray-600 italic leading-relaxed">{booking.note}</p>
                </div>
              )}
            </div>
          </div>

          {/* Extra Services */}
          <div>
            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-1">
              <PlusCircle size={12} /> Dịch vụ bổ sung
            </h4>
            {booking.serviceOrders && booking.serviceOrders.length > 0 ? (
              <div className="border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse bg-white">
                  <thead>
                    <tr className="bg-gray-50 text-[10px] uppercase font-bold text-gray-400 border-b border-gray-100">
                      <th className="px-4 py-2">Dịch vụ</th>
                      <th className="px-4 py-2 text-center">SL</th>
                      <th className="px-4 py-2 text-right">Đơn giá</th>
                      <th className="px-4 py-2 text-right">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50 text-xs">
                    {booking.serviceOrders.map((svc) => (
                      <tr key={svc.id}>
                        <td className="px-4 py-3 font-medium text-gray-700">{svc.service_name_snapshot}</td>
                        <td className="px-4 py-3 text-center text-gray-600">{svc.quantity}</td>
                        <td className="px-4 py-3 text-right text-gray-500">{formatCurrency(svc.unit_price)}</td>
                        <td className="px-4 py-3 text-right font-bold text-gray-800">{formatCurrency(svc.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-6 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <p className="text-sm text-gray-400">Không có dịch vụ bổ sung nào.</p>
              </div>
            )}
          </div>

          <div className="w-full flex justify-center">
            <QRCodeSVG
              value={qrString}
              size={200}
              level="M"
              includeMargin={false}
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-100 mt-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-400">
              <Receipt size={18} />
              <span className="text-sm font-medium">Tổng tiền</span>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-blue-600 font-poppins">{formatCurrency(booking.total_price)}</p>
              <p className="text-[10px] text-gray-500 mt-1 italic font-medium">Đã bao gồm VAT và phí dịch vụ</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BookingDetailModal;
