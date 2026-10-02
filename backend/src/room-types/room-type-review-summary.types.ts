// Kết quả AI tổng hợp NHIỀU đánh giá của 1 loại phòng thành vài ý khen/chê ngắn gọn — khác
// hẳn ReviewAnalysis (review-analysis.types.ts), vốn phân tích TỪNG đánh giá riêng lẻ lúc
// khách gửi. Lưu trực tiếp trên RoomType.reviewSummary (jsonb) làm cache, xem
// RoomTypeReviewSummaryService để biết khi nào tính lại.
export interface RoomTypeReviewSummary {
  // Tối đa 4 ý, có thể rỗng nếu Gemini không rút ra được ý khen nào rõ ràng.
  positives: string[];
  // Tối đa 4 ý, rỗng = không có ý chê nào đáng kể.
  negatives: string[];
  // 1 câu nhận xét tổng quan.
  overallComment: string;
  // Số đánh giá đã dùng để tổng hợp ra kết quả này — so với tổng số đánh giá HIỆN TẠI của
  // loại phòng để biết cache đã cũ (có thêm đánh giá mới) hay chưa, không cần cơ chế theo
  // dõi riêng (event, cron...).
  reviewCount: number;
  generatedAt: string;
}
