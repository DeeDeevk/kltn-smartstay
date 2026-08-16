import { useState } from "react";
import { Ruler, User, Heart } from "lucide-react";

export default function GeneralInfoRoom({ room }) {
  const [isFavorite, setIsFavorite] = useState(false);

  if (!room) return null;

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-2xl md:text-3xl font-semibold text-gray-900">
          {room.name}
        </h1>
        <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-gray-500">
          {room.size_m2 && (
            <span className="flex items-center gap-1.5">
              <Ruler size={15} /> {room.size_m2}m²
            </span>
          )}
          {room.capacity_people && (
            <span className="flex items-center gap-1.5">
              <User size={15} /> Tối đa {room.capacity_people} khách
            </span>
          )}
        </div>
      </div>

      <button
        onClick={() => setIsFavorite((prev) => !prev)}
        aria-label={isFavorite ? "Bỏ yêu thích" : "Lưu vào yêu thích"}
        className="shrink-0 w-11 h-11 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:border-rose-200 hover:text-rose-500 transition-colors"
      >
        <Heart size={19} className={isFavorite ? "fill-rose-500 text-rose-500" : ""} />
      </button>
    </div>
  );
}
