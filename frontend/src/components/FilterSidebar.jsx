import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { vi, enUS } from 'date-fns/locale';
import { Filter, Calendar, Users, Loader2, SlidersHorizontal } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import formatCurrency from '../utils/formatCurrency';

const MIN_GUESTS = 1;
const MAX_GUESTS = 10;
const MAX_PRICE = 10000000;
const PRICE_STEP = 100000;

/**
 * FilterSidebar phục vụ trang kết quả tìm phòng.
 *
 * Có 2 nhóm điều kiện lọc tách biệt vì khác nhau về cách áp dụng:
 * - searchParams (checkIn/checkOut/capacity): quyết định phòng nào còn trống, phải gọi
 *   lại GET /rooms/availability nên chỉ áp dụng khi bấm nút "Tìm lại".
 * - priceFilters (priceMin/priceMax/roomTypes): chỉ lọc trên tập kết quả đã có sẵn ở
 *   client, áp dụng ngay khi thay đổi, không cần gọi lại API.
 */
export default function FilterSidebar({
  searchParams,
  onSearchParamsChange,
  onApplySearch,
  isApplyingSearch = false,
  priceFilters,
  onPriceFilterChange,
  onReset,
  availableRoomTypes = [],
}) {
  const { t, i18n } = useTranslation();
  const datePickerLocale = i18n.language === 'en' ? enUS : vi;

  const checkInDate = searchParams.checkIn ? new Date(searchParams.checkIn) : null;
  const checkOutDate = searchParams.checkOut ? new Date(searchParams.checkOut) : null;
  const minCheckOutDate = checkInDate ? new Date(checkInDate.getTime() + 24 * 60 * 60 * 1000) : null;

  const handleCheckInChange = (date) => {
    const patch = { checkIn: date.toISOString() };
    if (checkOutDate && checkOutDate <= date) {
      patch.checkOut = new Date(date.getTime() + 24 * 60 * 60 * 1000).toISOString();
    }
    onSearchParamsChange(patch);
  };

  const handleCheckOutChange = (date) => {
    onSearchParamsChange({ checkOut: date.toISOString() });
  };

  const handlePriceMinChange = (e) => {
    const priceMin = Math.min(Number(e.target.value), priceFilters.priceMax);
    onPriceFilterChange({ priceMin });
  };

  const handlePriceMaxChange = (e) => {
    const priceMax = Math.max(Number(e.target.value), priceFilters.priceMin);
    onPriceFilterChange({ priceMax });
  };

  const handleTypeToggle = (typeName) => {
    const newTypes = priceFilters.roomTypes.includes(typeName)
      ? priceFilters.roomTypes.filter((t) => t !== typeName)
      : [...priceFilters.roomTypes, typeName];
    onPriceFilterChange({ roomTypes: newTypes });
  };

  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 sticky top-24 shadow-sm space-y-8">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Filter size={20} className="text-blue-600" /> {t('search.filter.title')}
        </h3>
        <button
          onClick={onReset}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
        >
          {t('search.filter.reset')}
        </button>
      </div>

      {/* --- NGÀY NHẬN / TRẢ PHÒNG & SỐ KHÁCH --- */}
      <div className="space-y-4 border-b border-gray-100 pb-6">
        <h4 className="font-semibold text-sm flex items-center gap-2">
          <SlidersHorizontal size={16} className="text-gray-400" /> {t('search.filter.stayDetails')}
        </h4>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 flex items-center gap-1">
            <Calendar size={13} /> {t('search.filter.checkIn')}
          </label>
          <DatePicker
            selected={checkInDate}
            onChange={handleCheckInChange}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            dateFormat="dd/MM/yyyy"
            minDate={new Date()}
            locale={datePickerLocale}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 flex items-center gap-1">
            <Calendar size={13} /> {t('search.filter.checkOut')}
          </label>
          <DatePicker
            selected={checkOutDate}
            onChange={handleCheckOutChange}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            dateFormat="dd/MM/yyyy"
            minDate={minCheckOutDate}
            locale={datePickerLocale}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-gray-500 flex items-center gap-1">
            <Users size={13} /> {t('search.filter.capacity')}
          </label>
          <select
            value={searchParams.capacity}
            onChange={(e) => onSearchParamsChange({ capacity: Number(e.target.value) })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            {Array.from({ length: MAX_GUESTS - MIN_GUESTS + 1 }, (_, i) => MIN_GUESTS + i).map((num) => (
              <option key={num} value={num}>{t('home.hero.guestsCount', { count: num })}</option>
            ))}
          </select>
        </div>

        <button
          onClick={onApplySearch}
          disabled={isApplyingSearch}
          className="w-full flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm py-2.5 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {isApplyingSearch && <Loader2 size={16} className="animate-spin" />}
          {t('search.filter.applySearch')}
        </button>
      </div>

      {/* --- KHOẢNG GIÁ --- */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-semibold text-sm">{t('search.filter.priceRange')}</h4>
          <span className="text-blue-600 font-bold text-sm">
            {formatCurrency(priceFilters.priceMin, i18n.language)} – {formatCurrency(priceFilters.priceMax, i18n.language)}
          </span>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
              {t('search.filter.minPrice')}
            </label>
            <input
              type="range"
              min="0"
              max={MAX_PRICE}
              step={PRICE_STEP}
              value={priceFilters.priceMin}
              onChange={handlePriceMinChange}
              className="w-full accent-blue-500 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
          <div>
            <label className="text-[11px] font-medium text-gray-400 uppercase tracking-wide">
              {t('search.filter.maxPrice')}
            </label>
            <input
              type="range"
              min="0"
              max={MAX_PRICE}
              step={PRICE_STEP}
              value={priceFilters.priceMax}
              onChange={handlePriceMaxChange}
              className="w-full accent-blue-500 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
          </div>
        </div>
      </div>

      {/* --- LOẠI PHÒNG --- */}
      {availableRoomTypes.length > 0 && (
        <div className="border-t border-gray-100 pt-6">
          <h4 className="font-semibold text-sm mb-3">{t('search.filter.roomType')}</h4>
          <div className="space-y-3">
            {availableRoomTypes.map((typeName, idx) => (
              <label key={idx} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={priceFilters.roomTypes.includes(typeName)}
                  onChange={() => handleTypeToggle(typeName)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-colors"
                />
                <span className="text-gray-600 text-sm group-hover:text-gray-900 transition-colors">{typeName}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
