import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Heart, Loader2 } from "lucide-react";
import Header from "../layout/Header";
import Footer from "../layout/Footer";
import RoomCard from "../searchroom/RoomCard";
import { favoriteApi } from "../../services/favorite";
import { useSocket } from "../../context/SocketContext";

// Các loại phòng khách đã bấm tim. Bỏ tim ở trang chi tiết phòng thì danh sách tự cập nhật
// nhờ invalidatesTags ['Favorite']. Thêm/bỏ tim ở thiết bị khác (mobile, hoặc tab/máy
// khác) thì không có mutation nào ở đây để invalidate -> nghe socket 'favorite:updated'
// (bắn vào room riêng của user, xem RealtimeGateway) để tự làm mới theo.
export default function FavoritesPage() {
  const { t } = useTranslation();
  const {
    data: favorites = [],
    isLoading,
    isError,
  } = favoriteApi.useGetMyFavoritesQuery();

  const dispatch = useDispatch();
  const socket = useSocket();
  useEffect(() => {
    const handleFavoriteUpdated = () => {
      dispatch(favoriteApi.util.invalidateTags(["Favorite"]));
    };
    socket.on("favorite:updated", handleFavoriteUpdated);
    return () => socket.off("favorite:updated", handleFavoriteUpdated);
  }, [socket, dispatch]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            {t("favorites.title")}
          </h1>
          {favorites.length > 0 && (
            <p className="mt-1 text-sm text-gray-500">
              {t("favorites.count", { count: favorites.length })}
            </p>
          )}
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-blue-600" size={32} />
          </div>
        ) : isError ? (
          <p className="text-center text-red-500 py-20">
            {t("favorites.loadError")}
          </p>
        ) : favorites.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-20 text-gray-500">
            <Heart size={40} className="text-gray-300" />
            <p>{t("favorites.empty")}</p>
            <Link
              to="/searchrooms"
              className="text-blue-600 font-medium hover:underline"
            >
              {t("favorites.explore")}
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {favorites.map((room) => (
              <RoomCard key={room.roomTypeId} room={room} />
            ))}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
