// Class dùng chung cho ô nhập của khu quản trị. h-10 cố định để ô text, ô ngày (kiểu
// native cao hơn ô text) và nút cùng một chiều cao khi đặt chung một hàng.
export const inputClass =
  'h-10 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 placeholder:text-gray-400 transition-colors duration-200 hover:border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';

// Ô chọn (select) cùng chiều cao/viền với inputClass nhưng co theo nội dung.
export const selectClass =
  'h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm text-gray-800 transition-colors duration-200 hover:border-gray-300 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100';
