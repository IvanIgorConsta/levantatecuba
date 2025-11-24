// server/redactor_ia/test-image-theme.js
/**
 * Script de prueba para ImageThemeEngine
 * Valida casos de prueba específicos
 */

const { ImageThemeEngine } = require('./services/imageThemeEngine');
const { buildPrompt } = require('./services/promptTemplates');

// Caso 1: Alejandro Gil - espionaje (NO desastre)
const testCase1 = {
  title: 'Exministro cubano Alejandro Gil enfrenta cargos de espionaje y delitos',
  summary: 'El exministro de Economía fue acusado de espionaje, corrupción y delitos contra la seguridad del Estado.',
  content: 'El exministro de Economía y Planificación de Cuba, Alejandro Gil Fernández, enfrenta graves cargos de espionaje y corrupción según confirmaron fuentes oficiales. La Fiscalía General de la República presentó acusaciones formales que incluyen delitos contra la seguridad del Estado, revelación de secretos oficiales y enriquecimiento ilícito. El caso marca un precedente en la lucha contra la corrupción en altos niveles del gobierno cubano.',
  tags: ['Alejandro Gil', 'corrupción', 'espionaje', 'Cuba', 'justicia'],
  category: 'Política'
};

// Caso 2: Huracán real (SÍ desastre)
const testCase2 = {
  title: 'Huracán Oscar azota las costas orientales de Cuba con vientos de categoría 1',
  summary: 'El huracán Oscar tocó tierra en Holguín causando inundaciones y daños significativos en la infraestructura.',
  content: 'El huracán Oscar, con vientos sostenidos de 140 km/h, impactó las costas de Holguín en la madrugada del domingo. Equipos de Defensa Civil evacuaron a más de 5,000 personas de zonas bajas. Se reportan inundaciones costeras severas y daños en viviendas. El Centro Nacional de Huracanes mantiene vigilancia sobre la trayectoria del sistema.',
  tags: ['huracán Oscar', 'desastre natural', 'inundación', 'Cuba', 'emergencia'],
  category: 'Desastres'
};

// Caso 3: Economía (NO desastre)
const testCase3 = {
  title: 'Inflación en Cuba alcanza niveles récord según datos oficiales',
  summary: 'El gobierno reconoce un aumento significativo en los precios de productos básicos.',
  content: 'Las autoridades cubanas reportaron un incremento del 40% en los índices de inflación durante el último trimestre. Los precios de alimentos básicos como arroz, aceite y carne han experimentado alzas significativas. Economistas atribuyen la situación a la escasez de divisas y las dificultades en las importaciones.',
  tags: ['inflación', 'economía', 'Cuba', 'precios', 'crisis económica'],
  category: 'Economía'
};

// Test function
function testImageThemeEngine() {
  console.log('='.repeat(80));
  console.log('PRUEBA: ImageThemeEngine - Detección de Tema sin Sesgos');
  console.log('='.repeat(80));
  console.log('');
  
  const engine = new ImageThemeEngine({
    disasterThreshold: 0.75,
    keywordsThreshold: 2
  });
  
  const testCases = [
    { name: 'Caso 1: Alejandro Gil (Espionaje/Justicia)', data: testCase1, expectedDisaster: false },
    { name: 'Caso 2: Huracán Oscar', data: testCase2, expectedDisaster: true },
    { name: 'Caso 3: Inflación/Economía', data: testCase3, expectedDisaster: false }
  ];
  
  testCases.forEach((testCase, index) => {
    console.log(`\n${'─'.repeat(80)}`);
    console.log(`TEST ${index + 1}: ${testCase.name}`);
    console.log(`${'─'.repeat(80)}`);
    console.log(`Título: "${testCase.data.title}"`);
    console.log(`Categoría: "${testCase.data.category}"`);
    console.log('');
    
    // Ejecutar detección
    const result = engine.deriveTheme(testCase.data);
    
    // Construir prompt
    const { prompt, negative } = buildPrompt(result, testCase.data);
    
    // Mostrar resultados
    console.log('RESULTADO:');
    console.log(`  contextId: ${result.contextId}`);
    console.log(`  disaster: ${result.disaster}`);
    console.log(`  confidence: ${result.confidence.toFixed(2)}`);
    console.log(`  keywords: [${result.keywords.slice(0, 5).join(', ')}]`);
    console.log(`  reasons: [${result.reasons.join(', ')}]`);
    console.log('');
    console.log('PROMPT GENERADO:');
    console.log(`  "${prompt.substring(0, 200)}..."`);
    console.log('');
    console.log('NEGATIVOS:');
    console.log(`  "${negative.substring(0, 100)}..."`);
    console.log('');
    
    // Validación
    const passed = result.disaster === testCase.expectedDisaster;
    console.log(`VALIDACIÓN: ${passed ? '✅ PASS' : '❌ FAIL'}`);
    if (!passed) {
      console.log(`  Esperado disaster=${testCase.expectedDisaster}, obtenido disaster=${result.disaster}`);
    }
    console.log('');
  });
  
  console.log('='.repeat(80));
  console.log('FIN DE PRUEBAS');
  console.log('='.repeat(80));
}

// Ejecutar si se llama directamente
if (require.main === module) {
  testImageThemeEngine();
}

module.exports = { testImageThemeEngine };
