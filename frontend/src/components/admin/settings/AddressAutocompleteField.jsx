import { useState } from 'react';
import { Loader2, MapPin, Search } from 'lucide-react';
import { getPlaceDetail } from '../../../utils/vietmap';
import useAddressAutocomplete from '../../../hooks/useAddressAutocomplete';

// Ô tìm địa chỉ NHỎ, không kèm bản đồ — tái dùng ĐÚNG hook debounce/autocomplete dùng
// chung với HotelLocationSettingsPage (useAddressAutocomplete) và hàm getPlaceDetail đã có
// ở utils/vietmap.js, không viết lại logic gọi API. Khác HotelLocationSettingsPage ở chỗ
// không cần vẽ bản đồ/marker — chỉ cần chọn đúng 1 địa chỉ rồi trả toạ độ ra ngoài qua
// onSelect, dùng cho card "Chờ duyệt" của LocalPlace (admin xác nhận địa chỉ cho 1 địa điểm
// AI đề xuất) và form thêm/sửa thủ công.
export default function AddressAutocompleteField({ value, placeholder, onSelect }) {
  const [text, setText] = useState('');
  const [resolving, setResolving] = useState(null); // refId đang resolve, null nếu không có
  const { suggestions, state, search, reset, setError } = useAddressAutocomplete();

  const handleChange = (e) => {
    const next = e.target.value;
    setText(next);
    search(next);
  };

  const handleSelect = async (item) => {
    setResolving(item.refId);
    try {
      const place = await getPlaceDetail(item.refId);
      onSelect({
        address: place.display || item.display,
        latitude: place.lat,
        longitude: place.lng,
      });
      setText('');
      reset();
    } catch {
      setError();
    } finally {
      setResolving(null);
    }
  };

  return (
    <div>
      {value && (
        <div className="mb-1.5 flex items-start gap-1.5 rounded-lg bg-[#F0FDF4] px-2.5 py-1.5 text-xs text-[#15803D]">
          <MapPin size={13} className="mt-0.5 shrink-0" />
          <span className="min-w-0 break-words">{value}</span>
        </div>
      )}
      <div className="flex items-center gap-2 rounded-lg border border-[#E7E9F1] px-2.5 py-1.5">
        {state === 'loading' ? (
          <Loader2 size={14} className="shrink-0 animate-spin text-[#9AA0B4]" />
        ) : (
          <Search size={14} className="shrink-0 text-[#9AA0B4]" />
        )}
        <input
          type="text"
          value={text}
          onChange={handleChange}
          placeholder={placeholder ?? 'Tìm địa chỉ trên Vietmap...'}
          className="min-w-0 flex-1 bg-transparent text-xs text-[#1C1B29] placeholder:text-[#9AA0B4] focus:outline-none"
        />
      </div>

      {state === 'ready' && (
        <ul className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-[#E7E9F1] bg-white py-1 shadow-sm">
          {suggestions.map((item) => (
            <li key={item.refId}>
              <button
                type="button"
                onClick={() => handleSelect(item)}
                disabled={resolving !== null}
                className="flex w-full items-start gap-1.5 px-2.5 py-1.5 text-left transition-colors hover:bg-[#F5F5FF] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <MapPin size={12} className="mt-0.5 shrink-0 text-[#9AA0B4]" />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-[#1C1B29]">{item.name}</span>
                  <span className="block truncate text-[11px] text-[#6B7280]">{item.address}</span>
                </span>
                {resolving === item.refId && (
                  <Loader2 size={12} className="ml-auto mt-0.5 shrink-0 animate-spin text-[#9AA0B4]" />
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
      {state === 'empty' && (
        <p className="mt-1 text-[11px] text-[#9AA0B4]">Không có gợi ý phù hợp.</p>
      )}
      {state === 'error' && (
        <p className="mt-1 text-[11px] text-red-500">Không tìm được địa chỉ lúc này, thử lại.</p>
      )}
    </div>
  );
}
