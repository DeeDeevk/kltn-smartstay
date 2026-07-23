import React, { useEffect, useState } from 'react';
import { X, CalendarClock, Clock, FileText, AlertCircle } from 'lucide-react';
import shiftAPI from '../../../services/shift';

const formatCurrency = (amount) => {
    if (amount === null || amount === undefined) return '---';
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(amount));
};

const formatDateTime = (dateString) => {
    if (!dateString) return '---';
    return new Date(dateString).toLocaleString('vi-VN', {
        hour: '2-digit', minute: '2-digit',
        day: '2-digit', month: '2-digit', year: 'numeric'
    });
};

// Hàm hỗ trợ lấy chuỗi YYYY-MM-DD theo giờ địa phương
const getLocalDateString = (dateInput) => {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export default function ShiftListModal({ isOpen, onClose }) {
    const [loading, setLoading] = useState(false);
    const [shifts, setShifts] = useState([]);
    
    // State quản lý ngày đang được chọn (Mặc định là Hôm nay)
    const [selectedDate, setSelectedDate] = useState(getLocalDateString(new Date()));

    useEffect(() => {
        if (isOpen) {
            fetchShifts();
            // Reset về ngày hôm nay mỗi khi mở modal (tuỳ chọn)
            setSelectedDate(getLocalDateString(new Date()));
        }
    }, [isOpen]);

    const fetchShifts = async () => {
        setLoading(true);
        try {
            const response = await shiftAPI.getAllShifts();
            setShifts(response.data);
        } catch (error) {
            console.error("Lỗi:", error);
        } finally {
            setLoading(false);
        }
    };

    // Lọc danh sách ca làm việc theo ngày đã chọn
    const filteredShifts = shifts.filter(shift => {
        if (!selectedDate) return true; // Nếu chọn "Tất cả", không lọc
        if (!shift.start_time) return false;
        
        return getLocalDateString(shift.start_time) === selectedDate;
    });

    if (!isOpen) return null;

    const todayString = getLocalDateString(new Date());

    return (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">

                <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/80">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 p-2.5 rounded-xl text-indigo-600 shadow-sm">
                            <CalendarClock size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-800">Lịch sử Ca làm việc</h2>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                        <X size={24} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
                    
                    {/* BỘ LỌC NGÀY THÁNG NẰM Ở ĐÂY */}
                    <div className="mb-5 flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                        <div className="flex gap-2">
                            <button 
                                onClick={() => setSelectedDate(todayString)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${selectedDate === todayString ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            >
                                Hôm nay
                            </button>
                            <button 
                                onClick={() => setSelectedDate('')}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${!selectedDate ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                            >
                                Tất cả
                            </button>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <label className="text-sm font-medium text-gray-600 cursor-pointer" htmlFor="date-picker">
                                Chọn ngày:
                            </label>
                            <input 
                                id="date-picker"
                                type="date" 
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-gray-50"
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
                        </div>
                    ) : filteredShifts.length > 0 ? (
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-gray-500 uppercase bg-gray-50 border-b border-gray-100">
                                        <tr>
                                            <th className="px-5 py-4 font-semibold">Ca / Nhân viên</th>
                                            <th className="px-5 py-4 font-semibold">Thời gian</th>
                                            <th className="px-5 py-4 font-semibold text-right">Tài chính</th>
                                            <th className="px-5 py-4 font-semibold">Ghi chú</th>
                                            <th className="px-5 py-4 font-semibold text-center">Trạng thái</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredShifts.map((shift) => (
                                            <tr key={shift.id} className="hover:bg-indigo-50/30 transition-colors group">
                                                <td className="px-5 py-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold border border-indigo-100">
                                                            {shift.staff_name?.charAt(0).toUpperCase()}
                                                        </div>
                                                        <p className="font-bold text-gray-900">#{shift.id} - {shift.staff_name}</p>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-gray-600 text-xs space-y-1.5">
                                                    <div className='flex gap-1.5 items-center'>
                                                        <Clock size={14} className="text-green-600" />
                                                        <span className="font-medium text-gray-700">{formatDateTime(shift.start_time)}</span>
                                                    </div>
                                                    <div className='flex gap-1.5 items-center'>
                                                        <Clock size={14} className={shift.end_time ? "text-gray-400" : "text-amber-500"} />
                                                        <span className={shift.end_time ? "text-gray-500" : "italic text-amber-600 font-medium"}>
                                                            {shift.end_time ? formatDateTime(shift.end_time) : 'Chưa kết ca'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4 text-right text-xs space-y-1.5">
                                                    <div className="flex justify-end gap-2 items-center">
                                                        <span className="text-gray-400">Đầu ca:</span>
                                                        <span className="font-medium text-gray-700">{formatCurrency(shift.initial_cash)}</span>
                                                    </div>
                                                    <div className="flex justify-end gap-2 items-center">
                                                        <span className="text-gray-400">Bàn giao:</span>
                                                        <span className={`font-bold ${shift.status === 'open' ? 'text-amber-500' : 'text-indigo-600'}`}>
                                                            {shift.status === 'open' ? 'Đang tính...' : formatCurrency(shift.actual_cash_handover)}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-5 py-4">
                                                    {shift.note ? (
                                                        <div className="flex items-start gap-1.5 text-xs text-gray-600 max-w-[180px]">
                                                            <FileText size={14} className="flex-shrink-0 mt-0.5 text-gray-400" />
                                                            <span className="truncate">{shift.note}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-300 text-xs italic">Không có</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 text-center">
                                                    <span className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium border
                            ${shift.status === 'open' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'}`}
                                                    >
                                                        {shift.status === 'open' ? 'Đang mở' : 'Đã chốt'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                            <AlertCircle size={48} className="text-gray-300 mb-4" />
                            <p className="text-lg font-medium text-gray-600">
                                {selectedDate ? `Không có ca làm việc nào trong ngày ${new Date(selectedDate).toLocaleDateString('vi-VN')}` : 'Chưa có dữ liệu'}
                            </p>
                        </div>
                    )}
                </div>

                <div className="p-4 border-t border-gray-100 bg-white flex justify-end">
                    <button onClick={onClose} className="px-5 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-medium">
                        Đóng cửa sổ
                    </button>
                </div>
            </div>
        </div>
    );
}