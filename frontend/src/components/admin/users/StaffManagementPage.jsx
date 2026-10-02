import { useState } from 'react';
import { Lock, Unlock, ChevronLeft, ChevronRight, Eye, UserPlus } from 'lucide-react';
import SearchInput from '../../common/SearchInput';
import Button from '../../common/Button';
import EmptyState from '../../common/EmptyState';
import { TableSkeletonRows } from '../../common/Skeleton';
import { selectClass } from '../../common/formStyles';
import { stagger } from '../../../utils/motion';
import { toast } from 'react-toastify';
import StatusBadge from '../../common/StatusBadge';
import ConfirmModal from '../../common/ConfirmModal';
import StaffDetailModal from './StaffDetailModal';
import CreateStaffModal from './CreateStaffModal';
import { useAuth } from '../../../context/AuthContext';
import {
  useGetUsersQuery,
  useUpdateUserRoleMutation,
  useUpdateUserStatusMutation,
} from '../../../services/user';

// Trang riêng cho quản lý NHÂN VIÊN — luôn lọc role=STAFF, tách khỏi trang
// "Quản lý tài khoản" (UserManagementPage) vốn gộp chung cả CUSTOMER/STAFF/ADMIN.
const ROLE_OPTIONS = [
  { value: 'STAFF', label: 'Nhân viên' },
  { value: 'ADMIN', label: 'Quản trị viên' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'Tất cả trạng thái' },
  { value: 'Active', label: 'Đang hoạt động' },
  { value: 'Locked', label: 'Đã bị khóa' },
];

const LIMIT = 10;

export default function StaffManagementPage() {
  const { user: currentUser } = useAuth();
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [lockTarget, setLockTarget] = useState(null);
  const [detailUserId, setDetailUserId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isFetching, error } = useGetUsersQuery({
    role: 'STAFF',
    status: status || undefined,
    search: search || undefined,
    page,
    limit: LIMIT,
  });

  const [updateUserRole] = useUpdateUserRoleMutation();
  const [updateUserStatus, { isLoading: isTogglingStatus }] = useUpdateUserStatusMutation();

  const staffList = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput.trim());
  };

  const handleStatusFilterChange = (e) => {
    setPage(1);
    setStatus(e.target.value);
  };

  const handleRoleChange = async (targetUser, newRole) => {
    if (newRole === targetUser.role) return;
    try {
      await updateUserRole({ userId: targetUser.userId, role: newRole }).unwrap();
      toast.success(`Đã cập nhật vai trò của ${targetUser.fullName}`);
    } catch (err) {
      toast.error(err.message || 'Không thể cập nhật vai trò');
    }
  };

  const handleConfirmToggleStatus = async () => {
    if (!lockTarget) return;
    const nextStatus = lockTarget.status === 'Active' ? 'Locked' : 'Active';
    try {
      await updateUserStatus({ userId: lockTarget.userId, status: nextStatus }).unwrap();
      toast.success(
        nextStatus === 'Locked'
          ? `Đã khóa tài khoản ${lockTarget.fullName}`
          : `Đã mở khóa tài khoản ${lockTarget.fullName}`,
      );
      setLockTarget(null);
    } catch (err) {
      toast.error(err.message || 'Không thể cập nhật trạng thái tài khoản');
    }
  };

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Quản lý nhân viên</h1>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2">
            <SearchInput
              className="w-72"
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Tìm theo tên, email, SĐT..."
            />
            <Button type="submit" variant="secondary">
              Tìm
            </Button>
          </form>

          <select
            value={status}
            onChange={handleStatusFilterChange}
            className={selectClass}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <Button icon={UserPlus} onClick={() => setCreateOpen(true)}>
          Thêm nhân viên
        </Button>
      </div>

      <div
        className={`overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm transition-opacity duration-200 ${
          isFetching && staffList.length > 0 ? 'opacity-60' : ''
        }`}
      >
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-gray-50 text-xs font-bold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Họ và tên</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">SĐT</th>
              <th className="px-4 py-3">Vai trò</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3 text-right">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isFetching && staffList.length === 0 && <TableSkeletonRows rows={8} cols={6} />}

            {!isFetching && error && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-red-500">
                  {error.message || 'Không thể tải danh sách nhân viên'}
                </td>
              </tr>
            )}

            {!isFetching && !error && staffList.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    title="Không có nhân viên nào phù hợp"
                    description="Thử đổi từ khoá hoặc bộ lọc."
                  />
                </td>
              </tr>
            )}

            {!error &&
              staffList.map((rowUser, index) => {
                const isSelf = rowUser.userId === currentUser?.userId;
                return (
                  <tr
                    key={rowUser.userId}
                    style={stagger(index, 30, 8)}
                    className="anim-fade-in transition-colors hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 font-semibold text-gray-900">{rowUser.fullName}</td>
                    <td className="px-4 py-3 text-gray-600">{rowUser.email}</td>
                    <td className="px-4 py-3 text-gray-600">{rowUser.phone || '—'}</td>
                    <td className="px-4 py-3">
                      <select
                        value={rowUser.role}
                        onChange={(e) => handleRoleChange(rowUser, e.target.value)}
                        disabled={isSelf}
                        className="rounded-lg border border-gray-200 px-2 py-1.5 text-sm disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-400"
                        title={isSelf ? 'Không thể tự đổi vai trò của chính mình' : undefined}
                      >
                        {ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={rowUser.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setDetailUserId(rowUser.userId)}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-bold text-blue-600 transition-colors hover:bg-blue-100"
                        >
                          <Eye size={14} /> Xem chi tiết
                        </button>
                        <button
                          type="button"
                          onClick={() => setLockTarget(rowUser)}
                          disabled={isSelf}
                          title={isSelf ? 'Không thể tự khóa tài khoản của chính mình' : undefined}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
                            rowUser.status === 'Active'
                              ? 'bg-red-50 text-red-600 hover:bg-red-100'
                              : 'bg-green-50 text-green-600 hover:bg-green-100'
                          }`}
                        >
                          {rowUser.status === 'Active' ? (
                            <>
                              <Lock size={14} /> Khóa
                            </>
                          ) : (
                            <>
                              <Unlock size={14} /> Mở khóa
                            </>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
        <span>Tổng {total} nhân viên</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-gray-200 p-1.5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          <span>
            Trang {page}/{totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-gray-200 p-1.5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      <ConfirmModal
        open={Boolean(lockTarget)}
        title={lockTarget?.status === 'Active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
        message={
          lockTarget?.status === 'Active'
            ? `Bạn có chắc muốn khóa tài khoản "${lockTarget?.fullName}"? Nhân viên này sẽ không thể đăng nhập cho đến khi được mở khóa lại.`
            : `Bạn có chắc muốn mở khóa tài khoản "${lockTarget?.fullName}"?`
        }
        confirmLabel={lockTarget?.status === 'Active' ? 'Khóa tài khoản' : 'Mở khóa'}
        danger={lockTarget?.status === 'Active'}
        loading={isTogglingStatus}
        onConfirm={handleConfirmToggleStatus}
        onClose={() => setLockTarget(null)}
      />

      <StaffDetailModal userId={detailUserId} onClose={() => setDetailUserId(null)} />

      <CreateStaffModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </>
  );
}
