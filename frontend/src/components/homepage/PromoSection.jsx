import React from 'react';

export default function PromoSection() {
  return (
    <section className="py-20 bg-gray-900 text-white relative overflow-hidden">
      {/* Background Effect */}
      <div className="absolute top-0 right-0 w-1/2 h-full bg-blue-600/20 blur-3xl rounded-full translate-x-1/2"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6">
            <span className="bg-yellow-400 text-black text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">
              Ưu đãi độc quyền
            </span>
            <h2 className="text-4xl md:text-5xl font-bold leading-tight">
              Mùa Hè Rực Rỡ <br/> 
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400">Giảm Tới 20%</span>
            </h2>
            <p className="text-gray-300 text-lg">
              Đặt phòng ngay hôm nay để nhận ưu đãi đặc biệt cho kỳ nghỉ hè của bạn. Áp dụng cho các đặt phòng từ 3 đêm trở lên.
            </p>
            <button className="bg-white text-gray-900 hover:bg-gray-100 px-8 py-4 rounded-full font-bold text-lg shadow-lg transition-transform hover:-translate-y-1">
              Xem Chi Tiết Ưu Đãi
            </button>
          </div>
          
          <div className="relative">
             <div className="absolute -inset-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur-lg opacity-50"></div>
             <img 
               src="https://images.unsplash.com/photo-1540541338287-41700207dee6?q=80&w=2070&auto=format&fit=crop" 
               alt="Spa Promotion" 
               className="relative rounded-2xl shadow-2xl w-full object-cover transform rotate-2 hover:rotate-0 transition-all duration-500"
             />
          </div>
        </div>
      </div>
    </section>
  );
}