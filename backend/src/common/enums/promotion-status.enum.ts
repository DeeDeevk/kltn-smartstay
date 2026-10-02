// Trạng thái của 1 chương trình khuyến mãi.
//
// LƯU Ý: cột `status` trong DB chỉ bao giờ chứa ACTIVE hoặc PAUSED — hai trạng thái
// do admin chủ động đặt. EXPIRED là trạng thái SUY RA lúc đọc (hết hạn theo endDate
// hoặc hết lượt dùng), không ghi xuống DB. Làm vậy để không cần job chạy nền quét và
// cập nhật cột, và không bao giờ có chuyện DB ghi ACTIVE trong khi mã đã hết hạn.
export enum PromotionStatus {
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  EXPIRED = 'EXPIRED',
}
