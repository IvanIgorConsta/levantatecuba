// server/redactor_ia/services/countryProfiles.js
/**
 * COUNTRY VISUAL PROFILES - Sistema IIF (Image Instruction Format)
 * 
 * Perfiles visuales estructurados por país para generación de imágenes contextualizadas.
 * Este módulo unifica todos los perfiles regionales en un registro completo.
 */

const latinamerica = require('./countryProfiles_latinamerica');
const europe = require('./countryProfiles_europe');
const asia = require('./countryProfiles_asia');
const middleeast = require('./countryProfiles_middleeast');
const northamerica_africa = require('./countryProfiles_northamerica_africa');

// Unificar todos los perfiles
const ALL_COUNTRY_PROFILES = {
  ...latinamerica,
  ...europe,
  ...asia,
  ...middleeast,
  ...northamerica_africa
};

// Perfil genérico global para fallback
const GLOBAL_PROFILE = {
  code: 'GLOBAL',
  region: 'Global',
  city_style: 'Ciudad urbana genérica moderna',
  architecture: 'Contemporánea internacional',
  climate: 'Templado',
  people_style: 'Población diversa',
  environment: 'Entorno urbano moderno',
  colors: 'Colores neutros urbanos',
  flags_allowed: [],
  flags_forbidden: [],
  skyline_forbidden: []
};

/**
 * Obtiene perfil de país por nombre
 * @param {string} countryName - Nombre del país
 * @returns {Object} Perfil de país o perfil global si no existe
 */
function getCountryProfile(countryName) {
  if (!countryName) return GLOBAL_PROFILE;
  
  const profile = ALL_COUNTRY_PROFILES[countryName];
  if (!profile) {
    console.log(`[CountryProfiles] País "${countryName}" no encontrado, usando perfil global`);
    return GLOBAL_PROFILE;
  }
  
  return profile;
}

/**
 * Lista todos los países disponibles
 * @returns {string[]} Array de nombres de países
 */
function getAvailableCountries() {
  return Object.keys(ALL_COUNTRY_PROFILES);
}

/**
 * Busca país por código ISO
 * @param {string} code - Código ISO del país (ej: 'CU', 'MX', 'ES')
 * @returns {Object|null} Perfil de país o null
 */
function getCountryByCode(code) {
  if (!code) return null;
  
  const country = Object.values(ALL_COUNTRY_PROFILES).find(
    p => p.code && p.code.toUpperCase() === code.toUpperCase()
  );
  
  return country || null;
}

module.exports = {
  ALL_COUNTRY_PROFILES,
  GLOBAL_PROFILE,
  getCountryProfile,
  getAvailableCountries,
  getCountryByCode
};
