import { Sparkles, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useGetRoomTypeReviewSummaryQuery } from '../../services/review';

// Khối "AI tóm tắt đánh giá" — nội dung do Gemini sinh ra (positives/negatives/
// overallComment) LUÔN là tiếng Việt bất kể ngôn ngữ giao diện đang chọn (cùng quy ước với
// nội dung review gốc của khách — comment/reply cũng không tự dịch), chỉ nhãn/tiêu đề xung
// quanh mới theo i18n. Phù hợp vì khách sạn và phần lớn đánh giá đều là tiếng Việt.
//
// Backend tự quyết định có trả kết quả hay không (null nếu chưa đủ 3 đánh giá, hoặc nếu
// Gemini lỗi mà cũng chưa có cache cũ) — ở đây chỉ cần ẩn hẳn component khi không có dữ
// liệu, không cần tự kiểm tra điều kiện gì thêm.
export default function RoomReviewAiSummary({ roomTypeId }) {
    const { t } = useTranslation();
    const { data: summary, isLoading } = useGetRoomTypeReviewSummaryQuery(roomTypeId, {
        skip: !roomTypeId,
    });

    if (isLoading) {
        return (
            <div className="mb-6 h-32 animate-pulse rounded-xl border border-gray-100 bg-gray-50" />
        );
    }

    // null = chưa đủ đánh giá để tổng hợp, hoặc Gemini lỗi mà chưa có cache — im lặng ẩn
    // đi, đây là tính năng phụ trợ, không được làm trang chi tiết phòng trông "thiếu" khi
    // thiếu dữ liệu.
    if (!summary) return null;

    return (
        <div className="mb-6 rounded-xl border border-indigo-100 bg-indigo-50/40 p-5">
            <div className="mb-3 flex items-center gap-2">
                <Sparkles size={18} className="text-indigo-600" />
                <h3 className="font-bold text-gray-900">{t('room.reviews.aiSummaryTitle')}</h3>
                <span className="ml-auto rounded-full bg-indigo-100 px-2.5 py-0.5 text-[11px] font-semibold text-indigo-700">
                    {t('room.reviews.aiSummaryBadge')}
                </span>
            </div>

            {summary.overallComment && (
                <p className="mb-4 text-sm italic text-gray-700">“{summary.overallComment}”</p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
                {summary.positives.length > 0 && (
                    <div>
                        <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-green-700">
                            <ThumbsUp size={14} /> {t('room.reviews.aiSummaryPositives')}
                        </div>
                        <ul className="space-y-1">
                            {summary.positives.map((item, idx) => (
                                <li key={idx} className="text-sm text-gray-700">
                                    • {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div>
                    <div className="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-orange-700">
                        <ThumbsDown size={14} /> {t('room.reviews.aiSummaryNegatives')}
                    </div>
                    {summary.negatives.length > 0 ? (
                        <ul className="space-y-1">
                            {summary.negatives.map((item, idx) => (
                                <li key={idx} className="text-sm text-gray-700">
                                    • {item}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-sm italic text-gray-400">
                            {t('room.reviews.aiSummaryNoNegatives')}
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}
