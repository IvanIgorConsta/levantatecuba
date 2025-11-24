// src/admin_dashboard/AdminRoutes.jsx
import { Routes, Route, Outlet } from "react-router-dom";
import AdminNews from "./AdminNews";
import AdminReports from "./AdminReports";
import AdminUsers from "./AdminUsers";
import AdminWelcome from "./AdminWelcome";
import AdminPasswordRequests from "./AdminPasswordRequests";
import AdminProfile from "./AdminProfile";
import RedactorIA from "./redactor_ia/RedactorIA";
// ELIMINADO: import AdminRostros from "./AdminRostros";

export default function AdminRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Outlet />}>
        <Route index element={<AdminWelcome />} />
        <Route path="news" element={<AdminNews />} />
        <Route path="reports" element={<AdminReports />} />
        <Route path="users" element={<AdminUsers />} />
        <Route path="password-requests" element={<AdminPasswordRequests />} />
        {/* ELIMINADO: <Route path="rostros" element={<AdminRostros />} /> */}
        <Route path="perfil" element={<AdminProfile />} />
        <Route path="redactor-ia" element={<RedactorIA />} />
      </Route>
    </Routes>
  );
}