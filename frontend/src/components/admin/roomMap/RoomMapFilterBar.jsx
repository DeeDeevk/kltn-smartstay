import { Filter, RotateCcw } from 'lucide-react';

// Thanh lọc phía trên lưới phòng: khoảng ngày check-in/out (đối chiếu lịch đặt)
// + loại phòng. Nút "Lọc phòng" mới thực sự áp khoảng ngày lên query backend.
export default function RoomMapFilterBar({
  draft,
  onDraftChange,
  onApply,
  onReset,
  roomTypeNames,
  isFetching,
}) {
  const update = (patch) => onDraftChange({ ...draft, ...patch });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onApply();
      }}
      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]">
        <Field label="Ngày check-in">
          <input
            type="date"
            value={draft.checkIn}
            max={draft.checkOut || undefined}
            onChange={(e) => update({ checkIn: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </Field>

        <Field label="Ngày check-out">
          <input
            type="date"
            value={draft.checkOut}
            min={draft.checkIn || undefined}
            onChange={(e) => update({ checkOut: e.target.value })}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          />
        </Field>

        <Field label="Loại phòng">
          <select
            value={draft.roomType}
            onChange={(e) => update({ roomType: e.target.value })}
            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
          >
            <option value="">Tất cả loại phòng</option>
            {roomTypeNames.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex items-end gap-2">
          <button
            type="submit"
            disabled={isFetching}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-60 lg:flex-none"
          >
            <Filter size={15} /> Lọc phòng
          </button>
          <button
            type="button"
            onClick={onReset}
            title="Đặt lại bộ lọc"
            className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 hover:text-gray-700"
          >
            <RotateCcw size={15} />
          </button>
        </div>
      </div>

      {draft.checkIn && draft.checkOut && (
        <p className="mt-3 text-xs text-gray-400">
          Phòng có lịch đặt giao với khoảng ngày này sẽ hiển thị nhãn “Đã đặt”.
        </p>
      )}
    </form>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-gray-400">
        {label}
      </span>
      {children}
    </label>
  );
}
