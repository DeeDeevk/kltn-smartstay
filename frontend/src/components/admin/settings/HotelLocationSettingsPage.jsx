import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Crosshair, Info, Loader2, MapPin, MapPinOff, Save, Search } from 'lucide-react';
import { toast } from 'react-toastify';
import {
    getPlaceDetail,
    getVietmapStyleUrl,
    loadVietmapGL,
    reverseGeocode,
    searchAddress,
} from '../../../utils/vietmap';
import {
    useGetHotelConfigQuery,
    useUpdateHotelLocationMutation,
} from '../../../services/hotelConfig';

// Khách sạn CHƯA từng cấu hình vị trí (HotelConfig còn ở toạ độ mặc định 0,0 từ lúc
// getOrCreate() tạo bản ghi rỗng) -> KHÔNG dùng (0,0): mở toàn cảnh TP.HCM ở zoom thấp và
// chưa đặt ghim, cho tới khi admin chọn địa chỉ (lúc đó bay tới SELECTED_ZOOM).
const DEFAULT_CENTER = { lat: 10.78, lng: 106.7 };
const DEFAULT_ZOOM = 11;
const SELECTED_ZOOM = 16;
const MAP_LOAD_TIMEOUT_MS = 10000;
const MIN_SEARCH_LENGTH = 2; // Vietmap Autocomplete yêu cầu tối thiểu 2 ký tự
const SEARCH_DEBOUNCE_MS = 300;
const MARKER_COLOR = '#0EA5B5';
// Sai số cho phép khi so sánh toạ độ đang chỉnh với toạ độ đã lưu (quyết định nút Lưu/Huỷ
// có bật hay không) — tránh việc lệch vài phần triệu độ do làm tròn khiến nút cứ bật mãi.
const COORD_EPSILON = 1e-6;

function describeMapError(err) {
    const message = String(err?.message || err);
    if (/webgl/i.test(message)) {
        return 'Máy/trình duyệt này chưa bật WebGL nên không vẽ được bản đồ Vietmap. Bật "Sử dụng tăng tốc phần cứng" trong Chrome (Cài đặt → Hệ thống), kiểm tra tại chrome://gpu rồi tải lại trang.';
    }
    return message;
}

function sameCoord(a, b) {
    return typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) < COORD_EPSILON;
}

function formatDateTime(value) {
    return new Date(value).toLocaleString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

function CoordRow({ label, value, onCopy }) {
    return (
        <div className="flex items-center justify-between rounded-[10px] bg-[#F7F7FB] px-3 py-2.5">
            <div className="min-w-0">
                <p className="text-[10.5px] font-bold uppercase tracking-wide text-[#9AA0B4]">{label}</p>
                <p className="truncate font-mono text-sm text-[#1C1B29]">{value.toFixed(6)}</p>
            </div>
            <button
                type="button"
                onClick={onCopy}
                title="Sao chép"
                className="shrink-0 rounded-md p-1.5 text-[#9AA0B4] transition-colors hover:bg-white hover:text-[#4F46E5]"
            >
                <Copy size={14} />
            </button>
        </div>
    );
}

export default function HotelLocationSettingsPage() {
    const { data: config, isLoading: loadingConfig } = useGetHotelConfigQuery();
    const [updateLocation, { isLoading: saving }] = useUpdateHotelLocationMutation();

    const [address, setAddress] = useState('');
    const [position, setPosition] = useState(null); // { lat, lng } | null
    const [mapsError, setMapsError] = useState(null);
    // Bản đồ tạo xong không tự kích hoạt re-render (mapRef/markerRef là ref, không phải
    // state) — cần cờ state riêng này thì effect áp vị trí đã lưu bên dưới mới re-run
    // đúng lúc thư viện bản đồ tải xong sau khi config đã có sẵn.
    const [mapReady, setMapReady] = useState(false);

    const [suggestions, setSuggestions] = useState([]);
    // 'idle' | 'loading' | 'ready' | 'empty' | 'error'
    const [suggestState, setSuggestState] = useState('idle');
    const [searching, setSearching] = useState(false);
    const [resolvingAddress, setResolvingAddress] = useState(false);

    const addressInputRef = useRef(null);
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    // Marker chỉ được addTo(map) khi đã có vị trí thật (chọn địa chỉ / vị trí đã lưu) —
    // false lúc mới vào trang mà khách sạn chưa từng cấu hình vị trí.
    const markerOnMapRef = useRef(false);
    const suggestTimerRef = useRef(null);
    // Chống kết quả trả về lệch thứ tự: chỉ nhận response của request MỚI NHẤT.
    const suggestSeqRef = useRef(0);
    const reverseSeqRef = useRef(0);
    // Đánh dấu đã đưa marker/bản đồ về đúng vị trí đã lưu 1 lần — nếu không có cờ này,
    // mỗi lần query refetch (VD sau khi lưu xong, tag HotelConfig bị invalidate) sẽ kéo
    // bản đồ giật về lại vị trí cũ, đè lên thao tác khách vừa kéo ghim.
    const appliedConfigRef = useRef(false);

    const placeMarker = useCallback((lat, lng) => {
        const marker = markerRef.current;
        const map = mapRef.current;
        if (!marker || !map) return;
        marker.setLngLat([lng, lat]);
        if (!markerOnMapRef.current) {
            marker.addTo(map);
            markerOnMapRef.current = true;
        }
    }, []);

    const hideMarker = useCallback(() => {
        if (!markerOnMapRef.current) return;
        markerRef.current?.remove();
        markerOnMapRef.current = false;
    }, []);

    // Kéo ghim xong -> Reverse Geocoding lấy lại địa chỉ chữ cho ô nhập. Lỗi thì giữ nguyên
    // địa chỉ cũ (không xoá trắng), admin vẫn tự sửa tay được.
    const resolveAddress = useCallback(async (lat, lng) => {
        const seq = ++reverseSeqRef.current;
        setResolvingAddress(true);
        try {
            const text = await reverseGeocode(lat, lng);
            if (seq === reverseSeqRef.current && text) setAddress(text);
        } catch {
            if (seq === reverseSeqRef.current) {
                toast.warning('Không lấy được địa chỉ tại vị trí mới — giữ nguyên địa chỉ cũ, bạn có thể tự sửa.');
            }
        } finally {
            if (seq === reverseSeqRef.current) setResolvingAddress(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        let map = null;
        let marker = null;
        let loadTimer = null;

        loadVietmapGL()
            .then((vietmapgl) => {
                if (cancelled || !mapContainerRef.current) return;

                // Vietmap chỉ có nền đường phố dạng vector (GL) — bắt buộc WebGL, không có
                // chế độ raster như tuỳ chọn. Máy không có WebGL -> constructor ném lỗi,
                // được .catch bên dưới đổi thành hướng dẫn bật tăng tốc phần cứng.
                map = new vietmapgl.Map({
                    container: mapContainerRef.current,
                    style: getVietmapStyleUrl(),
                    center: [DEFAULT_CENTER.lng, DEFAULT_CENTER.lat], // GL dùng [lng, lat]
                    zoom: DEFAULT_ZOOM,
                });
                map.addControl(new vietmapgl.NavigationControl({ showCompass: false }), 'top-right');

                // Style/tile lỗi TRƯỚC khi bản đồ dựng xong (key sai, hết hạn mức 423...)
                // thì báo rõ thay vì để khung trắng im lặng. Lỗi lẻ tẻ của 1 tile SAU khi đã
                // dựng xong thì bỏ qua, không hiện banner. Thêm đồng hồ chờ vì có những lỗi
                // (VD worker/tile không tải được) không bắn sự kiện 'error' nào cả.
                let loaded = false;
                loadTimer = window.setTimeout(() => {
                    if (!loaded && !cancelled) {
                        setMapsError(
                            'Nền bản đồ Vietmap chưa tải xong sau 10 giây. Kiểm tra kết nối mạng rồi tải lại trang; nếu vẫn lỗi, kiểm tra VITE_VIETMAP_TILEMAP_KEY.',
                        );
                    }
                }, MAP_LOAD_TIMEOUT_MS);
                map.once('load', () => {
                    loaded = true;
                    window.clearTimeout(loadTimer);
                    setMapsError(null);
                });
                map.on('error', (event) => {
                    if (!loaded && !cancelled) {
                        setMapsError(
                            `Không tải được nền bản đồ Vietmap (${describeMapError(event.error)}). Kiểm tra VITE_VIETMAP_TILEMAP_KEY và hạn mức key.`,
                        );
                    }
                });

                // Chưa addTo(map): ghim chỉ hiện sau khi có vị trí thật (xem placeMarker).
                marker = new vietmapgl.Marker({ draggable: true, color: MARKER_COLOR });
                // Kéo ghim là nguồn toạ độ CUỐI CÙNG, ưu tiên hơn toạ độ gợi ý chọn trước
                // đó — đúng yêu cầu "ưu tiên giá trị này khi lưu".
                marker.on('dragend', () => {
                    const { lat, lng } = marker.getLngLat();
                    setPosition({ lat, lng });
                    setSuggestions([]);
                    setSuggestState('idle');
                    resolveAddress(lat, lng);
                });

                mapRef.current = map;
                markerRef.current = marker;
                setMapReady(true);
            })
            .catch((err) => {
                if (!cancelled) setMapsError(describeMapError(err));
            });

        return () => {
            cancelled = true;
            window.clearTimeout(suggestTimerRef.current);
            window.clearTimeout(loadTimer);
            marker?.remove();
            map?.remove();
            mapRef.current = null;
            markerRef.current = null;
            markerOnMapRef.current = false;
        };
    }, [resolveAddress]);

    // Đưa marker/bản đồ về đúng vị trí đã lưu ngay khi cả bản đồ lẫn dữ liệu config đều
    // sẵn sàng (không cần biết cái nào xong trước — effect này tự chờ đủ cả 2). Phải có
    // mapReady trong dependency: nếu config tới trước lúc thư viện bản đồ còn đang tải,
    // effect chạy sớm, thấy !mapRef.current rồi return mà KHÔNG set appliedConfigRef —
    // không có mapReady thì effect không bao giờ được kích hoạt lại lần nữa vì config
    // không đổi thêm nữa.
    useEffect(() => {
        if (appliedConfigRef.current || !config || !mapRef.current || !markerRef.current) return;

        const hasSavedLocation = config.latitude !== 0 || config.longitude !== 0;
        if (hasSavedLocation) {
            const center = { lat: config.latitude, lng: config.longitude };
            mapRef.current.jumpTo({ center: [center.lng, center.lat], zoom: SELECTED_ZOOM });
            placeMarker(center.lat, center.lng);
            setPosition(center);
        }
        setAddress(config.address ?? '');
        appliedConfigRef.current = true;
    }, [config, mapReady, placeMarker]);

    // Gõ vào ô địa chỉ -> gọi Autocomplete (debounce). Gọi ở onChange chứ không phải effect
    // theo `address`, để các lần setAddress do chương trình (chọn gợi ý, kéo ghim) không
    // kích hoạt lại một lượt tìm kiếm ngoài ý muốn.
    const handleAddressChange = (event) => {
        const value = event.target.value;
        setAddress(value);
        window.clearTimeout(suggestTimerRef.current);

        const text = value.trim();
        if (text.length < MIN_SEARCH_LENGTH) {
            suggestSeqRef.current += 1;
            setSuggestions([]);
            setSuggestState('idle');
            return;
        }

        suggestTimerRef.current = window.setTimeout(async () => {
            const seq = ++suggestSeqRef.current;
            setSuggestState('loading');
            try {
                const list = await searchAddress(text, position ?? DEFAULT_CENTER);
                if (seq !== suggestSeqRef.current) return;
                setSuggestions(list);
                setSuggestState(list.length > 0 ? 'ready' : 'empty');
            } catch {
                if (seq !== suggestSeqRef.current) return;
                setSuggestions([]);
                setSuggestState('error');
            }
        }, SEARCH_DEBOUNCE_MS);
    };

    // Chọn 1 địa chỉ (từ gợi ý hoặc kết quả đầu của nút Tìm): Autocomplete chỉ cho ref_id nên
    // phải gọi Place lấy toạ độ chính xác rồi mới di chuyển bản đồ + marker.
    const applyPlace = async (item) => {
        window.clearTimeout(suggestTimerRef.current);
        suggestSeqRef.current += 1;
        try {
            const place = await getPlaceDetail(item.refId);
            placeMarker(place.lat, place.lng);
            mapRef.current?.flyTo({ center: [place.lng, place.lat], zoom: SELECTED_ZOOM });
            setPosition({ lat: place.lat, lng: place.lng });
            setAddress(place.display || item.display);
            setSuggestions([]);
            setSuggestState('idle');
        } catch {
            toast.error('Không lấy được toạ độ của địa chỉ này, thử một gợi ý khác.');
        }
    };

    // Nút/nhấn Enter để tìm theo đúng chữ đang gõ — lấy kết quả khớp nhất của Autocomplete
    // (bổ sung cho danh sách gợi ý, vốn chỉ chọn được bằng cách bấm vào từng dòng).
    const handleSearchAddress = async () => {
        const text = address.trim();
        if (text.length < MIN_SEARCH_LENGTH || searching) return;
        window.clearTimeout(suggestTimerRef.current);
        setSearching(true);
        try {
            const list = await searchAddress(text, position ?? DEFAULT_CENTER);
            if (list.length === 0) {
                toast.error('Không tìm thấy địa chỉ này trên bản đồ');
                return;
            }
            await applyPlace(list[0]);
        } catch {
            toast.error('Không tìm được địa chỉ lúc này, vui lòng thử lại.');
        } finally {
            setSearching(false);
        }
    };

    const hasSavedLocation = Boolean(config) && (config.latitude !== 0 || config.longitude !== 0);

    // "Đang chỉnh" (address/position hiện tại) có khác dữ liệu đã lưu trong DB không — quyết
    // định nút Lưu/Huỷ có bật hay không. So trực tiếp với `config` (RTK Query cache) thay vì
    // giữ 1 bản "snapshot" riêng: sau khi lưu thành công, invalidatesTags làm config tự
    // refetch, "đã lưu" và "đang chỉnh" lại khớp nhau ngay mà không cần đồng bộ tay.
    const isDirty = useMemo(() => {
        if (!config) return false;
        const savedAddress = hasSavedLocation ? (config.address ?? '') : '';
        if (address.trim() !== savedAddress.trim()) return true;
        if (!hasSavedLocation) return Boolean(position);
        if (!position) return true;
        return !sameCoord(position.lat, config.latitude) || !sameCoord(position.lng, config.longitude);
    }, [config, hasSavedLocation, address, position]);

    // Chỉ dịch chuyển KHUNG NHÌN bản đồ về đúng vị trí đã lưu để admin xem lại, KHÔNG đụng
    // tới marker/địa chỉ đang chỉnh dở — khác hẳn "Huỷ thay đổi" (reset toàn bộ state).
    const handleFlyToSaved = () => {
        if (!hasSavedLocation || !mapRef.current) return;
        mapRef.current.flyTo({ center: [config.longitude, config.latitude], zoom: SELECTED_ZOOM });
    };

    // Bỏ hết thay đổi đang chỉnh dở, quay về đúng dữ liệu đã lưu (hoặc về trạng thái trống
    // nếu khách sạn chưa từng lưu vị trí nào) — chỉ đổi state cục bộ, không gọi API.
    const handleCancel = () => {
        window.clearTimeout(suggestTimerRef.current);
        suggestSeqRef.current += 1;
        setSuggestions([]);
        setSuggestState('idle');

        if (hasSavedLocation) {
            const center = { lat: config.latitude, lng: config.longitude };
            placeMarker(center.lat, center.lng);
            mapRef.current?.flyTo({ center: [center.lng, center.lat], zoom: SELECTED_ZOOM });
            setPosition(center);
            setAddress(config.address ?? '');
        } else {
            hideMarker();
            setPosition(null);
            setAddress('');
        }
    };

    const handleCopyCoord = async (value) => {
        try {
            await navigator.clipboard.writeText(String(value));
            toast.success('Đã sao chép');
        } catch {
            toast.error('Không sao chép được — trình duyệt đang chặn quyền clipboard.');
        }
    };

    const handleSave = async () => {
        if (!address.trim()) {
            toast.error('Vui lòng nhập địa chỉ khách sạn');
            return;
        }
        if (!position) {
            toast.error('Vui lòng chọn vị trí trên bản đồ (tìm địa chỉ hoặc kéo ghim)');
            return;
        }
        try {
            await updateLocation({
                address: address.trim(),
                latitude: position.lat,
                longitude: position.lng,
            }).unwrap();
            toast.success('Đã lưu vị trí khách sạn');
        } catch (err) {
            toast.error(err?.data?.message || 'Không thể lưu vị trí khách sạn');
        }
    };

    return (
        <>
            <h1 className="mb-1 text-2xl font-bold text-[#1C1B29]">Cài đặt vị trí khách sạn</h1>
            <p className="mb-6 text-sm text-[#6B7280]">
                Vị trí này là tâm để trợ lý AI gợi ý địa điểm ăn uống, vui chơi, tham quan gần khách
                sạn cho khách.
            </p>

            {mapsError && (
                <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                    {mapsError}
                </p>
            )}

            <div className="rounded-[20px] border border-[#E7E9F1] bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-5 lg:flex-row">
                    {/* Cột trái: bản đồ */}
                    <div className="lg:flex-[1.6]">
                        <div className="relative h-[420px] w-full overflow-hidden rounded-[20px] border border-[#E7E9F1] bg-[#F5F1E8] lg:h-[560px]">
                            <div ref={mapContainerRef} className="h-full w-full" />

                            {/* Thanh tìm kiếm + gợi ý — nổi đè lên bản đồ */}
                            <div className="absolute left-4 right-4 top-4 z-10 max-w-[400px]">
                                <div className="flex items-center gap-2 rounded-[14px] bg-white p-1.5 pl-3 shadow-[0_8px_24px_rgba(23,24,45,0.12)]">
                                    {searching || suggestState === 'loading' ? (
                                        <Loader2 size={16} className="shrink-0 animate-spin text-[#9AA0B4]" />
                                    ) : (
                                        <Search size={16} className="shrink-0 text-[#9AA0B4]" />
                                    )}
                                    <input
                                        ref={addressInputRef}
                                        type="text"
                                        value={address}
                                        maxLength={255}
                                        onChange={handleAddressChange}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleSearchAddress();
                                            }
                                        }}
                                        placeholder="Nhập địa chỉ rồi bấm Tìm, hoặc chọn từ gợi ý Vietmap bên dưới..."
                                        className="min-w-0 flex-1 bg-transparent py-1.5 text-sm text-[#1C1B29] placeholder:text-[#9AA0B4] focus:outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleSearchAddress}
                                        disabled={searching}
                                        className="shrink-0 rounded-[10px] bg-[#4F46E5] px-3.5 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        Tìm
                                    </button>
                                </div>

                                {suggestState === 'ready' && (
                                    <ul className="mt-2 max-h-60 overflow-y-auto rounded-xl bg-white py-1 shadow-[0_4px_16px_rgba(23,24,45,0.1)]">
                                        {suggestions.map((item) => (
                                            <li key={item.refId}>
                                                <button
                                                    type="button"
                                                    onClick={() => applyPlace(item)}
                                                    className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-[#F5F5FF]"
                                                >
                                                    <MapPin size={14} className="mt-0.5 shrink-0 text-[#9AA0B4]" />
                                                    <span className="min-w-0">
                                                        <span className="block truncate text-sm font-medium text-[#1C1B29]">{item.name}</span>
                                                        <span className="block truncate text-xs text-[#6B7280]">{item.address}</span>
                                                    </span>
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {suggestState === 'empty' && (
                                    <p className="mt-2 rounded-xl bg-white px-3 py-2 text-xs text-[#9AA0B4] shadow-[0_4px_16px_rgba(23,24,45,0.1)]">
                                        Không có gợi ý phù hợp — thử gõ cụ thể hơn.
                                    </p>
                                )}
                                {suggestState === 'error' && (
                                    <p className="mt-2 rounded-xl bg-white px-3 py-2 text-xs text-red-500 shadow-[0_4px_16px_rgba(23,24,45,0.1)]">
                                        Không lấy được gợi ý lúc này, vui lòng thử lại.
                                    </p>
                                )}
                            </div>

                            {/* Về đúng vị trí đã lưu (chỉ dịch chuyển khung nhìn, không đổi dữ liệu) */}
                            <button
                                type="button"
                                onClick={handleFlyToSaved}
                                disabled={!hasSavedLocation}
                                title={hasSavedLocation ? 'Về vị trí đã lưu' : 'Chưa có vị trí đã lưu'}
                                className="absolute bottom-4 left-4 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white text-[#4F46E5] shadow-[0_4px_12px_rgba(23,24,45,0.15)] transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                <Crosshair size={16} />
                            </button>
                        </div>
                        <p className="mt-2 text-xs text-[#9AA0B4]">Kéo ghim trên bản đồ để tinh chỉnh vị trí chính xác.</p>
                    </div>

                    {/* Cột phải: thông tin + hành động */}
                    <div className="flex flex-col gap-4 lg:w-[300px] lg:flex-1">
                        {loadingConfig ? (
                            <>
                                <div className="h-[124px] animate-pulse rounded-2xl bg-[#F7F7FB]" />
                                <div className="h-24 animate-pulse rounded-2xl bg-[#F7F7FB]" />
                            </>
                        ) : (
                            <>
                                {hasSavedLocation ? (
                                    <div className="rounded-2xl border border-[#E7E9F1] bg-white p-5">
                                        <div className="mb-2 flex items-center justify-between gap-2">
                                            <span className="text-[13px] font-bold text-[#6B7280]">Vị trí đã lưu</span>
                                            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#BBF7D0] bg-[#ECFDF3] px-2.5 py-1 text-xs font-semibold text-[#16A34A]">
                                                <span className="h-1.5 w-1.5 rounded-full bg-[#16A34A]" /> Đang áp dụng
                                            </span>
                                        </div>
                                        <p className="text-[15.5px] font-bold text-[#1C1B29]">{config.address}</p>
                                        {config.updatedAt && (
                                            <p className="mt-1 text-xs text-[#9AA0B4]">
                                                Cập nhật lần cuối: {formatDateTime(config.updatedAt)}
                                            </p>
                                        )}
                                        <div className="mt-3 flex items-start gap-2 rounded-[10px] bg-[#F7F7FB] p-3">
                                            <Info size={14} className="mt-0.5 shrink-0 text-[#9AA0B4]" />
                                            <p className="text-xs text-[#6B7280]">
                                                Trợ lý AI đang dùng vị trí này để gợi ý địa điểm ăn uống, vui chơi cho khách.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-[#E7E9F1] bg-white p-5 text-center">
                                        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[#FFF7ED]">
                                            <MapPinOff size={18} className="text-[#D97706]" />
                                        </div>
                                        <p className="text-sm font-bold text-[#1C1B29]">Khách sạn chưa có vị trí</p>
                                        <p className="mt-1 text-xs text-[#6B7280]">
                                            Tìm và lưu địa chỉ khách sạn để trợ lý AI có thể gợi ý địa điểm ăn uống, vui
                                            chơi gần đó cho khách.
                                        </p>
                                        <button
                                            type="button"
                                            onClick={() => addressInputRef.current?.focus()}
                                            className="mt-3 rounded-full border border-[#E7E9F1] px-4 py-2 text-xs font-semibold text-[#4F46E5] transition-colors hover:bg-[#F5F5FF]"
                                        >
                                            Tìm địa chỉ ngay
                                        </button>
                                    </div>
                                )}

                                {position && (
                                    <div className="rounded-2xl border border-[#E7E9F1] bg-white p-5">
                                        <p className="mb-3 text-[13px] font-bold text-[#6B7280]">Toạ độ</p>
                                        {resolvingAddress ? (
                                            <div className="space-y-2">
                                                <div className="h-[46px] animate-pulse rounded-[10px] bg-[#F7F7FB]" />
                                                <div className="h-[46px] animate-pulse rounded-[10px] bg-[#F7F7FB]" />
                                            </div>
                                        ) : (
                                            <div className="space-y-2">
                                                <CoordRow label="Vĩ độ" value={position.lat} onCopy={() => handleCopyCoord(position.lat)} />
                                                <CoordRow label="Kinh độ" value={position.lng} onCopy={() => handleCopyCoord(position.lng)} />
                                            </div>
                                        )}
                                    </div>
                                )}

                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={handleCancel}
                                        disabled={!isDirty || saving}
                                        className="rounded-xl border border-[#E7E9F1] px-4 py-2.5 text-sm font-semibold text-[#6B7280] transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        Huỷ thay đổi
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleSave}
                                        disabled={!isDirty || saving || loadingConfig}
                                        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#4F46E5] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#4338CA] disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                        Lưu vị trí
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
