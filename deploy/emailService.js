// ============================================================================
// SERVICIO DE EMAIL - LEVANTATECUBA
// Configuración con Nodemailer + Hostinger SMTP
// ============================================================================

const nodemailer = require('nodemailer');
const path = require('path');
const fs = require('fs').promises;

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  /**
   * Inicializar el transporter de Nodemailer
   */
  async initializeTransporter() {
    try {
      this.transporter = nodemailer.createTransporter({
        host: process.env.EMAIL_HOST || 'smtp.hostinger.com',
        port: parseInt(process.env.EMAIL_PORT || '465'),
        secure: process.env.EMAIL_SECURE !== 'false', // true para puerto 465
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS
        },
        // Configuraciones adicionales para Hostinger
        tls: {
          rejectUnauthorized: false // Solo si tienes problemas de SSL
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        rateLimit: 14 // emails por segundo
      });

      // Verificar conexión
      await this.verifyConnection();
      console.log('✅ Servicio de email inicializado correctamente');
    } catch (error) {
      console.error('❌ Error inicializando servicio de email:', error);
    }
  }

  /**
   * Verificar conexión SMTP
   */
  async verifyConnection() {
    if (!this.transporter) {
      throw new Error('Transporter no inicializado');
    }

    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      console.error('Error verificando conexión SMTP:', error);
      throw error;
    }
  }

  /**
   * Enviar email genérico
   */
  async sendEmail({ to, subject, html, text, attachments = [] }) {
    try {
      if (!this.transporter) {
        await this.initializeTransporter();
      }

      const mailOptions = {
        from: process.env.EMAIL_FROM || '"LevántateCuba" <noreply@levantatecuba.com>',
        to,
        subject,
        text,
        html,
        attachments
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email enviado: ${info.messageId}`);
      return {
        success: true,
        messageId: info.messageId,
        response: info.response
      };
    } catch (error) {
      console.error('❌ Error enviando email:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Email de bienvenida al registrarse
   */
  async sendWelcomeEmail(userEmail, userName) {
    const subject = '¡Bienvenido a LevántateCuba! 🇨🇺';
    
    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bienvenido a LevántateCuba</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #1e40af, #3b82f6); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e5e7eb; }
            .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 14px; color: #6b7280; }
            .button { display: inline-block; background: #1e40af; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .flag { font-size: 24px; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="flag">🇨🇺</div>
                <h1>¡Bienvenido a LevántateCuba!</h1>
                <p>Tu voz importa, tu verdad cuenta</p>
            </div>
            
            <div class="content">
                <h2>Hola ${userName || 'Compañero/a'},</h2>
                
                <p>¡Gracias por unirte a nuestra comunidad! LevántateCuba es más que una plataforma, es un movimiento de resistencia digital donde cada cubano tiene voz.</p>
                
                <h3>🎯 ¿Qué puedes hacer aquí?</h3>
                <ul>
                    <li><strong>Denunciar:</strong> Reporta abusos, corrupción y violaciones de derechos</li>
                    <li><strong>Informar:</strong> Mantente al día con noticias sin censura</li>
                    <li><strong>Conectar:</strong> Únete a una comunidad que busca la verdad</li>
                    <li><strong>Resistir:</strong> Contribuye al cambio desde donde estés</li>
                </ul>
                
                <div style="text-align: center;">
                    <a href="${process.env.FRONTEND_URL || 'https://levantatecuba.com'}" class="button">
                        Comenzar a denunciar
                    </a>
                </div>
                
                <h3>🔒 Tu seguridad es nuestra prioridad</h3>
                <p>Utilizamos las mejores tecnologías de seguridad para proteger tu identidad y tus denuncias. Puedes denunciar de forma anónima cuando lo necesites.</p>
                
                <p><strong>Recuerda:</strong> Cada denuncia cuenta, cada voz importa. Juntos construimos la Cuba libre que merecemos.</p>
            </div>
            
            <div class="footer">
                <p><strong>LevántateCuba</strong> - La verdad sin censura</p>
                <p>Este email fue enviado a ${userEmail}</p>
                <p>Si tienes problemas, contáctanos en: admin@levantatecuba.com</p>
            </div>
        </div>
    </body>
    </html>
    `;

    const text = `
    ¡Bienvenido a LevántateCuba, ${userName || 'Compañero/a'}!

    Gracias por unirte a nuestra comunidad de resistencia digital.

    En LevántateCuba puedes:
    - Denunciar abusos y corrupción
    - Mantenerte informado sin censura
    - Conectar con otros cubanos que buscan la verdad
    - Contribuir al cambio desde donde estés

    Visita: ${process.env.FRONTEND_URL || 'https://levantatecuba.com'}

    Tu seguridad es nuestra prioridad. Puedes denunciar de forma anónima.

    ¡Levántate por Cuba!
    Equipo LevántateCuba
    `;

    return await this.sendEmail({
      to: userEmail,
      subject,
      html,
      text
    });
  }

  /**
   * Email de recuperación de contraseña
   */
  async sendPasswordResetEmail(userEmail, resetToken, userName) {
    const resetUrl = `${process.env.PASSWORD_RESET_URL || 'https://levantatecuba.com/reset-password'}?token=${resetToken}`;
    const subject = 'Recuperar contraseña - LevántateCuba 🔑';

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Recuperar Contraseña</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #dc2626, #ef4444); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e5e7eb; }
            .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 14px; color: #6b7280; }
            .button { display: inline-block; background: #dc2626; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .alert { background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c; padding: 15px; border-radius: 6px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔑 Recuperar Contraseña</h1>
                <p>LevántateCuba</p>
            </div>
            
            <div class="content">
                <h2>Hola ${userName || 'Compañero/a'},</h2>
                
                <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en LevántateCuba.</p>
                
                <div style="text-align: center;">
                    <a href="${resetUrl}" class="button">
                        Restablecer Contraseña
                    </a>
                </div>
                
                <div class="alert">
                    <p><strong>⚠️ Importante:</strong></p>
                    <ul>
                        <li>Este enlace expira en <strong>1 hora</strong></li>
                        <li>Solo se puede usar una vez</li>
                        <li>Si no solicitaste este cambio, ignora este email</li>
                    </ul>
                </div>
                
                <p>Si tienes problemas con el botón, copia y pega este enlace en tu navegador:</p>
                <p style="word-break: break-all; background: #f3f4f6; padding: 10px; border-radius: 4px;">
                    ${resetUrl}
                </p>
                
                <p><strong>¿No solicitaste este cambio?</strong><br>
                Tu cuenta sigue segura. Simplemente ignora este email y tu contraseña no cambiará.</p>
            </div>
            
            <div class="footer">
                <p><strong>LevántateCuba</strong> - La verdad sin censura</p>
                <p>Este email fue enviado a ${userEmail}</p>
                <p>Si tienes problemas, contáctanos en: admin@levantatecuba.com</p>
            </div>
        </div>
    </body>
    </html>
    `;

    const text = `
    Recuperar Contraseña - LevántateCuba

    Hola ${userName || 'Compañero/a'},

    Recibimos una solicitud para restablecer tu contraseña.

    Para continuar, visita este enlace (válido por 1 hora):
    ${resetUrl}

    Si no solicitaste este cambio, ignora este email.

    Equipo LevántateCuba
    `;

    return await this.sendEmail({
      to: userEmail,
      subject,
      html,
      text
    });
  }

  /**
   * Email de confirmación de denuncia
   */
  async sendReportConfirmationEmail(userEmail, reportId, userName) {
    const subject = 'Denuncia recibida - LevántateCuba 📢';

    const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Denuncia Recibida</title>
        <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #059669, #10b981); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: white; padding: 30px; border: 1px solid #e5e7eb; }
            .footer { background: #f9fafb; padding: 20px; text-align: center; border-radius: 0 0 10px 10px; font-size: 14px; color: #6b7280; }
            .info-box { background: #ecfdf5; border: 1px solid #a7f3d0; color: #047857; padding: 15px; border-radius: 6px; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>📢 Denuncia Recibida</h1>
                <p>Tu voz ha sido escuchada</p>
            </div>
            
            <div class="content">
                <h2>Gracias ${userName || 'Compañero/a'},</h2>
                
                <p>Tu denuncia ha sido recibida correctamente y ya forma parte de nuestro registro de casos.</p>
                
                <div class="info-box">
                    <p><strong>📋 Información de tu denuncia:</strong></p>
                    <p><strong>ID de seguimiento:</strong> #${reportId}</p>
                    <p><strong>Fecha:</strong> ${new Date().toLocaleDateString('es-ES')}</p>
                    <p><strong>Estado:</strong> En revisión</p>
                </div>
                
                <h3>🔍 ¿Qué sigue ahora?</h3>
                <ol>
                    <li><strong>Revisión:</strong> Nuestro equipo revisará tu denuncia</li>
                    <li><strong>Verificación:</strong> Validaremos la información proporcionada</li>
                    <li><strong>Publicación:</strong> Si procede, será publicada de forma anónima</li>
                    <li><strong>Seguimiento:</strong> Te notificaremos sobre cambios importantes</li>
                </ol>
                
                <p><strong>🔒 Recuerda:</strong> Tu identidad está protegida. Las denuncias se publican de forma anónima para garantizar tu seguridad.</p>
                
                <p>Puedes hacer seguimiento de tu denuncia usando el ID: <strong>#${reportId}</strong></p>
            </div>
            
            <div class="footer">
                <p><strong>LevántateCuba</strong> - Cada denuncia cuenta</p>
                <p>Gracias por contribuir a la verdad sin censura</p>
            </div>
        </div>
    </body>
    </html>
    `;

    const text = `
    Denuncia Recibida - LevántateCuba

    Gracias ${userName || 'Compañero/a'},

    Tu denuncia ha sido recibida correctamente.

    ID de seguimiento: #${reportId}
    Fecha: ${new Date().toLocaleDateString('es-ES')}
    Estado: En revisión

    Próximos pasos:
    1. Revisión por nuestro equipo
    2. Verificación de la información
    3. Publicación anónima si procede
    4. Notificación de cambios

    Tu identidad está protegida.

    Equipo LevántateCuba
    `;

    return await this.sendEmail({
      to: userEmail,
      subject,
      html,
      text
    });
  }

  /**
   * Email de notificación administrativa
   */
  async sendAdminNotification(subject, content, type = 'info') {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@levantatecuba.com';
    
    return await this.sendEmail({
      to: adminEmail,
      subject: `[ADMIN] ${subject}`,
      html: `
        <h2>Notificación Administrativa - LevántateCuba</h2>
        <p><strong>Tipo:</strong> ${type}</p>
        <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES')}</p>
        <div style="background: #f8f9fa; padding: 20px; border-left: 4px solid #007bff;">
          ${content}
        </div>
      `,
      text: `
        Notificación Administrativa - LevántateCuba
        Tipo: ${type}
        Fecha: ${new Date().toLocaleString('es-ES')}
        
        ${content}
      `
    });
  }
}

// Crear instancia singleton
const emailService = new EmailService();

module.exports = emailService;

// ============================================================================
// EJEMPLOS DE USO:
// ============================================================================

/*
// 1. Email de bienvenida
await emailService.sendWelcomeEmail('usuario@example.com', 'Juan Pérez');

// 2. Email de recuperación de contraseña
await emailService.sendPasswordResetEmail('usuario@example.com', 'token123', 'Juan Pérez');

// 3. Confirmación de denuncia
await emailService.sendReportConfirmationEmail('usuario@example.com', 'REP-001', 'Juan Pérez');

// 4. Notificación administrativa
await emailService.sendAdminNotification('Nueva denuncia', 'Se recibió una nueva denuncia #REP-001', 'alert');

// 5. Email genérico
await emailService.sendEmail({
  to: 'usuario@example.com',
  subject: 'Asunto',
  html: '<h1>Contenido HTML</h1>',
  text: 'Contenido texto plano'
});
*/
