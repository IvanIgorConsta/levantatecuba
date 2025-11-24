import { Navigate } from "react-router-dom";
import { jwtDecode } from "jwt-decode"; // ✅ CORRECTA IMPORTACIÓN

export default function PrivateRoute({ children, requireAdmin = false }) {
  const token = localStorage.getItem("token");

  if (!token) {
    return <Navigate to="/admin/login" replace />;
  }

  try {
    const decoded = jwtDecode(token);

    const now = Date.now() / 1000;
    if (decoded.exp < now) {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("user");
      window.dispatchEvent(new Event("auth:changed"));
      return <Navigate to="/admin/login" replace />;
    }

    // ✅ Verificar roles para rutas administrativas
    if (requireAdmin) {
      const userRole = decoded.role;
      if (!userRole || (userRole !== "admin" && userRole !== "editor")) {
        return <Navigate to="/" replace />;
      }
    }

    return children;
  } catch (err) {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("user");
    window.dispatchEvent(new Event("auth:changed"));
    return <Navigate to="/admin/login" replace />;
  }
}
