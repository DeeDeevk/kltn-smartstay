import { useState } from "react";
import { Wifi, Snowflake, Tv, UtensilsCrossed, WashingMachine, CircleParking, Waves } from "lucide-react";
import TienIch from "./tienich.jsx";

const defaultAmenities = [
  { icon: Wifi, name: "WiFi miễn phí" },
  { icon: Snowflake, name: "Điều hòa" },
  { icon: Tv, name: "TV màn hình phẳng" },
  { icon: UtensilsCrossed, name: "Bếp nhỏ" },
  { icon: WashingMachine, name: "Máy giặt" },
  { icon: CircleParking, name: "Bãi đỗ xe" },
  { icon: Waves, name: "Hồ bơi" },
];

const MAX_VISIBLE = 6;

export default function RoomAmenities({ amenities: propsAmenities = [] }) {
  const amenities = propsAmenities.length > 0 ? propsAmenities : defaultAmenities;
  const [showAll, setShowAll] = useState(false);

  const visibleAmenities = showAll ? amenities : amenities.slice(0, MAX_VISIBLE);

  return (
    <div className="h-fit rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="font-bold text-xl text-gray-900 mb-4">Tiện nghi nổi bật</h2>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {visibleAmenities.map((item, index) => (
          <TienIch key={index} {...item} />
        ))}
      </div>

      {amenities.length > MAX_VISIBLE && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-4 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
        >
          {showAll ? "Thu gọn" : `Xem tất cả ${amenities.length} tiện nghi`}
        </button>
      )}
    </div>
  );
}
