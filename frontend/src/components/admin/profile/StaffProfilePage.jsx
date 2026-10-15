import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  BadgeCheck,
  CalendarDays,
  IdCard,
  Loader2,
  Mail,
  MapPin,
  Phone,
  Save,
  ShieldCheck,
  User,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import ChangePasswordForm from '../../user/ChangePasswordForm';

const ROLE_LABELS = { ADMIN: 'Quản trị viên', STAFF: 'Nhân viên' };

const ROLE_BADGE = {
  ADMIN: 'bg-violet-50 text-violet-700 ring-violet-200',
  STAFF: 'bg-blue-50 text-blue-700 ring-blue-200',
};

// Trạng thái tài khoản trả về từ backend là 'Active' / 'Locked' (UserStatus).
const STATUS_INFO = {
  Active: { label: 'Đang hoạt động', className: 'bg-green-50 text-green-700 ring-green-200' },
  Locked: { label: 'Đã khoá', className: 'bg-red-50 text-red-700 ring-red-200' },
};

// "Trần Nguyễn Quốc Anh" -> "TA": chữ cái đầu của từ đầu và từ cuối, đủ để nhận ra
// người mà không tràn ô avatar với tên tiếng Việt 3-4 từ.
function getInitials(name) {
  const words = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function toForm(user) {
  return {
    name: user?.name ?? user?.fullName ?? '',
    phone: user?.phone ?? '',
    idNumber: user?.idNumber ?? '',
    address: user?.address ?? '',
  };
}

function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="flex items-start gap-3 py-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-400">
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-gray-400">{label}</p>
        <p className="mt-0.5 text-sm font-medium text-gray-800 wrap-anywhere">
          {value || <span className="text-gray-300">Chưa cập nhật</span>}
        </p>
      </div>
    </div>
  );
}

function Field({ icon: Icon, label, children, hint }) {
  return (
    <div>
      <label className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-gray-700">
        <Icon size={14} className="text-gray-400" />
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-400">{hint}</p>}
    </div>
  );
}

const inputClass =
  'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-800 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50 disabled:text-gray-500';

// Trang hồ sơ của chính admin/nhân viên đang đăng nhập — mở khi bấm vào khối tên ở
// cuối sidebar. Bên trái là thẻ tóm tắt (ai, vai trò, trạng thái); bên phải là phần
// sửa thông tin và đổi mật khẩu.
export default function StaffProfilePage() {
  const navigate = useNavigate();
  const { user, updateProfile } = useAuth();
  const [form, setForm] = useState(() => toForm(user));
  const [saving, setSaving] = useState(false);

  // user đến từ AuthContext có thể cập nhật sau lần render đầu (khôi phục phiên sau F5)
  // — đồng bộ lại form khi đổi người hoặc sau khi lưu.
  useEffect(() => {
    setForm(toForm(user));
  }, [user]);

  const displayName = user?.name || user?.fullName || 'Tài khoản';
  const role = user?.role;
  const status = STATUS_INFO[user?.status];
  const isDirty = JSON.stringify(form) !== JSON.stringify(toForm(user));

  const setField = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const payload = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      idNumber: form.idNumber.trim(),
      address: form.address.trim(),
    };
    if (!payload.name) {
      toast.error('Vui lòng nhập họ và tên');
      return;
    }
    if (payload.phone && !/^[0-9]{9,11}$/.test(payload.phone)) {
      toast.error('Số điện thoại phải gồm 9-11 chữ số');
      return;
    }
    // Nhân viên chỉ khai CCCD (không còn hộ chiếu) — CCCD gắn chip luôn là 12 chữ số.
    if (payload.idNumber && !/^[0-9]{12}$/.test(payload.idNumber)) {
      toast.error('Số CCCD phải gồm đúng 12 chữ số');
      return;
    }
    setSaving(true);
    try {
      await updateProfile(payload);
      toast.success('Đã cập nhật hồ sơ');
    } catch (err) {
      const message = err?.response?.data?.message;
      toast.error(
        (Array.isArray(message) ? message.join(', ') : message) || 'Không thể cập nhật hồ sơ',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Hồ sơ của tôi</h1>

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* ---- Cột trái: thẻ tóm tắt ---- */}
        <aside className="h-fit overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="h-20 bg-gradient-to-r from-blue-600 to-cyan-500" />
          <div className="-mt-10 px-6 pb-6 text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-blue-600 text-2xl font-bold text-white ring-4 ring-white shadow-md">
              {getInitials(displayName)}
            </div>
            <h2 className="mt-3 text-lg font-bold text-gray-900 wrap-anywhere">{displayName}</h2>
            <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
              {role && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${ROLE_BADGE[role] ?? 'bg-gray-50 text-gray-600 ring-gray-200'}`}
                >
                  <ShieldCheck size={12} />
                  {ROLE_LABELS[role] ?? role}
                </span>
              )}
              {status && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${status.className}`}
                >
                  <BadgeCheck size={12} />
                  {status.label}
                </span>
              )}
            </div>
          </div>

          <div className="divide-y divide-gray-100 border-t border-gray-100 px-6">
            <InfoRow icon={Mail} label="Email" value={user?.email} />
            <InfoRow icon={Phone} label="Số điện thoại" value={user?.phone} />
            <InfoRow icon={CalendarDays} label="Ngày tham gia" value={formatDate(user?.createdAt)} />
          </div>

          {role === 'STAFF' && (
            <div className="border-t border-gray-100 p-4">
              <button
                type="button"
                onClick={() => navigate('/admin/schedule/me')}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600"
              >
                <CalendarDays size={16} />
                Xem lịch làm việc
              </button>
            </div>
          )}
        </aside>

        {/* ---- Cột phải: sửa thông tin + đổi mật khẩu ---- */}
        <div className="min-w-0">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm md:p-8"
          >
            <div className="mb-6 flex items-center gap-2">
              <User size={18} className="text-gray-500" />
              <h2 className="text-lg font-bold text-gray-900">Thông tin cá nhân</h2>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 [&>div]:min-w-0">
              <Field icon={User} label="Họ và tên">
                <input
                  type="text"
                  value={form.name}
                  onChange={setField('name')}
                  maxLength={100}
                  className={inputClass}
                />
              </Field>
              {/* Email là định danh đăng nhập, đổi ở đây sẽ làm hỏng việc đăng nhập — chỉ
                  admin mới đổi được qua trang quản lý tài khoản. */}
              <Field icon={Mail} label="Email" hint="Liên hệ quản trị viên nếu cần đổi email.">
                <input type="email" value={user?.email ?? ''} disabled className={inputClass} />
              </Field>
              <Field icon={Phone} label="Số điện thoại">
                <input
                  type="tel"
                  inputMode="numeric"
                  value={form.phone}
                  onChange={setField('phone')}
                  maxLength={11}
                  placeholder="VD: 0912345678"
                  className={inputClass}
                />
              </Field>
              <Field icon={IdCard} label="CCCD">
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.idNumber}
                  onChange={setField('idNumber')}
                  maxLength={12}
                  placeholder="12 chữ số"
                  className={inputClass}
                />
              </Field>
              <div className="sm:col-span-2">
                <Field icon={MapPin} label="Địa chỉ">
                  <input
                    type="text"
                    value={form.address}
                    onChange={setField('address')}
                    maxLength={255}
                    className={inputClass}
                  />
                </Field>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-gray-100 pt-5">
              <button
                type="button"
                onClick={() => setForm(toForm(user))}
                disabled={!isDirty || saving}
                className="rounded-xl px-4 py-2.5 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Hoàn tác
              </button>
              <button
                type="submit"
                disabled={!isDirty || saving}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                Lưu thay đổi
              </button>
            </div>
          </form>

          <ChangePasswordForm />
        </div>
      </div>
    </>
  );
}
