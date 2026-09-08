import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ArrowLeft,
  BedDouble,
  Banknote,
  CalendarDays,
  Loader2,
  QrCode,
  TriangleAlert,
  UtensilsCrossed,
} from 'lucide-react';
import StatusPill from '../../booking/StatusPill';
import { BOOKING_STATUS_STYLES } from '../../../utils/bookingStatusStyles';
import formatCurrency from '../../../utils/formatCurrency';
import formatDate from '../../../utils/formatDate';
import getBookingCode from '../../../utils/bookingCode';
import {
  useGetCheckoutPreviewQuery,
  useGetServicesQuery,
  useCheckOutMutation,
} from '../../../services/booking';

function fmtDateTime(value) {
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function AdminCheckoutPage() {
  const { roomId, bookingId } = useParams();
  const navigate = useNavigate();

  const {
    data: preview,
    isLoading,
    error,
  } = useGetCheckoutPreviewQuery(bookingId);
  const { data: services = [] } = useGetServicesQuery();
  const [checkOut, { isLoading: submitting }] = useCheckOutMutation();

  const [selected, setSelected] = useState({}); // serviceId -> quantity
  const [paymentMethod, setPaymentMethod] = useState('CASH');

  const servicesById = useMemo(
    () => Object.fromEntries(services.map((s) => [s.serviceId, s])),
    [services],
  );

  const newServicesSum = useMemo(
    () =>
      Object.entries(selected).reduce(
        (sum, [id, qty]) => sum + qty * (servicesById[id]?.price ?? 0),
        0,
      ),
    [selected, servicesById],
  );

  if (isLoading) {
    return (
      <div className="flex justify-center py-32 text-gray-300">
        <Loader2 className="animate-spin" size={32} />
      </div>
    );
  }

  if (error || !preview) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-red-100 bg-red-50 p-8 text-center">
        <p className="text-sm font-medium text-red-600">
          {error?.data?.message || 'Không tải được dữ liệu trả phòng cho đơn này.'}
        </p>
        <Link
          to={`/admin/rooms/${roomId}`}
          className="mt-4 inline-block text-sm font-semibold text-blue-600"
        >
          ← Quay lại phòng
        </Link>
      </div>
    );
  }

  const { booking, lateCheckout, invoice } = preview;
  const roomCharge = invoice.roomAmount + invoice.lateCheckoutFee;
  const totalAmount = invoice.totalAmount + newServicesSum;
  const subtotal = totalAmount - invoice.vatAmount;
  const dueAmount = Math.max(0, totalAmount - invoice.paidAmount);

  const toggleService = (id) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = 1;
      return next;
    });

  const setQty = (id, qty) =>
    setSelected((prev) => ({ ...prev, [id]: Math.max(1, qty) }));

  const handleFinish = async () => {
    try {
      await checkOut({
        bookingId,
        extraServices: Object.entries(selected).map(([serviceId, quantity]) => ({
          serviceId,
          quantity,
        })),
        paymentMethod,
        markPaid: true,
      }).unwrap();
      toast.success('Đã hoàn tất check-out — phòng chuyển sang trạng thái dọn dẹp');
      navigate(`/admin/rooms/${roomId}`);
    } catch (err) {
      toast.error(err?.data?.message || 'Không thể hoàn tất check-out');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to={`/admin/rooms/${roomId}`}
          className="flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50"
        >
          <ArrowLeft size={16} />
        </Link>
        <h1 className="text-xl font-bold text-gray-900">Check-out & Thanh toán</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {/* Khách */}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div>
              <p className="text-lg font-bold text-gray-900">
                {booking.guestInfo?.fullName}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-semibold text-blue-600">
                  <BedDouble size={13} /> Phòng {booking.room?.roomNumber}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays size={13} />
                  {formatDate(booking.checkInDate)} — {formatDate(booking.checkOutDate)}
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Trạng thái
              </p>
              <StatusPill
                value={booking.status}
                styles={BOOKING_STATUS_STYLES}
                label={booking.status}
              />
            </div>
          </div>

          {/* Cảnh báo trả phòng muộn */}
          {lateCheckout.isLate && (
            <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <TriangleAlert className="mt-0.5 shrink-0 text-amber-500" size={20} />
              <div className="text-sm">
                <p className="font-bold text-amber-700">
                  TRẢ PHÒNG MUỘN (SAU {String(new Date(lateCheckout.deadline).getHours()).padStart(2, '0')}H00)
                </p>
                <p className="mt-1 text-amber-700">
                  Giờ hiện tại là {fmtDateTime(Date.now())}. Theo quy định của khách
                  sạn, do quá hạn trả phòng nên hệ thống đã tự động cộng thêm{' '}
                  <b>{lateCheckout.nights} đêm</b> lưu trú (
                  {formatCurrency(invoice.lateCheckoutFee)}) vào chi phí.
                </p>
              </div>
            </div>
          )}

          {/* Tiền phòng */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-900">
              <BedDouble size={18} className="text-blue-600" /> Tiền phòng
            </h2>
            <div className="flex items-start justify-between border-t border-gray-100 pt-4 text-sm">
              <div>
                <p className="font-semibold text-gray-800">
                  Tiền phòng lưu trú
                  {lateCheckout.nights > 0 && ` + ${lateCheckout.nights} đêm trả muộn`}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  Mã đặt phòng: {getBookingCode(booking.bookingId)}
                </p>
                <p className="text-xs text-gray-400">
                  Kế hoạch: {formatDate(booking.checkInDate)} — {formatDate(booking.checkOutDate)}
                </p>
              </div>
              <span className="text-base font-bold text-blue-600">
                {formatCurrency(roomCharge)}
              </span>
            </div>
          </section>

          {/* Dịch vụ / tiêu dùng thêm */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-gray-900">
              <UtensilsCrossed size={18} className="text-blue-600" /> Dịch vụ &
              tiêu dùng thêm
            </h2>

            {booking.serviceItems?.length > 0 && (
              <ul className="mb-4 space-y-1.5 border-b border-gray-100 pb-4 text-sm">
                {booking.serviceItems.map((item) => (
                  <li
                    key={item.bookingServiceItemId ?? item.service?.serviceId}
                    className="flex justify-between text-gray-500"
                  >
                    <span>
                      {item.service?.name} × {item.quantity}{' '}
                      <span className="text-xs text-gray-400">(đã ghi nhận)</span>
                    </span>
                    <span>{formatCurrency(item.unitPrice * item.quantity)}</span>
                  </li>
                ))}
              </ul>
            )}

            {services.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-400">
                Chưa có dịch vụ nào được cấu hình.
              </p>
            ) : (
              <ul className="space-y-2">
                {services.map((svc) => {
                  const active = Boolean(selected[svc.serviceId]);
                  return (
                    <li
                      key={svc.serviceId}
                      className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                        active
                          ? 'border-blue-300 bg-blue-50/50'
                          : 'border-gray-200'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => toggleService(svc.serviceId)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-gray-800">
                          {svc.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {svc.price === 0
                            ? 'Miễn phí'
                            : `${formatCurrency(svc.price)} / ${svc.unit}`}
                        </p>
                      </div>
                      {active && (
                        <input
                          type="number"
                          min="1"
                          value={selected[svc.serviceId]}
                          onChange={(e) =>
                            setQty(svc.serviceId, Number(e.target.value))
                          }
                          className="w-16 rounded-lg border border-gray-200 px-2 py-1 text-sm"
                        />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>

        {/* Cột phải */}
        <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-bold text-gray-900">
              Tổng hợp chi phí
            </h2>
            <dl className="space-y-2.5 text-sm">
              <Row label="Tạm tính" value={formatCurrency(subtotal)} />
              <Row label="VAT (8%)" value={formatCurrency(invoice.vatAmount)} />
              <Row
                label="Tổng chi phí"
                value={formatCurrency(totalAmount)}
                bold
              />
              <Row
                label="Đã thanh toán trước"
                value={`- ${formatCurrency(invoice.paidAmount)}`}
                tone="text-emerald-600"
              />
              <div className="flex items-center justify-between border-t border-dashed border-gray-200 pt-3">
                <dt className="text-sm font-bold uppercase tracking-wider text-gray-500">
                  Còn lại
                </dt>
                <dd
                  className={`text-xl font-extrabold ${
                    dueAmount > 0 ? 'text-red-600' : 'text-gray-900'
                  }`}
                >
                  {formatCurrency(dueAmount)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-base font-bold text-gray-900">
              Phương thức thanh toán
            </h2>
            <div className="space-y-2">
              <PayOption
                active={paymentMethod === 'CASH'}
                onClick={() => setPaymentMethod('CASH')}
                icon={Banknote}
                title="Tiền mặt"
                subtitle="Thanh toán tại quầy"
              />
              <PayOption
                active={paymentMethod === 'PAYOS'}
                onClick={() => setPaymentMethod('PAYOS')}
                icon={QrCode}
                title="Chuyển khoản QR"
                subtitle="PayOS"
              />
            </div>
          </section>

          <div>
            <button
              type="button"
              onClick={handleFinish}
              disabled={submitting}
              className="flex w-full flex-col items-center rounded-xl bg-blue-600 px-4 py-3 font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
            >
              <span className="flex items-center gap-2">
                {submitting && <Loader2 size={16} className="animate-spin" />}
                Hoàn tất Check-out
              </span>
              <span className="text-xs font-medium text-blue-100">
                Cập nhật trạng thái phòng
              </span>
            </button>
            <p className="mt-2 text-center text-[11px] uppercase tracking-wider text-gray-400">
              Phòng sẽ chuyển sang trạng thái "Dọn dẹp"
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, bold, tone }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd className={`${bold ? 'font-bold text-gray-900' : 'text-gray-700'} ${tone ?? ''}`}>
        {value}
      </dd>
    </div>
  );
}

function PayOption({ active, onClick, icon: Icon, title, subtitle }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
        active ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'
      }`}
    >
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
          active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500'
        }`}
      >
        <Icon size={16} />
      </span>
      <span>
        <span className="block text-sm font-semibold text-gray-800">{title}</span>
        <span className="block text-xs text-gray-400">{subtitle}</span>
      </span>
    </button>
  );
}
