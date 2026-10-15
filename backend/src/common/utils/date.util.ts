export function todayInHotelTz(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: process.env.HOTEL_TIMEZONE ?? 'Asia/Ho_Chi_Minh',
  }).format(new Date());
}
