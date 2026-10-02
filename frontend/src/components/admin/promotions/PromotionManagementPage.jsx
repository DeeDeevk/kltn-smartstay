import { useMemo, useState } from 'react';
import { Loader2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import ConfirmModal from '../../common/ConfirmModal';
import PromotionFormModal, { getErrorMessage } from './PromotionFormModal';
import {
  useDeletePromotionMutation,
  useGetPromotionsQuery,
  useTogglePromotionMutation,
} from '../../../services/promotion';
import { useGetAllRoomTypesQuery } from '../../../services/roomType';

const STATUS_FILTERS = [
  { value: 'all', label: 'Tất cả' },
  { value: 'ACTIVE', label: 'Đang chạy' },
  { value: 'PAUSED', label: 'Tạm ngưng' },
  { value: 'EXPIRED', label: 'Hết hiệu lực' },
];

const STATUS_BADGES = {
  ACTIVE: { label: 'Đang chạy', className: 'bg-green-50 text-green-700' },
  PAUSED: { label: 'Tạm ngưng', className: 'bg-amber-50 text-amber-700' },
  EXPIRED: { label: 'Hết hiệu lực', className: 'bg-gray-100 text-gray-500' },
};

function formatCurrency(amount) {
  return `${Number(amount ?? 0).toLocaleString('vi-VN')} đ`;
}

function formatDate(key) {
  if (!key) return '';
  const [y, m, d] = key.split('-');
  return `${d}/${m}/${y}`;
}

// Bỏ dấu để tìm "khuyen mai he" vẫn ra "khuyến mãi hè".
function normalize(text) {
  return (text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase();
}

// Diễn giải cột `conditions` (JSON) thành các nhãn tiếng Việt đọc được — admin không
// phải đoán ý nghĩa của từng khoá khi nhìn danh sách.
function describeConditions(conditions, roomTypeNameById) {
  if (!conditions) return [];
  const labels = [];
  if (conditions.minNights) labels.push(`Từ ${conditions.minNights} đêm`);
  if (conditions.minAdvanceDays !== undefined) {
    labels.push(`Đặt trước ≥ ${conditions.minAdvanceDays} ngày`);
  }
  if (conditions.maxAdvanceDays !== undefined) {
    labels.push(`Đặt trong vòng ${conditions.maxAdvanceDays} ngày`);
  }
  if (conditions.minAmount) labels.push(`Đơn từ ${formatCurrency(conditions.minAmount)}`);
  if (conditions.stayFrom || conditions.stayTo) {
    const from = conditions.stayFrom ? formatDate(conditions.stayFrom) : '…';
    const to = conditions.stayTo ? formatDate(conditions.stayTo) : '…';
    labels.push(`Lưu trú ${from} – ${to}`);
  }
  if (conditions.roomTypeIds?.length) {
    const names = conditions.roomTypeIds
      .map((id) => roomTypeNameById.get(id) ?? 'Loại phòng đã xoá')
      .join(', ');
    labels.push(`Chỉ: ${names}`);
  }
  return labels;
}

// Công tắc tạm ngưng/chạy lại ngay trên danh sách. Mã đã hết hiệu lực (hết hạn hoặc
// hết lượt) thì khoá công tắc: bật lại cũng không dùng được cho tới khi sửa ngày.
function StatusToggle({ promotion }) {
  const [togglePromotion, { isLoading }] = useTogglePromotionMutation();
  const expired = promotion.status === 'EXPIRED';
  const active = promotion.status === 'ACTIVE';

  const handleToggle = async () => {
    try {
      await togglePromotion(promotion.promotionId).unwrap();
      toast.success(active ? 'Đã tạm ngưng khuyến mãi' : 'Đã bật lại khuyến mãi');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Không thể đổi trạng thái'));
    }
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={active}
      onClick={handleToggle}
      disabled={isLoading || expired}
      title={
        expired
          ? 'Mã đã hết hiệu lực — sửa ngày kết thúc hoặc giới hạn lượt để dùng lại'
          : active
            ? 'Đang chạy — bấm để tạm ngưng'
            : 'Đang tạm ngưng — bấm để chạy lại'
      }
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-40 ${
        active ? 'bg-green-500' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
          active ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

function PromotionRow({ promotion, roomTypeNameById, onEdit, onDelete }) {
  const badge = STATUS_BADGES[promotion.status] ?? STATUS_BADGES.EXPIRED;
  const conditionLabels = describeConditions(promotion.conditions, roomTypeNameById);
  const discount =
    promotion.discountType === 'PERCENTAGE'
      ? `-${promotion.discountValue}%`
      : `-${formatCurrency(promotion.discountValue)}`;

  return (
    <li className={`px-4 py-4 ${promotion.status === 'ACTIVE' ? '' : 'bg-gray-50/70'}`}>
      <div className="flex flex-wrap items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-bold tracking-wide text-gray-900">
              {promotion.code}
            </span>
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
              {discount}
            </span>
            <span className={`rounded-md px-2 py-0.5 text-xs font-semibold ${badge.className}`}>
              {badge.label}
            </span>
          </div>

          {promotion.description && (
            <p className="mt-1 text-sm text-gray-600 wrap-anywhere">{promotion.description}</p>
          )}

          <p className="mt-1.5 text-xs text-gray-500">
            Nhận đặt {formatDate(promotion.startDate)} – {formatDate(promotion.endDate)} · Đã dùng{' '}
            {promotion.usedCount}
            {promotion.maxUsage === null ? ' lượt' : `/${promotion.maxUsage} lượt`}
          </p>

          {conditionLabels.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {conditionLabels.map((label) => (
                <span
                  key={label}
                  className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-600"
                >
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <StatusToggle promotion={promotion} />
          <button
            type="button"
            onClick={() => onEdit(promotion)}
            title="Sửa"
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
          >
            <Pencil size={16} />
          </button>
          <button
            type="button"
            onClick={() => onDelete(promotion)}
            title={
              promotion.usedCount > 0
                ? 'Đã có đơn dùng mã này — không xoá được, hãy tạm ngưng'
                : 'Xoá'
            }
            disabled={promotion.usedCount > 0}
            className="rounded-lg p-2 text-red-500 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </li>
  );
}

// Quản lý khuyến mãi: tạo mã giảm giá và đặt điều kiện áp dụng (đặt sớm, phút chót,
// ở dài ngày, theo loại phòng, theo kỳ lưu trú). Giá trị giảm luôn tính trên tiền
// phòng trước thuế — xem PromotionService ở backend.
export default function PromotionManagementPage() {
  const { data: promotions = [], isFetching, error } = useGetPromotionsQuery();
  const { data: roomTypeData } = useGetAllRoomTypesQuery();
  const [deletePromotion, { isLoading: isDeleting }] = useDeletePromotionMutation();

  const [formState, setFormState] = useState({ open: false, promotion: null });
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const roomTypeNameById = useMemo(
    () => new Map((roomTypeData?.data ?? []).map((rt) => [rt.roomTypeId, rt.name])),
    [roomTypeData],
  );

  const activeCount = promotions.filter((p) => p.status === 'ACTIVE').length;

  const filtered = useMemo(() => {
    const needle = normalize(keyword.trim());
    return promotions.filter((p) => {
      if (statusFilter !== 'all' && p.status !== statusFilter) return false;
      if (needle && !normalize(`${p.code} ${p.description ?? ''}`).includes(needle)) return false;
      return true;
    });
  }, [promotions, keyword, statusFilter]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deletePromotion(deleteTarget.promotionId).unwrap();
      toast.success('Đã xoá khuyến mãi');
      setDeleteTarget(null);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Không thể xoá khuyến mãi'));
    }
  };

  const hasFilter = keyword.trim() || statusFilter !== 'all';

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Khuyến mãi</h1>
          <p className="mt-1 text-sm text-gray-500">
            Mã giảm giá cho khách đặt phòng · {activeCount}/{promotions.length} đang chạy
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormState({ open: true, promotion: null })}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-blue-700"
        >
          <Plus size={16} /> Thêm khuyến mãi
        </button>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <div className="relative min-w-60 flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="Tìm theo mã hoặc mô tả..."
            className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {isFetching && promotions.length === 0 && (
        <div className="flex justify-center py-16 text-gray-400">
          <Loader2 className="animate-spin" size={28} />
        </div>
      )}

      {!isFetching && error && (
        <div className="rounded-xl border border-red-100 bg-red-50 p-6 text-center text-sm text-red-600">
          {getErrorMessage(error, 'Không thể tải danh sách khuyến mãi')}
        </div>
      )}

      {!error && !(isFetching && promotions.length === 0) && filtered.length === 0 && (
        <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-gray-400">
          {hasFilter
            ? 'Không có khuyến mãi nào khớp bộ lọc.'
            : 'Chưa có khuyến mãi nào. Bấm "Thêm khuyến mãi" để bắt đầu.'}
        </div>
      )}

      {filtered.length > 0 && (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          {filtered.map((promotion) => (
            <PromotionRow
              key={promotion.promotionId}
              promotion={promotion}
              roomTypeNameById={roomTypeNameById}
              onEdit={(p) => setFormState({ open: true, promotion: p })}
              onDelete={setDeleteTarget}
            />
          ))}
        </ul>
      )}

      <PromotionFormModal
        open={formState.open}
        promotion={formState.promotion}
        onClose={() => setFormState({ open: false, promotion: null })}
      />

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Xoá khuyến mãi"
        message={`Xoá vĩnh viễn mã "${deleteTarget?.code ?? ''}"? Nếu chỉ muốn ngừng phát hành, hãy tắt công tắc thay vì xoá.`}
        confirmLabel="Xoá"
        danger
        loading={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </>
  );
}
