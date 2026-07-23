import { BrowserRouter, Navigate, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { useMemo } from 'react'
import Header from '../components/layout/Header'
import Footer from '../components/layout/Footer'
import HeroSection from '../components/homepage/HeroSection'
import FeaturedRooms from '../components/homepage/FeaturedRooms'
import PromoSection from '../components/homepage/PromoSection'
import AuthHero from '../components/auth/AuthHero'
import LoginForm from '../components/auth/LoginForm'
import RegisterForm from '../components/auth/RegisterForm'
import BookingCard from '../components/room/BookingCard'
import RoomReviews from '../components/room/RoomReviews'
import RoomCard from '../components/searchroom/RoomCard'
import { roomTypeApi } from '../services/roomType'
import AdminRoute from '../components/admin/routesadmin/AdminRoute'

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
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-gray-50">
      <AuthHero />
      <div className="flex items-center justify-center py-12">
        {mode === 'login' ? <LoginForm /> : <RegisterForm />}
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid gap-8 lg:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h1 className="text-3xl font-bold text-gray-900 mb-3">{room.name}</h1>
            <p className="text-gray-600 leading-relaxed">{room.description}</p>
          </div>
          <RoomReviews />
        </section>
        <aside className="lg:sticky lg:top-6 h-fit">
          <BookingCard room={room} />
        </aside>
      </main>
      <Footer />
    </div>
  )
}

function CheckoutPage() {
  const location = useLocation()
  const checkoutState = location.state

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 space-y-4">
          <h1 className="text-3xl font-bold text-gray-900">Thanh toán đặt phòng</h1>
          <p className="text-gray-600">
            {checkoutState ? 'Đã nhận được thông tin đặt phòng từ màn hình trước.' : 'Chưa có dữ liệu thanh toán.'}
          </p>
          {checkoutState && (
            <pre className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm overflow-auto">
              {JSON.stringify(checkoutState, null, 2)}
            </pre>
          )}
        </div>
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
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/admin" element={<AdminHome />} />
        <Route path="/admin/checkout" element={<CheckoutPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
