import React, { useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { X, Camera } from 'lucide-react';

const QRScannerModal = ({ isOpen, onClose, onScanSuccess }) => {
  const scannerRef = useRef(null);
  const elementId = "qr-reader-container";

  useEffect(() => {
    if (isOpen) {
      // Đợi DOM ổn định
      const timer = setTimeout(() => {
        const scanner = new Html5QrcodeScanner(
          elementId,
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
            aspectRatio: 1.0,
            showTorchButtonIfSupported: true,
            rememberLastUsedCamera: true
          },
          /* verbose= */ false
        );

        scanner.render(
          (decodedText) => {
            onScanSuccess(decodedText);
            // Tự động đóng sau khi quét thành công
            scanner.clear().catch(e => console.error(e));
          },
          () => {
            // Lỗi quét (không phải lỗi camera), bỏ qua
          }
        );

        scannerRef.current = scanner;
      }, 500);

      return () => {
        clearTimeout(timer);
        if (scannerRef.current) {
          scannerRef.current.clear().catch(e => console.error("Cleanup error:", e));
          scannerRef.current = null;
        }
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4  bg-black/50">
      {/* CSS CUSTOM để làm đẹp giao diện mặc định của thư viện */}
      <style>{`
        #${elementId} {
          border: none !important;
          width: 100% !important;
        }
        /* Chỉ ẩn biểu tượng camera mặc định, không ẩn ảnh QR tải lên */
        #${elementId} img[alt*="Camera" i] {
          display: none !important;
        }
        /* Làm đẹp ảnh QR được tải lên */
        #${elementId} img:not([alt*="Camera" i]) {
          max-width: 100% !important;
          max-height: 280px !important;
          object-fit: contain !important;
          border-radius: 12px !important;
          margin: 15px auto !important;
          display: block !important;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08) !important;
          border: 2px dashed #e2e8f0 !important;
          padding: 8px !important;
          background: #f8fafc !important;
        }
        #${elementId}__dashboard_section_csr button {
          background: #4f46e5 !important;
          color: white !important;
          border: none !important;
          padding: 8px 16px !important;
          border-radius: 8px !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          margin-top: 10px !important;
          font-size: 14px !important;
        }
        #${elementId}__dashboard_section_csr select {
          padding: 8px !important;
          border-radius: 8px !important;
          border: 1px solid #ddd !important;
          font-size: 14px !important;
        }
        #${elementId} video {
          border-radius: 12px !important;
          object-fit: cover !important;
        }
      `}</style>

      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl flex flex-col relative transition-all animate-in fade-in zoom-in duration-300">
        {/* Modal Header */}
        <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <Camera size={20} />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Quét mã QR Booking</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400"
          >
            <X size={20} />
          </button>
        </div>

        {/* Scanner Area */}
        <div className="p-6 bg-gray-50 flex flex-col items-center justify-center min-h-[400px]">
          <div className="w-full bg-white rounded-xl shadow-inner p-4 border border-gray-100">
            <div id={elementId}></div>
          </div>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-500 font-medium font-sans px-4">
              Cho phép truy cập máy ảnh và đưa mã QR của khách hàng vào khung hình để tự động nhận diện.
            </p>
          </div>
        </div>

        {/* Footer/Instructions */}
        <div className="p-4 bg-white border-t border-gray-100 text-center">
          <p className="text-xs text-gray-400 font-medium">Hỗ trợ nhận diện mã QR đặt phòng, dịch vụ và khách hàng.</p>
        </div>
      </div>
    </div>
  );
};

export default QRScannerModal;
