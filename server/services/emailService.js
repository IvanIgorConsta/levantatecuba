// ============================================================================
// SERVICIO DE EMAIL - LEVANTATECUBA
// Nodemailer + Hostinger SMTP
// ============================================================================

const nodemailer = require('nodemailer');
const crypto = require('crypto');

class EmailService {
  constructor() {
    this.transporter = null;
    this.enabled = false;
    this.init();
  }

  /**
   * Inicializar transporter de Nodemailer con Hostinger SMTP
   */
  init() {
    try {
      // Verificar si las credenciales SMTP están configuradas
      const { EMAIL_HOST, EMAIL_USER, EMAIL_PASS } = process.env;
      
      if (!EMAIL_HOST || !EMAIL_USER || !EMAIL_PASS) {
        console.warn('⚠️ EmailService deshabilitado: faltan credenciales SMTP (EMAIL_HOST, EMAIL_USER, EMAIL_PASS)');
        this.enabled = false;
        return;
      }

      // Verificar que nodemailer tenga el método createTransport
      if (!nodemailer || typeof nodemailer.createTransport !== 'function') {
        console.error('❌ Error: nodemailer.createTransport no está disponible');
        this.enabled = false;
        return;
      }

      // Usar createTransport (no createTransporter)
      this.transporter = nodemailer.createTransport({
        host: EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT) || 465,
        secure: true, // true para puerto 465 SSL
        auth: {
          user: EMAIL_USER,
          pass: EMAIL_PASS
        },
        // Configuraciones adicionales para mejor compatibilidad
        tls: {
          rejectUnauthorized: false // Solo si hay problemas de certificados
        }
      });

      this.enabled = true;
      console.log('✅ EmailService inicializado con Hostinger SMTP');
    } catch (error) {
      console.error('❌ Error inicializando EmailService:', error.message);
      this.enabled = false;
    }
  }

  /**
   * Verificar conexión SMTP
   */
  async verifyConnection() {
    try {
      if (!this.enabled || !this.transporter) {
        console.log('ℹ️ EmailService deshabilitado - verificación omitida');
        return false;
      }
      
      await this.transporter.verify();
      console.log('✅ Conexión SMTP verificada');
      return true;
    } catch (error) {
      console.error('❌ Error verificando SMTP:', error.message);
      return false;
    }
  }

  /**
   * Método genérico para enviar emails
   */
  async sendEmail({ to, subject, html, text }) {
    try {
      // Si el servicio está deshabilitado, hacer no-op
      if (!this.enabled) {
        console.log(`📧 [MOCK] Email NO enviado (servicio deshabilitado): ${subject} -> ${to}`);
        return { 
          success: true, 
          messageId: `mock-${Date.now()}`,
          mock: true,
          reason: 'EmailService deshabilitado - faltan credenciales SMTP'
        };
      }

      if (!this.transporter) {
        console.log(`📧 [MOCK] Email NO enviado (transporter no disponible): ${subject} -> ${to}`);
        return { 
          success: true, 
          messageId: `mock-${Date.now()}`,
          mock: true,
          reason: 'Transporter no inicializado'
        };
      }

      const mailOptions = {
        from: process.env.EMAIL_FROM || '"LevántateCuba" <noreply@levantatecuba.com>',
        to,
        subject,
        html,
        text: text || html.replace(/<[^>]*>/g, '') // Fallback a texto plano
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log(`✅ Email enviado a ${to}: ${subject}`);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error(`❌ Error enviando email a ${to}:`, error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Enviar email de bienvenida al registrarse
   */
  async sendWelcomeEmail(user) {
    const subject = '¡Bienvenido(a) a LevántateCuba! 🇨🇺';
    const baseUrl = process.env.PUBLIC_ORIGIN || 'https://levantatecuba.com';

    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bienvenido a LevántateCuba</title>
        <style>
            body { 
                font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Ubuntu, 'Helvetica Neue', Arial, sans-serif; 
                line-height: 1.6; 
                color: #333; 
                margin: 0; 
                padding: 20px; 
                background-color: #f9fafb; 
            }
            .container { 
                max-width: 600px; 
                margin: 0 auto; 
                background: white; 
                border-radius: 12px; 
                overflow: hidden; 
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); 
            }
            .header { 
                background: linear-gradient(135deg, #1e40af, #3b82f6); 
                color: white; 
                padding: 40px 30px; 
                text-align: center; 
            }
            .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
            .flag { font-size: 32px; margin-bottom: 10px; }
            .content { padding: 40px 30px; }
            .content h2 { color: #1e40af; margin-top: 0; }
            .button { 
                display: inline-block; 
                background: #1e40af; 
                color: white; 
                padding: 14px 28px; 
                text-decoration: none; 
                border-radius: 8px; 
                font-weight: 600; 
                margin: 20px 0; 
            }
            .features { list-style: none; padding: 0; }
            .features li { padding: 8px 0; }
            .features li:before { content: '🔸'; margin-right: 8px; }
            .footer { 
                background: #f8fafc; 
                padding: 30px; 
                text-align: center; 
                color: #6b7280; 
                font-size: 14px; 
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <div class="flag">🇨🇺</div>
                <h1>¡Bienvenido(a) a LevántateCuba!</h1>
                <p>Tu voz importa, tu verdad cuenta</p>
            </div>
            
            <div class="content">
                <h2>Hola ${user.name || 'Compañero/a'},</h2>
                
                <p>¡Gracias por unirte a nuestra comunidad! LevántateCuba es más que una plataforma, es un movimiento de resistencia digital donde cada cubano tiene voz.</p>
                
                <h3>🎯 ¿Qué puedes hacer aquí?</h3>
                <ul class="features">
                    <li><strong>Denunciar:</strong> Reporta abusos, corrupción y violaciones de derechos</li>
                    <li><strong>Informarte:</strong> Mantente al día con noticias sin censura</li>
                    <li><strong>Conectar:</strong> Únete a una comunidad que busca la verdad</li>
                    <li><strong>Resistir:</strong> Contribuye al cambio desde donde estés</li>
                </ul>
                
                <div style="text-align: center;">
                    <a href="${baseUrl}" class="button">Comenzar ahora</a>
                </div>
                
                <h3>🔒 Tu seguridad es nuestra prioridad</h3>
                <p>Utilizamos las mejores tecnologías de seguridad para proteger tu identidad y tus denuncias. Puedes denunciar de forma anónima cuando lo necesites.</p>
                
                <p><strong>Recuerda:</strong> Cada denuncia cuenta, cada voz importa. Juntos construimos la Cuba libre que merecemos.</p>
            </div>
            
            <div class="footer">
                <p><strong>LevántateCuba</strong> - La verdad sin censura</p>
                <p>Este email fue enviado a ${user.email}</p>
                <p>Si tienes problemas, contáctanos respondiendo este correo</p>
            </div>
        </div>
    </body>
    </html>
    `;

    const text = `
¡Bienvenido(a) a LevántateCuba, ${user.name || 'Compañero/a'}!

Gracias por unirte a nuestra comunidad de resistencia digital.

En LevántateCuba puedes:
- Denunciar abusos y corrupción
- Mantenerte informado sin censura  
- Conectar con otros cubanos que buscan la verdad
- Contribuir al cambio desde donde estés

Visita: ${baseUrl}

Tu seguridad es nuestra prioridad. Puedes denunciar de forma anónima.

¡Levántate por Cuba!
Equipo LevántateCuba
    `;

    return this.sendEmail({ to: user.email, subject, html, text });
  }

  /**
   * Notificación opcional de login (puedes usar si quieres)
   */
  async sendLoginNotice(user) {
    const subject = 'Nuevo acceso a tu cuenta - LevántateCuba';
    
    const html = `
    <div style="font-family: system-ui; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1e40af;">🔐 Nuevo acceso detectado</h2>
        <p>Hola <strong>${user.name}</strong>,</p>
        <p>Se ha detectado un nuevo acceso a tu cuenta de LevántateCuba.</p>
        <p><strong>Fecha:</strong> ${new Date().toLocaleString('es-ES')}</p>
        <p>Si fuiste tú, ignora este mensaje. Si no reconoces este acceso, cambia tu contraseña inmediatamente.</p>
        <p>--<br>Equipo LevántateCuba</p>
    </div>
    `;

    return this.sendEmail({ to: user.email, subject, html });
  }

  /**
   * Enviar email de recuperación de contraseña
   */
  async sendPasswordResetEmail(email, resetLink) {
    const subject = 'Restablecer contraseña — LevántateCuba';
    const ttlMinutes = process.env.PASSWORD_RESET_TTL_MIN || 30;

    const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Restablecer Contraseña</title>
        <style>
            body { 
                font-family: system-ui, -apple-system, 'Segoe UI', Roboto, Ubuntu, 'Helvetica Neue', Arial, sans-serif; 
                line-height: 1.6; 
                color: #333; 
                margin: 0; 
                padding: 20px; 
                background-color: #f9fafb; 
            }
            .container { 
                max-width: 600px; 
                margin: 0 auto; 
                background: white; 
                border-radius: 12px; 
                overflow: hidden; 
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); 
            }
            .header { 
                background: linear-gradient(135deg, #dc2626, #ef4444); 
                color: white; 
                padding: 40px 30px; 
                text-align: center; 
            }
            .header h1 { margin: 0; font-size: 28px; font-weight: 700; }
            .content { padding: 40px 30px; }
            .button { 
                display: inline-block; 
                background: #dc2626; 
                color: white; 
                padding: 16px 32px; 
                text-decoration: none; 
                border-radius: 8px; 
                font-weight: 600; 
                margin: 20px 0; 
                font-size: 16px;
            }
            .alert { 
                background: #fef2f2; 
                border: 1px solid #fecaca; 
                color: #b91c1c; 
                padding: 20px; 
                border-radius: 8px; 
                margin: 20px 0; 
            }
            .link-box { 
                word-break: break-all; 
                background: #f3f4f6; 
                padding: 15px; 
                border-radius: 6px; 
                font-family: monospace; 
                font-size: 14px; 
                margin: 15px 0; 
            }
            .footer { 
                background: #f8fafc; 
                padding: 30px; 
                text-align: center; 
                color: #6b7280; 
                font-size: 14px; 
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🔑 Restablecer Contraseña</h1>
                <p>LevántateCuba</p>
            </div>
            
            <div class="content">
                <h2>Hola,</h2>
                
                <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en LevántateCuba.</p>
                
                <div style="text-align: center;">
                    <a href="${resetLink}" class="button">Restablecer Contraseña</a>
                </div>
                
                <div class="alert">
                    <p><strong>⚠️ Información importante:</strong></p>
                    <ul>
                        <li>Este enlace expira en <strong>${ttlMinutes} minutos</strong></li>
                        <li>Solo se puede usar una vez</li>
                        <li>Si no solicitaste este cambio, ignora este email</li>
                    </ul>
                </div>
                
                <p><strong>¿Problemas con el botón?</strong> Copia y pega este enlace en tu navegador:</p>
                <div class="link-box">${resetLink}</div>
                
                <p><strong>¿No solicitaste este cambio?</strong><br>
                Tu cuenta sigue segura. Simplemente ignora este email y tu contraseña no cambiará.</p>
            </div>
            
            <div class="footer">
                <p><strong>LevántateCuba</strong> - La verdad sin censura</p>
                <p>Este email fue enviado a ${email}</p>
                <p>Si tienes problemas, contáctanos respondiendo este correo</p>
            </div>
        </div>
    </body>
    </html>
    `;

    const text = `
Restablecer Contraseña - LevántateCuba

Hola,

Recibimos una solicitud para restablecer tu contraseña.

Para continuar, visita este enlace (válido por ${ttlMinutes} minutos):
${resetLink}

IMPORTANTE:
- Este enlace expira en ${ttlMinutes} minutos
- Solo se puede usar una vez
- Si no solicitaste este cambio, ignora este email

¿Problemas? Copia y pega el enlace completo en tu navegador.

Equipo LevántateCuba
La verdad sin censura
    `;

    return this.sendEmail({ to: email, subject, html, text });
  }
}

// Exportar instancia singleton
module.exports = new EmailService();