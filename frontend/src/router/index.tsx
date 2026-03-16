import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import LoginPage from '../pages/LoginPage'
import RegisterPage from '../pages/RegisterPage'
import CollectionsPage from '../pages/CollectionsPage'
import CollectionDetailPage from '../pages/CollectionDetailPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(s => s.accessToken)
  if (!token) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/collections"
        element={<ProtectedRoute><CollectionsPage /></ProtectedRoute>}
      />
      <Route
        path="/collections/:id"
        element={<ProtectedRoute><CollectionDetailPage /></ProtectedRoute>}
      />
      <Route path="/" element={<Navigate to="/collections" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
