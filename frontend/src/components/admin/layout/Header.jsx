import React from 'react';

export default function Header({ collapsed = false }) {
  return (
    <header
      className={`fixed top-0 right-0 z-10 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-8 transition-[left] duration-200 ${
        collapsed ? 'left-20' : 'left-64'
      }`}
    >
      {/* Actions (chỗ dành cho nút xuất báo cáo, chuông thông báo... khi cần) */}
      <div className="ml-auto flex items-center gap-4" />
    </header>
  );
}
