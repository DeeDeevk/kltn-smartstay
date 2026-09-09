import { useEffect, useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import { toast } from 'react-toastify';
import Modal from '../../common/Modal';
import StatusBadge from '../../common/StatusBadge';
import { useGetUserQuery, useUpdateUserMutation } from '../../../services/user';

const ROLE_LABELS = {
  ADMIN: 'Quản trị viên',
  STAFF: 'Nhân viên',
  CUSTOMER: 'Khách hàng',
};

const PROVIDER_LABELS = {
  LOCAL: 'Email & mật khẩu',
  GOOGLE: 'Google',
};

const inputClass =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-right text-sm font-semibold text-gray-900">{value || '—'}</span>
    </div>
  );
}

function getUpdateErrorMessage(err) {
  if (err.status === 409) {
    return err.message || 'Số điện thoại đã được sử dụng';
  }
  return err.message || 'Không thể lưu thông tin nhân viên';
}

// Modal xem & chỉnh sửa 1 nhân viên. Chỉ dữ liệu đã có sẵn trong DB: thông tin cá
// nhân (sửa được), vai trò/trạng thái/ngày tạo/phương thức đăng nhập (chỉ xem —
// đã có luồng riêng để đổi vai trò/khóa-mở khóa ngay trên bảng danh sách).
export default function StaffDetailModal({ userId, onClose }) {
  const { data: staff, isFetching, error } = useGetUserQuery(userId, {
    skip: !userId,
  });
  const [updateUser, { isLoading: isSaving }] = useUpdateUserMutation();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);

  // Đóng modal hoặc mở nhân viên khác -> luôn quay về chế độ xem, tránh giữ form
  // dở dang của lần mở trước.
  useEffect(() => {
    setEditing(false);
    setForm(null);
  }, [userId]);

  const handleStartEdit = () => {
    setForm({
      fullName: staff.fullName || '',
      phone: staff.phone || '',
      idNumber: staff.idNumber || '',
      address: staff.address || '',
    });
    setEditing(true);
  };

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleCancelEdit = () => {
    setEditing(false);
    setForm(null);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.fullName.trim()) {
      toast.error('Vui lòng nhập họ và tên');
      return;
    }

    try {
      await updateUser({
        userId,
        data: {
          fullName: form.fullName.trim(),
          phone: form.phone.trim() || undefined,
          idNumber: form.idNumber.trim() || undefined,
          address: form.address.trim() || undefined,
        },
      }).unwrap();
      toast.success('Đã cập nhật thông tin nhân viên');
      setEditing(false);
      setForm(null);
    } catch (err) {
      toast.error(getUpdateErrorMessage(err));
    }
  };

  return (
    <Modal
      open={Boolean(userId)}
      onClose={editing ? handleCancelEdit : onClose}
      title={editing ? 'Chỉnh sửa nhân viên' : 'Thông tin nhân viên'}
    >
      {isFetching && (
        <div className="flex justify-center py-10 text-gray-400">
          <Loader2 className="animate-spin" size={24} />
        </div>
      )}

      {!isFetching && error && (
        <p className="py-6 text-center text-sm text-red-500">
          {error.message || 'Không thể tải thông tin nhân viên'}
        </p>
      )}

      {!isFetching && !error && staff && !editing && (
        <div>
          <div className="divide-y divide-gray-100">
            <InfoRow label="Họ và tên" value={staff.fullName} />
            <InfoRow label="Email" value={staff.email} />
            <InfoRow label="Số điện thoại" value={staff.phone} />
            <InfoRow label="CCCD/CMND" value={staff.idNumber} />
            <InfoRow label="Địa chỉ" value={staff.address} />
            <InfoRow label="Vai trò" value={ROLE_LABELS[staff.role] || staff.role} />
            <div className="flex items-center justify-between gap-4 py-2.5">
              <span className="text-sm text-gray-500">Trạng thái</span>
              <StatusBadge status={staff.status} />
            </div>
            <InfoRow
              label="Ngày tạo tài khoản"
              value={staff.createdAt ? new Date(staff.createdAt).toLocaleDateString('vi-VN') : null}
            />
            <InfoRow
              label="Phương thức đăng nhập"
              value={
                staff.authProviders?.length
                  ? staff.authProviders.map((p) => PROVIDER_LABELS[p] || p).join(', ')
                  : null
              }
            />
          </div>

          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={handleStartEdit}
              className="flex items-center gap-2 rounded-xl bg-blue-50 px-4 py-2 text-sm font-bold text-blue-600 transition-colors hover:bg-blue-100"
            >
              <Pencil size={14} /> Chỉnh sửa
            </button>
          </div>
        </div>
      )}

      {!isFetching && !error && staff && editing && form && (
        <form onSubmit={handleSave} className="space-y-4">
          <InfoRow label="Email" value={staff.email} />

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
              Họ và tên
            </label>
            <input
              type="text"
              value={form.fullName}
              onChange={handleChange('fullName')}
              className={inputClass}
              autoFocus
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
                Số điện thoại
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={handleChange('phone')}
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
                CCCD/CMND
              </label>
              <input
                type="text"
                value={form.idNumber}
                onChange={handleChange('idNumber')}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
              Địa chỉ
            </label>
            <input
              type="text"
              value={form.address}
              onChange={handleChange('address')}
              className={inputClass}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleCancelEdit}
              disabled={isSaving}
              className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-70"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving && <Loader2 className="animate-spin" size={16} />}
              {isSaving ? 'Đang lưu...' : 'Lưu thay đổi'}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
