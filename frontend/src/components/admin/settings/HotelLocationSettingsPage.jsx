import { useEffect, useRef, useState } from 'react';
import { MapPin, Loader2, Save, Search } from 'lucide-react';
import { toast } from 'react-toastify';
import loadGoogleMaps from '../../../utils/loadGoogleMaps';
import {
    useGetHotelConfigQuery,
    useUpdateHotelLocationMutation,
} from '../../../services/hotelConfig';

// Trung tâm TP.HCM — chỉ dùng làm điểm bắt đầu khi khách sạn CHƯA từng cấu hình vị trí
// (HotelConfig còn ở toạ độ mặc định 0,0 từ lúc getOrCreate() tạo bản ghi rỗng).
const DEFAULT_CENTER = { lat: 10.776889, lng: 106.700897 };

export default function HotelLocationSettingsPage() {
    const { data: config, isLoading: loadingConfig } = useGetHotelConfigQuery();
    const [updateLocation, { isLoading: saving }] = useUpdateHotelLocationMutation();

    const [address, setAddress] = useState('');
    const [position, setPosition] = useState(null); // { lat, lng } | null
    const [googlePlaceId, setGooglePlaceId] = useState(null);
    const [mapsError, setMapsError] = useState(null);
    // Bản đồ tạo xong không tự kích hoạt re-render (mapRef/markerRef là ref, không phải
    // state) — cần cờ state riêng này thì effect áp vị trí đã lưu bên dưới mới re-run
    // đúng lúc script Google Maps tải xong sau khi config đã có sẵn.
    const [mapReady, setMapReady] = useState(false);

    const addressInputRef = useRef(null);
    const mapContainerRef = useRef(null);
    const autocompleteContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markerRef = useRef(null);
    const geocoderRef = useRef(null);
    // Đánh dấu đã đưa marker/bản đồ về đúng vị trí đã lưu 1 lần — nếu không có cờ này,
    // mỗi lần query refetch (VD sau khi lưu xong, tag HotelConfig bị invalidate) sẽ kéo
    // bản đồ giật về lại vị trí cũ, đè lên thao tác khách vừa kéo ghim.
    const appliedConfigRef = useRef(false);

    useEffect(() => {
        let cancelled = false;

        loadGoogleMaps()
            .then((maps) => {
                if (cancelled || !mapContainerRef.current || !autocompleteContainerRef.current) return;

                // renderingType: RASTER ép buộc không dùng WebGL, tránh lỗi driver GPU trên
                // một số máy. KHÔNG được chỉ dựa vào việc bỏ mapId — Google đã đổi default,
                // nhiều project giờ tự dùng Vector kể cả không truyền mapId, nên phải ép rõ
                // ràng bằng option này (đặt cùng cấp với center/zoom, không lồng vào đâu cả).
                const map = new maps.Map(mapContainerRef.current, {
                    center: DEFAULT_CENTER,
                    zoom: 15,
                    mapTypeControl: false,
                    streetViewControl: false,
                    renderingType: maps.RenderingType.RASTER,
                });
                // Xác nhận CHẮC CHẮN map thật sự dùng Raster (không chỉ dựa vào việc hết lỗi,
                // vì lỗi driver GPU có thể ẩn tạm trên máy khác) — kiểm tra lại console mỗi
                // lần đổi cấu hình rendering.
                // eslint-disable-next-line no-console
                console.log('[HotelLocationSettingsPage] renderingType:', map.getRenderingType());
                // google.maps.Marker (cổ điển) — không cần mapId, không phụ thuộc WebGL như
                // AdvancedMarkerElement, khớp với quyết định dùng Raster ở trên.
                const marker = new maps.Marker({
                    position: DEFAULT_CENTER,
                    map,
                    draggable: true,
                });
                geocoderRef.current = new maps.Geocoder();

                // Nếu Maps JS API load được (script không lỗi) nhưng project chưa bật/billing
                // chưa cấu hình cho Maps JavaScript API, Google KHÔNG throw exception nào bắt
                // được — chỉ log lỗi ra console và không bao giờ vẽ tile nào cả (khung bản đồ
                // trắng trơn, không rõ nguyên nhân). Canh sự kiện 'tilesloaded' trong vài giây,
                // không thấy thì tự hiện cảnh báo rõ ràng thay vì im lặng để trắng.
                const tilesTimeout = window.setTimeout(() => {
                    if (!cancelled) {
                        setMapsError(
                            'Bản đồ không hiển thị được. Vui lòng kiểm tra Console (F12) để xem lỗi cụ thể từ Google Maps, và kiểm tra API key đã bật "Maps JavaScript API" + bật Billing trong Google Cloud Console chưa.',
                        );
                    }
                }, 4000);
                maps.event.addListenerOnce(map, 'tilesloaded', () => {
                    window.clearTimeout(tilesTimeout);
                });

                // Kéo ghim là nguồn toạ độ CUỐI CÙNG, ưu tiên hơn toạ độ Autocomplete chọn
                // trước đó — đúng yêu cầu "ưu tiên giá trị này khi lưu".
                marker.addListener('dragend', () => {
                    const pos = marker.getPosition();
                    if (!pos) return;
                    setPosition({ lat: pos.lat(), lng: pos.lng() });
                });

                // PlaceAutocompleteElement thay cho Autocomplete cũ — không "gắn thêm" vào 1
                // <input> có sẵn như trước mà là 1 custom element tự có input riêng, phải tự
                // chèn vào DOM. Chọn 1 gợi ý xong phải gọi fetchFields() mới lấy được chi
                // tiết (formattedAddress/location/id) — API mới không trả sẵn như getPlace().
                const placeAutocomplete = new maps.places.PlaceAutocompleteElement({
                    includedRegionCodes: ['vn'],
                });
                placeAutocomplete.className = 'hotel-place-autocomplete';
                autocompleteContainerRef.current.appendChild(placeAutocomplete);
                placeAutocomplete.addEventListener('gmp-select', async ({ placePrediction }) => {
                    const place = placePrediction.toPlace();
                    await place.fetchFields({ fields: ['formattedAddress', 'location', 'id'] });
                    if (!place.location) return;
                    const lat = place.location.lat();
                    const lng = place.location.lng();

                    map.setCenter({ lat, lng });
                    map.setZoom(17);
                    marker.setPosition({ lat, lng });
                    setPosition({ lat, lng });
                    setAddress(place.formattedAddress ?? '');
                    setGooglePlaceId(place.id ?? null);
                });

                mapRef.current = map;
                markerRef.current = marker;
                setMapReady(true);
            })
            .catch((err) => {
                if (!cancelled) setMapsError(err.message);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    // Đưa marker/bản đồ về đúng vị trí đã lưu ngay khi cả bản đồ lẫn dữ liệu config đều
    // sẵn sàng (không cần biết cái nào xong trước — effect này tự chờ đủ cả 2). Phải có
    // mapReady trong dependency: nếu config tới trước lúc script Maps còn đang tải,
    // effect chạy sớm, thấy !mapRef.current rồi return mà KHÔNG set appliedConfigRef —
    // không có mapReady thì effect không bao giờ được kích hoạt lại lần nữa vì config
    // không đổi thêm nữa.
    useEffect(() => {
        if (appliedConfigRef.current || !config || !mapRef.current || !markerRef.current) return;

        const hasSavedLocation = config.latitude !== 0 || config.longitude !== 0;
        if (hasSavedLocation) {
            const center = { lat: config.latitude, lng: config.longitude };
            mapRef.current.setCenter(center);
            mapRef.current.setZoom(17);
            markerRef.current.setPosition(center);
            setPosition(center);
        }
        setAddress(config.address ?? '');
        setGooglePlaceId(config.googlePlaceId ?? null);
        appliedConfigRef.current = true;
    }, [config, mapReady]);

    // Nút/nhấn Enter để tìm theo đúng chữ đang gõ — bổ sung cho Autocomplete (chỉ chọn
    // được khi bấm vào 1 gợi ý trong dropdown, không có cách "tìm" chủ động bằng phím Enter).
    const handleSearchAddress = () => {
        if (!geocoderRef.current || !address.trim()) return;
        geocoderRef.current.geocode(
            { address: address.trim(), componentRestrictions: { country: 'vn' } },
            (results, status) => {
                if (status !== 'OK' || !results?.[0]) {
                    toast.error('Không tìm thấy địa chỉ này trên bản đồ');
                    return;
                }
                const result = results[0];
                const lat = result.geometry.location.lat();
                const lng = result.geometry.location.lng();

                mapRef.current?.setCenter({ lat, lng });
                mapRef.current?.setZoom(17);
                markerRef.current?.setPosition({ lat, lng });
                setPosition({ lat, lng });
                setAddress(result.formatted_address ?? address);
                setGooglePlaceId(result.place_id ?? null);
            },
        );
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
                googlePlaceId: googlePlaceId ?? undefined,
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
                <p className="text-sm text-gray-500">
                    Vị trí này là tâm để trợ lý AI gợi ý địa điểm ăn uống, vui chơi, tham quan gần
                    khách sạn cho khách.
                </p>

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
                                ref={addressInputRef}
                                type="text"
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleSearchAddress();
                                    }
                                }}
                                placeholder="Nhập địa chỉ rồi bấm Tìm, hoặc dùng ô gợi ý Google bên dưới..."
                                className="w-full rounded-lg border border-gray-200 py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={handleSearchAddress}
                            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
                        >
                            <Search size={16} /> Tìm
                        </button>
                    </div>
                    {/* PlaceAutocompleteElement (Google) tự chèn <input> gợi ý riêng của nó vào
                        đây lúc bản đồ khởi tạo xong — thay cho widget Autocomplete cũ đã bị
                        Google chặn ở project tạo sau 1/3/2025 (chỉ còn Places API (New)). */}
                    <p className="mb-1 mt-2 text-xs text-gray-400">Hoặc chọn nhanh từ gợi ý Google:</p>
                    <div ref={autocompleteContainerRef} className="[&_gmp-place-autocomplete]:w-full" />
                </div>

                <div
                    ref={mapContainerRef}
                    className="h-80 w-full rounded-lg border border-gray-200 bg-gray-50"
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
