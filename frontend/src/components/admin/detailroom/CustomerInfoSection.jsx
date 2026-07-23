import React, { useState, forwardRef, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { Search, Calendar, Users, ChevronLeft, ChevronRight, Filter, CheckCircle, Clock, Plus, Minus, ShieldCheck, Loader2, Receipt, PlusCircle, User as UserIcon } from 'lucide-react';
import roomAPI from '../../../services/room'; // Đảm bảo đường dẫn đúng
import BookingDetailModal from '../Model/BookingModalDetail'; // Đảm bảo đường dẫn đúng
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { useGetAllExtraServicesQuery } from '../../../services/extraService';
import { useCreateBookingMutation } from '../../../services/booking';
const ITEMS_PER_PAGE = 5;

const DateInput = forwardRef(({ value, onClick, placeholder }, ref) => (
  <div className="relative w-full">
    <input
      type="text" onClick={onClick} ref={ref} value={value}
      placeholder={placeholder} readOnly
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer bg-white"
    />
    <Calendar className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" size={16} />
  </div>
));

export default function CustomerInfoSection({ room }) {

  console.log('Received room prop in CustomerInfoSection:', room);


  const navigate = useNavigate();



  // --- STATE TÌM KIẾM TẠM THỜI (Khi người dùng đang gõ) ---
  const [searchInputCode, setSearchInputCode] = useState('');
  const [searchInputEmail, setSearchInputEmail] = useState('');
  const [searchInputName, setSearchInputName] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);

  // --- STATE TÌM KIẾM ĐÃ ÁP DỤNG (Chỉ cập nhật khi bấm "Tìm kiếm") ---
  const [appliedFilters, setAppliedFilters] = useState({
    bookingCode: '', email: '', guestName: '', startDate: null, endDate: null
  });

  // State phân trang & tab
  const [currentPage, setCurrentPage] = useState(1);
  const [filterStatus, setFilterStatus] = useState(() => {
    return room?.ui_status === 'AVAILABLE' ? 'CREATE_BOOKING' : 'ALL';
  });
  const [loading, setLoading] = useState(false);
  const [allBookings, setAllBookings] = useState([]);

  // State Modal 
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // Walk-in booking form states
  const [formGuestName, setFormGuestName] = useState('');
  const [formGuestPhone, setFormGuestPhone] = useState('');
  const [formGuestEmail, setFormGuestEmail] = useState('');
  const [formNote, setFormNote] = useState('');
  const [formCheckIn, setFormCheckIn] = useState(() => {
    return room?.filterCheckIn || sessionStorage.getItem('room_map_checkin') || new Date().toISOString().split('T')[0];
  });
  const [formCheckOut, setFormCheckOut] = useState(() => {
    if (room?.filterCheckOut) return room.filterCheckOut;
    if (sessionStorage.getItem('room_map_checkout')) return sessionStorage.getItem('room_map_checkout');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [selectedServices, setSelectedServices] = useState([]);

  // RTK Query hooks
  const { data: servicesResult, isLoading: isServicesLoading } = useGetAllExtraServicesQuery();
  const [createBooking, { isLoading: isBookingCreating }] = useCreateBookingMutation();

  // Auto-select CREATE_BOOKING if room status changes to AVAILABLE
  useEffect(() => {
    if (room?.ui_status === 'AVAILABLE') {
      setFilterStatus('CREATE_BOOKING');
    } else {
      setFilterStatus('ALL');
    }
    // Update dates from room filters when room changes
    if (room?.filterCheckIn) setFormCheckIn(room.filterCheckIn);
    if (room?.filterCheckOut) setFormCheckOut(room.filterCheckOut);
  }, [room]);

  // Synchronize walk-in dates to sessionStorage so they are reflected back on map page
  useEffect(() => {
    if (filterStatus === 'CREATE_BOOKING' && formCheckIn) {
      sessionStorage.setItem('room_map_checkin', formCheckIn);
    }
  }, [formCheckIn, filterStatus]);

  useEffect(() => {
    if (filterStatus === 'CREATE_BOOKING' && formCheckOut) {
      sessionStorage.setItem('room_map_checkout', formCheckOut);
    }
  }, [formCheckOut, filterStatus]);

  const handleServiceToggle = (service) => {
    setSelectedServices(prev => {
      const exists = prev.find(s => s.id === service.id);
      if (exists) {
        return prev.filter(s => s.id !== service.id);
      } else {
        return [...prev, { ...service, quantity: 1 }];
      }
    });
  };

  const updateServiceQuantity = (serviceId, delta) => {
    setSelectedServices(prev =>
      prev.map(s => {
        if (s.id === serviceId) {
          const newQty = Math.max(1, s.quantity + delta);
          return { ...s, quantity: newQty };
        }
        return s;
      })
    );
  };

  const getNights = () => {
    if (!formCheckIn || !formCheckOut) return 0;
    const start = new Date(formCheckIn);
    const end = new Date(formCheckOut);
    const diffTime = end - start;
    if (diffTime <= 0) return 0;
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const nights = getNights();
  const roomBasePrice = Number(room?.roomType?.base_price) || Number(room?.price) || 0;
  const roomTotal = roomBasePrice * nights;
  const servicesTotal = selectedServices.reduce((sum, s) => sum + (Number(s.base_price) * s.quantity || 0), 0);
  const subtotal = roomTotal + servicesTotal;
  const vat = subtotal * 0.08;
  const grandTotal = subtotal + vat;

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount).replace('₫', 'đ');
  };

  const handleCreateBooking = async (e) => {
    e.preventDefault();
    if (!formGuestName.trim()) {
      toast.warn("Vui lòng nhập họ tên khách hàng!");
      return;
    }
    if (!formGuestPhone.trim()) {
      toast.warn("Vui lòng nhập số điện thoại!");
      return;
    }
    if (nights <= 0) {
      toast.error("Ngày Check-out phải lớn hơn Ngày Check-in ít nhất 1 ngày!");
      return;
    }

    try {
      const payload = {
        check_in_date: formCheckIn,
        check_out_date: formCheckOut,
        rooms: [{ roomTypeId: room.roomType.id, quantity: 1, roomId: room.id }],
        guest_name: formGuestName,
        guest_phone: formGuestPhone,
        guest_email: formGuestEmail || undefined,
        extra_services: selectedServices.map(s => ({ service_id: s.id, quantity: s.quantity })),
        note: formNote || undefined,
        status: 'CHECKED_IN' // Direct immediate check-in!
      };

      await createBooking(payload).unwrap();
      toast.success("Tạo đơn đặt phòng và nhận phòng thành công!");

      // Reset form
      setFormGuestName('');
      setFormGuestPhone('');
      setFormGuestEmail('');
      setFormNote('');
      setSelectedServices([]);

      // Reload timeline and switch tab to current guest!
      setRefreshKey(prev => prev + 1);
      setFilterStatus('CURRENT');

      // Navigate back or refresh room status
      // We can let the parent refresh room state by setting a key or letting it reload
    } catch (err) {
      console.error("Booking error:", err);
      toast.error(err.data?.message || err.message || "Tạo đơn đặt phòng thất bại!");
    }
  };

  const servicesList = (servicesResult?.data || servicesResult || []).filter(service => 
    service.category !== 'Minibar' && 
    service.category !== 'Laundry' && 
    service.category !== 'Food & Beverage' && 
    service.category !== 'Spa & Wellness'
  );

  const renderCreateBookingForm = () => {
    return (
      <div className="p-6">
        <form onSubmit={handleCreateBooking} className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
          {/* Cột trái: Thông tin khách + Ngày ở + Dịch vụ */}
          <div className="lg:col-span-2 space-y-6">
            {/* Nhóm: Thông tin khách hàng */}
            <div className="bg-gray-50 p-5 rounded-xl border border-gray-150 space-y-4">
              <h4 className="font-bold text-gray-800 flex items-center gap-2 mb-2 text-sm uppercase tracking-wide">
                <UserIcon size={16} className="text-blue-500" /> Thông tin khách hàng
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Họ và tên khách <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="Nhập họ tên khách"
                    value={formGuestName}
                    onChange={(e) => setFormGuestName(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Số điện thoại <span className="text-red-500">*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="Nhập số điện thoại"
                    value={formGuestPhone}
                    onChange={(e) => setFormGuestPhone(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Email (Không bắt buộc)</label>
                <input
                  type="email"
                  placeholder="khachhang@gmail.com"
                  value={formGuestEmail}
                  onChange={(e) => setFormGuestEmail(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-600">Ghi chú đặt phòng</label>
                <textarea
                  placeholder="Ghi chú thêm (yêu cầu đặc biệt, giờ nhận phòng...)"
                  rows={2}
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white resize-none"
                />
              </div>
            </div>

            {/* Nhóm: Thời gian lưu trú */}
            <div className="bg-gray-50 p-5 rounded-xl border border-gray-150 space-y-4">
              <h4 className="font-bold text-gray-800 flex items-center gap-2 mb-2 text-sm uppercase tracking-wide">
                <Calendar size={16} className="text-blue-500" /> Thời gian lưu trú
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Ngày Check-in</label>
                  <input
                    type="date"
                    required
                    value={formCheckIn}
                    onChange={(e) => setFormCheckIn(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-gray-600">Ngày Check-out</label>
                  <input
                    type="date"
                    required
                    value={formCheckOut}
                    onChange={(e) => setFormCheckOut(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Nhóm: Dịch vụ bổ sung */}
            <div className="bg-gray-50 p-5 rounded-xl border border-gray-150 space-y-4">
              <h4 className="font-bold text-gray-800 flex items-center gap-2 mb-2 text-sm uppercase tracking-wide">
                <PlusCircle size={16} className="text-blue-500" /> Dịch vụ bổ sung (Tùy chọn)
              </h4>

              {isServicesLoading ? (
                <div className="text-sm text-gray-500 flex items-center gap-2 py-4">
                  <Loader2 size={16} className="animate-spin" /> Đang tải danh sách dịch vụ...
                </div>
              ) : servicesList.length === 0 ? (
                <p className="text-xs text-gray-500 py-2">Không có dịch vụ bổ sung nào khả dụng.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {servicesList.map((service) => {
                    const isSelected = selectedServices.some(s => s.id === service.id);
                    const selectedItem = selectedServices.find(s => s.id === service.id);
                    return (
                      <div
                        key={service.id}
                        className={`p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-3 ${isSelected ? 'bg-white border-blue-500 shadow-sm' : 'bg-white hover:bg-gray-100/50 border-gray-200'}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="font-bold text-gray-900 text-sm">{service.name}</p>
                            <p className="text-xs font-bold text-blue-600 mt-0.5">{formatCurrency(service.base_price)}</p>
                          </div>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleServiceToggle(service)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                          />
                        </div>
                        {isSelected && (
                          <div className="flex items-center justify-between border-t border-gray-100 pt-2.5 mt-1">
                            <span className="text-xs text-gray-500 font-medium">Số lượng:</span>
                            <div className="flex items-center gap-2 bg-gray-50 rounded-lg p-0.5 border border-gray-200">
                              <button
                                type="button"
                                onClick={() => updateServiceQuantity(service.id, -1)}
                                className="w-6 h-6 flex items-center justify-center bg-white border border-gray-200 rounded hover:bg-gray-100 text-gray-600 transition"
                              >
                                <Minus size={12} />
                              </button>
                              <span className="text-xs font-bold text-gray-800 w-6 text-center">{selectedItem.quantity}</span>
                              <button
                                type="button"
                                onClick={() => updateServiceQuantity(service.id, 1)}
                                className="w-6 h-6 flex items-center justify-center bg-white border border-gray-200 rounded hover:bg-gray-100 text-gray-600 transition"
                              >
                                <Plus size={12} />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Cột phải: Hóa đơn tạm tính & Hành động */}
          <div className="space-y-6">
            <div className="bg-gradient-to-br from-slate-50 to-slate-100/70 p-5 rounded-2xl border border-gray-200 shadow-sm space-y-5 sticky top-6">
              <h4 className="font-extrabold text-slate-800 flex items-center gap-2 border-b border-slate-200 pb-3 text-sm uppercase tracking-wider">
                <Receipt size={18} className="text-indigo-600" /> Hóa đơn tạm tính
              </h4>

              <div className="space-y-3.5 text-sm">
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1">
                    <p className="font-bold text-slate-800">Phòng {room?.room_number}</p>
                    <p className="text-xs text-slate-500 font-medium">{room?.roomType?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-slate-800">{formatCurrency(roomBasePrice)} / đêm</p>
                    <p className="text-xs text-slate-500 font-bold">{nights} đêm</p>
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-200 my-3"></div>

                <div className="flex justify-between font-medium text-slate-600">
                  <span>Tiền phòng ({nights} đêm):</span>
                  <span className="font-bold text-slate-800">{formatCurrency(roomTotal)}</span>
                </div>

                {selectedServices.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-slate-600 font-medium">
                      <span>Dịch vụ bổ sung:</span>
                      <span className="font-bold text-slate-800">{formatCurrency(servicesTotal)}</span>
                    </div>
                    <div className="bg-white/80 p-2.5 rounded-lg border border-slate-200 space-y-1 max-h-40 overflow-y-auto">
                      {selectedServices.map(s => (
                        <div key={s.id} className="flex justify-between text-xs text-slate-500">
                          <span>{s.name} (x{s.quantity})</span>
                          <span>{formatCurrency(s.base_price * s.quantity)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="border-t border-dashed border-slate-200 my-3"></div>

                <div className="flex justify-between text-slate-600 font-medium">
                  <span>Tạm tính (chưa VAT):</span>
                  <span className="font-bold text-slate-800">{formatCurrency(subtotal)}</span>
                </div>

                <div className="flex justify-between text-slate-600 font-medium">
                  <span>Thuế VAT (8%):</span>
                  <span className="font-bold text-slate-800">{formatCurrency(vat)}</span>
                </div>

                <div className="border-t-2 border-indigo-200 my-4 pt-4 flex justify-between items-baseline">
                  <span className="font-extrabold text-slate-800 text-base">Tổng cộng:</span>
                  <span className="font-black text-indigo-600 text-2xl tracking-tight">{formatCurrency(grandTotal)}</span>
                </div>
              </div>

              {/* <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3.5 flex gap-2.5">
                <ShieldCheck className="text-emerald-600 shrink-0 mt-0.5" size={18} />
                <div>
                  <h5 className="font-bold text-emerald-800 text-xs uppercase tracking-wide">Đặt phòng trực tiếp</h5>
                </div>
              </div> */}

              <button
                type="submit"
                disabled={isBookingCreating || nights <= 0}
                className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-indigo-200"
              >
                {isBookingCreating ? (
                  <>
                    <Loader2 size={16} className="animate-spin" /> Đang tạo đặt phòng...
                  </>
                ) : (
                  'Tạo đặt phòng & Nhận phòng'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    );
  };

  const handleViewDetail = (bookingData) => {
    setSelectedBooking(bookingData);
    setIsModalOpen(true);
  };

  const handleCheckIn = () => { setIsModalOpen(false); setRefreshKey(prev => prev + 1); };
  const handleCheckOut = () => { setIsModalOpen(false); setRefreshKey(prev => prev + 1); };

  const processTimelineData = (data) => {
    if (!data) return [];
    const processedList = [];

    if (data.current_booking) {
      processedList.push({ ...data.current_booking, display_type: 'CURRENT' });
    }
    if (Array.isArray(data.future_bookings)) {
      data.future_bookings.forEach(item => processedList.push({ ...item, display_type: 'FUTURE' }));
    }
    if (Array.isArray(data.past_bookings)) {
      data.past_bookings.forEach(item => processedList.push({ ...item, display_type: 'PAST' }));
    }
    return processedList;
  };

  useEffect(() => {
    const fetchRoomsTimeline = async () => {
      const roomIdToFetch = room?.id || 5;
      try {
        setLoading(true);
        const response = await roomAPI.getTimeLine(roomIdToFetch);
        const flatList = processTimelineData(response);
        setAllBookings(flatList);
      } catch (err) {
        console.error('Failed to fetch rooms timeline:', err);
        setAllBookings([]);
      } finally {
        setLoading(false);
      }
    };
    fetchRoomsTimeline();
  }, [room, refreshKey]);

  // --- HÀM XỬ LÝ NÚT TÌM KIẾM VÀ LÀM MỚI ---
  const handleSearch = () => {
    setAppliedFilters({
      bookingCode: searchInputCode,
      email: searchInputEmail,
      guestName: searchInputName,
      startDate: startDate,
      endDate: endDate
    });
    setCurrentPage(1); // Tìm kiếm xong thì quay về trang 1
  };

  const handleReset = () => {
    setSearchInputCode('');
    setSearchInputEmail('');
    setSearchInputName('');
    setStartDate(null);
    setEndDate(null);
    setAppliedFilters({ bookingCode: '', email: '', guestName: '', startDate: null, endDate: null });
    setFilterStatus('ALL');
    setCurrentPage(1);
  };

  // --- LỌC DỮ LIỆU KẾT HỢP ---
  const filteredData = allBookings.filter(item => {
    // 1. Lọc theo Tab (Đang ở, Đã trả...)
    if (filterStatus !== 'ALL' && item.display_type !== filterStatus) return false;

    // 2. Lọc theo text (Mã, Email, Tên) - So sánh không phân biệt hoa thường
    if (appliedFilters.bookingCode && !item.booking_code?.toLowerCase().includes(appliedFilters.bookingCode.toLowerCase())) return false;
    if (appliedFilters.email && !item.guest_email?.toLowerCase().includes(appliedFilters.email.toLowerCase())) return false;
    if (appliedFilters.guestName && !item.guest_name?.toLowerCase().includes(appliedFilters.guestName.toLowerCase())) return false;

    // 3. Lọc theo ngày (Bỏ qua giờ phút giây để so sánh ngày chính xác)
    if (appliedFilters.startDate) {
      const itemCheckIn = new Date(item.check_in);
      itemCheckIn.setHours(0, 0, 0, 0);
      const filterStart = new Date(appliedFilters.startDate);
      filterStart.setHours(0, 0, 0, 0);
      if (itemCheckIn < filterStart) return false;
    }

    if (appliedFilters.endDate) {
      const itemCheckOut = new Date(item.check_out);
      itemCheckOut.setHours(0, 0, 0, 0);
      const filterEnd = new Date(appliedFilters.endDate);
      filterEnd.setHours(0, 0, 0, 0);
      if (itemCheckOut > filterEnd) return false;
    }

    return true;
  });

  // --- PHÂN TRANG ---
  const totalItems = filteredData.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const indexOfLastItem = currentPage * ITEMS_PER_PAGE;
  const indexOfFirstItem = indexOfLastItem - ITEMS_PER_PAGE;
  const currentCustomers = filteredData.slice(indexOfFirstItem, indexOfLastItem);

  const handleFilterChange = (status) => {
    setFilterStatus(status);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  return (
    <div className="space-y-6">

      {/* FILTER BOX */}
      {filterStatus !== 'CREATE_BOOKING' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-fadeIn">
          <h3 className="flex items-center gap-2 font-bold text-lg text-gray-900 mb-6">
            <Search size={20} className="text-blue-600" /> Tìm kiếm đặt phòng
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">Mã đặt phòng</label>
              <input
                type="text" placeholder="VD: BK-1231"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                value={searchInputCode} onChange={(e) => setSearchInputCode(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">Email</label>
              <input
                type="email" placeholder="example@gmail.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                value={searchInputEmail} onChange={(e) => setSearchInputEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-500">Tên khách</label>
              <input
                type="text" placeholder="Tên khách..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-500"
                value={searchInputName} onChange={(e) => setSearchInputName(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
            <div className="space-y-1.5 w-full">
              <label className="text-xs font-semibold text-gray-500">Từ ngày (Check-in)</label>
              <DatePicker selected={startDate} onChange={setStartDate} customInput={<DateInput placeholder="Chọn ngày" />} dateFormat="dd/MM/yyyy" />
            </div>
            <div className="space-y-1.5 w-full">
              <label className="text-xs font-semibold text-gray-500">Đến ngày (Check-out)</label>
              <DatePicker selected={endDate} onChange={setEndDate} customInput={<DateInput placeholder="Chọn ngày" />} dateFormat="dd/MM/yyyy" />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSearch} className="flex-1 bg-blue-600 hover:bg-blue-700 transition text-white py-2 rounded-lg text-sm font-medium shadow-sm">
                Tìm kiếm
              </button>
              <button onClick={handleReset} className="flex-1 border border-gray-300 hover:bg-gray-50 transition text-gray-700 py-2 rounded-lg text-sm font-medium">
                Làm mới
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- TABLE BOX CỦA BẠN (GIỮ NGUYÊN) --- */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-5 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h3 className="flex items-center gap-2 font-bold text-lg text-gray-900">
              <Users size={20} className="text-blue-600" /> Thông tin khách hàng
            </h3>
            <span className="bg-gray-100 text-gray-600 text-xs font-bold px-2 py-1 rounded">
              {filterStatus === 'CREATE_BOOKING' ? 'Tạo mới' : `${totalItems} Đơn`}
            </span>
          </div>

          <div className="flex bg-gray-100 p-1 rounded-lg self-start sm:self-auto overflow-x-auto">
            {[
              { id: 'ALL', label: 'Tất cả' },
              { id: 'CURRENT', label: 'Đang ở' },
              { id: 'FUTURE', label: 'Lịch đặt' },
              { id: 'PAST', label: 'Đã trả' },
              { id: 'CREATE_BOOKING', label: 'Tạo đặt phòng' },
            ].map((tab) => {
              const isCreate = tab.id === 'CREATE_BOOKING';
              return (
                <button
                  key={tab.id} onClick={() => handleFilterChange(tab.id)}
                  className={`whitespace-nowrap px-3 py-1.5 rounded-md text-xs font-bold transition-all ${filterStatus === tab.id
                    ? isCreate
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'bg-white text-blue-600 shadow-sm'
                    : isCreate
                      ? 'text-indigo-600 hover:bg-indigo-50 font-extrabold'
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200'
                    }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {filterStatus === 'CREATE_BOOKING' ? (
          renderCreateBookingForm()
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider border-b border-gray-100">
                    <th className="p-4 font-semibold w-12">STT</th>
                    <th className="p-4 font-semibold">Mã đặt</th>
                    <th className="p-4 font-semibold">Khách hàng</th>
                    <th className="p-4 font-semibold">Liên hệ</th>
                    <th className="p-4 font-semibold">Thời gian lưu trú</th>
                    <th className="p-4 font-semibold text-center">Trạng thái</th>
                    <th className="p-4 font-semibold text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {loading ? (
                    <tr><td colSpan="7" className="p-8 text-center text-gray-500">Đang tải dữ liệu...</td></tr>
                  ) : currentCustomers.map((item, index) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors group">
                      <td className="p-4 text-gray-500 font-medium">{indexOfFirstItem + index + 1}</td>
                      <td className="p-4"><span className="font-mono font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded text-xs">{item.booking_code}</span></td>
                      <td className="p-4">
                        <p className="font-bold text-gray-900">{item.guest_name}</p>
                        <p className="text-xs text-gray-500">{item.guest_email || 'Chưa có email'}</p>
                      </td>
                      <td className="p-4 text-gray-600 font-medium">{item.guest_phone}</td>
                      <td className="p-4 text-gray-600">
                        <div className="flex items-center gap-1.5">
                          <Calendar size={14} className="text-gray-400" />
                          <span className="font-medium">{item.check_in ? new Date(item.check_in).toLocaleDateString('vi-VN') : 'N/A'}</span>
                          <span className="text-gray-400">→</span>
                          <span className="font-medium">{item.check_out ? new Date(item.check_out).toLocaleDateString('vi-VN') : 'N/A'}</span>
                        </div>
                      </td>
                      <td className="p-4 text-center">
                        {item.display_type === 'CURRENT' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><span className="w-1.5 h-1.5 mr-1.5 bg-green-600 rounded-full animate-pulse"></span> Đang ở</span>}
                        {item.display_type === 'FUTURE' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><Clock size={12} className="mr-1.5" /> Lịch đặt</span>}
                        {item.display_type === 'PAST' && <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"><CheckCircle size={12} className="mr-1.5" /> Đã trả</span>}
                      </td>
                      <td className="p-4 text-right">
                        {item.display_type === 'CURRENT' ? (
                          <button className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-3 py-1.5 rounded shadow-sm transition-all hover:shadow" onClick={() => handleViewDetail(item)}>Chi tiết</button>
                        ) : (
                          <button className="text-gray-400 text-xs font-semibold px-3 py-1.5 border border-gray-200 rounded hover:bg-gray-50" onClick={() => handleViewDetail(item)}>Xem lại</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {!loading && currentCustomers.length === 0 && (
                <div className="text-center py-12 flex flex-col items-center gap-3">
                  <div className="bg-gray-100 p-3 rounded-full"><Filter className="text-gray-400" size={24} /></div>
                  <p className="text-gray-500 text-sm">Không tìm thấy dữ liệu nào.</p>
                </div>
              )}
            </div>

            {totalItems > 0 && (
              <div className="p-4 border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between text-sm text-gray-500 gap-4">
                <span>Hiển thị {indexOfFirstItem + 1} đến {Math.min(indexOfLastItem, totalItems)} của {totalItems} kết quả</span>
                <div className="flex gap-1">
                  <button className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50" onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft size={16} /></button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button key={page} onClick={() => handlePageChange(page)} className={`w-8 h-8 rounded font-bold shadow-sm transition-colors ${currentPage === page ? 'bg-blue-600 text-white' : 'border border-gray-200 hover:bg-gray-50 text-gray-700'}`}>{page}</button>
                  ))}
                  <button className="w-8 h-8 flex items-center justify-center border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50" onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages}><ChevronRight size={16} /></button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <BookingDetailModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} booking={selectedBooking} onCheckIn={handleCheckIn} onCheckOut={handleCheckOut} room_number={room?.room_number} />
    </div>
  );
}