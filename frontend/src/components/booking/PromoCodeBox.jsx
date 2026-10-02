import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, TicketPercent, X } from 'lucide-react';
import { useLazyValidatePromotionQuery } from '../../services/promotion';

// Ô nhập mã khuyến mãi ở bước xác nhận đặt phòng.
//
// Chỉ KIỂM TRA TRƯỚC để khách thấy ngay số tiền được giảm — số tiền thật luôn do
// backend tính lại lúc tạo booking (BookingService gọi validateCode lần nữa), nên
// khách có sửa gì ở client cũng không ảnh hưởng tới đơn.
export default function PromoCodeBox({ roomTypeId, checkIn, checkOut, applied, onApply, onClear }) {
  const { t } = useTranslation();
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [validatePromotion, { isFetching }] = useLazyValidatePromotionQuery();

  const handleApply = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    setError(null);
    try {
      const result = await validatePromotion({
        code: trimmed,
        roomTypeId,
        checkIn,
        checkOut,
      }).unwrap();
      onApply({ code: trimmed, discountAmount: result.discountAmount });
    } catch (err) {
      // Backend trả thông báo cụ thể cho từng điều kiện không thoả ("chỉ áp dụng cho
      // đơn từ 3 đêm trở lên"...) — hiện nguyên văn để khách biết phải làm gì.
      setError(err?.data?.message || err?.message || t('checkout.promo.invalid'));
    }
  };

  const handleClear = () => {
    setCode('');
    setError(null);
    onClear();
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-3">
      <h2 className="font-bold text-lg text-gray-900 flex items-center gap-2">
        <TicketPercent size={18} className="text-blue-600" />
        {t('checkout.promo.title')}
      </h2>

      {applied ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
          <p className="text-sm font-semibold text-green-700">
            {t('checkout.promo.applied', { code: applied.code })}
          </p>
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-green-700 transition-colors hover:bg-green-100"
          >
            <X size={14} /> {t('checkout.promo.remove')}
          </button>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                // Form cha submit bằng Enter -> tạo booking luôn. Chặn lại để Enter ở
                // ô này chỉ có nghĩa là "kiểm tra mã".
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleApply();
                }
              }}
              maxLength={30}
              placeholder={t('checkout.promo.placeholder')}
              className="min-w-0 flex-1 rounded-xl border border-gray-200 px-4 py-2.5 font-mono text-sm tracking-wide focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              type="button"
              onClick={handleApply}
              disabled={isFetching || !code.trim()}
              className="flex shrink-0 items-center gap-2 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-gray-800 disabled:opacity-50"
            >
              {isFetching && <Loader2 size={16} className="animate-spin" />}
              {t('checkout.promo.apply')}
            </button>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
        </>
      )}
    </div>
  );
}
