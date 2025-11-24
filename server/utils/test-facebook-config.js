/**
 * Script de prueba para verificar la configuración de Facebook
 * Uso: node server/utils/test-facebook-config.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const getFacebookConfig = require('./getFacebookConfig');
const fetch = require('node-fetch');

async function testFacebookConfig() {
  console.log('\n=== Prueba de Configuración de Facebook ===\n');
  
  try {
    // Paso 1: Obtener y validar configuración
    console.log('1. Validando configuración...');
    const config = getFacebookConfig();
    console.log('✅ Configuración válida\n');
    
    // Paso 2: Verificar que podemos obtener info de la página
    console.log('2. Verificando acceso a la página...');
    const pageUrl = `https://graph.facebook.com/${config.VERSION}/${config.PAGE_ID}?fields=id,name&access_token=${config.TOKEN}`;
    
    const pageResponse = await fetch(pageUrl);
    const pageData = await pageResponse.json();
    
    if (pageResponse.ok && pageData.id) {
      console.log(`✅ Página verificada: ${pageData.name} (ID: ${pageData.id})\n`);
    } else {
      console.error('❌ Error al verificar página:', pageData.error || 'Error desconocido');
      return;
    }
    
    // Paso 3: Verificar permisos (debug token)
    console.log('3. Verificando permisos del token...');
    const debugUrl = `https://graph.facebook.com/${config.VERSION}/debug_token?input_token=${config.TOKEN}&access_token=${config.TOKEN}`;
    
    const debugResponse = await fetch(debugUrl);
    const debugData = await debugResponse.json();
    
    if (debugResponse.ok && debugData.data) {
      const tokenInfo = debugData.data;
      console.log(`✅ Token válido hasta: ${tokenInfo.expires_at ? new Date(tokenInfo.expires_at * 1000).toLocaleString() : 'No expira'}`);
      console.log(`   Permisos: ${tokenInfo.scopes ? tokenInfo.scopes.join(', ') : 'No disponible'}\n`);
    } else {
      console.warn('⚠️  No se pudo verificar el token (esto es normal con algunos tipos de token)\n');
    }
    
    // Paso 4: Hacer una publicación de prueba (opcional)
    console.log('4. ¿Deseas hacer una publicación de prueba? (esto publicará en tu página)');
    console.log('   Si quieres probar, ejecuta:');
    console.log(`   curl -X POST "https://graph.facebook.com/${config.VERSION}/${config.PAGE_ID}/feed" \\`);
    console.log('     -d "message=Prueba desde LevántateCuba" \\');
    console.log(`     -d "access_token=${config.TOKEN.slice(0, 20)}..."\n`);
    
    console.log('=== Configuración de Facebook OK ✅ ===\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.error('\nAsegúrate de que tu archivo .env contenga:');
    console.error('FACEBOOK_PAGE_ID=<ID numérico de la página>');
    console.error('FACEBOOK_PAGE_TOKEN=<Token EAAG... del System User>');
    console.error('FB_GRAPH_VERSION=v23.0 (opcional)\n');
  }
}

// Ejecutar la prueba
testFacebookConfig();
