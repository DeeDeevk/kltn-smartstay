import StarIcon from "../../assets/icon/star.png";

export default function Review({ user, rating, comment, created_at }) {
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const username = user?.name || "Khách hàng";
  const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random`;

  return (
    <div className="flex flex-col gap-4 p-5 bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow">
      {/* Header: User Info & Rating */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-blue-50">
            <img src={avatarUrl} alt={username} className="w-full h-full object-cover" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-gray-900">{username}</span>
            <span className="text-[11px] text-gray-400 font-medium uppercase tracking-tight">
              {formatDate(created_at)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 bg-yellow-50 px-2.5 py-1 rounded-lg border border-yellow-100">
          <span className="text-sm font-bold text-yellow-700">{Number(rating).toFixed(1)}</span>
          <img src={StarIcon} alt="rating" className="w-4 h-4" />
        </div>
      </div>

      {/* Comment Body */}
      <div className="text-sm text-gray-600 leading-relaxed italic">
        {comment}
      </div>
    </div>
  );
}
