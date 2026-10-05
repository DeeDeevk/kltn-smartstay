// Loại tệp đính kèm trên 1 Message — hiện chỉ hỗ trợ ảnh (khách gửi ảnh chụp QR chuyển
// khoản để nhân viên xác minh bằng mắt qua chat). Giữ enum riêng (không dùng chung với
// upload.types.ts) để sau này mở rộng thêm loại khác (file PDF...) không ảnh hưởng tới
// phần upload ảnh phòng/avatar hiện có.
export enum MessageAttachmentType {
  IMAGE = 'IMAGE',
}
