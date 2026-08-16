import React from 'react';
import { Globe, MessageCircle, Send, Mail, Phone, MapPin } from 'lucide-react';
import Logo from "../../assets/icon/icon.png";

export default function Footer() {
  return (
    <footer id="lien-he" className="bg-gray-950 text-gray-300 pt-20 pb-8 relative overflow-hidden scroll-mt-20">
      {/* Decorative glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-80 w-[36rem] rounded-full bg-blue-600/20 blur-3xl" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative">
        <div className="grid grid-cols-1 gap-12 mb-14 md:[grid-template-columns:minmax(0,1.6fr)_minmax(180px,1fr)_minmax(180px,1fr)_minmax(220px,1.1fr)]">
          {/* Brand */}
          <div className="space-y-5 min-w-0">
            <div className="flex items-center gap-3 min-w-0">
              <img src={Logo} alt="Vika Hotel" className="h-12 w-12 shrink-0 rounded-2xl object-contain bg-white shadow-sm ring-1 ring-white/10 p-1" />
              <span className="text-xl font-bold text-white tracking-tight">VIKA HOTEL</span>
            </div>
            <p className="max-w-sm text-gray-400 text-sm leading-relaxed">
              Trải nghiệm nghỉ dưỡng tuyệt vời nhất ngay tại trung tâm thành phố với dịch vụ 5 sao.
            </p>
            <div className="flex gap-3 pt-1">
              {[Globe, MessageCircle, Send].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 hover:bg-blue-600 hover:border-blue-600 hover:text-white transition-colors"
                >
                  <Icon size={17} />
                </a>
              ))}
            </div>
          </div>

          {/* Links 1 */}
          <div className="min-w-0">
            <h4 className="font-bold text-white mb-6 whitespace-nowrap">Về Vika Hotel</h4>
            <ul className="space-y-4 text-sm text-gray-400">
              <li><a href="#" className="inline-flex whitespace-nowrap hover:text-blue-400 transition-colors">Về chúng tôi</a></li>
              <li><a href="#" className="inline-flex whitespace-nowrap hover:text-blue-400 transition-colors">Cơ hội nghề nghiệp</a></li>
              <li><a href="#" className="inline-flex whitespace-nowrap hover:text-blue-400 transition-colors">Blog du lịch</a></li>
            </ul>
          </div>

          {/* Links 2 */}
          <div className="min-w-0">
            <h4 className="font-bold text-white mb-6 whitespace-nowrap">Hỗ Trợ</h4>
            <ul className="space-y-4 text-sm text-gray-400">
              <li><a href="#" className="inline-flex whitespace-nowrap hover:text-blue-400 transition-colors">Trung tâm trợ giúp</a></li>
              <li><a href="#" className="inline-flex whitespace-nowrap hover:text-blue-400 transition-colors">Chính sách bảo mật</a></li>
              <li><a href="#" className="inline-flex whitespace-nowrap hover:text-blue-400 transition-colors">Liên hệ</a></li>
            </ul>
          </div>

          {/* Contact */}
          <div className="min-w-0">
            <h4 className="font-bold text-white mb-6 whitespace-nowrap">Liên Hệ</h4>
            <ul className="space-y-4 text-sm text-gray-400">
              <li className="flex items-start gap-3">
                <MapPin size={18} className="shrink-0 text-blue-400 mt-0.5" />
                <span>123 Nguyễn Huệ, Q.1, TP.HCM</span>
              </li>
              <li className="flex items-center gap-3">
                <Phone size={18} className="shrink-0 text-blue-400" />
                <span className="whitespace-nowrap">1900 1234</span>
              </li>
              <li className="flex items-center gap-3">
                <Mail size={18} className="shrink-0 text-blue-400" />
                <span className="whitespace-nowrap">support@vikahotel.vn</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-8 flex flex-col gap-4 text-sm text-gray-500 md:flex-row md:justify-between md:items-center">
          <p className="whitespace-nowrap">&copy; 2026 Vika Hotel. All rights reserved.</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <a href="#" className="whitespace-nowrap hover:text-gray-300 transition-colors">Điều khoản</a>
            <a href="#" className="whitespace-nowrap hover:text-gray-300 transition-colors">Bảo mật</a>
            <a href="#" className="whitespace-nowrap hover:text-gray-300 transition-colors">Sitemap</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
