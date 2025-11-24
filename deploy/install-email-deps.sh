#!/bin/bash

# ============================================================================
# SCRIPT PARA INSTALAR DEPENDENCIAS DE EMAIL SERVICE
# Instala Nodemailer y dependencias relacionadas
# ============================================================================

echo "📦 Instalando dependencias del servicio de email..."

# Instalar nodemailer y dependencias
npm install --save nodemailer

# Dependencias adicionales para mejorar compatibilidad
npm install --save nodemailer-smtp-transport

echo "✅ Dependencias instaladas correctamente"

# Mostrar versiones instaladas
echo ""
echo "📋 Versiones instaladas:"
npm list nodemailer
npm list nodemailer-smtp-transport

echo ""
echo "💡 Ejemplo de uso del servicio de email:"
echo "const emailService = require('./deploy/emailService');"
echo "await emailService.sendWelcomeEmail('usuario@example.com', 'Nombre Usuario');"
