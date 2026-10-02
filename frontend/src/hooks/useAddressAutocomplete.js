import { useCallback, useEffect, useRef, useState } from 'react';
import { searchAddress } from '../utils/vietmap';

const MIN_SEARCH_LENGTH = 2; // Vietmap Autocomplete yêu cầu tối thiểu 2 ký tự
const SEARCH_DEBOUNCE_MS = 300;

// Debounce + chống kết quả trả về sai thứ tự (stale response) cho Vietmap Autocomplete —
// trước đây logic này bị viết lặp lại y hệt ở cả HotelLocationSettingsPage.jsx lẫn
// AddressAutocompleteField.jsx (2 nơi độc lập cùng debounce searchAddress() với cùng
// MIN_SEARCH_LENGTH/SEARCH_DEBOUNCE_MS và cùng cơ chế seqRef chống race), nay gộp vào 1 hook
// dùng chung để sửa 1 lần là áp dụng cho cả 2 nơi.
//
// `focus` được truyền MỖI LẦN gọi search() (không truyền sẵn khi gọi hook) vì ở
// HotelLocationSettingsPage, điểm neo tìm kiếm thay đổi theo vị trí marker hiện tại — truyền
// qua tham số tránh hook phải đọc giá trị "stale" qua closure.
export default function useAddressAutocomplete() {
    const [suggestions, setSuggestions] = useState([]);
    // 'idle' | 'loading' | 'ready' | 'empty' | 'error'
    const [state, setState] = useState('idle');
    const timerRef = useRef(null);
    const seqRef = useRef(0);

    // Huỷ debounce timer đang chờ khi component dùng hook này unmount — nếu không, callback
    // trong setTimeout vẫn chạy sau khi unmount và gọi setState trên component đã gỡ bỏ.
    useEffect(() => () => window.clearTimeout(timerRef.current), []);

    // useCallback với deps rỗng: search/reset/setError chỉ dùng refs (timerRef/seqRef) và
    // setState setters — cả 2 loại đều có tham chiếu ỔN ĐỊNH qua mọi lần render, nên hàm trả
    // ra cũng cần ổn định theo để nơi gọi (VD effect chỉ chạy 1 lần lúc mount ở
    // HotelLocationSettingsPage) có thể đưa thẳng vào dependency array mà không gây re-run
    // effect ở mỗi lần render.
    const search = useCallback((text, focus) => {
        window.clearTimeout(timerRef.current);

        const trimmed = text.trim();
        if (trimmed.length < MIN_SEARCH_LENGTH) {
            seqRef.current += 1;
            setSuggestions([]);
            setState('idle');
            return;
        }

        timerRef.current = window.setTimeout(async () => {
            const seq = ++seqRef.current;
            setState('loading');
            try {
                const list = await searchAddress(trimmed, focus);
                if (seq !== seqRef.current) return;
                setSuggestions(list);
                setState(list.length > 0 ? 'ready' : 'empty');
            } catch {
                if (seq !== seqRef.current) return;
                setSuggestions([]);
                setState('error');
            }
        }, SEARCH_DEBOUNCE_MS);
    }, []);

    const reset = useCallback(() => {
        window.clearTimeout(timerRef.current);
        seqRef.current += 1;
        setSuggestions([]);
        setState('idle');
    }, []);

    // Dùng khi bước SAU gợi ý (VD gọi getPlaceDetail để lấy toạ độ) thất bại — tái dùng
    // chung trạng thái 'error' với lỗi tìm gợi ý, không cần thêm 1 state machine riêng.
    const setError = useCallback(() => setState('error'), []);

    return { suggestions, state, search, reset, setError };
}
