// Nguồn kích hoạt 1 lần quét tự động sự kiện — xem EventScanRun.triggeredBy.
export enum EventScanTriggeredBy {
  // Admin tự bấm "Quét sự kiện gần đây" ở trang cài đặt.
  MANUAL = 'MANUAL',
  // Job định kỳ hàng tuần (LocalEventAutoScanJob) tự chạy, không có người kích hoạt.
  CRON = 'CRON',
}
