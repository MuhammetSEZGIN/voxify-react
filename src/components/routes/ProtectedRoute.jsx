import { useAuth } from "../../hooks/useAuth";
import { Navigate, Outlet } from "react-router-dom";


function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>loading ...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // If used as a wrapper: <ProtectedRoute><MainLayout/></ProtectedRoute>
  // If used as a route element without children, support nested routing.
  return children ? children : <Outlet />;
}

export default ProtectedRoute;
