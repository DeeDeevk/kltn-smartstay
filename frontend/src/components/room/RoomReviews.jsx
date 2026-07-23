import { useState } from "react";
import StarIcon from "../../assets/icon/star.png";
import Review from "./Review";
import { useGetReviewsByRoomTypeQuery } from "../../services/review";
import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";

export default function RoomReviews({ averageRating, totalReviews }) {
  const { id } = useParams();
  const { data: reviewsData, isLoading } = useGetReviewsByRoomTypeQuery(id);
  const reviews = reviewsData?.data || [];

  const reviewsCount = reviews.length;
  const computedAverageRating = reviewsCount > 0
    ? reviews.reduce((sum, review) => sum + Number(review.rating || 0), 0) / reviewsCount
    : 0;

  const MAX = 8;
  const [showAll, setShowAll] = useState(false);

  const visibleReviews = showAll ? reviews : reviews.slice(0, MAX);

  if (isLoading) {
    return (
      <div className="flex justify-center p-10 bg-white rounded-xl border border-gray-100 italic font-medium text-gray-400">
        <Loader2 className="animate-spin mr-2" /> Đang tải đánh giá...
      </div>
    );
  }

  return (
    <div className="h-fit rounded-xl border border-gray-200 bg-white flex p-6 flex-col shadow-sm">
      {/* Header */}
      <div className="flex items-center gap-2 mb-6">
        <img src={StarIcon} alt="" className="w-[20px] h-[20px]" />
        <span className="font-bold text-2xl text-gray-900">
          {Number(computedAverageRating).toFixed(1)}
        </span>
        <span className="text-gray-500 font-medium ml-1">
          ({reviewsCount} đánh giá)
        </span>
      </div>

      {/* Reviews grid */}
      {reviews.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {visibleReviews.map((review) => (
            <Review key={review.id} {...review} />
          ))}
        </div>
      ) : (
        <div className="py-10 text-center bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <p className="text-gray-400 italic">Chưa có đánh giá nào cho loại phòng này.</p>
        </div>
      )}

      {/* Show all button */}
      {reviews.length > MAX && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="mt-6 text-sm font-bold text-blue-600 hover:text-blue-700 bg-blue-50 px-4 py-2 rounded-lg transition-colors self-start"
        >
          {showAll
            ? "Thu gọn đánh giá"
            : `Xem tất cả ${reviews.length} đánh giá`}
        </button>
      )}
    </div>
  );
}
