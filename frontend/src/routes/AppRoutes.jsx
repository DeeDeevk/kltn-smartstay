import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { User, Phone, Mail, Banknote, CreditCard, CheckCircle2, Loader2, ArrowLeft, SearchX, Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { QRCodeSVG } from 'qrcode.react'
import { toast } from 'react-toastify'
import Header from '../components/layout/Header'
import Footer from '../components/layout/Footer'
import Chatbot from '../components/Chatbot'
import HeroSection from '../components/homepage/HeroSection'
import FeaturedRooms from '../components/homepage/FeaturedRooms'
import TestimonialsSection from '../components/homepage/TestimonialsSection'
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
import StaffManagementPage from '../components/admin/users/StaffManagementPage'
import ShiftSchedulePage from '../components/admin/shifts/ShiftSchedulePage'
import MySchedulePage from '../components/admin/shifts/MySchedulePage'
import RevenueSummaryPage from '../components/admin/revenue/RevenueSummaryPage'
import RevenueByStaffPage from '../components/admin/revenue/RevenueByStaffPage'
import RoomTypeManagementPage from '../components/admin/roomTypes/RoomTypeManagementPage'
import RoomMapPage from '../components/admin/roomMap/RoomMapPage'
import AdminRoomDetailPage from '../components/admin/roomMap/AdminRoomDetailPage'
import AdminCheckoutPage from '../components/admin/roomMap/AdminCheckoutPage'
import BookingManagementPage from '../components/admin/bookings/BookingManagementPage'
import StaffChatPage from '../components/admin/chat/StaffChatPage'
import AdminDashboardPage from '../components/admin/dashboard/AdminDashboardPage'
import DashboardLayout from '../components/admin/layout/DashboardLayout'
import { roomTypeApi } from '../services/roomType'
import { useLazySearchAvailabilityQuery } from '../services/availability'
import { useCreateBookingMutation } from '../services/booking'
import { useCreatePayOSLinkMutation, useSyncPayOSStatusQuery } from '../services/payment'
import { useAuth } from '../context/AuthContext'
import ProtectedRoute from './ProtectedRoute'
import ForbiddenPage from './ForbiddenPage'
import formatCurrency from '../utils/formatCurrency'
import getBookingCode from '../utils/bookingCode'
import getBookingQrPayload from '../utils/bookingQrPayload'
import downloadQrPng from '../utils/downloadQr'

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
        <TestimonialsSection />
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

const DEFAULT_PRICE_FILTERS = { priceMin: 0, priceMax: MAX_PRICE, roomTypes: [] }

// Dùng khi vào /searchrooms trực tiếp (menu "Phòng nghỉ", "Xem tất cả phòng"...)
// mà không có searchParams từ HeroSection: mặc định 1 khách, nhận phòng ngày mai.
function getDefaultSearchParams() {
  const checkIn = new Date()
  checkIn.setDate(checkIn.getDate() + 1)
  const checkOut = new Date(checkIn)
  checkOut.setDate(checkOut.getDate() + 1)
  return { checkIn: checkIn.toISOString(), checkOut: checkOut.toISOString(), capacity: 1 }
}

function SearchResultsPage() {
  const { t, i18n } = useTranslation()
  const location = useLocation()
  const [triggerSearch, { isFetching: isSearching }] = useLazySearchAvailabilityQuery()

  const [searchParams, setSearchParams] = useState(() => location.state?.searchParams ?? getDefaultSearchParams())
  // Nếu đến từ HeroSection thì đã có kết quả sẵn (location.state.results), khỏi gọi lại API lần nữa.
  const [rooms, setRooms] = useState(location.state?.results ?? [])
  const [priceFilters, setPriceFilters] = useState(DEFAULT_PRICE_FILTERS)
  const [sortBy, setSortBy] = useState('recommended')

  const runSearch = useCallback(async (params) => {
    try {
      const result = await triggerSearch({
        checkIn: params.checkIn,
        checkOut: params.checkOut,
        guests: params.capacity,
      }).unwrap()
      setRooms(result.availableRoomTypes)
    } catch (error) {
      toast.error(error?.data?.message || t('home.hero.searchError'))
    }
  }, [triggerSearch, t])

  useEffect(() => {
    if (location.state?.results) return
    runSearch(searchParams)
    // Chỉ tự tìm khi vào trang mà chưa có kết quả sẵn; các lần tìm lại sau do người
    // dùng chủ động bấm nút "Tìm lại" trong FilterSidebar sau khi đổi ngày/số khách.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const availableRoomTypes = useMemo(
    () => [...new Set(rooms.map((room) => room.name))],
    [rooms],
  )

  const visibleRooms = useMemo(() => {
    const filtered = rooms.filter((room) => {
      const price = room.basePrice ?? room.base_price ?? 0
      if (price < priceFilters.priceMin || price > priceFilters.priceMax) return false
      if (priceFilters.roomTypes.length > 0 && !priceFilters.roomTypes.includes(room.name)) return false
      return true
    })

    if (sortBy === 'price-asc') {
      return [...filtered].sort((a, b) => (a.basePrice ?? a.base_price ?? 0) - (b.basePrice ?? b.base_price ?? 0))
    }
    if (sortBy === 'price-desc') {
      return [...filtered].sort((a, b) => (b.basePrice ?? b.base_price ?? 0) - (a.basePrice ?? a.base_price ?? 0))
    }
    return filtered
  }, [rooms, priceFilters, sortBy])

  const handleSearchParamsChange = (patch) => setSearchParams((prev) => ({ ...prev, ...patch }))
  const handlePriceFilterChange = (patch) => setPriceFilters((prev) => ({ ...prev, ...patch }))
  const handleResetFilters = () => setPriceFilters(DEFAULT_PRICE_FILTERS)

  const isInitialLoading = isSearching && rooms.length === 0
  const dateLocale = i18n.language === 'en' ? 'en-US' : 'vi-VN'

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-16">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <p className="text-gray-600">
            {!isInitialLoading && (
              <>
                {t('search.resultsFound')} <span className="font-bold text-gray-900">{visibleRooms.length}</span> {t('search.roomsMatch')}
                {' '}{t('search.from')} <span className="font-semibold text-gray-900">{new Date(searchParams.checkIn).toLocaleDateString(dateLocale)}</span>
                {' '}{t('search.to')} <span className="font-semibold text-gray-900">{new Date(searchParams.checkOut).toLocaleDateString(dateLocale)}</span>
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
            searchParams={searchParams}
            onSearchParamsChange={handleSearchParamsChange}
            onApplySearch={() => runSearch(searchParams)}
            isApplyingSearch={isSearching}
            priceFilters={priceFilters}
            onPriceFilterChange={handlePriceFilterChange}
            onReset={handleResetFilters}
            availableRoomTypes={availableRoomTypes}
          />

          <div>
            {isInitialLoading && (
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

            {!isInitialLoading && visibleRooms.length === 0 && (
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

            {!isInitialLoading && visibleRooms.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {visibleRooms.map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    startDate={new Date(searchParams.checkIn)}
                    endDate={new Date(searchParams.checkOut)}
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

  const bookingCode = getBookingCode(booking.bookingId)
  const qrValue = getBookingQrPayload(booking)
  const qrRef = useRef(null)

  const handleSaveQr = () =>
    downloadQrPng(qrRef.current?.querySelector('svg'), `vika-qr-${bookingCode}.png`)

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

      <div className="flex flex-col items-center gap-3 py-2">
        <div ref={qrRef} className="rounded-xl border border-gray-100 bg-white p-3">
          <QRCodeSVG value={qrValue} size={160} level="M" />
        </div>
        <button
          type="button"
          onClick={handleSaveQr}
          className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
        >
          <Download size={16} /> {t('checkout.success.saveQr')}
        </button>
        <p className="max-w-xs text-xs text-gray-400">{t('checkout.success.qrHint')}</p>
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
          <span className="font-bold text-blue-600">{formatCurrency(totalPrice, i18n.language)}</span>
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

const PAYOS_POLL_INTERVAL_MS = 4000

// Đếm ngược tới thời điểm hết hạn (unix giây) mà backend trả về cho link PayOS.
// Trả về null nếu không có expiredAt (BE không phải lúc nào cũng có, xem AC "nếu có").
function usePaymentCountdown(expiredAt) {
  const [remaining, setRemaining] = useState(() =>
    expiredAt ? Math.max(0, expiredAt - Math.floor(Date.now() / 1000)) : null,
  )

  useEffect(() => {
    if (!expiredAt) {
      setRemaining(null)
      return
    }
    const tick = () => setRemaining(Math.max(0, expiredAt - Math.floor(Date.now() / 1000)))
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [expiredAt])

  return remaining
}

function formatCountdown(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

// Hiển thị QR + link thanh toán ngay trên trang checkout (thay vì redirect sang PayOS),
// đếm ngược tới khi hết hạn, và tự poll trạng thái để phát hiện thanh toán thành công mà
// không cần khách quay lại trang (webhook thật của PayOS không gọi được tới localhost).
function PayOSPaymentPanel({ totalPrice, paymentLink, linkError, isCreatingLink, paymentFailed, remaining, onRetry }) {
  const { t, i18n } = useTranslation()
  const isExpired = Boolean(paymentLink) && remaining === 0

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-lg mx-auto text-center space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{t('checkout.payment.title')}</h1>
        <p className="text-gray-500 mt-2">
          {t('checkout.payment.subtitle', { amount: formatCurrency(totalPrice, i18n.language) })}
        </p>
      </div>

      {isCreatingLink && !paymentLink && (
        <div className="flex flex-col items-center gap-3 py-8 text-gray-500">
          <Loader2 className="animate-spin" size={28} />
          {t('checkout.payment.creatingLink')}
        </div>
      )}

      {linkError && !isCreatingLink && (
        <div className="space-y-4">
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {linkError}
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {t('checkout.payment.retry')}
          </button>
        </div>
      )}

      {paymentFailed && !linkError && !isCreatingLink && (
        <div className="space-y-4">
          <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-600">
            {t('checkout.payment.failed')}
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {t('checkout.payment.retry')}
          </button>
        </div>
      )}

      {paymentLink && !isExpired && !paymentFailed && (
        <>
          <div className="flex justify-center py-2">
            <QRCodeSVG value={paymentLink.qrCode} size={200} level="M" />
          </div>
          {remaining !== null && (
            <p className="text-sm font-semibold text-gray-600">
              {t('checkout.payment.expiresIn', { time: formatCountdown(remaining) })}
            </p>
          )}
          <a
            href={paymentLink.checkoutUrl}
            target="_blank"
            rel="noreferrer"
            className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {t('checkout.payment.openLink')}
          </a>
          <p className="text-xs text-gray-400">{t('checkout.payment.waitingHint')}</p>
        </>
      )}

      {paymentLink && isExpired && !paymentFailed && (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
            {t('checkout.payment.expired')}
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-colors"
          >
            {t('checkout.payment.retry')}
          </button>
        </div>
      )}
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
  // Booking online đã tạo, đang chờ thanh toán — giữ lại để nút "Tạo mã mới" gọi lại
  // đúng booking này thay vì tạo booking mới (bug cũ khi bấm nộp lại form).
  const [pendingBooking, setPendingBooking] = useState(null)
  const [paymentLink, setPaymentLink] = useState(null)
  const [linkError, setLinkError] = useState(null)
  const [paymentFailed, setPaymentFailed] = useState(false)

  const [createBooking, { isLoading: isCreating }] = useCreateBookingMutation()
  const [createPayOSLink, { isLoading: isCreatingLink }] = useCreatePayOSLinkMutation()

  const requestPaymentLink = async (bookingId) => {
    setLinkError(null)
    setPaymentLink(null)
    setPaymentFailed(false)
    try {
      const link = await createPayOSLink(bookingId).unwrap()
      setPaymentLink(link)
    } catch (err) {
      setLinkError(err?.data?.message || t('checkout.payment.linkError'))
    }
  }

  const remaining = usePaymentCountdown(paymentLink?.expiredAt)
  const isLinkExpired = Boolean(paymentLink) && remaining === 0

  // Không có webhook thật trên localhost — tự poll trạng thái đơn (RTK Query
  // pollingInterval) trong lúc đang chờ khách quét QR/thanh toán, để trang tự chuyển
  // sang màn hình thành công hoặc báo thất bại. `skip` dừng poll khi đã PAID/FAILED
  // hoặc link đã hết hạn, và RTK Query tự huỷ subscription khi rời trang.
  const shouldPollPayment = Boolean(pendingBooking && paymentLink && !paidBooking && !paymentFailed && !isLinkExpired)
  const { data: syncedBooking } = useSyncPayOSStatusQuery(pendingBooking?.bookingId, {
    skip: !shouldPollPayment,
    pollingInterval: PAYOS_POLL_INTERVAL_MS,
  })

  useEffect(() => {
    if (!syncedBooking) return
    if (syncedBooking.paymentStatus === 'PAID') {
      setPaidBooking(syncedBooking)
    } else if (syncedBooking.paymentStatus === 'FAILED') {
      setPaymentFailed(true)
    }
  }, [syncedBooking])

  if (!checkoutState?.room) {
    return <Navigate to="/" replace />
  }

  const { room, startDate, endDate, nights, totalPrice, vatAmount } = checkoutState

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
        setPendingBooking(booking)
        await requestPaymentLink(booking.bookingId)
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
        ) : pendingBooking ? (
          <PayOSPaymentPanel
            totalPrice={totalPrice}
            paymentLink={paymentLink}
            linkError={linkError}
            isCreatingLink={isCreatingLink}
            paymentFailed={paymentFailed}
            remaining={remaining}
            onRetry={() => requestPaymentLink(pendingBooking.bookingId)}
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
                  disabled={isCreating}
                  className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-70 text-white font-bold py-3.5 rounded-xl transition-colors flex items-center justify-center gap-2"
                >
                  {isCreating && <Loader2 size={18} className="animate-spin" />}
                  {isCreating ? t('checkout.processing') : t('checkout.confirmBooking')}
                </button>
              </form>

              <aside className="lg:sticky lg:top-24 h-fit">
                <OrderSummaryCard room={room} startDate={startDate} endDate={endDate} nights={nights} totalPrice={totalPrice} vatAmount={vatAmount} />
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
      <Chatbot />
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
            <ProtectedRoute roles={['ADMIN', 'STAFF']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<AdminDashboardPage />} />
          <Route
            path="bookings"
            element={
              <ProtectedRoute roles={['ADMIN']}>
                <BookingManagementPage />
              </ProtectedRoute>
            }
          />
          <Route path="rooms" element={<RoomMapPage />} />
          <Route
            path="chat"
            element={
              <ProtectedRoute roles={['STAFF']}>
                <StaffChatPage />
              </ProtectedRoute>
            }
          />
          <Route path="rooms/:roomId" element={<AdminRoomDetailPage />} />
          <Route
            path="rooms/:roomId/checkout/:bookingId"
            element={<AdminCheckoutPage />}
          />
          <Route
            path="room-types"
            element={
              <ProtectedRoute roles={['ADMIN']}>
                <RoomTypeManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="accounts"
            element={
              <ProtectedRoute roles={['ADMIN']}>
                <UserManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="staff"
            element={
              <ProtectedRoute roles={['ADMIN']}>
                <StaffManagementPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="schedule"
            element={
              <ProtectedRoute roles={['ADMIN']}>
                <ShiftSchedulePage />
              </ProtectedRoute>
            }
          />
          <Route path="schedule/me" element={<MySchedulePage />} />
          <Route
            path="revenue"
            element={
              <ProtectedRoute roles={['ADMIN']}>
                <RevenueSummaryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="revenue/staff"
            element={
              <ProtectedRoute roles={['ADMIN']}>
                <RevenueByStaffPage />
              </ProtectedRoute>
            }
          />
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
