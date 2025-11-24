// server/redactor_ia/services/countryProfiles_northamerica_africa.js
module.exports = {
  'Estados Unidos': {
    code: 'US', region: 'América del Norte',
    city_style: 'Ciudades extensas con rascacielos, suburbios amplios',
    architecture: 'Rascacielos modernos, suburbana diversa',
    climate: 'Variado según región',
    people_style: 'Población multicultural',
    environment: 'Urbano extenso, suburbios, autopistas',
    colors: 'Vidrio azul, acero, variado regional',
    flags_allowed: ['bandera estadounidense (estrellas y rayas)'],
    flags_forbidden: ['bandera cubana', 'bandera mexicana'],
    skyline_forbidden: ['México City', 'Toronto']
  },
  'Canadá': {
    code: 'CA', region: 'América del Norte',
    city_style: 'Ciudades modernas multiculturales',
    architecture: 'Contemporánea norteamericana, vidrio y acero',
    climate: 'Continental frío',
    people_style: 'Población multicultural',
    environment: 'Urbano moderno, naturaleza cercana, lagos',
    colors: 'Rojo arce, azul glaciar, gris urbano',
    flags_allowed: ['bandera canadiense (rojo con hoja de arce)'],
    flags_forbidden: ['bandera estadounidense'],
    skyline_forbidden: ['Nueva York', 'Chicago']
  },
  'Sudáfrica': {
    code: 'ZA', region: 'África Austral',
    city_style: 'Ciudades con segregación visible, townships',
    architecture: 'Colonial británica, contemporánea, townships informales',
    climate: 'Templado, mediterráneo',
    people_style: 'Población africana diversa, multirracial',
    environment: 'Urbano segregado, sabanas, costas',
    colors: 'Ocre africano, verde sabana, azul océano',
    flags_allowed: ['bandera sudafricana (multicolor)'],
    flags_forbidden: [],
    skyline_forbidden: ['Nairobi', 'Lagos']
  },
  'Nigeria': {
    code: 'NG', region: 'África Occidental',
    city_style: 'Metrópolis caótica y densa',
    architecture: 'Contemporánea informal, colonial británica',
    climate: 'Tropical húmedo',
    people_style: 'Población africana diversa',
    environment: 'Urbano denso, informal, mercados',
    colors: 'Verde nigeriano, amarillo, rojo',
    flags_allowed: ['bandera nigeriana (verde y blanco)'],
    flags_forbidden: [],
    skyline_forbidden: ['Accra', 'Dakar']
  },
  'Kenia': {
    code: 'KE', region: 'África Oriental',
    city_style: 'Ciudades con centros modernos y barrios informales',
    architecture: 'Contemporánea, colonial británica, slums',
    climate: 'Tropical templado',
    people_style: 'Población africana diversa',
    environment: 'Urbano mixto, sabanas cercanas',
    colors: 'Rojo keniata, verde, negro',
    flags_allowed: ['bandera keniana (negro, rojo, verde con escudo)'],
    flags_forbidden: [],
    skyline_forbidden: ['Dar es Salaam', 'Addis Ababa']
  }
};
