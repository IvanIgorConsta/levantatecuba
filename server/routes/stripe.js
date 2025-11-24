/**
 * Rutas de Stripe - Modo Stub Temporal
 * 
 * Este archivo está en modo stub mientras se espera la aprobación de Stripe.
 * Una vez que tengas las claves, reemplaza los stubs con la lógica real.
 * 
 * Configuración futura necesaria en .env:
 * - STRIPE_SECRET_KEY
 * - STRIPE_PUBLISHABLE_KEY
 * - STRIPE_WEBHOOK_SECRET
 * - STRIPE_PRICE_ID (para donaciones)
 */

const express = require('express');
const router = express.Router();

// ========================================
// CONFIGURACIÓN DE STRIPE (STUB)
// ========================================

// TODO: Descomentar cuando tengas las claves de Stripe
/*
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
*/

// Flag de control para saber si Stripe está configurado
const STRIPE_ENABLED = false; // TODO: Cambiar a true cuando tengas las claves

// Middleware para logging (útil para debugging)
router.use((req, res, next) => {
  console.log(`[Stripe Route] ${req.method} ${req.originalUrl} - Stripe ${STRIPE_ENABLED ? 'ENABLED' : 'DISABLED (STUB MODE)'}`);
  next();
});

// ========================================
// ENDPOINTS
// ========================================

/**
 * GET /api/stripe/health
 * Endpoint de salud para verificar el estado del módulo Stripe
 */
router.get('/health', (req, res) => {
  res.json({
    module: 'stripe',
    enabled: STRIPE_ENABLED,
    message: STRIPE_ENABLED 
      ? 'Stripe está configurado y operativo' 
      : 'Stripe aún no está configurado',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /api/stripe/config
 * Retorna la clave pública de Stripe para el frontend
 */
router.get('/config', (req, res) => {
  if (!STRIPE_ENABLED) {
    return res.status(501).json({
      error: 'Stripe no configurado',
      message: 'El sistema de pagos está temporalmente deshabilitado'
    });
  }

  // TODO: Implementar cuando tengas las claves
  /*
  res.json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
    currency: 'usd',
    country: 'US'
  });
  */
  
  res.status(501).json({
    error: 'Stripe no configurado',
    message: 'El sistema de pagos está temporalmente deshabilitado'
  });
});

/**
 * POST /api/stripe/donations/create-checkout-session
 * Crea una sesión de checkout para donaciones
 * 
 * Body esperado:
 * {
 *   amount: number (en centavos),
 *   currency: string (default: 'usd'),
 *   metadata: object (opcional)
 * }
 */
router.post('/donations/create-checkout-session', async (req, res) => {
  if (!STRIPE_ENABLED) {
    return res.status(501).json({
      error: 'Stripe no configurado',
      message: 'El sistema de donaciones está temporalmente deshabilitado. Por favor, intenta más tarde.'
    });
  }

  // TODO: Implementar la lógica real de Stripe
  /*
  try {
    const { amount, currency = 'usd', metadata = {} } = req.body;

    // Validaciones
    if (!amount || amount < 100) {
      return res.status(400).json({
        error: 'Monto inválido',
        message: 'El monto mínimo es $1.00'
      });
    }

    // Crear sesión de checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: currency,
          product_data: {
            name: 'Donación a LevántateCuba',
            description: 'Gracias por apoyar nuestra causa',
            images: ['https://tudominio.com/logo.png']
          },
          unit_amount: amount
        },
        quantity: 1
      }],
      mode: 'payment',
      success_url: `${process.env.CLIENT_URL}/donation/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/donation/cancel`,
      metadata: {
        type: 'donation',
        ...metadata
      }
    });

    res.json({
      sessionId: session.id,
      url: session.url
    });
  } catch (error) {
    console.error('Error creating checkout session:', error);
    res.status(500).json({
      error: 'Error al crear sesión de pago',
      message: error.message
    });
  }
  */

  // Respuesta stub
  res.status(501).json({
    error: 'Stripe no configurado',
    message: 'El sistema de donaciones está temporalmente deshabilitado'
  });
});

/**
 * POST /api/stripe/webhook
 * Webhook para recibir eventos de Stripe
 * 
 * IMPORTANTE: Este endpoint necesita el body RAW, no parseado
 */
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }), // Necesario para verificar la firma del webhook
  async (req, res) => {
    if (!STRIPE_ENABLED) {
      return res.status(501).send('Stripe no configurado');
    }

    // TODO: Implementar manejo de webhooks
    /*
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      // Verificar que el webhook viene de Stripe
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Manejar diferentes tipos de eventos
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        
        // Guardar donación en la base de datos
        console.log('✅ Pago completado:', session.id);
        console.log('Monto:', session.amount_total / 100, session.currency);
        console.log('Metadata:', session.metadata);
        
        // TODO: Guardar en base de datos
        // await saveDonation({
        //   sessionId: session.id,
        //   amount: session.amount_total,
        //   currency: session.currency,
        //   status: 'completed',
        //   metadata: session.metadata
        // });
        
        break;

      case 'payment_intent.payment_failed':
        const paymentIntent = event.data.object;
        console.error('❌ Pago fallido:', paymentIntent.id);
        
        // TODO: Manejar pago fallido
        // await handleFailedPayment(paymentIntent);
        
        break;

      default:
        console.log(`Evento no manejado: ${event.type}`);
    }

    // Responder a Stripe que recibimos el webhook
    res.json({ received: true });
    */

    // Respuesta stub
    res.status(501).send('Stripe no configurado - webhook deshabilitado');
  }
);

/**
 * GET /api/stripe/donations/success
 * Verificar el estado de una sesión de checkout completada
 */
router.get('/donations/success', async (req, res) => {
  if (!STRIPE_ENABLED) {
    return res.status(501).json({
      error: 'Stripe no configurado',
      message: 'No se puede verificar el estado del pago'
    });
  }

  // TODO: Implementar verificación de sesión
  /*
  try {
    const { session_id } = req.query;
    
    if (!session_id) {
      return res.status(400).json({
        error: 'Session ID requerido'
      });
    }

    const session = await stripe.checkout.sessions.retrieve(session_id);
    
    res.json({
      success: session.payment_status === 'paid',
      amount: session.amount_total / 100,
      currency: session.currency,
      customerEmail: session.customer_details?.email
    });
  } catch (error) {
    console.error('Error retrieving session:', error);
    res.status(500).json({
      error: 'Error al verificar el pago'
    });
  }
  */

  res.status(501).json({
    error: 'Stripe no configurado',
    message: 'Sistema de pagos temporalmente deshabilitado'
  });
});

/**
 * POST /api/stripe/donations/create-payment-intent
 * Alternativa: Crear un Payment Intent directamente (para custom checkout)
 */
router.post('/donations/create-payment-intent', async (req, res) => {
  if (!STRIPE_ENABLED) {
    return res.status(501).json({
      error: 'Stripe no configurado',
      message: 'El sistema de pagos está temporalmente deshabilitado'
    });
  }

  // TODO: Implementar Payment Intent
  /*
  try {
    const { amount, currency = 'usd' } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        type: 'donation'
      }
    });

    res.json({
      clientSecret: paymentIntent.client_secret
    });
  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({
      error: 'Error al crear intención de pago'
    });
  }
  */

  res.status(501).json({
    error: 'Stripe no configurado',
    message: 'Sistema de pagos temporalmente deshabilitado'
  });
});

/**
 * GET /api/stripe/test
 * Endpoint de prueba para verificar que las rutas están funcionando
 */
router.get('/test', (req, res) => {
  res.json({
    status: 'ok',
    message: 'Rutas de Stripe cargadas correctamente',
    mode: STRIPE_ENABLED ? 'PRODUCTION' : 'STUB',
    endpoints: [
      'GET /api/stripe/health',
      'GET /api/stripe/config',
      'GET /api/stripe/test',
      'POST /api/stripe/donations/create-checkout-session',
      'POST /api/stripe/donations/create-payment-intent',
      'GET /api/stripe/donations/success',
      'POST /api/stripe/webhook'
    ]
  });
});

// ========================================
// MIDDLEWARE DE ERROR
// ========================================

// Manejo de errores específico para rutas de Stripe
router.use((err, req, res, next) => {
  console.error('[Stripe Error]:', err);
  
  res.status(500).json({
    error: 'Error en el módulo de pagos',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Error interno del servidor',
    stripeEnabled: STRIPE_ENABLED
  });
});

// ========================================
// EXPORTAR ROUTER
// ========================================

module.exports = router;

/**
 * NOTAS DE IMPLEMENTACIÓN FUTURA:
 * 
 * 1. Instalar dependencias:
 *    npm install stripe
 * 
 * 2. Agregar variables de entorno en .env:
 *    STRIPE_SECRET_KEY=sk_live_xxx
 *    STRIPE_PUBLISHABLE_KEY=pk_live_xxx
 *    STRIPE_WEBHOOK_SECRET=whsec_xxx
 *    STRIPE_PRICE_ID=price_xxx (opcional, para productos fijos)
 * 
 * 3. Cambiar STRIPE_ENABLED a:
 *    const STRIPE_ENABLED = !!(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PUBLISHABLE_KEY);
 * 
 * 4. Crear modelo de base de datos para donaciones:
 *    - models/Donation.js
 * 
 * 5. Configurar webhook en Stripe Dashboard:
 *    https://tudominio.com/api/stripe/webhook
 * 
 * 6. Implementar frontend con Stripe Elements o Checkout
 * 
 * 7. Agregar logging y monitoreo de transacciones
 * 
 * 8. Considerar agregar:
 *    - Recibos por email
 *    - Historial de donaciones
 *    - Donaciones recurrentes (suscripciones)
 *    - Múltiples métodos de pago
 */

