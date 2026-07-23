import React, { createContext, useContext, useState, useEffect } from 'react';
import { X, Save, AlertTriangle, LogOut, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import shiftAPI from '../../../services/shift';
import { useAuth } from "../../../context/AuthContext";
import { toast } from 'react-toastify';

const formatCurrency = (val) => new Intl.NumberFormat('vi-VN').format(val);

export default function EndShiftModal({ isOpen, onClose, shiftId }) {

  const { logout } = useAuth();


  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [expectedCash, setExpectedCash] = useState(0); // Tiền hệ thống tính

  const [actualCash, setActualCash] = useState(''); // Tiền thực tế đếm được
  const [note, setNote] = useState('');

  // State kết quả chênh lệch
  const [difference, setDifference] = useState(0);

  // 1. Khi mở modal -> Gọi API lấy số liệu "Dự kiến" để nhân viên biết
  useEffect(() => {
    if (isOpen && shiftId) {
      fetchShiftStats();
    }
  }, [isOpen, shiftId]);

  // 2. Tự động tính chênh lệch khi nhân viên nhập tiền
  useEffect(() => {
    const actual = parseFloat(actualCash.toString().replace(/\./g, '') || 0); // Xóa dấu chấm nếu có
    setDifference(actual - expectedCash);
  }, [actualCash, expectedCash]);

  const fetchShiftStats = async () => {
    try {
      // Gọi API xem thông tin ca (Reuse API Get Stats)
      const res = await shiftAPI.getShiftByID(shiftId);
      const data = res.data;
      if (data && data.revenue) {
        setExpectedCash(data.revenue.expected_cash_in_drawer);
      }
    } catch (error) {
      console.error(error);
    }
  };

  const handleEndShift = async () => {
    if (!confirm("Bạn chắc chắn muốn chốt ca và đăng xuất?")) return;

    setLoading(true);
    try {
      const payload = {
        shiftId: shiftId,
        actualCash: parseFloat(actualCash.toString().replace(/\./g, '')), // Chuyển string sang number
        note: note
      };

      const res = await shiftAPI.endShift(shiftId, payload.actualCash, payload.note);
      console.log("Kết quả API chốt ca:", res);
      if (res.message === "Chốt ca thành công") {
        onClose();
        logout();
        navigate('/login');

      } else {
        alert("Lỗi khi chốt ca");
      }
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center  bg-black/50">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden">

        {/* Header màu cam cảnh báo vì đây là hành động quan trọng */}
        <div className="bg-orange-50 p-4 border-b border-orange-100 flex justify-between items-center">
          <div className="flex items-center gap-2 text-orange-700">
            <LogOut size={24} />
            <h2 className="text-lg font-bold">Kết thúc ca làm việc</h2>
          </div>
          <button onClick={onClose}><X size={24} className="text-gray-400 hover:text-gray-600" /></button>
        </div>

        <div className="p-6 space-y-6">

          {/* 1. Phần hiển thị số liệu hệ thống */}
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <p className="text-sm text-blue-600 mb-1">Hệ thống tính toán trong két phải có:</p>
            <p className="text-3xl font-bold text-blue-800">{formatCurrency(expectedCash)} ₫</p>
          </div>

          {/* 2. Phần nhập liệu thực tế */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Tiền mặt thực tế tại quầy <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                value={actualCash}
                onChange={(e) => setActualCash(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-3 text-lg font-bold text-gray-900 focus:ring-2 focus:ring-orange-500 outline-none"
                placeholder="Nhập số tiền đếm được..."
                autoFocus
              />
              <span className="absolute right-4 top-3.5 text-gray-400 font-medium">VND</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Hãy đếm kỹ tiền mặt trong két trước khi nhập.</p>
          </div>

          {/* 3. Hiển thị chênh lệch (Realtime) */}
          {actualCash !== '' && (
            <div className={`flex items-center gap-3 p-3 rounded-lg border ${difference === 0 ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
              }`}>
              {difference === 0 ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
              <div>
                <p className="font-bold text-sm">
                  {difference === 0 ? "Khớp số liệu" : (difference > 0 ? "Thừa tiền:" : "Thiếu tiền:")}
                </p>
                {difference !== 0 && (
                  <p className="text-lg font-bold">{formatCurrency(Math.abs(difference))} ₫</p>
                )}
              </div>
            </div>
          )}

          {/* 4. Ghi chú */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ghi chú bàn giao</label>
            <textarea
              rows={3}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full border border-gray-300 rounded-lg p-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Ví dụ: Khách phòng 302 gửi lại chìa khóa, thiếu 50k tiền lẻ..."
            ></textarea>
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-200 rounded-lg transition">
            Hủy bỏ
          </button>
          <button
            onClick={handleEndShift}
            disabled={!actualCash || loading}
            className={`px-5 py-2.5 text-white font-bold rounded-lg shadow-lg flex items-center gap-2 transition transform active:scale-95 ${loading ? 'bg-gray-400' : 'bg-orange-600 hover:bg-orange-700'
              }`}
          >
            {loading ? 'Đang xử lý...' : (
              <>
                <Save size={18} /> Xác nhận & Đăng xuất
              </>
            )}
          </button>
        </div>

      </div>
    </div>
  );
}