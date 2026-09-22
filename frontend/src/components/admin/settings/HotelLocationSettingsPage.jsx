import { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, Loader2, Save, Search } from 'lucide-react';
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

function describeMapError(err) {
    const message = String(err?.message || err);
    if (/webgl/i.test(message)) {
        return 'Máy/trình duyệt này chưa bật WebGL nên không vẽ được bản đồ Vietmap. Bật "Sử dụng tăng tốc phần cứng" trong Chrome (Cài đặt → Hệ thống), kiểm tra tại chrome://gpu rồi tải lại trang.';
    }
    return message;
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

    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    // Marker chỉ được addTo(map) lần đầu khi đã có vị trí thật (chọn địa chỉ / vị trí đã lưu).
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
                marker = new vietmapgl.Marker({ draggable: true });
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
            <h1 className="mb-6 text-2xl font-bold text-gray-900">Cài đặt vị trí khách sạn</h1>

            <div className="max-w-3xl space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
                {mapsError && (
                    <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">
                        {mapsError}
                    </p>
                )}

                <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                        Địa chỉ khách sạn
                    </label>
                    <div className="flex gap-2">
                        <div className="relative flex-1">
                            <MapPin
                                size={16}
                                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                            />
                            <input
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
                                className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                            {resolvingAddress && (
                                <Loader2
                                    size={16}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-gray-400"
                                />
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={handleSearchAddress}
                            disabled={searching}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {searching ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />} Tìm
                        </button>
                    </div>

                    <p className="mb-1 mt-2 flex items-center gap-1.5 text-xs text-gray-400">
                        Hoặc chọn nhanh từ gợi ý Vietmap:
                        {suggestState === 'loading' && <Loader2 size={12} className="animate-spin" />}
                    </p>
                    {suggestState === 'ready' && (
                        <ul className="max-h-60 divide-y divide-gray-100 overflow-y-auto rounded-lg border border-gray-200 bg-white text-sm shadow-sm">
                            {suggestions.map((item) => (
                                <li key={item.refId}>
                                    <button
                                        type="button"
                                        onClick={() => applyPlace(item)}
                                        className="flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-indigo-50"
                                    >
                                        <MapPin size={14} className="mt-0.5 shrink-0 text-gray-400" />
                                        <span className="min-w-0">
                                            <span className="block truncate font-medium text-gray-800">{item.name}</span>
                                            <span className="block truncate text-xs text-gray-500">{item.address}</span>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    {suggestState === 'empty' && (
                        <p className="text-xs text-gray-400">Không có gợi ý phù hợp — thử gõ cụ thể hơn.</p>
                    )}
                    {suggestState === 'error' && (
                        <p className="text-xs text-red-500">Không lấy được gợi ý lúc này, vui lòng thử lại.</p>
                    )}
                </div>

                <div
                    ref={mapContainerRef}
                    className="h-80 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                />
                <p className="text-xs text-gray-400">Kéo ghim trên bản đồ để tinh chỉnh vị trí chính xác.</p>

                {position && (
                    <p className="text-xs text-gray-500">
                        Toạ độ đã chọn: {position.lat.toFixed(7)}, {position.lng.toFixed(7)}
                    </p>
                )}

                <button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || loadingConfig}
                    className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                    Lưu vị trí
                </button>
            </div>
        </>
    );
}
