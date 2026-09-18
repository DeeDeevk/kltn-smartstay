// Nạp Google Maps JS API kiểu "dynamic library import" (google.maps.importLibrary) —
// BẮT BUỘC phải dùng cách này (không phải chỉ thêm "loading=async" vào URL script cổ
// điển — đã thử và lỗi "importLibrary is not a function") để dùng được
// PlaceAutocompleteElement: widget Autocomplete cũ (google.maps.places.Autocomplete)
// dựa trên "Places API (Legacy)" — dự án Google Cloud tạo sau 1/3/2025 không cho bật
// API Legacy đó nữa (chỉ có "Places API (New)"), nên bắt buộc phải dùng class mới cho
// riêng phần gợi ý địa chỉ. google.maps.Marker (đánh dấu vị trí trên bản đồ) không
// liên quan gì tới Places API — vẫn dùng bản cổ điển bình thường, không bị chặn.
//
// Đoạn bootstrap dưới đây copy NGUYÊN VĂN từ tài liệu chính thức của Google
// (https://developers.google.com/maps/documentation/javascript/load-maps-js-api),
// chỉ thay "key"/"v" — không tự viết lại/rút gọn để tránh lệch hành vi so với bản gốc.
function bootstrapGoogleMapsLoader(g) {
  let h, a, k;
  const p = 'The Google Maps JavaScript API';
  const c = 'google';
  const l = 'importLibrary';
  const q = '__ib__';
  const m = document;
  let b = window;
  b = b[c] || (b[c] = {});
  const d = b.maps || (b.maps = {});
  const r = new Set();
  const e = new URLSearchParams();
  const u = () =>
    h ||
    (h = new Promise(async (f, n) => {
      await (a = m.createElement('script'));
      e.set('libraries', [...r] + '');
      for (k in g) e.set(k.replace(/[A-Z]/g, (t) => '_' + t[0].toLowerCase()), g[k]);
      e.set('callback', c + '.maps.' + q);
      a.src = `https://maps.${c}apis.com/maps/api/js?` + e;
      d[q] = f;
      a.onerror = () => (h = n(Error(p + ' could not load.')));
      a.nonce = m.querySelector('script[nonce]')?.nonce || '';
      m.head.append(a);
    }));
  d[l] ? console.warn(p + ' only loads once. Ignoring:', g) : (d[l] = (f, ...n) => r.add(f) && u().then(() => d[l](f, ...n)));
}

let loadPromise = null;

export default function loadGoogleMaps() {
  if (loadPromise) return loadPromise;

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return Promise.reject(
      new Error('Thiếu biến môi trường VITE_GOOGLE_MAPS_API_KEY'),
    );
  }

  // Đã dựng sẵn importLibrary từ 1 lần mount trước đó (StrictMode render 2 lần, chuyển
  // trang qua lại...) -> dùng luôn, khỏi chạy lại bootstrap (log "only loads once").
  if (!window.google?.maps?.importLibrary) {
    bootstrapGoogleMapsLoader({ key: apiKey, v: 'weekly' });
  }

  loadPromise = (async () => {
    // Mỗi thư viện nạp xong sẽ tự gắn class của nó vào đúng chỗ trong google.maps (VD
    // google.maps.places.PlaceAutocompleteElement) — gọi importLibrary xong rồi trả
    // thẳng google.maps ra cho nơi gọi dùng, khỏi phải tự ráp lại từng object.
    await Promise.all([
      window.google.maps.importLibrary('maps'),
      window.google.maps.importLibrary('places'),
      window.google.maps.importLibrary('geocoding'),
    ]);
    return window.google.maps;
  })();

  return loadPromise;
}
