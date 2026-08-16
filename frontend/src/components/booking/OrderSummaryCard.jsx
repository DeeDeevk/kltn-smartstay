const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop';

const formatCurrency = (amount) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount).replace('₫', 'đ');

const formatDate = (date) =>
  new Date(date).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });

export default function OrderSummaryCard({ room, startDate, endDate, nights, totalPrice }) {
  const pricePerNight = totalPrice / nights;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
      <h2 className="font-bold text-lg text-gray-900">Chi tiết đặt phòng</h2>

      <div className="flex gap-4">
        <img
          src={room.images?.[0]?.url || FALLBACK_IMAGE}
          alt={room.name}
          className="w-20 h-20 rounded-lg object-cover shrink-0"
        />
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{room.name}</p>
          <p className="text-sm text-gray-500 mt-1">{nights} đêm</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm border-y border-gray-100 py-4">
        <div>
          <p className="text-gray-400 text-xs uppercase font-bold mb-1">Nhận phòng</p>
          <p className="font-semibold text-gray-800">{formatDate(startDate)}</p>
        </div>
        <div>
          <p className="text-gray-400 text-xs uppercase font-bold mb-1">Trả phòng</p>
          <p className="font-semibold text-gray-800">{formatDate(endDate)}</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm text-gray-600">
          <span>{formatCurrency(pricePerNight)} x {nights} đêm</span>
          <span>{formatCurrency(totalPrice)}</span>
        </div>
        <div className="flex justify-between items-center pt-3 border-t border-gray-100">
          <span className="font-bold text-gray-900">Tổng cộng</span>
          <span className="font-bold text-blue-600 text-lg">{formatCurrency(totalPrice)}</span>
        </div>
      </div>
    </div>
  );
}
