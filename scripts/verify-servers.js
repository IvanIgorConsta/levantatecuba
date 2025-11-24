/**
 * Script de verificación para confirmar que backend y frontend están funcionando
 * Ejecutar: node scripts/verify-servers.js
 */

const http = require('http');
const { spawn } = require('child_process');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = colors.reset) {
  console.log(color + message + colors.reset);
}

function checkPort(port, host = 'localhost') {
  return new Promise((resolve) => {
    const options = {
      host,
      port,
      path: '/healthz',
      method: 'GET',
      timeout: 2000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ 
          success: true, 
          status: res.statusCode, 
          data,
          port,
          host 
        });
      });
    });

    req.on('error', (err) => {
      resolve({ 
        success: false, 
        error: err.message,
        port,
        host 
      });
    });

    req.on('timeout', () => {
      req.destroy();
      resolve({ 
        success: false, 
        error: 'Timeout',
        port,
        host 
      });
    });

    req.end();
  });
}

async function checkBackend() {
  log('\n🔍 Verificando Backend...', colors.cyan);
  
  // Intentar diferentes combinaciones
  const attempts = [
    { port: 5000, host: 'localhost' },
    { port: 5000, host: '127.0.0.1' },
    { port: 5000, host: '0.0.0.0' }
  ];

  for (const attempt of attempts) {
    const result = await checkPort(attempt.port, attempt.host);
    if (result.success) {
      log(`✅ Backend funcionando en http://${result.host}:${result.port}`, colors.green);
      log(`   Status: ${result.status}`, colors.green);
      return true;
    } else {
      log(`❌ No responde en http://${result.host}:${result.port} - ${result.error}`, colors.red);
    }
  }

  return false;
}

async function checkFrontend() {
  log('\n🔍 Verificando Frontend...', colors.cyan);
  
  const result = await checkPort(5173, 'localhost');
  if (result.success) {
    log(`✅ Frontend funcionando en http://localhost:5173`, colors.green);
    return true;
  } else {
    log(`❌ Frontend no está corriendo en puerto 5173`, colors.yellow);
    return false;
  }
}

function showInstructions() {
  log('\n📝 INSTRUCCIONES DE INICIO:', colors.bright + colors.blue);
  log('\n1. Primero iniciar el BACKEND:', colors.yellow);
  log('   cd server');
  log('   node server.js');
  log('   (o npm run server si tienes el script configurado)');
  
  log('\n2. En otra terminal, iniciar el FRONTEND:', colors.yellow);
  log('   npm run dev');
  
  log('\n3. Verificar en el navegador:', colors.yellow);
  log('   - Frontend: http://localhost:5173');
  log('   - Backend API: http://localhost:5000/healthz');
  
  log('\n💡 TIPS:', colors.cyan);
  log('   - Si el puerto 5173 está ocupado, detener el proceso con:');
  log('     Windows: netstat -ano | findstr :5173');
  log('     taskkill /F /PID <PID>');
  log('   - Si hay problemas de CORS, verificar que el backend esté corriendo primero');
}

async function testProxyConnection() {
  log('\n🔍 Probando conexión del Proxy...', colors.cyan);
  
  const options = {
    host: 'localhost',
    port: 5173,
    path: '/api/healthz',
    method: 'GET',
    timeout: 2000
  };

  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        if (res.statusCode === 200) {
          log(`✅ Proxy funcionando correctamente - /api/healthz respondió con status ${res.statusCode}`, colors.green);
          resolve(true);
        } else {
          log(`⚠️ Proxy respondió pero con status ${res.statusCode}`, colors.yellow);
          resolve(false);
        }
      });
    });

    req.on('error', (err) => {
      log(`❌ Error al conectar al proxy: ${err.message}`, colors.red);
      log(`   Esto indica que el proxy no está reenviando correctamente al backend`, colors.yellow);
      resolve(false);
    });

    req.end();
  });
}

async function main() {
  log('=' .repeat(60), colors.bright);
  log('   VERIFICADOR DE SERVIDORES - LEVANTATECUBA', colors.bright + colors.cyan);
  log('=' .repeat(60), colors.bright);

  const backendRunning = await checkBackend();
  const frontendRunning = await checkFrontend();

  if (backendRunning && frontendRunning) {
    const proxyWorking = await testProxyConnection();
    
    if (proxyWorking) {
      log('\n✅ ¡TODO FUNCIONANDO CORRECTAMENTE!', colors.bright + colors.green);
      log('   Puedes acceder a la aplicación en http://localhost:5173', colors.green);
    } else {
      log('\n⚠️ Backend y Frontend están corriendo pero el proxy no funciona', colors.yellow);
      log('   Reinicia el servidor de desarrollo del frontend', colors.yellow);
    }
  } else if (!backendRunning && !frontendRunning) {
    log('\n❌ Ningún servidor está corriendo', colors.red);
    showInstructions();
  } else if (!backendRunning) {
    log('\n❌ El backend no está corriendo', colors.red);
    log('   El frontend no podrá conectar a la API', colors.yellow);
    showInstructions();
  } else if (!frontendRunning) {
    log('\n⚠️ Solo el backend está corriendo', colors.yellow);
    showInstructions();
  }

  log('\n' + '=' .repeat(60), colors.bright);
}

// Ejecutar verificación
main().catch(console.error);
