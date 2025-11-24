// src/lib/runtimeConfig.js
// Precedencia: ENV > window.__APP_CONFIG__ > defaults

const toBool  = (v) => String(v ?? '').trim().toLowerCase() === 'true';
const toMode  = (v) => (String(v ?? '').trim().toLowerCase() === 'internal' ? 'internal' : 'external');
const noSlash = (s) => String(s || '').replace(/\/$/, '');

const ENV = import.meta.env || {};
const WIN = typeof window !== 'undefined' ? window : undefined;
const APP = (WIN && WIN.__APP_CONFIG__) || {}; // si existe

export const RUNTIME_CONFIG = {
  STORE_URL: (ENV.VITE_STORE_URL ?? APP.STORE_URL ?? ''),
  USE_SHOPIFY: toBool(ENV.VITE_USE_SHOPIFY ?? APP.USE_SHOPIFY ?? false),
  SHOPIFY_API_BASE: noSlash(ENV.VITE_SHOPIFY_API_BASE ?? APP.SHOPIFY_API_BASE ?? ''),
  STORE_MODE: toMode(ENV.VITE_STORE_MODE ?? APP.STORE_MODE ?? 'external'),
};

export function isExternalStore(storeUrl) {
  if (!storeUrl) return false;
  try {
    const tgt = new URL(storeUrl).origin;
    return typeof window !== 'undefined' && tgt !== window.location.origin;
  } catch { return false; }
}

// Shim de compatibilidad para código antiguo
export function getConfig() {
  return RUNTIME_CONFIG;
}

// Log único
if (WIN && !WIN.__LC_RUNTIME_LOGGED__) {
  WIN.__LC_RUNTIME_LOGGED__ = true;
  console.info('[runtimeConfig] USE_SHOPIFY =', RUNTIME_CONFIG.USE_SHOPIFY);
  console.info('[runtimeConfig] SHOPIFY_API_BASE =', RUNTIME_CONFIG.SHOPIFY_API_BASE);
  console.info('[runtimeConfig] STORE_MODE =', RUNTIME_CONFIG.STORE_MODE);
  console.info('[runtimeConfig] STORE_URL =', RUNTIME_CONFIG.STORE_URL || '(empty)');
}

// Funciones helper para compatibilidad
export function getStoreMode() {
  return RUNTIME_CONFIG.STORE_MODE;
}

export function getStoreExternalUrl() {
  return RUNTIME_CONFIG.STORE_URL;
}

export function getUseShopify() {
  return RUNTIME_CONFIG.USE_SHOPIFY;
}

export function getShopifyApiBase() {
  return RUNTIME_CONFIG.SHOPIFY_API_BASE;
}

// Función legacy para compatibilidad (si alguien carga app-config.json)
export async function loadConfig() {
  // No-op: ahora todo se resuelve con precedencia directa
  return Promise.resolve();
}