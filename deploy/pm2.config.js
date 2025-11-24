// ============================================================================
// CONFIGURACIÓN PM2 - LEVANTATECUBA BACKEND
// ============================================================================

module.exports = {
  apps: [{
    // Información básica de la aplicación
    name: 'levantatecuba',
    script: './server/server.js',
    cwd: '/var/www/levantatecuba',
    
    // Configuración de instancias
    instances: 1,  // Cambiar a 'max' para usar todos los cores CPU
    exec_mode: 'fork',  // 'cluster' si usas múltiples instancias
    
    // Variables de entorno
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    
    // Configuración de logs
    log_file: '/var/log/levantatecuba/combined.log',
    out_file: '/var/log/levantatecuba/out.log',
    error_file: '/var/log/levantatecuba/error.log',
    log_date_format: 'YYYY-MM-DD HH:mm Z',
    
    // Configuración de reinicio automático
    autorestart: true,
    watch: false,  // No reiniciar por cambios de archivos en producción
    max_memory_restart: '1G',  // Reiniciar si usa más de 1GB RAM
    
    // Configuración de reinicio por errores
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
    
    // Configuración avanzada
    kill_timeout: 5000,
    listen_timeout: 3000,
    
    // Configuración de cluster (si cambias exec_mode a 'cluster')
    // instances: 'max',
    // exec_mode: 'cluster',
    
    // Scripts de ciclo de vida
    post_update: ['npm install --production'],
    
    // Configuración de merge de logs
    merge_logs: true,
    
    // Configuración de tiempo
    time: true,
    
    // Variables de entorno específicas para producción
    env_production: {
      NODE_ENV: 'production',
      PORT: 5000,
      // Las demás variables se cargan desde el archivo .env
    }
  }]
}

// ============================================================================
// CONFIGURACIÓN DE DEPLOY (opcional)
// ============================================================================

// Descomenta y configura si quieres usar PM2 deploy
/*
module.exports.deploy = {
  production: {
    user: 'root',
    host: 'tu-servidor.com',
    ref: 'origin/main',
    repo: 'https://github.com/tu-usuario/levantatecuba.git',
    path: '/var/www/levantatecuba',
    'pre-deploy-local': '',
    'post-deploy': 'npm install --production && pm2 reload pm2.config.js --env production',
    'pre-setup': ''
  }
}
*/
