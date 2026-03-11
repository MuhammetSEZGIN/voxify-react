import { Routes, Route, Navigate } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import RegisterPage from "./pages/RegisterPage";
import { useAuth } from "./hooks/useAuth";
import ProtectedRoute from "./components/routes/ProtectedRoute";
import MainLayout from "./components/layout/MainLayout";

function App() {
  const { isAuthenticated } = useAuth();

  return (
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
      {/* Clan/Channel URL'lerini de MainLayout yakalar */}
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
  );
}

export default App;