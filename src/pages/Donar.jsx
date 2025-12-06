// ============================================================================
// COMPONENTE DE DONACIONES CON STRIPE - LEVANTATECUBA
// Diseño moderno y minimalista estilo Apple
// ============================================================================

import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { loadStripe } from '@stripe/stripe-js';

// Configuración de Stripe (clave pública de pruebas)
const stripePromise = loadStripe('pk_test_51QqeowEHDG8US3JEvxSPduyR9Sq6fOGahimyfgGjVyQOztcmAkuoGeA4eao2khqnpIh06cLdw0KngohBADPMEU0U00kMZHRutm');

export default function Donar() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  // Estados
  const [selectedAmount, setSelectedAmount] = useState(10);
  const [customAmount, setCustomAmount] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [animateHeart, setAnimateHeart] = useState(false);

  // Montos predefinidos
  const predefinedAmounts = [5, 10, 25, 50, 100];

  // Verificar si viene de un pago exitoso
  useEffect(() => {
    const success = searchParams.get('success');
    const amount = searchParams.get('amount');
    const canceled = searchParams.get('canceled');
    
    if (success === 'true') {
      setShowSuccess(true);
      setAnimateHeart(true);
      // Limpiar query params después de mostrar éxito
      setTimeout(() => {
        navigate('/donar', { replace: true });
      }, 5000);
    }
    
    if (canceled === 'true') {
      setError('Has cancelado el proceso de donación. ¡Puedes intentarlo cuando quieras!');
    }
  }, [searchParams, navigate]);

  // Animación del corazón al cargar
  useEffect(() => {
    setAnimateHeart(true);
    const timer = setTimeout(() => setAnimateHeart(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  // Manejar selección de monto
  const handleAmountSelect = (amount) => {
    setSelectedAmount(amount);
    setIsCustom(false);
    setCustomAmount('');
    setError('');
  };

  // Manejar monto personalizado
  const handleCustomAmountChange = (e) => {
    const value = e.target.value;
    // Solo permitir números
    if (/^\d*\.?\d*$/.test(value) || value === '') {
      setCustomAmount(value);
      setIsCustom(true);
      if (value && parseFloat(value) > 0) {
        setSelectedAmount(parseFloat(value));
        setError('');
      }
    }
  };

  // Procesar donación con Stripe
  const handleDonate = async () => {
    setLoading(true);
    setError('');
    
    try {
      // Obtener el monto final
      const finalAmount = isCustom ? parseFloat(customAmount) : selectedAmount;
      
      // Validaciones
      if (!finalAmount || finalAmount < 1) {
        setError('El monto mínimo de donación es $1');
        setLoading(false);
        return;
      }
      
      if (finalAmount > 10000) {
        setError('El monto máximo de donación es $10,000');
        setLoading(false);
        return;
      }
      
      // Llamar al backend para crear sesión de checkout
      const response = await fetch('/api/donate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: finalAmount,
          currency: 'usd',
          donorName: 'Anónimo' // Puedes agregar un campo para el nombre si quieres
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
      console.error('Error:', err);
      setError(err.message || 'Ocurrió un error al procesar tu donación. Por favor, intenta nuevamente.');
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-b from-black via-zinc-900 to-black text-white">
      {/* Hero Section con animación */}
      <div className="relative overflow-hidden">
        {/* Background con efecto gradient animado */}
        <div className="absolute inset-0 bg-gradient-to-r from-red-900/20 via-transparent to-red-900/20 animate-pulse" />
        
        {/* Container principal */}
        <div className="relative max-w-4xl mx-auto px-6 py-20 md:py-32">
          {/* Título con animación de corazón */}
          <div className="text-center mb-12">
            <div className="inline-block mb-6">
              <span 
                className={`text-6xl md:text-7xl transition-all duration-1000 ${
                  animateHeart ? 'scale-125 animate-pulse' : 'scale-100'
                }`}
              >
                ❤️
              </span>
            </div>
            
            <h1 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent">
              Apoya nuestra misión
            </h1>
            
            <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
              Este proyecto es independiente y necesita tu apoyo. 
              Cualquier aporte, grande o pequeño, hace la diferencia.
            </p>
          </div>

          {/* Success Message */}
          {showSuccess && (
            <div className="mb-8 p-6 bg-green-900/30 border border-green-500/50 rounded-2xl backdrop-blur-sm animate-fadeIn">
              <div className="flex items-center justify-center space-x-3">
                <span className="text-3xl">🎉</span>
                <div>
                  <p className="text-green-400 font-semibold text-lg">¡Gracias por tu donación!</p>
                  <p className="text-green-300 text-sm mt-1">Tu apoyo hace posible nuestra misión de libertad para Cuba.</p>
                </div>
              </div>
            </div>
          )}

          {/* Card principal de donación */}
          <div className="bg-zinc-900/80 backdrop-blur-xl rounded-3xl shadow-2xl border border-zinc-800 overflow-hidden">
            {/* Header del card */}
            <div className="bg-gradient-to-r from-red-900/50 to-red-800/50 p-8 text-center">
              <h2 className="text-2xl font-semibold mb-2">Selecciona el monto de tu donación</h2>
              <p className="text-gray-400">Todos los pagos son procesados de forma segura con Stripe</p>
            </div>

            {/* Body del card */}
            <div className="p-8 md:p-10">
              {/* Grid de montos predefinidos */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
                {predefinedAmounts.map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleAmountSelect(amount)}
                    className={`
                      relative p-4 rounded-xl font-semibold text-lg transition-all duration-300
                      ${selectedAmount === amount && !isCustom
                        ? 'bg-red-600 text-white shadow-lg shadow-red-600/30 scale-105'
                        : 'bg-zinc-800 text-gray-300 hover:bg-zinc-700 hover:scale-102'
                      }
                    `}
                  >
                    ${amount}
                  </button>
                ))}
              </div>

              {/* Monto personalizado */}
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-400 mb-3">
                  O ingresa un monto personalizado
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl text-gray-500">
                    $
                  </span>
                  <input
                    type="text"
                    value={customAmount}
                    onChange={handleCustomAmountChange}
                    placeholder="0.00"
                    className={`
                      w-full pl-12 pr-4 py-4 bg-zinc-800 border-2 rounded-xl
                      text-xl font-semibold placeholder-gray-600
                      transition-all duration-300 focus:outline-none
                      ${isCustom 
                        ? 'border-red-500 text-white' 
                        : 'border-zinc-700 hover:border-zinc-600 focus:border-red-500 text-gray-300'
                      }
                    `}
                  />
                </div>
                <p className="mt-2 text-xs text-gray-500">
                  Monto mínimo: $1 • Monto máximo: $10,000
                </p>
              </div>

              {/* Error message */}
              {error && (
                <div className="mb-6 p-4 bg-red-900/20 border border-red-500/50 rounded-xl">
                  <p className="text-red-400 text-sm flex items-center">
                    <span className="mr-2">⚠️</span>
                    {error}
                  </p>
                </div>
              )}

              {/* Botón de donar */}
              <button
                onClick={handleDonate}
                disabled={loading || (!selectedAmount && !customAmount)}
                className={`
                  w-full py-5 px-8 rounded-2xl font-bold text-lg
                  transition-all duration-300 transform
                  ${loading || (!selectedAmount && !customAmount)
                    ? 'bg-zinc-700 text-gray-500 cursor-not-allowed'
                    : 'bg-gradient-to-r from-red-600 to-red-700 text-white hover:from-red-700 hover:to-red-800 hover:scale-102 shadow-xl shadow-red-900/30'
                  }
                  ${loading ? 'animate-pulse' : ''}
                `}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Procesando...
                  </span>
                ) : (
                  <span className="flex items-center justify-center">
                    💳 Donar {selectedAmount || customAmount ? `$${isCustom ? customAmount : selectedAmount}` : 'ahora'}
                  </span>
                )}
              </button>

              {/* Información de seguridad */}
              <div className="mt-8 pt-8 border-t border-zinc-800">
                <div className="flex flex-col md:flex-row items-center justify-between text-sm text-gray-500">
                  <div className="flex items-center mb-4 md:mb-0">
                    <svg className="w-5 h-5 mr-2 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                    <span>Pago seguro con SSL</span>
                  </div>
                  
                  <div className="flex items-center mb-4 md:mb-0">
                    <svg className="w-5 h-5 mr-2 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M4 4a2 2 0 00-2 2v4a2 2 0 002 2V6h10a2 2 0 00-2-2H4zm2 6a2 2 0 012-2h8a2 2 0 012 2v4a2 2 0 01-2 2H8a2 2 0 01-2-2v-4zm6 4a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                    </svg>
                    <span>Procesado por Stripe</span>
                  </div>
                  
                  <div className="flex items-center">
                    <svg className="w-5 h-5 mr-2 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                      <path fillRule="evenodd" d="M4 5a2 2 0 012-2 1 1 0 000 2H6a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2V5a2 2 0 00-2-2 1 1 0 100-2 2 2 0 012 2v8a2 2 0 002 2H6a2 2 0 00-2-2V5z" clipRule="evenodd" />
                    </svg>
                    <span>100% para la causa</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Footer con información adicional */}
          <div className="mt-12 text-center">
            <p className="text-sm text-gray-500 mb-4">
              * Tu aporte será utilizado exclusivamente para mantener y expandir este proyecto de libertad.
            </p>
            
            <div className="flex items-center justify-center space-x-4 text-sm">
              <a 
                href="/" 
                className="text-gray-400 hover:text-white transition-colors flex items-center"
              >
                <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Volver al inicio
              </a>
              
              <span className="text-gray-600">•</span>
              
              <a 
                href="mailto:soporte@levantatecuba.com" 
                className="text-gray-400 hover:text-white transition-colors"
              >
                ¿Preguntas? Escríbenos
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Estilos adicionales */}
      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }
        
        .hover\\:scale-102:hover {
          transform: scale(1.02);
        }
        
        .scale-102 {
          transform: scale(1.02);
        }
      `}</style>
    </main>
  );
}