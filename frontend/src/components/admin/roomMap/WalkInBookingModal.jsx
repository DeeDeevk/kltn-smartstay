import { useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Loader2 } from 'lucide-react';
import Modal from '../../common/Modal';
import { useCreateWalkInBookingMutation } from '../../../services/booking';
import formatCurrency from '../../../utils/formatCurrency';

const EMPTY = {
  fullName: '',
  phone: '',
  email: '',
  checkIn: '',
  checkOut: '',
  paymentMethod: 'CASH',
};

function nightsBetween(checkIn, checkOut) {
  if (!checkIn || !checkOut) return 0;
  const diff = (new Date(checkOut) - new Date(checkIn)) / 86_400_000;
  return diff > 0 ? Math.round(diff) : 0;
}

// Lễ tân đặt phòng hộ khách vãng lai cho đúng phòng đang xem.
export default function WalkInBookingModal({ open, onClose, room }) {
  const [form, setForm] = useState(EMPTY);
  const [createWalkIn, { isLoading }] = useCreateWalkInBookingMutation();

  const nights = useMemo(
    () => nightsBetween(form.checkIn, form.checkOut),
    [form.checkIn, form.checkOut],
  );
  const estimate = nights * (room?.roomType?.basePrice ?? 0);

  const update = (patch) => setForm((f) => ({ ...f, ...patch }));

  const submit = async (e) => {
    e.preventDefault();
    if (nights <= 0) {
      toast.error('Ngày check-out phải sau ngày check-in');
      return;
    }
    try {
      await createWalkIn({
        roomId: room.roomId,
        checkIn: form.checkIn,
        checkOut: form.checkOut,
        paymentMethod: form.paymentMethod,
        guestInfo: {
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          email: form.email.trim() || undefined,
        },
      }).unwrap();
      toast.success('Đã tạo đơn đặt phòng cho khách');
      setForm(EMPTY);
      onClose();
    } catch (err) {
      toast.error(err?.data?.message || 'Không thể tạo đơn đặt phòng');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Tạo đặt phòng — P.${room?.roomNumber ?? ''}`}
      size="lg"
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Tên khách" required>
            <input
              required
              value={form.fullName}
              onChange={(e) => update({ fullName: e.target.value })}
              className={inputCls}
              placeholder="Nguyễn Văn A"
            />
          </Field>
          <Field label="Số điện thoại" required>
            <input
              required
              value={form.phone}
              onChange={(e) => update({ phone: e.target.value })}
              className={inputCls}
              placeholder="09xxxxxxxx"
            />
          </Field>
        </div>

        <Field label="Email (không bắt buộc)">
          <input
            type="email"
            value={form.email}
            onChange={(e) => update({ email: e.target.value })}
            className={inputCls}
            placeholder="example@gmail.com"
          />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Ngày check-in" required>
            <input
              type="date"
              required
              value={form.checkIn}
              max={form.checkOut || undefined}
              onChange={(e) => update({ checkIn: e.target.value })}
              className={inputCls}
            />
          </Field>
          <Field label="Ngày check-out" required>
            <input
              type="date"
              required
              value={form.checkOut}
              min={form.checkIn || undefined}
              onChange={(e) => update({ checkOut: e.target.value })}
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="Hình thức thanh toán">
          <select
            value={form.paymentMethod}
            onChange={(e) => update({ paymentMethod: e.target.value })}
            className={inputCls}
          >
            <option value="CASH">Tiền mặt</option>
            <option value="PAYOS">Chuyển khoản (PayOS)</option>
          </select>
        </Field>

        <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm">
          <span className="text-gray-500">
            {nights > 0 ? `${nights} đêm × ${formatCurrency(room?.roomType?.basePrice ?? 0)}` : 'Chọn ngày để tính tiền phòng'}
          </span>
          <span className="text-base font-bold text-blue-600">
            {formatCurrency(estimate)}
          </span>
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
          >
            Huỷ
          </button>
          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {isLoading && <Loader2 size={15} className="animate-spin" />}
            Tạo đơn
          </button>
        </div>
      </form>
    </Modal>
  );
}

const inputCls =
  'w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';

function Field({ label, required, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-500">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
