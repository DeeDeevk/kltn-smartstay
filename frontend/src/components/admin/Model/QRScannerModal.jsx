import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, QrCode, ScanLine } from 'lucide-react';

const QRScannerModal = ({ isOpen, onClose, onScanSuccess }) => {
  const scannerRef = useRef(null);
  const elementId = 'qr-reader-container';

  useEffect(() => {
    if (!isOpen) return;

    const timer = setTimeout(() => {
      const scanner = new Html5QrcodeScanner(
        elementId,
        {
          fps: 10,
          qrbox: { width: 240, height: 240 },
          aspectRatio: 1.0,
          showTorchButtonIfSupported: true,
          rememberLastUsedCamera: true,
        },
        /* verbose= */ false,
      );

      scanner.render(
        (decodedText) => {
          onScanSuccess(decodedText);
          scanner.clear().catch((e) => console.error(e));
        },
        () => {
          // Lỗi quét từng khung hình (không phải lỗi camera) — bỏ qua.
        },
      );

      scannerRef.current = scanner;
    }, 400);

    return () => {
      clearTimeout(timer);
      if (scannerRef.current) {
        scannerRef.current
          .clear()
          .catch((e) => console.error('Cleanup error:', e));
        scannerRef.current = null;
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
      {/* Ghi đè giao diện mặc định (khá thô) của html5-qrcode cho khớp phong cách app. */}
      <style>{`
        #${elementId} { border: none !important; width: 100% !important; font-family: inherit !important; }
        #${elementId} span, #${elementId} div { font-family: inherit !important; }

        /* Ẩn icon camera bitmap mặc định + link "powered by" */
        #${elementId} img[alt*="Camera" i],
        #${elementId} img[alt*="info" i] { display: none !important; }

        /* Khối nút "Request Camera Permissions" / "Start Scanning" */
        #${elementId}__dashboard_section_csr button,
        #${elementId} button.html5-qrcode-element {
          background: #2563eb !important;
          color: #fff !important;
          border: none !important;
          padding: 10px 18px !important;
          border-radius: 10px !important;
          font-weight: 600 !important;
          font-size: 14px !important;
          cursor: pointer !important;
          box-shadow: 0 1px 2px rgba(0,0,0,0.06) !important;
          transition: background .15s ease !important;
        }
        #${elementId}__dashboard_section_csr button:hover,
        #${elementId} button.html5-qrcode-element:hover { background: #1d4ed8 !important; }

        /* Link chuyển "Scan an Image File" <-> camera */
        #${elementId} a {
          color: #2563eb !important;
          font-weight: 600 !important;
          font-size: 13px !important;
          text-decoration: none !important;
        }
        #${elementId} a:hover { text-decoration: underline !important; }

        /* Select chọn camera */
        #${elementId} select {
          padding: 8px 10px !important;
          border-radius: 8px !important;
          border: 1px solid #e5e7eb !important;
          font-size: 13px !important;
          color: #374151 !important;
          margin-bottom: 8px !important;
        }

        /* Vùng thông báo trạng thái / lỗi */
        #${elementId} #${elementId}__header_message {
          border: none !important;
          background: #eff6ff !important;
          color: #1d4ed8 !important;
          border-radius: 8px !important;
          padding: 8px 12px !important;
          font-size: 13px !important;
          margin: 10px 0 !important;
        }

        /* Khung video */
        #${elementId} video {
          border-radius: 14px !important;
          object-fit: cover !important;
        }

        /* Ảnh QR người dùng tải lên */
        #${elementId} img:not([alt*="Camera" i]) {
          max-width: 100% !important;
          max-height: 260px !important;
          object-fit: contain !important;
          border-radius: 12px !important;
          margin: 14px auto !important;
          display: block !important;
          border: 2px dashed #e2e8f0 !important;
          padding: 8px !important;
          background: #f8fafc !important;
        }
      `}</style>

      <div className="animate-in fade-in zoom-in relative flex w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl duration-200">
        <div className="flex items-center justify-between border-b border-gray-100 p-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <QrCode size={18} />
            </span>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                Quét mã QR đặt phòng
              </h2>
              <p className="text-xs text-gray-400">
                Đưa mã QR của khách vào khung hình
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 transition-colors hover:bg-gray-100"
            aria-label="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        <div className="bg-gray-50 p-5">
          <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-inner">
            <div id={elementId} />
          </div>
          <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs font-medium text-gray-500">
            <ScanLine size={13} />
            Hỗ trợ nhận diện mã QR đặt phòng, dịch vụ và khách hàng.
          </p>
        </div>
      </div>
    </div>
  );
};

export default QRScannerModal;
