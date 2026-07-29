import { lazy, Suspense } from "react";
import { Routes, Route, Navigate } from "react-router";
import LandingPage from "./pages/LandingPage";
import { useAuth } from "./hooks/useAuth";
import ProtectedRoute from "./components/routes/ProtectedRoute";
import "./styles/web.css";

const LoginPage = lazy(() => import("./pages/LoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ConfirmEmailPage = lazy(() => import("./pages/ConfirmEmailPage"));
const ForgotPasswordPage = lazy(() => import("./pages/ForgotPasswordPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const MainLayout = lazy(() => import("./components/layout/MainLayout"));

function RouteLoading() {
  return (
    <div className="route-loading" role="status" aria-live="polite">
      <span className="route-loading__mark">V</span>
      <span className="route-loading__pulse" />
      <span className="route-loading__label">Voxify hazırlanıyor</span>
    </div>
  );
}

function App() {
  const { isAuthenticated, loading } = useAuth();

  return (
    <div className="app-shell">
      <div className="app-container">
        {loading ? (
          <RouteLoading />
        ) : (
          <Suspense fallback={<RouteLoading />}>
            <Routes>
            <Route
              path="/"
              element={isAuthenticated ? <Navigate to="/app" replace /> : <LandingPage />}
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
            <Route
              path="*"
              element={<Navigate to={isAuthenticated ? "/app" : "/"} replace />}
            />
            </Routes>
          </Suspense>
        )}
      </div>
    </div>
  );
}

export default App;
