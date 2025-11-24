// server/config/facebook.js
class ConfigError extends Error { constructor(msg){ super(msg); this.code='CONFIG_ERROR'; } }

function assertEnv(name) {
  const v = (process.env[name] ?? '').toString().trim();
  if (!v) throw new ConfigError(`[Config] Falta variable ${name}`);
  return v;
}

function getFacebookConfig() {
  const rawId = (process.env.FACEBOOK_APP_ID ?? '').toString();
  const appId = rawId.replace(/\D/g, ''); // usamos solo dígitos internamente

  // ✅ Acepta 13–20 dígitos (cubre IDs de 15 o 16 y margen futuro)
  if (!/^\d{13,20}$/.test(appId)) {
    throw new ConfigError(
      `FACEBOOK_APP_ID inválido: "${rawId}" (${appId.length} dígitos). Debe ser numérico (13–20 dígitos).`
    );
  }

  const appSecret = assertEnv('FACEBOOK_APP_SECRET');
  const graphVersion = (process.env.FACEBOOK_GRAPH_VERSION || 'v23.0').trim();
  const pageId = assertEnv('FACEBOOK_PAGE_ID');
  const pageToken = assertEnv('FACEBOOK_PAGE_TOKEN');

  // Log mínimo de control (sin exponer secretos)
  console.log('[FB Config]', { appIdLen: appId.length, graphVersion, pageId });

  return { appId, appSecret, graphVersion, pageId, pageToken };
}

module.exports = { getFacebookConfig };