import { BrowserRouter, Routes, Route } from "react-router-dom"
import MapPage from "@/pages/MapPage"
import StatsPage from "@/pages/StatsPage"
import ProfilePage from "@/pages/ProfilePage"
import LoginPage from "@/pages/LoginPage"
import Signup from "@/pages/signup"
import MessagesPage from "@/pages/MessagesPage"
import AppLayout from "@/components/layout/AppLayout"
import ProtectedRoute from "@/components/ProtectedRoute"
import { AuthProvider } from "@/context/AuthContext"


const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/profile" element={<ProfilePage />} />
          {/* Dashboard is a standalone page (no navbar/sidebar), like /profile —
              it carries its own "Back to map" link. */}
          <Route element={<ProtectedRoute />}>
            <Route path="/stats" element={<StatsPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/:conversationId" element={<MessagesPage />} />
          </Route>
          <Route element={<AppLayout />}>
            <Route path="/" element={<MapPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
