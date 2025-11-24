// ============================================================================
// STRIPE DONATIONS ENDPOINT - PRODUCCIÓN - LEVANTATECUBA
// Endpoint optimizado para producción con Stripe Checkout
// ============================================================================

const express = require('express');
const router = express.Router();
const Stripe = require('stripe');

// Inicializar Stripe con clave según entorno
const stripe = new Stripe(
  process.env.STRIPE_SECRET_KEY || 
  (process.env.NODE_ENV === 'production' 
    ? process.env.STRIPE_SECRET_KEY 
    : 'sk_test_51QqeowEHDG8US3JEkEg8bwdhzeULCFhUnuPPDMX80bVG5aoIHv8KSR6qKyWVzL8tUyliPWQB8oGE7TL3MoF9d1bz00XDOO8xPG'
  ), 
  {
    apiVersion: '2023-10-16',
  }
);

// ============================================================================
// POST /api/donate - Crear sesión de Stripe Checkout para producción
// ============================================================================
router.post('/', async (req, res) => {
  try {
    // Extraer y sanitizar monto
    const requestedAmount = req.body.amount || 10;
    
    // Convertir a centavos y asegurar mínimo $1 (100 centavos)
    const amountInCents = Math.max(100, Math.floor(Number(requestedAmount) * 100));
    const amountInDollars = amountInCents / 100;
    
    // Log mínimo sin datos sensibles
    console.log(`[DONATE] Creando sesión: $${amountInDollars} USD`);
    
    // URL base según entorno
    const baseUrl = process.env.PUBLIC_ORIGIN || 
                   (process.env.NODE_ENV === 'production' 
                     ? 'https://levantatecuba.com' 
                     : 'http://localhost:5173');
    
    // Configuración de la sesión de Checkout
    const sessionConfig = {
      payment_method_types: ['card'],
      mode: 'payment',
      submit_type: 'donate',
      billing_address_collection: 'auto',
      allow_promotion_codes: true,
      customer_creation: 'always', // Stripe pedirá el email
      
      // Producto/línea de donación
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Donación a LevántateCuba',
            description: 'Tu apoyo hace posible nuestra misión de libertad',
            // Imagen opcional (debe estar en HTTPS para producción)
            images: process.env.NODE_ENV === 'production' 
              ? ['https://levantatecuba.com/logo.png'] 
              : undefined,
          },
          unit_amount: amountInCents,
        },
        quantity: 1,
      }],
      
      // URLs de redirección
      success_url: `${baseUrl}/donar/success?amount=${amountInDollars}`,
      cancel_url: `${baseUrl}/donar/cancel`,
      
      // Metadata para tracking interno
      metadata: {
        source: 'web_footer',
        amount_usd: amountInDollars,
        timestamp: new Date().toISOString(),
        environment: process.env.NODE_ENV || 'development'
      },
      
      // Configuración adicional para producción
      ...(process.env.NODE_ENV === 'production' && {
        // Expiración de sesión más larga en producción (1 hora)
        expires_at: Math.floor(Date.now() / 1000) + (60 * 60),
      })
    };
    
    // Crear la sesión
    const session = await stripe.checkout.sessions.create(sessionConfig);
    
    // Log de éxito (sin datos sensibles)
    console.log(`[DONATE] Sesión creada: ${session.id.substring(0, 10)}...`);
    
    // Devolver solo la URL de checkout
    res.json({
      url: session.url,
      // En desarrollo, incluir más información para debugging
      ...(process.env.NODE_ENV !== 'production' && {
        sessionId: session.id,
        amount: amountInDollars
      })
    });
    
  } catch (error) {
    // Log del error sin exponer detalles sensibles
    console.error('[DONATE] Error:', error.message);
    
    // Respuesta de error genérica para producción
    const errorMessage = process.env.NODE_ENV === 'production' 
      ? 'Error procesando la donación. Por favor, intenta nuevamente.'
      : error.message;
    
    res.status(500).json({
      error: errorMessage
    });
  }
});

// ============================================================================
// GET /api/donate/config - Obtener configuración pública (opcional)
// ============================================================================
router.get('/config', (req, res) => {
  // Solo devolver información pública y no sensible
  res.json({
    currency: 'usd',
    minAmount: 1,
    defaultAmount: 10,
    maxAmount: 10000,
    suggestedAmounts: [5, 10, 25, 50, 100],
    environment: process.env.NODE_ENV || 'development'
  });
});

// ============================================================================
// POST /api/donate/webhook - Webhook de Stripe (opcional para producción)
// ============================================================================
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  
  // Si no hay webhook secret configurado, simplemente confirmar recepción
  if (!endpointSecret) {
    return res.json({ received: true });
  }
  
  let event;
  
  try {
    // Verificar la firma del webhook
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('[DONATE WEBHOOK] Error de verificación:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // Manejar eventos específicos
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      // Log mínimo para producción
      console.log(`[DONATE WEBHOOK] Donación completada: $${session.amount_total / 100}`);
      
      // Aquí podrías:
      // - Guardar en base de datos
      // - Enviar email de agradecimiento
      // - Actualizar métricas
      break;
      
    case 'payment_intent.payment_failed':
      console.log('[DONATE WEBHOOK] Pago fallido');
      break;
      
    default:
      // Ignorar otros eventos
      break;
  }
  
  res.json({ received: true });
});

module.exports = router;