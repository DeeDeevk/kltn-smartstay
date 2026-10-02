// Độ trễ so le cho phần tử thứ `index` trong danh sách (dùng kèm class anim-fade-up /
// anim-fade-in). `max` chặn độ trễ tối đa để danh sách dài không phải chờ lâu mới hiện
// hết (từ phần tử thứ `max` trở đi cùng xuất hiện một lúc).
export function stagger(index, step = 45, max = 10) {
  return { animationDelay: `${Math.min(index, max) * step}ms` };
}
