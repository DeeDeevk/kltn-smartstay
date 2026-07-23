import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export default function CompareChart({ data, title, dataKey, color, formatValue }) {
  return (
    <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm h-full flex flex-col">
      <h3 className="text-lg font-bold text-gray-900 mb-6">{title}</h3>
      
      <div className="flex-1 w-full min-h-[250px]">
        {/* Thêm check an toàn: Chỉ vẽ khi có data */}
        {data && data.length > 0 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 14, fontWeight: 'bold'}} dy={10} />
              <YAxis 
                axisLine={false} tickLine={false} tick={{fill: '#6B7280', fontSize: 12}}
                tickFormatter={dataKey === 'revenue' ? (val) => `${val / 1000000}M` : undefined}
              />
              <Tooltip 
                cursor={{fill: '#F3F4F6'}}
                formatter={(value) => [formatValue ? formatValue(value) : value, "Tổng"]}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
              <Bar dataKey={dataKey} radius={[6, 6, 0, 0]} maxBarSize={80}>
                {/* Dùng data && data.map để không bị crash nếu mảng rỗng */}
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={index === 0 ? '#9CA3AF' : color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">Không có dữ liệu so sánh</div>
        )}
      </div>
    </div>
  );
}