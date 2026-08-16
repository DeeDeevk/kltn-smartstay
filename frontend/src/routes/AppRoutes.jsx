import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMemo, useState } from 'react'
import { User, Phone, Mail, Banknote, CreditCard, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'react-toastify'
import Header from '../components/layout/Header'
import Footer from '../components/layout/Footer'
import HeroSection from '../components/homepage/HeroSection'
import FeaturedRooms from '../components/homepage/FeaturedRooms'
import PromoSection from '../components/homepage/PromoSection'
import AuthHero from '../components/admin/auth/AuthHero'
import LoginForm from '../components/admin/auth/LoginForm'
import RegisterForm from '../components/admin/auth/RegisterForm'
import GeneralInfoRoom from '../components/room/GeneralInfoRoom'
import RoomGallery from '../components/room/RoomGallery'
import RoomInfo from '../components/room/RoomInfo'
import RoomAmenities from '../components/room/RoomAmenities'
import BookingCard from '../components/room/BookingCard'
import RoomReviews from '../components/room/RoomReviews'
import RoomCard from '../components/searchroom/RoomCard'
import OrderSummaryCard from '../components/booking/OrderSummaryCard'
import ProfilePage from '../components/user/ProfilePage'
import { roomTypeApi } from '../services/roomType'
import { useCreateBookingMutation } from '../services/booking'
import { useAuth } from '../context/AuthContext'
import AdminRoute from '../components/admin/routesadmin/AdminRoute'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount).replace('₫', 'đ')

const paymentMethods = [
  { value: 'cash', label: 'Thanh toán khi nhận phòng', icon: Banknote },
  { value: 'online', label: 'Thanh toán online (PayOS)', icon: CreditCard },
]

function HomePage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main>
        <HeroSection />
        <FeaturedRooms />
        <PromoSection />
      </main>
      <Footer />
    </div>
  )
}

function AuthPage({ mode }) {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-gray-50">
      <AuthHero />
      <div className="flex flex-col">
        <button
          onClick={() => navigate('/')}
          className="lg:hidden inline-flex items-center gap-1.5 px-6 pt-6 text-sm font-semibold text-gray-500 hover:text-blue-600 transition-colors w-fit"
        >
          <ArrowLeft size={16} /> Về trang chủ
        </button>
        <div className="flex flex-1 items-center justify-center py-8 lg:py-12">
          {mode === 'login' ? <LoginForm /> : <RegisterForm />}
        </div>
      </div>
    </div>
  )
}

function SearchResultsPage() {
  const location = useLocation()
  const { data: roomTypesResponse } = roomTypeApi.useGetAllRoomTypesQuery()
  const rooms = location.state?.results || roomTypesResponse?.data || []
  const searchParams = location.state?.searchParams

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Kết quả tìm kiếm</h1>
          <p className="text-gray-500 mt-2">
            {searchParams
              ? `Từ ${new Date(searchParams.checkIn).toLocaleDateString('vi-VN')} đến ${new Date(searchParams.checkOut).toLocaleDateString('vi-VN')}`
              : 'Danh sách phòng hiện có'}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {rooms.map((room) => (
            <RoomCard
              key={room.id}
              room={room}
              startDate={searchParams ? new Date(searchParams.checkIn) : undefined}
              endDate={searchParams ? new Date(searchParams.checkOut) : undefined}
            />
          ))}
        </div>
      </main>
      <Footer />
    </div>
  )
}

function RoomDetailPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { data: roomTypesResponse } = roomTypeApi.useGetAllRoomTypesQuery()
  const room = useMemo(() => {
    const rooms = roomTypesResponse?.data || []
    return rooms.find((item) => String(item.id) === String(id)) || rooms[0]
  }, [id, roomTypesResponse])

  if (!room) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16 space-y-6">
        <GeneralInfoRoom room={room} />
        <RoomGallery images={room.images} roomName={room.name} />

        <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
          <section className="space-y-6">
            <RoomInfo description={room.description} />
            <RoomAmenities amenities={room.amenities} />
            <RoomReviews />
          </section>
          <aside className="lg:sticky lg:top-24 h-fit">
            <BookingCard
              room={room}
              initialCheckIn={searchParams.get('checkIn')}
              initialCheckOut={searchParams.get('checkOut')}
            />
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function BookingSuccess({ booking, room, startDate, endDate, totalPrice }) {
  const navigate = useNavigate()

  const qrValue = [
    'VIKA HOTEL - BOOKING TICKET',
    `Ma: ${booking.booking_code}`,
    `Khach: ${booking.guest_name}`,
    `Phong: ${room.name}`,
    `Thoi gian: ${new Date(startDate).toLocaleDateString('vi-VN')} -> ${new Date(endDate).toLocaleDateString('vi-VN')}`,
    `Tong tien: ${formatCurrency(totalPrice)}`,
  ].join('\n')

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-lg mx-auto text-center space-y-6">
      <div className="w-16 h-16 rounded-full bg-green-50 text-green-600 flex items-center justify-center mx-auto">
        <CheckCircle2 size={32} />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Đặt phòng thành công!</h1>
        <p className="text-gray-500 mt-2">
          Cảm ơn bạn đã đặt phòng tại Vika Hotel. Mã đặt phòng của bạn là{' '}
          <span className="font-mono font-bold text-blue-600">{booking.booking_code}</span>
        </p>
      </div>

      <div className="flex justify-center py-2">
        <QRCodeSVG value={qrValue} size={160} level="M" />
      </div>

      <div className="bg-gray-50 rounded-xl p-4 text-left text-sm space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-500">Phòng</span>
          <span className="font-semibold text-gray-800">{room.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Nhận / Trả phòng</span>
          <span className="font-semibold text-gray-800">
            {new Date(startDate).toLocaleDateString('vi-VN')} - {new Date(endDate).toLocaleDateString('vi-VN')}
          </span>
        </div>
        <div className="flex justify-between pt-2 border-t border-gray-200">
          <span className="font-bold text-gray-900">Tổng cộng</span>
          <span className="font-bold text-blue-600">{formatCurrency(totalPrice)}</span>
        </div>
      </div>

      <button
        onClick={() => navigate('/')}
        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors"
      >
        Về trang chủ
      </button>
    </div>
  )
}

function CheckoutPage() {
  const location = useLocation()
  const { user } = useAuth()
  const checkoutState = location.state

  const [guestInfo, setGuestInfo] = useState({
    name: user?.username || '',
    phone: '',
    email: '',
  })
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [errors, setErrors] = useState({})

  const [createBooking, { isLoading, data: bookingResult }] = useCreateBookingMutation()

  if (!checkoutState?.room) {
    return <Navigate to="/" replace />
  }

  const { room, startDate, endDate, nights, totalPrice } = checkoutState

  const handleChange = (field) => (e) => {
    setGuestInfo((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const validate = () => {
    const nextErrors = {}
    if (!guestInfo.name.trim()) nextErrors.name = 'Vui lòng nhập họ tên'
    if (!/^[0-9]{9,11}$/.test(guestInfo.phone.trim())) nextErrors.phone = 'Số điện thoại không hợp lệ'
    if (!/^\S+@\S+\.\S+$/.test(guestInfo.email.trim())) nextErrors.email = 'Email không hợp lệ'
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    try {
      await createBooking({
        room_type_id: room.roomTypeId || room.id,
        guest_name: guestInfo.name.trim(),
        guest_phone: guestInfo.phone.trim(),
        guest_email: guestInfo.email.trim(),
        check_in_date: startDate,
        check_out_date: endDate,
        total_price: totalPrice,
        payment_method: paymentMethod,
      }).unwrap()
    } catch (err) {
      toast.error(err?.data?.message || 'Không thể tạo đặt phòng. Vui lòng thử lại.')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        {bookingResult?.data ? (
          <BookingSuccess
            booking={bookingResult.data}
            room={room}
            startDate={startDate}
            endDate={endDate}
            totalPrice={totalPrice}
          />
        ) : (
          <>
            <h1 className="text-3xl font-bold text-gray-900 mb-8">Xác nhận đặt phòng</h1>
            <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
                  <h2 className="font-bold text-lg text-gray-900">Thông tin khách hàng</h2>

                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                      <User size={14} /> Họ và tên
                    </label>
                    <input
                      type="text"
                      value={guestInfo.name}
                      onChange={handleChange('name')}
                      placeholder="Nguyễn Văn A"
                      className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.name ? 'border-red-300' : 'border-gray-200'}`}
                    />
                    {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
                  </div>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                        <Phone size={14} /> Số điện thoại
                      </label>
                      <input
                        type="tel"
                        value={guestInfo.phone}
                        onChange={handleChange('phone')}
                        placeholder="09xxxxxxxx"
                        className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.phone ? 'border-red-300' : 'border-gray-200'}`}
                      />
                      {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
                    </div>
                    <div>
                      <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                        <Mail size={14} /> Email
                      </label>
                      <input
                        type="email"
                        value={guestInfo.email}
                        onChange={handleChange('email')}
                        placeholder="ban@email.com"
                        className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${errors.email ? 'border-red-300' : 'border-gray-200'}`}
                      />
                      {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-3">
                  <h2 className="font-bold text-lg text-gray-900 mb-1">Phương thức thanh toán</h2>
                  {paymentMethods.map(({ value, label, icon: Icon }) => (
                    <label
                      key={value}
                      className={`flex items-center gap-3 border rounded-lg px-4 py-3 cursor-pointer transition-colors ${paymentMethod === value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}
                    >
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={value}
                        checked={paymentMethod === value}
                        onChange={() => setPaymentMethod(value)}
                        className="accent-blue-600"
                      />
                      <Icon size={18} className="text-gray-500" />
                      <span className="text-sm font-medium text-gray-800">{label}</span>
                    </label>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading && <Loader2 size={18} className="animate-spin" />}
                  {isLoading ? 'Đang xử lý...' : 'Xác nhận đặt phòng'}
                </button>
              </form>

              <aside className="lg:sticky lg:top-24 h-fit">
                <OrderSummaryCard room={room} startDate={startDate} endDate={endDate} nights={nights} totalPrice={totalPrice} />
              </aside>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  )
}

function AdminHome() {
  return (
    <AdminRoute>
      <div className="min-h-screen bg-gray-50 p-10">
        <div className="max-w-4xl mx-auto bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Khu quản trị Vika Hotel</h1>
          <p className="text-gray-600">
            Ứng dụng đã khởi động. Các module quản trị sẽ hiển thị dữ liệu mẫu cho đến khi backend được kết nối.
          </p>
        </div>
      </div>
    </AdminRoute>
  )
}

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/searchrooms" element={<SearchResultsPage />} />
        <Route path="/rooms/:id" element={<RoomDetailPage />} />
        <Route path="/user/profile" element={<ProfilePage />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/admin" element={<AdminHome />} />
        <Route path="/admin/checkout" element={<CheckoutPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
