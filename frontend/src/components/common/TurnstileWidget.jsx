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

  return (
    <div className="flex justify-center">
      <Turnstile
        key={resetKey}
        siteKey={siteKey}
        onSuccess={(token) => onTokenChange(token)}
        onExpire={() => onTokenChange("")}
        onError={() => onTokenChange("")}
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
