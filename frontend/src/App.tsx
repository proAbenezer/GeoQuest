import { BrowserRouter, Routes, Route } from "react-router-dom"
import MapPage from "@/pages/MapPage"
import StatsPage from "@/pages/StatsPage"
import ProfilePage from "@/pages/ProfilePage"
import PublicProfilePage from "@/pages/PublicProfilePage"
import LoginPage from "@/pages/LoginPage"
import Signup from "@/pages/signup"
import MessagesPage from "@/pages/MessagesPage"
import GroupChatPage from "@/pages/GroupChatPage"
import NewGroupPage from "@/pages/NewGroupPage"
import AppLayout from "@/components/layout/AppLayout"
import ProtectedRoute from "@/components/ProtectedRoute"
import { AuthProvider } from "@/context/AuthContext"
import { NotificationsProvider } from "@/context/NotificationsContext"
import { Toaster } from "@/components/ui/sonner"


const App = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <NotificationsProvider>
          {/* One app-wide Toaster so popups appear on every page (map, stats,
              messages, profile). The notifications provider polls the server
              and pops toasts for new rows from here. */}
          <Toaster position="top-right" style={{ top: "4rem", zIndex: 1000 }} />
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
              {/* Public profile of another traveler (self redirects inside). */}
              <Route path="/users/:userId" element={<PublicProfilePage />} />
              <Route path="/messages/new-group" element={<NewGroupPage />} />
              <Route path="/messages/groups/:groupId" element={<GroupChatPage />} />
            </Route>
            <Route element={<AppLayout />}>
              <Route path="/" element={<MapPage />} />
            </Route>
          </Routes>
        </NotificationsProvider>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
