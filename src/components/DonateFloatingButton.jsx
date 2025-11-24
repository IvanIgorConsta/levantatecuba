// ============================================================================
// BOTÓN FLOTANTE DE DONACIÓN - LEVANTATECUBA
// Botón sutil con Stripe que flota dentro del Hero (no sticky)
// ============================================================================

import { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';

// Inicializar Stripe con clave pública
const stripePromise = loadStripe('pk_test_51QqeowEHDG8US3JEvxSPduyR9Sq6fOGahimyfgGjVyQOztcmAkuoGeA4eao2khqnpIh06cLdw0KngohBADPMEU0U00kMZHRutm');

export default function DonateFloatingButton() {
  const [loading, setLoading] = useState(false);
  const [showPopover, setShowPopover] = useState(false);
  const [selectedAmount, setSelectedAmount] = useState(10);
  const [customAmount, setCustomAmount] = useState('');
  const [error, setError] = useState('');
  
  // Animación de respiración
  const [breathing, setBreathing] = useState(false);
  
  // Activar animación de respiración cada 5 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      setBreathing(true);
      setTimeout(() => setBreathing(false), 1000);
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  // Manejar donación
  const handleDonate = async (amount = selectedAmount) => {
    setLoading(true);
    setError('');
    setShowPopover(false);
    
    try {
      // Validar monto
      const finalAmount = amount || parseFloat(customAmount) || selectedAmount;
      if (finalAmount < 1) {
        throw new Error('El monto mínimo es $1');
      }
      
      // Llamar al backend
      const response = await fetch('/api/donate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: finalAmount,
          currency: 'usd',
          donorName: 'Anónimo'
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Error procesando donación');
      }
      
      // Redirigir a Stripe Checkout
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        throw new Error('No se pudo crear la sesión de pago');
      }
      
    } catch (err) {
      console.error('Error en donación:', err);
      setError(err.message);
      // Mostrar error brevemente
      setTimeout(() => setError(''), 3000);
    } finally {
      setLoading(false);
    }
  };

  // Manejar selección de monto predefinido
  const handleAmountSelect = (amount) => {
    setSelectedAmount(amount);
    setCustomAmount('');
    handleDonate(amount);
  };

  // Manejar monto personalizado
  const handleCustomSubmit = (e) => {
    e.preventDefault();
    const amount = parseFloat(customAmount);
    if (amount && amount >= 1) {
      handleDonate(amount);
    }
  };

  return (
    <>
      {/* Botón principal flotante */}
      <div 
        className={`
          absolute bottom-6 right-6 md:bottom-8 md:right-8 z-40
          transition-all duration-500 transform
          ${breathing ? '-translate-y-1' : 'translate-y-0'}
        `}
      >
        {/* Popover de montos (oculto por defecto) */}
        {showPopover && (
          <div className="absolute bottom-full right-0 mb-3 animate-fadeIn">
            <div className="bg-zinc-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-zinc-800 p-4 min-w-[200px]">
              {/* Flecha del popover */}
              <div className="absolute -bottom-2 right-6 w-4 h-4 bg-zinc-900/95 border-r border-b border-zinc-800 transform rotate-45" />
              
              {/* Montos predefinidos */}
              <div className="space-y-2 mb-3">
                {[10, 20, 50].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleAmountSelect(amount)}
                    className="w-full px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white text-sm font-medium transition-all hover:scale-105"
                  >
                    ${amount} USD
                  </button>
                ))}
              </div>
              
              {/* Monto personalizado */}
              <form onSubmit={handleCustomSubmit} className="border-t border-zinc-700 pt-3">
                <input
                  type="number"
                  min="1"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Otro monto..."
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-red-500"
                />
                {customAmount && (
                  <button
                    type="submit"
                    className="w-full mt-2 px-3 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white text-sm font-medium transition-all"
                  >
                    Donar ${customAmount}
                  </button>
                )}
              </form>
              
              {/* Cerrar popover */}
              <button
                onClick={() => setShowPopover(false)}
                className="absolute top-2 right-2 text-gray-500 hover:text-white"
                aria-label="Cerrar"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* Botón principal */}
        <button
          onClick={() => showPopover ? handleDonate() : setShowPopover(true)}
          disabled={loading}
          className={`
            group relative flex items-center gap-2 px-5 py-3
            bg-gradient-to-r from-red-600 to-red-800
            hover:from-red-700 hover:to-red-900
            text-white font-semibold text-sm md:text-base
            rounded-full shadow-lg hover:shadow-xl
            transform transition-all duration-300
            hover:scale-105 active:scale-95
            focus:outline-none focus:ring-4 focus:ring-red-500/30
            disabled:opacity-50 disabled:cursor-not-allowed
            ${breathing ? 'shadow-red-500/30' : 'shadow-black/30'}
          `}
          aria-label="Donar a LevántateCuba"
        >
          {/* Círculo con ícono */}
          <span className="flex items-center justify-center w-8 h-8 bg-white/10 rounded-full backdrop-blur-sm">
            {loading ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <span className="text-base">❤️</span>
            )}
          </span>
          
          {/* Texto del botón */}
          <span className="pr-1">
            {loading ? 'Procesando...' : 'Apoyar'}
          </span>
          
          {/* Borde sutil animado */}
          <span 
            className={`
              absolute inset-0 rounded-full border border-white/20
              ${breathing ? 'animate-pulse' : ''}
            `}
          />
        </button>

        {/* Mensaje de error */}
        {error && (
          <div className="absolute top-full right-0 mt-2 animate-fadeIn">
            <div className="bg-red-900/90 backdrop-blur text-white text-xs px-3 py-2 rounded-lg shadow-lg max-w-xs">
              {error}
            </div>
          </div>
        )}
      </div>

      {/* Estilos de animación */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
