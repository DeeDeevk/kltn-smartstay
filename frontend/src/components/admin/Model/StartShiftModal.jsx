import React, { useState } from 'react';
import { toast } from 'react-toastify';
import shiftAPI from '../../../services/shift';

export default function StartShiftModal({ isOpen, onClose, onSuccess }) {
  const [initialCash, setInitialCash] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleStartShift = async (e) => {
    e.preventDefault();
    if (!initialCash || Number(initialCash) < 0) {
      toast.error('Vui lòng nhập số tiền đầu ca hợp lệ!');
      return;
    }

    try {
      setIsLoading(true);
      const userStr = localStorage.getItem('user');
      if (!userStr) throw new Error("Chưa đăng nhập");
      const user = JSON.parse(userStr);
      const payload = {
        staffId: user.accountId,
        initialCash: Number(initialCash)
      };

      await shiftAPI.startShift(payload);
      toast.success('Mở ca làm việc thành công!');
      onSuccess(); // Báo cho Component cha refresh lại giao diện
    } catch (error) {
      toast.error(error?.response?.data?.message || 'Có lỗi xảy ra khi mở ca');
    } finally {
      setIsLoading(false);
    }
  };

  // Định dạng hiển thị tiền khi nhập
  const formatCurrencyInput = (val) => {
    const number = val.replace(/\D/g, '');
    return number ? new Intl.NumberFormat('vi-VN').format(number) : '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6 animate-fade-in-up">
        <h2 className="text-xl font-bold text-gray-900 mb-4 border-b pb-3">Bắt Đầu Ca Làm Việc Mới</h2>
        
        <form onSubmit={handleStartShift}>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Tiền mặt đầu ca (VNĐ) <span className="text-red-500">*</span></label>
            <div className="relative">
              <input
                type="text"
                required
                value={formatCurrencyInput(initialCash)}
                onChange={(e) => setInitialCash(e.target.value.replace(/\D/g, ''))}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-emerald-500 text-lg font-bold"
                placeholder="Nhập số tiền..."
              />
              <span className="absolute right-4 top-3.5 text-gray-500 font-bold">đ</span>
            </div>
            <p className="text-xs text-gray-500 mt-2">Đây là số tiền có sẵn trong két sắt lúc bạn bắt đầu ca.</p>
          </div>

          <div className="flex gap-3 justify-end mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 font-medium">Hủy</button>
            <button 
              type="submit" 
              disabled={isLoading}
              className={`px-6 py-2 text-white bg-emerald-600 rounded-lg font-medium shadow-sm flex items-center ${isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:bg-emerald-700'}`}
            >
              {isLoading ? 'Đang mở ca...' : 'Xác nhận mở ca'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}