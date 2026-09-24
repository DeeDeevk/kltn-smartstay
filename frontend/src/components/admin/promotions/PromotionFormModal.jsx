import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import Modal from '../../common/Modal';
import {
  useCreatePromotionMutation,
  useUpdatePromotionMutation,
} from '../../../services/promotion';
import { useGetAllRoomTypesQuery } from '../../../services/roomType';

// class-validator trả message dạng mảng khi nhiều trường cùng lỗi.
export function getErrorMessage(err, fallback) {
  const message = err?.data?.message ?? err?.message;
  if (Array.isArray(message)) return message.join(', ');
  return message || fallback;
}

const EMPTY_FORM = {
  code: '',
  description: '',
  discountType: 'PERCENTAGE',
  discountValue: '',
  startDate: '',
  endDate: '',
  maxUsage: '',
  minNights: '',
  minAdvanceDays: '',
  maxAdvanceDays: '',
  minAmount: '',
  stayFrom: '',
  stayTo: '',
  roomTypeIds: [],
};

// Mẫu dựng sẵn cho các loại khuyến mãi kinh điển của khách sạn — bấm vào là điền sẵn
// phần điều kiện, admin chỉ cần chỉnh lại con số. Chỉ đụng tới các ô điều kiện, không
// ghi đè mã/giá trị giảm admin đã nhập.
const PRESETS = [
  {
    label: 'Đặt sớm',
    hint: 'Đặt trước ngày nhận phòng ít nhất 14 ngày',
    conditions: { minAdvanceDays: '14', maxAdvanceDays: '', minNights: '' },
  },
  {
    label: 'Phút chót',
    hint: 'Đặt trong vòng 2 ngày trước ngày nhận phòng',
    conditions: { minAdvanceDays: '', maxAdvanceDays: '2', minNights: '' },
  },
  {
    label: 'Ở dài ngày',
    hint: 'Đơn từ 3 đêm trở lên',
    conditions: { minAdvanceDays: '', maxAdvanceDays: '', minNights: '3' },
  },
  {
    label: 'Không điều kiện',
    hint: 'Áp dụng cho mọi đơn',
    conditions: {
      minAdvanceDays: '',
      maxAdvanceDays: '',
      minNights: '',
      minAmount: '',
      stayFrom: '',
      stayTo: '',
    },
  },
];

// Chuỗi rỗng -> undefined để backend hiểu là "không đặt điều kiện này", thay vì nhận
// số 0 (0 đêm / 0đ là điều kiện có thật nhưng vô nghĩa).
function toNumber(value) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function toText(value) {
  const trimmed = String(value ?? '').trim();
  return trimmed || undefined;
}

export default function PromotionFormModal({ open, promotion, onClose }) {
  const isEdit = Boolean(promotion);
  const [form, setForm] = useState(EMPTY_FORM);
  const [createPromotion, { isLoading: isCreating }] = useCreatePromotionMutation();
  const [updatePromotion, { isLoading: isUpdating }] = useUpdatePromotionMutation();
  const { data: roomTypeData } = useGetAllRoomTypesQuery();
  const roomTypes = roomTypeData?.data ?? [];
  const isSaving = isCreating || isUpdating;

  useEffect(() => {
    if (!open) return;
    if (!promotion) {
      setForm(EMPTY_FORM);
      return;
    }
    const c = promotion.conditions ?? {};
    setForm({
      code: promotion.code,
      description: promotion.description ?? '',
      discountType: promotion.discountType,
      discountValue: String(promotion.discountValue),
      startDate: promotion.startDate,
      endDate: promotion.endDate,
      maxUsage: promotion.maxUsage === null ? '' : String(promotion.maxUsage),
      minNights: c.minNights ? String(c.minNights) : '',
      minAdvanceDays: c.minAdvanceDays === undefined ? '' : String(c.minAdvanceDays),
      maxAdvanceDays: c.maxAdvanceDays === undefined ? '' : String(c.maxAdvanceDays),
      minAmount: c.minAmount ? String(c.minAmount) : '',
      stayFrom: c.stayFrom ?? '',
      stayTo: c.stayTo ?? '',
      roomTypeIds: c.roomTypeIds ?? [],
    });
  }, [open, promotion]);

  const setField = (field) => (e) =>
    setForm((prev) => ({ ...prev, [field]: e.target.value }));

  const toggleRoomType = (roomTypeId) =>
    setForm((prev) => ({
      ...prev,
      roomTypeIds: prev.roomTypeIds.includes(roomTypeId)
        ? prev.roomTypeIds.filter((id) => id !== roomTypeId)
        : [...prev.roomTypeIds, roomTypeId],
    }));

  const applyPreset = (preset) =>
    setForm((prev) => ({ ...prev, ...preset.conditions }));

  const buildConditions = () => {
    const conditions = {
      minNights: toNumber(form.minNights),
      minAdvanceDays: toNumber(form.minAdvanceDays),
      maxAdvanceDays: toNumber(form.maxAdvanceDays),
      minAmount: toNumber(form.minAmount),
      stayFrom: toText(form.stayFrom),
      stayTo: toText(form.stayTo),
      roomTypeIds: form.roomTypeIds.length ? form.roomTypeIds : undefined,
    };
    const hasAny = Object.values(conditions).some((v) => v !== undefined);
    // null (không phải undefined) để khi SỬA, việc xoá hết điều kiện thực sự xoá được
    // cột conditions — undefined sẽ bị bỏ qua và điều kiện cũ còn nguyên.
    return hasAny ? conditions : null;
  };

  const handleSubmit = async () => {
    const discountValue = toNumber(form.discountValue);
    if (!form.code.trim() && !isEdit) {
      toast.error('Vui lòng nhập mã khuyến mãi');
      return;
    }
    if (!discountValue || discountValue < 1) {
      toast.error('Vui lòng nhập giá trị giảm lớn hơn 0');
      return;
    }
    if (form.discountType === 'PERCENTAGE' && discountValue > 100) {
      toast.error('Giảm theo phần trăm không được vượt quá 100');
      return;
    }
    if (!form.startDate || !form.endDate) {
      toast.error('Vui lòng chọn ngày bắt đầu và ngày kết thúc');
      return;
    }

    const payload = {
      description: toText(form.description) ?? '',
      discountType: form.discountType,
      discountValue,
      startDate: form.startDate,
      endDate: form.endDate,
      maxUsage: toNumber(form.maxUsage) ?? null,
      conditions: buildConditions(),
    };

    try {
      if (isEdit) {
        await updatePromotion({ promotionId: promotion.promotionId, data: payload }).unwrap();
        toast.success('Đã cập nhật khuyến mãi');
      } else {
        await createPromotion({ ...payload, code: form.code.trim().toUpperCase() }).unwrap();
        toast.success('Đã thêm khuyến mãi');
      }
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Không thể lưu khuyến mãi'));
    }
  };

  // focus:border-transparent là bắt buộc, không phải trang trí: ring của Tailwind là
  // box-shadow vẽ NGOÀI viền, nên nếu giữ nguyên viền xám thì lúc focus sẽ thấy hai
  // đường viền chồng nhau (xám trong, xanh ngoài) trông như viền bị hỏng/bị cắt.
  const inputClass =
    'w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const labelClass = 'mb-1.5 block font-semibold text-gray-700';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Sửa khuyến mãi ${promotion?.code ?? ''}` : 'Thêm khuyến mãi'}
      size="lg"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded-xl px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-70"
          >
            Hủy
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSaving}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-70"
          >
            {isSaving && <Loader2 size={16} className="animate-spin" />}
            {isEdit ? 'Lưu thay đổi' : 'Thêm khuyến mãi'}
          </button>
        </>
      }
    >
      <div className="space-y-5 text-sm">
        <section className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 [&>div]:min-w-0">
            <div>
              <label className={labelClass}>Mã khuyến mãi</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
                }
                disabled={isEdit}
                maxLength={30}
                placeholder="VD: HE2026"
                className={`${inputClass} font-mono tracking-wide disabled:bg-gray-100 disabled:text-gray-500`}
                autoFocus={!isEdit}
              />
              {isEdit && (
                <p className="mt-1 text-xs text-gray-400">
                  Không sửa được mã sau khi tạo — các đơn cũ đang tham chiếu tới mã này.
                </p>
              )}
            </div>
            <div>
              <label className={labelClass}>Giới hạn lượt dùng</label>
              <input
                type="number"
                min={1}
                value={form.maxUsage}
                onChange={setField('maxUsage')}
                placeholder="Để trống = không giới hạn"
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Mô tả</label>
            <input
              type="text"
              value={form.description}
              onChange={setField('description')}
              placeholder="VD: Giảm 15% cho khách đặt sớm mùa hè"
              className={inputClass}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 [&>div]:min-w-0">
            <div>
              <label className={labelClass}>Kiểu giảm</label>
              <select
                value={form.discountType}
                onChange={setField('discountType')}
                className={inputClass}
              >
                <option value="PERCENTAGE">Theo phần trăm (%)</option>
                <option value="FIXED">Số tiền cố định (đ)</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>
                Giá trị giảm {form.discountType === 'PERCENTAGE' ? '(%)' : '(đ)'}
              </label>
              <input
                type="number"
                min={1}
                max={form.discountType === 'PERCENTAGE' ? 100 : undefined}
                value={form.discountValue}
                onChange={setField('discountValue')}
                placeholder={form.discountType === 'PERCENTAGE' ? '15' : '200000'}
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 [&>div]:min-w-0">
            <div>
              <label className={labelClass}>Bắt đầu nhận đặt</label>
              <input
                type="date"
                value={form.startDate}
                onChange={setField('startDate')}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Kết thúc nhận đặt</label>
              <input
                type="date"
                value={form.endDate}
                onChange={setField('endDate')}
                className={inputClass}
              />
            </div>
          </div>
          <p className="-mt-2 text-xs text-gray-400">
            Đây là khoảng thời gian khách được <strong>đặt</strong> bằng mã này, khác với kỳ
            lưu trú ở phần điều kiện bên dưới.
          </p>
        </section>

        <section className="space-y-4 rounded-xl border border-gray-200 bg-gray-50/60 p-4">
          <div>
            <h3 className="font-bold text-gray-800">Điều kiện áp dụng</h3>
            <p className="mt-0.5 text-xs text-gray-500">
              Bỏ trống hết = mã áp dụng cho mọi đơn. Giá trị giảm luôn tính trên tiền phòng.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => applyPreset(preset)}
                title={preset.hint}
                className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
              >
                {preset.label}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 [&>div]:min-w-0">
            <div>
              <label className={labelClass}>Số đêm tối thiểu</label>
              <input
                type="number"
                min={1}
                value={form.minNights}
                onChange={setField('minNights')}
                placeholder="VD: 3"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Đơn tối thiểu (đ)</label>
              <input
                type="number"
                min={0}
                value={form.minAmount}
                onChange={setField('minAmount')}
                placeholder="VD: 2000000"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Đặt trước ít nhất (ngày)</label>
              <input
                type="number"
                min={0}
                value={form.minAdvanceDays}
                onChange={setField('minAdvanceDays')}
                placeholder="Đặt sớm — VD: 14"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Đặt trong vòng (ngày)</label>
              <input
                type="number"
                min={0}
                value={form.maxAdvanceDays}
                onChange={setField('maxAdvanceDays')}
                placeholder="Phút chót — VD: 2"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Kỳ lưu trú từ</label>
              <input
                type="date"
                value={form.stayFrom}
                onChange={setField('stayFrom')}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Kỳ lưu trú đến hết</label>
              <input
                type="date"
                value={form.stayTo}
                onChange={setField('stayTo')}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Chỉ áp dụng cho loại phòng</label>
            {roomTypes.length === 0 ? (
              <p className="text-xs text-gray-400">Chưa có loại phòng nào.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {roomTypes.map((roomType) => {
                  const selected = form.roomTypeIds.includes(roomType.roomTypeId);
                  return (
                    <button
                      key={roomType.roomTypeId}
                      type="button"
                      onClick={() => toggleRoomType(roomType.roomTypeId)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        selected
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {roomType.name}
                    </button>
                  );
                })}
              </div>
            )}
            <p className="mt-1.5 text-xs text-gray-400">
              Không chọn loại nào = áp dụng cho tất cả loại phòng.
            </p>
          </div>
        </section>
      </div>
    </Modal>
  );
}
