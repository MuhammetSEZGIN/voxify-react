import { Routes, Route, Navigate, Outlet, useNavigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import { useAuth } from "./hooks/useAuth";
import ProtectedRoute from "./components/routes/ProtectedRoute";

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

      <Route
        path="/app"
        element={
          <ProtectedRoute>
            <HomePage />
            <Route index element={<DashboardPage />} />
          </ProtectedRoute>
        }
      ></Route>
      {/* İç İçe Rota (Nested Route)
          URL: /app/clans/:clanId/channels/:channelId 
          Bu rota, MainLayout içindeki <Outlet />'e render edilecek.
        */}

      <Route
        path="/app/clans/:clanId/channels/:channelId"
        element={<ChannelPage />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function HomePage() {
  const navigate = useNavigate();
  return (
    <div>
      Yükleniyor...
      <div style={{ marginTop: 12 }}>
        <button onClick={() => navigate("/login")} style={{ marginRight: 8 }}>
          Go to Login
        </button>
        <button onClick={() => navigate("/register")}>Go to Register</button>
      </div>
    </div>
  );
}

export default App;
