import { AuthProvider } from './context/AuthContext'
import { SocketProvider } from './context/SocketContext'
import AppRoutes from './routes/AppRoutes'

function App() {

  return (
    <AuthProvider>
      <SocketProvider>
        <div className="flex min-h-screen flex-col bg-white">
          <AppRoutes />
        </div>
      </SocketProvider>
    </AuthProvider>
  )
}

export default App
