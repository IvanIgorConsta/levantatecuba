// ============================================================================
// ARCHIVO DEPRECATED - USAR emailService.js EN SU LUGAR
// ============================================================================
// Este archivo se mantiene por compatibilidad temporal
// TODO: Migrar todos los usos a server/services/emailService.js
// ============================================================================

const emailService = require('../services/emailService');

console.warn('⚠️ DEPRECATED: server/utils/mailer.js está obsoleto. Usa server/services/emailService.js');

/**
 * @deprecated Usar emailService.sendEmail() directamente
 * Este wrapper mantiene compatibilidad temporal
 */
async function sendMail({ to, subject, html, from, text }) {
  console.warn(`⚠️ sendMail() es deprecated, migrar a emailService.sendEmail()`);
  
  return emailService.sendEmail({
    to,
    subject,
    html,
    text: text || html.replace(/<[^>]*>/g, '')
  });
}

module.exports = { sendMail };
