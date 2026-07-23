import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function BookingChart({ data }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-full flex flex-col">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-bold text-gray-900">Thống kê Lượt Đặt phòng</h3>
      </div>
      
      <div className="flex-1 w-full min-h-[250px]">
        {/* Kiểm tra an toàn: Chỉ vẽ biểu đồ khi data tồn tại và có phần tử */}
        {data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis 
                dataKey="name" 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#6B7280', fontSize: 12}} 
                dy={10} 
              />
              <YAxis 
                axisLine={false} 
                tickLine={false} 
                tick={{fill: '#6B7280', fontSize: 12}} 
              />
              <Tooltip 
                cursor={{fill: '#F3F4F6'}}
                formatter={(value) => [value, "Lượt đặt phòng"]}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar 
                dataKey="bookings" 
                fill="#8B5CF6" 
                radius={[4, 4, 0, 0]} 
                name="Số lượng booking"
                maxBarSize={60} 
              />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400">
            Không có dữ liệu
          </div>
        )}
      </div>
    </div>
  );
}