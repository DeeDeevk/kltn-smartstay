import { useEffect, useState } from 'react';
import { BadgePercent, Check, Loader2, SlidersHorizontal, Ticket } from 'lucide-react';
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
      // Phải xoá cả loại phòng đã chọn, nếu không mẫu này ghi "áp dụng cho mọi đơn"
      // nhưng mã vẫn bị giới hạn theo loại phòng — nói một đằng làm một nẻo.
      roomTypeIds: [],
    },
  },
];

// Mẫu có được tô sáng hay không được SUY RA TỪ GIÁ TRỊ ĐANG CÓ trong form, chứ không
// lưu lại "vừa bấm nút nào". Nếu lưu nút vừa bấm thì bấm "Đặt sớm" rồi tự sửa 14 thành
// 20, nút vẫn sáng trong khi điều kiện đã khác hẳn — dấu hiệu sai còn tệ hơn không có.
// Cách này cũng tự tô sáng đúng mẫu khi mở form sửa một mã cũ.
function matchesPreset(form, preset) {
  return Object.entries(preset.conditions).every(([field, value]) => {
    if (Array.isArray(value)) return (form[field] ?? []).length === value.length;
    return String(form[field] ?? '') === value;
  });
}

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

// Hôm nay theo GIỜ MÁY của admin, dạng 'YYYY-MM-DD'. Không dùng toISOString() vì nó
// quy về UTC — ở Việt Nam (UTC+7) trước 7h sáng sẽ trả về ngày hôm qua, khiến ô chọn
// lịch cho chọn nhầm một ngày đã qua.
// Tiêu đề cho từng nhóm trường trong form.
// Không có dòng mô tả phụ thì căn giữa theo chiều dọc: badge cao 32px trong khi dòng
// tiêu đề chỉ ~24px, căn theo mép trên sẽ làm badge thò xuống dưới chữ. Có mô tả phụ
// thì khối chữ cao hơn badge nên phải bám mép trên.
function SectionTitle({ icon: Icon, title, hint }) {
  return (
    <div className={`flex gap-3 ${hint ? 'items-start' : 'items-center'}`}>
      {/* leading-none: bỏ line-height mặc định để ô vuông không tính thêm khoảng đệm
          dòng chữ, nhờ vậy icon nằm đúng tâm ô. */}
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 leading-none text-blue-600">
        <Icon size={16} />
      </span>
      <div>
        <h4 className="font-bold text-gray-900">{title}</h4>
        {hint && <p className="mt-0.5 text-xs text-gray-500">{hint}</p>}
      </div>
    </div>
  );
}

function todayKey() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
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
    // Backend để @IsInt() — gõ 10.5 sẽ bị trả về lỗi thô của class-validator, chặn
    // sớm ở đây để báo bằng tiếng Việt.
    if (!Number.isInteger(discountValue)) {
      toast.error('Giá trị giảm phải là số nguyên');
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
    if (form.endDate < form.startDate) {
      toast.error('Ngày kết thúc nhận đặt phải sau ngày bắt đầu');
      return;
    }
    // Chỉ chặn khi TẠO mới. Lúc sửa vẫn phải cho lưu mã cũ đã hết hạn, nếu không admin
    // không sửa nổi mô tả hay điều kiện của mã đã chạy xong.
    if (!isEdit && form.endDate < todayKey()) {
      toast.error('Ngày kết thúc nhận đặt đã qua — mã sẽ hết hạn ngay khi tạo');
      return;
    }
    if (form.stayFrom && form.stayTo && form.stayTo < form.stayFrom) {
      toast.error('Kỳ lưu trú: ngày kết thúc phải sau ngày bắt đầu');
      return;
    }
    // Đặt từ startDate trở đi, mà kỳ lưu trú lại kết thúc trước đó thì không ai đặt
    // được: khách không thể đặt phòng cho những đêm đã trôi qua.
    if (form.stayTo && form.stayTo < form.startDate) {
      toast.error('Kỳ lưu trú kết thúc trước ngày bắt đầu nhận đặt — mã sẽ không dùng được');
      return;
    }

    const payload = {
      description: toText(form.description) ?? '',
      discountType: form.discountType,
      discountValue,
      startDate: form.startDate,
      endDate: form.endDate,
      // `|| null` chứ không phải `?? null`: ô để trống VÀ ô gõ số 0 đều mang nghĩa
      // "không giới hạn". Gửi 0 lên sẽ bị @Min(1) ở backend từ chối.
      maxUsage: toNumber(form.maxUsage) || null,
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
  // Chặn chọn ngày đã qua ngay trong ô lịch của trình duyệt (thuộc tính `min` làm các
  // ngày trước đó xám lại và không bấm được).
  //
  // Khi SỬA một mã cũ đã bắt đầu từ trước, lấy chính ngày bắt đầu của nó làm mốc —
  // nếu cứ đặt mốc là hôm nay thì giá trị đang có nằm ngoài vùng hợp lệ, admin lỡ mở
  // lịch ra là không chọn lại được ngày cũ nữa.
  const today = todayKey();
  const minStartDate =
    isEdit && promotion?.startDate && promotion.startDate < today
      ? promotion.startDate
      : today;

  const inputClass =
    'w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 transition-colors hover:border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent';
  const labelClass = 'mb-1.5 block text-xs font-semibold text-gray-600';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Sửa khuyến mãi ${promotion?.code ?? ''}` : 'Thêm khuyến mãi'}
      size="xl"
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
      <div className="space-y-6 text-sm">
        <section className="space-y-4">
          <SectionTitle icon={Ticket} title="Thông tin mã" />
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
                title={
                  isEdit
                    ? 'Không sửa được mã sau khi tạo — các đơn cũ đang tham chiếu tới mã này.'
                    : undefined
                }
                maxLength={30}
                placeholder="VD: HE2026"
                className={`${inputClass} font-mono tracking-wide disabled:bg-gray-100 disabled:text-gray-500`}
                autoFocus={!isEdit}
              />
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

        </section>

        <section className="space-y-4 border-t border-gray-100 pt-6">
          <SectionTitle icon={BadgePercent} title="Mức giảm & thời gian nhận đặt" />
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
              <label className={labelClass}>Giá trị giảm</label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={form.discountType === 'PERCENTAGE' ? 100 : undefined}
                  value={form.discountValue}
                  onChange={setField('discountValue')}
                  placeholder={form.discountType === 'PERCENTAGE' ? '15' : '200000'}
                  className={`${inputClass} pr-10`}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-semibold text-gray-400">
                  {form.discountType === 'PERCENTAGE' ? '%' : 'đ'}
                </span>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 [&>div]:min-w-0">
            <div>
              <label className={labelClass}>Bắt đầu nhận đặt</label>
              <input
                type="date"
                min={minStartDate}
                value={form.startDate}
                onChange={setField('startDate')}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Kết thúc nhận đặt</label>
              <input
                type="date"
                min={form.startDate || minStartDate}
                value={form.endDate}
                onChange={setField('endDate')}
                className={inputClass}
              />
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50/70 p-5">
          <SectionTitle
            icon={SlidersHorizontal}
            title="Điều kiện áp dụng"
            hint="Chọn mẫu có sẵn hoặc tự điền. Ô nào để trống thì không xét điều kiện đó."
          />

          <div className="flex flex-wrap gap-2">
            {PRESETS.map((preset) => {
              const active = matchesPreset(form, preset);
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  title={preset.hint}
                  aria-pressed={active}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                    active
                      ? 'border-solid border-blue-600 bg-blue-600 text-white'
                      : 'border-dashed border-gray-300 bg-white text-gray-600 hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 [&>div]:min-w-0">
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
                min={minStartDate}
                value={form.stayFrom}
                onChange={setField('stayFrom')}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Kỳ lưu trú đến hết</label>
              <input
                type="date"
                min={form.stayFrom || form.startDate || minStartDate}
                value={form.stayTo}
                onChange={setField('stayTo')}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>
              Chỉ áp dụng cho loại phòng{' '}
              <span className="font-normal text-gray-400">(không chọn = mọi loại phòng)</span>
            </label>
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
                      aria-pressed={selected}
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                        selected
                          ? 'border-blue-500 bg-blue-600 text-white'
                          : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {selected && <Check size={14} />}
                      {roomType.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </Modal>
  );
}
