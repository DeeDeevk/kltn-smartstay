import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

// Dùng làm layout route (children ngầm định là <Outlet/>) hoặc bọc trực tiếp một
// trang cụ thể bằng cách truyền children — cả hai cách đều giữ chung Sidebar/Header.
export default function DashboardLayout({ children }) {
  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Sidebar />
      <Header />
      {/* Main Content Area (padding-left = sidebar width, padding-top = header height) */}
      <main className="pl-64 pt-16">
        <div className="p-8">
          {children ?? <Outlet />}
        </div>
      </main>
    </div>
  );
}
