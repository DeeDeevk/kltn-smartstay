// Nguồn gốc của 1 dòng LocalPlace — xem LocalPlace entity. Cùng cấu trúc với
// LocalEventSource nhưng là enum riêng (không dùng chung) vì LocalPlace là một domain dữ
// liệu khác hẳn LocalEvent (địa điểm vs sự kiện), tránh 2 khái niệm độc lập vô tình bị
// ràng buộc chung 1 enum chỉ vì value trùng tên.
export enum LocalPlaceSource {
  MANUAL = 'MANUAL',
  AI_SUGGESTED = 'AI_SUGGESTED',
}
