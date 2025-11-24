import React from 'react';
import { Link } from 'react-router-dom';

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-transparent text-center">
      {/* Ícono de error */}
      <svg 
        className="w-16 h-16 text-red-500 mb-6" 
        xmlns="http://www.w3.org/2000/svg" 
        viewBox="0 0 24 24" 
        fill="none" 
        stroke="currentColor"
      >
        <path 
          strokeLinecap="round" 
          strokeLinejoin="round" 
          strokeWidth={2} 
          d="M12 2a10 10 0 110 20 10 10 0 010-20zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z" 
        />
      </svg>

      {/* Texto de error 404 */}
      <h1 className="text-6xl md:text-8xl font-bold text-white">404</h1>
      <p className="text-xl md:text-2xl text-zinc-400 mt-4">
        Lo sentimos, la página que buscas no existe.
      </p>

      {/* Botón para volver al inicio */}
      <Link 
        to="/" 
        className="mt-8 px-6 py-3 text-lg font-semibold text-white bg-blue-600 rounded hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300"
      >
        Volver al inicio
      </Link>
    </div>
  );
}

export default NotFound;
