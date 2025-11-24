const fs = require('fs');
const path = require('path');

// Verificar si existe el archivo .env
const envPath = path.join(__dirname, '../server/.env');
if (!fs.existsSync(envPath)) {
  console.log('⚠️ No se encontró archivo server/.env');
  console.log('Por favor, crea el archivo con las siguientes variables:');
  console.log('FACEBOOK_APP_ID=tu_app_id_aqui');
  console.log('FACEBOOK_APP_SECRET=tu_app_secret_aqui');
  console.log('FACEBOOK_PAGE_ID=tu_page_id_aqui');
  console.log('FACEBOOK_PAGE_TOKEN=tu_page_token_aqui');
  console.log('FACEBOOK_GRAPH_VERSION=v23.0');
  process.exit(1);
}

require('dotenv').config({ path: 'server/.env', override: true });
const v = (process.env.FACEBOOK_APP_ID || '').toString();
const digits = v.replace(/\D/g,'');

if (!v) {
  console.log('⚠️ FACEBOOK_APP_ID no está configurado en server/.env');
} else {
  console.log('APP_ID =', v);
  console.log('len =', v.length, 'digitsOnlyLen =', digits.length);
  console.log('charCodes =', [...v].map(c=>c.charCodeAt(0)));
  
  // Validar el formato
  if (!/^\d{13,20}$/.test(digits)) {
    console.log('❌ El APP_ID debe ser numérico y tener entre 13 y 20 dígitos');
  } else {
    console.log('✅ El APP_ID tiene un formato válido');
  }
}