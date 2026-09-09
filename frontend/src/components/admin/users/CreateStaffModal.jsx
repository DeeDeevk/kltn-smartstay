import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import Modal from '../../common/Modal';
import { useCreateStaffMutation } from '../../../services/user';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const EMPTY_FORM = {
  fullName: '',
  email: '',
  phone: '',
  idNumber: '',
  address: '',
};

const inputClass =
  'w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';
const labelClass = 'mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500';

function validate({ fullName, email }) {
  if (!fullName.trim()) return 'Vui lòng nhập họ và tên';
  if (!EMAIL_REGEX.test(email)) return 'Email không hợp lệ';
  return null;
}

function getCreateStaffErrorMessage(err) {
  if (err.status === 409) {
    return err.message || 'Email hoặc số điện thoại đã được sử dụng';
  }
  if (err.status === 400) {
    return err.message || 'Thông tin nhân viên không hợp lệ';
  }
  return err.message || 'Không thể tạo tài khoản nhân viên, vui lòng thử lại';
}

// Modal "Thêm nhân viên" — chỉ nhập các trường chính của User (không nhập mật
// khẩu): backend tự sinh mật khẩu tạm và gửi qua email cho nhân viên, kèm yêu
// cầu bắt buộc đổi mật khẩu ở lần đăng nhập đầu tiên.
export default function CreateStaffModal({ open, onClose }) {
  const [createStaff, { isLoading }] = useCreateStaffMutation();
  const [form, setForm] = useState(EMPTY_FORM);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleClose = () => {
    if (isLoading) return;
    setForm(EMPTY_FORM);
    onClose();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationError = validate(form);
    if (validationError) {
      toast.error(validationError);
      return;
    }

    try {
      await createStaff({
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim() || undefined,
        idNumber: form.idNumber.trim() || undefined,
        address: form.address.trim() || undefined,
      }).unwrap();
      toast.success(`Đã tạo tài khoản nhân viên và gửi mật khẩu đăng nhập tới ${form.email.trim()}`);
      setForm(EMPTY_FORM);
      onClose();
    } catch (err) {
      toast.error(getCreateStaffErrorMessage(err));
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Thêm nhân viên">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Họ và tên</label>
          <input
            type="text"
            value={form.fullName}
            onChange={handleChange('fullName')}
            className={inputClass}
            placeholder="Nguyễn Văn A"
            autoFocus
          />
        </div>

        <div>
          <label className={labelClass}>Email</label>
          <input
            type="email"
            value={form.email}
            onChange={handleChange('email')}
            className={inputClass}
            placeholder="nhanvien@vikahotel.com"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Số điện thoại</label>
            <input
              type="tel"
              value={form.phone}
              onChange={handleChange('phone')}
              className={inputClass}
              placeholder="0912345678"
            />
          </div>
          <div>
            <label className={labelClass}>CCCD/CMND</label>
            <input
              type="text"
              value={form.idNumber}
              onChange={handleChange('idNumber')}
              className={inputClass}
              placeholder="Không bắt buộc"
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Địa chỉ</label>
          <input
            type="text"
            value={form.address}
            onChange={handleChange('address')}
            className={inputClass}
            placeholder="Không bắt buộc"
          />
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-70"
          >
            Hủy
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading && <Loader2 className="animate-spin" size={16} />}
            {isLoading ? 'Đang tạo...' : 'Tạo nhân viên'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
