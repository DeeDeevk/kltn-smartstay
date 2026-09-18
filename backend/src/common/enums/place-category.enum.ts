// Giá trị khớp đúng "type" mà Google Places API (New) chấp nhận trong includedTypes —
// không tự đặt tên khác rồi map qua lại, dùng thẳng làm value của enum.
export enum PlaceCategory {
  RESTAURANT = 'restaurant',
  TOURIST_ATTRACTION = 'tourist_attraction',
  CAFE = 'cafe',
  SHOPPING_MALL = 'shopping_mall',
  NIGHT_CLUB = 'night_club',
}
