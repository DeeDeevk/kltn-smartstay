import React from 'react';

const TRANSACTIONS = [
  { id: '#BK-9021', customer: 'Nguyễn Văn A', roomType: 'DELUXE', date: '12/10/2023', amount: '4.500.000đ', status: 'PAID' },
  { id: '#BK-9022', customer: 'Trần Thị B', roomType: 'SUITE', date: '12/10/2023', amount: '7.200.000đ', status: 'PENDING' },
  { id: '#BK-9023', customer: 'Lê Văn C', roomType: 'STANDARD', date: '11/10/2023', amount: '1.800.000đ', status: 'CANCELLED' },
];

export default function RecentTransactions() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm mt-8 overflow-hidden">
      <div className="p-6 border-b border-gray-200 flex justify-between items-center">
        <h3 className="text-lg font-bold text-gray-900">Giao dịch gần đây</h3>
        <button className="text-blue-600 font-bold text-sm hover:underline">Xem tất cả</button>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-500 font-bold uppercase text-xs">
            <tr>
              <th className="px-6 py-4">Mã đơn</th>
              <th className="px-6 py-4">Tên khách</th>
              <th className="px-6 py-4">Loại phòng</th>
              <th className="px-6 py-4">Ngày thanh toán</th>
              <th className="px-6 py-4">Số tiền</th>
              <th className="px-6 py-4">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {TRANSACTIONS.map((item, index) => (
              <tr key={index} className="hover:bg-gray-50">
                <td className="px-6 py-4 font-bold text-gray-900">{item.id}</td>
                <td className="px-6 py-4 text-gray-700">{item.customer}</td>
                <td className="px-6 py-4">
                  <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2 py-1 rounded uppercase">
                    {item.roomType}
                  </span>
                </td>
                <td className="px-6 py-4 text-gray-500">{item.date}</td>
                <td className="px-6 py-4 font-bold text-gray-900">{item.amount}</td>
                <td className="px-6 py-4">
                  {item.status === 'PAID' && <span className="bg-green-100 text-green-700 text-xs font-bold px-3 py-1 rounded-full">Thành công</span>}
                  {item.status === 'PENDING' && <span className="bg-yellow-100 text-yellow-700 text-xs font-bold px-3 py-1 rounded-full">Chờ xử lý</span>}
                  {item.status === 'CANCELLED' && <span className="bg-red-100 text-red-700 text-xs font-bold px-3 py-1 rounded-full">Đã hủy</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}