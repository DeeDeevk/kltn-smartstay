// Dải chip "còn X/Y" theo loại phòng — đơn online chỉ giữ chỗ theo loại phòng (chưa
// gắn phòng vật lý) nên lưới phòng bên dưới không thấy được, phải xem ở đây. Bấm 1 chip
// để lọc sơ đồ theo loại đó, bấm "Tất cả" để bỏ lọc.
export default function RoomTypeSummaryBar({
  summary,
  selectedRoomType,
  onSelectRoomType,
}) {
  if (!summary?.roomTypes?.length) return null;

  const allSelected = !selectedRoomType;
  const totalAvailable = summary.roomTypes.reduce((sum, rt) => sum + rt.available, 0);
  const totalRooms = summary.roomTypes.reduce((sum, rt) => sum + rt.total, 0);

  return (
    <section className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onSelectRoomType("")}
        aria-pressed={allSelected}
        title={`Tất cả loại phòng: còn ${totalAvailable}/${totalRooms} phòng`}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${
          allSelected
            ? "border-blue-500 bg-blue-50 text-blue-700"
            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:shadow-sm"
        }`}
      >
        <span className="font-medium">Tất cả</span>
        <span className="font-bold tabular-nums text-emerald-600">
          {totalAvailable}/{totalRooms}
        </span>
      </button>

      {summary.roomTypes.map((rt) => {
        const soldOut = rt.available === 0;
        const selected = selectedRoomType === rt.name;

        const tone = selected
          ? "border-blue-500 bg-blue-50 text-blue-700"
          : soldOut
            ? "border-red-200 bg-red-50 text-red-700"
            : "border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:shadow-sm";

        return (
          <button
            key={rt.roomTypeId}
            type="button"
            onClick={() => onSelectRoomType(rt.name)}
            aria-pressed={selected}
            title={`${rt.name}: đã đặt ${rt.booked}/${rt.total} phòng${
              rt.unassigned ? `, ${rt.unassigned} đơn chưa xếp phòng` : ""
            }`}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs transition ${tone}`}
          >
            <span
              aria-hidden="true"
              className={`h-1.5 w-1.5 rounded-full ${soldOut ? "bg-red-500" : "bg-emerald-500"}`}
            />
            <span className="font-medium">{rt.name}</span>
            <span
              className={`font-bold tabular-nums ${soldOut ? "text-red-600" : "text-emerald-600"}`}
            >
              {soldOut ? "Hết" : `${rt.available}/${rt.total}`}
            </span>
            {rt.unassigned > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                {rt.unassigned} chờ xếp
              </span>
            )}
          </button>
        );
      })}
    </section>
  );
}
