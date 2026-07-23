export const sampleRoomTypes = [
  {
    id: 1,
    roomTypeId: 1,
    name: "Deluxe Ocean View",
    description: "Phòng nghỉ rộng rãi với view biển và nội thất hiện đại.",
    base_price: 2500000,
    basePrice: 2500000,
    oldPrice: 2900000,
    capacity_people: 2,
    size_m2: 32,
    availableCount: 4,
    images: [
      {
        url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1200&auto=format&fit=crop",
      },
    ],
  },
  {
    id: 2,
    roomTypeId: 2,
    name: "Premier Family Suite",
    description: "Lựa chọn lý tưởng cho gia đình với không gian thoải mái.",
    base_price: 3800000,
    basePrice: 3800000,
    capacity_people: 4,
    size_m2: 48,
    availableCount: 2,
    tag: "Best seller",
    images: [
      {
        url: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?q=80&w=1200&auto=format&fit=crop",
      },
    ],
  },
  {
    id: 3,
    roomTypeId: 3,
    name: "Executive City View",
    description: "Phù hợp cho khách công tác, vị trí đẹp và tiện nghi đầy đủ.",
    base_price: 3100000,
    basePrice: 3100000,
    capacity_people: 2,
    size_m2: 35,
    availableCount: 3,
    discount: 10,
    images: [
      {
        url: "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?q=80&w=1200&auto=format&fit=crop",
      },
    ],
  },
];

export const sampleExtraServices = [
  { id: 1, name: "Breakfast", category: "Food & Beverage", base_price: 180000 },
  { id: 2, name: "Laundry", category: "Laundry", base_price: 120000 },
  { id: 3, name: "Airport Pickup", category: "Transport", base_price: 450000 },
  {
    id: 4,
    name: "Spa Package",
    category: "Spa & Wellness",
    base_price: 650000,
  },
];

export const sampleReviews = [
  {
    id: 1,
    rating: 5,
    comment: "Phòng sạch sẽ, nhân viên thân thiện.",
    author_name: "Minh Anh",
    created_at: "2026-07-01T08:30:00Z",
  },
  {
    id: 2,
    rating: 4,
    comment: "View đẹp, bữa sáng ổn.",
    author_name: "Huy",
    created_at: "2026-07-05T10:15:00Z",
  },
];

export const sampleFloors = [
  { id: 1, name: "Tầng 1" },
  { id: 2, name: "Tầng 2" },
  { id: 3, name: "Tầng 3" },
];

export const sampleBookings = [
  {
    id: 1,
    booking_code: "BK-1001",
    guest_name: "Nguyễn Văn A",
    guest_phone: "0900000001",
    guest_email: "a@example.com",
    check_in_date: "2026-07-23T00:00:00Z",
    check_out_date: "2026-07-25T00:00:00Z",
    total_price: 5000000,
    status: "COMPLETED",
    allocation_id: 11,
    booking_id: 1,
  },
  {
    id: 2,
    booking_code: "BK-1002",
    guest_name: "Trần Thị B",
    guest_phone: "0900000002",
    guest_email: "b@example.com",
    check_in_date: "2026-07-24T00:00:00Z",
    check_out_date: "2026-07-26T00:00:00Z",
    total_price: 6800000,
    status: "CONFIRMED",
    allocation_id: 12,
    booking_id: 2,
  },
];

export const sampleShiftSummary = {
  shift_info: {
    id: 1,
    status: "open",
    start_time: "2026-07-23T01:00:00Z",
    end_time: null,
    staff: {
      username: "admin",
      email: "admin@vika.local",
    },
  },
  revenue: {
    start_cash: 2000000,
    total_system_revenue: 15800000,
    expected_cash_in_drawer: 17800000,
  },
  activities: {
    total_bookings: sampleBookings.length,
    booking_list: sampleBookings,
  },
};

export const sampleShiftStats = {
  revenue: {
    expected_cash_in_drawer: 17800000,
  },
};

export const sampleShifts = [
  {
    id: 1,
    staff_name: "admin",
    start_time: "2026-07-23T01:00:00Z",
    end_time: null,
    initial_cash: 2000000,
    actual_cash_handover: null,
    note: "",
    status: "open",
  },
  {
    id: 2,
    staff_name: "thu ngan",
    start_time: "2026-07-22T01:00:00Z",
    end_time: "2026-07-22T12:30:00Z",
    initial_cash: 1500000,
    actual_cash_handover: 16450000,
    note: "Ca kết thúc đúng số liệu",
    status: "closed",
  },
];

export const sampleRoomTimeline = {
  current_booking: sampleBookings[0],
  future_bookings: [sampleBookings[1]],
  past_bookings: [],
};
