import { useAuth } from "../../hooks/useAuth";
import { Navigate, Outlet } from "react-router-dom";


function ProtectedRoute({ Children }) {
  const {isAuthenticated, loading} = useAuth();
  // Kullanıcının şu anki konumu alınıyor

  // Farklı bir yükleniyor durumu eklenebilir
  if (loading) {
    return <div>loading ...</div>;
  }
  if (!isAuthenticated) {
    return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
  }
  return Children;
}

export default ProtectedRoute;
