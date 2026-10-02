// Trạng thái duyệt của 1 dòng LocalEvent. Mọi dòng tạo qua form CRUD admin
// (LocalEventService.create) đều là 'approved' ngay lập tức, giống hệt hành vi trước khi
// có enum này. 'pending' chỉ áp dụng cho các dòng do luồng AI trích xuất tạo ra
// (LocalEventExtractionService) — bắt buộc phải được admin xem lại và duyệt
// (PATCH /local-events/:id/approve) thì LocalEventService.findForDate (được tool
// get_local_events của agent dùng) mới trả về cho khách.
export enum LocalEventStatus {
  APPROVED = 'approved',
  PENDING = 'pending',
}
