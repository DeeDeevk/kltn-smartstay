// Chuyển phần tử <svg> QR (do qrcode.react render) thành ảnh PNG nền trắng có đệm
// và tải về máy khách. Dùng cho nút "Lưu mã QR" ở trang đặt phòng thành công.
export default function downloadQrPng(
  svgElement,
  filename = 'qr.png',
  { padding = 16, scale = 4 } = {},
) {
  if (!svgElement) return;

  const serialized = new XMLSerializer().serializeToString(svgElement);
  const svgUrl = URL.createObjectURL(
    new Blob([serialized], { type: 'image/svg+xml;charset=utf-8' }),
  );

  const img = new Image();
  img.onload = () => {
    const baseSize =
      svgElement.viewBox?.baseVal?.width ||
      Number(svgElement.getAttribute('width')) ||
      160;
    const pad = padding * scale;
    const drawn = baseSize * scale;

    const canvas = document.createElement('canvas');
    canvas.width = drawn + pad * 2;
    canvas.height = drawn + pad * 2;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, pad, pad, drawn, drawn);
    URL.revokeObjectURL(svgUrl);

    canvas.toBlob((blob) => {
      if (!blob) return;
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    }, 'image/png');
  };
  img.onerror = () => URL.revokeObjectURL(svgUrl);
  img.src = svgUrl;
}
