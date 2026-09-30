import { useEffect, useRef, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Bell, Loader2 } from 'lucide-react';
import { useSocket } from '../../context/SocketContext';
import {
  notificationApi,
  useGetMyNotificationsQuery,
  useGetUnreadNotificationCountQuery,
  useMarkAllNotificationsReadMutation,
} from '../../services/notification';
import {
  TYPE_DOT_CLASSES,
  timeAgo,
  useOpenNotification,
} from '../notification/notificationUtils';

// Chuông chỉ xem nhanh vài thông báo mới nhất, đầy đủ thì bấm "Xem tất cả".
const PREVIEW_COUNT = 8;

export default function NotificationBell() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const socket = useSocket();
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  const { data, isFetching } = useGetMyNotificationsQuery({ page: 1 });
  const { data: unread } = useGetUnreadNotificationCountQuery();
  const [markAllRead, { isLoading: markingAll }] = useMarkAllNotificationsReadMutation();
  const openNotification = useOpenNotification(() => setOpen(false));

  const items = (data?.data ?? []).slice(0, PREVIEW_COUNT);
  const unreadCount = unread?.count ?? 0;

  // Lễ tân xác nhận/huỷ đơn ở phía họ -> khách thấy thông báo ngay, không phải F5.
  useEffect(() => {
    const handleNew = () => {
      dispatch(notificationApi.util.invalidateTags(['Notification']));
    };
    socket.on('notification:new', handleNew);
    return () => socket.off('notification:new', handleNew);
  }, [socket, dispatch]);

  // Bấm ra ngoài thì đóng bảng. Dùng 'mousedown' chứ không phải 'click': nếu dùng
  // click, thao tác bấm vào một dòng thông báo sẽ bị đóng bảng trước khi onClick của
  // dòng đó kịp chạy.
  useEffect(() => {
    if (!open) return undefined;
    const handleOutside = (event) => {
      if (!panelRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [open]);



  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Thông báo"
        className="relative flex h-10 w-10 items-center justify-center rounded-full text-gray-600 transition-colors hover:bg-gray-100 hover:text-blue-600"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl anim-dropdown-in">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
            <span className="font-bold text-gray-900">Thông báo</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => markAllRead()}
                disabled={markingAll}
                className="text-xs font-semibold text-blue-600 hover:text-blue-700 disabled:opacity-60"
              >
                Đánh dấu đã đọc hết
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto modal-scroll">
            {isFetching && items.length === 0 && (
              <div className="flex justify-center py-10 text-gray-300">
                <Loader2 className="animate-spin" size={22} />
              </div>
            )}

            {!isFetching && items.length === 0 && (
              <p className="px-4 py-10 text-center text-sm text-gray-400">
                Bạn chưa có thông báo nào.
              </p>
            )}

            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openNotification(item)}
                className={`flex w-full gap-3 border-b border-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-50 ${
                  item.isRead ? '' : 'bg-blue-50/40'
                }`}
              >
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                    TYPE_DOT_CLASSES[item.type] ?? 'bg-gray-300'
                  }`}
                />
                <span className="min-w-0 flex-1">
                  <span
                    className={`block text-sm ${
                      item.isRead ? 'font-medium text-gray-700' : 'font-bold text-gray-900'
                    }`}
                  >
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">
                    {item.body}
                  </span>
                  <span className="mt-1 block text-[11px] text-gray-400">
                    {timeAgo(item.createdAt)}
                  </span>
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate('/user/notifications');
            }}
            className="block w-full border-t border-gray-100 py-2.5 text-center text-sm font-semibold text-blue-600 transition-colors hover:bg-gray-50"
          >
            Xem tất cả
          </button>
        </div>
      )}
    </div>
  );
}
