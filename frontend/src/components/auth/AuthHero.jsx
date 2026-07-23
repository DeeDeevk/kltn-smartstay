import React from 'react';

export default function AuthHero() {
  return (
    <div className="hidden lg:flex lg:col-span-1 relative bg-gray-900 overflow-hidden">
      {/* Background Image */}
      <img 
        src="https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=2070&auto=format&fit=crop" 
        alt="Hotel Lobby" 
        className="absolute inset-0 w-full h-full object-cover opacity-60"
      />
      
      {/* Content Overlay */}
      <div className="relative z-10 w-full h-full flex flex-col justify-between p-12 text-white">
        
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg shadow-lg">
            {/* Icon mô phỏng logo Vika */}
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-white">
              <path d="M3 3v18h18" />
              <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
            </svg>
          </div>
          <span className="text-2xl font-bold tracking-tight">VIKA HOTEL</span>
        </div>

        {/* Hero Text */}
        <div className="mb-20">
          <h1 className="text-5xl font-bold leading-tight mb-6">
            Trải nghiệm dịch vụ <br />
            <span className="text-blue-500">Đẳng cấp 5 Sao</span>
          </h1>
          <p className="text-gray-300 text-lg max-w-md leading-relaxed">
            Chào mừng bạn đến với hệ thống quản lý chuyên nghiệp dành cho thành viên và đối tác của Vika Hotel.
          </p>
        </div>

        {/* Footer Copyright */}
        <p className="text-sm text-gray-400">
          &copy; 2026 Vika Hotel Group. All rights reserved.
        </p>
      </div>
    </div>
  );
}