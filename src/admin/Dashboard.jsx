import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { FiHome, FiFileText, FiUsers, FiSettings } from "react-icons/fi";

export default function AdminDashboard() {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  const isActive = (path) => pathname.startsWith(path);

  return (
    <div className="admin-ui flex h-screen bg-zinc-950 text-white">
      
      {/* Sidebar */}
      <aside className={`sidebar ${collapsed ? "w-16" : "w-64"} border-r border-zinc-800 transition-all duration-300 flex flex-col admin-scrollbar`}>
        <div className="p-4 border-b border-zinc-800/50 flex items-center justify-between">
          <span className={`sidebar-header ${collapsed ? "hidden" : "block"}`}>Admin Panel</span>
          <button onClick={() => setCollapsed(!collapsed)} className="text-white/60 hover:text-white text-sm transition-colors">
            {collapsed ? "»" : "«"}
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <Link to="/admin" className={`sidebar-link ${isActive("/admin") && pathname === "/admin" ? "sidebar-link-active" : ""}`}>
            <FiHome size={18} />
            {!collapsed && <span>Inicio</span>}
          </Link>
          <Link to="/admin/news" className={`sidebar-link ${isActive("/admin/news") ? "sidebar-link-active" : ""}`}>
            <FiFileText size={18} />
            {!collapsed && <span>Noticias</span>}
          </Link>
          <Link to="/admin/reports" className={`sidebar-link ${isActive("/admin/reports") ? "sidebar-link-active" : ""}`}>
            <FiMonitor size={18} />
            {!collapsed && <span>Denuncias</span>}
          </Link>
          <Link to="/admin/users" className={`sidebar-link ${isActive("/admin/users") ? "sidebar-link-active" : ""}`}>
            <FiUsers size={18} />
            {!collapsed && <span>Usuarios</span>}
          </Link>
          <Link to="/admin/perfil" className={`sidebar-link ${isActive("/admin/perfil") ? "sidebar-link-active" : ""}`}>
            <FiSettings size={18} />
            {!collapsed && <span>Mi Perfil</span>}
          </Link>
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 bg-zinc-950 admin-scrollbar">
        <div className="p-6 md:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
