
import { FaUserShield, FaTools, FaNewspaper } from "react-icons/fa";
import { Link } from "react-router-dom";

export default function AdminWelcome() {
  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center">
      <div className="admin-panel max-w-4xl w-full mx-auto text-center animate-fade-in">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <div className="absolute inset-0 bg-red-500/20 rounded-full blur-2xl animate-pulse" />
            <FaUserShield size={64} className="relative text-red-500 drop-shadow-2xl" />
          </div>
        </div>
        
        <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-red-500 via-red-400 to-red-500 bg-clip-text text-transparent">
          Panel de Administración
        </h1>
        
        <p className="text-lg text-white/70 mb-8 max-w-2xl mx-auto">
          Gestiona todas las secciones de la plataforma <span className="font-semibold text-white">LevántateCuba</span>: noticias, denuncias, usuarios y más.
        </p>

        <div className="admin-divider" />

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-8">
          <Link to="/admin/news" className="admin-card hover:scale-[1.02] transition-transform group">
            <FaNewspaper className="text-red-500 text-3xl mb-3 mx-auto group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold text-white mb-2">Noticias</h3>
            <p className="text-sm text-white/60">Publica y edita artículos</p>
          </Link>
          
          <Link to="/admin/reports" className="admin-card hover:scale-[1.02] transition-transform group">
            <FaTools className="text-red-500 text-3xl mb-3 mx-auto group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold text-white mb-2">Denuncias</h3>
            <p className="text-sm text-white/60">Revisa y modera reportes</p>
          </Link>
          
          <Link to="/admin/users" className="admin-card hover:scale-[1.02] transition-transform group">
            <FaUserShield className="text-red-500 text-3xl mb-3 mx-auto group-hover:scale-110 transition-transform" />
            <h3 className="font-semibold text-white mb-2">Usuarios</h3>
            <p className="text-sm text-white/60">Administra permisos y roles</p>
          </Link>
        </div>
      </div>
    </div>
  );
}
