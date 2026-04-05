import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import { useAuth } from "./hooks/useAuth";
import ProtectedRoute from "./components/routes/ProtectedRoute";
import MainLayout from "./components/layout/MainLayout";
import TitleBar from "./components/layout/TitleBar";
import { setAutostart } from "./utils/autostart";

function App() {
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    // Uygulama her açıldığında başlangıca ekle (Kullanıcı isterse bunu ayarlardan kapatabilir)
    setAutostart(true).catch(console.error);
  }, []);

  return (
    <>
     <TitleBar />
      <div className="app-container">
        <Routes>
          <Route
            path="/"
            element={<Navigate to={isAuthenticated ? "/app" : "/login"} replace />}
          />
          <Route
            path="/login"
            element={isAuthenticated ? <Navigate to="/app" replace /> : <LoginPage />}
          />
          <Route
            path="/register"
            element={isAuthenticated ? <Navigate to="/app" replace /> : <RegisterPage />}
          />
          <Route
            path="/app"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/clans/:clanId"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/clans/:clanId/channels/:channelId"
            element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </>
  );
}

export default App;