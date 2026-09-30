import { Turnstile } from "@marsidev/react-turnstile";

const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;

export default function TurnstileWidget({
  action,
  onTokenChange,
  resetKey = 0,
}) {
  if (!siteKey) {
    return (
      <p className="text-sm text-red-500">Thiếu VITE_TURNSTILE_SITE_KEY</p>
    );
  }

  // size "flexible" = 100% chiều rộng phần tử cha. KHÔNG được bọc trong flex + justify-center:
  // phần tử cha sẽ co theo nội dung (lúc iframe chưa vẽ là 0) khiến widget vô hình nhưng
  // vẫn chiếm ~65px chiều cao. Dùng block w-full để container luôn đủ rộng.
  return (
    <div className="w-full">
      <Turnstile
        key={resetKey}
        siteKey={siteKey}
        onSuccess={(token) => onTokenChange(token)}
        onExpire={() => onTokenChange("")}
        onError={(errorCode) => {
          // Log mã lỗi thật của Turnstile ra console thay vì âm thầm nuốt đi — mã dạng
          // 110xxx là sitekey/domain sai hoặc chưa được cấp phép, 110600 là hết giờ chờ.
          // Xem: https://developers.cloudflare.com/turnstile/troubleshooting/client-side-errors/error-codes/
          console.error("Turnstile lỗi, mã:", errorCode);
          onTokenChange("");
        }}
        options={{
          action,
          theme: "light",
          language: "vi",
          size: "flexible",
        }}
      />
    </div>
  );
}
