import React, { useEffect, useState } from 'react';
import { X, Wallet, User, Calendar, DollarSign, Clock, FileText } from 'lucide-react';
import shiftAPI from '../../../services/shift';

// Hàm helper để format tiền VND
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(amount));
};

// Hàm helper format ngày giờ
const formatDateTime = (dateString) => {
  if (!dateString) return '---';
  return new Date(dateString).toLocaleString('vi-VN');
};

export default function ShiftDetailModal({ isOpen, onClose, shiftId = 1 }) {
  const [loading, setLoading] = useState(false);
  const [shiftData, setShiftData] = useState(null);
  console.log(shiftData)
  useEffect(() => {
    if (isOpen && shiftId) {
      fetchShiftData();
    }
  }, [isOpen, shiftId]);

  const fetchShiftData = async () => {
    setLoading(true);
    try {
      // Gọi API lấy thông tin ca
      const response = await shiftAPI.getShiftReport(shiftId);

      // Dựa vào cấu trúc JSON bạn đưa: { data: { ... } }
      if (response && response.data) {
        setShiftData(response.data);
      }
    } catch (error) {
      console.error("Lỗi khi tải thông tin ca:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center   bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50">
          <div className="flex items-center gap-3">
            <div className="bg-blue-100 p-2 rounded-lg text-blue-600">
              <Wallet size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-800">Chi tiết Ca làm việc #{shiftId}</h2>
              {shiftData && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${shiftData.shift_info.status === 'open'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-gray-100 text-gray-600'
                  }`}>
                  {shiftData.shift_info.status === 'open' ? 'Đang mở' : 'Đã chốt'}
                </span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition">
            <X size={24} className="text-gray-500" />
          </button>
        </div>

        {/* Body (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          {loading ? (
            <div className="flex justify-center items-center h-40">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : shiftData ? (
            <div className="space-y-6">

              {/* 1. Thông tin chung & Nhân viên */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
                    <User size={16} /> Nhân viên trực
                  </h3>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold">
                      {shiftData.shift_info.staff.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">{shiftData.shift_info.staff.username}</p>
                      <p className="text-xs text-gray-500">{shiftData.shift_info.staff.email}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                  <h3 className="text-sm font-semibold text-gray-500 mb-3 flex items-center gap-2">
                    <Clock size={16} /> Thời gian
                  </h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Bắt đầu:</span>
                      <span className="font-medium">{formatDateTime(shiftData.shift_info.start_time)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Kết thúc:</span>
                      <span className="font-medium">{formatDateTime(shiftData.shift_info.end_time)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Tổng quan tài chính (Quan trọng nhất) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <StatCard
                  label="Tiền trong két khi mở ca"
                  value={shiftData.revenue.start_cash}
                  icon={<DollarSign size={18} />}
                  color="text-gray-600"
                  bgColor="bg-gray-100"
                />
                <StatCard
                  label="Tổng doanh thu hệ thống"
                  value={shiftData.revenue.total_system_revenue}
                  icon={<DollarSign size={18} />}
                  color="text-blue-600"
                  bgColor="bg-blue-100"
                />
                <StatCard
                  label="Tổng tiền khi kết ca (Tiền mặt)"
                  value={shiftData.revenue.expected_cash_in_drawer}
                  isBold
                  icon={<Wallet size={18} />}
                  color="text-purple-600"
                  bgColor="bg-purple-100"
                />
              </div>

              {/* 3. Danh sách Booking */}
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    <FileText size={16} /> Danh sách đặt phòng ({shiftData.activities.total_bookings})
                  </h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                      <tr>
                        <th className="px-5 py-3">Mã Booking</th>
                        <th className="px-5 py-3">Khách hàng</th>
                        <th className="px-5 py-3">Check-in/Out</th>
                        <th className="px-5 py-3 text-right">Tổng tiền</th>
                        <th className="px-5 py-3 text-center">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {shiftData.activities.booking_list.length > 0 ? (
                        shiftData.activities.booking_list.map((booking) => (
                          <tr key={booking.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-5 py-3 font-medium text-gray-900">
                              {booking.booking_code.split('-')[1]}...
                            </td>
                            <td className="px-5 py-3">
                              <p className="font-medium text-gray-900">{booking.guest_name}</p>
                              <p className="text-xs text-gray-500">{booking.guest_phone || '---'}</p>
                            </td>
                            <td className="px-5 py-3 text-gray-500 text-xs">
                              <div className='flex gap-1 items-center'><Calendar size={12} /> {new Date(booking.check_in_date).toLocaleDateString('vi-VN')}</div>
                              <div className='flex gap-1 items-center mt-1'><Calendar size={12} /> {new Date(booking.check_out_date).toLocaleDateString('vi-VN')}</div>
                            </td>
                            <td className="px-5 py-3 text-right font-medium text-blue-600">
                              {formatCurrency(booking.total_price)}
                            </td>
                            <td className="px-5 py-3 text-center">
                              <span className={`text-xs px-2 py-1 rounded-full ${booking.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                booking.status === 'EXPIRED' ? 'bg-red-100 text-red-700' :
                                  'bg-yellow-100 text-yellow-700'
                                }`}>
                                {booking.status}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="px-5 py-8 text-center text-gray-500">
                            Chưa có booking nào trong ca này
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          ) : (
            <div className="text-center text-gray-500 py-10">Không có dữ liệu</div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-white flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition"
          >
            Đóng
          </button>
          {/* Nút In báo cáo (tính năng mở rộng sau này) */}
          <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition flex items-center gap-2">
            <FileText size={18} /> In Báo Cáo
          </button>
        </div>
      </div>
    </div>
  );
}

// Sub-component nhỏ để hiển thị thẻ tiền
function StatCard({ label, value, icon, color, bgColor, isBold = false }) {
  return (
    <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex items-start justify-between">
      <div>
        <p className="text-xs text-gray-500 mb-1 uppercase tracking-wide">{label}</p>
        <p className={`text-lg ${isBold ? 'font-bold' : 'font-medium'} ${color}`}>
          {formatCurrency(value)}
        </p>
      </div>
      <div className={`p-2 rounded-lg ${bgColor} ${color}`}>
        {icon}
      </div>
    </div>
  )
}