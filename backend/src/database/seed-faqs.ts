import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Faq } from '../ai-agent/entities/faq.entity';

type SeedFaq = Pick<Faq, 'question' | 'answer' | 'category'>;

// Dữ liệu FAQ ban đầu (trước đây viết cứng ở ai-agent/rag/faq-data.ts). Mỗi entry chỉ
// nói về 1 chủ đề — embedding model truy xuất đoạn ngắn, tập trung chính xác hơn đoạn
// dài nhiều chủ đề. Seed không tự embed: backend sẽ embed các dòng chưa có vector khi
// khởi động, hoặc khi admin gọi POST /faqs/reindex.
// Lưu ý khi thêm/sửa: câu trả lời phải khớp đúng hành vi thật của hệ thống (booking,
// payment, promotion service...). Không đưa giá cụ thể của loại phòng/dịch vụ vào đây
// vì admin có thể đổi giá bất kỳ lúc nào — giá thật lấy qua tool search_rooms.
const FAQS: SeedFaq[] = [
  // ─── Đặt phòng ──────────────────────────────────────────────────────────────
  {
    category: 'Đặt phòng',
    question: 'Làm thế nào để đặt phòng trên website?',
    answer:
      'Quý khách chọn ngày nhận phòng, ngày trả phòng và số khách để tìm phòng trống, ' +
      'chọn loại phòng phù hợp, điền thông tin người nhận phòng (họ tên, số điện thoại, ' +
      'email), chọn phương thức thanh toán (tiền mặt tại quầy hoặc chuyển khoản) rồi xác ' +
      'nhận đặt phòng. Quý khách cũng có thể nhờ trợ lý ảo tìm phòng và đặt phòng trực ' +
      'tiếp trong khung chat.',
  },
  {
    category: 'Đặt phòng',
    question: 'Tôi có cần tạo tài khoản để đặt phòng không?',
    answer:
      'Có. Quý khách cần đăng nhập để đặt phòng trực tuyến, để hệ thống lưu đơn vào mục ' +
      '"Lịch sử đặt phòng" giúp quý khách theo dõi, thanh toán hoặc huỷ đơn. Quý khách ' +
      'có thể đăng ký bằng email hoặc đăng nhập nhanh bằng tài khoản Google. Tìm kiếm và ' +
      'xem thông tin phòng thì không cần đăng nhập.',
  },
  {
    category: 'Đặt phòng',
    question: 'Tôi có thể đặt phòng cho người khác (người thân, bạn bè) không?',
    answer:
      'Được. Khi đặt phòng, quý khách điền họ tên, số điện thoại và email của người sẽ ' +
      'nhận phòng — thông tin này có thể khác với thông tin tài khoản đang đăng nhập. Đơn ' +
      'đặt phòng vẫn được lưu trong tài khoản của người đặt.',
  },
  {
    category: 'Đặt phòng',
    question:
      'Một lần đặt được bao nhiêu phòng? Muốn đặt nhiều phòng thì làm sao?',
    answer:
      'Mỗi đơn đặt phòng tương ứng với 1 phòng. Nếu cần nhiều phòng (cùng hoặc khác loại ' +
      'phòng), quý khách vui lòng tạo nhiều đơn đặt phòng riêng cho từng phòng.',
  },
  {
    category: 'Đặt phòng',
    question: 'Một phòng ở được tối đa bao nhiêu người?',
    answer:
      'Mỗi loại phòng có sức chứa tối đa riêng, được ghi rõ trong thông tin loại phòng. ' +
      'Khi tìm phòng, quý khách nhập số khách để hệ thống chỉ hiển thị những loại phòng có ' +
      'sức chứa phù hợp. Nếu đoàn đông hơn sức chứa của một phòng, quý khách vui lòng đặt ' +
      'thêm phòng.',
  },
  {
    category: 'Đặt phòng',
    question: 'Tôi có được chọn số phòng hoặc tầng cụ thể không?',
    answer:
      'Khi đặt trực tuyến, quý khách chọn theo loại phòng. Số phòng cụ thể sẽ được lễ tân ' +
      'sắp xếp khi quý khách làm thủ tục nhận phòng (check-in), đảm bảo đúng loại phòng đã ' +
      'đặt. Nếu có mong muốn về vị trí phòng, quý khách có thể nhắn cho lễ tân để được hỗ ' +
      'trợ tuỳ tình trạng phòng trống.',
  },
  {
    category: 'Đặt phòng',
    question: 'Tiền phòng được tính như thế nào?',
    answer:
      'Tiền phòng = đơn giá mỗi đêm của loại phòng × số đêm lưu trú (số đêm tính từ ngày ' +
      'nhận phòng đến ngày trả phòng). Tổng tiền cuối cùng = tiền phòng − giảm giá khuyến ' +
      'mãi (nếu có) + thuế VAT 8% tính trên tiền phòng sau giảm giá + tiền dịch vụ đi kèm.',
  },
  {
    category: 'Đặt phòng',
    question: 'Đơn đặt phòng có những trạng thái nào?',
    answer:
      'Đơn đặt phòng có các trạng thái: "Chờ xác nhận" (vừa tạo), "Đã xác nhận" (sẵn sàng ' +
      'nhận phòng), "Đã nhận phòng" (đang lưu trú), "Đã trả phòng" (hoàn tất) và "Đã huỷ". ' +
      'Quý khách theo dõi trạng thái đơn trong mục "Lịch sử đặt phòng"; trạng thái được cập ' +
      'nhật tự động khi lễ tân xử lý đơn hoặc khi thanh toán thành công.',
  },
  {
    category: 'Đặt phòng',
    question: 'Đơn của tôi đang "Chờ xác nhận" thì bao giờ được xác nhận?',
    answer:
      'Với đơn thanh toán chuyển khoản qua PayOS, đơn được tự động xác nhận ngay khi hệ ' +
      'thống ghi nhận thanh toán thành công. Với đơn thanh toán tiền mặt tại quầy, lễ tân ' +
      'sẽ kiểm tra và xác nhận đơn. Trong thời gian chờ, phòng vẫn được giữ cho quý khách.',
  },
  {
    category: 'Đặt phòng',
    question: 'Xem lại thông tin đơn đặt phòng của tôi ở đâu?',
    answer:
      'Quý khách đăng nhập và vào mục "Lịch sử đặt phòng" để xem danh sách đơn, bấm "Chi ' +
      'tiết" để xem mã đặt phòng, ngày nhận/trả phòng, thông tin người nhận phòng, dịch vụ ' +
      'đi kèm, giảm giá, thuế VAT và tổng tiền của từng đơn.',
  },
  {
    category: 'Đặt phòng',
    question: 'Trợ lý ảo có thể giúp tôi đặt phòng không?',
    answer:
      'Có. Trợ lý ảo có thể tìm phòng trống theo ngày và số khách, kiểm tra một loại phòng ' +
      'còn trống hay không, xem khuyến mãi đang áp dụng và tạo đơn đặt phòng. Trước khi tạo ' +
      'đơn, trợ lý sẽ tóm tắt đầy đủ loại phòng, ngày ở, thông tin khách, phương thức thanh ' +
      'toán và tổng tiền để quý khách xác nhận; đơn chỉ được tạo sau khi quý khách đồng ý. ' +
      'Nếu chọn chuyển khoản, mã QR thanh toán sẽ hiển thị ngay trong khung chat.',
  },

  // ─── Huỷ / thay đổi đơn ───────────────────────────────────────────────────────
  {
    category: 'Huỷ phòng',
    question: 'Huỷ phòng có mất phí không?',
    answer:
      'Quý khách có thể huỷ đặt phòng miễn phí bất kỳ lúc nào trước khi nhận phòng, ' +
      'khi đơn đang ở trạng thái "Chờ xác nhận" hoặc "Đã xác nhận". Sau khi đã nhận phòng ' +
      '(check-in), đơn không thể huỷ qua hệ thống, quý khách vui lòng liên hệ trực tiếp ' +
      'lễ tân để được hỗ trợ.',
  },
  {
    category: 'Huỷ phòng',
    question: 'Làm sao để huỷ đơn đặt phòng?',
    answer:
      'Quý khách vào mục "Lịch sử đặt phòng", chọn đơn cần huỷ và bấm "Hủy đơn", sau đó ' +
      'xác nhận. Nút huỷ chỉ khả dụng khi đơn đang ở trạng thái "Chờ xác nhận" hoặc "Đã ' +
      'xác nhận".',
  },
  {
    category: 'Huỷ phòng',
    question:
      'Đã thanh toán chuyển khoản rồi thì huỷ đơn có được hoàn tiền không?',
    answer:
      'Quý khách vẫn có thể huỷ đơn đã thanh toán nếu chưa nhận phòng. Tuy nhiên việc hoàn ' +
      'tiền không được thực hiện tự động trên hệ thống — quý khách vui lòng liên hệ lễ tân ' +
      'kèm mã đặt phòng để được hỗ trợ hoàn tiền.',
  },
  {
    category: 'Huỷ phòng',
    question: 'Tôi muốn đổi ngày ở hoặc đổi loại phòng thì làm thế nào?',
    answer:
      'Hiện hệ thống chưa hỗ trợ sửa ngày hoặc loại phòng của đơn đã đặt. Quý khách vui ' +
      'lòng huỷ đơn cũ (miễn phí nếu chưa nhận phòng) và đặt một đơn mới với ngày hoặc loại ' +
      'phòng mong muốn. Nếu đơn cũ đã thanh toán chuyển khoản, vui lòng liên hệ lễ tân để ' +
      'được hỗ trợ.',
  },

  // ─── Nhận / trả phòng ────────────────────────────────────────────────────────
  {
    category: 'Nhận / trả phòng',
    question: 'Giờ nhận phòng (check-in) là mấy giờ?',
    answer: 'Giờ nhận phòng (check-in) tiêu chuẩn là từ 14:00.',
  },
  {
    category: 'Nhận / trả phòng',
    question: 'Giờ trả phòng (check-out) là mấy giờ?',
    answer:
      'Giờ trả phòng (check-out) tiêu chuẩn là trước 12:00 trưa (giờ Việt Nam) của ngày ' +
      'trả phòng ghi trên đơn đặt phòng.',
  },
  {
    category: 'Nhận / trả phòng',
    question: 'Trả phòng trễ có bị tính phí không?',
    answer:
      'Có. Nếu trả phòng sau 12:00 trưa ngày trả phòng, khách sạn tính phụ thu theo từng ' +
      'khoảng 24 giờ: trễ dưới 24 giờ (kể cả chỉ trễ vài phút) tính thêm 1 đêm, trễ từ 24 ' +
      'đến dưới 48 giờ tính thêm 2 đêm, và cứ thế tiếp tục. Mỗi đêm phụ thu tính theo đơn ' +
      'giá của loại phòng đang thuê và cũng chịu thuế VAT 8% như tiền phòng.',
  },
  {
    category: 'Nhận / trả phòng',
    question: 'Tôi có thể nhận phòng sớm hơn 14:00 không?',
    answer:
      'Việc nhận phòng sớm tuỳ thuộc vào tình trạng phòng trống tại thời điểm quý khách ' +
      'đến. Quý khách vui lòng nhắn cho lễ tân trước để được kiểm tra và hỗ trợ.',
  },
  {
    category: 'Nhận / trả phòng',
    question: 'Khi đến nhận phòng tôi cần làm gì?',
    answer:
      'Quý khách đến quầy lễ tân và cung cấp mã đặt phòng, hoặc đưa mã QR trong trang chi ' +
      'tiết đơn (mục "Lịch sử đặt phòng") để lễ tân quét. Đơn cần ở trạng thái "Đã xác nhận" ' +
      'thì mới làm thủ tục nhận phòng được. Lễ tân sẽ sắp xếp phòng cụ thể và bàn giao phòng.',
  },
  {
    category: 'Nhận / trả phòng',
    question: 'Tôi có thể đến đặt phòng trực tiếp tại quầy không?',
    answer:
      'Có. Lễ tân có thể tạo đơn đặt phòng trực tiếp tại quầy cho khách vãng lai nếu còn ' +
      'phòng trống, không cần tài khoản trên website. Tuy nhiên để chắc chắn còn phòng, ' +
      'quý khách nên đặt trước trên website hoặc qua trợ lý ảo.',
  },
  {
    category: 'Nhận / trả phòng',
    question: 'Khi trả phòng cần thanh toán những khoản gì?',
    answer:
      'Khi trả phòng, lễ tân tổng hợp các khoản phát sinh thêm trong thời gian lưu trú: ' +
      'dịch vụ và minibar đã sử dụng, phụ thu trả phòng trễ (nếu có). Quý khách thanh toán ' +
      'phần còn lại (sau khi trừ số tiền đã trả trước đó) bằng tiền mặt hoặc chuyển khoản ' +
      'quét mã QR.',
  },

  // ─── Thanh toán ──────────────────────────────────────────────────────────────
  {
    category: 'Thanh toán',
    question: 'Khách sạn hỗ trợ những hình thức thanh toán nào?',
    answer:
      'Khách sạn hỗ trợ thanh toán bằng tiền mặt tại quầy lễ tân hoặc chuyển khoản qua ' +
      'PayOS (quét mã QR).',
  },
  {
    category: 'Thanh toán',
    question: 'Giá phòng đã bao gồm thuế VAT chưa?',
    answer:
      'Giá phòng niêm yết CHƯA bao gồm thuế giá trị gia tăng (VAT) 8%. VAT được tính trên ' +
      'tiền phòng (sau khi trừ khuyến mãi), không tính trên các dịch vụ đi kèm, và đã được ' +
      'cộng vào tổng tiền cuối cùng hiển thị khi đặt phòng.',
  },
  {
    category: 'Thanh toán',
    question: 'Chọn thanh toán tiền mặt thì khi nào phải trả tiền?',
    answer:
      'Với đơn chọn tiền mặt, quý khách không cần trả trước khi đặt. Quý khách thanh toán ' +
      'toàn bộ tiền đơn tại quầy lễ tân khi làm thủ tục nhận phòng. Các khoản phát sinh ' +
      'thêm trong thời gian lưu trú sẽ được thanh toán khi trả phòng.',
  },
  {
    category: 'Thanh toán',
    question: 'Thanh toán chuyển khoản qua PayOS như thế nào?',
    answer:
      'Sau khi đặt phòng với phương thức chuyển khoản, mã QR thanh toán PayOS sẽ hiển thị ' +
      'ngay trên trang đặt phòng (hoặc trong khung chat nếu đặt qua trợ lý ảo). Quý khách ' +
      'dùng ứng dụng ngân hàng quét mã QR để chuyển khoản đúng số tiền. Khi thanh toán ' +
      'thành công, đơn được tự động chuyển sang "Đã xác nhận".',
  },
  {
    category: 'Thanh toán',
    question: 'Mã QR / link thanh toán PayOS có hiệu lực trong bao lâu?',
    answer:
      'Mỗi link thanh toán PayOS có hiệu lực 15 phút kể từ lúc tạo. Nếu hết hạn hoặc quý ' +
      'khách huỷ giao dịch, đơn đặt phòng vẫn được giữ — quý khách vào "Lịch sử đặt phòng" ' +
      'và bấm "Thanh toán ngay" để tạo link thanh toán mới.',
  },
  {
    category: 'Thanh toán',
    question: 'Tôi đã chuyển khoản nhưng đơn vẫn chưa được xác nhận thì sao?',
    answer:
      'Giao dịch có thể đang được xử lý. Quý khách vui lòng đợi ít phút rồi kiểm tra lại ' +
      'trạng thái đơn trong mục "Lịch sử đặt phòng". Nếu sau một thời gian vẫn chưa được ' +
      'ghi nhận, quý khách vui lòng liên hệ lễ tân kèm mã đặt phòng và thông tin giao dịch ' +
      'để được kiểm tra.',
  },
  {
    category: 'Thanh toán',
    question:
      'Tôi có thể đổi phương thức thanh toán sau khi đã đặt phòng không?',
    answer:
      'Hiện hệ thống chưa hỗ trợ đổi phương thức thanh toán của đơn đã đặt. Nếu muốn đổi, ' +
      'quý khách có thể huỷ đơn (miễn phí khi chưa nhận phòng) và đặt lại với phương thức ' +
      'thanh toán mong muốn, hoặc liên hệ lễ tân để được hỗ trợ.',
  },

  // ─── Khuyến mãi ──────────────────────────────────────────────────────────────
  {
    category: 'Khuyến mãi',
    question: 'Làm sao để biết khách sạn đang có khuyến mãi gì?',
    answer:
      'Quý khách có thể hỏi trợ lý ảo để xem danh sách khuyến mãi đang áp dụng. Mỗi mã ' +
      'khuyến mãi chỉ áp dụng được khi đặt phòng nếu còn hiệu lực (trong thời gian áp ' +
      'dụng và chưa đạt giới hạn số lượt sử dụng).',
  },
  {
    category: 'Khuyến mãi',
    question: 'Làm sao để sử dụng mã khuyến mãi?',
    answer:
      'Hiện tại mã khuyến mãi được áp dụng khi quý khách đặt phòng qua trợ lý ảo: quý ' +
      'khách báo mã cho trợ lý, hệ thống kiểm tra mã còn hiệu lực và trình bày số tiền được ' +
      'giảm cùng tổng tiền cuối cùng để quý khách xác nhận trước khi tạo đơn. Mã cần được ' +
      'cung cấp chính xác.',
  },
  {
    category: 'Khuyến mãi',
    question: 'Một đơn đặt phòng dùng được mấy mã khuyến mãi?',
    answer: 'Mỗi đơn đặt phòng chỉ áp dụng được 1 mã khuyến mãi.',
  },
  {
    category: 'Khuyến mãi',
    question: 'Mã khuyến mãi giảm giá được tính như thế nào?',
    answer:
      'Có 2 loại mã: giảm theo phần trăm và giảm một số tiền cố định. Mức giảm được tính ' +
      'trên tổng tiền phòng và dịch vụ đi kèm của đơn; với mã giảm số tiền cố định, số tiền ' +
      'giảm không vượt quá giá trị đơn. Thuế VAT được tính sau khi đã trừ giảm giá.',
  },
  {
    category: 'Khuyến mãi',
    question: 'Tại sao mã khuyến mãi của tôi không dùng được?',
    answer:
      'Mã khuyến mãi không áp dụng được khi: mã không tồn tại hoặc nhập sai, mã chưa đến ' +
      'hoặc đã quá thời gian áp dụng, mã đã hết lượt sử dụng, hoặc mã đang bị tạm ngưng. ' +
      'Quý khách có thể hỏi trợ lý ảo để xem các mã đang còn hiệu lực.',
  },

  // ─── Dịch vụ ─────────────────────────────────────────────────────────────────
  {
    category: 'Dịch vụ',
    question: 'Khách sạn có những dịch vụ đi kèm nào?',
    answer:
      'Khách sạn cung cấp các dịch vụ: đưa đón sân bay (xe 4 chỗ và 7 chỗ), buffet sáng ' +
      'tại nhà hàng khách sạn, giặt ủi lấy trong ngày, thuê xe máy (kèm mũ bảo hiểm), spa ' +
      '& massage, cùng đồ minibar trong phòng (nước suối, trà, nước ngọt, bia, snack). Quý ' +
      'khách vui lòng liên hệ lễ tân để biết giá chi tiết của từng dịch vụ.',
  },
  {
    category: 'Dịch vụ',
    question: 'Làm sao để đặt thêm dịch vụ (đưa đón sân bay, ăn sáng, spa...)?',
    answer:
      'Trong thời gian lưu trú, quý khách yêu cầu dịch vụ với lễ tân (tại quầy hoặc qua ' +
      'khung chat với lễ tân). Dịch vụ sử dụng sẽ được lễ tân ghi nhận vào đơn đặt phòng ' +
      'và thanh toán khi trả phòng.',
  },
  {
    category: 'Dịch vụ',
    question: 'Đồ dùng trong minibar có tính phí không?',
    answer:
      'Đồ minibar được tính theo số lượng quý khách sử dụng. Lễ tân sẽ kiểm tra và ghi nhận ' +
      'minibar khi quý khách trả phòng, và khoản này được cộng vào hoá đơn thanh toán lúc ' +
      'trả phòng.',
  },
  {
    category: 'Dịch vụ',
    question: 'Dịch vụ đi kèm có bị tính thuế VAT không?',
    answer:
      'Thuế VAT 8% chỉ tính trên tiền phòng (và phụ thu trả phòng trễ), không cộng thêm VAT ' +
      'trên các dịch vụ đi kèm và minibar.',
  },

  // ─── Tài khoản ───────────────────────────────────────────────────────────────
  {
    category: 'Tài khoản',
    question: 'Đăng ký tài khoản như thế nào?',
    answer:
      'Quý khách chọn "Đăng ký", nhập họ tên, email, mật khẩu (tối thiểu 6 ký tự) và số ' +
      'điện thoại (không bắt buộc). Hệ thống gửi mã OTP gồm 6 chữ số tới email để xác minh; ' +
      'tài khoản chỉ được tạo sau khi quý khách nhập đúng mã. Quý khách cũng có thể đăng ' +
      'nhập nhanh bằng tài khoản Google mà không cần đăng ký.',
  },
  {
    category: 'Tài khoản',
    question: 'Tôi không nhận được mã OTP hoặc mã OTP đã hết hạn thì sao?',
    answer:
      'Mã OTP đăng ký có hiệu lực 90 giây. Quý khách vui lòng kiểm tra cả hộp thư rác ' +
      '(Spam). Nếu chưa nhận được hoặc mã đã hết hạn, quý khách bấm gửi lại mã (có thể gửi ' +
      'lại sau ít nhất 30 giây). Nếu nhập sai quá 5 lần, quý khách cần yêu cầu gửi lại mã mới.',
  },
  {
    category: 'Tài khoản',
    question: 'Tôi quên mật khẩu thì làm thế nào?',
    answer:
      'Quý khách chọn "Quên mật khẩu" ở trang đăng nhập, nhập email đã đăng ký để nhận mã ' +
      'OTP (hiệu lực 5 phút), nhập mã rồi đặt mật khẩu mới. Nếu tài khoản được tạo bằng ' +
      'đăng nhập Google thì không có mật khẩu để đặt lại — quý khách vui lòng tiếp tục đăng ' +
      'nhập bằng Google.',
  },
  {
    category: 'Tài khoản',
    question: 'Làm sao để cập nhật thông tin cá nhân hoặc đổi mật khẩu?',
    answer:
      'Quý khách đăng nhập và vào mục "Hồ sơ của tôi" để cập nhật thông tin cá nhân hoặc ' +
      'đổi mật khẩu (cần nhập mật khẩu hiện tại).',
  },
  {
    category: 'Tài khoản',
    question: 'Tài khoản của tôi bị khoá thì phải làm sao?',
    answer:
      'Khi tài khoản bị khoá, quý khách sẽ không thể đăng nhập. Quý khách vui lòng liên hệ ' +
      'trực tiếp khách sạn để được kiểm tra và hỗ trợ mở khoá.',
  },

  // ─── Hỗ trợ ──────────────────────────────────────────────────────────────────
  {
    category: 'Hỗ trợ',
    question: 'Làm sao để liên hệ trực tiếp với lễ tân?',
    answer:
      'Sau khi đăng nhập, quý khách có thể dùng khung chat trực tuyến với lễ tân trên ' +
      'website (khác với trợ lý ảo tự động) để được nhân viên hỗ trợ trực tiếp. Quý khách ' +
      'cũng có thể liên hệ tại quầy lễ tân của khách sạn.',
  },
];

async function run() {
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    entities: [Faq],
    // Tự tạo bảng FAQ nếu backend chưa chạy sync.
    synchronize: true,
  });

  await dataSource.initialize();
  const repo = dataSource.getRepository(Faq);

  // Upsert theo "question": chạy lại seed không tạo bản trùng. Sửa answer ở đây thì
  // embeddingHash sẽ lệch -> backend tự embed lại ở lần refresh kế tiếp.
  for (const data of FAQS) {
    const existing = await repo.findOne({ where: { question: data.question } });
    if (existing) {
      Object.assign(existing, data, { isActive: true });
      await repo.save(existing);
      console.log(`Đã cập nhật FAQ: ${data.question}`);
    } else {
      await repo.save(repo.create({ ...data, isActive: true }));
      console.log(`Đã tạo FAQ: ${data.question}`);
    }
  }

  await dataSource.destroy();
}

run().catch((err) => {
  console.error('Seed FAQ thất bại:', err);
  process.exit(1);
});
