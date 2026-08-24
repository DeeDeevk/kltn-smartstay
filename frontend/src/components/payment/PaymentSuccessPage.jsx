import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Clock, Loader2, XCircle } from 'lucide-react';
import Header from '../layout/Header';
import Footer from '../layout/Footer';
import { useLazySyncPayOSStatusQuery } from '../../services/payment';

// PayOS chuyển trình duyệt khách về đây sau khi thanh toán xong. Vì webhook thật
// của PayOS không gọi được tới localhost khi dev, trang này chủ động gọi API
// "sync" để backend tự hỏi lại PayOS trạng thái mới nhất của đơn.
export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  const navigate = useNavigate();
  const [syncStatus, { data: booking, isFetching, error }] = useLazySyncPayOSStatusQuery();

  useEffect(() => {
    if (bookingId) syncStatus(bookingId);
  }, [bookingId, syncStatus]);

  const isPaid = booking?.paymentStatus === 'PAID';

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-6">
          {isFetching && (
            <>
              <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
                <Loader2 size={32} className="animate-spin" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Đang xác nhận thanh toán...</h1>
            </>
          )}

          {!isFetching && !error && isPaid && (
            <>
              <div className="w-16 h-16 rounded-full bg-green-50 text-green-600 flex items-center justify-center mx-auto">
                <CheckCircle2 size={32} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Thanh toán thành công!</h1>
                <p className="text-gray-500 mt-2">
                  Đơn đặt phòng <span className="font-mono font-bold text-blue-600">{bookingId?.slice(0, 8).toUpperCase()}</span> đã được xác nhận.
                </p>
              </div>
            </>
          )}

          {!isFetching && !error && !isPaid && booking && (
            <>
              <div className="w-16 h-16 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
                <Clock size={32} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Chưa ghi nhận thanh toán</h1>
                <p className="text-gray-500 mt-2">
                  Giao dịch có thể đang được xử lý. Nếu bạn đã chuyển khoản thành công, vui lòng đợi ít phút rồi kiểm tra lại trong lịch sử đặt phòng.
                </p>
              </div>
            </>
          )}

          {!isFetching && error && (
            <>
              <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
                <XCircle size={32} />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Không thể kiểm tra trạng thái thanh toán</h1>
              <p className="text-gray-500">{error?.data?.message || 'Vui lòng kiểm tra lại trong lịch sử đặt phòng.'}</p>
            </>
          )}

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
