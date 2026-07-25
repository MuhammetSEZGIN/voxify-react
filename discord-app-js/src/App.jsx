import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import ConfirmEmailPage from "./pages/ConfirmEmailPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import { useAuth } from "./hooks/useAuth";
import ProtectedRoute from "./components/routes/ProtectedRoute";
import MainLayout from "./components/layout/MainLayout";
import TitleBar from "./components/layout/TitleBar";
import UpdateNotification from "./components/layout/UpdateNotification";
import { useUpdater } from "./hooks/useUpdater";
import { setAutostart } from "./utils/autostart";

function App() {
  const { isAuthenticated } = useAuth();
  const { updateInfo, status, progress, errorMsg, installUpdate, dismiss } = useUpdater();

  useEffect(() => {
    // Uygulama her açıldığında başlangıca ekle (Kullanıcı isterse bunu ayarlardan kapatabilir)
    setAutostart(true).catch(console.error);
  }, []);

  return (
    <div className="app-shell">
      <TitleBar />
      <UpdateNotification
        updateInfo={updateInfo}
        status={status}
        progress={progress}
        errorMsg={errorMsg}
        onInstall={installUpdate}
        onDismiss={dismiss}
      />
      <main className="app-container">
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
          <Route path="/confirm-email" element={<ConfirmEmailPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
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
      </main>
    </div>
  );
}

export default App;
