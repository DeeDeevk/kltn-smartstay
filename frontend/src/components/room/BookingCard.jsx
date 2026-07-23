import React, { useState, useRef, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css"; // Import CSS của thư viện lịch
import { ChevronDown, Minus, Plus } from 'lucide-react';
import { vi } from 'date-fns/locale'; // Để lịch hiển thị tiếng Việt
import { useNavigate } from 'react-router-dom';
import { useCreateBookingMutation } from '../../services/booking';
import { useCreatePayOSLinkMutation } from '../../services/payment';
import { toast } from 'react-toastify';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

// Component con để hiển thị từng dòng khách (Người lớn, Trẻ em...)
const GuestCounter = ({ label, subLabel, value, onDecrease, onIncrease, max = 10 }) => (
  <div className="flex items-center justify-between py-4 border-b border-gray-100 last:border-0">
    <div className="flex flex-col">
      <span className="font-semibold text-sm text-gray-900">{label}</span>
      {subLabel && <span className="text-xs text-gray-500">{subLabel}</span>}
    </div>
    <div className="flex items-center gap-3">
      <button
        onClick={onDecrease}
        disabled={value <= 0}
        className={`w-8 h-8 rounded-full border flex items-center justify-center transition ${value <= 0 ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-gray-400 text-gray-600 hover:border-black hover:text-black'
          }`}
      >
        <Minus size={14} />
      </button>
      <span className="w-4 text-center text-sm font-medium">{value}</span>
      <button
        onClick={onIncrease}
        disabled={value >= max}
        className={`w-8 h-8 rounded-full border flex items-center justify-center transition ${value >= max ? 'border-gray-200 text-gray-300 cursor-not-allowed' : 'border-gray-400 text-gray-600 hover:border-black hover:text-black'
          }`}
      >
        <Plus size={14} />
      </button>
    </div>
  </div>
);

export default function BookingCard({ room, initialCheckIn, initialCheckOut }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [createBooking, { isLoading: isBookingLoading }] = useCreateBookingMutation();
  const [createPayOSLink, { isLoading: isPaymentLoading }] = useCreatePayOSLinkMutation();

  const [pricePerNight] = useState(room?.basePrice || room?.base_price || 2500000);

  // State cho Lịch (Ngày bắt đầu - Ngày kết thúc)
  const [startDate, setStartDate] = useState(initialCheckIn ? new Date(initialCheckIn) : tomorrow);
  const [endDate, setEndDate] = useState(
    initialCheckOut
      ? new Date(initialCheckOut)
      : new Date(new Date().setDate(new Date().getDate() + 3))
  );

  const minEndDate = new Date(startDate);
  minEndDate.setDate(minEndDate.getDate() + 1);

  // --- LOGIC TÍNH TOÁN ---
  // Tính số đêm
  const nights = Math.max(1, Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)));

  const totalPrice = (pricePerNight * nights);

  // Format tiền tệ
  const formatCurrency = (amount) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount).replace('₫', 'đ');

  const handleBooking = () => {
    const checkoutState = {
      room,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      nights,
      totalPrice
    };

    if (!isAuthenticated) {
      toast.info("Vui lòng đăng nhập để tiếp tục đặt phòng");
      navigate('/login', {
        state: {
          from: '/checkout',
          checkoutState: checkoutState
        }
      });
    } else {
      navigate('/checkout', {
        state: checkoutState
      });
    }
  };

  const isProcessing = isBookingLoading || isPaymentLoading;

  return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 w-full max-w-[380px]">
      {/* Header Giá */}
      <div className="flex items-end justify-between mb-6">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-gray-900">{formatCurrency(pricePerNight)}</span>
          <span className="text-gray-500 font-medium">/ đêm</span>
        </div>
      </div>

      {/* --- FORM NHẬP LIỆU --- */}
      <div className=" rounded-xl mb-4 relative bg-white z-10">

        {/* DATE PICKER */}
        <div className="flex border border-gray-200 rounded-t-xl">
          <div className="w-1/2 p-3 hover:bg-gray-50 cursor-pointer relative border-r border-gray-200">
            <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">Nhận phòng</label>
            <DatePicker
              selected={startDate}
              onChange={(date) => {
                setStartDate(date);
                if (endDate <= date) {
                   const nextDay = new Date(date);
                   nextDay.setDate(nextDay.getDate() + 1);
                   setEndDate(nextDay);
                }
              }}
              selectsStart
              startDate={startDate}
              endDate={endDate}
              minDate={tomorrow}
              locale={vi}
              dateFormat="dd/MM/yyyy"
              className="w-full bg-transparent text-sm text-gray-700 outline-none cursor-pointer p-0"
            />
          </div>
          <div className="w-1/2 p-3 hover:bg-gray-50 cursor-pointer relative">
            <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">Trả phòng</label>
            <DatePicker
              selected={endDate}
              onChange={(date) => setEndDate(date)}
              selectsEnd
              startDate={startDate}
              endDate={endDate}
              minDate={minEndDate}
              locale={vi}
              dateFormat="dd/MM/yyyy"
              className="w-full bg-transparent text-sm text-gray-700 outline-none cursor-pointer p-0"
            />
          </div>
        </div>

        <div className="pt-3 pl-3 flex">
          {room.availableCount && (
            <p className="text-blue-600 font-semibold text-md">
              Còn {room.availableCount} phòng trống
            </p>
          )}
        </div>
      </div>

      {/* Button & Chi tiết giá */}
      <button
        disabled={isProcessing}
        onClick={handleBooking}
        className={`w-full ${isProcessing ? 'bg-gray-400' : 'bg-rose-500 hover:bg-rose-600'} transition text-white font-bold py-3.5 rounded-lg text-base shadow-md mb-3 flex items-center justify-center gap-2`}
      >
        {isProcessing && <Loader2 size={18} className="animate-spin" />}
        {isProcessing ? 'Đang xử lý...' : 'Đặt phòng ngay'}
      </button>

      <div className="space-y-3 pt-4 mt-4">
        <div className="flex justify-between text-gray-600 text-base">
          <span className="underline decoration-gray-300 decoration-dotted">
            {formatCurrency(pricePerNight)} x {nights} đêm
          </span>
          <span>{formatCurrency(pricePerNight * nights)}</span>
        </div>
        <div className="flex justify-between items-center border-t border-gray-200 mt-4 pt-4">
          <span className="font-bold text-gray-900 text-lg">Tổng cộng</span>
          <span className="font-bold text-gray-900 text-lg">{formatCurrency(totalPrice)}</span>
        </div>
      </div>
    </div>
  );
}