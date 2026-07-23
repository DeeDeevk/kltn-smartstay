import React from 'react';
import { Wallet, ShoppingBag, Bed, BarChart2, TrendingUp, TrendingDown } from 'lucide-react';

const formatCurrency = (value) => new Intl.NumberFormat('vi-VN').format(value) + 'đ';

export default function StatsGrid({ stats }) {
  const STATS_CONFIG = [
    { 
      title: 'Tổng doanh thu', 
      value: formatCurrency(stats?.totalRevenue || 0), 
      change: '+12.5%', isPositive: true, icon: Wallet, color: 'bg-blue-100 text-blue-600' 
    },
    { 
      title: 'Tổng đơn đặt phòng', 
      value: stats?.totalBookings || 0, 
      change: '+8.2%', isPositive: true, icon: ShoppingBag, color: 'bg-purple-100 text-purple-600' 
    },
    { 
      title: 'Tỷ lệ lấp đầy TB', 
      value: `${stats?.avgOccupancy || 0}%`, 
      change: '-2.4%', isPositive: false, icon: Bed, color: 'bg-orange-100 text-orange-600' 
    },
    { 
      title: 'Doanh thu TB (RevPAR)', 
      value: formatCurrency(stats?.avgRevPar || 0), 
      change: '+5.1%', isPositive: true, icon: BarChart2, color: 'bg-green-100 text-green-600' 
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
      {STATS_CONFIG.map((stat, index) => (
        <div key={index} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="flex justify-between items-start mb-4">
            <div className={`p-3 rounded-lg ${stat.color}`}>
              <stat.icon size={24} />
            </div>
            <div className={`flex items-center text-xs font-bold px-2 py-1 rounded-full ${stat.isPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
              {stat.isPositive ? <TrendingUp size={14} className="mr-1" /> : <TrendingDown size={14} className="mr-1" />}
              {stat.change}
            </div>
          </div>
          <div>
            <p className="text-gray-500 text-sm font-medium mb-1">{stat.title}</p>
            <h3 className="text-2xl font-bold text-gray-900">{stat.value}</h3>
          </div>
        </div>
      ))}
    </div>
  );
}