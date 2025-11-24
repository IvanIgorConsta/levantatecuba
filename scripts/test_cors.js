/**
 * Script de verificación de CORS
 * Ejecutar con: node scripts/test_cors.js
 */

const http = require('http');

// Configuración de prueba
const API_HOST = 'localhost';
const API_PORT = 5000;
const TEST_ORIGINS = [
  'http://192.168.1.137:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'https://levantatecuba.com',
  'https://www.levantatecuba.com',
  'https://app.levantatecuba.com', // Subdominio
  'https://admin.levantatecuba.com', // Otro subdominio
  'http://evil-site.com', // Este debe ser bloqueado
  'https://fake-levantatecuba.com' // Este debe ser bloqueado
];

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

function testCorsRequest(origin) {
  return new Promise((resolve) => {
    const options = {
      hostname: API_HOST,
      port: API_PORT,
      path: '/api/donate',
      method: 'OPTIONS',
      headers: {
        'Origin': origin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const corsHeader = res.headers['access-control-allow-origin'];
        const allowCredentials = res.headers['access-control-allow-credentials'];
        const allowMethods = res.headers['access-control-allow-methods'];
        
        resolve({
          origin,
          status: res.statusCode,
          corsAllowed: corsHeader === origin || corsHeader === '*',
          corsHeader,
          allowCredentials,
          allowMethods,
          success: res.statusCode === 204 || res.statusCode === 200
        });
      });
    });

    req.on('error', (error) => {
      resolve({
        origin,
        status: 0,
        corsAllowed: false,
        error: error.message,
        success: false
      });
    });

    req.end();
  });
}

async function runTests() {
  console.log(`${colors.cyan}================================`);
  console.log(`     PRUEBA DE CONFIGURACIÓN CORS`);
  console.log(`     Servidor: ${API_HOST}:${API_PORT}`);
  console.log(`================================${colors.reset}\n`);

  const results = [];
  
  for (const origin of TEST_ORIGINS) {
    process.stdout.write(`Probando ${origin}... `);
    const result = await testCorsRequest(origin);
    results.push(result);
    
    if (result.error) {
      console.log(`${colors.red}✗ ERROR: ${result.error}${colors.reset}`);
    } else if (result.corsAllowed) {
      console.log(`${colors.green}✓ PERMITIDO${colors.reset} (Status: ${result.status})`);
    } else {
      console.log(`${colors.yellow}✗ BLOQUEADO${colors.reset} (Status: ${result.status})`);
    }
  }

  // Resumen
  console.log(`\n${colors.cyan}================================`);
  console.log(`            RESUMEN`);
  console.log(`================================${colors.reset}\n`);

  results.forEach((result) => {
    const icon = result.corsAllowed ? '✓' : '✗';
    const color = result.corsAllowed ? colors.green : colors.yellow;
    
    console.log(`${color}${icon}${colors.reset} ${result.origin}`);
    if (result.corsHeader) {
      console.log(`   CORS Header: ${result.corsHeader}`);
    }
    if (result.allowCredentials) {
      console.log(`   Credentials: ${result.allowCredentials}`);
    }
    if (result.error) {
      console.log(`   ${colors.red}Error: ${result.error}${colors.reset}`);
    }
    console.log('');
  });

  // Verificar que los esperados estén permitidos
  const expectedAllowed = [
    'http://192.168.1.137:5173',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'https://levantatecuba.com',
    'https://www.levantatecuba.com',
    'https://app.levantatecuba.com',
    'https://admin.levantatecuba.com'
  ];

  const expectedBlocked = [
    'http://evil-site.com',
    'https://fake-levantatecuba.com'
  ];

  let allCorrect = true;

  expectedAllowed.forEach(origin => {
    const result = results.find(r => r.origin === origin);
    if (!result?.corsAllowed) {
      console.log(`${colors.red}⚠ ERROR: ${origin} debería estar permitido pero fue bloqueado${colors.reset}`);
      allCorrect = false;
    }
  });

  expectedBlocked.forEach(origin => {
    const result = results.find(r => r.origin === origin);
    if (result?.corsAllowed) {
      console.log(`${colors.red}⚠ ERROR: ${origin} debería estar bloqueado pero fue permitido${colors.reset}`);
      allCorrect = false;
    }
  });

  if (allCorrect) {
    console.log(`${colors.green}✓ TODAS LAS PRUEBAS PASARON CORRECTAMENTE${colors.reset}\n`);
  } else {
    console.log(`${colors.red}✗ ALGUNAS PRUEBAS FALLARON${colors.reset}\n`);
  }
}

// Ejecutar pruebas
runTests().catch(error => {
  console.error(`${colors.red}Error ejecutando pruebas:${colors.reset}`, error);
  process.exit(1);
});
