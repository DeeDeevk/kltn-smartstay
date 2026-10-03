import NotificationList from '../../notification/NotificationList';

// Trang "Thông báo" trong khu admin/nhân viên (VD có khách đặt phòng mới). Nằm trong
// DashboardLayout nên giữ nguyên sidebar và header admin.
export default function AdminNotificationsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <NotificationList />
    </div>
  );
}
