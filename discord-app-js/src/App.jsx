import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import { useAuth } from "./hooks/useAuth";
import ProtectedRoute from "./components/routes/ProtectedRoute";
import MainLayout from "./components/layout/MainLayout";

function App() {
  const DashboardPage = () => <h2>SesVer Ana Sayfasına Hoş Geldiniz!</h2>;
  // Kanal sayfası için de geçici bir component
  const ChannelPage = () => <h3>Burası bir metin kanalı</h3>;
  const { isAuthenticated } = useAuth();
  return (
    <Routes>
      {/* Route yönlendirme */}
      <Route
        path="/"
        element={<Navigate to={isAuthenticated ? "/app" : "/login"} replace />}
      />
      {/* public sayfalar */}
      <Route
        path="/login"
        element={
          isAuthenticated ? <Navigate to="/app" replace /> : <LoginPage />
        }
      />
      <Route
        path="/register"
        element={
          isAuthenticated ? <Navigate to="/app" replace /> : <RegisterPage />
        }
      />
      {/* Protected + Nested Routes */}
      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        {/* İç İçe Rota (Nested Route)
            URL: /app/clans/:clanId/channels/:channelId
            Bu rota, MainLayout içindeki <Outlet />'e render edilecek.
          */}
        <Route
          path="clans/:clanId/channels/:channelId"
          element={<ChannelPage />}
        />
      </Route>
    </Routes>
  );
}

export default App;
