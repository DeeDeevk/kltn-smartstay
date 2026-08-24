import { useNavigate, useSearchParams } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import Header from '../layout/Header';
import Footer from '../layout/Footer';

export default function PaymentCancelPage() {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <XCircle size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Đã hủy thanh toán</h1>
            <p className="text-gray-500 mt-2">
              Bạn đã hủy giao dịch thanh toán{bookingId ? ` cho đơn ${bookingId.slice(0, 8).toUpperCase()}` : ''}. Đơn đặt phòng vẫn được giữ, bạn có thể thanh toán lại bất cứ lúc nào trong lịch sử đặt phòng.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-colors"
            >
              Về trang chủ
            </button>
            <button
              onClick={() => navigate('/user/historybooking')}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              Lịch sử đặt phòng
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
