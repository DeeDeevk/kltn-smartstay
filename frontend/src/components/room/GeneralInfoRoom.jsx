import { Ruler, User, Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { useAuth } from "../../context/AuthContext";
import { favoriteApi } from "../../services/favorite";

export default function GeneralInfoRoom({ room }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated } = useAuth();

  // Chưa đăng nhập thì không gọi API (sẽ bị 401).
  const { data: favorites = [] } = favoriteApi.useGetMyFavoritesQuery(
    undefined,
    {
      skip: !isAuthenticated,
    },
  );
  const [addFavorite, { isLoading: adding }] =
    favoriteApi.useAddFavoriteMutation();
  const [removeFavorite, { isLoading: removing }] =
    favoriteApi.useRemoveFavoriteMutation();

  if (!room) return null;

  const roomTypeId = room.roomTypeId || room.id;
  const isFavorite = favorites.some((f) => f.roomTypeId === roomTypeId);

  const toggleFavorite = async () => {
    if (!isAuthenticated) {
      toast.info(t("room.favoriteLoginRequired"));
      navigate("/login", { state: { from: location.pathname } });
      return;
    }
    try {
      await (isFavorite ? removeFavorite : addFavorite)(roomTypeId).unwrap();
    } catch {
      toast.error(t("common.error"));
    }
  };

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
              <User size={15} />{" "}
              {t("room.maxGuests", { count: room.capacity_people })}
            </span>
          )}
        </div>
      </div>

      <button
        onClick={toggleFavorite}
        disabled={adding || removing}
        aria-label={
          isFavorite ? t("room.removeFromFavorites") : t("room.addToFavorites")
        }
        aria-pressed={isFavorite}
        className="shrink-0 w-11 h-11 rounded-full border border-gray-200 bg-white flex items-center justify-center text-gray-500 hover:border-rose-200 hover:text-rose-500 transition-colors disabled:opacity-60"
      >
        <Heart
          size={19}
          className={isFavorite ? "fill-rose-500 text-rose-500" : ""}
        />
      </button>
    </div>
  );
}
