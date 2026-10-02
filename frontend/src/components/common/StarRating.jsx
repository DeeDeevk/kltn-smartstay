import { useState } from 'react';
import { Star } from 'lucide-react';

// Thang sao có bước NỬA SAO. Dùng được cả 2 kiểu:
//   - Chỉ hiển thị: <StarRating value={4.5} />
//   - Cho chọn:     <StarRating value={rating} onChange={setRating} />
//
// Cách vẽ nửa sao: xếp chồng 2 ngôi sao cùng vị trí — sao xám ở dưới, sao vàng ở trên
// nằm trong một khung bị cắt bớt bề ngang theo đúng tỉ lệ được lấp đầy. Không dùng
// gradient hay clip-path vì cách này giữ nguyên hình ngôi sao gốc của icon và hoạt
// động y hệt ở mọi cỡ.
export default function StarRating({ value = 0, onChange, size = 28 }) {
  const [hover, setHover] = useState(0);
  const interactive = typeof onChange === 'function';
  // Đang rê chuột thì xem trước mức đó, thả ra mới quay về giá trị đã chọn.
  const shown = interactive && hover ? hover : value;

  return (
    <div
      className="flex gap-1"
      onMouseLeave={() => setHover(0)}
      role={interactive ? 'radiogroup' : 'img'}
      aria-label={interactive ? undefined : `${value} / 5`}
    >
      {[1, 2, 3, 4, 5].map((index) => {
        // Phần được lấp của riêng ngôi sao thứ `index`: 0, 0.5 hoặc 1.
        const fill = Math.max(0, Math.min(1, shown - (index - 1)));

        return (
          <div key={index} className="relative" style={{ width: size, height: size }}>
            <Star size={size} className="text-gray-200" fill="currentColor" />
            <div
              className="absolute inset-y-0 left-0 overflow-hidden"
              style={{ width: `${fill * 100}%` }}
            >
              <Star size={size} className="text-amber-400" fill="currentColor" />
            </div>

            {/* Hai vùng bấm vô hình chia đôi ngôi sao: nửa trái = x.5, nửa phải = x.0 */}
            {interactive && (
              <>
                <button
                  type="button"
                  aria-label={`${index - 0.5} sao`}
                  onMouseEnter={() => setHover(index - 0.5)}
                  onClick={() => onChange(index - 0.5)}
                  className="absolute inset-y-0 left-0 w-1/2 cursor-pointer"
                />
                <button
                  type="button"
                  aria-label={`${index} sao`}
                  onMouseEnter={() => setHover(index)}
                  onClick={() => onChange(index)}
                  className="absolute inset-y-0 right-0 w-1/2 cursor-pointer"
                />
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
