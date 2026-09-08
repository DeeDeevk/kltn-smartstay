import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  BedDouble,
  Banknote,
  CalendarDays,
  CheckCircle2,
  Loader2,
  Minus,
  Plus,
  QrCode,
  Sparkles,
  TriangleAlert,
  Wine,
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

// Mệnh giá tiền mặt VND đang lưu hành, dùng cho bảng đếm tiền khách đưa.
const VND_DENOMS = [500000, 200000, 100000, 50000, 20000, 10000, 5000, 2000, 1000];

// Thông tin tài khoản nhận chuyển khoản của khách sạn (cấu hình cứng cho demo).
const HOTEL_BANK = {
  bankName: 'MB Bank',
  bin: '970422',
  accountNo: '9990001234567',
  accountName: 'CONG TY TNHH VIKA HOTEL',
};

const BOOKING_STATUS_LABELS = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Đã xác nhận',
  CHECKED_IN: 'Đang lưu trú',
  CHECKED_OUT: 'Đã trả phòng',
  CANCELLED: 'Đã huỷ',
};

function fmtDateTime(value) {
  return new Date(value).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function initials(name = '') {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(-2)
      .map((w) => w[0])
      .join('')
      .toUpperCase() || '?'
  );
}

export default function AdminCheckoutPage() {
  const { roomId, bookingId } = useParams();
  const navigate = useNavigate();

  const { data: preview, isLoading, error } =
    useGetCheckoutPreviewQuery(bookingId);
  const { data: services = [] } = useGetServicesQuery();
  const [checkOut, { isLoading: submitting }] = useCheckOutMutation();

  const [selected, setSelected] = useState({}); // serviceId -> quantity
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [cashCounts, setCashCounts] = useState({}); // denom -> số tờ
  const [transferShown, setTransferShown] = useState(false);
  const [transferConfirmed, setTransferConfirmed] = useState(false);

  const servicesById = useMemo(
    () => Object.fromEntries(services.map((s) => [s.serviceId, s])),
    [services],
  );
  const minibar = useMemo(
    () => services.filter((s) => s.category === 'MINIBAR'),
    [services],
  );
  const others = useMemo(
    () => services.filter((s) => s.category !== 'MINIBAR'),
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
          {error?.data?.message ||
            'Không tải được dữ liệu trả phòng cho đơn này.'}
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
  const serviceTotal = invoice.serviceAmount + newServicesSum;
  const totalAmount = invoice.totalAmount + newServicesSum;
  const subtotal = totalAmount - invoice.vatAmount;
  const dueAmount = Math.max(0, totalAmount - invoice.paidAmount);

  const cashReceived = VND_DENOMS.reduce(
    (sum, d) => sum + d * (cashCounts[d] || 0),
    0,
  );
  const cashChange = cashReceived - dueAmount;

  // Đủ điều kiện bấm "Hoàn tất Check-out": không còn nợ, hoặc đã thu đủ tiền mặt,
  // hoặc đã xác nhận nhận chuyển khoản.
  const paymentDone =
    dueAmount <= 0 ||
    (paymentMethod === 'CASH' && cashReceived >= dueAmount) ||
    (paymentMethod === 'PAYOS' && transferConfirmed);

  const transferQrValue = `Chuyen khoan VIKA HOTEL | STK ${HOTEL_BANK.accountNo} (${HOTEL_BANK.bankName}) | So tien ${dueAmount} | ND VIKA ${getBookingCode(booking.bookingId)}`;

  const setCash = (denom, count) =>
    setCashCounts((prev) => ({ ...prev, [denom]: Math.max(0, count || 0) }));

  const setQty = (id, qty) =>
    setSelected((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[id];
      else next[id] = qty;
      return next;
    });

  const handleFinish = async () => {
    if (!paymentDone) {
      toast.error('Vui lòng hoàn tất thanh toán trước khi trả phòng');
      return;
    }
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
      toast.success(
        'Đã hoàn tất check-out — phòng chuyển sang trạng thái dọn dẹp',
      );
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
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            Check-out & Thanh toán
          </h1>
          <p className="text-xs text-gray-400">
            Đối chiếu chi phí lưu trú, dịch vụ và thu phần còn lại
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_368px]">
        <div className="space-y-5">
          {/* Khách */}
          <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-600 text-sm font-bold text-white">
              {initials(booking.guestInfo?.fullName)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-lg font-bold text-gray-900">
                {booking.guestInfo?.fullName}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-gray-500">
                <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-semibold text-blue-600">
                  <BedDouble size={13} /> Phòng {booking.room?.roomNumber}
                </span>
                <span className="inline-flex items-center gap-1">
                  <CalendarDays size={13} />
                  {formatDate(booking.checkInDate)} —{' '}
                  {formatDate(booking.checkOutDate)}
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Trạng thái
              </p>
              <StatusPill
                value={booking.status}
                styles={BOOKING_STATUS_STYLES}
                label={BOOKING_STATUS_LABELS[booking.status] || booking.status}
              />
            </div>
          </div>

          {/* Cảnh báo trả phòng muộn */}
          {lateCheckout.isLate && (
            <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <TriangleAlert
                className="mt-0.5 shrink-0 text-amber-500"
                size={20}
              />
              <div className="text-sm">
                <p className="font-bold text-amber-700">
                  TRẢ PHÒNG MUỘN (SAU 12H00)
                </p>
                <p className="mt-1 text-amber-700">
                  Giờ hiện tại {fmtDateTime(Date.now())}. Do quá hạn trả phòng, hệ
                  thống tự cộng thêm <b>{lateCheckout.nights} đêm</b> lưu trú (
                  {formatCurrency(invoice.lateCheckoutFee)}) vào chi phí.
                </p>
              </div>
            </div>
          )}

          {/* Tiền phòng */}
          <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <h2 className="flex items-center gap-2 border-b border-gray-100 px-5 py-4 text-base font-bold text-gray-900">
              <BedDouble size={18} className="text-blue-600" /> Tiền phòng
            </h2>
            <div className="flex items-start justify-between px-5 py-4 text-sm">
              <div>
                <p className="font-semibold text-gray-800">
                  Tiền phòng lưu trú
                  {lateCheckout.nights > 0 &&
                    ` + ${lateCheckout.nights} đêm trả muộn`}
                </p>
                <p className="mt-0.5 text-xs text-gray-400">
                  Mã đặt phòng: {getBookingCode(booking.bookingId)}
                </p>
                <p className="text-xs text-gray-400">
                  Kế hoạch: {formatDate(booking.checkInDate)} —{' '}
                  {formatDate(booking.checkOutDate)}
                </p>
              </div>
              <span className="shrink-0 text-base font-bold text-blue-600">
                {formatCurrency(roomCharge)}
              </span>
            </div>
          </section>

          {/* Minibar */}
          {minibar.length > 0 && (
            <ServiceSection
              icon={Wine}
              title="Minibar"
              hint="Ghi nhận tiêu thụ tại phòng"
              services={minibar}
              selected={selected}
              onSetQty={setQty}
            />
          )}

          {/* Dịch vụ khác */}
          {others.length > 0 && (
            <ServiceSection
              icon={Sparkles}
              title="Dịch vụ khác"
              services={others}
              selected={selected}
              onSetQty={setQty}
            />
          )}

          {/* Dịch vụ đã ghi nhận trước đó */}
          {booking.serviceItems?.length > 0 && (
            <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wider text-gray-400">
                Dịch vụ đã ghi nhận
              </h2>
              <ul className="space-y-1.5 text-sm">
                {booking.serviceItems.map((item) => (
                  <li
                    key={item.bookingServiceItemId ?? item.service?.serviceId}
                    className="flex justify-between text-gray-600"
                  >
                    <span>
                      {item.service?.name} × {item.quantity}
                    </span>
                    <span>
                      {formatCurrency(item.unitPrice * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Cột phải */}
        <div className="space-y-5 lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-base font-bold text-gray-900">
              Tổng hợp chi phí
            </h2>
            <dl className="space-y-2.5 text-sm">
              <Row label="Tiền phòng" value={formatCurrency(roomCharge)} />
              <Row
                label="Dịch vụ / minibar"
                value={formatCurrency(serviceTotal)}
              />
              <Row
                label="Tạm tính"
                value={formatCurrency(subtotal)}
                bold
              />
              <Row label="VAT (8%)" value={formatCurrency(invoice.vatAmount)} />
              <div className="my-1 border-t border-gray-100" />
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
                  className={`text-2xl font-extrabold ${
                    dueAmount > 0 ? 'text-red-600' : 'text-gray-900'
                  }`}
                >
                  {formatCurrency(dueAmount)}
                </dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-base font-bold text-gray-900">Thanh toán</h2>

            {dueAmount <= 0 ? (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                <CheckCircle2 size={16} /> Đơn đã thanh toán đủ — có thể trả phòng.
              </div>
            ) : (
              <>
                <div className="mb-3 flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                  <span className="text-sm text-gray-500">Cần thu</span>
                  <span className="text-lg font-bold text-red-600">
                    {formatCurrency(dueAmount)}
                  </span>
                </div>

                <div className="mb-4 space-y-2">
                  <PayOption
                    active={paymentMethod === 'CASH'}
                    onClick={() => setPaymentMethod('CASH')}
                    icon={Banknote}
                    title="Tiền mặt"
                    subtitle="Đếm tiền khách đưa"
                  />
                  <PayOption
                    active={paymentMethod === 'PAYOS'}
                    onClick={() => setPaymentMethod('PAYOS')}
                    icon={QrCode}
                    title="Chuyển khoản QR"
                    subtitle="Quét mã ngân hàng"
                  />
                </div>

                {paymentMethod === 'CASH' ? (
                  <CashCounter
                    counts={cashCounts}
                    onSet={setCash}
                    received={cashReceived}
                    due={dueAmount}
                    change={cashChange}
                  />
                ) : (
                  <TransferPanel
                    shown={transferShown}
                    confirmed={transferConfirmed}
                    qrValue={transferQrValue}
                    amount={dueAmount}
                    note={`VIKA ${getBookingCode(booking.bookingId)}`}
                    onShow={() => setTransferShown(true)}
                    onConfirm={() => setTransferConfirmed(true)}
                  />
                )}
              </>
            )}
          </section>

          <div>
            <button
              type="button"
              onClick={handleFinish}
              disabled={submitting || !paymentDone}
              className="flex w-full flex-col items-center rounded-xl bg-blue-600 px-4 py-3 font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
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
              {paymentDone
                ? 'Phòng sẽ chuyển sang trạng thái "Dọn dẹp"'
                : 'Hoàn tất thanh toán để bật nút trả phòng'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ServiceSection({ icon: Icon, title, hint, services, selected, onSetQty }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-gray-900">
          <Icon size={18} className="text-blue-600" /> {title}
        </h2>
        {hint && <span className="text-xs italic text-gray-400">{hint}</span>}
      </div>
      <div className="grid gap-3 p-5 sm:grid-cols-2">
        {services.map((svc) => {
          const qty = selected[svc.serviceId] || 0;
          const active = qty > 0;
          const free = svc.price === 0;
          return (
            <div
              key={svc.serviceId}
              className={`rounded-xl border p-3 transition-colors ${
                active ? 'border-blue-400 bg-blue-50/50' : 'border-gray-200'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-gray-800">
                    {svc.name}
                  </p>
                  <p className="mt-0.5 text-xs">
                    {free ? (
                      <span className="font-semibold text-emerald-600">
                        Miễn phí
                      </span>
                    ) : (
                      <span className="text-gray-400">
                        {formatCurrency(svc.price)} / {svc.unit}
                      </span>
                    )}
                  </p>
                </div>
                {!active ? (
                  <button
                    type="button"
                    onClick={() => onSetQty(svc.serviceId, 1)}
                    className="shrink-0 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-600 transition-colors hover:border-blue-300 hover:text-blue-600"
                  >
                    Thêm
                  </button>
                ) : (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => onSetQty(svc.serviceId, qty - 1)}
                      className="flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50"
                    >
                      <Minus size={12} />
                    </button>
                    <span className="w-5 text-center text-sm font-bold text-gray-800">
                      {qty}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSetQty(svc.serviceId, qty + 1)}
                      className="flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 text-gray-500 hover:bg-gray-50"
                    >
                      <Plus size={12} />
                    </button>
                  </div>
                )}
              </div>
              {active && !free && (
                <p className="mt-2 text-right text-xs font-semibold text-blue-600">
                  {formatCurrency(svc.price * qty)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}

// Bảng đếm tiền mặt khách đưa theo từng mệnh giá + tiền thối lại.
function CashCounter({ counts, onSet, received, due, change }) {
  return (
    <div className="rounded-xl border border-gray-200">
      <div className="grid grid-cols-[1fr_64px_1fr] items-center gap-2 border-b border-gray-100 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">
        <span>Mệnh giá</span>
        <span className="text-center">Số tờ</span>
        <span className="text-right">Thành tiền</span>
      </div>
      <div className="divide-y divide-gray-50">
        {VND_DENOMS.map((denom) => {
          const count = counts[denom] || 0;
          return (
            <div
              key={denom}
              className="grid grid-cols-[1fr_64px_1fr] items-center gap-2 px-3 py-1.5 text-sm"
            >
              <span className="text-gray-600">{formatCurrency(denom)}</span>
              <input
                type="number"
                min="0"
                value={count || ''}
                placeholder="0"
                onChange={(e) => onSet(denom, Number(e.target.value))}
                className="w-full rounded-md border border-gray-200 px-2 py-1 text-center text-sm focus:border-blue-500 focus:outline-none"
              />
              <span className="text-right text-gray-500">
                {count > 0 ? formatCurrency(denom * count) : '—'}
              </span>
            </div>
          );
        })}
      </div>
      <div className="space-y-1.5 border-t border-gray-100 px-3 py-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Khách đưa</span>
          <span className="font-bold text-gray-900">
            {formatCurrency(received)}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Cần thu</span>
          <span className="text-gray-700">{formatCurrency(due)}</span>
        </div>
        <div className="flex justify-between border-t border-dashed border-gray-200 pt-1.5">
          <span className="font-semibold text-gray-600">
            {change >= 0 ? 'Tiền thối lại' : 'Còn thiếu'}
          </span>
          <span
            className={`text-base font-extrabold ${
              change >= 0 ? 'text-emerald-600' : 'text-red-600'
            }`}
          >
            {formatCurrency(Math.abs(change))}
          </span>
        </div>
      </div>
    </div>
  );
}

// Hiện QR + thông tin tài khoản để khách chuyển khoản, rồi lễ tân xác nhận đã nhận.
function TransferPanel({ shown, confirmed, qrValue, amount, note, onShow, onConfirm }) {
  if (!shown) {
    return (
      <button
        type="button"
        onClick={onShow}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
      >
        <QrCode size={16} /> Tạo mã QR chuyển khoản
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 p-4 text-sm">
      <div className="flex justify-center">
        <div className="rounded-lg border border-gray-100 bg-white p-2">
          <QRCodeSVG value={qrValue} size={148} level="M" />
        </div>
      </div>
      <dl className="space-y-1 text-xs">
        <div className="flex justify-between">
          <dt className="text-gray-400">Ngân hàng</dt>
          <dd className="font-semibold text-gray-700">{HOTEL_BANK.bankName}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-400">Số tài khoản</dt>
          <dd className="font-mono font-semibold text-gray-700">
            {HOTEL_BANK.accountNo}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-400">Chủ tài khoản</dt>
          <dd className="font-semibold text-gray-700">
            {HOTEL_BANK.accountName}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-400">Số tiền</dt>
          <dd className="font-bold text-red-600">{formatCurrency(amount)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-gray-400">Nội dung</dt>
          <dd className="font-semibold text-gray-700">{note}</dd>
        </div>
      </dl>

      {confirmed ? (
        <div className="flex items-center justify-center gap-2 rounded-lg bg-emerald-50 py-2 text-sm font-semibold text-emerald-700">
          <CheckCircle2 size={16} /> Đã xác nhận nhận chuyển khoản
        </div>
      ) : (
        <button
          type="button"
          onClick={onConfirm}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-emerald-600 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
        >
          <CheckCircle2 size={16} /> Xác nhận đã nhận tiền
        </button>
      )}
    </div>
  );
}

function Row({ label, value, bold, tone }) {
  return (
    <div className="flex justify-between">
      <dt className="text-gray-500">{label}</dt>
      <dd
        className={`${bold ? 'font-bold text-gray-900' : 'text-gray-700'} ${
          tone ?? ''
        }`}
      >
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
        <span className="block text-sm font-semibold text-gray-800">
          {title}
        </span>
        <span className="block text-xs text-gray-400">{subtitle}</span>
      </span>
    </button>
  );
}
