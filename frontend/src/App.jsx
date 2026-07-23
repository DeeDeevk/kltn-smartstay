import { AuthProvider } from './context/AuthContext'
import AppRoutes from './routes/AppRoutes'
import Chatbot from './components/Chatbot'

function App() {

  return (
    <AuthProvider>
      <div className="flex min-h-screen flex-col bg-white">
        <AppRoutes />
        <Chatbot />
      </div>
    </AuthProvider>
  )
}

export default App
