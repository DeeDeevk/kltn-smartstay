import { useState } from "react";

import TienIch from "./tienich.jsx";
export default function RoomAmenities({ amenities: propsAmenities = [] }) {
  const defaultAmenities = [
    { url: "https://picsum.photos/200?1", name: "WiFi" },
    { url: "https://picsum.photos/200?2", name: "Điều hòa" },
    { url: "https://picsum.photos/200?3", name: "TV" },
    { url: "https://picsum.photos/200?4", name: "Bếp" },
    { url: "https://picsum.photos/200?5", name: "Máy giặt" },
    { url: "https://picsum.photos/200?6", name: "Bãi đỗ xe" },
    { url: "https://picsum.photos/200?7", name: "Hồ bơi" },
  ];

  const amenities = propsAmenities.length > 0 ? propsAmenities : defaultAmenities;

  const MAX = 6;
  const [showAll, setShowAll] = useState(false);

  const visibleAmenities = showAll
    ? amenities
    : amenities.slice(0, MAX);
  return (
    <div className="h-fit rounded-xl border-2 border-dashed border-purple-300 flex flex-col p-4">
      <div className="">
        <h1 className="font-bold">Tiện nghi nổi bật</h1>
      </div>
      {/* Grid 3 cột */}
      <div className="grid grid-cols-3 gap-2 mt-2">
        {visibleAmenities.map((item, index) => (
          <TienIch key={index} {...item} />
        ))}
      </div>


      {/* Button xem tất cả */}
      {amenities.length > MAX && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-3 text-sm font-medium text-blue-600 hover:underline"
        >
          {showAll
            ? "Thu gọn"
            : `Xem tất cả ${amenities.length} tiện nghi`}
        </button>
      )}

    </div>
  )
}
