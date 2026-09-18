// expected = question CHÍNH XÁC của FAQ đúng trong DB (copy từ seed-faqs.ts),
//            hoặc null nếu câu hỏi KHÔNG có đáp án trong kho FAQ.
// Dùng question thay vì faqId vì faqId là UUID ngẫu nhiên, mỗi máy seed ra khác nhau.
export interface EvalItem {
  query: string;
  expected: string | null;
}

export const EVAL_SET: EvalItem[] = [
  // ── Có đáp án: mỗi FAQ 2 cách hỏi, viết LIỀN NHAU ──
  {
    query: 'mấy giờ tôi phải rời phòng?',
    expected: 'Giờ trả phòng (check-out) là mấy giờ?',
  },
  {
    query: 'checkout muộn nhất lúc nào',
    expected: 'Giờ trả phòng (check-out) là mấy giờ?',
  },

  {
    query: 'quên pass đăng nhập',
    expected: 'Tôi quên mật khẩu thì làm thế nào?',
  },
  {
    query: 'lấy lại mat khau kieu gi',
    expected: 'Tôi quên mật khẩu thì làm thế nào?',
  },

  {
    query: 'ở lố giờ trả phòng có mất thêm tiền ko',
    expected: 'Trả phòng trễ có bị tính phí không?',
  },
  {
    query: 'trả phòng lúc 3h chiều thì sao',
    expected: 'Trả phòng trễ có bị tính phí không?',
  },

  {
    query: 'Tôi có thể book phòng ở như thế nào',
    expected: 'Làm thế nào để đặt phòng trên website?',
  },
  {
    query: 'Làm sao để đặt được phòng',
    expected: 'Làm thế nào để đặt phòng trên website?',
  },

  {
    query: 'Dat phong co can tao tai khoan khong',
    expected: 'Tôi có cần tạo tài khoản để đặt phòng không?',
  },
  {
    query: 'Có bắt buộc phải tạo tài khoản không',
    expected: 'Tôi có cần tạo tài khoản để đặt phòng không?',
  },

  {
    query: 'Co the dat phong cho nguoi khac khong',
    expected: 'Tôi có thể đặt phòng cho người khác (người thân, bạn bè) không?',
  },
  {
    query: 'Tôi có thể đặt phòng cho người khác không',
    expected: 'Tôi có thể đặt phòng cho người khác (người thân, bạn bè) không?',
  },

  {
    query: 'Một lần có thể đặt bao nhiêu phòng',
    expected:
      'Một lần đặt được bao nhiêu phòng? Muốn đặt nhiều phòng thì làm sao?',
  },
  {
    query: 'toi có thể đặt nhiều phòng ko',
    expected:
      'Một lần đặt được bao nhiêu phòng? Muốn đặt nhiều phòng thì làm sao?',
  },

  {
    query: 'Suc chua toi da 1 phong la bao nhieu',
    expected: 'Một phòng ở được tối đa bao nhiêu người?',
  },
  {
    query: '1 phòng ở nhiều nhất là bao nhiêu người',
    expected: 'Một phòng ở được tối đa bao nhiêu người?',
  },

  {
    query: 'Khi đặt phòng, tôi có được chọn phòng và tầng không',
    expected: 'Tôi có được chọn số phòng hoặc tầng cụ thể không?',
  },
  {
    query: 'Số phòng hoặc tầng cụ thể có được chọn không',
    expected: 'Tôi có được chọn số phòng hoặc tầng cụ thể không?',
  },

  {
    query: 'Tiền đặt đc tính như thế nào',
    expected: 'Tiền phòng được tính như thế nào?',
  },
  {
    query: 'tien phong se tinh ra sao',
    expected: 'Tiền phòng được tính như thế nào?',
  },

  {
    query: 'Trang thai don dat phong',
    expected: 'Đơn đặt phòng có những trạng thái nào?',
  },
  {
    query: 'đơn đặt phòng có những trạng thái gì?',
    expected: 'Đơn đặt phòng có những trạng thái nào?',
  },

  {
    query: 'Khi nào đơn của tôi được xác nhận?',
    expected: 'Đơn của tôi đang "Chờ xác nhận" thì bao giờ được xác nhận?',
  },
  {
    query: 'Đơn chờ xác nhận của tôi bao lâu mới được xác nhận?',
    expected: 'Đơn của tôi đang "Chờ xác nhận" thì bao giờ được xác nhận?',
  },

  {
    query: 'xem lại đơn đã đặt ở đâu vậy',
    expected: 'Xem lại thông tin đơn đặt phòng của tôi ở đâu?',
  },
  {
    query: 'muon kiem tra lai booking cua minh',
    expected: 'Xem lại thông tin đơn đặt phòng của tôi ở đâu?',
  },

  {
    query: 'chatbot này đặt phòng giúp tôi được không',
    expected: 'Trợ lý ảo có thể giúp tôi đặt phòng không?',
  },
  {
    query: 'bạn có thể book phòng hộ mình ko',
    expected: 'Trợ lý ảo có thể giúp tôi đặt phòng không?',
  },

  // ── Huỷ / thay đổi ──
  {
    query: 'hủy đặt phòng có bị mất tiền không',
    expected: 'Huỷ phòng có mất phí không?',
  },
  {
    query: 'cancel booking co mat phi ko',
    expected: 'Huỷ phòng có mất phí không?',
  },

  { query: 'nút hủy đơn nằm ở đâu', expected: 'Làm sao để huỷ đơn đặt phòng?' },
  {
    query: 'tôi không muốn đi nữa, hủy đơn thế nào',
    expected: 'Làm sao để huỷ đơn đặt phòng?',
  },

  {
    query: 'đã chuyển khoản rồi giờ hủy thì có lấy lại tiền được không',
    expected:
      'Đã thanh toán chuyển khoản rồi thì huỷ đơn có được hoàn tiền không?',
  },
  {
    query: 'hoan tien khi huy don',
    expected:
      'Đã thanh toán chuyển khoản rồi thì huỷ đơn có được hoàn tiền không?',
  },

  {
    query: 'tôi muốn dời ngày nhận phòng sang tuần sau',
    expected: 'Tôi muốn đổi ngày ở hoặc đổi loại phòng thì làm thế nào?',
  },
  {
    query: 'đổi từ phòng standard lên deluxe được không',
    expected: 'Tôi muốn đổi ngày ở hoặc đổi loại phòng thì làm thế nào?',
  },

  // ── Nhận / trả phòng ──
  {
    query: 'mấy giờ thì được vào phòng',
    expected: 'Giờ nhận phòng (check-in) là mấy giờ?',
  },
  { query: 'gio check in', expected: 'Giờ nhận phòng (check-in) là mấy giờ?' },

  {
    query: 'tôi tới lúc 9h sáng thì có vào phòng luôn được không',
    expected: 'Tôi có thể nhận phòng sớm hơn 14:00 không?',
  },
  {
    query: 'early check-in được không',
    expected: 'Tôi có thể nhận phòng sớm hơn 14:00 không?',
  },

  {
    query: 'đến khách sạn rồi thì làm thủ tục gì',
    expected: 'Khi đến nhận phòng tôi cần làm gì?',
  },
  {
    query: 'check in can dua ma gi cho le tan',
    expected: 'Khi đến nhận phòng tôi cần làm gì?',
  },

  {
    query: 'không đặt online, đến thẳng khách sạn thuê phòng được không',
    expected: 'Tôi có thể đến đặt phòng trực tiếp tại quầy không?',
  },
  {
    query: 'walk-in có phòng không',
    expected: 'Tôi có thể đến đặt phòng trực tiếp tại quầy không?',
  },

  {
    query: 'lúc checkout phải trả thêm những gì',
    expected: 'Khi trả phòng cần thanh toán những khoản gì?',
  },
  {
    query: 'tra phong co phat sinh chi phi gi khong',
    expected: 'Khi trả phòng cần thanh toán những khoản gì?',
  },

  // ── Thanh toán ──
  {
    query: 'thanh toán bằng cách nào',
    expected: 'Khách sạn hỗ trợ những hình thức thanh toán nào?',
  },
  {
    query: 'có trả bằng thẻ hay chuyển khoản được không',
    expected: 'Khách sạn hỗ trợ những hình thức thanh toán nào?',
  },

  {
    query: 'giá trên web đã có thuế chưa',
    expected: 'Giá phòng đã bao gồm thuế VAT chưa?',
  },
  {
    query: 'gia phong co cong them vat khong',
    expected: 'Giá phòng đã bao gồm thuế VAT chưa?',
  },

  {
    query: 'trả tiền mặt thì trả lúc nào',
    expected: 'Chọn thanh toán tiền mặt thì khi nào phải trả tiền?',
  },
  {
    query: 'chọn cash có phải trả trước không',
    expected: 'Chọn thanh toán tiền mặt thì khi nào phải trả tiền?',
  },

  {
    query: 'quét mã QR để thanh toán như thế nào',
    expected: 'Thanh toán chuyển khoản qua PayOS như thế nào?',
  },
  {
    query: 'cach chuyen khoan qua payos',
    expected: 'Thanh toán chuyển khoản qua PayOS như thế nào?',
  },

  {
    query: 'mã QR bị hết hạn rồi phải làm sao',
    expected: 'Mã QR / link thanh toán PayOS có hiệu lực trong bao lâu?',
  },
  {
    query: 'link thanh toán dùng được bao nhiêu phút',
    expected: 'Mã QR / link thanh toán PayOS có hiệu lực trong bao lâu?',
  },

  {
    query: 'chuyển tiền rồi mà đơn vẫn chờ xác nhận',
    expected: 'Tôi đã chuyển khoản nhưng đơn vẫn chưa được xác nhận thì sao?',
  },
  {
    query: 'da thanh toan nhung he thong chua ghi nhan',
    expected: 'Tôi đã chuyển khoản nhưng đơn vẫn chưa được xác nhận thì sao?',
  },

  {
    query: 'đặt rồi muốn đổi từ tiền mặt sang chuyển khoản',
    expected:
      'Tôi có thể đổi phương thức thanh toán sau khi đã đặt phòng không?',
  },
  {
    query: 'có đổi cách thanh toán sau khi book được không',
    expected:
      'Tôi có thể đổi phương thức thanh toán sau khi đã đặt phòng không?',
  },

  // ── Khuyến mãi ──
  {
    query: 'hiện đang có chương trình giảm giá nào không',
    expected: 'Làm sao để biết khách sạn đang có khuyến mãi gì?',
  },
  {
    query: 'co ma giam gia nao khong',
    expected: 'Làm sao để biết khách sạn đang có khuyến mãi gì?',
  },

  {
    query: 'nhập mã giảm giá ở đâu',
    expected: 'Làm sao để sử dụng mã khuyến mãi?',
  },
  {
    query: 'tôi có voucher, áp dụng thế nào',
    expected: 'Làm sao để sử dụng mã khuyến mãi?',
  },

  {
    query: 'dùng 2 mã giảm giá cùng lúc được không',
    expected: 'Một đơn đặt phòng dùng được mấy mã khuyến mãi?',
  },
  {
    query: 'áp nhiều voucher cho một booking được ko',
    expected: 'Một đơn đặt phòng dùng được mấy mã khuyến mãi?',
  },

  {
    query: 'mã giảm 10% thì giảm trên số tiền nào',
    expected: 'Mã khuyến mãi giảm giá được tính như thế nào?',
  },
  {
    query: 'cach tinh tien giam cua voucher',
    expected: 'Mã khuyến mãi giảm giá được tính như thế nào?',
  },

  {
    query: 'nhập mã mà báo không hợp lệ',
    expected: 'Tại sao mã khuyến mãi của tôi không dùng được?',
  },
  {
    query: 'vì sao voucher của tôi bị lỗi',
    expected: 'Tại sao mã khuyến mãi của tôi không dùng được?',
  },

  // ── Dịch vụ ──
  {
    query: 'khách sạn có những tiện ích dịch vụ gì',
    expected: 'Khách sạn có những dịch vụ đi kèm nào?',
  },
  {
    query: 'có cho thuê xe máy hay spa không',
    expected: 'Khách sạn có những dịch vụ đi kèm nào?',
  },

  {
    query: 'muốn đặt xe đón sân bay thì làm sao',
    expected: 'Làm sao để đặt thêm dịch vụ (đưa đón sân bay, ăn sáng, spa...)?',
  },
  {
    query: 'dang o khach san muon goi them dich vu giat ui',
    expected: 'Làm sao để đặt thêm dịch vụ (đưa đón sân bay, ăn sáng, spa...)?',
  },

  {
    query: 'nước với bia trong tủ lạnh có miễn phí không',
    expected: 'Đồ dùng trong minibar có tính phí không?',
  },
  {
    query: 'do an trong minibar tinh tien the nao',
    expected: 'Đồ dùng trong minibar có tính phí không?',
  },

  {
    query: 'dịch vụ spa có tính VAT không',
    expected: 'Dịch vụ đi kèm có bị tính thuế VAT không?',
  },
  {
    query: 'thuế có áp dụng cho tiền dịch vụ không',
    expected: 'Dịch vụ đi kèm có bị tính thuế VAT không?',
  },

  // ── Tài khoản ──
  {
    query: 'tạo tài khoản mới thế nào',
    expected: 'Đăng ký tài khoản như thế nào?',
  },
  {
    query: 'dang ky tai khoan can nhung gi',
    expected: 'Đăng ký tài khoản như thế nào?',
  },

  {
    query: 'chờ mãi không thấy mã xác minh gửi về email',
    expected: 'Tôi không nhận được mã OTP hoặc mã OTP đã hết hạn thì sao?',
  },
  {
    query: 'otp het han roi',
    expected: 'Tôi không nhận được mã OTP hoặc mã OTP đã hết hạn thì sao?',
  },

  {
    query: 'sửa số điện thoại trong tài khoản ở đâu',
    expected: 'Làm sao để cập nhật thông tin cá nhân hoặc đổi mật khẩu?',
  },
  {
    query: 'muốn đổi pass mới',
    expected: 'Làm sao để cập nhật thông tin cá nhân hoặc đổi mật khẩu?',
  },

  {
    query: 'đăng nhập báo tài khoản đã bị khóa',
    expected: 'Tài khoản của tôi bị khoá thì phải làm sao?',
  },
  {
    query: 'tai khoan bi lock',
    expected: 'Tài khoản của tôi bị khoá thì phải làm sao?',
  },

  // ── Hỗ trợ ──
  {
    query: 'tôi muốn nói chuyện với nhân viên thật',
    expected: 'Làm sao để liên hệ trực tiếp với lễ tân?',
  },
  {
    query: 'lien he le tan bang cach nao',
    expected: 'Làm sao để liên hệ trực tiếp với lễ tân?',
  },

  // ── Không có đáp án: gần chủ đề khách sạn nhưng kho FAQ chưa có ──
  { query: 'khách sạn có cho mang chó mèo không', expected: null },
  { query: 'được hút thuốc trong phòng không', expected: null },
  { query: 'mật khẩu wifi là gì', expected: null },
  { query: 'gần khách sạn có quán ăn ngon không', expected: null },
  { query: 'khách sạn có hồ bơi không', expected: null },
  { query: 'có chỗ đậu xe ô tô không', expected: null },
  { query: 'địa chỉ khách sạn ở đâu', expected: null },
  { query: 'trẻ em dưới 6 tuổi có tính tiền không', expected: null },
  { query: 'có kê thêm giường phụ được không', expected: null },
  { query: 'khách sạn có phòng gym không', expected: null },
  { query: 'có xuất hóa đơn đỏ cho công ty không', expected: null },
  { query: 'có gửi hành lý sau khi trả phòng được không', expected: null },
  { query: 'bạn bè đến thăm có được lên phòng không', expected: null },
  { query: 'trong phòng có két sắt không', expected: null },
  { query: 'từ sân bay về khách sạn bao xa', expected: null },
  { query: 'khách sạn có thang máy không', expected: null },
  { query: 'nếu làm vỡ đồ trong phòng thì đền bao nhiêu', expected: null },
  { query: 'thời tiết Đà Lạt tháng này thế nào', expected: null },
];
