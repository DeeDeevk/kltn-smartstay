// Kết quả upload trung lập giữa các nhà cung cấp lưu trữ (R2, Cloudinary) — controller
// chỉ làm việc với shape này nên đổi provider không ảnh hưởng response trả cho frontend.
export interface UploadedImage {
  url: string;
  publicId: string;
}
