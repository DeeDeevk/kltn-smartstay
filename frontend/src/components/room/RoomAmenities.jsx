import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Wifi,
  Snowflake,
  Tv,
  UtensilsCrossed,
  WashingMachine,
  CircleParking,
  Waves,
  Wine,
  Coffee,
  Sun,
  Sofa,
  Bath,
  Sparkles,
  Briefcase,
  Lock,
  CheckCircle2,
} from "lucide-react";
import TienIch from "./tienich.jsx";

const defaultAmenityDefs = [
  { icon: Wifi, nameKey: "room.amenities.wifi" },
  { icon: Snowflake, nameKey: "room.amenities.ac" },
  { icon: Tv, nameKey: "room.amenities.tv" },
  { icon: UtensilsCrossed, nameKey: "room.amenities.kitchenette" },
  { icon: WashingMachine, nameKey: "room.amenities.washer" },
  { icon: CircleParking, nameKey: "room.amenities.parking" },
  { icon: Waves, nameKey: "room.amenities.pool" },
];

// amenities từ backend là string[] (Redux store chỉ được chứa dữ liệu serializable),
// nên icon component tương ứng chỉ được resolve ở đây, lúc render — không lưu vào store.
const AMENITY_ICON_RULES = [
  [/wifi/i, Wifi],
  [/điều hòa|dieu hoa|air/i, Snowflake],
  [/tv|tivi/i, Tv],
  [/minibar/i, Wine],
  [/cà phê|coffee/i, Coffee],
  [/ban công|balcony/i, Sun],
  [/phòng khách|living/i, Sofa],
  [/bồn tắm|bathtub/i, Bath],
  [/dọn phòng|housekeeping/i, Sparkles],
  [/làm việc|desk|work/i, Briefcase],
  [/két an toàn|safe/i, Lock],
  [/giặt|laundry/i, WashingMachine],
  [/đỗ xe|parking/i, CircleParking],
  [/hồ bơi|pool/i, Waves],
];

function iconForAmenity(name) {
  const rule = AMENITY_ICON_RULES.find(([pattern]) => pattern.test(name));
  return rule ? rule[1] : CheckCircle2;
}

function toDisplayAmenity(item) {
  return typeof item === "string" ? { icon: iconForAmenity(item), name: item } : item;
}

const MAX_VISIBLE = 6;

export default function RoomAmenities({ amenities: propsAmenities = [] }) {
  const { t } = useTranslation();
  const defaultAmenities = defaultAmenityDefs.map((item) => ({ icon: item.icon, name: t(item.nameKey) }));
  const amenities =
    propsAmenities.length > 0 ? propsAmenities.map(toDisplayAmenity) : defaultAmenities;
  const [showAll, setShowAll] = useState(false);

  const visibleAmenities = showAll ? amenities : amenities.slice(0, MAX_VISIBLE);

  return (
    <div className="h-fit rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="font-bold text-xl text-gray-900 mb-4">{t('room.amenities.title')}</h2>

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
          {showAll ? t('room.amenities.collapse') : t('room.amenities.viewAll', { count: amenities.length })}
        </button>
      )}
    </div>
  );
}
