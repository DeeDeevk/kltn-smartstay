import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { QRCodeSVG } from "qrcode.react";
import formatCurrency from "../../utils/formatCurrency";

export const PAYOS_POLL_INTERVAL_MS = 4000;

// Đếm ngược tới thời điểm hết hạn (unix giây) mà backend trả về cho link PayOS.
// Trả về null nếu không có expiredAt (BE không phải lúc nào cũng có, xem AC "nếu có").
export function usePaymentCountdown(expiredAt) {
  const [remaining, setRemaining] = useState(() =>
    expiredAt ? Math.max(0, expiredAt - Math.floor(Date.now() / 1000)) : null,
  );

  useEffect(() => {
    if (!expiredAt) {
      setRemaining(null);
      return;
    }
    const tick = () =>
      setRemaining(Math.max(0, expiredAt - Math.floor(Date.now() / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [expiredAt]);

  return remaining;
}

function formatCountdown(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// Nhận diện ngân hàng nhận tiền theo mã BIN NAPAS mà backend trả về (PayosLinkResult.bin)
// để hiện đúng logo/màu — logo lấy từ danh sách ngân hàng chính thức của VietQR
// (https://api.vietqr.io/v2/banks), cùng nguồn backend dùng ở VietqrBankService. BIN chưa
// có trong bảng thì vẫn hiện thông tin chuyển khoản, chỉ không có phần nhận diện ngân hàng.
const BANK_BRANDS = {
  970416: {
    name: "Ngân hàng TMCP Á Châu",
    shortName: "ACB",
    logo: "https://cdn.vietqr.io/img/ACB.png",
    // Xanh dương đặc trưng của ACB.
    accent: "#1e3a8a",
    soft: "#eff4ff",
  },
};

// Màu mặc định khi chưa nhận diện được ngân hàng (xanh của Vika).
const DEFAULT_BRAND = { accent: "#2563eb", soft: "#eff6ff" };

// Thông tin chuyển khoản nằm cạnh mã QR — cho khách không quét được QR tự chuyển khoản.
// Các field lấy từ response tạo link của backend (PayosLinkResult); field nào không có
// thì không hiện dòng tương ứng.
function BankTransferInfo({ paymentLink }) {
  const { t, i18n } = useTranslation();
  const bank = BANK_BRANDS[paymentLink.bin];

  const rows = [
    {
      key: "accountName",
      label: t("checkout.payment.accountName"),
      value: paymentLink.accountName,
    },
    {
      key: "accountNumber",
      label: t("checkout.payment.accountNumber"),
      value: paymentLink.accountNumber,
    },
    {
      key: "amount",
      label: t("checkout.payment.amount"),
      value: paymentLink.amount
        ? formatCurrency(paymentLink.amount, i18n.language)
        : null,
      highlight: true,
    },
    {
      key: "description",
      label: t("checkout.payment.description"),
      value: paymentLink.description,
    },
  ].filter((row) => row.value);

  if (rows.length === 0) return null;

  return (
    <div
      className="overflow-hidden rounded-2xl border text-left"
      style={bank ? { borderColor: bank.accent + "33" } : undefined}
    >
      {bank && (
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ backgroundColor: bank.accent }}
        >
          <span className="flex h-10 w-16 shrink-0 items-center justify-center rounded-lg bg-white p-1">
            <img
              src={bank.logo}
              alt={bank.shortName}
              className="max-h-full max-w-full object-contain"
              loading="lazy"
            />
          </span>
          <div className="min-w-0 text-white">
            <p className="text-sm font-bold leading-tight">{bank.name}</p>
            <p className="text-xs text-white/70">{bank.shortName}</p>
          </div>
        </div>
      )}
      <dl
        className="divide-y divide-gray-100 px-4"
        style={bank ? { backgroundColor: bank.soft } : undefined}
      >
        {rows.map((row) => (
          <div key={row.key} className="py-2.5">
            <dt className="text-xs text-gray-500">{row.label}</dt>
            <dd
              className={
                row.highlight
                  ? "text-base font-bold wrap-anywhere"
                  : "text-sm font-semibold text-gray-800 wrap-anywhere"
              }
              style={row.highlight && bank ? { color: bank.accent } : undefined}
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

// Hiển thị QR + link thanh toán ngay trên trang checkout (thay vì redirect sang PayOS),
// đếm ngược tới khi hết hạn, và tự poll trạng thái để phát hiện thanh toán thành công mà
// không cần khách quay lại trang (webhook thật của PayOS không gọi được tới localhost).
export function PayOSPaymentPanel({
  totalPrice,
  paymentLink,
  linkError,
  isCreatingLink,
  paymentFailed,
  remaining,
  onRetry,
}) {
  const { t, i18n } = useTranslation();
  const isExpired = Boolean(paymentLink) && remaining === 0;
  // Cả khung lấy màu theo ngân hàng nhận tiền (ACB: xanh dương đậm) cho đồng bộ với khối
  // thông tin chuyển khoản bên phải.
  const brand = BANK_BRANDS[paymentLink?.bin] ?? DEFAULT_BRAND;
  // Còn dưới 2 phút thì đổi đồng hồ sang màu cam để khách biết sắp hết hạn.
  const isExpiringSoon = remaining !== null && remaining <= 120;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 max-w-3xl mx-auto text-center overflow-hidden">
      <div className="h-1.5" style={{ backgroundColor: brand.accent }} />
      <div className="p-6 sm:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {t("checkout.payment.title")}
          </h1>
          <p className="mt-3 text-sm text-gray-500">
            {t("checkout.payment.amountLabel")}
          </p>
          <p
            className="text-3xl font-extrabold tracking-tight"
            style={{ color: brand.accent }}
          >
            {formatCurrency(totalPrice, i18n.language)}
          </p>
        </div>

        {isCreatingLink && !paymentLink && (
          <div className="flex flex-col items-center gap-3 py-8 text-gray-500">
            <Loader2 className="animate-spin" size={28} />
            {t("checkout.payment.creatingLink")}
          </div>
        )}

        {linkError && !isCreatingLink && (
          <div className="mx-auto max-w-md space-y-4">
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {linkError}
            </div>
            <button
              type="button"
              onClick={onRetry}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              {t("checkout.payment.retry")}
            </button>
          </div>
        )}

        {paymentFailed && !linkError && !isCreatingLink && (
          <div className="mx-auto max-w-md space-y-4">
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
              {t("checkout.payment.failed")}
            </div>
            <button
              type="button"
              onClick={onRetry}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              {t("checkout.payment.retry")}
            </button>
          </div>
        )}

        {paymentLink && !isExpired && !paymentFailed && (
          <>
            {/* QR bên trái, thông tin chuyển khoản bên phải; màn hình hẹp thì xếp dọc. */}
            <div className="grid items-stretch gap-6 md:grid-cols-[auto_1fr]">
              <div
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border p-5"
                style={{
                  borderColor: brand.accent + "33",
                  backgroundColor: brand.soft,
                }}
              >
                <div className="rounded-xl bg-white p-3 shadow-sm">
                  <QRCodeSVG value={paymentLink.qrCode} size={184} level="M" />
                </div>
                {remaining !== null && (
                  <span
                    className={
                      isExpiringSoon
                        ? "rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-700"
                        : "rounded-full bg-white px-3 py-1 text-sm font-semibold shadow-sm"
                    }
                    style={isExpiringSoon ? undefined : { color: brand.accent }}
                  >
                    {t("checkout.payment.expiresIn", {
                      time: formatCountdown(remaining),
                    })}
                  </span>
                )}
              </div>
              <BankTransferInfo paymentLink={paymentLink} />
            </div>
            <p className="flex items-center justify-center gap-2 text-xs text-gray-400">
              <span className="relative flex h-2 w-2">
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
                  style={{ backgroundColor: brand.accent }}
                />
                <span
                  className="relative inline-flex h-2 w-2 rounded-full"
                  style={{ backgroundColor: brand.accent }}
                />
              </span>
              {t("checkout.payment.waitingHint")}
            </p>
          </>
        )}

        {paymentLink && isExpired && !paymentFailed && (
          <div className="mx-auto max-w-md space-y-4">
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
              {t("checkout.payment.expired")}
            </div>
            <button
              type="button"
              onClick={onRetry}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors"
            >
              {t("checkout.payment.retry")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
