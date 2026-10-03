import { useMemo, useState } from 'react';
import {
  Bell,
  BellOff,
  CalendarCheck,
  CalendarPlus,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock,
  Loader2,
  LogIn,
  LogOut,
  MessageSquareReply,
  Wallet,
  XCircle,
} from 'lucide-react';
import { toast } from 'react-toastify';
import {
  useGetMyNotificationsQuery,
  useGetUnreadNotificationCountQuery,
  useMarkAllNotificationsReadMutation,
} from '../../services/notification';
import {
  dayGroupLabel,
  formatClock,
  formatFullDateTime,
  formatNotificationBody,
  timeAgo,
  useOpenNotification,
} from './notificationUtils';

// Phải khớp PAGE_SIZE cố định ở NotificationService (backend) — dùng để tính số trang.
const PAGE_SIZE = 20;

// Icon, nhãn và màu theo loại thông báo. Tên loại khớp enum NotificationType ở backend.
const TYPE_META = {
  BOOKING_CREATED: { Icon: CalendarPlus, label: 'Đặt phòng', tone: 'bg-sky-100 text-sky-600' },
  BOOKING_CONFIRMED: { Icon: CalendarCheck, label: 'Đã xác nhận', tone: 'bg-blue-100 text-blue-600' },
  BOOKING_CANCELLED: { Icon: XCircle, label: 'Đã huỷ', tone: 'bg-red-100 text-red-600' },
  BOOKING_CHECKED_IN: { Icon: LogIn, label: 'Nhận phòng', tone: 'bg-emerald-100 text-emerald-600' },
  BOOKING_CHECKED_OUT: { Icon: LogOut, label: 'Trả phòng', tone: 'bg-slate-100 text-slate-600' },
  PAYMENT_SUCCESS: { Icon: Wallet, label: 'Thanh toán', tone: 'bg-emerald-100 text-emerald-600' },
  PAYMENT_FAILED: { Icon: CircleAlert, label: 'Thanh toán lỗi', tone: 'bg-red-100 text-red-600' },
  REVIEW_REPLIED: { Icon: MessageSquareReply, label: 'Đánh giá', tone: 'bg-amber-100 text-amber-600' },
  STAFF_NEW_BOOKING: { Icon: CalendarPlus, label: 'Đơn mới', tone: 'bg-blue-100 text-blue-600' },
};
const DEFAULT_META = { Icon: Bell, label: 'Thông báo', tone: 'bg-gray-100 text-gray-500' };

const FILTERS = [
  { key: 'all', label: 'Tất cả' },
  { key: 'unread', label: 'Chưa đọc' },
];

// Nội dung trang "Thông báo": một panel gồm tiêu đề + nút đánh dấu đã đọc, bộ lọc,
// danh sách gom theo ngày và phân trang. Dùng chung cho trang của khách (bọc
// header/footer của khách) và trang trong khu admin (nằm trong DashboardLayout).
export default function NotificationList() {
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState('all');

  const { data, isFetching, error } = useGetMyNotificationsQuery({
    page,
    ...(filter === 'unread' ? { isRead: false } : {}),
  });
  const { data: unread } = useGetUnreadNotificationCountQuery();
  const [markAllRead, { isLoading: markingAll }] = useMarkAllNotificationsReadMutation();
  const openNotification = useOpenNotification();

  const items = useMemo(() => data?.data ?? [], [data]);
  const unreadCount = unread?.count ?? 0;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Gom theo ngày ("Hôm nay", "Hôm qua", "08/10/2026") — mỗi dòng chỉ còn cần giờ.
  const groups = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      const label = dayGroupLabel(item.createdAt);
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(item);
    }
    return [...map];
  }, [items]);

  const changeFilter = (key) => {
    setFilter(key);
    setPage(1);
  };

  const handleMarkAll = async () => {
    try {
      await markAllRead().unwrap();
      // Không bật toast khi thành công: các dòng tự hết in đậm và số chưa đọc về 0 là
      // đủ thấy rồi. Chỉ báo khi lỗi.
    } catch (err) {
      toast.error(err?.data?.message || 'Không thể đánh dấu đã đọc');
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      {/* Đầu panel: tiêu đề, số chưa đọc, nút đánh dấu đã đọc */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 px-6 py-5">
        <div className="flex items-center gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-600 text-white shadow-sm shadow-blue-200">
            <Bell size={20} />
          </span>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Thông báo</h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {unreadCount > 0 ? (
                <>
                  Bạn có <span className="font-semibold text-blue-600">{unreadCount}</span> thông báo chưa đọc
                </>
              ) : (
                'Cập nhật về đặt phòng, thanh toán và đánh giá'
              )}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleMarkAll}
          disabled={markingAll || unreadCount === 0}
          className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none"
        >
          {markingAll ? <Loader2 size={16} className="animate-spin" /> : <CheckCheck size={16} />}
          Đánh dấu đã đọc tất cả
        </button>
      </div>

      {/* Thanh lọc */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-6 py-3">
        <div className="inline-flex rounded-xl bg-gray-100 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => changeFilter(f.key)}
              className={`flex items-center gap-2 rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                filter === f.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
              {f.key === 'unread' && unreadCount > 0 && (
                <span className="rounded-full bg-blue-600 px-1.5 text-[11px] font-bold leading-5 text-white">
                  {unreadCount > 99 ? '99+' : unreadCount}
                </span>
              )}
            </button>
          ))}
        </div>
        {total > 0 && <span className="text-sm text-gray-400">{total} thông báo</span>}
      </div>

      {isFetching && items.length === 0 && (
        <div className="flex justify-center py-20 text-gray-300">
          <Loader2 className="animate-spin" size={28} />
        </div>
      )}

      {!isFetching && error && (
        <div className="m-6 rounded-xl border border-red-100 bg-red-50 p-6 text-center text-sm text-red-600">
          {error?.data?.message || 'Không thể tải thông báo'}
        </div>
      )}

      {!error && !isFetching && items.length === 0 && (
        <div className="flex flex-col items-center px-6 py-20 text-center">
          <span className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100 text-gray-400">
            {filter === 'unread' ? <CheckCheck size={24} /> : <BellOff size={24} />}
          </span>
          <p className="font-semibold text-gray-700">
            {filter === 'unread' ? 'Không còn thông báo chưa đọc' : 'Bạn chưa có thông báo nào'}
          </p>
          <p className="mt-1 text-sm text-gray-400">Thông báo mới sẽ xuất hiện ở đây.</p>
        </div>
      )}

      <div className={`transition-opacity ${isFetching && items.length > 0 ? 'opacity-60' : ''}`}>
        {groups.map(([label, groupItems]) => (
          <section key={label}>
            <h2 className="flex items-center gap-2 bg-gray-50/80 px-6 py-2 text-xs font-bold uppercase tracking-wider text-gray-400">
              {label}
              <span className="font-semibold normal-case tracking-normal text-gray-300">· {groupItems.length}</span>
            </h2>
            <ul className="divide-y divide-gray-100">
              {groupItems.map((item) => {
                const { Icon, label: typeLabel, tone } = TYPE_META[item.type] ?? DEFAULT_META;
                const unreadItem = !item.isRead;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => openNotification(item)}
                      className={`relative flex w-full flex-col gap-3 px-6 py-4 text-left transition-colors sm:flex-row sm:items-start sm:gap-6 ${
                        unreadItem ? 'bg-blue-50/50 hover:bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      {unreadItem && <span className="absolute inset-y-0 left-0 w-1 bg-blue-500" aria-hidden />}

                      <span className="flex min-w-0 flex-1 gap-4">
                        <span
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                            unreadItem ? tone : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          <Icon size={20} />
                        </span>

                        <span className={`min-w-0 flex-1 ${unreadItem ? '' : 'opacity-75'}`}>
                          <span className="flex flex-wrap items-center gap-2">
                            <span
                              className={`text-[15px] leading-snug ${
                                unreadItem ? 'font-bold text-gray-900' : 'font-medium text-gray-700'
                              }`}
                            >
                              {item.title}
                            </span>
                            <span
                              className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                                unreadItem ? tone : 'bg-gray-100 text-gray-500'
                              }`}
                            >
                              {typeLabel}
                            </span>
                          </span>
                          <span className="mt-1 block text-sm leading-relaxed text-gray-500 wrap-anywhere">
                            {formatNotificationBody(item.body)}
                          </span>
                        </span>
                      </span>

                      {/* Thời gian: cột riêng bên phải trên màn rộng, xuống dưới nội dung trên màn hẹp */}
                      <span
                        className="flex shrink-0 items-center gap-2 pl-15 sm:w-36 sm:flex-col sm:items-end sm:gap-0.5 sm:pl-0 sm:text-right"
                        title={formatFullDateTime(item.createdAt)}
                      >
                        <span className="flex items-center gap-1.5 text-sm font-semibold text-gray-700">
                          {unreadItem && <span className="h-2 w-2 rounded-full bg-blue-500" aria-label="Chưa đọc" />}
                          <Clock size={13} className="text-gray-400" />
                          {formatClock(item.createdAt)}
                        </span>
                        <span className="text-xs text-gray-400">{timeAgo(item.createdAt)}</span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-4 text-sm">
          <span className="text-gray-500">
            Trang <span className="font-semibold text-gray-700">{page}</span>/{totalPages}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1 || isFetching}
              className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              <ChevronLeft size={16} /> Trước
            </button>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages || isFetching}
              className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50"
            >
              Sau <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
