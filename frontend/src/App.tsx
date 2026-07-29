import { BrowserRouter, Routes, Route } from "react-router-dom"
import MapPage from "@/pages/MapPage"
import StatsPage from "@/pages/StatsPage"
import ProfilePage from "@/pages/ProfilePage"
import LoginPage from "@/pages/LoginPage"
import Signup from "@/pages/signup"
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
          <Route element={<AppLayout />}>
            <Route path="/" element={<MapPage />} />

            <Route element={<ProtectedRoute />}>
              <Route path="/stats" element={<StatsPage />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute />}>
            <Route path="/profile" element={<ProfilePage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
