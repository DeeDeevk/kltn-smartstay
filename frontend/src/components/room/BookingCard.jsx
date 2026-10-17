import React, { useState } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css"; // Import CSS của thư viện lịch
import { vi, enUS } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';
import formatCurrencyUtil from '../../utils/formatCurrency';
import { VAT_RATE, calculateVat } from '../../utils/vat';

export default function BookingCard({ room, initialCheckIn, initialCheckOut }) {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { t, i18n } = useTranslation();
  const datePickerLocale = i18n.language === 'en' ? enUS : vi;

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

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

  const roomSubtotal = (pricePerNight * nights);
  // Chỉ để hiển thị trước cho khách xem — số tiền charge thật luôn do backend tính lại
  // khi tạo link thanh toán, đảm bảo khớp 100% với VAT_RATE ở booking.service.ts.
  const vatAmount = calculateVat(roomSubtotal);
  const totalPrice = roomSubtotal + vatAmount;

  const formatCurrency = (amount) => formatCurrencyUtil(amount, i18n.language);

  const handleBooking = () => {
    const checkoutState = {
      room,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      nights,
      totalPrice,
      vatAmount
    };

    if (!isAuthenticated) {
      toast.info(t('room.booking.loginRequired'));
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

  return (
    <div className="bg-white rounded-xl shadow-xl border border-gray-200 p-6 w-full max-w-[380px]">
      {/* Header Giá */}
      <div className="flex items-end justify-between mb-6">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-gray-900">{formatCurrency(pricePerNight)}</span>
          <span className="text-gray-500 font-medium">{t('room.booking.perNight')}</span>
        </div>
      </div>

      {/* --- FORM NHẬP LIỆU --- */}
      <div className=" rounded-xl mb-4 relative bg-white z-10">

        {/* DATE PICKER */}
        <div className="flex border border-gray-200 rounded-t-xl">
          <div className="w-1/2 p-3 hover:bg-gray-50 cursor-pointer relative border-r border-gray-200">
            <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">{t('room.booking.checkIn')}</label>
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
              locale={datePickerLocale}
              dateFormat="dd/MM/yyyy"
              className="w-full bg-transparent text-sm text-gray-700 outline-none cursor-pointer p-0"
            />
          </div>
          <div className="w-1/2 p-3 hover:bg-gray-50 cursor-pointer relative">
            <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">{t('room.booking.checkOut')}</label>
            <DatePicker
              selected={endDate}
              onChange={(date) => setEndDate(date)}
              selectsEnd
              startDate={startDate}
              endDate={endDate}
              minDate={minEndDate}
              locale={datePickerLocale}
              dateFormat="dd/MM/yyyy"
              className="w-full bg-transparent text-sm text-gray-700 outline-none cursor-pointer p-0"
            />
          </div>
        </div>

        <div className="pt-3 pl-3 flex">
          {room.availableCount && (
            <p className="text-blue-600 font-semibold text-md">
              {t('room.booking.roomsLeft', { count: room.availableCount })}
            </p>
          )}
        </div>
      </div>

      {/* Button & Chi tiết giá */}
      <button
        onClick={handleBooking}
        className="w-full bg-rose-500 hover:bg-rose-600 transition text-white font-bold py-3.5 rounded-lg text-base shadow-md mb-3 flex items-center justify-center gap-2"
      >
        {t('room.booking.bookNow')}
      </button>

      <div className="space-y-3 pt-4 mt-4">
        <div className="flex justify-between text-gray-600 text-base">
          <span className="underline decoration-gray-300 decoration-dotted">
            {t('room.booking.nights', { price: formatCurrency(pricePerNight), nights })}
          </span>
          <span>{formatCurrency(roomSubtotal)}</span>
        </div>
        <div className="flex justify-between text-gray-500 text-sm">
          <span>{t('room.booking.vat', { rate: VAT_RATE * 100 })}</span>
          <span>{formatCurrency(vatAmount)}</span>
        </div>
        <div className="flex justify-between items-center border-t border-gray-200 mt-4 pt-4">
          <span className="font-bold text-gray-900 text-lg">{t('room.booking.total')}</span>
          <span className="font-bold text-gray-900 text-lg">{formatCurrency(totalPrice)}</span>
        </div>
      </div>
    </div>
  );
}