import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  Info,
  LayoutGrid,
  Loader2,
  Phone,
  Plus,
  Search,
  Users,
} from 'lucide-react';
import {
  useGetRoomQuery,
  useUpdateRoomStatusMutation,
} from '../../../services/adminRoom';
import { useGetBookingsQuery } from '../../../services/booking';
import BookingDetailModal from '../../booking/BookingDetailModal';
import StatusPill from '../../booking/StatusPill';
import WalkInBookingModal from './WalkInBookingModal';
import { BOOKING_STATUS_STYLES } from '../../../utils/bookingStatusStyles';
import { ROOM_STATUS_META } from '../../../utils/roomStatusStyles';
import formatCurrency from '../../../utils/formatCurrency';
import formatDate from '../../../utils/formatDate';
import getBookingCode from '../../../utils/bookingCode';

const BOOKING_STATUS_LABELS = {
  PENDING: 'Chờ xác nhận',
  CONFIRMED: 'Lịch đặt',
  CHECKED_IN: 'Đang ở',
  CHECKED_OUT: 'Đã trả',
  CANCELLED: 'Đã huỷ',
};

const TABS = [
  { key: 'all', label: 'Tất cả', status: undefined },
  { key: 'staying', label: 'Đang ở', status: 'CHECKED_IN' },
  { key: 'booked', label: 'Lịch đặt', status: 'CONFIRMED' },
  { key: 'left', label: 'Đã trả', status: 'CHECKED_OUT' },
];

const EMPTY_SEARCH = { keyword: '', checkIn: '', checkOut: '' };
const PAGE_SIZE = 8;

export default function AdminRoomDetailPage() {
  const { roomId } = useParams();
  const { data: room, isLoading: roomLoading } = useGetRoomQuery(roomId);

  const [tab, setTab] = useState('all');
  const [draft, setDraft] = useState(EMPTY_SEARCH);
  const [applied, setApplied] = useState(EMPTY_SEARCH);
  const [page, setPage] = useState(1);
  const [detailBooking, setDetailBooking] = useState(null);
  const [walkInOpen, setWalkInOpen] = useState(false);

  const activeStatus = TABS.find((t) => t.key === tab)?.status;

  const { data, isFetching } = useGetBookingsQuery({
    roomId,
    status: activeStatus,
    search: applied.keyword || undefined,
    checkIn: applied.checkIn || undefined,
    checkOut: applied.checkOut || undefined,
    page,
    limit: PAGE_SIZE,
  });

  const bookings = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const applySearch = () => {
    if (Boolean(draft.checkIn) !== Boolean(draft.checkOut)) {
      toast.error('Chọn cả từ ngày và đến ngày');
      return;
    }
    setPage(1);
    setApplied(draft);
  };

  const resetSearch = () => {
    setDraft(EMPTY_SEARCH);
    setApplied(EMPTY_SEARCH);
    setPage(1);
  };

  const meta = room
    ? (ROOM_STATUS_META[room.status] ?? ROOM_STATUS_META.AVAILABLE)
    : null;

  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      <RoomInfoPanel room={room} loading={roomLoading} meta={meta} />

      <div className="space-y-6">
        <SearchCard
          draft={draft}
          onDraftChange={setDraft}
          onApply={applySearch}
          onReset={resetSearch}
        />

        <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-blue-600" />
              <h2 className="text-base font-bold text-gray-900">
                Thông tin khách hàng
              </h2>
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">
                {total} đơn
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => {
                    setTab(t.key);
                    setPage(1);
                  }}
                  className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
                    tab === t.key
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-500 hover:bg-gray-50'
                  }`}
                >
                  {t.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setWalkInOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
              >
                <Plus size={14} /> Tạo đặt phòng
              </button>
            </div>
          </div>

          <BookingTable
            bookings={bookings}
            isFetching={isFetching}
            onOpenDetail={setDetailBooking}
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-gray-100 px-4 py-3 text-sm">
              <span className="text-gray-500">
                Trang {page}/{totalPages}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 font-semibold text-gray-600 disabled:opacity-40 hover:bg-gray-50"
                >
                  Trước
                </button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="rounded-lg border border-gray-200 px-3 py-1.5 font-semibold text-gray-600 disabled:opacity-40 hover:bg-gray-50"
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </section>
      </div>

      <BookingDetailModal
        booking={detailBooking}
        onClose={() => setDetailBooking(null)}
      />
      {room && (
        <WalkInBookingModal
          open={walkInOpen}
          onClose={() => setWalkInOpen(false)}
          room={room}
        />
      )}
    </div>
  );
}

function RoomInfoPanel({ room, loading, meta }) {
  const [updateStatus, { isLoading: updating }] = useUpdateRoomStatusMutation();

  const changeStatus = async (status) => {
    if (!room || status === room.status) return;
    try {
      await updateStatus({ roomId: room.roomId, status }).unwrap();
      toast.success(`Đã đổi phòng ${room.roomNumber} sang "${ROOM_STATUS_META[status].label}"`);
    } catch (err) {
      toast.error(err?.data?.message || 'Không thể đổi trạng thái phòng');
    }
  };

  return (
    <aside className="h-fit rounded-2xl border border-gray-200 bg-white p-5 shadow-sm lg:sticky lg:top-24">
      <Link
        to="/admin/rooms"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-gray-800"
      >
        <ArrowLeft size={15} /> Quay lại
      </Link>

      {loading || !room ? (
        <div className="flex justify-center py-16 text-gray-300">
          <Loader2 className="animate-spin" size={26} />
        </div>
      ) : (
        <>
          <h1 className="mt-4 text-lg font-bold text-gray-900">
            Thông tin phòng
          </h1>
          <p className="mt-1 text-2xl font-extrabold text-blue-600">
            P: {room.roomNumber}
            <span className="ml-2 text-sm font-medium text-gray-400">
              Tầng {room.floor}
            </span>
          </p>

          <dl className="mt-5 space-y-4 text-sm">
            <InfoRow icon={Users} label="Số người tối đa">
              {room.roomType?.capacity} người
            </InfoRow>
            <InfoRow icon={LayoutGrid} label="Loại phòng">
              {room.roomType?.name}
            </InfoRow>
            <InfoRow icon={FileText} label="Giá niêm yết">
              {room.roomType?.basePrice != null
                ? `${formatCurrency(room.roomType.basePrice)}/đêm`
                : '—'}
            </InfoRow>
            {room.roomType?.description && (
              <InfoRow icon={Info} label="Mô tả phòng">
                <span className="text-gray-500">{room.roomType.description}</span>
              </InfoRow>
            )}
          </dl>

          <div
            className={`mt-5 rounded-xl border p-3 text-sm ${meta?.badge} ${meta?.ring} ring-1 ring-inset`}
          >
            <p className="flex items-center gap-1.5 font-bold">
              <Info size={14} /> Trạng thái: {meta?.label}
            </p>
          </div>

          <div className="mt-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
              Đổi trạng thái
            </p>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(ROOM_STATUS_META)
                .filter((s) => s !== 'BOOKED')
                .map((status) => {
                  const m = ROOM_STATUS_META[status];
                  const active = status === room.status;
                  return (
                    <button
                      key={status}
                      type="button"
                      disabled={updating || active}
                      onClick={() => changeStatus(status)}
                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors disabled:cursor-not-allowed ${
                        active
                          ? `${m.badge} ring-1 ring-inset ${m.ring}`
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
                      {m.label}
                    </button>
                  );
                })}
            </div>
          </div>
        </>
      )}
    </aside>
  );
}

function InfoRow({ icon: Icon, label, children }) {
  return (
    <div className="flex gap-3">
      <Icon size={16} className="mt-0.5 shrink-0 text-gray-400" />
      <div>
        <dt className="text-xs font-semibold uppercase tracking-wider text-gray-400">
          {label}
        </dt>
        <dd className="mt-0.5 font-medium text-gray-800">{children}</dd>
      </div>
    </div>
  );
}

function SearchCard({ draft, onDraftChange, onApply, onReset }) {
  const update = (patch) => onDraftChange({ ...draft, ...patch });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onApply();
      }}
      className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm"
    >
      <div className="mb-4 flex items-center gap-2">
        <Search size={18} className="text-blue-600" />
        <h2 className="text-base font-bold text-gray-900">Tìm kiếm đặt phòng</h2>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Mã đặt / tên khách / email">
          <input
            value={draft.keyword}
            onChange={(e) => update({ keyword: e.target.value })}
            placeholder="VD: 1A2B3C4D hoặc Nguyễn Văn A"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </Field>
        <Field label="Từ ngày (check-in)">
          <input
            type="date"
            value={draft.checkIn}
            max={draft.checkOut || undefined}
            onChange={(e) => update({ checkIn: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </Field>
        <Field label="Đến ngày (check-out)">
          <input
            type="date"
            value={draft.checkOut}
            min={draft.checkIn || undefined}
            onChange={(e) => update({ checkOut: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </Field>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={onReset}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50"
        >
          Làm mới
        </button>
        <button
          type="submit"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          <Search size={15} /> Tìm kiếm
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-gray-500">
        {label}
      </span>
      {children}
    </label>
  );
}

function BookingTable({ bookings, isFetching, onOpenDetail }) {
  if (isFetching) {
    return (
      <div className="flex justify-center py-16 text-gray-300">
        <Loader2 className="animate-spin" size={26} />
      </div>
    );
  }
  if (bookings.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-gray-400">
        Không có đơn đặt phòng nào khớp bộ lọc.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-gray-100 text-left text-xs uppercase tracking-wider text-gray-400">
            <th className="px-4 py-3 font-semibold">STT</th>
            <th className="px-4 py-3 font-semibold">Mã đặt</th>
            <th className="px-4 py-3 font-semibold">Khách hàng</th>
            <th className="px-4 py-3 font-semibold">Liên hệ</th>
            <th className="px-4 py-3 font-semibold">Thời gian lưu trú</th>
            <th className="px-4 py-3 font-semibold">Trạng thái</th>
            <th className="px-4 py-3 text-right font-semibold">Hành động</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {bookings.map((b, i) => (
            <tr key={b.bookingId} className="text-gray-700">
              <td className="px-4 py-3 text-gray-400">{i + 1}</td>
              <td className="px-4 py-3">
                <span className="rounded bg-gray-100 px-1.5 py-0.5 font-mono text-xs font-bold text-gray-600">
                  {getBookingCode(b.bookingId)}
                </span>
              </td>
              <td className="px-4 py-3">
                <p className="font-semibold text-gray-900">
                  {b.guestInfo?.fullName || '—'}
                </p>
                <p className="text-xs text-gray-400">
                  {b.guestInfo?.email || 'Chưa có email'}
                </p>
              </td>
              <td className="px-4 py-3">
                <span className="flex items-center gap-1 text-gray-600">
                  <Phone size={12} /> {b.guestInfo?.phone || '—'}
                </span>
              </td>
              <td className="px-4 py-3">
                <span className="flex items-center gap-1.5 text-gray-600">
                  <CalendarDays size={13} className="text-gray-400" />
                  {formatDate(b.checkInDate)} → {formatDate(b.checkOutDate)}
                </span>
              </td>
              <td className="px-4 py-3">
                <StatusPill
                  value={b.status}
                  styles={BOOKING_STATUS_STYLES}
                  label={BOOKING_STATUS_LABELS[b.status] || b.status}
                />
              </td>
              <td className="px-4 py-3 text-right">
                <button
                  type="button"
                  onClick={() => onOpenDetail(b)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                    b.status === 'CHECKED_IN'
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'border border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {b.status === 'CHECKED_IN' ? 'Chi tiết' : 'Xem lại'}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
