// Trạng thái duyệt của 1 dòng LocalPlace. Dòng tạo thủ công qua form CRUD admin
// (LocalPlaceService.create) là APPROVED ngay — admin tự nhập đủ tên/địa chỉ/toạ độ nên
// không cần duyệt lại. Dòng do LocalPlaceExtractionService tạo ra từ URL/text luôn bắt đầu
// ở PENDING (và address/latitude/longitude = null) — phải chờ admin tự bổ sung địa chỉ rồi
// bấm duyệt (PATCH /local-places/:id/approve) thì get_local_highlights (tool của agent)
// mới thấy được.
export enum LocalPlaceStatus {
  APPROVED = 'APPROVED',
  PENDING = 'PENDING',
}
