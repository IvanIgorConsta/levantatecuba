// src/hooks/useDonate.js
// Hook reutilizable para iniciar donaciones con Stripe
import { useState, useCallback } from 'react';

/**
 * Hook para manejar donaciones con Stripe
 * @returns {Object} { donate, loading, error }
 */
export function useDonate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const donate = useCallback(async (amount = 10) => {
    setLoading(true);
    setError(null);

    try {
      // Validaciones
      const finalAmount = parseFloat(amount);
      if (!finalAmount || finalAmount < 1) {
        throw new Error('El monto mínimo de donación es $1');
      }
      if (finalAmount > 10000) {
        throw new Error('El monto máximo de donación es $10,000');
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
      } else if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No se pudo crear la sesión de pago');
      }

    } catch (err) {
      console.error('[useDonate] Error:', err);
      setError(err.message || 'Error al procesar la donación');
      setLoading(false);
    }
  }, []);

  return { donate, loading, error };
}

/**
 * Función standalone para iniciar donación (sin hook)
 * Útil para event handlers simples
 */
export async function startDonation(amount = 10) {
  try {
    const finalAmount = parseFloat(amount);
    if (!finalAmount || finalAmount < 1) {
      alert('El monto mínimo de donación es $1');
      return;
    }

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

    if (data.checkoutUrl) {
      window.location.href = data.checkoutUrl;
    } else if (data.url) {
      window.location.href = data.url;
    } else {
      throw new Error('No se pudo crear la sesión de pago');
    }

  } catch (err) {
    console.error('[startDonation] Error:', err);
    alert('Error al procesar la donación. Intenta nuevamente.');
  }
}

export default useDonate;
