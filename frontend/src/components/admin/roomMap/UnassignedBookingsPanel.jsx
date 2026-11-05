import { BedDouble } from 'lucide-react';
import { formatDateOnly } from '../../../utils/formatDate';

function paymentLabel(b) {
  if (b.status === 'PENDING') return { text: 'Chờ xác nhận', cls: 'bg-gray-100 text-gray-600' };
  if (b.paymentStatus === 'PAID') return { text: 'Đã thanh toán', cls: 'bg-emerald-100 text-emerald-700' };
  if (b.paymentMethod === 'CASH') return { text: 'Thu tiền khi nhận phòng', cls: 'bg-blue-100 text-blue-700' };
  return { text: 'Chưa thanh toán online', cls: 'bg-amber-100 text-amber-700' };
}

// Đơn đã đặt (thường là đơn online) nhưng chưa gắn phòng vật lý. Bấm 1 đơn -> mở modal
// check-in có sẵn (QrCheckInModal) để chọn phòng và check-in, giống như khi quét QR vé.
export default function UnassignedBookingsPanel({ bookings, onSelect }) {
  if (!bookings?.length) return null;

  return (
    <section className="rounded-2xl border border-amber-200 bg-amber-50/50 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-amber-800">
        <BedDouble className="h-4 w-4" aria-hidden="true" />
        Đơn chờ xếp phòng ({bookings.length})
      </h3>
      <ul className="divide-y divide-amber-100">
        {bookings.map((b) => {
          const label = paymentLabel(b);
          return (
            <li key={b.bookingId}>
              <button
                type="button"
                onClick={() => onSelect(b.bookingId)}
                className="flex w-full flex-wrap items-center justify-between gap-2 rounded-lg px-2 py-2.5 text-left hover:bg-amber-100/60"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-gray-900">
                    {b.guestName ?? 'Khách'} · {b.roomTypeName}
                  </span>
                  <span className="text-xs text-gray-500">
                    {formatDateOnly(b.checkIn)} → {formatDateOnly(b.checkOut)}
                  </span>
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${label.cls}`}>
                  {label.text}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
