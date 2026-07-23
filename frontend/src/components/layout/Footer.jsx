import React from 'react';
import { Globe, Mail, MessageCircle } from 'lucide-react';
import Logo from "../../assets/icon/icon.png";

export default function Footer() {
  return (
    <footer className="bg-white border-t border-gray-100 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-12 mb-12 md:[grid-template-columns:minmax(0,1.7fr)_minmax(220px,1fr)_minmax(220px,1fr)] lg:[grid-template-columns:minmax(0,1.8fr)_minmax(240px,1fr)_minmax(240px,1fr)]">
          {/* Brand */}
          <div className="space-y-4 min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <img src={Logo} alt="Vika Hotel" className="h-12 w-12 shrink-0 rounded-2xl object-contain bg-white shadow-sm ring-1 ring-gray-200 p-1" />
              <span className="text-xl font-bold text-gray-900">VIKA HOTEL</span>
            </div>
            <p className="max-w-md text-gray-500 text-sm leading-relaxed whitespace-normal break-keep">
              Trải nghiệm nghỉ dưỡng tuyệt vời nhất ngay tại trung tâm thành phố với dịch vụ 5 sao.
            </p>
            <div className="flex gap-4 pt-2">
              {[Globe, Mail, MessageCircle].map((Icon, i) => (
                <a key={i} href="#" className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center text-gray-600 hover:bg-blue-50 hover:text-blue-600 transition-colors">
                  <Icon size={18} />
                </a>
              ))}
            </div>
          </div>

          {/* Links 1 */}
          <div className="min-w-0">
            <h4 className="font-bold text-gray-900 mb-6 whitespace-nowrap">Về Vika Hotel</h4>
            <ul className="space-y-4 text-sm text-gray-500">
              <li><a href="#" className="inline-flex whitespace-nowrap hover:text-blue-600">Về chúng tôi</a></li>
              <li><a href="#" className="inline-flex whitespace-nowrap hover:text-blue-600">Cơ hội nghề nghiệp</a></li>
              <li><a href="#" className="inline-flex whitespace-nowrap hover:text-blue-600">Blog du lịch</a></li>
            </ul>
          </div>

          {/* Links 2 */}
          <div className="min-w-0">
            <h4 className="font-bold text-gray-900 mb-6 whitespace-nowrap">Hỗ Trợ</h4>
            <ul className="space-y-4 text-sm text-gray-500">
              <li><a href="#" className="inline-flex whitespace-nowrap hover:text-blue-600">Trung tâm trợ giúp</a></li>
              <li><a href="#" className="inline-flex whitespace-nowrap hover:text-blue-600">Chính sách bảo mật</a></li>
              <li><a href="#" className="inline-flex whitespace-nowrap hover:text-blue-600">Liên hệ</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-8 flex flex-col gap-4 text-sm text-gray-400 md:flex-row md:justify-between md:items-center">
          <p className="whitespace-nowrap">&copy; 2026 Vika Hotel. All rights reserved.</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a href="#" className="whitespace-nowrap">Điều khoản</a>
            <a href="#" className="whitespace-nowrap">Bảo mật</a>
            <a href="#" className="whitespace-nowrap">Sitemap</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
