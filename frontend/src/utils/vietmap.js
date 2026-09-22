// Vietmap: nền bản đồ (SDK vietmap-gl-js + style.json) và các API tìm kiếm (Autocomplete /
// Place / Reverse). Thay hoàn toàn Google Maps ở trang Cài đặt vị trí khách sạn.
//
// 2 key TÁCH RIÊNG theo đúng cách Vietmap cấp:
//  - VITE_VIETMAP_TILEMAP_KEY: chỉ dùng cho style.json/tile (gọi Autocomplete bằng key này
//    sẽ bị 423 "Your request is limited").
//  - VITE_VIETMAP_SEARCH_KEY: Autocomplete / Place / Reverse.
// Cả tile lẫn API tìm kiếm đều mở CORS (Access-Control-Allow-Origin: *) nên gọi thẳng từ
// trình duyệt được, không cần proxy qua backend.
const API_BASE = 'https://maps.vietmap.vn/api';
const STYLE_URL = 'https://maps.vietmap.vn/maps/styles/tm/style.json';

// display_type=1: địa chỉ theo đơn vị hành chính mới (sau sáp nhập tỉnh/xã 2025).
const DISPLAY_TYPE = 1;

let vietmapGLPromise = null;

// Nạp SDK chính thức của Vietmap (@vietmap/vietmap-gl-js, bản fork MapLibre GL) + CSS theo
// kiểu dynamic import — thư viện khá nặng mà chỉ đúng 1 trang admin cần, không đưa vào
// bundle chính. Cache promise để StrictMode gọi 2 lần không nạp lặp; lỗi mạng thì xoá
// cache để lần sau thử lại được.
//
// BẮT BUỘC dùng SDK này, KHÔNG dùng maplibre-gl thuần: tile nền của Vietmap
// (maps/tiles/vlc-.../{z}/{x}/{y}.pbf) là định dạng riêng, không phải Mapbox Vector Tile
// chuẩn (byte đầu 0x01 thay vì 0x1a). maplibre-gl thuần tải được tile nhưng báo
// "Unable to parse the tile ... Unimplemented type" và chỉ vẽ nền trống. Đã kiểm chứng bằng
// Chrome headless: cùng style + cùng key, SDK Vietmap vẽ đủ đường phố/POI, MapLibre thì không.
// Import thẳng file dist vì package không khai báo "main"/"exports"; đây là bản UMD nên lấy
// export mặc định.
export function loadVietmapGL() {
  if (!vietmapGLPromise) {
    vietmapGLPromise = Promise.all([
      import('@vietmap/vietmap-gl-js/dist/vietmap-gl.js'),
      import('@vietmap/vietmap-gl-js/dist/vietmap-gl.css'),
    ])
      .then(([mod]) => mod.default ?? mod)
      .catch((err) => {
        vietmapGLPromise = null;
        throw err;
      });
  }
  return vietmapGLPromise;
}

export function getVietmapStyleUrl() {
  const key = import.meta.env.VITE_VIETMAP_TILEMAP_KEY;
  if (!key) throw new Error('Thiếu biến môi trường VITE_VIETMAP_TILEMAP_KEY');
  return `${STYLE_URL}?apikey=${key}`;
}

async function vietmapGet(path, params) {
  const key = import.meta.env.VITE_VIETMAP_SEARCH_KEY;
  if (!key) throw new Error('Thiếu biến môi trường VITE_VIETMAP_SEARCH_KEY');

  const url = new URL(`${API_BASE}/${path}`);
  Object.entries({ apikey: key, ...params }).forEach(([name, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(name, value);
  });

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Vietmap ${path} lỗi ${res.status}`);
  return res.json();
}

// Vietmap trả reverse dạng "197 Trần Phú Phường Chợ Quán,Thành phố Hồ Chí Minh" (dính dấu
// phẩy, thiếu dấu phẩy sau số nhà) — tự ghép name + address rồi chuẩn hoá dấu phẩy cho gọn.
function joinAddress(...parts) {
  return parts
    .filter(Boolean)
    .join(', ')
    .replace(/\s*,\s*/g, ', ');
}

// Gợi ý địa chỉ theo chữ đang gõ (tối thiểu 2 ký tự). focus = { lat, lng } để ưu tiên kết
// quả gần khu vực đó. Trả về [{ refId, name, address, display }] (tối đa 10 kết quả).
export async function searchAddress(text, focus) {
  const list = await vietmapGet('autocomplete/v4', {
    text,
    display_type: DISPLAY_TYPE,
    focus: focus ? `${focus.lat},${focus.lng}` : undefined,
  });
  if (!Array.isArray(list)) return [];
  return list.map((item) => ({
    refId: item.ref_id,
    name: item.name,
    address: item.address,
    display: item.display || joinAddress(item.name, item.address),
  }));
}

// Autocomplete chỉ trả ref_id — phải gọi Place mới có toạ độ chính xác.
export async function getPlaceDetail(refId) {
  const place = await vietmapGet('place/v4', { refid: refId });
  if (typeof place?.lat !== 'number' || typeof place?.lng !== 'number') {
    throw new Error('Vietmap place: không có toạ độ');
  }
  return { lat: place.lat, lng: place.lng, display: place.display };
}

// Toạ độ -> địa chỉ chữ. Trả null nếu Vietmap không có kết quả nào tại điểm đó.
export async function reverseGeocode(lat, lng) {
  const list = await vietmapGet('reverse/v4', { lat, lng, display_type: DISPLAY_TYPE });
  const first = Array.isArray(list) ? list[0] : null;
  if (!first) return null;
  return joinAddress(first.name, first.address) || first.display || null;
}
