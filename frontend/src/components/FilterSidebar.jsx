// src/features/search/components/FilterSidebar.jsx
import React from 'react';
import { Filter, Star } from 'lucide-react';

export default function FilterSidebar({
  filters,
  onFilterChange,
  onReset,
  availableRoomTypes = []
}) {
  const formatCurrency = (amount) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount).replace('₫', 'đ');

  const handlePriceChange = (e) => {
    onFilterChange({ price: Number(e.target.value) });
  };

  const handleTypeToggle = (typeName) => {
    const newTypes = filters.roomTypes.includes(typeName)
      ? filters.roomTypes.filter(t => t !== typeName)
      : [...filters.roomTypes, typeName];
    onFilterChange({ roomTypes: newTypes });
  };

  const handleAmenityToggle = (amenity) => {
    const newAmenities = filters.amenities.includes(amenity)
      ? filters.amenities.filter(a => a !== amenity)
      : [...filters.amenities, amenity];
    onFilterChange({ amenities: newAmenities });
  };

  const handleRatingChange = (rating) => {
    onFilterChange({ rating: filters.rating === rating ? 0 : rating });
  };

  return (
    <div className="bg-white p-5 rounded-xl border border-gray-200 sticky top-24 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-lg flex items-center gap-2">
          <Filter size={20} className="text-blue-600" /> Bộ lọc
        </h3>
        <button
          onClick={onReset}
          className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
        >
          Đặt lại
        </button>
      </div>

      {/* --- KHOẢNG GIÁ --- */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4">
          <h4 className="font-semibold text-sm">Giá tối đa (đêm)</h4>
          <span className="text-blue-600 font-bold text-sm">{formatCurrency(filters.price)}</span>
        </div>
        <input
          type="range"
          min="0"
          max="10000000"
          step="100000"
          value={filters.price}
          onChange={handlePriceChange}
          className="w-full accent-blue-500 h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer mb-3"
        />
        <div className="flex justify-between text-[10px] text-gray-400 font-medium">
          <span>0đ</span>
          <span>10.000.000đ</span>
        </div>
      </div>

      {/* --- LOẠI PHÒNG --- */}
      {availableRoomTypes.length > 0 && (
        <div className="mb-6 border-t border-gray-100 pt-6">
          <h4 className="font-semibold text-sm mb-3">Loại phòng</h4>
          <div className="space-y-3">
            {availableRoomTypes.map((typeName, idx) => (
              <label key={idx} className="flex items-center gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={filters.roomTypes.includes(typeName)}
                  onChange={() => handleTypeToggle(typeName)}
                  className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-colors"
                />
                <span className="text-gray-600 text-sm group-hover:text-gray-900 transition-colors">{typeName}</span>
              </label>
            ))}
          </div>
        </div>
      )}


      {/* --- ĐÁNH GIÁ --- */}
      {/* <div className="mb-6 border-t border-gray-100 pt-6">
        <h4 className="font-semibold text-sm mb-3">Đánh giá tối thiểu</h4>
        <div className="flex flex-wrap gap-2">
          {[4, 3, 2, 1].map((star) => (
            <button
              key={star}
              onClick={() => handleRatingChange(star)}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all ${filters.rating === star
                  ? 'bg-blue-50 border-blue-500 text-blue-600 shadow-sm'
                  : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
                }`}
            >
              <Star size={14} fill={filters.rating === star ? "currentColor" : "none"} className={filters.rating === star ? "text-blue-600" : "text-orange-400"} />
              {star}+
            </button>
          ))}
        </div>
      </div> */}

      {/* --- TIỆN NGHI --- */}
      {/* <div className="mb-6 border-t border-gray-100 pt-6">
        <h4 className="font-semibold text-sm mb-3">Tiện nghi</h4>
        <div className="space-y-3">
          {['Wifi miễn phí', 'Bữa sáng miễn phí', 'Bể bơi', 'Ban công / View đẹp'].map((item, idx) => (
            <label key={idx} className="flex items-center gap-3 cursor-pointer group">
              <input 
                type="checkbox" 
                checked={filters.amenities.includes(item)}
                onChange={() => handleAmenityToggle(item)}
                className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 transition-colors" 
              />
              <span className="text-gray-600 text-sm group-hover:text-gray-900 transition-colors">{item}</span>
            </label>
          ))}
        </div>
      </div> */}
    </div>
  );
}
