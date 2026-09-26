// Danh sách chủ đề CỐ ĐỊNH mà AI được phép gán cho một khía cạnh trong đánh giá.
//
// Bắt buộc phải là enum đóng, không để model tự đặt tên chủ đề: nếu thả tự do thì
// "nhân viên", "lễ tân", "thái độ phục vụ" sẽ thành ba nhóm riêng và không đếm/xếp
// hạng được nữa — mất sạch giá trị của việc phân tích. Model trả về chủ đề lạ thì
// quy hết về OTHER.
export enum ReviewTopic {
  CLEANLINESS = 'CLEANLINESS', // vệ sinh phòng
  ROOM_CONDITION = 'ROOM_CONDITION', // cơ sở vật chất, đồ đạc cũ/hỏng
  NOISE = 'NOISE', // tiếng ồn
  STAFF = 'STAFF', // thái độ nhân viên
  CHECKIN = 'CHECKIN', // thủ tục nhận/trả phòng
  BREAKFAST = 'BREAKFAST', // ăn uống
  AMENITIES = 'AMENITIES', // tiện nghi (hồ bơi, gym, điều hoà...)
  LOCATION = 'LOCATION', // vị trí
  VALUE = 'VALUE', // giá so với chất lượng
  WIFI = 'WIFI',
  OTHER = 'OTHER',
}

export const REVIEW_TOPIC_VALUES = Object.values(ReviewTopic);

export enum AspectSentiment {
  POSITIVE = 'POSITIVE',
  NEGATIVE = 'NEGATIVE',
}

export interface ReviewAspect {
  topic: ReviewTopic;
  sentiment: AspectSentiment;
  // Trích NGUYÊN VĂN từ đánh giá. Ép model bám vào chữ khách thật sự viết thay vì tự
  // suy diễn, và admin đối chiếu được ngay là AI hiểu đúng hay sai.
  quote: string;
}

export interface ReviewAnalysis {
  aspects: ReviewAspect[];
  summary: string;
  // Sao cao nhưng nội dung chê (hoặc ngược lại). Khách hay chấm sao rộng tay nên nhóm
  // này lọc theo sao sẽ bỏ sót hoàn toàn — đây là thứ chỉ đọc nội dung mới thấy.
  toneMismatch: boolean;
  analyzedAt: string;
}
