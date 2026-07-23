import React from 'react';
import {
  X,
  CheckCircle2,
  Calendar,
  User,
  Phone,
  DoorOpen,
  Coffee,
  ArrowRight,
  Info
} from 'lucide-react';
import dayjs from 'dayjs';

const QRScanResultModal = ({ isOpen, onClose, booking }) => {
  if (!isOpen || !booking) return null;

  const formatDate = (date) => dayjs(date).format('DD/MM/YYYY');

  // Lấy danh sách các phòng đã gán
  const allocatedRooms = booking.bookingRooms?.filter(br => br.allocation?.room)
    .map(br => ({
      roomNumber: br.allocation.room.room_number,
      roomType: br.allocation.room.roomType?.name || 'Phòng tiêu chuẩn'
    })) || [];

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4  bg-black/50 animate-in fade-in duration-300">
      <div className="bg-white rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col relative animate-in zoom-in-95 duration-300">

        {/* Header - Gradient & Success Message */}
        <div className="bg-gradient-to-r from-indigo-600 to-blue-500 p-8 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X size={24} />
          </button>

          <div className="flex flex-col items-center text-center gap-3">
            <div className="bg-white/20 p-3 rounded-full backdrop-blur-md">
              <CheckCircle2 size={40} className="text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Xác nhận đặt phòng</h2>
              <p className="text-white/80 font-medium">Mã booking: {booking.booking_code}</p>
            </div>
          </div>
        </div>

        {/* content Area */}
        <div className="p-8 bg-gray-50/50 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Guest Info Card */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4">
              <div className="flex items-center gap-2 text-indigo-600 font-bold border-b border-gray-50 pb-3">
                <User size={18} />
                <span>Thông tin khách hàng</span>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Họ tên:</span>
                  <span className="font-semibold text-gray-900">{booking.user?.name || booking.guest_name}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-500">Số điện thoại:</span>
                  <div className="flex items-center gap-1.5 font-semibold text-gray-900">
                    <Phone size={14} className="text-gray-400" />
                    <span>{booking.user?.phone_number || booking.guest_phone}</span>
                  </div>
                </div>
                <div className="mt-2 py-1 px-3 bg-indigo-50 text-indigo-700 rounded-full text-xs font-bold inline-block uppercase tracking-wider">
                  {booking.status}
                </div>
              </div>
            </div>

            {/* Schedule Card */}
            <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col gap-4">
              <div className="flex items-center gap-2 text-indigo-600 font-bold border-b border-gray-50 pb-3">
                <Calendar size={18} />
                <span>Thời gian lưu trú</span>
              </div>
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase text-gray-400 font-bold">Nhận phòng</span>
                  <span className="text-sm font-bold text-gray-900">{formatDate(booking.check_in_date)}</span>
                </div>
                <div className="flex-1 flex items-center justify-center">
                  <div className="h-[1px] flex-1 bg-gray-200 relative">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2">
                      <ArrowRight size={14} className="text-gray-300" />
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1 text-right">
                  <span className="text-[10px] uppercase text-gray-400 font-bold">Trả phòng</span>
                  <span className="text-sm font-bold text-gray-900">{formatDate(booking.check_out_date)}</span>
                </div>
              </div>
            </div>

            {/* Room Allocation Card */}
            <div className="md:col-span-2 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-2 text-indigo-600 font-bold border-b border-gray-50 pb-3 mb-4">
                <DoorOpen size={18} />
                <span>Thông tin phòng đã gán</span>
              </div>

              {allocatedRooms.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {allocatedRooms.map((room, idx) => (
                    <div key={idx} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl border border-gray-100">
                      <div className="h-10 w-10 bg-indigo-600 text-white flex items-center justify-center rounded-lg font-bold">
                        {room.roomNumber}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-500">{room.roomType}</span>
                        <span className="text-sm font-bold">Phòng đang sẵn sàng</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 bg-yellow-50 rounded-xl border border-yellow-100 text-yellow-700">
                  <Info size={18} />
                  <p className="text-sm font-medium">Booking này chưa được gán phòng cụ thể. Vui lòng thực hiện gán phòng trước khi check-in.</p>
                </div>
              )}
            </div>

            {/* Services Card */}
            {booking.serviceOrders?.length > 0 && (
              <div className="md:col-span-2 bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center gap-2 text-indigo-600 font-bold border-b border-gray-50 pb-3 mb-4">
                  <Coffee size={18} />
                  <span>Dịch vụ đi kèm</span>
                </div>
                <div className="space-y-2">
                  {booking.serviceOrders.map((order, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2 px-3 hover:bg-gray-50 transition-colors rounded-lg border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-900">{order.service?.name || order.service_name_snapshot}</span>
                        <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] font-bold">x{order.quantity}</span>
                      </div>
                      <span className="text-sm font-bold text-gray-700">
                        {((order.unit_price || 0) * (order.quantity || 0)).toLocaleString('vi-VN')} VND
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions Footer */}
        <div className="p-6 bg-white border-t border-gray-100 flex gap-4">
          <button
            onClick={onClose}
            className="flex-1 py-3 px-6 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-all"
          >
            Đóng
          </button>
          {/* <button
            className="flex-[2] py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
          >
            Xác nhận Check-in
          </button> */}
        </div>
      </div>
    </div>
  );
};

export default QRScanResultModal;
