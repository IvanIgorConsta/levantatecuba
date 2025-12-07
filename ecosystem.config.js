/**
 * Configuración de PM2 para LevántateCuba
 * 
 * Uso:
 *   pm2 start ecosystem.config.js
 *   pm2 reload ecosystem.config.js
 */

module.exports = {
  apps: [
    {
      name: 'levantatecuba-backend',
      script: './server/server.js',
      cwd: '/var/www/levantatecuba',
      
      // Control de memoria - Reiniciar si excede 600MB
      max_memory_restart: '600M',
      
      // Modo de ejecución
      exec_mode: 'fork',
      instances: 1,
      
      // Auto-restart en caso de crash
      autorestart: true,
      watch: false,
      
      // Reintentos antes de considerar fallo permanente
      max_restarts: 10,
      restart_delay: 5000, // 5 segundos entre reinicios
      
      // Logs
      error_file: '/root/.pm2/logs/levantatecuba-backend-error.log',
      out_file: '/root/.pm2/logs/levantatecuba-backend-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Variables de entorno
      env: {
        NODE_ENV: 'production',
        PORT: 33521
      },
      
      // Timeout para shutdown graceful
      kill_timeout: 10000, // 10 segundos para cerrar conexiones
      
      // Opciones de Node.js
      node_args: [
        '--max-old-space-size=512', // Limitar heap a 512MB
        '--optimize-for-size'        // Optimizar uso de memoria
      ]
    }
  ]
};
