// src/pages/Gone410.jsx
import { Link } from "react-router-dom";
import { AlertTriangle } from "lucide-react";

export default function Gone410({ title = "Contenido no disponible", message }) {
  return (
    <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-6 flex justify-center">
          <AlertTriangle size={64} className="text-red-500" />
        </div>
        
        <h1 className="text-4xl font-bold mb-4">410 - Gone</h1>
        <h2 className="text-2xl font-semibold mb-4 text-zinc-300">{title}</h2>
        
        {message && (
          <p className="text-zinc-400 mb-6 leading-relaxed">
            {message}
          </p>
        )}
        
        <p className="text-zinc-400 mb-8">
          Esta sección ha sido retirada permanentemente de la plataforma.
        </p>
        
        <Link
          to="/"
          className="inline-block bg-red-600 hover:bg-red-700 text-white font-semibold px-8 py-3 rounded-lg transition-colors duration-200"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
