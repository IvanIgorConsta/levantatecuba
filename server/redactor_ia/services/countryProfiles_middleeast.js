// server/redactor_ia/services/countryProfiles_middleeast.js
module.exports = {
  'Israel': {
    code: 'IL', region: 'Medio Oriente',
    city_style: 'Ciudades modernas con sitios históricos antiguos',
    architecture: 'Bauhaus (Tel Aviv), piedra jerusalén',
    climate: 'Mediterráneo, desértico',
    people_style: 'Población judía diversa, árabe-israelí',
    environment: 'Costa mediterránea, desierto, sitios bíblicos',
    colors: 'Piedra dorada Jerusalem, azul mediterráneo',
    flags_allowed: ['bandera israelí (azul y blanco con estrella de David)'],
    flags_forbidden: ['bandera palestina'],
    skyline_forbidden: ['Dubai', 'El Cairo']
  },
  'Palestina': {
    code: 'PS', region: 'Medio Oriente',
    city_style: 'Ciudades históricas con arquitectura árabe',
    architecture: 'Árabe tradicional, piedra',
    climate: 'Mediterráneo, árido',
    people_style: 'Población árabe palestina',
    environment: 'Urbano histórico, ocupación',
    colors: 'Piedra beige, verde olivo, rojo keffiyeh',
    flags_allowed: ['bandera palestina (negro, blanco, verde, rojo)'],
    flags_forbidden: ['bandera israelí'],
    skyline_forbidden: ['Tel Aviv', 'Jerusalén oeste']
  },
  'Irán': {
    code: 'IR', region: 'Medio Oriente',
    city_style: 'Ciudades persas con arquitectura islámica',
    architecture: 'Persa islámica, mosaicos',
    climate: 'Árido, desértico',
    people_style: 'Población persa',
    environment: 'Montañas, desiertos, mezquitas',
    colors: 'Azul persa, turquesa, dorado',
    flags_allowed: ['bandera iraní (verde, blanco, rojo)'],
    flags_forbidden: ['bandera saudí', 'bandera estadounidense'],
    skyline_forbidden: ['Dubai', 'Riad']
  },
  'Arabia Saudita': {
    code: 'SA', region: 'Medio Oriente',
    city_style: 'Ciudades ultra-modernas en el desierto',
    architecture: 'Rascacielos futuristas, mezquitas',
    climate: 'Desértico extremo, cálido',
    people_style: 'Población árabe, vestimenta tradicional',
    environment: 'Desierto, arquitectura islámica',
    colors: 'Dorado desértico, verde islámico',
    flags_allowed: ['bandera saudí (verde con caligrafía)'],
    flags_forbidden: ['bandera iraní', 'bandera israelí'],
    skyline_forbidden: ['Dubai', 'Doha']
  },
  'Turquía': {
    code: 'TR', region: 'Medio Oriente',
    city_style: 'Ciudades entre Europa y Asia',
    architecture: 'Otomana, mezquitas, contemporánea',
    climate: 'Mediterráneo, continental',
    people_style: 'Población turca',
    environment: 'Bósforo, mezquitas, bazares',
    colors: 'Rojo turco, azul Iznik, dorado',
    flags_allowed: ['bandera turca (roja con estrella y luna)'],
    flags_forbidden: ['bandera griega'],
    skyline_forbidden: ['Atenas', 'Dubai']
  },
  'Siria': {
    code: 'SY', region: 'Medio Oriente',
    city_style: 'Ciudades históricas con daños de guerra',
    architecture: 'Árabe histórica, destrucción visible',
    climate: 'Árido, desértico',
    people_style: 'Población árabe',
    environment: 'Ruinas antiguas, destrucción',
    colors: 'Piedra beige, ocre polvoriento',
    flags_allowed: ['bandera siria (roja, blanca, negra)'],
    flags_forbidden: ['bandera turca', 'bandera israelí'],
    skyline_forbidden: ['Beirut', 'Tel Aviv']
  },
  'Egipto': {
    code: 'EG', region: 'África del Norte',
    city_style: 'Ciudades caóticas con monumentos antiguos',
    architecture: 'Faraónica antigua, islámica, contemporánea densa',
    climate: 'Desértico, cálido',
    people_style: 'Población árabe egipcia',
    environment: 'Nilo, pirámides, desierto',
    colors: 'Dorado desértico, azul Nilo, ocre',
    flags_allowed: ['bandera egipcia (roja, blanca, negra con águila)'],
    flags_forbidden: ['bandera libia', 'bandera sudanesa'],
    skyline_forbidden: ['Dubai', 'El Cairo moderno']
  },
  'Marruecos': {
    code: 'MA', region: 'África del Norte',
    city_style: 'Ciudades con medinas y arquitectura árabe-bereber',
    architecture: 'Árabe-bereber, mosaicos, riads',
    climate: 'Mediterráneo, desértico',
    people_style: 'Población árabe-bereber',
    environment: 'Medinas, desierto, costas',
    colors: 'Terracota, azul Chefchaouen, verde menta',
    flags_allowed: ['bandera marroquí (roja con estrella verde)'],
    flags_forbidden: ['bandera argelina'],
    skyline_forbidden: ['Argel', 'Túnez']
  }
};
