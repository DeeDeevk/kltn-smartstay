// src/features/room-map/components/RoomMapSidebar.jsx
import { Layers, Map, Info } from 'lucide-react';
import floorAPI from '../../../services/floor';
import React, { useState, useEffect } from 'react';

export default function RoomMapSidebar({ activeFloor, onSelectFloor, statusCounts }) {
  const [floors, setFloors] = useState([]);


  useEffect(() => {
    // Hàm call API
    const fetchFloors = async () => {
      try {
        console.log("Bat dau goi API..."); // Log để kiểm tra
        const response = await floorAPI.getAll();

        // Cập nhật State 1 lần duy nhất ở đây
        // Giả sử API trả về { data: [...] }
        const floorData = response.data || [];
        console.log("Dữ liệu tầng nhận được từ API:", floorData); // Log dữ liệu nhận được
        setFloors(floorData);

      } catch (err) {
        console.error("Lỗi:", err);
      }
    };

    fetchFloors();

  }, []);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 h-full flex flex-col">
      {/* Header Sidebar */}
      <div className="p-5 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-1">
          <div className="bg-yellow-100 p-2 rounded-full text-yellow-700">
            <Map size={20} />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Chọn Tầng</h3>
            <p className="text-xs text-gray-500">Điều hướng nhanh</p>
          </div>
        </div>
      </div>

      {/* List Floor */}
      <div className="p-3 flex-1 overflow-y-auto">
        <div className="space-y-1">
          <button
            onClick={() => onSelectFloor('all')} // Truyền giá trị 'all'
            className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${activeFloor === 'all' // Kiểm tra nếu đang chọn 'all'
                ? 'bg-blue-50 text-blue-700 shadow-sm'
                : 'text-gray-600 hover:bg-gray-50'
              }`}
          >
            <Layers
              size={18}
              className={activeFloor === 'all' ? 'text-blue-600' : 'text-gray-400'}
            />
            Tất Cả
          </button>
          {floors.map((floor) => (
            <button
              key={floor.id}
              onClick={() => onSelectFloor(floor.id)}
              className={`w-full text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center gap-3 ${activeFloor === floor.id
                  ? 'bg-blue-50 text-blue-700 shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50'
                }`}
            >
              <Layers size={18} className={activeFloor === floor.id ? 'text-blue-600' : 'text-gray-400'} />
              {floor.name}
            </button>
          ))}
        </div>
      </div>

      {/* Footer Status Summary */}
      <div className="p-4 bg-blue-50 m-3 rounded-xl border border-blue-100">
        <div className="flex items-center gap-2 mb-3 text-blue-800 font-bold text-sm">
          <Info size={16} /> Trạng thái
        </div>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500"></span>
            <span className="text-gray-600">Trống ({statusCounts.AVAILABLE}) </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-gray-400"></span>
            <span className="text-gray-600">Đã đặt ({statusCounts.BOOKED})</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-400"></span>
            <span className="text-gray-600">Bảo trì ({statusCounts.MAINTENANCE})</span>
          </div>
        </div>
      </div>
    </div>
  );
}