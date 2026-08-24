import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { User, Phone, Mail, Banknote, CreditCard, CheckCircle2, Loader2, ArrowLeft, SearchX } from 'lucide-react'
import { useTranslation } from 'react-i18next'
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
import FilterSidebar from '../components/FilterSidebar'
import OrderSummaryCard from '../components/booking/OrderSummaryCard'
import ProfilePage from '../components/user/ProfilePage'
import BookingHistoryPage from '../components/user/BookingHistoryPage'
import PaymentSuccessPage from '../components/payment/PaymentSuccessPage'
import PaymentCancelPage from '../components/payment/PaymentCancelPage'
import UserManagementPage from '../components/admin/users/UserManagementPage'
import RoomTypeManagementPage from '../components/admin/roomTypes/RoomTypeManagementPage'
import AdminDashboardPage from '../components/admin/dashboard/AdminDashboardPage'
import DashboardLayout from '../components/admin/layout/DashboardLayout'
import { roomTypeApi } from '../services/roomType'
import { useCreateBookingMutation } from '../services/booking'
import { useCreatePayOSLinkMutation } from '../services/payment'
import { useAuth } from '../context/AuthContext'
import ProtectedRoute from './ProtectedRoute'
import ForbiddenPage from './ForbiddenPage'

const formatCurrency = (amount) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount).replace('₫', 'đ')

const paymentMethods = [
  { value: 'cash', labelKey: 'checkout.paymentCash', icon: Banknote },
  { value: 'online', labelKey: 'checkout.paymentOnline', icon: CreditCard },
]

// React Router doesn't reset scroll position on navigation by default, so
// clicking a link while scrolled down leaves the next page scrolled down too.
function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0)
      return
    }

    // Wait a frame so the target page/section has rendered before scrolling to it.
    const id = requestAnimationFrame(() => {
      const el = document.getElementById(hash.slice(1))
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        window.scrollTo(0, 0)
      }
    })

    return () => cancelAnimationFrame(id)
  }, [pathname, hash])

  return null
}

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
  const { t } = useTranslation()

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-gray-50">
      <AuthHero />
      <div className="flex flex-col">
        <button
          onClick={() => navigate('/')}
          className="lg:hidden inline-flex items-center gap-1.5 px-6 pt-6 text-sm font-semibold text-gray-500 hover:text-blue-600 transition-colors w-fit"
        >
          <ArrowLeft size={16} /> {t('checkout.success.backHome')}
        </button>
        <div className="flex flex-1 items-center justify-center py-8 lg:py-12">
          {mode === 'login' ? <LoginForm /> : <RegisterForm />}
        </div>
      </div>
    </div>
  )
}

const MAX_PRICE = 10000000

const SORT_OPTIONS = [
  { value: 'recommended', labelKey: 'search.sort.recommended' },
  { value: 'price-asc', labelKey: 'search.sort.priceAsc' },
  { value: 'price-desc', labelKey: 'search.sort.priceDesc' },
]

function SearchResultsPage() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const { data: roomTypesResponse, isLoading } = roomTypeApi.useGetAllRoomTypesQuery()
  const rooms = location.state?.results || roomTypesResponse?.data || []
  const searchParams = location.state?.searchParams

  const [filters, setFilters] = useState({ price: MAX_PRICE, roomTypes: [], amenities: [], rating: 0 })
  const [sortBy, setSortBy] = useState('recommended')

  const availableRoomTypes = useMemo(
    () => [...new Set(rooms.map((room) => room.name))],
    [rooms],
  )

  const visibleRooms = useMemo(() => {
    const filtered = rooms.filter((room) => {
      const price = room.basePrice ?? room.base_price ?? 0
      if (price > filters.price) return false
      if (filters.roomTypes.length > 0 && !filters.roomTypes.includes(room.name)) return false
      return true
    })

    if (sortBy === 'price-asc') {
      return [...filtered].sort((a, b) => (a.basePrice ?? a.base_price ?? 0) - (b.basePrice ?? b.base_price ?? 0))
    }
    if (sortBy === 'price-desc') {
      return [...filtered].sort((a, b) => (b.basePrice ?? b.base_price ?? 0) - (a.basePrice ?? a.base_price ?? 0))
    }
    return filtered
  }, [rooms, filters, sortBy])

  const handleFilterChange = (patch) => setFilters((prev) => ({ ...prev, ...patch }))
  const handleResetFilters = () => setFilters({ price: MAX_PRICE, roomTypes: [], amenities: [], rating: 0 })

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-gray-600">
            {!isLoading && (
              <>
                {t('search.resultsFound')} <span className="font-bold text-gray-900">{visibleRooms.length}</span> {t('search.roomsMatch')}
                {searchParams && (
                  <>
                    {' '}{t('search.from')} <span className="font-semibold text-gray-900">{new Date(searchParams.checkIn).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'vi-VN')}</span>
                    {' '}{t('search.to')} <span className="font-semibold text-gray-900">{new Date(searchParams.checkOut).toLocaleDateString(i18n.language === 'en' ? 'en-US' : 'vi-VN')}</span>
                  </>
                )}
              </>
            )}
          </p>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            {t('search.sort.label')}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <FilterSidebar
            filters={filters}
            onFilterChange={handleFilterChange}
            onReset={handleResetFilters}
            availableRoomTypes={availableRoomTypes}
          />

          <div>
            {isLoading && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-96 rounded-xl border border-gray-200 bg-white overflow-hidden animate-pulse">
                    <div className="h-48 bg-gray-200" />
                    <div className="p-4 space-y-3">
                      <div className="h-4 w-1/3 bg-gray-200 rounded" />
                      <div className="h-5 w-2/3 bg-gray-200 rounded" />
                      <div className="h-4 w-1/2 bg-gray-200 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && visibleRooms.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white py-20 text-center">
                <div className="w-14 h-14 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center mb-4">
                  <SearchX size={26} />
                </div>
                <h3 className="text-lg font-bold text-gray-900">{t('search.emptyTitle')}</h3>
                <p className="text-gray-500 mt-1 mb-5 max-w-sm">{t('search.emptyText')}</p>
                <button
                  onClick={handleResetFilters}
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 text-sm transition-colors"
                >
                  {t('search.resetFilters')}
                </button>
              </div>
            )}

            {!isLoading && visibleRooms.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {visibleRooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    startDate={searchParams ? new Date(searchParams.checkIn) : undefined}
                    endDate={searchParams ? new Date(searchParams.checkOut) : undefined}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

function RoomDetailPage() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const { data: room, isLoading, isError } = roomTypeApi.useGetRoomTypeByIdQuery(id, { skip: !id })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-blue-600" size={32} />
      </div>
    )
  }

  if (isError || !room) {
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
  const { t, i18n } = useTranslation()
  const dateLocale = i18n.language === 'en' ? 'en-US' : 'vi-VN'

  const bookingCode = booking.bookingId.slice(0, 8).toUpperCase()

  const qrValue = [
    'VIKA HOTEL - BOOKING TICKET',
    `Ma: ${bookingCode}`,
    `Khach: ${booking.guestInfo?.fullName ?? ''}`,
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
        <h1 className="text-2xl font-bold text-gray-900">{t('checkout.success.title')}</h1>
        <p className="text-gray-500 mt-2">
          {t('checkout.success.thankYou')}{' '}
          <span className="font-mono font-bold text-blue-600">{bookingCode}</span>
        </p>
      </div>

      <div className="flex justify-center py-2">
        <QRCodeSVG value={qrValue} size={160} level="M" />
      </div>

      <div className="bg-gray-50 rounded-xl p-4 text-left text-sm space-y-2">
        <div className="flex justify-between">
          <span className="text-gray-500">{t('checkout.success.room')}</span>
          <span className="font-semibold text-gray-800">{room.name}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">{t('checkout.success.checkInOut')}</span>
          <span className="font-semibold text-gray-800">
            {new Date(startDate).toLocaleDateString(dateLocale)} - {new Date(endDate).toLocaleDateString(dateLocale)}
          </span>
        </div>
        <div className="flex justify-between pt-2 border-t border-gray-200">
          <span className="font-bold text-gray-900">{t('checkout.success.total')}</span>
          <span className="font-bold text-blue-600">{formatCurrency(totalPrice)}</span>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => navigate('/')}
          className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-colors"
        >
          {t('checkout.success.backHome')}
        </button>
        <button
          onClick={() => navigate('/user/historybooking')}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors"
        >
          {t('checkout.success.bookingHistory')}
        </button>
      </div>
    </div>
  )
}

function CheckoutPage() {
  const { t } = useTranslation()
  const location = useLocation()
  const { user } = useAuth()
  const checkoutState = location.state

  const [guestInfo, setGuestInfo] = useState({
    name: user?.name || '',
    phone: user?.phone || '',
    email: user?.email || '',
  })
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [errors, setErrors] = useState({})
  const [paidBooking, setPaidBooking] = useState(null)

  const [createBooking, { isLoading: isCreating }] = useCreateBookingMutation()
  const [createPayOSLink, { isLoading: isRedirecting }] = useCreatePayOSLinkMutation()
  const isLoading = isCreating || isRedirecting

  if (!checkoutState?.room) {
    return <Navigate to="/" replace />
  }

  const { room, startDate, endDate, nights, totalPrice } = checkoutState

  const handleChange = (field) => (e) => {
    setGuestInfo((prev) => ({ ...prev, [field]: e.target.value }))
  }

  const validate = () => {
    const nextErrors = {}
    if (!guestInfo.name.trim()) nextErrors.name = t('checkout.errors.nameRequired')
    if (!/^[0-9]{9,11}$/.test(guestInfo.phone.trim())) nextErrors.phone = t('checkout.errors.invalidPhone')
    if (!/^\S+@\S+\.\S+$/.test(guestInfo.email.trim())) nextErrors.email = t('checkout.errors.invalidEmail')
    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!validate()) return

    try {
      const booking = await createBooking({
        roomTypeId: room.roomTypeId || room.id,
        checkIn: startDate,
        checkOut: endDate,
        guestInfo: {
          fullName: guestInfo.name.trim(),
          phone: guestInfo.phone.trim(),
          email: guestInfo.email.trim(),
        },
        paymentMethod: paymentMethod === 'online' ? 'PAYOS' : 'CASH',
      }).unwrap()

      if (paymentMethod === 'online') {
        const { checkoutUrl } = await createPayOSLink(booking.bookingId).unwrap()
        window.location.href = checkoutUrl
        return
      }

      setPaidBooking(booking)
    } catch (err) {
      toast.error(err?.data?.message || t('checkout.errors.bookingFailed'))
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        {paidBooking ? (
          <BookingSuccess
            booking={paidBooking}
            room={room}
            startDate={startDate}
            endDate={endDate}
            totalPrice={totalPrice}
          />
        ) : (
          <>
            <h1 className="text-3xl font-bold text-gray-900 mb-8">{t('checkout.title')}</h1>
            <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4">
                  <h2 className="font-bold text-lg text-gray-900">{t('checkout.customerInfo')}</h2>

                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                      <User size={14} /> {t('checkout.fullName')}
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
                        <Phone size={14} /> {t('checkout.phone')}
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
                        <Mail size={14} /> {t('checkout.email')}
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
                  <h2 className="font-bold text-lg text-gray-900 mb-1">{t('checkout.paymentMethod')}</h2>
                  {paymentMethods.map(({ value, labelKey, icon: Icon }) => (
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
                      <span className="text-sm font-medium text-gray-800">{t(labelKey)}</span>
                    </label>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {isLoading && <Loader2 size={18} className="animate-spin" />}
                  {isLoading ? t('checkout.processing') : t('checkout.confirmBooking')}
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

export default function AppRoutes() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/searchrooms" element={<SearchResultsPage />} />
        <Route path="/rooms/:id" element={<RoomDetailPage />} />
        <Route
          path="/user/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/user/historybooking"
          element={
            <ProtectedRoute>
              <BookingHistoryPage />
            </ProtectedRoute>
          }
        />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route
          path="/payment/success"
          element={
            <ProtectedRoute>
              <PaymentSuccessPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/payment/cancel"
          element={
            <ProtectedRoute>
              <PaymentCancelPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route path="room-types" element={<RoomTypeManagementPage />} />
          <Route path="accounts" element={<UserManagementPage />} />
        </Route>
        <Route
          path="/admin/checkout"
          element={
            <ProtectedRoute roles={['ADMIN']}>
              <CheckoutPage />
            </ProtectedRoute>
          }
        />
        <Route path="/403" element={<ForbiddenPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
