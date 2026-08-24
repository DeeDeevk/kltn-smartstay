import { useNavigate, useSearchParams } from 'react-router-dom';
import { XCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import Header from '../layout/Header';
import Footer from '../layout/Footer';

export default function PaymentCancelPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const bookingId = searchParams.get('bookingId');
  const navigate = useNavigate();

  const forOrder = bookingId ? t('payment.cancel.forOrder', { bookingCode: bookingId.slice(0, 8).toUpperCase() }) : '';

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-lg mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-red-50 text-red-600 flex items-center justify-center mx-auto">
            <XCircle size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{t('payment.cancel.title')}</h1>
            <p className="text-gray-500 mt-2">
              {t('payment.cancel.message', { forOrder })}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-colors"
            >
              {t('payment.backHome')}
            </button>
            <button
              onClick={() => navigate('/user/historybooking')}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              {t('payment.bookingHistory')}
            </button>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
