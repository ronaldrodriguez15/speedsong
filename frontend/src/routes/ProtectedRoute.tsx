import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
export function ProtectedRoute() {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const location = useLocation();
  if (isLoading) return <p role="status" className="p-8">Validando sesión...</p>;
  if (isAuthenticated && !user?.is_admin && ['/usuarios', '/transferencias'].includes(location.pathname)) return <Navigate to="/" replace />;
  if (isAuthenticated && !user?.is_admin && !user?.point_ids?.length) return <div className="p-8"><p>No tienes puntos de venta asignados. Solicita al administrador que configure tus permisos.</p><button className="btn-primary mt-4" onClick={() => void logout()}>Cerrar sesión</button></div>;
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
