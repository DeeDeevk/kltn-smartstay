import { AlertTriangle } from 'lucide-react';

// Thông tin tài khoản người chuyển (trích từ PayOS, KAN-114/123) + ảnh VietQR thật dựng từ
// bankBin + accountNumber nếu tra được — dùng chung giữa card danh sách
// (RefundRequestManagementPage.jsx) và modal "Đánh dấu đã hoàn tiền" (RefundActionModal.jsx)
// để không trùng lặp logic hiển thị ở 2 nơi. Giữ CẢ hai (text + QR) khi có đủ dữ liệu, không
// thay thế phần text đã có.
export default function RefundPayerBankInfo({ payerBankInfo, qrImageUrl }) {
    if (!payerBankInfo) {
        return (
            <p className="text-xs italic text-amber-600">
                Chưa có thông tin tài khoản — vui lòng liên hệ khách qua chat hoặc số điện thoại để
                xác nhận trước khi chuyển khoản.
            </p>
        );
    }

    // bankBin chỉ là dữ liệu để dựng URL QR, không phải thông tin cần admin đọc trực tiếp —
    // không hiện trong danh sách key:value bên dưới.
    const displayEntries = Object.entries(payerBankInfo).filter(([key]) => key !== 'bankBin');

    return (
        <div className="flex flex-wrap items-start gap-4">
            <div className="space-y-0.5 text-xs text-gray-600">
                {displayEntries.map(([key, val]) => (
                    <p key={key}>
                        <span className="font-medium">{key}:</span> {String(val)}
                    </p>
                ))}
            </div>
            {qrImageUrl && (
                <div className="w-[200px] shrink-0">
                    <img
                        src={qrImageUrl}
                        alt="Mã VietQR chuyển khoản"
                        width={200}
                        height={240}
                        className="rounded-lg border border-gray-200"
                    />
                    <p className="mt-1.5 flex items-start gap-1 text-[11px] leading-snug text-amber-600">
                        <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                        QR này ứng với tài khoản đã thanh toán — nếu khách yêu cầu nhận vào tài khoản
                        khác, vui lòng dùng ảnh QR khách gửi qua chat (nếu có) và đối chiếu kỹ trước khi
                        quét.
                    </p>
                </div>
            )}
        </div>
    );
}
