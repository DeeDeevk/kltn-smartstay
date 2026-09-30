import { useState } from 'react';
import { CheckCheck, Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import Header from '../layout/Header';
import Footer from '../layout/Footer';
import {
  useGetMyNotificationsQuery,
  useGetUnreadNotificationCountQuery,
  useMarkAllNotificationsReadMutation,
} from '../../services/notification';
import {
  TYPE_DOT_CLASSES,
  timeAgo,
  useOpenNotification,
} from '../notification/notificationUtils';

// Phải khớp PAGE_SIZE cố định ở NotificationService (backend) — dùng để tính số trang.
const PAGE_SIZE = 20;

// Toàn bộ thông báo của khách, có phân trang. Chuông trên header chỉ hiện trang đầu;
// đây là nơi xem lại lịch sử cũ hơn.
export default function NotificationsPage() {
  const [page, setPage] = useState(1);

  const { data, isFetching, error } = useGetMyNotificationsQuery({ page });
  const { data: unread } = useGetUnreadNotificationCountQuery();
  const [markAllRead, { isLoading: markingAll }] = useMarkAllNotificationsReadMutation();
  const openNotification = useOpenNotification();

  const items = data?.data ?? [];
  const unreadCount = unread?.count ?? 0;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleMarkAll = async () => {
    try {
      await markAllRead().unwrap();
      toast.success('Đã đánh dấu tất cả là đã đọc');
    } catch (err) {
      toast.error(err?.data?.message || 'Không thể đánh dấu đã đọc');
    }
  };


  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="mx-auto max-w-3xl px-4 pb-16 pt-28 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Thông báo</h1>
            <p className="mt-1 text-sm text-gray-500">
              {unreadCount > 0 ? `${unreadCount} thông báo chưa đọc` : 'Bạn đã đọc hết thông báo'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleMarkAll}
            disabled={markingAll || unreadCount === 0}
            className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {markingAll ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={16} />}
            Đánh dấu đã đọc tất cả
          </button>
        </div>

        {isFetching && items.length === 0 && (
          <div className="flex justify-center py-16 text-gray-300">
            <Loader2 className="animate-spin" size={28} />
          </div>
        )}

        {!isFetching && error && (
          <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-center text-sm text-red-600">
            {error?.data?.message || 'Không thể tải thông báo'}
          </div>
        )}

        {!error && !isFetching && items.length === 0 && (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-400">
            Bạn chưa có thông báo nào.
          </div>
        )}

        {items.length > 0 && (
          <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => openNotification(item)}
                  className={`flex w-full gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50 ${
                    item.isRead ? '' : 'bg-blue-50/40'
                  }`}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      item.isRead ? 'bg-gray-200' : TYPE_DOT_CLASSES[item.type] ?? 'bg-gray-300'
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-3">
                      <span
                        className={`text-sm ${
                          item.isRead ? 'font-medium text-gray-700' : 'font-bold text-gray-900'
                        }`}
                      >
                        {item.title}
                      </span>
                      <span className="shrink-0 text-xs text-gray-400">
                        {timeAgo(item.createdAt)}
                      </span>
                    </span>
                    <span className="mt-1 block text-sm leading-relaxed text-gray-500 wrap-anywhere">
                      {item.body}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm">
            <span className="text-gray-500">
              Trang {page}/{totalPages} · {total} thông báo
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => p - 1)}
                disabled={page <= 1 || isFetching}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Trước
              </button>
              <button
                type="button"
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages || isFetching}
                className="rounded-lg border border-gray-200 bg-white px-4 py-2 font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Sau
              </button>
            </div>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
