// Kết quả 1 lần quét tự động sự kiện — xem EventScanRun.status.
export enum EventScanStatus {
  SUCCESS = 'SUCCESS',
  // Dừng trước khi gọi Gemini (HotelConfig chưa cấu hình địa chỉ) hoặc lỗi khi gọi
  // Gemini/lưu DB — luôn kèm errorMessage giải thích lý do.
  FAILED = 'FAILED',
}
