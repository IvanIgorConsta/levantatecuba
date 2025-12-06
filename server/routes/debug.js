// ============================================================================
// RUTAS DE DEBUG - LEVANTATECUBA
// Solo accesibles por administradores autenticados
// ============================================================================

const express = require('express');
const router = express.Router();
const verifyToken = require('../middleware/verifyToken');
const verifyRole = require('../middleware/verifyRole');
const emailService = require('../services/emailService');

// ============================================================================
// GET /api/debug/test-email
// Envía un email de prueba para verificar que SMTP funciona correctamente
// Requiere: Admin autenticado
// ============================================================================
router.get(
  '/test-email',
  verifyToken,
  verifyRole(['admin']),
  async (req, res) => {
    try {
      // Siempre enviar al email administrativo del sistema
      const adminEmail = emailService.getAdminEmail();

      console.log(`[Mail] 🧪 Test email solicitado → TO: ${adminEmail}, FROM: ${emailService.getFromAddress()}`);

      const result = await emailService.sendEmail({
        to: adminEmail,
        subject: '🧪 Prueba SMTP – LevántateCuba',
        html: `
          <div style="font-family: system-ui; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #16a34a;">✅ El SMTP está funcionando</h2>
            <p>Este es un email de prueba enviado desde el backend de <strong>LevántateCuba</strong>.</p>
            <table style="margin: 20px 0; border-collapse: collapse;">
              <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Fecha:</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${new Date().toLocaleString('es-ES', { timeZone: 'America/Havana' })}</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>Servidor:</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${process.env.PUBLIC_ORIGIN || 'localhost'}</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>FROM:</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">soporte@levantatecuba.com</td></tr>
              <tr><td style="padding: 8px; border: 1px solid #e5e7eb;"><strong>TO:</strong></td><td style="padding: 8px; border: 1px solid #e5e7eb;">${adminEmail}</td></tr>
            </table>
            <p style="color: #6b7280; font-size: 14px;">
              Si recibes este email, el sistema SMTP está funcionando correctamente.
            </p>
          </div>
        `,
        text: `Prueba SMTP - LevántateCuba\nEl SMTP está funcionando.\nFecha: ${new Date().toISOString()}`
      });

      if (result.success) {
        console.log(`[Mail] ✅ Test email enviado a ${adminEmail}`);
        return res.json({
          success: true,
          message: `Email de prueba enviado a ${adminEmail}`,
          messageId: result.messageId
        });
      } else {
        console.error(`[Mail] ❌ Error enviando test email:`, result.error);
        return res.status(500).json({
          success: false,
          error: 'Error al enviar email de prueba'
        });
      }
    } catch (error) {
      console.error('[Mail] ❌ Error en /test-email:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Error interno del servidor'
      });
    }
  }
);

// ============================================================================
// GET /api/debug/smtp-status
// Verifica el estado de la conexión SMTP sin enviar email
// Requiere: Admin autenticado
// ============================================================================
router.get(
  '/smtp-status',
  verifyToken,
  verifyRole(['admin']),
  async (req, res) => {
    try {
      const config = emailService.getConfig();
      const connectionResult = await emailService.verifyConnection();
      
      return res.json({
        success: connectionResult.connected,
        smtp: {
          ...config,
          connectionTest: connectionResult
        }
      });
    } catch (error) {
      console.error('[Mail] ❌ Error verificando SMTP:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Error verificando conexión SMTP',
        details: error.message
      });
    }
  }
);

module.exports = router;
