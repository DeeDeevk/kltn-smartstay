import Header from '../layout/Header';
import Footer from '../layout/Footer';
import NotificationList from '../notification/NotificationList';

// Toàn bộ thông báo của khách, có phân trang. Chuông trên header chỉ hiện trang đầu;
// đây là nơi xem lại lịch sử cũ hơn.
export default function NotificationsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-28 sm:px-6 lg:px-8">
        <NotificationList />
      </main>
      <Footer />
    </div>
  );
}
