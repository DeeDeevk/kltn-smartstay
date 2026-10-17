import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import Header from "../layout/Header";
import {
  useCreatePayOSLinkMutation,
  useSyncPayOSStatusQuery,
} from "../../services/payment";
import {
  PAYOS_POLL_INTERVAL_MS,
  PayOSPaymentPanel,
  usePaymentCountdown,
} from "./PayOSPaymentPanel";

// Trang thanh toán của Vika cho một đơn ĐÃ tạo (VD bấm "Thanh toán" ở Lịch sử đặt phòng)
// — hiện QR ngay trên web thay vì chuyển sang trang của PayOS, dùng chung giao diện với
// bước thanh toán lúc đặt phòng.
export default function BookingPaymentPage() {
  const { bookingId } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [paymentLink, setPaymentLink] = useState(null);
  const [linkError, setLinkError] = useState(null);
  const [paymentFailed, setPaymentFailed] = useState(false);
  const [createPayOSLink, { isLoading: isCreatingLink }] =
    useCreatePayOSLinkMutation();
  // React StrictMode chạy useEffect 2 lần khi dev. Mỗi lần gọi tạo link, backend sẽ huỷ
  // link PENDING cũ rồi cấp mã mới — không chặn thì QR đang hiện bị vô hiệu ngay.
  const requestedRef = useRef(false);

  const requestPaymentLink = async () => {
    setLinkError(null);
    setPaymentLink(null);
    setPaymentFailed(false);
    try {
      setPaymentLink(await createPayOSLink(bookingId).unwrap());
    } catch (err) {
      setLinkError(err?.data?.message || t("checkout.payment.linkError"));
    }
  };

  useEffect(() => {
    if (requestedRef.current) return;
    requestedRef.current = true;
    requestPaymentLink();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingId]);

  const remaining = usePaymentCountdown(paymentLink?.expiredAt);
  const isLinkExpired = Boolean(paymentLink) && remaining === 0;

  const { data: syncedBooking } = useSyncPayOSStatusQuery(bookingId, {
    skip: !paymentLink || paymentFailed || isLinkExpired,
    pollingInterval: PAYOS_POLL_INTERVAL_MS,
  });

  useEffect(() => {
    if (syncedBooking?.paymentStatus === "PAID") {
      // Trang kết quả có sẵn — tự đồng bộ lại và hiện thông tin đơn đã thanh toán.
      navigate(`/payment/success?bookingId=${bookingId}`, { replace: true });
    } else if (syncedBooking?.paymentStatus === "FAILED") {
      setPaymentFailed(true);
    }
  }, [syncedBooking, bookingId, navigate]);

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <PayOSPaymentPanel
          totalPrice={paymentLink?.amount ?? 0}
          paymentLink={paymentLink}
          linkError={linkError}
          isCreatingLink={isCreatingLink}
          paymentFailed={paymentFailed}
          remaining={remaining}
          onRetry={requestPaymentLink}
        />
      </main>
    </div>
  );
}
