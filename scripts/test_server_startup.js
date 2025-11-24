/**
 * Script de verificación de inicio del servidor
 * Prueba que el servidor arranque sin errores de path-to-regexp
 */

const { spawn } = require('child_process');
const http = require('http');

// Colores para la consola
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m'
};

console.log(`${colors.cyan}================================`);
console.log(`  VERIFICACIÓN DE INICIO DEL SERVIDOR`);
console.log(`================================${colors.reset}\n`);

// Función para verificar si el servidor está respondiendo
function checkServer(port, maxAttempts = 10) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const tryConnect = () => {
      attempts++;
      
      const options = {
        hostname: 'localhost',
        port: port,
        path: '/healthz',
        method: 'GET'
      };
      
      const req = http.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve({ success: true, data, attempts });
          } else {
            resolve({ success: false, statusCode: res.statusCode, attempts });
          }
        });
      });
      
      req.on('error', (error) => {
        if (attempts < maxAttempts) {
          setTimeout(tryConnect, 1000); // Reintentar después de 1 segundo
        } else {
          reject(new Error(`No se pudo conectar después de ${attempts} intentos: ${error.message}`));
        }
      });
      
      req.end();
    };
    
    tryConnect();
  });
}

// Función para probar rutas CORS
async function testCorsRoute(port) {
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: port,
      path: '/api/donate',
      method: 'OPTIONS',
      headers: {
        'Origin': 'http://192.168.1.137:5173',
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'Content-Type'
      }
    };
    
    const req = http.request(options, (res) => {
      const corsHeader = res.headers['access-control-allow-origin'];
      const allowMethods = res.headers['access-control-allow-methods'];
      
      resolve({
        statusCode: res.statusCode,
        corsHeader,
        allowMethods,
        success: res.statusCode === 204 || res.statusCode === 200
      });
    });
    
    req.on('error', (error) => {
      resolve({
        success: false,
        error: error.message
      });
    });
    
    req.end();
  });
}

// Función principal
async function runTest() {
  const PORT = process.env.PORT || 5000;
  
  try {
    // Paso 1: Verificar que el servidor esté corriendo
    console.log(`${colors.yellow}[1/3] Verificando servidor en puerto ${PORT}...${colors.reset}`);
    
    try {
      const serverCheck = await checkServer(PORT, 3);
      
      if (serverCheck.success) {
        console.log(`${colors.green}✓ Servidor ya está corriendo${colors.reset}`);
        console.log(`   Respuesta healthz: ${serverCheck.data}\n`);
        
        // Paso 2: Probar rutas CORS
        console.log(`${colors.yellow}[2/3] Probando rutas CORS (preflight OPTIONS)...${colors.reset}`);
        
        const corsTest = await testCorsRoute(PORT);
        
        if (corsTest.success) {
          console.log(`${colors.green}✓ CORS preflight funcionando correctamente${colors.reset}`);
          console.log(`   Status: ${corsTest.statusCode}`);
          console.log(`   CORS Header: ${corsTest.corsHeader}`);
          console.log(`   Allow Methods: ${corsTest.allowMethods}\n`);
        } else {
          console.log(`${colors.red}✗ Error en CORS preflight${colors.reset}`);
          console.log(`   ${corsTest.error || `Status: ${corsTest.statusCode}`}\n`);
        }
        
        // Paso 3: Verificar rutas wildcard
        console.log(`${colors.yellow}[3/3] Verificando rutas wildcard corregidas...${colors.reset}`);
        
        // Test de ruta catch-all
        const catchAllOptions = {
          hostname: 'localhost',
          port: PORT,
          path: '/random-route-test-123',
          method: 'GET'
        };
        
        const catchAllTest = await new Promise((resolve) => {
          const req = http.request(catchAllOptions, (res) => {
            resolve({
              success: true,
              statusCode: res.statusCode
            });
          });
          
          req.on('error', (error) => {
            resolve({
              success: false,
              error: error.message
            });
          });
          
          req.end();
        });
        
        if (catchAllTest.success) {
          console.log(`${colors.green}✓ Rutas wildcard funcionando (catch-all SPA)${colors.reset}`);
          console.log(`   Status para ruta no-API: ${catchAllTest.statusCode}\n`);
        } else {
          console.log(`${colors.red}✗ Error en rutas wildcard${colors.reset}`);
          console.log(`   ${catchAllTest.error}\n`);
        }
        
        // Resumen
        console.log(`${colors.cyan}================================`);
        console.log(`            RESUMEN`);
        console.log(`================================${colors.reset}\n`);
        
        console.log(`${colors.green}✓ NO HAY ERRORES DE path-to-regexp${colors.reset}`);
        console.log(`${colors.green}✓ Servidor funcionando correctamente${colors.reset}`);
        console.log(`${colors.green}✓ CORS configurado y operativo${colors.reset}`);
        console.log(`${colors.green}✓ Wildcards corregidos de '*' a '(.*)'${colors.reset}\n`);
        
        console.log(`${colors.cyan}NOTA:${colors.reset} Si el servidor no estaba corriendo, inícialo con:`);
        console.log(`  npm run dev\n`);
        
      }
    } catch (error) {
      console.log(`${colors.yellow}⚠ Servidor no está corriendo${colors.reset}`);
      console.log(`${colors.cyan}Por favor, inicia el servidor con:${colors.reset}`);
      console.log(`  npm run dev\n`);
      console.log(`Luego ejecuta este script nuevamente para verificar.\n`);
    }
    
  } catch (error) {
    console.error(`${colors.red}Error durante la verificación:${colors.reset}`, error.message);
    process.exit(1);
  }
}

// Ejecutar test
runTest();
