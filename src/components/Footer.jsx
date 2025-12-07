import React, { useState } from "react";
import { Link } from "react-router-dom";
import { startDonation } from "../hooks/useDonate";

export default function Footer() {
  return (
    <footer className="bg-zinc-900 border-t border-zinc-800 text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Grid de columnas */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          {/* Marca */}
          <div className="sm:col-span-2 md:col-span-1">
            <h3 className="text-lg font-bold text-white mb-2">LevántateCuba</h3>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Plataforma de información y participación ciudadana.
            </p>
          </div>

          {/* Navegación */}
          <div>
            <h4 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-3">
              Navegación
            </h4>
            <ul className="space-y-2">
              <li>
                <Link to="/" className="text-zinc-400 hover:text-white text-sm transition-colors">
                  Inicio
                </Link>
              </li>
              <li>
                <Link to="/noticias" className="text-zinc-400 hover:text-white text-sm transition-colors">
                  Noticias
                </Link>
              </li>
              <li>
                <Link to="/denuncias" className="text-zinc-400 hover:text-white text-sm transition-colors">
                  Denuncias
                </Link>
              </li>
              <li>
                <Link to="/tienda" className="text-zinc-400 hover:text-white text-sm transition-colors">
                  Tienda
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-zinc-400 hover:text-white text-sm transition-colors">
                  Sobre Nosotros
                </Link>
              </li>
            </ul>
          </div>

          {/* Participa */}
          <div>
            <h4 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-3">
              Participa
            </h4>
            <ul className="space-y-2">
              <li>
                <Link to="/denuncias/nueva" className="text-zinc-400 hover:text-white text-sm transition-colors">
                  Hacer denuncia
                </Link>
              </li>
              <li>
                <button 
                  onClick={() => startDonation(10)}
                  className="text-zinc-400 hover:text-white text-sm transition-colors text-left"
                >
                  Donar
                </button>
              </li>
              <li>
                <Link to="/login" className="text-zinc-400 hover:text-white text-sm transition-colors">
                  Iniciar sesión
                </Link>
              </li>
              <li>
                <Link to="/registro" className="text-zinc-400 hover:text-white text-sm transition-colors">
                  Crear cuenta
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-zinc-300 uppercase tracking-wider mb-3">
              Información Legal
            </h4>
            <ul className="space-y-2">
              <li>
                <Link to="/legal/privacidad" className="text-zinc-400 hover:text-white text-sm transition-colors">
                  Política de Privacidad
                </Link>
              </li>
              <li>
                <Link to="/legal/cookies" className="text-zinc-400 hover:text-white text-sm transition-colors">
                  Política de Cookies
                </Link>
              </li>
              <li>
                <Link to="/legal/terminos" className="text-zinc-400 hover:text-white text-sm transition-colors">
                  Términos y Condiciones
                </Link>
              </li>
              <li>
                <Link to="/legal/contenido-usuarios" className="text-zinc-400 hover:text-white text-sm transition-colors">
                  Contenido de Usuarios
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Línea divisoria */}
        <div className="border-t border-zinc-800 pt-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-zinc-500 text-sm text-center sm:text-left">
              © {new Date().getFullYear()} LevántateCuba. Todos los derechos reservados.
            </p>
            <div className="flex items-center gap-4 text-xs text-zinc-500">
              <Link to="/legal/privacidad" className="hover:text-zinc-300 transition-colors">
                Privacidad
              </Link>
              <span>•</span>
              <Link to="/legal/cookies" className="hover:text-zinc-300 transition-colors">
                Cookies
              </Link>
              <span>•</span>
              <Link to="/legal/terminos" className="hover:text-zinc-300 transition-colors">
                Términos
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
