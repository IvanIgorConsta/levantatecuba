// scripts/browser-update-config.js
// Script para ejecutar en la consola del navegador (F12)
// Asegúrate de estar en http://localhost:5000/admin/redactor-ia

(async function updateCubaConfig() {
  const CUBAN_SOURCES = [
    // Medios independientes cubanos
    'cibercuba.com',
    'eltoque.com',
    '14ymedio.com',
    'diariodecuba.com',
    'cubanet.org',
    'martinoticias.com',
    'adncuba.com',
    'ddcuba.com',
    'cubanosporelmundo.com',
    
    // Medios internacionales
    'bbc.com',
    'reuters.com',
    'apnews.com',
    'elpais.com',
    'cnn.com',
    'nytimes.com',
    'miamiherald.com'
  ];

  console.log('🔧 Actualizando configuración del Redactor IA...');
  
  try {
    const response = await fetch('/api/redactor-ia/config', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        trustedSources: CUBAN_SOURCES,
        strictCuba: true,
        enforceSourceAllowlist: true,
        maxTopicsPerScan: 20,
        freshnessWindowHours: 24,
        perSourceCap: 5,
        newsApiEnabled: true
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    console.log('✅ Configuración actualizada exitosamente!');
    console.log('📋 Nueva configuración:');
    console.log('  - Fuentes:', CUBAN_SOURCES.length);
    console.log('  - Modo Cuba estricto: ON');
    console.log('  - Max temas/scan: 20');
    console.log('  - Ventana frescura: 24h');
    console.log('  - Cap por fuente: 5');
    
    console.log('\n🔥 Fuentes configuradas:');
    console.log('📰 Medios cubanos:', CUBAN_SOURCES.slice(0, 9).join(', '));
    console.log('🌍 Medios internacionales:', CUBAN_SOURCES.slice(9).join(', '));
    
    console.log('\n✅ Recarga la página para ver los cambios');
    
    return data;
    
  } catch (error) {
    console.error('❌ Error actualizando configuración:', error.message);
    console.error('💡 Asegúrate de:');
    console.error('  1. Estar en /admin/redactor-ia');
    console.error('  2. Haber iniciado sesión como admin');
    console.error('  3. Que el servidor esté corriendo');
  }
})();
